import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel

    private var accentColor: Color {
        Color(uiColor: library.readerTheme.accentColor)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
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
                .padding(.bottom, 28)
            }
            .overlay(alignment: .top) {
                CodeTopContentFade()
            }
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
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
                .font(.system(size: previewFontSize + 2, weight: .semibold, design: previewDesign))
                .foregroundStyle(.primary)

            Text("The provisions of this code shall apply to the construction, alteration, movement, addition, replacement, repair, equipment, use and occupancy of every building or structure.")
                .font(.system(size: previewFontSize, weight: .regular, design: previewDesign))
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
        Picker("Accent", selection: Binding(
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

    private var previewFontSize: CGFloat {
        CGFloat(library.readerTheme.fontSize)
    }

    private var previewDesign: Font.Design {
        switch library.readerTheme.fontChoice {
        case .sanFrancisco: return .default
        case .serif: return .serif
        case .rounded: return .rounded
        case .monospaced: return .monospaced
        }
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
}

#if DEBUG
#Preview("Settings") {
    SettingsView()
        .environmentObject(CodeLibraryViewModel())
}
#endif
