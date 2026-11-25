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
    var failure: ResearchRequestFailurePresentation? = nil
    var contextRevision: Int? = nil
    var startedAt: String? = nil

    var recoveryMessage: String {
        failure?.message ?? "Assistant was interrupted before an answer was saved. Retry to recover the same request. Your question is still here."
    }

    func recordingFailure(_ error: Error) -> ResearchQuestionAttempt {
        var saved = self
        saved.failure = ResearchRequestFailurePresentation.resolve(error)
        return saved
    }

    static func serverFailure(_ message: ResearchMessage, messages: [ResearchMessage]) -> ResearchQuestionAttempt? {
        guard message.role == "user", let question = message.question,
              let requestID = message.requestID, !requestID.isEmpty,
              let failure = message.failure,
              ["failed", "cancelled"].contains(failure.status),
              !ResearchRequestReconciliation.containsCompletedRequest(messages: messages, requestID: requestID, question: question)
        else { return nil }
        let presentation = failure.status == "cancelled"
            ? ResearchRequestFailurePresentation.resolve(URLError(.cancelled))
            : ResearchRequestFailurePresentation.resolve(PermitextBackendHTTPError.serverStatus(502, failure.message, code: failure.code))
        return ResearchQuestionAttempt(id: requestID, question: question, failure: presentation, startedAt: message.createdAt)
    }

    static func recover(messages: [ResearchMessage], cached: ResearchQuestionAttempt?) -> ResearchQuestionAttempt? {
        if let cached, !ResearchRequestReconciliation.containsCompletedRequest(messages: messages, requestID: cached.id, question: cached.question) {
            return messages.compactMap { serverFailure($0, messages: messages) }.first { $0.id == cached.id } ?? cached
        }
        return messages.reversed().compactMap { serverFailure($0, messages: messages) }.first
    }

    func shouldRetainOnServer(_ conversation: ResearchConversation) -> Bool {
        // A cached interrupted attempt is terminal after reopening; active requests
        // are separately excluded by the view. Existing server records always win.
        !conversation.messages.contains { $0.requestID == id }
            && (contextRevision == nil || contextRevision == (conversation.contextRevision ?? 0))
    }

    var retryAttempt: ResearchQuestionAttempt {
        ResearchQuestionAttempt(id: id, question: question, contextRevision: contextRevision, startedAt: startedAt)
    }
}

enum ResearchTrustCopy {
    static let composerPrivacyDisclosure = "Assistant sends your question, recent conversation, and selected Reader passages with any attached chapter figures to OpenAI. When enabled, Project context and facts are sent too. Private notes are not included. Do not include confidential, regulated, or sensitive personal information."
    static let firstUseDisclosure = "per codes sends your question, recent conversation, and selected Reader passages with any attached chapter figures to OpenAI. When enabled, Project context and facts are sent too. Private notes are not included."
    static let visualEvidenceDisclosure = "Selected official images are sent to OpenAI for analysis."
    static let copyAnswerAction = "Copy answer"
    static let reportProblemAction = "Report a problem"
    static let nextStepGuidance = "Review the cited provision and Project facts, then record your own conclusion in a Project Note. Build Reports on per codes Web."
}

enum ResearchHistoryPresentation {
    // Decoded summaries have a required Int messageCount. Only exact zero is a
    // draft; invalid negative counts stay in ordinary chronology. No records hide.
    static func ordered(_ summaries: [ResearchConversationSummary]) -> [ResearchConversationSummary] {
        summaries.filter { $0.isPinned == true } +
            summaries.filter { $0.isPinned != true && $0.messageCount != 0 } +
            summaries.filter { $0.isPinned != true && $0.messageCount == 0 }
    }

    struct GroupLabels {
        private let calendar = Calendar.current
        private let sevenDaysAgo: Date?
        private let thirtyDaysAgo: Date?
        private let currentYear: Int
        private let month = DateFormatter()
        private let monthAndYear = DateFormatter()

        init(now: Date = Date()) {
            sevenDaysAgo = calendar.date(byAdding: .day, value: -7, to: now)
            thirtyDaysAgo = calendar.date(byAdding: .day, value: -30, to: now)
            currentYear = calendar.component(.year, from: now)
            month.dateFormat = "MMMM"
            monthAndYear.dateFormat = "MMMM yyyy"
        }

        func label(for item: ResearchConversationSummary) -> String {
            if item.isPinned == true { return "Pinned" }
            if item.messageCount == 0 { return "Drafts" }
            guard let date = ListTimestamp.date(from: item.createdAt) else {
                return "Earlier"
            }
            if let sevenDaysAgo, date >= sevenDaysAgo { return "7 days" }
            if let thirtyDaysAgo, date >= thirtyDaysAgo { return "30 days" }
            let formatter = calendar.component(.year, from: date) == currentYear ? month : monthAndYear
            return formatter.string(from: date)
        }
    }
}

enum ResearchComposerDraftCache {
    static let scope = "research-composer-draft"

    static func save(_ text: String, cache: ProjectHubOfflineCache, accountID: String, conversationID: String) throws {
        if text.isEmpty {
            try cache.remove(accountID: accountID, projectID: conversationID, scope: scope)
        } else {
            try cache.store(text, accountID: accountID, projectID: conversationID, scope: scope)
        }
    }

    static func load(cache: ProjectHubOfflineCache, accountID: String, conversationID: String) throws -> String? {
        try cache.load(String.self, accountID: accountID, projectID: conversationID, scope: scope)?.value
    }
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

    static func invalidateServerCopy(
        cache: ProjectHubOfflineCache, accountID: String, conversationID: String, error: Error
    ) throws {
        guard NativePrivateCachePolicy.requiresInvalidation(after: error) else { return }
        if let status = (error as? PermitextBackendHTTPError)?.statusCode, [404, 410].contains(status) {
            try removeDeletedConversation(cache: cache, accountID: accountID, conversationID: conversationID)
        } else {
            // Expired/revoked access hides server data, but is not a request to
            // erase the account's unsent question. Restore it only after access returns.
            try cache.remove(accountID: accountID, projectID: conversationID, scope: conversationScope)
        }
    }

    static func removeDeletedConversation(
        cache: ProjectHubOfflineCache,
        accountID: String,
        conversationID: String
    ) throws {
        try cache.remove(accountID: accountID, projectID: conversationID, scope: ResearchComposerDraftCache.scope)
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

enum ResearchConversationDeletionRoute {
    static func destinationConversationID(
        activeConversationID: String?,
        deletingConversationID: String
    ) -> String? {
        activeConversationID == deletingConversationID ? nil : activeConversationID
    }
}

struct ResearchDeletionBatchResult: Equatable {
    var deletedIDs: [String] = []
    var failedIDs: [String] = []
}

enum ResearchDeletionBatch {
    /// Keep deletions serial and stop when the owning private session changes.
    /// Each success is published separately so a later failure can be retried.
    @MainActor
    static func run(
        conversationIDs: [String],
        canContinue: () -> Bool,
        delete: (String) async throws -> Void,
        didDelete: (String) -> Void
    ) async -> ResearchDeletionBatchResult {
        var result = ResearchDeletionBatchResult()
        var attempted: Set<String> = []
        for id in conversationIDs where !id.isEmpty && attempted.insert(id).inserted {
            guard canContinue(), !Task.isCancelled else { break }
            do {
                try await delete(id)
                guard canContinue(), !Task.isCancelled else { break }
                result.deletedIDs.append(id)
                didDelete(id)
            } catch {
                guard canContinue(), !Task.isCancelled else { break }
                result.failedIDs.append(id)
            }
        }
        return result
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
    let conversationIDs: [String]
    var id: String { conversationIDs.joined(separator: "|") }
    var isMultiple: Bool { conversationIDs.count > 1 }
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
        let messagesForRequest = messages.filter { $0.requestID == requestID }

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

struct ResearchRequestFailurePresentation: Equatable, Codable, Sendable {
    let message: String

    static func shouldReconcileCompletion(after error: Error) -> Bool {
        // These are explicit pre-commit rejections, not lost responses. Polling
        // four times cannot recover an answer and adds twelve seconds of delay.
        let terminalCodes: Set<String> = [
            "V2_REVIEW_FAILED", "V2_INVALID_OUTPUT", "RESEARCH_V2_DISABLED", "RESEARCH_CONTEXT_CHANGED",
            "RESEARCH_VERIFICATION_FAILED", "INVALID_RESEARCH_RESPONSE", "INVALID_RESEARCH_VERIFICATION", "RESEARCH_SPEND_CAP",
            "RESEARCH_EVAL_SPEND_CAP", "RESEARCH_OFFICIAL_GUIDANCE_UNAVAILABLE",
            "RESEARCH_EVIDENCE_NOT_FOUND", "RESEARCH_EVIDENCE_REQUIRED",
            "RESEARCH_TURNS_REQUIRED", "RESEARCH_CAPACITY_REVIEW"
        ]
        let code = (error as? PermitextBackendHTTPError)?.serverCode?
            .trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        return !terminalCodes.contains(code ?? "")
    }

    static func resolve(_ error: Error) -> ResearchRequestFailurePresentation {
        if let backendError = error as? PermitextBackendHTTPError {
            return resolve(backendError)
        }

        if let urlError = error as? URLError {
            switch urlError.code {
            case .timedOut:
                return retainedQuestion(
                    "Assistant is taking longer than expected. per codes checked for a completed answer but did not find one yet."
                )
            case .notConnectedToInternet, .networkConnectionLost:
                return retainedQuestion("Assistant could not connect to the internet.")
            case .cancelled:
                return retainedQuestion("Assistant was cancelled.")
            default:
                return retainedQuestion("per codes could not reach Assistant.")
            }
        }

        return retainedQuestion("per codes could not reach Assistant.")
    }

    private static func resolve(
        _ error: PermitextBackendHTTPError
    ) -> ResearchRequestFailurePresentation {
        let code = error.serverCode?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let serverMessage = error.serverMessage?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let verificationCodes: Set<String> = [
            "V2_REVIEW_FAILED", "V2_INVALID_OUTPUT",
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
        case "RESEARCH_INTERRUPTED":
            return retainedQuestion("Assistant was interrupted before an answer was saved.")
        case "INVALID_RESEARCH_RESPONSE":
            return retainedQuestion("Assistant could not finish generating a complete answer.")
        case "INVALID_RESEARCH_VERIFICATION":
            return retainedQuestion("Assistant could not complete its evidence check.")
        case "RESEARCH_SPEND_CAP", "RESEARCH_EVAL_SPEND_CAP":
            return retainedQuestion("Assistant stopped before another model call could exceed its spending limit.")
        case "RESEARCH_OFFICIAL_GUIDANCE_UNAVAILABLE":
            return retainedQuestion(
                "per codes could not retrieve attributable official guidance from the approved sources."
            )
        case "RESEARCH_EVIDENCE_NOT_FOUND":
            return retainedQuestion(
                serverMessage ?? "per codes could not locate enacted text in the current authorized corpus for this question. Try a more specific code topic or citation."
            )
        case "RESEARCH_EVIDENCE_REQUIRED", "RESEARCH_SOURCE_CHANGED", "RESEARCH_REFUSAL":
            return retainedQuestion(serverMessage ?? "Assistant needs updated enacted evidence before it can answer.")
        case "RESEARCH_CAPACITY_REVIEW":
            return retainedQuestion(serverMessage ?? "Assistant is temporarily unavailable while account capacity is reviewed.")
        case "RESEARCH_TURNS_REQUIRED":
            return ResearchRequestFailurePresentation(
                message: "You have used this month's included Assistant turns. Buy more turns to continue; your question is still here."
            )
        case "RESEARCH_CANCELLED":
            return retainedQuestion("Assistant was cancelled.")
        case let value? where verificationCodes.contains(value):
            return retainedQuestion(
                "per codes could not confirm that the draft answer was supported by the cited sources, so it has not shown the draft. This does not mean your question cannot be answered. Try asking about one specific provision, or open the relevant code passage and ask from there."
            )
        case let value? where providerCodes.contains(value):
            return retainedQuestion("Assistant is temporarily unavailable.")
        default:
            break
        }

        if error.isAuthenticationFailure {
            return retainedQuestion("Your per codes session no longer has access to Assistant. Sign in again and retry.")
        }

        if error.statusCode == 502,
           serverMessage?.localizedCaseInsensitiveContains("verified") == true {
            return retainedQuestion(
                "per codes could not confirm that the draft answer was supported by the cited sources, so it has not shown the draft. This does not mean your question cannot be answered. Try asking about one specific provision, or open the relevant code passage and ask from there."
            )
        }

        if let statusCode = error.statusCode, statusCode >= 500 {
            return retainedQuestion("Assistant is temporarily unavailable.")
        }

        if let serverMessage, !serverMessage.isEmpty {
            return retainedQuestion(serverMessage)
        }

        return retainedQuestion("per codes could not reach Assistant.")
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
    private let cacheDirectoryURL: URL?
    private let projectFolderID: Int64?

    init(projectFolderID: Int64? = nil, cacheDirectoryURL: URL? = nil) {
        self.projectFolderID = projectFolderID
        self.cacheDirectoryURL = cacheDirectoryURL
    }

    var body: some View {
        ResearchSessionView(owner: library.privateRequestIdentity, projectFolderID: projectFolderID,
                            scopedProjectID: projectFolderID.flatMap { library.backendProjectID(for: $0) },
                            projectSessionID: library.projectWorkspaceSessionID,
                            cacheDirectoryURL: cacheDirectoryURL)
            .id("\(library.privateSessionID):\(projectFolderID.map(String.init) ?? "all")")
    }
}

private struct ResearchSessionView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.floatingNavigationClearance) private var floatingNavigationClearance
    @Environment(\.tabNavigationHorizontalInset) private var tabNavigationHorizontalInset
    @Environment(\.purchase) private var purchase
    @Environment(\.scenePhase) private var scenePhase
    @Namespace private var conversationZoomNamespace
    @State private var newConversationZoomID: String?
    private enum ConversationZoomSource: Hashable {
        case history(String)
        case new
    }
    @State private var summaries: [ResearchConversationSummary] = []
    @State private var historyPreviews: [String: String] = [:]
    @State private var historyPreviewRevisions: [String: String] = [:]
    @State private var historyNextCursor: String?
    @State private var historyHasMore = false
    @State private var historyLegacySummaries: [ResearchConversationSummary]?
    @State private var isLoadingMoreHistory = false
    @State private var historyLoadedFilterKey: String?
    @State private var conversation: ResearchConversation?
    private struct FactReply: Identifiable {
        let id = UUID()
        let fact: String
        let originalQuestion: String
    }
    @State private var factReply: FactReply?
    @State private var factResponse = ""
    @State private var question = ""
    @State private var isLoadingHistory = true
    @State private var isLoadingConversation = false
    @State private var historyLoadID: UUID?
    @State private var conversationLoadID: UUID?
    @State private var conversationPublicationID = UUID()
    @State private var isCreatingConversation = false
    @State private var isConsumingPendingSelection = false
    @State private var retainingInterruptedIdentities: [NativeResearchRequestIdentity] = []
    @State private var isSending = false
    @State private var activeResearchRequestTask: Task<Void, Never>?
    @State private var pendingQuestionAttempt: ResearchQuestionAttempt?
    @State private var pendingDisclosureAttempt: ResearchQuestionAttempt?
    @State private var failedQuestionAttempt: ResearchQuestionAttempt?
    @State private var errorMessage: String?
    @State private var historyErrorMessage: String?
    @State private var questionErrorMessage: String?
    @State private var pendingVisualReview: PendingResearchVisualReview?
    @State private var showingRename = false
    @State private var draftTitle = ""
    @State private var isUpdatingPin = false
    @State private var renameConversationID: String?
    @State private var isUpdatingProjectContext = false
    @State private var pendingAssignmentProjectID: String?
    @State private var showingAssignmentConfirmation = false
    @State private var showingProjectCreator = false
    @State private var pendingDeletion: PendingResearchDeletion?
    @State private var isSelectingHistory = false
    @State private var selectedHistoryIDs: Set<String> = []
    @State private var isDeletingHistoryBatch = false
    @State private var deletingConversationID: String?
    @State private var showingSettings = false
    @State private var recoverySettingsSection: SettingsSection = .account
    @State private var isRefreshingSources = false
    @State private var isConfirmingProjectContext = false
    @State private var pendingFeedbackReport: PendingResearchFeedbackReport?
    @State private var pendingNotebookHandoff: ResearchNotebookHandoff?
    @State private var citationRequest: CitationRequest?
    @State private var citationPreview: PreparedSearchReaderDestination?
    @State private var citationSourcePrompt: CitationSourcePrompt?
    @State private var feedbackMessageID: String?
    @State private var isVisible = false
    private let cache: ProjectHubOfflineCache
    private let owner: NativePrivateRequestIdentity?
    private let projectFolderID: Int64?
    private let scopedProjectID: String?
    private let projectSessionID: UUID

    private struct CitationRequest: Identifiable {
        let id = UUID()
        let route: SearchReaderRoute
    }

    private struct CitationSourcePrompt {
        let route: SearchReaderRoute
        let target: ActiveCodeSourceNavigationTarget
        let context: CodeLibraryViewModel.CodeSourceNavigationContext
    }

    init(owner: NativePrivateRequestIdentity?, projectFolderID: Int64?, scopedProjectID: String?, projectSessionID: UUID, cacheDirectoryURL: URL? = nil) {
        self.owner = owner
        self.projectFolderID = projectFolderID
        self.scopedProjectID = scopedProjectID
        self.projectSessionID = projectSessionID
        cache = ProjectHubOfflineCache(directoryURL: cacheDirectoryURL)
    }

    var body: some View {
        researchNavigation
            .background {
                TabBarReselectListener(selectedIconColor: nil, onReselect: researchTabReselectAction)
            }
            .sheet(item: $citationPreview) { prepared in
                PreparedPassagePreview(prepared: prepared, library: library, onClose: { citationPreview = nil })
            }
            .alert("Enable this code source?", isPresented: Binding(
                get: { citationSourcePrompt != nil },
                set: { if !$0 { citationSourcePrompt = nil } }
            ), presenting: citationSourcePrompt) { prompt in
                Button("Enable and open") {
                    guard isCurrentOwner,
                          library.enableCodeSourceForNavigation(source: prompt.target.source, context: prompt.context) else { return }
                    citationRequest = CitationRequest(route: prompt.route)
                }
                Button("Cancel", role: .cancel) {}
            } message: { prompt in
                Text("This passage belongs to a code source you turned off (\(NativeReaderEditionLabel.label(for: prompt.target.source.canonicalEdition))). Enable it to open the cited edition.")
            }
            .task(id: citationRequest?.id) {
                if let citationRequest { await prepareCitationPreview(citationRequest) }
            }
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
                        guard isCurrentOwner else { return }
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
                    existingFeedback: conversation?.messages.first(where: { $0.id == report.messageID })?.feedback,
                    onCancel: { pendingFeedbackReport = nil },
                    onSubmit: { category, comment, usefulness, checking, reference in
                        pendingFeedbackReport = nil
                        Task { await saveFeedback(messageID: report.messageID, category: category, comment: comment, usefulness: usefulness, outsideChecking: checking, supportingReference: reference) }
                    }
                )
            }
            .permitextAccountSheet(isPresented: $showingSettings) {
                PermitextAccountEntryView(initialSection: recoverySettingsSection)
                    .environmentObject(library)
            }
            .sheet(item: $factReply) { reply in
                let response = factResponse.trimmingCharacters(in: .whitespacesAndNewlines)
                let context = reply.originalQuestion.isEmpty ? "" : "Regarding the earlier question: \(reply.originalQuestion)"
                let addition = [context, "Requested fact: \(reply.fact)", "My response: \(response)"]
                    .filter { !$0.isEmpty }.joined(separator: "\n")
                let draft = [question, addition].filter { !$0.isEmpty }.joined(separator: "\n\n")
                NavigationStack {
                    Form {
                        Section("Requested fact") { Text(reply.fact) }
                        Section("Your reply") { TextField("What do you know?", text: $factResponse, axis: .vertical) }
                        if draft.utf16.count > 2000 { Text("Shorten the reply or message to fit 2,000 characters.") }
                    }
                    .navigationTitle("Reply to fact")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { factReply = nil } }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Add to draft") {
                                question = draft
                                persistComposerDraft(draft)
                                factReply = nil
                            }.disabled(response.isEmpty || draft.utf16.count > 2000 || researchSendIsBlocked || isSending)
                        }
                    }
                }
            }
            .sheet(item: $pendingNotebookHandoff) { handoff in
                NotebookSourceHandoffSheet(handoff: handoff, owner: owner)
                    .environmentObject(library)
            }
            .sheet(isPresented: $showingProjectCreator) {
                FolderEditorSheet(
                    existing: nil,
                    defaultFolderType: .project,
                    onSave: { name, address, description, structuredFacts, colorHex, folderType in
                        guard let newProject = library.createFolder(
                            name: name,
                            address: address,
                            description: description,
                            structuredFacts: structuredFacts,
                            colorHex: colorHex,
                            folderType: folderType
                        ), let projectID = library.backendProjectID(for: newProject.id)
                        else { return }

                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                            requestAssignment(projectID)
                        }
                    },
                    onDelete: {}
                )
                .environmentObject(library)
            }
            .alert("Rename conversation", isPresented: $showingRename) {
                TextField("Conversation title", text: $draftTitle)
                Button("Cancel", role: .cancel) {}
                Button("Save") { Task { await renameConversation() } }
            }
            .confirmationDialog(
                "Move this conversation?",
                isPresented: $showingAssignmentConfirmation,
                titleVisibility: .visible
            ) {
                Button("Move Conversation") {
                    Task { await assignConversation(projectID: pendingAssignmentProjectID, confirmed: true) }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Assistant will use the destination Project’s current facts for future answers. Existing answers keep their original evidence and context.")
            }
            .alert(
                pendingDeletion?.isMultiple == true ? "Delete selected conversations?" : "Delete conversation?",
                isPresented: Binding(
                    get: { pendingDeletion != nil },
                    set: { if !$0 { pendingDeletion = nil } }
                ),
                presenting: pendingDeletion
            ) { pending in
                Button(pending.isMultiple ? "Delete \(pending.conversationIDs.count) Conversations" : "Delete Conversation", role: .destructive) {
                    pendingDeletion = nil
                    Task {
                        if isSelectingHistory {
                            await deleteSelectedConversations(ids: pending.conversationIDs)
                        } else if let id = pending.conversationIDs.first {
                            await deleteConversation(id: id)
                        }
                    }
                }
                Button("Cancel", role: .cancel) {
                    pendingDeletion = nil
                }
            } message: { _ in
                Text("This cannot be undone.")
            }
            .task(id: "\(library.privateSessionID):\(library.hasResearchAccess)") {
                guard isCurrentOwner else { return }
                // Restore the selected conversation immediately; billing metadata
                // and history are independent reads, not prerequisites for reading.
                async let allowance: Void = library.refreshResearchTurnAllowance(
                    recoverUnfinishedPurchases: true,
                    showsErrors: false
                )
                await openActiveConversationIfNeeded()
                await allowance
                guard isCurrentOwner, !Task.isCancelled else { return }
                await consumePendingSelectionIfNeeded()
            }
            .task(id: "\(library.hasResearchAccess):\(historyFilterKey)") {
                guard isCurrentOwner, library.hasResearchAccess, !Task.isCancelled else { return }
                await loadHistory()
            }
            .onChange(of: library.activeResearchConversationID) { previousID, id in
                guard isCurrentOwner else { return }
                clearCitationPreview()
                if id != nil {
                    finishSelectingHistory()
                    library.researchHistoryIsPresented = false
                }
                if conversation?.id != id { conversation = nil }
                conversationLoadID = nil
                isLoadingConversation = false
                activeResearchRequestTask?.cancel()
                activeResearchRequestTask = nil
                pendingQuestionAttempt = nil
                pendingDisclosureAttempt = nil
                failedQuestionAttempt = nil
                pendingFeedbackReport = nil
                factReply = nil
                pendingNotebookHandoff = nil
                pendingVisualReview = nil
                pendingDeletion = nil
                showingRename = false
                renameConversationID = nil
                isUpdatingProjectContext = false
                showingAssignmentConfirmation = false
                question = ""
                draftTitle = ""
                errorMessage = nil
                questionErrorMessage = nil
                isSending = false
                isRefreshingSources = false
                isConfirmingProjectContext = false
                feedbackMessageID = nil
                if deletingConversationID != previousID { deletingConversationID = nil }
                Task { await openActiveConversationIfNeeded() }
            }
            .onChange(of: historyFilterKey) { selectedHistoryIDs = [] }
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
            .onChange(of: library.selectedTab) { _, tab in
                if tab != .research { clearCitationPreview() }
            }
            .onChange(of: library.researchHistoryIsPresented) { _, presented in
                if presented { clearCitationPreview() }
            }
    }

    private var researchNavigation: some View {
        NavigationStack {
            Group {
                if canPresentResearch {
                    historyView
                } else {
                    researchAccessScreen
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.top, CodeScreenMetrics.scrollMeasuredTitleTopPadding)
            .background(CodeAppBackdrop(accent: Color.appChrome).ignoresSafeArea())
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.visible, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                if showsHistorySelectionToolbar {
                    ListSelectionToolbar(
                        selectedCount: selectedVisibleHistory.count,
                        availableCount: visibleHistory.count,
                        isBusy: isDeletingHistoryBatch,
                        cancel: finishSelectingHistory,
                        selectAll: { selectedHistoryIDs = Set(visibleHistory.map(\.id)) },
                        deselectAll: { selectedHistoryIDs = [] }
                    ) {
                        Button(role: .destructive, action: requestSelectedDeletion) {
                            ToolbarActionIcon(systemImage: "trash")
                        }
                        .accessibilityLabel("Delete selected conversations")
                    }
                } else {
                    CodeMainScreenToolbarTitle(title: "Assistant", alignment: .center)
                    if canPresentResearch {
                        IconToolbarGroup { researchHistoryActions }
                    }
                }
            }
            .navigationDestination(item: conversationRoute) { id in
                Group {
                    if let conversation = currentConversation, conversation.id == id {
                        conversationView(conversation)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.top, CodeScreenMetrics.scrollMeasuredTitleTopPadding)
                .background(CodeAppBackdrop(accent: Color.appChrome).ignoresSafeArea())
                .navigationBarBackButtonHidden()
                .toolbar(.hidden, for: .navigationBar)
                .cardZoomDestination(id: newConversationZoomID == id ? ConversationZoomSource.new : .history(id),
                                     in: conversationZoomNamespace, reduceMotion: reduceMotion)
            }
        }
    }

    @ViewBuilder
    private var researchAccessScreen: some View {
        if library.defersEntitlementPresentation {
            NativeEntitlementStatusView().padding(24)
        } else if library.signedInAccount == nil {
            researchAccessRecovery(
                title: "Assistant requires Pro",
                description: pendingSelectionRecoveryDescription(
                    fallback: "Sign in and upgrade to Pro to use Assistant. Code reading and search remain free."
                ),
                buttonTitle: "Open Account",
                section: .account
            )
        } else {
            researchAccessRecovery(
                title: "Assistant requires Pro",
                description: pendingSelectionRecoveryDescription(
                    fallback: "Upgrade to Pro to use Assistant. Code reading and search remain free."
                ),
                buttonTitle: "View Plans",
                section: .plan
            )
        }
    }

    private var canPresentResearch: Bool {
        !library.defersEntitlementPresentation && library.signedInAccount != nil && library.hasResearchAccess
    }

    private var currentConversation: ResearchConversation? {
        guard canPresentResearch, isCurrentOwner, let conversation,
              conversation.id == library.activeResearchConversationID,
              acceptsConversation(conversation) else { return nil }
        return conversation
    }

    private var conversationRoute: Binding<String?> {
        Binding(
            get: { library.researchHistoryIsPresented ? nil : currentConversation?.id },
            set: { id in
                if id == nil, currentConversation != nil { library.researchHistoryIsPresented = true }
            }
        )
    }

    private var researchTabReselectAction: () -> Void {
        let conversationID = currentConversation?.id
        let wasShowingConversation = conversationRoute.wrappedValue != nil
        return {
            guard let conversationID, currentConversation?.id == conversationID else { return }
            // UIKit can pop the navigation stack before delivering the tap callback.
            if !wasShowingConversation {
                finishSelectingHistory()
            }
            library.researchHistoryIsPresented = wasShowingConversation
        }
    }

    private var showsHistorySelectionToolbar: Bool {
        isSelectingHistory && canPresentResearch
    }

    private var visibleHistory: [ResearchConversationSummary] {
        NativeResearchHistory.filtered(summaries, query: "", projectID: historyProjectID)
    }

    private var selectedVisibleHistory: [ResearchConversationSummary] {
        visibleHistory.filter { selectedHistoryIDs.contains($0.id) }
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
            Button {
                recoverySettingsSection = section
                showingSettings = true
            } label: {
                Text(buttonTitle)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Color(uiColor: .systemBackground))
                    .padding(.horizontal, 20)
                    .frame(minHeight: 44)
                    .background(Color.primary, in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("research-recovery-action")
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func pendingSelectionRecoveryDescription(fallback: String) -> String {
        guard !library.pendingResearchSelections.isEmpty else { return fallback }
        return "Your selected Reader passage is kept. \(fallback)"
    }

    @ViewBuilder
    private var researchHistoryActions: some View {
        if !visibleHistory.isEmpty {
            ListSelectButton(title: "Select conversations") {
                ListSelectionMotion.run(reduceMotion: reduceMotion) { isSelectingHistory = true }
            }
        }
        Button {
            Task { await createConversation(selections: []) }
        } label: {
            ToolbarActionIcon(systemImage: "plus")
        }
        .accessibilityLabel("New conversation")
        .tint(Color.appChrome)
        .disabled(isCreatingConversation)
        .cardZoomSource(id: ConversationZoomSource.new, in: conversationZoomNamespace, reduceMotion: reduceMotion)
    }

    private func researchConversationMenu(_ conversation: ResearchConversation) -> some View {
        Menu {
            if projectFolderID == nil {
                Menu {
                    Button("Unassigned") { requestAssignment(nil) }
                    ForEach(library.folders.filter { $0.folderType == .project }) { folder in
                        if let projectID = library.backendProjectID(for: folder.id) {
                            Button(folder.name) { requestAssignment(projectID) }
                        }
                    }
                    Divider()
                    Button("New Project…", systemImage: "folder.badge.plus") {
                        if library.hasProjectAccess {
                            showingProjectCreator = true
                        } else {
                            library.requireProjectAccess()
                        }
                    }
                } label: {
                    Label("Project", systemImage: "folder")
                }
                .accessibilityLabel("Project context: \(projectName(for: conversation.primaryProjectID))")
                .accessibilityIdentifier("research-project-context-menu")
            }
            if conversation.primaryProjectID != nil {
                Toggle("Include project context and facts", isOn: Binding(
                    get: { conversation.assistantScope?.projectContextMode != "excluded" },
                    set: { include in
                        Task { await setProjectContextIncluded(include, conversationID: conversation.id) }
                    }
                ))
                .disabled(isLoadingConversation || isSending || isUpdatingPin || isRefreshingSources || isConfirmingProjectContext)
            }
            Button("Rename", systemImage: "pencil") {
                renameConversationID = conversation.id
                draftTitle = conversation.title
                showingRename = true
            }
            Button(conversation.isPinned == true ? "Unpin" : "Pin", systemImage: conversation.isPinned == true ? "pin.slash" : "pin") {
                Task { await pinConversation(id: conversation.id, isPinned: conversation.isPinned != true) }
            }
            .disabled(isSending || isUpdatingPin)
            Button("Delete", systemImage: "trash", role: .destructive) {
                requestDeletion(id: conversation.id)
            }
            .disabled(deletingConversationID != nil)
        } label: {
            ToolbarActionIcon(systemImage: "ellipsis")
        }
        .disabled(isUpdatingProjectContext)
        .accessibilityLabel("Assistant actions")
        .foregroundStyle(Color.appChrome)
    }

    private var researchHistoryBackButton: some View {
        Button {
            library.activeResearchConversationID = nil
            conversation = nil
            failedQuestionAttempt = nil
            questionErrorMessage = nil
        } label: {
            ToolbarActionIcon(systemImage: "chevron.left")
        }
        .foregroundStyle(Color.appChrome)
        .buttonStyle(.plain)
        .codeLiquidGlassCircle()
        .accessibilityLabel("Assistant history")
    }

    private func researchConversationHeader(_ conversation: ResearchConversation) -> some View {
        HStack {
            researchHistoryBackButton
            Spacer(minLength: 0)
            researchConversationMenu(conversation).codeLiquidGlassCircle()
        }
        .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
        .padding(.top, CodeScreenMetrics.mainHeaderTopPadding)
        .padding(.bottom, CodeScreenMetrics.contentSpacingBelowTitle)
    }

    private func loadHistoryPreview(_ summary: ResearchConversationSummary) async {
        guard isCurrentOwner, let owner,
              historyPreviewRevisions[summary.id] != summary.updatedAt else { return }
        let cache = cache
        let work = Task.detached(priority: .utility) {
            guard !Task.isCancelled else { return nil as String? }
            let cached = try? ResearchConversationCacheLifecycle.load(
                ResearchConversation.self, cache: cache,
                accountID: owner.accountID, conversationID: summary.id
            )
            let answer = cached?.value.messages.last(where: { $0.answer != nil })?.answer
            let answerText = answer?.answerText?.trimmingCharacters(in: .whitespacesAndNewlines)
            let preview = answerText?.isEmpty == false ? answerText : (answer?.conclusion ?? summary.starterQuestion)
            guard let preview, !Task.isCancelled else { return nil }
            // A three-line history preview never needs to parse an entire answer.
            let bounded = String(preview.prefix(1_200))
            let text = (try? AttributedString(markdown: bounded)).map { String($0.characters) } ?? bounded
            return text.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        }
        let preview = await withTaskCancellationHandler {
            await work.value
        } onCancel: { work.cancel() }
        guard isCurrentOwner, !Task.isCancelled,
              summaries.contains(where: { $0.id == summary.id && $0.updatedAt == summary.updatedAt }) else { return }
        historyPreviews[summary.id] = preview
        historyPreviewRevisions[summary.id] = summary.updatedAt
    }

    private var historyView: some View {
        let orderedSummaries = ResearchHistoryPresentation.ordered(visibleHistory)
        let groups = ResearchHistoryPresentation.GroupLabels()
        let rowInset = CodeScreenMetrics.bottomControlHorizontalPadding - tabNavigationHorizontalInset
        return List {
            if projectFolderID == nil {
                historyProjectFilter
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
            }

            if let message = errorMessage ?? historyErrorMessage {
                statusMessage(message)
                    .listRowBackground(Color.clear)
                if historyErrorMessage != nil {
                    Button("Retry history") { Task { await loadHistory(forceNetwork: true) } }
                        .listRowBackground(Color.clear)
                }
            }

            if orderedSummaries.isEmpty && !isLoading && errorMessage == nil && historyErrorMessage == nil {
                ContentUnavailableView(
                    projectFolderID == nil && historyProjectID != nil ? "No matching conversations" : "No conversations yet",
                    image: "Astroid",
                    description: Text("Tap the plus button to start a conversation.")
                )
                .padding(.top, 70)
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }


            ForEach(Array(orderedSummaries.enumerated()), id: \.element.id) { index, item in
                let group = groups.label(for: item)
                if index == 0 || group != groups.label(for: orderedSummaries[index - 1]) {
                    Text(group)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .padding(.top, index == 0 ? 0 : 20)
                        .listRowInsets(EdgeInsets(top: 12, leading: rowInset, bottom: 8, trailing: rowInset))
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }
                HStack(alignment: .top, spacing: 12) {
                    Button {
                        if isSelectingHistory {
                            if selectedHistoryIDs.contains(item.id) { selectedHistoryIDs.remove(item.id) }
                            else { selectedHistoryIDs.insert(item.id) }
                        } else {
                            newConversationZoomID = nil
                            library.researchHistoryIsPresented = false
                            library.activeResearchConversationID = item.id
                        }
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            if isSelectingHistory {
                                ListSelectionIndicator(isSelected: selectedHistoryIDs.contains(item.id))
                            }
                            Text(researchTitle(for: item))
                                .font(.body)
                                .foregroundStyle(.primary)
                                .multilineTextAlignment(.leading)
                                .lineLimit(3)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(.vertical, 14)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityValue(isSelectingHistory ? (selectedHistoryIDs.contains(item.id) ? "Selected" : "Not selected") : "")
                    .accessibilityIdentifier("research-history-row")
                    .cardZoomSource(id: ConversationZoomSource.history(item.id), in: conversationZoomNamespace, reduceMotion: reduceMotion)
                    if !isSelectingHistory {
                        Menu {
                            Button("Rename", systemImage: "pencil") {
                                renameConversationID = item.id
                                draftTitle = researchTitle(for: item)
                                showingRename = true
                            }
                            Button(item.isPinned == true ? "Unpin" : "Pin", systemImage: item.isPinned == true ? "pin.slash" : "pin") {
                                Task { await pinConversation(id: item.id, isPinned: item.isPinned != true) }
                            }
                        } label: {
                            Image(systemName: "ellipsis")
                                .font(.body)
                                .foregroundStyle(.secondary)
                                .frame(width: 44, height: 48)
                                .contentShape(Rectangle())
                        }
                        .accessibilityLabel("Options for \(researchTitle(for: item))")
                        .accessibilityIdentifier("research-history-options-\(item.id)")
                    }
                }
                .disabled(deletingConversationID == item.id || isDeletingHistoryBatch || isSending || isUpdatingPin)
                .listRowInsets(EdgeInsets(top: 0, leading: rowInset, bottom: 0, trailing: rowInset))
                .listRowBackground(Color.clear)
                .listRowSeparator(.visible, edges: .bottom)
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    if !isSelectingHistory {
                        Button(role: .destructive) {
                            requestDeletion(id: item.id)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
            }
            if historyHasMore && historyLoadedFilterKey == historyFilterKey {
                Button {
                    Task { await loadMoreHistory() }
                } label: {
                    HStack {
                        Text("Load older conversations")
                        if isLoadingMoreHistory { ProgressView() }
                    }
                    .frame(maxWidth: .infinity, minHeight: 44)
                }
                .disabled(isLoadingHistory || isLoadingMoreHistory)
                .listRowBackground(Color.clear)
                .accessibilityIdentifier("research-history-load-more")
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .codeNavigationTopScrollEdge()
        .accessibilityIdentifier("research-history-list")
        .contentMargins(.top, CodeScreenMetrics.contentSpacingBelowTitle, for: .scrollContent)
        .contentMargins(.bottom, floatingNavigationClearance, for: .scrollContent)
        .refreshable { await loadHistory(forceNetwork: true) }
    }

    private var historyProjectID: String? {
        if projectFolderID != nil { return scopedProjectID ?? "" }
        return library.researchHistoryProjectFilter == "all" ? nil : library.researchHistoryProjectFilter == "unassigned" ? "" : library.researchHistoryProjectFilter
    }

    private var historyFilterKey: String {
        "\(historyProjectID?.utf8.count ?? 0):\(historyProjectID ?? "all")"
    }

    private var historyProjectFilter: some View {
        Menu {
            Picker("Project", selection: $library.researchHistoryProjectFilter) {
                Text("All Projects").tag("all")
                Text("Unassigned").tag("unassigned")
                ForEach(library.folders.filter { $0.folderType == .project }) { project in
                    if let id = library.backendProjectID(for: project.id) {
                        Text(project.name).tag(id)
                    }
                }
            }
        } label: {
            Label(historyProjectID == nil ? "All Projects" : historyProjectID == "" ? "Unassigned" : library.folder(forBackendProjectID: historyProjectID ?? "")?.name ?? "Project", systemImage: "line.3.horizontal.decrease")
                .font(.subheadline)
                .frame(minHeight: 44)
        }
        .accessibilityIdentifier("research-history-project-filter")
    }

    private func conversationView(_ conversation: ResearchConversation) -> some View {
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
                    ForEach(conversation.messages.filter { pendingQuestionAttempt == nil || $0.requestID != pendingQuestionAttempt?.id }) { message in
                        messageView(
                            message,
                            sources: conversation.sources,
                            onDetailsExpanded: {
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.24) {
                                    withAnimation(.easeInOut(duration: 0.24)) {
                                        proxy.scrollTo("answer-details:\(message.id)", anchor: .center)
                                    }
                                }
                            }
                        )
                            .id(message.id)
                    }
                    if let pendingQuestionAttempt {
                        pendingQuestionView(pendingQuestionAttempt)
                            .id("pending:\(pendingQuestionAttempt.id)")
                    } else if let failedQuestionAttempt, !conversation.messages.contains(where: { $0.requestID == failedQuestionAttempt.id && $0.role == "user" }) {
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
                        Text("Ask a question or attach a passage from Reader.")
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .padding(.top, 36)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
                .padding(.top, CodeScreenMetrics.mainHeaderTopPadding)
                .codeTabAlignedHorizontalPadding()
                .padding(.bottom, CodeScreenMetrics.contentSpacingBelowTitle)
            }
            .scrollIndicators(.hidden, axes: .vertical)
            .codePinnedTopBar { researchConversationHeader(conversation) }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                researchComposer
                    .padding(.bottom, floatingNavigationClearance)
            }
            .onChange(of: conversation.messages.count) { _, _ in
                if let id = conversation.messages.last?.id {
                    withAnimation { proxy.scrollTo(id, anchor: .bottom) }
                }
            }
        }
    }

    private var researchComposer: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let composerBlockMessage {
                Text(composerBlockMessage)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            HStack(alignment: .bottom, spacing: 4) {
                TextField("Message", text: Binding(
                    get: { question },
                    set: { text in
                        question = text
                        persistComposerDraft(text)
                    }
                ), axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.body)
                    .lineLimit(1...6)
                    .padding(.vertical, 4)
                    .frame(maxWidth: .infinity, minHeight: CodeScreenMetrics.toolbarButtonSize, alignment: .leading)
                    .disabled(isSending || researchSendIsBlocked)
                    .accessibilityIdentifier("research-composer")
                Button {
                    if isSending {
                        cancelActiveResearchRequest()
                    } else {
                        startQuestionRequest()
                    }
                } label: {
                    Image(systemName: isSending ? "xmark" : "arrow.up")
                        .font(.title3.weight(isSending ? .semibold : .bold))
                        .foregroundStyle(.primary)
                        .frame(width: CodeScreenMetrics.toolbarButtonSize, height: CodeScreenMetrics.toolbarButtonSize)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(!isSending && (question.trimmingCharacters(in: .whitespacesAndNewlines).count < 3 || researchSendIsBlocked))
                .accessibilityLabel(isSending ? "Cancel Assistant request" : "Send message")
                .accessibilityIdentifier(isSending ? "research-cancel-request" : "research-send-message")
            }
            .padding(.leading, CodeScreenMetrics.cardPadding)
            .padding(.trailing, 4)
            .padding(.vertical, 4)
            .frame(minHeight: CodeScreenMetrics.bottomControlHeight)
            .codeLiquidGlassRoundedRectangle(cornerRadius: CodeScreenMetrics.researchComposerCornerRadius)
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("research-composer-bar")
        }
        .codeTabAlignedHorizontalPadding()
        .padding(.bottom, CodeScreenMetrics.sectionSpacingBelowEyebrow)
    }

    private var researchSendIsBlocked: Bool {
        retainingInterruptedIdentities.contains(where: { $0 == requestIdentity() }) ||
        isLoadingConversation || isUpdatingProjectContext ||
        library.researchTurnAllowance?.purchaseRequired == true ||
            conversation?.sourceStatus == "changed" ||
            conversation?.projectContextReviewRequired == true
    }

    private var composerBlockMessage: String? {
        if library.researchTurnAllowance?.purchaseRequired == true {
            return "Buy additional Assistant turns above to continue."
        }
        if conversation?.projectContextReviewRequired == true {
            return "Review the active Project above before asking another question."
        }
        return nil
    }

    private func setProjectContextIncluded(_ include: Bool, conversationID: String) async {
        guard let identity = requestIdentity(), identity.conversationID == conversationID,
              conversation?.id == conversationID, conversation?.primaryProjectID != nil,
              !isUpdatingProjectContext, !isLoadingConversation, !isSending,
              !isUpdatingPin, !isRefreshingSources, !isConfirmingProjectContext else { return }
        isUpdatingProjectContext = true
        defer { if isCurrent(identity) { isUpdatingProjectContext = false } }
        do {
            var updated = try await library.updateResearchProjectSnapshot(
                conversationID: conversationID, include: include, snapshotHash: nil
            )
            guard isCurrent(identity) else { return }
            if conversation?.sourceStatus == "changed" {
                updated.sourceStatus = "changed"
            }
            conversation = updated
            cacheConversation(updated)
            errorMessage = nil
        } catch {
            guard isCurrent(identity) else { return }
            errorMessage = error.localizedDescription
        }
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
        guard let identity = requestIdentity(), identity.conversationID == current.id else { return }
        guard !isConfirmingProjectContext,
              let projectID = current.primaryProjectID
        else { return }
        isConfirmingProjectContext = true
        defer { if isCurrent(identity) { isConfirmingProjectContext = false } }
        do {
            let updated = try await library.reviewResearchProjectContext(
                conversationID: current.id,
                projectID: projectID,
                facts: current.projectContext?.facts ?? []
            )
            guard isCurrent(identity) else { return }
            guard conversation?.id == current.id else { return }
            guard isCurrent(identity) else { return }
            conversation = updated
            cacheConversation(updated)
            await loadHistory(forceNetwork: true)
            guard isCurrent(identity) else { return }
            errorMessage = nil
        } catch {
            guard isCurrent(identity) else { return }
            if let id = identity.conversationID, NativePrivateCachePolicy.requiresInvalidation(after: error) {
                invalidateConversationIfRequired(error, id: id)
                errorMessage = error.localizedDescription
                return
            }
            errorMessage = error.localizedDescription
        }
    }

    private func refreshChangedSources(_ current: ResearchConversation) async {
        guard let identity = requestIdentity(), identity.conversationID == current.id else { return }
        guard !isRefreshingSources else { return }
        isRefreshingSources = true
        defer { if isCurrent(identity) { isRefreshingSources = false } }
        do {
            let updated = try await library.refreshResearchConversation(id: current.id)
            guard isCurrent(identity) else { return }
            guard conversation?.id == current.id else { return }
            guard isCurrent(identity) else { return }
            conversation = updated
            cacheConversation(updated)
            await loadHistory(forceNetwork: true)
            guard isCurrent(identity) else { return }
            errorMessage = nil
        } catch {
            guard isCurrent(identity) else { return }
            if let id = identity.conversationID, NativePrivateCachePolicy.requiresInvalidation(after: error) {
                invalidateConversationIfRequired(error, id: id)
                errorMessage = error.localizedDescription
                return
            }
            errorMessage = error.localizedDescription
        }
    }

    private func openCitation(_ citation: ResearchCitation, sources: [ResearchSource]) {
        let citedSourceIDs = Set(([citation.sourceID].compactMap { $0 }) + (citation.sourceIDs ?? []))
        let matchedSource = sources.first { citedSourceIDs.contains($0.id) }
            ?? citation.sectionID.flatMap { id in sources.first { $0.sectionID == id } }
        let resolvedSectionID = [citation.sectionID, matchedSource?.sectionID]
            .compactMap { $0 }
            .compactMap(Int64.init)
            .first
        if let resolvedSectionID {
            citationRequest = CitationRequest(route: SearchReaderRoute(sectionID: resolvedSectionID, sourceVersion: citation.codeVersion))
            return
        }
        let sectionNumber = citation.sectionNumber ?? matchedSource?.sectionNumber
        if citation.codeVersion == nil || citation.codeVersion.map(UserContentSyncCodeVersion.server) == library.selectedVersion.map({ UserContentSyncCodeVersion.server($0.codeVersion) }),
           let sectionNumber,
           let summary = library.sectionSummary(sectionNumber: sectionNumber) {
            citationRequest = CitationRequest(route: SearchReaderRoute(sectionID: summary.id, sourceVersion: citation.codeVersion))
            return
        }
        errorMessage = "The cited provision is not available in the installed code library."
    }

    private func prepareCitationPreview(_ request: CitationRequest) async {
        defer {
            if citationRequest?.id == request.id { citationRequest = nil }
        }
        guard isCurrentOwner, let context = library.captureCodeSourceNavigationContext() else { return }
        func isCurrentRequest() -> Bool {
            !Task.isCancelled && isCurrentOwner && citationRequest?.id == request.id &&
                library.captureCodeSourceNavigationContext() == context
        }
        do {
            let preview = try await library.prepareResearchCitation(request.route)
            guard isCurrentRequest() else { return }
            preview.library.synchronizeIndependentReaderSession(from: library)
            citationPreview = preview
        } catch PreparedSearchReaderDestination.PreparationError.requiresEnable(let target) {
            guard isCurrentRequest() else { return }
            citationSourcePrompt = CitationSourcePrompt(route: request.route, target: target, context: context)
        } catch is CancellationError {
        } catch {
            if isCurrentRequest() { errorMessage = error.localizedDescription }
        }
    }

    private func clearCitationPreview() {
        citationRequest = nil
        citationSourcePrompt = nil
        citationPreview = nil
    }

    private func evidenceSummary(_ sources: [ResearchSource]) -> some View {
        let selected = sources.filter { $0.kind == "selection" }
        let figureCount = selected.reduce(0) { $0 + ($1.attachedFigureCount ?? 0) }
        let referenceCount = selected.filter { $0.selectionMode == "section_reference" }.count
        let passageCount = selected.count - referenceCount
        let title = [
            passageCount > 0 ? "\(passageCount) selected passage\(passageCount == 1 ? "" : "s")" : nil,
            referenceCount > 0 ? "\(referenceCount) code reference\(referenceCount == 1 ? "" : "s")" : nil,
            figureCount > 0 ? "\(figureCount) figure\(figureCount == 1 ? "" : "s")" : nil
        ].compactMap { $0 }.joined(separator: " · ")
        return DisclosureGroup {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(selected) { source in
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
                        if let notice = source.visualEvidenceNotice {
                            Text(notice)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .padding(.top, 8)
        } label: {
            Label(title, systemImage: "text.quote")
                .font(.subheadline.weight(.semibold))
        }
        .padding(12)
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
        .accessibilityIdentifier("research-selected-evidence")
    }

    @ViewBuilder
    private func messageView(
        _ message: ResearchMessage,
        sources: [ResearchSource],
        onDetailsExpanded: @escaping () -> Void
    ) -> some View {
        if let attempt = ResearchQuestionAttempt.serverFailure(message, messages: conversation?.messages ?? []) {
            VStack(alignment: .leading, spacing: 8) {
                failedQuestionView(attempt)
                statusMessage(attempt.recoveryMessage)
                if library.researchTurnAllowance?.purchaseRequired == true {
                    researchTurnRecoveryView
                }
            }
        } else if message.role == "user", let question = message.question {
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
                onReportProblem: { pendingFeedbackReport = PendingResearchFeedbackReport(messageID: message.id) },
                onAddToNotebook: {
                    guard isCurrentOwner, let current = conversation,
                          let index = current.messages.firstIndex(where: { $0.id == message.id }) else { return }
                    let question = current.messages[..<index].last(where: { $0.role == "user" })?.question
                        ?? current.title
                    pendingNotebookHandoff = ResearchNotebookHandoff(
                        id: message.id, question: question, projectID: current.primaryProjectID
                    )
                },
                notebookActionID: "research-add-to-notebook-\(message.id)",
                detailsScrollID: "answer-details:\(message.id)",
                onDetailsExpanded: onDetailsExpanded,
                onReply: { fact in
                    guard let conversation, let index = conversation.messages.firstIndex(where: { $0.id == message.id }) else { return }
                    factResponse = ""
                    factReply = FactReply(fact: fact, originalQuestion: conversation.messages[..<index].last(where: { $0.role == "user" })?.question ?? "")
                }
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
                Text("per codes is researching…")
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
                .disabled(pendingQuestionAttempt != nil || researchSendIsBlocked)
            }
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
    }

    private var researchTurnRecoveryView: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Assistant turns")
                .font(.subheadline.weight(.semibold))
            Text(library.researchTurnAllowanceSummary)
                .font(.headline)

            if library.availableResearchTurnPacks.isEmpty {
                Text("Additional Assistant turns are temporarily unavailable. Your question is still here. Try again later.")
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
                Text("Need more Assistant turns? Additional turns do not expire and are used after the monthly included turns.")
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
        guard let projectID,
              !projectID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { return "Project Unassigned" }
        return library.folder(forBackendProjectID: projectID)?.name ?? "Project Unassigned"
    }

    private func researchTitle(for summary: ResearchConversationSummary) -> String {
        let title = summary.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if ["manual", "summary"].contains(summary.titleSource ?? ""), !title.isEmpty { return title }
        let legacyPlaceholder = summary.titleSource == "default" && title == "New Research"
        let automaticTitle = title.isEmpty || legacyPlaceholder
            || title.range(of: #"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\s*·"#, options: .regularExpression) != nil
        if !automaticTitle { return title }
        if let question = summary.starterQuestion?.trimmingCharacters(in: .whitespacesAndNewlines), !question.isEmpty { return question }
        if summary.messageCount == 0 { return summary.sourceCount > 0 ? "Draft with selected evidence" : "Assistant draft" }
        return title.isEmpty || legacyPlaceholder ? "Assistant conversation" : title
    }

    private func requestDeletion(id: String) {
        guard deletingConversationID == nil else { return }
        pendingDeletion = PendingResearchDeletion(conversationIDs: [id])
    }

    private func requestSelectedDeletion() {
        guard !isDeletingHistoryBatch, deletingConversationID == nil else { return }
        let ids = selectedVisibleHistory.map(\.id)
        guard !ids.isEmpty else { return }
        pendingDeletion = PendingResearchDeletion(conversationIDs: ids)
    }

    private func finishSelectingHistory() {
        guard isSelectingHistory else { return }
        ListSelectionMotion.run(reduceMotion: reduceMotion) {
            isSelectingHistory = false
            selectedHistoryIDs = []
        }
    }

    private var isLoading: Bool { isLoadingHistory || isLoadingConversation }

    private var isCurrentOwner: Bool {
        owner != nil && owner == library.privateRequestIdentity &&
            (projectFolderID == nil ||
             (library.openProjectID == projectFolderID && library.activeBackendProjectID == scopedProjectID &&
              library.projectWorkspaceSessionID == projectSessionID))
    }

    private func acceptsConversation(_ value: ResearchConversation) -> Bool {
        projectFolderID == nil || value.primaryProjectID == scopedProjectID
    }

    private func returnToProjectHistory() {
        conversation = nil
        question = ""
        library.activeResearchConversationID = nil
        library.researchHistoryIsPresented = true
    }

    private func requestIdentity() -> NativeResearchRequestIdentity? {
        guard isCurrentOwner else { return nil }
        return library.researchRequestIdentity
    }

    private func isCurrent(_ identity: NativeResearchRequestIdentity) -> Bool {
        isCurrentOwner && identity == library.researchRequestIdentity
    }

    private func invalidateConversationIfRequired(_ error: Error, id: String) {
        guard NativePrivateCachePolicy.requiresInvalidation(after: error), let owner, isCurrentOwner else { return }
        try? ResearchConversationCacheLifecycle.invalidateServerCopy(cache: cache, accountID: owner.accountID, conversationID: id, error: error)
        if let status = (error as? PermitextBackendHTTPError)?.statusCode, [401, 403].contains(status) {
            invalidateHistoryCache(accountID: owner.accountID)
        } else {
            removeHistoryConversation(id: id, accountID: owner.accountID)
        }
        if conversation?.id == id { conversation = nil }
        failedQuestionAttempt = nil
        pendingQuestionAttempt = nil
        question = ""
        questionErrorMessage = nil
    }

    private func loadHistory(forceNetwork: Bool = false, allowDuringDeletion: Bool = false) async {
        guard isCurrentOwner, let owner, !isDeletingHistoryBatch || allowDuringDeletion else { return }
        let loadID = UUID()
        let filterKey = historyFilterKey
        historyLoadID = loadID
        isLoadingHistory = true
        isLoadingMoreHistory = false
        historyNextCursor = nil
        historyHasMore = false
        historyLegacySummaries = nil
        if historyLoadedFilterKey != filterKey { summaries = [] }
        defer {
            if isCurrentOwner && historyLoadID == loadID {
                isLoadingHistory = false
                let visibleIDs = Set(summaries.map(\.id))
                historyPreviews = historyPreviews.filter { visibleIDs.contains($0.key) }
                historyPreviewRevisions = historyPreviewRevisions.filter { visibleIDs.contains($0.key) }
            }
        }
        if !forceNetwork, let cached = try? cache.load(
            [ResearchConversationSummary].self, accountID: owner.accountID,
            projectID: "all-research", scope: "research-history"
        ) {
            let cachedMatches = NativeResearchHistory.filtered(cached.value, query: "", projectID: historyProjectID)
            summaries = Array(cachedMatches.prefix(NativeResearchHistory.pageSize))
            historyLegacySummaries = cachedMatches
            historyHasMore = cachedMatches.count > summaries.count
            historyLoadedFilterKey = filterKey
        }
        do {
            let page = try await library.researchConversationPage(limit: NativeResearchHistory.pageSize, cursor: nil, query: "", projectID: historyProjectID)
            guard isCurrentOwner, historyLoadID == loadID, historyFilterKey == filterKey, !Task.isCancelled else { return }
            let loaded = NativeResearchHistory.filtered(page.conversations, query: "", projectID: historyProjectID)
            if page.hasMore == nil {
                // Older servers return the full list; keep filtering and paging
                // useful locally until the matching backend is deployed.
                historyLegacySummaries = loaded
                summaries = Array(loaded.prefix(NativeResearchHistory.pageSize))
                historyHasMore = loaded.count > summaries.count
                cacheHistory(loaded, accountID: owner.accountID, replacingAll: true)
            } else {
                historyLegacySummaries = nil
                summaries = loaded
                historyNextCursor = page.nextCursor
                historyHasMore = page.hasMore == true && page.nextCursor != nil
                cacheHistory(loaded, accountID: owner.accountID, replacingAll: page.hasMore == false)
            }
            historyLoadedFilterKey = filterKey
            historyErrorMessage = nil
        } catch {
            guard isCurrentOwner, historyLoadID == loadID, historyFilterKey == filterKey, !Task.isCancelled else { return }
            if !NativePrivateCachePolicy.permitsOfflineFallback(after: error) {
                summaries = []
                historyLegacySummaries = nil
                historyHasMore = false
            }
            if NativePrivateCachePolicy.requiresInvalidation(after: error) {
                invalidateHistoryCache(accountID: owner.accountID)
            }
            historyErrorMessage = summaries.isEmpty ? error.localizedDescription : "Showing saved Assistant history. Could not refresh: \(error.localizedDescription)"
        }
    }

    private func loadMoreHistory() async {
        guard isCurrentOwner, !isDeletingHistoryBatch, let owner, let loadID = historyLoadID,
              historyHasMore, !isLoadingHistory, !isLoadingMoreHistory,
              historyLoadedFilterKey == historyFilterKey else { return }
        if let legacy = historyLegacySummaries {
            summaries = Array(legacy.prefix(summaries.count + NativeResearchHistory.pageSize))
            historyHasMore = legacy.count > summaries.count
            cacheHistory(summaries, accountID: owner.accountID)
            return
        }
        guard let cursor = historyNextCursor else { return }
        let filterKey = historyFilterKey
        isLoadingMoreHistory = true
        defer { if historyLoadID == loadID { isLoadingMoreHistory = false } }
        do {
            let page = try await library.researchConversationPage(limit: NativeResearchHistory.pageSize, cursor: cursor, query: "", projectID: historyProjectID)
            guard isCurrentOwner, historyLoadID == loadID, historyFilterKey == filterKey, !Task.isCancelled else { return }
            summaries = NativeResearchHistory.appending(page.conversations, to: summaries)
            historyNextCursor = page.nextCursor
            historyHasMore = page.hasMore == true && page.nextCursor != nil && page.nextCursor != cursor
            cacheHistory(summaries, accountID: owner.accountID, replacingAll: page.hasMore == false)
            historyErrorMessage = nil
        } catch {
            guard isCurrentOwner, historyLoadID == loadID, historyFilterKey == filterKey, !Task.isCancelled else { return }
            if NativePrivateCachePolicy.requiresInvalidation(after: error) {
                invalidateHistoryCache(accountID: owner.accountID)
            }
            historyErrorMessage = summaries.isEmpty ? error.localizedDescription
                : "Could not load older conversations. Your current results are still here. \(error.localizedDescription)"
        }
    }

    private func refreshFromWeb() async {
        guard let identity = requestIdentity() else { return }
        async let allowance: Void = library.refreshResearchTurnAllowance(showsErrors: false)
        async let history: Void = loadHistory(forceNetwork: true)
        if let id = identity.conversationID, isCurrent(identity) {
            await loadConversation(id: id, identity: identity, useCache: false)
        }
        await allowance
        await history
    }

    private func openActiveConversationIfNeeded() async {
        guard let identity = requestIdentity(), let id = identity.conversationID,
              conversation?.id != id else { return }
        failedQuestionAttempt = nil
        questionErrorMessage = nil
        conversation = nil
        await loadConversation(id: id, identity: identity, useCache: true)
    }

    private func loadConversation(id: String, identity: NativeResearchRequestIdentity, useCache: Bool) async {
        guard isCurrent(identity), !Task.isCancelled else { return }
        let loadID = UUID()
        conversationLoadID = loadID
        let publicationID = conversationPublicationID
        isLoadingConversation = true
        defer { if isCurrent(identity), conversationLoadID == loadID { isLoadingConversation = false } }
        if useCache {
            let cached = try? await ProjectHubOfflineCacheWorker.shared.load(
                ResearchConversation.self, from: cache, accountID: identity.account.accountID,
                projectID: id, scope: ResearchConversationCacheLifecycle.conversationScope
            )
            guard isCurrent(identity), !Task.isCancelled,
                  conversationLoadID == loadID, conversationPublicationID == publicationID else { return }
            if let cached, acceptsConversation(cached.value) { conversation = cached.value }
        }
        // Restore local edits before publishing a cached conversation's composer.
        // A slow refresh must not expose an empty, editable field over a saved draft.
        if question.isEmpty, let saved = try? ResearchComposerDraftCache.load(
            cache: cache, accountID: identity.account.accountID, conversationID: id
        ) { question = saved }
        var loadedAuthoritativeConversation = false
        do {
            let loaded = try await library.researchConversation(id: id)
            guard isCurrent(identity), !Task.isCancelled,
                  conversationLoadID == loadID, conversationPublicationID == publicationID else { return }
            guard acceptsConversation(loaded) else {
                returnToProjectHistory()
                return
            }
            conversation = loaded
            loadedAuthoritativeConversation = true
            cacheConversation(loaded)
            errorMessage = nil
        } catch {
            guard isCurrent(identity), !Task.isCancelled,
                  conversationLoadID == loadID, conversationPublicationID == publicationID else { return }
            invalidateConversationIfRequired(error, id: id)
            if let backendError = error as? PermitextBackendHTTPError,
               [404, 410].contains(backendError.statusCode ?? 0) {
                // A removed conversation returns quietly to the current history.
                errorMessage = nil
                library.activeResearchConversationID = nil
                isLoadingConversation = false
                return
            }
            if !NativePrivateCachePolicy.permitsOfflineFallback(after: error) { conversation = nil }
            errorMessage = conversation == nil ? error.localizedDescription : "Showing a saved conversation. Could not refresh: \(error.localizedDescription)"
        }
        guard isCurrent(identity) else { return }
        if let current = conversation {
            if question.isEmpty, let saved = try? ResearchComposerDraftCache.load(
                cache: cache, accountID: identity.account.accountID, conversationID: current.id
            ) { question = saved }
            restoreCachedQuestionAttempt(for: current, accountID: identity.account.accountID)
            if loadedAuthoritativeConversation, pendingQuestionAttempt == nil,
               let cached = try? cache.load(ResearchQuestionAttempt.self, accountID: identity.account.accountID, projectID: current.id, scope: ResearchQuestionAttempt.cacheScope)?.value,
               cached.shouldRetainOnServer(current),
               !retainingInterruptedIdentities.contains(identity) {
                retainingInterruptedIdentities.append(identity)
                Task {
                    defer { retainingInterruptedIdentities.removeAll { $0 == identity } }
                    do {
                        let recovered = try await library.retainInterruptedResearch(conversationID: current.id, attempt: cached, contextRevision: current.contextRevision ?? 0)
                        guard isCurrent(identity), pendingQuestionAttempt == nil,
                              conversation?.id == current.id, conversation?.updatedAt == current.updatedAt else { return }
                        conversation = recovered
                        cacheConversation(recovered)
                        restoreCachedQuestionAttempt(for: recovered, accountID: identity.account.accountID)
                    } catch {
                        guard isCurrent(identity) else { return }
                        invalidateConversationIfRequired(error, id: current.id)
                        if !NativePrivateCachePolicy.permitsOfflineFallback(after: error) {
                            conversation = nil
                            errorMessage = error.localizedDescription
                        }
                        // Recoverable metadata failures preserve the local attempt
                        // and draft; a later reopening can retry the migration.
                    }
                }
            }
        }
    }

    private func consumePendingSelectionIfNeeded() async {
        guard var identity = requestIdentity() else { return }
        guard library.signedInAccount != nil,
              library.hasResearchAccess,
              !isConsumingPendingSelection,
              pendingVisualReview == nil
        else { return }
        isConsumingPendingSelection = true
        defer { isConsumingPendingSelection = false }

        while !library.pendingResearchSelections.isEmpty {
            guard isCurrentOwner, !Task.isCancelled else { return }
            if isCreatingConversation {
                try? await Task.sleep(for: .milliseconds(150))
                continue
            }
            let originalSelection = library.pendingResearchSelections[0]
            if originalSelection.selectionMode == "section_reference" {
                let references = Array(library.pendingResearchSelections.prefix { $0.selectionMode == "section_reference" })
                guard await persistResearchSelections(references), isCurrentOwner, !Task.isCancelled else { return }
                identity = library.researchRequestIdentity ?? identity
                library.acknowledgePendingResearchSelections(references)
                continue
            }
            do {
                let review = try await library.reviewResearchSelection(originalSelection)
                guard isCurrent(identity) else { return }
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
                guard isCurrentOwner, !Task.isCancelled else { return }
                identity = library.researchRequestIdentity ?? identity
                library.acknowledgePendingResearchSelections([originalSelection])
            } catch {
                guard isCurrent(identity) else { return }
                errorMessage = error.localizedDescription
                return
            }
        }
        if let prompt = library.takeResearchPrompt(), question.isEmpty { question = prompt }
    }

    private func persistResearchSelections(_ selections: [ResearchSelectionRequest]) async -> Bool {
        guard let identity = requestIdentity() else { return false }
        if let id = library.activeResearchConversationID {
            do {
                let updated = try await library.addResearchEvidence(
                    conversationID: id,
                    selections: selections
                )
                guard isCurrent(identity) else { return false }
                conversation = updated
                cacheConversation(updated)
                await loadHistory(forceNetwork: true)
                guard isCurrent(identity) else { return false }
                errorMessage = nil
                return true
            } catch {
                guard isCurrent(identity) else { return false }
                errorMessage = error.localizedDescription
                return false
            }
        }
        return await createConversation(selections: selections)
    }

    private func cancelVisualReview(_ pending: PendingResearchVisualReview) {
        guard isCurrentOwner else { return }
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
        guard isCurrentOwner else { return }
        guard pendingVisualReview?.id == pending.id, !sourceIDs.isEmpty else { return }
        var selection = pending.review.selection
        selection.savedItemID = pending.originalSelection.savedItemID
        selection.visualSourceIDs = sourceIDs
        selection.visualReviewConfirmed = true
        guard await persistResearchSelections([selection]) else {
            pendingVisualReview = nil
            return
        }
        guard isCurrentOwner, !Task.isCancelled else { return }
        library.acknowledgePendingResearchSelections([pending.originalSelection])
        pendingVisualReview = nil
        await consumePendingSelectionIfNeeded()
    }

    @discardableResult
    private func createConversation(selections: [ResearchSelectionRequest]) async -> Bool {
        guard var identity = requestIdentity() else { return false }
        guard !isCreatingConversation else { return false }
        isCreatingConversation = true
        defer { isCreatingConversation = false }
        do {
            let created = try await library.createResearchConversation(
                selections: selections,
                projectID: scopedProjectID ?? library.activeBackendProjectID
            )
            guard isCurrent(identity) else { return false }
            guard acceptsConversation(created) else {
                returnToProjectHistory()
                return false
            }
            newConversationZoomID = selections.isEmpty ? created.id : nil
            conversation = created
            library.researchHistoryIsPresented = false
            library.activeResearchConversationID = created.id
            identity = library.researchRequestIdentity ?? identity
            failedQuestionAttempt = nil
            questionErrorMessage = nil
            cacheConversation(created)
            await loadHistory(forceNetwork: true)
            guard isCurrent(identity) else { return false }
            errorMessage = nil
            if selections.isEmpty, !library.pendingResearchSelections.isEmpty {
                Task {
                    try? await Task.sleep(for: .milliseconds(250))
                    await consumePendingSelectionIfNeeded()
                }
            }
            return true
        } catch {
            guard isCurrent(identity) else { return false }
            errorMessage = error.localizedDescription
            return false
        }
    }

    private func startQuestionRequest() {
        guard isCurrentOwner else { return }
        let normalized = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard normalized.count >= 3 else { return }
        let attempt = ResearchQuestionAttempt(id: UUID().uuidString, question: normalized, contextRevision: conversation?.contextRevision ?? 0, startedAt: ISO8601DateFormatter().string(from: Date()))
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

    private func saveFeedback(messageID: String, category: String, comment: String?, usefulness: String? = nil, outsideChecking: String? = nil, supportingReference: String? = nil) async {
        guard let identity = requestIdentity(), identity.conversationID == conversation?.id else { return }
        guard let conversationID = conversation?.id, feedbackMessageID == nil else { return }
        feedbackMessageID = messageID
        defer { if isCurrent(identity) { feedbackMessageID = nil } }
        do {
            let saved = try await library.saveResearchFeedback(
                conversationID: conversationID,
                answerID: messageID,
                category: category,
                comment: comment?.trimmingCharacters(in: .whitespacesAndNewlines),
                usefulness: usefulness,
                outsideChecking: outsideChecking,
                supportingReference: supportingReference
            )
            guard isCurrent(identity) else { return }
            guard conversation?.id == conversationID,
                  let index = conversation?.messages.firstIndex(where: { $0.id == messageID })
            else { return }
            conversation?.messages[index].feedback = saved
            if let updated = conversation { cacheConversation(updated) }
            errorMessage = nil
        } catch {
            guard isCurrent(identity) else { return }
            if let id = identity.conversationID, NativePrivateCachePolicy.requiresInvalidation(after: error) {
                invalidateConversationIfRequired(error, id: id)
                errorMessage = error.localizedDescription
                return
            }
            errorMessage = error.localizedDescription
        }
    }

    private func startQuestionRequest(_ attempt: ResearchQuestionAttempt) {
        guard isCurrentOwner, !researchSendIsBlocked else { return }
        guard activeResearchRequestTask == nil else { return }
        activeResearchRequestTask = Task {
            await sendQuestion(attempt)
        }
    }

    private func cancelActiveResearchRequest() {
        activeResearchRequestTask?.cancel()
    }

    private func sendQuestion(_ attempt: ResearchQuestionAttempt) async {
        guard let identity = requestIdentity(), identity.conversationID == conversation?.id else { return }
        guard let id = conversation?.id, !isSending, !researchSendIsBlocked else {
            activeResearchRequestTask = nil
            return
        }
        let attempt = attempt.retryAttempt
        let messageIDsBeforeRequest = Set(conversation?.messages.map(\.id) ?? [])
        cacheQuestionAttempt(attempt, conversationID: id)
        // Clear only the composer text transferred to the recoverable attempt.
        if let saved = try? ResearchComposerDraftCache.load(cache: cache, accountID: identity.account.accountID, conversationID: id),
           saved.trimmingCharacters(in: .whitespacesAndNewlines) == attempt.question,
           (try? cache.load(ResearchQuestionAttempt.self, accountID: identity.account.accountID,
                            projectID: id, scope: ResearchQuestionAttempt.cacheScope))?.value.id == attempt.id {
            try? ResearchComposerDraftCache.save("", cache: cache, accountID: identity.account.accountID, conversationID: id)
        }
        isSending = true
        pendingQuestionAttempt = attempt
        failedQuestionAttempt = nil
        errorMessage = nil
        questionErrorMessage = nil
        defer {
            if isCurrent(identity), pendingQuestionAttempt?.id == attempt.id {
                pendingQuestionAttempt = nil
                isSending = false
                activeResearchRequestTask = nil
            }
        }
        do {
            let updated = try await library.sendResearchMessage(
                conversationID: id,
                question: attempt.question,
                requestID: attempt.id,
                expectedRevision: conversation?.revision ?? 0,
                expectedEvidenceSetVersion: conversation?.evidenceSetVersion ?? 1
            )
            try Task.checkCancellation()
            guard isCurrent(identity) else { return }
            conversation = updated
            cacheConversation(updated)
            clearCachedQuestionAttempt(conversationID: id)
            await loadHistory(forceNetwork: true)
            guard isCurrent(identity) else { return }
            errorMessage = nil
            questionErrorMessage = nil
        } catch {
            guard isCurrent(identity) else { return }
            if let id = identity.conversationID, NativePrivateCachePolicy.requiresInvalidation(after: error) {
                invalidateConversationIfRequired(error, id: id)
                errorMessage = error.localizedDescription
                return
            }
            if Task.isCancelled || error is CancellationError || (error as? URLError)?.code == .cancelled {
                retainQuestionFailure(attempt, error: URLError(.cancelled), conversationID: id)
                return
            }
            if let authoritative = ResearchAuthoritativeConversationRecovery.conversation(
                from: error,
                matching: id
            ) {
                guard isCurrent(identity) else { return }
                conversation = authoritative
                cacheConversation(authoritative)
                await loadHistory(forceNetwork: true)
                guard isCurrent(identity) else { return }
                if ResearchRequestReconciliation.containsCompletedRequest(
                    messages: authoritative.messages,
                    requestID: attempt.id,
                    question: attempt.question
                ) {
                    clearCachedQuestionAttempt(conversationID: id)
                    await library.refreshResearchTurnAllowance(showsErrors: false)
                    guard isCurrent(identity) else { return }
                    failedQuestionAttempt = nil
                    questionErrorMessage = nil
                } else {
                    retainQuestionFailure(attempt, error: error, conversationID: id)
                }
                return
            }
            guard ResearchRequestFailurePresentation.shouldReconcileCompletion(after: error) else {
                retainQuestionFailure(attempt, error: error, conversationID: id)
                await library.refreshResearchTurnAllowance(showsErrors: false)
                guard isCurrent(identity) else { return }
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
                guard isCurrent(identity) else { return }
                conversation = authoritative
                cacheConversation(authoritative)
                clearCachedQuestionAttempt(conversationID: id)
                await loadHistory(forceNetwork: true)
                guard isCurrent(identity) else { return }
                await library.refreshResearchTurnAllowance(showsErrors: false)
                guard isCurrent(identity) else { return }
                errorMessage = nil
                questionErrorMessage = nil
            } else {
                guard isCurrent(identity) else { return }
                retainQuestionFailure(attempt, error: error, conversationID: id)
            }
        }
    }

    private func completedConversationAfterLostResponse(
        conversationID: String,
        attempt: ResearchQuestionAttempt,
        priorMessageIDs: Set<String>
    ) async -> ResearchConversation? {
        guard let identity = requestIdentity() else { return nil }
        for delay in [0, 2, 4, 6] {
            guard isCurrent(identity) else { return nil }
            if delay > 0 {
                do {
                    try await Task.sleep(for: .seconds(delay))
                } catch is CancellationError {
                    return nil
                } catch {
                    guard isCurrent(identity) else { return nil }
                    return nil
                }
            }
            guard isCurrent(identity) else { return nil }
            guard let authoritative = try? await library.researchConversation(id: conversationID) else {
                continue
            }
            guard isCurrent(identity) else { return nil }
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

    private func pinConversation(id: String, isPinned: Bool) async {
        guard isCurrentOwner, !isUpdatingPin, !isSending else { return }
        isUpdatingPin = true
        defer { if isCurrentOwner { isUpdatingPin = false } }
        do {
            let updated = try await library.pinResearchConversation(id: id, isPinned: isPinned)
            guard isCurrentOwner else { return }
            if conversation?.id == id { conversation = updated }
            cacheConversation(updated)
            await loadHistory(forceNetwork: true)
        } catch {
            guard isCurrentOwner else { return }
            errorMessage = error.localizedDescription
        }
    }

    private func renameConversation() async {
        guard isCurrentOwner, let id = renameConversationID else { return }
        let title = draftTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        do {
            let updated = try await library.renameResearchConversation(id: id, title: title)
            guard isCurrentOwner, renameConversationID == id else { return }
            if conversation?.id == id { conversation = updated }
            cacheConversation(updated)
            await loadHistory(forceNetwork: true)
            guard isCurrentOwner else { return }
            renameConversationID = nil
        } catch {
            guard isCurrentOwner, renameConversationID == id else { return }
            errorMessage = error.localizedDescription
        }
    }

    private func requestAssignment(_ projectID: String?) {
        guard projectFolderID == nil else { return }
        guard projectID != conversation?.primaryProjectID else { return }
        if conversation?.primaryProjectID != nil {
            pendingAssignmentProjectID = projectID
            showingAssignmentConfirmation = true
        } else {
            Task { await assignConversation(projectID: projectID, confirmed: false) }
        }
    }

    private func assignConversation(projectID: String?, confirmed: Bool) async {
        guard projectFolderID == nil else { return }
        guard let identity = requestIdentity(), identity.conversationID == conversation?.id else { return }
        guard let id = conversation?.id else { return }
        do {
            let updated = try await library.assignResearchConversation(
                id: id,
                projectID: projectID,
                confirmMove: confirmed
            )
            guard isCurrent(identity) else { return }
            conversation = updated
            cacheConversation(updated)
            await loadHistory(forceNetwork: true)
            guard isCurrent(identity) else { return }
        } catch {
            guard isCurrent(identity) else { return }
            if let id = identity.conversationID, NativePrivateCachePolicy.requiresInvalidation(after: error) {
                invalidateConversationIfRequired(error, id: id)
                errorMessage = error.localizedDescription
                return
            }
            errorMessage = error.localizedDescription
        }
    }

    private func deleteConversation(id: String) async {
        guard let identity = requestIdentity(), deletingConversationID == nil else { return }
        deletingConversationID = id
        defer { if isCurrentOwner && deletingConversationID == id { deletingConversationID = nil } }

        let destinationConversationID = ResearchConversationDeletionRoute.destinationConversationID(
            activeConversationID: library.activeResearchConversationID,
            deletingConversationID: id
        )
        if destinationConversationID != library.activeResearchConversationID {
            // Leave the detail route immediately. Any in-flight load for the deleted
            // conversation is invalidated when the active conversation changes, so a
            // late response cannot repaint the detail screen with an error state.
            conversation = nil
            failedQuestionAttempt = nil
            pendingQuestionAttempt = nil
            questionErrorMessage = nil
            library.activeResearchConversationID = destinationConversationID
        }

        do {
            try await library.deleteResearchConversation(id: id)
            guard isCurrentOwner else { return }
            try? ResearchConversationCacheLifecycle.removeDeletedConversation(
                cache: cache, accountID: identity.account.accountID, conversationID: id
            )
            removeHistoryConversation(id: id, accountID: identity.account.accountID)
            if library.activeResearchConversationID == id { library.activeResearchConversationID = nil }
            await loadHistory(forceNetwork: true)
        } catch {
            guard isCurrentOwner else { return }
            await loadHistory(forceNetwork: true)
            guard isCurrentOwner else { return }
            errorMessage = "Couldn’t delete that conversation. Try again."
        }
    }

    private func deleteSelectedConversations(ids: [String]) async {
        guard isCurrentOwner, let owner, !isDeletingHistoryBatch, deletingConversationID == nil else { return }
        isDeletingHistoryBatch = true
        defer { isDeletingHistoryBatch = false }
        // A list refresh started before deletion must not restore deleted rows.
        historyLoadID = nil
        isLoadingHistory = false
        isLoadingMoreHistory = false
        let result = await ResearchDeletionBatch.run(
            conversationIDs: ids,
            canContinue: { isCurrentOwner },
            delete: { id in try await library.deleteResearchConversation(id: id) },
            didDelete: { id in
                try? ResearchConversationCacheLifecycle.removeDeletedConversation(
                    cache: cache, accountID: owner.accountID, conversationID: id
                )
                selectedHistoryIDs.remove(id)
                removeHistoryConversation(id: id, accountID: owner.accountID)
            }
        )
        guard isCurrentOwner, !Task.isCancelled else { return }
        await loadHistory(forceNetwork: true, allowDuringDeletion: true)
        guard isCurrentOwner else { return }
        selectedHistoryIDs.formIntersection(Set(summaries.map(\.id)))
        if result.failedIDs.isEmpty {
            finishSelectingHistory()
        } else {
            errorMessage = "Deleted \(result.deletedIDs.count) of \(ids.count) conversations. \(result.failedIDs.count) couldn’t be deleted and remain selected. Try again."
        }
    }

    private func cacheHistory(_ history: [ResearchConversationSummary], accountID: String, replacingAll: Bool = false) {
        guard isCurrentOwner, owner?.accountID == accountID,
              historyProjectID == nil || projectFolderID != nil else { return }
        let existing = (try? cache.load(
            [ResearchConversationSummary].self, accountID: accountID,
            projectID: "all-research", scope: "research-history"
        ))?.value ?? []
        // A first page is not a complete account snapshot. Keep older offline
        // rows until a complete list or an explicit deletion supersedes them.
        let retained: [ResearchConversationSummary]
        if let scopedProjectID {
            retained = NativeResearchHistory.mergingProjectPage(history, into: existing,
                projectID: scopedProjectID,
                replacingProject: replacingAll)
        } else {
            retained = replacingAll ? history : NativeResearchHistory.appending(existing, to: history)
        }
        try? cache.store(
            retained,
            accountID: accountID,
            projectID: "all-research",
            scope: "research-history"
        )
    }

    private func removeHistoryConversation(id: String, accountID: String) {
        guard isCurrentOwner, owner?.accountID == accountID else { return }
        historyLoadID = UUID()
        isLoadingHistory = false
        isLoadingMoreHistory = false
        summaries.removeAll { $0.id == id }
        selectedHistoryIDs.remove(id)
        historyLegacySummaries?.removeAll { $0.id == id }
        historyPreviews.removeValue(forKey: id)
        historyPreviewRevisions.removeValue(forKey: id)
        if let legacy = historyLegacySummaries { historyHasMore = legacy.count > summaries.count }
        // Deletion must update the account cache even while a Project/search
        // filter is active; saving the visible subset would discard other rows.
        if let cached = try? cache.load(
            [ResearchConversationSummary].self, accountID: accountID,
            projectID: "all-research", scope: "research-history"
        ) {
            try? cache.store(cached.value.filter { $0.id != id }, accountID: accountID,
                             projectID: "all-research", scope: "research-history")
        }
    }

    private func invalidateHistoryCache(accountID: String) {
        guard isCurrentOwner, owner?.accountID == accountID else { return }
        historyLoadID = UUID()
        isLoadingHistory = false
        isLoadingMoreHistory = false
        summaries = []
        historyLegacySummaries = nil
        historyNextCursor = nil
        historyHasMore = false
        historyLoadedFilterKey = nil
        historyPreviews = [:]
        historyPreviewRevisions = [:]
        try? cache.remove(accountID: accountID, projectID: "all-research", scope: "research-history")
    }

    private func cacheConversation(_ conversation: ResearchConversation) {
        guard isCurrentOwner, let owner else { return }
        guard acceptsConversation(conversation) else {
            returnToProjectHistory()
            return
        }
        // Every accepted mutation invalidates reads begun before its publication.
        // Account/conversation identity alone cannot detect an older same-route GET.
        conversationPublicationID = UUID()
        historyPreviewRevisions.removeValue(forKey: conversation.id)
        try? ResearchConversationCacheLifecycle.store(
            conversation,
            cache: cache,
            accountID: owner.accountID,
            conversationID: conversation.id
        )
    }

    private func retainQuestionFailure(_ attempt: ResearchQuestionAttempt, error: Error, conversationID: String) {
        let failed = attempt.recordingFailure(error)
        cacheQuestionAttempt(failed, conversationID: conversationID)
        failedQuestionAttempt = failed
        questionErrorMessage = failed.recoveryMessage
    }

    private func persistComposerDraft(_ text: String) {
        guard isCurrentOwner, let owner, let id = conversation?.id,
              id == library.activeResearchConversationID else { return }
        let failureMessage = "This draft could not be saved on this device. Keep Assistant open and try editing again."
        do {
            try ResearchComposerDraftCache.save(text, cache: cache, accountID: owner.accountID, conversationID: id)
            if questionErrorMessage == failureMessage { questionErrorMessage = nil }
        } catch {
            questionErrorMessage = failureMessage
        }
    }

    private func cacheQuestionAttempt(_ attempt: ResearchQuestionAttempt, conversationID: String) {
        guard isCurrentOwner, let owner else { return }
        try? cache.store(
            attempt,
            accountID: owner.accountID,
            projectID: conversationID,
            scope: ResearchQuestionAttempt.cacheScope
        )
    }

    private func clearCachedQuestionAttempt(conversationID: String) {
        guard isCurrentOwner, let owner else { return }
        try? cache.remove(
            accountID: owner.accountID,
            projectID: conversationID,
            scope: ResearchQuestionAttempt.cacheScope
        )
    }

    private func restoreCachedQuestionAttempt(
        for conversation: ResearchConversation,
        accountID: String
    ) {
        guard pendingQuestionAttempt == nil else { return }
        let saved = try? cache.load(ResearchQuestionAttempt.self, accountID: accountID,
                                    projectID: conversation.id, scope: ResearchQuestionAttempt.cacheScope)
        let attempt = ResearchQuestionAttempt.recover(messages: conversation.messages, cached: saved?.value)
        if let cached = saved?.value,
           ResearchRequestReconciliation.containsCompletedRequest(messages: conversation.messages, requestID: cached.id, question: cached.question) {
            clearCachedQuestionAttempt(conversationID: conversation.id)
        }
        failedQuestionAttempt = attempt
        questionErrorMessage = attempt?.recoveryMessage

    }
}

private struct ResearchDisclosureAcknowledgementSheet: View {
    let onCancel: () -> Void
    let onContinue: () -> Void

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                Text("Before you use Assistant")
                    .font(.title2.weight(.bold))
                Label("What is sent", systemImage: "arrow.up.doc")
                    .font(.headline)
                Text(ResearchTrustCopy.firstUseDisclosure)
                    .foregroundStyle(.secondary)
                Label("How to rely on it", systemImage: "checkmark.shield")
                    .font(.headline)
                Text("per codes is AI-assisted research, not an official interpretation or professional opinion. Verify cited sources, source status, and Project facts before filing, design, permitting, or construction reliance.")
                    .foregroundStyle(.secondary)
                Link("Read the Privacy Policy", destination: URL(string: "https://per.codes/privacy")!)
                Spacer()
                Button("Continue to Assistant", action: onContinue)
                    .buttonStyle(.borderedProminent)
                    .tint(.blue)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                Button("Cancel", role: .cancel, action: onCancel)
                    .frame(maxWidth: .infinity)
            }
            .padding(20)
            .navigationTitle("Assistant Notice")
            .navigationBarTitleDisplayMode(.inline)
            .interactiveDismissDisabled()
        }
    }
}

private struct ResearchFeedbackSheet: View {
    let onCancel: () -> Void
    let onSubmit: (String, String?, String, String, String) -> Void
    @State private var category = "incorrect_misleading"
    @State private var comment = ""
    @State private var usefulness = ""
    @State private var outsideChecking = ""
    @State private var supportingReference = ""

    init(existingFeedback: ResearchFeedback?, onCancel: @escaping () -> Void, onSubmit: @escaping (String, String?, String, String, String) -> Void) {
        self.onCancel = onCancel
        self.onSubmit = onSubmit
        _category = State(initialValue: existingFeedback?.category ?? "incorrect_misleading")
        _comment = State(initialValue: existingFeedback?.userComment ?? "")
        _usefulness = State(initialValue: existingFeedback?.usefulness ?? "")
        _outsideChecking = State(initialValue: existingFeedback?.outsideChecking ?? "")
        _supportingReference = State(initialValue: existingFeedback?.supportingReference ?? "")
    }

    private let categories = [
        ("helpful", "Helpful"),
        ("too_slow", "Too slow"),
        ("too_verbose", "Too much explanation"),
        ("incorrect_misleading", "Incorrect or misleading"),
        ("missing_information", "Missing important information"),
        ("citation_problem", "Citation problem"),
        ("other", "Other")
    ]

    var body: some View {
        NavigationStack {
            Form {
                Picker("Feedback", selection: $category) {
                    ForEach(categories, id: \.0) { value, label in
                        Text(label).tag(value)
                    }
                }
                Picker("Could you use this answer?", selection: $usefulness) {
                    Text("Not rated").tag("")
                    Text("Yes, as written").tag("usable_as_is")
                    Text("After corrections").tag("needed_correction")
                    Text("No").tag("not_usable")
                }
                Picker("Outside checking required", selection: $outsideChecking) {
                    Text("Not rated").tag("")
                    Text("None").tag("none")
                    Text("Brief checking").tag("brief")
                    Text("Substantial checking").tag("substantial")
                }
                TextField("Supporting section or official source (optional)", text: $supportingReference)
                TextField("Optional details", text: $comment, axis: .vertical)
                    .lineLimit(3...8)
                Text("Reports help per codes investigate and improve Assistant answers. Internal review notes are never shown here.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .navigationTitle("Assistant feedback")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel", action: onCancel) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Submit") {
                        let normalized = comment.trimmingCharacters(in: .whitespacesAndNewlines)
                        onSubmit(category, normalized.isEmpty ? nil : normalized, usefulness, outsideChecking, supportingReference)
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
                        Text("Choose the official images Assistant should analyze with this passage.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text("Select up to \(review.maximumVisualSelections) official images.")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

                    ForEach(review.visualSources) { source in
                        visualSourceButton(source)
                    }

                    Text("per codes will preserve the exact selected image bytes and their integrity identity with the evidence record.")
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
        return "Add passage with \(count) image\(count == 1 ? "" : "s")"
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
        .accessibilityLabel("Assistant answer comparison table")
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

private struct ResearchAnswerFactRow {
    enum Group: String, CaseIterable {
        case building = "Building & code"
        case zoning = "Zoning"
        case custom = "Custom facts"
        case projectContext = "Project context"
    }

    var group: Group = .projectContext
    var title: String?
    var value: String
    var qualification: String?
    var originalWording: String?
    var isProjectNarrative = false

    init(_ text: String, parseProjectFact: Bool = true) {
        value = text
        guard parseProjectFact else { return }

        let narrativePrefix = "Additional Project facts (user wording; not independently verified): "
        if text.hasPrefix(narrativePrefix) {
            value = String(text.dropFirst(narrativePrefix.count))
            qualification = "User wording; not independently verified"
            isProjectNarrative = true
            return
        }

        let projection = text.hasPrefix("Unknown: ") ? String(text.dropFirst("Unknown: ".count)) : text
        let prefixes: [(String, Group)] = [
            ("Building / Code Fact — ", .building), ("Zoning Fact — ", .zoning), ("Custom Fact — ", .custom)
        ]
        guard let (prefix, group) = prefixes.first(where: { projection.hasPrefix($0.0) }) else { return }
        let content = projection.dropFirst(prefix.count)
        let source = content.range(of: " Original user/source wording: ")
        let fact = source.map { content[..<$0.lowerBound] } ?? content
        guard let separator = fact.range(of: ": "),
              let status = fact.range(of: " (", options: .backwards),
              separator.upperBound < status.lowerBound,
              fact.hasSuffix(").") else { return }
        let qualification = fact[status.upperBound...].dropLast(2)
        let knownStatuses = ["user-stated;", "user-confirmed;", "sourced data;", "unknown;", "rejected;"]
        guard knownStatuses.contains(where: { qualification.hasPrefix($0) }) else { return }

        self.group = group
        title = String(fact[..<separator.lowerBound])
        value = String(fact[separator.upperBound..<status.lowerBound])
        self.qualification = String(qualification)
        originalWording = source.map { String(content[$0.upperBound...]) }
    }
}

private struct ResearchAnswerView: View {
    let answer: ResearchAnswer
    let sourceStatus: String
    let feedback: ResearchFeedback?
    let isSavingFeedback: Bool
    let onHelpful: () -> Void
    let onReportProblem: () -> Void
    let onAddToNotebook: () -> Void
    let notebookActionID: String
    let detailsScrollID: String
    let onDetailsExpanded: () -> Void
    let onReply: (String) -> Void
    let onOpenCitation: (ResearchCitation) -> Void
    @State private var didCopy = false
    @State private var showsSourcesAndDetails = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if answer.researchEngine?.hasPrefix("research-v2") != true,
               answer.authorityStatus != "supported_by_enacted_text",
               let authorityLabel = answer.researchAuthorityLabel,
               authorityLabel != "Assistant" {
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
            if !answer.missingFacts.isEmpty {
                Text("Project facts still needed").font(.headline)
                ForEach(Array(answer.missingFacts.enumerated()), id: \.offset) { _, fact in
                    VStack(alignment: .leading) {
                        Text(fact)
                        Button("Reply") { onReply(fact) }.accessibilityLabel("Reply to \(fact)")
                    }
                }
            }
            if let nextQuestion = answer.followUpQuestions.first,
               !nextQuestion.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
               !primaryNarrative.contains(nextQuestion) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("To continue").font(.headline)
                    Text(nextQuestion).textSelection(.enabled)
                    Text("Reply below with what you know. If you’re unsure, say so.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                .accessibilityIdentifier("research-next-question")
            }
            if answer.researchEngine?.hasPrefix("research-v2") == true {
                Text(answer.verification?.pass == true ? "AI reviewed · Check cited text" : "Incomplete")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("research-review-status")
            }
            HStack(spacing: 6) {
                answerAction("Sources & details", systemImage: "doc.text") {
                    let willExpand = !showsSourcesAndDetails
                    withAnimation(.easeInOut(duration: 0.2)) {
                        showsSourcesAndDetails.toggle()
                    }
                    if willExpand {
                        onDetailsExpanded()
                    }
                }
                .accessibilityValue(showsSourcesAndDetails ? "Expanded" : "Collapsed")
                .accessibilityIdentifier("research-answer-details-toggle")
                answerAction(didCopy ? "Copied" : ResearchTrustCopy.copyAnswerAction, systemImage: didCopy ? "checkmark" : "doc.on.doc") {
                    UIPasteboard.general.string = primaryNarrative
                    didCopy = true
                }
                answerAction("Helpful", systemImage: feedback?.category == "helpful" ? "hand.thumbsup.fill" : "hand.thumbsup", action: onHelpful)
                    .accessibilityAddTraits(feedback?.category == "helpful" ? .isSelected : [])
                    .disabled(isSavingFeedback)
                answerAction(ResearchTrustCopy.reportProblemAction, systemImage: "exclamationmark.bubble", action: onReportProblem)
                    .disabled(isSavingFeedback)
                answerAction("Add to Notebook", systemImage: "note.text.badge.plus", action: onAddToNotebook)
                    .accessibilityIdentifier(notebookActionID)
            }
            .foregroundStyle(.secondary)
            .buttonStyle(.plain)
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("research-answer-actions")
            if showsSourcesAndDetails {
                sourcesAndDetails
                    .id(detailsScrollID)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(alignment: .topLeading) {
            Color.clear
                .frame(width: 1, height: 1)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Assistant answer ready")
                .accessibilityIdentifier("research-answer")
                .allowsHitTesting(false)
        }
    }

    private func answerAction(_ title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            ToolbarActionIcon(systemImage: systemImage)
        }
        .accessibilityLabel(title)
    }

    private var sourcesAndDetails: some View {
        VStack(alignment: .leading, spacing: 12) {
            if hasEvidenceDetails {
                Text(answer.researchSourceBoundaryText)
                    .textSelection(.enabled)
                    .accessibilityIdentifier("research-answer-source-boundary")
            }
            answerSection("Limits of this answer", items: answer.evidenceLimitations)
            projectFactsDisclosure
            citedSourcesDisclosure
            if hasReviewDetails {
                detailsDisclosure("Review details") {
                    supportedPointsSection(answer.supportedPoints)
                    answerSection("Assumptions used", items: answer.assumptions)
                    answerSection("Questions that would materially advance this answer", items: answer.followUpQuestions)
                    answerSection("Related evidence to add", items: answer.additionalEvidenceNeeded)
                    supportingSourcesSection
                }
            }
            sourceInformation
            Divider()
            Text(answer.disclaimer ?? "AI-generated research assistance, not an official code determination.")
            Text(ResearchTrustCopy.nextStepGuidance)
                .font(.footnote)
                .accessibilityIdentifier("research-next-step-guidance")
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var primaryNarrative: String {
        answer.narrativeText
    }

    private var hasReviewDetails: Bool {
        !answer.supportedPoints.isEmpty ||
            !answer.assumptions.isEmpty ||
            !answer.followUpQuestions.isEmpty ||
            !answer.additionalEvidenceNeeded.isEmpty ||
            !(answer.supportingSources ?? []).isEmpty
    }

    private var hasEvidenceDetails: Bool {
        hasReviewDetails ||
            !answer.missingFacts.isEmpty ||
            !answer.evidenceLimitations.isEmpty ||
            hasFactUsage ||
            !answer.citations.isEmpty
    }

    private var hasFactUsage: Bool {
        let usage = answer.factUsage
        return !(usage?.projectContext ?? []).isEmpty ||
            !(usage?.conversation ?? []).isEmpty ||
            !(usage?.other ?? []).isEmpty
    }

    private func detailsDisclosure<Content: View>(
        _ title: String, @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        DisclosureGroup {
            VStack(alignment: .leading, spacing: 12, content: content)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 8)
        } label: {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .contentShape(Rectangle())
        }
        .tint(.secondary)
    }

    @ViewBuilder
    private var projectFactsDisclosure: some View {
        if let usage = answer.factUsage, hasFactUsage {
            detailsDisclosure("Facts used in this answer") {
                let projectFacts = (usage.projectContext ?? []).map { ResearchAnswerFactRow($0) }
                ForEach(ResearchAnswerFactRow.Group.allCases, id: \.self) { group in
                    factRows(group.rawValue, rows: projectFacts.filter { $0.group == group })
                }
                factRows("Assistant conversation", rows: (usage.conversation ?? []).map { ResearchAnswerFactRow($0, parseProjectFact: false) })
                factRows("Other supplied facts", rows: (usage.other ?? []).map { ResearchAnswerFactRow($0, parseProjectFact: false) })
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("research-answer-facts-used")
        }
    }

    @ViewBuilder
    private func factRows(_ heading: String, rows: [ResearchAnswerFactRow]) -> some View {
        if !rows.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                Text(heading)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .accessibilityAddTraits(.isHeader)
                    .padding(.bottom, 2)
                ForEach(rows.indices, id: \.self) { index in
                    let row = rows[index]
                    if index > 0 { Divider() }
                    VStack(alignment: .leading, spacing: 3) {
                        if row.isProjectNarrative {
                            detailsDisclosure("Project narrative") {
                                if let qualification = row.qualification { Text(qualification) }
                                ResearchFormattedNarrative(text: row.value)
                                    .foregroundStyle(.primary)
                            }
                        } else {
                            if let title = row.title {
                                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
                            }
                            Text(row.value).font(.subheadline).foregroundStyle(.primary)
                            if let qualification = row.qualification {
                                Text(qualification)
                            }
                            if let originalWording = row.originalWording {
                                Text("Original user/source wording").fontWeight(.semibold).padding(.top, 3)
                                Text(originalWording)
                            }
                        }
                    }
                    .padding(.vertical, 6)
                }
            }
            .textSelection(.enabled)
        }
    }

    @ViewBuilder
    private var citedSourcesDisclosure: some View {
        if !answer.citations.isEmpty {
            let firstRelevance = answer.citations.first?.relevance
            let sharedRelevance = answer.citations.count > 1 && answer.citations.allSatisfy { $0.relevance == firstRelevance }
                ? firstRelevance : nil
            detailsDisclosure("Cited sources") {
                if let sharedRelevance, !sharedRelevance.isEmpty {
                    Text(sharedRelevance)
                }
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(answer.citations.indices, id: \.self) { index in
                        if index > 0 { Divider() }
                        let citation = answer.citations[index]
                        Button {
                            onOpenCitation(citation)
                        } label: {
                            HStack(alignment: .center, spacing: 10) {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(citationLabel(citation))
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(.primary)
                                    if let title = citationTitle(citation) {
                                        Text(title).font(.subheadline).foregroundStyle(.primary)
                                    }
                                    Text(citationMetadata(citation))
                                    if sharedRelevance == nil, let relevance = citation.relevance, !relevance.isEmpty {
                                        Text(relevance)
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                Image(systemName: "chevron.right")
                                    .font(.caption.weight(.semibold))
                                    .accessibilityHidden(true)
                            }
                            .padding(.vertical, 8)
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityHint("Opens in Reader")
                        .accessibilityIdentifier(citationAccessibilityIdentifier(citation))
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("research-answer-cited-sources")
        }
    }

    @ViewBuilder
    private var sourceInformation: some View {
        let basis = answer.codeBasis
        let searched = basis?.searchedCorpora ?? []
        let pinned = basis?.pinnedCorpora ?? []
        let repeatsEdition = answer.codeEdition != nil && (searched + pinned).contains { corpus in
            ResearchSourcePresentation.editionDetail(answer.codeEdition, after: corpus.codeEdition ?? corpus.label) == nil
        }
        let metadata = answer.researchMetadataText(sourceStatus: sourceStatus, includeEdition: !repeatsEdition)
        if !metadata.isEmpty || !searched.isEmpty || !pinned.isEmpty || basis?.disclosure != nil || basis?.limitation != nil {
            detailsDisclosure("Source editions & scope") {
                if !metadata.isEmpty { Text(metadata) }
                if let notes = basis.flatMap(ResearchSourcePresentation.disclosureNotes) { Text(notes) }
                if let limitation = basis?.limitation, !limitation.isEmpty { Text(limitation) }
                corpusRows("Sources searched", corpora: searched)
                corpusRows("Explicit evidence reviewed", corpora: pinned)
            }
            .textSelection(.enabled)
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("research-answer-corpus-metadata")
        }
    }

    @ViewBuilder
    private func corpusRows(_ title: String, corpora: [ResearchCorpusBasis]) -> some View {
        if !corpora.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text(title).fontWeight(.semibold).foregroundStyle(.primary)
                ForEach(corpora.indices, id: \.self) { index in
                    let corpus = corpora[index]
                    let name = corpus.label ?? corpus.codeEdition ?? corpus.id ?? "Code library"
                    let applicability = answer.researchApplicabilityStatusLabel(corpus.applicabilityStatus)
                    let edition = ResearchSourcePresentation.editionDetail(corpus.codeEdition, after: name, applicability: applicability)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(name).foregroundStyle(.primary)
                        if let edition { Text(edition) }
                        Text(applicability)
                    }
                }
            }
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

    private func citationLabel(_ citation: ResearchCitation) -> String {
        guard let section = citation.sectionNumber, !section.isEmpty else {
            return citation.title ?? citation.codePrefix ?? "Source"
        }
        return [citation.codePrefix, "§ \(section)"].compactMap { $0 }.joined(separator: " ")
    }

    private func citationTitle(_ citation: ResearchCitation) -> String? {
        guard let section = citation.sectionNumber, !section.isEmpty, let title = citation.title else { return nil }
        let number = NSRegularExpression.escapedPattern(for: section)
        let prefix = NSRegularExpression.escapedPattern(for: citation.codePrefix ?? "")
        let deduplicated = title.replacingOccurrences(
            of: "^\\s*(?:SECTION\\s+)?(?:\(prefix)\\s+)?(?:§\\s*)?\(number)(?=$|[\\s:–—]|\\.(?![0-9]))\\s*[.:–—]?\\s*",
            with: "", options: [.regularExpression, .caseInsensitive]
        )
        return deduplicated.isEmpty ? nil : deduplicated
    }

    private func citationMetadata(_ citation: ResearchCitation) -> String {
        let corpus = citation.corpusLabel
        let edition = ResearchSourcePresentation.editionDetail(citation.codeEdition ?? citation.codeVersion, after: corpus)
        return [evidenceRoleLabel(citation.evidenceRole), corpus, edition]
            .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
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
