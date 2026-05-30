import SwiftUI
import UIKit

@main
struct PermitextApp: App {
    @StateObject private var library = CodeLibraryViewModel()

    init() {
        let appearance = UITabBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.backgroundEffect = UIBlurEffect(style: .systemUltraThinMaterial)
        appearance.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.22)
        appearance.shadowColor = UIColor.separator.withAlphaComponent(0.35)

        let stacked = appearance.stackedLayoutAppearance
        stacked.normal.iconColor = UIColor.secondaryLabel
        stacked.normal.titleTextAttributes = [
            .foregroundColor: UIColor.clear,
            .font: UIFont.preferredFont(forTextStyle: .caption2)
        ]
        stacked.selected.iconColor = UIColor.appChrome
        stacked.selected.titleTextAttributes = [
            .foregroundColor: UIColor.clear,
            .font: UIFont.preferredFont(forTextStyle: .caption2)
        ]
        stacked.normal.titlePositionAdjustment = UIOffset(horizontal: 0, vertical: 20)
        stacked.selected.titlePositionAdjustment = UIOffset(horizontal: 0, vertical: 20)

        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if library.isInitialContentLoaded {
                    TabView(selection: $library.selectedTab) {
                        BrowseView(browserContext: .primary)
                            .environment(\.isBrowserTabActive, library.selectedTab == .browse)
                            .tabItem {
                                Image(systemName: "text.line.first.and.arrowtriangle.forward")
                                Text("")
                            }
                            .tag(AppTab.browse)

                        if library.comparisonModeEnabled {
                            BrowseView(browserContext: .secondary)
                                .environment(\.isBrowserTabActive, library.selectedTab == .browseSecondary)
                                .tabItem {
                                    Image(systemName: "text.line.last.and.arrowtriangle.forward")
                                    Text("")
                                }
                                .tag(AppTab.browseSecondary)
                        }

                        SearchView()
                            .tabItem {
                                Image(systemName: "sparkle.magnifyingglass")
                                Text("")
                            }
                            .tag(AppTab.search)

                        BookmarksView()
                            .tabItem {
                                Image(systemName: library.selectedTab == .bookmarks ? "bookmark.fill" : "bookmark")
                                Text("")
                            }
                            .tag(AppTab.bookmarks)

                        SettingsView()
                            .tabItem {
                                Image(systemName: library.selectedTab == .settings ? "gearshape.fill" : "gearshape")
                                Text("")
                            }
                            .tag(AppTab.settings)
                    }
                } else {
                    AppLaunchLoadingView(
                        progress: library.initialLoadProgress,
                        message: library.statusMessage ?? "Loading code library..."
                    )
                }
            }
            .environmentObject(library)
            .tint(Color.appChrome)
            .onChange(of: library.comparisonModeEnabled) { _, isEnabled in
                if !isEnabled, library.selectedTab == .browseSecondary {
                    library.selectedTab = .browse
                } else if isEnabled {
                    let preservedTab = library.selectedTab
                    Task { @MainActor in
                        await Task.yield()
                        library.selectedTab = preservedTab
                    }
                }
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
                switch library.selectedTab {
                case .browse:
                    library.syncSelectedCodeSection(from: .primary)
                case .browseSecondary:
                    library.syncSelectedCodeSection(from: .secondary)
                default:
                    break
                }
            }
            .onAppear {
                guard library.isInitialContentLoaded else { return }
                switch library.selectedTab {
                case .browse:
                    library.syncSelectedCodeSection(from: .primary)
                case .browseSecondary:
                    library.syncSelectedCodeSection(from: .secondary)
                default:
                    break
                }
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
                Text("")
            }
        SearchView()
            .tabItem {
                Image(systemName: "sparkle.magnifyingglass")
                Text("")
            }
        BookmarksView()
            .tabItem {
                Image(systemName: "bookmark")
                Text("")
            }
        SettingsView()
            .tabItem {
                Image(systemName: "gearshape")
                Text("")
            }
    }
    .environmentObject(CodeLibraryViewModel.preview())
}
#endif
