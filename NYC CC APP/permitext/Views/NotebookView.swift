import ImageIO
import PhotosUI
import SwiftUI
import UIKit

struct NativeNotebookReferenceCandidate: Identifiable, Hashable, Sendable {
    let kind: String
    let referenceID: String
    let label: String
    let detail: String
    var conversationID: String? = nil
    var sectionID: String? = nil
    var codeVersion: String? = nil
    var source: NotebookEvidenceSource? = nil
    var passages: [NotebookEvidencePassage] = []

    var id: String { "\(kind):\(referenceID)" }
}

private extension EnvironmentValues {
    @Entry var returnToResearch: (() -> Void)? = nil
}

struct ResearchNotebookHandoff: Identifiable {
    let id: String
    let question: String
    let projectID: String?
}

/// Review the destination before linking an answer to a Note. The immutable answer stays a
/// linked source; it is never copied into the user's professional conclusion.
struct ResearchNotebookHandoffSheet: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.dismiss) private var dismiss
    let handoff: ResearchNotebookHandoff
    let owner: NativePrivateRequestIdentity?
    @State private var projectID: String
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var savedCardID: String?
    @State private var mutationID = UUID().uuidString.lowercased()
    @State private var destinations: [ProjectNotebookCardSummary] = []
    @State private var selectedNoteID = ""
    @State private var loadedProject: String?
    @State private var loadAttempt = 0
    @State private var readOnly = false
    private var preferenceKey: String { "research.destination.\(owner?.accountID ?? "").\(projectID)" }
    @State private var pendingDocument: NotebookDocument

    init(handoff: ResearchNotebookHandoff, owner: NativePrivateRequestIdentity?) {
        self.handoff = handoff
        self.owner = owner
        _projectID = State(initialValue: handoff.projectID ?? "")
        _pendingDocument = State(initialValue: NotebookDocument(document: [
            .reference(kind: "researchAnswer", id: handoff.id, label: ResearchNotebookHandoffPresentation.referenceLabel(question: handoff.question)),
            .paragraph()
        ]))
    }

    private var isCurrentOwner: Bool { owner != nil && owner == library.privateRequestIdentity }
    private var projectName: String { library.folder(forBackendProjectID: projectID)?.name ?? "Project" }
    private var hasProject: Bool {
        library.folders.contains { $0.folderType == .project && library.backendProjectID(for: $0.id) == projectID }
    }

    var body: some View {
        NavigationStack {
            Group {
                if let savedCardID {
                    ProjectNotebookView(
                        projectID: projectID, projectName: projectName, accentColor: .appChrome,
                        referenceCandidates: [NativeNotebookReferenceCandidate(
                            kind: "researchAnswer", referenceID: handoff.id,
                            label: ResearchNotebookHandoffPresentation.referenceLabel(question: handoff.question), detail: "Linked Assistant answer"
                        )], initialCardID: savedCardID
                    )
                    .environment(\.returnToResearch, { dismiss() })
                } else {
                    Form {
                        Section("Destination") {
                            Picker("Project", selection: $projectID) {
                                Text("Choose a Project").tag("")
                                ForEach(library.folders.filter { $0.folderType == .project }) { folder in
                                    if let id = library.backendProjectID(for: folder.id) {
                                        Text(folder.name).tag(id)
                                    }
                                }
                            }
                            .disabled(isSaving)
                            if hasProject {
                                if loadedProject == projectID {
                                    Picker("Note", selection: $selectedNoteID) {
                                        Text("Create new note").tag("")
                                        ForEach(destinations) { note in
                                            Text(note.title.isEmpty ? "Untitled" : note.title).tag(note.id)
                                        }
                                    }
                                    .disabled(isSaving || readOnly)
                                    if readOnly { Text("This project’s notes are read-only.") }
                                } else if errorMessage != nil {
                                    Button("Retry loading notes") { loadAttempt += 1 }
                                } else {
                                    ProgressView("Loading notes")
                                }
                            }
                        }
                        Section("Assistant reference") {
                            Text(handoff.question)
                            Text("The note will link to this answer and its evidence.")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                        if let errorMessage {
                            Section { Text(errorMessage).foregroundStyle(.secondary) }
                        }
                        Section {
                            Button {
                                Task { await addToNotebook() }
                            } label: {
                                HStack {
                                    Text(isSaving ? "Adding…" : "Add to Notebook")
                                    if isSaving { ProgressView() }
                                }
                            }
                            .disabled(!isCurrentOwner || !hasProject || isSaving || loadedProject != projectID || readOnly)
                            .accessibilityIdentifier("research-add-to-notebook-confirm")
                        }
                    }
                }
            }
            .navigationTitle(savedCardID == nil ? "Add to Notebook" : "Notebook")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    if savedCardID == nil { Button("Cancel") { dismiss() }.disabled(isSaving) }
                }
            }
            .interactiveDismissDisabled(isSaving)
            .task(id: "\(projectID):\(loadAttempt)") {
                let target = projectID
                loadedProject = nil
                selectedNoteID = ""
                errorMessage = nil
                guard hasProject, isCurrentOwner else { return }
                do {
                    let response = try await library.notebookCards(projectID: target)
                    guard !Task.isCancelled, isCurrentOwner, projectID == target else { return }
                    destinations = PermitextReleaseSurfaceVisibility.visibleNotebookCards(response.cards)
                    if let last = UserDefaults.standard.string(forKey: preferenceKey),
                       destinations.contains(where: { $0.id == last }) { selectedNoteID = last }
                    readOnly = response.access?.readOnly == true
                    loadedProject = target
                } catch {
                    if !Task.isCancelled, isCurrentOwner { errorMessage = error.localizedDescription }
                }
            }
            .onChange(of: selectedNoteID) { _, _ in
                mutationID = UUID().uuidString.lowercased()
            }
            .onChange(of: projectID) { _, _ in
                // A retry for the same payload retains its mutation identity.
                mutationID = UUID().uuidString.lowercased()
                errorMessage = nil
            }
            .onChange(of: library.privateSessionID) { _, _ in dismiss() }
        }
    }

    private func addToNotebook() async {
        guard isCurrentOwner, hasProject, !isSaving else { return }
        isSaving = true
        defer { if isCurrentOwner { isSaving = false } }
        do {
            let existing = selectedNoteID.isEmpty ? nil : try await library.notebookCard(projectID: projectID, cardID: selectedNoteID)
            guard isCurrentOwner, !Task.isCancelled else { return }
            var document = existing?.document ?? pendingDocument
            if let existing {
                if document.document.contains(where: { $0.id == pendingDocument.document[0].id }) {
                    savedCardID = existing.id
                    return
                }
                document.document.append(contentsOf: pendingDocument.document)
            }
            let card = try await library.saveNotebookCard(
                projectID: projectID, cardID: existing?.id, expectedVersion: existing?.version ?? 0,
                title: existing?.title ?? ResearchNotebookHandoffPresentation.boundedText(handoff.question, maximumUTF16Count: 160), document: document,
                evidenceLinks: existing?.evidenceLinks ?? [], clientMutationID: mutationID
            )
            guard isCurrentOwner, !Task.isCancelled else { return }
            UserDefaults.standard.set(card.id, forKey: preferenceKey)
            savedCardID = card.id
            errorMessage = nil
        } catch {
            guard isCurrentOwner, !Task.isCancelled else { return }
            errorMessage = error.localizedDescription
        }
    }
}

private struct NativeNotebookEditorRoute: Identifiable, Hashable {
    let id: String
    let cardID: String?

    init(cardID: String? = nil, draftID: String? = nil) {
        self.id = draftID ?? cardID ?? "new:\(UUID().uuidString.lowercased())"
        self.cardID = cardID
    }
}

struct ProjectNotebookView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.scenePhase) private var scenePhase

    let projectID: String
    let projectName: String
    let accentColor: Color
    let referenceCandidates: [NativeNotebookReferenceCandidate]
    let initialCardID: String?
    let startNewNote: Bool
    var cacheDirectoryURL: URL? = nil
    var onChanged: (() -> Void)? = nil

    init(
        projectID: String,
        projectName: String,
        accentColor: Color,
        referenceCandidates: [NativeNotebookReferenceCandidate],
        initialCardID: String? = nil,
        startNewNote: Bool = false,
        cacheDirectoryURL: URL? = nil,
        onChanged: (() -> Void)? = nil
    ) {
        self.projectID = projectID
        self.projectName = projectName
        self.accentColor = accentColor
        self.referenceCandidates = referenceCandidates
        self.initialCardID = initialCardID
        self.startNewNote = startNewNote
        self.cacheDirectoryURL = cacheDirectoryURL
        self.onChanged = onChanged
    }

    var body: some View {
        ProjectNotebookSessionView(
            projectID: projectID, projectName: projectName, accentColor: accentColor,
            referenceCandidates: referenceCandidates, initialCardID: initialCardID, startNewNote: startNewNote,
            onChanged: onChanged, owner: library.privateRequestIdentity, cacheDirectoryURL: cacheDirectoryURL
        ).id(library.privateSessionID)
    }
}

func nativeNotebookCachedCardType(
    cache: ProjectHubOfflineCache, accountID: String, projectID: String, cardID: String
) -> String? {
    if let card = try? cache.load(NotebookCard.self, accountID: accountID, projectID: projectID,
                                  scope: "native-notebook-card:\(cardID)")?.value {
        return card.cardType
    }
    return (try? cache.load(NotebookCardListResponse.self, accountID: accountID, projectID: projectID,
                            scope: "native-notebook-list"))?.value.cards.first { $0.id == cardID }?.cardType
}

enum NativeNotebookOfflineDraftPolicy {
    static func permitsDraftEditing(cachedAccess: NotebookAccess?, after error: Error) -> Bool {
        guard let cachedAccess, !cachedAccess.readOnly,
              ["owner", "editor", "admin"].contains(cachedAccess.role.lowercased()) else { return false }
        return NativePrivateCachePolicy.permitsOfflineFallback(after: error)
    }
}

private struct ProjectNotebookSessionView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase

    let projectID: String
    let projectName: String
    let accentColor: Color
    let referenceCandidates: [NativeNotebookReferenceCandidate]
    let initialCardID: String?
    let startNewNote: Bool
    var onChanged: (() -> Void)? = nil

    @State private var cards: [ProjectNotebookCardSummary] = []
    @State private var localDrafts: [(scope: String, value: NativeNotebookDraft)] = []
    @State private var access = NotebookAccess(role: "viewer", readOnly: true)
    @State private var permitsLocalDraftEditing = false
    @State private var isLoading = true
    @State private var loadID: UUID?
    @State private var errorMessage: String?
    @State private var editorRoute: NativeNotebookEditorRoute?
    @State private var isVisible = false
    @State private var shouldRefreshAfterBackground = false
    @State private var hasPresentedInitialCard = false
    @State private var isSelectingNotes = false
    @State private var selectedNoteIDs: Set<String> = []
    @State private var isMovingNotes = false
    @State private var showingMoveConfirmation = false
    @State private var moveError: String?
    @State private var directEditorID = "new:\(UUID().uuidString.lowercased())"
    private let cache: ProjectHubOfflineCache
    private let owner: NativePrivateRequestIdentity?
    private var isCurrentOwner: Bool { owner != nil && owner == library.privateRequestIdentity }
    private var selectableNoteIDs: Set<String> {
        guard access.role == "owner", !access.readOnly else { return [] }
        return Set(cards.map(\.id)).subtracting(localDrafts.compactMap { $0.value.cardID })
    }
    private var editorReferenceCandidates: [NativeNotebookReferenceCandidate] {
        referenceCandidates + cards.map { card in
            let title = card.title.isEmpty ? "Untitled Note" : card.title
            return NativeNotebookReferenceCandidate(kind: "notebookCard", referenceID: card.id,
                label: "Notebook: \(title)", detail: "Other Note")
        }
    }

    init(
        projectID: String,
        projectName: String,
        accentColor: Color,
        referenceCandidates: [NativeNotebookReferenceCandidate],
        initialCardID: String? = nil,
        startNewNote: Bool = false,
        onChanged: (() -> Void)? = nil,
        owner: NativePrivateRequestIdentity?,
        cacheDirectoryURL: URL? = nil
    ) {
        self.owner = owner
        self.cache = ProjectHubOfflineCache(directoryURL: cacheDirectoryURL)
        self.projectID = projectID
        self.projectName = projectName
        self.accentColor = accentColor
        self.referenceCandidates = referenceCandidates
        self.initialCardID = initialCardID
        self.startNewNote = startNewNote
        self.onChanged = onChanged
    }

    var body: some View {
        Group {
            if initialCardID != nil || startNewNote {
                if hasPresentedInitialCard && startNewNote && access.readOnly && !permitsLocalDraftEditing {
                    ContentUnavailableView("Read-only Notebook", systemImage: "lock",
                        description: Text("Your project role does not allow creating notes."))
                } else if hasPresentedInitialCard {
                    NotebookCardEditorView(
                        projectID: projectID, projectName: projectName,
                        routeID: initialCardID ?? directEditorID, cardID: initialCardID,
                        readOnly: access.readOnly && !permitsLocalDraftEditing, localDraftOnly: permitsLocalDraftEditing,
                        notebookRole: access.role, accentColor: accentColor,
                        referenceCandidates: editorReferenceCandidates, owner: owner,
                        onSaved: { onChanged?() }, cache: cache
                    )
                } else if let errorMessage {
                    ContentUnavailableView("Note unavailable", systemImage: "note.text",
                        description: Text(errorMessage))
                } else {
                    ProgressView().accessibilityLabel("Opening note")
                }
            } else {
                notebookList
            }
        }
        .task {
            await loadCards()
            guard !Task.isCancelled, isCurrentOwner else { return }
            if !hasPresentedInitialCard, initialCardID != nil || startNewNote {
                hasPresentedInitialCard = true
                // Render the editor in this destination itself. Done returns
                // directly to the project that opened it, without a second list.
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { shouldRefreshAfterBackground = true }
            guard phase == .active, shouldRefreshAfterBackground else { return }
            shouldRefreshAfterBackground = false
            guard isVisible, editorRoute == nil else { return }
            Task { await loadCards(forceNetwork: true) }
        }
        .onAppear { isVisible = true }
        .onDisappear { isVisible = false }
        .onChange(of: library.notebookReconnectRevision) {
            guard isVisible, editorRoute == nil, initialCardID == nil, !startNewNote else { return }
            Task { await loadCards(forceNetwork: true) }
            onChanged?()
        }
        .navigationDestination(item: $editorRoute) { route in
            Group {
                NotebookCardEditorView(
                    projectID: projectID,
                    projectName: projectName,
                    routeID: route.id,
                    cardID: route.cardID,
                    readOnly: access.readOnly && !permitsLocalDraftEditing,
                    localDraftOnly: permitsLocalDraftEditing,
                    notebookRole: access.role,
                    accentColor: accentColor,
                    referenceCandidates: editorReferenceCandidates,
                    owner: owner,
                    onSaved: {
                        guard isCurrentOwner else { return }
                        Task { await loadCards(forceNetwork: true) }
                        onChanged?()
                    },
                    cache: cache
                )
                .environmentObject(library)
            }
        }
    }

    private var notebookList: some View {
        VStack(spacing: 0) {
            Group {
                if isLoading && cards.isEmpty && localDrafts.isEmpty {
                    ProgressView("Loading Notebook…")
                } else if cards.isEmpty && localDrafts.isEmpty, let errorMessage {
                    NativeNotebookLoadFailureView(message: errorMessage) {
                        Task { await loadCards(forceNetwork: true) }
                    }
                } else if cards.isEmpty && localDrafts.isEmpty {
                    ContentUnavailableView(
                        "No Notes yet",
                        systemImage: "note.text",
                        description: Text(access.readOnly ? "This Project’s Notebook is read-only." : "Create a Note for analysis, evidence, and code research.")
                    )
                } else {
                    List {
                        if let errorMessage {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(errorMessage).font(.footnote).foregroundStyle(.secondary)
                                Button("Retry") { Task { await loadCards(forceNetwork: true) } }
                            }
                        }
                        if !localDrafts.isEmpty {
                            Section("Drafts on this iPhone") {
                                ForEach(localDrafts, id: \.scope) { entry in
                                    Button {
                                        editorRoute = NativeNotebookEditorRoute(cardID: entry.value.cardID, draftID: String(entry.scope.dropFirst("native-notebook-draft:".count)))
                                    } label: {
                                        noteListLabel(title: entry.value.title, date: entry.value.editedAt)
                                    }
                                    .disabled(isSelectingNotes)
                                }
                            }
                        }
                        ForEach(cards) { card in
                            Button {
                                if isSelectingNotes {
                                    if !selectedNoteIDs.insert(card.id).inserted { selectedNoteIDs.remove(card.id) }
                                } else {
                                    editorRoute = NativeNotebookEditorRoute(cardID: card.id)
                                }
                            } label: {
                                HStack(spacing: 12) {
                                    if isSelectingNotes {
                                        ListSelectionIndicator(isSelected: selectedNoteIDs.contains(card.id))
                                    }
                                    noteListLabel(title: card.title, date: ListTimestamp.date(from: card.updatedAt))
                                }
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .disabled(isSelectingNotes && !selectableNoteIDs.contains(card.id))
                            .accessibilityAddTraits(isSelectingNotes && selectedNoteIDs.contains(card.id) ? .isSelected : [])
                        }
                    }
                    .listStyle(.plain)
                    .codeNavigationTopScrollEdge()
                    .codeTransparentBottomScrollEdge()
                    .refreshable { await loadCards(forceNetwork: true) }
                }
            }
        }
        .navigationTitle("Notes")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(isSelectingNotes)
        .disabled(isMovingNotes)
        .toolbar {
            if isSelectingNotes {
                ListSelectionToolbar(
                    selectedCount: selectedNoteIDs.intersection(selectableNoteIDs).count,
                    availableCount: selectableNoteIDs.count,
                    isBusy: isMovingNotes,
                    cancel: finishSelectingNotes,
                    selectAll: { selectedNoteIDs = selectableNoteIDs },
                    deselectAll: { selectedNoteIDs = [] }
                ) {
                    Button(role: .destructive) {
                        showingMoveConfirmation = true
                    } label: {
                        ToolbarActionIcon(systemImage: "trash")
                    }
                    .accessibilityLabel("Move selected notes to Trash")
                    .disabled(isLoading)
                }
            } else if !selectableNoteIDs.isEmpty || !access.readOnly || permitsLocalDraftEditing {
                IconToolbarGroup {
                    if !selectableNoteIDs.isEmpty {
                        ListSelectButton(title: "Select notes") {
                            ListSelectionMotion.run(reduceMotion: reduceMotion) { isSelectingNotes = true }
                        }
                        .disabled(isLoading)
                    }
                    if !access.readOnly || permitsLocalDraftEditing {
                        Button {
                            editorRoute = NativeNotebookEditorRoute()
                        } label: {
                            ToolbarActionIcon(systemImage: "plus")
                        }
                        .accessibilityLabel("New Note")
                    }
                }
            }
        }
        .onChange(of: selectableNoteIDs) { _, ids in
            selectedNoteIDs.formIntersection(ids)
        }
        .alert(selectedNoteIDs.count == 1 ? "Move this note to Trash?" : "Move \(selectedNoteIDs.count) notes to Trash?",
               isPresented: $showingMoveConfirmation) {
            Button("Move to Trash", role: .destructive) { Task { await moveSelectedNotesToTrash() } }
                .disabled(selectedNoteIDs.isEmpty)
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("You can restore \(selectedNoteIDs.count == 1 ? "this note" : "these notes") from Trash for 30 days.")
        }
        .alert("Could not move all selected notes", isPresented: Binding(get: { moveError != nil }, set: { if !$0 { moveError = nil } })) {
            Button("OK", role: .cancel) { moveError = nil }
        } message: {
            Text(moveError ?? "")
        }
        .tint(accentColor)
    }

    private func finishSelectingNotes() {
        guard isSelectingNotes else { return }
        ListSelectionMotion.run(reduceMotion: reduceMotion) {
            isSelectingNotes = false
            selectedNoteIDs = []
        }
    }

    @MainActor
    private func moveSelectedNotesToTrash() async {
        guard isCurrentOwner, let owner, !isMovingNotes, !isLoading else { return }
        let targets = cards.filter { selectedNoteIDs.contains($0.id) && selectableNoteIDs.contains($0.id) }
        guard !targets.isEmpty else { return }
        isMovingNotes = true
        defer { isMovingNotes = false }
        var movedIDs: Set<String> = []
        do {
            let drafts = try cache.entries(NativeNotebookDraft.self, accountID: owner.accountID,
                projectID: projectID, scopePrefix: "native-notebook-draft:")
            let unsynced = Set(drafts.filter { $0.value.hasUnsynchronizedChanges }.compactMap { $0.value.cardID })
            if targets.contains(where: { unsynced.contains($0.id) }) {
                throw NotebookTrashError.unsyncedDraft
            }
            for card in targets {
                guard isCurrentOwner else { return }
                try await library.deleteNotebookCard(projectID: projectID, cardID: card.id,
                    expectedVersion: card.version, recoverable: true)
                guard isCurrentOwner else { return }
                movedIDs.insert(card.id)
                cards.removeAll { $0.id == card.id }
                selectedNoteIDs.remove(card.id)
                try? cache.remove(accountID: owner.accountID, projectID: projectID, scope: "native-notebook-card:\(card.id)")
            }
            finishSelectingNotes()
        } catch {
            guard isCurrentOwner else { return }
            let detail = nativeNotebookRequestErrorMessage(error)
            moveError = movedIDs.isEmpty ? detail : "\(movedIDs.count) moved to Trash. \(detail)"
        }
        guard isCurrentOwner else { return }
        if !movedIDs.isEmpty {
            if let cached = try? cache.load(NotebookCardListResponse.self, accountID: owner.accountID,
                projectID: projectID, scope: "native-notebook-list")?.value {
                let remaining = cached.cards.filter { !movedIDs.contains($0.id) }
                try? cache.store(NotebookCardListResponse(schemaVersion: cached.schemaVersion,
                    projectID: cached.projectID, cards: remaining, access: cached.access),
                    accountID: owner.accountID, projectID: projectID, scope: "native-notebook-list")
            }
            onChanged?()
        }
        await loadCards(forceNetwork: true)
        if selectableNoteIDs.isEmpty { finishSelectingNotes() }
    }

    private enum NotebookTrashError: LocalizedError {
        case unsyncedDraft
        var errorDescription: String? { "Open and sync the selected draft before moving its note to Trash." }
    }

    private func loadCards(forceNetwork: Bool = false) async {
        guard isCurrentOwner, let owner else {
            cards = []
            access = NotebookAccess(role: "viewer", readOnly: true)
            errorMessage = "Sign in to load this Notebook."
            isLoading = false
            return
        }
        let storedDrafts = (try? cache.entries(NativeNotebookDraft.self, accountID: owner.accountID, projectID: projectID, scopePrefix: "native-notebook-draft:"))?.filter {
            $0.value.hasUnsynchronizedChanges
        }.sorted { ($0.value.editedAt ?? .distantPast) > ($1.value.editedAt ?? .distantPast) } ?? []
        localDrafts = storedDrafts.filter { entry in
            guard let cardID = entry.value.cardID else { return true }
            guard let type = nativeNotebookCachedCardType(cache: cache, accountID: owner.accountID, projectID: projectID, cardID: cardID)
            else { return PermitextReleaseSurfaceVisibility.coordination }
            return PermitextReleaseSurfaceVisibility.notebookCardIsVisible(type)
        }
        let cachedAccess = (try? cache.load(NotebookCardListResponse.self, accountID: owner.accountID,
            projectID: projectID, scope: "native-notebook-list"))?.value.access
        let requestID = UUID()
        loadID = requestID
        if !forceNetwork, cards.isEmpty, let cached = try? cache.load(
            NotebookCardListResponse.self, accountID: owner.accountID,
            projectID: projectID, scope: "native-notebook-list"
        ) {
            cards = PermitextReleaseSurfaceVisibility.visibleNotebookCards(cached.value.cards)
            // Cached access is descriptive; an online response authorizes edits.
            access = NotebookAccess(role: "viewer", readOnly: true)
        }
        isLoading = true
        defer { if isCurrentOwner && loadID == requestID { isLoading = false } }
        do {
            let response = try await library.notebookCards(projectID: projectID)
            guard isCurrentOwner, loadID == requestID, !Task.isCancelled else { return }
            cards = PermitextReleaseSurfaceVisibility.visibleNotebookCards(response.cards).sorted { $0.updatedAt > $1.updatedAt }
            localDrafts = storedDrafts.filter { entry in
                guard let cardID = entry.value.cardID else { return true }
                guard let card = response.cards.first(where: { $0.id == cardID })
                else { return localDrafts.contains { $0.scope == entry.scope } }
                return PermitextReleaseSurfaceVisibility.notebookCardIsVisible(card.cardType)
            }
            access = response.access ?? NotebookAccess(role: "editor", readOnly: false)
            permitsLocalDraftEditing = false
            errorMessage = nil
            try? cache.store(response, accountID: owner.accountID, projectID: projectID, scope: "native-notebook-list")
        } catch {
            guard isCurrentOwner, loadID == requestID, !Task.isCancelled else { return }
            permitsLocalDraftEditing = access.readOnly && NativeNotebookOfflineDraftPolicy.permitsDraftEditing(cachedAccess: cachedAccess, after: error)
            if !NativePrivateCachePolicy.permitsOfflineFallback(after: error) {
                cards = []
                access = NotebookAccess(role: "viewer", readOnly: true)
            }
            if NativePrivateCachePolicy.requiresInvalidation(after: error) {
                library.invalidateProjectDashboardPreview(projectID: projectID)
                try? cache.removeProject(accountID: owner.accountID, projectID: projectID)
                localDrafts = []
                editorRoute = nil
            }
            errorMessage = nativeNotebookRequestErrorMessage(error)
        }
    }

    private func noteListLabel(title: String, date: Date?) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Untitled Note" : title)
                .font(.body.weight(.semibold))
                .foregroundStyle(.primary)
            if let date {
                Text(date.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 6)
    }
}

private func nativeNotebookRequestErrorMessage(_ error: Error) -> String {
    if let status = (error as? PermitextBackendHTTPError)?.statusCode, status == 404 || status == 403 {
        return "This Note is unavailable. It may have been removed or your access may have changed. Check that the Note still exists and you have access to its project."
    }
    if let error = error as? URLError {
        switch error.code {
        case .notConnectedToInternet, .networkConnectionLost, .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed:
            return "Unable to connect. Check your internet connection, then try again."
        case .fileDoesNotExist:
            return "This Note is unavailable. It may have been removed or your access may have changed. Check that the Note still exists and you have access to its project."
        case .timedOut:
            return "The Notebook request timed out. Try again."
        default:
            return "The Notebook request could not be completed. Try again."
        }
    }
    if error is CancellationError { return "The request was interrupted. Your draft is still available to retry." }
    return error.localizedDescription
}

struct NativeNotebookLoadFailureView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        ContentUnavailableView {
            Label("Notebook unavailable", systemImage: "exclamationmark.arrow.triangle.2.circlepath")
        } description: {
            Text(message)
        } actions: {
            Button("Retry", action: retry)
                .accessibilityIdentifier("native-notebook-retry")
        }
    }
}

/// The explicit overwrite review includes nested text, images and evidence.
private struct NativeNotebookConflictPreview: View {
    let projectID: String
    let document: NotebookDocument
    let evidenceLinks: [NotebookEvidenceLink]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(flattened(document.document), id: \.block.id) { entry in
                VStack(alignment: .leading, spacing: 6) {
                    if entry.block.type == "image" {
                        NotebookAssetImage(projectID: projectID, url: entry.block.props.url ?? "")
                        Text(entry.block.props.name ?? "Image").font(.caption)
                        if let caption = entry.block.props.caption, !caption.isEmpty { Text(caption) }
                    } else {
                        Text(inlineText(entry.block.content ?? []))
                            .font(entry.block.type == "heading" ? .headline : .body)
                    }
                }
                .padding(.leading, CGFloat(entry.depth) * 12)
            }
            ForEach(evidenceLinks) { link in
                Label(link.label, systemImage: "text.quote").font(.footnote)
                Text("\(link.source.codePrefix) \(link.source.sectionNumber) · \(link.source.codeEdition)")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }

    private func flattened(_ blocks: [NotebookBlock], depth: Int = 0) -> [(block: NotebookBlock, depth: Int)] {
        blocks.flatMap { [($0, depth)] + flattened($0.children, depth: depth + 1) }
    }

    private func inlineText(_ values: [NotebookInlineContent]) -> AttributedString {
        values.reduce(into: AttributedString()) { result, value in
            var text = AttributedString(value.text ?? value.props?.label ?? "")
            if value.styles?.bold == true { text.inlinePresentationIntent = .stronglyEmphasized }
            if value.styles?.italic == true { text.inlinePresentationIntent = (text.inlinePresentationIntent ?? []).union(.emphasized) }
            if value.styles?.strike == true { text.strikethroughStyle = .single }
            result.append(text)
            if let children = value.content { result.append(inlineText(children)) }
            if let href = value.href { result.append(AttributedString(" (\(href))")) }
        }
    }
}

struct NativeNotebookDraft: Codable, Hashable, Sendable {
    var cardID: String?
    var version: Int
    var title: String
    var document: NotebookDocument
    var evidenceLinks: [NotebookEvidenceLink]
    var openQuestions: [NotebookQuestion]? = nil
    var editedAt: Date? = nil
    var clientMutationID: String? = nil
    var pendingSave: NativeNotebookSaveAttempt? = nil
    var baseContent: NativeNotebookEditableContent? = nil
    var retryAfterReconnect: Bool? = nil

    var hasUnsynchronizedChanges: Bool {
        pendingSave != nil || baseContent != NativeNotebookEditableContent(title: title, document: document, evidenceLinks: evidenceLinks, openQuestions: openQuestions)
    }

    var editableContent: NativeNotebookEditableContent {
        let hasQuestions = !(openQuestions ?? []).isEmpty ||
            !(baseContent?.openQuestions ?? []).isEmpty || !(pendingSave?.content.openQuestions ?? []).isEmpty
        return NativeNotebookEditableContent(title: title, document: document, evidenceLinks: evidenceLinks,
                                             openQuestions: hasQuestions ? (openQuestions ?? []) : nil)
    }
}

/// Persist the exact request until its acknowledgement arrives. A later edit must
/// not turn an uncertain create into a second create with a different key/body.
struct NativeNotebookSaveAttempt: Codable, Hashable, Sendable {
    let clientMutationID: String
    let cardID: String?
    let expectedVersion: Int
    let content: NativeNotebookEditableContent
    // Missing on older receipts: replay their original question field unchanged.
    var preservesServerQuestions: Bool? = nil
}

struct NativeNotebookEditableContent: Codable, Hashable, Sendable {
    var title: String
    var document: NotebookDocument
    var evidenceLinks: [NotebookEvidenceLink]
    var openQuestions: [NotebookQuestion]? = nil

    static func savedCard(_ card: NotebookCard) -> Self {
        Self(title: card.title, document: card.document, evidenceLinks: card.evidenceLinks,
             openQuestions: card.openQuestions?.isEmpty == false ? card.openQuestions : nil)
    }
}

/// Decide from the live draft after a refresh completes, never a snapshot made
/// before awaiting the server. A pending mutation must keep its original receipt.
enum NativeNotebookRefreshDecision: Equatable {
    case applyServer, preservePending, reviewConflict, preserveDraft

    static func resolve(draft: NativeNotebookDraft?, serverVersion: Int,
                        serverContent: NativeNotebookEditableContent) -> Self {
        guard let draft, draft.hasUnsynchronizedChanges else { return .applyServer }
        if draft.pendingSave != nil { return .preservePending }
        if draft.version != serverVersion { return .reviewConflict }
        let current = NativeNotebookEditableContent(title: draft.title, document: draft.document,
                                                    evidenceLinks: draft.evidenceLinks, openQuestions: draft.openQuestions)
        return current == serverContent ? .applyServer : .preserveDraft
    }
}

/// SwiftUI can deliver title/document onChange after a cached or server apply.
/// Track that programmatic baseline separately from the last synced revision.
struct NativeNotebookEditObservation {
    private(set) var content: NativeNotebookEditableContent?

    mutating func reset(to content: NativeNotebookEditableContent) {
        self.content = content
    }

    mutating func consumeChange(to content: NativeNotebookEditableContent) -> Bool {
        guard self.content != content else { return false }
        self.content = content
        return true
    }
}

private struct NotebookLinkEditor: Identifiable {
    let id: String
}

private enum NotebookReferencePicker: String, Identifiable {
    case sources, notes
    var id: Self { self }
}

private struct NotebookCardEditorView: View {
    @Environment(\.returnToResearch) private var returnToResearch
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var documentEditor = NotebookDocumentEditorController()
    @State private var editorHeight: CGFloat = 360
    @State private var showingPhotoPicker = false
    @State private var referenceRoute: NativeNotebookReferenceRoute?
    @State private var isLeaving = false
    @State private var isEditorVisible = false
    @State private var restoreCaretOnReturn = false

    let projectID: String
    let projectName: String
    let routeID: String
    let cardID: String?
    let readOnly: Bool
    var localDraftOnly: Bool = false
    var notebookRole: String = "viewer"
    let accentColor: Color
    let referenceCandidates: [NativeNotebookReferenceCandidate]
    let owner: NativePrivateRequestIdentity?
    private var isCurrentOwner: Bool { owner != nil && owner == library.privateRequestIdentity }
    let onSaved: () -> Void

    @State private var hasDeniedWriteAccess = false
    private var editingReadOnly: Bool { readOnly || hasDeniedWriteAccess }
    @State private var freshWriteRole: String?
    private var canPerformNetworkWrites: Bool { !editingReadOnly && (!localDraftOnly || freshWriteRole != nil) }
    private var canMoveNoteToTrash: Bool { (freshWriteRole ?? notebookRole).lowercased() == "owner" }

    @State private var currentCardID: String?
    @State private var version = 0
    @State private var title = "Untitled Note"
    @State private var document = NotebookDocument.empty
    @State private var evidenceLinks: [NotebookEvidenceLink] = []
    @State private var openQuestions: [NotebookQuestion] = []
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var isDeleting = false
    @State private var needsSave = false
    @State private var hasLoaded = false
    @State private var errorMessage: String?
    @State private var autosaveDebounceTask: Task<Void, Never>?
    @State private var referencePicker: NotebookReferencePicker?
    @State private var linkedNoteRoute: NativeNotebookEditorRoute?
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var imageUploadCount = 0
    private var isUploadingImage: Bool { imageUploadCount > 0 }
    @State private var linkEditor: NotebookLinkEditor?
    @State private var linkLabel = ""
    @State private var linkURL = ""
    @State private var linkError: String?
    @State private var pendingLinkInsertion: (url: String, text: String)?
    @State private var showingDeleteConfirmation = false
    @State private var lastSyncedContent: NativeNotebookEditableContent?
    @State private var lastLocalEditAt: Date?
    @State private var draftMutationID = UUID().uuidString.lowercased()
    @State private var mutationContent: NativeNotebookEditableContent?
    @State private var editObservation = NativeNotebookEditObservation()
    @State private var pendingSave: NativeNotebookSaveAttempt?
    @State private var retryAfterReconnect = false
    @State private var hasLocalDraft = false
    @State private var requiresConflictReview = false
    @State private var conflictingCard: NotebookCard?
    @State private var showingConflictReview = false
    let cache: ProjectHubOfflineCache

    var body: some View {
        Group {
            if !hasLoaded && (isLoading || errorMessage == nil) {
                ProgressView("Loading Note…")
            } else if !hasLoaded, let errorMessage {
                NativeNotebookLoadFailureView(message: errorMessage) {
                    Task { await loadCard(forceNetwork: true) }
                }
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        TextField("Note title", text: $title)
                            .font(.title3.weight(.semibold))
                            .disabled(editingReadOnly)

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(.red)
                            if (pendingSave != nil || hasLocalDraft) && !editingReadOnly && !requiresConflictReview {
                                Button("Retry save") { Task { await saveNow() } }
                                    .disabled(isSaving || isDeleting)
                                    .accessibilityIdentifier("native-notebook-retry-save")
                            }
                        }
                        if requiresConflictReview {
                            Button("Review latest version") { Task { await reviewLatestVersion() } }
                                .accessibilityIdentifier("native-notebook-review-conflict")
                        }

                        #if DEBUG
                        if ProcessInfo.processInfo.arguments.contains("--native-notebook-reference-fixture") && ProcessInfo.processInfo.arguments.contains("--native-notebook-input-diagnostics") {
                            Text("Synthetic input diagnostics")
                                .font(.caption2)
                                .accessibilityIdentifier("native-notebook-input-diagnostics")
                                .accessibilityValue(documentEditor.inputDiagnostics)
                        }
                        if ProcessInfo.processInfo.arguments.contains("--native-notebook-layout-diagnostics") {
                            Text("Note layout diagnostics")
                                .font(.caption2)
                                .accessibilityIdentifier("native-notebook-layout-diagnostics")
                                .accessibilityValue(documentEditor.layoutDiagnostics)
                        }
                        #endif

                        NotebookDocumentEditor(
                            document: $document, isReadOnly: editingReadOnly || !isCurrentOwner,
                            sessionID: editorSessionID, controller: documentEditor,
                            onHeightChange: { editorHeight = max(300, $0) },
                            onOpenReference: { reference in Task { await openReference(reference) } },
                            onRequestInsertReference: { Task { await prepareReferencePicker() } },
                            onRequestInsertImage: { showingPhotoPicker = true },
                            onError: { errorMessage = $0 },
                            onReplacementConflict: { retained, _ in
                                guard isCurrentOwner else { return }
                                autosaveDebounceTask?.cancel()
                                autosaveDebounceTask = nil
                                requiresConflictReview = true
                                conflictingCard = nil
                                document = retained
                                lastLocalEditAt = Date()
                                errorMessage = "You edited while a saved version was arriving. Your writing is preserved; review the latest Note before syncing."
                                _ = cacheDraft()
                            },
                            resolveAsset: { url in try await resolveEditorAsset(url) },
                            uploadImage: { data, _, _ in try await uploadEditorImageData(data) }
                        )
                        .id(editorSessionID)
                        .frame(height: editorHeight)
                        .accessibilityIdentifier("native-notebook-continuous-page")



                    }
                    .padding(.vertical, 18)
                    .codeTabAlignedHorizontalPadding()
                }
                .codeNavigationTopScrollEdge()
                .codeTransparentBottomScrollEdge()
            }
        }
        .navigationTitle("Note")
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                backButton
            }
            ToolbarItem(placement: .topBarTrailing) {
                if canPerformNetworkWrites && hasLoaded && currentCardID != nil {
                    Menu {
                        Button(canMoveNoteToTrash ? "Move to Trash" : "Delete Permanently", systemImage: "trash", role: .destructive) {
                            showingDeleteConfirmation = true
                        }
                        .accessibilityIdentifier("native-notebook-delete")
                        .disabled(isSaving || isDeleting)
                    } label: { ToolbarActionIcon(systemImage: "ellipsis") }
                    .accessibilityLabel("Note actions")
                }
            }
        }
        .modifier(NotebookKeyboardToolbar(isVisible: hasLoaded && !editingReadOnly) {
            formattingBar.tint(accentColor)
        })
        #if DEBUG
        .overlay(alignment: .topLeading) {
            if hasLoaded && !editingReadOnly && ProcessInfo.processInfo.arguments.contains("--native-notebook-save-diagnostics") {
                let saveFinished = isCurrentOwner && !isSaving && pendingSave == nil &&
                    editableContent == lastSyncedContent && !requiresConflictReview && errorMessage == nil
                Color.clear
                    .frame(width: 1, height: 1)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Note save status")
                    .accessibilityValue(saveFinished ? "saved" : isSaving ? "saving" : "unsaved")
                    .accessibilityIdentifier("native-notebook-save-status")
                    .allowsHitTesting(false)
            }
        }
        #endif
        .tint(accentColor)
        .navigationDestination(item: $linkedNoteRoute) { route in
            Group {
                NotebookCardEditorView(
                    projectID: projectID, projectName: projectName,
                    routeID: route.id, cardID: route.cardID, readOnly: true,
                    accentColor: accentColor, referenceCandidates: referenceCandidates,
                    owner: owner, onSaved: {}, cache: cache
                )
                .environmentObject(library)
                .environment(\.returnToResearch, nil)
            }
        }
        .navigationDestination(item: $referenceRoute) { route in
            NativeNotebookReferenceDestination(route: route, projectID: projectID, sharedLibrary: library)
        }
        .photosPicker(isPresented: $showingPhotoPicker, selection: $selectedPhoto, matching: .images)
        .onChange(of: library.networkConnectionGeneration) {
            Task { await retryOfflineSaveIfReady() }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await retryOfflineSaveIfReady() }
            } else {
                Task { if await flushEditorDraft(finalizeEditing: true) { await saveNow() } }
            }
        }
        .sheet(isPresented: $showingConflictReview) {
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Your draft").font(.headline)
                        Text(title).font(.title3)
                        NativeNotebookConflictPreview(projectID: projectID, document: document, evidenceLinks: evidenceLinks)
                        if let latest = conflictingCard {
                            Divider()
                            Text("Latest saved Note · version \(latest.version)").font(.headline)
                            Text(latest.title).font(.title3)
                            NativeNotebookConflictPreview(projectID: projectID, document: latest.document, evidenceLinks: latest.evidenceLinks)
                            Text("Saving your draft replaces this reviewed version. If it changes again, per codes will ask you to review the conflict again.")
                                .font(.footnote).foregroundStyle(.secondary)
                            Button("Save my draft over version \(latest.version)") { resolveConflict(using: latest) }
                                .buttonStyle(.bordered)
                                .tint(accentColor)
                                .foregroundStyle(.primary)
                                .accessibilityIdentifier("native-notebook-confirm-conflict")
                        }
                    }.padding(20)
                }
                .navigationTitle("Review Note conflict")
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Keep draft") { showingConflictReview = false } } }
            }
        }
        .task { await loadCard(); await restoreEditorCaretIfNeeded() }
        .onAppear {
            isEditorVisible = true
            Task {
                await restoreEditorCaretIfNeeded()
                await retryOfflineSaveIfReady()
            }
        }
        .onChange(of: isLoading) { _, loading in
            if !loading { Task { await restoreEditorCaretIfNeeded() } }
        }
        .onChange(of: documentEditor.isReady) { _, ready in
            if ready { Task { await restoreEditorCaretIfNeeded() } }
        }
        .onChange(of: referenceRoute) { previous, current in
            if previous != nil && current == nil { Task { await restoreEditorCaretIfNeeded() } }
        }
        .onChange(of: linkedNoteRoute) { previous, current in
            if previous != nil && current == nil { Task { await restoreEditorCaretIfNeeded() } }
        }
        .onChange(of: title) { _, _ in scheduleAutosave() }
        .onChange(of: document) { _, _ in scheduleAutosave() }
        .onChange(of: openQuestions) { _, _ in scheduleAutosave() }
        .onChange(of: selectedPhoto) { _, item in
            guard let item else { return }
            Task { await uploadImage(item) }
        }
        .sheet(item: $referencePicker) { picker in
            NavigationStack {
                List(pickerCandidates(for: picker)) { candidate in
                    Button {
                        referencePicker = nil
                        Task { await insertReferenceCandidate(candidate) }
                    } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(candidate.label)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.primary)
                            Text(candidate.detail)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .navigationTitle(picker == .notes ? "Other Notes" : "Link to Note")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { referencePicker = nil }
                    }
                }
            }
        }
        .sheet(item: $linkEditor, onDismiss: {
            guard let insertion = pendingLinkInsertion else { return }
            pendingLinkInsertion = nil
            Task {
                await performEditorCommand {
                    try await documentEditor.createLink(url: insertion.url, text: insertion.text)
                }
            }
        }) { _ in
            NavigationStack {
                Form {
                    Section {
                        TextField("Link text", text: $linkLabel)
                            .accessibilityIdentifier("native-notebook-link-label")
                        TextField("https://", text: $linkURL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                            .accessibilityIdentifier("native-notebook-link-url")
                    } footer: {
                        Text(linkError ?? "Links must use HTTPS, HTTP, or mailto.")
                            .foregroundStyle(linkError == nil ? Color.secondary : Color.red)
                    }
                }
                .navigationTitle("Add link")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { linkEditor = nil }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Add") { applyLink() }
                            .accessibilityIdentifier("native-notebook-confirm-link")
                    }
                }
            }
        }
        .alert(canMoveNoteToTrash ? "Move this note to Trash?" : "Delete this note permanently?", isPresented: $showingDeleteConfirmation) {
            let recoverable = canMoveNoteToTrash
            Button(recoverable ? "Move to Trash" : "Delete Permanently", role: .destructive) {
                Task { await deleteCard(recoverable: recoverable) }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(canMoveNoteToTrash ? "You can restore this note from Trash for 30 days." : "This cannot be undone.")
        }
        .onDisappear {
            isEditorVisible = false
            autosaveDebounceTask?.cancel()
            if !isLeaving && hasLoaded && !editingReadOnly {
                cacheDraft()
                Task { await saveNow() }
            }
        }
    }

    private var editorSessionID: String { "\(owner?.accountID ?? ""):\(projectID):\(routeID)" }

    private var backButton: some View {
        Button { Task { await leaveEditor() } } label: { Label("Back", systemImage: "chevron.left") }
            .disabled(isLeaving || isUploadingImage || isDeleting)
            .accessibilityIdentifier("native-notebook-back")
    }

    private var formattingBar: some View {
        HStack(spacing: 0) {
            Menu {
                Button("Bold", systemImage: "bold") { Task { await performEditorCommand { try await documentEditor.toggleStyle("bold") } } }
                Button("Italic", systemImage: "italic") { Task { await performEditorCommand { try await documentEditor.toggleStyle("italic") } } }
                Button("Underline", systemImage: "underline") { Task { await performEditorCommand { try await documentEditor.toggleStyle("underline") } } }
                Button("Strikethrough", systemImage: "strikethrough") { Task { await performEditorCommand { try await documentEditor.toggleStyle("strike") } } }
                Button("Highlight", systemImage: "highlighter") { Task { await performEditorCommand { try await documentEditor.toggleStyle("highlight") } } }
                Divider()
                Button("Body") { Task { await performEditorCommand { try await documentEditor.setBlockType("paragraph") } } }
                ForEach(1...3, id: \.self) { level in
                    Button("Heading \(level)") { Task { await performEditorCommand { try await documentEditor.setBlockType("heading", level: level) } } }
                }
                Menu("Font size") {
                    formatButton("Default", command: .fontSize, value: "default")
                    ForEach([8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48], id: \.self) { size in
                        formatButton("\(size) pt", command: .fontSize, value: String(size))
                    }
                }
                Menu("Line spacing") {
                    formatButton("Default", command: .lineSpacing, value: "normal")
                    formatButton("Single", command: .lineSpacing, value: "1")
                    formatButton("1.15", command: .lineSpacing, value: "1.15")
                    formatButton("1.5", command: .lineSpacing, value: "1.5")
                    formatButton("Double", command: .lineSpacing, value: "2")
                }
            } label: { formattingItem(Text("Aa").font(.system(size: 19, weight: .medium))) }
            .accessibilityLabel("Text formatting")
            .accessibilityValue(documentEditor.formatting.blockType)
            Menu {
                Button("Bulleted list", systemImage: "list.bullet") { Task { await performEditorCommand { try await documentEditor.setBlockType("bulletListItem") } } }
                Button("Numbered list", systemImage: "list.number") { Task { await performEditorCommand { try await documentEditor.setBlockType("numberedListItem") } } }
            } label: { formattingItem(Image(systemName: "list.bullet")) }
            .accessibilityLabel("Lists")
            Button {
                Task {
                    await captureEditorSelection()
                    showingPhotoPicker = true
                }
            } label: { formattingItem(Image(systemName: isUploadingImage ? "arrow.up.circle" : "photo")) }
            .accessibilityLabel(isUploadingImage ? "Uploading image" : "Insert image")
            .disabled(isUploadingImage || !canPerformNetworkWrites)
            Menu {
                Button("Evidence or Assistant answer", systemImage: "text.quote") { Task { await prepareReferencePicker() } }
                    .disabled(pickerCandidates(for: .sources).isEmpty)
                Button("Other Note", systemImage: "note.text") { Task { await prepareReferencePicker(.notes) } }
                    .disabled(pickerCandidates(for: .notes).isEmpty)
                Button("Web link", systemImage: "link") { Task { await prepareLinkEditor() } }
                Button("Finding template", systemImage: "doc.text") {
                    Task { await performEditorCommand { try await documentEditor.insertFindingTemplate() } }
                }
            } label: { formattingItem(Image(systemName: "plus")) }
            .accessibilityLabel("Insert")
            Menu {
                ForEach(documentEditor.formatting.tableActions) { action in
                    formatButton(action.label, command: .table, value: action.value,
                        role: action.value.hasPrefix("remove-") ? .destructive : nil)
                        .disabled(action.disabled)
                }
            } label: { formattingItem(Image(systemName: "tablecells")) }
            .accessibilityLabel("Table")
            Button { Task { await performEditorCommand { try await documentEditor.undo() } } } label: {
                formattingItem(Image(systemName: "arrow.uturn.backward"))
            }
            .accessibilityLabel("Undo")
            .disabled(!documentEditor.formatting.canUndo)
            Button { Task { await performEditorCommand { try await documentEditor.redo() } } } label: {
                formattingItem(Image(systemName: "arrow.uturn.forward"))
            }
            .accessibilityLabel("Redo")
            .disabled(!documentEditor.formatting.canRedo)
        }
        .font(.system(size: 18))
        .padding(.horizontal, 4)
        .frame(maxWidth: .infinity, minHeight: CodeScreenMetrics.bottomControlHeight)
        .codeLiquidGlassCapsule()
        .codeTabAlignedHorizontalPadding()
        .padding(.vertical, 4)
        .disabled(!documentEditor.isReady || isLeaving || !isCurrentOwner)
        .accessibilityIdentifier("native-notebook-formatting-toolbar")
    }

    private func formattingItem(_ label: some View) -> some View {
        label.frame(maxWidth: .infinity, minHeight: CodeScreenMetrics.toolbarButtonSize)
            .contentShape(Rectangle())
    }

    private func formatButton(_ title: String, command: NotebookDocumentEditorController.FormatCommand,
                              value: String, role: ButtonRole? = nil) -> some View {
        Button(title, role: role) {
            Task { await performEditorCommand { try await documentEditor.applyFormat(command, value: value) } }
        }
    }

    @MainActor
    private func performEditorCommand(_ command: () async throws -> Void) async {
        guard isCurrentOwner, !editingReadOnly else { return }
        do {
            try await command()
            guard isCurrentOwner else { return }
            _ = cacheDraft()
        } catch { if isCurrentOwner { errorMessage = nativeNotebookRequestErrorMessage(error) } }
    }

    @MainActor
    private func captureEditorSelection() async {
        guard documentEditor.isReady, isCurrentOwner else { return }
        do { try await documentEditor.captureSelection() }
        catch { errorMessage = nativeNotebookRequestErrorMessage(error) }
    }

    @MainActor
    @discardableResult
    private func flushEditorDraft(finalizeEditing: Bool = false) async -> Bool {
        guard hasLoaded, isCurrentOwner, !editingReadOnly else { return true }
        if documentEditor.isReady {
            do { document = try await documentEditor.flush(finalizeEditing: finalizeEditing) }
            catch { errorMessage = nativeNotebookRequestErrorMessage(error); return false }
        }
        return cacheDraft()
    }

    @MainActor
    private func leaveEditor() async {
        guard !isLeaving else { return }
        isLeaving = true
        guard await flushEditorDraft(finalizeEditing: true) else { isLeaving = false; return }
        autosaveDebounceTask?.cancel()
        if hasLocalDraft && !requiresConflictReview && (!library.isNetworkAvailable || isLoading) {
            retryAfterReconnect = true
            guard cacheDraft() else { isLeaving = false; return }
        }
        if let returnToResearch { returnToResearch() } else { dismiss() }
        // An active write retains the editor's claim until its final acknowledgement.
        guard !isSaving else { return }
        if !retryAfterReconnect { await saveNow() }
        releaseClosedDraft()
    }

    private func releaseClosedDraft() {
        library.releaseNotebookDraftEditor(documentEditor, retry: retryAfterReconnect && !requiresConflictReview)
    }

    @MainActor
    private func pickerCandidates(for picker: NotebookReferencePicker) -> [NativeNotebookReferenceCandidate] {
        referenceCandidates.filter { candidate in
            if picker == .notes {
                return candidate.kind == "notebookCard" && candidate.referenceID != (currentCardID ?? cardID)
            }
            return candidate.kind != "notebookCard"
        }
    }

    private func prepareReferencePicker(_ picker: NotebookReferencePicker = .sources) async {
        await captureEditorSelection()
        referencePicker = picker
    }

    @MainActor
    private func insertReferenceCandidate(_ candidate: NativeNotebookReferenceCandidate) async {
        await performEditorCommand {
            guard candidate.kind == "canonicalSection" else {
                try await documentEditor.insertReference(NotebookReferenceProps(
                    referenceKind: candidate.kind, referenceID: candidate.referenceID, label: candidate.label))
                return
            }
            // A bookmark preview is not an exact quotation. Read the saved edition
            // independently, without switching the user's current Reader.
            guard let savedVersion = candidate.codeVersion, !savedVersion.isEmpty,
                  let sectionID = candidate.sectionID.flatMap(Int64.init) else {
                throw NotebookReferenceEvidencePreparer.Failure.unavailable
            }
            let reader = library.makeSearchReaderLibrary(sourceVersion: savedVersion)
            guard await reader.prepareCodeVersionForEvidence(savedVersion),
                  case .loaded(let detail) = await reader.loadSectionDetailResultAsync(sectionID: sectionID),
                  let category = reader.codeSections.first(where: { $0.id == detail.codeSectionID }) else {
                throw NotebookReferenceEvidencePreparer.Failure.unavailable
            }
            let link = try NotebookReferenceEvidencePreparer.makeLink(
                label: candidate.label, projectID: projectID, cardID: currentCardID ?? "",
                codeName: category.name, codeVersion: UserContentSyncCodeVersion.server(savedVersion),
                codeEdition: NativeReaderEditionLabel.label(for: savedVersion),
                sectionID: String(detail.id), sectionNumber: detail.sectionNumber,
                sectionTitle: detail.title, officialText: detail.officialText)
            guard isCurrentOwner, !editingReadOnly, !isLeaving, !Task.isCancelled else { throw CancellationError() }
            guard evidenceLinks.count < 100 else { throw NotebookReferenceEvidencePreparer.Failure.tooManyLinks }
            // Persist metadata before the chip can emit an autosavable change.
            // Keep it if the bridge acknowledgement is uncertain: an unused
            // evidence link is safe, whereas a chip without its edition is not.
            evidenceLinks.append(link)
            guard cacheDraft() else { evidenceLinks.removeAll { $0.id == link.id }; return }
            try await documentEditor.insertReference(NotebookReferenceProps(
                referenceKind: "selectedPassage", referenceID: link.id, label: candidate.label))
            scheduleAutosave()
        }
    }

    @MainActor
    private func prepareLinkEditor() async {
        await captureEditorSelection()
        // Transfer focus out of WebKit before UIKit presents editable fields.
        // Keeping both editors active can leave the alert laid out against a
        // keyboard that has already moved and discard pending composed input.
        guard await flushEditorDraft(finalizeEditing: true), isCurrentOwner else { return }
        linkLabel = documentEditor.formatting.selectedText
        linkURL = documentEditor.formatting.linkURL.isEmpty ? "https://" : documentEditor.formatting.linkURL
        linkError = nil
        pendingLinkInsertion = nil
        linkEditor = NotebookLinkEditor(id: UUID().uuidString)
    }

    @MainActor
    private func openReference(_ reference: NotebookReferenceProps) async {
        guard isCurrentOwner else { return }
        await captureEditorSelection()
        guard await flushEditorDraft(finalizeEditing: true), isCurrentOwner else { return }
        restoreCaretOnReturn = !editingReadOnly
        if reference.referenceKind == "notebookCard" {
            linkedNoteRoute = NativeNotebookEditorRoute(cardID: reference.referenceID)
            return
        }
        // A legacy numeric section ID carries no edition. A newly saved
        // bookmark with the same ID cannot supply that missing identity.
        let candidate = NativeNotebookReferenceIdentity.acceptsCandidateMetadata(kind: reference.referenceKind, referenceID: reference.referenceID)
            ? referenceCandidates.first { $0.kind == reference.referenceKind && $0.referenceID == reference.referenceID } : nil
        let evidence = evidenceLinks.first { $0.id == reference.referenceID }
        referenceRoute = NativeNotebookReferenceRoute(
            referenceKind: reference.referenceKind, referenceID: candidate?.sectionID ?? reference.referenceID,
            label: reference.label, conversationID: candidate?.conversationID,
            source: evidence?.source ?? candidate?.source, passages: evidence?.passages ?? candidate?.passages ?? [],
            codeVersion: evidence?.source.codeVersion ?? candidate?.codeVersion)
    }

    @MainActor
    private func restoreEditorCaretIfNeeded() async {
        guard restoreCaretOnReturn, isEditorVisible, !isLoading, isCurrentOwner, !editingReadOnly,
              referenceRoute == nil, linkedNoteRoute == nil, documentEditor.isReady else { return }
        do {
            try await documentEditor.focus()
            restoreCaretOnReturn = false
        } catch { if isCurrentOwner { errorMessage = nativeNotebookRequestErrorMessage(error) } }
    }

    @MainActor
    private func resolveEditorAsset(_ url: String) async throws -> Data {
        guard isCurrentOwner else { throw CancellationError() }
        let data: Data
        if url.hasPrefix("permitext-notebook-asset:") {
            data = try await library.notebookAsset(projectID: projectID, assetID: String(url.dropFirst("permitext-notebook-asset:".count)))
        } else if let remote = URL(string: url), remote.scheme == "https" {
            (data, _) = try await URLSession.shared.data(from: remote)
        } else { throw NotebookDocumentEditorError.assetUnavailable }
        guard isCurrentOwner, !Task.isCancelled else { throw CancellationError() }
        return data
    }

    private func loadCard(forceNetwork: Bool = false) async {
        guard isCurrentOwner, !isLoading, !isSaving, !isLeaving else { return }
        if hasLoaded && documentEditor.isReady { guard await flushEditorDraft() else { return } }
        guard isCurrentOwner, !isLoading, !isSaving, !isLeaving, let accountID = owner?.accountID else { return }
        isLoading = true
        var refreshSucceeded = false
        var deferredDraft: NativeNotebookDraft?
        defer {
            isLoading = false
            // saveNow rejects an active load. Resume only after the load flag is
            // cleared, and do not turn an offline failure into an automatic retry.
            if !isLeaving, refreshSucceeded, isCurrentOwner, !Task.isCancelled, needsSave, !requiresConflictReview {
                Task { await saveNow() }
            } else if !isLeaving, retryAfterReconnect, !Task.isCancelled {
                Task { await retryOfflineSaveIfReady() }
            }
        }

        if let owner, !editingReadOnly {
            await library.claimNotebookDraftEditor(documentEditor, owner: owner, projectID: projectID,
                                                   routeID: routeID, cardID: currentCardID ?? cardID)
            guard isCurrentOwner, !Task.isCancelled, !isLeaving else { return }
        }

        if !hasLoaded {
            // Unsynchronized drafts must also survive a forced retry after an
            // offline type-validation failure. Only the server copy is skipped.
            if let cachedDraft = try? cache.load(
                NativeNotebookDraft.self,
                accountID: accountID,
                projectID: projectID,
                scope: "native-notebook-draft:\(routeID)"
            )?.value, cachedDraft.hasUnsynchronizedChanges {
                let cachedType = cachedDraft.cardID.flatMap {
                    nativeNotebookCachedCardType(cache: cache, accountID: accountID, projectID: projectID, cardID: $0)
                }
                if let cachedType, !PermitextReleaseSurfaceVisibility.notebookCardIsVisible(cachedType) {
                    showUnavailableCoordinationCard()
                    return
                }
                if cachedDraft.cardID != nil && cachedType == nil && !PermitextReleaseSurfaceVisibility.coordination {
                    // An older draft has no type metadata. Keep it on disk and
                    // validate the saved card before revealing its contents.
                    deferredDraft = cachedDraft
                    currentCardID = cachedDraft.cardID
                } else {
                    apply(cachedDraft)
                }
            } else {
                // Open a saved Note from the current server revision. A clean
                // cache can precede an edit made on another device.
                currentCardID = cardID
                hasLoaded = cardID == nil
            }
        }

        guard let cardID = currentCardID ?? cardID else {
            hasLoaded = true
            return
        }
        do {
            let card = try await library.notebookCard(projectID: projectID, cardID: cardID)
            guard isCurrentOwner, !Task.isCancelled, !isLeaving else { return }
            guard PermitextReleaseSurfaceVisibility.notebookCardIsVisible(card.cardType) else {
                showUnavailableCoordinationCard()
                return
            }
            if let deferredDraft { apply(deferredDraft) }
            let decision = NativeNotebookRefreshDecision.resolve(
                draft: hasLoaded ? currentDraft : nil, serverVersion: card.version,
                serverContent: editableContent(for: card))
            switch decision {
            case .preservePending:
                errorMessage = "Your draft is on this iPhone. Retry save to confirm the previous save."
            case .reviewConflict:
                conflictingCard = card
                requiresConflictReview = true
                errorMessage = "This Note changed elsewhere. Your draft and its original version are preserved. Review the latest Note before saving."
            case .preserveDraft:
                break
            case .applyServer:
                apply(card)
                errorMessage = nil
            }
            refreshSucceeded = true
            try? cache.store(
                card,
                accountID: accountID,
                projectID: projectID,
                scope: "native-notebook-card:\(card.id)"
            )
        } catch {
            guard isCurrentOwner, !Task.isCancelled else { return }
            if NativePrivateCachePolicy.requiresInvalidation(after: error) {
                // Preserve the draft, but do not display or edit revoked server content.
                library.invalidateProjectDashboardPreview(projectID: projectID)
                try? cache.removeProject(accountID: accountID, projectID: projectID)
                hasLoaded = false
            } else if !isLeaving, !hasLoaded, deferredDraft == nil, !forceNetwork,
                      NativePrivateCachePolicy.permitsOfflineFallback(after: error),
                      let cachedCard = try? cache.load(
                        NotebookCard.self,
                        accountID: accountID,
                        projectID: projectID,
                        scope: "native-notebook-card:\(cardID)"
                      )?.value {
                guard PermitextReleaseSurfaceVisibility.notebookCardIsVisible(cachedCard.cardType) else {
                    showUnavailableCoordinationCard()
                    return
                }
                apply(cachedCard)
            }
            guard !isLeaving else { return }
            let detail = nativeNotebookRequestErrorMessage(error)
            errorMessage = hasLoaded ? "Could not refresh this Note. \(detail)" : detail
        }
    }

    private func showUnavailableCoordinationCard() {
        hasLoaded = false
        needsSave = false
        autosaveDebounceTask?.cancel()
        autosaveDebounceTask = nil
        errorMessage = "This item is not available in Notebook."
    }

    private func apply(_ card: NotebookCard) {
        currentCardID = card.id
        version = card.version
        title = card.title
        document = card.document
        evidenceLinks = card.evidenceLinks
        openQuestions = card.openQuestions ?? []
        lastSyncedContent = editableContent(for: card)
        lastLocalEditAt = nil
        hasLoaded = true
        hasLocalDraft = false
        pendingSave = nil
        retryAfterReconnect = false
        draftMutationID = UUID().uuidString.lowercased()
        requiresConflictReview = false
        conflictingCard = nil
        mutationContent = editableContent
        editObservation.reset(to: editableContent)
    }

    private func apply(_ draft: NativeNotebookDraft) {
        currentCardID = draft.cardID
        version = draft.version
        title = draft.title
        document = draft.document
        evidenceLinks = draft.evidenceLinks
        openQuestions = draft.openQuestions ?? []
        lastSyncedContent = draft.baseContent
        lastLocalEditAt = draft.editedAt
        draftMutationID = draft.clientMutationID ?? UUID().uuidString.lowercased()
        pendingSave = draft.pendingSave
        retryAfterReconnect = draft.retryAfterReconnect == true
        mutationContent = editableContent(for: draft)
        hasLocalDraft = true
        hasLoaded = true
        editObservation.reset(to: editableContent)
    }

    private func scheduleAutosave() {
        guard isCurrentOwner else { return }
        guard hasLoaded, !editingReadOnly, !isDeleting else { return }
        guard editObservation.consumeChange(to: editableContent) else { return }
        if editableContent == lastSyncedContent {
            // A reverted edit still matters while an earlier write is uncertain:
            // persist it without cancelling that request or claiming it synced.
            if pendingSave != nil || isSaving || requiresConflictReview {
                cacheDraft()
                return
            }
            autosaveDebounceTask?.cancel()
            autosaveDebounceTask = nil
            needsSave = false
            lastLocalEditAt = nil
            guard cacheDraft() else { return }
            errorMessage = nil
            return
        }
        lastLocalEditAt = Date()
        guard cacheDraft() else { return }
        if isLoading {
            needsSave = true
            return
        }
        guard !requiresConflictReview else { return }
        if isSaving {
            needsSave = true
            return
        }
        autosaveDebounceTask?.cancel()
        autosaveDebounceTask = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(650))
            guard !Task.isCancelled else { return }
            // Subsequent edits can cancel the delay, then queue another save
            // once a request has started. The in-flight request owns its receipt.
            autosaveDebounceTask = nil
            await saveNow()
        }
    }

    @MainActor
    private func retryOfflineSaveIfReady() async {
        guard retryAfterReconnect, library.isNetworkAvailable, isCurrentOwner, isEditorVisible,
              hasLoaded, !editingReadOnly, !isLoading, !isSaving, !isLeaving, !isDeleting,
              !requiresConflictReview else { return }
        guard await flushEditorDraft(), retryAfterReconnect, library.isNetworkAvailable else { return }
        await saveNow()
    }

    private func shouldRetryAfterReconnect(_ error: Error) -> Bool {
        error is URLError && NativePrivateCachePolicy.permitsOfflineFallback(after: error)
    }

    @MainActor
    private func saveNow() async {
        guard isCurrentOwner, hasLoaded, !editingReadOnly, !isLoading, !isDeleting, !requiresConflictReview else { return }
        if isSaving { needsSave = true; return }
        guard pendingSave != nil || editableContent != lastSyncedContent else { return }
        autosaveDebounceTask?.cancel()
        autosaveDebounceTask = nil
        isSaving = true
        needsSave = false
        let connectionAtStart = library.networkConnectionGeneration
        defer {
            isSaving = false
            if isCurrentOwner, needsSave, !requiresConflictReview, (!isLeaving || !retryAfterReconnect) {
                Task { await saveNow() }
            }
            else if isLeaving { releaseClosedDraft() }
            else if retryAfterReconnect, library.networkConnectionGeneration != connectionAtStart {
                Task { await retryOfflineSaveIfReady() }
            }
        }
        guard cacheDraft() else { return }
        errorMessage = nil
        if !canPerformNetworkWrites {
            do {
                let response = try await library.notebookCards(projectID: projectID)
                guard isCurrentOwner, !Task.isCancelled else { return }
                guard let confirmed = response.access, !confirmed.readOnly,
                      ["owner", "editor", "admin"].contains(confirmed.role.lowercased()) else {
                    throw PermitextBackendHTTPError.serverStatus(403, "Your project role does not allow editing this Notebook.")
                }
                freshWriteRole = confirmed.role
                if let owner {
                    try? cache.store(response, accountID: owner.accountID, projectID: projectID, scope: "native-notebook-list")
                }
            } catch {
                guard isCurrentOwner else { return }
                retryAfterReconnect = shouldRetryAfterReconnect(error)
                guard cacheDraft() else { return }
                freshWriteRole = nil
                if NativePrivateCachePolicy.requiresInvalidation(after: error) {
                    hasDeniedWriteAccess = true
                    // Match the existing read invalidation policy; keep the live
                    // draft in memory, but stop displaying private source content.
                    library.invalidateProjectDashboardPreview(projectID: projectID)
                    if let owner { try? cache.removeProject(accountID: owner.accountID, projectID: projectID) }
                    hasLoaded = false
                }
                let detail = nativeNotebookRequestErrorMessage(error)
                errorMessage = hasLoaded && !(error is CancellationError) ? "Your draft is on this iPhone. \(detail)" : detail
                return
            }
        }
        let attempt = pendingSave ?? NativeNotebookSaveAttempt(
            clientMutationID: draftMutationID, cardID: currentCardID, expectedVersion: version, content: editableContent, preservesServerQuestions: true
        )
        pendingSave = attempt
        guard cacheDraft() else { return }
        do {
            let saved = try await library.saveNotebookCard(
                projectID: projectID, cardID: attempt.cardID, expectedVersion: attempt.expectedVersion,
                title: normalizedTitle(attempt.content.title), document: attempt.content.document,
                evidenceLinks: attempt.content.evidenceLinks, clientMutationID: attempt.clientMutationID,
                openQuestions: attempt.preservesServerQuestions == true ? nil : attempt.content.openQuestions
            )
            guard isCurrentOwner, !Task.isCancelled else { return }
            pendingSave = nil
            completeSave(saved, contentAtStart: attempt.content)
        } catch let error as PermitextBackendHTTPError where error.statusCode == 409 {
            guard isCurrentOwner else { return }
            retryAfterReconnect = false
            await reconcileVersionConflict(error)
        } catch let error as PermitextBackendHTTPError where error.statusCode == 400 && attempt.preservesServerQuestions != true && NotebookQuestion.validationMessage(in: attempt.content.openQuestions ?? []) != nil {
            // An older app may have persisted an invalid question attempt.
            // This definitive rejection permits a corrected body with a new
            // identity; timeouts and other uncertain outcomes keep the receipt.
            guard isCurrentOwner else { return }
            pendingSave = nil
            retryAfterReconnect = false
            draftMutationID = UUID().uuidString.lowercased()
            guard cacheDraft() else { return }
            errorMessage = nil
            needsSave = true
        } catch {
            guard isCurrentOwner else { return }
            retryAfterReconnect = shouldRetryAfterReconnect(error)
            guard cacheDraft() else { return }
            let detail = nativeNotebookRequestErrorMessage(error)
            errorMessage = error is CancellationError ? detail : "Your draft is on this iPhone. \(detail)"
        }
    }

    private func deleteCard(recoverable: Bool) async {
        guard isCurrentOwner, canPerformNetworkWrites, !isSaving, !isDeleting else { return }
        if recoverable {
            // Save the current document before creating its recovery copy.
            guard await flushEditorDraft(), isCurrentOwner, !Task.isCancelled else { return }
            await saveNow()
            guard isCurrentOwner, !Task.isCancelled, canPerformNetworkWrites, canMoveNoteToTrash,
                  !isSaving, !isDeleting, !requiresConflictReview, pendingSave == nil,
                  editableContent == lastSyncedContent else { return }
        }
        guard let currentCardID else { return }
        isDeleting = true
        autosaveDebounceTask?.cancel()
        defer { isDeleting = false }
        do {
            try await library.deleteNotebookCard(
                projectID: projectID,
                cardID: currentCardID,
                expectedVersion: version,
                recoverable: recoverable
            )
            guard isCurrentOwner, !Task.isCancelled else { return }
            // Dismissing a deleted editor must not schedule another save or
            // recreate the removed local draft in onDisappear.
            hasLoaded = false
            needsSave = false
            pendingSave = nil
            autosaveDebounceTask?.cancel()
            if let owner {
                try? cache.remove(accountID: owner.accountID, projectID: projectID, scope: "native-notebook-card:\(currentCardID)")
                try? cache.remove(accountID: owner.accountID, projectID: projectID, scope: "native-notebook-draft:\(routeID)")
            }
            onSaved()
            dismiss()
        } catch {
            guard isCurrentOwner else { return }
            errorMessage = nativeNotebookRequestErrorMessage(error)
        }
    }

    private var currentDraft: NativeNotebookDraft {
        NativeNotebookDraft(cardID: currentCardID, version: version, title: title, document: document,
            evidenceLinks: evidenceLinks, openQuestions: editableContent.openQuestions, editedAt: lastLocalEditAt, clientMutationID: draftMutationID, pendingSave: pendingSave, baseContent: lastSyncedContent,
            retryAfterReconnect: retryAfterReconnect ? true : nil)
    }

    @discardableResult
    private func cacheDraft() -> Bool {
        guard isCurrentOwner, let accountID = owner?.accountID else { return false }
        if mutationContent != editableContent {
            draftMutationID = UUID().uuidString.lowercased()
            mutationContent = editableContent
        }
        hasLocalDraft = editableContent != lastSyncedContent || pendingSave != nil
        do {
            // Questions are no longer editable here. Retain unsent legacy metadata
            // separately before a normal note save restores the server metadata.
            // Use the receipt identity so a rejected old request remains recoverable.
            if editableContent.openQuestions != lastSyncedContent?.openQuestions ||
                (pendingSave?.preservesServerQuestions != true && pendingSave?.content.openQuestions != nil) {
                let recoveryID = pendingSave?.clientMutationID ?? draftMutationID
                try cache.store(currentDraft, accountID: accountID, projectID: projectID,
                    scope: "native-notebook-legacy-metadata:\(routeID):\(recoveryID)")
            }
            try cache.store(currentDraft, accountID: accountID, projectID: projectID, scope: "native-notebook-draft:\(routeID)")
            return true
        } catch {
            errorMessage = "Could not save the local draft. Keep this Note open and try again after freeing space. \(error.localizedDescription)"
            return false
        }
    }

    @MainActor
    private func reconcileVersionConflict(_ error: PermitextBackendHTTPError) async {
        guard isCurrentOwner else { return }
        requiresConflictReview = true
        needsSave = false
        conflictingCard = error.authoritativeNotebookCard
        guard cacheDraft() else { return }
        errorMessage = "This Note changed elsewhere. Your draft and its original version are preserved. Review the latest Note before saving."
    }

    private func reviewLatestVersion() async {
        guard await flushEditorDraft() else { return }
        guard isCurrentOwner else { return }
        let id = currentCardID ?? pendingSave?.cardID ?? conflictingCard?.id
        guard let id else {
            errorMessage = "The original save could not be confirmed. Your draft is preserved; retry after reconnecting before creating another Note."
            return
        }
        do {
            let latest = try await library.notebookCard(projectID: projectID, cardID: id)
            guard isCurrentOwner, !Task.isCancelled else { return }
            conflictingCard = latest
            showingConflictReview = true
        } catch {
            guard isCurrentOwner else { return }
            errorMessage = "Could not load the latest Note. Your draft is still on this iPhone."
        }
    }

    private func resolveConflict(using reviewed: NotebookCard) {
        guard isCurrentOwner, conflictingCard == reviewed else { return }
        // Only this explicit action adopts a newer base version. The next save
        // remains conditional, so a change after review returns another conflict.
        currentCardID = reviewed.id
        version = reviewed.version
        lastSyncedContent = editableContent(for: reviewed)
        pendingSave = nil
        draftMutationID = UUID().uuidString.lowercased()
        mutationContent = editableContent
        requiresConflictReview = false
        showingConflictReview = false
        conflictingCard = nil
        errorMessage = nil
        guard cacheDraft() else { return }
        Task { await saveNow() }
    }

    @MainActor
    private func completeSave(
        _ saved: NotebookCard,
        contentAtStart: NativeNotebookEditableContent
    ) {
        retryAfterReconnect = false
        let changedDuringSave = editableContent != contentAtStart
        if changedDuringSave {
            currentCardID = saved.id
            version = saved.version
            lastSyncedContent = editableContent(for: saved)
            needsSave = true
        } else {
            apply(saved)
        }
        errorMessage = nil
        storeServerCard(saved)
        cacheDraft()
        onSaved()
    }

    private var editableContent: NativeNotebookEditableContent {
        NativeNotebookEditableContent(
            title: title,
            document: document,
            evidenceLinks: evidenceLinks,
            // Omission preserves existing server questions. An explicit empty
            // array removes the last saved (or still-pending) question.
            openQuestions: openQuestions.isEmpty && (lastSyncedContent?.openQuestions ?? []).isEmpty && (pendingSave?.content.openQuestions ?? []).isEmpty ? nil : openQuestions
        )
    }

    private func editableContent(for card: NotebookCard) -> NativeNotebookEditableContent {
        .savedCard(card)
    }

    private func editableContent(for draft: NativeNotebookDraft) -> NativeNotebookEditableContent {
        draft.editableContent
    }

    private func normalizedTitle(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Untitled Note" : value
    }

    private func notebookDateValue(_ value: String) -> Date {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value) ?? .distantPast
    }

    private func storeServerCard(_ card: NotebookCard) {
        guard isCurrentOwner else { return }
        guard let accountID = owner?.accountID else { return }
        try? cache.store(
            card,
            accountID: accountID,
            projectID: projectID,
            scope: "native-notebook-card:\(card.id)"
        )
    }

    private func uploadImage(_ item: PhotosPickerItem) async {
        guard canPerformNetworkWrites else { return }
        guard isCurrentOwner else { return }
        imageUploadCount += 1
        defer {
            imageUploadCount -= 1
            selectedPhoto = nil
        }
        do {
            guard let originalData = try await item.loadTransferable(type: Data.self) else {
                throw NotebookUploadImagePreparer.PreparationError.invalidImage
            }
            guard isCurrentOwner, !Task.isCancelled else { return }
            let asset = try await prepareAndUploadNotebookImage(originalData)
            guard isCurrentOwner, !Task.isCancelled else { return }
            try await documentEditor.insertImage(.image(url: asset.url, name: "Notebook image", width: asset.width))
            _ = cacheDraft()
        } catch {
            guard isCurrentOwner else { return }
            errorMessage = nativeNotebookRequestErrorMessage(error)
        }
    }

    @MainActor
    private func uploadEditorImageData(_ originalData: Data) async throws -> String {
        guard canPerformNetworkWrites, isCurrentOwner, !Task.isCancelled else { throw NotebookDocumentEditorError.unavailable }
        imageUploadCount += 1
        defer { imageUploadCount -= 1 }
        return try await prepareAndUploadNotebookImage(originalData).url
    }

    @MainActor
    private func prepareAndUploadNotebookImage(_ originalData: Data) async throws -> NotebookImageAsset {
        guard canPerformNetworkWrites, isCurrentOwner, !Task.isCancelled else { throw NotebookDocumentEditorError.unavailable }
        let preparation = Task.detached(priority: .userInitiated) {
            try NotebookUploadImagePreparer.prepare(originalData)
        }
        let prepared = try await withTaskCancellationHandler {
            try await preparation.value
        } onCancel: { preparation.cancel() }
        guard canPerformNetworkWrites, isCurrentOwner, !Task.isCancelled else { throw CancellationError() }
        let asset = try await library.uploadNotebookAsset(
            projectID: projectID, data: prepared.data, contentType: "image/jpeg",
            width: prepared.width, height: prepared.height)
        guard canPerformNetworkWrites, isCurrentOwner, !Task.isCancelled else { throw CancellationError() }
        return asset
    }

    @MainActor
    private func applyLink() {
        let destination = linkURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isCurrentOwner, !editingReadOnly,
              destination.utf16.count <= 2000, let url = URL(string: destination),
              ["https", "http", "mailto"].contains(url.scheme?.lowercased() ?? ""),
              (url.scheme?.lowercased() == "mailto" ? !url.path.isEmpty : url.host?.isEmpty == false) else {
            linkError = "Enter a valid HTTPS, HTTP, or mailto link."
            return
        }
        pendingLinkInsertion = (destination, linkLabel)
        linkEditor = nil
    }

}

/// ImageIO downsamples before decoding; a full-resolution camera bitmap never
/// lands on the UI executor. The encoded payload fits the server's 8 MiB limit.
private enum NotebookUploadImagePreparer {
    struct Prepared: Sendable {
        let data: Data
        let width: Int
        let height: Int
    }

    enum PreparationError: LocalizedError {
        case invalidImage
        case tooLarge
        var errorDescription: String? {
            switch self {
            case .invalidImage: return "This photo could not be prepared. Try a different image."
            case .tooLarge: return "This image is too large to upload. Try a smaller image."
            }
        }
    }

    nonisolated static func prepare(_ original: Data, maximumBytes: Int = 8 * 1_024 * 1_024) throws -> Prepared {
        try Task.checkCancellation()
        guard maximumBytes > 0,
              let source = CGImageSourceCreateWithData(original as CFData,
                  [kCGImageSourceShouldCache: false] as CFDictionary) else {
            throw PreparationError.invalidImage
        }
        for longestEdge in [4_096, 3_072, 2_048, 1_024] {
            try Task.checkCancellation()
            let result: Prepared? = try autoreleasepool {
                guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                    kCGImageSourceCreateThumbnailFromImageAlways: true,
                    kCGImageSourceCreateThumbnailWithTransform: true,
                    kCGImageSourceShouldCacheImmediately: true,
                    kCGImageSourceThumbnailMaxPixelSize: longestEdge
                ] as CFDictionary) else { throw PreparationError.invalidImage }
                for quality in [0.86, 0.72] {
                    try Task.checkCancellation()
                    let bytes = NSMutableData()
                    guard let destination = CGImageDestinationCreateWithData(bytes, "public.jpeg" as CFString, 1, nil) else {
                        throw PreparationError.invalidImage
                    }
                    CGImageDestinationAddImage(destination, image, [
                        kCGImageDestinationLossyCompressionQuality: quality
                    ] as CFDictionary)
                    guard CGImageDestinationFinalize(destination) else { throw PreparationError.invalidImage }
                    if bytes.length <= maximumBytes {
                        return Prepared(data: bytes as Data, width: image.width, height: image.height)
                    }
                }
                return nil
            }
            if let result { return result }
        }
        throw PreparationError.tooLarge
    }
}

// Decode display pixels only. Original asset bytes remain owned by the asset service.
private enum NotebookDisplayImageDecoder {
    nonisolated static func decode(_ data: Data, pixelWidth: Int) -> CGImage? {
        guard pixelWidth > 0,
              let source = CGImageSourceCreateWithData(data as CFData,
                  [kCGImageSourceShouldCache: false] as CFDictionary),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? NSNumber,
              let height = properties[kCGImagePropertyPixelHeight] as? NSNumber else { return nil }
        let orientation = (properties[kCGImagePropertyOrientation] as? NSNumber)?.intValue ?? 1
        let rotated = (5...8).contains(orientation)
        let displayWidth = rotated ? height.doubleValue : width.doubleValue
        let displayHeight = rotated ? width.doubleValue : height.doubleValue
        guard displayWidth > 0, displayHeight > 0 else { return nil }
        // ImageIO limits the longest edge; a portrait must still fill the requested width.
        let ratio = min(1, Double(pixelWidth) / displayWidth)
        let longestEdge = ceil(max(displayWidth, displayHeight) * ratio)
        return CGImageSourceCreateThumbnailAtIndex(source, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: longestEdge
        ] as CFDictionary)
    }
}

private struct NotebookAssetImage: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    let projectID: String
    let url: String
    @State private var image: UIImage?
    @State private var failed = false
    @Environment(\.displayScale) private var displayScale
    @State private var pixelWidth = 0
    @State private var loadedRequest: Request?

    private struct Request: Equatable {
        let session: UUID
        let project: String
        let url: String
        let pixelWidth: Int
    }
    private var request: Request {
        Request(session: library.privateSessionID, project: projectID, url: url, pixelWidth: pixelWidth)
    }

    var body: some View {
        Group {
            if loadedRequest == request, let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
            } else if failed {
                ContentUnavailableView("Image unavailable", systemImage: "photo.badge.exclamationmark")
                    .frame(minHeight: 120)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 120)
            }
        }
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .onGeometryChange(for: Int.self) { geometry in
            Int(ceil(max(0, geometry.size.width) * displayScale))
        } action: { pixelWidth = $0 }
        .task(id: request) { await load(request) }
    }

    private func load(_ request: Request) async {
        guard request.pixelWidth > 0, request == self.request, !Task.isCancelled else { return }
        let identity = library.privateRequestIdentity
        image = nil
        failed = false
        guard identity != nil else { failed = true; return }
        guard !url.isEmpty else { failed = true; return }
        do {
            let data: Data
            if url.hasPrefix("permitext-notebook-asset:") {
                let assetID = String(url.dropFirst("permitext-notebook-asset:".count))
                data = try await library.notebookAsset(projectID: projectID, assetID: assetID)
            } else if let remoteURL = URL(string: url), remoteURL.scheme == "https" {
                let (remoteData, _) = try await URLSession.shared.data(from: remoteURL)
                data = remoteData
            } else {
                throw PermitextBackendHTTPError.invalidResponse
            }
            guard identity == library.privateRequestIdentity, !Task.isCancelled else { return }
            let decoding = Task.detached(priority: .userInitiated) {
                guard !Task.isCancelled else { return nil as CGImage? }
                return NotebookDisplayImageDecoder.decode(data, pixelWidth: request.pixelWidth)
            }
            let decoded = await withTaskCancellationHandler {
                await decoding.value
            } onCancel: { decoding.cancel() }
            guard identity == library.privateRequestIdentity, !Task.isCancelled,
                  request == self.request else { return }
            image = decoded.map { UIImage(cgImage: $0, scale: displayScale, orientation: .up) }
            loadedRequest = request
            failed = image == nil
        } catch {
            guard identity == library.privateRequestIdentity, !Task.isCancelled,
                  request == self.request else { return }
            failed = true
        }
    }
}

private extension Array {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}


/// Captures the complete authored section with its exact edition. Never turns a
/// bookmark search preview into a claimed exact passage or guesses a code book.
private enum NotebookReferenceEvidencePreparer {
    enum Failure: LocalizedError {
        case unavailable, unsupportedCode, passageTooLarge, tooManyLinks
        var errorDescription: String? {
            switch self {
            case .unavailable: return "This saved source's exact edition or section is unavailable. Open it in Reader before linking it."
            case .unsupportedCode: return "This source's code identity could not be verified. No link was inserted."
            case .passageTooLarge: return "This section is too long to attach as one source. Select a shorter passage in Reader."
            case .tooManyLinks: return "This Note already has 100 evidence links."
            }
        }
    }

    static func codePrefix(for name: String) throws -> String {
        let name = name.uppercased()
        let identities = [("FUEL GAS", "FGC"), ("EXISTING BUILDING", "EBC"),
            ("ENERGY", "ECC"), ("ELECTRICAL", "EC"), ("FIRE CODE", "FC"),
            ("MECHANICAL", "MC"), ("PLUMBING", "PC"), ("ZONING", "ZR"),
            ("HOUSING MAINTENANCE", "HMC"), ("TITLE 24", "T24"),
            ("TITLE 25", "T25"), ("TITLE 26", "T26"), ("TITLE 28", "T28"),
            ("LOCAL LAW", "LL"), ("GENERAL ADMIN", "AC"), ("1968 BUILDING", "BC68"), ("BUILDING CODE", "BC")]
        guard let match = identities.first(where: { name.contains($0.0) }) else { throw Failure.unsupportedCode }
        return match.1
    }

    static func makeLink(label: String, projectID: String, cardID: String, codeName: String,
                         codeVersion: String, codeEdition: String, sectionID: String, sectionNumber: String,
                         sectionTitle: String, officialText: String) throws -> NotebookEvidenceLink {
        guard !codeVersion.isEmpty, !sectionID.isEmpty, !sectionNumber.isEmpty,
              !officialText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw Failure.unavailable }
        guard officialText.utf16.count <= 50_000 else { throw Failure.passageTooLarge }
        let source = NotebookEvidenceSource(jurisdiction: "New York City", codePrefix: try codePrefix(for: codeName),
            codeEdition: codeEdition, codeVersion: codeVersion, sourceID: sectionID, sectionID: sectionID,
            sectionNumber: sectionNumber, sectionTitle: sectionTitle.isEmpty ? "Section" : sectionTitle,
            sourceLibraryVersion: codeVersion)
        return NotebookEvidenceLink(id: UUID().uuidString.lowercased(), label: label, relationshipRole: "context",
            projectID: projectID, notebookCardID: cardID, source: source,
            passages: [NotebookEvidencePassage(exact: officialText, prefix: "", suffix: "", start: nil, end: nil)],
            createdAt: ISO8601DateFormatter().string(from: Date()),
            noteTarget: NotebookEvidenceNoteTarget(scope: "card", blockID: "", exact: ""))
    }
}
