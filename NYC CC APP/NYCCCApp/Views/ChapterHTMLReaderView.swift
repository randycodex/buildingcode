import SwiftUI

struct ChapterHTMLReaderView: View {
    let chapter: CodeChapter
    let initialSection: CodeSectionSummary

    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.colorScheme) private var colorScheme

    @State private var targetAnchorID: String?
    @State private var selectedAnchor: PublishedHTMLAnchor?
    @State private var anchors: [PublishedHTMLAnchor] = []
    @State private var openedSection: CodeSectionSummary?
    @State private var hasActivatedHTMLReader = true
    @State private var isJumpPickerPresented = false
    @State private var scrollToTopTrigger = 0
    @State private var cachedBookmarkedAnchorIDs: Set<String> = []
    @State private var cachedBookmarkedSectionNumbers: Set<String> = []
    @State private var cachedBookmarkRevision: Int = -1
    @State private var cachedHTMLStoreRootPath: String?
    @State private var cachedHTMLStore: PublishedHTMLContentStore?

    private var accentColor: Color {
        Color(uiColor: library.readerTheme.accentColor)
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

    private var shouldUseNativeAuthoredReader: Bool {
        guard library.selectedVersion?.contentKind == .authored else { return false }
        return !library.sectionGroups(for: chapter).isEmpty
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
        let sectionAnchors = anchors.filter { $0.level <= 2 }
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

        return library.sectionGroups(for: chapter).map { group in
            ChapterHTMLJumpTarget(
                sectionNumber: sectionNumber(from: group.headerLine),
                title: group.displayLabel,
                anchorID: nil,
                level: 2
            )
        }
    }

    private var bookmarkedAnchorIDs: Set<String> {
        cachedBookmarkedAnchorIDs
    }

    private var bookmarkedSectionNumbers: Set<String> {
        cachedBookmarkedSectionNumbers
    }

    private func recomputeBookmarkedSets() {
        var anchorIDs: Set<String> = []
        var sectionNumbers = Set(library.bookmarks.map { bookmark in
            normalizedSectionNumber(bookmark.sectionNumber)
        })

        for anchor in anchors {
            guard let summary = library.sectionSummary(sectionNumber: anchor.sectionNumber),
                  library.isBookmarked(sectionID: summary.id)
            else { continue }
            anchorIDs.insert(anchor.anchorID)
            sectionNumbers.insert(normalizedSectionNumber(summary.sectionNumber))
        }

        cachedBookmarkedAnchorIDs = anchorIDs
        cachedBookmarkedSectionNumbers = sectionNumbers
        cachedBookmarkRevision = library.bookmarkRevision
    }

    private var initialAnchor: PublishedHTMLAnchor? {
        anchors.first { normalizedSectionNumber($0.sectionNumber) == normalizedSectionNumber(initialSection.sectionNumber) }
    }

    var body: some View {
        Group {
            if shouldUseNativeAuthoredReader {
                ChapterReaderView(chapter: chapter, initialSectionID: initialSection.id)
            } else if let chapterURL, let readAccessURL {
                if hasActivatedHTMLReader {
                    htmlReader(chapterURL: chapterURL, readAccessURL: readAccessURL)
                } else {
                    chapterLoadingShell
                }
            } else if library.selectedVersion?.contentKind == .authored {
                missingAuthoredContentView
            } else {
                ChapterReaderView(chapter: chapter, initialSectionID: initialSection.id)
            }
        }
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
        }
        .onAppear {
            ensureHTMLStoreCached()
            library.noteChapterOpened(chapter: chapter)
            library.refreshBookmarks()
            if targetAnchorID == nil {
                let anchor = initialAnchor
                selectedAnchor = anchor
                targetAnchorID = anchor?.anchorID
            }
            recomputeBookmarkedSets()
        }
        .onChange(of: library.bookmarkRevision) { _, _ in
            recomputeBookmarkedSets()
        }
        .onChange(of: anchors) { _, _ in
            recomputeBookmarkedSets()
        }
        .task(id: chapter.id) {
            guard hasActivatedHTMLReader else { return }
            await loadAnchors()
        }
        .task(id: hasActivatedHTMLReader) {
            guard hasActivatedHTMLReader else { return }
            await loadAnchors()
        }
        .sheet(isPresented: $isJumpPickerPresented) {
            jumpPickerSheet
        }
        .navigationDestination(item: $openedSection) { section in
            ReaderView(sectionID: section.id)
                .environmentObject(library)
        }
    }

    private var chapterLoadingShell: some View {
        Color(uiColor: .systemGroupedBackground)
            .ignoresSafeArea()
            .overlay {
                ProgressView()
                    .controlSize(.regular)
                    .tint(Color(uiColor: library.readerTheme.accentColor))
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                jumpBar
                    .redacted(reason: .placeholder)
                    .allowsHitTesting(false)
                    .background(Color(uiColor: .systemGroupedBackground))
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
            targetAnchorID: targetAnchorID,
            readerTheme: library.readerTheme,
            colorScheme: colorScheme,
            bookmarkedAnchorIDs: bookmarkedAnchorIDs,
            bookmarkedSectionNumbers: bookmarkedSectionNumbers,
            expandAllTrigger: 0,
            collapseAllTrigger: 0,
            scrollToTopTrigger: scrollToTopTrigger,
            onVisibleAnchorChange: { anchorID in
                guard let anchor = anchors.first(where: { $0.anchorID == anchorID }) else { return }
                // Prefer subsection-level anchors for the jump label so it reflects the current title.
                if anchor.level >= 3 || selectedAnchor == nil {
                    selectedAnchor = anchor
                }
            },
            onOpenSectionForAnchor: { target in
                openedSection = sectionSummary(for: target)
            }
        )
        .safeAreaInset(edge: .bottom, spacing: 0) {
            jumpBar
                .background(Color(uiColor: .systemGroupedBackground))
        }
        .background(Color(uiColor: .systemGroupedBackground).ignoresSafeArea())
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
            .disabled(jumpTargets.isEmpty)

            Button {
                if let firstTarget = jumpTargets.first {
                    selectedAnchor = firstTarget.publishedAnchor
                    targetAnchorID = firstTarget.scrollTarget
                }
                scrollToTopTrigger += 1
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

    private var jumpPickerSheet: some View {
        NavigationStack {
            List {
                ForEach(jumpTargets) { target in
                    Button {
                        selectedAnchor = target.publishedAnchor
                        targetAnchorID = target.scrollTarget
                        isJumpPickerPresented = false
                    } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(target.menuLabel)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(.primary)
                                .lineLimit(2)
                            if target.anchorID == selectedAnchor?.anchorID ||
                                normalizedSectionNumber(target.sectionNumber) == normalizedSectionNumber(selectedAnchor?.sectionNumber ?? "") {
                                Text("Current")
                                    .font(.caption)
                                    .foregroundStyle(accentColor)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
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
            let anchor = loadedAnchors.first {
                normalizedSectionNumber($0.sectionNumber) == normalizedSectionNumber(initialSection.sectionNumber)
            }
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
           let section = library.sectionSummary(sectionNumber: anchor.sectionNumber) {
            return section
        }

        if let sectionNumber = target.sectionNumber,
           let section = library.sectionSummary(sectionNumber: sectionNumber) {
            return section
        }

        if let sectionNumber = target.sectionNumber {
            let normalizedTarget = normalizedSectionNumber(sectionNumber)
            if let anchor = anchors.first(where: { normalizedSectionNumber($0.sectionNumber) == normalizedTarget }),
               let section = library.sectionSummary(sectionNumber: anchor.sectionNumber) {
                return section
            }
        }

        return nil
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

private struct ChapterHTMLJumpTarget: Identifiable, Hashable {
    let sectionNumber: String
    let title: String
    let anchorID: String?
    let level: Int

    var id: String {
        anchorID ?? sectionNumber
    }

    var menuLabel: String {
        if title.localizedCaseInsensitiveContains("Section BC \(sectionNumber)") {
            return title
        }
        return "Section BC \(sectionNumber): \(title)"
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
