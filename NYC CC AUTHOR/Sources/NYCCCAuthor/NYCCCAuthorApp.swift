import SwiftUI

@main
struct NYCCCAuthorApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var viewModel: AuthoringViewModel

    init() {
        let viewModel = AuthoringViewModel()
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    var body: some Scene {
        WindowGroup("NYC CC AUTHOR") {
            ContentView(viewModel: viewModel)
                .onAppear {
                    viewModel.clearLastSessionRestoreList()
                    appDelegate.openDocuments = { urls in
                        Task { @MainActor in
                            viewModel.openDocuments(at: urls)
                        }
                    }
                    let pendingOpenURLs = appDelegate.drainPendingOpenURLs()
                    if !pendingOpenURLs.isEmpty {
                        viewModel.openDocuments(at: pendingOpenURLs)
                    }
                    for window in NSApp.windows {
                        AppDelegate.configure(window: window)
                    }
                }
        }
        .defaultSize(width: 1380, height: 860)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("Open HTML…") {
                    viewModel.openDocuments()
                }
                .keyboardShortcut("o", modifiers: [.command])

                Button("Save Selected") {
                    viewModel.saveSelectedDocument()
                }
                .keyboardShortcut("s", modifiers: [.command])
                .disabled(!viewModel.hasSelection)

                Button("Save All") {
                    viewModel.saveAllDocuments()
                }
                .keyboardShortcut("S", modifiers: [.command, .shift])
                .disabled(!viewModel.hasDocuments)
            }

            CommandMenu("Structure") {
                Button("Apply to Selected File") {
                    viewModel.applyHeadingPrefixesToSelected()
                }
                .keyboardShortcut("r", modifiers: [.command])
                .disabled(!viewModel.hasSelection)

                Button("Apply to All Open Files") {
                    viewModel.applyHeadingPrefixesToAll()
                }
                .keyboardShortcut("R", modifiers: [.command, .shift])
                .disabled(!viewModel.hasDocuments)

                Divider()

                Button("Export Selected Authored JSON") {
                    viewModel.exportSelectedAsStructuredJSON()
                }
                .disabled(!viewModel.hasSelection)

                Button("Export All Authored JSON") {
                    viewModel.exportAllAsStructuredJSON()
                }
                .disabled(!viewModel.hasDocuments)

                Button(viewModel.isPublishing ? "Publishing to iOS App..." : "Publish All to iOS App") {
                    viewModel.publishAllToIOSApp()
                }
                .disabled(!viewModel.hasDocuments || viewModel.isPublishing)

                Button(viewModel.isExportingPack ? "Exporting Installable Pack..." : "Export Installable Pack") {
                    viewModel.exportInstallablePack()
                }
                .disabled(!viewModel.hasDocuments || viewModel.isExportingPack)
            }
        }
    }
}
