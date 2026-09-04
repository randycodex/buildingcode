import CryptoKit
import Foundation

struct ProjectHubOfflineCacheLoad<Value: Codable & Sendable>: Sendable {
    let value: Value
    let cachedAt: String
}

enum ProjectHubOfflineCacheError: LocalizedError {
    case accountDeleted
    var errorDescription: String? { "This account was deleted. Its private data cannot be restored on this device." }
}

struct ProjectHubOfflineCache: Sendable {
    private static let accessLock = NSRecursiveLock()
    private struct Envelope<Value: Codable & Sendable>: Codable, Sendable {
        let schemaVersion: Int
        let cachedAt: String
        let value: Value
        var scope: String? = nil
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
        Self.accessLock.lock()
        defer { Self.accessLock.unlock() }
        guard !isDeleted(accountID) else { throw ProjectHubOfflineCacheError.accountDeleted }
        try FileManager.default.createDirectory(
            at: projectDirectoryURL(accountID: accountID, projectID: projectID),
            withIntermediateDirectories: true
        )
        var directoryValues = URLResourceValues()
        directoryValues.isExcludedFromBackup = true
        var mutableDirectoryURL = directoryURL
        try? mutableDirectoryURL.setResourceValues(directoryValues)

        let cachedAt = ISO8601DateFormatter().string(from: Date())
        let envelope = Envelope(schemaVersion: 2, cachedAt: cachedAt, value: value, scope: scope)
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
        Self.accessLock.lock()
        defer { Self.accessLock.unlock() }
        guard !isDeleted(accountID) else { return nil }
        try migrateLegacyEntry(accountID: accountID, projectID: projectID, scope: scope)
        let url = cacheURL(accountID: accountID, projectID: projectID, scope: scope)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let envelope = try JSONDecoder().decode(Envelope<Value>.self, from: Data(contentsOf: url))
        guard [1, 2].contains(envelope.schemaVersion) else { return nil }
        return ProjectHubOfflineCacheLoad(value: envelope.value, cachedAt: envelope.cachedAt)
    }

    func entries<Value: Codable & Sendable>(
        _ type: Value.Type, accountID: String, projectID: String, scopePrefix: String
    ) throws -> [(scope: String, value: Value)] {
        Self.accessLock.lock()
        defer { Self.accessLock.unlock() }
        guard !isDeleted(accountID) else { return [] }
        let directory = projectDirectoryURL(accountID: accountID, projectID: projectID)
        guard FileManager.default.fileExists(atPath: directory.path) else { return [] }
        return try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil).compactMap { url in
            guard let envelope = try? JSONDecoder().decode(Envelope<Value>.self, from: Data(contentsOf: url)),
                  let scope = envelope.scope, scope.hasPrefix(scopePrefix) else { return nil }
            return (scope, envelope.value)
        }
    }

    func remove(accountID: String, projectID: String, scope: String) throws {
        Self.accessLock.lock()
        defer { Self.accessLock.unlock() }
        for url in [cacheURL(accountID: accountID, projectID: projectID, scope: scope),
                    legacyCacheURL(accountID: accountID, projectID: projectID, scope: scope)] {
            if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
        }
    }

    /// Cached server data may be invalidated without destroying local Notebook drafts.
    func removeProject(accountID: String, projectID: String, preservingDrafts: Bool = true) throws {
        Self.accessLock.lock()
        defer { Self.accessLock.unlock() }
        try migrateKnownLegacyEntries(accountID: accountID, projectIDs: [projectID])
        let directory = projectDirectoryURL(accountID: accountID, projectID: projectID)
        guard FileManager.default.fileExists(atPath: directory.path) else { return }
        if !preservingDrafts {
            try FileManager.default.removeItem(at: directory)
            return
        }
        for url in try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) {
            guard !url.lastPathComponent.hasPrefix("draft-") else { continue }
            try FileManager.default.removeItem(at: url)
        }
    }

    func removeAccount(accountID: String, knownProjectIDs: [String] = []) throws {
        Self.accessLock.lock()
        defer { Self.accessLock.unlock() }
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        try Data("deleted".utf8).write(to: deletionMarkerURL(accountID: accountID), options: .atomic)
        try migrateKnownLegacyEntries(accountID: accountID, projectIDs: knownProjectIDs)
        let directory = accountDirectoryURL(accountID: accountID)
        if FileManager.default.fileExists(atPath: directory.path) { try FileManager.default.removeItem(at: directory) }
    }

    var retainedLegacyDataNotice: String? {
        Self.accessLock.lock()
        defer { Self.accessLock.unlock() }
        let files = try? FileManager.default.contentsOfDirectory(at: directoryURL, includingPropertiesForKeys: nil)
        guard files?.contains(where: { $0.pathExtension == "json" }) == true else { return nil }
        return "Account-scoped data was cleared. Older local cache files without verifiable account ownership were retained to protect other accounts’ drafts."
    }

    /// Old filenames encode ownership but old payloads do not. Derive candidate keys,
    /// then verify the full account/project/scope hash before moving anything.
    /// New unsaved legacy drafts omitted their route UUID; those cannot be attributed.
    func migrateKnownLegacyEntries(accountID: String, projectIDs: [String]) throws {
        Self.accessLock.lock()
        defer { Self.accessLock.unlock() }
        guard FileManager.default.fileExists(atPath: directoryURL.path) else { return }
        let files = try FileManager.default.contentsOfDirectory(at: directoryURL, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "json" }
        var ids = Set(projectIDs)
        var projects = Set(projectIDs)
        func collectIDs(_ value: Any, key: String? = nil) {
            if let object = value as? [String: Any] {
                if let id = object["id"] as? String,
                   object["title"] != nil || object["messages"] != nil || object["sourceRecordID"] != nil { ids.insert(id) }
                if let id = object["cardID"] as? String { ids.insert(id) }
                for field in ["projectID", "primaryProjectID"] {
                    if let id = object[field] as? String { projects.insert(id); ids.insert(id) }
                }
                if key == "projects", let id = object["id"] as? String { projects.insert(id) }
                for field in ["value", "cards", "notebookCards", "researchConversations", "projects", "project", "artifacts", "payload", "notebookCard"] {
                    if let child = object[field] { collectIDs(child, key: field) }
                }
            } else if let values = value as? [Any] { values.forEach { collectIDs($0, key: key) } }
        }
        for file in files {
            if let data = try? Data(contentsOf: file), let envelope = try? JSONSerialization.jsonObject(with: data) {
                collectIDs(envelope)
            }
        }
        try migrateLegacyEntry(accountID: accountID, projectID: "all-research", scope: "research-history")
        for id in ids {
            for scope in ["personal", "organization", "native-notebook-list", "research-conversation", ResearchQuestionAttempt.cacheScope] {
                try migrateLegacyEntry(accountID: accountID, projectID: id, scope: scope)
            }
            for projectID in projects {
                for scope in ["native-notebook-card:\(id)", "native-notebook-draft:\(id)"] {
                    try migrateLegacyEntry(accountID: accountID, projectID: projectID, scope: scope)
                }
            }
        }
    }

    private func migrateLegacyEntry(accountID: String, projectID: String, scope: String) throws {
        let oldURL = legacyCacheURL(accountID: accountID, projectID: projectID, scope: scope)
        guard FileManager.default.fileExists(atPath: oldURL.path) else { return }
        let newURL = cacheURL(accountID: accountID, projectID: projectID, scope: scope)
        try FileManager.default.createDirectory(at: newURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        if FileManager.default.fileExists(atPath: newURL.path) {
            // A current scoped write supersedes this same, ownership-verified key.
            try FileManager.default.removeItem(at: oldURL)
        } else {
            let data = try Data(contentsOf: oldURL)
            if var envelope = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                envelope["scope"] = scope
                envelope["schemaVersion"] = 2
                try JSONSerialization.data(withJSONObject: envelope, options: [.sortedKeys]).write(to: newURL, options: .atomic)
                try? FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: newURL.path)
                try FileManager.default.removeItem(at: oldURL)
            } else {
                try FileManager.default.moveItem(at: oldURL, to: newURL)
            }
        }
    }

    private func deletionMarkerURL(accountID: String) -> URL {
        directoryURL.appendingPathComponent("deleted-\(digest(accountID))", isDirectory: false)
    }

    private func isDeleted(_ accountID: String) -> Bool {
        FileManager.default.fileExists(atPath: deletionMarkerURL(accountID: accountID).path)
    }

    private func accountDirectoryURL(accountID: String) -> URL {
        directoryURL.appendingPathComponent("account-\(digest(accountID))", isDirectory: true)
    }

    private func projectDirectoryURL(accountID: String, projectID: String) -> URL {
        accountDirectoryURL(accountID: accountID).appendingPathComponent(digest(projectID), isDirectory: true)
    }

    private func cacheURL(accountID: String, projectID: String, scope: String) -> URL {
        let prefix = scope.hasPrefix("native-notebook-draft:") ? "draft-" : ""
        return projectDirectoryURL(accountID: accountID, projectID: projectID)
            .appendingPathComponent("\(prefix)\(digest(scope)).json", isDirectory: false)
    }

    private func legacyCacheURL(accountID: String, projectID: String, scope: String) -> URL {
        directoryURL.appendingPathComponent("\(digest([accountID, projectID, scope].joined(separator: "\u{1f}"))).json")
    }

    private func digest(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}


/// A new session invalidates even responses for the same account after sign-out/sign-in.
struct NativePrivateRequestIdentity: Equatable, Sendable {
    let accountID: String
    let sessionID: UUID
}

/// Selection generation also rejects A → B → A navigation while a request is suspended.
struct NativeResearchRequestIdentity: Equatable, Sendable {
    let account: NativePrivateRequestIdentity
    let conversationID: String?
    let selectionID: UUID
}

enum NativePrivateCachePolicy {
    static func permitsOfflineFallback(after error: Error) -> Bool {
        if let error = error as? PermitextBackendHTTPError {
            return (error.statusCode ?? 0) >= 500
        }
        guard let error = error as? URLError else { return false }
        return [.notConnectedToInternet, .networkConnectionLost, .timedOut,
                .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed,
                .internationalRoamingOff, .dataNotAllowed].contains(error.code)
    }

    static func requiresInvalidation(after error: Error) -> Bool {
        guard let error = error as? PermitextBackendHTTPError else { return false }
        return [401, 403, 404, 410].contains(error.statusCode ?? 0)
    }
}
