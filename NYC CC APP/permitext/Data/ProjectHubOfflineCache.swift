import CryptoKit
import Foundation

struct ProjectHubOfflineCacheLoad<Value: Codable & Sendable>: Sendable {
    let value: Value
    let cachedAt: String
}

struct ProjectHubOfflineCache: Sendable {
    private struct Envelope<Value: Codable & Sendable>: Codable, Sendable {
        let schemaVersion: Int
        let cachedAt: String
        let value: Value
    }

    private let directoryURL: URL

    init(directoryURL: URL? = nil) {
        if let directoryURL {
            self.directoryURL = directoryURL
        } else {
            let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
                ?? FileManager.default.temporaryDirectory
            self.directoryURL = base
                .appendingPathComponent("Permitext", isDirectory: true)
                .appendingPathComponent("ProjectHubCache", isDirectory: true)
        }
    }

    func store<Value: Codable & Sendable>(
        _ value: Value,
        accountID: String,
        projectID: String,
        scope: String
    ) throws {
        try FileManager.default.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true
        )
        var directoryValues = URLResourceValues()
        directoryValues.isExcludedFromBackup = true
        var mutableDirectoryURL = directoryURL
        try? mutableDirectoryURL.setResourceValues(directoryValues)

        let cachedAt = ISO8601DateFormatter().string(from: Date())
        let envelope = Envelope(schemaVersion: 1, cachedAt: cachedAt, value: value)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(envelope)
        let url = cacheURL(accountID: accountID, projectID: projectID, scope: scope)
        try data.write(to: url, options: .atomic)
        try? FileManager.default.setAttributes(
            [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
            ofItemAtPath: url.path
        )
    }

    func load<Value: Codable & Sendable>(
        _ type: Value.Type,
        accountID: String,
        projectID: String,
        scope: String
    ) throws -> ProjectHubOfflineCacheLoad<Value>? {
        let url = cacheURL(accountID: accountID, projectID: projectID, scope: scope)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let envelope = try JSONDecoder().decode(Envelope<Value>.self, from: Data(contentsOf: url))
        guard envelope.schemaVersion == 1 else { return nil }
        return ProjectHubOfflineCacheLoad(value: envelope.value, cachedAt: envelope.cachedAt)
    }

    func remove(accountID: String, projectID: String, scope: String) throws {
        let url = cacheURL(accountID: accountID, projectID: projectID, scope: scope)
        guard FileManager.default.fileExists(atPath: url.path) else { return }
        try FileManager.default.removeItem(at: url)
    }

    private func cacheURL(accountID: String, projectID: String, scope: String) -> URL {
        let identity = [accountID, projectID, scope].joined(separator: "\u{1f}")
        let digest = SHA256.hash(data: Data(identity.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
        return directoryURL.appendingPathComponent("\(digest).json", isDirectory: false)
    }
}
