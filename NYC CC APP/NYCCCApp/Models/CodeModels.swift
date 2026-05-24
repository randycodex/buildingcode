import Foundation

enum BundledCodeContentKind: String, Hashable, Sendable {
    case sqlite
    case authored
}

enum CodeSectionKind: String, Codable, Hashable, Sendable {
    case title
    case textBlock
}

enum CodeContentBlockKind: String, Codable, Hashable, Sendable {
    case html
    case table
    case image
}

struct CodeContentBlock: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let kind: CodeContentBlockKind
    let html: String?
    let tableID: String?
    let imageID: String?
    let caption: String?
    let plainText: String?
}

struct CodeTableBlock: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let caption: String?
    let sourceWorkbookPath: String?
    let sourceSheetName: String?
    let sourceRange: String?
    let columnCount: Int
    let rowCount: Int
    let columnWidths: [Double?]?
    let rowHeights: [Double?]?
    let cells: [CodeTableCell]
    let footnotes: [String]

    private enum CodingKeys: String, CodingKey {
        case id
        case caption
        case sourceWorkbookPath
        case sourceSheetName
        case sourceRange
        case columnCount
        case rowCount
        case columnWidths
        case rowHeights
        case cells
        case footnotes
        case sheet
        case range
        case rows
    }

    private struct LegacyRow: Decodable {
        let cells: [LegacyCell]
    }

    private struct LegacyCell: Decodable {
        let text: String
        let columnSpan: Int
        let rowSpan: Int
        let isPlaceholder: Bool
    }

    init(
        id: String,
        caption: String?,
        sourceWorkbookPath: String?,
        sourceSheetName: String?,
        sourceRange: String?,
        columnCount: Int,
        rowCount: Int,
        columnWidths: [Double?]?,
        rowHeights: [Double?]?,
        cells: [CodeTableCell],
        footnotes: [String]
    ) {
        self.id = id
        self.caption = caption
        self.sourceWorkbookPath = sourceWorkbookPath
        self.sourceSheetName = sourceSheetName
        self.sourceRange = sourceRange
        self.columnCount = columnCount
        self.rowCount = rowCount
        self.columnWidths = columnWidths
        self.rowHeights = rowHeights
        self.cells = cells
        self.footnotes = footnotes
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        caption = try container.decodeIfPresent(String.self, forKey: .caption)
        sourceWorkbookPath = try container.decodeIfPresent(String.self, forKey: .sourceWorkbookPath)
        sourceSheetName = try container.decodeIfPresent(String.self, forKey: .sourceSheetName)
            ?? container.decodeIfPresent(String.self, forKey: .sheet)
        sourceRange = try container.decodeIfPresent(String.self, forKey: .sourceRange)
            ?? container.decodeIfPresent(String.self, forKey: .range)
        columnWidths = try container.decodeIfPresent([Double?].self, forKey: .columnWidths)
        rowHeights = try container.decodeIfPresent([Double?].self, forKey: .rowHeights)
        footnotes = try container.decodeIfPresent([String].self, forKey: .footnotes) ?? []

        if let decodedCells = try container.decodeIfPresent([CodeTableCell].self, forKey: .cells) {
            cells = decodedCells
            columnCount = try container.decodeIfPresent(Int.self, forKey: .columnCount)
                ?? ((decodedCells.map { $0.column + max($0.columnSpan, 1) }.max()) ?? 0)
            rowCount = try container.decodeIfPresent(Int.self, forKey: .rowCount)
                ?? ((decodedCells.map { $0.row + max($0.rowSpan, 1) }.max()) ?? 0)
            return
        }

        let legacyRows = try container.decodeIfPresent([LegacyRow].self, forKey: .rows) ?? []
        rowCount = legacyRows.count
        columnCount = legacyRows.map { row in
            row.cells.reduce(0) { total, cell in
                cell.isPlaceholder ? total : total + max(cell.columnSpan, 1)
            }
        }.max() ?? 0

        var convertedCells: [CodeTableCell] = []
        for (rowIndex, row) in legacyRows.enumerated() {
            var columnIndex = 0
            for legacyCell in row.cells {
                defer { columnIndex += max(legacyCell.columnSpan, 1) }
                guard !legacyCell.isPlaceholder else { continue }
                convertedCells.append(
                    CodeTableCell(
                        row: rowIndex,
                        column: columnIndex,
                        rowSpan: max(legacyCell.rowSpan, 1),
                        columnSpan: max(legacyCell.columnSpan, 1),
                        html: Self.escapedHTML(legacyCell.text),
                        plainText: legacyCell.text,
                        borders: CodeTableCellBorders.visibleGrid,
                        horizontalAlignment: nil,
                        verticalAlignment: nil,
                        backgroundColorHex: nil,
                        textColorHex: nil,
                        isBold: nil,
                        isItalic: nil,
                        fontSize: nil,
                        isWrapped: nil
                    )
                )
            }
        }
        cells = convertedCells
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(caption, forKey: .caption)
        try container.encodeIfPresent(sourceWorkbookPath, forKey: .sourceWorkbookPath)
        try container.encodeIfPresent(sourceSheetName, forKey: .sourceSheetName)
        try container.encodeIfPresent(sourceRange, forKey: .sourceRange)
        try container.encode(columnCount, forKey: .columnCount)
        try container.encode(rowCount, forKey: .rowCount)
        try container.encodeIfPresent(columnWidths, forKey: .columnWidths)
        try container.encodeIfPresent(rowHeights, forKey: .rowHeights)
        try container.encode(cells, forKey: .cells)
        try container.encode(footnotes, forKey: .footnotes)
    }

    private static func escapedHTML(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&#39;")
            .replacingOccurrences(of: "\n", with: "<br>")
    }
}

struct CodeTableCell: Identifiable, Codable, Hashable, Sendable {
    let row: Int
    let column: Int
    let rowSpan: Int
    let columnSpan: Int
    let html: String
    let plainText: String
    let borders: CodeTableCellBorders
    let horizontalAlignment: String?
    let verticalAlignment: String?
    let backgroundColorHex: String?
    let textColorHex: String?
    let isBold: Bool?
    let isItalic: Bool?
    let fontSize: Double?
    let isWrapped: Bool?

    var id: String { "\(row)-\(column)" }

    init(
        row: Int,
        column: Int,
        rowSpan: Int,
        columnSpan: Int,
        html: String,
        plainText: String,
        borders: CodeTableCellBorders,
        horizontalAlignment: String?,
        verticalAlignment: String?,
        backgroundColorHex: String?,
        textColorHex: String?,
        isBold: Bool?,
        isItalic: Bool?,
        fontSize: Double?,
        isWrapped: Bool?
    ) {
        self.row = row
        self.column = column
        self.rowSpan = rowSpan
        self.columnSpan = columnSpan
        self.html = html
        self.plainText = plainText
        self.borders = borders
        self.horizontalAlignment = horizontalAlignment
        self.verticalAlignment = verticalAlignment
        self.backgroundColorHex = backgroundColorHex
        self.textColorHex = textColorHex
        self.isBold = isBold
        self.isItalic = isItalic
        self.fontSize = fontSize
        self.isWrapped = isWrapped
    }
}

struct CodeTableCellBorders: Codable, Hashable, Sendable {
    var left: CodeTableBorder
    var right: CodeTableBorder
    var top: CodeTableBorder
    var bottom: CodeTableBorder

    init(
        left: CodeTableBorder = CodeTableBorder(),
        right: CodeTableBorder = CodeTableBorder(),
        top: CodeTableBorder = CodeTableBorder(),
        bottom: CodeTableBorder = CodeTableBorder()
    ) {
        self.left = left
        self.right = right
        self.top = top
        self.bottom = bottom
    }

    static var visibleGrid: CodeTableCellBorders {
        let border = CodeTableBorder(isHidden: false, width: 1, colorHex: nil, style: "solid")
        return CodeTableCellBorders(left: border, right: border, top: border, bottom: border)
    }
}

struct CodeTableBorder: Codable, Hashable, Sendable {
    var isHidden: Bool
    var width: Double?
    var colorHex: String?
    var style: String?

    init(isHidden: Bool = true, width: Double? = nil, colorHex: String? = nil, style: String? = nil) {
        self.isHidden = isHidden
        self.width = width
        self.colorHex = colorHex
        self.style = style
    }
}

struct BundledCodeVersion: Identifiable, Hashable, Sendable {
    let fileName: String
    let fileURL: URL
    let codeVersion: String
    let contentKind: BundledCodeContentKind
    let authoredCodeID: Int64?
    let jurisdictionID: Int64?
    let jurisdictionName: String?
    let authoredHTMLBundlePath: String?

    var id: String { fileName }
    var displayName: String {
        if codeVersion == "sample" {
            return "Sample Data"
        }
        if let jurisdictionName, !jurisdictionName.isEmpty {
            return "\(jurisdictionName) - \(codeVersion)"
        }
        return codeVersion
    }
}

struct BundledJurisdiction: Identifiable, Hashable, Sendable {
    let id: String
    let jurisdictionID: Int64?
    let name: String
}

struct CodeChapter: Identifiable, Hashable, Sendable {
    let id: Int64
    let codeSectionID: Int64?
    let chapterNumber: String
    let title: String

    var displayLabel: String {
        if title.localizedCaseInsensitiveContains("appendix") || chapterNumber.rangeOfCharacter(from: .letters) != nil {
            return "Appendix \(chapterNumber)"
        }
        return "Chapter \(chapterNumber)"
    }
}

struct CodeSectionCategory: Identifiable, Hashable, Sendable {
    let id: Int64
    let codeID: Int64
    let name: String
}

struct CodeSectionSummary: Identifiable, Hashable, Sendable {
    let id: Int64
    let chapterNumber: String
    let sectionNumber: String
    let title: String
    let kind: CodeSectionKind

    init(
        id: Int64,
        chapterNumber: String,
        sectionNumber: String,
        title: String,
        kind: CodeSectionKind = .title
    ) {
        self.id = id
        self.chapterNumber = chapterNumber
        self.sectionNumber = sectionNumber
        self.title = title
        self.kind = kind
    }

    var displayTitle: String {
        kind == .textBlock ? title : title.displayTitle(for: sectionNumber)
    }

    var displayLabel: String {
        kind == .textBlock ? displayTitle : "\(sectionNumber) \(displayTitle)"
    }
}

struct CodeSectionGroup: Identifiable, Hashable, Sendable {
    let id: String
    let headerLine: String
    let headingLine: String?
    let sections: [CodeSectionSummary]

    func displayLabel(codeSectionName: String?) -> String {
        CodeSectionHeaderFormatting.groupDisplayLabel(
            headerLine: headerLine,
            headingLine: headingLine,
            codeSectionName: codeSectionName
        )
    }

    var displayLabel: String {
        displayLabel(codeSectionName: nil)
    }
}

enum CodeSectionHeaderFormatting {
    private static let knownPrefixes = ["BC", "FGC", "MC", "PC"]

    private static func defaultPrefix(for codeSectionName: String?) -> String {
        let name = (codeSectionName ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()

        if name.contains("FUEL GAS") {
            return "FGC"
        }
        if name.contains("MECHANICAL") {
            return "MC"
        }
        if name.contains("PLUMBING") {
            return "PC"
        }
        return "BC"
    }

    /// Normalizes group headers to the correct code-book prefix (BC, FGC, MC, PC).
    static func normalizedHeaderLine(_ headerLine: String, codeSectionName: String?) -> String {
        let trimmed = headerLine.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return trimmed }

        let upper = trimmed.uppercased()
        if upper.hasPrefix("APPENDIX") {
            return trimmed
        }
        guard upper.hasPrefix("SECTION ") else {
            return trimmed
        }

        let suffix = trimmed.dropFirst("SECTION ".count).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !suffix.isEmpty else { return trimmed }

        let upperSuffix = suffix.uppercased()
        for prefix in knownPrefixes {
            if upperSuffix.hasPrefix("\(prefix) ") {
                let expected = defaultPrefix(for: codeSectionName)
                if prefix == expected {
                    return trimmed
                }
                let remainder = suffix.dropFirst(prefix.count + 1).trimmingCharacters(in: .whitespacesAndNewlines)
                return "SECTION \(expected) \(remainder)"
            }
        }

        if suffix.contains(".") {
            return trimmed
        }

        return "SECTION \(defaultPrefix(for: codeSectionName)) \(suffix)"
    }

    static func groupDisplayLabel(headerLine: String, headingLine: String?, codeSectionName: String?) -> String {
        let normalizedHeader = normalizedHeaderLine(headerLine, codeSectionName: codeSectionName)
        if let headingLine, !headingLine.isEmpty {
            return "\(normalizedHeader) - \(headingLine)"
        }
        return normalizedHeader
    }
}

struct CodeSearchResult: Identifiable, Hashable, Sendable {
    let id: Int64
    let codeSectionID: Int64?
    let chapterNumber: String
    let sectionNumber: String
    let title: String
    let snippet: String
    let kind: CodeSectionKind

    init(
        id: Int64,
        codeSectionID: Int64? = nil,
        chapterNumber: String,
        sectionNumber: String,
        title: String,
        snippet: String,
        kind: CodeSectionKind = .title
    ) {
        self.id = id
        self.codeSectionID = codeSectionID
        self.chapterNumber = chapterNumber
        self.sectionNumber = sectionNumber
        self.title = title
        self.snippet = snippet
        self.kind = kind
    }

    var displayTitle: String {
        kind == .textBlock ? title : title.displayTitle(for: sectionNumber)
    }
}

struct CodeFigure: Identifiable, Hashable, Sendable {
    let id: Int64
    let fileName: String
    let caption: String?

    var titleText: String {
        caption?.isEmpty == false ? caption! : fileName
    }
}

struct TextSpan: Identifiable, Hashable, Sendable {
    let id: Int64
    let startIndex: Int
    let length: Int
    let styleType: String
}

struct ReaderSectionDetail: Identifiable, Hashable, Sendable {
    let id: Int64
    let codeSectionID: Int64?
    let chapterNumber: String
    let chapterTitle: String
    let sectionGroupLabel: String?
    let sectionNumber: String
    let title: String
    let officialText: String
    let figures: [CodeFigure]
    let customDiagrams: [CodeFigure]
    let textSpans: [TextSpan]
    let richTextOverrideData: Data?
    let kind: CodeSectionKind
    let contentBlocks: [CodeContentBlock]
    let tableBlocks: [CodeTableBlock]

    init(
        id: Int64,
        codeSectionID: Int64? = nil,
        chapterNumber: String,
        chapterTitle: String,
        sectionGroupLabel: String? = nil,
        sectionNumber: String,
        title: String,
        officialText: String,
        figures: [CodeFigure],
        customDiagrams: [CodeFigure],
        textSpans: [TextSpan],
        richTextOverrideData: Data?,
        kind: CodeSectionKind = .title,
        contentBlocks: [CodeContentBlock] = [],
        tableBlocks: [CodeTableBlock] = []
    ) {
        self.id = id
        self.codeSectionID = codeSectionID
        self.chapterNumber = chapterNumber
        self.chapterTitle = chapterTitle
        self.sectionGroupLabel = sectionGroupLabel
        self.sectionNumber = sectionNumber
        self.title = title
        self.officialText = officialText
        self.figures = figures
        self.customDiagrams = customDiagrams
        self.textSpans = textSpans
        self.richTextOverrideData = richTextOverrideData
        self.kind = kind
        self.contentBlocks = contentBlocks
        self.tableBlocks = tableBlocks
    }

    var displayTitle: String {
        kind == .textBlock ? title : title.displayTitle(for: sectionNumber)
    }

    var displayLabel: String {
        kind == .textBlock ? displayTitle : "\(sectionNumber) \(displayTitle)"
    }
}

struct BookmarkedSection: Identifiable, Hashable, Sendable {
    let id: Int64
    let codeVersion: String
    let codeSectionID: Int64?
    let chapterNumber: String
    let chapterTitle: String
    let sectionNumber: String
    let title: String
    let previewText: String
    let kind: CodeSectionKind
    let isBookmarked: Bool
    let noteBody: String

    init(
        id: Int64,
        codeVersion: String,
        codeSectionID: Int64? = nil,
        chapterNumber: String,
        chapterTitle: String,
        sectionNumber: String,
        title: String,
        previewText: String = "",
        kind: CodeSectionKind = .title,
        isBookmarked: Bool = true,
        noteBody: String = ""
    ) {
        self.id = id
        self.codeVersion = codeVersion
        self.codeSectionID = codeSectionID
        self.chapterNumber = chapterNumber
        self.chapterTitle = chapterTitle
        self.sectionNumber = sectionNumber
        self.title = title
        self.previewText = previewText
        self.kind = kind
        self.isBookmarked = isBookmarked
        self.noteBody = noteBody
    }

    var displayTitle: String {
        kind == .textBlock ? title : title.displayTitle(for: sectionNumber)
    }

    var hasNote: Bool {
        !noteBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

enum CodeReferenceKind: String, Hashable, Sendable {
    case section
    case chapter
    case appendix
}

enum CodeReferenceDestination: Hashable, Sendable {
    case section(CodeSectionSummary)
    case chapter(CodeChapter)
}

struct ResolvedCodeReference: Identifiable, Hashable, Sendable {
    let kind: CodeReferenceKind
    let label: String
    let destination: CodeReferenceDestination

    var id: String {
        switch destination {
        case .section(let section):
            return "\(kind.rawValue)-\(section.id)-\(label)"
        case .chapter(let chapter):
            return "\(kind.rawValue)-\(chapter.id)-\(label)"
        }
    }

    var subtitle: String {
        switch destination {
        case .section(let section):
            return "\(section.sectionNumber) \(section.displayTitle)"
        case .chapter(let chapter):
            return chapter.title
        }
    }
}

extension String {
    func displayTitle(for sectionNumber: String) -> String {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.hasPrefix(sectionNumber) else {
            return trimmed.titleThroughFirstPeriod
        }

        let suffix = trimmed.dropFirst(sectionNumber.count).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !suffix.isEmpty else {
            return trimmed.titleThroughFirstPeriod
        }

        return suffix.titleThroughFirstPeriod
    }

    var titleThroughFirstPeriod: String {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        guard let periodIndex = trimmed.firstIndex(of: ".") else {
            return trimmed
        }

        return String(trimmed[...periodIndex])
    }

    var topLevelSectionIdentifier: String {
        components(separatedBy: ".").first ?? self
    }

    var hierarchyIndentLevel: Int {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        let components = trimmed.split(separator: ".").filter { !$0.isEmpty }
        return max(components.count - 2, 0)
    }
}
