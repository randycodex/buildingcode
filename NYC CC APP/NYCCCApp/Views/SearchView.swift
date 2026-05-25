import SwiftUI
import UIKit

struct SearchView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var query = ""
    @State private var searchesAllCodeSections: Bool
    @State private var scrollOffset: CGFloat = 0
    @FocusState private var isSearchFieldFocused: Bool

    private static let searchesAllCodeSectionsDefaultsKey = "SearchView.searchesAllCodeSections"
    private let contentHorizontalInset: CGFloat = 16
    private let tabBarClearance: CGFloat = 168

    private var accentColor: Color {
        Color(uiColor: library.accentColor())
    }

    private var collapseProgress: CGFloat {
        min(max(-scrollOffset / 64, 0), 1)
    }

    init() {
        _searchesAllCodeSections = State(
            initialValue: UserDefaults.standard.bool(forKey: Self.searchesAllCodeSectionsDefaultsKey)
        )
    }

    var body: some View {
        NavigationStack {
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
                    } else if library.searchResults.isEmpty {
                        Text("No results")
                            .font(.subheadline)
                            .foregroundStyle(Color.secondary.opacity(0.7))
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.top, 120)
                    } else if searchesAllCodeSections && !library.codeSections.isEmpty {
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
                            ForEach(library.searchResults) { result in
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
                    searchScopeControl
                    searchField
                }
                .padding(.horizontal, contentHorizontalInset)
                .padding(.top, 10)
                .padding(.bottom, 22)
                .background(bottomSearchDock)
            }
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                    isSearchFieldFocused = true
                }
            }
            .onChange(of: searchesAllCodeSections) { _, newValue in
                UserDefaults.standard.set(newValue, forKey: Self.searchesAllCodeSectionsDefaultsKey)
            }
            .task(id: SearchTaskID(
                query: query,
                searchesAllCodeSections: searchesAllCodeSections,
                selectedCodeSectionID: library.selectedCodeSectionID
            )) {
                let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmedQuery.isEmpty else {
                    library.search(query: "")
                    return
                }

                try? await Task.sleep(for: .milliseconds(250))
                guard !Task.isCancelled else { return }
                library.search(
                    query: query,
                    restrictToSelectedCodeSection: !searchesAllCodeSections
                )
            }
        }
        .coordinateSpace(name: "searchScroll")
        .onPreferenceChange(CodeScrollOffsetPreferenceKey.self) { scrollOffset = $0 }
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
    private var searchScopeControl: some View {
        if !library.codeSections.isEmpty, library.selectedCodeSectionID != nil {
            Picker("Search Scope", selection: $searchesAllCodeSections) {
                Text(library.codeSectionName(id: library.selectedCodeSectionID)).tag(false)
                Text("All Sections").tag(true)
            }
            .pickerStyle(.segmented)
            .accessibilityLabel("Search scope")
        }
    }

    @ViewBuilder
    private var emptyQueryHistorySection: some View {
        VStack(alignment: .leading, spacing: 16) {
            if !library.recentlyViewedSections.isEmpty {
                recentlyViewedSection
            }

            if !library.pinnedSearches.isEmpty {
                pinnedSearchSection
            }

            if !unpinnedRecentSearches.isEmpty {
                recentSearchSection
            }
        }
    }

    private var jumpBackInEntries: [RecentlyViewedEntry] {
        Array(library.recentlyViewedSections.prefix(4))
    }

    private var recentlyViewedSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            searchHistorySectionHeader("Jump Back In")

            LazyVGrid(
                columns: [
                    GridItem(.flexible(), spacing: 8),
                    GridItem(.flexible(), spacing: 8),
                ],
                spacing: 8
            ) {
                ForEach(jumpBackInEntries) { entry in
                    NavigationLink {
                        ReaderView(sectionID: entry.sectionID)
                    } label: {
                        recentlyViewedTile(entry)
                    }
                    .buttonStyle(.plain)
                }
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

            if !preview.isEmpty {
                Text(preview)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Text(entry.codeSectionName)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.tertiary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, minHeight: 48, alignment: .topLeading)
        .padding(8)
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
        library.search(
            query: searchQuery,
            restrictToSelectedCodeSection: !searchesAllCodeSections
        )
    }

    private func searchPinHaptic() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func searchResultLink(_ result: CodeSearchResult) -> some View {
        VStack(spacing: 0) {
            NavigationLink {
                ReaderView(sectionID: result.id)
            } label: {
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
        let grouped = Dictionary(grouping: library.searchResults) { $0.codeSectionID }
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
                    if searchesAllCodeSections,
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

    private struct SearchTaskID: Hashable {
        let query: String
        let searchesAllCodeSections: Bool
        let selectedCodeSectionID: Int64?
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
