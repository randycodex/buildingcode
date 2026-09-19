import os.signpost
import SwiftUI
import UIKit

private let nativeReaderLegacyScrollCoordinateSpace = "nativeReaderScroll"

struct NativeChapterTextReaderView: View {
    let chapter: CodeChapter
    let initialSectionID: Int64
    let opensAtChapterTop: Bool
    let initialSectionNumber: String
    var initialSectionTitle: String = ""
    let initialAnchorID: String?
    let route: NativeReaderDocumentRoute
    var rememberedSectionID: Binding<Int64?> = .constant(nil)
    var rememberedBlockID: Binding<String?> = .constant(nil)
    var rememberedViewport: Binding<NativeReaderViewportPosition?> = .constant(nil)
    var rememberedAnchorID: Binding<String?> = .constant(nil)
    var onFallbackToHTML: ((String, String?) -> Void)?
    var onOpenReference: ((CodeSectionSummary) -> Void)?

    @Environment(\.floatingNavigationClearance) private var floatingNavigationClearance
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.openURL) private var openURL
    @Environment(\.isBrowserTabActive) private var isBrowserTabActive
    @State private var document: NativeReaderRuntimeDocument?
    @State private var displayBlocks: [NativeReaderDisplayBlock] = []
    @State private var sectionTargets: [NativeReaderSectionTarget] = []
    @StateObject private var scrollState = NativeReaderScrollState()
    @State private var currentSectionTargetID: String?
    @State private var pendingInitialBlockID: String?
    @State private var explicitNavigation = false
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var initialTargetIsVisible = false
    @State private var failureMessage: String?
    @State private var hasRequestedFallback = false
    @State private var expandedMedia: NativeReaderExpandedMedia?
    @State private var isJumpPickerPresented = false
    @State private var isSearchPresented = false
    @State private var searchQuery = ""
    @State private var searchMatches: [NativeReaderSearchMatch] = []
    @State private var activeSearchMatchID: String?
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
        self.onFallbackToHTML = onFallbackToHTML
        self.onOpenReference = onOpenReference
        if let prepared = preparedNativeOpening?.document(matching: route)
            ?? NativeReaderDocumentStore.shared.preparedDocumentIfCached(for: route) {
            _document = State(initialValue: prepared.document)
            _displayBlocks = State(initialValue: prepared.displayBlocks)
            _sectionTargets = State(initialValue: prepared.sectionTargets)
            let target = NativeReaderLocationResolver.initialBlockID(
                in: prepared.document,
                opensAtChapterTop: opensAtChapterTop,
                rememberedBlockID: rememberedBlockID.wrappedValue,
                rememberedAnchorID: rememberedAnchorID.wrappedValue,
                initialAnchorID: initialAnchorID,
                initialSectionNumber: initialSectionNumber,
                initialSectionTitle: initialSectionTitle
            )
            _pendingInitialBlockID = State(initialValue: target != prepared.document.blocks.first?.id || rememberedViewport.wrappedValue?.blockID == target ? target : nil)
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
            let canPersist = pendingInitialBlockID == nil
                && (scrollState.restorationLease.map(restorationHasArrived) ?? true)
            releaseRestorationLease(reason: "inactive-tab")
            settledScrollTask?.cancel()
            settledScrollTask = nil
            if canPersist, let document, let visibleBlockID = scrollState.visibleBlockID {
                persistLocation(blockID: visibleBlockID, document: document)
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
        .onChange(of: route.id) { _, _ in releaseRestorationLease(reason: "route") }
        .onDisappear {
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
        .opacity(pendingInitialBlockID == nil ? 1 : 0)
        .allowsHitTesting(pendingInitialBlockID == nil)
        .accessibilityHidden(pendingInitialBlockID != nil)
        .transaction { transaction in
            transaction.animation = nil
        }
        .overlay {
            if pendingInitialBlockID != nil {
                openingPassage(document: document, proxy: proxy)
            }
        }
        .onChange(of: searchQuery) { _, query in
            searchMatches = NativeReaderSearchIndex.matches(query: query, in: displayBlocks)
            if !searchMatches.contains(where: { $0.id == activeSearchMatchID }) {
                activeSearchMatchID = searchMatches.first?.id
            }
        }
        .task(id: "\(route.id)|\(pendingInitialBlockID ?? "")|\(isBrowserTabActive)") {
            guard isBrowserTabActive else { return }
            await restoreInitialPosition(document: document, proxy: proxy)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: 0) {
                if !searchMatches.isEmpty {
                    searchNavigator(proxy: proxy, document: document)
                }
                jumpBar
            }
            .opacity(pendingInitialBlockID == nil ? 1 : 0)
            .accessibilityHidden(pendingInitialBlockID != nil)
            .transaction { transaction in
                transaction.animation = nil
            }
            .padding(.bottom, floatingNavigationClearance)
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

    @ViewBuilder
    private func trackedReaderScroll(
        document: NativeReaderRuntimeDocument,
        proxy: ScrollViewProxy
    ) -> some View {
        if #available(iOS 18.0, *) {
            readerScrollView(document: document, proxy: proxy)
                .coordinateSpace(name: nativeReaderLegacyScrollCoordinateSpace)
                .onPreferenceChange(NativeReaderBlockOffsetPreferenceKey.self) { offsets in
                    scrollState.blockOffsets = offsets
                    traceRestoration("offset-preference")
                    guard !correctLateLayout(proxy: proxy) else { return }
                    visibleBlockDidChange(
                        NativeReaderVisibleBlockResolver.topBlockID(
                            from: offsets,
                            threshold: CodeScreenMetrics.topTitlePadding + 1
                        ),
                        document: document
                    )
                }
                .onScrollPhaseChange { _, newPhase in
                    scrollPhaseDidChange(newPhase, document: document)
                }
                .onScrollGeometryChange(for: CGSize.self) { geometry in
                    geometry.contentSize
                } action: { _, _ in
                    traceRestoration("content-size")
                    guard scrollState.restorationLease != nil else { return }
                    // Preference offsets and content size arrive independently.
                    // Coalesce onto the next turn before consuming row geometry.
                    scrollState.restorationGeometryTask?.cancel()
                    scrollState.restorationGeometryTask = Task { @MainActor in
                        await Task.yield()
                        guard !Task.isCancelled else { return }
                        traceRestoration("content-size-coalesced")
                        _ = correctLateLayout(proxy: proxy)
                    }
                }
        } else {
            readerScrollView(document: document, proxy: proxy)
                .coordinateSpace(name: nativeReaderLegacyScrollCoordinateSpace)
                .onPreferenceChange(NativeReaderBlockOffsetPreferenceKey.self) { offsets in
                    scrollState.blockOffsets = offsets
                    traceRestoration("offset-preference")
                    guard !correctLateLayout(proxy: proxy) else { return }
                    visibleBlockDidChange(
                        NativeReaderVisibleBlockResolver.topBlockID(
                            from: offsets,
                            threshold: CodeScreenMetrics.topTitlePadding + 1
                        ),
                        document: document
                    )
                }
        }
    }

    private func readerScrollView(
        document: NativeReaderRuntimeDocument,
        proxy: ScrollViewProxy
    ) -> some View {
        return ScrollView {
            Group {
                if NativeReaderStackPolicy.usesEagerStack(displayBlocks) {
                    VStack(alignment: .leading, spacing: 0) {
                        readerBlocks(displayBlocks, document: document, proxy: proxy, tracksOffsets: true)
                    }
                    .scrollTargetLayout()
                } else {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        readerBlocks(displayBlocks, document: document, proxy: proxy, tracksOffsets: true)
                    }
                    .scrollTargetLayout()
                }
            }
            .padding(.horizontal, CodeScreenMetrics.readerHorizontalPadding)
            .padding(.top, CodeScreenMetrics.topTitlePadding)
            .padding(.bottom, 28)
            .background(NativeReaderScrollViewProbe { scrollState.scrollView = $0 })
        }
        .accessibilityIdentifier("native-reader-ready")
    }

    private func readerBlocks(
        _ blocks: [NativeReaderDisplayBlock],
        document: NativeReaderRuntimeDocument,
        proxy: ScrollViewProxy,
        tracksOffsets: Bool
    ) -> some View {
        let definitionSections = Set(document.blocks.filter {
            $0.kind == .heading && $0.plainText.range(of: #"\bdefinitions[.:]?\s*$"#, options: [.regularExpression, .caseInsensitive]) != nil
        }.compactMap(\.sectionID))
        let needsSectionScope = chapter.codeSectionID.map {
            ReaderDefinitionStore.shared.hasSectionScopes(for: ReaderDefinitionContext(versionFileName: route.sourceURL.path, codeSectionID: $0, chapterNumber: chapter.chapterNumber, chapterID: chapter.id))
        } ?? false
        let sectionNumbers = Dictionary(document.blocks.compactMap { block -> (String, String)? in
            guard block.kind == .heading, let sectionID = block.sectionID,
                  let number = NativeReaderSectionNavigator.sectionNumber(from: block.plainText, anchorID: block.anchorIDs.first) else { return nil }
            return (sectionID, number)
        }, uniquingKeysWith: { first, _ in first })
        return ForEach(blocks) { displayBlock in
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
            .equatable()
            .environment(\.readerDefinitionContext, definitionSections.contains(displayBlock.block.sectionID ?? "") ? nil : chapter.codeSectionID.map {
                ReaderDefinitionContext(versionFileName: route.sourceURL.path, codeSectionID: $0, chapterNumber: chapter.chapterNumber, chapterID: chapter.id, sectionNumber: needsSectionScope ? sectionNumbers[displayBlock.block.sectionID ?? ""] : nil)
            })
            .id(tracksOffsets ? displayBlock.id : "opening:\(displayBlock.id)")
            .modifier(NativeReaderBlockOffsetModifier(blockID: displayBlock.id, tracksOffset: tracksOffsets))
        }
    }

    @ViewBuilder
    private func openingPassage(document: NativeReaderRuntimeDocument, proxy: ScrollViewProxy) -> some View {
        if let target = pendingInitialBlockID,
           let index = displayBlocks.firstIndex(where: { $0.id == target }) {
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
                                 document: document, proxy: proxy, tracksOffsets: false)
                }
                .padding(.horizontal, CodeScreenMetrics.readerHorizontalPadding)
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
        // Lazy layout can briefly report the target before preceding rows finish
        // measuring. Keep restoration active until its settling pass completes.
        if let target = pendingInitialBlockID {
            initialTargetIsVisible = blockID == target
            if initialTargetIsVisible { scrollState.visibleBlockID = target }
            return
        }
        guard pendingInitialBlockID == nil,
              let blockID,
              scrollState.visibleBlockID != blockID else { return }
        let previousBlockID = scrollState.visibleBlockID
        scrollState.visibleBlockID = blockID
        updateCurrentSectionPresentation(
            blockID: blockID,
            document: document,
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
        pendingInitialBlockID = nil
        scrollState.visibleBlockID = nil
        scrollState.isScrollActive = false
        scrollState.isDecelerating = false
        currentSectionTargetID = nil
        failureMessage = nil
        hasRequestedFallback = false
        expandedMedia = nil
        searchQuery = ""
        searchMatches = []
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
            let initialBlockID = NativeReaderLocationResolver.initialBlockID(
                in: loaded,
                opensAtChapterTop: opensAtChapterTop,
                rememberedBlockID: rememberedBlockID.wrappedValue,
                rememberedAnchorID: rememberedAnchorID.wrappedValue,
                initialAnchorID: initialAnchorID,
                initialSectionNumber: initialSectionNumber,
                initialSectionTitle: initialSectionTitle
            )
            if let initialBlockID,
               let initialIndex = prepared.displayBlocks.firstIndex(where: { $0.id == initialBlockID }) {
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
            sectionTargets = prepared.sectionTargets
            let requiresInitialRestore = initialBlockID != loaded.blocks.first?.id || rememberedViewport.wrappedValue?.blockID == initialBlockID
            pendingInitialBlockID = requiresInitialRestore ? initialBlockID : nil
            document = loaded
            if !requiresInitialRestore {
                persistLocation(blockID: initialBlockID, document: loaded)
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
            guard !Task.isCancelled, scrollState.visibleBlockID == displayBlockID else { return }
            persistLocation(blockID: displayBlockID, document: document)
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
              let sourceBlockID = NativeReaderDisplayBlock.sourceBlockID(
                  for: displayBlockID,
                  in: document
              ),
              let focusedIndex = document.blocks.firstIndex(where: { $0.id == sourceBlockID })
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
        guard let centerIndex = displayBlocks.firstIndex(where: { $0.id == displayBlockID })
        else { return }
        if let lastCenter = scrollState.lastTextPrefetchCenterIndex,
           abs(centerIndex - lastCenter) < 4 {
            return
        }

        let previousIndex = previousBlockID.flatMap { previousID in
            displayBlocks.firstIndex(where: { $0.id == previousID })
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
        let y = scrollState.blockOffsets[observed]
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
        // Carry navigation intent without recording an unobserved arrival.
        let requestedBlockID = pendingInitialBlockID ?? scrollState.restorationLease?.blockID
        let requestedAnchorID = requestedBlockID.flatMap { blockID in
            document.flatMap { NativeReaderLocationResolver.anchorID(for: blockID, in: $0) }
        }
        traceRestoration("fallback", detail: message)
        releaseRestorationLease(reason: "fallback")
        onFallbackToHTML?(message, requestedAnchorID)
    }

    @MainActor
    private func restoreInitialPosition(
        document: NativeReaderRuntimeDocument,
        proxy: ScrollViewProxy
    ) async {
        guard isBrowserTabActive, let targetBlockID = pendingInitialBlockID else { return }
        traceRestoration("initial-start", observing: targetBlockID)

        // A distant LazyVStack destination initially uses estimated row heights.
        // Reapply the anchor while those rows settle, rather than accepting the
        // first transient geometry report and revealing the wrong passage.
        initialTargetIsVisible = false
        await Task.yield()
        var stablePasses = 0
        var previousGeometry: (offset: CGFloat, height: CGFloat)?
        for _ in 0..<50 {
            guard !Task.isCancelled, isBrowserTabActive, pendingInitialBlockID == targetBlockID else { return }
            if !initialTargetIsVisible {
                var transaction = Transaction(animation: nil)
                transaction.disablesAnimations = true
                withTransaction(transaction) { proxy.scrollTo(targetBlockID, anchor: .top) }
            }
            try? await Task.sleep(for: .milliseconds(16))
            if initialTargetIsVisible,
               let offset = scrollState.blockOffsets[targetBlockID],
               let scrollView = scrollState.scrollView {
                let height = scrollView.contentSize.height
                if let previousGeometry,
                   abs(previousGeometry.offset - offset) < 1,
                   abs(previousGeometry.height - height) < 1 {
                    stablePasses += 1
                } else { stablePasses = 0 }
                previousGeometry = (offset, height)
            } else {
                stablePasses = 0
                previousGeometry = nil
            }
            if stablePasses >= 3 { break }
        }
        guard !Task.isCancelled, isBrowserTabActive, pendingInitialBlockID == targetBlockID else { return }
        await scrollState.waitForNavigationTransition()
        guard !Task.isCancelled, isBrowserTabActive, pendingInitialBlockID == targetBlockID else { return }
        let saved = rememberedViewport.wrappedValue
        let usesSavedViewport = !explicitNavigation && saved?.blockID == targetBlockID
            && saved?.routeID == route.id && saved?.theme == library.readerTheme
            && rememberedBlockID.wrappedValue == targetBlockID
            && abs(Double(scrollState.scrollView?.bounds.width ?? 0) - (saved?.width ?? 0)) < 1
        let targetY = usesSavedViewport ? CGFloat(saved?.minY ?? 0) : 0
        let aligned = await alignInitialTarget(targetBlockID, minY: targetY, proxy: proxy)
        guard !Task.isCancelled, isBrowserTabActive, pendingInitialBlockID == targetBlockID else { return }
        guard aligned else {
            traceRestoration("alignment-result", detail: "success=false desiredMinY=\(targetY)")
            requestFallbackToHTML("The requested passage could not be positioned reliably.")
            return
        }
        traceRestoration("alignment-result", detail: "success=\(aligned) desiredMinY=\(targetY)")
        beginRestorationLease(blockID: targetBlockID, minY: targetY)
        scrollState.visibleBlockID = targetBlockID
        pendingInitialBlockID = nil
        traceRestoration("revealed")
        explicitNavigation = false
        persistLocation(blockID: targetBlockID, document: document)
    }

    @MainActor
    private func alignInitialTarget(_ targetBlockID: String, minY: CGFloat, proxy: ScrollViewProxy) async -> Bool {
#if DEBUG
        if explicitNavigation && ProcessInfo.processInfo.arguments.contains("--native-reader-force-picker-alignment-failure") {
            return false
        }
#endif
        var stablePasses = 0
        var previousHeight: CGFloat?
        for _ in 0..<50 {
            guard !Task.isCancelled, isBrowserTabActive, pendingInitialBlockID == targetBlockID else { return false }
            if let view = scrollState.scrollView,
               let currentY = scrollState.blockOffsets[targetBlockID], currentY.isFinite {
                let desired = boundedOffset(view.contentOffset.y + currentY - minY, in: view)
                let height = view.contentSize.height
                if abs(desired - view.contentOffset.y) >= 1 {
                    view.setContentOffset(CGPoint(x: view.contentOffset.x, y: desired), animated: false)
                    stablePasses = 0
                } else if let previousHeight, abs(previousHeight - height) < 1,
                          currentY >= minY - 1, currentY < view.bounds.height {
                    stablePasses += 1
                } else { stablePasses = 0 }
                previousHeight = height
            } else {
                var transaction = Transaction(animation: nil)
                transaction.disablesAnimations = true
                withTransaction(transaction) { proxy.scrollTo(targetBlockID, anchor: .top) }
                stablePasses = 0
                previousHeight = nil
            }
            if stablePasses >= 3 { return true }
            try? await Task.sleep(for: .milliseconds(16))
        }
        return false
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
            previousOrigin: scrollState.blockOffsets[blockID].map { $0 + view.contentOffset.y })
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
        guard let view = scrollState.scrollView,
              let y = scrollState.blockOffsets[lease.blockID], y.isFinite,
              y >= lease.minY - 1, y < view.bounds.height else { return false }
        return abs(boundedOffset(view.contentOffset.y + y - lease.minY, in: view) - view.contentOffset.y) < 1
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
        let y = scrollState.blockOffsets[lease.blockID]
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
        if phase != .idle { releaseRestorationLease(reason: "phase-\(phase)") }
        scrollState.isScrollActive = phase.isScrolling
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

    private func persistLocation(blockID: String?, document: NativeReaderRuntimeDocument) {
        guard let blockID,
              NativeReaderDisplayBlock.sourceBlockID(for: blockID, in: document) != nil
        else {
            return
        }
        if pendingInitialBlockID == nil,
           let minY = scrollState.blockOffsets[blockID],
           let width = scrollState.scrollView?.bounds.width, width > 0 {
            rememberedViewport.wrappedValue = NativeReaderViewportPosition(routeID: route.id, theme: library.readerTheme, blockID: blockID, minY: Double(minY), width: Double(width))
        }
        rememberLocation(blockID: blockID, document: document)
        recordCurrentSection(blockID: blockID, document: document)
    }

    private func rememberLocation(blockID: String, document: NativeReaderRuntimeDocument) {
        if rememberedBlockID.wrappedValue != blockID {
            rememberedBlockID.wrappedValue = blockID
        }
        if let anchorID = NativeReaderLocationResolver.anchorID(for: blockID, in: document),
           rememberedAnchorID.wrappedValue != anchorID {
            rememberedAnchorID.wrappedValue = anchorID
        }
        updateCurrentSectionPresentation(blockID: blockID, document: document)
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
        releaseRestorationLease(reason: "new-navigation")
        settledScrollTask?.cancel()
        explicitNavigation = true
        pendingInitialBlockID = blockID
        // The shared measured restoration task owns arrival and persistence.
        // A picker selection is intent, not proof that scrolling succeeded.
    }

    private func updateCurrentSectionPresentation(
        blockID: String,
        document: NativeReaderRuntimeDocument,
        updatesRememberedSection: Bool = true
    ) {
        guard let target = NativeReaderSectionNavigator.target(
            forDisplayBlockID: blockID,
            in: document,
            targets: sectionTargets
        ) else { return }
        if currentSectionTargetID != target.id {
            currentSectionTargetID = target.id
        }

        if updatesRememberedSection,
           let summary = sectionSummary(for: target),
           rememberedSectionID.wrappedValue != summary.id {
            rememberedSectionID.wrappedValue = summary.id
        }
    }

    private func recordCurrentSection(
        blockID: String,
        document: NativeReaderRuntimeDocument
    ) {
        guard let target = NativeReaderSectionNavigator.target(
            forDisplayBlockID: blockID,
            in: document,
            targets: sectionTargets
        ) else { return }
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
        NativeReaderReferenceDestinationResolver.destination(
            for: reference,
            sourceCodeSectionID: chapter.codeSectionID,
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
    var blockOffsets: [String: CGFloat] = [:]
    var visibleBlockID: String?
    var isScrollActive = false
    var isDecelerating = false
    var lastTextPrefetchCenterIndex: Int?
    var textPrefetchTask: Task<Void, Never>?

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
        guard !offsets.isEmpty else { return nil }
        let aboveOrAt = offsets.filter { $0.value <= threshold }
        if let closestAbove = aboveOrAt.max(by: { $0.value < $1.value })?.key {
            return closestAbove
        }
        return offsets.min(by: { $0.value < $1.value })?.key
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
                                in: .named(nativeReaderLegacyScrollCoordinateSpace)
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
        // Enacted HMC headings include separately numbered sections such as “27- 2017.4”.
        let normalizedHeading = heading.replacingOccurrences(of: #"^(\s*27-)\s+(?=\d)"#, with: "$1", options: .regularExpression)
        let headingPattern = #"(?i)^\s*(?:(?:SECTION|ARTICLE|PART)\s+)?(?:(?:EBC|FGC|BC|PC|MC|AC|FC|ZR)\s+)?([A-Z]?\d+(?:[.\-]\d+)*(?:\([A-Za-z0-9]+\))?)\b"#
        if let token = firstCapture(in: normalizedHeading, pattern: headingPattern) {
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
    case article
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
            token: token.uppercased()
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

enum NativeReaderLocationResolver {
    static func initialBlockID(
        in document: NativeReaderRuntimeDocument,
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
        let normalizedTitle = normalizedSectionNumber(initialSectionTitle)
        if !normalizedSection.isEmpty, !normalizedTitle.isEmpty {
            let matches = NativeReaderDisplayBlock.blocks(from: document.blocks).filter { display in
                let text = normalizedSectionNumber(display.block.plainText)
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
    let onResearchSelection: (String) -> Void

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
                        theme: theme,
                        accentColor: accentColor,
                        onOpenLink: onOpenLink,
                        searchQuery: searchQuery,
                        activeMatchIndex: searchMatches.firstIndex(where: { $0.id == activeSearchMatchID })
                    )
                    .containerRelativeFrame(.horizontal) { viewportWidth, _ in
                        max(
                            viewportWidth
                                - (CodeScreenMetrics.readerHorizontalPadding * 2)
                                - hierarchyIndentation,
                            0
                        )
                    }
                }
            case .unsupportedHTML:
                EmptyView()
            }
        }
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
            activeHighlightRange: searchMatches.first(where: { $0.id == activeSearchMatchID })?.range,
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
                Color(uiColor: .systemGroupedBackground).ignoresSafeArea()
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

    private var rows: [NativeReaderListRow] {
        items.flatMap { NativeReaderListRow.flatten($0) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            ForEach(rows) { row in
                VStack(alignment: .leading, spacing: 8) {
                    if row.segments.isEmpty {
                        textRow(
                            marker: marker(for: row),
                            cacheID: NativeReaderAttributedTextCacheKey.list(
                                routeID: cachePrefix,
                                rowID: row.id
                            ),
                            runs: row.runs,
                            plainText: row.plainText
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
                                    plainText: segment.plainText
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
        plainText: String
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
                onResearchSelection: onResearchSelection
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

    func attributedText(
        cacheKey: String,
        runs: [NativeReaderRuntimeTextRun],
        fallbackText: String,
        theme: ReaderTheme,
        role: NativeReaderTypographyRole,
        accentColor: UIColor,
        highlightRanges: [NSRange],
        activeHighlightRange: NSRange?
    ) async throws -> NSAttributedString {
        let key = cacheKey as NSString
        if let cached = cache.object(forKey: key) {
            return cached.value
        }

        let work = Task.detached(priority: .userInitiated) {
            try Task.checkCancellation()
            let value = NativeReaderAttributedTextBuilder.attributedText(
                runs: runs,
                fallbackText: fallbackText,
                theme: theme,
                role: role,
                accentColor: accentColor,
                highlightRanges: highlightRanges,
                activeHighlightRange: activeHighlightRange
            )
            try Task.checkCancellation()
            return CachedNativeReaderAttributedText(value)
        }
        let prepared = try await withTaskCancellationHandler {
            try await work.value
        } onCancel: {
            work.cancel()
        }
        let value = prepared.value
        cache.setObject(
            CachedNativeReaderAttributedText(value),
            forKey: key,
            cost: max(value.length * 4, fallbackText.utf8.count)
        )
        return value
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
    var activeHighlightRange: NSRange? = nil
    let onOpenLink: (URL) -> Void
    let onResearchSelection: (String) -> Void

    @Environment(\.readerDefinitionContext) private var definitionContext
    @State private var attributedText: NSAttributedString?

    var body: some View {
        Group {
            if let attributedText {
                AttributedTextView(
                    attributedText: attributedText,
                    onOpenLink: onOpenLink,
                    onResearchSelection: onResearchSelection
                )
            } else {
                AttributedTextView(
                    attributedText: baseAttributedText,
                    onOpenLink: onOpenLink,
                    onResearchSelection: onResearchSelection
                )
            }
        }
        .environment(\.readerDefinitionContext, allowsDefinitionLinks ? definitionContext : nil)
        .frame(maxWidth: .infinity, alignment: .leading)
        .task(id: taskID) {
            guard hasHighlights else {
                attributedText = nil
                return
            }
            attributedText = nil
            do {
                attributedText = try await NativeReaderAttributedTextCache.shared.attributedText(
                    cacheKey: taskID,
                    runs: runs,
                    fallbackText: fallbackText,
                    theme: theme,
                    role: role,
                    accentColor: accentColor,
                    highlightRanges: highlightRanges,
                    activeHighlightRange: activeHighlightRange
                )
            } catch is CancellationError {
                return
            } catch {
                attributedText = nil
            }
        }
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

    private var hasHighlights: Bool {
        !highlightRanges.isEmpty || activeHighlightRange != nil
    }

    private var baseTaskID: String {
        NativeReaderAttributedTextCacheKey.base(
            cacheID: cacheID,
            theme: theme,
            accentColor: accentColor
        )
    }

    private var taskID: String {
        let highlights = highlightRanges.map { "\($0.location):\($0.length)" }.joined(separator: ",")
        let active = activeHighlightRange.map { "\($0.location):\($0.length)" } ?? "none"
        return "\(cacheID)|\(theme.hashValue)|\(accentColor.hash)|\(highlights)|\(active)"
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
    func makeUIView(context: Context) -> UIView { UIView(frame: .zero) }
    func updateUIView(_ view: UIView, context: Context) {
        DispatchQueue.main.async {
            var ancestor = view.superview
            while let current = ancestor {
                if let scrollView = current as? UIScrollView {
                    resolved(scrollView)
                    return
                }
                ancestor = current.superview
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
