import Foundation
import SwiftUI

@MainActor
final class CodeLibraryViewModel: ObservableObject {
    private struct AuthoredContentSnapshot: Sendable {
        let store: AuthoredCodeStore
        let codeSections: [CodeSectionCategory]
        let resolvedCodeSectionID: Int64?
        let chapters: [CodeChapter]
    }

    private struct FormattedTextCacheKey: Hashable {
        let sectionID: Int64
        let theme: ReaderTheme
    }

    struct ChapterBlockDescriptor: Identifiable, Sendable {
        let sectionID: Int64
        let groupLabel: String?

        var id: Int64 { sectionID }
    }

    struct ChapterReaderBlockContent: Identifiable {
        let detail: ReaderSectionDetail
        let groupLabel: String?

        var id: Int64 { detail.id }
    }

    @Published private(set) var availableVersions: [BundledCodeVersion] = []
    @Published private(set) var availableJurisdictions: [BundledJurisdiction] = []
    @Published private(set) var codeSections: [CodeSectionCategory] = []
    @Published private(set) var chapters: [CodeChapter] = []
    @Published private(set) var searchResults: [CodeSearchResult] = []
    @Published private(set) var bookmarks: [BookmarkedSection] = []
    @Published var selectedVersionFileName: String = ""
    @Published var selectedJurisdictionKey: String = ""
    @Published var selectedCodeSectionID: Int64?
    @Published var statusMessage: String?
    @Published var readerTheme: ReaderTheme

    private let locator: BundleDatabaseLocator
    private let formattingEngine: FormattingEngine
    private let referenceResolver = CodeReferenceResolver()
    private let userDataStore: UserDataStore?
    private let readerThemeStore: ReaderThemeStore
    private var codeDatabase: CodeDatabase?
    private var sqliteChapterLoader: SQLiteChapterLoader?
    private var authoredCodeStore: AuthoredCodeStore?
    private let selectedVersionDefaultsKey = "selectedCodeVersionFileName"
    private let selectedJurisdictionDefaultsKey = "selectedJurisdictionKey"
    private var sectionsCache: [Int64: [CodeSectionSummary]] = [:]
    private var sectionGroupsCache: [Int64: [CodeSectionGroup]] = [:]
    private var sectionDetailCache: [Int64: ReaderSectionDetail] = [:]
    private var formattedTextCache: [FormattedTextCacheKey: AttributedString] = [:]
    private var chapterBodyTextCache: [FormattedTextCacheKey: AttributedString] = [:]
    private var formattedNSTextCache: [FormattedTextCacheKey: NSAttributedString] = [:]
    private var chapterBodyNSTextCache: [FormattedTextCacheKey: NSAttributedString] = [:]
    private var bookmarkedSectionIDs: Set<Int64> = []
    private var versionLoadTask: Task<Void, Never>?
    private var contentLoadTask: Task<Void, Never>?
    private var searchTask: Task<Void, Never>?

    init(
        locator: BundleDatabaseLocator = BundleDatabaseLocator(),
        formattingEngine: FormattingEngine = FormattingEngine(),
        readerThemeStore: ReaderThemeStore = ReaderThemeStore()
    ) {
        self.locator = locator
        self.formattingEngine = formattingEngine
        self.readerThemeStore = readerThemeStore
        self.readerTheme = readerThemeStore.load()
        self.userDataStore = try? UserDataStore()
        statusMessage = "Loading code library..."
        reload()
    }

    var selectedVersion: BundledCodeVersion? {
        filteredVersions.first { $0.fileName == selectedVersionFileName }
            ?? availableVersions.first { $0.fileName == selectedVersionFileName }
    }

    var filteredVersions: [BundledCodeVersion] {
        guard !selectedJurisdictionKey.isEmpty else { return availableVersions }
        return availableVersions.filter { version in
            jurisdictionKey(for: version) == selectedJurisdictionKey
        }
    }

    func reload() {
        versionLoadTask?.cancel()
        contentLoadTask?.cancel()
        statusMessage = "Loading code library..."

        versionLoadTask = Task { [selectedVersionDefaultsKey] in
            let availableVersions = await Task.detached(priority: .userInitiated) {
                BundleDatabaseLocator().availableCodeVersions()
            }.value

            guard !Task.isCancelled else { return }

            self.availableVersions = availableVersions
            self.availableJurisdictions = self.buildJurisdictions(from: availableVersions)
            let storedSelection = UserDefaults.standard.string(forKey: selectedVersionDefaultsKey)
            let storedJurisdiction = UserDefaults.standard.string(forKey: self.selectedJurisdictionDefaultsKey)
            let authoredSelection = availableVersions.first(where: { $0.contentKind == .authored })?.fileName
            let defaultJurisdictionKey = storedJurisdiction
                .flatMap { stored in
                    self.availableJurisdictions.first(where: { $0.id == stored })?.id
                }
                ?? self.availableJurisdictions.first?.id
                ?? ""
            self.selectedJurisdictionKey = defaultJurisdictionKey

            let candidateVersions = self.filteredVersions.isEmpty ? availableVersions : self.filteredVersions
            let authoredResolvedSelection: String?
            if let authoredSelection {
                authoredResolvedSelection = candidateVersions.first(where: { $0.fileName == authoredSelection })?.fileName
            } else {
                authoredResolvedSelection = nil
            }

            let storedResolvedSelection: String?
            if let storedSelection {
                storedResolvedSelection = candidateVersions.first(where: { $0.fileName == storedSelection })?.fileName
            } else {
                storedResolvedSelection = nil
            }

            let resolvedSelection = authoredResolvedSelection
                ?? storedResolvedSelection
                ?? candidateVersions.first?.fileName
                ?? availableVersions.first?.fileName
                ?? ""

            self.selectedVersionFileName = resolvedSelection
            self.openSelectedContent()
        }
    }

    func updateSelectedJurisdiction(key: String) {
        selectedJurisdictionKey = key
        UserDefaults.standard.set(key, forKey: selectedJurisdictionDefaultsKey)
        let candidateVersions = filteredVersions
        if candidateVersions.contains(where: { $0.fileName == selectedVersionFileName }) == false {
            selectedVersionFileName = candidateVersions.first?.fileName ?? ""
            UserDefaults.standard.set(selectedVersionFileName, forKey: selectedVersionDefaultsKey)
        }
        openSelectedContent()
    }

    func updateSelectedVersion(fileName: String) {
        selectedVersionFileName = fileName
        UserDefaults.standard.set(fileName, forKey: selectedVersionDefaultsKey)
        openSelectedContent()
    }

    func updateSelectedCodeSection(id: Int64?) {
        selectedCodeSectionID = id
        guard let authoredCodeStore else { return }
        codeSections = authoredCodeStore.codeSections()
        chapters = authoredCodeStore.chapters(codeSectionID: id)
    }

    func sections(for chapter: CodeChapter) -> [CodeSectionSummary] {
        if let authoredCodeStore {
            return authoredCodeStore.sections(chapterID: chapter.id)
        }
        if let cached = sectionsCache[chapter.id] {
            return cached
        }
        do {
            let loadedSections = try codeDatabase?.sections(chapterID: chapter.id) ?? []
            sectionsCache[chapter.id] = loadedSections
            return loadedSections
        } catch {
            statusMessage = error.localizedDescription
            return []
        }
    }

    func sectionGroups(for chapter: CodeChapter) -> [CodeSectionGroup] {
        if let authoredCodeStore {
            return authoredCodeStore.sectionGroups(chapterID: chapter.id)
        }
        if let cached = sectionGroupsCache[chapter.id] {
            return cached
        }
        do {
            let loadedGroups = try codeDatabase?.sectionGroups(chapterID: chapter.id) ?? []
            sectionGroupsCache[chapter.id] = loadedGroups
            return loadedGroups
        } catch {
            statusMessage = error.localizedDescription
            return []
        }
    }

    func sectionCount(for chapter: CodeChapter) -> Int {
        sections(for: chapter).count
    }

    func loadSectionDetail(sectionID: Int64) -> ReaderSectionDetail? {
        if let cached = sectionDetailCache[sectionID] {
            return cached
        }
        if let authoredCodeStore {
            let detail = authoredCodeStore.sectionDetail(sectionID: sectionID)
            if let detail {
                sectionDetailCache[sectionID] = detail
            }
            return detail
        }
        do {
            let detail = try codeDatabase?.sectionDetail(sectionID: sectionID)
            if let detail {
                sectionDetailCache[sectionID] = detail
            }
            return detail
        } catch {
            statusMessage = error.localizedDescription
            return nil
        }
    }

    func formattedText(for detail: ReaderSectionDetail) -> AttributedString {
        let cacheKey = FormattedTextCacheKey(sectionID: detail.id, theme: readerTheme)
        if let cached = formattedTextCache[cacheKey] {
            return cached
        }

        let renderedText: AttributedString
        if let richTextOverrideData = detail.richTextOverrideData,
           let richText = formattingEngine.renderRichTextOverride(
            richTextOverrideData,
            theme: readerTheme
           ) {
            renderedText = richText
        } else {
            renderedText = formattingEngine.render(officialText: detail.officialText, spans: detail.textSpans, theme: readerTheme)
        }
        formattedTextCache[cacheKey] = renderedText
        return renderedText
    }

    func chapterBodyText(for detail: ReaderSectionDetail) -> AttributedString {
        let cacheKey = FormattedTextCacheKey(sectionID: detail.id, theme: readerTheme)
        if let cached = chapterBodyTextCache[cacheKey] {
            return cached
        }

        let attributed = formattedNSAttributedText(for: detail)
        let bodyRange = Self.chapterBodyRange(for: detail, in: attributed.string as NSString)
        guard bodyRange.length > 0 else {
            return AttributedString("")
        }

        let bodyText = attributed.attributedSubstring(from: bodyRange)
        let renderedText = AttributedString(bodyText)
        chapterBodyTextCache[cacheKey] = renderedText
        return renderedText
    }

    func formattedNSText(for detail: ReaderSectionDetail) -> NSAttributedString {
        let cacheKey = FormattedTextCacheKey(sectionID: detail.id, theme: readerTheme)
        if let cached = formattedNSTextCache[cacheKey] {
            return cached
        }

        let renderedText = formattedNSAttributedText(for: detail)
        formattedNSTextCache[cacheKey] = renderedText
        return renderedText
    }

    func chapterBodyNSText(for detail: ReaderSectionDetail) -> NSAttributedString {
        let cacheKey = FormattedTextCacheKey(sectionID: detail.id, theme: readerTheme)
        if let cached = chapterBodyNSTextCache[cacheKey] {
            return cached
        }

        let attributed = formattedNSAttributedText(for: detail)
        let bodyRange = Self.chapterBodyRange(for: detail, in: attributed.string as NSString)
        let renderedText: NSAttributedString
        if bodyRange.length > 0 {
            renderedText = attributed.attributedSubstring(from: bodyRange)
        } else {
            renderedText = Self.fallbackChapterBodyText(for: detail, formattedText: attributed)
        }

        chapterBodyNSTextCache[cacheKey] = renderedText
        return renderedText
    }

    func chapterReaderBlock(
        detail: ReaderSectionDetail,
        groupLabel: String?
    ) -> ChapterReaderBlockContent {
        ChapterReaderBlockContent(
            detail: detail,
            groupLabel: groupLabel
        )
    }

    func bodyNSText(for detail: ReaderSectionDetail) -> NSAttributedString {
        chapterBodyNSText(for: detail)
    }

    func renderPlainTextBlock(_ text: String) -> NSAttributedString {
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = readerTheme.lineSpacing
        paragraphStyle.paragraphSpacing = readerTheme.paragraphSpacing

        return NSAttributedString(
            string: text,
            attributes: [
                .font: readerTheme.bodyFont,
                .foregroundColor: UIColor.label,
                .paragraphStyle: paragraphStyle
            ]
        )
    }

    func chapterBodyNSTextAsync(for detail: ReaderSectionDetail) async -> NSAttributedString {
        let cacheKey = FormattedTextCacheKey(sectionID: detail.id, theme: readerTheme)
        if let cached = chapterBodyNSTextCache[cacheKey] {
            return cached
        }

        let theme = readerTheme
        let renderedBody = await Task.detached(priority: .userInitiated) {
            Self.chapterBodyText(detail: detail, theme: theme)
        }.value
        let renderedText = NSAttributedString(renderedBody)
        chapterBodyNSTextCache[cacheKey] = renderedText
        return renderedText
    }

    func updateReaderTheme(_ theme: ReaderTheme) {
        let theme = theme.normalized
        guard readerTheme != theme else { return }
        readerTheme = theme
        formattedTextCache.removeAll()
        chapterBodyTextCache.removeAll()
        formattedNSTextCache.removeAll()
        chapterBodyNSTextCache.removeAll()
        readerThemeStore.save(theme)
    }

    func resolveReferences(for detail: ReaderSectionDetail) -> [ResolvedCodeReference] {
        if let authoredCodeStore {
            return referenceResolver.resolveReferences(in: detail.officialText, database: authoredCodeStore)
        }
        guard let codeDatabase else { return [] }
        return referenceResolver.resolveReferences(in: detail.officialText, database: codeDatabase)
    }

    func chapterBlockDescriptors(for chapter: CodeChapter) async -> [ChapterBlockDescriptor] {
        if let authoredCodeStore {
            return authoredCodeStore.sectionGroups(chapterID: chapter.id).flatMap { group in
                group.sections.enumerated().map { index, section in
                    ChapterBlockDescriptor(
                        sectionID: section.id,
                        groupLabel: index == 0 ? group.displayLabel : nil
                    )
                }
            }
        }

        if let cached = sectionGroupsCache[chapter.id] {
            return cached.flatMap { group in
                group.sections.enumerated().map { index, section in
                    ChapterBlockDescriptor(
                        sectionID: section.id,
                        groupLabel: index == 0 ? group.displayLabel : nil
                    )
                }
            }
        }

        guard let sqliteChapterLoader else { return [] }

        do {
            let groups = try await sqliteChapterLoader.sectionGroups(chapterID: chapter.id)
            sectionGroupsCache[chapter.id] = groups
            return groups.flatMap { group in
                group.sections.enumerated().map { index, section in
                    ChapterBlockDescriptor(
                        sectionID: section.id,
                        groupLabel: index == 0 ? group.displayLabel : nil
                    )
                }
            }
        } catch {
            statusMessage = error.localizedDescription
            return []
        }
    }

    func loadSectionDetailAsync(sectionID: Int64) async -> ReaderSectionDetail? {
        if let cached = sectionDetailCache[sectionID] {
            return cached
        }
        if let authoredCodeStore {
            let detail = authoredCodeStore.sectionDetail(sectionID: sectionID)
            if let detail {
                sectionDetailCache[sectionID] = detail
            }
            return detail
        }

        guard let sqliteChapterLoader else {
            return loadSectionDetail(sectionID: sectionID)
        }

        do {
            let detail = try await sqliteChapterLoader.sectionDetail(sectionID: sectionID)
            if let detail {
                sectionDetailCache[sectionID] = detail
            }
            return detail
        } catch {
            statusMessage = error.localizedDescription
            return nil
        }
    }

    func loadSectionDetailsAsync(sectionIDs: [Int64]) async -> [ReaderSectionDetail] {
        guard !sectionIDs.isEmpty else { return [] }

        if authoredCodeStore != nil {
            return await sectionIDs.asyncCompactMap { sectionID in
                await loadSectionDetailAsync(sectionID: sectionID)
            }
        }

        var orderedDetails: [Int64: ReaderSectionDetail] = [:]
        var missingIDs: [Int64] = []

        for sectionID in sectionIDs {
            if let cached = sectionDetailCache[sectionID] {
                orderedDetails[sectionID] = cached
            } else {
                missingIDs.append(sectionID)
            }
        }

        if !missingIDs.isEmpty, let sqliteChapterLoader {
            do {
                let loadedDetails = try await sqliteChapterLoader.sectionDetails(sectionIDs: missingIDs)
                for detail in loadedDetails {
                    sectionDetailCache[detail.id] = detail
                    orderedDetails[detail.id] = detail
                }
            } catch {
                statusMessage = error.localizedDescription
            }
        }

        return sectionIDs.compactMap { orderedDetails[$0] ?? sectionDetailCache[$0] }
    }

    func imageURL(fileName: String) -> URL? {
        codeDatabase?.imageURL(fileName: fileName)
    }

    func search(query: String) {
        searchTask?.cancel()
        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedQuery.isEmpty else {
            searchResults = []
            return
        }

        if let authoredCodeStore {
            searchTask = Task {
                let results = await Task.detached(priority: .userInitiated) {
                    authoredCodeStore.search(query: trimmedQuery)
                }.value
                guard !Task.isCancelled else { return }
                searchResults = results
            }
            return
        }

        do {
            searchResults = try codeDatabase?.search(query: trimmedQuery) ?? []
        } catch {
            statusMessage = error.localizedDescription
            searchResults = []
        }
    }

    func refreshBookmarks() {
        guard let selectedVersion, let userDataStore else {
            bookmarks = []
            return
        }

        do {
            let ids = try userDataStore.bookmarkedSectionIDs(codeVersion: selectedVersion.codeVersion)
            bookmarkedSectionIDs = Set(ids)
            if let authoredCodeStore {
                bookmarks = authoredCodeStore.bookmarkedSections(ids: ids, codeVersion: selectedVersion.codeVersion)
            } else {
                bookmarks = try codeDatabase?.bookmarkedSections(ids: ids, codeVersion: selectedVersion.codeVersion) ?? []
            }
        } catch {
            statusMessage = error.localizedDescription
            bookmarkedSectionIDs = []
            bookmarks = []
        }
    }

    func toggleBookmark(sectionID: Int64) {
        guard let selectedVersion, let userDataStore else { return }
        do {
            try userDataStore.toggleBookmark(sectionID: sectionID, codeVersion: selectedVersion.codeVersion)
            refreshBookmarks()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func isBookmarked(sectionID: Int64) -> Bool {
        guard selectedVersion != nil, userDataStore != nil else { return false }
        return bookmarkedSectionIDs.contains(sectionID)
    }

    func noteBody(sectionID: Int64) -> String {
        guard let selectedVersion, let userDataStore else { return "" }
        return (try? userDataStore.noteBody(sectionID: sectionID, codeVersion: selectedVersion.codeVersion)) ?? ""
    }

    func saveNote(sectionID: Int64, body: String) {
        guard let selectedVersion, let userDataStore else { return }
        do {
            try userDataStore.saveNote(sectionID: sectionID, codeVersion: selectedVersion.codeVersion, body: body)
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func openSelectedContent() {
        contentLoadTask?.cancel()
        clearCaches()
        guard let selectedVersion else {
            codeSections = []
            selectedCodeSectionID = nil
            chapters = []
            searchResults = []
            bookmarks = []
            codeDatabase = nil
            authoredCodeStore = nil
            statusMessage = "Bundle authored content or a generated SQLite database to browse code content."
            return
        }

        searchResults = []
        bookmarks = []
        statusMessage = "Loading \(selectedVersion.displayName)..."

        switch selectedVersion.contentKind {
        case .sqlite:
            do {
                authoredCodeStore = nil
                codeSections = []
                selectedCodeSectionID = nil
                codeDatabase = try CodeDatabase(databaseURL: selectedVersion.fileURL, locator: locator)
                sqliteChapterLoader = try SQLiteChapterLoader(databaseURL: selectedVersion.fileURL)
                chapters = try codeDatabase?.chapters() ?? []
                refreshBookmarks()
                statusMessage = nil
            } catch {
                codeSections = []
                selectedCodeSectionID = nil
                chapters = []
                searchResults = []
                bookmarks = []
                codeDatabase = nil
                sqliteChapterLoader = nil
                authoredCodeStore = nil
                statusMessage = error.localizedDescription
            }
        case .authored:
            let selectedCodeSectionID = self.selectedCodeSectionID
            contentLoadTask = Task {
                do {
                    let snapshot = try await Task.detached(priority: .userInitiated) {
                        try Self.loadAuthoredContentSnapshot(
                            version: selectedVersion,
                            selectedCodeSectionID: selectedCodeSectionID
                        )
                    }.value
                    guard !Task.isCancelled else { return }

                    self.codeDatabase = nil
                    self.sqliteChapterLoader = nil
                    self.authoredCodeStore = snapshot.store
                    self.codeSections = snapshot.codeSections
                    self.selectedCodeSectionID = snapshot.resolvedCodeSectionID
                    self.chapters = snapshot.chapters
                    self.searchResults = []
                    self.refreshBookmarks()
                    self.statusMessage = nil
                } catch {
                    guard !Task.isCancelled else { return }
                    self.codeSections = []
                    self.selectedCodeSectionID = nil
                    self.chapters = []
                    self.searchResults = []
                    self.bookmarks = []
                    self.codeDatabase = nil
                    self.sqliteChapterLoader = nil
                    self.authoredCodeStore = nil
                    self.statusMessage = error.localizedDescription
                }
            }
        }
    }

    private nonisolated static func loadAuthoredContentSnapshot(
        version: BundledCodeVersion,
        selectedCodeSectionID: Int64?
    ) throws -> AuthoredContentSnapshot {
        let store = try AuthoredCodeStore(
            jsonURL: version.fileURL,
            codeID: version.authoredCodeID,
            jurisdictionID: version.jurisdictionID
        )
        let availableCodeSections = store.codeSections()
        let resolvedCodeSectionID = availableCodeSections.contains(where: { $0.id == selectedCodeSectionID })
            ? selectedCodeSectionID
            : availableCodeSections.first?.id
        let chapters = store.chapters(codeSectionID: resolvedCodeSectionID)
        return AuthoredContentSnapshot(
            store: store,
            codeSections: availableCodeSections,
            resolvedCodeSectionID: resolvedCodeSectionID,
            chapters: chapters
        )
    }

    private func formattedNSAttributedText(for detail: ReaderSectionDetail) -> NSAttributedString {
        NSAttributedString(Self.formattedText(detail: detail, theme: readerTheme))
    }

    private nonisolated static func chapterBodyText(detail: ReaderSectionDetail, theme: ReaderTheme) -> AttributedString {
        let formatted = formattedText(detail: detail, theme: theme)
        let attributed = NSAttributedString(formatted)
        let bodyRange = chapterBodyRange(for: detail, in: attributed.string as NSString)

        guard bodyRange.length > 0 else {
            return AttributedString(fallbackChapterBodyText(for: detail, formattedText: attributed))
        }

        return AttributedString(attributed.attributedSubstring(from: bodyRange))
    }

    private nonisolated static func formattedText(detail: ReaderSectionDetail, theme: ReaderTheme) -> AttributedString {
        let formattingEngine = FormattingEngine()
        if let richTextOverrideData = detail.richTextOverrideData,
           let richText = formattingEngine.renderRichTextOverride(
            richTextOverrideData,
            theme: theme
           ) {
            return richText
        }

        return formattingEngine.render(
            officialText: detail.officialText,
            spans: detail.textSpans,
            theme: theme
        )
    }

    private nonisolated static func chapterBodyRange(for detail: ReaderSectionDetail, in text: NSString) -> NSRange {
        guard text.length > 0 else {
            return NSRange(location: 0, length: 0)
        }

        var location = 0

        while location < text.length {
            let lineRange = text.lineRange(for: NSRange(location: location, length: 0))
            let trimmedLine = trimmedLine(for: lineRange, in: text)

            if trimmedLine.isEmpty || isSectionMetadataLine(trimmedLine) {
                location = lineRange.location + lineRange.length
                continue
            }

            if isNumberedTitleLine(trimmedLine, detail: detail) {
                location = lineRange.location + lineRange.length
                continue
            }

            break
        }

        while location < text.length {
            let character = text.substring(with: NSRange(location: location, length: 1))
            if character.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                location += 1
            } else {
                break
            }
        }

        return NSRange(location: location, length: max(text.length - location, 0))
    }

    private nonisolated static func trimmedLine(for lineRange: NSRange, in text: NSString) -> String {
        var contentLength = lineRange.length

        while contentLength > 0 {
            let lastCharacterRange = NSRange(location: lineRange.location + contentLength - 1, length: 1)
            let character = text.substring(with: lastCharacterRange)
            if character == "\n" || character == "\r" {
                contentLength -= 1
            } else {
                break
            }
        }

        guard contentLength > 0 else { return "" }
        let contentRange = NSRange(location: lineRange.location, length: contentLength)
        return text.substring(with: contentRange).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private nonisolated static func isSectionMetadataLine(_ line: String) -> Bool {
        let normalized = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return false }
        if normalized.uppercased().hasPrefix("SECTION BC") {
            return true
        }

        let punctuationTrimmed = normalized.trimmingCharacters(in: CharacterSet(charactersIn: ".:;-"))
        let hasLetters = punctuationTrimmed.unicodeScalars.contains { CharacterSet.letters.contains($0) }
        return hasLetters && punctuationTrimmed == punctuationTrimmed.uppercased() && !punctuationTrimmed.contains(".")
    }

    private nonisolated static func isNumberedTitleLine(_ line: String, detail: ReaderSectionDetail) -> Bool {
        let normalized = normalizedTitleLine(line)
        let expected = normalizedTitleLine("\(detail.sectionNumber) \(detail.displayTitle)")
        return normalized == expected
    }

    private nonisolated static func normalizedTitleLine(_ line: String) -> String {
        line
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;-"))
            .lowercased()
    }

    private nonisolated static func fallbackChapterBodyText(
        for detail: ReaderSectionDetail,
        formattedText: NSAttributedString
    ) -> NSAttributedString {
        if detail.kind == .textBlock || !detail.contentBlocks.isEmpty {
            return formattedText
        }

        let trimmedText = formattedText.string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else {
            return NSAttributedString(string: "")
        }

        return formattedText
    }

    private func clearCaches() {
        sectionsCache.removeAll()
        sectionGroupsCache.removeAll()
        sectionDetailCache.removeAll()
        formattedTextCache.removeAll()
        chapterBodyTextCache.removeAll()
        formattedNSTextCache.removeAll()
        chapterBodyNSTextCache.removeAll()
        bookmarkedSectionIDs.removeAll()
        searchTask?.cancel()
    }

    private func buildJurisdictions(from versions: [BundledCodeVersion]) -> [BundledJurisdiction] {
        let grouped = Dictionary(grouping: versions) { jurisdictionKey(for: $0) }
        return grouped.keys.sorted().compactMap { key in
            guard let sample = grouped[key]?.first else { return nil }
            return BundledJurisdiction(
                id: key,
                jurisdictionID: sample.jurisdictionID,
                name: sample.jurisdictionName ?? "Bundled Content"
            )
        }
    }

    private func jurisdictionKey(for version: BundledCodeVersion) -> String {
        if let jurisdictionID = version.jurisdictionID {
            return "jurisdiction-\(jurisdictionID)"
        }
        return "legacy-\(version.contentKind.rawValue)"
    }
}

private actor SQLiteChapterLoader {
    private let database: CodeDatabase

    init(databaseURL: URL) throws {
        self.database = try CodeDatabase(databaseURL: databaseURL, locator: BundleDatabaseLocator())
    }

    func sectionGroups(chapterID: Int64) throws -> [CodeSectionGroup] {
        try database.sectionGroups(chapterID: chapterID)
    }

    func sectionDetail(sectionID: Int64) throws -> ReaderSectionDetail? {
        try database.sectionDetail(sectionID: sectionID)
    }

    func sectionDetails(sectionIDs: [Int64]) throws -> [ReaderSectionDetail] {
        try sectionIDs.compactMap { sectionID in
            try database.sectionDetail(sectionID: sectionID)
        }
    }
}

private extension Array {
    func asyncCompactMap<T>(
        _ transform: (Element) async -> T?
    ) async -> [T] {
        var results: [T] = []
        results.reserveCapacity(count)

        for element in self {
            if let transformed = await transform(element) {
                results.append(transformed)
            }
        }

        return results
    }
}
