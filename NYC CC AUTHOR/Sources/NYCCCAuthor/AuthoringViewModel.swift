import AppKit
import CommonCrypto
import Foundation
import UniformTypeIdentifiers

@MainActor
final class AuthoringViewModel: ObservableObject {
    private enum SessionKeys {
        static let recentDocumentPaths = "NYCCCAuthor.recentDocumentPaths"
    }

    private struct PublishDocumentSnapshot: Sendable {
        let filePath: String
        let htmlContent: String
        let codeSectionName: String?
    }

    private struct PublishScope: Sendable {
        let jurisdictionID: Int64
        let jurisdictionName: String
        let codeID: Int64
        let codeName: String
        let codeSectionID: Int64
        let codeSectionName: String
    }

    private struct PackManifest: Codable {
        let schemaVersion: Int
        let packID: String
        let displayName: String
        let jurisdictionID: Int64
        let jurisdictionName: String
        let codeID: Int64
        let codeName: String
        let codeSectionID: Int64
        let codeSectionName: String
        let contentKind: String
        let bundleFileName: String
        let chaptersDirectoryName: String
        let assetsDirectoryName: String
        let chapterCount: Int
        let generatedAt: String
    }

    private struct CascadeDeleteResult {
        var codeCount = 0
        var codeSectionCount = 0
        var chapterCount = 0
        var codeSectionNames: Set<String> = []
    }

    private struct InferredDocumentHierarchy {
        let jurisdictionName: String
        let codeVersionName: String
        let codeSectionName: String
    }

    @Published private(set) var documents: [EditorDocument] = []
    @Published private(set) var outlineByDocumentID: [UUID: [OutlineItem]] = [:]
    @Published private(set) var loadingDocumentIDs: Set<UUID> = []
    @Published var selectedDocumentID: EditorDocument.ID?
    @Published var selectedOutlineItemID: String?
    @Published var collapsedOutlineItemIDs: Set<String> = []
    @Published private(set) var authoringProject: EditorAuthoringProject
    @Published private(set) var tableManifest: EditorTableManifest?
    @Published var selectedJurisdictionID: Int64?
    @Published var selectedCodeID: Int64?
    @Published var selectedCodeSectionID: Int64?
    @Published var statusMessage = "Open HTML files, edit them visually, then export structured authored content."
    @Published var errorMessage: String?
    @Published private(set) var isPublishing = false
    @Published private(set) var isExportingPack = false

    private let authoringStore = EditorAuthoringStore()
    private let canonicalCodeContentRootURL: URL = {
        let workspaceRootURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        return workspaceRootURL
            .appendingPathComponent("NYC CC APP", isDirectory: true)
            .appendingPathComponent("permitext", isDirectory: true)
            .appendingPathComponent("Resources", isDirectory: true)
            .appendingPathComponent("CodeContent", isDirectory: true)
    }()

    init() {
        authoringProject = (try? authoringStore.load()) ?? EditorAuthoringProject()
        Self.migrateJurisdictionsIfNeeded(in: &authoringProject)
        tableManifest = authoringProject.tableManifest
        selectFirstAvailableHierarchy()
    }

    var documentTitle: String {
        selectedDocument?.displayName ?? "No File Selected"
    }

    var documentCountText: String {
        switch documents.count {
        case 0: return "No files open"
        case 1: return "1 file open"
        default: return "\(documents.count) files open"
        }
    }

    var hasDocuments: Bool { !documents.isEmpty }
    var hasSelection: Bool { selectedDocument != nil }

    var visibleDocuments: [EditorDocument] {
        guard let selectedCodeSectionID,
              let section = authoringProject.codeSections.first(where: { $0.id == selectedCodeSectionID }) else {
            return documents
        }
        let selectedSectionName = normalizedCodeSectionName(section.name)
        return documents.filter { normalizedCodeSectionName(documentCodeSectionName(for: $0)) == selectedSectionName }
    }

    var selectedHTMLContent: String {
        selectedDocument?.htmlContent ?? ""
    }

    var selectedBodyContent: String {
        guard let doc = selectedDocument else { return "" }
        guard doc.isLoaded else { return "" }
        return doc.splitBody().body
    }

    var selectedDocumentIsEmpty: Bool {
        guard let document = selectedDocument else { return false }
        guard document.isLoaded else { return false }
        return document.htmlContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var selectedOutline: [OutlineItem] {
        guard let selectedDocument else { return [] }
        return outlineByDocumentID[selectedDocument.id] ?? []
    }

    func openDocuments() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.html]
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = true
        panel.treatsFilePackagesAsDirectories = false

        guard panel.runModal() == .OK else { return }
        openDocuments(at: panel.urls)
    }

    func openDocuments(at urls: [URL]) {
        guard !urls.isEmpty else { return }

        let standardizedURLs = Self.expandHTMLDocumentURLs(from: urls)
        guard !standardizedURLs.isEmpty else {
            statusMessage = "No HTML files were found."
            return
        }
        ensureHierarchyForImportedDocuments(at: standardizedURLs)
        upsertPlaceholderDocuments(for: standardizedURLs)
        selectedDocumentID = documents.first(where: {
            $0.fileURL.standardizedFileURL == standardizedURLs.first
        })?.id
        syncSelectedDocumentToCurrentCodeSection()
        selectedOutlineItemID = nil
        collapsedOutlineItemIDs = []
        preloadDocuments(at: standardizedURLs)
        persistOpenDocumentPaths()
        statusMessage = standardizedURLs.count == 1
            ? "Opened and loaded 1 HTML file."
            : "Opened and loading \(standardizedURLs.count) HTML files."
    }

    private nonisolated static func expandHTMLDocumentURLs(from urls: [URL]) -> [URL] {
        let fileManager = FileManager.default
        var htmlURLs: [URL] = []

        for url in urls.map(\.standardizedFileURL) {
            var isDirectory: ObjCBool = false
            guard fileManager.fileExists(atPath: url.path, isDirectory: &isDirectory) else { continue }

            if isDirectory.boolValue {
                let enumerator = fileManager.enumerator(
                    at: url,
                    includingPropertiesForKeys: [.isRegularFileKey],
                    options: [.skipsHiddenFiles]
                )
                while let item = enumerator?.nextObject() as? URL {
                    guard item.pathExtension.lowercased() == "html" || item.pathExtension.lowercased() == "htm" else {
                        continue
                    }
                    htmlURLs.append(item.standardizedFileURL)
                }
            } else if url.pathExtension.lowercased() == "html" || url.pathExtension.lowercased() == "htm" {
                htmlURLs.append(url)
            }
        }

        return Array(Set(htmlURLs)).sorted {
            $0.path.compare($1.path, options: [.numeric, .caseInsensitive]) == .orderedAscending
        }
    }

    private nonisolated static func inferredCodeSectionName(for url: URL) -> String? {
        inferredHierarchy(for: url)?.codeSectionName
    }

    private nonisolated static func inferredHierarchy(for url: URL) -> InferredDocumentHierarchy? {
        let codeSectionURL = url.deletingLastPathComponent()
        let codeVersionURL = codeSectionURL.deletingLastPathComponent()
        let jurisdictionURL = codeVersionURL.deletingLastPathComponent()

        let codeSectionName = codeSectionURL.lastPathComponent.trimmingCharacters(in: .whitespacesAndNewlines)
        let codeVersionName = codeVersionURL.lastPathComponent.trimmingCharacters(in: .whitespacesAndNewlines)
        let jurisdictionName = jurisdictionURL.lastPathComponent.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !jurisdictionName.isEmpty,
              !codeVersionName.isEmpty,
              !codeSectionName.isEmpty,
              codeVersionName.range(of: "code", options: [.caseInsensitive]) != nil else {
            return nil
        }

        return InferredDocumentHierarchy(
            jurisdictionName: jurisdictionName,
            codeVersionName: codeVersionName,
            codeSectionName: codeSectionName
        )
    }

    func importTableManifest() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json]
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.treatsFilePackagesAsDirectories = false
        panel.nameFieldStringValue = "table_manifest.json"

        guard panel.runModal() == .OK, let url = panel.url else { return }

        do {
            let data = try Data(contentsOf: url)
            let manifest = try JSONDecoder().decode(EditorTableManifest.self, from: data)
            authoringProject.tableManifest = manifest
            authoringProject.lastTableManifestPath = url.path
            tableManifest = manifest
            persistAuthoringProject()
            statusMessage = "Imported table manifest for \(manifest.workbook)."
        } catch {
            present(error)
        }
    }

    func clearTableManifest() {
        authoringProject.tableManifest = nil
        authoringProject.lastTableManifestPath = nil
        tableManifest = nil
        persistAuthoringProject()
        statusMessage = "Cleared table manifest."
    }

    func deleteTableManifestEntry(id tableID: String) {
        guard var manifest = authoringProject.tableManifest else { return }
        guard let index = manifest.tables.firstIndex(where: { $0.id == tableID }) else { return }
        manifest.tables.remove(at: index)
        authoringProject.tableManifest = manifest
        tableManifest = manifest
        persistAuthoringProject()
        statusMessage = "Deleted table manifest entry \(tableID)."
    }

    func restoreLastSessionIfAvailable() {
        guard documents.isEmpty else { return }
        let paths = UserDefaults.standard.stringArray(forKey: SessionKeys.recentDocumentPaths) ?? []
        let urls = paths.map { URL(fileURLWithPath: $0) }.filter { FileManager.default.fileExists(atPath: $0.path) }
        guard !urls.isEmpty else { return }
        openDocuments(at: urls)
        statusMessage = urls.count == 1
            ? "Reopened 1 file from the last session."
            : "Reopened \(urls.count) files from the last session."
    }

    func clearLastSessionRestoreList() {
        UserDefaults.standard.removeObject(forKey: SessionKeys.recentDocumentPaths)
    }

    func selectDocument(_ documentID: UUID) {
        selectedDocumentID = documentID
        selectedOutlineItemID = nil
        ensureLoadedDocument(id: documentID)
    }

    var codeVersions: [EditorAuthoredCode] {
        guard let selectedJurisdictionID else { return authoringProject.codes }
        return authoringProject.codes.filter { ($0.jurisdictionID ?? selectedJurisdictionID) == selectedJurisdictionID }
    }

    var jurisdictions: [EditorAuthoredJurisdiction] {
        authoringProject.jurisdictions
    }

    var codeSectionsForSelectedCode: [EditorAuthoredCodeSection] {
        guard let selectedCodeID else { return authoringProject.codeSections }
        return authoringProject.codeSections.filter { $0.codeID == selectedCodeID }
    }

    var selectedCodeVersionName: String {
        guard let selectedCodeID,
              let match = authoringProject.codes.first(where: { $0.id == selectedCodeID }) else {
            return "No code version"
        }
        return match.name
    }

    var selectedCodeSectionName: String {
        guard let selectedCodeSectionID,
              let match = authoringProject.codeSections.first(where: { $0.id == selectedCodeSectionID }) else {
            return "No code section"
        }
        return match.name
    }

    func createCodeVersion(name: String) {
        let jurisdictionID = selectedJurisdictionID ?? ensureSelectedJurisdiction()
        let newCode = EditorAuthoredCode(id: authoringProject.nextCodeID, jurisdictionID: jurisdictionID, name: name)
        authoringProject.nextCodeID += 1
        authoringProject.codes.append(newCode)
        selectedCodeID = newCode.id
        if let firstSection = authoringProject.codeSections.first(where: { $0.codeID == newCode.id }) {
            selectedCodeSectionID = firstSection.id
        } else if selectedCodeSectionID == nil, let firstAnySection = authoringProject.codeSections.first {
            selectedCodeSectionID = firstAnySection.id
        }
        persistAuthoringProject()
    }

    func createJurisdiction(name: String) {
        let newJurisdiction = EditorAuthoredJurisdiction(id: authoringProject.nextJurisdictionID, name: name)
        authoringProject.nextJurisdictionID += 1
        authoringProject.jurisdictions.append(newJurisdiction)
        selectedJurisdictionID = newJurisdiction.id
        selectedCodeID = authoringProject.codes.first(where: { $0.jurisdictionID == newJurisdiction.id })?.id
        selectedCodeSectionID = selectedCodeID.flatMap { codeID in
            authoringProject.codeSections.first(where: { $0.codeID == codeID })?.id
        }
        persistAuthoringProject()
    }

    func deleteSelectedJurisdiction() {
        guard let selectedJurisdictionID else { return }

        let deleted = cascadeDeleteJurisdiction(id: selectedJurisdictionID)
        selectFirstAvailableHierarchy()
        pruneOpenDocuments(matchingCodeSectionNames: deleted.codeSectionNames)

        persistOpenDocumentPaths()
        persistAuthoringProject()
        statusMessage = "Deleted jurisdiction and \(deleted.codeCount) code version(s), \(deleted.codeSectionCount) code section(s), and \(deleted.chapterCount) chapter(s)."
    }

    func deleteSelectedCodeVersion() {
        guard let selectedCodeID else { return }

        let deleted = cascadeDeleteCodeVersion(id: selectedCodeID)
        repairSelectionAfterHierarchyMutation(preferredJurisdictionID: selectedJurisdictionID)
        pruneOpenDocuments(matchingCodeSectionNames: deleted.codeSectionNames)

        persistOpenDocumentPaths()
        persistAuthoringProject()
        statusMessage = "Deleted code version and \(deleted.codeSectionCount) code section(s), and \(deleted.chapterCount) chapter(s)."
    }

    func deleteSelectedCodeSection() {
        guard let selectedCodeSectionID else { return }

        let deleted = cascadeDeleteCodeSection(id: selectedCodeSectionID)
        repairSelectionAfterHierarchyMutation(
            preferredJurisdictionID: selectedJurisdictionID,
            preferredCodeID: selectedCodeID
        )
        pruneOpenDocuments(matchingCodeSectionNames: deleted.codeSectionNames)

        persistOpenDocumentPaths()
        persistAuthoringProject()
        statusMessage = "Deleted code section and \(deleted.chapterCount) chapter(s)."
    }

    func createCodeSection(name: String) {
        let jurisdictionID = selectedJurisdictionID ?? ensureSelectedJurisdiction()
        let codeID = selectedCodeID
            ?? authoringProject.codes.first(where: { $0.jurisdictionID == jurisdictionID })?.id
            ?? {
            let jurisdictionID = selectedJurisdictionID ?? ensureSelectedJurisdiction()
            let newCode = EditorAuthoredCode(id: authoringProject.nextCodeID, jurisdictionID: jurisdictionID, name: "2022 CONSTRUCTION CODES")
            authoringProject.nextCodeID += 1
            authoringProject.codes.append(newCode)
            selectedCodeID = newCode.id
            return newCode.id
        }()

        let newSection = EditorAuthoredCodeSection(id: authoringProject.nextCodeSectionID, codeID: codeID, name: name)
        authoringProject.nextCodeSectionID += 1
        authoringProject.codeSections.append(newSection)
        selectedCodeID = codeID
        selectedCodeSectionID = newSection.id
        selectedDocumentID = nil
        selectedOutlineItemID = nil
        collapsedOutlineItemIDs = []
        persistAuthoringProject()
    }

    func selectCodeVersion(_ id: Int64) {
        selectedCodeID = id
        if let code = authoringProject.codes.first(where: { $0.id == id }),
           let jurisdictionID = code.jurisdictionID {
            selectedJurisdictionID = jurisdictionID
        }
        if let currentSectionID = selectedCodeSectionID,
           authoringProject.codeSections.contains(where: { $0.id == currentSectionID && $0.codeID == id }) == false {
            selectedCodeSectionID = authoringProject.codeSections.first(where: { $0.codeID == id })?.id
        }
        syncSelectedDocumentToCurrentCodeSection()
    }

    func selectJurisdiction(_ id: Int64) {
        selectedJurisdictionID = id
        if let selectedCodeID,
           authoringProject.codes.contains(where: { $0.id == selectedCodeID && $0.jurisdictionID == id }) {
            return
        }
        selectedCodeID = authoringProject.codes.first(where: { $0.jurisdictionID == id })?.id
        if let selectedCodeID {
            selectedCodeSectionID = authoringProject.codeSections.first(where: { $0.codeID == selectedCodeID })?.id
        } else {
            selectedCodeSectionID = nil
        }
        syncSelectedDocumentToCurrentCodeSection()
    }

    func selectCodeSection(_ id: Int64) {
        guard let section = authoringProject.codeSections.first(where: { $0.id == id }) else { return }
        selectedCodeSectionID = section.id
        selectedCodeID = section.codeID
        syncSelectedDocumentToCurrentCodeSection()
    }

    private func upsertPlaceholderDocuments(for urls: [URL]) {
        for url in urls {
            let codeSectionName = Self.inferredCodeSectionName(for: url) ?? selectedCodeSectionName
            if let existingIndex = documents.firstIndex(where: { $0.fileURL.standardizedFileURL == url }) {
                let existing = documents[existingIndex]
                documents[existingIndex] = EditorDocument(
                    id: existing.id,
                    fileURL: url,
                    codeSectionName: existing.codeSectionName ?? codeSectionName,
                    kind: .html,
                    htmlContent: existing.htmlContent,
                    isLoaded: existing.isLoaded,
                    hasUnsavedChanges: existing.hasUnsavedChanges,
                    lastReplacementCount: existing.lastReplacementCount
                )
            } else {
                documents.append(EditorDocument(fileURL: url, codeSectionName: codeSectionName, kind: .html, htmlContent: "", isLoaded: false))
            }
        }
        for document in documents where urls.contains(where: { $0.standardizedFileURL == document.fileURL.standardizedFileURL }) {
            outlineByDocumentID[document.id] = outlineByDocumentID[document.id] ?? []
        }
        syncSelectedDocumentToCurrentCodeSection()
    }

    private func preloadDocuments(at urls: [URL]) {
        let urlSet = Set(urls.map(\.path))
        let matchingIDs = documents.compactMap { document in
            urlSet.contains(document.fileURL.standardizedFileURL.path) ? document.id : nil
        }
        for documentID in matchingIDs {
            ensureLoadedDocument(id: documentID)
        }
    }

    private func ensureLoadedDocument(id documentID: UUID) {
        guard let index = documents.firstIndex(where: { $0.id == documentID }) else { return }
        guard !documents[index].isLoaded else {
            if outlineByDocumentID[documentID]?.isEmpty ?? true {
                loadOutlineIfNeeded(for: documentID)
            }
            return
        }
        guard loadingDocumentIDs.contains(documentID) == false else { return }
        loadingDocumentIDs.insert(documentID)
        let url = documents[index].fileURL
        Task.detached(priority: .userInitiated) { [weak self] in
            guard let self else { return }
            do {
                let loaded = try Self.loadDocument(from: url)
                let outline = HTMLAuthoringBridge.buildOutline(for: loaded)
                await self.applyLoadedDocument(id: documentID, html: loaded.htmlContent, outline: outline)
            } catch {
                await self.finishLoadingDocument(id: documentID, error: error)
            }
        }
    }

    private func loadOutlineIfNeeded(for documentID: UUID) {
        guard let index = documents.firstIndex(where: { $0.id == documentID }) else { return }
        let document = documents[index]
        guard document.htmlContent.isEmpty == false else { return }
        outlineByDocumentID[documentID] = HTMLAuthoringBridge.buildOutline(for: document)
    }

    private func applyLoadedDocument(id documentID: UUID, html: String, outline: [OutlineItem]) {
        guard let index = documents.firstIndex(where: { $0.id == documentID }) else { return }
        documents[index].htmlContent = html
        documents[index].isLoaded = true
        outlineByDocumentID[documentID] = outline
        loadingDocumentIDs.remove(documentID)
        if selectedDocumentID == documentID {
            collapsedOutlineItemIDs = collapsedByDefaultIDs(in: outline)
        }
        if selectedDocumentID == documentID {
            selectedOutlineItemID = nil
        }
        refreshAuthoringProjectFromLoadedDocumentsIfPossible()
    }

    private func finishLoadingDocument(id documentID: UUID, error: Error) {
        loadingDocumentIDs.remove(documentID)
        if errorMessage == nil {
            errorMessage = error.localizedDescription
        }
        statusMessage = "Some files could not be loaded."
    }

    private func collapsedByDefaultIDs(in items: [OutlineItem]) -> Set<String> {
        items.reduce(into: Set<String>()) { result, item in
            if item.kind != .chapter && !item.children.isEmpty {
                result.insert(item.id)
            }
            result.formUnion(collapsedByDefaultIDs(in: item.children))
        }
    }

    func updateSelectedHTML(_ html: String) {
        guard let index = selectedDocumentIndex else { return }
        guard documents[index].isLoaded else { return }
        guard !isUnsafeEmptyReplacement(newHTML: html, currentHTML: documents[index].htmlContent, fileName: documents[index].displayName) else {
            return
        }
        guard documents[index].htmlContent != html else { return }
        documents[index].htmlContent = html
        documents[index].hasUnsavedChanges = true
        outlineByDocumentID[documents[index].id] = HTMLAuthoringBridge.buildOutline(for: documents[index])
    }

    /// Apply a body-only edit (from the WYSIWYG WebView) by splicing the new body
    /// content into the original full document. Preserves doctype/<html>/<head> and
    /// any attributes on the existing <body> tag so the file on disk keeps its shape.
    func updateSelectedBody(_ newBody: String) {
        guard let index = selectedDocumentIndex else { return }
        guard documents[index].isLoaded else { return }
        guard !isUnsafeEmptyReplacement(newHTML: newBody, currentHTML: documents[index].splitBody().body, fileName: documents[index].displayName) else {
            return
        }
        let merged = documents[index].replacingBody(with: newBody)
        guard documents[index].htmlContent != merged else { return }
        documents[index].htmlContent = merged
        documents[index].hasUnsavedChanges = true
        outlineByDocumentID[documents[index].id] = HTMLAuthoringBridge.buildOutline(for: documents[index])
    }

    func saveSelectedDocument() {
        guard let index = selectedDocumentIndex else { return }
        saveDocument(at: index)
    }

    func saveAllDocuments() {
        var savedCount = 0
        var skippedCount = 0
        for index in documents.indices {
            if saveDocument(at: index) {
                savedCount += 1
            } else {
                skippedCount += 1
            }
        }
        if !documents.isEmpty {
            statusMessage = skippedCount == 0
                ? "Saved \(savedCount) files."
                : "Saved \(savedCount) files. Skipped \(skippedCount) unloaded or unsafe file(s)."
        }
    }

    func applyHeadingPrefixesToSelected() {
        guard let index = selectedDocumentIndex else { return }
        guard documents[index].isLoaded else {
            statusMessage = "Load the selected file before applying heading prefixes."
            return
        }
        let result = HeadingPrefixTransformer.transform(html: documents[index].htmlContent)
        documents[index].htmlContent = result.value
        documents[index].hasUnsavedChanges = result.replacementCount > 0 || documents[index].hasUnsavedChanges
        outlineByDocumentID[documents[index].id] = HTMLAuthoringBridge.buildOutline(for: documents[index])
        statusMessage = result.replacementCount == 0
            ? "No headings matched in \(documents[index].displayName)."
            : "Applied \(result.replacementCount) prefixes in \(documents[index].displayName)."
    }

    func applyHeadingPrefixesToAll() {
        var total = 0
        var skipped = 0
        for index in documents.indices {
            guard documents[index].isLoaded else {
                skipped += 1
                continue
            }
            let result = HeadingPrefixTransformer.transform(html: documents[index].htmlContent)
            documents[index].htmlContent = result.value
            documents[index].hasUnsavedChanges = result.replacementCount > 0 || documents[index].hasUnsavedChanges
            outlineByDocumentID[documents[index].id] = HTMLAuthoringBridge.buildOutline(for: documents[index])
            total += result.replacementCount
        }
        if skipped > 0 {
            statusMessage = "Applied \(total) prefixes. Skipped \(skipped) unloaded file(s)."
        } else {
            statusMessage = total == 0 ? "No headings matched in the open files." : "Applied \(total) prefixes across open files."
        }
    }

    func exportSelectedAsStructuredJSON() {
        guard let selectedDocument else { return }
        guard selectedDocument.isLoaded else {
            statusMessage = "Load the selected file before exporting JSON."
            return
        }

        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        panel.nameFieldStringValue = selectedDocument.fileURL.deletingPathExtension().lastPathComponent + ".authored.json"

        guard panel.runModal() == .OK, let url = panel.url else { return }

        do {
            let project = try buildProject(from: [selectedDocument])
            let data = try JSONEncoder.prettyEditorJSON.encode(project)
            try data.write(to: url, options: .atomic)
            statusMessage = "Exported \(url.lastPathComponent)."
        } catch {
            present(error)
        }
    }

    func exportAllAsStructuredJSON() {
        guard !documents.isEmpty else { return }
        guard documents.allSatisfy(\.isLoaded) else {
            statusMessage = "Load every open file before exporting all JSON."
            return
        }

        let panel = NSSavePanel()
        panel.allowedContentTypes = [.json]
        panel.nameFieldStringValue = "nyc_cc_authored.json"

        guard panel.runModal() == .OK, let url = panel.url else { return }

        do {
            let project = try buildProject(from: documents)
            let data = try JSONEncoder.prettyEditorJSON.encode(project)
            try data.write(to: url, options: .atomic)
            statusMessage = "Exported \(url.lastPathComponent)."
        } catch {
            present(error)
        }
    }

    func publishAllToIOSApp() {
        guard !documents.isEmpty else { return }
        guard documents.allSatisfy(\.isLoaded) else {
            statusMessage = "Load every open file before publishing to the iOS app."
            return
        }
        guard !isPublishing else { return }

        ensureHierarchyForImportedDocuments(at: documents.map(\.fileURL))

        let documentSnapshots = documents.map {
            PublishDocumentSnapshot(
                filePath: $0.fileURL.path,
                htmlContent: $0.htmlContent,
                codeSectionName: $0.codeSectionName ?? Self.inferredCodeSectionName(for: $0.fileURL)
            )
        }
        let projectSnapshot = authoringProject
        let selectedCodeIDSnapshot = selectedCodeID
        let selectedCodeSectionIDSnapshot = selectedCodeSectionID
        let selectedJurisdictionIDSnapshot = selectedJurisdictionID
        let codeContentRootURL = canonicalCodeContentRootURL
        let documentCount = documents.count

        isPublishing = true
        statusMessage = "Publishing \(documentCount) open file(s) to shared app content..."

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            do {
                let scope = try Self.resolvePublishScope(
                    in: projectSnapshot,
                    selectedJurisdictionID: selectedJurisdictionIDSnapshot,
                    selectedCodeID: selectedCodeIDSnapshot,
                    selectedCodeSectionID: selectedCodeSectionIDSnapshot
                )
                let project = try Self.buildProjectSnapshot(
                    from: documentSnapshots,
                    baseProject: projectSnapshot,
                    scope: scope
                )
                let bundleProject = Self.bundleProjectSnapshot(from: project, scope: scope, includesAllCodeSectionsForCode: true)
                let bundleRootURL = Self.authoredBundleRootURL(scope: scope, codeContentRootURL: codeContentRootURL)
                try Self.writeBundleProject(bundleProject, to: bundleRootURL)
                try Self.publishHTMLBundle(from: documentSnapshots, to: bundleRootURL, sectionedByCodeSection: true)
                let preparedManifest = try PreparedChapterContentBuilder.writePreparedContent(
                    for: bundleProject,
                    bundleRootURL: bundleRootURL
                )
                try Self.validatePublishedHTMLBundle(from: documentSnapshots, scope: scope, in: codeContentRootURL)

                DispatchQueue.main.async {
                    guard let self else { return }
                    self.persistAuthoringProject(project)
                    self.isPublishing = false
                    let preparedSectionCount = preparedManifest.chapters.reduce(0) { $0 + $1.preparedSectionCount }
                    self.statusMessage = "Published \(documentCount) open file(s), including \(preparedSectionCount) prepared section file(s), to shared app content."
                }
            } catch {
                DispatchQueue.main.async {
                    guard let self else { return }
                    self.isPublishing = false
                    self.present(error)
                }
            }
        }
    }

    func exportInstallablePack() {
        guard !documents.isEmpty else { return }
        guard documents.allSatisfy(\.isLoaded) else {
            statusMessage = "Load every open file before exporting an installable pack."
            return
        }
        guard !isExportingPack else { return }

        do {
            let scope = try Self.resolvePublishScope(
                in: authoringProject,
                selectedJurisdictionID: selectedJurisdictionID,
                selectedCodeID: selectedCodeID,
                selectedCodeSectionID: selectedCodeSectionID
            )
            let panel = NSSavePanel()
            panel.canCreateDirectories = true
            panel.nameFieldStringValue = "\(Self.packID(for: scope)).nycccpack"
            panel.title = "Export Installable Code Pack"
            panel.prompt = "Export Pack"

            guard panel.runModal() == .OK, let outputURL = panel.url else { return }

            let documentSnapshots = documents.map {
                PublishDocumentSnapshot(
                    filePath: $0.fileURL.path,
                    htmlContent: $0.htmlContent,
                    codeSectionName: $0.codeSectionName ?? Self.inferredCodeSectionName(for: $0.fileURL)
                )
            }
            let projectSnapshot = authoringProject
            let documentCount = documents.count

            isExportingPack = true
            statusMessage = "Exporting installable pack..."

            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                do {
                    let project = try Self.buildProjectSnapshot(
                        from: documentSnapshots,
                        baseProject: projectSnapshot,
                        scope: scope
                    )
                    let bundleProject = Self.bundleProjectSnapshot(from: project, scope: scope)
                    try Self.exportPackBundle(
                        bundleProject,
                        documents: documentSnapshots,
                        scope: scope,
                        to: outputURL
                    )

                    DispatchQueue.main.async {
                        guard let self else { return }
                        self.persistAuthoringProject(project)
                        self.isExportingPack = false
                        self.statusMessage = "Exported \(documentCount) open file(s) as \(outputURL.lastPathComponent)."
                    }
                } catch {
                    DispatchQueue.main.async {
                        guard let self else { return }
                        self.isExportingPack = false
                        self.present(error)
                    }
                }
            }
        } catch {
            present(error)
        }
    }

    func exportSelectedAsHTML() {
        guard let selectedDocument else { return }
        guard selectedDocument.isLoaded else {
            statusMessage = "Load the selected file before exporting HTML."
            return
        }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.html]
        panel.nameFieldStringValue = selectedDocument.displayName
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            try Data(selectedDocument.htmlContent.utf8).write(to: url, options: .atomic)
            statusMessage = "Exported \(url.lastPathComponent)."
        } catch {
            present(error)
        }
    }

    private func buildProject(from documents: [EditorDocument]) throws -> EditorAuthoringProject {
        let scope = try Self.resolvePublishScope(
            in: authoringProject,
            selectedJurisdictionID: selectedJurisdictionID,
            selectedCodeID: selectedCodeID,
            selectedCodeSectionID: selectedCodeSectionID
        )
        let project = try Self.buildProjectSnapshot(
            from: documents.map {
                PublishDocumentSnapshot(
                    filePath: $0.fileURL.path,
                    htmlContent: $0.htmlContent,
                    codeSectionName: $0.codeSectionName ?? Self.inferredCodeSectionName(for: $0.fileURL)
                )
            },
            baseProject: authoringProject,
            scope: scope
        )
        persistAuthoringProject(project)
        return project
    }

    private nonisolated static func buildProjectSnapshot(
        from documents: [PublishDocumentSnapshot],
        baseProject: EditorAuthoringProject,
        scope: PublishScope
    ) throws -> EditorAuthoringProject {
        var project = baseProject
        Self.migrateJurisdictionsIfNeeded(in: &project)
        project.chapters.removeAll {
            $0.codeID == scope.codeID && $0.codeSectionID == scope.codeSectionID
        }
        project.tableManifest = baseProject.tableManifest
        if let manifest = baseProject.tableManifest {
            project.tables = try ExcelTableImporter.tables(
                manifest: manifest,
                manifestPath: baseProject.lastTableManifestPath
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

        let routedCodeSectionNames = Set(documents.map { $0.codeSectionName ?? scope.codeSectionName })
        var routedCodeSectionIDs: [String: Int64] = [:]
        for codeSectionName in routedCodeSectionNames.sorted(by: { $0.localizedStandardCompare($1) == .orderedAscending }) {
            let codeSectionID = ensureCodeSection(named: codeSectionName, codeID: scope.codeID, in: &project)
            routedCodeSectionIDs[codeSectionName] = codeSectionID
        }
        let sectionIDsToReplace = Set(routedCodeSectionIDs.values)
        project.chapters.removeAll {
            $0.codeID == scope.codeID && sectionIDsToReplace.contains($0.codeSectionID)
        }

        var nextChapterID: Int64 = (project.chapters.map(\.id).max() ?? 0) + 1
        var nextSectionID: Int64 = (
            project.chapters
                .flatMap(\.groups)
                .flatMap(\.sections)
                .map(\.id)
                .max() ?? 0
        ) + 1

        for document in documents {
            let codeSectionName = document.codeSectionName ?? scope.codeSectionName
            let documentCodeSectionID = routedCodeSectionIDs[codeSectionName] ?? scope.codeSectionID
            let structuredText = HTMLAuthoringBridge.structuredText(fromHTMLContent: document.htmlContent)
            let hierarchy = try StructuredTextImporter.parseHierarchy(
                structuredText,
                defaults: StructuredImportHierarchyDefaults(
                    codeVersionName: scope.codeName,
                    codeSectionName: codeSectionName
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
                                        sectionNumber: Self.sectionNumber(fromGroupHeader: group.headerLine),
                                        title: Self.sectionTitle(
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
                                codeID: scope.codeID,
                                codeSectionID: documentCodeSectionID,
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
        return project
    }

    private nonisolated static func ensureCodeSection(
        named name: String,
        codeID: Int64,
        in project: inout EditorAuthoringProject
    ) -> Int64 {
        if let existing = project.codeSections.first(where: {
            $0.codeID == codeID && $0.name.caseInsensitiveCompare(name) == .orderedSame
        }) {
            return existing.id
        }

        let id = project.nextCodeSectionID
        project.nextCodeSectionID += 1
        project.codeSections.append(EditorAuthoredCodeSection(id: id, codeID: codeID, name: name))
        return id
    }

    private nonisolated static func publishHTMLBundle(
        from documents: [PublishDocumentSnapshot],
        to bundleRootURL: URL,
        sectionedByCodeSection: Bool = false
    ) throws {
        let htmlDocuments = documents.filter { snapshot in
            URL(fileURLWithPath: snapshot.filePath).pathExtension.lowercased() == "html"
        }
        guard !htmlDocuments.isEmpty else { return }

        let assetsURL = bundleRootURL
            .appendingPathComponent("assets", isDirectory: true)
        if FileManager.default.fileExists(atPath: assetsURL.path) {
            try FileManager.default.removeItem(at: assetsURL)
        }
        try FileManager.default.createDirectory(at: assetsURL, withIntermediateDirectories: true)

        if sectionedByCodeSection {
            let codeSectionsURL = bundleRootURL.appendingPathComponent("code-sections", isDirectory: true)
            if FileManager.default.fileExists(atPath: codeSectionsURL.path) {
                try FileManager.default.removeItem(at: codeSectionsURL)
            }
        } else {
            let outputURL = bundleRootURL.appendingPathComponent("chapters", isDirectory: true)
            if FileManager.default.fileExists(atPath: outputURL.path) {
                try FileManager.default.removeItem(at: outputURL)
            }
        }

        for snapshot in htmlDocuments {
            let sourceURL = URL(fileURLWithPath: snapshot.filePath)
            let outputURL: URL
            if sectionedByCodeSection {
                let codeSectionSlug = slug(snapshot.codeSectionName ?? "code")
                outputURL = bundleRootURL
                    .appendingPathComponent("code-sections", isDirectory: true)
                    .appendingPathComponent(codeSectionSlug, isDirectory: true)
                    .appendingPathComponent("chapters", isDirectory: true)
            } else {
                outputURL = bundleRootURL.appendingPathComponent("chapters", isDirectory: true)
            }
            try FileManager.default.createDirectory(at: outputURL, withIntermediateDirectories: true)
            let destinationURL = outputURL.appendingPathComponent(sourceURL.lastPathComponent)
            let localizedHTML = try localizingAuthoredAssets(
                in: snapshot.htmlContent,
                sourceDirectoryURL: sourceURL.deletingLastPathComponent(),
                outputDirectoryURL: outputURL,
                assetsDirectoryURL: assetsURL
            )
            try Data(localizedHTML.utf8).write(to: destinationURL, options: .atomic)

            for aliasFileName in chapterAliasFileNames(in: localizedHTML, sourceFileName: sourceURL.lastPathComponent) {
                let aliasURL = outputURL.appendingPathComponent(aliasFileName, isDirectory: false)
                try Data(localizedHTML.utf8).write(to: aliasURL, options: .atomic)
            }
        }
    }

    private nonisolated static func chapterAliasFileNames(in html: String, sourceFileName: String) -> [String] {
        guard let chapterAliasRegex = try? NSRegularExpression(
            pattern: #"(?i)\b(?:chapter|appendix)\s+([A-Z]?\d+[A-Z]?|[A-Z])\s*:"#,
            options: []
        ) else {
            return []
        }
        let sourceBaseName = URL(fileURLWithPath: sourceFileName)
            .deletingPathExtension()
            .lastPathComponent
            .uppercased()
        let nsHTML = html as NSString
        let matches = chapterAliasRegex.matches(
            in: html,
            range: NSRange(location: 0, length: nsHTML.length)
        )

        var aliases: [String] = []
        for match in matches {
            guard match.numberOfRanges > 1 else { continue }
            let chapterNumber = nsHTML.substring(with: match.range(at: 1)).uppercased()
            guard chapterNumber != sourceBaseName else { continue }
            aliases.append("\(chapterNumber).html")
        }
        return Array(Set(aliases)).sorted()
    }

    private nonisolated static func validatePublishedHTMLBundle(
        from documents: [PublishDocumentSnapshot],
        scope: PublishScope,
        in codeContentRootURL: URL?
    ) throws {
        guard let codeContentRootURL else { return }
        let bundleRootURL = authoredBundleRootURL(scope: scope, codeContentRootURL: codeContentRootURL)
        let bundleJSONURL = bundleRootURL.appendingPathComponent("bundle.json", isDirectory: false)

        guard FileManager.default.fileExists(atPath: bundleJSONURL.path) else {
            throw NSError(
                domain: "NYCCCAuthor",
                code: 1201,
                userInfo: [NSLocalizedDescriptionKey: "The iOS publish bundle is missing bundle.json."]
            )
        }

        let expectedHTMLNames = documents
            .map { URL(fileURLWithPath: $0.filePath) }
            .filter { $0.pathExtension.lowercased() == "html" }
            .map(\.lastPathComponent)

        guard !expectedHTMLNames.isEmpty else {
            throw NSError(
                domain: "NYCCCAuthor",
                code: 1202,
                userInfo: [NSLocalizedDescriptionKey: "No HTML chapters were available to publish."]
            )
        }

        var missingChapterNames: [String] = []
        var remoteAssetChapterNames: [String] = []
        for snapshot in documents.filter({ URL(fileURLWithPath: $0.filePath).pathExtension.lowercased() == "html" }) {
            let fileName = URL(fileURLWithPath: snapshot.filePath).lastPathComponent
            let chaptersURL = bundleRootURL
                .appendingPathComponent("code-sections", isDirectory: true)
                .appendingPathComponent(slug(snapshot.codeSectionName ?? scope.codeSectionName), isDirectory: true)
                .appendingPathComponent("chapters", isDirectory: true)
            let chapterURL = chaptersURL.appendingPathComponent(fileName, isDirectory: false)
            guard FileManager.default.fileExists(atPath: chapterURL.path) else {
                missingChapterNames.append(fileName)
                continue
            }

            let html = (try? String(contentsOf: chapterURL, encoding: .utf8)) ?? ""
            if html.localizedCaseInsensitiveContains("https://export.amlegal.com") ||
                html.localizedCaseInsensitiveContains("http://export.amlegal.com") ||
                html.localizedCaseInsensitiveContains("//export.amlegal.com") {
                remoteAssetChapterNames.append(fileName)
            }
        }

        if !missingChapterNames.isEmpty {
            throw NSError(
                domain: "NYCCCAuthor",
                code: 1203,
                userInfo: [NSLocalizedDescriptionKey: "The iOS publish bundle is missing chapter HTML files: \(missingChapterNames.joined(separator: ", "))."]
            )
        }

        if !remoteAssetChapterNames.isEmpty {
            throw NSError(
                domain: "NYCCCAuthor",
                code: 1204,
                userInfo: [NSLocalizedDescriptionKey: "Some published chapter HTML still references remote official assets: \(remoteAssetChapterNames.joined(separator: ", "))."]
            )
        }
    }

    private nonisolated static func localizingAuthoredAssets(
        in html: String,
        sourceDirectoryURL: URL,
        outputDirectoryURL: URL,
        assetsDirectoryURL: URL
    ) throws -> String {
        let pattern = ##"(src|href)\s*=\s*"([^"#]+)""##
        let regex = try NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
        let nsHTML = html as NSString
        let matches = regex.matches(in: html, options: [], range: NSRange(location: 0, length: nsHTML.length))
        guard !matches.isEmpty else { return html }

        var localizedHTML = html
        var replacements: [(original: String, replacement: String)] = []
        var cache: [String: String] = [:]

        for match in matches.reversed() {
            guard match.numberOfRanges >= 3 else { continue }
            let urlString = nsHTML.substring(with: match.range(at: 2))
            guard shouldLocalizeAssetReference(urlString) else { continue }

            let replacementPath: String
            if let cached = cache[urlString] {
                replacementPath = cached
            } else {
                let localURL = try localizedAssetURL(
                    for: urlString,
                    sourceDirectoryURL: sourceDirectoryURL,
                    assetsDirectoryURL: assetsDirectoryURL
                )
                replacementPath = relativePath(from: outputDirectoryURL, to: localURL)
                cache[urlString] = replacementPath
            }
            replacements.append((original: urlString, replacement: replacementPath))
        }

        for replacement in replacements {
            localizedHTML = localizedHTML.replacingOccurrences(of: replacement.original, with: replacement.replacement)
        }
        return localizedHTML
    }

    private nonisolated static func shouldLocalizeAssetReference(_ value: String) -> Bool {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        let lowercased = trimmed.lowercased()
        if lowercased.hasPrefix("data:") ||
            lowercased.hasPrefix("mailto:") ||
            lowercased.hasPrefix("tel:") ||
            lowercased.hasPrefix("javascript:") {
            return false
        }
        if lowercased.contains("export.amlegal.com") {
            return true
        }
        return lowercased.hasPrefix("assets/") ||
            lowercased.hasPrefix("./assets/") ||
            lowercased.contains("/assets/")
    }

    private nonisolated static func localizedAssetURL(
        for reference: String,
        sourceDirectoryURL: URL,
        assetsDirectoryURL: URL
    ) throws -> URL {
        if reference.contains("export.amlegal.com") {
            let remoteURL = try normalizedRemoteURL(from: reference)
            return try localAssetURL(for: remoteURL, in: assetsDirectoryURL)
        }

        return try copyLocalAsset(
            reference,
            sourceDirectoryURL: sourceDirectoryURL,
            assetsDirectoryURL: assetsDirectoryURL
        )
    }

    private nonisolated static func copyLocalAsset(
        _ reference: String,
        sourceDirectoryURL: URL,
        assetsDirectoryURL: URL
    ) throws -> URL {
        let cleanedReference = reference
            .components(separatedBy: "#")[0]
            .components(separatedBy: "?")[0]
        let sourceURL = URL(fileURLWithPath: cleanedReference, relativeTo: sourceDirectoryURL).standardizedFileURL
        guard FileManager.default.fileExists(atPath: sourceURL.path) else {
            throw NSError(
                domain: "NYCCCAuthor",
                code: 1106,
                userInfo: [NSLocalizedDescriptionKey: "Could not find local authored asset: \(reference)"]
            )
        }

        let fileName = sourceURL.lastPathComponent
        let outputURL = assetsDirectoryURL.appendingPathComponent(fileName, isDirectory: false)
        if !FileManager.default.fileExists(atPath: outputURL.path) {
            try FileManager.default.copyItem(at: sourceURL, to: outputURL)
        }
        return outputURL
    }

    private nonisolated static func relativePath(from directoryURL: URL, to fileURL: URL) -> String {
        let directoryComponents = directoryURL.standardizedFileURL.pathComponents
        let fileComponents = fileURL.standardizedFileURL.pathComponents
        let sharedCount = zip(directoryComponents, fileComponents).prefix { $0 == $1 }.count
        let upLevels = max(0, directoryComponents.count - sharedCount)
        let relativeComponents = Array(repeating: "..", count: upLevels) + fileComponents.dropFirst(sharedCount)
        return relativeComponents.joined(separator: "/")
    }

    private nonisolated static func normalizedRemoteURL(from urlString: String) throws -> URL {
        let normalized: String
        if urlString.hasPrefix("//") {
            normalized = "https:" + urlString
        } else {
            normalized = urlString
        }
        guard let url = URL(string: normalized) else {
            throw NSError(
                domain: "NYCCCAuthor",
                code: 1101,
                userInfo: [NSLocalizedDescriptionKey: "Could not parse remote asset URL: \(urlString)"]
            )
        }
        return url
    }

    private nonisolated static func localAssetURL(
        for remoteURL: URL,
        in assetsDirectoryURL: URL
    ) throws -> URL {
        let ext = preferredAssetExtension(for: remoteURL)
        if ext == "css" {
            return try writeFallbackStylesheet(for: remoteURL, to: assetsDirectoryURL)
        }

        do {
            return try downloadRemoteAsset(remoteURL, to: assetsDirectoryURL)
        } catch {
            if ["png", "jpg", "jpeg", "gif", "webp"].contains(ext) {
                return try writeFallbackImage(for: remoteURL, to: assetsDirectoryURL)
            }
            throw error
        }
    }

    private nonisolated static func downloadRemoteAsset(
        _ remoteURL: URL,
        to assetsDirectoryURL: URL
    ) throws -> URL {
        let data = try Data(contentsOf: remoteURL)
        let ext = preferredAssetExtension(for: remoteURL)
        let fileName = sha1(remoteURL.absoluteString) + (ext.isEmpty ? "" : ".\(ext)")
        let outputURL = assetsDirectoryURL.appendingPathComponent(fileName, isDirectory: false)
        if !FileManager.default.fileExists(atPath: outputURL.path) {
            try data.write(to: outputURL, options: .atomic)
        }
        return outputURL
    }

    private nonisolated static func writeFallbackStylesheet(
        for remoteURL: URL,
        to assetsDirectoryURL: URL
    ) throws -> URL {
        let fileName = sha1(remoteURL.absoluteString) + ".css"
        let outputURL = assetsDirectoryURL.appendingPathComponent(fileName, isDirectory: false)
        if FileManager.default.fileExists(atPath: outputURL.path) {
            return outputURL
        }

        let css = """
        html, body { margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
            font-size: 17px;
            line-height: 1.45;
            color: #111111;
            background: #ffffff;
        }
        h1, h2, h3, h4, h5, h6 { line-height: 1.2; margin: 1.1em 0 0.45em; }
        p, li, div { overflow-wrap: anywhere; }
        img { max-width: 100%; height: auto; }
        table { width: 100%; border-collapse: collapse; }
        """
        try Data(css.utf8).write(to: outputURL, options: .atomic)
        return outputURL
    }

    private nonisolated static func writeFallbackImage(
        for remoteURL: URL,
        to assetsDirectoryURL: URL
    ) throws -> URL {
        let outputURL = assetsDirectoryURL.appendingPathComponent(sha1(remoteURL.absoluteString) + ".png", isDirectory: false)
        if FileManager.default.fileExists(atPath: outputURL.path) {
            return outputURL
        }

        let pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s2Fne8AAAAASUVORK5CYII="
        guard let data = Data(base64Encoded: pngBase64) else {
            throw NSError(
                domain: "NYCCCAuthor",
                code: 1105,
                userInfo: [NSLocalizedDescriptionKey: "Could not create fallback image asset."]
            )
        }
        try data.write(to: outputURL, options: .atomic)
        return outputURL
    }

    private nonisolated static func preferredAssetExtension(for remoteURL: URL) -> String {
        let ext = remoteURL.pathExtension.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !ext.isEmpty { return ext }
        return "bin"
    }

    private nonisolated static func sha1(_ value: String) -> String {
        let data = Data(value.utf8)
        var digest = [UInt8](repeating: 0, count: Int(CC_SHA1_DIGEST_LENGTH))
        data.withUnsafeBytes { bytes in
            _ = CC_SHA1(bytes.baseAddress, CC_LONG(data.count), &digest)
        }
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    private nonisolated static func writeBundleProject(
        _ project: EditorAuthoringProject,
        to bundleRootURL: URL
    ) throws {
        let outputURL = bundleRootURL.appendingPathComponent("bundle.json", isDirectory: false)
        let legacyPlistURL = bundleRootURL.appendingPathComponent("bundle.plist", isDirectory: false)
        let data = try JSONEncoder.prettyEditorJSON.encode(project)
        try FileManager.default.createDirectory(
            at: outputURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        if FileManager.default.fileExists(atPath: legacyPlistURL.path) {
            try FileManager.default.removeItem(at: legacyPlistURL)
        }
        try data.write(to: outputURL, options: .atomic)
    }

    private nonisolated static func exportPackBundle(
        _ project: EditorAuthoringProject,
        documents: [PublishDocumentSnapshot],
        scope: PublishScope,
        to outputURL: URL
    ) throws {
        let fileManager = FileManager.default
        if fileManager.fileExists(atPath: outputURL.path) {
            try fileManager.removeItem(at: outputURL)
        }
        try fileManager.createDirectory(at: outputURL, withIntermediateDirectories: true)
        try writeBundleProject(project, to: outputURL)
        try publishHTMLBundle(from: documents, to: outputURL)
        _ = try PreparedChapterContentBuilder.writePreparedContent(for: project, bundleRootURL: outputURL)
        try writePackManifest(project: project, scope: scope, to: outputURL)
        try validatePackBundle(from: documents, in: outputURL)
    }

    private nonisolated static func writePackManifest(
        project: EditorAuthoringProject,
        scope: PublishScope,
        to outputURL: URL
    ) throws {
        let manifest = PackManifest(
            schemaVersion: 1,
            packID: packID(for: scope),
            displayName: "\(scope.codeName) - \(scope.codeSectionName)",
            jurisdictionID: scope.jurisdictionID,
            jurisdictionName: scope.jurisdictionName,
            codeID: scope.codeID,
            codeName: scope.codeName,
            codeSectionID: scope.codeSectionID,
            codeSectionName: scope.codeSectionName,
            contentKind: "authored-html",
            bundleFileName: "bundle.json",
            chaptersDirectoryName: "chapters",
            assetsDirectoryName: "assets",
            chapterCount: project.chapters.count,
            generatedAt: ISO8601DateFormatter().string(from: Date())
        )
        let data = try JSONEncoder.prettyEditorJSON.encode(manifest)
        try data.write(to: outputURL.appendingPathComponent("pack.json"), options: .atomic)
    }

    private nonisolated static func validatePackBundle(
        from documents: [PublishDocumentSnapshot],
        in outputURL: URL
    ) throws {
        for fileName in ["pack.json", "bundle.json"] {
            let url = outputURL.appendingPathComponent(fileName, isDirectory: false)
            guard FileManager.default.fileExists(atPath: url.path) else {
                throw NSError(
                    domain: "NYCCCAuthor",
                    code: 1301,
                    userInfo: [NSLocalizedDescriptionKey: "The installable pack is missing \(fileName)."]
                )
            }
        }

        let chaptersURL = outputURL.appendingPathComponent("chapters", isDirectory: true)
        let expectedHTMLNames = documents
            .map { URL(fileURLWithPath: $0.filePath) }
            .filter { $0.pathExtension.lowercased() == "html" }
            .map(\.lastPathComponent)

        guard !expectedHTMLNames.isEmpty else {
            throw NSError(
                domain: "NYCCCAuthor",
                code: 1302,
                userInfo: [NSLocalizedDescriptionKey: "No HTML chapters were available to export."]
            )
        }

        let missingChapterNames = expectedHTMLNames.filter { fileName in
            let url = chaptersURL.appendingPathComponent(fileName, isDirectory: false)
            return !FileManager.default.fileExists(atPath: url.path)
        }
        if !missingChapterNames.isEmpty {
            throw NSError(
                domain: "NYCCCAuthor",
                code: 1303,
                userInfo: [NSLocalizedDescriptionKey: "The installable pack is missing chapter HTML files: \(missingChapterNames.joined(separator: ", "))."]
            )
        }
    }

    private nonisolated static func bundleProjectSnapshot(
        from fullProject: EditorAuthoringProject,
        scope: PublishScope,
        includesAllCodeSectionsForCode: Bool = false
    ) -> EditorAuthoringProject {
        let bundleCodes = fullProject.codes.filter { $0.id == scope.codeID }
        let bundleCodeSections = fullProject.codeSections.filter {
            includesAllCodeSectionsForCode ? $0.codeID == scope.codeID : $0.id == scope.codeSectionID
        }
        let bundleCodeSectionIDs = Set(bundleCodeSections.map(\.id))
        let bundleChapters = fullProject.chapters.filter {
            $0.codeID == scope.codeID && bundleCodeSectionIDs.contains($0.codeSectionID)
        }

        var project = EditorAuthoringProject()
        project.schemaVersion = fullProject.schemaVersion
        project.nextCodeID = fullProject.nextCodeID
        project.nextJurisdictionID = fullProject.nextJurisdictionID
        project.nextCodeSectionID = fullProject.nextCodeSectionID
        project.nextChapterID = fullProject.nextChapterID
        project.nextSectionID = fullProject.nextSectionID
        project.lastStructuredImportPath = fullProject.lastStructuredImportPath
        project.lastStructuredImportPaths = fullProject.lastStructuredImportPaths
        project.lastTableManifestPath = fullProject.lastTableManifestPath
        project.jurisdictions = fullProject.jurisdictions.filter { $0.id == scope.jurisdictionID }
        project.codes = bundleCodes
        project.codeSections = bundleCodeSections
        project.chapters = bundleChapters
        project.tableManifest = fullProject.tableManifest
        project.tables = fullProject.tables
        return project
    }

    private nonisolated static func resolvePublishScope(
        in project: EditorAuthoringProject,
        selectedJurisdictionID: Int64?,
        selectedCodeID: Int64?,
        selectedCodeSectionID: Int64?
    ) throws -> PublishScope {
        let jurisdictionID = selectedJurisdictionID
            ?? project.jurisdictions.first?.id
            ?? 1
        guard let jurisdiction = project.jurisdictions.first(where: { $0.id == jurisdictionID }) else {
            throw NSError(domain: "NYCCCAuthor", code: 1001, userInfo: [NSLocalizedDescriptionKey: "Select a valid jurisdiction before publishing."])
        }

        let codeID = selectedCodeID
            ?? project.codes.first(where: { $0.jurisdictionID == jurisdictionID })?.id
            ?? project.codes.first?.id
            ?? 1
        guard let code = project.codes.first(where: { $0.id == codeID }) else {
            throw NSError(domain: "NYCCCAuthor", code: 1002, userInfo: [NSLocalizedDescriptionKey: "Select a valid code version before publishing."])
        }

        let codeSectionID = selectedCodeSectionID
            ?? project.codeSections.first(where: { $0.codeID == codeID })?.id
            ?? project.codeSections.first?.id
            ?? 1
        guard let codeSection = project.codeSections.first(where: { $0.id == codeSectionID }) else {
            throw NSError(domain: "NYCCCAuthor", code: 1003, userInfo: [NSLocalizedDescriptionKey: "Select a valid code section before publishing."])
        }

        return PublishScope(
            jurisdictionID: jurisdiction.id,
            jurisdictionName: jurisdiction.name,
            codeID: code.id,
            codeName: code.name,
            codeSectionID: codeSectionID,
            codeSectionName: codeSection.name
        )
    }

    private nonisolated static func packID(for scope: PublishScope) -> String {
        [
            slug(scope.jurisdictionName),
            slug(scope.codeName),
            slug(scope.codeSectionName)
        ]
            .filter { !$0.isEmpty }
            .joined(separator: ".")
    }

    private nonisolated static func slug(_ value: String) -> String {
        let lowercased = value.lowercased()
        let replaced = lowercased.replacingOccurrences(
            of: #"[^a-z0-9]+"#,
            with: "-",
            options: .regularExpression
        )
        return replaced.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }

    private nonisolated static func authoredBundleRootURL(
        scope: PublishScope,
        codeContentRootURL: URL
    ) -> URL {
        codeContentRootURL
            .appendingPathComponent("authored", isDirectory: true)
            .appendingPathComponent(slug(scope.jurisdictionName), isDirectory: true)
            .appendingPathComponent(slug(scope.codeName), isDirectory: true)
    }

    private nonisolated static func sectionNumber(fromGroupHeader headerLine: String) -> String {
        let trimmed = headerLine.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.uppercased().hasPrefix("SECTION BC ") {
            return String(trimmed.dropFirst("SECTION BC ".count)).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if trimmed.uppercased().hasPrefix("SECTION ") {
            return String(trimmed.dropFirst("SECTION ".count)).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return trimmed
    }

    private nonisolated static func sectionTitle(
        fromGroupHeader headerLine: String,
        headingLine: String?
    ) -> String {
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

    nonisolated private static func loadDocument(from url: URL) throws -> EditorDocument {
        let data = try Data(contentsOf: url)
        let html = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) ?? ""
        return EditorDocument(fileURL: url, kind: .html, htmlContent: html)
    }

    @discardableResult
    private func saveDocument(at index: Int) -> Bool {
        let url = documents[index].fileURL
        let html = documents[index].htmlContent
        let data = Data(html.utf8)
        do {
            guard documents[index].isLoaded else {
                statusMessage = "Skipped unloaded file: \(url.lastPathComponent)"
                return false
            }
            if documents[index].kind == .html,
               html.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
               let existingAttributes = try? FileManager.default.attributesOfItem(atPath: url.path),
               let existingSize = existingAttributes[.size] as? NSNumber,
               existingSize.intValue > 0 {
                let message = "Refused to overwrite non-empty HTML with empty content: \(url.lastPathComponent)"
                errorMessage = message
                statusMessage = message
                return false
            }
            try data.write(to: url, options: .atomic)
            documents[index].hasUnsavedChanges = false
            persistOpenDocumentPaths()
            statusMessage = "Saved \(data.count) bytes → \(url.path)"
            return true
        } catch {
            present(error)
            return false
        }
    }

    private var selectedDocument: EditorDocument? {
        guard let selectedDocumentIndex else { return nil }
        return documents[selectedDocumentIndex]
    }

    private var selectedDocumentIndex: Int? {
        guard let selectedDocumentID else { return nil }
        return documents.firstIndex(where: { $0.id == selectedDocumentID })
    }

    private func present(_ error: Error) {
        errorMessage = error.localizedDescription
        statusMessage = "The last action failed."
    }

    private func persistOpenDocumentPaths() {
        let paths = documents.map { $0.fileURL.standardizedFileURL.path }
        UserDefaults.standard.set(paths, forKey: SessionKeys.recentDocumentPaths)
    }

    private func persistAuthoringProject(_ project: EditorAuthoringProject? = nil) {
        do {
            try authoringStore.save(project ?? authoringProject)
        } catch {
            present(error)
        }
    }

    private func cascadeDeleteJurisdiction(id jurisdictionID: Int64) -> CascadeDeleteResult {
        let codeIDs = Set(
            authoringProject.codes
                .filter { $0.jurisdictionID == jurisdictionID }
                .map(\.id)
        )
        let codeSectionIDs = Set(
            authoringProject.codeSections
                .filter { codeIDs.contains($0.codeID) }
                .map(\.id)
        )
        let codeSectionNames = Set(
            authoringProject.codeSections
                .filter { codeSectionIDs.contains($0.id) }
                .map { normalizedCodeSectionName($0.name) }
        )
        let chapterCount = authoringProject.chapters.filter {
            codeIDs.contains($0.codeID) || codeSectionIDs.contains($0.codeSectionID)
        }.count

        authoringProject.jurisdictions.removeAll { $0.id == jurisdictionID }
        authoringProject.codes.removeAll { codeIDs.contains($0.id) }
        authoringProject.codeSections.removeAll { codeSectionIDs.contains($0.id) }
        authoringProject.chapters.removeAll {
            codeIDs.contains($0.codeID) || codeSectionIDs.contains($0.codeSectionID)
        }

        return CascadeDeleteResult(
            codeCount: codeIDs.count,
            codeSectionCount: codeSectionIDs.count,
            chapterCount: chapterCount,
            codeSectionNames: codeSectionNames
        )
    }

    private func cascadeDeleteCodeVersion(id codeID: Int64) -> CascadeDeleteResult {
        let codeSectionIDs = Set(
            authoringProject.codeSections
                .filter { $0.codeID == codeID }
                .map(\.id)
        )
        let codeSectionNames = Set(
            authoringProject.codeSections
                .filter { codeSectionIDs.contains($0.id) }
                .map { normalizedCodeSectionName($0.name) }
        )
        let chapterCount = authoringProject.chapters.filter {
            $0.codeID == codeID || codeSectionIDs.contains($0.codeSectionID)
        }.count

        authoringProject.codes.removeAll { $0.id == codeID }
        authoringProject.codeSections.removeAll { codeSectionIDs.contains($0.id) }
        authoringProject.chapters.removeAll {
            $0.codeID == codeID || codeSectionIDs.contains($0.codeSectionID)
        }

        return CascadeDeleteResult(
            codeCount: 1,
            codeSectionCount: codeSectionIDs.count,
            chapterCount: chapterCount,
            codeSectionNames: codeSectionNames
        )
    }

    private func cascadeDeleteCodeSection(id codeSectionID: Int64) -> CascadeDeleteResult {
        let codeSectionNames = Set(
            authoringProject.codeSections
                .filter { $0.id == codeSectionID }
                .map { normalizedCodeSectionName($0.name) }
        )
        let chapterCount = authoringProject.chapters.filter { $0.codeSectionID == codeSectionID }.count

        authoringProject.codeSections.removeAll { $0.id == codeSectionID }
        authoringProject.chapters.removeAll { $0.codeSectionID == codeSectionID }

        return CascadeDeleteResult(
            codeSectionCount: 1,
            chapterCount: chapterCount,
            codeSectionNames: codeSectionNames
        )
    }

    private func ensureHierarchyForImportedDocuments(at urls: [URL]) {
        let hierarchies = urls.compactMap { Self.inferredHierarchy(for: $0.standardizedFileURL) }
        guard !hierarchies.isEmpty else {
            if selectedJurisdictionID == nil {
                selectFirstAvailableHierarchy()
            }
            return
        }

        let groupedByJurisdiction = Dictionary(grouping: hierarchies, by: { normalizedCodeSectionName($0.jurisdictionName) })
        let primaryJurisdictionGroup = groupedByJurisdiction
            .sorted { lhs, rhs in
                lhs.value.count == rhs.value.count
                    ? lhs.key.localizedStandardCompare(rhs.key) == .orderedAscending
                    : lhs.value.count > rhs.value.count
            }
            .first?
            .value ?? hierarchies

        guard let primary = primaryJurisdictionGroup.first else { return }
        let jurisdictionID = ensureJurisdiction(named: primary.jurisdictionName)
        let codeID = ensureCodeVersion(named: primary.codeVersionName, jurisdictionID: jurisdictionID)

        let codeSectionNames = Set(primaryJurisdictionGroup.map(\.codeSectionName))
        for codeSectionName in codeSectionNames.sorted(by: { $0.localizedStandardCompare($1) == .orderedAscending }) {
            _ = ensureCodeSection(named: codeSectionName, codeID: codeID)
        }

        selectedJurisdictionID = jurisdictionID
        selectedCodeID = codeID
        selectedCodeSectionID = authoringProject.codeSections.first(where: { $0.codeID == codeID })?.id
        persistAuthoringProject()
    }

    private func ensureJurisdiction(named name: String) -> Int64 {
        let normalizedName = normalizedCodeSectionName(name)
        if let existing = authoringProject.jurisdictions.first(where: { normalizedCodeSectionName($0.name) == normalizedName }) {
            return existing.id
        }

        let id = authoringProject.nextJurisdictionID
        authoringProject.nextJurisdictionID += 1
        authoringProject.jurisdictions.append(EditorAuthoredJurisdiction(id: id, name: name))
        return id
    }

    private func ensureCodeVersion(named name: String, jurisdictionID: Int64) -> Int64 {
        let normalizedName = normalizedCodeSectionName(name)
        if let existing = authoringProject.codes.first(where: {
            $0.jurisdictionID == jurisdictionID && normalizedCodeSectionName($0.name) == normalizedName
        }) {
            return existing.id
        }

        let id = authoringProject.nextCodeID
        authoringProject.nextCodeID += 1
        authoringProject.codes.append(EditorAuthoredCode(id: id, jurisdictionID: jurisdictionID, name: name))
        return id
    }

    private func ensureCodeSection(named name: String, codeID: Int64) -> Int64 {
        let normalizedName = normalizedCodeSectionName(name)
        if let existing = authoringProject.codeSections.first(where: {
            $0.codeID == codeID && normalizedCodeSectionName($0.name) == normalizedName
        }) {
            return existing.id
        }

        let id = authoringProject.nextCodeSectionID
        authoringProject.nextCodeSectionID += 1
        authoringProject.codeSections.append(EditorAuthoredCodeSection(id: id, codeID: codeID, name: name))
        return id
    }

    private func pruneOpenDocuments(matchingCodeSectionNames codeSectionNames: Set<String>) {
        guard !codeSectionNames.isEmpty else { return }
        let removedDocumentIDs = Set(
            documents
                .filter { codeSectionNames.contains(normalizedCodeSectionName(documentCodeSectionName(for: $0))) }
                .map(\.id)
        )
        guard !removedDocumentIDs.isEmpty else { return }

        documents.removeAll { removedDocumentIDs.contains($0.id) }
        outlineByDocumentID = outlineByDocumentID.filter { !removedDocumentIDs.contains($0.key) }
        loadingDocumentIDs.subtract(removedDocumentIDs)
        if let selectedDocumentID, removedDocumentIDs.contains(selectedDocumentID) {
            self.selectedDocumentID = nil
        }
        selectedOutlineItemID = nil
        collapsedOutlineItemIDs = []
        syncSelectedDocumentToCurrentCodeSection()
    }

    private func selectFirstAvailableHierarchy() {
        selectedJurisdictionID = authoringProject.jurisdictions.first?.id
        selectedCodeID = selectedJurisdictionID.flatMap { jurisdictionID in
            authoringProject.codes.first(where: { $0.jurisdictionID == jurisdictionID })?.id
        } ?? authoringProject.codes.first?.id
        selectedCodeSectionID = selectedCodeID.flatMap { codeID in
            authoringProject.codeSections.first(where: { $0.codeID == codeID })?.id
        }
        syncSelectedDocumentToCurrentCodeSection()
    }

    private func repairSelectionAfterHierarchyMutation(
        preferredJurisdictionID: Int64? = nil,
        preferredCodeID: Int64? = nil
    ) {
        if let preferredJurisdictionID,
           authoringProject.jurisdictions.contains(where: { $0.id == preferredJurisdictionID }) {
            selectedJurisdictionID = preferredJurisdictionID
        } else {
            selectedJurisdictionID = authoringProject.jurisdictions.first?.id
        }

        if let preferredCodeID,
           authoringProject.codes.contains(where: { $0.id == preferredCodeID }),
           selectedJurisdictionID == nil || authoringProject.codes.contains(where: { $0.id == preferredCodeID && $0.jurisdictionID == selectedJurisdictionID }) {
            selectedCodeID = preferredCodeID
        } else if let selectedJurisdictionID {
            selectedCodeID = authoringProject.codes.first(where: { $0.jurisdictionID == selectedJurisdictionID })?.id
        } else {
            selectedCodeID = authoringProject.codes.first?.id
        }

        selectedCodeSectionID = selectedCodeID.flatMap { codeID in
            authoringProject.codeSections.first(where: { $0.codeID == codeID })?.id
        }
        syncSelectedDocumentToCurrentCodeSection()
    }

    private func refreshAuthoringProjectFromLoadedDocumentsIfPossible() {
        guard !documents.isEmpty else { return }
        guard documents.allSatisfy(\.isLoaded) else { return }

        do {
            let refreshedProject = try buildProject(from: documents)
            authoringProject = refreshedProject
        } catch {
            present(error)
        }
    }

    private func isUnsafeEmptyReplacement(newHTML: String, currentHTML: String, fileName: String) -> Bool {
        let newIsEmpty = newHTML.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let currentIsEmpty = currentHTML.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        guard newIsEmpty && !currentIsEmpty else { return false }
        let message = "Ignored empty editor update for \(fileName)."
        errorMessage = message
        statusMessage = message
        return true
    }

    private func documentCodeSectionName(for document: EditorDocument) -> String {
        document.codeSectionName ?? Self.inferredCodeSectionName(for: document.fileURL) ?? selectedCodeSectionName
    }

    private func normalizedCodeSectionName(_ name: String) -> String {
        name
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
    }

    private func syncSelectedDocumentToCurrentCodeSection() {
        let visibleDocumentIDs = Set(visibleDocuments.map(\.id))
        if let selectedDocumentID, visibleDocumentIDs.contains(selectedDocumentID) {
            return
        }
        selectedDocumentID = visibleDocuments.first?.id
        selectedOutlineItemID = nil
        collapsedOutlineItemIDs = []
    }

    private func ensureSelectedJurisdiction() -> Int64 {
        if let selectedJurisdictionID {
            return selectedJurisdictionID
        }
        if authoringProject.jurisdictions.isEmpty {
            let newJurisdiction = EditorAuthoredJurisdiction(id: authoringProject.nextJurisdictionID, name: "New Jurisdiction")
            authoringProject.nextJurisdictionID += 1
            authoringProject.jurisdictions.append(newJurisdiction)
        }
        let id = authoringProject.jurisdictions.first?.id ?? 1
        selectedJurisdictionID = id
        return id
    }

    private nonisolated static func migrateJurisdictionsIfNeeded(in project: inout EditorAuthoringProject) {
        if project.jurisdictions.isEmpty,
           !project.codes.isEmpty || !project.codeSections.isEmpty || !project.chapters.isEmpty {
            project.jurisdictions = [EditorAuthoredJurisdiction(id: 1, name: "New York City")]
            project.nextJurisdictionID = max(project.nextJurisdictionID, 2)
        }
        let fallbackJurisdictionID = project.jurisdictions.first?.id
        for index in project.codes.indices where project.codes[index].jurisdictionID == nil {
            project.codes[index].jurisdictionID = fallbackJurisdictionID
        }
    }
}

private extension JSONEncoder {
    static var prettyEditorJSON: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }
}
