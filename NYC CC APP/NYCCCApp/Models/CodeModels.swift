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

    var displayLabel: String {
        if let headingLine, !headingLine.isEmpty {
            return "\(headerLine) - \(headingLine)"
        }
        return headerLine
    }
}

struct CodeSearchResult: Identifiable, Hashable, Sendable {
    let id: Int64
    let chapterNumber: String
    let sectionNumber: String
    let title: String
    let snippet: String
    let kind: CodeSectionKind

    init(
        id: Int64,
        chapterNumber: String,
        sectionNumber: String,
        title: String,
        snippet: String,
        kind: CodeSectionKind = .title
    ) {
        self.id = id
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
    let chapterNumber: String
    let chapterTitle: String
    let sectionNumber: String
    let title: String
    let kind: CodeSectionKind
    let isBookmarked: Bool
    let noteBody: String

    init(
        id: Int64,
        codeVersion: String,
        chapterNumber: String,
        chapterTitle: String,
        sectionNumber: String,
        title: String,
        kind: CodeSectionKind = .title,
        isBookmarked: Bool = true,
        noteBody: String = ""
    ) {
        self.id = id
        self.codeVersion = codeVersion
        self.chapterNumber = chapterNumber
        self.chapterTitle = chapterTitle
        self.sectionNumber = sectionNumber
        self.title = title
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
