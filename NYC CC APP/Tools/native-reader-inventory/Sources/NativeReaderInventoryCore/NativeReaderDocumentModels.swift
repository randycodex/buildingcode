import Foundation

public enum NativeReaderBlockKind: String, Codable, CaseIterable, Sendable {
    case heading
    case paragraph
    case orderedList
    case unorderedList
    case table
    case image
    case figure
    case caption
    case footnote
    case divider
    case sourceNote
    case editorNote
    case unsupportedHTML
}

public enum NativeReaderTextStyle: String, Codable, CaseIterable, Sendable {
    case bold
    case italic
    case underline
    case strikethrough
    case superscript
    case `subscript`
    case code
    case small
}

public struct NativeReaderSourceReference: Codable, Equatable, Sendable {
    public let relativePath: String
    public let sourceOrder: Int
    public let element: String
    public let sourceSHA256: String

    public init(relativePath: String, sourceOrder: Int, element: String, sourceSHA256: String) {
        self.relativePath = relativePath
        self.sourceOrder = sourceOrder
        self.element = element
        self.sourceSHA256 = sourceSHA256
    }
}

public struct NativeReaderTextRun: Codable, Equatable, Sendable {
    public let text: String
    public let styles: [NativeReaderTextStyle]
    public let linkTarget: String?

    public init(text: String, styles: [NativeReaderTextStyle], linkTarget: String?) {
        self.text = text
        self.styles = styles
        self.linkTarget = linkTarget
    }
}

public enum NativeReaderListSegmentKind: String, Codable, Sendable {
    case text
    case table
}

public struct NativeReaderListSegment: Codable, Equatable, Sendable {
    public let id: String
    public let kind: NativeReaderListSegmentKind
    public let plainText: String
    public let runs: [NativeReaderTextRun]
    public let table: NativeReaderTable?

    public init(
        id: String,
        kind: NativeReaderListSegmentKind,
        plainText: String,
        runs: [NativeReaderTextRun],
        table: NativeReaderTable?
    ) {
        self.id = id
        self.kind = kind
        self.plainText = plainText
        self.runs = runs
        self.table = table
    }
}

public struct NativeReaderListItem: Codable, Equatable, Sendable {
    public let id: String
    public let depth: Int
    public let ordinal: Int?
    public let plainText: String
    public let runs: [NativeReaderTextRun]
    public let segments: [NativeReaderListSegment]
    public let children: [NativeReaderListItem]

    public init(
        id: String,
        depth: Int,
        ordinal: Int?,
        plainText: String,
        runs: [NativeReaderTextRun],
        segments: [NativeReaderListSegment] = [],
        children: [NativeReaderListItem]
    ) {
        self.id = id
        self.depth = depth
        self.ordinal = ordinal
        self.plainText = plainText
        self.runs = runs
        self.segments = segments
        self.children = children
    }
}

public struct NativeReaderTableCell: Codable, Equatable, Sendable {
    public let row: Int
    public let column: Int
    public let rowSpan: Int
    public let columnSpan: Int
    public let isHeader: Bool
    public let plainText: String
    public let runs: [NativeReaderTextRun]
    public let anchorIDs: [String]
    public let linkTargets: [String]
    public let classNames: [String]
    public let inlineStyle: String?
    public let borderSignatures: [String]

    public init(
        row: Int,
        column: Int,
        rowSpan: Int,
        columnSpan: Int,
        isHeader: Bool,
        plainText: String,
        runs: [NativeReaderTextRun],
        anchorIDs: [String],
        linkTargets: [String],
        classNames: [String],
        inlineStyle: String?,
        borderSignatures: [String]
    ) {
        self.row = row
        self.column = column
        self.rowSpan = rowSpan
        self.columnSpan = columnSpan
        self.isHeader = isHeader
        self.plainText = plainText
        self.runs = runs
        self.anchorIDs = anchorIDs
        self.linkTargets = linkTargets
        self.classNames = classNames
        self.inlineStyle = inlineStyle
        self.borderSignatures = borderSignatures
    }
}

public struct NativeReaderTable: Codable, Equatable, Sendable {
    public let id: String
    public let rowCount: Int
    public let columnCount: Int
    public let cells: [NativeReaderTableCell]
    public let caption: String?
    public let footnotes: [String]
    public let renderingClassification: TableRenderingClassification
    public let classificationReasons: [String]
    public let structureSHA256: String
    public let sourceHTML: String?

    public init(
        id: String,
        rowCount: Int,
        columnCount: Int,
        cells: [NativeReaderTableCell],
        caption: String?,
        footnotes: [String],
        renderingClassification: TableRenderingClassification,
        classificationReasons: [String],
        structureSHA256: String,
        sourceHTML: String?
    ) {
        self.id = id
        self.rowCount = rowCount
        self.columnCount = columnCount
        self.cells = cells
        self.caption = caption
        self.footnotes = footnotes
        self.renderingClassification = renderingClassification
        self.classificationReasons = classificationReasons
        self.structureSHA256 = structureSHA256
        self.sourceHTML = sourceHTML
    }
}

public struct NativeReaderMedia: Codable, Equatable, Sendable {
    public let id: String
    public let element: String
    public let source: String?
    public let resolvedAssetPath: String?
    public let assetExists: Bool
    public let assetSHA256: String?
    public let width: String?
    public let height: String?
    public let caption: String?
    public let accessibilityText: String?
    public let sourceHTML: String?

    public init(
        id: String,
        element: String,
        source: String?,
        resolvedAssetPath: String?,
        assetExists: Bool,
        assetSHA256: String?,
        width: String?,
        height: String?,
        caption: String?,
        accessibilityText: String?,
        sourceHTML: String?
    ) {
        self.id = id
        self.element = element
        self.source = source
        self.resolvedAssetPath = resolvedAssetPath
        self.assetExists = assetExists
        self.assetSHA256 = assetSHA256
        self.width = width
        self.height = height
        self.caption = caption
        self.accessibilityText = accessibilityText
        self.sourceHTML = sourceHTML
    }
}

public struct NativeReaderBlock: Codable, Equatable, Sendable {
    public let id: String
    public let kind: NativeReaderBlockKind
    public let sourceOrder: Int
    public let sectionID: String?
    public let anchorIDs: [String]
    public let plainText: String
    public let runs: [NativeReaderTextRun]
    public let headingLevel: Int?
    public let listItems: [NativeReaderListItem]
    public let table: NativeReaderTable?
    public let media: [NativeReaderMedia]
    public let caption: String?
    public let sourceReference: NativeReaderSourceReference
    public let sourceHTML: String?

    public init(
        id: String,
        kind: NativeReaderBlockKind,
        sourceOrder: Int,
        sectionID: String?,
        anchorIDs: [String],
        plainText: String,
        runs: [NativeReaderTextRun],
        headingLevel: Int?,
        listItems: [NativeReaderListItem],
        table: NativeReaderTable?,
        media: [NativeReaderMedia],
        caption: String?,
        sourceReference: NativeReaderSourceReference,
        sourceHTML: String?
    ) {
        self.id = id
        self.kind = kind
        self.sourceOrder = sourceOrder
        self.sectionID = sectionID
        self.anchorIDs = anchorIDs
        self.plainText = plainText
        self.runs = runs
        self.headingLevel = headingLevel
        self.listItems = listItems
        self.table = table
        self.media = media
        self.caption = caption
        self.sourceReference = sourceReference
        self.sourceHTML = sourceHTML
    }
}

public struct NativeReaderAnchorMapping: Codable, Equatable, Sendable {
    public let id: String
    public let sourceOrder: Int
    public let blockID: String?
    public let sectionID: String?

    public init(id: String, sourceOrder: Int, blockID: String?, sectionID: String?) {
        self.id = id
        self.sourceOrder = sourceOrder
        self.blockID = blockID
        self.sectionID = sectionID
    }
}

public struct NativeReaderLink: Codable, Equatable, Sendable {
    public let sourceOrder: Int
    public let element: String
    public let target: String
    public let text: String
    public let isInternalAnchor: Bool

    public init(sourceOrder: Int, element: String, target: String, text: String, isInternalAnchor: Bool) {
        self.sourceOrder = sourceOrder
        self.element = element
        self.target = target
        self.text = text
        self.isInternalAnchor = isInternalAnchor
    }
}

public struct NativeReaderChapterMetadata: Codable, Equatable, Sendable {
    public let codeVersion: String
    public let codeSectionID: Int64?
    public let codeSectionName: String?
    public let chapterID: Int64?
    public let chapterIdentifier: String
    public let chapterNumber: String?
    public let chapterTitle: String?

    public init(
        codeVersion: String,
        codeSectionID: Int64?,
        codeSectionName: String?,
        chapterID: Int64?,
        chapterIdentifier: String,
        chapterNumber: String?,
        chapterTitle: String?
    ) {
        self.codeVersion = codeVersion
        self.codeSectionID = codeSectionID
        self.codeSectionName = codeSectionName
        self.chapterID = chapterID
        self.chapterIdentifier = chapterIdentifier
        self.chapterNumber = chapterNumber
        self.chapterTitle = chapterTitle
    }
}

public struct NativeReaderDocumentValidation: Codable, Equatable, Sendable {
    public let normalizedTextMatches: Bool
    public let anchorSequenceMatches: Bool
    public let linkTargetsMatch: Bool
    public let tableStructuresMatch: Bool
    public let imageInventoryMatches: Bool
    public let unsupportedBlockCount: Int
    public let messages: [String]

    public var passesStructuralValidation: Bool {
        normalizedTextMatches
            && anchorSequenceMatches
            && linkTargetsMatch
            && tableStructuresMatch
            && imageInventoryMatches
    }

    public init(
        normalizedTextMatches: Bool,
        anchorSequenceMatches: Bool,
        linkTargetsMatch: Bool,
        tableStructuresMatch: Bool,
        imageInventoryMatches: Bool,
        unsupportedBlockCount: Int,
        messages: [String]
    ) {
        self.normalizedTextMatches = normalizedTextMatches
        self.anchorSequenceMatches = anchorSequenceMatches
        self.linkTargetsMatch = linkTargetsMatch
        self.tableStructuresMatch = tableStructuresMatch
        self.imageInventoryMatches = imageInventoryMatches
        self.unsupportedBlockCount = unsupportedBlockCount
        self.messages = messages
    }
}

public struct NativeReaderChapterDocument: Codable, Equatable, Sendable {
    public static let schemaVersion = 1

    public let schemaVersion: Int
    public let parserSchemaVersion: String
    public let documentID: String
    public let packageID: String
    public let codeFamily: String
    public let metadata: NativeReaderChapterMetadata
    public let sourcePath: String
    public let sourceSHA256: String
    public let normalizedTextSHA256: String?
    public let normalizedTextCharacterCount: Int
    public let eligibility: NativeReaderEligibility
    public let blocks: [NativeReaderBlock]
    public let anchors: [NativeReaderAnchorMapping]
    public let links: [NativeReaderLink]
    public let validation: NativeReaderDocumentValidation

    public init(
        parserSchemaVersion: String,
        documentID: String,
        packageID: String,
        codeFamily: String,
        metadata: NativeReaderChapterMetadata,
        sourcePath: String,
        sourceSHA256: String,
        normalizedTextSHA256: String?,
        normalizedTextCharacterCount: Int,
        eligibility: NativeReaderEligibility,
        blocks: [NativeReaderBlock],
        anchors: [NativeReaderAnchorMapping],
        links: [NativeReaderLink],
        validation: NativeReaderDocumentValidation
    ) {
        schemaVersion = Self.schemaVersion
        self.parserSchemaVersion = parserSchemaVersion
        self.documentID = documentID
        self.packageID = packageID
        self.codeFamily = codeFamily
        self.metadata = metadata
        self.sourcePath = sourcePath
        self.sourceSHA256 = sourceSHA256
        self.normalizedTextSHA256 = normalizedTextSHA256
        self.normalizedTextCharacterCount = normalizedTextCharacterCount
        self.eligibility = eligibility
        self.blocks = blocks
        self.anchors = anchors
        self.links = links
        self.validation = validation
    }
}

public struct NativeReaderChapterAnalysis: Codable, Equatable, Sendable {
    public let inventory: ChapterInventory
    public let document: NativeReaderChapterDocument

    public init(inventory: ChapterInventory, document: NativeReaderChapterDocument) {
        self.inventory = inventory
        self.document = document
    }
}

public enum NativeReaderRolloutTier: String, Codable, CaseIterable, Sendable {
    case textOnly
    case media
    case nativeTable
    case isolatedTableFallback

    public init(blocks: [NativeReaderBlock]) {
        let tables = blocks.compactMap(\.table) + blocks.flatMap { block in
            block.listItems.flatMap(Self.embeddedTables)
        }
        if tables.contains(where: { $0.renderingClassification == .isolatedHTML }) {
            self = .isolatedTableFallback
        } else if !tables.isEmpty {
            self = .nativeTable
        } else if blocks.contains(where: { !$0.media.isEmpty }) {
            self = .media
        } else {
            self = .textOnly
        }
    }

    private static func embeddedTables(in item: NativeReaderListItem) -> [NativeReaderTable] {
        item.segments.compactMap(\.table) + item.children.flatMap(embeddedTables)
    }
}

public struct NativeReaderDocumentIndexEntry: Codable, Equatable, Sendable {
    public let relativePath: String
    public let sourceSHA256: String
    public let documentID: String
    public let documentPath: String
    public let documentSHA256: String
    public let compressedSHA256: String
    public let uncompressedByteCount: Int
    public let compressedByteCount: Int
    public let blockCount: Int
    public let rolloutTier: NativeReaderRolloutTier
    public let eligibility: NativeReaderEligibility
    public let passesStructuralValidation: Bool

    public init(
        relativePath: String,
        sourceSHA256: String,
        documentID: String,
        documentPath: String,
        documentSHA256: String,
        compressedSHA256: String,
        uncompressedByteCount: Int,
        compressedByteCount: Int,
        blockCount: Int,
        rolloutTier: NativeReaderRolloutTier,
        eligibility: NativeReaderEligibility,
        passesStructuralValidation: Bool
    ) {
        self.relativePath = relativePath
        self.sourceSHA256 = sourceSHA256
        self.documentID = documentID
        self.documentPath = documentPath
        self.documentSHA256 = documentSHA256
        self.compressedSHA256 = compressedSHA256
        self.uncompressedByteCount = uncompressedByteCount
        self.compressedByteCount = compressedByteCount
        self.blockCount = blockCount
        self.rolloutTier = rolloutTier
        self.eligibility = eligibility
        self.passesStructuralValidation = passesStructuralValidation
    }
}

public struct NativeReaderDocumentIndex: Codable, Equatable, Sendable {
    public let schemaVersion: Int
    public let documentSchemaVersion: Int
    public let parserSchemaVersion: String
    public let compression: String
    public let corpusSHA256: String
    public let entries: [NativeReaderDocumentIndexEntry]

    public init(corpusSHA256: String, entries: [NativeReaderDocumentIndexEntry]) {
        schemaVersion = 2
        documentSchemaVersion = NativeReaderChapterDocument.schemaVersion
        parserSchemaVersion = CorpusInventoryGenerator.parserSchemaVersion
        compression = "lzfse"
        self.corpusSHA256 = corpusSHA256
        self.entries = entries.sorted { $0.relativePath < $1.relativePath }
    }
}
