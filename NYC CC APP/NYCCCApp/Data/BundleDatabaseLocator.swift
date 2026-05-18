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

    func availableCodeVersions() -> [BundledCodeVersion] {
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
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        )

        var versions: [BundledCodeVersion] = []
        while let item = enumerator?.nextObject() as? URL {
            guard item.lastPathComponent == "bundle.json" else { continue }
            versions.append(contentsOf: readAuthoredVersions(from: item, authoredRootURL: authoredRootURL))
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
        guard
            let data = try? Data(contentsOf: jsonURL),
            let project = try? JSONDecoder().decode(AuthoredBundleIndex.self, from: data)
        else {
            return []
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
                fileName: relativeBundleRootPath + "/bundle.json#\(code.id)",
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
