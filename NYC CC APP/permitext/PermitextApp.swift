import SwiftUI
import UIKit
import os.signpost

@main
struct PermitextApp: App {
    @StateObject private var library: CodeLibraryViewModel
    @Environment(\.scenePhase) private var scenePhase

#if DEBUG
    private let physicalStressConfiguration: NativeReaderPhysicalStressConfiguration?

    init() {
        if let preparedStressHarness = NativeReaderPhysicalStressConfiguration.prepareIfRequested() {
            physicalStressConfiguration = preparedStressHarness.configuration
            _library = StateObject(wrappedValue: preparedStressHarness.library)
        } else {
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
        _library = StateObject(wrappedValue: CodeLibraryViewModel())
        Self.configureTabBarAppearance()
    }
#endif

    private var runsNormalLifecycle: Bool {
#if DEBUG
        physicalStressConfiguration == nil
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

    var body: some Scene {
        WindowGroup {
            Group {
#if DEBUG
                if let physicalStressConfiguration {
                    NativeReaderPhysicalStressHarness(configuration: physicalStressConfiguration)
                } else if let snapshotConfiguration = NativeReaderPhase9SnapshotConfiguration.active {
                    NativeReaderPhase9SnapshotHarness(configuration: snapshotConfiguration)
                } else if library.isInitialContentLoaded {
                    PermitextRootNavigation()
                } else {
                    AppLaunchLoadingView(
                        progress: library.initialLoadProgress,
                        message: library.statusMessage ?? "Loading code library..."
                    )
                }
#else
                if library.isInitialContentLoaded {
                    PermitextRootNavigation()
                } else {
                    AppLaunchLoadingView(
                        progress: library.initialLoadProgress,
                        message: library.statusMessage ?? "Loading code library..."
                    )
                }
#endif
            }
            .environmentObject(library)
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
                            await library.purchasePro()
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
                    library.syncSelectedCodeSection(from: .secondary)
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
                    library.syncSelectedCodeSection(from: .secondary)
                default:
                    break
                }
                Task {
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
                library.handleOpenURL(url)
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
                    library.syncSelectedCodeSection(from: .secondary)
                default:
                    break
                }
                Task {
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
private struct NativeReaderPhysicalStressConfiguration {
    enum Target {
        case bookmarkStress
        case crossCodeLink
    }

    struct PreparedHarness {
        let configuration: NativeReaderPhysicalStressConfiguration
        let library: CodeLibraryViewModel
    }

    static let launchArgument = "--native-reader-physical-stress"
    static let crossCodeLinkLaunchArgument = "--native-reader-cross-code-link-test"
    private static let defaultsSuiteName = "com.randycodex.permitext.native-reader-physical-stress"
    private static let temporaryDirectoryName = "permitext-native-reader-physical-stress"

    let defaults: UserDefaults
    let target: Target

    @MainActor
    static func prepareIfRequested() -> PreparedHarness? {
        let arguments = ProcessInfo.processInfo.arguments
        guard arguments.contains(launchArgument) || arguments.contains(crossCodeLinkLaunchArgument) else {
            return nil
        }

        let target: Target = arguments.contains(crossCodeLinkLaunchArgument)
            ? .crossCodeLink
            : .bookmarkStress

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

private struct PermitextRootNavigation: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @EnvironmentObject private var library: CodeLibraryViewModel

    var body: some View {
        switch layoutMode {
        case .compactTabs, .regularPreparedTabs:
            PermitextTabNavigation()
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

            BrowseView(browserContext: .secondary)
                .environment(\.isBrowserTabActive, library.selectedTab == .browseSecondary)
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
                }
                .accessibilityLabel("Research")
                .tag(AppTab.research)
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
