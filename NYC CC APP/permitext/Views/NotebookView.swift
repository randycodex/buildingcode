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

    init(cardID: String? = nil) {
        self.id = cardID ?? "new:\(UUID().uuidString.lowercased())"
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
    var onChanged: (() -> Void)? = nil

    @State private var cards: [ProjectNotebookCardSummary] = []
    @State private var access = NotebookAccess(role: "viewer", readOnly: true)
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var editorRoute: NativeNotebookEditorRoute?
    @State private var isVisible = false
    @State private var hasPresentedInitialCard = false
    private let cache = ProjectHubOfflineCache()

    init(
        projectID: String,
        projectName: String,
        accentColor: Color,
        referenceCandidates: [NativeNotebookReferenceCandidate],
        initialCardID: String? = nil,
        onChanged: (() -> Void)? = nil
    ) {
        self.projectID = projectID
        self.projectName = projectName
        self.accentColor = accentColor
        self.referenceCandidates = referenceCandidates
        self.initialCardID = initialCardID
        self.onChanged = onChanged
    }

    var body: some View {
        Group {
            if isLoading && cards.isEmpty {
                ProgressView("Loading Notebook…")
            } else if cards.isEmpty {
                ContentUnavailableView(
                    "No Notes yet",
                    systemImage: "note.text",
                    description: Text(access.readOnly ? "This Project’s Notebook is read-only." : "Create a Note for analysis, evidence, and Research.")
                )
            } else {
                List {
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
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
            guard phase == .active, isVisible, editorRoute == nil else { return }
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
                    onSaved: {
                        Task { await loadCards(forceNetwork: true) }
                        onChanged?()
                    }
                )
                .environmentObject(library)
            }
        }
    }

    private func loadCards(forceNetwork: Bool = false) async {
        guard let accountID = library.signedInAccount?.appUserID else { return }
        if !forceNetwork,
           cards.isEmpty,
           let cached = try? cache.load(
                NotebookCardListResponse.self,
                accountID: accountID,
                projectID: projectID,
                scope: "native-notebook-list"
           ) {
            cards = cached.value.cards
            access = cached.value.access ?? access
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let response = try await library.notebookCards(projectID: projectID)
            cards = response.cards.sorted { $0.updatedAt > $1.updatedAt }
            access = response.access ?? NotebookAccess(role: "editor", readOnly: false)
            errorMessage = nil
            try? cache.store(
                response,
                accountID: accountID,
                projectID: projectID,
                scope: "native-notebook-list"
            )
        } catch {
            if cards.isEmpty { errorMessage = error.localizedDescription }
        }
    }

    private func notebookDate(_ value: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: value) else { return value }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}

private struct NativeNotebookDraft: Codable, Hashable, Sendable {
    var cardID: String?
    var version: Int
    var title: String
    var document: NotebookDocument
    var evidenceLinks: [NotebookEvidenceLink]
    var editedAt: Date? = nil
}

private struct NativeNotebookEditableContent: Hashable, Sendable {
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
    let onSaved: () -> Void

    @State private var currentCardID: String?
    @State private var version = 0
    @State private var title = "Untitled Note"
    @State private var document = NotebookDocument.empty
    @State private var evidenceLinks: [NotebookEvidenceLink] = []
    @State private var isLoading = false
    @State private var isSaving = false
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
    private let cache = ProjectHubOfflineCache()

    var body: some View {
        Group {
            if isLoading && !hasLoaded {
                ProgressView("Loading Note…")
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
            if !readOnly {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button("Save") { Task { await saveNow() } }
                        .disabled(isSaving || !hasLoaded)
                    if currentCardID != nil {
                        Button("Delete", systemImage: "trash", role: .destructive) {
                            showingDeleteConfirmation = true
                        }
                    }
                }
            }
        }
        .tint(accentColor)
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
                    Text(reference.referenceKind == "researchAnswer" ? "Terra Research" : "Saved Evidence")
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
        guard let accountID = library.signedInAccount?.appUserID else { return }
        isLoading = true
        defer { isLoading = false }

        var restoredDraft: NativeNotebookDraft?

        if !forceNetwork, !hasLoaded {
            if let cachedDraft = try? cache.load(
                NativeNotebookDraft.self,
                accountID: accountID,
                projectID: projectID,
                scope: "native-notebook-draft:\(routeID)"
            )?.value {
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
                hasLoaded = true
            }
        }

        guard let cardID = currentCardID ?? cardID else {
            hasLoaded = true
            return
        }
        do {
            let card = try await library.notebookCard(projectID: projectID, cardID: cardID)
            if let restoredDraft,
               editableContent(for: restoredDraft) != editableContent(for: card),
               let localEditAt = restoredDraft.editedAt,
               localEditAt > notebookDateValue(card.updatedAt) {
                currentCardID = card.id
                version = card.version
                lastSyncedContent = editableContent(for: card)
                lastLocalEditAt = localEditAt
                statusMessage = "Saving latest changes…"
                needsSave = true
            } else {
                apply(card)
            }
            errorMessage = nil
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
            if !hasLoaded { errorMessage = error.localizedDescription }
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
        statusMessage = "Synced"
    }

    private func apply(_ draft: NativeNotebookDraft) {
        currentCardID = draft.cardID
        version = draft.version
        title = draft.title
        document = draft.document
        evidenceLinks = draft.evidenceLinks
        lastSyncedContent = nil
        lastLocalEditAt = draft.editedAt
        hasLoaded = true
        statusMessage = "Draft on this iPhone"
    }

    private func scheduleAutosave() {
        guard hasLoaded, !readOnly else { return }
        guard editableContent != lastSyncedContent else { return }
        lastLocalEditAt = Date()
        cacheDraft()
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
        guard hasLoaded, !readOnly else { return }
        if isSaving {
            needsSave = true
            return
        }
        isSaving = true
        needsSave = false
        defer {
            isSaving = false
            if needsSave { Task { await saveNow() } }
        }
        cacheDraft()
        let contentAtStart = editableContent
        do {
            let saved = try await library.saveNotebookCard(
                projectID: projectID,
                cardID: currentCardID,
                expectedVersion: version,
                title: normalizedTitle(contentAtStart.title),
                document: contentAtStart.document,
                evidenceLinks: contentAtStart.evidenceLinks
            )
            completeSave(saved, contentAtStart: contentAtStart)
        } catch let error as PermitextBackendHTTPError where error.statusCode == 409 {
            await reconcileVersionConflict()
        } catch {
            statusMessage = "Draft kept on this iPhone"
            errorMessage = error.localizedDescription
        }
    }

    private func deleteCard() async {
        guard let currentCardID else { return }
        do {
            try await library.deleteNotebookCard(
                projectID: projectID,
                cardID: currentCardID,
                expectedVersion: version
            )
            onSaved()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func cacheDraft() {
        guard let accountID = library.signedInAccount?.appUserID else { return }
        try? cache.store(
            NativeNotebookDraft(
                cardID: currentCardID,
                version: version,
                title: title,
                document: document,
                evidenceLinks: evidenceLinks,
                editedAt: lastLocalEditAt
            ),
            accountID: accountID,
            projectID: projectID,
            scope: "native-notebook-draft:\(routeID)"
        )
    }

    @MainActor
    private func reconcileVersionConflict() async {
        guard let currentCardID else {
            statusMessage = "Draft kept on this iPhone"
            errorMessage = "Permitext could not reconcile this Note yet. Try Save again."
            return
        }

        cacheDraft()
        do {
            let serverCard = try await library.notebookCard(
                projectID: projectID,
                cardID: currentCardID
            )
            let localContent = editableContent
            let serverContent = editableContent(for: serverCard)

            if localContent == serverContent {
                apply(serverCard)
                storeServerCard(serverCard)
                errorMessage = nil
                onSaved()
                return
            }

            let serverEditAt = notebookDateValue(serverCard.updatedAt)
            if lastLocalEditAt == nil || serverEditAt >= (lastLocalEditAt ?? .distantPast) {
                // The local draft was cached before replacing it, so a failed or
                // interrupted reconciliation never destroys the user's work.
                apply(serverCard)
                storeServerCard(serverCard)
                errorMessage = nil
                statusMessage = "Synced latest change"
                onSaved()
                return
            }

            // This iPhone has the newest edit. Rebase it on the authoritative
            // version and retry exactly once; a second conflict remains a draft.
            version = serverCard.version
            lastSyncedContent = serverContent
            let rebasedContent = editableContent
            do {
                let saved = try await library.saveNotebookCard(
                    projectID: projectID,
                    cardID: currentCardID,
                    expectedVersion: serverCard.version,
                    title: normalizedTitle(rebasedContent.title),
                    document: rebasedContent.document,
                    evidenceLinks: rebasedContent.evidenceLinks
                )
                completeSave(saved, contentAtStart: rebasedContent)
            } catch {
                cacheDraft()
                statusMessage = "Draft kept on this iPhone"
                errorMessage = "Permitext found another newer edit. Your draft is safe; try Save again after syncing."
            }
        } catch {
            cacheDraft()
            statusMessage = "Draft kept on this iPhone"
            errorMessage = "Could not check the latest Note. Your draft is safe on this iPhone."
        }
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
        guard let accountID = library.signedInAccount?.appUserID else { return }
        try? cache.store(
            card,
            accountID: accountID,
            projectID: projectID,
            scope: "native-notebook-card:\(card.id)"
        )
    }

    private func uploadImage(_ item: PhotosPickerItem) async {
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
            let asset = try await library.uploadNotebookAsset(
                projectID: projectID,
                data: data,
                contentType: "image/jpeg",
                width: Int(image.size.width * image.scale),
                height: Int(image.size.height * image.scale)
            )
            document.document.append(
                .image(
                    url: asset.url,
                    name: "Notebook image",
                    width: asset.width
                )
            )
        } catch {
            errorMessage = error.localizedDescription
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
        .task(id: url) { await load() }
    }

    private func load() async {
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
            image = UIImage(data: data)
            failed = image == nil
        } catch {
            failed = true
        }
    }
}

private extension Array {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
