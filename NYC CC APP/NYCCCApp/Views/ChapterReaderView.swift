import SwiftUI
import UIKit

struct ChapterReaderView: View {
    let chapter: CodeChapter
    let initialSectionID: Int64

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var blocks: [CodeLibraryViewModel.ChapterReaderBlockContent] = []
    @State private var blockOrder: [Int64: Int] = [:]
    @State private var selectedJumpSectionID: Int64?
    @State private var pendingScrollSectionID: Int64?
    @State private var expandedInlineImage: UIImage?
    @State private var visibleBookmarkedSectionIDs: Set<Int64> = []
    @State private var visibleBookmarkedSectionNumbers: Set<String> = []
    @State private var noteTarget: ReaderSectionDetail?
    @State private var noteBody = ""
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
                chapterHeader

                ForEach(blocks) { block in
                    blockSection(for: block)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, 24)
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
                onSave: { body in
                    library.saveNote(sectionID: detail.id, body: body)
                }
            )
        }
        .task(id: chapter.id) {
            await loadBlocks(with: proxy)
        }
        .onAppear {
            syncVisibleBookmarks()
        }
        .onChange(of: library.bookmarkRevision) { _, _ in
            syncVisibleBookmarks()
        }
        .onChange(of: selectedJumpSectionID) { _, newValue in
            guard let newValue else { return }
            pendingScrollSectionID = newValue
            scrollIfNeeded(with: proxy, animated: true)
        }
    }

    private var chapterHeader: some View {
        VStack(spacing: 6) {
            Text(chapter.displayLabel)
                .font(.headline.weight(.semibold))
            Text(chapter.title)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .multilineTextAlignment(.center)
    }

    @ViewBuilder
    private func blockSection(for block: CodeLibraryViewModel.ChapterReaderBlockContent) -> some View {
        if isDuplicateSectionHeadingBlock(block.detail) {
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
                CodeEyebrow(text: groupLabel, accent: accentColor)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        openNotes(for: block.detail)
                    }
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
                                Image(systemName: "bookmark.fill")
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(accentColor)
                            }
                        }
                        .frame(width: 12, height: 12, alignment: .center)
                    }
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    openNotes(for: block.detail)
                }
                .accessibilityAddTraits(.isButton)
                .accessibilityHint("Opens notes for this section")

                ChapterBlockBodyView(
                    detail: block.detail,
                    onOpenImage: { expandedInlineImage = $0 }
                )
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.leading, hierarchyIndent)

            CodeHairline().padding(.top, 2)
        }
        .id(block.detail.id)
    }

    private func isDuplicateSectionHeadingBlock(_ detail: ReaderSectionDetail) -> Bool {
        guard detail.kind == .textBlock else { return false }
        let title = detail.displayTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        return title.range(of: #"^Section\s+BC\s+[A-Z]?\d+"#, options: [.regularExpression, .caseInsensitive]) != nil
    }

    @ViewBuilder
    private func jumpBar(proxy: ScrollViewProxy) -> some View {
        HStack(spacing: 10) {
            Menu {
                ForEach(blocks) { block in
                    Button(jumpLabel(for: block.detail)) {
                        selectedJumpSectionID = block.detail.id
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
                    selectedJumpSectionID = firstID
                    pendingScrollSectionID = firstID
                    scrollIfNeeded(with: proxy, animated: true)
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

        let descriptors = await library.chapterBlockDescriptors(for: chapter)
        guard !descriptors.isEmpty else { return }

        blockOrder = Dictionary(
            uniqueKeysWithValues: descriptors.enumerated().map { offset, descriptor in
                (descriptor.sectionID, offset)
            }
        )

        if let selectedDescriptor = descriptors.first(where: { $0.sectionID == initialSectionID }),
           let selectedDetail = await library.loadSectionDetailAsync(sectionID: initialSectionID) {
            blocks = [library.chapterReaderBlock(detail: selectedDetail, groupLabel: selectedDescriptor.groupLabel)]
            selectedJumpSectionID = initialSectionID
            pendingScrollSectionID = initialSectionID
            scrollIfNeeded(with: proxy, animated: false)
        }

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
            await Task.yield()
        }

        blocks = orderedBlocks(from: loadedBlocksByID)
        syncVisibleBookmarks()
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
    let onOpenImage: (UIImage) -> Void

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var bodyText: NSAttributedString?

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
        .task(id: detail.id) {
            bodyText = await library.chapterBodyNSTextAsync(for: detail)
        }
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
