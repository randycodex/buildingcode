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
                                .padding(.horizontal, 20)
                                .padding(.top, 4)
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
                                let chapterItems = library.chapters.filter { !isAppendix($0) }
                                let appendixItems = visibleAppendixItems(from: library.chapters)

                                LazyVStack(alignment: .leading, spacing: 12) {
                                    if !chapterItems.isEmpty {
                                        LazyVGrid(columns: columns, spacing: 12) {
                                            ForEach(chapterItems) { chapter in
                                                NavigationLink {
                                                    ChapterLaunchView(chapter: chapter)
                                                        .chapterZoomDestination(id: chapter.id, in: chapterTileNamespace)
                                                } label: {
                                                    ChapterTile(chapter: chapter, accent: accentColor, kind: .chapter)
                                                }
                                                .buttonStyle(.plain)
                                                .chapterZoomSource(id: chapter.id, in: chapterTileNamespace)
                                            }
                                        }
                                    }

                                    if !appendixItems.isEmpty {
                                        LazyVGrid(columns: columns, spacing: 12) {
                                            ForEach(appendixItems) { chapter in
                                                NavigationLink {
                                                    ChapterLaunchView(chapter: chapter)
                                                        .chapterZoomDestination(id: chapter.id, in: chapterTileNamespace)
                                                } label: {
                                                    ChapterTile(chapter: chapter, accent: accentColor, kind: .appendix)
                                                }
                                                .buttonStyle(.plain)
                                                .chapterZoomSource(id: chapter.id, in: chapterTileNamespace)
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
            .navigationTitle(selectedJurisdictionName)
            .navigationBarTitleDisplayMode(.large)
        }
    }

    private var libraryHeader: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(selectedVersionName)
                .font(.title3.weight(.regular))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 18)
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
        library.selectedVersion?
            .codeVersion
            .replacingOccurrences(of: "\(selectedJurisdictionName) - ", with: "", options: .caseInsensitive)
            ?? "Select Version"
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
}

private struct ChapterLaunchView: View {
    let chapter: CodeChapter

    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var initialSection: CodeSectionSummary?
    @State private var pinchScale: CGFloat = 1
    @State private var isDismissingByPinch: Bool = false

    private var accentColor: Color {
        Color(uiColor: library.readerTheme.accentColor)
    }

    private let pinchDismissThreshold: CGFloat = 0.85
    private let pinchMinimumScale: CGFloat = 0.6

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
        .scaleEffect(pinchScale, anchor: .center)
        .animation(.interactiveSpring(response: 0.32, dampingFraction: 0.82), value: pinchScale)
        .simultaneousGesture(pinchToCloseGesture)
        .navigationTitle(chapter.displayLabel)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var pinchToCloseGesture: some Gesture {
        MagnificationGesture(minimumScaleDelta: 0.02)
            .onChanged { value in
                guard !isDismissingByPinch else { return }
                // Only react to inward pinches; outward pinches are reserved
                // for image zoom inside the reader.
                guard value < 1 else {
                    if pinchScale != 1 { pinchScale = 1 }
                    return
                }
                pinchScale = max(pinchMinimumScale, value)
            }
            .onEnded { value in
                guard !isDismissingByPinch else { return }
                if value <= pinchDismissThreshold {
                    isDismissingByPinch = true
                    withAnimation(.easeOut(duration: 0.18)) {
                        pinchScale = pinchMinimumScale
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                        dismiss()
                    }
                } else {
                    withAnimation(.spring(response: 0.32, dampingFraction: 0.78)) {
                        pinchScale = 1
                    }
                }
            }
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

    private static func dynamicColor(light: UInt32, dark: UInt32) -> Color {
        Color(uiColor: UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(hex: dark)
                : UIColor(hex: light)
        })
    }

    // Chapters use the green palette; appendices use the cool/teal palette.
    // Light-mode fills come from each palette's light shades; dark-mode fills
    // come from the dark shades. Numbers and titles use the remaining mid/
    // accent shades from the same palette for high-contrast labels in both
    // modes.
    var fill: Color {
        switch self {
        case .chapter:  return Self.dynamicColor(light: 0xCAD593, dark: 0x243010)
        case .appendix: return Self.dynamicColor(light: 0xD8DDEF, dark: 0x332E3C)
        }
    }

    var stroke: Color {
        switch self {
        case .chapter:  return Self.dynamicColor(light: 0xA1C349, dark: 0x2A3C24)
        case .appendix: return Self.dynamicColor(light: 0xA0A4B8, dark: 0x45B69C)
        }
    }

    var numberColor: Color {
        switch self {
        case .chapter:  return Self.dynamicColor(light: 0x243010, dark: 0xCAD593)
        case .appendix: return Self.dynamicColor(light: 0x7293A0, dark: 0xA29587)
        }
    }

    var titleColor: Color {
        switch self {
        case .chapter:  return Self.dynamicColor(light: 0x87A330, dark: 0xA1C349)
        case .appendix: return Self.dynamicColor(light: 0x45B69C, dark: 0x846C5B)
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
    let kind: ChapterTileKind

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(kind.fill)
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(kind.stroke, lineWidth: 1)

            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top) {
                    Spacer()
                    Text("\(chapter.chapterNumber)")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(kind.numberColor)
                        .lineLimit(1)
                }

                Spacer(minLength: 0)

                Text(chapter.title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(kind.titleColor)
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
