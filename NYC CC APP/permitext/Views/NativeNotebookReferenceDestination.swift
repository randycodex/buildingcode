import SwiftUI

/// A route carries source identity, never a title parsed as a locator. Legacy
/// canonical references may contain a bookmark client ID instead of a section ID.
struct NativeNotebookReferenceRoute: Identifiable, Hashable {
    let referenceKind: String
    let referenceID: String
    let label: String
    var conversationID: String? = nil
    var source: NotebookEvidenceSource? = nil
    var passages: [NotebookEvidencePassage] = []
    var codeVersion: String? = nil

    var id: String { "\(referenceKind):\(referenceID):\(source?.codeVersion ?? codeVersion ?? "")" }
}

private struct NativeNotebookReaderTarget: Hashable {
    let sectionID: Int64
    let codeVersion: String
    let codeSectionID: Int64?
}

enum NativeNotebookReferenceIdentity {
    static func acceptsCandidateMetadata(kind: String, referenceID: String) -> Bool {
        kind != "canonicalSection" || Int64(referenceID) == nil
    }

    /// A section number alone does not establish an edition. Only a saved
    /// client identity, or an explicit section + canonical edition pair, can
    /// resolve through bookmarks; bare numeric IDs need catalog uniqueness.
    static func bookmarkMatches(referenceID: String, canonicalEdition: String?, sectionID: String,
                                clientID: String?, bookmarkEdition: String) -> Bool {
        guard !referenceID.isEmpty else { return false }
        let identityMatches = clientID == referenceID || (canonicalEdition != nil && sectionID == referenceID)
        return identityMatches && (canonicalEdition == nil || canonicalEdition == bookmarkEdition)
    }

    static func citationSectionID(explicit: String?, matchedSourceSectionIDs: [String]) -> String? {
        if let explicit, !explicit.isEmpty { return explicit }
        let unique = Set(matchedSourceSectionIDs.filter { !$0.isEmpty })
        return unique.count == 1 ? unique.first : nil
    }
}

/// Pushed by the Note, so ordinary Back navigation leaves its mounted editor
/// and draft intact. Opening a reference never changes the selected main tab.
struct NativeNotebookReferenceDestination: View {
    let route: NativeNotebookReferenceRoute
    let projectID: String
    @ObservedObject var sharedLibrary: CodeLibraryViewModel
    @State private var readerTarget: NativeNotebookReaderTarget?
    @State private var conversation: ResearchConversation?
    @State private var answer: ResearchAnswer?
    @State private var nestedRoute: NativeNotebookReferenceRoute?
    @State private var errorMessage: String?
    @State private var isLoading = true
    @State private var isCached = false
    private let owner: NativePrivateRequestIdentity?
    private let cache = ProjectHubOfflineCache()

    init(route: NativeNotebookReferenceRoute, projectID: String, sharedLibrary: CodeLibraryViewModel) {
        self.route = route
        self.projectID = projectID
        self.sharedLibrary = sharedLibrary
        self.owner = sharedLibrary.privateRequestIdentity
    }

    private var isCurrentOwner: Bool { owner != nil && owner == sharedLibrary.privateRequestIdentity }

    var body: some View {
        Group {
            if !isCurrentOwner {
                ContentUnavailableView("Reference unavailable", systemImage: "lock", description: Text("Sign in again to open this Note’s sources."))
            } else if let readerTarget {
                LinkedChapterReaderDestination(sectionID: readerTarget.sectionID, codeVersion: readerTarget.codeVersion,
                    codeSectionID: readerTarget.codeSectionID, passages: route.passages,
                    isWholeSection: route.source?.scope == "section", sharedLibrary: sharedLibrary)
            } else if let answer, let conversation {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(route.label).font(.title3.weight(.semibold))
                        if isCached {
                            Label("Saved on this iPhone · Could not refresh", systemImage: "wifi.slash")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Text(answer.structuredCopyText(sourceStatus: conversation.sourceStatus))
                            .textSelection(.enabled)
                        if !answer.citations.isEmpty {
                            Text("Open cited provisions").font(.headline)
                            ForEach(answer.citations) { citation in
                                Button {
                                    nestedRoute = citationRoute(citation, sources: conversation.sources)
                                } label: {
                                    Label(citationLabel(citation), systemImage: "text.book.closed")
                                        .multilineTextAlignment(.leading)
                                        .frame(minHeight: 44, alignment: .leading)
                                }
                            }
                        }
                        ForEach(Array((answer.supportingSources ?? []).enumerated()), id: \.offset) { _, source in
                            if let url = source.webURL { Link(source.displayTitle, destination: url) }
                        }
                    }.frame(maxWidth: .infinity, alignment: .leading).padding()
                }
            } else if let errorMessage {
                ContentUnavailableView {
                    Label("Reference unavailable", systemImage: "doc.questionmark")
                } description: {
                    Text(errorMessage)
                } actions: {
                    Button("Retry") { Task { await loadReference() } }
                }
            } else if isLoading {
                ProgressView("Opening reference…")
            }
        }
        .navigationTitle(route.referenceKind == "researchAnswer" ? "Linked Assistant answer" : "Linked source")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $nestedRoute) { next in
            NativeNotebookReferenceDestination(route: next, projectID: projectID, sharedLibrary: sharedLibrary)
        }
        .task(id: route.id) { await loadReference() }
        .onChange(of: sharedLibrary.privateSessionID) { _, _ in
            readerTarget = nil
            conversation = nil
            answer = nil
            nestedRoute = nil
        }
    }

    @MainActor private func loadReference() async {
        guard isCurrentOwner, let owner else { return }
        isLoading = true
        errorMessage = nil
        defer { if isCurrentOwner { isLoading = false } }
        if route.referenceKind == "researchAnswer" {
            var conversationID = route.conversationID
            if conversationID == nil,
               let folder = sharedLibrary.folders.first(where: { sharedLibrary.backendProjectID(for: $0.id) == projectID }) {
                do {
                    let project = try await sharedLibrary.projectHubSnapshot(folderID: folder.id)
                    guard isCurrentOwner, !Task.isCancelled else { return }
                    conversationID = project.researchAnswers.first(where: { $0.id == route.referenceID })?.conversationID
                } catch {
                    guard isCurrentOwner, !Task.isCancelled else { return }
                    errorMessage = "Could not find this answer’s saved conversation. Return to the Note and retry when connected."
                    return
                }
            }
            guard let conversationID, !conversationID.isEmpty else {
                errorMessage = "This reference has no saved conversation locator. Refresh the Project and open it again."
                return
            }
            do {
                let loaded = try await sharedLibrary.researchConversation(id: conversationID)
                guard isCurrentOwner, !Task.isCancelled else { return }
                guard let matched = loaded.messages.first(where: { $0.id == route.referenceID && $0.role == "assistant" })?.answer else {
                    errorMessage = "The exact saved answer is no longer available in this conversation."
                    return
                }
                conversation = loaded
                answer = matched
                isCached = false
                try? cache.store(loaded, accountID: owner.accountID, projectID: projectID, scope: "native-note-answer:\(route.referenceID)")
            } catch {
                guard isCurrentOwner, !Task.isCancelled else { return }
                if NativePrivateCachePolicy.requiresInvalidation(after: error) {
                    try? cache.remove(accountID: owner.accountID, projectID: projectID, scope: "native-note-answer:\(route.referenceID)")
                    try? ResearchConversationCacheLifecycle.invalidateServerCopy(cache: cache, accountID: owner.accountID, conversationID: conversationID, error: error)
                    conversation = nil
                    answer = nil
                } else if NativePrivateCachePolicy.permitsOfflineFallback(after: error) {
                    let ownCopy = try? cache.load(ResearchConversation.self, accountID: owner.accountID, projectID: projectID, scope: "native-note-answer:\(route.referenceID)")?.value
                    let researchCopy = try? ResearchConversationCacheLifecycle.load(ResearchConversation.self, cache: cache, accountID: owner.accountID, conversationID: conversationID)?.value
                    if let saved = ownCopy ?? researchCopy,
                       saved.id == conversationID,
                       let matched = saved.messages.first(where: { $0.id == route.referenceID && $0.role == "assistant" })?.answer {
                        conversation = saved
                        answer = matched
                        isCached = true
                        return
                    }
                }
                errorMessage = "Could not open this saved Assistant answer. Your Note is unchanged. \(error.localizedDescription)"
            }
            return
        }

        guard ["canonicalSection", "selectedPassage", "evidence"].contains(route.referenceKind) else {
            errorMessage = "This reference type cannot be opened on this iPhone yet."
            return
        }
        if let source = route.source {
            guard let sectionID = Int64(source.sectionID), !source.codeVersion.isEmpty else {
                errorMessage = "This passage is missing its exact section and edition. No alternative source was opened."
                return
            }
            readerTarget = NativeNotebookReaderTarget(sectionID: sectionID, codeVersion: source.codeVersion, codeSectionID: nil)
            return
        }
        if route.referenceKind == "selectedPassage" {
            errorMessage = "This passage link is missing its exact source locator. No alternative source was opened."
            return
        }
        let projectBookmarks = sharedLibrary.folders.first(where: { sharedLibrary.backendProjectID(for: $0.id) == projectID })
            .map { sharedLibrary.bookmarks(inFolder: $0.id) } ?? []
        let matches = (projectBookmarks + sharedLibrary.bookmarks).filter {
            NativeNotebookReferenceIdentity.bookmarkMatches(referenceID: route.referenceID,
                canonicalEdition: route.codeVersion.map(UserContentSyncCodeVersion.server), sectionID: String($0.id),
                clientID: $0.clientID, bookmarkEdition: UserContentSyncCodeVersion.server($0.codeVersion))
        }
        let targets = Set(matches.map { NativeNotebookReaderTarget(sectionID: $0.id, codeVersion: UserContentSyncCodeVersion.server($0.codeVersion), codeSectionID: $0.codeSectionID) })
        if targets.count == 1, let target = targets.first {
            readerTarget = target
            return
        }
        guard targets.isEmpty, let sectionID = Int64(route.referenceID) else {
            errorMessage = "This saved reference does not identify a unique section and edition. No alternative source was opened."
            return
        }
        if let codeVersion = route.codeVersion, !codeVersion.isEmpty {
            readerTarget = NativeNotebookReaderTarget(sectionID: sectionID, codeVersion: codeVersion, codeSectionID: nil)
            return
        }
        let access = await sharedLibrary.authoredSourceNavigationAccess(sectionID: sectionID)
        guard isCurrentOwner, !Task.isCancelled else { return }
        switch access {
        case .allowed(let target), .requiresEnable(let target):
            readerTarget = NativeNotebookReaderTarget(sectionID: target.sectionID, codeVersion: target.source.canonicalEdition, codeSectionID: target.source.categoryID)
        case .unavailable:
            errorMessage = "The exact source and edition could not be identified in the installed library. No alternative source was opened."
        }
    }

    private func citationLabel(_ citation: ResearchCitation) -> String {
        let parts = [citation.codePrefix, citation.sectionNumber, citation.title, citation.codeEdition].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? "Cited provision" : parts.joined(separator: " · ")
    }

    private func citationRoute(_ citation: ResearchCitation, sources: [ResearchSource]) -> NativeNotebookReferenceRoute {
        let ids = Set(([citation.sourceID].compactMap { $0 }) + (citation.sourceIDs ?? []))
        let matchedSectionIDs = sources.filter { ids.contains($0.id) }.compactMap(\.sectionID)
        let sectionID = NativeNotebookReferenceIdentity.citationSectionID(explicit: citation.sectionID, matchedSourceSectionIDs: matchedSectionIDs)
        return NativeNotebookReferenceRoute(referenceKind: "canonicalSection", referenceID: sectionID ?? "", label: citationLabel(citation), codeVersion: citation.codeVersion)
    }
}

/// Pushed on the originating stack. Its chapter, library and viewport belong to
/// this destination, independently of the tabs and handoff for the main Reader.
struct LinkedChapterReaderDestination: View {
    let sectionID: Int64
    let codeVersion: String
    let codeSectionID: Int64?
    let passages: [NotebookEvidencePassage]
    var isWholeSection = false
    var evidenceFolderID: Int64? = nil
    @ObservedObject private var sharedLibrary: CodeLibraryViewModel
    @State private var prepared: PreparedSearchReaderDestination?
    @State private var fallbackLibrary: CodeLibraryViewModel?
    @State private var accountPresentationID = UUID()
    @State private var showsSavedText = false
    @State private var rememberedSectionID: Int64?
    @State private var rememberedBlockID: String?
    @State private var rememberedViewport: NativeReaderViewportPosition?
    @State private var rememberedAnchorID: String?
    @State private var rememberedScrollOffset: Double?
    @State private var sessionID: UUID
    @State private var originTab: AppTab

    init(sectionID: Int64, codeVersion: String, codeSectionID: Int64?, passages: [NotebookEvidencePassage],
         isWholeSection: Bool = false, evidenceFolderID: Int64? = nil, sharedLibrary: CodeLibraryViewModel) {
        self.sectionID = sectionID
        self.codeVersion = codeVersion
        self.codeSectionID = codeSectionID
        self.passages = passages
        self.isWholeSection = isWholeSection
        self.evidenceFolderID = evidenceFolderID
        self.sharedLibrary = sharedLibrary
        _sessionID = State(initialValue: sharedLibrary.privateSessionID)
        _originTab = State(initialValue: sharedLibrary.selectedTab)
    }

    private var isActive: Bool { sharedLibrary.selectedTab == originTab }

    var body: some View {
        Group {
            if sharedLibrary.privateSessionID != sessionID {
                ContentUnavailableView("Passage unavailable", systemImage: "lock")
            } else if let prepared {
                chapter(prepared)
            } else if let fallbackLibrary {
                readerSession(fallbackLibrary) {
                    ReaderView(sectionID: sectionID, codeVersion: codeVersion, codeSectionID: codeSectionID,
                        returnsToProjectsAfterRemoval: evidenceFolderID != nil, usesCompactSourceHeader: true,
                        selectedExcerpts: isWholeSection ? [] : passages.map(\.exact))
                }
            } else {
                ProgressView("Opening passage…")
            }
        }
        .task(id: sharedLibrary.activeCodeSourceRevision) {
            guard prepared == nil, fallbackLibrary == nil, sharedLibrary.privateSessionID == sessionID else { return }
            do {
                let destination = try await PreparedSearchReaderDestination.prepare(
                    route: SearchReaderRoute(sectionID: sectionID, sourceVersion: codeVersion, codeSectionID: codeSectionID),
                    sharedLibrary: sharedLibrary)
                guard !Task.isCancelled, sharedLibrary.privateSessionID == sessionID else { return }
                LocalPerformanceRecorder.record(.linkedChapterPrepared)
                prepared = destination
            } catch {
                guard !Task.isCancelled, sharedLibrary.privateSessionID == sessionID else { return }
                // The single-section Reader retains source-enabling and legacy-edition recovery.
                fallbackLibrary = sharedLibrary.makeSearchReaderLibrary(sourceVersion: codeVersion)
            }
        }
    }

    private func chapter(_ prepared: PreparedSearchReaderDestination) -> some View {
        let library = prepared.library
        let occurrences = evidenceFolderID.flatMap { library.readerEvidence[sectionID]?[$0]?.occurrences } ?? [:]
        let linkedPassage = isWholeSection || passages.isEmpty ? nil : LinkedReaderPassage(passages: passages, occurrences: occurrences)
        let savedTextTitle = isWholeSection ? "Saved section" : "Saved passage"
        return readerSession(library) {
            ChapterHTMLReaderView(chapter: prepared.chapter, initialSection: prepared.section,
                rememberedNativeSectionID: $rememberedSectionID, rememberedNativeBlockID: $rememberedBlockID,
                rememberedNativeViewport: $rememberedViewport, rememberedAnchorID: $rememberedAnchorID,
                rememberedScrollOffset: $rememberedScrollOffset, preparedNativeOpening: prepared.nativeOpening,
                linkedPassage: linkedPassage)
                .toolbar {
                    if !passages.isEmpty {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button(savedTextTitle, systemImage: "quote.opening") { showsSavedText = true }
                                .labelStyle(.iconOnly)
                        }
                    }
                }
                .sheet(isPresented: $showsSavedText) {
                    NavigationStack {
                        ScrollView {
                            VStack(alignment: .leading, spacing: 12) {
                                ForEach(Array(passages.enumerated()), id: \.offset) { _, passage in
                                    Text(passage.exact).textSelection(.enabled)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding()
                        }
                        .navigationTitle(savedTextTitle)
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar {
                            ToolbarItem(placement: .confirmationAction) { Button("Done") { showsSavedText = false } }
                        }
                    }
                    .presentationDetents([.medium, .large])
                }
        }
    }

    private func readerSession<Content: View>(_ library: CodeLibraryViewModel, @ViewBuilder content: () -> Content) -> some View {
        content()
            .environmentObject(library)
            .environment(\.isBrowserTabActive, isActive)
            .modifier(PermitextAccountFlowPresentation(library: sharedLibrary, ownerID: accountPresentationID))
            .onAppear { updateAccountPresentation(active: isActive) }
            .onChange(of: isActive) { _, active in updateAccountPresentation(active: active) }
            .onDisappear { updateAccountPresentation(active: false) }
            .onChange(of: sharedLibrary.privateSessionID) { _, _ in library.synchronizeIndependentReaderSession(from: sharedLibrary) }
            .onChange(of: sharedLibrary.readerTheme) { _, _ in library.synchronizeIndependentReaderSession(from: sharedLibrary) }
            .onChange(of: sharedLibrary.currentCapabilityContract) { _, _ in library.synchronizeIndependentReaderSession(from: sharedLibrary) }
            .onChange(of: sharedLibrary.activeProjectID) { _, _ in library.synchronizeIndependentReaderSession(from: sharedLibrary) }
            .onChange(of: sharedLibrary.activeCodeSourceRevision) { _, _ in library.synchronizeIndependentReaderSession(from: sharedLibrary) }
            .onChange(of: sharedLibrary.bookmarkRevision) { _, _ in library.reconcileExternalSavedWorkChange(scheduleAccountSync: false) }
            .onChange(of: library.bookmarkRevision) { _, _ in sharedLibrary.reconcileExternalSavedWorkChange(from: library, scheduleAccountSync: true) }
            .onChange(of: library.pendingResearchSelections) { _, selections in
                guard !selections.isEmpty else { return }
                for selection in selections { sharedLibrary.sendToResearch(selection) }
                library.acknowledgePendingResearchSelections(selections)
            }
    }

    private func updateAccountPresentation(active: Bool) {
        if active {
            sharedLibrary.accountPresentationOwnerID = accountPresentationID
        } else if sharedLibrary.accountPresentationOwnerID == accountPresentationID {
            sharedLibrary.accountPresentationOwnerID = nil
        }
    }
}
