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

    var body: some View {
        Group {
            switch preparationState {
            case .ready:
                AuthView()
            case .preparing:
                ProgressView("Preparing secure sign-in...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .failed(let message):
                ContentUnavailableView {
                    Label("Sign-in needs a reset", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try Again") {
                        preparationState = .preparing
                        preparationAttempt += 1
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
            .onChange(of: clerk.session?.id) { _, sessionID in
                guard case .ready = preparationState, let sessionID else { return }
                guard sessionID != staleSessionID else {
                    preparationState = .preparing
                    preparationAttempt += 1
                    return
                }
                dismiss()
            }
            .task(id: preparationAttempt) {
                await prepareForAuthentication()
            }
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
            preparationState = .ready
        } catch {
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
                if let phase3ResearchConfiguration {
                    Phase3EntitledResearchHarness(configuration: phase3ResearchConfiguration)
                } else if let physicalStressConfiguration {
                    NativeReaderPhysicalStressHarness(configuration: physicalStressConfiguration)
                } else if let snapshotConfiguration = NativeReaderPhase9SnapshotConfiguration.active {
                    NativeReaderPhase9SnapshotHarness(configuration: snapshotConfiguration)
                } else if library.isInitialContentLoaded {
                    PermitextRootNavigation(offersFirstUseExperience: offersFirstUseExperience)
                } else {
                    AppLaunchLoadingView(
                        progress: library.initialLoadProgress,
                        message: library.statusMessage ?? "Loading code library..."
                    )
                }
#else
                if library.isInitialContentLoaded {
                    PermitextRootNavigation(offersFirstUseExperience: offersFirstUseExperience)
                } else {
                    AppLaunchLoadingView(
                        progress: library.initialLoadProgress,
                        message: library.statusMessage ?? "Loading code library..."
                    )
                }
#endif
            }
            .environmentObject(library)
            .environment(\.permitextClerk, clerk)
            .tint(Color.appChrome)
            .alert(
                "Upgrade to Pro",
                isPresented: Binding(
                    get: { library.entitlementPrompt != nil },
                    set: { if !$0 { library.dismissEntitlementPrompt() } }
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
                Button("Not Now", role: .cancel) { library.dismissEntitlementPrompt() }
            } message: { requirement in
                Text(requirement.message)
            }
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
            .sheet(
                isPresented: Binding(
                    get: { library.isClerkAuthenticationPresented },
                    set: { library.isClerkAuthenticationPresented = $0 }
                ),
                onDismiss: {
                    Task {
                        await library.handleClerkAuthenticationFinished(clerk: clerk)
                    }
                }
            ) {
                if let clerk {
                    if library.isResumingClerkAuthenticationCallback {
                        AuthView()
                            .environment(clerk)
                    } else {
                        PermitextClerkAuthenticationView()
                            .environment(clerk)
                    }
                }
            }
            .sheet(
                isPresented: Binding(
                    get: { library.isProSubscriptionStorePresented },
                    set: { isPresented in
                        if !isPresented {
                            library.dismissProSubscriptionStore()
                        }
                    }
                )
            ) {
                ProSubscriptionStoreView()
                    .environmentObject(library)
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
        LocalEntitlementService.setDebugPlan(.pro, defaults: defaults)

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
            let transport = LocalPermitextBackendTransport(
                phase3ResearchFixtureEnabled: true
            )
            let account = SignedInAccount(
                appUserID: "guest:phase3-entitled-research",
                authProvider: .guest,
                authProviderUserID: "phase3-entitled-research",
                appleUserID: "",
                displayName: "Phase 3 Fixture",
                signedInAt: Date(timeIntervalSince1970: 1_787_220_000),
                migrationState: .localDataAttached,
                backendSessionToken: nil
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
                initialSignedInAccount: account
            )
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

private struct Phase3EntitledResearchHarness: View {
    let configuration: Phase3EntitledResearchConfiguration

    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var chapter: CodeChapter?
    @State private var initialSection: CodeSectionSummary?
    @State private var failureMessage: String?
    @State private var isReady = false

    var body: some View {
        TabView(selection: $library.selectedTab) {
            BookmarksView(filterDefaults: configuration.defaults)
                .tabItem { Image(systemName: library.selectedTab == .bookmarks ? "folder.fill" : "folder") }
                .accessibilityLabel("Saved")
                .tag(AppTab.bookmarks)

            readerTab
                .environment(\.isBrowserTabActive, library.selectedTab == .browse)
                .tabItem { Image(systemName: "text.line.first.and.arrowtriangle.forward") }
                .accessibilityLabel("First reader")
                .tag(AppTab.browse)

            ContentUnavailableView(
                "Second Reader",
                systemImage: "text.line.last.and.arrowtriangle.forward",
                description: Text("The acceptance journey uses the first Reader.")
            )
            .tabItem { Image(systemName: "text.line.last.and.arrowtriangle.forward") }
            .accessibilityLabel("Second reader")
            .tag(AppTab.browseSecondary)

            SearchView()
                .tabItem { Image(systemName: "magnifyingglass") }
                .accessibilityLabel("Search")
                .tag(AppTab.search)

            ResearchView(cacheDirectoryURL: configuration.cacheDirectoryURL)
                .tabItem {
                    Image(systemName: "sparkle")
                        .accessibilityLabel("Research")
                        .accessibilityIdentifier("research-tab")
                }
                .tag(AppTab.research)
        }
        .overlay(alignment: .topTrailing) {
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

private struct NativeReaderPhysicalStressConfiguration {
    enum Target {
        case bookmarkStress
        case crossCodeLink
        case plumbingChapter
    }

    struct PreparedHarness {
        let configuration: NativeReaderPhysicalStressConfiguration
        let library: CodeLibraryViewModel
    }

    static let launchArgument = "--native-reader-physical-stress"
    static let crossCodeLinkLaunchArgument = "--native-reader-cross-code-link-test"
    static let plumbingChapterLaunchArgument = "--native-reader-universal-plumbing-test"
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
        else {
            return nil
        }

        let target: Target
        if arguments.contains(plumbingChapterLaunchArgument) {
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
        .task {
            await prepareReaderTarget()
        }
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
                "Physical stress harness failed",
                systemImage: "exclamationmark.triangle.fill",
                description: Text(failureMessage)
            )
            .accessibilityIdentifier("physical-stress-failure")
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

        guard let constructionVersion = library.availableVersions.first(where: {
            $0.authoredHTMLBundlePath?.hasSuffix("2022-construction-codes") == true
        }) else {
            failureMessage = "The 2022 Construction Codes bundle is unavailable."
            return
        }

        if library.selectedVersionFileName != constructionVersion.fileName {
            library.updateSelectedVersion(fileName: constructionVersion.fileName)
            guard await waitForInitialContent(
                selectedVersionFileName: constructionVersion.fileName
            ) else {
                failureMessage = "The 2022 Construction Codes bundle did not finish loading."
                return
            }
        }

        let codeSectionName: String
        let initialSectionNumber: String?
        switch configuration.target {
        case .bookmarkStress:
            codeSectionName = "BUILDING CODE"
            initialSectionNumber = nil
        case .crossCodeLink:
            codeSectionName = "FUEL GAS CODE"
            initialSectionNumber = "102.2.1"
        case .plumbingChapter:
            codeSectionName = "PLUMBING CODE"
            initialSectionNumber = nil
        }

        guard let codeSection = library.codeSections.first(where: {
            $0.name.caseInsensitiveCompare(codeSectionName) == .orderedSame
        }) else {
            failureMessage = "The \(codeSectionName.localizedCapitalized) section is unavailable."
            return
        }
        library.updateSelectedCodeSection(id: codeSection.id)

        guard let chapterOne = library.chapters(for: codeSection.id).first(where: {
            $0.chapterNumber == "1"
        }) else {
            failureMessage = "\(codeSectionName.localizedCapitalized) Chapter 1 is unavailable."
            return
        }
        let selectedInitialSection: CodeSectionSummary?
        if let initialSectionNumber {
            selectedInitialSection = library.sections(for: chapterOne).first(where: {
                $0.sectionNumber == initialSectionNumber
            })
        } else {
            selectedInitialSection = await library.firstSectionAsync(for: chapterOne)
        }
        guard let selectedInitialSection else {
            failureMessage = "\(codeSectionName.localizedCapitalized) Chapter 1 has no readable section."
            return
        }

        chapter = chapterOne
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
        TabView(selection: $library.selectedTab) {
            BookmarksView()
                .tabItem {
                    Image(systemName: library.selectedTab == .bookmarks ? "folder.fill" : "folder")
                }
                .accessibilityLabel("Saved")
                .tag(AppTab.bookmarks)

            BrowseView(browserContext: .primary)
                .environment(\.isBrowserTabActive, library.selectedTab == .browse)
                .tabItem {
                    Image(systemName: "text.line.first.and.arrowtriangle.forward")
                }
                .accessibilityLabel("First reader")
                .tag(AppTab.browse)

            IndependentReaderHost(browserContext: .secondary)
                .tabItem {
                    Image(systemName: "text.line.last.and.arrowtriangle.forward")
                }
                .accessibilityLabel("Second reader")
                .tag(AppTab.browseSecondary)

            SearchView()
                .tabItem {
                    Image(systemName: "magnifyingglass")
                }
                .accessibilityLabel("Search")
                .tag(AppTab.search)

            ResearchView()
                .tabItem {
                    Image(systemName: "sparkle")
                        .accessibilityLabel("Research")
                        .accessibilityIdentifier("research-tab")
                }
                .tag(AppTab.research)
        }
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
            SettingsView(initialSection: .account)
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

private enum FirstUseDestination {
    case reader
    case account
    case citation(sectionID: Int64, codeVersion: String?)
}

private struct PermitextFirstUseSheet: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var showsResearchExample = false
    @State private var installedResearchExample: FirstUseResearchExample?
    let onContinue: (FirstUseDestination) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 10) {
                    Image(systemName: "text.book.closed.fill")
                        .font(.system(size: 34, weight: .semibold))
                        .foregroundStyle(Color.appChrome)
                        .accessibilityHidden(true)

                    Text("NYC code research you can verify.")
                        .font(.system(.largeTitle, design: .default, weight: .bold))
                        .fixedSize(horizontal: false, vertical: true)

                    Text("Read enacted code, save the sections that matter, and ask cited Research questions.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if showsResearchExample {
                    researchExample
                        .transition(.opacity.combined(with: .move(edge: .top)))
                } else {
                    VStack(alignment: .leading, spacing: 12) {
                        firstUseBenefit(
                            title: "Start with the source",
                            detail: "Choose a code and open any chapter without an account.",
                            symbol: "text.book.closed"
                        )
                        firstUseBenefit(
                            title: "Keep useful sections",
                            detail: "Saved work stays on this iPhone until you choose to sign in and sync.",
                            symbol: "bookmark"
                        )
                    }
                }

                VStack(spacing: 10) {
                    Button {
                        onContinue(.reader)
                    } label: {
                        Text("Explore the Codes")
                            .font(.headline)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .foregroundStyle(.white)
                            .background(Color.appChrome, in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("phase5-first-use-explore")

                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            showsResearchExample = true
                        }
                    } label: {
                        Text("See How Research Works")
                            .font(.headline)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .foregroundStyle(.primary)
                            .background(Color.secondary.opacity(0.13), in: RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("phase5-first-use-research-example")

                    Button("Sign In") {
                        onContinue(.account)
                    }
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .accessibilityIdentifier("phase5-first-use-sign-in")
                }
            }
            .padding(.horizontal, 22)
            .padding(.top, dynamicTypeSize.isAccessibilitySize ? 22 : 30)
            .padding(.bottom, 28)
        }
        .background(CodeAppBackdrop(accent: Color.appChrome).ignoresSafeArea())
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("phase5-first-use-sheet")
        .task(id: bundledExampleSourceSignature) {
            let versions = library.availableVersions
            installedResearchExample = await Task.detached(priority: .userInitiated) {
                FirstUseResearchExample.bundledBuildingCodeTitle(in: versions)
            }.value
        }
    }

    @ViewBuilder
    private var researchExample: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Static cited example", systemImage: "sparkles")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Color.appChrome)
                Spacer()
                Text("Offline")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
            }

            Text("AI-assisted—not an official interpretation.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .accessibilityIdentifier("phase5-first-use-research-trust")

            Text("Question")
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
            Text(exampleQuestion)
                .font(.subheadline.weight(.semibold))

            if let example = installedResearchExample {
                Text("Example answer")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                Text(example.answerExcerpt)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? 5 : 4)

                Button {
                    onContinue(
                        .citation(
                            sectionID: example.section.id,
                            codeVersion: example.codeVersion
                        )
                    )
                } label: {
                    Label(example.citationLabel, systemImage: "arrow.up.right.square")
                        .font(.caption.weight(.semibold))
                        .frame(minHeight: 44)
                }
                .buttonStyle(.plain)
                .foregroundStyle(Color.appChrome)
                .accessibilityLabel("Open \(example.citationLabel) in Reader")
                .accessibilityIdentifier("phase5-first-use-example-citation")
            } else {
                Text("The installed source is still preparing. Explore the codes to continue.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

        }
        .padding(16)
        .background(Color.secondary.opacity(0.09), in: RoundedRectangle(cornerRadius: 18))
        .accessibilityIdentifier("phase5-first-use-static-example")
    }

    private var exampleQuestion: String {
        guard let installedResearchExample else {
            return "What does this enacted section establish?"
        }
        return "What does \(installedResearchExample.citationLabel) establish?"
    }

    private var bundledExampleSourceSignature: [String] {
        library.availableVersions.map(\.fileName)
    }

    private func firstUseBenefit(title: String, detail: String, symbol: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol)
                .font(.body.weight(.semibold))
                .foregroundStyle(Color.appChrome)
                .frame(width: 26, height: 26)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
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
                    .font(.system(size: 28, weight: .bold, design: .default))
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
