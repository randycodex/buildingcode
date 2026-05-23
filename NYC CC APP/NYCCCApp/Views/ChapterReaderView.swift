import SwiftUI
import UIKit

struct ChapterReaderView: View {
    let chapter: CodeChapter
    let initialSectionID: Int64

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var blocks: [CodeLibraryViewModel.ChapterReaderBlockContent] = []
    @State private var blockOrder: [Int64: Int] = [:]
    @State private var prewarmedBodyText: [Int64: NSAttributedString] = [:]
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
    @State private var focusedSectionUpdateTask: Task<Void, Never>?
    private let chapterReaderCoordinateSpace: String = "chapterReaderScroll"
    private let chapterReaderScrollTopThreshold: CGFloat = 140
    private let focusedSectionUpdateDelay: Duration = .milliseconds(70)
    private let prewarmedSectionCount = 4
    private let indentStep: CGFloat = 26

    private var accentColor: Color {
        Color(uiColor: library.accentColor(for: chapter.codeSectionID))
    }

    private var currentJumpLabel: String {
        let activeSectionID = pendingFocusedSectionID ?? selectedJumpSectionID
        if let activeSectionID,
           let block = blocks.first(where: { $0.detail.id == activeSectionID }) {
            return jumpLabel(for: block.detail)
        }
        if let first = blocks.first {
            return jumpLabel(for: first.detail)
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
            .padding(.bottom, 24)
        }
        .contentShape(Rectangle())
        .coordinateSpace(name: chapterReaderCoordinateSpace)
        .onPreferenceChange(ChapterReaderBlockOffsetPreferenceKey.self) { offsets in
            updateFocusedSection(from: offsets)
        }
        .onTapGesture {
            guard hasActiveTextSelection else { return }
            dismissTextSelection()
        }
        .overlay(alignment: .top) {
            CodeTopContentFade()
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            jumpBar(proxy: proxy)
                .background(Color(uiColor: .systemGroupedBackground))
        }
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
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
        }
    }

    @ViewBuilder
    private func blockSection(for block: CodeLibraryViewModel.ChapterReaderBlockContent) -> some View {
        if duplicateHeadingSectionIDs.contains(block.detail.id) {
            EmptyView()
        } else {
            visibleBlockSection(for: block)
        }
    }

    private func visibleBlockSection(for block: CodeLibraryViewModel.ChapterReaderBlockContent) -> some View {
        let hierarchyIndent = CGFloat(block.detail.sectionNumber.hierarchyIndentLevel) * indentStep
        let normalizedSectionNumber = block.detail.sectionNumber
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
            .uppercased()
        let isBookmarked = visibleBookmarkedSectionIDs.contains(block.detail.id)
            || visibleBookmarkedSectionNumbers.contains(normalizedSectionNumber)
        let hasNote = visibleNotedSectionIDs.contains(block.detail.id)

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
                    if block.detail.kind == .textBlock {
                        Text(block.detail.displayTitle)
                            .font(.title3.weight(.semibold))
                    } else {
                        Text(block.detail.sectionNumber)
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(accentColor)
                        Text(block.detail.displayTitle)
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.leading)
                    }

                    Spacer(minLength: 0)

                    sectionStatusIndicators(isBookmarked: isBookmarked, hasNote: hasNote)
                }

                ChapterBlockBodyView(
                    detail: block.detail,
                    prewarmedText: prewarmedBodyText[block.detail.id],
                    onOpenImage: { expandedInlineImage = $0 },
                    onContentTap: {
                        openNotes(for: block.detail)
                    },
                    onSelectionChange: { hasSelection in
                        hasActiveTextSelection = hasSelection
                    }
                )
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, hierarchyIndent)

            CodeHairline().padding(.top, 2)
        }
        .id(block.detail.id)
        .background(
            GeometryReader { geo in
                Color.clear.preference(
                    key: ChapterReaderBlockOffsetPreferenceKey.self,
                    value: [block.detail.id: geo.frame(in: .named(chapterReaderCoordinateSpace)).minY]
                )
            }
        )
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

    private func isDuplicateSectionHeadingBlock(_ detail: ReaderSectionDetail) -> Bool {
        let normalizedDisplayTitle = detail.displayTitle
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        let normalizedTitle = detail.title
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        let normalizedChapterTitle = chapter.title
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        let normalizedChapterLabel = chapter.displayLabel
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        let normalizedAuthoredChapterHeading = "Chapter \(chapter.chapterNumber)"

        if detail.kind == .textBlock {
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

        guard detail.kind == .textBlock else { return false }
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
                if let firstID = blocks.first?.detail.id {
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

    private var visibleJumpBlocks: [CodeLibraryViewModel.ChapterReaderBlockContent] {
        blocks.filter { !duplicateHeadingSectionIDs.contains($0.detail.id) }
    }

    private func jumpPickerSheet(proxy: ScrollViewProxy) -> some View {
        NavigationStack {
            List {
                ForEach(visibleJumpBlocks) { block in
                    Button {
                        jumpToSection(id: block.detail.id, with: proxy)
                        isJumpPickerPresented = false
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(jumpSheetLabel(for: block.detail))
                                .font(.body.weight(.semibold))
                                .foregroundStyle(accentColor)
                                .lineLimit(2)

                            if selectedJumpSectionID == block.detail.id {
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
        blocks = []
        blockOrder = [:]
        prewarmedBodyText = [:]
        pendingFocusedSectionID = nil
        focusedSectionUpdateTask?.cancel()
        focusedSectionUpdateTask = nil

        let descriptors = await library.chapterBlockDescriptors(for: chapter)
        guard !descriptors.isEmpty else { return }

        blockOrder = Dictionary(
            uniqueKeysWithValues: descriptors.enumerated().map { offset, descriptor in
                (descriptor.sectionID, offset)
            }
        )

        if let selectedDescriptor = descriptors.first(where: { $0.sectionID == initialSectionID }),
           let selectedDetail = await library.loadSectionDetailAsync(sectionID: initialSectionID) {
            let selectedBlock = library.chapterReaderBlock(
                detail: selectedDetail,
                groupLabel: selectedDescriptor.groupLabel
            )
            let selectedBodyText = await library.chapterBodyNSTextAsync(for: selectedDetail)

            prewarmedBodyText = [selectedDetail.id: selectedBodyText]
            blocks = [selectedBlock]
            selectedJumpSectionID = initialSectionID
            pendingScrollSectionID = initialSectionID
            scrollIfNeeded(with: proxy, animated: false)
        }

        await prewarmVisibleSectionBodies(from: descriptors)

        var loadedBlocksByID = Dictionary(uniqueKeysWithValues: blocks.map { ($0.id, $0) })
        let remainingDescriptors = descriptors.filter { $0.sectionID != initialSectionID }

        for batch in remainingDescriptors.chunked(into: 16) {
            let details = await library.loadSectionDetailsAsync(sectionIDs: batch.map(\.sectionID))
            let detailsByID = Dictionary(uniqueKeysWithValues: details.map { ($0.id, $0) })

            for descriptor in batch {
                guard let detail = detailsByID[descriptor.sectionID] else { continue }
                loadedBlocksByID[detail.id] = library.chapterReaderBlock(
                    detail: detail,
                    groupLabel: descriptor.groupLabel
                )
            }

            blocks = orderedBlocks(from: loadedBlocksByID)
            syncVisibleSavedState()
            refreshDuplicateHeadingSet()
            await Task.yield()
        }

        blocks = orderedBlocks(from: loadedBlocksByID)
        syncVisibleSavedState()
        refreshDuplicateHeadingSet()
    }

    private func refreshDuplicateHeadingSet() {
        duplicateHeadingSectionIDs = Set(
            blocks.compactMap { isDuplicateSectionHeadingBlock($0.detail) ? $0.detail.id : nil }
        )
    }

    private func jumpToSection(id: Int64, with proxy: ScrollViewProxy) {
        selectedJumpSectionID = id
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
        from descriptors: [CodeLibraryViewModel.ChapterBlockDescriptor]
    ) async {
        let focusedIndex = descriptors.firstIndex { $0.sectionID == initialSectionID } ?? descriptors.startIndex
        let startIndex = max(descriptors.startIndex, focusedIndex - 1)
        let sectionIDs = Array(
            descriptors
                .dropFirst(startIndex)
                .prefix(prewarmedSectionCount + 2)
                .map(\.sectionID)
        )
        guard !sectionIDs.isEmpty else { return }

        let details = await library.loadSectionDetailsAsync(sectionIDs: sectionIDs)
        let detailsByID = Dictionary(uniqueKeysWithValues: details.map { ($0.id, $0) })
        let orderedDetails = sectionIDs.compactMap { detailsByID[$0] }
        guard !orderedDetails.isEmpty else { return }

        var prewarmedEntries: [Int64: NSAttributedString] = [:]
        prewarmedEntries.reserveCapacity(orderedDetails.count)

        for detail in orderedDetails {
            prewarmedEntries[detail.id] = await library.chapterBodyNSTextAsync(for: detail)
        }

        guard !prewarmedEntries.isEmpty else { return }
        prewarmedBodyText.merge(prewarmedEntries) { _, new in new }
    }

    private func orderedBlocks(
        from loadedBlocksByID: [Int64: CodeLibraryViewModel.ChapterReaderBlockContent]
    ) -> [CodeLibraryViewModel.ChapterReaderBlockContent] {
        loadedBlocksByID.values.sorted { lhs, rhs in
            let lhsOrder = blockOrder[lhs.id] ?? .max
            let rhsOrder = blockOrder[rhs.id] ?? .max
            return lhsOrder < rhsOrder
        }
    }

    private func syncVisibleSavedState() {
        visibleBookmarkedSectionIDs = Set(
            blocks.map(\.detail.id).filter { library.isBookmarked(sectionID: $0) }
        )
        visibleNotedSectionIDs = Set(
            blocks.map(\.detail.id).filter {
                !library.noteBody(sectionID: $0).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            }
        )
        visibleBookmarkedSectionNumbers = Set(
            blocks.compactMap { block in
                guard library.isBookmarked(sectionID: block.detail.id) else { return nil }
                return block.detail.sectionNumber
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
                    .uppercased()
            }
        )
    }

    private func jumpLabel(for detail: ReaderSectionDetail) -> String {
        detail.kind == .textBlock ? detail.displayTitle : "\(detail.sectionNumber) \(detail.displayTitle)"
    }

    private func jumpSheetLabel(for detail: ReaderSectionDetail) -> String {
        if detail.kind == .textBlock {
            return detail.displayTitle
        }

        let normalizedSectionNumber = detail.sectionNumber
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
        let isSectionGroup = normalizedSectionNumber.range(of: #"^\d+0\d$"#, options: .regularExpression) != nil
            && normalizedSectionNumber.count >= 3

        if isSectionGroup {
            return "Section BC \(normalizedSectionNumber): \(detail.displayTitle)"
        }
        return "\(detail.sectionNumber) \(detail.displayTitle)"
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
    let detail: ReaderSectionDetail
    let prewarmedText: NSAttributedString?
    let onOpenImage: (UIImage) -> Void
    let onContentTap: (() -> Void)?
    let onSelectionChange: ((Bool) -> Void)?

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var bodyText: NSAttributedString?

    init(
        detail: ReaderSectionDetail,
        prewarmedText: NSAttributedString? = nil,
        onOpenImage: @escaping (UIImage) -> Void,
        onContentTap: (() -> Void)? = nil,
        onSelectionChange: ((Bool) -> Void)? = nil
    ) {
        self.detail = detail
        self.prewarmedText = prewarmedText
        self.onOpenImage = onOpenImage
        self.onContentTap = onContentTap
        self.onSelectionChange = onSelectionChange
        _bodyText = State(initialValue: prewarmedText)
    }

    var body: some View {
        Group {
            if let bodyText, !bodyText.string.isEmpty {
                ContentBlockListView(
                    detail: detail,
                    fallbackText: bodyText,
                    onOpenImage: onOpenImage,
                    onContentTap: onContentTap,
                    onSelectionChange: onSelectionChange
                )
            } else if bodyText == nil {
                ProgressView()
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .task(id: ChapterBlockBodyTaskID(sectionID: detail.id, theme: library.readerTheme)) {
            let renderedText = await library.chapterBodyNSTextAsync(for: detail)
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
