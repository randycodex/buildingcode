import Foundation
import SQLite3

final class UserDataStore {
    private let connection: SQLiteConnection
    private let isoFormatter = ISO8601DateFormatter()

    init() throws {
        let appSupport = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        ).appendingPathComponent("NYCCCApp", isDirectory: true)

        try FileManager.default.createDirectory(at: appSupport, withIntermediateDirectories: true, attributes: nil)
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
            return
        }

        let statement = try connection.prepare(
            """
            INSERT INTO bookmarks (code_version, section_id, created_at)
            VALUES (?, ?, ?);
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, sectionID)
        try connection.bind(text: isoFormatter.string(from: Date()), index: 3, to: statement)
        _ = try connection.step(statement)
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
            return
        }

        let statement = try connection.prepare(
            """
            INSERT INTO notes (code_version, section_id, body, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(code_version, section_id) DO UPDATE SET
                body = excluded.body,
                updated_at = excluded.updated_at;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        sqlite3_bind_int64(statement, 2, sectionID)
        try connection.bind(text: body, index: 3, to: statement)
        try connection.bind(text: isoFormatter.string(from: Date()), index: 4, to: statement)
        _ = try connection.step(statement)
    }

    private func createSchema() throws {
        try connection.execute(
            """
            CREATE TABLE IF NOT EXISTS bookmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code_version TEXT NOT NULL,
                section_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(code_version, section_id)
            );

            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code_version TEXT NOT NULL,
                section_id INTEGER NOT NULL,
                body TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(code_version, section_id)
            );

            CREATE TABLE IF NOT EXISTS bookmark_tags (
                code_version TEXT NOT NULL,
                section_id INTEGER NOT NULL,
                tag TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY(code_version, section_id, tag)
            );

            CREATE INDEX IF NOT EXISTS idx_bookmark_tags_lookup
                ON bookmark_tags(code_version, tag);

            CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code_version TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                color_hex TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_folders_version
                ON folders(code_version);

            CREATE TABLE IF NOT EXISTS folder_sections (
                folder_id INTEGER NOT NULL,
                code_version TEXT NOT NULL,
                section_id INTEGER NOT NULL,
                added_at TEXT NOT NULL,
                PRIMARY KEY(folder_id, section_id)
            );

            CREATE INDEX IF NOT EXISTS idx_folder_sections_section
                ON folder_sections(section_id, code_version);

            CREATE INDEX IF NOT EXISTS idx_folder_sections_folder
                ON folder_sections(folder_id);
            """
        )
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

        guard !cleaned.isEmpty else { return }

        let timestamp = isoFormatter.string(from: Date())
        for tag in cleaned {
            let insert = try connection.prepare(
                """
                INSERT INTO bookmark_tags (code_version, section_id, tag, created_at)
                VALUES (?, ?, ?, ?);
                """
            )
            defer { connection.finalize(insert) }
            try connection.bind(text: codeVersion, index: 1, to: insert)
            sqlite3_bind_int64(insert, 2, sectionID)
            try connection.bind(text: tag, index: 3, to: insert)
            try connection.bind(text: timestamp, index: 4, to: insert)
            _ = try connection.step(insert)
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
        try vacuumIfNeeded()
    }

    // MARK: - Folders

    /// All folders for a code version, ordered by sort_order then name.
    func folders(codeVersion: String) throws -> [FolderRecord] {
        let statement = try connection.prepare(
            """
            SELECT id, name, description, color_hex, sort_order, created_at
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
                    name: connection.string(at: 1, in: statement),
                    description: connection.string(at: 2, in: statement),
                    colorHex: connection.string(at: 3, in: statement),
                    sortOrder: Int(connection.int64(at: 4, in: statement)),
                    createdAt: connection.string(at: 5, in: statement)
                )
            )
        }
        return results
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
            INSERT INTO folders (code_version, name, description, color_hex, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?, ?);
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: codeVersion, index: 1, to: statement)
        try connection.bind(text: trimmedName, index: 2, to: statement)
        try connection.bind(text: description, index: 3, to: statement)
        try connection.bind(text: colorHex, index: 4, to: statement)
        sqlite3_bind_int64(statement, 5, Int64(nextSortOrder))
        try connection.bind(text: isoFormatter.string(from: Date()), index: 6, to: statement)
        _ = try connection.step(statement)

        return connection.lastInsertedRowID()
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
            SET name = ?, description = ?, color_hex = ?
            WHERE id = ? AND code_version = ?;
            """
        )
        defer { connection.finalize(statement) }
        try connection.bind(text: trimmedName, index: 1, to: statement)
        try connection.bind(text: description, index: 2, to: statement)
        try connection.bind(text: colorHex, index: 3, to: statement)
        sqlite3_bind_int64(statement, 4, id)
        try connection.bind(text: codeVersion, index: 5, to: statement)
        _ = try connection.step(statement)
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
    }

    func addSection(_ sectionID: Int64, toFolder folderID: Int64, codeVersion: String) throws {
        let statement = try connection.prepare(
            """
            INSERT OR IGNORE INTO folder_sections (folder_id, code_version, section_id, added_at)
            VALUES (?, ?, ?, ?);
            """
        )
        defer { connection.finalize(statement) }
        sqlite3_bind_int64(statement, 1, folderID)
        try connection.bind(text: codeVersion, index: 2, to: statement)
        sqlite3_bind_int64(statement, 3, sectionID)
        try connection.bind(text: isoFormatter.string(from: Date()), index: 4, to: statement)
        _ = try connection.step(statement)
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

        try vacuumIfNeeded()
    }

    private func vacuumIfNeeded() throws {
        try connection.execute("VACUUM;")
    }
}

/// Database row tuple for a folder. The view model maps this to a
/// `CodeFolder` model so view code never touches SQLite types.
struct FolderRecord: Sendable {
    let id: Int64
    let name: String
    let description: String
    let colorHex: String
    let sortOrder: Int
    let createdAt: String
}
