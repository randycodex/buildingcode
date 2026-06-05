import Foundation
import os.signpost

enum AppSignpost {
    static let subsystem = "com.nyccc.app"

    static let reader = OSLog(subsystem: subsystem, category: "Reader")
    static let bundle = OSLog(subsystem: subsystem, category: "Bundle")
    static let search = OSLog(subsystem: subsystem, category: "Search")
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
}

struct UserContentSyncBatch: Hashable, Sendable {
    let items: [SyncQueueItem]

    var isEmpty: Bool {
        items.isEmpty
    }
}

protocol UserContentSyncBackend {
    var name: String { get }
    func preview(items: [SyncQueueItem]) throws -> UserContentSyncPreviewReport
    func push(batch: UserContentSyncBatch, account: SignedInAccount) async throws -> UserContentSyncPushReport
    func pull(account: SignedInAccount, since: Date?) async throws -> ServerUserContentPullResult
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
            rejectedMutationIDs: []
        )
    }

    func pull(account: SignedInAccount, since: Date?) async throws -> ServerUserContentPullResult {
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
            rejectedMutationIDs: response.rejectedMutationIDs ?? []
        )
    }

    func pull(account: SignedInAccount, since: Date?) async throws -> ServerUserContentPullResult {
        try await transport.pullUserContent(
            BackendUserContentPullRequest(
                auth: authContext(for: account),
                since: since
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

    init(
        repository: UserContentRepository?,
        backend: UserContentSyncBackend = NoOpUserContentSyncBackend(),
        checkpointStore: UserContentSyncCheckpointStore = UserContentSyncCheckpointStore()
    ) {
        self.repository = repository
        self.backend = backend
        self.checkpointStore = checkpointStore
    }

    func previewPendingWork(limit: Int = 100) throws -> UserContentSyncPreviewReport {
        guard let repository else {
            return UserContentSyncPreviewReport(
                pendingCount: 0,
                backendName: backend.name,
                sampledItemIDs: []
            )
        }
        let items = try repository.pendingSyncQueueItems(limit: limit)
        return try backend.preview(items: items)
    }

    func claimNextBatch(limit: Int = 25) throws -> UserContentSyncBatch {
        guard let repository else {
            return UserContentSyncBatch(items: [])
        }
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

    func previewMerge(
        incoming: ServerUserContentPullResult,
        localCandidates: [String: UserContentMergeCandidate] = [:]
    ) throws -> UserContentMergePlan {
        try backend.previewMerge(incoming: incoming, localCandidates: localCandidates)
    }

    func pullRemoteChanges(
        account: SignedInAccount?,
        since: Date? = nil,
        localCandidates: [String: UserContentMergeCandidate] = [:],
        applySafeChanges: Bool = false
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
                mergePlan: UserContentMergePlan(decisions: [])
            )
        }

        let checkpoint = checkpoint(for: account)
        do {
            let incoming = try await backend.pull(account: account, since: since ?? checkpoint.lastSuccessfulPullAt)
            let resolvedLocalCandidates = try localCandidates.isEmpty
                ? repository?.localMergeCandidates(for: incoming.mutations) ?? [:]
                : localCandidates
            let mergePlan = try previewMerge(incoming: incoming, localCandidates: resolvedLocalCandidates)
            let appliedCount = try applySafeChanges
                ? applySafeRemoteChanges(incoming: incoming, mergePlan: mergePlan)
                : 0
            checkpointStore.save(checkpoint.markingPullSucceeded(at: incoming.pulledAt))
            return UserContentSyncPullReport(
                pulledCount: incoming.mutations.count,
                appliedCount: appliedCount,
                skippedCount: mergePlan.decisions.count - appliedCount,
                conflictCount: mergePlan.conflictCount,
                backendName: backend.name,
                accountUserID: account.appUserID,
                skippedReason: nil,
                mergePlan: mergePlan
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
                rejectedMutationIDs: []
            )
        }

        let checkpoint = checkpoint(for: account)
        var attemptedCount = 0
        var completedCount = 0
        var sampledItemIDs: [Int64] = []
        var acceptedMutationIDs: [String] = []
        var rejectedMutationIDs: [String] = []
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
                        try? markFailed(item, error: UserContentSyncError.rejectedByServer("Server has newer data for this record. Pull latest changes before retrying."))
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
                rejectedMutationIDs: []
            )
        }

        checkpointStore.save(checkpoint.markingPushSucceeded(at: Date()))
        return UserContentSyncPushReport(
            attemptedCount: attemptedCount,
            completedCount: completedCount,
            backendName: backend.name,
            accountUserID: account.appUserID,
            skippedReason: nil,
            sampledItemIDs: Array(sampledItemIDs.prefix(100)),
            acceptedMutationIDs: acceptedMutationIDs,
            rejectedMutationIDs: rejectedMutationIDs
        )
    }

    func checkpoint(account: SignedInAccount?) -> UserContentSyncCheckpoint? {
        guard let account else { return nil }
        return checkpoint(for: account)
    }

    private func checkpoint(for account: SignedInAccount) -> UserContentSyncCheckpoint {
        checkpointStore.load(accountUserID: account.appUserID, backendName: backend.name)
    }

    private func applySafeRemoteChanges(
        incoming: ServerUserContentPullResult,
        mergePlan: UserContentMergePlan
    ) throws -> Int {
        guard let repository else { return 0 }
        let decisionsByID = Dictionary(uniqueKeysWithValues: mergePlan.decisions.map { ($0.recordID, $0) })
        var appliedCount = 0
        for mutation in incoming.mutations {
            guard let decision = decisionsByID[mutation.recordID] else { continue }
            switch decision.action {
            case .applyServer, .deleteLocal:
                try repository.applyServerUserContentMutation(mutation)
                appliedCount += 1
            case .keepLocal, .uploadLocal, .noChange, .flagConflict:
                continue
            }
        }
        return appliedCount
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
