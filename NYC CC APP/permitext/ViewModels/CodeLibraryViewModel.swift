import Foundation
import AuthenticationServices
import os.signpost
import Security
import SwiftUI

@MainActor
final class CodeLibraryViewModel: ObservableObject {
    private struct AuthoredContentSnapshot: Sendable {
        let store: AuthoredCodeStore
        let codeSections: [CodeSectionCategory]
        let resolvedCodeSectionID: Int64?
        let chapters: [CodeChapter]
    }

    private struct SQLiteContentSnapshot: Sendable {
        let database: CodeDatabase
        let loader: SQLiteChapterLoader
        let chapters: [CodeChapter]
    }

    struct ChapterBlockDescriptor: Identifiable, Sendable {
        let sectionID: Int64
        let groupLabel: String?

        var id: Int64 { sectionID }
    }

    struct ChapterReaderBlockSummary: Identifiable, Hashable {
        let id: Int64
        let sectionNumber: String
        let title: String
        let displayTitle: String
        let kind: CodeSectionKind
        let groupLabel: String?
    }

    @Published private(set) var availableVersions: [BundledCodeVersion] = []
    @Published private(set) var availableJurisdictions: [BundledJurisdiction] = []
    @Published private(set) var codeSections: [CodeSectionCategory] = []
    @Published private(set) var chapters: [CodeChapter] = []
    @Published private(set) var searchResults: [CodeSearchResult] = []
    @Published private(set) var recentSearches: [String] = []
    @Published private(set) var pinnedSearches: [String] = []
    @Published private(set) var recentlyViewedSections: [RecentlyViewedEntry] = []
    @Published private(set) var searchTabRetapCount = 0
    @Published private(set) var bookmarks: [BookmarkedSection] = []
    @Published private(set) var exportState: BookmarkExportState = .idle
    @Published private(set) var folders: [CodeFolder] = []
    @Published private(set) var activeProjectID: Int64?
    @Published private(set) var currentPlan: AppPlan
    @Published private(set) var currentEntitlementSource: EntitlementSource
    @Published private(set) var entitlementPrompt: EntitlementRequirement?
    @Published private(set) var signedInAccount: SignedInAccount?
    @Published private(set) var isAccountBusy = false
    @Published private(set) var pendingUserContentSyncCount = 0
    @Published private(set) var proProductDisplayPrice: String?
    @Published private(set) var storeKitLoadedProductIDs: [String] = []
    @Published private(set) var storeKitDebugSummary: String = "not checked"
    @Published private(set) var isStoreKitBusy = false
    /// sectionID → ordered list of folderIDs containing that section. Cached
    /// up front so the Reader and Saved screens don't make per-section DB
    /// round trips when rendering the Projects row.
    @Published private(set) var folderMembership: [Int64: [Int64]] = [:]
    @Published var selectedVersionFileName: String = ""
    @Published var selectedJurisdictionKey: String = ""
    @Published var selectedCodeSectionID: Int64?
    @Published var statusMessage: String?
    @Published var readerTheme: ReaderTheme
    @Published private(set) var isInitialContentLoaded: Bool = false
    @Published private(set) var initialLoadProgress: Double = 0
    @Published var comparisonModeEnabled: Bool
    @Published var selectedTab: AppTab = .browse
    @Published var browserTabSwitchRequest: BrowserContextID?

    private let locator: BundleDatabaseLocator
    private let formattingEngine: FormattingEngine
    private let referenceResolver = CodeReferenceResolver()
    private let userContentRepository: UserContentRepository?
    private let syncEngine: UserContentSyncEngine
    private let continuityStore: ContinuityStore
    private let readerThemeStore: ReaderThemeStore
    private let entitlementService: EntitlementService
    private let lifetimeGrantLookupClient: LifetimeGrantLookupClient
    private let accountBackendClient: AccountBackendClient
    private let storeKitSubscriptionService = StoreKitSubscriptionService()
    private let recentSearchesDefaultsKey = "recentSearches"
    private let pinnedSearchesDefaultsKey = "pinnedSearches"
    private let recentlyViewedSectionsDefaultsKey = "recentlyViewedSections"
    private var codeDatabase: CodeDatabase?
    private var sqliteChapterLoader: SQLiteChapterLoader?
    private var authoredCodeStore: AuthoredCodeStore?
    private let selectedVersionDefaultsKey = "selectedCodeVersionFileName"
    private let selectedJurisdictionDefaultsKey = "selectedJurisdictionKey"
    private let selectedCodeSectionDefaultsKey = "selectedCodeSectionID"
    private let lastOpenedChapterIDDefaultsKey = "lastOpenedChapterID"
    private let comparisonModeDefaultsKey = "comparisonModeEnabled"
    private var lastChapterPreloadTask: Task<Void, Never>?
    private var codeSectionWarmupTask: Task<Void, Never>?
    private var chapterWarmupTasks: [Int64: Task<Void, Never>] = [:]
    private var warmedChapterIDs: Set<Int64> = []
    private var sectionsCache: [Int64: [CodeSectionSummary]] = [:]
    private var sectionGroupsCache: [Int64: [CodeSectionGroup]] = [:]
    private let sectionDetailCache: NSCache<NSNumber, CachedReaderSectionDetail> = {
        let cache = NSCache<NSNumber, CachedReaderSectionDetail>()
        cache.countLimit = 192
        cache.totalCostLimit = 24 * 1024 * 1024
        return cache
    }()
    private let formattedNSTextCache: NSCache<NSString, NSAttributedString> = {
        let cache = NSCache<NSString, NSAttributedString>()
        cache.countLimit = 192
        cache.totalCostLimit = 16 * 1024 * 1024
        return cache
    }()
    private let chapterBodyNSTextCache: NSCache<NSString, NSAttributedString> = {
        let cache = NSCache<NSString, NSAttributedString>()
        cache.countLimit = 192
        cache.totalCostLimit = 16 * 1024 * 1024
        return cache
    }()
    private var bookmarkedSectionIDs: Set<Int64> = []
    private var versionLoadTask: Task<Void, Never>?
    private var contentLoadTask: Task<Void, Never>?
    private var searchTask: Task<Void, Never>?
    // Tracks the active inner search task so it can be cancelled independently
    // when a new search starts. Without this, Task.detached bodies accumulate
    // concurrently because cancelling the outer Task does not propagate to a
    // detached child.
    private var activeSearchWorkTask: Task<[CodeSearchResult], Never>?
    private var activeExportTask: Task<Void, Never>?
    private var userContentAutoSyncTask: Task<Void, Never>?
    private var storeKitUpdatesTask: Task<Void, Never>?
    private var didRunStartupAccountSync = false
    /// Monotonic token used to suppress stale tab re-assertions after a
    /// comparison-mode toggle. See `setComparisonMode(enabled:keeping:)`.
    private var pendingTabAssertionToken: Int = 0
    @Published private(set) var bookmarkRevision: Int = 0
    @Published private(set) var userContentSyncCheckpoint: UserContentSyncCheckpoint?

    init(
        locator: BundleDatabaseLocator = BundleDatabaseLocator(),
        formattingEngine: FormattingEngine = FormattingEngine(),
        userContentRepository: UserContentRepository? = nil,
        continuityStore: ContinuityStore = .shared,
        readerThemeStore: ReaderThemeStore = ReaderThemeStore(),
        entitlementService: EntitlementService = LocalEntitlementService(),
        lifetimeGrantLookupClient: LifetimeGrantLookupClient = LocalLifetimeGrantLookupClient(),
        accountBackendClient: AccountBackendClient = PermitextBackendFactory.makeClient(),
        syncBackend: UserContentSyncBackend? = nil,
        loadsInitialContent: Bool = true
    ) {
        self.locator = locator
        self.formattingEngine = formattingEngine
        self.userContentRepository = userContentRepository ?? (try? UserDataStore())
        self.syncEngine = UserContentSyncEngine(
            repository: self.userContentRepository,
            backend: syncBackend ?? (accountBackendClient as? UserContentSyncBackend) ?? NoOpUserContentSyncBackend(),
            continuityStore: continuityStore
        )
        self.continuityStore = continuityStore
        self.readerThemeStore = readerThemeStore
        self.entitlementService = entitlementService
        self.lifetimeGrantLookupClient = lifetimeGrantLookupClient
        self.accountBackendClient = accountBackendClient
        self.currentPlan = entitlementService.currentPlan
        self.currentEntitlementSource = entitlementService.currentEntitlement.source
        let loadedSignedInAccount = Self.loadSignedInAccount()
        self.signedInAccount = loadedSignedInAccount
        self.userContentSyncCheckpoint = syncEngine.checkpoint(account: loadedSignedInAccount)
        self.readerTheme = readerThemeStore.load()
        self.recentSearches = Self.loadRecentSearches()
        self.pinnedSearches = Self.loadPinnedSearches()
        let continuityContext = continuityStore.load()
        self.recentlyViewedSections = continuityContext.recentlyViewedSections
        self.activeProjectID = continuityContext.activeProjectID
        self.comparisonModeEnabled = continuityContext.comparisonModeEnabled
        refreshPendingUserContentSyncCount()
        statusMessage = "Loading code library..."
        isInitialContentLoaded = false
        initialLoadProgress = 0
        #if DEBUG
        runStartupDiagnostics()
        #endif
        if loadsInitialContent {
            reload()
        }
    }

    deinit {
        storeKitUpdatesTask?.cancel()
    }

    #if DEBUG
    static func preview() -> CodeLibraryViewModel {
        let model = CodeLibraryViewModel(loadsInitialContent: false)
        let version = BundledCodeVersion(
            fileName: "preview-authored-content",
            fileURL: URL(fileURLWithPath: "/dev/null"),
            codeVersion: "2022 Construction Codes",
            contentKind: .authored,
            authoredCodeID: 1,
            jurisdictionID: 1,
            jurisdictionName: "New York City",
            authoredHTMLBundlePath: nil
        )
        let buildingSectionID: Int64 = 1
        let plumbingSectionID: Int64 = 2

        model.availableVersions = [version]
        model.availableJurisdictions = [
            BundledJurisdiction(id: "new-york-city", jurisdictionID: 1, name: "New York City")
        ]
        model.codeSections = [
            CodeSectionCategory(id: buildingSectionID, codeID: 1, name: "Building Code"),
            CodeSectionCategory(id: plumbingSectionID, codeID: 1, name: "Plumbing Code")
        ]
        model.chapters = [
            CodeChapter(id: 101, codeSectionID: buildingSectionID, chapterNumber: "1", title: "Administration"),
            CodeChapter(id: 102, codeSectionID: buildingSectionID, chapterNumber: "3", title: "Occupancy Classification and Use"),
            CodeChapter(id: 103, codeSectionID: buildingSectionID, chapterNumber: "5", title: "General Building Heights and Areas"),
            CodeChapter(id: 201, codeSectionID: plumbingSectionID, chapterNumber: "1", title: "Administration"),
            CodeChapter(id: 202, codeSectionID: plumbingSectionID, chapterNumber: "6", title: "Water Supply and Distribution")
        ]
        model.selectedVersionFileName = version.fileName
        model.selectedJurisdictionKey = "new-york-city"
        model.selectedCodeSectionID = buildingSectionID
        model.statusMessage = nil
        model.initialLoadProgress = 1
        model.isInitialContentLoaded = true
        return model
    }
    #endif

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

    func chapters(for codeSectionID: Int64?) -> [CodeChapter] {
        if let authoredCodeStore {
            return authoredCodeStore.chapters(codeSectionID: codeSectionID)
        }

        guard let codeSectionID else { return chapters }
        return chapters.filter { $0.codeSectionID == codeSectionID }
    }

    func reload() {
        versionLoadTask?.cancel()
        contentLoadTask?.cancel()
        statusMessage = "Loading code library..."
        isInitialContentLoaded = false
        initialLoadProgress = 0

        versionLoadTask = Task {
            let availableVersions = await Task.detached(priority: .userInitiated) {
                BundleDatabaseLocator().availableCodeVersions()
            }.value

            guard !Task.isCancelled else { return }

            self.availableVersions = availableVersions
            self.availableJurisdictions = self.buildJurisdictions(from: availableVersions)
            let continuityContext = self.continuityStore.load()
            let storedSelection = continuityContext.selectedVersionFileName.isEmpty ? nil : continuityContext.selectedVersionFileName
            let storedJurisdiction = continuityContext.selectedJurisdictionKey.isEmpty ? nil : continuityContext.selectedJurisdictionKey
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
            self.persistContinuityContext()
            self.openSelectedContent()
        }
    }

    func updateSelectedJurisdiction(key: String) {
        selectedJurisdictionKey = key
        let candidateVersions = filteredVersions
        if candidateVersions.contains(where: { $0.fileName == selectedVersionFileName }) == false {
            selectedVersionFileName = candidateVersions.first?.fileName ?? ""
        }
        persistContinuityContext()
        openSelectedContent()
    }

    func updateSelectedVersion(fileName: String) {
        selectedVersionFileName = fileName
        persistContinuityContext()
        openSelectedContent()
    }

    // MARK: - Idle preload of last-opened chapter

    func noteChapterOpened(chapter: CodeChapter) {
        persistContinuityContext(lastOpenedChapterID: chapter.id)
        // The chapter is already being opened, so a pending idle preload is stale.
        lastChapterPreloadTask?.cancel()
    }

    func noteSectionOpened(_ detail: ReaderSectionDetail) {
        recordRecentlyViewed(
            RecentlyViewedEntry(
                sectionID: detail.id,
                sectionNumber: detail.sectionNumber,
                title: detail.displayTitle,
                chapterTitle: detail.chapterTitle,
                codeSectionID: detail.codeSectionID,
                codeSectionName: codeSectionName(id: detail.codeSectionID),
                previewText: sectionPreviewSnippet(from: detail.officialText),
                viewedAt: Date()
            )
        )
    }

    func noteSectionOpened(anchor: PublishedHTMLAnchor, chapter: CodeChapter) {
        guard let summary = sectionSummary(sectionNumber: anchor.sectionNumber, codeSectionID: chapter.codeSectionID) else { return }
        let lightweightPreview = anchor.title.isEmpty ? anchor.displayLabel : anchor.title
        recordRecentlyViewed(
            RecentlyViewedEntry(
                sectionID: summary.id,
                sectionNumber: summary.sectionNumber,
                title: summary.displayTitle,
                chapterTitle: chapter.title,
                codeSectionID: chapter.codeSectionID,
                codeSectionName: codeSectionName(id: chapter.codeSectionID),
                previewText: sectionPreviewSnippet(from: lightweightPreview),
                viewedAt: Date()
            )
        )
    }

    func noteProjectOpened(_ folderID: Int64) {
        guard activeProjectID != folderID else { return }
        activeProjectID = folderID
        persistContinuityContext()
    }

    func clearActiveProject(ifMatches folderID: Int64? = nil) {
        if let folderID, activeProjectID != folderID {
            return
        }
        guard activeProjectID != nil else { return }
        activeProjectID = nil
        persistContinuityContext()
    }

    func sectionPreviewSnippet(from officialText: String) -> String {
        let normalized = officialText
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return "" }

        let limit = 120
        if normalized.count <= limit {
            return normalized
        }
        let end = normalized.index(normalized.startIndex, offsetBy: limit)
        return String(normalized[..<end]).trimmingCharacters(in: .whitespacesAndNewlines) + "…"
    }

    private func recordRecentlyViewed(_ entry: RecentlyViewedEntry) {
        var updated = recentlyViewedSections.filter { $0.sectionID != entry.sectionID }
        updated.insert(entry, at: 0)
        recentlyViewedSections = Array(updated.prefix(20))
        persistRecentlyViewedSections()
    }

    private func persistRecentlyViewedSections() {
        persistContinuityContext()
    }

    private func persistContinuityContext(lastOpenedChapterID: Int64? = nil) {
        continuityStore.update { context in
            context.selectedJurisdictionKey = selectedJurisdictionKey
            context.selectedVersionFileName = selectedVersionFileName
            context.selectedCodeSectionID = selectedCodeSectionID
            if let lastOpenedChapterID {
                context.lastOpenedChapterID = lastOpenedChapterID
            }
            context.activeProjectID = activeProjectID
            context.comparisonModeEnabled = comparisonModeEnabled
            context.recentlyViewedSections = recentlyViewedSections
        }
        queueContinuityContextForSync()
    }

    private func queueContinuityContextForSync() {
        let context = continuityStore.load()
        do {
            try userContentRepository?.queueContinuityContext(
                codeVersion: context.selectedVersionFileName,
                values: continuitySyncValues(from: context)
            )
        } catch {
            #if DEBUG
            print("permitext diagnostics: continuity sync queue failed: \(error.localizedDescription)")
            #endif
        }
    }

    private func continuitySyncValues(from context: ContinuityContext) -> [String: String] {
        var values: [String: String] = [
            "selectedJurisdictionKey": context.selectedJurisdictionKey,
            "selectedVersionFileName": context.selectedVersionFileName,
            "comparisonModeEnabled": context.comparisonModeEnabled ? "true" : "false"
        ]
        if let selectedCodeSectionID = context.selectedCodeSectionID {
            values["selectedCodeSectionID"] = String(selectedCodeSectionID)
        }
        if let lastOpenedChapterID = context.lastOpenedChapterID {
            values["lastOpenedChapterID"] = String(lastOpenedChapterID)
        }
        if let activeProjectID = context.activeProjectID {
            values["activeProjectID"] = String(activeProjectID)
        }
        if let data = try? JSONEncoder().encode(context.recentlyViewedSections),
           let json = String(data: data, encoding: .utf8) {
            values["recentlyViewedSectionsJSON"] = json
        }
        return values
    }

    private func refreshContinuityStateFromStore() {
        let context = continuityStore.load()
        let shouldReloadContent =
            selectedJurisdictionKey != context.selectedJurisdictionKey ||
            selectedVersionFileName != context.selectedVersionFileName

        selectedJurisdictionKey = context.selectedJurisdictionKey
        selectedVersionFileName = context.selectedVersionFileName
        selectedCodeSectionID = context.selectedCodeSectionID
        activeProjectID = context.activeProjectID
        comparisonModeEnabled = context.comparisonModeEnabled
        recentlyViewedSections = context.recentlyViewedSections

        if !comparisonModeEnabled {
            BrowserContextID.persistCodeSectionID(context.selectedCodeSectionID, for: .primary)
        }
        if shouldReloadContent {
            openSelectedContent()
        }
    }

    #if DEBUG
    private func runStartupDiagnostics() {
        var messages = continuityStore.debugValidationMessages()
        if let userDataStore = userContentRepository as? UserDataStore {
            do {
                messages.append(contentsOf: try userDataStore.debugSchemaValidationMessages())
                messages.append(contentsOf: try userDataStore.debugSyncQueueLifecycleValidationMessages())
            } catch {
                messages.append("UserDataStore schema validation failed: \(error.localizedDescription)")
            }
        }
        do {
            let report = try syncEngine.previewPendingWork(limit: 25)
            if report.pendingCount > 0 {
                messages.append("Sync queue pending items: \(report.pendingCount) via \(report.backendName)")
            }
        } catch {
            messages.append("Sync queue preview failed: \(error.localizedDescription)")
        }

        if messages.isEmpty {
            print("permitext diagnostics: startup validation passed")
        } else {
            print("permitext diagnostics: " + messages.joined(separator: " | "))
        }
    }
    #endif

    private static func loadRecentlyViewedSections() -> [RecentlyViewedEntry] {
        ContinuityStore.shared.load().recentlyViewedSections
    }

    private func preloadLastOpenedChapterIfNeeded() {
        let storedID = continuityStore.load().lastOpenedChapterID
        guard let chapterID = storedID else { return }
        guard let chapter = chapters.first(where: { $0.id == chapterID }) else { return }

        lastChapterPreloadTask?.cancel()
        lastChapterPreloadTask = Task { [weak self] in
            // Small delay so this does not compete with the first interaction.
            try? await Task.sleep(nanoseconds: 600_000_000)
            guard !Task.isCancelled, let self else { return }
            await self.warmChapterReaderEntry(chapter: chapter, sectionLimit: 8)
        }
    }

    func prewarmCodeSectionForBrowsing(id codeSectionID: Int64?) {
        let targetChapters = chapters(for: codeSectionID)
        guard !targetChapters.isEmpty else { return }

        codeSectionWarmupTask?.cancel()
        codeSectionWarmupTask = Task { [weak self] in
            guard let self else { return }
            for chapter in targetChapters.prefix(4) {
                if Task.isCancelled { return }
                await self.warmChapterReaderEntry(chapter: chapter, sectionLimit: 6)
                await Task.yield()
            }
        }
    }

    func prewarmChapterForBrowsing(_ chapter: CodeChapter) {
        guard warmedChapterIDs.contains(chapter.id) == false,
              chapterWarmupTasks[chapter.id] == nil
        else {
            return
        }

        chapterWarmupTasks[chapter.id] = Task { [weak self] in
            guard let self else { return }
            await self.warmChapterReaderEntry(chapter: chapter, sectionLimit: 6)
            guard !Task.isCancelled else { return }
            self.warmedChapterIDs.insert(chapter.id)
            self.chapterWarmupTasks[chapter.id] = nil
        }
    }

    func prewarmChapterForOpening(_ chapter: CodeChapter) {
        guard warmedChapterIDs.contains(chapter.id) == false else { return }

        chapterWarmupTasks[chapter.id]?.cancel()
        chapterWarmupTasks[chapter.id] = Task { [weak self] in
            guard let self else { return }
            await self.warmChapterReaderEntry(chapter: chapter, sectionLimit: 10)
            guard !Task.isCancelled else { return }
            self.warmedChapterIDs.insert(chapter.id)
            self.chapterWarmupTasks[chapter.id] = nil
        }
    }

    func updateSelectedCodeSection(id: Int64?) {
        selectedCodeSectionID = id
        persistContinuityContext()
        // Keep the primary browser context in sync so BrowseView always opens
        // on the section chosen here when comparison mode is off.
        if !comparisonModeEnabled {
            BrowserContextID.persistCodeSectionID(id, for: .primary)
        }
        guard let authoredCodeStore else { return }
        codeSections = Self.sortedCodeSections(authoredCodeStore.codeSections())
        chapters = authoredCodeStore.chapters(codeSectionID: id)
        searchResults = []
        prewarmCodeSectionForBrowsing(id: id)
    }

    func updateComparisonMode(enabled: Bool) {
        setComparisonMode(enabled: enabled)
    }

    func setComparisonMode(enabled: Bool, keeping tab: AppTab? = nil) {
        let tabToKeep = tab ?? selectedTab
        comparisonModeEnabled = enabled
        persistContinuityContext()
        selectedTab = tabToKeep

        // Inserting/removing the secondary browse tab can leave UIKit on a
        // stale index for one layout pass. Re-assert after a frame, but use a
        // token so a user tap during that window cancels the re-assertion
        // instead of snapping the tab back.
        pendingTabAssertionToken &+= 1
        let token = pendingTabAssertionToken
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(16))
            guard token == self.pendingTabAssertionToken else { return }
            if self.selectedTab != tabToKeep {
                self.selectedTab = tabToKeep
            }
        }
    }

    func requestBrowserTabSwitch(to context: BrowserContextID) {
        browserTabSwitchRequest = context
    }

    func syncSelectedCodeSection(from context: BrowserContextID) {
        let codeSectionID: Int64?
        if let stored = BrowserContextID.storedCodeSectionID(for: context) {
            codeSectionID = stored
        } else if context == .primary {
            codeSectionID = selectedCodeSectionID
        } else {
            // First time the secondary browser appears (comparison mode just
            // enabled): default it to a *different* code section than primary
            // so the two browsers immediately show distinct content. Falls
            // back to the primary selection if only one section exists.
            codeSectionID = defaultSecondaryCodeSectionID()
            BrowserContextID.persistCodeSectionID(codeSectionID, for: .secondary)
        }
        updateSelectedCodeSection(id: codeSectionID)
    }

    /// Picks a code section for the secondary browser that's different from
    /// the primary when possible. Honors the canonical sort order so the
    /// "next" section is predictable (e.g. primary on Building → secondary
    /// on Fuel Gas).
    private func defaultSecondaryCodeSectionID() -> Int64? {
        let ordered = Self.sortedCodeSections(codeSections)
        guard !ordered.isEmpty else { return nil }
        guard let primaryID = selectedCodeSectionID,
              let primaryIndex = ordered.firstIndex(where: { $0.id == primaryID })
        else {
            return ordered.first?.id
        }
        let nextIndex = (primaryIndex + 1) % ordered.count
        return ordered[nextIndex].id
    }

    func codeSectionName(id: Int64?) -> String {
        guard let id,
              let codeSection = codeSections.first(where: { $0.id == id })
        else {
            return "All Sections"
        }
        return Self.displayName(forCodeSectionName: codeSection.name)
    }

    static func displayName(forCodeSectionName name: String) -> String {
        displayName(forLibraryName: name)
    }

    /// Canonical display order for code sections everywhere they appear in a
    /// list. Names not in this table fall back to alphabetical order at the
    /// end. Matching is case-insensitive and tolerates "Code"/"Codes" suffixes
    /// or jurisdiction prefixes (e.g. "NYC Building Code").
    nonisolated private static let codeSectionOrderKeywords: [String] = [
        "general administrative",
        "building",
        "fuel gas",
        "mechanical",
        "plumbing"
    ]

    nonisolated static func codeSectionOrderRank(forName name: String) -> Int {
        let lowered = name.lowercased()
        for (index, keyword) in codeSectionOrderKeywords.enumerated() {
            if lowered.contains(keyword) { return index }
        }
        return Int.max
    }

    nonisolated static func sortedCodeSections(_ sections: [CodeSectionCategory]) -> [CodeSectionCategory] {
        sections.sorted { lhs, rhs in
            let lhsRank = codeSectionOrderRank(forName: lhs.name)
            let rhsRank = codeSectionOrderRank(forName: rhs.name)
            if lhsRank != rhsRank { return lhsRank < rhsRank }
            return lhs.name.localizedStandardCompare(rhs.name) == .orderedAscending
        }
    }

    static func displayName(forLibraryName name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return name }
        if trimmed == trimmed.uppercased() {
            return trimmed.localizedCapitalized
        }
        return trimmed
    }

    func accentColor(for codeSectionID: Int64? = nil) -> PlatformColor {
        let resolvedSectionID = codeSectionID ?? selectedCodeSectionID
        let codeSectionName = codeSections
            .first(where: { $0.id == resolvedSectionID })?
            .name
        return CodeSectionThemeProfile(codeSectionName: codeSectionName).accentColor
    }

    func accentHex(for codeSectionID: Int64? = nil, colorScheme: ColorScheme) -> String {
        let resolvedSectionID = codeSectionID ?? selectedCodeSectionID
        let codeSectionName = codeSections
            .first(where: { $0.id == resolvedSectionID })?
            .name
        return CodeSectionThemeProfile(codeSectionName: codeSectionName).accentHex(for: colorScheme)
    }

    func authoredHTMLStore(for chapter: CodeChapter) -> PublishedHTMLContentStore {
        PublishedHTMLContentStore(
            relativeRootPath: selectedVersion?.authoredHTMLBundlePath,
            codeSectionSlug: authoredCodeSectionSlug(for: chapter)
        )
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
            let groups = authoredCodeStore.sectionGroups(chapterID: chapter.id)
            if !groups.isEmpty {
                return groups
            }
            if let htmlGroups = htmlSectionGroups(for: chapter) {
                sectionGroupsCache[chapter.id] = htmlGroups
                sectionsCache[chapter.id] = htmlGroups.flatMap(\.sections)
                return htmlGroups
            }
            return []
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

    func firstSectionAsync(for chapter: CodeChapter) async -> CodeSectionSummary? {
        if let cached = firstSection(for: chapter) {
            return cached
        }

        if let authoredCodeStore {
            let authoredSections = authoredCodeStore.sections(chapterID: chapter.id)
            if let firstAuthoredSection = authoredSections.first {
                return firstAuthoredSection
            }
            if let htmlSection = firstHTMLSection(for: chapter) {
                sectionsCache[chapter.id] = [htmlSection]
                return htmlSection
            }
            return nil
        }

        if let cached = sectionsCache[chapter.id] {
            return cached.first
        }

        if let cachedGroups = sectionGroupsCache[chapter.id] {
            return cachedGroups.first?.sections.first
        }

        guard let sqliteChapterLoader else {
            return sections(for: chapter).first
        }

        do {
            let groups = try await sqliteChapterLoader.sectionGroups(chapterID: chapter.id)
            sectionGroupsCache[chapter.id] = groups
            sectionsCache[chapter.id] = groups.flatMap(\.sections)
            return groups.first?.sections.first
        } catch {
            statusMessage = error.localizedDescription
            return nil
        }
    }

    func firstSection(for chapter: CodeChapter) -> CodeSectionSummary? {
        if let cached = sectionsCache[chapter.id] {
            return cached.first
        }

        if let cachedGroups = sectionGroupsCache[chapter.id] {
            return cachedGroups.first?.sections.first
        }

        if let authoredCodeStore {
            let groups = authoredCodeStore.sectionGroups(chapterID: chapter.id)
            sectionGroupsCache[chapter.id] = groups
            sectionsCache[chapter.id] = groups.flatMap(\.sections)
            if let firstSection = sectionsCache[chapter.id]?.first {
                return firstSection
            }
            if let htmlSection = firstHTMLSection(for: chapter) {
                sectionsCache[chapter.id] = [htmlSection]
                return htmlSection
            }
        }

        return nil
    }

    private func htmlSectionGroups(for chapter: CodeChapter) -> [CodeSectionGroup]? {
        guard selectedVersion?.contentKind == .authored,
              let relativeRootPath = selectedVersion?.authoredHTMLBundlePath
        else {
            return nil
        }

        let htmlStore = PublishedHTMLContentStore(
            relativeRootPath: relativeRootPath,
            codeSectionSlug: authoredCodeSectionSlug(for: chapter)
        )
        let anchors = htmlStore.anchors(chapterNumber: chapter.chapterNumber)
        guard !anchors.isEmpty else { return nil }

        let sectionAnchors = anchors.filter { $0.level >= 2 }
        guard !sectionAnchors.isEmpty else { return nil }

        let levelTwoAnchors = sectionAnchors.filter { $0.level == 2 }
        if levelTwoAnchors.isEmpty {
            return [
                CodeSectionGroup(
                    id: "html-\(chapter.chapterNumber)",
                    headerLine: chapter.displayLabel,
                    headingLine: chapter.title,
                    sections: sectionAnchors.map { anchor in
                        CodeSectionSummary(
                            id: Self.syntheticSectionID(for: chapter.chapterNumber, sectionNumber: anchor.sectionNumber),
                            chapterNumber: chapter.chapterNumber,
                            sectionNumber: anchor.sectionNumber,
                            title: anchor.title
                        )
                    }
                )
            ]
        }

        var groups: [CodeSectionGroup] = []
        for (index, groupAnchor) in levelTwoAnchors.enumerated() {
            let nextGroupAnchor = index < levelTwoAnchors.count - 1 ? levelTwoAnchors[index + 1] : nil
            let childAnchors = sectionAnchors.filter { anchor in
                guard anchor.level > groupAnchor.level else { return false }
                if anchor.sectionNumber.compare(groupAnchor.sectionNumber, options: [.numeric, .caseInsensitive]) != .orderedDescending {
                    return false
                }
                if let nextGroupAnchor {
                    return anchor.sectionNumber.compare(nextGroupAnchor.sectionNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
                }
                return true
            }

            groups.append(
                CodeSectionGroup(
                    id: "html-\(chapter.chapterNumber)-\(groupAnchor.sectionNumber)",
                    headerLine: groupAnchor.title,
                    headingLine: nil,
                    sections: childAnchors.map { anchor in
                        CodeSectionSummary(
                            id: Self.syntheticSectionID(for: chapter.chapterNumber, sectionNumber: anchor.sectionNumber),
                            chapterNumber: chapter.chapterNumber,
                            sectionNumber: anchor.sectionNumber,
                            title: anchor.title
                        )
                    }
                )
            )
        }

        return groups.filter { !$0.sections.isEmpty }
    }

    private func firstHTMLSection(for chapter: CodeChapter) -> CodeSectionSummary? {
        guard selectedVersion?.contentKind == .authored,
              let relativeRootPath = selectedVersion?.authoredHTMLBundlePath
        else {
            return nil
        }

        let htmlStore = PublishedHTMLContentStore(
            relativeRootPath: relativeRootPath,
            codeSectionSlug: authoredCodeSectionSlug(for: chapter)
        )
        guard let chapterURL = htmlStore.chapterURL(chapterNumber: chapter.chapterNumber),
              let firstAnchor = PublishedHTMLContentStore.anchors(in: chapterURL).first
        else {
            return nil
        }

        return CodeSectionSummary(
            id: Self.syntheticSectionID(for: chapter.chapterNumber, sectionNumber: firstAnchor.sectionNumber),
            chapterNumber: chapter.chapterNumber,
            sectionNumber: firstAnchor.sectionNumber,
            title: firstAnchor.title
        )
    }

    private func authoredCodeSectionSlug(for chapter: CodeChapter) -> String? {
        guard let codeSectionID = chapter.codeSectionID,
              let codeSection = codeSections.first(where: { $0.id == codeSectionID })
        else {
            return nil
        }
        return Self.slug(codeSection.name)
    }

    func loadSectionDetail(sectionID: Int64) -> ReaderSectionDetail? {
        if let cached = cachedSectionDetail(for: sectionID) {
            return cached
        }
        if let authoredCodeStore {
            let detail = authoredCodeStore.sectionDetail(sectionID: sectionID)
            if let detail {
                storeSectionDetailInCache(detail, sectionID: sectionID)
            }
            return detail
        }
        do {
            let detail = try codeDatabase?.sectionDetail(sectionID: sectionID)
            if let detail {
                storeSectionDetailInCache(detail, sectionID: sectionID)
            }
            return detail
        } catch {
            statusMessage = error.localizedDescription
            return nil
        }
    }

    func chapterBodyNSText(for detail: ReaderSectionDetail) -> NSAttributedString {
        let cacheKey = Self.formattedTextCacheKey(sectionID: detail.id, theme: readerTheme)
        if let cached = chapterBodyNSTextCache.object(forKey: cacheKey) {
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

        chapterBodyNSTextCache.setObject(renderedText, forKey: cacheKey, cost: Self.attributedTextMemoryCost(renderedText))
        return renderedText
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

    func renderHTMLTextBlock(_ html: String, fallbackText: String) -> NSAttributedString {
        let rendered = Self.inlineHTMLTextBlock(
            html: html,
            fallbackText: fallbackText,
            theme: readerTheme
        )
        return rendered.string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? renderPlainTextBlock(fallbackText)
            : rendered
    }

    func chapterBodyNSTextAsync(for detail: ReaderSectionDetail) async -> NSAttributedString {
        let signpostID = OSSignpostID(log: AppSignpost.reader)
        os_signpost(.begin, log: AppSignpost.reader, name: "bodyText", signpostID: signpostID)
        defer { os_signpost(.end, log: AppSignpost.reader, name: "bodyText", signpostID: signpostID) }

        let cacheKey = Self.formattedTextCacheKey(sectionID: detail.id, theme: readerTheme)
        if let cached = chapterBodyNSTextCache.object(forKey: cacheKey) {
            return cached
        }

        let theme = readerTheme
        let renderedBody = await Task.detached(priority: .userInitiated) {
            Self.chapterBodyText(detail: detail, theme: theme)
        }.value
        let renderedText = NSAttributedString(renderedBody)
        chapterBodyNSTextCache.setObject(renderedText, forKey: cacheKey, cost: Self.attributedTextMemoryCost(renderedText))
        return renderedText
    }

    func updateReaderTheme(_ theme: ReaderTheme) {
        let theme = theme.normalized
        guard readerTheme != theme else { return }
        readerTheme = theme
        formattedNSTextCache.removeAllObjects()
        chapterBodyNSTextCache.removeAllObjects()
        readerThemeStore.save(theme)
    }

    func resolveReferences(for detail: ReaderSectionDetail) -> [ResolvedCodeReference] {
        if let authoredCodeStore {
            return referenceResolver.resolveReferences(in: detail.officialText, database: authoredCodeStore)
        }
        guard let codeDatabase else { return [] }
        return referenceResolver.resolveReferences(in: detail.officialText, database: codeDatabase)
    }

    func resolveReferencesAsync(for detail: ReaderSectionDetail) async -> [ResolvedCodeReference] {
        if let authoredCodeStore {
            return await Task.detached(priority: .utility) {
                CodeReferenceResolver().resolveReferences(in: detail.officialText, database: authoredCodeStore)
            }.value
        }
        guard let codeDatabase else { return [] }
        return await Task.detached(priority: .utility) {
            CodeReferenceResolver().resolveReferences(in: detail.officialText, database: codeDatabase)
        }.value
    }

    func chapterBlockSummaries(for chapter: CodeChapter) async -> [ChapterReaderBlockSummary] {
        let groups: [CodeSectionGroup]
        if let authoredCodeStore {
            groups = authoredCodeStore.sectionGroups(chapterID: chapter.id)
        } else if let cached = sectionGroupsCache[chapter.id] {
            groups = cached
        } else if let sqliteChapterLoader {
            do {
                let loaded = try await sqliteChapterLoader.sectionGroups(chapterID: chapter.id)
                sectionGroupsCache[chapter.id] = loaded
                groups = loaded
            } catch {
                statusMessage = error.localizedDescription
                return []
            }
        } else {
            groups = []
        }

        let codeSectionName = codeSectionName(id: chapter.codeSectionID)

        return groups.flatMap { group in
            group.sections.enumerated().map { index, section in
                ChapterReaderBlockSummary(
                    id: section.id,
                    sectionNumber: section.sectionNumber,
                    title: section.title,
                    displayTitle: section.displayTitle,
                    kind: section.kind,
                    groupLabel: index == 0 ? group.displayLabel(codeSectionName: codeSectionName) : nil
                )
            }
        }
    }

    func chapterBlockDescriptors(for chapter: CodeChapter) async -> [ChapterBlockDescriptor] {
        let codeSectionName = codeSectionName(id: chapter.codeSectionID)

        if let authoredCodeStore {
            return authoredCodeStore.sectionGroups(chapterID: chapter.id).flatMap { group in
                group.sections.enumerated().map { index, section in
                    ChapterBlockDescriptor(
                        sectionID: section.id,
                        groupLabel: index == 0 ? group.displayLabel(codeSectionName: codeSectionName) : nil
                    )
                }
            }
        }

        if let cached = sectionGroupsCache[chapter.id] {
            return cached.flatMap { group in
                group.sections.enumerated().map { index, section in
                    ChapterBlockDescriptor(
                        sectionID: section.id,
                        groupLabel: index == 0 ? group.displayLabel(codeSectionName: codeSectionName) : nil
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
                        groupLabel: index == 0 ? group.displayLabel(codeSectionName: codeSectionName) : nil
                    )
                }
            }
        } catch {
            statusMessage = error.localizedDescription
            return []
        }
    }

    func loadSectionDetailAsync(sectionID: Int64) async -> ReaderSectionDetail? {
        if let cached = cachedSectionDetail(for: sectionID) {
            return cached
        }
        if let authoredCodeStore {
            // Move the synchronous JSON read off the MainActor so the
            // scroll/layout thread stays responsive while details warm.
            let detail = await Task.detached(priority: .userInitiated) {
                authoredCodeStore.sectionDetail(sectionID: sectionID)
            }.value
            if let detail {
                storeSectionDetailInCache(detail, sectionID: sectionID)
            }
            return detail
        }

        guard let sqliteChapterLoader else {
            return loadSectionDetail(sectionID: sectionID)
        }

        do {
            let detail = try await sqliteChapterLoader.sectionDetail(sectionID: sectionID)
            if let detail {
                storeSectionDetailInCache(detail, sectionID: sectionID)
            }
            return detail
        } catch {
            statusMessage = error.localizedDescription
            return nil
        }
    }

    func sectionSummary(sectionNumber: String) -> CodeSectionSummary? {
        let normalized = sectionNumber
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))

        guard !normalized.isEmpty else { return nil }

        if let authoredCodeStore {
            return try? authoredCodeStore.sectionSummary(sectionNumber: normalized)
        }

        do {
            return try codeDatabase?.sectionSummary(sectionNumber: normalized)
        } catch {
            statusMessage = error.localizedDescription
            return nil
        }
    }

    func sectionSummary(sectionNumber: String, codeSectionID: Int64?) -> CodeSectionSummary? {
        let normalized = sectionNumber
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))

        guard !normalized.isEmpty else { return nil }

        if let authoredCodeStore {
            return try? authoredCodeStore.sectionSummary(sectionNumber: normalized, codeSectionID: codeSectionID)
        }

        return sectionSummary(sectionNumber: normalized)
    }

    func recentEntry(for codeSectionID: Int64?) -> RecentlyViewedEntry? {
        recentlyViewedSections.first { entry in
            entry.codeSectionID == codeSectionID
        } ?? recentlyViewedSections.first
    }

    func chapter(for entry: RecentlyViewedEntry) -> CodeChapter? {
        chapter(forSectionID: entry.sectionID)
    }

    func chapter(forSectionID sectionID: Int64) -> CodeChapter? {
        guard let detail = loadSectionDetail(sectionID: sectionID) else { return nil }
        return chapters(for: detail.codeSectionID).first { chapter in
            chapter.chapterNumber == detail.chapterNumber
        }
    }

    func loadSectionDetailsAsync(sectionIDs: [Int64]) async -> [ReaderSectionDetail] {
        guard !sectionIDs.isEmpty else { return [] }

        var orderedDetails: [Int64: ReaderSectionDetail] = [:]
        var missingIDs: [Int64] = []
        for sectionID in sectionIDs {
            if let cached = cachedSectionDetail(for: sectionID) {
                orderedDetails[sectionID] = cached
            } else {
                missingIDs.append(sectionID)
            }
        }

        if let authoredCodeStore, !missingIDs.isEmpty {
            // Pull all missing details in a single detached batch so we only pay
            // one MainActor hop per chapter open instead of N.
            let loaded = await Task.detached(priority: .userInitiated) { () -> [ReaderSectionDetail] in
                missingIDs.compactMap { authoredCodeStore.sectionDetail(sectionID: $0) }
            }.value
            for detail in loaded {
                storeSectionDetailInCache(detail, sectionID: detail.id)
                orderedDetails[detail.id] = detail
            }
            return sectionIDs.compactMap { orderedDetails[$0] }
        }

        if !missingIDs.isEmpty, let sqliteChapterLoader {
            do {
                let loadedDetails = try await sqliteChapterLoader.sectionDetails(sectionIDs: missingIDs)
                for detail in loadedDetails {
                    storeSectionDetailInCache(detail, sectionID: detail.id)
                    orderedDetails[detail.id] = detail
                }
            } catch {
                statusMessage = error.localizedDescription
            }
        }

        return sectionIDs.compactMap { orderedDetails[$0] ?? cachedSectionDetail(for: $0) }
    }

    func imageURL(fileName: String) -> URL? {
        codeDatabase?.imageURL(fileName: fileName)
    }

    func search(query: String, restrictToSelectedCodeSection: Bool = true) {
        // Cancel both the outer coordination task and the inner work task so
        // concurrent Task.detached bodies don't pile up and saturate the thread
        // pool when the user types quickly.
        searchTask?.cancel()
        activeSearchWorkTask?.cancel()
        activeSearchWorkTask = nil

        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedQuery.isEmpty else {
            searchResults = []
            return
        }

        if let authoredCodeStore {
            let selectedCodeSectionID = restrictToSelectedCodeSection ? self.selectedCodeSectionID : nil
            let workTask = Task.detached(priority: .userInitiated) {
                authoredCodeStore.search(query: trimmedQuery, codeSectionID: selectedCodeSectionID)
            }
            activeSearchWorkTask = workTask
            searchTask = Task {
                let results = await workTask.value
                guard !Task.isCancelled, !workTask.isCancelled else { return }
                searchResults = results
            }
            return
        }

        guard let databaseURL = selectedVersion?.fileURL else {
            searchResults = []
            return
        }

        let workTask: Task<[CodeSearchResult], Never> = Task.detached(priority: .userInitiated) {
            do {
                let database = try CodeDatabase(databaseURL: databaseURL, locator: BundleDatabaseLocator())
                return (try? database.search(query: trimmedQuery)) ?? []
            } catch {
                return []
            }
        }
        activeSearchWorkTask = workTask
        searchTask = Task {
            let results = await workTask.value
            guard !Task.isCancelled, !workTask.isCancelled else { return }
            searchResults = results
        }
    }

    func notifySearchTabRetap() {
        // Wrap on overflow — this is a sentinel counter, only the change
        // matters, not the absolute value.
        searchTabRetapCount &+= 1
    }

    func recordRecentSearch(_ query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        var updated = recentSearches.filter { $0.caseInsensitiveCompare(trimmed) != .orderedSame }
        updated.insert(trimmed, at: 0)
        recentSearches = Array(updated.prefix(10))
        UserDefaults.standard.set(recentSearches, forKey: recentSearchesDefaultsKey)
    }

    func removeRecentSearch(_ query: String) {
        recentSearches.removeAll { $0.caseInsensitiveCompare(query) == .orderedSame }
        UserDefaults.standard.set(recentSearches, forKey: recentSearchesDefaultsKey)
    }

    func clearRecentSearches() {
        recentSearches = []
        recentlyViewedSections = []
        UserDefaults.standard.removeObject(forKey: recentSearchesDefaultsKey)
        persistRecentlyViewedSections()
        scheduleUserContentAutoSync()
    }

    func pinSearch(_ query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isSearchPinned(trimmed) else { return }

        var updated = pinnedSearches.filter { $0.caseInsensitiveCompare(trimmed) != .orderedSame }
        updated.insert(trimmed, at: 0)
        pinnedSearches = updated
        persistPinnedSearches()
    }

    func unpinSearch(_ query: String) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        pinnedSearches.removeAll { $0.caseInsensitiveCompare(trimmed) == .orderedSame }
        persistPinnedSearches()
    }

    func isSearchPinned(_ query: String) -> Bool {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        return pinnedSearches.contains { $0.caseInsensitiveCompare(trimmed) == .orderedSame }
    }

    private func persistPinnedSearches() {
        UserDefaults.standard.set(pinnedSearches, forKey: pinnedSearchesDefaultsKey)
    }

    private static func loadRecentSearches() -> [String] {
        (UserDefaults.standard.array(forKey: "recentSearches") as? [String] ?? [])
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private static func loadPinnedSearches() -> [String] {
        (UserDefaults.standard.array(forKey: "pinnedSearches") as? [String] ?? [])
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    func refreshBookmarks() {
        guard let selectedVersion, let userContentRepository else {
            let didChange = !bookmarkedSectionIDs.isEmpty || !bookmarks.isEmpty
            bookmarkedSectionIDs = []
            bookmarks = []
            if didChange {
                bookmarkRevision &+= 1
            }
            return
        }

        let previousBookmarkedIDs = bookmarkedSectionIDs
        let previousBookmarks = bookmarks

        do {
            let ids = try userContentRepository.bookmarkedSectionIDs(codeVersion: selectedVersion.codeVersion)
            let noteEntries = try userContentRepository.noteEntries(codeVersion: selectedVersion.codeVersion)
            let tagEntries = (try? userContentRepository.tagsBySectionID(codeVersion: selectedVersion.codeVersion)) ?? [:]
            let bookmarkDates = (try? userContentRepository.bookmarkCreatedAtBySectionID(codeVersion: selectedVersion.codeVersion)) ?? [:]
            bookmarkedSectionIDs = Set(ids)
            let savedSectionIDs = Array(Set(ids).union(noteEntries.keys)).sorted()
            if let authoredCodeStore {
                bookmarks = authoredCodeStore.savedSections(
                    ids: savedSectionIDs,
                    codeVersion: selectedVersion.codeVersion,
                    bookmarkedSectionIDs: bookmarkedSectionIDs,
                    notesBySectionID: noteEntries,
                    tagsBySectionID: tagEntries,
                    bookmarkCreatedAtBySectionID: bookmarkDates
                )
            } else {
                bookmarks = try codeDatabase?.savedSections(
                    ids: savedSectionIDs,
                    codeVersion: selectedVersion.codeVersion,
                    bookmarkedSectionIDs: bookmarkedSectionIDs,
                    notesBySectionID: noteEntries,
                    tagsBySectionID: tagEntries,
                    bookmarkCreatedAtBySectionID: bookmarkDates
                ) ?? []
            }
        } catch {
            statusMessage = error.localizedDescription
            bookmarkedSectionIDs = []
            bookmarks = []
        }

        if bookmarkedSectionIDs != previousBookmarkedIDs || bookmarks != previousBookmarks {
            bookmarkRevision &+= 1
        }

        // Folders piggy-back on bookmarks: when bookmarks reload, folder
        // membership may also have changed (e.g. via cascade on
        // toggleBookmark). Refresh both together so views stay in sync.
        refreshFolders()
    }

    // MARK: - Folders

    func refreshFolders() {
        guard let selectedVersion, let userContentRepository else {
            folders = []
            folderMembership = [:]
            clearActiveProject()
            return
        }

        do {
            let records = try userContentRepository.folders(codeVersion: selectedVersion.codeVersion)
            folders = records.map { record in
                CodeFolder(
                    id: record.id,
                    clientID: record.clientID,
                    ownerID: record.ownerID.isEmpty ? UserDataDefaults.localOwnerID : record.ownerID,
                    visibility: UserContentVisibility(rawValue: record.visibility) ?? .personal,
                    syncState: UserContentSyncState(rawValue: record.syncState) ?? .localOnly,
                    deletedAt: record.deletedAt.flatMap { ISO8601DateFormatter().date(from: $0) },
                    name: record.name,
                    description: record.description,
                    colorHex: record.colorHex,
                    sortOrder: record.sortOrder,
                    createdAt: ISO8601DateFormatter().date(from: record.createdAt) ?? Date(),
                    updatedAt: ISO8601DateFormatter().date(from: record.updatedAt) ?? Date()
                )
            }
            folderMembership = (try? userContentRepository.folderMembership(codeVersion: selectedVersion.codeVersion)) ?? [:]
            if let activeProjectID, folders.contains(where: { $0.id == activeProjectID }) == false {
                clearActiveProject(ifMatches: activeProjectID)
            }
        } catch {
            statusMessage = error.localizedDescription
            folders = []
            folderMembership = [:]
            clearActiveProject()
        }
    }

    @discardableResult
    func createFolder(name: String, description: String = "", colorHex: String = CodeFolder.defaultColorHex) -> CodeFolder? {
        guard let selectedVersion, let userContentRepository else { return nil }
        do {
            let folderCount = try folderCountForEntitlements(codeVersion: selectedVersion.codeVersion)
            guard !denyIfNeeded(entitlementService.canCreateProject(currentCount: folderCount)) else {
                return nil
            }
            let id = try userContentRepository.createFolder(
                name: name,
                description: description,
                colorHex: colorHex,
                codeVersion: selectedVersion.codeVersion
            )
            refreshFolders()
            scheduleUserContentAutoSync()
            return folders.first { $0.id == id }
        } catch {
            statusMessage = error.localizedDescription
            return nil
        }
    }

    func updateFolder(_ folder: CodeFolder, name: String, description: String, colorHex: String) {
        guard let selectedVersion, let userContentRepository else { return }
        do {
            try userContentRepository.updateFolder(
                id: folder.id,
                name: name,
                description: description,
                colorHex: colorHex,
                codeVersion: selectedVersion.codeVersion
            )
            refreshFolders()
            scheduleUserContentAutoSync()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func deleteFolder(id: Int64) {
        guard let selectedVersion, let userContentRepository else { return }
        do {
            try userContentRepository.deleteFolder(id: id, codeVersion: selectedVersion.codeVersion)
            refreshFolders()
            scheduleUserContentAutoSync()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func addSection(_ sectionID: Int64, toFolder folderID: Int64) {
        guard let selectedVersion, let userContentRepository else { return }
        // Adding a section to a folder implicitly bookmarks it — folders are
        // a *grouping* of saved sections, so an unbookmarked section in a
        // folder makes no sense. The DB cleanup goes the other way too
        // (unbookmark wipes folder rows), so this keeps the invariant tight.
        if !isBookmarked(sectionID: sectionID) {
            _ = toggleBookmark(sectionID: sectionID)
            guard isBookmarked(sectionID: sectionID) else { return }
        }
        do {
            try userContentRepository.addSection(sectionID, toFolder: folderID, codeVersion: selectedVersion.codeVersion)
            refreshFolders()
            scheduleUserContentAutoSync()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func removeSection(_ sectionID: Int64, fromFolder folderID: Int64) {
        guard let selectedVersion, let userContentRepository else { return }
        do {
            try userContentRepository.removeSection(sectionID, fromFolder: folderID, codeVersion: selectedVersion.codeVersion)
            refreshFolders()
            scheduleUserContentAutoSync()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    /// All folders that currently contain a given section.
    func folders(containing sectionID: Int64) -> [CodeFolder] {
        let memberIDs = Set(folderMembership[sectionID] ?? [])
        guard !memberIDs.isEmpty else { return [] }
        return folders.filter { memberIDs.contains($0.id) }
    }

    func folder(id: Int64) -> CodeFolder? {
        folders.first { $0.id == id }
    }

    var activeProject: CodeFolder? {
        guard let activeProjectID else { return nil }
        return folder(id: activeProjectID)
    }

    func bookmarks(inFolder folderID: Int64) -> [BookmarkedSection] {
        bookmarks.filter { bookmark in
            Set(folderMembership[bookmark.id] ?? []).contains(folderID)
        }
    }

    func bookmarkCount(inFolder folderID: Int64) -> Int {
        bookmarks(inFolder: folderID).count
    }

    private func denyIfNeeded(_ decision: EntitlementDecision) -> Bool {
        switch decision {
        case .allowed:
            return false
        case .denied(let requirement):
            entitlementPrompt = requirement
            statusMessage = requirement.message
            return true
        }
    }

    func dismissEntitlementPrompt() {
        entitlementPrompt = nil
    }

    var upgradeCallToActionTitle: String {
        if currentPlan == .pro { return "Pro Active" }
        if proProductDisplayPrice != nil { return "Upgrade to Pro - $0.00/month" }
        return isStoreKitBusy ? "Loading Pro..." : "Upgrade to Pro"
    }

    var hasProjectAccess: Bool {
        currentPlan == .pro
    }

    @discardableResult
    func requireProjectAccess() -> Bool {
        guard currentPlan != .pro else { return true }
        let requirement = EntitlementRequirement(
            feature: .unlimitedProjects,
            requiredPlan: .pro,
            message: "Upgrade to Pro to create and manage projects."
        )
        entitlementPrompt = requirement
        statusMessage = requirement.message
        return false
    }

    func showUpgradePlaceholder() {
        entitlementPrompt = EntitlementRequirement(
            feature: .unlimitedSavedItems,
            requiredPlan: .pro,
            message: "Upgrade to Pro to unlock unlimited saved work, PDF export, tags, continuity, and future cross-device sync."
        )
    }

    func refreshStoreKitEntitlements() async {
        let snapshot = await storeKitSubscriptionService.snapshot()
        applyStoreKitSnapshot(snapshot)
    }

    func startStoreKitTransactionObservation() {
        guard storeKitUpdatesTask == nil else { return }
        let service = storeKitSubscriptionService
        storeKitUpdatesTask = Task { [weak self] in
            let updates = await service.transactionUpdates()
            for await snapshot in updates {
                await self?.applyStoreKitSnapshot(snapshot)
            }
        }
    }

    func purchasePro() async {
        guard !isStoreKitBusy else { return }
        isStoreKitBusy = true
        defer { isStoreKitBusy = false }

        do {
            let snapshot = try await storeKitSubscriptionService.purchasePro()
            applyStoreKitSnapshot(snapshot)
            statusMessage = currentPlan == .pro ? "Pro is active." : "Purchase cancelled."
        } catch {
            statusMessage = error.localizedDescription
            entitlementPrompt = EntitlementRequirement(
                feature: .unlimitedSavedItems,
                requiredPlan: .pro,
                message: error.localizedDescription
            )
        }
    }

    func restorePurchases() async {
        guard !isStoreKitBusy else { return }
        isStoreKitBusy = true
        defer { isStoreKitBusy = false }

        let snapshot = await storeKitSubscriptionService.restorePurchases()
        applyStoreKitSnapshot(snapshot)
        statusMessage = currentPlan == .pro ? "Pro purchase restored." : "No active Pro subscription found."
    }

    func handleAppleSignIn(result: Result<ASAuthorization, Error>) async {
        switch result {
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
                statusMessage = "Sign in with Apple did not return an Apple ID credential."
                return
            }
            let displayName = [credential.fullName?.givenName, credential.fullName?.familyName]
                .compactMap { $0 }
                .joined(separator: " ")
            do {
                let backendRecord = try await accountBackendClient.signIn(
                    credential: AccountSignInCredential(
                        provider: .apple,
                        providerUserID: credential.user,
                        displayName: displayName.isEmpty ? nil : displayName,
                        signedInAt: Date()
                    )
                )
                await completeBackendSignIn(backendRecord)
            } catch {
                statusMessage = error.localizedDescription
            }
        case .failure(let error):
            statusMessage = error.localizedDescription
        }
    }

    func handlePasskeySignIn(result: Result<ASAuthorization, Error>) async {
        switch result {
        case .success(let authorization):
            guard #available(iOS 16.0, *),
                  let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion
            else {
                statusMessage = "Passkey sign-in did not return a passkey credential."
                return
            }
            do {
                let backendRecord = try await accountBackendClient.signIn(
                    credential: AccountSignInCredential(
                        provider: .passkey,
                        providerUserID: credential.credentialID.base64EncodedString(),
                        displayName: nil,
                        signedInAt: Date()
                    )
                )
                guard backendRecord.account.authProvider != .passkey else {
                    statusMessage = "This passkey is not linked to your Apple account yet. Sign in with Apple, then create the passkey again."
                    return
                }
                await completeBackendSignIn(backendRecord)
            } catch {
                statusMessage = error.localizedDescription
            }
        case .failure(let error):
            statusMessage = error.localizedDescription
        }
    }

    func handlePasskeyRegistration(result: Result<ASAuthorization, Error>) async {
        guard let account = signedInAccount else {
            statusMessage = "Sign in with Apple before creating a passkey."
            return
        }
        switch result {
        case .success(let authorization):
            guard #available(iOS 16.0, *),
                  let credential = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration
            else {
                statusMessage = "Passkey creation did not return a passkey credential."
                return
            }
            guard !isAccountBusy else { return }
            isAccountBusy = true
            defer { isAccountBusy = false }
            do {
                let linkedAccount = try await accountBackendClient.linkPasskey(
                    account: account,
                    credentialID: credential.credentialID.base64EncodedString()
                )
                signedInAccount = linkedAccount
                Self.saveSignedInAccount(linkedAccount)
                statusMessage = "Passkey saved for this account."
            } catch {
                if handleBackendSessionFailureIfNeeded(error) { return }
                statusMessage = error.localizedDescription
            }
        case .failure(let error):
            statusMessage = error.localizedDescription
        }
    }

    private func completeBackendSignIn(_ backendRecord: BackendAccountRecord) async {
        let account = backendRecord.account
        signedInAccount = account
        Self.saveSignedInAccount(account)
        refreshUserContentSyncCheckpoint()
        if let entitlement = backendRecord.entitlement {
            LocalEntitlementService.setEntitlement(entitlement)
            refreshCurrentEntitlement()
        }
        await refreshStoreKitEntitlements()
        await attachLocalDataIfNeeded()
        await pullRemoteUserContentIfPossible()
        await syncPendingUserContentIfPossible()
        await pullRemoteUserContentIfPossible()
        await refreshLifetimeGrant(announcesMissingGrant: false)
    }

    func attachLocalDataIfNeeded() async {
        guard let signedInAccount else { return }
        guard signedInAccount.migrationState == .notStarted else { return }
        do {
            let migrationState = try await accountBackendClient.attachLocalData(account: signedInAccount)
            let migratedAccount = SignedInAccount(
                appUserID: signedInAccount.appUserID,
                authProvider: signedInAccount.authProvider,
                authProviderUserID: signedInAccount.authProviderUserID,
                appleUserID: signedInAccount.appleUserID,
                publicUsername: signedInAccount.publicUsername,
                displayName: signedInAccount.displayName,
                signedInAt: signedInAccount.signedInAt,
                migrationState: migrationState,
                backendSessionToken: signedInAccount.backendSessionToken
            )
            self.signedInAccount = migratedAccount
            Self.saveSignedInAccount(migratedAccount)
            refreshUserContentSyncCheckpoint()
        } catch {
            if handleBackendSessionFailureIfNeeded(error) { return }
            statusMessage = "Signed in. Local data is still only on this device."
        }
    }

    func syncPendingUserContentIfPossible() async {
        guard !isAccountBusy else { return }
        isAccountBusy = true
        defer { isAccountBusy = false }

        do {
            let startedAt = Date()
            let report = try await syncEngine.processPendingWork(account: signedInAccount)
            let elapsed = Date().timeIntervalSince(startedAt)
            refreshUserContentSyncCheckpoint()
            if let skippedReason = report.skippedReason {
                statusMessage = skippedReason
            } else if !report.rejectedMutationIDs.isEmpty {
                statusMessage = "Synced \(report.completedCount) of \(report.attemptedCount) local changes. Pull latest changes before retrying the rest."
            } else if report.completedCount > 0 {
                statusMessage = "Synced \(report.completedCount) local changes in \(Self.syncDurationText(elapsed))."
            }
            refreshPendingUserContentSyncCount()
        } catch {
            if handleBackendSessionFailureIfNeeded(error) {
                refreshUserContentSyncCheckpoint()
                refreshPendingUserContentSyncCount()
                return
            }
            refreshUserContentSyncCheckpoint()
            statusMessage = error.localizedDescription
            refreshPendingUserContentSyncCount()
        }
    }

    private func scheduleUserContentAutoSync() {
        guard signedInAccount != nil else { return }
        userContentAutoSyncTask?.cancel()
        userContentAutoSyncTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 800_000_000)
            guard !Task.isCancelled else { return }
            for _ in 0..<5 {
                guard !Task.isCancelled else { return }
                guard let self else { return }
                if !self.isAccountBusy {
                    await self.syncPendingUserContentIfPossible()
                    return
                }
                try? await Task.sleep(nanoseconds: 600_000_000)
            }
        }
    }

    private static func syncDurationText(_ interval: TimeInterval) -> String {
        if interval < 1 {
            return "\(Int((interval * 1_000).rounded())) ms"
        }
        return String(format: "%.1f sec", interval)
    }

    func previewRemoteUserContentMergeIfPossible() async -> UserContentMergePlan? {
        guard !isAccountBusy else { return nil }
        isAccountBusy = true
        defer { isAccountBusy = false }

        do {
            let report = try await syncEngine.pullRemoteChanges(account: signedInAccount)
            refreshUserContentSyncCheckpoint()
            return report.mergePlan
        } catch {
            if handleBackendSessionFailureIfNeeded(error) {
                refreshUserContentSyncCheckpoint()
                return nil
            }
            refreshUserContentSyncCheckpoint()
            statusMessage = error.localizedDescription
            return nil
        }
    }

    func pullRemoteUserContentIfPossible() async {
        guard !isAccountBusy else { return }
        isAccountBusy = true
        defer { isAccountBusy = false }

        do {
            let report = try await syncEngine.pullRemoteChanges(account: signedInAccount, applySafeChanges: true)
            if report.appliedRemoteContinuity {
                refreshContinuityStateFromStore()
            }
            refreshUserContentSyncCheckpoint()
            if let skippedReason = report.skippedReason {
                statusMessage = skippedReason
            } else if report.appliedCount > 0 {
                statusMessage = "Applied \(report.appliedCount) remote changes."
            } else if report.conflictCount > 0 {
                statusMessage = "\(report.conflictCount) remote changes need review."
            }
        } catch {
            if handleBackendSessionFailureIfNeeded(error) {
                refreshUserContentSyncCheckpoint()
                return
            }
            refreshUserContentSyncCheckpoint()
            statusMessage = error.localizedDescription
        }
    }

    func performStartupAccountSyncIfNeeded() async {
        guard isInitialContentLoaded else { return }
        guard signedInAccount != nil else { return }
        guard !didRunStartupAccountSync else { return }
        didRunStartupAccountSync = true
        await pullRemoteUserContentIfPossible()
        await syncPendingUserContentIfPossible()
        await pullRemoteUserContentIfPossible()
    }

    func syncNow() async {
        guard signedInAccount != nil else {
            statusMessage = "Sign in before syncing saved work."
            return
        }
        do {
            try syncEngine.retryFailedItems()
        } catch {
            statusMessage = "Could not prepare failed sync items for retry. \(error.localizedDescription)"
        }
        await pullRemoteUserContentIfPossible()
        await syncPendingUserContentIfPossible()
        await pullRemoteUserContentIfPossible()
        refreshPendingUserContentSyncCount()
    }

    private func refreshUserContentSyncCheckpoint() {
        userContentSyncCheckpoint = syncEngine.checkpoint(account: signedInAccount)
        refreshPendingUserContentSyncCount()
    }

    private func refreshPendingUserContentSyncCount() {
        do {
            pendingUserContentSyncCount = try syncEngine.previewPendingWork(limit: 500).pendingCount
        } catch {
            pendingUserContentSyncCount = 0
        }
    }

    var syncStatusTitle: String {
        guard signedInAccount != nil else { return "Not signed in" }
        if isAccountBusy { return "Syncing..." }
        if userContentSyncCheckpoint?.lastErrorMessage != nil { return "Sync failed" }
        if pendingUserContentSyncCount > 0 { return "\(pendingUserContentSyncCount) change\(pendingUserContentSyncCount == 1 ? "" : "s") waiting" }
        return "Synced"
    }

    var syncStatusDetail: String {
        guard signedInAccount != nil else {
            return "Sign in to sync saved work across installs and devices."
        }
        if let error = userContentSyncCheckpoint?.lastErrorMessage {
            if Self.isBackendAuthenticationFailureMessage(error) {
                return "Your sync session expired. Sign in again to reconnect saved work."
            }
            return "Last sync failed. Tap Sync Now to retry. \(error)"
        }
        let lastPush = userContentSyncCheckpoint?.lastSuccessfulPushAt
        let lastPull = userContentSyncCheckpoint?.lastSuccessfulPullAt
        let lastSync = [lastPush, lastPull].compactMap { $0 }.max()
        if let lastSync {
            return "Last synced \(lastSync.formatted(date: .abbreviated, time: .shortened))."
        }
        return pendingUserContentSyncCount > 0
            ? "Local changes are queued for upload."
            : "No sync has completed yet."
    }

    var canSyncNow: Bool {
        signedInAccount != nil && !isAccountBusy
    }

    static func normalizedPublicUsername(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let withoutAtPrefix = trimmed.hasPrefix("@") ? String(trimmed.dropFirst()) : trimmed
        let normalized = withoutAtPrefix.lowercased()
        return normalized.isEmpty ? nil : normalized
    }

    static func publicUsernameValidationMessage(_ value: String) -> String? {
        guard let normalized = normalizedPublicUsername(value) else { return nil }
        if normalized.count < 3 {
            return "Use at least 3 characters."
        }
        if normalized.count > 30 {
            return "Use 30 characters or fewer."
        }
        let allowedCharacters = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789_-")
        if normalized.unicodeScalars.contains(where: { !allowedCharacters.contains($0) }) {
            return "Use letters, numbers, hyphens, or underscores."
        }
        return nil
    }

    func updateAccountProfile(publicUsername: String) async {
        guard let signedInAccount else {
            statusMessage = "Sign in before updating your profile."
            return
        }
        guard !isAccountBusy else { return }
        if let validationMessage = Self.publicUsernameValidationMessage(publicUsername) {
            statusMessage = validationMessage
            return
        }

        isAccountBusy = true
        defer { isAccountBusy = false }

        do {
            let normalizedUsername = Self.normalizedPublicUsername(publicUsername)
            let updatedAccount = try await accountBackendClient.updateProfile(
                account: signedInAccount,
                publicUsername: normalizedUsername,
                displayName: signedInAccount.displayName
            )
            self.signedInAccount = updatedAccount
            Self.saveSignedInAccount(updatedAccount)
            refreshUserContentSyncCheckpoint()
            statusMessage = normalizedUsername == nil ? "Public username cleared." : "Public username saved."
        } catch {
            if handleBackendSessionFailureIfNeeded(error) { return }
            statusMessage = error.localizedDescription
        }
    }

    var accountSyncDebugSummary: String {
        let accountText: String
        if let signedInAccount {
            accountText = "\(signedInAccount.authProvider.rawValue): \(signedInAccount.appUserID)"
        } else {
            accountText = "not signed in"
        }

        let checkpointText: String
        if let userContentSyncCheckpoint {
            checkpointText = [
                "last push: \(userContentSyncCheckpoint.lastSuccessfulPushAt?.formatted() ?? "none")",
                "last pull: \(userContentSyncCheckpoint.lastSuccessfulPullAt?.formatted() ?? "none")",
                "last error: \(userContentSyncCheckpoint.lastErrorMessage ?? "none")"
            ].joined(separator: ", ")
        } else {
            checkpointText = "none"
        }

        let backendConfiguration = PermitextBackendConfiguration.load()
        let backendBaseURL = backendConfiguration.apiBaseURLString ?? "none"
        return [
            "Account: \(accountText)",
            "Backend: \(accountBackendClient.name) (\(backendConfiguration.mode.rawValue), base URL: \(backendBaseURL))",
            "Sync checkpoint: \(checkpointText)"
        ].joined(separator: "\n")
    }

    func refreshLifetimeGrant(announcesMissingGrant: Bool = true) async {
        guard let signedInAccount else { return }
        guard !isAccountBusy else { return }
        isAccountBusy = true
        defer { isAccountBusy = false }

        do {
            let result = try await lifetimeGrantLookupClient.lookupLifetimeGrant(appleUserID: signedInAccount.appleUserID)
            if result.hasLifetimeGrant {
                LocalEntitlementService.setLifetimeGrant(userID: result.grantedUserID ?? signedInAccount.appleUserID)
                statusMessage = "Lifetime Pro grant applied."
            } else if currentEntitlementSource == .lifetimeGrant {
                LocalEntitlementService.clearLifetimeGrant()
                statusMessage = "No lifetime Pro grant found for this account."
            } else if announcesMissingGrant {
                statusMessage = "Signed in. No lifetime Pro grant found for this account."
            }
            refreshCurrentEntitlement()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func signOut() {
        signedInAccount = nil
        Self.clearSignedInAccount()
        if currentEntitlementSource == .lifetimeGrant {
            LocalEntitlementService.clearLifetimeGrant()
        }
        refreshCurrentEntitlement()
        statusMessage = "Signed out."
    }

    @discardableResult
    private func handleBackendSessionFailureIfNeeded(_ error: Error) -> Bool {
        guard Self.isBackendAuthenticationFailure(error) else { return false }
        signedInAccount = nil
        Self.clearSignedInAccount()
        userContentSyncCheckpoint = nil
        refreshPendingUserContentSyncCount()
        statusMessage = "Your sync session expired. Sign in again to reconnect saved work."
        return true
    }

    #if DEBUG
    func runDebugRestoreCheck() async {
        refreshCurrentEntitlement()
        refreshUserContentSyncCheckpoint()
        refreshPendingUserContentSyncCount()
        let storeKitSnapshot = await storeKitSubscriptionService.snapshot()
        applyStoreKitSnapshot(storeKitSnapshot)

        let accountText = signedInAccount == nil ? "account missing" : "account ok"
        let planText = currentPlan == .pro ? "Pro active" : "Free active"
        let queueText = "\(pendingUserContentSyncCount) pending"
        let checkpointText = userContentSyncCheckpoint?.lastErrorMessage == nil ? "sync ok" : "sync has error"
        let backendText: String
        do {
            let health = try await accountBackendClient.health()
            let storageText = health.storage.map { ", \($0)" } ?? ""
            backendText = health.ok ? "backend ok\(storageText)" : "backend unavailable\(storageText)"
        } catch {
            backendText = "backend failed: \(error.localizedDescription)"
        }
        statusMessage = "Restore check: \(accountText), \(planText), \(queueText), \(checkpointText), \(backendText), StoreKit \(storeKitSnapshot.debugSummary)."
    }

    func setDebugPlan(_ plan: AppPlan) {
        LocalEntitlementService.setDebugPlan(plan)
        let entitlement = entitlementService.currentEntitlement
        currentPlan = entitlement.plan
        currentEntitlementSource = entitlement.source
        statusMessage = "Plan set to \(plan.label) for local testing."
    }

    func setDebugLifetimeGrant(enabled: Bool) {
        if enabled {
            LocalEntitlementService.setLifetimeGrant(userID: "debug-lifetime-grant")
        } else {
            LocalEntitlementService.clearLifetimeGrant()
        }
        let entitlement = entitlementService.currentEntitlement
        currentPlan = entitlement.plan
        currentEntitlementSource = entitlement.source
        statusMessage = enabled ? "Lifetime Pro grant enabled for local testing." : "Lifetime Pro grant cleared."
    }
    #endif

    private func refreshCurrentEntitlement() {
        let entitlement = entitlementService.currentEntitlement
        currentPlan = entitlement.plan
        currentEntitlementSource = entitlement.source
    }

    private func applyStoreKitSnapshot(_ snapshot: StoreKitSubscriptionSnapshot) {
        let entitlement = entitlementService.currentEntitlement
        let resolvedEntitlement: AppEntitlement
        if entitlement.plan == .pro {
            resolvedEntitlement = entitlement
        } else if snapshot.plan == .pro {
            resolvedEntitlement = .subscriptionPro
        } else {
            resolvedEntitlement = entitlement
        }
        currentPlan = resolvedEntitlement.plan
        currentEntitlementSource = resolvedEntitlement.source
        proProductDisplayPrice = snapshot.proDisplayPrice
        storeKitLoadedProductIDs = snapshot.loadedProductIDs
        storeKitDebugSummary = snapshot.debugSummary
    }

    private static func isBackendAuthenticationFailure(_ error: Error) -> Bool {
        guard let backendError = error as? PermitextBackendHTTPError else { return false }
        return backendError.isAuthenticationFailure
    }

    private static func isBackendAuthenticationFailureMessage(_ message: String) -> Bool {
        let lowercased = message.lowercased()
        return lowercased.contains("session")
            || lowercased.contains("sign in")
            || lowercased.contains("unauthorized")
            || lowercased.contains("forbidden")
    }

    private static func loadSignedInAccount() -> SignedInAccount? {
        guard let data = UserDefaults.standard.data(forKey: AccountDefaults.signedInAccountKey) else { return nil }
        guard let account = try? JSONDecoder().decode(SignedInAccount.self, from: data) else { return nil }
        let token = AccountSessionTokenStore.loadToken(accountUserID: account.appUserID)
        return SignedInAccount(
            appUserID: account.appUserID,
            authProvider: account.authProvider,
            authProviderUserID: account.authProviderUserID,
            appleUserID: account.appleUserID,
            publicUsername: account.publicUsername,
            displayName: account.displayName,
            signedInAt: account.signedInAt,
            migrationState: account.migrationState,
            backendSessionToken: token ?? account.backendSessionToken
        )
    }

    private static func saveSignedInAccount(_ account: SignedInAccount) {
        AccountSessionTokenStore.saveToken(account.backendSessionToken, accountUserID: account.appUserID)
        let persistedAccount = SignedInAccount(
            appUserID: account.appUserID,
            authProvider: account.authProvider,
            authProviderUserID: account.authProviderUserID,
            appleUserID: account.appleUserID,
            publicUsername: account.publicUsername,
            displayName: account.displayName,
            signedInAt: account.signedInAt,
            migrationState: account.migrationState,
            backendSessionToken: nil
        )
        if let data = try? JSONEncoder().encode(persistedAccount) {
            UserDefaults.standard.set(data, forKey: AccountDefaults.signedInAccountKey)
        }
    }

    private static func clearSignedInAccount() {
        if let account = loadSignedInAccount() {
            AccountSessionTokenStore.deleteToken(accountUserID: account.appUserID)
        }
        UserDefaults.standard.removeObject(forKey: AccountDefaults.signedInAccountKey)
    }

    private func bookmarkCountForEntitlements(codeVersion: String) throws -> Int {
        try userContentRepository?.bookmarkCount(codeVersion: codeVersion) ?? bookmarkedSectionIDs.count
    }

    private func noteCountForEntitlements(codeVersion: String) throws -> Int {
        try userContentRepository?.noteCount(codeVersion: codeVersion) ?? bookmarks.filter(\.hasNote).count
    }

    private func folderCountForEntitlements(codeVersion: String) throws -> Int {
        try userContentRepository?.folderCount(codeVersion: codeVersion) ?? folders.count
    }

    func removeSections(_ sectionIDs: Set<Int64>, fromFolder folderID: Int64) {
        guard !sectionIDs.isEmpty else { return }
        sectionIDs.forEach { sectionID in
            removeSection(sectionID, fromFolder: folderID)
        }
    }

    // MARK: - PDF export

    /// Kicks off an async PDF build for the supplied subset of bookmarks.
    /// The caller (BookmarksView) decides what to pass — e.g. the currently
    /// filtered list, all bookmarks, or one folder's contents. State
    /// transitions via `exportState`; the view subscribes for progress
    /// and the final URL.
    func startBookmarkExport(
        bookmarks selection: [BookmarkedSection],
        contextLabel: String?
    ) {
        guard !selection.isEmpty else {
            exportState = .failed("No saved sections to export.")
            return
        }
        guard !denyIfNeeded(entitlementService.canUse(.premiumExports)) else {
            exportState = .idle
            return
        }
        activeExportTask?.cancel()
        exportState = .building(progress: 0, sectionTitle: "Preparing…")

        let codeSectionNameMap: [Int64: String] = Dictionary(
            uniqueKeysWithValues: codeSections.map { ($0.id, $0.name) }
        )
        let codeVersionLabel = selectedVersion.map { Self.displayName(forLibraryName: $0.codeVersion) }
            ?? "NYC Construction Codes"

        // Snapshot bookmarks + lookup so the detached body has no
        // MainActor-isolated references.
        let bookmarksSnapshot = selection
        let context = contextLabel

        // We need an MainActor-safe loader that the detached builder can
        // invoke. loadSectionDetailAsync hops through Task.detached inside
        // already, so this hop is cheap.
        let loader: @Sendable (Int64) async -> String? = { [weak self] sectionID in
            guard let self else { return nil }
            let detail = await self.loadSectionDetailAsync(sectionID: sectionID)
            return detail?.officialText
        }

        let updateExportState: @MainActor @Sendable (BookmarkExportState) -> Void = { [weak self] state in
            self?.exportState = state
        }

        activeExportTask = Task { [weak self] in
            let builder = BookmarkExportBuilder(
                bookmarks: bookmarksSnapshot,
                codeSectionNames: codeSectionNameMap,
                metadata: .init(
                    codeVersionLabel: codeVersionLabel,
                    exportContext: context,
                    exportDate: Date()
                ),
                loadFullBody: loader,
                onProgress: { current, total in
                    let progress = Double(current) / Double(max(total, 1))
                    let title = bookmarksSnapshot.indices.contains(current - 1)
                        ? bookmarksSnapshot[current - 1].displayTitle
                        : "Building PDF…"
                    await updateExportState(.building(progress: progress, sectionTitle: title))
                }
            )
            do {
                let url = try await Task.detached(priority: .userInitiated) {
                    try await builder.build()
                }.value
                await MainActor.run {
                    self?.exportState = .ready(url: url, sectionCount: bookmarksSnapshot.count)
                }
            } catch is CancellationError {
                await MainActor.run { self?.exportState = .idle }
            } catch let error as BookmarkExportBuilder.BuildError {
                await MainActor.run {
                    self?.exportState = .failed(error.localizedDescription)
                }
            } catch {
                await MainActor.run {
                    self?.exportState = .failed(error.localizedDescription)
                }
            }
        }
    }

    /// Cancels an in-flight export. The progress sheet uses this when the
    /// user taps Cancel.
    func cancelBookmarkExport() {
        activeExportTask?.cancel()
        activeExportTask = nil
        exportState = .idle
    }

    /// Resets export state after the share sheet dismisses so the sheet
    /// won't be re-presented by SwiftUI on the next state change.
    func clearBookmarkExportState() {
        activeExportTask = nil
        exportState = .idle
    }

    /// Wipes every folder + membership row. Wired into the existing Settings
    /// clear-data flow so users can reset their organization without losing
    /// the underlying bookmarks.
    func clearAllFolders() {
        guard let selectedVersion, let userContentRepository else { return }
        do {
            try userContentRepository.clearAllFolders(codeVersion: selectedVersion.codeVersion)
            refreshFolders()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    @discardableResult
    func toggleBookmark(sectionID: Int64) -> Bool {
        guard let selectedVersion, let userContentRepository else { return false }
        do {
            if !bookmarkedSectionIDs.contains(sectionID) {
                let bookmarkCount = try bookmarkCountForEntitlements(codeVersion: selectedVersion.codeVersion)
                guard !denyIfNeeded(entitlementService.canCreateSavedSection(currentCount: bookmarkCount)) else {
                    return false
                }
            }
            try userContentRepository.toggleBookmark(sectionID: sectionID, codeVersion: selectedVersion.codeVersion)
            refreshBookmarks()
            scheduleUserContentAutoSync()
            return bookmarkedSectionIDs.contains(sectionID)
        } catch {
            statusMessage = error.localizedDescription
            return bookmarkedSectionIDs.contains(sectionID)
        }
    }

    func isBookmarked(sectionID: Int64) -> Bool {
        guard selectedVersion != nil, userContentRepository != nil else { return false }
        return bookmarkedSectionIDs.contains(sectionID)
    }

    func noteBody(sectionID: Int64) -> String {
        guard let selectedVersion, let userContentRepository else { return "" }
        return (try? userContentRepository.noteBody(sectionID: sectionID, codeVersion: selectedVersion.codeVersion)) ?? ""
    }

    func saveNote(sectionID: Int64, body: String) {
        guard let selectedVersion, let userContentRepository else { return }
        do {
            let trimmedBody = body.trimmingCharacters(in: .whitespacesAndNewlines)
            let existingBody = try userContentRepository.noteBody(sectionID: sectionID, codeVersion: selectedVersion.codeVersion)
            if !trimmedBody.isEmpty && existingBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                let noteCount = try noteCountForEntitlements(codeVersion: selectedVersion.codeVersion)
                guard !denyIfNeeded(entitlementService.canCreateNote(currentCount: noteCount)) else {
                    return
                }
            }
            // Note edits do not change the bookmark set, so we skip the heavy
            // `refreshBookmarks` pass that previously fired on every keystroke.
            // BookmarksView re-reads notes from disk on appear, and the note
            // editor re-reads via `noteBody(sectionID:)` when it opens.
            try userContentRepository.saveNote(sectionID: sectionID, codeVersion: selectedVersion.codeVersion, body: body)
            scheduleUserContentAutoSync()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    // MARK: - Tags

    /// Starter tag set that shows up as suggestions on every bookmark. The
    /// list is intentionally short and architecture-focused; users can still
    /// add anything they want on top.
    nonisolated static let starterBookmarkTags: [String] = [
        "Egress",
        "Fire Rating",
        "Accessibility",
        "Occupancy",
        "Construction Type",
        "Shafts",
        "Mechanical",
        "Plumbing",
        "Energy",
        "Structural",
        "Existing Building",
        "Special Inspections",
        "Alteration",
        "Mixed-Use",
        "Residential"
    ]

    /// Returns the tags currently saved for one section.
    func tags(sectionID: Int64) -> [String] {
        guard let selectedVersion, let userContentRepository else { return [] }
        return (try? userContentRepository.tags(sectionID: sectionID, codeVersion: selectedVersion.codeVersion)) ?? []
    }

    /// Replaces a section's tag set. Empty array clears all tags for it.
    @discardableResult
    func setTags(_ tags: [String], sectionID: Int64) -> Bool {
        guard let selectedVersion, let userContentRepository else { return false }
        do {
            if !tags.isEmpty {
                guard !denyIfNeeded(entitlementService.canUse(.advancedOrganization)) else {
                    return false
                }
            }
            try userContentRepository.setTags(tags, sectionID: sectionID, codeVersion: selectedVersion.codeVersion)
            refreshBookmarks()
            scheduleUserContentAutoSync()
            return true
        } catch {
            statusMessage = error.localizedDescription
            return false
        }
    }

    /// Every tag in use for the current code version with how many bookmarks
    /// carry it. Sorted by usage (most-used first), then alphabetically.
    func tagUsageCounts() -> [(tag: String, count: Int)] {
        guard let selectedVersion, let userContentRepository else { return [] }
        return (try? userContentRepository.tagUsageCounts(codeVersion: selectedVersion.codeVersion)) ?? []
    }

    func clearAllBookmarks() {
        guard let selectedVersion, let userContentRepository else { return }
        do {
            try userContentRepository.clearBookmarks(codeVersion: selectedVersion.codeVersion)
            refreshBookmarks()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func clearAllNotes() {
        guard let selectedVersion, let userContentRepository else { return }
        do {
            try userContentRepository.clearNotes(codeVersion: selectedVersion.codeVersion)
            refreshBookmarks()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    func clearAllTags() {
        guard let selectedVersion, let userContentRepository else { return }
        do {
            try userContentRepository.clearAllTags(codeVersion: selectedVersion.codeVersion)
            refreshBookmarks()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func openSelectedContent() {
        contentLoadTask?.cancel()
        clearCaches()
        isInitialContentLoaded = false
        initialLoadProgress = 0
        guard let selectedVersion else {
            codeSections = []
            selectedCodeSectionID = nil
            chapters = []
            searchResults = []
            bookmarks = []
            codeDatabase = nil
            authoredCodeStore = nil
            statusMessage = "Bundle authored content or a generated SQLite database to browse code content."
            initialLoadProgress = 1
            isInitialContentLoaded = true
            return
        }

        searchResults = []
        bookmarks = []
        statusMessage = "Loading \(selectedVersion.displayName)..."

        switch selectedVersion.contentKind {
        case .sqlite:
            authoredCodeStore = nil
            codeSections = []
            selectedCodeSectionID = nil
            contentLoadTask = Task {
                do {
                    let snapshot = try await Task.detached(priority: .userInitiated) {
                        try Self.loadSQLiteContentSnapshot(version: selectedVersion)
                    }.value
                    guard !Task.isCancelled else { return }

                    self.codeDatabase = snapshot.database
                    self.sqliteChapterLoader = snapshot.loader
                    self.initialLoadProgress = 0.35
                    self.chapters = snapshot.chapters
                    self.refreshBookmarks()
                    self.initialLoadProgress = 0.55
                    await self.prewarmSQLiteContent(chapters: snapshot.chapters)
                    guard !Task.isCancelled else { return }
                    self.initialLoadProgress = 0.9
                    self.preloadLastOpenedChapterIfNeeded()
                    self.statusMessage = nil
                    self.initialLoadProgress = 1
                    self.isInitialContentLoaded = true
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
                    self.initialLoadProgress = 1
                    self.isInitialContentLoaded = true
                }
            }
        case .authored:
            let selectedCodeSectionID = self.selectedCodeSectionID
                ?? storedCodeSectionID()
            contentLoadTask = Task {
                do {
                    let snapshot = try await Task.detached(priority: .userInitiated) {
                        try Self.loadAuthoredContentSnapshot(
                            version: selectedVersion,
                            selectedCodeSectionID: selectedCodeSectionID
                        )
                    }.value
                    guard !Task.isCancelled else { return }

                    self.initialLoadProgress = 0.35
                    self.codeDatabase = nil
                    self.sqliteChapterLoader = nil
                    self.authoredCodeStore = snapshot.store
                    self.codeSections = snapshot.codeSections
                    self.selectedCodeSectionID = snapshot.resolvedCodeSectionID
                    self.chapters = snapshot.chapters
                    self.searchResults = []
                    self.refreshBookmarks()
                    self.initialLoadProgress = 0.55
                    await self.prewarmAuthoredContent(
                        version: selectedVersion,
                        chapters: snapshot.chapters,
                        store: snapshot.store
                    )
                    guard !Task.isCancelled else { return }
                    self.initialLoadProgress = 0.9
                    self.preloadLastOpenedChapterIfNeeded()
                    self.statusMessage = nil
                    self.initialLoadProgress = 1
                    self.isInitialContentLoaded = true
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
                    self.initialLoadProgress = 1
                    self.isInitialContentLoaded = true
                }
            }
        }
    }

    private nonisolated static func loadSQLiteContentSnapshot(
        version: BundledCodeVersion
    ) throws -> SQLiteContentSnapshot {
        let database = try CodeDatabase(databaseURL: version.fileURL, locator: BundleDatabaseLocator())
        let loader = try SQLiteChapterLoader(databaseURL: version.fileURL)
        let chapters = try database.chapters()
        return SQLiteContentSnapshot(database: database, loader: loader, chapters: chapters)
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
        let authoredChapters = store.chapters(codeSectionID: resolvedCodeSectionID)
        let chapters = authoredChapters + Self.htmlOnlyAppendixChapters(
            version: version,
            codeSectionID: resolvedCodeSectionID,
            existingChapters: authoredChapters
        )
        return AuthoredContentSnapshot(
            store: store,
            codeSections: Self.sortedCodeSections(availableCodeSections),
            resolvedCodeSectionID: resolvedCodeSectionID,
            chapters: chapters
        )
    }

    private func storedCodeSectionID() -> Int64? {
        continuityStore.load().selectedCodeSectionID
    }

    private nonisolated static func inlineHTMLTextBlock(
        html: String,
        fallbackText: String,
        theme: ReaderTheme
    ) -> NSAttributedString {
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = theme.lineSpacing
        paragraphStyle.paragraphSpacing = min(theme.paragraphSpacing, 4)

        let baseAttributes: [NSAttributedString.Key: Any] = [
            .font: theme.bodyFont,
            .foregroundColor: UIColor.label,
            .paragraphStyle: paragraphStyle
        ]
        let attributed = NSMutableAttributedString(string: "", attributes: baseAttributes)
        var styleStack: [(bold: Bool, italic: Bool)] = [(false, false)]
        var cursor = html.startIndex

        while cursor < html.endIndex {
            guard let tagRange = html.range(of: #"<[^>]+>"#, options: .regularExpression, range: cursor..<html.endIndex) else {
                appendHTMLText(String(html[cursor..<html.endIndex]), to: attributed, style: styleStack.last ?? (false, false), theme: theme, paragraphStyle: paragraphStyle)
                break
            }

            appendHTMLText(String(html[cursor..<tagRange.lowerBound]), to: attributed, style: styleStack.last ?? (false, false), theme: theme, paragraphStyle: paragraphStyle)
            let tag = String(html[tagRange])
            let lowercasedTag = tag.lowercased()

            if lowercasedTag.hasPrefix("<br") || lowercasedTag.hasPrefix("</div") || lowercasedTag.hasPrefix("</p") || lowercasedTag.hasPrefix("</li") {
                appendNewlineIfNeeded(to: attributed, attributes: baseAttributes)
            } else if lowercasedTag.hasPrefix("<b") || lowercasedTag.hasPrefix("<strong") {
                let current = styleStack.last ?? (false, false)
                styleStack.append((true, current.italic))
            } else if lowercasedTag.hasPrefix("</b") || lowercasedTag.hasPrefix("</strong") {
                if styleStack.count > 1 { styleStack.removeLast() }
            } else if lowercasedTag.hasPrefix("<i") || lowercasedTag.hasPrefix("<em") {
                let current = styleStack.last ?? (false, false)
                styleStack.append((current.bold, true))
            } else if lowercasedTag.hasPrefix("</i") || lowercasedTag.hasPrefix("</em") {
                if styleStack.count > 1 { styleStack.removeLast() }
            } else if lowercasedTag.contains("font-weight: bold") || lowercasedTag.contains("font-weight:bold") || lowercasedTag.contains("font-style: italic") || lowercasedTag.contains("font-style:italic") {
                let current = styleStack.last ?? (false, false)
                styleStack.append((
                    current.bold || lowercasedTag.contains("font-weight: bold") || lowercasedTag.contains("font-weight:bold"),
                    current.italic || lowercasedTag.contains("font-style: italic") || lowercasedTag.contains("font-style:italic")
                ))
            } else if lowercasedTag.hasPrefix("</span") {
                if styleStack.count > 1 { styleStack.removeLast() }
            }

            cursor = tagRange.upperBound
        }

        normalizeInlineHTMLAttributedText(in: attributed)
        trimWhitespace(in: attributed)
        if attributed.string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            attributed.append(NSAttributedString(string: fallbackText, attributes: baseAttributes))
        }
        return attributed
    }

    private nonisolated static func appendHTMLText(
        _ rawText: String,
        to attributed: NSMutableAttributedString,
        style: (bold: Bool, italic: Bool),
        theme: ReaderTheme,
        paragraphStyle: NSParagraphStyle
    ) {
        let decoded = decodeInlineHTMLEntities(rawText)
            .replacingOccurrences(of: #"\r\n?"#, with: "\n", options: .regularExpression)
            .replacingOccurrences(of: #"\n+"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"[ \t\f]+"#, with: " ", options: .regularExpression)
        guard !decoded.isEmpty else { return }

        let font: UIFont
        if style.bold && style.italic,
           let descriptor = theme.boldFont.fontDescriptor.withSymbolicTraits([.traitBold, .traitItalic]) {
            font = UIFont(descriptor: descriptor, size: theme.fontSize)
        } else if style.bold {
            font = theme.boldFont
        } else if style.italic {
            font = theme.italicFont
        } else {
            font = theme.bodyFont
        }

        attributed.append(
            NSAttributedString(
                string: decoded,
                attributes: [
                    .font: font,
                    .foregroundColor: UIColor.label,
                    .paragraphStyle: paragraphStyle
                ]
            )
        )
    }

    private nonisolated static func normalizeInlineHTMLAttributedText(
        in attributed: NSMutableAttributedString
    ) {
        let fullRange = NSRange(location: 0, length: attributed.length)
        guard fullRange.length > 0 else { return }

        let replacements: [(pattern: String, template: String)] = [
            (#"[ \t]+\n"#, "\n"),
            (#"\n{3,}"#, "\n\n"),
            (#"\n([\.\,\;\:\)])"#, "$1"),
            (#"([\(])\n"#, "$1"),
            (#"([^\n])\n([a-z0-9])"#, "$1 $2"),
            (#" {2,}"#, " ")
        ]

        for (pattern, template) in replacements {
            guard let expression = try? NSRegularExpression(pattern: pattern, options: []) else { continue }
            expression.replaceMatches(
                in: attributed.mutableString,
                options: [],
                range: NSRange(location: 0, length: attributed.length),
                withTemplate: template
            )
        }
    }

    private nonisolated static func appendNewlineIfNeeded(
        to attributed: NSMutableAttributedString,
        attributes: [NSAttributedString.Key: Any]
    ) {
        guard !attributed.string.hasSuffix("\n") else { return }
        attributed.append(NSAttributedString(string: "\n", attributes: attributes))
    }

    private nonisolated static func decodeInlineHTMLEntities(_ text: String) -> String {
        var decoded = text
        let replacements = [
            "&nbsp;": " ",
            "&#160;": " ",
            "&amp;": "&",
            "&lt;": "<",
            "&gt;": ">",
            "&quot;": "\"",
            "&#39;": "'",
            "&#176;": "°",
            "&#8211;": "-",
            "&#8212;": "-",
            "&#8216;": "'",
            "&#8217;": "'",
            "&#8220;": "\"",
            "&#8221;": "\""
        ]
        for (entity, replacement) in replacements {
            decoded = decoded.replacingOccurrences(of: entity, with: replacement)
        }
        return decoded
    }

    private nonisolated static func trimWhitespace(in attributed: NSMutableAttributedString) {
        while attributed.length > 0,
              let first = attributed.string.first,
              first.isWhitespace {
            attributed.deleteCharacters(in: NSRange(location: 0, length: 1))
        }
        while attributed.length > 0,
              let last = attributed.string.last,
              last.isWhitespace {
            attributed.deleteCharacters(in: NSRange(location: attributed.length - 1, length: 1))
        }
    }

    private nonisolated static func htmlOnlyAppendixChapters(
        version: BundledCodeVersion,
        codeSectionID: Int64?,
        existingChapters: [CodeChapter]
    ) -> [CodeChapter] {
        guard let authoredHTMLBundlePath = version.authoredHTMLBundlePath else { return [] }

        let existingNumbers = Set(existingChapters.map { $0.chapterNumber.uppercased() })
        let chaptersURL = version.fileURL
            .deletingLastPathComponent()
            .appendingPathComponent("chapters", isDirectory: true)
        guard let chapterURLs = try? FileManager.default.contentsOfDirectory(
            at: chaptersURL,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else {
            _ = authoredHTMLBundlePath
            return []
        }

        return chapterURLs.compactMap { url -> CodeChapter? in
            guard url.pathExtension.lowercased() == "html" else { return nil }
            let chapterNumber = url.deletingPathExtension().lastPathComponent.uppercased()
            guard chapterNumber.rangeOfCharacter(from: .letters) != nil,
                  existingNumbers.contains(chapterNumber) == false
            else {
                return nil
            }

            return CodeChapter(
                id: Self.syntheticChapterID(for: chapterNumber),
                codeSectionID: codeSectionID,
                chapterNumber: chapterNumber,
                title: Self.htmlChapterTitle(in: url, chapterNumber: chapterNumber)
            )
        }
        .sorted {
            $0.chapterNumber.compare($1.chapterNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
        }
    }

    private nonisolated static func syntheticChapterID(for chapterNumber: String) -> Int64 {
        let value = chapterNumber.unicodeScalars.reduce(Int64(0)) { partial, scalar in
            partial * 31 + Int64(scalar.value)
        }
        return -1_000_000 - value
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

    private nonisolated static func syntheticSectionID(for chapterNumber: String, sectionNumber: String) -> Int64 {
        let value = "\(chapterNumber):\(sectionNumber)".unicodeScalars.reduce(Int64(0)) { partial, scalar in
            partial * 31 + Int64(scalar.value)
        }
        return -2_000_000 - value
    }

    private nonisolated static func htmlChapterTitle(in url: URL, chapterNumber: String) -> String {
        guard let html = try? String(contentsOf: url, encoding: .utf8),
              let expression = try? NSRegularExpression(
                pattern: #"<div\s+id="[^"]+"[^>]*class="[^"]*Subarticle[^"]*"[^>]*>.*?<h6[^>]*>(.*?)</h6>"#,
                options: [.caseInsensitive, .dotMatchesLineSeparators]
              )
        else {
            return "Appendix \(chapterNumber)"
        }

        let nsHTML = html as NSString
        let range = NSRange(location: 0, length: nsHTML.length)
        guard let match = expression.firstMatch(in: html, range: range),
              match.numberOfRanges > 1
        else {
            return "Appendix \(chapterNumber)"
        }

        let heading = nsHTML.substring(with: match.range(at: 1))
            .replacingOccurrences(of: #"<[^>]+>"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&#160;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"^#-+\s*"#, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let appendixPrefix = "Appendix \(chapterNumber)"
        if heading.localizedCaseInsensitiveCompare(appendixPrefix) == .orderedSame {
            return appendixPrefix
        }
        if heading.lowercased().hasPrefix((appendixPrefix + ":").lowercased()) {
            return heading
                .dropFirst((appendixPrefix + ":").count)
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return heading
    }

    private func prewarmAuthoredContent(
        version: BundledCodeVersion,
        chapters: [CodeChapter],
        store: AuthoredCodeStore
    ) async {
        _ = version
        // Warm the search index in the background so the first search doesn't
        // pay the cost of reading + JSON-decoding the 3 MB searchIndex.json on
        // the user's first keystroke.
        await Task.detached(priority: .background) {
            store.warmSearchIndex()
        }.value

        await prewarmStartupPriorityChapters(chapters)

        let chapterIDs = chapters.map(\.id)
        let sectionIDs = await Task.detached(priority: .utility) {
            store.firstSectionIDs(chapterIDs: chapterIDs)
        }.value
        await prewarmSectionDetails(sectionIDs)
    }

    private func prewarmSQLiteContent(chapters: [CodeChapter]) async {
        await prewarmStartupPriorityChapters(chapters)

        guard let sqliteChapterLoader else { return }
        do {
            let sectionIDs = try await sqliteChapterLoader.firstSectionIDs(chapterIDs: chapters.map(\.id))
            await prewarmSectionDetails(sectionIDs)
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func prewarmStartupPriorityChapters(_ chapters: [CodeChapter]) async {
        let prioritized = startupPriorityChapters(from: chapters)
        guard !prioritized.isEmpty else { return }

        for chapter in prioritized {
            if Task.isCancelled { return }
            await warmChapterReaderEntry(chapter: chapter, sectionLimit: 8)
            initialLoadProgress = min(0.72, initialLoadProgress + 0.04)
            await Task.yield()
        }
    }

    private func startupPriorityChapters(from chapters: [CodeChapter]) -> [CodeChapter] {
        guard !chapters.isEmpty else { return [] }

        var prioritized: [CodeChapter] = []
        let lastOpenedChapterID = continuityStore.load().lastOpenedChapterID

        func append(_ chapter: CodeChapter?) {
            guard let chapter,
                  prioritized.contains(where: { $0.id == chapter.id }) == false
            else {
                return
            }
            prioritized.append(chapter)
        }

        append(chapters.first { $0.id == lastOpenedChapterID })
        append(chapters.first)
        for chapter in chapters.prefix(4) {
            append(chapter)
        }

        return prioritized
    }

    private func warmChapterReaderEntry(chapter: CodeChapter, sectionLimit: Int) async {
        if let htmlTarget = authoredHTMLWarmupTarget(for: chapter) {
            await Task.detached(priority: .utility) {
                PreparedChapterHTMLCache.preload(
                    chapterURL: htmlTarget.chapterURL,
                    readAccessURL: htmlTarget.readAccessURL
                )
                _ = PublishedHTMLContentStore.anchors(in: htmlTarget.chapterURL)
            }.value
        }

        let descriptors = await chapterBlockDescriptors(for: chapter)
        guard !descriptors.isEmpty else {
            warmedChapterIDs.insert(chapter.id)
            return
        }

        let sectionIDs = Array(descriptors.prefix(sectionLimit).map(\.sectionID))
        let details = await loadSectionDetailsAsync(sectionIDs: sectionIDs)

        if authoredHTMLWarmupTarget(for: chapter) == nil {
            for detail in details {
                if Task.isCancelled { return }
                _ = await chapterBodyNSTextAsync(for: detail)
            }
        }

        warmedChapterIDs.insert(chapter.id)
    }

    private func authoredHTMLWarmupTarget(for chapter: CodeChapter) -> (chapterURL: URL, readAccessURL: URL)? {
        guard selectedVersion?.contentKind == .authored else { return nil }
        let htmlStore = authoredHTMLStore(for: chapter)
        guard let chapterURL = htmlStore.chapterURL(chapterNumber: chapter.chapterNumber),
              let readAccessURL = htmlStore.readAccessURL()
        else {
            return nil
        }
        return (chapterURL, readAccessURL)
    }

    private func prewarmSectionDetails(_ sectionIDs: [Int64]) async {
        guard !sectionIDs.isEmpty else { return }

        let batchSize = 24
        let total = max(sectionIDs.count, 1)
        var loadedCount = 0
        for startIndex in stride(from: 0, to: sectionIDs.count, by: batchSize) {
            if Task.isCancelled { return }
            let endIndex = min(startIndex + batchSize, sectionIDs.count)
            let batch = Array(sectionIDs[startIndex..<endIndex])
            _ = await loadSectionDetailsAsync(sectionIDs: batch)
            loadedCount += batch.count
            let progress = Double(loadedCount) / Double(total)
            initialLoadProgress = min(0.9, 0.55 + (progress * 0.35))
            await Task.yield()
        }
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

    private nonisolated static let sharedFormattingEngine = FormattingEngine()

    private nonisolated static func formattedText(detail: ReaderSectionDetail, theme: ReaderTheme) -> AttributedString {
        let formattingEngine = sharedFormattingEngine
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

    private func cachedSectionDetail(for sectionID: Int64) -> ReaderSectionDetail? {
        sectionDetailCache.object(forKey: NSNumber(value: sectionID))?.detail
    }

    private func storeSectionDetailInCache(_ detail: ReaderSectionDetail, sectionID: Int64) {
        sectionDetailCache.setObject(
            CachedReaderSectionDetail(detail),
            forKey: NSNumber(value: sectionID),
            cost: Self.sectionDetailMemoryCost(detail)
        )
    }

    private func clearCaches() {
        lastChapterPreloadTask?.cancel()
        codeSectionWarmupTask?.cancel()
        chapterWarmupTasks.values.forEach { $0.cancel() }
        lastChapterPreloadTask = nil
        codeSectionWarmupTask = nil
        chapterWarmupTasks.removeAll()
        warmedChapterIDs.removeAll()
        sectionsCache.removeAll()
        sectionGroupsCache.removeAll()
        sectionDetailCache.removeAllObjects()
        formattedNSTextCache.removeAllObjects()
        chapterBodyNSTextCache.removeAllObjects()
        bookmarkedSectionIDs.removeAll()
        searchTask?.cancel()
    }

    private static func formattedTextCacheKey(sectionID: Int64, theme: ReaderTheme) -> NSString {
        "\(sectionID)|\(theme.hashValue)" as NSString
    }

    private static func sectionDetailMemoryCost(_ detail: ReaderSectionDetail) -> Int {
        var cost = stringMemoryCost(detail.officialText)
            + stringMemoryCost(detail.title)
            + stringMemoryCost(detail.chapterTitle)
        for block in detail.contentBlocks {
            cost += stringMemoryCost(block.html ?? "")
            cost += stringMemoryCost(block.plainText ?? "")
            cost += stringMemoryCost(block.caption ?? "")
        }
        for table in detail.tableBlocks {
            cost += stringMemoryCost(table.caption ?? "")
            cost += table.cells.reduce(0) { $0 + stringMemoryCost($1.plainText) + stringMemoryCost($1.html) }
        }
        return max(cost, 1)
    }

    private static func attributedTextMemoryCost(_ value: NSAttributedString) -> Int {
        max(stringMemoryCost(value.string) * 3, 1)
    }

    private static func stringMemoryCost(_ value: String) -> Int {
        max(value.utf8.count, value.utf16.count * 2)
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

    func firstSectionIDs(chapterIDs: [Int64]) throws -> [Int64] {
        try database.firstSectionIDs(chapterIDs: chapterIDs)
    }
}

private final class CachedReaderSectionDetail: NSObject {
    let detail: ReaderSectionDetail

    init(_ detail: ReaderSectionDetail) {
        self.detail = detail
    }
}

private enum AccountSessionTokenStore {
    private static let service = "com.randycodex.permitext.backend-session"

    static func loadToken(accountUserID: String) -> String? {
        var query = baseQuery(accountUserID: accountUserID)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func saveToken(_ token: String?, accountUserID: String) {
        guard let token, let data = token.data(using: .utf8) else {
            deleteToken(accountUserID: accountUserID)
            return
        }

        let query = baseQuery(accountUserID: accountUserID)
        let update = [kSecValueData as String: data]
        let status = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            SecItemAdd(item as CFDictionary, nil)
        }
    }

    static func deleteToken(accountUserID: String) {
        SecItemDelete(baseQuery(accountUserID: accountUserID) as CFDictionary)
    }

    private static func baseQuery(accountUserID: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: accountUserID
        ]
    }
}

/// State machine driving the Saved screen's PDF export flow.
enum BookmarkExportState: Equatable {
    case idle
    /// `progress` in [0,1]; `sectionTitle` is the latest bookmark being
    /// processed (so the progress sheet can show a meaningful subtitle).
    case building(progress: Double, sectionTitle: String)
    case ready(url: URL, sectionCount: Int)
    case failed(String)
}
