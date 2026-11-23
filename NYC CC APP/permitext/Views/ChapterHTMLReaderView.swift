import SwiftUI

private final class CachedChapterSearchEntries: NSObject {
    let entries: [ChapterSearchSourceEntry]

    init(_ entries: [ChapterSearchSourceEntry]) {
        self.entries = entries
    }
}

private enum ChapterSearchEntryCache {
    private static let cache: NSCache<NSString, CachedChapterSearchEntries> = {
        let cache = NSCache<NSString, CachedChapterSearchEntries>()
        cache.countLimit = 24
        cache.totalCostLimit = 12 * 1024 * 1024
        return cache
    }()

    static func entries(for key: NSString) -> [ChapterSearchSourceEntry]? {
        cache.object(forKey: key)?.entries
    }

    static func store(_ entries: [ChapterSearchSourceEntry], for key: NSString) {
        cache.setObject(CachedChapterSearchEntries(entries), forKey: key, cost: memoryCost(entries))
    }

    static func removeAll() {
        cache.removeAllObjects()
    }

    static func key(
        chapterURL: URL,
        chapterID: Int64,
        initialSectionID: Int64,
        anchorCount: Int,
        mappedSectionCount: Int
    ) -> NSString {
        let attributes = try? FileManager.default.attributesOfItem(atPath: chapterURL.path)
        let modifiedAt = (attributes?[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
        return "\(chapterID)|\(chapterURL.path)|\(modifiedAt)|\(initialSectionID)|\(anchorCount)|\(mappedSectionCount)" as NSString
    }

    private static func memoryCost(_ entries: [ChapterSearchSourceEntry]) -> Int {
        entries.reduce(0) { total, entry in
            total
                + stringMemoryCost(entry.sectionNumber)
                + stringMemoryCost(entry.title)
                + stringMemoryCost(entry.anchorID ?? "")
                + stringMemoryCost(entry.displayText ?? "")
        }
    }

    private static func stringMemoryCost(_ value: String) -> Int {
        max(value.utf8.count, value.utf16.count * 2)
    }
}

enum ChapterHTMLReaderRuntimeCaches {
    static func handleMemoryWarning() {
        ChapterSearchEntryCache.removeAll()
    }
}

private enum ChapterReaderPresentation: String, CaseIterable, Identifiable {
    case html
    case native

    var id: String { rawValue }

    var title: String {
        switch self {
        case .html: "HTML (Diagnostic)"
        case .native: "Native (Default)"
        }
    }
}

struct ChapterHTMLReaderView: View {
    let chapter: CodeChapter
    let initialSection: CodeSectionSummary
    var opensAtChapterTop = false
    var rememberedNativeSectionID: Binding<Int64?> = .constant(nil)
    var rememberedNativeBlockID: Binding<String?> = .constant(nil)
    var rememberedNativeViewport: Binding<NativeReaderViewportPosition?> = .constant(nil)
    var rememberedAnchorID: Binding<String?> = .constant(nil)
    var rememberedScrollOffset: Binding<Double?> = .constant(nil)
    var preparedNativeOpening: NativeReaderPreparedOpening? = nil

    @Environment(\.floatingNavigationClearance) private var floatingNavigationClearance
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isBrowserTabActive) private var isBrowserTabActive
    @Environment(\.scenePhase) private var scenePhase

    @State private var htmlScrollCheckpoint = ChapterHTMLScrollCheckpoint()
    @State private var readerIsVisible = false
    @State private var targetAnchorID: String?
    // A native fallback destination supersedes the old HTML pixel offset for
    // this chapter instance. The ordinary target remains free to change later.
    @State private var nativeFallbackIgnoresSavedOffset = false
    @State private var selectedAnchor: PublishedHTMLAnchor?
    @State private var anchors: [PublishedHTMLAnchor] = []
    @State private var openedSection: CodeSectionSummary?
    @State private var hasActivatedHTMLReader = true
    @State private var isJumpPickerPresented = false
    @State private var cachedBookmarkedAnchorIDs: Set<String> = []
    @State private var cachedBookmarkedSectionNumbers: Set<String> = []
    @State private var cachedBookmarkRevision: Int = -1
    @State private var cachedHTMLStoreRootPath: String?
    @State private var cachedHTMLStore: PublishedHTMLContentStore?
    @State private var scrollPositionSyncTrigger = 0
    @State private var lastRecordedVisibleAnchorID: String?
    @State private var isChapterSearchPresented = false
    @State private var chapterSearchQuery = ""
    @State private var chapterSearchScrollQuery: String?
    @State private var chapterSearchScrollRequestID = 0
    @State private var htmlChapterSearchEntries: [ChapterSearchSourceEntry] = []
    @State private var inlineReferenceDestination: CodeSectionSummary?
    @State private var htmlLoadState: ChapterHTMLLoadState = .loading
    @State private var htmlReloadTrigger = 0
    @State private var nativeReaderRoute: NativeReaderDocumentRoute?
    @State private var resolvedReaderSourcePath: String?
    @State private var readerPresentation: ChapterReaderPresentation = .html
    @State private var nativeReaderFallbackMessage: String?
    @State private var rolloutRouteResolved = NativeReaderRolloutPolicy.activeStage == .disabled

    private var accentColor: Color {
        Color(uiColor: library.accentColor(for: chapter.codeSectionID))
    }

    private var pageBackgroundColor: Color {
        Color(uiColor: ChapterHTMLWebView.pageBackgroundUIColor(for: colorScheme))
    }

    private var htmlStore: PublishedHTMLContentStore {
        let rootPath = htmlStoreCacheKey
        if let cachedHTMLStore, cachedHTMLStoreRootPath == rootPath {
            return cachedHTMLStore
        }
        return library.authoredHTMLStore(for: chapter)
    }

    private var htmlStoreCacheKey: String {
        "\(library.selectedVersion?.authoredHTMLBundlePath ?? ""):\(chapter.codeSectionID ?? 0):\(chapter.id)"
    }

    private var chapterURL: URL? {
        htmlStore.chapterURL(chapterNumber: chapter.chapterNumber)
    }

    private var usesNativeRolloutReader: Bool {
        if !rolloutRouteResolved { return effectiveNativeReaderRoute != nil }
        return readerPresentation == .native && nativeReaderRoute != nil
    }

    private var effectiveNativeReaderRoute: NativeReaderDocumentRoute? {
        if rolloutRouteResolved { return nativeReaderRoute }
        guard let chapterURL else { return nil }
        return NativeReaderDocumentStore.shared.cachedRolloutRoute(for: chapterURL)
    }

    private var isRolloutRouteResolved: Bool {
        rolloutRouteResolved || effectiveNativeReaderRoute != nil
    }

    private var readAccessURL: URL? {
        htmlStore.readAccessURL()
    }

    private func currentJumpLabel(in targets: [ChapterHTMLJumpTarget]) -> String {
        if let selectedAnchor,
           let selectedTarget = targets.first(where: { $0.anchorID == selectedAnchor.anchorID || normalizedSectionNumber($0.sectionNumber) == normalizedSectionNumber(selectedAnchor.sectionNumber) }) {
            return selectedTarget.menuLabel
        }
        if let initialTarget = targets.first(where: { normalizedSectionNumber($0.sectionNumber) == normalizedSectionNumber(initialSection.sectionNumber) }) {
            return initialTarget.menuLabel
        }
        return targets.first?.menuLabel ?? ""
    }

    private var currentBookmarkSectionID: Int64? {
        if let selectedAnchor,
           let section = sectionSummary(
               for: ChapterHTMLSectionTarget(
                   anchorID: selectedAnchor.anchorID,
                   sectionNumber: selectedAnchor.sectionNumber
               )
           ) {
            return section.id
        }
        return initialSection.id
    }

    private var jumpTargets: [ChapterHTMLJumpTarget] {
        let chapterNumber = normalizedSectionNumber(chapter.chapterNumber)
        let sectionAnchors = anchors.filter {
            $0.level >= 2 && normalizedSectionNumber($0.sectionNumber) != chapterNumber
        }
        if !sectionAnchors.isEmpty {
            return sectionAnchors.map {
                ChapterHTMLJumpTarget(
                    sectionNumber: $0.sectionNumber,
                    title: $0.title,
                    anchorID: $0.anchorID,
                    level: $0.level
                )
            }
        }

        let codeSectionName = library.codeSectionName(id: chapter.codeSectionID)
        return library.sectionGroups(for: chapter).map { group in
            ChapterHTMLJumpTarget(
                sectionNumber: sectionNumber(from: group.headerLine),
                title: group.displayLabel(codeSectionName: codeSectionName),
                anchorID: nil,
                level: 2
            )
        }
    }

    private var chapterSearchEntries: [ChapterSearchSourceEntry] {
        if !htmlChapterSearchEntries.isEmpty {
            return htmlChapterSearchEntries
        }

        return jumpTargets.compactMap { target -> ChapterSearchSourceEntry? in
            let sectionNumber = target.sectionNumber.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !sectionNumber.isEmpty,
                  let summary = library.sectionSummary(sectionNumber: sectionNumber, codeSectionID: chapter.codeSectionID) else {
                return nil
            }

            return ChapterSearchSourceEntry(
                sectionID: summary.id,
                sectionNumber: summary.sectionNumber,
                title: summary.title,
                anchorID: target.anchorID
            )
        }
    }

    private var bookmarkedAnchorIDs: Set<String> {
        cachedBookmarkedAnchorIDs
    }

    private var bookmarkedSectionNumbers: Set<String> {
        cachedBookmarkedSectionNumbers
    }

    private func recomputeSavedDecorations() {
        var anchorIDs: Set<String> = []
        var sectionNumbers = Set(library.bookmarks.map { bookmark in
            normalizedSectionNumber(bookmark.sectionNumber)
        })

        for anchor in anchors {
            guard let summary = library.sectionSummary(
                sectionNumber: anchor.sectionNumber,
                codeSectionID: chapter.codeSectionID
            ) else { continue }
            if library.isBookmarked(sectionID: summary.id) {
                anchorIDs.insert(anchor.anchorID)
                sectionNumbers.insert(normalizedSectionNumber(summary.sectionNumber))
            }
        }

        cachedBookmarkedAnchorIDs = anchorIDs
        cachedBookmarkedSectionNumbers = sectionNumbers
        cachedBookmarkRevision = library.bookmarkRevision
    }

    private var initialAnchor: PublishedHTMLAnchor? {
        anchors.first { normalizedSectionNumber($0.sectionNumber) == normalizedSectionNumber(initialSection.sectionNumber) }
    }

    private var restoredInitialAnchor: PublishedHTMLAnchor? {
        if opensAtChapterTop { return nil }

        if let rememberedAnchorID = rememberedAnchorID.wrappedValue,
           let rememberedAnchor = anchors.first(where: { $0.anchorID == rememberedAnchorID }) {
            return rememberedAnchor
        }

        if let rememberedSectionID = rememberedNativeSectionID.wrappedValue,
           let rememberedDetail = library.loadSectionDetail(sectionID: rememberedSectionID),
           let rememberedAnchor = anchors.first(where: {
               normalizedSectionNumber($0.sectionNumber) == normalizedSectionNumber(rememberedDetail.sectionNumber)
           }) {
            return rememberedAnchor
        }

        return initialAnchor
    }

    private var firstContentAnchor: PublishedHTMLAnchor? {
        let chapterNumber = normalizedSectionNumber(chapter.chapterNumber)
        return anchors.first {
            $0.level >= 2 && normalizedSectionNumber($0.sectionNumber) != chapterNumber
        }
    }

    private var effectiveTargetAnchorID: String? {
        guard let targetAnchorID else { return nil }
        if chapterSearchScrollRequestID > 0 || nativeFallbackIgnoresSavedOffset { return targetAnchorID }
        guard !opensAtChapterTop, (rememberedScrollOffset.wrappedValue ?? 0) <= 0 else { return nil }
        if rememberedAnchorID.wrappedValue == targetAnchorID { return targetAnchorID }
        return firstContentAnchor?.anchorID == targetAnchorID ? nil : targetAnchorID
    }

    var body: some View {
        Group {
            if let chapterURL, let readAccessURL {
                if !isRolloutRouteResolved {
                    chapterLoadingShell
                } else if usesNativeRolloutReader, let nativeReaderRoute = effectiveNativeReaderRoute {
                    ChapterReaderView(
                        chapter: chapter,
                        initialSectionID: initialSection.id,
                        opensAtChapterTop: opensAtChapterTop,
                        rememberedSectionID: rememberedNativeSectionID,
                        nativeDocumentRoute: nativeReaderRoute,
                        preparedNativeOpening: preparedNativeOpening,
                        initialSectionNumber: initialSection.sectionNumber,
                        initialSectionTitle: initialSection.displayTitle,
                        initialAnchorID: restoredInitialAnchor?.anchorID,
                        rememberedNativeBlockID: rememberedNativeBlockID,
                        rememberedNativeViewport: rememberedNativeViewport,
                        rememberedAnchorID: rememberedAnchorID,
                        onNativeFallbackToHTML: { message, requestedAnchorID in
                            if let requestedAnchorID {
                                targetAnchorID = requestedAnchorID
                                selectedAnchor = anchors.first { $0.anchorID == requestedAnchorID }
                                nativeFallbackIgnoresSavedOffset = true
                            }
                            readerPresentation = .html
#if DEBUG
                            nativeReaderFallbackMessage = message
#endif
                        },
                        onNativeOpenReference: { section in
                            inlineReferenceDestination = section
                        }
                    )
                } else if hasActivatedHTMLReader {
                    htmlReader(chapterURL: chapterURL, readAccessURL: readAccessURL)
                        .codeNavigationTopScrollEdge()
                } else {
                    chapterLoadingShell
                }
            } else if library.selectedVersion?.contentKind == .authored {
                missingAuthoredContentView
            } else {
                ChapterReaderView(
                    chapter: chapter,
                    initialSectionID: initialSection.id,
                    rememberedSectionID: rememberedNativeSectionID
                )
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $inlineReferenceDestination) { section in
            ReaderView(sectionID: section.id)
        }
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
#if DEBUG
            if NativeReaderRolloutPolicy.activeStage != .disabled {
                ToolbarItem(placement: .topBarTrailing) {
                    readerDiagnosticSelector
                }
            }
#endif
            // The native and legacy text Readers supply their own toolbars.
            // Only the HTML presentation uses this wrapper's anchor picker.
            if !usesNativeRolloutReader && chapterURL != nil {
                let targets = jumpTargets
                ToolbarItem(placement: .principal) {
                    ReaderChapterTitle(title: chapter.title, currentSection: currentJumpLabel(in: targets), accent: accentColor)
                    .sourceProblemReporting(sectionID: currentBookmarkSectionID)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    ReaderCurrentSectionBookmarkButton(sectionID: currentBookmarkSectionID, accentColor: accentColor)
                }
                ChapterReaderToolbarActions(canOpenSections: !targets.isEmpty) {
                    chapterSearchQuery = ""
                    isChapterSearchPresented = false
                    isJumpPickerPresented = true
                } onSearch: {
                    isChapterSearchPresented = true
                }
            }

        }
        .tint(accentColor)
        .task(id: chapterURL?.standardizedFileURL.path) {
            let sourcePath = chapterURL?.standardizedFileURL.path
            // SwiftUI restarts this task when a tab reappears. Keep the resolved
            // reader subtree alive so its scroll view and measured position survive.
            if rolloutRouteResolved, resolvedReaderSourcePath == sourcePath {
                return
            }
            nativeReaderRoute = nil
            readerPresentation = .html
            nativeReaderFallbackMessage = nil
            let rolloutStage = NativeReaderRolloutPolicy.activeStage
            guard rolloutStage != .disabled else {
                rolloutRouteResolved = true
                return
            }
            rolloutRouteResolved = false
            guard let chapterURL else {
                rolloutRouteResolved = true
                return
            }
            let resolvedRoute = await NativeReaderDocumentStore.shared.rolloutRoute(
                for: chapterURL,
                stage: rolloutStage
            )
            guard !Task.isCancelled else { return }
            resolvedReaderSourcePath = sourcePath
            nativeReaderRoute = resolvedRoute
            readerPresentation = resolvedRoute == nil ? .html : .native
            rolloutRouteResolved = true
        }
        .onAppear {
            readerIsVisible = true
            ensureHTMLStoreCached()
            library.noteChapterOpened(chapter: chapter)
            if targetAnchorID == nil {
                let anchor = restoredInitialAnchor
                selectedAnchor = anchor
                targetAnchorID = opensAtChapterTop ? nil : rememberedAnchorID.wrappedValue ?? anchor?.anchorID
            }
            recomputeSavedDecorations()
            requestScrollPositionSync()
        }
        .onChange(of: isBrowserTabActive) { _, isActive in
            if isActive {
                requestScrollPositionSync()
            } else {
                htmlScrollCheckpoint.flush()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { htmlScrollCheckpoint.flush() }
        }
        .onChange(of: library.bookmarkRevision) { _, _ in
            recomputeSavedDecorations()
        }
        .onChange(of: anchors) { _, _ in
            recomputeSavedDecorations()
        }
        .onChange(of: chapter.id) { _, _ in
            nativeFallbackIgnoresSavedOffset = false
            lastRecordedVisibleAnchorID = nil
            chapterSearchScrollRequestID = 0
            chapterSearchQuery = ""
        }
        .task(id: "\(chapter.id)|\(usesNativeRolloutReader)|\(isRolloutRouteResolved)") {
            guard isRolloutRouteResolved,
                  hasActivatedHTMLReader,
                  !usesNativeRolloutReader else { return }
            if anchors.isEmpty {
                await loadAnchors()
            }
            requestScrollPositionSync()
        }
        .sheet(isPresented: $isJumpPickerPresented) {
            jumpPickerSheet
        }
        .chapterFindBar(isPresented: isChapterSearchPresented) { usesReaderBottomBar in
            ChapterSearchSheet(
                title: chapter.displayLabel,
                entries: chapterSearchEntries,
                query: $chapterSearchQuery,
                onSelect: { entry in
                    chapterSearchScrollQuery = chapterSearchQuery
                    chapterSearchScrollRequestID &+= 1
                    if let anchorID = entry.anchorID {
                        targetAnchorID = anchorID
                        selectedAnchor = anchors.first(where: { $0.anchorID == anchorID })
                    } else {
                        let normalized = normalizedSectionNumber(entry.sectionNumber)
                        let anchor = anchors.first { normalizedSectionNumber($0.sectionNumber) == normalized }
                        targetAnchorID = anchor?.anchorID
                        selectedAnchor = anchor
                    }
                },
                isInline: true,
                usesReaderBottomBar: usesReaderBottomBar,
                onClose: { isChapterSearchPresented = false }
            )
            .environmentObject(library)
        }
        .navigationDestination(item: $openedSection) { section in
            ReaderView(sectionID: section.id)
                .environmentObject(library)
        }
        .onDisappear {
            readerIsVisible = false
            htmlScrollCheckpoint.flush()
            chapterSearchQuery = ""
        }
#if DEBUG
        .alert(
            "Native reader used HTML fallback",
            isPresented: Binding(
                get: { nativeReaderFallbackMessage != nil },
                set: { if !$0 { nativeReaderFallbackMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) {
                nativeReaderFallbackMessage = nil
            }
        } message: {
            Text(nativeReaderFallbackMessage ?? "The native reader could not validate this chapter.")
        }
#endif
    }

    private var readerDiagnosticSelector: some View {
        Menu {
            Picker("Reader presentation", selection: $readerPresentation) {
                if nativeReaderRoute != nil {
                    Text(ChapterReaderPresentation.native.title)
                        .tag(ChapterReaderPresentation.native)
                }
                Text(ChapterReaderPresentation.html.title)
                    .tag(ChapterReaderPresentation.html)
            }
            if nativeReaderRoute == nil {
                Label(
                    "Native rollout unavailable at this stage or for this chapter",
                    systemImage: "lock.fill"
                )
                    .foregroundStyle(.secondary)
            }
            Label(
                "Stage: \(NativeReaderRolloutPolicy.activeStage.featureFlagValue)",
                systemImage: "flag.fill"
            )
            .foregroundStyle(.secondary)
        } label: {
            Image(systemName: "ladybug.fill")
                .font(.system(size: CodeScreenMetrics.toolbarIconPointSize, weight: .semibold))
                .frame(width: CodeScreenMetrics.toolbarButtonSize, height: CodeScreenMetrics.toolbarButtonSize)
        }
        .accessibilityLabel("Internal reader mode")
        .accessibilityValue(readerPresentation.title)
    }

    private var chapterLoadingShell: some View {
        pageBackgroundColor
            .ignoresSafeArea()
            .overlay {
                ProgressView()
                    .controlSize(.regular)
                    .tint(Color(uiColor: library.accentColor(for: chapter.codeSectionID)))
            }
    }

    private var missingAuthoredContentView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Chapter HTML Missing")
                .font(.headline)
            Text("This version is configured to use authored HTML, but the chapter file for \(chapter.displayLabel) was not found in the published bundle.")
                .foregroundStyle(.secondary)
            if let relativePath = library.selectedVersion?.authoredHTMLBundlePath {
                Text(relativePath)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(24)
        .background(Color(uiColor: .systemBackground).ignoresSafeArea())
    }

    private func htmlReader(chapterURL: URL, readAccessURL: URL) -> some View {
        ChapterHTMLWebView(
            definitionContext: chapter.codeSectionID.map { codeSectionID in
                ReaderDefinitionContext(versionFileName: chapterURL.path,
                                        codeSectionID: codeSectionID, chapterNumber: chapter.chapterNumber, chapterID: chapter.id)
            },
            chapterURL: chapterURL,
            readAccessURL: readAccessURL,
            targetAnchorID: effectiveTargetAnchorID,
            targetSearchText: chapterSearchScrollQuery,
            targetSearchRequestID: chapterSearchScrollRequestID,
            readerTheme: library.readerTheme,
            accentHex: library.accentHex(for: chapter.codeSectionID, colorScheme: colorScheme),
            colorScheme: colorScheme,
            bookmarkedAnchorIDs: bookmarkedAnchorIDs,
            bookmarkedSectionNumbers: bookmarkedSectionNumbers,
            expandAllTrigger: 0,
            collapseAllTrigger: 0,
            scrollToTopTrigger: 0,
            scrollPositionSyncTrigger: scrollPositionSyncTrigger,
            reloadTrigger: htmlReloadTrigger,
            restoreScrollOffset: {
                nativeFallbackIgnoresSavedOffset || opensAtChapterTop ? nil : rememberedScrollOffset.wrappedValue
            },
            scrollCheckpoint: htmlScrollCheckpoint,
            scrollSessionID: library.privateSessionID,
            tracksScrollOffset: readerIsVisible && isBrowserTabActive && scenePhase == .active,
            onLoadStateChange: { state in
                htmlLoadState = state
            },
            onVisibleAnchorChange: { anchorID in
                guard let anchor = anchorMatchingReportedAnchorID(anchorID) else { return }
                if selectedAnchor?.anchorID != anchor.anchorID {
                    selectedAnchor = anchor
                }
                if rememberedAnchorID.wrappedValue != anchor.anchorID {
                    rememberedAnchorID.wrappedValue = anchor.anchorID
                }
                if let summary = library.sectionSummary(
                    sectionNumber: anchor.sectionNumber,
                    codeSectionID: chapter.codeSectionID
                ),
                   rememberedNativeSectionID.wrappedValue != summary.id {
                    rememberedNativeSectionID.wrappedValue = summary.id
                }
                recordRecentlyViewedForVisibleAnchor(anchorID)
            },
            onJumpAccepted: { anchorID in
                rememberedAnchorID.wrappedValue = anchorID
                if let sectionID = htmlChapterSearchEntries.first(where: { $0.anchorID == anchorID })?.sectionID
                    ?? selectedAnchor.flatMap({ library.sectionSummary(sectionNumber: $0.sectionNumber, codeSectionID: chapter.codeSectionID)?.id }) {
                    rememberedNativeSectionID.wrappedValue = sectionID
                }
                rememberedScrollOffset.wrappedValue = nil
            },
            onScrollOffsetChange: { offset in
                rememberedScrollOffset.wrappedValue = Double(offset)
            },
            onOpenSectionForAnchor: { target in
                if target.action == "openReference" {
                    openInlineReference(target)
                }
            },
            onResearchSelection: { target in
                let sectionTarget = ChapterHTMLSectionTarget(
                    anchorID: target.anchorID,
                    sectionNumber: target.sectionNumber
                )
                guard let section = sectionSummary(for: sectionTarget) else { return }
                library.sendToResearch(
                    ResearchSelectionRequest(
                        sectionID: String(section.id),
                        selectedText: target.selectedText
                    )
                )
            }
        )
        .overlay {
            chapterLoadOverlay
        }
        .background(pageBackgroundColor.ignoresSafeArea())
    }

    @ViewBuilder
    private var chapterLoadOverlay: some View {
        switch htmlLoadState {
        case .loading:
            ProgressView("Loading chapter…")
                .tint(accentColor)
                .padding(18)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        case .failed(let message):
            VStack(spacing: 16) {
                CodeEmptyStateCard(
                    title: "Couldn’t Load Chapter",
                    systemImage: "arrow.clockwise",
                    description: message,
                    accent: accentColor
                )

                Button("Retry") {
                    htmlLoadState = .loading
                    htmlReloadTrigger &+= 1
                }
                .buttonStyle(.borderedProminent)
                .tint(accentColor)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(pageBackgroundColor)
        case .loaded:
            EmptyView()
        }
    }

    private var jumpPickerSheet: some View {
        ChapterSectionPicker(accent: accentColor, chapter: chapter, onClose: { isJumpPickerPresented = false }) {
            ForEach(jumpTargets) { target in
                ChapterSectionPickerRow(
                    title: target.menuLabel,
                    depth: ChapterSectionPickerRow.depth(title: target.title, sectionNumber: target.sectionNumber, fallback: target.level <= 2 ? 1 : 2),
                    isCurrent: selectedAnchor.map {
                        target.anchorID == $0.anchorID ||
                            normalizedSectionNumber(target.sectionNumber) == normalizedSectionNumber($0.sectionNumber)
                    } ?? false,
                    accent: accentColor
                ) {
                    chapterSearchScrollQuery = nil
                    chapterSearchScrollRequestID &+= 1
                    selectedAnchor = target.publishedAnchor
                    targetAnchorID = target.scrollTarget
                    isJumpPickerPresented = false
                }
            }
        }
    }

    private func requestScrollPositionSync() {
        scrollPositionSyncTrigger &+= 1
    }

    private func recordRecentlyViewedForVisibleAnchor(_ anchorID: String?) {
        guard let anchorID,
              let anchor = anchorMatchingReportedAnchorID(anchorID),
              lastRecordedVisibleAnchorID != anchorID
        else { return }

        lastRecordedVisibleAnchorID = anchorID
        library.noteSectionOpened(anchor: anchor, chapter: chapter)
    }

    private func anchorMatchingReportedAnchorID(_ anchorID: String) -> PublishedHTMLAnchor? {
        PublishedHTMLContentStore.anchor(matchingReportedID: anchorID, in: anchors)
    }

    private func ensureHTMLStoreCached() {
        let rootPath = htmlStoreCacheKey
        if cachedHTMLStore == nil || cachedHTMLStoreRootPath != rootPath {
            cachedHTMLStore = library.authoredHTMLStore(for: chapter)
            cachedHTMLStoreRootPath = rootPath
        }
    }

    private func loadAnchors() async {
        guard let chapterURL else {
            anchors = []
            selectedAnchor = nil
            targetAnchorID = nil
            return
        }

        let loadedAnchors = await Task.detached(priority: .userInitiated) {
            PublishedHTMLContentStore.anchors(in: chapterURL)
        }.value

        guard !Task.isCancelled else { return }
        anchors = loadedAnchors

        let sectionIDByNumber = Dictionary(
            loadedAnchors.compactMap { anchor in
                library.sectionSummary(sectionNumber: anchor.sectionNumber, codeSectionID: chapter.codeSectionID)
                    .map { (anchor.sectionNumber, $0.id) }
            },
            uniquingKeysWith: { first, _ in first }
        )
        htmlChapterSearchEntries = await Task.detached(priority: .userInitiated) {
            Self.makeHTMLChapterSearchEntries(
                chapterURL: chapterURL,
                anchors: loadedAnchors,
                chapter: chapter,
                initialSectionID: initialSection.id,
                sectionIDByNumber: sectionIDByNumber
            )
        }.value

        if chapterSearchScrollRequestID == 0,
           targetAnchorID == nil || targetAnchorID == rememberedAnchorID.wrappedValue {
            let anchor = restoredInitialAnchor
            selectedAnchor = anchor
            if !opensAtChapterTop, let saved = rememberedAnchorID.wrappedValue,
               htmlChapterSearchEntries.contains(where: { $0.anchorID == saved }) {
                targetAnchorID = saved
            } else {
                targetAnchorID = anchor?.anchorID
            }
        }
    }
    private func normalizedSectionNumber(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
            .uppercased()
    }

    private func sectionSummary(for target: ChapterHTMLSectionTarget) -> CodeSectionSummary? {
        if let anchor = anchors.first(where: { $0.anchorID == target.anchorID }),
           let section = library.sectionSummary(sectionNumber: anchor.sectionNumber, codeSectionID: chapter.codeSectionID) {
            return section
        }

        if let sectionNumber = target.sectionNumber,
           let section = library.sectionSummary(sectionNumber: sectionNumber, codeSectionID: chapter.codeSectionID) {
            return section
        }

        if let sectionNumber = target.sectionNumber {
            let normalizedTarget = normalizedSectionNumber(sectionNumber)
            if let anchor = anchors.first(where: { normalizedSectionNumber($0.sectionNumber) == normalizedTarget }),
               let section = library.sectionSummary(sectionNumber: anchor.sectionNumber, codeSectionID: chapter.codeSectionID) {
                return section
            }
        }

        return nil
    }

    private func openInlineReference(_ target: ChapterHTMLSectionTarget) {
        let targetCodeSectionID = target.codePrefix.flatMap(codeSectionID(for:)) ?? chapter.codeSectionID
        guard let sectionNumber = target.sectionNumber,
              let section = library.sectionSummary(
                sectionNumber: sectionNumber,
                codeSectionID: targetCodeSectionID
              ) else { return }
        inlineReferenceDestination = section
    }

    private func codeSectionID(for prefix: String) -> Int64? {
        let normalizedPrefix = prefix.uppercased()
        return library.codeSections.first { codeSection in
            let name = codeSection.name.lowercased()
            switch normalizedPrefix {
            case "BC": return name.contains("building")
            case "PC": return name.contains("plumbing")
            case "MC": return name.contains("mechanical")
            case "FGC": return name.contains("fuel gas")
            case "AC": return name.contains("administrative")
            default: return false
            }
        }?.id
    }

    private func sectionNumber(from headerLine: String) -> String {
        let pattern = #"([A-Z]?\d+(?:\.\d+)*)\b"#
        guard let expression = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return headerLine
        }
        let nsHeader = headerLine as NSString
        let range = NSRange(location: 0, length: nsHeader.length)
        guard let match = expression.firstMatch(in: headerLine, range: range) else {
            return headerLine
        }
        return nsHeader.substring(with: match.range(at: 1))
    }

    nonisolated private static func makeHTMLChapterSearchEntries(
        chapterURL: URL,
        anchors: [PublishedHTMLAnchor],
        chapter: CodeChapter,
        initialSectionID: Int64,
        sectionIDByNumber: [String: Int64]
    ) -> [ChapterSearchSourceEntry] {
        let cacheKey = ChapterSearchEntryCache.key(
            chapterURL: chapterURL,
            chapterID: chapter.id,
            initialSectionID: initialSectionID,
            anchorCount: anchors.count,
            mappedSectionCount: sectionIDByNumber.count
        )
        if let cached = ChapterSearchEntryCache.entries(for: cacheKey) {
            return cached
        }

        guard let html = try? String(contentsOf: chapterURL, encoding: .utf8) else {
            return []
        }

        var entries: [ChapterSearchSourceEntry] = []
        let chapterNumber = normalizedSectionNumberStatic(chapter.chapterNumber)
        for anchor in anchors where anchor.level >= 2 && normalizedSectionNumberStatic(anchor.sectionNumber) != chapterNumber {
            guard let sectionID = sectionIDByNumber[anchor.sectionNumber] else { continue }
            entries.append(
                ChapterSearchSourceEntry(
                    sectionID: sectionID,
                    sectionNumber: anchor.sectionNumber,
                    title: anchor.title,
                    anchorID: anchor.anchorID,
                    displayText: nil
                )
            )
        }

        entries.append(
            contentsOf: textBlockSearchEntries(
                in: html,
                initialSectionID: initialSectionID,
                nativeSectionIDByNumber: sectionIDByNumber
            )
        )

        var seenIDs: Set<String> = []
        let uniqueEntries = entries.filter { entry in
            guard !seenIDs.contains(entry.id) else { return false }
            seenIDs.insert(entry.id)
            return true
        }
        ChapterSearchEntryCache.store(uniqueEntries, for: cacheKey)
        return uniqueEntries
    }

    nonisolated private static func textBlockSearchEntries(
        in html: String,
        initialSectionID: Int64,
        nativeSectionIDByNumber: [String: Int64]
    ) -> [ChapterSearchSourceEntry] {
        let pattern = #"<div\s+id="([^"]+)"(?=[^>]*\brbox\b)(?![^>]*\btoc-destination\b)[^>]*>.*?</div>\s*</div>"#
        guard let expression = try? NSRegularExpression(
            pattern: pattern,
            options: [.caseInsensitive, .dotMatchesLineSeparators]
        ) else {
            return []
        }

        let nsHTML = html as NSString
        let matches = expression.matches(in: html, range: NSRange(location: 0, length: nsHTML.length))
        var currentSectionNumber = nativeSectionIDByNumber.keys.sorted {
            $0.compare($1, options: [.numeric, .caseInsensitive]) == .orderedAscending
        }.first ?? ""

        return matches.compactMap { match in
            guard match.numberOfRanges >= 2 else { return nil }
            let id = nsHTML.substring(with: match.range(at: 1))
            let blockHTML = nsHTML.substring(with: match.range(at: 0))
            let text = plainTextFromHTML(blockHTML)
            guard text.count > 2 else { return nil }

            if let sectionNumber = firstSectionReference(in: text),
               nativeSectionIDByNumber[sectionNumber] != nil {
                currentSectionNumber = sectionNumber
            }

            let title = definitionTitle(from: text) ?? text
            let sectionID = nativeSectionIDByNumber[currentSectionNumber] ?? initialSectionID
            return ChapterSearchSourceEntry(
                sectionID: sectionID,
                sectionNumber: title,
                title: title,
                anchorID: id,
                displayText: text
            )
        }
    }

    nonisolated private static func definitionTitle(from text: String) -> String? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let pattern = #"^([A-Z0-9][A-Z0-9\s,'’()/-]{1,90})\.\s+"#
        guard let expression = try? NSRegularExpression(pattern: pattern),
              let match = expression.firstMatch(in: trimmed, range: NSRange(location: 0, length: (trimmed as NSString).length)),
              match.numberOfRanges > 1 else {
            return nil
        }
        return (trimmed as NSString)
            .substring(with: match.range(at: 1))
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    nonisolated private static func firstSectionReference(in text: String) -> String? {
        let pattern = #"^\s*(\d{3}(?:\.\d+)*)\b"#
        guard let expression = try? NSRegularExpression(pattern: pattern),
              let match = expression.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)),
              match.numberOfRanges > 1 else {
            return nil
        }
        return (text as NSString).substring(with: match.range(at: 1))
    }

    nonisolated private static func plainTextFromHTML(_ html: String) -> String {
        html
            .replacingOccurrences(of: #"<br\s*/?>"#, with: " ", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"<[^>]+>"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&#160;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    nonisolated private static func normalizedSectionNumberStatic(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".:;"))
            .uppercased()
    }
}

private struct ChapterHTMLJumpTarget: Identifiable, Hashable {
    let sectionNumber: String
    let title: String
    let anchorID: String?
    let level: Int

    var id: String {
        anchorID ?? sectionNumber
    }

    var menuLabel: String {
        if title.hasPrefix("Article \(sectionNumber):") || title.hasPrefix("Chapter \(sectionNumber):") {
            return title
        }
        if title.range(of: #"^Section\s+[A-Z]+\s+\#(NSRegularExpression.escapedPattern(for: sectionNumber))\b"#, options: [.regularExpression, .caseInsensitive]) != nil {
            return title
        }
        return "\(sectionNumber) \(title)"
    }

    var scrollTarget: String {
        anchorID ?? sectionNumber
    }

    var publishedAnchor: PublishedHTMLAnchor {
        PublishedHTMLAnchor(
            sectionNumber: sectionNumber,
            title: title,
            anchorID: scrollTarget,
            level: level
        )
    }
}

enum NativeReaderEditionLabel {
    static func label(for version: String?) -> String {
        guard let version else { return "Edition unavailable" }
        switch UserContentSyncCodeVersion.server(version) {
        case UserContentSyncCodeVersion.canonicalNYC2014: return "2014"
        case UserContentSyncCodeVersion.canonicalNYC2022: return "2022"
        case UserContentSyncCodeVersion.canonicalNYC2025Specialty: return "2025"
        case UserContentSyncCodeVersion.canonicalNYCZoning: return "through 2026-11-12"
        case UserContentSyncCodeVersion.canonicalNYCExistingBuilding: return "effective 2027-07-17"
        case UserContentSyncCodeVersion.canonicalNYCEnactedAdministrative: return "through 2026-07-25"
        default: return version
        }
    }
}
