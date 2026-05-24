import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var scrollOffset: CGFloat = 0
    @State private var pendingClearAction: ClearSettingsAction?
    private let tabBarClearance: CGFloat = 104

    private var accentColor: Color {
        Color(uiColor: library.accentColor())
    }

    private var collapseProgress: CGFloat {
        min(max(-scrollOffset / 64, 0), 1)
    }

    private static let buildTimestamp: String = {
        let executableURL = Bundle.main.executableURL
            ?? Bundle.main.bundleURL.appendingPathComponent("NYCCCApp")
        let date = (try? FileManager.default.attributesOfItem(atPath: executableURL.path)[.modificationDate] as? Date) ?? Date()
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        return formatter.string(from: date)
    }()

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
                        .font(.system(size: 32, weight: .bold, design: .default))
                        .foregroundStyle(.primary)
                        .padding(.bottom, 8)
                        .scaleEffect(1 - (collapseProgress * 0.08), anchor: .leading)
                        .opacity(1 - (collapseProgress * 0.22))

                    CodeSurface(accent: accentColor, padding: 0) {
                        VStack(spacing: 0) {
                            jurisdictionPicker
                            Divider()
                            versionPicker
                            Divider()
                            codeSectionPicker
                        }
                    }

                    CodeSurface(accent: accentColor, padding: 16) {
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

                    CodeSurface(accent: accentColor, padding: 16) {
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

                    Text("Build: \(Self.buildTimestamp)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 4)
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, tabBarClearance)
            }
            .overlay(alignment: .top) {
                CodeTopContentFade(title: "Settings", progress: collapseProgress)
            }
            .overlay(alignment: .bottom) {
                CodeBottomContentFade(extraHeight: tabBarClearance)
            }
            .modifier(CodeScrollClipDisabledModifier())
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
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
                codeLibraryMenuRow(label: "Jurisdiction") {
                    Text(selectedJurisdictionName)
                        .font(.title3.weight(.regular))
                        .foregroundStyle(.primary)
                } menu: {
                    ForEach(library.availableJurisdictions) { jurisdiction in
                        Button(jurisdiction.name) {
                            library.updateSelectedJurisdiction(key: jurisdiction.id)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
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
                codeLibraryMenuRow(label: "Version") {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(selectedVersionPrimaryText)
                            .font(.headline.weight(.regular))
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.trailing)
                        Text(selectedJurisdictionName)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.trailing)
                    }
                } menu: {
                    ForEach(library.filteredVersions) { version in
                        Button(CodeLibraryViewModel.displayName(forLibraryName: version.displayName)) {
                            library.updateSelectedVersion(fileName: version.fileName)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
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
                codeLibraryMenuRow(label: "Code Section") {
                    Text(selectedCodeSectionName)
                        .font(.title3.weight(.regular))
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.trailing)
                } menu: {
                    Button("All Sections") {
                        library.updateSelectedCodeSection(id: nil)
                    }

                    ForEach(library.codeSections) { codeSection in
                        Button(CodeLibraryViewModel.displayName(forCodeSectionName: codeSection.name)) {
                            library.updateSelectedCodeSection(id: codeSection.id)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
            }
        }
    }

    private var themePreviewCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            CodeEyebrow(text: "Reader Preview", accent: accentColor)

            Text("SECTION BC 101: GENERAL")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(accentColor)

            Text("101.2 Scope.")
                .font(library.readerTheme.swiftUIFont(size: previewFontSize + 2, emphasized: true))
                .foregroundStyle(.primary)

            Text("The provisions of this code shall apply to the construction, alteration, movement, addition, replacement, repair, equipment, use and occupancy of every building or structure.")
                .font(library.readerTheme.swiftUIFont(size: previewFontSize))
                .foregroundStyle(.primary)
                .lineSpacing(library.readerTheme.lineSpacing)

            HStack(spacing: 8) {
                CodeStatPill(value: "\(Int(library.readerTheme.fontSize)) pt", label: "type", accent: accentColor)
                CodeStatPill(value: "\(Int(library.readerTheme.lineSpacing))", label: "spacing", accent: accentColor)
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
            CodeEyebrow(text: "Saved Data", accent: accentColor)

            Text("The app only persists your recent searches, reader settings, and the `user_data.sqlite` file used for bookmarks and notes.")
                .font(.footnote)
                .foregroundStyle(.secondary)

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
        }
    }

    private var previewFontSize: CGFloat {
        CGFloat(library.readerTheme.fontSize)
    }

    private var selectedJurisdictionName: String {
        library.availableJurisdictions.first(where: { $0.id == library.selectedJurisdictionKey })?.name ?? "Not Selected"
    }

    private var selectedVersionPrimaryText: String {
        let rawName = library.selectedVersion?.codeVersion.replacingOccurrences(of: "\(selectedJurisdictionName) - ", with: "", options: .caseInsensitive) ?? "Not Selected"
        return CodeLibraryViewModel.displayName(forLibraryName: rawName)
    }

    private var selectedCodeSectionName: String {
        if let selectedCodeSectionID = library.selectedCodeSectionID,
           let selected = library.codeSections.first(where: { $0.id == selectedCodeSectionID }) {
            return CodeLibraryViewModel.displayName(forCodeSectionName: selected.name)
        }
        return "All Sections"
    }

    private func codeLibraryMenuRow<Value: View>(
        label: String,
        @ViewBuilder value: () -> Value,
        @ViewBuilder menu: () -> some View
    ) -> some View {
        Menu {
            menu()
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
            }
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
        }
        pendingClearAction = nil
    }
}

private enum ClearSettingsAction: Identifiable {
    case clearSearches
    case clearBookmarks
    case clearNotes

    var id: String { buttonTitle }

    var buttonTitle: String {
        switch self {
        case .clearSearches:
            return "Clear Recent Searches"
        case .clearBookmarks:
            return "Clear All Bookmarks"
        case .clearNotes:
            return "Clear All Notes"
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
        }
    }
}

#if DEBUG
#Preview("Settings") {
    SettingsView()
        .environmentObject(CodeLibraryViewModel())
}
#endif
