import SwiftUI
import UIKit

struct ReaderView: View {
    let sectionID: Int64
    let codeVersion: String?

    init(sectionID: Int64, codeVersion: String? = nil) {
        self.sectionID = sectionID
        self.codeVersion = codeVersion
    }

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var detail: ReaderSectionDetail?
    @State private var loadState: SectionLoadState = .loading
    @State private var references: [ResolvedCodeReference] = []
    @State private var noteBody = ""
    @State private var persistedNoteBody = ""
    @State private var isRestoringRejectedNoteChange = false
    @State private var isBookmarked = false
    @State private var expandedInlineImage: UIImage?
    @State private var noteSaveState: NoteSaveState = .idle
    @State private var noteSaveResetTask: Task<Void, Never>?
    @State private var sectionTags: [String] = []
    @State private var pendingCustomTag: String = ""
    @State private var isTagComposerOpen: Bool = false
    @State private var isFolderPickerOpen: Bool = false
    @State private var pendingFolderIDs: Set<Int64> = []
    @State private var pendingFinalFolderRemoval: CodeFolder?
    @State private var showsBookmarkRemovalConfirmation = false
    @State private var folderEditorTarget: ReaderFolderEditorTarget?
    @FocusState private var isNotesFieldFocused: Bool
    @FocusState private var isTagComposerFocused: Bool

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

                        CodeHairline().padding(.top, 2)
                        tagsEditor
                    }

                    notesEditor
                }
                .padding(.horizontal, CodeScreenMetrics.readerHorizontalPadding)
                .padding(.top, CodeScreenMetrics.topTitlePadding)
                .padding(.bottom, 28)
            } else {
                sectionLoadState
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
                Button {
                    if isBookmarked {
                        showsBookmarkRemovalConfirmation = true
                    } else {
                        openFolderPicker()
                    }
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
        .task(id: "\(codeVersion ?? "selected"):\(sectionID)") {
            if let codeVersion,
               await library.prepareCodeVersionForEvidence(codeVersion) == false {
                loadState = .missing
                return
            }
            await loadContent()
        }
        .onDisappear {
            noteSaveResetTask?.cancel()
        }
        .sheet(isPresented: $isFolderPickerOpen) {
            FolderPickerSheet(
                folders: library.folders,
                memberFolderIDs: Set(library.folderMembership[sectionID] ?? []),
                selectedFolderIDs: $pendingFolderIDs,
                canUseProjects: library.hasProjectAccess,
                onSave: { folderIDs in
                    if isBookmarked {
                        _ = library.replaceFolderMembership(sectionID: sectionID, folderIDs: folderIDs)
                    } else {
                        isBookmarked = library.saveSection(sectionID: sectionID, toFolderIDs: folderIDs)
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
            "Remove saved section?",
            isPresented: $showsBookmarkRemovalConfirmation,
            titleVisibility: .visible
        ) {
            Button("Remove from Saved", role: .destructive) {
                removeBookmarkAndFolderLinks()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("This removes the section from every folder and deletes its saved record. Notes remain available in the Reader.")
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
                        guard !isRestoringRejectedNoteChange else {
                            isRestoringRejectedNoteChange = false
                            return
                        }
                        saveNote(noteBody)
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

            if case .failed(let message) = noteSaveState {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.orange)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityLabel("Note not saved. \(message)")
            }
        }
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

    private var tagsEditor: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 8) {
                Text("Tags")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer(minLength: 0)
                if library.hasTagAccess {
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
                } else {
                    Label("Pro", systemImage: "lock.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }

            if sectionTags.isEmpty {
                Text(
                    library.hasTagAccess
                        ? "No tags yet — tap Add to create one."
                        : "Adding and editing tags is available with Pro."
                )
                    .font(.footnote)
                    .foregroundStyle(.tertiary)
            } else {
                tagChipFlow(tags: sectionTags) { tag in
                    HStack(spacing: 4) {
                        Text(tag)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(accentColor)
                        if library.hasTagAccess {
                            Button {
                                removeTag(tag)
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(accentColor.opacity(0.7))
                            }
                            .buttonStyle(.plain)
                        }
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
            } else if !library.hasTagAccess {
                Button {
                    library.requireTagAccess()
                } label: {
                    Label("Upgrade to Add Tags", systemImage: "sparkles")
                        .font(.footnote.weight(.semibold))
                }
                .buttonStyle(.plain)
                .foregroundStyle(accentColor)
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
        persistedNoteBody = library.noteBody(sectionID: sectionID)
        noteBody = persistedNoteBody
        sectionTags = library.tags(sectionID: sectionID)
        noteSaveState = .idle
    }

    private func openFolderPicker() {
        pendingFolderIDs = Set(library.folderMembership[sectionID] ?? [])
        isFolderPickerOpen = true
    }

    private func removeBookmarkAndFolderLinks() {
        guard isBookmarked else { return }
        isBookmarked = library.toggleBookmark(sectionID: sectionID)
        if !isBookmarked {
            sectionTags = []
            isTagComposerOpen = false
            pendingFolderIDs = []
        }
    }

    private func saveNote(_ proposedBody: String) {
        switch library.saveNote(sectionID: sectionID, body: proposedBody) {
        case .saved:
            persistedNoteBody = proposedBody
            noteSaveState = .saved
        case .failed(let persistedBody, let message):
            persistedNoteBody = persistedBody
            if noteBody != persistedBody {
                isRestoringRejectedNoteChange = true
                noteBody = persistedBody
            }
            noteSaveState = .failed(message)
        }

        noteSaveResetTask?.cancel()
        noteSaveResetTask = Task { @MainActor in
            try? await Task.sleep(for: noteSaveState == .saved ? .seconds(2) : .seconds(5))
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
        case failed(String)

        var title: String {
            switch self {
            case .idle:
                return ""
            case .saved:
                return "Saved"
            case .failed:
                return "Not Saved"
            }
        }

        var systemImage: String {
            switch self {
            case .idle:
                return ""
            case .saved:
                return "checkmark.circle"
            case .failed:
                return "exclamationmark.triangle"
            }
        }

        var accessibilityLabel: String {
            switch self {
            case .idle:
                return ""
            case .saved:
                return "Note saved"
            case .failed:
                return "Note not saved"
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
