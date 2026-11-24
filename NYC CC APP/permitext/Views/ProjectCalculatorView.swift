import SwiftUI

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

enum ProjectCalculatorError: LocalizedError {
    case sourceUnavailable, invalidRequest, noteUnavailable, readOnly
    case engine(String)

    var errorDescription: String? {
        switch self {
        case .sourceUnavailable: "The 2022 Building Code table could not be loaded."
        case .invalidRequest: "This calculation could not be saved. Reopen Calculator and try again."
        case .noteUnavailable: "This Note is no longer available in the project."
        case .readOnly: "This project’s Notes are read-only."
        case .engine(let message): message
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
    @State private var noteRequest: ProjectCalculatorNote?
    @State private var noteReply: CheckedContinuation<ProjectCalculatorDraft.SavedNote?, Error>?

    private static let draftScope = "native-occupant-load-drafts"
    private let cache = ProjectHubOfflineCache()

    var body: some View {
        Group {
            if let page {
                CalculatorForm(page: page, onDrafts: { raw in
                    guard isCurrent(page) else { throw CancellationError() }
                    try cache.store(raw, accountID: page.accountID, projectID: page.projectID, scope: Self.draftScope)
                }, onSave: { request in
                    try await chooseNote(for: request, page: page)
                })
                .id(page.id)
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
            let engine = try ProjectCalculatorEngine(source: source, projectID: projectKey, drafts: drafts)
            let initialState = try engine.open()
            page = CalculatorPage(sessionID: sessionID, accountID: accountID, projectID: projectKey,
                folderID: folder.clientID, source: source, engine: engine, initialState: initialState,
                storedDrafts: drafts, canSave: canSave)
        } catch {
            if !Task.isCancelled { loadError = error.localizedDescription }
        }
    }

    private func chooseNote(for request: ProjectCalculatorNote, page: CalculatorPage) async throws -> ProjectCalculatorDraft.SavedNote? {
        guard isCurrent(page), page.canSave, noteReply == nil else { throw ProjectCalculatorError.invalidRequest }
        return try await withCheckedThrowingContinuation { continuation in
            noteReply = continuation
            noteRequest = request
        }
    }

    private func finishNote(_ saved: ProjectCalculatorDraft.SavedNote?) {
        let reply = noteReply
        noteReply = nil
        noteRequest = nil
        reply?.resume(returning: saved)
    }
}

private struct CalculatorPage {
    let id = UUID()
    let sessionID: UUID
    let accountID: String
    let projectID: String
    let folderID: String
    let source: ProjectOccupantLoadSource
    let engine: ProjectCalculatorEngine
    let initialState: ProjectCalculatorSnapshot
    let storedDrafts: String?
    let canSave: Bool
}

private struct CalculatorNotePicker: View {
    let projectID: String
    let source: ProjectOccupantLoadSource
    let request: ProjectCalculatorNote
    let isCurrent: () -> Bool
    let onFinish: (ProjectCalculatorDraft.SavedNote?) -> Void
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
                onFinish(ProjectCalculatorDraft.SavedNote(id: existing.id, title: existing.title))
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
                onFinish(ProjectCalculatorDraft.SavedNote(id: saved.id, title: saved.title))
            }
        } catch is CancellationError {
        } catch {
            if isCurrent() { saveError = error.localizedDescription }
        }
    }
}

private struct CalculatorForm: View {
    let page: CalculatorPage
    let onDrafts: (String) throws -> Void
    let onSave: (ProjectCalculatorNote) async throws -> ProjectCalculatorDraft.SavedNote?

    @State private var calculation: ProjectCalculatorSnapshot
    @State private var input: [String: String]
    @State private var storedDrafts: String?
    @State private var error: String?
    @State private var savedTitle: String?
    @State private var isSaving = false
    @State private var pendingSave: (fingerprint: String, id: UUID, timestamp: String)?
    @FocusState private var focus: Field?

    private enum Field: String {
        case spaceName, spaceLocation, tableRowID, area, areaMeasurementBasis, userMeasurementBasis
        case factorMode, factor, customReason, seating
    }

    init(page: CalculatorPage, onDrafts: @escaping (String) throws -> Void,
         onSave: @escaping (ProjectCalculatorNote) async throws -> ProjectCalculatorDraft.SavedNote?) {
        self.page = page
        self.onDrafts = onDrafts
        self.onSave = onSave
        _calculation = State(initialValue: page.initialState)
        _input = State(initialValue: page.initialState.record.input)
        _storedDrafts = State(initialValue: page.storedDrafts)
        _savedTitle = State(initialValue: page.initialState.savedTitle)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                inputs.disabled(isSaving)
                result
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
            .padding(.vertical, CodeScreenMetrics.topTitlePadding)
        }
        .scrollIndicators(.hidden, axes: .vertical)
        .scrollDismissesKeyboard(.interactively)
        .codeNavigationTopScrollEdge()
        .codeTransparentBottomScrollEdge()
        .accessibilityIdentifier("project-calculator-form")
        .toolbar {
            if #available(iOS 26.0, *) {
                newCalculationToolbarItem.sharedBackgroundVisibility(.hidden)
            } else {
                newCalculationToolbarItem
            }
        }
        .onAppear { storeDrafts() }
    }

    private var newCalculationToolbarItem: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                switchDraft { try page.engine.create() }
            } label: {
                ToolbarActionIcon(systemImage: "plus")
            }
            .buttonStyle(.plain)
            .codeLiquidGlassCircle()
            .disabled(isSaving)
            .accessibilityLabel("New calculation")
            .accessibilityIdentifier("calculator-new-draft")
        }
    }

    private var row: ProjectCalculatorRow? {
        page.engine.rows.first { $0.id == value(.tableRowID) }
    }

    private var custom: Bool { value(.factorMode) == "custom" && row?.method == .area }
    private var separateMethod: Bool {
        value(.seating) == "fixed-seating" || (row.map { $0.method != .area } ?? false)
    }

    private var inputs: some View {
        VStack(alignment: .leading, spacing: CodeScreenMetrics.rowVerticalPadding) {
            Text("Occupant load").font(.headline).accessibilityAddTraits(.isHeader)
            field("Recent calculations") {
                Menu {
                    Picker("Recent calculations", selection: Binding(
                        get: { calculation.record.id }, set: { id in switchDraft { try page.engine.open(id) } }
                    )) {
                        ForEach(calculation.recent) { draft in Text(draft.title).tag(draft.id) }
                    }
                } label: {
                    HStack(spacing: 6) {
                        Text(calculation.record.title).lineLimit(1)
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Recent calculations")
                .accessibilityValue(calculation.record.title)
                .accessibilityIdentifier("calculator-recent")
            }

            field("Factor source") {
                Picker("Factor source", selection: Binding(get: { custom ? "custom" : "table" }, set: changeFactorMode)) {
                    Text("BC table (default)").tag("table")
                    Text("Custom factor").tag("custom")
                }
                .labelsHidden().pickerStyle(.menu)
                .disabled(row?.method != .area)
                .accessibilityIdentifier("calculator-factor-source")
            }
            field("Space / room name (optional)") {
                TextField("Space / room name", text: binding(.spaceName))
                    .focused($focus, equals: .spaceName)
                    .accessibilityIdentifier("calculator-space-name")
            }
            field("Space location (for footnotes)") {
                Picker("Space location", selection: binding(.spaceLocation)) {
                    Text("Not stated").tag("")
                    Text("Interior only — no rooftop or terrace").tag("interior")
                    Text("Rooftop").tag("rooftop")
                    Text("Terrace").tag("terrace")
                    Text("Mixed / other").tag("mixed")
                }
                .labelsHidden().pickerStyle(.menu)
                .accessibilityIdentifier("calculator-space-location")
            }
            field("Function of space") {
                Picker("Function of space", selection: Binding(get: { row?.id ?? "" }, set: selectRow)) {
                    Text("Select a BC table function").tag("")
                    ForEach(page.engine.rows) { row in Text(row.label).tag(row.id) }
                }
                .labelsHidden().pickerStyle(.menu)
                .accessibilityIdentifier("calculator-function")
            }
            field(row?.areaBasis.isEmpty == false ? "Floor area · \(row?.areaBasis ?? "") ft²" : "Floor area · ft²") {
                TextField("Floor area", text: Binding(get: { value(.area) }, set: changeArea))
                    .keyboardType(.decimalPad)
                    .focused($focus, equals: .area)
                    .accessibilityIdentifier("calculator-area")
            }
            if let row, row.method == .area {
                field("Area basis") { Text(row.areaBasis.capitalized) }.accessibilityElement(children: .combine)
                    .accessibilityLabel("Area basis, \(row.areaBasis)")
                if custom {
                    field("Custom factor · ft²/person") {
                        TextField("Custom factor", text: binding(.factor))
                            .keyboardType(.decimalPad)
                            .focused($focus, equals: .factor)
                            .accessibilityIdentifier("calculator-custom-factor")
                    }
                    Text("BC table: \(row.factor) \(row.areaBasis) ft²/person")
                        .font(.subheadline).foregroundStyle(.secondary)
                    field("Reason / reference (required)") {
                        TextField("Reason / reference", text: binding(.customReason), axis: .vertical)
                            .focused($focus, equals: .customReason)
                            .accessibilityIdentifier("calculator-custom-reason")
                    }
                } else {
                    field("Occupant-load factor · ft²/person") { Text(row.factor) }.accessibilityElement(children: .combine)
                        .accessibilityLabel("Occupant-load factor, \(row.factor) square feet per person")
                }
            }
            field("Seating") {
                Picker("Seating", selection: binding(.seating)) {
                    Text("Confirm seating").tag("")
                    Text("Without fixed seating").tag("without-fixed-seating")
                    Text("Fixed seating — separate method required").tag("fixed-seating")
                }
                .labelsHidden().pickerStyle(.menu)
                .disabled(row?.method == .fixed)
                .accessibilityIdentifier("calculator-seating")
            }
        }
    }

    private var result: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let row {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Table row and footnotes").font(.headline).accessibilityAddTraits(.isHeader)
                    Text(row.description).font(.subheadline)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(.fill.tertiary, in: .rect(cornerRadius: 12))
            }
            if let people = calculation.result.previewPeople {
                Text(people == 1 ? "1 person" : "\(people.formatted()) people")
                    .font(.title2.weight(.semibold))
                    .accessibilityIdentifier("calculator-result")
            }
            if separateMethod {
                Text("Separate method required").font(.headline)
                if let row, row.method != .area {
                    Text(row.factorText).foregroundStyle(.secondary)
                } else {
                    Text("Fixed seating uses a separate calculation method.").foregroundStyle(.secondary)
                }
            } else if !calculation.result.valid, let message = calculation.result.errors.first {
                Text(message).font(.subheadline).foregroundStyle(.secondary)
            }
            Button {
                focus = nil
                Task { await save() }
            } label: {
                Label(saveTitle, systemImage: "square.and.pencil")
                    .font(.body.weight(.medium))
                    .padding(.horizontal, 14)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.plain)
            .codeLiquidGlassCapsule()
            .disabled(!calculation.result.valid || !page.canSave || isSaving)
            .accessibilityIdentifier("calculator-save")
            if let savedTitle {
                Text("Saved to \(savedTitle)").font(.subheadline).foregroundStyle(.secondary)
                    .accessibilityIdentifier("calculator-saved-note")
            }
            if let error {
                Text(error).font(.subheadline).foregroundStyle(.red)
            }
        }
    }

    private var saveTitle: String {
        if isSaving { return "Saving…" }
        if let prior = calculation.record.savedFingerprint, prior != calculation.result.fingerprint {
            return "Add revised calculation to Note…"
        }
        return "Add calculation to Note…"
    }

    private func field<Control: View>(_ title: String, @ViewBuilder content: () -> Control) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.subheadline).foregroundStyle(.secondary)
                .accessibilityHidden(true)
            content()
                .textFieldStyle(.plain)
                .frame(maxWidth: .infinity, minHeight: 36, alignment: .leading)
            Divider()
        }
    }

    private func value(_ field: Field) -> String { input[field.rawValue, default: ""] }

    private func binding(_ field: Field) -> Binding<String> {
        Binding(get: { value(field) }, set: { next in edit { $0[field.rawValue] = next } })
    }

    private func changeArea(_ area: String) {
        edit { input in
            input[Field.area.rawValue] = area
            input[Field.areaMeasurementBasis.rawValue] = row?.areaBasis ?? ""
            input[Field.userMeasurementBasis.rawValue] = row?.areaBasis ?? ""
        }
    }

    private func changeFactorMode(_ mode: String) {
        edit { input in
            input[Field.factorMode.rawValue] = mode
            input[Field.factor.rawValue] = mode == "custom" ? row?.factor : nil
            input[Field.customReason.rawValue] = nil
        }
    }

    private func selectRow(_ id: String) {
        guard id != value(.tableRowID) else { return }
        let next = page.engine.rows.first { $0.id == id }
        edit { input in
            input[Field.tableRowID.rawValue] = id
            input[Field.factorMode.rawValue] = nil
            input[Field.factor.rawValue] = nil
            input[Field.customReason.rawValue] = nil
            if let basis = next?.areaBasis, !basis.isEmpty {
                let priorBasis = value(.areaMeasurementBasis)
                if !priorBasis.isEmpty && priorBasis != basis { input[Field.area.rawValue] = "" }
                input[Field.areaMeasurementBasis.rawValue] = basis
            }
            if next?.method == .fixed { input[Field.seating.rawValue] = "fixed-seating" }
        }
    }

    private func edit(_ change: (inout [String: String]) -> Void) {
        var next = input
        change(&next)
        do {
            calculation = try page.engine.update(calculation.record, input: next)
            // Keep the exact spelling being typed. The shared engine handles calculation and Note normalization.
            input = next
            savedTitle = nil
            storeDrafts()
        } catch { self.error = error.localizedDescription }
    }

    private func switchDraft(_ load: () throws -> ProjectCalculatorSnapshot) {
        focus = nil
        do {
            calculation = try load()
            input = calculation.record.input
            savedTitle = calculation.savedTitle
            pendingSave = nil
            storeDrafts()
        } catch { self.error = error.localizedDescription }
    }

    private func storeDrafts() {
        do {
            if calculation.raw != storedDrafts {
                try onDrafts(calculation.raw)
                storedDrafts = calculation.raw
            }
            error = nil
        } catch { self.error = error.localizedDescription }
    }

    private func save() async {
        guard !isSaving, calculation.result.valid, page.canSave else { return }
        isSaving = true
        defer { isSaving = false }
        do {
            let fingerprint = calculation.result.fingerprint
            if pendingSave?.fingerprint != fingerprint {
                pendingSave = (fingerprint, UUID(), Date().formatted(.iso8601))
            }
            guard let pendingSave else { return }
            let request = try page.engine.note(input: input, id: pendingSave.id, createdAt: pendingSave.timestamp)
            guard let saved = try await onSave(request) else { return }
            self.pendingSave = nil
            savedTitle = saved.title
            calculation = try page.engine.markSaved(calculation.record, note: saved, fingerprint: fingerprint)
            storeDrafts()
        } catch { self.error = error.localizedDescription }
    }
}
