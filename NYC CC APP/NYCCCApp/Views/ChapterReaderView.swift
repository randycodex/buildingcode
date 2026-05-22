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
    @State private var visibleBookmarkedSectionNumbers: Set<String> = []
    @State private var duplicateHeadingSectionIDs: Set<Int64> = []
    @State private var noteTarget: ReaderSectionDetail?
    @State private var noteBody = ""
    @State private var allowsNoteTap: Bool = false
    @State private var pendingFocusedSectionID: Int64?
    @State private var focusedSectionUpdateTask: Task<Void, Never>?
    private let chapterReaderCoordinateSpace: String = "chapterReaderScroll"
    private let chapterReaderScrollTopThreshold: CGFloat = 140
    private let focusedSectionUpdateDelay: Duration = .milliseconds(70)
    private let prewarmedSectionCount = 4
    private let indentStep: CGFloat = 26

    private var accentColor: Color {
        Color(uiColor: library.readerTheme.accentColor)
    }

    private var currentJumpLabel: String {
        if let selectedJumpSectionID,
           let block = blocks.first(where: { $0.detail.id == selectedJumpSectionID }) {
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
        .coordinateSpace(name: chapterReaderCoordinateSpace)
        .onPreferenceChange(ChapterReaderBlockOffsetPreferenceKey.self) { offsets in
            updateFocusedSection(from: offsets)
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
                    _ = library.toggleBookmark(sectionID: detail.id)
                },
                onSave: { body in
                    library.saveNote(sectionID: detail.id, body: body)
                }
            )
        }
        .task(id: chapter.id) {
            allowsNoteTap = false
            await loadBlocks(with: proxy)
            // Suppress note-open taps briefly after the chapter appears so
            // touches that originated on the source tile during the zoom
            // transition do not accidentally open the notes sheet on the
            // first visible section.
            try? await Task.sleep(nanoseconds: 400_000_000)
            allowsNoteTap = true
        }
        .onAppear {
            syncVisibleBookmarks()
        }
        .onChange(of: library.bookmarkRevision) { _, _ in
            syncVisibleBookmarks()
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

                    if block.detail.kind != .textBlock {
                        Group {
                            if isBookmarked {
                            Image(systemName: isBookmarked ? "bookmark.fill" : "bookmark")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(isBookmarked ? accentColor : .secondary)
                                .frame(width: 20, height: 20, alignment: .center)
                            }
                        }
                    }
                }

                ChapterBlockBodyView(
                    detail: block.detail,
                    prewarmedText: prewarmedBodyText[block.detail.id],
                    onOpenImage: { expandedInlineImage = $0 }
                )
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .simultaneousGesture(TapGesture().onEnded {
                guard allowsNoteTap else { return }
                openNotes(for: block.detail)
            })
            .accessibilityAddTraits(.isButton)
            .accessibilityHint("Opens notes for this section")
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
            Menu {
                let visibleBlocks = blocks.filter { !duplicateHeadingSectionIDs.contains($0.detail.id) }
                ForEach(Array(visibleBlocks.reversed())) { block in
                    Button {
                        jumpToSection(id: block.detail.id, with: proxy)
                    } label: {
                        if selectedJumpSectionID == block.detail.id {
                            Label(jumpLabel(for: block.detail), systemImage: "checkmark")
                        } else {
                            Text(jumpLabel(for: block.detail))
                        }
                    }
                }
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

        for batch in remainingDescriptors.chunked(into: 8) {
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
            syncVisibleBookmarks()
            refreshDuplicateHeadingSet()
            await Task.yield()
        }

        blocks = orderedBlocks(from: loadedBlocksByID)
        syncVisibleBookmarks()
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
        focusedSectionUpdateTask?.cancel()
        focusedSectionUpdateTask = Task {
            try? await Task.sleep(for: focusedSectionUpdateDelay)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                guard pendingFocusedSectionID == topMost, selectedJumpSectionID != topMost else { return }
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
        let sectionIDs = Array(descriptors.prefix(prewarmedSectionCount).map(\.sectionID))
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

    private func syncVisibleBookmarks() {
        visibleBookmarkedSectionIDs = Set(
            blocks.map(\.detail.id).filter { library.isBookmarked(sectionID: $0) }
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

    private func openNotes(for detail: ReaderSectionDetail) {
        noteBody = library.noteBody(sectionID: detail.id)
        noteTarget = detail
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
    let isBookmarked: Bool
    let onToggleBookmark: () -> Void
    let onSave: (String) -> Void

    @Environment(\.dismiss) private var dismiss

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
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle("Notes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        onToggleBookmark()
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
}

private struct ChapterBlockBodyView: View {
    let detail: ReaderSectionDetail
    let prewarmedText: NSAttributedString?
    let onOpenImage: (UIImage) -> Void

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var bodyText: NSAttributedString?

    init(
        detail: ReaderSectionDetail,
        prewarmedText: NSAttributedString? = nil,
        onOpenImage: @escaping (UIImage) -> Void
    ) {
        self.detail = detail
        self.prewarmedText = prewarmedText
        self.onOpenImage = onOpenImage
        _bodyText = State(initialValue: prewarmedText)
    }

    var body: some View {
        Group {
            if let bodyText, !bodyText.string.isEmpty {
                ContentBlockListView(
                    detail: detail,
                    fallbackText: bodyText,
                    onOpenImage: onOpenImage
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
