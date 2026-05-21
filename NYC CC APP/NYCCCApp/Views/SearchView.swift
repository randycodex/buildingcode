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
                VStack(alignment: .leading, spacing: 16) {
                    Text("Search")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(.primary)

                    TextField("", text: $query)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .background(Color(uiColor: .secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    if !query.isEmpty && library.searchResults.isEmpty {
                        Text("No results")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else if !query.isEmpty {
                        LazyVStack(spacing: 0) {
                            ForEach(library.searchResults) { result in
                                NavigationLink {
                                    ReaderView(sectionID: result.id)
                                } label: {
                                    resultRow(result)
                                }
                                .buttonStyle(.plain)

                                CodeHairline()
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 24)
            }
            .overlay(alignment: .top) {
                CodeTopContentFade()
            }
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color(uiColor: .systemGroupedBackground), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
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
