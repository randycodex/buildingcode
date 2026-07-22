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

    private static let nyc2022Aliases = [
        "nyc-2022",
        "2022 Construction Codes",
        canonicalNYC2022
    ]

    private static func isNYC2022Alias(_ value: String) -> Bool {
        nyc2022Aliases.contains { $0.caseInsensitiveCompare(value) == .orderedSame }
    }

    static func server(_ value: String) -> String {
        let candidate = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return candidate.isEmpty || isNYC2022Alias(candidate) ? canonicalNYC2022 : candidate
    }

    static func local(_ value: String) -> String {
        let candidate = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return candidate.isEmpty || isNYC2022Alias(candidate) ? localNYC2022 : candidate
    }

    static func equivalentLocalVersions(_ value: String) -> [String] {
        let candidate = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard candidate.isEmpty || isNYC2022Alias(candidate) else { return [candidate] }
        return [localNYC2022, "2022 Construction Codes", "nyc-2022", canonicalNYC2022]
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

    var normalizedBlockID: String {
        blockID?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }
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
    let colorHex: String?
    let sortOrder: Int?
    let updatedAt: Date
    let deletedAt: Date?
}

struct ServerProjectSectionRecord: Codable, Hashable, Sendable {
    let id: String
    let userID: String
    let codeVersion: String
    let folderClientID: String?
    let localFolderID: Int64?
    let sectionID: Int64
    let scope: String?
    let updatedAt: Date
    let deletedAt: Date?
}

struct ServerWorkboardRecord: Codable, Hashable, Sendable {
    let id: String
    let userID: String
    let codeVersion: String
    let projectID: String
    let projectName: String?
    let updatedAt: Date
    let deletedAt: Date?
}

struct ServerContinuityRecord: Codable, Hashable, Sendable {
    let userID: String
    let codeVersion: String
    let values: [String: String]
    let updatedAt: Date
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
                    colorHex: item.operationType == .delete ? nil : payload.values["colorHex"],
                    sortOrder: payload.values["sortOrder"].flatMap(Int.init),
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

struct ServerUserContentPullResult: Codable, Hashable, Sendable {
    let userID: String
    let pulledAt: Date
    var latestEventID: Int64? = nil
    var syncRevision: Int64? = nil
    var contentMapVersion: Int? = nil
    var entitlement: AppEntitlement? = nil
    let mutations: [ServerUserContentMutation]
}

struct UserContentSyncCheckpoint: Codable, Hashable, Sendable {
    let accountUserID: String
    let backendName: String
    let lastSuccessfulPushAt: Date?
    let lastSuccessfulPullAt: Date?
    let lastAttemptedSyncAt: Date?
    let lastErrorMessage: String?
    let latestEventID: Int64?

    init(
        accountUserID: String,
        backendName: String,
        lastSuccessfulPushAt: Date? = nil,
        lastSuccessfulPullAt: Date? = nil,
        lastAttemptedSyncAt: Date? = nil,
        lastErrorMessage: String? = nil,
        latestEventID: Int64? = nil
    ) {
        self.accountUserID = accountUserID
        self.backendName = backendName
        self.lastSuccessfulPushAt = lastSuccessfulPushAt
        self.lastSuccessfulPullAt = lastSuccessfulPullAt
        self.lastAttemptedSyncAt = lastAttemptedSyncAt
        self.lastErrorMessage = lastErrorMessage
        self.latestEventID = latestEventID
    }

    func markingPushSucceeded(at date: Date, latestEventID: Int64? = nil) -> UserContentSyncCheckpoint {
        UserContentSyncCheckpoint(
            accountUserID: accountUserID,
            backendName: backendName,
            lastSuccessfulPushAt: date,
            lastSuccessfulPullAt: lastSuccessfulPullAt,
            lastAttemptedSyncAt: date,
            lastErrorMessage: nil,
            latestEventID: latestEventID ?? self.latestEventID
        )
    }

    func markingPullSucceeded(at date: Date, latestEventID: Int64? = nil) -> UserContentSyncCheckpoint {
        UserContentSyncCheckpoint(
            accountUserID: accountUserID,
            backendName: backendName,
            lastSuccessfulPushAt: lastSuccessfulPushAt,
            lastSuccessfulPullAt: date,
            lastAttemptedSyncAt: date,
            lastErrorMessage: nil,
            latestEventID: latestEventID ?? self.latestEventID
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
            latestEventID: latestEventID
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
}

struct BackendSignOutRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
}

struct BackendSignOutResponse: Codable, Hashable, Sendable {
    let signedOut: Bool
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

struct BackendAppleTransactionVerifyRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let signedTransactionInfo: String
}

struct BackendAppleTransactionVerifyResponse: Codable, Hashable, Sendable {
    let entitlement: AppEntitlement?
}

private struct BackendErrorResponse: Codable, Hashable, Sendable {
    let error: String?
}

struct BackendUserContentPushRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let batch: ServerUserContentBatch
}

struct BackendUserContentPushResponse: Codable, Hashable, Sendable {
    let acceptedMutationIDs: [String]
    let rejectedMutationIDs: [String]?
    var latestEventID: Int64? = nil
    var syncRevision: Int64? = nil
    var entitlement: AppEntitlement? = nil
    let serverTime: Date
}

struct BackendUserContentPullRequest: Codable, Hashable, Sendable {
    let auth: BackendAuthContext
    let since: Date?
    var sinceEventID: Int64? = nil
    var contentMapVersion: Int? = 2
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
    func attachLocalData(_ request: BackendAttachLocalDataRequest) async throws -> AccountMigrationState
    func updateProfile(_ request: BackendProfileUpdateRequest) async throws -> BackendProfileUpdateResponse
    func verifyAppleTransaction(_ request: BackendAppleTransactionVerifyRequest) async throws -> BackendAppleTransactionVerifyResponse
    func pushUserContent(_ request: BackendUserContentPushRequest) async throws -> BackendUserContentPushResponse
    func pullUserContent(_ request: BackendUserContentPullRequest) async throws -> ServerUserContentPullResult
}

enum PermitextBackendMode: String, Codable, Hashable, Sendable {
    case localDev
    case http
}

struct PermitextBackendConfiguration: Codable, Hashable, Sendable {
    static let modeDefaultsKey = "permitext.backend.mode"
    static let apiBaseURLDefaultsKey = "permitext.backend.apiBaseURL"
    static let apiBaseURLInfoPlistKey = "PermitextBackendAPIBaseURL"

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
        let trimmedDefaultsBaseURL = defaultsBaseURL?.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedBundleBaseURL = bundleBaseURL?.trimmingCharacters(in: .whitespacesAndNewlines)
        let apiBaseURLString = trimmedDefaultsBaseURL?.isEmpty == false
            ? trimmedDefaultsBaseURL
            : (trimmedBundleBaseURL?.isEmpty == false ? trimmedBundleBaseURL : nil)
        let mode = apiBaseURLString == nil ? (storedMode ?? .localDev) : .http

        return PermitextBackendConfiguration(
            mode: mode,
            apiBaseURLString: apiBaseURLString
        )
    }

    func makeTransport() -> PermitextBackendTransport {
        switch mode {
        case .http:
            guard let apiBaseURLString, let baseURL = URL(string: apiBaseURLString) else {
                return LocalPermitextBackendTransport()
            }
            return PermitextBackendHTTPTransport(baseURL: baseURL)
        case .localDev:
            return LocalPermitextBackendTransport()
        }
    }

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
    case serverStatus(Int, String?)

    var statusCode: Int? {
        guard case .serverStatus(let statusCode, _) = self else { return nil }
        return statusCode
    }

    var isAuthenticationFailure: Bool {
        statusCode == 401 || statusCode == 403
    }

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The backend returned an invalid response."
        case .serverStatus(let statusCode, let message):
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
        try await post("account/sign-in", body: request)
    }

    func signOut(_ request: BackendSignOutRequest) async throws -> BackendSignOutResponse {
        try await post("account/sign-out", body: request, bearerToken: request.auth.bearerToken)
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

    func verifyAppleTransaction(_ request: BackendAppleTransactionVerifyRequest) async throws -> BackendAppleTransactionVerifyResponse {
        try await post("billing/apple/transactions/verify", body: request, bearerToken: request.auth.bearerToken)
    }

    func pushUserContent(_ request: BackendUserContentPushRequest) async throws -> BackendUserContentPushResponse {
        try await post("sync/push", body: request, bearerToken: request.auth.bearerToken)
    }

    func pullUserContent(_ request: BackendUserContentPullRequest) async throws -> ServerUserContentPullResult {
        try await post("sync/pull", body: request, bearerToken: request.auth.bearerToken)
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
        bearerToken: String? = nil
    ) async throws -> ResponseBody {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.timeoutInterval = requestTimeout
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
            let backendMessage = try? decoder.decode(BackendErrorResponse.self, from: data).error
            throw PermitextBackendHTTPError.serverStatus(httpResponse.statusCode, backendMessage)
        }
        return try decoder.decode(ResponseBody.self, from: data)
    }
}

actor LocalPermitextBackendTransport: PermitextBackendTransport {
    nonisolated let name = "local-dev-backend"
    private var accountsByUserID: [String: SignedInAccount] = [:]
    private var userContentByUserID: [String: [ServerUserContentMutation]] = [:]

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

    func verifyAppleTransaction(_ request: BackendAppleTransactionVerifyRequest) async throws -> BackendAppleTransactionVerifyResponse {
        BackendAppleTransactionVerifyResponse(entitlement: .appleSubscriptionPro)
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
            serverTime: Date()
        )
    }

    func pullUserContent(_ request: BackendUserContentPullRequest) async throws -> ServerUserContentPullResult {
        let allMutations = userContentByUserID[request.auth.accountUserID] ?? []
        let mutations = request.since.map { since in
            allMutations.filter { $0.updatedAt > since || ($0.deletedAt.map { $0 > since } ?? false) }
        } ?? allMutations
        return ServerUserContentPullResult(
            userID: request.auth.accountUserID,
            pulledAt: Date(),
            mutations: mutations
        )
    }
}

enum UserContentMergeAction: String, Codable, Hashable, Sendable {
    case applyServer
    case keepLocal
    case uploadLocal
    case deleteLocal
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
    var deleteLocalCount: Int { count(.deleteLocal) }
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
                action: .deleteLocal,
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
                action: .deleteLocal,
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
    let name: String
    let address: String
    let description: String
    let colorHex: String
    let sortOrder: Int
    let createdAt: Date
    let updatedAt: Date

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

    var hasNote: Bool {
        !noteBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var rowID: String {
        annotationBlockID.isEmpty ? "section:\(id)" : "section:\(id):block:\(annotationBlockID)"
    }

    var isBlockAnnotation: Bool {
        !annotationBlockID.isEmpty
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
    let plan: AppPlan
    let source: EntitlementSource
    let grantedUserID: String?

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

    init(
        provider: AccountAuthProvider,
        providerUserID: String,
        displayName: String?,
        signedInAt: Date,
        email: String? = nil,
        identityToken: String? = nil,
        authorizationCode: String? = nil
    ) {
        self.provider = provider
        self.providerUserID = providerUserID
        self.displayName = displayName
        self.signedInAt = signedInAt
        self.email = email
        self.identityToken = identityToken
        self.authorizationCode = authorizationCode
    }
}

struct SignedInAccount: Codable, Hashable, Sendable {
    let appUserID: String
    let authProvider: AccountAuthProvider
    let authProviderUserID: String
    let appleUserID: String
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
    func signIn(credential: AccountSignInCredential) async throws -> BackendAccountRecord
    func signOut(account: SignedInAccount) async throws
    func attachLocalData(account: SignedInAccount) async throws -> AccountMigrationState
    func updateProfile(account: SignedInAccount, publicUsername: String?, displayName: String?) async throws -> SignedInAccount
    func verifyAppleTransaction(account: SignedInAccount, signedTransactionInfo: String) async throws -> AppEntitlement?
}

struct LocalAccountBackendClient: AccountBackendClient {
    let name = "local"

    func health() async throws -> BackendHealthStatus {
        BackendHealthStatus(ok: true, storage: "memory")
    }

    func signIn(credential: AccountSignInCredential) async throws -> BackendAccountRecord {
        if credential.provider == .passkey {
            throw PermitextBackendHTTPError.serverStatus(410, "Passkey sign-in is unavailable. Use Sign in with Apple.")
        }
        let account = SignedInAccount(
            appUserID: "\(credential.provider.rawValue):\(credential.providerUserID)",
            appleUserID: credential.provider == .apple ? credential.providerUserID : "",
            publicUsername: nil,
            displayName: credential.displayName,
            signedInAt: credential.signedInAt,
            migrationState: .notStarted
        )
        return BackendAccountRecord(account: account, entitlement: nil)
    }

    func signOut(account: SignedInAccount) async throws {}

    func attachLocalData(account: SignedInAccount) async throws -> AccountMigrationState {
        .localDataAttached
    }

    func updateProfile(account: SignedInAccount, publicUsername: String?, displayName: String?) async throws -> SignedInAccount {
        SignedInAccount(
            appUserID: account.appUserID,
            authProvider: account.authProvider,
            authProviderUserID: account.authProviderUserID,
            appleUserID: account.appleUserID,
            publicUsername: publicUsername,
            displayName: displayName,
            signedInAt: account.signedInAt,
            migrationState: account.migrationState,
            backendSessionToken: account.backendSessionToken
        )
    }

    func verifyAppleTransaction(account: SignedInAccount, signedTransactionInfo: String) async throws -> AppEntitlement? {
        .appleSubscriptionPro
    }
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
            return .appleSubscriptionPro
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
            setEntitlement(.appleSubscriptionPro, defaults: defaults)
        } else if currentStoredEntitlement(defaults: defaults).source.isAppleManagedSubscription {
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
    let debugSummary: String
    let signedTransactionInfo: String?
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

    func snapshot(signedTransactionInfo: String? = nil) async -> StoreKitSubscriptionSnapshot {
        async let planResult = verifiedPlanAndSignedTransactionInfo()
        async let products = proProducts()
        async let debugSummary = transactionDebugSummary()
        let loadedProducts = await products
        let resolvedPlanResult = await planResult
        return StoreKitSubscriptionSnapshot(
            plan: resolvedPlanResult.plan,
            proDisplayPrice: loadedProducts.first { $0.id == proProductID }?.displayPrice,
            loadedProductIDs: loadedProducts.map(\.id),
            debugSummary: await debugSummary,
            signedTransactionInfo: signedTransactionInfo ?? resolvedPlanResult.signedTransactionInfo
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
            return await snapshot(signedTransactionInfo: verification.jwsRepresentation)
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
        for _ in 0..<8 {
            let currentSnapshot = await snapshot()
            if currentSnapshot.plan == .pro {
                return currentSnapshot
            }
            try? await Task.sleep(nanoseconds: 500_000_000)
        }
        return await snapshot()
    }

    func transactionUpdates() -> AsyncStream<StoreKitSubscriptionSnapshot> {
        AsyncStream { continuation in
            let task = Task {
                for await result in Transaction.updates {
                    guard case .verified(let transaction) = result else { continue }
                    if isActiveProTransaction(transaction) {
                        LocalEntitlementService.setVerifiedPlan(.pro)
                    }
                    await transaction.finish()
                    continuation.yield(await snapshot(signedTransactionInfo: result.jwsRepresentation))
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private func proProducts() async -> [Product] {
        if let cachedProProduct { return [cachedProProduct] }
        let products = (try? await Product.products(for: [proProductID])) ?? []
        cachedProProduct = products.first { $0.id == proProductID }
        return products
    }

    private func verifiedPlanAndSignedTransactionInfo() async -> (plan: AppPlan, signedTransactionInfo: String?) {
        for await verification in Transaction.currentEntitlements {
            guard case .verified(let transaction) = verification else { continue }
            guard isActiveProTransaction(transaction) else { continue }
            LocalEntitlementService.setVerifiedPlan(.pro)
            return (.pro, verification.jwsRepresentation)
        }
        if let verification = await Transaction.latest(for: proProductID),
           case .verified(let transaction) = verification,
           isActiveProTransaction(transaction) {
            LocalEntitlementService.setVerifiedPlan(.pro)
            return (.pro, verification.jwsRepresentation)
        }
        if await subscriptionStatusIndicatesActivePro() {
            LocalEntitlementService.setVerifiedPlan(.pro)
            return (.pro, nil)
        }
        let currentEntitlement = LocalEntitlementService().currentEntitlement
        if currentEntitlement.plan == .pro && !currentEntitlement.source.isAppleManagedSubscription {
            return (.pro, nil)
        }
        LocalEntitlementService.setVerifiedPlan(.free)
        return (.free, nil)
    }

    private nonisolated func isActiveProTransaction(_ transaction: Transaction) -> Bool {
        guard transaction.productID == StoreKitProductID.proMonthly, transaction.revocationDate == nil else {
            return false
        }
        if let expirationDate = transaction.expirationDate, expirationDate <= Date() {
            return false
        }
        return true
    }

    private func subscriptionStatusIndicatesActivePro() async -> Bool {
        guard let subscription = await proProducts().first(where: { $0.id == proProductID })?.subscription,
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
                let activeText = isActiveProTransaction(transaction) ? "active" : "inactive"
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
        guard let subscription = await proProducts().first(where: { $0.id == proProductID })?.subscription else {
            return "none"
        }
        guard let statuses = try? await subscription.status else {
            return "unavailable"
        }
        guard !statuses.isEmpty else {
            return "none"
        }
        return statuses.map { String(describing: $0.state) }.joined(separator: ", ")
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
        let sectionOrder = lhs.sectionNumber.compare(rhs.sectionNumber, options: [.numeric, .caseInsensitive])
        if sectionOrder != .orderedSame {
            return sectionOrder == .orderedAscending
        }
        if lhs.annotationBlockID.isEmpty != rhs.annotationBlockID.isEmpty {
            return lhs.annotationBlockID.isEmpty
        }
        return lhs.rowID.localizedStandardCompare(rhs.rowID) == .orderedAscending
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
