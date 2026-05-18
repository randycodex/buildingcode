import SwiftUI

@main
struct NYCCCApp: App {
    @StateObject private var library = CodeLibraryViewModel()

    var body: some Scene {
        WindowGroup {
            TabView {
                BrowseView()
                    .tabItem {
                        Label("Browse", systemImage: "books.vertical")
                    }
                SearchView()
                    .tabItem {
                        Label("Search", systemImage: "magnifyingglass")
                    }

                BookmarksView()
                    .tabItem {
                        Label("Bookmarks", systemImage: "bookmark")
                    }

                SettingsView()
                    .tabItem {
                        Label("Settings", systemImage: "gearshape")
                    }
            }
            .environmentObject(library)
            .tint(Color(uiColor: library.readerTheme.accentColor))
        }
    }
}

#if DEBUG
#Preview("App Shell") {
    TabView {
        BrowseView()
            .tabItem {
                Label("Browse", systemImage: "books.vertical")
            }
        SearchView()
            .tabItem {
                Label("Search", systemImage: "magnifyingglass")
            }
        BookmarksView()
            .tabItem {
                Label("Bookmarks", systemImage: "bookmark")
            }
        SettingsView()
            .tabItem {
                Label("Settings", systemImage: "gearshape")
            }
    }
    .environmentObject(CodeLibraryViewModel())
}
#endif
