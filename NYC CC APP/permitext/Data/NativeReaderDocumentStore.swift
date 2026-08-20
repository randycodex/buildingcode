import CryptoKit
import Foundation
import ImageIO
import os.signpost

enum NativeReaderRuntimeBlockKind: String, Decodable, Sendable {
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

    var isTextOnly: Bool {
        switch self {
        case .heading, .paragraph, .orderedList, .unorderedList, .caption, .footnote,
             .divider, .sourceNote, .editorNote:
            return true
        case .table, .image, .figure, .unsupportedHTML:
            return false
        }
    }
}

enum NativeReaderRuntimeTextStyle: String, Decodable, Sendable {
    case bold
    case italic
    case underline
    case strikethrough
    case superscript
    case `subscript`
    case code
    case small
}

struct NativeReaderRuntimeTextRun: Decodable, Equatable, Sendable {
    let text: String
    let styles: [NativeReaderRuntimeTextStyle]
    let linkTarget: String?
}

struct NativeReaderRuntimeListItem: Decodable, Equatable, Identifiable, Sendable {
    let id: String
    let depth: Int
    let ordinal: Int?
    let plainText: String
    let runs: [NativeReaderRuntimeTextRun]
    let children: [NativeReaderRuntimeListItem]
}

enum NativeReaderRuntimeTableRenderingClassification: String, Decodable, Sendable {
    case nativeSimple
    case isolatedHTML
}

struct NativeReaderRuntimeTableCell: Decodable, Equatable, Identifiable, Sendable {
    let row: Int
    let column: Int
    let rowSpan: Int
    let columnSpan: Int
    let isHeader: Bool
    let plainText: String
    let runs: [NativeReaderRuntimeTextRun]
    let anchorIDs: [String]
    let linkTargets: [String]
    let classNames: [String]
    let inlineStyle: String?
    let borderSignatures: [String]

    var id: String { "\(row)-\(column)" }
}

struct NativeReaderRuntimeTable: Decodable, Equatable, Identifiable, Sendable {
    let id: String
    let rowCount: Int
    let columnCount: Int
    let cells: [NativeReaderRuntimeTableCell]
    let caption: String?
    let footnotes: [String]
    let renderingClassification: NativeReaderRuntimeTableRenderingClassification
    let classificationReasons: [String]
    let structureSHA256: String
    let sourceHTML: String?
}

struct NativeReaderRuntimeMedia: Decodable, Equatable, Identifiable, Sendable {
    let id: String
    let element: String
    let source: String?
    let resolvedAssetPath: String?
    let assetExists: Bool
    let assetSHA256: String?
    let width: String?
    let height: String?
    let caption: String?
    let accessibilityText: String?
    let sourceHTML: String?

    var authoredAspectRatio: CGFloat? {
        guard let width,
              let height,
              let widthValue = Double(width),
              let heightValue = Double(height),
              widthValue > 0,
              heightValue > 0
        else {
            return nil
        }
        return CGFloat(widthValue / heightValue)
    }
}

struct NativeReaderRuntimeBlock: Decodable, Equatable, Identifiable, Sendable {
    let id: String
    let kind: NativeReaderRuntimeBlockKind
    let sourceOrder: Int
    let sectionID: String?
    let anchorIDs: [String]
    let plainText: String
    let runs: [NativeReaderRuntimeTextRun]
    let headingLevel: Int?
    let listItems: [NativeReaderRuntimeListItem]
    let table: NativeReaderRuntimeTable?
    let media: [NativeReaderRuntimeMedia]
    let caption: String?

    init(
        id: String,
        kind: NativeReaderRuntimeBlockKind,
        sourceOrder: Int,
        sectionID: String?,
        anchorIDs: [String],
        plainText: String,
        runs: [NativeReaderRuntimeTextRun],
        headingLevel: Int?,
        listItems: [NativeReaderRuntimeListItem],
        table: NativeReaderRuntimeTable? = nil,
        media: [NativeReaderRuntimeMedia] = [],
        caption: String? = nil
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
    }
}

struct NativeReaderRuntimeAnchor: Decodable, Equatable, Identifiable, Sendable {
    let id: String
    let sourceOrder: Int
    let blockID: String?
    let sectionID: String?
}

struct NativeReaderRuntimeEligibility: Decodable, Equatable, Sendable {
    enum State: String, Decodable, Sendable {
        case native
        case nativeWithTableFallback
        case fullHTMLFallback
        case invalidContent
    }

    let state: State
    let reasons: [String]
}

enum NativeReaderRolloutTier: String, Decodable, CaseIterable, Sendable {
    case textOnly
    case media
    case nativeTable
    case isolatedTableFallback
}

enum NativeReaderRolloutStage: Int, CaseIterable, Sendable {
    case disabled
    case textOnly
    case media
    case nativeTable
    case isolatedTableFallback

    var featureFlagValue: String {
        switch self {
        case .disabled: "off"
        case .textOnly: "text-only"
        case .media: "media"
        case .nativeTable: "native-tables"
        case .isolatedTableFallback: "isolated-table-fallback"
        }
    }

    init?(featureFlagValue: String) {
        guard let stage = Self.allCases.first(where: {
            $0.featureFlagValue == featureFlagValue.lowercased()
        }) else { return nil }
        self = stage
    }

    func includes(_ tier: NativeReaderRolloutTier) -> Bool {
        switch tier {
        case .textOnly:
            return rawValue >= Self.textOnly.rawValue
        case .media:
            return rawValue >= Self.media.rawValue
        case .nativeTable:
            return rawValue >= Self.nativeTable.rawValue
        case .isolatedTableFallback:
            return rawValue >= Self.isolatedTableFallback.rawValue
        }
    }
}

enum NativeReaderRolloutPolicy {
    static let stageArgument = "--native-reader-rollout-stage"
    static let infoPlistKey = "PermitextNativeReaderRolloutStage"

    static var activeStage: NativeReaderRolloutStage {
        resolvedStage(
            arguments: ProcessInfo.processInfo.arguments,
            bundledValue: Bundle.main.object(forInfoDictionaryKey: infoPlistKey) as? String
        )
    }

    static func resolvedStage(
        arguments: [String],
        bundledValue: String? = nil
    ) -> NativeReaderRolloutStage {
        if let index = arguments.firstIndex(of: stageArgument) {
            guard arguments.indices.contains(index + 1),
                  let requestedStage = NativeReaderRolloutStage(
                      featureFlagValue: arguments[index + 1]
                  ) else {
                return .disabled
            }
            return requestedStage
        }
        if let bundledValue, !bundledValue.isEmpty {
            return NativeReaderRolloutStage(featureFlagValue: bundledValue) ?? .disabled
        }
#if DEBUG
        return .isolatedTableFallback
#else
        return .disabled
#endif
    }
}

struct NativeReaderRuntimeValidation: Decodable, Equatable, Sendable {
    let normalizedTextMatches: Bool
    let anchorSequenceMatches: Bool
    let linkTargetsMatch: Bool
    let tableStructuresMatch: Bool
    let imageInventoryMatches: Bool
    let unsupportedBlockCount: Int
    let messages: [String]

    var passesStructuralValidation: Bool {
        normalizedTextMatches
            && anchorSequenceMatches
            && linkTargetsMatch
            && tableStructuresMatch
            && imageInventoryMatches
    }
}

struct NativeReaderRuntimeChapterMetadata: Decodable, Equatable, Sendable {
    let codeVersion: String
    let codeSectionID: Int64?
    let codeSectionName: String?
    let chapterID: Int64?
    let chapterIdentifier: String
    let chapterNumber: String?
    let chapterTitle: String?
}

struct NativeReaderRuntimeDocument: Decodable, Equatable, Sendable {
    let schemaVersion: Int
    let parserSchemaVersion: String
    let documentID: String
    let packageID: String
    let codeFamily: String
    let metadata: NativeReaderRuntimeChapterMetadata
    let sourcePath: String
    let sourceSHA256: String
    let normalizedTextSHA256: String?
    let normalizedTextCharacterCount: Int
    let eligibility: NativeReaderRuntimeEligibility
    let blocks: [NativeReaderRuntimeBlock]
    let anchors: [NativeReaderRuntimeAnchor]
    let validation: NativeReaderRuntimeValidation

    var isValidatedTextOnly: Bool {
        isValidatedNativeContent
            && blocks.allSatisfy { $0.kind.isTextOnly }
    }

    var rolloutTier: NativeReaderRolloutTier {
        let tables = blocks.compactMap(\.table)
        if tables.contains(where: { $0.renderingClassification == .isolatedHTML }) {
            return .isolatedTableFallback
        }
        if !tables.isEmpty {
            return .nativeTable
        }
        if blocks.contains(where: { !$0.media.isEmpty }) {
            return .media
        }
        return .textOnly
    }

    var isValidatedNativeContent: Bool {
        supportsPhaseFiveEligibility
            && validation.passesStructuralValidation
            && validation.unsupportedBlockCount == 0
            && blocks.allSatisfy { block in
                switch block.kind {
                case .table:
                    return block.table != nil
                case .unsupportedHTML:
                    return false
                case .image, .figure:
                    return !block.media.isEmpty
                default:
                    return true
                }
            }
    }

    private var supportsPhaseFiveEligibility: Bool {
        switch eligibility.state {
        case .native:
            return eligibility.reasons.isEmpty
        case .nativeWithTableFallback:
            return !eligibility.reasons.isEmpty
                && eligibility.reasons.allSatisfy { $0.hasPrefix("isolatedHTMLTableCount: ") }
                && blocks.contains {
                    $0.table?.renderingClassification == .isolatedHTML
                }
        case .fullHTMLFallback, .invalidContent:
            return false
        }
    }
}

struct NativeReaderDocumentRoute: Hashable, Sendable {
    let relativeSourcePath: String
    let sourceURL: URL
    let documentURL: URL
    let sourceSHA256: String
    let documentID: String
    let documentSHA256: String
    let compressedSHA256: String
    let uncompressedByteCount: Int
    let compressedByteCount: Int

    var id: String { documentID }

    var corpusRootURL: URL? {
        let components = relativeSourcePath.split(separator: "/")
        guard !components.isEmpty,
              !relativeSourcePath.hasPrefix("/"),
              !components.contains("..")
        else {
            return nil
        }
        var rootURL = sourceURL.standardizedFileURL
        for _ in components {
            rootURL.deleteLastPathComponent()
        }
        let rebuiltURL = components.reduce(rootURL) { partial, component in
            partial.appendingPathComponent(String(component), isDirectory: false)
        }
        guard rebuiltURL.standardizedFileURL == sourceURL.standardizedFileURL else {
            return nil
        }
        return rootURL.standardizedFileURL
    }
}

struct NativeReaderPreparedDocument: Equatable, Sendable {
    let document: NativeReaderRuntimeDocument
    let displayBlocks: [NativeReaderDisplayBlock]
    let sectionTargets: [NativeReaderSectionTarget]
    let estimatedMemoryCost: Int
}

struct NativeReaderDocumentStoreMetrics: Equatable, Sendable {
    let requestCount: Int
    let cacheHitCount: Int
    let diskLoadCount: Int
    let cancellationCount: Int
    let evictionCount: Int
    let memoryWarningCount: Int
    let cachedDocumentCount: Int
    let cachedMemoryCost: Int
}

enum NativeReaderDocumentStoreError: LocalizedError, Equatable {
    case indexUnavailable
    case invalidIndex(String)
    case documentUnavailable(String)
    case byteCountMismatch(String)
    case hashMismatch(String)
    case decompressionFailed(String)
    case decodingFailed(String)
    case documentContractMismatch(String)
    case sourceMismatch(String)
    case unsupportedContent(String)
    case mediaValidationFailed(String)
    case tableValidationFailed(String)

    var errorDescription: String? {
        switch self {
        case .indexUnavailable:
            return "The bundled native-reader index is unavailable."
        case .invalidIndex(let reason):
            return "The bundled native-reader index is invalid: \(reason)."
        case .documentUnavailable(let path):
            return "The generated native document is unavailable: \(path)."
        case .byteCountMismatch(let path):
            return "The generated native document has an unexpected size: \(path)."
        case .hashMismatch(let path):
            return "The generated native document failed its integrity check: \(path)."
        case .decompressionFailed(let path):
            return "The generated native document could not be decompressed: \(path)."
        case .decodingFailed(let path):
            return "The generated native document could not be decoded: \(path)."
        case .documentContractMismatch(let reason):
            return "The generated native document failed its schema contract: \(reason)."
        case .sourceMismatch(let path):
            return "The authoritative HTML source failed its integrity check: \(path)."
        case .unsupportedContent(let path):
            return "The chapter is outside the validated native Reader phases: \(path)."
        case .mediaValidationFailed(let reason):
            return "The chapter's native media failed validation: \(reason)."
        case .tableValidationFailed(let reason):
            return "The chapter's native table failed validation: \(reason)."
        }
    }
}

final class NativeReaderDocumentStore: @unchecked Sendable {
    static let shared = NativeReaderDocumentStore()

    static let supportedIndexSchemaVersion = 2
    static let supportedDocumentSchemaVersion = 1
    static let supportedParserSchemaVersion = "native-reader-document-v2"

    #if DEBUG
    static let debugPilotSourcePaths: Set<String> = [
        "2022-construction-codes/code-sections/building-code/chapters/1.html",
        "2022-construction-codes/code-sections/building-code/chapters/30.html",
        "2022-construction-codes/code-sections/building-code/chapters/M.html",
        "2022-construction-codes/code-sections/building-code/chapters/R.html",
        "2022-construction-codes/code-sections/building-code/chapters/S.html",
        "2026-enacted-administrative-code/chapters/30000095.html",
        "2026-existing-building-code/chapters/1.html",
        "2026-zoning-resolution/chapters/APP-D-21241.html"
    ]
    #endif

    private struct Index: Decodable, Sendable {
        let schemaVersion: Int
        let documentSchemaVersion: Int
        let parserSchemaVersion: String
        let compression: String
        let entries: [IndexEntry]
    }

    private struct IndexEntry: Decodable, Sendable {
        let relativePath: String
        let sourceSHA256: String
        let documentID: String
        let documentPath: String
        let documentSHA256: String
        let compressedSHA256: String
        let uncompressedByteCount: Int
        let compressedByteCount: Int
        let rolloutTier: NativeReaderRolloutTier
        let eligibility: NativeReaderRuntimeEligibility
        let passesStructuralValidation: Bool
    }

    private struct PreparedCacheEntry {
        let preparedDocument: NativeReaderPreparedDocument
        var accessOrder: UInt64
    }

    private struct MutableMetrics {
        var requestCount = 0
        var cacheHitCount = 0
        var diskLoadCount = 0
        var cancellationCount = 0
        var evictionCount = 0
        var memoryWarningCount = 0
    }

    static let preparedDocumentCountLimit = 4
    static let preparedDocumentCostLimit = 48 * 1024 * 1024

    private let corpusRootURL: URL?
    private let indexTask: Task<Result<Index, NativeReaderDocumentStoreError>, Never>
    private let stateLock = NSLock()
    private var preparedDocuments: [String: PreparedCacheEntry] = [:]
    private var preparedDocumentMemoryCost = 0
    private var nextAccessOrder: UInt64 = 0
    private var mutableMetrics = MutableMetrics()

    convenience init(resourceURL: URL? = Bundle.main.resourceURL) {
        let corpusRootURL = resourceURL?
            .appendingPathComponent("CodeContent", isDirectory: true)
            .appendingPathComponent("authored", isDirectory: true)
            .appendingPathComponent("new-york-city", isDirectory: true)
        self.init(corpusRootURL: corpusRootURL)
    }

    init(corpusRootURL: URL?) {
        let standardizedRootURL = corpusRootURL?.standardizedFileURL
        self.corpusRootURL = standardizedRootURL
        indexTask = Task.detached(priority: .utility) {
            Self.loadIndex(corpusRootURL: standardizedRootURL)
        }
    }

    func debugRoute(for chapterURL: URL) async -> NativeReaderDocumentRoute? {
        #if DEBUG
        guard let corpusRootURL,
              let relativePath = Self.relativePath(for: chapterURL, below: corpusRootURL),
              Self.debugPilotSourcePaths.contains(relativePath)
        else {
            return nil
        }
        return await debugValidatedRoute(forRelativeSourcePath: relativePath)
        #else
        _ = chapterURL
        return nil
        #endif
    }

    func debugValidatedRoute(forRelativeSourcePath relativePath: String) async -> NativeReaderDocumentRoute? {
        #if DEBUG
        return await validatedRoute(
            forRelativeSourcePath: relativePath,
            rolloutStage: nil
        )
        #else
        _ = relativePath
        return nil
        #endif
    }

    func rolloutRoute(
        for chapterURL: URL,
        stage: NativeReaderRolloutStage = NativeReaderRolloutPolicy.activeStage
    ) async -> NativeReaderDocumentRoute? {
        guard stage != .disabled,
              let corpusRootURL,
              let relativePath = Self.relativePath(for: chapterURL, below: corpusRootURL)
        else { return nil }
        return await validatedRoute(
            forRelativeSourcePath: relativePath,
            rolloutStage: stage
        )
    }

    func debugValidatedSourcePaths() async -> [String] {
        #if DEBUG
        guard case .success(let index) = await indexTask.value else { return [] }
        return index.entries.compactMap { entry in
            guard Self.supportsValidatedEligibility(entry.eligibility),
                  entry.passesStructuralValidation
            else { return nil }
            return entry.relativePath
        }.sorted()
        #else
        return []
        #endif
    }

    func debugRolloutSourcePaths(for stage: NativeReaderRolloutStage) async -> [String] {
        #if DEBUG
        guard stage != .disabled,
              case .success(let index) = await indexTask.value else { return [] }
        return index.entries.compactMap { entry in
            guard Self.supportsValidatedEligibility(entry.eligibility),
                  entry.passesStructuralValidation,
                  stage.includes(entry.rolloutTier)
            else { return nil }
            return entry.relativePath
        }.sorted()
        #else
        _ = stage
        return []
        #endif
    }

    func debugRolloutTier(forRelativeSourcePath relativePath: String) async -> NativeReaderRolloutTier? {
        #if DEBUG
        guard case .success(let index) = await indexTask.value else { return nil }
        return index.entries.first(where: { $0.relativePath == relativePath })?.rolloutTier
        #else
        _ = relativePath
        return nil
        #endif
    }

    private func validatedRoute(
        forRelativeSourcePath relativePath: String,
        rolloutStage: NativeReaderRolloutStage?
    ) async -> NativeReaderDocumentRoute? {
        guard let corpusRootURL,
              !relativePath.hasPrefix("/"),
              !relativePath.split(separator: "/").contains(".."),
              case .success(let index) = await indexTask.value,
              let entry = index.entries.first(where: { $0.relativePath == relativePath }),
              Self.supportsValidatedEligibility(entry.eligibility),
              entry.passesStructuralValidation,
              rolloutStage.map({ $0.includes(entry.rolloutTier) }) ?? true,
              let documentURL = Self.resolvedDocumentURL(
                  relativePath: entry.documentPath,
                  corpusRootURL: corpusRootURL
              )
        else {
            return nil
        }

        return NativeReaderDocumentRoute(
            relativeSourcePath: relativePath,
            sourceURL: corpusRootURL.appendingPathComponent(relativePath).standardizedFileURL,
            documentURL: documentURL,
            sourceSHA256: entry.sourceSHA256,
            documentID: entry.documentID,
            documentSHA256: entry.documentSHA256,
            compressedSHA256: entry.compressedSHA256,
            uncompressedByteCount: entry.uncompressedByteCount,
            compressedByteCount: entry.compressedByteCount
        )
    }

    func loadDocument(for route: NativeReaderDocumentRoute) async throws -> NativeReaderRuntimeDocument {
        try await loadPreparedDocument(for: route).document
    }

    func loadPreparedDocument(for route: NativeReaderDocumentRoute) async throws -> NativeReaderPreparedDocument {
        if let cached = cachedPreparedDocument(for: route.documentID) {
            return cached
        }

        let signpostID = OSSignpostID(log: AppSignpost.reader)
        os_signpost(
            .begin,
            log: AppSignpost.reader,
            name: "nativeDocumentPrepare",
            signpostID: signpostID,
            "%{public}@",
            route.relativeSourcePath
        )
        let work = Task.detached(priority: .userInitiated) {
            let document = try Self.loadDocumentSynchronously(for: route)
            try Task.checkCancellation()
            let displayBlocks = NativeReaderDisplayBlock.blocks(from: document.blocks)
            try Task.checkCancellation()
            let sectionTargets = NativeReaderSectionNavigator.targets(
                in: document,
                displayBlocks: displayBlocks
            )
            let derivedCost = displayBlocks.reduce(0) { partial, block in
                partial
                    + block.id.utf8.count
                    + block.sourceBlockID.utf8.count
                    + block.block.plainText.utf8.count
                    + 128
            }
            return NativeReaderPreparedDocument(
                document: document,
                displayBlocks: displayBlocks,
                sectionTargets: sectionTargets,
                estimatedMemoryCost: max(route.uncompressedByteCount + derivedCost, 1)
            )
        }

        do {
            let prepared = try await withTaskCancellationHandler {
                try await work.value
            } onCancel: {
                work.cancel()
            }
            try Task.checkCancellation()
            storePreparedDocument(prepared, for: route.documentID)
            recordDiskLoad()
            os_signpost(
                .end,
                log: AppSignpost.reader,
                name: "nativeDocumentPrepare",
                signpostID: signpostID,
                "blocks=%{public}d cost=%{public}d",
                prepared.displayBlocks.count,
                prepared.estimatedMemoryCost
            )
            return prepared
        } catch {
            if error is CancellationError || Task.isCancelled {
                recordCancellation()
            }
            os_signpost(
                .end,
                log: AppSignpost.reader,
                name: "nativeDocumentPrepare",
                signpostID: signpostID,
                "failed"
            )
            throw error
        }
    }

    func handleMemoryWarning() {
        stateLock.lock()
        mutableMetrics.memoryWarningCount += 1
        preparedDocuments.removeAll(keepingCapacity: true)
        preparedDocumentMemoryCost = 0
        stateLock.unlock()
    }

    func metrics() -> NativeReaderDocumentStoreMetrics {
        stateLock.lock()
        defer { stateLock.unlock() }
        return NativeReaderDocumentStoreMetrics(
            requestCount: mutableMetrics.requestCount,
            cacheHitCount: mutableMetrics.cacheHitCount,
            diskLoadCount: mutableMetrics.diskLoadCount,
            cancellationCount: mutableMetrics.cancellationCount,
            evictionCount: mutableMetrics.evictionCount,
            memoryWarningCount: mutableMetrics.memoryWarningCount,
            cachedDocumentCount: preparedDocuments.count,
            cachedMemoryCost: preparedDocumentMemoryCost
        )
    }

    func resetPreparedDocumentsForTesting() {
        stateLock.lock()
        preparedDocuments.removeAll(keepingCapacity: false)
        preparedDocumentMemoryCost = 0
        nextAccessOrder = 0
        mutableMetrics = MutableMetrics()
        stateLock.unlock()
    }

    private static func loadIndex(corpusRootURL: URL?) -> Result<Index, NativeReaderDocumentStoreError> {
        guard let corpusRootURL else { return .failure(.indexUnavailable) }
        let indexURL = corpusRootURL.appendingPathComponent("native-reader-index.json", isDirectory: false)
        guard let data = try? Data(contentsOf: indexURL),
              let index = try? JSONDecoder().decode(Index.self, from: data)
        else {
            return .failure(.indexUnavailable)
        }
        guard index.schemaVersion == supportedIndexSchemaVersion else {
            return .failure(.invalidIndex("unsupported index schema \(index.schemaVersion)"))
        }
        guard index.documentSchemaVersion == supportedDocumentSchemaVersion else {
            return .failure(.invalidIndex("unsupported document schema \(index.documentSchemaVersion)"))
        }
        guard index.parserSchemaVersion == supportedParserSchemaVersion else {
            return .failure(.invalidIndex("unsupported parser schema \(index.parserSchemaVersion)"))
        }
        guard index.compression == "lzfse" else {
            return .failure(.invalidIndex("unsupported compression \(index.compression)"))
        }
        return .success(index)
    }

    private static func loadDocumentSynchronously(
        for route: NativeReaderDocumentRoute
    ) throws -> NativeReaderRuntimeDocument {
        try Task.checkCancellation()
        guard let compressedData = try? Data(contentsOf: route.documentURL) else {
            throw NativeReaderDocumentStoreError.documentUnavailable(route.relativeSourcePath)
        }
        guard compressedData.count == route.compressedByteCount else {
            throw NativeReaderDocumentStoreError.byteCountMismatch(route.relativeSourcePath)
        }
        guard sha256(compressedData) == route.compressedSHA256 else {
            throw NativeReaderDocumentStoreError.hashMismatch(route.relativeSourcePath)
        }
        try Task.checkCancellation()
        guard let documentData = try? (compressedData as NSData).decompressed(using: .lzfse) as Data else {
            throw NativeReaderDocumentStoreError.decompressionFailed(route.relativeSourcePath)
        }
        guard documentData.count == route.uncompressedByteCount else {
            throw NativeReaderDocumentStoreError.byteCountMismatch(route.relativeSourcePath)
        }
        guard sha256(documentData) == route.documentSHA256 else {
            throw NativeReaderDocumentStoreError.hashMismatch(route.relativeSourcePath)
        }
        try Task.checkCancellation()

        let document: NativeReaderRuntimeDocument
        do {
            document = try JSONDecoder().decode(NativeReaderRuntimeDocument.self, from: documentData)
        } catch {
            throw NativeReaderDocumentStoreError.decodingFailed(route.relativeSourcePath)
        }

        guard document.schemaVersion == supportedDocumentSchemaVersion,
              document.parserSchemaVersion == supportedParserSchemaVersion,
              document.documentID == route.documentID,
              document.sourcePath == route.relativeSourcePath,
              document.sourceSHA256 == route.sourceSHA256
        else {
            throw NativeReaderDocumentStoreError.documentContractMismatch(route.relativeSourcePath)
        }
        guard document.isValidatedNativeContent else {
            throw NativeReaderDocumentStoreError.unsupportedContent(route.relativeSourcePath)
        }
        guard let sourceData = try? Data(contentsOf: route.sourceURL),
              sha256(sourceData) == route.sourceSHA256
        else {
            throw NativeReaderDocumentStoreError.sourceMismatch(route.relativeSourcePath)
        }
        try Task.checkCancellation()
        try validateTables(in: document, for: route)
        try Task.checkCancellation()
        try validateMedia(in: document, for: route)
        return document
    }

    private func cachedPreparedDocument(for documentID: String) -> NativeReaderPreparedDocument? {
        stateLock.lock()
        defer { stateLock.unlock() }
        mutableMetrics.requestCount += 1
        guard var entry = preparedDocuments[documentID] else { return nil }
        mutableMetrics.cacheHitCount += 1
        nextAccessOrder &+= 1
        entry.accessOrder = nextAccessOrder
        preparedDocuments[documentID] = entry
        return entry.preparedDocument
    }

    private func storePreparedDocument(_ prepared: NativeReaderPreparedDocument, for documentID: String) {
        stateLock.lock()
        defer { stateLock.unlock() }
        guard prepared.estimatedMemoryCost <= Self.preparedDocumentCostLimit else { return }

        if let previous = preparedDocuments.removeValue(forKey: documentID) {
            preparedDocumentMemoryCost -= previous.preparedDocument.estimatedMemoryCost
        }
        nextAccessOrder &+= 1
        preparedDocuments[documentID] = PreparedCacheEntry(
            preparedDocument: prepared,
            accessOrder: nextAccessOrder
        )
        preparedDocumentMemoryCost += prepared.estimatedMemoryCost

        while preparedDocuments.count > Self.preparedDocumentCountLimit
                || preparedDocumentMemoryCost > Self.preparedDocumentCostLimit {
            guard let oldest = preparedDocuments.min(by: { $0.value.accessOrder < $1.value.accessOrder }) else {
                break
            }
            preparedDocumentMemoryCost -= oldest.value.preparedDocument.estimatedMemoryCost
            preparedDocuments.removeValue(forKey: oldest.key)
            mutableMetrics.evictionCount += 1
        }
    }

    private func recordDiskLoad() {
        stateLock.lock()
        mutableMetrics.diskLoadCount += 1
        stateLock.unlock()
    }

    private func recordCancellation() {
        stateLock.lock()
        mutableMetrics.cancellationCount += 1
        stateLock.unlock()
    }

    private static func supportsValidatedEligibility(_ eligibility: NativeReaderRuntimeEligibility) -> Bool {
        switch eligibility.state {
        case .native:
            return eligibility.reasons.isEmpty
        case .nativeWithTableFallback:
            return !eligibility.reasons.isEmpty
                && eligibility.reasons.allSatisfy { $0.hasPrefix("isolatedHTMLTableCount: ") }
        case .fullHTMLFallback, .invalidContent:
            return false
        }
    }

    private static func validateTables(
        in document: NativeReaderRuntimeDocument,
        for route: NativeReaderDocumentRoute
    ) throws {
        let tables = document.blocks.compactMap(\.table)
        guard Set(tables.map(\.id)).count == tables.count else {
            throw NativeReaderDocumentStoreError.tableValidationFailed(
                "duplicate table IDs in \(route.relativeSourcePath)"
            )
        }

        for table in tables {
            try Task.checkCancellation()
            guard table.rowCount >= 0,
                  table.columnCount >= 0,
                  !table.structureSHA256.isEmpty,
                  Set(table.cells.map(\.id)).count == table.cells.count else {
                throw NativeReaderDocumentStoreError.tableValidationFailed(
                    "invalid table metadata for \(table.id)"
                )
            }

            var occupied: Set<String> = []
            for cell in table.cells {
                guard cell.row >= 0,
                      cell.column >= 0,
                      cell.rowSpan > 0,
                      cell.columnSpan > 0,
                      cell.row + cell.rowSpan <= table.rowCount,
                      cell.column + cell.columnSpan <= table.columnCount else {
                    throw NativeReaderDocumentStoreError.tableValidationFailed(
                        "out-of-range cell in \(table.id)"
                    )
                }
                for row in cell.row..<(cell.row + cell.rowSpan) {
                    for column in cell.column..<(cell.column + cell.columnSpan) {
                        guard occupied.insert("\(row)-\(column)").inserted else {
                            throw NativeReaderDocumentStoreError.tableValidationFailed(
                                "overlapping cells in \(table.id)"
                            )
                        }
                    }
                }
            }

            switch table.renderingClassification {
            case .nativeSimple:
                guard table.rowCount > 0,
                      table.columnCount > 0,
                      table.columnCount <= 6,
                      table.cells.count == table.rowCount * table.columnCount,
                      table.cells.allSatisfy({
                          $0.rowSpan == 1
                              && $0.columnSpan == 1
                              && $0.classNames.isEmpty
                              && $0.inlineStyle == nil
                              && $0.borderSignatures.isEmpty
                              && $0.linkTargets.isEmpty
                              && $0.runs.allSatisfy { $0.styles.isEmpty && $0.linkTarget == nil }
                      }),
                      table.classificationReasons.isEmpty,
                      table.sourceHTML == nil else {
                    throw NativeReaderDocumentStoreError.tableValidationFailed(
                        "unsupported native-simple structure in \(table.id)"
                    )
                }
            case .isolatedHTML:
                guard table.rowCount <= 250,
                      table.cells.count <= 2_500,
                      !table.classificationReasons.isEmpty,
                      let sourceHTML = table.sourceHTML,
                      sourceHTML.range(of: "<table", options: .caseInsensitive) != nil else {
                    throw NativeReaderDocumentStoreError.tableValidationFailed(
                        "missing isolated HTML for \(table.id)"
                    )
                }
            }
        }

        if document.eligibility.state == .nativeWithTableFallback,
           !tables.contains(where: { $0.renderingClassification == .isolatedHTML }) {
            throw NativeReaderDocumentStoreError.tableValidationFailed(
                "eligibility requires an isolated table in \(route.relativeSourcePath)"
            )
        }
    }

    static func resolvedMediaURL(
        for media: NativeReaderRuntimeMedia,
        route: NativeReaderDocumentRoute
    ) -> URL? {
        guard media.assetExists,
              let relativePath = media.resolvedAssetPath,
              let corpusRootURL = route.corpusRootURL
        else {
            return nil
        }
        return resolvedDocumentURL(relativePath: relativePath, corpusRootURL: corpusRootURL)
    }

    private static func validateMedia(
        in document: NativeReaderRuntimeDocument,
        for route: NativeReaderDocumentRoute
    ) throws {
        let media = document.blocks.flatMap(\.media)
        guard Set(media.map(\.id)).count == media.count else {
            throw NativeReaderDocumentStoreError.mediaValidationFailed("duplicate media IDs in \(route.relativeSourcePath)")
        }

        for item in media {
            try Task.checkCancellation()
            guard let assetURL = resolvedMediaURL(for: item, route: route) else {
                throw NativeReaderDocumentStoreError.mediaValidationFailed(
                    "unresolved asset \(item.id) in \(route.relativeSourcePath)"
                )
            }
            guard let data = try? Data(contentsOf: assetURL, options: [.mappedIfSafe]) else {
                throw NativeReaderDocumentStoreError.mediaValidationFailed(
                    "unreadable asset \(assetURL.lastPathComponent)"
                )
            }
            guard let expectedHash = item.assetSHA256,
                  sha256(data) == expectedHash else {
                throw NativeReaderDocumentStoreError.mediaValidationFailed(
                    "integrity mismatch for \(assetURL.lastPathComponent)"
                )
            }
            guard let imageSource = CGImageSourceCreateWithData(data as CFData, nil),
                  CGImageSourceGetCount(imageSource) > 0,
                  let properties = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil) as? [CFString: Any],
                  let pixelWidth = properties[kCGImagePropertyPixelWidth] as? NSNumber,
                  let pixelHeight = properties[kCGImagePropertyPixelHeight] as? NSNumber,
                  pixelWidth.intValue > 0,
                  pixelHeight.intValue > 0 else {
                throw NativeReaderDocumentStoreError.mediaValidationFailed(
                    "undecodable asset \(assetURL.lastPathComponent)"
                )
            }
        }
    }

    private static func relativePath(for url: URL, below rootURL: URL) -> String? {
        let rootPath = rootURL.standardizedFileURL.path
        let path = url.standardizedFileURL.path
        guard path.hasPrefix(rootPath + "/") else { return nil }
        return String(path.dropFirst(rootPath.count + 1))
    }

    private static func resolvedDocumentURL(relativePath: String, corpusRootURL: URL) -> URL? {
        guard !relativePath.hasPrefix("/"),
              !relativePath.split(separator: "/").contains("..")
        else {
            return nil
        }
        let resolvedURL = relativePath
            .split(separator: "/")
            .reduce(corpusRootURL) { partial, component in
                partial.appendingPathComponent(String(component), isDirectory: false)
            }
            .standardizedFileURL
        guard resolvedURL.path.hasPrefix(corpusRootURL.standardizedFileURL.path + "/") else { return nil }
        return resolvedURL
    }

    private static func sha256(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}
