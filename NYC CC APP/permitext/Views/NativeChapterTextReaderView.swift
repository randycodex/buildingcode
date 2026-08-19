import SwiftUI
import UIKit

struct NativeChapterTextReaderView: View {
    let chapter: CodeChapter
    let initialSectionID: Int64
    let initialSectionNumber: String
    let initialAnchorID: String?
    let route: NativeReaderDocumentRoute
    var rememberedSectionID: Binding<Int64?> = .constant(nil)
    var rememberedBlockID: Binding<String?> = .constant(nil)
    var rememberedAnchorID: Binding<String?> = .constant(nil)
    var onFallbackToHTML: ((String) -> Void)?
    var onOpenReference: ((CodeSectionSummary) -> Void)?

    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.openURL) private var openURL
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var document: NativeReaderRuntimeDocument?
    @State private var displayBlocks: [NativeReaderDisplayBlock] = []
    @State private var sectionTargets: [NativeReaderSectionTarget] = []
    @State private var visibleBlockID: String?
    @State private var currentSectionTargetID: String?
    @State private var pendingInitialBlockID: String?
    @State private var failureMessage: String?
    @State private var hasRequestedFallback = false
    @State private var expandedMedia: NativeReaderExpandedMedia?
    @State private var isJumpPickerPresented = false
    @State private var isSearchPresented = false
    @State private var searchQuery = ""
    @State private var searchMatches: [NativeReaderSearchMatch] = []
    @State private var activeSearchMatchID: String?
    @State private var lastRecordedSectionTargetID: String?

    private var accentColor: Color {
        Color(uiColor: library.accentColor(for: chapter.codeSectionID))
    }

    var body: some View {
        ScrollViewReader { proxy in
            Group {
                if let document {
                    reader(document: document, proxy: proxy)
                } else if let failureMessage {
                    failureView(message: failureMessage)
                } else {
                    ProgressView("Preparing native Reader…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .task(id: route.id) {
                await loadDocument()
            }
        }
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .fullScreenCover(item: $expandedMedia) { media in
            ZoomableImageViewer(image: media.image, accessibilityText: media.accessibilityText)
        }
    }

    private func reader(
        document: NativeReaderRuntimeDocument,
        proxy: ScrollViewProxy
    ) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(displayBlocks) { displayBlock in
                    NativeReaderTextBlockView(
                        block: displayBlock.block,
                        hierarchyIndentation: displayBlock.hierarchyIndentation,
                        usesCompactSpacing: displayBlock.usesCompactSpacing,
                        theme: library.readerTheme,
                        accentColor: library.accentColor(for: chapter.codeSectionID),
                        route: route,
                        onOpenLink: { url in
                            handleLink(url, document: document, proxy: proxy)
                        },
                        onOpenMedia: { media, image in
                            expandedMedia = NativeReaderExpandedMedia(
                                id: media.id,
                                image: image,
                                accessibilityText: media.accessibilityText ?? media.caption
                            )
                        },
                        onMediaFailure: { message in
                            requestFallbackToHTML(message)
                        },
                        searchQuery: searchQuery,
                        searchMatches: searchMatches.filter { $0.blockID == displayBlock.id },
                        activeSearchMatchID: activeSearchMatchID,
                        onResearchSelection: { selectedText in
                            sendSelectionToResearch(
                                selectedText,
                                sourceBlockID: displayBlock.sourceBlockID,
                                document: document
                            )
                        }
                    )
                    .id(displayBlock.id)
                }
            }
            .padding(.horizontal, CodeScreenMetrics.readerHorizontalPadding)
            .padding(.top, CodeScreenMetrics.topTitlePadding)
            .padding(.bottom, 28)
            .scrollTargetLayout()
        }
        .scrollPosition(id: $visibleBlockID, anchor: .top)
        .onChange(of: visibleBlockID) { _, newValue in
            guard pendingInitialBlockID == nil else { return }
            persistLocation(blockID: newValue, document: document)
        }
        .onChange(of: searchQuery) { _, query in
            searchMatches = NativeReaderSearchIndex.matches(query: query, in: displayBlocks)
            if !searchMatches.contains(where: { $0.id == activeSearchMatchID }) {
                activeSearchMatchID = searchMatches.first?.id
            }
        }
        .task(id: pendingInitialBlockID) {
            await restoreInitialPosition(document: document, proxy: proxy)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: 0) {
                if !searchMatches.isEmpty {
                    searchNavigator(proxy: proxy, document: document)
                }
                jumpBar
            }
            .background(Color(uiColor: .systemGroupedBackground))
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    isSearchPresented = true
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
        }
        .sheet(isPresented: $isJumpPickerPresented) {
            jumpPicker(proxy: proxy, document: document)
        }
        .fullScreenCover(isPresented: $isSearchPresented) {
            NativeReaderSearchSheet(
                title: chapter.displayLabel,
                blocks: displayBlocks,
                query: $searchQuery,
                activeMatchID: activeSearchMatchID,
                onSelect: { match in
                    activateSearchMatch(match, proxy: proxy, document: document)
                }
            )
        }
        .overlay(alignment: .top) {
            CodeTopContentFade(alwaysVisible: true)
        }
    }

    private func failureView(message: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Using HTML reader", systemImage: "arrow.uturn.backward.circle.fill")
                .font(.headline)
                .foregroundStyle(accentColor)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(24)
    }

    @MainActor
    private func loadDocument() async {
        document = nil
        displayBlocks = []
        sectionTargets = []
        pendingInitialBlockID = nil
        visibleBlockID = nil
        currentSectionTargetID = nil
        failureMessage = nil
        hasRequestedFallback = false
        expandedMedia = nil
        searchQuery = ""
        searchMatches = []
        activeSearchMatchID = nil
        lastRecordedSectionTargetID = nil

        do {
            let loaded = try await NativeReaderDocumentStore.shared.loadDocument(for: route)
            guard !Task.isCancelled else { return }
            let initialBlockID = NativeReaderLocationResolver.initialBlockID(
                in: loaded,
                rememberedBlockID: rememberedBlockID.wrappedValue,
                rememberedAnchorID: rememberedAnchorID.wrappedValue,
                initialAnchorID: initialAnchorID,
                initialSectionNumber: initialSectionNumber
            )
            let loadedDisplayBlocks = NativeReaderDisplayBlock.blocks(from: loaded.blocks)
            displayBlocks = loadedDisplayBlocks
            sectionTargets = NativeReaderSectionNavigator.targets(
                in: loaded,
                displayBlocks: loadedDisplayBlocks
            )
            document = loaded
            persistLocation(blockID: initialBlockID, document: loaded)
            guard initialBlockID != loaded.blocks.first?.id else {
                return
            }
            pendingInitialBlockID = initialBlockID
        } catch {
            guard !Task.isCancelled else { return }
            requestFallbackToHTML(error.localizedDescription)
        }
    }

    @MainActor
    private func requestFallbackToHTML(_ message: String) {
        failureMessage = message
        guard !hasRequestedFallback else { return }
        hasRequestedFallback = true
        onFallbackToHTML?(message)
    }

    @MainActor
    private func restoreInitialPosition(
        document: NativeReaderRuntimeDocument,
        proxy: ScrollViewProxy
    ) async {
        guard let targetBlockID = pendingInitialBlockID else { return }

        // The lazy stack is inserted only after the document finishes loading.
        // Give SwiftUI a layout pass before asking its proxy for an off-screen
        // target, then repeat once for slower physical-device layout.
        await Task.yield()
        try? await Task.sleep(for: .milliseconds(60))
        guard !Task.isCancelled, pendingInitialBlockID == targetBlockID else { return }
        visibleBlockID = targetBlockID
        proxy.scrollTo(targetBlockID, anchor: .top)

        try? await Task.sleep(for: .milliseconds(120))
        guard !Task.isCancelled, pendingInitialBlockID == targetBlockID else { return }
        proxy.scrollTo(targetBlockID, anchor: .top)
        pendingInitialBlockID = nil
        persistLocation(blockID: targetBlockID, document: document)
    }

    private func persistLocation(blockID: String?, document: NativeReaderRuntimeDocument) {
        guard let blockID,
              NativeReaderDisplayBlock.sourceBlockID(for: blockID, in: document) != nil
        else {
            return
        }
        if rememberedBlockID.wrappedValue != blockID {
            rememberedBlockID.wrappedValue = blockID
        }
        if let anchorID = NativeReaderLocationResolver.anchorID(for: blockID, in: document),
           rememberedAnchorID.wrappedValue != anchorID {
            rememberedAnchorID.wrappedValue = anchorID
        }
        updateCurrentSection(blockID: blockID, document: document)
    }

    private func handleLink(
        _ url: URL,
        document: NativeReaderRuntimeDocument,
        proxy: ScrollViewProxy
    ) {
        if let fragment = url.fragment?.removingPercentEncoding,
           let blockID = NativeReaderLocationResolver.blockID(forAnchorID: fragment, in: document) {
            scroll(to: blockID, proxy: proxy, document: document)
            return
        }
        if let reference = NativeReaderLinkResolver.reference(for: url),
           let destination = resolvedReference(reference) {
            onOpenReference?(destination)
            return
        }
        guard url.scheme != nil else { return }
        openURL(url)
    }

    private var currentSectionTarget: NativeReaderSectionTarget? {
        sectionTargets.first(where: { $0.id == currentSectionTargetID }) ?? sectionTargets.first
    }

    private var jumpBar: some View {
        HStack(spacing: 10) {
            Button {
                isJumpPickerPresented = true
            } label: {
                HStack(spacing: 8) {
                    Text(currentSectionTarget?.menuLabel ?? chapter.displayLabel)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: "chevron.down")
                        .font(.caption2.weight(.semibold))
                }
                .font(.subheadline.weight(.medium))
                .foregroundStyle(accentColor)
                .padding(.horizontal, 12)
                .padding(.vertical, 11)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(sectionTargets.isEmpty)
            .accessibilityLabel("Jump within chapter")
            .accessibilityValue(currentSectionTarget?.menuLabel ?? chapter.displayLabel)

            ReaderCurrentSectionBookmarkButton(
                sectionID: currentSectionTarget.flatMap(sectionSummary(for:))?.id
                    ?? rememberedSectionID.wrappedValue
                    ?? initialSectionID,
                accentColor: accentColor
            )
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
        .padding(.bottom, 8)
    }

    private func jumpPicker(
        proxy: ScrollViewProxy,
        document: NativeReaderRuntimeDocument
    ) -> some View {
        NavigationStack {
            List(sectionTargets) { target in
                Button {
                    isJumpPickerPresented = false
                    scroll(to: target.blockID, proxy: proxy, document: document)
                } label: {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Image(systemName: target.id == currentSectionTargetID ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(target.id == currentSectionTargetID ? accentColor : .secondary)
                            .accessibilityHidden(true)
                        Text(target.menuLabel)
                            .font(target.level <= 2 ? .body.weight(.semibold) : .callout.weight(.medium))
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.leading)
                    }
                    .padding(.leading, target.menuIndent)
                    .padding(.vertical, target.level <= 2 ? 6 : 3)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(target.menuLabel)
                .accessibilityValue(target.id == currentSectionTargetID ? "Current section" : "")
            }
            .navigationTitle("Jump within chapter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { isJumpPickerPresented = false }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func searchNavigator(
        proxy: ScrollViewProxy,
        document: NativeReaderRuntimeDocument
    ) -> some View {
        let activeIndex = searchMatches.firstIndex(where: { $0.id == activeSearchMatchID }) ?? 0
        return HStack(spacing: 14) {
            Button {
                activateSearchMatch(
                    searchMatches[(activeIndex - 1 + searchMatches.count) % searchMatches.count],
                    proxy: proxy,
                    document: document
                )
            } label: {
                Image(systemName: "chevron.up")
            }
            .accessibilityLabel("Previous match")

            Text("\(activeIndex + 1) of \(searchMatches.count)")
                .font(.subheadline.monospacedDigit().weight(.semibold))
                .frame(maxWidth: .infinity)
                .accessibilityLabel("Search match \(activeIndex + 1) of \(searchMatches.count)")

            Button {
                activateSearchMatch(
                    searchMatches[(activeIndex + 1) % searchMatches.count],
                    proxy: proxy,
                    document: document
                )
            } label: {
                Image(systemName: "chevron.down")
            }
            .accessibilityLabel("Next match")

            Button {
                searchQuery = ""
                searchMatches = []
                activeSearchMatchID = nil
            } label: {
                Image(systemName: "xmark")
            }
            .accessibilityLabel("Clear chapter search")
        }
        .font(.body.weight(.semibold))
        .foregroundStyle(accentColor)
        .padding(.horizontal, 22)
        .padding(.vertical, 10)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
    }

    private func activateSearchMatch(
        _ match: NativeReaderSearchMatch,
        proxy: ScrollViewProxy,
        document: NativeReaderRuntimeDocument
    ) {
        activeSearchMatchID = match.id
        scroll(to: match.blockID, proxy: proxy, document: document)
    }

    private func scroll(
        to blockID: String,
        proxy: ScrollViewProxy,
        document: NativeReaderRuntimeDocument
    ) {
        visibleBlockID = blockID
        persistLocation(blockID: blockID, document: document)
        if reduceMotion {
            proxy.scrollTo(blockID, anchor: .top)
        } else {
            withAnimation(.easeInOut(duration: 0.2)) {
                proxy.scrollTo(blockID, anchor: .top)
            }
        }
    }

    private func updateCurrentSection(
        blockID: String,
        document: NativeReaderRuntimeDocument
    ) {
        guard let target = NativeReaderSectionNavigator.target(
            forDisplayBlockID: blockID,
            in: document,
            targets: sectionTargets
        ) else { return }
        if currentSectionTargetID != target.id {
            currentSectionTargetID = target.id
        }

        if let summary = sectionSummary(for: target),
           rememberedSectionID.wrappedValue != summary.id {
            rememberedSectionID.wrappedValue = summary.id
        }
        guard lastRecordedSectionTargetID != target.id else { return }
        lastRecordedSectionTargetID = target.id
        if let sectionNumber = target.sectionNumber, !sectionNumber.isEmpty {
            library.noteSectionOpened(
                anchor: PublishedHTMLAnchor(
                    sectionNumber: sectionNumber,
                    title: target.title,
                    anchorID: target.anchorID ?? target.blockID,
                    level: target.level
                ),
                chapter: chapter
            )
        }
    }

    private func sendSelectionToResearch(
        _ selectedText: String,
        sourceBlockID: String,
        document: NativeReaderRuntimeDocument
    ) {
        let normalized = selectedText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return }
        let target = NativeReaderSectionNavigator.target(
            forSourceBlockID: sourceBlockID,
            in: document,
            targets: sectionTargets
        )
        let sectionID = target.flatMap(sectionSummary(for:))?.id
            ?? rememberedSectionID.wrappedValue
            ?? initialSectionID
        library.sendToResearch(
            ResearchSelectionRequest(
                sectionID: String(sectionID),
                selectedText: normalized
            )
        )
    }

    private func sectionSummary(for target: NativeReaderSectionTarget) -> CodeSectionSummary? {
        guard let sectionNumber = target.sectionNumber else { return nil }
        return library.sectionSummary(
            sectionNumber: sectionNumber,
            codeSectionID: chapter.codeSectionID
        )
    }

    private func resolvedReference(_ reference: NativeReaderReference) -> CodeSectionSummary? {
        let targetCodeSectionID = reference.codePrefix
            .flatMap(codeSectionID(for:))
            ?? chapter.codeSectionID

        switch reference.kind {
        case .section:
            for candidate in reference.sectionNumberCandidates {
                if let section = library.sectionSummary(
                    sectionNumber: candidate,
                    codeSectionID: targetCodeSectionID
                ) {
                    return section
                }
            }
            return nil
        case .chapter, .appendix:
            guard let targetCodeSectionID,
                  let targetChapter = library.chapters(for: targetCodeSectionID).first(where: {
                      $0.chapterNumber.caseInsensitiveCompare(reference.token) == .orderedSame
                  }) else { return nil }
            return library.sections(for: targetChapter).first
        }
    }

    private func codeSectionID(for prefix: String) -> Int64? {
        let normalizedPrefix = prefix.uppercased()
        return library.codeSections.first { codeSection in
            let name = codeSection.name.lowercased()
            switch normalizedPrefix {
            case "BC": return name.contains("building") && !name.contains("existing")
            case "EBC": return name.contains("existing building")
            case "PC": return name.contains("plumbing")
            case "MC": return name.contains("mechanical")
            case "FGC": return name.contains("fuel gas")
            case "AC": return name.contains("administrative")
            case "FC": return name.contains("fire code")
            case "ZR": return name.contains("zoning")
            default: return false
            }
        }?.id
    }
}

private struct NativeReaderExpandedMedia: Identifiable {
    let id: String
    let image: UIImage
    let accessibilityText: String?
}

struct NativeReaderDisplayBlock: Identifiable, Equatable {
    let id: String
    let sourceBlockID: String
    let block: NativeReaderRuntimeBlock
    let hierarchyIndentation: CGFloat
    let usesCompactSpacing: Bool

    static func blocks(from blocks: [NativeReaderRuntimeBlock]) -> [NativeReaderDisplayBlock] {
        var currentIndentation: CGFloat = 0
        return blocks.flatMap { block in
            if block.kind == .heading {
                currentIndentation = NativeReaderHeadingPresentation(block: block).indentation
            }
            let expandedBlocks = provisionDisplayBlocks(from: block)
            return expandedBlocks.map { expandedBlock in
                NativeReaderDisplayBlock(
                    id: expandedBlock.block.id,
                    sourceBlockID: block.id,
                    block: expandedBlock.block,
                    hierarchyIndentation: currentIndentation,
                    usesCompactSpacing: expandedBlock.usesCompactSpacing
                )
            }
        }
    }

    static func sourceBlockID(
        for displayBlockID: String,
        in document: NativeReaderRuntimeDocument
    ) -> String? {
        document.blocks.first(where: { block in
            displayBlockID == block.id || displayBlockID.hasPrefix(block.id + "::segment-")
        })?.id
    }

    private static func provisionDisplayBlocks(
        from block: NativeReaderRuntimeBlock
    ) -> [(block: NativeReaderRuntimeBlock, usesCompactSpacing: Bool)] {
        guard block.kind == .paragraph else {
            return [(block, false)]
        }

        let sourceRuns = block.runs.isEmpty
            ? [NativeReaderRuntimeTextRun(text: block.plainText, styles: [], linkTarget: nil)]
            : block.runs
        let lines = textLines(from: sourceRuns)
        guard lines.filter({ isProvisionLine(text(from: $0)) }).count >= 2 else {
            return [(block, false)]
        }

        var segments: [[NativeReaderRuntimeTextRun]] = []
        var currentSegment: [NativeReaderRuntimeTextRun] = []
        for line in lines {
            if isProvisionLine(text(from: line)), !currentSegment.isEmpty {
                segments.append(currentSegment)
                currentSegment = []
            }
            if !currentSegment.isEmpty {
                currentSegment.append(
                    NativeReaderRuntimeTextRun(text: "\n", styles: [], linkTarget: nil)
                )
            }
            currentSegment.append(contentsOf: line)
        }
        if !currentSegment.isEmpty {
            segments.append(currentSegment)
        }

        return segments.enumerated().map { index, runs in
            let displayID = index == 0 ? block.id : block.id + "::segment-" + String(index)
            return (
                NativeReaderRuntimeBlock(
                    id: displayID,
                    kind: block.kind,
                    sourceOrder: block.sourceOrder,
                    sectionID: block.sectionID,
                    anchorIDs: block.anchorIDs,
                    plainText: text(from: runs),
                    runs: runs,
                    headingLevel: block.headingLevel,
                    listItems: block.listItems
                ),
                true
            )
        }
    }

    private static func textLines(
        from runs: [NativeReaderRuntimeTextRun]
    ) -> [[NativeReaderRuntimeTextRun]] {
        var lines: [[NativeReaderRuntimeTextRun]] = [[]]
        for run in runs {
            let fragments = run.text.split(separator: "\n", omittingEmptySubsequences: false)
            for (index, fragment) in fragments.enumerated() {
                if index > 0 {
                    lines.append([])
                }
                guard !fragment.isEmpty else { continue }
                lines[lines.count - 1].append(
                    NativeReaderRuntimeTextRun(
                        text: String(fragment),
                        styles: run.styles,
                        linkTarget: run.linkTarget
                    )
                )
            }
        }
        return lines.filter { !text(from: $0).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    private static func text(from runs: [NativeReaderRuntimeTextRun]) -> String {
        runs.map(\.text).joined()
    }

    private static func isProvisionLine(_ text: String) -> Bool {
        guard let token = text
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(whereSeparator: { $0.isWhitespace })
            .first
        else {
            return false
        }
        let number = token.trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
        let components = number.split(separator: ".")
        return components.count >= 2
            && components.first?.count == 3
            && components.allSatisfy { !$0.isEmpty && $0.allSatisfy(\.isNumber) }
    }
}

struct NativeReaderSectionTarget: Identifiable, Hashable {
    let id: String
    let blockID: String
    let sourceBlockID: String
    let sourceOrder: Int
    let sectionNumber: String?
    let title: String
    let anchorID: String?
    let level: Int

    var menuLabel: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var menuIndent: CGFloat {
        CGFloat(min(max(level - 2, 0), 3)) * 14
    }
}

enum NativeReaderSectionNavigator {
    static func targets(
        in document: NativeReaderRuntimeDocument,
        displayBlocks: [NativeReaderDisplayBlock]
    ) -> [NativeReaderSectionTarget] {
        let displayIDBySourceID = Dictionary(
            displayBlocks.map { ($0.sourceBlockID, $0.id) },
            uniquingKeysWith: { first, _ in first }
        )
        let headingTargets = document.blocks.compactMap { block -> NativeReaderSectionTarget? in
            guard block.kind == .heading,
                  let displayBlockID = displayIDBySourceID[block.id] else { return nil }
            let anchor = block.anchorIDs.first
                ?? document.anchors.first(where: { $0.blockID == block.id })?.id
            return NativeReaderSectionTarget(
                id: block.id,
                blockID: displayBlockID,
                sourceBlockID: block.id,
                sourceOrder: block.sourceOrder,
                sectionNumber: sectionNumber(from: block.plainText, anchorID: anchor),
                title: block.plainText,
                anchorID: anchor,
                level: min(max(block.headingLevel ?? 3, 1), 6)
            )
        }
        guard headingTargets.isEmpty,
              let firstDisplayBlock = displayBlocks.first,
              let firstSourceBlock = document.blocks.first else {
            return headingTargets
        }
        return [
            NativeReaderSectionTarget(
                id: firstSourceBlock.id,
                blockID: firstDisplayBlock.id,
                sourceBlockID: firstSourceBlock.id,
                sourceOrder: firstSourceBlock.sourceOrder,
                sectionNumber: document.metadata.chapterNumber,
                title: document.metadata.chapterTitle ?? document.metadata.chapterIdentifier,
                anchorID: document.anchors.first?.id,
                level: 1
            )
        ]
    }

    static func target(
        forDisplayBlockID blockID: String,
        in document: NativeReaderRuntimeDocument,
        targets: [NativeReaderSectionTarget]
    ) -> NativeReaderSectionTarget? {
        guard let sourceBlockID = NativeReaderDisplayBlock.sourceBlockID(for: blockID, in: document) else {
            return nil
        }
        return target(forSourceBlockID: sourceBlockID, in: document, targets: targets)
    }

    static func target(
        forSourceBlockID sourceBlockID: String,
        in document: NativeReaderRuntimeDocument,
        targets: [NativeReaderSectionTarget]
    ) -> NativeReaderSectionTarget? {
        guard let sourceOrder = document.blocks.first(where: { $0.id == sourceBlockID })?.sourceOrder else {
            return nil
        }
        return targets.last(where: { $0.sourceOrder <= sourceOrder }) ?? targets.first
    }

    static func sectionNumber(from heading: String, anchorID: String?) -> String? {
        let headingPattern = #"(?i)^\s*(?:(?:SECTION|ARTICLE|PART)\s+)?(?:(?:EBC|FGC|BC|PC|MC|AC|FC|ZR)\s+)?([A-Z]?\d+(?:[.\-]\d+)*(?:\([A-Za-z0-9]+\))?)\b"#
        if let token = firstCapture(in: heading, pattern: headingPattern) {
            return token.uppercased()
        }
        if let anchorID,
           let referenceURL = NativeReaderLinkResolver.fragmentURL(anchorID),
           let reference = NativeReaderLinkResolver.reference(for: referenceURL),
           reference.kind == .section {
            return reference.token
        }
        return nil
    }

    private static func firstCapture(in value: String, pattern: String) -> String? {
        guard let expression = try? NSRegularExpression(pattern: pattern),
              let match = expression.firstMatch(
                  in: value,
                  range: NSRange(location: 0, length: value.utf16.count)
              ),
              let range = Range(match.range(at: 1), in: value) else { return nil }
        return String(value[range])
    }
}

struct NativeReaderSearchMatch: Identifiable, Hashable {
    let id: String
    let blockID: String
    let sourceBlockID: String
    let range: NSRange
    let snippet: String
}

enum NativeReaderSearchIndex {
    static func matches(
        query: String,
        in blocks: [NativeReaderDisplayBlock]
    ) -> [NativeReaderSearchMatch] {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedQuery.isEmpty else { return [] }

        return blocks.flatMap { displayBlock in
            let searchableText = searchableText(for: displayBlock.block)
            return ranges(of: normalizedQuery, in: searchableText).map { range in
                NativeReaderSearchMatch(
                    id: "\(displayBlock.id):\(range.location):\(range.length)",
                    blockID: displayBlock.id,
                    sourceBlockID: displayBlock.sourceBlockID,
                    range: range,
                    snippet: snippet(in: searchableText, around: range)
                )
            }
        }
    }

    static func ranges(of query: String, in text: String) -> [NSRange] {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let source = text as NSString
        guard !normalizedQuery.isEmpty, source.length > 0 else { return [] }

        var ranges: [NSRange] = []
        var searchRange = NSRange(location: 0, length: source.length)
        while searchRange.length > 0 {
            let match = source.range(
                of: normalizedQuery,
                options: [.caseInsensitive, .diacriticInsensitive],
                range: searchRange
            )
            guard match.location != NSNotFound, match.length > 0 else { break }
            ranges.append(match)
            let nextLocation = match.location + match.length
            guard nextLocation < source.length else { break }
            searchRange = NSRange(location: nextLocation, length: source.length - nextLocation)
        }
        return ranges
    }

    static func searchableText(for block: NativeReaderRuntimeBlock) -> String {
        switch block.kind {
        case .orderedList, .unorderedList:
            return block.listItems.flatMap(flatten).map(\.plainText).joined(separator: "\n")
        case .table:
            guard let table = block.table else { return block.plainText }
            return ([table.caption].compactMap { $0 }
                + table.cells.map(\.plainText)
                + table.footnotes)
                .joined(separator: "\n")
        case .image, .figure:
            return (block.media.flatMap { [$0.accessibilityText, $0.caption].compactMap { $0 } }
                + [block.caption].compactMap { $0 })
                .joined(separator: "\n")
        default:
            return block.plainText
        }
    }

    private static func flatten(_ item: NativeReaderRuntimeListItem) -> [NativeReaderRuntimeListItem] {
        [item] + item.children.flatMap(flatten)
    }

    private static func snippet(in text: String, around range: NSRange) -> String {
        let source = text as NSString
        let start = max(0, range.location - 48)
        let end = min(source.length, range.location + range.length + 72)
        let fragment = source.substring(with: NSRange(location: start, length: end - start))
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return "\(start > 0 ? "…" : "")\(fragment)\(end < source.length ? "…" : "")"
    }
}

private struct NativeReaderSearchSheet: View {
    let title: String
    let blocks: [NativeReaderDisplayBlock]
    @Binding var query: String
    let activeMatchID: String?
    let onSelect: (NativeReaderSearchMatch) -> Void

    @Environment(\.dismiss) private var dismiss
    @FocusState private var isSearchFocused: Bool

    private var matches: [NativeReaderSearchMatch] {
        NativeReaderSearchIndex.matches(query: query, in: blocks)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(.secondary)
                    TextField("Search this chapter", text: $query)
                        .font(.title3)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.search)
                        .focused($isSearchFocused)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color(uiColor: .secondarySystemBackground))
                .clipShape(Capsule(style: .continuous))

                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.title2.weight(.medium))
                        .frame(width: 54, height: 54)
                        .background(Color(uiColor: .secondarySystemBackground))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close search")
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 14)

            Divider()

            if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                ContentUnavailableView(
                    "Search \(title)",
                    systemImage: "text.page.badge.magnifyingglass",
                    description: Text("Enter enacted text, a section number, or a phrase.")
                )
            } else if matches.isEmpty {
                ContentUnavailableView.search(text: query)
            } else {
                List(matches) { match in
                    Button {
                        onSelect(match)
                        dismiss()
                    } label: {
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: match.id == activeMatchID ? "checkmark.circle.fill" : "text.magnifyingglass")
                                .foregroundStyle(match.id == activeMatchID ? Color.accentColor : Color.secondary)
                            Text(match.snippet)
                                .font(.body)
                                .foregroundStyle(.primary)
                                .multilineTextAlignment(.leading)
                        }
                        .padding(.vertical, 4)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(match.snippet)
                    .accessibilityValue(match.id == activeMatchID ? "Current match" : "")
                }
                .listStyle(.plain)
            }
        }
        .background(Color(uiColor: .systemBackground))
        .onAppear { isSearchFocused = true }
    }
}

enum NativeReaderReferenceKind: String, Hashable {
    case section
    case chapter
    case appendix
}

struct NativeReaderReference: Hashable {
    let kind: NativeReaderReferenceKind
    let codePrefix: String?
    let token: String

    var sectionNumberCandidates: [String] {
        guard kind == .section else { return [] }
        var candidates = [token]
        let withoutParenthetical = token.replacingOccurrences(
            of: #"\([^)]*\)$"#,
            with: "",
            options: .regularExpression
        )
        if withoutParenthetical != token {
            candidates.append(withoutParenthetical)
        }
        return candidates
    }
}

enum NativeReaderLinkResolver {
    private static let hashExpression = try! NSRegularExpression(
        pattern: #"(?i)hash\s*:\s*['\"]#([^'\"]+)"#
    )

    static func linkURL(for rawTarget: String) -> URL? {
        let target = rawTarget
            .replacingOccurrences(of: "&amp;", with: "&")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !target.isEmpty else { return nil }
        let range = NSRange(location: 0, length: target.utf16.count)
        if let match = hashExpression.firstMatch(in: target, range: range),
           let fragmentRange = Range(match.range(at: 1), in: target) {
            return fragmentURL(String(target[fragmentRange]))
        }
        return URL(string: target)
    }

    static func fragmentURL(_ fragment: String) -> URL? {
        var components = URLComponents()
        components.fragment = fragment.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        return components.url
    }

    static func reference(for url: URL) -> NativeReaderReference? {
        guard var fragment = url.fragment?.removingPercentEncoding,
              !fragment.isEmpty else { return nil }
        fragment = fragment.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        if fragment.uppercased().hasPrefix("JD_") {
            fragment.removeFirst(3)
        }

        var codePrefix: String?
        for prefix in ["FGC", "EBC", "BC", "PC", "MC", "AC", "FC", "ZR"] {
            if fragment.uppercased().hasPrefix(prefix) {
                codePrefix = prefix
                fragment.removeFirst(prefix.count)
                break
            }
        }
        if codePrefix == nil, fragment.hasPrefix("28-") {
            codePrefix = "AC"
        }

        if let token = firstCapture(in: fragment, pattern: #"(?i)^(?:CH(?:APTER)?\.?)\s*([A-Z0-9-]+)"#) {
            return NativeReaderReference(kind: .chapter, codePrefix: codePrefix, token: token.uppercased())
        }
        if let token = firstCapture(in: fragment, pattern: #"(?i)^APP(?:ENDIX)?\.?\s*([A-Z0-9-]+)"#) {
            return NativeReaderReference(kind: .appendix, codePrefix: codePrefix, token: token.uppercased())
        }

        let stripped = fragment.replacingOccurrences(
            of: #"(?i)^(?:TABLE|FIGURE|SECTION)\s*"#,
            with: "",
            options: .regularExpression
        )
        guard let token = firstCapture(
            in: stripped,
            pattern: #"^([A-Z]?\d+(?:[.\-]\d+)*(?:\([A-Za-z0-9]+\))?)"#
        ) else { return nil }
        return NativeReaderReference(
            kind: .section,
            codePrefix: codePrefix,
            token: token.uppercased()
        )
    }

    private static func firstCapture(in value: String, pattern: String) -> String? {
        guard let expression = try? NSRegularExpression(pattern: pattern),
              let match = expression.firstMatch(
                  in: value,
                  range: NSRange(location: 0, length: value.utf16.count)
              ),
              let range = Range(match.range(at: 1), in: value) else { return nil }
        return String(value[range])
    }
}

enum NativeReaderLocationResolver {
    static func initialBlockID(
        in document: NativeReaderRuntimeDocument,
        rememberedBlockID: String?,
        rememberedAnchorID: String?,
        initialAnchorID: String?,
        initialSectionNumber: String
    ) -> String? {
        if let rememberedBlockID,
           NativeReaderDisplayBlock.blocks(from: document.blocks)
               .contains(where: { $0.id == rememberedBlockID }) {
            return rememberedBlockID
        }
        for anchorID in [rememberedAnchorID, initialAnchorID].compactMap({ $0 }) {
            if let blockID = blockID(forAnchorID: anchorID, in: document) {
                return blockID
            }
        }

        let normalizedSection = normalizedSectionNumber(initialSectionNumber)
        if !normalizedSection.isEmpty,
           let heading = document.blocks.first(where: { block in
               guard block.kind == .heading else { return false }
               let normalizedHeading = normalizedSectionNumber(block.plainText)
               return normalizedHeading == normalizedSection
                   || normalizedHeading.hasPrefix(normalizedSection + " ")
                   || normalizedHeading.contains(" " + normalizedSection + " ")
           }) {
            return heading.id
        }
        return document.blocks.first?.id
    }

    static func blockID(
        forAnchorID anchorID: String,
        in document: NativeReaderRuntimeDocument
    ) -> String? {
        let normalizedAnchor = anchorID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedAnchor.isEmpty else { return nil }
        if let mapped = document.anchors.first(where: { $0.id == normalizedAnchor })?.blockID,
           document.blocks.contains(where: { $0.id == mapped }) {
            return mapped
        }
        return document.blocks.first(where: {
            $0.sectionID == normalizedAnchor || $0.anchorIDs.contains(normalizedAnchor)
        })?.id
    }

    static func anchorID(
        for blockID: String,
        in document: NativeReaderRuntimeDocument
    ) -> String? {
        let sourceBlockID = NativeReaderDisplayBlock.sourceBlockID(for: blockID, in: document)
        if let block = document.blocks.first(where: { $0.id == sourceBlockID }) {
            if let anchorID = block.anchorIDs.first {
                return anchorID
            }
            if let sectionID = block.sectionID {
                return sectionID
            }
        }
        return document.anchors.first(where: { $0.blockID == sourceBlockID })?.id
    }

    private static func normalizedSectionNumber(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .uppercased()
    }
}

private struct NativeReaderTextBlockView: View {
    let block: NativeReaderRuntimeBlock
    let hierarchyIndentation: CGFloat
    let usesCompactSpacing: Bool
    let theme: ReaderTheme
    let accentColor: UIColor
    let route: NativeReaderDocumentRoute
    let onOpenLink: (URL) -> Void
    let onOpenMedia: (NativeReaderRuntimeMedia, UIImage) -> Void
    let onMediaFailure: (String) -> Void
    let searchQuery: String
    let searchMatches: [NativeReaderSearchMatch]
    let activeSearchMatchID: String?
    let onResearchSelection: (String) -> Void

    var body: some View {
        Group {
            switch block.kind {
            case .heading:
                heading
            case .paragraph:
                selectableText(role: .body)
            case .orderedList, .unorderedList:
                NativeReaderListBlockView(
                    items: block.listItems,
                    ordered: block.kind == .orderedList,
                    theme: theme,
                    accentColor: accentColor,
                    onOpenLink: onOpenLink,
                    searchQuery: searchQuery,
                    onResearchSelection: onResearchSelection
                )
            case .caption:
                selectableText(role: .caption)
            case .footnote:
                selectableText(role: .footnote)
            case .sourceNote, .editorNote:
                selectableText(role: .note)
                    .padding(12)
                    .background(Color(uiColor: accentColor).opacity(0.09))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            case .divider:
                Divider()
            case .image, .figure:
                NativeReaderMediaBlockView(
                    block: block,
                    route: route,
                    onOpenMedia: onOpenMedia,
                    onMediaFailure: onMediaFailure
                )
            case .table:
                if let table = block.table {
                    NativeReaderTableBlockView(
                        table: table,
                        baseURL: route.sourceURL.deletingLastPathComponent(),
                        searchQuery: searchQuery,
                        activeMatchIndex: searchMatches.firstIndex(where: { $0.id == activeSearchMatchID })
                    )
                    .containerRelativeFrame(.horizontal)
                }
            case .unsupportedHTML:
                EmptyView()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.leading, block.kind == .heading ? 0 : hierarchyIndentation)
        .padding(.bottom, bottomSpacing)
        .overlay {
            if !searchMatches.isEmpty,
               [.table, .image, .figure].contains(block.kind) {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(Color(uiColor: accentColor), lineWidth: activeBlockMatch ? 2 : 1)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityValue(searchMatches.isEmpty ? "" : "\(searchMatches.count) search matches")
    }

    @ViewBuilder
    private var heading: some View {
        let presentation = NativeReaderHeadingPresentation(block: block)
        switch presentation.style {
        case .chapter:
            selectableText(role: .majorHeading(level: presentation.level))
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
        case .majorSection:
            selectableText(role: .majorHeading(level: presentation.level))
                .accessibilityAddTraits(.isHeader)
        case .provision:
            selectableText(role: .heading(level: presentation.level))
                .padding(.leading, 12)
                .overlay(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                        .fill(Color(uiColor: accentColor))
                        .frame(width: 3)
                }
                .padding(.leading, presentation.indentation)
                .accessibilityAddTraits(.isHeader)
        }
    }

    private func selectableText(role: NativeReaderTypographyRole) -> some View {
        AttributedTextView(
            attributedText: NativeReaderAttributedTextBuilder.attributedText(
                runs: block.runs,
                fallbackText: block.plainText,
                theme: theme,
                role: role,
                accentColor: accentColor,
                highlightRanges: searchMatches.map(\.range),
                activeHighlightRange: searchMatches.first(where: { $0.id == activeSearchMatchID })?.range
            ),
            onOpenLink: onOpenLink,
            onResearchSelection: onResearchSelection
        )
    }

    private var activeBlockMatch: Bool {
        searchMatches.contains(where: { $0.id == activeSearchMatchID })
    }

    private var bottomSpacing: CGFloat {
        switch block.kind {
        case .heading:
            return NativeReaderHeadingPresentation(block: block).level <= 2 ? 14 : 8
        case .paragraph, .orderedList, .unorderedList:
            if usesCompactSpacing {
                return 3
            }
            return max(CGFloat(theme.paragraphSpacing), 8)
        case .sourceNote, .editorNote:
            return 14
        case .caption, .footnote:
            return 8
        case .divider:
            return 16
        case .image, .figure:
            return 14
        case .table:
            return 16
        case .unsupportedHTML:
            return 0
        }
    }
}

private struct NativeReaderMediaBlockView: View {
    let block: NativeReaderRuntimeBlock
    let route: NativeReaderDocumentRoute
    let onOpenMedia: (NativeReaderRuntimeMedia, UIImage) -> Void
    let onMediaFailure: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(block.media) { media in
                if let assetURL = NativeReaderDocumentStore.resolvedMediaURL(for: media, route: route) {
                    ImageBlockView(
                        imageURL: assetURL,
                        caption: caption(for: media),
                        accessibilityText: media.accessibilityText,
                        preferredAspectRatio: media.authoredAspectRatio,
                        onOpenImage: { image in
                            onOpenMedia(media, image)
                        },
                        onLoadFailure: onMediaFailure
                    )
                } else {
                    missingMedia(media)
                        .task(id: media.id) {
                            onMediaFailure("The native Reader could not resolve \(media.id).")
                        }
                }
            }

            if block.media.count > 1,
               let caption = block.caption?.trimmingCharacters(in: .whitespacesAndNewlines),
               !caption.isEmpty {
                Text(caption)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func caption(for media: NativeReaderRuntimeMedia) -> String? {
        if let caption = media.caption?.trimmingCharacters(in: .whitespacesAndNewlines),
           !caption.isEmpty {
            return caption
        }
        guard block.media.count == 1,
              let caption = block.caption?.trimmingCharacters(in: .whitespacesAndNewlines),
              !caption.isEmpty else {
            return nil
        }
        return caption
    }

    private func missingMedia(_ media: NativeReaderRuntimeMedia) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Image unavailable", systemImage: "exclamationmark.triangle.fill")
                .font(.footnote.weight(.semibold))
            Text(media.resolvedAssetPath ?? media.source ?? media.id)
                .font(.caption)
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, minHeight: 120, alignment: .leading)
        .padding(CodeScreenMetrics.cardPadding)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: CodeScreenMetrics.cardCornerRadius, style: .continuous))
    }
}

struct NativeReaderHeadingPresentation: Equatable {
    enum Style: Equatable {
        case chapter
        case majorSection
        case provision
    }

    let level: Int
    let style: Style

    init(level: Int, style: Style) {
        self.level = level
        self.style = style
    }

    init(block: NativeReaderRuntimeBlock) {
        let text = block.plainText.trimmingCharacters(in: .whitespacesAndNewlines)
        let uppercaseText = text.uppercased()
        let sourceLevel = min(max(block.headingLevel ?? 3, 1), 6)

        if sourceLevel == 1 || uppercaseText.hasPrefix("CHAPTER ") {
            level = 1
            style = .chapter
        } else if sourceLevel == 2
                    || uppercaseText.hasPrefix("SECTION ")
                    || uppercaseText.hasPrefix("ARTICLE ")
                    || uppercaseText.hasPrefix("PART ") {
            level = 2
            style = .majorSection
        } else {
            level = Self.provisionLevel(text: text, fallback: sourceLevel)
            style = .provision
        }
    }

    var indentation: CGFloat {
        CGFloat(max(level - 3, 0)) * 12
    }

    private static func provisionLevel(text: String, fallback: Int) -> Int {
        guard let token = text.split(whereSeparator: { $0.isWhitespace }).first else {
            return max(fallback, 3)
        }
        let number = token.trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
        let components = number.split(separator: ".")
        guard components.count >= 2,
              components.allSatisfy({ !$0.isEmpty && $0.allSatisfy(\.isNumber) })
        else {
            return max(fallback, 3)
        }
        return min(3 + max(components.count - 2, 0), 6)
    }
}

private struct NativeReaderListBlockView: View {
    let items: [NativeReaderRuntimeListItem]
    let ordered: Bool
    let theme: ReaderTheme
    let accentColor: UIColor
    let onOpenLink: (URL) -> Void
    let searchQuery: String
    let onResearchSelection: (String) -> Void

    private var rows: [NativeReaderListRow] {
        items.flatMap { NativeReaderListRow.flatten($0) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            ForEach(rows) { row in
                HStack(alignment: .top, spacing: 8) {
                    Text(marker(for: row))
                        .font(theme.swiftUIFont(emphasized: true))
                        .foregroundStyle(Color(uiColor: accentColor))
                        .frame(minWidth: 18, alignment: .trailing)
                    AttributedTextView(
                        attributedText: NativeReaderAttributedTextBuilder.attributedText(
                            runs: row.runs,
                            fallbackText: row.plainText,
                            theme: theme,
                            role: .body,
                            accentColor: accentColor,
                            highlightRanges: NativeReaderSearchIndex.ranges(
                                of: searchQuery,
                                in: row.plainText
                            )
                        ),
                        onOpenLink: onOpenLink,
                        onResearchSelection: onResearchSelection
                    )
                }
                .padding(.leading, CGFloat(max(row.depth, 0)) * 18)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func marker(for row: NativeReaderListRow) -> String {
        if ordered, let ordinal = row.ordinal {
            return "\(ordinal)."
        }
        return "•"
    }
}

private struct NativeReaderListRow: Identifiable {
    let id: String
    let depth: Int
    let ordinal: Int?
    let plainText: String
    let runs: [NativeReaderRuntimeTextRun]

    static func flatten(_ item: NativeReaderRuntimeListItem) -> [NativeReaderListRow] {
        [
            NativeReaderListRow(
                id: item.id,
                depth: item.depth,
                ordinal: item.ordinal,
                plainText: item.plainText,
                runs: item.runs
            )
        ] + item.children.flatMap(flatten)
    }
}

enum NativeReaderTypographyRole: Equatable {
    case majorHeading(level: Int)
    case heading(level: Int)
    case body
    case caption
    case footnote
    case note
}

enum NativeReaderAttributedTextBuilder {
    static func attributedText(
        runs: [NativeReaderRuntimeTextRun],
        fallbackText: String,
        theme: ReaderTheme,
        role: NativeReaderTypographyRole,
        accentColor: UIColor,
        highlightRanges: [NSRange] = [],
        activeHighlightRange: NSRange? = nil
    ) -> NSAttributedString {
        let effectiveRuns = runs.isEmpty
            ? [NativeReaderRuntimeTextRun(text: fallbackText, styles: [], linkTarget: nil)]
            : runs
        let result = NSMutableAttributedString()
        for run in effectiveRuns where !run.text.isEmpty {
            result.append(
                NSAttributedString(
                    string: run.text,
                    attributes: attributes(
                        for: run,
                        theme: theme,
                        role: role,
                        accentColor: accentColor
                    )
                )
            )
        }
        for range in highlightRanges where NSMaxRange(range) <= result.length {
            result.addAttribute(
                .backgroundColor,
                value: accentColor.withAlphaComponent(0.18),
                range: range
            )
        }
        if let activeHighlightRange,
           NSMaxRange(activeHighlightRange) <= result.length {
            result.addAttributes(
                [
                    .backgroundColor: accentColor.withAlphaComponent(0.38),
                    .underlineColor: accentColor,
                    .underlineStyle: NSUnderlineStyle.single.rawValue
                ],
                range: activeHighlightRange
            )
        }
        return result
    }

    private static func attributes(
        for run: NativeReaderRuntimeTextRun,
        theme: ReaderTheme,
        role: NativeReaderTypographyRole,
        accentColor: UIColor
    ) -> [NSAttributedString.Key: Any] {
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.lineSpacing = CGFloat(theme.lineSpacing)
        paragraphStyle.paragraphSpacing = 0
        paragraphStyle.lineBreakMode = .byWordWrapping

        var attributes: [NSAttributedString.Key: Any] = [
            .font: font(for: run.styles, theme: theme, role: role),
            .foregroundColor: foregroundColor(for: role, accentColor: accentColor),
            .paragraphStyle: paragraphStyle
        ]
        if run.styles.contains(.underline) {
            attributes[.underlineStyle] = NSUnderlineStyle.single.rawValue
        }
        if run.styles.contains(.strikethrough) {
            attributes[.strikethroughStyle] = NSUnderlineStyle.single.rawValue
        }
        if run.styles.contains(.superscript) {
            attributes[.baselineOffset] = 4
        } else if run.styles.contains(.subscript) {
            attributes[.baselineOffset] = -3
        }
        if let target = run.linkTarget,
           let linkURL = NativeReaderLinkResolver.linkURL(for: target) {
            attributes[.link] = linkURL
            attributes[.foregroundColor] = accentColor
            attributes[.underlineStyle] = NSUnderlineStyle.single.rawValue
        }
        return attributes
    }

    private static func font(
        for styles: [NativeReaderRuntimeTextStyle],
        theme: ReaderTheme,
        role: NativeReaderTypographyRole
    ) -> UIFont {
        let bodySize = max(CGFloat(theme.fontSize) * 1.16, 12)
        let roleSize: CGFloat
        let textStyle: UIFont.TextStyle
        var wantsBold = styles.contains(.bold)

        switch role {
        case .majorHeading(let level), .heading(let level):
            switch level {
            case ...1:
                roleSize = max(bodySize * 1.65, bodySize + 7)
                textStyle = .title1
            case 2:
                roleSize = max(bodySize * 1.45, bodySize + 5)
                textStyle = .title2
            case 3:
                roleSize = max(bodySize * 1.25, bodySize + 3)
                textStyle = .headline
            default:
                roleSize = max(bodySize * 1.12, bodySize + 1)
                textStyle = .subheadline
            }
            wantsBold = true
        case .body:
            roleSize = bodySize
            textStyle = .body
        case .caption:
            roleSize = max(bodySize * 0.92, 10)
            textStyle = .callout
            wantsBold = true
        case .footnote, .note:
            roleSize = max(bodySize * 0.88, 10)
            textStyle = .footnote
        }

        let effectiveSize = (styles.contains(.small) || styles.contains(.superscript) || styles.contains(.subscript))
            ? roleSize * 0.84
            : roleSize
        let baseFont: UIFont
        if styles.contains(.code) {
            baseFont = .monospacedSystemFont(ofSize: effectiveSize, weight: wantsBold ? .semibold : .regular)
        } else {
            baseFont = theme.bodyFont.withSize(effectiveSize)
        }

        var traits = baseFont.fontDescriptor.symbolicTraits
        if wantsBold { traits.insert(.traitBold) }
        if styles.contains(.italic) { traits.insert(.traitItalic) }
        let styledFont: UIFont
        if let descriptor = baseFont.fontDescriptor.withSymbolicTraits(traits) {
            styledFont = UIFont(descriptor: descriptor, size: effectiveSize)
        } else {
            styledFont = baseFont
        }
        return UIFontMetrics(forTextStyle: textStyle).scaledFont(for: styledFont)
    }

    private static func foregroundColor(
        for role: NativeReaderTypographyRole,
        accentColor: UIColor
    ) -> UIColor {
        switch role {
        case .majorHeading:
            return accentColor
        case .heading:
            return .label
        case .caption, .footnote, .note:
            return .secondaryLabel
        case .body:
            return .label
        }
    }
}
