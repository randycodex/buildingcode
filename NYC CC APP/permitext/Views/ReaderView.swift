import SwiftUI
import UIKit

struct ReaderView: View {
    let sectionID: Int64

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var detail: ReaderSectionDetail?
    @State private var references: [ResolvedCodeReference] = []
    @State private var noteBody = ""
    @State private var isBookmarked = false
    @State private var expandedInlineImage: UIImage?
    @State private var noteSaveState: NoteSaveState = .idle
    @State private var noteSaveResetTask: Task<Void, Never>?
    @State private var sectionTags: [String] = []
    @State private var pendingCustomTag: String = ""
    @State private var isTagComposerOpen: Bool = false
    @State private var isFolderPickerOpen: Bool = false
    @State private var folderEditorTarget: ReaderFolderEditorTarget?
    @FocusState private var isNotesFieldFocused: Bool
    @FocusState private var isTagComposerFocused: Bool

    /// Same shape as BookmarksView.FolderEditorTarget but scoped to this view
    /// so the two states don't share an `Identifiable` collision.
    enum ReaderFolderEditorTarget: Identifiable {
        case new
        case edit(CodeFolder)

        var id: String {
            switch self {
            case .new: return "new"
            case .edit(let folder): return "edit-\(folder.id)"
            }
        }

        var folder: CodeFolder? {
            if case .edit(let f) = self { return f }
            return nil
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

                        CodeHairline().padding(.top, 2)
                        tagsEditor
                    }

                    notesEditor
                }
                .padding(.horizontal, CodeScreenMetrics.readerHorizontalPadding)
                .padding(.top, CodeScreenMetrics.topTitlePadding)
                .padding(.bottom, 28)
            } else {
                CodeEmptyStateCard(
                    title: "Loading Section",
                    systemImage: "doc.text.magnifyingglass",
                    description: "Preparing the selected code section.",
                    accent: accentColor
                )
                .padding(.horizontal, CodeScreenMetrics.readerHorizontalPadding)
                .padding(.top, 80)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            dismissKeyboard()
        }
        .overlay(alignment: .top) {
            CodeTopContentFade(alwaysVisible: true)
        }
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .navigationTitle(navigationTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                ShareLink(item: CodeLibraryViewModel.sharedSectionURL(sectionID: sectionID)) {
                    Image(systemName: "square.and.arrow.up")
                }
                .accessibilityLabel("Share section")

                Button {
                    toggleBookmark()
                } label: {
                    Image(systemName: isBookmarked ? "bookmark.fill" : "bookmark")
                }
                .accessibilityLabel(isBookmarked ? "Remove bookmark" : "Save bookmark")
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
        .task(id: sectionID) {
            await loadContent()
        }
        .onDisappear {
            noteSaveResetTask?.cancel()
        }
        .sheet(isPresented: $isFolderPickerOpen) {
            FolderPickerSheet(
                folders: library.folders,
                memberFolderIDs: Set(library.folderMembership[sectionID] ?? []),
                onToggle: { folder in
                    let memberIDs = Set(library.folderMembership[sectionID] ?? [])
                    if memberIDs.contains(folder.id) {
                        library.removeSection(sectionID, fromFolder: folder.id)
                    } else {
                        library.addSection(sectionID, toFolder: folder.id)
                    }
                },
                onCreateNew: {
                    // Close the picker first, then open the editor for a
                    // new folder. Presenting one sheet on top of another
                    // is unreliable in SwiftUI; this two-step keeps the
                    // animation clean.
                    isFolderPickerOpen = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                        folderEditorTarget = .new
                    }
                }
            )
        }
        .sheet(item: $folderEditorTarget) { target in
            FolderEditorSheet(
                existing: target.folder,
                onSave: { name, address, description, colorHex in
                    if let existing = target.folder {
                        library.updateFolder(existing, name: name, address: address, description: description, colorHex: colorHex)
                    } else {
                        // After creating a new folder from inside the Reader,
                        // assign the current section to it so the user
                        // doesn't have to reopen the picker.
                        if let newFolder = library.createFolder(name: name, address: address, description: description, colorHex: colorHex) {
                            library.addSection(sectionID, toFolder: newFolder.id)
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

    private var notesEditor: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 8) {
                Text("Notes")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)

                Spacer(minLength: 0)

                if noteSaveState != .idle {
                    Label(noteSaveState.title, systemImage: noteSaveState.systemImage)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                        .labelStyle(.titleAndIcon)
                        .accessibilityLabel(noteSaveState.accessibilityLabel)
                }
            }

            ZStack(alignment: .topLeading) {
                TextEditor(text: $noteBody)
                    .font(library.readerTheme.swiftUIFont())
                    .scrollContentBackground(.hidden)
                    .focused($isNotesFieldFocused)
                    .frame(minHeight: 104)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: CodeScreenMetrics.cardCornerRadius, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: CodeScreenMetrics.cardCornerRadius, style: .continuous)
                            .strokeBorder(Color(uiColor: .separator), lineWidth: 1)
                    )
                    .onChange(of: noteBody) { _, _ in
                        saveNote()
                    }

                if noteBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text("Add a note")
                        .font(library.readerTheme.swiftUIFont())
                        .foregroundStyle(.tertiary)
                        .padding(.horizontal, CodeScreenMetrics.cardPadding)
                        .padding(.vertical, 16)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    private var projectsEditor: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Projects")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)

            if library.hasProjectAccess {
                FolderMembershipRow(
                    memberFolders: library.folders(containing: sectionID),
                    onRemove: { folder in
                        library.removeSection(sectionID, fromFolder: folder.id)
                    },
                    onAdd: {
                        isFolderPickerOpen = true
                    }
                )
            } else {
                FolderMembershipRow(
                    memberFolders: [],
                    onRemove: { _ in },
                    onAdd: {
                        library.requireProjectAccess()
                    }
                )
            }
        }
    }

    private var tagsEditor: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 8) {
                Text("Tags")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer(minLength: 0)
                Button {
                    withAnimation(.easeInOut(duration: 0.18)) {
                        isTagComposerOpen.toggle()
                    }
                    if isTagComposerOpen {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            isTagComposerFocused = true
                        }
                    }
                } label: {
                    Label(isTagComposerOpen ? "Done" : "Add", systemImage: isTagComposerOpen ? "checkmark" : "plus")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(accentColor)
                }
                .buttonStyle(.plain)
            }

            // Tags applied to this section, shown as removable accent chips.
            if sectionTags.isEmpty {
                Text("No tags yet — tap Add to create one.")
                    .font(.footnote)
                    .foregroundStyle(.tertiary)
            } else {
                tagChipFlow(tags: sectionTags) { tag in
                    HStack(spacing: 4) {
                        Text(tag)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(accentColor)
                        Button {
                            removeTag(tag)
                        } label: {
                            Image(systemName: "xmark")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(accentColor.opacity(0.7))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(
                        Capsule(style: .continuous).fill(accentColor.opacity(0.12))
                    )
                }
            }

            if isTagComposerOpen {
                tagComposer
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    @ViewBuilder
    private var tagComposer: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Free-form input for custom tags. Commit with Return.
            HStack(spacing: 8) {
                Image(systemName: "tag")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                TextField("Add a custom tag", text: $pendingCustomTag)
                    .focused($isTagComposerFocused)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .submitLabel(.done)
                    .onSubmit { commitCustomTag() }
                if !pendingCustomTag.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Button("Add") { commitCustomTag() }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(accentColor)
                        .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: CodeScreenMetrics.cardCornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: CodeScreenMetrics.cardCornerRadius, style: .continuous)
                    .strokeBorder(Color(uiColor: .separator), lineWidth: 1)
            )
        }
    }

    /// Lightweight flowing chip layout: wraps to multiple lines without
    /// needing iOS 16+ Layout APIs. Uses a single HStack with
    /// fixedSize chips and wrapping enabled via a basic accumulator.
    @ViewBuilder
    private func tagChipFlow<ChipContent: View>(
        tags: [String],
        @ViewBuilder chip: @escaping (String) -> ChipContent
    ) -> some View {
        FlowLayout(spacing: 6) {
            ForEach(tags, id: \.self) { tag in
                chip(tag)
            }
        }
    }

    private func commitCustomTag() {
        let trimmed = pendingCustomTag.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        addTag(trimmed)
        pendingCustomTag = ""
    }

    private func addTag(_ tag: String) {
        let cleaned = tag.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { return }
        guard !sectionTags.contains(where: { $0.caseInsensitiveCompare(cleaned) == .orderedSame }) else { return }
        let updatedTags = sectionTags + [cleaned]
        if library.setTags(updatedTags, sectionID: sectionID) {
            sectionTags = updatedTags
        } else {
            sectionTags = library.tags(sectionID: sectionID)
        }
    }

    private func removeTag(_ tag: String) {
        let updatedTags = sectionTags.filter { $0.caseInsensitiveCompare(tag) != .orderedSame }
        if library.setTags(updatedTags, sectionID: sectionID) {
            sectionTags = updatedTags
        } else {
            sectionTags = library.tags(sectionID: sectionID)
        }
    }

    private func loadContent() async {
        let loadedDetail = await library.loadSectionDetailAsync(sectionID: sectionID)
        detail = loadedDetail
        if let loadedDetail {
            library.noteSectionOpened(loadedDetail)
            references = []
            references = await library.resolveReferencesAsync(for: loadedDetail)
        } else {
            references = []
        }
        isBookmarked = library.isBookmarked(sectionID: sectionID)
        noteBody = library.noteBody(sectionID: sectionID)
        sectionTags = library.tags(sectionID: sectionID)
        noteSaveState = .idle
    }

    private func toggleBookmark() {
        isBookmarked = library.toggleBookmark(sectionID: sectionID)
        // If the bookmark was removed, the tag rows were deleted from disk —
        // reflect that in the editor so the UI doesn't lie until next load.
        if !isBookmarked {
            sectionTags = []
            isTagComposerOpen = false
        }
    }

    private func saveNote() {
        library.saveNote(sectionID: sectionID, body: noteBody)
        noteSaveState = .saved

        noteSaveResetTask?.cancel()
        noteSaveResetTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
            noteSaveState = .idle
        }
    }

    private func dismissKeyboard() {
        isNotesFieldFocused = false
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }

    private enum NoteSaveState: Equatable {
        case idle
        case saved

        var title: String {
            switch self {
            case .idle:
                return ""
            case .saved:
                return "Saved"
            }
        }

        var systemImage: String {
            switch self {
            case .idle:
                return ""
            case .saved:
                return "checkmark.circle"
            }
        }

        var accessibilityLabel: String {
            switch self {
            case .idle:
                return ""
            case .saved:
                return "Note saved"
            }
        }
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

/// Minimal flow layout that wraps subviews onto multiple lines. Used by the
/// tag editor so any number of chips wraps cleanly without horizontal
/// scrolling. iOS 16+ Layout API — fine for this project.
struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var lineHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > maxWidth && x > 0 {
                x = 0
                y += lineHeight + spacing
                lineHeight = 0
            }
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
        return CGSize(width: maxWidth.isFinite ? maxWidth : x, height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var lineHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX && x > bounds.minX {
                x = bounds.minX
                y += lineHeight + spacing
                lineHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(size))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
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
