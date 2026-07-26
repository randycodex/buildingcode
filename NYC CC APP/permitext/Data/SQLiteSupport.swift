import Foundation
import SQLite3

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

enum AppSQLiteError: Error, LocalizedError {
    case openFailed(String)
    case prepareFailed(String)
    case stepFailed(String)
    case bindFailed(String)
    case executeFailed(String)

    var errorDescription: String? {
        switch self {
        case .openFailed(let message),
             .prepareFailed(let message),
             .stepFailed(let message),
             .bindFailed(let message),
             .executeFailed(let message):
            return message
        }
    }
}

final class SQLiteConnection {
    private var handle: OpaquePointer?

    init(path: String, readOnly: Bool) throws {
        let flags = readOnly ? SQLITE_OPEN_READONLY : (SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE)
        if sqlite3_open_v2(path, &handle, flags, nil) != SQLITE_OK {
            let message = handle.flatMap { String(cString: sqlite3_errmsg($0)) } ?? "Unable to open SQLite database."
            throw AppSQLiteError.openFailed(message)
        }

        // Wait briefly for a concurrent checkpoint or writer instead of failing an
        // otherwise valid local mutation immediately. This is connection-local.
        try execute("PRAGMA busy_timeout = 5000;")
        try execute("PRAGMA foreign_keys = ON;")

        // User data is accessed through writable connections. WAL lets readers
        // proceed while a short write transaction is active; leave SQLite's
        // default FULL synchronous setting intact for durability.
        if !readOnly {
            try execute("PRAGMA journal_mode = WAL;")
        }
    }

    deinit {
        sqlite3_close(handle)
    }

    func execute(_ sql: String) throws {
        guard sqlite3_exec(handle, sql, nil, nil, nil) == SQLITE_OK else {
            throw AppSQLiteError.executeFailed(lastErrorMessage())
        }
    }

    func prepare(_ sql: String) throws -> OpaquePointer {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
            throw AppSQLiteError.prepareFailed(lastErrorMessage())
        }
        return statement
    }

    func step(_ statement: OpaquePointer) throws -> Int32 {
        let result = sqlite3_step(statement)
        if result == SQLITE_DONE || result == SQLITE_ROW {
            return result
        }
        throw AppSQLiteError.stepFailed(lastErrorMessage())
    }

    func finalize(_ statement: OpaquePointer) {
        sqlite3_finalize(statement)
    }

    func bind(text: String, index: Int32, to statement: OpaquePointer) throws {
        guard sqlite3_bind_text(statement, index, text, -1, SQLITE_TRANSIENT) == SQLITE_OK else {
            throw AppSQLiteError.bindFailed(lastErrorMessage())
        }
    }

    func bind(data: Data, index: Int32, to statement: OpaquePointer) throws {
        let result = data.withUnsafeBytes { buffer -> Int32 in
            guard let baseAddress = buffer.baseAddress else {
                return sqlite3_bind_blob(statement, index, nil, 0, SQLITE_TRANSIENT)
            }
            return sqlite3_bind_blob(statement, index, baseAddress, Int32(data.count), SQLITE_TRANSIENT)
        }
        guard result == SQLITE_OK else {
            throw AppSQLiteError.bindFailed(lastErrorMessage())
        }
    }

    func lastInsertedRowID() -> Int64 {
        sqlite3_last_insert_rowid(handle)
    }

    func int64(at index: Int32, in statement: OpaquePointer) -> Int64 {
        sqlite3_column_int64(statement, index)
    }

    func int(at index: Int32, in statement: OpaquePointer) -> Int {
        Int(sqlite3_column_int(statement, index))
    }

    func string(at index: Int32, in statement: OpaquePointer) -> String {
        guard let pointer = sqlite3_column_text(statement, index) else { return "" }
        return String(cString: pointer)
    }

    func stringOrNil(at index: Int32, in statement: OpaquePointer) -> String? {
        guard sqlite3_column_type(statement, index) != SQLITE_NULL else { return nil }
        return string(at: index, in: statement)
    }

    func data(at index: Int32, in statement: OpaquePointer) -> Data? {
        guard let pointer = sqlite3_column_blob(statement, index) else { return nil }
        let length = Int(sqlite3_column_bytes(statement, index))
        return Data(bytes: pointer, count: length)
    }

    private func lastErrorMessage() -> String {
        handle.flatMap { String(cString: sqlite3_errmsg($0)) } ?? "Unknown SQLite error"
    }
}
