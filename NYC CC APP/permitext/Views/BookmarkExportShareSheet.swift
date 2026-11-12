import SwiftUI
import UIKit
import PDFKit

private func removeTemporaryPDF(_ fileURL: URL) {
    try? FileManager.default.removeItem(at: fileURL)
    let directory = fileURL.deletingLastPathComponent()
    if directory.lastPathComponent.hasPrefix("per-codes-report-"),
       directory.deletingLastPathComponent().standardizedFileURL == FileManager.default.temporaryDirectory.standardizedFileURL {
        try? FileManager.default.removeItem(at: directory)
    }
}

/// Minimal `UIActivityViewController` wrapper for sharing a generated PDF
/// out of the app. Cleans up the temp file when the share sheet dismisses
/// so we don't leak tmp/ entries between exports.
struct BookmarkExportShareSheet: UIViewControllerRepresentable {
    let fileURL: URL
    var removesFileWhenFinished = true
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
            if removesFileWhenFinished { removeTemporaryPDF(fileURL) }
            onFinish()
        }
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

/// The preview owns the verified file until it closes. Sharing never rebuilds
/// the PDF or removes a file that PDFKit is still reading.
@MainActor
final class NativeReportPDFPreviewModel: ObservableObject {
    let fileURL: URL
    let document: PDFDocument?
    @Published var currentPage = 1
    weak var pdfView: PDFView?

    var pageCount: Int { document?.pageCount ?? 0 }

    init(fileURL: URL) {
        self.fileURL = fileURL
        document = PDFDocument(url: fileURL)
    }

    func goToPage(_ number: Int) {
        guard number > 0, let page = document?.page(at: number - 1), let pdfView else { return }
        pdfView.go(to: page)
        currentPage = number
    }

    deinit { removeTemporaryPDF(fileURL) }
}

struct ProjectReportPDFPreviewSheet: View {
    @StateObject private var preview: NativeReportPDFPreviewModel
    @State private var showingExport = false
    @State private var showingPagePicker = false
    @State private var pageInput = ""
    let onClose: () -> Void

    init(fileURL: URL, onClose: @escaping () -> Void) {
        _preview = StateObject(wrappedValue: NativeReportPDFPreviewModel(fileURL: fileURL))
        self.onClose = onClose
    }

    var body: some View {
        NavigationStack {
            Group {
                if preview.pageCount > 0 {
                    NativeReportPDFView(preview: preview)
                        .accessibilityIdentifier("native-report-pdf-preview")
                } else {
                    ContentUnavailableView("PDF unavailable", systemImage: "doc.richtext", description: Text("Close this preview and open the report again."))
                }
            }
            .navigationTitle("Report PDF")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close", action: onClose) }
                ToolbarItem(placement: .primaryAction) {
                    Button("Export", systemImage: "square.and.arrow.up") { showingExport = true }
                        .disabled(preview.pageCount == 0)
                        .accessibilityIdentifier("native-report-pdf-export")
                }
                ToolbarItem(placement: .bottomBar) {
                    Button("Page \(preview.currentPage) of \(preview.pageCount)") {
                        pageInput = String(preview.currentPage)
                        showingPagePicker = true
                    }
                    .disabled(preview.pageCount == 0)
                    .accessibilityLabel("Go to page, \(preview.currentPage) of \(preview.pageCount)")
                    .accessibilityIdentifier("native-report-pdf-page")
                }
            }
            .alert("Go to page", isPresented: $showingPagePicker) {
                TextField("1–\(preview.pageCount)", text: $pageInput).keyboardType(.numberPad)
                Button("Cancel", role: .cancel) {}
                Button("Go") { if let number = Int(pageInput) { preview.goToPage(number) } }
                    .disabled(!(1...max(1, preview.pageCount)).contains(Int(pageInput) ?? 0))
            }
            .sheet(isPresented: $showingExport) {
                BookmarkExportShareSheet(fileURL: preview.fileURL, removesFileWhenFinished: false) { showingExport = false }
            }
        }
    }
}

private struct NativeReportPDFView: UIViewRepresentable {
    @ObservedObject var preview: NativeReportPDFPreviewModel

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        view.document = preview.document
        preview.pdfView = view
        context.coordinator.observer = NotificationCenter.default.addObserver(forName: .PDFViewPageChanged, object: view, queue: .main) { [weak view, weak preview] _ in
            guard let document = preview?.document, let page = view?.currentPage else { return }
            let number = document.index(for: page) + 1
            Task { @MainActor in preview?.currentPage = number }
        }
        return view
    }

    func updateUIView(_ view: PDFView, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator() }
    final class Coordinator {
        var observer: NSObjectProtocol?
        deinit { if let observer { NotificationCenter.default.removeObserver(observer) } }
    }
}
