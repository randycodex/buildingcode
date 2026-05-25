import SwiftUI
import UIKit

@main
struct NYCCCApp: App {
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
        stacked.selected.iconColor = UIColor.label
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
            .environmentObject(library)
            .tint(Color(uiColor: .label))
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
            .onAppear {
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
    .environmentObject(CodeLibraryViewModel())
}
#endif
