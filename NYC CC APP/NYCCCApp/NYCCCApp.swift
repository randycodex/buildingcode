import SwiftUI
import UIKit

@main
struct NYCCCApp: App {
    @StateObject private var library = CodeLibraryViewModel()
    @State private var selectedTab: AppTab = .browse

    init() {
        let appearance = UITabBarAppearance()
        appearance.configureWithDefaultBackground()
        appearance.backgroundEffect = nil
        appearance.backgroundColor = UIColor.systemBackground
        appearance.shadowColor = UIColor.separator

        let stacked = appearance.stackedLayoutAppearance
        stacked.normal.iconColor = UIColor.secondaryLabel
        stacked.normal.titleTextAttributes = [
            .foregroundColor: UIColor.secondaryLabel,
            .font: UIFont.preferredFont(forTextStyle: .caption2)
        ]
        stacked.selected.iconColor = UIColor.label
        stacked.selected.titleTextAttributes = [
            .foregroundColor: UIColor.label,
            .font: UIFont.preferredFont(forTextStyle: .caption2)
        ]

        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }

    var body: some Scene {
        WindowGroup {
            ZStack {
                TabView(selection: $selectedTab) {
                    BrowseView()
                        .tabItem {
                            Image(systemName: "text.line.first.and.arrowtriangle.forward")
                            Text("Browse")
                        }
                        .tag(AppTab.browse)
                    SearchView()
                        .tabItem {
                            Image(systemName: "sparkle.magnifyingglass")
                            Text("Search")
                        }
                        .tag(AppTab.search)

                    BookmarksView()
                        .tabItem {
                            Image(systemName: selectedTab == .bookmarks ? "bookmark.fill" : "bookmark")
                            Text("Saved")
                        }
                        .tag(AppTab.bookmarks)

                    SettingsView()
                        .tabItem {
                            Image(systemName: selectedTab == .settings ? "gearshape.fill" : "gearshape")
                            Text("Settings")
                        }
                        .tag(AppTab.settings)
                }
                .environmentObject(library)
                .tint(Color(uiColor: library.readerTheme.accentColor))

                if !library.isInitialContentLoaded {
                    loadingOverlay
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.2), value: library.isInitialContentLoaded)
        }
    }

    private var loadingOverlay: some View {
        ZStack {
            Color(uiColor: .systemGroupedBackground)
                .ignoresSafeArea()

            VStack(spacing: 16) {
                ProgressView()
                    .controlSize(.large)
                    .tint(Color(uiColor: library.readerTheme.accentColor))

                VStack(spacing: 4) {
                    Text("Loading chapters")
                        .font(.headline)
                        .foregroundStyle(.primary)

                    Text("Preparing the current code version")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(24)
        }
    }

    private enum AppTab: Hashable {
        case browse
        case search
        case bookmarks
        case settings
    }
}

#if DEBUG
#Preview("App Shell") {
    TabView {
        BrowseView()
            .tabItem {
                Image(systemName: "text.line.first.and.arrowtriangle.forward")
                Text("Browse")
            }
        SearchView()
            .tabItem {
                Image(systemName: "sparkle.magnifyingglass")
                Text("Search")
            }
        BookmarksView()
            .tabItem {
                Image(systemName: "bookmark")
                Text("Saved")
            }
        SettingsView()
            .tabItem {
                Image(systemName: "gearshape")
                Text("Settings")
            }
    }
    .environmentObject(CodeLibraryViewModel())
}
#endif
