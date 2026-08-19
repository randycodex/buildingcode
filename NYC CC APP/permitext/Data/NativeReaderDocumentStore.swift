import CryptoKit
import Foundation

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
        eligibility.state == .native
            && eligibility.reasons.isEmpty
            && validation.passesStructuralValidation
            && validation.unsupportedBlockCount == 0
            && blocks.allSatisfy { $0.kind.isTextOnly }
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
    case nonTextContent(String)

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
        case .nonTextContent(let path):
            return "The chapter is outside the text-only native pilot: \(path)."
        }
    }
}

final class NativeReaderDocumentStore: @unchecked Sendable {
    static let shared = NativeReaderDocumentStore()

    static let supportedIndexSchemaVersion = 1
    static let supportedDocumentSchemaVersion = 1
    static let supportedParserSchemaVersion = "native-reader-document-v1"

    #if DEBUG
    static let debugPilotSourcePaths: Set<String> = [
        "2022-construction-codes/code-sections/building-code/chapters/1.html",
        "2026-existing-building-code/chapters/1.html"
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
        let eligibility: NativeReaderRuntimeEligibility
        let passesStructuralValidation: Bool
    }

    private let corpusRootURL: URL?
    private let indexResult: Result<Index, NativeReaderDocumentStoreError>

    convenience init(resourceURL: URL? = Bundle.main.resourceURL) {
        let corpusRootURL = resourceURL?
            .appendingPathComponent("CodeContent", isDirectory: true)
            .appendingPathComponent("authored", isDirectory: true)
            .appendingPathComponent("new-york-city", isDirectory: true)
        self.init(corpusRootURL: corpusRootURL)
    }

    init(corpusRootURL: URL?) {
        self.corpusRootURL = corpusRootURL?.standardizedFileURL
        indexResult = Self.loadIndex(corpusRootURL: corpusRootURL)
    }

    func debugRoute(for chapterURL: URL) -> NativeReaderDocumentRoute? {
        #if DEBUG
        guard let corpusRootURL,
              let relativePath = Self.relativePath(for: chapterURL, below: corpusRootURL),
              Self.debugPilotSourcePaths.contains(relativePath),
              case .success(let index) = indexResult,
              let entry = index.entries.first(where: { $0.relativePath == relativePath }),
              entry.eligibility.state == .native,
              entry.eligibility.reasons.isEmpty,
              entry.passesStructuralValidation,
              let documentURL = Self.resolvedDocumentURL(
                  relativePath: entry.documentPath,
                  corpusRootURL: corpusRootURL
              )
        else {
            return nil
        }

        return NativeReaderDocumentRoute(
            relativeSourcePath: relativePath,
            sourceURL: chapterURL.standardizedFileURL,
            documentURL: documentURL,
            sourceSHA256: entry.sourceSHA256,
            documentID: entry.documentID,
            documentSHA256: entry.documentSHA256,
            compressedSHA256: entry.compressedSHA256,
            uncompressedByteCount: entry.uncompressedByteCount,
            compressedByteCount: entry.compressedByteCount
        )
        #else
        _ = chapterURL
        return nil
        #endif
    }

    func loadDocument(for route: NativeReaderDocumentRoute) async throws -> NativeReaderRuntimeDocument {
        try await Task.detached(priority: .userInitiated) {
            try Self.loadDocumentSynchronously(for: route)
        }.value
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
        guard let compressedData = try? Data(contentsOf: route.documentURL) else {
            throw NativeReaderDocumentStoreError.documentUnavailable(route.relativeSourcePath)
        }
        guard compressedData.count == route.compressedByteCount else {
            throw NativeReaderDocumentStoreError.byteCountMismatch(route.relativeSourcePath)
        }
        guard sha256(compressedData) == route.compressedSHA256 else {
            throw NativeReaderDocumentStoreError.hashMismatch(route.relativeSourcePath)
        }
        guard let documentData = try? (compressedData as NSData).decompressed(using: .lzfse) as Data else {
            throw NativeReaderDocumentStoreError.decompressionFailed(route.relativeSourcePath)
        }
        guard documentData.count == route.uncompressedByteCount else {
            throw NativeReaderDocumentStoreError.byteCountMismatch(route.relativeSourcePath)
        }
        guard sha256(documentData) == route.documentSHA256 else {
            throw NativeReaderDocumentStoreError.hashMismatch(route.relativeSourcePath)
        }

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
        guard document.isValidatedTextOnly else {
            throw NativeReaderDocumentStoreError.nonTextContent(route.relativeSourcePath)
        }
        guard let sourceData = try? Data(contentsOf: route.sourceURL),
              sha256(sourceData) == route.sourceSHA256
        else {
            throw NativeReaderDocumentStoreError.sourceMismatch(route.relativeSourcePath)
        }
        return document
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
