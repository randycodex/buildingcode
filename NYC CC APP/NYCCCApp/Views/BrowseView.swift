import SwiftUI
import UIKit

struct BrowseView: View {
    var browserContext: BrowserContextID = .primary

    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.colorScheme) private var colorScheme
    @Namespace private var chapterTileNamespace
    @State private var scrollOffset: CGFloat = 0
    @State private var browseCodeSectionID: Int64?
    @State private var hasSeededBrowseSection = false
    @State private var rememberedSectionIDs: [Int64: Int64] = [:]
    private let tabBarClearance: CGFloat = 104

    private var accentColor: Color {
        Color(uiColor: library.accentColor(for: activeCodeSectionID))
    }

    private var collapseProgress: CGFloat {
        min(max(-scrollOffset / 64, 0), 1)
    }

    var body: some View {
        NavigationStack {
            Group {
                if library.availableVersions.isEmpty && library.isInitialContentLoaded {
                    CodeEmptyStateCard(
                        title: "No Code Content",
                        systemImage: "books.vertical",
                        description: library.statusMessage ?? "Bundle authored content or generated code data to begin browsing.",
                        accent: accentColor
                    )
                    .padding(20)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
                } else if library.availableVersions.isEmpty {
                    // Content is still loading — show nothing rather than flashing
                    // an empty-state card for the ~20 ms the async load takes.
                    Color(uiColor: .systemGroupedBackground).ignoresSafeArea()
                } else {
                    browseContent
                        .onAppear {
                            seedBrowseSectionIfNeeded()
                        }
                }
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
        }
        .onChange(of: library.selectedCodeSectionID) { _, newValue in
            // When comparison mode is off, the primary browser should always
            // mirror the code section chosen in Settings. seedBrowseSectionIfNeeded
            // only runs once per view appearance, so without this onChange the
            // browse @State stays stuck on whatever it was first seeded with.
            guard browserContext == .primary, !library.comparisonModeEnabled else { return }
            if browseCodeSectionID != newValue {
                browseCodeSectionID = newValue
                BrowserContextID.persistCodeSectionID(newValue, for: .primary)
            }
        }
        .onChange(of: library.comparisonModeEnabled) { _, isOn in
            // Turning comparison mode OFF should snap the primary browser back
            // to whatever Settings says (so the user sees the section they
            // picked in the settings, not a stale per-context value).
            guard browserContext == .primary, !isOn else { return }
            if browseCodeSectionID != library.selectedCodeSectionID {
                browseCodeSectionID = library.selectedCodeSectionID
                BrowserContextID.persistCodeSectionID(library.selectedCodeSectionID, for: .primary)
            }
        }
        .coordinateSpace(name: "browseScroll")
        .onPreferenceChange(CodeScrollOffsetPreferenceKey.self) { newOffset in
            DispatchQueue.main.async {
                scrollOffset = newOffset
            }
        }
    }

    private var browseContent: some View {
        let chapters = library.chapters(for: browseCodeSectionID)

        return ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                GeometryReader { proxy in
                    Color.clear
                        .preference(key: CodeScrollOffsetPreferenceKey.self, value: proxy.frame(in: .named("browseScroll")).minY)
                }
                .frame(height: 0)

                libraryHeader
                    .padding(.horizontal, 16)
                    .padding(.top, 18)
                    .padding(.bottom, 12)

                if chapters.isEmpty {
                    CodeEmptyStateCard(
                        title: "No Chapters",
                        systemImage: "text.book.closed",
                        description: "The selected code section does not have any chapters yet.",
                        accent: Color(uiColor: library.accentColor(for: browseCodeSectionID))
                    )
                    .padding(.horizontal, 16)
                } else {
                    let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
                    let codeSectionName = selectedCodeSectionName
                    let chapterGroups = groupedChapterGroups(
                        from: chapters,
                        selectedCodeSectionName: codeSectionName
                    )

                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(Array(chapterGroups.enumerated()), id: \.element.id) { index, group in
                            if codeSectionName == "All Sections" {
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
                                            chapterDestination(
                                                chapter: chapter,
                                                rememberedSectionID: rememberedSectionBinding(for: chapter.id)
                                            )
                                        } label: {
                                            ChapterTile(
                                                chapter: chapter,
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
                                            chapterDestination(
                                                chapter: chapter,
                                                rememberedSectionID: rememberedSectionBinding(for: chapter.id)
                                            )
                                        } label: {
                                            ChapterTile(
                                                chapter: chapter,
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
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .contentMargins(.bottom, tabBarClearance, for: .scrollContent)
        .scrollIndicators(.hidden)
        .overlay(alignment: .top) {
            CodeTopContentFade(title: selectedCodeSectionName, progress: collapseProgress)
        }
        .background(
            CodeAppBackdrop(accent: Color(uiColor: library.accentColor(for: browseCodeSectionID)))
                .ignoresSafeArea()
        )
    }

    @ViewBuilder
    private func chapterDestination(chapter: CodeChapter, rememberedSectionID: Binding<Int64?>) -> some View {
        if let initialSection = library.firstSection(for: chapter) {
            ChapterHTMLReaderView(
                chapter: chapter,
                initialSection: initialSection,
                rememberedNativeSectionID: rememberedSectionID
            )
            .chapterZoomDestination(id: chapter.id, in: chapterTileNamespace)
        } else {
            ChapterLaunchView(
                chapter: chapter,
                rememberedSectionID: rememberedSectionID
            )
            .chapterZoomDestination(id: chapter.id, in: chapterTileNamespace)
        }
    }

    private var libraryHeader: some View {
        VStack(alignment: .leading, spacing: 14) {
            if library.comparisonModeEnabled {
                Menu {
                    ForEach(library.codeSections) { codeSection in
                        Button {
                            updateCodeSection(codeSection.id)
                        } label: {
                            codeSectionPickerLabel(
                                CodeLibraryViewModel.displayName(forCodeSectionName: codeSection.name),
                                isSelected: browseCodeSectionID == codeSection.id
                            )
                        }
                    }
                } label: {
                    headerTitle(showPicker: true)
                }
                .buttonStyle(.plain)
            } else {
                headerTitle(showPicker: false)
            }

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
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 16)
    }

    private func headerTitle(showPicker: Bool) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(selectedCodeSectionName)
                .font(.system(size: 32, weight: .bold, design: .default))
                .foregroundStyle(.primary)
                .multilineTextAlignment(.leading)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)

            if showPicker {
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 19, weight: .semibold))
                    .foregroundStyle(Color(uiColor: library.accentColor(for: browseCodeSectionID)))
                    .padding(.top, 9)
            }
        }
        .scaleEffect(1 - (collapseProgress * 0.08), anchor: .leading)
        .opacity(1 - (collapseProgress * 0.22))
    }

    private func codeSectionPickerLabel(_ title: String, isSelected: Bool) -> some View {
        HStack(spacing: 8) {
            Text(title)
            if isSelected {
                Image(systemName: "checkmark")
            }
        }
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

    private var activeCodeSectionID: Int64? {
        browseCodeSectionID
    }

    private var selectedCodeSectionName: String {
        library.codeSectionName(id: browseCodeSectionID)
    }

    private func updateCodeSection(_ id: Int64?) {
        browseCodeSectionID = id
        BrowserContextID.persistCodeSectionID(id, for: browserContext)
        library.updateSelectedCodeSection(id: id)
    }

    private func rememberedSectionBinding(for chapterID: Int64) -> Binding<Int64?> {
        Binding(
            get: { rememberedSectionIDs[chapterID] },
            set: { newValue in
                if let newValue {
                    rememberedSectionIDs[chapterID] = newValue
                } else {
                    rememberedSectionIDs.removeValue(forKey: chapterID)
                }
            }
        )
    }

    private func seedBrowseSectionIfNeeded() {
        guard !hasSeededBrowseSection else { return }
        hasSeededBrowseSection = true

        let stored = BrowserContextID.storedCodeSectionID(for: browserContext)

        switch browserContext {
        case .primary:
            // When comparison mode is off the primary browser should always
            // reflect the code section chosen in Settings. The per-context
            // stored value is only authoritative during comparison sessions.
            if library.comparisonModeEnabled {
                browseCodeSectionID = stored
                    ?? library.selectedCodeSectionID
                    ?? library.codeSections.first?.id
            } else {
                browseCodeSectionID = library.selectedCodeSectionID
                    ?? stored
                    ?? library.codeSections.first?.id
            }
        case .secondary:
            let primarySectionID = BrowserContextID.storedCodeSectionID(for: .primary)
                ?? library.selectedCodeSectionID
                ?? library.codeSections.first?.id
            browseCodeSectionID = stored
                ?? library.codeSections.first(where: { $0.id != primarySectionID })?.id
                ?? primarySectionID
        }

        BrowserContextID.persistCodeSectionID(browseCodeSectionID, for: browserContext)
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

    private func groupedChapterGroups(
        from chapters: [CodeChapter],
        selectedCodeSectionName: String
    ) -> [BrowseChapterGroup] {
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
        if library.readerTheme.accentPalette == .monochrome {
            return .monochrome
        }

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

extension View {
    func disablesInteractivePopGesture() -> some View {
        background(InteractivePopGestureDisabler())
    }
}

private struct InteractivePopGestureDisabler: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        let controller = UIViewController()
        DispatchQueue.main.async {
            controller.navigationController?.interactivePopGestureRecognizer?.isEnabled = false
        }
        return controller
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        DispatchQueue.main.async {
            uiViewController.navigationController?.interactivePopGestureRecognizer?.isEnabled = false
        }
    }

    static func dismantleUIViewController(_ uiViewController: UIViewController, coordinator: ()) {
        uiViewController.navigationController?.interactivePopGestureRecognizer?.isEnabled = true
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
    var rememberedSectionID: Binding<Int64?> = .constant(nil)

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
                    initialSection: initialSection,
                    rememberedNativeSectionID: rememberedSectionID
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

struct ChapterSectionsView: View {
    let chapter: CodeChapter
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var expandedGroupIDs: Set<String> = []

    private var accentColor: Color {
        Color(uiColor: library.accentColor(for: chapter.codeSectionID))
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
                    Text(group.displayLabel(codeSectionName: library.codeSectionName(id: chapter.codeSectionID)).uppercased())
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
    case monochrome
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
        case .monochrome: return Self.dynamicColor(light: 0x6A6A73, dark: 0x1E1E20)
        case .administrative: return Self.dynamicColor(light: 0xE3D8FF, dark: 0x1F1533)
        case .building: return Self.dynamicColor(light: 0xFFD8C7, dark: 0x2A170A)
        case .plumbing: return Self.dynamicColor(light: 0xD6F6FF, dark: 0x08252D)
        case .fuelGas: return Self.dynamicColor(light: 0xF7D7DD, dark: 0x2A0F12)
        case .electrical: return Self.dynamicColor(light: 0xD8C0A4, dark: 0x352215)
        case .mechanical: return Self.dynamicColor(light: 0xD9F2DE, dark: 0x102418)
        case .energy: return Self.dynamicColor(light: 0xC7D5A1, dark: 0x263016)
        case .fire: return Self.dynamicColor(light: 0xDDB29E, dark: 0x301816)
        case .existingBuilding: return Self.dynamicColor(light: 0xC9C8B6, dark: 0x2B2A22)
        case .residential: return Self.dynamicColor(light: 0xD8C1AA, dark: 0x332217)
        }
    }

    var appendixFill: Color {
        switch self {
        case .monochrome: return Self.dynamicColor(light: 0xB9B8BF, dark: 0x363636)
        case .administrative: return Self.dynamicColor(light: 0xE7E2F1, dark: 0x241C32)
        case .building: return Self.dynamicColor(light: 0xD9ECFF, dark: 0x0D1D2A)
        case .plumbing: return Self.dynamicColor(light: 0xFFE4C8, dark: 0x2A1808)
        case .fuelGas: return Self.dynamicColor(light: 0xD6F7F2, dark: 0x082A2D)
        case .electrical: return Self.dynamicColor(light: 0xB8C3D9, dark: 0x1C2536)
        case .mechanical: return Self.dynamicColor(light: 0xFFD7EA, dark: 0x2A1020)
        case .energy: return Self.dynamicColor(light: 0xC3C1DB, dark: 0x26243A)
        case .fire: return Self.dynamicColor(light: 0xBFD2B2, dark: 0x1F2F1A)
        case .existingBuilding: return Self.dynamicColor(light: 0xC9BED9, dark: 0x2A2435)
        case .residential: return Self.dynamicColor(light: 0xBFD0DC, dark: 0x1E2B37)
        }
    }

    var chapterNumberColor: Color {
        switch self {
        case .monochrome: return Self.dynamicColor(light: 0xFFFFFF, dark: 0xE0E0E4)
        case .administrative: return Self.dynamicColor(light: 0x7C3AED, dark: 0xC4A1FF)
        case .building: return Self.dynamicColor(light: 0xC96410, dark: 0xFFB067)
        case .plumbing: return Self.dynamicColor(light: 0x0891B2, dark: 0x67E8F9)
        case .fuelGas: return Self.dynamicColor(light: 0xC62828, dark: 0xFF7B7B)
        case .electrical: return Self.dynamicColor(light: 0x352215, dark: 0xD8C0A4)
        case .mechanical: return Self.dynamicColor(light: 0x2F8F4E, dark: 0x6EDC8C)
        case .energy: return Self.dynamicColor(light: 0x263016, dark: 0xC7D5A1)
        case .fire: return Self.dynamicColor(light: 0x301816, dark: 0xDDB29E)
        case .existingBuilding: return Self.dynamicColor(light: 0x2B2A22, dark: 0xC9C8B6)
        case .residential: return Self.dynamicColor(light: 0x332217, dark: 0xD8C1AA)
        }
    }

    var chapterTitleColor: Color {
        switch self {
        case .monochrome: return Self.dynamicColor(light: 0xCCCCCC, dark: 0xF5F5F7)
        case .administrative: return Self.dynamicColor(light: 0x341A5A, dark: 0xF1E8FF)
        case .building: return Self.dynamicColor(light: 0x5C2E0A, dark: 0xFFE9D6)
        case .plumbing: return Self.dynamicColor(light: 0x123B46, dark: 0xE6FAFF)
        case .fuelGas: return Self.dynamicColor(light: 0x5A1515, dark: 0xFFE3E3)
        case .electrical: return Self.dynamicColor(light: 0xA2743F, dark: 0xD2A16A)
        case .mechanical: return Self.dynamicColor(light: 0x163524, dark: 0xE7F7EC)
        case .energy: return Self.dynamicColor(light: 0x7E9B3A, dark: 0xB9D06D)
        case .fire: return Self.dynamicColor(light: 0xA65A53, dark: 0xD58F86)
        case .existingBuilding: return Self.dynamicColor(light: 0x7E7865, dark: 0xBCB69E)
        case .residential: return Self.dynamicColor(light: 0x9B7547, dark: 0xD0A577)
        }
    }

    var appendixNumberColor: Color {
        switch self {
        case .monochrome: return Self.dynamicColor(light: 0x707078, dark: 0xD8D8DD)
        case .administrative: return Self.dynamicColor(light: 0x69548E, dark: 0xD3C3F1)
        case .building: return Self.dynamicColor(light: 0x1E6BA8, dark: 0x8FCBFF)
        case .plumbing: return Self.dynamicColor(light: 0xC96A10, dark: 0xFFB067)
        case .fuelGas: return Self.dynamicColor(light: 0x0E7490, dark: 0x67E8F9)
        case .electrical: return Self.dynamicColor(light: 0x1C2536, dark: 0xB8C3D9)
        case .mechanical: return Self.dynamicColor(light: 0xB83280, dark: 0xF472B6)
        case .energy: return Self.dynamicColor(light: 0x26243A, dark: 0xC3C1DB)
        case .fire: return Self.dynamicColor(light: 0x1F2F1A, dark: 0xBFD2B2)
        case .existingBuilding: return Self.dynamicColor(light: 0x2A2435, dark: 0xC9BED9)
        case .residential: return Self.dynamicColor(light: 0x1E2B37, dark: 0xBFD0DC)
        }
    }

    var appendixTitleColor: Color {
        switch self {
        case .monochrome: return Self.dynamicColor(light: 0x3B3B40, dark: 0xF0F0F3)
        case .administrative: return Self.dynamicColor(light: 0x34224E, dark: 0xF1E8FF)
        case .building: return Self.dynamicColor(light: 0x123A5A, dark: 0xE5F4FF)
        case .plumbing: return Self.dynamicColor(light: 0x5A3408, dark: 0xFFF0DC)
        case .fuelGas: return Self.dynamicColor(light: 0x0F3F46, dark: 0xDFFBFF)
        case .electrical: return Self.dynamicColor(light: 0x5C6F9F, dark: 0x90A8D6)
        case .mechanical: return Self.dynamicColor(light: 0x5A183F, dark: 0xFFE5F2)
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

struct CodeScrollOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

struct CodeTopContentFade: View {
    let title: String?
    let progress: CGFloat
    let alwaysVisible: Bool
    @Environment(\.colorScheme) private var colorScheme

    init(title: String? = nil, progress: CGFloat = 0, alwaysVisible: Bool = true) {
        self.title = title
        self.progress = progress
        self.alwaysVisible = alwaysVisible
    }

    var body: some View {
        GeometryReader { proxy in
            let topInset = proxy.safeAreaInsets.top
            let collapsedOpacity = alwaysVisible
                ? 1
                : min(max((progress - 0.08) / 0.22, 0), 1)

            VStack(spacing: 0) {
                ZStack {
                    Rectangle()
                        .fill(.ultraThinMaterial)

                    Rectangle()
                        .fill(colorScheme == .dark ? Color.black.opacity(0.86) : Color.clear)
                }
                    .mask(
                        LinearGradient(
                            stops: [
                                .init(color: .black, location: 0),
                                .init(color: .black.opacity(0.82), location: 0.48),
                                .init(color: .black.opacity(0), location: 1)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(height: topInset)

                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .top)
            .opacity(collapsedOpacity)
            .allowsHitTesting(false)
            .ignoresSafeArea(.container, edges: .top)
        }
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
            .foregroundStyle(accent)
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(accent.opacity(0.14))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .strokeBorder(accent.opacity(0.28), lineWidth: 0.75)
            )
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
                    accent: Color(uiColor: library.accentColor())
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
