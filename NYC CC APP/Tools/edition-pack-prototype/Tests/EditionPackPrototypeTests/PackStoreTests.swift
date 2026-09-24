import XCTest
@testable import EditionPackPrototype
final class PackStoreTests: XCTestCase {
    func fixture(_ root: URL, revision: String) throws -> (URL, String) {
        let dir = root.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir.appendingPathComponent("prepared"), withIntermediateDirectories: true)
        let data = Data("content-\(revision)".utf8)
        try data.write(to: dir.appendingPathComponent("prepared/chapter.json"))
        try data.write(to: dir.appendingPathComponent("prepared/second.json"))
        let manifest = PackManifest(packID: "nyc-2014", revision: revision, sourceIdentities: ["canonical:nyc-2014"], files: [.init(path: "prepared/chapter.json", bytes: data.count, sha256: PackStore.digest(data)), .init(path: "prepared/second.json", bytes: data.count, sha256: PackStore.digest(data))])
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
        for stopAfter in 1...3 {
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
        let manifest = PackManifest(packID: "nyc-2014", revision: "b", sourceIdentities: ["canonical:nyc-2014"], files: [.init(path: "../escape", bytes: 0, sha256: PackStore.digest(Data()))])
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

}
