import SwiftUI
import UIKit

struct ReaderView: View {
    let sectionID: Int64

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var detail: ReaderSectionDetail?
    @State private var references: [ResolvedCodeReference] = []
    @State private var noteBody = ""
    @State private var noteJustSaved = false
    @State private var isBookmarked = false
    @State private var expandedInlineImage: UIImage?

    private var accentColor: Color {
        Color(uiColor: library.readerTheme.accentColor)
    }

    var body: some View {
        ScrollView {
            if let detail {
                VStack(alignment: .leading, spacing: 18) {
                    if let sectionGroupLabel = detail.sectionGroupLabel, !sectionGroupLabel.isEmpty {
                        Text(sectionGroupLabel)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(accentColor)
                    }

                    header(detail: detail)

                    ContentBlockListView(
                        detail: detail,
                        fallbackText: library.bodyNSText(for: detail),
                        onOpenImage: { expandedInlineImage = $0 }
                    )
                    .frame(maxWidth: .infinity, alignment: .leading)

                    if !references.isEmpty {
                        Divider()
                        ReferenceListSection(references: references, accent: accentColor)
                    }

                    if !detail.figures.isEmpty {
                        Divider()
                        FigureListSection(title: "Official Figures", figures: detail.figures)
                    }

                    if !detail.customDiagrams.isEmpty {
                        Divider()
                        FigureListSection(title: "Practice Diagrams", figures: detail.customDiagrams)
                    }

                    Divider()
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Notes")
                                .font(.headline)
                            Spacer()
                            if noteJustSaved {
                                Label("Saved", systemImage: "checkmark.circle.fill")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(accentColor)
                            }
                        }

                        TextEditor(text: $noteBody)
                            .frame(minHeight: 180)
                            .padding(10)
                            .background(Color(uiColor: .secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                        Button("Save Note") {
                            saveNote()
                        }
                        .buttonStyle(.borderedProminent)
                    }
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
    }

    @ViewBuilder
    private func header(detail: ReaderSectionDetail) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if detail.kind == .textBlock {
                Text(detail.displayTitle)
                    .font(.title2.weight(.semibold))
            } else {
                Text(detail.sectionNumber)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(accentColor)
                Text(detail.displayTitle)
                    .font(.title3.weight(.semibold))
            }
            if detail.kind != .textBlock {
                Text(detail.chapterTitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var navigationTitle: String {
        guard let detail else { return "Reader" }
        return detail.kind == .textBlock ? detail.displayTitle : detail.sectionNumber
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
        noteJustSaved = false
    }

    private func saveNote() {
        library.saveNote(sectionID: sectionID, body: noteBody)
        noteJustSaved = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
            noteJustSaved = false
        }
    }

    private func toggleBookmark() {
        library.toggleBookmark(sectionID: sectionID)
        isBookmarked.toggle()
    }

    private struct ReferenceListSection: View {
        let references: [ResolvedCodeReference]
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
                            ChapterSectionsView(chapter: chapter)
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
            .padding(12)
            .background(Color(uiColor: .secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
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
                            .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
                    )
            } else {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.secondary.opacity(0.12))
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
