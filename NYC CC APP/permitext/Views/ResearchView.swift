import SwiftUI

private struct ResearchQuestionAttempt: Identifiable, Equatable {
    let id: String
    let question: String
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
    @State private var showingSettings = false
    @State private var showingRename = false
    @State private var draftTitle = ""
    @State private var pendingAssignmentProjectID: String?
    @State private var showingAssignmentConfirmation = false
    @State private var isVisible = false
    private let cache = ProjectHubOfflineCache()

    var body: some View {
        NavigationStack {
            Group {
                if library.signedInAccount == nil {
                    ContentUnavailableView(
                        "Sign in to use Research",
                        image: "Astroid",
                        description: Text("Research conversations synchronize with Permitext on the web.")
                    )
                } else if !library.hasResearchAccess {
                    ContentUnavailableView(
                        "Research requires the Research Add-On",
                        image: "Astroid",
                        description: Text("Manage your plan from Settings.")
                    )
                } else if let conversation {
                    conversationView(conversation)
                } else if isLoading && summaries.isEmpty {
                    ProgressView("Loading Research…")
                } else {
                    historyView
                }
            }
            .navigationTitle("Research")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if conversation != nil {
                        Button("History", systemImage: "chevron.left") {
                            library.activeResearchConversationID = nil
                            self.conversation = nil
                        }
                    }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    if library.signedInAccount != nil, library.hasResearchAccess {
                        Button("New Research", systemImage: "plus") {
                            Task { await createConversation(selections: []) }
                        }
                        .disabled(isCreatingConversation)
                    }
                    Button("Settings", systemImage: "gearshape") {
                        showingSettings = true
                    }
                }
            }
            .sheet(isPresented: $showingSettings) {
                NavigationStack { SettingsView() }
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
            .task(id: library.signedInAccount?.appUserID) {
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

    private var historyView: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if let errorMessage {
                    statusMessage(errorMessage)
                }
                if summaries.isEmpty && !isLoading {
                    ContentUnavailableView(
                        "No Research yet",
                        image: "Astroid",
                        description: Text("Start here or select enacted text in a Reader and tap the Astroid.")
                    )
                    .padding(.top, 70)
                }
                ForEach(summaries) { item in
                    Button {
                        library.activeResearchConversationID = item.id
                    } label: {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(item.starterQuestion?.isEmpty == false ? item.starterQuestion! : item.title)
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
                        .padding(.vertical, 15)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                    Divider()
                }
            }
            .padding(.horizontal, 18)
        }
        .refreshable { await loadHistory(forceNetwork: true) }
    }

    private func conversationView(_ conversation: ResearchConversation) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Menu {
                    Button("Unassigned") { requestAssignment(nil) }
                    ForEach(library.folders) { folder in
                        if let projectID = library.backendProjectID(for: folder.id) {
                            Button(folder.name) { requestAssignment(projectID) }
                        }
                    }
                } label: {
                    Label(projectName(for: conversation.primaryProjectID), systemImage: "folder")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 11)
                        .padding(.vertical, 7)
                        .background(.thinMaterial, in: Capsule())
                }
                Spacer()
                Menu {
                    Button("Rename", systemImage: "pencil") {
                        draftTitle = conversation.title
                        showingRename = true
                    }
                    Button("Delete", systemImage: "trash", role: .destructive) {
                        Task { await deleteConversation() }
                    }
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
                        if !conversation.sources.isEmpty {
                            evidenceSummary(conversation.sources)
                        }
                        ForEach(conversation.messages) { message in
                            messageView(message)
                                .id(message.id)
                        }
                        if let pendingQuestionAttempt {
                            pendingQuestionView(pendingQuestionAttempt)
                                .id("pending:\(pendingQuestionAttempt.id)")
                        } else if let failedQuestionAttempt {
                            failedQuestionView(failedQuestionAttempt)
                                .id("failed:\(failedQuestionAttempt.id)")
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
        HStack(alignment: .bottom, spacing: 10) {
            TextField("Ask Terra…", text: $question, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...6)
                .padding(.horizontal, 14)
                .padding(.vertical, 11)
                .background(Color.secondary.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
                .disabled(isSending)
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
            .disabled(question.trimmingCharacters(in: .whitespacesAndNewlines).count < 3 || isSending)
            .accessibilityLabel("Send Research question")
        }
        .padding(12)
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
    }

    @ViewBuilder
    private func messageView(_ message: ResearchMessage) -> some View {
        if message.role == "user", let question = message.question {
            Text(question)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .foregroundStyle(.primary)
                .background(Color.secondary.opacity(0.14), in: RoundedRectangle(cornerRadius: 16))
                .frame(maxWidth: .infinity, alignment: .trailing)
        } else if let answer = message.answer {
            ResearchAnswerView(answer: answer)
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
            try? cache.store(
                loaded,
                accountID: account.appUserID,
                projectID: "all-research",
                scope: "research-history"
            )
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
        guard !isConsumingPendingSelection else { return }
        isConsumingPendingSelection = true
        defer { isConsumingPendingSelection = false }

        while !library.pendingResearchSelections.isEmpty {
            if isCreatingConversation {
                try? await Task.sleep(for: .milliseconds(150))
                continue
            }
            let selections = library.pendingResearchSelections
            if let id = library.activeResearchConversationID {
                do {
                    let updated = try await library.addResearchEvidence(
                        conversationID: id,
                        selections: selections
                    )
                    conversation = updated
                    cacheConversation(updated)
                    await loadHistory(forceNetwork: true)
                    library.acknowledgePendingResearchSelections(selections)
                } catch {
                    errorMessage = error.localizedDescription
                    return
                }
            } else if await createConversation(selections: selections) {
                library.acknowledgePendingResearchSelections(selections)
            } else {
                return
            }
        }
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
        guard let id = conversation?.id, !isSending else { return }
        let messageIDsBeforeRequest = Set(conversation?.messages.map(\.id) ?? [])
        isSending = true
        pendingQuestionAttempt = attempt
        failedQuestionAttempt = nil
        errorMessage = nil
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
        } catch {
            // A network timeout can arrive after Terra has completed on the
            // server. Reconcile before offering a retry; the same request ID
            // makes a retry idempotent if the first response was merely lost.
            if let authoritative = await completedConversationAfterLostResponse(
                conversationID: id,
                question: attempt.question,
                priorMessageIDs: messageIDsBeforeRequest
            ) {
                conversation = authoritative
                cacheConversation(authoritative)
                await loadHistory(forceNetwork: true)
                errorMessage = nil
            } else {
                failedQuestionAttempt = attempt
                errorMessage = "Terra could not finish that request. Your question is still here."
            }
        }
    }

    private func completedConversationAfterLostResponse(
        conversationID: String,
        question: String,
        priorMessageIDs: Set<String>
    ) async -> ResearchConversation? {
        for delay in [0, 2, 4, 6] {
            if delay > 0 {
                try? await Task.sleep(for: .seconds(delay))
            }
            guard let authoritative = try? await library.researchConversation(id: conversationID) else {
                continue
            }
            let newMessages = authoritative.messages.filter { !priorMessageIDs.contains($0.id) }
            let containsQuestion = newMessages.contains {
                $0.role == "user" && $0.question == question
            }
            let containsAnswer = newMessages.contains { $0.role == "assistant" && $0.answer != nil }
            if containsQuestion && containsAnswer {
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

    private func deleteConversation() async {
        guard let id = conversation?.id else { return }
        do {
            try await library.deleteResearchConversation(id: id)
            library.activeResearchConversationID = nil
            conversation = nil
            await loadHistory(forceNetwork: true)
        } catch {
            errorMessage = error.localizedDescription
        }
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

private struct ResearchAnswerView: View {
    let answer: ResearchAnswer

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
                            Text([
                                citation.codePrefix,
                                citation.sectionNumber.map { "§ \($0)" }
                            ].compactMap { $0 }.joined(separator: " "))
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Color.appChrome.opacity(0.14), in: Capsule())
                        }
                    }
                }
            }
            if !answer.supportedPoints.isEmpty || !answer.missingFacts.isEmpty || !answer.evidenceLimitations.isEmpty {
                DisclosureGroup("Evidence reviewed") {
                    VStack(alignment: .leading, spacing: 9) {
                        ForEach(answer.supportedPoints, id: \.heading) { point in
                            Label(point.heading, systemImage: "checkmark.circle")
                        }
                        ForEach(answer.missingFacts, id: \.self) { fact in
                            Label(fact, systemImage: "questionmark.circle")
                        }
                        ForEach(answer.evidenceLimitations, id: \.self) { limit in
                            Label(limit, systemImage: "exclamationmark.triangle")
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
    }
}

#if DEBUG
#Preview {
    ResearchView()
        .environmentObject(CodeLibraryViewModel())
}
#endif
