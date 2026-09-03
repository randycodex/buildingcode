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
        let normalizedNumber = chapterNumber.uppercased()
        let isConstructionAppendixNumber =
            normalizedNumber.range(of: #"^[A-Z]+\d*$"#, options: .regularExpression) != nil
        if title.localizedCaseInsensitiveContains("appendix")
            || normalizedNumber.hasPrefix("APP-")
            || isConstructionAppendixNumber {
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

enum UserContentSyncState: String, Codable, Hashable, Sendable {
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
    case continuity
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
    let mutationUpdatedAt: Date
    let lastError: String?
}

enum UserContentServerMappingError: LocalizedError {
    case missingSectionID(SyncEntityType)
    case missingFolderID(SyncEntityType)

    var errorDescription: String? {
        switch self {
        case .missingSectionID(let entityType):
            return "Cannot sync \(entityType.rawValue): missing section ID."
        case .missingFolderID(let entityType):
            return "Cannot sync \(entityType.rawValue): missing project ID."
        }
    }
}

struct ServerUserRecord: Codable, Hashable, Sendable {
    let id: String
    let authProvider: AccountAuthProvider
    let authProviderUserID: String
    let publicUsername: String?
    let displayName: String?
    let updatedAt: Date
}

struct ServerEntitlementRecord: Codable, Hashable, Sendable {
    let userID: String
    let plan: AppPlan
    let source: EntitlementSource
    let grantedUserID: String?
    let updatedAt: Date
}

enum UserContentSyncCodeVersion {
    static let canonicalNYC2022 = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1"
    static let localNYC2022 = "2022 CONSTRUCTION CODES"
    static let canonicalNYC2014 =
        "CodeContent/authored/new-york-city/2014-construction-codes/bundle.json#1"
    static let localNYC2014 = "2014 NYC Construction Codes - DOB consolidated archive"
    static let canonicalNYCZoning =
        "CodeContent/authored/new-york-city/2026-zoning-resolution/bundle.json#1"
    static let localNYCZoning = "NYC Zoning Resolution — text through 2026-08-13"
    static let canonicalNYCExistingBuilding =
        "CodeContent/authored/new-york-city/2026-existing-building-code/bundle.json#1"
    static let localNYCExistingBuilding =
        "NYC Existing Building Code - enacted 2026-01-17; effective 2027-07-17"
    static let canonicalNYCEnactedAdministrative =
        "CodeContent/authored/new-york-city/2026-enacted-administrative-code/bundle.json#1"
    static let localNYCEnactedAdministrative =
        "NYC Enacted Administrative Code — current through 2026-07-25"
    static let canonicalNYC2025Specialty =
        "CodeContent/authored/new-york-city/2025-specialty-codes/bundle.json#1"
    static let localNYC2025Specialty =
        "2025 NYC Energy Conservation and Electrical Codes"
    static let allCanonicalNYC = [
        canonicalNYC2022,
        canonicalNYC2014,
        canonicalNYCZoning,
        canonicalNYCExistingBuilding,
        canonicalNYCEnactedAdministrative,
        canonicalNYC2025Specialty
    ]

    private static let nyc2022Aliases = [
        "nyc-2022",
        "2022 Construction Codes",
        canonicalNYC2022
    ]
    private static let nyc2014Aliases = [
        "nyc-2014",
        "2014 Construction Codes",
        "2014 NYC Construction Codes",
        localNYC2014,
        canonicalNYC2014
    ]
    private static let nycZoningAliases = [
        "nyc-zoning-resolution",
        "NYC Zoning Resolution",
        localNYCZoning,
        canonicalNYCZoning
    ]
    private static let nycExistingBuildingAliases = [
        "nyc-existing-building-code",
        "NYC Existing Building Code",
        localNYCExistingBuilding,
        canonicalNYCExistingBuilding
    ]
    private static let nycEnactedAdministrativeAliases = [
        "nyc-enacted-administrative-code",
        "NYC Enacted Administrative Code",
        localNYCEnactedAdministrative,
        canonicalNYCEnactedAdministrative
    ]
    private static let nyc2025SpecialtyAliases = [
        "nyc-2025-specialty-codes",
        localNYC2025Specialty,
        canonicalNYC2025Specialty
    ]

    private static func isNYC2022Alias(_ value: String) -> Bool {
        nyc2022Aliases.contains { $0.caseInsensitiveCompare(value) == .orderedSame }
    }

    private static func isNYC2014Alias(_ value: String) -> Bool {
        nyc2014Aliases.contains { $0.caseInsensitiveCompare(value) == .orderedSame }
    }

    private static func isNYCZoningAlias(_ value: String) -> Bool {
        nycZoningAliases.contains { $0.caseInsensitiveCompare(value) == .orderedSame } ||
            value.lowercased().hasPrefix("nyc zoning resolution — text through ")
    }

    private static func isNYCExistingBuildingAlias(_ value: String) -> Bool {
        nycExistingBuildingAliases.contains { $0.caseInsensitiveCompare(value) == .orderedSame }
    }

    private static func isNYCEnactedAdministrativeAlias(_ value: String) -> Bool {
        nycEnactedAdministrativeAliases.contains { $0.caseInsensitiveCompare(value) == .orderedSame }
    }

    private static func isNYC2025SpecialtyAlias(_ value: String) -> Bool {
        nyc2025SpecialtyAliases.contains { $0.caseInsensitiveCompare(value) == .orderedSame }
    }

    static func server(_ value: String) -> String {
        let candidate = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if candidate.isEmpty || isNYC2022Alias(candidate) { return canonicalNYC2022 }
        if isNYC2014Alias(candidate) { return canonicalNYC2014 }
        if isNYCZoningAlias(candidate) { return canonicalNYCZoning }
        if isNYCExistingBuildingAlias(candidate) { return canonicalNYCExistingBuilding }
        if isNYCEnactedAdministrativeAlias(candidate) { return canonicalNYCEnactedAdministrative }
        if isNYC2025SpecialtyAlias(candidate) { return canonicalNYC2025Specialty }
        return candidate
    }

    static func local(_ value: String) -> String {
        let candidate = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if candidate.isEmpty || isNYC2022Alias(candidate) { return localNYC2022 }
        if isNYC2014Alias(candidate) { return localNYC2014 }
        if isNYCZoningAlias(candidate) { return localNYCZoning }
        if isNYCExistingBuildingAlias(candidate) { return localNYCExistingBuilding }
        if isNYCEnactedAdministrativeAlias(candidate) { return localNYCEnactedAdministrative }
        if isNYC2025SpecialtyAlias(candidate) { return localNYC2025Specialty }
        return candidate
    }

    static func equivalentLocalVersions(_ value: String) -> [String] {
        let candidate = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if candidate.isEmpty || isNYC2022Alias(candidate) {
            return [localNYC2022, "2022 Construction Codes", "nyc-2022", canonicalNYC2022]
        }
        if isNYC2014Alias(candidate) {
            return [
                localNYC2014,
                "2014 NYC Construction Codes",
                "2014 Construction Codes",
                "nyc-2014",
                canonicalNYC2014
            ]
        }
        if isNYCZoningAlias(candidate) {
            return [localNYCZoning, "NYC Zoning Resolution", "nyc-zoning-resolution", canonicalNYCZoning]
        }
        if isNYCExistingBuildingAlias(candidate) {
            return [
                localNYCExistingBuilding,
                "NYC Existing Building Code",
                "nyc-existing-building-code",
                canonicalNYCExistingBuilding
            ]
        }
        if isNYCEnactedAdministrativeAlias(candidate) {
            return [
                localNYCEnactedAdministrative,
                "NYC Enacted Administrative Code",
                "nyc-enacted-administrative-code",
                canonicalNYCEnactedAdministrative
            ]
        }
        if isNYC2025SpecialtyAlias(candidate) {
            return [
                localNYC2025Specialty,
                "nyc-2025-specialty-codes",
                canonicalNYC2025Specialty
            ]
        }
        return [candidate]
    }
}

enum UserContentProjectIdentity {
    static func stable(_ value: String?, userID: String? = nil) -> String? {
        guard var candidate = value?.trimmingCharacters(in: .whitespacesAndNewlines), !candidate.isEmpty else {
            return nil
        }

        while let marker = projectMarker(in: candidate, userID: userID) {
            let prefix = String(candidate[..<marker.upperBound])
            let remainder = String(candidate[marker.upperBound...])
            guard let separator = remainder.firstIndex(of: ":") else { return candidate }
            let codeVersion = String(remainder[..<separator])
            let identityStart = remainder.index(after: separator)
            let identity = String(remainder[identityStart...]).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !identity.isEmpty else { return candidate }

            if identity.hasPrefix(prefix) {
                candidate = identity
                continue
            }
            if codeVersion.caseInsensitiveCompare(UserContentSyncCodeVersion.canonicalNYC2022) == .orderedSame {
                return identity
            }
            return candidate
        }
        return candidate
    }

    private static func projectMarker(in value: String, userID: String?) -> Range<String.Index>? {
        if let userID {
            let prefix = "\(userID):project:"
            return value.hasPrefix(prefix) ? value.range(of: prefix) : nil
        }
        guard let marker = value.range(of: ":project:") else { return nil }
        return value.startIndex..<marker.upperBound
    }
}

struct ServerSavedItemRecord: Codable, Hashable, Sendable {
    let id: String
    let userID: String
    let codeVersion: String
    let sectionID: Int64
    let updatedAt: Date
    let deletedAt: Date?
    var serverEventID: Int64? = nil
}

struct ServerAnnotationRecord: Codable, Hashable, Sendable {
    let id: String
    let userID: String
    let codeVersion: String
    let sectionID: Int64
    let blockID: String?
    let noteBody: String?
    let tags: [String]?
    let updatedAt: Date
    let deletedAt: Date?
    var serverEventID: Int64? = nil

    var normalizedBlockID: String {
        blockID?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }
}

enum CodeFolderType: String, Codable, CaseIterable, Hashable, Sendable {
    case project
    case reference

    /// Older native databases and server records predate typed folders. Treat
    /// an absent or unrecognized discriminator as a Project so upgrades retain
    /// the behavior and entitlements those folders already had.
    init(serverValue: String?) {
        self = serverValue?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == Self.reference.rawValue
            ? .reference
            : .project
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        self.init(serverValue: try? container.decode(String.self))
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

struct ProjectStructuredFact: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let key: String
    let label: String
    let value: String
    let status: String
    let source: String
    let sourceText: String
    let updatedAt: Date?
}

struct ServerProjectRecord: Codable, Hashable, Sendable {
    let id: String
    let userID: String
    let codeVersion: String
    let clientID: String?
    let localFolderID: Int64
    let name: String?
    let address: String?
    let description: String?
    let structuredFacts: [ProjectStructuredFact]?
    let colorHex: String?
    let sortOrder: Int?
    let folderType: CodeFolderType
    let archivedAt: Date?
    let updatedAt: Date
    let deletedAt: Date?
    var serverEventID: Int64? = nil

    init(
        id: String,
        userID: String,
        codeVersion: String,
        clientID: String?,
        localFolderID: Int64,
        name: String?,
        address: String?,
        description: String?,
        structuredFacts: [ProjectStructuredFact]? = nil,
        colorHex: String?,
        sortOrder: Int?,
        folderType: CodeFolderType = .project,
        archivedAt: Date?,
        updatedAt: Date,
        deletedAt: Date?,
        serverEventID: Int64? = nil
    ) {
        self.id = id
        self.userID = userID
        self.codeVersion = codeVersion
        self.clientID = clientID
        self.localFolderID = localFolderID
        self.name = name
        self.address = address
        self.description = description
        self.structuredFacts = structuredFacts
        self.colorHex = colorHex
        self.sortOrder = sortOrder
        self.folderType = folderType
        self.archivedAt = archivedAt
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
        self.serverEventID = serverEventID
    }

    private enum CodingKeys: String, CodingKey {
        case id, userID, codeVersion, clientID, localFolderID, name, address
        case description, structuredFacts, colorHex, sortOrder, folderType, archivedAt, updatedAt
        case deletedAt, serverEventID
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        userID = try container.decode(String.self, forKey: .userID)
        codeVersion = try container.decode(String.self, forKey: .codeVersion)
        clientID = try container.decodeIfPresent(String.self, forKey: .clientID)
        localFolderID = try container.decode(Int64.self, forKey: .localFolderID)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        address = try container.decodeIfPresent(String.self, forKey: .address)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        structuredFacts = try container.decodeIfPresent([ProjectStructuredFact].self, forKey: .structuredFacts)
        colorHex = try container.decodeIfPresent(String.self, forKey: .colorHex)
        sortOrder = try container.decodeIfPresent(Int.self, forKey: .sortOrder)
        folderType = CodeFolderType(
            serverValue: try container.decodeIfPresent(String.self, forKey: .folderType)
        )
        archivedAt = try container.decodeIfPresent(Date.self, forKey: .archivedAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        deletedAt = try container.decodeIfPresent(Date.self, forKey: .deletedAt)
        serverEventID = try container.decodeIfPresent(Int64.self, forKey: .serverEventID)
    }
}

struct ServerProjectSectionRecord: Codable, Hashable, Sendable {
    let id: String
    let userID: String
    let codeVersion: String
    let folderClientID: String?
    let folderType: CodeFolderType?
    let localFolderID: Int64?
    let sectionID: Int64
    let scope: String?
    let updatedAt: Date
    let deletedAt: Date?
    var serverEventID: Int64? = nil

    var resolvedFolderType: CodeFolderType {
        folderType ?? .project
    }
}

struct ServerWorkboardRecord: Codable, Hashable, Sendable {
    let id: String
    let userID: String
    let codeVersion: String
    let projectID: String
    let projectName: String?
    let updatedAt: Date
    let deletedAt: Date?
    var serverEventID: Int64? = nil
}

struct ServerContinuityRecord: Codable, Hashable, Sendable {
    let userID: String
    let codeVersion: String
    let values: [String: String]
    let updatedAt: Date
    var serverEventID: Int64? = nil
}

enum ServerUserContentEntityKind: String, Codable, Hashable, Sendable {
    case savedItem
    case annotation
    case project
    case projectSection
    case workboard
    case continuity
    case codeVersionClear
}

enum ServerUserContentMutation: Codable, Hashable, Sendable {
    case savedItem(ServerSavedItemRecord)
    case annotation(ServerAnnotationRecord)
    case project(ServerProjectRecord)
    case projectSection(ServerProjectSectionRecord)
    case workboard(ServerWorkboardRecord)
    case continuity(ServerContinuityRecord)
    case codeVersionClear(ServerContinuityRecord)

    private enum CodingKeys: String, CodingKey {
        case savedItem
        case annotation
        case project
        case projectSection
        case workboard
        case continuity
        case codeVersionClear
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let presentKeys = container.allKeys
        guard presentKeys.count == 1, let key = presentKeys.first else {
            throw DecodingError.dataCorrupted(
                DecodingError.Context(
                    codingPath: decoder.codingPath,
                    debugDescription: "ServerUserContentMutation must contain exactly one mutation kind."
                )
            )
        }

        switch key {
        case .savedItem:
            self = .savedItem(try container.decode(ServerSavedItemRecord.self, forKey: .savedItem))
        case .annotation:
            self = .annotation(try container.decode(ServerAnnotationRecord.self, forKey: .annotation))
        case .project:
            self = .project(try container.decode(ServerProjectRecord.self, forKey: .project))
        case .projectSection:
            self = .projectSection(try container.decode(ServerProjectSectionRecord.self, forKey: .projectSection))
        case .workboard:
            self = .workboard(try container.decode(ServerWorkboardRecord.self, forKey: .workboard))
        case .continuity:
            self = .continuity(try container.decode(ServerContinuityRecord.self, forKey: .continuity))
        case .codeVersionClear:
            self = .codeVersionClear(try container.decode(ServerContinuityRecord.self, forKey: .codeVersionClear))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .savedItem(let record):
            try container.encode(record, forKey: .savedItem)
        case .annotation(let record):
            try container.encode(record, forKey: .annotation)
        case .project(let record):
            try container.encode(record, forKey: .project)
        case .projectSection(let record):
            try container.encode(record, forKey: .projectSection)
        case .workboard(let record):
            try container.encode(record, forKey: .workboard)
        case .continuity(let record):
            try container.encode(record, forKey: .continuity)
        case .codeVersionClear(let record):
            try container.encode(record, forKey: .codeVersionClear)
        }
    }

    init(syncQueueItem item: SyncQueueItem, account: SignedInAccount) throws {
        let payload = item.payload
        let codeVersion = UserContentSyncCodeVersion.server(payload.codeVersion)
        let deletedAt = item.operationType == .delete ? item.mutationUpdatedAt : nil
        switch item.entityType {
        case .bookmark:
            guard let sectionID = payload.sectionID else {
                throw UserContentServerMappingError.missingSectionID(item.entityType)
            }
            self = .savedItem(
                ServerSavedItemRecord(
                    id: Self.recordID(account: account, type: "saved", codeVersion: codeVersion, sectionID: sectionID),
                    userID: account.appUserID,
                    codeVersion: codeVersion,
                    sectionID: sectionID,
                    updatedAt: item.mutationUpdatedAt,
                    deletedAt: deletedAt
                )
            )
        case .note:
            guard let sectionID = payload.sectionID else {
                throw UserContentServerMappingError.missingSectionID(item.entityType)
            }
            self = .annotation(
                ServerAnnotationRecord(
                    id: Self.recordID(
                        account: account,
                        type: "note",
                        codeVersion: codeVersion,
                        sectionID: sectionID,
                        blockID: payload.values["blockID"]
                    ),
                    userID: account.appUserID,
                    codeVersion: codeVersion,
                    sectionID: sectionID,
                    blockID: payload.values["blockID"],
                    noteBody: item.operationType == .delete ? nil : payload.values["body"],
                    tags: nil,
                    updatedAt: item.mutationUpdatedAt,
                    deletedAt: deletedAt
                )
            )
        case .tagSet:
            guard let sectionID = payload.sectionID else {
                throw UserContentServerMappingError.missingSectionID(item.entityType)
            }
            self = .annotation(
                ServerAnnotationRecord(
                    id: Self.recordID(
                        account: account,
                        type: "tags",
                        codeVersion: codeVersion,
                        sectionID: sectionID,
                        blockID: payload.values["blockID"]
                    ),
                    userID: account.appUserID,
                    codeVersion: codeVersion,
                    sectionID: sectionID,
                    blockID: payload.values["blockID"],
                    noteBody: nil,
                    tags: item.operationType == .delete ? nil : Self.tags(from: payload.values["tags"]),
                    updatedAt: item.mutationUpdatedAt,
                    deletedAt: deletedAt
                )
            )
        case .folder:
            guard let folderID = payload.folderID else {
                throw UserContentServerMappingError.missingFolderID(item.entityType)
            }
            let projectClientID = UserContentProjectIdentity.stable(
                payload.clientID ?? payload.values["clientID"],
                userID: account.appUserID
            )
            self = .project(
                ServerProjectRecord(
                    id: Self.recordID(
                        account: account,
                        type: "project",
                        codeVersion: codeVersion,
                        clientID: projectClientID,
                        folderID: folderID
                    ),
                    userID: account.appUserID,
                    codeVersion: codeVersion,
                    clientID: projectClientID,
                    localFolderID: folderID,
                    name: item.operationType == .delete ? nil : payload.values["name"],
                    address: item.operationType == .delete ? nil : payload.values["address"],
                    description: item.operationType == .delete ? nil : payload.values["description"],
                    structuredFacts: item.operationType == .delete ? nil : Self.structuredFacts(from: payload.values["structuredFacts"]),
                    colorHex: item.operationType == .delete ? nil : payload.values["colorHex"],
                    sortOrder: payload.values["sortOrder"].flatMap(Int.init),
                    folderType: CodeFolderType(serverValue: payload.values["folderType"]),
                    archivedAt: payload.values["archivedAt"].flatMap(ISO8601DateFormatter().date(from:)),
                    updatedAt: item.mutationUpdatedAt,
                    deletedAt: deletedAt
                )
            )
        case .folderSection:
            guard let sectionID = payload.sectionID else {
                throw UserContentServerMappingError.missingSectionID(item.entityType)
            }
            let folderClientID = UserContentProjectIdentity.stable(
                payload.values["folderClientID"],
                userID: account.appUserID
            )
            self = .projectSection(
                ServerProjectSectionRecord(
                    id: Self.recordID(
                        account: account,
                        type: "project-section",
                        codeVersion: codeVersion,
                        clientID: folderClientID,
                        folderID: payload.folderID,
                        sectionID: sectionID,
                        scope: payload.values["scope"]
                    ),
                    userID: account.appUserID,
                    codeVersion: codeVersion,
                    folderClientID: folderClientID,
                    folderType: CodeFolderType(serverValue: payload.values["folderType"]),
                    localFolderID: payload.folderID,
                    sectionID: sectionID,
                    scope: payload.values["scope"],
                    updatedAt: item.mutationUpdatedAt,
                    deletedAt: deletedAt
                )
            )
        case .continuity:
            self = .continuity(
                ServerContinuityRecord(
                    userID: account.appUserID,
                    codeVersion: codeVersion,
                    values: payload.values,
                    updatedAt: item.mutationUpdatedAt
                )
            )
        case .codeVersionUserData:
            self = .codeVersionClear(
                ServerContinuityRecord(
                    userID: account.appUserID,
                    codeVersion: codeVersion,
                    values: payload.values,
                    updatedAt: item.mutationUpdatedAt
                )
            )
        }
    }

    private static func tags(from rawValue: String?) -> [String]? {
        guard let rawValue else { return [] }
        return rawValue
            .split(separator: "\n")
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private static func structuredFacts(from rawValue: String?) -> [ProjectStructuredFact]? {
        guard let rawValue,
              let data = rawValue.data(using: .utf8)
        else { return nil }
        return try? JSONDecoder().decode([ProjectStructuredFact].self, from: data)
    }

    private static func recordID(
        account: SignedInAccount,
        type: String,
        codeVersion: String,
        clientID: String? = nil,
        folderID: Int64? = nil,
        sectionID: Int64? = nil,
        blockID: String? = nil,
        scope: String? = nil
    ) -> String {
        let normalizedClientID = UserContentProjectIdentity.stable(clientID, userID: account.appUserID)
        let projectIdentity = normalizedClientID?.isEmpty == false
            ? normalizedClientID
            : folderID.map(String.init)
        return [
            account.appUserID,
            type,
            codeVersion,
            projectIdentity,
            sectionID.map(String.init),
            blockID?.trimmingCharacters(in: .whitespacesAndNewlines),
            scope
        ]
        .compactMap { $0 }
        .filter { !$0.isEmpty }
        .joined(separator: ":")
    }

    var entityKind: ServerUserContentEntityKind {
        switch self {
        case .savedItem:
            return .savedItem
        case .annotation:
            return .annotation
        case .project:
            return .project
        case .projectSection:
            return .projectSection
        case .workboard:
            return .workboard
        case .continuity:
            return .continuity
        case .codeVersionClear:
            return .codeVersionClear
        }
    }

    var recordID: String {
        switch self {
        case .savedItem(let record):
            return record.id
        case .annotation(let record):
            return record.id
        case .project(let record):
            return record.id
        case .projectSection(let record):
            return record.id
        case .workboard(let record):
            return record.id
        case .continuity(let record):
            return [record.userID, "continuity", record.codeVersion].joined(separator: ":")
        case .codeVersionClear(let record):
            return [record.userID, "code-version-clear", record.codeVersion, record.values["scope"]]
                .compactMap { $0 }
                .filter { !$0.isEmpty }
                .joined(separator: ":")
        }
    }

    var updatedAt: Date {
        switch self {
        case .savedItem(let record):
            return record.updatedAt
        case .annotation(let record):
            return record.updatedAt
        case .project(let record):
            return record.updatedAt
        case .projectSection(let record):
            return record.updatedAt
        case .workboard(let record):
            return record.updatedAt
        case .continuity(let record), .codeVersionClear(let record):
            return record.updatedAt
        }
    }

    var deletedAt: Date? {
        switch self {
        case .savedItem(let record):
            return record.deletedAt
        case .annotation(let record):
            return record.deletedAt
        case .project(let record):
            return record.deletedAt
        case .projectSection(let record):
            return record.deletedAt
        case .workboard(let record):
            return record.deletedAt
        case .continuity, .codeVersionClear:
            return nil
        }
    }

    var serverEventID: Int64? {
        switch self {
        case .savedItem(let record):
            return record.serverEventID
        case .annotation(let record):
            return record.serverEventID
        case .project(let record):
            return record.serverEventID
        case .projectSection(let record):
            return record.serverEventID
        case .workboard(let record):
            return record.serverEventID
        case .continuity(let record), .codeVersionClear(let record):
            return record.serverEventID
        }
    }
}

struct ServerUserContentBatch: Codable, Hashable, Sendable {
    let user: ServerUserRecord
    let entitlement: ServerEntitlementRecord?
    let mutations: [ServerUserContentMutation]

    init(
        account: SignedInAccount,
        entitlement: AppEntitlement? = nil,
        syncQueueItems: [SyncQueueItem]
    ) throws {
        self.user = ServerUserRecord(
            id: account.appUserID,
            authProvider: account.authProvider,
            authProviderUserID: account.authProviderUserID,
            publicUsername: account.publicUsername,
            displayName: account.displayName,
            updatedAt: account.signedInAt
        )
        self.entitlement = entitlement.map {
            ServerEntitlementRecord(
                userID: account.appUserID,
                plan: $0.plan,
                source: $0.source,
                grantedUserID: $0.grantedUserID,
                updatedAt: Date()
            )
        }
        self.mutations = try syncQueueItems.map {
            try ServerUserContentMutation(syncQueueItem: $0, account: account)
        }
    }
}

enum PermitextCapabilityID: String, Codable, CaseIterable, Hashable, Sendable {
    case savedWork = "saved-work"
    case notes
    case projects
    case notebook
    case professionalExports = "professional-exports"
    case offlineAccess = "offline-access"
    case research
    case evidenceDiscovery = "evidence-discovery"
    case collaboration
    case organizationAdministration = "organization-administration"
}

struct PermitextCapabilityState: Codable, Hashable, Sendable {
    let enabled: Bool
    let limit: Int?
    let monthlyLimit: Int?
    let requiresPro: Bool?
}

struct PermitextPackageState: Codable, Hashable, Sendable {
    let active: Bool
    let requiresPro: Bool?
    let mode: String?
}

struct PermitextCapabilityContract: Codable, Hashable, Sendable {
    let schemaVersion: Int
    let plan: AppPlan
    let packages: [String: PermitextPackageState]?
    let capabilities: [String: PermitextCapabilityState]

    func enables(_ capability: PermitextCapabilityID) -> Bool {
        capabilities[capability.rawValue]?.enabled == true
    }
}

struct ServerUserContentPullResult: Codable, Hashable, Sendable {
    let userID: String
    let pulledAt: Date
    var latestEventID: Int64? = nil
    var syncRevision: Int64? = nil
    var contentMapVersion: Int? = nil
    var syncSchemaVersion: Int? = nil
    var entitlement: AppEntitlement? = nil
    var entitlementFingerprint: String? = nil
    var capabilityContract: PermitextCapabilityContract? = nil
    let mutations: [ServerUserContentMutation]
}

struct ServerUserContentCheckpointResult: Codable, Hashable, Sendable {
    let userID: String
    let checkedAt: Date
    let changed: Bool
    var latestEventID: Int64? = nil
    var syncRevision: Int64? = nil
    var contentMapVersion: Int? = nil
    var entitlementFingerprint: String? = nil
}

enum UserContentSyncClientPolicy {
    /// Mutation kinds the iPhone client never applies and should not download.
    static let excludedMutationKinds: [String] = [
        ServerUserContentEntityKind.workboard.rawValue
    ]
}

struct UserContentSyncCheckpoint: Codable, Hashable, Sendable {
    let accountUserID: String
    let backendName: String
    let lastSuccessfulPushAt: Date?
    let lastSuccessfulPullAt: Date?
    let lastAttemptedSyncAt: Date?
    let lastErrorMessage: String?
    let latestEventID: Int64?
    let contentMapVersion: Int?
    let entitlementFingerprint: String?

    init(
        accountUserID: String,
        backendName: String,
        lastSuccessfulPushAt: Date? = nil,
        lastSuccessfulPullAt: Date? = nil,
        lastAttemptedSyncAt: Date? = nil,
        lastErrorMessage: String? = nil,
        latestEventID: Int64? = nil,
        contentMapVersion: Int? = nil,
        entitlementFingerprint: String? = nil
    ) {
        self.accountUserID = accountUserID
        self.backendName = backendName
        self.lastSuccessfulPushAt = lastSuccessfulPushAt
        self.lastSuccessfulPullAt = lastSuccessfulPullAt
        self.lastAttemptedSyncAt = lastAttemptedSyncAt
        self.lastErrorMessage = lastErrorMessage
        self.latestEventID = latestEventID
        self.contentMapVersion = contentMapVersion
        self.entitlementFingerprint = entitlementFingerprint
    }

    func markingPushSucceeded(at date: Date, latestEventID: Int64? = nil) -> UserContentSyncCheckpoint {
        UserContentSyncCheckpoint(
            accountUserID: accountUserID,
            backendName: backendName,
            lastSuccessfulPushAt: date,
            lastSuccessfulPullAt: lastSuccessfulPullAt,
            lastAttemptedSyncAt: date,
            lastErrorMessage: nil,
            latestEventID: latestEventID ?? self.latestEventID,
            contentMapVersion: contentMapVersion,
            entitlementFingerprint: entitlementFingerprint
        )
    }

    func markingPullSucceeded(
        at date: Date,
        latestEventID: Int64? = nil,
        contentMapVersion: Int? = nil,
        entitlementFingerprint: String? = nil
    ) -> UserContentSyncCheckpoint {
        UserContentSyncCheckpoint(
            accountUserID: accountUserID,
            backendName: backendName,
            lastSuccessfulPushAt: lastSuccessfulPushAt,
            lastSuccessfulPullAt: date,
            lastAttemptedSyncAt: date,
            lastErrorMessage: nil,
            latestEventID: latestEventID ?? self.latestEventID,
            contentMapVersion: contentMapVersion ?? self.contentMapVersion,
            entitlementFingerprint: entitlementFingerprint ?? self.entitlementFingerprint
        )
    }

    func markingCheckpointChecked(
        at date: Date,
        latestEventID: Int64? = nil,
        contentMapVersion: Int? = nil,
        entitlementFingerprint: String? = nil
    ) -> UserContentSyncCheckpoint {
        UserContentSyncCheckpoint(
            accountUserID: accountUserID,
            backendName: backendName,
            lastSuccessfulPushAt: lastSuccessfulPushAt,
            lastSuccessfulPullAt: lastSuccessfulPullAt,
            lastAttemptedSyncAt: date,
            lastErrorMessage: nil,
            latestEventID: latestEventID ?? self.latestEventID,
            contentMapVersion: contentMapVersion ?? self.contentMapVersion,
            entitlementFingerprint: entitlementFingerprint ?? self.entitlementFingerprint
        )
    }

    func markingFailed(error: Error, at date: Date) -> UserContentSyncCheckpoint {
        UserContentSyncCheckpoint(
            accountUserID: accountUserID,
            backendName: backendName,
            lastSuccessfulPushAt: lastSuccessfulPushAt,
            lastSuccessfulPullAt: lastSuccessfulPullAt,
            lastAttemptedSyncAt: date,
            lastErrorMessage: error.localizedDescription,
            latestEventID: latestEventID,
            contentMapVersion: contentMapVersion,
            entitlementFingerprint: entitlementFingerprint
        )
    }
}

struct UserContentSyncCheckpointStore {
    private let defaults: UserDefaults
    private let keyPrefix = "permitext.sync.checkpoint"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load(accountUserID: String, backendName: String) -> UserContentSyncCheckpoint {
        let key = storageKey(accountUserID: accountUserID, backendName: backendName)
        guard
            let data = defaults.data(forKey: key),
            let checkpoint = try? JSONDecoder().decode(UserContentSyncCheckpoint.self, from: data)
        else {
            return UserContentSyncCheckpoint(accountUserID: accountUserID, backendName: backendName)
        }
        return checkpoint
    }

    func save(_ checkpoint: UserContentSyncCheckpoint) {
        guard let data = try? JSONEncoder().encode(checkpoint) else { return }
        defaults.set(data, forKey: storageKey(accountUserID: checkpoint.accountUserID, backendName: checkpoint.backendName))
    }

    func clear(accountUserID: String, backendName: String) {
        defaults.removeObject(forKey: storageKey(accountUserID: accountUserID, backendName: backendName))
    }

    private func storageKey(accountUserID: String, backendName: String) -> String {
        "\(keyPrefix).\(backendName).\(accountUserID)"
    }
}

struct BackendAuthContext: Codable, Hashable, Sendable {
    let accountUserID: String
    let bearerToken: String?
}

struct BackendSignInRequest: Codable, Hashable, Sendable {
    let credential: AccountSignInCredential
    let linkFrom: BackendAuthContext?
}

struct BackendSignOutRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
}

struct BackendSignOutResponse: Codable, Hashable, Sendable {
    let signedOut: Bool
}

struct BackendAccountDeleteRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let confirmation: String
}

struct BackendAccountDeleteResponse: Codable, Hashable, Sendable {
    struct BillingCancellation: Codable, Hashable, Sendable {
        struct StripeStatus: Codable, Hashable, Sendable {
            let status: String
            let subscriptionCount: Int
        }

        struct AppleStatus: Codable, Hashable, Sendable {
            let status: String
            let managementURL: String?
        }

        let stripe: StripeStatus
        let apple: AppleStatus
        let lifetimeGrantRemoved: Bool
    }

    let deleted: Bool
    let deletedPrivateAssetCount: Int
    let billingCancellation: BillingCancellation?
}

struct AccountDeletionExecutionResult: Sendable {
    let response: BackendAccountDeleteResponse
    let deviceCleanupError: String?
}

struct BackendAttachLocalDataRequest: Codable, Hashable, Sendable {
    let account: SignedInAccount
}

struct BackendProfileUpdateRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let publicUsername: String?
    let displayName: String?
}

struct BackendProfileUpdateResponse: Codable, Hashable, Sendable {
    let account: SignedInAccount
}

struct BackendPolicyVersions: Codable, Hashable, Sendable {
    let terms: String
    let privacy: String
    let subscriptionsAndRefunds: String
}

struct BackendPolicyDocument: Codable, Hashable, Sendable {
    let version: String
    let url: String
}

struct BackendPolicyDocuments: Codable, Hashable, Sendable {
    let terms: BackendPolicyDocument
    let privacy: BackendPolicyDocument
    let subscriptionsAndRefunds: BackendPolicyDocument
}

struct BackendCurrentPoliciesResponse: Codable, Hashable, Sendable {
    let configured: Bool
    let policySetID: String?
    let versions: BackendPolicyVersions?
    let documents: BackendPolicyDocuments?

    static let localDevelopment: BackendCurrentPoliciesResponse = {
        let versions = BackendPolicyVersions(
            terms: "local-dev-v1",
            privacy: "local-dev-v1",
            subscriptionsAndRefunds: "local-dev-v1"
        )
        return BackendCurrentPoliciesResponse(
            configured: true,
            policySetID: "local-development-policies",
            versions: versions,
            documents: BackendPolicyDocuments(
                terms: BackendPolicyDocument(version: versions.terms, url: "https://permitext.com/terms"),
                privacy: BackendPolicyDocument(version: versions.privacy, url: "https://permitext.com/privacy"),
                subscriptionsAndRefunds: BackendPolicyDocument(
                    version: versions.subscriptionsAndRefunds,
                    url: "https://permitext.com/refunds"
                )
            )
        )
    }()
}

struct BackendPolicyAcceptanceRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let platform: String
    let versions: BackendPolicyVersions
    let clientRelease: String
}

struct BackendPolicyAcceptanceRecord: Codable, Hashable, Sendable {
    let schemaVersion: Int
    let id: String
    let policySetID: String
    let versions: BackendPolicyVersions
    let documents: BackendPolicyDocuments
    let acceptedAt: Date
    let platform: String
    let clientRelease: String?
}

struct BackendPolicyAcceptanceResponse: Codable, Hashable, Sendable {
    let acceptance: BackendPolicyAcceptanceRecord
    let recorded: Bool
}

struct BackendAppleTransactionVerifyRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let signedTransactionInfo: String
    var productID: String? = nil
}

struct BackendAppleTransactionVerifyResponse: Codable, Hashable, Sendable {
    let entitlement: AppEntitlement?
    var credited: Bool? = nil
    var replayed: Bool? = nil
    var transaction: BackendAppleTransactionSummary? = nil
    var usage: ResearchTurnAllowance? = nil
}

struct BackendAppleTransactionSummary: Codable, Hashable, Sendable {
    var active: Bool? = nil
    var productID: String? = nil
    var packageID: String? = nil
    var packID: String? = nil
}

struct BackendAppleBillingAccountTokenRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
}

struct BackendAppleBillingAccountTokenResponse: Codable, Hashable, Sendable {
    let appAccountToken: UUID
}

struct ResearchTurnPack: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let turns: Int
    let webAvailable: Bool
    let appleProductID: String?
}

struct ResearchTurnAllowance: Codable, Hashable, Sendable {
    let includedLimit: Int
    let includedUsed: Int
    let includedRemaining: Int
    let purchasedRemaining: Int
    let totalRemaining: Int?
    let periodStart: Date
    let resetsAt: Date
    let canResearch: Bool
    let purchaseRequired: Bool
    let paidContinuationEnabled: Bool
    let canBuyMore: Bool
    let packs: [ResearchTurnPack]
    var mockMode: Bool? = nil
    var evidenceDiscoveryEnabled: Bool? = nil

    static let unavailable = ResearchTurnAllowance(
        includedLimit: 100,
        includedUsed: 0,
        includedRemaining: 100,
        purchasedRemaining: 0,
        totalRemaining: nil,
        periodStart: .distantPast,
        resetsAt: .distantFuture,
        canResearch: false,
        purchaseRequired: false,
        paidContinuationEnabled: false,
        canBuyMore: false,
        packs: []
    )
}

struct BackendResearchUsageRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
}

struct BackendResearchUsageResponse: Codable, Hashable, Sendable {
    let usage: ResearchTurnAllowance
}

struct BackendProjectFoundationRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let projectID: String
}

struct BackendProjectPropertyLookupRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let address: String
}

struct BackendProjectPropertyLookupSource: Codable, Hashable, Sendable {
    let agency: String
    let datasets: [String]
}

struct BackendProjectPropertyContext: Codable, Hashable, Sendable {
    let schemaVersion: Int
    let query: String
    let normalizedAddress: String
    let bbl: String
    let zolaURL: String
    let retrievedAt: Date
    let source: BackendProjectPropertyLookupSource
    let structuredFacts: [ProjectStructuredFact]
    let warnings: [String]
}

struct BackendProjectPropertyLookupResponse: Codable, Hashable, Sendable {
    let property: BackendProjectPropertyContext
}

struct BackendProjectHubBootstrapRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let projectID: String
}

struct BackendProjectHubBootstrapResponse: Codable, Hashable, Sendable {
    let schemaVersion: Int
    let projectID: String
    let foundation: BackendProjectFoundationResponse
    let notebook: BackendProjectNotebookCardsResponse
    let reports: BackendProjectReportHistoryResponse
}

struct ProjectResearchConversationSummary: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let title: String
    let createdAt: String
    let updatedAt: String
    let sourceCount: Int
    let messageCount: Int
    let primaryProjectID: String?
    let projectContextReviewRequired: Bool
    let sourceStatus: String
}

struct ProjectResearchAnswerSummary: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let conversationID: String
    let projectID: String?
    let question: String
    let conclusion: String
    let evidenceCount: Int
    let reviewStatus: String
    let createdAt: String
}

struct ProjectActivitySummary: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let projectID: String
    let actorUserID: String
    let action: String
    let objectKind: String
    let objectID: String
    let previousStatus: String?
    let newStatus: String?
    let createdAt: String
}

struct ProjectFoundationProjectSummary: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let sourceRecordID: String
    let name: String
    let address: String
    let description: String
    let colorHex: String?
    let archivedAt: String?
    let updatedAt: String
}

struct BackendProjectFoundationResponse: Codable, Hashable, Sendable {
    let schemaVersion: Int
    let researchConversations: [ProjectResearchConversationSummary]
    let researchAnswers: [ProjectResearchAnswerSummary]
    let activity: [ProjectActivitySummary]
    var projects: [ProjectFoundationProjectSummary]? = nil
    var links: [ProjectFoundationLinkSummary]? = nil
    var artifacts: [ProjectFoundationArtifact]? = nil
}

struct BackendProjectNotebookCardsRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let projectID: String
}

struct ProjectNotebookCardSummary: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let version: Int
    let cardType: String
    let title: String
    let plainText: String
    let referenceCount: Int
    let createdAt: String
    let updatedAt: String
}

struct BackendProjectNotebookCardsResponse: Codable, Hashable, Sendable {
    let schemaVersion: Int
    let projectID: String
    let cards: [ProjectNotebookCardSummary]
}

struct BackendProjectReportHistoryRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let projectID: String
}

struct ProjectReportAuthor: Codable, Hashable, Sendable {
    let userID: String
    let displayName: String
}

struct ProjectReportFile: Codable, Hashable, Identifiable, Sendable {
    let generatedReportID: String
    let manifestID: String
    let reportVersion: Int
    let format: String
    let contentType: String
    let size: Int
    let contentHash: String
    let createdAt: String

    var id: String { generatedReportID }
}

struct ProjectReportSummary: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let projectID: String
    let draftID: String
    let title: String
    let reportDate: String
    let author: ProjectReportAuthor
    let codeEdition: String
    let reportVersion: Int
    let itemCount: Int
    let contentHash: String
    let generatorVersion: String
    let createdAt: String
    let files: [ProjectReportFile]?
}

struct BackendProjectReportHistoryResponse: Codable, Hashable, Sendable {
    let schemaVersion: Int
    let projectID: String
    let reports: [ProjectReportSummary]
}

struct BackendProjectReportManifestRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let manifestID: String
}

struct ProjectReportProject: Codable, Hashable, Sendable {
    let id: String
    let name: String
    let address: String
    let description: String
}

struct ProjectReportOrganizationPresentation: Codable, Hashable, Sendable {
    let id: String
    let name: String
}

struct ProjectReportTemplatePresentation: Codable, Hashable, Sendable {
    let id: String
    let name: String
    let coverLabel: String
}

struct ProjectReportBrandingPresentation: Codable, Hashable, Sendable {
    let displayName: String
    let accentColorHex: String
    let website: String?
    let footerText: String?
}

struct ProjectReportPresentation: Codable, Hashable, Sendable {
    let firmControlsVersion: Int
    let organization: ProjectReportOrganizationPresentation?
    let template: ProjectReportTemplatePresentation
    let branding: ProjectReportBrandingPresentation
}

struct ProjectReportCitation: Codable, Hashable, Sendable {
    let sectionID: String?
    let sourceIDs: [String]?
    let evidenceSnapshotIDs: [String]?
    let relevance: String?
}

struct ProjectReportEvidenceSnapshot: Codable, Hashable, Sendable {
    let id: String?
    let sectionID: String?
    let sectionNumber: String?
    let passageText: String?
    let passageTextHash: String?
}

struct ProjectReportManifestItem: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let kind: String
    let order: Int
    let sourceClassification: String
    let text: String?
    let items: [String]?
    let sourceID: String?
    let title: String?
    let sectionID: String?
    let sectionNumber: String?
    let codeBook: String?
    let chapter: String?
    let passageText: String?
    let passageTextHash: String?
    let sourceLibraryVersion: String?
    let cardID: String?
    let cardType: String?
    let plainText: String?
    let answerID: String?
    let conversationID: String?
    let question: String?
    let conclusion: String?
    let explanation: String?
    let assumptions: [String]?
    let missingFacts: [String]?
    let limitations: [String]?
    let additionalEvidenceNeeded: [String]?
    let citations: [ProjectReportCitation]?
    let evidence: [ProjectReportEvidenceSnapshot]?
    let reviewStatus: String?
    let contentType: String?
    let contentHash: String?
    let readPath: String?
}

struct ProjectReportManifest: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let immutable: Bool
    let schemaVersion: Int
    let generatorVersion: String
    let project: ProjectReportProject
    let draftID: String
    let title: String
    let reportDate: String
    let author: ProjectReportAuthor
    let codeEdition: String
    let items: [ProjectReportManifestItem]
    let disclaimers: [String]
    let presentation: ProjectReportPresentation?
    let reportVersion: Int
    let sourceVersions: [String: StringOrNumber]
    let createdAt: String
    let contentHash: String
}

enum StringOrNumber: Codable, Hashable, Sendable {
    case string(String)
    case number(Double)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(String.self) {
            self = .string(value)
        } else {
            self = .number(try container.decode(Double.self))
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        }
    }
}

struct BackendProjectReportManifestResponse: Codable, Hashable, Sendable {
    let manifest: ProjectReportManifest
    let files: [ProjectReportFile]?
}

struct BackendProjectReportFileUploadRequest: Hashable, Sendable {
    let auth: BackendAuthContext
    let projectID: String
    let manifestID: String
    let format: String
}

struct BackendProjectReportFileUploadResponse: Codable, Hashable, Sendable {
    let file: ProjectReportFile
}

struct ProjectHubSnapshot: Codable, Hashable, Sendable {
    let projectID: String
    let notebookCards: [ProjectNotebookCardSummary]
    let researchConversations: [ProjectResearchConversationSummary]
    let researchAnswers: [ProjectResearchAnswerSummary]
    let activity: [ProjectActivitySummary]
    let reports: [ProjectReportSummary]
    var foundationArtifacts: [ProjectFoundationArtifact] = []
    var loadedFromCache: Bool = false
    var cachedAt: String? = nil

    static func empty(projectID: String) -> ProjectHubSnapshot {
        ProjectHubSnapshot(
            projectID: projectID,
            notebookCards: [],
            researchConversations: [],
            researchAnswers: [],
            activity: [],
            reports: [],
            foundationArtifacts: []
        )
    }

    func cachedCopy(at timestamp: String) -> ProjectHubSnapshot {
        var copy = self
        copy.loadedFromCache = true
        copy.cachedAt = timestamp
        return copy
    }
}

struct PermitextOrganizationCapabilities: Codable, Hashable, Sendable {
    let collaboration: Bool
    let organizationAdministration: Bool
    let authoredCollaboration: Bool
    let sharedEvidenceReview: Bool
    let sharedWorkboardEditing: Bool
}

struct PermitextOrganizationBillingIdentity: Codable, Hashable, Sendable {
    let mode: String
    let status: String
    let seatLimit: Int
}

struct PermitextOrganizationBillingOperations: Codable, Hashable, Sendable {
    let authority: String
    let clientMutable: Bool
    let status: String
}

struct PermitextFirmTag: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let name: String
    let colorHex: String
    let status: String
    let createdAt: String
    let updatedAt: String
    let order: Int
}

struct PermitextFirmReportTemplate: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let name: String
    let description: String?
    let coverLabel: String
    let disclaimers: [String]
    let status: String
    let createdAt: String
    let updatedAt: String
    let order: Int
}

struct PermitextFirmBranding: Codable, Hashable, Sendable {
    let displayName: String
    let accentColorHex: String
    let website: String?
    let footerText: String?
}

struct PermitextFirmResearchAllowance: Codable, Hashable, Sendable {
    let mode: String
    let monthlyUnits: Int
    let resetDayUTC: Int
    let authority: String
}

struct PermitextFirmRetentionPolicy: Codable, Hashable, Sendable {
    let retentionDays: Int
    let enforcement: String
    let automaticDeletionEnabled: Bool
}

struct PermitextFirmControls: Codable, Hashable, Sendable {
    let schemaVersion: Int
    let version: Int
    let tags: [PermitextFirmTag]
    let projectTagAssignments: [String: [String]]
    let reportTemplates: [PermitextFirmReportTemplate]
    let defaultReportTemplateID: String
    let branding: PermitextFirmBranding
    let requiredDisclaimers: [String]
    let researchAllowance: PermitextFirmResearchAllowance
    let retentionPolicy: PermitextFirmRetentionPolicy
    let updatedAt: String
    let updatedByUserID: String?
}

struct PermitextFirmResearchUsage: Codable, Hashable, Sendable {
    let mode: String
    let authority: String
    let requestsUsed: Int
    let requestLimit: Int
    let monthlyUnits: Int
    let activeSeats: Int
    let resetDate: String
    let totalTokens: Int
}

struct PermitextOrganizationSeatUsage: Codable, Hashable, Sendable {
    let active: Int
    let pending: Int
    let used: Int
}

struct PermitextOrganizationProject: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let sourceRecordID: String
    let name: String
    let address: String
    let description: String
    let colorHex: String?
    let archivedAt: String?
    let updatedAt: String
    let originalOwnerUserID: String?
    let role: String
    let permissions: [String]
}

struct PermitextOrganization: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let schemaVersion: Int
    let name: String
    let slug: String
    let status: String
    let capabilities: PermitextOrganizationCapabilities
    let billingIdentity: PermitextOrganizationBillingIdentity
    let billingOperations: PermitextOrganizationBillingOperations?
    let firmControls: PermitextFirmControls?
    let researchUsage: PermitextFirmResearchUsage?
    let role: String?
    let permissions: [String]
    let accessScope: String
    let seats: PermitextOrganizationSeatUsage?
    let projects: [PermitextOrganizationProject]?
    let createdAt: String
    let updatedAt: String
}

struct BackendOrganizationListRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
}

struct BackendOrganizationListResponse: Codable, Hashable, Sendable {
    let organizations: [PermitextOrganization]
}

struct BackendOrganizationInvitationAcceptRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let invitationToken: String
}

struct BackendOrganizationInvitationSummary: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let organizationID: String
    let projectID: String?
    let role: String
    let status: String
    let state: String?
}

struct BackendOrganizationInvitationAcceptResponse: Codable, Hashable, Sendable {
    let organization: PermitextOrganization
    let invitation: BackendOrganizationInvitationSummary
}

struct ProjectFoundationLinkSummary: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let projectID: String
    let targetKind: String
    let targetID: String
    let relationship: String
    let deletedAt: String?
}

struct ProjectFoundationArtifactEnvelope: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let type: String
    let createdAt: String
    let updatedAt: String
    let deletedAt: String?
    let version: Int
}

struct ProjectFoundationArtifactFile: Codable, Hashable, Sendable {
    let format: String
    let pathname: String?
    let contentType: String
    let size: Int
    let contentHash: String
    let createdAt: String
}

struct ProjectCodeQuestionEvidenceEntry: Codable, Hashable, Sendable {
    let snapshotID: String
    let role: String
    let analysisEligible: Bool
    let qualification: String?
    let professionalNote: String?
    let approvalActor: String?
    let approvalAt: String?
    let sourceVerificationState: String?
    let projectApplicabilityNote: String?
}

struct ProjectCodeQuestionReadinessCheck: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let label: String
    let ready: Bool
    let message: String
}

struct ProjectFoundationArtifactPayload: Codable, Hashable, Sendable {
    let schemaVersion: Int?
    let id: String?
    let projectID: String?
    let cardType: String?
    let title: String?
    let body: String?
    let plainText: String?
    let referenceCount: Int?
    let createdAt: String?
    let updatedAt: String?
    let createdBy: String?
    let updatedBy: String?
    let createdByUserID: String?
    let createdByDisplayName: String?
    let updatedByDisplayName: String?
    let kind: String?
    let targetKind: String?
    let targetID: String?
    let threadID: String?
    let resolvedByUserID: String?
    let resolvedByDisplayName: String?
    let resolvedAt: String?
    let manifestID: String?
    let reportVersion: Int?
    let file: ProjectFoundationArtifactFile?
    let answerID: String?
    let status: String?
    let note: String?
    let evidenceSnapshotIDs: [String]?
    let updatedByUserID: String?
    let reviewedByUserID: String?
    let reviewedAt: String?
    // Code Question workspace (Phase 1): optional fields so new records decode
    // without discarding the whole foundation payload. Unknown envelope types
    // remain String-typed and unknown JSON keys are ignored by Codable.
    let displayID: String?
    let questionNumber: Int?
    let questionText: String?
    let questionID: String?
    let recordState: String?
    let definitionRevision: Int?
    let requestType: String?
    let reviewRound: Int?
    let issueVersion: Int?
    let reportManifestID: String?
    let inputKind: String?
    let statement: String?
    let scope: String?
    let desiredOutput: String?
    let jurisdiction: String?
    let asOfDate: String?
    let responsibleUserID: String?
    let assigneeUserID: String?
    let reviewerUserID: String?
    let currentEvidenceSetVersion: Int?
    let currentAnalysisID: String?
    let currentConclusionRevision: Int?
    let latestIssuedRecordID: String?
    let archivedAt: String?
    let state: String?
    let basis: String?
    let revision: Int?
    let priorInputID: String?
    let sourceIdentity: String?
    let passageLocator: String?
    let quotedText: String?
    let textHash: String?
    let sourceVersion: StringOrNumber?
    let entries: [ProjectCodeQuestionEvidenceEntry]?
    let contentHash: String?
    let definitionHash: String?
    let inputSnapshotIDs: [String]?
    let inputSetHash: String?
    let evidenceSetID: String?
    let evidenceSetVersion: Int?
    let evidenceSetHash: String?
    let dependencyHash: String?
    let researchAnswerID: String?
    let modelID: String?
    let analysisPolicyID: String?
    let promptTemplateVersion: String?
    let requestedBy: String?
    let requestID: String?
    let citationValidation: String?
    let analysisRunID: String?
    let analysisDependencyHash: String?
    let conclusionText: String?
    let reasoning: String?
    let citations: [String]?
    let assumptions: [String]?
    let unknowns: [String]?
    let aiAssistanceDisclosure: String?
    let predecessorRevisionID: String?
    let authorUserID: String?
    let conclusionID: String?
    let conclusionRevision: Int?
    let approvalBasis: String?
    let approvedByUserID: String?
    let approvedAt: String?
    let draftID: String?
    let draftRevision: Int?
    let draftHash: String?
    let conclusionHash: String?
    let checks: [ProjectCodeQuestionReadinessCheck]?
    let markedByUserID: String?
    let markedAt: String?
    let componentVersions: [String: StringOrNumber]?
    let componentHashes: [String: String]?
    let issuingActor: String?
    let predecessorID: String?
    let successorID: String?
    let supersessionReason: String?
    let issuedAt: String?
    let sourceKind: String?
    let sourceID: String?
    let sourceLabel: String?
    let sourceProjectID: String?
    let action: String?
    let unlinkedAt: String?
    let recoveryCount: Int?
}

struct ProjectFoundationArtifact: Codable, Hashable, Identifiable, Sendable {
    let envelope: ProjectFoundationArtifactEnvelope
    let payload: ProjectFoundationArtifactPayload

    var id: String { envelope.id }

    var notebookCard: ProjectNotebookCardSummary? {
        guard envelope.type == "notebookCard",
              envelope.deletedAt == nil,
              let cardType = payload.cardType,
              let title = payload.title else {
            return nil
        }
        return ProjectNotebookCardSummary(
            id: envelope.id,
            version: envelope.version,
            cardType: cardType,
            title: title,
            plainText: payload.plainText ?? "",
            referenceCount: payload.referenceCount ?? 0,
            createdAt: payload.createdAt ?? envelope.createdAt,
            updatedAt: payload.updatedAt ?? envelope.updatedAt
        )
    }

    var generatedReportFile: ProjectReportFile? {
        guard envelope.type == "generatedReport",
              envelope.deletedAt == nil,
              let manifestID = payload.manifestID,
              let reportVersion = payload.reportVersion,
              let file = payload.file else {
            return nil
        }
        return ProjectReportFile(
            generatedReportID: envelope.id,
            manifestID: manifestID,
            reportVersion: reportVersion,
            format: file.format,
            contentType: file.contentType,
            size: file.size,
            contentHash: file.contentHash,
            createdAt: payload.createdAt ?? file.createdAt
        )
    }
}

enum ProjectCodeQuestionStage: String, Codable, Hashable, Sendable {
    case define
    case evidence
    case analyze
    case review
    case issue

    var label: String { rawValue.capitalized }
}

struct ProjectCodeQuestionRecord: Hashable, Identifiable, Sendable {
    let question: ProjectFoundationArtifact
    let inputs: [ProjectFoundationArtifact]
    let evidenceSets: [ProjectFoundationArtifact]
    let evidenceSnapshots: [ProjectFoundationArtifact]
    let analyses: [ProjectFoundationArtifact]
    let conclusions: [ProjectFoundationArtifact]
    let conclusionApprovals: [ProjectFoundationArtifact]
    let reviewRequests: [ProjectFoundationArtifact]
    let memoReadiness: [ProjectFoundationArtifact]
    let memoApprovals: [ProjectFoundationArtifact]
    let issuedRecords: [ProjectFoundationArtifact]
    let promotions: [ProjectFoundationArtifact]
    let researchAnswer: ProjectResearchAnswerSummary?

    var id: String { question.id }
    var displayID: String { question.payload.displayID ?? "Question" }
    var title: String { question.payload.title ?? "Code Question" }
    var questionText: String { question.payload.questionText ?? "" }
    var definitionRevision: Int { question.payload.definitionRevision ?? 1 }

    var latestEvidenceSet: ProjectFoundationArtifact? {
        evidenceSets.max {
            ($0.payload.evidenceSetVersion ?? $0.payload.revision ?? 0) <
                ($1.payload.evidenceSetVersion ?? $1.payload.revision ?? 0)
        }
    }

    var latestAnalysis: ProjectFoundationArtifact? {
        if let currentID = question.payload.currentAnalysisID,
           let current = analyses.first(where: { $0.id == currentID }) {
            return current
        }
        return analyses.max { $0.envelope.createdAt < $1.envelope.createdAt }
    }

    var latestConclusion: ProjectFoundationArtifact? {
        conclusions.max { ($0.payload.revision ?? 0) < ($1.payload.revision ?? 0) }
    }

    var latestIssuedRecord: ProjectFoundationArtifact? {
        if let currentID = question.payload.latestIssuedRecordID,
           let current = issuedRecords.first(where: { $0.id == currentID }) {
            return current
        }
        return issuedRecords.max { ($0.payload.issueVersion ?? 0) < ($1.payload.issueVersion ?? 0) }
    }

    var openReviewCount: Int {
        reviewRequests.filter { ["open", "waiting"].contains($0.payload.status ?? "open") }.count
    }

    var stage: ProjectCodeQuestionStage {
        if !issuedRecords.isEmpty || !memoApprovals.isEmpty || !memoReadiness.isEmpty { return .issue }
        if !conclusions.isEmpty || !conclusionApprovals.isEmpty || !reviewRequests.isEmpty { return .review }
        if !analyses.isEmpty { return .analyze }
        if !evidenceSets.isEmpty { return .evidence }
        return .define
    }

    var stateLabel: String {
        if let issued = latestIssuedRecord {
            return issued.payload.status == "superseded"
                ? "Superseded v\(issued.payload.issueVersion ?? 1)"
                : "Issued v\(issued.payload.issueVersion ?? 1)"
        }
        if openReviewCount > 0 { return "\(openReviewCount) open review" + (openReviewCount == 1 ? "" : "s") }
        return stage.label
    }

    var analysisIsStale: Bool {
        guard let analysis = latestAnalysis else { return false }
        if analysis.payload.definitionRevision != definitionRevision { return true }
        if let currentEvidenceVersion = question.payload.currentEvidenceSetVersion,
           analysis.payload.evidenceSetVersion != currentEvidenceVersion {
            return true
        }
        return false
    }

    static func records(
        artifacts: [ProjectFoundationArtifact],
        researchAnswers: [ProjectResearchAnswerSummary]
    ) -> [ProjectCodeQuestionRecord] {
        let current = artifacts.filter { $0.envelope.deletedAt == nil }
        let snapshotsByID = Dictionary(
            uniqueKeysWithValues: current
                .filter { $0.envelope.type == "evidenceSnapshotV2" }
                .map { ($0.id, $0) }
        )
        return current
            .filter { $0.envelope.type == "codeQuestion" }
            .map { question in
                let questionID = question.id
                let related: (String) -> [ProjectFoundationArtifact] = { type in
                    current.filter {
                        $0.envelope.type == type && $0.payload.questionID == questionID
                    }
                }
                let evidenceSets = related("questionEvidenceSet")
                let snapshotIDs = Set(
                    evidenceSets.flatMap { ($0.payload.entries ?? []).map(\.snapshotID) }
                )
                let analyses = related("questionAnalysis")
                let answerID = question.payload.currentAnalysisID
                    .flatMap { currentID in analyses.first { $0.id == currentID }?.payload.researchAnswerID }
                    ?? analyses.max { $0.envelope.createdAt < $1.envelope.createdAt }?.payload.researchAnswerID
                return ProjectCodeQuestionRecord(
                    question: question,
                    inputs: related("questionInput").sorted { $0.envelope.createdAt < $1.envelope.createdAt },
                    evidenceSets: evidenceSets.sorted {
                        ($0.payload.evidenceSetVersion ?? 0) < ($1.payload.evidenceSetVersion ?? 0)
                    },
                    evidenceSnapshots: snapshotIDs.compactMap { snapshotsByID[$0] }.sorted {
                        ($0.payload.passageLocator ?? $0.id) < ($1.payload.passageLocator ?? $1.id)
                    },
                    analyses: analyses.sorted { $0.envelope.createdAt < $1.envelope.createdAt },
                    conclusions: related("professionalConclusion").sorted {
                        ($0.payload.revision ?? 0) < ($1.payload.revision ?? 0)
                    },
                    conclusionApprovals: related("conclusionApproval"),
                    reviewRequests: current.filter {
                        $0.envelope.type == "reviewThread" && $0.payload.questionID == questionID
                    }.sorted { $0.envelope.updatedAt > $1.envelope.updatedAt },
                    memoReadiness: related("codeMemoReadiness"),
                    memoApprovals: related("codeMemoApproval"),
                    issuedRecords: related("issuedDecisionRecord").sorted {
                        ($0.payload.issueVersion ?? 0) < ($1.payload.issueVersion ?? 0)
                    },
                    promotions: related("codeQuestionPromotion").sorted {
                        ($0.payload.sourceLabel ?? $0.payload.sourceID ?? "") <
                            ($1.payload.sourceLabel ?? $1.payload.sourceID ?? "")
                    },
                    researchAnswer: answerID.flatMap { id in researchAnswers.first { $0.id == id } }
                )
            }
            .sorted {
                let lhsNumber = $0.question.payload.questionNumber ?? Int.max
                let rhsNumber = $1.question.payload.questionNumber ?? Int.max
                return lhsNumber == rhsNumber ? $0.title < $1.title : lhsNumber < rhsNumber
            }
    }
}

struct PermitextOrganizationProjectAccess: Codable, Hashable, Sendable {
    let role: String
    let permissions: [String]
    let readOnly: Bool
    let organization: PermitextOrganization?
}

struct BackendOrganizationProjectSnapshotRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let projectID: String
}

struct BackendOrganizationProjectSnapshotResponse: Codable, Hashable, Sendable {
    let access: PermitextOrganizationProjectAccess
    let project: BackendProjectFoundationResponse
}

struct BackendProjectReportFileReadRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let projectID: String
    let generatedReportID: String
}

private struct BackendErrorResponse: Codable, Hashable, Sendable {
    let error: String?
    let code: String?
    let conversation: ResearchConversation?
}

struct BackendUserContentPushRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let batch: ServerUserContentBatch
    var syncSchemaVersion: Int = 2
    var clientCapabilities: [String] = PermitextCapabilityID.allCases.map(\.rawValue)
}

struct BackendUserContentRejection: Codable, Hashable, Sendable {
    let code: String
    let message: String
}

struct BackendUserContentPushResponse: Codable, Hashable, Sendable {
    let acceptedMutationIDs: [String]
    let rejectedMutationIDs: [String]?
    let rejectionReasons: [String: BackendUserContentRejection]?
    var latestEventID: Int64? = nil
    var syncRevision: Int64? = nil
    var entitlement: AppEntitlement? = nil
    var capabilityContract: PermitextCapabilityContract? = nil
    var syncSchemaVersion: Int? = nil
    let serverTime: Date
}

struct BackendUserContentPullRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let since: Date?
    var sinceEventID: Int64? = nil
    var contentMapVersion: Int? = nil
    var excludedMutationKinds: [String] = []
    var syncSchemaVersion: Int = 2
    var clientCapabilities: [String] = PermitextCapabilityID.allCases.map(\.rawValue)
}

struct BackendUserContentCheckpointRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    var sinceEventID: Int64? = nil
    var contentMapVersion: Int? = nil
    var entitlementFingerprint: String? = nil
}

struct BackendHealthStatus: Codable, Hashable, Sendable {
    let ok: Bool
    let storage: String?
}

protocol PermitextBackendTransport {
    var name: String { get }
    func health() async throws -> BackendHealthStatus
    func signIn(_ request: BackendSignInRequest) async throws -> BackendAccountRecord
    func signOut(_ request: BackendSignOutRequest) async throws -> BackendSignOutResponse
    func deleteAccount(_ request: BackendAccountDeleteRequest) async throws -> BackendAccountDeleteResponse
    func attachLocalData(_ request: BackendAttachLocalDataRequest) async throws -> AccountMigrationState
    func updateProfile(_ request: BackendProfileUpdateRequest) async throws -> BackendProfileUpdateResponse
    func currentPolicies() async throws -> BackendCurrentPoliciesResponse
    func recordPolicyAcceptance(_ request: BackendPolicyAcceptanceRequest) async throws -> BackendPolicyAcceptanceResponse
    func appleBillingAccountToken(_ request: BackendAppleBillingAccountTokenRequest) async throws -> BackendAppleBillingAccountTokenResponse
    func verifyAppleTransaction(_ request: BackendAppleTransactionVerifyRequest) async throws -> BackendAppleTransactionVerifyResponse
    func researchUsage(_ request: BackendResearchUsageRequest) async throws -> BackendResearchUsageResponse
    func organizations(_ request: BackendOrganizationListRequest) async throws -> BackendOrganizationListResponse
    func acceptOrganizationInvitation(
        _ request: BackendOrganizationInvitationAcceptRequest
    ) async throws -> BackendOrganizationInvitationAcceptResponse
    func organizationProjectSnapshot(
        _ request: BackendOrganizationProjectSnapshotRequest
    ) async throws -> BackendOrganizationProjectSnapshotResponse
    func projectFoundation(_ request: BackendProjectFoundationRequest) async throws -> BackendProjectFoundationResponse
    func projectPropertyLookup(_ request: BackendProjectPropertyLookupRequest) async throws -> BackendProjectPropertyLookupResponse
    func projectHubBootstrap(_ request: BackendProjectHubBootstrapRequest) async throws -> BackendProjectHubBootstrapResponse
    func projectNotebookCards(_ request: BackendProjectNotebookCardsRequest) async throws -> BackendProjectNotebookCardsResponse
    func researchConversationList(_ request: ResearchConversationListRequest) async throws -> ResearchConversationListResponse
    func researchConversationGet(_ request: ResearchConversationGetRequest) async throws -> ResearchConversationResponse
    func researchConversationRefresh(_ request: ResearchConversationRefreshRequest) async throws -> ResearchConversationResponse
    func researchProjectContextReview(_ request: ResearchProjectContextReviewRequest) async throws -> ResearchConversationResponse
    func researchSelectionReview(_ request: ResearchSelectionReviewRequest) async throws -> ResearchSelectionReviewResponse
    func researchConversationCreate(_ request: ResearchConversationCreateRequest) async throws -> ResearchConversationResponse
    func researchConversationAddEvidence(_ request: ResearchConversationEvidenceRequest) async throws -> ResearchConversationEvidenceResponse
    func researchConversationMessage(_ request: ResearchConversationMessageRequest) async throws -> ResearchConversationMessageResponse
    func researchFeedback(_ request: ResearchFeedbackRequest) async throws -> ResearchFeedbackResponse
    func researchConversationRename(_ request: ResearchConversationRenameRequest) async throws -> ResearchConversationResponse
    func researchConversationAssignProject(_ request: ResearchConversationAssignProjectRequest) async throws -> ResearchConversationResponse
    func researchConversationDelete(_ request: ResearchConversationDeleteRequest) async throws -> ResearchConversationDeleteResponse
    func notebookCardList(_ request: NotebookCardListRequest) async throws -> NotebookCardListResponse
    func notebookCardGet(_ request: NotebookCardGetRequest) async throws -> NotebookCardResponse
    func notebookCardSave(_ request: NotebookCardSaveRequest) async throws -> NotebookCardResponse
    func notebookCardDelete(_ request: NotebookCardDeleteRequest) async throws -> NotebookCardDeleteResponse
    func notebookAssetUpload(_ request: NotebookAssetUploadRequest, data: Data) async throws -> NotebookAssetUploadResponse
    func notebookAsset(_ request: NotebookAssetReadRequest) async throws -> Data
    func projectReportHistory(_ request: BackendProjectReportHistoryRequest) async throws -> BackendProjectReportHistoryResponse
    func projectReportManifest(_ request: BackendProjectReportManifestRequest) async throws -> BackendProjectReportManifestResponse
    func projectReportFileUpload(
        _ request: BackendProjectReportFileUploadRequest,
        data: Data
    ) async throws -> BackendProjectReportFileUploadResponse
    func projectReportFile(_ request: BackendProjectReportFileReadRequest) async throws -> Data
    func pushUserContent(_ request: BackendUserContentPushRequest) async throws -> BackendUserContentPushResponse
    func pullUserContent(_ request: BackendUserContentPullRequest) async throws -> ServerUserContentPullResult
    func checkpointUserContent(_ request: BackendUserContentCheckpointRequest) async throws -> ServerUserContentCheckpointResult
}

enum PermitextBackendMode: String, Codable, Hashable, Sendable {
    case localDev
    case http
}

struct PermitextBackendConfiguration: Codable, Hashable, Sendable {
    static let modeDefaultsKey = "permitext.backend.mode"
    static let apiBaseURLDefaultsKey = "permitext.backend.apiBaseURL"
    static let apiBaseURLInfoPlistKey = "PermitextBackendAPIBaseURL"
    static let appleSandboxStagingHost = "permitext-apple-sandbox.vercel.app"

    let mode: PermitextBackendMode
    let apiBaseURLString: String?

    static func load(
        defaults: UserDefaults = .standard,
        bundle: Bundle = .main
    ) -> PermitextBackendConfiguration {
        let storedMode = defaults.string(forKey: modeDefaultsKey)
            .flatMap(PermitextBackendMode.init(rawValue:))
        let defaultsBaseURL = defaults.string(forKey: apiBaseURLDefaultsKey)
        let bundleBaseURL = bundle.object(forInfoDictionaryKey: apiBaseURLInfoPlistKey) as? String
        #if DEBUG
        let apiBaseURLString = resolvedAPIBaseURLString(
            defaultsBaseURL: defaultsBaseURL,
            bundleBaseURL: bundleBaseURL,
            allowsDebugOverride: true
        )
        let mode = apiBaseURLString == nil ? (storedMode ?? .localDev) : .http
        #else
        let apiBaseURLString = resolvedAPIBaseURLString(
            defaultsBaseURL: defaultsBaseURL,
            bundleBaseURL: bundleBaseURL,
            allowsDebugOverride: false
        )
        let mode: PermitextBackendMode = .http
        #endif

        return PermitextBackendConfiguration(
            mode: mode,
            apiBaseURLString: apiBaseURLString
        )
    }

    static func resolvedAPIBaseURLString(
        defaultsBaseURL: String?,
        bundleBaseURL: String?,
        allowsDebugOverride: Bool
    ) -> String? {
        let trimmedDefaultsBaseURL = defaultsBaseURL?.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedBundleBaseURL = bundleBaseURL?.trimmingCharacters(in: .whitespacesAndNewlines)
        if allowsDebugOverride, trimmedDefaultsBaseURL?.isEmpty == false {
            return trimmedDefaultsBaseURL
        }
        return trimmedBundleBaseURL?.isEmpty == false ? trimmedBundleBaseURL : nil
    }

    static func allowsAppleSandboxBackendVerification(apiBaseURLString: String?) -> Bool {
        guard let apiBaseURLString,
              let components = URLComponents(string: apiBaseURLString),
              components.scheme?.lowercased() == "https",
              components.host?.lowercased() == appleSandboxStagingHost,
              components.user == nil,
              components.password == nil
        else { return false }
        return true
    }

    func makeTransport() -> PermitextBackendTransport {
        switch mode {
        case .http:
            #if DEBUG
            let allowsInsecureLocalhost = true
            #else
            let allowsInsecureLocalhost = false
            #endif
            guard let baseURL = Self.validatedHTTPBaseURL(
                apiBaseURLString,
                allowsInsecureLocalhost: allowsInsecureLocalhost
            ) else { return PermitextBackendHTTPTransport(baseURL: Self.configurationFailureURL) }
            return PermitextBackendHTTPTransport(baseURL: baseURL)
        case .localDev:
            #if DEBUG
            return LocalPermitextBackendTransport()
            #else
            return PermitextBackendHTTPTransport(baseURL: Self.configurationFailureURL)
            #endif
        }
    }

    static func validatedHTTPBaseURL(
        _ value: String?,
        allowsInsecureLocalhost: Bool
    ) -> URL? {
        guard let value,
              let url = URL(string: value),
              let scheme = url.scheme?.lowercased(),
              let host = url.host,
              !host.isEmpty
        else { return nil }
        if scheme == "https" { return url }
        if allowsInsecureLocalhost,
           scheme == "http",
           host == "localhost" || host == "127.0.0.1" || host == "::1" {
            return url
        }
        return nil
    }

    private static let configurationFailureURL = URL(string: "https://permitext-backend-not-configured.invalid")!

    #if DEBUG
    static func setDebugHTTPBaseURL(_ baseURLString: String?, defaults: UserDefaults = .standard) {
        if let baseURLString = baseURLString?.trimmingCharacters(in: .whitespacesAndNewlines),
           !baseURLString.isEmpty {
            defaults.set(PermitextBackendMode.http.rawValue, forKey: modeDefaultsKey)
            defaults.set(baseURLString, forKey: apiBaseURLDefaultsKey)
        } else {
            defaults.set(PermitextBackendMode.localDev.rawValue, forKey: modeDefaultsKey)
            defaults.removeObject(forKey: apiBaseURLDefaultsKey)
        }
    }
    #endif
}

enum PermitextBackendFactory {
    static func makeClient(configuration: PermitextBackendConfiguration = .load()) -> PermitextBackendClient {
        PermitextBackendClient(transport: configuration.makeTransport())
    }
}

enum PermitextBackendHTTPError: LocalizedError {
    case invalidResponse
    case serverStatus(
        Int,
        String?,
        code: String? = nil,
        conversation: ResearchConversation? = nil
    )

    var statusCode: Int? {
        guard case .serverStatus(let statusCode, _, _, _) = self else { return nil }
        return statusCode
    }

    var serverCode: String? {
        guard case .serverStatus(_, _, let code, _) = self else { return nil }
        return code
    }

    var serverMessage: String? {
        guard case .serverStatus(_, let message, _, _) = self else { return nil }
        return message
    }

    var authoritativeResearchConversation: ResearchConversation? {
        guard case .serverStatus(_, _, _, let conversation) = self else { return nil }
        return conversation
    }

    var isAuthenticationFailure: Bool {
        statusCode == 401 || statusCode == 403
    }

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The backend returned an invalid response."
        case .serverStatus(let statusCode, let message, _, _):
            if let message, !message.isEmpty {
                return message
            }
            return "The backend returned HTTP \(statusCode)."
        }
    }
}

struct PermitextBackendHTTPTransport: PermitextBackendTransport {
    let name: String
    private let baseURL: URL
    private let session: URLSession
    private let requestTimeout: TimeInterval
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(
        baseURL: URL,
        name: String = "http-backend",
        session: URLSession = .shared,
        requestTimeout: TimeInterval = 20
    ) {
        self.name = name
        self.baseURL = baseURL
        self.session = session
        self.requestTimeout = requestTimeout
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        self.encoder = encoder
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
    }

    func signIn(_ request: BackendSignInRequest) async throws -> BackendAccountRecord {
        // A cold Production sign-in performs Clerk verification, verified-email
        // lookup, database initialization, and pending Lifetime Pro activation.
        // Keep ordinary backend requests tightly bounded, but do not abandon a
        // valid authentication while that one-time reconciliation is finishing.
        try await post(
            "account/sign-in",
            body: request,
            timeoutInterval: max(requestTimeout, 60)
        )
    }

    func signOut(_ request: BackendSignOutRequest) async throws -> BackendSignOutResponse {
        try await post("account/sign-out", body: request, bearerToken: request.auth.bearerToken)
    }

    func deleteAccount(_ request: BackendAccountDeleteRequest) async throws -> BackendAccountDeleteResponse {
        try await post("account/delete", body: request, bearerToken: request.auth.bearerToken)
    }

    func health() async throws -> BackendHealthStatus {
        try await get("health")
    }

    func attachLocalData(_ request: BackendAttachLocalDataRequest) async throws -> AccountMigrationState {
        try await post("account/attach-local-data", body: request)
    }

    func updateProfile(_ request: BackendProfileUpdateRequest) async throws -> BackendProfileUpdateResponse {
        try await post("account/profile", body: request, bearerToken: request.auth.bearerToken)
    }

    func currentPolicies() async throws -> BackendCurrentPoliciesResponse {
        try await get("policies/current")
    }

    func recordPolicyAcceptance(_ request: BackendPolicyAcceptanceRequest) async throws -> BackendPolicyAcceptanceResponse {
        try await post("account/policy-acceptance", body: request, bearerToken: request.auth.bearerToken)
    }

    func appleBillingAccountToken(_ request: BackendAppleBillingAccountTokenRequest) async throws -> BackendAppleBillingAccountTokenResponse {
        try await post("billing/apple/account-token", body: request, bearerToken: request.auth.bearerToken)
    }

    func verifyAppleTransaction(_ request: BackendAppleTransactionVerifyRequest) async throws -> BackendAppleTransactionVerifyResponse {
        try await post("billing/apple/transactions/verify", body: request, bearerToken: request.auth.bearerToken)
    }

    func researchUsage(_ request: BackendResearchUsageRequest) async throws -> BackendResearchUsageResponse {
        try await post("research/usage", body: request, bearerToken: request.auth.bearerToken)
    }

    func organizations(_ request: BackendOrganizationListRequest) async throws -> BackendOrganizationListResponse {
        try await post("organizations/list", body: request, bearerToken: request.auth.bearerToken)
    }

    func acceptOrganizationInvitation(
        _ request: BackendOrganizationInvitationAcceptRequest
    ) async throws -> BackendOrganizationInvitationAcceptResponse {
        try await post("organizations/invitations/accept", body: request, bearerToken: request.auth.bearerToken)
    }

    func organizationProjectSnapshot(
        _ request: BackendOrganizationProjectSnapshotRequest
    ) async throws -> BackendOrganizationProjectSnapshotResponse {
        try await post("organizations/projects/snapshot", body: request, bearerToken: request.auth.bearerToken)
    }

    func projectFoundation(_ request: BackendProjectFoundationRequest) async throws -> BackendProjectFoundationResponse {
        try await post("projects/foundation/state", body: request, bearerToken: request.auth.bearerToken)
    }

    func projectPropertyLookup(_ request: BackendProjectPropertyLookupRequest) async throws -> BackendProjectPropertyLookupResponse {
        try await post("projects/property/lookup", body: request, bearerToken: request.auth.bearerToken)
    }

    func projectHubBootstrap(_ request: BackendProjectHubBootstrapRequest) async throws -> BackendProjectHubBootstrapResponse {
        try await post("projects/hub/bootstrap", body: request, bearerToken: request.auth.bearerToken)
    }

    func projectNotebookCards(_ request: BackendProjectNotebookCardsRequest) async throws -> BackendProjectNotebookCardsResponse {
        try await post("notebook/cards/list", body: request, bearerToken: request.auth.bearerToken)
    }

    func researchConversationList(_ request: ResearchConversationListRequest) async throws -> ResearchConversationListResponse {
        try await post("research/conversations/list", body: request, bearerToken: request.auth.bearerToken)
    }

    func researchConversationGet(_ request: ResearchConversationGetRequest) async throws -> ResearchConversationResponse {
        try await post("research/conversations/get", body: request, bearerToken: request.auth.bearerToken)
    }

    func researchConversationRefresh(_ request: ResearchConversationRefreshRequest) async throws -> ResearchConversationResponse {
        try await post("research/conversations/refresh", body: request, bearerToken: request.auth.bearerToken)
    }

    func researchProjectContextReview(_ request: ResearchProjectContextReviewRequest) async throws -> ResearchConversationResponse {
        try await post("research/conversations/project-context", body: request, bearerToken: request.auth.bearerToken)
    }

    func researchSelectionReview(_ request: ResearchSelectionReviewRequest) async throws -> ResearchSelectionReviewResponse {
        try await post("research/selections/review", body: request, bearerToken: request.auth.bearerToken)
    }

    func researchConversationCreate(_ request: ResearchConversationCreateRequest) async throws -> ResearchConversationResponse {
        try await post("research/conversations/create", body: request, bearerToken: request.auth.bearerToken)
    }

    func researchConversationAddEvidence(_ request: ResearchConversationEvidenceRequest) async throws -> ResearchConversationEvidenceResponse {
        try await post("research/conversations/evidence", body: request, bearerToken: request.auth.bearerToken)
    }

    func researchConversationMessage(_ request: ResearchConversationMessageRequest) async throws -> ResearchConversationMessageResponse {
        // Verified Research may need substantially longer than an ordinary metadata read.
        // Keep the normal transport timeout tight, but do not abandon a valid
        // Research generation while the server is still working.
        try await post(
            "research/conversations/message",
            body: request,
            bearerToken: request.auth.bearerToken,
            timeoutInterval: max(requestTimeout, 300)
        )
    }

    func researchFeedback(_ request: ResearchFeedbackRequest) async throws -> ResearchFeedbackResponse {
        try await post("research/feedback", body: request, bearerToken: request.auth.bearerToken)
    }

    func researchConversationRename(_ request: ResearchConversationRenameRequest) async throws -> ResearchConversationResponse {
        try await post("research/conversations/rename", body: request, bearerToken: request.auth.bearerToken)
    }

    func researchConversationAssignProject(_ request: ResearchConversationAssignProjectRequest) async throws -> ResearchConversationResponse {
        try await post("research/conversations/assign-project", body: request, bearerToken: request.auth.bearerToken)
    }

    func researchConversationDelete(_ request: ResearchConversationDeleteRequest) async throws -> ResearchConversationDeleteResponse {
        try await post("research/conversations/delete", body: request, bearerToken: request.auth.bearerToken)
    }

    func notebookCardList(_ request: NotebookCardListRequest) async throws -> NotebookCardListResponse {
        try await post("notebook/cards/list", body: request, bearerToken: request.auth.bearerToken)
    }

    func notebookCardGet(_ request: NotebookCardGetRequest) async throws -> NotebookCardResponse {
        try await post("notebook/cards/get", body: request, bearerToken: request.auth.bearerToken)
    }

    func notebookCardSave(_ request: NotebookCardSaveRequest) async throws -> NotebookCardResponse {
        try await post("notebook/cards/save", body: request, bearerToken: request.auth.bearerToken)
    }

    func notebookCardDelete(_ request: NotebookCardDeleteRequest) async throws -> NotebookCardDeleteResponse {
        try await post("notebook/cards/delete", body: request, bearerToken: request.auth.bearerToken)
    }

    func notebookAssetUpload(
        _ upload: NotebookAssetUploadRequest,
        data: Data
    ) async throws -> NotebookAssetUploadResponse {
        var components = URLComponents(
            url: baseURL.appendingPathComponent("notebook/assets/upload"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "projectID", value: upload.projectID),
            URLQueryItem(name: "assetID", value: upload.assetID)
        ]
        guard let url = components?.url else { throw PermitextBackendHTTPError.invalidResponse }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = requestTimeout
        request.setValue(upload.contentType, forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(upload.auth.accountUserID, forHTTPHeaderField: "X-Permitext-User-ID")
        if let width = upload.width { request.setValue(String(width), forHTTPHeaderField: "X-Permitext-Image-Width") }
        if let height = upload.height { request.setValue(String(height), forHTTPHeaderField: "X-Permitext-Image-Height") }
        if let token = upload.auth.bearerToken, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = data
        return try await send(request)
    }

    func notebookAsset(_ read: NotebookAssetReadRequest) async throws -> Data {
        var request = URLRequest(url: baseURL.appendingPathComponent("notebook/assets/read"))
        request.httpMethod = "POST"
        request.timeoutInterval = requestTimeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("image/*", forHTTPHeaderField: "Accept")
        if let token = read.auth.bearerToken, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try encoder.encode(read)
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PermitextBackendHTTPError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            let backendError = try? decoder.decode(BackendErrorResponse.self, from: data)
            throw PermitextBackendHTTPError.serverStatus(
                httpResponse.statusCode,
                backendError?.error,
                code: backendError?.code,
                conversation: backendError?.conversation
            )
        }
        return data
    }

    func projectReportHistory(_ request: BackendProjectReportHistoryRequest) async throws -> BackendProjectReportHistoryResponse {
        try await post("reports/history/list", body: request, bearerToken: request.auth.bearerToken)
    }

    func projectReportManifest(_ request: BackendProjectReportManifestRequest) async throws -> BackendProjectReportManifestResponse {
        try await post("reports/manifests/get", body: request, bearerToken: request.auth.bearerToken)
    }

    func projectReportFileUpload(
        _ upload: BackendProjectReportFileUploadRequest,
        data: Data
    ) async throws -> BackendProjectReportFileUploadResponse {
        var components = URLComponents(
            url: baseURL.appendingPathComponent("reports/files/upload"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "projectID", value: upload.projectID),
            URLQueryItem(name: "manifestID", value: upload.manifestID),
            URLQueryItem(name: "format", value: upload.format)
        ]
        guard let url = components?.url else {
            throw PermitextBackendHTTPError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = requestTimeout
        request.setValue("application/pdf", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(upload.auth.accountUserID, forHTTPHeaderField: "X-Permitext-User-ID")
        if let token = upload.auth.bearerToken, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = data
        return try await send(request)
    }

    func projectReportFile(_ report: BackendProjectReportFileReadRequest) async throws -> Data {
        var request = URLRequest(url: baseURL.appendingPathComponent("reports/files/read"))
        request.httpMethod = "POST"
        request.timeoutInterval = requestTimeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/pdf", forHTTPHeaderField: "Accept")
        if let token = report.auth.bearerToken, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try encoder.encode(report)
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PermitextBackendHTTPError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            let backendError = try? decoder.decode(BackendErrorResponse.self, from: data)
            throw PermitextBackendHTTPError.serverStatus(
                httpResponse.statusCode,
                backendError?.error,
                code: backendError?.code
            )
        }
        guard data.starts(with: Data("%PDF-".utf8)) else {
            throw PermitextBackendHTTPError.invalidResponse
        }
        return data
    }

    func pushUserContent(_ request: BackendUserContentPushRequest) async throws -> BackendUserContentPushResponse {
        try await post("sync/push", body: request, bearerToken: request.auth.bearerToken)
    }

    func pullUserContent(_ request: BackendUserContentPullRequest) async throws -> ServerUserContentPullResult {
        try await post("sync/pull", body: request, bearerToken: request.auth.bearerToken)
    }

    func checkpointUserContent(_ request: BackendUserContentCheckpointRequest) async throws -> ServerUserContentCheckpointResult {
        try await post("sync/checkpoint", body: request, bearerToken: request.auth.bearerToken)
    }

    private func get<ResponseBody: Decodable>(_ path: String) async throws -> ResponseBody {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "GET"
        request.timeoutInterval = requestTimeout
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return try await send(request)
    }

    private func post<RequestBody: Encodable, ResponseBody: Decodable>(
        _ path: String,
        body: RequestBody,
        bearerToken: String? = nil,
        timeoutInterval: TimeInterval? = nil
    ) async throws -> ResponseBody {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.timeoutInterval = timeoutInterval ?? requestTimeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let bearerToken, !bearerToken.isEmpty {
            request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try encoder.encode(body)

        return try await send(request)
    }

    private func send<ResponseBody: Decodable>(_ request: URLRequest) async throws -> ResponseBody {
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PermitextBackendHTTPError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            let backendError = try? decoder.decode(BackendErrorResponse.self, from: data)
            throw PermitextBackendHTTPError.serverStatus(
                httpResponse.statusCode,
                backendError?.error,
                code: backendError?.code,
                conversation: backendError?.conversation
            )
        }
        return try decoder.decode(ResponseBody.self, from: data)
    }
}

actor LocalPermitextBackendTransport: PermitextBackendTransport {
    nonisolated let name = "local-dev-backend"
    private var accountsByUserID: [String: SignedInAccount] = [:]
    private var userContentByUserID: [String: [ServerUserContentMutation]] = [:]
    private var localResearchPurchasedTurnsByUserID: [String: Int] = [:]
    private let localAppleBillingAccountToken = UUID(uuidString: "11111111-1111-4111-8111-111111111111")!

    #if DEBUG
    private let phase3ResearchFixtureEnabled: Bool
    private let phase3ResearchFailureCode: String?
    private var phase3ResearchConversations: [String: ResearchConversation] = [:]

    init(phase3ResearchFixtureEnabled: Bool = false, phase3ResearchFailureCode: String? = nil) {
        self.phase3ResearchFixtureEnabled = phase3ResearchFixtureEnabled
        self.phase3ResearchFailureCode = phase3ResearchFailureCode
    }
    #endif

    func health() async throws -> BackendHealthStatus {
        BackendHealthStatus(ok: true, storage: "memory")
    }

    func signIn(_ request: BackendSignInRequest) async throws -> BackendAccountRecord {
        let credential = request.credential
        if credential.provider == .passkey {
            throw PermitextBackendHTTPError.serverStatus(410, "Passkey sign-in is unavailable. Use Sign in with Apple.")
        }
        let appUserID = "\(credential.provider.rawValue):\(credential.providerUserID)"
        let account = SignedInAccount(
            appUserID: appUserID,
            authProvider: credential.provider,
            authProviderUserID: credential.providerUserID,
            appleUserID: credential.provider == .apple ? credential.providerUserID : "",
            email: credential.email,
            publicUsername: nil,
            displayName: credential.displayName,
            signedInAt: credential.signedInAt,
            migrationState: .notStarted
        )
        accountsByUserID[account.appUserID] = account
        return BackendAccountRecord(account: account, entitlement: nil)
    }

    func signOut(_ request: BackendSignOutRequest) async throws -> BackendSignOutResponse {
        BackendSignOutResponse(signedOut: true)
    }

    func deleteAccount(_ request: BackendAccountDeleteRequest) async throws -> BackendAccountDeleteResponse {
        accountsByUserID.removeValue(forKey: request.auth.accountUserID)
        userContentByUserID.removeValue(forKey: request.auth.accountUserID)
        localResearchPurchasedTurnsByUserID.removeValue(forKey: request.auth.accountUserID)
        return BackendAccountDeleteResponse(
            deleted: true,
            deletedPrivateAssetCount: 0,
            billingCancellation: nil
        )
    }

    func currentPolicies() async throws -> BackendCurrentPoliciesResponse {
        .localDevelopment
    }

    func recordPolicyAcceptance(_ request: BackendPolicyAcceptanceRequest) async throws -> BackendPolicyAcceptanceResponse {
        let configuration = BackendCurrentPoliciesResponse.localDevelopment
        guard request.platform == "ios",
              let versions = configuration.versions,
              let documents = configuration.documents,
              request.versions == versions
        else {
            throw PermitextBackendHTTPError.serverStatus(
                409,
                "The policy versions changed. Review the current documents before accepting them.",
                code: "POLICY_VERSION_MISMATCH"
            )
        }
        return BackendPolicyAcceptanceResponse(
            acceptance: BackendPolicyAcceptanceRecord(
                schemaVersion: 1,
                id: UUID().uuidString,
                policySetID: configuration.policySetID ?? "local-development-policies",
                versions: versions,
                documents: documents,
                acceptedAt: Date(),
                platform: request.platform,
                clientRelease: request.clientRelease
            ),
            recorded: true
        )
    }

    func attachLocalData(_ request: BackendAttachLocalDataRequest) async throws -> AccountMigrationState {
        .localDataAttached
    }

    func updateProfile(_ request: BackendProfileUpdateRequest) async throws -> BackendProfileUpdateResponse {
        BackendProfileUpdateResponse(
            account: SignedInAccount(
                appUserID: request.auth.accountUserID,
                authProvider: .guest,
                appleUserID: "",
                publicUsername: request.publicUsername,
                displayName: request.displayName,
                signedInAt: Date(),
                migrationState: .localDataAttached,
                backendSessionToken: request.auth.bearerToken
            )
        )
    }

    func appleBillingAccountToken(_ request: BackendAppleBillingAccountTokenRequest) async throws -> BackendAppleBillingAccountTokenResponse {
        BackendAppleBillingAccountTokenResponse(appAccountToken: localAppleBillingAccountToken)
    }

    func verifyAppleTransaction(_ request: BackendAppleTransactionVerifyRequest) async throws -> BackendAppleTransactionVerifyResponse {
        let turnsByProductID = [
            StoreKitProductID.researchTurns25: 25,
            StoreKitProductID.researchTurns100: 100
        ]
        if let productID = request.productID,
           let turns = turnsByProductID[productID] {
            localResearchPurchasedTurnsByUserID[request.auth.accountUserID, default: 0] += turns
            return BackendAppleTransactionVerifyResponse(
                entitlement: nil,
                credited: true,
                replayed: false,
                transaction: BackendAppleTransactionSummary(
                    productID: productID,
                    packID: turns == 25 ? "research-turns-25" : "research-turns-100"
                ),
                usage: localResearchAllowance(userID: request.auth.accountUserID)
            )
        }
        return BackendAppleTransactionVerifyResponse(entitlement: .appleSubscriptionPro)
    }

    func researchUsage(_ request: BackendResearchUsageRequest) async throws -> BackendResearchUsageResponse {
        BackendResearchUsageResponse(usage: localResearchAllowance(userID: request.auth.accountUserID))
    }

    private func localResearchAllowance(userID: String) -> ResearchTurnAllowance {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let now = Date()
        let periodStart = calendar.date(from: calendar.dateComponents([.year, .month], from: now)) ?? now
        let resetsAt = calendar.date(byAdding: .month, value: 1, to: periodStart) ?? now
        let purchased = localResearchPurchasedTurnsByUserID[userID, default: 0]
        return ResearchTurnAllowance(
            includedLimit: 100,
            includedUsed: 0,
            includedRemaining: 100,
            purchasedRemaining: purchased,
            totalRemaining: 100 + purchased,
            periodStart: periodStart,
            resetsAt: resetsAt,
            canResearch: true,
            purchaseRequired: false,
            paidContinuationEnabled: true,
            canBuyMore: true,
            packs: [
                ResearchTurnPack(
                    id: "research-turns-25",
                    turns: 25,
                    webAvailable: false,
                    appleProductID: StoreKitProductID.researchTurns25
                ),
                ResearchTurnPack(
                    id: "research-turns-100",
                    turns: 100,
                    webAvailable: false,
                    appleProductID: StoreKitProductID.researchTurns100
                )
            ],
            mockMode: true
        )
    }

    func organizations(_ request: BackendOrganizationListRequest) async throws -> BackendOrganizationListResponse {
        BackendOrganizationListResponse(organizations: [])
    }

    func acceptOrganizationInvitation(
        _ request: BackendOrganizationInvitationAcceptRequest
    ) async throws -> BackendOrganizationInvitationAcceptResponse {
        throw URLError(.unsupportedURL)
    }

    func organizationProjectSnapshot(
        _ request: BackendOrganizationProjectSnapshotRequest
    ) async throws -> BackendOrganizationProjectSnapshotResponse {
        throw URLError(.fileDoesNotExist)
    }

    func projectFoundation(_ request: BackendProjectFoundationRequest) async throws -> BackendProjectFoundationResponse {
        BackendProjectFoundationResponse(
            schemaVersion: 1,
            researchConversations: [],
            researchAnswers: [],
            activity: []
        )
    }

    func projectPropertyLookup(_ request: BackendProjectPropertyLookupRequest) async throws -> BackendProjectPropertyLookupResponse {
        throw URLError(.unsupportedURL)
    }

    func projectHubBootstrap(_ request: BackendProjectHubBootstrapRequest) async throws -> BackendProjectHubBootstrapResponse {
        BackendProjectHubBootstrapResponse(
            schemaVersion: 1,
            projectID: request.projectID,
            foundation: try await projectFoundation(
                BackendProjectFoundationRequest(auth: request.auth, projectID: request.projectID)
            ),
            notebook: try await projectNotebookCards(
                BackendProjectNotebookCardsRequest(auth: request.auth, projectID: request.projectID)
            ),
            reports: try await projectReportHistory(
                BackendProjectReportHistoryRequest(auth: request.auth, projectID: request.projectID)
            )
        )
    }

    func projectNotebookCards(_ request: BackendProjectNotebookCardsRequest) async throws -> BackendProjectNotebookCardsResponse {
        BackendProjectNotebookCardsResponse(
            schemaVersion: 1,
            projectID: request.projectID,
            cards: []
        )
    }

    func researchConversationList(_ request: ResearchConversationListRequest) async throws -> ResearchConversationListResponse {
        #if DEBUG
        if phase3ResearchFixtureEnabled {
            return ResearchConversationListResponse(
                conversations: phase3ResearchConversations.values
                    .map(\.summary)
                    .sorted { $0.updatedAt > $1.updatedAt }
            )
        }
        #endif
        return ResearchConversationListResponse(conversations: [])
    }

    func researchConversationGet(_ request: ResearchConversationGetRequest) async throws -> ResearchConversationResponse {
        #if DEBUG
        if phase3ResearchFixtureEnabled,
           let conversation = phase3ResearchConversations[request.conversationID] {
            return ResearchConversationResponse(conversation: conversation)
        }
        #endif
        throw URLError(.fileDoesNotExist)
    }

    func researchConversationRefresh(_ request: ResearchConversationRefreshRequest) async throws -> ResearchConversationResponse {
        #if DEBUG
        if phase3ResearchFixtureEnabled {
            var conversation = try phase3ResearchConversation(id: request.conversationID)
            conversation.sourceStatus = "current"
            conversation.projectContextReviewRequired = true
            conversation.updatedAt = phase3ResearchTimestamp(adding: 180)
            phase3ResearchConversations[conversation.id] = conversation
            return ResearchConversationResponse(conversation: conversation)
        }
        #endif
        throw URLError(.unsupportedURL)
    }

    func researchProjectContextReview(_ request: ResearchProjectContextReviewRequest) async throws -> ResearchConversationResponse {
        #if DEBUG
        if phase3ResearchFixtureEnabled {
            var conversation = try phase3ResearchConversation(id: request.conversationID)
            conversation.primaryProjectID = request.projectID
            conversation.projectContext = ResearchProjectContext(
                projectID: request.projectID,
                facts: request.facts,
                source: "user-provided",
                updatedAt: phase3ResearchTimestamp(adding: 240)
            )
            conversation.projectContextReviewRequired = false
            conversation.updatedAt = phase3ResearchTimestamp(adding: 240)
            phase3ResearchConversations[conversation.id] = conversation
            return ResearchConversationResponse(conversation: conversation)
        }
        #endif
        throw URLError(.unsupportedURL)
    }

    func researchSelectionReview(_ request: ResearchSelectionReviewRequest) async throws -> ResearchSelectionReviewResponse {
        ResearchSelectionReviewResponse(
            selection: ResearchSelectionRequest(
                sectionID: request.sectionID,
                selectedText: request.selectedText
            ),
            requiresVisualReview: false,
            maximumVisualSelections: 4,
            visualSources: []
        )
    }

    func researchConversationCreate(_ request: ResearchConversationCreateRequest) async throws -> ResearchConversationResponse {
        #if DEBUG
        if phase3ResearchFixtureEnabled {
            let selections = request.selections ?? []
            let sources = selections.enumerated().map { index, selection in
                phase3ResearchSource(selection, index: index)
            }
            let title = selections.first?.selectedText
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .prefix(80)
            let conversation = ResearchConversation(
                id: "phase3-research-conversation",
                title: title.map(String.init) ?? "Phase 3 Research",
                createdAt: phase3ResearchTimestamp(),
                updatedAt: phase3ResearchTimestamp(),
                primaryProjectID: request.projectID,
                projectContext: ResearchProjectContext(
                    projectID: request.projectID,
                    facts: [
                        "Occupancy is Group B.",
                        "The building remains occupied during the proposed work."
                    ],
                    source: "user-provided",
                    updatedAt: phase3ResearchTimestamp()
                ),
                projectContextReviewRequired: false,
                sourceStatus: "current",
                sources: sources,
                messages: []
            )
            phase3ResearchConversations[conversation.id] = conversation
            return ResearchConversationResponse(conversation: conversation)
        }
        #endif
        throw URLError(.unsupportedURL)
    }

    func researchConversationAddEvidence(_ request: ResearchConversationEvidenceRequest) async throws -> ResearchConversationEvidenceResponse {
        #if DEBUG
        if phase3ResearchFixtureEnabled {
            var conversation = try phase3ResearchConversation(id: request.conversationID)
            let existingIDs = Set(conversation.sources.map(\.id))
            let additions = request.selections.enumerated().map { index, selection in
                phase3ResearchSource(selection, index: conversation.sources.count + index)
            }.filter { !existingIDs.contains($0.id) }
            conversation.sources.append(contentsOf: additions)
            conversation.updatedAt = phase3ResearchTimestamp(adding: 60)
            phase3ResearchConversations[conversation.id] = conversation
            return ResearchConversationEvidenceResponse(
                conversation: conversation,
                replayed: additions.isEmpty,
                addedSelectionCount: additions.count
            )
        }
        #endif
        throw URLError(.unsupportedURL)
    }

    func researchConversationMessage(_ request: ResearchConversationMessageRequest) async throws -> ResearchConversationMessageResponse {
        #if DEBUG
        if phase3ResearchFixtureEnabled {
            if let phase3ResearchFailureCode {
                throw PermitextBackendHTTPError.serverStatus(502, "Fixture verification rejection", code: phase3ResearchFailureCode)
            }
            var conversation = try phase3ResearchConversation(id: request.conversationID)
            let source = conversation.sources.first
            let sectionID = source?.sectionID ?? "1"
            let sourceID = source?.id ?? "phase3-source-1"
            let question = ResearchMessage(
                id: "phase3-question-\(request.requestID)",
                role: "user",
                question: request.question,
                requestID: request.requestID,
                createdAt: phase3ResearchTimestamp(adding: 90)
            )
            let answer = ResearchAnswer(
                answerText: "The selected enacted provision controls the code title under the stated Project facts.",
                conclusion: "The selected enacted provision controls, subject to the stated Project facts.",
                explanation: "The answer is limited to the enacted passage selected in Reader and does not replace an official determination.",
                supportedPoints: [
                    ResearchSupportedPoint(
                        heading: "The selected provision is controlling enacted text",
                        explanation: "The exact Reader passage establishes the cited rule.",
                        sectionID: sectionID,
                        sourceIDs: [sourceID],
                        evidenceRole: "governing"
                    ),
                    ResearchSupportedPoint(
                        heading: "The Project facts frame the application",
                        explanation: "The reported occupancy and work conditions remain user-provided facts.",
                        sectionID: sectionID,
                        sourceIDs: [sourceID],
                        evidenceRole: "supporting"
                    ),
                    ResearchSupportedPoint(
                        heading: "Related context is not controlling",
                        explanation: "Context helps explain the result but does not replace the enacted provision.",
                        sectionID: sectionID,
                        sourceIDs: [sourceID],
                        evidenceRole: "contextual"
                    )
                ],
                assumptions: ["The selected passage is current for the Project's code edition."],
                missingFacts: ["Confirm the final occupancy classification."],
                evidenceLimitations: ["Only the selected enacted provision was reviewed."],
                followUpQuestions: ["Will the building remain occupied throughout the work?"],
                additionalEvidenceNeeded: ["Add any applicable exception or referenced table."],
                citations: [
                    ResearchCitation(
                        sourceID: sourceID,
                        sectionID: sectionID,
                        sourceIDs: [sourceID],
                        codePrefix: "BC",
                        sectionNumber: source?.sectionNumber ?? "101.1",
                        title: source?.title ?? "Title",
                        evidenceRole: "governing",
                        relevance: "Controls the title and scope of the selected enacted provision.",
                        codeVersion: "2022 Construction Codes",
                        codeEdition: "2022",
                        corpusID: "nyc-construction-codes",
                        corpusLabel: "NYC Construction Codes",
                        applicabilityStatus: "current"
                    )
                ],
                disclaimer: "AI-generated research assistance, not an official code determination."
            )
            let response = ResearchMessage(
                id: "phase3-answer-\(request.requestID)",
                role: "assistant",
                answer: answer,
                requestID: request.requestID,
                createdAt: phase3ResearchTimestamp(adding: 120)
            )
            conversation.messages.append(contentsOf: [question, response])
            conversation.sourceStatus = "changed"
            conversation.updatedAt = phase3ResearchTimestamp(adding: 120)
            phase3ResearchConversations[conversation.id] = conversation
            return ResearchConversationMessageResponse(
                conversation: conversation,
                replayed: false,
                requestID: request.requestID
            )
        }
        #endif
        throw URLError(.unsupportedURL)
    }

    func researchFeedback(_ request: ResearchFeedbackRequest) async throws -> ResearchFeedbackResponse {
        #if DEBUG
        if phase3ResearchFixtureEnabled {
            var conversation = try phase3ResearchConversation(id: request.conversationID)
            guard let messageIndex = conversation.messages.firstIndex(where: {
                $0.id == request.answerID && $0.role == "assistant"
            }) else {
                throw URLError(.fileDoesNotExist)
            }
            let feedback = ResearchFeedback(
                id: conversation.messages[messageIndex].feedback?.id ?? "phase3-feedback-\(request.answerID)",
                status: "candidate",
                category: request.category,
                userComment: request.comment,
                professionalRole: request.professionalRole,
                supportingReference: request.supportingReference,
                updatedAt: phase3ResearchTimestamp(adding: 180)
            )
            conversation.messages[messageIndex].feedback = feedback
            phase3ResearchConversations[conversation.id] = conversation
            return ResearchFeedbackResponse(feedback: feedback)
        }
        #endif
        throw URLError(.unsupportedURL)
    }

    func researchConversationRename(_ request: ResearchConversationRenameRequest) async throws -> ResearchConversationResponse {
        #if DEBUG
        if phase3ResearchFixtureEnabled {
            var conversation = try phase3ResearchConversation(id: request.conversationID)
            conversation.title = request.title
            phase3ResearchConversations[conversation.id] = conversation
            return ResearchConversationResponse(conversation: conversation)
        }
        #endif
        throw URLError(.unsupportedURL)
    }

    func researchConversationAssignProject(_ request: ResearchConversationAssignProjectRequest) async throws -> ResearchConversationResponse {
        #if DEBUG
        if phase3ResearchFixtureEnabled {
            var conversation = try phase3ResearchConversation(id: request.conversationID)
            conversation.primaryProjectID = request.projectID
            conversation.projectContext = ResearchProjectContext(
                projectID: request.projectID,
                facts: request.projectID == nil ? [] : ["Project assignment was explicitly reviewed."],
                source: "user-provided",
                updatedAt: phase3ResearchTimestamp(adding: 300)
            )
            conversation.projectContextReviewRequired = false
            conversation.updatedAt = phase3ResearchTimestamp(adding: 300)
            phase3ResearchConversations[conversation.id] = conversation
            return ResearchConversationResponse(conversation: conversation)
        }
        #endif
        throw URLError(.unsupportedURL)
    }

    func researchConversationDelete(_ request: ResearchConversationDeleteRequest) async throws -> ResearchConversationDeleteResponse {
        #if DEBUG
        if phase3ResearchFixtureEnabled {
            return ResearchConversationDeleteResponse(
                deleted: phase3ResearchConversations.removeValue(forKey: request.conversationID) != nil
            )
        }
        #endif
        throw URLError(.unsupportedURL)
    }

    func notebookCardList(_ request: NotebookCardListRequest) async throws -> NotebookCardListResponse {
        NotebookCardListResponse(
            schemaVersion: 1,
            projectID: request.projectID,
            cards: [],
            access: NotebookAccess(role: "owner", readOnly: false)
        )
    }

    func notebookCardGet(_ request: NotebookCardGetRequest) async throws -> NotebookCardResponse {
        throw URLError(.fileDoesNotExist)
    }

    func notebookCardSave(_ request: NotebookCardSaveRequest) async throws -> NotebookCardResponse {
        throw URLError(.unsupportedURL)
    }

    func notebookCardDelete(_ request: NotebookCardDeleteRequest) async throws -> NotebookCardDeleteResponse {
        throw URLError(.unsupportedURL)
    }

    func notebookAssetUpload(_ request: NotebookAssetUploadRequest, data: Data) async throws -> NotebookAssetUploadResponse {
        throw URLError(.unsupportedURL)
    }

    func notebookAsset(_ request: NotebookAssetReadRequest) async throws -> Data {
        throw URLError(.fileDoesNotExist)
    }

    func projectReportHistory(_ request: BackendProjectReportHistoryRequest) async throws -> BackendProjectReportHistoryResponse {
        BackendProjectReportHistoryResponse(
            schemaVersion: 1,
            projectID: request.projectID,
            reports: []
        )
    }

    func projectReportManifest(_ request: BackendProjectReportManifestRequest) async throws -> BackendProjectReportManifestResponse {
        throw URLError(.fileDoesNotExist)
    }

    func projectReportFileUpload(
        _ request: BackendProjectReportFileUploadRequest,
        data: Data
    ) async throws -> BackendProjectReportFileUploadResponse {
        throw URLError(.unsupportedURL)
    }

    func projectReportFile(_ request: BackendProjectReportFileReadRequest) async throws -> Data {
        throw URLError(.fileDoesNotExist)
    }

    func pushUserContent(_ request: BackendUserContentPushRequest) async throws -> BackendUserContentPushResponse {
        let userID = request.auth.accountUserID
        var existingByID = Dictionary(uniqueKeysWithValues: (userContentByUserID[userID] ?? []).map { ($0.recordID, $0) })
        for mutation in request.batch.mutations {
            existingByID[mutation.recordID] = mutation
        }
        userContentByUserID[userID] = existingByID.values.sorted { $0.recordID < $1.recordID }
        return BackendUserContentPushResponse(
            acceptedMutationIDs: request.batch.mutations.map(\.recordID),
            rejectedMutationIDs: [],
            rejectionReasons: nil,
            latestEventID: Int64(userContentByUserID[userID]?.count ?? 0),
            serverTime: Date()
        )
    }

    func pullUserContent(_ request: BackendUserContentPullRequest) async throws -> ServerUserContentPullResult {
        let allMutations = userContentByUserID[request.auth.accountUserID] ?? []
        let excluded = Set(request.excludedMutationKinds)
        let filtered = request.since.map { since in
            allMutations.filter { $0.updatedAt > since || ($0.deletedAt.map { $0 > since } ?? false) }
        } ?? allMutations
        let mutations = excluded.isEmpty
            ? filtered
            : filtered.filter { !excluded.contains($0.entityKind.rawValue) }
        return ServerUserContentPullResult(
            userID: request.auth.accountUserID,
            pulledAt: Date(),
            latestEventID: Int64(allMutations.count),
            contentMapVersion: request.contentMapVersion,
            entitlementFingerprint: "local-dev",
            mutations: mutations
        )
    }

    func checkpointUserContent(_ request: BackendUserContentCheckpointRequest) async throws -> ServerUserContentCheckpointResult {
        let allMutations = userContentByUserID[request.auth.accountUserID] ?? []
        let latestEventID = Int64(allMutations.count)
        let contentMapVersion = request.contentMapVersion ?? 0
        let entitlementFingerprint = "local-dev"
        let changed =
            (request.sinceEventID ?? 0) != latestEventID ||
            (request.contentMapVersion ?? 0) != contentMapVersion ||
            (request.entitlementFingerprint ?? "") != entitlementFingerprint
        return ServerUserContentCheckpointResult(
            userID: request.auth.accountUserID,
            checkedAt: Date(),
            changed: changed,
            latestEventID: latestEventID,
            syncRevision: latestEventID,
            contentMapVersion: contentMapVersion,
            entitlementFingerprint: entitlementFingerprint
        )
    }

    #if DEBUG
    private func phase3ResearchConversation(id: String) throws -> ResearchConversation {
        guard let conversation = phase3ResearchConversations[id] else {
            throw URLError(.fileDoesNotExist)
        }
        return conversation
    }

    private func phase3ResearchSource(
        _ selection: ResearchSelectionRequest,
        index: Int
    ) -> ResearchSource {
        ResearchSource(
            id: "phase3-source-\(selection.sectionID)-\(index)",
            kind: "selection",
            relationship: "governing",
            sectionID: selection.sectionID,
            sectionNumber: "101.1",
            title: "Title",
            codePrefix: "BC",
            selectedText: selection.selectedText
        )
    }

    private func phase3ResearchTimestamp(adding seconds: TimeInterval = 0) -> String {
        ISO8601DateFormatter().string(
            from: Date(timeIntervalSince1970: 1_787_220_000 + seconds)
        )
    }
    #endif
}

enum UserContentMergeAction: String, Codable, Hashable, Sendable {
    case applyServer
    case keepLocal
    case uploadLocal
    case noChange
    case flagConflict
}

struct UserContentMergeCandidate: Codable, Hashable, Sendable {
    let recordID: String
    let entityKind: ServerUserContentEntityKind
    let localUpdatedAt: Date?
    let serverUpdatedAt: Date?
    let localDeletedAt: Date?
    let serverDeletedAt: Date?
    let localSyncState: UserContentSyncState

    init(
        recordID: String,
        entityKind: ServerUserContentEntityKind,
        localUpdatedAt: Date? = nil,
        serverUpdatedAt: Date? = nil,
        localDeletedAt: Date? = nil,
        serverDeletedAt: Date? = nil,
        localSyncState: UserContentSyncState = .synced
    ) {
        self.recordID = recordID
        self.entityKind = entityKind
        self.localUpdatedAt = localUpdatedAt
        self.serverUpdatedAt = serverUpdatedAt
        self.localDeletedAt = localDeletedAt
        self.serverDeletedAt = serverDeletedAt
        self.localSyncState = localSyncState
    }

    init(serverMutation: ServerUserContentMutation, localUpdatedAt: Date? = nil, localDeletedAt: Date? = nil, localSyncState: UserContentSyncState = .synced) {
        self.init(
            recordID: serverMutation.recordID,
            entityKind: serverMutation.entityKind,
            localUpdatedAt: localUpdatedAt,
            serverUpdatedAt: serverMutation.updatedAt,
            localDeletedAt: localDeletedAt,
            serverDeletedAt: serverMutation.deletedAt,
            localSyncState: localSyncState
        )
    }
}

struct UserContentMergeDecision: Codable, Hashable, Sendable {
    let recordID: String
    let entityKind: ServerUserContentEntityKind
    let action: UserContentMergeAction
    let reason: String
}

struct UserContentMergePlan: Codable, Hashable, Sendable {
    let decisions: [UserContentMergeDecision]

    var applyServerCount: Int { count(.applyServer) }
    var keepLocalCount: Int { count(.keepLocal) }
    var uploadLocalCount: Int { count(.uploadLocal) }
    var conflictCount: Int { count(.flagConflict) }
    var noChangeCount: Int { count(.noChange) }

    private func count(_ action: UserContentMergeAction) -> Int {
        decisions.filter { $0.action == action }.count
    }
}

enum UserContentMergeResolver {
    static func plan(for candidates: [UserContentMergeCandidate]) -> UserContentMergePlan {
        UserContentMergePlan(decisions: candidates.map(decision(for:)))
    }

    static func plan(
        incomingServerMutations: [ServerUserContentMutation],
        localCandidates: [String: UserContentMergeCandidate] = [:]
    ) -> UserContentMergePlan {
        let candidates = incomingServerMutations.map { mutation in
            if let local = localCandidates[mutation.recordID] {
                return UserContentMergeCandidate(
                    recordID: mutation.recordID,
                    entityKind: mutation.entityKind,
                    localUpdatedAt: local.localUpdatedAt,
                    serverUpdatedAt: mutation.updatedAt,
                    localDeletedAt: local.localDeletedAt,
                    serverDeletedAt: mutation.deletedAt,
                    localSyncState: local.localSyncState
                )
            }
            return UserContentMergeCandidate(serverMutation: mutation)
        }
        return plan(for: candidates)
    }

    static func decision(for candidate: UserContentMergeCandidate) -> UserContentMergeDecision {
        if candidate.localSyncState == .pendingUpload || candidate.localSyncState == .localOnly {
            if candidate.entityKind == .continuity {
                return UserContentMergeDecision(
                    recordID: candidate.recordID,
                    entityKind: candidate.entityKind,
                    action: .uploadLocal,
                    reason: "Queued reading activity must reach the server, where histories merge per entry."
                )
            }
            if let localDeletedAt = candidate.localDeletedAt {
                if let serverDeletedAt = candidate.serverDeletedAt {
                    return UserContentMergeDecision(
                        recordID: candidate.recordID,
                        entityKind: candidate.entityKind,
                        action: serverDeletedAt >= localDeletedAt ? .applyServer : .uploadLocal,
                        reason: serverDeletedAt >= localDeletedAt
                            ? "The server already contains this deletion."
                            : "The queued local deletion is newer than the server deletion."
                    )
                }
                if let serverUpdatedAt = candidate.serverUpdatedAt,
                   serverUpdatedAt > localDeletedAt {
                    return UserContentMergeDecision(
                        recordID: candidate.recordID,
                        entityKind: candidate.entityKind,
                        action: .flagConflict,
                        reason: "The server changed this record after the queued local deletion."
                    )
                }
                return UserContentMergeDecision(
                    recordID: candidate.recordID,
                    entityKind: candidate.entityKind,
                    action: .uploadLocal,
                    reason: "The queued local deletion must reach the server."
                )
            }
            if let localUpdatedAt = candidate.localUpdatedAt,
               let serverUpdatedAt = candidate.serverUpdatedAt,
               serverUpdatedAt > localUpdatedAt {
                return UserContentMergeDecision(
                    recordID: candidate.recordID,
                    entityKind: candidate.entityKind,
                    action: .applyServer,
                    reason: "The server change is newer than the queued local change."
                )
            }
            return UserContentMergeDecision(
                recordID: candidate.recordID,
                entityKind: candidate.entityKind,
                action: .uploadLocal,
                reason: "Local edit has not reached the server yet."
            )
        }

        if candidate.localDeletedAt != nil, candidate.serverDeletedAt == nil {
            return UserContentMergeDecision(
                recordID: candidate.recordID,
                entityKind: candidate.entityKind,
                action: .uploadLocal,
                reason: "Local delete is authoritative until it uploads."
            )
        }

        if let serverDeletedAt = candidate.serverDeletedAt {
            if let localUpdatedAt = candidate.localUpdatedAt, localUpdatedAt > serverDeletedAt {
                return UserContentMergeDecision(
                    recordID: candidate.recordID,
                    entityKind: candidate.entityKind,
                    action: .flagConflict,
                    reason: "Server deleted this record after sync, but local has a newer edit."
                )
            }
            return UserContentMergeDecision(
                recordID: candidate.recordID,
                entityKind: candidate.entityKind,
                action: .applyServer,
                reason: "Server deletion is newer than the synced local record."
            )
        }

        guard let serverUpdatedAt = candidate.serverUpdatedAt else {
            return UserContentMergeDecision(
                recordID: candidate.recordID,
                entityKind: candidate.entityKind,
                action: .keepLocal,
                reason: "No server update is available."
            )
        }

        guard let localUpdatedAt = candidate.localUpdatedAt else {
            return UserContentMergeDecision(
                recordID: candidate.recordID,
                entityKind: candidate.entityKind,
                action: .applyServer,
                reason: "Server has a record that is missing locally."
            )
        }

        if serverUpdatedAt > localUpdatedAt {
            return UserContentMergeDecision(
                recordID: candidate.recordID,
                entityKind: candidate.entityKind,
                action: .applyServer,
                reason: "Server record is newer than the synced local record."
            )
        }

        if localUpdatedAt > serverUpdatedAt {
            return UserContentMergeDecision(
                recordID: candidate.recordID,
                entityKind: candidate.entityKind,
                action: .uploadLocal,
                reason: "Local record is newer and should be pushed back to the server."
            )
        }

        if candidate.localDeletedAt != candidate.serverDeletedAt {
            return UserContentMergeDecision(
                recordID: candidate.recordID,
                entityKind: candidate.entityKind,
                action: .flagConflict,
                reason: "Delete state differs even though update timestamps match."
            )
        }

        return UserContentMergeDecision(
            recordID: candidate.recordID,
            entityKind: candidate.entityKind,
            action: .noChange,
            reason: "Local and server records are already aligned."
        )
    }
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
    let codeVersion: String
    let name: String
    let address: String
    let description: String
    let structuredFacts: [ProjectStructuredFact]
    let colorHex: String
    let folderType: CodeFolderType
    let sortOrder: Int
    let createdAt: Date
    let updatedAt: Date

    init(
        id: Int64,
        clientID: String,
        ownerID: String,
        visibility: UserContentVisibility,
        syncState: UserContentSyncState,
        deletedAt: Date?,
        codeVersion: String,
        name: String,
        address: String,
        description: String,
        structuredFacts: [ProjectStructuredFact] = [],
        colorHex: String,
        folderType: CodeFolderType,
        sortOrder: Int,
        createdAt: Date,
        updatedAt: Date
    ) {
        self.id = id
        self.clientID = clientID
        self.ownerID = ownerID
        self.visibility = visibility
        self.syncState = syncState
        self.deletedAt = deletedAt
        self.codeVersion = codeVersion
        self.name = name
        self.address = address
        self.description = description
        self.structuredFacts = structuredFacts
        self.colorHex = colorHex
        self.folderType = folderType
        self.sortOrder = sortOrder
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    /// Shared web/iOS project palette. Keep this in the same order as
    /// `projectColorOptions` in the web client so a project keeps both its
    /// exact color and its selected swatch on every device.
    static let presetColorHexes: [String] = [
        "#6674c8",
        "#5aaea4",
        "#f27a4f",
        "#a14fc0",
        "#879a6d",
        "#9b7d6f",
        "#d75f7a",
        "#2f8f4e",
        "#0891b2",
        "#c96410",
        "#3f6f9f",
        "#b58b2a",
        "#6f58c9",
        "#c84b7a",
        "#4f8f8b"
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
        comparisonModeEnabled: true,
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
    private static let knownPrefixes = ["BC", "EBC", "ECC", "EC", "FC", "FGC", "MC", "PC"]

    private static func defaultPrefix(for codeSectionName: String?) -> String {
        let name = (codeSectionName ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()

        if name.contains("FUEL GAS") {
            return "FGC"
        }
        if name.contains("EXISTING BUILDING") {
            return "EBC"
        }
        if name.contains("ENERGY") {
            return "ECC"
        }
        if name.contains("ELECTRICAL") {
            return "EC"
        }
        if name.contains("FIRE") {
            return "FC"
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
        if upper.range(of: #"^SECTION\s+BC\s+28-"#, options: .regularExpression) != nil {
            return trimmed.replacingOccurrences(
                of: #"(?i)^SECTION\s+BC\s+"#,
                with: "SECTION ",
                options: .regularExpression
            )
        }
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
    let annotationBlockID: String
    let annotationLabel: String?
    let codeVersion: String
    let codeSectionID: Int64?
    let codeSectionName: String
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
        annotationBlockID: String = "",
        annotationLabel: String? = nil,
        codeVersion: String,
        codeSectionID: Int64? = nil,
        codeSectionName: String = "",
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
        self.annotationBlockID = annotationBlockID.trimmingCharacters(in: .whitespacesAndNewlines)
        self.annotationLabel = annotationLabel
        self.codeVersion = codeVersion
        self.codeSectionID = codeSectionID
        self.codeSectionName = codeSectionName
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
        if isBlockAnnotation {
            let trimmedLabel = annotationLabel?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return trimmedLabel.isEmpty ? "Paragraph annotation" : trimmedLabel
        }
        return kind == .textBlock ? title : title.displayTitle(for: sectionNumber)
    }

    var evidenceDisplayTitle: String {
        kind == .textBlock ? title : title.displayTitle(for: sectionNumber)
    }

    var hasNote: Bool {
        !noteBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var nonRepeatingPreviewText: String {
        let preview = previewText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !preview.isEmpty else { return "" }
        return Self.normalizedEvidenceText(preview) == Self.normalizedEvidenceText(evidenceDisplayTitle)
            ? ""
            : preview
    }

    var rowID: String {
        let versionIdentity = UserContentSyncCodeVersion.server(codeVersion)
        return annotationBlockID.isEmpty
            ? "version:\(versionIdentity):section:\(id)"
            : "version:\(versionIdentity):section:\(id):block:\(annotationBlockID)"
    }

    var isBlockAnnotation: Bool {
        !annotationBlockID.isEmpty
    }

    private static func normalizedEvidenceText(_ value: String) -> String {
        value
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            .components(separatedBy: .punctuationCharacters)
            .joined(separator: " ")
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
            .lowercased()
    }
}

enum ProjectEvidenceConsolidator {
    /// Project membership is section-level on both web and native. Present one
    /// row per code-version/section pair while retaining any paragraph note or
    /// tags that make that section useful as evidence.
    static func consolidated(_ items: [BookmarkedSection]) -> [BookmarkedSection] {
        var orderedKeys: [String] = []
        var groups: [String: [BookmarkedSection]] = [:]

        for item in items {
            let key = "\(UserContentSyncCodeVersion.server(item.codeVersion)):\(item.id)"
            if groups[key] == nil {
                orderedKeys.append(key)
            }
            groups[key, default: []].append(item)
        }

        return orderedKeys.compactMap { key in
            guard let group = groups[key], let first = group.first else { return nil }
            let preferred = group.first(where: { !$0.isBlockAnnotation }) ?? first

            var seenNotes = Set<String>()
            let notes = group.compactMap { item -> String? in
                let note = item.noteBody.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !note.isEmpty, seenNotes.insert(note).inserted else { return nil }
                return note
            }
            var seenTags = Set<String>()
            let tags = group.flatMap(\.tags).filter { tag in
                let normalized = tag.trimmingCharacters(in: .whitespacesAndNewlines)
                return !normalized.isEmpty && seenTags.insert(normalized).inserted
            }

            return BookmarkedSection(
                id: preferred.id,
                annotationBlockID: preferred.annotationBlockID,
                annotationLabel: preferred.annotationLabel,
                codeVersion: preferred.codeVersion,
                codeSectionID: preferred.codeSectionID,
                codeSectionName: preferred.codeSectionName,
                clientID: preferred.clientID,
                ownerID: preferred.ownerID,
                visibility: preferred.visibility,
                syncState: preferred.syncState,
                updatedAt: group.compactMap(\.updatedAt).max(),
                deletedAt: preferred.deletedAt,
                chapterNumber: preferred.chapterNumber,
                chapterTitle: preferred.chapterTitle,
                sectionNumber: preferred.sectionNumber,
                title: preferred.title,
                previewText: preferred.previewText,
                kind: preferred.kind,
                isBookmarked: group.contains(where: \.isBookmarked),
                noteBody: notes.joined(separator: "\n\n"),
                tags: tags,
                bookmarkedAt: group.compactMap(\.bookmarkedAt).max()
            )
        }
    }
}

struct ProjectEvidenceChapterGroup: Identifiable, Hashable, Sendable {
    let id: String
    let chapterNumber: String
    let chapterTitle: String
    let items: [BookmarkedSection]

    var displayTitle: String {
        let chapter = CodeChapter(
            id: 0,
            codeSectionID: nil,
            chapterNumber: chapterNumber,
            title: chapterTitle
        )
        let label = chapter.displayLabel
        let normalizedTitle = chapterTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedTitle.isEmpty,
              normalizedTitle.caseInsensitiveCompare(label) != .orderedSame,
              normalizedTitle.caseInsensitiveCompare("Administration") != .orderedSame
        else {
            return label
        }
        return "\(label)  \(normalizedTitle)"
    }
}

struct ProjectEvidenceCodeGroup: Identifiable, Hashable, Sendable {
    let id: String
    let codeVersion: String
    let codeSectionName: String
    let displayTitle: String
    let chapters: [ProjectEvidenceChapterGroup]

    var items: [BookmarkedSection] {
        chapters.flatMap(\.items)
    }
}

enum ProjectEvidenceOrganizer {
    static func codeGroups(_ items: [BookmarkedSection]) -> [ProjectEvidenceCodeGroup] {
        var grouped: [String: [BookmarkedSection]] = [:]
        var metadata: [String: (codeVersion: String, codeSectionName: String)] = [:]

        for item in items {
            let codeSectionName = resolvedCodeSectionName(for: item)
            let key = "\(UserContentSyncCodeVersion.server(item.codeVersion)):\(codeSectionName.uppercased())"
            grouped[key, default: []].append(item)
            metadata[key] = (item.codeVersion, codeSectionName)
        }

        return grouped.compactMap { key, groupItems -> ProjectEvidenceCodeGroup? in
            guard let groupMetadata = metadata[key] else { return nil }
            let chapterGroups = Dictionary(grouping: groupItems) { item in
                "\(item.chapterNumber.uppercased()):\(item.chapterTitle.uppercased())"
            }
            .map { chapterKey, chapterItems in
                let first = chapterItems[0]
                return ProjectEvidenceChapterGroup(
                    id: "\(key):\(chapterKey)",
                    chapterNumber: first.chapterNumber,
                    chapterTitle: first.chapterTitle,
                    items: chapterItems.sorted(by: compareSectionOrder)
                )
            }
            .sorted(by: compareChapterOrder)

            return ProjectEvidenceCodeGroup(
                id: key,
                codeVersion: groupMetadata.codeVersion,
                codeSectionName: groupMetadata.codeSectionName,
                displayTitle: displayTitle(
                    codeVersion: groupMetadata.codeVersion,
                    codeSectionName: groupMetadata.codeSectionName
                ),
                chapters: chapterGroups
            )
        }
        .sorted(by: compareCodeGroupOrder)
    }

    static func displayTitle(codeVersion: String, codeSectionName: String) -> String {
        let canonicalVersion = UserContentSyncCodeVersion.server(codeVersion)
        let normalizedName = codeSectionName.trimmingCharacters(in: .whitespacesAndNewlines)
        let uppercaseName = normalizedName.uppercased()

        if canonicalVersion == UserContentSyncCodeVersion.canonicalNYC2022,
           uppercaseName.contains("GENERAL ADMINISTRATIVE") {
            return "General Administrative Code (2022 Edition)"
        }
        if canonicalVersion == UserContentSyncCodeVersion.canonicalNYCEnactedAdministrative {
            if uppercaseName.contains("1968 BUILDING") {
                return "1968 Building Code (Historical)"
            }
            if uppercaseName.contains("TITLE 28") {
                return "Administrative Code Title 28 — Current Consolidation"
            }
            if uppercaseName.contains("CONSTRUCTION-RELATED LOCAL LAWS") {
                return "Construction-Related Local Laws"
            }
        }

        return normalizedName == normalizedName.uppercased()
            ? normalizedName.localizedCapitalized
            : normalizedName
    }

    private static func resolvedCodeSectionName(for item: BookmarkedSection) -> String {
        let name = item.codeSectionName.trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? "Saved Evidence" : name
    }

    private static func compareCodeGroupOrder(
        _ lhs: ProjectEvidenceCodeGroup,
        _ rhs: ProjectEvidenceCodeGroup
    ) -> Bool {
        let lhsVersionRank = versionRank(lhs.codeVersion)
        let rhsVersionRank = versionRank(rhs.codeVersion)
        if lhsVersionRank != rhsVersionRank { return lhsVersionRank < rhsVersionRank }

        let lhsSectionRank = codeSectionRank(lhs.codeSectionName)
        let rhsSectionRank = codeSectionRank(rhs.codeSectionName)
        if lhsSectionRank != rhsSectionRank { return lhsSectionRank < rhsSectionRank }
        return lhs.displayTitle.localizedStandardCompare(rhs.displayTitle) == .orderedAscending
    }

    private static func versionRank(_ codeVersion: String) -> Int {
        switch UserContentSyncCodeVersion.server(codeVersion) {
        case UserContentSyncCodeVersion.canonicalNYC2022: return 0
        case UserContentSyncCodeVersion.canonicalNYC2014: return 1
        case UserContentSyncCodeVersion.canonicalNYC2025Specialty: return 2
        case UserContentSyncCodeVersion.canonicalNYCExistingBuilding: return 3
        case UserContentSyncCodeVersion.canonicalNYCEnactedAdministrative: return 4
        case UserContentSyncCodeVersion.canonicalNYCZoning: return 5
        default: return 6
        }
    }

    private static func codeSectionRank(_ name: String) -> Int {
        let uppercaseName = name.uppercased()
        let orderedKeywords = [
            "BUILDING CODE", "GENERAL ADMINISTRATIVE", "FUEL GAS", "MECHANICAL",
            "PLUMBING", "ENERGY", "ELECTRICAL", "FIRE CODE", "1968 BUILDING",
            "HOUSING MAINTENANCE", "TITLE 24", "TITLE 25", "TITLE 26", "TITLE 28",
            "LOCAL LAWS"
        ]
        return orderedKeywords.firstIndex(where: uppercaseName.contains) ?? Int.max
    }

    private static func compareChapterOrder(
        _ lhs: ProjectEvidenceChapterGroup,
        _ rhs: ProjectEvidenceChapterGroup
    ) -> Bool {
        lhs.chapterNumber.compare(rhs.chapterNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
    }

    private static func compareSectionOrder(_ lhs: BookmarkedSection, _ rhs: BookmarkedSection) -> Bool {
        lhs.sectionNumber.compare(rhs.sectionNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
    }
}

struct UserAnnotationEntry: Hashable, Sendable {
    let sectionID: Int64
    let blockID: String
    let noteBody: String
    let tags: [String]

    init(sectionID: Int64, blockID: String = "", noteBody: String = "", tags: [String] = []) {
        self.sectionID = sectionID
        self.blockID = blockID.trimmingCharacters(in: .whitespacesAndNewlines)
        self.noteBody = noteBody
        self.tags = tags
    }

    var hasContent: Bool {
        !noteBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !tags.isEmpty
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
    case appleSubscription
    case webSubscription
    case lifetimeGrant
    case debugOverride

    var label: String {
        switch self {
        case .none: return "None"
        case .subscription: return "Pro Subscription"
        case .appleSubscription: return "Apple Billing"
        case .webSubscription: return "Web Billing"
        case .lifetimeGrant: return "Lifetime Grant"
        case .debugOverride: return "Debug Override"
        }
    }

    var isAppleManagedSubscription: Bool {
        self == .appleSubscription || self == .subscription
    }
}

struct AppEntitlement: Codable, Hashable, Sendable {
    struct Provider: Codable, Hashable, Sendable {
        let permitextPackage: String?
    }

    struct AddOn: Codable, Hashable, Sendable {
        let enabled: Bool?
        let source: String?
        let expiresAt: Date?
        let provider: Provider?

        func isActive(at date: Date = Date()) -> Bool {
            guard enabled != false else { return false }
            guard let expiresAt else { return true }
            return expiresAt > date
        }
    }

    let plan: AppPlan
    let source: EntitlementSource
    let grantedUserID: String?
    let expiresAt: Date?
    let packageID: String?
    let legacyResearchIncluded: Bool?
    let provider: Provider?
    let addOns: [String: AddOn]?

    init(
        plan: AppPlan,
        source: EntitlementSource,
        grantedUserID: String?,
        expiresAt: Date? = nil,
        packageID: String? = nil,
        legacyResearchIncluded: Bool? = nil,
        provider: Provider? = nil,
        addOns: [String: AddOn]? = nil
    ) {
        self.plan = plan
        self.source = source
        self.grantedUserID = grantedUserID
        self.expiresAt = expiresAt
        self.packageID = packageID
        self.legacyResearchIncluded = legacyResearchIncluded
        self.provider = provider
        self.addOns = addOns
    }

    func grantsPro(at date: Date = Date()) -> Bool {
        guard plan == .pro else { return false }
        guard let expiresAt else { return true }
        return expiresAt > date
    }

    func grantsResearch(at date: Date = Date()) -> Bool {
        grantsPro(at: date)
    }

    static let free = AppEntitlement(plan: .free, source: .none, grantedUserID: nil)
    static let appleSubscriptionPro = AppEntitlement(plan: .pro, source: .appleSubscription, grantedUserID: nil)
    static let webSubscriptionPro = AppEntitlement(plan: .pro, source: .webSubscription, grantedUserID: nil)
    static let subscriptionPro = appleSubscriptionPro

    static func lifetimeGrant(userID: String) -> AppEntitlement {
        AppEntitlement(plan: .pro, source: .lifetimeGrant, grantedUserID: userID)
    }

    #if DEBUG
    static func debugOverride(_ plan: AppPlan) -> AppEntitlement {
        AppEntitlement(plan: plan, source: .debugOverride, grantedUserID: nil)
    }
    #endif
}

enum AccountAuthProvider: String, Codable, Hashable, Sendable {
    case apple
    case clerk
    case passkey
    case guest
}

enum AccountMigrationState: String, Codable, Hashable, Sendable {
    case notStarted
    case localDataAttached
    case skipped
}

struct AccountSignInCredential: Codable, Hashable, Sendable {
    let provider: AccountAuthProvider
    let providerUserID: String
    let displayName: String?
    let signedInAt: Date
    let email: String?
    let identityToken: String?
    let authorizationCode: String?
    let sessionToken: String?

    init(
        provider: AccountAuthProvider,
        providerUserID: String,
        displayName: String?,
        signedInAt: Date,
        email: String? = nil,
        identityToken: String? = nil,
        authorizationCode: String? = nil,
        sessionToken: String? = nil
    ) {
        self.provider = provider
        self.providerUserID = providerUserID
        self.displayName = displayName
        self.signedInAt = signedInAt
        self.email = email
        self.identityToken = identityToken
        self.authorizationCode = authorizationCode
        self.sessionToken = sessionToken
    }
}

struct SignedInAccount: Codable, Hashable, Sendable {
    let appUserID: String
    let authProvider: AccountAuthProvider
    let authProviderUserID: String
    let appleUserID: String
    let email: String?
    let publicUsername: String?
    let displayName: String?
    let signedInAt: Date
    let migrationState: AccountMigrationState
    let backendSessionToken: String?

    init(
        appUserID: String,
        authProvider: AccountAuthProvider = .apple,
        authProviderUserID: String? = nil,
        appleUserID: String,
        email: String? = nil,
        publicUsername: String? = nil,
        displayName: String?,
        signedInAt: Date,
        migrationState: AccountMigrationState = .notStarted,
        backendSessionToken: String? = nil
    ) {
        self.appUserID = appUserID
        self.authProvider = authProvider
        self.authProviderUserID = authProviderUserID ?? appleUserID
        self.appleUserID = appleUserID
        self.email = email
        self.publicUsername = publicUsername
        self.displayName = displayName
        self.signedInAt = signedInAt
        self.migrationState = migrationState
        self.backendSessionToken = backendSessionToken
    }

    private enum CodingKeys: String, CodingKey {
        case appUserID
        case authProvider
        case authProviderUserID
        case appleUserID
        case email
        case publicUsername
        case displayName
        case signedInAt
        case migrationState
        case backendSessionToken
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let appleUserID = try container.decodeIfPresent(String.self, forKey: .appleUserID) ?? ""
        let authProvider = try container.decodeIfPresent(AccountAuthProvider.self, forKey: .authProvider)
            ?? (appleUserID.isEmpty ? .guest : .apple)
        let authProviderUserID = try container.decodeIfPresent(String.self, forKey: .authProviderUserID) ?? appleUserID
        self.authProvider = authProvider
        self.authProviderUserID = authProviderUserID
        self.appleUserID = appleUserID
        self.appUserID = try container.decodeIfPresent(String.self, forKey: .appUserID) ?? "\(authProvider.rawValue):\(authProviderUserID)"
        self.email = try container.decodeIfPresent(String.self, forKey: .email)
        self.publicUsername = try container.decodeIfPresent(String.self, forKey: .publicUsername)
        self.displayName = try container.decodeIfPresent(String.self, forKey: .displayName)
        self.signedInAt = try container.decode(Date.self, forKey: .signedInAt)
        self.migrationState = try container.decodeIfPresent(AccountMigrationState.self, forKey: .migrationState) ?? .notStarted
        self.backendSessionToken = try container.decodeIfPresent(String.self, forKey: .backendSessionToken)
    }
}

struct BackendAccountRecord: Codable, Hashable, Sendable {
    let account: SignedInAccount
    let entitlement: AppEntitlement?
}

protocol AccountBackendClient {
    var name: String { get }
    func health() async throws -> BackendHealthStatus
    func signIn(credential: AccountSignInCredential, linkFrom: SignedInAccount?) async throws -> BackendAccountRecord
    func signOut(account: SignedInAccount) async throws
    func deleteAccount(account: SignedInAccount) async throws -> BackendAccountDeleteResponse
    func attachLocalData(account: SignedInAccount) async throws -> AccountMigrationState
    func updateProfile(account: SignedInAccount, publicUsername: String?, displayName: String?) async throws -> SignedInAccount
    func currentPolicies() async throws -> BackendCurrentPoliciesResponse
    func recordPolicyAcceptance(
        account: SignedInAccount,
        versions: BackendPolicyVersions,
        platform: String,
        clientRelease: String
    ) async throws -> BackendPolicyAcceptanceResponse
    func appleBillingAccountToken(account: SignedInAccount) async throws -> UUID
    func verifyAppleTransaction(account: SignedInAccount, signedTransactionInfo: String) async throws -> AppEntitlement?
    func verifyAppleResearchTurnPurchase(
        account: SignedInAccount,
        productID: String,
        signedTransactionInfo: String
    ) async throws -> BackendAppleTransactionVerifyResponse
    func researchTurnAllowance(account: SignedInAccount) async throws -> ResearchTurnAllowance
    func organizations(account: SignedInAccount) async throws -> [PermitextOrganization]
    func acceptOrganizationInvitation(
        account: SignedInAccount,
        invitationToken: String
    ) async throws -> PermitextOrganization
    func organizationProjectSnapshot(
        account: SignedInAccount,
        projectID: String
    ) async throws -> BackendOrganizationProjectSnapshotResponse
    func projectHub(account: SignedInAccount, projectID: String) async throws -> ProjectHubSnapshot
    func projectPropertyContext(account: SignedInAccount, address: String) async throws -> BackendProjectPropertyContext
    func researchConversations(account: SignedInAccount) async throws -> [ResearchConversationSummary]
    func researchConversation(account: SignedInAccount, conversationID: String) async throws -> ResearchConversation
    func refreshResearchConversation(account: SignedInAccount, conversationID: String) async throws -> ResearchConversation
    func reviewResearchProjectContext(
        account: SignedInAccount,
        conversationID: String,
        projectID: String,
        facts: [String]
    ) async throws -> ResearchConversation
    func reviewResearchSelection(
        account: SignedInAccount,
        selection: ResearchSelectionRequest
    ) async throws -> ResearchSelectionReviewResponse
    func createResearchConversation(
        account: SignedInAccount,
        projectID: String?,
        selections: [ResearchSelectionRequest]
    ) async throws -> ResearchConversation
    func addResearchEvidence(
        account: SignedInAccount,
        conversationID: String,
        selections: [ResearchSelectionRequest]
    ) async throws -> ResearchConversation
    func sendResearchMessage(
        account: SignedInAccount,
        conversationID: String,
        question: String,
        requestID: String
    ) async throws -> ResearchConversation
    func saveResearchFeedback(
        account: SignedInAccount,
        conversationID: String,
        answerID: String,
        category: String,
        comment: String?
    ) async throws -> ResearchFeedback
    func renameResearchConversation(
        account: SignedInAccount,
        conversationID: String,
        title: String
    ) async throws -> ResearchConversation
    func assignResearchConversation(
        account: SignedInAccount,
        conversationID: String,
        projectID: String?,
        confirmMove: Bool
    ) async throws -> ResearchConversation
    func deleteResearchConversation(account: SignedInAccount, conversationID: String) async throws
    func notebookCards(account: SignedInAccount, projectID: String) async throws -> NotebookCardListResponse
    func notebookCard(account: SignedInAccount, projectID: String, cardID: String) async throws -> NotebookCard
    func saveNotebookCard(
        account: SignedInAccount,
        projectID: String,
        cardID: String?,
        expectedVersion: Int,
        title: String,
        document: NotebookDocument,
        evidenceLinks: [NotebookEvidenceLink]
    ) async throws -> NotebookCard
    func deleteNotebookCard(
        account: SignedInAccount,
        projectID: String,
        cardID: String,
        expectedVersion: Int
    ) async throws
    func uploadNotebookAsset(
        account: SignedInAccount,
        projectID: String,
        data: Data,
        contentType: String,
        width: Int?,
        height: Int?
    ) async throws -> NotebookImageAsset
    func notebookAsset(account: SignedInAccount, projectID: String, assetID: String) async throws -> Data
    func projectReportManifest(account: SignedInAccount, manifestID: String) async throws -> ProjectReportManifest
    func saveProjectReportPDF(
        account: SignedInAccount,
        projectID: String,
        manifestID: String,
        data: Data
    ) async throws -> ProjectReportFile
    func projectReportFile(
        account: SignedInAccount,
        projectID: String,
        generatedReportID: String
    ) async throws -> Data
}

struct LifetimeGrantLookupResult: Codable, Hashable, Sendable {
    let hasLifetimeGrant: Bool
    let grantedUserID: String?
    let isAuthoritative: Bool

    var authoritativelyDeniesGrant: Bool {
        isAuthoritative && !hasLifetimeGrant
    }
}

enum AccountDefaults {
    static let signedInAccountKey = "permitext.account.signedIn"
    static let storeKitTestOwnerUserIDKey = "permitext.storeKit.test.ownerUserID"
    static let storeKitAppAccountTokenPrefix = "permitext.storeKit.appAccountToken."
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
            return LifetimeGrantLookupResult(
                hasLifetimeGrant: true,
                grantedUserID: appleUserID,
                isAuthoritative: true
            )
        }
        return LifetimeGrantLookupResult(
            hasLifetimeGrant: false,
            grantedUserID: nil,
            isAuthoritative: true
        )
        #else
        return LifetimeGrantLookupResult(
            hasLifetimeGrant: false,
            grantedUserID: nil,
            isAuthoritative: false
        )
        #endif
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
        continuityEnabled: true,
        crossDeviceSyncEnabled: true
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
        if let entitlement = Self.storedEntitlement(defaults: defaults),
           entitlement.grantsPro(),
           !entitlement.source.isAppleManagedSubscription || entitlement.grantedUserID != nil {
            return entitlement
        }
        if let lifetimeGrantUserID = defaults.string(forKey: Self.lifetimeGrantUserIDDefaultsKey),
           !lifetimeGrantUserID.isEmpty {
            return .lifetimeGrant(userID: lifetimeGrantUserID)
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
            return limits.advancedOrganizationEnabled ? .allowed : denied(feature, "Upgrade to Pro to use advanced organization.")
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
    }

    static func setLifetimeGrant(userID: String, defaults: UserDefaults = .standard) {
        defaults.set(userID, forKey: lifetimeGrantUserIDDefaultsKey)
        setEntitlement(.lifetimeGrant(userID: userID), defaults: defaults)
    }

    static func clearLifetimeGrant(defaults: UserDefaults = .standard) {
        defaults.removeObject(forKey: lifetimeGrantUserIDDefaultsKey)
        if storedEntitlement(defaults: defaults)?.source == .lifetimeGrant {
            clearEntitlement(defaults: defaults)
        }
    }

    static func setEntitlement(_ entitlement: AppEntitlement, defaults: UserDefaults = .standard) {
        if let data = try? JSONEncoder().encode(entitlement) {
            defaults.set(data, forKey: entitlementDefaultsKey)
        }
    }

    static func clearEntitlement(defaults: UserDefaults = .standard) {
        defaults.removeObject(forKey: entitlementDefaultsKey)
    }

    private static func storedEntitlement(defaults: UserDefaults) -> AppEntitlement? {
        guard let data = defaults.data(forKey: entitlementDefaultsKey),
              let entitlement = try? JSONDecoder().decode(AppEntitlement.self, from: data) else {
            return nil
        }
        return entitlement
    }
}

enum StoreKitProductID {
    static let proMonthly = "com.randycodex.permitext.pro.monthly"
    static let researchMonthly = "com.randycodex.permitext.research.monthly"
    static let researchTurns25 = "com.randycodex.permitext.research.turns.25"
    static let researchTurns100 = "com.randycodex.permitext.research.turns.100"

    static let researchTurnPacks: Set<String> = [researchTurns25, researchTurns100]
}

struct StoreKitResearchTurnPurchase: Sendable {
    let transaction: Transaction
    let signedTransactionInfo: String
}

enum StoreKitResearchTurnServiceError: LocalizedError {
    case paymentsUnavailable
    case productUnavailable
    case unverifiedTransaction
    case pendingApproval
    case unknownPurchaseResult

    var errorDescription: String? {
        switch self {
        case .paymentsUnavailable:
            return "Apple purchases are disabled for this device or App Store account."
        case .productUnavailable:
            return "This Research turn pack is not available from the App Store yet."
        case .unverifiedTransaction:
            return "The Research turn purchase could not be verified."
        case .pendingApproval:
            return "The Research turn purchase is pending approval."
        case .unknownPurchaseResult:
            return "The Research turn purchase did not complete."
        }
    }
}

actor StoreKitResearchTurnService {
    private var cachedProductsByID: [String: Product] = [:]

    func products(for productIDs: [String], refresh: Bool = false) async -> [Product] {
        let requestedIDs = Set(productIDs.filter { !$0.isEmpty })
        guard !requestedIDs.isEmpty else { return [] }
        if refresh {
            for productID in requestedIDs {
                cachedProductsByID.removeValue(forKey: productID)
            }
        }
        let missingIDs = requestedIDs.filter { cachedProductsByID[$0] == nil }
        if !missingIDs.isEmpty,
           let loadedProducts = try? await Product.products(for: Array(missingIDs)) {
            for product in loadedProducts where product.type == .consumable {
                cachedProductsByID[product.id] = product
            }
        }
        return requestedIDs.compactMap { cachedProductsByID[$0] }
            .sorted { $0.price < $1.price }
    }

    func product(for productID: String, refresh: Bool = false) async throws -> Product {
        guard AppStore.canMakePayments else {
            throw StoreKitResearchTurnServiceError.paymentsUnavailable
        }
        guard let product = await products(for: [productID], refresh: refresh).first else {
            throw StoreKitResearchTurnServiceError.productUnavailable
        }
        return product
    }

    func purchase(after result: Product.PurchaseResult) async throws -> StoreKitResearchTurnPurchase? {
        switch result {
        case .success(let verification):
            guard case .verified(let transaction) = verification,
                  StoreKitProductID.researchTurnPacks.contains(transaction.productID)
            else {
                throw StoreKitResearchTurnServiceError.unverifiedTransaction
            }
            return StoreKitResearchTurnPurchase(
                transaction: transaction,
                signedTransactionInfo: verification.jwsRepresentation
            )
        case .userCancelled:
            return nil
        case .pending:
            throw StoreKitResearchTurnServiceError.pendingApproval
        @unknown default:
            throw StoreKitResearchTurnServiceError.unknownPurchaseResult
        }
    }

    func unfinishedPurchases() async -> [StoreKitResearchTurnPurchase] {
        var purchases: [StoreKitResearchTurnPurchase] = []
        for await verification in Transaction.unfinished {
            guard case .verified(let transaction) = verification,
                  StoreKitProductID.researchTurnPacks.contains(transaction.productID)
            else { continue }
            purchases.append(StoreKitResearchTurnPurchase(
                transaction: transaction,
                signedTransactionInfo: verification.jwsRepresentation
            ))
        }
        return purchases
    }

    func transactionUpdates() -> AsyncStream<StoreKitResearchTurnPurchase> {
        AsyncStream { continuation in
            let task = Task {
                for await verification in Transaction.updates {
                    guard case .verified(let transaction) = verification,
                          StoreKitProductID.researchTurnPacks.contains(transaction.productID)
                    else { continue }
                    continuation.yield(StoreKitResearchTurnPurchase(
                        transaction: transaction,
                        signedTransactionInfo: verification.jwsRepresentation
                    ))
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    func finish(_ purchase: StoreKitResearchTurnPurchase) async {
        await purchase.transaction.finish()
    }
}

enum StoreKitTransactionPolicy {
    static func isKnownProductID(_ productID: String) -> Bool {
        productID == StoreKitProductID.proMonthly || productID == StoreKitProductID.researchMonthly
    }

    static func isActive(
        productID: String,
        expectedProductID: String,
        revocationDate: Date?,
        expirationDate: Date?,
        now: Date = Date()
    ) -> Bool {
        guard productID == expectedProductID, revocationDate == nil else { return false }
        return expirationDate.map { $0 > now } ?? true
    }

    static func shouldFinishInactiveTransaction(
        productID: String,
        revocationDate: Date?,
        expirationDate: Date?,
        now: Date = Date()
    ) -> Bool {
        guard isKnownProductID(productID) else { return false }
        if revocationDate != nil { return true }
        guard let expirationDate else { return false }
        return expirationDate <= now
    }

    static func resolvedPlan(
        snapshotPlan: AppPlan,
        verifiedPurchaseIsActive: Bool
    ) -> AppPlan {
        verifiedPurchaseIsActive ? .pro : snapshotPlan
    }
}

enum StoreKitTransactionDrainPolicy {
    static let maximumPasses = 3
    static let initialSettlingDelayNanoseconds: UInt64 = 200_000_000

    static func settlingDelayNanoseconds(afterCompletedPass pass: Int) -> UInt64 {
        let boundedPass = max(1, min(pass, maximumPasses))
        return initialSettlingDelayNanoseconds << UInt64(boundedPass - 1)
    }
}

actor StoreKitTransactionFinishBarrier {
    private var inFlightTasks: [UInt64: Task<Void, Never>] = [:]

    func finishOnce(
        transactionID: UInt64,
        operation: @escaping @Sendable () async -> Void
    ) async {
        // Coalesce only overlapping calls. StoreKit can keep yielding a transaction
        // briefly after finish(), so a later cleanup pass must be allowed to retry it.
        if let inFlightTask = inFlightTasks[transactionID] {
            await inFlightTask.value
            return
        }

        let task = Task {
            await operation()
        }
        inFlightTasks[transactionID] = task
        await task.value
        inFlightTasks[transactionID] = nil
    }
}

enum StoreKitAccountBindingDecision: Equatable {
    case inactive
    case signInRequired
    case requiresBackendVerification
    case authorizedLocalTest
    case bindLocalTest
    case explicitRestoreRequired
    case ownedByAnotherAccount
    case missingTransactionEvidence
}

enum StoreKitAccountBindingPolicy {
    static func decision(
        snapshotPlan: AppPlan,
        transactionEnvironment: String?,
        hasSignedTransactionInfo: Bool,
        signedInUserID: String?,
        boundTestUserID: String?,
        allowsNewTestBinding: Bool,
        allowsSandboxBackendVerification: Bool = false
    ) -> StoreKitAccountBindingDecision {
        guard snapshotPlan == .pro else { return .inactive }
        guard let signedInUserID, !signedInUserID.isEmpty else { return .signInRequired }

        switch transactionEnvironment?.lowercased() {
        case "sandbox" where allowsSandboxBackendVerification:
            return hasSignedTransactionInfo
                ? .requiresBackendVerification
                : .missingTransactionEvidence
        case "xcode", "sandbox":
            if let boundTestUserID, !boundTestUserID.isEmpty {
                return boundTestUserID == signedInUserID
                    ? .authorizedLocalTest
                    : .ownedByAnotherAccount
            }
            return allowsNewTestBinding ? .bindLocalTest : .explicitRestoreRequired
        default:
            return hasSignedTransactionInfo
                ? .requiresBackendVerification
                : .missingTransactionEvidence
        }
    }
}

enum StoreKitBackendVerificationContinuityPolicy {
    static func preservesAuthorizedTestState(
        snapshotPlan: AppPlan,
        transactionEnvironment: String?,
        hasActiveBackendProEntitlement: Bool,
        backendEntitlementSource: EntitlementSource
    ) -> Bool {
        guard snapshotPlan == .pro,
              hasActiveBackendProEntitlement,
              backendEntitlementSource.isAppleManagedSubscription
        else {
            return false
        }
        switch transactionEnvironment?.lowercased() {
        case "xcode", "sandbox":
            return true
        default:
            return false
        }
    }
}

struct StoreKitSubscriptionSnapshot: Sendable {
    let plan: AppPlan
    let researchActive: Bool
    let proDisplayPrice: String?
    let researchDisplayPrice: String?
    let loadedProductIDs: [String]
    let debugSummary: String
    let signedTransactionInfo: String?
    let transactionEnvironment: String?
    let researchSignedTransactionInfo: String?
    let researchTransactionEnvironment: String?
}

enum StoreKitSubscriptionServiceError: LocalizedError {
    case proProductUnavailable
    case paymentsUnavailable
    case inactiveTransactionQueueDidNotSettle
    case unverifiedTransaction
    case pendingApproval
    case unknownPurchaseResult

    var errorDescription: String? {
        switch self {
        case .proProductUnavailable:
            return "The Pro monthly subscription is not available yet. Check the App Store product setup."
        case .paymentsUnavailable:
            return "Apple purchases are disabled for this device or App Store account. Check Screen Time purchase restrictions and your App Store sign-in, then try again."
        case .inactiveTransactionQueueDidNotSettle:
            return "The App Store is still clearing an expired subscription. No charge was made. Wait a moment, then select Subscribe again."
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
    private let researchProductID = StoreKitProductID.researchMonthly
    private var cachedProProduct: Product?
    private var cachedResearchProduct: Product?
    private let finishBarrier = StoreKitTransactionFinishBarrier()

    func snapshot(
        signedTransactionInfo: String? = nil,
        transactionEnvironment: String? = nil
    ) async -> StoreKitSubscriptionSnapshot {
        async let planResult = verifiedPlanAndSignedTransactionInfo()
        async let products = proProducts()
        async let researchResult = verifiedResearchAndSignedTransactionInfo()
        async let debugSummary = transactionDebugSummary()
        let loadedProducts = await products
        let resolvedPlanResult = await planResult
        let resolvedResearchResult = await researchResult
        return StoreKitSubscriptionSnapshot(
            plan: resolvedPlanResult.plan,
            researchActive: resolvedResearchResult.active,
            proDisplayPrice: loadedProducts.first { $0.id == proProductID }?.displayPrice,
            researchDisplayPrice: loadedProducts.first { $0.id == researchProductID }?.displayPrice,
            loadedProductIDs: loadedProducts.map(\.id),
            debugSummary: await debugSummary,
            signedTransactionInfo: signedTransactionInfo ?? resolvedPlanResult.signedTransactionInfo,
            transactionEnvironment: transactionEnvironment ?? resolvedPlanResult.transactionEnvironment,
            researchSignedTransactionInfo: resolvedResearchResult.signedTransactionInfo,
            researchTransactionEnvironment: resolvedResearchResult.transactionEnvironment
        )
    }

    func proProductForPurchase(refresh: Bool = false) async throws -> Product {
        guard AppStore.canMakePayments else {
            throw StoreKitSubscriptionServiceError.paymentsUnavailable
        }
        if refresh {
            cachedProProduct = nil
            cachedResearchProduct = nil
        }
        guard let product = await proProducts().first(where: { $0.id == proProductID }) else {
            throw StoreKitSubscriptionServiceError.proProductUnavailable
        }

        return product
    }

    func prepareForPurchase() async throws -> StoreKitSubscriptionSnapshot {
        // TestFlight sandbox renewals can leave multiple expired transactions
        // unfinished, including transactions whose JWS no longer verifies.
        // An unverified payload is used only to remove a known, demonstrably
        // inactive transaction from Apple's queue; it can never grant access.
        guard try await drainInactiveUnfinishedTransactions() else {
            throw StoreKitSubscriptionServiceError.inactiveTransactionQueueDidNotSettle
        }
        return await snapshot()
    }

    func snapshot(after result: Product.PurchaseResult) async throws -> StoreKitSubscriptionSnapshot {
        switch result {
        case .success(let verification):
            let transaction: Transaction
            switch verification {
            case .verified(let verifiedTransaction):
                transaction = verifiedTransaction
            case .unverified:
                guard let inactiveTransaction = inactiveKnownTransaction(from: verification) else {
                    throw StoreKitSubscriptionServiceError.unverifiedTransaction
                }
                await finishTransactionOnce(inactiveTransaction)
                return await snapshot()
            }

            guard transaction.productID == proProductID else {
                throw StoreKitSubscriptionServiceError.unknownPurchaseResult
            }
            let verifiedPurchaseIsActive = isActiveProTransaction(transaction)
            if !verifiedPurchaseIsActive {
                if StoreKitTransactionPolicy.shouldFinishInactiveTransaction(
                    productID: transaction.productID,
                    revocationDate: transaction.revocationDate,
                    expirationDate: transaction.expirationDate
                ) {
                    await finishTransactionOnce(transaction)
                }
                return await snapshot()
            }

            var purchaseSnapshot = await snapshot(
                signedTransactionInfo: verification.jwsRepresentation,
                transactionEnvironment: transaction.environment.rawValue
            )
            if verifiedPurchaseIsActive, purchaseSnapshot.plan != .pro {
                for _ in 0..<7 {
                    try? await Task.sleep(nanoseconds: 250_000_000)
                    purchaseSnapshot = await snapshot(
                        signedTransactionInfo: verification.jwsRepresentation,
                        transactionEnvironment: transaction.environment.rawValue
                    )
                    if purchaseSnapshot.plan == .pro { break }
                }
            }

            let resolvedPlan = StoreKitTransactionPolicy.resolvedPlan(
                snapshotPlan: purchaseSnapshot.plan,
                verifiedPurchaseIsActive: verifiedPurchaseIsActive
            )
            guard resolvedPlan != purchaseSnapshot.plan else {
                return purchaseSnapshot
            }

            return StoreKitSubscriptionSnapshot(
                plan: resolvedPlan,
                researchActive: resolvedPlan == .pro || purchaseSnapshot.researchActive,
                proDisplayPrice: purchaseSnapshot.proDisplayPrice,
                researchDisplayPrice: purchaseSnapshot.researchDisplayPrice,
                loadedProductIDs: purchaseSnapshot.loadedProductIDs,
                debugSummary: purchaseSnapshot.debugSummary,
                signedTransactionInfo: purchaseSnapshot.signedTransactionInfo,
                transactionEnvironment: purchaseSnapshot.transactionEnvironment,
                researchSignedTransactionInfo: purchaseSnapshot.researchSignedTransactionInfo,
                researchTransactionEnvironment: purchaseSnapshot.researchTransactionEnvironment
            )
        case .userCancelled:
            return await snapshot()
        case .pending:
            throw StoreKitSubscriptionServiceError.pendingApproval
        @unknown default:
            throw StoreKitSubscriptionServiceError.unknownPurchaseResult
        }
    }

    func restorePurchases() async throws -> StoreKitSubscriptionSnapshot {
        try await AppStore.sync()
        for _ in 0..<8 {
            let currentSnapshot = await snapshot()
            if currentSnapshot.plan == .pro {
                return currentSnapshot
            }
            try? await Task.sleep(nanoseconds: 500_000_000)
        }
        return await snapshot()
    }

    func activeProTransactionIDForRefund() async -> Transaction.ID? {
        for await verification in Transaction.currentEntitlements {
            guard case .verified(let transaction) = verification,
                  isActiveProTransaction(transaction)
            else { continue }
            return transaction.id
        }
        if let verification = await Transaction.latest(for: proProductID),
           case .verified(let transaction) = verification,
           isActiveProTransaction(transaction) {
            return transaction.id
        }
        return nil
    }

    func transactionUpdates() -> AsyncStream<StoreKitSubscriptionSnapshot> {
        AsyncStream { continuation in
            let task = Task {
                for await result in Transaction.updates {
                    switch result {
                    case .verified(let transaction):
                        guard StoreKitTransactionPolicy.isKnownProductID(transaction.productID) else { continue }
                        if let inactiveTransaction = inactiveKnownTransaction(from: result) {
                            await finishTransactionOnce(inactiveTransaction)
                            continuation.yield(await snapshot())
                            continue
                        }
                        guard isActiveOwnedTransaction(transaction) else { continue }
                        continuation.yield(
                            await snapshot(
                                signedTransactionInfo: result.jwsRepresentation,
                                transactionEnvironment: transaction.environment.rawValue
                            )
                        )
                    case .unverified:
                        guard let inactiveTransaction = inactiveKnownTransaction(from: result) else { continue }
                        await finishTransactionOnce(inactiveTransaction)
                        continuation.yield(await snapshot())
                    }
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    func finishActiveProTransactions() async {
        for await verification in Transaction.unfinished {
            guard case .verified(let transaction) = verification,
                  isActiveProTransaction(transaction)
            else { continue }
            await finishTransactionOnce(transaction)
        }
    }

    private nonisolated func inactiveKnownTransaction(
        from verification: VerificationResult<Transaction>
    ) -> Transaction? {
        let transaction: Transaction
        switch verification {
        case .verified(let verifiedTransaction):
            transaction = verifiedTransaction
        case .unverified(let unverifiedTransaction, _):
            transaction = unverifiedTransaction
        }
        guard StoreKitTransactionPolicy.shouldFinishInactiveTransaction(
            productID: transaction.productID,
            revocationDate: transaction.revocationDate,
            expirationDate: transaction.expirationDate
        ) else {
            return nil
        }
        return transaction
    }

    private func finishTransactionOnce(_ transaction: Transaction) async {
        await finishBarrier.finishOnce(transactionID: transaction.id) {
            await transaction.finish()
        }
    }

    private func drainInactiveUnfinishedTransactions() async throws -> Bool {
        for pass in 1...StoreKitTransactionDrainPolicy.maximumPasses {
            let inactiveTransactions = await inactiveUnfinishedTransactions()
            guard !inactiveTransactions.isEmpty else { return true }

            for transaction in inactiveTransactions {
                await finishTransactionOnce(transaction)
            }
            try await Task.sleep(
                nanoseconds: StoreKitTransactionDrainPolicy.settlingDelayNanoseconds(
                    afterCompletedPass: pass
                )
            )
        }

        // Do not start another purchase until a separate pass proves StoreKit's
        // unfinished queue no longer contains a known inactive transaction.
        return await inactiveUnfinishedTransactions().isEmpty
    }

    private func inactiveUnfinishedTransactions() async -> [Transaction] {
        var transactions: [Transaction] = []
        for await verification in Transaction.unfinished {
            guard let transaction = inactiveKnownTransaction(from: verification) else { continue }
            transactions.append(transaction)
        }
        return transactions
    }

    private func proProducts() async -> [Product] {
        if cachedProProduct != nil || cachedResearchProduct != nil {
            return [cachedProProduct, cachedResearchProduct].compactMap { $0 }
        }
        let products = (try? await Product.products(for: [proProductID, researchProductID])) ?? []
        cachedProProduct = products.first { $0.id == proProductID }
        cachedResearchProduct = products.first { $0.id == researchProductID }
        return products.filter { [proProductID, researchProductID].contains($0.id) }
    }

    private func verifiedPlanAndSignedTransactionInfo() async -> (
        plan: AppPlan,
        signedTransactionInfo: String?,
        transactionEnvironment: String?
    ) {
        for await verification in Transaction.currentEntitlements {
            guard case .verified(let transaction) = verification else { continue }
            guard isActiveProTransaction(transaction) else { continue }
            return (.pro, verification.jwsRepresentation, transaction.environment.rawValue)
        }
        if let verification = await Transaction.latest(for: proProductID),
           case .verified(let transaction) = verification,
           isActiveProTransaction(transaction) {
            return (.pro, verification.jwsRepresentation, transaction.environment.rawValue)
        }
        return (.free, nil, nil)
    }

    private nonisolated func isActiveProTransaction(_ transaction: Transaction) -> Bool {
        StoreKitTransactionPolicy.isActive(
            productID: transaction.productID,
            expectedProductID: StoreKitProductID.proMonthly,
            revocationDate: transaction.revocationDate,
            expirationDate: transaction.expirationDate
        )
    }

    private nonisolated func isActiveResearchTransaction(_ transaction: Transaction) -> Bool {
        StoreKitTransactionPolicy.isActive(
            productID: transaction.productID,
            expectedProductID: StoreKitProductID.researchMonthly,
            revocationDate: transaction.revocationDate,
            expirationDate: transaction.expirationDate
        )
    }

    private nonisolated func isActiveOwnedTransaction(_ transaction: Transaction) -> Bool {
        isActiveProTransaction(transaction) || isActiveResearchTransaction(transaction)
    }

    private func verifiedResearchAndSignedTransactionInfo() async -> (
        active: Bool,
        signedTransactionInfo: String?,
        transactionEnvironment: String?
    ) {
        for await verification in Transaction.currentEntitlements {
            guard case .verified(let transaction) = verification,
                  isActiveResearchTransaction(transaction)
            else {
                continue
            }
            return (true, verification.jwsRepresentation, transaction.environment.rawValue)
        }
        if let verification = await Transaction.latest(for: researchProductID),
           case .verified(let transaction) = verification,
           isActiveResearchTransaction(transaction) {
            return (true, verification.jwsRepresentation, transaction.environment.rawValue)
        }
        return (false, nil, nil)
    }

    private func subscriptionStatusIndicatesActive(productID: String) async -> Bool {
        guard let subscription = await proProducts().first(where: { $0.id == productID })?.subscription,
              let statuses = try? await subscription.status else {
            return false
        }
        for status in statuses {
            switch status.state {
            case .subscribed, .inGracePeriod:
                return true
            default:
                continue
            }
        }
        return false
    }

    private func transactionDebugSummary() async -> String {
        var currentEntitlementDescriptions: [String] = []
        for await entitlement in Transaction.currentEntitlements {
            switch entitlement {
            case .verified(let transaction):
                let activeText = isActiveOwnedTransaction(transaction) ? "active" : "inactive"
                currentEntitlementDescriptions.append("\(transaction.productID) \(activeText)")
            case .unverified(let transaction, _):
                currentEntitlementDescriptions.append("\(transaction.productID) unverified")
            }
        }

        let latestDescription: String
        if let latest = await Transaction.latest(for: proProductID) {
            switch latest {
            case .verified(let transaction):
                let activeText = isActiveProTransaction(transaction) ? "active" : "inactive"
                latestDescription = "\(transaction.productID) \(activeText)"
            case .unverified(let transaction, _):
                latestDescription = "\(transaction.productID) unverified"
            }
        } else {
            latestDescription = "none"
        }

        let currentText = currentEntitlementDescriptions.isEmpty
            ? "none"
            : currentEntitlementDescriptions.joined(separator: ", ")
        let statusText = await subscriptionStatusDebugSummary()
        return "current: \(currentText); latest: \(latestDescription); status: \(statusText)"
    }

    private func subscriptionStatusDebugSummary() async -> String {
        let subscriptions = await proProducts().compactMap(\.subscription)
        guard !subscriptions.isEmpty else {
            return "none"
        }
        var statusValues: [String] = []
        for subscription in subscriptions {
            guard let statuses = try? await subscription.status else {
                statusValues.append("unavailable")
                continue
            }
            statusValues.append(contentsOf: statuses.map { String(describing: $0.state) })
        }
        return statusValues.isEmpty ? "none" : statusValues.joined(separator: ", ")
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

    var id: String { rawValue }

    var label: String {
        switch self {
        case .codeOrder: return "Code Order"
        case .recentlySaved: return "Recent"
        case .codeBook: return "Code Book"
        case .title: return "Title"
        }
    }

    var systemImage: String {
        switch self {
        case .codeOrder: return "list.number"
        case .recentlySaved: return "clock"
        case .codeBook: return "books.vertical"
        case .title: return "textformat"
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
                let lhsName = resolvedCodeSectionName(lhs, fallback: codeSectionName)
                let rhsName = resolvedCodeSectionName(rhs, fallback: codeSectionName)
                if lhsName != rhsName {
                    return lhsName.localizedStandardCompare(rhsName) == .orderedAscending
                }
                return compareCodeOrder(lhs, rhs, codeSectionName: codeSectionName)
            case .title:
                let titleCompare = lhs.displayTitle.localizedStandardCompare(rhs.displayTitle)
                if titleCompare != .orderedSame { return titleCompare == .orderedAscending }
                return compareCodeOrder(lhs, rhs, codeSectionName: codeSectionName)
            }
        }
    }

    private static func compareCodeOrder(
        _ lhs: BookmarkedSection,
        _ rhs: BookmarkedSection,
        codeSectionName: (Int64?) -> String
    ) -> Bool {
        let lhsCode = resolvedCodeSectionName(lhs, fallback: codeSectionName)
        let rhsCode = resolvedCodeSectionName(rhs, fallback: codeSectionName)
        if lhsCode != rhsCode {
            return lhsCode.localizedStandardCompare(rhsCode) == .orderedAscending
        }
        if lhs.chapterNumber != rhs.chapterNumber {
            return lhs.chapterNumber.compare(rhs.chapterNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
        }
        let sectionOrder = lhs.sectionNumber.compare(rhs.sectionNumber, options: [.numeric, .caseInsensitive])
        if sectionOrder != .orderedSame {
            return sectionOrder == .orderedAscending
        }
        if lhs.annotationBlockID.isEmpty != rhs.annotationBlockID.isEmpty {
            return lhs.annotationBlockID.isEmpty
        }
        return lhs.rowID.localizedStandardCompare(rhs.rowID) == .orderedAscending
    }

    private static func resolvedCodeSectionName(
        _ bookmark: BookmarkedSection,
        fallback: (Int64?) -> String
    ) -> String {
        let name = bookmark.codeSectionName.trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? fallback(bookmark.codeSectionID) : name
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
    func evidenceExcerpt(sectionNumber: String, title: String, limit: Int = 240) -> String {
        var excerpt = replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !excerpt.isEmpty else { return "" }

        let normalizedSectionNumber = sectionNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        if !normalizedSectionNumber.isEmpty,
           excerpt.range(of: normalizedSectionNumber, options: [.anchored, .caseInsensitive]) != nil {
            excerpt.removeFirst(normalizedSectionNumber.count)
            excerpt = excerpt.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        let displayTitle = title.displayTitle(for: normalizedSectionNumber)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if !displayTitle.isEmpty,
           excerpt.range(of: displayTitle, options: [.anchored, .caseInsensitive]) != nil {
            excerpt.removeFirst(displayTitle.count)
            excerpt = excerpt.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        guard !excerpt.isEmpty else { return "" }
        guard excerpt.count > limit else { return excerpt }
        let end = excerpt.index(excerpt.startIndex, offsetBy: limit)
        return String(excerpt[..<end]).trimmingCharacters(in: .whitespacesAndNewlines) + "…"
    }

    func displayTitle(for sectionNumber: String) -> String {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        let normalized = trimmed
            .replacingOccurrences(
                of: #"^§\s*"#,
                with: "",
                options: .regularExpression
            )
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalized.hasPrefix(sectionNumber) else {
            return trimmed.titleThroughFirstPeriod
        }

        let suffix = normalized.dropFirst(sectionNumber.count).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !suffix.isEmpty else {
            return normalized.titleThroughFirstPeriod
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
