import Foundation
import CryptoKit

/// Disposable public search-card metadata. Never stores reader bodies or account content.
/// Callers must only submit fully completed, failure-free searches and validate IDs on read.
actor CompletedSearchCache {
    static let shared = CompletedSearchCache()

    struct Key: Codable, Hashable, Sendable {
        let query: String
        /// Ordered scope includes edition, code, jurisdiction and filter identities.
        let scope: [String]
        let corpusRevision: String
        let engineRevision: String
    }

    struct Snapshot: Sendable {
        let results: [CodeSearchResult]
        let filters: [CodeSectionCategory]
    }

    private struct ResultRecord: Codable {
        let id: Int64
        let codeSectionID: Int64?
        let chapterNumber: String
        let sectionNumber: String
        let title: String
        let kind: CodeSectionKind
        let sourceVersion: String?
        let sourceEdition: String?
        let sourceCodeName: String?
        let searchFilterID: Int64?

        init(_ value: CodeSearchResult) {
            id = value.id; codeSectionID = value.codeSectionID
            chapterNumber = value.chapterNumber; sectionNumber = value.sectionNumber
            title = value.title; kind = value.kind; sourceVersion = value.sourceVersion
            sourceEdition = value.sourceEdition; sourceCodeName = value.sourceCodeName
            searchFilterID = value.searchFilterID
        }

        var result: CodeSearchResult {
            var value = CodeSearchResult(id: id, codeSectionID: codeSectionID,
                chapterNumber: chapterNumber, sectionNumber: sectionNumber,
                title: title, snippet: "", kind: kind)
            value.sourceVersion = sourceVersion; value.sourceEdition = sourceEdition
            value.sourceCodeName = sourceCodeName; value.searchFilterID = searchFilterID
            return value
        }
    }

    private struct FilterRecord: Codable {
        let id: Int64
        let codeID: Int64
        let name: String
    }

    private struct Envelope: Codable {
        let schema: Int
        let key: Key
        let results: [ResultRecord]
        let filters: [FilterRecord]
    }

    private let directory: URL
    private let maximumEntries: Int
    private let maximumBytes: Int
    private let fileManager = FileManager.default
    private let encoder: JSONEncoder = {
        let value = JSONEncoder()
        value.outputFormatting = [.sortedKeys]
        return value
    }()

    init(directory: URL? = nil, maximumEntries: Int = 32, maximumBytes: Int = 12 * 1_024 * 1_024) {
        self.directory = directory ?? FileManager.default.urls(for: .cachesDirectory,
            in: .userDomainMask)[0].appendingPathComponent("PermitextCompletedSearch-v1", isDirectory: true)
        self.maximumEntries = max(0, maximumEntries)
        self.maximumBytes = max(0, maximumBytes)
    }

    func value(for key: Key) -> Snapshot? {
        guard !Task.isCancelled, maximumEntries > 0, maximumBytes > 0,
              let url = fileURL(for: key) else { return nil }
        do {
            let attributes = try fileManager.attributesOfItem(atPath: url.path)
            guard let size = attributes[.size] as? NSNumber,
                  size.intValue <= maximumBytes else {
                try? fileManager.removeItem(at: url)
                return nil
            }
            let data = try Data(contentsOf: url)
            guard !Task.isCancelled, data.count <= maximumBytes else { return nil }
            let entry = try JSONDecoder().decode(Envelope.self, from: data)
            guard entry.schema == 1, entry.key == key else {
                try? fileManager.removeItem(at: url)
                return nil
            }
            try? fileManager.setAttributes([.modificationDate: Date()], ofItemAtPath: url.path)
            return Snapshot(results: entry.results.map(\.result), filters: entry.filters.map {
                CodeSectionCategory(id: $0.id, codeID: $0.codeID, name: $0.name)
            })
        } catch {
            // Corruption and storage failures are ordinary misses, never search failures.
            try? fileManager.removeItem(at: url)
            return nil
        }
    }

    func store(results: [CodeSearchResult], filters: [CodeSectionCategory], for key: Key) {
        guard !Task.isCancelled, maximumEntries > 0, maximumBytes > 0,
              let url = fileURL(for: key) else { return }
        let entry = Envelope(schema: 1, key: key, results: results.map(ResultRecord.init),
            filters: filters.map { FilterRecord(id: $0.id, codeID: $0.codeID, name: $0.name) })
        guard let data = try? encoder.encode(entry), data.count <= maximumBytes,
              !Task.isCancelled else { return }
        do {
            try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
            guard !Task.isCancelled else { return }
            try data.write(to: url, options: .atomic)
            enforceLimits()
        } catch {
            // Search remains usable when the cache is unavailable or storage is full.
        }
    }

    func removeValue(for key: Key) {
        guard let url = fileURL(for: key) else { return }
        try? fileManager.removeItem(at: url)
    }

    private func fileURL(for key: Key) -> URL? {
        guard let bytes = try? encoder.encode(key) else { return nil }
        let digest = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
        return directory.appendingPathComponent(digest).appendingPathExtension("json")
    }

    private func enforceLimits() {
        guard let urls = try? fileManager.contentsOfDirectory(at: directory,
            includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey],
            options: [.skipsHiddenFiles]) else { return }
        var entries: [(url: URL, size: Int, accessed: Date)] = urls.compactMap { url in
            guard url.pathExtension == "json",
                  let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
                else { return nil }
            return (url, values.fileSize ?? 0, values.contentModificationDate ?? .distantPast)
        }
        entries.sort { $0.accessed < $1.accessed }
        var count = entries.count
        var bytes = entries.reduce(0) { $0 + $1.size }
        for entry in entries {
            guard count > maximumEntries || bytes > maximumBytes else { break }
            do {
                try fileManager.removeItem(at: entry.url)
                count -= 1; bytes -= entry.size
            } catch { continue }
        }
    }
}
