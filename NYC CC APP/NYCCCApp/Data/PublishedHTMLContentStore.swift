import Foundation

struct PublishedHTMLAnchor: Hashable, Sendable {
    let sectionNumber: String
    let title: String
    let anchorID: String
    let level: Int

    var displayLabel: String {
        "\(sectionNumber) \(title)"
    }

    var menuLabel: String {
        if title.localizedCaseInsensitiveContains("Section BC \(sectionNumber)") {
            return title
        }
        return "\(sectionNumber) \(title)"
    }
}

struct PublishedHTMLFeatureSet: Hashable, Sendable {
    let containsInlineImages: Bool
    let containsInlineTables: Bool

    var requiresHTMLReader: Bool {
        containsInlineImages || containsInlineTables
    }
}

final class PublishedHTMLContentStore {
    private struct ChapterCache {
        let url: URL
        let anchorsBySectionNumber: [String: PublishedHTMLAnchor]
    }

    private static var anchorCache: [String: [PublishedHTMLAnchor]] = [:]
    private static var anchorCacheKeys: [String] = []
    private static let anchorCacheLock = NSLock()
    private static var inlineFeatureCache: [String: PublishedHTMLFeatureSet] = [:]
    private static var inlineFeatureCacheKeys: [String] = []
    private static let inlineFeatureCacheLock = NSLock()
    private static let metadataCacheLimit = 96

    private let rootURL: URL?
    private var chapterCache: [String: ChapterCache] = [:]

    init(resourceURL: URL? = Bundle.main.resourceURL, relativeRootPath: String?, codeSectionSlug: String? = nil) {
        if let resourceURL, let relativeRootPath, !relativeRootPath.isEmpty {
            let baseURL = relativeRootPath
                .split(separator: "/")
                .reduce(resourceURL) { partial, component in
                    partial.appendingPathComponent(String(component), isDirectory: true)
                }
            if let codeSectionSlug, !codeSectionSlug.isEmpty {
                let codeSectionURL = baseURL
                    .appendingPathComponent("code-sections", isDirectory: true)
                    .appendingPathComponent(codeSectionSlug, isDirectory: true)
                self.rootURL = FileManager.default.fileExists(atPath: codeSectionURL.path) ? codeSectionURL : baseURL
            } else {
                self.rootURL = baseURL
            }
        } else {
            self.rootURL = resourceURL?
                .appendingPathComponent("CodeContent", isDirectory: true)
                .appendingPathComponent("2022-construction-codes", isDirectory: true)
        }
    }

    func chapterURL(chapterNumber: String) -> URL? {
        guard let rootURL else { return nil }
        let fileName = "\(chapterNumber.uppercased()).html"
        let url = rootURL
            .appendingPathComponent("chapters", isDirectory: true)
            .appendingPathComponent(fileName, isDirectory: false)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    func readAccessURL() -> URL? {
        rootURL
    }

    private struct ImageManifestFile: Decodable {
        let schemaVersion: Int
        let items: [String: String]
    }

    private static var imageManifestItems: [String: String]?
    private static var imageManifestReadAccessURL: URL?
    private static let imageManifestLock = NSLock()

    static func resolvedImageURL(imageID: String, readAccessURL: URL) -> URL? {
        let trimmed = imageID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        imageManifestLock.lock()
        if imageManifestReadAccessURL != readAccessURL {
            imageManifestItems = loadImageManifest(readAccessURL: readAccessURL)
            imageManifestReadAccessURL = readAccessURL
        }
        let items = imageManifestItems
        imageManifestLock.unlock()

        guard let items else { return nil }
        let baseName = (trimmed as NSString).deletingPathExtension
        guard let relativePath = items[trimmed] ?? items[baseName] else { return nil }
        return readAccessURL.appendingPathComponent(relativePath)
    }

    private static func loadImageManifest(readAccessURL: URL) -> [String: String]? {
        let manifestURL = readAccessURL
            .appendingPathComponent("prepared", isDirectory: true)
            .appendingPathComponent("images.json", isDirectory: false)
        guard let data = try? Data(contentsOf: manifestURL) else { return nil }
        guard let manifest = try? JSONDecoder().decode(ImageManifestFile.self, from: data) else { return nil }
        return manifest.items
    }

    func anchor(chapterNumber: String, sectionNumber: String) -> PublishedHTMLAnchor? {
        guard let cache = chapterCache(chapterNumber: chapterNumber) else { return nil }
        return cache.anchorsBySectionNumber[Self.normalizedSectionKey(sectionNumber)]
    }

    func anchors(chapterNumber: String) -> [PublishedHTMLAnchor] {
        guard let cache = chapterCache(chapterNumber: chapterNumber) else { return [] }
        return Self.sortedAnchors(cache.anchorsBySectionNumber.values)
    }

    static func anchors(in chapterURL: URL) -> [PublishedHTMLAnchor] {
        let cacheKey = chapterURL.path
        anchorCacheLock.lock()
        if let cached = anchorCache[cacheKey] {
            anchorCacheLock.unlock()
            return cached
        }
        anchorCacheLock.unlock()

        guard let html = try? String(contentsOf: chapterURL, encoding: .utf8) else {
            return []
        }
        let parsedAnchors = sortedAnchors(parseAnchors(in: html).values)

        anchorCacheLock.lock()
        storeAnchors(parsedAnchors, for: cacheKey)
        anchorCacheLock.unlock()

        return parsedAnchors
    }

    static func containsInlineImages(in chapterURL: URL) -> Bool {
        inlineFeatures(in: chapterURL).containsInlineImages
    }

    static func containsInlineTables(in chapterURL: URL) -> Bool {
        inlineFeatures(in: chapterURL).containsInlineTables
    }

    static func inlineFeatures(in chapterURL: URL) -> PublishedHTMLFeatureSet {
        let key = chapterURL.path
        inlineFeatureCacheLock.lock()
        if let cached = inlineFeatureCache[key] {
            inlineFeatureCacheLock.unlock()
            return cached
        }
        inlineFeatureCacheLock.unlock()

        let result: PublishedHTMLFeatureSet
        if let html = try? String(contentsOf: chapterURL, encoding: .utf8) {
            result = PublishedHTMLFeatureSet(
                containsInlineImages: html.range(of: #"<img\b"#, options: [.regularExpression, .caseInsensitive]) != nil,
                containsInlineTables: html.range(
                    of: #"<(?:table|ScrollTable)\b|class="[^"]*\bxsl-table\b"#,
                    options: [.regularExpression, .caseInsensitive]
                ) != nil
            )
        } else {
            result = PublishedHTMLFeatureSet(containsInlineImages: false, containsInlineTables: false)
        }

        inlineFeatureCacheLock.lock()
        storeInlineFeatures(result, for: key)
        inlineFeatureCacheLock.unlock()
        return result
    }

    private static func storeAnchors(_ anchors: [PublishedHTMLAnchor], for key: String) {
        anchorCache[key] = anchors
        if let existingIndex = anchorCacheKeys.firstIndex(of: key) {
            anchorCacheKeys.remove(at: existingIndex)
        }
        anchorCacheKeys.append(key)
        while anchorCacheKeys.count > metadataCacheLimit {
            let evictedKey = anchorCacheKeys.removeFirst()
            anchorCache.removeValue(forKey: evictedKey)
        }
    }

    private static func storeInlineFeatures(_ features: PublishedHTMLFeatureSet, for key: String) {
        inlineFeatureCache[key] = features
        if let existingIndex = inlineFeatureCacheKeys.firstIndex(of: key) {
            inlineFeatureCacheKeys.remove(at: existingIndex)
        }
        inlineFeatureCacheKeys.append(key)
        while inlineFeatureCacheKeys.count > metadataCacheLimit {
            let evictedKey = inlineFeatureCacheKeys.removeFirst()
            inlineFeatureCache.removeValue(forKey: evictedKey)
        }
    }

    private func chapterCache(chapterNumber: String) -> ChapterCache? {
        let key = chapterNumber.uppercased()
        if let cached = chapterCache[key] {
            return cached
        }

        guard let url = chapterURL(chapterNumber: chapterNumber) else {
            return nil
        }

        let cache = ChapterCache(
            url: url,
            anchorsBySectionNumber: Dictionary(
                uniqueKeysWithValues: Self.anchors(in: url).map { anchor in
                    (Self.normalizedSectionKey(anchor.sectionNumber), anchor)
                }
            )
        )
        chapterCache[key] = cache
        return cache
    }

    private static func parseAnchors(in html: String) -> [String: PublishedHTMLAnchor] {
        let pattern = #"<div\s+id="([^"]+)"[^>]*class="([^"]*(?:Subarticle|Section|Subsection)[^"]*)"[^>]*>.*?<h6[^>]*>(.*?)</h6>"#
        guard let expression = try? NSRegularExpression(
            pattern: pattern,
            options: [.caseInsensitive, .dotMatchesLineSeparators]
        ) else {
            return [:]
        }

        let nsHTML = html as NSString
        let matches = expression.matches(
            in: html,
            range: NSRange(location: 0, length: nsHTML.length)
        )

        var anchors: [String: PublishedHTMLAnchor] = [:]
        for match in matches {
            guard match.numberOfRanges == 4 else { continue }
            let divID = nsHTML.substring(with: match.range(at: 1))
            let headingHTML = nsHTML.substring(with: match.range(at: 3))
            let heading = cleanHeading(headingHTML)

            guard let parsed = parseHeading(heading) else { continue }
            anchors[normalizedSectionKey(parsed.sectionNumber)] = PublishedHTMLAnchor(
                sectionNumber: parsed.sectionNumber,
                title: parsed.title,
                anchorID: divID,
                level: parsed.level
            )
        }

        return anchors
    }

    private static func parseHeading(_ heading: String) -> (sectionNumber: String, title: String, level: Int)? {
        if let appendixMatch = firstMatch(
            in: heading,
            pattern: #"^Appendix\s+([A-Z0-9]+):?\s*(.*)$"#
        ) {
            let title = appendixMatch[2].isEmpty ? "Appendix \(appendixMatch[1])" : appendixMatch[2]
            return (
                sectionNumber: appendixMatch[1],
                title: title,
                level: 1
            )
        }

        if let appendixMatch = firstMatch(
            in: heading,
            pattern: #"^#-\s*Appendix\s+([A-Z0-9]+):?\s*(.*)$"#
        ) {
            let title = appendixMatch[2].isEmpty ? "Appendix \(appendixMatch[1])" : appendixMatch[2]
            return (
                sectionNumber: appendixMatch[1],
                title: title,
                level: 1
            )
        }

        if let chapterMatch = firstMatch(
            in: heading,
            pattern: #"^Chapter\s+([A-Z0-9]+):\s*(.+)$"#
        ) {
            return (
                sectionNumber: chapterMatch[1],
                title: "Chapter \(chapterMatch[1]): \(chapterMatch[2])",
                level: 2
            )
        }

        if let sectionMatch = firstMatch(
            in: heading,
            pattern: #"^Section\s+BC\s+([A-Z0-9.]+):\s*(.+)$"#
        ) {
            return (
                sectionNumber: sectionMatch[1],
                title: "Section BC \(sectionMatch[1]): \(sectionMatch[2])",
                level: 2
            )
        }

        if let sectionMatch = firstMatch(
            in: heading,
            pattern: #"^#--\s*Section\s+BC\s+([A-Z0-9.]+):\s*(.+)$"#
        ) {
            return (
                sectionNumber: sectionMatch[1],
                title: "Section BC \(sectionMatch[1]): \(sectionMatch[2])",
                level: 2
            )
        }

        if let titleMatch = firstMatch(
            in: heading,
            pattern: #"^([A-Z0-9]+(?:\.[A-Z0-9]+)*)\s+(.+)$"#
        ) {
            return (
                sectionNumber: titleMatch[1],
                title: titleMatch[2],
                level: 3
            )
        }

        guard let titleMatch = firstMatch(
            in: heading,
            pattern: #"^(#-{3,})\s*([A-Z0-9]+(?:\.[A-Z0-9]+)*)\s+(.+)$"#
        ) else {
            return nil
        }

        return (
            sectionNumber: titleMatch[2],
            title: titleMatch[3],
            level: titleMatch[1].count
        )
    }

    private static func cleanHeading(_ html: String) -> String {
        html
            .replacingOccurrences(of: #"<[^>]+>"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&#160;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func normalizedSectionKey(_ sectionNumber: String) -> String {
        sectionNumber
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
            .uppercased()
    }

    private static func sortedAnchors(_ anchors: Dictionary<String, PublishedHTMLAnchor>.Values) -> [PublishedHTMLAnchor] {
        sortedAnchors(Array(anchors))
    }

    private static func sortedAnchors(_ anchors: [PublishedHTMLAnchor]) -> [PublishedHTMLAnchor] {
        anchors.sorted {
            $0.sectionNumber.compare($1.sectionNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
        }
    }

    private static func firstMatch(in value: String, pattern: String) -> [String]? {
        guard let expression = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return nil
        }
        let nsValue = value as NSString
        guard let match = expression.firstMatch(in: value, range: NSRange(location: 0, length: nsValue.length)) else {
            return nil
        }

        return (0..<match.numberOfRanges).map { index in
            let range = match.range(at: index)
            guard range.location != NSNotFound else { return "" }
            return nsValue.substring(with: range).trimmingCharacters(in: .whitespacesAndNewlines)
        }
    }
}
