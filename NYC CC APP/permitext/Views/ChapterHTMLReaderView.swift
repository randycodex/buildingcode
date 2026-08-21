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
    var rememberedNativeSectionID: Binding<Int64?> = .constant(nil)
    var rememberedNativeBlockID: Binding<String?> = .constant(nil)
    var rememberedAnchorID: Binding<String?> = .constant(nil)
    var rememberedScrollOffset: Binding<Double?> = .constant(nil)

    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.isBrowserTabActive) private var isBrowserTabActive

    @State private var targetAnchorID: String?
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
    @State private var scrollProgress: CGFloat = 0
    @State private var scrollProgressSyncTrigger = 0
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
    @State private var readerPresentation: ChapterReaderPresentation = .html
    @State private var nativeReaderFallbackMessage: String?
    @State private var rolloutRouteResolved = NativeReaderRolloutPolicy.activeStage == .disabled

    private var accentColor: Color {
        Color(uiColor: library.accentColor(for: chapter.codeSectionID))
    }

    private var pageBackgroundColor: Color {
        colorScheme == .dark ? .black : Color(uiColor: .systemGroupedBackground)
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

    private var htmlStore: PublishedHTMLContentStore {
        let rootPath = htmlStoreCacheKey
        if let cachedHTMLStore, cachedHTMLStoreRootPath == rootPath {
            return cachedHTMLStore
        }
        return library.authoredHTMLStore(for: chapter)
    }

    private var htmlStoreCacheKey: String {
        "\(library.selectedVersion?.authoredHTMLBundlePath ?? ""):\(chapter.codeSectionID ?? 0)"
    }

    private var chapterURL: URL? {
        htmlStore.chapterURL(chapterNumber: chapter.chapterNumber)
    }

    private var usesNativeRolloutReader: Bool {
        readerPresentation == .native && nativeReaderRoute != nil
    }

    private var isRolloutRouteResolved: Bool {
        rolloutRouteResolved
    }

    private var readAccessURL: URL? {
        htmlStore.readAccessURL()
    }

    private var currentJumpLabel: String {
        if let selectedAnchor,
           let selectedTarget = jumpTargets.first(where: { $0.anchorID == selectedAnchor.anchorID || normalizedSectionNumber($0.sectionNumber) == normalizedSectionNumber(selectedAnchor.sectionNumber) }) {
            return selectedTarget.menuLabel
        }
        if let initialTarget = jumpTargets.first(where: { normalizedSectionNumber($0.sectionNumber) == normalizedSectionNumber(initialSection.sectionNumber) }) {
            return initialTarget.menuLabel
        }
        return jumpTargets.first?.menuLabel ?? ""
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

    private var shouldRestoreAtChapterTop: Bool {
        guard (rememberedScrollOffset.wrappedValue ?? 0) <= 0,
              let restoredInitialAnchor,
              let firstContentAnchor else {
            return false
        }

        return restoredInitialAnchor.anchorID == firstContentAnchor.anchorID
    }

    private var effectiveTargetAnchorID: String? {
        shouldRestoreAtChapterTop ? nil : targetAnchorID
    }

    var body: some View {
        Group {
            if let chapterURL, let readAccessURL {
                if !isRolloutRouteResolved {
                    chapterLoadingShell
                } else if usesNativeRolloutReader, let nativeReaderRoute {
                    ChapterReaderView(
                        chapter: chapter,
                        initialSectionID: initialSection.id,
                        rememberedSectionID: rememberedNativeSectionID,
                        nativeDocumentRoute: nativeReaderRoute,
                        initialSectionNumber: initialSection.sectionNumber,
                        initialAnchorID: restoredInitialAnchor?.anchorID,
                        rememberedNativeBlockID: rememberedNativeBlockID,
                        rememberedAnchorID: rememberedAnchorID,
                        onNativeFallbackToHTML: { message in
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
            ToolbarItem(placement: .principal) {
                VStack(spacing: 2) {
                    if !library.codeSections.isEmpty {
                        Text(library.codeSectionName(id: chapter.codeSectionID))
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(accentColor)
                            .lineLimit(1)
                    }
                    Text(chapter.displayLabel + ":")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text(chapter.title)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: 250)
                .multilineTextAlignment(.center)
            }

            ToolbarItemGroup(placement: .topBarTrailing) {
#if DEBUG
                if NativeReaderRolloutPolicy.activeStage != .disabled {
                    readerDiagnosticSelector
                }
#endif
                if !usesNativeRolloutReader {
                    chapterSearchToolbarButton
                }
            }
        }
        .tint(accentColor)
        .task(id: chapterURL?.standardizedFileURL.path) {
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
            nativeReaderRoute = resolvedRoute
            readerPresentation = resolvedRoute == nil ? .html : .native
            rolloutRouteResolved = true
        }
        .onAppear {
            ensureHTMLStoreCached()
            library.noteChapterOpened(chapter: chapter)
            if targetAnchorID == nil {
                let anchor = restoredInitialAnchor
                selectedAnchor = anchor
                targetAnchorID = anchor?.anchorID
            }
            recomputeSavedDecorations()
            requestScrollProgressSync()
        }
        .onChange(of: isBrowserTabActive) { _, isActive in
            if isActive {
                requestScrollProgressSync()
            }
        }
        .onChange(of: library.bookmarkRevision) { _, _ in
            recomputeSavedDecorations()
        }
        .onChange(of: anchors) { _, _ in
            recomputeSavedDecorations()
        }
        .onChange(of: chapter.id) { _, _ in
            scrollProgress = 0
            lastRecordedVisibleAnchorID = nil
            chapterSearchQuery = ""
        }
        .task(id: "\(chapter.id)|\(usesNativeRolloutReader)|\(isRolloutRouteResolved)") {
            guard isRolloutRouteResolved,
                  hasActivatedHTMLReader,
                  !usesNativeRolloutReader else { return }
            if anchors.isEmpty {
                await loadAnchors()
            }
            recordRecentlyViewedForVisibleAnchor(targetAnchorID ?? selectedAnchor?.anchorID)
            requestScrollProgressSync()
        }
        .sheet(isPresented: $isJumpPickerPresented) {
            jumpPickerSheet
        }
        .fullScreenCover(isPresented: $isChapterSearchPresented) {
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
                        rememberedAnchorID.wrappedValue = anchorID
                    } else {
                        let normalized = normalizedSectionNumber(entry.sectionNumber)
                        let anchor = anchors.first { normalizedSectionNumber($0.sectionNumber) == normalized }
                        targetAnchorID = anchor?.anchorID
                        selectedAnchor = anchor
                        rememberedAnchorID.wrappedValue = anchor?.anchorID
                    }
                    rememberedNativeSectionID.wrappedValue = entry.sectionID
                }
            )
            .environmentObject(library)
        }
        .navigationDestination(item: $openedSection) { section in
            ReaderView(sectionID: section.id)
                .environmentObject(library)
        }
        .overlay(alignment: .top) {
            if chapterURL != nil,
               readAccessURL != nil,
               isRolloutRouteResolved,
               hasActivatedHTMLReader,
               !usesNativeRolloutReader {
                CodeTopContentFade(alwaysVisible: true)
            }
        }
        .onDisappear {
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
                .background(Color(uiColor: .systemBackground))
                .clipShape(Capsule(style: .continuous))
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
            .safeAreaInset(edge: .bottom, spacing: 0) {
                jumpBar
                    .redacted(reason: .placeholder)
                    .allowsHitTesting(false)
                    .background(pageBackgroundColor)
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
            scrollProgressSyncTrigger: scrollProgressSyncTrigger,
            reloadTrigger: htmlReloadTrigger,
            restoreScrollOffset: rememberedScrollOffset.wrappedValue,
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
            onScrollProgressChange: { progress in
                scrollProgress = progress
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
        .safeAreaInset(edge: .bottom, spacing: 0) {
            jumpBar
                .background(pageBackgroundColor)
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

    private var jumpBar: some View {
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
            .disabled(jumpTargets.isEmpty)

            ReaderCurrentSectionBookmarkButton(
                sectionID: currentBookmarkSectionID,
                accentColor: accentColor
            )
        }
        .padding(.horizontal, 16)
        .padding(.top, 6)
        .padding(.bottom, 8)
    }

    private var jumpPickerSheet: some View {
        NavigationStack {
            List {
                ForEach(jumpTargets) { target in
                    Button {
                        chapterSearchScrollQuery = nil
                        selectedAnchor = target.publishedAnchor
                        targetAnchorID = target.scrollTarget
                        isJumpPickerPresented = false
                    } label: {
                        ChapterHTMLJumpTargetRow(
                            target: target,
                            isCurrent: target.anchorID == selectedAnchor?.anchorID ||
                                normalizedSectionNumber(target.sectionNumber) == normalizedSectionNumber(selectedAnchor?.sectionNumber ?? ""),
                            accentColor: accentColor
                        )
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
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func requestScrollProgressSync() {
        scrollProgressSyncTrigger &+= 1
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
        if let exactAnchor = anchors.first(where: { $0.anchorID == anchorID }) {
            return exactAnchor
        }

        let normalizedReportedID = normalizedSectionNumber(anchorID)
        return anchors.first { anchor in
            normalizedReportedID.contains(normalizedSectionNumber(anchor.sectionNumber))
        }
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

        if targetAnchorID == nil {
            let anchor = restoredInitialAnchor
            selectedAnchor = anchor
            targetAnchorID = anchor?.anchorID
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

private struct ChapterHTMLJumpTargetRow: View {
    let target: ChapterHTMLJumpTarget
    let isCurrent: Bool
    let accentColor: Color

    var body: some View {
        VStack(alignment: .leading, spacing: target.isPrimarySection ? 5 : 3) {
            if target.isPrimarySection {
                Text(target.menuLabel)
                    .font(.headline.weight(.bold))
                    .foregroundStyle(isCurrent ? accentColor : .primary)
                    .lineLimit(2)
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(target.sectionNumber)
                        .font(target.numberFont)
                        .foregroundStyle(isCurrent ? accentColor : accentColor.opacity(0.88))
                        .lineLimit(1)

                    Text(target.cleanTitle)
                        .font(target.titleFont)
                        .foregroundStyle(target.titleColor)
                        .lineLimit(2)
                }
            }

            if isCurrent {
                Text("Current")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(accentColor)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.leading, target.menuIndent)
        .padding(.vertical, target.rowVerticalPadding)
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
        if title.range(of: #"^Section\s+[A-Z]+\s+\#(NSRegularExpression.escapedPattern(for: sectionNumber))\b"#, options: [.regularExpression, .caseInsensitive]) != nil {
            return title
        }
        return "\(sectionNumber) \(title)"
    }

    var menuIndent: CGFloat {
        guard sectionNumber.contains(".") else { return 0 }
        return CGFloat(min(hierarchyDepth, 3)) * 16
    }

    var hierarchyDepth: Int {
        guard sectionNumber.contains(".") else { return 0 }
        return max(0, sectionNumber.split(separator: ".").count - 1)
    }

    var isPrimarySection: Bool {
        level <= 2 || title.range(of: #"^Section\s+"#, options: [.regularExpression, .caseInsensitive]) != nil
    }

    var cleanTitle: String {
        let escapedSection = NSRegularExpression.escapedPattern(for: sectionNumber)
        let pattern = #"^\s*(?:Section\s+[A-Z]+\s+)?"# + escapedSection + #"\s*[:.]?\s*"#
        return title.replacingOccurrences(
            of: pattern,
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )
        .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var numberFont: Font {
        hierarchyDepth <= 1 ? .body.weight(.bold) : .callout.weight(.semibold)
    }

    var titleFont: Font {
        hierarchyDepth <= 1 ? .body.weight(.semibold) : .callout.weight(.medium)
    }

    var titleColor: Color {
        hierarchyDepth <= 1 ? .primary : .secondary
    }

    var rowVerticalPadding: CGFloat {
        isPrimarySection ? 8 : 5
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
