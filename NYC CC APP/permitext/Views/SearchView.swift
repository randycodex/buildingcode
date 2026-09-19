import SwiftUI
import UIKit

struct SearchSessionSnapshot: Codable, Equatable, Sendable {
    var query = ""
    var codeSectionIDs: Set<Int64> = []
    var resultPositionID: String?
    var historyPositionID: String?
    var selectedResultID: Int64?
    var selectedResultIdentity: String?

    static let cacheScope = "search-session"

    static func load(cache: ProjectHubOfflineCache, accountID: String, version: String) throws -> Self {
        try cache.load(Self.self, accountID: accountID, projectID: version, scope: cacheScope)?.value ?? Self()
    }

    func save(cache: ProjectHubOfflineCache, accountID: String, version: String) throws {
        try cache.store(self, accountID: accountID, projectID: version, scope: Self.cacheScope)
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

    static func prepare(route: SearchReaderRoute, sharedLibrary: CodeLibraryViewModel) async throws -> Self {
        try Task.checkCancellation()
        let library = sharedLibrary.makeSearchReaderLibrary(sourceVersion: route.sourceVersion)
        if let sourceVersion = route.sourceVersion ?? sharedLibrary.selectedVersion?.codeVersion {
            guard await library.prepareCodeVersionForEvidence(sourceVersion) else {
                throw PreparationError.unavailable
            }
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
        if let sourceURL = library.authoredHTMLStore(for: chapter).chapterURL(chapterNumber: chapter.chapterNumber),
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
        return Self(library: library, chapter: chapter, section: section, nativeOpening: nativeOpening)
    }

    enum PreparationError: LocalizedError {
        case unavailable
        var errorDescription: String? { "Permitext could not locate this section in its installed code edition." }
    }
}

struct SearchView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var historyCollection: HistoryCollection?
    private enum HistoryCollection: String, Identifiable {
        case recent = "Recent searches", pinned = "Pinned searches", viewed = "Recently viewed"
        var id: String { rawValue }
    }
    @State private var showsOpeningIndicator = false
    @State private var query = ""
    @State private var searchFilterCodeSectionIDs: Set<Int64>
    @State private var searchNavigationPath = NavigationPath()
    @State private var preparedDestinations: [SearchReaderRoute: PreparedSearchReaderDestination] = [:]
    @State private var openingRoute: SearchReaderRoute?
    @State private var openingQuery: String?
    @State private var openingFilters: Set<Int64>?
    @State private var openingScope: String?
    @State private var openingTask: Task<Void, Never>?
    @State private var openingTimeoutTask: Task<Void, Never>?
    @State private var openingGeneration = UUID()
    @State private var openingError: String?
    @State private var failedOpeningRoute: SearchReaderRoute?
    @State private var showsGlobalOpeningProgress = false
    @State private var scrollOffset: CGFloat = 0
    @State private var cachedFilteredResults: [CodeSearchResult] = []
    @State private var cachedGroupedResults: [SearchResultGroup] = []
    @State private var cachedRecentEntries: [RecentlyViewedEntry] = []
    @State private var isSearchRequestPending = false
    @State private var restoredSessionScope: String?
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

    private let sessionCache = ProjectHubOfflineCache()
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
        "\(sessionScope):\(restoredSessionScope ?? ""): \(library.selectedVersionFileName):\(library.selectedCodeSectionID ?? 0):\(library.isInitialContentLoaded):\(query)"
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
                    CodeScreenTitle(title: "Search", collapseProgress: collapseProgress)
                    if showsGlobalOpeningProgress, let openingRoute {
                        readerOpeningProgress(for: openingRoute)
                    }
                    if let openingError, let failedOpeningRoute {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(openingError).font(.callout).foregroundStyle(.secondary)
                            Button("Retry opening section") { openReader(failedOpeningRoute, globalProgress: true) }
                        }
                        .accessibilityIdentifier("search-reader-opening-error")
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
                    } else if showsGroupedSearchResults {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            ForEach(cachedGroupedResults) { group in
                                sectionGroupHeader(group)

                                ForEach(group.results, id: \.searchIdentity) { result in
                                    searchResultLink(result)
                                }
                            }
                        }
                        .scrollTargetLayout()
                    } else {
                        LazyVStack(spacing: 0) {
                            ForEach(cachedFilteredResults, id: \.searchIdentity) { result in
                                searchResultLink(result)
                            }
                        }
                        .scrollTargetLayout()
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(.horizontal, contentHorizontalInset)
                .padding(.top, CodeScreenMetrics.scrollMeasuredTitleTopPadding)
                .padding(.bottom, tabBarClearance)
            }
            .scrollPosition(id: scrollPositionBinding, anchor: .top)
            .task(id: "\(positionReady):\(pendingScrollTargetID ?? ""):\(needsPositionReset)") {
                guard positionReady else { return }
                let firstResult = showsGroupedSearchResults ? cachedGroupedResults.first?.results.first : cachedFilteredResults.first
                let target = needsPositionReset
                    ? (isHistoryVisible ? historyPositionID : firstResult.map { "result:\($0.searchIdentity)" })
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
            .overlay(alignment: .top) {
                CodeTopContentFade(title: "Search", progress: collapseProgress)
            }
            .overlay(alignment: .bottom) {
                VStack(spacing: CodeScreenMetrics.sectionSpacingBelowEyebrow) {
                    if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        searchResultSummary
                        if !library.allEditionSearchSections.isEmpty {
                            searchCodeSectionFilter
                        }
                    }
                    searchField
                    if let sessionStorageMessage {
                        Text(sessionStorageMessage)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .accessibilityLabel(sessionStorageMessage)
                    }
                }
                .padding(.horizontal, contentHorizontalInset)
                .padding(.bottom, CodeScreenMetrics.sectionSpacingBelowEyebrow)
            }
            .background {
                // Observe retaps without taking ownership of SwiftUI's tab
                // navigation delegate. Keep the callback scoped to Search.
                TabBarReselectListener { [weak library] in
                    guard let library, library.selectedTab == .search else { return }
                    library.notifySearchTabRetap()
                }
            }
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                rebuildSearchCaches()
                rebuildJumpBackInCache()
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
                if let openingScope, openingScope != sessionScope { cancelReaderOpening() }
            }
            .onChange(of: library.selectedTab) { _, tab in
                if tab != .search { cancelReaderOpening() }
            }
            .onDisappear { cancelReaderOpening() }
            .task(id: sessionScope) {
                restoreSearchSession()
            }
            .task(id: searchTaskID) {
                guard restoredSessionScope == sessionScope else { return }
                let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmedQuery.isEmpty else {
                    isSearchRequestPending = false
                    // Only reset results if there's anything to clear —
                    // avoids cancelling an unrelated in-flight search task
                    // on initial appear.
                    if !library.searchResults.isEmpty {
                        library.searchAllEditions(query: "")
                    }
                    return
                }

                isSearchRequestPending = true
                guard library.isInitialContentLoaded else {
                    // Cancel any search tied to content that is still being
                    // replaced. The task identity includes readiness, so the
                    // same query runs automatically once loading completes.
                    library.searchAllEditions(query: "")
                    return
                }

                try? await Task.sleep(for: .milliseconds(250))
                guard !Task.isCancelled else { return }
                library.searchAllEditions(query: query)
                isSearchRequestPending = false
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
            .navigationDestination(for: SearchReaderRoute.self) { route in
                if let prepared = preparedDestinations[route] {
                    SearchChapterReaderDestination(prepared: prepared, sharedLibrary: library)
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
        activeSearchFilterCodeSectionIDs.isEmpty || activeSearchFilterCodeSectionIDs.count > 1
    }

    private func restoreSearchSession() {
        guard restoredSessionScope != sessionScope else { return }
        // Initial appearance may already have opened a pending deep link.
        // Only discard navigation when replacing an existing account/edition.
        if restoredSessionScope != nil { searchNavigationPath = NavigationPath() }
        restoredSessionScope = nil
        needsPositionReset = false
        do {
            let saved = try SearchSessionSnapshot.load(cache: sessionCache, accountID: sessionAccountID, version: "all-installed-editions")
            query = saved.query
            searchFilterCodeSectionIDs = saved.codeSectionIDs
            lastSavedSession = saved
            resultPositionID = saved.resultPositionID
            let visibleHistoryIDs = Set(library.recentlyViewedSections.prefix(3).map { "history:\($0.historyIdentity)" })
            historyPositionID = saved.historyPositionID.flatMap { visibleHistoryIDs.contains($0) ? $0 : nil }
            selectedResultID = saved.selectedResultID
            selectedResultIdentity = saved.selectedResultIdentity
            pendingScrollTargetID = isHistoryVisible ? historyPositionID : saved.resultPositionID
            scrollTargetID = nil
            sessionStorageMessage = nil
        } catch {
            query = ""
            searchFilterCodeSectionIDs = []
            lastSavedSession = SearchSessionSnapshot()
            resultPositionID = nil
            historyPositionID = nil
            selectedResultID = nil
            pendingScrollTargetID = nil
            scrollTargetID = nil
            sessionStorageMessage = "Previous search could not be restored. You can search again."
        }
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
        do {
            try snapshot.save(cache: sessionCache, accountID: sessionAccountID, version: "all-installed-editions")
            lastSavedSession = snapshot
            sessionStorageMessage = nil
        } catch {
            #if DEBUG
            NSLog("Search session save failed: %@", String(describing: error))
            #endif
            sessionStorageMessage = "Search could not be saved on this device. Your current results are still available."
        }
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
        let filtered: [CodeSearchResult]
        if activeSearchFilterCodeSectionIDs.isEmpty {
            filtered = library.searchResults
        } else {
            filtered = library.searchResults.filter { result in
                guard let codeSectionID = result.searchFilterID else { return false }
                return activeSearchFilterCodeSectionIDs.contains(codeSectionID)
            }
        }
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
        // Results arrive one edition at a time. Keep completed groups in
        // place while later editions append so rows do not move under a tap.
        return groups.sorted { $0.id.localizedStandardCompare($1.id) == .orderedAscending }

    }

    private func rebuildJumpBackInCache() {
        cachedRecentEntries = library.recentlyViewedSections
    }

    private var searchCodeSectionFilter: some View {
        CodeSectionMultiFilterChips(
            sections: library.allEditionSearchSections,
            selectedIDs: $searchFilterCodeSectionIDs,
            accentForSection: { Color(uiColor: library.accentColor(for: $0)) }
        )
    }

    private var searchResultSummary: some View {
        HStack(spacing: 10) {
            Text(resultCountLabel)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .accessibilityLabel(resultCountLabel)

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

            Text("No results for “\(query.trimmingCharacters(in: .whitespacesAndNewlines))”")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
                .multilineTextAlignment(.center)

            Text(noResultsGuidance)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            if !activeSearchFilterCodeSectionIDs.isEmpty {
                Button("Search All Codes") {
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
        return "\(count) \(count == 1 ? "result" : "results") in \(activeSearchScopeName)"
    }

    private var activeSearchScopeName: String {
        guard !activeSearchFilterCodeSectionIDs.isEmpty else { return "All installed editions" }
        let names = library.allEditionSearchSections
            .filter { activeSearchFilterCodeSectionIDs.contains($0.id) }
            .map { CodeLibraryViewModel.displayName(forCodeSectionName: $0.name) }
        if names.count == 1 { return names[0] }
        return "\(names.count) code books"
    }

    private var noResultsGuidance: String {
        let base = "Nothing matched in \(activeSearchScopeName). Try a shorter phrase or a section number"
        return "\(base), or search all installed editions."
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
        guard library.selectedTab == .search,
              library.isInitialContentLoaded,
              restoredSessionScope == sessionScope,
              let sectionID = library.consumePendingDeepLinkedSectionID() else { return }
        isSearchFieldFocused = false
        searchNavigationPath = NavigationPath()
        openReader(SearchReaderRoute(sectionID: sectionID), globalProgress: true)
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
        .codeLiquidGlassCapsule()
        // The TextField handles focus natively. An extra .onTapGesture here
        // can interfere with cursor-position taps inside the field on iOS 17+.
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var emptyQueryHistorySection: some View {
        VStack(alignment: .leading, spacing: 24) {
            if !hasSearchHistoryContent {
                searchStartState
            } else {
                if !unpinnedRecentSearches.isEmpty { recentSearchSection(limit: 3) }
                if !library.pinnedSearches.isEmpty {
                    Button { historyCollection = .pinned } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "pin")
                            Text("Pinned searches")
                            Spacer()
                            Text("\(library.pinnedSearches.count)").foregroundStyle(.secondary)
                            Image(systemName: "chevron.right").font(.caption.weight(.semibold))
                        }
                        .foregroundStyle(Color.primary)
                        .padding(.vertical, 12)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("search-pinned-history")
                }
                if !cachedRecentEntries.isEmpty { recentlyViewedSection(limit: 3) }
            }
        }
    }

    private func historyHeader(_ collection: HistoryCollection, showsAll: Bool) -> some View {
        HStack {
            searchHistorySectionHeader(collection.rawValue)
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
            } label: {
                Label("Browse Codes Instead", systemImage: "books.vertical")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.plain)
            .foregroundStyle(accentColor)
        }
        .padding(.top, 16)
    }

    private func recentlyViewedSection(limit: Int?) -> some View {
        VStack(alignment: .leading, spacing: CodeScreenMetrics.sectionSpacingBelowEyebrow) {
            historyHeader(.viewed, showsAll: limit != nil && cachedRecentEntries.count > (limit ?? 0))
            LazyVStack(spacing: CodeScreenMetrics.tileGridRowSpacing) {
                ForEach(Array(cachedRecentEntries.prefix(limit ?? cachedRecentEntries.count)), id: \.historyIdentity) { entry in
                    HStack(alignment: .top, spacing: 8) {
                        VStack(alignment: .leading, spacing: 4) {
                            Button {
                                historyCollection = nil
                                openReader(SearchReaderRoute(sectionID: entry.sectionID, sourceVersion: entry.sourceVersion))
                            } label: { recentlyViewedTile(entry) }
                            .buttonStyle(.plain)
                            readerOpeningProgress(for: SearchReaderRoute(sectionID: entry.sectionID, sourceVersion: entry.sourceVersion))
                        }
                        if entry.sourceVersion == nil || entry.sourceVersion == library.selectedVersion?.codeVersion {
                            jumpBackInBookmarkButton(for: entry)
                                .frame(minWidth: 44, minHeight: 44)
                        }
                    }
                    .padding(CodeScreenMetrics.tileGridRowSpacing)
                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: CodeScreenMetrics.tileCornerRadius, style: .continuous))
                    .id("history:\(entry.historyIdentity)")
                    .accessibilityElement(children: .contain)
                    .accessibilityIdentifier("search-recent-passage-\(entry.sectionID)")
                }
            }
            .scrollTargetLayout()
        }
    }

    private func jumpBackInBookmarkButton(for entry: RecentlyViewedEntry) -> some View {
        let tileAccent = Color(uiColor: library.accentColor(for: entry.codeSectionID))
        return ReaderCurrentSectionBookmarkButton(
            sectionID: entry.sectionID,
            accentColor: tileAccent,
            style: .compact
        )
    }

    private func recentlyViewedTile(_ entry: RecentlyViewedEntry) -> some View {
        let tileAccent = Color(uiColor: library.accentColor(for: entry.codeSectionID))

        return VStack(alignment: .leading, spacing: 6) {
            Text([entry.codeSectionName, entry.sourceVersion.map { NativeReaderEditionLabel.label(for: $0) }].compactMap { $0 }.joined(separator: " · "))
                .font(.caption.weight(.medium))
                .foregroundStyle(tileAccent)
            Text(entry.sectionNumber + " " + entry.title.displayTitle(for: entry.sectionNumber))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 3)

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

    private func searchResultLink(_ result: CodeSearchResult) -> some View {
        VStack(spacing: 0) {
            Button {
                selectedResultID = result.id
                selectedResultIdentity = result.searchIdentity
                persistSearchSession()
                library.recordRecentSearch(query)
                openReader(SearchReaderRoute(result: result))
            } label: {
                resultRow(result)
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(selectedResultIdentity == result.searchIdentity ? .isSelected : [])
            .contentShape(Rectangle())
            readerOpeningProgress(for: SearchReaderRoute(result: result))

            CodeHairline()
        }
        .id("result:\(result.searchIdentity)")
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
        guard openingRoute != nil || failedOpeningRoute != nil else { return }
        if openingQuery != query || openingFilters != searchFilterCodeSectionIDs {
            cancelReaderOpening()
        }
    }

    private func cancelReaderOpening() {
        openingGeneration = UUID()
        showsOpeningIndicator = false
        openingTask?.cancel()
        openingTask = nil
        openingTimeoutTask?.cancel()
        openingTimeoutTask = nil
        openingRoute = nil
        openingQuery = nil
        openingFilters = nil
        openingScope = nil
        openingError = nil
        failedOpeningRoute = nil
        showsGlobalOpeningProgress = false
    }

    private func openReader(_ route: SearchReaderRoute, globalProgress: Bool = false) {
        cancelReaderOpening()
        dismissKeyboard()
        let generation = openingGeneration
        let scope = sessionScope
        openingRoute = route
        openingQuery = query
        openingFilters = searchFilterCodeSectionIDs
        openingScope = scope
        showsGlobalOpeningProgress = globalProgress
        openingTimeoutTask = Task { @MainActor in
            do { try await Task.sleep(for: .milliseconds(350)) } catch { return }
            guard openingGeneration == generation, openingRoute == route else { return }
            showsOpeningIndicator = true
            do { try await Task.sleep(for: .milliseconds(14_650)) } catch { return }
            guard openingGeneration == generation, openingRoute == route else { return }
            openingTask?.cancel()
            openingTask = nil
            openingGeneration = UUID()
            openingRoute = nil
            openingError = "This section is taking longer to open. Your search is still here."
            failedOpeningRoute = route
        }
        openingTask = Task { @MainActor in
            do {
                let prepared = try await PreparedSearchReaderDestination.prepare(route: route, sharedLibrary: library)
                guard !Task.isCancelled, openingGeneration == generation, sessionScope == scope,
                      library.selectedTab == .search else { return }
                openingTimeoutTask?.cancel()
                openingTimeoutTask = nil
                openingRoute = nil
                openingTask = nil
                // Session/theme may change while preparation awaits, even when
                // account identity is unchanged. This preserves source selection.
                prepared.library.synchronizeIndependentReaderSession(from: library)
                // Retain the resolved independent model rather than creating a
                // fresh model inside the animated destination.
                preparedDestinations = [route: prepared]
                searchNavigationPath.append(route)
            } catch is CancellationError {
                return
            } catch {
                guard openingGeneration == generation, sessionScope == scope else { return }
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
    }

    private func sectionGroupHeader(_ group: SearchResultGroup) -> some View {
        let groupAccent = Color(uiColor: library.accentColor(for: group.codeSectionID))
        return Text(CodeLibraryViewModel.displayName(forCodeSectionName: group.codeSectionName))
            .font(.caption.weight(.semibold))
            .foregroundStyle(groupAccent)
            .textCase(.uppercase)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, CodeScreenMetrics.groupedSectionTopPadding)
            .padding(.bottom, CodeScreenMetrics.sectionSpacingBelowEyebrow)
    }

    private func resultRow(_ result: CodeSearchResult) -> some View {
        let resultAccent = Color(uiColor: library.accentColor(for: result.codeSectionID))
        let displayTitle = result.displayTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let snippet = result.snippet.trimmingCharacters(in: .whitespacesAndNewlines)
        let highlightedTitle = highlightedSearchText(
            displayTitle,
            query: query,
            accent: resultAccent.opacity(0.24)
        )
        let highlightedSnippet = highlightedSearchText(
            snippet,
            query: query,
            accent: resultAccent.opacity(0.24)
        )
        let showsSeparateTitle = !displayTitle.isEmpty
            && (snippet.isEmpty || displayTitle.caseInsensitiveCompare(snippet) != .orderedSame)

        return HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    // Skip the per-row code-section badge when the results
                    // are already grouped by code section — the group header
                    // shows it once instead.
                    if showsGroupedSearchResults,
                       library.allEditionSearchSections.isEmpty,
                       let codeSectionID = result.codeSectionID {
                        CodeMetaBadge(text: library.codeSectionName(id: codeSectionID), accent: resultAccent)
                    }

                    if result.kind == .textBlock {
                        CodeMetaBadge(text: "Text Block", accent: resultAccent)
                    } else {
                        Text(result.sectionNumber)
                            .font(CodeTypography.codeSectionNumber)
                            .foregroundStyle(resultAccent)
                    }

                    Text("Chapter \(result.chapterNumber)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if showsSeparateTitle {
                    Text(highlightedTitle)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(resultAccent)
                        .multilineTextAlignment(.leading)
                }

                if !snippet.isEmpty {
                    Text(highlightedSnippet)
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                        .lineLimit(4)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, CodeScreenMetrics.rowVerticalPadding)
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
    let chapter: CodeChapter
    let initialSection: CodeSectionSummary
    let nativeOpening: NativeReaderPreparedOpening?

    init(prepared: PreparedSearchReaderDestination, sharedLibrary: CodeLibraryViewModel) {
        self.sharedLibrary = sharedLibrary
        self.chapter = prepared.chapter
        self.initialSection = prepared.section
        self.nativeOpening = prepared.nativeOpening
        _library = StateObject(wrappedValue: prepared.library)
    }

    var body: some View {
        ChapterHTMLReaderView(chapter: chapter, initialSection: initialSection, preparedNativeOpening: nativeOpening)
        .environmentObject(library)
        .onChange(of: sharedLibrary.signedInAccount?.appUserID) { _, _ in
            library.synchronizeIndependentReaderSession(from: sharedLibrary)
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
