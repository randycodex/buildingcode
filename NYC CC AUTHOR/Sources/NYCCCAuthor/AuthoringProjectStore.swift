import Foundation

struct EditorAuthoringProject: Codable {
    var schemaVersion: Int = 5
    var nextCodeID: Int64 = 1
    var nextJurisdictionID: Int64 = 1
    var nextCodeSectionID: Int64 = 1
    var nextChapterID: Int64 = 1
    var nextSectionID: Int64 = 1
    var lastStructuredImportPath: String?
    var lastStructuredImportPaths: [String] = []
    var lastTableManifestPath: String?
    var jurisdictions: [EditorAuthoredJurisdiction] = []
    var codes: [EditorAuthoredCode] = []
    var codeSections: [EditorAuthoredCodeSection] = []
    var chapters: [EditorAuthoredChapter] = []
    var tableManifest: EditorTableManifest?
    var tables: [EditorAuthoredTable] = []

    private enum CodingKeys: String, CodingKey {
        case schemaVersion
        case nextCodeID
        case nextJurisdictionID
        case nextCodeSectionID
        case nextChapterID
        case nextSectionID
        case lastStructuredImportPath
        case lastStructuredImportPaths
        case lastTableManifestPath
        case jurisdictions
        case codes
        case codeSections
        case chapters
        case tableManifest
        case tables
    }

    init() {}

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        schemaVersion = try container.decodeIfPresent(Int.self, forKey: .schemaVersion) ?? 1
        nextCodeID = try container.decodeIfPresent(Int64.self, forKey: .nextCodeID) ?? 1
        nextJurisdictionID = try container.decodeIfPresent(Int64.self, forKey: .nextJurisdictionID) ?? 1
        nextCodeSectionID = try container.decodeIfPresent(Int64.self, forKey: .nextCodeSectionID) ?? 1
        nextChapterID = try container.decodeIfPresent(Int64.self, forKey: .nextChapterID) ?? 1
        nextSectionID = try container.decodeIfPresent(Int64.self, forKey: .nextSectionID) ?? 1
        lastStructuredImportPath = try container.decodeIfPresent(String.self, forKey: .lastStructuredImportPath)
        lastStructuredImportPaths = try container.decodeIfPresent([String].self, forKey: .lastStructuredImportPaths) ?? []
        lastTableManifestPath = try container.decodeIfPresent(String.self, forKey: .lastTableManifestPath)
        jurisdictions = try container.decodeIfPresent([EditorAuthoredJurisdiction].self, forKey: .jurisdictions) ?? []
        codes = try container.decodeIfPresent([EditorAuthoredCode].self, forKey: .codes) ?? []
        codeSections = try container.decodeIfPresent([EditorAuthoredCodeSection].self, forKey: .codeSections) ?? []
        chapters = try container.decodeIfPresent([EditorAuthoredChapter].self, forKey: .chapters) ?? []
        tableManifest = try container.decodeIfPresent(EditorTableManifest.self, forKey: .tableManifest)
        tables = try container.decodeIfPresent([EditorAuthoredTable].self, forKey: .tables) ?? []
    }
}

enum EditorAuthoredSectionKind: String, Codable, Hashable {
    case title
    case textBlock
}

struct EditorAuthoredCode: Codable, Identifiable, Hashable {
    let id: Int64
    var jurisdictionID: Int64?
    var name: String

    private enum CodingKeys: String, CodingKey {
        case id
        case jurisdictionID
        case name
    }

    init(id: Int64, jurisdictionID: Int64? = nil, name: String) {
        self.id = id
        self.jurisdictionID = jurisdictionID
        self.name = name
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int64.self, forKey: .id)
        jurisdictionID = try container.decodeIfPresent(Int64.self, forKey: .jurisdictionID)
        name = try container.decode(String.self, forKey: .name)
    }
}

struct EditorAuthoredJurisdiction: Codable, Identifiable, Hashable {
    let id: Int64
    var name: String
}

struct EditorAuthoredCodeSection: Codable, Identifiable, Hashable {
    let id: Int64
    var codeID: Int64
    var name: String
}

struct EditorAuthoredChapter: Codable, Identifiable, Hashable {
    let id: Int64
    var codeID: Int64
    var codeSectionID: Int64
    var chapterNumber: String
    var title: String
    var rawDraftText: String = ""
    var groups: [EditorAuthoredSectionGroup] = []

    private enum CodingKeys: String, CodingKey {
        case id
        case codeID
        case codeSectionID
        case chapterNumber
        case title
        case rawDraftText
        case groups
    }

    init(id: Int64, codeID: Int64, codeSectionID: Int64, chapterNumber: String, title: String, rawDraftText: String = "", groups: [EditorAuthoredSectionGroup] = []) {
        self.id = id
        self.codeID = codeID
        self.codeSectionID = codeSectionID
        self.chapterNumber = chapterNumber
        self.title = title
        self.rawDraftText = rawDraftText
        self.groups = groups
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int64.self, forKey: .id)
        codeID = try container.decodeIfPresent(Int64.self, forKey: .codeID) ?? 0
        codeSectionID = try container.decodeIfPresent(Int64.self, forKey: .codeSectionID) ?? 0
        chapterNumber = try container.decode(String.self, forKey: .chapterNumber)
        title = try container.decode(String.self, forKey: .title)
        rawDraftText = try container.decodeIfPresent(String.self, forKey: .rawDraftText) ?? ""
        groups = try container.decodeIfPresent([EditorAuthoredSectionGroup].self, forKey: .groups) ?? []
    }
}

struct EditorAuthoredSectionGroup: Codable, Identifiable, Hashable {
    var id: String
    var headerLine: String
    var headingLine: String?
    var headerRTFData: Data?
    var headingRTFData: Data?
    var sections: [EditorAuthoredSection] = []
}

struct EditorAuthoredSection: Codable, Identifiable, Hashable {
    let id: Int64
    var sectionNumber: String
    var title: String
    var officialText: String
    var richTextOverrideData: Data?
    var kind: EditorAuthoredSectionKind = .title

    private enum CodingKeys: String, CodingKey {
        case id
        case sectionNumber
        case title
        case officialText
        case richTextOverrideData
        case kind
    }

    init(
        id: Int64,
        sectionNumber: String,
        title: String,
        officialText: String,
        richTextOverrideData: Data? = nil,
        kind: EditorAuthoredSectionKind = .title
    ) {
        self.id = id
        self.sectionNumber = sectionNumber
        self.title = title
        self.officialText = officialText
        self.richTextOverrideData = richTextOverrideData
        self.kind = kind
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(Int64.self, forKey: .id)
        sectionNumber = try container.decode(String.self, forKey: .sectionNumber)
        title = try container.decode(String.self, forKey: .title)
        officialText = try container.decode(String.self, forKey: .officialText)
        richTextOverrideData = try container.decodeIfPresent(Data.self, forKey: .richTextOverrideData)
        kind = try container.decodeIfPresent(EditorAuthoredSectionKind.self, forKey: .kind) ?? .title
    }
}

struct EditorTableManifest: Codable, Hashable {
    struct Table: Codable, Hashable, Identifiable {
        var id: String
        var sheet: String
        var range: String
        var caption: String?
    }

    var workbook: String
    var tables: [Table]
}

struct EditorAuthoredTable: Codable, Hashable, Identifiable {
    struct Row: Codable, Hashable {
        var cells: [Cell]
    }

    struct Cell: Codable, Hashable {
        var text: String
        var columnSpan: Int
        var rowSpan: Int
        var isPlaceholder: Bool
    }

    var id: String
    var caption: String?
    var sheet: String
    var range: String
    var rows: [Row]
}

final class EditorAuthoringStore {
    private let fileManager = FileManager.default
    private let encoder: JSONEncoder
    private let decoder = JSONDecoder()
    private let storeURL: URL
    private let legacyStoreURL: URL

    init(storeURL: URL = EditorAuthoringStore.defaultStoreURL()) {
        self.storeURL = storeURL
        self.legacyStoreURL = EditorAuthoringStore.legacyStoreURL()
        self.encoder = JSONEncoder()
        self.encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    }

    func load() throws -> EditorAuthoringProject {
        if fileManager.fileExists(atPath: storeURL.path) {
            let data = try Data(contentsOf: storeURL)
            return try decoder.decode(EditorAuthoringProject.self, from: data)
        }

        if fileManager.fileExists(atPath: legacyStoreURL.path) {
            let data = try Data(contentsOf: legacyStoreURL)
            try fileManager.createDirectory(at: storeURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: storeURL, options: .atomic)
            return try decoder.decode(EditorAuthoringProject.self, from: data)
        }

        if let bundledSeedURL = Bundle.main.url(forResource: "nyc_code_editor_authoring_seed", withExtension: "json"),
           fileManager.fileExists(atPath: bundledSeedURL.path) {
            let data = try Data(contentsOf: bundledSeedURL)
            try fileManager.createDirectory(at: storeURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: storeURL, options: .atomic)
            return try decoder.decode(EditorAuthoringProject.self, from: data)
        }

        return EditorAuthoringProject()
    }

    func save(_ project: EditorAuthoringProject) throws {
        let data = try encoder.encode(project)
        try fileManager.createDirectory(at: storeURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: storeURL, options: .atomic)
    }

    func exportForAppBundle(_ project: EditorAuthoringProject) throws {
        let data = try encoder.encode(project)
        let exportURL = Self.appBundleExportURL()
        try fileManager.createDirectory(at: exportURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: exportURL, options: .atomic)

        let legacyExportURL = Self.legacyAppBundleExportURL()
        if fileManager.fileExists(atPath: legacyExportURL.deletingLastPathComponent().path) {
            try data.write(to: legacyExportURL, options: .atomic)
        }
    }

    func fileURL() -> URL {
        storeURL
    }

    private static func defaultStoreURL() -> URL {
        applicationSupportDirectory().appendingPathComponent(".nyc_code_editor_authoring.json")
    }

    private static func appBundleExportURL() -> URL {
        applicationSupportDirectory()
            .appendingPathComponent("Exports")
            .appendingPathComponent("nyc_code_authored.json")
    }

    private static func applicationSupportDirectory() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Application Support")
        return base.appendingPathComponent("NYCCCEditor", isDirectory: true)
    }

    private static func legacyStoreURL() -> URL {
        let sourceURL = URL(fileURLWithPath: #filePath)
        let packageRoot = sourceURL
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        return packageRoot.appendingPathComponent(".nyc_code_editor_authoring.json")
    }

    private static func legacyAppBundleExportURL() -> URL {
        let sourceURL = URL(fileURLWithPath: #filePath)
        let packageRoot = sourceURL
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let workspaceRoot = packageRoot.deletingLastPathComponent()
        return workspaceRoot
            .appendingPathComponent("NYCCode/NYCCode/Resources")
            .appendingPathComponent("nyc_code_authored.json")
    }

}
