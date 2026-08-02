import Foundation
import SQLite3

protocol UserContentRepository {
    func bookmarkedSectionIDs(codeVersion: String) throws -> [Int64]
    func bookmarkCount(codeVersion: String) throws -> Int
    func totalBookmarkCount() throws -> Int
    func bookmarkCreatedAtBySectionID(codeVersion: String) throws -> [Int64: Date]
    func isBookmarked(sectionID: Int64, codeVersion: String) throws -> Bool
    func toggleBookmark(sectionID: Int64, codeVersion: String) throws
    func saveSection(_ sectionID: Int64, toFolderIDs folderIDs: Set<Int64>, codeVersion: String) throws
    func noteBody(sectionID: Int64, codeVersion: String) throws -> String
    func noteBody(sectionID: Int64, blockID: String, codeVersion: String) throws -> String
    func noteBlockIDs(sectionID: Int64, codeVersion: String) throws -> [String]
    func noteCount(codeVersion: String) throws -> Int
    func totalNoteCount() throws -> Int
    func noteEntries(codeVersion: String) throws -> [Int64: String]
    func annotationEntries(codeVersion: String) throws -> [UserAnnotationEntry]
    func saveNote(sectionID: Int64, codeVersion: String, body: String) throws
    func saveNote(sectionID: Int64, blockID: String, codeVersion: String, body: String) throws
    func tags(sectionID: Int64, codeVersion: String) throws -> [String]
    func tags(sectionID: Int64, blockID: String, codeVersion: String) throws -> [String]
    func tagsBySectionID(codeVersion: String) throws -> [Int64: [String]]
    func setTags(_ tags: [String], sectionID: Int64, codeVersion: String) throws
    func setTags(_ tags: [String], sectionID: Int64, blockID: String, codeVersion: String) throws
    func tagUsageCounts(codeVersion: String) throws -> [(tag: String, count: Int)]
    func clearTags(sectionID: Int64, codeVersion: String) throws
    func clearBookmarks(codeVersion: String) throws
    func clearNotes(codeVersion: String) throws
    func clearAllTags(codeVersion: String) throws
    func queueContinuityContext(codeVersion: String, values: [String: String]) throws
    func folders(codeVersion: String) throws -> [FolderRecord]
    func folderCount(codeVersion: String) throws -> Int
    func folderMembership(codeVersion: String) throws -> [Int64: [Int64]]
    func sections(inFolder folderID: Int64, codeVersion: String) throws -> [Int64]
    func createFolder(name: String, address: String, description: String, colorHex: String, folderType: CodeFolderType, codeVersion: String) throws -> Int64
    func updateFolder(id: Int64, name: String, address: String, description: String, colorHex: String, folderType: CodeFolderType, codeVersion: String) throws
    func deleteFolder(id: Int64, codeVersion: String) throws
    func addSection(_ sectionID: Int64, toFolder folderID: Int64, codeVersion: String) throws
    func removeSection(_ sectionID: Int64, fromFolder folderID: Int64, codeVersion: String) throws
    func removeSectionFromAllFolders(sectionID: Int64, codeVersion: String) throws
    func clearAllFolders(codeVersion: String) throws
    func pendingSyncQueueItems(limit: Int) throws -> [SyncQueueItem]
    func failedSyncQueueItems(limit: Int) throws -> [SyncQueueItem]
    func prepareSyncQueueForProcessing(now: Date) throws
    func markSyncQueueItemsInFlight(ids: [Int64]) throws
    func markSyncQueueItemSynced(id: Int64) throws
    func markSyncQueueItemFailed(id: Int64, errorMessage: String) throws
    func resetFailedSyncQueueItems() throws
    func retrySyncQueueItems(ids: [Int64], mutationUpdatedAt: Date) throws
    func deleteAllUserData() throws
    func localMergeCandidates(
        for mutations: [ServerUserContentMutation],
        account: SignedInAccount
    ) throws -> [String: UserContentMergeCandidate]
    func discardQueuedMutation(recordID: String, account: SignedInAccount) throws
    func applyServerUserContentMutation(_ mutation: ServerUserContentMutation) throws
}

final class UserDataStore: UserContentRepository {
    private let connection: SQLiteConnection
    private let isoFormatter = ISO8601DateFormatter()
    private let jsonEncoder = JSONEncoder()
    private let jsonDecoder = JSONDecoder()
    private let localOwnerID = UserDataDefaults.localOwnerID
    private let personalVisibility = UserContentVisibility.personal.rawValue
    private let pendingSyncState = UserContentSyncState.pendingUpload.rawValue
    private let localOnlySyncState = UserContentSyncState.localOnly.rawValue
    private let syncedContentState = UserContentSyncState.synced.rawValue
    private let pendingQueueState = SyncQueueState.pending.rawValue
    private let inFlightQueueState = SyncQueueState.inFlight.rawValue
    private let failedQueueState = SyncQueueState.failed.rawValue
    private let syncedQueueState = SyncQueueState.synced.rawValue
    private let staleInFlightInterval: TimeInterval = 10 * 60
    private let maximumAutomaticSyncAttempts = 5

    convenience init() throws {
        let fileManager = FileManager.default
        let baseSupport = try fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let appSupport = baseSupport.appendingPathComponent("permitext", isDirectory: true)
        let legacySupport = baseSupport.appendingPathComponent("NYCCCApp", isDirectory: true)

        if !fileManager.fileExists(atPath: appSupport.path),
           fileManager.fileExists(atPath: legacySupport.path) {
            try fileManager.moveItem(at: legacySupport, to: appSupport)
        }

        try fileManager.createDirectory(at: appSupport, withIntermediateDirectories: true, attributes: nil)
        let databaseURL = appSupport.appendingPathComponent("user_data.sqlite")
        try self.init(databaseURL: databaseURL)
    }

    init(databaseURL: URL) throws {
        connection = try SQLiteConnection(path: databaseURL.path, readOnly: false)
        try createSchema()
    }

    func bookmarkedSectionIDs(codeVersion: String) throws -> [Int64] {
        let statement = try connection.prepare(
            """
            SELECT section_id
            FROM bookmarks
            WHERE code_version = ?
            ORDER BY created_at DESC;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)

        var ids: [Int64] = []
        while try connection.step(statement) == SQLITE_ROW {
            ids.append(connection.int64(at: 0, in: statement))
        }
        return ids
    }

    func bookmarkCount(codeVersion: String) throws -> Int {
        try countRows(
            sql: "SELECT COUNT(*) FROM bookmarks WHERE code_version = ?;",
            codeVersion: codeVersion
        )
    }

    func totalBookmarkCount() throws -> Int {
        try countRows(sql: "SELECT COUNT(*) FROM bookmarks;")
    }

    func bookmarkCreatedAtBySectionID(codeVersion: String) throws -> [Int64: Date] {
        let statement = try connection.prepare(
            """
            SELECT section_id, created_at
            FROM bookmarks
            WHERE code_version = ?;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)

        var result: [Int64: Date] = [:]
        while try connection.step(statement) == SQLITE_ROW {
            let sectionID = connection.int64(at: 0, in: statement)
            if let date = isoFormatter.date(from: connection.string(at: 1, in: statement)) {
                result[sectionID] = date
            }
        }
        return result
    }

    func isBookmarked(sectionID: Int64, codeVersion: String) throws -> Bool {
        let statement = try connection.prepare(
            """
            SELECT 1
            FROM bookmarks
            WHERE section_id = ? AND code_version = ?
            LIMIT 1;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, sectionID)
        try connection.bind(text: codeVersion, index: 2, to: statement)
        return try connection.step(statement) == SQLITE_ROW
    }

    func toggleBookmark(sectionID: Int64, codeVersion: String) throws {
        if try isBookmarked(sectionID: sectionID, codeVersion: codeVersion) {
            let folderTargets = try folderSectionSyncTargets(sectionID: sectionID, codeVersion: codeVersion)
            try performTransaction {
                let statement = try connection.prepare(
                    """
                    DELETE FROM bookmarks
                    WHERE section_id = ? AND code_version = ?;
                    """
                )
                defer { connection.finalize(statement) }
                sqlite3_bind_int64(statement, 1, sectionID)
                try connection.bind(text: codeVersion, index: 2, to: statement)
                _ = try connection.step(statement)

                let folders = try connection.prepare(
                    """
                    DELETE FROM folder_sections
                    WHERE section_id = ? AND code_version = ?;
                    """
                )
                defer { connection.finalize(folders) }
                sqlite3_bind_int64(folders, 1, sectionID)
                try connection.bind(text: codeVersion, index: 2, to: folders)
                _ = try connection.step(folders)

                try enqueueSyncOperation(
                    entityType: .bookmark,
                    operationType: .delete,
                    payload: SyncQueuePayload(codeVersion: codeVersion, sectionID: sectionID)
                )
                for target in folderTargets {
                    try enqueueSyncOperation(
                        entityType: .folderSection,
                        operationType: .delete,
                        payload: SyncQueuePayload(
                            codeVersion: codeVersion,
                            sectionID: sectionID,
                            folderID: target.folderID,
                            values: [
                                "folderClientID": target.folderClientID,
                                "folderType": target.folderType.rawValue
                            ]
                        )
                    )
                }
            }
            return
        }

        let statement = try connection.prepare(
            """
            INSERT INTO bookmarks (
                code_version, section_id, created_at, updated_at, client_id,
                owner_id, visibility, sync_state
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """
        )
        defer { connection.finalize(statement) }
        let now = isoFormatter.string(from: Date())
        try connection.bind(text: codeVersion, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, sectionID)
        try connection.bind(text: now, index: 3, to: statement)
        try connection.bind(text: now, index: 4, to: statement)
        try connection.bind(text: UUID().uuidString, index: 5, to: statement)
        try connection.bind(text: localOwnerID, index: 6, to: statement)
        try connection.bind(text: personalVisibility, index: 7, to: statement)
        try connection.bind(text: pendingSyncState, index: 8, to: statement)
        _ = try connection.step(statement)
        enqueueSyncOperationIfPossible(
            entityType: .bookmark,
            operationType: .upsert,
            payload: SyncQueuePayload(codeVersion: codeVersion, sectionID: sectionID)
        )
    }

    /// Creates one canonical bookmark and its folder memberships as a single
    /// local transaction. A new saved record can never be left unassigned if
    /// one of the destination writes fails.
    func saveSection(_ sectionID: Int64, toFolderIDs folderIDs: Set<Int64>, codeVersion: String) throws {
        guard !folderIDs.isEmpty else {
            throw NSError(
                domain: "UserDataStore",
                code: 3,
                userInfo: [NSLocalizedDescriptionKey: "Choose at least one folder before saving."]
            )
        }

        let destinations = try folderIDs.sorted().map { folderID in
            FolderSectionSyncTarget(
                folderID: folderID,
                folderClientID: try folderClientID(id: folderID, codeVersion: codeVersion),
                folderType: try folderType(id: folderID, codeVersion: codeVersion)
            )
        }
        let existingTargets = try folderSectionSyncTargets(sectionID: sectionID, codeVersion: codeVersion)
        let existingByID = Dictionary(uniqueKeysWithValues: existingTargets.map { ($0.folderID, $0) })
        let destinationByID = Dictionary(uniqueKeysWithValues: destinations.map { ($0.folderID, $0) })
        let alreadyBookmarked = try isBookmarked(sectionID: sectionID, codeVersion: codeVersion)

        try performTransaction {
            if !alreadyBookmarked {
                let bookmark = try connection.prepare(
                    """
                    INSERT INTO bookmarks (
                        code_version, section_id, created_at, updated_at, client_id,
                        owner_id, visibility, sync_state
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                    """
                )
                defer { connection.finalize(bookmark) }
                let now = isoFormatter.string(from: Date())
                try connection.bind(text: codeVersion, index: 1, to: bookmark)
                sqlite3_bind_int64(bookmark, 2, sectionID)
                try connection.bind(text: now, index: 3, to: bookmark)
                try connection.bind(text: now, index: 4, to: bookmark)
                try connection.bind(text: UUID().uuidString, index: 5, to: bookmark)
                try connection.bind(text: localOwnerID, index: 6, to: bookmark)
                try connection.bind(text: personalVisibility, index: 7, to: bookmark)
                try connection.bind(text: pendingSyncState, index: 8, to: bookmark)
                _ = try connection.step(bookmark)
                try enqueueSyncOperation(
                    entityType: .bookmark,
                    operationType: .upsert,
                    payload: SyncQueuePayload(codeVersion: codeVersion, sectionID: sectionID)
                )
            }

            for target in existingTargets where destinationByID[target.folderID] == nil {
                do {
                    let deletion = try connection.prepare(
                        "DELETE FROM folder_sections WHERE folder_id = ? AND section_id = ? AND code_version = ?;"
                    )
                    defer { connection.finalize(deletion) }
                    sqlite3_bind_int64(deletion, 1, target.folderID)
                    sqlite3_bind_int64(deletion, 2, sectionID)
                    try connection.bind(text: codeVersion, index: 3, to: deletion)
                    _ = try connection.step(deletion)
                }
                try enqueueSyncOperation(
                    entityType: .folderSection,
                    operationType: .delete,
                    payload: SyncQueuePayload(
                        codeVersion: codeVersion,
                        sectionID: sectionID,
                        folderID: target.folderID,
                        values: [
                            "folderClientID": target.folderClientID,
                            "folderType": target.folderType.rawValue
                        ]
                    )
                )
            }

            for target in destinations where existingByID[target.folderID] == nil {
                do {
                    let membership = try connection.prepare(
                        """
                        INSERT INTO folder_sections (
                            client_id, owner_id, visibility, sync_state, folder_id,
                            code_version, section_id, added_at, updated_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                        """
                    )
                    defer { connection.finalize(membership) }
                    let now = isoFormatter.string(from: Date())
                    try connection.bind(text: UUID().uuidString, index: 1, to: membership)
                    try connection.bind(text: localOwnerID, index: 2, to: membership)
                    try connection.bind(text: personalVisibility, index: 3, to: membership)
                    try connection.bind(text: pendingSyncState, index: 4, to: membership)
                    sqlite3_bind_int64(membership, 5, target.folderID)
                    try connection.bind(text: codeVersion, index: 6, to: membership)
                    sqlite3_bind_int64(membership, 7, sectionID)
                    try connection.bind(text: now, index: 8, to: membership)
                    try connection.bind(text: now, index: 9, to: membership)
                    _ = try connection.step(membership)
                }
                try enqueueSyncOperation(
                    entityType: .folderSection,
                    operationType: .upsert,
                    payload: SyncQueuePayload(
                        codeVersion: codeVersion,
                        sectionID: sectionID,
                        folderID: target.folderID,
                        values: [
                            "folderClientID": target.folderClientID,
                            "folderType": target.folderType.rawValue
                        ]
                    )
                )
            }
        }
    }

    func noteBody(sectionID: Int64, codeVersion: String) throws -> String {
        try noteBody(sectionID: sectionID, blockID: "", codeVersion: codeVersion)
    }

    func noteBody(sectionID: Int64, blockID: String, codeVersion: String) throws -> String {
        let normalizedBlockID = blockID.trimmingCharacters(in: .whitespacesAndNewlines)
        let statement = try connection.prepare(
            """
            SELECT body
            FROM notes
            WHERE section_id = ? AND code_version = ? AND block_id = ?
            LIMIT 1;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, sectionID)
        try connection.bind(text: codeVersion, index: 2, to: statement)
        try connection.bind(text: normalizedBlockID, index: 3, to: statement)

        guard try connection.step(statement) == SQLITE_ROW else {
            return ""
        }
        return connection.string(at: 0, in: statement)
    }

    func noteBlockIDs(sectionID: Int64, codeVersion: String) throws -> [String] {
        let statement = try connection.prepare(
            """
            SELECT block_id
            FROM notes
            WHERE section_id = ? AND code_version = ? AND block_id <> '' AND TRIM(body) <> ''
            ORDER BY updated_at DESC;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, sectionID)
        try connection.bind(text: codeVersion, index: 2, to: statement)

        var blockIDs: [String] = []
        while try connection.step(statement) == SQLITE_ROW {
            let blockID = connection.string(at: 0, in: statement)
            if !blockID.isEmpty {
                blockIDs.append(blockID)
            }
        }
        return blockIDs
    }

    func noteCount(codeVersion: String) throws -> Int {
        try countRows(
            sql: """
            SELECT COUNT(*)
            FROM notes
            WHERE code_version = ? AND TRIM(body) <> '';
            """,
            codeVersion: codeVersion
        )
    }

    func totalNoteCount() throws -> Int {
        try countRows(
            sql: """
            SELECT COUNT(*)
            FROM notes
            WHERE TRIM(body) <> '';
            """
        )
    }

    func noteEntries(codeVersion: String) throws -> [Int64: String] {
        let statement = try connection.prepare(
            """
            SELECT section_id, body
            FROM notes
            WHERE code_version = ? AND block_id = ''
            ORDER BY updated_at DESC;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)

        var entries: [Int64: String] = [:]
        while try connection.step(statement) == SQLITE_ROW {
            entries[connection.int64(at: 0, in: statement)] = connection.string(at: 1, in: statement)
        }
        return entries
    }

    func annotationEntries(codeVersion: String) throws -> [UserAnnotationEntry] {
        struct Key: Hashable {
            let sectionID: Int64
            let blockID: String
        }

        var notesByKey: [Key: String] = [:]
        let notesStatement = try connection.prepare(
            """
            SELECT section_id, block_id, body
            FROM notes
            WHERE code_version = ? AND TRIM(body) <> ''
            ORDER BY updated_at DESC;
            """
        )
        defer { connection.finalize(notesStatement) }
        try connection.bind(text: codeVersion, index: 1, to: notesStatement)
        while try connection.step(notesStatement) == SQLITE_ROW {
            let key = Key(
                sectionID: connection.int64(at: 0, in: notesStatement),
                blockID: connection.string(at: 1, in: notesStatement)
            )
            notesByKey[key] = connection.string(at: 2, in: notesStatement)
        }

        var tagsByKey: [Key: [String]] = [:]
        let tagsStatement = try connection.prepare(
            """
            SELECT section_id, block_id, tag
            FROM bookmark_tags
            WHERE code_version = ?
            ORDER BY created_at ASC;
            """
        )
        defer { connection.finalize(tagsStatement) }
        try connection.bind(text: codeVersion, index: 1, to: tagsStatement)
        while try connection.step(tagsStatement) == SQLITE_ROW {
            let key = Key(
                sectionID: connection.int64(at: 0, in: tagsStatement),
                blockID: connection.string(at: 1, in: tagsStatement)
            )
            tagsByKey[key, default: []].append(connection.string(at: 2, in: tagsStatement))
        }

        return Array(Set(notesByKey.keys).union(tagsByKey.keys))
            .map { key in
                UserAnnotationEntry(
                    sectionID: key.sectionID,
                    blockID: key.blockID,
                    noteBody: notesByKey[key] ?? "",
                    tags: tagsByKey[key] ?? []
                )
            }
            .filter(\.hasContent)
            .sorted {
                if $0.sectionID != $1.sectionID { return $0.sectionID < $1.sectionID }
                return $0.blockID.localizedStandardCompare($1.blockID) == .orderedAscending
            }
    }

    func saveNote(sectionID: Int64, codeVersion: String, body: String) throws {
        try saveNote(sectionID: sectionID, blockID: "", codeVersion: codeVersion, body: body)
    }

    func saveNote(sectionID: Int64, blockID: String, codeVersion: String, body: String) throws {
        let normalizedBlockID = blockID.trimmingCharacters(in: .whitespacesAndNewlines)
        if body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let statement = try connection.prepare(
                """
                DELETE FROM notes
                WHERE section_id = ? AND code_version = ? AND block_id = ?;
                """
            )
            defer { connection.finalize(statement) }
            sqlite3_bind_int64(statement, 1, sectionID)
            try connection.bind(text: codeVersion, index: 2, to: statement)
            try connection.bind(text: normalizedBlockID, index: 3, to: statement)
            _ = try connection.step(statement)
            var values: [String: String] = [:]
            if !normalizedBlockID.isEmpty {
                values["blockID"] = normalizedBlockID
            }
            enqueueSyncOperationIfPossible(
                entityType: .note,
                operationType: .delete,
                payload: SyncQueuePayload(codeVersion: codeVersion, sectionID: sectionID, values: values)
            )
            return
        }

        let statement = try connection.prepare(
            """
            INSERT INTO notes (
                code_version, section_id, block_id, body, created_at, updated_at, client_id,
                owner_id, visibility, sync_state
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(code_version, section_id, block_id) DO UPDATE SET
                body = excluded.body,
                updated_at = excluded.updated_at,
                sync_state = excluded.sync_state;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, sectionID)
        try connection.bind(text: normalizedBlockID, index: 3, to: statement)
        try connection.bind(text: body, index: 4, to: statement)
        let now = isoFormatter.string(from: Date())
        try connection.bind(text: now, index: 5, to: statement)
        try connection.bind(text: now, index: 6, to: statement)
        try connection.bind(text: UUID().uuidString, index: 7, to: statement)
        try connection.bind(text: localOwnerID, index: 8, to: statement)
        try connection.bind(text: personalVisibility, index: 9, to: statement)
        try connection.bind(text: pendingSyncState, index: 10, to: statement)
        _ = try connection.step(statement)
        var values = ["body": body]
        if !normalizedBlockID.isEmpty {
            values["blockID"] = normalizedBlockID
        }
        enqueueSyncOperationIfPossible(
            entityType: .note,
            operationType: .upsert,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                sectionID: sectionID,
                values: values
            )
        )
    }

    private func createSchema() throws {
        try connection.execute(
            """
            CREATE TABLE IF NOT EXISTS bookmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id TEXT NOT NULL DEFAULT '',
                owner_id TEXT NOT NULL DEFAULT 'local',
                visibility TEXT NOT NULL DEFAULT 'personal',
                sync_state TEXT NOT NULL DEFAULT 'localOnly',
                code_version TEXT NOT NULL,
                section_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT '',
                deleted_at TEXT,
                UNIQUE(code_version, section_id)
            );

            CREATE INDEX IF NOT EXISTS idx_bookmarks_version_created
                ON bookmarks(code_version, created_at DESC);

            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id TEXT NOT NULL DEFAULT '',
                owner_id TEXT NOT NULL DEFAULT 'local',
                visibility TEXT NOT NULL DEFAULT 'personal',
                sync_state TEXT NOT NULL DEFAULT 'localOnly',
                code_version TEXT NOT NULL,
                section_id INTEGER NOT NULL,
                block_id TEXT NOT NULL DEFAULT '',
                body TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                UNIQUE(code_version, section_id, block_id)
            );

            CREATE TABLE IF NOT EXISTS bookmark_tags (
                client_id TEXT NOT NULL DEFAULT '',
                owner_id TEXT NOT NULL DEFAULT 'local',
                visibility TEXT NOT NULL DEFAULT 'personal',
                sync_state TEXT NOT NULL DEFAULT 'localOnly',
                code_version TEXT NOT NULL,
                section_id INTEGER NOT NULL,
                block_id TEXT NOT NULL DEFAULT '',
                tag TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT '',
                deleted_at TEXT,
                PRIMARY KEY(code_version, section_id, block_id, tag)
            );

            CREATE INDEX IF NOT EXISTS idx_bookmark_tags_lookup
                ON bookmark_tags(code_version, tag);

            CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id TEXT NOT NULL DEFAULT '',
                owner_id TEXT NOT NULL DEFAULT 'local',
                visibility TEXT NOT NULL DEFAULT 'personal',
                sync_state TEXT NOT NULL DEFAULT 'localOnly',
                code_version TEXT NOT NULL,
                folder_type TEXT NOT NULL DEFAULT 'project',
                name TEXT NOT NULL,
                address TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                color_hex TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                archived_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT '',
                deleted_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_folders_version
                ON folders(code_version);

            CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_client_id
                ON folders(client_id)
                WHERE client_id <> '';

            CREATE TABLE IF NOT EXISTS folder_sections (
                client_id TEXT NOT NULL DEFAULT '',
                owner_id TEXT NOT NULL DEFAULT 'local',
                visibility TEXT NOT NULL DEFAULT 'personal',
                sync_state TEXT NOT NULL DEFAULT 'localOnly',
                folder_id INTEGER NOT NULL,
                code_version TEXT NOT NULL,
                section_id INTEGER NOT NULL,
                added_at TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT '',
                deleted_at TEXT,
                PRIMARY KEY(folder_id, section_id)
            );

            CREATE INDEX IF NOT EXISTS idx_folder_sections_section
                ON folder_sections(section_id, code_version);

            CREATE INDEX IF NOT EXISTS idx_folder_sections_folder
                ON folder_sections(folder_id);

            CREATE INDEX IF NOT EXISTS idx_folder_sections_version_section
                ON folder_sections(code_version, section_id);

            CREATE INDEX IF NOT EXISTS idx_folder_sections_folder_version_added
                ON folder_sections(folder_id, code_version, added_at);

            CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                operation_type TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                state TEXT NOT NULL DEFAULT 'pending',
                attempt_count INTEGER NOT NULL DEFAULT 0,
                last_error TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                mutation_updated_at TEXT NOT NULL DEFAULT ''
            );

            CREATE INDEX IF NOT EXISTS idx_sync_queue_state_created
                ON sync_queue(state, created_at);
            """
        )
        try migrateSyncColumns()
    }

    private func migrateSyncColumns() throws {
        try addColumnIfMissing(table: "bookmarks", column: "client_id", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "bookmarks", column: "owner_id", definition: "TEXT NOT NULL DEFAULT 'local'")
        try addColumnIfMissing(table: "bookmarks", column: "visibility", definition: "TEXT NOT NULL DEFAULT 'personal'")
        try addColumnIfMissing(table: "bookmarks", column: "sync_state", definition: "TEXT NOT NULL DEFAULT 'localOnly'")
        try addColumnIfMissing(table: "bookmarks", column: "updated_at", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "bookmarks", column: "deleted_at", definition: "TEXT")
        try addColumnIfMissing(table: "notes", column: "client_id", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "notes", column: "owner_id", definition: "TEXT NOT NULL DEFAULT 'local'")
        try addColumnIfMissing(table: "notes", column: "visibility", definition: "TEXT NOT NULL DEFAULT 'personal'")
        try addColumnIfMissing(table: "notes", column: "sync_state", definition: "TEXT NOT NULL DEFAULT 'localOnly'")
        try addColumnIfMissing(table: "notes", column: "created_at", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "notes", column: "deleted_at", definition: "TEXT")
        try addColumnIfMissing(table: "notes", column: "block_id", definition: "TEXT NOT NULL DEFAULT ''")
        try migrateNotesBlockIDConstraintIfNeeded()
        try addColumnIfMissing(table: "bookmark_tags", column: "client_id", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "bookmark_tags", column: "owner_id", definition: "TEXT NOT NULL DEFAULT 'local'")
        try addColumnIfMissing(table: "bookmark_tags", column: "visibility", definition: "TEXT NOT NULL DEFAULT 'personal'")
        try addColumnIfMissing(table: "bookmark_tags", column: "sync_state", definition: "TEXT NOT NULL DEFAULT 'localOnly'")
        try addColumnIfMissing(table: "bookmark_tags", column: "updated_at", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "bookmark_tags", column: "deleted_at", definition: "TEXT")
        try addColumnIfMissing(table: "bookmark_tags", column: "block_id", definition: "TEXT NOT NULL DEFAULT ''")
        try migrateBookmarkTagsBlockIDConstraintIfNeeded()
        try addColumnIfMissing(table: "folders", column: "address", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "folders", column: "client_id", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "folders", column: "owner_id", definition: "TEXT NOT NULL DEFAULT 'local'")
        try addColumnIfMissing(table: "folders", column: "visibility", definition: "TEXT NOT NULL DEFAULT 'personal'")
        try addColumnIfMissing(table: "folders", column: "sync_state", definition: "TEXT NOT NULL DEFAULT 'localOnly'")
        try addColumnIfMissing(table: "folders", column: "updated_at", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "folders", column: "deleted_at", definition: "TEXT")
        try addColumnIfMissing(table: "folders", column: "archived_at", definition: "TEXT")
        try addColumnIfMissing(table: "folders", column: "folder_type", definition: "TEXT NOT NULL DEFAULT 'project'")
        try addColumnIfMissing(table: "folder_sections", column: "client_id", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "folder_sections", column: "owner_id", definition: "TEXT NOT NULL DEFAULT 'local'")
        try addColumnIfMissing(table: "folder_sections", column: "visibility", definition: "TEXT NOT NULL DEFAULT 'personal'")
        try addColumnIfMissing(table: "folder_sections", column: "sync_state", definition: "TEXT NOT NULL DEFAULT 'localOnly'")
        try addColumnIfMissing(table: "folder_sections", column: "updated_at", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "folder_sections", column: "deleted_at", definition: "TEXT")
        try addColumnIfMissing(table: "sync_queue", column: "mutation_updated_at", definition: "TEXT NOT NULL DEFAULT ''")
        try backfillSyncColumns()
    }

    private func addColumnIfMissing(table: String, column: String, definition: String) throws {
        if try !columnNames(in: table).contains(where: { $0.caseInsensitiveCompare(column) == .orderedSame }) {
            try connection.execute("ALTER TABLE \(table) ADD COLUMN \(column) \(definition);")
        }
    }

    private func migrateNotesBlockIDConstraintIfNeeded() throws {
        guard try !hasUniqueIndex(table: "notes", columns: ["code_version", "section_id", "block_id"]) else {
            return
        }

        try performTransaction {
            try connection.execute("ALTER TABLE notes RENAME TO notes_legacy;")
            try connection.execute(
                """
                CREATE TABLE notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    client_id TEXT NOT NULL DEFAULT '',
                    owner_id TEXT NOT NULL DEFAULT 'local',
                    visibility TEXT NOT NULL DEFAULT 'personal',
                    sync_state TEXT NOT NULL DEFAULT 'localOnly',
                    code_version TEXT NOT NULL,
                    section_id INTEGER NOT NULL,
                    block_id TEXT NOT NULL DEFAULT '',
                    body TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT '',
                    updated_at TEXT NOT NULL,
                    deleted_at TEXT,
                    UNIQUE(code_version, section_id, block_id)
                );
                """
            )
            try connection.execute(
                """
                INSERT INTO notes (
                    id, client_id, owner_id, visibility, sync_state, code_version,
                    section_id, block_id, body, created_at, updated_at, deleted_at
                )
                SELECT
                    id, client_id, owner_id, visibility, sync_state, code_version,
                    section_id, COALESCE(block_id, ''), body, created_at, updated_at, deleted_at
                FROM notes_legacy;
                """
            )
            try connection.execute("DROP TABLE notes_legacy;")
        }
    }

    private func migrateBookmarkTagsBlockIDConstraintIfNeeded() throws {
        guard try !hasPrimaryKey(table: "bookmark_tags", columns: ["code_version", "section_id", "block_id", "tag"]) else {
            return
        }

        try performTransaction {
            try connection.execute("ALTER TABLE bookmark_tags RENAME TO bookmark_tags_legacy;")
            try connection.execute(
                """
                CREATE TABLE bookmark_tags (
                    client_id TEXT NOT NULL DEFAULT '',
                    owner_id TEXT NOT NULL DEFAULT 'local',
                    visibility TEXT NOT NULL DEFAULT 'personal',
                    sync_state TEXT NOT NULL DEFAULT 'localOnly',
                    code_version TEXT NOT NULL,
                    section_id INTEGER NOT NULL,
                    block_id TEXT NOT NULL DEFAULT '',
                    tag TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT '',
                    deleted_at TEXT,
                    PRIMARY KEY(code_version, section_id, block_id, tag)
                );
                """
            )
            try connection.execute(
                """
                INSERT INTO bookmark_tags (
                    client_id, owner_id, visibility, sync_state, code_version,
                    section_id, block_id, tag, created_at, updated_at, deleted_at
                )
                SELECT
                    client_id, owner_id, visibility, sync_state, code_version,
                    section_id, COALESCE(block_id, ''), tag, created_at, updated_at, deleted_at
                FROM bookmark_tags_legacy;
                """
            )
            try connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_bookmark_tags_lookup
                    ON bookmark_tags(code_version, tag);
                """
            )
            try connection.execute("DROP TABLE bookmark_tags_legacy;")
        }
    }

    private func hasUniqueIndex(table: String, columns expectedColumns: [String]) throws -> Bool {
        let indexList = try connection.prepare("PRAGMA index_list(\(table));")
        defer { connection.finalize(indexList) }
        while try connection.step(indexList) == SQLITE_ROW {
            guard connection.int(at: 2, in: indexList) == 1 else { continue }
            let indexName = connection.string(at: 1, in: indexList)
            let indexInfo = try connection.prepare("PRAGMA index_info(\(indexName));")
            defer { connection.finalize(indexInfo) }
            var columns: [String] = []
            while try connection.step(indexInfo) == SQLITE_ROW {
                columns.append(connection.string(at: 2, in: indexInfo))
            }
            if columns == expectedColumns {
                return true
            }
        }
        return false
    }

    private func hasPrimaryKey(table: String, columns expectedColumns: [String]) throws -> Bool {
        let statement = try connection.prepare("PRAGMA table_info(\(table));")
        defer { connection.finalize(statement) }

        var columnsByPosition: [Int: String] = [:]
        while try connection.step(statement) == SQLITE_ROW {
            let columnName = connection.string(at: 1, in: statement)
            let position = connection.int(at: 5, in: statement)
            if position > 0 {
                columnsByPosition[position] = columnName
            }
        }

        let actualColumns = columnsByPosition.keys.sorted().compactMap { columnsByPosition[$0] }
        return actualColumns.map { $0.lowercased() } == expectedColumns.map { $0.lowercased() }
    }

    private func columnNames(in table: String) throws -> Set<String> {
        let statement = try connection.prepare("PRAGMA table_info(\(table));")
        defer { connection.finalize(statement) }
        var columns: Set<String> = []
        while try connection.step(statement) == SQLITE_ROW {
            columns.insert(connection.string(at: 1, in: statement))
        }
        return columns
    }

    #if DEBUG
    func debugSchemaValidationMessages() throws -> [String] {
        let requiredColumns: [String: Set<String>] = [
            "bookmarks": [
                "id", "client_id", "owner_id", "visibility", "sync_state",
                "code_version", "section_id", "created_at", "updated_at", "deleted_at"
            ],
            "notes": [
                "id", "client_id", "owner_id", "visibility", "sync_state",
                "code_version", "section_id", "block_id", "body", "created_at", "updated_at", "deleted_at"
            ],
            "bookmark_tags": [
                "client_id", "owner_id", "visibility", "sync_state",
                "code_version", "section_id", "block_id", "tag", "created_at", "updated_at", "deleted_at"
            ],
            "folders": [
                "id", "client_id", "owner_id", "visibility", "sync_state",
                "code_version", "folder_type", "name", "address", "description", "color_hex", "sort_order",
                "archived_at", "created_at", "updated_at", "deleted_at"
            ],
            "folder_sections": [
                "client_id", "owner_id", "visibility", "sync_state", "folder_id",
                "code_version", "section_id", "added_at", "updated_at", "deleted_at"
            ],
            "sync_queue": [
                "id", "client_id", "entity_type", "operation_type", "payload_json",
                "state", "attempt_count", "last_error", "created_at", "updated_at", "mutation_updated_at"
            ]
        ]

        var messages: [String] = []
        for table in requiredColumns.keys.sorted() {
            let actualColumns = try columnNames(in: table)
            let missingColumns = requiredColumns[table, default: []].subtracting(actualColumns)
            if !missingColumns.isEmpty {
                messages.append("\(table) missing columns: \(missingColumns.sorted().joined(separator: ", "))")
            }
        }
        return messages
    }
    #endif

    private func backfillSyncColumns() throws {
        let now = isoFormatter.string(from: Date())
        try connection.execute("UPDATE bookmarks SET client_id = lower(hex(randomblob(16))) WHERE client_id = '';")
        try connection.execute("UPDATE bookmarks SET owner_id = '\(localOwnerID)' WHERE owner_id = '';")
        try connection.execute("UPDATE bookmarks SET visibility = '\(personalVisibility)' WHERE visibility = '';")
        try connection.execute("UPDATE bookmarks SET sync_state = '\(localOnlySyncState)' WHERE sync_state = '';")
        try connection.execute("UPDATE bookmarks SET updated_at = CASE WHEN updated_at = '' THEN created_at ELSE updated_at END;")
        try connection.execute("UPDATE notes SET client_id = lower(hex(randomblob(16))) WHERE client_id = '';")
        try connection.execute("UPDATE notes SET owner_id = '\(localOwnerID)' WHERE owner_id = '';")
        try connection.execute("UPDATE notes SET visibility = '\(personalVisibility)' WHERE visibility = '';")
        try connection.execute("UPDATE notes SET sync_state = '\(localOnlySyncState)' WHERE sync_state = '';")
        try connection.execute("UPDATE notes SET created_at = '\(now)' WHERE created_at = '';")
        try connection.execute("UPDATE bookmark_tags SET client_id = lower(hex(randomblob(16))) WHERE client_id = '';")
        try connection.execute("UPDATE bookmark_tags SET owner_id = '\(localOwnerID)' WHERE owner_id = '';")
        try connection.execute("UPDATE bookmark_tags SET visibility = '\(personalVisibility)' WHERE visibility = '';")
        try connection.execute("UPDATE bookmark_tags SET sync_state = '\(localOnlySyncState)' WHERE sync_state = '';")
        try connection.execute("UPDATE bookmark_tags SET updated_at = CASE WHEN updated_at = '' THEN created_at ELSE updated_at END;")
        try connection.execute("UPDATE bookmark_tags SET block_id = '' WHERE block_id IS NULL;")
        try connection.execute("UPDATE folders SET client_id = lower(hex(randomblob(16))) WHERE client_id = '';")
        try connection.execute("UPDATE folders SET owner_id = '\(localOwnerID)' WHERE owner_id = '';")
        try connection.execute("UPDATE folders SET visibility = '\(personalVisibility)' WHERE visibility = '';")
        try connection.execute("UPDATE folders SET sync_state = '\(localOnlySyncState)' WHERE sync_state = '';")
        try connection.execute("UPDATE folders SET folder_type = 'project' WHERE folder_type IS NULL OR lower(trim(folder_type)) NOT IN ('project', 'reference');")
        try connection.execute("UPDATE folders SET updated_at = CASE WHEN updated_at = '' THEN created_at ELSE updated_at END;")
        try connection.execute("UPDATE folder_sections SET client_id = lower(hex(randomblob(16))) WHERE client_id = '';")
        try connection.execute("UPDATE folder_sections SET owner_id = '\(localOwnerID)' WHERE owner_id = '';")
        try connection.execute("UPDATE folder_sections SET visibility = '\(personalVisibility)' WHERE visibility = '';")
        try connection.execute("UPDATE folder_sections SET sync_state = '\(localOnlySyncState)' WHERE sync_state = '';")
        try connection.execute("UPDATE folder_sections SET updated_at = CASE WHEN updated_at = '' THEN added_at ELSE updated_at END;")
        try connection.execute("UPDATE notes SET updated_at = '\(now)' WHERE updated_at = '';")
        try connection.execute("UPDATE sync_queue SET mutation_updated_at = created_at WHERE mutation_updated_at = '';")
    }

    @discardableResult
    func pendingSyncQueueItems(limit: Int = 100) throws -> [SyncQueueItem] {
        try syncQueueItems(state: pendingQueueState, limit: limit)
    }

    func failedSyncQueueItems(limit: Int = 100) throws -> [SyncQueueItem] {
        try syncQueueItems(state: failedQueueState, limit: limit)
    }

    private func syncQueueItems(state: String, limit: Int) throws -> [SyncQueueItem] {
        let statement = try connection.prepare(
            """
            SELECT id, client_id, entity_type, operation_type, payload_json, state, attempt_count, created_at, updated_at, last_error, mutation_updated_at
            FROM sync_queue
            WHERE state = ?
            ORDER BY created_at ASC, id ASC
            LIMIT ?;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: state, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, Int64(max(limit, 1)))

        var items: [SyncQueueItem] = []
        while try connection.step(statement) == SQLITE_ROW {
            let payloadData = Data(connection.string(at: 4, in: statement).utf8)
            guard let entityType = SyncEntityType(rawValue: connection.string(at: 2, in: statement)),
                  let operationType = SyncOperationType(rawValue: connection.string(at: 3, in: statement)),
                  let payload = try? jsonDecoder.decode(SyncQueuePayload.self, from: payloadData),
                  let state = SyncQueueState(rawValue: connection.string(at: 5, in: statement))
            else {
                continue
            }

            items.append(
                SyncQueueItem(
                    id: connection.int64(at: 0, in: statement),
                    clientID: connection.string(at: 1, in: statement),
                    entityType: entityType,
                    operationType: operationType,
                    payload: payload,
                    state: state,
                    attemptCount: Int(connection.int64(at: 6, in: statement)),
                    createdAt: isoFormatter.date(from: connection.string(at: 7, in: statement)) ?? Date.distantPast,
                    updatedAt: isoFormatter.date(from: connection.string(at: 8, in: statement)) ?? Date.distantPast,
                    mutationUpdatedAt: isoFormatter.date(from: connection.string(at: 10, in: statement)) ?? Date.distantPast,
                    lastError: connection.stringOrNil(at: 9, in: statement)
                )
            )
        }
        return items
    }

    func prepareSyncQueueForProcessing(now: Date = Date()) throws {
        let staleClaimCutoff = isoFormatter.string(from: now.addingTimeInterval(-staleInFlightInterval))
        let recoverStatement = try connection.prepare(
            """
            UPDATE sync_queue
            SET state = ?, updated_at = ?, last_error = ?
            WHERE state = ? AND updated_at <= ?;
            """
        )
        defer { connection.finalize(recoverStatement) }
        try connection.bind(text: pendingQueueState, index: 1, to: recoverStatement)
        try connection.bind(text: isoFormatter.string(from: now), index: 2, to: recoverStatement)
        try connection.bind(text: "Recovered an interrupted sync attempt.", index: 3, to: recoverStatement)
        try connection.bind(text: inFlightQueueState, index: 4, to: recoverStatement)
        try connection.bind(text: staleClaimCutoff, index: 5, to: recoverStatement)
        _ = try connection.step(recoverStatement)

        let failedStatement = try connection.prepare(
            """
            SELECT id, attempt_count, updated_at
            FROM sync_queue
            WHERE state = ? AND attempt_count < ?
            ORDER BY updated_at ASC, id ASC;
            """
        )
        defer { connection.finalize(failedStatement) }
        try connection.bind(text: failedQueueState, index: 1, to: failedStatement)
        sqlite3_bind_int64(failedStatement, 2, Int64(maximumAutomaticSyncAttempts))

        var retryItemIDs: [Int64] = []
        while try connection.step(failedStatement) == SQLITE_ROW {
            let itemID = connection.int64(at: 0, in: failedStatement)
            let attemptCount = max(Int(connection.int64(at: 1, in: failedStatement)), 1)
            let failedAt = isoFormatter.date(from: connection.string(at: 2, in: failedStatement)) ?? .distantPast
            if now.timeIntervalSince(failedAt) >= automaticRetryDelay(attemptCount: attemptCount) {
                retryItemIDs.append(itemID)
            }
        }
        guard !retryItemIDs.isEmpty else { return }

        let retryStatement = try connection.prepare(
            """
            UPDATE sync_queue
            SET state = ?, updated_at = ?
            WHERE id = ? AND state = ?;
            """
        )
        defer { connection.finalize(retryStatement) }
        let retryAt = isoFormatter.string(from: now)
        for itemID in retryItemIDs {
            sqlite3_reset(retryStatement)
            sqlite3_clear_bindings(retryStatement)
            try connection.bind(text: pendingQueueState, index: 1, to: retryStatement)
            try connection.bind(text: retryAt, index: 2, to: retryStatement)
            sqlite3_bind_int64(retryStatement, 3, itemID)
            try connection.bind(text: failedQueueState, index: 4, to: retryStatement)
            _ = try connection.step(retryStatement)
        }
    }

    private func automaticRetryDelay(attemptCount: Int) -> TimeInterval {
        let exponent = min(max(attemptCount - 1, 0), 6)
        return min(5 * pow(2, Double(exponent)), 5 * 60)
    }

    func markSyncQueueItemsInFlight(ids: [Int64]) throws {
        guard !ids.isEmpty else { return }
        let statement = try connection.prepare(
            """
            UPDATE sync_queue
            SET state = ?, updated_at = ?, last_error = NULL
            WHERE id = ? AND state IN (?, ?);
            """
        )
        defer { connection.finalize(statement) }
        let now = isoFormatter.string(from: Date())
        for id in ids {
            sqlite3_reset(statement)
            sqlite3_clear_bindings(statement)
            try connection.bind(text: inFlightQueueState, index: 1, to: statement)
            try connection.bind(text: now, index: 2, to: statement)
            sqlite3_bind_int64(statement, 3, id)
            try connection.bind(text: pendingQueueState, index: 4, to: statement)
            try connection.bind(text: failedQueueState, index: 5, to: statement)
            _ = try connection.step(statement)
        }
    }

    func markSyncQueueItemSynced(id: Int64) throws {
        guard let item = try syncQueueItem(id: id) else { return }
        try performTransaction {
            let statement = try connection.prepare(
                """
                UPDATE sync_queue
                SET state = ?, updated_at = ?, last_error = NULL
                WHERE id = ?;
                """
            )
            defer { connection.finalize(statement) }
            try connection.bind(text: syncedQueueState, index: 1, to: statement)
            try connection.bind(text: isoFormatter.string(from: Date()), index: 2, to: statement)
            sqlite3_bind_int64(statement, 3, id)
            _ = try connection.step(statement)
            if try !hasUnresolvedQueueItem(matching: item, excludingID: id) {
                try markLocalEntitySynced(for: item)
            }
        }
    }

    private func hasUnresolvedQueueItem(matching item: SyncQueueItem, excludingID: Int64) throws -> Bool {
        let statement = try connection.prepare(
            """
            SELECT payload_json
            FROM sync_queue
            WHERE id <> ? AND entity_type = ? AND state <> ?;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, excludingID)
        try connection.bind(text: item.entityType.rawValue, index: 2, to: statement)
        try connection.bind(text: syncedQueueState, index: 3, to: statement)
        while try connection.step(statement) == SQLITE_ROW {
            let data = Data(connection.string(at: 0, in: statement).utf8)
            guard let payload = try? jsonDecoder.decode(SyncQueuePayload.self, from: data) else { continue }
            if queuePayload(payload, matches: item.payload, entityType: item.entityType) {
                return true
            }
        }
        return false
    }

    private func queuePayload(_ lhs: SyncQueuePayload, matches rhs: SyncQueuePayload, entityType: SyncEntityType) -> Bool {
        guard lhs.codeVersion == rhs.codeVersion else { return false }
        switch entityType {
        case .bookmark:
            return lhs.sectionID == rhs.sectionID
        case .note, .tagSet:
            return lhs.sectionID == rhs.sectionID && lhs.values["blockID", default: ""] == rhs.values["blockID", default: ""]
        case .folder:
            if let leftID = lhs.folderID, let rightID = rhs.folderID, leftID == rightID { return true }
            let leftClientID = lhs.clientID ?? lhs.values["clientID"]
            let rightClientID = rhs.clientID ?? rhs.values["clientID"]
            return leftClientID?.isEmpty == false && leftClientID == rightClientID
        case .folderSection:
            return lhs.folderID == rhs.folderID && lhs.sectionID == rhs.sectionID
        case .continuity, .codeVersionUserData:
            return true
        }
    }

    private func markLocalEntitySynced(for item: SyncQueueItem) throws {
        let payload = item.payload
        switch item.entityType {
        case .bookmark:
            guard let sectionID = payload.sectionID else { return }
            let statement = try connection.prepare(
                "UPDATE bookmarks SET sync_state = ? WHERE code_version = ? AND section_id = ?;"
            )
            defer { connection.finalize(statement) }
            try connection.bind(text: syncedContentState, index: 1, to: statement)
            try connection.bind(text: payload.codeVersion, index: 2, to: statement)
            sqlite3_bind_int64(statement, 3, sectionID)
            _ = try connection.step(statement)
        case .note:
            guard let sectionID = payload.sectionID else { return }
            let statement = try connection.prepare(
                "UPDATE notes SET sync_state = ? WHERE code_version = ? AND section_id = ? AND block_id = ?;"
            )
            defer { connection.finalize(statement) }
            try connection.bind(text: syncedContentState, index: 1, to: statement)
            try connection.bind(text: payload.codeVersion, index: 2, to: statement)
            sqlite3_bind_int64(statement, 3, sectionID)
            try connection.bind(text: payload.values["blockID"] ?? "", index: 4, to: statement)
            _ = try connection.step(statement)
        case .tagSet:
            guard let sectionID = payload.sectionID else { return }
            let statement = try connection.prepare(
                "UPDATE bookmark_tags SET sync_state = ? WHERE code_version = ? AND section_id = ? AND block_id = ?;"
            )
            defer { connection.finalize(statement) }
            try connection.bind(text: syncedContentState, index: 1, to: statement)
            try connection.bind(text: payload.codeVersion, index: 2, to: statement)
            sqlite3_bind_int64(statement, 3, sectionID)
            try connection.bind(text: payload.values["blockID"] ?? "", index: 4, to: statement)
            _ = try connection.step(statement)
        case .folder:
            let statement = try connection.prepare(
                "UPDATE folders SET sync_state = ? WHERE code_version = ? AND (id = ? OR client_id = ?);"
            )
            defer { connection.finalize(statement) }
            try connection.bind(text: syncedContentState, index: 1, to: statement)
            try connection.bind(text: payload.codeVersion, index: 2, to: statement)
            sqlite3_bind_int64(statement, 3, payload.folderID ?? -1)
            try connection.bind(text: payload.clientID ?? payload.values["clientID"] ?? "", index: 4, to: statement)
            _ = try connection.step(statement)
        case .folderSection:
            guard let folderID = payload.folderID, let sectionID = payload.sectionID else { return }
            let statement = try connection.prepare(
                "UPDATE folder_sections SET sync_state = ? WHERE code_version = ? AND folder_id = ? AND section_id = ?;"
            )
            defer { connection.finalize(statement) }
            try connection.bind(text: syncedContentState, index: 1, to: statement)
            try connection.bind(text: payload.codeVersion, index: 2, to: statement)
            sqlite3_bind_int64(statement, 3, folderID)
            sqlite3_bind_int64(statement, 4, sectionID)
            _ = try connection.step(statement)
        case .continuity, .codeVersionUserData:
            break
        }
    }

    func markSyncQueueItemFailed(id: Int64, errorMessage: String) throws {
        let statement = try connection.prepare(
            """
            UPDATE sync_queue
            SET state = ?, attempt_count = attempt_count + 1, last_error = ?, updated_at = ?
            WHERE id = ?;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: failedQueueState, index: 1, to: statement)
        try connection.bind(text: String(errorMessage.prefix(500)), index: 2, to: statement)
        try connection.bind(text: isoFormatter.string(from: Date()), index: 3, to: statement)
        sqlite3_bind_int64(statement, 4, id)
        _ = try connection.step(statement)
    }

    func resetFailedSyncQueueItems() throws {
        let statement = try connection.prepare(
            """
            UPDATE sync_queue
            SET state = ?, updated_at = ?
            WHERE state = ?;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: pendingQueueState, index: 1, to: statement)
        try connection.bind(text: isoFormatter.string(from: Date()), index: 2, to: statement)
        try connection.bind(text: failedQueueState, index: 3, to: statement)
        _ = try connection.step(statement)
    }

    func deleteAllUserData() throws {
        try performTransaction {
            for table in [
                "folder_sections",
                "bookmark_tags",
                "notes",
                "bookmarks",
                "folders",
                "sync_queue"
            ] {
                let statement = try connection.prepare("DELETE FROM \(table);")
                defer { connection.finalize(statement) }
                _ = try connection.step(statement)
            }
        }
    }

    func retrySyncQueueItems(ids: [Int64], mutationUpdatedAt: Date) throws {
        guard !ids.isEmpty else { return }
        let statement = try connection.prepare(
            """
            UPDATE sync_queue
            SET state = ?, attempt_count = 0, last_error = NULL,
                updated_at = ?, mutation_updated_at = ?
            WHERE id = ? AND state = ?;
            """
        )
        defer { connection.finalize(statement) }
        let timestamp = isoFormatter.string(from: mutationUpdatedAt)
        for id in ids {
            sqlite3_reset(statement)
            sqlite3_clear_bindings(statement)
            try connection.bind(text: pendingQueueState, index: 1, to: statement)
            try connection.bind(text: timestamp, index: 2, to: statement)
            try connection.bind(text: timestamp, index: 3, to: statement)
            sqlite3_bind_int64(statement, 4, id)
            try connection.bind(text: failedQueueState, index: 5, to: statement)
            _ = try connection.step(statement)
        }
    }

    #if DEBUG
    func debugSyncQueueLifecycleValidationMessages() throws -> [String] {
        let itemID = try enqueueSyncOperation(
            entityType: .codeVersionUserData,
            operationType: .replace,
            payload: SyncQueuePayload(
                codeVersion: "__debug_sync_queue_lifecycle__",
                values: ["scope": "diagnostic"]
            )
        )
        defer { try? deleteSyncQueueItem(id: itemID) }

        guard let originalItem = try syncQueueItem(id: itemID), originalItem.state == .pending else {
            return ["Sync queue lifecycle validation failed before claim."]
        }

        try markSyncQueueItemsInFlight(ids: [itemID])
        guard let claimedItem = try syncQueueItem(id: itemID),
              claimedItem.state == .inFlight,
              claimedItem.mutationUpdatedAt == originalItem.mutationUpdatedAt
        else {
            return ["Sync queue lifecycle validation failed to mark in-flight."]
        }

        try markSyncQueueItemFailed(id: itemID, errorMessage: "debug validation")
        guard let failedItem = try syncQueueItem(id: itemID),
              failedItem.state == .failed,
              failedItem.attemptCount > 0
        else {
            return ["Sync queue lifecycle validation failed to record failure."]
        }

        try prepareSyncQueueForProcessing(now: failedItem.updatedAt.addingTimeInterval(automaticRetryDelay(attemptCount: failedItem.attemptCount) + 1))
        guard try syncQueueItem(id: itemID)?.state == .pending else {
            return ["Sync queue lifecycle validation failed to prepare automatic retry."]
        }

        try markSyncQueueItemsInFlight(ids: [itemID])
        let interruptedItem = try syncQueueItem(id: itemID)
        try prepareSyncQueueForProcessing(now: (interruptedItem?.updatedAt ?? Date()).addingTimeInterval(staleInFlightInterval + 1))
        guard try syncQueueItem(id: itemID)?.state == .pending else {
            return ["Sync queue lifecycle validation failed to recover an interrupted claim."]
        }

        try markSyncQueueItemSynced(id: itemID)
        guard try syncQueueItem(id: itemID)?.state == .synced else {
            return ["Sync queue lifecycle validation failed to mark synced."]
        }

        return []
    }
    #endif

    @discardableResult
    private func enqueueSyncOperation(
        entityType: SyncEntityType,
        operationType: SyncOperationType,
        payload: SyncQueuePayload
    ) throws -> Int64 {
        let payloadData = try jsonEncoder.encode(payload)
        guard let payloadJSON = String(data: payloadData, encoding: .utf8) else {
            throw NSError(
                domain: "UserDataStore",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Unable to encode sync queue payload."]
            )
        }

        let statement = try connection.prepare(
            """
            INSERT INTO sync_queue (
                client_id, entity_type, operation_type, payload_json, state,
                attempt_count, created_at, updated_at, mutation_updated_at
            )
            VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?);
            """
        )
        defer { connection.finalize(statement) }
        let now = isoFormatter.string(from: Date())
        try connection.bind(text: UUID().uuidString, index: 1, to: statement)
        try connection.bind(text: entityType.rawValue, index: 2, to: statement)
        try connection.bind(text: operationType.rawValue, index: 3, to: statement)
        try connection.bind(text: payloadJSON, index: 4, to: statement)
        try connection.bind(text: pendingQueueState, index: 5, to: statement)
        try connection.bind(text: now, index: 6, to: statement)
        try connection.bind(text: now, index: 7, to: statement)
        try connection.bind(text: now, index: 8, to: statement)
        _ = try connection.step(statement)
        return connection.lastInsertedRowID()
    }

    private func enqueueSyncOperationIfPossible(
        entityType: SyncEntityType,
        operationType: SyncOperationType,
        payload: SyncQueuePayload
    ) {
        do {
            try enqueueSyncOperation(entityType: entityType, operationType: operationType, payload: payload)
        } catch {
            #if DEBUG
            print("permitext diagnostics: sync queue insert failed: \(error.localizedDescription)")
            #endif
        }
    }

    func queueContinuityContext(codeVersion: String, values: [String: String]) throws {
        guard !codeVersion.isEmpty else { return }
        try coalescePendingContinuityQueueItems()
        try enqueueSyncOperation(
            entityType: .continuity,
            operationType: .replace,
            payload: SyncQueuePayload(codeVersion: codeVersion, values: values)
        )
    }

    private func coalescePendingContinuityQueueItems() throws {
        let statement = try connection.prepare(
            """
            DELETE FROM sync_queue
            WHERE entity_type = ?
              AND state = ?;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: SyncEntityType.continuity.rawValue, index: 1, to: statement)
        try connection.bind(text: pendingQueueState, index: 2, to: statement)
        _ = try connection.step(statement)
    }

    private func syncQueueItem(id: Int64) throws -> SyncQueueItem? {
        let statement = try connection.prepare(
            """
            SELECT id, client_id, entity_type, operation_type, payload_json, state, attempt_count, created_at, updated_at, last_error, mutation_updated_at
            FROM sync_queue
            WHERE id = ?
            LIMIT 1;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, id)
        guard try connection.step(statement) == SQLITE_ROW else { return nil }
        return syncQueueItem(from: statement)
    }

    private func syncQueueItem(from statement: OpaquePointer) -> SyncQueueItem? {
        let payloadData = Data(connection.string(at: 4, in: statement).utf8)
        guard let entityType = SyncEntityType(rawValue: connection.string(at: 2, in: statement)),
              let operationType = SyncOperationType(rawValue: connection.string(at: 3, in: statement)),
              let payload = try? jsonDecoder.decode(SyncQueuePayload.self, from: payloadData),
              let state = SyncQueueState(rawValue: connection.string(at: 5, in: statement))
        else {
            return nil
        }

        return SyncQueueItem(
            id: connection.int64(at: 0, in: statement),
            clientID: connection.string(at: 1, in: statement),
            entityType: entityType,
            operationType: operationType,
            payload: payload,
            state: state,
            attemptCount: Int(connection.int64(at: 6, in: statement)),
            createdAt: isoFormatter.date(from: connection.string(at: 7, in: statement)) ?? Date.distantPast,
            updatedAt: isoFormatter.date(from: connection.string(at: 8, in: statement)) ?? Date.distantPast,
            mutationUpdatedAt: isoFormatter.date(from: connection.string(at: 10, in: statement)) ?? Date.distantPast,
            lastError: connection.stringOrNil(at: 9, in: statement)
        )
    }

    private func deleteSyncQueueItem(id: Int64) throws {
        let statement = try connection.prepare(
            """
            DELETE FROM sync_queue
            WHERE id = ?;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, id)
        _ = try connection.step(statement)
    }


    // MARK: - Tags

    /// Returns the tags associated with a single annotation target, in the
    /// order they were added (oldest first).
    func tags(sectionID: Int64, codeVersion: String) throws -> [String] {
        try tags(sectionID: sectionID, blockID: "", codeVersion: codeVersion)
    }

    func tags(sectionID: Int64, blockID: String, codeVersion: String) throws -> [String] {
        let normalizedBlockID = blockID.trimmingCharacters(in: .whitespacesAndNewlines)
        let statement = try connection.prepare(
            """
            SELECT tag
            FROM bookmark_tags
            WHERE code_version = ? AND section_id = ? AND block_id = ?
            ORDER BY created_at ASC;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, sectionID)
        try connection.bind(text: normalizedBlockID, index: 3, to: statement)

        var tags: [String] = []
        while try connection.step(statement) == SQLITE_ROW {
            tags.append(connection.string(at: 0, in: statement))
        }
        return tags
    }

    /// Returns every tagged section for the given code version, keyed by
    /// sectionID. Used by the bookmarks list so we can show tag chips without
    /// running a query per row.
    func tagsBySectionID(codeVersion: String) throws -> [Int64: [String]] {
        let statement = try connection.prepare(
            """
            SELECT section_id, tag, MIN(created_at) AS first_created
            FROM bookmark_tags
            WHERE code_version = ?
            GROUP BY section_id, tag
            ORDER BY section_id ASC, first_created ASC;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)

        var entries: [Int64: [String]] = [:]
        while try connection.step(statement) == SQLITE_ROW {
            let sectionID = connection.int64(at: 0, in: statement)
            let tag = connection.string(at: 1, in: statement)
            entries[sectionID, default: []].append(tag)
        }
        return entries
    }

    /// Replaces the tag set for one annotation target. Empty `tags` clears the row.
    func setTags(_ tags: [String], sectionID: Int64, codeVersion: String) throws {
        try setTags(tags, sectionID: sectionID, blockID: "", codeVersion: codeVersion)
    }

    func setTags(_ tags: [String], sectionID: Int64, blockID: String, codeVersion: String) throws {
        let normalizedBlockID = blockID.trimmingCharacters(in: .whitespacesAndNewlines)
        // Normalize: trim, drop empty, de-dupe case-insensitively while
        // preserving the user's preferred casing (first occurrence wins).
        var seen = Set<String>()
        let cleaned = tags
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .filter { seen.insert($0.lowercased()).inserted }

        try connection.execute("BEGIN IMMEDIATE TRANSACTION;")
        do {
            let delete = try connection.prepare(
                """
                DELETE FROM bookmark_tags
                WHERE code_version = ? AND section_id = ? AND block_id = ?;
                """
            )
            defer { connection.finalize(delete) }
            try connection.bind(text: codeVersion, index: 1, to: delete)
            sqlite3_bind_int64(delete, 2, sectionID)
            try connection.bind(text: normalizedBlockID, index: 3, to: delete)
            _ = try connection.step(delete)

            if !cleaned.isEmpty {
                let timestamp = isoFormatter.string(from: Date())
                let insert = try connection.prepare(
                    """
                    INSERT INTO bookmark_tags (
                        code_version, section_id, block_id, tag, created_at, updated_at, client_id,
                        owner_id, visibility, sync_state
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """
                )
                defer { connection.finalize(insert) }

                for tag in cleaned {
                    sqlite3_reset(insert)
                    sqlite3_clear_bindings(insert)
                    try connection.bind(text: codeVersion, index: 1, to: insert)
                    sqlite3_bind_int64(insert, 2, sectionID)
                    try connection.bind(text: normalizedBlockID, index: 3, to: insert)
                    try connection.bind(text: tag, index: 4, to: insert)
                    try connection.bind(text: timestamp, index: 5, to: insert)
                    try connection.bind(text: timestamp, index: 6, to: insert)
                    try connection.bind(text: UUID().uuidString, index: 7, to: insert)
                    try connection.bind(text: localOwnerID, index: 8, to: insert)
                    try connection.bind(text: personalVisibility, index: 9, to: insert)
                    try connection.bind(text: pendingSyncState, index: 10, to: insert)
                    _ = try connection.step(insert)
                }
            }

            try connection.execute("COMMIT;")
            var values = ["tags": cleaned.joined(separator: "\n")]
            if !normalizedBlockID.isEmpty {
                values["blockID"] = normalizedBlockID
            }
            enqueueSyncOperationIfPossible(
                entityType: .tagSet,
                operationType: .replace,
                payload: SyncQueuePayload(
                    codeVersion: codeVersion,
                    sectionID: sectionID,
                    values: values
                )
            )
        } catch {
            try? connection.execute("ROLLBACK;")
            throw error
        }
    }

    /// Returns every distinct tag in use for this code version with the
    /// number of bookmarks that carry it. Powers the tag chip filter on
    /// the Saved screen.
    func tagUsageCounts(codeVersion: String) throws -> [(tag: String, count: Int)] {
        let statement = try connection.prepare(
            """
            SELECT tag, COUNT(*) AS uses
            FROM bookmark_tags
            WHERE code_version = ?
            GROUP BY tag
            ORDER BY uses DESC, tag COLLATE NOCASE ASC;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)

        var rows: [(tag: String, count: Int)] = []
        while try connection.step(statement) == SQLITE_ROW {
            let tag = connection.string(at: 0, in: statement)
            let count = Int(connection.int64(at: 1, in: statement))
            rows.append((tag, count))
        }
        return rows
    }

    /// Removes all tags belonging to a section. Empty blockID targets section-level tags.
    func clearTags(sectionID: Int64, codeVersion: String) throws {
        try clearTags(sectionID: sectionID, blockID: "", codeVersion: codeVersion)
    }

    func clearTags(sectionID: Int64, blockID: String, codeVersion: String) throws {
        let normalizedBlockID = blockID.trimmingCharacters(in: .whitespacesAndNewlines)
        let statement = try connection.prepare(
            """
            DELETE FROM bookmark_tags
            WHERE code_version = ? AND section_id = ? AND block_id = ?;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, sectionID)
        try connection.bind(text: normalizedBlockID, index: 3, to: statement)
        _ = try connection.step(statement)
        var values: [String: String] = [:]
        if !normalizedBlockID.isEmpty {
            values["blockID"] = normalizedBlockID
        }
        enqueueSyncOperationIfPossible(
            entityType: .tagSet,
            operationType: .delete,
            payload: SyncQueuePayload(codeVersion: codeVersion, sectionID: sectionID, values: values)
        )
    }

    func clearBookmarks(codeVersion: String) throws {
        try performTransaction {
            for equivalentVersion in UserContentSyncCodeVersion.equivalentLocalVersions(codeVersion) {
                try deleteRows(sql: "DELETE FROM bookmarks WHERE code_version = ?;", codeVersion: equivalentVersion)
                // Folder membership references bookmarks. Wipe the junction so
                // folders don't keep ghost section IDs after Clear Bookmarks.
                try deleteRows(sql: "DELETE FROM folder_sections WHERE code_version = ?;", codeVersion: equivalentVersion)
            }
        }

        enqueueSyncOperationIfPossible(
            entityType: .codeVersionUserData,
            operationType: .delete,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                values: ["scope": "bookmarks"]
            )
        )
    }

    func clearNotes(codeVersion: String) throws {
        for equivalentVersion in UserContentSyncCodeVersion.equivalentLocalVersions(codeVersion) {
            try deleteRows(sql: "DELETE FROM notes WHERE code_version = ?;", codeVersion: equivalentVersion)
        }
        enqueueSyncOperationIfPossible(
            entityType: .codeVersionUserData,
            operationType: .delete,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                values: ["scope": "notes"]
            )
        )
    }

    /// Removes every tag for the given code version. Bookmarks and notes are kept.
    func clearAllTags(codeVersion: String) throws {
        for equivalentVersion in UserContentSyncCodeVersion.equivalentLocalVersions(codeVersion) {
            try deleteRows(sql: "DELETE FROM bookmark_tags WHERE code_version = ?;", codeVersion: equivalentVersion)
        }
        enqueueSyncOperationIfPossible(
            entityType: .codeVersionUserData,
            operationType: .delete,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                values: ["scope": "tags"]
            )
        )
    }

    // MARK: - Folders

    /// All folders for a code version, ordered by sort_order then name.
    func folders(codeVersion: String) throws -> [FolderRecord] {
        let statement = try connection.prepare(
            """
            SELECT id, client_id, owner_id, visibility, sync_state, deleted_at, name, address, description, color_hex, folder_type, sort_order, created_at, updated_at
            FROM folders
            WHERE code_version = ? AND archived_at IS NULL
            ORDER BY sort_order ASC, name COLLATE NOCASE ASC;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)

        var results: [FolderRecord] = []
        while try connection.step(statement) == SQLITE_ROW {
            results.append(
                FolderRecord(
                    id: connection.int64(at: 0, in: statement),
                    clientID: connection.string(at: 1, in: statement),
                    ownerID: connection.string(at: 2, in: statement),
                    visibility: connection.string(at: 3, in: statement),
                    syncState: connection.string(at: 4, in: statement),
                    deletedAt: connection.stringOrNil(at: 5, in: statement),
                    name: connection.string(at: 6, in: statement),
                    address: connection.string(at: 7, in: statement),
                    description: connection.string(at: 8, in: statement),
                    colorHex: connection.string(at: 9, in: statement),
                    folderType: connection.string(at: 10, in: statement),
                    sortOrder: Int(connection.int64(at: 11, in: statement)),
                    createdAt: connection.string(at: 12, in: statement),
                    updatedAt: connection.string(at: 13, in: statement)
                )
            )
        }
        return results
    }

    func folderCount(codeVersion: String) throws -> Int {
        try countRows(
            sql: "SELECT COUNT(*) FROM folders WHERE code_version = ? AND archived_at IS NULL;",
            codeVersion: codeVersion
        )
    }

    /// Returns sectionID → [folderID] for every folder membership in the
    /// version. The view model uses this to render the Projects row in the
    /// Reader without a per-section round trip.
    func folderMembership(codeVersion: String) throws -> [Int64: [Int64]] {
        let statement = try connection.prepare(
            """
            SELECT section_id, folder_id
            FROM folder_sections
            WHERE code_version = ?;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)

        var result: [Int64: [Int64]] = [:]
        while try connection.step(statement) == SQLITE_ROW {
            let sectionID = connection.int64(at: 0, in: statement)
            let folderID = connection.int64(at: 1, in: statement)
            result[sectionID, default: []].append(folderID)
        }
        return result
    }

    /// Returns sectionIDs that belong to a given folder, ordered by when
    /// they were added (oldest first so the user's project reads forward).
    func sections(inFolder folderID: Int64, codeVersion: String) throws -> [Int64] {
        let statement = try connection.prepare(
            """
            SELECT section_id
            FROM folder_sections
            WHERE folder_id = ? AND code_version = ?
            ORDER BY added_at ASC;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, folderID)
        try connection.bind(text: codeVersion, index: 2, to: statement)

        var sectionIDs: [Int64] = []
        while try connection.step(statement) == SQLITE_ROW {
            sectionIDs.append(connection.int64(at: 0, in: statement))
        }
        return sectionIDs
    }

    @discardableResult
    func createFolder(
        name: String,
        address: String,
        description: String,
        colorHex: String,
        folderType: CodeFolderType = .project,
        codeVersion: String
    ) throws -> Int64 {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            throw NSError(
                domain: "UserDataStore",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Folder name cannot be empty."]
            )
        }

        // sort_order = max(existing) + 1 so new folders land at the end of
        // the list until the user reorders.
        let nextSortOrder: Int = {
            guard let stmt = try? connection.prepare(
                "SELECT COALESCE(MAX(sort_order), -1) FROM folders WHERE code_version = ?;"
            ) else { return 0 }
            defer { connection.finalize(stmt) }
            try? connection.bind(text: codeVersion, index: 1, to: stmt)
            return ((try? connection.step(stmt)) == SQLITE_ROW)
                ? Int(connection.int64(at: 0, in: stmt)) + 1
                : 0
        }()

        let clientID = UUID().uuidString
        let statement = try connection.prepare(
            """
            INSERT INTO folders (
                client_id, owner_id, visibility, sync_state, code_version, name,
                address, description, color_hex, folder_type, sort_order, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """
        )
        defer { connection.finalize(statement) }
        let now = isoFormatter.string(from: Date())
        try connection.bind(text: clientID, index: 1, to: statement)
        try connection.bind(text: localOwnerID, index: 2, to: statement)
        try connection.bind(text: personalVisibility, index: 3, to: statement)
        try connection.bind(text: pendingSyncState, index: 4, to: statement)
        try connection.bind(text: codeVersion, index: 5, to: statement)
        try connection.bind(text: trimmedName, index: 6, to: statement)
        try connection.bind(text: address, index: 7, to: statement)
        try connection.bind(text: description, index: 8, to: statement)
        try connection.bind(text: colorHex, index: 9, to: statement)
        try connection.bind(text: folderType.rawValue, index: 10, to: statement)
        sqlite3_bind_int64(statement, 11, Int64(nextSortOrder))
        try connection.bind(text: now, index: 12, to: statement)
        try connection.bind(text: now, index: 13, to: statement)
        _ = try connection.step(statement)

        let folderID = connection.lastInsertedRowID()
        enqueueSyncOperationIfPossible(
            entityType: .folder,
            operationType: .upsert,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                folderID: folderID,
                clientID: clientID,
                values: [
                    "name": trimmedName,
                    "address": address,
                    "description": description,
                    "colorHex": colorHex,
                    "folderType": folderType.rawValue,
                    "sortOrder": String(nextSortOrder)
                ]
            )
        )
        return folderID
    }

    func updateFolder(
        id: Int64,
        name: String,
        address: String,
        description: String,
        colorHex: String,
        folderType: CodeFolderType = .project,
        codeVersion: String
    ) throws {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            throw NSError(
                domain: "UserDataStore",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Folder name cannot be empty."]
            )
        }
        let clientID = try folderClientID(id: id, codeVersion: codeVersion)

        let statement = try connection.prepare(
            """
            UPDATE folders
            SET name = ?, address = ?, description = ?, color_hex = ?, folder_type = ?, updated_at = ?, sync_state = ?
            WHERE id = ? AND code_version = ?;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: trimmedName, index: 1, to: statement)
        try connection.bind(text: address, index: 2, to: statement)
        try connection.bind(text: description, index: 3, to: statement)
        try connection.bind(text: colorHex, index: 4, to: statement)
        try connection.bind(text: folderType.rawValue, index: 5, to: statement)
        try connection.bind(text: isoFormatter.string(from: Date()), index: 6, to: statement)
        try connection.bind(text: pendingSyncState, index: 7, to: statement)
        sqlite3_bind_int64(statement, 8, id)
        try connection.bind(text: codeVersion, index: 9, to: statement)
        _ = try connection.step(statement)
        enqueueSyncOperationIfPossible(
            entityType: .folder,
            operationType: .upsert,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                folderID: id,
                clientID: clientID,
                values: [
                    "name": trimmedName,
                    "address": address,
                    "description": description,
                    "colorHex": colorHex,
                    "folderType": folderType.rawValue
                ]
            )
        )
    }

    func deleteFolder(id: Int64, codeVersion: String) throws {
        let clientID = try folderClientID(id: id, codeVersion: codeVersion)
        let folderType = try folderType(id: id, codeVersion: codeVersion)
        let sectionIDs = try sectionIDs(inFolder: id, codeVersion: codeVersion)
        try performTransaction {
            // Manual cascade — folder_sections doesn't have a FK constraint, so
            // we wipe membership rows first.
            let cascade = try connection.prepare(
                """
                DELETE FROM folder_sections
                WHERE folder_id = ?;
                """
            )
            defer { connection.finalize(cascade) }
            sqlite3_bind_int64(cascade, 1, id)
            _ = try connection.step(cascade)

            let statement = try connection.prepare(
                """
                DELETE FROM folders
                WHERE id = ? AND code_version = ?;
                """
            )
            defer { connection.finalize(statement) }
            sqlite3_bind_int64(statement, 1, id)
            try connection.bind(text: codeVersion, index: 2, to: statement)
            _ = try connection.step(statement)

            for sectionID in sectionIDs {
                try enqueueSyncOperation(
                    entityType: .folderSection,
                    operationType: .delete,
                    payload: SyncQueuePayload(
                        codeVersion: codeVersion,
                        sectionID: sectionID,
                        folderID: id,
                        values: ["folderClientID": clientID]
                    )
                )
            }
            try enqueueSyncOperation(
                entityType: .folder,
                operationType: .delete,
                payload: SyncQueuePayload(
                    codeVersion: codeVersion,
                    folderID: id,
                    clientID: clientID,
                    values: ["folderType": folderType.rawValue]
                )
            )
        }
    }

    private func sectionIDs(inFolder folderID: Int64, codeVersion: String) throws -> [Int64] {
        let statement = try connection.prepare(
            """
            SELECT section_id
            FROM folder_sections
            WHERE folder_id = ? AND code_version = ?;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, folderID)
        try connection.bind(text: codeVersion, index: 2, to: statement)

        var sectionIDs: [Int64] = []
        while try connection.step(statement) == SQLITE_ROW {
            sectionIDs.append(connection.int64(at: 0, in: statement))
        }
        return sectionIDs
    }

    private func folderClientID(id: Int64, codeVersion: String) throws -> String {
        let statement = try connection.prepare(
            """
            SELECT client_id
            FROM folders
            WHERE id = ? AND code_version = ?
            LIMIT 1;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, id)
        try connection.bind(text: codeVersion, index: 2, to: statement)
        guard try connection.step(statement) == SQLITE_ROW else {
            throw NSError(
                domain: "UserDataStore",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Project folder was not found."]
            )
        }
        return connection.string(at: 0, in: statement)
    }

    private func folderType(id: Int64, codeVersion: String) throws -> CodeFolderType {
        let statement = try connection.prepare(
            "SELECT folder_type FROM folders WHERE id = ? AND code_version = ? LIMIT 1;"
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, id)
        try connection.bind(text: codeVersion, index: 2, to: statement)
        guard try connection.step(statement) == SQLITE_ROW else {
            throw NSError(
                domain: "UserDataStore",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Folder was not found."]
            )
        }
        return CodeFolderType(serverValue: connection.stringOrNil(at: 0, in: statement))
    }

    private func localFolderIDs(clientID: String?, codeVersion: String) throws -> [Int64] {
        guard let identity = UserContentProjectIdentity.stable(clientID) else { return [] }
        let statement = try connection.prepare(
            """
            SELECT id, client_id, owner_id
            FROM folders
            WHERE code_version = ?
            ORDER BY id ASC;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)

        var matches: [Int64] = []
        while try connection.step(statement) == SQLITE_ROW {
            let storedClientID = connection.string(at: 1, in: statement)
            let ownerID = connection.string(at: 2, in: statement)
            if UserContentProjectIdentity.stable(storedClientID, userID: ownerID) == identity ||
                UserContentProjectIdentity.stable(storedClientID) == identity {
                matches.append(connection.int64(at: 0, in: statement))
            }
        }
        return matches
    }

    private func localFolderID(clientID: String?, codeVersion: String) throws -> Int64? {
        try localFolderIDs(clientID: clientID, codeVersion: codeVersion).first
    }

    func addSection(_ sectionID: Int64, toFolder folderID: Int64, codeVersion: String) throws {
        let folderClientID = try folderClientID(id: folderID, codeVersion: codeVersion)
        let folderType = try folderType(id: folderID, codeVersion: codeVersion)
        let statement = try connection.prepare(
            """
            INSERT OR IGNORE INTO folder_sections (
                client_id, owner_id, visibility, sync_state, folder_id,
                code_version, section_id, added_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """
        )
        defer { connection.finalize(statement) }
        let now = isoFormatter.string(from: Date())
        try connection.bind(text: UUID().uuidString, index: 1, to: statement)
        try connection.bind(text: localOwnerID, index: 2, to: statement)
        try connection.bind(text: personalVisibility, index: 3, to: statement)
        try connection.bind(text: pendingSyncState, index: 4, to: statement)
        sqlite3_bind_int64(statement, 5, folderID)
        try connection.bind(text: codeVersion, index: 6, to: statement)
        sqlite3_bind_int64(statement, 7, sectionID)
        try connection.bind(text: now, index: 8, to: statement)
        try connection.bind(text: now, index: 9, to: statement)
        _ = try connection.step(statement)
        enqueueSyncOperationIfPossible(
            entityType: .folderSection,
            operationType: .upsert,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                sectionID: sectionID,
                folderID: folderID,
                values: [
                    "folderClientID": folderClientID,
                    "folderType": folderType.rawValue
                ]
            )
        )
    }

    func removeSection(_ sectionID: Int64, fromFolder folderID: Int64, codeVersion: String) throws {
        let folderClientID = try folderClientID(id: folderID, codeVersion: codeVersion)
        let folderType = try folderType(id: folderID, codeVersion: codeVersion)
        try performTransaction {
            let statement = try connection.prepare(
                """
                DELETE FROM folder_sections
                WHERE folder_id = ? AND section_id = ? AND code_version = ?;
                """
            )
            defer { connection.finalize(statement) }
            sqlite3_bind_int64(statement, 1, folderID)
            sqlite3_bind_int64(statement, 2, sectionID)
            try connection.bind(text: codeVersion, index: 3, to: statement)
            _ = try connection.step(statement)
            try enqueueSyncOperation(
                entityType: .folderSection,
                operationType: .delete,
                payload: SyncQueuePayload(
                    codeVersion: codeVersion,
                    sectionID: sectionID,
                    folderID: folderID,
                    values: [
                        "folderClientID": folderClientID,
                        "folderType": folderType.rawValue
                    ]
                )
            )
        }
    }

    /// Removes a section from every folder it belongs to. Called by
    /// toggleBookmark when a bookmark is removed so a section stripped of
    /// its bookmark doesn't keep showing up in folder filters.
    func removeSectionFromAllFolders(sectionID: Int64, codeVersion: String) throws {
        let folderTargets = try folderSectionSyncTargets(sectionID: sectionID, codeVersion: codeVersion)
        try performTransaction {
            let statement = try connection.prepare(
                """
                DELETE FROM folder_sections
                WHERE section_id = ? AND code_version = ?;
                """
            )
            defer { connection.finalize(statement) }
            sqlite3_bind_int64(statement, 1, sectionID)
            try connection.bind(text: codeVersion, index: 2, to: statement)
            _ = try connection.step(statement)
            for target in folderTargets {
                try enqueueSyncOperation(
                    entityType: .folderSection,
                    operationType: .delete,
                    payload: SyncQueuePayload(
                        codeVersion: codeVersion,
                        sectionID: sectionID,
                        folderID: target.folderID,
                        values: [
                            "folderClientID": target.folderClientID,
                            "folderType": target.folderType.rawValue
                        ]
                    )
                )
            }
        }
    }

    private struct FolderSectionSyncTarget {
        let folderID: Int64
        let folderClientID: String
        let folderType: CodeFolderType
    }

    private func folderSectionSyncTargets(sectionID: Int64, codeVersion: String) throws -> [FolderSectionSyncTarget] {
        let statement = try connection.prepare(
            """
            SELECT fs.folder_id, f.client_id, f.folder_type
            FROM folder_sections AS fs
            INNER JOIN folders AS f
                ON f.id = fs.folder_id AND f.code_version = fs.code_version
            WHERE fs.section_id = ? AND fs.code_version = ?;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, sectionID)
        try connection.bind(text: codeVersion, index: 2, to: statement)

        var targets: [FolderSectionSyncTarget] = []
        while try connection.step(statement) == SQLITE_ROW {
            targets.append(
                FolderSectionSyncTarget(
                    folderID: connection.int64(at: 0, in: statement),
                    folderClientID: connection.string(at: 1, in: statement),
                    folderType: CodeFolderType(serverValue: connection.stringOrNil(at: 2, in: statement))
                )
            )
        }
        return targets
    }

    /// Wipes every folder + membership row. Wired into Settings' clear-data
    /// flow so users can reset their organization without losing bookmarks.
    func clearAllFolders(codeVersion: String) throws {
        try performTransaction {
            let folderStmt = try connection.prepare(
                """
                DELETE FROM folder_sections
                WHERE code_version = ?;
                """
            )
            defer { connection.finalize(folderStmt) }
            try connection.bind(text: codeVersion, index: 1, to: folderStmt)
            _ = try connection.step(folderStmt)

            let cleanup = try connection.prepare(
                """
                DELETE FROM folders
                WHERE code_version = ?;
                """
            )
            defer { connection.finalize(cleanup) }
            try connection.bind(text: codeVersion, index: 1, to: cleanup)
            _ = try connection.step(cleanup)
        }

        enqueueSyncOperationIfPossible(
            entityType: .codeVersionUserData,
            operationType: .delete,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                values: ["scope": "folders"]
            )
        )
    }

    func localMergeCandidates(
        for mutations: [ServerUserContentMutation],
        account: SignedInAccount
    ) throws -> [String: UserContentMergeCandidate] {
        var candidates: [String: UserContentMergeCandidate] = [:]
        for mutation in mutations {
            let localizedMutation = localizedServerMutation(mutation)
            let rowCandidate = try localMergeCandidate(for: localizedMutation)
            let queuedCandidate = try queuedRecordMergeCandidate(
                for: localizedMutation,
                account: account
            )
            let localCandidate = [rowCandidate, queuedCandidate]
                .compactMap { $0 }
                .max {
                    ($0.localUpdatedAt ?? .distantPast) < ($1.localUpdatedAt ?? .distantPast)
                }
            let pendingClearUpdatedAt = try pendingBulkClearUpdatedAt(for: localizedMutation)
            if let pendingClearUpdatedAt,
               localCandidate?.localUpdatedAt.map({ $0 >= pendingClearUpdatedAt }) != true {
                // A clear is one mutation that intentionally supersedes many
                // older records. Compare its timestamp against each matching
                // incoming record so the pull-before-push cycle cannot restore
                // bookmarks, annotations, or project memberships just before
                // the clear reaches the server.
                candidates[mutation.recordID] = UserContentMergeCandidate(
                    recordID: mutation.recordID,
                    entityKind: mutation.entityKind,
                    localUpdatedAt: pendingClearUpdatedAt,
                    serverUpdatedAt: mutation.updatedAt,
                    localDeletedAt: pendingClearUpdatedAt,
                    serverDeletedAt: mutation.deletedAt,
                    localSyncState: .pendingUpload
                )
            } else if let candidate = localCandidate {
                candidates[mutation.recordID] = candidate
            }
        }
        return candidates
    }

    private func queuedRecordMergeCandidate(
        for mutation: ServerUserContentMutation,
        account: SignedInAccount
    ) throws -> UserContentMergeCandidate? {
        let statement = try connection.prepare(
            """
            SELECT id, client_id, entity_type, operation_type, payload_json, state,
                   attempt_count, created_at, updated_at, last_error, mutation_updated_at
            FROM sync_queue
            WHERE state != ?
            ORDER BY mutation_updated_at DESC, id DESC;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: syncedQueueState, index: 1, to: statement)

        while try connection.step(statement) == SQLITE_ROW {
            guard let item = syncQueueItem(from: statement),
                  let queuedMutation = try? ServerUserContentMutation(
                    syncQueueItem: item,
                    account: account
                  ),
                  queuedMutation.recordID == mutation.recordID
            else {
                continue
            }
            return UserContentMergeCandidate(
                recordID: mutation.recordID,
                entityKind: mutation.entityKind,
                localUpdatedAt: queuedMutation.updatedAt,
                serverUpdatedAt: mutation.updatedAt,
                localDeletedAt: queuedMutation.deletedAt,
                serverDeletedAt: mutation.deletedAt,
                localSyncState: .pendingUpload
            )
        }
        return nil
    }

    private func pendingBulkClearUpdatedAt(for mutation: ServerUserContentMutation) throws -> Date? {
        let codeVersion: String
        let scopes: [String]
        switch mutation {
        case .savedItem(let record):
            codeVersion = record.codeVersion
            scopes = ["bookmarks"]
        case .annotation(let record):
            codeVersion = record.codeVersion
            scopes = [
                record.noteBody != nil ? "notes" : nil,
                record.tags != nil ? "tags" : nil
            ].compactMap { $0 }
        case .project(let record):
            codeVersion = record.codeVersion
            scopes = ["folders"]
        case .projectSection(let record):
            codeVersion = record.codeVersion
            scopes = ["bookmarks", "folders"]
        case .workboard, .continuity, .codeVersionClear:
            return nil
        }

        return try scopes.compactMap { scope in
            let clearMutation = ServerUserContentMutation.codeVersionClear(
                ServerContinuityRecord(
                    userID: "pending-local-clear",
                    codeVersion: codeVersion,
                    values: ["scope": scope],
                    updatedAt: mutation.updatedAt
                )
            )
            return try queuedMergeCandidate(
                for: clearMutation,
                entityType: .codeVersionUserData,
                codeVersion: codeVersion,
                scope: scope
            )?.localUpdatedAt
        }.max()
    }

    func discardQueuedMutation(recordID: String, account: SignedInAccount) throws {
        let statement = try connection.prepare(
            """
            SELECT id, client_id, entity_type, operation_type, payload_json, state,
                   attempt_count, created_at, updated_at, last_error, mutation_updated_at
            FROM sync_queue
            WHERE state != ?
            ORDER BY id ASC;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: syncedQueueState, index: 1, to: statement)

        var matchingItemIDs: [Int64] = []
        while try connection.step(statement) == SQLITE_ROW {
            guard let item = syncQueueItem(from: statement),
                  let mutation = try? ServerUserContentMutation(syncQueueItem: item, account: account),
                  mutation.recordID == recordID
            else { continue }
            matchingItemIDs.append(item.id)
        }
        for itemID in matchingItemIDs {
            try markSyncQueueItemSynced(id: itemID)
        }
    }

    private func localMergeCandidate(for mutation: ServerUserContentMutation) throws -> UserContentMergeCandidate? {
        switch mutation {
        case .savedItem(let record):
            return try localMergeCandidate(
                mutation: mutation,
                sql: "SELECT sync_state, updated_at, deleted_at FROM bookmarks WHERE code_version = ? AND section_id = ? LIMIT 1;",
                codeVersion: record.codeVersion,
                firstID: record.sectionID
            )
        case .annotation(let record):
            if record.tags != nil {
                let statement = try connection.prepare(
                    """
                    SELECT MIN(sync_state), MAX(updated_at), MAX(deleted_at)
                    FROM bookmark_tags
                    WHERE code_version = ? AND section_id = ? AND block_id = ?;
                    """
                )
                defer { connection.finalize(statement) }
                try connection.bind(text: record.codeVersion, index: 1, to: statement)
                sqlite3_bind_int64(statement, 2, record.sectionID)
                try connection.bind(text: record.normalizedBlockID, index: 3, to: statement)

                guard try connection.step(statement) == SQLITE_ROW else { return nil }
                let syncStateRaw = connection.stringOrNil(at: 0, in: statement) ?? syncedContentState
                let updatedAt = connection.stringOrNil(at: 1, in: statement).flatMap { isoFormatter.date(from: $0) }
                guard updatedAt != nil || connection.stringOrNil(at: 0, in: statement) != nil else { return nil }
                let deletedAt = connection.stringOrNil(at: 2, in: statement).flatMap { isoFormatter.date(from: $0) }
                return UserContentMergeCandidate(
                    recordID: mutation.recordID,
                    entityKind: mutation.entityKind,
                    localUpdatedAt: updatedAt,
                    serverUpdatedAt: mutation.updatedAt,
                    localDeletedAt: deletedAt,
                    serverDeletedAt: mutation.deletedAt,
                    localSyncState: UserContentSyncState(rawValue: syncStateRaw) ?? .synced
                )
            }
            return try localMergeCandidate(
                mutation: mutation,
                record: record
            )
        case .project(let record):
            if let localFolderID = try localFolderID(clientID: record.clientID ?? record.id, codeVersion: record.codeVersion) {
                return try localMergeCandidate(
                    mutation: mutation,
                    sql: "SELECT sync_state, updated_at, deleted_at FROM folders WHERE code_version = ? AND id = ? LIMIT 1;",
                    codeVersion: record.codeVersion,
                    firstID: localFolderID
                )
            }
            return try localMergeCandidate(
                mutation: mutation,
                sql: "SELECT sync_state, updated_at, deleted_at FROM folders WHERE code_version = ? AND id = ? LIMIT 1;",
                codeVersion: record.codeVersion,
                firstID: record.localFolderID
            )
        case .projectSection(let record):
            let legacyClientID = record.localFolderID.map {
                "\(record.userID):project:\(record.codeVersion):\($0)"
            }
            guard let folderID = try localFolderID(
                clientID: record.folderClientID ?? legacyClientID,
                codeVersion: record.codeVersion
            ) else {
                return nil
            }
            return try localMergeCandidate(
                mutation: mutation,
                sql: "SELECT sync_state, updated_at, deleted_at FROM folder_sections WHERE code_version = ? AND folder_id = ? AND section_id = ? LIMIT 1;",
                codeVersion: record.codeVersion,
                firstID: folderID,
                secondID: record.sectionID
            )
        case .workboard:
            return nil
        case .continuity(let record):
            return try queuedMergeCandidate(
                for: mutation,
                entityType: .continuity,
                codeVersion: record.codeVersion
            )
        case .codeVersionClear(let record):
            return try queuedMergeCandidate(
                for: mutation,
                entityType: .codeVersionUserData,
                codeVersion: record.codeVersion,
                scope: record.values["scope"]
            )
        }
    }

    private func queuedMergeCandidate(
        for mutation: ServerUserContentMutation,
        entityType: SyncEntityType,
        codeVersion: String,
        scope: String? = nil
    ) throws -> UserContentMergeCandidate? {
        let statement = try connection.prepare(
            """
            SELECT id, client_id, entity_type, operation_type, payload_json, state,
                   attempt_count, created_at, updated_at, last_error, mutation_updated_at
            FROM sync_queue
            WHERE entity_type = ?
              AND state != ?
            ORDER BY mutation_updated_at DESC, id DESC;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: entityType.rawValue, index: 1, to: statement)
        try connection.bind(text: syncedQueueState, index: 2, to: statement)

        while try connection.step(statement) == SQLITE_ROW {
            guard let item = syncQueueItem(from: statement) else { continue }
            guard UserContentSyncCodeVersion.server(item.payload.codeVersion) ==
                    UserContentSyncCodeVersion.server(codeVersion) else { continue }
            if let scope, item.payload.values["scope"] != scope { continue }
            return UserContentMergeCandidate(
                recordID: mutation.recordID,
                entityKind: mutation.entityKind,
                localUpdatedAt: item.mutationUpdatedAt,
                serverUpdatedAt: mutation.updatedAt,
                localDeletedAt: nil,
                serverDeletedAt: mutation.deletedAt,
                localSyncState: .pendingUpload
            )
        }
        return nil
    }

    private func localMergeCandidate(
        mutation: ServerUserContentMutation,
        sql: String,
        codeVersion: String,
        firstID: Int64,
        secondID: Int64? = nil
    ) throws -> UserContentMergeCandidate? {
        let statement = try connection.prepare(sql)
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, firstID)
        if let secondID {
            sqlite3_bind_int64(statement, 3, secondID)
        }

        guard try connection.step(statement) == SQLITE_ROW else { return nil }
        let syncStateRaw = connection.stringOrNil(at: 0, in: statement) ?? syncedContentState
        let updatedAt = connection.stringOrNil(at: 1, in: statement).flatMap { isoFormatter.date(from: $0) }
        guard updatedAt != nil || connection.stringOrNil(at: 0, in: statement) != nil else { return nil }
        let deletedAt = connection.stringOrNil(at: 2, in: statement).flatMap { isoFormatter.date(from: $0) }
        return UserContentMergeCandidate(
            recordID: mutation.recordID,
            entityKind: mutation.entityKind,
            localUpdatedAt: updatedAt,
            serverUpdatedAt: mutation.updatedAt,
            localDeletedAt: deletedAt,
            serverDeletedAt: mutation.deletedAt,
            localSyncState: UserContentSyncState(rawValue: syncStateRaw) ?? .synced
        )
    }

    private func localMergeCandidate(
        mutation: ServerUserContentMutation,
        record: ServerAnnotationRecord
    ) throws -> UserContentMergeCandidate? {
        let statement = try connection.prepare(
            """
            SELECT sync_state, updated_at, deleted_at
            FROM notes
            WHERE code_version = ? AND section_id = ? AND block_id = ?
            LIMIT 1;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: record.codeVersion, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, record.sectionID)
        try connection.bind(text: record.normalizedBlockID, index: 3, to: statement)

        guard try connection.step(statement) == SQLITE_ROW else { return nil }
        let syncStateRaw = connection.stringOrNil(at: 0, in: statement) ?? syncedContentState
        let updatedAt = connection.stringOrNil(at: 1, in: statement).flatMap { isoFormatter.date(from: $0) }
        guard updatedAt != nil || connection.stringOrNil(at: 0, in: statement) != nil else { return nil }
        let deletedAt = connection.stringOrNil(at: 2, in: statement).flatMap { isoFormatter.date(from: $0) }
        return UserContentMergeCandidate(
            recordID: mutation.recordID,
            entityKind: mutation.entityKind,
            localUpdatedAt: updatedAt,
            serverUpdatedAt: mutation.updatedAt,
            localDeletedAt: deletedAt,
            serverDeletedAt: mutation.deletedAt,
            localSyncState: UserContentSyncState(rawValue: syncStateRaw) ?? .synced
        )
    }

    func applyServerUserContentMutation(_ mutation: ServerUserContentMutation) throws {
        switch localizedServerMutation(mutation) {
        case .savedItem(let record):
            if record.deletedAt != nil {
                try deleteServerBookmark(sectionID: record.sectionID, codeVersion: record.codeVersion)
            } else {
                try upsertServerBookmark(record)
            }
        case .annotation(let record):
            if record.deletedAt != nil {
                try deleteServerAnnotation(record)
            } else {
                try upsertServerAnnotation(record)
            }
        case .project(let record):
            if record.deletedAt != nil {
                try deleteServerProject(record)
            } else {
                try upsertServerProject(record)
            }
        case .projectSection(let record):
            if record.deletedAt != nil {
                try deleteServerProjectSection(record)
            } else {
                try upsertServerProjectSection(record)
            }
        case .workboard:
            // Workboards remain web-only. Recognize their sync records so they
            // never prevent iOS from applying the rest of a user's saved data.
            break
        case .continuity:
            break
        case .codeVersionClear(let record):
            try applyServerCodeVersionClear(record)
        }
    }

    private func localizedServerMutation(_ mutation: ServerUserContentMutation) -> ServerUserContentMutation {
        switch mutation {
        case .savedItem(let record):
            return .savedItem(ServerSavedItemRecord(
                id: record.id,
                userID: record.userID,
                codeVersion: localCodeVersion(record.codeVersion),
                sectionID: record.sectionID,
                updatedAt: record.updatedAt,
                deletedAt: record.deletedAt,
                serverEventID: record.serverEventID
            ))
        case .annotation(let record):
            return .annotation(ServerAnnotationRecord(
                id: record.id,
                userID: record.userID,
                codeVersion: localCodeVersion(record.codeVersion),
                sectionID: record.sectionID,
                blockID: record.blockID,
                noteBody: record.noteBody,
                tags: record.tags,
                updatedAt: record.updatedAt,
                deletedAt: record.deletedAt,
                serverEventID: record.serverEventID
            ))
        case .project(let record):
            return .project(ServerProjectRecord(
                id: record.id,
                userID: record.userID,
                codeVersion: localCodeVersion(record.codeVersion),
                clientID: record.clientID,
                localFolderID: record.localFolderID,
                name: record.name,
                address: record.address,
                description: record.description,
                colorHex: record.colorHex,
                sortOrder: record.sortOrder,
                folderType: record.folderType,
                archivedAt: record.archivedAt,
                updatedAt: record.updatedAt,
                deletedAt: record.deletedAt,
                serverEventID: record.serverEventID
            ))
        case .projectSection(let record):
            return .projectSection(ServerProjectSectionRecord(
                id: record.id,
                userID: record.userID,
                codeVersion: localCodeVersion(record.codeVersion),
                folderClientID: record.folderClientID,
                folderType: record.folderType,
                localFolderID: record.localFolderID,
                sectionID: record.sectionID,
                scope: record.scope,
                updatedAt: record.updatedAt,
                deletedAt: record.deletedAt,
                serverEventID: record.serverEventID
            ))
        case .workboard:
            return mutation
        case .continuity:
            return mutation
        case .codeVersionClear(let record):
            return .codeVersionClear(ServerContinuityRecord(
                userID: record.userID,
                codeVersion: localCodeVersion(record.codeVersion),
                values: record.values,
                updatedAt: record.updatedAt,
                serverEventID: record.serverEventID
            ))
        }
    }

    private func localCodeVersion(_ codeVersion: String) -> String {
        UserContentSyncCodeVersion.local(codeVersion)
    }

    private func upsertServerBookmark(_ record: ServerSavedItemRecord) throws {
        let timestamp = isoFormatter.string(from: record.updatedAt)
        let statement = try connection.prepare(
            """
            INSERT INTO bookmarks (
                code_version, section_id, created_at, updated_at, client_id,
                owner_id, visibility, sync_state, deleted_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
            ON CONFLICT(code_version, section_id) DO UPDATE SET
                updated_at = excluded.updated_at,
                sync_state = excluded.sync_state,
                deleted_at = NULL;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: record.codeVersion, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, record.sectionID)
        try connection.bind(text: timestamp, index: 3, to: statement)
        try connection.bind(text: timestamp, index: 4, to: statement)
        try connection.bind(text: record.id, index: 5, to: statement)
        try connection.bind(text: record.userID, index: 6, to: statement)
        try connection.bind(text: personalVisibility, index: 7, to: statement)
        try connection.bind(text: syncedContentState, index: 8, to: statement)
        _ = try connection.step(statement)
    }

    private func deleteServerBookmark(sectionID: Int64, codeVersion: String) throws {
        try performTransaction {
            try deleteRows(sql: "DELETE FROM bookmarks WHERE code_version = ? AND section_id = ?;", codeVersion: codeVersion, sectionID: sectionID)
            try deleteRows(sql: "DELETE FROM folder_sections WHERE code_version = ? AND section_id = ?;", codeVersion: codeVersion, sectionID: sectionID)
        }
    }

    private func upsertServerAnnotation(_ record: ServerAnnotationRecord) throws {
        if let noteBody = record.noteBody {
            try upsertServerNote(record, body: noteBody)
        }
        if let tags = record.tags {
            try setServerTags(
                tags,
                sectionID: record.sectionID,
                blockID: record.normalizedBlockID,
                codeVersion: record.codeVersion,
                userID: record.userID,
                updatedAt: record.updatedAt
            )
        }
    }

    private func upsertServerNote(_ record: ServerAnnotationRecord, body: String) throws {
        let timestamp = isoFormatter.string(from: record.updatedAt)
        if body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            try deleteRows(
                sql: "DELETE FROM notes WHERE code_version = ? AND section_id = ? AND block_id = ?;",
                codeVersion: record.codeVersion,
                sectionID: record.sectionID,
                text: record.normalizedBlockID
            )
            return
        }

        let statement = try connection.prepare(
            """
            INSERT INTO notes (
                code_version, section_id, block_id, body, created_at, updated_at, client_id,
                owner_id, visibility, sync_state, deleted_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
            ON CONFLICT(code_version, section_id, block_id) DO UPDATE SET
                body = excluded.body,
                updated_at = excluded.updated_at,
                sync_state = excluded.sync_state,
                deleted_at = NULL;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: record.codeVersion, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, record.sectionID)
        try connection.bind(text: record.normalizedBlockID, index: 3, to: statement)
        try connection.bind(text: body, index: 4, to: statement)
        try connection.bind(text: timestamp, index: 5, to: statement)
        try connection.bind(text: timestamp, index: 6, to: statement)
        try connection.bind(text: record.id, index: 7, to: statement)
        try connection.bind(text: record.userID, index: 8, to: statement)
        try connection.bind(text: personalVisibility, index: 9, to: statement)
        try connection.bind(text: syncedContentState, index: 10, to: statement)
        _ = try connection.step(statement)
    }

    private func setServerTags(_ tags: [String], sectionID: Int64, blockID: String = "", codeVersion: String, userID: String, updatedAt: Date) throws {
        let cleaned = tags
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        let normalizedBlockID = blockID.trimmingCharacters(in: .whitespacesAndNewlines)
        let timestamp = isoFormatter.string(from: updatedAt)

        try performTransaction {
            try deleteRows(sql: "DELETE FROM bookmark_tags WHERE code_version = ? AND section_id = ? AND block_id = ?;", codeVersion: codeVersion, sectionID: sectionID, text: normalizedBlockID)
            guard !cleaned.isEmpty else { return }

            let insert = try connection.prepare(
                """
                INSERT INTO bookmark_tags (
                    code_version, section_id, block_id, tag, created_at, updated_at, client_id,
                    owner_id, visibility, sync_state, deleted_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);
                """
            )
            defer { connection.finalize(insert) }
            for tag in cleaned {
                sqlite3_reset(insert)
                sqlite3_clear_bindings(insert)
                try connection.bind(text: codeVersion, index: 1, to: insert)
                sqlite3_bind_int64(insert, 2, sectionID)
                try connection.bind(text: normalizedBlockID, index: 3, to: insert)
                try connection.bind(text: tag, index: 4, to: insert)
                try connection.bind(text: timestamp, index: 5, to: insert)
                try connection.bind(text: timestamp, index: 6, to: insert)
                try connection.bind(text: "\(userID):tags:\(codeVersion):\(sectionID):\(normalizedBlockID):\(tag)", index: 7, to: insert)
                try connection.bind(text: userID, index: 8, to: insert)
                try connection.bind(text: personalVisibility, index: 9, to: insert)
                try connection.bind(text: syncedContentState, index: 10, to: insert)
                _ = try connection.step(insert)
            }
        }
    }

    private func deleteServerAnnotation(_ record: ServerAnnotationRecord) throws {
        let recordID = record.id.lowercased()
        let deletesTags = recordID.contains(":tags:") || recordID.contains("-tags-")
        let deletesNote = !deletesTags
        try performTransaction {
            if deletesNote {
                try deleteRows(
                    sql: "DELETE FROM notes WHERE code_version = ? AND section_id = ? AND block_id = ?;",
                    codeVersion: record.codeVersion,
                    sectionID: record.sectionID,
                    text: record.normalizedBlockID
                )
            }
            if deletesTags {
                try deleteRows(
                    sql: "DELETE FROM bookmark_tags WHERE code_version = ? AND section_id = ? AND block_id = ?;",
                    codeVersion: record.codeVersion,
                    sectionID: record.sectionID,
                    text: record.normalizedBlockID
                )
            }
        }
    }

    private func upsertServerProject(_ record: ServerProjectRecord) throws {
        let clientID = UserContentProjectIdentity.stable(
            record.clientID ?? record.id,
            userID: record.userID
        ) ?? record.clientID ?? record.id
        let localIDs = try localFolderIDs(clientID: clientID, codeVersion: record.codeVersion)
        if let localID = localIDs.first {
            try performTransaction {
                try mergeServerProjectDuplicates(
                    primaryFolderID: localID,
                    duplicateFolderIDs: Array(localIDs.dropFirst()),
                    codeVersion: record.codeVersion
                )
                try updateServerProject(record, localFolderID: localID, clientID: clientID)
            }
            return
        }
        try insertServerProject(record, clientID: clientID)
    }

    private func insertServerProject(_ record: ServerProjectRecord, clientID: String) throws {
        let timestamp = isoFormatter.string(from: record.updatedAt)
        let statement = try connection.prepare(
            """
            INSERT INTO folders (
                client_id, owner_id, visibility, sync_state, code_version, name,
                address, description, color_hex, folder_type, sort_order, archived_at, created_at, updated_at, deleted_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: clientID, index: 1, to: statement)
        try connection.bind(text: record.userID, index: 2, to: statement)
        try connection.bind(text: personalVisibility, index: 3, to: statement)
        try connection.bind(text: syncedContentState, index: 4, to: statement)
        try connection.bind(text: record.codeVersion, index: 5, to: statement)
        try connection.bind(text: record.name ?? "Project", index: 6, to: statement)
        try connection.bind(text: record.address ?? "", index: 7, to: statement)
        try connection.bind(text: record.description ?? "", index: 8, to: statement)
        try connection.bind(text: record.colorHex ?? CodeFolder.defaultColorHex, index: 9, to: statement)
        try connection.bind(text: record.folderType.rawValue, index: 10, to: statement)
        sqlite3_bind_int64(statement, 11, Int64(record.sortOrder ?? 0))
        if let archivedAt = record.archivedAt {
            try connection.bind(text: isoFormatter.string(from: archivedAt), index: 12, to: statement)
        } else {
            sqlite3_bind_null(statement, 12)
        }
        try connection.bind(text: timestamp, index: 13, to: statement)
        try connection.bind(text: timestamp, index: 14, to: statement)
        _ = try connection.step(statement)
    }

    private func mergeServerProjectDuplicates(
        primaryFolderID: Int64,
        duplicateFolderIDs: [Int64],
        codeVersion: String
    ) throws {
        guard !duplicateFolderIDs.isEmpty else { return }

        let copyMemberships = try connection.prepare(
            """
            INSERT OR IGNORE INTO folder_sections (
                client_id, owner_id, visibility, sync_state, folder_id,
                code_version, section_id, added_at, updated_at, deleted_at
            )
            SELECT
                client_id, owner_id, visibility, sync_state, ?,
                code_version, section_id, added_at, updated_at, deleted_at
            FROM folder_sections
            WHERE folder_id = ? AND code_version = ?;
            """
        )
        defer { connection.finalize(copyMemberships) }
        let deleteMemberships = try connection.prepare(
            "DELETE FROM folder_sections WHERE folder_id = ? AND code_version = ?;"
        )
        defer { connection.finalize(deleteMemberships) }
        let deleteFolder = try connection.prepare(
            "DELETE FROM folders WHERE id = ? AND code_version = ?;"
        )
        defer { connection.finalize(deleteFolder) }

        for duplicateFolderID in duplicateFolderIDs where duplicateFolderID != primaryFolderID {
            sqlite3_reset(copyMemberships)
            sqlite3_clear_bindings(copyMemberships)
            sqlite3_bind_int64(copyMemberships, 1, primaryFolderID)
            sqlite3_bind_int64(copyMemberships, 2, duplicateFolderID)
            try connection.bind(text: codeVersion, index: 3, to: copyMemberships)
            _ = try connection.step(copyMemberships)

            sqlite3_reset(deleteMemberships)
            sqlite3_clear_bindings(deleteMemberships)
            sqlite3_bind_int64(deleteMemberships, 1, duplicateFolderID)
            try connection.bind(text: codeVersion, index: 2, to: deleteMemberships)
            _ = try connection.step(deleteMemberships)

            sqlite3_reset(deleteFolder)
            sqlite3_clear_bindings(deleteFolder)
            sqlite3_bind_int64(deleteFolder, 1, duplicateFolderID)
            try connection.bind(text: codeVersion, index: 2, to: deleteFolder)
            _ = try connection.step(deleteFolder)
        }
    }

    private func updateServerProject(_ record: ServerProjectRecord, localFolderID: Int64, clientID: String) throws {
        let timestamp = isoFormatter.string(from: record.updatedAt)
        let statement = try connection.prepare(
            """
            UPDATE folders
            SET
                client_id = ?,
                owner_id = ?,
                visibility = ?,
                sync_state = ?,
                name = ?,
                address = ?,
                description = ?,
                color_hex = ?,
                folder_type = ?,
                sort_order = ?,
                archived_at = ?,
                updated_at = ?,
                deleted_at = NULL
            WHERE id = ? AND code_version = ?;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: clientID, index: 1, to: statement)
        try connection.bind(text: record.userID, index: 2, to: statement)
        try connection.bind(text: personalVisibility, index: 3, to: statement)
        try connection.bind(text: syncedContentState, index: 4, to: statement)
        try connection.bind(text: record.name ?? "Project", index: 5, to: statement)
        try connection.bind(text: record.address ?? "", index: 6, to: statement)
        try connection.bind(text: record.description ?? "", index: 7, to: statement)
        try connection.bind(text: record.colorHex ?? CodeFolder.defaultColorHex, index: 8, to: statement)
        try connection.bind(text: record.folderType.rawValue, index: 9, to: statement)
        sqlite3_bind_int64(statement, 10, Int64(record.sortOrder ?? 0))
        if let archivedAt = record.archivedAt {
            try connection.bind(text: isoFormatter.string(from: archivedAt), index: 11, to: statement)
        } else {
            sqlite3_bind_null(statement, 11)
        }
        try connection.bind(text: timestamp, index: 12, to: statement)
        sqlite3_bind_int64(statement, 13, localFolderID)
        try connection.bind(text: record.codeVersion, index: 14, to: statement)
        _ = try connection.step(statement)
    }

    private func deleteServerProject(_ record: ServerProjectRecord) throws {
        var folderIDs = try localFolderIDs(
            clientID: record.clientID ?? record.id,
            codeVersion: record.codeVersion
        )
        if folderIDs.isEmpty, record.localFolderID > 0 {
            folderIDs = [record.localFolderID]
        }
        try performTransaction {
            for folderID in folderIDs {
                try deleteRows(sql: "DELETE FROM folder_sections WHERE code_version = ? AND folder_id = ?;", codeVersion: record.codeVersion, sectionID: folderID)
                try deleteRows(sql: "DELETE FROM folders WHERE code_version = ? AND id = ?;", codeVersion: record.codeVersion, sectionID: folderID)
            }
        }
    }

    private func upsertServerProjectSection(_ record: ServerProjectSectionRecord) throws {
        let legacyClientID = record.localFolderID.map {
            "\(record.userID):project:\(record.codeVersion):\($0)"
        }
        guard let folderID = try localFolderID(
            clientID: record.folderClientID ?? legacyClientID,
            codeVersion: record.codeVersion
        ) else {
            return
        }
        let timestamp = isoFormatter.string(from: record.updatedAt)
        let statement = try connection.prepare(
            """
            INSERT OR REPLACE INTO folder_sections (
                client_id, owner_id, visibility, sync_state, folder_id,
                code_version, section_id, added_at, updated_at, deleted_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL);
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: record.id, index: 1, to: statement)
        try connection.bind(text: record.userID, index: 2, to: statement)
        try connection.bind(text: personalVisibility, index: 3, to: statement)
        try connection.bind(text: syncedContentState, index: 4, to: statement)
        sqlite3_bind_int64(statement, 5, folderID)
        try connection.bind(text: record.codeVersion, index: 6, to: statement)
        sqlite3_bind_int64(statement, 7, record.sectionID)
        try connection.bind(text: timestamp, index: 8, to: statement)
        try connection.bind(text: timestamp, index: 9, to: statement)
        _ = try connection.step(statement)
    }

    private func deleteServerProjectSection(_ record: ServerProjectSectionRecord) throws {
        let legacyClientID = record.localFolderID.map {
            "\(record.userID):project:\(record.codeVersion):\($0)"
        }
        if let folderID = try localFolderID(
            clientID: record.folderClientID ?? legacyClientID,
            codeVersion: record.codeVersion
        ) ?? record.localFolderID {
            try deleteRows(sql: "DELETE FROM folder_sections WHERE code_version = ? AND folder_id = ? AND section_id = ?;", codeVersion: record.codeVersion, firstID: folderID, secondID: record.sectionID)
        } else {
            try deleteRows(sql: "DELETE FROM folder_sections WHERE code_version = ? AND section_id = ?;", codeVersion: record.codeVersion, sectionID: record.sectionID)
        }
    }

    private func applyServerCodeVersionClear(_ record: ServerContinuityRecord) throws {
        let equivalentVersions = UserContentSyncCodeVersion.equivalentLocalVersions(record.codeVersion)
        switch record.values["scope"] {
        case "bookmarks":
            for codeVersion in equivalentVersions {
                try deleteRows(sql: "DELETE FROM bookmarks WHERE code_version = ?;", codeVersion: codeVersion)
                try deleteRows(sql: "DELETE FROM folder_sections WHERE code_version = ?;", codeVersion: codeVersion)
            }
        case "notes":
            for codeVersion in equivalentVersions {
                try deleteRows(sql: "DELETE FROM notes WHERE code_version = ?;", codeVersion: codeVersion)
            }
        case "tags":
            for codeVersion in equivalentVersions {
                try deleteRows(sql: "DELETE FROM bookmark_tags WHERE code_version = ?;", codeVersion: codeVersion)
            }
        case "folders":
            try performTransaction {
                for codeVersion in equivalentVersions {
                    try deleteRows(sql: "DELETE FROM folder_sections WHERE code_version = ?;", codeVersion: codeVersion)
                    try deleteRows(sql: "DELETE FROM folders WHERE code_version = ?;", codeVersion: codeVersion)
                }
            }
        default:
            break
        }
    }

    private func performTransaction(_ updates: () throws -> Void) throws {
        try connection.execute("BEGIN IMMEDIATE TRANSACTION;")
        do {
            try updates()
            try connection.execute("COMMIT;")
        } catch {
            try? connection.execute("ROLLBACK;")
            throw error
        }
    }

    private func deleteRows(sql: String, codeVersion: String) throws {
        let statement = try connection.prepare(sql)
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        _ = try connection.step(statement)
    }

    private func deleteRows(sql: String, codeVersion: String, sectionID: Int64) throws {
        let statement = try connection.prepare(sql)
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, sectionID)
        _ = try connection.step(statement)
    }

    private func deleteRows(sql: String, codeVersion: String, sectionID: Int64, text: String) throws {
        let statement = try connection.prepare(sql)
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, sectionID)
        try connection.bind(text: text, index: 3, to: statement)
        _ = try connection.step(statement)
    }

    private func deleteRows(sql: String, codeVersion: String, firstID: Int64, secondID: Int64) throws {
        let statement = try connection.prepare(sql)
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, firstID)
        sqlite3_bind_int64(statement, 3, secondID)
        _ = try connection.step(statement)
    }

    private func countRows(sql: String, codeVersion: String) throws -> Int {
        let statement = try connection.prepare(sql)
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        return try connection.step(statement) == SQLITE_ROW
            ? Int(connection.int64(at: 0, in: statement))
            : 0
    }

    private func countRows(sql: String) throws -> Int {
        let statement = try connection.prepare(sql)
        defer { connection.finalize(statement) }
        return try connection.step(statement) == SQLITE_ROW
            ? Int(connection.int64(at: 0, in: statement))
            : 0
    }
}

/// Database row tuple for a folder. The view model maps this to a
/// `CodeFolder` model so view code never touches SQLite types.
struct FolderRecord: Sendable {
    let id: Int64
    let clientID: String
    let ownerID: String
    let visibility: String
    let syncState: String
    let deletedAt: String?
    let name: String
    let address: String
    let description: String
    let colorHex: String
    let folderType: String
    let sortOrder: Int
    let createdAt: String
    let updatedAt: String
}
