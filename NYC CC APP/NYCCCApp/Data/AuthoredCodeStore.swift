import Foundation
import os.signpost

protocol CodeReferenceLookup {
    func chapter(chapterNumber: String) throws -> CodeChapter?
    func appendix(letter: String) throws -> CodeChapter?
    func sectionSummary(sectionNumber: String) throws -> CodeSectionSummary?
}

final class AuthoredCodeStore: CodeReferenceLookup, @unchecked Sendable {
    private struct Project: Decodable {
        let schemaVersion: Int
        let sectionContentSchemaVersion: Int?
        let nextCodeID: Int64?
        let nextCodeSectionID: Int64?
        let nextChapterID: Int64
        let nextSectionID: Int64
        let jurisdictions: [Jurisdiction]?
        let codes: [Code]?
        let codeSections: [CodeSection]?
        let chapters: [Chapter]
        let tableBlocks: [CodeTableBlock]?

        private enum CodingKeys: String, CodingKey {
            case schemaVersion
            case sectionContentSchemaVersion
            case nextCodeID
            case nextCodeSectionID
            case nextChapterID
            case nextSectionID
            case jurisdictions
            case codes
            case codeSections
            case chapters
            case tableBlocks
            case tables
        }

        init(
            schemaVersion: Int,
            sectionContentSchemaVersion: Int?,
            nextCodeID: Int64?,
            nextCodeSectionID: Int64?,
            nextChapterID: Int64,
            nextSectionID: Int64,
            jurisdictions: [Jurisdiction]?,
            codes: [Code]?,
            codeSections: [CodeSection]?,
            chapters: [Chapter],
            tableBlocks: [CodeTableBlock]?
        ) {
            self.schemaVersion = schemaVersion
            self.sectionContentSchemaVersion = sectionContentSchemaVersion
            self.nextCodeID = nextCodeID
            self.nextCodeSectionID = nextCodeSectionID
            self.nextChapterID = nextChapterID
            self.nextSectionID = nextSectionID
            self.jurisdictions = jurisdictions
            self.codes = codes
            self.codeSections = codeSections
            self.chapters = chapters
            self.tableBlocks = tableBlocks
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            try self.init(
                schemaVersion: container.decode(Int.self, forKey: .schemaVersion),
                sectionContentSchemaVersion: container.decodeIfPresent(Int.self, forKey: .sectionContentSchemaVersion),
                nextCodeID: container.decodeIfPresent(Int64.self, forKey: .nextCodeID),
                nextCodeSectionID: container.decodeIfPresent(Int64.self, forKey: .nextCodeSectionID),
                nextChapterID: container.decode(Int64.self, forKey: .nextChapterID),
                nextSectionID: container.decode(Int64.self, forKey: .nextSectionID),
                jurisdictions: container.decodeIfPresent([Jurisdiction].self, forKey: .jurisdictions),
                codes: container.decodeIfPresent([Code].self, forKey: .codes),
                codeSections: container.decodeIfPresent([CodeSection].self, forKey: .codeSections),
                chapters: container.decode([Chapter].self, forKey: .chapters),
                tableBlocks: container.decodeIfPresent([CodeTableBlock].self, forKey: .tableBlocks)
                    ?? container.decodeIfPresent([CodeTableBlock].self, forKey: .tables)
            )
        }
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
            officialText = try container.decodeIfPresent(String.self, forKey: .officialText) ?? ""
            richTextOverrideData = try container.decodeIfPresent(Data.self, forKey: .richTextOverrideData)
            kind = try container.decodeIfPresent(CodeSectionKind.self, forKey: .kind) ?? .title
            contentBlocks = try container.decodeIfPresent([CodeContentBlock].self, forKey: .contentBlocks) ?? []
        }
    }

    private struct IndexedSection {
        let chapter: CodeChapter
        let group: CodeSectionGroup
        let section: Section
    }

    private struct SearchIndexEntry {
        let indexed: IndexedSection
        let searchHaystack: String
    }

    private struct SearchHit {
        let rank: Int
        let result: CodeSearchResult
    }

    private struct PreparedSectionContent: Decodable {
        let schemaVersion: Int
        let sectionID: Int64
        let chapterNumber: String
        let officialText: String?
        let richTextOverrideData: Data?
        let previewText: String?
        let blocks: [CodeContentBlock]
    }

    private struct PreparedSectionData {
        let officialText: String
        let richTextOverrideData: Data?
        let previewText: String
        let blocks: [CodeContentBlock]
    }

    private struct ShippedSearchIndexFile: Decodable {
        let schemaVersion: Int
        let tokens: [String: [Int64]]
    }

    private let project: Project
    private let codeSectionsCache: [CodeSectionCategory]
    private let chaptersCache: [CodeChapter]
    private let groupsByChapterID: [Int64: [CodeSectionGroup]]
    private let sectionsByChapterID: [Int64: [CodeSectionSummary]]
    private let sectionIndex: [Int64: IndexedSection]
    private let indexedSections: [IndexedSection]
    private let indexedSectionsByCodeSectionID: [Int64: [IndexedSection]]
    private var indexedSearchSections: [SearchIndexEntry]?
    private var indexedSearchSectionsByCodeSectionID: [Int64: [SearchIndexEntry]] = [:]
    private var invertedIndex: [String: Set<Int64>]?
    private var invertedIndexByCodeSection: [Int64: [String: Set<Int64>]] = [:]
    private let searchIndexLock = NSLock()
    private let codeSectionNameByID: [Int64: String]
    private let sectionsByChapterIDIndex: [Int64: [Section]]
    private let sectionNumberIndex: [String: CodeSectionSummary]
    private let chapterNumberIndex: [String: CodeChapter]
    private let tableBlocksByID: [String: CodeTableBlock]
    private let authoredHTMLChaptersURL: URL
    private let preparedSectionsURL: URL
    private var preparedContentBlocksBySectionID: [Int64: [CodeContentBlock]] = [:]
    private var preparedSectionDataBySectionID: [Int64: PreparedSectionData] = [:]
    private var previewTextBySectionID: [Int64: String] = [:]
    private var missingPreparedSectionIDs: Set<Int64> = []
    private let preparedContentLock = NSLock()
    private let bundleUsesExternalSectionText: Bool
    private var shippedSearchIndex: [String: Set<Int64>]?
    private var shippedSearchIndexByCodeSectionID: [Int64: [String: Set<Int64>]] = [:]
    private var synthesizedContentBlocksBySectionID: [Int64: [CodeContentBlock]] = [:]
    private var synthesizedChapterNumbers: Set<String> = []
    private let synthesizedContentLock = NSLock()

    init(jsonURL: URL, codeID: Int64? = nil, jurisdictionID: Int64? = nil) throws {
        let signpostID = OSSignpostID(log: AppSignpost.bundle)
        os_signpost(.begin, log: AppSignpost.bundle, name: "bundleParse", signpostID: signpostID)
        defer { os_signpost(.end, log: AppSignpost.bundle, name: "bundleParse", signpostID: signpostID) }

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
        bundleUsesExternalSectionText = (decodedProject.sectionContentSchemaVersion ?? 1) >= 2
        self.project = Project(
            schemaVersion: decodedProject.schemaVersion,
            sectionContentSchemaVersion: decodedProject.sectionContentSchemaVersion,
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
        var indexedSections: [IndexedSection] = []
        var indexedSectionsByCodeSectionID: [Int64: [IndexedSection]] = [:]
        var sectionsByChapterIDIndex: [Int64: [Section]] = [:]
        var sectionNumberIndex: [String: CodeSectionSummary] = [:]
        var chapterNumberIndex: [String: CodeChapter] = [:]
        let tableBlocksByID = Dictionary(uniqueKeysWithValues: (decodedProject.tableBlocks ?? []).map { ($0.id, $0) })
        let authoredHTMLChaptersURL = jsonURL
            .deletingLastPathComponent()
            .appendingPathComponent("chapters", isDirectory: true)
        let preparedSectionsURL = jsonURL
            .deletingLastPathComponent()
            .appendingPathComponent("prepared", isDirectory: true)
            .appendingPathComponent("sections", isDirectory: true)

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
                        let indexed = IndexedSection(
                            chapter: chapterModel,
                            group: CodeSectionGroup(
                                id: group.id,
                                headerLine: group.headerLine,
                                headingLine: group.headingLine,
                                sections: []
                            ),
                            section: section
                        )
                        sectionIndex[section.id] = indexed
                        indexedSections.append(indexed)
                        if let codeSectionID = chapterModel.codeSectionID {
                            indexedSectionsByCodeSectionID[codeSectionID, default: []].append(indexed)
                        }
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
        self.indexedSections = indexedSections
        self.indexedSectionsByCodeSectionID = indexedSectionsByCodeSectionID
        self.codeSectionNameByID = Dictionary(uniqueKeysWithValues: codeSections.map { ($0.id, $0.name) })
        self.sectionsByChapterIDIndex = sectionsByChapterIDIndex
        self.sectionNumberIndex = sectionNumberIndex
        self.chapterNumberIndex = chapterNumberIndex
        self.tableBlocksByID = tableBlocksByID
        self.authoredHTMLChaptersURL = authoredHTMLChaptersURL
        self.preparedSectionsURL = preparedSectionsURL
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
        let preparedData = bundleUsesExternalSectionText ? preparedSectionData(sectionID: sectionID) : nil
        let contentBlocks: [CodeContentBlock]
        if !indexed.section.contentBlocks.isEmpty {
            contentBlocks = indexed.section.contentBlocks
        } else if let preparedBlocks = preparedData?.blocks, !preparedBlocks.isEmpty {
            contentBlocks = preparedBlocks
        } else if let preparedBlocks = preparedContentBlocks(sectionID: indexed.section.id) {
            contentBlocks = preparedBlocks
        } else {
            contentBlocks = synthesizedContentBlocks(for: indexed)
        }
        let officialText = preparedData?.officialText ?? indexed.section.officialText
        let richTextOverrideData = preparedData?.richTextOverrideData ?? indexed.section.richTextOverrideData
        return ReaderSectionDetail(
            id: indexed.section.id,
            codeSectionID: indexed.chapter.codeSectionID,
            chapterNumber: indexed.chapter.chapterNumber,
            chapterTitle: indexed.chapter.title,
            sectionGroupLabel: indexed.group.displayLabel,
            sectionNumber: indexed.section.sectionNumber,
            title: indexed.section.title,
            officialText: officialText,
            figures: [],
            customDiagrams: [],
            textSpans: [],
            richTextOverrideData: richTextOverrideData,
            kind: indexed.section.kind,
            contentBlocks: contentBlocks,
            tableBlocks: contentBlocks.compactMap { block in
                guard let tableID = block.tableID else { return nil }
                return tableBlocksByID[tableID]
            }
        )
    }

    private func preparedSectionData(sectionID: Int64) -> PreparedSectionData? {
        preparedContentLock.lock()
        if let cached = preparedSectionDataBySectionID[sectionID] {
            preparedContentLock.unlock()
            return cached
        }
        if missingPreparedSectionIDs.contains(sectionID) {
            preparedContentLock.unlock()
            return nil
        }
        preparedContentLock.unlock()

        let url = preparedSectionsURL.appendingPathComponent("\(sectionID).json", isDirectory: false)
        guard let data = try? Data(contentsOf: url),
              let prepared = try? JSONDecoder().decode(PreparedSectionContent.self, from: data),
              prepared.sectionID == sectionID else {
            preparedContentLock.lock()
            missingPreparedSectionIDs.insert(sectionID)
            preparedContentLock.unlock()
            return nil
        }

        let officialText = prepared.officialText ?? ""
        let previewText = prepared.previewText ?? officialText.titleThroughFirstPeriod
        let sectionData = PreparedSectionData(
            officialText: officialText,
            richTextOverrideData: prepared.richTextOverrideData,
            previewText: previewText,
            blocks: prepared.blocks
        )

        preparedContentLock.lock()
        preparedSectionDataBySectionID[sectionID] = sectionData
        previewTextBySectionID[sectionID] = previewText
        if !prepared.blocks.isEmpty {
            preparedContentBlocksBySectionID[sectionID] = prepared.blocks
        }
        preparedContentLock.unlock()
        return sectionData
    }

    private func preparedContentBlocks(sectionID: Int64) -> [CodeContentBlock]? {
        if bundleUsesExternalSectionText {
            guard let prepared = preparedSectionData(sectionID: sectionID), !prepared.blocks.isEmpty else {
                return nil
            }
            return prepared.blocks
        }

        preparedContentLock.lock()
        if let cached = preparedContentBlocksBySectionID[sectionID] {
            preparedContentLock.unlock()
            return cached
        }
        if missingPreparedSectionIDs.contains(sectionID) {
            preparedContentLock.unlock()
            return nil
        }
        preparedContentLock.unlock()

        let url = preparedSectionsURL.appendingPathComponent("\(sectionID).json", isDirectory: false)
        guard let data = try? Data(contentsOf: url),
              let prepared = try? JSONDecoder().decode(PreparedSectionContent.self, from: data),
              prepared.schemaVersion == 1,
              prepared.sectionID == sectionID,
              !prepared.blocks.isEmpty else {
            preparedContentLock.lock()
            missingPreparedSectionIDs.insert(sectionID)
            preparedContentLock.unlock()
            return nil
        }

        preparedContentLock.lock()
        preparedContentBlocksBySectionID[sectionID] = prepared.blocks
        preparedContentLock.unlock()
        return prepared.blocks
    }

    private func officialText(for indexed: IndexedSection) -> String {
        if bundleUsesExternalSectionText {
            return preparedSectionData(sectionID: indexed.section.id)?.officialText ?? indexed.section.officialText
        }
        return indexed.section.officialText
    }

    private func previewText(for sectionID: Int64, fallbackOfficialText: String) -> String {
        preparedContentLock.lock()
        if let cached = previewTextBySectionID[sectionID] {
            preparedContentLock.unlock()
            return cached
        }
        preparedContentLock.unlock()

        if bundleUsesExternalSectionText, let prepared = preparedSectionData(sectionID: sectionID) {
            return prepared.previewText
        }
        return fallbackOfficialText.titleThroughFirstPeriod
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
            codeSectionName: indexed.chapter.codeSectionID.flatMap { codeSectionNameByID[$0] },
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

    func search(query: String, codeSectionID: Int64? = nil) -> [CodeSearchResult] {
        let signpostID = OSSignpostID(log: AppSignpost.search)
        os_signpost(.begin, log: AppSignpost.search, name: "search", signpostID: signpostID)
        defer { os_signpost(.end, log: AppSignpost.search, name: "search", signpostID: signpostID) }

        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        let lowercasedQuery = trimmed.lowercased()
        let queryTokens = Self.tokenize(trimmed)
        guard !queryTokens.isEmpty else { return [] }

        let index = invertedIndex(for: codeSectionID)
        var candidateIDs = index[queryTokens[0]] ?? []
        for token in queryTokens.dropFirst() {
            candidateIDs.formIntersection(index[token] ?? [])
            if candidateIDs.isEmpty { break }
        }

        if trimmed.range(of: #"^[A-Za-z]?\d"#, options: .regularExpression) != nil {
            for (token, sectionIDs) in index where token.hasPrefix(lowercasedQuery) {
                candidateIDs.formUnion(sectionIDs)
            }
        }

        let entriesByID = Dictionary(uniqueKeysWithValues: searchCandidates(codeSectionID: codeSectionID).map {
            ($0.indexed.section.id, $0)
        })

        let hits: [SearchHit] = candidateIDs
            .compactMap { sectionID -> SearchHit? in
                guard let entry = entriesByID[sectionID] else { return nil }
                let indexed = entry.indexed
                let sectionNumber = indexed.section.sectionNumber.lowercased()
                let title = indexed.section.title.lowercased()
                let rank: Int
                if sectionNumber == lowercasedQuery {
                    rank = 0
                } else if sectionNumber.hasPrefix(lowercasedQuery) {
                    rank = 1
                } else if title.contains(lowercasedQuery) {
                    rank = 2
                } else {
                    rank = 3
                }
                return SearchHit(
                    rank: rank,
                    result: CodeSearchResult(
                        id: indexed.section.id,
                        codeSectionID: indexed.chapter.codeSectionID,
                        chapterNumber: indexed.chapter.chapterNumber,
                        sectionNumber: indexed.section.sectionNumber,
                        title: indexed.section.title,
                        snippet: Self.snippet(in: officialText(for: indexed), query: trimmed),
                        kind: indexed.section.kind
                    )
                )
            }
            .sorted { lhs, rhs in
                if lhs.rank != rhs.rank {
                    return lhs.rank < rhs.rank
                }
                if lhs.result.chapterNumber == rhs.result.chapterNumber {
                    return lhs.result.sectionNumber.compare(rhs.result.sectionNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
                }
                return lhs.result.chapterNumber.compare(rhs.result.chapterNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
            }

        return Array(hits.prefix(200).map(\.result))
    }

    private func searchCandidates(codeSectionID: Int64?) -> [SearchIndexEntry] {
        if let codeSectionID {
            searchIndexLock.lock()
            if let cached = indexedSearchSectionsByCodeSectionID[codeSectionID] {
                searchIndexLock.unlock()
                return cached
            }
            searchIndexLock.unlock()

            let entries = Self.buildSearchEntries(
                from: indexedSectionsByCodeSectionID[codeSectionID] ?? [],
                includeOfficialText: !bundleUsesExternalSectionText
            )

            searchIndexLock.lock()
            if indexedSearchSectionsByCodeSectionID[codeSectionID] == nil {
                indexedSearchSectionsByCodeSectionID[codeSectionID] = entries
            }
            let cached = indexedSearchSectionsByCodeSectionID[codeSectionID] ?? entries
            searchIndexLock.unlock()
            return cached
        }

        searchIndexLock.lock()
        if let cached = indexedSearchSections {
            searchIndexLock.unlock()
            return cached
        }
        searchIndexLock.unlock()

        let entries = Self.buildSearchEntries(
            from: indexedSections,
            includeOfficialText: !bundleUsesExternalSectionText
        )

        searchIndexLock.lock()
        if indexedSearchSections == nil {
            indexedSearchSections = entries
        }
        let cached = indexedSearchSections ?? entries
        searchIndexLock.unlock()
        return cached
    }

    private static func buildSearchEntries(
        from sections: [IndexedSection],
        includeOfficialText: Bool = true
    ) -> [SearchIndexEntry] {
        sections.map { indexed in
            let haystack: String
            if includeOfficialText {
                haystack = "\(indexed.section.sectionNumber) \(indexed.section.title) \(indexed.section.officialText)".lowercased()
            } else {
                haystack = "\(indexed.section.sectionNumber) \(indexed.section.title)".lowercased()
            }
            return SearchIndexEntry(indexed: indexed, searchHaystack: haystack)
        }
    }

    private func invertedIndex(for codeSectionID: Int64?) -> [String: Set<Int64>] {
        if bundleUsesExternalSectionText {
            return shippedInvertedIndex(codeSectionID: codeSectionID)
        }

        if let codeSectionID {
            searchIndexLock.lock()
            if let cached = invertedIndexByCodeSection[codeSectionID] {
                searchIndexLock.unlock()
                return cached
            }
            searchIndexLock.unlock()

            let sections = indexedSectionsByCodeSectionID[codeSectionID] ?? []
            let entries = Self.buildSearchEntries(from: sections, includeOfficialText: !bundleUsesExternalSectionText)
            let index = Self.buildInvertedIndex(from: entries)

            searchIndexLock.lock()
            invertedIndexByCodeSection[codeSectionID] = index
            if indexedSearchSectionsByCodeSectionID[codeSectionID] == nil {
                indexedSearchSectionsByCodeSectionID[codeSectionID] = entries
            }
            searchIndexLock.unlock()
            return index
        }

        searchIndexLock.lock()
        if let cached = invertedIndex {
            searchIndexLock.unlock()
            return cached
        }
        searchIndexLock.unlock()

        let entries = Self.buildSearchEntries(from: indexedSections, includeOfficialText: !bundleUsesExternalSectionText)
        let index = Self.buildInvertedIndex(from: entries)

        searchIndexLock.lock()
        invertedIndex = index
        if indexedSearchSections == nil {
            indexedSearchSections = entries
        }
        searchIndexLock.unlock()
        return index
    }

    private static func tokenize(_ text: String) -> [String] {
        var tokens: [String] = []
        var current = ""

        func flush() {
            guard current.count >= 2 else {
                current = ""
                return
            }
            tokens.append(current)
            current = ""
        }

        for character in text.lowercased() {
            if character.isWhitespace {
                flush()
            } else if character.isLetter || character.isNumber || character == "." || character == "-" {
                current.append(character)
            } else {
                flush()
            }
        }
        flush()
        return tokens
    }

    private func shippedInvertedIndex(codeSectionID: Int64?) -> [String: Set<Int64>] {
        if let codeSectionID {
            searchIndexLock.lock()
            if let cached = shippedSearchIndexByCodeSectionID[codeSectionID] {
                searchIndexLock.unlock()
                return cached
            }
            searchIndexLock.unlock()

            let baseIndex = loadShippedSearchIndex()
            let sectionIDs = Set((indexedSectionsByCodeSectionID[codeSectionID] ?? []).map(\.section.id))
            var filtered: [String: Set<Int64>] = [:]
            filtered.reserveCapacity(baseIndex.count)
            for (token, ids) in baseIndex {
                let matches = ids.intersection(sectionIDs)
                if !matches.isEmpty {
                    filtered[token] = matches
                }
            }

            searchIndexLock.lock()
            shippedSearchIndexByCodeSectionID[codeSectionID] = filtered
            searchIndexLock.unlock()
            return filtered
        }

        return loadShippedSearchIndex()
    }

    private func loadShippedSearchIndex() -> [String: Set<Int64>] {
        searchIndexLock.lock()
        if let cached = shippedSearchIndex {
            searchIndexLock.unlock()
            return cached
        }
        searchIndexLock.unlock()

        let url = preparedSectionsURL
            .deletingLastPathComponent()
            .appendingPathComponent("searchIndex.json", isDirectory: false)
        guard let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode(ShippedSearchIndexFile.self, from: data) else {
            return [:]
        }

        let index = decoded.tokens.mapValues { Set($0) }
        searchIndexLock.lock()
        shippedSearchIndex = index
        searchIndexLock.unlock()
        return index
    }

    private static func buildInvertedIndex(from entries: [SearchIndexEntry]) -> [String: Set<Int64>] {
        var index: [String: Set<Int64>] = [:]
        for entry in entries {
            let sectionID = entry.indexed.section.id
            let tokens = tokenize(entry.searchHaystack)
            for token in tokens {
                index[token, default: []].insert(sectionID)
            }
        }
        return index
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
                codeSectionID: indexed.chapter.codeSectionID,
                chapterNumber: indexed.chapter.chapterNumber,
                chapterTitle: indexed.chapter.title,
                sectionNumber: indexed.section.sectionNumber,
                title: indexed.section.title,
                previewText: previewText(for: indexed.section.id, fallbackOfficialText: indexed.section.officialText),
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
        codeSectionName: String?,
        sections: [Section],
        chaptersURL: URL
    ) -> [Int64: [CodeContentBlock]] {
        guard let htmlURL = chapterHTMLURL(
            chapterNumber: chapterNumber,
            codeSectionName: codeSectionName,
            chaptersURL: chaptersURL
        ) else {
            return [:]
        }
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

    private static func chapterHTMLURL(
        chapterNumber: String,
        codeSectionName: String?,
        chaptersURL: URL
    ) -> URL? {
        let fileName = "\(chapterNumber).html"
        let flatURL = chaptersURL.appendingPathComponent(fileName, isDirectory: false)
        if FileManager.default.fileExists(atPath: flatURL.path) {
            return flatURL
        }

        guard let codeSectionName else { return nil }
        let sectionedURL = chaptersURL
            .deletingLastPathComponent()
            .appendingPathComponent("code-sections", isDirectory: true)
            .appendingPathComponent(slug(codeSectionName), isDirectory: true)
            .appendingPathComponent("chapters", isDirectory: true)
            .appendingPathComponent(fileName, isDirectory: false)
        if FileManager.default.fileExists(atPath: sectionedURL.path) {
            return sectionedURL
        }

        return nil
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
            guard let richStart = nextRichBlockStart(in: html, from: cursor) else {
                appendTextBlock(
                    html[cursor..<html.endIndex],
                    sectionID: sectionID,
                    ordinal: &ordinal,
                    blocks: &blocks
                )
                break
            }

            appendTextBlock(
                html[cursor..<richStart],
                sectionID: sectionID,
                ordinal: &ordinal,
                blocks: &blocks
            )

            if isTableStart(in: html, at: richStart) {
                let tableEnd = matchingTableEnd(in: html, from: richStart) ?? html.endIndex
                let tableHTML = String(html[richStart..<tableEnd]).trimmingCharacters(in: .whitespacesAndNewlines)
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
            } else {
                let imageEnd = matchingImageEnd(in: html, from: richStart) ?? html.index(after: richStart)
                let imageHTML = String(html[richStart..<imageEnd]).trimmingCharacters(in: .whitespacesAndNewlines)
                if let imageID = imageSourceID(in: imageHTML) {
                    ordinal += 1
                    blocks.append(
                        CodeContentBlock(
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
                    appendTextBlock(
                        html[richStart..<imageEnd],
                        sectionID: sectionID,
                        ordinal: &ordinal,
                        blocks: &blocks
                    )
                }
                cursor = imageEnd
            }
        }

        return blocks
    }

    private static func nextRichBlockStart(in html: String, from cursor: String.Index) -> String.Index? {
        [nextTableStart(in: html, from: cursor), nextImageStart(in: html, from: cursor)]
            .compactMap { $0 }
            .min()
    }

    private static func isTableStart(in html: String, at index: String.Index) -> Bool {
        let lowercased = html[index...].lowercased()
        return lowercased.hasPrefix("<scrolltable") || lowercased.hasPrefix("<table")
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

    private static func slug(_ value: String) -> String {
        value
            .lowercased()
            .replacingOccurrences(of: #"[^a-z0-9]+"#, with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
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
        let range = lowercasedText.range(of: lowercasedQuery)
            ?? lowercasedQuery
                .split(whereSeparator: { $0.isWhitespace })
                .lazy
                .compactMap { lowercasedText.range(of: String($0)) }
                .first
        guard let range else {
            return text.titleThroughFirstPeriod
        }

        let location = text.distance(from: text.startIndex, to: range.lowerBound)
        let start = max(0, location - 40)
        let matchedLength = text.distance(from: range.lowerBound, to: range.upperBound)
        let end = min(nsText.length, location + matchedLength + 60)
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
