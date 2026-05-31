import SwiftUI
import UIKit

/// Minimal `UIActivityViewController` wrapper for sharing a generated PDF
/// out of the app. Cleans up the temp file when the share sheet dismisses
/// so we don't leak tmp/ entries between exports.
struct BookmarkExportShareSheet: UIViewControllerRepresentable {
    let fileURL: URL
    /// Called when the share sheet finishes (either completed or cancelled).
    /// Hosting view should use this to clear the parent state so SwiftUI
    /// won't re-present the sheet.
    let onFinish: () -> Void

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(
            activityItems: [fileURL],
            applicationActivities: nil
        )
        controller.completionWithItemsHandler = { _, _, _, _ in
            // Delete the temp PDF after the user finishes the share sheet
            // (success or cancel — either way we don't need it any more).
            try? FileManager.default.removeItem(at: fileURL)
            onFinish()
        }
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
