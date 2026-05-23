import SwiftUI
import UIKit

struct SearchView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var query = ""
    @State private var searchesAllCodeSections: Bool
    @FocusState private var isSearchFieldFocused: Bool

    private static let searchesAllCodeSectionsDefaultsKey = "SearchView.searchesAllCodeSections"
    private let tabBarClearance: CGFloat = 168

    private var accentColor: Color {
        Color(uiColor: library.accentColor())
    }

    init() {
        _searchesAllCodeSections = State(
            initialValue: UserDefaults.standard.bool(forKey: Self.searchesAllCodeSectionsDefaultsKey)
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Search")
                        .font(.system(size: 32, weight: .bold, design: .default))
                        .foregroundStyle(.primary)
                        .padding(.bottom, 8)

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
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, tabBarClearance)
            }
            .contentShape(Rectangle())
            .onTapGesture {
                dismissKeyboard()
            }
            .overlay(alignment: .top) {
                CodeTopContentFade()
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
    }

    private var bottomSearchDock: some View {
        ZStack(alignment: .top) {
            Color(uiColor: .systemGroupedBackground)

            LinearGradient(
                colors: [
                    Color(uiColor: .systemGroupedBackground).opacity(0),
                    Color(uiColor: .systemGroupedBackground).opacity(0.92),
                    Color(uiColor: .systemGroupedBackground)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 72)
            .frame(maxWidth: .infinity, alignment: .top)
        }
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
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    if searchesAllCodeSections, let codeSectionID = result.codeSectionID {
                        CodeMetaBadge(text: library.codeSectionName(id: codeSectionID), accent: accentColor)
                    }

                    if result.kind == .textBlock {
                        CodeMetaBadge(text: "Text Block", accent: accentColor)
                    } else {
                        Text(result.sectionNumber)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.primary)
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
