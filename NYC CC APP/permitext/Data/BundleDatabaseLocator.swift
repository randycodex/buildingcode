import Foundation
import SQLite3

final class BundleDatabaseLocator {
    private struct AuthoredBundleIndex: Decodable {
        struct Jurisdiction: Decodable {
            let id: Int64
            let name: String
        }

        struct Code: Decodable {
            let id: Int64
            let jurisdictionID: Int64?
            let name: String
        }

        let jurisdictions: [Jurisdiction]?
        let codes: [Code]?
    }

    private let hiddenLegacySQLiteFiles: Set<String> = [
        "nyc_code_2022.sqlite",
        "nyc_code_sample.sqlite"
    ]

    private let authoredScanExcludedDirectories: Set<String> = [
        "assets",
        "chapters",
        "prepared"
    ]

    func availableCodeVersions() -> [BundledCodeVersion] {
        if let cached = Self.loadCache() {
            return cached
        }

        let versions = scanAvailableCodeVersions()
        Self.persistCache(versions: versions)
        return versions
    }

    private func scanAvailableCodeVersions() -> [BundledCodeVersion] {
        var versions: [BundledCodeVersion] = []

        versions.append(contentsOf: discoverAuthoredVersions())

        let sqliteURLs = Bundle.main.urls(forResourcesWithExtension: "sqlite", subdirectory: nil) ?? []
        for sqliteURL in sqliteURLs {
            guard !hiddenLegacySQLiteFiles.contains(sqliteURL.lastPathComponent) else {
                continue
            }
            if let version = readVersion(from: sqliteURL) {
                versions.append(version)
            }
        }

        return versions.sorted { lhs, rhs in
            if lhs.contentKind != rhs.contentKind {
                return lhs.contentKind == .authored
            }
            return lhs.displayName.localizedStandardCompare(rhs.displayName) == .orderedAscending
        }
    }

    // MARK: - Cache

    private struct CachedScanEntry: Codable {
        let fileName: String
        let relativeFilePath: String
        let codeVersion: String
        let contentKindRaw: String
        let authoredCodeID: Int64?
        let jurisdictionID: Int64?
        let jurisdictionName: String?
        let authoredHTMLBundlePath: String?
    }

    private struct CachedScan: Codable {
        let appVersionKey: String
        let entries: [CachedScanEntry]
    }

    private static let cacheDefaultsKey = "BundleDatabaseLocator.cachedScan.v2"

    private static var appVersionKey: String {
        let info = Bundle.main.infoDictionary
        let short = (info?["CFBundleShortVersionString"] as? String) ?? ""
        let build = (info?["CFBundleVersion"] as? String) ?? ""
        return "\(short)-\(build)"
    }

    private static func loadCache() -> [BundledCodeVersion]? {
        guard let resourceURL = Bundle.main.resourceURL else { return nil }
        guard let data = UserDefaults.standard.data(forKey: cacheDefaultsKey) else { return nil }
        guard let scan = try? JSONDecoder().decode(CachedScan.self, from: data) else { return nil }
        guard scan.appVersionKey == appVersionKey else { return nil }

        var versions: [BundledCodeVersion] = []
        versions.reserveCapacity(scan.entries.count)
        for entry in scan.entries {
            let url = resourceURL.appendingPathComponent(entry.relativeFilePath)
            guard FileManager.default.fileExists(atPath: url.path) else { return nil }
            guard let kind = BundledCodeContentKind(rawValue: entry.contentKindRaw) else { return nil }
            versions.append(
                BundledCodeVersion(
                    fileName: entry.fileName,
                    fileURL: url,
                    codeVersion: entry.codeVersion,
                    contentKind: kind,
                    authoredCodeID: entry.authoredCodeID,
                    jurisdictionID: entry.jurisdictionID,
                    jurisdictionName: entry.jurisdictionName,
                    authoredHTMLBundlePath: entry.authoredHTMLBundlePath
                )
            )
        }
        return versions
    }

    private static func persistCache(versions: [BundledCodeVersion]) {
        guard let resourceURL = Bundle.main.resourceURL else { return }
        let resourcePath = resourceURL.path
        let entries: [CachedScanEntry] = versions.map { version in
            let absolute = version.fileURL.path
            let relative: String
            if absolute.hasPrefix(resourcePath + "/") {
                relative = String(absolute.dropFirst(resourcePath.count + 1))
            } else {
                relative = version.fileURL.lastPathComponent
            }
            return CachedScanEntry(
                fileName: version.fileName,
                relativeFilePath: relative,
                codeVersion: version.codeVersion,
                contentKindRaw: version.contentKind.rawValue,
                authoredCodeID: version.authoredCodeID,
                jurisdictionID: version.jurisdictionID,
                jurisdictionName: version.jurisdictionName,
                authoredHTMLBundlePath: version.authoredHTMLBundlePath
            )
        }
        let scan = CachedScan(appVersionKey: appVersionKey, entries: entries)
        if let data = try? JSONEncoder().encode(scan) {
            UserDefaults.standard.set(data, forKey: cacheDefaultsKey)
        }
    }

    func resourceURL(named fileName: String) -> URL? {
        guard let resourceURL = Bundle.main.resourceURL else { return nil }
        let enumerator = FileManager.default.enumerator(at: resourceURL, includingPropertiesForKeys: [.nameKey])
        while let item = enumerator?.nextObject() as? URL {
            if item.lastPathComponent == fileName {
                return item
            }
        }
        return nil
    }

    private func discoverAuthoredVersions() -> [BundledCodeVersion] {
        guard let resourceURL = Bundle.main.resourceURL else { return [] }
        let authoredRootURL = resourceURL
            .appendingPathComponent("CodeContent", isDirectory: true)
            .appendingPathComponent("authored", isDirectory: true)

        guard FileManager.default.fileExists(atPath: authoredRootURL.path) else {
            return []
        }

        let enumerator = FileManager.default.enumerator(
            at: authoredRootURL,
            includingPropertiesForKeys: [.isDirectoryKey, .isRegularFileKey],
            options: [.skipsHiddenFiles]
        )

        var versions: [BundledCodeVersion] = []
        var seenDirectories: Set<String> = []
        while let item = enumerator?.nextObject() as? URL {
            let name = item.lastPathComponent
            if authoredScanExcludedDirectories.contains(name),
               (try? item.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true {
                enumerator?.skipDescendants()
                continue
            }
            guard name == "bundle.plist" || name == "bundle.json" else { continue }
            let directoryPath = item.deletingLastPathComponent().path
            // Prefer bundle.json when both are present; JSON is the current authored publish format.
            if seenDirectories.contains(directoryPath) { continue }
            let preferredURL: URL = {
                if name == "bundle.json" { return item }
                let jsonCandidate = item.deletingLastPathComponent().appendingPathComponent("bundle.json")
                if FileManager.default.fileExists(atPath: jsonCandidate.path) { return jsonCandidate }
                return item
            }()
            seenDirectories.insert(directoryPath)
            versions.append(contentsOf: readAuthoredVersions(from: preferredURL, authoredRootURL: authoredRootURL))
        }
        return versions
    }

    private func readVersion(from databaseURL: URL) -> BundledCodeVersion? {
        guard let connection = try? SQLiteConnection(path: databaseURL.path, readOnly: true) else {
            return nil
        }
        guard let statement = try? connection.prepare("SELECT code_version FROM code_versions LIMIT 1;") else {
            return nil
        }
        defer { connection.finalize(statement) }

        guard (try? connection.step(statement)) == SQLITE_ROW else {
            return nil
        }

        let codeVersion = connection.string(at: 0, in: statement)
        return BundledCodeVersion(
            fileName: databaseURL.lastPathComponent,
            fileURL: databaseURL,
            codeVersion: codeVersion,
            contentKind: .sqlite,
            authoredCodeID: nil,
            jurisdictionID: nil,
            jurisdictionName: nil,
            authoredHTMLBundlePath: nil
        )
    }

    private func readAuthoredVersions(
        from jsonURL: URL,
        authoredRootURL: URL
    ) -> [BundledCodeVersion] {
        guard let data = try? Data(contentsOf: jsonURL) else { return [] }
        let project: AuthoredBundleIndex
        if jsonURL.pathExtension.lowercased() == "plist" {
            guard let decoded = try? PropertyListDecoder().decode(AuthoredBundleIndex.self, from: data) else { return [] }
            project = decoded
        } else {
            guard let decoded = try? JSONDecoder().decode(AuthoredBundleIndex.self, from: data) else { return [] }
            project = decoded
        }

        let resourceRootURL = authoredRootURL
            .deletingLastPathComponent()
            .deletingLastPathComponent()

        let relativeBundleRootPath = jsonURL
            .deletingLastPathComponent()
            .path
            .replacingOccurrences(of: resourceRootURL.path + "/", with: "")

        let jurisdictionNamesByID = Dictionary(
            uniqueKeysWithValues: (project.jurisdictions ?? []).map { ($0.id, $0.name) }
        )

        return (project.codes ?? []).map { code in
            BundledCodeVersion(
                fileName: relativeBundleRootPath + "/\(jsonURL.lastPathComponent)#\(code.id)",
                fileURL: jsonURL,
                codeVersion: code.name,
                contentKind: .authored,
                authoredCodeID: code.id,
                jurisdictionID: code.jurisdictionID,
                jurisdictionName: code.jurisdictionID.flatMap { jurisdictionNamesByID[$0] },
                authoredHTMLBundlePath: relativeBundleRootPath
            )
        }
    }
}
