import Foundation

enum HTMLAuthoringBridge {
    private static let headingRegex = try! NSRegularExpression(
        pattern: #"<(h[1-6])(\s[^>]*)?>([\s\S]*?)</\1>"#,
        options: [.caseInsensitive]
    )
    private static let paragraphRegex = try! NSRegularExpression(
        pattern: #"<(p|li|div|figcaption)(\s[^>]*)?>([\s\S]*?)</\1>"#,
        options: [.caseInsensitive]
    )
    private static let figureRegex = try! NSRegularExpression(
        pattern: #"<figure[^>]*data-table-ref="([^"]+)"[^>]*>\s*</figure>"#,
        options: [.caseInsensitive]
    )
    private static let scrollTableRegex = try! NSRegularExpression(
        pattern: #"<scrolltable\b[^>]*>[\s\S]*?</scrolltable>"#,
        options: [.caseInsensitive]
    )
    private static let tableRegex = try! NSRegularExpression(
        pattern: #"<table\b[^>]*>[\s\S]*?</table>"#,
        options: [.caseInsensitive]
    )
    private static let tableTokenRegex = try! NSRegularExpression(
        pattern: #"\[\[TABLE:\s*[^\]]+\]\]"#,
        options: []
    )
    private static let tagRegex = try! NSRegularExpression(pattern: #"<[^>]+>"#, options: [])
    private static let chapterDefinitionRegex = try! NSRegularExpression(
        pattern: #"(?i)^(chapter|appendix)\s+([A-Z]?\d+[A-Z]?|[A-Z])\s*[:\-]?\s+(.+)$"#,
        options: []
    )
    private static let sectionGroupDefinitionRegex = try! NSRegularExpression(
        pattern: #"(?i)^section\s+(?:(BC|FGC|MC|PC)\s+)?([A-Z0-9.\-()]+)\s*[:\-]?\s*(.+)?$"#,
        options: []
    )
    private static let sectionNumberRegex = try! NSRegularExpression(
        pattern: #"^(?:§\s*)?([A-Z]?\d+(?:-\d+)?(?:\.\d+)+(?:\*|[A-Z])?)\b"#,
        options: []
    )
    private static let appendixKPartRegex = try! NSRegularExpression(
        pattern: #"(?i)^part\s+([ivxlcdm\d]+)\s+(.+)$"#,
        options: []
    )

    static func buildOutline(for document: EditorDocument) -> [OutlineItem] {
        guard document.kind == .html else { return [] }

        let appendixKMode = isAppendixKDocument(document.htmlContent)
        let appendixQMode = isAppendixQDocument(document.htmlContent)
        let nsHTML = document.htmlContent as NSString
        let range = NSRange(location: 0, length: nsHTML.length)
        let headingMatches = headingRegex.matches(in: document.htmlContent, options: [], range: range)
        let paragraphMatches = paragraphRegex.matches(in: document.htmlContent, options: [], range: range)
        let figureMatches = figureRegex.matches(in: document.htmlContent, options: [], range: range)

        var flatItems: [OutlineItem] = []
        var headingCount = 0
        var tableCount = 0

        for match in headingMatches {
            let rawHTML = nsHTML.substring(with: match.range)
            let inner = nsHTML.substring(with: match.range(at: 3))
            let plain = plainText(from: inner)
            let marker = inferredMarkerPrefix(in: plain, appendixKMode: appendixKMode, appendixQMode: appendixQMode)
            let level = outlineLevel(for: marker)
            let title = strippedMarkerText(from: normalizedStructuredHeading(from: plain, appendixKMode: appendixKMode, appendixQMode: appendixQMode))
            headingCount += 1
            flatItems.append(
                OutlineItem(
                    id: "outline-heading-\(headingCount)",
                    documentID: document.id,
                    kind: kind(for: marker, title: title),
                    level: level,
                    sortOrder: match.range.location,
                    title: title,
                    marker: marker,
                    rawHTML: rawHTML,
                    children: []
                )
            )
        }

        for match in paragraphMatches {
            let inner = nsHTML.substring(with: match.range(at: 3))
            guard inner.range(of: #"<h[1-6](\s[^>]*)?>"#, options: [.regularExpression, .caseInsensitive]) == nil else {
                continue
            }

            let plain = plainText(from: inner)
            let normalized = normalizedStructuredHeading(from: plain, appendixKMode: appendixKMode, appendixQMode: appendixQMode)
            guard let marker = markerPrefix(in: normalized) else { continue }

            headingCount += 1
            flatItems.append(
                OutlineItem(
                    id: "outline-heading-\(headingCount)",
                    documentID: document.id,
                    kind: kind(for: marker, title: strippedMarkerText(from: normalized)),
                    level: outlineLevel(for: marker),
                    sortOrder: match.range.location,
                    title: strippedMarkerText(from: normalized),
                    marker: marker,
                    rawHTML: nsHTML.substring(with: match.range),
                    children: []
                )
            )
        }

        for match in figureMatches {
            let tableID = nsHTML.substring(with: match.range(at: 1))
            tableCount += 1
            flatItems.append(
                OutlineItem(
                    id: "outline-table-\(tableCount)",
                    documentID: document.id,
                    kind: .table,
                    level: 4,
                    sortOrder: match.range.location,
                    title: tableID,
                    marker: nil,
                    rawHTML: nsHTML.substring(with: match.range),
                    children: []
                )
            )
        }

        flatItems.sort { lhs, rhs in lhs.sortOrder < rhs.sortOrder }
        return nest(flatItems)
    }

    static func structuredText(from document: EditorDocument) -> String {
        guard document.kind == .html else {
            return document.attributedText.string
        }

        return structuredText(fromHTMLContent: document.htmlContent)
    }

    static func structuredText(fromHTMLContent htmlContent: String) -> String {
        let appendixKMode = isAppendixKDocument(htmlContent)
        let appendixQMode = isAppendixQDocument(htmlContent)
        var html = htmlContent
        html = figureRegex.stringByReplacingMatches(
            in: html,
            options: [],
            range: NSRange(location: 0, length: (html as NSString).length),
            withTemplate: "\n[[TABLE: $1]]\n"
        )
        html = removingRenderedTables(from: html)

        let nsHTML = html as NSString
        let fullRange = NSRange(location: 0, length: nsHTML.length)
        let headingMatches = headingRegex.matches(in: html, options: [], range: fullRange)
        let paragraphMatches = paragraphRegex.matches(in: html, options: [], range: fullRange)

        struct Segment {
            let location: Int
            let text: String
        }

        var segments: [Segment] = []

        for match in headingMatches {
            let inner = nsHTML.substring(with: match.range(at: 3))
            let text = normalizedStructuredHeading(from: plainText(from: inner), appendixKMode: appendixKMode, appendixQMode: appendixQMode)
            guard !text.isEmpty else { continue }
            segments.append(Segment(location: match.range.location, text: text))
        }

        for match in paragraphMatches {
            let inner = nsHTML.substring(with: match.range(at: 3))
            guard inner.range(of: #"<h[1-6](\s[^>]*)?>"#, options: [.regularExpression, .caseInsensitive]) == nil else {
                continue
            }
            let plain = plainText(from: inner)
            let text = normalizedStructuredHeading(from: plain, appendixKMode: appendixKMode, appendixQMode: appendixQMode)
            guard !text.isEmpty else { continue }
            if markerPrefix(in: plain) != nil {
                continue
            }
            guard tableTokenRegex.firstMatch(
                in: text,
                options: [],
                range: NSRange(location: 0, length: (text as NSString).length)
            ) == nil else {
                let textWithoutTableTokens = tableTokenRegex.stringByReplacingMatches(
                    in: text,
                    options: [],
                    range: NSRange(location: 0, length: (text as NSString).length),
                    withTemplate: ""
                )
                .trimmingCharacters(in: .whitespacesAndNewlines)
                if !textWithoutTableTokens.isEmpty {
                    segments.append(Segment(location: match.range.location, text: textWithoutTableTokens))
                }
                continue
            }
            segments.append(Segment(location: match.range.location, text: text))
        }

        for match in tableTokenRegex.matches(in: html, options: [], range: fullRange) {
            let token = nsHTML.substring(with: match.range)
            segments.append(Segment(location: match.range.location, text: token))
        }

        let orderedTexts = segments
            .sorted { $0.location < $1.location }
            .map(\.text)

        return deduplicatedConsecutiveMarkerLines(orderedTexts)
            .joined(separator: "\n\n")
    }

    private static func removingRenderedTables(from html: String) -> String {
        var output = html
        output = scrollTableRegex.stringByReplacingMatches(
            in: output,
            options: [],
            range: NSRange(location: 0, length: (output as NSString).length),
            withTemplate: "\n"
        )
        output = tableRegex.stringByReplacingMatches(
            in: output,
            options: [],
            range: NSRange(location: 0, length: (output as NSString).length),
            withTemplate: "\n"
        )
        return output
    }

    private static func deduplicatedConsecutiveMarkerLines(_ texts: [String]) -> [String] {
        var result: [String] = []
        var previousMarkerLine: String?

        for text in texts {
            let normalized = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if markerPrefix(in: normalized) != nil {
                if normalized == previousMarkerLine {
                    continue
                }
                previousMarkerLine = normalized
            } else if !normalized.isEmpty {
                previousMarkerLine = nil
            }
            result.append(text)
        }

        return result
    }

    private static func kind(for marker: String?, title: String) -> OutlineItem.Kind {
        switch marker {
        case "#-":
            return .chapter
        case "#--":
            return .section
        default:
            if title.hasPrefix("§ ") {
                return .section
            }
            if title.uppercased().hasPrefix("SECTION BC ") {
                return .section
            }
            return .title
        }
    }

    private static func outlineLevel(for marker: String?) -> Int {
        switch marker {
        case "#-":
            return 1
        case "#--":
            return 2
        case "#---":
            return 3
        case "#----":
            return 4
        case "#-----":
            return 5
        case "#------":
            return 6
        case "#-------":
            return 7
        default:
            return 3
        }
    }

    private static func markerPrefix(in text: String) -> String? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let markers = ["#-------", "#------", "#-----", "#----", "#---", "#--", "#-"]
        return markers.first(where: { trimmed.hasPrefix($0 + " ") || trimmed == $0 })
    }

    private static func inferredMarkerPrefix(in text: String, appendixKMode: Bool = false, appendixQMode: Bool = false) -> String? {
        if let explicit = markerPrefix(in: text) {
            return explicit
        }

        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if appendixKMode, parseAppendixKPart(from: trimmed) != nil {
            return "#--"
        }
        if let chapter = parseChapterDefinition(from: trimmed) {
            if appendixQMode {
                return chapter.number.uppercased() == "Q" ? "#-" : nil
            }
            return "#-"
        }
        if let sectionGroup = parseSectionGroupDefinition(from: trimmed) {
            if appendixQMode {
                let normalized = sectionGroup.number
                    .replacingOccurrences(of: #"(?i)^bc\s+"#, with: "", options: .regularExpression)
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .uppercased()
                return normalized.hasPrefix("Q") ? "#--" : nil
            }
            return "#--"
        }
        if let sectionNumber = parseSectionNumber(from: trimmed, appendixQMode: appendixQMode) {
            let depth = sectionNumber.split(separator: ".").count
            switch depth {
            case 2: return "#---"
            case 3: return "#----"
            case 4: return "#-----"
            case 5: return "#------"
            default: return depth >= 6 ? "#-------" : nil
            }
        }

        return nil
    }

    private static func normalizedStructuredHeading(from text: String, appendixKMode: Bool = false, appendixQMode: Bool = false) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard markerPrefix(in: trimmed) == nil else { return trimmed }
        if appendixKMode, let part = parseAppendixKPart(from: trimmed) {
            return "#-- PART \(part.number)\n##### \(part.title)"
        }
        guard let marker = inferredMarkerPrefix(in: trimmed, appendixKMode: appendixKMode, appendixQMode: appendixQMode) else { return trimmed }
        return "\(marker) \(trimmed)"
    }

    private static func strippedMarkerText(from text: String) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let marker = markerPrefix(in: trimmed) else { return trimmed }
        let body = trimmed
            .dropFirst(marker.count)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let lines = body
            .components(separatedBy: .newlines)
            .map { line -> String in
                let lineTrimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
                guard let nestedMarker = markerPrefix(in: lineTrimmed) else { return lineTrimmed }
                return String(lineTrimmed.dropFirst(nestedMarker.count)).trimmingCharacters(in: .whitespacesAndNewlines)
            }
            .filter { !$0.isEmpty }
        return lines.isEmpty ? String(body) : lines.joined(separator: ": ")
    }

    private static func parseChapterDefinition(from line: String) -> (number: String, title: String)? {
        let range = NSRange(location: 0, length: line.utf16.count)
        guard let match = chapterDefinitionRegex.firstMatch(in: line, range: range),
              let kindRange = Range(match.range(at: 1), in: line),
              let numberRange = Range(match.range(at: 2), in: line),
              let titleRange = Range(match.range(at: 3), in: line) else {
            return nil
        }

        _ = String(line[kindRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        let number = String(line[numberRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        let title = String(line[titleRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !number.isEmpty, !title.isEmpty else { return nil }
        return (number, title)
    }

    private static func parseSectionGroupDefinition(from line: String) -> (number: String, title: String?)? {
        let range = NSRange(location: 0, length: line.utf16.count)
        guard let match = sectionGroupDefinitionRegex.firstMatch(in: line, range: range),
              let idRange = Range(match.range(at: 2), in: line) else {
            return nil
        }

        let explicitPrefix: String?
        if match.range(at: 1).location != NSNotFound, let prefixRange = Range(match.range(at: 1), in: line) {
            explicitPrefix = String(line[prefixRange])
        } else {
            explicitPrefix = nil
        }

        var sectionID = String(line[idRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        if let explicitPrefix, !explicitPrefix.isEmpty {
            sectionID = "\(explicitPrefix) \(sectionID)"
        }
        guard !sectionID.isEmpty else { return nil }

        let title: String?
        if match.range(at: 3).location != NSNotFound, let titleRange = Range(match.range(at: 3), in: line) {
            let value = String(line[titleRange]).trimmingCharacters(in: .whitespacesAndNewlines)
            title = value.isEmpty ? nil : value
        } else {
            title = nil
        }

        return (sectionID, title)
    }

    private static func parseSectionNumber(from line: String, appendixQMode: Bool = false) -> String? {
        let range = NSRange(location: 0, length: line.utf16.count)
        guard let match = sectionNumberRegex.firstMatch(in: line, range: range),
              let numberRange = Range(match.range(at: 1), in: line) else {
            return nil
        }

        let number = String(line[numberRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        if appendixQMode, number.first?.uppercased() != "Q" {
            return nil
        }
        return number.isEmpty ? nil : number
    }

    private static func parseAppendixKPart(from line: String) -> (number: String, title: String)? {
        let range = NSRange(location: 0, length: line.utf16.count)
        guard let match = appendixKPartRegex.firstMatch(in: line, range: range),
              let numberRange = Range(match.range(at: 1), in: line),
              let titleRange = Range(match.range(at: 2), in: line) else {
            return nil
        }

        let number = String(line[numberRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        let title = String(line[titleRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !number.isEmpty, !title.isEmpty else { return nil }
        return (number, title)
    }

    private static func isAppendixKDocument(_ htmlContent: String) -> Bool {
        htmlContent.range(of: "Appendix K:", options: [.caseInsensitive]) != nil &&
            htmlContent.range(of: "Chapter K1:", options: [.caseInsensitive]) != nil
    }

    private static func isAppendixQDocument(_ htmlContent: String) -> Bool {
        htmlContent.range(of: "Appendix Q:", options: [.caseInsensitive]) != nil &&
            htmlContent.range(of: "Section BC Q", options: [.caseInsensitive]) != nil
    }

    private static func plainText(from fragment: String) -> String {
        let lineBreakAwareFragment = fragment.replacingOccurrences(
            of: #"(?i)<br\s*/?>"#,
            with: "\n",
            options: .regularExpression
        )
        let withoutTags = tagRegex.stringByReplacingMatches(
            in: lineBreakAwareFragment,
            options: [],
            range: NSRange(location: 0, length: (lineBreakAwareFragment as NSString).length),
            withTemplate: ""
        )

        let decodedEntities = decodeNumericHTMLEntities(in: withoutTags)

        return decodedEntities
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&#160;", with: " ")
            .replacingOccurrences(of: "&sect;", with: "§")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
            .replacingOccurrences(of: "\u{00A0}", with: " ")
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func decodeNumericHTMLEntities(in text: String) -> String {
        var decoded = text

        if let hexRegex = try? NSRegularExpression(pattern: #"&#x([0-9A-Fa-f]+);"#) {
            let nsText = decoded as NSString
            let matches = hexRegex.matches(in: decoded, range: NSRange(location: 0, length: nsText.length)).reversed()
            for match in matches {
                let value = nsText.substring(with: match.range(at: 1))
                guard let scalarValue = UInt32(value, radix: 16),
                      let scalar = UnicodeScalar(scalarValue) else { continue }
                decoded = (decoded as NSString).replacingCharacters(in: match.range, with: String(scalar))
            }
        }

        if let decimalRegex = try? NSRegularExpression(pattern: #"&#([0-9]+);"#) {
            let nsText = decoded as NSString
            let matches = decimalRegex.matches(in: decoded, range: NSRange(location: 0, length: nsText.length)).reversed()
            for match in matches {
                let value = nsText.substring(with: match.range(at: 1))
                guard let scalarValue = UInt32(value),
                      let scalar = UnicodeScalar(scalarValue) else { continue }
                decoded = (decoded as NSString).replacingCharacters(in: match.range, with: String(scalar))
            }
        }

        return decoded
    }

    private static func nest(_ items: [OutlineItem]) -> [OutlineItem] {
        var roots: [OutlineItem] = []
        var stack: [OutlineItem] = []

        for item in items {
            let current = item
            while let last = stack.last, last.level >= current.level {
                let completed = stack.removeLast()
                if stack.isEmpty {
                    roots.append(completed)
                } else {
                    stack[stack.count - 1].children.append(completed)
                }
            }
            stack.append(current)
        }

        while let completed = stack.popLast() {
            if stack.isEmpty {
                roots.append(completed)
            } else {
                stack[stack.count - 1].children.append(completed)
            }
        }

        return roots
    }
}
