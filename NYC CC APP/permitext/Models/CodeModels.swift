import Foundation
import StoreKit

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

enum UserContentVisibility: String, Hashable, Sendable {
    case personal
    case project
    case `public`
}

enum UserContentSyncState: String, Hashable, Sendable {
    case localOnly
    case pendingUpload
    case synced
}

enum SyncEntityType: String, Codable, Hashable, Sendable {
    case bookmark
    case note
    case tagSet
    case folder
    case folderSection
    case codeVersionUserData
}

enum SyncOperationType: String, Codable, Hashable, Sendable {
    case upsert
    case delete
    case replace
}

enum SyncQueueState: String, Codable, Hashable, Sendable {
    case pending
    case inFlight
    case failed
    case synced
}

struct SyncQueuePayload: Codable, Hashable, Sendable {
    var codeVersion: String
    var sectionID: Int64?
    var folderID: Int64?
    var clientID: String?
    var values: [String: String]

    init(
        codeVersion: String,
        sectionID: Int64? = nil,
        folderID: Int64? = nil,
        clientID: String? = nil,
        values: [String: String] = [:]
    ) {
        self.codeVersion = codeVersion
        self.sectionID = sectionID
        self.folderID = folderID
        self.clientID = clientID
        self.values = values
    }
}

struct SyncQueueItem: Identifiable, Hashable, Sendable {
    let id: Int64
    let clientID: String
    let entityType: SyncEntityType
    let operationType: SyncOperationType
    let payload: SyncQueuePayload
    let state: SyncQueueState
    let attemptCount: Int
    let createdAt: Date
    let updatedAt: Date
    let lastError: String?
}

/// A user-created Project folder. Bookmarks can be assigned to many folders;
/// each folder is just a named, colored, ordered grouping the user defines
/// for their own organizational workflow.
struct CodeFolder: Identifiable, Hashable, Sendable {
    let id: Int64
    let clientID: String
    let ownerID: String
    let visibility: UserContentVisibility
    let syncState: UserContentSyncState
    let deletedAt: Date?
    let name: String
    let description: String
    let colorHex: String
    let sortOrder: Int
    let createdAt: Date
    let updatedAt: Date

    /// Six preset hex palette offered in the folder editor. Chosen to not
    /// clash with the code-section accents (Building orange, Plumbing blue,
    /// Mechanical green, Fuel Gas red, General Administrative purple).
    static let presetColorHexes: [String] = [
        "#5C6BC0",   // Indigo
        "#26A69A",   // Teal
        "#FF7043",   // Coral
        "#AB47BC",   // Purple
        "#789262",   // Sage
        "#8D6E63"    // Bronze
    ]

    static let defaultColorHex: String = presetColorHexes[0]
}

struct RecentlyViewedEntry: Identifiable, Codable, Hashable, Sendable {
    let sectionID: Int64
    let sectionNumber: String
    let title: String
    let chapterTitle: String
    let codeSectionID: Int64?
    let codeSectionName: String
    let previewText: String
    let viewedAt: Date

    var id: Int64 { sectionID }

    init(
        sectionID: Int64,
        sectionNumber: String,
        title: String,
        chapterTitle: String,
        codeSectionID: Int64?,
        codeSectionName: String,
        previewText: String = "",
        viewedAt: Date
    ) {
        self.sectionID = sectionID
        self.sectionNumber = sectionNumber
        self.title = title
        self.chapterTitle = chapterTitle
        self.codeSectionID = codeSectionID
        self.codeSectionName = codeSectionName
        self.previewText = previewText
        self.viewedAt = viewedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        sectionID = try container.decode(Int64.self, forKey: .sectionID)
        sectionNumber = try container.decode(String.self, forKey: .sectionNumber)
        title = try container.decode(String.self, forKey: .title)
        chapterTitle = try container.decode(String.self, forKey: .chapterTitle)
        codeSectionID = try container.decodeIfPresent(Int64.self, forKey: .codeSectionID)
        codeSectionName = try container.decode(String.self, forKey: .codeSectionName)
        previewText = try container.decodeIfPresent(String.self, forKey: .previewText) ?? ""
        viewedAt = try container.decode(Date.self, forKey: .viewedAt)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(sectionID, forKey: .sectionID)
        try container.encode(sectionNumber, forKey: .sectionNumber)
        try container.encode(title, forKey: .title)
        try container.encode(chapterTitle, forKey: .chapterTitle)
        try container.encodeIfPresent(codeSectionID, forKey: .codeSectionID)
        try container.encode(codeSectionName, forKey: .codeSectionName)
        try container.encode(previewText, forKey: .previewText)
        try container.encode(viewedAt, forKey: .viewedAt)
    }

    private enum CodingKeys: String, CodingKey {
        case sectionID
        case sectionNumber
        case title
        case chapterTitle
        case codeSectionID
        case codeSectionName
        case previewText
        case viewedAt
    }
}

struct ContinuityContext: Codable, Hashable, Sendable {
    var selectedJurisdictionKey: String
    var selectedVersionFileName: String
    var selectedCodeSectionID: Int64?
    var lastOpenedChapterID: Int64?
    var activeProjectID: Int64?
    var comparisonModeEnabled: Bool
    var recentlyViewedSections: [RecentlyViewedEntry]

    static let empty = ContinuityContext(
        selectedJurisdictionKey: "",
        selectedVersionFileName: "",
        selectedCodeSectionID: nil,
        lastOpenedChapterID: nil,
        activeProjectID: nil,
        comparisonModeEnabled: false,
        recentlyViewedSections: []
    )
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
    let clientID: String?
    let ownerID: String
    let visibility: UserContentVisibility
    let syncState: UserContentSyncState
    let updatedAt: Date?
    let deletedAt: Date?
    let chapterNumber: String
    let chapterTitle: String
    let sectionNumber: String
    let title: String
    let previewText: String
    let kind: CodeSectionKind
    let isBookmarked: Bool
    let noteBody: String
    let tags: [String]
    let bookmarkedAt: Date?

    init(
        id: Int64,
        codeVersion: String,
        codeSectionID: Int64? = nil,
        clientID: String? = nil,
        ownerID: String = UserDataDefaults.localOwnerID,
        visibility: UserContentVisibility = .personal,
        syncState: UserContentSyncState = .localOnly,
        updatedAt: Date? = nil,
        deletedAt: Date? = nil,
        chapterNumber: String,
        chapterTitle: String,
        sectionNumber: String,
        title: String,
        previewText: String = "",
        kind: CodeSectionKind = .title,
        isBookmarked: Bool = true,
        noteBody: String = "",
        tags: [String] = [],
        bookmarkedAt: Date? = nil
    ) {
        self.id = id
        self.codeVersion = codeVersion
        self.codeSectionID = codeSectionID
        self.clientID = clientID
        self.ownerID = ownerID
        self.visibility = visibility
        self.syncState = syncState
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
        self.chapterNumber = chapterNumber
        self.chapterTitle = chapterTitle
        self.sectionNumber = sectionNumber
        self.title = title
        self.previewText = previewText
        self.kind = kind
        self.isBookmarked = isBookmarked
        self.noteBody = noteBody
        self.tags = tags
        self.bookmarkedAt = bookmarkedAt
    }

    var displayTitle: String {
        kind == .textBlock ? title : title.displayTitle(for: sectionNumber)
    }

    var hasNote: Bool {
        !noteBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

enum UserDataDefaults {
    static let localOwnerID = "local"
}

enum AppPlan: String, Codable, Hashable, Sendable {
    case free
    case pro

    var label: String {
        switch self {
        case .free: return "Free"
        case .pro: return "Pro"
        }
    }
}

enum EntitlementSource: String, Codable, Hashable, Sendable {
    case none
    case subscription
    case lifetimeGrant
    case debugOverride

    var label: String {
        switch self {
        case .none: return "None"
        case .subscription: return "Subscription"
        case .lifetimeGrant: return "Lifetime Grant"
        case .debugOverride: return "Debug Override"
        }
    }
}

struct AppEntitlement: Codable, Hashable, Sendable {
    let plan: AppPlan
    let source: EntitlementSource
    let grantedUserID: String?

    static let free = AppEntitlement(plan: .free, source: .none, grantedUserID: nil)
    static let subscriptionPro = AppEntitlement(plan: .pro, source: .subscription, grantedUserID: nil)

    static func lifetimeGrant(userID: String) -> AppEntitlement {
        AppEntitlement(plan: .pro, source: .lifetimeGrant, grantedUserID: userID)
    }

    #if DEBUG
    static func debugOverride(_ plan: AppPlan) -> AppEntitlement {
        AppEntitlement(plan: plan, source: .debugOverride, grantedUserID: nil)
    }
    #endif
}

struct SignedInAccount: Codable, Hashable, Sendable {
    let appleUserID: String
    let displayName: String?
    let signedInAt: Date
}

struct LifetimeGrantLookupResult: Codable, Hashable, Sendable {
    let hasLifetimeGrant: Bool
    let grantedUserID: String?
}

enum AccountDefaults {
    static let signedInAccountKey = "permitext.account.signedIn"
}

protocol LifetimeGrantLookupClient {
    func lookupLifetimeGrant(appleUserID: String) async throws -> LifetimeGrantLookupResult
}

struct LocalLifetimeGrantLookupClient: LifetimeGrantLookupClient {
    private let defaults: UserDefaults
    private let debugGrantedAppleUserIDsKey = "permitext.debug.grantedAppleUserIDs"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func lookupLifetimeGrant(appleUserID: String) async throws -> LifetimeGrantLookupResult {
        #if DEBUG
        let grantedIDs = Set(defaults.stringArray(forKey: debugGrantedAppleUserIDsKey) ?? [])
        if grantedIDs.contains(appleUserID) {
            return LifetimeGrantLookupResult(hasLifetimeGrant: true, grantedUserID: appleUserID)
        }
        #endif
        return LifetimeGrantLookupResult(hasLifetimeGrant: false, grantedUserID: nil)
    }
}

enum EntitlementFeature: String, Hashable, Sendable {
    case unlimitedSavedItems
    case unlimitedNotes
    case unlimitedProjects
    case premiumExports
    case advancedOrganization
    case continuity
    case crossDeviceSync

    var label: String {
        switch self {
        case .unlimitedSavedItems: return "unlimited saved sections"
        case .unlimitedNotes: return "unlimited notes"
        case .unlimitedProjects: return "unlimited projects"
        case .premiumExports: return "PDF exports"
        case .advancedOrganization: return "advanced organization"
        case .continuity: return "reading continuity"
        case .crossDeviceSync: return "cross-device sync"
        }
    }
}

struct EntitlementLimits: Hashable, Sendable {
    let savedSectionLimit: Int?
    let noteLimit: Int?
    let projectLimit: Int?
    let premiumExportsEnabled: Bool
    let advancedOrganizationEnabled: Bool
    let continuityEnabled: Bool
    let crossDeviceSyncEnabled: Bool

    static let free = EntitlementLimits(
        savedSectionLimit: 25,
        noteLimit: 10,
        projectLimit: 0,
        premiumExportsEnabled: false,
        advancedOrganizationEnabled: false,
        continuityEnabled: false,
        crossDeviceSyncEnabled: false
    )

    static let pro = EntitlementLimits(
        savedSectionLimit: nil,
        noteLimit: nil,
        projectLimit: nil,
        premiumExportsEnabled: true,
        advancedOrganizationEnabled: true,
        continuityEnabled: true,
        crossDeviceSyncEnabled: true
    )
}

struct EntitlementRequirement: Hashable, Sendable {
    let feature: EntitlementFeature
    let requiredPlan: AppPlan
    let message: String
}

enum EntitlementDecision: Hashable, Sendable {
    case allowed
    case denied(EntitlementRequirement)
}

protocol EntitlementService {
    var currentEntitlement: AppEntitlement { get }
    var currentPlan: AppPlan { get }
    var limits: EntitlementLimits { get }
    func canUse(_ feature: EntitlementFeature) -> EntitlementDecision
    func canCreateSavedSection(currentCount: Int) -> EntitlementDecision
    func canCreateNote(currentCount: Int) -> EntitlementDecision
    func canCreateProject(currentCount: Int) -> EntitlementDecision
}

struct LocalEntitlementService: EntitlementService {
    private let defaults: UserDefaults
    static let planDefaultsKey = "permitext.appPlan"
    static let verifiedPlanDefaultsKey = "permitext.verifiedAppPlan"
    static let entitlementDefaultsKey = "permitext.entitlement"
    static let lifetimeGrantUserIDDefaultsKey = "permitext.lifetimeGrant.userID"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var currentEntitlement: AppEntitlement {
        if let data = defaults.data(forKey: Self.entitlementDefaultsKey),
           let entitlement = try? JSONDecoder().decode(AppEntitlement.self, from: data) {
            return entitlement
        }
        if let lifetimeGrantUserID = defaults.string(forKey: Self.lifetimeGrantUserIDDefaultsKey),
           !lifetimeGrantUserID.isEmpty {
            return .lifetimeGrant(userID: lifetimeGrantUserID)
        }
        if defaults.string(forKey: Self.verifiedPlanDefaultsKey).flatMap(AppPlan.init(rawValue:)) == .pro {
            return .subscriptionPro
        }
        #if DEBUG
        if let debugPlan = defaults.string(forKey: Self.planDefaultsKey).flatMap(AppPlan.init(rawValue:)) {
            return .debugOverride(debugPlan)
        }
        #else
        #endif
        return .free
    }

    var currentPlan: AppPlan {
        currentEntitlement.plan
    }

    var limits: EntitlementLimits {
        switch currentPlan {
        case .free: return .free
        case .pro: return .pro
        }
    }

    func canUse(_ feature: EntitlementFeature) -> EntitlementDecision {
        switch feature {
        case .unlimitedSavedItems:
            return limits.savedSectionLimit == nil ? .allowed : denied(feature, "Upgrade to Pro for unlimited saved sections.")
        case .unlimitedNotes:
            return limits.noteLimit == nil ? .allowed : denied(feature, "Upgrade to Pro for unlimited notes.")
        case .unlimitedProjects:
            return limits.projectLimit == nil ? .allowed : denied(feature, "Upgrade to Pro for unlimited projects.")
        case .premiumExports:
            return limits.premiumExportsEnabled ? .allowed : denied(feature, "Upgrade to Pro to export saved sections.")
        case .advancedOrganization:
            return limits.advancedOrganizationEnabled ? .allowed : denied(feature, "Upgrade to Pro to use tags and advanced organization.")
        case .continuity:
            return limits.continuityEnabled ? .allowed : denied(feature, "Upgrade to Pro for reading continuity.")
        case .crossDeviceSync:
            return limits.crossDeviceSyncEnabled ? .allowed : denied(feature, "Upgrade to Pro for cross-device sync.")
        }
    }

    func canCreateSavedSection(currentCount: Int) -> EntitlementDecision {
        guard let limit = limits.savedSectionLimit, currentCount >= limit else { return .allowed }
        return denied(.unlimitedSavedItems, "Free includes up to \(limit) saved sections. Upgrade to Pro for unlimited saved sections.")
    }

    func canCreateNote(currentCount: Int) -> EntitlementDecision {
        guard let limit = limits.noteLimit, currentCount >= limit else { return .allowed }
        return denied(.unlimitedNotes, "Free includes up to \(limit) notes. Upgrade to Pro for unlimited notes.")
    }

    func canCreateProject(currentCount: Int) -> EntitlementDecision {
        guard let limit = limits.projectLimit, currentCount >= limit else { return .allowed }
        if limit == 0 {
            return denied(.unlimitedProjects, "Upgrade to Pro to create and manage projects.")
        }
        return denied(.unlimitedProjects, "Free includes up to \(limit) projects. Upgrade to Pro for unlimited projects.")
    }

    private func denied(_ feature: EntitlementFeature, _ message: String) -> EntitlementDecision {
        .denied(EntitlementRequirement(feature: feature, requiredPlan: .pro, message: message))
    }

    #if DEBUG
    static func setDebugPlan(_ plan: AppPlan, defaults: UserDefaults = .standard) {
        defaults.set(plan.rawValue, forKey: planDefaultsKey)
        setEntitlement(.debugOverride(plan), defaults: defaults)
    }
    #endif

    static func setVerifiedPlan(_ plan: AppPlan, defaults: UserDefaults = .standard) {
        defaults.set(plan.rawValue, forKey: verifiedPlanDefaultsKey)
        if plan == .pro {
            setEntitlement(.subscriptionPro, defaults: defaults)
        } else if currentStoredEntitlement(defaults: defaults).source == .subscription {
            setEntitlement(.free, defaults: defaults)
        }
    }

    static func setLifetimeGrant(userID: String, defaults: UserDefaults = .standard) {
        defaults.set(userID, forKey: lifetimeGrantUserIDDefaultsKey)
        setEntitlement(.lifetimeGrant(userID: userID), defaults: defaults)
    }

    static func clearLifetimeGrant(defaults: UserDefaults = .standard) {
        defaults.removeObject(forKey: lifetimeGrantUserIDDefaultsKey)
        if currentStoredEntitlement(defaults: defaults).source == .lifetimeGrant {
            setEntitlement(.free, defaults: defaults)
        }
    }

    static func setEntitlement(_ entitlement: AppEntitlement, defaults: UserDefaults = .standard) {
        if let data = try? JSONEncoder().encode(entitlement) {
            defaults.set(data, forKey: entitlementDefaultsKey)
        }
    }

    private static func currentStoredEntitlement(defaults: UserDefaults) -> AppEntitlement {
        guard let data = defaults.data(forKey: entitlementDefaultsKey),
              let entitlement = try? JSONDecoder().decode(AppEntitlement.self, from: data) else {
            return .free
        }
        return entitlement
    }
}

enum StoreKitProductID {
    static let proMonthly = "com.randycodex.permitext.pro.monthly"
}

struct StoreKitSubscriptionSnapshot: Sendable {
    let plan: AppPlan
    let proDisplayPrice: String?
    let loadedProductIDs: [String]
}

enum StoreKitSubscriptionServiceError: LocalizedError {
    case proProductUnavailable
    case unverifiedTransaction
    case pendingApproval
    case unknownPurchaseResult

    var errorDescription: String? {
        switch self {
        case .proProductUnavailable:
            return "The Pro monthly subscription is not available yet. Check the App Store product setup."
        case .unverifiedTransaction:
            return "The purchase could not be verified."
        case .pendingApproval:
            return "The purchase is pending approval."
        case .unknownPurchaseResult:
            return "The purchase did not complete."
        }
    }
}

actor StoreKitSubscriptionService {
    private let proProductID = StoreKitProductID.proMonthly
    private var cachedProProduct: Product?

    func snapshot() async -> StoreKitSubscriptionSnapshot {
        async let plan = verifiedPlan()
        async let products = proProducts()
        let loadedProducts = await products
        return StoreKitSubscriptionSnapshot(
            plan: await plan,
            proDisplayPrice: loadedProducts.first { $0.id == proProductID }?.displayPrice,
            loadedProductIDs: loadedProducts.map(\.id)
        )
    }

    func purchasePro() async throws -> StoreKitSubscriptionSnapshot {
        guard let product = await proProducts().first(where: { $0.id == proProductID }) else {
            throw StoreKitSubscriptionServiceError.proProductUnavailable
        }

        let result = try await product.purchase()
        switch result {
        case .success(let verification):
            let transaction = try verifiedTransaction(from: verification)
            await transaction.finish()
            return await snapshot()
        case .userCancelled:
            return await snapshot()
        case .pending:
            throw StoreKitSubscriptionServiceError.pendingApproval
        @unknown default:
            throw StoreKitSubscriptionServiceError.unknownPurchaseResult
        }
    }

    func restorePurchases() async -> StoreKitSubscriptionSnapshot {
        try? await AppStore.sync()
        return await snapshot()
    }

    private func proProducts() async -> [Product] {
        if let cachedProProduct { return [cachedProProduct] }
        let products = (try? await Product.products(for: [proProductID])) ?? []
        cachedProProduct = products.first { $0.id == proProductID }
        return products
    }

    private func verifiedPlan() async -> AppPlan {
        for await entitlement in Transaction.currentEntitlements {
            guard case .verified(let transaction) = entitlement else { continue }
            guard transaction.productID == proProductID, transaction.revocationDate == nil else { continue }
            LocalEntitlementService.setVerifiedPlan(.pro)
            return .pro
        }
        if LocalEntitlementService().currentEntitlement.source == .lifetimeGrant {
            return .pro
        }
        LocalEntitlementService.setVerifiedPlan(.free)
        return .free
    }

    private func verifiedTransaction(from result: VerificationResult<Transaction>) throws -> Transaction {
        switch result {
        case .verified(let transaction):
            return transaction
        case .unverified:
            throw StoreKitSubscriptionServiceError.unverifiedTransaction
        }
    }
}

enum BookmarkSortMode: String, CaseIterable, Identifiable {
    case codeOrder
    case recentlySaved
    case codeBook
    case title
    case tag

    var id: String { rawValue }

    var label: String {
        switch self {
        case .codeOrder: return "Code Order"
        case .recentlySaved: return "Recent"
        case .codeBook: return "Code Book"
        case .title: return "Title"
        case .tag: return "Tag"
        }
    }

    var systemImage: String {
        switch self {
        case .codeOrder: return "list.number"
        case .recentlySaved: return "clock"
        case .codeBook: return "books.vertical"
        case .title: return "textformat"
        case .tag: return "tag"
        }
    }
}

enum BookmarkSorter {
    static func sorted(
        _ bookmarks: [BookmarkedSection],
        mode: BookmarkSortMode,
        codeSectionName: (Int64?) -> String
    ) -> [BookmarkedSection] {
        bookmarks.sorted { lhs, rhs in
            switch mode {
            case .codeOrder:
                return compareCodeOrder(lhs, rhs, codeSectionName: codeSectionName)
            case .recentlySaved:
                let lhsDate = lhs.bookmarkedAt ?? .distantPast
                let rhsDate = rhs.bookmarkedAt ?? .distantPast
                if lhsDate != rhsDate { return lhsDate > rhsDate }
                return compareCodeOrder(lhs, rhs, codeSectionName: codeSectionName)
            case .codeBook:
                let lhsName = codeSectionName(lhs.codeSectionID)
                let rhsName = codeSectionName(rhs.codeSectionID)
                if lhsName != rhsName {
                    return lhsName.localizedStandardCompare(rhsName) == .orderedAscending
                }
                return compareCodeOrder(lhs, rhs, codeSectionName: codeSectionName)
            case .title:
                let titleCompare = lhs.displayTitle.localizedStandardCompare(rhs.displayTitle)
                if titleCompare != .orderedSame { return titleCompare == .orderedAscending }
                return compareCodeOrder(lhs, rhs, codeSectionName: codeSectionName)
            case .tag:
                let lhsTag = lhs.tags.first ?? ""
                let rhsTag = rhs.tags.first ?? ""
                if lhsTag != rhsTag {
                    if lhsTag.isEmpty { return false }
                    if rhsTag.isEmpty { return true }
                    return lhsTag.localizedStandardCompare(rhsTag) == .orderedAscending
                }
                return compareCodeOrder(lhs, rhs, codeSectionName: codeSectionName)
            }
        }
    }

    private static func compareCodeOrder(
        _ lhs: BookmarkedSection,
        _ rhs: BookmarkedSection,
        codeSectionName: (Int64?) -> String
    ) -> Bool {
        let lhsCode = codeSectionName(lhs.codeSectionID)
        let rhsCode = codeSectionName(rhs.codeSectionID)
        if lhsCode != rhsCode {
            return lhsCode.localizedStandardCompare(rhsCode) == .orderedAscending
        }
        if lhs.chapterNumber != rhs.chapterNumber {
            return lhs.chapterNumber.compare(rhs.chapterNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
        }
        return lhs.sectionNumber.compare(rhs.sectionNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
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
