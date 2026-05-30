import Foundation
import SQLite3

final class CodeDatabase: CodeReferenceLookup, @unchecked Sendable {
    private let connection: SQLiteConnection
    private let locator: BundleDatabaseLocator
    private lazy var hasEditorSectionGroupsTable: Bool = {
        (try? tableExists(named: "editor_section_groups")) ?? false
    }()
    private var editorSectionGroupMetadataCache: [Int64: [String: (headerLine: String, headingLine: String?)]] = [:]

    init(databaseURL: URL, locator: BundleDatabaseLocator) throws {
        self.connection = try SQLiteConnection(path: databaseURL.path, readOnly: true)
        self.locator = locator
    }

    func chapters() throws -> [CodeChapter] {
        let statement = try connection.prepare(
            """
            SELECT id, chapter_number, title
            FROM chapters
            ORDER BY
                CASE WHEN chapter_number GLOB '[0-9]*' THEN 0 ELSE 1 END,
                CAST(chapter_number AS INTEGER),
                chapter_number;
            """
        )
        defer { connection.finalize(statement) }

        var chapters: [CodeChapter] = []
        while try connection.step(statement) == SQLITE_ROW {
            chapters.append(
                CodeChapter(
                    id: connection.int64(at: 0, in: statement),
                    codeSectionID: nil,
                    chapterNumber: connection.string(at: 1, in: statement),
                    title: connection.string(at: 2, in: statement)
                )
            )
        }
        return chapters
    }

    func sections(chapterID: Int64) throws -> [CodeSectionSummary] {
        let statement = try connection.prepare(
            """
            SELECT sections.id, chapters.chapter_number, sections.section_number, sections.title
            FROM sections
            JOIN chapters ON chapters.id = sections.chapter_id
            WHERE chapter_id = ?
            ORDER BY sort_key, section_number;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, chapterID)

        var items: [CodeSectionSummary] = []
        while try connection.step(statement) == SQLITE_ROW {
            items.append(
                CodeSectionSummary(
                    id: connection.int64(at: 0, in: statement),
                    chapterNumber: connection.string(at: 1, in: statement),
                    sectionNumber: connection.string(at: 2, in: statement),
                    title: connection.string(at: 3, in: statement)
                )
            )
        }
        return items
    }

    func sectionGroups(chapterID: Int64) throws -> [CodeSectionGroup] {
        let statement = try connection.prepare(
            """
            SELECT sections.id,
                   chapters.chapter_number,
                   sections.section_number,
                   sections.title
            FROM sections
            JOIN chapters ON chapters.id = sections.chapter_id
            WHERE chapter_id = ?
            ORDER BY sort_key, section_number;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, chapterID)

        let persistedMetadata = try editorSectionGroupMetadata(chapterID: chapterID)
        var groupedSections: [CodeSectionGroup] = []
        var indicesByGroupID: [String: Int] = [:]

        while try connection.step(statement) == SQLITE_ROW {
            let summary = CodeSectionSummary(
                id: connection.int64(at: 0, in: statement),
                chapterNumber: connection.string(at: 1, in: statement),
                sectionNumber: connection.string(at: 2, in: statement),
                title: connection.string(at: 3, in: statement)
            )
            let groupID = summary.sectionNumber.topLevelSectionIdentifier

            if let index = indicesByGroupID[groupID] {
                let existing = groupedSections[index]
                var sections = existing.sections
                sections.append(summary)
                groupedSections[index] = CodeSectionGroup(
                    id: existing.id,
                    headerLine: existing.headerLine,
                    headingLine: existing.headingLine,
                    sections: sections
                )
            } else {
                let metadata: (headerLine: String, headingLine: String?)
                if let persisted = persistedMetadata[groupID] {
                    metadata = persisted
                } else {
                    let officialText = try officialText(sectionID: summary.id)
                    metadata = inferredGroupMetadata(from: officialText, fallbackGroupID: groupID)
                }
                groupedSections.append(
                    CodeSectionGroup(
                        id: groupID,
                        headerLine: metadata.headerLine,
                        headingLine: metadata.headingLine,
                        sections: [summary]
                    )
                )
                indicesByGroupID[groupID] = groupedSections.count - 1
            }
        }

        return groupedSections
    }

    func firstSectionIDs(chapterIDs: [Int64]) throws -> [Int64] {
        var ids: [Int64] = []
        ids.reserveCapacity(chapterIDs.count)

        for chapterID in chapterIDs {
            let statement = try connection.prepare(
                """
                SELECT id
                FROM sections
                WHERE chapter_id = ?
                ORDER BY sort_key, section_number
                LIMIT 1;
                """
            )
            defer { connection.finalize(statement) }
            sqlite3_bind_int64(statement, 1, chapterID)
            if try connection.step(statement) == SQLITE_ROW {
                ids.append(connection.int64(at: 0, in: statement))
            }
        }

        return ids
    }

    func sectionDetail(sectionID: Int64) throws -> ReaderSectionDetail? {
        let statement = try connection.prepare(
            """
            SELECT sections.id,
                   chapters.chapter_number,
                   chapters.title,
                   sections.chapter_id,
                   sections.section_number,
                   sections.title,
                   sections.official_text
            FROM sections
            JOIN chapters ON chapters.id = sections.chapter_id
            WHERE sections.id = ?
            LIMIT 1;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, sectionID)

        guard try connection.step(statement) == SQLITE_ROW else {
            return nil
        }

        let id = connection.int64(at: 0, in: statement)
        let chapterNumber = connection.string(at: 1, in: statement)
        let chapterTitle = connection.string(at: 2, in: statement)
        let chapterID = connection.int64(at: 3, in: statement)
        let sectionNumber = connection.string(at: 4, in: statement)
        let title = connection.string(at: 5, in: statement)
        let officialText = connection.string(at: 6, in: statement)
        let sectionGroupLabel = try sectionGroupLabel(
            chapterID: chapterID,
            sectionNumber: sectionNumber,
            officialText: officialText
        )

        return ReaderSectionDetail(
            id: id,
            chapterNumber: chapterNumber,
            chapterTitle: chapterTitle,
            sectionGroupLabel: sectionGroupLabel,
            sectionNumber: sectionNumber,
            title: title,
            officialText: officialText,
            figures: try figures(for: sectionID),
            customDiagrams: try customDiagrams(for: sectionID),
            textSpans: try textSpans(for: sectionID),
            richTextOverrideData: (try? richTextOverride(for: sectionID)) ?? nil
        )
    }

    private func officialText(sectionID: Int64) throws -> String {
        let statement = try connection.prepare(
            """
            SELECT official_text
            FROM sections
            WHERE id = ?
            LIMIT 1;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, sectionID)
        guard try connection.step(statement) == SQLITE_ROW else { return "" }
        return connection.string(at: 0, in: statement)
    }

    func search(query: String) throws -> [CodeSearchResult] {
        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return []
        }

        let statement = try connection.prepare(
            """
            SELECT DISTINCT sections.id,
                            chapters.chapter_number,
                            sections.section_number,
                            sections.title,
                            snippet(fts_paragraphs, 0, '[', ']', '…', 14)
            FROM fts_paragraphs
            JOIN sections ON sections.section_number = fts_paragraphs.section_number
            JOIN chapters ON chapters.id = sections.chapter_id
            WHERE fts_paragraphs MATCH ?
            ORDER BY rank
            LIMIT 200;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: query, index: 1, to: statement)

        var results: [CodeSearchResult] = []
        while try connection.step(statement) == SQLITE_ROW {
            results.append(
                CodeSearchResult(
                    id: connection.int64(at: 0, in: statement),
                    chapterNumber: connection.string(at: 1, in: statement),
                    sectionNumber: connection.string(at: 2, in: statement),
                    title: connection.string(at: 3, in: statement),
                    snippet: connection.string(at: 4, in: statement)
                )
            )
        }
        return results
    }

    func savedSections(
        ids: [Int64],
        codeVersion: String,
        bookmarkedSectionIDs: Set<Int64>,
        notesBySectionID: [Int64: String],
        tagsBySectionID: [Int64: [String]] = [:],
        bookmarkCreatedAtBySectionID: [Int64: Date] = [:]
    ) throws -> [BookmarkedSection] {
        guard !ids.isEmpty else { return [] }
        let placeholders = ids.map { _ in "?" }.joined(separator: ",")
        let statement = try connection.prepare(
            """
            SELECT sections.id, chapters.chapter_number, chapters.title, sections.section_number, sections.title, sections.official_text
            FROM sections
            JOIN chapters ON chapters.id = sections.chapter_id
            WHERE sections.id IN (\(placeholders))
            ORDER BY chapters.chapter_number, sections.sort_key;
            """
        )
        defer { connection.finalize(statement) }
        for (index, id) in ids.enumerated() {
            sqlite3_bind_int64(statement, Int32(index + 1), id)
        }

        var items: [BookmarkedSection] = []
        while try connection.step(statement) == SQLITE_ROW {
            items.append(
                BookmarkedSection(
                    id: connection.int64(at: 0, in: statement),
                    codeVersion: codeVersion,
                    chapterNumber: connection.string(at: 1, in: statement),
                    chapterTitle: connection.string(at: 2, in: statement),
                    sectionNumber: connection.string(at: 3, in: statement),
                    title: connection.string(at: 4, in: statement),
                    previewText: connection.string(at: 5, in: statement).titleThroughFirstPeriod,
                    isBookmarked: bookmarkedSectionIDs.contains(connection.int64(at: 0, in: statement)),
                    noteBody: notesBySectionID[connection.int64(at: 0, in: statement)] ?? "",
                    tags: tagsBySectionID[connection.int64(at: 0, in: statement)] ?? [],
                    bookmarkedAt: bookmarkCreatedAtBySectionID[connection.int64(at: 0, in: statement)]
                )
            )
        }
        return items
    }

    func imageURL(fileName: String) -> URL? {
        locator.resourceURL(named: fileName)
    }

    func chapter(chapterNumber: String) throws -> CodeChapter? {
        let statement = try connection.prepare(
            """
            SELECT id, chapter_number, title
            FROM chapters
            WHERE UPPER(chapter_number) = UPPER(?)
            LIMIT 1;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: chapterNumber, index: 1, to: statement)
        guard try connection.step(statement) == SQLITE_ROW else { return nil }
        return CodeChapter(
            id: connection.int64(at: 0, in: statement),
            codeSectionID: nil,
            chapterNumber: connection.string(at: 1, in: statement),
            title: connection.string(at: 2, in: statement)
        )
    }

    func appendix(letter: String) throws -> CodeChapter? {
        let statement = try connection.prepare(
            """
            SELECT id, chapter_number, title
            FROM chapters
            WHERE UPPER(chapter_number) = UPPER(?)
              AND UPPER(title) LIKE 'APPENDIX%'
            LIMIT 1;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: letter, index: 1, to: statement)
        guard try connection.step(statement) == SQLITE_ROW else { return nil }
        return CodeChapter(
            id: connection.int64(at: 0, in: statement),
            codeSectionID: nil,
            chapterNumber: connection.string(at: 1, in: statement),
            title: connection.string(at: 2, in: statement)
        )
    }

    func sectionSummary(sectionNumber: String) throws -> CodeSectionSummary? {
        let statement = try connection.prepare(
            """
            SELECT sections.id, chapters.chapter_number, sections.section_number, sections.title
            FROM sections
            JOIN chapters ON chapters.id = sections.chapter_id
            WHERE UPPER(sections.section_number) = UPPER(?)
            LIMIT 1;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: sectionNumber, index: 1, to: statement)
        guard try connection.step(statement) == SQLITE_ROW else { return nil }
        return CodeSectionSummary(
            id: connection.int64(at: 0, in: statement),
            chapterNumber: connection.string(at: 1, in: statement),
            sectionNumber: connection.string(at: 2, in: statement),
            title: connection.string(at: 3, in: statement)
        )
    }

    private func figures(for sectionID: Int64) throws -> [CodeFigure] {
        let statement = try connection.prepare(
            """
            SELECT figures.id, figures.file_name, figures.caption
            FROM section_figures
            JOIN figures ON figures.id = section_figures.figure_id
            WHERE section_figures.section_id = ?
            ORDER BY section_figures.display_order;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, sectionID)
        return try readFigures(statement: statement)
    }

    private func customDiagrams(for sectionID: Int64) throws -> [CodeFigure] {
        let statement = try connection.prepare(
            """
            SELECT id, file_name, caption
            FROM custom_diagrams
            WHERE section_id = ?
            ORDER BY created_at DESC;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, sectionID)
        return try readFigures(statement: statement)
    }

    private func textSpans(for sectionID: Int64) throws -> [TextSpan] {
        let statement = try connection.prepare(
            """
            SELECT id, start_index, length, style_type
            FROM text_spans
            WHERE section_id = ?
            ORDER BY start_index;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, sectionID)

        var spans: [TextSpan] = []
        while try connection.step(statement) == SQLITE_ROW {
            spans.append(
                TextSpan(
                    id: connection.int64(at: 0, in: statement),
                    startIndex: connection.int(at: 1, in: statement),
                    length: connection.int(at: 2, in: statement),
                    styleType: connection.string(at: 3, in: statement)
                )
            )
        }
        return spans
    }

    private func richTextOverride(for sectionID: Int64) throws -> Data? {
        let statement = try connection.prepare(
            """
            SELECT rtf_data
            FROM section_rich_text_overrides
            WHERE section_id = ?
            LIMIT 1;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, sectionID)

        guard try connection.step(statement) == SQLITE_ROW else {
            return nil
        }
        return connection.data(at: 0, in: statement)
    }

    private func readFigures(statement: OpaquePointer) throws -> [CodeFigure] {
        var items: [CodeFigure] = []
        while try connection.step(statement) == SQLITE_ROW {
            items.append(
                CodeFigure(
                    id: connection.int64(at: 0, in: statement),
                    fileName: connection.string(at: 1, in: statement),
                    caption: connection.string(at: 2, in: statement)
                )
            )
        }
        return items
    }

    private func tableExists(named name: String) throws -> Bool {
        let statement = try connection.prepare(
            """
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = ?
            LIMIT 1;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: name, index: 1, to: statement)
        return try connection.step(statement) == SQLITE_ROW
    }

    private func editorSectionGroupMetadata(chapterID: Int64) throws -> [String: (headerLine: String, headingLine: String?)] {
        guard hasEditorSectionGroupsTable else { return [:] }
        if let cached = editorSectionGroupMetadataCache[chapterID] {
            return cached
        }

        let statement = try connection.prepare(
            """
            SELECT group_id, header_line, heading_line
            FROM editor_section_groups
            WHERE chapter_id = ?;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, chapterID)

        var groups: [String: (headerLine: String, headingLine: String?)] = [:]
        while try connection.step(statement) == SQLITE_ROW {
            let groupID = connection.string(at: 0, in: statement)
            groups[groupID] = (
                headerLine: connection.string(at: 1, in: statement),
                headingLine: connection.stringOrNil(at: 2, in: statement)
            )
        }
        editorSectionGroupMetadataCache[chapterID] = groups
        return groups
    }

    private func inferredGroupMetadata(from officialText: String, fallbackGroupID: String) -> (headerLine: String, headingLine: String?) {
        let lines = officialText
            .split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        let headerLine = lines.first(where: { $0.uppercased().hasPrefix("SECTION BC") }) ?? "SECTION BC \(fallbackGroupID)"
        let headingLine = lines.dropFirst().first { line in
            !line.uppercased().hasPrefix("SECTION BC") &&
            !line.hasPrefix(fallbackGroupID) &&
            line == line.uppercased()
        }

        return (headerLine, headingLine)
    }

    private func sectionGroupLabel(chapterID: Int64, sectionNumber: String, officialText: String) throws -> String {
        let groupID = sectionNumber.topLevelSectionIdentifier
        let persistedMetadata = try editorSectionGroupMetadata(chapterID: chapterID)
        let fallbackMetadata = inferredGroupMetadata(from: officialText, fallbackGroupID: groupID)
        let metadata = persistedMetadata[groupID] ?? fallbackMetadata

        if let headingLine = metadata.headingLine, !headingLine.isEmpty {
            return "\(metadata.headerLine) - \(headingLine)"
        }
        return metadata.headerLine
    }
}
