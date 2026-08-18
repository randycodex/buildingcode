import Foundation

public enum NativeReaderEligibilityState: String, Codable, CaseIterable, Sendable {
    case native
    case nativeWithTableFallback
    case fullHTMLFallback
    case invalidContent
}

public struct NativeReaderEligibility: Codable, Equatable, Sendable {
    public let state: NativeReaderEligibilityState
    public let reasons: [String]

    public init(state: NativeReaderEligibilityState, reasons: [String]) {
        self.state = state
        self.reasons = reasons
    }
}

public struct AnchorInventory: Codable, Equatable, Sendable {
    public let id: String
    public let element: String
    public let title: String?
    public let sourceOrder: Int

    public init(id: String, element: String, title: String?, sourceOrder: Int) {
        self.id = id
        self.element = element
        self.title = title
        self.sourceOrder = sourceOrder
    }
}

public struct HeadingInventory: Codable, Equatable, Sendable {
    public let level: Int
    public let text: String
    public let anchorIDs: [String]
    public let sourceOrder: Int

    public init(level: Int, text: String, anchorIDs: [String], sourceOrder: Int) {
        self.level = level
        self.text = text
        self.anchorIDs = anchorIDs
        self.sourceOrder = sourceOrder
    }
}

public struct ListInventory: Codable, Equatable, Sendable {
    public let orderedListCount: Int
    public let unorderedListCount: Int
    public let itemCount: Int
    public let maximumDepth: Int

    public init(orderedListCount: Int, unorderedListCount: Int, itemCount: Int, maximumDepth: Int) {
        self.orderedListCount = orderedListCount
        self.unorderedListCount = unorderedListCount
        self.itemCount = itemCount
        self.maximumDepth = maximumDepth
    }
}

public enum TableRenderingClassification: String, Codable, Sendable {
    case nativeSimple
    case isolatedHTML
}

public struct TableInventory: Codable, Equatable, Sendable {
    public let sourceOrder: Int
    public let anchorID: String?
    public let rowCount: Int
    public let logicalColumnCount: Int
    public let cellCount: Int
    public let headerCellCount: Int
    public let maximumRowSpan: Int
    public let maximumColumnSpan: Int
    public let hasMultiRowHeader: Bool
    public let caption: String?
    public let footnotes: [String]
    public let borderSignatures: [String]
    public let embeddedElementNames: [String]
    public let renderingClassification: TableRenderingClassification
    public let classificationReasons: [String]

    public init(
        sourceOrder: Int,
        anchorID: String?,
        rowCount: Int,
        logicalColumnCount: Int,
        cellCount: Int,
        headerCellCount: Int,
        maximumRowSpan: Int,
        maximumColumnSpan: Int,
        hasMultiRowHeader: Bool,
        caption: String?,
        footnotes: [String],
        borderSignatures: [String],
        embeddedElementNames: [String],
        renderingClassification: TableRenderingClassification,
        classificationReasons: [String]
    ) {
        self.sourceOrder = sourceOrder
        self.anchorID = anchorID
        self.rowCount = rowCount
        self.logicalColumnCount = logicalColumnCount
        self.cellCount = cellCount
        self.headerCellCount = headerCellCount
        self.maximumRowSpan = maximumRowSpan
        self.maximumColumnSpan = maximumColumnSpan
        self.hasMultiRowHeader = hasMultiRowHeader
        self.caption = caption
        self.footnotes = footnotes
        self.borderSignatures = borderSignatures
        self.embeddedElementNames = embeddedElementNames
        self.renderingClassification = renderingClassification
        self.classificationReasons = classificationReasons
    }
}

public struct ImageInventory: Codable, Equatable, Sendable {
    public let sourceOrder: Int
    public let element: String
    public let source: String?
    public let resolvedAssetPath: String?
    public let assetExists: Bool
    public let width: String?
    public let height: String?
    public let caption: String?
    public let accessibilityText: String?

    public init(
        sourceOrder: Int,
        element: String,
        source: String?,
        resolvedAssetPath: String?,
        assetExists: Bool,
        width: String?,
        height: String?,
        caption: String?,
        accessibilityText: String?
    ) {
        self.sourceOrder = sourceOrder
        self.element = element
        self.source = source
        self.resolvedAssetPath = resolvedAssetPath
        self.assetExists = assetExists
        self.width = width
        self.height = height
        self.caption = caption
        self.accessibilityText = accessibilityText
    }
}

public struct LinkInventory: Codable, Equatable, Sendable {
    public let element: String
    public let target: String
    public let occurrences: Int
    public let isInternalAnchor: Bool

    public init(element: String, target: String, occurrences: Int, isInternalAnchor: Bool) {
        self.element = element
        self.target = target
        self.occurrences = occurrences
        self.isInternalAnchor = isInternalAnchor
    }
}

public struct ChapterInventory: Codable, Equatable, Sendable {
    public let relativePath: String
    public let packageID: String
    public let codeFamily: String
    public let chapterIdentifier: String
    public let sourceSHA256: String
    public let sourceByteCount: Int
    public let parserSucceeded: Bool
    public let parserMessages: [String]
    public let normalizedTextSHA256: String?
    public let normalizedTextCharacterCount: Int
    public let sectionCount: Int
    public let stableAnchors: [AnchorInventory]
    public let duplicateAnchorIDs: [String]
    public let headingHierarchy: [HeadingInventory]
    public let textBlockCount: Int
    public let lists: ListInventory
    public let tables: [TableInventory]
    public let images: [ImageInventory]
    public let links: [LinkInventory]
    public let elementNames: [String]
    public let classNames: [String]
    public let inlineCSSProperties: [String]
    public let unknownElementNames: [String]
    public let unknownClassNames: [String]
    public let unsupportedCSSProperties: [String]
    public let eligibility: NativeReaderEligibility

    public init(
        relativePath: String,
        packageID: String,
        codeFamily: String,
        chapterIdentifier: String,
        sourceSHA256: String,
        sourceByteCount: Int,
        parserSucceeded: Bool,
        parserMessages: [String],
        normalizedTextSHA256: String?,
        normalizedTextCharacterCount: Int,
        sectionCount: Int,
        stableAnchors: [AnchorInventory],
        duplicateAnchorIDs: [String],
        headingHierarchy: [HeadingInventory],
        textBlockCount: Int,
        lists: ListInventory,
        tables: [TableInventory],
        images: [ImageInventory],
        links: [LinkInventory],
        elementNames: [String],
        classNames: [String],
        inlineCSSProperties: [String],
        unknownElementNames: [String],
        unknownClassNames: [String],
        unsupportedCSSProperties: [String],
        eligibility: NativeReaderEligibility
    ) {
        self.relativePath = relativePath
        self.packageID = packageID
        self.codeFamily = codeFamily
        self.chapterIdentifier = chapterIdentifier
        self.sourceSHA256 = sourceSHA256
        self.sourceByteCount = sourceByteCount
        self.parserSucceeded = parserSucceeded
        self.parserMessages = parserMessages
        self.normalizedTextSHA256 = normalizedTextSHA256
        self.normalizedTextCharacterCount = normalizedTextCharacterCount
        self.sectionCount = sectionCount
        self.stableAnchors = stableAnchors
        self.duplicateAnchorIDs = duplicateAnchorIDs
        self.headingHierarchy = headingHierarchy
        self.textBlockCount = textBlockCount
        self.lists = lists
        self.tables = tables
        self.images = images
        self.links = links
        self.elementNames = elementNames
        self.classNames = classNames
        self.inlineCSSProperties = inlineCSSProperties
        self.unknownElementNames = unknownElementNames
        self.unknownClassNames = unknownClassNames
        self.unsupportedCSSProperties = unsupportedCSSProperties
        self.eligibility = eligibility
    }
}

public struct GoldenChapter: Codable, Equatable, Sendable {
    public let relativePath: String
    public let reasons: [String]

    public init(relativePath: String, reasons: [String]) {
        self.relativePath = relativePath
        self.reasons = reasons
    }
}

public struct CorpusInventorySummary: Codable, Equatable, Sendable {
    public let chapterCount: Int
    public let packageCount: Int
    public let codeFamilyCount: Int
    public let parserFailureCount: Int
    public let textOnlyChapterCount: Int
    public let chapterCountWithTables: Int
    public let chapterCountWithImages: Int
    public let tableCount: Int
    public let imageCount: Int
    public let missingAssetCount: Int
    public let stableAnchorCount: Int
    public let eligibilityCounts: [String: Int]

    public init(
        chapterCount: Int,
        packageCount: Int,
        codeFamilyCount: Int,
        parserFailureCount: Int,
        textOnlyChapterCount: Int,
        chapterCountWithTables: Int,
        chapterCountWithImages: Int,
        tableCount: Int,
        imageCount: Int,
        missingAssetCount: Int,
        stableAnchorCount: Int,
        eligibilityCounts: [String: Int]
    ) {
        self.chapterCount = chapterCount
        self.packageCount = packageCount
        self.codeFamilyCount = codeFamilyCount
        self.parserFailureCount = parserFailureCount
        self.textOnlyChapterCount = textOnlyChapterCount
        self.chapterCountWithTables = chapterCountWithTables
        self.chapterCountWithImages = chapterCountWithImages
        self.tableCount = tableCount
        self.imageCount = imageCount
        self.missingAssetCount = missingAssetCount
        self.stableAnchorCount = stableAnchorCount
        self.eligibilityCounts = eligibilityCounts
    }
}

public struct CorpusVocabulary: Codable, Equatable, Sendable {
    public let elementCounts: [String: Int]
    public let classCounts: [String: Int]
    public let inlineCSSPropertyCounts: [String: Int]
    public let unknownElementCounts: [String: Int]
    public let unknownClassCounts: [String: Int]
    public let unsupportedCSSPropertyCounts: [String: Int]

    public init(
        elementCounts: [String: Int],
        classCounts: [String: Int],
        inlineCSSPropertyCounts: [String: Int],
        unknownElementCounts: [String: Int],
        unknownClassCounts: [String: Int],
        unsupportedCSSPropertyCounts: [String: Int]
    ) {
        self.elementCounts = elementCounts
        self.classCounts = classCounts
        self.inlineCSSPropertyCounts = inlineCSSPropertyCounts
        self.unknownElementCounts = unknownElementCounts
        self.unknownClassCounts = unknownClassCounts
        self.unsupportedCSSPropertyCounts = unsupportedCSSPropertyCounts
    }
}

public struct CorpusInventoryReport: Codable, Equatable, Sendable {
    public let schemaVersion: Int
    public let parserSchemaVersion: String
    public let parserEngine: String
    public let sourceRoot: String
    public let corpusSHA256: String
    public let summary: CorpusInventorySummary
    public let vocabulary: CorpusVocabulary
    public let goldenChapterSet: [GoldenChapter]
    public let chapters: [ChapterInventory]

    public init(
        schemaVersion: Int,
        parserSchemaVersion: String,
        parserEngine: String,
        sourceRoot: String,
        corpusSHA256: String,
        summary: CorpusInventorySummary,
        vocabulary: CorpusVocabulary,
        goldenChapterSet: [GoldenChapter],
        chapters: [ChapterInventory]
    ) {
        self.schemaVersion = schemaVersion
        self.parserSchemaVersion = parserSchemaVersion
        self.parserEngine = parserEngine
        self.sourceRoot = sourceRoot
        self.corpusSHA256 = corpusSHA256
        self.summary = summary
        self.vocabulary = vocabulary
        self.goldenChapterSet = goldenChapterSet
        self.chapters = chapters
    }
}

public struct ChapterEligibilityRecord: Codable, Equatable, Sendable {
    public let relativePath: String
    public let sourceSHA256: String
    public let state: NativeReaderEligibilityState
    public let reasons: [String]

    public init(relativePath: String, sourceSHA256: String, state: NativeReaderEligibilityState, reasons: [String]) {
        self.relativePath = relativePath
        self.sourceSHA256 = sourceSHA256
        self.state = state
        self.reasons = reasons
    }
}

public struct NativeReaderEligibilityManifest: Codable, Equatable, Sendable {
    public let schemaVersion: Int
    public let parserSchemaVersion: String
    public let corpusSHA256: String
    public let chapters: [ChapterEligibilityRecord]

    public init(report: CorpusInventoryReport) {
        schemaVersion = report.schemaVersion
        parserSchemaVersion = report.parserSchemaVersion
        corpusSHA256 = report.corpusSHA256
        chapters = report.chapters.map {
            ChapterEligibilityRecord(
                relativePath: $0.relativePath,
                sourceSHA256: $0.sourceSHA256,
                state: $0.eligibility.state,
                reasons: $0.eligibility.reasons
            )
        }
    }
}
