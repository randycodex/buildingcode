import SwiftUI
import UIKit

struct BookmarksView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var scrollOffset: CGFloat = 0

    private let tabBarClearance: CGFloat = 104

    private var accentColor: Color {
        Color(uiColor: library.accentColor())
    }

    private func bookmarkAccentColor(for codeSectionID: Int64?) -> Color {
        Color(uiColor: library.accentColor(for: codeSectionID))
    }

    private var collapseProgress: CGFloat {
        min(max(-scrollOffset / 64, 0), 1)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                GeometryReader { proxy in
                    Color.clear
                        .preference(key: CodeScrollOffsetPreferenceKey.self, value: proxy.frame(in: .named("savedScroll")).minY)
                }
                .frame(height: 0)

                VStack(alignment: .leading, spacing: 0) {
                    Text("Saved")
                        .font(.system(size: 32, weight: .bold, design: .default))
                        .foregroundStyle(.primary)
                        .padding(.bottom, 8)
                        .scaleEffect(1 - (collapseProgress * 0.08), anchor: .leading)
                        .opacity(1 - (collapseProgress * 0.22))

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
                .padding(.bottom, tabBarClearance)
            }
            .overlay(alignment: .top) {
                CodeTopContentFade(title: "Saved", progress: collapseProgress)
            }
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                library.refreshBookmarks()
            }
        }
        .coordinateSpace(name: "savedScroll")
        .onPreferenceChange(CodeScrollOffsetPreferenceKey.self) { scrollOffset = $0 }
    }

    private var bookmarkGroups: [BookmarkChapterGroup] {
        let grouped = Dictionary(grouping: library.bookmarks) { bookmark in
            BookmarkGroupKey(
                codeSectionID: bookmark.codeSectionID,
                chapterNumber: bookmark.chapterNumber
            )
        }
        return grouped.map { key, items in
            BookmarkChapterGroup(
                codeSectionID: key.codeSectionID,
                codeSectionName: library.codeSectionName(id: key.codeSectionID),
                chapterNumber: key.chapterNumber,
                chapterTitle: items.first?.chapterTitle ?? "",
                items: items.sorted {
                    $0.sectionNumber.compare($1.sectionNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
                }
            )
        }
        .sorted {
            if $0.codeSectionName != $1.codeSectionName {
                return $0.codeSectionName.localizedStandardCompare($1.codeSectionName) == .orderedAscending
            }
            return $0.chapterNumber.compare($1.chapterNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
        }
    }

    private func chapterHeader(_ group: BookmarkChapterGroup) -> some View {
        let groupAccent = bookmarkAccentColor(for: group.codeSectionID)

        return VStack(alignment: .leading, spacing: 5) {
            if !library.codeSections.isEmpty {
                Text(group.codeSectionName)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(groupAccent)
                    .textCase(.uppercase)
            }

            Text("Chapter \(group.chapterNumber)")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            Text(group.chapterTitle)
                .font(.headline.weight(.semibold))
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 26)
        .padding(.bottom, 22)
    }

    @ViewBuilder
    private func bookmarkDestination(for bookmark: BookmarkedSection) -> some View {
        // Bookmarks open the single-section reader (notes screen) directly so
        // tapping a bookmarked subsection goes straight to its notes view
        // rather than landing inside the full chapter reader.
        ReaderView(sectionID: bookmark.id)
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
        let bookmarkAccent = bookmarkAccentColor(for: bookmark.codeSectionID)

        return HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    if bookmark.kind == .textBlock {
                        CodeMetaBadge(text: "Text Block", accent: bookmarkAccent)
                    } else {
                        Text(bookmark.sectionNumber)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(bookmarkAccent)
                    }

                    if bookmark.isBookmarked {
                        Image(systemName: "bookmark.fill")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(bookmarkAccent)
                    }

                    if bookmark.hasNote {
                        Image(systemName: "note.text")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(bookmarkAccent)
                            .accessibilityLabel("Has note")
                    }
                }

                Text(bookmark.displayTitle)
                    .font(library.readerTheme.swiftUIFont(size: library.readerTheme.fontSize + 1, emphasized: true))
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)

                if !bookmark.previewText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(bookmark.previewText)
                        .font(library.readerTheme.swiftUIFont(size: max(library.readerTheme.fontSize - 1, ReaderTheme.minimumFontSize)))
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                        .lineLimit(3)
                }

                if bookmark.hasNote {
                    Text(bookmark.noteBody)
                        .font(library.readerTheme.swiftUIFont(size: max(library.readerTheme.fontSize - 1, ReaderTheme.minimumFontSize)))
                        .foregroundStyle(bookmarkAccent.opacity(0.88))
                        .multilineTextAlignment(.leading)
                        .padding(.top, 4)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, 12)
    }

}

private struct BookmarkGroupKey: Hashable {
    let codeSectionID: Int64?
    let chapterNumber: String
}

private struct BookmarkChapterGroup: Identifiable {
    let codeSectionID: Int64?
    let codeSectionName: String
    let chapterNumber: String
    let chapterTitle: String
    let items: [BookmarkedSection]

    var id: String { "\(codeSectionID.map(String.init) ?? "all")-\(chapterNumber)" }
}

#if DEBUG
#Preview("Bookmarks") {
    BookmarksView()
        .environmentObject(CodeLibraryViewModel())
}
#endif
