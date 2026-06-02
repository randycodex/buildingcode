import SwiftUI

struct ChapterHTMLReaderView: View {
    let chapter: CodeChapter
    let initialSection: CodeSectionSummary
    var rememberedNativeSectionID: Binding<Int64?> = .constant(nil)
    var rememberedAnchorID: Binding<String?> = .constant(nil)
    var rememberedScrollOffset: Binding<Double?> = .constant(nil)

    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.isBrowserTabActive) private var isBrowserTabActive

    @State private var targetAnchorID: String?
    @State private var selectedAnchor: PublishedHTMLAnchor?
    @State private var anchors: [PublishedHTMLAnchor] = []
    @State private var openedSection: CodeSectionSummary?
    @State private var noteTarget: ReaderSectionDetail?
    @State private var noteBody = ""
    @State private var hasActivatedHTMLReader = true
    @State private var isJumpPickerPresented = false
    @State private var cachedBookmarkedAnchorIDs: Set<String> = []
    @State private var cachedBookmarkedSectionNumbers: Set<String> = []
    @State private var cachedNotedSectionNumbers: Set<String> = []
    @State private var cachedBookmarkRevision: Int = -1
    @State private var cachedHTMLStoreRootPath: String?
    @State private var cachedHTMLStore: PublishedHTMLContentStore?
    @State private var scrollProgress: CGFloat = 0
    @State private var scrollProgressSyncTrigger = 0
    @State private var lastRecordedVisibleAnchorID: String?
    @State private var isChapterSearchPresented = false
    @State private var chapterSearchQuery = ""

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
        jumpTargets.compactMap { target in
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

    private var notedSectionNumbers: Set<String> {
        cachedNotedSectionNumbers
    }

    private func recomputeSavedDecorations() {
        var anchorIDs: Set<String> = []
        var sectionNumbers = Set(library.bookmarks.map { bookmark in
            normalizedSectionNumber(bookmark.sectionNumber)
        })
        var notedSectionNumbers: Set<String> = []

        for anchor in anchors {
            guard let summary = library.sectionSummary(
                sectionNumber: anchor.sectionNumber,
                codeSectionID: chapter.codeSectionID
            ) else { continue }
            if library.isBookmarked(sectionID: summary.id) {
                anchorIDs.insert(anchor.anchorID)
                sectionNumbers.insert(normalizedSectionNumber(summary.sectionNumber))
            }
            if !library.noteBody(sectionID: summary.id).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                notedSectionNumbers.insert(normalizedSectionNumber(summary.sectionNumber))
            }
        }

        cachedBookmarkedAnchorIDs = anchorIDs
        cachedBookmarkedSectionNumbers = sectionNumbers
        cachedNotedSectionNumbers = notedSectionNumbers
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
                if hasActivatedHTMLReader {
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

            ToolbarItem(placement: .topBarTrailing) {
                chapterSearchToolbarButton
            }
        }
        .tint(accentColor)
        .onAppear {
            ensureHTMLStoreCached()
            library.noteChapterOpened(chapter: chapter)
            library.refreshBookmarks()
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
        .task(id: chapter.id) {
            guard hasActivatedHTMLReader else { return }
            if anchors.isEmpty {
                await loadAnchors()
            }
            recordRecentlyViewedForVisibleAnchor(targetAnchorID ?? selectedAnchor?.anchorID)
            requestScrollProgressSync()
        }
        .sheet(isPresented: $isJumpPickerPresented) {
            jumpPickerSheet
        }
        .sheet(item: $noteTarget) { detail in
            ChapterNoteSheet(
                detail: detail,
                noteBody: $noteBody,
                accentColor: accentColor,
                isBookmarked: library.isBookmarked(sectionID: detail.id),
                onToggleBookmark: {
                    let isBookmarked = library.toggleBookmark(sectionID: detail.id)
                    recomputeSavedDecorations()
                    return isBookmarked
                },
                onSave: { body in
                    library.saveNote(sectionID: detail.id, body: body)
                    recomputeSavedDecorations()
                }
            )
        }
        .fullScreenCover(isPresented: $isChapterSearchPresented) {
            ChapterSearchSheet(
                title: chapter.displayLabel,
                entries: chapterSearchEntries,
                query: $chapterSearchQuery,
                onSelect: { entry in
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
        .safeAreaInset(edge: .top, spacing: 0) {
            if chapterURL != nil, readAccessURL != nil, hasActivatedHTMLReader {
                ChapterReadingProgressBar(progress: scrollProgress, accentColor: accentColor)
            }
        }
        .overlay(alignment: .top) {
            if chapterURL != nil, readAccessURL != nil, hasActivatedHTMLReader {
                CodeTopContentFade(alwaysVisible: true)
            }
        }
        .onDisappear {
            chapterSearchQuery = ""
        }
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
                    .font(.footnote.monospaced())
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
            readerTheme: library.readerTheme,
            accentHex: library.accentHex(for: chapter.codeSectionID, colorScheme: colorScheme),
            colorScheme: colorScheme,
            bookmarkedAnchorIDs: bookmarkedAnchorIDs,
            bookmarkedSectionNumbers: bookmarkedSectionNumbers,
            notedSectionNumbers: notedSectionNumbers,
            expandAllTrigger: 0,
            collapseAllTrigger: 0,
            scrollToTopTrigger: 0,
            scrollProgressSyncTrigger: scrollProgressSyncTrigger,
            restoreScrollOffset: rememberedScrollOffset.wrappedValue,
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
                openNotes(for: target)
            }
        )
        .safeAreaInset(edge: .bottom, spacing: 0) {
            jumpBar
                .background(pageBackgroundColor)
        }
        .background(pageBackgroundColor.ignoresSafeArea())
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

    private func openNotes(for target: ChapterHTMLSectionTarget) {
        guard let section = sectionSummary(for: target) else { return }
        Task { @MainActor in
            guard let detail = await library.loadSectionDetailAsync(sectionID: section.id) else { return }
            noteBody = library.noteBody(sectionID: detail.id)
            noteTarget = detail
        }
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
