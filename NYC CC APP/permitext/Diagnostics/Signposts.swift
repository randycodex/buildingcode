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
    let latestEventID: Int64?
    let entitlement: AppEntitlement?
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
}

protocol UserContentSyncBackend {
    var name: String { get }
    func preview(items: [SyncQueueItem]) throws -> UserContentSyncPreviewReport
    func push(batch: UserContentSyncBatch, account: SignedInAccount) async throws -> UserContentSyncPushReport
    func pull(account: SignedInAccount, since: Date?, sinceEventID: Int64?) async throws -> ServerUserContentPullResult
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
            latestEventID: nil,
            entitlement: nil
        )
    }

    func pull(account: SignedInAccount, since: Date?, sinceEventID: Int64?) async throws -> ServerUserContentPullResult {
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
            latestEventID: response.latestEventID ?? response.syncRevision,
            entitlement: response.entitlement
        )
    }

    func pull(account: SignedInAccount, since: Date?, sinceEventID: Int64?) async throws -> ServerUserContentPullResult {
        try await transport.pullUserContent(
            BackendUserContentPullRequest(
                auth: authContext(for: account),
                since: since,
                sinceEventID: sinceEventID
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
            guard item.lastError?.contains("Server has newer data") == true,
                  let mutation = try? ServerUserContentMutation(syncQueueItem: item, account: account)
            else { continue }
            conflictsByRecordID[mutation.recordID] = UserContentSyncConflict(
                recordID: mutation.recordID,
                entityKind: mutation.entityKind,
                message: item.lastError ?? "Server has a newer copy."
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

        let incoming = try await backend.pull(account: account, since: nil, sinceEventID: nil)
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
                checkpoint(for: account).markingPullSucceeded(
                    at: incoming.pulledAt,
                    latestEventID: incoming.latestEventID ?? incoming.syncRevision
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
                mergePlan: UserContentMergePlan(decisions: []),
                entitlement: nil
            )
        }

        let checkpoint = checkpoint(for: account)
        do {
            let incoming = try await backend.pull(
                account: account,
                since: checkpoint.latestEventID == nil ? since ?? checkpoint.lastSuccessfulPullAt : nil,
                sinceEventID: checkpoint.latestEventID
            )
            let resolvedLocalCandidates = try localCandidates.isEmpty
                ? repository?.localMergeCandidates(for: incoming.mutations) ?? [:]
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
                        latestEventID: incoming.latestEventID ?? incoming.syncRevision
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
                entitlement: incoming.entitlement
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
                latestEventID: nil,
                entitlement: nil
            )
        }

        let checkpoint = checkpoint(for: account)
        var attemptedCount = 0
        var completedCount = 0
        var sampledItemIDs: [Int64] = []
        var acceptedMutationIDs: [String] = []
        var rejectedMutationIDs: [String] = []
        var latestEventID = checkpoint.latestEventID
        var entitlement: AppEntitlement?
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
                latestEventID = report.latestEventID ?? latestEventID
                entitlement = report.entitlement ?? entitlement
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
                rejectedMutationIDs: [],
                latestEventID: latestEventID,
                entitlement: nil
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
            latestEventID: latestEventID,
            entitlement: entitlement
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
        var appliedCount = 0
        for mutation in incoming.mutations.sortedForLocalApplication {
            guard let decision = decisionsByID[mutation.recordID] else { continue }
            switch decision.action {
            case .applyServer:
                if case .continuity(let record) = mutation {
                    applyServerContinuity(record)
                } else {
                    try repository.applyServerUserContentMutation(mutation)
                }
                try repository.discardQueuedMutation(recordID: mutation.recordID, account: account)
                appliedCount += 1
            case .deleteLocal:
                try repository.applyServerUserContentMutation(mutation)
                try repository.discardQueuedMutation(recordID: mutation.recordID, account: account)
                appliedCount += 1
            case .noChange:
                // Reapply idempotently so records written under an older code-version
                // alias are moved into the current local version bucket.
                if case .continuity(let record) = mutation {
                    applyServerContinuity(record)
                } else {
                    try repository.applyServerUserContentMutation(mutation)
                }
                continue
            case .keepLocal, .uploadLocal, .flagConflict:
                continue
            }
        }
        return appliedCount
    }

    private func applyServerContinuity(_ record: ServerContinuityRecord) {
        var values = record.values
        if let selectedVersionFileName = values["selectedVersionFileName"] {
            values["selectedVersionFileName"] = UserContentSyncCodeVersion.local(selectedVersionFileName)
        }
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

        let selectedJurisdictionKey = values["selectedJurisdictionKey"].flatMap { $0.isEmpty ? nil : $0 }
            ?? existingContext.selectedJurisdictionKey
        let selectedVersionFileName = values["selectedVersionFileName"].flatMap { $0.isEmpty ? nil : $0 }
            ?? (record.codeVersion.isEmpty
                ? existingContext.selectedVersionFileName
                : UserContentSyncCodeVersion.local(record.codeVersion))
        continuityStore.save(
            ContinuityContext(
                selectedJurisdictionKey: selectedJurisdictionKey,
                selectedVersionFileName: selectedVersionFileName,
                selectedCodeSectionID: values["selectedCodeSectionID"].flatMap(Int64.init),
                lastOpenedChapterID: values["lastOpenedChapterID"].flatMap(Int64.init),
                activeProjectID: values["activeProjectID"].flatMap(Int64.init),
                comparisonModeEnabled: true,
                recentlyViewedSections: recentlyViewedSections
            )
        )
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
