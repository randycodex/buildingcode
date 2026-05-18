import SwiftUI

struct BrowseView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel

    private var accentColor: Color {
        Color(uiColor: library.readerTheme.accentColor)
    }

    var body: some View {
        NavigationStack {
            Group {
                if library.availableVersions.isEmpty {
                    CodeEmptyStateCard(
                        title: "No Code Content",
                        systemImage: "books.vertical",
                        description: library.statusMessage ?? "Bundle authored content or generated code data to begin browsing.",
                        accent: accentColor
                    )
                    .padding(20)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            CodeSectionHeader(
                                title: "Chapters",
                                subtitle: chapterSectionSummary,
                                accent: accentColor
                            )

                            if library.chapters.isEmpty {
                                CodeEmptyStateCard(
                                    title: "No Chapters",
                                    systemImage: "text.book.closed",
                                    description: "The selected code version does not have any chapters yet.",
                                    accent: accentColor
                                )
                            } else {
                                LazyVStack(spacing: 14) {
                                    ForEach(library.chapters) { chapter in
                                        if let initialSection = library.sections(for: chapter).first {
                                            NavigationLink {
                                                ChapterHTMLReaderView(
                                                    chapter: chapter,
                                                    initialSection: initialSection
                                                )
                                            } label: {
                                                chapterCard(for: chapter)
                                            }
                                            .buttonStyle(.plain)
                                        } else {
                                            chapterCard(for: chapter)
                                        }
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 16)
                        .padding(.bottom, 28)
                    }
                }
            }
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle("Browse")
        }
    }

    private func chapterCard(for chapter: CodeChapter) -> some View {
        let sectionCount = library.sectionCount(for: chapter)

        return CodeSurfaceCard(accent: accentColor) {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(chapter.displayLabel)
                        .font(.headline)
                        .foregroundStyle(.primary)
                    Text(chapter.title)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.leading)
                }

                Spacer(minLength: 0)

                VStack(alignment: .trailing, spacing: 8) {
                    Text("\(sectionCount)")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(accentColor)
                    Text(sectionCount == 1 ? "section" : "sections")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                }
            }

            HStack(spacing: 8) {
                Label("Open chapter", systemImage: "arrow.right.circle.fill")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(accentColor)
                Spacer(minLength: 0)
            }
        }
    }

    private var chapterSectionSummary: String {
        if library.chapters.isEmpty {
            return "No chapters are available in the current selection."
        }
        return "\(library.chapters.count) \(library.chapters.count == 1 ? "chapter" : "chapters") ready to browse."
    }
}

struct ChapterSectionsView: View {
    let chapter: CodeChapter
    @EnvironmentObject private var library: CodeLibraryViewModel

    private var accentColor: Color {
        Color(uiColor: library.readerTheme.accentColor)
    }

    var body: some View {
        let groups = library.sectionGroups(for: chapter)
        let sectionCount = groups.reduce(into: 0) { partialResult, group in
            partialResult += group.sections.count
        }

        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                CodeSurfaceCard(accent: accentColor) {
                    Text(chapter.displayLabel)
                        .font(.title3.weight(.semibold))
                    Text(chapter.title)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    HStack(spacing: 10) {
                        CodeStatPill(
                            value: "\(sectionCount)",
                            label: sectionCount == 1 ? "section" : "sections",
                            accent: accentColor
                        )
                        CodeStatPill(value: "\(groups.count)", label: groups.count == 1 ? "group" : "groups", accent: accentColor)
                    }
                }

                ForEach(groups) { group in
                    CodeSurfaceCard(accent: accentColor) {
                        CodeSectionHeader(
                            title: group.displayLabel,
                            subtitle: "\(group.sections.count) \(group.sections.count == 1 ? "section" : "sections")",
                            accent: accentColor
                        )

                        VStack(spacing: 0) {
                            ForEach(Array(group.sections.enumerated()), id: \.element.id) { index, section in
                                NavigationLink {
                                    ChapterHTMLReaderView(
                                        chapter: chapter,
                                        initialSection: section
                                    )
                                } label: {
                                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                                        VStack(alignment: .leading, spacing: 4) {
                                            if section.kind == .textBlock {
                                                Label("Text Block", systemImage: "text.alignleft")
                                                    .font(.caption.weight(.semibold))
                                                    .foregroundStyle(accentColor)
                                            } else {
                                                Text(section.sectionNumber)
                                                    .font(.subheadline.weight(.semibold))
                                                    .foregroundStyle(accentColor)
                                            }

                                            Text(section.displayTitle)
                                                .font(.subheadline.weight(.medium))
                                                .foregroundStyle(.primary)
                                            Text("Open inside the chapter reader")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }

                                        Spacer(minLength: 0)

                                        Image(systemName: "chevron.right")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(.tertiary)
                                    }
                                    .padding(.vertical, 14)
                                }
                                .buttonStyle(.plain)

                                if index < group.sections.count - 1 {
                                    Divider()
                                }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, 28)
        }
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .navigationTitle(chapter.displayLabel)
    }

}

struct CodeAppBackdrop: View {
    let accent: Color

    var body: some View {
        Color(uiColor: .systemBackground)
    }
}

struct CodeSurfaceCard<Content: View>: View {
    let accent: Color
    let content: Content

    init(accent: Color, @ViewBuilder content: () -> Content) {
        self.accent = accent
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            content
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color(uiColor: .systemBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(accent.opacity(0.10), lineWidth: 1)
        )
    }
}

struct CodeSectionHeader: View {
    let title: String
    let subtitle: String
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.headline)
                .foregroundStyle(.primary)
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct CodeStatPill: View {
    let value: String
    let label: String
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(accent)
                .lineLimit(1)
            Text(label)
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(accent.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct CodeMenuButton<MenuContent: View>: View {
    let title: String
    let value: String
    let systemImage: String
    let accent: Color
    let menuContent: MenuContent

    init(
        title: String,
        value: String,
        systemImage: String,
        accent: Color,
        @ViewBuilder menuContent: () -> MenuContent
    ) {
        self.title = title
        self.value = value
        self.systemImage = systemImage
        self.accent = accent
        self.menuContent = menuContent()
    }

    var body: some View {
        Menu {
            menuContent
        } label: {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .foregroundStyle(accent)
                    .frame(width: 20)

                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(value)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }

                Spacer(minLength: 0)

                Image(systemName: "chevron.down")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color(uiColor: .secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct CodeEmptyStateCard: View {
    let title: String
    let systemImage: String
    let description: String
    let accent: Color

    var body: some View {
        CodeSurfaceCard(accent: accent) {
            VStack(alignment: .leading, spacing: 12) {
                Image(systemName: systemImage)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(accent)
                Text(title)
                    .font(.title3.weight(.semibold))
                Text(description)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

#if DEBUG
#Preview("Browse") {
    BrowseView()
        .environmentObject(CodeLibraryViewModel())
}

#Preview("Chapter Sections") {
    NavigationStack {
        ChapterSectionsPreview()
    }
    .environmentObject(CodeLibraryViewModel())
}

private struct ChapterSectionsPreview: View {
    @EnvironmentObject private var library: CodeLibraryViewModel

    var body: some View {
        if let chapter = library.chapters.first {
            ChapterSectionsView(chapter: chapter)
        } else {
            CodeEmptyStateCard(
                title: "Loading Preview",
                systemImage: "text.book.closed",
                description: "The bundled code content is loading for the SwiftUI canvas.",
                accent: Color(uiColor: library.readerTheme.accentColor)
            )
            .padding(20)
        }
    }
}
#endif
