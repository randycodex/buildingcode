import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    var openDocuments: (([URL]) -> Void)?
    private var pendingOpenURLs: [URL] = []

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.activate(ignoringOtherApps: true)
        DispatchQueue.main.async {
            for window in NSApp.windows {
                Self.configure(window: window)
            }
        }
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        if let openDocuments {
            openDocuments(urls)
        } else {
            pendingOpenURLs.append(contentsOf: urls)
        }
    }

    func drainPendingOpenURLs() -> [URL] {
        let urls = pendingOpenURLs
        pendingOpenURLs.removeAll()
        return urls
    }

    @MainActor
    static func configure(window: NSWindow) {
        window.styleMask.insert(.resizable)
        window.collectionBehavior.insert(.fullScreenPrimary)
        window.collectionBehavior.insert(.fullScreenAllowsTiling)
        window.minSize = NSSize(width: 1120, height: 620)
    }
}
