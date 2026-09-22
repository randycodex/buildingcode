import Foundation
import CryptoKit

/// Immutable, generated search text. The UTF-8 payload stays file-backed; only
/// the candidate being checked becomes a String. Invalid packs use the reader's
/// existing text resolver rather than changing search coverage.
final class SearchTextStore: @unchecked Sendable {
    struct Manifest: Decodable {
        let schemaVersion: Int
        let sourceRevision: String
        let textSHA256: String
        let indexSHA256: String
        let sectionCount: Int
        let textByteCount: Int
    }
    private struct Index: Decodable {
        let schemaVersion: Int
        let sections: [String: [Int]]
    }
    private struct Pack {
        let manifest: Manifest
        let data: Data
        let offsets: [String: [Int]]
    }
    private let root: URL
    private let lock = NSLock()
    private var didLoad = false
    private var pack: Pack?

    init(preparedURL: URL) { root = preparedURL }

    private func loadedPack() -> Pack? {
        lock.lock()
        defer { lock.unlock() }
        if didLoad { return pack }
        didLoad = true
        guard let manifestData = try? Data(contentsOf: root.appendingPathComponent("searchTextManifest.json")),
              let manifest = try? JSONDecoder().decode(Manifest.self, from: manifestData),
              manifest.schemaVersion == 1,
              manifest.sectionCount >= 0, manifest.textByteCount >= 0,
              let indexData = try? Data(contentsOf: root.appendingPathComponent("searchTextIndex.json")),
              Self.digest(indexData) == manifest.indexSHA256,
              let index = try? JSONDecoder().decode(Index.self, from: indexData), index.schemaVersion == 1,
              index.sections.count == manifest.sectionCount,
              let data = try? Data(contentsOf: root.appendingPathComponent("searchText.utf8"), options: .mappedIfSafe),
              data.count == manifest.textByteCount, Self.digest(data) == manifest.textSHA256,
              index.sections.allSatisfy({ key, span in
                  Int64(key) != nil && span.count == 2 && span[0] >= 0 && span[1] >= 0 &&
                  span[0] <= data.count && span[1] <= data.count - span[0]
              }) else { return nil }
        let loaded = Pack(manifest: manifest, data: data, offsets: index.sections)
        pack = loaded
        return loaded
    }

    var revision: String? {
        guard let manifest = loadedPack()?.manifest else { return nil }
        return "\(manifest.sourceRevision):\(manifest.indexSHA256):\(manifest.textSHA256)"
    }

    func text(sectionID: Int64) -> String? {
        guard let pack = loadedPack(), let span = pack.offsets[String(sectionID)] else { return nil }
        return String(data: pack.data[span[0]..<(span[0] + span[1])], encoding: .utf8)
    }

    private static func digest(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}
