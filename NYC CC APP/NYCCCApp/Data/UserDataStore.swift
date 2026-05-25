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

    private func vacuumIfNeeded() throws {
        try connection.execute("VACUUM;")
    }
}
