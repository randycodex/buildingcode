import SwiftUI
import UIKit

private struct SearchReaderRoute: Hashable {
    let sectionID: Int64
    let codeSectionID: Int64?
    let chapterNumber: String?
    let sectionNumber: String?
    let title: String?
    let kind: CodeSectionKind?

    init(sectionID: Int64) {
        self.sectionID = sectionID
        self.codeSectionID = nil
        self.chapterNumber = nil
        self.sectionNumber = nil
        self.title = nil
        self.kind = nil
    }

    init(result: CodeSearchResult) {
        sectionID = result.id
        codeSectionID = result.codeSectionID
        chapterNumber = result.chapterNumber
        sectionNumber = result.sectionNumber
        title = result.title
        kind = result.kind
    }
}

struct SearchView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var query = ""
    @State private var searchFilterCodeSectionIDs: Set<Int64>
    @State private var searchNavigationPath = NavigationPath()
    @State private var scrollOffset: CGFloat = 0
    @State private var cachedFilteredResults: [CodeSearchResult] = []
    @State private var cachedGroupedResults: [SearchResultGroup] = []
    @State private var cachedJumpBackInPages: [JumpBackInPage] = []
    @State private var jumpBackInPageIndex: Int = 0
    @State private var didSeedCurrentCodeFilter = false
    @FocusState private var isSearchFieldFocused: Bool

    private static let filterCodeSectionIDsDefaultsKey = "SearchView.filterCodeSectionIDs"
    private let contentHorizontalInset: CGFloat = CodeScreenMetrics.screenHorizontalPadding
    private let tabBarClearance: CGFloat = CodeScreenMetrics.searchTabBarClearance
    private let jumpBackInPageSize = CodeScreenMetrics.tileGridPageSize
    /// Shared with `BookmarksView` so both docks occupy the same vertical
    /// real estate above the floating tab bar regardless of how many filter
    /// rows are present.
    private let dockContentMinHeight: CGFloat = 86

    private var accentColor: Color {
        Color(uiColor: library.accentColor())
    }

    private var collapseProgress: CGFloat {
        min(max(-scrollOffset / 64, 0), 1)
    }

    private var activeSearchFilterCodeSectionIDs: Set<Int64> {
        guard !library.isZoningResolutionSelected else { return [] }
        let availableIDs = Set(library.codeSections.map(\.id))
        return searchFilterCodeSectionIDs.intersection(availableIDs)
    }

    private var searchTaskID: String {
        "\(library.selectedVersionFileName):\(library.selectedCodeSectionID ?? 0):\(query)"
    }

    init() {
        _searchFilterCodeSectionIDs = State(
            initialValue: FilterIDsStorage.load(key: Self.filterCodeSectionIDsDefaultsKey)
        )
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

                    if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        emptyQueryHistorySection
                    } else if cachedFilteredResults.isEmpty {
                        noResultsState
                    } else if showsGroupedSearchResults {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            ForEach(cachedGroupedResults) { group in
                                sectionGroupHeader(group)

                                ForEach(group.results) { result in
                                    searchResultLink(result)
                                }
                            }
                        }
                    } else {
                        LazyVStack(spacing: 0) {
                            ForEach(cachedFilteredResults) { result in
                                searchResultLink(result)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(.horizontal, contentHorizontalInset)
                .padding(.top, CodeScreenMetrics.scrollMeasuredTitleTopPadding)
                .padding(.bottom, tabBarClearance)
            }
            .contentShape(Rectangle())
            .onTapGesture {
                dismissKeyboard()
            }
            .overlay(alignment: .top) {
                CodeTopContentFade(title: "Search", progress: collapseProgress)
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                VStack(spacing: CodeScreenMetrics.sectionSpacingBelowEyebrow) {
                    if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        searchResultSummary
                        if !library.isZoningResolutionSelected, !library.codeSections.isEmpty {
                            searchCodeSectionFilter
                        }
                    }
                    searchField
                }
                .frame(minHeight: dockContentMinHeight, alignment: .bottom)
                .padding(.horizontal, contentHorizontalInset)
                .padding(.top, CodeScreenMetrics.sectionSpacingBelowEyebrow)
                .padding(.bottom, CodeScreenMetrics.sectionSpacingBelowEyebrow)
                .background(bottomSearchDock)
            }
            .background {
                // Mount unconditionally and gate the callback inside, so the
                // delegate isn't re-installed each time the user switches tabs.
                // That avoids subtle delegate-capture issues if the previous
                // coordinator hasn't detached yet during a tab animation.
                TabBarReselectListener { [weak library] in
                    guard let library, library.selectedTab == .search else { return }
                    library.notifySearchTabRetap()
                }
            }
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                seedCurrentCodeFilterIfNeeded()
                rebuildSearchCaches()
                rebuildJumpBackInCache()
                if library.pendingDeepLinkedSectionID != nil {
                    openPendingDeepLinkedSectionIfNeeded()
                    return
                }
            }
            .onChange(of: searchFilterCodeSectionIDs) { _, newValue in
                FilterIDsStorage.persist(newValue, key: Self.filterCodeSectionIDsDefaultsKey)
                rebuildSearchCaches()
            }
            .onChange(of: library.searchResults) { _, _ in
                rebuildSearchCaches()
            }
            .onChange(of: library.codeSections) { _, _ in
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
            .task(id: searchTaskID) {
                let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmedQuery.isEmpty else {
                    // Only reset results if there's anything to clear —
                    // avoids cancelling an unrelated in-flight search task
                    // on initial appear.
                    if !library.searchResults.isEmpty {
                        library.search(query: "")
                    }
                    return
                }

                try? await Task.sleep(for: .milliseconds(250))
                guard !Task.isCancelled else { return }
                library.search(
                    query: query,
                    restrictToSelectedCodeSection: library.isZoningResolutionSelected
                )
            }
            .navigationDestination(for: SearchReaderRoute.self) { route in
                SearchChapterReaderDestination(route: route)
            }
        }
        .coordinateSpace(name: "searchScroll")
        .onPreferenceChange(CodeScrollOffsetPreferenceKey.self) { scrollOffset = $0 }
    }

    private var showsGroupedSearchResults: Bool {
        activeSearchFilterCodeSectionIDs.isEmpty || activeSearchFilterCodeSectionIDs.count > 1
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
                guard let codeSectionID = result.codeSectionID else { return false }
                return activeSearchFilterCodeSectionIDs.contains(codeSectionID)
            }
        }
        cachedFilteredResults = filtered
        cachedGroupedResults = Self.makeGroupedResults(
            filtered,
            codeSections: library.codeSections
        )
    }

    private static func makeGroupedResults(
        _ results: [CodeSearchResult],
        codeSections: [CodeSectionCategory]
    ) -> [SearchResultGroup] {
        let grouped = Dictionary(grouping: results) { $0.codeSectionID }
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
        return groups.sorted { lhs, rhs in
            let lhsRank = CodeLibraryViewModel.codeSectionOrderRank(forName: lhs.codeSectionName)
            let rhsRank = CodeLibraryViewModel.codeSectionOrderRank(forName: rhs.codeSectionName)
            if lhsRank != rhsRank { return lhsRank < rhsRank }
            return lhs.codeSectionName.localizedStandardCompare(rhs.codeSectionName) == .orderedAscending
        }
    }

    private func rebuildJumpBackInCache() {
        let entries = library.recentlyViewedSections
        guard !entries.isEmpty else {
            cachedJumpBackInPages = []
            return
        }
        cachedJumpBackInPages = stride(from: 0, to: entries.count, by: jumpBackInPageSize).map { start in
            let slice = Array(entries[start..<min(start + jumpBackInPageSize, entries.count)])
            return JumpBackInPage(entries: slice)
        }
    }

    private var searchCodeSectionFilter: some View {
        CodeSectionMultiFilterChips(
            sections: library.codeSections,
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

            if !library.isZoningResolutionSelected, !activeSearchFilterCodeSectionIDs.isEmpty {
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

            if !library.isZoningResolutionSelected, !activeSearchFilterCodeSectionIDs.isEmpty {
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

    private var resultCountLabel: String {
        let count = cachedFilteredResults.count
        return "\(count) \(count == 1 ? "result" : "results") in \(activeSearchScopeName)"
    }

    private var activeSearchScopeName: String {
        if library.isZoningResolutionSelected {
            return library.codeSections.first
                .map { CodeLibraryViewModel.displayName(forCodeSectionName: $0.name) }
                ?? "Zoning Resolution"
        }
        guard !activeSearchFilterCodeSectionIDs.isEmpty else { return "All Codes" }
        let names = library.codeSections
            .filter { activeSearchFilterCodeSectionIDs.contains($0.id) }
            .map { CodeLibraryViewModel.displayName(forCodeSectionName: $0.name) }
        if names.count == 1 { return names[0] }
        return "\(names.count) code books"
    }

    private var noResultsGuidance: String {
        let base = "Nothing matched in \(activeSearchScopeName). Try a shorter phrase or a section number"
        return library.isZoningResolutionSelected ? "\(base)." : "\(base), or search all codes."
    }

    private func seedCurrentCodeFilterIfNeeded() {
        guard !didSeedCurrentCodeFilter else { return }
        didSeedCurrentCodeFilter = true
        guard searchFilterCodeSectionIDs.isEmpty,
              let selectedCodeSectionID = library.selectedCodeSectionID else { return }
        searchFilterCodeSectionIDs = [selectedCodeSectionID]
    }

    private func handleSearchTabRetap() {
        if !searchNavigationPath.isEmpty {
            searchNavigationPath.removeLast()
            return
        }

        let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedQuery.isEmpty else { return }
        query = ""
        library.search(query: "")
    }

    private func openPendingDeepLinkedSectionIfNeeded() {
        guard library.selectedTab == .search,
              library.isInitialContentLoaded,
              let sectionID = library.consumePendingDeepLinkedSectionID() else { return }
        isSearchFieldFocused = false
        searchNavigationPath = NavigationPath()
        searchNavigationPath.append(SearchReaderRoute(sectionID: sectionID))
    }

    private var bottomSearchDock: some View {
        Color(uiColor: .systemGroupedBackground)
            .ignoresSafeArea(edges: .bottom)
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
                    library.search(query: "")
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
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: CodeScreenMetrics.cardCornerRadius, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: CodeScreenMetrics.cardCornerRadius, style: .continuous)
                .strokeBorder(Color(uiColor: .separator).opacity(0.55), lineWidth: 0.75)
        )
        // The TextField handles focus natively. An extra .onTapGesture here
        // can interfere with cursor-position taps inside the field on iOS 17+.
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var emptyQueryHistorySection: some View {
        VStack(alignment: .leading, spacing: 16) {
            if !hasSearchHistoryContent {
                searchStartState
            } else if !library.recentlyViewedSections.isEmpty {
                recentlyViewedSection
                    .padding(.bottom, CodeScreenMetrics.tileGridSectionBottomPadding)
            }

            if !library.pinnedSearches.isEmpty {
                pinnedSearchSection
            }

            if !unpinnedRecentSearches.isEmpty {
                recentSearchSection
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

    private var jumpBackInTabViewHeight: CGFloat {
        cachedJumpBackInPages
            .map { CodeScreenMetrics.tileGridHeight(forItemCount: $0.entries.count) }
            .max() ?? CodeScreenMetrics.twoByTwoTileRowHeight
    }

    private var recentlyViewedSection: some View {
        VStack(alignment: .leading, spacing: CodeScreenMetrics.sectionSpacingBelowEyebrow) {
            CodeScreenSectionEyebrow(text: "Jump Back In", accent: accentColor)

            GeometryReader { proxy in
                let pageWidth = proxy.size.width
                TabView(selection: $jumpBackInPageIndex) {
                    ForEach(Array(cachedJumpBackInPages.enumerated()), id: \.element.id) { index, page in
                        jumpBackInPageGrid(
                            page.entries,
                            pageWidth: pageWidth,
                            isLastPage: index == cachedJumpBackInPages.indices.last
                        )
                            .frame(width: pageWidth, height: CodeScreenMetrics.tileGridHeight(forItemCount: page.entries.count), alignment: .topLeading)
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .frame(width: pageWidth, height: jumpBackInTabViewHeight)
                .clipped()
            }
            .frame(height: jumpBackInTabViewHeight)

            if cachedJumpBackInPages.count > 1 {
                jumpBackInPageDots
            }
        }
    }

    private var jumpBackInPageDots: some View {
        HStack(spacing: 6) {
            ForEach(cachedJumpBackInPages.indices, id: \.self) { index in
                Circle()
                    .fill(index == jumpBackInPageIndex ? Color.appChrome : Color.secondary.opacity(0.35))
                    .frame(width: 6, height: 6)
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.top, 4)
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private func jumpBackInPageGrid(
        _ page: [RecentlyViewedEntry],
        pageWidth: CGFloat,
        isLastPage: Bool
    ) -> some View {
        let pageSlots = Array(page.prefix(jumpBackInPageSize))
        let shouldPlaceSingleFinalTileOnRight = isLastPage && pageSlots.count == 1

        VStack(spacing: CodeScreenMetrics.tileGridRowSpacing) {
            jumpBackInTileRow(
                leftEntry: shouldPlaceSingleFinalTileOnRight ? nil : (pageSlots.indices.contains(0) ? pageSlots[0] : nil),
                rightEntry: shouldPlaceSingleFinalTileOnRight ? pageSlots[0] : (pageSlots.indices.contains(1) ? pageSlots[1] : nil),
                pageWidth: pageWidth
            )

            if pageSlots.count > 2 {
                jumpBackInTileRow(
                    leftEntry: pageSlots.indices.contains(2) ? pageSlots[2] : nil,
                    rightEntry: pageSlots.indices.contains(3) ? pageSlots[3] : nil,
                    pageWidth: pageWidth
                )
            }
        }
    }

    private func jumpBackInTileRow(
        leftEntry: RecentlyViewedEntry?,
        rightEntry: RecentlyViewedEntry?,
        pageWidth: CGFloat
    ) -> some View {
        let gap: CGFloat = CodeScreenMetrics.tileGridRowSpacing
        let tileWidth = max(0, (pageWidth - gap) / 2)

        return HStack(alignment: .top, spacing: CodeScreenMetrics.tileGridRowSpacing) {
            jumpBackInTileSlot(leftEntry, tileWidth: tileWidth)
            jumpBackInTileSlot(rightEntry, tileWidth: tileWidth)
        }
        .frame(width: pageWidth, height: CodeScreenMetrics.twoByTwoTileRowHeight, alignment: .topLeading)
    }

    @ViewBuilder
    private func jumpBackInTileSlot(_ entry: RecentlyViewedEntry?, tileWidth: CGFloat) -> some View {
        if let entry {
            ZStack(alignment: .topTrailing) {
                NavigationLink(value: SearchReaderRoute(sectionID: entry.sectionID)) {
                    recentlyViewedTile(entry)
                        .frame(width: tileWidth)
                }
                .buttonStyle(.plain)

                // Bookmark toggle pinned to the tile's top-right corner.
                // Sits OUTSIDE the NavigationLink so its own tap region
                // is consumed before navigation triggers.
                jumpBackInBookmarkButton(for: entry)
                    .padding(6)
            }
        } else {
            Color.clear
                .frame(width: tileWidth)
                .frame(height: CodeScreenMetrics.twoByTwoTileRowHeight)
                .accessibilityHidden(true)
        }
    }

    private func jumpBackInBookmarkButton(for entry: RecentlyViewedEntry) -> some View {
        let tileAccent = Color(uiColor: library.accentColor(for: entry.codeSectionID))
        let isBookmarked = library.isBookmarked(sectionID: entry.sectionID)
        return Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            library.toggleBookmark(sectionID: entry.sectionID)
        } label: {
            Image(systemName: isBookmarked ? "bookmark.fill" : "bookmark")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(isBookmarked ? tileAccent : Color.secondary.opacity(0.7))
                .frame(width: 28, height: 28)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isBookmarked ? "Remove bookmark" : "Bookmark section")
    }

    private func recentlyViewedTile(_ entry: RecentlyViewedEntry) -> some View {
        let tileAccent = Color(uiColor: library.accentColor(for: entry.codeSectionID))
        let preview = entry.previewText.trimmingCharacters(in: .whitespacesAndNewlines)

        return VStack(alignment: .leading, spacing: 4) {
            Text(entry.sectionNumber)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(tileAccent)
                .lineLimit(1)

            Text(entry.title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(preview.isEmpty ? " " : preview)
                .font(.caption2)
                .foregroundStyle(preview.isEmpty ? .clear : .secondary)
                .lineLimit(3)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, minHeight: CodeScreenMetrics.jumpBackInPreviewBlockHeight, alignment: .topLeading)

            Text(entry.codeSectionName)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.tertiary)
                .lineLimit(1)
        }
        .padding(CodeScreenMetrics.tileGridRowSpacing)
        .frame(maxWidth: .infinity, minHeight: CodeScreenMetrics.jumpBackInTileContentHeight, alignment: .topLeading)
        .frame(height: CodeScreenMetrics.twoByTwoTileRowHeight, alignment: .top)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: CodeScreenMetrics.tileCornerRadius, style: .continuous))
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

    private var recentSearchSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            searchHistorySectionHeader("Recent Searches")

            LazyVStack(spacing: 0) {
                ForEach(unpinnedRecentSearches, id: \.self) { recentSearch in
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
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.leading)

                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Button {
                    searchPinHaptic()
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
        query = searchQuery
        library.search(
            query: searchQuery,
            restrictToSelectedCodeSection: library.isZoningResolutionSelected
        )
    }

    private func searchPinHaptic() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func searchResultLink(_ result: CodeSearchResult) -> some View {
        VStack(spacing: 0) {
            NavigationLink(value: SearchReaderRoute(result: result)) {
                resultRow(result)
            }
            .buttonStyle(.plain)
            .contentShape(Rectangle())
            .simultaneousGesture(
                TapGesture().onEnded {
                    library.recordRecentSearch(query)
                }
            )

            CodeHairline()
        }
    }

    private struct SearchResultGroup: Identifiable {
        let id: String
        let codeSectionID: Int64?
        let codeSectionName: String
        let results: [CodeSearchResult]
    }

    /// One page of "Jump Back In" tiles. The id is derived from the first
    /// entry's sectionID so SwiftUI never recycles a page view across content
    /// shifts (which would otherwise show stale tiles mid-swipe).
    private struct JumpBackInPage: Identifiable {
        let entries: [RecentlyViewedEntry]
        var id: Int64 { entries.first?.sectionID ?? 0 }
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
            && !snippet.isEmpty
            && displayTitle.caseInsensitiveCompare(snippet) != .orderedSame

        return HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    // Skip the per-row code-section badge when the results
                    // are already grouped by code section — the group header
                    // shows it once instead.
                    if showsGroupedSearchResults,
                       library.codeSections.isEmpty,
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
                        .font(library.readerTheme.swiftUIFont(size: library.readerTheme.fontSize + 1, emphasized: true))
                        .foregroundStyle(resultAccent)
                        .multilineTextAlignment(.leading)
                }

                if !snippet.isEmpty {
                    Text(highlightedSnippet)
                        .font(library.readerTheme.swiftUIFont(size: max(library.readerTheme.fontSize - 1, ReaderTheme.minimumFontSize)))
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
    @EnvironmentObject private var library: CodeLibraryViewModel
    let route: SearchReaderRoute

    @State private var chapter: CodeChapter?
    @State private var initialSection: CodeSectionSummary?
    @State private var didFinishLoading = false

    var body: some View {
        Group {
            if let chapter, let initialSection {
                ChapterHTMLReaderView(chapter: chapter, initialSection: initialSection)
            } else if didFinishLoading {
                ContentUnavailableView(
                    "Reader unavailable",
                    systemImage: "text.page.slash",
                    description: Text("Permitext could not locate this enacted section in its chapter.")
                )
            } else {
                ProgressView("Opening Reader…")
            }
        }
        .task(id: route) { await resolveDestination() }
    }

    @MainActor
    private func resolveDestination() async {
        didFinishLoading = false

        if let chapterNumber = route.chapterNumber,
           let sectionNumber = route.sectionNumber,
           let title = route.title,
           let kind = route.kind,
           let matchedChapter = library.chapters(for: route.codeSectionID).first(where: {
               $0.chapterNumber.caseInsensitiveCompare(chapterNumber) == .orderedSame
           }) {
            chapter = matchedChapter
            initialSection = CodeSectionSummary(
                id: route.sectionID,
                chapterNumber: chapterNumber,
                sectionNumber: sectionNumber,
                title: title,
                kind: kind
            )
            didFinishLoading = true
            return
        }

        guard let detail = await library.loadSectionDetailsAsync(sectionIDs: [route.sectionID]).first,
              let matchedChapter = library.chapters(for: detail.codeSectionID).first(where: {
                  $0.chapterNumber.caseInsensitiveCompare(detail.chapterNumber) == .orderedSame
              }) else {
            didFinishLoading = true
            return
        }
        chapter = matchedChapter
        initialSection = CodeSectionSummary(
            id: detail.id,
            chapterNumber: detail.chapterNumber,
            sectionNumber: detail.sectionNumber,
            title: detail.title,
            kind: detail.kind
        )
        didFinishLoading = true
    }
}

#if DEBUG
#Preview("Search") {
    SearchView()
        .environmentObject(CodeLibraryViewModel.preview())
        .preferredColorScheme(.light)
}
#endif
