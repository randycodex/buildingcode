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
            """
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

    private func vacuumIfNeeded() throws {
        try connection.execute("VACUUM;")
    }
}
