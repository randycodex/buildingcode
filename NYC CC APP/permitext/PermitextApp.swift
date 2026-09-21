import SwiftUI
import UIKit
import os.signpost
import ClerkKit
import ClerkKitUI
import StoreKit

private struct PermitextClerkEnvironmentKey: EnvironmentKey {
    static let defaultValue: Clerk? = nil
}

extension EnvironmentValues {
    var permitextClerk: Clerk? {
        get { self[PermitextClerkEnvironmentKey.self] }
        set { self[PermitextClerkEnvironmentKey.self] = newValue }
    }
}

private struct PermitextClerkAuthenticationView: View {
    var createsAccount = false
    private enum PreparationState {
        case preparing
        case ready
        case failed(String)
    }

    @Environment(Clerk.self) private var clerk
    @Environment(\.dismiss) private var dismiss
    @State private var preparationState: PreparationState = .preparing
    @State private var preparationAttempt = 0
    @State private var staleSessionID: String?
    @State private var switchesAuthenticationMode = false

    private var isCreatingAccount: Bool { createsAccount != switchesAuthenticationMode }

    var body: some View {
        Group {
            switch preparationState {
            case .ready:
                VStack(spacing: 0) {
                    AuthView(mode: isCreatingAccount ? .signUp : .signIn)
                        .id(isCreatingAccount)
                    Button(isCreatingAccount ? "Already have an account? Sign in" : "New to permitext? Create account") {
                        switchesAuthenticationMode.toggle()
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 12)
                    .accessibilityIdentifier("authentication-switch-mode")
                }
                .background(Color(uiColor: .systemBackground))
            case .preparing:
                authenticationPreparationContent()
            case .failed(let message):
                authenticationPreparationContent(message: message)
            }
        }
            .onChange(of: clerk.session?.id) { _, sessionID in
                guard case .ready = preparationState, let sessionID else { return }
                guard sessionID != staleSessionID else {
                    preparationState = .preparing
                    preparationAttempt += 1
                    return
                }
                // A session can exist while verification still needs another step.
                // Let Clerk retain its verification/recovery screen until it is complete.
                guard clerk.isAuthFlowComplete else { return }
                dismiss()
            }
            .task(id: preparationAttempt) {
                await prepareForAuthentication()
            }
    }

    private func authenticationPreparationContent(message: String? = nil) -> some View {
        VStack(spacing: 24) {
            HStack {
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 17, weight: .semibold))
                        .frame(width: 44, height: 44)
                        .codeLiquidGlassCircle()
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close sign-in")
            }
            Spacer()
            Text("permitext")
                .font(.system(size: 38, weight: .semibold, design: .serif))
            if let message {
                Text("Unable to start sign-in")
                    .font(.title2.weight(.semibold))
                Text(message)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Button("Try again") {
                    preparationState = .preparing
                    preparationAttempt += 1
                }
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 50)
                .foregroundStyle(Color(uiColor: .systemBackground))
                .background(Color.primary, in: Capsule())
            } else {
                ProgressView(createsAccount ? "Preparing your account…" : "Preparing secure sign-in…")
            }
            Spacer()
        }
        .padding(24)
        .background(Color(uiColor: .systemBackground))
    }

    private func prepareForAuthentication() async {
        // Give Clerk's persisted client a moment to hydrate so an old session
        // cannot arrive immediately after AuthView is mounted.
        try? await Task.sleep(for: .milliseconds(250))
        guard !Task.isCancelled else { return }
        staleSessionID = clerk.session?.id

        do {
            if clerk.session != nil {
                do {
                    try await clerk.auth.signOut()
                } catch {
                    // Network sign-out can fail while the device is offline.
                    // Clearing Clerk's durable local state is still required
                    // before another account may authenticate.
                    try await Clerk.clearAllKeychainItemsAndWait()
                }
            } else {
                // Also remove a client/session record left by an older build.
                try await Clerk.clearAllKeychainItemsAndWait()
            }

            try? await Task.sleep(for: .milliseconds(150))
            if clerk.session != nil {
                try await Clerk.clearAllKeychainItemsAndWait()
            }
            guard clerk.session == nil else {
                throw PermitextAuthenticationPreparationError.staleSessionRemains
            }
            guard !Task.isCancelled else { return }
            preparationState = .ready
        } catch {
            guard !Task.isCancelled else { return }
            preparationState = .failed(
                "Permitext could not safely clear the previous sign-in. Check your connection and try again."
            )
        }
    }
}

private enum PermitextAuthenticationPreparationError: Error {
    case staleSessionRemains
}

enum PermitextLifecyclePolicy {
    static func isHostedUnitTest(environment: [String: String]) -> Bool {
        environment["XCTestConfigurationFilePath"] != nil
            || environment["XCTestBundlePath"] != nil
            || environment["XCInjectBundleInto"] != nil
    }

    static func runsNormalDebugLifecycle(
        hasPhysicalStressConfiguration: Bool,
        hasPhase3ResearchConfiguration: Bool,
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> Bool {
        !hasPhysicalStressConfiguration
            && !hasPhase3ResearchConfiguration
            && !isHostedUnitTest(environment: environment)
    }
}

@main
struct PermitextApp: App {
    @StateObject private var library: CodeLibraryViewModel
    @Environment(\.scenePhase) private var scenePhase
    @State private var showsLaunchSplash = true
    private let offersFirstUseExperience: Bool
    private let clerk: Clerk?

#if DEBUG
    private let physicalStressConfiguration: NativeReaderPhysicalStressConfiguration?
    private let phase3ResearchConfiguration: Phase3EntitledResearchConfiguration?

    init() {
        clerk = Self.configuredClerkIfAvailable()
        offersFirstUseExperience = PermitextFirstUseGate.evaluateBeforeLibraryStartup()
        if let preparedResearchHarness = Phase3EntitledResearchConfiguration.prepareIfRequested() {
            phase3ResearchConfiguration = preparedResearchHarness.configuration
            physicalStressConfiguration = nil
            _library = StateObject(wrappedValue: preparedResearchHarness.library)
        } else if let preparedStressHarness = NativeReaderPhysicalStressConfiguration.prepareIfRequested() {
            phase3ResearchConfiguration = nil
            physicalStressConfiguration = preparedStressHarness.configuration
            _library = StateObject(wrappedValue: preparedStressHarness.library)
        } else {
            phase3ResearchConfiguration = nil
            physicalStressConfiguration = nil
            if UserDefaults.standard.string(forKey: PermitextBackendConfiguration.apiBaseURLDefaultsKey) == nil {
                PermitextBackendConfiguration.setDebugHTTPBaseURL("https://permitext-sync.vercel.app")
            }
            _library = StateObject(wrappedValue: CodeLibraryViewModel())
        }
        Self.configureTabBarAppearance()
    }
#else
    init() {
        clerk = Self.configuredClerkIfAvailable()
        offersFirstUseExperience = PermitextFirstUseGate.evaluateBeforeLibraryStartup()
        _library = StateObject(wrappedValue: CodeLibraryViewModel())
        Self.configureTabBarAppearance()
    }
#endif

    private var runsNormalLifecycle: Bool {
#if DEBUG
        PermitextLifecyclePolicy.runsNormalDebugLifecycle(
            hasPhysicalStressConfiguration: physicalStressConfiguration != nil,
            hasPhase3ResearchConfiguration: phase3ResearchConfiguration != nil
        )
#else
        true
#endif
    }

    private static func configureTabBarAppearance() {
        let appearance = UITabBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.backgroundEffect = UIBlurEffect(style: .systemUltraThinMaterial)
        appearance.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.22)
        appearance.shadowColor = UIColor.separator.withAlphaComponent(0.35)

        let stacked = appearance.stackedLayoutAppearance
        stacked.normal.iconColor = UIColor.secondaryLabel
        stacked.normal.titleTextAttributes = [
            .foregroundColor: UIColor.secondaryLabel,
            .font: UIFont.systemFont(ofSize: 10, weight: .semibold)
        ]
        stacked.selected.iconColor = UIColor.appChrome
        stacked.selected.titleTextAttributes = [
            .foregroundColor: UIColor.appChrome,
            .font: UIFont.systemFont(ofSize: 10, weight: .semibold)
        ]

        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }

    private static func configuredClerkIfAvailable() -> Clerk? {
#if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--permitext-disable-clerk") {
            return nil
        }
#endif
        guard
            let publishableKey = Bundle.main.object(forInfoDictionaryKey: "PermitextClerkPublishableKey") as? String,
            !publishableKey.isEmpty,
            !publishableKey.contains("$(")
        else { return nil }
        Clerk.configure(publishableKey: publishableKey)
        return Clerk.shared
    }

    var body: some Scene {
        WindowGroup {
            Group {
#if DEBUG
                if ProcessInfo.processInfo.arguments.contains("--native-pro-presentation-fixture") {
                    // Presentation-only verification; no purchase or account mutation is started.
                    ProSubscriptionStoreView()
                } else if ProcessInfo.processInfo.arguments.contains("--native-project-facts-fixture") {
                    NavigationStack {
                        ScrollView {
                            VStack(alignment: .leading) {
                                ProjectStructuredFactRow(fact: ProjectStructuredFact(
                                    id: "unknown", key: "occupancy", label: "Occupancy", value: "", status: "unknown",
                                    source: "", sourceText: "", updatedAt: nil))
                                ProjectStructuredFactRow(fact: ProjectStructuredFact(
                                    id: "sourced", key: "sample", label: "Sample imported fact", value: "Sample value for display verification", status: "sourced",
                                    source: "fixture", sourceText: "Sample source record. Retrieved September 15, 2026. This is isolated verification data, not a building determination.",
                                    updatedAt: Date(timeIntervalSince1970: 1_789_430_400)))
                            }.padding()
                        }.navigationTitle("Project facts fixture")
                    }
                } else if let phase3ResearchConfiguration {
                    if ProcessInfo.processInfo.arguments.contains("--native-access-flow-fixture") {
                        if library.isInitialContentLoaded && !showsLaunchSplash {
                            PermitextRootNavigation(offersFirstUseExperience: offersFirstUseExperience)
                        } else {
                            AppLaunchLoadingView(progress: library.initialLoadProgress, message: "Loading code library...")
                        }
                    } else if ProcessInfo.processInfo.arguments.contains("--native-project-partial-lookup-fixture") {
                        NativeProjectPartialLookupHarness()
                    } else if ProcessInfo.processInfo.arguments.contains("--native-notebook-retry-fixture") || ProcessInfo.processInfo.arguments.contains("--native-notebook-conflict-fixture") || ProcessInfo.processInfo.arguments.contains("--native-notebook-reference-fixture") || ProcessInfo.processInfo.arguments.contains("--native-notebook-http-fixture") || ProcessInfo.processInfo.arguments.contains("--native-notebook-cold-offline-fixture") {
                        NavigationStack {
                            ProjectNotebookView(projectID: "native-notebook-fixture", projectName: "Notebook fixture", accentColor: .blue, referenceCandidates: [],
                                initialCardID: ProcessInfo.processInfo.arguments.contains("--native-notebook-reference-fixture") ? "native-reference-card" : ProcessInfo.processInfo.arguments.contains("--native-notebook-conflict-fixture") ? "native-conflict-card" : nil,
                                startNewNote: ProcessInfo.processInfo.arguments.contains("--native-notebook-cold-offline-fixture") || (ProcessInfo.processInfo.arguments.contains("--native-notebook-http-fixture") && !ProcessInfo.processInfo.arguments.contains("--native-notebook-http-list-fixture")),
                                cacheDirectoryURL: phase3ResearchConfiguration.cacheDirectoryURL)
                                .safeAreaInset(edge: .top) {
                                    if NativeNotebookRefreshFixtureDiagnostics.enabled {
                                        TimelineView(.periodic(from: .now, by: 0.2)) { _ in
                                            Text(NativeNotebookRefreshFixtureDiagnostics.label)
                                                .font(.caption2)
                                                .accessibilityIdentifier("native-notebook-refresh-diagnostics")
                                        }
                                    }
                                }
                        }
                    } else {
                        Phase3EntitledResearchHarness(configuration: phase3ResearchConfiguration)
                    }
                } else if let physicalStressConfiguration {
                    NativeReaderPhysicalStressHarness(configuration: physicalStressConfiguration)
                } else if let snapshotConfiguration = NativeReaderPhase9SnapshotConfiguration.active {
                    NativeReaderPhase9SnapshotHarness(configuration: snapshotConfiguration)
                } else if library.isInitialContentLoaded && !showsLaunchSplash {
                    PermitextRootNavigation(offersFirstUseExperience: offersFirstUseExperience)
                } else {
                    AppLaunchLoadingView(
                        progress: library.initialLoadProgress,
                        message: library.statusMessage ?? "Loading code library..."
                    )
                }
#else
                if library.isInitialContentLoaded && !showsLaunchSplash {
                    PermitextRootNavigation(offersFirstUseExperience: offersFirstUseExperience)
                } else {
                    AppLaunchLoadingView(
                        progress: library.initialLoadProgress,
                        message: library.statusMessage ?? "Loading code library..."
                    )
                }
#endif
            }
            .overlay {
                if showsLaunchSplash {
                    ZStack {
                        Color(uiColor: .systemBackground).ignoresSafeArea()
                        Text("permitext")
                            .font(.system(size: 38, weight: .semibold, design: .serif))
                            .foregroundStyle(.primary)
                    }
                    .accessibilityIdentifier("permitext-launch-splash")
                    .transition(.opacity)
                    .zIndex(1)
                }
            }
            .task {
                guard showsLaunchSplash else { return }
                do { try await Task.sleep(for: .seconds(1)) }
                catch { return }
                withAnimation(.easeInOut(duration: 0.35)) {
                    showsLaunchSplash = false
                }
            }
            .environmentObject(library)
            .tint(Color.appChrome)
            .modifier(PermitextAccountFlowPresentation(library: library, ownerID: nil))
            .environment(\.permitextClerk, clerk)
            .onChange(of: library.browserTabSwitchRequest) { _, requestedContext in
                guard let requestedContext else { return }
                library.selectedTab = requestedContext == .primary ? .browse : .browseSecondary
                library.browserTabSwitchRequest = nil
            }
            .onChange(of: library.selectedTab) { _, newTab in
                switch newTab {
                case .browse:
                    library.syncSelectedCodeSection(from: .primary)
                case .browseSecondary:
                    // Reader 2 owns an independent library model. Switching
                    // tabs must not retarget Reader 1's corpus or cancel its
                    // active content load.
                    break
                default:
                    break
                }
            }
            .onChange(of: library.isInitialContentLoaded) { _, isLoaded in
                guard runsNormalLifecycle else { return }
                guard isLoaded else { return }
                Task { @MainActor in
                    // Let the library screen render first, then pay WebKit's
                    // one-time process startup cost before the first chapter tap.
                    try? await Task.sleep(for: .milliseconds(250))
                    guard !Task.isCancelled else { return }
                    ChapterHTMLWebProcessWarmup.startIfNeeded()
                }
                switch library.selectedTab {
                case .browse:
                    library.syncSelectedCodeSection(from: .primary)
                case .browseSecondary:
                    break
                default:
                    break
                }
                Task {
                    await library.reconcileClerkSessionIfNeeded(clerk: clerk)
                    await library.performStartupAccountSyncIfNeeded()
                    if scenePhase == .active {
                        library.startForegroundAutomaticSync()
                    }
                }
            }
            .onChange(of: library.signedInAccount?.appUserID) { _, userID in
                guard runsNormalLifecycle else { return }
                if userID != nil, scenePhase == .active {
                    library.startForegroundAutomaticSync()
                } else {
                    library.stopForegroundAutomaticSync()
                }
            }
            .onChange(of: scenePhase) { _, phase in
                guard runsNormalLifecycle else { return }
                switch phase {
                case .active:
                    library.startForegroundAutomaticSync()
                    Task {
                        await library.reconcileClerkSessionIfNeeded(clerk: clerk)
                        await library.performForegroundAccountSyncIfNeeded()
                    }
                case .inactive, .background:
                    library.stopForegroundAutomaticSync()
                    library.suspendReaderWarmups()
                @unknown default:
                    break
                }
            }
            .onReceive(
                NotificationCenter.default.publisher(
                    for: UIApplication.didReceiveMemoryWarningNotification
                )
            ) { _ in
                library.handleMemoryWarning()
                PreparedChapterHTMLCache.removeAll()
                ChapterHTMLReaderRuntimeCaches.handleMemoryWarning()
                ContentBlockRuntimeCaches.handleMemoryWarning()
                NativeReaderAttributedTextCache.shared.removeAll()
                NativeReaderDocumentStore.shared.handleMemoryWarning()
                os_signpost(.event, log: AppSignpost.memory, name: "memoryWarningHandled")
                os_log(.info, log: AppSignpost.memory, "memoryWarningHandled")
            }
            .onOpenURL { url in
                guard runsNormalLifecycle else { return }
                Task {
                    if await library.handleClerkOpenURL(url, clerk: clerk) { return }
                    library.handleOpenURL(url)
                }
            }
            .onAppear {
                guard runsNormalLifecycle else { return }
                library.startStoreKitTransactionObservation()
                Task {
                    await library.refreshStoreKitEntitlements()
                }
                guard library.isInitialContentLoaded else { return }
                switch library.selectedTab {
                case .browse:
                    library.syncSelectedCodeSection(from: .primary)
                case .browseSecondary:
                    break
                default:
                    break
                }
                Task {
                    await library.reconcileClerkSessionIfNeeded(clerk: clerk)
                    await library.performStartupAccountSyncIfNeeded()
                    if scenePhase == .active {
                        library.startForegroundAutomaticSync()
                    }
                }
            }
        }
    }
}

#if DEBUG
private struct Phase3EntitledResearchConfiguration {
    struct PreparedHarness {
        let configuration: Phase3EntitledResearchConfiguration
        let library: CodeLibraryViewModel
    }

    static let launchArgument = "--phase3-entitled-research-fixture"
    static let seededSelectionLaunchArgument = "--phase3-seeded-selection-fixture"
    private static let defaultsSuiteName = "com.randycodex.permitext.phase3-entitled-research"
    private static let temporaryDirectoryName = "permitext-phase3-entitled-research"

    let defaults: UserDefaults
    let cacheDirectoryURL: URL
    let seedsReaderSelection: Bool

    @MainActor
    static func prepareIfRequested() -> PreparedHarness? {
        guard ProcessInfo.processInfo.arguments.contains(launchArgument) else { return nil }
        guard let defaults = UserDefaults(suiteName: defaultsSuiteName) else {
            fatalError("Unable to create the isolated Phase 3 Research defaults suite.")
        }
        defaults.removePersistentDomain(forName: defaultsSuiteName)
        let freeAccess = ProcessInfo.processInfo.arguments.contains("--native-access-free")
            || ProcessInfo.processInfo.arguments.contains("--native-access-guest")
        LocalEntitlementService.setDebugPlan(freeAccess ? .free : .pro, defaults: defaults)

        let fileManager = FileManager.default
        let testDirectory = fileManager.temporaryDirectory
            .appendingPathComponent(temporaryDirectoryName, isDirectory: true)
        do {
            if fileManager.fileExists(atPath: testDirectory.path) {
                try fileManager.removeItem(at: testDirectory)
            }
            try fileManager.createDirectory(
                at: testDirectory,
                withIntermediateDirectories: true
            )
            let repository = try UserDataStore(
                databaseURL: testDirectory.appendingPathComponent("user_data.sqlite")
            )
            let localTransport = LocalPermitextBackendTransport(
                phase3ResearchFixtureEnabled: true,
                phase3ResearchFailureCode: ProcessInfo.processInfo.arguments.contains("--research-verification-failure-fixture")
                    ? "RESEARCH_VERIFICATION_FAILED" : nil,
                notebookListFailureOnce: ProcessInfo.processInfo.arguments.contains("--native-notebook-retry-fixture"),
                researchResponseDelay: ProcessInfo.processInfo.arguments.contains("--research-delayed-response-fixture"),
                notebookConflictFixture: ProcessInfo.processInfo.arguments.contains("--native-notebook-conflict-fixture"),
                notebookReferenceFixture: ProcessInfo.processInfo.arguments.contains("--native-notebook-reference-fixture"),
                notebookSaveFailureOnce: ProcessInfo.processInfo.arguments.contains("--native-notebook-save-offline-fixture"),
                projectPartialLookupFixture: ProcessInfo.processInfo.arguments.contains("--native-project-partial-lookup-fixture")
            )
            let transport: any PermitextBackendTransport
            let usesHTTPFixture = ProcessInfo.processInfo.arguments.contains("--native-notebook-http-fixture")
            let fixtureToken: String?
            if usesHTTPFixture {
#if targetEnvironment(simulator)
                let environment = ProcessInfo.processInfo.environment
                guard let rawURL = environment["PERMITEXT_NOTEBOOK_HTTP_FIXTURE_URL"],
                      let url = URL(string: rawURL), url.scheme == "http", url.host == "127.0.0.1",
                      url.port != nil, url.user == nil, url.password == nil,
                      url.query == nil, url.fragment == nil, ["", "/"].contains(url.path),
                      let token = environment["PERMITEXT_NOTEBOOK_HTTP_FIXTURE_TOKEN"], !token.isEmpty else {
                    fatalError("Native HTTP fixture requires an explicit loopback URL and synthetic session.")
                }
                transport = PermitextBackendHTTPTransport(baseURL: url, name: "isolated-notebook-http-fixture", requestTimeout: 5)
                fixtureToken = token
#else
                fatalError("Native HTTP recovery fixture is restricted to the Simulator.")
#endif
            } else {
                transport = localTransport
                fixtureToken = nil
            }
            let account = SignedInAccount(
                appUserID: usesHTTPFixture ? "apple:synthetic-native-notebook" : "guest:phase3-entitled-research",
                authProvider: usesHTTPFixture ? .apple : .guest,
                authProviderUserID: usesHTTPFixture ? "synthetic-native-notebook" : "phase3-entitled-research",
                appleUserID: usesHTTPFixture ? "synthetic-native-notebook" : "",
                displayName: "Phase 3 Fixture",
                signedInAt: Date(timeIntervalSince1970: 1_787_220_000),
                migrationState: .localDataAttached,
                backendSessionToken: fixtureToken
            )
            let library = CodeLibraryViewModel(
                locator: BundleDatabaseLocator(defaults: defaults),
                userContentRepository: repository,
                continuityStore: ContinuityStore(defaults: defaults),
                readerThemeStore: ReaderThemeStore(defaults: defaults),
                preferencesDefaults: defaults,
                entitlementService: LocalEntitlementService(defaults: defaults),
                lifetimeGrantLookupClient: LocalLifetimeGrantLookupClient(defaults: defaults),
                accountBackendClient: PermitextBackendClient(transport: transport),
                syncBackend: NoOpUserContentSyncBackend(),
                loadsPersistedAccount: false,
                initialSignedInAccount: ProcessInfo.processInfo.arguments.contains("--native-access-guest") ? nil : account,
                privateCacheDirectoryURL: testDirectory.appendingPathComponent("research-cache", isDirectory: true)
            )
            if ProcessInfo.processInfo.arguments.contains("--native-notebook-cold-offline-fixture") {
                let viewer = ProcessInfo.processInfo.arguments.contains("--native-notebook-cold-viewer")
                let cached = NotebookCardListResponse(schemaVersion: 1, projectID: "native-notebook-fixture", cards: [], access: NotebookAccess(role: viewer ? "viewer" : "owner", readOnly: viewer))
                try ProjectHubOfflineCache(directoryURL: testDirectory.appendingPathComponent("research-cache", isDirectory: true))
                    .store(cached, accountID: account.appUserID, projectID: "native-notebook-fixture", scope: "native-notebook-list")
            }
            if NativeNotebookRefreshFixtureDiagnostics.enabled {
                NativeNotebookRefreshFixtureDiagnostics.defaults.removePersistentDomain(forName: "com.randycodex.permitext.notebook-refresh-fixture")
                var reference = NotebookBlock.reference(kind: "notebookCard", id: "native-reference-target", label: "Linked sample note")
                reference.content?.insert(.text("Text before the reference. "), at: 0)
                reference.content?.append(.text(" Text after the reference."))
                let card = NotebookCard(id: "native-reference-card", version: 1, createdAt: "2026-09-15T12:00:00Z", updatedAt: "2026-09-15T12:00:00Z", projectIDs: ["native-notebook-fixture"], title: "Original reference note", document: NotebookDocument(document: [.paragraph("Original editing context stays here."), reference, .reference(kind: "notebookCard", id: "native-reference-missing", label: "Unavailable sample note")]))
                let cache = ProjectHubOfflineCache(directoryURL: testDirectory.appendingPathComponent("research-cache", isDirectory: true))
                try cache.store(card, accountID: account.appUserID, projectID: "native-notebook-fixture", scope: "native-notebook-card:native-reference-card")
                if ProcessInfo.processInfo.arguments.contains("--native-notebook-refresh-pending-draft") {
                    let content = NativeNotebookEditableContent(title: "Pending original mutation", document: card.document, evidenceLinks: [])
                    let attempt = NativeNotebookSaveAttempt(clientMutationID: "native-refresh-original-mutation", cardID: card.id, expectedVersion: 1, content: content)
                    let draft = NativeNotebookDraft(cardID: card.id, version: 1, title: content.title, document: content.document, evidenceLinks: [], clientMutationID: attempt.clientMutationID, pendingSave: attempt, baseContent: NativeNotebookEditableContent(title: card.title, document: card.document, evidenceLinks: []))
                    try cache.store(draft, accountID: account.appUserID, projectID: "native-notebook-fixture", scope: "native-notebook-draft:native-reference-card")
                }
            }
            if ProcessInfo.processInfo.arguments.contains("--native-notebook-conflict-fixture") {
                let draft = NativeNotebookDraft(cardID: "native-conflict-card", version: 1, title: "Local unsynchronized analysis",
                    document: NotebookDocument(document: [.paragraph("My local draft is still preserved.")]), evidenceLinks: [],
                    clientMutationID: "native-conflict-draft-revision")
                try ProjectHubOfflineCache(directoryURL: testDirectory.appendingPathComponent("research-cache", isDirectory: true))
                    .store(draft, accountID: account.appUserID, projectID: "native-notebook-fixture", scope: "native-notebook-draft:native-conflict-card")
            }
            return PreparedHarness(
                configuration: Self(
                    defaults: defaults,
                    cacheDirectoryURL: testDirectory.appendingPathComponent(
                        "research-cache",
                        isDirectory: true
                    ),
                    seedsReaderSelection: ProcessInfo.processInfo.arguments.contains(
                        seededSelectionLaunchArgument
                    )
                ),
                library: library
            )
        } catch {
            // Never fall through to ordinary app storage or networking if the
            // acceptance fixture cannot establish its isolated container.
            fatalError("Unable to prepare isolated Phase 3 Research storage: \(error.localizedDescription)")
        }
    }
}

// Only the existing isolated Phase3 DEBUG configuration can reach this harness.
// Saving captures callback values in memory; it never creates a real project.
private struct NativeProjectPartialLookupHarness: View {
    @State private var savedSummary: String?

    var body: some View {
        if let savedSummary {
            Text(savedSummary)
                .accessibilityIdentifier("native-partial-lookup-saved-summary")
                .padding()
        } else {
            FolderEditorSheet(existing: nil, defaultFolderType: .project, onSave: { name, address, description, facts, _, _ in
                savedSummary = "Saved synthetic project: \(name). Address: \(address). Description: \(description). Facts: \(facts.count). Stories: \(facts.first?.value ?? "missing")."
            }, onDelete: {})
        }
    }
}

private struct Phase3EntitledResearchHarness: View {
    let configuration: Phase3EntitledResearchConfiguration

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var chapter: CodeChapter?
    @State private var initialSection: CodeSectionSummary?
    @State private var failureMessage: String?
    @State private var isReady = false

    var body: some View {
        PermitextMainTabs(
            saved: BookmarksView(filterDefaults: configuration.defaults),
            primary: Group {
                if ProcessInfo.processInfo.arguments.contains("--main-header-alignment-fixture") {
                    BrowseView(browserContext: .primary)
                } else {
                    readerTab
                }
            }.environment(\.isBrowserTabActive, library.selectedTab == .browse),
            secondary: Group {
                if ProcessInfo.processInfo.arguments.contains("--main-header-alignment-fixture") {
                    BrowseView(browserContext: .secondary)
                } else {
                    ContentUnavailableView("Second Reader", systemImage: "text.line.last.and.arrowtriangle.forward")
                }
            },
            research: ResearchView(cacheDirectoryURL: configuration.cacheDirectoryURL)
        )
        .scrollIndicators(.hidden)
        .modifier(GlobalSearchPresentation())
        .overlay(alignment: .topTrailing) {
            if ProcessInfo.processInfo.arguments.contains("--research-server-failure-fixture") {
                TimelineView(.periodic(from: .now, by: 0.25)) { _ in
                    let diagnostics = UserDefaults(suiteName: "permitext.research.server-failure-fixture")
                    Color.clear.frame(width: 1, height: 1)
                        .accessibilityElement(children: .ignore)
                        .accessibilityIdentifier("research-server-failure-diagnostics")
                        .accessibilityValue("requests:\(diagnostics?.integer(forKey: "requests") ?? 0):\(diagnostics?.string(forKey: "requestID") ?? "none")")
                        .allowsHitTesting(false)
                }
            }
            if isReady {
                Color.clear
                    .frame(width: 1, height: 1)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Phase 3 entitled Research fixture ready")
                    .accessibilityIdentifier("phase3-research-fixture-ready")
                    .allowsHitTesting(false)
            }
        }
        .task { await prepareReaderAndProjects() }
    }

    @ViewBuilder
    private var readerTab: some View {
        if let chapter, let initialSection {
            NavigationStack {
                ChapterHTMLReaderView(
                    chapter: chapter,
                    initialSection: initialSection
                )

            }
        } else if let failureMessage {
            ContentUnavailableView(
                "Phase 3 fixture failed",
                systemImage: "exclamationmark.triangle.fill",
                description: Text(failureMessage)
            )
            .accessibilityIdentifier("phase3-research-fixture-failure")
        } else {
            ProgressView("Preparing entitled Research fixture…")
                .accessibilityIdentifier("phase3-research-fixture-loading")
        }
    }

    @MainActor
    private func prepareReaderAndProjects() async {
        isReady = false
        failureMessage = nil
        library.selectedTab = .browse

        guard await waitForInitialContent() else {
            failureMessage = "The bundled code library did not finish loading."
            return
        }
        guard let constructionVersion = library.availableVersions.first(where: {
            $0.authoredHTMLBundlePath?.hasSuffix("2022-construction-codes") == true
        }) else {
            failureMessage = "The 2022 Construction Codes bundle is unavailable."
            return
        }
        if library.selectedVersionFileName != constructionVersion.fileName {
            library.updateSelectedVersion(fileName: constructionVersion.fileName)
            guard await waitForInitialContent(selectedVersionFileName: constructionVersion.fileName) else {
                failureMessage = "The Construction Codes bundle did not finish loading."
                return
            }
        }
        guard let buildingCode = library.codeSections.first(where: {
            $0.name.caseInsensitiveCompare("BUILDING CODE") == .orderedSame
        }) else {
            failureMessage = "The Building Code is unavailable."
            return
        }
        library.updateSelectedCodeSection(id: buildingCode.id)
        guard let chapterOne = library.chapters(for: buildingCode.id).first(where: {
            $0.chapterNumber == "1"
        }),
        let section1011 = library.sections(for: chapterOne).first(where: {
            $0.sectionNumber == "101.1"
        }) else {
            failureMessage = "Building Code Section 101.1 is unavailable."
            return
        }

        guard let acceptanceProject = library.createFolder(
            name: "Acceptance Project",
            address: "1 Centre Street",
            description: "Phase 3 entitled Research acceptance",
            colorHex: CodeFolder.presetColorHexes[0],
            folderType: .project
        ),
        library.createFolder(
            name: "Correction Project",
            address: "2 Centre Street",
            description: "Alternate Project context",
            colorHex: CodeFolder.presetColorHexes[1],
            folderType: .project
        ) != nil else {
            failureMessage = "The isolated Projects could not be created."
            return
        }
        if ProcessInfo.processInfo.arguments.contains("--saved-project-pages-fixture") {
            for number in 3...12 {
                _ = library.createFolder(
                    name: "Project \(number)", address: "\(number) Centre Street",
                    description: "Saved paging acceptance", colorHex: CodeFolder.presetColorHexes[0],
                    folderType: .project
                )
            }
            _ = library.createFolder(
                name: "Code references", address: "", description: "Saved reference navigation",
                colorHex: CodeFolder.presetColorHexes[1], folderType: .reference
            )
        }
        if ProcessInfo.processInfo.arguments.contains("--compact-search-history-fixture") {
            for query in ["fire separation", "stairs", "concrete", "accessibility", "parking", "egress"] {
                library.recordRecentSearch(query)
            }
            library.pinSearch("egress")
            for number in ["101.1", "101.4.5", "1106.1", "1006.4"] {
                if let section = library.sectionSummary(sectionNumber: number, codeSectionID: buildingCode.id),
                   let chapter = library.chapters(for: buildingCode.id).first(where: { $0.chapterNumber == section.chapterNumber }) {
                    library.recordRecentlyViewed(RecentlyViewedEntry(
                        sectionID: section.id, sectionNumber: section.sectionNumber,
                        title: section.title, chapterTitle: chapter.title,
                        codeSectionID: buildingCode.id, codeSectionName: "Building Code", viewedAt: Date()))
                }
            }
        }
        library.noteProjectOpened(acceptanceProject.id)
        chapter = chapterOne
        initialSection = section1011
        isReady = true
        if configuration.seedsReaderSelection,
           let detail = library.loadSectionDetail(sectionID: section1011.id) {
            library.sendToResearch(
                ResearchSelectionRequest(
                    sectionID: String(section1011.id),
                    selectedText: detail.officialText
                )
            )
        }
    }

    @MainActor
    private func waitForInitialContent(
        selectedVersionFileName: String? = nil
    ) async -> Bool {
        for _ in 0..<300 {
            if library.isInitialContentLoaded,
               (selectedVersionFileName == nil ||
                library.selectedVersionFileName == selectedVersionFileName) {
                return true
            }
            try? await Task.sleep(for: .milliseconds(100))
            guard !Task.isCancelled else { return false }
        }
        return false
    }
}

// DEBUG fixture only: EBC authored subsections share a multi-page text view.
// Measure the real source glyphs instead of mistaking that containing view's
// accessibility visibility for visibility of the requested sentence.
private struct NativeDefinitionVisibleGlyphProbe: UIViewRepresentable {
    let phrase: String
    var term: String = "height"
    func makeUIView(context: Context) -> UIView {
        let probe = UIView()
        probe.isAccessibilityElement = true
        probe.accessibilityIdentifier = "definition-visible-glyph"
        probe.accessibilityValue = "waiting"
        Task { @MainActor [weak probe] in
            let pattern = phrase.split(whereSeparator: \.isWhitespace)
                .map { NSRegularExpression.escapedPattern(for: String($0)) }.joined(separator: "\\s+")
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return }
            for sample in 0..<1200 {
                try? await Task.sleep(for: .milliseconds(100))
                guard !Task.isCancelled, let probe else { return }
                guard let window = probe.window else { continue }
                func descendants(_ view: UIView) -> [UIView] { [view] + view.subviews.flatMap(descendants) }
                probe.accessibilityValue = "waiting"
                for textView in descendants(window).compactMap({ $0 as? UITextView }) {
                    let text = (textView.text ?? "") as NSString
                    guard let match = regex.firstMatch(in: text as String, range: NSRange(location: 0, length: text.length)) else { continue }
                    let word = text.range(of: term, options: [.caseInsensitive, .backwards], range: match.range)
                    guard word.location != NSNotFound,
                          let start = textView.position(from: textView.beginningOfDocument, offset: word.location),
                          let end = textView.position(from: start, offset: word.length),
                          let range = textView.textRange(from: start, to: end) else { continue }
                    let rect = textView.convert(textView.firstRect(for: range), to: window)
                    guard rect.width > 0, rect.minY > window.safeAreaInsets.top + 70,
                          rect.maxY < window.bounds.height - window.safeAreaInsets.bottom - 110 else { continue }
                    let linked = textView.attributedText.attribute(.link, at: word.location, effectiveRange: nil) != nil
                    let font = textView.attributedText.attribute(.font, at: word.location, effectiveRange: nil) as? UIFont
                    probe.accessibilityLabel = "category=\(window.traitCollection.preferredContentSizeCategory.rawValue);font=\(font?.pointSize ?? 0)"
                    probe.accessibilityValue = "ready:\(rect.midX):\(rect.midY):\(linked):\(sample)"
                }
            }
            probe?.accessibilityValue = "expired"
        }
        return probe
    }
    func updateUIView(_ uiView: UIView, context: Context) {}
}

private struct NativeDefinitionScopeAlignmentProbe: UIViewRepresentable {
    let phrase: String
    func makeUIView(context: Context) -> UIView {
        let probe = UIView()
        probe.isAccessibilityElement = true
        probe.accessibilityIdentifier = "definition-scope-alignment"
        probe.accessibilityValue = "waiting"
        Task { @MainActor [weak probe] in
            let pattern = phrase.split(whereSeparator: \.isWhitespace)
                .map { NSRegularExpression.escapedPattern(for: String($0)) }.joined(separator: "\\s+")
            guard let expression = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return }
            var stableSamples = 0
            for _ in 0..<150 {
                try? await Task.sleep(for: .milliseconds(100))
                guard !Task.isCancelled, let probe else { return }
                guard let window = probe.window else { continue }
                func descendants(_ view: UIView) -> [UIView] { [view] + view.subviews.flatMap(descendants) }
                guard let textView = descendants(window).compactMap({ $0 as? UITextView }).first(where: {
                    expression.firstMatch(in: $0.text ?? "", range: NSRange(location: 0, length: ($0.text as NSString?)?.length ?? 0)) != nil
                }), let text = textView.text,
                   let match = expression.firstMatch(in: text, range: NSRange(location: 0, length: (text as NSString).length)) else { continue }
                let manager = textView.layoutManager
                manager.ensureLayout(for: textView.textContainer)
                let glyphs = manager.glyphRange(forCharacterRange: match.range, actualCharacterRange: nil)
                var rect = manager.boundingRect(forGlyphRange: glyphs, in: textView.textContainer)
                rect.origin.x += textView.textContainerInset.left
                rect.origin.y += textView.textContainerInset.top
                guard rect.minY.isFinite, rect.height > 0 else { continue }
                var ancestor = textView.superview
                var scrollView: UIScrollView?
                while let view = ancestor {
                    if let scroll = view as? UIScrollView, scroll.isScrollEnabled, scroll.bounds.height > 300 {
                        scrollView = scroll
                        break
                    }
                    ancestor = view.superview
                }
                guard let scroll = scrollView else { continue }
                let target = textView.convert(rect, to: scroll)
                let desired = min(max(-scroll.adjustedContentInset.top, target.minY - 140),
                                  max(-scroll.adjustedContentInset.top, scroll.contentSize.height - scroll.bounds.height + scroll.adjustedContentInset.bottom))
                if abs(scroll.contentOffset.y - desired) > 2 {
                    stableSamples = 0
                    scroll.setContentOffset(CGPoint(x: scroll.contentOffset.x, y: desired), animated: false)
                } else {
                    let visible = textView.convert(rect, to: window)
                    if visible.minY >= window.safeAreaInsets.top + 70 && visible.maxY <= window.bounds.height - window.safeAreaInsets.bottom - 100 {
                        stableSamples += 1
                        if stableSamples >= 3 {
                            probe.accessibilityValue = "ready"
                            return
                        }
                    }
                }
            }
            probe?.accessibilityValue = "target-not-visible"
        }
        return probe
    }
    func updateUIView(_ uiView: UIView, context: Context) {}
}

private struct NativeReaderPhysicalStressConfiguration {
    enum Target: Equatable {
        case bookmarkStress
        case crossCodeLink
        case plumbingChapter
        case legacy2014BuildingChapter7
        case legacy2014SeismicDefinitionInsideScope
        case legacy2014SeismicDefinitionOutsideScope
        case legacy1968BuildingChapter1
        case housingMaintenanceScopedDefinition
        case title26BuyoutDefinition
        case title26AffordableHousingDefinition
        case historicalGradeScope
        case existingBuildingHeightScope
    }

    struct PreparedHarness {
        let configuration: NativeReaderPhysicalStressConfiguration
        let library: CodeLibraryViewModel
    }

    static let launchArgument = "--native-reader-physical-stress"
    static let crossCodeLinkLaunchArgument = "--native-reader-cross-code-link-test"
    static let plumbingChapterLaunchArgument = "--native-reader-universal-plumbing-test"
    static let legacy2014BuildingChapter7LaunchArgument = "--native-reader-2014-building-chapter-7"
    static let legacy1968BuildingChapter1LaunchArgument = "--native-reader-1968-building-chapter-1"
    static let gradeScopeLaunchArgument = "--native-reader-grade-scope"
    static let heightScopeLaunchArgument = "--native-reader-height-scope"
    static let affordableHousingDefinitionLaunchArgument = "--native-reader-title26-affordable-housing"
    static let buyoutDefinitionLaunchArgument = "--native-reader-title26-buyout"
    static let housingScopedDefinitionLaunchArgument = "--native-reader-housing-scoped-definition"
    static let seismicInsideScopeLaunchArgument = "--native-reader-seismic-inside-scope"
    static let seismicOutsideScopeLaunchArgument = "--native-reader-seismic-outside-scope"
    private static let defaultsSuiteName = "com.randycodex.permitext.native-reader-physical-stress"
    private static let temporaryDirectoryName = "permitext-native-reader-physical-stress"

    let defaults: UserDefaults
    let target: Target

    @MainActor
    static func prepareIfRequested() -> PreparedHarness? {
        let arguments = ProcessInfo.processInfo.arguments
        guard arguments.contains(launchArgument)
                || arguments.contains(crossCodeLinkLaunchArgument)
                || arguments.contains(plumbingChapterLaunchArgument)
                || arguments.contains(legacy2014BuildingChapter7LaunchArgument)
                || arguments.contains(legacy1968BuildingChapter1LaunchArgument)
                || arguments.contains(affordableHousingDefinitionLaunchArgument)
                || arguments.contains(buyoutDefinitionLaunchArgument)
                || arguments.contains(housingScopedDefinitionLaunchArgument)
                || arguments.contains(seismicInsideScopeLaunchArgument)
                || arguments.contains(seismicOutsideScopeLaunchArgument)
                || arguments.contains(gradeScopeLaunchArgument)
                || arguments.contains(heightScopeLaunchArgument)
        else {
            return nil
        }

        let target: Target
        if arguments.contains(affordableHousingDefinitionLaunchArgument) {
            target = .title26AffordableHousingDefinition
        } else if arguments.contains(buyoutDefinitionLaunchArgument) {
            target = .title26BuyoutDefinition
        } else if arguments.contains(gradeScopeLaunchArgument) {
            target = .historicalGradeScope
        } else if arguments.contains(heightScopeLaunchArgument) {
            target = .existingBuildingHeightScope
        } else if arguments.contains(seismicInsideScopeLaunchArgument) {
            target = .legacy2014SeismicDefinitionInsideScope
        } else if arguments.contains(seismicOutsideScopeLaunchArgument) {
            target = .legacy2014SeismicDefinitionOutsideScope
        } else if arguments.contains(housingScopedDefinitionLaunchArgument) {
            target = .housingMaintenanceScopedDefinition
        } else if arguments.contains(legacy1968BuildingChapter1LaunchArgument) {
            target = .legacy1968BuildingChapter1
        } else if arguments.contains(legacy2014BuildingChapter7LaunchArgument) {
            target = .legacy2014BuildingChapter7
        } else if arguments.contains(plumbingChapterLaunchArgument) {
            target = .plumbingChapter
        } else if arguments.contains(crossCodeLinkLaunchArgument) {
            target = .crossCodeLink
        } else {
            target = .bookmarkStress
        }

        guard let defaults = UserDefaults(suiteName: defaultsSuiteName) else {
            fatalError("Unable to create the isolated physical-stress defaults suite.")
        }
        defaults.removePersistentDomain(forName: defaultsSuiteName)

        let fileManager = FileManager.default
        let testDirectory = fileManager.temporaryDirectory
            .appendingPathComponent(temporaryDirectoryName, isDirectory: true)
        do {
            if fileManager.fileExists(atPath: testDirectory.path) {
                try fileManager.removeItem(at: testDirectory)
            }
            try fileManager.createDirectory(
                at: testDirectory,
                withIntermediateDirectories: true
            )
            let repository = try UserDataStore(
                databaseURL: testDirectory.appendingPathComponent("user_data.sqlite")
            )
            let library = CodeLibraryViewModel(
                userContentRepository: repository,
                continuityStore: ContinuityStore(defaults: defaults),
                readerThemeStore: ReaderThemeStore(defaults: defaults),
                syncBackend: NoOpUserContentSyncBackend(),
                loadsPersistedAccount: false
            )
            return PreparedHarness(
                configuration: Self(defaults: defaults, target: target),
                library: library
            )
        } catch {
            // Failing closed is important here: falling back to the ordinary
            // repository would let a stress test mutate the user's real data.
            fatalError("Unable to prepare isolated physical-stress storage: \(error.localizedDescription)")
        }
    }

}

private struct NativeReaderPhysicalStressHarness: View {
    let configuration: NativeReaderPhysicalStressConfiguration

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var chapter: CodeChapter?
    @State private var initialSection: CodeSectionSummary?
    @State private var failureMessage: String?

    var body: some View {
        TabView(selection: $library.selectedTab) {
            readerTab
                .environment(\.isBrowserTabActive, library.selectedTab == .browse)
                .tabItem {
                    Image(systemName: "text.line.first.and.arrowtriangle.forward")
                }
                .accessibilityLabel("First reader")
                .tag(AppTab.browse)

            BookmarksView(filterDefaults: configuration.defaults)
                .tabItem {
                    Image(systemName: library.selectedTab == .bookmarks ? "folder.fill" : "folder")
                }
                .accessibilityLabel("Saved")
                .tag(AppTab.bookmarks)
        }
        .scrollIndicators(.hidden)
        .task {
            await prepareReaderTarget()
        }
    }

    @ViewBuilder
    private var readerTab: some View {
        if let chapter, let initialSection {
            if ProcessInfo.processInfo.arguments.contains("--native-reader-browse-opening") {
                BrowseView(browserContext: .primary)
            } else {
                NavigationStack {
                    ChapterHTMLReaderView(
                        chapter: chapter,
                        initialSection: initialSection
                    )
                    .background {
                        if configuration.target == .title26AffordableHousingDefinition {
                            NativeDefinitionVisibleGlyphProbe(phrase: "report on each lottery for affordable housing units", term: "affordable housing units")
                                .frame(width: 1, height: 1)
                        }
                        if configuration.target == .title26BuyoutDefinition {
                            NativeDefinitionVisibleGlyphProbe(phrase: "Within 90 days after the execution of a buyout agreement", term: "buyout agreement")
                                .frame(width: 1, height: 1)
                        }
                        if configuration.target == .housingMaintenanceScopedDefinition && ProcessInfo.processInfo.arguments.contains("--native-reader-housing-family") {
                            NativeDefinitionVisibleGlyphProbe(phrase: "b.No rooming unit shall be occupied by a family", term: "family")
                                .frame(width: 1, height: 1)
                        }
                        if configuration.target == .housingMaintenanceScopedDefinition && ProcessInfo.processInfo.arguments.contains("--native-reader-large-text-check") {
                            NativeDefinitionVisibleGlyphProbe(phrase: "b.The owner of a class A multiple dwelling", term: "class A")
                                .frame(width: 1, height: 1)
                        }
                        if configuration.target == .existingBuildingHeightScope && ProcessInfo.processInfo.arguments.contains("--native-reader-visible-height-probe") {
                            NativeDefinitionVisibleGlyphProbe(phrase: "75 feet (22 860 mm) in height")
                                .frame(width: 1, height: 1)
                        }
                        if configuration.target == .existingBuildingHeightScope && !ProcessInfo.processInfo.arguments.contains("--native-reader-disable-scope-alignment") {
                            NativeDefinitionScopeAlignmentProbe(phrase: ProcessInfo.processInfo.arguments.contains("--native-reader-scope-positive")
                                ? "75 feet (22 860 mm) in height" : "height above the floor")
                                .frame(width: 1, height: 1)
                        }
                    }
                }
            }
        } else if let failureMessage {
            ContentUnavailableView(
                "Physical stress harness failed",
                systemImage: "exclamationmark.triangle.fill",
                description: Text(failureMessage)
            )
            .accessibilityIdentifier("physical-stress-failure")
            .accessibilityValue(failureMessage)
        } else {
            ProgressView("Preparing isolated native Reader…")
                .accessibilityIdentifier("physical-stress-loading")
        }
    }

    @MainActor
    private func prepareReaderTarget() async {
        failureMessage = nil
        chapter = nil
        initialSection = nil
        library.selectedTab = .browse

        guard await waitForInitialContent() else {
            failureMessage = "The bundled code library did not finish loading."
            return
        }

        let constructionCodeBundleSuffix = (configuration.target == .legacy2014BuildingChapter7 || configuration.target == .legacy2014SeismicDefinitionInsideScope || configuration.target == .legacy2014SeismicDefinitionOutsideScope)
            ? "2014-construction-codes"
            : (configuration.target == .title26AffordableHousingDefinition || configuration.target == .title26BuyoutDefinition || configuration.target == .legacy1968BuildingChapter1 || configuration.target == .housingMaintenanceScopedDefinition || configuration.target == .historicalGradeScope)
                ? "2026-enacted-administrative-code" : configuration.target == .existingBuildingHeightScope ? "2026-existing-building-code" : "2022-construction-codes"
        guard let constructionVersion = library.availableVersions.first(where: {
            $0.authoredHTMLBundlePath?.hasSuffix(constructionCodeBundleSuffix) == true
        }) else {
            failureMessage = "The \(constructionCodeBundleSuffix) bundle is unavailable."
            return
        }

        if library.selectedVersionFileName != constructionVersion.fileName {
            library.updateSelectedVersion(fileName: constructionVersion.fileName)
            guard await waitForInitialContent(
                selectedVersionFileName: constructionVersion.fileName
            ) else {
                failureMessage = "The \(constructionCodeBundleSuffix) bundle did not finish loading."
                return
            }
        }

        let codeSectionName: String
        let chapterNumber: String
        let initialSectionNumber: String?
        switch configuration.target {
        case .bookmarkStress:
            codeSectionName = "BUILDING CODE"
            chapterNumber = "1"
            initialSectionNumber = nil
        case .crossCodeLink:
            codeSectionName = "FUEL GAS CODE"
            chapterNumber = "1"
            initialSectionNumber = "102.2.1"
        case .plumbingChapter:
            codeSectionName = "PLUMBING CODE"
            chapterNumber = "1"
            initialSectionNumber = nil
        case .legacy2014BuildingChapter7:
            codeSectionName = "BUILDING CODE"
            chapterNumber = "7"
            initialSectionNumber = nil
        case .legacy2014SeismicDefinitionInsideScope:
            codeSectionName = "BUILDING CODE"
            chapterNumber = "16"
            initialSectionNumber = "1613.5.3"
        case .legacy2014SeismicDefinitionOutsideScope:
            codeSectionName = "BUILDING CODE"
            chapterNumber = "30"
            initialSectionNumber = "3004.4"
        case .historicalGradeScope:
            codeSectionName = "1968 BUILDING CODE"
            chapterNumber = "10"
            initialSectionNumber = ProcessInfo.processInfo.arguments.contains("--native-reader-scope-positive") ? "27-623" : "27-599"
        case .existingBuildingHeightScope:
            codeSectionName = "EXISTING BUILDING CODE"
            let positive = ProcessInfo.processInfo.arguments.contains("--native-reader-scope-positive")
            chapterNumber = positive ? "D3" : "15"
            // The authored chapter summaries expose top-level section numbers;
            // subsection prose is contained in those actual source sections.
            initialSectionNumber = positive ? "D306" : "1506"
        case .title26AffordableHousingDefinition:
            codeSectionName = "ADMINISTRATIVE CODE TITLE 26"
            chapterNumber = "26"
            initialSectionNumber = "26-2602"
        case .title26BuyoutDefinition:
            codeSectionName = "ADMINISTRATIVE CODE TITLE 26"
            chapterNumber = "24"
            initialSectionNumber = "26-2403"
        case .housingMaintenanceScopedDefinition:
            codeSectionName = "HOUSING MAINTENANCE CODE"
            let harassment = ProcessInfo.processInfo.arguments.contains("--native-reader-housing-harassment")
            let family = ProcessInfo.processInfo.arguments.contains("--native-reader-housing-family")
            chapterNumber = family ? "3" : harassment ? "5" : "2"
            initialSectionNumber = family ? "27-2076" : harassment ? "27-2120" : ProcessInfo.processInfo.arguments.contains("--native-reader-housing-class-a") ? "27-2033.1" : ProcessInfo.processInfo.arguments.contains("--native-reader-housing-article14") ? "27-2056.3" : "27-2045"
        case .legacy1968BuildingChapter1:
            codeSectionName = "1968 BUILDING CODE"
            chapterNumber = ProcessInfo.processInfo.arguments.contains("--native-reader-definitions-chapter") ? "2" : "1"
            initialSectionNumber = nil
        }

        guard let codeSection = library.codeSections.first(where: {
            $0.name.caseInsensitiveCompare(codeSectionName) == .orderedSame
        }) else {
            failureMessage = "The \(codeSectionName.localizedCapitalized) section is unavailable."
            return
        }
        library.updateSelectedCodeSection(id: codeSection.id)

        guard let selectedChapter = library.chapters(for: codeSection.id).first(where: {
            $0.chapterNumber == chapterNumber && (configuration.target != .title26BuyoutDefinition || $0.id == 30_000_042) && (configuration.target != .title26AffordableHousingDefinition || $0.id == 30_000_044)
        }) else {
            failureMessage = "\(codeSectionName.localizedCapitalized) Chapter \(chapterNumber) is unavailable."
            return
        }
        let selectedInitialSection: CodeSectionSummary?
        if let initialSectionNumber {
            selectedInitialSection = library.sections(for: selectedChapter).first(where: {
                $0.sectionNumber == initialSectionNumber
            })
        } else {
            selectedInitialSection = await library.firstSectionAsync(for: selectedChapter)
        }
        guard let selectedInitialSection else {
            failureMessage = "\(codeSectionName.localizedCapitalized) Chapter \(chapterNumber) has no readable section matching \(initialSectionNumber ?? "first section")."
            return
        }

        chapter = selectedChapter
        initialSection = selectedInitialSection
    }

    @MainActor
    private func waitForInitialContent(
        selectedVersionFileName: String? = nil
    ) async -> Bool {
        for _ in 0..<300 {
            if library.isInitialContentLoaded,
               (selectedVersionFileName == nil ||
                library.selectedVersionFileName == selectedVersionFileName) {
                return true
            }
            try? await Task.sleep(for: .milliseconds(100))
            guard !Task.isCancelled else { return false }
        }
        return false
    }
}
#endif

/// The visible Reader owns its account sheets so a gated save never dismisses Search.
struct PermitextAccountFlowPresentation: ViewModifier {
    @ObservedObject var library: CodeLibraryViewModel
    let ownerID: UUID?
    @Environment(\.permitextClerk) private var clerk

    @State private var authenticationTheme = ClerkTheme(
        colors: .init(
            primary: Color(uiColor: .label),
            background: Color(uiColor: .systemBackground),
            input: Color(uiColor: .secondarySystemBackground),
            foreground: Color(uiColor: .label),
            mutedForeground: Color(uiColor: .secondaryLabel),
            primaryForeground: Color(uiColor: .systemBackground),
            inputForeground: Color(uiColor: .label),
            ring: Color(uiColor: .label),
            secondaryButtonBackground: Color(uiColor: .secondarySystemBackground),
            border: Color(uiColor: .label)
        ),
        design: .init(borderRadius: 24)
    )

    private var isOwner: Bool { library.accountPresentationOwnerID == ownerID }

    func body(content: Content) -> some View {
        content
            .alert(
                "Upgrade to Pro",
                isPresented: Binding(
                    get: { isOwner && library.entitlementPrompt != nil },
                    set: { if !$0 && isOwner { library.dismissEntitlementPrompt() } }
                ),
                presenting: library.entitlementPrompt
            ) { _ in
                if library.currentPlan != .pro && !library.isStoreKitBusy {
                    Button(library.upgradeCallToActionTitle) {
                        library.dismissEntitlementPrompt()
                        Task {
                            await library.requestProSubscriptionStore(clerk: clerk)
                        }
                    }
                }
                if library.signedInAccount == nil {
                    Button("Already have Pro? Sign in") {
                        library.dismissEntitlementPrompt()
                        library.requestClerkAuthentication()
                    }
                }
                Button("Not Now", role: .cancel) { library.cancelPendingProAction() }
            } message: { requirement in
                Text(requirement.message)
            }
            .sheet(
                isPresented: Binding(
                    get: { isOwner && library.isClerkAuthenticationPresented },
                    set: { if isOwner { library.isClerkAuthenticationPresented = $0 } }
                ),
                onDismiss: {
                    guard isOwner else { return }
                    Task {
                        await library.handleClerkAuthenticationFinished(clerk: clerk)
                    }
                }
            ) {
                Group {
                    if let clerk {
                        if library.isResumingClerkAuthenticationCallback {
                            AuthView()
                                .environment(clerk)
                        } else {
                            PermitextClerkAuthenticationView(createsAccount: library.clerkCreatesAccount)
                                .environment(clerk)
                        }
                    }
                }
                .environment(\.clerkTheme, authenticationTheme)
            }
            .sheet(
                isPresented: Binding(
                    get: { isOwner && library.isProSubscriptionStorePresented },
                    set: { isPresented in
                        guard isOwner else { return }
                        if !isPresented {
                            library.dismissProSubscriptionStore()
                        }
                    }
                )
            ) {
                ProSubscriptionStoreView()
                    .environmentObject(library)
            }
    }
}

enum PermitextFirstUseGate {
    static let currentVersion = 1
    static let completionVersionKey = "permitext.firstUseExperience.completedVersion"
    static let debugLaunchArgument = "--phase5-first-use-fixture"

    static func isDebugPresentationForced(
        arguments: [String] = ProcessInfo.processInfo.arguments
    ) -> Bool {
#if DEBUG
        arguments.contains(debugLaunchArgument)
#else
        false
#endif
    }

    /// This runs before `CodeLibraryViewModel` writes a default continuity
    /// payload, which lets an upgraded installation bypass first-use UI while
    /// a genuinely new installation receives it.
    static func evaluateBeforeLibraryStartup(
        defaults: UserDefaults = .standard,
        arguments: [String] = ProcessInfo.processInfo.arguments
    ) -> Bool {
#if DEBUG
        if isDebugPresentationForced(arguments: arguments) {
            return true
        }
#endif
        guard defaults.integer(forKey: completionVersionKey) < currentVersion else {
            return false
        }
        if legacyUsageKeys.contains(where: { defaults.object(forKey: $0) != nil }) {
            complete(defaults: defaults)
            return false
        }
        return true
    }

    static func canPresent(
        wasOffered: Bool,
        isDebugPresentationForced: Bool = false,
        completedVersion: Int,
        selectedTab: AppTab,
        pendingDeepLinkedSectionID: Int64?,
        pendingInvitationToken: String?,
        pendingResearchSelectionCount: Int
    ) -> Bool {
        wasOffered &&
            (isDebugPresentationForced || completedVersion < currentVersion) &&
            selectedTab == .browse &&
            pendingDeepLinkedSectionID == nil &&
            pendingInvitationToken == nil &&
            pendingResearchSelectionCount == 0
    }

    static func complete(defaults: UserDefaults = .standard) {
        defaults.set(currentVersion, forKey: completionVersionKey)
    }

    static func shouldPersistCompletionAfterDismissal(
        dismissedForExternalIntent: Bool
    ) -> Bool {
        !dismissedForExternalIntent
    }

    private static let legacyUsageKeys = [
        "continuityContext",
        "selectedCodeVersionFileName",
        "selectedJurisdictionKey",
        "selectedCodeSectionID",
        "lastOpenedChapterID",
        "recentSearches",
        "recentlyViewedSections",
        "readerTheme",
        "permitext.account.signedIn",
        "browseLeftCodeSectionID",
        "browseRightCodeSectionID"
    ]
}

private struct PermitextRootNavigation: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @EnvironmentObject private var library: CodeLibraryViewModel
    let offersFirstUseExperience: Bool

    var body: some View {
        switch layoutMode {
        case .compactTabs, .regularPreparedTabs:
            PermitextTabNavigation(offersFirstUseExperience: offersFirstUseExperience)
        }
    }

    private var layoutMode: PermitextRootLayoutMode {
        horizontalSizeClass == .regular ? .regularPreparedTabs : .compactTabs
    }
}

private enum PermitextRootLayoutMode {
    case compactTabs
    case regularPreparedTabs
}

private struct PermitextTabNavigation: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @AppStorage(PermitextFirstUseGate.completionVersionKey)
    private var completedFirstUseVersion = 0
    @State private var presentsFirstUseExperience = false
    @State private var presentsAccountSettings = false
    @State private var pendingFirstUseDestination: FirstUseDestination?
    @State private var dismissedForExternalIntent = false
    let offersFirstUseExperience: Bool

    var body: some View {
        PermitextMainTabs(
            saved: BookmarksView().safeAreaInset(edge: .bottom, spacing: 0) { SavedRemovalUndoBar() },
            primary: BrowseView(browserContext: .primary)
                .environment(\.isBrowserTabActive, library.selectedTab == .browse)
                .safeAreaInset(edge: .bottom, spacing: 0) { SavedRemovalUndoBar() },
            secondary: IndependentReaderHost(browserContext: .secondary),
            research: ResearchView().safeAreaInset(edge: .bottom, spacing: 0) { SavedRemovalUndoBar() }
        )
        .scrollIndicators(.hidden)
        .modifier(GlobalSearchPresentation())
        .task {
            await presentFirstUseExperienceIfEligible()
        }
        .onChange(of: library.pendingDeepLinkedSectionID) { _, sectionID in
            if sectionID != nil { bypassFirstUseForExternalIntent() }
        }
        .onChange(of: library.pendingOrganizationInvitationToken) { _, token in
            if token != nil { bypassFirstUseForExternalIntent() }
        }
        .onChange(of: library.pendingResearchSelections) { _, selections in
            if !selections.isEmpty { bypassFirstUseForExternalIntent() }
        }
        .sheet(isPresented: $presentsFirstUseExperience, onDismiss: finishFirstUseDismissal) {
            PermitextFirstUseSheet { destination in
                completeFirstUse(destination: destination)
            }
            .environmentObject(library)
        }
        .sheet(isPresented: $presentsAccountSettings) {
            PermitextAccountEntryView(initialSection: .account)
                .environmentObject(library)
        }
        .onReceive(NotificationCenter.default.publisher(for: .permitextSavedWorkDidChange)) { notification in
            guard (notification.object as? CodeLibraryViewModel) !== library else { return }
            library.reconcileExternalSavedWorkChange(scheduleAccountSync: true)
        }
    }

    @MainActor
    private func presentFirstUseExperienceIfEligible() async {
        await Task.yield()
        guard PermitextFirstUseGate.canPresent(
            wasOffered: offersFirstUseExperience,
            isDebugPresentationForced: PermitextFirstUseGate.isDebugPresentationForced(),
            completedVersion: completedFirstUseVersion,
            selectedTab: library.selectedTab,
            pendingDeepLinkedSectionID: library.pendingDeepLinkedSectionID,
            pendingInvitationToken: library.pendingOrganizationInvitationToken,
            pendingResearchSelectionCount: library.pendingResearchSelections.count
        ) else { return }
        presentsFirstUseExperience = true
    }

    private func completeFirstUse(destination: FirstUseDestination) {
        dismissedForExternalIntent = false
        completedFirstUseVersion = PermitextFirstUseGate.currentVersion
        pendingFirstUseDestination = destination
        presentsFirstUseExperience = false
    }

    private func finishFirstUseDismissal() {
        if !PermitextFirstUseGate.shouldPersistCompletionAfterDismissal(
            dismissedForExternalIntent: dismissedForExternalIntent
        ) {
            dismissedForExternalIntent = false
            pendingFirstUseDestination = nil
            return
        } else {
            completedFirstUseVersion = PermitextFirstUseGate.currentVersion
        }
        guard let destination = pendingFirstUseDestination else { return }
        pendingFirstUseDestination = nil
        Task { @MainActor in
            await Task.yield()
            switch destination {
            case .reader:
                library.selectedTab = .browse
            case .account:
                presentsAccountSettings = true
            case .citation(let sectionID, let codeVersion):
                library.openResearchCitation(sectionID: sectionID, codeVersion: codeVersion)
            }
        }
    }

    private func bypassFirstUseForExternalIntent() {
        guard presentsFirstUseExperience else { return }
        dismissedForExternalIntent = true
        pendingFirstUseDestination = nil
        presentsFirstUseExperience = false
    }
}

private struct SavedRemovalUndoBar: View {
    @EnvironmentObject private var library: CodeLibraryViewModel

    var body: some View {
        if !library.removedSavedPassages.isEmpty {
            HStack(spacing: 12) {
                Text(library.savedRemovalUndoFailed
                     ? "Could not restore all passages. Try Undo again."
                     : "Removed from Saved. Undo restores previous project links too.")
                    .font(.caption)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                Button("Undo") { library.undoSavedPassageRemovals() }
                    .frame(minWidth: 44, minHeight: 44)
                Button { library.dismissSavedRemovalUndo() } label: {
                    Image(systemName: "xmark").frame(width: 44, height: 44)
                }
                .accessibilityLabel("Dismiss Undo")
            }
            .padding(.horizontal)
            .background(.regularMaterial)
        }
    }
}

private enum FirstUseDestination {
    case reader
    case account
    case citation(sectionID: Int64, codeVersion: String?)
}

private struct PermitextFirstUseSheet: View {
    let onContinue: (FirstUseDestination) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("permitext")
                    .font(.system(size: 38, weight: .semibold, design: .serif))
                    .foregroundStyle(.primary)
                Text("Explore NYC construction codes and read the enacted text.")
                    .font(.title2.weight(.semibold))
                    .fixedSize(horizontal: false, vertical: true)
                Text("Browse codes, follow references, and search. No account needed.")
                    .foregroundStyle(.secondary)
                Button { onContinue(.reader) } label: {
                    Text("Explore Permitext")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .foregroundStyle(Color(uiColor: .systemBackground))
                        .background(Color.primary, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("phase5-first-use-explore")
                Button("Sign in") { onContinue(.account) }
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .accessibilityIdentifier("phase5-first-use-sign-in")
            }
            .padding(24)
        }
        .background(CodeAppBackdrop(accent: Color.appChrome).ignoresSafeArea())
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("phase5-first-use-sheet")
    }
}

struct FirstUseResearchExample: Sendable {
    let section: CodeSectionSummary
    let officialText: String
    let codePrefix: String
    let codeVersion: String?

    static func bundledBuildingCodeTitle(
        in versions: [BundledCodeVersion]
    ) -> FirstUseResearchExample? {
        guard let constructionVersion = versions.first(where: {
            UserContentSyncCodeVersion.server($0.codeVersion) ==
                UserContentSyncCodeVersion.canonicalNYC2022
        }),
        let authoredCodeID = constructionVersion.authoredCodeID,
        let jurisdictionID = constructionVersion.jurisdictionID,
        let store = try? AuthoredCodeStore(
            jsonURL: constructionVersion.fileURL,
            codeID: authoredCodeID,
            jurisdictionID: jurisdictionID
        ),
        let buildingCode = store.codeSections().first(where: {
            $0.name.caseInsensitiveCompare("BUILDING CODE") == .orderedSame
        }),
        let section = try? store.sectionSummary(
            sectionNumber: "101.1",
            codeSectionID: buildingCode.id
        ),
        let detail = store.sectionDetail(sectionID: section.id)
        else { return nil }

        return FirstUseResearchExample(
            section: section,
            officialText: detail.officialText,
            codePrefix: "BC",
            codeVersion: constructionVersion.codeVersion
        )
    }

    var citationLabel: String {
        "\(codePrefix) § \(section.sectionNumber) · \(section.displayTitle)"
    }

    var answerExcerpt: String {
        let normalized = officialText
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalized.count > 220 else { return normalized }
        let end = normalized.index(normalized.startIndex, offsetBy: 220)
        return String(normalized[..<end]).trimmingCharacters(in: .whitespacesAndNewlines) + "…"
    }
}

/// Gives the second permanent Reader its own content loader, search work,
/// selected version, and navigation model. Saved work still uses the shared
/// on-device repository and is reconciled through `permitextSavedWorkDidChange`.
/// The model is created lazily so users who never open Reader 2 do not pay for
/// a second corpus load at launch.
private struct IndependentReaderHost: View {
    let browserContext: BrowserContextID

    @EnvironmentObject private var sharedLibrary: CodeLibraryViewModel
    @State private var readerLibrary: CodeLibraryViewModel?

    var body: some View {
        Group {
            if let readerLibrary {
                IndependentReaderContent(
                    browserContext: browserContext,
                    readerLibrary: readerLibrary,
                    sharedLibrary: sharedLibrary
                )
            } else {
                AppLaunchLoadingView(
                    progress: 0,
                    message: "Preparing second Reader..."
                )
                .task {
                    let model = makeReaderLibrary()
                    model.synchronizeIndependentReaderSession(from: sharedLibrary)
                    readerLibrary = model
                }
            }
        }
    }

    @MainActor
    private func makeReaderLibrary() -> CodeLibraryViewModel {
        let continuityDefaults = UserDefaults(
            suiteName: "com.permitext.reader.\(browserContext.rawValue).continuity"
        ) ?? .standard
        return CodeLibraryViewModel(
            continuityStore: ContinuityStore(defaults: continuityDefaults),
            readerThemeStore: ReaderThemeStore(defaults: .standard),
            preferencesDefaults: .standard,
            entitlementService: LocalEntitlementService(defaults: .standard),
            loadsPersistedAccount: false,
            ownsAccountSync: false
        )
    }
}

private struct IndependentReaderContent: View {
    let browserContext: BrowserContextID
    @ObservedObject var readerLibrary: CodeLibraryViewModel
    @ObservedObject var sharedLibrary: CodeLibraryViewModel

    var body: some View {
        Group {
            if readerLibrary.isInitialContentLoaded {
                BrowseView(browserContext: browserContext)
                    .environment(\.isBrowserTabActive, sharedLibrary.selectedTab == .browseSecondary)
            } else {
                AppLaunchLoadingView(
                    progress: readerLibrary.initialLoadProgress,
                    message: readerLibrary.statusMessage ?? "Preparing second Reader..."
                )
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { SavedRemovalUndoBar() }
        .environmentObject(readerLibrary)
        .onReceive(NotificationCenter.default.publisher(for: .permitextSavedWorkDidChange)) { notification in
            guard (notification.object as? CodeLibraryViewModel) !== readerLibrary else { return }
            readerLibrary.reconcileExternalSavedWorkChange(scheduleAccountSync: false)
        }
        .onChange(of: sharedLibrary.currentPlan) { _, _ in
            readerLibrary.synchronizeIndependentReaderSession(from: sharedLibrary)
        }
        .onChange(of: sharedLibrary.currentCapabilityContract) { _, _ in
            readerLibrary.synchronizeIndependentReaderSession(from: sharedLibrary)
        }
        .onChange(of: sharedLibrary.readerTheme) { _, _ in
            readerLibrary.synchronizeIndependentReaderSession(from: sharedLibrary)
        }
        .onChange(of: sharedLibrary.signedInAccount?.appUserID) { _, _ in
            readerLibrary.synchronizeIndependentReaderSession(from: sharedLibrary)
        }
        .onChange(of: sharedLibrary.activeProjectID) { _, _ in
            readerLibrary.synchronizeIndependentReaderSession(from: sharedLibrary)
        }
        .onChange(of: readerLibrary.pendingResearchSelections) { _, selections in
            guard !selections.isEmpty else { return }
            for selection in selections {
                sharedLibrary.sendToResearch(selection)
            }
            readerLibrary.acknowledgePendingResearchSelections(selections)
        }
        .onChange(of: readerLibrary.selectedTab) { _, selectedTab in
            switch selectedTab {
            case .browse, .browseSecondary:
                break
            case .search, .bookmarks, .research:
                sharedLibrary.selectedTab = selectedTab
                readerLibrary.selectedTab = .browseSecondary
            }
        }
    }
}

private struct AppLaunchLoadingView: View {
    let progress: Double
    let message: String

    var body: some View {
        VStack(spacing: 22) {
            VStack(spacing: 8) {
                Text("permitext")
                    .font(.system(size: 28, weight: .semibold, design: .serif))
                    .foregroundStyle(.primary)

                Text(message)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }

            VStack(spacing: 9) {
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule(style: .continuous)
                            .fill(Color.secondary.opacity(0.18))

                        Capsule(style: .continuous)
                            .fill(Color.appChrome)
                            .frame(width: max(12, proxy.size.width * min(max(progress, 0), 1)))
                    }
                }
                .frame(height: 8)

                Text("\(Int((min(max(progress, 0), 1) * 100).rounded()))%")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            .frame(maxWidth: 260)
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(CodeAppBackdrop(accent: Color.appChrome).ignoresSafeArea())
    }
}

#if DEBUG
#Preview("App Launch Loading") {
    AppLaunchLoadingView(progress: 0.64, message: "Preparing chapters...")
}
#endif

#if DEBUG
#Preview("App Shell") {
    TabView {
        BrowseView()
            .tabItem {
                Image(systemName: "text.line.first.and.arrowtriangle.forward")
            }
        BrowseView(browserContext: .secondary)
            .tabItem {
                Image(systemName: "text.line.last.and.arrowtriangle.forward")
            }
        SearchView()
            .tabItem {
                Image(systemName: "magnifyingglass")
            }
        BookmarksView()
            .tabItem {
                Image(systemName: "bookmark")
            }
        ResearchView()
            .tabItem {
                Image("Astroid")
            }
    }
    .environmentObject(CodeLibraryViewModel.preview())
}
#endif


/// Native bottom navigation presents one Reader destination. The original context
/// IDs and independent models remain intact so the experiment is reversible.
private struct PermitextMainTabs<Saved: View, Primary: View, Secondary: View, Research: View>: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.openPermitextSearch) private var openSearch
    @State private var hasOpenedSecondary = false
    @State private var summaries: [BrowserContextID: ReaderSessionSummary] = [:]
    let saved: Saved
    let primary: Primary
    let secondary: Secondary
    let research: Research

    private var selection: Binding<String> {
        Binding(
            get: { library.selectedTab == .browseSecondary ? AppTab.browse.rawValue : library.selectedTab.rawValue },
            set: { value in
                if value == "search-action" {
                    openSearch?()
                } else if value == AppTab.browse.rawValue {
                    library.selectedTab = library.selectedReaderContext == .secondary ? .browseSecondary : .browse
                } else if let tab = AppTab(rawValue: value) {
                    library.selectedTab = tab
                }
            }
        )
    }

    var body: some View {
        Group {
            if #available(iOS 18.0, *) {
                nativeTabs
            } else {
                TabView(selection: selection) {
                    saved.tabItem { Label("Saved", systemImage: "folder") }.tag(AppTab.bookmarks.rawValue)
                    readers.tabItem { Label("Reader", systemImage: "book") }.tag(AppTab.browse.rawValue)
                    research.tabItem { Label("Research", systemImage: "sparkle") }.tag(AppTab.research.rawValue)
                }
                .safeAreaInset(edge: .bottom) {
                    Button("Search", systemImage: "magnifyingglass") { openSearch?() }
                }
            }
        }
        .tint(Color.primary)
        .toolbar(.hidden, for: .tabBar)
        .overlay(alignment: .bottom) { bottomDock }
        .environment(\.floatingNavigationClearance, 0)
        .onAppear { activateSelectedReading() }
        .onChange(of: library.selectedReaderContext) { _, _ in activateSelectedReading() }
    }

    private func activateSelectedReading() {
        if library.selectedReaderContext == .secondary { hasOpenedSecondary = true }
    }

    private var readers: some View {
        // Float controls over both independent reading surfaces.
        ZStack(alignment: .bottom) {
            ZStack {
                primary
                    .accessibilityElement(children: .contain)
                    .opacity(library.selectedReaderContext == .primary ? 1 : 0)
                    .allowsHitTesting(library.selectedReaderContext == .primary)
                    .accessibilityHidden(library.selectedReaderContext != .primary)
                if hasOpenedSecondary {
                    secondary
                        .accessibilityElement(children: .contain)
                        .opacity(library.selectedReaderContext == .secondary ? 1 : 0)
                        .allowsHitTesting(library.selectedReaderContext == .secondary)
                        .accessibilityHidden(library.selectedReaderContext != .secondary)
                }
            }
            .environment(\.readerControlsClearance, CodeScreenMetrics.bottomControlHeight + 88)
            .onPreferenceChange(ReaderSessionSummaryKey.self) { summaries = $0 }
            readingSwitcher.padding(.bottom, 76)
        }
    }

    private var readingSwitcher: some View {
        HStack(spacing: 6) {
            ForEach(BrowserContextID.allCases) { context in
                let selected = library.selectedReaderContext == context
                let summary = summaries[context]
                Button {
                    if context == .secondary { hasOpenedSecondary = true }
                    library.selectedTab = context == .primary ? .browse : .browseSecondary
                } label: {
                    HStack(spacing: 6) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(summary?.source ?? (context == .primary ? "Current reading" : "Another reading"))
                                .font(.caption.weight(.semibold))
                                .lineLimit(2)
                            Text(summary?.location ?? "Browse codes")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 14)
                    .frame(maxWidth: .infinity)
                    .frame(height: CodeScreenMetrics.bottomControlHeight)
                    .background(selected ? Color.primary.opacity(0.12) : Color.clear, in: Capsule())
                    .codeLiquidGlassCapsule()
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("reader-session-\(context.rawValue)")
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
        .padding(.horizontal, 21)
        .padding(.top, 6)
        .padding(.bottom, 6)
    }

    private var bottomDock: some View {
        HStack(spacing: 12) {
            HStack(spacing: 0) {
                dockDestination("Saved", icon: "folder", value: .bookmarks)
                dockDestination("Reader", icon: "book", value: .browse)
                dockDestination("Research", icon: "sparkle", value: .research)
            }
            .codeLiquidGlassCapsule()
            Button { openSearch?() } label: {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 22, weight: .medium))
                    .frame(width: 60, height: 60)
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .codeLiquidGlassCircle()
            .accessibilityLabel("Search")
            .accessibilityIdentifier("main-tab-search")
        }
        .padding(.horizontal, 21)
        .padding(.bottom, 12)
    }

    private func dockDestination(_ title: String, icon: String, value: AppTab) -> some View {
        let selected = selection.wrappedValue == value.rawValue
        return Button { selection.wrappedValue = value.rawValue } label: {
            Image(systemName: selected && icon != "sparkle" ? icon + ".fill" : icon)
                .font(.system(size: 22, weight: .medium))
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(selected ? Color.primary.opacity(0.10) : Color.clear, in: Capsule())
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .padding(4)
        .accessibilityLabel(title)
        .accessibilityIdentifier("main-tab-" + title.lowercased())
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    @available(iOS 18.0, *)
    private var nativeTabs: some View {
        TabView(selection: selection) {
            Tab(value: AppTab.bookmarks.rawValue) {
                saved.environment(\.floatingNavigationClearance, 76)
                    .toolbar(.hidden, for: .tabBar)
            } label: {
                Image(systemName: "folder")
                    .accessibilityLabel("Saved")
                    .accessibilityIdentifier("main-tab-saved")
            }
            Tab(value: AppTab.browse.rawValue) {
                readers.toolbar(.hidden, for: .tabBar)
            } label: {
                Image(systemName: "book")
                    .accessibilityLabel("Reader")
                    .accessibilityIdentifier("main-tab-reader")
            }
            Tab(value: AppTab.research.rawValue) {
                research.environment(\.floatingNavigationClearance, 76)
                    .toolbar(.hidden, for: .tabBar)
            } label: {
                Image(systemName: "sparkle")
                    .accessibilityLabel("Research")
                    .accessibilityIdentifier("main-tab-research")
            }
            Tab(value: "search-action", role: .search) {
                Color.clear.toolbar(.hidden, for: .tabBar)
            } label: {
                Image(systemName: "magnifyingglass")
                    .accessibilityLabel("Search")
            }
        }
    }
}
