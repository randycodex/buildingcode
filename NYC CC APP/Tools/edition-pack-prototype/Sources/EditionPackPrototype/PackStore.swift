import Foundation
import CryptoKit

public struct PackManifest: Codable, Sendable {
    public struct File: Codable, Sendable {
        public let path: String
        public let bytes: Int
        public let sha256: String
        public init(path: String, bytes: Int, sha256: String) { self.path = path; self.bytes = bytes; self.sha256 = sha256 }
    }
    public let readerCompatibility: String
    public let schemaVersion: Int
    public let packID: String
    public let revision: String
    /// Same JSON representation as the app's ActiveCodeSourceIdentity.
    public struct SourceIdentity: Codable, Hashable, Sendable {
        public let canonicalEdition: String
        public let jurisdictionID: Int64
        public let codeID: Int64
        public let categoryID: Int64
        public init(canonicalEdition: String, jurisdictionID: Int64, codeID: Int64, categoryID: Int64) {
            self.canonicalEdition = canonicalEdition; self.jurisdictionID = jurisdictionID
            self.codeID = codeID; self.categoryID = categoryID
        }
    }
    public let bundlePath: String
    public let sourceIdentities: [SourceIdentity]
    public let files: [File]
    public init(packID: String, revision: String, bundlePath: String, sourceIdentities: [SourceIdentity], files: [File], readerCompatibility: String = "prototype-v1") {
        self.readerCompatibility = readerCompatibility
        schemaVersion = 2; self.bundlePath = bundlePath; self.packID = packID; self.revision = revision; self.sourceIdentities = sourceIdentities; self.files = files
    }
}

public enum PackFailure: Error { case incompatibleReader, invalidManifest, unsafePath, unexpectedFiles, corruptFile, insufficientStorage, missingRevision }
public enum InstallCheckpoint: Sendable { case beforeCopy, afterFile, beforeActivation }

/// Host-only local-directory transport. Caller must supply a digest from a trusted channel.
/// Store is single-writer; its root must be privately owned, not concurrently mutated.
public final class PackStore {
    public static func digest(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    private let root: URL
    private let supportedReaderCompatibility: String
    private let fm = FileManager.default
    public init(root: URL, supportedReaderCompatibility: String = "prototype-v1") throws {
        guard !supportedReaderCompatibility.isEmpty else { throw PackFailure.incompatibleReader }
        self.supportedReaderCompatibility = supportedReaderCompatibility
        self.root = root
        try Self.rejectSymlinks(self.root)
        try FileManager.default.createDirectory(at: self.root, withIntermediateDirectories: true)
        try Self.rejectSymlinks(self.root)
    }
    private static func rejectSymlinks(_ url: URL) throws {
        var cursor = url
        while cursor.path != "/" {
            if (try? cursor.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink) == true { throw PackFailure.unsafePath }
            cursor.deleteLastPathComponent()
        }
    }
    private func component(_ value: String) throws {
        guard !value.isEmpty, value.utf8.count <= 128, value.range(of: "^[A-Za-z0-9][A-Za-z0-9._-]*$", options: .regularExpression) != nil, value != ".", value != ".." else { throw PackFailure.unsafePath }
    }
    private func relative(_ path: String) throws {
        guard !path.isEmpty, !path.hasPrefix("/"), !path.contains("\\"), !path.contains("\0"), path != "manifest.json", path.split(separator: "/", omittingEmptySubsequences: false).allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." }) else { throw PackFailure.unsafePath }
    }
    private func validate(_ source: URL, digest: String) throws -> PackManifest {
        try Self.rejectSymlinks(source)
        let manifestURL = source.appendingPathComponent("manifest.json")
        try Self.rejectSymlinks(manifestURL)
        let bytes = try Data(contentsOf: manifestURL)
        guard Self.digest(bytes) == digest else { throw PackFailure.corruptFile }
        let manifest = try JSONDecoder().decode(PackManifest.self, from: bytes)
        guard manifest.readerCompatibility == supportedReaderCompatibility else { throw PackFailure.incompatibleReader }
        try component(manifest.packID); try component(manifest.revision)
        guard manifest.schemaVersion == 2, !manifest.sourceIdentities.isEmpty,
              Set(manifest.sourceIdentities).count == manifest.sourceIdentities.count,
              manifest.sourceIdentities.allSatisfy({ $0.canonicalEdition == "\(manifest.bundlePath)#\($0.codeID)" }),
              !manifest.files.isEmpty, Set(manifest.files.map(\.path)).count == manifest.files.count else { throw PackFailure.invalidManifest }
        try relative(manifest.bundlePath)
        let bundleComponents = manifest.bundlePath.split(separator: "/").map(String.init)
        guard bundleComponents.count == 5,
              Array(bundleComponents.prefix(2)) == ["CodeContent", "authored"],
              bundleComponents[3] == manifest.packID, bundleComponents[4] == "bundle.json",
              manifest.files.contains(where: { $0.path == "bundle.json" }) else { throw PackFailure.invalidManifest }
        try component(bundleComponents[2])
        for file in manifest.files {
            try relative(file.path)
            guard file.bytes >= 0, file.sha256.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil else { throw PackFailure.invalidManifest }
        }
        var actual = Set<String>()
        guard let enumeration = fm.enumerator(at: source, includingPropertiesForKeys: [.isRegularFileKey, .isDirectoryKey, .isSymbolicLinkKey]) else { throw PackFailure.unexpectedFiles }
        for case let url as URL in enumeration {
            let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isDirectoryKey, .isSymbolicLinkKey])
            guard values.isSymbolicLink != true else { throw PackFailure.unsafePath }
            if values.isRegularFile == true { actual.insert(String(url.path.dropFirst(source.path.count + 1))) }
            else if values.isDirectory != true { throw PackFailure.unsafePath }
        }
        guard actual == Set(manifest.files.map(\.path) + ["manifest.json"]) else { throw PackFailure.unexpectedFiles }
        for file in manifest.files {
            let data = try Data(contentsOf: source.appendingPathComponent(file.path))
            guard data.count == file.bytes, Self.digest(data) == file.sha256 else { throw PackFailure.corruptFile }
        }
        try validateSourceIdentities(manifest, source: source)
        return manifest
    }
    private struct BundleMetadata: Decodable {
        struct Jurisdiction: Decodable { let id: Int64 }
        struct Code: Decodable { let id: Int64; let jurisdictionID: Int64 }
        struct Category: Decodable { let id: Int64; let codeID: Int64 }
        let jurisdictions: [Jurisdiction]
        let codes: [Code]
        let codeSections: [Category]
    }
    /// Integrity is checked first; source identity must then describe the payload exactly.
    private func validateSourceIdentities(_ manifest: PackManifest, source: URL) throws {
        let metadata: BundleMetadata
        do { metadata = try JSONDecoder().decode(BundleMetadata.self, from: Data(contentsOf: source.appendingPathComponent("bundle.json"))) }
        catch { throw PackFailure.invalidManifest }
        let jurisdictions = Set(metadata.jurisdictions.map(\.id))
        let codeIDs = Set(metadata.codes.map(\.id))
        guard !jurisdictions.isEmpty, !codeIDs.isEmpty, !metadata.codeSections.isEmpty,
              jurisdictions.count == metadata.jurisdictions.count,
              codeIDs.count == metadata.codes.count,
              Set(metadata.codes.map(\.jurisdictionID)).isSubset(of: jurisdictions),
              Set(metadata.codeSections.map(\.codeID)).isSubset(of: codeIDs) else { throw PackFailure.invalidManifest }
        let codes = Dictionary(uniqueKeysWithValues: metadata.codes.map { ($0.id, $0.jurisdictionID) })
        let identities = try metadata.codeSections.map { category -> PackManifest.SourceIdentity in
            guard let jurisdiction = codes[category.codeID] else { throw PackFailure.invalidManifest }
            return .init(canonicalEdition: "\(manifest.bundlePath)#\(category.codeID)", jurisdictionID: jurisdiction, codeID: category.codeID, categoryID: category.id)
        }
        guard Set(identities).count == identities.count, Set(identities) == Set(manifest.sourceIdentities) else { throw PackFailure.invalidManifest }
    }
    /// Failure injection is synchronous and can throw at every publication boundary.
    @discardableResult public func install(from source: URL, expectedManifestDigest: String, availableBytes: () throws -> Int64 = { Int64.max }, checkpoint: (InstallCheckpoint) throws -> Void = { _ in }) throws -> PackManifest {
        let manifest = try validate(source, digest: expectedManifestDigest)
        let byteCount = try manifest.files.reduce(Int64(try Data(contentsOf: source.appendingPathComponent("manifest.json")).count)) { total, file in
            let (sum, overflow) = total.addingReportingOverflow(Int64(file.bytes)); if overflow { throw PackFailure.invalidManifest }; return sum
        }
        guard try availableBytes() >= byteCount else { throw PackFailure.insufficientStorage }
        let pack = root.appendingPathComponent(manifest.packID)
        try Self.rejectSymlinks(pack)
        let revisions = pack.appendingPathComponent("revisions")
        try fm.createDirectory(at: revisions, withIntermediateDirectories: true)
        try Self.rejectSymlinks(revisions)
        let stage = pack.appendingPathComponent("stage-" + UUID().uuidString)
        try fm.createDirectory(at: stage, withIntermediateDirectories: false)
        defer { try? fm.removeItem(at: stage) }
        try checkpoint(.beforeCopy)
        for path in ["manifest.json"] + manifest.files.map(\.path) {
            let destination = stage.appendingPathComponent(path)
            try fm.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
            try Self.rejectSymlinks(source.appendingPathComponent(path))
            try fm.copyItem(at: source.appendingPathComponent(path), to: destination)
            try checkpoint(.afterFile)
        }
        _ = try validate(stage, digest: expectedManifestDigest)
        let destination = revisions.appendingPathComponent(manifest.revision)
        if fm.fileExists(atPath: destination.path) { _ = try validate(destination, digest: expectedManifestDigest) }
        else { try fm.moveItem(at: stage, to: destination) }
        try checkpoint(.beforeActivation)
        try activate(packID: manifest.packID, revision: manifest.revision, expectedManifestDigest: expectedManifestDigest)
        return manifest
    }
    public func activate(packID: String, revision: String, expectedManifestDigest: String) throws {
        try component(packID); try component(revision)
        let pack = root.appendingPathComponent(packID)
        let directory = pack.appendingPathComponent("revisions").appendingPathComponent(revision)
        let manifest = try validate(directory, digest: expectedManifestDigest)
        guard manifest.packID == packID, manifest.revision == revision else { throw PackFailure.invalidManifest }
        let pointer = pack.appendingPathComponent("active.json")
        try Self.rejectSymlinks(pointer)
        let data = try JSONEncoder().encode(Active(revision: revision, digest: expectedManifestDigest))
        try data.write(to: pointer, options: .atomic)
    }
    /// Reopen validates the complete selected revision using only installed files.
    public func verifiedActiveManifest(packID: String) throws -> PackManifest? {
        try component(packID)
        let pack = root.appendingPathComponent(packID)
        let pointer = pack.appendingPathComponent("active.json")
        try Self.rejectSymlinks(pointer)
        guard fm.fileExists(atPath: pointer.path) else { return nil }
        let active = try JSONDecoder().decode(Active.self, from: Data(contentsOf: pointer))
        try component(active.revision)
        let manifest = try validate(pack.appendingPathComponent("revisions").appendingPathComponent(active.revision), digest: active.digest)
        guard manifest.packID == packID, manifest.revision == active.revision else { throw PackFailure.invalidManifest }
        return manifest
    }
    private struct Active: Codable { let revision: String; let digest: String }
    /// Pointer accessor only; does not assert that revision files remain available or uncorrupted.
    /// Use activate with an independently trusted digest to revalidate a revision.
    public func activeRevision(packID: String) throws -> String? {
        try component(packID)
        let pointer = root.appendingPathComponent(packID).appendingPathComponent("active.json")
        try Self.rejectSymlinks(pointer)
        guard fm.fileExists(atPath: pointer.path) else { return nil }
        let active = try JSONDecoder().decode(Active.self, from: Data(contentsOf: pointer))
        try component(active.revision)
        return active.revision
    }
}
