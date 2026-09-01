import StoreKit
import SwiftUI
import UIKit

enum ResearchDisclosureGate {
    static let currentVersion = 1
    private static let defaultsKeyPrefix = "permitext.research.disclosure.accepted-version"

    static func requiresAcknowledgement(completedVersion: Int) -> Bool {
        completedVersion < currentVersion
    }

    static func defaultsKey(accountID: String?) -> String {
        let normalized = accountID?.trimmingCharacters(in: .whitespacesAndNewlines)
        return "\(defaultsKeyPrefix).\(normalized?.isEmpty == false ? normalized! : "signed-out")"
    }

    static func completedVersion(
        accountID: String?,
        defaults: UserDefaults = .standard
    ) -> Int {
        defaults.integer(forKey: defaultsKey(accountID: accountID))
    }

    static func acknowledge(
        accountID: String?,
        defaults: UserDefaults = .standard
    ) {
        defaults.set(currentVersion, forKey: defaultsKey(accountID: accountID))
    }
}

struct ResearchQuestionAttempt: Identifiable, Equatable, Codable, Sendable {
    static let cacheScope = "research-pending-request"

    let id: String
    let question: String
}

enum ResearchTrustCopy {
    static let composerPrivacyDisclosure = "Research sends your question, recent chat, selected or retrieved evidence, and current Project facts when assigned to OpenAI. Private notes are not included. Do not include confidential, regulated, or sensitive personal information. Ordinary property information may be included when needed."
    static let firstUseDisclosure = "Permitext sends your question, recent chat, selected or retrieved evidence, and assigned Project facts to OpenAI. Private notes are not included."
    static let visualEvidenceDisclosure = "Selected official images are sent to OpenAI for analysis. Private notes are not included."
    static let copyAnswerAction = "Copy answer"
    static let reportProblemAction = "Report a problem"
}

enum ResearchConversationCacheLifecycle {
    static let conversationScope = "research-conversation"

    static func store<Value: Codable & Sendable>(
        _ value: Value,
        cache: ProjectHubOfflineCache,
        accountID: String,
        conversationID: String
    ) throws {
        try cache.store(
            value,
            accountID: accountID,
            projectID: conversationID,
            scope: conversationScope
        )
    }

    static func load<Value: Codable & Sendable>(
        _ type: Value.Type,
        cache: ProjectHubOfflineCache,
        accountID: String,
        conversationID: String
    ) throws -> ProjectHubOfflineCacheLoad<Value>? {
        try cache.load(
            type,
            accountID: accountID,
            projectID: conversationID,
            scope: conversationScope
        )
    }

    static func removeDeletedConversation(
        cache: ProjectHubOfflineCache,
        accountID: String,
        conversationID: String
    ) throws {
        try cache.remove(
            accountID: accountID,
            projectID: conversationID,
            scope: ResearchQuestionAttempt.cacheScope
        )
        try cache.remove(
            accountID: accountID,
            projectID: conversationID,
            scope: conversationScope
        )
    }
}

struct ResearchProjectContextDisclosure: Equatable {
    let isAssigned: Bool
    let facts: [String]

    var title: String {
        guard isAssigned else {
            return "Project facts: Unassigned — no Project facts will be included."
        }
        guard !facts.isEmpty else {
            return "Assigned Project has no saved facts."
        }
        return "Project context included: \(facts.count) \(facts.count == 1 ? "fact" : "facts")"
    }

    static func resolve(
        projectID: String?,
        projectInformation: ResearchProjectInformation?,
        additionalFacts: [String],
        localAddress: String = "",
        localDescription: String = "",
        localStructuredFacts: [ProjectStructuredFact] = []
    ) -> ResearchProjectContextDisclosure {
        guard projectID?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false else {
            return ResearchProjectContextDisclosure(isAssigned: false, facts: [])
        }
        let serverFacts = projectInformation?.facts ?? []
        let normalizedLocalAddress = localAddress.trimmingCharacters(in: .whitespacesAndNewlines)
        var derivedLocalFacts: [String] = []
        if !normalizedLocalAddress.isEmpty {
            derivedLocalFacts.append("Address: \(normalizedLocalAddress)")
        }
        derivedLocalFacts.append(contentsOf: localStructuredFacts.compactMap { fact -> String? in
            let status = fact.status.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard ["stated", "confirmed", "sourced"].contains(status),
                  fact.key != "floor-affected",
                  normalizedLocalAddress.isEmpty || fact.key != "address"
            else { return nil }
            let label = fact.label.trimmingCharacters(in: .whitespacesAndNewlines)
            let value = fact.value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !label.isEmpty, !value.isEmpty else { return nil }
            return "\(label): \(value)"
        })
        let normalizedLocalDescription = localDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        if !normalizedLocalDescription.isEmpty {
            derivedLocalFacts.append("Description: \(normalizedLocalDescription)")
        }
        let localFacts = serverFacts.isEmpty ? derivedLocalFacts : serverFacts
        var seen = Set<String>()
        let facts = (localFacts + additionalFacts).compactMap { value -> String? in
            let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !normalized.isEmpty, seen.insert(normalized).inserted else { return nil }
            return normalized
        }
        return ResearchProjectContextDisclosure(isAssigned: true, facts: facts)
    }
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

private struct PendingResearchFeedbackReport: Identifiable, Equatable {
    let id = UUID()
    let messageID: String
}

struct ResearchRequestReconciliation {
    static func containsCompletedRequest(
        messages: [ResearchMessage],
        requestID: String,
        question: String
    ) -> Bool {
        let matching = messages.filter { $0.requestID == requestID }
        return matching.contains {
            $0.role == "user" && $0.question == question
        } && matching.contains {
            $0.role == "assistant" && $0.answer != nil
        }
    }

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

struct ResearchAuthoritativeConversationRecovery {
    static func conversation(
        from error: Error,
        matching conversationID: String
    ) -> ResearchConversation? {
        guard let backendError = error as? PermitextBackendHTTPError,
              let conversation = backendError.authoritativeResearchConversation,
              conversation.id == conversationID
        else { return nil }
        return conversation
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
                    "Research is taking longer than expected. Permitext checked for a completed answer but did not find one yet."
                )
            case .notConnectedToInternet, .networkConnectionLost:
                return retainedQuestion("Research could not connect to the internet.")
            case .cancelled:
                return retainedQuestion("Research was cancelled.")
            default:
                return retainedQuestion("Permitext could not reach the Research service.")
            }
        }

        return retainedQuestion("Permitext could not reach the Research service.")
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
            "RESEARCH_VERIFICATION_FAILED"
        ]
        let providerCodes: Set<String> = [
            "RESEARCH_NOT_CONFIGURED",
            "RESEARCH_PROVIDER_ERROR",
            "RESEARCH_VERIFIER_ERROR",
            "RESEARCH_EVAL_SPEND_CAP",
            "TIMEOUTERROR"
        ]

        switch code {
        case "RESEARCH_OFFICIAL_GUIDANCE_UNAVAILABLE":
            return retainedQuestion(
                "Permitext could not retrieve attributable official guidance from the approved sources."
            )
        case "RESEARCH_EVIDENCE_NOT_FOUND":
            return retainedQuestion(
                serverMessage ?? "Permitext could not locate enacted text in the current authorized corpus for this question. Try a more specific code topic or citation."
            )
        case "RESEARCH_EVIDENCE_REQUIRED", "RESEARCH_SOURCE_CHANGED", "RESEARCH_REFUSAL":
            return retainedQuestion(serverMessage ?? "Research needs updated enacted evidence before it can answer.")
        case "RESEARCH_CAPACITY_REVIEW":
            return retainedQuestion(serverMessage ?? "Research is temporarily unavailable while account capacity is reviewed.")
        case "RESEARCH_TURNS_REQUIRED":
            return ResearchRequestFailurePresentation(
                message: "You have used this month's included Research turns. Buy more turns to continue; your question is still here."
            )
        case "RESEARCH_CANCELLED":
            return retainedQuestion("Research was cancelled.")
        case let value? where verificationCodes.contains(value):
            return retainedQuestion(
                "A Research model produced a response, but Permitext could not verify it against the enacted evidence."
            )
        case let value? where providerCodes.contains(value):
            return retainedQuestion("Permitext's Research service is temporarily unavailable.")
        default:
            break
        }

        if error.isAuthenticationFailure {
            return retainedQuestion("Your Permitext session no longer has access to Research. Sign in again and retry.")
        }

        if error.statusCode == 502,
           serverMessage?.localizedCaseInsensitiveContains("verified") == true {
            return retainedQuestion(
                "A Research model produced a response, but Permitext could not verify it against the enacted evidence."
            )
        }

        if let statusCode = error.statusCode, statusCode >= 500 {
            return retainedQuestion("Permitext's Research service is temporarily unavailable.")
        }

        if let serverMessage, !serverMessage.isEmpty {
            return retainedQuestion(serverMessage)
        }

        return retainedQuestion("Permitext could not reach the Research service.")
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
    @Environment(\.purchase) private var purchase
    @Environment(\.scenePhase) private var scenePhase
    @State private var summaries: [ResearchConversationSummary] = []
    @State private var conversation: ResearchConversation?
    @State private var question = ""
    @State private var isLoading = false
    @State private var isCreatingConversation = false
    @State private var isConsumingPendingSelection = false
    @State private var isSending = false
    @State private var activeResearchRequestTask: Task<Void, Never>?
    @State private var pendingQuestionAttempt: ResearchQuestionAttempt?
    @State private var pendingDisclosureAttempt: ResearchQuestionAttempt?
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
    @State private var pendingFeedbackReport: PendingResearchFeedbackReport?
    @State private var feedbackMessageID: String?
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
                            title: "Research requires Pro",
                            description: pendingSelectionRecoveryDescription(
                                fallback: "Upgrade to Pro from Settings. Code reading and search remain free."
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
            .sheet(item: $pendingDisclosureAttempt) { attempt in
                ResearchDisclosureAcknowledgementSheet(
                    onCancel: { pendingDisclosureAttempt = nil },
                    onContinue: {
                        ResearchDisclosureGate.acknowledge(
                            accountID: library.signedInAccount?.appUserID
                        )
                        pendingDisclosureAttempt = nil
                        question = ""
                        startQuestionRequest(attempt)
                    }
                )
            }
            .sheet(item: $pendingFeedbackReport) { report in
                ResearchFeedbackSheet(
                    onCancel: { pendingFeedbackReport = nil },
                    onSubmit: { category, comment in
                        pendingFeedbackReport = nil
                        Task { await saveFeedback(messageID: report.messageID, category: category, comment: comment) }
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
                Text("Permitext Research will use the destination Project’s current facts for future answers. Existing answers keep their original evidence and context.")
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
                await library.refreshResearchTurnAllowance(
                    recoverUnfinishedPurchases: true,
                    showsErrors: false
                )
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
            Text("AI-assisted—not an official interpretation.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .accessibilityIdentifier("research-access-trust-boundary")
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
                        if conversation.sources.contains(where: { $0.kind == "selection" }) {
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
                            if library.researchTurnAllowance?.purchaseRequired == true {
                                researchTurnRecoveryView
                                    .id("research-turn-recovery:\(failedQuestionAttempt.id)")
                            }
                        }
                        if conversation.messages.isEmpty,
                           pendingQuestionAttempt == nil,
                           failedQuestionAttempt == nil {
                            Text("Ask a question about the selected enacted text or the current Project.")
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
            if library.researchTurnAllowance?.paidContinuationEnabled == true {
                Text(library.researchTurnAllowanceSummary)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .accessibilityLabel("Research turns: \(library.researchTurnAllowanceSummary)")
            }
            Text("AI-assisted—not an official interpretation.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .accessibilityIdentifier("research-composer-trust-boundary")
            HStack(spacing: 3) {
                Text(ResearchTrustCopy.composerPrivacyDisclosure)
                Link("Privacy", destination: URL(string: "https://permitext.com/privacy")!)
            }
            .font(.caption2)
            .foregroundStyle(.secondary)
            .accessibilityIdentifier("research-composer-privacy-disclosure")
            projectFactsReview
            if let composerBlockMessage {
                Text(composerBlockMessage)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            HStack(alignment: .bottom, spacing: 10) {
                TextField("Ask a Research question…", text: $question, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...6)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 11)
                    .background(Color.secondary.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
                    .disabled(isSending || researchSendIsBlocked)
                    .accessibilityIdentifier("research-composer")
                if isSending {
                    Button("Cancel", systemImage: "xmark") {
                        cancelActiveResearchRequest()
                    }
                    .font(.caption.weight(.semibold))
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("research-cancel-request")
                } else {
                    Button {
                        startQuestionRequest()
                    } label: {
                        Image(systemName: "arrow.up")
                            .font(.body.weight(.bold))
                            .frame(width: 38, height: 38)
                            .foregroundStyle(.white)
                            .background(Color.appChrome, in: Circle())
                    }
                    .disabled(
                        question.trimmingCharacters(in: .whitespacesAndNewlines).count < 3 ||
                        researchSendIsBlocked
                    )
                    .accessibilityLabel("Send Research question")
                }
            }
        }
        .padding(12)
    }

    @ViewBuilder
    private var projectFactsReview: some View {
        let localProject = library.folder(forBackendProjectID: conversation?.primaryProjectID)
        let disclosure = ResearchProjectContextDisclosure.resolve(
            projectID: conversation?.primaryProjectID,
            projectInformation: conversation?.projectInformation,
            additionalFacts: conversation?.projectContext?.facts ?? [],
            localAddress: localProject?.address ?? "",
            localDescription: localProject?.description ?? "",
            localStructuredFacts: localProject?.structuredFacts ?? []
        )
        if !disclosure.isAssigned {
            Label(disclosure.title, systemImage: "folder.badge.questionmark")
                .font(.caption)
                .foregroundStyle(.secondary)
                .accessibilityIdentifier("research-composer-project-facts")
        } else {
            DisclosureGroup(disclosure.title) {
                VStack(alignment: .leading, spacing: 5) {
                    ForEach(disclosure.facts, id: \.self) { fact in
                        Text("• \(fact)")
                    }
                    Text(
                        disclosure.facts.isEmpty
                            ? "No saved Project facts will be sent. Private notes are not included."
                            : "Project facts provide context; they are not code authority."
                    )
                        .fontWeight(.semibold)
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
                .padding(.top, 5)
            }
            .font(.caption)
            .accessibilityIdentifier("research-composer-project-facts")
        }
    }

    private var researchSendIsBlocked: Bool {
        library.researchTurnAllowance?.purchaseRequired == true ||
            conversation?.sourceStatus == "changed" ||
            conversation?.projectContextReviewRequired == true
    }

    private var composerBlockMessage: String? {
        if library.researchTurnAllowance?.purchaseRequired == true {
            return "Buy additional Research turns above to continue."
        }
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
            ResearchAnswerView(
                answer: answer,
                sourceStatus: conversation?.sourceStatus ?? "current",
                feedback: message.feedback,
                isSavingFeedback: feedbackMessageID == message.id,
                onHelpful: { Task { await saveFeedback(messageID: message.id, category: "helpful", comment: nil) } },
                onReportProblem: { pendingFeedbackReport = PendingResearchFeedbackReport(messageID: message.id) }
            ) { citation in
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
                Text("Permitext is researching…")
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
            if library.researchTurnAllowance?.purchaseRequired != true {
                Button("Try again", systemImage: "arrow.clockwise") {
                    startQuestionRequest(attempt)
                }
                .font(.caption.weight(.semibold))
            }
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
    }

    private var researchTurnRecoveryView: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Research turns")
                .font(.subheadline.weight(.semibold))
            Text(library.researchTurnAllowanceSummary)
                .font(.headline)

            if library.availableResearchTurnPacks.isEmpty {
                Text("Additional Research turns are temporarily unavailable. Your question is still here. Try again later.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                Button("Check again", systemImage: "arrow.clockwise") {
                    Task {
                        await library.refreshResearchTurnAllowance(showsErrors: true)
                    }
                }
                .font(.caption.weight(.semibold))
                .buttonStyle(.plain)
            } else {
                Text("Need more Research? Additional turns do not expire and are used after the monthly included turns.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                ForEach(library.availableResearchTurnPacks) { pack in
                    Button {
                        Task { await library.purchaseResearchTurnPack(pack, using: purchase) }
                    } label: {
                        HStack {
                            Text("Buy \(pack.turns) more turns")
                            Spacer()
                            Text(library.researchTurnDisplayPrice(for: pack) ?? "")
                        }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .foregroundStyle(Color.black)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                        .background(Color.white.opacity(0.96), in: Capsule(style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(library.isResearchTurnPurchaseBusy)
                }
            }

            if library.isResearchTurnPurchaseBusy {
                ProgressView("Contacting Apple...")
                    .font(.caption)
            }
            if let message = library.researchTurnPurchaseMessage {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
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
        await library.refreshResearchTurnAllowance(showsErrors: false)
        await loadHistory(forceNetwork: true)
        guard let id = library.activeResearchConversationID,
              let account = library.signedInAccount else { return }
        do {
            let loaded = try await library.researchConversation(id: id)
            guard library.signedInAccount?.appUserID == account.appUserID,
                  library.activeResearchConversationID == id else { return }
            conversation = loaded
            cacheConversation(loaded)
            restoreCachedQuestionAttempt(for: loaded, accountID: account.appUserID)
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
        if let cached = try? ResearchConversationCacheLifecycle.load(
            ResearchConversation.self,
            cache: cache,
            accountID: account.appUserID,
            conversationID: id
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
        if let current = conversation, current.id == id {
            restoreCachedQuestionAttempt(for: current, accountID: account.appUserID)
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

    private func startQuestionRequest() {
        let normalized = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalized.count >= 3 else { return }
        let attempt = ResearchQuestionAttempt(id: UUID().uuidString, question: normalized)
        let completedDisclosureVersion = ResearchDisclosureGate.completedVersion(
            accountID: library.signedInAccount?.appUserID
        )
        if ResearchDisclosureGate.requiresAcknowledgement(completedVersion: completedDisclosureVersion) {
            pendingDisclosureAttempt = attempt
            return
        }
        question = ""
        startQuestionRequest(attempt)
    }

    private func saveFeedback(messageID: String, category: String, comment: String?) async {
        guard let conversationID = conversation?.id, feedbackMessageID == nil else { return }
        feedbackMessageID = messageID
        defer { feedbackMessageID = nil }
        do {
            let saved = try await library.saveResearchFeedback(
                conversationID: conversationID,
                answerID: messageID,
                category: category,
                comment: comment?.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            guard conversation?.id == conversationID,
                  let index = conversation?.messages.firstIndex(where: { $0.id == messageID })
            else { return }
            conversation?.messages[index].feedback = saved
            if let updated = conversation { cacheConversation(updated) }
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func startQuestionRequest(_ attempt: ResearchQuestionAttempt) {
        guard activeResearchRequestTask == nil else { return }
        activeResearchRequestTask = Task {
            await sendQuestion(attempt)
        }
    }

    private func cancelActiveResearchRequest() {
        activeResearchRequestTask?.cancel()
    }

    private func sendQuestion(_ attempt: ResearchQuestionAttempt) async {
        guard let id = conversation?.id, !isSending, !researchSendIsBlocked else {
            activeResearchRequestTask = nil
            return
        }
        let messageIDsBeforeRequest = Set(conversation?.messages.map(\.id) ?? [])
        cacheQuestionAttempt(attempt, conversationID: id)
        isSending = true
        pendingQuestionAttempt = attempt
        failedQuestionAttempt = nil
        errorMessage = nil
        questionErrorMessage = nil
        defer {
            if pendingQuestionAttempt?.id == attempt.id {
                pendingQuestionAttempt = nil
                isSending = false
                activeResearchRequestTask = nil
            }
        }
        do {
            let updated = try await library.sendResearchMessage(
                conversationID: id,
                question: attempt.question,
                requestID: attempt.id
            )
            try Task.checkCancellation()
            conversation = updated
            cacheConversation(updated)
            clearCachedQuestionAttempt(conversationID: id)
            await loadHistory(forceNetwork: true)
            errorMessage = nil
            questionErrorMessage = nil
        } catch {
            if Task.isCancelled || error is CancellationError || (error as? URLError)?.code == .cancelled {
                failedQuestionAttempt = attempt
                questionErrorMessage = ResearchRequestFailurePresentation.resolve(URLError(.cancelled)).message
                return
            }
            if let authoritative = ResearchAuthoritativeConversationRecovery.conversation(
                from: error,
                matching: id
            ) {
                conversation = authoritative
                cacheConversation(authoritative)
                await loadHistory(forceNetwork: true)
                if ResearchRequestReconciliation.containsCompletedRequest(
                    messages: authoritative.messages,
                    requestID: attempt.id,
                    question: attempt.question
                ) {
                    clearCachedQuestionAttempt(conversationID: id)
                    await library.refreshResearchTurnAllowance(showsErrors: false)
                    failedQuestionAttempt = nil
                    questionErrorMessage = nil
                } else {
                    failedQuestionAttempt = attempt
                    questionErrorMessage = ResearchRequestFailurePresentation.resolve(error).message
                }
                return
            }
            // A network timeout can arrive after Research has completed on the
            // server. Reconcile before offering a retry; the same request ID
            // makes a retry idempotent if the first response was merely lost.
            if let authoritative = await completedConversationAfterLostResponse(
                conversationID: id,
                attempt: attempt,
                priorMessageIDs: messageIDsBeforeRequest
            ) {
                conversation = authoritative
                cacheConversation(authoritative)
                clearCachedQuestionAttempt(conversationID: id)
                await loadHistory(forceNetwork: true)
                await library.refreshResearchTurnAllowance(showsErrors: false)
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
            guard !Task.isCancelled else { return nil }
            if delay > 0 {
                do {
                    try await Task.sleep(for: .seconds(delay))
                } catch is CancellationError {
                    return nil
                } catch {
                    return nil
                }
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
            if let account = library.signedInAccount {
                try? ResearchConversationCacheLifecycle.removeDeletedConversation(
                    cache: cache,
                    accountID: account.appUserID,
                    conversationID: id
                )
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
        try? ResearchConversationCacheLifecycle.store(
            conversation,
            cache: cache,
            accountID: account.appUserID,
            conversationID: conversation.id
        )
    }

    private func cacheQuestionAttempt(_ attempt: ResearchQuestionAttempt, conversationID: String) {
        guard let account = library.signedInAccount else { return }
        try? cache.store(
            attempt,
            accountID: account.appUserID,
            projectID: conversationID,
            scope: ResearchQuestionAttempt.cacheScope
        )
    }

    private func clearCachedQuestionAttempt(conversationID: String) {
        guard let account = library.signedInAccount else { return }
        try? cache.remove(
            accountID: account.appUserID,
            projectID: conversationID,
            scope: ResearchQuestionAttempt.cacheScope
        )
    }

    private func restoreCachedQuestionAttempt(
        for conversation: ResearchConversation,
        accountID: String
    ) {
        guard pendingQuestionAttempt == nil,
              let saved = try? cache.load(
                ResearchQuestionAttempt.self,
                accountID: accountID,
                projectID: conversation.id,
                scope: ResearchQuestionAttempt.cacheScope
              )
        else { return }
        let attempt = saved.value
        if ResearchRequestReconciliation.containsCompletedRequest(
            messages: conversation.messages,
            requestID: attempt.id,
            question: attempt.question
        ) {
            clearCachedQuestionAttempt(conversationID: conversation.id)
            if failedQuestionAttempt?.id == attempt.id {
                failedQuestionAttempt = nil
                questionErrorMessage = nil
            }
            return
        }
        failedQuestionAttempt = attempt
        questionErrorMessage = "Research was interrupted before an answer was saved. Retry to recover the same request. Your question is still here."
    }
}

private struct ResearchDisclosureAcknowledgementSheet: View {
    let onCancel: () -> Void
    let onContinue: () -> Void

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                Text("Before you use Research")
                    .font(.title2.weight(.bold))
                Label("What is sent", systemImage: "arrow.up.doc")
                    .font(.headline)
                Text(ResearchTrustCopy.firstUseDisclosure)
                    .foregroundStyle(.secondary)
                Label("How to rely on it", systemImage: "checkmark.shield")
                    .font(.headline)
                Text("Permitext is AI-assisted research, not an official interpretation or professional opinion. Verify cited sources, source status, and Project facts before filing, design, permitting, or construction reliance.")
                    .foregroundStyle(.secondary)
                Link("Read the Privacy Policy", destination: URL(string: "https://permitext.com/privacy")!)
                Spacer()
                Button("Continue to Research", action: onContinue)
                    .buttonStyle(.borderedProminent)
                    .frame(maxWidth: .infinity)
                Button("Cancel", role: .cancel, action: onCancel)
                    .frame(maxWidth: .infinity)
            }
            .padding(20)
            .navigationTitle("Research Notice")
            .navigationBarTitleDisplayMode(.inline)
            .interactiveDismissDisabled()
        }
    }
}

private struct ResearchFeedbackSheet: View {
    let onCancel: () -> Void
    let onSubmit: (String, String?) -> Void
    @State private var category = "incorrect_misleading"
    @State private var comment = ""

    private let categories = [
        ("incorrect_misleading", "Incorrect or misleading"),
        ("missing_information", "Missing important information"),
        ("citation_problem", "Citation problem"),
        ("other", "Other")
    ]

    var body: some View {
        NavigationStack {
            Form {
                Picker("Problem", selection: $category) {
                    ForEach(categories, id: \.0) { value, label in
                        Text(label).tag(value)
                    }
                }
                TextField("Optional details", text: $comment, axis: .vertical)
                    .lineLimit(3...8)
                Text("Reports help Permitext investigate and correct Research quality. Internal review notes are never shown here.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .navigationTitle("Report a problem")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: onCancel) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Submit") {
                        let normalized = comment.trimmingCharacters(in: .whitespacesAndNewlines)
                        onSubmit(category, normalized.isEmpty ? nil : normalized)
                    }
                }
            }
        }
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
                        Text("This enacted section contains official visual material. Select only the images Permitext should analyze with your passage.")
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
                    Text(ResearchTrustCopy.visualEvidenceDisclosure)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .accessibilityIdentifier("research-visual-openai-disclosure")
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

private struct ResearchFormattedNarrative: View {
    private struct Block: Identifiable {
        enum Kind {
            case paragraph(String)
            case heading(String)
            case list([String])
            case quote(String)
            case table(header: [String], rows: [[String]])
        }

        let id: Int
        let kind: Kind
    }

    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Self.blocks(in: text)) { block in
                switch block.kind {
                case .paragraph(let value):
                    inlineText(value)
                case .heading(let value):
                    inlineText(value)
                        .font(.headline)
                        .padding(.top, 2)
                case .list(let items):
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text("•")
                                inlineText(item)
                            }
                        }
                    }
                case .quote(let value):
                    HStack(alignment: .top, spacing: 10) {
                        Rectangle()
                            .fill(Color.secondary.opacity(0.45))
                            .frame(width: 3)
                        inlineText(value)
                            .foregroundStyle(.secondary)
                    }
                case .table(let header, let rows):
                    narrativeTable(header: header, rows: rows)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func inlineText(_ value: String) -> Text {
        if let attributed = try? AttributedString(markdown: value) {
            return Text(attributed)
        }
        return Text(value)
    }

    private func narrativeTable(header: [String], rows: [[String]]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top, spacing: 0) {
                    ForEach(Array(header.enumerated()), id: \.offset) { _, value in
                        inlineText(value)
                            .font(.subheadline.weight(.bold))
                            .frame(width: 170, alignment: .leading)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                    }
                }
                Divider()
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    HStack(alignment: .top, spacing: 0) {
                        ForEach(Array(row.enumerated()), id: \.offset) { _, value in
                            inlineText(value)
                                .frame(width: 170, alignment: .leading)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 8)
                        }
                    }
                    Divider()
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Research answer comparison table")
    }

    private static func blocks(in value: String) -> [Block] {
        value
            .replacingOccurrences(of: "\r\n", with: "\n")
            .components(separatedBy: "\n\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .enumerated()
            .map { index, rawBlock in
                let lines = rawBlock
                    .components(separatedBy: "\n")
                    .map { $0.trimmingCharacters(in: .whitespaces) }
                    .filter { !$0.isEmpty }
                if let table = tableValue(lines) {
                    return Block(id: index, kind: .table(header: table.header, rows: table.rows))
                }
                if lines.count == 1,
                   let marker = lines[0].range(of: #"^#{2,4}\s+"#, options: .regularExpression) {
                    return Block(id: index, kind: .heading(String(lines[0][marker.upperBound...])))
                }
                if !lines.isEmpty, lines.allSatisfy({ $0.hasPrefix("- ") || $0.hasPrefix("* ") }) {
                    return Block(id: index, kind: .list(lines.map { String($0.dropFirst(2)) }))
                }
                if !lines.isEmpty, lines.allSatisfy({ $0.hasPrefix(">") }) {
                    let quote = lines.map {
                        String($0.dropFirst()).trimmingCharacters(in: .whitespaces)
                    }.joined(separator: "\n")
                    return Block(id: index, kind: .quote(quote))
                }
                return Block(id: index, kind: .paragraph(rawBlock))
            }
    }

    private static func tableValue(_ lines: [String]) -> (header: [String], rows: [[String]])? {
        guard lines.count >= 3, lines.allSatisfy({ $0.contains("|") }) else { return nil }
        let header = tableCells(lines[0])
        let separator = tableCells(lines[1])
        guard header.count >= 2,
              separator.count == header.count,
              separator.allSatisfy(isTableSeparator) else { return nil }
        let rows = lines.dropFirst(2).map(tableCells)
        guard rows.allSatisfy({ $0.count == header.count }) else { return nil }
        return (header, rows)
    }

    private static func tableCells(_ line: String) -> [String] {
        var normalized = line.trimmingCharacters(in: .whitespaces)
        if normalized.hasPrefix("|") { normalized.removeFirst() }
        if normalized.hasSuffix("|") { normalized.removeLast() }
        return normalized
            .split(separator: "|", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
    }

    private static func isTableSeparator(_ value: String) -> Bool {
        let normalized = value.trimmingCharacters(in: .whitespaces)
        return normalized.filter { $0 == "-" }.count >= 3 &&
            normalized.allSatisfy { $0 == "-" || $0 == ":" }
    }
}

private struct ResearchAnswerView: View {
    let answer: ResearchAnswer
    let sourceStatus: String
    let feedback: ResearchFeedback?
    let isSavingFeedback: Bool
    let onHelpful: () -> Void
    let onReportProblem: () -> Void
    let onOpenCitation: (ResearchCitation) -> Void
    @State private var didCopy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let authorityLabel = answer.researchAuthorityLabel, !authorityLabel.isEmpty {
                Text(authorityLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(Color.secondary.opacity(0.12), in: Capsule())
                    .accessibilityIdentifier("research-answer-authority-status")
            }
            ResearchFormattedNarrative(text: primaryNarrative)
                .font(.body)
                .textSelection(.enabled)
            if let basisText {
                Text(basisText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            }
            if !answer.researchCorpusMetadataLines.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(answer.researchCorpusMetadataLines.enumerated()), id: \.offset) { _, line in
                        Text(line)
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
                .accessibilityElement(children: .contain)
                .accessibilityLabel("Research corpus editions and applicability")
                .accessibilityIdentifier("research-answer-corpus-metadata")
            }
            projectFactsDisclosure
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
                DisclosureGroup(answer.mode == "project_context" ? "Project facts reviewed" : "Evidence reviewed") {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(answer.researchSourceBoundaryText)
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                            .accessibilityIdentifier("research-answer-source-boundary")
                        supportedPointsSection(answer.supportedPoints)
                        answerSection("Assumptions used", items: answer.assumptions)
                        answerSection("Project facts to verify", items: answer.missingFacts)
                        answerSection("Limits of this answer", items: answer.evidenceLimitations)
                        answerSection("Questions that would materially advance this answer", items: answer.followUpQuestions)
                        answerSection("Related evidence to add", items: answer.additionalEvidenceNeeded)
                        supportingSourcesSection
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
            HStack(spacing: 14) {
                Button(didCopy ? "Copied" : ResearchTrustCopy.copyAnswerAction, systemImage: didCopy ? "checkmark" : "doc.on.doc") {
                    UIPasteboard.general.string = answer.structuredCopyText(sourceStatus: sourceStatus)
                    didCopy = true
                }
                Button("Helpful", systemImage: feedback?.category == "helpful" ? "hand.thumbsup.fill" : "hand.thumbsup") {
                    onHelpful()
                }
                Button(ResearchTrustCopy.reportProblemAction, systemImage: "exclamationmark.bubble") {
                    onReportProblem()
                }
            }
            .font(.caption.weight(.semibold))
            .buttonStyle(.plain)
            .disabled(isSavingFeedback)
            .accessibilityIdentifier("research-answer-actions")
            if let feedback {
                Text("Feedback: \(feedback.displayStatus)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("research-answer-feedback-status")
            }
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

    private var primaryNarrative: String {
        if let answerText = answer.answerText?.trimmingCharacters(in: .whitespacesAndNewlines),
           !answerText.isEmpty {
            return answerText
        }
        return [answer.conclusion, answer.explanation]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }

    private var basisText: String? {
        let captured = answer.researchSourceDateLabel
        let disclosedBasis = answer.codeBasis?.disclosure?.trimmingCharacters(in: .whitespacesAndNewlines)
        let basisLimitation = answer.codeBasis?.limitation?.trimmingCharacters(in: .whitespacesAndNewlines)
        let parts = [
            answer.researchMetadataText(sourceStatus: sourceStatus),
            disclosedBasis?.isEmpty == false ? disclosedBasis : answer.codeEdition,
            basisLimitation?.isEmpty == false ? basisLimitation : nil,
            captured.map { "Research basis captured \($0)" }
        ]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private var hasEvidenceDetails: Bool {
        !answer.supportedPoints.isEmpty ||
            !answer.assumptions.isEmpty ||
            !answer.missingFacts.isEmpty ||
            !answer.evidenceLimitations.isEmpty ||
            !answer.followUpQuestions.isEmpty ||
            !answer.additionalEvidenceNeeded.isEmpty ||
            !(answer.supportingSources ?? []).isEmpty ||
            hasFactUsage ||
            !answer.citations.isEmpty
    }

    private var hasFactUsage: Bool {
        let usage = answer.factUsage
        return !(usage?.projectContext ?? []).isEmpty ||
            !(usage?.conversation ?? []).isEmpty ||
            !(usage?.other ?? []).isEmpty
    }

    @ViewBuilder
    private var projectFactsDisclosure: some View {
        if hasFactUsage {
            DisclosureGroup("Facts used in this answer") {
                VStack(alignment: .leading, spacing: 7) {
                    answerInlineGroup("Project context", items: answer.factUsage?.projectContext ?? [])
                    answerInlineGroup("Research conversation", items: answer.factUsage?.conversation ?? [])
                    answerInlineGroup("Other supplied facts", items: answer.factUsage?.other ?? [])
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.top, 8)
            }
            .font(.subheadline.weight(.semibold))
            .accessibilityIdentifier("research-answer-facts-used")
        }
    }

    @ViewBuilder
    private var supportingSourcesSection: some View {
        let sources = answer.supportingSources ?? []
        if !sources.isEmpty {
            VStack(alignment: .leading, spacing: 7) {
                Text("Supporting context — noncontrolling")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.primary)
                ForEach(Array(sources.enumerated()), id: \.offset) { _, source in
                    let claim = source.claim?.trimmingCharacters(in: .whitespacesAndNewlines)
                    let label = "• " + [source.displayTitle, claim]
                        .compactMap { $0 }
                        .filter { !$0.isEmpty }
                        .joined(separator: ": ")
                    if let url = source.webURL {
                        Link(label, destination: url)
                            .foregroundStyle(Color.accentColor)
                            .accessibilityLabel("Open \(source.displayTitle)")
                    } else {
                        Text(label)
                    }
                }
            }
            .accessibilityIdentifier("research-answer-supporting-context")
        }
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

    @ViewBuilder
    private func answerInlineGroup(_ title: String, items: [String]) -> some View {
        if !items.isEmpty {
            Text("\(title): \(items.joined(separator: " · "))")
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
