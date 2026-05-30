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
    @State private var savedSortMode: BookmarkSortMode = .codeOrder
    @State private var projectPageIndex: Int = 0
    @State private var cachedFilteredBookmarks: [BookmarkedSection] = []
    @State private var cachedAvailableTags: [String] = []
    @State private var cachedBookmarkGroups: [BookmarkChapterGroup] = []

    private static let filterCodeSectionIDsDefaultsKey = "BookmarksView.filterCodeSectionIDs"
    private static let filterFolderIDsDefaultsKey = "BookmarksView.filterFolderIDs"
    private let tabBarClearance: CGFloat = 104
    private let contentHorizontalInset: CGFloat = 16
    private let projectTilePageSize = 4
    private let projectTileOuterHeight: CGFloat = 122
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

    private var sortButton: some View {
        Menu {
            ForEach(BookmarkSortMode.allCases) { mode in
                Button {
                    savedSortMode = mode
                } label: {
                    Label(mode.label, systemImage: mode.systemImage)
                }
            }
        } label: {
            Image(systemName: "arrow.up.arrow.down")
                .font(.headline.weight(.semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: 36, height: 36)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Sort saved sections")
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
                        if !library.folders.isEmpty {
                            projectTilesSection
                                .padding(.top, 12)
                                .padding(.bottom, 6)
                        }

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
                HStack(spacing: 6) {
                    sortButton
                    exportButton
                }
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
            .onChange(of: savedSortMode) { _, _ in
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

    private var projectPages: [[CodeFolder]] {
        stride(from: 0, to: library.folders.count, by: projectTilePageSize).map { start in
            Array(library.folders[start..<min(start + projectTilePageSize, library.folders.count)])
        }
    }

    private func projectGridHeight(for page: [CodeFolder]) -> CGFloat {
        let rowCount = page.count <= 2 ? 1 : 2
        let rowGap: CGFloat = rowCount == 2 ? 8 : 0
        return (projectTileOuterHeight * CGFloat(rowCount)) + rowGap
    }

    private var projectTabViewHeight: CGFloat {
        projectPages.map { projectGridHeight(for: $0) }.max() ?? projectTileOuterHeight
    }

    private var projectTilesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center) {
                Text("Projects")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(accentColor)
                    .textCase(.uppercase)
                Spacer(minLength: 0)
                Button {
                    folderEditorTarget = .new
                } label: {
                    Image(systemName: "plus")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(accentColor)
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("New project")
            }

            GeometryReader { proxy in
                let pageWidth = proxy.size.width
                TabView(selection: $projectPageIndex) {
                    ForEach(Array(projectPages.enumerated()), id: \.offset) { index, page in
                        projectPageGrid(page, pageWidth: pageWidth)
                            .frame(width: pageWidth, height: projectGridHeight(for: page), alignment: .topLeading)
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .frame(width: pageWidth, height: projectTabViewHeight)
                .clipped()
            }
            .frame(height: projectTabViewHeight)

            if projectPages.count > 1 {
                projectPageDots
            }
        }
    }

    private var projectPageDots: some View {
        HStack(spacing: 6) {
            ForEach(projectPages.indices, id: \.self) { index in
                Circle()
                    .fill(index == projectPageIndex ? Color.appChrome : Color.secondary.opacity(0.35))
                    .frame(width: 6, height: 6)
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.top, 4)
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private func projectPageGrid(_ page: [CodeFolder], pageWidth: CGFloat) -> some View {
        let pageSlots = Array(page.prefix(projectTilePageSize))

        VStack(spacing: 8) {
            projectTileRow(
                leftFolder: pageSlots.indices.contains(0) ? pageSlots[0] : nil,
                rightFolder: pageSlots.indices.contains(1) ? pageSlots[1] : nil,
                pageWidth: pageWidth
            )

            if pageSlots.count > 2 {
                projectTileRow(
                    leftFolder: pageSlots.indices.contains(2) ? pageSlots[2] : nil,
                    rightFolder: pageSlots.indices.contains(3) ? pageSlots[3] : nil,
                    pageWidth: pageWidth
                )
            }
        }
    }

    private func projectTileRow(
        leftFolder: CodeFolder?,
        rightFolder: CodeFolder?,
        pageWidth: CGFloat
    ) -> some View {
        let gap: CGFloat = 8
        let tileWidth = max(0, (pageWidth - gap) / 2)

        return HStack(alignment: .top, spacing: 8) {
            projectTileSlot(leftFolder, tileWidth: tileWidth)
            projectTileSlot(rightFolder, tileWidth: tileWidth)
        }
        .frame(width: pageWidth, alignment: .leading)
    }

    @ViewBuilder
    private func projectTileSlot(_ folder: CodeFolder?, tileWidth: CGFloat) -> some View {
        if let folder {
            NavigationLink {
                ProjectView(folderID: folder.id)
            } label: {
                projectTile(folder)
                    .frame(width: tileWidth)
            }
            .buttonStyle(.plain)
            .contextMenu {
                Button {
                    folderEditorTarget = .edit(folder)
                } label: {
                    Label("Edit project", systemImage: "pencil")
                }
            }
        } else {
            Color.clear
                .frame(width: tileWidth)
                .frame(height: projectTileOuterHeight)
                .accessibilityHidden(true)
        }
    }

    private func projectTile(_ folder: CodeFolder) -> some View {
        let color = Color(uiColor: PlatformColor(hex: folder.colorHex) ?? .systemBlue)
        let count = library.bookmarkCount(inFolder: folder.id)
        let description = folder.description.trimmingCharacters(in: .whitespacesAndNewlines)

        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 8) {
                Circle()
                    .fill(color)
                    .frame(width: 10, height: 10)
                    .padding(.top, 3)
                Spacer(minLength: 0)
                Image(systemName: "folder")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(color)
            }

            Text(folder.name)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text(description.isEmpty ? " " : description)
                .font(.caption2)
                .foregroundStyle(description.isEmpty ? .clear : .secondary)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, minHeight: 30, alignment: .topLeading)

            Text("\(count) saved")
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.tertiary)
                .lineLimit(1)
        }
        .padding(10)
        .frame(height: projectTileOuterHeight, alignment: .topLeading)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
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
        let sortedBookmarks = BookmarkSorter.sorted(
            bookmarks,
            mode: savedSortMode,
            codeSectionName: { library.codeSectionName(id: $0) }
        )
        let order = Dictionary(uniqueKeysWithValues: sortedBookmarks.enumerated().map { ($0.element.id, $0.offset) })
        let grouped = Dictionary(grouping: sortedBookmarks) { bookmark in
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
                    (order[$0.id] ?? 0) < (order[$1.id] ?? 0)
                }
            )
        }
        .sorted {
            let lhsOrder = $0.items.map { order[$0.id] ?? 0 }.min() ?? 0
            let rhsOrder = $1.items.map { order[$0.id] ?? 0 }.min() ?? 0
            return lhsOrder < rhsOrder
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
struct BookmarkExportModifier<Progress: View>: ViewModifier {
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

struct ProjectView: View {
    let folderID: Int64

    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var sortMode: BookmarkSortMode = .codeOrder
    @State private var isExportActionSheetPresented = false
    @State private var isSelecting = false
    @State private var selectedSectionIDs: Set<Int64> = []
    @State private var folderEditorTarget: ProjectFolderEditorTarget?

    private let contentHorizontalInset: CGFloat = 16

    private var folder: CodeFolder? {
        library.folder(id: folderID)
    }

    private var projectBookmarks: [BookmarkedSection] {
        BookmarkSorter.sorted(
            library.bookmarks(inFolder: folderID),
            mode: sortMode,
            codeSectionName: { library.codeSectionName(id: $0) }
        )
    }

    private var accentColor: Color {
        Color(uiColor: PlatformColor(hex: folder?.colorHex ?? CodeFolder.defaultColorHex) ?? library.accentColor())
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                projectHeader

                if projectBookmarks.isEmpty {
                    CodeEmptyStateCard(
                        title: "No Saved Sections",
                        systemImage: "folder",
                        description: "Add saved sections to this project from any section reader.",
                        accent: accentColor
                    )
                    .padding(.top, 24)
                } else {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(projectBookmarks) { bookmark in
                            projectBookmarkRow(bookmark)
                            CodeHairline()
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .padding(.horizontal, contentHorizontalInset)
            .padding(.top, 18)
            .padding(.bottom, 40)
        }
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .navigationTitle(folder?.name ?? "Project")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                sortMenu
                exportButton
                selectionButton
            }
        }
        .confirmationDialog(
            "Project actions",
            isPresented: $isExportActionSheetPresented,
            titleVisibility: .visible
        ) {
            if isSelecting && !selectedSectionIDs.isEmpty {
                Button("Export selected (\(selectedSectionIDs.count))") {
                    library.startBookmarkExport(bookmarks: selectedBookmarks, contextLabel: folder?.name)
                }
                Button("Remove selected from project", role: .destructive) {
                    library.removeSections(selectedSectionIDs, fromFolder: folderID)
                    selectedSectionIDs.removeAll()
                    isSelecting = false
                }
            }
            Button("Export project (\(projectBookmarks.count))") {
                library.startBookmarkExport(bookmarks: projectBookmarks, contextLabel: folder?.name)
            }
            Button("Cancel", role: .cancel) { }
        }
        .sheet(item: $folderEditorTarget) { target in
            FolderEditorSheet(
                existing: target.folder,
                onSave: { name, description, colorHex in
                    if let existing = target.folder {
                        library.updateFolder(existing, name: name, description: description, colorHex: colorHex)
                    }
                },
                onDelete: {
                    if let existing = target.folder {
                        library.deleteFolder(id: existing.id)
                        dismiss()
                    }
                }
            )
        }
        .modifier(BookmarkExportModifier(library: library, progressSheet: { exportProgressSheet }))
        .onAppear {
            library.refreshBookmarks()
        }
        .onChange(of: projectBookmarks) { _, _ in
            selectedSectionIDs = selectedSectionIDs.intersection(Set(projectBookmarks.map(\.id)))
            if selectedSectionIDs.isEmpty {
                isSelecting = false
            }
        }
    }

    private var selectedBookmarks: [BookmarkedSection] {
        projectBookmarks.filter { selectedSectionIDs.contains($0.id) }
    }

    private var projectHeader: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 10) {
                Circle()
                    .fill(accentColor)
                    .frame(width: 12, height: 12)
                Text(folder?.name ?? "Project")
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                Spacer(minLength: 0)
                Button {
                    if let folder {
                        folderEditorTarget = .edit(folder)
                    }
                } label: {
                    Image(systemName: "pencil")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(Color.appChrome)
                        .frame(width: 36, height: 36)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Edit project")
            }

            if let description = folder?.description.trimmingCharacters(in: .whitespacesAndNewlines),
               !description.isEmpty {
                Text(description)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack(spacing: 8) {
                CodeMetaBadge(text: "\(projectBookmarks.count) saved", accent: accentColor)
                CodeMetaBadge(text: sortMode.label, accent: accentColor)
            }
        }
    }

    private var sortMenu: some View {
        Menu {
            ForEach(BookmarkSortMode.allCases) { mode in
                Button {
                    sortMode = mode
                } label: {
                    Label(mode.label, systemImage: mode.systemImage)
                }
            }
        } label: {
            Image(systemName: "arrow.up.arrow.down")
                .font(.headline.weight(.semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: 36, height: 36)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Sort project")
    }

    private var exportButton: some View {
        Button {
            isExportActionSheetPresented = true
        } label: {
            Image(systemName: "square.and.arrow.up")
                .font(.headline.weight(.semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: 36, height: 36)
        }
        .buttonStyle(.plain)
        .disabled(projectBookmarks.isEmpty)
        .accessibilityLabel("Export project")
    }

    private var selectionButton: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.18)) {
                isSelecting.toggle()
                if !isSelecting {
                    selectedSectionIDs.removeAll()
                }
            }
        } label: {
            Image(systemName: isSelecting ? "checkmark.circle.fill" : "checklist")
                .font(.headline.weight(.semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: 36, height: 36)
        }
        .buttonStyle(.plain)
        .disabled(projectBookmarks.isEmpty)
        .accessibilityLabel(isSelecting ? "Finish selecting" : "Select sections")
    }

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
                        .background(Capsule().fill(Color.secondary.opacity(0.15)))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 24)
            }
            .padding(.vertical, 32)
            .presentationDetents([.height(220)])
            .interactiveDismissDisabled()
        }
    }

    private func projectBookmarkRow(_ bookmark: BookmarkedSection) -> some View {
        let bookmarkAccent = Color(uiColor: library.accentColor(for: bookmark.codeSectionID))
        let isSelected = selectedSectionIDs.contains(bookmark.id)

        return HStack(alignment: .top, spacing: 12) {
            if isSelecting {
                Button {
                    toggleSelection(bookmark.id)
                } label: {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(isSelected ? accentColor : Color.secondary.opacity(0.6))
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isSelected ? "Deselect section" : "Select section")
            }

            NavigationLink {
                ReaderView(sectionID: bookmark.id)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(bookmark.sectionNumber)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(bookmarkAccent)

                        if bookmark.hasNote {
                            Image(systemName: "note.text")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }

                        if bookmark.isBookmarked {
                            Image(systemName: "bookmark.fill")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(bookmarkAccent)
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
                        FlowLayout(spacing: 6) {
                            ForEach(bookmark.tags, id: \.self) { tag in
                                Text(tag)
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(bookmarkAccent)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 3)
                                    .background(Capsule(style: .continuous).fill(bookmarkAccent.opacity(0.12)))
                            }
                        }
                        .padding(.top, 6)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .disabled(isSelecting)
        }
        .padding(.vertical, 12)
        .contentShape(Rectangle())
        .onTapGesture {
            if isSelecting {
                toggleSelection(bookmark.id)
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                library.removeSection(bookmark.id, fromFolder: folderID)
            } label: {
                Label("Remove", systemImage: "minus.circle")
            }
        }
    }

    private func toggleSelection(_ sectionID: Int64) {
        if selectedSectionIDs.contains(sectionID) {
            selectedSectionIDs.remove(sectionID)
        } else {
            selectedSectionIDs.insert(sectionID)
        }
    }
}

private enum ProjectFolderEditorTarget: Identifiable {
    case edit(CodeFolder)

    var id: String {
        switch self {
        case .edit(let folder): return "edit-\(folder.id)"
        }
    }

    var folder: CodeFolder? {
        if case .edit(let folder) = self { return folder }
        return nil
    }
}

#if DEBUG
#Preview("Bookmarks") {
    BookmarksView()
        .environmentObject(CodeLibraryViewModel())
}
#endif
