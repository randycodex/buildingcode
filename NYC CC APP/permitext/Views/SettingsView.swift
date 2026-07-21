import AuthenticationServices
import SwiftUI
import UIKit

private enum SettingsRowTypography {
    static let label = Font.body.weight(.medium)
    static let value = Font.body
}

struct SettingsView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.openURL) private var openURL
    @State private var scrollOffset: CGFloat = 0
    @State private var pendingClearAction: ClearSettingsAction?
    @State private var publicUsernameDraft = ""
    private let tabBarClearance: CGFloat = CodeScreenMetrics.tabBarClearance
    private let subscriptionManagementURL = URL(string: "https://apps.apple.com/account/subscriptions")!

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

                VStack(alignment: .leading, spacing: CodeScreenMetrics.contentSpacingBelowTitle) {
                    CodeScreenTitle(title: "Settings", collapseProgress: collapseProgress)

                    CodeSurface(accent: settingsChromeColor, padding: 0, showsBorder: false) {
                        VStack(spacing: 0) {
                            jurisdictionPicker
                            Divider()
                            versionPicker
                            Divider()
                            codeSectionPicker
                        }
                    }

                    CodeSurface(accent: settingsChromeColor, showsBorder: false) {
                        planCard
                    }

                    CodeSurface(accent: settingsChromeColor, showsBorder: false) {
                        accountCard
                    }

                    CodeSurface(accent: settingsChromeColor, showsBorder: false) {
                        syncCard
                    }

                    CodeSurface(accent: settingsChromeColor, showsBorder: false) {
                        themePreviewCard

                        CodeHairline()

                        fontPicker

                        CodeHairline()

                        fontSizeSlider

                        CodeHairline()

                        lineSpacingSlider
                    }

                    CodeSurface(accent: settingsChromeColor, showsBorder: false) {
                        savedDataTools
                    }

                    Text("permitext is an unofficial reference tool. Verify legal, permitting, design, and construction decisions against enacted code text and agency guidance.")
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
                .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
                .padding(.top, CodeScreenMetrics.scrollMeasuredTitleTopPadding)
                .padding(.bottom, tabBarClearance)
            }
            .overlay(alignment: .top) {
                CodeTopContentFade(title: "Settings", progress: collapseProgress)
            }
            .background(CodeAppBackdrop(accent: settingsChromeColor).ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .tint(Color.appChrome)
        }
        .coordinateSpace(name: "settingsScroll")
        .onPreferenceChange(CodeScrollOffsetPreferenceKey.self) { scrollOffset = $0 }
    }

    private var jurisdictionPicker: some View {
        Group {
            if library.availableJurisdictions.isEmpty {
                HStack {
                    Text("No jurisdiction-specific bundles detected.")
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .padding(CodeScreenMetrics.cardPadding)
            } else {
                settingsMenuRow(label: "Jurisdiction") {
                    Text(selectedJurisdictionName)
                        .font(SettingsRowTypography.value)
                        .foregroundStyle(.primary)
                } content: {
                    ForEach(library.availableJurisdictions) { jurisdiction in
                        Button {
                            library.updateSelectedJurisdiction(key: jurisdiction.id)
                        } label: {
                            Label(jurisdiction.name, systemImage: jurisdiction.id == library.selectedJurisdictionKey ? "checkmark" : "")
                        }
                    }
                }
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
                .padding(CodeScreenMetrics.cardPadding)
            } else {
                settingsMenuRow(label: "Version") {
                    Text(selectedVersionPrimaryText)
                        .font(SettingsRowTypography.value)
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.trailing)
                } content: {
                    ForEach(library.filteredVersions) { version in
                        Button {
                            library.updateSelectedVersion(fileName: version.fileName)
                        } label: {
                            Label(
                                versionOptionTitle(for: version),
                                systemImage: version.fileName == library.selectedVersionFileName ? "checkmark" : ""
                            )
                        }
                    }
                }
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
                .padding(CodeScreenMetrics.cardPadding)
            } else {
                settingsMenuRow(label: "Code Section") {
                    Text(selectedCodeSectionName)
                        .font(SettingsRowTypography.value)
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.trailing)
                } content: {
                    Button {
                        library.updateSelectedCodeSection(id: nil)
                    } label: {
                        Label("All Sections", systemImage: library.selectedCodeSectionID == nil ? "checkmark" : "")
                    }

                    ForEach(library.codeSections) { codeSection in
                        Button {
                            library.updateSelectedCodeSection(id: codeSection.id)
                        } label: {
                            Label(
                                CodeLibraryViewModel.displayName(forCodeSectionName: codeSection.name),
                                systemImage: codeSection.id == library.selectedCodeSectionID ? "checkmark" : ""
                            )
                        }
                    }
                }
            }
        }
    }

    private var planCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            CodeEyebrow(text: "Plan", accent: settingsChromeColor)

            Text(planSummaryText)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Text("Billing: \(library.currentEntitlementSource.label)")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 10) {
                planFeatureRow("Free", details: "Read codes, search, recent history, 25 saved sections, and 10 notes.")
                planFeatureRow("Pro", details: "Unlimited saved sections, notes, projects, tags, PDF export, continuity, and cross-device sync.")
            }

            Button {
                Task { await library.purchasePro() }
            } label: {
                Label(upgradeButtonTitle, systemImage: "sparkles")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .foregroundStyle(upgradeButtonForegroundColor)
                    .padding(.vertical, 12)
                    .background(
                        Capsule(style: .continuous)
                            .fill(upgradeButtonBackgroundColor)
                    )
            }
            .buttonStyle(.plain)
            .disabled(library.isStoreKitBusy || library.currentPlan == .pro)
            .opacity(library.isStoreKitBusy || library.currentPlan == .pro ? 0.55 : 1)

            if library.currentPlan == .pro {
                Button {
                    openURL(subscriptionManagementURL)
                } label: {
                    Text("Manage Subscription")
                        .font(.footnote.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
            } else {
                Button {
                    Task { await library.restorePurchases() }
                } label: {
                    Text(library.isStoreKitBusy ? "Checking purchases..." : "Restore Purchases")
                        .font(.footnote.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .disabled(library.isStoreKitBusy)
            }

            #if DEBUG
            Text(library.accountSyncDebugSummary)
                .font(.caption2.monospaced())
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Text(storeKitDebugText)
                .font(.caption2.monospaced())
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Picker("Local Test Plan", selection: Binding(
                get: { library.currentPlan },
                set: { library.setDebugPlan($0) }
            )) {
                Text(AppPlan.free.label).tag(AppPlan.free)
                Text(AppPlan.pro.label).tag(AppPlan.pro)
            }
            .pickerStyle(.segmented)

            Button {
                Task { await library.runDebugRestoreCheck() }
            } label: {
                Label("Run Restore Check", systemImage: "arrow.clockwise.circle")
                    .font(.caption.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(
                        Capsule(style: .continuous)
                            .fill(.secondary.opacity(0.12))
                    )
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
            #endif
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .task {
            await library.refreshStoreKitEntitlements()
        }
    }

    private var accountCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            CodeEyebrow(text: "Account", accent: settingsChromeColor)

            Text(accountSummaryText)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            if library.signedInAccount == nil {
                SignInWithAppleButton(.signIn) { request in
                    request.requestedScopes = [.fullName]
                } onCompletion: { result in
                    Task {
                        await library.handleAppleSignIn(result: result)
                    }
                }
                .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                .frame(height: 46)
                .clipShape(Capsule(style: .continuous))
                .disabled(library.isAccountBusy)
                .opacity(library.isAccountBusy ? 0.55 : 1)

            } else {
                accountProfileEditor

                Button {
                    library.signOut()
                } label: {
                    Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .foregroundStyle(.primary)
                        .background(
                            Capsule(style: .continuous)
                                .fill(Color.primary.opacity(0.08))
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .task(id: library.signedInAccount?.appUserID) {
            seedPublicUsernameDraft()
        }
    }

    private var accountProfileEditor: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Public username")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.primary)

            TextField("username", text: $publicUsernameDraft)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.asciiCapable)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.primary)
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color.primary.opacity(colorScheme == .dark ? 0.08 : 0.05))
                )

            Text(accountProfileHelperText)
                .font(.caption)
                .foregroundStyle(accountProfileValidationMessage == nil ? Color.secondary : Color.orange)
                .fixedSize(horizontal: false, vertical: true)

            Button {
                Task {
                    await library.updateAccountProfile(publicUsername: publicUsernameDraft)
                    seedPublicUsernameDraft()
                }
            } label: {
                Text(library.isAccountBusy ? "Saving..." : "Save Public Username")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(accountProfileCanSave ? .primary : .secondary)
                    .background(
                        Capsule(style: .continuous)
                            .fill(Color.primary.opacity(accountProfileCanSave ? 0.08 : 0.045))
                    )
            }
            .buttonStyle(.plain)
            .disabled(!accountProfileCanSave)
        }
    }

    private var syncCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            CodeEyebrow(text: "Sync", accent: settingsChromeColor)

            HStack(alignment: .top, spacing: 12) {
                Image(systemName: syncStatusIconName)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(syncStatusColor)
                    .frame(width: 26, alignment: .leading)

                VStack(alignment: .leading, spacing: 4) {
                    Text(library.syncStatusTitle)
                        .font(.headline)
                        .foregroundStyle(.primary)

                    Text(library.syncStatusDetail)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 0)
            }

            ForEach(Array(library.userContentSyncConflicts.prefix(5))) { conflict in
                VStack(alignment: .leading, spacing: 10) {
                    Text(syncConflictLabel(conflict))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)

                    Text("The server has a newer copy. Choose which version to keep.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack(spacing: 10) {
                        syncConflictButton("Use server") {
                            await library.resolveUserContentSyncConflict(conflict, keepLocal: false)
                        }
                        syncConflictButton("Keep mine") {
                            await library.resolveUserContentSyncConflict(conflict, keepLocal: true)
                        }
                    }
                }
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color.orange.opacity(0.08))
                )
            }

            Button {
                Task { await library.syncNow() }
            } label: {
                Label(library.isAccountBusy ? "Syncing..." : "Sync Now", systemImage: "arrow.triangle.2.circlepath")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .foregroundStyle(library.canSyncNow ? .primary : .secondary)
                    .background(
                        Capsule(style: .continuous)
                            .fill(Color.primary.opacity(library.canSyncNow ? 0.08 : 0.045))
                    )
            }
            .buttonStyle(.plain)
            .disabled(!library.canSyncNow)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func syncConflictButton(_ title: String, action: @escaping () async -> Void) -> some View {
        Button {
            Task { await action() }
        } label: {
            Text(title)
                .font(.caption.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
                .background(
                    Capsule(style: .continuous)
                        .fill(Color.primary.opacity(0.08))
                )
        }
        .buttonStyle(.plain)
        .disabled(library.isAccountBusy)
    }

    private func syncConflictLabel(_ conflict: UserContentSyncConflict) -> String {
        switch conflict.entityKind {
        case .savedItem: return "Saved section conflict"
        case .annotation: return "Note or tag conflict"
        case .project: return "Project conflict"
        case .projectSection: return "Project section conflict"
        case .workboard: return "Workboard conflict"
        case .continuity: return "Reading position conflict"
        case .codeVersionClear: return "Cleared data conflict"
        }
    }

    private var syncStatusIconName: String {
        if library.signedInAccount == nil { return "person.crop.circle.badge.exclamationmark" }
        if library.isAccountBusy { return "arrow.triangle.2.circlepath" }
        if library.userContentSyncCheckpoint?.lastErrorMessage != nil { return "exclamationmark.triangle.fill" }
        if library.pendingUserContentSyncCount > 0 { return "clock.badge.exclamationmark" }
        return "checkmark.circle.fill"
    }

    private var syncStatusColor: Color {
        if library.signedInAccount == nil { return .secondary }
        if library.userContentSyncCheckpoint?.lastErrorMessage != nil { return .orange }
        if library.pendingUserContentSyncCount > 0 { return .orange }
        return settingsChromeColor
    }

    private var planSummaryText: String {
        if library.currentPlan == .pro {
            if library.currentEntitlementSource == .lifetimeGrant {
                return "Lifetime Pro is active. This account has gifted access and does not need an App Store subscription."
            }
            return "Pro is active. The same saved work, PDF export, tags, continuity, and cross-device sync are unlocked across iOS and web."
        }
        return "Free keeps reading and search usable. Pro unlocks heavier personal-workflow tools when you need more saved work, organization, exports, and continuity."
    }

    private var accountSummaryText: String {
        guard let account = library.signedInAccount else {
            return "Sign in to attach local saved work to your account and test cross-device sync."
        }
        if let displayName = account.displayName, !displayName.isEmpty {
            return "Signed in as \(displayName). Saved work can sync through the connected backend."
        }
        return "Signed in with \(account.authProvider.rawValue). Saved work can sync through the connected backend."
    }

    private var accountProfileValidationMessage: String? {
        CodeLibraryViewModel.publicUsernameValidationMessage(publicUsernameDraft)
    }

    private var accountProfileHelperText: String {
        if let accountProfileValidationMessage {
            return accountProfileValidationMessage
        }
        return "Used later for public and collaboration features. This stays separate from your Apple identity."
    }

    private var accountProfileCanSave: Bool {
        guard let account = library.signedInAccount, !library.isAccountBusy else { return false }
        guard accountProfileValidationMessage == nil else { return false }
        let currentUsername = account.publicUsername ?? ""
        let draftUsername = CodeLibraryViewModel.normalizedPublicUsername(publicUsernameDraft) ?? ""
        return draftUsername != currentUsername
    }

    private var upgradeButtonTitle: String {
        library.upgradeCallToActionTitle
    }

    private var upgradeButtonBackgroundColor: Color {
        if library.currentPlan == .pro || library.isStoreKitBusy {
            return Color(uiColor: .tertiarySystemGroupedBackground)
        }
        return colorScheme == .dark ? Color.white.opacity(0.96) : Color.appChrome
    }

    private var upgradeButtonForegroundColor: Color {
        if library.currentPlan == .pro || library.isStoreKitBusy {
            return Color.secondary
        }
        return colorScheme == .dark ? Color.black.opacity(0.9) : Color.white
    }

    #if DEBUG
    private var storeKitDebugText: String {
        let productsText = library.storeKitLoadedProductIDs.isEmpty
            ? "0 products loaded"
            : library.storeKitLoadedProductIDs.joined(separator: ", ")
        return "StoreKit: \(productsText)\nTransactions: \(library.storeKitDebugSummary)"
    }
    #endif

    private func seedPublicUsernameDraft() {
        publicUsernameDraft = library.signedInAccount?.publicUsername ?? ""
    }

    private func planFeatureRow(_ title: String, details: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: title == "Pro" ? "checkmark.seal.fill" : "checkmark.circle")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(title == "Pro" ? Color.appChrome : .secondary)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)

                Text(details)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
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
            ), in: ReaderTheme.minimumLineSpacing...ReaderTheme.maximumLineSpacing, step: 1)
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

    private func settingsMenuRow<Value: View, Content: View>(
        label: String,
        @ViewBuilder value: () -> Value,
        @ViewBuilder content: () -> Content
    ) -> some View {
        Menu {
            content()
        } label: {
            HStack(alignment: .center, spacing: 12) {
                Text(label)
                    .font(SettingsRowTypography.label)
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)

                Spacer(minLength: 0)

                value()

                Image(systemName: "chevron.down")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, CodeScreenMetrics.settingsPickerRowHorizontalPadding)
            .padding(.vertical, CodeScreenMetrics.settingsPickerRowVerticalPadding)
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
        .popover(
            isPresented: Binding(
                get: { pendingClearAction == action },
                set: { isPresented in
                    if !isPresented, pendingClearAction == action {
                        pendingClearAction = nil
                    }
                }
            ),
            attachmentAnchor: .rect(.bounds),
            arrowEdge: .bottom
        ) {
            clearActionPopover(action)
                .presentationCompactAdaptation(.popover)
        }
    }

    private func clearActionPopover(_ action: ClearSettingsAction) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(action.confirmationTitle)
                .font(.title3.weight(.semibold))
                .foregroundStyle(.primary)

            Text(action.message)
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Button(action.buttonTitle, role: .destructive) {
                performClearAction(action)
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)
        }
        .frame(width: 280, alignment: .leading)
        .padding(24)
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

private enum ClearSettingsAction: Identifiable, Equatable {
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
        .environmentObject(CodeLibraryViewModel.preview())
        .preferredColorScheme(.light)
}
#endif
