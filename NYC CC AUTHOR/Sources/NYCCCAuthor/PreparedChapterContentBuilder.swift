import Foundation

enum PreparedContentBlockKind: String, Codable, Hashable {
    case html
    case table
    case image
}

struct PreparedContentBlock: Codable, Hashable, Identifiable {
    let id: String
    let kind: PreparedContentBlockKind
    let html: String?
    let tableID: String?
    let imageID: String?
    let caption: String?
    let plainText: String?
}

struct PreparedSectionContent: Codable, Hashable {
    let schemaVersion: Int
    let sectionID: Int64
    let chapterNumber: String
    let blocks: [PreparedContentBlock]
}

struct PreparedContentManifest: Codable, Hashable {
    struct Chapter: Codable, Hashable {
        let chapterID: Int64
        let codeSectionID: Int64
        let chapterNumber: String
        let sectionCount: Int
        let preparedSectionCount: Int
        let blockCount: Int
    }

    let schemaVersion: Int
    let generatedAt: String
    let chapters: [Chapter]
}

enum PreparedChapterContentBuilder {
    private struct HTMLHeading {
        let sectionNumber: String
        let contentStart: Int
        let wrapperStart: Int
    }

    static func writePreparedContent(
        for project: EditorAuthoringProject,
        bundleRootURL: URL
    ) throws -> PreparedContentManifest {
        let preparedURL = bundleRootURL.appendingPathComponent("prepared", isDirectory: true)
        let sectionsURL = preparedURL.appendingPathComponent("sections", isDirectory: true)

        if FileManager.default.fileExists(atPath: preparedURL.path) {
            try FileManager.default.removeItem(at: preparedURL)
        }
        try FileManager.default.createDirectory(at: sectionsURL, withIntermediateDirectories: true)

        let codeSectionNamesByID = Dictionary(uniqueKeysWithValues: project.codeSections.map { ($0.id, $0.name) })
        var manifestChapters: [PreparedContentManifest.Chapter] = []

        for chapter in project.chapters {
            let codeSectionName = codeSectionNamesByID[chapter.codeSectionID] ?? "code"
            guard let chapterURL = chapterHTMLURL(
                bundleRootURL: bundleRootURL,
                codeSectionName: codeSectionName,
                chapterNumber: chapter.chapterNumber
            ),
            let html = try? String(contentsOf: chapterURL, encoding: .utf8),
            !html.isEmpty else {
                continue
            }

            let sectionBlocks = preparedBlocksBySectionID(chapter: chapter, html: html)
            var preparedSectionCount = 0
            var blockCount = 0

            for group in chapter.groups {
                for section in group.sections {
                    guard let blocks = sectionBlocks[section.id], !blocks.isEmpty else { continue }
                    let preparedSection = PreparedSectionContent(
                        schemaVersion: 1,
                        sectionID: section.id,
                        chapterNumber: chapter.chapterNumber,
                        blocks: blocks
                    )
                    let data = try prettyJSONEncoder().encode(preparedSection)
                    try data.write(
                        to: sectionsURL.appendingPathComponent("\(section.id).json", isDirectory: false),
                        options: Data.WritingOptions.atomic
                    )
                    preparedSectionCount += 1
                    blockCount += blocks.count
                }
            }

            manifestChapters.append(
                PreparedContentManifest.Chapter(
                    chapterID: chapter.id,
                    codeSectionID: chapter.codeSectionID,
                    chapterNumber: chapter.chapterNumber,
                    sectionCount: chapter.groups.flatMap(\.sections).count,
                    preparedSectionCount: preparedSectionCount,
                    blockCount: blockCount
                )
            )
        }

        let manifest = PreparedContentManifest(
            schemaVersion: 1,
            generatedAt: ISO8601DateFormatter().string(from: Date()),
            chapters: manifestChapters
        )
        let manifestData = try prettyJSONEncoder().encode(manifest)
        try manifestData.write(
            to: preparedURL.appendingPathComponent("manifest.json"),
            options: Data.WritingOptions.atomic
        )
        return manifest
    }

    private static func prettyJSONEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }

    private static func chapterHTMLURL(
        bundleRootURL: URL,
        codeSectionName: String,
        chapterNumber: String
    ) -> URL? {
        let fileName = "\(chapterNumber.uppercased()).html"
        let sectionedURL = bundleRootURL
            .appendingPathComponent("code-sections", isDirectory: true)
            .appendingPathComponent(slug(codeSectionName), isDirectory: true)
            .appendingPathComponent("chapters", isDirectory: true)
            .appendingPathComponent(fileName, isDirectory: false)
        if FileManager.default.fileExists(atPath: sectionedURL.path) {
            return sectionedURL
        }

        let flatURL = bundleRootURL
            .appendingPathComponent("chapters", isDirectory: true)
            .appendingPathComponent(fileName, isDirectory: false)
        if FileManager.default.fileExists(atPath: flatURL.path) {
            return flatURL
        }

        return nil
    }

    private static func preparedBlocksBySectionID(
        chapter: EditorAuthoredChapter,
        html: String
    ) -> [Int64: [PreparedContentBlock]] {
        let headings = htmlHeadings(in: html)
        guard !headings.isEmpty else { return [:] }

        let sections = chapter.groups.flatMap(\.sections)
        var result: [Int64: [PreparedContentBlock]] = [:]

        for section in sections {
            guard let index = headings.firstIndex(where: {
                normalizedSectionNumber($0.sectionNumber) == normalizedSectionNumber(section.sectionNumber)
            }) else {
                continue
            }

            let start = headings[index].contentStart
            let end = index + 1 < headings.count ? headings[index + 1].wrapperStart : html.utf16.count
            guard start < end else { continue }

            let fragment = (html as NSString).substring(with: NSRange(location: start, length: end - start))
            let blocks = contentBlocks(from: fragment, sectionID: section.id)
            if !blocks.isEmpty {
                result[section.id] = blocks
            }
        }

        return result
    }

    private static func htmlHeadings(in html: String) -> [HTMLHeading] {
        let pattern = #"<h6\b[^>]*>\s*(?:<a\b[^>]*>\s*</a>\s*)?(?:§|&#167;)?\s*([A-Za-z0-9]+(?:[-.][A-Za-z0-9]+)*)\.?\s*.*?</h6>"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive, .dotMatchesLineSeparators]) else {
            return []
        }

        let nsHTML = html as NSString
        return regex.matches(in: html, range: NSRange(location: 0, length: nsHTML.length)).compactMap { match in
            guard match.numberOfRanges > 1 else { return nil }
            return HTMLHeading(
                sectionNumber: nsHTML.substring(with: match.range(at: 1)),
                contentStart: match.range.location + match.range.length,
                wrapperStart: headingWrapperStart(in: html, headingLocation: match.range.location)
            )
        }
    }

    private static func headingWrapperStart(in html: String, headingLocation: Int) -> Int {
        let nsHTML = html as NSString
        let beforeHeading = nsHTML.substring(with: NSRange(location: 0, length: headingLocation))
        guard let range = beforeHeading.range(of: "<div><span depth=", options: [.backwards, .caseInsensitive]) else {
            return headingLocation
        }
        return beforeHeading.distance(from: beforeHeading.startIndex, to: range.lowerBound)
    }

    private static func contentBlocks(from html: String, sectionID: Int64) -> [PreparedContentBlock] {
        var blocks: [PreparedContentBlock] = []
        var cursor = html.startIndex
        var ordinal = 0

        while cursor < html.endIndex {
            guard let richStart = nextRichBlockStart(in: html, from: cursor) else {
                appendTextBlock(html[cursor..<html.endIndex], sectionID: sectionID, ordinal: &ordinal, blocks: &blocks)
                break
            }

            appendTextBlock(html[cursor..<richStart], sectionID: sectionID, ordinal: &ordinal, blocks: &blocks)

            if isTableStart(in: html, at: richStart) {
                let tableEnd = matchingTableEnd(in: html, from: richStart) ?? html.endIndex
                let tableHTML = String(html[richStart..<tableEnd]).trimmingCharacters(in: .whitespacesAndNewlines)
                if let tableID = tableReferenceID(in: tableHTML) {
                    ordinal += 1
                    blocks.append(
                        PreparedContentBlock(
                            id: "\(sectionID)-table-\(ordinal)",
                            kind: .table,
                            html: nil,
                            tableID: tableID,
                            imageID: nil,
                            caption: nil,
                            plainText: nil
                        )
                    )
                } else if !tableHTML.isEmpty {
                    ordinal += 1
                    blocks.append(
                        PreparedContentBlock(
                            id: "\(sectionID)-table-\(ordinal)",
                            kind: .table,
                            html: tableHTML,
                            tableID: nil,
                            imageID: nil,
                            caption: nil,
                            plainText: nil
                        )
                    )
                }
                cursor = tableEnd
            } else {
                let imageEnd = matchingImageEnd(in: html, from: richStart) ?? html.index(after: richStart)
                let imageHTML = String(html[richStart..<imageEnd]).trimmingCharacters(in: .whitespacesAndNewlines)
                if let imageID = imageSourceID(in: imageHTML) {
                    ordinal += 1
                    blocks.append(
                        PreparedContentBlock(
                            id: "\(sectionID)-image-\(ordinal)",
                            kind: .image,
                            html: imageHTML,
                            tableID: nil,
                            imageID: imageID,
                            caption: nil,
                            plainText: nil
                        )
                    )
                } else {
                    appendTextBlock(html[richStart..<imageEnd], sectionID: sectionID, ordinal: &ordinal, blocks: &blocks)
                }
                cursor = imageEnd
            }
        }

        return blocks
    }

    private static func nextRichBlockStart(in html: String, from cursor: String.Index) -> String.Index? {
        let starts = [nextTableStart(in: html, from: cursor), nextImageStart(in: html, from: cursor)].compactMap { $0 }
        return starts.min()
    }

    private static func isTableStart(in html: String, at index: String.Index) -> Bool {
        let lowercased = html[index...].lowercased()
        return lowercased.hasPrefix("<scrolltable") ||
            lowercased.hasPrefix("<table") ||
            lowercased.hasPrefix("<figure")
    }

    private static func nextTableStart(in html: String, from cursor: String.Index) -> String.Index? {
        let scrollTable = html.range(of: "<ScrollTable", options: [.caseInsensitive], range: cursor..<html.endIndex)?.lowerBound
        let table = html.range(of: "<table", options: [.caseInsensitive], range: cursor..<html.endIndex)?.lowerBound
        let tableReference = html.range(
            of: #"<figure\b[^>]*\bdata-table-ref\s*="#,
            options: [.regularExpression, .caseInsensitive],
            range: cursor..<html.endIndex
        )?.lowerBound
        return [scrollTable, table, tableReference].compactMap { $0 }.min()
    }

    private static func matchingTableEnd(in html: String, from start: String.Index) -> String.Index? {
        if html[start...].lowercased().hasPrefix("<scrolltable"),
           let range = html.range(of: "</ScrollTable>", options: [.caseInsensitive], range: start..<html.endIndex) {
            return range.upperBound
        }
        if html[start...].lowercased().hasPrefix("<figure") {
            if let range = html.range(of: "</figure>", options: [.caseInsensitive], range: start..<html.endIndex) {
                return range.upperBound
            }
            return html.range(of: ">", range: start..<html.endIndex)?.upperBound
        }
        return html.range(of: "</table>", options: [.caseInsensitive], range: start..<html.endIndex)?.upperBound
    }

    private static func nextImageStart(in html: String, from cursor: String.Index) -> String.Index? {
        guard let imageRange = html.range(of: "<img", options: [.caseInsensitive], range: cursor..<html.endIndex) else {
            return nil
        }
        if let spanRange = html.range(of: #"<span class="img""#, options: [.caseInsensitive], range: cursor..<imageRange.lowerBound) {
            return spanRange.lowerBound
        }
        return imageRange.lowerBound
    }

    private static func matchingImageEnd(in html: String, from start: String.Index) -> String.Index? {
        if html[start...].lowercased().hasPrefix("<span"),
           let range = html.range(of: "</span>", options: [.caseInsensitive], range: start..<html.endIndex) {
            return range.upperBound
        }
        return html.range(of: ">", range: start..<html.endIndex)?.upperBound
    }

    private static func imageSourceID(in html: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: #"(?i)\bsrc\s*=\s*"([^"]+)""#) else {
            return nil
        }
        let nsHTML = html as NSString
        guard let match = regex.firstMatch(in: html, range: NSRange(location: 0, length: nsHTML.length)),
              match.numberOfRanges > 1 else {
            return nil
        }
        let source = nsHTML.substring(with: match.range(at: 1))
        return source
            .split(separator: "/")
            .last
            .map(String.init)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func tableReferenceID(in html: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: #"(?i)\bdata-table-ref\s*=\s*"([^"]+)""#) else {
            return nil
        }
        let nsHTML = html as NSString
        guard let match = regex.firstMatch(in: html, range: NSRange(location: 0, length: nsHTML.length)),
              match.numberOfRanges > 1 else {
            return nil
        }
        return nsHTML.substring(with: match.range(at: 1))
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func appendTextBlock(
        _ html: Substring,
        sectionID: Int64,
        ordinal: inout Int,
        blocks: inout [PreparedContentBlock]
    ) {
        let htmlString = String(html).trimmingCharacters(in: .whitespacesAndNewlines)
        let text = plainText(fromHTML: htmlString)
        guard !text.isEmpty else { return }
        ordinal += 1
        blocks.append(
            PreparedContentBlock(
                id: "\(sectionID)-html-\(ordinal)",
                kind: .html,
                html: htmlString,
                tableID: nil,
                imageID: nil,
                caption: nil,
                plainText: text
            )
        )
    }

    private static func plainText(fromHTML html: String) -> String {
        var text = html
        text = text.replacingOccurrences(of: #"(?i)<br\s*/?>"#, with: "\n", options: .regularExpression)
        text = text.replacingOccurrences(of: #"(?i)</(p|div|li|tr|h[1-6])>"#, with: "\n", options: .regularExpression)
        text = text.replacingOccurrences(of: #"<script\b[^>]*>.*?</script>"#, with: "", options: [.regularExpression, .caseInsensitive])
        text = text.replacingOccurrences(of: #"<style\b[^>]*>.*?</style>"#, with: "", options: [.regularExpression, .caseInsensitive])
        text = text.replacingOccurrences(of: #"<[^>]+>"#, with: " ", options: .regularExpression)
        text = decodeCommonHTMLEntities(text)
        text = text.replacingOccurrences(of: #"[ \t\r\f]+"#, with: " ", options: .regularExpression)
        text = text.replacingOccurrences(of: #"\n\s+\n"#, with: "\n\n", options: .regularExpression)
        text = text.replacingOccurrences(of: #"\n{3,}"#, with: "\n\n", options: .regularExpression)
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func decodeCommonHTMLEntities(_ text: String) -> String {
        var decoded = text
        let replacements = [
            "&nbsp;": " ",
            "&#160;": " ",
            "&amp;": "&",
            "&lt;": "<",
            "&gt;": ">",
            "&quot;": "\"",
            "&#39;": "'",
            "&#176;": "\u{00B0}",
            "&#8211;": "-",
            "&#8212;": "-",
            "&#8216;": "'",
            "&#8217;": "'",
            "&#8220;": "\"",
            "&#8221;": "\""
        ]
        for (entity, replacement) in replacements {
            decoded = decoded.replacingOccurrences(of: entity, with: replacement)
        }
        return decoded
    }

    private static func normalizedSectionNumber(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "."))
            .uppercased()
    }

    private static func slug(_ value: String) -> String {
        value
            .lowercased()
            .replacingOccurrences(of: #"[^a-z0-9]+"#, with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }
}
