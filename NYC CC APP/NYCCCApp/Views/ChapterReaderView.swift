import os.signpost
import SwiftUI
import UIKit

struct ChapterReaderView: View {
    let chapter: CodeChapter
    let initialSectionID: Int64
    var rememberedSectionID: Binding<Int64?> = .constant(nil)

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var blocks: [CodeLibraryViewModel.ChapterReaderBlockSummary] = []
    @State private var selectedJumpSectionID: Int64?
    @State private var pendingScrollSectionID: Int64?
    @State private var expandedInlineImage: UIImage?
    @State private var visibleBookmarkedSectionIDs: Set<Int64> = []
    @State private var visibleNotedSectionIDs: Set<Int64> = []
    @State private var visibleBookmarkedSectionNumbers: Set<String> = []
    @State private var duplicateHeadingSectionIDs: Set<Int64> = []
    @State private var noteTarget: ReaderSectionDetail?
    @State private var noteBody = ""
    @State private var hasActiveTextSelection = false
    @State private var isJumpPickerPresented = false
    @State private var pendingFocusedSectionID: Int64?
    @State private var scrollPositionSectionID: Int64?
    @State private var focusedSectionUpdateTask: Task<Void, Never>?
    @State private var backgroundPrefetchTask: Task<Void, Never>?
    @StateObject private var expandedMediaTracker = ExpandedMediaTracker()
    private let chapterReaderCoordinateSpace: String = "chapterReaderScroll"
    private let chapterReaderScrollTopThreshold: CGFloat = 140
    private let focusedSectionUpdateDelay: Duration = .milliseconds(70)
    private let prewarmedSectionCount = 4
    private let backgroundPrefetchSectionLimit = 12
    private var accentColor: Color {
        Color(uiColor: library.accentColor(for: chapter.codeSectionID))
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

    var body: some View {
        ScrollViewReader { proxy in
            chapterReaderContent(proxy: proxy)
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
                updateFocusedSection(from: offsets)
            }
        }
        .onChange(of: scrollPositionSectionID) { _, newValue in
            guard let newValue else { return }
            DispatchQueue.main.async {
                if selectedJumpSectionID != newValue {
                    selectedJumpSectionID = newValue
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
        .overlay(alignment: .top) {
            CodeTopContentFade(alwaysVisible: true)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            jumpBar(proxy: proxy)
                .background(Color(uiColor: .systemGroupedBackground))
        }
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .disablesInteractivePopGesture()
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
        }
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
        .sheet(item: $noteTarget) { detail in
            ChapterNoteSheet(
                detail: detail,
                noteBody: $noteBody,
                accentColor: accentColor,
                isBookmarked: library.isBookmarked(sectionID: detail.id),
                onToggleBookmark: {
                    library.toggleBookmark(sectionID: detail.id)
                },
                onSave: { body in
                    library.saveNote(sectionID: detail.id, body: body)
                    syncVisibleSavedState()
                }
            )
        }
        .sheet(isPresented: $isJumpPickerPresented) {
            jumpPickerSheet(proxy: proxy)
        }
        .task(id: chapter.id) {
            library.noteChapterOpened(chapter: chapter)
            noteTarget = nil
            await loadBlocks(with: proxy)
        }
        .onAppear {
            syncVisibleSavedState()
        }
        .onChange(of: library.bookmarkRevision) { _, _ in
            syncVisibleSavedState()
        }
        .onDisappear {
            focusedSectionUpdateTask?.cancel()
            focusedSectionUpdateTask = nil
            backgroundPrefetchTask?.cancel()
            backgroundPrefetchTask = nil
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
        let normalizedSectionNumber = block.sectionNumber
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
            .uppercased()
        let isBookmarked = visibleBookmarkedSectionIDs.contains(block.id)
            || visibleBookmarkedSectionNumbers.contains(normalizedSectionNumber)
        let hasNote = visibleNotedSectionIDs.contains(block.id)
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

                    Spacer(minLength: 0)

                    sectionStatusIndicators(isBookmarked: isBookmarked, hasNote: hasNote)
                }

                ChapterBlockBodyView(
                    sectionID: block.id,
                    onOpenImage: { expandedInlineImage = $0 },
                    onOpenNotes: { detail in
                        openNotes(for: detail)
                    },
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

    @ViewBuilder
    private func sectionStatusIndicators(isBookmarked: Bool, hasNote: Bool) -> some View {
        if isBookmarked || hasNote {
        HStack(spacing: 8) {
                if hasNote {
                Image(systemName: "note.text")
                    .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                    .frame(width: 28, height: 28)
                }

                if isBookmarked {
                Image(systemName: isBookmarked ? "bookmark.fill" : "bookmark")
                    .font(.subheadline.weight(.semibold))
                        .foregroundStyle(accentColor)
                    .frame(width: 28, height: 28)
                }
            }
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
                .foregroundStyle(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
                .padding(.vertical, 11)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(Color(uiColor: .separator), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .disabled(visibleJumpBlocks.isEmpty)

            Button {
                if let firstID = blocks.first?.id {
                    jumpToSection(id: firstID, with: proxy)
                }
            } label: {
                Image(systemName: "arrow.up.to.line")
                    .font(.subheadline.weight(.semibold))
            }
            .frame(width: 42, height: 42)
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color(uiColor: .separator), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
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
                    Button {
                        jumpToSection(id: block.id, with: proxy)
                        isJumpPickerPresented = false
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(jumpSheetLabel(for: block))
                                .font(.body.weight(.semibold))
                                .foregroundStyle(accentColor)
                                .lineLimit(2)

                            if selectedJumpSectionID == block.id {
                                Text("Current")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
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
        let signpostID = OSSignpostID(log: AppSignpost.reader)
        os_signpost(.begin, log: AppSignpost.reader, name: "loadBlocks", signpostID: signpostID, "%{public}@", chapter.chapterNumber)
        defer { os_signpost(.end, log: AppSignpost.reader, name: "loadBlocks", signpostID: signpostID) }

        blocks = []
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
        syncVisibleSavedState()
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

    private func updateFocusedSection(from offsets: [Int64: CGFloat]) {
        guard let topMost = topVisibleSectionID(from: offsets) else { return }
        if pendingFocusedSectionID == topMost || selectedJumpSectionID == topMost {
            return
        }

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

    private func syncVisibleSavedState() {
        visibleBookmarkedSectionIDs = Set(
            blocks.map(\.id).filter { library.isBookmarked(sectionID: $0) }
        )
        visibleNotedSectionIDs = Set(
            blocks.map(\.id).filter {
                !library.noteBody(sectionID: $0).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            }
        )
        visibleBookmarkedSectionNumbers = Set(
            blocks.compactMap { block in
                guard library.isBookmarked(sectionID: block.id) else { return nil }
                return block.sectionNumber
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
                    .uppercased()
            }
        )
    }

    private func jumpLabel(for block: CodeLibraryViewModel.ChapterReaderBlockSummary) -> String {
        block.kind == .textBlock ? block.displayTitle : "\(block.sectionNumber) \(block.displayTitle)"
    }

    private func jumpSheetLabel(for block: CodeLibraryViewModel.ChapterReaderBlockSummary) -> String {
        if block.kind == .textBlock {
            return block.displayTitle
        }

        let normalizedSectionNumber = block.sectionNumber
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
        let isSectionGroup = normalizedSectionNumber.range(of: #"^\d+0\d$"#, options: .regularExpression) != nil
            && normalizedSectionNumber.count >= 3

        if isSectionGroup {
            return "Section BC \(normalizedSectionNumber): \(block.displayTitle)"
        }
        return "\(block.sectionNumber) \(block.displayTitle)"
    }

    private func openNotes(for detail: ReaderSectionDetail) {
        if hasActiveTextSelection {
            dismissTextSelection()
            return
        }
        noteBody = library.noteBody(sectionID: detail.id)
        noteTarget = detail
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

private struct ChapterNoteSheet: View {
    let detail: ReaderSectionDetail
    @Binding var noteBody: String
    let accentColor: Color
    @State private var isBookmarked: Bool
    let onToggleBookmark: () -> Bool
    let onSave: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @FocusState private var isNotesFieldFocused: Bool

    init(
        detail: ReaderSectionDetail,
        noteBody: Binding<String>,
        accentColor: Color,
        isBookmarked: Bool,
        onToggleBookmark: @escaping () -> Bool,
        onSave: @escaping (String) -> Void
    ) {
        self.detail = detail
        _noteBody = noteBody
        self.accentColor = accentColor
        _isBookmarked = State(initialValue: isBookmarked)
        self.onToggleBookmark = onToggleBookmark
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(detail.displayLabel)
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(detail.chapterTitle)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

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
                            onSave(newValue)
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

                Spacer(minLength: 0)
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .contentShape(Rectangle())
            .onTapGesture {
                dismissKeyboard()
            }
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle("Notes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        isBookmarked = onToggleBookmark()
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
    }

    private func dismissKeyboard() {
        isNotesFieldFocused = false
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

private struct ChapterBlockBodyView: View {
    let sectionID: Int64
    let onOpenImage: (UIImage) -> Void
    let onOpenNotes: ((ReaderSectionDetail) -> Void)?
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
                    onContentTap: {
                        onOpenNotes?(detail)
                    },
                    onSelectionChange: onSelectionChange
                )
            } else if let detail, let bodyText, !bodyText.string.isEmpty {
                ContentBlockListView(
                    detail: detail,
                    fallbackText: bodyText,
                    onOpenImage: onOpenImage,
                    onContentTap: {
                        onOpenNotes?(detail)
                    },
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

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        guard size > 0, !isEmpty else { return isEmpty ? [] : [self] }

        var chunks: [[Element]] = []
        chunks.reserveCapacity((count + size - 1) / size)

        var index = startIndex
        while index < endIndex {
            let nextIndex = self.index(index, offsetBy: size, limitedBy: endIndex) ?? endIndex
            chunks.append(Array(self[index..<nextIndex]))
            index = nextIndex
        }

        return chunks
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
