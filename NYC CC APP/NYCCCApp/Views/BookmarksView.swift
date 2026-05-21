import SwiftUI
import UIKit

struct BookmarksView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel

    private var accentColor: Color {
        Color(uiColor: library.readerTheme.accentColor)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Bookmarks / Notes")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundStyle(.primary)
                        .padding(.bottom, 18)

                    if !library.bookmarks.isEmpty {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            ForEach(bookmarkGroups) { group in
                                chapterHeader(group)

                                ForEach(group.items) { bookmark in
                                    NavigationLink {
                                        bookmarkDestination(for: bookmark)
                                    } label: {
                                        bookmarkRow(bookmark)
                                    }
                                    .buttonStyle(.plain)

                                    CodeHairline()
                                }
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
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
            .onAppear {
                library.refreshBookmarks()
            }
        }
    }

    private var bookmarkGroups: [BookmarkChapterGroup] {
        let grouped = Dictionary(grouping: library.bookmarks, by: \.chapterNumber)
        return grouped.map { chapterNumber, items in
            BookmarkChapterGroup(
                chapterNumber: chapterNumber,
                chapterTitle: items.first?.chapterTitle ?? "",
                items: items.sorted {
                    $0.sectionNumber.compare($1.sectionNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
                }
            )
        }
        .sorted {
            $0.chapterNumber.compare($1.chapterNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
        }
    }

    private func chapterHeader(_ group: BookmarkChapterGroup) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Chapter \(group.chapterNumber)")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(accentColor)
                .textCase(.uppercase)

            Text(group.chapterTitle)
                .font(.headline)
                .foregroundStyle(.primary)
        }
        .padding(.top, 20)
        .padding(.bottom, 10)
    }

    @ViewBuilder
    private func bookmarkDestination(for bookmark: BookmarkedSection) -> some View {
        if library.selectedVersion?.contentKind == .authored,
           let chapter = resolvedChapter(for: bookmark) {
            ChapterHTMLReaderView(
                chapter: chapter,
                initialSection: CodeSectionSummary(
                    id: bookmark.id,
                    chapterNumber: bookmark.chapterNumber,
                    sectionNumber: bookmark.sectionNumber,
                    title: bookmark.title,
                    kind: bookmark.kind
                )
            )
        } else {
            ReaderView(sectionID: bookmark.id)
        }
    }

    private func resolvedChapter(for bookmark: BookmarkedSection) -> CodeChapter? {
        if let chapter = library.chapters.first(where: {
            $0.chapterNumber.caseInsensitiveCompare(bookmark.chapterNumber) == .orderedSame
        }) {
            return chapter
        }

        return CodeChapter(
            id: bookmark.id,
            codeSectionID: nil,
            chapterNumber: bookmark.chapterNumber,
            title: bookmark.chapterTitle
        )
    }

    private func bookmarkRow(_ bookmark: BookmarkedSection) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    if bookmark.kind == .textBlock {
                        CodeMetaBadge(text: "Text Block", accent: accentColor)
                    } else {
                        Text(bookmark.sectionNumber)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.primary)
                    }

                    if bookmark.isBookmarked {
                        Image(systemName: "bookmark.fill")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(accentColor)
                    } else if bookmark.hasNote {
                        Text("Note")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(accentColor)
                    }
                }

                Text(bookmark.displayTitle)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)

                if bookmark.hasNote {
                    Text(bookmark.noteBody)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                        .padding(.top, 4)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, 12)
    }
}

private struct BookmarkChapterGroup: Identifiable {
    let chapterNumber: String
    let chapterTitle: String
    let items: [BookmarkedSection]

    var id: String { chapterNumber }
}

#if DEBUG
#Preview("Bookmarks") {
    BookmarksView()
        .environmentObject(CodeLibraryViewModel())
}
#endif
