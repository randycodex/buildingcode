import SwiftUI
import UIKit

struct ReaderView: View {
    let sectionID: Int64
    let codeVersion: String?
    let returnsToProjectsAfterRemoval: Bool

    init(
        sectionID: Int64,
        codeVersion: String? = nil,
        returnsToProjectsAfterRemoval: Bool = false
    ) {
        self.sectionID = sectionID
        self.codeVersion = codeVersion
        self.returnsToProjectsAfterRemoval = returnsToProjectsAfterRemoval
    }

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var detail: ReaderSectionDetail?
    @State private var loadState: SectionLoadState = .loading
    @State private var references: [ResolvedCodeReference] = []
    @State private var isBookmarked = false
    @State private var expandedInlineImage: UIImage?
    @State private var isFolderPickerOpen: Bool = false
    @State private var pendingFolderIDs: Set<Int64> = []
    @State private var pendingFinalFolderRemoval: CodeFolder?
    @State private var folderEditorTarget: ReaderFolderEditorTarget?
    @State private var showsSavedFollowUp = false

    /// Same shape as BookmarksView.FolderEditorTarget but scoped to this view
    /// so the two states don't share an `Identifiable` collision.
    enum ReaderFolderEditorTarget: Identifiable {
        case new(CodeFolderType)
        case edit(CodeFolder)

        var id: String {
            switch self {
            case .new(let folderType): return "new-\(folderType.rawValue)"
            case .edit(let folder): return "edit-\(folder.id)"
            }
        }

        var folder: CodeFolder? {
            if case .edit(let f) = self { return f }
            return nil
        }

        var folderType: CodeFolderType {
            switch self {
            case .new(let folderType): return folderType
            case .edit(let folder): return folder.folderType
            }
        }
    }

    private var accentColor: Color {
        Color(uiColor: library.accentColor(for: detail?.codeSectionID))
    }

    var body: some View {
        ScrollView {
            if let detail {
                VStack(alignment: .leading, spacing: CodeScreenMetrics.contentSpacingBelowTitle) {
                    if !library.codeSections.isEmpty {
                        CodeEyebrow(text: library.codeSectionName(id: detail.codeSectionID), accent: accentColor)
                    }

                    if let sectionGroupLabel = detail.sectionGroupLabel, !sectionGroupLabel.isEmpty {
                        CodeEyebrow(text: sectionGroupLabel, accent: accentColor)
                    }

                    header(detail: detail)

                    ContentBlockListView(
                        detail: detail,
                        fallbackText: library.bodyNSText(for: detail),
                        onOpenImage: { expandedInlineImage = $0 }
                    )
                    .frame(maxWidth: .infinity, alignment: .leading)

                    if !references.isEmpty {
                        CodeHairline().padding(.top, 2)
                        ReferenceListSection(
                            references: references,
                            sourceCodeSectionID: detail.codeSectionID,
                            accent: accentColor
                        )
                    }

                    if !detail.figures.isEmpty {
                        CodeHairline().padding(.top, 2)
                        FigureListSection(title: "Official Figures", figures: detail.figures)
                    }

                    if !detail.customDiagrams.isEmpty {
                        CodeHairline().padding(.top, 2)
                        FigureListSection(title: "Practice Diagrams", figures: detail.customDiagrams)
                    }

                    if isBookmarked {
                        CodeHairline().padding(.top, 2)
                        projectsEditor
                    }
                }
                .padding(.horizontal, CodeScreenMetrics.readerHorizontalPadding)
                .padding(.top, CodeScreenMetrics.topTitlePadding)
                .padding(.bottom, 28)
            } else {
                sectionLoadState
            }
        }
        .overlay(alignment: .top) {
            CodeTopContentFade(alwaysVisible: true)
        }
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .navigationTitle(navigationTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    if isBookmarked {
                        removeBookmarkAndFolderLinks()
                    } else {
                        saveBookmarkImmediately()
                    }
                } label: {
                    Image(systemName: isBookmarked ? "bookmark.fill" : "bookmark")
                }
                .accessibilityLabel(isBookmarked ? "Remove from Saved" : "Save passage")
            }
        }
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
        .task(id: "\(codeVersion ?? "selected"):\(sectionID)") {
            if let codeVersion,
               await library.prepareCodeVersionForEvidence(codeVersion) == false {
                loadState = .missing
                return
            }
            await loadContent()
        }
        .onChange(of: library.bookmarkRevision) { _, _ in
            syncUserContentState()
        }
        .sheet(isPresented: $isFolderPickerOpen) {
            FolderPickerSheet(
                folders: library.folders,
                memberFolderIDs: Set(library.folderMembership[sectionID] ?? []),
                selectedFolderIDs: $pendingFolderIDs,
                canUseProjects: library.hasProjectAccess,
                onSave: { folderIDs in
                    if isBookmarked {
                        if library.replaceFolderMembership(sectionID: sectionID, folderIDs: folderIDs) {
                            UINotificationFeedbackGenerator().notificationOccurred(.success)
                        }
                    } else {
                        // Compatibility fallback for a stale presentation: the
                        // bookmark itself is still created immediately.
                        isBookmarked = library.toggleBookmark(sectionID: sectionID)
                        if isBookmarked,
                           library.replaceFolderMembership(sectionID: sectionID, folderIDs: folderIDs) {
                            UINotificationFeedbackGenerator().notificationOccurred(.success)
                        }
                    }
                },
                onCreateNew: { folderType in
                    // Close the picker first, then open the editor for a
                    // new folder. Presenting one sheet on top of another
                    // is unreliable in SwiftUI; this two-step keeps the
                    // animation clean.
                    isFolderPickerOpen = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                        folderEditorTarget = .new(folderType)
                    }
                },
                onRequireProjectAccess: {
                    library.requireProjectAccess()
                }
            )
        }
        .sheet(item: $folderEditorTarget) { target in
            FolderEditorSheet(
                existing: target.folder,
                defaultFolderType: target.folderType,
                onSave: { name, address, description, colorHex, folderType in
                    if let existing = target.folder {
                        library.updateFolder(existing, name: name, address: address, description: description, colorHex: colorHex)
                    } else {
                        // Creating a destination does not save the section.
                        // Stage it, then return to the picker for confirmation.
                        if let newFolder = library.createFolder(
                            name: name,
                            address: address,
                            description: description,
                            colorHex: colorHex,
                            folderType: folderType
                        ) {
                            pendingFolderIDs.insert(newFolder.id)
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                                isFolderPickerOpen = true
                            }
                        }
                    }
                },
                onDelete: {
                    if let existing = target.folder {
                        library.deleteFolder(id: existing.id)
                    }
                }
            )
        }
        .confirmationDialog(
            "Remove the last folder?",
            isPresented: Binding(
                get: { pendingFinalFolderRemoval != nil },
                set: { if !$0 { pendingFinalFolderRemoval = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Remove from Saved", role: .destructive) {
                removeBookmarkAndFolderLinks()
                pendingFinalFolderRemoval = nil
            }
            Button("Choose another folder") {
                pendingFinalFolderRemoval = nil
                openFolderPicker()
            }
            Button("Cancel", role: .cancel) {
                pendingFinalFolderRemoval = nil
            }
        } message: {
            Text("Every saved section needs a folder. Removing this final destination will delete the saved record. You can choose another folder instead.")
        }
        .alert(
            "Section saved",
            isPresented: $showsSavedFollowUp
        ) {
            Button("Add to Project") {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                    openFolderPicker()
                }
            }
            Button("Done", role: .cancel) { }
        } message: {
            Text("The section is saved now. Project assignment is optional and can be added next.")
        }
    }

    @ViewBuilder
    private func header(detail: ReaderSectionDetail) -> some View {
        if let chapter = chapterForJump(detail: detail) {
            NavigationLink {
                ChapterHTMLReaderView(
                    chapter: chapter,
                    initialSection: CodeSectionSummary(
                        id: detail.id,
                        chapterNumber: detail.chapterNumber,
                        sectionNumber: detail.sectionNumber,
                        title: detail.title,
                        kind: detail.kind
                    )
                )
            } label: {
                headerContent(detail: detail, jumpAffordance: true)
            }
            .buttonStyle(.plain)
        } else {
            headerContent(detail: detail, jumpAffordance: false)
        }
    }

    @ViewBuilder
    private func headerContent(detail: ReaderSectionDetail, jumpAffordance: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if detail.kind == .textBlock {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(detail.displayTitle)
                        .font(CodeTypography.codeSectionTitle)
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.leading)
                    if jumpAffordance {
                        Image(systemName: "arrow.up.right.square")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                }
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(detail.sectionNumber)
                        .font(CodeTypography.codeSectionTitle)
                        .foregroundStyle(accentColor)
                    Text(detail.displayTitle)
                        .font(CodeTypography.codeSectionTitle)
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.leading)
                    if jumpAffordance {
                        Image(systemName: "arrow.up.right.square")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                }
            }
            if detail.kind != .textBlock {
                Text(detail.chapterTitle)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    private func chapterForJump(detail: ReaderSectionDetail) -> CodeChapter? {
        // Search across ALL chapters (not just the currently-selected code
        // section) so tap-to-jump works for any saved bookmark regardless of
        // which code section is active in Settings. Match on chapter number
        // AND code section ID, because chapter "9" exists in several code
        // sections (Building, Mechanical, Plumbing, etc.) and we need to
        // land in the one that matches the bookmark.
        let allChapters = library.chapters(for: nil)

        if let scoped = allChapters.first(where: { chapter in
            chapter.codeSectionID == detail.codeSectionID
                && chapter.chapterNumber.caseInsensitiveCompare(detail.chapterNumber) == .orderedSame
        }) {
            return scoped
        }

        // Fallback: section had no codeSectionID (rare for authored content)
        // — match by chapter number alone.
        return allChapters.first {
            $0.chapterNumber.caseInsensitiveCompare(detail.chapterNumber) == .orderedSame
        }
    }

    private var navigationTitle: String {
        guard let detail else { return "Reader" }
        return detail.kind == .textBlock ? detail.displayTitle : detail.sectionNumber
    }

    private var projectsEditor: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Folders")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)

            FolderMembershipRow(
                memberFolders: library.folders(containing: sectionID),
                onRemove: { folder in
                    let memberFolderIDs = Set(library.folderMembership[sectionID] ?? [])
                    if memberFolderIDs.count <= 1 {
                        pendingFinalFolderRemoval = folder
                    } else {
                        library.removeSection(sectionID, fromFolder: folder.id)
                    }
                },
                onAdd: openFolderPicker
            )
        }
    }

    private func loadContent() async {
        loadState = .loading
        detail = nil
        references = []
        switch await library.loadSectionDetailResultAsync(sectionID: sectionID) {
        case .loaded(let loadedDetail):
            detail = loadedDetail
            loadState = .loaded
            library.noteSectionOpened(loadedDetail)
            references = await library.resolveReferencesAsync(for: loadedDetail)
        case .missing:
            loadState = .missing
        case .failed(let message):
            loadState = .failed(message)
        }
        isBookmarked = library.isBookmarked(sectionID: sectionID)
    }

    private func syncUserContentState() {
        isBookmarked = library.isBookmarked(sectionID: sectionID)
        if !isFolderPickerOpen {
            pendingFolderIDs = Set(library.folderMembership[sectionID] ?? [])
        }
    }

    private func openFolderPicker() {
        pendingFolderIDs = Set(library.folderMembership[sectionID] ?? [])
        isFolderPickerOpen = true
    }

    private func saveBookmarkImmediately() {
        guard !isBookmarked else { return }
        isBookmarked = library.toggleBookmark(sectionID: sectionID)
        guard isBookmarked else { return }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        showsSavedFollowUp = true
    }

    private func removeBookmarkAndFolderLinks() {
        guard isBookmarked else { return }
        isBookmarked = library.toggleBookmark(sectionID: sectionID)
        if !isBookmarked {
            pendingFolderIDs = []
            if returnsToProjectsAfterRemoval {
                dismiss()
            }
        }
    }

    @ViewBuilder
    private var sectionLoadState: some View {
        VStack(spacing: 14) {
            switch loadState {
            case .loading:
                ProgressView()
                    .tint(accentColor)
                CodeEmptyStateCard(
                    title: "Loading Section",
                    systemImage: "doc.text.magnifyingglass",
                    description: "Preparing the selected code section.",
                    accent: accentColor
                )
            case .missing:
                CodeEmptyStateCard(
                    title: "Section Unavailable",
                    systemImage: "doc.text.magnifyingglass",
                    description: "This link does not match a section in the selected code library.",
                    accent: accentColor
                )
                sectionRecoveryActions
            case .failed(let message):
                CodeEmptyStateCard(
                    title: "Couldn’t Load Section",
                    systemImage: "exclamationmark.triangle",
                    description: message,
                    accent: accentColor
                )
                sectionRecoveryActions
            case .loaded:
                EmptyView()
            }
        }
        .padding(.horizontal, CodeScreenMetrics.readerHorizontalPadding)
        .padding(.top, 80)
    }

    private var sectionRecoveryActions: some View {
        HStack(spacing: 12) {
            Button("Retry") {
                Task { await loadContent() }
            }
            .buttonStyle(.borderedProminent)
            .tint(accentColor)

            Button("Browse Codes") {
                library.selectedTab = .browse
            }
            .buttonStyle(.bordered)
        }
    }

    private enum SectionLoadState: Equatable {
        case loading
        case loaded
        case missing
        case failed(String)
    }

    private struct ReferenceListSection: View {
        let references: [ResolvedCodeReference]
        let sourceCodeSectionID: Int64?
        let accent: Color

        var body: some View {
            VStack(alignment: .leading, spacing: 12) {
                Text("References")
                    .font(.headline)

                ForEach(references) { reference in
                    switch reference.destination {
                    case .section(let section):
                        NavigationLink {
                            ReaderView(sectionID: section.id)
                        } label: {
                            ReferenceRow(reference: reference, accent: accent)
                        }
                        .buttonStyle(.plain)
                    case .chapter(let chapter):
                        NavigationLink {
                            ReferenceChapterDestination(chapter: chapter)
                        } label: {
                            ReferenceRow(reference: reference, accent: accent)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private struct ReferenceRow: View {
        let reference: ResolvedCodeReference
        let accent: Color

        var body: some View {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: iconName)
                    .foregroundStyle(accent)
                    .frame(width: 20)
                VStack(alignment: .leading, spacing: 3) {
                    Text(reference.label)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text(reference.subtitle)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(.vertical, 10)
        }

        private var iconName: String {
            switch reference.kind {
            case .section:
                return "doc.text"
            case .chapter:
                return "books.vertical"
            case .appendix:
                return "paperclip"
            }
        }
    }

    private struct FigureListSection: View {
        let title: String
        let figures: [CodeFigure]

        var body: some View {
            VStack(alignment: .leading, spacing: 12) {
                Text(title)
                    .font(.headline)
                LazyVStack(alignment: .leading, spacing: 10) {
                    ForEach(figures) { figure in
                        VStack(alignment: .leading, spacing: 10) {
                            FigureImageView(fileName: figure.fileName)

                            Text(figure.titleText)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    private struct ReferenceChapterDestination: View {
        let chapter: CodeChapter

        @EnvironmentObject private var library: CodeLibraryViewModel
        @State private var initialSection: CodeSectionSummary?

        private var accentColor: Color {
            Color(uiColor: library.accentColor(for: chapter.codeSectionID))
        }

        var body: some View {
            Group {
                if let initialSection = initialSection ?? library.firstSection(for: chapter) {
                    ChapterHTMLReaderView(
                        chapter: chapter,
                        initialSection: initialSection
                    )
                } else {
                    VStack(spacing: 12) {
                        ProgressView()
                        Text("Opening \(chapter.displayLabel)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
                    .task(id: chapter.id) {
                        if let cached = library.firstSection(for: chapter) {
                            initialSection = cached
                        } else {
                            initialSection = await library.firstSectionAsync(for: chapter)
                        }
                    }
                }
            }
            .navigationTitle(chapter.displayLabel)
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private struct FigureImageView: View {
    let fileName: String

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: CodeScreenMetrics.cardCornerRadius, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: CodeScreenMetrics.cardCornerRadius, style: .continuous)
                            .stroke(Color(uiColor: .separator), lineWidth: 1)
                    )
            } else {
                RoundedRectangle(cornerRadius: CodeScreenMetrics.cardCornerRadius, style: .continuous)
                    .fill(Color(uiColor: .secondarySystemGroupedBackground))
                    .frame(height: 180)
                    .overlay {
                        Label("Image missing from bundle", systemImage: "photo")
                            .foregroundStyle(.secondary)
                    }
            }
        }
        .task(id: fileName) {
            guard let url = library.imageURL(fileName: fileName) else {
                image = nil
                return
            }
            image = UIImage(contentsOfFile: url.path)
        }
    }
}

#if DEBUG
#Preview("Reader") {
    NavigationStack {
        ReaderView(sectionID: 1)
    }
    .environmentObject(CodeLibraryViewModel.preview())
    .preferredColorScheme(.light)
}
#endif
