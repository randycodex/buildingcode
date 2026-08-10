import Foundation
import os.signpost

enum AppSignpost {
    static let subsystem = "com.nyccc.app"

    static let reader = OSLog(subsystem: subsystem, category: "Reader")
    static let bundle = OSLog(subsystem: subsystem, category: "Bundle")
    static let search = OSLog(subsystem: subsystem, category: "Search")
    static let startup = OSLog(subsystem: subsystem, category: "Startup")
}

struct UserContentSyncPreviewReport: Hashable, Sendable {
    let pendingCount: Int
    let backendName: String
    let sampledItemIDs: [Int64]
}

struct UserContentSyncPushReport: Hashable, Sendable {
    let attemptedCount: Int
    let completedCount: Int
    let backendName: String
    let accountUserID: String?
    let skippedReason: String?
    let sampledItemIDs: [Int64]
    let acceptedMutationIDs: [String]
    let rejectedMutationIDs: [String]
    let rejectionReasons: [String: BackendUserContentRejection]
    let latestEventID: Int64?
    let entitlement: AppEntitlement?
    let capabilityContract: PermitextCapabilityContract?
}

struct UserContentSyncPullReport: Hashable, Sendable {
    let pulledCount: Int
    let appliedCount: Int
    let skippedCount: Int
    let conflictCount: Int
    let backendName: String
    let accountUserID: String?
    let skippedReason: String?
    let mergePlan: UserContentMergePlan
    let entitlement: AppEntitlement?
    let capabilityContract: PermitextCapabilityContract?

    var appliedRemoteContinuity: Bool {
        mergePlan.decisions.contains {
            $0.entityKind == .continuity && $0.action == .applyServer
        }
    }
}

struct UserContentSyncBatch: Hashable, Sendable {
    let items: [SyncQueueItem]

    var isEmpty: Bool {
        items.isEmpty
    }
}

struct UserContentSyncConflict: Identifiable, Hashable, Sendable {
    let recordID: String
    let entityKind: ServerUserContentEntityKind
    let message: String

    var id: String { recordID }

    var displayTitle: String {
        switch entityKind {
        case .savedItem:
            return "Saved section"
        case .annotation:
            return "Note or tags"
        case .project:
            return "Project"
        case .projectSection:
            return "Project evidence"
        case .workboard:
            return "Workboard"
        case .continuity:
            return "Reading position"
        case .codeVersionClear:
            return "Cleared saved data"
        }
    }

    var systemImage: String {
        switch entityKind {
        case .savedItem:
            return "bookmark"
        case .annotation:
            return "note.text"
        case .project:
            return "folder"
        case .projectSection:
            return "folder.badge.plus"
        case .workboard:
            return "rectangle.3.group"
        case .continuity:
            return "clock.arrow.circlepath"
        case .codeVersionClear:
            return "trash.slash"
        }
    }

    var recordReference: String {
        let trimmed = recordID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > 20 else { return trimmed }
        return "…\(trimmed.suffix(16))"
    }
}

protocol UserContentSyncBackend {
    var name: String { get }
    func preview(items: [SyncQueueItem]) throws -> UserContentSyncPreviewReport
    func push(batch: UserContentSyncBatch, account: SignedInAccount) async throws -> UserContentSyncPushReport
    func checkpoint(
        account: SignedInAccount,
        sinceEventID: Int64?,
        contentMapVersion: Int?,
        entitlementFingerprint: String?
    ) async throws -> ServerUserContentCheckpointResult
    func pull(
        account: SignedInAccount,
        since: Date?,
        sinceEventID: Int64?,
        contentMapVersion: Int?,
        excludedMutationKinds: [String]
    ) async throws -> ServerUserContentPullResult
    func previewMerge(incoming: ServerUserContentPullResult, localCandidates: [String: UserContentMergeCandidate]) throws -> UserContentMergePlan
}

struct NoOpUserContentSyncBackend: UserContentSyncBackend {
    let name = "noop"

    func preview(items: [SyncQueueItem]) throws -> UserContentSyncPreviewReport {
        UserContentSyncPreviewReport(
            pendingCount: items.count,
            backendName: name,
            sampledItemIDs: items.map(\.id)
        )
    }

    func push(batch: UserContentSyncBatch, account: SignedInAccount) async throws -> UserContentSyncPushReport {
        let serverBatch = try ServerUserContentBatch(account: account, syncQueueItems: batch.items)
        return UserContentSyncPushReport(
            attemptedCount: batch.items.count,
            completedCount: serverBatch.mutations.count,
            backendName: name,
            accountUserID: account.appUserID,
            skippedReason: nil,
            sampledItemIDs: batch.items.map(\.id),
            acceptedMutationIDs: serverBatch.mutations.map(\.recordID),
            rejectedMutationIDs: [],
            rejectionReasons: [:],
            latestEventID: nil,
            entitlement: nil,
            capabilityContract: nil
        )
    }

    func checkpoint(
        account: SignedInAccount,
        sinceEventID: Int64?,
        contentMapVersion: Int?,
        entitlementFingerprint: String?
    ) async throws -> ServerUserContentCheckpointResult {
        ServerUserContentCheckpointResult(
            userID: account.appUserID,
            checkedAt: Date(),
            changed: false,
            latestEventID: sinceEventID,
            syncRevision: sinceEventID,
            contentMapVersion: contentMapVersion,
            entitlementFingerprint: entitlementFingerprint
        )
    }

    func pull(
        account: SignedInAccount,
        since: Date?,
        sinceEventID: Int64?,
        contentMapVersion: Int?,
        excludedMutationKinds: [String]
    ) async throws -> ServerUserContentPullResult {
        ServerUserContentPullResult(
            userID: account.appUserID,
            pulledAt: Date(),
            mutations: []
        )
    }

    func previewMerge(incoming: ServerUserContentPullResult, localCandidates: [String: UserContentMergeCandidate]) throws -> UserContentMergePlan {
        UserContentMergeResolver.plan(
            incomingServerMutations: incoming.mutations,
            localCandidates: localCandidates
        )
    }
}

struct PermitextBackendClient: AccountBackendClient, UserContentSyncBackend {
    let transport: PermitextBackendTransport
    let bearerTokenProvider: @Sendable (SignedInAccount) -> String?

    var name: String {
        transport.name
    }

    init(
        transport: PermitextBackendTransport = LocalPermitextBackendTransport(),
        bearerTokenProvider: @escaping @Sendable (SignedInAccount) -> String? = { $0.backendSessionToken }
    ) {
        self.transport = transport
        self.bearerTokenProvider = bearerTokenProvider
    }

    func signIn(credential: AccountSignInCredential) async throws -> BackendAccountRecord {
        try await transport.signIn(BackendSignInRequest(credential: credential))
    }

    func signOut(account: SignedInAccount) async throws {
        _ = try await transport.signOut(
            BackendSignOutRequest(auth: authContext(for: account))
        )
    }

    func deleteAccount(account: SignedInAccount) async throws {
        _ = try await transport.deleteAccount(
            BackendAccountDeleteRequest(
                auth: authContext(for: account),
                confirmation: "DELETE"
            )
        )
    }

    func health() async throws -> BackendHealthStatus {
        try await transport.health()
    }

    func attachLocalData(account: SignedInAccount) async throws -> AccountMigrationState {
        try await transport.attachLocalData(BackendAttachLocalDataRequest(account: account))
    }

    func updateProfile(account: SignedInAccount, publicUsername: String?, displayName: String?) async throws -> SignedInAccount {
        let response = try await transport.updateProfile(
            BackendProfileUpdateRequest(
                auth: authContext(for: account),
                publicUsername: publicUsername,
                displayName: displayName
            )
        )
        return response.account
    }

    func verifyAppleTransaction(account: SignedInAccount, signedTransactionInfo: String) async throws -> AppEntitlement? {
        let response = try await transport.verifyAppleTransaction(
            BackendAppleTransactionVerifyRequest(
                auth: authContext(for: account),
                signedTransactionInfo: signedTransactionInfo
            )
        )
        return response.entitlement
    }

    func organizations(account: SignedInAccount) async throws -> [PermitextOrganization] {
        let response = try await transport.organizations(
            BackendOrganizationListRequest(auth: authContext(for: account))
        )
        return response.organizations
    }

    func acceptOrganizationInvitation(
        account: SignedInAccount,
        invitationToken: String
    ) async throws -> PermitextOrganization {
        let response = try await transport.acceptOrganizationInvitation(
            BackendOrganizationInvitationAcceptRequest(
                auth: authContext(for: account),
                invitationToken: invitationToken
            )
        )
        return response.organization
    }

    func organizationProjectSnapshot(
        account: SignedInAccount,
        projectID: String
    ) async throws -> BackendOrganizationProjectSnapshotResponse {
        try await transport.organizationProjectSnapshot(
            BackendOrganizationProjectSnapshotRequest(
                auth: authContext(for: account),
                projectID: projectID
            )
        )
    }

    func projectHub(account: SignedInAccount, projectID: String) async throws -> ProjectHubSnapshot {
        // Prefer the consolidated bootstrap endpoint (one round-trip). Fall back to the
        // legacy three-call assembly for older backends during staged deploy.
        do {
            let bootstrap = try await transport.projectHubBootstrap(
                BackendProjectHubBootstrapRequest(
                    auth: authContext(for: account),
                    projectID: projectID
                )
            )
            return ProjectHubSnapshot(
                projectID: projectID,
                notebookCards: bootstrap.notebook.cards,
                researchConversations: bootstrap.foundation.researchConversations,
                researchAnswers: bootstrap.foundation.researchAnswers,
                activity: bootstrap.foundation.activity,
                reports: bootstrap.reports.reports,
                workboardPreview: bootstrap.foundation.workboardPreview,
                foundationArtifacts: bootstrap.foundation.artifacts ?? []
            )
        } catch let error as PermitextBackendHTTPError {
            switch error {
            case .serverStatus(404, _), .serverStatus(405, _):
                break
            default:
                throw error
            }
        }

        async let foundation = transport.projectFoundation(
            BackendProjectFoundationRequest(
                auth: authContext(for: account),
                projectID: projectID
            )
        )
        async let notebook = transport.projectNotebookCards(
            BackendProjectNotebookCardsRequest(
                auth: authContext(for: account),
                projectID: projectID
            )
        )
        async let reports = transport.projectReportHistory(
            BackendProjectReportHistoryRequest(
                auth: authContext(for: account),
                projectID: projectID
            )
        )
        let (foundationResponse, notebookResponse, reportResponse) = try await (
            foundation,
            notebook,
            reports
        )
        return ProjectHubSnapshot(
            projectID: projectID,
            notebookCards: notebookResponse.cards,
            researchConversations: foundationResponse.researchConversations,
            researchAnswers: foundationResponse.researchAnswers,
            activity: foundationResponse.activity,
            reports: reportResponse.reports,
            workboardPreview: foundationResponse.workboardPreview,
            foundationArtifacts: foundationResponse.artifacts ?? []
        )
    }

    func projectReportManifest(
        account: SignedInAccount,
        manifestID: String
    ) async throws -> ProjectReportManifest {
        let response = try await transport.projectReportManifest(
            BackendProjectReportManifestRequest(
                auth: authContext(for: account),
                manifestID: manifestID
            )
        )
        return response.manifest
    }

    func saveProjectReportPDF(
        account: SignedInAccount,
        projectID: String,
        manifestID: String,
        data: Data
    ) async throws -> ProjectReportFile {
        let response = try await transport.projectReportFileUpload(
            BackendProjectReportFileUploadRequest(
                auth: authContext(for: account),
                projectID: projectID,
                manifestID: manifestID,
                format: "ios-pdf"
            ),
            data: data
        )
        return response.file
    }

    func projectReportFile(
        account: SignedInAccount,
        projectID: String,
        generatedReportID: String
    ) async throws -> Data {
        try await transport.projectReportFile(
            BackendProjectReportFileReadRequest(
                auth: authContext(for: account),
                projectID: projectID,
                generatedReportID: generatedReportID
            )
        )
    }

    func projectWorkboardPreview(
        account: SignedInAccount,
        projectID: String,
        previewID: String
    ) async throws -> Data {
        try await transport.projectWorkboardPreview(
            BackendProjectWorkboardPreviewRequest(
                auth: authContext(for: account),
                projectID: projectID,
                previewID: previewID
            )
        )
    }

    func preview(items: [SyncQueueItem]) throws -> UserContentSyncPreviewReport {
        UserContentSyncPreviewReport(
            pendingCount: items.count,
            backendName: name,
            sampledItemIDs: items.map(\.id)
        )
    }

    func push(batch: UserContentSyncBatch, account: SignedInAccount) async throws -> UserContentSyncPushReport {
        let serverBatch = try ServerUserContentBatch(account: account, syncQueueItems: batch.items)
        let response = try await transport.pushUserContent(
            BackendUserContentPushRequest(
                auth: authContext(for: account),
                batch: serverBatch
            )
        )
        return UserContentSyncPushReport(
            attemptedCount: batch.items.count,
            completedCount: response.acceptedMutationIDs.count,
            backendName: name,
            accountUserID: account.appUserID,
            skippedReason: nil,
            sampledItemIDs: batch.items.map(\.id),
            acceptedMutationIDs: response.acceptedMutationIDs,
            rejectedMutationIDs: response.rejectedMutationIDs ?? [],
            rejectionReasons: response.rejectionReasons ?? [:],
            latestEventID: response.latestEventID ?? response.syncRevision,
            entitlement: response.entitlement,
            capabilityContract: response.capabilityContract
        )
    }

    func checkpoint(
        account: SignedInAccount,
        sinceEventID: Int64?,
        contentMapVersion: Int?,
        entitlementFingerprint: String?
    ) async throws -> ServerUserContentCheckpointResult {
        try await transport.checkpointUserContent(
            BackendUserContentCheckpointRequest(
                auth: authContext(for: account),
                sinceEventID: sinceEventID,
                contentMapVersion: contentMapVersion,
                entitlementFingerprint: entitlementFingerprint
            )
        )
    }

    func pull(
        account: SignedInAccount,
        since: Date?,
        sinceEventID: Int64?,
        contentMapVersion: Int?,
        excludedMutationKinds: [String]
    ) async throws -> ServerUserContentPullResult {
        try await transport.pullUserContent(
            BackendUserContentPullRequest(
                auth: authContext(for: account),
                since: since,
                sinceEventID: sinceEventID,
                contentMapVersion: contentMapVersion,
                excludedMutationKinds: excludedMutationKinds
            )
        )
    }

    func previewMerge(incoming: ServerUserContentPullResult, localCandidates: [String: UserContentMergeCandidate]) throws -> UserContentMergePlan {
        UserContentMergeResolver.plan(
            incomingServerMutations: incoming.mutations,
            localCandidates: localCandidates
        )
    }

    private func authContext(for account: SignedInAccount) -> BackendAuthContext {
        BackendAuthContext(
            accountUserID: account.appUserID,
            bearerToken: bearerTokenProvider(account)
        )
    }
}

struct UserContentSyncEngine {
    private let repository: UserContentRepository?
    private let backend: UserContentSyncBackend
    private let checkpointStore: UserContentSyncCheckpointStore
    private let continuityStore: ContinuityStore

    init(
        repository: UserContentRepository?,
        backend: UserContentSyncBackend = NoOpUserContentSyncBackend(),
        checkpointStore: UserContentSyncCheckpointStore = UserContentSyncCheckpointStore(),
        continuityStore: ContinuityStore = .shared
    ) {
        self.repository = repository
        self.backend = backend
        self.checkpointStore = checkpointStore
        self.continuityStore = continuityStore
    }

    func previewPendingWork(limit: Int = 100) throws -> UserContentSyncPreviewReport {
        guard let repository else {
            return UserContentSyncPreviewReport(
                pendingCount: 0,
                backendName: backend.name,
                sampledItemIDs: []
            )
        }
        try repository.prepareSyncQueueForProcessing(now: Date())
        let items = try repository.pendingSyncQueueItems(limit: limit)
        return try backend.preview(items: items)
    }

    func claimNextBatch(limit: Int = 25) throws -> UserContentSyncBatch {
        guard let repository else {
            return UserContentSyncBatch(items: [])
        }
        try repository.prepareSyncQueueForProcessing(now: Date())
        let items = try repository.pendingSyncQueueItems(limit: limit)
        try repository.markSyncQueueItemsInFlight(ids: items.map(\.id))
        return UserContentSyncBatch(items: items)
    }

    func markCompleted(_ item: SyncQueueItem) throws {
        try repository?.markSyncQueueItemSynced(id: item.id)
    }

    func markFailed(_ item: SyncQueueItem, error: Error) throws {
        try repository?.markSyncQueueItemFailed(id: item.id, errorMessage: error.localizedDescription)
    }

    func retryFailedItems() throws {
        try repository?.resetFailedSyncQueueItems()
    }

    func rejectedConflicts(account: SignedInAccount?) throws -> [UserContentSyncConflict] {
        guard let repository, let account else { return [] }
        var conflictsByRecordID: [String: UserContentSyncConflict] = [:]
        for item in try repository.failedSyncQueueItems(limit: 500) {
            guard let conflictMessage = UserContentSyncConflictError.message(from: item.lastError),
                  let mutation = try? ServerUserContentMutation(syncQueueItem: item, account: account)
            else { continue }
            conflictsByRecordID[mutation.recordID] = UserContentSyncConflict(
                recordID: mutation.recordID,
                entityKind: mutation.entityKind,
                message: conflictMessage
            )
        }
        return conflictsByRecordID.values.sorted { $0.recordID < $1.recordID }
    }

    func resolveRejectedConflict(
        _ conflict: UserContentSyncConflict,
        account: SignedInAccount,
        keepLocal: Bool
    ) async throws {
        guard let repository else { return }
        let matchingItems = try repository.failedSyncQueueItems(limit: 500).filter { item in
            guard let mutation = try? ServerUserContentMutation(syncQueueItem: item, account: account) else {
                return false
            }
            return mutation.recordID == conflict.recordID
        }
        guard !matchingItems.isEmpty else { return }

        if keepLocal {
            try repository.retrySyncQueueItems(ids: matchingItems.map(\.id), mutationUpdatedAt: Date())
            _ = try await processPendingWork(account: account)
            _ = try await pullRemoteChanges(account: account, applySafeChanges: true)
            return
        }

        let checkpoint = checkpoint(for: account)
        let incoming = try await backend.pull(
            account: account,
            since: nil,
            sinceEventID: nil,
            contentMapVersion: checkpoint.contentMapVersion,
            excludedMutationKinds: UserContentSyncClientPolicy.excludedMutationKinds
        )
        guard let mutation = incoming.mutations.first(where: { $0.recordID == conflict.recordID }) else {
            throw UserContentSyncError.rejectedByServer("The server copy is no longer available. Pull again before resolving this conflict.")
        }
        if case .continuity(let record) = mutation {
            applyServerContinuity(record)
        } else {
            try repository.applyServerUserContentMutation(mutation)
        }
        for item in matchingItems {
            try repository.markSyncQueueItemSynced(id: item.id)
        }
        if try repository.failedSyncQueueItems(limit: 1).isEmpty {
            checkpointStore.save(
                checkpoint.markingPullSucceeded(
                    at: incoming.pulledAt,
                    latestEventID: incoming.latestEventID ?? incoming.syncRevision,
                    contentMapVersion: incoming.contentMapVersion,
                    entitlementFingerprint: incoming.entitlementFingerprint
                )
            )
        }
    }

    func previewMerge(
        incoming: ServerUserContentPullResult,
        localCandidates: [String: UserContentMergeCandidate] = [:]
    ) throws -> UserContentMergePlan {
        try backend.previewMerge(incoming: incoming, localCandidates: localCandidates)
    }

    /// Cheap server probe used by automatic foreground sync. Returns `true` when a full pull is needed.
    /// Falls open to `true` on transport errors so automatic sync still converges.
    func remoteSyncMayHaveChanges(account: SignedInAccount?) async -> Bool {
        guard let account else { return false }
        let localCheckpoint = checkpoint(for: account)
        // First successful pull has not landed yet — always pull.
        guard localCheckpoint.latestEventID != nil || localCheckpoint.lastSuccessfulPullAt != nil else {
            return true
        }
        do {
            let remote = try await backend.checkpoint(
                account: account,
                sinceEventID: localCheckpoint.latestEventID,
                contentMapVersion: localCheckpoint.contentMapVersion,
                entitlementFingerprint: localCheckpoint.entitlementFingerprint
            )
            if !remote.changed {
                checkpointStore.save(
                    localCheckpoint.markingCheckpointChecked(
                        at: remote.checkedAt,
                        latestEventID: remote.latestEventID ?? remote.syncRevision,
                        contentMapVersion: remote.contentMapVersion,
                        entitlementFingerprint: remote.entitlementFingerprint
                    )
                )
            }
            return remote.changed
        } catch {
            return true
        }
    }

    func pullRemoteChanges(
        account: SignedInAccount?,
        since: Date? = nil,
        localCandidates: [String: UserContentMergeCandidate] = [:],
        applySafeChanges: Bool = false,
        skipIfUnchanged: Bool = false,
        excludedMutationKinds: [String] = UserContentSyncClientPolicy.excludedMutationKinds
    ) async throws -> UserContentSyncPullReport {
        guard let account else {
            return UserContentSyncPullReport(
                pulledCount: 0,
                appliedCount: 0,
                skippedCount: 0,
                conflictCount: 0,
                backendName: backend.name,
                accountUserID: nil,
                skippedReason: "No signed-in account.",
                mergePlan: UserContentMergePlan(decisions: []),
                entitlement: nil,
                capabilityContract: nil
            )
        }

        let checkpoint = checkpoint(for: account)
        if skipIfUnchanged {
            let mayHaveChanges = await remoteSyncMayHaveChanges(account: account)
            if !mayHaveChanges {
                return UserContentSyncPullReport(
                    pulledCount: 0,
                    appliedCount: 0,
                    skippedCount: 0,
                    conflictCount: 0,
                    backendName: backend.name,
                    accountUserID: account.appUserID,
                    skippedReason: "No remote changes.",
                    mergePlan: UserContentMergePlan(decisions: []),
                    entitlement: nil,
                    capabilityContract: nil
                )
            }
        }

        do {
            let incoming = try await backend.pull(
                account: account,
                since: checkpoint.latestEventID == nil ? since ?? checkpoint.lastSuccessfulPullAt : nil,
                sinceEventID: checkpoint.latestEventID,
                contentMapVersion: checkpoint.contentMapVersion,
                excludedMutationKinds: excludedMutationKinds
            )
            let resolvedLocalCandidates = try localCandidates.isEmpty
                ? repository?.localMergeCandidates(
                    for: incoming.mutations,
                    account: account
                ) ?? [:]
                : localCandidates
            let mergePlan = try previewMerge(incoming: incoming, localCandidates: resolvedLocalCandidates)
            let appliedCount = try applySafeChanges
                ? applySafeRemoteChanges(incoming: incoming, mergePlan: mergePlan, account: account)
                : 0
            let safeNoOpCount = mergePlan.noChangeCount
            let unresolvedCount = mergePlan.keepLocalCount + mergePlan.uploadLocalCount + mergePlan.conflictCount
            let skippedCount = max(mergePlan.decisions.count - appliedCount - safeNoOpCount, 0)
            if applySafeChanges && unresolvedCount == 0 {
                checkpointStore.save(
                    checkpoint.markingPullSucceeded(
                        at: incoming.pulledAt,
                        latestEventID: incoming.latestEventID ?? incoming.syncRevision,
                        contentMapVersion: incoming.contentMapVersion,
                        entitlementFingerprint: incoming.entitlementFingerprint
                    )
                )
            }
            return UserContentSyncPullReport(
                pulledCount: incoming.mutations.count,
                appliedCount: appliedCount,
                skippedCount: skippedCount,
                conflictCount: mergePlan.conflictCount,
                backendName: backend.name,
                accountUserID: account.appUserID,
                skippedReason: nil,
                mergePlan: mergePlan,
                entitlement: incoming.entitlement,
                capabilityContract: incoming.capabilityContract
            )
        } catch {
            checkpointStore.save(checkpoint.markingFailed(error: error, at: Date()))
            throw error
        }
    }

    func processPendingWork(account: SignedInAccount?, limit: Int = 25, maxBatches: Int = 20) async throws -> UserContentSyncPushReport {
        guard let account else {
            return UserContentSyncPushReport(
                attemptedCount: 0,
                completedCount: 0,
                backendName: backend.name,
                accountUserID: nil,
                skippedReason: "No signed-in account.",
                sampledItemIDs: [],
                acceptedMutationIDs: [],
                rejectedMutationIDs: [],
                rejectionReasons: [:],
                latestEventID: nil,
                entitlement: nil,
                capabilityContract: nil
            )
        }

        let checkpoint = checkpoint(for: account)
        var attemptedCount = 0
        var completedCount = 0
        var sampledItemIDs: [Int64] = []
        var acceptedMutationIDs: [String] = []
        var rejectedMutationIDs: [String] = []
        var rejectionReasons: [String: BackendUserContentRejection] = [:]
        var latestEventID = checkpoint.latestEventID
        var entitlement: AppEntitlement?
        var capabilityContract: PermitextCapabilityContract?
        var processedBatchCount = 0

        while processedBatchCount < maxBatches {
            let batch = try claimNextBatch(limit: limit)
            guard !batch.isEmpty else {
                break
            }
            processedBatchCount += 1

            do {
                let report = try await backend.push(batch: batch, account: account)
                attemptedCount += report.attemptedCount
                completedCount += report.completedCount
                sampledItemIDs.append(contentsOf: report.sampledItemIDs)
                acceptedMutationIDs.append(contentsOf: report.acceptedMutationIDs)
                rejectedMutationIDs.append(contentsOf: report.rejectedMutationIDs)
                rejectionReasons.merge(report.rejectionReasons) { _, latest in latest }
                latestEventID = report.latestEventID ?? latestEventID
                entitlement = report.entitlement ?? entitlement
                capabilityContract = report.capabilityContract ?? capabilityContract
                let acceptedIDs = Set(report.acceptedMutationIDs)
                let rejectedIDs = Set(report.rejectedMutationIDs)
                for item in batch.items {
                    guard let mutation = try? ServerUserContentMutation(syncQueueItem: item, account: account) else {
                        try? markFailed(item, error: UserContentSyncError.rejectedByServer("Could not map local sync item to a server record."))
                        continue
                    }
                    if acceptedIDs.contains(mutation.recordID) {
                        try markCompleted(item)
                    } else if rejectedIDs.contains(mutation.recordID) {
                        if let rejection = report.rejectionReasons[mutation.recordID],
                           UserContentSyncConflictError.shouldAutomaticallyUseServerCopy(rejection) {
                            // The automatic sync sequence pulls immediately after pushing. Removing
                            // this superseded queue item lets that pull apply the authoritative server
                            // record instead of leaving a device-local conflict that cannot converge.
                            try markCompleted(item)
                        } else {
                            let message = report.rejectionReasons[mutation.recordID]
                                .map(UserContentSyncConflictError.persistedDescription) ??
                                "Server could not accept this record. Review the sync status before retrying."
                            try? markFailed(item, error: UserContentSyncError.rejectedByServer(message))
                        }
                    } else {
                        try? markFailed(item, error: UserContentSyncError.rejectedByServer("Server did not accept this sync item."))
                    }
                }
            } catch {
                for item in batch.items {
                    try? markFailed(item, error: error)
                }
                checkpointStore.save(checkpoint.markingFailed(error: error, at: Date()))
                throw error
            }
        }

        guard attemptedCount > 0 else {
            return UserContentSyncPushReport(
                attemptedCount: 0,
                completedCount: 0,
                backendName: backend.name,
                accountUserID: account.appUserID,
                skippedReason: nil,
                sampledItemIDs: [],
                acceptedMutationIDs: [],
                rejectedMutationIDs: [],
                rejectionReasons: [:],
                latestEventID: latestEventID,
                entitlement: nil,
                capabilityContract: nil
            )
        }

        checkpointStore.save(checkpoint.markingPushSucceeded(at: Date(), latestEventID: latestEventID))
        return UserContentSyncPushReport(
            attemptedCount: attemptedCount,
            completedCount: completedCount,
            backendName: backend.name,
            accountUserID: account.appUserID,
            skippedReason: nil,
            sampledItemIDs: Array(sampledItemIDs.prefix(100)),
            acceptedMutationIDs: acceptedMutationIDs,
            rejectedMutationIDs: rejectedMutationIDs,
            rejectionReasons: rejectionReasons,
            latestEventID: latestEventID,
            entitlement: entitlement,
            capabilityContract: capabilityContract
        )
    }

    func checkpoint(account: SignedInAccount?) -> UserContentSyncCheckpoint? {
        guard let account else { return nil }
        return checkpoint(for: account)
    }

    func resetCheckpoint(account: SignedInAccount) {
        checkpointStore.clear(accountUserID: account.appUserID, backendName: backend.name)
    }

    private func checkpoint(for account: SignedInAccount) -> UserContentSyncCheckpoint {
        checkpointStore.load(accountUserID: account.appUserID, backendName: backend.name)
    }

    private func applySafeRemoteChanges(
        incoming: ServerUserContentPullResult,
        mergePlan: UserContentMergePlan,
        account: SignedInAccount
    ) throws -> Int {
        guard let repository else { return 0 }
        let decisionsByID = Dictionary(uniqueKeysWithValues: mergePlan.decisions.map { ($0.recordID, $0) })
        let bulkClears = incoming.mutations.compactMap { mutation -> ServerContinuityRecord? in
            guard case .codeVersionClear(let record) = mutation else { return nil }
            return record
        }
        var appliedCount = 0
        for mutation in incoming.mutations.sortedForLocalApplication {
            guard let decision = decisionsByID[mutation.recordID] else { continue }
            switch decision.action {
            case .applyServer:
                guard let applicableMutation = mutation.removingFieldsSuperseded(by: bulkClears) else {
                    // A full pull includes the current record for every stable
                    // ID, including records older than a later collection
                    // clear. Treat those records as consumed by the clear so
                    // they cannot be reinserted after the clear is applied.
                    appliedCount += 1
                    continue
                }
                if case .continuity(let record) = applicableMutation {
                    applyServerContinuity(record)
                } else {
                    try repository.applyServerUserContentMutation(applicableMutation)
                }
                try repository.discardQueuedMutation(recordID: mutation.recordID, account: account)
                appliedCount += 1
            case .noChange:
                // Reapply idempotently so records written under an older code-version
                // alias are moved into the current local version bucket.
                guard let applicableMutation = mutation.removingFieldsSuperseded(by: bulkClears) else {
                    continue
                }
                if case .continuity(let record) = applicableMutation {
                    applyServerContinuity(record)
                } else {
                    try repository.applyServerUserContentMutation(applicableMutation)
                }
                continue
            case .keepLocal, .uploadLocal, .flagConflict:
                continue
            }
        }
        return appliedCount
    }

    private func applyServerContinuity(_ record: ServerContinuityRecord) {
        let values = record.values
        let existingContext = continuityStore.load()
        let recentlyViewedSections: [RecentlyViewedEntry]
        if let rawJSON = values["recentlyViewedSectionsJSON"],
           let data = rawJSON.data(using: .utf8),
           let decoded = try? JSONDecoder().decode([RecentlyViewedEntry].self, from: data) {
            recentlyViewedSections = decoded.sorted { $0.viewedAt > $1.viewedAt }
        } else {
            recentlyViewedSections = existingContext.recentlyViewedSections
        }
        if let rawJSON = values["recentSearchesJSON"],
           let data = rawJSON.data(using: .utf8),
           let decoded = try? JSONDecoder().decode([String].self, from: data) {
            UserDefaults.standard.set(Array(decoded.prefix(10)), forKey: "recentSearches")
        }

        // Continuity shares activity, not navigation. Pulling another device's
        // selected version/code/project here used to eject iOS from the code
        // the person was actively reading.
        continuityStore.save(
            ContinuityContext(
                selectedJurisdictionKey: existingContext.selectedJurisdictionKey,
                selectedVersionFileName: existingContext.selectedVersionFileName,
                selectedCodeSectionID: existingContext.selectedCodeSectionID,
                lastOpenedChapterID: existingContext.lastOpenedChapterID,
                activeProjectID: existingContext.activeProjectID,
                comparisonModeEnabled: existingContext.comparisonModeEnabled,
                recentlyViewedSections: recentlyViewedSections
            )
        )
    }
}

enum UserContentSyncConflictError {
    private static let conflictCodes = ["SERVER_NEWER", "EQUAL_TIMESTAMP_CONFLICT"]

    static func shouldAutomaticallyUseServerCopy(_ rejection: BackendUserContentRejection) -> Bool {
        conflictCodes.contains(rejection.code)
    }

    static func persistedDescription(for rejection: BackendUserContentRejection) -> String {
        "[\(rejection.code)] \(rejection.message)"
    }

    static func message(from lastError: String?) -> String? {
        guard let lastError else { return nil }
        for code in conflictCodes {
            let prefix = "[\(code)]"
            if lastError.hasPrefix(prefix) {
                let message = lastError.dropFirst(prefix.count).trimmingCharacters(in: .whitespacesAndNewlines)
                return message.isEmpty ? "This change conflicts with a server copy." : message
            }
        }

        let normalized = lastError.lowercased()
        let isLegacyServerNewer = normalized.contains("server has newer data")
        let isCurrentServerNewer = normalized.contains("newer version") && normalized.contains("server")
        let isCurrentEqualTimestamp = normalized.contains("changed in two places") && normalized.contains("sync conflict")
        return isLegacyServerNewer || isCurrentServerNewer || isCurrentEqualTimestamp ? lastError : nil
    }
}

private extension Array where Element == ServerUserContentMutation {
    var sortedForLocalApplication: [ServerUserContentMutation] {
        sorted { lhs, rhs in
            let lhsPriority = lhs.localApplicationPriority
            let rhsPriority = rhs.localApplicationPriority
            guard lhsPriority == rhsPriority else { return lhsPriority < rhsPriority }
            return lhs.recordID < rhs.recordID
        }
    }
}

private extension ServerUserContentMutation {
    func removingFieldsSuperseded(by clears: [ServerContinuityRecord]) -> ServerUserContentMutation? {
        let codeVersion: String
        let scopes: Set<String>
        switch self {
        case .savedItem(let record):
            codeVersion = record.codeVersion
            scopes = ["bookmarks"]
        case .annotation(let record):
            codeVersion = record.codeVersion
            scopes = Set([
                record.noteBody != nil ? "notes" : nil,
                record.tags != nil ? "tags" : nil
            ].compactMap { $0 })
        case .project(let record):
            codeVersion = record.codeVersion
            scopes = ["folders"]
        case .projectSection(let record):
            codeVersion = record.codeVersion
            scopes = ["bookmarks", "folders"]
        case .workboard, .continuity, .codeVersionClear:
            return self
        }

        let canonicalCodeVersion = UserContentSyncCodeVersion.server(codeVersion)
        let supersededScopes = Set(clears.compactMap { clear -> String? in
            let scope = clear.values["scope"] ?? ""
            guard scopes.contains(scope) else { return nil }
            guard UserContentSyncCodeVersion.server(clear.codeVersion) == canonicalCodeVersion else { return nil }
            let clearedByEditOrder = clear.updatedAt >= updatedAt
            let clearedByServerOrder: Bool
            if let clearEventID = clear.serverEventID,
               let recordEventID = serverEventID,
               clearEventID > 0,
               recordEventID > 0 {
                clearedByServerOrder = clearEventID >= recordEventID
            } else {
                clearedByServerOrder = false
            }
            return clearedByEditOrder || clearedByServerOrder ? scope : nil
        })
        guard !supersededScopes.isEmpty else { return self }

        guard case .annotation(let record) = self else { return nil }
        let noteBody = supersededScopes.contains("notes") ? nil : record.noteBody
        let tags = supersededScopes.contains("tags") ? nil : record.tags
        guard noteBody != nil || tags != nil else { return nil }
        return .annotation(ServerAnnotationRecord(
            id: record.id,
            userID: record.userID,
            codeVersion: record.codeVersion,
            sectionID: record.sectionID,
            blockID: record.blockID,
            noteBody: noteBody,
            tags: tags,
            updatedAt: record.updatedAt,
            deletedAt: record.deletedAt,
            serverEventID: record.serverEventID
        ))
    }

    var localApplicationPriority: Int {
        switch self {
        case .codeVersionClear:
            return 0
        case .project:
            return 1
        case .savedItem, .annotation, .continuity:
            return 2
        case .projectSection:
            return 3
        case .workboard:
            return 4
        }
    }
}

enum UserContentSyncError: LocalizedError {
    case rejectedByServer(String)

    var errorDescription: String? {
        switch self {
        case .rejectedByServer(let message):
            return message
        }
    }
}
