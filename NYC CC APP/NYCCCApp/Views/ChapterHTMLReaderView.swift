import SwiftUI

struct ChapterHTMLReaderView: View {
    let chapter: CodeChapter
    let initialSection: CodeSectionSummary

    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.colorScheme) private var colorScheme

    @State private var targetAnchorID: String?
    @State private var selectedAnchor: PublishedHTMLAnchor?
    @State private var anchors: [PublishedHTMLAnchor] = []

    private var accentColor: Color {
        Color(uiColor: library.readerTheme.accentColor)
    }

    private var htmlStore: PublishedHTMLContentStore {
        PublishedHTMLContentStore(
            relativeRootPath: library.selectedVersion?.authoredHTMLBundlePath
        )
    }

    private var chapterURL: URL? {
        htmlStore.chapterURL(chapterNumber: chapter.chapterNumber)
    }

    private var readAccessURL: URL? {
        htmlStore.readAccessURL()
    }

    private var currentJumpLabel: String {
        if let selectedAnchor {
            return selectedAnchor.menuLabel
        }
        if let initialAnchor {
            return initialAnchor.menuLabel
        }
        return "Jump within chapter"
    }

    private var initialAnchor: PublishedHTMLAnchor? {
        anchors.first { normalizedSectionNumber($0.sectionNumber) == normalizedSectionNumber(initialSection.sectionNumber) }
    }

    var body: some View {
        Group {
            if let chapterURL, let readAccessURL {
                htmlReader(chapterURL: chapterURL, readAccessURL: readAccessURL)
            } else if library.selectedVersion?.contentKind == .authored {
                missingAuthoredContentView
            } else {
                ChapterReaderView(chapter: chapter, initialSectionID: initialSection.id)
            }
        }
        .navigationTitle(chapter.displayLabel)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if targetAnchorID == nil {
                let anchor = initialAnchor
                selectedAnchor = anchor
                targetAnchorID = anchor?.anchorID
            }
        }
        .task(id: chapter.id) {
            await loadAnchors()
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
        VStack(spacing: 0) {
            jumpBar
                .background(Color(uiColor: .systemBackground))

            ChapterHTMLWebView(
                chapterURL: chapterURL,
                readAccessURL: readAccessURL,
                targetAnchorID: targetAnchorID,
                readerTheme: library.readerTheme,
                colorScheme: colorScheme
            )
        }
        .background(Color(uiColor: .systemBackground).ignoresSafeArea())
    }

    private var jumpBar: some View {
        HStack(spacing: 12) {
            Menu {
                ForEach(anchors, id: \.anchorID) { anchor in
                    Button(anchor.menuLabel) {
                        selectedAnchor = anchor
                        targetAnchorID = anchor.anchorID
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    Text(currentJumpLabel)
                        .lineLimit(1)
                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.semibold))
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(accentColor)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color(uiColor: .secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            Button {
                if let firstAnchor = anchors.first {
                    selectedAnchor = firstAnchor
                    targetAnchorID = firstAnchor.anchorID
                }
            } label: {
                Image(systemName: "arrow.up.to.line")
                    .font(.headline)
            }
            .buttonStyle(.bordered)
            .tint(accentColor)
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 10)
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
}
