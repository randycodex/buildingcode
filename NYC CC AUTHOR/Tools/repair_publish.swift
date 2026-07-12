import Foundation

private let workspaceRootURL = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent()
    .deletingLastPathComponent()
    .deletingLastPathComponent()
private let outputURL = workspaceRootURL
    .appendingPathComponent("NYC CC APP", isDirectory: true)
    .appendingPathComponent("permitext", isDirectory: true)
    .appendingPathComponent("Resources", isDirectory: true)
    .appendingPathComponent("nyc_code_authored.json", isDirectory: false)
private let defaultHTMLDirectoryCandidates = [
    URL(
        fileURLWithPath: "/Users/randy/Documents/X_CODING/Building Code/New York City/2022 Construction Codes/Building Code"
    ),
    URL(
        fileURLWithPath: "/Users/randy/Documents/X_CODING/Building Code/2022 NYC BC/2022 Construction Codes"
    )
]

@main
struct RepairPublishTool {
    static func main() throws {
        let store = EditorAuthoringStore()
        var project = try store.load()
        let explicitPaths = Array(CommandLine.arguments.dropFirst())

        let inputPaths = explicitPaths.isEmpty
            ? (
                project.lastStructuredImportPaths.isEmpty
            ? [project.lastStructuredImportPath].compactMap { $0 }
            : project.lastStructuredImportPaths
            )
            : explicitPaths

        var documentURLs = inputPaths
            .map { URL(fileURLWithPath: $0).standardizedFileURL }
            .filter { FileManager.default.fileExists(atPath: $0.path) }

        if documentURLs.isEmpty && explicitPaths.isEmpty {
            documentURLs = try fallbackHTMLDocuments()
        }

        guard !documentURLs.isEmpty else {
            fputs("No imported HTML files were found in the saved authoring project.\n", stderr)
            Foundation.exit(1)
        }

        let documents = try documentURLs.map(loadDocument(from:))

        project.chapters = []
        if let manifest = project.tableManifest {
            project.tables = try ExcelTableImporter.tables(
                manifest: manifest,
                manifestPath: project.lastTableManifestPath
            )
        } else {
            project.tables = []
        }

        if project.codes.isEmpty {
            let jurisdictionID = project.jurisdictions.first?.id
            project.codes = [EditorAuthoredCode(id: 1, jurisdictionID: jurisdictionID, name: "2022 CONSTRUCTION CODES")]
            project.nextCodeID = 2
        }
        if project.codeSections.isEmpty {
            let codeID = project.codes.first?.id ?? 1
            project.codeSections = [EditorAuthoredCodeSection(id: 1, codeID: codeID, name: "BUILDING CODE")]
            project.nextCodeSectionID = 2
        }

        let codeID = project.codes.first?.id ?? 1
        let codeSectionID = project.codeSections.first(where: { $0.codeID == codeID })?.id ?? project.codeSections.first?.id ?? 1

        var nextChapterID: Int64 = 1
        var nextSectionID: Int64 = 1

        for document in documents {
            let structuredText = HTMLAuthoringBridge.structuredText(from: document)
            let hierarchy = try StructuredTextImporter.parseHierarchy(
                structuredText,
                defaults: StructuredImportHierarchyDefaults(
                    codeVersionName: "2022 CONSTRUCTION CODES",
                    codeSectionName: "BUILDING CODE"
                )
            )

            for version in hierarchy.codeVersions {
                for codeSection in version.codeSections {
                    for chapter in codeSection.chapters {
                        let chapterID = nextChapterID
                        nextChapterID += 1

                        let groups = chapter.groups.map { group in
                            var sections: [EditorAuthoredSection] = []
                            let groupBody = group.bodyText.trimmingCharacters(in: .whitespacesAndNewlines)
                            if !groupBody.isEmpty {
                                let id = nextSectionID
                                nextSectionID += 1
                                sections.append(
                                    EditorAuthoredSection(
                                        id: id,
                                        sectionNumber: sectionNumber(fromGroupHeader: group.headerLine),
                                        title: sectionTitle(
                                            fromGroupHeader: group.headerLine,
                                            headingLine: group.headingLine
                                        ),
                                        officialText: groupBody,
                                        richTextOverrideData: nil,
                                        kind: .textBlock
                                    )
                                )
                            }

                            sections.append(contentsOf: group.sections.map { section -> EditorAuthoredSection in
                                let id = nextSectionID
                                nextSectionID += 1
                                return EditorAuthoredSection(
                                    id: id,
                                    sectionNumber: section.sectionNumber,
                                    title: section.titleLine,
                                    officialText: section.bodyText,
                                    richTextOverrideData: nil,
                                    kind: .title
                                )
                            })

                            return EditorAuthoredSectionGroup(
                                id: group.headerLine,
                                headerLine: group.headerLine,
                                headingLine: group.headingLine,
                                headerRTFData: nil,
                                headingRTFData: nil,
                                sections: sections
                            )
                        }

                        project.chapters.append(
                            EditorAuthoredChapter(
                                id: chapterID,
                                codeID: codeID,
                                codeSectionID: codeSectionID,
                                chapterNumber: chapter.chapterNumber,
                                title: chapter.title,
                                rawDraftText: structuredText,
                                groups: groups
                            )
                        )
                    }
                }
            }
        }

        project.nextChapterID = nextChapterID
        project.nextSectionID = nextSectionID

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(project)
        try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: outputURL, options: .atomic)

        print("Rebuilt authored JSON at \(outputURL.path)")
    }

    private static func loadDocument(from url: URL) throws -> EditorDocument {
        let data = try Data(contentsOf: url)
        let html = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) ?? ""
        return EditorDocument(fileURL: url, kind: .html, htmlContent: html)
    }

    private static func fallbackHTMLDocuments() throws -> [URL] {
        for directoryURL in defaultHTMLDirectoryCandidates where FileManager.default.fileExists(atPath: directoryURL.path) {
            let urls = try FileManager.default.contentsOfDirectory(
                at: directoryURL,
                includingPropertiesForKeys: nil,
                options: [.skipsHiddenFiles]
            )

            let htmlURLs = urls
                .filter { $0.pathExtension.lowercased() == "html" }
                .sorted {
                    $0.lastPathComponent.compare($1.lastPathComponent, options: [.numeric, .caseInsensitive]) == .orderedAscending
                }

            if !htmlURLs.isEmpty {
                return htmlURLs
            }
        }

        return []
    }

    private static func sectionNumber(fromGroupHeader headerLine: String) -> String {
        let prefix = "SECTION BC "
        let trimmed = headerLine.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.uppercased().hasPrefix(prefix) else { return trimmed }
        return String(trimmed.dropFirst(prefix.count)).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func sectionTitle(fromGroupHeader headerLine: String, headingLine: String?) -> String {
        let trimmedHeader = headerLine.trimmingCharacters(in: .whitespacesAndNewlines)
        let displayHeader: String
        if trimmedHeader.uppercased().hasPrefix("SECTION BC ") {
            let suffix = String(trimmedHeader.dropFirst("SECTION BC ".count))
            displayHeader = "Section BC \(suffix)"
        } else {
            displayHeader = trimmedHeader
        }

        guard let headingLine else { return displayHeader }
        let trimmedHeading = headingLine.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedHeading.isEmpty else { return displayHeader }
        let displayHeading = trimmedHeading == trimmedHeading.uppercased()
            ? trimmedHeading.localizedCapitalized
            : trimmedHeading
        return "\(displayHeader): \(displayHeading)"
    }
}
