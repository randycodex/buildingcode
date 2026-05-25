import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var scrollOffset: CGFloat = 0
    @State private var pendingClearAction: ClearSettingsAction?
    @State private var expandedPicker: ExpandedPicker?
    private let tabBarClearance: CGFloat = 104

    private enum ExpandedPicker: Hashable {
        case jurisdiction
        case version
        case codeSection
    }

    private var readerPreviewAccent: Color {
        Color(uiColor: library.accentColor())
    }

    private var settingsChromeColor: Color {
        Color(uiColor: .secondaryLabel)
    }

    private var collapseProgress: CGFloat {
        min(max(-scrollOffset / 64, 0), 1)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                GeometryReader { proxy in
                    Color.clear
                        .preference(key: CodeScrollOffsetPreferenceKey.self, value: proxy.frame(in: .named("settingsScroll")).minY)
                }
                .frame(height: 0)

                VStack(alignment: .leading, spacing: 20) {
                    Text("Settings")
                        .font(.system(size: 16, weight: .bold, design: .default))
                        .foregroundStyle(.primary)
                        .padding(.bottom, 8)
                        .scaleEffect(1 - (collapseProgress * 0.08), anchor: .leading)
                        .opacity(1 - (collapseProgress * 0.22))

                    CodeSurface(accent: settingsChromeColor, padding: 0) {
                        VStack(spacing: 0) {
                            jurisdictionPicker
                            Divider()
                            versionPicker
                            Divider()
                            codeSectionPicker
                            Divider()
                            comparisonModeToggle
                        }
                    }

                    CodeSurface(accent: settingsChromeColor, padding: 16) {
                        themePreviewCard

                        CodeHairline()

                        fontPicker

                        CodeHairline()

                        accentPicker

                        CodeHairline()

                        fontSizeSlider

                        CodeHairline()

                        lineSpacingSlider
                    }

                    CodeSurface(accent: settingsChromeColor, padding: 16) {
                        savedDataTools
                    }

                    Text("NYC Code (Unofficial) is an unofficial reference tool. Verify legal, permitting, design, and construction decisions against enacted code text and agency guidance.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)

                    if let statusMessage = library.statusMessage {
                        Text(statusMessage)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 6)
                    }

                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, tabBarClearance)
            }
            .overlay(alignment: .top) {
                CodeTopContentFade(title: "Settings", progress: collapseProgress)
            }
            .background(CodeAppBackdrop(accent: settingsChromeColor).ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .tint(Color(uiColor: .label))
        }
        .coordinateSpace(name: "settingsScroll")
        .onPreferenceChange(CodeScrollOffsetPreferenceKey.self) { scrollOffset = $0 }
        .confirmationDialog(
            pendingClearAction?.confirmationTitle ?? "",
            isPresented: Binding(
                get: { pendingClearAction != nil },
                set: { isPresented in
                    if !isPresented {
                        pendingClearAction = nil
                    }
                }
            ),
            titleVisibility: .visible
        ) {
            if let pendingClearAction {
                Button(pendingClearAction.buttonTitle, role: .destructive) {
                    performClearAction(pendingClearAction)
                }
            }
            Button("Cancel", role: .cancel) {
                pendingClearAction = nil
            }
        } message: {
            if let pendingClearAction {
                Text(pendingClearAction.message)
            }
        }
    }

    private var jurisdictionPicker: some View {
        Group {
            if library.availableJurisdictions.isEmpty {
                HStack {
                    Text("No jurisdiction-specific bundles detected.")
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .padding(16)
            } else {
                expandableSettingsRow(
                    label: "Jurisdiction",
                    picker: .jurisdiction,
                    value: {
                        Text(selectedJurisdictionName)
                            .font(.title3.weight(.regular))
                            .foregroundStyle(.primary)
                    },
                    options: {
                        ForEach(library.availableJurisdictions) { jurisdiction in
                            expandableSettingsOption(
                                title: jurisdiction.name,
                                isSelected: jurisdiction.id == library.selectedJurisdictionKey
                            ) {
                                library.updateSelectedJurisdiction(key: jurisdiction.id)
                            }
                        }
                    }
                )
            }
        }
    }

    private var versionPicker: some View {
        Group {
            if library.filteredVersions.isEmpty {
                HStack {
                    Text("No bundled code content detected.")
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .padding(16)
            } else {
                expandableSettingsRow(
                    label: "Version",
                    picker: .version,
                    value: {
                        Text(selectedVersionPrimaryText)
                            .font(.title3.weight(.regular))
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.trailing)
                    },
                    options: {
                        ForEach(library.filteredVersions) { version in
                            expandableSettingsOption(
                                title: versionOptionTitle(for: version),
                                isSelected: version.fileName == library.selectedVersionFileName
                            ) {
                                library.updateSelectedVersion(fileName: version.fileName)
                            }
                        }
                    }
                )
            }
        }
    }

    private var codeSectionPicker: some View {
        Group {
            if library.codeSections.isEmpty {
                HStack {
                    Text("All sections are currently shown.")
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .padding(16)
            } else {
                expandableSettingsRow(
                    label: "Code Section",
                    picker: .codeSection,
                    value: {
                        Text(selectedCodeSectionName)
                            .font(.title3.weight(.regular))
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.trailing)
                    },
                    options: {
                        expandableSettingsOption(
                            title: "All Sections",
                            isSelected: library.selectedCodeSectionID == nil
                        ) {
                            library.updateSelectedCodeSection(id: nil)
                        }

                        ForEach(library.codeSections) { codeSection in
                            expandableSettingsOption(
                                title: CodeLibraryViewModel.displayName(forCodeSectionName: codeSection.name),
                                isSelected: codeSection.id == library.selectedCodeSectionID
                            ) {
                                library.updateSelectedCodeSection(id: codeSection.id)
                            }
                        }
                    }
                )
            }
        }
    }

    private var comparisonModeToggle: some View {
        Toggle(isOn: Binding(
            get: { library.comparisonModeEnabled },
            set: { library.setComparisonMode(enabled: $0, keeping: .settings) }
        )) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Comparison Mode")
                    .font(.title3)
                    .foregroundStyle(.primary)

                Text("Adds a second browser tab for side-by-side code review.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }

    private var themePreviewCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            CodeEyebrow(text: "Reader Preview", accent: readerPreviewAccent)

            Text("SECTION BC 101: GENERAL")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(readerPreviewAccent)

            Text("101.2 Scope.")
                .font(library.readerTheme.swiftUIFont(size: previewFontSize + 2, emphasized: true))
                .foregroundStyle(.primary)

            Text("The provisions of this code shall apply to the construction, alteration, movement, addition, replacement, repair, equipment, use and occupancy of every building or structure.")
                .font(library.readerTheme.swiftUIFont(size: previewFontSize))
                .foregroundStyle(.primary)
                .lineSpacing(library.readerTheme.lineSpacing)

            HStack(spacing: 8) {
                CodeStatPill(value: "\(Int(library.readerTheme.fontSize)) pt", label: "type", accent: readerPreviewAccent)
                CodeStatPill(value: "\(Int(library.readerTheme.lineSpacing))", label: "spacing", accent: readerPreviewAccent)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var fontPicker: some View {
        Picker("Font", selection: Binding(
            get: { library.readerTheme.fontChoice },
            set: { newValue in
                var theme = library.readerTheme
                theme.fontChoice = newValue
                library.updateReaderTheme(theme)
            }
        )) {
            ForEach(ReaderFontChoice.allCases) { choice in
                Text(choice.displayName).tag(choice)
            }
        }
    }

    private var accentPicker: some View {
        Picker("Accent Color", selection: Binding(
            get: { library.readerTheme.accentPalette },
            set: { newValue in
                var theme = library.readerTheme
                theme.accentPalette = newValue
                library.updateReaderTheme(theme)
            }
        )) {
            ForEach(ReaderAccentPalette.allCases) { palette in
                Text(palette.displayName).tag(palette)
            }
        }
    }

    private var fontSizeSlider: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Font Size")
                Spacer()
                Text("\(Int(library.readerTheme.fontSize)) pt")
                    .foregroundStyle(.secondary)
            }
            Slider(value: Binding(
                get: { library.readerTheme.fontSize },
                set: { newValue in
                    var theme = library.readerTheme
                    theme.fontSize = newValue
                    library.updateReaderTheme(theme)
                }
            ), in: ReaderTheme.minimumFontSize...ReaderTheme.maximumFontSize, step: 1)
        }
    }

    private var lineSpacingSlider: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Line Spacing")
                Spacer()
                Text("\(Int(library.readerTheme.lineSpacing))")
                    .foregroundStyle(.secondary)
            }
            Slider(value: Binding(
                get: { library.readerTheme.lineSpacing },
                set: { newValue in
                    var theme = library.readerTheme
                    theme.lineSpacing = newValue
                    library.updateReaderTheme(theme)
                }
            ), in: 0...12, step: 1)
        }
    }

    private var savedDataTools: some View {
        VStack(alignment: .leading, spacing: 14) {
            CodeEyebrow(text: "Saved Data", accent: settingsChromeColor)

            settingsDangerButton(
                title: "Clear Recent Searches",
                systemImage: "magnifyingglass.circle",
                action: .clearSearches
            )

            CodeHairline()

            settingsDangerButton(
                title: "Clear All Bookmarks",
                systemImage: "bookmark.slash",
                action: .clearBookmarks
            )

            CodeHairline()

            settingsDangerButton(
                title: "Clear All Notes",
                systemImage: "note.text",
                action: .clearNotes
            )

            CodeHairline()

            settingsDangerButton(
                title: "Clear All Tags",
                systemImage: "tag.slash",
                action: .clearTags
            )
        }
    }

    private var previewFontSize: CGFloat {
        CGFloat(library.readerTheme.fontSize)
    }

    private var selectedJurisdictionName: String {
        library.availableJurisdictions.first(where: { $0.id == library.selectedJurisdictionKey })?.name ?? "Not Selected"
    }

    private var selectedVersionPrimaryText: String {
        guard let version = library.selectedVersion else { return "Not Selected" }
        return versionOptionTitle(for: version)
    }

    private func versionOptionTitle(for version: BundledCodeVersion) -> String {
        CodeLibraryViewModel.displayName(forLibraryName: version.codeVersion)
    }

    private var selectedCodeSectionName: String {
        if let selectedCodeSectionID = library.selectedCodeSectionID,
           let selected = library.codeSections.first(where: { $0.id == selectedCodeSectionID }) {
            return CodeLibraryViewModel.displayName(forCodeSectionName: selected.name)
        }
        return "All Sections"
    }

    private func expandableSettingsRow<Value: View, Options: View>(
        label: String,
        picker: ExpandedPicker,
        @ViewBuilder value: () -> Value,
        @ViewBuilder options: () -> Options
    ) -> some View {
        let isExpanded = expandedPicker == picker

        return VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.22)) {
                    expandedPicker = isExpanded ? nil : picker
                }
            } label: {
                HStack(alignment: .center, spacing: 12) {
                    Text(label)
                        .font(.title3)
                        .foregroundStyle(.primary)

                    Spacer(minLength: 0)

                    value()

                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.tertiary)
                        .rotationEffect(.degrees(isExpanded ? 180 : 0))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded {
                VStack(spacing: 0) {
                    options()
                }
                .padding(.bottom, 6)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    private func expandableSettingsOption(
        title: String,
        isSelected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            action()
            withAnimation(.easeInOut(duration: 0.22)) {
                expandedPicker = nil
            }
        } label: {
            HStack(spacing: 10) {
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)

                Spacer(minLength: 0)

                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Color(uiColor: .label))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func settingsDangerButton(
        title: String,
        systemImage: String,
        action: ClearSettingsAction
    ) -> some View {
        Button {
            pendingClearAction = action
        } label: {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.red)

                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)

                Spacer(minLength: 0)
            }
        }
        .buttonStyle(.plain)
    }

    private func performClearAction(_ action: ClearSettingsAction) {
        switch action {
        case .clearSearches:
            library.clearRecentSearches()
        case .clearBookmarks:
            library.clearAllBookmarks()
        case .clearNotes:
            library.clearAllNotes()
        case .clearTags:
            library.clearAllTags()
        }
        pendingClearAction = nil
    }
}

private enum ClearSettingsAction: Identifiable {
    case clearSearches
    case clearBookmarks
    case clearNotes
    case clearTags

    var id: String { buttonTitle }

    var buttonTitle: String {
        switch self {
        case .clearSearches:
            return "Clear Recent Searches"
        case .clearBookmarks:
            return "Clear All Bookmarks"
        case .clearNotes:
            return "Clear All Notes"
        case .clearTags:
            return "Clear All Tags"
        }
    }

    var confirmationTitle: String {
        switch self {
        case .clearSearches:
            return "Clear recent searches?"
        case .clearBookmarks:
            return "Clear all bookmarks?"
        case .clearNotes:
            return "Clear all notes?"
        case .clearTags:
            return "Clear all tags?"
        }
    }

    var message: String {
        switch self {
        case .clearSearches:
            return "This removes the recent-search list for this device."
        case .clearBookmarks:
            return "This removes every bookmark saved for the current code version."
        case .clearNotes:
            return "This removes every note saved for the current code version."
        case .clearTags:
            return "This removes every tag from saved sections for the current code version. Bookmarks and notes are not affected."
        }
    }
}

#if DEBUG
#Preview("Settings") {
    SettingsView()
        .environmentObject(CodeLibraryViewModel())
}
#endif
