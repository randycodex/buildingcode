import SwiftUI
import UIKit

struct BookmarksView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var scrollOffset: CGFloat = 0
    @State private var savedFilterCodeSectionIDs: Set<Int64>
    @State private var savedFilterFolderIDs: Set<Int64>
    @State private var selectedTagFilter: String? = nil
    @State private var folderEditorTarget: FolderEditorTarget?
    @State private var isExportActionSheetPresented = false
    @State private var cachedFilteredBookmarks: [BookmarkedSection] = []
    @State private var cachedAvailableTags: [String] = []
    @State private var cachedBookmarkGroups: [BookmarkChapterGroup] = []

    private static let filterCodeSectionIDsDefaultsKey = "BookmarksView.filterCodeSectionIDs"
    private static let filterFolderIDsDefaultsKey = "BookmarksView.filterFolderIDs"
    private let tabBarClearance: CGFloat = 104
    private let contentHorizontalInset: CGFloat = 16
    /// Floor for the dock. With a single filter row the dock matches the
    /// Search dock at 86pt; when more rows are present (projects + sections
    /// + tags) the frame grows naturally past the floor.
    private let dockContentMinHeight: CGFloat = 86

    init() {
        _savedFilterCodeSectionIDs = State(
            initialValue: FilterIDsStorage.load(key: Self.filterCodeSectionIDsDefaultsKey)
        )
        _savedFilterFolderIDs = State(
            initialValue: FilterIDsStorage.load(key: Self.filterFolderIDsDefaultsKey)
        )
    }

    /// Sheet routing for the folder editor — `.new` for create, `.edit` to
    /// modify an existing project. The case carries the model so the sheet
    /// closure can disambiguate without a separate boolean.
    enum FolderEditorTarget: Identifiable {
        case new
        case edit(CodeFolder)

        var id: String {
            switch self {
            case .new: return "new"
            case .edit(let folder): return "edit-\(folder.id)"
            }
        }

        var folder: CodeFolder? {
            if case .edit(let f) = self { return f }
            return nil
        }
    }

    private var accentColor: Color {
        Color(uiColor: library.accentColor())
    }

    private var exportButton: some View {
        Button {
            isExportActionSheetPresented = true
        } label: {
            Image(systemName: "square.and.arrow.up")
                .font(.headline.weight(.semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: 36, height: 36)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(library.bookmarks.isEmpty)
        .opacity(library.bookmarks.isEmpty ? 0 : 1)
        .accessibilityHidden(library.bookmarks.isEmpty)
        .accessibilityLabel("Export saved sections as PDF")
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
                    CodeScreenTitle(title: "Saved", collapseProgress: collapseProgress)

                    if !library.bookmarks.isEmpty {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            ForEach(cachedBookmarkGroups) { group in
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
                .padding(.horizontal, contentHorizontalInset)
                .padding(.top, CodeScreenMetrics.topTitlePadding)
                .padding(.bottom, tabBarClearance)
            }
            .overlay(alignment: .top) {
                CodeTopContentFade(title: "Saved", progress: collapseProgress)
            }
            .overlay(alignment: .topTrailing) {
                exportButton
                    .padding(.top, 14)
                    .padding(.trailing, contentHorizontalInset)
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if !library.bookmarks.isEmpty {
                    VStack(spacing: 10) {
                        // Projects row sits at the top of the dock so it
                        // reads as the broadest filter dimension. Always
                        // present (even with zero folders) so the "+ New"
                        // affordance is always reachable from this screen.
                        folderFilterControl

                        if !availableFilterSections.isEmpty {
                            savedFilterControl
                        }
                        if !cachedAvailableTags.isEmpty {
                            tagFilterControl
                        }
                    }
                    .frame(minHeight: dockContentMinHeight, alignment: .bottom)
                    .padding(.horizontal, contentHorizontalInset)
                    .padding(.top, 10)
                    .padding(.bottom, 6)
                    .background(bottomDock)
                }
            }
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .confirmationDialog(
                "Export saved sections",
                isPresented: $isExportActionSheetPresented,
                titleVisibility: .visible
            ) {
                exportActionSheetButtons
            }
            .onAppear {
                library.refreshBookmarks()
                rebuildBookmarkCaches()
            }
            .onChange(of: savedFilterCodeSectionIDs) { _, newValue in
                FilterIDsStorage.persist(newValue, key: Self.filterCodeSectionIDsDefaultsKey)
                rebuildBookmarkCaches()
            }
            .onChange(of: savedFilterFolderIDs) { _, newValue in
                FilterIDsStorage.persist(newValue, key: Self.filterFolderIDsDefaultsKey)
                rebuildBookmarkCaches()
            }
            .onChange(of: selectedTagFilter) { _, _ in
                rebuildBookmarkCaches()
            }
            .onChange(of: library.bookmarks) { _, _ in
                rebuildBookmarkCaches()
            }
            .onChange(of: library.folderMembership) { _, _ in
                rebuildBookmarkCaches()
            }
            .onChange(of: library.codeSections) { _, _ in
                rebuildBookmarkCaches()
            }
            .onChange(of: library.folders) { _, newFolders in
                // If a folder was deleted while it was in the active filter
                // set, prune the now-orphaned ID so the filter pipeline
                // doesn't keep filtering against a missing folder.
                let liveIDs = Set(newFolders.map(\.id))
                let pruned = savedFilterFolderIDs.intersection(liveIDs)
                if pruned != savedFilterFolderIDs {
                    savedFilterFolderIDs = pruned
                } else {
                    rebuildBookmarkCaches()
                }
            }
            .sheet(item: $folderEditorTarget) { target in
                FolderEditorSheet(
                    existing: target.folder,
                    onSave: { name, description, colorHex in
                        if let existing = target.folder {
                            library.updateFolder(existing, name: name, description: description, colorHex: colorHex)
                        } else {
                            _ = library.createFolder(name: name, description: description, colorHex: colorHex)
                        }
                    },
                    onDelete: {
                        if let existing = target.folder {
                            savedFilterFolderIDs.remove(existing.id)
                            library.deleteFolder(id: existing.id)
                        }
                    }
                )
            }
            .modifier(BookmarkExportModifier(library: library, progressSheet: { exportProgressSheet }))
        }
        .coordinateSpace(name: "savedScroll")
        .onPreferenceChange(CodeScrollOffsetPreferenceKey.self) { scrollOffset = $0 }
    }

    // MARK: - Export

    /// Modal shown while the builder runs. Progress bar + cancel.
    @ViewBuilder
    private var exportProgressSheet: some View {
        if case let .building(progress, sectionTitle) = library.exportState {
            VStack(spacing: 20) {
                ProgressView(value: progress)
                    .tint(Color.appChrome)
                    .padding(.horizontal, 24)

                VStack(spacing: 4) {
                    Text("Building PDF")
                        .font(.headline)
                    Text(sectionTitle)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }

                Button(role: .cancel) {
                    library.cancelBookmarkExport()
                } label: {
                    Text("Cancel")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            Capsule().fill(Color.secondary.opacity(0.15))
                        )
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 24)
            }
            .padding(.vertical, 32)
            .presentationDetents([.height(220)])
            .interactiveDismissDisabled()
        }
    }

    /// Action-sheet buttons for the Export toolbar. Offers up to three
    /// options: current filter (only if a filter is active and narrows
    /// the list), all saved sections, and per-folder exports for each
    /// existing project.
    @ViewBuilder
    private var exportActionSheetButtons: some View {
        let filteredCount = cachedFilteredBookmarks.count
        let totalCount = library.bookmarks.count
        let isFiltered = filteredCount > 0 && filteredCount < totalCount

        if isFiltered {
            Button("Export current filter (\(filteredCount))") {
                library.startBookmarkExport(
                    bookmarks: cachedFilteredBookmarks,
                    contextLabel: currentFilterContextLabel
                )
            }
        }

        Button("Export all saved (\(totalCount))") {
            library.startBookmarkExport(
                bookmarks: library.bookmarks,
                contextLabel: nil
            )
        }

        // Per-folder shortcuts only show when the folder has content;
        // empty folders aren't useful as export targets.
        ForEach(library.folders.filter { folderHasBookmarks($0) }) { folder in
            Button("Export “\(folder.name)”") {
                let folderBookmarks = library.bookmarks.filter { bookmark in
                    Set(library.folderMembership[bookmark.id] ?? []).contains(folder.id)
                }
                library.startBookmarkExport(
                    bookmarks: folderBookmarks,
                    contextLabel: folder.name
                )
            }
        }

        Button("Cancel", role: .cancel) { }
    }

    private func folderHasBookmarks(_ folder: CodeFolder) -> Bool {
        library.bookmarks.contains { bookmark in
            Set(library.folderMembership[bookmark.id] ?? []).contains(folder.id)
        }
    }

    /// Short label for the "Current filter" export so its PDF header shows
    /// something meaningful instead of a blank context. Combines whichever
    /// filter dimensions are active.
    private var currentFilterContextLabel: String? {
        var parts: [String] = []
        if !savedFilterFolderIDs.isEmpty {
            let names = library.folders
                .filter { savedFilterFolderIDs.contains($0.id) }
                .map(\.name)
            if !names.isEmpty { parts.append("Projects: \(names.joined(separator: ", "))") }
        }
        if !savedFilterCodeSectionIDs.isEmpty {
            let names = library.codeSections
                .filter { savedFilterCodeSectionIDs.contains($0.id) }
                .map { CodeLibraryViewModel.displayName(forCodeSectionName: $0.name) }
            if !names.isEmpty { parts.append(names.joined(separator: ", ")) }
        }
        if let tag = selectedTagFilter {
            parts.append("Tag: \(tag)")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private var bottomDock: some View {
        // Mirrors the Search screen's dock styling so both tabs share the same
        // bottom-anchored filter affordance.
        Color(uiColor: .systemGroupedBackground)
            .ignoresSafeArea(edges: .bottom)
    }

    private var availableFilterSections: [CodeSectionCategory] {
        // Show every code section in the canonical order so missing sections
        // (e.g. Fuel Gas before the user has saved anything from it) are still
        // available as filter chips. Hiding sections that have no bookmarks
        // yet hid Fuel Gas in real usage; showing them all matches how the
        // filter behaves on Search.
        library.codeSections
    }

    private func makeFilteredBookmarks() -> [BookmarkedSection] {
        var results = library.bookmarks
        if !savedFilterCodeSectionIDs.isEmpty {
            results = results.filter { bookmark in
                guard let id = bookmark.codeSectionID else { return false }
                return savedFilterCodeSectionIDs.contains(id)
            }
        }
        if !savedFilterFolderIDs.isEmpty {
            // A bookmark passes the folder filter if it belongs to ANY
            // selected folder — OR semantics within the folder dimension,
            // AND across other dimensions (matches how the section + tag
            // filters compose).
            results = results.filter { bookmark in
                let memberIDs = Set(library.folderMembership[bookmark.id] ?? [])
                return !memberIDs.isDisjoint(with: savedFilterFolderIDs)
            }
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
    private func makeAvailableTags() -> [String] {
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

    /// Projects row in the bottom dock. Always present so the user can
    /// create their first project without leaving the screen. Long-press
    /// on a folder chip opens the editor for that folder.
    private var folderFilterControl: some View {
        FolderFilterChipsRow(
            folders: library.folders,
            selectedIDs: $savedFilterFolderIDs,
            onNew: { folderEditorTarget = .new },
            onEdit: { folder in folderEditorTarget = .edit(folder) }
        )
    }

    private var tagFilterControl: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                tagFilterChip(title: "All Tags", isSelected: selectedTagFilter == nil) {
                    selectedTagFilter = nil
                }
                ForEach(cachedAvailableTags, id: \.self) { tag in
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
        let minWidth = title == "All Tags" ? CodeFilterChipMetrics.primaryChipWidth : nil
        return Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: "tag.fill")
                    .font(.caption2.weight(.semibold))
                Text(title)
                    .font(.subheadline.weight(.semibold))
            }
            .foregroundStyle(isSelected ? Color.appChromeOnFill : .secondary)
            .frame(width: minWidth, alignment: .leading)
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
        CodeSectionMultiFilterChips(
            sections: availableFilterSections,
            selectedIDs: $savedFilterCodeSectionIDs,
            accentForSection: { bookmarkAccentColor(for: $0) }
        )
    }

    private func rebuildBookmarkCaches() {
        let filtered = makeFilteredBookmarks()
        cachedFilteredBookmarks = filtered
        cachedAvailableTags = makeAvailableTags()
        cachedBookmarkGroups = makeBookmarkGroups(from: filtered)
    }

    private func makeBookmarkGroups(from bookmarks: [BookmarkedSection]) -> [BookmarkChapterGroup] {
        let grouped = Dictionary(grouping: bookmarks) { bookmark in
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

/// Hoists the three export-related modal modifiers out of BookmarksView's
/// body so SwiftUI's compile-time type checker doesn't choke on the long
/// modifier chain. Behaviorally identical to inlining the modifiers.
private struct BookmarkExportModifier<Progress: View>: ViewModifier {
    @ObservedObject var library: CodeLibraryViewModel
    @ViewBuilder var progressSheet: () -> Progress

    private var isBuilding: Bool {
        if case .building = library.exportState { return true }
        return false
    }

    private var isReady: Bool {
        if case .ready = library.exportState { return true }
        return false
    }

    private var failureMessage: String? {
        if case .failed(let message) = library.exportState { return message }
        return nil
    }

    private var readyURL: URL? {
        if case .ready(let url, _) = library.exportState { return url }
        return nil
    }

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: Binding(
                get: { isBuilding },
                set: { if !$0 { library.cancelBookmarkExport() } }
            )) {
                progressSheet()
            }
            .sheet(isPresented: Binding(
                get: { isReady },
                set: { if !$0 { library.clearBookmarkExportState() } }
            )) {
                if let url = readyURL {
                    BookmarkExportShareSheet(fileURL: url) {
                        library.clearBookmarkExportState()
                    }
                    .ignoresSafeArea()
                }
            }
            .alert(
                "Export failed",
                isPresented: Binding(
                    get: { failureMessage != nil },
                    set: { _ in library.clearBookmarkExportState() }
                ),
                presenting: failureMessage
            ) { _ in
                Button("OK", role: .cancel) { library.clearBookmarkExportState() }
            } message: { message in
                Text(message)
            }
    }
}

#if DEBUG
#Preview("Bookmarks") {
    BookmarksView()
        .environmentObject(CodeLibraryViewModel())
}
#endif
