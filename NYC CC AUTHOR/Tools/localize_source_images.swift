import Foundation

let currentAmLegalMediaHashes = [
    "27bfe23e02ad82f13a7a5e91d58b26cb988bcea5"
]

func htmlDocumentURLs(in rootURL: URL) throws -> [URL] {
    let fileManager = FileManager.default
    var isDirectory: ObjCBool = false
    guard fileManager.fileExists(atPath: rootURL.path, isDirectory: &isDirectory) else {
        throw NSError(domain: "LocalizeSourceImagesTool", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "Path does not exist: \(rootURL.path)"
        ])
    }

    if isDirectory.boolValue {
        let enumerator = fileManager.enumerator(
            at: rootURL,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        )
        var urls: [URL] = []
        while let item = enumerator?.nextObject() as? URL {
            let ext = item.pathExtension.lowercased()
            if ext == "html" || ext == "htm" {
                urls.append(item.standardizedFileURL)
            }
        }
        return urls.sorted {
            $0.path.compare($1.path, options: [.numeric, .caseInsensitive]) == .orderedAscending
        }
    }

    let ext = rootURL.pathExtension.lowercased()
    return (ext == "html" || ext == "htm") ? [rootURL] : []
}

func loadString(from url: URL) throws -> String {
    let data = try Data(contentsOf: url)
    if let utf8 = String(data: data, encoding: .utf8) {
        return utf8
    }
    if let latin1 = String(data: data, encoding: .isoLatin1) {
        return latin1
    }
    throw NSError(domain: "LocalizeSourceImagesTool", code: 2, userInfo: [
        NSLocalizedDescriptionKey: "Could not decode HTML file: \(url.path)"
    ])
}

func normalizedRemoteURL(from urlString: String) throws -> URL {
    let normalized = urlString.hasPrefix("//") ? "https:" + urlString : urlString
    guard let url = URL(string: normalized) else {
        throw NSError(domain: "LocalizeSourceImagesTool", code: 3, userInfo: [
            NSLocalizedDescriptionKey: "Invalid remote URL: \(urlString)"
        ])
    }
    return url
}

func currentAmLegalFallbackURLs(for remoteURL: URL) -> [URL] {
    guard remoteURL.host?.caseInsensitiveCompare("export.amlegal.com") == .orderedSame else {
        return []
    }
    let pathComponents = remoteURL.pathComponents
    guard let mediaIndex = pathComponents.firstIndex(of: "media"),
          pathComponents.indices.contains(mediaIndex + 1),
          pathComponents.contains("IMAGES") else {
        return []
    }

    let staleHash = pathComponents[mediaIndex + 1]
    return currentAmLegalMediaHashes.compactMap { currentHash in
        guard currentHash != staleHash else { return nil }
        var updatedComponents = pathComponents
        updatedComponents[mediaIndex + 1] = currentHash
        var components = URLComponents(url: remoteURL, resolvingAgainstBaseURL: false)
        components?.path = updatedComponents.joined(separator: "/")
        return components?.url
    }
}

func download(remoteURL: URL, assetsDirectoryURL: URL) throws -> URL {
    let fileName = remoteURL.lastPathComponent
    let outputURL = assetsDirectoryURL.appendingPathComponent(fileName, isDirectory: false)
    if FileManager.default.fileExists(atPath: outputURL.path) {
        return outputURL
    }
    let data = try Data(contentsOf: remoteURL)
    try data.write(to: outputURL, options: .atomic)
    return outputURL
}

func downloadUsingFallbacks(remoteURL: URL, assetsDirectoryURL: URL) throws -> URL {
    do {
        return try download(remoteURL: remoteURL, assetsDirectoryURL: assetsDirectoryURL)
    } catch {
        for fallbackURL in currentAmLegalFallbackURLs(for: remoteURL) {
            do {
                return try download(remoteURL: fallbackURL, assetsDirectoryURL: assetsDirectoryURL)
            } catch {
                continue
            }
        }
        throw error
    }
}

do {
    let arguments = Array(CommandLine.arguments.dropFirst())
    guard arguments.count == 1 else {
        fputs("Usage: swift localize_source_images.swift /path/to/jurisdiction-or-code-root\n", stderr)
        Foundation.exit(1)
    }

    let rootURL = URL(fileURLWithPath: arguments[0]).standardizedFileURL
    let htmlURLs = try htmlDocumentURLs(in: rootURL)
    guard !htmlURLs.isEmpty else {
        fputs("No HTML files found under \(rootURL.path)\n", stderr)
        Foundation.exit(1)
    }

    let regex = try NSRegularExpression(
        pattern: #"(src)\s*=\s*"((?:https?:)?//[^"]*export\.amlegal\.com[^"]*/IMAGES/[^"]+)""#,
        options: [.caseInsensitive]
    )

    var rewrittenFileCount = 0
    var downloadedAssetCount = 0
    var totalReplacementCount = 0
    var seenDownloads = Set<String>()

    for htmlURL in htmlURLs {
        let originalHTML = try loadString(from: htmlURL)
        let nsHTML = originalHTML as NSString
        let matches = regex.matches(in: originalHTML, range: NSRange(location: 0, length: nsHTML.length))
        guard !matches.isEmpty else { continue }

        let assetsDirectoryURL = htmlURL.deletingLastPathComponent().appendingPathComponent("assets", isDirectory: true)
        try FileManager.default.createDirectory(at: assetsDirectoryURL, withIntermediateDirectories: true)

        var replacements: [(original: String, replacement: String)] = []
        var cache: [String: String] = [:]

        for match in matches.reversed() {
            guard match.numberOfRanges >= 3 else { continue }
            let urlString = nsHTML.substring(with: match.range(at: 2))
            let replacementPath: String
            if let cached = cache[urlString] {
                replacementPath = cached
            } else {
                let remoteURL = try normalizedRemoteURL(from: urlString)
                let localizedAssetURL = try downloadUsingFallbacks(remoteURL: remoteURL, assetsDirectoryURL: assetsDirectoryURL)
                if seenDownloads.insert(localizedAssetURL.path).inserted {
                    downloadedAssetCount += 1
                }
                replacementPath = "assets/" + localizedAssetURL.lastPathComponent
                cache[urlString] = replacementPath
            }
            replacements.append((original: urlString, replacement: replacementPath))
        }

        guard !replacements.isEmpty else { continue }

        var rewrittenHTML = originalHTML
        for replacement in replacements {
            rewrittenHTML = rewrittenHTML.replacingOccurrences(of: replacement.original, with: replacement.replacement)
        }

        if rewrittenHTML != originalHTML {
            try Data(rewrittenHTML.utf8).write(to: htmlURL, options: .atomic)
            rewrittenFileCount += 1
            totalReplacementCount += replacements.count
        }
    }

    print("Localized \(totalReplacementCount) image reference(s) across \(rewrittenFileCount) HTML file(s).")
    print("Downloaded \(downloadedAssetCount) unique image asset(s).")
} catch {
    fputs("Error: \(error.localizedDescription)\n", stderr)
    Foundation.exit(1)
}
