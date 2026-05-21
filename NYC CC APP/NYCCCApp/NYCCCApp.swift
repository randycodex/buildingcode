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
            .font: UIFont.systemFont(ofSize: 1, weight: .medium)
        ]
        stacked.selected.iconColor = UIColor.label
        stacked.selected.titleTextAttributes = [
            .foregroundColor: UIColor.label,
            .font: UIFont.systemFont(ofSize: 1, weight: .semibold)
        ]
        stacked.normal.titlePositionAdjustment = UIOffset(horizontal: 0, vertical: 20)
        stacked.selected.titlePositionAdjustment = UIOffset(horizontal: 0, vertical: 20)

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
                        }
                        .tag(AppTab.browse)
                    SearchView()
                        .tabItem {
                            Image(systemName: "sparkle.magnifyingglass")
                        }
                        .tag(AppTab.search)

                    BookmarksView()
                        .tabItem {
                            Image(systemName: selectedTab == .bookmarks ? "bookmark.fill" : "bookmark")
                        }
                        .tag(AppTab.bookmarks)

                    SettingsView()
                        .tabItem {
                            Image(systemName: selectedTab == .settings ? "gearshape.fill" : "gearshape")
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
            }
        SearchView()
            .tabItem {
                Image(systemName: "sparkle.magnifyingglass")
            }
        BookmarksView()
            .tabItem {
                Image(systemName: "bookmark")
            }
        SettingsView()
            .tabItem {
                Image(systemName: "gearshape")
            }
    }
    .environmentObject(CodeLibraryViewModel())
}
#endif
