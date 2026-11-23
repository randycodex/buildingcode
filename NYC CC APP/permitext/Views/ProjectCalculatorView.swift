import SwiftUI
import WebKit

struct ProjectOccupantLoadSource: Encodable, Sendable {
    static let sectionID: Int64 = 2152
    static let codeSectionID: Int64 = 1
    static let editionPath = "CodeContent/authored/new-york-city/2022-construction-codes"
    static let codeVersion = editionPath + "/bundle.json#1"

    let source: NotebookEvidenceSource
    let blocks: [CodeContentBlock]
    let excerpt: String

    nonisolated static func load() throws -> Self {
        guard let root = Bundle.main.resourceURL else { throw ProjectCalculatorError.sourceUnavailable }
        let bundle = root.appendingPathComponent(editionPath + "/bundle.json")
        let store = try AuthoredCodeStore(jsonURL: bundle, codeID: 1)
        guard let detail = store.sectionDetail(sectionID: sectionID),
              detail.codeSectionID == codeSectionID, detail.sectionNumber == "1004.1.3",
              !detail.officialText.isEmpty, detail.officialText.utf16.count <= 50_000,
              !detail.contentBlocks.isEmpty else { throw ProjectCalculatorError.sourceUnavailable }
        let identity = String(sectionID)
        return Self(
            source: NotebookEvidenceSource(jurisdiction: "New York City", codePrefix: "BC", codeEdition: "2022",
                codeVersion: codeVersion, sourceID: identity, sectionID: identity, sectionNumber: detail.sectionNumber,
                sectionTitle: detail.title.displayTitle(for: detail.sectionNumber), sourceLibraryVersion: codeVersion),
            blocks: detail.contentBlocks,
            excerpt: detail.officialText
        )
    }
}

private enum ProjectCalculatorError: LocalizedError {
    case sourceUnavailable, invalidRequest, noteUnavailable, readOnly

    var errorDescription: String? {
        switch self {
        case .sourceUnavailable: "The 2022 Building Code table could not be loaded."
        case .invalidRequest: "This calculation could not be saved. Reopen Calculator and try again."
        case .noteUnavailable: "This Note is no longer available in the project."
        case .readOnly: "This project’s Notes are read-only."
        }
    }
}

struct ProjectCalculatorNote: Decodable, Identifiable, Sendable {
    let id: UUID
    let createdAt: String
    let title: String
    let label: String
    let exact: String
    let blocks: [NotebookBlock]

    func adding(to existing: NotebookCard?, projectID: String, source: ProjectOccupantLoadSource) throws
        -> (document: NotebookDocument, links: [NotebookEvidenceLink]) {
        let referenceID = id.uuidString.lowercased()
        guard exact == source.excerpt, !blocks.isEmpty, blocks.count <= 16,
              blocks.contains(where: { block in
                  block.content?.contains { node in
                      node.props?.referenceKind == "selectedPassage" && node.props?.referenceID == referenceID
                  } == true
              }) else { throw ProjectCalculatorError.invalidRequest }
        var document = existing?.document ?? NotebookDocument(document: [])
        document.document.append(contentsOf: blocks)
        let evidence = NotebookEvidenceLink(
            id: referenceID, label: label, relationshipRole: "context", projectID: projectID,
            notebookCardID: existing?.id ?? "", source: source.source,
            passages: [NotebookEvidencePassage(exact: exact, prefix: "", suffix: "", start: nil, end: nil)],
            createdAt: createdAt,
            noteTarget: NotebookEvidenceNoteTarget(scope: "card", blockID: "", exact: ""), noteTextVersion: 1
        )
        return (document, (existing?.evidenceLinks ?? []) + [evidence])
    }
}

struct ProjectCalculatorView: View {
    let folderID: Int64
    let accentColor: Color
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var page: CalculatorPage?
    @State private var loadError: String?
    @State private var retry = 0
    @State private var showsSource = false
    @State private var noteRequest: ProjectCalculatorNote?
    @State private var noteReply: CheckedContinuation<CalculatorSavedNote?, Error>?

    private static let draftScope = "native-occupant-load-drafts"
    private let cache = ProjectHubOfflineCache()

    var body: some View {
        Group {
            if let page {
                CalculatorWebForm(page: page, onDrafts: { raw in
                    guard isCurrent(page) else { throw CancellationError() }
                    try cache.store(raw, accountID: page.accountID, projectID: page.projectID, scope: Self.draftScope)
                }, onOpenSource: {
                    guard isCurrent(page) else { throw CancellationError() }
                    showsSource = true
                }, onSave: { request in
                    try await chooseNote(for: request, page: page)
                }, onError: { message in
                    if isCurrent(page) { loadError = message }
                })
                .id(page.id)
                .safeAreaPadding(.bottom, CodeScreenMetrics.tabBarClearance)
            } else if loadError == nil {
                ProgressView("Loading calculator…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .overlay {
            if let loadError {
                ContentUnavailableView {
                    Label("Calculator unavailable", systemImage: "exclamationmark.circle")
                } description: {
                    Text(loadError)
                } actions: {
                    Button("Try again") { retry += 1 }.buttonStyle(.bordered)
                }
                .background(CodeAppBackdrop(accent: accentColor))
            }
        }
        .background(CodeAppBackdrop(accent: accentColor).ignoresSafeArea())
        .navigationTitle("Calculator")
        .navigationBarTitleDisplayMode(.inline)
        .tint(Color.appChrome)
        .task(id: "\(library.privateSessionID)|\(folderID)|\(retry)") { await prepare() }
        .sheet(isPresented: $showsSource) {
            NavigationStack {
                ReaderView(sectionID: ProjectOccupantLoadSource.sectionID,
                    codeVersion: ProjectOccupantLoadSource.codeVersion, codeSectionID: ProjectOccupantLoadSource.codeSectionID)
            }
            .environmentObject(library)
        }
        .sheet(item: $noteRequest, onDismiss: { finishNote(nil) }) { request in
            if let page {
                CalculatorNotePicker(
                    projectID: page.projectID, source: page.source, request: request,
                    isCurrent: { isCurrent(page) }, onFinish: finishNote
                )
                .environmentObject(library)
            }
        }
        .onChange(of: library.privateSessionID) {
            finishNote(nil)
            showsSource = false
        }
    }

    private func isCurrent(_ page: CalculatorPage) -> Bool {
        library.privateSessionID == page.sessionID &&
            library.folder(id: folderID)?.clientID == page.folderID &&
            (library.backendProjectID(for: folderID) ?? page.folderID) == page.projectID
    }

    private func prepare() async {
        page = nil
        loadError = nil
        guard let folder = library.folder(id: folderID) else { return }
        let owner = library.privateRequestIdentity
        let accountID = owner?.accountID ?? "local-occupant-load"
        let projectID = library.backendProjectID(for: folderID)
        let sessionID = library.privateSessionID
        let canSave = owner != nil && projectID != nil
        let cache = self.cache
        let draftScope = Self.draftScope
        let projectKey = projectID ?? folder.clientID
        do {
            let (source, drafts) = try await Task.detached(priority: .userInitiated) {
                let source = try ProjectOccupantLoadSource.load()
                let drafts = try cache.load(String.self, accountID: accountID, projectID: projectKey,
                    scope: draftScope)?.value
                return (source, drafts)
            }.value
            guard !Task.isCancelled, library.privateSessionID == sessionID,
                  library.folder(id: folderID)?.clientID == folder.clientID else { return }
            page = CalculatorPage(sessionID: sessionID, accountID: accountID, projectID: projectKey,
                folderID: folder.clientID, source: source, drafts: drafts, canSave: canSave)
        } catch {
            if !Task.isCancelled { loadError = error.localizedDescription }
        }
    }

    private func chooseNote(for request: ProjectCalculatorNote, page: CalculatorPage) async throws -> CalculatorSavedNote? {
        guard isCurrent(page), page.canSave, noteReply == nil else { throw ProjectCalculatorError.invalidRequest }
        return try await withCheckedThrowingContinuation { continuation in
            noteReply = continuation
            noteRequest = request
        }
    }

    private func finishNote(_ saved: CalculatorSavedNote?) {
        let reply = noteReply
        noteReply = nil
        noteRequest = nil
        reply?.resume(returning: saved)
    }
}

private struct CalculatorPage: Encodable {
    var id = UUID()
    let sessionID: UUID
    let accountID: String
    let projectID: String
    let folderID: String
    let source: ProjectOccupantLoadSource
    let drafts: String?
    let canSave: Bool

    private enum CodingKeys: String, CodingKey { case projectID, source, blocks, excerpt, drafts, canSave }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(projectID, forKey: .projectID)
        try container.encode(source.source, forKey: .source)
        try container.encode(source.blocks, forKey: .blocks)
        try container.encode(source.excerpt, forKey: .excerpt)
        try container.encode(drafts, forKey: .drafts)
        try container.encode(canSave, forKey: .canSave)
    }
}

private struct CalculatorSavedNote: Sendable {
    let id: String
    let title: String
}

private struct CalculatorNotePicker: View {
    let projectID: String
    let source: ProjectOccupantLoadSource
    let request: ProjectCalculatorNote
    let isCurrent: () -> Bool
    let onFinish: (CalculatorSavedNote?) -> Void
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var cards: [ProjectNotebookCardSummary]?
    @State private var isSaving = false
    @State private var loadError: String?
    @State private var saveError: String?
    @State private var pendingDestination: String?

    var body: some View {
        NavigationStack {
            List {
                if let cards {
                    Button("New Note", systemImage: "square.and.pencil") { choose(nil) }
                        .accessibilityIdentifier("calculator-new-note")
                    if !cards.isEmpty {
                        Section("Existing Notes") {
                            ForEach(cards) { card in
                                Button(card.title.isEmpty ? "Untitled Note" : card.title) { choose(card.id) }
                                    .accessibilityIdentifier("calculator-existing-note-\(card.id)")
                            }
                        }
                    }
                } else if let loadError {
                    Text(loadError).foregroundStyle(.secondary)
                    Button("Retry", action: reload)
                } else {
                    ProgressView()
                }
                if let saveError {
                    Text(saveError).foregroundStyle(.red)
                    Button("Retry save") { choose(pendingDestination) }
                }
            }
            .disabled(isSaving)
            .navigationTitle("Add to Note")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { onFinish(nil) }.disabled(isSaving)
                }
            }
            .overlay { if isSaving { ProgressView("Saving…").padding().background(.regularMaterial, in: .rect(cornerRadius: 16)) } }
        }
        .interactiveDismissDisabled(isSaving)
        .task { await loadNotes() }
    }

    private func reload() { Task { await loadNotes() } }

    private func loadNotes() async {
        loadError = nil
        do {
            let result = try await library.notebookCards(projectID: projectID)
            guard isCurrent(), !Task.isCancelled else { return }
            guard result.access?.readOnly != true else { throw ProjectCalculatorError.readOnly }
            cards = PermitextReleaseSurfaceVisibility.visibleNotebookCards(result.cards).sorted { $0.updatedAt > $1.updatedAt }
        } catch is CancellationError {
        } catch {
            if isCurrent() { loadError = error.localizedDescription }
        }
    }

    private func choose(_ cardID: String?) {
        guard !isSaving, isCurrent() else { return }
        pendingDestination = cardID
        isSaving = true
        saveError = nil
        Task { await save(to: cardID) }
    }

    private func save(to cardID: String?) async {
        defer { isSaving = false }
        do {
            let existing: NotebookCard?
            if let cardID {
                let card = try await library.notebookCard(projectID: projectID, cardID: cardID)
                guard card.projectIDs.contains(projectID) else { throw ProjectCalculatorError.noteUnavailable }
                existing = card
            } else {
                existing = nil
            }
            guard isCurrent(), !Task.isCancelled else { return }
            let referenceID = request.id.uuidString.lowercased()
            if let existing, existing.evidenceLinks.contains(where: { $0.id == referenceID }) {
                onFinish(CalculatorSavedNote(id: existing.id, title: existing.title))
                return
            }
            let content = try request.adding(to: existing, projectID: projectID, source: source)
            let title = existing?.title ?? ResearchNotebookHandoffPresentation.boundedText(
                request.title, maximumUTF16Count: 160
            )
            let saved = try await library.saveNotebookCard(projectID: projectID, cardID: existing?.id,
                expectedVersion: existing?.version ?? 0, title: title, document: content.document,
                evidenceLinks: content.links, clientMutationID: "occupant-load:\(referenceID):\(cardID ?? "new")",
                openQuestions: existing?.openQuestions)
            if isCurrent(), !Task.isCancelled {
                onFinish(CalculatorSavedNote(id: saved.id, title: saved.title))
            }
        } catch is CancellationError {
        } catch {
            if isCurrent() { saveError = error.localizedDescription }
        }
    }
}

private struct CalculatorWebForm: UIViewRepresentable {
    let page: CalculatorPage
    let onDrafts: (String) throws -> Void
    let onOpenSource: () throws -> Void
    let onSave: (ProjectCalculatorNote) async throws -> CalculatorSavedNote?
    let onError: (String) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(form: self) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        let controller = configuration.userContentController
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.isOpaque = false
        view.backgroundColor = .clear
        view.scrollView.keyboardDismissMode = .interactive
        view.navigationDelegate = context.coordinator
        do {
            let scripts = try ["occupant-load-calculation", "calculation-drafts", "ProjectCalculator"].map { name in
                guard let url = Bundle.main.url(forResource: name, withExtension: "js") else {
                    throw ProjectCalculatorError.sourceUnavailable
                }
                return try String(contentsOf: url, encoding: .utf8)
                    .replacingOccurrences(of: #"(?m)^export "#, with: "", options: .regularExpression)
            }
            guard let html = Bundle.main.url(forResource: "ProjectCalculator", withExtension: "html") else {
                throw ProjectCalculatorError.sourceUnavailable
            }
            let source = "(() => {\n" + scripts.joined(separator: "\n") + "\n})();"
            let script = WKUserScript(source: source, injectionTime: .atDocumentEnd,
                forMainFrameOnly: true, in: .defaultClient)
            controller.addUserScript(script)
            controller.addScriptMessageHandler(context.coordinator, contentWorld: .defaultClient, name: "projectCalculator")
            context.coordinator.documentURL = html
            view.loadFileURL(html, allowingReadAccessTo: html)
        } catch {
            Task { @MainActor in onError(error.localizedDescription) }
        }
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.form = self
    }

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "projectCalculator", contentWorld: .defaultClient)
        uiView.navigationDelegate = nil
        uiView.stopLoading()
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandlerWithReply {
        var form: CalculatorWebForm
        var documentURL: URL?

        init(form: CalculatorWebForm) { self.form = form }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
            action.request.url == documentURL ? .allow : .cancel
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            Task {
                do {
                    let json = try JSONEncoder().encode(form.page)
                    _ = try await webView.callAsyncJavaScript("startProjectCalculator(JSON.parse(configuration))",
                        arguments: ["configuration": String(decoding: json, as: UTF8.self)],
                        in: nil, contentWorld: .defaultClient)
                } catch { form.onError(error.localizedDescription) }
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            form.onError(error.localizedDescription)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            form.onError(error.localizedDescription)
        }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) async -> (Any?, String?) {
            do {
                guard message.frameInfo.isMainFrame, let data = message.body as? [String: Any],
                      let type = data["type"] as? String else { throw ProjectCalculatorError.invalidRequest }
                switch type {
                case "source":
                    try form.onOpenSource()
                    return (NSNull(), nil)
                case "drafts":
                    guard let raw = data["value"] as? String else { throw ProjectCalculatorError.invalidRequest }
                    try form.onDrafts(raw)
                    return (NSNull(), nil)
                case "note":
                    guard let payload = data["value"] as? [String: Any] else { throw ProjectCalculatorError.invalidRequest }
                    let request = try JSONDecoder().decode(ProjectCalculatorNote.self,
                        from: JSONSerialization.data(withJSONObject: payload))
                    if let note = try await form.onSave(request) { return (["id": note.id, "title": note.title], nil) }
                    return (NSNull(), nil)
                default:
                    throw ProjectCalculatorError.invalidRequest
                }
            } catch {
                return (nil, error.localizedDescription)
            }
        }
    }
}
