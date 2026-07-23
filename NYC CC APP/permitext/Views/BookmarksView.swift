import SwiftUI
import UIKit

struct BookmarksView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var savedFilterCodeSectionIDs: Set<Int64>
    @State private var savedFilterFolderIDs: Set<Int64>
    @State private var selectedTagFilter: String? = nil
    @State private var folderEditorTarget: FolderEditorTarget?
    @State private var savedSortMode: BookmarkSortMode = .codeOrder
    @State private var projectPageIndex: Int = 0
    @State private var scrollOffset: CGFloat = 0
    @State private var cachedFilteredBookmarks: [BookmarkedSection] = []
    @State private var cachedAvailableTags: [String] = []
    @State private var cachedBookmarkCodeGroups: [BookmarkCodeGroup] = []
    @State private var cachedBookmarksByFolderID: [Int64: [BookmarkedSection]] = [:]
    @State private var pendingExport: BookmarkExportRequest?

    private static let filterCodeSectionIDsDefaultsKey = "BookmarksView.filterCodeSectionIDs"
    private static let filterFolderIDsDefaultsKey = "BookmarksView.filterFolderIDs"
    private let tabBarClearance: CGFloat = CodeScreenMetrics.tabBarClearance
    private let contentHorizontalInset: CGFloat = CodeScreenMetrics.screenHorizontalPadding
    private let projectTilePageSize = CodeScreenMetrics.tileGridPageSize

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

    private var collapseProgress: CGFloat {
        min(max(-scrollOffset / 64, 0), 1)
    }

    private var exportButton: some View {
        Menu {
            exportMenuContent
        } label: {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: CodeScreenMetrics.screenHeaderActionPointSize, weight: .semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: CodeScreenMetrics.screenHeaderActionSlotSize, height: CodeScreenMetrics.screenHeaderActionSlotSize)
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
                .font(.system(size: CodeScreenMetrics.screenHeaderActionPointSize, weight: .semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: CodeScreenMetrics.screenHeaderActionSlotSize, height: CodeScreenMetrics.screenHeaderActionSlotSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Sort saved sections")
    }

    private func bookmarkAccentColor(for codeSectionID: Int64?) -> Color {
        Color(uiColor: library.accentColor(for: codeSectionID))
    }

    private var showsSavedInlineFilters: Bool {
        !availableFilterSections.isEmpty || !cachedAvailableTags.isEmpty
    }

    private var hasSavedHeaderContentBelowTitle: Bool {
        showsProjectsSection || showsSavedInlineFilters
    }

    private var showsProjectsSection: Bool {
        library.hasProjectAccess
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
                    savedScreenHeader

                    if !library.bookmarks.isEmpty {
                        savedBookmarkList
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(.horizontal, contentHorizontalInset)
                .padding(.top, CodeScreenMetrics.scrollMeasuredTitleTopPadding)
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
                    onSave: { name, address, description, colorHex in
                        if let existing = target.folder {
                            library.updateFolder(existing, name: name, address: address, description: description, colorHex: colorHex)
                        } else {
                            _ = library.createFolder(name: name, address: address, description: description, colorHex: colorHex)
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
            .sheet(item: $pendingExport) { request in
                BookmarkExportPreviewSheet(request: request) {
                    pendingExport = nil
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                        library.startBookmarkExport(bookmarks: request.bookmarks, contextLabel: request.contextLabel)
                    }
                }
            }
            .modifier(BookmarkExportModifier(library: library, progressSheet: { exportProgressSheet }))
        }
        .coordinateSpace(name: "savedScroll")
        .onPreferenceChange(CodeScrollOffsetPreferenceKey.self) { scrollOffset = $0 }
    }

private var savedScreenHeader: some View {
    VStack(alignment: .leading, spacing: CodeScreenMetrics.contentSpacingBelowTitle) {
        CodeScreenTitleRow(title: "Saved", collapseProgress: collapseProgress) {
            HStack(spacing: 6) {
                sortButton
                exportButton
            }
        }

        VStack(alignment: .leading, spacing: 0) {
            if showsProjectsSection {
                projectTilesSection
            }

            if !library.bookmarks.isEmpty && showsSavedInlineFilters {
                savedInlineFilters
                    .padding(.top, CodeScreenMetrics.sectionSpacingBelowEyebrow)
                    .padding(.bottom, CodeScreenMetrics.sectionSpacingBelowEyebrow)
            }
        }
    }
}

private var savedBookmarkList: some View {
    VStack(alignment: .leading, spacing: 0) {
        ForEach(Array(cachedBookmarkCodeGroups.enumerated()), id: \.element.id) { index, codeGroup in
            codeSectionHeader(
                codeGroup,
                isFirst: index == 0,
                followsSavedHeader: hasSavedHeaderContentBelowTitle,
                hasFiltersAbove: showsSavedInlineFilters
            )

            ForEach(codeGroup.chapterGroups) { group in
                chapterHeader(group)

                ForEach(group.items, id: \.rowID) { bookmark in
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

    // MARK: - Export

    /// Modal shown while the builder runs. Progress bar + cancel.
    @ViewBuilder
    private var exportProgressSheet: some View {
        if case let .building(progress, sectionTitle) = library.exportState {
            VStack(spacing: 20) {
                ExportProgressLine(progress: progress)
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
    private var exportMenuContent: some View {
        let filteredCount = cachedFilteredBookmarks.count
        let totalCount = library.bookmarks.count
        let isFiltered = filteredCount > 0 && filteredCount < totalCount

        if isFiltered {
            Button("Export current filter (\(filteredCount))") {
                pendingExport = BookmarkExportRequest(
                    bookmarks: cachedFilteredBookmarks,
                    contextLabel: currentFilterContextLabel,
                    scopeLabel: "Current filter"
                )
            }
        }

        Button("Export all saved (\(totalCount))") {
            pendingExport = BookmarkExportRequest(
                bookmarks: library.bookmarks,
                contextLabel: nil,
                scopeLabel: "All saved sections"
            )
        }

        // Per-folder shortcuts only show when the folder has content;
        // empty folders aren't useful as export targets.
        ForEach(library.folders.filter { folderHasBookmarks($0) }) { folder in
            Button("Export “\(folder.name)”") {
                pendingExport = BookmarkExportRequest(
                    bookmarks: bookmarks(inFolder: folder),
                    contextLabel: folder.name,
                    scopeLabel: folder.name
                )
            }
        }
    }

    private func folderHasBookmarks(_ folder: CodeFolder) -> Bool {
        !(cachedBookmarksByFolderID[folder.id]?.isEmpty ?? true)
    }

    private func bookmarks(inFolder folder: CodeFolder) -> [BookmarkedSection] {
        cachedBookmarksByFolderID[folder.id] ?? []
    }

    /// Short label for the "Current filter" export so its PDF header shows
    /// something meaningful instead of a blank context. Combines whichever
    /// filter dimensions are active.
    private var currentFilterContextLabel: String? {
        var parts: [String] = []
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

    private var projectPages: [[CodeFolder]] {
        stride(from: 0, to: library.folders.count, by: projectTilePageSize).map { start in
            Array(library.folders[start..<min(start + projectTilePageSize, library.folders.count)])
        }
    }

    /// Always reserves a full 2×2 page so swiping never shrinks the projects block.
    private var projectGridViewportHeight: CGFloat {
        CodeScreenMetrics.savedProjectFullPageGridHeight
    }

    private var projectTilesSection: some View {
        VStack(alignment: .leading, spacing: CodeScreenMetrics.sectionSpacingBelowEyebrow) {
            CodeScreenSectionEyebrow(text: "Projects", accent: accentColor)
                .overlay(alignment: .trailing) {
                    Button {
                        if library.hasProjectAccess {
                            folderEditorTarget = .new
                        } else {
                            library.requireProjectAccess()
                        }
                    } label: {
                        Image(systemName: "plus")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(accentColor)
                            .frame(width: 28, height: 28)
                    }
                .buttonStyle(.plain)
                .accessibilityLabel("New project")
                }

            if !projectPages.isEmpty {
                GeometryReader { proxy in
                    let pageWidth = proxy.size.width
                    TabView(selection: $projectPageIndex) {
                        ForEach(Array(projectPages.enumerated()), id: \.offset) { index, page in
                            projectPageGrid(page, pageWidth: pageWidth)
                                .frame(
                                    width: pageWidth,
                                    height: projectGridViewportHeight,
                                    alignment: .topLeading
                                )
                                .tag(index)
                        }
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    .frame(width: pageWidth, height: projectGridViewportHeight, alignment: .top)
                    .clipped()
                }
                .frame(height: projectGridViewportHeight)

                if projectPages.count > 1 {
                    projectPageDots
                }
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
        let rowCount = CodeScreenMetrics.tileGridRowCount(forItemCount: CodeScreenMetrics.tileGridPageSize)

        VStack(spacing: CodeScreenMetrics.tileGridRowSpacing) {
            ForEach(0..<rowCount, id: \.self) { rowIndex in
                let leftIndex = rowIndex * 2
                let rightIndex = leftIndex + 1
                projectTileRow(
                    leftFolder: pageSlots.indices.contains(leftIndex) ? pageSlots[leftIndex] : nil,
                    rightFolder: pageSlots.indices.contains(rightIndex) ? pageSlots[rightIndex] : nil,
                    pageWidth: pageWidth
                )
            }
        }
        .frame(height: projectGridViewportHeight, alignment: .top)
    }

    private func projectTileRow(
        leftFolder: CodeFolder?,
        rightFolder: CodeFolder?,
        pageWidth: CGFloat
    ) -> some View {
        let gap: CGFloat = CodeScreenMetrics.tileGridRowSpacing
        let tileWidth = max(0, (pageWidth - gap) / 2)

        return HStack(alignment: .top, spacing: CodeScreenMetrics.tileGridRowSpacing) {
            projectTileSlot(leftFolder, tileWidth: tileWidth)
            projectTileSlot(rightFolder, tileWidth: tileWidth)
        }
        .frame(width: pageWidth, alignment: .leading)
    }

    @ViewBuilder
    private func projectTileSlot(_ folder: CodeFolder?, tileWidth: CGFloat) -> some View {
        if let folder {
            if library.hasProjectAccess {
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
                Button {
                    library.requireProjectAccess()
                } label: {
                    projectTile(folder)
                        .frame(width: tileWidth)
                }
                .buttonStyle(.plain)
            }
        } else {
            Color.clear
                .frame(width: tileWidth)
                .frame(height: CodeScreenMetrics.savedProjectTileHeight)
                .accessibilityHidden(true)
        }
    }

    private func projectTile(_ folder: CodeFolder) -> some View {
        let color = projectTileBackgroundColor(for: folder.colorHex)
        let foreground = Color.primary
        let count = library.bookmarkCount(inFolder: folder.id)

        return VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .center, spacing: 7) {
                Circle()
                    .fill(foreground)
                    .frame(width: 8, height: 8)

                Text(folder.name)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(foreground)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "folder")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(foreground)
            }

            Text("\(count) saved")
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(foreground.opacity(0.74))
                .lineLimit(1)
        }
        .padding(CodeScreenMetrics.compactCardPadding)
        .frame(height: CodeScreenMetrics.savedProjectTileHeight, alignment: .center)
        .background(color)
        .clipShape(RoundedRectangle(cornerRadius: CodeScreenMetrics.tileCornerRadius, style: .continuous))
    }

    /// Matches the web tile's `color-mix(in srgb, project 42%, surface)`.
    private func projectTileBackgroundColor(for hex: String) -> Color {
        let project = PlatformColor(hex: hex) ?? .systemBlue
        return Color(uiColor: UIColor { traits in
            var red: CGFloat = 0
            var green: CGFloat = 0
            var blue: CGFloat = 0
            var alpha: CGFloat = 0
            project.resolvedColor(with: traits).getRed(&red, green: &green, blue: &blue, alpha: &alpha)
            let surface: CGFloat = traits.userInterfaceStyle == .dark ? 0 : 1
            return UIColor(
                red: red * 0.42 + surface * 0.58,
                green: green * 0.42 + surface * 0.58,
                blue: blue * 0.42 + surface * 0.58,
                alpha: 1
            )
        })
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

    @ViewBuilder
    private var savedInlineFilters: some View {
        VStack(spacing: CodeScreenMetrics.sectionSpacingBelowEyebrow) {
            if !availableFilterSections.isEmpty {
                savedFilterControl
            }
            if !cachedAvailableTags.isEmpty {
                tagFilterControl
            }
        }
    }

    private var tagFilterControl: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: CodeFilterChipMetrics.spacing) {
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
                    .font(CodeFilterChipMetrics.font)
            }
            .foregroundStyle(isSelected ? Color.appChromeOnFill : .secondary)
            .frame(width: minWidth, alignment: .leading)
            .padding(.horizontal, CodeFilterChipMetrics.compactHorizontalPadding)
            .padding(.vertical, CodeFilterChipMetrics.verticalPadding)
            .frame(minHeight: CodeFilterChipMetrics.minHeight)
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
        cachedBookmarkCodeGroups = makeBookmarkCodeGroups(from: filtered)
        cachedBookmarksByFolderID = makeBookmarksByFolderID()
    }

    private func makeBookmarksByFolderID() -> [Int64: [BookmarkedSection]] {
        var grouped: [Int64: [BookmarkedSection]] = [:]
        for bookmark in library.bookmarks {
            for folderID in library.folderMembership[bookmark.id] ?? [] {
                grouped[folderID, default: []].append(bookmark)
            }
        }
        return grouped
    }

    private func makeBookmarkCodeGroups(from bookmarks: [BookmarkedSection]) -> [BookmarkCodeGroup] {
        let sortedBookmarks = BookmarkSorter.sorted(
            bookmarks,
            mode: savedSortMode,
            codeSectionName: { library.codeSectionName(id: $0) }
        )
        let order = Dictionary(uniqueKeysWithValues: sortedBookmarks.enumerated().map { ($0.element.rowID, $0.offset) })
        let groupedByCodeSection = Dictionary(grouping: sortedBookmarks) { bookmark in
            BookmarkCodeGroupKey(codeSectionID: bookmark.codeSectionID)
        }

        return groupedByCodeSection.map { codeKey, codeItems in
            let groupedByChapter = Dictionary(grouping: codeItems) { bookmark in
                BookmarkChapterGroupKey(chapterNumber: bookmark.chapterNumber)
            }
            let chapterGroups = groupedByChapter.map { chapterKey, chapterItems in
                BookmarkChapterGroup(
                    chapterNumber: chapterKey.chapterNumber,
                    chapterTitle: chapterItems.first?.chapterTitle ?? "",
                    items: chapterItems.sorted {
                        (order[$0.rowID] ?? 0) < (order[$1.rowID] ?? 0)
                    }
                )
            }
            .sorted {
                let lhsOrder = $0.items.first.map { order[$0.rowID] ?? 0 } ?? 0
                let rhsOrder = $1.items.first.map { order[$0.rowID] ?? 0 } ?? 0
                return lhsOrder < rhsOrder
            }

            return BookmarkCodeGroup(
                codeSectionID: codeKey.codeSectionID,
                codeSectionName: library.codeSectionName(id: codeKey.codeSectionID),
                chapterGroups: chapterGroups
            )
        }
        .sorted {
            let lhsOrder = $0.chapterGroups.first?.items.first.map { order[$0.rowID] ?? 0 } ?? 0
            let rhsOrder = $1.chapterGroups.first?.items.first.map { order[$0.rowID] ?? 0 } ?? 0
            return lhsOrder < rhsOrder
        }
    }

    private func codeSectionHeader(
        _ group: BookmarkCodeGroup,
        isFirst: Bool,
        followsSavedHeader: Bool,
        hasFiltersAbove: Bool
    ) -> some View {
        let groupAccent = bookmarkAccentColor(for: group.codeSectionID)
        let topPadding: CGFloat = {
            guard isFirst else { return 18 }
            if !followsSavedHeader { return CodeScreenMetrics.contentSpacingBelowTitle }
            if hasFiltersAbove { return CodeScreenMetrics.sectionSpacingBelowEyebrow }
            return CodeScreenMetrics.sectionSpacingBelowEyebrow
        }()

        return Text(group.codeSectionName)
            .font(.caption.weight(.semibold))
            .foregroundStyle(groupAccent)
            .textCase(.uppercase)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, topPadding)
            .padding(.bottom, 10)
    }

    private func chapterHeader(_ group: BookmarkChapterGroup) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text("Chapter \(group.chapterNumber)")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .fixedSize(horizontal: true, vertical: false)

            Text(group.chapterTitle)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary.opacity(0.9))
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, CodeScreenMetrics.savedChapterHeaderTopPadding)
        .padding(.bottom, CodeScreenMetrics.savedChapterHeaderBottomPadding)
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
                    if bookmark.isBlockAnnotation {
                        CodeMetaBadge(text: "Paragraph", accent: bookmarkAccent)
                    } else if bookmark.kind == .textBlock {
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
        .padding(.vertical, CodeScreenMetrics.rowVerticalPadding)
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

private struct BookmarkCodeGroupKey: Hashable {
    let codeSectionID: Int64?
}

private struct BookmarkChapterGroupKey: Hashable {
    let chapterNumber: String
}

private struct BookmarkCodeGroup: Identifiable {
    let codeSectionID: Int64?
    let codeSectionName: String
    let chapterGroups: [BookmarkChapterGroup]

    var id: String { codeSectionID.map(String.init) ?? codeSectionName }
}

private struct BookmarkChapterGroup: Identifiable {
    let chapterNumber: String
    let chapterTitle: String
    let items: [BookmarkedSection]

    var id: String { chapterNumber }
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

private struct BookmarkExportRequest: Identifiable {
    let id = UUID()
    let bookmarks: [BookmarkedSection]
    let contextLabel: String?
    let scopeLabel: String
}

private struct BookmarkExportPreviewSheet: View {
    let request: BookmarkExportRequest
    let onConfirm: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(request.scopeLabel)
                            .font(.title2.weight(.bold))
                        Text("\(request.bookmarks.count) \(request.bookmarks.count == 1 ? "section" : "sections") will be included in the PDF.")
                            .foregroundStyle(.secondary)
                    }

                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(request.bookmarks.prefix(12).enumerated()), id: \.element.rowID) { index, bookmark in
                            VStack(alignment: .leading, spacing: 3) {
                                Text(bookmark.sectionNumber)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                Text(bookmark.title)
                                    .font(.body.weight(.semibold))
                                    .lineLimit(2)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 10)
                            if index < min(request.bookmarks.count, 12) - 1 {
                                Divider()
                            }
                        }
                    }

                    if request.bookmarks.count > 12 {
                        Text("And \(request.bookmarks.count - 12) more sections")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

                    Text("The export uses the canonical code text and clearly separates your private notes. Review the finished PDF before relying on or sharing it.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding(20)
            }
            .navigationTitle("Export Preview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Build PDF", action: onConfirm)
                        .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

struct ProjectView: View {
    let folderID: Int64

    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var sortMode: BookmarkSortMode = .codeOrder
    @State private var isSelecting = false
    @State private var selectedBookmarkRowIDs: Set<String> = []
    @State private var folderEditorTarget: ProjectFolderEditorTarget?
    @State private var pendingExport: BookmarkExportRequest?

    private let contentHorizontalInset: CGFloat = CodeScreenMetrics.screenHorizontalPadding

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
            VStack(alignment: .leading, spacing: CodeScreenMetrics.contentSpacingBelowTitle) {
                projectHeader

                CodeHairline()
                    .padding(.top, CodeScreenMetrics.sectionSpacingBelowEyebrow)

                if !projectBookmarks.isEmpty {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(projectBookmarks, id: \.rowID) { bookmark in
                            projectBookmarkRow(bookmark)
                            CodeHairline()
                        }
                    }
                    .padding(.top, CodeScreenMetrics.sectionSpacingBelowEyebrow)
                }
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .padding(.horizontal, contentHorizontalInset)
            .padding(.top, CodeScreenMetrics.topTitlePadding)
            .padding(.bottom, 40)
        }
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                sortMenu
                exportButton
                selectionButton
            }
        }
        .sheet(item: $folderEditorTarget) { target in
            FolderEditorSheet(
                existing: target.folder,
                onSave: { name, address, description, colorHex in
                    if let existing = target.folder {
                        library.updateFolder(existing, name: name, address: address, description: description, colorHex: colorHex)
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
        .sheet(item: $pendingExport) { request in
            BookmarkExportPreviewSheet(request: request) {
                pendingExport = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    library.startBookmarkExport(bookmarks: request.bookmarks, contextLabel: request.contextLabel)
                }
            }
        }
        .modifier(BookmarkExportModifier(library: library, progressSheet: { exportProgressSheet }))
        .onAppear {
            library.refreshBookmarks()
            library.noteProjectOpened(folderID)
        }
        .onChange(of: projectBookmarks) { _, _ in
            selectedBookmarkRowIDs = selectedBookmarkRowIDs.intersection(Set(projectBookmarks.map(\.rowID)))
            if selectedBookmarkRowIDs.isEmpty {
                isSelecting = false
            }
        }
        .onChange(of: folder?.id) { _, newFolderID in
            if let newFolderID {
                library.noteProjectOpened(newFolderID)
            } else {
                dismiss()
            }
        }
    }

    private var selectedBookmarks: [BookmarkedSection] {
        projectBookmarks.filter { selectedBookmarkRowIDs.contains($0.rowID) }
    }

    private var projectHeader: some View {
        VStack(alignment: .leading, spacing: CodeScreenMetrics.sectionSpacingBelowEyebrow) {
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
                        .font(.system(size: CodeScreenMetrics.toolbarIconPointSize, weight: .semibold))
                        .foregroundStyle(Color.appChrome)
                        .frame(width: CodeScreenMetrics.toolbarButtonSize, height: CodeScreenMetrics.toolbarButtonSize)
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

            projectActionRow
        }
    }

    private var projectActionRow: some View {
        HStack(spacing: 8) {
            projectHeaderActionButton(
                title: isSelecting ? "Done" : "Select",
                systemImage: isSelecting ? "checkmark.circle.fill" : "checklist",
                isDisabled: projectBookmarks.isEmpty,
                action: toggleSelectionMode
            )

        }
    }

    private func projectHeaderActionButton(
        title: String,
        systemImage: String,
        isDisabled: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: systemImage)
                    .font(.caption.weight(.semibold))
                Text(title)
                    .font(.caption.weight(.semibold))
            }
            .foregroundStyle(isDisabled ? Color.secondary.opacity(0.65) : accentColor)
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(
                Capsule(style: .continuous)
                    .fill(accentColor.opacity(isDisabled ? 0.08 : 0.12))
            )
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
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
                .font(.system(size: CodeScreenMetrics.toolbarIconPointSize, weight: .semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: CodeScreenMetrics.toolbarButtonSize, height: CodeScreenMetrics.toolbarButtonSize)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Sort project")
    }

    private var exportButton: some View {
        Menu {
            projectExportMenuContent
        } label: {
            Image(systemName: "square.and.arrow.up")
                .font(.system(size: CodeScreenMetrics.toolbarIconPointSize, weight: .semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: CodeScreenMetrics.toolbarButtonSize, height: CodeScreenMetrics.toolbarButtonSize)
        }
        .buttonStyle(.plain)
        .disabled(projectBookmarks.isEmpty)
        .accessibilityLabel("Export project")
    }

    private var selectionButton: some View {
        Button {
            toggleSelectionMode()
        } label: {
            Image(systemName: isSelecting ? "checkmark.circle.fill" : "checklist")
                .font(.system(size: CodeScreenMetrics.toolbarIconPointSize, weight: .semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: CodeScreenMetrics.toolbarButtonSize, height: CodeScreenMetrics.toolbarButtonSize)
        }
        .buttonStyle(.plain)
        .disabled(projectBookmarks.isEmpty)
        .accessibilityLabel(isSelecting ? "Finish selecting" : "Select sections")
    }

    @ViewBuilder
    private var exportProgressSheet: some View {
        if case let .building(progress, sectionTitle) = library.exportState {
            VStack(spacing: 20) {
                ExportProgressLine(progress: progress)
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

    @ViewBuilder
    private var projectExportMenuContent: some View {
        if isSelecting && !selectedBookmarkRowIDs.isEmpty {
            Button("Export selected (\(selectedBookmarkRowIDs.count))") {
                pendingExport = BookmarkExportRequest(
                    bookmarks: selectedBookmarks,
                    contextLabel: folder?.name,
                    scopeLabel: "Selected in \(folder?.name ?? "Project")"
                )
            }
            Button("Remove selected from project", role: .destructive) {
                library.removeSections(Set(selectedBookmarks.map(\.id)), fromFolder: folderID)
                selectedBookmarkRowIDs.removeAll()
                isSelecting = false
            }
        }

        Button("Export project (\(projectBookmarks.count))") {
            pendingExport = BookmarkExportRequest(
                bookmarks: projectBookmarks,
                contextLabel: folder?.name,
                scopeLabel: folder?.name ?? "Project"
            )
        }
    }

    private func toggleSelectionMode() {
        withAnimation(.easeInOut(duration: 0.18)) {
            isSelecting.toggle()
            if !isSelecting {
                selectedBookmarkRowIDs.removeAll()
            }
        }
    }

    private func projectBookmarkRow(_ bookmark: BookmarkedSection) -> some View {
        let bookmarkAccent = Color(uiColor: library.accentColor(for: bookmark.codeSectionID))
        let isSelected = selectedBookmarkRowIDs.contains(bookmark.rowID)

        return HStack(alignment: .top, spacing: 12) {
            if isSelecting {
                Button {
                    toggleSelection(bookmark.rowID)
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
                        if bookmark.isBlockAnnotation {
                            CodeMetaBadge(text: "Paragraph", accent: bookmarkAccent)
                        } else {
                            Text(bookmark.sectionNumber)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(bookmarkAccent)
                        }

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
        .padding(.vertical, CodeScreenMetrics.rowVerticalPadding)
        .contentShape(Rectangle())
        .onTapGesture {
            if isSelecting {
                toggleSelection(bookmark.rowID)
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

    private func toggleSelection(_ rowID: String) {
        if selectedBookmarkRowIDs.contains(rowID) {
            selectedBookmarkRowIDs.remove(rowID)
        } else {
            selectedBookmarkRowIDs.insert(rowID)
        }
    }
}

private struct ExportProgressLine: View {
    let progress: Double

    var body: some View {
        GeometryReader { proxy in
            Capsule()
                .fill(Color.appChrome)
                .frame(
                    width: max(0, proxy.size.width * min(max(progress, 0), 1)),
                    height: 5
                )
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(height: 5)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Export progress")
        .accessibilityValue("\(Int((min(max(progress, 0), 1) * 100).rounded())) percent")
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
        .environmentObject(CodeLibraryViewModel.preview())
        .preferredColorScheme(.light)
}

#Preview("Project") {
    ProjectView(folderID: 1)
        .environmentObject(CodeLibraryViewModel.preview())
        .preferredColorScheme(.light)
}
#endif
