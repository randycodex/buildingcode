import Foundation

protocol CodeReferenceLookup {
    func chapter(chapterNumber: String) throws -> CodeChapter?
    func appendix(letter: String) throws -> CodeChapter?
    func sectionSummary(sectionNumber: String) throws -> CodeSectionSummary?
}

final class AuthoredCodeStore: CodeReferenceLookup, @unchecked Sendable {
    private struct Project: Decodable {
        let schemaVersion: Int
        let nextCodeID: Int64?
        let nextCodeSectionID: Int64?
        let nextChapterID: Int64
        let nextSectionID: Int64
        let jurisdictions: [Jurisdiction]?
        let codes: [Code]?
        let codeSections: [CodeSection]?
        let chapters: [Chapter]
        let tableBlocks: [CodeTableBlock]?
    }

    private struct Jurisdiction: Decodable {
        let id: Int64
        let name: String
    }

    private struct Code: Decodable {
        let id: Int64
        let jurisdictionID: Int64?
        let name: String
    }

    private struct Chapter: Decodable {
        let id: Int64
        let codeID: Int64?
        let codeSectionID: Int64?
        let chapterNumber: String
        let title: String
        let groups: [SectionGroup]
    }

    private struct CodeSection: Decodable {
        let id: Int64
        let codeID: Int64
        let name: String
    }

    private struct SectionGroup: Decodable {
        let id: String
        let headerLine: String
        let headingLine: String?
        let headerRTFData: Data?
        let headingRTFData: Data?
        let sections: [Section]
    }

    private struct Section: Decodable {
        let id: Int64
        let sectionNumber: String
        let title: String
        let officialText: String
        let richTextOverrideData: Data?
        let kind: CodeSectionKind
        let contentBlocks: [CodeContentBlock]

        private enum CodingKeys: String, CodingKey {
            case id
            case sectionNumber
            case title
            case officialText
            case richTextOverrideData
            case kind
            case contentBlocks
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            id = try container.decode(Int64.self, forKey: .id)
            sectionNumber = try container.decode(String.self, forKey: .sectionNumber)
            title = try container.decode(String.self, forKey: .title)
            officialText = try container.decode(String.self, forKey: .officialText)
            richTextOverrideData = try container.decodeIfPresent(Data.self, forKey: .richTextOverrideData)
            kind = try container.decodeIfPresent(CodeSectionKind.self, forKey: .kind) ?? .title
            contentBlocks = try container.decodeIfPresent([CodeContentBlock].self, forKey: .contentBlocks) ?? []
        }
    }

    private struct IndexedSection {
        let chapter: CodeChapter
        let group: CodeSectionGroup
        let section: Section
        let searchHaystack: String
    }

    private let project: Project
    private let codeSectionsCache: [CodeSectionCategory]
    private let chaptersCache: [CodeChapter]
    private let groupsByChapterID: [Int64: [CodeSectionGroup]]
    private let sectionsByChapterID: [Int64: [CodeSectionSummary]]
    private let sectionIndex: [Int64: IndexedSection]
    private let sectionsByChapterIDIndex: [Int64: [Section]]
    private let sectionNumberIndex: [String: CodeSectionSummary]
    private let chapterNumberIndex: [String: CodeChapter]
    private let tableBlocksByID: [String: CodeTableBlock]
    private let authoredHTMLChaptersURL: URL
    private var synthesizedContentBlocksBySectionID: [Int64: [CodeContentBlock]] = [:]
    private var synthesizedChapterNumbers: Set<String> = []
    private let synthesizedContentLock = NSLock()

    init(jsonURL: URL, codeID: Int64? = nil, jurisdictionID: Int64? = nil) throws {
        let data = try Data(contentsOf: jsonURL)
        let decodedProject: Project
        if jsonURL.pathExtension.lowercased() == "plist" {
            decodedProject = try PropertyListDecoder().decode(Project.self, from: data)
        } else {
            decodedProject = try JSONDecoder().decode(Project.self, from: data)
        }
        let visibleCodes = (decodedProject.codes ?? []).filter { code in
            if let codeID {
                return code.id == codeID
            }
            if let jurisdictionID {
                return code.jurisdictionID == jurisdictionID
            }
            return true
        }
        let visibleCodeIDs = Set(visibleCodes.map(\.id))
        let visibleCodeSections = (decodedProject.codeSections ?? []).filter { codeSection in
            if let codeID {
                return codeSection.codeID == codeID
            }
            if !visibleCodeIDs.isEmpty {
                return visibleCodeIDs.contains(codeSection.codeID)
            }
            return true
        }
        let visibleCodeSectionIDs = Set(visibleCodeSections.map(\.id))
        let visibleChapters = decodedProject.chapters.filter { chapter in
            if let codeID {
                if let chapterCodeSectionID = chapter.codeSectionID, !visibleCodeSectionIDs.isEmpty {
                    return visibleCodeSectionIDs.contains(chapterCodeSectionID)
                }
                return chapter.codeID == codeID
            }
            if let chapterCodeSectionID = chapter.codeSectionID, !visibleCodeSectionIDs.isEmpty {
                return visibleCodeSectionIDs.contains(chapterCodeSectionID)
            }
            if !visibleCodeIDs.isEmpty, let chapterCodeID = chapter.codeID {
                return visibleCodeIDs.contains(chapterCodeID)
            }
            return true
        }
        self.project = Project(
            schemaVersion: decodedProject.schemaVersion,
            nextCodeID: decodedProject.nextCodeID,
            nextCodeSectionID: decodedProject.nextCodeSectionID,
            nextChapterID: decodedProject.nextChapterID,
            nextSectionID: decodedProject.nextSectionID,
            jurisdictions: decodedProject.jurisdictions,
            codes: visibleCodes,
            codeSections: visibleCodeSections,
            chapters: visibleChapters,
            tableBlocks: decodedProject.tableBlocks
        )

        var codeSections: [CodeSectionCategory] = []
        var chapters: [CodeChapter] = []
        var groupsByChapterID: [Int64: [CodeSectionGroup]] = [:]
        var sectionsByChapterID: [Int64: [CodeSectionSummary]] = [:]
        var sectionIndex: [Int64: IndexedSection] = [:]
        var sectionsByChapterIDIndex: [Int64: [Section]] = [:]
        var sectionNumberIndex: [String: CodeSectionSummary] = [:]
        var chapterNumberIndex: [String: CodeChapter] = [:]
        let tableBlocksByID = Dictionary(uniqueKeysWithValues: (decodedProject.tableBlocks ?? []).map { ($0.id, $0) })
        let authoredHTMLChaptersURL = jsonURL
            .deletingLastPathComponent()
            .appendingPathComponent("chapters", isDirectory: true)

        for codeSection in visibleCodeSections.sorted(by: { $0.name.compare($1.name, options: [.numeric, .caseInsensitive]) == .orderedAscending }) {
            codeSections.append(
                CodeSectionCategory(
                    id: codeSection.id,
                    codeID: codeSection.codeID,
                    name: codeSection.name
                )
            )
        }

        for chapter in project.chapters.sorted(by: Self.sortChapters) {
            let chapterModel = CodeChapter(
                id: chapter.id,
                codeSectionID: chapter.codeSectionID,
                chapterNumber: chapter.chapterNumber,
                title: chapter.title
            )
            chapters.append(chapterModel)
            chapterNumberIndex[chapter.chapterNumber.uppercased()] = chapterModel

            var chapterSectionList: [Section] = []
            let groups = chapter.groups.map { group in
                let summaries = group.sections.map { section in
                        chapterSectionList.append(section)
                        let summary = CodeSectionSummary(
                            id: section.id,
                            chapterNumber: chapter.chapterNumber,
                            sectionNumber: section.sectionNumber,
                            title: section.title,
                            kind: section.kind
                        )
                        sectionNumberIndex[section.sectionNumber.uppercased()] = summary
                        let haystack = "\(section.sectionNumber) \(section.title) \(section.officialText)".lowercased()
                        sectionIndex[section.id] = IndexedSection(
                            chapter: chapterModel,
                            group: CodeSectionGroup(
                                id: group.id,
                                headerLine: group.headerLine,
                                headingLine: group.headingLine,
                                sections: []
                            ),
                            section: section,
                            searchHaystack: haystack
                        )
                        return summary
                    }

                return CodeSectionGroup(
                    id: group.id,
                    headerLine: group.headerLine,
                    headingLine: group.headingLine,
                    sections: summaries
                )
            }

            groupsByChapterID[chapter.id] = groups
            sectionsByChapterID[chapter.id] = groups.flatMap { $0.sections }
            sectionsByChapterIDIndex[chapter.id] = chapterSectionList
        }

        self.codeSectionsCache = codeSections
        self.chaptersCache = chapters
        self.groupsByChapterID = groupsByChapterID
        self.sectionsByChapterID = sectionsByChapterID
        self.sectionIndex = sectionIndex
        self.sectionsByChapterIDIndex = sectionsByChapterIDIndex
        self.sectionNumberIndex = sectionNumberIndex
        self.chapterNumberIndex = chapterNumberIndex
        self.tableBlocksByID = tableBlocksByID
        self.authoredHTMLChaptersURL = authoredHTMLChaptersURL
    }

    func chapters() -> [CodeChapter] {
        chaptersCache
    }

    func codeSections() -> [CodeSectionCategory] {
        codeSectionsCache
    }

    func chapters(codeSectionID: Int64?) -> [CodeChapter] {
        guard let codeSectionID else { return chaptersCache }
        return chaptersCache.filter { $0.codeSectionID == codeSectionID }
    }

    func sections(chapterID: Int64) -> [CodeSectionSummary] {
        sectionsByChapterID[chapterID] ?? []
    }

    func sectionGroups(chapterID: Int64) -> [CodeSectionGroup] {
        groupsByChapterID[chapterID] ?? []
    }

    func sectionDetail(sectionID: Int64) -> ReaderSectionDetail? {
        guard let indexed = sectionIndex[sectionID] else { return nil }
        let contentBlocks = indexed.section.contentBlocks.isEmpty
            ? synthesizedContentBlocks(for: indexed)
            : indexed.section.contentBlocks
        return ReaderSectionDetail(
            id: indexed.section.id,
            chapterNumber: indexed.chapter.chapterNumber,
            chapterTitle: indexed.chapter.title,
            sectionGroupLabel: indexed.group.displayLabel,
            sectionNumber: indexed.section.sectionNumber,
            title: indexed.section.title,
            officialText: indexed.section.officialText,
            figures: [],
            customDiagrams: [],
            textSpans: [],
            richTextOverrideData: indexed.section.richTextOverrideData,
            kind: indexed.section.kind,
            contentBlocks: contentBlocks,
            tableBlocks: contentBlocks.compactMap { block in
                guard let tableID = block.tableID else { return nil }
                return tableBlocksByID[tableID]
            }
        )
    }

    private func synthesizedContentBlocks(for indexed: IndexedSection) -> [CodeContentBlock] {
        synthesizedContentLock.lock()
        if let cached = synthesizedContentBlocksBySectionID[indexed.section.id] {
            synthesizedContentLock.unlock()
            return cached
        }
        let chapterNumber = indexed.chapter.chapterNumber.uppercased()
        if synthesizedChapterNumbers.contains(chapterNumber) {
            synthesizedContentLock.unlock()
            return []
        }
        synthesizedContentLock.unlock()

        let chapterSections = sectionsByChapterIDIndex[indexed.chapter.id] ?? []
        let chapterBlocks = Self.extractHTMLContentBlocks(
            chapterNumber: indexed.chapter.chapterNumber,
            sections: chapterSections,
            chaptersURL: authoredHTMLChaptersURL
        )

        synthesizedContentLock.lock()
        synthesizedContentBlocksBySectionID.merge(chapterBlocks) { current, _ in current }
        synthesizedChapterNumbers.insert(chapterNumber)
        let blocks = synthesizedContentBlocksBySectionID[indexed.section.id] ?? []
        synthesizedContentLock.unlock()
        return blocks
    }

    func search(query: String) -> [CodeSearchResult] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        let lowercasedQuery = trimmed.lowercased()

        return sectionIndex.values
            .compactMap { indexed in
                guard indexed.searchHaystack.contains(lowercasedQuery) else { return nil }
                return CodeSearchResult(
                    id: indexed.section.id,
                    chapterNumber: indexed.chapter.chapterNumber,
                    sectionNumber: indexed.section.sectionNumber,
                    title: indexed.section.title,
                    snippet: Self.snippet(in: indexed.section.officialText, query: trimmed),
                    kind: indexed.section.kind
                )
            }
            .sorted {
                if $0.chapterNumber == $1.chapterNumber {
                    return $0.sectionNumber.compare($1.sectionNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
                }
                return $0.chapterNumber.compare($1.chapterNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
            }
    }

    func savedSections(
        ids: [Int64],
        codeVersion: String,
        bookmarkedSectionIDs: Set<Int64>,
        notesBySectionID: [Int64: String]
    ) -> [BookmarkedSection] {
        ids.compactMap { id in
            guard let indexed = sectionIndex[id] else { return nil }
            return BookmarkedSection(
                id: indexed.section.id,
                codeVersion: codeVersion,
                chapterNumber: indexed.chapter.chapterNumber,
                chapterTitle: indexed.chapter.title,
                sectionNumber: indexed.section.sectionNumber,
                title: indexed.section.title,
                previewText: indexed.section.officialText.titleThroughFirstPeriod,
                kind: indexed.section.kind,
                isBookmarked: bookmarkedSectionIDs.contains(id),
                noteBody: notesBySectionID[id] ?? ""
            )
        }
        .sorted {
            if $0.chapterNumber == $1.chapterNumber {
                return $0.sectionNumber.compare($1.sectionNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
            }
            return $0.chapterNumber.compare($1.chapterNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
        }
    }

    func chapter(chapterNumber: String) throws -> CodeChapter? {
        chapterNumberIndex[chapterNumber.uppercased()]
    }

    func appendix(letter: String) throws -> CodeChapter? {
        chapterNumberIndex[letter.uppercased()]
    }

    func sectionSummary(sectionNumber: String) throws -> CodeSectionSummary? {
        sectionNumberIndex[sectionNumber.uppercased()]
    }

    private struct HTMLHeading {
        let sectionNumber: String
        let contentStart: Int
        let headingStart: Int
        let wrapperStart: Int
    }

    private static func extractHTMLContentBlocks(
        chapterNumber: String,
        sections: [Section],
        chaptersURL: URL
    ) -> [Int64: [CodeContentBlock]] {
        let htmlURL = chaptersURL.appendingPathComponent("\(chapterNumber).html")
        guard let html = try? String(contentsOf: htmlURL, encoding: .utf8), !html.isEmpty else {
            return [:]
        }

        let headings = htmlHeadings(in: html)
        guard !headings.isEmpty else { return [:] }

        var result: [Int64: [CodeContentBlock]] = [:]
        for section in sections where section.contentBlocks.isEmpty {
            guard let index = headings.firstIndex(where: {
                normalizedSectionNumber($0.sectionNumber) == normalizedSectionNumber(section.sectionNumber)
            }) else {
                continue
            }
            let start = headings[index].contentStart
            let end = index + 1 < headings.count ? headings[index + 1].wrapperStart : html.utf16.count
            guard start < end else { continue }

            let fragment = (html as NSString).substring(with: NSRange(location: start, length: end - start))
            let blocks = htmlContentBlocks(from: fragment, sectionID: section.id)
            if !blocks.isEmpty {
                result[section.id] = blocks
            }
        }

        return result
    }

    private static func htmlHeadings(in html: String) -> [HTMLHeading] {
        let pattern = #"<h6\b[^>]*>\s*([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*)\.?\s*.*?</h6>"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive, .dotMatchesLineSeparators]) else {
            return []
        }
        let nsHTML = html as NSString
        let matches = regex.matches(in: html, range: NSRange(location: 0, length: nsHTML.length))
        return matches.compactMap { match in
            guard match.numberOfRanges > 1 else { return nil }
            let sectionNumber = nsHTML.substring(with: match.range(at: 1))
            let wrapperStart = headingWrapperStart(in: html, headingLocation: match.range.location)
            return HTMLHeading(
                sectionNumber: sectionNumber,
                contentStart: match.range.location + match.range.length,
                headingStart: match.range.location,
                wrapperStart: wrapperStart
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

    private static func htmlContentBlocks(from html: String, sectionID: Int64) -> [CodeContentBlock] {
        var blocks: [CodeContentBlock] = []
        var cursor = html.startIndex
        var ordinal = 0

        while cursor < html.endIndex {
            guard let tableStart = nextTableStart(in: html, from: cursor) else {
                appendTextBlock(
                    html[cursor..<html.endIndex],
                    sectionID: sectionID,
                    ordinal: &ordinal,
                    blocks: &blocks
                )
                break
            }

            appendTextBlock(
                html[cursor..<tableStart],
                sectionID: sectionID,
                ordinal: &ordinal,
                blocks: &blocks
            )

            let tableEnd = matchingTableEnd(in: html, from: tableStart) ?? html.endIndex
            let tableHTML = String(html[tableStart..<tableEnd]).trimmingCharacters(in: .whitespacesAndNewlines)
            if !tableHTML.isEmpty {
                ordinal += 1
                blocks.append(
                    CodeContentBlock(
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
        }

        return blocks
    }

    private static func nextTableStart(in html: String, from cursor: String.Index) -> String.Index? {
        let scrollTable = html.range(of: "<ScrollTable", options: [.caseInsensitive], range: cursor..<html.endIndex)?.lowerBound
        let table = html.range(of: "<table", options: [.caseInsensitive], range: cursor..<html.endIndex)?.lowerBound
        switch (scrollTable, table) {
        case let (lhs?, rhs?):
            return lhs < rhs ? lhs : rhs
        case let (lhs?, nil):
            return lhs
        case let (nil, rhs?):
            return rhs
        case (nil, nil):
            return nil
        }
    }

    private static func matchingTableEnd(in html: String, from start: String.Index) -> String.Index? {
        if html[start...].lowercased().hasPrefix("<scrolltable"),
           let range = html.range(of: "</ScrollTable>", options: [.caseInsensitive], range: start..<html.endIndex) {
            return range.upperBound
        }
        if let range = html.range(of: "</table>", options: [.caseInsensitive], range: start..<html.endIndex) {
            return range.upperBound
        }
        return nil
    }

    private static func appendTextBlock(
        _ html: Substring,
        sectionID: Int64,
        ordinal: inout Int,
        blocks: inout [CodeContentBlock]
    ) {
        let text = plainText(fromHTML: String(html))
        guard !text.isEmpty else { return }
        ordinal += 1
        blocks.append(
            CodeContentBlock(
                id: "\(sectionID)-html-\(ordinal)",
                kind: .html,
                html: String(html),
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
            "&#176;": "°",
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

    private static func sortChapters(_ lhs: Chapter, _ rhs: Chapter) -> Bool {
        let lhsNumeric = Int(lhs.chapterNumber) != nil
        let rhsNumeric = Int(rhs.chapterNumber) != nil
        if lhsNumeric != rhsNumeric {
            return lhsNumeric
        }
        return lhs.chapterNumber.compare(rhs.chapterNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
    }

    private static func snippet(in text: String, query: String) -> String {
        let nsText = text as NSString
        let lowercasedText = text.lowercased()
        let lowercasedQuery = query.lowercased()
        guard let range = lowercasedText.range(of: lowercasedQuery) else {
            return text.titleThroughFirstPeriod
        }

        let location = text.distance(from: text.startIndex, to: range.lowerBound)
        let start = max(0, location - 40)
        let end = min(nsText.length, location + query.utf16.count + 60)
        var snippet = nsText.substring(with: NSRange(location: start, length: end - start))
        if start > 0 {
            snippet = "…" + snippet
        }
        if end < nsText.length {
            snippet += "…"
        }
        return snippet.replacingOccurrences(of: "\n", with: " ")
    }
}
