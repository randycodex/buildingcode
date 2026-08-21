import os.signpost
import SwiftUI
import UIKit

struct ChapterReaderView: View {
    let chapter: CodeChapter
    let initialSectionID: Int64
    var rememberedSectionID: Binding<Int64?> = .constant(nil)
    var nativeDocumentRoute: NativeReaderDocumentRoute? = nil
    var initialSectionNumber: String? = nil
    var initialAnchorID: String? = nil
    var rememberedNativeBlockID: Binding<String?> = .constant(nil)
    var rememberedAnchorID: Binding<String?> = .constant(nil)
    var onNativeFallbackToHTML: ((String) -> Void)? = nil
    var onNativeOpenReference: ((CodeSectionSummary) -> Void)? = nil

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var blocks: [CodeLibraryViewModel.ChapterReaderBlockSummary] = []
    @State private var selectedJumpSectionID: Int64?
    @State private var pendingScrollSectionID: Int64?
    @State private var expandedInlineImage: UIImage?
    @State private var duplicateHeadingSectionIDs: Set<Int64> = []
    @State private var hasActiveTextSelection = false
    @State private var isJumpPickerPresented = false
    @State private var pendingFocusedSectionID: Int64?
    @State private var scrollPositionSectionID: Int64?
    @State private var focusedSectionUpdateTask: Task<Void, Never>?
    @State private var backgroundPrefetchTask: Task<Void, Never>?
    @State private var scrollProgress: CGFloat = 0
    @State private var lastBlockOffsets: [Int64: CGFloat] = [:]
    @State private var loadedBlocksChapterID: Int64?
    @State private var isChapterSearchPresented = false
    @State private var chapterSearchQuery = ""
    @Environment(\.isBrowserTabActive) private var isBrowserTabActive
    @StateObject private var expandedMediaTracker = ExpandedMediaTracker()
    private let chapterReaderCoordinateSpace: String = "chapterReaderScroll"
    private let chapterReaderScrollTopThreshold: CGFloat = 140
    private let focusedSectionUpdateDelay: Duration = .milliseconds(70)
    private let prewarmedSectionCount = 4
    private let backgroundPrefetchSectionLimit = 12
    private var accentColor: Color {
        Color(uiColor: library.accentColor(for: chapter.codeSectionID))
    }

    private var chapterSearchToolbarButton: some View {
        Button {
            isChapterSearchPresented = true
        } label: {
            Image(systemName: "text.page.badge.magnifyingglass")
                .font(.system(size: CodeScreenMetrics.toolbarIconPointSize, weight: .semibold))
                .frame(width: CodeScreenMetrics.toolbarButtonSize, height: CodeScreenMetrics.toolbarButtonSize)
                .background(Color(uiColor: .systemBackground))
                .clipShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Search this chapter")
    }

    private var currentJumpLabel: String {
        let activeSectionID = pendingFocusedSectionID ?? selectedJumpSectionID
        if let activeSectionID,
           let block = blocks.first(where: { $0.id == activeSectionID }) {
            return jumpLabel(for: block)
        }
        if let first = blocks.first {
            return jumpLabel(for: first)
        }
        return ""
    }

    private var chapterSearchEntries: [ChapterSearchSourceEntry] {
        visibleJumpBlocks.map { block in
            ChapterSearchSourceEntry(
                sectionID: block.id,
                sectionNumber: block.sectionNumber,
                title: block.displayTitle,
                anchorID: nil
            )
        }
    }

    var body: some View {
        Group {
            if let nativeDocumentRoute {
                NativeChapterTextReaderView(
                    chapter: chapter,
                    initialSectionID: initialSectionID,
                    initialSectionNumber: initialSectionNumber ?? "",
                    initialAnchorID: initialAnchorID,
                    route: nativeDocumentRoute,
                    rememberedSectionID: rememberedSectionID,
                    rememberedBlockID: rememberedNativeBlockID,
                    rememberedAnchorID: rememberedAnchorID,
                    onFallbackToHTML: onNativeFallbackToHTML,
                    onOpenReference: onNativeOpenReference
                )
            } else {
                ScrollViewReader { proxy in
                    chapterReaderContent(proxy: proxy)
                }
            }
        }
    }

    @ViewBuilder
    private func chapterReaderContent(proxy: ScrollViewProxy) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                ForEach(blocks) { block in
                    blockSection(for: block)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 28)
            .padding(.bottom, 8)
            .scrollTargetLayout()
        }
        .scrollPosition(id: $scrollPositionSectionID, anchor: .top)
        .contentShape(Rectangle())
        .coordinateSpace(name: chapterReaderCoordinateSpace)
        .environmentObject(expandedMediaTracker)
        .onPreferenceChange(ChapterReaderBlockOffsetPreferenceKey.self) { offsets in
            DispatchQueue.main.async {
                lastBlockOffsets = offsets
                updateScrollProgress(from: offsets)
                updateFocusedSection(from: offsets)
            }
        }
        .onChange(of: scrollPositionSectionID) { _, newValue in
            guard let newValue else { return }
            DispatchQueue.main.async {
                if selectedJumpSectionID != newValue {
                    selectedJumpSectionID = newValue
                }
                // Also drive the bottom jumper's label off this signal so the
                // text updates immediately when SwiftUI's scrollPosition fires,
                // not only when the offset-preference handler catches up.
                if pendingFocusedSectionID != newValue {
                    pendingFocusedSectionID = newValue
                }
                if rememberedSectionID.wrappedValue != newValue {
                    rememberedSectionID.wrappedValue = newValue
                }
            }
        }
        .onTapGesture {
            guard hasActiveTextSelection else { return }
            dismissTextSelection()
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            jumpBar(proxy: proxy)
                .background(Color(uiColor: .systemGroupedBackground))
        }
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 2) {
                    if !library.codeSections.isEmpty {
                        Text(library.codeSectionName(id: chapter.codeSectionID))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(accentColor)
                            .lineLimit(1)
                    }
                    Text(chapter.displayLabel)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                }
                .frame(maxWidth: 260)
                .multilineTextAlignment(.center)
            }

            ToolbarItem(placement: .topBarTrailing) {
                chapterSearchToolbarButton
            }
        }
        .tint(accentColor)
        .fullScreenCover(
            isPresented: Binding(
                get: { expandedInlineImage != nil },
                set: { isPresented in
                    if !isPresented {
                        expandedInlineImage = nil
                    }
                }
            )
        ) {
            if let expandedInlineImage {
                ZoomableImageViewer(image: expandedInlineImage)
            }
        }
        .sheet(isPresented: $isJumpPickerPresented) {
            jumpPickerSheet(proxy: proxy)
        }
        .fullScreenCover(isPresented: $isChapterSearchPresented) {
            ChapterSearchSheet(
                title: chapter.displayLabel,
                entries: chapterSearchEntries,
                query: $chapterSearchQuery,
                onSelect: { entry in
                    jumpToSection(id: entry.sectionID, with: proxy)
                }
            )
            .environmentObject(library)
        }
        .task(id: chapter.id) {
            library.noteChapterOpened(chapter: chapter)
            chapterSearchQuery = ""
            await loadBlocks(with: proxy)
        }
        .onAppear {
            updateScrollProgress(from: lastBlockOffsets)
        }
        .onChange(of: isBrowserTabActive) { _, isActive in
            if isActive {
                updateScrollProgress(from: lastBlockOffsets)
            }
        }
        .onDisappear {
            focusedSectionUpdateTask?.cancel()
            focusedSectionUpdateTask = nil
            backgroundPrefetchTask?.cancel()
            backgroundPrefetchTask = nil
            chapterSearchQuery = ""
        }
        .overlay(alignment: .top) {
            CodeTopContentFade(alwaysVisible: true)
        }
    }

    @ViewBuilder
    private func blockSection(for block: CodeLibraryViewModel.ChapterReaderBlockSummary) -> some View {
        if duplicateHeadingSectionIDs.contains(block.id) {
            EmptyView()
        } else {
            visibleBlockSection(for: block)
        }
    }

    private func visibleBlockSection(for block: CodeLibraryViewModel.ChapterReaderBlockSummary) -> some View {
        let depth = block.sectionNumber.hierarchyIndentLevel
        let showsHierarchyBar = block.kind != .textBlock
        let barWidth: CGFloat = showsHierarchyBar ? hierarchyBarWidth(forDepth: depth) : 0
        let barOpacity: Double = showsHierarchyBar ? hierarchyBarOpacity(forDepth: depth) : 0
        let contentLeftPadding: CGFloat = showsHierarchyBar ? (barWidth + 10) : 0

        return VStack(alignment: .leading, spacing: 10) {
            if let groupLabel = block.groupLabel {
                Text(groupLabel)
                    .font(.title3.weight(.bold))
                    .foregroundStyle(accentColor)
                    .textCase(.uppercase)
                    .tracking(0.45)
            }

            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    if block.kind == .textBlock {
                        Text(block.displayTitle)
                            .font(.title3.weight(.semibold))
                    } else {
                        Text(block.sectionNumber)
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(accentColor)
                        Text(block.displayTitle)
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.leading)
                    }

                }

                ChapterBlockBodyView(
                    sectionID: block.id,
                    onOpenImage: { expandedInlineImage = $0 },
                    onSelectionChange: { hasSelection in
                        hasActiveTextSelection = hasSelection
                    }
                )
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, contentLeftPadding)
            .overlay(alignment: .leading) {
                if showsHierarchyBar {
                    Rectangle()
                        .fill(accentColor)
                        .opacity(barOpacity)
                        .frame(width: barWidth)
                        .frame(maxHeight: .infinity)
                        .allowsHitTesting(false)
                }
            }

            CodeHairline().padding(.top, 2)
        }
        .id(block.id)
        .background(
            GeometryReader { geo in
                Color.clear.preference(
                    key: ChapterReaderBlockOffsetPreferenceKey.self,
                    value: [block.id: geo.frame(in: .named(chapterReaderCoordinateSpace)).minY]
                )
            }
        )
    }

    private func hierarchyBarWidth(forDepth depth: Int) -> CGFloat {
        switch depth {
        case 0: return 4
        case 1: return 3
        case 2: return 2.5
        case 3: return 2
        default: return 1.5
        }
    }

    private func hierarchyBarOpacity(forDepth depth: Int) -> Double {
        switch depth {
        case 0: return 1.0
        case 1: return 0.78
        case 2: return 0.6
        case 3: return 0.48
        default: return 0.38
        }
    }

    private func isDuplicateSectionHeadingBlock(_ block: CodeLibraryViewModel.ChapterReaderBlockSummary) -> Bool {
        let normalizedDisplayTitle = block.displayTitle
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        let normalizedTitle = block.title
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        let normalizedChapterTitle = chapter.title
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        let normalizedChapterLabel = chapter.displayLabel
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        let normalizedAuthoredChapterHeading = "Chapter \(chapter.chapterNumber)"

        if block.kind == .textBlock {
            if normalizedDisplayTitle.caseInsensitiveCompare(normalizedChapterTitle) == .orderedSame {
                return true
            }
            if normalizedDisplayTitle.caseInsensitiveCompare(normalizedAuthoredChapterHeading) == .orderedSame {
                return true
            }
            if normalizedDisplayTitle.caseInsensitiveCompare(normalizedChapterLabel) == .orderedSame {
                return true
            }
            if normalizedTitle.caseInsensitiveCompare(normalizedChapterTitle) == .orderedSame {
                return true
            }
        }

        guard block.kind == .textBlock else { return false }
        return normalizedDisplayTitle.range(of: #"^Section\s+BC\s+[A-Z]?\d+"#, options: [.regularExpression, .caseInsensitive]) != nil
    }

    @ViewBuilder
    private func jumpBar(proxy: ScrollViewProxy) -> some View {
        HStack(spacing: 10) {
            Button {
                isJumpPickerPresented = true
            } label: {
                HStack(spacing: 8) {
                    Text(currentJumpLabel)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: "chevron.down")
                        .font(.caption2.weight(.semibold))
                }
                .font(.subheadline.weight(.medium))
                .foregroundStyle(accentColor)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
                .padding(.vertical, 11)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(visibleJumpBlocks.isEmpty)

            ReaderCurrentSectionBookmarkButton(
                sectionID: pendingFocusedSectionID ?? selectedJumpSectionID ?? blocks.first?.id,
                accentColor: accentColor
            )
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
        .padding(.bottom, 8)
    }

    private var visibleJumpBlocks: [CodeLibraryViewModel.ChapterReaderBlockSummary] {
        blocks.filter { !duplicateHeadingSectionIDs.contains($0.id) }
    }

    private func jumpPickerSheet(proxy: ScrollViewProxy) -> some View {
        NavigationStack {
            List {
                ForEach(visibleJumpBlocks) { block in
                    let depth = jumpSheetDepth(for: block)
                    Button {
                        jumpToSection(id: block.id, with: proxy)
                        isJumpPickerPresented = false
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(jumpSheetLabel(for: block))
                                .font(jumpSheetFont(forDepth: depth))
                                .foregroundStyle(accentColor.opacity(jumpSheetOpacity(forDepth: depth)))
                                .lineLimit(2)

                            if selectedJumpSectionID == block.id {
                                Text("Current")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.leading, CGFloat(min(depth, 3)) * 14)
                        .padding(.vertical, 6)
                    }
                    .buttonStyle(.plain)
                }
            }
            .navigationTitle("Jump within chapter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        isJumpPickerPresented = false
                    }
                    .foregroundStyle(accentColor)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func loadBlocks(with proxy: ScrollViewProxy) async {
        if loadedBlocksChapterID == chapter.id, !blocks.isEmpty {
            updateScrollProgress(from: lastBlockOffsets)
            return
        }

        let signpostID = OSSignpostID(log: AppSignpost.reader)
        os_signpost(.begin, log: AppSignpost.reader, name: "loadBlocks", signpostID: signpostID, "%{public}@", chapter.chapterNumber)
        defer { os_signpost(.end, log: AppSignpost.reader, name: "loadBlocks", signpostID: signpostID) }

        loadedBlocksChapterID = chapter.id
        blocks = []
        scrollProgress = 0
        pendingFocusedSectionID = nil
        expandedMediaTracker.reset()
        focusedSectionUpdateTask?.cancel()
        focusedSectionUpdateTask = nil
        backgroundPrefetchTask?.cancel()
        backgroundPrefetchTask = nil

        let summaries = await library.chapterBlockSummaries(for: chapter)
        guard !summaries.isEmpty else { return }

        let restoreSectionID = rememberedSectionID.wrappedValue ?? initialSectionID
        let initialLoadSectionID = summaries.contains(where: { $0.id == restoreSectionID })
            ? restoreSectionID
            : initialSectionID

        blocks = summaries
        refreshDuplicateHeadingSet()
        selectedJumpSectionID = initialLoadSectionID
        scrollPositionSectionID = initialLoadSectionID
        pendingScrollSectionID = initialLoadSectionID
        scrollIfNeeded(with: proxy, animated: false)

        await prewarmVisibleSectionBodies(from: summaries, around: initialLoadSectionID)
        startBackgroundPrefetch(for: summaries, anchor: initialLoadSectionID)
    }

    private func startBackgroundPrefetch(
        for summaries: [CodeLibraryViewModel.ChapterReaderBlockSummary],
        anchor: Int64
    ) {
        backgroundPrefetchTask?.cancel()
        let library = library
        backgroundPrefetchTask = Task { [weak library] in
            guard let library else { return }
            let anchorIndex = summaries.firstIndex(where: { $0.id == anchor }) ?? summaries.startIndex
            // Walk outward from the visible anchor so sections you're likely
            // to reach next get warmed first.
            var offset = 1
            var prefetchedCount = 0
            while !Task.isCancelled, prefetchedCount < backgroundPrefetchSectionLimit {
                let forwardIndex = anchorIndex + offset
                let backwardIndex = anchorIndex - offset
                var didTouch = false
                for candidate in [forwardIndex, backwardIndex] {
                    guard candidate >= summaries.startIndex, candidate < summaries.endIndex else { continue }
                    guard prefetchedCount < backgroundPrefetchSectionLimit else { return }
                    didTouch = true
                    let id = summaries[candidate].id
                    if let detail = await library.loadSectionDetailAsync(sectionID: id) {
                        _ = await library.chapterBodyNSTextAsync(for: detail)
                    }
                    prefetchedCount += 1
                    if Task.isCancelled { return }
                    await Task.yield()
                }
                if !didTouch { return }
                offset += 1
            }
        }
    }

    private func refreshDuplicateHeadingSet() {
        duplicateHeadingSectionIDs = Set(
            blocks.compactMap { isDuplicateSectionHeadingBlock($0) ? $0.id : nil }
        )
    }

    private func jumpToSection(id: Int64, with proxy: ScrollViewProxy) {
        selectedJumpSectionID = id
        scrollPositionSectionID = id
        rememberedSectionID.wrappedValue = id
        pendingScrollSectionID = id
        scrollIfNeeded(with: proxy, animated: true)
    }

    private func updateScrollProgress(from offsets: [Int64: CGFloat]) {
        let visibleBlocks = visibleJumpBlocks
        guard !visibleBlocks.isEmpty else {
            scrollProgress = 0
            return
        }
        guard let topID = topVisibleSectionID(from: offsets),
              let index = visibleBlocks.firstIndex(where: { $0.id == topID })
        else { return }
        let denominator = max(visibleBlocks.count - 1, 1)
        scrollProgress = CGFloat(index) / CGFloat(denominator)
    }

    private func updateFocusedSection(from offsets: [Int64: CGFloat]) {
        guard let topMost = topVisibleSectionID(from: offsets) else { return }
        // Only gate on `pendingFocusedSectionID` — `selectedJumpSectionID` is
        // also written by SwiftUI's `.scrollPosition` modifier, so checking
        // it here caused the jump label to freeze at the first section the
        // user opened. `pendingFocusedSectionID` is the source of truth for
        // the bottom jumper's displayed label.
        if pendingFocusedSectionID == topMost { return }

        pendingFocusedSectionID = topMost
        selectedJumpSectionID = topMost
        rememberedSectionID.wrappedValue = topMost
        expandedMediaTracker.collapseFar(currentSectionID: topMost, blocks: blocks)
        focusedSectionUpdateTask?.cancel()
        focusedSectionUpdateTask = Task {
            try? await Task.sleep(for: focusedSectionUpdateDelay)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                guard pendingFocusedSectionID == topMost else { return }
                selectedJumpSectionID = topMost
            }
        }
    }

    private func topVisibleSectionID(from offsets: [Int64: CGFloat]) -> Int64? {
        guard !offsets.isEmpty else { return nil }
        let candidates = offsets.filter { !duplicateHeadingSectionIDs.contains($0.key) }
        guard !candidates.isEmpty else { return nil }
        let aboveOrAt = candidates.filter { $0.value <= chapterReaderScrollTopThreshold }
        if let highestAbove = aboveOrAt.max(by: { $0.value < $1.value })?.key {
            return highestAbove
        }
        // Nothing above the threshold yet (e.g. content scrolled all the way
        // down); fall back to the section closest below it.
        return candidates.min(by: { $0.value < $1.value })?.key
    }

    private func prewarmVisibleSectionBodies(
        from summaries: [CodeLibraryViewModel.ChapterReaderBlockSummary],
        around initialLoadSectionID: Int64
    ) async {
        let focusedIndex = summaries.firstIndex { $0.id == initialLoadSectionID } ?? summaries.startIndex
        let startIndex = max(summaries.startIndex, focusedIndex - 1)
        let sectionIDs = Array(
            summaries
                .dropFirst(startIndex)
                .prefix(prewarmedSectionCount + 2)
                .map(\.id)
        )
        guard !sectionIDs.isEmpty else { return }

        let details = await library.loadSectionDetailsAsync(sectionIDs: sectionIDs)
        for detail in details {
            _ = await library.chapterBodyNSTextAsync(for: detail)
            if Task.isCancelled { return }
        }
    }

    private func jumpLabel(for block: CodeLibraryViewModel.ChapterReaderBlockSummary) -> String {
        block.kind == .textBlock ? block.displayTitle : "\(block.sectionNumber) \(block.displayTitle)"
    }

    private func jumpSheetLabel(for block: CodeLibraryViewModel.ChapterReaderBlockSummary) -> String {
        if block.kind == .textBlock {
            return block.displayTitle
        }

        if let groupLabel = block.groupLabel {
            return groupLabel
        }

        let normalizedSectionNumber = block.sectionNumber
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
        let isSectionGroup = normalizedSectionNumber.range(of: #"^\d+0\d$"#, options: .regularExpression) != nil
            && normalizedSectionNumber.count >= 3

        if isSectionGroup {
            return "Section \(normalizedSectionNumber): \(block.displayTitle)"
        }
        return "\(block.sectionNumber) \(block.displayTitle)"
    }

    private func jumpSheetIndent(for block: CodeLibraryViewModel.ChapterReaderBlockSummary) -> CGFloat {
        CGFloat(min(jumpSheetDepth(for: block), 3)) * 14
    }

    /// Hierarchical depth used to indent and de-emphasize subsection rows in
    /// the jump sheet. 0 = top-level section heading, 1+ = nested subsection.
    private func jumpSheetDepth(for block: CodeLibraryViewModel.ChapterReaderBlockSummary) -> Int {
        guard block.kind != .textBlock, block.sectionNumber.contains(".") else { return 0 }
        return max(0, block.sectionNumber.split(separator: ".").count - 1)
    }

    /// Lighter weight for nested subsections so the parent section heading
    /// stays the strongest visual anchor in the jump sheet.
    private func jumpSheetFont(forDepth depth: Int) -> Font {
        switch depth {
        case 0: return .body.weight(.semibold)
        case 1: return .body.weight(.regular)
        case 2: return .callout.weight(.regular)
        default: return .subheadline.weight(.regular)
        }
    }

    /// Mild opacity falloff per depth so deeper subsections recede without
    /// losing legibility on a light or dark sheet background.
    private func jumpSheetOpacity(forDepth depth: Int) -> Double {
        switch depth {
        case 0: return 1.0
        case 1: return 0.80
        case 2: return 0.68
        default: return 0.58
        }
    }

    private func dismissTextSelection() {
        NotificationCenter.default.post(name: .nycccClearRichTextSelection, object: nil)
        hasActiveTextSelection = false
    }

    private func scrollIfNeeded(with proxy: ScrollViewProxy, animated: Bool) {
        guard let pendingScrollSectionID else { return }
        DispatchQueue.main.async {
            if animated {
                withAnimation(.easeInOut(duration: 0.2)) {
                    proxy.scrollTo(pendingScrollSectionID, anchor: .top)
                }
            } else {
                proxy.scrollTo(pendingScrollSectionID, anchor: .top)
            }
            self.pendingScrollSectionID = nil
        }
    }
}

enum ReaderBookmarkButtonStyle {
    case standard
    case compact
}

struct ReaderCurrentSectionBookmarkButton: View {
    let sectionID: Int64?
    let accentColor: Color
    var style: ReaderBookmarkButtonStyle = .standard

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var displayedIsBookmarked = false
    @State private var bookmarkConfirmation: String?
    @State private var bookmarkConfirmationTask: Task<Void, Never>?
    @State private var showsSavedFollowUp = false
    @State private var isFolderPickerOpen = false
    @State private var pendingFolderIDs: Set<Int64> = []
    @State private var folderCreationRequest: ReaderBookmarkFolderCreation?

    var body: some View {
        Button {
            guard let sectionID else { return }
            let desiredBookmarkState = !displayedIsBookmarked
            displayedIsBookmarked = desiredBookmarkState
            displayedIsBookmarked = library.toggleBookmark(sectionID: sectionID)
            if displayedIsBookmarked == desiredBookmarkState {
                showBookmarkConfirmation(displayedIsBookmarked ? "Saved" : "Removed")
                if displayedIsBookmarked {
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                    showsSavedFollowUp = true
                }
            }
        } label: {
            Image(systemName: displayedIsBookmarked ? "bookmark.fill" : "bookmark")
                .font(.body.weight(.semibold))
                .foregroundStyle(displayedIsBookmarked ? accentColor : Color.secondary)
                .frame(width: style == .standard ? 44 : 28, height: style == .standard ? 44 : 28)
                .background(
                    style == .standard
                        ? Color(uiColor: .secondarySystemGroupedBackground)
                        : Color.clear
                )
                .clipShape(RoundedRectangle(cornerRadius: style == .standard ? 12 : 6, style: .continuous))
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(sectionID == nil)
        .accessibilityIdentifier("reader-current-section-bookmark")
        .accessibilityLabel(displayedIsBookmarked ? "Remove current section bookmark" : "Save current section")
        .accessibilityValue(displayedIsBookmarked ? "Saved" : "Not saved")
        .onAppear { synchronizeState() }
        .onChange(of: sectionID) { _, _ in synchronizeState() }
        .onChange(of: library.bookmarkRevision) { _, _ in synchronizeState() }
        .alert(
            "Section saved",
            isPresented: $showsSavedFollowUp
        ) {
            Button("Add to Project") {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    openFolderPicker()
                }
            }
            Button("Done", role: .cancel) { }
        } message: {
            Text("The section is saved now. Project assignment is optional and can be added next.")
        }
        .sheet(isPresented: $isFolderPickerOpen) {
            if let sectionID {
                FolderPickerSheet(
                    folders: library.folders,
                    memberFolderIDs: Set(library.folderMembership[sectionID] ?? []),
                    selectedFolderIDs: $pendingFolderIDs,
                    canUseProjects: library.hasProjectAccess,
                    onSave: { folderIDs in
                        if library.replaceFolderMembership(sectionID: sectionID, folderIDs: folderIDs) {
                            UINotificationFeedbackGenerator().notificationOccurred(.success)
                        }
                    },
                    onCreateNew: { folderType in
                        isFolderPickerOpen = false
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                            folderCreationRequest = ReaderBookmarkFolderCreation(folderType: folderType)
                        }
                    },
                    onRequireProjectAccess: {
                        library.requireProjectAccess()
                    }
                )
            }
        }
        .sheet(item: $folderCreationRequest) { request in
            FolderEditorSheet(
                existing: nil,
                defaultFolderType: request.folderType,
                onSave: { name, address, description, colorHex, folderType in
                    if let folder = library.createFolder(
                        name: name,
                        address: address,
                        description: description,
                        colorHex: colorHex,
                        folderType: folderType
                    ) {
                        pendingFolderIDs.insert(folder.id)
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                            isFolderPickerOpen = true
                        }
                    }
                },
                onDelete: { }
            )
        }
        .overlay(alignment: .topTrailing) {
            if let bookmarkConfirmation {
                Text(bookmarkConfirmation)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.primary)
                    .lineLimit(1)
                    .fixedSize()
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.regularMaterial, in: Capsule())
                    .offset(y: -34)
                    .transition(.opacity.combined(with: .scale(scale: 0.9)))
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
        .onDisappear {
            bookmarkConfirmationTask?.cancel()
            bookmarkConfirmationTask = nil
            bookmarkConfirmation = nil
        }
    }

    private func synchronizeState() {
        displayedIsBookmarked = sectionID.map { library.isBookmarked(sectionID: $0) } ?? false
    }

    private func openFolderPicker() {
        guard let sectionID else { return }
        pendingFolderIDs = Set(library.folderMembership[sectionID] ?? [])
        isFolderPickerOpen = true
    }

    private func showBookmarkConfirmation(_ message: String) {
        bookmarkConfirmationTask?.cancel()
        withAnimation(.easeOut(duration: 0.15)) {
            bookmarkConfirmation = message
        }
        bookmarkConfirmationTask = Task {
            try? await Task.sleep(for: .milliseconds(1_200))
            guard !Task.isCancelled else { return }
            withAnimation(.easeIn(duration: 0.15)) {
                bookmarkConfirmation = nil
            }
            bookmarkConfirmationTask = nil
        }
    }
}

private struct ReaderBookmarkFolderCreation: Identifiable {
    let id = UUID()
    let folderType: CodeFolderType
}

struct ChapterNoteSheet: View {
    let detail: ReaderSectionDetail
    let titleOverride: String?
    @Binding var noteBody: String
    let accentColor: Color
    let projects: [CodeFolder]
    let projectMemberIDs: Set<Int64>
    @State private var isBookmarked: Bool
    @State private var selectedProjectIDs: Set<Int64>
    @State private var persistedNoteBody: String
    @State private var noteSaveFailureMessage: String?
    @State private var isRestoringRejectedNoteChange = false
    let onToggleBookmark: () -> Bool
    let onToggleProject: (CodeFolder, Bool) -> Void
    let onSave: (String) -> NoteSaveResult

    @Environment(\.dismiss) private var dismiss
    @State private var isProjectPickerPresented = false
    @FocusState private var isNotesFieldFocused: Bool

    init(
        detail: ReaderSectionDetail,
        titleOverride: String? = nil,
        noteBody: Binding<String>,
        accentColor: Color,
        projects: [CodeFolder],
        projectMemberIDs: Set<Int64>,
        isBookmarked: Bool,
        onToggleBookmark: @escaping () -> Bool,
        onToggleProject: @escaping (CodeFolder, Bool) -> Void,
        onSave: @escaping (String) -> NoteSaveResult
    ) {
        self.detail = detail
        self.titleOverride = titleOverride
        _noteBody = noteBody
        self.accentColor = accentColor
        self.projects = projects
        self.projectMemberIDs = projectMemberIDs
        _isBookmarked = State(initialValue: isBookmarked)
        _selectedProjectIDs = State(initialValue: projectMemberIDs)
        _persistedNoteBody = State(initialValue: noteBody.wrappedValue)
        _noteSaveFailureMessage = State(initialValue: nil)
        self.onToggleBookmark = onToggleBookmark
        self.onToggleProject = onToggleProject
        self.onSave = onSave
    }

    private var displayTitle: String {
        let trimmedOverride = titleOverride?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmedOverride.isEmpty ? detail.displayLabel : trimmedOverride
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 10) {
                Text(displayTitle)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)

                ZStack(alignment: .topLeading) {
                    TextEditor(text: $noteBody)
                        .font(.body)
                        .scrollContentBackground(.hidden)
                        .focused($isNotesFieldFocused)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .frame(minHeight: 180)
                        .background(Color(uiColor: .secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .strokeBorder(Color(uiColor: .separator), lineWidth: 1)
                        )
                        .onChange(of: noteBody) { _, newValue in
                            saveNote(newValue)
                        }

                    if noteBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Text("Add a note")
                            .font(.body)
                            .foregroundStyle(.tertiary)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 16)
                            .allowsHitTesting(false)
                    }
                }

                if let noteSaveFailureMessage {
                    Label("Not Saved", systemImage: "exclamationmark.triangle")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.orange)

                    Text(noteSaveFailureMessage)
                        .font(.footnote)
                        .foregroundStyle(.orange)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .contentShape(Rectangle())
            .onTapGesture {
                dismissKeyboard()
            }
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle(displayTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        DispatchQueue.main.async {
                            if !isBookmarked {
                                isBookmarked = onToggleBookmark()
                            }
                            guard isBookmarked else { return }
                            isProjectPickerPresented = true
                        }
                    } label: {
                        Image(systemName: isBookmarked ? "bookmark.fill" : "bookmark")
                            .foregroundStyle(isBookmarked ? accentColor : .secondary)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .sheet(isPresented: $isProjectPickerPresented) {
            ChapterNoteProjectPickerSheet(
                projects: projects,
                selectedProjectIDs: selectedProjectIDs,
                accentColor: accentColor,
                onToggle: { project in
                    let shouldAdd = !selectedProjectIDs.contains(project.id)
                    if shouldAdd {
                        selectedProjectIDs.insert(project.id)
                    } else {
                        selectedProjectIDs.remove(project.id)
                    }
                    onToggleProject(project, shouldAdd)
                }
            )
        }
    }

    private func dismissKeyboard() {
        isNotesFieldFocused = false
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }

    private func saveNote(_ proposedBody: String) {
        guard !isRestoringRejectedNoteChange else {
            isRestoringRejectedNoteChange = false
            return
        }
        switch onSave(proposedBody) {
        case .saved:
            persistedNoteBody = proposedBody
            noteSaveFailureMessage = nil
        case .failed(let persistedBody, let message):
            self.persistedNoteBody = persistedBody
            noteSaveFailureMessage = message
            if noteBody != persistedBody {
                isRestoringRejectedNoteChange = true
                noteBody = persistedBody
            }
        }
    }

}

private struct ChapterNoteProjectPickerSheet: View {
    let projects: [CodeFolder]
    let selectedProjectIDs: Set<Int64>
    let accentColor: Color
    let onToggle: (CodeFolder) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Save to project") {
                    if projects.isEmpty {
                        Text("No projects yet.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(projects) { project in
                            Button {
                                onToggle(project)
                            } label: {
                                HStack(spacing: 12) {
                                    Circle()
                                        .fill(project.color)
                                        .frame(width: 12, height: 12)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(project.name)
                                            .foregroundStyle(.primary)
                                        if !project.address.isEmpty {
                                            Text(project.address)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                                .lineLimit(1)
                                        } else if !project.description.isEmpty {
                                            Text(project.description)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                                .lineLimit(1)
                                        }
                                    }
                                    Spacer()
                                    Image(systemName: selectedProjectIDs.contains(project.id) ? "checkmark.circle.fill" : "circle")
                                        .font(.title3)
                                        .foregroundStyle(selectedProjectIDs.contains(project.id) ? project.color : Color.secondary.opacity(0.5))
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .navigationTitle("Add to project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .tint(accentColor)
    }
}

private struct ChapterBlockBodyView: View {
    let sectionID: Int64
    let onOpenImage: (UIImage) -> Void
    let onSelectionChange: ((Bool) -> Void)?

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var detail: ReaderSectionDetail?
    @State private var bodyText: NSAttributedString?

    var body: some View {
        Group {
            if let detail, !detail.contentBlocks.isEmpty {
                ContentBlockListView(
                    detail: detail,
                    fallbackText: bodyText ?? NSAttributedString(string: ""),
                    onOpenImage: onOpenImage,
                    onSelectionChange: onSelectionChange
                )
            } else if let detail, let bodyText, !bodyText.string.isEmpty {
                ContentBlockListView(
                    detail: detail,
                    fallbackText: bodyText,
                    onOpenImage: onOpenImage,
                    onSelectionChange: onSelectionChange
                )
            } else {
                // Reserve a small space so layout doesn't jump when the body
                // resolves a frame later. No spinner — cache hits should land
                // before the user notices.
                Color.clear.frame(maxWidth: .infinity, minHeight: 18, alignment: .leading)
            }
        }
        .task(id: ChapterBlockBodyTaskID(sectionID: sectionID, theme: library.readerTheme)) {
            let loadedDetail: ReaderSectionDetail?
            if let existing = detail, existing.id == sectionID {
                loadedDetail = existing
            } else {
                loadedDetail = await library.loadSectionDetailAsync(sectionID: sectionID)
                if Task.isCancelled { return }
                if let loadedDetail {
                    if detail?.id != loadedDetail.id {
                        detail = loadedDetail
                    }
                }
            }

            guard let resolvedDetail = loadedDetail else { return }
            let renderedText = await library.chapterBodyNSTextAsync(for: resolvedDetail)
            if Task.isCancelled { return }
            if bodyText?.isEqual(renderedText) != true {
                bodyText = renderedText
            }
        }
    }
}

private struct ChapterBlockBodyTaskID: Hashable {
    let sectionID: Int64
    let theme: ReaderTheme
}

private struct ChapterReaderBlockOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: [Int64: CGFloat] = [:]

    static func reduce(value: inout [Int64: CGFloat], nextValue: () -> [Int64: CGFloat]) {
        value.merge(nextValue(), uniquingKeysWith: { _, new in new })
    }
}

@MainActor
final class ExpandedMediaTracker: ObservableObject {
    @Published private(set) var expandedBlockIDs: Set<String> = []
    private var sectionIDForBlock: [String: Int64] = [:]
    private let collapseThreshold = 3

    func isExpanded(blockID: String) -> Bool {
        expandedBlockIDs.contains(blockID)
    }

    func setExpanded(_ expanded: Bool, blockID: String, sectionID: Int64) {
        if expanded {
            expandedBlockIDs.insert(blockID)
            sectionIDForBlock[blockID] = sectionID
        } else {
            expandedBlockIDs.remove(blockID)
            sectionIDForBlock.removeValue(forKey: blockID)
        }
    }

    func reset() {
        expandedBlockIDs.removeAll()
        sectionIDForBlock.removeAll()
    }

    func collapseFar(currentSectionID: Int64, blocks: [CodeLibraryViewModel.ChapterReaderBlockSummary]) {
        guard !expandedBlockIDs.isEmpty else { return }
        guard let currentIndex = blocks.firstIndex(where: { $0.id == currentSectionID }) else { return }
        var toRemove: Set<String> = []
        for blockID in expandedBlockIDs {
            guard let sectionID = sectionIDForBlock[blockID],
                  let mediaIndex = blocks.firstIndex(where: { $0.id == sectionID })
            else { continue }
            if currentIndex - mediaIndex >= collapseThreshold {
                toRemove.insert(blockID)
            }
        }
        guard !toRemove.isEmpty else { return }
        expandedBlockIDs.subtract(toRemove)
        for id in toRemove {
            sectionIDForBlock.removeValue(forKey: id)
        }
    }
}
