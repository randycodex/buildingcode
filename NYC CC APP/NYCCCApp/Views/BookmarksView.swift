import SwiftUI

struct BookmarksView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel

    private var accentColor: Color {
        Color(uiColor: library.readerTheme.accentColor)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    CodeSurfaceCard(accent: accentColor) {
                        Text("Saved Sections")
                            .font(.title3.weight(.semibold))
                        Text("Keep frequently referenced sections one tap away while you move between browse, search, and the reader.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        CodeStatPill(
                            value: "\(library.bookmarks.count)",
                            label: library.bookmarks.count == 1 ? "bookmark" : "bookmarks",
                            accent: accentColor
                        )
                    }

                    if library.bookmarks.isEmpty {
                        CodeEmptyStateCard(
                            title: "No Bookmarks",
                            systemImage: "bookmark",
                            description: "Bookmark sections from the reader to pin them here.",
                            accent: accentColor
                        )
                    } else {
                        LazyVStack(spacing: 14) {
                            ForEach(library.bookmarks) { bookmark in
                                NavigationLink {
                                    ReaderView(sectionID: bookmark.id)
                                } label: {
                                    CodeSurfaceCard(accent: accentColor) {
                                        VStack(alignment: .leading, spacing: 10) {
                                            HStack(alignment: .top, spacing: 12) {
                                                VStack(alignment: .leading, spacing: 4) {
                                                    if bookmark.kind == .textBlock {
                                                        Label("Text Block", systemImage: "text.alignleft")
                                                            .font(.caption.weight(.semibold))
                                                            .foregroundStyle(accentColor)
                                                    } else {
                                                        Text(bookmark.sectionNumber)
                                                            .font(.headline)
                                                            .foregroundStyle(accentColor)
                                                    }

                                                    Text("Chapter \(bookmark.chapterNumber)")
                                                        .font(.caption.weight(.medium))
                                                        .foregroundStyle(.secondary)
                                                }

                                                VStack(alignment: .leading, spacing: 6) {
                                                    Text(bookmark.displayTitle)
                                                        .font(.subheadline.weight(.semibold))
                                                        .foregroundStyle(.primary)
                                                        .multilineTextAlignment(.leading)
                                                    Text(bookmark.codeVersion)
                                                        .font(.caption)
                                                        .foregroundStyle(.secondary)
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
            .navigationTitle("Bookmarks")
            .onAppear {
                library.refreshBookmarks()
            }
        }
    }
}

#if DEBUG
#Preview("Bookmarks") {
    BookmarksView()
        .environmentObject(CodeLibraryViewModel())
}
#endif
