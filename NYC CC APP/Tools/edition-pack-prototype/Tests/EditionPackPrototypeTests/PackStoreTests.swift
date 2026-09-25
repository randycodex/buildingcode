import XCTest
@testable import EditionPackPrototype
final class PackStoreTests: XCTestCase {
    let bundlePath = "CodeContent/authored/new-york-city/nyc-2014/bundle.json"
    var identities: [PackManifest.SourceIdentity] {
        [1, 2].map { .init(canonicalEdition: bundlePath + "#1", jurisdictionID: 1, codeID: 1, categoryID: $0) }
    }
    func fixture(_ root: URL, revision: String) throws -> (URL, String) {
        let dir = root.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir.appendingPathComponent("prepared"), withIntermediateDirectories: true)
        let data = Data("content-\(revision)".utf8)
        try data.write(to: dir.appendingPathComponent("prepared/chapter.json"))
        try data.write(to: dir.appendingPathComponent("prepared/second.json"))
        let bundle = Data(#"{"schemaVersion":5,"jurisdictions":[{"id":1,"name":"New York City"}],"codes":[{"id":1,"jurisdictionID":1,"name":"2014 Construction Codes"}],"codeSections":[{"id":1,"codeID":1,"name":"Administrative Provisions"},{"id":2,"codeID":1,"name":"Building Code"}],"chapters":[]}"#.utf8)
        try bundle.write(to: dir.appendingPathComponent("bundle.json"))
        let manifest = PackManifest(packID: "nyc-2014", revision: revision, bundlePath: bundlePath, sourceIdentities: identities, files: [.init(path: "bundle.json", bytes: bundle.count, sha256: PackStore.digest(bundle)), .init(path: "prepared/chapter.json", bytes: data.count, sha256: PackStore.digest(data)), .init(path: "prepared/second.json", bytes: data.count, sha256: PackStore.digest(data))])
        let encoded = try JSONEncoder().encode(manifest)
        try encoded.write(to: dir.appendingPathComponent("manifest.json"))
        return (dir, PackStore.digest(encoded))
    }
    func testInstallUpdateRollbackAndFailures() throws {
        let root = URL(fileURLWithPath: "/private/tmp").appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = try PackStore(root: root.appendingPathComponent("store"))
        let a = try fixture(root, revision: "a"), b = try fixture(root, revision: "b")
        try store.install(from: a.0, expectedManifestDigest: a.1)
        XCTAssertEqual(try store.activeRevision(packID: "nyc-2014"), "a")
        XCTAssertThrowsError(try store.install(from: b.0, expectedManifestDigest: b.1, availableBytes: { 0 }))
        for boundary in [InstallCheckpoint.beforeCopy, .afterFile, .beforeActivation] {
            XCTAssertThrowsError(try store.install(from: b.0, expectedManifestDigest: b.1, checkpoint: { if $0 == boundary { throw PackFailure.missingRevision } }))
            XCTAssertEqual(try store.activeRevision(packID: "nyc-2014"), "a")
        }
        for stopAfter in 1...4 {
            var copied = 0
            XCTAssertThrowsError(try store.install(from: b.0, expectedManifestDigest: b.1, checkpoint: {
                if $0 == .afterFile { copied += 1; if copied == stopAfter { throw PackFailure.missingRevision } }
            }))
            XCTAssertEqual(copied, stopAfter)
            XCTAssertEqual(try store.activeRevision(packID: "nyc-2014"), "a")
        }
        try store.install(from: b.0, expectedManifestDigest: b.1)
        XCTAssertEqual(try store.activeRevision(packID: "nyc-2014"), "b")
        try store.activate(packID: "nyc-2014", revision: "a", expectedManifestDigest: a.1)
        XCTAssertEqual(try store.activeRevision(packID: "nyc-2014"), "a")
        XCTAssertThrowsError(try store.install(from: b.0, expectedManifestDigest: a.1))
        try Data("bad".utf8).write(to: b.0.appendingPathComponent("prepared/chapter.json"))
        XCTAssertThrowsError(try store.install(from: b.0, expectedManifestDigest: b.1))
        XCTAssertEqual(try store.activeRevision(packID: "nyc-2014"), "a")
    }
    func testRejectExtraSymlinkTraversal() throws {
        let root = URL(fileURLWithPath: "/private/tmp").appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = try PackStore(root: root.appendingPathComponent("store"))
        let a = try fixture(root, revision: "a")
        let extra = a.0.appendingPathComponent("extra")
        try Data().write(to: extra)
        XCTAssertThrowsError(try store.install(from: a.0, expectedManifestDigest: a.1))
        try FileManager.default.removeItem(at: extra)
        try FileManager.default.createSymbolicLink(at: extra, withDestinationURL: a.0.appendingPathComponent("prepared/chapter.json"))
        XCTAssertThrowsError(try store.install(from: a.0, expectedManifestDigest: a.1))
        try FileManager.default.removeItem(at: extra)
        let manifest = PackManifest(packID: "nyc-2014", revision: "b", bundlePath: bundlePath, sourceIdentities: identities, files: [.init(path: "../escape", bytes: 0, sha256: PackStore.digest(Data()))])
        let data = try JSONEncoder().encode(manifest)
        try data.write(to: a.0.appendingPathComponent("manifest.json"))
        XCTAssertThrowsError(try store.install(from: a.0, expectedManifestDigest: PackStore.digest(data)))
        XCTAssertNil(try store.activeRevision(packID: "nyc-2014"))
    }
    func testSymlinkAncestorCannotCreateOutsideDirectory() throws {
        let root = URL(fileURLWithPath: "/private/tmp").appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let outside = root.appendingPathComponent("outside")
        try FileManager.default.createDirectory(at: outside, withIntermediateDirectories: true)
        let link = root.appendingPathComponent("link")
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: outside)
        XCTAssertThrowsError(try PackStore(root: link.appendingPathComponent("must-not-create")))
        XCTAssertFalse(FileManager.default.fileExists(atPath: outside.appendingPathComponent("must-not-create").path))
    }

    func testReaderCompatibilityGatePreservesActiveRevision() throws {
        let root = URL(fileURLWithPath: "/private/tmp").appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let storeRoot = root.appendingPathComponent("store")
        let store = try PackStore(root: storeRoot, supportedReaderCompatibility: "prototype-v1")
        let first = try fixture(root, revision: "first")
        try store.install(from: first.0, expectedManifestDigest: first.1)

        for mutation in ["missing", "unsupported", "schema", "schema1"] {
            let candidate = try fixture(root, revision: mutation)
            let url = candidate.0.appendingPathComponent("manifest.json")
            var json = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
            if mutation == "missing" { json.removeValue(forKey: "readerCompatibility") }
            if mutation == "unsupported" { json["readerCompatibility"] = "prototype-v2" }
            if mutation == "schema1" { json["schemaVersion"] = 1 }
            if mutation == "schema" { json["schemaVersion"] = 999 }
            let bytes = try JSONSerialization.data(withJSONObject: json)
            try bytes.write(to: url)
            var copied = false
            XCTAssertThrowsError(try store.install(from: candidate.0, expectedManifestDigest: PackStore.digest(bytes), checkpoint: { _ in copied = true }))
            XCTAssertFalse(copied, "Compatibility/schema rejection occurs before copying")
            XCTAssertEqual(try store.activeRevision(packID: "nyc-2014"), "first")
        }

        let compatible = try fixture(root, revision: "compatible")
        try store.install(from: compatible.0, expectedManifestDigest: compatible.1)
        XCTAssertEqual(try store.activeRevision(packID: "nyc-2014"), "compatible")

        // Install another reader's pack using its own compatible store instance,
        // then restore this reader's active pointer before attempting rollback.
        let other = try fixture(root, revision: "other-reader")
        let url = other.0.appendingPathComponent("manifest.json")
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
        json["readerCompatibility"] = "prototype-v2"
        let bytes = try JSONSerialization.data(withJSONObject: json)
        try bytes.write(to: url)
        let digest = PackStore.digest(bytes)
        let otherStore = try PackStore(root: storeRoot, supportedReaderCompatibility: "prototype-v2")
        try otherStore.install(from: other.0, expectedManifestDigest: digest)
        try store.activate(packID: "nyc-2014", revision: "compatible", expectedManifestDigest: compatible.1)
        XCTAssertThrowsError(try store.activate(packID: "nyc-2014", revision: "other-reader", expectedManifestDigest: digest))
        XCTAssertEqual(try store.activeRevision(packID: "nyc-2014"), "compatible")
    }

    func testVerifiedReopenWithoutSourceRejectsCorruption() throws {
        let root = URL(fileURLWithPath: "/private/tmp").appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let storeRoot = root.appendingPathComponent("store")
        let source = try fixture(root, revision: "offline")
        try PackStore(root: storeRoot).install(from: source.0, expectedManifestDigest: source.1)
        try FileManager.default.removeItem(at: source.0)
        let reopened = try PackStore(root: storeRoot)
        XCTAssertEqual(try reopened.verifiedActiveManifest(packID: "nyc-2014")?.revision, "offline")
        let payload = storeRoot.appendingPathComponent("nyc-2014/revisions/offline/prepared/chapter.json")
        try Data("corrupt".utf8).write(to: payload)
        XCTAssertThrowsError(try reopened.verifiedActiveManifest(packID: "nyc-2014"))
        XCTAssertEqual(try reopened.activeRevision(packID: "nyc-2014"), "offline")
    }

    func testSourceBindingRejectsBeforeCopyAndPreservesActive() throws {
        let root = URL(fileURLWithPath: "/private/tmp").appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = try PackStore(root: root.appendingPathComponent("store"))
        let first = try fixture(root, revision: "first")
        try store.install(from: first.0, expectedManifestDigest: first.1)
        for mutation in ["canonical", "jurisdiction", "code", "category", "missing", "extra", "duplicate", "path", "missingMetadata", "duplicateCode", "duplicateJurisdiction", "duplicateCategory", "unknownCode", "unknownJurisdiction"] {
            let candidate = try fixture(root, revision: mutation)
            let manifestURL = candidate.0.appendingPathComponent("manifest.json")
            var json = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: manifestURL)) as? [String: Any])
            var sources = try XCTUnwrap(json["sourceIdentities"] as? [[String: Any]])
            switch mutation {
            case "canonical": sources[0]["canonicalEdition"] = "display-name#1"
            case "jurisdiction": sources[0]["jurisdictionID"] = 9
            case "code": sources[0]["codeID"] = 9; sources[0]["canonicalEdition"] = bundlePath + "#9"
            case "category": sources[0]["categoryID"] = 9
            case "missing": sources.removeLast()
            case "extra": var extra = sources[0]; extra["categoryID"] = 9; sources.append(extra)
            case "duplicate": sources.append(sources[0])
            case "path": json["bundlePath"] = "CodeContent/authored/new-york-city/other-pack/bundle.json"
            default:
                let bundleURL = candidate.0.appendingPathComponent("bundle.json")
                var bundle = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: bundleURL)) as? [String: Any])
                if mutation == "missingMetadata" { bundle.removeValue(forKey: "codeSections") }
                else {
                    let key = mutation == "duplicateJurisdiction" ? "jurisdictions" : (mutation == "duplicateCode" || mutation == "unknownJurisdiction" ? "codes" : "codeSections")
                    var rows = try XCTUnwrap(bundle[key] as? [[String: Any]])
                    if mutation.hasPrefix("duplicate") { rows.append(rows[0]) }
                    else { rows[0][mutation == "unknownCode" ? "codeID" : "jurisdictionID"] = 99 }
                    bundle[key] = rows
                }
                let bytes = try JSONSerialization.data(withJSONObject: bundle)
                try bytes.write(to: bundleURL)
                // Recompute trusted file integrity so rejection proves semantic binding.
                var files = try XCTUnwrap(json["files"] as? [[String: Any]])
                let index = try XCTUnwrap(files.firstIndex { $0["path"] as? String == "bundle.json" })
                files[index]["bytes"] = bytes.count; files[index]["sha256"] = PackStore.digest(bytes)
                json["files"] = files
            }
            json["sourceIdentities"] = sources
            let bytes = try JSONSerialization.data(withJSONObject: json)
            try bytes.write(to: manifestURL)
            var reachedCopy = false
            XCTAssertThrowsError(try store.install(from: candidate.0, expectedManifestDigest: PackStore.digest(bytes), checkpoint: { _ in reachedCopy = true }), mutation)
            XCTAssertFalse(reachedCopy, mutation)
            XCTAssertEqual(try store.verifiedActiveManifest(packID: "nyc-2014")?.revision, "first", mutation)
        }
    }

}
