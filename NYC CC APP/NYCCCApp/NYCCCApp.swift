import SwiftUI
import UIKit

@main
struct NYCCCApp: App {
    @StateObject private var library = CodeLibraryViewModel()
    @State private var selectedTab: AppTab = .browse

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
            ZStack {
                TabView(selection: $selectedTab) {
                    BrowseView()
                        .tabItem {
                            Image(systemName: "text.line.first.and.arrowtriangle.forward")
                            Text("")
                        }
                        .tag(AppTab.browse)
                    SearchView()
                        .tabItem {
                            Image(systemName: "sparkle.magnifyingglass")
                            Text("")
                        }
                        .tag(AppTab.search)

                    BookmarksView()
                        .tabItem {
                            Image(systemName: selectedTab == .bookmarks ? "bookmark.fill" : "bookmark")
                            Text("")
                        }
                        .tag(AppTab.bookmarks)

                    SettingsView()
                        .tabItem {
                            Image(systemName: selectedTab == .settings ? "gearshape.fill" : "gearshape")
                            Text("")
                        }
                        .tag(AppTab.settings)
                }
                .environmentObject(library)
                .tint(Color(uiColor: library.accentColor()))

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
                    .tint(Color(uiColor: library.accentColor()))

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
