import os.signpost
import SwiftUI
import UIKit

private let nativeReaderLegacyScrollCoordinateSpace = "nativeReaderScroll"
private let nativeReaderContentCoordinateSpace = "nativeReaderContent"

struct NativeChapterTextReaderView: View {
    let chapter: CodeChapter
    let initialSectionID: Int64
    let opensAtChapterTop: Bool
    let initialSectionNumber: String
    var initialSectionTitle: String = ""
    let initialAnchorID: String?
    let route: NativeReaderDocumentRoute
    let linkedPassage: LinkedReaderPassage?
    var rememberedSectionID: Binding<Int64?> = .constant(nil)
    var rememberedBlockID: Binding<String?> = .constant(nil)
    var rememberedViewport: Binding<NativeReaderViewportPosition?> = .constant(nil)
    var rememberedAnchorID: Binding<String?> = .constant(nil)
    var onFallbackToHTML: ((String, String?) -> Void)?
    var onOpenReference: ((CodeSectionSummary) -> Void)?

    @Environment(\.readerControlsClearance) private var readerControlsClearance
    @Environment(\.floatingNavigationClearance) private var floatingNavigationClearance
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.openURL) private var openURL
    @Environment(\.isBrowserTabActive) private var isBrowserTabActive
    @State private var document: NativeReaderRuntimeDocument?
    @State private var displayBlocks: [NativeReaderDisplayBlock] = []
    @StateObject private var textLayout = NativeReaderTextGroupStore()
    @State private var sectionTargets: [NativeReaderSectionTarget] = []
    @State private var sectionMetadata: NativeReaderSectionMetadata = .empty
    @State private var navigationIndex = NativeReaderNavigationIndex.empty
    @State private var linkedHighlight: NativeReaderLinkedHighlight?
    @StateObject private var scrollState = NativeReaderScrollState()
    @State private var currentSectionTargetIndex: Int?
    private var pendingInitialBlockID: String? {
        get { scrollState.pendingInitialBlockID }
        nonmutating set {
            if scrollState.pendingInitialBlockID != newValue { scrollState.pendingInitialBlockID = newValue }
        }
    }
    @State private var explicitNavigation = false
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var failureMessage: String?
    @State private var hasRequestedFallback = false
    @State private var expandedMedia: NativeReaderExpandedMedia?
    @State private var isJumpPickerPresented = false
    @State private var isSearchPresented = false
    @State private var searchQuery = ""
    @State private var searchMatches: [NativeReaderChapterFindHit] = []
    @State private var searchMatchesByBlock: [String: [NativeReaderSearchMatch]] = [:]
    @State private var appliedSearchQuery: String?
    @State private var appliedSearchRouteID: String?
    @State private var isChapterSearchInProgress = false
    @State private var activeSearchMatchID: String?
    @State private var isFindListPresented = false
    @State private var findListSelection: NativeReaderChapterFindHit?
    @State private var pendingFindSubmission: String?
    @State private var lastRecordedSectionTargetID: String?
    @State private var settledScrollTask: Task<Void, Never>?
    @State private var nearbyMediaPrefetchTask: Task<Void, Never>?

    init(
        chapter: CodeChapter,
        initialSectionID: Int64,
        opensAtChapterTop: Bool = false,
        initialSectionNumber: String,
        initialSectionTitle: String = "",
        initialAnchorID: String?,
        route: NativeReaderDocumentRoute,
        preparedNativeOpening: NativeReaderPreparedOpening? = nil,
        rememberedSectionID: Binding<Int64?> = .constant(nil),
        rememberedBlockID: Binding<String?> = .constant(nil),
        rememberedViewport: Binding<NativeReaderViewportPosition?> = .constant(nil),
        rememberedAnchorID: Binding<String?> = .constant(nil),
        linkedPassage: LinkedReaderPassage? = nil,
        onFallbackToHTML: ((String, String?) -> Void)? = nil,
        onOpenReference: ((CodeSectionSummary) -> Void)? = nil
    ) {
        self.chapter = chapter
        self.initialSectionID = initialSectionID
        self.opensAtChapterTop = opensAtChapterTop
        self.initialSectionNumber = initialSectionNumber
        self.initialSectionTitle = initialSectionTitle
        self.initialAnchorID = initialAnchorID
        self.route = route
        self.rememberedSectionID = rememberedSectionID
        self.rememberedBlockID = rememberedBlockID
        self.rememberedViewport = rememberedViewport
        self.rememberedAnchorID = rememberedAnchorID
        self.linkedPassage = linkedPassage
        self.onFallbackToHTML = onFallbackToHTML
        self.onOpenReference = onOpenReference
        if let prepared = preparedNativeOpening?.document(matching: route)
            ?? NativeReaderDocumentStore.shared.preparedDocumentIfCached(for: route) {
            _document = State(initialValue: prepared.document)
            _displayBlocks = State(initialValue: prepared.displayBlocks)
            _textLayout = StateObject(wrappedValue: NativeReaderTextGroupStore(prepared: prepared))
            _sectionTargets = State(initialValue: prepared.sectionTargets)
            _sectionMetadata = State(initialValue: prepared.sectionMetadata)
            _navigationIndex = State(initialValue: prepared.navigationIndex)
            let highlight = linkedPassage.flatMap { NativeReaderLinkedHighlight.resolve($0,
                sectionNumber: initialSectionNumber, prepared: prepared) }
            _linkedHighlight = State(initialValue: highlight)
            // StateObject evaluates this initializer once for the mounted chapter.
            // Parent updates while scrolling must not repeat the opening passage search.
            _scrollState = StateObject(wrappedValue: {
                let target = (rememberedBlockID.wrappedValue == nil ? highlight?.firstBlockID : nil)
                    ?? NativeReaderLocationResolver.initialBlockID(
                    in: prepared.document,
                    prepared: prepared,
                    opensAtChapterTop: opensAtChapterTop,
                    rememberedBlockID: rememberedBlockID.wrappedValue,
                    rememberedAnchorID: rememberedAnchorID.wrappedValue,
                    initialAnchorID: initialAnchorID,
                    initialSectionNumber: initialSectionNumber,
                    initialSectionTitle: initialSectionTitle
                )
                let requiresRestore = NativeReaderInitialRestorationPolicy.requiresRestoration(
                    opensAtChapterTop: opensAtChapterTop,
                    targetBlockID: target,
                    firstBlockID: prepared.document.blocks.first?.id,
                    rememberedViewportBlockID: rememberedViewport.wrappedValue?.blockID
                )
                return NativeReaderScrollState(pendingInitialBlockID: requiresRestore ? target : nil)
            }())
        }
    }

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
                    NativeReaderLoadingPlaceholder()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .task(id: "\(route.id)|\(isBrowserTabActive)") {
                guard isBrowserTabActive else { return }
                await loadDocument()
            }
        }
        .environment(\.readerDefinitionContext, chapter.codeSectionID.map { codeSectionID in
            ReaderDefinitionContext(versionFileName: route.sourceURL.path,
                                    codeSectionID: codeSectionID, chapterNumber: chapter.chapterNumber, chapterID: chapter.id)
        })
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .fullScreenCover(item: $expandedMedia) { media in
            ZoomableImageViewer(image: media.image, accessibilityText: media.accessibilityText)
        }
        .onChange(of: isBrowserTabActive) { _, isActive in
            guard !isActive else { return }
            scrollState.findNavigationTask?.cancel()
            scrollState.chapterSelection.clear()
            let canPersist = pendingInitialBlockID == nil
                && (scrollState.restorationLease.map(restorationHasArrived) ?? true)
            releaseRestorationLease(reason: "inactive-tab")
            settledScrollTask?.cancel()
            settledScrollTask = nil
            if canPersist, let visibleBlockID = scrollState.visibleBlockID {
                persistLocation(blockID: visibleBlockID)
            }
            nearbyMediaPrefetchTask?.cancel()
            nearbyMediaPrefetchTask = nil
            scrollState.textPrefetchTask?.cancel()
            scrollState.textPrefetchTask = nil
            scrollState.isScrollActive = false
            scrollState.isDecelerating = false
        }
        .onChange(of: dynamicTypeSize) { _, _ in releaseRestorationLease(reason: "dynamic-type") }
        .onChange(of: library.readerTheme) { _, _ in releaseRestorationLease(reason: "theme") }
        .onChange(of: route.id) { _, _ in
            scrollState.findNavigationTask?.cancel()
            scrollState.chapterSelection.clear()
            releaseRestorationLease(reason: "route")
        }
        .onDisappear {
            scrollState.findNavigationTask?.cancel()
            scrollState.chapterSelection.clear()
            releaseRestorationLease(reason: "disappear")
            settledScrollTask?.cancel()
            settledScrollTask = nil
            // Navigation teardown can change the scroll offset after the last
            // visible frame. Keep the settled reading position, not that
            // dismissal geometry. Tab changes persist before teardown above.
            nearbyMediaPrefetchTask?.cancel()
            nearbyMediaPrefetchTask = nil
            scrollState.textPrefetchTask?.cancel()
            scrollState.textPrefetchTask = nil
            scrollState.isScrollActive = false
            scrollState.isDecelerating = false
        }
    }

    private func reader(
        document: NativeReaderRuntimeDocument,
        proxy: ScrollViewProxy
    ) -> some View {
        trackedReaderScroll(document: document, proxy: proxy)
        .allowsHitTesting(pendingInitialBlockID == nil)
        .accessibilityHidden(pendingInitialBlockID != nil)
        .onAppear {
            if pendingInitialBlockID == nil && isBrowserTabActive {
                #if PERMITEXT_LOCAL_PERFORMANCE
                LocalPerformanceRecorder.record(.nativeChapterContentAppeared)
                #endif
                os_signpost(.event, log: AppSignpost.reader, name: "nativeChapterContentAppeared")
            }
        }
        .onChange(of: pendingInitialBlockID) { oldValue, newValue in
            if oldValue != nil && newValue == nil && isBrowserTabActive {
                #if PERMITEXT_LOCAL_PERFORMANCE
                LocalPerformanceRecorder.record(.nativeChapterRestorationCompleted)
                #endif
                os_signpost(.event, log: AppSignpost.reader, name: "nativeChapterRestorationCompleted")
            }
        }
        .transaction { transaction in
            transaction.animation = nil
        }
        .overlay {
            if pendingInitialBlockID != nil {
                // Keep the native scroll view mounted and laying out while
                // the preview covers its temporary starting position.
                openingPassage(document: document, proxy: proxy)
                    .background(CodeAppBackdrop.color)
            }
        }
        .task(id: "\(route.id)|\(searchQuery)|\(isBrowserTabActive)") {
            await updateChapterSearch()
        }
        .onChange(of: searchQuery) { _, query in
            if !query.isEmpty { scrollState.findNavigationTask?.cancel() }
            if pendingFindSubmission != query { pendingFindSubmission = nil }
        }
        .onChange(of: appliedSearchQuery) { _, applied in
            guard let applied, applied == searchQuery, applied == pendingFindSubmission else { return }
            pendingFindSubmission = nil
            navigateSearchMatch(offset: 0, proxy: proxy, document: document)
        }
        .task(id: "\(route.id)|\(pendingInitialBlockID ?? "")|\(isBrowserTabActive)") {
            guard isBrowserTabActive else { return }
            await restoreInitialPosition(proxy: proxy)
        }
        .chapterFindBar(isPresented: isSearchPresented) { usesReaderBottomBar in
            ChapterFindControls(
                query: $searchQuery,
                matchCount: searchMatches.count,
                activeIndex: searchMatches.firstIndex(where: { $0.id == activeSearchMatchID }),
                isSearching: isChapterSearchInProgress || appliedSearchQuery != searchQuery,
                onPrevious: { navigateSearchMatch(offset: -1, proxy: proxy, document: document) },
                onNext: { navigateSearchMatch(offset: 1, proxy: proxy, document: document) },
                onSubmit: {
                    if appliedSearchQuery == searchQuery {
                        navigateSearchMatch(offset: 0, proxy: proxy, document: document)
                    } else {
                        pendingFindSubmission = searchQuery
                    }
                },
                onClose: closeChapterSearch,
                usesReaderBottomBar: usesReaderBottomBar,
                onShowMatches: { isFindListPresented = true }
            )
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { frame in
                scrollState.findBar = (frame, usesReaderBottomBar)
            }
        }
        .sheet(isPresented: $isFindListPresented, onDismiss: {
            if let hit = findListSelection {
                findListSelection = nil
                activateSearchMatch(hit, proxy: proxy, document: document)
            }
        }) {
            ChapterFindMatchesSheet(rows: chapterFindRows()) { id in
                findListSelection = searchMatches.first { $0.id == id }
                isFindListPresented = false
            }
        }
        .toolbar {
            ToolbarItem(placement: .principal) {
                ReaderChapterTitle(title: chapter.title, currentSection: currentSectionTarget?.menuLabel ?? "", accent: accentColor)
                .sourceProblemReporting(sectionID: currentBookmarkSectionID)
            }
            ChapterReaderToolbarActions(canOpenSections: !sectionTargets.isEmpty) {
                closeChapterSearch()
                isJumpPickerPresented = true
            } onSearch: {
                if isSearchPresented { closeChapterSearch() }
                else {
                    scrollState.chapterSelection.clear()
                    textLayout.prewarmFindIndex()
                    isSearchPresented = true
                }
            }
        }
        .sheet(isPresented: $isJumpPickerPresented) {
            jumpPicker(proxy: proxy, document: document)
        }
    }

    private func closeChapterSearch() {
        pendingFindSubmission = nil
        searchQuery = ""
        isSearchPresented = false
    }

    @MainActor
    private func updateChapterSearch() async {
        guard !Task.isCancelled else { return }
        guard isBrowserTabActive else { isChapterSearchInProgress = false; return }
        let requestedQuery = searchQuery
        let requestedRoute = route.id
        guard appliedSearchQuery != requestedQuery || appliedSearchRouteID != requestedRoute else { return }
        searchMatches = []
        searchMatchesByBlock = [:]
        appliedSearchQuery = nil
        appliedSearchRouteID = nil
        guard !requestedQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            activeSearchMatchID = nil
            appliedSearchQuery = requestedQuery
            appliedSearchRouteID = requestedRoute
            isChapterSearchInProgress = false
            return
        }
        isChapterSearchInProgress = true
        // The visible owner coalesces typing and shares its results with Reader rows.
        do { try await Task.sleep(for: .milliseconds(120)) } catch { return }
        guard !Task.isCancelled, isBrowserTabActive,
              searchQuery == requestedQuery, route.id == requestedRoute else { return }
        let matches = await textLayout.findMatches(query: requestedQuery)
        guard !Task.isCancelled, isBrowserTabActive,
              searchQuery == requestedQuery, route.id == requestedRoute else { return }
        searchMatches = matches
        searchMatchesByBlock = Dictionary(grouping: matches.flatMap(\.highlights), by: \.blockID)
        appliedSearchQuery = requestedQuery
        appliedSearchRouteID = requestedRoute
        isChapterSearchInProgress = false
        if !matches.contains(where: { $0.id == activeSearchMatchID }) {
            activeSearchMatchID = nil
        }
    }

    @ViewBuilder
    private func trackedReaderScroll(
        document: NativeReaderRuntimeDocument,
        proxy: ScrollViewProxy
    ) -> some View {
        let scroll = readerScrollView(document: document, proxy: proxy)
            .coordinateSpace(name: nativeReaderLegacyScrollCoordinateSpace)
            .onPreferenceChange(NativeReaderBlockOffsetPreferenceKey.self) { positions in
                scrollState.blockPositions = positions
                readerGeometryDidChange(document: document, proxy: proxy)
            }
        if #available(iOS 18.0, *) {
            scroll
                .onScrollPhaseChange { _, newPhase in
                    scrollPhaseDidChange(newPhase, document: document)
                }
                .onScrollGeometryChange(for: CGSize.self) { geometry in
                    geometry.contentSize
                } action: { _, _ in
                    traceRestoration("content-size")
                    guard scrollState.restorationLease != nil else { return }
                    readerGeometryDidChange(document: document, proxy: proxy)
                }
        } else {
            scroll
        }
    }

    private func readerGeometryDidChange(document: NativeReaderRuntimeDocument, proxy: ScrollViewProxy) {
        if scrollState.restorationLease == nil {
            reportVisibleBlock(document: document)
            return
        }
        // Content size, row positions and viewport position can arrive in
        // separate callbacks for one layout. Correct only after they settle.
        scrollState.restorationGeometryTask?.cancel()
        scrollState.restorationGeometryTask = Task { @MainActor in
            await Task.yield()
            guard !Task.isCancelled, !correctLateLayout(proxy: proxy) else { return }
            reportVisibleBlock(document: document)
        }
    }

    private func reportVisibleBlock(document: NativeReaderRuntimeDocument) {
        visibleBlockDidChange(
            NativeReaderVisibleBlockResolver.topBlockID(
                from: scrollState.blockPositions,
                threshold: CodeScreenMetrics.topTitlePadding + 1 - scrollState.contentTopInViewport
            ),
            document: document
        )
    }

    private func readerScrollView(
        document: NativeReaderRuntimeDocument,
        proxy: ScrollViewProxy
    ) -> some View {
        let blocks = displayBlocks
        let targets = sectionTargets
        let index = navigationIndex
        let codeSectionID = chapter.codeSectionID
        let library = library
        return ScrollView {
            Group {
                if NativeReaderStackPolicy.usesEagerStack(displayBlocks) {
                    VStack(alignment: .leading, spacing: 0) {
                        chapterRows(document: document, proxy: proxy)
                    }
                    .scrollTargetLayout()
                } else {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        chapterRows(document: document, proxy: proxy)
                    }
                    .scrollTargetLayout()
                }
            }
            .codeTabAlignedHorizontalPadding()
            .padding(.top, CodeScreenMetrics.topTitlePadding)
            .padding(.bottom, 28 + readerControlsClearance)
            // Scrolling moves this one origin. Rows report their position
            // within the content only when the lazy stack lays them out.
            .coordinateSpace(name: nativeReaderContentCoordinateSpace)
            .background(alignment: .top) {
                Color.clear.frame(height: 1)
                    .onGeometryChange(for: CGFloat.self) { geometry in
                        geometry.frame(in: .named(nativeReaderLegacyScrollCoordinateSpace)).minY
                    } action: { top in
                        scrollState.contentTopInViewport = top
                        readerGeometryDidChange(document: document, proxy: proxy)
                    }
            }
            .background(NativeReaderScrollViewProbe { [weak library, weak textLayout, scrollState] scrollView in
#if DEBUG
                NativeReaderFrameProbe.shared.attach(scrollView)
#endif
                scrollState.scrollView = scrollView
                let selection = scrollState.chapterSelection
                selection.attach(to: scrollView)
                selection.resolveText = { [weak library] range in
                    NativeReaderChapterSelectionText.resolve(range, in: blocks) { blockID in
                        guard let targetIndex = index[blockID]?.sectionTargetIndex,
                              let number = targets[targetIndex].sectionNumber else { return nil }
                        return library?.sectionSummary(sectionNumber: number, codeSectionID: codeSectionID)?.id
                    }
                }
                selection.passageRange = { [weak textLayout] range in
                    guard let layout = textLayout, blocks.indices.contains(range.start.address.block),
                          blocks.indices.contains(range.end.address.block),
                          let target = index[blocks[range.start.address.block].id]?.sectionTargetIndex,
                          index[blocks[range.end.address.block].id]?.sectionTargetIndex == target,
                          targets[target].sectionNumber != nil else { return nil }
                    return layout.passageRange(target)
                }
                selection.askAssistant = { [weak library] in library?.sendToResearch($0) }
                selection.saveToEvidence = { [weak library, weak textLayout, weak selection] passages, range in
                    guard let library, let textLayout else { return false }
                    let projectID = library.readerSaveDestinationProject?.id
                    var occurrences: [Int64: [String: [Int]]] = [:]
                    var sectionsByTarget: [Int: Int64] = [:]
                    for block in range.start.address.block...range.end.address.block where blocks.indices.contains(block) {
                        guard let target = index[blocks[block].id]?.sectionTargetIndex, sectionsByTarget[target] == nil,
                              let number = targets[target].sectionNumber,
                              let id = library.sectionSummary(sectionNumber: number, codeSectionID: codeSectionID)?.id,
                              let passage = passages.first(where: { $0.sectionID == String(id) }),
                              let location = textLayout.passage(target) else { continue }
                        let quote = passage.selectedText
                        occurrences[id, default: [:]][quote] = location.occurrences(for: range, quote: quote)
                        sectionsByTarget[target] = id
                    }
                    guard library.saveReaderSelectionToEvidence(passages, occurrences: occurrences) else { return false }
                    if let projectID {
                        var savedRanges: [NativeChapterSelectionAddress: [NSRange]] = [:]
                        for (target, id) in sectionsByTarget {
                            guard let evidence = library.readerEvidence[id]?[projectID],
                                  case let .ranges(ranges) = textLayout.savedText(evidence, target: target) else { continue }
                            savedRanges.merge(ranges, uniquingKeysWith: +)
                        }
                        selection?.showSavedEvidence(savedRanges, accent: library.accentColor(for: codeSectionID))
                    }
                    return true
                }
            })
        }
        .codeNavigationTopScrollEdge()
        .accessibilityIdentifier("native-reader-ready")
    }

    @ViewBuilder
    private func chapterRows(document: NativeReaderRuntimeDocument, proxy: ScrollViewProxy) -> some View {
        let projectID = library.readerSaveDestinationProject?.id
        let evidence = library.readerEvidence
        if !textLayout.groups.isEmpty {
            ForEach(textLayout.groups) { group in
                if group.rows.count == 1 || group.rows.dropFirst().contains(where: { scrollState.exactLayoutBlockIDs.contains($0.id) }) {
                    readerBlocks(Array(group.rows), document: document, proxy: proxy, tracksOffsets: true, projectID: projectID, evidence: evidence)
                } else {
                    let index = navigationIndex[group.id]?.sectionTargetIndex
                    let target = index.map { sectionTargets[$0] }
                    // Only paragraphs receive definition links. The heading may carry its own source ID.
                    let sectionID = group.rows.first(where: { $0.block.kind == .paragraph })?.block.sectionID ?? ""
                    let highlights = group.rows.flatMap { searchMatchesByBlock[$0.id] ?? [] }
                    NativeReaderGroupedTextView(
                        group: group, routeID: route.id, theme: library.readerTheme,
                        accent: library.accentColor(for: chapter.codeSectionID),
                        saved: savedText(for: index, projectID: projectID, evidence: evidence), selection: scrollState.chapterSelection,
                        highlights: highlights, activeSearchMatchID: highlights.contains { $0.id == activeSearchMatchID } ? activeSearchMatchID : nil,
                        onOpenLink: { handleLink($0, document: document, proxy: proxy) },
                        onResearch: { sendSelectionToResearch($0, target: target) }
                    )
                    .equatable()
                    .environment(\.readerDefinitionContext, sectionMetadata.definitionSectionIDs.contains(sectionID) ? nil : chapter.codeSectionID.map {
                        ReaderDefinitionContext(versionFileName: route.sourceURL.path, codeSectionID: $0,
                                                chapterNumber: chapter.chapterNumber, chapterID: chapter.id,
                                                sectionNumber: sectionMetadata.sectionNumbersBySectionID[sectionID])
                    })
                    .id(group.id)
                    .modifier(NativeReaderBlockOffsetModifier(blockID: group.id, tracksOffset: true))
                }
            }
        } else {
            readerBlocks(displayBlocks, document: document, proxy: proxy, tracksOffsets: true, projectID: projectID, evidence: evidence)
        }
    }

    private func savedText(for targetIndex: Int?, projectID: Int64?, evidence: [Int64: [Int64: ReaderEvidenceText]]) -> NativeReaderSavedText {
        if let linkedHighlight, linkedHighlight.targetIndex == targetIndex { return linkedHighlight.savedText }
        guard let projectID, !evidence.isEmpty, let targetIndex,
              let sectionID = sectionSummary(for: sectionTargets[targetIndex])?.id,
              let excerpts = evidence[sectionID]?[projectID] else { return .none }
        return textLayout.savedText(excerpts, target: targetIndex)
    }

    private func readerBlocks(
        _ blocks: [NativeReaderDisplayBlock],
        document: NativeReaderRuntimeDocument,
        proxy: ScrollViewProxy,
        tracksOffsets: Bool,
        projectID: Int64?,
        evidence: [Int64: [Int64: ReaderEvidenceText]]
    ) -> some View {
        let needsSectionScope = chapter.codeSectionID.map {
            ReaderDefinitionStore.shared.hasSectionScopes(for: ReaderDefinitionContext(versionFileName: route.sourceURL.path, codeSectionID: $0, chapterNumber: chapter.chapterNumber, chapterID: chapter.id))
        } ?? false
        return ForEach(blocks) { displayBlock in
            let location = navigationIndex[displayBlock.id]
            let matches = searchMatchesByBlock[displayBlock.id] ?? []
            let target = location?.sectionTargetIndex.map { sectionTargets[$0] }
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
                searchQuery: matches.isEmpty ? "" : appliedSearchQuery ?? "",
                searchMatches: matches,
                activeSearchMatchID: matches.contains { $0.id == activeSearchMatchID } ? activeSearchMatchID : nil,
                saved: savedText(for: location?.sectionTargetIndex, projectID: projectID, evidence: evidence),
                blockIndex: location?.displayIndex ?? 0,
                chapterSelectionTarget: tracksOffsets ? location.map {
                    NativeChapterSelectionTarget(controller: scrollState.chapterSelection, address: .init(block: $0.displayIndex))
                } : nil,
                onResearchSelection: { selectedText in
                    sendSelectionToResearch(
                        selectedText,
                        target: target
                    )
                }
            )
            .equatable()
            .environment(\.readerDefinitionContext, sectionMetadata.definitionSectionIDs.contains(displayBlock.block.sectionID ?? "") ? nil : chapter.codeSectionID.map {
                ReaderDefinitionContext(versionFileName: route.sourceURL.path, codeSectionID: $0, chapterNumber: chapter.chapterNumber, chapterID: chapter.id, sectionNumber: needsSectionScope ? sectionMetadata.sectionNumbersBySectionID[displayBlock.block.sectionID ?? ""] : nil)
            })
            .id(tracksOffsets ? displayBlock.id : "opening:\(displayBlock.id)")
            .modifier(NativeReaderBlockOffsetModifier(blockID: displayBlock.id, tracksOffset: tracksOffsets))
        }
    }

    @ViewBuilder
    private func openingPassage(document: NativeReaderRuntimeDocument, proxy: ScrollViewProxy) -> some View {
        if let target = pendingInitialBlockID,
           let index = navigationIndex[target]?.displayIndex {
            // Render the same validated source blocks while the full lazy list
            // settles. This preview does not participate in scroll geometry or
            // accept interaction, and never changes the destination identity.
            GeometryReader { geometry in
                let saved = rememberedViewport.wrappedValue
                let matchesViewport = !explicitNavigation && saved?.routeID == route.id && saved?.blockID == target
                    && saved?.theme == library.readerTheme
                    && abs((saved?.width ?? 0) - Double(geometry.size.width)) < 1
                VStack(alignment: .leading, spacing: 0) {
                    readerBlocks(Array(displayBlocks[index..<min(displayBlocks.count, index + 12)]),
                                 document: document, proxy: proxy, tracksOffsets: false,
                                 projectID: library.readerSaveDestinationProject?.id, evidence: library.readerEvidence)
                }
                .codeTabAlignedHorizontalPadding()
                .frame(width: geometry.size.width, alignment: .topLeading)
                .offset(y: matchesViewport ? CGFloat(saved?.minY ?? 0) : 0)
            }
            .clipped()
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
    }

    @MainActor
    private func visibleBlockDidChange(
        _ blockID: String?,
        document: NativeReaderRuntimeDocument
    ) {
        guard pendingInitialBlockID == nil,
              let blockID,
              scrollState.visibleBlockID != blockID else { return }
        let previousBlockID = scrollState.visibleBlockID
        scrollState.visibleBlockID = blockID
        updateCurrentSectionPresentation(
            targetIndex: navigationIndex[blockID]?.sectionTargetIndex,
            updatesRememberedSection: !scrollState.isScrollActive
        )
        if !scrollState.isDecelerating {
            scheduleNearbyTextPrefetch(
                around: blockID,
                previousBlockID: previousBlockID
            )
        }
        scheduleSettledScrollWork(around: blockID, document: document)
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
        if let document, document.documentID == route.documentID {
            scheduleNearbyMediaPrefetch(around: scrollState.visibleBlockID, document: document)
            return
        }
        document = nil
        displayBlocks = []
        sectionTargets = []
        sectionMetadata = .empty
        navigationIndex = .empty
        linkedHighlight = nil
        pendingInitialBlockID = nil
        scrollState.blockPositions = [:]
        scrollState.contentTopInViewport = 0
        scrollState.visibleBlockID = nil
        scrollState.isScrollActive = false
        scrollState.isDecelerating = false
        currentSectionTargetIndex = nil
        failureMessage = nil
        hasRequestedFallback = false
        expandedMedia = nil
        searchQuery = ""
        isSearchPresented = false
        isFindListPresented = false
        findListSelection = nil
        pendingFindSubmission = nil
        searchMatches = []
        searchMatchesByBlock = [:]
        appliedSearchQuery = nil
        appliedSearchRouteID = nil
        isChapterSearchInProgress = false
        activeSearchMatchID = nil
        lastRecordedSectionTargetID = nil
        settledScrollTask?.cancel()
        settledScrollTask = nil
        nearbyMediaPrefetchTask?.cancel()
        nearbyMediaPrefetchTask = nil
        scrollState.textPrefetchTask?.cancel()
        scrollState.textPrefetchTask = nil
        scrollState.lastTextPrefetchCenterIndex = nil

        do {
            let prepared = try await NativeReaderDocumentStore.shared.loadPreparedDocument(for: route)
            guard !Task.isCancelled else { return }
            let loaded = prepared.document
            let highlight = linkedPassage.flatMap { NativeReaderLinkedHighlight.resolve($0,
                sectionNumber: initialSectionNumber, prepared: prepared) }
            let initialBlockID = (rememberedBlockID.wrappedValue == nil ? highlight?.firstBlockID : nil)
                ?? NativeReaderLocationResolver.initialBlockID(
                in: loaded,
                prepared: prepared,
                opensAtChapterTop: opensAtChapterTop,
                rememberedBlockID: rememberedBlockID.wrappedValue,
                rememberedAnchorID: rememberedAnchorID.wrappedValue,
                initialAnchorID: initialAnchorID,
                initialSectionNumber: initialSectionNumber,
                initialSectionTitle: initialSectionTitle
            )
            if let initialBlockID,
               let initialIndex = prepared.navigationIndex[initialBlockID]?.displayIndex {
                let range = NativeReaderAttributedTextPrefetchPlanner.indexRange(
                    blockCount: prepared.displayBlocks.count,
                    centerIndex: initialIndex,
                    direction: 1
                )
                let items = NativeReaderAttributedTextPrefetchPlanner.items(
                    for: prepared.displayBlocks[range],
                    routeID: route.id
                )
                await NativeReaderAttributedTextCache.shared.prewarm(
                    items: items,
                    theme: library.readerTheme,
                    accentColor: library.accentColor(for: chapter.codeSectionID)
                )
                guard !Task.isCancelled else { return }
                scrollState.lastTextPrefetchCenterIndex = initialIndex
            }
            displayBlocks = prepared.displayBlocks
            textLayout.prepare(prepared)
            sectionTargets = prepared.sectionTargets
            sectionMetadata = prepared.sectionMetadata
            navigationIndex = prepared.navigationIndex
            linkedHighlight = highlight
            let requiresInitialRestore = NativeReaderInitialRestorationPolicy.requiresRestoration(
                opensAtChapterTop: opensAtChapterTop,
                targetBlockID: initialBlockID,
                firstBlockID: loaded.blocks.first?.id,
                rememberedViewportBlockID: rememberedViewport.wrappedValue?.blockID
            )
            pendingInitialBlockID = requiresInitialRestore ? initialBlockID : nil
            document = loaded
            if !requiresInitialRestore {
                persistLocation(blockID: initialBlockID)
            }
            scheduleNearbyMediaPrefetch(around: initialBlockID, document: loaded)
            os_signpost(
                .event,
                log: AppSignpost.reader,
                name: "nativeChapterReady",
                "blocks=%{public}d",
                prepared.displayBlocks.count
            )
        } catch {
            guard !Task.isCancelled else { return }
            requestFallbackToHTML(error.localizedDescription)
        }
    }

    @MainActor
    private func scheduleSettledScrollWork(
        around displayBlockID: String?,
        document: NativeReaderRuntimeDocument
    ) {
        settledScrollTask?.cancel()
        settledScrollTask = nil
        guard !scrollState.isScrollActive, let displayBlockID else { return }

        settledScrollTask = Task { @MainActor in
            do {
                try await Task.sleep(for: .milliseconds(250))
            } catch {
                return
            }
            @MainActor func isStillSettled() -> Bool {
                !Task.isCancelled && isBrowserTabActive && pendingInitialBlockID == nil
                    && !scrollState.isScrollActive && scrollState.visibleBlockID == displayBlockID
            }
            guard isStillSettled() else { return }
            if let index = navigationIndex[displayBlockID]?.sectionTargetIndex {
                let target = sectionTargets[index]
                if target.id != lastRecordedSectionTargetID, let sectionID = sectionSummary(for: target)?.id {
                    // Recently Viewed reads the official passage for its preview. A cold
                    // lookup can parse chapter HTML; warm it off the scrolling thread.
                    _ = await library.loadSectionDetailAsync(sectionID: sectionID)
                    guard isStillSettled() else { return }
                }
            }
            persistLocation(blockID: displayBlockID)
            scheduleNearbyMediaPrefetch(around: displayBlockID, document: document)
            settledScrollTask = nil
        }
    }

    @MainActor
    private func scheduleNearbyMediaPrefetch(
        around displayBlockID: String?,
        document: NativeReaderRuntimeDocument
    ) {
        nearbyMediaPrefetchTask?.cancel()
        nearbyMediaPrefetchTask = nil
        guard let displayBlockID,
              let focusedIndex = navigationIndex[displayBlockID]?.sourceIndex
        else { return }

        let startIndex = max(document.blocks.startIndex, focusedIndex - 2)
        let endIndex = min(document.blocks.endIndex, focusedIndex + 3)
        let urls = document.blocks[startIndex..<endIndex]
            .flatMap(\.media)
            .compactMap { NativeReaderDocumentStore.resolvedMediaURL(for: $0, route: route) }
        guard !urls.isEmpty else { return }

        nearbyMediaPrefetchTask = Task(priority: .utility) {
            await ImageBlockCache.shared.prefetchInlineImages(
                from: Array(Set(urls)),
                maxPixelSize: 1_600
            )
        }
    }

    @MainActor
    private func scheduleNearbyTextPrefetch(
        around displayBlockID: String,
        previousBlockID: String?
    ) {
        guard let centerIndex = navigationIndex[displayBlockID]?.displayIndex
        else { return }
        if let lastCenter = scrollState.lastTextPrefetchCenterIndex,
           abs(centerIndex - lastCenter) < 4 {
            return
        }

        let previousIndex = previousBlockID.flatMap { previousID in
            navigationIndex[previousID]?.displayIndex
        }
        let direction = previousIndex.map { centerIndex >= $0 ? 1 : -1 } ?? 1
        let range = NativeReaderAttributedTextPrefetchPlanner.indexRange(
            blockCount: displayBlocks.count,
            centerIndex: centerIndex,
            direction: direction
        )
        let items = NativeReaderAttributedTextPrefetchPlanner.items(
            for: displayBlocks[range],
            routeID: route.id
        )
        guard !items.isEmpty else { return }

        scrollState.lastTextPrefetchCenterIndex = centerIndex
        scrollState.textPrefetchTask?.cancel()
        scrollState.textPrefetchTask = Task { @MainActor in
            await NativeReaderAttributedTextCache.shared.prewarm(
                items: items,
                theme: library.readerTheme,
                accentColor: library.accentColor(for: chapter.codeSectionID)
            )
        }
    }

    @MainActor
    private func traceRestoration(_ event: String, observing target: String? = nil,
                                  phase: String? = nil, detail: String = "") {
#if DEBUG
        guard ProcessInfo.processInfo.arguments.contains("--native-reader-trace-restoration") else { return }
        let now = ProcessInfo.processInfo.systemUptime
        if let target {
            scrollState.debugObservedRestorationTarget = target
            scrollState.debugRestorationStartedAt = now
        }
        if let phase { scrollState.debugRestorationPhase = phase }
        guard let observed = scrollState.debugObservedRestorationTarget,
              let started = scrollState.debugRestorationStartedAt, now - started <= 45 else { return }
        let view = scrollState.scrollView
        let lease = scrollState.restorationLease
        let y = scrollState.viewportY(for: observed)
        let offset = view?.contentOffset.y
        let origin = y.flatMap { y in offset.map { y + $0 } }
        let measuredDelta = lease.flatMap { lease in
            view.flatMap { view in y.map {
                boundedOffset(view.contentOffset.y + $0 - lease.minY, in: view) - view.contentOffset.y
            } }
        }
        let geometry = "target=\(observed) present=\(y != nil) y=\(String(describing: y)) origin=\(String(describing: origin)) offset=\(String(describing: offset)) height=\(String(describing: view?.contentSize.height)) viewport=\(String(describing: view?.bounds.size)) pending=\(pendingInitialBlockID ?? "nil") lease=\(lease?.id.uuidString ?? "nil") desiredMinY=\(String(describing: lease?.minY)) leaseWidth=\(String(describing: lease?.width)) delta=\(String(describing: measuredDelta)) expected=\(String(describing: lease?.expectedOffset)) remaining=\(String(describing: lease?.correctionsRemaining)) reacquiring=\(lease?.isReacquiring ?? false) phase=\(scrollState.debugRestorationPhase) tracking=\(view?.isTracking ?? false) dragging=\(view?.isDragging ?? false) decelerating=\(view?.isDecelerating ?? false) active=\(isBrowserTabActive)"
        if event == "offset-preference" || event == "content-size" {
            guard geometry != scrollState.debugLastRestorationGeometry else { return }
            scrollState.debugLastRestorationGeometry = geometry
        }
        NSLog("PermitextReaderRestoration %@", "elapsed=\(String(format: "%.3f", now - started)) event=\(event) \(geometry) detail=\(detail)")
#endif
    }

    @MainActor
    private func requestFallbackToHTML(_ message: String) {
        failureMessage = message
        guard !hasRequestedFallback else { return }
        hasRequestedFallback = true
        LocalPerformanceRecorder.record(.nativeChapterFallbackRequested)
        // Carry navigation intent without recording an unobserved arrival.
        let requestedBlockID = pendingInitialBlockID ?? scrollState.restorationLease?.blockID
        let requestedAnchorID = requestedBlockID.flatMap { navigationIndex[$0]?.anchorID }
        traceRestoration("fallback", detail: message)
        releaseRestorationLease(reason: "fallback")
        onFallbackToHTML?(message, requestedAnchorID)
    }

    @MainActor
    private func restoreInitialPosition(proxy: ScrollViewProxy) async {
        guard isBrowserTabActive, let targetBlockID = pendingInitialBlockID else { return }
        traceRestoration("initial-start", observing: targetBlockID)
        LocalPerformanceRecorder.record(.nativeChapterPositioningStarted)
        await Task.yield()

        let opensAtLinkedHighlight = linkedHighlight?.firstBlockID == targetBlockID
            && rememberedViewport.wrappedValue == nil && !explicitNavigation
        if opensAtLinkedHighlight, !Task.isCancelled {
            jumpToInitialTarget(targetBlockID, proxy: proxy)
        }
        var alignedY = await alignInitialTarget(targetBlockID, proxy: proxy, revealExactTarget: opensAtLinkedHighlight)
        guard !Task.isCancelled, isBrowserTabActive, pendingInitialBlockID == targetBlockID else { return }
        if let minY = alignedY {
            LocalPerformanceRecorder.record(.nativeChapterTargetPositioned)
            // A fresh evidence link already has an exact measured target.
            // Reveal it during the push and let the lease absorb later layout.
            if !opensAtLinkedHighlight {
                // UIKit can update the safe area and content offset mid-push.
                await scrollState.waitForNavigationTransition()
                LocalPerformanceRecorder.record(.nativeChapterTransitionSettled)
                guard !Task.isCancelled, isBrowserTabActive, pendingInitialBlockID == targetBlockID else { return }
                if initialTargetY(for: targetBlockID) != minY || !targetHasArrived(targetBlockID, minY: minY) {
                    alignedY = await alignInitialTarget(targetBlockID, proxy: proxy)
                }
            }
        }
        guard !Task.isCancelled, isBrowserTabActive, pendingInitialBlockID == targetBlockID else { return }
        guard let targetY = alignedY else {
            LocalPerformanceRecorder.record(.nativeChapterPositioningFailed)
            traceRestoration("alignment-result", detail: "success=false")
            requestFallbackToHTML("The requested passage could not be positioned reliably.")
            return
        }
        traceRestoration("alignment-result", detail: "success=true desiredMinY=\(targetY)")
        beginRestorationLease(blockID: targetBlockID, minY: targetY)
        scrollState.visibleBlockID = targetBlockID
        pendingInitialBlockID = nil
        traceRestoration("revealed")
        explicitNavigation = false
        persistLocation(blockID: targetBlockID)
    }

    private func initialTargetY(for blockID: String) -> CGFloat {
        guard !explicitNavigation, let saved = rememberedViewport.wrappedValue,
              saved.blockID == blockID, saved.routeID == route.id, saved.theme == library.readerTheme,
              rememberedBlockID.wrappedValue == blockID, let view = scrollState.scrollView,
              abs(Double(view.bounds.width) - saved.width) < 1 else { return 0 }
        return CGFloat(saved.minY)
    }

    @MainActor
    private func alignInitialTarget(
        _ targetBlockID: String,
        proxy: ScrollViewProxy,
        revealExactTarget: Bool = false
    ) async -> CGFloat? {
#if DEBUG
        if explicitNavigation && ProcessInfo.processInfo.arguments.contains("--native-reader-force-picker-alignment-failure") {
            return nil
        }
#endif
        var stablePasses = 0
        var previousY: CGFloat?
        for _ in 0..<100 {
            guard !Task.isCancelled, isBrowserTabActive, pendingInitialBlockID == targetBlockID else { return nil }
            let minY = initialTargetY(for: targetBlockID)
            if let view = scrollState.scrollView, view.bounds.height > 0,
               let currentY = scrollState.viewportY(for: targetBlockID), currentY.isFinite {
                let desired = boundedOffset(view.contentOffset.y + currentY - minY, in: view)
                if abs(desired - view.contentOffset.y) >= 1 {
                    view.setContentOffset(CGPoint(x: view.contentOffset.x, y: desired), animated: false)
                    stablePasses = 0
                } else if revealExactTarget && abs(currentY - minY) < 1 {
                    // This rendered row is exactly at the anchor. The lease
                    // will correct shifts from any remaining offscreen layout.
                    return minY
                } else if let previousY, abs(previousY - currentY) < 1,
                          currentY >= minY - 1, currentY < view.bounds.height {
                    stablePasses += 1
                } else { stablePasses = 0 }
                previousY = currentY
            } else {
                jumpToInitialTarget(targetBlockID, proxy: proxy)
                stablePasses = 0
                previousY = nil
            }
            // Offscreen rows can still change the estimated content height.
            // The measured target and the post-reveal lease handle actual shifts.
            if stablePasses >= 3 { return minY }
            try? await Task.sleep(for: .milliseconds(16))
        }
        return nil
    }

    private func jumpToInitialTarget(_ blockID: String, proxy: ScrollViewProxy) {
        var transaction = Transaction(animation: nil)
        transaction.disablesAnimations = true
        withTransaction(transaction) { proxy.scrollTo(blockID, anchor: .top) }
    }

    private func boundedOffset(_ value: CGFloat, in view: UIScrollView) -> CGFloat {
        let lower = -view.adjustedContentInset.top
        let upper = max(lower, view.contentSize.height - view.bounds.height + view.adjustedContentInset.bottom)
        return min(upper, max(lower, value))
    }

    @MainActor
    private func releaseRestorationLease(reason: String) {
        traceRestoration("release", detail: reason)
        scrollState.restorationLease = nil
        scrollState.restorationGeometryTask?.cancel()
        scrollState.restorationGeometryTask = nil
        scrollState.restorationExpiryTask?.cancel()
        scrollState.restorationExpiryTask = nil
    }

    @MainActor
    private func beginRestorationLease(blockID: String, minY: CGFloat) {
        releaseRestorationLease(reason: "replaced")
        guard let view = scrollState.scrollView else { return }
        let lease = NativeReaderRestorationLease(blockID: blockID, minY: minY,
            width: view.bounds.width, previousOffset: view.contentOffset.y,
            previousHeight: view.contentSize.height,
            previousOrigin: scrollState.viewportY(for: blockID).map { $0 + view.contentOffset.y })
        scrollState.restorationLease = lease
        traceRestoration("lease-begin")
        // Safety expiry limits corrective ownership; it never delays revealing
        // an already measured passage or serves as evidence of successful arrival.
        scrollState.restorationExpiryTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(5))
            guard !Task.isCancelled, scrollState.restorationLease?.id == lease.id else { return }
            traceRestoration("expiry-check", detail: "arrived=\(restorationHasArrived(lease))")
            if restorationHasArrived(lease) {
                releaseRestorationLease(reason: "expiry-arrived")
            } else {
                requestFallbackToHTML("The requested passage changed position while its layout settled.")
            }
        }
    }

    private func restorationHasArrived(_ lease: NativeReaderRestorationLease) -> Bool {
        targetHasArrived(lease.blockID, minY: lease.minY)
    }

    private func targetHasArrived(_ blockID: String, minY: CGFloat) -> Bool {
        guard let view = scrollState.scrollView,
              let y = scrollState.viewportY(for: blockID), y.isFinite,
              y >= minY - 1, y < view.bounds.height else { return false }
        return abs(boundedOffset(view.contentOffset.y + y - minY, in: view) - view.contentOffset.y) < 1
    }

    // Returns true while layout is being corrected, withholding intermediate
    // lazy estimates from saved location and section presentation.
    @MainActor
    private func correctLateLayout(proxy: ScrollViewProxy) -> Bool {
        guard pendingInitialBlockID == nil, var lease = scrollState.restorationLease,
              let view = scrollState.scrollView else { return false }
        guard isBrowserTabActive, abs(view.bounds.width - lease.width) < 1,
              !view.isTracking, !view.isDragging, !view.isDecelerating else {
            releaseRestorationLease(reason: !isBrowserTabActive ? "inactive-tab" : abs(view.bounds.width - lease.width) >= 1 ? "width-change" : "touch-or-deceleration")
            return false
        }
        let offset = view.contentOffset.y
        let height = view.contentSize.height
        let y = scrollState.viewportY(for: lease.blockID)
        let origin = y.map { $0 + offset }
        let heightChanged = abs(height - lease.previousHeight) >= 1
        let originChanged = origin.flatMap { current in lease.previousOrigin.map { abs(current - $0) >= 1 } } ?? false
        let offsetChanged = abs(offset - lease.previousOffset) >= 1
        let ownAcknowledgment = lease.expectedOffset.map { abs(offset - $0) < 1 } ?? false
        if offsetChanged && !heightChanged && !originChanged && !ownAcknowledgment && !lease.isReacquiring {
            // Includes accessibility scrolling that does not enter touch phases.
            traceRestoration("offset-only-classification", detail: "heightChanged=\(heightChanged) originChanged=\(originChanged) ownAck=\(ownAcknowledgment)")
            releaseRestorationLease(reason: "offset-only")
            return false
        }
        lease.previousOffset = offset
        lease.previousHeight = height
        lease.previousOrigin = origin
        lease.expectedOffset = nil
        if restorationHasArrived(lease) {
            lease.isReacquiring = false
            scrollState.restorationLease = lease
            return false
        }
        guard lease.correctionsRemaining > 0 else {
            requestFallbackToHTML("The requested passage could not retain its position.")
            return true
        }
        lease.correctionsRemaining -= 1
        if let y, y.isFinite {
            let desired = boundedOffset(offset + y - lease.minY, in: view)
            lease.expectedOffset = desired
            scrollState.restorationLease = lease
            traceRestoration("late-correction", detail: "desiredOffset=\(desired)")
            view.setContentOffset(CGPoint(x: view.contentOffset.x, y: desired), animated: false)
        } else {
            // scrollTo resolves a lazy destination asynchronously. Its resulting
            // offset remains ours until measured arrival, even before the row
            // supplies a frame. Touch/phase cancellation and lease bounds still apply.
            lease.isReacquiring = true
            scrollState.restorationLease = lease
            traceRestoration("late-reacquire")
            var transaction = Transaction(animation: nil)
            transaction.disablesAnimations = true
            withTransaction(transaction) { proxy.scrollTo(lease.blockID, anchor: .top) }
        }
        return true
    }

    @available(iOS 18.0, *)
    @MainActor
    private func scrollPhaseDidChange(
        _ phase: ScrollPhase,
        document: NativeReaderRuntimeDocument
    ) {
        traceRestoration("phase", phase: String(describing: phase))
        if phase != .idle {
            // Tracking starts before isScrolling becomes true. A new gesture
            // must cancel idle work even while it stays within the same block.
            settledScrollTask?.cancel()
            settledScrollTask = nil
            releaseRestorationLease(reason: "phase-\(phase)")
        }
        // Tracking also blocks a late geometry update from queuing fresh idle
        // work while the finger is down but the content has not moved yet.
        scrollState.isScrollActive = phase != .idle
        scrollState.isDecelerating = phase == .decelerating

        guard phase == .idle,
              pendingInitialBlockID == nil,
              let visibleBlockID = scrollState.visibleBlockID else { return }
        scheduleNearbyTextPrefetch(
            around: visibleBlockID,
            previousBlockID: nil
        )
        scheduleSettledScrollWork(around: visibleBlockID, document: document)
    }

    private func persistLocation(blockID: String?) {
        guard let blockID, let location = navigationIndex[blockID] else { return }
        if pendingInitialBlockID == nil,
           let minY = scrollState.viewportY(for: blockID),
           let width = scrollState.scrollView?.bounds.width, width > 0 {
            rememberedViewport.wrappedValue = NativeReaderViewportPosition(routeID: route.id, theme: library.readerTheme, blockID: blockID, minY: Double(minY), width: Double(width))
        }
        if rememberedBlockID.wrappedValue != blockID {
            rememberedBlockID.wrappedValue = blockID
        }
        if let anchorID = location.anchorID,
           rememberedAnchorID.wrappedValue != anchorID {
            rememberedAnchorID.wrappedValue = anchorID
        }
        updateCurrentSectionPresentation(targetIndex: location.sectionTargetIndex)
        if let index = location.sectionTargetIndex {
            recordCurrentSection(sectionTargets[index])
        }
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
        currentSectionTargetIndex.map { sectionTargets[$0] } ?? sectionTargets.first
    }

    private var currentBookmarkSectionID: Int64? {
        guard pendingInitialBlockID == nil else { return nil }
        return NativeReaderBookmarkTargetResolver.sectionID(
            at: currentSectionTargetIndex ?? sectionTargets.indices.first,
            targets: sectionTargets,
            resolve: { sectionSummary(for: $0)?.id }
        )
    }

    private func jumpPicker(
        proxy: ScrollViewProxy,
        document: NativeReaderRuntimeDocument
    ) -> some View {
        ChapterSectionPicker(accent: accentColor, onClose: { isJumpPickerPresented = false }) {
            ForEach(sectionTargets) { target in
                ChapterSectionPickerRow(
                    title: target.menuLabel,
                    depth: target.pickerDepth,
                    isCurrent: currentSectionTargetIndex.map { sectionTargets[$0].id == target.id } ?? false,
                    accent: accentColor
                ) {
                    isJumpPickerPresented = false
                    scroll(to: target.blockID, proxy: proxy, document: document)
                }
            }
        }
    }

    private func navigateSearchMatch(offset: Int, proxy: ScrollViewProxy, document: NativeReaderRuntimeDocument) {
        guard !searchMatches.isEmpty, appliedSearchQuery == searchQuery else { return }
        let next: Int
        if let current = searchMatches.firstIndex(where: { $0.id == activeSearchMatchID }) {
            next = (current + offset + searchMatches.count) % searchMatches.count
        } else {
            let literalMatches = searchMatches.indices.filter {
                searchMatches[$0].kind.rawValue < NativeReaderChapterFindHit.Kind.keywords.rawValue
            }
            let candidates = literalMatches.isEmpty ? Array(searchMatches.indices) : literalMatches
            let visible = scrollState.visibleBlockID.flatMap { navigationIndex[$0]?.displayIndex } ?? 0
            if offset < 0 {
                next = candidates.last { searchMatches[$0].displayIndex <= visible } ?? candidates[candidates.count - 1]
            } else {
                next = candidates.first { searchMatches[$0].displayIndex >= visible } ?? candidates[0]
            }
        }
        activateSearchMatch(searchMatches[next], proxy: proxy, document: document, keepsReadingContext: offset != 0)
    }

    private func chapterFindRows() -> [ChapterFindMatchRow] {
        searchMatches.map { hit in
            let title = hit.sectionIndex.flatMap { sectionTargets.indices.contains($0) ? sectionTargets[$0].menuLabel : nil }
            let detail: String? = switch hit.kind {
            case .sectionNumber: "Section number"
            case .keywords: "Matching words"
            case .similar: "Similar match"
            case .definition, .phrase: nil
            }
            return ChapterFindMatchRow(id: hit.id, title: title ?? chapter.displayLabel, snippet: hit.anchor.snippet, detail: detail)
        }
    }

    private func activateSearchMatch(
        _ hit: NativeReaderChapterFindHit,
        proxy: ScrollViewProxy,
        document: NativeReaderRuntimeDocument,
        keepsReadingContext: Bool = false
    ) {
        guard appliedSearchQuery == searchQuery, searchMatches.contains(where: { $0.id == hit.id }) else { return }
        activeSearchMatchID = hit.id
        scrollState.chapterSelection.clear()
        releaseRestorationLease(reason: "find-match")
        settledScrollTask?.cancel()
        settledScrollTask = nil
        pendingInitialBlockID = nil
        scrollState.findNavigationTask?.cancel()
        let group = textLayout.groups.first { $0.rows.indices.contains(hit.displayIndex) }
        let groupIsSplit = group?.rows.dropFirst().contains { scrollState.exactLayoutBlockIDs.contains($0.id) } ?? false
        let scrollID = groupIsSplit ? hit.anchor.blockID : group?.id ?? hit.anchor.blockID
        let isTextMatch = displayBlocks[hit.displayIndex].block.kind.isTextOnly
        scrollState.findNavigationTask = Task { @MainActor in
            await Task.yield()
            let address = NativeChapterSelectionAddress(block: hit.displayIndex)
            let start = NativeChapterSelectionPosition(address: address, offset: hit.anchor.range.location)
            let end = NativeChapterSelectionPosition(address: address, offset: max(start.offset, NSMaxRange(hit.anchor.range) - 1))
            var didReposition = false
            var alignedPasses = 0
            for _ in 0..<24 {
                guard !Task.isCancelled, let view = scrollState.scrollView,
                      !view.isDragging, !view.isTracking else { return }
                let viewport = keepsReadingContext ? findViewport(in: view) : nil
                let matchRect = scrollState.chapterSelection.findTextRect(at: start, in: view)
                let blockY = !isTextMatch && keepsReadingContext
                    ? scrollState.viewportY(for: scrollID).map { view.bounds.minY + $0 } : nil
                if let matchY = matchRect?.minY ?? blockY {
                    if let viewport, !didReposition {
                        let endY = end == start ? matchRect?.maxY : scrollState.chapterSelection.findTextRect(at: end, in: view)?.maxY
                        let margin = min(24, (viewport.upperBound - viewport.lowerBound) / 6)
                        if matchY >= viewport.lowerBound + margin, (endY ?? matchY) <= viewport.upperBound - margin {
                            scheduleSettledScrollWork(around: scrollState.visibleBlockID, document: document)
                            return
                        }
                    }
                    let landingY = viewport.map { $0.lowerBound + ($0.upperBound - $0.lowerBound) / 3 }
                        ?? (view.bounds.minY + view.adjustedContentInset.top + CodeScreenMetrics.topTitlePadding)
                    let offset = boundedOffset(view.contentOffset.y + matchY - landingY, in: view)
                    if abs(view.contentOffset.y - offset) < 1 {
                        alignedPasses += 1
                        if alignedPasses == 3 { break }
                    } else {
                        didReposition = true
                        alignedPasses = 0
                        view.setContentOffset(CGPoint(x: view.contentOffset.x, y: offset), animated: false)
                    }
                } else if !didReposition || scrollState.viewportY(for: scrollID) == nil {
                    let anchor = keepsReadingContext ? UnitPoint(x: 0.5, y: 1.0 / 3) : .top
                    proxy.scrollTo(scrollID, anchor: anchor)
                    didReposition = true
                }
                try? await Task.sleep(for: .milliseconds(16))
            }
            guard !Task.isCancelled else { return }
            scrollState.visibleBlockID = scrollID
            updateCurrentSectionPresentation(targetIndex: hit.sectionIndex)
            scheduleSettledScrollWork(around: scrollID, document: document)
        }
    }

    private func findViewport(in view: UIScrollView) -> ClosedRange<CGFloat>? {
        var top = view.bounds.minY + view.adjustedContentInset.top
        var bottom = view.bounds.maxY - view.adjustedContentInset.bottom
        if isSearchPresented, let findBar = scrollState.findBar {
            let bar = view.convert(findBar.frame, from: view.window)
            if findBar.isBottom {
                bottom = min(bottom, bar.minY)
            } else {
                top = max(top, bar.maxY)
            }
        }
        return top < bottom ? top...bottom : nil
    }

    private func scroll(
        to blockID: String,
        proxy: ScrollViewProxy,
        document: NativeReaderRuntimeDocument
    ) {
        scrollState.findNavigationTask?.cancel()
        releaseRestorationLease(reason: "new-navigation")
        settledScrollTask?.cancel()
        explicitNavigation = true
        pendingInitialBlockID = blockID
        // The shared measured restoration task owns arrival and persistence.
        // A picker selection is intent, not proof that scrolling succeeded.
    }

    private func updateCurrentSectionPresentation(
        targetIndex: Int?,
        updatesRememberedSection: Bool = true
    ) {
        guard let targetIndex else { return }
        let target = sectionTargets[targetIndex]
        if currentSectionTargetIndex != targetIndex {
            currentSectionTargetIndex = targetIndex
        }

        if updatesRememberedSection,
           let summary = sectionSummary(for: target),
           rememberedSectionID.wrappedValue != summary.id {
            rememberedSectionID.wrappedValue = summary.id
        }
    }

    private func recordCurrentSection(_ target: NativeReaderSectionTarget) {
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
        target: NativeReaderSectionTarget?
    ) {
        let normalized = selectedText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return }
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
        NativeReaderReferenceDestinationResolver.destination(
            for: reference,
            sourceCodeSectionID: chapter.codeSectionID,
            is2022Edition: library.selectedVersion?.authoredHTMLBundlePath?.hasSuffix("/2022-construction-codes") == true,
            codeSections: library.codeSections,
            chapters: { library.chapters(for: $0) },
            sections: { library.sections(for: $0) },
            sectionSummary: {
                library.sectionSummary(sectionNumber: $0, codeSectionID: $1)
            }
        )
    }

}

private struct NativeReaderRestorationLease {
    let id = UUID()
    let blockID: String
    let minY: CGFloat
    let width: CGFloat
    var previousOffset: CGFloat
    var previousHeight: CGFloat
    var previousOrigin: CGFloat?
    var expectedOffset: CGFloat?
    var isReacquiring = false
    var correctionsRemaining = 48
}

@MainActor
private final class NativeReaderScrollState: ObservableObject {
    var exactLayoutBlockIDs: Set<String> = []
    var findNavigationTask: Task<Void, Never>?
    var findBar: (frame: CGRect, isBottom: Bool)?
    @Published var pendingInitialBlockID: String? {
        didSet { if let pendingInitialBlockID { exactLayoutBlockIDs.insert(pendingInitialBlockID) } }
    }

    init(pendingInitialBlockID: String? = nil) {
        self.pendingInitialBlockID = pendingInitialBlockID
        if let pendingInitialBlockID { exactLayoutBlockIDs.insert(pendingInitialBlockID) }
    }

#if DEBUG
    var debugObservedRestorationTarget: String?
    var debugRestorationStartedAt: TimeInterval?
    var debugRestorationPhase = "unknown"
    var debugLastRestorationGeometry: String?
#endif
    var restorationLease: NativeReaderRestorationLease?
    var restorationExpiryTask: Task<Void, Never>?
    var restorationGeometryTask: Task<Void, Never>?
    weak var scrollView: UIScrollView?
    let chapterSelection = NativeChapterSelectionController()
    var blockPositions: [String: CGFloat] = [:]
    var contentTopInViewport: CGFloat = 0
    var visibleBlockID: String?
    var isScrollActive = false
    var isDecelerating = false
    var lastTextPrefetchCenterIndex: Int?
    var textPrefetchTask: Task<Void, Never>?

    func viewportY(for blockID: String) -> CGFloat? {
        // Block positions use content coordinates. Read the current UIKit
        // offset so positioning never re-applies a delta from a SwiftUI
        // viewport report that still describes the preceding scroll offset.
        let contentTop = scrollView.map { -$0.contentOffset.y } ?? contentTopInViewport
        return blockPositions[blockID].map { $0 + contentTop }
    }

    func waitForNavigationTransition() async {
        var responder: UIResponder? = scrollView
        while let current = responder {
            if let controller = current as? UIViewController,
               let coordinator = controller.transitionCoordinator, coordinator.isAnimated {
                await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
                    var resumed = false
                    let finish = {
                        guard !resumed else { return }
                        resumed = true
                        continuation.resume()
                    }
                    let registered = coordinator.animate(alongsideTransition: nil) { _ in finish() }
                    if !registered { finish() }
                }
                return
            }
            responder = current.next
        }
    }
}

enum NativeReaderVisibleBlockResolver {
    static func topBlockID(
        from offsets: [String: CGFloat],
        threshold: CGFloat
    ) -> String? {
        var above: (id: String, y: CGFloat)?
        var below: (id: String, y: CGFloat)?
        for (id, y) in offsets {
            if y <= threshold {
                if y >= (above?.y ?? -.infinity) { above = (id, y) }
            } else if below.map({ y < $0.y }) ?? true {
                below = (id, y)
            }
        }
        return above?.id ?? below?.id
    }
}

private struct NativeReaderBlockOffsetModifier: ViewModifier {
    let blockID: String
    var tracksOffset = true

    @ViewBuilder
    func body(content: Content) -> some View {
        if tracksOffset {
            content.background(
                GeometryReader { geometry in
                    Color.clear.preference(
                        key: NativeReaderBlockOffsetPreferenceKey.self,
                        value: [
                            blockID: geometry.frame(
                                in: .named(nativeReaderContentCoordinateSpace)
                            ).minY
                        ]
                    )
                }
            )
        } else { content }
    }
}

private struct NativeReaderBlockOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: [String: CGFloat] = [:]

    static func reduce(
        value: inout [String: CGFloat],
        nextValue: () -> [String: CGFloat]
    ) {
        value.merge(nextValue(), uniquingKeysWith: { _, new in new })
    }
}

private struct NativeReaderExpandedMedia: Identifiable {
    let id: String
    let image: UIImage
    let accessibilityText: String?
}

struct NativeReaderDisplayBlock: Identifiable, Equatable, Sendable {
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

struct NativeReaderSectionTarget: Identifiable, Hashable, Sendable {
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

    var pickerDepth: Int {
        ChapterSectionPickerRow.depth(title: title, sectionNumber: sectionNumber, fallback: min(level - 1, 2))
    }
}

enum NativeReaderSectionNavigator {
    // Reused across Reader updates; compiling these per heading stalls chapter scrolling.
    private static let headingExpression = try? NSRegularExpression(
        pattern: #"(?i)^\s*(?:(?:SECTION|ARTICLE|PART)\s+)?(?:(?:EBC|FGC|BC|PC|MC|AC|FC|ZR)\s+)?([A-Z]?\d+(?:[.\-]\d+)*(?:\([A-Za-z0-9]+\))?)\b"#
    )
    private static let housingHeadingExpression = try? NSRegularExpression(
        pattern: #"^(\s*27-)\s+(?=\d)"#
    )

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
        // Enacted HMC headings include separately numbered sections such as “27- 2017.4”.
        let normalizedHeading = housingHeadingExpression?.stringByReplacingMatches(
            in: heading,
            range: NSRange(location: 0, length: heading.utf16.count),
            withTemplate: "$1"
        ) ?? heading
        if let token = firstCapture(in: normalizedHeading) {
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

    private static func firstCapture(in value: String) -> String? {
        guard let expression = headingExpression,
              let match = expression.firstMatch(
                  in: value,
                  range: NSRange(location: 0, length: value.utf16.count)
              ),
              let range = Range(match.range(at: 1), in: value) else { return nil }
        return String(value[range])
    }
}

struct NativeReaderSearchMatch: Identifiable, Hashable, Sendable {
    let id: String
    let blockID: String
    let sourceBlockID: String
    let range: NSRange
    let snippet: String
}

/// A chapter/group heading can be visible without having its own saved section.
/// Resolve within that heading's descendants, never through a remembered location.
enum NativeReaderBookmarkTargetResolver {
    static func sectionID(
        at index: Int?,
        targets: [NativeReaderSectionTarget],
        resolve: (NativeReaderSectionTarget) -> Int64?
    ) -> Int64? {
        guard let index, targets.indices.contains(index) else { return nil }
        let target = targets[index]
        if let sectionID = resolve(target) { return sectionID }
        let number = target.sectionNumber?.uppercased()
        let title = target.title.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let isChapterHeading = index == 0 && number == nil
            && (title.hasPrefix("CHAPTER ") || title.hasPrefix("APPENDIX "))
        guard isChapterHeading || number != nil else { return nil }
        for candidate in targets.dropFirst(index + 1) {
            if !isChapterHeading {
                // Authored chapter HTML can give chapter, group and leaf headings
                // the same level. The section number, not HTML depth, bounds a group.
                guard let number, let childNumber = candidate.sectionNumber?.uppercased(),
                      childNumber.hasPrefix(number + ".") || childNumber.hasPrefix(number + "(") else { break }
            }
            if let sectionID = resolve(candidate) { return sectionID }
        }
        return nil
    }
}

enum NativeReaderSearchIndex {
    private static let wordExpression = try! NSRegularExpression(pattern: #"[\p{L}\p{N}]+"#)

    static func matchesAsync(query: String, in blocks: [NativeReaderDisplayBlock]) async -> [NativeReaderSearchMatch] {
        guard !Task.isCancelled else { return [] }
        let work = Task.detached(priority: .userInitiated) {
            matches(query: query, in: blocks)
        }
        let result = await withTaskCancellationHandler {
            await work.value
        } onCancel: { work.cancel() }
        return Task.isCancelled ? [] : result
    }

    static func matches(
        query: String,
        in blocks: [NativeReaderDisplayBlock]
    ) -> [NativeReaderSearchMatch] {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedQuery.isEmpty, !Task.isCancelled else { return [] }
        var definitions: [NativeReaderSearchMatch] = []
        var ordinary: [NativeReaderSearchMatch] = []
        var firstTextByID: [String: String] = [:]
        for displayBlock in blocks {
            guard !Task.isCancelled else { return [] }
            let text = searchableText(for: displayBlock.block)
            if firstTextByID[displayBlock.id] == nil { firstTextByID[displayBlock.id] = text }
            for range in ranges(of: normalizedQuery, in: text) {
                let match = NativeReaderSearchMatch(
                    id: "\(displayBlock.id):\(range.location):\(range.length)",
                    blockID: displayBlock.id,
                    sourceBlockID: displayBlock.sourceBlockID,
                    range: range,
                    snippet: snippet(in: text, around: range)
                )
                // Stable partition preserves the original rank/source ordering
                // without rebuilding block text or sorting every occurrence.
                if definitionRank(text: firstTextByID[displayBlock.id] ?? text, range: range) == 0 { definitions.append(match) }
                else { ordinary.append(match) }
            }
        }
        return Task.isCancelled ? [] : definitions + ordinary
    }

    // A defined term starts a paragraph and ends with a period. Preserve source
    // order among equally ranked matches and retain the original UTF-16 range.
    static func definitionRank(text: String, range: NSRange) -> Int {
        let source = text as NSString
        guard range.location == 0, NSMaxRange(range) <= source.length else { return 1 }
        let term = source.substring(with: range)
        let suffix = source.substring(from: NSMaxRange(range)).trimmingCharacters(in: .whitespacesAndNewlines)
        return term == term.uppercased() && suffix.hasPrefix(".") ? 0 : 1
    }

    static func ranges(of query: String, in text: String) -> [NSRange] {
        let ranges = exactRanges(of: query, in: text)
        return ranges.isEmpty ? fuzzyRanges(of: query, in: text) : ranges
    }

    static func exactRanges(of query: String, in text: String) -> [NSRange] {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let source = text as NSString
        guard !normalizedQuery.isEmpty, source.length > 0 else { return [] }

        var ranges: [NSRange] = []
        var searchRange = NSRange(location: 0, length: source.length)
        while searchRange.length > 0 {
            guard !Task.isCancelled else { return [] }
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

    static func fuzzyRanges(of query: String, in text: String) -> [NSRange] {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let source = text as NSString
        guard !normalizedQuery.isEmpty, source.length > 0 else { return [] }
        // Fall back to consecutive words with at most two edits for words of eight letters,
        // or one edit for shorter words. Never fuzz short words or numbers.
        let expression = wordExpression
        let queryWords = expression.matches(in: normalizedQuery, range: NSRange(location: 0, length: (normalizedQuery as NSString).length))
            .map { (normalizedQuery as NSString).substring(with: $0.range).lowercased() }
        let words = expression.matches(in: text, range: NSRange(location: 0, length: source.length))
        guard !queryWords.isEmpty, words.count >= queryWords.count else { return [] }
        var ranges: [NSRange] = []
        for start in 0...(words.count - queryWords.count) {
            guard !Task.isCancelled else { return [] }
            let window = Array(words[start..<(start + queryWords.count)])
            if zip(queryWords, window).allSatisfy({ wordMatches($0.0, source.substring(with: $0.1.range).lowercased()) }) {
                ranges.append(NSRange(location: window[0].range.location, length: NSMaxRange(window.last!.range) - window[0].range.location))
            }
        }
        return ranges
    }

    private static func wordMatches(_ query: String, _ word: String) -> Bool {
        if query == word { return true }
        let limit = query.count >= 8 ? 2 : 1
        guard query.count >= 5, word.count >= 5,
              query.allSatisfy(\.isLetter), word.allSatisfy(\.isLetter),
              abs(query.count - word.count) <= limit else { return false }
        let a = Array(query), b = Array(word)
        var previous = Array(0...b.count)
        for i in 1...a.count {
            var row = [i] + Array(repeating: 0, count: b.count)
            for j in 1...b.count {
                row[j] = min(row[j - 1] + 1, previous[j] + 1,
                             previous[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1))
            }
            previous = row
        }
        return previous[b.count] <= limit
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

    static func snippet(in text: String, around range: NSRange) -> String {
        let source = text as NSString
        let start = max(0, range.location - 48)
        let end = min(source.length, range.location + range.length + 72)
        let fragment = source.substring(with: NSRange(location: start, length: end - start))
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return "\(start > 0 ? "…" : "")\(fragment)\(end < source.length ? "…" : "")"
    }
}

enum NativeReaderReferenceKind: String, Hashable {
    case section
    case article
    case chapter
    case appendix
}

struct NativeReaderReference: Hashable {
    let kind: NativeReaderReferenceKind
    let codePrefix: String?
    let token: String
    var exceptionNumber: String? = nil

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
    private static let namedSectionPattern = try! NSRegularExpression(
        pattern: #"(?i)\b(?:(BC|PC|MC|FGC|AC|FC|ZR)\s+)?section\s+([A-Z]?\d{2,}(?:[.-][0-9A-Za-z]+)*)"#
    )
    private static let namedCodePattern = try! NSRegularExpression(
        pattern: #"(?i)^\s*(?:,\s*exception\s+(\d+))?\s+of\s+the\s+(?:(?:new\s+york\s+city|nyc)\s+)?(building\s+code|plumbing\s+code|mechanical\s+code|fuel\s+gas\s+code|fire\s+code)\b"#
    )

    static func qualifiedSection(in suffix: String) -> (prefix: String, exceptionNumber: String?)? {
        let excerpt = String(suffix.prefix(140))
        guard let match = namedCodePattern.firstMatch(in: excerpt, range: NSRange(excerpt.startIndex..., in: excerpt)),
              let name = Range(match.range(at: 2), in: excerpt) else { return nil }
        let names = ["building code": "BC", "plumbing code": "PC", "mechanical code": "MC",
                     "fuel gas code": "FGC", "fire code": "FC"]
        let key = excerpt[name].lowercased().split(whereSeparator: \.isWhitespace).joined(separator: " ")
        guard let prefix = names[key] else { return nil }
        return (prefix, Range(match.range(at: 1), in: excerpt).map { String(excerpt[$0]) })
    }

    static func namedSectionLinks(in text: String) -> [(NSRange, URL)] {
        guard text.range(of: "section", options: .caseInsensitive) != nil else { return [] }
        return namedSectionPattern.matches(in: text, range: NSRange(text.startIndex..., in: text)).compactMap { match in
            guard match.range(at: 1).location == NSNotFound,
                  let span = Range(match.range, in: text),
                  let token = Range(match.range(at: 2), in: text),
                  let qualified = qualifiedSection(in: String(text[span.upperBound...].prefix(140))) else { return nil }
            var destination = URLComponents()
            destination.fragment = "JD_\(qualified.prefix)\(text[token])"
            if let exceptionNumber = qualified.exceptionNumber {
                destination.queryItems = [URLQueryItem(name: "exception", value: exceptionNumber)]
            }
            guard let url = destination.url else { return nil }
            return (match.range, url)
        }
    }

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

        for title in ["24", "25", "26", "27", "28"] {
            if let token = firstCapture(
                in: fragment,
                pattern: "(?i)^T\(title)C([A-Z0-9-]+)$"
            ) {
                return NativeReaderReference(
                    kind: .chapter,
                    codePrefix: "T\(title)",
                    token: normalizedChapterToken(token)
                )
            }
        }
        if let localLaw = firstCapture(
            in: fragment,
            pattern: #"(?i)^L\.L\.\s*(\d{4}/\d{1,3})$"#
        ) {
            return NativeReaderReference(
                kind: .section,
                codePrefix: "LL",
                token: "L.L. \(localLaw)"
            )
        }

        var codePrefix: String?
        for prefix in ["FGC", "EBC", "BC", "PC", "MC", "AC", "FC", "ZR"] {
            if fragment.uppercased().hasPrefix(prefix) {
                codePrefix = prefix
                fragment.removeFirst(prefix.count)
                break
            }
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
        if let title = firstCapture(in: stripped, pattern: #"^(2[4-8])-"#),
           firstCapture(
               in: stripped,
               pattern: #"^([0-9]+(?:[.\-][0-9A-Za-z]+)*(?:\([A-Za-z0-9]+\))?)"#
           ) != nil {
            let normalizedToken = stripped.uppercased()
            let kind: NativeReaderReferenceKind = title == "28"
                && firstCapture(in: normalizedToken, pattern: #"^(28-\d{3})$"#) != nil
                ? .article
                : .section
            return NativeReaderReference(
                kind: kind,
                codePrefix: "T\(title)",
                token: normalizedToken
            )
        }
        guard let token = firstCapture(
            in: stripped,
            pattern: #"^([A-Z]?\d+(?:[.\-]\d+)*(?:\([A-Za-z0-9]+\))?)"#
        ) else { return nil }
        return NativeReaderReference(
            kind: .section,
            codePrefix: codePrefix,
            token: token.uppercased(),
            exceptionNumber: URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "exception" })?.value
        )
    }

    private static func normalizedChapterToken(_ value: String) -> String {
        let uppercase = value.uppercased()
        if let suffixStart = uppercase.firstIndex(where: { $0.isLetter }) {
            let numberPart = uppercase[..<suffixStart]
            let suffixPart = uppercase[suffixStart...]
            if !numberPart.isEmpty,
               numberPart.allSatisfy({ $0.isNumber }),
               suffixPart.allSatisfy({ $0.isLetter }) {
                let normalizedNumber = numberPart.drop(while: { $0 == "0" })
                let number = normalizedNumber.isEmpty ? "0" : String(normalizedNumber)
                return "\(number)-\(suffixPart)"
            }
        }

        let normalized = uppercase.drop(while: { $0 == "0" })
        return normalized.isEmpty ? "0" : String(normalized)
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

enum NativeReaderCodeSectionResolver {
    static func targetCodeSectionID(
        for reference: NativeReaderReference,
        sourceCodeSectionID: Int64?,
        codeSections: [CodeSectionCategory]
    ) -> Int64? {
        guard let prefix = reference.codePrefix else { return sourceCodeSectionID }
        return codeSectionID(for: prefix, in: codeSections)
    }

    static func codeSectionID(
        for prefix: String,
        in codeSections: [CodeSectionCategory]
    ) -> Int64? {
        let normalizedPrefix = prefix.uppercased()
        let match: (String) -> Int64? = { fragment in
            codeSections.first { $0.name.uppercased().contains(fragment) }?.id
        }
        switch normalizedPrefix {
        case "BC":
            return codeSections.first {
                let name = $0.name.uppercased()
                return name.contains("BUILDING CODE")
                    && !name.contains("EXISTING")
                    && !name.contains("1968")
            }?.id
        case "EBC": return match("EXISTING BUILDING")
        case "PC": return match("PLUMBING")
        case "MC": return match("MECHANICAL")
        case "FGC": return match("FUEL GAS")
        case "AC": return match("GENERAL ADMINISTRATIVE")
        case "FC": return match("FIRE CODE")
        case "ZR": return match("ZONING")
        case "T24": return match("TITLE 24")
        case "T25": return match("TITLE 25")
        case "T26": return match("TITLE 26")
        case "T27": return match("HOUSING MAINTENANCE")
        case "T28": return match("TITLE 28") ?? match("GENERAL ADMINISTRATIVE")
        case "LL": return match("CONSTRUCTION-RELATED LOCAL LAWS")
        default: return nil
        }
    }
}

enum NativeReaderReferenceDestinationResolver {
    static func destination(
        for reference: NativeReaderReference,
        sourceCodeSectionID: Int64?,
        is2022Edition: Bool = false,
        codeSections: [CodeSectionCategory],
        chapters: (Int64) -> [CodeChapter],
        sections: (CodeChapter) -> [CodeSectionSummary],
        sectionSummary: (String, Int64) -> CodeSectionSummary?
    ) -> CodeSectionSummary? {
        guard let targetCodeSectionID = NativeReaderCodeSectionResolver.targetCodeSectionID(
            for: reference,
            sourceCodeSectionID: sourceCodeSectionID,
            codeSections: codeSections
        ) else { return nil }

        switch reference.kind {
        case .section:
            // NYC PC Table 403.1 retains the exception's former number.
            if is2022Edition, reference.codePrefix == "BC", reference.token == "303.1",
               reference.exceptionNumber == "2",
               let plumbing = NativeReaderCodeSectionResolver.codeSectionID(for: "PC", in: codeSections),
               sourceCodeSectionID == plumbing {
                return sectionSummary("303.1.2", targetCodeSectionID)
            }
            for candidate in reference.sectionNumberCandidates {
                if let destination = sectionSummary(candidate, targetCodeSectionID) {
                    return destination
                }
            }
            return nil
        case .article:
            if let destination = sectionSummary(reference.token, targetCodeSectionID) {
                return destination
            }
            let provisionPrefix = "\(reference.token)."
            for chapter in chapters(targetCodeSectionID) {
                if let destination = sections(chapter).first(where: {
                    $0.sectionNumber.caseInsensitiveCompare(reference.token) == .orderedSame
                        || $0.sectionNumber.uppercased().hasPrefix(provisionPrefix.uppercased())
                }) {
                    return destination
                }
            }
            return nil
        case .chapter, .appendix:
            guard let targetChapter = chapters(targetCodeSectionID).first(where: {
                $0.chapterNumber.caseInsensitiveCompare(reference.token) == .orderedSame
            }) else { return nil }
            return sections(targetChapter).first
        }
    }
}

enum NativeReaderInitialRestorationPolicy {
    static func requiresRestoration(
        opensAtChapterTop: Bool,
        targetBlockID: String?,
        firstBlockID: String?,
        rememberedViewportBlockID: String?
    ) -> Bool {
        guard let targetBlockID else { return false }
        // Chapter cards explicitly request the top of a fresh ScrollView. A
        // saved offset within its first block must not hide this opening while
        // the restoration loop aligns a position the user did not request.
        if opensAtChapterTop, targetBlockID == firstBlockID { return false }
        return targetBlockID != firstBlockID || rememberedViewportBlockID == targetBlockID
    }
}

enum NativeReaderLocationResolver {
    static func initialBlockID(
        in document: NativeReaderRuntimeDocument,
        prepared: NativeReaderPreparedDocument? = nil,
        opensAtChapterTop: Bool = false,
        rememberedBlockID: String?,
        rememberedAnchorID: String?,
        initialAnchorID: String?,
        initialSectionNumber: String,
        initialSectionTitle: String = ""
    ) -> String? {
        if opensAtChapterTop {
            return document.blocks.first?.id
        }

        if let rememberedBlockID {
            let hasBlock = prepared.map { $0.navigationIndex[rememberedBlockID] != nil }
                ?? NativeReaderDisplayBlock.blocks(from: document.blocks).contains { $0.id == rememberedBlockID }
            if hasBlock { return rememberedBlockID }
        }
        for anchorID in [rememberedAnchorID, initialAnchorID].compactMap({ $0 }) {
            if let blockID = blockID(forAnchorID: anchorID, in: document) {
                return blockID
            }
        }

        let normalizedSection = normalizedSectionNumber(initialSectionNumber)
        let normalizedTitle = normalizedSectionNumber(initialSectionTitle)
        let numericPrefix = normalizedSection.prefix { $0.isASCII && ($0.isNumber || $0 == ".") }
        if !normalizedSection.isEmpty, !normalizedTitle.isEmpty {
            let rows = prepared?.displayBlocks ?? NativeReaderDisplayBlock.blocks(from: document.blocks)
            let matches = rows.filter { display in
                let raw = display.block.plainText
                // Ordinary ASCII letters and digits survive the leading trim. Reject
                // these mismatches before running a whitespace regex over a full passage.
                if !numericPrefix.isEmpty, let first = raw.first,
                   first.isASCII && (first.isLetter || first.isNumber),
                   !raw.utf8.starts(with: numericPrefix.utf8) { return false }
                let text = normalizedSectionNumber(raw)
                guard text.hasPrefix(normalizedSection) else { return false }
                let suffix = String(text.dropFirst(normalizedSection.count))
                guard let first = suffix.first, first.isWhitespace || ".:;".contains(first) else { return false }
                let body = suffix.trimmingCharacters(in: .whitespacesAndNewlines.union(CharacterSet(charactersIn: ".:;")))
                return body == normalizedTitle || body.hasPrefix(normalizedTitle + " ")
            }
            if matches.count == 1 { return matches[0].id }
        }
        if !normalizedSection.isEmpty,
           let heading = document.blocks.first(where: { block in
               guard block.kind == .heading else { return false }
               if !numericPrefix.isEmpty, !block.plainText.contains(numericPrefix) { return false }
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

    static func normalizedSectionNumber(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .uppercased()
    }
}

private struct NativeReaderTextBlockView: View, Equatable {
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
    var saved: NativeReaderSavedText = .none
    var blockIndex = 0
    var chapterSelectionTarget: NativeChapterSelectionTarget? = nil
    let onResearchSelection: (String) -> Void

    @Environment(\.tabNavigationHorizontalInset) private var tabNavigationHorizontalInset

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.block == rhs.block
            && lhs.hierarchyIndentation == rhs.hierarchyIndentation
            && lhs.usesCompactSpacing == rhs.usesCompactSpacing
            && lhs.theme == rhs.theme
            && lhs.accentColor.isEqual(rhs.accentColor)
            && lhs.route == rhs.route
            && lhs.searchQuery == rhs.searchQuery
            && lhs.searchMatches == rhs.searchMatches
            && lhs.activeSearchMatchID == rhs.activeSearchMatchID
            && lhs.saved == rhs.saved && lhs.blockIndex == rhs.blockIndex
            && lhs.chapterSelectionTarget == rhs.chapterSelectionTarget
    }

    var body: some View {
        Group {
            switch block.kind {
            case .heading:
                heading
            case .paragraph:
                selectableText(role: .body)
            case .orderedList, .unorderedList:
                NativeReaderListBlockView(
                    cachePrefix: route.id,
                    items: block.listItems,
                    ordered: block.kind == .orderedList,
                    theme: theme,
                    accentColor: accentColor,
                    baseURL: route.sourceURL.deletingLastPathComponent(),
                    onOpenLink: onOpenLink,
                    searchQuery: searchQuery,
                    onResearchSelection: onResearchSelection,
                    saved: saved, blockIndex: blockIndex,
                    chapterSelectionTarget: chapterSelectionTarget
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
                        theme: theme,
                        accentColor: accentColor,
                        onOpenLink: onOpenLink,
                        searchQuery: searchQuery,
                        activeMatchIndex: searchMatches.firstIndex(where: { $0.id == activeSearchMatchID })
                    )
                    .containerRelativeFrame(.horizontal) { viewportWidth, _ in
                        max(
                            viewportWidth
                                - ((CodeScreenMetrics.readerHorizontalPadding - tabNavigationHorizontalInset) * 2)
                                - hierarchyIndentation,
                            0
                        )
                    }
                }
            case .unsupportedHTML:
                EmptyView()
            }
        }
        .padding(.top, topSpacing)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.leading, block.kind == .heading ? 0 : hierarchyIndentation)
        .padding(.bottom, bottomSpacing)
        .accessibilityIdentifier("native-reader-block-\(block.id)")
        .overlay {
            if !searchMatches.isEmpty,
               [.table, .image, .figure].contains(block.kind) {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(Color(uiColor: accentColor), lineWidth: activeBlockMatch ? 2 : 1)
                    .accessibilityHidden(true)
                    .allowsHitTesting(false)
            }
        }
        .accessibilityValue([
            saved.contains(block: blockIndex) ? "Saved text" : "",
            searchMatches.isEmpty ? "" : "\(searchMatches.count) search matches"
        ].filter { !$0.isEmpty }.joined(separator: ", "))
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
        let cacheID = NativeReaderAttributedTextCacheKey.block(
            routeID: route.id,
            blockID: block.id,
            role: role
        )
        return NativeReaderPreparedAttributedTextView(
            cacheID: cacheID,
            runs: block.runs,
            fallbackText: block.plainText,
            theme: theme,
            role: role,
            accentColor: accentColor,
            highlightRanges: searchMatches.map(\.range),
            activeHighlightRanges: searchMatches.filter { $0.id == activeSearchMatchID }.map(\.range),
            onOpenLink: onOpenLink,
            onResearchSelection: onResearchSelection,
            saved: saved, address: .init(block: blockIndex),
            chapterSelectionTarget: chapterSelectionTarget
        )
    }

    private var activeBlockMatch: Bool {
        searchMatches.contains(where: { $0.id == activeSearchMatchID })
    }

    private var topSpacing: CGFloat {
        guard block.kind == .heading else { return 0 }
        switch NativeReaderHeadingPresentation(block: block).style {
        case .chapter: return 0
        case .majorSection: return 20
        case .provision: return 16
        }
    }

    private var bottomSpacing: CGFloat {
        switch block.kind {
        case .heading:
            return NativeReaderHeadingPresentation(block: block).level <= 2 ? 14 : 8
        case .paragraph, .orderedList, .unorderedList:
            if usesCompactSpacing {
                return max(CGFloat(theme.paragraphSpacing), 12)
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

#if DEBUG
struct NativeReaderPhase9SnapshotConfiguration: Equatable {
    static let sourceArgument = "--native-reader-phase9-source"
    static let widthArgument = "--native-reader-phase9-width"
    static let startingBlockArgument = "--native-reader-phase9-starting-block"
    static let searchArgument = "--native-reader-phase9-search"
    static let startingBlockIDArgument = "--native-reader-phase9-starting-block-id"

    let relativeSourcePath: String
    let contentWidth: CGFloat
    let startingBlockIndex: Int
    var searchQuery: String = ""
    var startingBlockID: String = ""

    static var active: Self? {
        let arguments = ProcessInfo.processInfo.arguments
        guard let sourceIndex = arguments.firstIndex(of: sourceArgument),
              arguments.indices.contains(sourceIndex + 1)
        else { return nil }
        let relativeSourcePath = arguments[sourceIndex + 1]
        let requestedWidth: CGFloat
        if let widthIndex = arguments.firstIndex(of: widthArgument),
           arguments.indices.contains(widthIndex + 1),
           let parsedWidth = Double(arguments[widthIndex + 1]) {
            requestedWidth = CGFloat(parsedWidth)
        } else {
            requestedWidth = 402
        }
        let requestedStartingBlock: Int
        if let blockIndex = arguments.firstIndex(of: startingBlockArgument),
           arguments.indices.contains(blockIndex + 1),
           let parsedBlock = Int(arguments[blockIndex + 1]) {
            requestedStartingBlock = parsedBlock
        } else {
            requestedStartingBlock = 0
        }
        guard !relativeSourcePath.isEmpty,
              !relativeSourcePath.hasPrefix("/"),
              !relativeSourcePath.split(separator: "/").contains(".."),
              requestedWidth >= 280,
              requestedStartingBlock >= 0
        else { return nil }
        return Self(
            relativeSourcePath: relativeSourcePath,
            contentWidth: requestedWidth,
            startingBlockIndex: requestedStartingBlock,
            searchQuery: arguments.firstIndex(of: searchArgument).flatMap { index in
                arguments.indices.contains(index + 1) ? arguments[index + 1] : nil
            } ?? "",
            startingBlockID: arguments.firstIndex(of: startingBlockIDArgument).flatMap { index in
                arguments.indices.contains(index + 1) ? arguments[index + 1] : nil
            } ?? ""
        )
    }
}

struct NativeReaderPhase9SnapshotHarness: View {
    let configuration: NativeReaderPhase9SnapshotConfiguration

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var route: NativeReaderDocumentRoute?
    @State private var preparedDocument: NativeReaderPreparedDocument?
    @State private var failureMessage: String?

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                CodeAppBackdrop.color.ignoresSafeArea()
                Group {
                    if let route, let preparedDocument {
                        snapshotReader(route: route, preparedDocument: preparedDocument)
                    } else if let failureMessage {
                        ContentUnavailableView(
                            "Phase 9 snapshot failed",
                            systemImage: "exclamationmark.triangle.fill",
                            description: Text(failureMessage)
                        )
                    } else {
                        ProgressView("Preparing Phase 9 snapshot…")
                    }
                }
                .frame(width: min(configuration.contentWidth, geometry.size.width))
                .frame(maxHeight: .infinity)
                .background(Color(uiColor: .systemBackground))
                .clipped()
            }
        }
        .task(id: configuration.relativeSourcePath) {
            await loadSnapshot()
        }
    }

    private func snapshotReader(
        route: NativeReaderDocumentRoute,
        preparedDocument: NativeReaderPreparedDocument
    ) -> some View {
        let startingIndex = preparedDocument.displayBlocks.firstIndex {
            $0.id == configuration.startingBlockID
        } ?? configuration.startingBlockIndex
        return ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(preparedDocument.displayBlocks.dropFirst(startingIndex)) { displayBlock in
                    NativeReaderTextBlockView(
                        block: displayBlock.block,
                        hierarchyIndentation: displayBlock.hierarchyIndentation,
                        usesCompactSpacing: displayBlock.usesCompactSpacing,
                        theme: library.readerTheme,
                        accentColor: library.accentColor(
                            for: preparedDocument.document.metadata.codeSectionID
                        ),
                        route: route,
                        onOpenLink: { _ in },
                        onOpenMedia: { _, _ in },
                        onMediaFailure: { _ in },
                        searchQuery: configuration.searchQuery,
                        searchMatches: NativeReaderSearchIndex.matches(query: configuration.searchQuery, in: [displayBlock]),
                        activeSearchMatchID: nil,
                        onResearchSelection: { _ in }
                    )
                }
            }
            .padding(.horizontal, CodeScreenMetrics.readerHorizontalPadding)
            .padding(.top, CodeScreenMetrics.topTitlePadding)
            .padding(.bottom, 28)
        }
        .overlay(alignment: .topTrailing) {
            Text("Phase 9 snapshot ready")
                .font(.caption2)
                .foregroundStyle(.clear)
                .accessibilityIdentifier("phase9-snapshot-ready")
        }
    }

    @MainActor
    private func loadSnapshot() async {
        failureMessage = nil
        route = nil
        preparedDocument = nil
        guard let loadedRoute = await NativeReaderDocumentStore.shared.debugValidatedRoute(
            forRelativeSourcePath: configuration.relativeSourcePath
        ) else {
            failureMessage = "The requested chapter is not eligible for validated native rendering."
            return
        }
        do {
            let loadedDocument = try await NativeReaderDocumentStore.shared.loadPreparedDocument(
                for: loadedRoute
            )
            guard !Task.isCancelled else { return }
            if !configuration.startingBlockID.isEmpty,
               !loadedDocument.displayBlocks.contains(where: { $0.id == configuration.startingBlockID }) {
                failureMessage = "The requested snapshot block is absent from the validated chapter."
                return
            }
            route = loadedRoute
            preparedDocument = loadedDocument
        } catch {
            guard !Task.isCancelled else { return }
            failureMessage = error.localizedDescription
        }
    }
}
#endif

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
                            if media.assetExists {
                                onMediaFailure("The native Reader could not resolve \(media.id).")
                            }
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
    let cachePrefix: String
    let items: [NativeReaderRuntimeListItem]
    let ordered: Bool
    let theme: ReaderTheme
    let accentColor: UIColor
    let baseURL: URL?
    let onOpenLink: (URL) -> Void
    let searchQuery: String
    let onResearchSelection: (String) -> Void
    var saved: NativeReaderSavedText = .none
    var blockIndex = 0
    var chapterSelectionTarget: NativeChapterSelectionTarget? = nil

    private var rows: [NativeReaderListRow] {
        items.flatMap { NativeReaderListRow.flatten($0) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { rowIndex, row in
                VStack(alignment: .leading, spacing: 8) {
                    if row.segments.isEmpty {
                        textRow(
                            marker: marker(for: row),
                            cacheID: NativeReaderAttributedTextCacheKey.list(
                                routeID: cachePrefix,
                                rowID: row.id
                            ),
                            runs: row.runs,
                            plainText: row.plainText,
                            address: .init(block: blockIndex, row: rowIndex),
                            selectionTarget: chapterSelectionTarget?.listText(row: rowIndex)
                        )
                    } else {
                        ForEach(Array(row.segments.enumerated()), id: \.element.id) { index, segment in
                            switch segment.kind {
                            case .text:
                                textRow(
                                    marker: index == 0 ? marker(for: row) : "",
                                    cacheID: NativeReaderAttributedTextCacheKey.list(
                                        routeID: cachePrefix,
                                        rowID: segment.id
                                    ),
                                    runs: segment.runs,
                                    plainText: segment.plainText,
                                    address: .init(block: blockIndex, row: rowIndex, segment: index),
                                    selectionTarget: chapterSelectionTarget?.listText(row: rowIndex, segment: index)
                                )
                            case .table:
                                if let table = segment.table {
                                    HStack(alignment: .top, spacing: 8) {
                                        Text(index == 0 ? marker(for: row) : "")
                                            .font(theme.swiftUIFont(emphasized: true))
                                            .foregroundStyle(Color(uiColor: accentColor))
                                            .frame(minWidth: 18, alignment: .trailing)
                                        NativeReaderTableBlockView(
                                            table: table,
                                            baseURL: baseURL,
                                            theme: theme,
                                            accentColor: accentColor,
                                            onOpenLink: onOpenLink,
                                            searchQuery: searchQuery,
                                            activeMatchIndex: nil
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(.leading, CGFloat(max(row.depth, 0)) * 18)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func textRow(
        marker: String,
        cacheID: String,
        runs: [NativeReaderRuntimeTextRun],
        plainText: String,
        address: NativeChapterSelectionAddress,
        selectionTarget: NativeChapterSelectionTarget?
    ) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(marker)
                .font(theme.swiftUIFont(emphasized: true))
                .foregroundStyle(Color(uiColor: accentColor))
                .frame(minWidth: 18, alignment: .trailing)
            NativeReaderPreparedAttributedTextView(
                cacheID: cacheID,
                runs: runs,
                fallbackText: plainText,
                theme: theme,
                role: .body,
                accentColor: accentColor,
                highlightRanges: NativeReaderSearchIndex.ranges(
                    of: searchQuery,
                    in: plainText
                ),
                onOpenLink: onOpenLink,
                onResearchSelection: onResearchSelection,
                saved: saved, address: address,
                chapterSelectionTarget: selectionTarget
            )
        }
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
    let segments: [NativeReaderRuntimeListSegment]

    static func flatten(_ item: NativeReaderRuntimeListItem) -> [NativeReaderListRow] {
        [
            NativeReaderListRow(
                id: item.id,
                depth: item.depth,
                ordinal: item.ordinal,
                plainText: item.plainText,
                runs: item.runs,
                segments: item.segments
            )
        ] + item.children.flatMap(flatten)
    }
}

struct LinkedReaderPassage: Encodable, Equatable {
    let passages: [NotebookEvidencePassage]
    let occurrences: [String: [Int]]
}

private struct NativeReaderLinkedHighlight {
    let targetIndex: Int
    let firstBlockID: String?
    let savedText: NativeReaderSavedText

    static func resolve(_ link: LinkedReaderPassage, sectionNumber: String,
                        prepared: NativeReaderPreparedDocument) -> Self? {
        let section = NativeReaderLocationResolver.normalizedSectionNumber(sectionNumber)
        guard !section.isEmpty else { return nil }
        let matches = prepared.sectionTargets.indices.filter { index in
            let number = prepared.sectionTargets[index].sectionNumber ?? ""
            return NativeReaderLocationResolver.normalizedSectionNumber(number) == section
        }
        guard matches.count == 1, let target = matches.first,
              let passage = NativeReaderTextGroupStore.passage(in: prepared, target: target) else { return nil }
        let ranges = passage.linkedRanges(link)
        let first = ranges.keys.map(\.block).min().map { prepared.displayBlocks[$0].id }
        return Self(targetIndex: target, firstBlockID: first, savedText: .ranges(ranges))
    }
}

enum NativeReaderSavedText: Equatable {
    case none
    case whole
    case ranges([NativeChapterSelectionAddress: [NSRange]])

    func contains(block: Int) -> Bool {
        switch self {
        case .none: return false
        case .whole: return true
        case .ranges(let ranges): return ranges.keys.contains { $0.block == block }
        }
    }

    func applying(to source: NSAttributedString, address: NativeChapterSelectionAddress, accent: UIColor) -> NSAttributedString {
        let spans: [NSRange]
        switch self {
        case .none: return source
        case .whole: spans = [NSRange(location: 0, length: source.length)]
        case .ranges(let ranges): spans = ranges[address] ?? []
        }
        return Self.applying(to: source, spans: spans, accent: accent)
    }

    static func applying(to source: NSAttributedString, spans: [NSRange], accent: UIColor,
                         preserveForegroundWithBackground: Bool = true) -> NSAttributedString {
        guard !spans.isEmpty else { return source }
        let result = NSMutableAttributedString(attributedString: source)
        let colors: [NSAttributedString.Key: Any] = [.foregroundColor: accent, .nativeReaderSavedForeground: accent]
        for span in spans where NSMaxRange(span) <= source.length {
            if !preserveForegroundWithBackground {
                result.addAttributes(colors, range: span)
                continue
            }
            source.enumerateAttribute(.backgroundColor, in: span) { background, range, _ in
                if background == nil {
                    result.addAttributes(colors, range: range)
                }
            }
        }
        return result
    }
}

// Evidence stores verbatim excerpts per provision. Match against its continuous
// text so a selection spanning paragraphs colors only the selected characters.
struct NativeReaderPassageText {
    struct Segment {
        let address: NativeChapterSelectionAddress
        let text: String
    }

    let segments: [Segment]
    private let text: NSString
    private let searchText: SearchText
    private let locations: [(address: NativeChapterSelectionAddress, inPassage: NSRange, leadingSpace: Int)]

    init(rows: ArraySlice<NativeReaderDisplayBlock>) {
        segments = rows.indices.flatMap { NativeReaderChapterSelectionText.segments(in: rows[$0].block, index: $0) }
            .filter { !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        var parts: [String] = []
        var locations: [(address: NativeChapterSelectionAddress, inPassage: NSRange, leadingSpace: Int)] = []
        var offset = 0
        for segment in segments {
            let trimmed = segment.text.trimmingCharacters(in: .whitespacesAndNewlines)
            let local = (segment.text as NSString).range(of: trimmed, options: .literal)
            if !parts.isEmpty { offset += 1 }
            parts.append(trimmed)
            locations.append((segment.address, NSRange(location: offset, length: local.length), local.location))
            offset += local.length
        }
        let text = parts.joined(separator: "\n")
        self.text = text as NSString
        self.searchText = SearchText(text)
        self.locations = locations
    }

    var range: NativeChapterSelectionRange? {
        guard let first = segments.first, let last = segments.last else { return nil }
        return .init(.init(address: first.address, offset: 0),
                     .init(address: last.address, offset: last.text.utf16.count))
    }

    func offset(for selection: NativeChapterSelectionRange, quote: String) -> Int? {
        for (part, segment) in zip(locations, segments) {
            let original = segment.text as NSString
            guard let selected = selection.range(in: part.address, length: original.length) else { continue }
            let snippet = original.substring(with: selected).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !snippet.isEmpty else { continue }
            let local = original.range(of: snippet, options: .literal, range: selected)
            let offset = part.inPassage.location + local.location - part.leadingSpace
            guard valid(quote, at: offset) else { return nil }
            return offset
        }
        return nil
    }

    private func valid(_ quote: String, at offset: Int) -> Bool {
        let length = quote.utf16.count
        guard offset >= 0, offset <= text.length - length else { return false }
        return text.substring(with: NSRange(location: offset, length: length)) == quote
    }

    /// Match the web Reader's whitespace folding, preserving UTF-16 offsets into the
    /// native text for painting. A match may cross a paragraph, a link, or an inline style.
    private struct SearchText {
        let string: NSString
        let sourceOffsets: [Int]

        init(_ source: String) {
            var units: [UInt16] = []
            var offsets: [Int] = []
            var afterSpace = false
            for (offset, unit) in source.utf16.enumerated() {
                // ECMAScript WhiteSpace and LineTerminator (the web Reader uses /\s+/).
                switch unit {
                case 0x09...0x0D, 0x20, 0xA0, 0x1680, 0x2000...0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF:
                    if afterSpace { continue }
                    afterSpace = true
                    units.append(0x20)
                default:
                    afterSpace = false
                    units.append(unit)
                }
                offsets.append(offset)
            }
            offsets.append(source.utf16.count)
            self.string = String(decoding: units, as: UTF16.self) as NSString
            self.sourceOffsets = offsets
        }

        func matches(_ quote: String) -> [NSRange] {
            let needle = (SearchText(quote).string as String).trimmingCharacters(in: CharacterSet(charactersIn: " "))
            guard !needle.isEmpty else { return [] }
            var matches: [NSRange] = []
            var start = 0
            while start < string.length {
                let range = string.range(of: needle, options: .literal,
                                         range: NSRange(location: start, length: string.length - start))
                guard range.location != NSNotFound else { break }
                let sourceStart = sourceOffsets[range.location]
                matches.append(NSRange(location: sourceStart, length: sourceOffsets[NSMaxRange(range)] - sourceStart))
                start = range.location + 1 // Include overlapping occurrences, just as String.indexOf does on web.
            }
            return matches
        }

        var trimmed: String { (string as String).trimmingCharacters(in: CharacterSet(charactersIn: " ")) }
    }

    func occurrences(for selection: NativeChapterSelectionRange, quote: String) -> [Int] {
        guard let selected = offset(for: selection, quote: quote),
              let ordinal = searchText.matches(quote).firstIndex(where: { $0.location == selected }) else { return [] }
        return [ordinal]
    }

    func highlight(_ evidence: ReaderEvidenceText) -> NativeReaderSavedText {
        var ranges: [NativeChapterSelectionAddress: [NSRange]] = [:]
        for excerpt in evidence.excerpts where !excerpt.isEmpty {
            let candidates = searchText.matches(excerpt)
            let selected = Set(evidence.occurrences[excerpt] ?? [])
            for (ordinal, match) in candidates.enumerated() {
                // Both readers resolve anchored quotes strictly. Older device-local
                // offsets cannot identify a shared occurrence on the other device.
                guard selected.isEmpty ? candidates.count == 1 : selected.contains(ordinal) else { continue }
                append(match, to: &ranges)
            }
        }
        return .ranges(ranges)
    }

    func linkedRanges(_ link: LinkedReaderPassage) -> [NativeChapterSelectionAddress: [NSRange]] {
        var ranges: [NativeChapterSelectionAddress: [NSRange]] = [:]
        for quote in link.passages {
            let matches = searchText.matches(quote.exact)
            if let ordinals = link.occurrences[quote.exact], !ordinals.isEmpty {
                for ordinal in Set(ordinals) where matches.indices.contains(ordinal) {
                    append(matches[ordinal], to: &ranges)
                }
                continue
            }
            if matches.count == 1, let match = matches.first {
                append(match, to: &ranges)
                continue
            }
            guard matches.count > 1 else { continue }
            let prefix = SearchText(quote.prefix).trimmed
            let suffix = SearchText(quote.suffix).trimmed
            guard !prefix.isEmpty || !suffix.isEmpty else { continue }
            let contextual = matches.filter { match in
                let before = text.substring(to: match.location)
                let after = text.substring(from: NSMaxRange(match))
                return (prefix.isEmpty || SearchText(before).trimmed.hasSuffix(prefix))
                    && (suffix.isEmpty || SearchText(after).trimmed.hasPrefix(suffix))
            }
            if contextual.count == 1, let match = contextual.first { append(match, to: &ranges) }
        }
        return ranges
    }

    private func append(_ match: NSRange, to ranges: inout [NativeChapterSelectionAddress: [NSRange]]) {
        for location in locations {
            let overlap = NSIntersectionRange(match, location.inPassage)
            guard overlap.length > 0 else { continue }
            ranges[location.address, default: []].append(.init(
                location: location.leadingSpace + overlap.location - location.inPassage.location, length: overlap.length))
        }
    }
}

enum NativeReaderChapterSelectionText {
    static func segments(in block: NativeReaderRuntimeBlock, index: Int) -> [NativeReaderPassageText.Segment] {
        var result: [NativeReaderPassageText.Segment] = []
        func append(_ runs: [NativeReaderRuntimeTextRun], fallback: String, row: Int = 0, segment: Int = 0) {
            let text = runs.isEmpty ? fallback : runs.map(\.text).joined()
            if !text.isEmpty {
                result.append(.init(address: .init(block: index, row: row, segment: segment), text: text))
            }
        }
        switch block.kind {
        case .heading, .paragraph, .caption, .footnote, .sourceNote, .editorNote:
            append(block.runs, fallback: block.plainText)
        case .orderedList, .unorderedList:
            for (rowIndex, row) in block.listItems.flatMap(NativeReaderListRow.flatten).enumerated() {
                if row.segments.isEmpty {
                    append(row.runs, fallback: row.plainText, row: rowIndex)
                } else {
                    for (index, segment) in row.segments.enumerated() where segment.kind == .text {
                        append(segment.runs, fallback: segment.plainText, row: rowIndex, segment: index)
                    }
                }
            }
        case .table, .figure, .image, .divider, .unsupportedHTML:
            break
        }
        return result
    }

    static func resolve(_ selection: NativeChapterSelectionRange, in blocks: [NativeReaderDisplayBlock],
                        sectionID: (String) -> Int64?) -> NativeChapterSelectedText {
        guard blocks.indices.contains(selection.start.address.block),
              blocks.indices.contains(selection.end.address.block) else {
            return NativeChapterSelectedText(text: "", citations: [])
        }
        var selectedBlocks: [String] = []
        var excerpts: [(sectionID: Int64, paragraphs: [String])] = []
        for blockIndex in selection.start.address.block...selection.end.address.block {
            let display = blocks[blockIndex]
            let block = display.block
            var paragraphs: [String] = []
            for segment in segments(in: block, index: blockIndex) {
                let text = segment.text as NSString
                guard let range = selection.range(in: segment.address, length: text.length) else { continue }
                let excerpt = text.substring(with: text.rangeOfComposedCharacterSequences(for: range))
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                if !excerpt.isEmpty { paragraphs.append(excerpt) }
            }
            guard !paragraphs.isEmpty else { continue }
            selectedBlocks.append(contentsOf: paragraphs)
            guard let id = sectionID(display.id) else { continue }
            if let last = excerpts.indices.last, excerpts[last].sectionID == id {
                excerpts[last].paragraphs.append(contentsOf: paragraphs)
            } else {
                excerpts.append((id, paragraphs))
            }
        }
        return NativeChapterSelectedText(text: selectedBlocks.joined(separator: "\n"), citations: excerpts.map {
            ResearchSelectionRequest(sectionID: String($0.sectionID), selectedText: $0.paragraphs.joined(separator: "\n"))
        })
    }
}

enum NativeReaderAttributedTextCacheKey {
    static func block(
        routeID: String,
        blockID: String,
        role: NativeReaderTypographyRole
    ) -> String {
        "\(routeID)|\(blockID)|\(role.cacheComponent)"
    }

    static func list(routeID: String, rowID: String) -> String {
        "\(routeID)|list|\(rowID)"
    }

    static func base(
        cacheID: String,
        theme: ReaderTheme,
        accentColor: UIColor
    ) -> String {
        "\(cacheID)|\(theme.hashValue)|\(accentColor.hash)|base"
    }
}

enum NativeReaderTypographyRole: Equatable, Sendable {
    case majorHeading(level: Int)
    case heading(level: Int)
    case body
    case caption
    case footnote
    case note

    var cacheComponent: String {
        switch self {
        case .majorHeading(let level):
            return "major-heading-\(level)"
        case .heading(let level):
            return "heading-\(level)"
        case .body:
            return "body"
        case .caption:
            return "caption"
        case .footnote:
            return "footnote"
        case .note:
            return "note"
        }
    }
}

struct NativeReaderAttributedTextPrefetchItem: Equatable, Sendable {
    let cacheID: String
    let runs: [NativeReaderRuntimeTextRun]
    let fallbackText: String
    let role: NativeReaderTypographyRole
}

enum NativeReaderAttributedTextPrefetchPlanner {
    static func indexRange(
        blockCount: Int,
        centerIndex: Int,
        direction: Int,
        behindCount: Int = 4,
        aheadCount: Int = 24
    ) -> Range<Int> {
        guard blockCount > 0 else { return 0..<0 }
        let center = min(max(centerIndex, 0), blockCount - 1)
        if direction >= 0 {
            return max(0, center - behindCount)..<min(blockCount, center + aheadCount + 1)
        }
        return max(0, center - aheadCount)..<min(blockCount, center + behindCount + 1)
    }

    static func items(
        for displayBlocks: ArraySlice<NativeReaderDisplayBlock>,
        routeID: String
    ) -> [NativeReaderAttributedTextPrefetchItem] {
        displayBlocks.flatMap { displayBlock in
            items(for: displayBlock.block, routeID: routeID)
        }
    }

    private static func items(
        for block: NativeReaderRuntimeBlock,
        routeID: String
    ) -> [NativeReaderAttributedTextPrefetchItem] {
        if block.kind == .orderedList || block.kind == .unorderedList {
            return block.listItems.flatMap { listItems(for: $0, routeID: routeID) }
        }

        let role: NativeReaderTypographyRole?
        switch block.kind {
        case .heading:
            let presentation = NativeReaderHeadingPresentation(block: block)
            role = presentation.style == .provision
                ? .heading(level: presentation.level)
                : .majorHeading(level: presentation.level)
        case .paragraph:
            role = .body
        case .caption:
            role = .caption
        case .footnote:
            role = .footnote
        case .sourceNote, .editorNote:
            role = .note
        default:
            role = nil
        }
        guard let role else { return [] }
        return [
            NativeReaderAttributedTextPrefetchItem(
                cacheID: NativeReaderAttributedTextCacheKey.block(
                    routeID: routeID,
                    blockID: block.id,
                    role: role
                ),
                runs: block.runs,
                fallbackText: block.plainText,
                role: role
            )
        ]
    }

    private static func listItems(
        for item: NativeReaderRuntimeListItem,
        routeID: String
    ) -> [NativeReaderAttributedTextPrefetchItem] {
        [
            NativeReaderAttributedTextPrefetchItem(
                cacheID: NativeReaderAttributedTextCacheKey.list(
                    routeID: routeID,
                    rowID: item.id
                ),
                runs: item.runs,
                fallbackText: item.plainText,
                role: .body
            )
        ] + item.children.flatMap { listItems(for: $0, routeID: routeID) }
    }
}

private final class CachedNativeReaderAttributedText: NSObject, @unchecked Sendable {
    let value: NSAttributedString

    init(_ value: NSAttributedString) {
        self.value = value
    }
}

final class NativeReaderAttributedTextCache: @unchecked Sendable {
    static let shared = NativeReaderAttributedTextCache()

    private let cache: NSCache<NSString, CachedNativeReaderAttributedText> = {
        let cache = NSCache<NSString, CachedNativeReaderAttributedText>()
        cache.countLimit = 256
        cache.totalCostLimit = 24 * 1024 * 1024
        return cache
    }()

    private init() {}

    func baseAttributedText(
        cacheKey: String,
        runs: [NativeReaderRuntimeTextRun],
        fallbackText: String,
        theme: ReaderTheme,
        role: NativeReaderTypographyRole,
        accentColor: UIColor
    ) -> NSAttributedString {
        let key = cacheKey as NSString
        if let cached = cache.object(forKey: key) {
            return cached.value
        }
        let value = NativeReaderAttributedTextBuilder.attributedText(
            runs: runs,
            fallbackText: fallbackText,
            theme: theme,
            role: role,
            accentColor: accentColor
        )
        cache.setObject(
            CachedNativeReaderAttributedText(value),
            forKey: key,
            cost: max(value.length * 4, fallbackText.utf8.count)
        )
        return value
    }

    func prewarm(
        items: [NativeReaderAttributedTextPrefetchItem],
        theme: ReaderTheme,
        accentColor: UIColor
    ) async {
        guard !items.isEmpty else { return }
        let work = Task.detached(priority: .utility) { [self] in
            for item in items {
                try Task.checkCancellation()
                _ = baseAttributedText(
                    cacheKey: NativeReaderAttributedTextCacheKey.base(
                        cacheID: item.cacheID,
                        theme: theme,
                        accentColor: accentColor
                    ),
                    runs: item.runs,
                    fallbackText: item.fallbackText,
                    theme: theme,
                    role: item.role,
                    accentColor: accentColor
                )
            }
        }
        do {
            try await withTaskCancellationHandler {
                try await work.value
            } onCancel: {
                work.cancel()
            }
        } catch {
            return
        }
    }

    func removeAll() {
        cache.removeAllObjects()
    }
}

private struct NativeReaderPreparedAttributedTextView: View {
    let cacheID: String
    let runs: [NativeReaderRuntimeTextRun]
    let fallbackText: String
    let theme: ReaderTheme
    let role: NativeReaderTypographyRole
    let accentColor: UIColor
    let highlightRanges: [NSRange]
    var activeHighlightRanges: [NSRange] = []
    let onOpenLink: (URL) -> Void
    let onResearchSelection: (String) -> Void
    var saved: NativeReaderSavedText = .none
    var address = NativeChapterSelectionAddress(block: 0)
    var chapterSelectionTarget: NativeChapterSelectionTarget? = nil

    @Environment(\.readerDefinitionContext) private var definitionContext
    var body: some View {
        let source = saved.applying(to: baseAttributedText, address: address, accent: accentColor)
        AttributedTextView(
            attributedText: NativeReaderFindTint.applying(to: source, ranges: highlightRanges, activeRanges: activeHighlightRanges),
            onOpenLink: onOpenLink,
            onResearchSelection: onResearchSelection,
            chapterSelectionTarget: chapterSelectionTarget,
            supportsInlineImages: false
        )
        .environment(\.readerDefinitionContext, allowsDefinitionLinks ? definitionContext : nil)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var allowsDefinitionLinks: Bool {
        switch role {
        case .heading, .majorHeading: return false
        default: return true
        }
    }

    private var baseAttributedText: NSAttributedString {
        NativeReaderAttributedTextCache.shared.baseAttributedText(
            cacheKey: baseTaskID,
            runs: runs,
            fallbackText: fallbackText,
            theme: theme,
            role: role,
            accentColor: accentColor
        )
    }

    private var baseTaskID: String {
        NativeReaderAttributedTextCacheKey.base(
            cacheID: cacheID,
            theme: theme,
            accentColor: accentColor
        )
    }

}

enum NativeReaderFindTint {
    static func applying(to text: NSAttributedString, ranges: [NSRange], activeRanges: [NSRange]) -> NSAttributedString {
        guard !ranges.isEmpty else { return text }
        let tinted = NSMutableAttributedString(attributedString: text)
        let active = Set(activeRanges)
        for range in ranges where range.length > 0 && NSMaxRange(range) <= text.length {
            let isActive = active.contains(range)
            tinted.addAttribute(.backgroundColor, value: UIColor.systemYellow.withAlphaComponent(isActive ? 0.54 : 0.24), range: range)
            if isActive {
                tinted.addAttribute(.underlineStyle, value: NSUnderlineStyle.single.rawValue, range: range)
            }
        }
        return tinted
    }
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
        let mutableParagraphStyle = NSMutableParagraphStyle()
        mutableParagraphStyle.lineSpacing = CGFloat(theme.lineSpacing)
        mutableParagraphStyle.paragraphSpacing = 0
        mutableParagraphStyle.lineBreakMode = .byWordWrapping
        let paragraphStyle = mutableParagraphStyle.copy() as! NSParagraphStyle
        let textColor = foregroundColor(for: role, accentColor: accentColor)
        // Theme and role are fixed within this build. Reuse each font variant
        // without retaining scaled fonts across Dynamic Type or theme changes.
        var fonts: [FontStyleKey: UIFont] = [:]
        let result = NSMutableAttributedString()
        for run in effectiveRuns where !run.text.isEmpty {
            let fontKey = FontStyleKey(styles: run.styles)
            let runFont: UIFont
            if let cached = fonts[fontKey] {
                runFont = cached
            } else {
                runFont = font(for: run.styles, theme: theme, role: role)
                fonts[fontKey] = runFont
            }
            result.append(
                NSAttributedString(
                    string: run.text,
                    attributes: attributes(
                        for: run,
                        font: runFont,
                        paragraphStyle: paragraphStyle,
                        foregroundColor: textColor,
                        accentColor: accentColor
                    )
                )
            )
        }
        for (range, url) in NativeReaderLinkResolver.namedSectionLinks(in: result.string) {
            var hasAuthoredLink = false
            result.enumerateAttribute(.link, in: range) { value, _, stop in
                if value != nil { hasAuthoredLink = true; stop.pointee = true }
            }
            if !hasAuthoredLink {
                result.addAttributes([.link: url, .foregroundColor: accentColor,
                                      .underlineStyle: NSUnderlineStyle.single.rawValue], range: range)
            }
        }
        for range in highlightRanges where NSMaxRange(range) <= result.length {
            result.addAttribute(
                .underlineStyle,
                value: NSUnderlineStyle.single.rawValue,
                range: range
            )
        }
        if let activeHighlightRange,
           NSMaxRange(activeHighlightRange) <= result.length {
            result.addAttributes(
                [
                    .underlineColor: UIColor.label,
                    .underlineStyle: NSUnderlineStyle.single.rawValue,
                    .backgroundColor: accentColor.withAlphaComponent(0.20)
                ],
                range: activeHighlightRange
            )
        }
        return result
    }

    private struct FontStyleKey: Hashable {
        let bold: Bool
        let italic: Bool
        let reducedSize: Bool

        init(styles: [NativeReaderRuntimeTextStyle]) {
            bold = styles.contains(.bold)
            italic = styles.contains(.italic)
            reducedSize = styles.contains(.small) || styles.contains(.superscript) || styles.contains(.subscript)
        }
    }

    private static func attributes(
        for run: NativeReaderRuntimeTextRun,
        font: UIFont,
        paragraphStyle: NSParagraphStyle,
        foregroundColor: UIColor,
        accentColor: UIColor
    ) -> [NSAttributedString.Key: Any] {
        var attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: foregroundColor,
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
        let bodySize = max(CGFloat(theme.fontSize), CGFloat(ReaderTheme.minimumFontSize))
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
        let baseFont = theme.bodyFont.withSize(effectiveSize)

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

// Avoid flashing a loading indicator during cached reads or position restoration.
private struct NativeReaderLoadingPlaceholder: View {
    @State private var showProgress = false

    var body: some View {
        Group {
            if showProgress {
                ProgressView().accessibilityLabel("Loading chapter")
            } else {
                Color.clear
            }
        }
        .task {
            do {
                try await Task.sleep(for: .milliseconds(350))
                showProgress = true
            } catch { }
        }
    }
}

private struct NativeReaderScrollViewProbe: UIViewRepresentable {
    var resolved: (UIScrollView) -> Void

    func makeUIView(context: Context) -> ProbeView { ProbeView(frame: .zero) }

    func updateUIView(_ view: ProbeView, context: Context) {
        view.resolved = resolved
        view.scheduleResolution()
    }

    final class ProbeView: UIView {
        var resolved: ((UIScrollView) -> Void)?
        private weak var resolvedScrollView: UIScrollView?
        private var resolutionScheduled = false

        override func didMoveToSuperview() {
            super.didMoveToSuperview()
            resolvedScrollView = nil
            scheduleResolution()
        }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            scheduleResolution()
        }

        override func layoutSubviews() {
            super.layoutSubviews()
            if resolvedScrollView == nil { scheduleResolution() }
        }

        func scheduleResolution() {
            guard !resolutionScheduled else { return }
            resolutionScheduled = true
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                resolutionScheduled = false
                var ancestor = superview
                while let current = ancestor {
                    if let scrollView = current as? UIScrollView {
                        resolvedScrollView = scrollView
                        resolved?(scrollView)
                        return
                    }
                    ancestor = current.superview
                }
            }
        }
    }
}

/// Small text documents avoid recycling variable-height UIKit text rows while
/// their geometry feeds passage tracking. Both limits bound eager layout work;
/// tables, media, nested lists, unsupported HTML, and larger documents retain lazy layout.
enum NativeReaderStackPolicy {
    static let maximumEagerBlocks = 32
    static let maximumEagerUTF16Count = 32_768

    static func usesEagerStack(_ blocks: [NativeReaderDisplayBlock]) -> Bool {
        guard !blocks.isEmpty, blocks.count <= maximumEagerBlocks else { return false }
        var textCount = 0
        for item in blocks {
            guard item.block.kind.isTextOnly, item.block.media.isEmpty,
                  item.block.table == nil, item.block.listItems.isEmpty else { return false }
            textCount += item.block.plainText.utf16.count
            guard textCount <= maximumEagerUTF16Count else { return false }
        }
        return true
    }
}

private final class NativeReaderTextGroupStore: ObservableObject {
    @Published private(set) var groups: [NativeReaderTextGroup] = []
    private var prepared: NativeReaderPreparedDocument?
    private var textByTarget: [Int: NativeReaderPassageText] = [:]
    private var savedByTarget: [Int: (evidence: ReaderEvidenceText, saved: NativeReaderSavedText)] = [:]
    private var findIndex: Task<NativeReaderChapterFindIndex, Never>?

    init(prepared: NativeReaderPreparedDocument? = nil) {
        if let prepared { prepare(prepared) }
    }

    func prepare(_ document: NativeReaderPreparedDocument) {
        prepared = document
        findIndex?.cancel()
        findIndex = nil
        textByTarget.removeAll()
        savedByTarget.removeAll()
        groups = NativeReaderTextGroup.isEnabled ? NativeReaderTextGroup.plan(document) : []
    }

    func prewarmFindIndex() {
        guard findIndex == nil, let prepared else { return }
        findIndex = Task.detached(priority: .userInitiated) { NativeReaderChapterFindIndex(prepared) }
    }

    func findMatches(query: String) async -> [NativeReaderChapterFindHit] {
        prewarmFindIndex()
        guard let index = await findIndex?.value, !Task.isCancelled else { return [] }
        let matching = Task.detached(priority: .userInitiated) { index.matches(query) }
        return await withTaskCancellationHandler {
            await matching.value
        } onCancel: {
            matching.cancel()
        }
    }

    func passage(_ target: Int) -> NativeReaderPassageText? {
        if let cached = textByTarget[target] { return cached }
        guard let prepared, let value = Self.passage(in: prepared, target: target) else { return nil }
        textByTarget[target] = value
        return value
    }

    static func passage(in prepared: NativeReaderPreparedDocument, target: Int) -> NativeReaderPassageText? {
        guard prepared.sectionTargets.indices.contains(target),
              let start = prepared.navigationIndex[prepared.sectionTargets[target].blockID]?.displayIndex else { return nil }
        let end = prepared.displayBlocks[start...].firstIndex {
            prepared.navigationIndex[$0.id]?.sectionTargetIndex != target
        } ?? prepared.displayBlocks.endIndex
        return NativeReaderPassageText(rows: prepared.displayBlocks[start..<end])
    }

    func passageRange(_ target: Int) -> NativeChapterSelectionRange? { passage(target)?.range }

    func savedText(_ evidence: ReaderEvidenceText, target: Int) -> NativeReaderSavedText {
        if evidence.excerpts.isEmpty { return .whole }
        if let cached = savedByTarget[target], cached.evidence == evidence { return cached.saved }
        let saved = passage(target)?.highlight(evidence) ?? .none
        savedByTarget[target] = (evidence, saved)
        return saved
    }
}

struct NativeReaderTextGroup: Identifiable, Equatable {
#if DEBUG
    static let isEnabled = !ProcessInfo.processInfo.arguments.contains("--native-reader-ungrouped-text")
#else
    static let isEnabled = true
#endif

    let id: String
    let rows: ArraySlice<NativeReaderDisplayBlock>

    static func plan(_ prepared: NativeReaderPreparedDocument) -> [Self] {
        let blocks = prepared.displayBlocks
        var groups: [Self] = []
        var start = blocks.startIndex
        while start < blocks.endIndex {
            let first = blocks[start]
            var end = start + 1
            var length = first.block.plainText.utf16.count
            if first.block.kind == .paragraph || (first.block.kind == .heading && NativeReaderHeadingPresentation(block: first.block).style == .provision) {
                let target = prepared.navigationIndex[first.id]?.sectionTargetIndex
                while end < blocks.endIndex && end - start < 6 {
                    let next = blocks[end]
                    guard next.block.kind == .paragraph,
                          prepared.navigationIndex[next.id]?.sectionTargetIndex == target else { break }
                    // Some editions attach the source section ID only to the heading.
                    // Every paragraph in a group must share its definition scope.
                    let inheritsHeading = end == start + 1 && first.block.kind == .heading && target != nil
                        && (first.block.sectionID == nil || next.block.sectionID == nil)
                    guard inheritsHeading || next.block.sectionID == blocks[end - 1].block.sectionID else { break }
                    length += 1 + next.block.plainText.utf16.count
                    guard length <= 3_000 else { break }
                    end += 1
                }
            }
            groups.append(Self(id: first.id, rows: blocks[start..<end]))
            start = end
        }
        return groups
    }
}

/// Uses the same selectable UIKit text host as the live reader. Each grouped
/// passage adds its typography and authored links to the shared text storage.
struct NativeReaderGroupedTextView: View, Equatable {
    let group: NativeReaderTextGroup
    let routeID: String
    let theme: ReaderTheme
    let accent: UIColor
    let saved: NativeReaderSavedText
    let selection: NativeChapterSelectionController
    let highlights: [NativeReaderSearchMatch]
    let activeSearchMatchID: String?
    let onOpenLink: (URL) -> Void
    let onResearch: (String) -> Void

    @Environment(\.readerDefinitionContext) private var definitionContext
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @StateObject private var composition = NativeReaderGroupedTextComposition()

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.group == rhs.group && lhs.saved == rhs.saved && lhs.selection === rhs.selection && lhs.routeID == rhs.routeID
            && lhs.theme == rhs.theme && lhs.accent.isEqual(rhs.accent) && lhs.highlights == rhs.highlights
            && lhs.activeSearchMatchID == rhs.activeSearchMatchID
    }

    var body: some View {
        let first = group.rows.first!
        let last = group.rows.last!
        let heading = first.block.kind == .heading ? NativeReaderHeadingPresentation(block: first.block) : nil
        let topInset: CGFloat = switch heading?.style {
        case .provision: 16
        case .majorSection: 20
        default: 0
        }
        let content = composition.content(for: .init(group: group, routeID: routeID, theme: theme,
            accent: accent, saved: saved, definitionContext: definitionContext, dynamicTypeSize: dynamicTypeSize),
            build: compose)
        let matches = searchRanges(components: content.components)
        let text = NativeReaderFindTint.applying(to: content.text, ranges: matches.ranges, activeRanges: matches.active)
        AttributedTextView(attributedText: text, onOpenLink: onOpenLink, onResearchSelection: onResearch,
                           chapterSelectionTarget: NativeChapterSelectionTarget(controller: selection,
                               address: .init(block: group.rows.startIndex), components: content.components),
                           supportsInlineImages: false, definitionsAlreadyApplied: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .topLeading) {
                if let heading, heading.style == .provision {
                    let headingText = baseText(for: first, role: .heading(level: heading.level))
                    Text(AttributedString(headingText))
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .hidden()
                        .overlay(alignment: .leading) {
                            Capsule().fill(Color(uiColor: accent)).frame(width: 3).offset(x: -12)
                        }
                        .padding(.leading, heading.indentation + 12)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
            }
            .padding(.top, topInset)
            .padding(.bottom, gap(after: last))
            .accessibilityIdentifier("native-reader-text-group-\(group.id)")
            .accessibilityValue([
                group.rows.indices.contains(where: saved.contains(block:)) ? "Saved text" : "",
                highlights.isEmpty ? "" : "\(Set(highlights.map(\.id)).count) search matches"
            ].filter { !$0.isEmpty }.joined(separator: ", "))
    }

    private func compose() -> (text: NSAttributedString, components: [NSRange]) {
        let text = NSMutableAttributedString()
        var components: [NSRange] = []
        for (index, row) in group.rows.enumerated() {
            var role = NativeReaderTypographyRole.body
            var indent = row.hierarchyIndentation
            if row.block.kind == .heading {
                let heading = NativeReaderHeadingPresentation(block: row.block)
                if heading.style == .provision {
                    role = .heading(level: heading.level)
                    indent = heading.indentation + 12
                } else {
                    role = .majorHeading(level: heading.level)
                    indent = 0
                }
            }
            let base = baseText(for: row, role: role)
            let decorated = row.block.kind == .paragraph
                ? definitionContext.map { ReaderDefinitionStore.shared.matcher(for: $0).decorating(base) } ?? base
                : base
            let source = saved.applying(to: decorated,
                                        address: .init(block: group.rows.startIndex + index), accent: accent)
            components.append(NSRange(location: text.length, length: source.length))
            guard source.length > 0 else { continue }
            let component = NSMutableAttributedString(attributedString: source)
            let style = (source.attribute(.paragraphStyle, at: 0, effectiveRange: nil) as? NSParagraphStyle)?
                .mutableCopy() as? NSMutableParagraphStyle ?? NSMutableParagraphStyle()
            style.headIndent = indent
            style.firstLineHeadIndent = indent
            component.addAttribute(.paragraphStyle, value: style.copy() as! NSParagraphStyle,
                                   range: NSRange(location: 0, length: component.length))
            if index < group.rows.count - 1 {
                let endStyle = style.mutableCopy() as! NSMutableParagraphStyle
                endStyle.paragraphSpacing = gap(after: row)
                let lastParagraph = (component.string as NSString).paragraphRange(
                    for: NSRange(location: component.length - 1, length: 1)
                )
                let paragraphStyle = endStyle.copy() as! NSParagraphStyle
                component.addAttribute(.paragraphStyle, value: paragraphStyle, range: lastParagraph)
                var separator = component.attributes(at: component.length - 1, effectiveRange: nil)
                separator.removeValue(forKey: .link)
                component.append(NSAttributedString(string: "\n", attributes: separator))
            }
            text.append(component)
        }
        return (text.copy() as! NSAttributedString, components)
    }

    private func searchRanges(components: [NSRange]) -> (ranges: [NSRange], active: [NSRange]) {
        var ranges: [NSRange] = []
        var active: [NSRange] = []
        for hit in highlights {
            guard let index = group.rows.firstIndex(where: { $0.id == hit.blockID }) else { continue }
            let component = components[index - group.rows.startIndex]
            guard NSMaxRange(hit.range) <= component.length else { continue }
            let shifted = NSRange(location: component.location + hit.range.location, length: hit.range.length)
            ranges.append(shifted)
            if hit.id == activeSearchMatchID { active.append(shifted) }
        }
        return (ranges, active)
    }

    private func baseText(for row: NativeReaderDisplayBlock, role: NativeReaderTypographyRole) -> NSAttributedString {
        let id = NativeReaderAttributedTextCacheKey.block(routeID: routeID, blockID: row.id, role: role)
        return NativeReaderAttributedTextCache.shared.baseAttributedText(
            cacheKey: NativeReaderAttributedTextCacheKey.base(cacheID: id, theme: theme, accentColor: accent),
            runs: row.block.runs, fallbackText: row.block.plainText, theme: theme, role: role, accentColor: accent
        )
    }

    private func gap(after row: NativeReaderDisplayBlock) -> CGFloat {
        if row.block.kind == .heading {
            return NativeReaderHeadingPresentation(block: row.block).level <= 2 ? 14 : 8
        }
        return max(CGFloat(theme.paragraphSpacing), row.usesCompactSpacing ? 12 : 8)
    }
}

@MainActor
private final class NativeReaderGroupedTextComposition: ObservableObject {
    struct Key: Equatable {
        let group: NativeReaderTextGroup
        let routeID: String
        let theme: ReaderTheme
        let accent: UIColor
        let saved: NativeReaderSavedText
        let definitionContext: ReaderDefinitionContext?
        let dynamicTypeSize: DynamicTypeSize
    }

    private var cached: (key: Key, text: NSAttributedString, components: [NSRange])?

    func content(for key: Key, build: () -> (text: NSAttributedString, components: [NSRange]))
        -> (text: NSAttributedString, components: [NSRange]) {
        if let cached, cached.key == key { return (cached.text, cached.components) }
        let content = build()
        cached = (key, content.text, content.components)
        return content
    }
}
