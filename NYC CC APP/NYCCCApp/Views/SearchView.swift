import SwiftUI
import UIKit

struct SearchView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var query = ""
    @State private var searchesAllCodeSections: Bool
    @State private var scrollOffset: CGFloat = 0
    @FocusState private var isSearchFieldFocused: Bool

    private static let searchesAllCodeSectionsDefaultsKey = "SearchView.searchesAllCodeSections"
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
                        .font(.system(size: 32, weight: .bold, design: .default))
                        .foregroundStyle(.primary)
                        .padding(.bottom, 8)
                        .scaleEffect(1 - (collapseProgress * 0.08), anchor: .leading)
                        .opacity(1 - (collapseProgress * 0.22))

                    if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        recentSearchSection
                    } else if library.searchResults.isEmpty {
                        CodeEmptyStateCard(
                            title: "No Results",
                            systemImage: "magnifyingglass",
                            description: "Try a section number, chapter term, or phrase from the code text.",
                            accent: accentColor
                        )
                    } else {
                        LazyVStack(spacing: 0) {
                            ForEach(library.searchResults) { result in
                                HStack(alignment: .top, spacing: 10) {
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

                                    NavigationLink {
                                        CompareWorkspaceView(referenceTarget: compareTarget(for: result))
                                    } label: {
                                        Image(systemName: "square.split.2x1")
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(Color(uiColor: library.accentColor(for: result.codeSectionID)))
                                            .frame(width: 36, height: 36)
                                    }
                                    .buttonStyle(.plain)
                                    .simultaneousGesture(
                                        TapGesture().onEnded {
                                            library.recordRecentSearch(query)
                                        }
                                    )
                                    .accessibilityLabel("Open result in compare")
                                }

                                CodeHairline()
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(.horizontal, 16)
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
                .padding(.horizontal, 16)
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
    private var recentSearchSection: some View {
        if !library.recentSearches.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Recent Searches")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)

                LazyVStack(spacing: 0) {
                    ForEach(library.recentSearches, id: \.self) { recentSearch in
                        HStack(spacing: 12) {
                            Button {
                                query = recentSearch
                                library.search(
                                    query: recentSearch,
                                    restrictToSelectedCodeSection: !searchesAllCodeSections
                                )
                            } label: {
                                HStack(spacing: 10) {
                                    Image(systemName: "clock.arrow.circlepath")
                                        .font(.footnote.weight(.semibold))
                                        .foregroundStyle(.secondary)

                                    Text(recentSearch)
                                        .font(.subheadline)
                                        .foregroundStyle(.primary)
                                        .multilineTextAlignment(.leading)

                                    Spacer(minLength: 0)
                                }
                            }
                            .buttonStyle(.plain)

                            Button {
                                library.removeRecentSearch(recentSearch)
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(.tertiary)
                                    .frame(width: 18, height: 18)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.vertical, 12)

                        CodeHairline()
                    }
                }
            }
        }
    }

    private func resultRow(_ result: CodeSearchResult) -> some View {
        let resultAccent = Color(uiColor: library.accentColor(for: result.codeSectionID))

        return HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    if searchesAllCodeSections, let codeSectionID = result.codeSectionID {
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
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)

                Text(result.snippet)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.leading)
                    .lineLimit(4)
            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, 12)
    }

    private func compareTarget(for result: CodeSearchResult) -> CompareLaunchTarget {
        CompareLaunchTarget(
            codeSectionID: result.codeSectionID,
            chapterNumber: result.chapterNumber,
            sectionID: result.id
        )
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
