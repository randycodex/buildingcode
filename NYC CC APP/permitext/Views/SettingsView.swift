import AuthenticationServices
import ClerkKit
import StoreKit
import SwiftUI
import UIKit

enum SettingsSection: Hashable {
    case plan
    case account
}

private enum AccountDeletionStageStatus: String {
    case waiting = "Waiting"
    case active = "In progress"
    case complete = "Complete"
    case failed = "Needs attention"
    case skipped = "Not applicable"

    var color: Color {
        switch self {
        case .active: Color.appChrome
        case .complete: .green
        case .failed: .red
        case .waiting, .skipped: .secondary
        }
    }
}

private struct AccountDeletionStage: Identifiable {
    let id: String
    let title: String
    var status: AccountDeletionStageStatus = .waiting
    var detail = ""

    static let initial = [
        AccountDeletionStage(id: "billing", title: "Canceling Stripe billing"),
        AccountDeletionStage(id: "data", title: "Deleting Permitext data"),
        AccountDeletionStage(id: "device", title: "Clearing this device"),
        AccountDeletionStage(id: "identity", title: "Removing Permitext sign-in identity")
    ]
}

struct SettingsView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.openURL) private var openURL
    @Environment(\.purchase) private var purchase
    @Environment(\.permitextClerk) private var clerk
    @State private var scrollOffset: CGFloat = 0
    @State private var pendingClearAction: ClearSettingsAction?
    @State private var selectedProjectIDs = Set<Int64>()
    @State private var showsProjectDeleteWarning = false
    @State private var showsAccountDeleteWarning = false
    @State private var accountDeletionConfirmation = ""
    @State private var accountDeletionAppleAcknowledged = false
    @State private var accountDeletionStages = AccountDeletionStage.initial
    @State private var accountDeletionHasStarted = false
    @State private var accountDeletionResultMessage: String?
    @State private var accountDeletionPreflightMessage: String?
    @State private var accountDeletionDeviceError: String?
    @State private var accountDeletionIdentityError: String?
    @State private var deletedAccountForCleanup: SignedInAccount?
    @State private var deletionClerkSessionID: String?
    @State private var accountDeletionOperationInProgress = false
    @StateObject private var deletionVerification = AccountDeletionVerificationModel()
    @State private var showsSignOutWarning = false
    @State private var didScrollToInitialSection = false
    @State private var pendingSyncConflictResolution: PendingSyncConflictResolution?
    private let tabBarClearance: CGFloat = CodeScreenMetrics.tabBarClearance
    private let subscriptionManagementURL = URL(string: "https://apps.apple.com/account/subscriptions")!
    private let privacyPolicyURL = URL(string: "https://permitext.com/privacy")!
    private let termsURL = URL(string: "https://permitext.com/terms")!
    private let refundsURL = URL(string: "https://permitext.com/refunds")!
    private let supportURL = URL(string: "https://permitext.com/support")!
    let initialSection: SettingsSection?

    init(initialSection: SettingsSection? = nil) {
        self.initialSection = initialSection
    }

    private var readerPreviewAccent: Color {
        Color(uiColor: library.accentColor())
    }

    private var settingsChromeColor: Color {
        Color(uiColor: .secondaryLabel)
    }

    private var syncStatusSystemImage: String {
        if library.signedInAccount == nil { return "icloud.slash" }
        if library.isAccountBusy { return "arrow.triangle.2.circlepath" }
        if !library.userContentSyncConflicts.isEmpty { return "exclamationmark.icloud" }
        if library.pendingUserContentSyncCount > 0 { return "icloud.and.arrow.up" }
        return "checkmark.icloud"
    }

    private var syncStatusColor: Color {
        if !library.userContentSyncConflicts.isEmpty { return .orange }
        if library.signedInAccount == nil || library.isAccountBusy { return .secondary }
        return Color.appChrome
    }

    private var appVersionLabel: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "—"
        return "Permitext \(version) (Build \(build))"
    }

    private var feedbackURL: URL {
        var components = URLComponents()
        components.scheme = "mailto"
        components.path = "permitext@gmail.com"
        components.queryItems = [
            URLQueryItem(name: "subject", value: "Permitext feedback — \(appVersionLabel)"),
            URLQueryItem(
                name: "body",
                value: "What happened?\n\nWhat did you expect?\n\n\(appVersionLabel)"
            )
        ]
        return components.url ?? URL(string: "mailto:permitext@gmail.com")!
    }

    private var collapseProgress: CGFloat {
        min(max(-scrollOffset / 64, 0), 1)
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { scrollProxy in
            ScrollView {
                GeometryReader { proxy in
                    Color.clear
                        .preference(key: CodeScrollOffsetPreferenceKey.self, value: proxy.frame(in: .named("settingsScroll")).minY)
                }
                .frame(height: 0)

                VStack(alignment: .leading, spacing: CodeScreenMetrics.contentSpacingBelowTitle) {
                    CodeScreenTitle(title: "Account", collapseProgress: collapseProgress)
                        .offset(y: 8)

                    CodeSurface(accent: settingsChromeColor, showsBorder: false) {
                        planCard
                    }
                    .id(SettingsSection.plan)

                    CodeSurface(accent: settingsChromeColor, showsBorder: false) {
                        accountCard
                    }
                    .id(SettingsSection.account)

                    CodeSurface(accent: settingsChromeColor, showsBorder: false) {
                        themePreviewCard

                        CodeHairline()

                        fontSizeSlider

                        CodeHairline()

                        lineSpacingSlider
                    }

                    CodeSurface(accent: settingsChromeColor, showsBorder: false) {
                        dataAndStorageCard
                    }

                    Text("permitext is an unofficial reference tool. Verify legal, permitting, design, and construction decisions against enacted code text and agency guidance.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)

                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            Link("Privacy", destination: privacyPolicyURL)
                            Text("·")
                            Link("Terms", destination: termsURL)
                            Text("·")
                            Link("Subscriptions & Refunds", destination: refundsURL)
                        }
                        HStack(spacing: 8) {
                            Link("Support", destination: supportURL)
                            Text("·")
                            Link("Send feedback / Report a problem", destination: feedbackURL)
                        }
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

                    Text(appVersionLabel)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 4)

                }
                .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
                .padding(.top, CodeScreenMetrics.scrollMeasuredTitleTopPadding)
                .padding(.bottom, tabBarClearance)
            }
            .overlay(alignment: .top) {
                CodeTopContentFade(title: "Account", progress: collapseProgress)
            }
            .background(CodeAppBackdrop(accent: settingsChromeColor).ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .tint(Color.appChrome)
            .task(id: initialSection) {
                guard let initialSection, !didScrollToInitialSection else { return }
                didScrollToInitialSection = true
                await Task.yield()
                scrollProxy.scrollTo(initialSection, anchor: .top)
            }
            }
        }
        .coordinateSpace(name: "settingsScroll")
        .onPreferenceChange(CodeScrollOffsetPreferenceKey.self) { scrollOffset = $0 }
        .onChange(of: library.folders.map(\.id)) { _, folderIDs in
            selectedProjectIDs.formIntersection(folderIDs)
        }
        .onChange(of: library.privateSessionID) { _, _ in deletionVerification.invalidateIfNeeded() }
        .onChange(of: clerk?.session?.id) { _, _ in deletionVerification.invalidateIfNeeded() }
        .onChange(of: showsAccountDeleteWarning) { _, visible in
            if !visible { deletionVerification.cancel() }
        }
        .onDisappear { deletionVerification.cancel() }
        // Keep the cleanup surface mounted after backend deletion signs out.
        .sheet(isPresented: $showsAccountDeleteWarning) {
            accountDeletePopover
                .presentationDetents([.large])
                .interactiveDismissDisabled(accountDeletionOperationInProgress && !deletionVerification.isPresented)
        }
    }

    private var planCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            CodeEyebrow(text: "Plan", accent: settingsChromeColor)

            VStack(alignment: .leading, spacing: 8) {
                Text("Current plan")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)

                HStack(spacing: 10) {
                    Label(currentPlanTitle, systemImage: "checkmark.circle.fill")
                        .font(.headline)
                        .foregroundStyle(.primary)

                    Spacer(minLength: 12)

                    Text("Active")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.appChrome)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(
                            Capsule(style: .continuous)
                                .fill(Color.appChrome.opacity(0.14))
                        )
                }

                Text(planSummaryText)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                Text("Billing: \(library.planBillingLabel)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)

            if library.currentPlan == .free {
                Button {
                    Task { await library.requestProSubscriptionStore(clerk: clerk) }
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
                .disabled(library.isStoreKitBusy)
                .opacity(library.isStoreKitBusy ? 0.55 : 1)

                if let operationMessage = library.storeKitOperationMessage {
                    Text(operationMessage)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(library.currentPlan == .pro ? Color.green : Color.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("storekit-operation-message")
                }

                Text("No trial. Renews monthly until canceled. To stop the next charge, cancel before the next monthly renewal using Manage Subscription on web or Apple subscription settings on iOS. Pro includes unlimited saved sections and notes, Projects, Notebook, Report, professional exports, offline access, and 100 AI-assisted Research turns each month. Code reading and search remain free.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                Text("By upgrading, you agree to the [Terms](https://permitext.com/terms) and [Subscription and Refund Policy](https://permitext.com/refunds).")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if library.currentPlan == .pro {
                researchTurnPurchaseSection
            }

            if library.currentPlan == .pro,
               library.hasAppleManagedBillingForAccountDeletion {
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

            if library.canRequestAppleRefund {
                Button {
                    Task { @MainActor in
                        guard let transactionID = await library.prepareAppleRefundRequest() else { return }
                        guard let windowScene = UIApplication.shared.connectedScenes
                            .compactMap({ $0 as? UIWindowScene })
                            .first(where: { $0.activationState == .foregroundActive })
                        else {
                            library.handleAppleRefundRequestPresentationFailure()
                            return
                        }
                        do {
                            let status = try await StoreKit.Transaction.beginRefundRequest(
                                for: transactionID,
                                in: windowScene
                            )
                            library.handleAppleRefundRequestStatus(status)
                        } catch {
                            library.handleAppleRefundRequestError(error)
                        }
                    }
                } label: {
                    Text("Request Refund from Apple")
                        .font(.footnote.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            Capsule(style: .continuous)
                                .fill(.secondary.opacity(0.12))
                        )
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .contentShape(Rectangle())
                .disabled(library.isStoreKitBusy)
                .opacity(library.isStoreKitBusy ? 0.55 : 1)
                .accessibilityIdentifier("request-apple-refund")

                Text("Apple reviews refund eligibility. Opening the form does not cancel the subscription or issue a refund; a request is sent only if you submit Apple's form.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button {
                Task { await library.restorePurchases(clerk: clerk) }
            } label: {
                Text(library.isStoreKitRestoreInProgress ? "Checking purchases..." : "Restore Purchases")
                    .font(.footnote.weight(.semibold))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
            .disabled(library.isStoreKitBusy)

            #if DEBUG
            Text(library.accountSyncDebugSummary)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Text(storeKitDebugText)
                .font(.caption2)
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

    private var researchTurnPurchaseSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Divider()

            Text("Research turns")
                .font(.subheadline.weight(.semibold))

            Text(library.researchTurnAllowanceSummary)
                .font(.headline)
                .foregroundStyle(.primary)

            if !library.availableResearchTurnPacks.isEmpty {
                Text("Need more Research? Additional turns do not expire and are used after the monthly included turns.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                ForEach(library.availableResearchTurnPacks) { pack in
                    Button {
                        Task { await library.purchaseResearchTurnPack(pack, using: purchase) }
                    } label: {
                        HStack {
                            Text("Buy \(pack.turns) more turns")
                            Spacer()
                            Text(library.researchTurnDisplayPrice(for: pack) ?? "")
                        }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .foregroundStyle(Color.black)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 12)
                        .background(Color.white.opacity(0.96), in: Capsule(style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(library.isResearchTurnPurchaseBusy)
                    .opacity(library.isResearchTurnPurchaseBusy ? 0.6 : 1)
                }
            }

            if library.isResearchTurnPurchaseBusy {
                HStack(spacing: 8) {
                    ProgressView()
                    Text("Contacting Apple...")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            if let message = library.researchTurnPurchaseMessage {
                Text(message)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var accountCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            CodeEyebrow(text: "Account", accent: settingsChromeColor)

            Text(accountSummaryText)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Label(library.syncStatusTitle, systemImage: syncStatusSystemImage)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(syncStatusColor)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color.primary.opacity(0.06))
                )
                .accessibilityLabel("Sync status: \(library.syncStatusTitle)")

            if let message = library.accountAuthenticationMessage {
                Label(
                    message,
                    systemImage: library.isAccountBusy ? "hourglass" : "exclamationmark.triangle.fill"
                )
                .font(.footnote.weight(.medium))
                .foregroundStyle(library.isAccountBusy ? Color.secondary : Color.red)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityLabel(message)
            }

            if library.signedInAccount == nil, clerk != nil {
                Button {
                    library.requestClerkAuthentication()
                } label: {
                    Label("Sign in or create an account", systemImage: "person.crop.circle.badge.checkmark")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .foregroundStyle(upgradeButtonForegroundColor)
                        .background(upgradeButtonBackgroundColor, in: Capsule(style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(library.isAccountBusy)
                .opacity(library.isAccountBusy ? 0.55 : 1)

            } else if library.signedInAccount == nil {
                SignInWithAppleButton(.signIn) { request in
                    request.requestedScopes = [.fullName, .email]
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

            } else if let account = library.signedInAccount {
                VStack(spacing: 10) {
                    signedInAccountIdentityCard(account)

                    if clerk != nil, account.authProvider != .clerk {
                        Button {
                            library.requestClerkAuthentication()
                        } label: {
                            Label("Connect email, Apple, Google, or Microsoft", systemImage: "person.crop.circle.badge.plus")
                                .font(.subheadline.weight(.semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .foregroundStyle(Color.appChrome)
                                .background(
                                    Capsule(style: .continuous)
                                        .fill(Color.appChrome.opacity(0.10))
                                )
                        }
                        .buttonStyle(.plain)
                        .disabled(library.isAccountBusy)
                    }

                    if !library.userContentSyncConflicts.isEmpty {
                        syncConflictReviewCard
                    }

                    Button {
                        if library.requiresSignOutConfirmation {
                            showsSignOutWarning = true
                        } else {
                            signOut()
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
                        resetAccountDeletionFlow()
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
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func signedInAccountIdentityCard(_ account: SignedInAccount) -> some View {
        accountIdentityRow(
            label: "Signed in as",
            value: signedInPrimaryEmail(for: account) ?? "Email unavailable",
            systemImage: "envelope.fill"
        )
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.primary.opacity(0.06))
        )
    }

    private func accountIdentityRow(
        label: String,
        value: String,
        systemImage: String
    ) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: systemImage)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: 20, height: 20)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.primary)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(value)")
    }

    private func signedInPrimaryEmail(for account: SignedInAccount) -> String? {
        if let email = normalizedAccountIdentityValue(account.email) {
            return email
        }
        guard account.authProvider == .clerk,
              clerk?.user?.id == account.authProviderUserID
        else {
            return nil
        }
        return normalizedAccountIdentityValue(clerk?.user?.primaryEmailAddress?.emailAddress)
    }

    private func normalizedAccountIdentityValue(_ value: String?) -> String? {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }

    private var planSummaryText: String {
        if library.currentPlan == .pro {
            if library.isStoreKitTestBackendLinked {
                return "Pro (Test) is linked to this Permitext account in isolated Apple Sandbox staging. No real charge was made."
            }
            if library.isStoreKitTestProActive {
                return "Pro (Test) is active only on this device. Use an account grant to test Pro across iOS and web."
            }
            if library.currentEntitlementSource == .lifetimeGrant {
                return "Lifetime Pro is active, including Research. This gifted account does not need an App Store subscription."
            }
            return "Pro is active. Projects, Notebook, Report, professional exports, offline access, and AI-assisted Research are unlocked."
        }
        return "Reading and search are available anytime, with recent history, 25 saved sections, 10 notes, continuity, and cross-device sync."
    }

    private var currentPlanTitle: String {
        guard library.currentPlan == .pro else { return "Free" }
        if library.isStoreKitTestTransaction { return "Pro (Test)" }
        if library.currentEntitlementSource == .lifetimeGrant { return "Lifetime Pro" }
        return "Pro"
    }

    private var accountSummaryText: String {
        guard let account = library.signedInAccount else {
            return "Use passwordless email, Apple, Google, or Microsoft. New users create an account during sign-in, then saved sections, notes, and Projects can sync across devices."
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

        }
        .frame(maxWidth: .infinity, alignment: .leading)
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

    private var dataAndStorageCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            CodeEyebrow(text: "Data & Storage", accent: settingsChromeColor)

            projectManagementSection

            CodeHairline()

            settingsDangerButton(
                title: "Clear All Projects and Saved Collections",
                systemImage: "minus.circle",
                action: .clearProjects,
                disabled: library.folders.isEmpty
            )

            CodeHairline()

            settingsDangerButton(
                title: "Clear Recent Searches",
                systemImage: "magnifyingglass.circle",
                action: .clearSearches
            )

            CodeHairline()

            settingsDangerButton(
                title: "Clear All Saved Passages",
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

    private var projectManagementSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                Text("Projects and saved collections")
                    .font(.subheadline.weight(.semibold))

                Spacer(minLength: 0)

                Button(selectedProjectIDs.count == library.folders.count && !library.folders.isEmpty ? "Clear All" : "Select All") {
                    if selectedProjectIDs.count == library.folders.count {
                        selectedProjectIDs.removeAll()
                    } else {
                        selectedProjectIDs = Set(library.folders.map(\.id))
                    }
                }
                .buttonStyle(.plain)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
                .disabled(library.folders.isEmpty)
            }

            if library.folders.isEmpty {
                Text("No Projects or saved collections yet.")
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
                    Text("\(folder.folderType == .project ? "Project" : "Saved collection") · \(count == 1 ? "1 saved item" : "\(count) saved items")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
            .padding(.vertical, 9)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(folder.folderType == .project ? "Project" : "Saved collection") \(folder.name), \(isSelected ? "selected" : "not selected")")
    }

    private var projectDeletePopover: some View {
        let selectedFolders = library.folders.filter { selectedProjectIDs.contains($0.id) }
        let projectCount = selectedFolders.filter { $0.folderType == .project }.count
        let collectionCount = selectedFolders.filter { $0.folderType == .reference }.count
        let deletionDescription = folderDeletionDescription(
            projectCount: projectCount,
            collectionCount: collectionCount
        )
        return VStack(alignment: .leading, spacing: 18) {
            Text("Delete selected items?")
                .font(.title3.weight(.semibold))
                .foregroundStyle(.primary)

            Text("This will permanently delete \(deletionDescription) from every synced device. Saved items will keep their bookmarks. This cannot be undone.")
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            Button("Delete Selected", role: .destructive) {
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

    private func folderDeletionDescription(projectCount: Int, collectionCount: Int) -> String {
        let parts = [
            projectCount > 0 ? "\(projectCount) \(projectCount == 1 ? "Project" : "Projects")" : nil,
            collectionCount > 0 ? "\(collectionCount) saved \(collectionCount == 1 ? "collection" : "collections")" : nil
        ].compactMap { $0 }
        return parts.isEmpty ? "the selected items" : parts.joined(separator: " and ")
    }

    private var accountDeletePopover: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text(accountDeletionHasStarted ? "Deleting Permitext account" : "Delete Permitext account?")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.primary)

                if deletionVerification.isPresented {
                    AccountDeletionVerificationView(model: deletionVerification)
                } else if accountDeletionHasStarted {
                    accountDeletionProgress
                } else {
                    accountDeletionConfirmationView
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var accountDeletionBillingMessage: String {
        if library.hasAppleManagedBillingForAccountDeletion &&
            library.hasWebManagedBillingForAccountDeletion {
            return "Your Stripe subscription will be canceled first. Deleting Permitext does not cancel your App Store subscription; Apple may continue billing you."
        }
        if library.hasAppleManagedBillingForAccountDeletion {
            return "Deleting Permitext does not cancel your App Store subscription. Apple may continue billing you."
        }
        if library.hasWebManagedBillingForAccountDeletion {
            return "Your Stripe subscription will be canceled first. If cancellation cannot be confirmed, nothing will be deleted."
        }
        if library.currentEntitlementSource == .lifetimeGrant {
            return "Your Lifetime Pro grant will be permanently removed."
        }
        return "No recurring Permitext subscription is linked to this account."
    }

    @ViewBuilder
    private var accountDeletionConfirmationView: some View {
        if let accountDeletionPreflightMessage {
            Text(accountDeletionPreflightMessage)
                .font(.footnote).foregroundStyle(.red)
                .fixedSize(horizontal: false, vertical: true)
        }
        Text("This is permanent and cannot be undone.")
            .font(.body.weight(.semibold))
            .foregroundStyle(.red)

        accountDeletionDisclosure("Permitext will delete", items: [
            "Your Permitext account and sign-in sessions",
            "Saved passages and notes",
            "Projects and their stored content",
            "Research history and reports",
            "Private images and synchronized data",
            "Unused additional Research turns (they are forfeited and are not automatically refunded)",
            "Entitlements and organizations you own",
            "Permitext data stored on this device"
        ])

        VStack(alignment: .leading, spacing: 8) {
            Text("Billing")
                .font(.subheadline.weight(.semibold))
            Text(accountDeletionBillingMessage)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if library.hasAppleManagedBillingForAccountDeletion {
                Button {
                    openURL(subscriptionManagementURL)
                } label: {
                    Label("Manage Apple Subscription", systemImage: "arrow.up.right.square")
                }
                .buttonStyle(.plain)
                .foregroundStyle(Color.appChrome)

                Toggle(
                    "I understand that deleting Permitext does not cancel App Store billing.",
                    isOn: $accountDeletionAppleAcknowledged
                )
                .font(.footnote)
                .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(12)
        .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 12, style: .continuous))

        accountDeletionDisclosure("Permitext will not delete", items: [
            "Your Google/Gmail, Apple, or Microsoft account",
            "Records retained by Apple, Stripe, or Clerk for billing or legal purposes",
            "A minimal purchase-ownership record used to prevent fraud and restore qualifying purchases"
        ])

        VStack(alignment: .leading, spacing: 8) {
            Text("Type DELETE to confirm")
                .font(.subheadline.weight(.semibold))
            TextField("DELETE", text: $accountDeletionConfirmation)
                .accessibilityIdentifier("account-deletion-confirmation")
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)
        }

        HStack {
            Button("Cancel") {
                showsAccountDeleteWarning = false
            }
            .buttonStyle(.plain)

            Spacer()

            Button("Delete Account", role: .destructive) {
                Task { await beginAccountDeletion() }
            }
            .accessibilityIdentifier("account-deletion-submit")
            .buttonStyle(.borderedProminent)
            .tint(.red)
            .disabled(
                accountDeletionConfirmation.trimmingCharacters(in: .whitespacesAndNewlines) != "DELETE" ||
                    (library.hasAppleManagedBillingForAccountDeletion && !accountDeletionAppleAcknowledged) ||
                    library.isAccountBusy || accountDeletionOperationInProgress
            )
        }
    }

    private func accountDeletionDisclosure(_ title: String, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            ForEach(items, id: \.self) { item in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("•")
                    Text(item)
                }
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var accountDeletionProgress: some View {
        Text("Keep this window open until every stage finishes.")
            .font(.footnote)
            .foregroundStyle(.secondary)

        VStack(spacing: 10) {
            ForEach(accountDeletionStages) { stage in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(stage.title)
                            .font(.subheadline.weight(.medium))
                        Spacer()
                        Text(stage.status.rawValue)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(stage.status.color)
                    }
                    if !stage.detail.isEmpty {
                        Text(stage.detail)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(12)
                .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }

        if let accountDeletionResultMessage {
            Text(accountDeletionResultMessage)
                .font(.footnote)
                .foregroundStyle(accountDeletionDeviceError == nil && accountDeletionIdentityError == nil ? Color.secondary : Color.red)
                .fixedSize(horizontal: false, vertical: true)

            if accountDeletionDeviceError != nil || accountDeletionIdentityError != nil {
                Button("Retry cleanup") {
                    Task { await retryAccountDeletionCleanup() }
                }
                .buttonStyle(.bordered)
                .disabled(library.isAccountBusy || accountDeletionOperationInProgress)
            } else if library.signedInAccount != nil {
                Button("Retry deletion") {
                    Task { await beginAccountDeletion() }
                }
                .buttonStyle(.bordered)
                .disabled(library.isAccountBusy || accountDeletionOperationInProgress)
            }

            Link("Contact Support", destination: URL(string: "mailto:permitext@gmail.com?subject=Account%20deletion%20cleanup")!)
                .font(.subheadline.weight(.medium))

            Button("Done") {
                showsAccountDeleteWarning = false
            }
            .buttonStyle(.borderedProminent)
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    private func resetAccountDeletionFlow() {
        deletionVerification.cancel()
        deletionClerkSessionID = nil
        accountDeletionPreflightMessage = nil
        accountDeletionConfirmation = ""
        accountDeletionAppleAcknowledged = false
        accountDeletionStages = AccountDeletionStage.initial
        accountDeletionHasStarted = false
        accountDeletionResultMessage = nil
        accountDeletionDeviceError = nil
        accountDeletionIdentityError = nil
        deletedAccountForCleanup = nil
    }

    private func updateAccountDeletionStage(
        _ id: String,
        status: AccountDeletionStageStatus,
        detail: String = ""
    ) {
        guard let index = accountDeletionStages.firstIndex(where: { $0.id == id }) else { return }
        accountDeletionStages[index].status = status
        accountDeletionStages[index].detail = detail
    }

    @MainActor
    private func beginAccountDeletion() async {
        guard !accountDeletionOperationInProgress, let account = library.signedInAccount,
              let identity = library.privateRequestIdentity else { return }
        accountDeletionOperationInProgress = true
        accountDeletionPreflightMessage = nil
        defer { accountDeletionOperationInProgress = false }
        do {
            if account.authProvider == .clerk {
                guard let clerk, let user = clerk.user, let session = clerk.session,
                      user.id == account.authProviderUserID, user.deleteSelfEnabled else {
                    throw AccountDeletionVerificationError.unavailable
                }
                deletionClerkSessionID = session.id
                try await deletionVerification.verify(
                    client: .clerk(session: session, hasSecondFactor: user.twoFactorEnabled),
                    isCurrent: {
                        library.privateRequestIdentity == identity &&
                        clerk.user?.id == account.authProviderUserID && clerk.session?.id == session.id
                    }
                )
            }
            guard library.privateRequestIdentity == identity, !Task.isCancelled else {
                throw AccountDeletionVerificationError.identityChanged
            }
            if account.authProvider == .clerk {
                guard clerk?.user?.id == account.authProviderUserID,
                      clerk?.session?.id == deletionClerkSessionID else {
                    throw AccountDeletionVerificationError.identityChanged
                }
            }
        } catch {
            if library.privateRequestIdentity == identity {
                accountDeletionPreflightMessage = error is CancellationError
                    ? "Identity verification was canceled. No account data was deleted."
                    : "\(error.localizedDescription) No account data was deleted."
                library.statusMessage = accountDeletionPreflightMessage
            }
            return
        }
        deletedAccountForCleanup = account
        accountDeletionHasStarted = true
        accountDeletionResultMessage = nil
        updateAccountDeletionStage("billing", status: .active)
        updateAccountDeletionStage("data", status: .active)
        updateAccountDeletionStage("device", status: .waiting)
        updateAccountDeletionStage("identity", status: .waiting)

        guard let result = await library.deleteAccount() else {
            let billingCompletedBeforeFailure = library.accountDeletionServerCode.map {
                ["PRIVATE_ASSET_DELETION_FAILED", "ACCOUNT_DATA_DELETION_FAILED"].contains($0)
            } ?? false
            updateAccountDeletionStage(
                "billing",
                status: billingCompletedBeforeFailure
                    ? (library.hasWebManagedBillingForAccountDeletion ? .complete : .skipped)
                    : .failed,
                detail: billingCompletedBeforeFailure
                    ? (library.hasWebManagedBillingForAccountDeletion ? "Stripe cancellation completed before data deletion failed." : "No Stripe subscription was linked.")
                    : "Stripe cancellation was not confirmed or the deletion request did not finish."
            )
            updateAccountDeletionStage("data", status: .failed, detail: library.statusMessage ?? "Permitext data deletion was not confirmed.")
            updateAccountDeletionStage("device", status: .skipped, detail: "Not started because server deletion did not finish.")
            updateAccountDeletionStage("identity", status: .skipped, detail: "Not started because server deletion did not finish.")
            accountDeletionResultMessage = library.statusMessage ?? "Permitext could not complete account deletion. Nothing on this device was cleared."
            return
        }

        let stripe = result.response.billingCancellation?.stripe
        updateAccountDeletionStage(
            "billing",
            status: stripe?.status == "canceled" ? .complete : .skipped,
            detail: stripe?.status == "canceled" ? "Stripe confirmed cancellation." : "No Stripe subscription was linked."
        )
        updateAccountDeletionStage(
            "data",
            status: .complete,
            detail: "Permitext data and \(result.response.deletedPrivateAssetCount) private images were deleted."
        )
        accountDeletionDeviceError = result.deviceCleanupError
        updateAccountDeletionStage(
            "device",
            status: result.deviceCleanupError == nil ? .complete : .failed,
            detail: result.deviceCleanupError ?? library.deletedAccountDeviceCleanupNotice ?? "Account-scoped Permitext data stored on this device was cleared."
        )

        await removeAccountDeletionIdentity(account: account)
        finishAccountDeletionResult()
    }

    @MainActor
    private func removeAccountDeletionIdentity(account: SignedInAccount) async {
        guard account.authProvider == .clerk else {
            accountDeletionIdentityError = nil
            updateAccountDeletionStage("identity", status: .skipped, detail: "No separate Clerk identity needed removal.")
            return
        }
        updateAccountDeletionStage("identity", status: .active)
        do {
            guard let clerk, let user = clerk.user else {
                throw NSError(
                    domain: "PermitextAccountDeletion",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "The signed-in Clerk identity is unavailable."]
                )
            }
            guard user.id == account.authProviderUserID else {
                throw NSError(domain: "PermitextAccountDeletion", code: 2,
                    userInfo: [NSLocalizedDescriptionKey: "The active sign-in identity changed. Only the original account’s identity may be removed."])
            }
            guard let session = clerk.session, session.id == deletionClerkSessionID,
                  library.signedInAccount == nil else {
                throw AccountDeletionVerificationError.identityChanged
            }
            let cleanupSessionID = library.privateSessionID
            // Reverification can expire while backend/device cleanup is running.
            // Retry only the captured Clerk deletion, never the backend deletion.
            do {
                try await user.delete()
            } catch {
                guard (error as? ClerkAPIError)?.code == "session_reverification_required" else { throw error }
                try await deletionVerification.verify(
                    client: .clerk(session: session, hasSecondFactor: user.twoFactorEnabled),
                    isCurrent: {
                        library.signedInAccount == nil && library.privateSessionID == cleanupSessionID &&
                        clerk.user?.id == account.authProviderUserID &&
                        clerk.session?.id == session.id
                    }
                )
                guard library.signedInAccount == nil, library.privateSessionID == cleanupSessionID,
                      clerk.user?.id == user.id,
                      clerk.session?.id == session.id, !Task.isCancelled else {
                    throw AccountDeletionVerificationError.identityChanged
                }
                try await user.delete()
            }
            accountDeletionIdentityError = nil
            updateAccountDeletionStage("identity", status: .complete, detail: "The Permitext Clerk sign-in identity was removed.")
        } catch {
            accountDeletionIdentityError = error.localizedDescription
            updateAccountDeletionStage("identity", status: .failed, detail: error.localizedDescription)
        }
    }

    @MainActor
    private func retryAccountDeletionCleanup() async {
        guard !accountDeletionOperationInProgress, let account = deletedAccountForCleanup else { return }
        accountDeletionOperationInProgress = true
        defer { accountDeletionOperationInProgress = false }
        if accountDeletionDeviceError != nil {
            updateAccountDeletionStage("device", status: .active)
            accountDeletionDeviceError = library.retryDeletedAccountDeviceCleanup(accountID: account.appUserID)
            updateAccountDeletionStage(
                "device",
                status: accountDeletionDeviceError == nil ? .complete : .failed,
                detail: accountDeletionDeviceError ?? library.deletedAccountDeviceCleanupNotice ?? "Account-scoped Permitext data stored on this device was cleared."
            )
        }
        if accountDeletionIdentityError != nil {
            await removeAccountDeletionIdentity(account: account)
        }
        finishAccountDeletionResult()
    }

    private func finishAccountDeletionResult() {
        if accountDeletionDeviceError == nil && accountDeletionIdentityError == nil {
            accountDeletionResultMessage = "Your Permitext account, synchronized data, device data, and Permitext sign-in identity were handled as shown above."
        } else {
            accountDeletionResultMessage = "Permitext data was deleted, but the stages marked Needs attention remain. Retry cleanup or contact support."
        }
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

            Text("\(detail) Your work remains on this iPhone under this account and reappears when this same account signs in again. It will not be shown to another account.")
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            if conflictCount > 0 {
                Button("Review Conflicts") {
                    showsSignOutWarning = false
                }
                .buttonStyle(.borderedProminent)
            }

            Button("Sign Out Anyway", role: .destructive) {
                showsSignOutWarning = false
                signOut()
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

    private func signOut() {
        Task {
            await library.signOut(clerk: clerk)
        }
    }

    private var syncConflictReviewCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Label("Sync Conflicts", systemImage: "arrow.triangle.2.circlepath")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.orange)

                Spacer(minLength: 0)

                Text("\(library.userContentSyncConflicts.count)")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.orange)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(.orange.opacity(0.14), in: Capsule(style: .continuous))
            }

            Text("Choose which copy to keep for each item before signing out. Resolve important work one item at a time.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 0) {
                ForEach(Array(library.userContentSyncConflicts.enumerated()), id: \.element.id) { index, conflict in
                    syncConflictRow(conflict)

                    if index < library.userContentSyncConflicts.count - 1 {
                        CodeHairline()
                    }
                }
            }

            if library.isAccountBusy {
                HStack(spacing: 8) {
                    ProgressView()
                        .controlSize(.small)
                    Text("Resolving conflict…")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.orange.opacity(colorScheme == .dark ? 0.12 : 0.08), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .popover(item: $pendingSyncConflictResolution, attachmentAnchor: .rect(.bounds), arrowEdge: .bottom) { request in
            syncConflictResolutionPopover(request)
                .presentationCompactAdaptation(.popover)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Sync conflicts requiring review")
    }

    private func syncConflictRow(_ conflict: UserContentSyncConflict) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label {
                VStack(alignment: .leading, spacing: 2) {
                    Text(conflict.displayTitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)

                    Text("Record \(conflict.recordReference)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            } icon: {
                Image(systemName: conflict.systemImage)
                    .foregroundStyle(.orange)
            }

            Text(conflict.message)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) {
                    syncConflictChoiceButtons(conflict)
                }

                VStack(spacing: 8) {
                    syncConflictChoiceButtons(conflict)
                }
            }
        }
        .padding(.vertical, 10)
    }

    @ViewBuilder
    private func syncConflictChoiceButtons(_ conflict: UserContentSyncConflict) -> some View {
        Button("Keep This iPhone") {
            pendingSyncConflictResolution = PendingSyncConflictResolution(conflict: conflict, keepLocal: true)
        }
        .buttonStyle(.borderedProminent)
        .disabled(library.isAccountBusy)

        Button("Use Server Copy") {
            pendingSyncConflictResolution = PendingSyncConflictResolution(conflict: conflict, keepLocal: false)
        }
        .buttonStyle(.bordered)
        .disabled(library.isAccountBusy)
    }

    private func syncConflictResolutionPopover(_ request: PendingSyncConflictResolution) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(request.keepLocal ? "Keep this iPhone’s copy?" : "Use the server copy?")
                .font(.title3.weight(.semibold))
                .foregroundStyle(.primary)

            Text(request.keepLocal
                ? "Permitext will retry this iPhone’s \(request.conflict.displayTitle.lowercased()) and replace the server copy if the server accepts it."
                : "Permitext will discard this iPhone’s conflicting change and apply the current server copy. This local change cannot be recovered afterward."
            )
            .font(.body)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)

            Button(request.keepLocal ? "Keep This iPhone" : "Use Server Copy", role: request.keepLocal ? nil : .destructive) {
                pendingSyncConflictResolution = nil
                Task {
                    await library.resolveUserContentSyncConflict(request.conflict, keepLocal: request.keepLocal)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(request.keepLocal ? Color.appChrome : .red)

            Button("Cancel", role: .cancel) {
                pendingSyncConflictResolution = nil
            }
            .buttonStyle(.plain)
        }
        .frame(width: 320, alignment: .leading)
        .padding(24)
    }

    private var previewFontSize: CGFloat {
        CGFloat(library.readerTheme.fontSize)
    }

    private func settingsDangerButton(
        title: String,
        systemImage: String,
        action: ClearSettingsAction,
        disabled: Bool = false
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
        .disabled(disabled)
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

            Button(action.confirmationButtonTitle, role: .destructive) {
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
        case .clearProjects:
            let deletedIDs = library.deleteFolders(ids: Set(library.folders.map(\.id)))
            selectedProjectIDs.subtract(deletedIDs)
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

struct ProSubscriptionStoreView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.purchase) private var purchase
    @Environment(\.colorScheme) private var colorScheme
    @State private var policiesAccepted = false
    private let defaultTermsURL = URL(string: "https://permitext.com/terms")!
    private let defaultPrivacyPolicyURL = URL(string: "https://permitext.com/privacy")!
    private let defaultRefundsURL = URL(string: "https://permitext.com/refunds")!

    private var termsURL: URL {
        URL(string: library.currentPolicyConfiguration?.documents?.terms.url ?? "") ?? defaultTermsURL
    }

    private var privacyPolicyURL: URL {
        URL(string: library.currentPolicyConfiguration?.documents?.privacy.url ?? "") ?? defaultPrivacyPolicyURL
    }

    private var refundsURL: URL {
        URL(string: library.currentPolicyConfiguration?.documents?.subscriptionsAndRefunds.url ?? "") ?? defaultRefundsURL
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 34, weight: .semibold))
                        .foregroundStyle(Color.appChrome)

                    Text("Permitext Pro")
                        .font(.title2.weight(.bold))

                    Text("Unlimited saved sections and notes, Projects, Notebook, Report, professional exports, offline access, and 100 AI-assisted Research turns each month.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)

                    Text("No trial. Renews monthly until canceled. To stop the next charge, cancel before the next monthly renewal using Manage Subscription on web or Apple subscription settings on iOS. Code reading and search remain free.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Permitext Pro Monthly")
                            .font(.headline)
                        Text("\(library.proProductDisplayPrice ?? "$20.00")/month")
                            .font(.title3.weight(.semibold))
                        Text("Pro: unlimited saves, notes, Projects, Notebook, Report, exports, continuity, sync, and 100 AI-assisted Research turns each month.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(18)
                    .background(Color.primary.opacity(0.08), in: RoundedRectangle(cornerRadius: 22, style: .continuous))

                    VStack(alignment: .leading, spacing: 10) {
                        Toggle("I have reviewed and agree to the current policies.", isOn: $policiesAccepted)
                            .font(.subheadline.weight(.medium))

                        HStack(spacing: 5) {
                            Link("Terms", destination: termsURL)
                            Text("·")
                                .foregroundStyle(.secondary)
                            Link("Privacy", destination: privacyPolicyURL)
                            Text("·")
                                .foregroundStyle(.secondary)
                            Link("Subscription and Refunds", destination: refundsURL)
                        }
                        .font(.caption)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 16, style: .continuous))

                    Button {
                        Task {
                            await library.purchasePro(
                                using: purchase,
                                acceptedPolicyVersions: policiesAccepted
                                    ? library.currentPolicyConfiguration?.versions
                                    : nil
                            )
                        }
                    } label: {
                        HStack(spacing: 10) {
                            if library.isStoreKitBusy && !library.isStoreKitRestoreInProgress {
                                ProgressView()
                                    .tint(subscribeButtonForegroundColor)
                            }
                            Text(library.isStoreKitBusy ? "Contacting Apple..." : "Subscribe")
                                .font(.headline)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .contentShape(Capsule(style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(subscribeButtonForegroundColor)
                    .background(subscribeButtonBackgroundColor, in: Capsule(style: .continuous))
                    .disabled(library.isStoreKitBusy || !policiesAccepted)
                    .opacity(library.isStoreKitBusy || !policiesAccepted ? 0.7 : 1)

                    if let operationMessage = library.storeKitOperationMessage {
                        Text(operationMessage)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(library.currentPlan == .pro ? Color.green : Color.primary)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Button {
                        Task {
                            await library.restorePurchases()
                        }
                    } label: {
                        HStack(spacing: 10) {
                            if library.isStoreKitRestoreInProgress {
                                ProgressView()
                            }
                            Text("Restore Subscription")
                                .font(.headline)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .contentShape(Capsule(style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.primary)
                    .background(Color.primary.opacity(0.10), in: Capsule(style: .continuous))
                    .disabled(library.isStoreKitBusy)
                    .opacity(library.isStoreKitBusy ? 0.7 : 1)
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 28)
            }
            .navigationTitle("Upgrade to Pro")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        library.dismissProSubscriptionStore()
                        dismiss()
                    }
                }
            }
        }
    }

    private var subscribeButtonBackgroundColor: Color {
        if library.isStoreKitBusy || !policiesAccepted {
            return Color(uiColor: .tertiarySystemGroupedBackground)
        }
        return colorScheme == .dark ? Color.white.opacity(0.96) : Color.appChrome
    }

    private var subscribeButtonForegroundColor: Color {
        if library.isStoreKitBusy || !policiesAccepted {
            return Color.secondary
        }
        return colorScheme == .dark ? Color.black.opacity(0.9) : Color.white
    }
}

private struct PendingSyncConflictResolution: Identifiable, Equatable {
    let conflict: UserContentSyncConflict
    let keepLocal: Bool

    var id: String {
        "\(conflict.id):\(keepLocal ? "local" : "server")"
    }
}

private enum ClearSettingsAction: Identifiable, Equatable {
    case clearProjects
    case clearSearches
    case clearBookmarks
    case clearNotes

    var id: String { buttonTitle }

    var buttonTitle: String {
        switch self {
        case .clearProjects:
            return "Clear All Projects and Saved Collections"
        case .clearSearches:
            return "Clear Recent Searches"
        case .clearBookmarks:
            return "Clear All Saved Passages"
        case .clearNotes:
            return "Clear All Notes"
        }
    }

    var confirmationButtonTitle: String {
        self == .clearProjects ? "Delete All" : buttonTitle
    }

    var confirmationTitle: String {
        switch self {
        case .clearProjects:
            return "Clear all Projects and saved collections?"
        case .clearSearches:
            return "Clear recent searches?"
        case .clearBookmarks:
            return "Clear all Saved passages?"
        case .clearNotes:
            return "Clear all notes?"
        }
    }

    var message: String {
        switch self {
        case .clearProjects:
            return "This permanently deletes all Projects and saved collections from every synced device. Saved items will keep their bookmarks. This cannot be undone."
        case .clearSearches:
            return "This removes the recent-search list for this device."
        case .clearBookmarks:
            return "This removes every passage in Saved and every saved Project evidence item across all code versions. Projects and notes are not affected."
        case .clearNotes:
            return "This removes every note saved for the current code version."
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
