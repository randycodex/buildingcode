import SwiftUI
import UIKit

@main
struct PermitextApp: App {
#if DEBUG
    init() {
        if UserDefaults.standard.string(forKey: PermitextBackendConfiguration.apiBaseURLDefaultsKey) == nil {
            PermitextBackendConfiguration.setDebugHTTPBaseURL("https://permitext-sync.vercel.app")
        }
        Self.configureTabBarAppearance()
    }
#else
    init() {
        Self.configureTabBarAppearance()
    }
#endif

    @StateObject private var library = CodeLibraryViewModel()
    @Environment(\.scenePhase) private var scenePhase

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
                if library.isInitialContentLoaded {
                    PermitextRootNavigation()
                } else {
                    AppLaunchLoadingView(
                        progress: library.initialLoadProgress,
                        message: library.statusMessage ?? "Loading code library..."
                    )
                }
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
                if userID != nil, scenePhase == .active {
                    library.startForegroundAutomaticSync()
                } else {
                    library.stopForegroundAutomaticSync()
                }
            }
            .onChange(of: scenePhase) { _, phase in
                switch phase {
                case .active:
                    library.startForegroundAutomaticSync()
                    Task {
                        await library.performForegroundAccountSyncIfNeeded()
                    }
                case .inactive, .background:
                    library.stopForegroundAutomaticSync()
                @unknown default:
                    break
                }
            }
            .onOpenURL { url in
                library.handleOpenURL(url)
            }
            .onAppear {
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
                .accessibilityLabel("Projects")
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
