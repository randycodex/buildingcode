import SwiftUI
import UIKit

struct SearchView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var query = ""
    @State private var searchFilterCodeSectionIDs: Set<Int64>
    @State private var searchNavigationPath = NavigationPath()
    @State private var scrollOffset: CGFloat = 0
    @FocusState private var isSearchFieldFocused: Bool

    private static let filterCodeSectionIDsDefaultsKey = "SearchView.filterCodeSectionIDs"
    private let contentHorizontalInset: CGFloat = 16
    private let tabBarClearance: CGFloat = 168
    private let jumpBackInPageSize = 4

    private var accentColor: Color {
        Color(uiColor: library.accentColor())
    }

    private var collapseProgress: CGFloat {
        min(max(-scrollOffset / 64, 0), 1)
    }

    init() {
        _searchFilterCodeSectionIDs = State(
            initialValue: Self.loadFilterCodeSectionIDs()
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

                VStack(alignment: .leading, spacing: 16) {
                    Text("Search")
                        .font(.system(size: 16, weight: .bold, design: .default))
                        .foregroundStyle(.primary)
                        .padding(.bottom, 8)
                        .scaleEffect(1 - (collapseProgress * 0.08), anchor: .leading)
                        .opacity(1 - (collapseProgress * 0.22))

                    if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        emptyQueryHistorySection
                    } else if filteredSearchResults.isEmpty {
                        Text("No results")
                            .font(.subheadline)
                            .foregroundStyle(Color.secondary.opacity(0.7))
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.top, 120)
                    } else if showsGroupedSearchResults {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            ForEach(groupedSearchResults) { group in
                                sectionGroupHeader(group)

                                ForEach(group.results) { result in
                                    searchResultLink(result)
                                }
                            }
                        }
                    } else {
                        LazyVStack(spacing: 0) {
                            ForEach(filteredSearchResults) { result in
                                searchResultLink(result)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(.horizontal, contentHorizontalInset)
                .padding(.top, 18)
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
                VStack(spacing: 10) {
                    if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                       !library.codeSections.isEmpty {
                        searchCodeSectionFilter
                    }
                    searchField
                }
                .padding(.horizontal, contentHorizontalInset)
                .padding(.top, 10)
                .padding(.bottom, 22)
                .background(bottomSearchDock)
            }
            .background {
                if library.selectedTab == .search {
                    TabBarReselectListener {
                        library.notifySearchTabRetap()
                    }
                }
            }
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                    isSearchFieldFocused = true
                }
            }
            .onChange(of: searchFilterCodeSectionIDs) { _, newValue in
                Self.persistFilterCodeSectionIDs(newValue)
            }
            .onChange(of: library.searchTabRetapCount) { _, _ in
                handleSearchTabRetap()
            }
            .task(id: query) {
                let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmedQuery.isEmpty else {
                    library.search(query: "")
                    return
                }

                try? await Task.sleep(for: .milliseconds(250))
                guard !Task.isCancelled else { return }
                library.search(query: query, restrictToSelectedCodeSection: false)
            }
            .navigationDestination(for: Int64.self) { sectionID in
                ReaderView(sectionID: sectionID)
            }
        }
        .coordinateSpace(name: "searchScroll")
        .onPreferenceChange(CodeScrollOffsetPreferenceKey.self) { scrollOffset = $0 }
    }

    private var filteredSearchResults: [CodeSearchResult] {
        guard !searchFilterCodeSectionIDs.isEmpty else {
            return library.searchResults
        }
        return library.searchResults.filter { result in
            guard let codeSectionID = result.codeSectionID else { return false }
            return searchFilterCodeSectionIDs.contains(codeSectionID)
        }
    }

    private var showsGroupedSearchResults: Bool {
        searchFilterCodeSectionIDs.isEmpty || searchFilterCodeSectionIDs.count > 1
    }

    private var searchCodeSectionFilter: some View {
        CodeSectionMultiFilterChips(
            sections: library.codeSections,
            selectedIDs: $searchFilterCodeSectionIDs,
            defaultAccent: accentColor,
            accentForSection: { Color(uiColor: library.accentColor(for: $0)) }
        )
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

    private static func loadFilterCodeSectionIDs() -> Set<Int64> {
        guard let numbers = UserDefaults.standard.array(forKey: filterCodeSectionIDsDefaultsKey) as? [NSNumber] else {
            return []
        }
        return Set(numbers.map(\.int64Value))
    }

    private static func persistFilterCodeSectionIDs(_ ids: Set<Int64>) {
        if ids.isEmpty {
            UserDefaults.standard.removeObject(forKey: filterCodeSectionIDsDefaultsKey)
        } else {
            UserDefaults.standard.set(Array(ids), forKey: filterCodeSectionIDsDefaultsKey)
        }
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

            TextField("Search sections, chapters, terms", text: $query)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .focused($isSearchFieldFocused)
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
        .padding(.vertical, 12)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color(uiColor: .separator).opacity(0.55), lineWidth: 0.75)
        )
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .onTapGesture {
            isSearchFieldFocused = true
        }
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var emptyQueryHistorySection: some View {
        VStack(alignment: .leading, spacing: 16) {
            if !library.recentlyViewedSections.isEmpty {
                recentlyViewedSection
                    .padding(.bottom, 2)
            }

            if !library.pinnedSearches.isEmpty {
                pinnedSearchSection
            }

            if !unpinnedRecentSearches.isEmpty {
                recentSearchSection
            }
        }
    }

    private var jumpBackInPages: [[RecentlyViewedEntry]] {
        let entries = library.recentlyViewedSections
        guard !entries.isEmpty else { return [] }
        return stride(from: 0, to: entries.count, by: jumpBackInPageSize).map { start in
            Array(entries[start..<min(start + jumpBackInPageSize, entries.count)])
        }
    }

    private var jumpBackInPreviewBlockHeight: CGFloat {
        // SwiftUI line heights run slightly taller than UIFont metrics.
        UIFont.preferredFont(forTextStyle: .caption2).lineHeight * 3 + 6
    }

    private var jumpBackInTileContentHeight: CGFloat {
        let caption2 = UIFont.preferredFont(forTextStyle: .caption2)
        let caption = UIFont.preferredFont(forTextStyle: .caption1)
        let codeName = UIFont.systemFont(ofSize: 10, weight: .medium)
        let lineSpacing: CGFloat = 4
        return caption2.lineHeight
            + caption.lineHeight
            + jumpBackInPreviewBlockHeight
            + codeName.lineHeight
            + (lineSpacing * 4)
            + 8
    }

    private var jumpBackInTileOuterHeight: CGFloat {
        jumpBackInTileContentHeight + 16
    }

    private func jumpBackInGridHeight(for page: [RecentlyViewedEntry]) -> CGFloat {
        let rowCount = page.count <= 2 ? 1 : 2
        let rowGap: CGFloat = rowCount == 2 ? 8 : 0
        return (jumpBackInTileOuterHeight * CGFloat(rowCount)) + rowGap
    }

    private var jumpBackInTabViewHeight: CGFloat {
        let tallestGrid = jumpBackInPages.map { jumpBackInGridHeight(for: $0) }.max() ?? jumpBackInTileOuterHeight
        let pageDotsHeight: CGFloat = jumpBackInPages.count > 1 ? 28 : 0
        return tallestGrid + pageDotsHeight
    }

    private var recentlyViewedSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            searchHistorySectionHeader("Jump Back In")

            TabView {
                ForEach(Array(jumpBackInPages.enumerated()), id: \.offset) { _, page in
                    jumpBackInPageGrid(page)
                        .frame(height: jumpBackInGridHeight(for: page), alignment: .top)
                        .padding(.horizontal, 1)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: jumpBackInPages.count > 1 ? .automatic : .never))
            .frame(height: jumpBackInTabViewHeight)
        }
    }

    @ViewBuilder
    private func jumpBackInPageGrid(_ page: [RecentlyViewedEntry]) -> some View {
        let topRow = Array(page.prefix(2))
        let bottomRow = Array(page.dropFirst(2).prefix(2))

        VStack(spacing: 8) {
            jumpBackInTileRow(topRow)

            if !bottomRow.isEmpty {
                jumpBackInTileRow(bottomRow)
            }
        }
    }

    private func jumpBackInTileRow(_ entries: [RecentlyViewedEntry]) -> some View {
        HStack(alignment: .top, spacing: 8) {
            ForEach(entries) { entry in
                NavigationLink(value: entry.sectionID) {
                    recentlyViewedTile(entry)
                }
                .buttonStyle(.plain)
            }

            if entries.count == 1 {
                Color.clear
                    .frame(maxWidth: .infinity)
                    .frame(height: jumpBackInTileOuterHeight)
                    .accessibilityHidden(true)
            }
        }
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
                .frame(maxWidth: .infinity, minHeight: jumpBackInPreviewBlockHeight, alignment: .topLeading)

            Text(entry.codeSectionName)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.tertiary)
                .lineLimit(1)
        }
        .padding(8)
        .frame(maxWidth: .infinity, minHeight: jumpBackInTileContentHeight, alignment: .topLeading)
        .frame(height: jumpBackInTileOuterHeight, alignment: .top)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .strokeBorder(Color(uiColor: .separator).opacity(0.55), lineWidth: 0.75)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
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
            .font(.caption.weight(.semibold))
            .foregroundStyle(accentColor)
            .textCase(.uppercase)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func searchHistoryRow(
        _ searchQuery: String,
        leadingSystemImage: String,
        showsRemoveButton: Bool
    ) -> some View {
        VStack(spacing: 0) {
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
                }
                .buttonStyle(.plain)

                Button {
                    searchPinHaptic()
                    if library.isSearchPinned(searchQuery) {
                        library.unpinSearch(searchQuery)
                    } else {
                        library.pinSearch(searchQuery)
                    }
                } label: {
                    Image(systemName: library.isSearchPinned(searchQuery) ? "pin.fill" : "pin")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(
                            library.isSearchPinned(searchQuery)
                                ? AnyShapeStyle(accentColor)
                                : AnyShapeStyle(.tertiary)
                        )
                        .frame(width: 18, height: 18)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(library.isSearchPinned(searchQuery) ? "Unpin search" : "Pin search")

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
            .padding(.vertical, 12)

            CodeHairline()
        }
    }

    private func applySearch(_ searchQuery: String) {
        query = searchQuery
        library.search(query: searchQuery, restrictToSelectedCodeSection: false)
    }

    private func searchPinHaptic() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func searchResultLink(_ result: CodeSearchResult) -> some View {
        VStack(spacing: 0) {
            NavigationLink(value: result.id) {
                resultRow(result)
            }
            .buttonStyle(.plain)
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

    private var groupedSearchResults: [SearchResultGroup] {
        // Build groups keyed by codeSectionID; results without an ID get a
        // synthetic "Other" bucket at the end so nothing disappears.
        let grouped = Dictionary(grouping: filteredSearchResults) { $0.codeSectionID }
        let groups: [SearchResultGroup] = grouped.map { id, results in
            let name = id.flatMap { codeSectionID in
                library.codeSections.first(where: { $0.id == codeSectionID })?.name
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

    private func sectionGroupHeader(_ group: SearchResultGroup) -> some View {
        let groupAccent = Color(uiColor: library.accentColor(for: group.codeSectionID))
        return Text(CodeLibraryViewModel.displayName(forCodeSectionName: group.codeSectionName))
            .font(.caption.weight(.semibold))
            .foregroundStyle(groupAccent)
            .textCase(.uppercase)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 22)
            .padding(.bottom, 8)
    }

    private func resultRow(_ result: CodeSearchResult) -> some View {
        let resultAccent = Color(uiColor: library.accentColor(for: result.codeSectionID))

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
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(resultAccent)
                    }

                    Text("Chapter \(result.chapterNumber)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Text(result.displayTitle)
                    .font(library.readerTheme.swiftUIFont(size: library.readerTheme.fontSize + 1, emphasized: true))
                    .foregroundStyle(resultAccent)
                    .multilineTextAlignment(.leading)

                Text(result.snippet)
                    .font(library.readerTheme.swiftUIFont(size: max(library.readerTheme.fontSize - 1, ReaderTheme.minimumFontSize)))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.leading)
                    .lineLimit(4)
            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, 12)
    }

    private func dismissKeyboard() {
        isSearchFieldFocused = false
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

#if DEBUG
#Preview("Search") {
    SearchView()
        .environmentObject(CodeLibraryViewModel())
}
#endif
