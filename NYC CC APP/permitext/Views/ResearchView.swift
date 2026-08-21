import SwiftUI

private struct ResearchQuestionAttempt: Identifiable, Equatable {
    let id: String
    let question: String
}

private struct PendingResearchVisualReview: Identifiable, Equatable {
    let id = UUID()
    let originalSelection: ResearchSelectionRequest
    let review: ResearchSelectionReviewResponse
}

private struct PendingResearchDeletion: Identifiable, Equatable {
    let id: String
    let title: String
}

struct ResearchRequestReconciliation {
    static func matchesCompletedAttempt(
        messages: [ResearchMessage],
        requestID: String,
        question: String,
        priorMessageIDs: Set<String>
    ) -> Bool {
        let newMessages = messages.filter { !priorMessageIDs.contains($0.id) }
        let messagesForRequest = newMessages.filter { $0.requestID == requestID }

        if newMessages.contains(where: { $0.requestID != nil }) {
            let containsQuestion = messagesForRequest.contains {
                $0.role == "user" && $0.question == question
            }
            let containsAnswer = messagesForRequest.contains {
                $0.role == "assistant" && $0.answer != nil
            }
            return containsQuestion && containsAnswer
        }

        // Compatibility for conversations created before the server exposed
        // the request identifier on serialized messages.
        let containsQuestion = newMessages.contains {
            $0.role == "user" && $0.question == question
        }
        let containsAnswer = newMessages.contains {
            $0.role == "assistant" && $0.answer != nil
        }
        return containsQuestion && containsAnswer
    }
}

struct ResearchRequestFailurePresentation: Equatable {
    let message: String

    static func resolve(_ error: Error) -> ResearchRequestFailurePresentation {
        if let backendError = error as? PermitextBackendHTTPError {
            return resolve(backendError)
        }

        if let urlError = error as? URLError {
            switch urlError.code {
            case .timedOut:
                return retainedQuestion(
                    "Terra is taking longer than expected. Permitext checked for a completed answer but did not find one yet."
                )
            case .notConnectedToInternet, .networkConnectionLost:
                return retainedQuestion("Research could not connect to the internet.")
            case .cancelled:
                return retainedQuestion("Research was cancelled.")
            default:
                return retainedQuestion("Research could not reach Terra.")
            }
        }

        return retainedQuestion("Research could not reach Terra.")
    }

    private static func resolve(
        _ error: PermitextBackendHTTPError
    ) -> ResearchRequestFailurePresentation {
        let code = error.serverCode?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let serverMessage = error.serverMessage?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let verificationCodes: Set<String> = [
            "INVALID_RESEARCH_RESPONSE",
            "INVALID_RESEARCH_CITATION",
            "INVALID_RESEARCH_WEB_CITATION",
            "INVALID_RESEARCH_EVIDENCE_ANALYSIS",
            "INVALID_RESEARCH_VERIFICATION",
            "RESEARCH_VERIFIER_ERROR",
            "RESEARCH_VERIFICATION_FAILED"
        ]
        let providerCodes: Set<String> = [
            "RESEARCH_NOT_CONFIGURED",
            "RESEARCH_PROVIDER_ERROR",
            "RESEARCH_EVAL_SPEND_CAP",
            "TIMEOUTERROR"
        ]

        switch code {
        case "RESEARCH_EVIDENCE_NOT_FOUND":
            return retainedQuestion(
                serverMessage ?? "Permitext could not locate enacted text in the current authorized corpus for this question. Try a more specific code topic or citation."
            )
        case "RESEARCH_EVIDENCE_REQUIRED", "RESEARCH_SOURCE_CHANGED", "RESEARCH_REFUSAL":
            return retainedQuestion(serverMessage ?? "Research needs updated enacted evidence before it can answer.")
        case "RESEARCH_CAPACITY_REVIEW":
            return retainedQuestion(serverMessage ?? "Research is temporarily unavailable while account capacity is reviewed.")
        case "RESEARCH_CANCELLED":
            return retainedQuestion("Research was cancelled.")
        case let value? where verificationCodes.contains(value):
            return retainedQuestion(
                "Terra produced a response, but Permitext could not verify it against the enacted evidence."
            )
        case let value? where providerCodes.contains(value):
            return retainedQuestion("Terra's research service is temporarily unavailable.")
        default:
            break
        }

        if error.isAuthenticationFailure {
            return retainedQuestion("Your Permitext session no longer has access to Research. Sign in again and retry.")
        }

        if error.statusCode == 502,
           serverMessage?.localizedCaseInsensitiveContains("verified") == true {
            return retainedQuestion(
                "Terra produced a response, but Permitext could not verify it against the enacted evidence."
            )
        }

        if let statusCode = error.statusCode, statusCode >= 500 {
            return retainedQuestion("Terra's research service is temporarily unavailable.")
        }

        if let serverMessage, !serverMessage.isEmpty {
            return retainedQuestion(serverMessage)
        }

        return retainedQuestion("Research could not reach Terra.")
    }

    private static func retainedQuestion(_ explanation: String) -> ResearchRequestFailurePresentation {
        let normalized = explanation.trimmingCharacters(in: .whitespacesAndNewlines)
        let punctuation = normalized.last.map { ".!?".contains($0) } == true ? "" : "."
        return ResearchRequestFailurePresentation(
            message: "\(normalized)\(punctuation) Your question is still here."
        )
    }
}

struct ResearchView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.scenePhase) private var scenePhase
    @State private var summaries: [ResearchConversationSummary] = []
    @State private var conversation: ResearchConversation?
    @State private var question = ""
    @State private var isLoading = false
    @State private var isCreatingConversation = false
    @State private var isConsumingPendingSelection = false
    @State private var isSending = false
    @State private var pendingQuestionAttempt: ResearchQuestionAttempt?
    @State private var failedQuestionAttempt: ResearchQuestionAttempt?
    @State private var errorMessage: String?
    @State private var questionErrorMessage: String?
    @State private var pendingVisualReview: PendingResearchVisualReview?
    @State private var showingRename = false
    @State private var draftTitle = ""
    @State private var pendingAssignmentProjectID: String?
    @State private var showingAssignmentConfirmation = false
    @State private var pendingDeletion: PendingResearchDeletion?
    @State private var deletingConversationID: String?
    @State private var showingSettings = false
    @State private var recoverySettingsSection: SettingsSection = .account
    @State private var isRefreshingSources = false
    @State private var isConfirmingProjectContext = false
    @State private var isVisible = false
    private let cache: ProjectHubOfflineCache

    init(cacheDirectoryURL: URL? = nil) {
        cache = ProjectHubOfflineCache(directoryURL: cacheDirectoryURL)
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                researchScreenHeader

                Group {
                    if library.signedInAccount == nil {
                        researchAccessRecovery(
                            title: "Sign in to use Research",
                            description: pendingSelectionRecoveryDescription(
                                fallback: "Research conversations synchronize with Permitext on the web."
                            ),
                            buttonTitle: "Open Account",
                            section: .account
                        )
                    } else if !library.hasResearchAccess {
                        researchAccessRecovery(
                            title: "Research requires the Research Add-On",
                            description: pendingSelectionRecoveryDescription(
                                fallback: "Manage your plan from Settings."
                            ),
                            buttonTitle: "View Plans",
                            section: .plan
                        )
                    } else if let conversation {
                        conversationView(conversation)
                    } else if isLoading && summaries.isEmpty {
                        ProgressView("Loading Research…")
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        historyView
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .padding(.top, CodeScreenMetrics.scrollMeasuredTitleTopPadding)
            .background(CodeAppBackdrop(accent: Color.appChrome).ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .navigationBar)
            .sheet(item: $pendingVisualReview) { pending in
                ResearchVisualReviewSheet(
                    review: pending.review,
                    onCancel: { cancelVisualReview(pending) },
                    onConfirm: { sourceIDs in
                        Task { await confirmVisualReview(pending, sourceIDs: sourceIDs) }
                    }
                )
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView(initialSection: recoverySettingsSection)
                    .environmentObject(library)
            }
            .alert("Rename Research", isPresented: $showingRename) {
                TextField("Research title", text: $draftTitle)
                Button("Cancel", role: .cancel) {}
                Button("Save") { Task { await renameConversation() } }
            }
            .confirmationDialog(
                "Move this Research conversation?",
                isPresented: $showingAssignmentConfirmation,
                titleVisibility: .visible
            ) {
                Button("Move Conversation") {
                    Task { await assignConversation(projectID: pendingAssignmentProjectID, confirmed: true) }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Terra will use the destination Project’s current facts for future answers. Existing answers keep their original evidence and context.")
            }
            .alert(
                "Delete Research conversation?",
                isPresented: Binding(
                    get: { pendingDeletion != nil },
                    set: { if !$0 { pendingDeletion = nil } }
                ),
                presenting: pendingDeletion
            ) { pending in
                Button("Delete Conversation", role: .destructive) {
                    pendingDeletion = nil
                    Task { await deleteConversation(id: pending.id) }
                }
                Button("Cancel", role: .cancel) {
                    pendingDeletion = nil
                }
            } message: { pending in
                Text("\u{201c}\(pending.title)\u{201d} will be permanently deleted from Permitext. This cannot be undone.")
            }
            .task(id: "\(library.signedInAccount?.appUserID ?? "signed-out"):\(library.hasResearchAccess)") {
                await loadHistory()
                await openActiveConversationIfNeeded()
                await consumePendingSelectionIfNeeded()
            }
            .onChange(of: library.activeResearchConversationID) { _, _ in
                Task { await openActiveConversationIfNeeded() }
            }
            .onChange(of: library.pendingResearchSelections) { _, selections in
                guard !selections.isEmpty else { return }
                Task { await consumePendingSelectionIfNeeded() }
            }
            .onChange(of: scenePhase) { _, phase in
                guard phase == .active, isVisible else { return }
                Task { await refreshFromWeb() }
            }
            .onAppear { isVisible = true }
            .onDisappear { isVisible = false }
        }
    }

    private func researchAccessRecovery(
        title: String,
        description: String,
        buttonTitle: String,
        section: SettingsSection
    ) -> some View {
        VStack(spacing: 14) {
            Image("Astroid")
                .resizable()
                .scaledToFit()
                .frame(width: 44, height: 44)
                .accessibilityHidden(true)
            Text(title)
                .font(.title3.weight(.semibold))
                .multilineTextAlignment(.center)
            Text(description)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button(buttonTitle) {
                recoverySettingsSection = section
                showingSettings = true
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("research-recovery-action")
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func pendingSelectionRecoveryDescription(fallback: String) -> String {
        guard !library.pendingResearchSelections.isEmpty else { return fallback }
        return "Your selected Reader passage is kept. \(fallback)"
    }

    private var researchScreenHeader: some View {
        CodeScreenTitleRow(title: "Research") {
            HStack(spacing: 6) {
                if conversation != nil {
                    Button {
                        library.activeResearchConversationID = nil
                        self.conversation = nil
                        failedQuestionAttempt = nil
                        questionErrorMessage = nil
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: CodeScreenMetrics.screenHeaderActionPointSize, weight: .semibold))
                            .frame(width: CodeScreenMetrics.screenHeaderActionSlotSize, height: CodeScreenMetrics.screenHeaderActionSlotSize)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Research history")
                }

                if library.signedInAccount != nil, library.hasResearchAccess {
                    Button {
                        Task { await createConversation(selections: []) }
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: CodeScreenMetrics.screenHeaderActionPointSize, weight: .semibold))
                            .frame(width: CodeScreenMetrics.screenHeaderActionSlotSize, height: CodeScreenMetrics.screenHeaderActionSlotSize)
                    }
                    .buttonStyle(.plain)
                    .disabled(isCreatingConversation)
                    .accessibilityLabel("New Research")
                }
            }
            .foregroundStyle(Color.appChrome)
        }
        .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
        .padding(.top, 8)
        .padding(.bottom, CodeScreenMetrics.contentSpacingBelowTitle)
    }

    private var historyView: some View {
        List {
            if let errorMessage {
                statusMessage(errorMessage)
                    .listRowBackground(Color.clear)
            }

            if summaries.isEmpty && !isLoading {
                ContentUnavailableView(
                    "No Research yet",
                    image: "Astroid",
                    description: Text("Tap the sparkle icon to start Research.")
                )
                .padding(.top, 70)
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }

            ForEach(summaries) { item in
                Button {
                    library.activeResearchConversationID = item.id
                } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(researchTitle(for: item))
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.leading)
                            .lineLimit(3)
                        HStack(spacing: 8) {
                            Text(projectName(for: item.primaryProjectID))
                                .font(.caption.weight(.medium))
                                .foregroundStyle(.secondary)
                            Spacer()
                            Label("\(item.sourceCount)", systemImage: "text.quote")
                            Label("\(item.messageCount)", systemImage: "bubble.left")
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 7)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                .disabled(deletingConversationID == item.id)
                .listRowInsets(EdgeInsets(top: 8, leading: 18, bottom: 8, trailing: 18))
                .listRowBackground(Color.clear)
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button(role: .destructive) {
                        requestDeletion(id: item.id, title: researchTitle(for: item))
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .refreshable { await loadHistory(forceNetwork: true) }
    }

    private func conversationView(_ conversation: ResearchConversation) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Menu {
                    Button("Unassigned") { requestAssignment(nil) }
                    ForEach(library.folders.filter { $0.folderType == .project }) { folder in
                        if let projectID = library.backendProjectID(for: folder.id) {
                            Button(folder.name) { requestAssignment(projectID) }
                        }
                    }
                } label: {
                    Label("Project context: \(projectName(for: conversation.primaryProjectID))", systemImage: "folder")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 11)
                        .padding(.vertical, 7)
                        .background(.thinMaterial, in: Capsule())
                }
                .accessibilityIdentifier("research-project-context-menu")
                Spacer()
                Menu {
                    Button("Rename", systemImage: "pencil") {
                        draftTitle = conversation.title
                        showingRename = true
                    }
                    Button("Delete", systemImage: "trash", role: .destructive) {
                        requestDeletion(id: conversation.id, title: conversation.title)
                    }
                    .disabled(deletingConversationID != nil)
                } label: {
                    Image(systemName: "ellipsis")
                        .frame(width: 32, height: 32)
                }
                .accessibilityLabel("Research actions")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)

            Divider()

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 16) {
                        if let errorMessage { statusMessage(errorMessage) }
                        if conversation.sourceStatus == "changed" {
                            changedSourceWarning(conversation)
                        }
                        if conversation.projectContextReviewRequired {
                            projectContextWarning(conversation)
                        }
                        if !conversation.sources.isEmpty {
                            evidenceSummary(conversation.sources)
                        }
                        ForEach(conversation.messages) { message in
                            messageView(message, sources: conversation.sources)
                                .id(message.id)
                        }
                        if let pendingQuestionAttempt {
                            pendingQuestionView(pendingQuestionAttempt)
                                .id("pending:\(pendingQuestionAttempt.id)")
                        } else if let failedQuestionAttempt {
                            failedQuestionView(failedQuestionAttempt)
                                .id("failed:\(failedQuestionAttempt.id)")
                            if let questionErrorMessage {
                                statusMessage(questionErrorMessage)
                                    .id("failed-message:\(failedQuestionAttempt.id)")
                            }
                        }
                        if conversation.messages.isEmpty,
                           pendingQuestionAttempt == nil,
                           failedQuestionAttempt == nil {
                            Text("Ask Terra a question about the selected enacted text or the current Project.")
                                .font(.body)
                                .foregroundStyle(.secondary)
                                .padding(.top, 36)
                                .frame(maxWidth: .infinity, alignment: .center)
                        }
                    }
                    .padding(16)
                }
                .onChange(of: conversation.messages.count) { _, _ in
                    if let id = conversation.messages.last?.id {
                        withAnimation { proxy.scrollTo(id, anchor: .bottom) }
                    }
                }
            }

            Divider()
            researchComposer
        }
    }

    private var researchComposer: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let composerBlockMessage {
                Text(composerBlockMessage)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            HStack(alignment: .bottom, spacing: 10) {
                TextField("Ask Terra…", text: $question, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...6)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 11)
                    .background(Color.secondary.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
                    .disabled(isSending || researchSendIsBlocked)
                    .accessibilityIdentifier("research-composer")
                Button {
                    Task { await sendQuestion() }
                } label: {
                    if isSending {
                        ProgressView()
                            .frame(width: 38, height: 38)
                    } else {
                        Image(systemName: "arrow.up")
                            .font(.body.weight(.bold))
                            .frame(width: 38, height: 38)
                            .foregroundStyle(.white)
                            .background(Color.appChrome, in: Circle())
                    }
                }
                .disabled(
                    question.trimmingCharacters(in: .whitespacesAndNewlines).count < 3 ||
                    isSending ||
                    researchSendIsBlocked
                )
                .accessibilityLabel("Send Research question")
            }
        }
        .padding(12)
    }

    private var researchSendIsBlocked: Bool {
        conversation?.sourceStatus == "changed" ||
            conversation?.projectContextReviewRequired == true
    }

    private var composerBlockMessage: String? {
        if conversation?.sourceStatus == "changed" {
            return "Refresh the changed enacted sources before asking another question."
        }
        if conversation?.projectContextReviewRequired == true {
            return "Review the active Project above before asking another question."
        }
        return nil
    }

    private func changedSourceWarning(_ conversation: ResearchConversation) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Enacted source changed", systemImage: "exclamationmark.triangle.fill")
                .font(.subheadline.weight(.semibold))
            Text("Refresh the source metadata before continuing. If the selected words changed or disappeared, start a new selection from the current Reader.")
                .font(.caption)
                .foregroundStyle(.secondary)
            Button(isRefreshingSources ? "Refreshing…" : "Refresh Sources", systemImage: "arrow.clockwise") {
                Task { await refreshChangedSources(conversation) }
            }
            .disabled(isRefreshingSources)
            .accessibilityIdentifier("research-refresh-sources")
        }
        .padding(12)
        .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
    }

    private func projectContextWarning(_ conversation: ResearchConversation) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Project review required", systemImage: "folder.badge.questionmark")
                .font(.subheadline.weight(.semibold))
            Text("Choose a different Project above, choose Unassigned, or confirm that the current Project and its facts are correct. Existing answers and citations will not change.")
                .font(.caption)
                .foregroundStyle(.secondary)
            if conversation.primaryProjectID != nil {
                Button(isConfirmingProjectContext ? "Confirming…" : "Confirm Current Project") {
                    Task { await confirmCurrentProjectContext(conversation) }
                }
                .disabled(isConfirmingProjectContext)
                .accessibilityIdentifier("research-confirm-project")
            }
        }
        .padding(12)
        .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
    }

    private func confirmCurrentProjectContext(_ current: ResearchConversation) async {
        guard !isConfirmingProjectContext,
              let projectID = current.primaryProjectID
        else { return }
        isConfirmingProjectContext = true
        defer { isConfirmingProjectContext = false }
        do {
            let updated = try await library.reviewResearchProjectContext(
                conversationID: current.id,
                projectID: projectID,
                facts: current.projectContext?.facts ?? []
            )
            guard conversation?.id == current.id else { return }
            conversation = updated
            cacheConversation(updated)
            await loadHistory(forceNetwork: true)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func refreshChangedSources(_ current: ResearchConversation) async {
        guard !isRefreshingSources else { return }
        isRefreshingSources = true
        defer { isRefreshingSources = false }
        do {
            let updated = try await library.refreshResearchConversation(id: current.id)
            guard conversation?.id == current.id else { return }
            conversation = updated
            cacheConversation(updated)
            await loadHistory(forceNetwork: true)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func openCitation(_ citation: ResearchCitation, sources: [ResearchSource]) {
        let citedSourceIDs = Set(([citation.sourceID].compactMap { $0 }) + (citation.sourceIDs ?? []))
        let matchedSource = sources.first { source in
            citedSourceIDs.contains(source.id) || source.sectionID == citation.sectionID
        }
        let resolvedSectionID = [citation.sectionID, matchedSource?.sectionID]
            .compactMap { $0 }
            .compactMap(Int64.init)
            .first
        if let resolvedSectionID {
            library.openResearchCitation(
                sectionID: resolvedSectionID,
                codeVersion: citation.codeVersion
            )
            return
        }
        let sectionNumber = citation.sectionNumber ?? matchedSource?.sectionNumber
        if let sectionNumber,
           let summary = library.sectionSummary(sectionNumber: sectionNumber) {
            library.openResearchCitation(
                sectionID: summary.id,
                codeVersion: citation.codeVersion
            )
            return
        }
        errorMessage = "The cited provision is not available in the installed code library."
    }

    private func evidenceSummary(_ sources: [ResearchSource]) -> some View {
        DisclosureGroup {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(sources.filter { $0.kind == "selection" }) { source in
                    VStack(alignment: .leading, spacing: 4) {
                        Text([source.codePrefix, source.sectionNumber.map { "§ \($0)" }].compactMap { $0 }.joined(separator: " "))
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Color.appChrome)
                        if let selectedText = source.selectedText {
                            Text(selectedText)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(5)
                        }
                    }
                }
            }
            .padding(.top, 8)
        } label: {
            Label("\(sources.filter { $0.kind == "selection" }.count) selected passage\(sources.filter { $0.kind == "selection" }.count == 1 ? "" : "s")", systemImage: "text.quote")
                .font(.subheadline.weight(.semibold))
        }
        .padding(12)
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
        .accessibilityIdentifier("research-selected-evidence")
    }

    @ViewBuilder
    private func messageView(_ message: ResearchMessage, sources: [ResearchSource]) -> some View {
        if message.role == "user", let question = message.question {
            Text(question)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .foregroundStyle(.primary)
                .background(Color.secondary.opacity(0.14), in: RoundedRectangle(cornerRadius: 16))
                .frame(maxWidth: .infinity, alignment: .trailing)
        } else if let answer = message.answer {
            ResearchAnswerView(answer: answer) { citation in
                openCitation(citation, sources: sources)
            }
        }
    }

    private func pendingQuestionView(_ attempt: ResearchQuestionAttempt) -> some View {
        VStack(alignment: .trailing, spacing: 8) {
            Text(attempt.question)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .foregroundStyle(.primary)
                .background(Color.secondary.opacity(0.14), in: RoundedRectangle(cornerRadius: 16))
            HStack(spacing: 7) {
                ProgressView()
                    .controlSize(.small)
                Text("Terra is researching…")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
    }

    private func failedQuestionView(_ attempt: ResearchQuestionAttempt) -> some View {
        VStack(alignment: .trailing, spacing: 8) {
            Text(attempt.question)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .foregroundStyle(.primary)
                .background(Color.secondary.opacity(0.14), in: RoundedRectangle(cornerRadius: 16))
            Button("Try again", systemImage: "arrow.clockwise") {
                Task { await sendQuestion(attempt) }
            }
            .font(.caption.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
    }

    private func statusMessage(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .foregroundStyle(.secondary)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }

    private func projectName(for projectID: String?) -> String {
        guard let projectID else { return "Unassigned" }
        return library.folder(forBackendProjectID: projectID)?.name ?? "Project"
    }

    private func researchTitle(for summary: ResearchConversationSummary) -> String {
        let title = summary.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !title.isEmpty { return title }
        let starterQuestion = summary.starterQuestion?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if let starterQuestion, !starterQuestion.isEmpty { return starterQuestion }
        return "New Research"
    }

    private func requestDeletion(id: String, title: String) {
        guard deletingConversationID == nil else { return }
        let normalizedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let displayTitle = normalizedTitle.isEmpty ? "Untitled Research" : normalizedTitle
        let confirmationTitle = displayTitle.count > 80
            ? "\(displayTitle.prefix(79))…"
            : displayTitle
        pendingDeletion = PendingResearchDeletion(
            id: id,
            title: confirmationTitle
        )
    }

    private func loadHistory(forceNetwork: Bool = false) async {
        guard let account = library.signedInAccount else {
            summaries = []
            return
        }
        isLoading = true
        defer { isLoading = false }
        if !forceNetwork,
           let cached = try? cache.load(
                [ResearchConversationSummary].self,
                accountID: account.appUserID,
                projectID: "all-research",
                scope: "research-history"
           ) {
            summaries = cached.value
        }
        do {
            let loaded = try await library.researchConversations()
            summaries = loaded
            cacheHistory(loaded, accountID: account.appUserID)
            errorMessage = nil
        } catch {
            if summaries.isEmpty { errorMessage = error.localizedDescription }
        }
    }

    private func refreshFromWeb() async {
        await loadHistory(forceNetwork: true)
        guard let id = library.activeResearchConversationID,
              let account = library.signedInAccount else { return }
        do {
            let loaded = try await library.researchConversation(id: id)
            guard library.signedInAccount?.appUserID == account.appUserID,
                  library.activeResearchConversationID == id else { return }
            conversation = loaded
            cacheConversation(loaded)
            errorMessage = nil
        } catch {
            if conversation?.id == id { errorMessage = error.localizedDescription }
        }
    }

    private func openActiveConversationIfNeeded() async {
        guard let id = library.activeResearchConversationID,
              conversation?.id != id,
              let account = library.signedInAccount else { return }
        failedQuestionAttempt = nil
        questionErrorMessage = nil
        isLoading = true
        if let cached = try? cache.load(
            ResearchConversation.self,
            accountID: account.appUserID,
            projectID: id,
            scope: "research-conversation"
        ) {
            conversation = cached.value
        }
        do {
            let loaded = try await library.researchConversation(id: id)
            conversation = loaded
            cacheConversation(loaded)
            errorMessage = nil
        } catch {
            if conversation?.id != id { errorMessage = error.localizedDescription }
        }
        isLoading = false
    }

    private func consumePendingSelectionIfNeeded() async {
        guard library.signedInAccount != nil,
              library.hasResearchAccess,
              !isConsumingPendingSelection,
              pendingVisualReview == nil
        else { return }
        isConsumingPendingSelection = true
        defer { isConsumingPendingSelection = false }

        while !library.pendingResearchSelections.isEmpty {
            if isCreatingConversation {
                try? await Task.sleep(for: .milliseconds(150))
                continue
            }
            let originalSelection = library.pendingResearchSelections[0]
            do {
                let review = try await library.reviewResearchSelection(originalSelection)
                var reviewedSelection = review.selection
                reviewedSelection.savedItemID = originalSelection.savedItemID
                if review.requiresVisualReview {
                    pendingVisualReview = PendingResearchVisualReview(
                        originalSelection: originalSelection,
                        review: review
                    )
                    return
                }
                guard await persistResearchSelections([reviewedSelection]) else { return }
                library.acknowledgePendingResearchSelections([originalSelection])
            } catch {
                errorMessage = error.localizedDescription
                return
            }
        }
    }

    private func persistResearchSelections(_ selections: [ResearchSelectionRequest]) async -> Bool {
        if let id = library.activeResearchConversationID {
            do {
                let updated = try await library.addResearchEvidence(
                    conversationID: id,
                    selections: selections
                )
                conversation = updated
                cacheConversation(updated)
                await loadHistory(forceNetwork: true)
                errorMessage = nil
                return true
            } catch {
                errorMessage = error.localizedDescription
                return false
            }
        }
        return await createConversation(selections: selections)
    }

    private func cancelVisualReview(_ pending: PendingResearchVisualReview) {
        guard pendingVisualReview?.id == pending.id else { return }
        pendingVisualReview = nil
        library.acknowledgePendingResearchSelections([pending.originalSelection])
        errorMessage = "The passage was not added because its official visual evidence was not selected."
        Task { await consumePendingSelectionIfNeeded() }
    }

    private func confirmVisualReview(
        _ pending: PendingResearchVisualReview,
        sourceIDs: [String]
    ) async {
        guard pendingVisualReview?.id == pending.id, !sourceIDs.isEmpty else { return }
        var selection = pending.review.selection
        selection.savedItemID = pending.originalSelection.savedItemID
        selection.visualSourceIDs = sourceIDs
        selection.visualReviewConfirmed = true
        guard await persistResearchSelections([selection]) else {
            pendingVisualReview = nil
            return
        }
        library.acknowledgePendingResearchSelections([pending.originalSelection])
        pendingVisualReview = nil
        await consumePendingSelectionIfNeeded()
    }

    @discardableResult
    private func createConversation(selections: [ResearchSelectionRequest]) async -> Bool {
        guard !isCreatingConversation else { return false }
        isCreatingConversation = true
        defer { isCreatingConversation = false }
        do {
            let created = try await library.createResearchConversation(
                selections: selections,
                projectID: library.activeBackendProjectID
            )
            conversation = created
            library.activeResearchConversationID = created.id
            failedQuestionAttempt = nil
            questionErrorMessage = nil
            cacheConversation(created)
            await loadHistory(forceNetwork: true)
            errorMessage = nil
            if selections.isEmpty, !library.pendingResearchSelections.isEmpty {
                Task {
                    try? await Task.sleep(for: .milliseconds(250))
                    await consumePendingSelectionIfNeeded()
                }
            }
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func sendQuestion() async {
        let normalized = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalized.count >= 3 else { return }
        question = ""
        await sendQuestion(ResearchQuestionAttempt(id: UUID().uuidString, question: normalized))
    }

    private func sendQuestion(_ attempt: ResearchQuestionAttempt) async {
        guard let id = conversation?.id, !isSending, !researchSendIsBlocked else { return }
        let messageIDsBeforeRequest = Set(conversation?.messages.map(\.id) ?? [])
        isSending = true
        pendingQuestionAttempt = attempt
        failedQuestionAttempt = nil
        errorMessage = nil
        questionErrorMessage = nil
        defer {
            pendingQuestionAttempt = nil
            isSending = false
        }
        do {
            let updated = try await library.sendResearchMessage(
                conversationID: id,
                question: attempt.question,
                requestID: attempt.id
            )
            conversation = updated
            cacheConversation(updated)
            await loadHistory(forceNetwork: true)
            errorMessage = nil
            questionErrorMessage = nil
        } catch {
            // A network timeout can arrive after Terra has completed on the
            // server. Reconcile before offering a retry; the same request ID
            // makes a retry idempotent if the first response was merely lost.
            if let authoritative = await completedConversationAfterLostResponse(
                conversationID: id,
                attempt: attempt,
                priorMessageIDs: messageIDsBeforeRequest
            ) {
                conversation = authoritative
                cacheConversation(authoritative)
                await loadHistory(forceNetwork: true)
                errorMessage = nil
                questionErrorMessage = nil
            } else {
                failedQuestionAttempt = attempt
                questionErrorMessage = ResearchRequestFailurePresentation.resolve(error).message
            }
        }
    }

    private func completedConversationAfterLostResponse(
        conversationID: String,
        attempt: ResearchQuestionAttempt,
        priorMessageIDs: Set<String>
    ) async -> ResearchConversation? {
        for delay in [0, 2, 4, 6] {
            if delay > 0 {
                try? await Task.sleep(for: .seconds(delay))
            }
            guard let authoritative = try? await library.researchConversation(id: conversationID) else {
                continue
            }
            if ResearchRequestReconciliation.matchesCompletedAttempt(
                messages: authoritative.messages,
                requestID: attempt.id,
                question: attempt.question,
                priorMessageIDs: priorMessageIDs
            ) {
                return authoritative
            }
        }
        return nil
    }

    private func renameConversation() async {
        guard let id = conversation?.id else { return }
        do {
            let updated = try await library.renameResearchConversation(id: id, title: draftTitle)
            conversation = updated
            cacheConversation(updated)
            await loadHistory(forceNetwork: true)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func requestAssignment(_ projectID: String?) {
        guard projectID != conversation?.primaryProjectID else { return }
        if conversation?.primaryProjectID != nil {
            pendingAssignmentProjectID = projectID
            showingAssignmentConfirmation = true
        } else {
            Task { await assignConversation(projectID: projectID, confirmed: false) }
        }
    }

    private func assignConversation(projectID: String?, confirmed: Bool) async {
        guard let id = conversation?.id else { return }
        do {
            let updated = try await library.assignResearchConversation(
                id: id,
                projectID: projectID,
                confirmMove: confirmed
            )
            conversation = updated
            cacheConversation(updated)
            await loadHistory(forceNetwork: true)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func deleteConversation(id: String) async {
        guard deletingConversationID == nil else { return }
        deletingConversationID = id
        defer { deletingConversationID = nil }
        do {
            try await library.deleteResearchConversation(id: id)
            summaries.removeAll { $0.id == id }
            if let account = library.signedInAccount {
                cacheHistory(summaries, accountID: account.appUserID)
            }
            if library.activeResearchConversationID == id {
                library.activeResearchConversationID = nil
            }
            if conversation?.id == id {
                conversation = nil
                failedQuestionAttempt = nil
                questionErrorMessage = nil
            }
            await loadHistory(forceNetwork: true)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func cacheHistory(_ history: [ResearchConversationSummary], accountID: String) {
        try? cache.store(
            history,
            accountID: accountID,
            projectID: "all-research",
            scope: "research-history"
        )
    }

    private func cacheConversation(_ conversation: ResearchConversation) {
        guard let account = library.signedInAccount else { return }
        try? cache.store(
            conversation,
            accountID: account.appUserID,
            projectID: conversation.id,
            scope: "research-conversation"
        )
    }
}

private struct ResearchVisualReviewSheet: View {
    let review: ResearchSelectionReviewResponse
    let onCancel: () -> Void
    let onConfirm: ([String]) -> Void
    @State private var selectedSourceIDs: Set<String> = []

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 7) {
                        Text("Review official visual evidence")
                            .font(.title2.weight(.bold))
                        Text("This enacted section contains official visual material. Select only the images Terra should analyze with your passage.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text("Select up to \(review.maximumVisualSelections) official images.")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

                    ForEach(review.visualSources) { source in
                        visualSourceButton(source)
                    }

                    Text("Permitext will preserve the exact selected image bytes and their integrity identity with the Research record.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(18)
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    onConfirm(review.visualSources.compactMap { source in
                        selectedSourceIDs.contains(source.id) ? source.id : nil
                    })
                } label: {
                    Text(confirmButtonTitle)
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .foregroundStyle(.white)
                        .background(Color.appChrome, in: RoundedRectangle(cornerRadius: 16))
                }
                .disabled(selectedSourceIDs.isEmpty)
                .opacity(selectedSourceIDs.isEmpty ? 0.45 : 1)
                .padding(16)
                .background(.regularMaterial)
            }
            .navigationTitle("Visual Evidence")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
            }
            .interactiveDismissDisabled()
        }
    }

    private var confirmButtonTitle: String {
        let count = selectedSourceIDs.count
        guard count > 0 else { return "Select an image" }
        return "Attach \(count) image\(count == 1 ? "" : "s") and add to Research"
    }

    private func visualSourceButton(_ source: ResearchVisualSource) -> some View {
        let selected = selectedSourceIDs.contains(source.id)
        let selectionLimitReached = selectedSourceIDs.count >= review.maximumVisualSelections
        return Button {
            if selected {
                selectedSourceIDs.remove(source.id)
            } else if !selectionLimitReached {
                selectedSourceIDs.insert(source.id)
            }
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                AsyncImage(url: source.resolvedAssetURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFit()
                    case .failure:
                        ContentUnavailableView(
                            "Preview unavailable",
                            systemImage: "photo",
                            description: Text("The official image can still be selected by its verified identity.")
                        )
                    case .empty:
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 140)
                    @unknown default:
                        EmptyView()
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 120, maxHeight: 300)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))

                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                        .font(.title3)
                        .foregroundStyle(selected ? Color.appChrome : Color.secondary)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(source.assetName)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.primary)
                        Text("\(formattedByteLength(source.byteLength)) · integrity \(source.contentHash.prefix(12))")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(12)
            .background(
                selected ? Color.appChrome.opacity(0.14) : Color.secondary.opacity(0.08),
                in: RoundedRectangle(cornerRadius: 16)
            )
        }
        .buttonStyle(.plain)
        .disabled(!selected && selectionLimitReached)
        .accessibilityLabel("\(selected ? "Deselect" : "Select") official image \(source.assetName)")
    }

    private func formattedByteLength(_ bytes: Int) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }
}

private struct ResearchAnswerView: View {
    let answer: ResearchAnswer
    let onOpenCitation: (ResearchCitation) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(answer.conclusion)
                .font(.body.weight(.semibold))
                .textSelection(.enabled)
            if !answer.explanation.isEmpty {
                Text(answer.explanation)
                    .font(.body)
                    .textSelection(.enabled)
            }
            if !answer.citations.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(answer.citations) { citation in
                            Button {
                                onOpenCitation(citation)
                            } label: {
                                Text(citationLabel(citation))
                                    .font(.caption.weight(.semibold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(Color.appChrome.opacity(0.14), in: Capsule())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Open \(citationAccessibilityLabel(citation)) in Reader")
                            .accessibilityIdentifier(citationAccessibilityIdentifier(citation))
                        }
                    }
                }
            }
            if hasEvidenceDetails {
                DisclosureGroup("Evidence reviewed") {
                    VStack(alignment: .leading, spacing: 14) {
                        supportedPointsSection(answer.supportedPoints)
                        answerSection("Assumptions used", items: answer.assumptions)
                        answerSection("Project facts to verify", items: answer.missingFacts)
                        answerSection("Limits of this answer", items: answer.evidenceLimitations)
                        answerSection("Questions that would materially advance this answer", items: answer.followUpQuestions)
                        answerSection("Related evidence to add", items: answer.additionalEvidenceNeeded)
                        if !answer.citations.isEmpty {
                            VStack(alignment: .leading, spacing: 7) {
                                Text("Cited sources")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(.primary)
                                ForEach(answer.citations) { citation in
                                    Button {
                                        onOpenCitation(citation)
                                    } label: {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(citationAccessibilityLabel(citation))
                                            if let relevance = citation.relevance, !relevance.isEmpty {
                                                Text(relevance)
                                                    .foregroundStyle(.secondary)
                                            }
                                        }
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 8)
                }
                .font(.subheadline.weight(.semibold))
            }
            Text(answer.disclaimer ?? "AI-generated research assistance, not an official code determination.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .topLeading) {
            Color.clear
                .frame(width: 1, height: 1)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Research answer ready")
                .accessibilityIdentifier("research-answer")
                .allowsHitTesting(false)
        }
    }

    private var hasEvidenceDetails: Bool {
        !answer.supportedPoints.isEmpty ||
            !answer.assumptions.isEmpty ||
            !answer.missingFacts.isEmpty ||
            !answer.evidenceLimitations.isEmpty ||
            !answer.followUpQuestions.isEmpty ||
            !answer.additionalEvidenceNeeded.isEmpty ||
            !answer.citations.isEmpty
    }

    @ViewBuilder
    private func supportedPointsSection(_ points: [ResearchSupportedPoint]) -> some View {
        if !points.isEmpty {
            VStack(alignment: .leading, spacing: 5) {
                Text("What the cited evidence establishes")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.primary)
                ForEach(points, id: \.self) { point in
                    Text(
                        "\u{2022} " + [evidenceRoleLabel(point.evidenceRole), point.heading, point.explanation]
                            .compactMap { $0 }
                            .filter { !$0.isEmpty }
                            .joined(separator: " \u{2014} ")
                    )
                    .accessibilityIdentifier(supportedPointAccessibilityIdentifier(point.evidenceRole))
                }
            }
        }
    }

    @ViewBuilder
    private func answerSection(_ title: String, items: [String]) -> some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.primary)
                ForEach(items, id: \.self) { item in
                    Text("• \(item)")
                }
            }
        }
    }

    private func citationLabel(_ citation: ResearchCitation) -> String {
        [
            evidenceRoleLabel(citation.evidenceRole),
            citation.codePrefix,
            citation.sectionNumber.map { "§ \($0)" } ?? citation.title
        ]
        .compactMap { $0 }
        .filter { !$0.isEmpty }
        .joined(separator: " ")
    }

    private func citationAccessibilityLabel(_ citation: ResearchCitation) -> String {
        [citationLabel(citation), citation.title, citation.corpusLabel, citation.codeEdition]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }

    private func citationAccessibilityIdentifier(_ citation: ResearchCitation) -> String {
        let identity = citation.sectionID ?? citation.sourceID ?? citation.id
        let safeIdentity = identity.map { character in
            character.isLetter || character.isNumber ? character : "-"
        }
        return "research-citation-\(String(safeIdentity))"
    }

    private func evidenceRoleLabel(_ role: String?) -> String {
        switch role?.lowercased() {
        case "contextual": return "Context"
        case "supporting": return "Supporting"
        default: return "Governing"
        }
    }

    private func supportedPointAccessibilityIdentifier(_ role: String?) -> String {
        switch role?.lowercased() {
        case "contextual": return "research-supported-point-contextual"
        case "supporting": return "research-supported-point-supporting"
        default: return "research-supported-point-governing"
        }
    }
}

#if DEBUG
#Preview {
    ResearchView()
        .environmentObject(CodeLibraryViewModel())
}
#endif
