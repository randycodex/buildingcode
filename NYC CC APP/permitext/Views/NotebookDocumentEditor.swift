import SwiftUI
import WebKit

/// Commands are delivered to the mounted editor, so inserting a source or image
/// retains the current selection instead of rebuilding the note's text fields.
@MainActor
final class NotebookDocumentEditorController: ObservableObject {
    @Published fileprivate(set) var isReady = false
    @Published fileprivate(set) var formatting = NotebookDocumentFormatting()
    @Published fileprivate(set) var layoutDiagnostics = ""
    @Published fileprivate(set) var inputDiagnostics = ""
    fileprivate weak var coordinator: NotebookDocumentEditor.Coordinator?

    @discardableResult
    func flush(finalizeEditing: Bool = false) async throws -> NotebookDocument {
        guard let coordinator else { throw NotebookDocumentEditorError.unavailable }
        return try await coordinator.snapshot(finalizeEditing: finalizeEditing)
    }

    func insertReference(_ reference: NotebookReferenceProps) async throws {
        guard let coordinator else { throw NotebookDocumentEditorError.unavailable }
        try await coordinator.performMutation(type: "reference", payload: ["reference": try Self.json(reference)])
    }

    func insertImage(_ block: NotebookBlock) async throws {
        guard block.type == "image" else { throw NotebookDocumentEditorError.invalidDocument }
        guard let coordinator else { throw NotebookDocumentEditorError.unavailable }
        try await coordinator.performMutation(type: "image", payload: ["block": try Self.json(block)])
    }

    func focus() async throws {
        guard let coordinator else { throw NotebookDocumentEditorError.unavailable }
        _ = try await coordinator.command(type: "focus")
    }

    func captureSelection() async throws {
        guard let coordinator else { throw NotebookDocumentEditorError.unavailable }
        _ = try await coordinator.command(type: "captureSelection")
    }

    func dismissKeyboard() async throws {
        guard let coordinator else { throw NotebookDocumentEditorError.unavailable }
        _ = try await coordinator.snapshot(finalizeEditing: true)
    }

    func toggleStyle(_ style: String) async throws {
        guard let coordinator else { throw NotebookDocumentEditorError.unavailable }
        try await coordinator.performMutation(type: "format", payload: ["style": style])
    }

    func setBlockType(_ type: String, level: Int = 2) async throws {
        guard let coordinator else { throw NotebookDocumentEditorError.unavailable }
        try await coordinator.performMutation(type: "blockType", payload: ["blockType": type, "level": level])
    }

    func createLink(url: String, text: String? = nil) async throws {
        guard let coordinator else { throw NotebookDocumentEditorError.unavailable }
        try await coordinator.performMutation(type: "link", payload: ["url": url, "text": text ?? ""])
    }

    func undo() async throws {
        guard let coordinator else { throw NotebookDocumentEditorError.unavailable }
        try await coordinator.performMutation(type: "undo", payload: [:])
    }

    func redo() async throws {
        guard let coordinator else { throw NotebookDocumentEditorError.unavailable }
        try await coordinator.performMutation(type: "redo", payload: [:])
    }

    fileprivate static func json<T: Encodable>(_ value: T) throws -> Any {
        try JSONSerialization.jsonObject(with: JSONEncoder().encode(value))
    }
}

struct NotebookDocumentFormatting: Decodable, Equatable {
    var bold = false
    var italic = false
    var strike = false
    var blockType = "paragraph"
    var selectedText = ""
    var linkURL = ""
}

enum NotebookDocumentEditorError: LocalizedError {
    case unavailable, invalidDocument, assetUnavailable
    var errorDescription: String? {
        switch self {
        case .unavailable: return "The note editor is still loading. Please try again."
        case .invalidDocument: return "The note could not be read safely. Your saved version has not been changed."
        case .assetUnavailable: return "This image is unavailable. Try again when connected."
        }
    }
}

/// A locally packaged continuous rich document. The web editor handles selection,
/// typing and undo. The SwiftUI owner still owns saves, offline drafts and access.
struct NotebookDocumentEditor: UIViewRepresentable {
    @ScaledMetric(relativeTo: .body) private var bodyFontSize = 17.0
    @Binding var document: NotebookDocument
    let isReadOnly: Bool
    let sessionID: String
    let controller: NotebookDocumentEditorController
    var onHeightChange: (CGFloat) -> Void = { _ in }
    var onOpenReference: (NotebookReferenceProps) -> Void = { _ in }
    var onRequestInsertReference: () -> Void = {}
    var onRequestInsertImage: () -> Void = {}
    var onError: (String) -> Void = { _ in }
    var onReplacementConflict: (NotebookDocument, NotebookDocument) -> Void = { _, _ in }
    var resolveAsset: (String) async throws -> Data
    var uploadImage: ((Data, String, String) async throws -> String)? = nil

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.add(context.coordinator, name: "permitextNotebook")
        let view = NotebookDocumentWebView(frame: .zero, configuration: configuration)
        view.inputAssistantItem.leadingBarButtonGroups = []
        view.inputAssistantItem.trailingBarButtonGroups = []
        view.navigationDelegate = context.coordinator
        view.onWidthChange = { [weak coordinator = context.coordinator] width in coordinator?.updateWidth(width) }
        view.isOpaque = false
        view.backgroundColor = .clear
        view.scrollView.backgroundColor = .clear
        view.scrollView.isScrollEnabled = false
        view.scrollView.bounces = false
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.accessibilityIdentifier = "native-notebook-document-editor"
        context.coordinator.attach(view)
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        context.coordinator.update(self)
    }

    static func dismantleUIView(_ view: WKWebView, coordinator: Coordinator) {
        coordinator.detach()
        view.configuration.userContentController.removeScriptMessageHandler(forName: "permitextNotebook")
        view.navigationDelegate = nil
    }

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        var parent: NotebookDocumentEditor
        weak var webView: WKWebView?
        private var mountedSession: String
        private var documentURL: URL?
        private var ready = false
        private var configuring = false
        private var detached = false
        private var revision = -1
        private var displayedDocument: NotebookDocument
        private var pendingReplacement: NotebookDocument?
        private var rejectedReplacement: NotebookDocument?
        private var availableWidth: CGFloat = 0
        private var appliedBodyFontSize: Double?
        private var nativeInputTrace: [[String: Any]] = []
        private var inputTracingEnabled: Bool {
#if DEBUG
            let arguments = ProcessInfo.processInfo.arguments
            return arguments.contains("--native-notebook-reference-fixture")
                && arguments.contains("--native-notebook-input-diagnostics")
#else
            return false
#endif
        }
        private var appliedReadOnly: Bool
        private var tasks: [String: Task<Void, Never>] = [:]

        init(parent: NotebookDocumentEditor) {
            self.parent = parent
            mountedSession = parent.sessionID
            displayedDocument = parent.document
            appliedReadOnly = parent.isReadOnly
        }

        func attach(_ view: WKWebView) {
            webView = view
            parent.controller.coordinator = self
            publishReadinessAfterViewUpdate()
            guard let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "NotebookEditor") else {
                report("The bundled note editor is missing. Reinstall this build before editing Notes.")
                return
            }
            documentURL = url
            view.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }

        func update(_ incoming: NotebookDocumentEditor) {
            guard !detached else { return }
            // The owner should key this view by note ID. Refuse a stale bridge if
            // SwiftUI reuses a UIView across accounts/projects/notes anyway.
            guard incoming.sessionID == mountedSession else {
                report("The note changed while its editor was open. Reopen the note to continue.")
                return
            }
            parent = incoming
            guard ready else { return }
            if incoming.bodyFontSize != appliedBodyFontSize {
                appliedBodyFontSize = incoming.bodyFontSize
                tasks["typography"]?.cancel()
                tasks["typography"] = Task { [weak self] in
                    guard let self, !Task.isCancelled else { return }
                    do { _ = try await command(type: "typography", payload: ["bodyFontSize": parent.bodyFontSize]) }
                    catch { if !Task.isCancelled { report(error.localizedDescription) } }
                }
            }
            if incoming.isReadOnly != appliedReadOnly {
                appliedReadOnly = incoming.isReadOnly
                tasks["access"]?.cancel()
                tasks["access"] = Task { [weak self] in
                    guard let self else { return }
                    do { _ = try await command(type: "readOnly", payload: ["readOnly": appliedReadOnly]) }
                    catch { if !Task.isCancelled { report(error.localizedDescription) } }
                }
            }
            // Most updates are echoes of changes sent by JS or save acks. Do
            // not replace them: replacement discards selection and undo history.
            if incoming.document != displayedDocument,
               incoming.document != rejectedReplacement, pendingReplacement == nil {
                let replacement = incoming.document
                let expectedRevision = revision
                pendingReplacement = replacement
                tasks["replace"] = Task { [weak self] in
                    guard let self, !Task.isCancelled else { return }
                    defer { if pendingReplacement == replacement { pendingReplacement = nil } }
                    do {
                        let result = try await command(type: "replace", payload: [
                            "document": try NotebookDocumentEditorController.json(replacement),
                            "expectedRevision": expectedRevision
                        ])
                        guard !Task.isCancelled else { return }
                        if (result as? [String: Any])?["replacementRejected"] as? Bool == true {
                            let retained = try decodedSnapshot(result)
                            let local = retained.revision >= revision ? retained.document : displayedDocument
                            // Reject this proposal once. Rendering the same
                            // incoming server binding again must not requeue an
                            // overwrite with a newly advanced revision.
                            rejectedReplacement = replacement
                            parent.onReplacementConflict(local, replacement)
                            _ = try acceptSnapshot(result)
                        } else {
                            let newerProposal = parent.document != replacement && parent.document != displayedDocument
                            _ = try acceptSnapshot(result, publish: !newerProposal)
                            if newerProposal {
                                pendingReplacement = nil
                                update(parent)
                            }
                        }
                    } catch { if !Task.isCancelled { report(error.localizedDescription) } }
                }
            }
        }

        func updateWidth(_ width: CGFloat) {
            guard width.isFinite, width > 0, width != availableWidth, !detached else { return }
            availableWidth = width
            guard ready else { return }
            tasks["width"]?.cancel()
            tasks["width"] = Task { [weak self] in
                guard let self, !Task.isCancelled else { return }
                do { _ = try await command(type: "layout", payload: ["availableWidth": availableWidth]) }
                catch { if !Task.isCancelled { report(error.localizedDescription) } }
            }
        }

        func detach() {
            detached = true
            ready = false
            for task in tasks.values { task.cancel() }
            tasks.removeAll()
            if parent.controller.coordinator === self {
                parent.controller.coordinator = nil
                publishReadinessAfterViewUpdate()
            }
        }

        func snapshot(finalizeEditing: Bool = false) async throws -> NotebookDocument {
            guard ready, !detached else { throw NotebookDocumentEditorError.unavailable }
            return try acceptSnapshot(await command(type: "snapshot", payload: ["finalizeEditing": finalizeEditing]))
        }

        func performMutation(type: String, payload: [String: Any]) async throws {
            guard ready, !detached, !parent.isReadOnly else { throw NotebookDocumentEditorError.unavailable }
            _ = try acceptSnapshot(await command(type: type, payload: payload))
        }

        func command(type: String, payload: [String: Any] = [:]) async throws -> Any {
            guard let webView, !detached else { throw NotebookDocumentEditorError.unavailable }
            var input = payload
            input["type"] = type
            input["session"] = mountedSession
            let result = try await webView.callAsyncJavaScript(
                "return await window.PermitextNativeNotebook.dispatch(command);",
                arguments: ["command": input], in: nil, contentWorld: .page
            )
            guard !detached, parent.sessionID == mountedSession else { throw CancellationError() }
            return result ?? NSNull()
        }

        @discardableResult
        private func decodedSnapshot(_ value: Any) throws -> (revision: Int, document: NotebookDocument) {
            guard let message = value as? [String: Any], message["session"] as? String == mountedSession,
                  let number = message["revision"] as? Int,
                  let content = message["document"], JSONSerialization.isValidJSONObject(content) else {
                throw NotebookDocumentEditorError.invalidDocument
            }
            let decoded = try JSONDecoder().decode(NotebookDocument.self, from: JSONSerialization.data(withJSONObject: content))
            guard decoded.schema == "permitext-notebook-card", decoded.schemaVersion == 2,
                  decoded.format == "blocknote-json" else { throw NotebookDocumentEditorError.invalidDocument }
            return (number, decoded)
        }

        @discardableResult
        private func acceptSnapshot(_ value: Any, publish: Bool = true) throws -> NotebookDocument {
            let snapshot = try decodedSnapshot(value)
            let number = snapshot.revision
            let decoded = snapshot.document
            if inputTracingEnabled {
                let block = decoded.document.first
                let encoded = try? JSONEncoder().encode(block)
                nativeInputTrace.append(["milliseconds": Int(Date().timeIntervalSince1970 * 1000),
                    "revision": number, "previousRevision": revision, "accepted": number >= revision,
                    "publish": publish, "firstBlock": encoded.flatMap { String(data: $0, encoding: .utf8) } ?? ""])
                if nativeInputTrace.count > 40 { nativeInputTrace.removeFirst() }
            }
            guard number >= revision else { return displayedDocument }
            revision = number
            displayedDocument = decoded
            acceptFormatting((value as? [String: Any])?["formatting"])
            if publish && parent.document != decoded { parent.document = decoded }
            return decoded
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard !detached, message.frameInfo.isMainFrame,
                  let body = message.body as? [String: Any], body["version"] as? Int == 1,
                  let type = body["type"] as? String else { return }
            if type == "loaded" { configure(); return }
            guard body["session"] as? String == mountedSession else { return }
            switch type {
            case "change":
                do { _ = try acceptSnapshot(body) } catch { report(error.localizedDescription) }
            case "height":
                if let height = body["height"] as? Double, height.isFinite, height > 0 {
                    parent.onHeightChange(CGFloat(min(height, 10_000_000)))
                }
            case "inputDiagnostics":
                guard inputTracingEnabled, let trace = body["trace"] as? [[String: Any]] else { break }
                let combined: [String: Any] = ["bridge": Array(trace.suffix(100)), "native": nativeInputTrace]
                if let data = try? JSONSerialization.data(withJSONObject: combined, options: [.sortedKeys]),
                   let text = String(data: data, encoding: .utf8) {
                    parent.controller.inputDiagnostics = text
                }
            case "diagnostics":
                guard ProcessInfo.processInfo.arguments.contains("--native-notebook-layout-diagnostics"),
                      var diagnostics = body["diagnostics"] as? [String: Any], let webView else { break }
                diagnostics["nativeBoundsWidth"] = webView.bounds.width
                diagnostics["nativeFrameWidth"] = webView.frame.width
                diagnostics["nativeScrollWidth"] = webView.scrollView.bounds.width
                diagnostics["nativeContentWidth"] = webView.scrollView.contentSize.width
                diagnostics["nativeAvailableWidth"] = availableWidth
                if let data = try? JSONSerialization.data(withJSONObject: diagnostics, options: [.sortedKeys]),
                   let text = String(data: data, encoding: .utf8), text != parent.controller.layoutDiagnostics {
                    parent.controller.layoutDiagnostics = text
                }
            case "caret": revealCaret(body)
            case "formatting": acceptFormatting(body["formatting"])
            case "reference":
                if let object = body["reference"], JSONSerialization.isValidJSONObject(object),
                   let data = try? JSONSerialization.data(withJSONObject: object),
                   let reference = try? JSONDecoder().decode(NotebookReferenceProps.self, from: data) {
                    parent.onOpenReference(reference)
                }
            case "insert":
                guard !parent.isReadOnly else { return }
                if body["kind"] as? String == "image" { parent.onRequestInsertImage() }
                else { parent.onRequestInsertReference() }
            case "asset", "upload": resolveImage(type: type, message: body)
            case "error": report(body["message"] as? String ?? "The note editor could not complete this action.")
            default: break
            }
        }

        private func acceptFormatting(_ value: Any?) {
            guard let value, JSONSerialization.isValidJSONObject(value),
                  let data = try? JSONSerialization.data(withJSONObject: value),
                  let formatting = try? JSONDecoder().decode(NotebookDocumentFormatting.self, from: data),
                  formatting != parent.controller.formatting else { return }
            parent.controller.formatting = formatting
        }

        private func configure() {
            guard !configuring, !ready, !detached else { return }
            configuring = true
            tasks["configure"] = Task { [weak self] in
                guard let self else { return }
                do {
                    let initial = parent.document
                    let response = try await command(type: "configure", payload: [
                        "document": try NotebookDocumentEditorController.json(initial), "readOnly": parent.isReadOnly,
                        "bodyFontSize": parent.bodyFontSize, "availableWidth": availableWidth,
                        "diagnostics": ProcessInfo.processInfo.arguments.contains("--native-notebook-layout-diagnostics"),
                        "inputDiagnostics": inputTracingEnabled, "syntheticFixture": inputTracingEnabled
                    ])
                    guard !Task.isCancelled else { return }
                    // Mounting can normalize old block IDs. Accept only if the
                    // owner did not receive a fresher server/draft while loading.
                    _ = try acceptSnapshot(response, publish: parent.document == initial)
                    ready = true
                    // Layout may have resolved while the JS editor mounted.
                    // Apply the latest bounds even if its initial width was zero.
                    _ = try await command(type: "layout", payload: ["availableWidth": availableWidth])
                    configuring = false
                    publishReadinessAfterViewUpdate()
                    update(parent)
                } catch {
                    configuring = false
                    if !Task.isCancelled { report(error.localizedDescription) }
                }
            }
        }

        private func resolveImage(type: String, message: [String: Any]) {
            guard let requestID = message["requestID"] as? String else { return }
            let key = "asset:\(requestID)"
            guard tasks[key] == nil else { return }
            tasks[key] = Task { [weak self] in
                guard let self else { return }
                defer { tasks.removeValue(forKey: key) }
                var reply: [String: Any] = ["requestID": requestID]
                do {
                    if type == "asset", let url = message["url"] as? String {
                        let data = try await parent.resolveAsset(url)
                        guard data.count <= 16 * 1024 * 1024, let mime = Self.imageMIMEType(data) else { throw NotebookDocumentEditorError.assetUnavailable }
                        reply["value"] = "data:\(mime);base64,\(data.base64EncodedString())"
                    } else if type == "upload", !parent.isReadOnly, let upload = parent.uploadImage,
                              let encoded = message["base64"] as? String, encoded.utf8.count <= 12 * 1024 * 1024,
                              let data = Data(base64Encoded: encoded), data.count <= 8 * 1024 * 1024,
                              let mime = Self.imageMIMEType(data) {
                        reply["value"] = try await upload(data, message["name"] as? String ?? "Notebook image", mime)
                    } else {
                        throw NotebookDocumentEditorError.assetUnavailable
                    }
                } catch { reply["error"] = error.localizedDescription }
                guard !Task.isCancelled, !detached else { return }
                do { _ = try await command(type: "assetReply", payload: reply) }
                catch { if !Task.isCancelled { report(error.localizedDescription) } }
            }
        }

        private static func imageMIMEType(_ data: Data) -> String? {
            let bytes = Array(data.prefix(12))
            if bytes.starts(with: [0x89, 0x50, 0x4e, 0x47]) { return "image/png" }
            if bytes.starts(with: [0xff, 0xd8, 0xff]) { return "image/jpeg" }
            if bytes.starts(with: [0x47, 0x49, 0x46, 0x38]) { return "image/gif" }
            if bytes.count >= 12, String(bytes: bytes[0..<4], encoding: .ascii) == "RIFF",
               String(bytes: bytes[8..<12], encoding: .ascii) == "WEBP" { return "image/webp" }
            return nil
        }

        private func revealCaret(_ message: [String: Any]) {
            guard let webView, let x = message["x"] as? Double, let y = message["y"] as? Double,
                  let height = message["height"] as? Double, x.isFinite, y.isFinite, height.isFinite else { return }
            var ancestor = webView.superview
            while let view = ancestor {
                if let scroll = view as? UIScrollView, scroll.isScrollEnabled {
                    let caret = CGRect(x: x, y: y, width: 2, height: max(height, 22)).insetBy(dx: 0, dy: -24)
                    scroll.scrollRectToVisible(webView.convert(caret, to: scroll), animated: false)
                    return
                }
                ancestor = view.superview
            }
        }

        private func publishReadinessAfterViewUpdate() {
            let controller = parent.controller
            DispatchQueue.main.async { [weak controller] in
                guard let controller else { return }
                // Read the live mount, not the coordinator that queued this
                // callback: teardown may be followed by attachment in one render.
                let active = controller.coordinator
                let isReady = active?.ready == true && active?.configuring == false && active?.detached == false
                if controller.isReady != isReady { controller.isReady = isReady }
            }
        }

        private func report(_ message: String) {
            guard !detached else { return }
            // Missing-bundle and session-mismatch failures originate inside
            // make/updateUIView. Deliver their @State callback after rendering.
            DispatchQueue.main.async { [weak self] in
                guard let self, !detached, parent.controller.coordinator === self else { return }
                parent.onError(message)
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { report(error.localizedDescription) }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { report(error.localizedDescription) }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            ready = false
            publishReadinessAfterViewUpdate()
            report("The note editor stopped. Your latest received changes are kept on this device. Reopen the note to continue.")
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
            if url.isFileURL, url.standardizedFileURL == documentURL?.standardizedFileURL { decisionHandler(.allow); return }
            decisionHandler(.cancel)
            if navigationAction.navigationType == .linkActivated,
               ["https", "http", "mailto"].contains(url.scheme?.lowercased() ?? "") {
                UIApplication.shared.open(url)
            }
        }
    }
}

/// WebKit forwards its focused content's accessory request through WKWebView's
/// public UIResponder property. Notes supplies one native formatting toolbar,
/// so the browser's previous/next/Done form accessory is redundant.
private final class NotebookDocumentWebView: WKWebView {
    override var inputAccessoryView: UIView? { nil }
    var onWidthChange: ((CGFloat) -> Void)?

    override func layoutSubviews() {
        super.layoutSubviews()
        onWidthChange?(bounds.width)
    }
}
