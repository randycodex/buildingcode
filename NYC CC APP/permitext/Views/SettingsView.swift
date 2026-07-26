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
    @State private var selectedProjectIDs = Set<Int64>()
    @State private var showsProjectDeleteWarning = false
    @State private var showsAccountDeleteWarning = false
    @State private var showsSignOutWarning = false
    private let tabBarClearance: CGFloat = CodeScreenMetrics.tabBarClearance
    private let subscriptionManagementURL = URL(string: "https://apps.apple.com/account/subscriptions")!
    private let webWorkspaceURL = URL(string: "https://permitext.com")!
    private let privacyPolicyURL = URL(string: "https://permitext.com/privacy")!
    private let privacyContactURL = URL(string: "mailto:permitext@gmail.com")!

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
                        }
                    }

                    CodeSurface(accent: settingsChromeColor, showsBorder: false) {
                        planCard
                    }

                    CodeSurface(accent: settingsChromeColor, showsBorder: false) {
                        accountCard
                    }

                    CodeSurface(accent: settingsChromeColor, showsBorder: false) {
                        firmWorkspaceCard
                    }

                    CodeSurface(accent: settingsChromeColor, showsBorder: false) {
                        webWorkspaceCard
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
                        projectManagementCard
                    }

                    CodeSurface(accent: settingsChromeColor, showsBorder: false) {
                        savedDataTools
                    }

                    Text("permitext is an unofficial reference tool. Verify legal, permitting, design, and construction decisions against enacted code text and agency guidance.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)

                    HStack(spacing: 8) {
                        Link("Privacy Policy", destination: privacyPolicyURL)
                        Text("·")
                        Link("Contact", destination: privacyContactURL)
                    }
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Color.appChrome)
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
        .onChange(of: library.folders.map(\.id)) { _, folderIDs in
            selectedProjectIDs.formIntersection(folderIDs)
        }
        .task(id: library.signedInAccount?.appUserID) {
            await library.refreshOrganizations()
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

    private var planCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            CodeEyebrow(text: "Plan", accent: settingsChromeColor)

            Text(planSummaryText)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Text("Billing: \(library.planBillingLabel)")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 10) {
                planFeatureRow("Free", details: "Read codes, search, recent history, 25 saved sections, 10 notes, continuity, and cross-device sync.")
                planFeatureRow("Pro", details: "Unlimited saved sections and notes, Projects, Notebook, Report Draft, professional exports, tags, and offline access. Optional Research add-on: selected-evidence Research, verified citations, immutable answer history, conversation history, and a monthly AI allowance.")
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
            .opacity(library.isStoreKitBusy ? 0.55 : 1)

            Button {
                Task { await library.purchaseResearch() }
            } label: {
                Label(researchButtonTitle, systemImage: "text.magnifyingglass")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .foregroundStyle(.primary)
                    .padding(.vertical, 12)
                    .background(
                        Capsule(style: .continuous)
                            .fill(Color(uiColor: .secondarySystemGroupedBackground))
                    )
            }
            .buttonStyle(.plain)
            .disabled(!canPurchaseResearch)
            .opacity(canPurchaseResearch ? 1 : 0.55)

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
            }
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
                VStack(spacing: 10) {
                    Button {
                        if library.requiresSignOutConfirmation {
                            showsSignOutWarning = true
                        } else {
                            library.signOut()
                        }
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
                    .popover(
                        isPresented: $showsSignOutWarning,
                        attachmentAnchor: .rect(.bounds),
                        arrowEdge: .bottom
                    ) {
                        signOutWarningPopover
                            .presentationCompactAdaptation(.popover)
                    }

                    Button(role: .destructive) {
                        showsAccountDeleteWarning = true
                    } label: {
                        Label("Delete Account", systemImage: "person.crop.circle.badge.minus")
                            .font(.footnote.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .foregroundStyle(.red)
                            .background(
                                Capsule(style: .continuous)
                                    .fill(Color.red.opacity(0.10))
                            )
                    }
                    .buttonStyle(.plain)
                    .disabled(library.isAccountBusy)
                    .popover(
                        isPresented: $showsAccountDeleteWarning,
                        attachmentAnchor: .rect(.bounds),
                        arrowEdge: .bottom
                    ) {
                        accountDeletePopover
                            .presentationCompactAdaptation(.popover)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var firmWorkspaceCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                CodeEyebrow(text: "Firm & Collaboration", accent: settingsChromeColor)
                Spacer(minLength: 0)
                Text("Private beta")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Color.appChrome)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(
                        Capsule(style: .continuous)
                            .fill(Color.appChrome.opacity(0.12))
                    )
            }

            Text("Open firm-owned Projects with your assigned Owner, Editor, Reviewer, or Viewer role. Project administration and member changes remain on the web.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            if library.pendingOrganizationInvitationToken != nil {
                VStack(alignment: .leading, spacing: 10) {
                    Label("Firm invitation ready", systemImage: "person.2.badge.plus")
                        .font(.subheadline.weight(.semibold))

                    Text(library.signedInAccount == nil
                         ? "Sign in with Apple, then return here to accept the private invitation."
                         : "Accept only if you recognize the firm or Project that shared this link.")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if library.signedInAccount != nil {
                        Button {
                            Task { await library.acceptPendingOrganizationInvitation() }
                        } label: {
                            Label(
                                library.isOrganizationWorkspaceLoading ? "Accepting…" : "Accept Invitation",
                                systemImage: "checkmark.circle.fill"
                            )
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(
                                Capsule(style: .continuous)
                                    .fill(Color.appChrome.opacity(0.12))
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(library.isOrganizationWorkspaceLoading)
                    }
                }
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color.appChrome.opacity(0.07))
                )
            }

            if library.signedInAccount == nil {
                Text("Sign in to see firm workspaces and Projects shared with you.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else if library.isOrganizationWorkspaceLoading && library.organizations.isEmpty {
                HStack(spacing: 10) {
                    ProgressView()
                    Text("Loading firm access…")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            } else if library.organizations.isEmpty {
                Text("No firm workspaces yet. Create one or transfer a personal Project from Permitext Web.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                ForEach(library.organizations) { organization in
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(alignment: .top, spacing: 10) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(organization.name)
                                    .font(.headline)
                                Text(firmWorkspaceMetadata(organization))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer(minLength: 0)
                            Text((organization.role ?? "member").capitalized)
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(.primary)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 5)
                                .background(
                                    Capsule(style: .continuous)
                                        .fill(Color.primary.opacity(0.08))
                                )
                        }

                        ForEach(organization.projects ?? []) { project in
                            NavigationLink {
                                OrganizationProjectHubView(
                                    organization: organization,
                                    project: project
                                )
                            } label: {
                                HStack(spacing: 10) {
                                    Circle()
                                        .fill(
                                            Color(
                                                uiColor: PlatformColor(
                                                    hex: project.colorHex ?? CodeFolder.defaultColorHex
                                                ) ?? .systemBlue
                                            )
                                        )
                                        .frame(width: 10, height: 10)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(project.name)
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(.primary)
                                        Text(project.address.isEmpty
                                             ? "\(project.role.capitalized) access"
                                             : "\(project.role.capitalized) · \(project.address)")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(1)
                                    }
                                    Spacer(minLength: 0)
                                    Image(systemName: "chevron.right")
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(.tertiary)
                                }
                                .padding(11)
                                .background(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .fill(Color.primary.opacity(0.055))
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(Color.primary.opacity(0.04))
                    )
                }
            }

            Button {
                openURL(webWorkspaceURL)
            } label: {
                Label("Manage Firms on Permitext Web", systemImage: "safari")
                    .font(.footnote.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(
                        Capsule(style: .continuous)
                            .fill(Color.primary.opacity(0.08))
                    )
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func firmWorkspaceMetadata(_ organization: PermitextOrganization) -> String {
        let access = organization.accessScope == "project" ? "Project access" : "Firm access"
        guard let seats = organization.seats else { return access }
        return "\(access) · \(seats.used)/\(organization.billingIdentity.seatLimit) seats"
    }

    private var webWorkspaceCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            CodeEyebrow(text: "Web Workspace", accent: settingsChromeColor)

            Text("Research conversations and editable Workboards are available on the web today. iOS recognizes their account records but does not edit them yet.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Button {
                openURL(webWorkspaceURL)
            } label: {
                Label("Open Permitext Web", systemImage: "safari")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(
                        Capsule(style: .continuous)
                            .fill(Color.primary.opacity(0.08))
                    )
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens the Permitext web workspace in your browser")
        }
    }

    private var planSummaryText: String {
        if library.currentPlan == .pro {
            if library.isStoreKitTestProActive {
                return "Pro (Test) is active only on this device. Use an account grant to test Pro across iOS and web."
            }
            if library.currentEntitlementSource == .lifetimeGrant {
                return "Lifetime Pro is active, including Research. This gifted account does not need an App Store subscription."
            }
            if library.hasResearchAccess {
                return "Pro and Research are active. Projects, Notebook, Report Draft, professional exports, offline access, and selected-evidence Research are unlocked."
            }
            return "Pro is active. Projects, Notebook, Report Draft, professional exports, tags, and offline access are unlocked. Research is available separately."
        }
        return "Free includes reading, search, recents, 25 saved sections, 10 notes, continuity, and cross-device sync. Pro unlocks the professional workspace."
    }

    private var canPurchaseResearch: Bool {
        library.currentPlan == .pro &&
            !library.hasResearchAccess &&
            library.researchProductDisplayPrice != nil &&
            !library.isStoreKitBusy
    }

    private var researchButtonTitle: String {
        if library.hasResearchAccess { return "Research Active" }
        guard library.currentPlan == .pro else { return "Pro Required for Research" }
        if let price = library.researchProductDisplayPrice, !price.isEmpty {
            return "Add Research - \(price)/month"
        }
        return library.isStoreKitBusy ? "Loading Research..." : "Research Purchase Not Configured"
    }

    private var accountSummaryText: String {
        guard let account = library.signedInAccount else {
            return "Sign in to sync saved sections, notes, and Projects across your devices."
        }
        if let displayName = account.displayName, !displayName.isEmpty {
            return "Signed in as \(displayName). Saved sections, notes, and Projects can sync across your devices."
        }
        return "Signed in with \(account.authProvider.rawValue). Saved sections, notes, and Projects can sync across your devices."
    }

    private var upgradeButtonTitle: String {
        library.upgradeCallToActionTitle
    }

    private var upgradeButtonBackgroundColor: Color {
        if library.currentPlan == .pro {
            return Color(red: 0, green: 185 / 255, blue: 232 / 255)
        }
        if library.isStoreKitBusy {
            return Color(uiColor: .tertiarySystemGroupedBackground)
        }
        return colorScheme == .dark ? Color.white.opacity(0.96) : Color.appChrome
    }

    private var upgradeButtonForegroundColor: Color {
        if library.currentPlan == .pro {
            return Color(red: 0, green: 16 / 255, blue: 20 / 255)
        }
        if library.isStoreKitBusy {
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

    private func planFeatureRow(_ title: String, details: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: title == "Free" ? "checkmark.circle" : "checkmark.seal.fill")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(title == "Free" ? Color.secondary : Color.appChrome)
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

    private var projectManagementCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                CodeEyebrow(text: "Projects", accent: settingsChromeColor)

                Spacer(minLength: 0)

                if !library.folders.isEmpty {
                    Button(selectedProjectIDs.count == library.folders.count ? "Clear All" : "Select All") {
                        if selectedProjectIDs.count == library.folders.count {
                            selectedProjectIDs.removeAll()
                        } else {
                            selectedProjectIDs = Set(library.folders.map(\.id))
                        }
                    }
                    .buttonStyle(.plain)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                }
            }

            if library.folders.isEmpty {
                Text("No projects yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(library.folders.enumerated()), id: \.element.id) { index, folder in
                        projectSelectionRow(folder)

                        if index < library.folders.count - 1 {
                            CodeHairline()
                        }
                    }
                }

                Button(role: .destructive) {
                    showsProjectDeleteWarning = true
                } label: {
                    Label(
                        selectedProjectIDs.isEmpty
                            ? "Delete Selected"
                            : "Delete \(selectedProjectIDs.count) Selected",
                        systemImage: "trash"
                    )
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.red)
                .disabled(selectedProjectIDs.isEmpty)
                .popover(isPresented: $showsProjectDeleteWarning, attachmentAnchor: .rect(.bounds), arrowEdge: .bottom) {
                    projectDeletePopover
                        .presentationCompactAdaptation(.popover)
                }
            }
        }
    }

    private func projectSelectionRow(_ folder: CodeFolder) -> some View {
        let isSelected = selectedProjectIDs.contains(folder.id)
        return Button {
            if isSelected {
                selectedProjectIDs.remove(folder.id)
            } else {
                selectedProjectIDs.insert(folder.id)
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isSelected ? Color.appChrome : Color.secondary)

                Circle()
                    .fill(Color(uiColor: PlatformColor(hex: folder.colorHex) ?? .systemBlue))
                    .frame(width: 12, height: 12)

                VStack(alignment: .leading, spacing: 2) {
                    Text(folder.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                        .lineLimit(1)

                    let count = library.bookmarkCount(inFolder: folder.id)
                    Text(count == 1 ? "1 saved item" : "\(count) saved items")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
            .padding(.vertical, 9)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(folder.name), \(isSelected ? "selected" : "not selected")")
    }

    private var projectDeletePopover: some View {
        let count = selectedProjectIDs.count
        return VStack(alignment: .leading, spacing: 18) {
            Text(count == 1 ? "Delete project?" : "Delete projects?")
                .font(.title3.weight(.semibold))
                .foregroundStyle(.primary)

            Text("This will permanently delete \(count) \(count == 1 ? "project" : "projects") from every synced device. Saved items will keep their bookmarks. This cannot be undone.")
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Button(count == 1 ? "Delete Project" : "Delete Projects", role: .destructive) {
                let deletedIDs = library.deleteFolders(ids: selectedProjectIDs)
                selectedProjectIDs.subtract(deletedIDs)
                showsProjectDeleteWarning = false
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)
        }
        .frame(width: 300, alignment: .leading)
        .padding(24)
    }

    private var accountDeletePopover: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Delete Permitext account?")
                .font(.title3.weight(.semibold))
                .foregroundStyle(.primary)

            Text(accountDeletionMessage)
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            if library.hasAppleManagedBillingForAccountDeletion {
                Button {
                    openURL(subscriptionManagementURL)
                } label: {
                    Label("Manage Apple Subscription", systemImage: "arrow.up.right.square")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            }

            Button("Delete Account", role: .destructive) {
                Task {
                    if await library.deleteAccount() {
                        showsAccountDeleteWarning = false
                    }
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)
            .disabled(library.isAccountBusy)
        }
        .frame(width: 320, alignment: .leading)
        .padding(24)
    }

    private var accountDeletionMessage: String {
        let dataDeletion = "This permanently deletes your Permitext account, synced saved work, Research history, private Workboard images and reports, and any firm workspace you own. This cannot be undone."
        if library.hasAppleManagedBillingForAccountDeletion &&
            library.hasWebManagedBillingForAccountDeletion {
            return "Permitext will cancel your Stripe subscription first. Apple billing cannot be canceled by Permitext, so manage your Apple subscription before deleting or Apple may continue charging you. \(dataDeletion)"
        }
        if library.hasAppleManagedBillingForAccountDeletion {
            return "Apple billing cannot be canceled by Permitext. Manage your Apple subscription first, or Apple may continue charging you. \(dataDeletion)"
        }
        if library.hasWebManagedBillingForAccountDeletion {
            return "Permitext will cancel your Stripe subscription before deleting anything. If Stripe cannot confirm cancellation, your account and data will not be deleted. \(dataDeletion)"
        }
        if library.currentEntitlementSource == .lifetimeGrant {
            return "This account has a lifetime grant and no recurring Permitext subscription. Deleting it permanently removes the grant. \(dataDeletion)"
        }
        return "No recurring Permitext subscription is linked to this account. \(dataDeletion)"
    }

    private var signOutWarningPopover: some View {
        let pendingCount = library.pendingUserContentSyncCount
        let conflictCount = library.userContentSyncConflicts.count
        let pendingText = pendingCount == 1 ? "1 local change is waiting to sync" : "\(pendingCount) local changes are waiting to sync"
        let conflictText = conflictCount == 1 ? "1 conflict needs review" : "\(conflictCount) conflicts need review"
        let detail: String
        if pendingCount > 0, conflictCount > 0 {
            detail = "\(pendingText), and \(conflictText)."
        } else if pendingCount > 0 {
            detail = "\(pendingText)."
        } else {
            detail = "\(conflictText)."
        }

        return VStack(alignment: .leading, spacing: 18) {
            Text("Sign out before syncing?")
                .font(.title3.weight(.semibold))
                .foregroundStyle(.primary)

            Text("\(detail) Your work remains on this iPhone, but it will not sync until you sign in again.")
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Button("Sign Out Anyway", role: .destructive) {
                showsSignOutWarning = false
                library.signOut()
            }
            .buttonStyle(.borderedProminent)
            .tint(.red)

            Button("Cancel", role: .cancel) {
                showsSignOutWarning = false
            }
            .buttonStyle(.plain)
        }
        .frame(width: 320, alignment: .leading)
        .padding(24)
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
