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

struct UserContentSyncBatch: Hashable, Sendable {
    let items: [SyncQueueItem]

    var isEmpty: Bool {
        items.isEmpty
    }
}

protocol UserContentSyncBackend {
    var name: String { get }
    func preview(items: [SyncQueueItem]) throws -> UserContentSyncPreviewReport
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
}

struct UserContentSyncEngine {
    private let repository: UserContentRepository?
    private let backend: UserContentSyncBackend

    init(
        repository: UserContentRepository?,
        backend: UserContentSyncBackend = NoOpUserContentSyncBackend()
    ) {
        self.repository = repository
        self.backend = backend
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
}
