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

final class PublishedHTMLContentStore {
    private struct ChapterCache {
        let url: URL
        let anchorsBySectionNumber: [String: PublishedHTMLAnchor]
    }

    private let rootURL: URL?
    private var chapterCache: [String: ChapterCache] = [:]

    init(resourceURL: URL? = Bundle.main.resourceURL, relativeRootPath: String?) {
        if let resourceURL, let relativeRootPath, !relativeRootPath.isEmpty {
            self.rootURL = relativeRootPath
                .split(separator: "/")
                .reduce(resourceURL) { partial, component in
                    partial.appendingPathComponent(String(component), isDirectory: true)
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

    func anchor(chapterNumber: String, sectionNumber: String) -> PublishedHTMLAnchor? {
        guard let cache = chapterCache(chapterNumber: chapterNumber) else { return nil }
        return cache.anchorsBySectionNumber[Self.normalizedSectionKey(sectionNumber)]
    }

    func anchors(chapterNumber: String) -> [PublishedHTMLAnchor] {
        guard let cache = chapterCache(chapterNumber: chapterNumber) else { return [] }
        return Self.sortedAnchors(cache.anchorsBySectionNumber.values)
    }

    static func anchors(in chapterURL: URL) -> [PublishedHTMLAnchor] {
        guard let html = try? String(contentsOf: chapterURL, encoding: .utf8) else {
            return []
        }
        return sortedAnchors(parseAnchors(in: html).values)
    }

    private func chapterCache(chapterNumber: String) -> ChapterCache? {
        let key = chapterNumber.uppercased()
        if let cached = chapterCache[key] {
            return cached
        }

        guard let url = chapterURL(chapterNumber: chapterNumber),
              let html = try? String(contentsOf: url, encoding: .utf8)
        else {
            return nil
        }

        let cache = ChapterCache(
            url: url,
            anchorsBySectionNumber: Self.parseAnchors(in: html)
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
