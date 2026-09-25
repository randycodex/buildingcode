import SwiftUI
import os.signpost
import UIKit

struct SearchSessionSnapshot: Codable, Equatable, Sendable {
    var query = ""
    var codeSectionIDs: Set<Int64> = []
    var resultPositionID: String?
    var historyPositionID: String?
    var selectedResultID: Int64?
    var selectedResultIdentity: String?

    static let cacheScope = "search-session"

    static func canRestoreQuery(original: String, current: String, originalGeneration: UInt64, currentGeneration: UInt64) -> Bool {
        original == current && originalGeneration == currentGeneration
    }

    static func load(cache: ProjectHubOfflineCache, accountID: String, version: String) throws -> Self {
        try cache.load(Self.self, accountID: accountID, projectID: version, scope: cacheScope)?.value ?? Self()
    }

    func save(cache: ProjectHubOfflineCache, accountID: String, version: String) throws {
        try cache.store(self, accountID: accountID, projectID: version, scope: Self.cacheScope)
    }
}

@MainActor
enum RunningSearchSessions {
    static var snapshots: [String: SearchSessionSnapshot] = [:]
    static var nextRevision: UInt64 = 0
    static var deletionGenerations: [String: UInt64] = [:]

    static func save(_ snapshot: SearchSessionSnapshot, accountID: String, scope: String) {
        snapshots[scope] = snapshot
        nextRevision &+= 1
        let revision = nextRevision
        Task { await SearchSessionPersistence.shared.save(snapshot, accountID: accountID, revision: revision) }
    }

    static func flush(accountID: String, scope: String) {
        guard let snapshot = snapshots[scope] else { return }
        nextRevision &+= 1
        let revision = nextRevision
        Task { await SearchSessionPersistence.shared.save(snapshot, accountID: accountID,
            revision: revision, flushImmediately: true) }
    }

    static func remove(accountID: String) {
        deletionGenerations[accountID, default: 0] &+= 1
        snapshots = snapshots.filter { !$0.key.hasPrefix("\(accountID)|") }
    }
}

/// Private continuity, separate from the public completed-result cache. Actor
/// isolation keeps disk work off the UI executor and serializes persistence.
actor SearchSessionPersistence {
    static let shared = SearchSessionPersistence()
    private let cache: ProjectHubOfflineCache
    private var revisions: [String: UInt64] = [:]
    private var pending: [String: SearchSessionSnapshot] = [:]
    private static let version = "all-installed-editions"

    init(cache: ProjectHubOfflineCache = ProjectHubOfflineCache()) { self.cache = cache }

    func load(accountID: String) -> SearchSessionSnapshot {
        guard !cache.isAccountDeleted(accountID: accountID) else { return SearchSessionSnapshot() }
        if let snapshot = pending[accountID] { return snapshot }
        return (try? SearchSessionSnapshot.load(cache: cache, accountID: accountID, version: Self.version)) ?? SearchSessionSnapshot()
    }

    func flush() {
        for (accountID, snapshot) in pending {
            try? snapshot.save(cache: cache, accountID: accountID, version: Self.version)
        }
        pending.removeAll()
    }

    func save(_ snapshot: SearchSessionSnapshot, accountID: String, revision: UInt64, flushImmediately: Bool = false) async {
        guard revision > (revisions[accountID] ?? 0) else { return }
        revisions[accountID] = revision
        pending[accountID] = snapshot
        // Coalesce rapid typing/scroll updates; clearing the field is a real save.
        if !flushImmediately { try? await Task.sleep(for: .milliseconds(100)) }
        guard revisions[accountID] == revision, pending[accountID] != nil else { return }
        defer { pending.removeValue(forKey: accountID) }
        // The cache's deletion tombstone rejects writes after account deletion.
        try? snapshot.save(cache: cache, accountID: accountID, version: Self.version)
    }
}

struct SearchReaderRoute: Hashable {
    let sectionID: Int64
    let sourceVersion: String?
    let codeSectionID: Int64?
    let chapterNumber: String?
    let sectionNumber: String?
    let title: String?
    let kind: CodeSectionKind?

    init(sectionID: Int64, sourceVersion: String? = nil) {
        self.sectionID = sectionID
        self.sourceVersion = sourceVersion
        self.codeSectionID = nil
        self.chapterNumber = nil
        self.sectionNumber = nil
        self.title = nil
        self.kind = nil
    }

    init(result: CodeSearchResult) {
        sectionID = result.id
        sourceVersion = result.sourceVersion
        codeSectionID = result.codeSectionID
        chapterNumber = result.chapterNumber
        sectionNumber = result.sectionNumber
        title = result.title
        kind = result.kind
    }
}


/// Prepared offscreen without changing either main Reader's edition or viewport.
@MainActor
struct PreparedSearchReaderDestination {
    let library: CodeLibraryViewModel
    let chapter: CodeChapter
    let section: CodeSectionSummary
    let nativeOpening: NativeReaderPreparedOpening?

    static func prepare(route: SearchReaderRoute, sharedLibrary: CodeLibraryViewModel, prepareChapter: Bool = true) async throws -> Self {
        try Task.checkCancellation()
        let context = sharedLibrary.captureCodeSourceNavigationContext()
        let revision = sharedLibrary.activeCodeSourceRevision
        let sourceVersion = route.sourceVersion ?? sharedLibrary.selectedVersion?.codeVersion
        guard let sourceVersion,
              let version = sharedLibrary.availableVersions.first(where: {
                  UserContentSyncCodeVersion.server($0.codeVersion) == UserContentSyncCodeVersion.server(sourceVersion)
              }) else { throw PreparationError.unavailable }
        if version.contentKind == .authored {
            guard context != nil else { throw PreparationError.unavailable }
            let access = await sharedLibrary.authoredSourceNavigationAccess(sectionID: route.sectionID,
                canonicalEdition: sourceVersion, categoryID: route.codeSectionID)
            try Task.checkCancellation()
            guard sharedLibrary.captureCodeSourceNavigationContext() == context else { throw CancellationError() }
            switch access {
            case .allowed: break
            case .requiresEnable(let target): throw PreparationError.requiresEnable(target)
            case .unavailable: throw PreparationError.unavailable
            }
        }
        let library = sharedLibrary.makeSearchReaderLibrary(sourceVersion: sourceVersion)
        guard await library.prepareCodeVersionForEvidence(sourceVersion) else {
            throw PreparationError.unavailable
        }
        try Task.checkCancellation()
        let chapter: CodeChapter
        let section: CodeSectionSummary
        if let target = library.searchReaderTarget(sectionID: route.sectionID) {
            chapter = target.chapter
            section = target.section
        } else if let chapterNumber = route.chapterNumber, let sectionNumber = route.sectionNumber,
           let title = route.title, let kind = route.kind,
           let matched = library.chapters(for: route.codeSectionID).first(where: {
               $0.chapterNumber.caseInsensitiveCompare(chapterNumber) == .orderedSame
           }) {
            chapter = matched
            section = CodeSectionSummary(id: route.sectionID, chapterNumber: chapterNumber,
                sectionNumber: sectionNumber, title: title, kind: kind)
        } else {
            guard let detail = await library.loadSectionDetailsAsync(sectionIDs: [route.sectionID]).first,
                  let matched = library.chapters(for: detail.codeSectionID).first(where: {
                      $0.chapterNumber.caseInsensitiveCompare(detail.chapterNumber) == .orderedSame
                  }) else { throw PreparationError.unavailable }
            chapter = matched
            section = CodeSectionSummary(id: detail.id, chapterNumber: detail.chapterNumber,
                sectionNumber: detail.sectionNumber, title: detail.title, kind: detail.kind)
        }
        try Task.checkCancellation()
        var nativeOpening: NativeReaderPreparedOpening?
        if prepareChapter, let sourceURL = library.authoredHTMLStore(for: chapter).chapterURL(chapterNumber: chapter.chapterNumber),
           let nativeRoute = await NativeReaderDocumentStore.shared.rolloutRoute(for: sourceURL) {
            // Invalid/unsupported native content still takes the Reader's existing
            // HTML fallback. Never substitute a different edition or source.
            if let prepared = try? await NativeReaderDocumentStore.shared.loadPreparedDocument(for: nativeRoute) {
                nativeOpening = NativeReaderPreparedOpening(route: nativeRoute, prepared: prepared)
                if let target = NativeReaderLocationResolver.initialBlockID(in: prepared.document,
                    rememberedBlockID: nil, rememberedAnchorID: nil, initialAnchorID: nil,
                    initialSectionNumber: section.sectionNumber, initialSectionTitle: section.displayTitle),
                   let index = prepared.displayBlocks.firstIndex(where: { $0.id == target }) {
                    let range = NativeReaderAttributedTextPrefetchPlanner.indexRange(
                        blockCount: prepared.displayBlocks.count, centerIndex: index, direction: 1)
                    await NativeReaderAttributedTextCache.shared.prewarm(
                        items: NativeReaderAttributedTextPrefetchPlanner.items(for: prepared.displayBlocks[range], routeID: nativeRoute.id),
                        theme: library.readerTheme, accentColor: library.accentColor(for: chapter.codeSectionID))
                }
            }
        }
        try Task.checkCancellation()
        guard sharedLibrary.activeCodeSourceRevision == revision,
              sharedLibrary.captureCodeSourceNavigationContext() == context else { throw CancellationError() }
        return Self(library: library, chapter: chapter, section: section, nativeOpening: nativeOpening)
    }

    enum PreparationError: LocalizedError {
        case unavailable
        case requiresEnable(ActiveCodeSourceNavigationTarget)
        var errorDescription: String? { "Permitext could not locate this section in its installed code edition." }
    }
}

struct SearchView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.dismiss) private var dismiss
    @State private var historyCollection: HistoryCollection?
    private enum HistoryCollection: String, Identifiable {
        case recent = "Recent searches", pinned = "Pinned searches", viewed = "Last opened"
        var id: String { rawValue }
    }
    @State private var showsOpeningIndicator = false
    @State private var query = ""
    @State private var previewLimiter = SearchPreviewLimiter(limit: 2)
    @State private var resultPreviews: [String: String] = [:]
    @State private var expandedSearchGroups: Set<String> = []
    @State private var searchFilterCodeSectionIDs: Set<Int64>
    @State private var searchNavigationPath = NavigationPath()
    @State private var preparedDestinations: [SearchReaderRoute: PreparedSearchReaderDestination] = [:]
    @State private var showsPassageDetail = false
    @State private var openingRoute: SearchReaderRoute?
    @State private var openingQuery: String?
    @State private var openingFilters: Set<Int64>?
    @State private var openingScope: String?
    @State private var openingSourceRevision: UUID?
    @State private var openingTask: Task<Void, Never>?
    @State private var openingTimeoutTask: Task<Void, Never>?
    @State private var openingGeneration = UUID()
    private struct SourceEnablePrompt {
        let route: SearchReaderRoute
        let target: ActiveCodeSourceNavigationTarget
        let context: CodeLibraryViewModel.CodeSourceNavigationContext
        let globalProgress: Bool
    }
    @State private var showsCodeSources = false
    @State private var allInstalledSourcesDisabled: Bool?
    @State private var sourceEnablePrompt: SourceEnablePrompt?
    @State private var deepLinkError: String?
    @State private var openingError: String?
    @State private var failedOpeningRoute: SearchReaderRoute?
    @State private var showsGlobalOpeningProgress = false
    @State private var scrollOffset: CGFloat = 0
    @State private var cachedFilteredResults: [CodeSearchResult] = []
    @State private var cachedGroupedResults: [SearchResultGroup] = []
    @State private var cachedRecentEntries: [RecentlyViewedEntry] = []
    @State private var isSearchRequestPending = false
    @State private var searchDebounceTask: Task<Void, Never>?
    @State private var submittedSearchTaskID: String?
    @State private var restoredSessionScope: String?
    @State private var queryEditGeneration: UInt64 = 0
    @State private var sessionStorageMessage: String?
    @State private var lastSavedSession = SearchSessionSnapshot()
    @State private var scrollTargetID: String?
    @State private var pendingScrollTargetID: String?
    @State private var resultPositionID: String?
    @State private var historyPositionID: String?
    @State private var selectedResultID: Int64?
    @State private var selectedResultIdentity: String?
    @State private var needsPositionReset = false
    @FocusState private var isSearchFieldFocused: Bool


    private var sessionAccountID: String { library.signedInAccount?.appUserID ?? "permitext-signed-out-search" }
    private var sessionScope: String { "\(sessionAccountID)|all-installed-editions" }

    private let contentHorizontalInset: CGFloat = CodeScreenMetrics.screenHorizontalPadding
    private let tabBarClearance: CGFloat = CodeScreenMetrics.searchTabBarClearance

    private var accentColor: Color {
        Color(uiColor: library.accentColor())
    }

    private var collapseProgress: CGFloat {
        min(max(-scrollOffset / 64, 0), 1)
    }

    private var activeSearchFilterCodeSectionIDs: Set<Int64> {
        // Later editions may still be loading; do not silently drop their
        // selected filters and temporarily show results from other editions.
        return searchFilterCodeSectionIDs
    }

    private var searchTaskID: String {
        "\(sessionScope):\(restoredSessionScope ?? ""):\(library.activeCodeSourceRevision.uuidString):\(library.searchContentRevision.uuidString): \(library.selectedVersionFileName):\(library.selectedCodeSectionID ?? 0):\(library.isInitialContentLoaded):\(query)"
    }

    private var isHistoryVisible: Bool { query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    private var positionReady: Bool {
        restoredSessionScope == sessionScope && (isHistoryVisible || (!isSearchRequestPending && !library.isSearchInProgress && !cachedFilteredResults.isEmpty))
    }
    private var scrollPositionBinding: Binding<String?> {
        Binding(get: { scrollTargetID }, set: { value in
            guard positionReady, !needsPositionReset, pendingScrollTargetID == nil, let value else { return }
            scrollTargetID = value
            if isHistoryVisible { historyPositionID = value } else { resultPositionID = value }
            persistSearchSession()
        })
    }

    init() {
        _searchFilterCodeSectionIDs = State(initialValue: [])
    }

    var body: some View {
        NavigationStack(path: $searchNavigationPath) {
            ScrollView {
                GeometryReader { proxy in
                    Color.clear
                        .preference(key: CodeScrollOffsetPreferenceKey.self, value: proxy.frame(in: .named("searchScroll")).minY)
                }
                .frame(height: 0)

                VStack(alignment: .leading, spacing: CodeScreenMetrics.contentSpacingBelowTitle) {

                    if showsGlobalOpeningProgress, let openingRoute {
                        readerOpeningProgress(for: openingRoute)
                    }
                    if let deepLinkError {
                        Text(deepLinkError).font(.callout).foregroundStyle(.secondary)
                            .accessibilityIdentifier("search-deep-link-error")
                    }
                    if let openingError, let failedOpeningRoute {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(openingError).font(.callout).foregroundStyle(.secondary)
                            Button("Retry opening section") { openReader(failedOpeningRoute, globalProgress: true) }
                        }
                        .accessibilityIdentifier("search-reader-opening-error")
                    }

                    HStack {
                        Text(library.activeCodeSources == nil ? "Code source preferences unavailable" : (allInstalledSourcesDisabled == true ? "No code sources enabled" : (hasDisabledCodeSources ? "Searching enabled code sources" : "All installed code sources")))
                            .font(.footnote).foregroundStyle(.secondary)
                        Spacer()
                        Button("Manage code sources") { showsCodeSources = true }
                            .font(.footnote)
                    }
                    .accessibilityIdentifier("search-manage-code-sources")
                    if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        searchResultSummary
                        if !library.allEditionSearchWarnings.isEmpty {
                            Text("Some editions could not be searched. Results from available editions are shown.")
                                .font(.footnote).foregroundStyle(.secondary)
                            ForEach(library.allEditionSearchWarnings, id: \.self) { Text($0).font(.caption) }
                            Button("Retry unavailable editions") { library.searchAllEditions(query: query) }
                        }
                    }
                    if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        emptyQueryHistorySection
                    } else if isSearchRequestPending || (library.isSearchInProgress && cachedFilteredResults.isEmpty) {
                        searchLoadingState
                    } else if let error = library.allEditionSearchError {
                        VStack(spacing: 12) {
                            ContentUnavailableView("Search unavailable", systemImage: "magnifyingglass",
                                description: Text(error))
                            Button("Try Again") { library.searchAllEditions(query: query) }
                        }
                    } else if cachedFilteredResults.isEmpty {
                        noResultsState
                    } else {
                        // Each header/result is a direct lazy-stack child. A family-wide
                        // VStack would eagerly build every expanded result and its preview task.
                        LazyVStack(alignment: .leading, spacing: 0) {
                            ForEach(searchFamilies) { family in
                                Text(family.id)
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(.primary)
                                    .padding(.bottom, 4)
                                    .accessibilityAddTraits(.isHeader)
                                    .accessibilityIdentifier("search-family-\(family.id)")
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.horizontal, 16)
                                    .padding(.top, 16)
                                    .background(Color(uiColor: .secondarySystemGroupedBackground),
                                        in: UnevenRoundedRectangle(topLeadingRadius: 22, topTrailingRadius: 22, style: .continuous))
                                    .id("family:\(family.id)")
                                ForEach(family.groups) { group in
                                    VStack(spacing: 0) {
                                        sectionGroupHeader(group)
                                        Divider()
                                    }
                                    .padding(.horizontal, 16)
                                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                                    if expandedSearchGroups.contains(group.id) {
                                        ForEach(group.results, id: \.searchIdentity) { result in
                                            searchResultLink(result, groupID: group.id)
                                                .padding(.horizontal, 16)
                                                .background(Color(uiColor: .secondarySystemGroupedBackground))
                                        }
                                    }
                                }
                                Color(uiColor: .secondarySystemGroupedBackground)
                                    .frame(height: 16)
                                    .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 22, bottomTrailingRadius: 22, style: .continuous))
                                    .padding(.bottom, 12)
                            }
                            if library.isSearchInProgress {
                                HStack(spacing: 8) {
                                    ProgressView().controlSize(.small)
                                    Text("Searching more editions…").font(.caption).foregroundStyle(.secondary)
                                }
                                .padding(.vertical, 12)
                            }
                        }
                        .scrollTargetLayout()
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(.horizontal, contentHorizontalInset)
                .padding(.top, 8)
                .padding(.bottom, 16)
            }
            .accessibilityIdentifier("search-results-scroll")
            .scrollPosition(id: scrollPositionBinding, anchor: .top)
            .task(id: "\(positionReady):\(pendingScrollTargetID ?? ""):\(needsPositionReset)") {
                guard positionReady else { return }
                let target = needsPositionReset
                    ? (isHistoryVisible ? historyPositionID : cachedGroupedResults.first.map { "family:\($0.familyName)" })
                    : pendingScrollTargetID
                guard let target else { needsPositionReset = false; return }
                await Task.yield()
                guard !Task.isCancelled, positionReady else { return }
                scrollTargetID = target
                pendingScrollTargetID = nil
                needsPositionReset = false
            }
            .contentShape(Rectangle())
            .onTapGesture {
                dismissKeyboard()
            }
            .contentMargins(.bottom, 76, for: .scrollContent)
            .overlay(alignment: .bottom) {
                searchField
                    .padding(.horizontal, CodeScreenMetrics.bottomControlHorizontalPadding)
                    .padding(.bottom, CodeScreenMetrics.sectionSpacingBelowEyebrow)
            }
            .scrollDismissesKeyboard(.immediately)
            .scrollIndicators(.hidden)
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .navigationBar)
            .onAppear {
                rebuildSearchCaches()
                rebuildJumpBackInCache()
                scheduleSearch()
                if library.pendingDeepLinkedSectionID != nil {
                    openPendingDeepLinkedSectionIfNeeded()
                    return
                }
            }
            .onChange(of: searchFilterCodeSectionIDs) { _, _ in
                cancelReaderOpeningIfSearchChanged()
                rebuildSearchCaches()
                resetPositionForChangedSearch()
                persistSearchSession()
            }
            .onChange(of: query) { _, _ in
                queryEditGeneration &+= 1
                expandedSearchGroups.removeAll()
                resultPreviews.removeAll()
                cancelReaderOpeningIfSearchChanged()
                isSearchRequestPending = !isHistoryVisible
                resetPositionForChangedSearch()
                persistSearchSession()
            }
            .onChange(of: library.searchResults) { _, _ in
                rebuildSearchCaches()
            }
            .onChange(of: library.allEditionSearchSections) { _, _ in
                rebuildSearchCaches()
            }
            .onChange(of: library.recentlyViewedSections) { _, _ in
                rebuildJumpBackInCache()
            }
            .onChange(of: library.searchTabRetapCount) { _, _ in
                handleSearchTabRetap()
            }
            .onChange(of: library.pendingDeepLinkedSectionID) { _, _ in
                openPendingDeepLinkedSectionIfNeeded()
            }
            .onChange(of: library.isInitialContentLoaded) { _, isLoaded in
                if isLoaded {
                    openPendingDeepLinkedSectionIfNeeded()
                }
            }
            .onChange(of: sessionScope) { _, _ in
                resultPreviews.removeAll()
                if let openingScope, openingScope != sessionScope { cancelReaderOpening() }
            }
            .onChange(of: library.activeCodeSourceRevision) { _, revision in
                if let openingSourceRevision, openingSourceRevision != revision {
                    cancelReaderOpening()
                }
                if let prompt = sourceEnablePrompt,
                   library.captureCodeSourceNavigationContext() != prompt.context {
                    sourceEnablePrompt = nil
                }
            }
            .alert("Enable this code source?", isPresented: Binding(
                get: { sourceEnablePrompt != nil },
                set: { if !$0 { sourceEnablePrompt = nil } }
            ), presenting: sourceEnablePrompt) { prompt in
                Button("Enable and open") {
                    sourceEnablePrompt = nil
                    guard library.captureCodeSourceNavigationContext() == prompt.context else { return }
                    guard library.enableCodeSourceForNavigation(source: prompt.target.source, context: prompt.context) else {
                        openingError = "This code source could not be enabled. Try opening the section again."
                        failedOpeningRoute = prompt.route
                        return
                    }
                    openReader(prompt.route, globalProgress: prompt.globalProgress)
                }
                Button("Cancel", role: .cancel) { sourceEnablePrompt = nil }
            } message: { prompt in
                Text("This passage belongs to a code source you turned off (\(NativeReaderEditionLabel.label(for: prompt.target.source.canonicalEdition))). Enable it to open the original passage in its exact edition.")
            }
            .onChange(of: library.selectedTab) { _, tab in
                if tab != .search { cancelReaderOpening() }
            }
            .onDisappear {
                cancelReaderOpening()
                persistSearchSession()
                RunningSearchSessions.flush(accountID: sessionAccountID, scope: sessionScope)
            }
            .onChange(of: scenePhase) { _, phase in
                if phase != .active {
                    persistSearchSession()
                    RunningSearchSessions.flush(accountID: sessionAccountID, scope: sessionScope)
                }
            }
            .task(id: sessionScope) {
                await restoreSearchSession()
            }
            .onChange(of: searchTaskID, initial: true) { _, _ in
                scheduleSearch()
            }
            .task(id: "\(library.activeCodeSourceRevision):\(library.availableVersions.map(\.fileName).sorted())") {
                allInstalledSourcesDisabled = nil
                guard let preferences = library.activeCodeSources,
                      !preferences.disabledSources.isEmpty else { return }
                guard !library.availableVersions.contains(where: { $0.contentKind == .sqlite }) else {
                    allInstalledSourcesDisabled = false
                    return
                }
                let context = library.captureCodeSourceNavigationContext()
                do {
                    let options = try await library.activeCodeSourceOptions()
                    guard !Task.isCancelled,
                          library.captureCodeSourceNavigationContext() == context else { return }
                    allInstalledSourcesDisabled = options.isEmpty ? nil : options.allSatisfy { !preferences.isEnabled($0.id) }
                } catch {
                    guard !Task.isCancelled,
                          library.captureCodeSourceNavigationContext() == context else { return }
                    // Unknown metadata is not evidence that every source is off.
                    allInstalledSourcesDisabled = nil
                }
            }
            .sheet(isPresented: $showsCodeSources) {
                SettingsView(initialSection: .sources)
                    .environmentObject(library.codeSourceSettingsLibrary)
            }
            .sheet(item: $historyCollection) { collection in
                NavigationStack {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            switch collection {
                            case .recent: recentSearchSection(limit: nil)
                            case .pinned: pinnedSearchSection
                            case .viewed: recentlyViewedSection(limit: nil)
                            }
                        }
                        .padding(contentHorizontalInset)
                    }
                    .scrollIndicators(.hidden)
                    .navigationTitle(collection.rawValue)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Done") { historyCollection = nil }
                        }
                    }
                    .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
                }
            }
            .sheet(isPresented: $showsPassageDetail) {
                if let prepared = preparedDestinations.values.first {
                    NavigationStack {
                        SearchChapterReaderDestination(prepared: prepared, sharedLibrary: library, showsDetail: true)
                            .toolbar {
                                ToolbarItem(placement: .topBarLeading) {
                                    Button("Close") { showsPassageDetail = false }
                                        .accessibilityLabel("Close passage")
                                }
                            }
                    }
                    // A new explicit destination must replace the sheet's
                    // StateObject and loaded passage, even while it is presented.
                    .id(ObjectIdentifier(prepared.library))
                    .environment(\.codeTopFadeEnabled, false)
                    .presentationDetents([.large])
                    .presentationDragIndicator(.visible)
                }
            }
            .navigationDestination(for: SearchReaderRoute.self) { route in
                if let prepared = preparedDestinations[route] {
                    SearchChapterReaderDestination(prepared: prepared, sharedLibrary: library)
                        .toolbar(.visible, for: .navigationBar)
                } else {
                    ContentUnavailableView("Reader unavailable", systemImage: "text.page.slash",
                        description: Text("Return to Search and open the section again."))
                }
            }
        }
        .coordinateSpace(name: "searchScroll")
        .onPreferenceChange(CodeScrollOffsetPreferenceKey.self) { scrollOffset = $0 }
    }

    private var showsGroupedSearchResults: Bool {
        true
    }

    private func scheduleSearch() {
        guard restoredSessionScope == sessionScope else { return }
        let requestID = searchTaskID
        guard submittedSearchTaskID != requestID else {
            isSearchRequestPending = false
            return
        }
        searchDebounceTask?.cancel()
        let requestedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !requestedQuery.isEmpty else {
            library.searchAllEditions(query: "")
            submittedSearchTaskID = requestID
            isSearchRequestPending = false
            return
        }
        #if PERMITEXT_LOCAL_PERFORMANCE
        LocalPerformanceRecorder.record(.searchInputScheduled)
        #endif
        os_signpost(.event, log: AppSignpost.search, name: "searchInputScheduled")
        isSearchRequestPending = true
        guard library.isInitialContentLoaded else { return }
        searchDebounceTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled, searchTaskID == requestID else { return }
            library.searchAllEditions(query: requestedQuery)
            submittedSearchTaskID = requestID
            isSearchRequestPending = false
        }
    }

    private func restoreSearchSession() async {
        guard restoredSessionScope != sessionScope else { return }
        // Initial appearance may already have opened a pending deep link.
        // Only discard navigation when replacing an existing account/edition.
        if restoredSessionScope != nil {
            showsPassageDetail = false
            searchNavigationPath = NavigationPath()
        }
        let requestedScope = sessionScope
        let requestedAccountID = sessionAccountID
        let originalQuery = query
        let originalQueryGeneration = queryEditGeneration
        let deletionGeneration = RunningSearchSessions.deletionGenerations[requestedAccountID, default: 0]
        restoredSessionScope = nil
        needsPositionReset = false
        resultPositionID = nil
        historyPositionID = nil
        selectedResultID = nil
        selectedResultIdentity = nil
        pendingScrollTargetID = nil
        scrollTargetID = nil
        let saved: SearchSessionSnapshot
        if let running = RunningSearchSessions.snapshots[requestedScope] {
            saved = running
        } else {
            saved = await SearchSessionPersistence.shared.load(accountID: requestedAccountID)
        }
        guard !Task.isCancelled, sessionScope == requestedScope,
              RunningSearchSessions.deletionGenerations[requestedAccountID, default: 0] == deletionGeneration else { return }
        // A user can type while the disk read is pending. Preserve that input.
        if !SearchSessionSnapshot.canRestoreQuery(original: originalQuery, current: query,
            originalGeneration: originalQueryGeneration, currentGeneration: queryEditGeneration) {
            restoredSessionScope = requestedScope
            persistSearchSession()
            scheduleSearch()
            return
        }
        query = saved.query
        // The accordion always includes every installed code; discard old chip filters.
        searchFilterCodeSectionIDs = []
        lastSavedSession = saved
        resultPositionID = saved.resultPositionID
        let visibleHistoryIDs = Set(library.recentlyViewedSections.map { "history:\($0.historyIdentity)" })
        historyPositionID = saved.historyPositionID.flatMap { visibleHistoryIDs.contains($0) ? $0 : nil }
        selectedResultID = saved.selectedResultID
        selectedResultIdentity = saved.selectedResultIdentity
        pendingScrollTargetID = isHistoryVisible ? historyPositionID : resultPositionID
        scrollTargetID = nil
        sessionStorageMessage = nil
        isSearchRequestPending = !isHistoryVisible
        restoredSessionScope = sessionScope
        // Consume only after restoring the query/filter snapshot. Their deferred
        // onChange callbacks compare that same snapshot, so restoration cannot
        // accidentally cancel the newly prepared deep link.
        openPendingDeepLinkedSectionIfNeeded()
        rebuildSearchCaches()
    }

    private func persistSearchSession() {
        guard restoredSessionScope == sessionScope else { return }
        let snapshot = SearchSessionSnapshot(query: query, codeSectionIDs: searchFilterCodeSectionIDs,
            resultPositionID: resultPositionID, historyPositionID: historyPositionID, selectedResultID: selectedResultID, selectedResultIdentity: selectedResultIdentity)
        guard snapshot != lastSavedSession else { return }
        RunningSearchSessions.save(snapshot, accountID: sessionAccountID, scope: sessionScope)
        lastSavedSession = snapshot
        sessionStorageMessage = nil
    }

    private func resetPositionForChangedSearch() {
        guard restoredSessionScope == sessionScope,
              query != lastSavedSession.query || searchFilterCodeSectionIDs != lastSavedSession.codeSectionIDs else { return }
        resultPositionID = nil
        selectedResultID = nil
        scrollTargetID = nil
        pendingScrollTargetID = isHistoryVisible ? historyPositionID : nil
        needsPositionReset = true
    }

    /// Rebuilds the filtered + grouped search caches. Called only when the
    /// underlying results or the filter set change, so SwiftUI body renders
    /// driven by scroll offset don't re-run Dictionary(grouping:) + sort.
    private func rebuildSearchCaches() {
        let filtered = library.searchResults.filter { searchFilterCodeSectionIDs.isEmpty || $0.searchFilterID.map { searchFilterCodeSectionIDs.contains($0) } == true }
        cachedFilteredResults = filtered
        cachedGroupedResults = Self.makeGroupedResults(
            filtered,
            codeSections: library.allEditionSearchSections
        )
    }

    private static func makeGroupedResults(
        _ results: [CodeSearchResult],
        codeSections: [CodeSectionCategory]
    ) -> [SearchResultGroup] {
        let grouped = Dictionary(grouping: results) { $0.searchFilterID }
        let groups: [SearchResultGroup] = grouped.map { id, results in
            let name = id.flatMap { codeSectionID in
                codeSections.first(where: { $0.id == codeSectionID })?.name
            }
            return SearchResultGroup(
                id: id.map(String.init) ?? "other",
                codeSectionID: id,
                codeSectionName: name ?? "Other",
                results: results
            )
        }
        // Normalize historical prefixes before sorting so 1968 stays with
        // Building Code, after the newer editions rather than ahead of them.
        return groups.sorted { lhs, rhs in
            if lhs.familyRank != rhs.familyRank { return lhs.familyRank < rhs.familyRank }
            if lhs.familyName != rhs.familyName {
                return lhs.familyName.localizedCaseInsensitiveCompare(rhs.familyName) == .orderedAscending
            }
            if lhs.editionYear != rhs.editionYear { return lhs.editionYear > rhs.editionYear }
            return lhs.id < rhs.id
        }
    }

    private func rebuildJumpBackInCache() {
        cachedRecentEntries = library.recentlyViewedSections
    }

    private var searchResultSummary: some View {
        HStack(spacing: 10) {
            Text(resultCountLabel)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .accessibilityLabel(searchSummaryAccessibilityLabel)

            Spacer(minLength: 8)

            if !activeSearchFilterCodeSectionIDs.isEmpty {
                Button("All Codes") {
                    searchFilterCodeSectionIDs.removeAll()
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(accentColor)
                .buttonStyle(.plain)
                .accessibilityHint("Clears code-book filters")
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var noResultsState: some View {
        VStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .font(.title2)
                .foregroundStyle(.secondary)

            Text(allInstalledSourcesDisabled == true ? "No code sources enabled" : "No results for “\(query.trimmingCharacters(in: .whitespacesAndNewlines))”")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
                .multilineTextAlignment(.center)

            Text(noResultsGuidance)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            if !activeSearchFilterCodeSectionIDs.isEmpty {
                Button(hasDisabledCodeSources ? "Search Enabled Codes" : "Search All Codes") {
                    searchFilterCodeSectionIDs.removeAll()
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(accentColor)
                .buttonStyle(.bordered)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 28)
        .padding(.top, 96)
    }

    private var searchLoadingState: some View {
        VStack(spacing: 12) {
            ProgressView()
                .tint(accentColor)

            Text(library.isInitialContentLoaded ? "Searching codes…" : "Loading codes…")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 112)
        .accessibilityElement(children: .combine)
    }

    private var resultCountLabel: String {
        let count = cachedFilteredResults.count
        if isSearchRequestPending || (library.isSearchInProgress && count == 0) {
            return library.isInitialContentLoaded ? "Searching…" : "Loading codes…"
        }
        if library.isSearchInProgress {
            return "\(count) found · searching more editions"
        }
        if library.allEditionSearchError != nil && count == 0 {
            return "Search unavailable"
        }
        if !library.allEditionSearchWarnings.isEmpty {
            return count == 0
                ? "No results · some editions unavailable"
                : "\(count) found · some editions unavailable"
        }
        if count == 0 { return "No results" }
        return "\(count) \(count == 1 ? "result" : "results") in \(activeSearchScopeName)"
    }

    private var searchSummaryAccessibilityLabel: String {
        if isSearchRequestPending || library.isSearchInProgress {
            return library.isInitialContentLoaded ? "Searching" : "Loading codes"
        }
        return resultCountLabel
    }

    private var hasDisabledCodeSources: Bool {
        library.activeCodeSources?.disabledSources.isEmpty == false
    }

    private var activeSearchScopeName: String {
        guard !activeSearchFilterCodeSectionIDs.isEmpty else { return hasDisabledCodeSources ? "Enabled code sources" : "All installed editions" }
        let names = library.allEditionSearchSections
            .filter { activeSearchFilterCodeSectionIDs.contains($0.id) }
            .map { CodeLibraryViewModel.displayName(forCodeSectionName: $0.name) }
        if names.count == 1 { return names[0] }
        return "\(names.count) code books"
    }

    private var noResultsGuidance: String {
        if allInstalledSourcesDisabled == true {
            return "Enable a code source in Settings to search it. Your saved passages and search history are preserved."
        }
        if !library.allEditionSearchWarnings.isEmpty {
            return "Nothing matched in the editions that could be searched. Some editions were unavailable."
        }
        let base = "Nothing matched in \(activeSearchScopeName). Try a shorter phrase or a section number"
        return activeSearchFilterCodeSectionIDs.isEmpty ? "\(base). Search matches an exact phrase." : "\(base), or clear the code filters."
    }

    private func handleSearchTabRetap() {
        if !searchNavigationPath.isEmpty {
            searchNavigationPath.removeLast()
            return
        }

        // Returning to Search must not discard the query or its results.
        // Clearing remains an explicit action in the search field.
        isSearchFieldFocused = true
    }

    private func openPendingDeepLinkedSectionIfNeeded() {
        guard library.isInitialContentLoaded,
              restoredSessionScope == sessionScope,
              let destination = library.consumePendingDeepLinkedDestination() else { return }
        if let error = destination.error {
            cancelReaderOpening()
            deepLinkError = error
            return
        }
        isSearchFieldFocused = false
        searchNavigationPath = NavigationPath()
        openReader(SearchReaderRoute(sectionID: destination.sectionID, sourceVersion: destination.codeVersion), globalProgress: true)
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)

            TextField("Search codes", text: $query)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .focused($isSearchFieldFocused)
                .accessibilityLabel("Search codes")
                .onSubmit {
                    library.recordRecentSearch(query)
                    isSearchFieldFocused = false
                }

            if !query.isEmpty {
                Button {
                    query = ""
                    library.searchAllEditions(query: "")
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, CodeScreenMetrics.rowVerticalPadding)
        .frame(height: CodeScreenMetrics.bottomControlHeight)
        .codeLiquidGlassCapsule()
        // The TextField handles focus natively. An extra .onTapGesture here
        // can interfere with cursor-position taps inside the field on iOS 17+.
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var emptyQueryHistorySection: some View {
        if cachedRecentEntries.isEmpty {
            searchStartState
        } else {
            recentlyViewedSection(limit: nil)
        }
    }

    private func historyHeader(_ collection: HistoryCollection, showsAll: Bool) -> some View {
        HStack {
            Text(collection.rawValue).font(.subheadline.weight(.medium))
            Spacer()
            if showsAll {
                Button("See all") { historyCollection = collection }
                    .font(.subheadline)
                    .fixedSize()
                    .accessibilityLabel("See all \(collection.rawValue.lowercased())")
            }
        }
    }

    private var hasSearchHistoryContent: Bool {
        !library.recentlyViewedSections.isEmpty ||
            !library.pinnedSearches.isEmpty ||
            !unpinnedRecentSearches.isEmpty
    }

    private var searchStartState: some View {
        VStack(alignment: .leading, spacing: 14) {
            CodeEmptyStateCard(
                title: "Search NYC Codes",
                systemImage: "text.magnifyingglass",
                description: "Enter a section number, requirement, or phrase in Search to find matching code text.",
                accent: accentColor
            )

            Button {
                library.selectedTab = .browse
                dismiss()
            } label: {
                Label("Browse Codes Instead", systemImage: "books.vertical")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.plain)
            .foregroundStyle(accentColor)
        }
        .padding(.top, 16)
    }

    private func viewedDateGroup(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return "Today" }
        if calendar.isDateInYesterday(date) { return "Yesterday" }
        if let boundary = calendar.date(byAdding: .day, value: -30, to: Date()), date >= boundary {
            return "Previous 30 days"
        }
        let label = DateFormatter()
        label.dateFormat = calendar.component(.year, from: date) == calendar.component(.year, from: Date()) ? "MMMM" : "MMMM yyyy"
        return label.string(from: date)
    }

    private func recentlyViewedSection(limit: Int?) -> some View {
        let entries = Array(cachedRecentEntries.prefix(limit ?? cachedRecentEntries.count))
        return LazyVStack(alignment: .leading, spacing: 0) {
            ForEach(Array(entries.enumerated()), id: \.element.historyIdentity) { index, entry in
                if index == 0 || viewedDateGroup(entry.viewedAt) != viewedDateGroup(entries[index - 1].viewedAt) {
                    Text(viewedDateGroup(entry.viewedAt))
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                        .padding(.top, index == 0 ? 8 : 28)
                        .padding(.bottom, 12)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Button {
                        historyCollection = nil
                        openReader(SearchReaderRoute(sectionID: entry.sectionID, sourceVersion: entry.sourceVersion))
                    } label: {
                        recentlyViewedTile(entry)
                    }
                    .buttonStyle(.plain)
                    readerOpeningProgress(for: SearchReaderRoute(sectionID: entry.sectionID, sourceVersion: entry.sourceVersion))
                }
                .padding(.vertical, 16)
                .id("history:\(entry.historyIdentity)")
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("search-recent-passage-\(entry.sectionID)")
                Divider()
            }
        }
        .scrollTargetLayout()
    }

    private func recentlyViewedTile(_ entry: RecentlyViewedEntry) -> some View {
        let tileAccent = Color(
            uiColor: CodeSectionThemeProfile(codeSectionName: entry.codeSectionName).accentColor
        )
        let preview = entry.previewText.trimmingCharacters(in: .whitespacesAndNewlines)

        return VStack(alignment: .leading, spacing: 5) {
            Text(entry.sectionNumber + " " + entry.title.displayTitle(for: entry.sectionNumber))
                .font(.body.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)

            if !preview.isEmpty && preview != entry.title && preview != entry.sectionNumber + " " + entry.title.displayTitle(for: entry.sectionNumber) {
                Text(preview)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 3)
            }

            Text([entry.codeSectionName, entry.sourceVersion.map { NativeReaderEditionLabel.label(for: $0) }].compactMap { $0 }.joined(separator: " · "))
                .font(.caption.weight(.medium))
                .foregroundStyle(tileAccent)
                .lineLimit(1)

        }
        .multilineTextAlignment(.leading)
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
    }

    private var unpinnedRecentSearches: [String] {
        library.recentSearches.filter { !library.isSearchPinned($0) }
    }

    private var pinnedSearchSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            searchHistorySectionHeader("Pinned")

            LazyVStack(spacing: 0) {
                ForEach(library.pinnedSearches, id: \.self) { pinnedSearch in
                    searchHistoryRow(
                        pinnedSearch,
                        leadingSystemImage: "pin.fill",
                        showsRemoveButton: false
                    )
                }
            }
        }
    }

    private func recentSearchSection(limit: Int?) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            historyHeader(.recent, showsAll: limit != nil && unpinnedRecentSearches.count > (limit ?? 0))

            LazyVStack(spacing: 0) {
                ForEach(Array(unpinnedRecentSearches.prefix(limit ?? unpinnedRecentSearches.count)), id: \.self) { recentSearch in
                    searchHistoryRow(
                        recentSearch,
                        leadingSystemImage: "clock.arrow.circlepath",
                        showsRemoveButton: true
                    )
                }
            }
        }
    }

    private func searchHistorySectionHeader(_ title: String) -> some View {
        Text(title)
            .font(CodeTypography.sectionLabel)
            .foregroundStyle(accentColor)
            .textCase(.uppercase)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func searchHistoryRow(
        _ searchQuery: String,
        leadingSystemImage: String,
        showsRemoveButton: Bool
    ) -> some View {
        let isPinned = library.isSearchPinned(searchQuery)
        return VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button {
                    applySearch(searchQuery)
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: leadingSystemImage)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.secondary)

                        Text(searchQuery)
                            .font(.subheadline)
                            .lineLimit(1)
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.leading)

                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Button {
                    if isPinned {
                        library.unpinSearch(searchQuery)
                    } else {
                        library.pinSearch(searchQuery)
                    }
                } label: {
                    Image(systemName: isPinned ? "pin.fill" : "pin")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(
                            isPinned
                                ? AnyShapeStyle(accentColor)
                                : AnyShapeStyle(.tertiary)
                        )
                        .frame(width: 18, height: 18)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isPinned ? "Unpin search" : "Pin search")

                if showsRemoveButton {
                    Button {
                        library.removeRecentSearch(searchQuery)
                    } label: {
                        Image(systemName: "xmark")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.tertiary)
                            .frame(width: 18, height: 18)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Remove recent search")
                }
            }
            .padding(.vertical, CodeScreenMetrics.rowVerticalPadding)

            CodeHairline()
        }
    }

    private func applySearch(_ searchQuery: String) {
        historyCollection = nil
        query = searchQuery
    }

    private func searchResultLink(_ result: CodeSearchResult, groupID: String) -> some View {
        VStack(spacing: 0) {
            Button {
                releaseScrollAnchorForPassageDetail()
                selectedResultID = result.id
                selectedResultIdentity = result.searchIdentity
                persistSearchSession()
                library.recordRecentSearch(query)
                openReader(SearchReaderRoute(result: result))
            } label: {
                resultRow(result)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("search-result-\(result.searchIdentity)")
            .accessibilityAddTraits(selectedResultIdentity == result.searchIdentity ? .isSelected : [])
            .contentShape(Rectangle())
            readerOpeningProgress(for: SearchReaderRoute(result: result))
            Divider()

        }
        .id("result:\(result.searchIdentity)")
        .task(id: previewRequestID) {
            let requestedQuery = query
            let requestedContext = previewRequestID
            guard previewsEnabled, expandedSearchGroups.contains(groupID),
                  result.snippet.isEmpty, resultPreviews[result.searchIdentity] == nil else { return }
            guard await previewLimiter.acquire() else { return }
            guard !Task.isCancelled, previewRequestID == requestedContext else {
                await previewLimiter.release()
                return
            }
            let preview = await library.searchPreview(for: result, query: requestedQuery)
            await previewLimiter.release()
            guard !Task.isCancelled, previewRequestID == requestedContext,
                  previewsEnabled, expandedSearchGroups.contains(groupID) else { return }
            resultPreviews[result.searchIdentity] = preview
        }
    }

    private var previewsEnabled: Bool {
        library.selectedTab == .search && openingRoute == nil && !showsPassageDetail
    }

    private var previewRequestID: String {
        "\(sessionScope)|\(library.activeCodeSourceRevision.uuidString)|\(query)|\(searchFilterCodeSectionIDs.sorted())|\(expandedSearchGroups.sorted())|\(previewsEnabled)"
    }

    private func releaseScrollAnchorForPassageDetail() {
        // `scrollPosition(id:anchor:)` otherwise keeps realigning its last
        // family/result ID to the top while the loading state and detail sheet
        // change layout. Preserve the recorded return position, but detach the
        // live anchor so the visible list stays exactly where the user tapped.
        if let scrollTargetID {
            resultPositionID = scrollTargetID
        }
        pendingScrollTargetID = nil
        needsPositionReset = false
        scrollTargetID = nil
    }

    @ViewBuilder
    private func readerOpeningProgress(for route: SearchReaderRoute) -> some View {
        if openingRoute == route && showsOpeningIndicator {
            HStack(spacing: 10) {
                ProgressView().controlSize(.small)
                    .accessibilityLabel("Loading selected passage")
                Spacer()
                Button { cancelReaderOpening() } label: {
                    Image(systemName: "xmark").frame(width: 44, height: 32)
                }
                .accessibilityLabel("Cancel opening section")
            }
            .padding(.vertical, 8)
            .accessibilityIdentifier("search-reader-opening-progress")
        }
    }

    private func cancelReaderOpeningIfSearchChanged() {
        guard openingRoute != nil || failedOpeningRoute != nil || sourceEnablePrompt != nil else { return }
        if openingQuery != query || openingFilters != searchFilterCodeSectionIDs {
            cancelReaderOpening()
        }
    }

    private func cancelReaderOpening() {
        openingGeneration = UUID()
        sourceEnablePrompt = nil
        showsOpeningIndicator = false
        openingTask?.cancel()
        openingTask = nil
        openingTimeoutTask?.cancel()
        openingTimeoutTask = nil
        openingRoute = nil
        openingQuery = nil
        openingFilters = nil
        openingScope = nil
        openingSourceRevision = nil
        openingError = nil
        failedOpeningRoute = nil
        showsGlobalOpeningProgress = false
    }

    private func openReader(_ route: SearchReaderRoute, globalProgress: Bool = false) {
        cancelReaderOpening()
        deepLinkError = nil
        #if PERMITEXT_LOCAL_PERFORMANCE
        LocalPerformanceRecorder.record(.searchResultOpenRequested)
        #endif
        os_signpost(.event, log: AppSignpost.reader, name: "searchResultOpenRequested")
        dismissKeyboard()
        let generation = openingGeneration
        let scope = sessionScope
        let sourceContext = library.captureCodeSourceNavigationContext()
        let sourceRevision = library.activeCodeSourceRevision
        openingRoute = route
        openingQuery = query
        openingFilters = searchFilterCodeSectionIDs
        openingScope = scope
        openingSourceRevision = sourceRevision
        showsGlobalOpeningProgress = globalProgress
        openingTimeoutTask = Task { @MainActor in
            do { try await Task.sleep(for: .milliseconds(350)) } catch { return }
            guard openingGeneration == generation, openingRoute == route else { return }
            guard library.activeCodeSourceRevision == sourceRevision else { cancelReaderOpening(); return }
            showsOpeningIndicator = true
            do { try await Task.sleep(for: .milliseconds(14_650)) } catch { return }
            guard openingGeneration == generation, openingRoute == route else { return }
            guard library.activeCodeSourceRevision == sourceRevision else { cancelReaderOpening(); return }
            openingTask?.cancel()
            openingTask = nil
            openingGeneration = UUID()
            openingRoute = nil
            openingError = "This section is taking longer to open. Your search is still here."
            failedOpeningRoute = route
        }
        openingTask = Task { @MainActor in
            do {
                let prepared = try await PreparedSearchReaderDestination.prepare(route: route, sharedLibrary: library, prepareChapter: false)
                guard !Task.isCancelled, openingGeneration == generation, sessionScope == scope,
                      library.activeCodeSourceRevision == sourceRevision,
                      library.captureCodeSourceNavigationContext() == sourceContext else { return }
                openingTimeoutTask?.cancel()
                openingTimeoutTask = nil
                openingRoute = nil
                openingTask = nil
                // Session/theme may change while preparation awaits, even when
                // account identity is unchanged. This preserves source selection.
                prepared.library.synchronizeIndependentReaderSession(from: library)
                // Retain the resolved independent model rather than creating a
                // fresh model inside the animated destination.
                #if PERMITEXT_LOCAL_PERFORMANCE
                LocalPerformanceRecorder.record(.searchResultDestinationPrepared)
                #endif
                os_signpost(.event, log: AppSignpost.reader, name: "searchResultDestinationPrepared")
                preparedDestinations = [route: prepared]
                showsPassageDetail = true
            } catch PreparedSearchReaderDestination.PreparationError.requiresEnable(let target) {
                guard !Task.isCancelled, openingGeneration == generation, sessionScope == scope,
                      let sourceContext, library.captureCodeSourceNavigationContext() == sourceContext else { return }
                openingTimeoutTask?.cancel()
                openingTimeoutTask = nil
                openingRoute = nil
                openingTask = nil
                showsOpeningIndicator = false
                sourceEnablePrompt = SourceEnablePrompt(route: route, target: target,
                    context: sourceContext, globalProgress: globalProgress)
            } catch is CancellationError {
                if openingGeneration == generation { cancelReaderOpening() }
                return
            } catch {
                guard openingGeneration == generation, sessionScope == scope,
                      library.activeCodeSourceRevision == sourceRevision else { return }
                openingTimeoutTask?.cancel()
                openingTimeoutTask = nil
                openingRoute = nil
                openingTask = nil
                openingError = error.localizedDescription
                failedOpeningRoute = route
            }
        }
    }

    private struct SearchResultGroup: Identifiable {
        let id: String
        let codeSectionID: Int64?
        let codeSectionName: String
        let results: [CodeSearchResult]

        var familyName: String {
            var name = results.first?.sourceCodeName ?? codeSectionName
            name = name.replacingOccurrences(of: #"^\d{4} "#, with: "", options: .regularExpression)
            if name == name.uppercased() { name = name.capitalized }
            return name
        }

        var editionLabel: String {
            let name = results.first?.sourceCodeName ?? codeSectionName
            if let range = name.range(of: #"^\d{4}"#, options: .regularExpression) {
                return String(name[range])
            }
            let edition = NativeReaderEditionLabel.label(for: results.first?.sourceVersion)
            if edition.hasPrefix("effective ") {
                let dateText = String(edition.dropFirst(10))
                let formatter = DateFormatter()
                formatter.locale = Locale(identifier: "en_US_POSIX")
                formatter.dateFormat = "yyyy-MM-dd"
                if let date = formatter.date(from: dateText) {
                    formatter.dateFormat = "MMMM d"
                    return "\(dateText.prefix(4)) · effective \(formatter.string(from: date))"
                }
                return edition
            }
            return edition.prefix(1).uppercased() + edition.dropFirst()
        }

        var editionYear: Int {
            guard let range = editionLabel.range(of: #"\d{4}"#, options: .regularExpression) else { return 0 }
            return Int(editionLabel[range]) ?? 0
        }

        var familyRank: Int {
            let order = ["building code", "existing building code", "fuel gas", "mechanical",
                         "plumbing", "energy", "electrical", "fire", "zoning", "housing",
                         "general administrative", "administrative", "local laws"]
            let lower = familyName.lowercased()
            if lower == "building code" { return 0 }
            return order.dropFirst().firstIndex(where: { lower.contains($0) }) ?? order.count
        }
    }

    private struct SearchFamily: Identifiable {
        let id: String
        var groups: [SearchResultGroup]
    }

    private var searchFamilies: [SearchFamily] {
        cachedGroupedResults.reduce(into: []) { families, group in
            if families.last?.id == group.familyName {
                families[families.count - 1].groups.append(group)
            } else {
                families.append(SearchFamily(id: group.familyName, groups: [group]))
            }
        }
    }

    private func compactGroupTitle(_ group: SearchResultGroup) -> String {
        "\(group.familyName) · \(group.editionLabel)"
    }

    private func sectionGroupHeader(_ group: SearchResultGroup) -> some View {
        let expanded = expandedSearchGroups.contains(group.id)
        let title = compactGroupTitle(group)
        return Button {
            expandedSearchGroups = expanded ? [] : [group.id]
            scrollTargetID = "family:\(group.familyName)"
        } label: {
            HStack(spacing: 12) {
                Text(group.editionLabel)
                    .font(.body)
                    .foregroundStyle(.primary)
                Spacer(minLength: 8)
                Text(groupCountLabel(group))
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
                Image(systemName: expanded ? "chevron.up" : "chevron.down")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityValue(groupAccessibilityValue(group, expanded: expanded))
        .accessibilityIdentifier("search-group-\(group.id)")
    }

    private func groupCountLabel(_ group: SearchResultGroup) -> String {
        let count = group.results.count
        return library.isSearchInProgress || isSearchRequestPending ? "\(count) loaded" : "\(count)"
    }

    private func groupAccessibilityValue(_ group: SearchResultGroup, expanded: Bool) -> String {
        let disclosure = expanded ? "Expanded" : "Collapsed"
        if library.isSearchInProgress || isSearchRequestPending {
            return "\(disclosure), still searching"
        }
        let count = group.results.count
        return "\(disclosure), \(count) \(count == 1 ? "result" : "results")"
    }

    private func resultRow(_ result: CodeSearchResult) -> some View {
        let accent = Color(uiColor: library.accentColor(for: result.codeSectionID))
        let preview = resultPreviews[result.searchIdentity] ?? result.snippet
        return HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(result.sectionNumber + " " + result.displayTitle.displayTitle(for: result.sectionNumber))
                    .font(.body.weight(.semibold)).foregroundStyle(.primary).lineLimit(2)
                if !preview.isEmpty {
                    Text(highlightedSearchText(preview, query: query, accent: accent.opacity(0.24)))
                        .font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    private func highlightedSearchText(
        _ text: String,
        query: String,
        accent: Color
    ) -> AttributedString {
        var attributed = AttributedString(text)
        let tokens = query
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(whereSeparator: \.isWhitespace)
            .map(String.init)
            .filter { !$0.isEmpty }

        guard !tokens.isEmpty else { return attributed }

        for token in tokens {
            var searchRange = attributed.startIndex..<attributed.endIndex
            while let range = attributed[searchRange].range(of: token, options: [.caseInsensitive, .diacriticInsensitive]) {
                attributed[range].backgroundColor = UIColor(accent)
                searchRange = range.upperBound..<attributed.endIndex
            }
        }

        return attributed
    }

    private func dismissKeyboard() {
        isSearchFieldFocused = false
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

private struct SearchChapterReaderDestination: View {
    @ObservedObject private var sharedLibrary: CodeLibraryViewModel
    @StateObject private var library: CodeLibraryViewModel
    @State private var accountPresentationID = UUID()
    let chapter: CodeChapter
    let initialSection: CodeSectionSummary
    let nativeOpening: NativeReaderPreparedOpening?
    let showsDetail: Bool

    init(prepared: PreparedSearchReaderDestination, sharedLibrary: CodeLibraryViewModel, showsDetail: Bool = false) {
        self.showsDetail = showsDetail
        self.sharedLibrary = sharedLibrary
        self.chapter = prepared.chapter
        self.initialSection = prepared.section
        self.nativeOpening = prepared.nativeOpening
        _library = StateObject(wrappedValue: prepared.library)
    }

    var body: some View {
        Group {
            if showsDetail {
                ReaderView(
                    sectionID: initialSection.id,
                    codeVersion: library.selectedVersion?.codeVersion,
                    usesCompactSourceHeader: true
                )
            } else {
                ChapterHTMLReaderView(chapter: chapter, initialSection: initialSection, preparedNativeOpening: nativeOpening)
            }
        }
        .environmentObject(library)
        .modifier(PermitextAccountFlowPresentation(library: sharedLibrary, ownerID: accountPresentationID))
        .onAppear { sharedLibrary.accountPresentationOwnerID = accountPresentationID }
        .onDisappear {
            if sharedLibrary.accountPresentationOwnerID == accountPresentationID {
                sharedLibrary.accountPresentationOwnerID = nil
            }
        }
        .onChange(of: sharedLibrary.signedInAccount?.appUserID) { _, _ in
            library.synchronizeIndependentReaderSession(from: sharedLibrary)
        }
        .onChange(of: sharedLibrary.bookmarkRevision) { _, _ in
            library.reconcileExternalSavedWorkChange(scheduleAccountSync: false)
        }
        .onChange(of: library.bookmarkRevision) { _, _ in
            sharedLibrary.reconcileExternalSavedWorkChange(from: library, scheduleAccountSync: true)
        }
        .onChange(of: sharedLibrary.readerTheme) { _, _ in
            library.synchronizeIndependentReaderSession(from: sharedLibrary)
        }
        .onChange(of: sharedLibrary.currentCapabilityContract) { _, _ in
            library.synchronizeIndependentReaderSession(from: sharedLibrary)
        }
        .onChange(of: sharedLibrary.activeProjectID) { _, _ in
            library.synchronizeIndependentReaderSession(from: sharedLibrary)
        }
        .onReceive(NotificationCenter.default.publisher(for: .permitextSavedWorkDidChange)) { notification in
            guard (notification.object as? CodeLibraryViewModel) !== library else { return }
            library.reconcileExternalSavedWorkChange(scheduleAccountSync: false)
        }
        .onChange(of: library.recentlyViewedSections) { _, entries in
            guard library.signedInAccount?.appUserID == sharedLibrary.signedInAccount?.appUserID,
                  let entry = entries.first, entry.sourceVersion != nil else { return }
            sharedLibrary.recordRecentlyViewed(entry)
        }
        .onChange(of: library.pendingResearchSelections) { _, selections in
            guard !selections.isEmpty else { return }
            for selection in selections { sharedLibrary.sendToResearch(selection) }
            library.acknowledgePendingResearchSelections(selections)
        }
        .onChange(of: library.selectedTab) { _, tab in
            if tab == .research { sharedLibrary.selectedTab = .research }
        }
    }

}

#if DEBUG
#Preview("Search") {
    SearchView()
        .environmentObject(CodeLibraryViewModel.preview())
        .preferredColorScheme(.light)
}
#endif


private struct IsGlobalSearchPresentedKey: EnvironmentKey {
    static let defaultValue = false
}

private struct OpenPermitextSearchKey: EnvironmentKey {
    static let defaultValue: (() -> Void)? = nil
}

extension EnvironmentValues {
    var isGlobalSearchPresented: Bool {
        get { self[IsGlobalSearchPresentedKey.self] }
        set { self[IsGlobalSearchPresentedKey.self] = newValue }
    }
    var openPermitextSearch: (() -> Void)? {
        get { self[OpenPermitextSearchKey.self] }
        set { self[OpenPermitextSearchKey.self] = newValue }
    }
}

struct GlobalSearchPresentation: ViewModifier {
    @EnvironmentObject private var library: CodeLibraryViewModel

    func body(content: Content) -> some View {
        content
            .environment(\.openPermitextSearch, { library.selectedTab = .search })
            .environment(\.isGlobalSearchPresented, library.selectedTab == .search)
    }
}

/// Shared by visible/near-visible rows; permits remain held until synchronous
/// snippet extraction actually returns, even when its UI consumer is cancelled.
actor SearchPreviewLimiter {
    private let limit: Int
    private var active = 0
    private var waiters: [(UUID, CheckedContinuation<Bool, Never>)] = []

    init(limit: Int) { self.limit = max(1, limit) }

    func acquire() async -> Bool {
        let id = UUID()
        return await withTaskCancellationHandler {
            guard !Task.isCancelled else { return false }
            if active < limit {
                active += 1
                return true
            }
            return await withCheckedContinuation { continuation in
                waiters.append((id, continuation))
            }
        } onCancel: {
            Task { await self.cancel(id) }
        }
    }

    private func cancel(_ id: UUID) {
        guard let index = waiters.firstIndex(where: { $0.0 == id }) else { return }
        waiters.remove(at: index).1.resume(returning: false)
    }

    func release() {
        if !waiters.isEmpty {
            waiters.removeFirst().1.resume(returning: true)
        } else {
            active -= 1
        }
    }
}
