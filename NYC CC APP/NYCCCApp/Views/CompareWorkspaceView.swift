import SwiftUI

struct CompareWorkspaceView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel

    private let initialPrimaryTarget: CompareLaunchTarget?
    private let initialReferenceTarget: CompareLaunchTarget?
    @State private var primarySelection = ComparePaneSelection()
    @State private var secondarySelection = ComparePaneSelection()
    @State private var seededDefaults = false

    private let stackedLayoutThreshold: CGFloat = 940

    init(
        primaryTarget: CompareLaunchTarget? = nil,
        referenceTarget: CompareLaunchTarget? = nil
    ) {
        self.initialPrimaryTarget = primaryTarget
        self.initialReferenceTarget = referenceTarget
    }

    var body: some View {
        GeometryReader { proxy in
            let usesStackedLayout = proxy.size.width < stackedLayoutThreshold
            let paneHeight = max(proxy.size.height - 64, 520)

            Group {
                if usesStackedLayout {
                    ScrollView {
                        VStack(spacing: 14) {
                            comparePaneCard(
                                title: "Primary",
                                subtitle: "Main chapter",
                                selection: $primarySelection,
                                readerHeight: min(max(proxy.size.height * 0.42, 260), 380)
                            )

                            comparePaneCard(
                                title: "Reference",
                                subtitle: "Pinned chapter",
                                selection: $secondarySelection,
                                readerHeight: min(max(proxy.size.height * 0.42, 260), 380)
                            )
                        }
                        .padding(16)
                        .padding(.bottom, 120)
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                } else {
                    HStack(alignment: .top, spacing: 14) {
                        comparePaneCard(
                            title: "Primary",
                            subtitle: "Main chapter",
                            selection: $primarySelection,
                            readerHeight: paneHeight
                        )

                        comparePaneCard(
                            title: "Reference",
                            subtitle: "Pinned chapter",
                            selection: $secondarySelection,
                            readerHeight: paneHeight
                        )
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
            }
        }
        .overlay(alignment: .top) {
            CodeTopContentFade(alwaysVisible: true)
        }
        .background(Color(uiColor: .systemGroupedBackground).ignoresSafeArea())
        .navigationTitle("Compare")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: library.chapters.map(\.id)) {
            seedDefaultsIfNeeded()
        }
    }

    private func comparePaneCard(
        title: String,
        subtitle: String,
        selection: Binding<ComparePaneSelection>,
        readerHeight: CGFloat
    ) -> some View {
        let accent = Color(uiColor: library.accentColor(for: selection.wrappedValue.codeSectionID))

        return VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(.primary)

                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            ComparePaneControls(
                selection: selection,
                accent: accent
            )

            ComparePaneReader(selection: selection)
                .frame(maxWidth: .infinity, minHeight: readerHeight, maxHeight: readerHeight, alignment: .topLeading)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(Color(uiColor: .separator).opacity(0.65), lineWidth: 1)
        )
    }

    private func seedDefaultsIfNeeded() {
        guard !seededDefaults, !library.chapters.isEmpty else { return }
        seededDefaults = true

        let preferredCodeSectionID = initialPrimaryTarget?.codeSectionID
            ?? initialReferenceTarget?.codeSectionID
            ?? library.selectedCodeSectionID
            ?? library.chapters.first?.codeSectionID
        primarySelection = selection(for: initialPrimaryTarget)
            ?? buildSelection(codeSectionID: preferredCodeSectionID, preferredChapterID: nil)

        if let referenceSelection = selection(for: initialReferenceTarget) {
            secondarySelection = referenceSelection
            return
        }

        let siblingChapters = chapters(for: preferredCodeSectionID)
        if let alternateChapter = siblingChapters.first(where: { $0.id != primarySelection.chapterID }) {
            secondarySelection = buildSelection(
                codeSectionID: alternateChapter.codeSectionID,
                preferredChapterID: alternateChapter.id
            )
            return
        }

        if let alternateSectionID = library.codeSections
            .map(\.id)
            .first(where: { $0 != primarySelection.codeSectionID }),
           let alternateChapter = chapters(for: alternateSectionID).first {
            secondarySelection = buildSelection(
                codeSectionID: alternateSectionID,
                preferredChapterID: alternateChapter.id
            )
            return
        }

        secondarySelection = buildSelection(
            codeSectionID: preferredCodeSectionID,
            preferredChapterID: primarySelection.chapterID
        )
    }

    private func buildSelection(
        codeSectionID: Int64?,
        preferredChapterID: Int64?
    ) -> ComparePaneSelection {
        let availableChapters = chapters(for: codeSectionID)
        let chapter = availableChapters.first(where: { $0.id == preferredChapterID }) ?? availableChapters.first
        let section = chapter.flatMap { sectionChoices(for: $0).first }

        return ComparePaneSelection(
            codeSectionID: chapter?.codeSectionID ?? codeSectionID,
            chapterID: chapter?.id,
            sectionID: section?.id
        )
    }

    private func chapters(for codeSectionID: Int64?) -> [CodeChapter] {
        if let codeSectionID {
            let filtered = library.chapters.filter { $0.codeSectionID == codeSectionID }
            if !filtered.isEmpty {
                return filtered
            }
        }
        return library.chapters
    }

    private func sectionChoices(for chapter: CodeChapter) -> [CodeSectionSummary] {
        let groupedSections = library.sectionGroups(for: chapter).flatMap(\.sections)
        if !groupedSections.isEmpty {
            return groupedSections
        }
        return library.sections(for: chapter)
    }

    private func selection(for target: CompareLaunchTarget?) -> ComparePaneSelection? {
        guard let target,
              let chapter = chapter(for: target)
        else {
            return nil
        }

        let sections = sectionChoices(for: chapter)
        let section = target.sectionID.flatMap { sectionID in
            sections.first(where: { $0.id == sectionID })
        } ?? sections.first

        return ComparePaneSelection(
            codeSectionID: chapter.codeSectionID ?? target.codeSectionID,
            chapterID: chapter.id,
            sectionID: section?.id
        )
    }

    private func chapter(for target: CompareLaunchTarget) -> CodeChapter? {
        if let chapterID = target.chapterID,
           let chapter = library.chapters.first(where: { $0.id == chapterID }) {
            return chapter
        }

        if let codeSectionID = target.codeSectionID,
           let chapter = library.chapters.first(where: {
               $0.codeSectionID == codeSectionID
                   && $0.chapterNumber.caseInsensitiveCompare(target.chapterNumber) == .orderedSame
           }) {
            return chapter
        }

        return library.chapters.first {
            $0.chapterNumber.caseInsensitiveCompare(target.chapterNumber) == .orderedSame
        }
    }
}

struct CompareLaunchTarget: Hashable {
    let codeSectionID: Int64?
    let chapterID: Int64?
    let chapterNumber: String
    let sectionID: Int64?

    init(
        codeSectionID: Int64?,
        chapterID: Int64? = nil,
        chapterNumber: String,
        sectionID: Int64? = nil
    ) {
        self.codeSectionID = codeSectionID
        self.chapterID = chapterID
        self.chapterNumber = chapterNumber
        self.sectionID = sectionID
    }
}

private struct ComparePaneControls: View {
    @EnvironmentObject private var library: CodeLibraryViewModel

    @Binding var selection: ComparePaneSelection
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !library.codeSections.isEmpty {
                compareMenu(
                    title: "Code Section",
                    value: codeSectionLabel,
                    accent: accent
                ) {
                    ForEach(library.codeSections) { codeSection in
                        Button {
                            updateCodeSection(codeSection.id)
                        } label: {
                            labelRow(
                                title: CodeLibraryViewModel.displayName(forCodeSectionName: codeSection.name),
                                isSelected: selection.codeSectionID == codeSection.id
                            )
                        }
                    }
                }
            }

            compareMenu(
                title: "Chapter",
                value: chapterLabel,
                accent: accent
            ) {
                ForEach(availableChapters) { chapter in
                    Button {
                        updateChapter(chapter.id)
                    } label: {
                        labelRow(
                            title: "\(chapter.displayLabel) - \(chapter.title)",
                            isSelected: selection.chapterID == chapter.id
                        )
                    }
                }
            }

            if let chapter = selectedChapter, !availableSections.isEmpty {
                compareMenu(
                    title: "Start At",
                    value: sectionLabel(for: chapter),
                    accent: accent
                ) {
                    ForEach(availableSections) { section in
                        Button {
                            updateSection(section.id)
                        } label: {
                            labelRow(
                                title: section.displayLabel,
                                isSelected: selection.sectionID == section.id
                            )
                        }
                    }
                }
            }
        }
    }

    private var selectedChapter: CodeChapter? {
        availableChapters.first(where: { $0.id == selection.chapterID }) ?? availableChapters.first
    }

    private var availableChapters: [CodeChapter] {
        if let codeSectionID = selection.codeSectionID {
            let filtered = library.chapters.filter { $0.codeSectionID == codeSectionID }
            if !filtered.isEmpty {
                return filtered
            }
        }
        return library.chapters
    }

    private var availableSections: [CodeSectionSummary] {
        guard let chapter = selectedChapter else { return [] }
        let groupedSections = library.sectionGroups(for: chapter).flatMap(\.sections)
        if !groupedSections.isEmpty {
            return groupedSections
        }
        return library.sections(for: chapter)
    }

    private var codeSectionLabel: String {
        library.codeSectionName(id: selection.codeSectionID)
    }

    private var chapterLabel: String {
        guard let chapter = selectedChapter else { return "Select Chapter" }
        return "\(chapter.displayLabel) - \(chapter.title)"
    }

    private func sectionLabel(for chapter: CodeChapter) -> String {
        guard let section = availableSections.first(where: { $0.id == selection.sectionID }) ?? availableSections.first else {
            return "Select Start Section"
        }
        if section.kind == .textBlock {
            return section.displayTitle
        }
        return "\(chapter.displayLabel) - \(section.sectionNumber)"
    }

    private func updateCodeSection(_ codeSectionID: Int64?) {
        let chapters = library.chapters.filter { codeSectionID == nil || $0.codeSectionID == codeSectionID }
        let chapter = chapters.first
        let section = chapter.flatMap { firstSection(for: $0) }
        selection = ComparePaneSelection(
            codeSectionID: codeSectionID,
            chapterID: chapter?.id,
            sectionID: section?.id
        )
    }

    private func updateChapter(_ chapterID: Int64) {
        guard let chapter = availableChapters.first(where: { $0.id == chapterID }) else { return }
        let section = firstSection(for: chapter)
        selection = ComparePaneSelection(
            codeSectionID: chapter.codeSectionID,
            chapterID: chapter.id,
            sectionID: section?.id
        )
    }

    private func updateSection(_ sectionID: Int64) {
        selection.sectionID = sectionID
        selection.navigationSeed = UUID()
    }

    private func firstSection(for chapter: CodeChapter) -> CodeSectionSummary? {
        let sections = library.sectionGroups(for: chapter).flatMap(\.sections)
        if let first = sections.first {
            return first
        }
        return library.sections(for: chapter).first
    }

    private func compareMenu<Content: View>(
        title: String,
        value: String,
        accent: Color,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            Menu {
                content()
            } label: {
                HStack(spacing: 10) {
                    Text(value)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)

                    Spacer(minLength: 0)

                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(accent)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color(uiColor: .systemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(Color(uiColor: .separator).opacity(0.55), lineWidth: 0.75)
                )
            }
            .buttonStyle(.plain)
        }
    }

    private func labelRow(title: String, isSelected: Bool) -> some View {
        HStack(spacing: 10) {
            Text(title)
            if isSelected {
                Image(systemName: "checkmark")
            }
        }
    }
}

private struct ComparePaneReader: View {
    @EnvironmentObject private var library: CodeLibraryViewModel

    @Binding var selection: ComparePaneSelection

    var body: some View {
        Group {
            if let chapter = selectedChapter,
               let initialSection = selectedSection(for: chapter) {
                NavigationStack {
                    paneRoot(chapter: chapter, initialSection: initialSection)
                }
                .id(selection.navigationSeed)
            } else {
                CodeEmptyStateCard(
                    title: "Choose Chapter",
                    systemImage: "rectangle.split.2x1",
                    description: "Pick a code section and chapter for this pane.",
                    accent: Color(uiColor: library.accentColor(for: selection.codeSectionID))
                )
            }
        }
    }

    @ViewBuilder
    private func paneRoot(chapter: CodeChapter, initialSection: CodeSectionSummary) -> some View {
        ChapterReaderView(chapter: chapter, initialSectionID: initialSection.id)
    }

    private var selectedChapter: CodeChapter? {
        library.chapters.first(where: { $0.id == selection.chapterID })
    }

    private func selectedSection(for chapter: CodeChapter) -> CodeSectionSummary? {
        let groupedSections = library.sectionGroups(for: chapter).flatMap(\.sections)
        let availableSections = groupedSections.isEmpty ? library.sections(for: chapter) : groupedSections
        return availableSections.first(where: { $0.id == selection.sectionID }) ?? availableSections.first
    }

}

private struct ComparePaneSelection: Hashable {
    var codeSectionID: Int64?
    var chapterID: Int64?
    var sectionID: Int64?
    var navigationSeed = UUID()
}
