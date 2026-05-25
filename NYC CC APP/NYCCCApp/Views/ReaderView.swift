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
    @FocusState private var isNotesFieldFocused: Bool

    private var accentColor: Color {
        Color(uiColor: library.accentColor(for: detail?.codeSectionID))
    }

    var body: some View {
        ScrollView {
            if let detail {
                VStack(alignment: .leading, spacing: 16) {
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

                    notesEditor
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 28)
            } else {
                CodeEmptyStateCard(
                    title: "Loading Section",
                    systemImage: "doc.text.magnifyingglass",
                    description: "Preparing the selected code section.",
                    accent: accentColor
                )
                .padding(.horizontal, 20)
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
            ToolbarItem(placement: .topBarTrailing) {
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
                        .font(.title3.weight(.semibold))
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
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(accentColor)
                    Text(detail.displayTitle)
                        .font(.title3.weight(.semibold))
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
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .strokeBorder(Color(uiColor: .separator), lineWidth: 1)
                    )
                    .onChange(of: noteBody) { _, _ in
                        saveNote()
                    }

                if noteBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text("Add a note")
                        .font(library.readerTheme.swiftUIFont())
                        .foregroundStyle(.tertiary)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 16)
                        .allowsHitTesting(false)
                }
            }
        }
    }

    private func loadContent() async {
        let loadedDetail = await library.loadSectionDetailAsync(sectionID: sectionID)
        detail = loadedDetail
        if let loadedDetail {
            references = library.resolveReferences(for: loadedDetail)
        } else {
            references = []
        }
        isBookmarked = library.isBookmarked(sectionID: sectionID)
        noteBody = library.noteBody(sectionID: sectionID)
        noteSaveState = .idle
    }

    private func toggleBookmark() {
        isBookmarked = library.toggleBookmark(sectionID: sectionID)
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
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Color(uiColor: .separator), lineWidth: 1)
                    )
            } else {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
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
