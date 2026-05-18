import SwiftUI

struct SearchView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var query = ""

    private var accentColor: Color {
        Color(uiColor: library.readerTheme.accentColor)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if query.isEmpty {
                        CodeSurfaceCard(accent: accentColor) {
                            HStack(alignment: .top, spacing: 16) {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Search the Code")
                                        .font(.title3.weight(.semibold))
                                    Text("Search section numbers, titles, and body text across the bundled code content.")
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }

                                Spacer(minLength: 0)

                                Image(systemName: "magnifyingglass.circle.fill")
                                    .font(.title2)
                                    .foregroundStyle(accentColor)
                            }

                            VStack(alignment: .leading, spacing: 10) {
                                Text("Good searches")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)

                                searchPromptRow("1029", subtitle: "Jump directly to a section number")
                                searchPromptRow("means of egress", subtitle: "Search a phrase across sections")
                                searchPromptRow("sprinkler", subtitle: "Scan body text and titles together")
                            }
                        }
                    } else if library.searchResults.isEmpty {
                        CodeEmptyStateCard(
                            title: "No Results",
                            systemImage: "magnifyingglass",
                            description: "No sections matched “\(query)”. Try a broader phrase, a section number, or fewer words.",
                            accent: accentColor
                        )
                    } else {
                        CodeSurfaceCard(accent: accentColor) {
                            CodeSectionHeader(
                                title: "Results for “\(query)”",
                                subtitle: "\(library.searchResults.count) \(library.searchResults.count == 1 ? "section" : "sections") matched.",
                                accent: accentColor
                            )
                        }

                        LazyVStack(spacing: 14) {
                            ForEach(library.searchResults) { result in
                                NavigationLink {
                                    ReaderView(sectionID: result.id)
                                } label: {
                                    CodeSurfaceCard(accent: accentColor) {
                                        VStack(alignment: .leading, spacing: 10) {
                                            HStack(alignment: .top, spacing: 12) {
                                                VStack(alignment: .leading, spacing: 4) {
                                                    if result.kind == .textBlock {
                                                        Label("Text Block", systemImage: "text.alignleft")
                                                            .font(.caption.weight(.semibold))
                                                            .foregroundStyle(accentColor)
                                                    } else {
                                                        Text(result.sectionNumber)
                                                            .font(.headline)
                                                            .foregroundStyle(accentColor)
                                                    }

                                                    Text("Chapter \(result.chapterNumber)")
                                                        .font(.caption.weight(.medium))
                                                        .foregroundStyle(.secondary)
                                                }

                                                VStack(alignment: .leading, spacing: 6) {
                                                    Text(result.displayTitle)
                                                        .font(.subheadline.weight(.semibold))
                                                        .foregroundStyle(.primary)
                                                        .multilineTextAlignment(.leading)
                                                    Text(result.snippet)
                                                        .font(.subheadline)
                                                        .foregroundStyle(.secondary)
                                                        .multilineTextAlignment(.leading)
                                                }

                                                Spacer(minLength: 0)
                                            }

                                            Label("Open section", systemImage: "arrow.right.circle.fill")
                                                .font(.subheadline.weight(.semibold))
                                                .foregroundStyle(accentColor)
                                        }
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 28)
            }
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle("Search")
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search building code")
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
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

    private func searchPromptRow(_ query: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(query)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color(uiColor: .secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

#if DEBUG
#Preview("Search") {
    SearchView()
        .environmentObject(CodeLibraryViewModel())
}
#endif
