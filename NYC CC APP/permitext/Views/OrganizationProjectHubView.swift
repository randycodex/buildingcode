import SwiftUI

struct OrganizationProjectHubView: View {
    @EnvironmentObject private var library: CodeLibraryViewModel
    @Environment(\.scenePhase) private var scenePhase
    let organization: PermitextOrganization
    let project: PermitextOrganizationProject

    @State private var snapshot: BackendOrganizationProjectSnapshotResponse?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var reportShareURL: URL?
    @State private var downloadingReportID: String?
    @State private var isProjectHubVisible = false
    @State private var lastSnapshotLoadAt: Date?

    private let automaticSnapshotRefreshInterval: TimeInterval = 30

    private var projectAccent: Color {
        Color(
            uiColor: PlatformColor(hex: project.colorHex ?? CodeFolder.defaultColorHex)
                ?? .systemBlue
        )
    }

    private var foundation: BackendProjectFoundationResponse? {
        snapshot?.project
    }

    private var notebookCards: [ProjectNotebookCardSummary] {
        (foundation?.artifacts ?? [])
            .compactMap(\.notebookCard)
            .sorted { $0.updatedAt > $1.updatedAt }
    }

    private var reportFiles: [ProjectReportFile] {
        (foundation?.artifacts ?? [])
            .compactMap(\.generatedReportFile)
            .sorted { $0.createdAt > $1.createdAt }
    }

    private var projectNotes: [ProjectFoundationArtifact] {
        collaborationArtifacts(ofType: "projectNote")
    }

    private var reviewThreads: [ProjectFoundationArtifact] {
        collaborationArtifacts(ofType: "reviewThread")
    }

    private var reviewComments: [ProjectFoundationArtifact] {
        collaborationArtifacts(ofType: "reviewComment")
    }

    private var evidenceReviews: [ProjectFoundationArtifact] {
        (foundation?.artifacts ?? [])
            .filter {
                $0.envelope.type == "evidenceReview" &&
                    $0.envelope.deletedAt == nil
            }
            .sorted { $0.envelope.updatedAt > $1.envelope.updatedAt }
    }

    private var codeQuestions: [ProjectCodeQuestionRecord] {
        ProjectCodeQuestionRecord.records(
            artifacts: foundation?.artifacts ?? [],
            researchAnswers: foundation?.researchAnswers ?? []
        )
    }

    private var nativeNotebookReferenceCandidates: [NativeNotebookReferenceCandidate] {
        (foundation?.researchAnswers ?? []).map { answer in
            NativeNotebookReferenceCandidate(
                kind: "researchAnswer",
                referenceID: answer.id,
                label: answer.question,
                detail: "Terra Research"
            )
        }
    }

    private var savedEvidenceCount: Int {
        (foundation?.links ?? []).filter {
            $0.targetKind == "canonicalSection" && $0.deletedAt == nil
        }.count
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CodeScreenMetrics.contentSpacingBelowTitle) {
                projectHeader

                if isLoading && snapshot == nil {
                    CodeSurface(accent: projectAccent, showsBorder: false) {
                        HStack(spacing: 12) {
                            ProgressView()
                            Text("Loading shared Project…")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                } else if let errorMessage {
                    CodeSurface(accent: projectAccent, showsBorder: false) {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(errorMessage)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Button("Try Again") {
                                Task { await loadSnapshot() }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(projectAccent)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                } else if snapshot != nil {
                    projectMetrics
                    firmStandardsSection
                    projectNotesSection
                    codeQuestionSection
                    notebookSection
                    researchSection
                    evidenceReviewSection
                    if PermitextReleaseSurfaceVisibility.coordination {
                        reviewCoordinationSection
                    }
                    reportSection
                    activitySection
                }
            }
            .padding(.horizontal, CodeScreenMetrics.screenHorizontalPadding)
            .padding(.top, CodeScreenMetrics.screenHorizontalPadding)
            .padding(.bottom, CodeScreenMetrics.tabBarClearance)
        }
        .background(CodeAppBackdrop(accent: projectAccent).ignoresSafeArea())
        .navigationTitle("Project Hub")
        .navigationBarTitleDisplayMode(.inline)
        .tint(Color.appChrome)
        .task {
            await loadSnapshot()
        }
        .onAppear {
            isProjectHubVisible = true
        }
        .onDisappear {
            isProjectHubVisible = false
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active, isProjectHubVisible else { return }
            Task { await refreshSnapshotAfterForegroundingIfNeeded() }
        }
        .refreshable {
            await loadSnapshot()
        }
        .sheet(
            isPresented: Binding(
                get: { reportShareURL != nil },
                set: { if !$0 { reportShareURL = nil } }
            )
        ) {
            if let reportShareURL {
                BookmarkExportShareSheet(fileURL: reportShareURL) {
                    self.reportShareURL = nil
                }
            }
        }
    }

    private var projectHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text(project.name)
                    .font(.largeTitle.bold())
                    .foregroundStyle(.primary)
                Spacer(minLength: 0)
                Text((snapshot?.access.role ?? project.role).capitalized)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.primary)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(
                        Capsule(style: .continuous)
                            .fill(projectAccent.opacity(0.18))
                    )
            }

            if !project.address.isEmpty {
                Label(project.address, systemImage: "mappin.and.ellipse")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            if !project.description.isEmpty {
                Text(project.description)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Text(
                snapshot?.access.readOnly == false
                    ? "\(organization.name) · Editor role · editing is available on web"
                    : "\(organization.name) · Read-only role"
            )
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }

    private var projectMetrics: some View {
        let columns = [
            GridItem(.flexible(), spacing: 10),
            GridItem(.flexible(), spacing: 10)
        ]
        return LazyVGrid(columns: columns, spacing: 10) {
            metric(value: "\(savedEvidenceCount)", label: "Saved evidence")
            metric(value: "\(projectNotes.count)", label: "Project notes")
            metric(value: "\(codeQuestions.count)", label: "Code Questions")
            metric(value: "\(notebookCards.count)", label: "Notebook cards")
            metric(value: "\(foundation?.researchAnswers.count ?? 0)", label: "Research answers")
            metric(
                value: "\(reviewThreads.filter { ["open", "waiting"].contains($0.payload.status ?? "") }.count)",
                label: "Active coordination"
            )
            metric(value: "\(reportFiles.count)", label: "Reports")
        }
    }

    @ViewBuilder
    private var codeQuestionSection: some View {
        projectSection(title: "Code Questions", systemImage: "questionmark.bubble") {
            CodeQuestionProjectHubList(
                records: codeQuestions,
                accent: projectAccent,
                onOpenReport: { manifestID in
                    openIssuedReport(manifestID: manifestID)
                }
            )
        }
    }

    private func metric(value: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.title3.bold())
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 64, alignment: .leading)
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(projectAccent.opacity(0.1))
        )
    }

    @ViewBuilder
    private var firmStandardsSection: some View {
        if let controls = organization.firmControls {
            projectSection(title: "Firm context", systemImage: "building.2") {
                VStack(alignment: .leading, spacing: 8) {
                    Text(controls.branding.displayName)
                        .font(.subheadline.weight(.semibold))
                    Text(
                        "\(controls.reportTemplates.filter { $0.status == "active" }.count) Report templates · standards revision \(controls.version)"
                    )
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Text(
                        "Retention: \(controls.retentionPolicy.retentionDays) days (policy only; no automatic deletion)"
                    )
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .projectHubRow(accent: projectAccent)
            }
        }
    }

    @ViewBuilder
    private var projectNotesSection: some View {
        projectSection(title: "Project notes", systemImage: "text.bubble") {
            if projectNotes.isEmpty {
                emptyText("No standalone Project notes have been recorded yet.")
            } else {
                ForEach(projectNotes.prefix(8)) { note in
                    VStack(alignment: .leading, spacing: 5) {
                        Text(note.payload.title ?? "Project note")
                            .font(.subheadline.weight(.semibold))
                        if let body = note.payload.body, !body.isEmpty {
                            Text(body)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .lineLimit(5)
                        }
                        Text(
                            "By \(collaborationActor(note.payload)) · \(relativeDate(note.envelope.updatedAt))"
                        )
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    .projectHubRow(accent: projectAccent)
                }
            }
        }
    }

    @ViewBuilder
    private var notebookSection: some View {
        CodeSurface(accent: projectAccent, showsBorder: false) {
            VStack(alignment: .leading, spacing: 12) {
                NavigationLink {
                    organizationNotebookDestination()
                } label: {
                    HStack {
                        Label("Notebook", systemImage: "note.text")
                            .font(.headline)
                        Spacer(minLength: 8)
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    .foregroundStyle(.primary)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                if notebookCards.isEmpty {
                    emptyText("No synced Notebook cards yet.")
                } else {
                    ForEach(notebookCards.prefix(8)) { card in
                        NavigationLink {
                            organizationNotebookDestination(cardID: card.id)
                        } label: {
                            VStack(alignment: .leading, spacing: 5) {
                                Text(card.title)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(.primary)
                                Text(card.cardType.replacingOccurrences(of: "-", with: " ").capitalized)
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(projectAccent)
                                if !card.plainText.isEmpty {
                                    Text(card.plainText)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(4)
                                }
                            }
                            .projectHubRow(accent: projectAccent)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func organizationNotebookDestination(cardID: String? = nil) -> some View {
        ProjectNotebookView(
            projectID: project.id,
            projectName: project.name,
            accentColor: projectAccent,
            referenceCandidates: nativeNotebookReferenceCandidates,
            initialCardID: cardID,
            onChanged: { Task { await loadSnapshot() } }
        )
        .environmentObject(library)
    }

    @ViewBuilder
    private var researchSection: some View {
        projectSection(title: "Research history", systemImage: "text.magnifyingglass") {
            let answers = foundation?.researchAnswers ?? []
            if answers.isEmpty {
                emptyText("No immutable Research answers are linked to this Project.")
            } else {
                ForEach(answers.prefix(8)) { answer in
                    VStack(alignment: .leading, spacing: 5) {
                        Text(answer.question)
                            .font(.subheadline.weight(.semibold))
                        if !answer.conclusion.isEmpty {
                            Text(answer.conclusion)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .lineLimit(4)
                        }
                        Text("\(answer.evidenceCount) approved \(answer.evidenceCount == 1 ? "source" : "sources") · \(answer.reviewStatus)")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    .projectHubRow(accent: projectAccent)
                }
            }
        }
    }

    @ViewBuilder
    private var evidenceReviewSection: some View {
        if !evidenceReviews.isEmpty {
            projectSection(title: "Evidence review", systemImage: "checkmark.seal") {
                ForEach(evidenceReviews) { review in
                    VStack(alignment: .leading, spacing: 5) {
                        Text(evidenceReviewLabel(review.payload.status))
                            .font(.subheadline.weight(.semibold))
                        Text("\(review.payload.evidenceSnapshotIDs?.count ?? 0) immutable evidence snapshots")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if let note = review.payload.note, !note.isEmpty {
                            Text(note)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .projectHubRow(accent: projectAccent)
                }
            }
        }
    }

    @ViewBuilder
    private var reviewCoordinationSection: some View {
        if !reviewThreads.isEmpty {
            projectSection(title: "Coordination", systemImage: "person.2.badge.gearshape") {
                ForEach(reviewThreads) { thread in
                    VStack(alignment: .leading, spacing: 7) {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(thread.payload.title ?? "Project review")
                                .font(.subheadline.weight(.semibold))
                            Spacer(minLength: 0)
                            Text(reviewStatusLabel(thread.payload.status))
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(
                                    ["open", "waiting"].contains(thread.payload.status ?? "") ? projectAccent : .secondary
                                )
                        }
                        Text(
                            [
                                reviewKindLabel(thread.payload.kind),
                                "By \(collaborationActor(thread.payload))",
                                relativeDate(thread.envelope.updatedAt)
                            ].joined(separator: " · ")
                        )
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                        if let body = thread.payload.body, !body.isEmpty {
                            Text(body)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        ForEach(comments(for: thread.id)) { comment in
                            VStack(alignment: .leading, spacing: 3) {
                                Text(comment.payload.body ?? "")
                                    .font(.footnote)
                                Text(
                                    "\(collaborationActor(comment.payload)) · \(relativeDate(comment.envelope.createdAt))"
                                )
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(9)
                            .background(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .fill(projectAccent.opacity(0.065))
                            )
                        }
                    }
                    .projectHubRow(accent: projectAccent)
                }
                Text("Manage Coordination on Permitext Web.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var reportSection: some View {
        projectSection(title: "Reports", systemImage: "doc.richtext") {
            if reportFiles.isEmpty {
                emptyText("No generated Project Report PDFs are available yet.")
            } else {
                ForEach(reportFiles) { file in
                    HStack(alignment: .center, spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Project Report · Version \(file.reportVersion)")
                                .font(.subheadline.weight(.semibold))
                            Text("\(file.format.replacingOccurrences(of: "-", with: " ").uppercased()) · \(ByteCountFormatter.string(fromByteCount: Int64(file.size), countStyle: .file))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 0)
                        Button {
                            downloadReport(file)
                        } label: {
                            if downloadingReportID == file.id {
                                ProgressView()
                                    .frame(width: 22, height: 22)
                            } else {
                                Image(systemName: "square.and.arrow.down")
                                    .font(.body.weight(.semibold))
                            }
                        }
                        .buttonStyle(.plain)
                        .disabled(downloadingReportID != nil)
                        .accessibilityLabel("Download Project Report PDF")
                    }
                    .projectHubRow(accent: projectAccent)
                }
            }
        }
    }

    @ViewBuilder
    private var activitySection: some View {
        let activity = foundation?.activity ?? []
        if !activity.isEmpty {
            projectSection(title: "Recent activity", systemImage: "clock.arrow.circlepath") {
                ForEach(activity.sorted { $0.createdAt > $1.createdAt }.prefix(10)) { event in
                    HStack(alignment: .top, spacing: 10) {
                        Circle()
                            .fill(projectAccent.opacity(0.7))
                            .frame(width: 7, height: 7)
                            .padding(.top, 5)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(activityLabel(event.action))
                                .font(.footnote.weight(.semibold))
                            Text(event.objectKind.replacingOccurrences(of: "-", with: " ").capitalized)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    private func projectSection<Content: View>(
        title: String,
        systemImage: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        CodeSurface(accent: projectAccent, showsBorder: false) {
            VStack(alignment: .leading, spacing: 12) {
                Label(title, systemImage: systemImage)
                    .font(.headline)
                    .foregroundStyle(.primary)
                content()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func emptyText(_ value: String) -> some View {
        Text(value)
            .font(.footnote)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func evidenceReviewLabel(_ status: String?) -> String {
        switch status {
        case "approved": return "Approved"
        case "changes-requested": return "Changes requested"
        case "proposed": return "Proposed for review"
        default: return "Evidence review"
        }
    }

    private func collaborationArtifacts(ofType type: String) -> [ProjectFoundationArtifact] {
        (foundation?.artifacts ?? [])
            .filter {
                $0.envelope.type == type &&
                    $0.envelope.deletedAt == nil
            }
            .sorted { $0.envelope.updatedAt > $1.envelope.updatedAt }
    }

    private func comments(for threadID: String) -> [ProjectFoundationArtifact] {
        reviewComments
            .filter { $0.payload.threadID == threadID }
            .sorted { $0.envelope.createdAt < $1.envelope.createdAt }
    }

    private func collaborationActor(_ payload: ProjectFoundationArtifactPayload) -> String {
        if let displayName = payload.createdByDisplayName, !displayName.isEmpty {
            return displayName
        }
        if let userID = payload.createdByUserID, !userID.isEmpty {
            return userID
        }
        return "Permitext professional"
    }

    private func reviewKindLabel(_ kind: String?) -> String {
        switch kind {
        case "revision-request": return "Revision request"
        case "missing-project-fact": return "Information request"
        case "general-review": return "General review"
        default: return "Project review"
        }
    }

    private func reviewStatusLabel(_ status: String?) -> String {
        switch status {
        case "waiting": return "Waiting"
        case "resolved": return "Resolved"
        case "dismissed": return "Dismissed"
        default: return "Open"
        }
    }

    private func relativeDate(_ value: String) -> String {
        guard let date = ISO8601DateFormatter().date(from: value) else {
            return "Recently"
        }
        return date.formatted(.relative(presentation: .named))
    }

    private func activityLabel(_ action: String) -> String {
        switch action {
        case "item.linked": return "Project item linked"
        case "item.unlinked": return "Project item removed"
        case "notebook-card.created": return "Notebook card created"
        case "notebook-card.revision.saved": return "Notebook revision saved"
        case "research.answer.generated": return "Research answer generated"
        case "review-status.changed": return "Evidence review changed"
        case "project-note.created": return "Project note created"
        case "project-note.revision.saved": return "Project note revised"
        case "review-thread.created": return "Review request opened"
        case "review-thread.revision.saved": return "Review request revised"
        case "review-thread.status.changed": return "Review request status changed"
        case "review-comment.created": return "Review response added"
        case "report.generated": return "Report generated"
        case "report.export.saved": return "Report export saved"
        case "project.transferred": return "Project transferred to firm"
        case "member.invited": return "Project member invited"
        default:
            return action.replacingOccurrences(of: ".", with: " ").capitalized
        }
    }

    private func downloadReport(_ file: ProjectReportFile) {
        guard downloadingReportID == nil else { return }
        downloadingReportID = file.id
        Task {
            defer { downloadingReportID = nil }
            do {
                reportShareURL = try await library.organizationProjectReportURL(
                    projectID: project.id,
                    projectName: project.name,
                    file: file
                )
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func openIssuedReport(manifestID: String) {
        guard let file = reportFiles.first(where: { $0.manifestID == manifestID }) else {
            errorMessage = "The issued manifest is preserved, but its downloadable PDF is not available in this snapshot."
            return
        }
        downloadReport(file)
    }

    private func loadSnapshot() async {
        guard !isLoading else { return }
        lastSnapshotLoadAt = Date()
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let response = try await library.organizationProjectSnapshot(projectID: project.id)
            snapshot = response
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func refreshSnapshotAfterForegroundingIfNeeded() async {
        let now = Date()
        if let lastSnapshotLoadAt,
           now.timeIntervalSince(lastSnapshotLoadAt) < automaticSnapshotRefreshInterval {
            return
        }
        await loadSnapshot()
    }
}

private extension View {
    func projectHubRow(accent: Color) -> some View {
        self
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(11)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(accent.opacity(0.075))
            )
    }
}
