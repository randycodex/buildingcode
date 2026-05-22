import SwiftUI

struct SearchView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var query = ""

    private let tabBarClearance: CGFloat = 88

    private var accentColor: Color {
        Color(uiColor: library.readerTheme.accentColor)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    searchField

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
            .overlay(alignment: .top) {
                CodeTopContentFade()
            }
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.large)
            .task(id: query) {
                let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmedQuery.isEmpty else {
                    library.search(query: "")
                    return
                }

                try? await Task.sleep(for: .milliseconds(250))
                guard !Task.isCancelled else { return }
                library.search(query: query)
            }
        }
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
                                library.search(query: recentSearch)
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
        } else {
            CodeEmptyStateCard(
                title: "Search the Code",
                systemImage: "text.magnifyingglass",
                description: "Find section numbers, chapter topics, and exact language across the selected code.",
                accent: accentColor
            )
        }
    }

    private func resultRow(_ result: CodeSearchResult) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
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
}

#if DEBUG
#Preview("Search") {
    SearchView()
        .environmentObject(CodeLibraryViewModel())
}
#endif
