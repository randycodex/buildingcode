import PhotosUI
import SwiftUI
import UIKit

struct NativeNotebookReferenceCandidate: Identifiable, Hashable, Sendable {
    let kind: String
    let referenceID: String
    let label: String
    let detail: String

    var id: String { "\(kind):\(referenceID)" }
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
    var cacheDirectoryURL: URL? = nil
    var onChanged: (() -> Void)? = nil

    init(
        projectID: String,
        projectName: String,
        accentColor: Color,
        referenceCandidates: [NativeNotebookReferenceCandidate],
        initialCardID: String? = nil,
        cacheDirectoryURL: URL? = nil,
        onChanged: (() -> Void)? = nil
    ) {
        self.projectID = projectID
        self.projectName = projectName
        self.accentColor = accentColor
        self.referenceCandidates = referenceCandidates
        self.initialCardID = initialCardID
        self.cacheDirectoryURL = cacheDirectoryURL
        self.onChanged = onChanged
    }

    var body: some View {
        ProjectNotebookSessionView(
            projectID: projectID, projectName: projectName, accentColor: accentColor,
            referenceCandidates: referenceCandidates, initialCardID: initialCardID,
            onChanged: onChanged, owner: library.privateRequestIdentity, cacheDirectoryURL: cacheDirectoryURL
        ).id(library.privateSessionID)
    }
}

private struct ProjectNotebookSessionView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.scenePhase) private var scenePhase

    let projectID: String
    let projectName: String
    let accentColor: Color
    let referenceCandidates: [NativeNotebookReferenceCandidate]
    let initialCardID: String?
    var onChanged: (() -> Void)? = nil

    @State private var cards: [ProjectNotebookCardSummary] = []
    @State private var localDrafts: [(scope: String, value: NativeNotebookDraft)] = []
    @State private var access = NotebookAccess(role: "viewer", readOnly: true)
    @State private var isLoading = true
    @State private var loadID: UUID?
    @State private var cachedAt: String?
    @State private var errorMessage: String?
    @State private var editorRoute: NativeNotebookEditorRoute?
    @State private var isVisible = false
    @State private var shouldRefreshAfterBackground = false
    @State private var hasPresentedInitialCard = false
    private let cache: ProjectHubOfflineCache
    private let owner: NativePrivateRequestIdentity?
    private var isCurrentOwner: Bool { owner != nil && owner == library.privateRequestIdentity }

    init(
        projectID: String,
        projectName: String,
        accentColor: Color,
        referenceCandidates: [NativeNotebookReferenceCandidate],
        initialCardID: String? = nil,
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
        self.onChanged = onChanged
    }

    var body: some View {
        VStack(spacing: 0) {
            Label("Project: \(projectName)", systemImage: "folder")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

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
                        description: Text(access.readOnly ? "This Project’s Notebook is read-only." : "Create a Note for analysis, evidence, and Research.")
                    )
                } else {
                    List {
                        if let errorMessage {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(errorMessage).font(.footnote).foregroundStyle(.secondary)
                                Button("Retry") { Task { await loadCards(forceNetwork: true) } }
                            }
                        }
                        if let cachedAt {
                            Text("Saved on this iPhone: \(notebookDate(cachedAt)). Connect to refresh access and content.")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        if !localDrafts.isEmpty {
                            Section("Drafts on this iPhone") {
                                ForEach(localDrafts, id: \.scope) { entry in
                                    Button {
                                        editorRoute = NativeNotebookEditorRoute(cardID: entry.value.cardID, draftID: String(entry.scope.dropFirst("native-notebook-draft:".count)))
                                    } label: {
                                        VStack(alignment: .leading, spacing: 5) {
                                            Text(entry.value.title.isEmpty ? "Untitled Note" : entry.value.title)
                                            Text(entry.value.pendingSave == nil ? "Unsynchronized draft" : "Save confirmation pending")
                                                .font(.caption).foregroundStyle(.secondary)
                                        }
                                    }
                                }
                            }
                        }
                        ForEach(cards) { card in
                            Button {
                                editorRoute = NativeNotebookEditorRoute(cardID: card.id)
                            } label: {
                                VStack(alignment: .leading, spacing: 7) {
                                    Text(card.title)
                                        .font(.body.weight(.semibold))
                                        .foregroundStyle(.primary)
                                    if !card.plainText.isEmpty {
                                        Text(card.plainText)
                                            .font(.subheadline)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(3)
                                    }
                                    HStack(spacing: 8) {
                                        if card.referenceCount > 0 {
                                            Label("\(card.referenceCount) linked", systemImage: "link")
                                        }
                                        Spacer()
                                        Text(notebookDate(card.updatedAt))
                                    }
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                }
                                .padding(.vertical, 6)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .listStyle(.plain)
                    .refreshable { await loadCards(forceNetwork: true) }
                }
            }
        }
        .navigationTitle("Notebook")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !access.readOnly {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("New Note", systemImage: "plus") {
                        editorRoute = NativeNotebookEditorRoute()
                    }
                }
            }
        }
        .tint(accentColor)
        .task {
            if !hasPresentedInitialCard, let initialCardID {
                hasPresentedInitialCard = true
                editorRoute = NativeNotebookEditorRoute(cardID: initialCardID)
            }
            await loadCards()
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
        .sheet(item: $editorRoute) { route in
            NavigationStack {
                NotebookCardEditorView(
                    projectID: projectID,
                    projectName: projectName,
                    routeID: route.id,
                    cardID: route.cardID,
                    readOnly: access.readOnly,
                    accentColor: accentColor,
                    referenceCandidates: referenceCandidates,
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

    private func loadCards(forceNetwork: Bool = false) async {
        guard isCurrentOwner, let owner else {
            cards = []
            access = NotebookAccess(role: "viewer", readOnly: true)
            errorMessage = "Sign in to load this Notebook."
            isLoading = false
            return
        }
        localDrafts = (try? cache.entries(NativeNotebookDraft.self, accountID: owner.accountID, projectID: projectID, scopePrefix: "native-notebook-draft:"))?.filter {
            $0.value.hasUnsynchronizedChanges
        }.sorted { ($0.value.editedAt ?? .distantPast) > ($1.value.editedAt ?? .distantPast) } ?? []
        let requestID = UUID()
        loadID = requestID
        if !forceNetwork, cards.isEmpty, let cached = try? cache.load(
            NotebookCardListResponse.self, accountID: owner.accountID,
            projectID: projectID, scope: "native-notebook-list"
        ) {
            cards = cached.value.cards
            // Cached access is descriptive; an online response authorizes edits.
            access = NotebookAccess(role: "viewer", readOnly: true)
            cachedAt = cached.cachedAt
        }
        isLoading = true
        defer { if isCurrentOwner && loadID == requestID { isLoading = false } }
        do {
            let response = try await library.notebookCards(projectID: projectID)
            guard isCurrentOwner, loadID == requestID, !Task.isCancelled else { return }
            cards = response.cards.sorted { $0.updatedAt > $1.updatedAt }
            access = response.access ?? NotebookAccess(role: "editor", readOnly: false)
            errorMessage = nil
            cachedAt = nil
            try? cache.store(response, accountID: owner.accountID, projectID: projectID, scope: "native-notebook-list")
        } catch {
            guard isCurrentOwner, loadID == requestID, !Task.isCancelled else { return }
            if !NativePrivateCachePolicy.permitsOfflineFallback(after: error) {
                cards = []
                cachedAt = nil
                access = NotebookAccess(role: "viewer", readOnly: true)
            }
            if NativePrivateCachePolicy.requiresInvalidation(after: error) {
                try? cache.removeProject(accountID: owner.accountID, projectID: projectID)
                localDrafts = []
                editorRoute = nil
            }
            errorMessage = nativeNotebookRequestErrorMessage(error)
        }
    }

    private func notebookDate(_ value: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: value) else { return value }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}

private func nativeNotebookRequestErrorMessage(_ error: Error) -> String {
    if let error = error as? URLError {
        switch error.code {
        case .notConnectedToInternet, .networkConnectionLost, .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed:
            return "Unable to connect. Check your internet connection, then try again."
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
    var editedAt: Date? = nil
    var clientMutationID: String? = nil
    var pendingSave: NativeNotebookSaveAttempt? = nil
    var baseContent: NativeNotebookEditableContent? = nil

    var hasUnsynchronizedChanges: Bool {
        pendingSave != nil || baseContent != NativeNotebookEditableContent(title: title, document: document, evidenceLinks: evidenceLinks)
    }
}

/// Persist the exact request until its acknowledgement arrives. A later edit must
/// not turn an uncertain create into a second create with a different key/body.
struct NativeNotebookSaveAttempt: Codable, Hashable, Sendable {
    let clientMutationID: String
    let cardID: String?
    let expectedVersion: Int
    let content: NativeNotebookEditableContent
}

struct NativeNotebookEditableContent: Codable, Hashable, Sendable {
    var title: String
    var document: NotebookDocument
    var evidenceLinks: [NotebookEvidenceLink]
}

private struct NotebookLinkEditor: Identifiable {
    let id: String
}

private struct NotebookImagePickerTarget: Identifiable {
    let id: String
}

private struct NotebookCardEditorView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.dismiss) private var dismiss

    let projectID: String
    let projectName: String
    let routeID: String
    let cardID: String?
    let readOnly: Bool
    let accentColor: Color
    let referenceCandidates: [NativeNotebookReferenceCandidate]
    let owner: NativePrivateRequestIdentity?
    private var isCurrentOwner: Bool { owner != nil && owner == library.privateRequestIdentity }
    let onSaved: () -> Void

    @State private var currentCardID: String?
    @State private var version = 0
    @State private var title = "Untitled Note"
    @State private var document = NotebookDocument.empty
    @State private var evidenceLinks: [NotebookEvidenceLink] = []
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var isDeleting = false
    @State private var needsSave = false
    @State private var hasLoaded = false
    @State private var statusMessage = ""
    @State private var errorMessage: String?
    @State private var saveTask: Task<Void, Never>?
    @State private var showingReferencePicker = false
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var isUploadingImage = false
    @State private var linkEditor: NotebookLinkEditor?
    @State private var linkLabel = ""
    @State private var linkURL = ""
    @State private var showingDeleteConfirmation = false
    @State private var lastSyncedContent: NativeNotebookEditableContent?
    @State private var lastLocalEditAt: Date?
    @State private var draftMutationID = UUID().uuidString.lowercased()
    @State private var mutationContent: NativeNotebookEditableContent?
    @State private var pendingSave: NativeNotebookSaveAttempt?
    @State private var hasLocalDraft = false
    @State private var requiresConflictReview = false
    @State private var conflictingCard: NotebookCard?
    @State private var showingConflictReview = false
    let cache: ProjectHubOfflineCache

    var body: some View {
        Group {
            if isLoading && !hasLoaded {
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
                            .disabled(readOnly)

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.footnote)
                                .foregroundStyle(.red)
                        }
                        if requiresConflictReview {
                            Button("Review latest version") { Task { await reviewLatestVersion() } }
                                .accessibilityIdentifier("native-notebook-review-conflict")
                        }

                        ForEach(Array(document.document.enumerated()), id: \.element.id) { index, block in
                            notebookBlock(block, at: index)
                        }

                        if !readOnly {
                            addBlockBar
                        }

                        if !statusMessage.isEmpty {
                            Text(statusMessage)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(18)
                }
            }
        }
        .navigationTitle(projectName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Done") { dismiss() }
            }
            if !readOnly && hasLoaded {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button("Save") { Task { await saveNow() } }
                        .disabled(isSaving || isDeleting || !hasLoaded || requiresConflictReview)
                    if currentCardID != nil {
                        Button("Delete", systemImage: "trash", role: .destructive) {
                            showingDeleteConfirmation = true
                        }
                        .disabled(isSaving || isDeleting)
                    }
                }
            }
        }
        .tint(accentColor)
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
                            Text("Saving your draft replaces this reviewed version. If it changes again, Permitext will ask you to review the conflict again.")
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
        .task { await loadCard() }
        .onChange(of: title) { _, _ in scheduleAutosave() }
        .onChange(of: document) { _, _ in scheduleAutosave() }
        .onChange(of: selectedPhoto) { _, item in
            guard let item else { return }
            Task { await uploadImage(item) }
        }
        .sheet(isPresented: $showingReferencePicker) {
            NavigationStack {
                List(referenceCandidates) { candidate in
                    Button {
                        document.document.append(
                            .reference(kind: candidate.kind, id: candidate.referenceID, label: candidate.label)
                        )
                        showingReferencePicker = false
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
                .navigationTitle("Link to Note")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { showingReferencePicker = false }
                    }
                }
            }
        }
        .alert("Add link", isPresented: Binding(
            get: { linkEditor != nil },
            set: { if !$0 { linkEditor = nil } }
        )) {
            TextField("Link text", text: $linkLabel)
            TextField("https://", text: $linkURL)
                .textInputAutocapitalization(.never)
                .keyboardType(.URL)
            Button("Cancel", role: .cancel) { linkEditor = nil }
            Button("Add") { applyLink() }
        } message: {
            Text("Links must use HTTPS, HTTP, or mailto.")
        }
        .confirmationDialog("Delete this Note?", isPresented: $showingDeleteConfirmation) {
            Button("Delete Note", role: .destructive) { Task { await deleteCard() } }
            Button("Cancel", role: .cancel) {}
        }
        .onDisappear {
            saveTask?.cancel()
            if hasLoaded && !readOnly {
                cacheDraft()
                Task { await saveNow() }
            }
        }
    }

    @ViewBuilder
    private func notebookBlock(_ block: NotebookBlock, at index: Int) -> some View {
        if block.type == "image" {
            VStack(alignment: .leading, spacing: 8) {
                NotebookAssetImage(projectID: projectID, url: block.props.url ?? "")
                    .environmentObject(library)
                if readOnly {
                    if let caption = block.props.caption, !caption.isEmpty {
                        Text(caption).font(.caption).foregroundStyle(.secondary)
                    }
                } else {
                    TextField("Image caption", text: Binding(
                        get: { document.document[safe: index]?.props.caption ?? "" },
                        set: { document.document[index].props.caption = $0 }
                    ))
                    .font(.caption)
                    Button("Remove image", systemImage: "trash", role: .destructive) {
                        document.document.remove(at: index)
                    }
                    .font(.caption)
                }
            }
            .padding(12)
            .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
        } else if let reference = block.content?.first?.props,
                  block.content?.first?.type == "permitextReference" {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: reference.referenceKind == "researchAnswer" ? "sparkles" : "text.quote")
                    .foregroundStyle(accentColor)
                VStack(alignment: .leading, spacing: 4) {
                    Text(reference.label)
                        .font(.subheadline.weight(.semibold))
                    Text(reference.referenceKind == "researchAnswer" ? "Permitext Research" : "Saved Evidence")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if !readOnly {
                    Button("Remove reference", systemImage: "xmark") {
                        document.document.remove(at: index)
                    }
                    .labelStyle(.iconOnly)
                }
            }
            .padding(12)
            .background(accentColor.opacity(0.10), in: RoundedRectangle(cornerRadius: 14))
        } else {
            VStack(alignment: .leading, spacing: 8) {
                if !readOnly {
                    HStack(spacing: 8) {
                        Menu(blockTypeLabel(block.type)) {
                            Button("Text") { setBlockType("paragraph", at: index) }
                            Button("Heading") { setBlockType("heading", at: index) }
                            Button("Bulleted list") { setBlockType("bulletListItem", at: index) }
                            Button("Numbered list") { setBlockType("numberedListItem", at: index) }
                        }
                        .font(.caption.weight(.semibold))
                        Spacer()
                        Button("Bold", systemImage: "bold") { toggleStyle(\.bold, at: index) }
                            .labelStyle(.iconOnly)
                            .foregroundStyle(blockStyle(at: index).bold == true ? accentColor : .secondary)
                        Button("Italic", systemImage: "italic") { toggleStyle(\.italic, at: index) }
                            .labelStyle(.iconOnly)
                            .foregroundStyle(blockStyle(at: index).italic == true ? accentColor : .secondary)
                        Button("Add link", systemImage: "link") { beginLink(at: index) }
                            .labelStyle(.iconOnly)
                        Button("Remove block", systemImage: "trash", role: .destructive) {
                            document.document.remove(at: index)
                        }
                        .labelStyle(.iconOnly)
                    }
                }

                if readOnly {
                    Text(blockText(block))
                        .font(blockFont(block))
                        .fontWeight(blockStyle(at: index).bold == true ? .bold : nil)
                        .italic(blockStyle(at: index).italic == true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    TextEditor(text: Binding(
                        get: { blockText(document.document[safe: index] ?? block) },
                        set: { setBlockText($0, at: index) }
                    ))
                    .font(blockFont(block))
                    .fontWeight(blockStyle(at: index).bold == true ? .bold : nil)
                    .italic(blockStyle(at: index).italic == true)
                    .frame(minHeight: block.type == "heading" ? 52 : 88)
                    .scrollContentBackground(.hidden)
                }
            }
            .padding(12)
            .background(Color.secondary.opacity(0.07), in: RoundedRectangle(cornerRadius: 14))
        }
    }

    private var addBlockBar: some View {
        HStack(spacing: 10) {
            Menu {
                Button("Text", systemImage: "text.alignleft") { document.document.append(.paragraph()) }
                Button("Heading", systemImage: "textformat.size") { document.document.append(.textBlock(type: "heading", level: 2)) }
                Button("Bulleted list", systemImage: "list.bullet") { document.document.append(.textBlock(type: "bulletListItem")) }
                Button("Numbered list", systemImage: "list.number") { document.document.append(.textBlock(type: "numberedListItem")) }
            } label: {
                Label("Add text", systemImage: "plus")
            }
            .buttonStyle(.bordered)

            Button("Link evidence", systemImage: "link") { showingReferencePicker = true }
                .buttonStyle(.bordered)
                .disabled(referenceCandidates.isEmpty)

            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                Label(isUploadingImage ? "Uploading" : "Image", systemImage: "photo")
            }
            .buttonStyle(.bordered)
            .disabled(isUploadingImage)
        }
        .font(.caption.weight(.semibold))
    }

    private func loadCard(forceNetwork: Bool = false) async {
        guard isCurrentOwner else { return }
        guard let accountID = owner?.accountID else { return }
        isLoading = true
        defer { isLoading = false }

        var restoredDraft: NativeNotebookDraft? = hasLocalDraft ? currentDraft : nil

        if !forceNetwork, !hasLoaded {
            if let cachedDraft = try? cache.load(
                NativeNotebookDraft.self,
                accountID: accountID,
                projectID: projectID,
                scope: "native-notebook-draft:\(routeID)"
            )?.value, cachedDraft.hasUnsynchronizedChanges {
                restoredDraft = cachedDraft
                apply(cachedDraft)
            } else if let cardID,
                      let cachedCard = try? cache.load(
                        NotebookCard.self,
                        accountID: accountID,
                        projectID: projectID,
                        scope: "native-notebook-card:\(cardID)"
                      )?.value {
                apply(cachedCard)
            } else {
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
            guard isCurrentOwner, !Task.isCancelled else { return }
            if let restoredDraft {
                if restoredDraft.pendingSave != nil {
                    // Reconcile the exact original save, even if the user edited
                    // a newer local revision before the response was lost.
                    statusMessage = "Draft kept on this iPhone. Retry Save to confirm the pending change."
                } else if restoredDraft.version != card.version {
                    conflictingCard = card
                    requiresConflictReview = true
                    errorMessage = "This Note changed elsewhere. Your draft and its original version are preserved. Review the latest Note before saving."
                } else if editableContent(for: restoredDraft) == editableContent(for: card) {
                    apply(card)
                    errorMessage = nil
                } else {
                    statusMessage = "Draft kept on this iPhone"
                }
            } else {
                apply(card)
                errorMessage = nil
            }
            try? cache.store(
                card,
                accountID: accountID,
                projectID: projectID,
                scope: "native-notebook-card:\(card.id)"
            )
            if needsSave {
                await saveNow()
            }
        } catch {
            guard isCurrentOwner else { return }
            if NativePrivateCachePolicy.requiresInvalidation(after: error) {
                // Preserve the draft, but do not display or edit revoked server content.
                try? cache.removeProject(accountID: accountID, projectID: projectID)
                hasLoaded = false
            }
            errorMessage = nativeNotebookRequestErrorMessage(error)
            statusMessage = hasLoaded ? "Saved on this iPhone; could not refresh" : ""
        }
    }

    private func apply(_ card: NotebookCard) {
        currentCardID = card.id
        version = card.version
        title = card.title
        document = card.document
        evidenceLinks = card.evidenceLinks
        lastSyncedContent = editableContent(for: card)
        lastLocalEditAt = nil
        hasLoaded = true
        hasLocalDraft = false
        pendingSave = nil
        draftMutationID = UUID().uuidString.lowercased()
        requiresConflictReview = false
        conflictingCard = nil
        mutationContent = editableContent
        statusMessage = "Synced"
    }

    private func apply(_ draft: NativeNotebookDraft) {
        currentCardID = draft.cardID
        version = draft.version
        title = draft.title
        document = draft.document
        evidenceLinks = draft.evidenceLinks
        lastSyncedContent = draft.baseContent
        lastLocalEditAt = draft.editedAt
        draftMutationID = draft.clientMutationID ?? UUID().uuidString.lowercased()
        pendingSave = draft.pendingSave
        mutationContent = editableContent(for: draft)
        hasLocalDraft = true
        hasLoaded = true
        statusMessage = "Draft on this iPhone"
    }

    private func scheduleAutosave() {
        guard isCurrentOwner else { return }
        guard hasLoaded, !readOnly, !isLoading, !isDeleting else { return }
        guard editableContent != lastSyncedContent else { return }
        lastLocalEditAt = Date()
        guard cacheDraft() else { return }
        if requiresConflictReview {
            statusMessage = "Draft kept on this iPhone; review the conflict before saving"
            return
        }
        statusMessage = "Saving…"
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(for: .milliseconds(650))
            guard !Task.isCancelled else { return }
            await saveNow()
        }
    }

    @MainActor
    private func saveNow() async {
        guard isCurrentOwner, hasLoaded, !readOnly, !isLoading, !isDeleting, !requiresConflictReview else { return }
        if isSaving { needsSave = true; return }
        guard pendingSave != nil || editableContent != lastSyncedContent else { return }
        isSaving = true
        needsSave = false
        defer {
            isSaving = false
            if isCurrentOwner, needsSave, !requiresConflictReview { Task { await saveNow() } }
        }
        guard cacheDraft() else { return }
        let attempt = pendingSave ?? NativeNotebookSaveAttempt(
            clientMutationID: draftMutationID, cardID: currentCardID, expectedVersion: version, content: editableContent
        )
        pendingSave = attempt
        guard cacheDraft() else { return }
        do {
            let saved = try await library.saveNotebookCard(
                projectID: projectID, cardID: attempt.cardID, expectedVersion: attempt.expectedVersion,
                title: normalizedTitle(attempt.content.title), document: attempt.content.document,
                evidenceLinks: attempt.content.evidenceLinks, clientMutationID: attempt.clientMutationID
            )
            guard isCurrentOwner, !Task.isCancelled else { return }
            pendingSave = nil
            completeSave(saved, contentAtStart: attempt.content)
        } catch let error as PermitextBackendHTTPError where error.statusCode == 409 {
            guard isCurrentOwner else { return }
            await reconcileVersionConflict(error)
        } catch {
            guard isCurrentOwner else { return }
            guard cacheDraft() else { return }
            statusMessage = "Draft kept on this iPhone"
            errorMessage = nativeNotebookRequestErrorMessage(error)
        }
    }

    private func deleteCard() async {
        guard isCurrentOwner, !isSaving, !isDeleting else { return }
        guard let currentCardID else { return }
        isDeleting = true
        saveTask?.cancel()
        defer { isDeleting = false }
        do {
            try await library.deleteNotebookCard(
                projectID: projectID,
                cardID: currentCardID,
                expectedVersion: version
            )
            guard isCurrentOwner, !Task.isCancelled else { return }
            // Dismissing a deleted editor must not schedule another save or
            // recreate the removed local draft in onDisappear.
            hasLoaded = false
            needsSave = false
            pendingSave = nil
            saveTask?.cancel()
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
            evidenceLinks: evidenceLinks, editedAt: lastLocalEditAt, clientMutationID: draftMutationID, pendingSave: pendingSave, baseContent: lastSyncedContent)
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
            try cache.store(currentDraft, accountID: accountID, projectID: projectID, scope: "native-notebook-draft:\(routeID)")
            return true
        } catch {
            errorMessage = "Could not save the local draft. Keep this Note open and try again after freeing space. \(error.localizedDescription)"
            statusMessage = "Draft is not saved on this iPhone"
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
        statusMessage = "Draft kept on this iPhone"
        errorMessage = "This Note changed elsewhere. Your draft and its original version are preserved. Review the latest Note before saving."
    }

    private func reviewLatestVersion() async {
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
        statusMessage = editableContent == lastSyncedContent ? "Synced" : "Saving reviewed draft…"
        guard cacheDraft() else { return }
        Task { await saveNow() }
    }

    @MainActor
    private func completeSave(
        _ saved: NotebookCard,
        contentAtStart: NativeNotebookEditableContent
    ) {
        let changedDuringSave = editableContent != contentAtStart
        if changedDuringSave {
            currentCardID = saved.id
            version = saved.version
            lastSyncedContent = editableContent(for: saved)
            statusMessage = "Saving latest changes…"
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
            evidenceLinks: evidenceLinks
        )
    }

    private func editableContent(for card: NotebookCard) -> NativeNotebookEditableContent {
        NativeNotebookEditableContent(
            title: card.title,
            document: card.document,
            evidenceLinks: card.evidenceLinks
        )
    }

    private func editableContent(for draft: NativeNotebookDraft) -> NativeNotebookEditableContent {
        NativeNotebookEditableContent(
            title: draft.title,
            document: draft.document,
            evidenceLinks: draft.evidenceLinks
        )
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
        guard isCurrentOwner else { return }
        isUploadingImage = true
        defer {
            isUploadingImage = false
            selectedPhoto = nil
        }
        do {
            guard let originalData = try await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: originalData),
                  let data = image.jpegData(compressionQuality: 0.86) else {
                throw PermitextBackendHTTPError.invalidResponse
            }
            guard isCurrentOwner, !Task.isCancelled else { return }
            let asset = try await library.uploadNotebookAsset(
                projectID: projectID,
                data: data,
                contentType: "image/jpeg",
                width: Int(image.size.width * image.scale),
                height: Int(image.size.height * image.scale)
            )
            guard isCurrentOwner, !Task.isCancelled else { return }
            document.document.append(
                .image(
                    url: asset.url,
                    name: "Notebook image",
                    width: asset.width
                )
            )
        } catch {
            guard isCurrentOwner else { return }
            errorMessage = nativeNotebookRequestErrorMessage(error)
        }
    }

    private func blockText(_ block: NotebookBlock) -> String {
        (block.content ?? []).map { inline in
            if inline.type == "text" { return inline.text ?? "" }
            if inline.type == "link" {
                return (inline.content ?? []).map { $0.text ?? "" }.joined()
            }
            return inline.props?.label ?? ""
        }.joined()
    }

    private func setBlockText(_ value: String, at index: Int) {
        guard document.document.indices.contains(index) else { return }
        let style = blockStyle(at: index)
        if document.document[index].content?.count == 1,
           document.document[index].content?.first?.type == "link" {
            document.document[index].content?[0].content = [
                NotebookInlineContent(type: "text", text: value, styles: style)
            ]
        } else {
            document.document[index].content = [
                NotebookInlineContent(type: "text", text: value, styles: style)
            ]
        }
    }

    private func blockStyle(at index: Int) -> NotebookTextStyles {
        guard let inline = document.document[safe: index]?.content?.first else { return NotebookTextStyles() }
        if inline.type == "link" { return inline.content?.first?.styles ?? NotebookTextStyles() }
        return inline.styles ?? NotebookTextStyles()
    }

    private func toggleStyle(_ keyPath: WritableKeyPath<NotebookTextStyles, Bool?>, at index: Int) {
        var style = blockStyle(at: index)
        style[keyPath: keyPath] = style[keyPath: keyPath] == true ? nil : true
        guard document.document.indices.contains(index) else { return }
        if document.document[index].content?.first?.type == "link" {
            document.document[index].content?[0].content?[0].styles = style
        } else if document.document[index].content?.isEmpty == false {
            document.document[index].content?[0].styles = style
        } else {
            document.document[index].content = [.text("", bold: style.bold == true, italic: style.italic == true)]
        }
    }

    private func setBlockType(_ type: String, at index: Int) {
        guard document.document.indices.contains(index) else { return }
        document.document[index].type = type
        document.document[index].props.level = type == "heading" ? 2 : nil
        document.document[index].props.isToggleable = type == "heading" ? false : nil
    }

    private func blockTypeLabel(_ type: String) -> String {
        switch type {
        case "heading": return "Heading"
        case "bulletListItem": return "Bulleted list"
        case "numberedListItem": return "Numbered list"
        default: return "Text"
        }
    }

    private func blockFont(_ block: NotebookBlock) -> Font {
        block.type == "heading" ? .title3.weight(.semibold) : .body
    }

    private func beginLink(at index: Int) {
        guard let block = document.document[safe: index] else { return }
        linkLabel = blockText(block)
        linkURL = block.content?.first?.type == "link" ? (block.content?.first?.href ?? "") : "https://"
        linkEditor = NotebookLinkEditor(id: block.id)
    }

    private func applyLink() {
        guard let blockID = linkEditor?.id,
              let index = document.document.firstIndex(where: { $0.id == blockID }),
              let url = URL(string: linkURL),
              ["https", "http", "mailto"].contains(url.scheme?.lowercased() ?? "") else {
            errorMessage = "Enter an HTTPS, HTTP, or mailto link."
            return
        }
        let style = blockStyle(at: index)
        document.document[index].content = [
            NotebookInlineContent(
                type: "link",
                href: linkURL,
                content: [NotebookInlineContent(type: "text", text: linkLabel, styles: style)]
            )
        ]
        linkEditor = nil
    }
}

private struct NotebookAssetImage: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    let projectID: String
    let url: String
    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        Group {
            if let image {
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
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .task(id: "\(library.privateSessionID):\(url)") { await load() }
    }

    private func load() async {
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
            image = UIImage(data: data)
            failed = image == nil
        } catch {
            guard identity == library.privateRequestIdentity, !Task.isCancelled else { return }
            failed = true
        }
    }
}

private extension Array {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
