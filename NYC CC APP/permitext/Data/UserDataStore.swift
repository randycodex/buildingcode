import Foundation
import SQLite3

protocol UserContentRepository {
    func bookmarkedSectionIDs(codeVersion: String) throws -> [Int64]
    func bookmarkCount(codeVersion: String) throws -> Int
    func bookmarkCreatedAtBySectionID(codeVersion: String) throws -> [Int64: Date]
    func isBookmarked(sectionID: Int64, codeVersion: String) throws -> Bool
    func toggleBookmark(sectionID: Int64, codeVersion: String) throws
    func noteBody(sectionID: Int64, codeVersion: String) throws -> String
    func noteCount(codeVersion: String) throws -> Int
    func noteEntries(codeVersion: String) throws -> [Int64: String]
    func saveNote(sectionID: Int64, codeVersion: String, body: String) throws
    func tags(sectionID: Int64, codeVersion: String) throws -> [String]
    func tagsBySectionID(codeVersion: String) throws -> [Int64: [String]]
    func setTags(_ tags: [String], sectionID: Int64, codeVersion: String) throws
    func tagUsageCounts(codeVersion: String) throws -> [(tag: String, count: Int)]
    func clearBookmarks(codeVersion: String) throws
    func clearNotes(codeVersion: String) throws
    func clearAllTags(codeVersion: String) throws
    func folders(codeVersion: String) throws -> [FolderRecord]
    func folderCount(codeVersion: String) throws -> Int
    func folderMembership(codeVersion: String) throws -> [Int64: [Int64]]
    func sections(inFolder folderID: Int64, codeVersion: String) throws -> [Int64]
    func createFolder(name: String, description: String, colorHex: String, codeVersion: String) throws -> Int64
    func updateFolder(id: Int64, name: String, description: String, colorHex: String, codeVersion: String) throws
    func deleteFolder(id: Int64, codeVersion: String) throws
    func addSection(_ sectionID: Int64, toFolder folderID: Int64, codeVersion: String) throws
    func removeSection(_ sectionID: Int64, fromFolder folderID: Int64, codeVersion: String) throws
    func removeSectionFromAllFolders(sectionID: Int64, codeVersion: String) throws
    func clearAllFolders(codeVersion: String) throws
    func pendingSyncQueueItems(limit: Int) throws -> [SyncQueueItem]
    func markSyncQueueItemsInFlight(ids: [Int64]) throws
    func markSyncQueueItemSynced(id: Int64) throws
    func markSyncQueueItemFailed(id: Int64, errorMessage: String) throws
    func resetFailedSyncQueueItems() throws
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
    private let pendingQueueState = SyncQueueState.pending.rawValue
    private let inFlightQueueState = SyncQueueState.inFlight.rawValue
    private let failedQueueState = SyncQueueState.failed.rawValue
    private let syncedQueueState = SyncQueueState.synced.rawValue

    init() throws {
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
            // Drop the section's tags too so they don't show as ghost
            // entries on the Saved tag filter after the bookmark is gone.
            try? clearTags(sectionID: sectionID, codeVersion: codeVersion)
            // Also strip folder membership for the same reason — a project
            // folder shouldn't keep referencing a section the user just
            // unbookmarked.
            try? removeSectionFromAllFolders(sectionID: sectionID, codeVersion: codeVersion)
            enqueueSyncOperationIfPossible(
                entityType: .bookmark,
                operationType: .delete,
                payload: SyncQueuePayload(codeVersion: codeVersion, sectionID: sectionID)
            )
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

    func noteBody(sectionID: Int64, codeVersion: String) throws -> String {
        let statement = try connection.prepare(
            """
            SELECT body
            FROM notes
            WHERE section_id = ? AND code_version = ?
            LIMIT 1;
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, sectionID)
        try connection.bind(text: codeVersion, index: 2, to: statement)

        guard try connection.step(statement) == SQLITE_ROW else {
            return ""
        }
        return connection.string(at: 0, in: statement)
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

    func noteEntries(codeVersion: String) throws -> [Int64: String] {
        let statement = try connection.prepare(
            """
            SELECT section_id, body
            FROM notes
            WHERE code_version = ?
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

    func saveNote(sectionID: Int64, codeVersion: String, body: String) throws {
        if body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let statement = try connection.prepare(
                """
                DELETE FROM notes
                WHERE section_id = ? AND code_version = ?;
                """
            )
            defer { connection.finalize(statement) }
            sqlite3_bind_int64(statement, 1, sectionID)
            try connection.bind(text: codeVersion, index: 2, to: statement)
            _ = try connection.step(statement)
            enqueueSyncOperationIfPossible(
                entityType: .note,
                operationType: .delete,
                payload: SyncQueuePayload(codeVersion: codeVersion, sectionID: sectionID)
            )
            return
        }

        let statement = try connection.prepare(
            """
            INSERT INTO notes (
                code_version, section_id, body, created_at, updated_at, client_id,
                owner_id, visibility, sync_state
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(code_version, section_id) DO UPDATE SET
                body = excluded.body,
                updated_at = excluded.updated_at,
                sync_state = excluded.sync_state;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, sectionID)
        try connection.bind(text: body, index: 3, to: statement)
        let now = isoFormatter.string(from: Date())
        try connection.bind(text: now, index: 4, to: statement)
        try connection.bind(text: now, index: 5, to: statement)
        try connection.bind(text: UUID().uuidString, index: 6, to: statement)
        try connection.bind(text: localOwnerID, index: 7, to: statement)
        try connection.bind(text: personalVisibility, index: 8, to: statement)
        try connection.bind(text: pendingSyncState, index: 9, to: statement)
        _ = try connection.step(statement)
        enqueueSyncOperationIfPossible(
            entityType: .note,
            operationType: .upsert,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                sectionID: sectionID,
                values: ["body": body]
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

            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id TEXT NOT NULL DEFAULT '',
                owner_id TEXT NOT NULL DEFAULT 'local',
                visibility TEXT NOT NULL DEFAULT 'personal',
                sync_state TEXT NOT NULL DEFAULT 'localOnly',
                code_version TEXT NOT NULL,
                section_id INTEGER NOT NULL,
                body TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                UNIQUE(code_version, section_id)
            );

            CREATE TABLE IF NOT EXISTS bookmark_tags (
                client_id TEXT NOT NULL DEFAULT '',
                owner_id TEXT NOT NULL DEFAULT 'local',
                visibility TEXT NOT NULL DEFAULT 'personal',
                sync_state TEXT NOT NULL DEFAULT 'localOnly',
                code_version TEXT NOT NULL,
                section_id INTEGER NOT NULL,
                tag TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT '',
                deleted_at TEXT,
                PRIMARY KEY(code_version, section_id, tag)
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
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                color_hex TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT '',
                deleted_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_folders_version
                ON folders(code_version);

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
                updated_at TEXT NOT NULL
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
        try addColumnIfMissing(table: "bookmark_tags", column: "client_id", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "bookmark_tags", column: "owner_id", definition: "TEXT NOT NULL DEFAULT 'local'")
        try addColumnIfMissing(table: "bookmark_tags", column: "visibility", definition: "TEXT NOT NULL DEFAULT 'personal'")
        try addColumnIfMissing(table: "bookmark_tags", column: "sync_state", definition: "TEXT NOT NULL DEFAULT 'localOnly'")
        try addColumnIfMissing(table: "bookmark_tags", column: "updated_at", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "bookmark_tags", column: "deleted_at", definition: "TEXT")
        try addColumnIfMissing(table: "folders", column: "client_id", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "folders", column: "owner_id", definition: "TEXT NOT NULL DEFAULT 'local'")
        try addColumnIfMissing(table: "folders", column: "visibility", definition: "TEXT NOT NULL DEFAULT 'personal'")
        try addColumnIfMissing(table: "folders", column: "sync_state", definition: "TEXT NOT NULL DEFAULT 'localOnly'")
        try addColumnIfMissing(table: "folders", column: "updated_at", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "folders", column: "deleted_at", definition: "TEXT")
        try addColumnIfMissing(table: "folder_sections", column: "client_id", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "folder_sections", column: "owner_id", definition: "TEXT NOT NULL DEFAULT 'local'")
        try addColumnIfMissing(table: "folder_sections", column: "visibility", definition: "TEXT NOT NULL DEFAULT 'personal'")
        try addColumnIfMissing(table: "folder_sections", column: "sync_state", definition: "TEXT NOT NULL DEFAULT 'localOnly'")
        try addColumnIfMissing(table: "folder_sections", column: "updated_at", definition: "TEXT NOT NULL DEFAULT ''")
        try addColumnIfMissing(table: "folder_sections", column: "deleted_at", definition: "TEXT")
        try backfillSyncColumns()
    }

    private func addColumnIfMissing(table: String, column: String, definition: String) throws {
        if try !columnNames(in: table).contains(where: { $0.caseInsensitiveCompare(column) == .orderedSame }) {
            try connection.execute("ALTER TABLE \(table) ADD COLUMN \(column) \(definition);")
        }
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
                "code_version", "section_id", "body", "created_at", "updated_at", "deleted_at"
            ],
            "bookmark_tags": [
                "client_id", "owner_id", "visibility", "sync_state",
                "code_version", "section_id", "tag", "created_at", "updated_at", "deleted_at"
            ],
            "folders": [
                "id", "client_id", "owner_id", "visibility", "sync_state",
                "code_version", "name", "description", "color_hex", "sort_order",
                "created_at", "updated_at", "deleted_at"
            ],
            "folder_sections": [
                "client_id", "owner_id", "visibility", "sync_state", "folder_id",
                "code_version", "section_id", "added_at", "updated_at", "deleted_at"
            ],
            "sync_queue": [
                "id", "client_id", "entity_type", "operation_type", "payload_json",
                "state", "attempt_count", "last_error", "created_at", "updated_at"
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
        try connection.execute("UPDATE folders SET client_id = lower(hex(randomblob(16))) WHERE client_id = '';")
        try connection.execute("UPDATE folders SET owner_id = '\(localOwnerID)' WHERE owner_id = '';")
        try connection.execute("UPDATE folders SET visibility = '\(personalVisibility)' WHERE visibility = '';")
        try connection.execute("UPDATE folders SET sync_state = '\(localOnlySyncState)' WHERE sync_state = '';")
        try connection.execute("UPDATE folders SET updated_at = CASE WHEN updated_at = '' THEN created_at ELSE updated_at END;")
        try connection.execute("UPDATE folder_sections SET client_id = lower(hex(randomblob(16))) WHERE client_id = '';")
        try connection.execute("UPDATE folder_sections SET owner_id = '\(localOwnerID)' WHERE owner_id = '';")
        try connection.execute("UPDATE folder_sections SET visibility = '\(personalVisibility)' WHERE visibility = '';")
        try connection.execute("UPDATE folder_sections SET sync_state = '\(localOnlySyncState)' WHERE sync_state = '';")
        try connection.execute("UPDATE folder_sections SET updated_at = CASE WHEN updated_at = '' THEN added_at ELSE updated_at END;")
        try connection.execute("UPDATE notes SET updated_at = '\(now)' WHERE updated_at = '';")
    }

    @discardableResult
    func pendingSyncQueueItems(limit: Int = 100) throws -> [SyncQueueItem] {
        let statement = try connection.prepare(
            """
            SELECT id, client_id, entity_type, operation_type, payload_json, state, attempt_count, created_at, updated_at, last_error
            FROM sync_queue
            WHERE state = ?
            ORDER BY created_at ASC, id ASC
            LIMIT ?;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: pendingQueueState, index: 1, to: statement)
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
                    lastError: connection.stringOrNil(at: 9, in: statement)
                )
            )
        }
        return items
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

        guard try syncQueueItem(id: itemID)?.state == .pending else {
            return ["Sync queue lifecycle validation failed before claim."]
        }

        try markSyncQueueItemsInFlight(ids: [itemID])
        guard try syncQueueItem(id: itemID)?.state == .inFlight else {
            return ["Sync queue lifecycle validation failed to mark in-flight."]
        }

        try markSyncQueueItemFailed(id: itemID, errorMessage: "debug validation")
        guard let failedItem = try syncQueueItem(id: itemID),
              failedItem.state == .failed,
              failedItem.attemptCount > 0
        else {
            return ["Sync queue lifecycle validation failed to record failure."]
        }

        try resetFailedSyncQueueItems()
        guard try syncQueueItem(id: itemID)?.state == .pending else {
            return ["Sync queue lifecycle validation failed to reset retry."]
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
                attempt_count, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, 0, ?, ?);
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

    private func syncQueueItem(id: Int64) throws -> SyncQueueItem? {
        let statement = try connection.prepare(
            """
            SELECT id, client_id, entity_type, operation_type, payload_json, state, attempt_count, created_at, updated_at, last_error
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

    /// Returns the tags associated with a single bookmarked section, in the
    /// order they were added (oldest first).
    func tags(sectionID: Int64, codeVersion: String) throws -> [String] {
        let statement = try connection.prepare(
            """
            SELECT tag
            FROM bookmark_tags
            WHERE code_version = ? AND section_id = ?
            ORDER BY created_at ASC;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, sectionID)

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
            SELECT section_id, tag
            FROM bookmark_tags
            WHERE code_version = ?
            ORDER BY section_id ASC, created_at ASC;
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

    /// Replaces the tag set for one section. Empty `tags` clears the row.
    func setTags(_ tags: [String], sectionID: Int64, codeVersion: String) throws {
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
                WHERE code_version = ? AND section_id = ?;
                """
            )
            defer { connection.finalize(delete) }
            try connection.bind(text: codeVersion, index: 1, to: delete)
            sqlite3_bind_int64(delete, 2, sectionID)
            _ = try connection.step(delete)

            if !cleaned.isEmpty {
                let timestamp = isoFormatter.string(from: Date())
                let insert = try connection.prepare(
                    """
                    INSERT INTO bookmark_tags (
                        code_version, section_id, tag, created_at, updated_at, client_id,
                        owner_id, visibility, sync_state
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """
                )
                defer { connection.finalize(insert) }

                for tag in cleaned {
                    sqlite3_reset(insert)
                    sqlite3_clear_bindings(insert)
                    try connection.bind(text: codeVersion, index: 1, to: insert)
                    sqlite3_bind_int64(insert, 2, sectionID)
                    try connection.bind(text: tag, index: 3, to: insert)
                    try connection.bind(text: timestamp, index: 4, to: insert)
                    try connection.bind(text: timestamp, index: 5, to: insert)
                    try connection.bind(text: UUID().uuidString, index: 6, to: insert)
                    try connection.bind(text: localOwnerID, index: 7, to: insert)
                    try connection.bind(text: personalVisibility, index: 8, to: insert)
                    try connection.bind(text: pendingSyncState, index: 9, to: insert)
                    _ = try connection.step(insert)
                }
            }

            try connection.execute("COMMIT;")
            enqueueSyncOperationIfPossible(
                entityType: .tagSet,
                operationType: .replace,
                payload: SyncQueuePayload(
                    codeVersion: codeVersion,
                    sectionID: sectionID,
                    values: ["tags": cleaned.joined(separator: "\n")]
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

    /// Removes all tags belonging to a section; called when a bookmark is
    /// removed entirely so we don't leave orphaned tag rows behind.
    func clearTags(sectionID: Int64, codeVersion: String) throws {
        let statement = try connection.prepare(
            """
            DELETE FROM bookmark_tags
            WHERE code_version = ? AND section_id = ?;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, sectionID)
        _ = try connection.step(statement)
        enqueueSyncOperationIfPossible(
            entityType: .tagSet,
            operationType: .delete,
            payload: SyncQueuePayload(codeVersion: codeVersion, sectionID: sectionID)
        )
    }

    func clearBookmarks(codeVersion: String) throws {
        let statement = try connection.prepare(
            """
            DELETE FROM bookmarks
            WHERE code_version = ?;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        _ = try connection.step(statement)

        // Tags belong to bookmarks; remove them as well so the tag filter
        // doesn't keep showing stale chips.
        let tagWipe = try connection.prepare(
            """
            DELETE FROM bookmark_tags
            WHERE code_version = ?;
            """
        )
        defer { connection.finalize(tagWipe) }
        try connection.bind(text: codeVersion, index: 1, to: tagWipe)
        _ = try connection.step(tagWipe)

        // Folder membership references bookmarks. Wipe the junction so
        // folders don't keep ghost section IDs after Clear Bookmarks.
        let folderMembershipWipe = try connection.prepare(
            """
            DELETE FROM folder_sections
            WHERE code_version = ?;
            """
        )
        defer { connection.finalize(folderMembershipWipe) }
        try connection.bind(text: codeVersion, index: 1, to: folderMembershipWipe)
        _ = try connection.step(folderMembershipWipe)

        enqueueSyncOperationIfPossible(
            entityType: .codeVersionUserData,
            operationType: .delete,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                values: ["scope": "bookmarks"]
            )
        )
        try vacuumIfNeeded()
    }

    func clearNotes(codeVersion: String) throws {
        let statement = try connection.prepare(
            """
            DELETE FROM notes
            WHERE code_version = ?;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        _ = try connection.step(statement)
        enqueueSyncOperationIfPossible(
            entityType: .codeVersionUserData,
            operationType: .delete,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                values: ["scope": "notes"]
            )
        )
        try vacuumIfNeeded()
    }

    /// Removes every tag for the given code version. Bookmarks and notes are kept.
    func clearAllTags(codeVersion: String) throws {
        let statement = try connection.prepare(
            """
            DELETE FROM bookmark_tags
            WHERE code_version = ?;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        _ = try connection.step(statement)
        enqueueSyncOperationIfPossible(
            entityType: .codeVersionUserData,
            operationType: .delete,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                values: ["scope": "tags"]
            )
        )
        try vacuumIfNeeded()
    }

    // MARK: - Folders

    /// All folders for a code version, ordered by sort_order then name.
    func folders(codeVersion: String) throws -> [FolderRecord] {
        let statement = try connection.prepare(
            """
            SELECT id, client_id, owner_id, visibility, sync_state, deleted_at, name, description, color_hex, sort_order, created_at, updated_at
            FROM folders
            WHERE code_version = ?
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
                    description: connection.string(at: 7, in: statement),
                    colorHex: connection.string(at: 8, in: statement),
                    sortOrder: Int(connection.int64(at: 9, in: statement)),
                    createdAt: connection.string(at: 10, in: statement),
                    updatedAt: connection.string(at: 11, in: statement)
                )
            )
        }
        return results
    }

    func folderCount(codeVersion: String) throws -> Int {
        try countRows(
            sql: "SELECT COUNT(*) FROM folders WHERE code_version = ?;",
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
        description: String,
        colorHex: String,
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

        let statement = try connection.prepare(
            """
            INSERT INTO folders (
                client_id, owner_id, visibility, sync_state, code_version, name,
                description, color_hex, sort_order, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """
        )
        defer { connection.finalize(statement) }
        let now = isoFormatter.string(from: Date())
        try connection.bind(text: UUID().uuidString, index: 1, to: statement)
        try connection.bind(text: localOwnerID, index: 2, to: statement)
        try connection.bind(text: personalVisibility, index: 3, to: statement)
        try connection.bind(text: pendingSyncState, index: 4, to: statement)
        try connection.bind(text: codeVersion, index: 5, to: statement)
        try connection.bind(text: trimmedName, index: 6, to: statement)
        try connection.bind(text: description, index: 7, to: statement)
        try connection.bind(text: colorHex, index: 8, to: statement)
        sqlite3_bind_int64(statement, 9, Int64(nextSortOrder))
        try connection.bind(text: now, index: 10, to: statement)
        try connection.bind(text: now, index: 11, to: statement)
        _ = try connection.step(statement)

        let folderID = connection.lastInsertedRowID()
        enqueueSyncOperationIfPossible(
            entityType: .folder,
            operationType: .upsert,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                folderID: folderID,
                values: [
                    "name": trimmedName,
                    "description": description,
                    "colorHex": colorHex,
                    "sortOrder": String(nextSortOrder)
                ]
            )
        )
        return folderID
    }

    func updateFolder(
        id: Int64,
        name: String,
        description: String,
        colorHex: String,
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

        let statement = try connection.prepare(
            """
            UPDATE folders
            SET name = ?, description = ?, color_hex = ?, updated_at = ?, sync_state = ?
            WHERE id = ? AND code_version = ?;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: trimmedName, index: 1, to: statement)
        try connection.bind(text: description, index: 2, to: statement)
        try connection.bind(text: colorHex, index: 3, to: statement)
        try connection.bind(text: isoFormatter.string(from: Date()), index: 4, to: statement)
        try connection.bind(text: pendingSyncState, index: 5, to: statement)
        sqlite3_bind_int64(statement, 6, id)
        try connection.bind(text: codeVersion, index: 7, to: statement)
        _ = try connection.step(statement)
        enqueueSyncOperationIfPossible(
            entityType: .folder,
            operationType: .upsert,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                folderID: id,
                values: [
                    "name": trimmedName,
                    "description": description,
                    "colorHex": colorHex
                ]
            )
        )
    }

    func deleteFolder(id: Int64, codeVersion: String) throws {
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
        enqueueSyncOperationIfPossible(
            entityType: .folder,
            operationType: .delete,
            payload: SyncQueuePayload(codeVersion: codeVersion, folderID: id)
        )
    }

    func addSection(_ sectionID: Int64, toFolder folderID: Int64, codeVersion: String) throws {
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
                folderID: folderID
            )
        )
    }

    func removeSection(_ sectionID: Int64, fromFolder folderID: Int64, codeVersion: String) throws {
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
        enqueueSyncOperationIfPossible(
            entityType: .folderSection,
            operationType: .delete,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                sectionID: sectionID,
                folderID: folderID
            )
        )
    }

    /// Removes a section from every folder it belongs to. Called by
    /// toggleBookmark when a bookmark is removed so a section stripped of
    /// its bookmark doesn't keep showing up in folder filters.
    func removeSectionFromAllFolders(sectionID: Int64, codeVersion: String) throws {
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
        enqueueSyncOperationIfPossible(
            entityType: .folderSection,
            operationType: .delete,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                sectionID: sectionID,
                values: ["scope": "allFolders"]
            )
        )
    }

    /// Wipes every folder + membership row. Wired into Settings' clear-data
    /// flow so users can reset their organization without losing bookmarks.
    func clearAllFolders(codeVersion: String) throws {
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

        enqueueSyncOperationIfPossible(
            entityType: .codeVersionUserData,
            operationType: .delete,
            payload: SyncQueuePayload(
                codeVersion: codeVersion,
                values: ["scope": "folders"]
            )
        )
        try vacuumIfNeeded()
    }

    private func vacuumIfNeeded() throws {
        try connection.execute("VACUUM;")
    }

    private func countRows(sql: String, codeVersion: String) throws -> Int {
        let statement = try connection.prepare(sql)
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
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
    let description: String
    let colorHex: String
    let sortOrder: Int
    let createdAt: String
    let updatedAt: String
}
