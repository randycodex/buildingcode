import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel

    private var accentColor: Color {
        Color(uiColor: library.readerTheme.accentColor)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    themePreviewCard
                        .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
                        .listRowBackground(Color.clear)
                }

                Section("Jurisdiction") {
                    if library.availableJurisdictions.isEmpty {
                        Text("No jurisdiction-specific bundles detected.")
                            .foregroundStyle(.secondary)
                    } else {
                        Picker("Jurisdiction", selection: Binding(
                            get: { library.selectedJurisdictionKey },
                            set: { library.updateSelectedJurisdiction(key: $0) }
                        )) {
                            ForEach(library.availableJurisdictions) { jurisdiction in
                                Text(jurisdiction.name).tag(jurisdiction.id)
                            }
                        }
                        .pickerStyle(.navigationLink)
                    }
                }

                Section("Code Version") {
                    if library.filteredVersions.isEmpty {
                        Text("No bundled code content detected.")
                            .foregroundStyle(.secondary)
                    } else {
                        Picker("Version", selection: Binding(
                            get: { library.selectedVersionFileName },
                            set: { library.updateSelectedVersion(fileName: $0) }
                        )) {
                            ForEach(library.filteredVersions) { version in
                                Text(version.displayName).tag(version.fileName)
                            }
                        }
                        .pickerStyle(.navigationLink)
                    }
                }

                Section("Code Section") {
                    if library.codeSections.isEmpty {
                        Text("All sections are currently shown.")
                            .foregroundStyle(.secondary)
                    } else {
                        Picker("Section", selection: Binding(
                            get: { library.selectedCodeSectionID },
                            set: { library.updateSelectedCodeSection(id: $0) }
                        )) {
                            Text("All Sections").tag(Optional<Int64>.none)

                            ForEach(library.codeSections) { codeSection in
                                Text(codeSection.name).tag(Optional(codeSection.id))
                            }
                        }
                        .pickerStyle(.navigationLink)
                    }
                }

                Section("Reader Theme") {
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

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(ReaderAccentPalette.allCases) { palette in
                                VStack(spacing: 6) {
                                    Circle()
                                        .fill(color(for: palette))
                                        .frame(width: 18, height: 18)
                                        .overlay(
                                            Circle()
                                                .strokeBorder(
                                                    palette == library.readerTheme.accentPalette ? Color.primary.opacity(0.35) : .clear,
                                                    lineWidth: 3
                                                )
                                        )
                                    Text(palette.displayName)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                .frame(width: 72)
                            }
                        }
                        .padding(.vertical, 4)
                    }

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

                Section("Disclaimer") {
                    Text("NYC Code (Unofficial) is an unofficial reference tool. Verify any legal, permitting, design, or construction decision against the enacted New York City code, agency guidance, and project-specific requirements.")
                        .font(.body)
                }

                if let statusMessage = library.statusMessage {
                    Section("Status") {
                        Text(statusMessage)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
            .navigationTitle("Settings")
        }
    }

    private var themePreviewCard: some View {
        CodeSurfaceCard(accent: accentColor) {
            Text("Reader Preview")
                .font(.headline)
            Text("Section BC 1001.2 Scope. This preview mirrors your current reader theme choices so you can tune typography before returning to the code.")
                .font(previewFont)
                .foregroundStyle(.primary)
                .lineSpacing(library.readerTheme.lineSpacing)

            HStack(spacing: 10) {
                CodeStatPill(value: "\(Int(library.readerTheme.fontSize)) pt", label: "type", accent: accentColor)
                CodeStatPill(value: "\(Int(library.readerTheme.lineSpacing))", label: "spacing", accent: accentColor)
                CodeStatPill(value: library.readerTheme.accentPalette.displayName, label: "accent", accent: accentColor)
            }
        }
    }

    private var previewFont: Font {
        switch library.readerTheme.fontChoice {
        case .system:
            return .system(size: library.readerTheme.fontSize)
        case .serif:
            return .system(size: library.readerTheme.fontSize, design: .serif)
        case .rounded:
            return .system(size: library.readerTheme.fontSize, design: .rounded)
        case .monospaced:
            return .system(size: library.readerTheme.fontSize, design: .monospaced)
        }
    }

    private func color(for palette: ReaderAccentPalette) -> Color {
        switch palette {
        case .civicBlue:
            return Color(red: 0.11, green: 0.31, blue: 0.57)
        case .graphite:
            return Color(red: 0.26, green: 0.27, blue: 0.29)
        case .forest:
            return Color(red: 0.18, green: 0.42, blue: 0.30)
        case .brick:
            return Color(red: 0.57, green: 0.27, blue: 0.21)
        }
    }
}

#if DEBUG
#Preview("Settings") {
    SettingsView()
        .environmentObject(CodeLibraryViewModel())
}
#endif
