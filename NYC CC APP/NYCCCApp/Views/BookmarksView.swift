import SwiftUI
import UIKit

struct BookmarksView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var scrollOffset: CGFloat = 0
    @State private var savedFilterCodeSectionID: Int64? = nil
    @State private var savedFilterAllSelected: Bool = true
    @State private var selectedTagFilter: String? = nil

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
                        .font(.system(size: 16, weight: .bold, design: .default))
                        .foregroundStyle(.primary)
                        .padding(.bottom, 8)
                        .scaleEffect(1 - (collapseProgress * 0.08), anchor: .leading)
                        .opacity(1 - (collapseProgress * 0.22))

                    if !library.bookmarks.isEmpty {
                        if !availableFilterSections.isEmpty {
                            savedFilterControl
                                .padding(.bottom, 8)
                        }

                        if !availableTags.isEmpty {
                            tagFilterControl
                                .padding(.bottom, 8)
                        }

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

    private var availableFilterSections: [CodeSectionCategory] {
        // Only offer chips for code sections that actually contain a saved
        // bookmark, so the row doesn't fill with empty chips.
        let usedIDs = Set(library.bookmarks.compactMap(\.codeSectionID))
        return library.codeSections.filter { usedIDs.contains($0.id) }
    }

    private var filteredBookmarks: [BookmarkedSection] {
        var results = library.bookmarks
        if !savedFilterAllSelected, let id = savedFilterCodeSectionID {
            results = results.filter { $0.codeSectionID == id }
        }
        if let tag = selectedTagFilter {
            results = results.filter { bookmark in
                bookmark.tags.contains { $0.caseInsensitiveCompare(tag) == .orderedSame }
            }
        }
        return results
    }

    /// Distinct tags actually in use across the user's bookmarks, sorted by
    /// usage (most-used first). The starter set is only surfaced inside the
    /// editor — the filter row only shows tags the user has applied at least
    /// once so it never feels empty.
    private var availableTags: [String] {
        var counts: [String: Int] = [:]
        for bookmark in library.bookmarks {
            for tag in bookmark.tags {
                counts[tag, default: 0] += 1
            }
        }
        return counts
            .sorted {
                if $0.value != $1.value { return $0.value > $1.value }
                return $0.key.localizedStandardCompare($1.key) == .orderedAscending
            }
            .map(\.key)
    }

    private var tagFilterControl: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                tagFilterChip(title: "All Tags", isSelected: selectedTagFilter == nil) {
                    selectedTagFilter = nil
                }
                ForEach(availableTags, id: \.self) { tag in
                    tagFilterChip(
                        title: tag,
                        isSelected: selectedTagFilter == tag
                    ) {
                        selectedTagFilter = selectedTagFilter == tag ? nil : tag
                    }
                }
            }
            .padding(.vertical, 2)
        }
    }

    private func tagFilterChip(
        title: String,
        isSelected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: "tag.fill")
                    .font(.caption2.weight(.semibold))
                Text(title)
                    .font(.subheadline.weight(.semibold))
            }
            .foregroundStyle(isSelected ? Color.white : .secondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(
                Capsule(style: .continuous)
                    .fill(isSelected ? Color.secondary : Color.secondary.opacity(0.12))
            )
        }
        .buttonStyle(.plain)
    }

    private var savedFilterControl: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                savedFilterChip(
                    title: "All",
                    accent: accentColor,
                    isSelected: savedFilterAllSelected
                ) {
                    savedFilterAllSelected = true
                    savedFilterCodeSectionID = nil
                }

                ForEach(availableFilterSections) { codeSection in
                    let isSelected = !savedFilterAllSelected && savedFilterCodeSectionID == codeSection.id
                    savedFilterChip(
                        title: CodeLibraryViewModel.displayName(forCodeSectionName: codeSection.name),
                        accent: bookmarkAccentColor(for: codeSection.id),
                        isSelected: isSelected
                    ) {
                        savedFilterAllSelected = false
                        savedFilterCodeSectionID = codeSection.id
                    }
                }
            }
            .padding(.vertical, 2)
        }
    }

    private func savedFilterChip(
        title: String,
        accent: Color,
        isSelected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isSelected ? Color.white : accent)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(
                    Capsule(style: .continuous)
                        .fill(isSelected ? accent : accent.opacity(0.12))
                )
        }
        .buttonStyle(.plain)
    }

    private var bookmarkGroups: [BookmarkChapterGroup] {
        let grouped = Dictionary(grouping: filteredBookmarks) { bookmark in
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

        return VStack(alignment: .leading, spacing: 6) {
            if !library.codeSections.isEmpty {
                Text(group.codeSectionName)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(groupAccent)
                    .textCase(.uppercase)
            }

            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text("Chapter \(group.chapterNumber)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .fixedSize(horizontal: true, vertical: false)

                Text(group.chapterTitle)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
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

                    if bookmark.hasNote {
                        Image(systemName: "note.text")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .frame(width: 16, height: 16)
                            .accessibilityLabel("Has note")
                    }

                    if bookmark.isBookmarked {
                        Image(systemName: "bookmark.fill")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(bookmarkAccent)
                            .frame(width: 16, height: 16)
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

                if !bookmark.tags.isEmpty {
                    bookmarkTagsRow(bookmark.tags, accent: bookmarkAccent)
                        .padding(.top, 6)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, 12)
    }

    private func bookmarkTagsRow(_ tags: [String], accent: Color) -> some View {
        // Wrap with the shared FlowLayout so many tags don't get clipped.
        FlowLayout(spacing: 6) {
            ForEach(tags, id: \.self) { tag in
                Text(tag)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(accent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(
                        Capsule(style: .continuous)
                            .fill(accent.opacity(0.12))
                    )
            }
        }
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
