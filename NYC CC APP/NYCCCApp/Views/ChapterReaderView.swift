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
        return "Jump to Section"
    }

    var body: some View {
        ScrollViewReader { proxy in
            chapterReaderContent(proxy: proxy)
        }
    }

    @ViewBuilder
    private func chapterReaderContent(proxy: ScrollViewProxy) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 24) {
                chapterHeader

                ForEach(blocks) { block in
                    blockSection(for: block)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            jumpBar(proxy: proxy)
                .background(Color(uiColor: .systemBackground))
        }
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .navigationTitle(chapter.displayLabel)
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
        .task(id: chapter.id) {
            await loadBlocks(with: proxy)
        }
        .onChange(of: selectedJumpSectionID) { _, newValue in
            guard let newValue else { return }
            pendingScrollSectionID = newValue
            scrollIfNeeded(with: proxy, animated: true)
        }
    }

    private var chapterHeader: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(chapter.displayLabel)
                .font(.title3.weight(.semibold))
            Text(chapter.title)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private func blockSection(for block: CodeLibraryViewModel.ChapterReaderBlockContent) -> some View {
        let hierarchyIndent = CGFloat(block.detail.sectionNumber.hierarchyIndentLevel) * indentStep

        return VStack(alignment: .leading, spacing: 12) {
            if let groupLabel = block.groupLabel {
                Text(groupLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(accentColor)
            }

            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    if block.detail.kind == .textBlock {
                        Text(block.detail.displayTitle)
                            .font(.headline.weight(.semibold))
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
                }

                ChapterBlockBodyView(
                    detail: block.detail,
                    onOpenImage: { expandedInlineImage = $0 }
                )
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.leading, hierarchyIndent)

            Divider()
        }
        .id(block.detail.id)
    }

    @ViewBuilder
    private func jumpBar(proxy: ScrollViewProxy) -> some View {
        HStack(spacing: 12) {
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
                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.semibold))
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color(uiColor: .secondarySystemBackground))
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
                    .font(.headline)
            }
            .buttonStyle(.bordered)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 10)
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
            await Task.yield()
        }

        blocks = orderedBlocks(from: loadedBlocksByID)
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

    private func jumpLabel(for detail: ReaderSectionDetail) -> String {
        detail.kind == .textBlock ? detail.displayTitle : "\(detail.sectionNumber) \(detail.displayTitle)"
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
