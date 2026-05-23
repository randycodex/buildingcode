import SwiftUI

struct BrowseView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.colorScheme) private var colorScheme
    @Namespace private var chapterTileNamespace

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
                    VStack(alignment: .leading, spacing: 0) {
                        ScrollView {
                            libraryHeader
                                .padding(.horizontal, 16)
                                .padding(.top, 18)
                                .padding(.bottom, 12)
                            if library.chapters.isEmpty {
                                CodeEmptyStateCard(
                                    title: "No Chapters",
                                    systemImage: "text.book.closed",
                                    description: "The selected code version does not have any chapters yet.",
                                    accent: accentColor
                                )
                                .padding(.horizontal, 16)
                            } else {
                                let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
                                let chapterGroups = groupedChapterGroups(from: library.chapters)

                                LazyVStack(alignment: .leading, spacing: 12) {
                                    ForEach(Array(chapterGroups.enumerated()), id: \.element.id) { index, group in
                                        if selectedCodeSectionName == "All Sections" {
                                            codeSectionGroupHeader(
                                                title: group.title,
                                                color: group.palette.chapterTitleColor
                                            )
                                                .padding(.top, index == 0 ? 0 : 8)
                                        }

                                        if !group.chapterItems.isEmpty {
                                            LazyVGrid(columns: columns, spacing: 12) {
                                                ForEach(group.chapterItems) { chapter in
                                                    NavigationLink {
                                                        ChapterLaunchView(chapter: chapter)
                                                            .chapterZoomDestination(id: chapter.id, in: chapterTileNamespace)
                                                    } label: {
                                                        ChapterTile(
                                                            chapter: chapter,
                                                            accent: accentColor,
                                                            palette: tilePalette(for: chapter),
                                                            kind: .chapter
                                                        )
                                                    }
                                                    .buttonStyle(.plain)
                                                    .chapterZoomSource(id: chapter.id, in: chapterTileNamespace)
                                                }
                                            }
                                        }

                                        if !group.appendixItems.isEmpty {
                                            LazyVGrid(columns: columns, spacing: 12) {
                                                ForEach(group.appendixItems) { chapter in
                                                    NavigationLink {
                                                        ChapterLaunchView(chapter: chapter)
                                                            .chapterZoomDestination(id: chapter.id, in: chapterTileNamespace)
                                                    } label: {
                                                        ChapterTile(
                                                            chapter: chapter,
                                                            accent: accentColor,
                                                            palette: tilePalette(for: chapter),
                                                            kind: .appendix
                                                        )
                                                    }
                                                    .buttonStyle(.plain)
                                                    .chapterZoomSource(id: chapter.id, in: chapterTileNamespace)
                                                }
                                            }
                                        }
                                    }
                                }
                                .padding(.horizontal, 16)
                            }
                            Spacer(minLength: 24)
                        }
                        .overlay(alignment: .top) {
                            CodeTopContentFade()
                        }
                    }
                }
            }
            .background(browseBackdrop.ignoresSafeArea())
            .navigationTitle(selectedCodeSectionName)
            .navigationBarTitleDisplayMode(.large)
        }
    }

    @ViewBuilder
    private var codeSectionMenu: some View {
        if !library.codeSections.isEmpty {
            Menu {
                Button {
                    library.updateSelectedCodeSection(id: nil)
                } label: {
                    Label("All Sections", systemImage: library.selectedCodeSectionID == nil ? "checkmark" : "square.dashed")
                }

                ForEach(library.codeSections) { codeSection in
                    Button {
                        library.updateSelectedCodeSection(id: codeSection.id)
                    } label: {
                        Label(
                            CodeLibraryViewModel.displayName(forCodeSectionName: codeSection.name),
                            systemImage: library.selectedCodeSectionID == codeSection.id ? "checkmark" : "book.closed"
                        )
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    Text(selectedCodeSectionName)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.bold))
                }
                .foregroundStyle(.primary)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .overlay(
                    Capsule()
                        .stroke(Color(uiColor: .separator), lineWidth: 1)
                )
                .clipShape(Capsule())
            }
            .accessibilityLabel("Choose code section")
        }
    }

    private var libraryHeader: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text(selectedVersionName)
                    .font(.system(size: 18, weight: .medium, design: .default))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)

                Text(selectedJurisdictionName)
                    .font(.system(size: 15, weight: .regular, design: .default))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }

            HStack {
                Spacer(minLength: 0)
                codeSectionMenu
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 16)
    }

    private func chapterRow(for chapter: CodeChapter) -> some View {
        HStack(alignment: .top, spacing: 18) {
            Text(chapter.displayLabel)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(.primary)
                .frame(width: 156, alignment: .leading)

            Text(chapter.title)
                .font(.system(size: 17, weight: .regular))
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 22)
        .contentShape(Rectangle())
    }

    private var selectedJurisdictionName: String {
        library.availableJurisdictions.first(where: { $0.id == library.selectedJurisdictionKey })?.name ?? "Browse"
    }

    private var selectedVersionName: String {
        let rawName = library.selectedVersion?
            .codeVersion
            .replacingOccurrences(of: "\(selectedJurisdictionName) - ", with: "", options: .caseInsensitive)
            ?? "Select Version"
        return CodeLibraryViewModel.displayName(forLibraryName: rawName)
    }

    private var selectedCodeSectionName: String {
        library.codeSectionName(id: library.selectedCodeSectionID)
    }

    private func isAppendix(_ chapter: CodeChapter) -> Bool {
        let label = chapter.displayLabel.uppercased()
        let title = chapter.title.uppercased()
        return label.hasPrefix("APPENDIX") || title.hasPrefix("APPENDIX")
    }

    private func visibleAppendixItems(from chapters: [CodeChapter]) -> [CodeChapter] {
        let appendices = chapters.filter { isAppendix($0) }
        let baseAppendixNumbers = Set(appendices.map(\.chapterNumber).map { $0.uppercased() }.filter { suffixedAppendixBase(for: $0) == nil })

        return appendices.filter { chapter in
            let number = chapter.chapterNumber.uppercased()
            guard let baseNumber = suffixedAppendixBase(for: number) else { return true }
            return !baseAppendixNumbers.contains(baseNumber)
        }
    }

    private func suffixedAppendixBase(for chapterNumber: String) -> String? {
        let leadingLetters = chapterNumber.prefix { $0.isLetter }
        let trailingCharacters = chapterNumber.dropFirst(leadingLetters.count)
        guard !leadingLetters.isEmpty,
              !trailingCharacters.isEmpty,
              trailingCharacters.allSatisfy({ $0.isNumber })
        else {
            return nil
        }
        return String(leadingLetters)
    }

    private var browseBackdrop: some View {
        Color(uiColor: .systemGroupedBackground)
    }

    private var browseHairline: some View {
        Rectangle()
            .fill(Color(uiColor: .separator))
            .frame(height: 1)
            .frame(maxWidth: .infinity)
    }

    private func codeSectionGroupHeader(title: String, color: Color) -> some View {
        Text(title)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(color)
            .textCase(.uppercase)
            .tracking(0.8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, 4)
    }

    private func groupedChapterGroups(from chapters: [CodeChapter]) -> [BrowseChapterGroup] {
        let chapterItems = chapters.filter { !isAppendix($0) }
        let appendixItems = visibleAppendixItems(from: chapters)

        guard selectedCodeSectionName == "All Sections" else {
            return [
                BrowseChapterGroup(
                    id: selectedCodeSectionName,
                    title: selectedCodeSectionName,
                    palette: tilePalette(forCodeSectionName: selectedCodeSectionName),
                    chapterItems: chapterItems,
                    appendixItems: appendixItems
                )
            ]
        }

        let groupedChapters = Dictionary(grouping: chapterItems, by: { codeSectionTitle(for: $0) })
        let groupedAppendices = Dictionary(grouping: appendixItems, by: { codeSectionTitle(for: $0) })
        let orderedTitles = library.codeSections
            .map { CodeLibraryViewModel.displayName(forCodeSectionName: $0.name) }
            .filter { groupedChapters[$0] != nil || groupedAppendices[$0] != nil }

        return orderedTitles.map { title in
                BrowseChapterGroup(
                    id: title,
                    title: title,
                    palette: tilePalette(forCodeSectionName: title),
                    chapterItems: groupedChapters[title] ?? [],
                    appendixItems: groupedAppendices[title] ?? []
                )
        }
    }

    private func codeSectionTitle(for chapter: CodeChapter) -> String {
        library.codeSections
            .first(where: { $0.id == chapter.codeSectionID })
            .map { CodeLibraryViewModel.displayName(forCodeSectionName: $0.name) }
            ?? "All Sections"
    }

    private func tilePalette(forCodeSectionName name: String) -> ChapterTilePalette {
        let normalizedName = name
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()

        switch normalizedName {
        case let name where name.contains("BUILDING"):
            return .building
        case let name where name.contains("PLUMBING"):
            return .plumbing
        case let name where name.contains("FUEL GAS"):
            return .fuelGas
        case let name where name.contains("ELECTRICAL"):
            return .electrical
        case let name where name.contains("MECHANICAL"):
            return .mechanical
        case let name where name.contains("GENERAL ADMIN"):
            return .administrative
        case let name where name.contains("ENERGY"):
            return .energy
        case let name where name.contains("FIRE"):
            return .fire
        case let name where name.contains("EXISTING"):
            return .existingBuilding
        case let name where name.contains("RESIDENTIAL"):
            return .residential
        default:
            return .building
        }
    }

    private func tilePalette(for chapter: CodeChapter) -> ChapterTilePalette {
        let codeSectionName = library.codeSections
            .first(where: { $0.id == chapter.codeSectionID })?
            .name ?? ""
        return tilePalette(forCodeSectionName: codeSectionName)
    }
}

private struct BrowseChapterGroup: Identifiable {
    let id: String
    let title: String
    let palette: ChapterTilePalette
    let chapterItems: [CodeChapter]
    let appendixItems: [CodeChapter]
}

private struct ChapterLaunchView: View {
    let chapter: CodeChapter

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var initialSection: CodeSectionSummary?

    private var accentColor: Color {
        Color(uiColor: library.readerTheme.accentColor)
    }

    private var shouldUseNativeAuthoredReader: Bool {
        guard library.selectedVersion?.contentKind == .authored else { return false }
        return !library.sectionGroups(for: chapter).isEmpty
    }

    var body: some View {
        Group {
            if let initialSection = initialSection ?? library.firstSection(for: chapter) {
                if shouldUseNativeAuthoredReader {
                    ChapterReaderView(chapter: chapter, initialSectionID: initialSection.id)
                } else {
                    ChapterHTMLReaderView(
                        chapter: chapter,
                        initialSection: initialSection
                    )
                }
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

struct ChapterSectionsView: View {
    let chapter: CodeChapter
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var expandedGroupIDs: Set<String> = []

    private var accentColor: Color {
        Color(uiColor: library.readerTheme.accentColor)
    }

    var body: some View {
        let groups = library.sectionGroups(for: chapter)

        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                chapterHeader
                    .padding(.top, 22)
                    .padding(.bottom, 22)

                HStack(spacing: 12) {
                    actionButton(title: "Expand All") {
                        withAnimation(.easeInOut(duration: 0.22)) {
                            expandedGroupIDs = Set(groups.map(\.id))
                        }
                    }
                    actionButton(title: "Collapse All") {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            expandedGroupIDs.removeAll()
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .center)
                .padding(.bottom, 24)

                chapterListHairline

                ForEach(groups) { group in
                    sectionGroupRow(group)
                    chapterListHairline
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 140)
        }
        .background(Color(uiColor: .systemGroupedBackground).ignoresSafeArea())
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if expandedGroupIDs.isEmpty {
                expandedGroupIDs = []
            }
        }
    }

    private var chapterHeader: some View {
        VStack(spacing: 6) {
            Text("\(chapter.displayLabel):")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(.primary)
                .tracking(0.2)

            Text(chapter.title)
                .font(.system(size: 17, weight: .regular))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .lineSpacing(2)
        }
        .frame(maxWidth: .infinity)
    }

    private func actionButton(title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(accentColor)
                .padding(.horizontal, 18)
                .padding(.vertical, 11)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .overlay(
                    Capsule()
                        .stroke(Color(uiColor: .separator), lineWidth: 1)
                )
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private func sectionGroupRow(_ group: CodeSectionGroup) -> some View {
        let isExpanded = expandedGroupIDs.contains(group.id)

        return VStack(alignment: .leading, spacing: 0) {
            Button {
                toggleGroup(group.id)
            } label: {
                HStack(alignment: .center, spacing: 12) {
                    Text(group.displayLabel.uppercased())
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(accentColor)
                        .tracking(0.9)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 20)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded {
                chapterListHairline

                ForEach(group.sections, id: \.id) { section in
                    NavigationLink {
                        ChapterHTMLReaderView(
                            chapter: chapter,
                            initialSection: section
                        )
                    } label: {
                        sectionBubble(section: section)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private func sectionBubble(section: CodeSectionSummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(section.kind == .textBlock ? "TEXT BLOCK" : section.sectionNumber.uppercased())
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(accentColor)
                        .tracking(0.7)
                    Text(section.displayTitle)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.leading)
                        .lineSpacing(2)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(uiColor: .secondarySystemGroupedBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color(uiColor: .separator), lineWidth: 1)
        )
    }

    private var chapterListHairline: some View {
        Rectangle()
            .fill(Color(uiColor: .separator))
            .frame(height: 0.5)
            .frame(maxWidth: .infinity)
    }

    private func toggleGroup(_ groupID: String) {
        withAnimation(.easeInOut(duration: 0.2)) {
            if expandedGroupIDs.contains(groupID) {
                expandedGroupIDs.remove(groupID)
            } else {
                expandedGroupIDs.insert(groupID)
            }
        }
    }
}

private enum ChapterTileKind {
    case chapter
    case appendix
}

private enum ChapterTilePalette {
    case administrative
    case building
    case plumbing
    case fuelGas
    case electrical
    case mechanical
    case energy
    case fire
    case existingBuilding
    case residential

    private static func dynamicColor(light: UInt32, dark: UInt32) -> Color {
        Color(uiColor: UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(hex: dark)
                : UIColor(hex: light)
        })
    }

    var chapterFill: Color {
        switch self {
        case .administrative: return Self.dynamicColor(light: 0xE0C29A, dark: 0x35210E)
        case .building: return Self.dynamicColor(light: 0xCFCFC9, dark: 0x242424)
        case .plumbing: return Self.dynamicColor(light: 0xB7CEE6, dark: 0x15283A)
        case .fuelGas: return Self.dynamicColor(light: 0xE0B1A8, dark: 0x391715)
        case .electrical: return Self.dynamicColor(light: 0xD8C0A4, dark: 0x352215)
        case .mechanical: return Self.dynamicColor(light: 0xBDD4B2, dark: 0x1A2E17)
        case .energy: return Self.dynamicColor(light: 0xC7D5A1, dark: 0x263016)
        case .fire: return Self.dynamicColor(light: 0xDDB29E, dark: 0x301816)
        case .existingBuilding: return Self.dynamicColor(light: 0xC9C8B6, dark: 0x2B2A22)
        case .residential: return Self.dynamicColor(light: 0xD8C1AA, dark: 0x332217)
        }
    }

    var appendixFill: Color {
        switch self {
        case .administrative: return Self.dynamicColor(light: 0xB9CCE4, dark: 0x18283B)
        case .building: return Self.dynamicColor(light: 0xD5C7B7, dark: 0x33261E)
        case .plumbing: return Self.dynamicColor(light: 0xE2C29D, dark: 0x39220F)
        case .fuelGas: return Self.dynamicColor(light: 0xB9C7A5, dark: 0x24301A)
        case .electrical: return Self.dynamicColor(light: 0xB8C3D9, dark: 0x1C2536)
        case .mechanical: return Self.dynamicColor(light: 0xD8B8C4, dark: 0x35202A)
        case .energy: return Self.dynamicColor(light: 0xC3C1DB, dark: 0x26243A)
        case .fire: return Self.dynamicColor(light: 0xBFD2B2, dark: 0x1F2F1A)
        case .existingBuilding: return Self.dynamicColor(light: 0xC9BED9, dark: 0x2A2435)
        case .residential: return Self.dynamicColor(light: 0xBFD0DC, dark: 0x1E2B37)
        }
    }

    var chapterNumberColor: Color {
        switch self {
        case .administrative: return Self.dynamicColor(light: 0x35210E, dark: 0xE0C29A)
        case .building: return Self.dynamicColor(light: 0x242424, dark: 0xCFCFC9)
        case .plumbing: return Self.dynamicColor(light: 0x15283A, dark: 0xB7CEE6)
        case .fuelGas: return Self.dynamicColor(light: 0x391715, dark: 0xE0B1A8)
        case .electrical: return Self.dynamicColor(light: 0x352215, dark: 0xD8C0A4)
        case .mechanical: return Self.dynamicColor(light: 0x1A2E17, dark: 0xBDD4B2)
        case .energy: return Self.dynamicColor(light: 0x263016, dark: 0xC7D5A1)
        case .fire: return Self.dynamicColor(light: 0x301816, dark: 0xDDB29E)
        case .existingBuilding: return Self.dynamicColor(light: 0x2B2A22, dark: 0xC9C8B6)
        case .residential: return Self.dynamicColor(light: 0x332217, dark: 0xD8C1AA)
        }
    }

    var chapterTitleColor: Color {
        switch self {
        case .administrative: return Self.dynamicColor(light: 0xA56921, dark: 0xD9A561)
        case .building: return Self.dynamicColor(light: 0x5E5E59, dark: 0xB7B7B2)
        case .plumbing: return Self.dynamicColor(light: 0x3F6F9E, dark: 0x7FB0DE)
        case .fuelGas: return Self.dynamicColor(light: 0xAC5147, dark: 0xD8847A)
        case .electrical: return Self.dynamicColor(light: 0xA2743F, dark: 0xD2A16A)
        case .mechanical: return Self.dynamicColor(light: 0x5B8E47, dark: 0x98C180)
        case .energy: return Self.dynamicColor(light: 0x7E9B3A, dark: 0xB9D06D)
        case .fire: return Self.dynamicColor(light: 0xA65A53, dark: 0xD58F86)
        case .existingBuilding: return Self.dynamicColor(light: 0x7E7865, dark: 0xBCB69E)
        case .residential: return Self.dynamicColor(light: 0x9B7547, dark: 0xD0A577)
        }
    }

    var appendixNumberColor: Color {
        switch self {
        case .administrative: return Self.dynamicColor(light: 0x18283B, dark: 0xB9CCE4)
        case .building: return Self.dynamicColor(light: 0x33261E, dark: 0xD5C7B7)
        case .plumbing: return Self.dynamicColor(light: 0x39220F, dark: 0xE2C29D)
        case .fuelGas: return Self.dynamicColor(light: 0x24301A, dark: 0xB9C7A5)
        case .electrical: return Self.dynamicColor(light: 0x1C2536, dark: 0xB8C3D9)
        case .mechanical: return Self.dynamicColor(light: 0x35202A, dark: 0xD8B8C4)
        case .energy: return Self.dynamicColor(light: 0x26243A, dark: 0xC3C1DB)
        case .fire: return Self.dynamicColor(light: 0x1F2F1A, dark: 0xBFD2B2)
        case .existingBuilding: return Self.dynamicColor(light: 0x2A2435, dark: 0xC9BED9)
        case .residential: return Self.dynamicColor(light: 0x1E2B37, dark: 0xBFD0DC)
        }
    }

    var appendixTitleColor: Color {
        switch self {
        case .administrative: return Self.dynamicColor(light: 0x557FA8, dark: 0x87B2DC)
        case .building: return Self.dynamicColor(light: 0x8E684B, dark: 0xC79E77)
        case .plumbing: return Self.dynamicColor(light: 0xAE7432, dark: 0xD8A563)
        case .fuelGas: return Self.dynamicColor(light: 0x6D8F45, dark: 0xA1C27B)
        case .electrical: return Self.dynamicColor(light: 0x5C6F9F, dark: 0x90A8D6)
        case .mechanical: return Self.dynamicColor(light: 0x9A5E79, dark: 0xCB8EAA)
        case .energy: return Self.dynamicColor(light: 0x7468A8, dark: 0xA297D2)
        case .fire: return Self.dynamicColor(light: 0x618E4D, dark: 0x96C17E)
        case .existingBuilding: return Self.dynamicColor(light: 0x73639A, dark: 0xA695CB)
        case .residential: return Self.dynamicColor(light: 0x567F99, dark: 0x89AEC8)
        }
    }
}

private extension UIColor {
    convenience init(hex: UInt32) {
        let red   = CGFloat((hex >> 16) & 0xFF) / 255
        let green = CGFloat((hex >> 8) & 0xFF) / 255
        let blue  = CGFloat(hex & 0xFF) / 255
        self.init(red: red, green: green, blue: blue, alpha: 1)
    }
}

private extension View {
    @ViewBuilder
    func chapterZoomSource<ID: Hashable>(id: ID, in namespace: Namespace.ID) -> some View {
        if #available(iOS 18.0, *) {
            self.matchedTransitionSource(id: id, in: namespace)
        } else {
            self
        }
    }

    @ViewBuilder
    func chapterZoomDestination<ID: Hashable>(id: ID, in namespace: Namespace.ID) -> some View {
        if #available(iOS 18.0, *) {
            self.navigationTransition(.zoom(sourceID: id, in: namespace))
        } else {
            self
        }
    }
}

private struct ChapterTile: View {
    let chapter: CodeChapter
    let accent: Color
    let palette: ChapterTilePalette
    let kind: ChapterTileKind

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(tileFill)

            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    Spacer()
                    Text("\(chapter.chapterNumber)")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(tileNumberColor)
                        .lineLimit(1)
                }

                Spacer(minLength: 0)

                Text(chapter.title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(tileTitleColor)
                    .lineLimit(nil)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(minHeight: 110)
        .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Chapter \(chapter.displayLabel): \(chapter.title)"))
    }

    private var tileFill: Color {
        switch kind {
        case .chapter:
            return palette.chapterFill
        case .appendix:
            return palette.appendixFill
        }
    }

    private var tileNumberColor: Color {
        switch kind {
        case .chapter:
            return palette.chapterNumberColor
        case .appendix:
            return palette.appendixNumberColor
        }
    }

    private var tileTitleColor: Color {
        switch kind {
        case .chapter:
            return palette.chapterTitleColor
        case .appendix:
            return palette.appendixTitleColor
        }
    }
}

struct CodeAppBackdrop: View {
    let accent: Color

    var body: some View {
        Color(uiColor: .systemGroupedBackground)
    }
}

struct CodeTopContentFade: View {
    var body: some View {
        EmptyView()
    }
}

struct CodeSurface<Content: View>: View {
    let accent: Color
    let padding: CGFloat
    let content: Content

    init(accent: Color, padding: CGFloat = 16, @ViewBuilder content: () -> Content) {
        self.accent = accent
        self.padding = padding
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            content
        }
        .padding(padding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(uiColor: .secondarySystemGroupedBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color(uiColor: .separator), lineWidth: 1)
        )
    }
}

struct CodeHairline: View {
    var body: some View {
        Rectangle()
            .fill(Color(uiColor: .separator))
            .frame(height: 0.75)
            .frame(maxWidth: .infinity)
    }
}

struct CodeSectionHeader: View {
    let title: String
    let subtitle: String?
    let accent: Color

    init(title: String, subtitle: String? = nil, accent: Color) {
        self.title = title
        self.subtitle = subtitle
        self.accent = accent
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(.primary)

            if let subtitle, !subtitle.isEmpty {
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct CodeEyebrow: View {
    let text: String
    let accent: Color

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(accent)
            .textCase(.uppercase)
            .tracking(0.2)
    }
}

struct CodeMetaBadge: View {
    let text: String
    let accent: Color

    var body: some View {
        Text(text)
            .font(.caption.weight(.medium))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(Color(uiColor: .tertiarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

struct CodeStatPill: View {
    let value: String
    let label: String
    let accent: Color

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(Color(uiColor: .tertiarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

struct CodeSuggestionChip: View {
    let title: String
    let accent: Color

    var body: some View {
        Text(title)
            .font(.footnote.weight(.medium))
            .foregroundStyle(.primary)
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(Color(uiColor: .tertiarySystemGroupedBackground))
            .clipShape(Capsule())
    }
}

struct CodeEmptyStateCard: View {
    let title: String
    let systemImage: String
    let description: String
    let accent: Color

    var body: some View {
        CodeSurface(accent: accent) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: systemImage)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(accent)
                    .frame(width: 22)

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline)
                    Text(description)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

#if DEBUG
private struct BrowseViewPreviewContainer: View {
    @StateObject private var library = CodeLibraryViewModel()

    var body: some View {
        BrowseView()
            .environmentObject(library)
    }
}

private struct ChapterSectionsPreviewContainer: View {
    @StateObject private var library = CodeLibraryViewModel()

    var body: some View {
        NavigationStack {
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
        .environmentObject(library)
    }
}

struct BrowseView_Previews: PreviewProvider {
    static var previews: some View {
        BrowseViewPreviewContainer()
            .previewDisplayName("Browse")
    }
}

struct ChapterSectionsView_Previews: PreviewProvider {
    static var previews: some View {
        ChapterSectionsPreviewContainer()
            .previewDisplayName("Chapter Sections")
    }
}
#endif
