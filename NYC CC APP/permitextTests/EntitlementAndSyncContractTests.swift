import XCTest
import SQLite3
import UIKit
import CryptoKit
@testable import permitext

private final class ScopedPermitextURLProtocol: URLProtocol {
    typealias Handler = (URLRequest) throws -> (statusCode: Int, data: Data)

    private final class HandlerStore: @unchecked Sendable {
        private let lock = NSLock()
        private var handlers: [String: Handler] = [:]

        func install(_ handler: @escaping Handler, for host: String) {
            lock.lock()
            handlers[host] = handler
            lock.unlock()
        }

        func remove(for host: String) {
            lock.lock()
            handlers.removeValue(forKey: host)
            lock.unlock()
        }

        func handler(for host: String) -> Handler? {
            lock.lock()
            defer { lock.unlock() }
            return handlers[host]
        }
    }

    private static let handlerStore = HandlerStore()

    static func install(_ handler: @escaping Handler, for host: String) {
        handlerStore.install(handler, for: host)
    }

    static func removeHandler(for host: String) {
        handlerStore.remove(for: host)
    }

    override class func canInit(with request: URLRequest) -> Bool {
        guard let host = request.url?.host else { return false }
        return handlerStore.handler(for: host) != nil
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let url = request.url,
              let host = url.host,
              let handler = Self.handlerStore.handler(for: host)
        else {
            client?.urlProtocol(self, didFailWithError: URLError(.unsupportedURL))
            return
        }

        do {
            let result = try handler(request)
            let response = HTTPURLResponse(
                url: url,
                statusCode: result.statusCode,
                httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "application/json"]
            )!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: result.data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

private final class ResearchRequestPathRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var paths: [String] = []

    func record(_ path: String) {
        lock.lock()
        paths.append(path)
        lock.unlock()
    }

    func contains(_ path: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return paths.contains(path)
    }

    func snapshot() -> [String] {
        lock.lock()
        defer { lock.unlock() }
        return paths
    }
}

private func permitextRequestBody(_ request: URLRequest) throws -> Data {
    if let body = request.httpBody { return body }
    guard let stream = request.httpBodyStream else { throw URLError(.cannotDecodeContentData) }

    stream.open()
    defer { stream.close() }
    var data = Data()
    var buffer = [UInt8](repeating: 0, count: 4096)
    while stream.hasBytesAvailable {
        let count = stream.read(&buffer, maxLength: buffer.count)
        if count < 0 { throw stream.streamError ?? URLError(.cannotDecodeContentData) }
        if count == 0 { break }
        data.append(buffer, count: count)
    }
    return data
}

private actor StoreKitFinishBarrierProbe {
    private var callerStartCount = 0
    private var operationStartCount = 0
    private var callerCompletionCount = 0
    private var isReleased = false
    private var continuations: [CheckedContinuation<Void, Never>] = []

    func recordCallerStart() {
        callerStartCount += 1
    }

    func holdOperation() async {
        operationStartCount += 1
        guard !isReleased else { return }
        await withCheckedContinuation { continuation in
            continuations.append(continuation)
        }
    }

    func recordCallerCompletion() {
        callerCompletionCount += 1
    }

    func snapshot() -> (callerStarts: Int, operationStarts: Int, callerCompletions: Int) {
        (callerStartCount, operationStartCount, callerCompletionCount)
    }

    func releaseOperations() {
        isReleased = true
        let pendingContinuations = continuations
        continuations.removeAll()
        pendingContinuations.forEach { $0.resume() }
    }
}

private actor SyncPullRecorder {
    private var contentMapVersions: [Int?] = []
    private var pullCount = 0
    private var checkpointCount = 0
    private var excludedMutationKinds: [[String]] = []
    private var checkpointChanged: Bool

    init(checkpointChanged: Bool = true) {
        self.checkpointChanged = checkpointChanged
    }

    func setCheckpointChanged(_ changed: Bool) {
        checkpointChanged = changed
    }

    func recordPull(contentMapVersion: Int?, excludedMutationKinds: [String]) {
        pullCount += 1
        contentMapVersions.append(contentMapVersion)
        self.excludedMutationKinds.append(excludedMutationKinds)
    }

    func recordCheckpoint() {
        checkpointCount += 1
    }

    func recordedContentMapVersions() -> [Int?] {
        contentMapVersions
    }

    func recordedPullCount() -> Int {
        pullCount
    }

    func recordedCheckpointCount() -> Int {
        checkpointCount
    }

    func recordedExcludedMutationKinds() -> [[String]] {
        excludedMutationKinds
    }

    func currentCheckpointChanged() -> Bool {
        checkpointChanged
    }
}

private struct RecordingUserContentSyncBackend: UserContentSyncBackend {
    let name = "recording-sync"
    let recorder: SyncPullRecorder
    let returnedContentMapVersion: Int
    let returnedEntitlementFingerprint: String
    let returnedLatestEventID: Int64

    init(
        recorder: SyncPullRecorder,
        returnedContentMapVersion: Int,
        returnedEntitlementFingerprint: String = "fingerprint-v1",
        returnedLatestEventID: Int64 = 42
    ) {
        self.recorder = recorder
        self.returnedContentMapVersion = returnedContentMapVersion
        self.returnedEntitlementFingerprint = returnedEntitlementFingerprint
        self.returnedLatestEventID = returnedLatestEventID
    }

    func preview(items: [SyncQueueItem]) throws -> UserContentSyncPreviewReport {
        UserContentSyncPreviewReport(
            pendingCount: items.count,
            backendName: name,
            sampledItemIDs: items.map(\.id)
        )
    }

    func push(batch: UserContentSyncBatch, account: SignedInAccount) async throws -> UserContentSyncPushReport {
        UserContentSyncPushReport(
            attemptedCount: 0,
            completedCount: 0,
            backendName: name,
            accountUserID: account.appUserID,
            skippedReason: nil,
            sampledItemIDs: [],
            acceptedMutationIDs: [],
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
        await recorder.recordCheckpoint()
        let changed = await recorder.currentCheckpointChanged()
        return ServerUserContentCheckpointResult(
            userID: account.appUserID,
            checkedAt: Date(),
            changed: changed,
            latestEventID: returnedLatestEventID,
            syncRevision: returnedLatestEventID,
            contentMapVersion: returnedContentMapVersion,
            entitlementFingerprint: returnedEntitlementFingerprint
        )
    }

    func pull(
        account: SignedInAccount,
        since: Date?,
        sinceEventID: Int64?,
        contentMapVersion: Int?,
        excludedMutationKinds: [String]
    ) async throws -> ServerUserContentPullResult {
        await recorder.recordPull(
            contentMapVersion: contentMapVersion,
            excludedMutationKinds: excludedMutationKinds
        )
        return ServerUserContentPullResult(
            userID: account.appUserID,
            pulledAt: Date(),
            latestEventID: returnedLatestEventID,
            contentMapVersion: returnedContentMapVersion,
            entitlementFingerprint: returnedEntitlementFingerprint,
            mutations: []
        )
    }

    func previewMerge(
        incoming: ServerUserContentPullResult,
        localCandidates: [String: UserContentMergeCandidate]
    ) throws -> UserContentMergePlan {
        UserContentMergePlan(decisions: [])
    }
}

final class EntitlementAndSyncContractTests: XCTestCase {
    @MainActor
    func testIndependentReaderSessionSeparatesTransientStateAndDoesNotOwnAccountSync() {
        let mainDefaults = isolatedEntitlementDefaults()
        let readerDefaults = isolatedEntitlementDefaults()
        mainDefaults.set(AppPlan.pro.rawValue, forKey: LocalEntitlementService.planDefaultsKey)

        let main = CodeLibraryViewModel(
            continuityStore: ContinuityStore(defaults: mainDefaults),
            readerThemeStore: ReaderThemeStore(defaults: mainDefaults),
            preferencesDefaults: mainDefaults,
            entitlementService: LocalEntitlementService(defaults: mainDefaults),
            loadsInitialContent: false,
            loadsPersistedAccount: false,
            ownsAccountSync: true
        )
        let secondReader = CodeLibraryViewModel(
            continuityStore: ContinuityStore(defaults: readerDefaults),
            readerThemeStore: ReaderThemeStore(defaults: readerDefaults),
            preferencesDefaults: readerDefaults,
            entitlementService: LocalEntitlementService(defaults: readerDefaults),
            loadsInitialContent: false,
            loadsPersistedAccount: false,
            ownsAccountSync: false
        )

        main.selectedVersionFileName = "primary-version"
        main.selectedCodeSectionID = 101
        secondReader.selectedVersionFileName = "secondary-version"
        secondReader.selectedCodeSectionID = 202

        XCTAssertNotEqual(main.selectedVersionFileName, secondReader.selectedVersionFileName)
        XCTAssertNotEqual(main.selectedCodeSectionID, secondReader.selectedCodeSectionID)
        XCTAssertTrue(main.ownsAccountSyncForTesting)
        XCTAssertFalse(secondReader.ownsAccountSyncForTesting)

        var updatedTheme = ReaderTheme.default
        updatedTheme.fontSize = ReaderTheme.default.fontSize + 2
        main.updateReaderTheme(updatedTheme)
        secondReader.synchronizeIndependentReaderSession(from: main)

        XCTAssertEqual(secondReader.currentPlan, .pro)
        XCTAssertEqual(secondReader.readerTheme, updatedTheme.normalized)
        XCTAssertEqual(main.selectedVersionFileName, "primary-version")
        XCTAssertEqual(secondReader.selectedVersionFileName, "secondary-version")
    }

    func testTwoTypefaceContractUsesSourceSerifForReaderAndMigratesLegacyChoices() throws {
        XCTAssertEqual(ReaderFontChoice.allCases, [.sourceSerif4])
        XCTAssertEqual(ReaderTheme.default.fontChoice, .sourceSerif4)
        XCTAssertEqual(ReaderTheme.default.bodyFont.fontName, "SourceSerif4Variable-Roman")
        XCTAssertEqual(ReaderTheme.default.italicFont.fontName, "SourceSerif4Variable-Italic")
        XCTAssertEqual(ReaderTheme.minimumFontSize, 10)
        XCTAssertEqual(ReaderTheme.maximumFontSize, 24)
        XCTAssertEqual(ReaderTheme.default.fontSize, 17)
        XCTAssertEqual(
            ReaderTheme.default.fontSize,
            (ReaderTheme.minimumFontSize + ReaderTheme.maximumFontSize) / 2
        )
        XCTAssertEqual(ReaderTheme.minimumLineSpacing, -6)
        XCTAssertEqual(ReaderTheme.maximumLineSpacing, 6)
        XCTAssertEqual(ReaderTheme.default.lineSpacing, 0)
        XCTAssertEqual(
            ReaderTheme.default.lineSpacing,
            (ReaderTheme.minimumLineSpacing + ReaderTheme.maximumLineSpacing) / 2
        )
        var undersizedTheme = ReaderTheme.default
        undersizedTheme.fontSize = 8
        XCTAssertEqual(undersizedTheme.normalized.fontSize, 10)

        let legacyChoices: [ReaderFontChoice] = [
            .sfPro, .sfCompact, .sfMono, .newYork,
            .sanFrancisco, .serif, .rounded, .monospaced
        ]
        XCTAssertTrue(legacyChoices.allSatisfy { $0.normalizedChoice == .sourceSerif4 })

        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let infoData = try Data(contentsOf: projectRoot.appendingPathComponent("permitext/Info.plist"))
        let info = try XCTUnwrap(
            PropertyListSerialization.propertyList(from: infoData, format: nil) as? [String: Any]
        )
        XCTAssertEqual(
            info["UIAppFonts"] as? [String],
            ["SourceSerif4Variable-Roman.ttf", "SourceSerif4Variable-Italic.ttf"]
        )

        let projectSource = try String(
            contentsOf: projectRoot.appendingPathComponent("NYC CC APP.xcodeproj/project.pbxproj"),
            encoding: .utf8
        )
        XCTAssertTrue(projectSource.contains("SourceSerif4Variable-Roman.ttf in Resources"))
        XCTAssertTrue(projectSource.contains("SourceSerif4Variable-Italic.ttf in Resources"))
    }

    func testDistributionMetadataIsIPhoneOnly() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let projectSource = try String(
            contentsOf: projectRoot.appendingPathComponent("NYC CC APP.xcodeproj/project.pbxproj"),
            encoding: .utf8
        )

        XCTAssertFalse(projectSource.contains("TARGETED_DEVICE_FAMILY = \"1,2\";"))
        XCTAssertEqual(
            projectSource.components(separatedBy: "TARGETED_DEVICE_FAMILY = 1;").count - 1,
            8
        )
        XCTAssertEqual(
            projectSource.components(separatedBy: "SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD = NO;").count - 1,
            2
        )
        XCTAssertEqual(
            projectSource.components(separatedBy: "SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD = NO;").count - 1,
            2
        )
    }

    func testPreparedChapterHTMLInjectsOneMobileViewportBeforeLoading() throws {
        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-reader-viewport-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directoryURL) }

        let missingViewportURL = directoryURL.appendingPathComponent("missing.html")
        try "<html><head></head><body>Chapter</body></html>".write(
            to: missingViewportURL,
            atomically: true,
            encoding: .utf8
        )
        let preparedMissing = try XCTUnwrap(
            PreparedChapterHTMLCache.preparedHTML(
                chapterURL: missingViewportURL,
                readAccessURL: directoryURL,
                colorScheme: .dark
            )
        )
        XCTAssertEqual(preparedMissing.components(separatedBy: "name=\"viewport\"").count - 1, 1)
        XCTAssertTrue(preparedMissing.contains("width=device-width, initial-scale=1.0"))
        XCTAssertFalse(preparedMissing.contains("maximum-scale=1.0"))
        XCTAssertFalse(preparedMissing.contains("user-scalable=no"))

        let existingViewportURL = directoryURL.appendingPathComponent("existing.html")
        try "<html><head><meta name='viewport' content='width=device-width'></head><body>Chapter</body></html>".write(
            to: existingViewportURL,
            atomically: true,
            encoding: .utf8
        )
        let preparedExisting = try XCTUnwrap(
            PreparedChapterHTMLCache.preparedHTML(
                chapterURL: existingViewportURL,
                readAccessURL: directoryURL,
                colorScheme: .dark
            )
        )
        XCTAssertEqual(
            preparedExisting.lowercased().components(separatedBy: "name='viewport'").count - 1,
            1
        )
        XCTAssertFalse(preparedExisting.contains("user-scalable=no"))
    }

    func testPhase2ReaderNavigationAndFilterAccessibilitySourceContract() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let source = { (relativePath: String) throws -> String in
            try String(
                contentsOf: projectRoot.appendingPathComponent(relativePath),
                encoding: .utf8
            )
        }
        let browse = try source("permitext/Views/BrowseView.swift")
        let htmlReader = try source("permitext/Views/ChapterHTMLReaderView.swift")
        let nativeReader = try source("permitext/Views/ChapterReaderView.swift")
        let filters = try source("permitext/Views/CodeSectionMultiFilterChips.swift")
        let research = try source("permitext/Views/ResearchView.swift")
        let webView = try source("permitext/Views/ChapterHTMLWebView.swift")

        let navigationSources = [browse, htmlReader, nativeReader].joined(separator: "\n")
        XCTAssertFalse(navigationSources.contains("disablesInteractivePopGesture"))
        XCTAssertFalse(navigationSources.contains("InteractivePopGestureDisabler"))
        XCTAssertTrue(filters.contains("minimumHitHeight: CGFloat = 44"))
        XCTAssertTrue(filters.contains("Image(systemName: \"checkmark\")"))
        XCTAssertTrue(filters.contains(".accessibilityAddTraits(isSelected ? .isSelected : [])"))
        XCTAssertTrue(research.contains("Tap the sparkle icon to start Research."))
        XCTAssertFalse(research.localizedCaseInsensitiveContains("tap the Astroid"))
        XCTAssertTrue(webView.contains("maximumZoomScale = 5"))
        XCTAssertFalse(webView.contains("user-scalable=no"))
    }

    func testReaderHeaderShowsEditionOnlyWithoutBookIcon() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let browseSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/BrowseView.swift"),
            encoding: .utf8
        )

        let headerStart = try XCTUnwrap(browseSource.range(of: "private var libraryHeader: some View"))
        let headerEnd = try XCTUnwrap(
            browseSource.range(
                of: "private var constructionCodeSectionNames",
                range: headerStart.upperBound..<browseSource.endIndex
            )
        )
        let headerSource = String(browseSource[headerStart.lowerBound..<headerEnd.lowerBound])

        XCTAssertTrue(headerSource.contains("Text(selectedVersionName)"))
        XCTAssertTrue(headerSource.contains(".accessibilityIdentifier(\"reader-source-edition\")"))
        XCTAssertFalse(headerSource.contains("Source jurisdiction ·"))
        XCTAssertFalse(headerSource.contains("systemImage: \"text.book.closed\""))
    }

    func testPhase5FirstUseGateOffersOnlyGenuinelyNewInstallations() {
        let freshDefaults = isolatedEntitlementDefaults()
        XCTAssertTrue(
            PermitextFirstUseGate.evaluateBeforeLibraryStartup(
                defaults: freshDefaults,
                arguments: ["permitext-tests"]
            )
        )
        XCTAssertEqual(
            freshDefaults.integer(forKey: PermitextFirstUseGate.completionVersionKey),
            0
        )

        let returningDefaults = isolatedEntitlementDefaults()
        returningDefaults.set(Data([0x01]), forKey: "continuityContext")
        XCTAssertFalse(
            PermitextFirstUseGate.evaluateBeforeLibraryStartup(
                defaults: returningDefaults,
                arguments: ["permitext-tests"]
            )
        )
        XCTAssertEqual(
            returningDefaults.integer(forKey: PermitextFirstUseGate.completionVersionKey),
            PermitextFirstUseGate.currentVersion
        )

        let completedDefaults = isolatedEntitlementDefaults()
        PermitextFirstUseGate.complete(defaults: completedDefaults)
        XCTAssertFalse(
            PermitextFirstUseGate.evaluateBeforeLibraryStartup(
                defaults: completedDefaults,
                arguments: ["permitext-tests"]
            )
        )
    }

    func testPhase5FirstUsePresentationBypassesInterruptedIntent() {
        let eligible: (AppTab, Int64?, String?, Int) -> Bool = { tab, sectionID, invitation, selectionCount in
            PermitextFirstUseGate.canPresent(
                wasOffered: true,
                completedVersion: 0,
                selectedTab: tab,
                pendingDeepLinkedSectionID: sectionID,
                pendingInvitationToken: invitation,
                pendingResearchSelectionCount: selectionCount
            )
        }

        XCTAssertTrue(eligible(.browse, nil, nil, 0))
        XCTAssertFalse(eligible(.search, 101, nil, 0))
        XCTAssertFalse(eligible(.research, nil, "invite-token", 0))
        XCTAssertFalse(eligible(.research, nil, nil, 1))

        // The route can consume its pending section before the sheet finishes
        // dismissing. Completion depends on the captured dismissal cause, not
        // on re-reading transient route state at onDismiss time.
        XCTAssertFalse(
            PermitextFirstUseGate.shouldPersistCompletionAfterDismissal(
                dismissedForExternalIntent: true
            )
        )
    }

    func testPhase5FirstUseFixtureOverridesPersistedCompletion() {
        XCTAssertTrue(
            PermitextFirstUseGate.canPresent(
                wasOffered: true,
                isDebugPresentationForced: true,
                completedVersion: PermitextFirstUseGate.currentVersion,
                selectedTab: .browse,
                pendingDeepLinkedSectionID: nil,
                pendingInvitationToken: nil,
                pendingResearchSelectionCount: 0
            )
        )
    }

    private func isolatedEntitlementDefaults() -> UserDefaults {
        let suiteName = "permitext-tests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        return defaults
    }

    private func freeService() -> LocalEntitlementService {
        LocalEntitlementService(defaults: isolatedEntitlementDefaults())
    }

    private func temporaryLegacySearchDatabase() throws -> URL {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-legacy-search-\(UUID().uuidString).sqlite")
        let connection = try SQLiteConnection(path: databaseURL.path, readOnly: false)
        try connection.execute(
            """
            CREATE TABLE chapters (
                id INTEGER PRIMARY KEY,
                chapter_number TEXT NOT NULL,
                title TEXT NOT NULL
            );
            CREATE TABLE sections (
                id INTEGER PRIMARY KEY,
                chapter_id INTEGER NOT NULL,
                section_number TEXT NOT NULL,
                title TEXT NOT NULL,
                sort_key TEXT NOT NULL,
                official_text TEXT NOT NULL
            );
            CREATE VIRTUAL TABLE fts_paragraphs USING fts5(
                paragraph_text,
                section_number,
                chapter_number
            );
            INSERT INTO chapters (id, chapter_number, title) VALUES (1, '1', 'General');
            INSERT INTO sections (id, chapter_id, section_number, title, sort_key, official_text) VALUES
                (1, 1, '101.1', 'Fire resistance', '101.1', 'fire resistance'),
                (2, 1, '101.2', 'Operator', '101.2', 'OR'),
                (3, 1, '101.3', 'Near', '101.3', 'NEAR'),
                (4, 1, '101.4', 'Punctuation', '101.4', 'foo bar');
            INSERT INTO fts_paragraphs (paragraph_text, section_number, chapter_number) VALUES
                ('fire resistance assembly', '101.1', '1'),
                ('the literal OR operator', '101.2', '1'),
                ('the literal NEAR token', '101.3', '1'),
                ('foo bar punctuation', '101.4', '1');
            """
        )
        return databaseURL
    }

    private func scalarString(_ sql: String, connection: SQLiteConnection) throws -> String {
        let statement = try connection.prepare(sql)
        defer { connection.finalize(statement) }
        XCTAssertEqual(try connection.step(statement), SQLITE_ROW)
        return connection.string(at: 0, in: statement)
    }

    private func scalarInt(_ sql: String, connection: SQLiteConnection) throws -> Int {
        let statement = try connection.prepare(sql)
        defer { connection.finalize(statement) }
        XCTAssertEqual(try connection.step(statement), SQLITE_ROW)
        return connection.int(at: 0, in: statement)
    }

    func testWritableSQLiteConnectionEnablesWALAndBusyTimeout() throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-sqlite-durability-\(UUID().uuidString).sqlite")
        defer {
            for suffix in ["", "-shm", "-wal"] {
                try? FileManager.default.removeItem(atPath: databaseURL.path + suffix)
            }
        }

        let connection = try SQLiteConnection(path: databaseURL.path, readOnly: false)

        XCTAssertEqual(try scalarString("PRAGMA journal_mode;", connection: connection).lowercased(), "wal")
        XCTAssertEqual(try scalarInt("PRAGMA busy_timeout;", connection: connection), 5_000)
        XCTAssertEqual(try scalarInt("PRAGMA foreign_keys;", connection: connection), 1)
    }

    func testSQLiteConnectionSerializesConcurrentStatementLifetimes() async throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-sqlite-serialized-\(UUID().uuidString).sqlite")
        defer {
            for suffix in ["", "-shm", "-wal"] {
                try? FileManager.default.removeItem(atPath: databaseURL.path + suffix)
            }
        }

        let connection = try SQLiteConnection(path: databaseURL.path, readOnly: false)
        try connection.execute("CREATE TABLE concurrent_writes (value INTEGER NOT NULL);")

        try await withThrowingTaskGroup(of: Void.self) { group in
            for worker in 0..<8 {
                group.addTask {
                    for index in 0..<40 {
                        let statement = try connection.prepare(
                            "INSERT INTO concurrent_writes (value) VALUES (?);"
                        )
                        defer { connection.finalize(statement) }
                        sqlite3_bind_int64(statement, 1, Int64(worker * 40 + index))
                        _ = try connection.step(statement)
                    }
                }
            }
            try await group.waitForAll()
        }

        XCTAssertEqual(
            try scalarInt("SELECT COUNT(*) FROM concurrent_writes;", connection: connection),
            320
        )
    }

    func testLegacySQLiteFTSSearchTreatsOperatorsAndMalformedSyntaxAsLiteralText() throws {
        let databaseURL = try temporaryLegacySearchDatabase()
        defer { try? FileManager.default.removeItem(at: databaseURL) }
        let database = try CodeDatabase(databaseURL: databaseURL, locator: BundleDatabaseLocator())

        XCTAssertEqual(try database.search(query: "fire-resistance").map(\.id), [1])
        XCTAssertEqual(try database.search(query: "OR").map(\.id), [2])
        XCTAssertEqual(try database.search(query: "NEAR(").map(\.id), [3])
        XCTAssertEqual(try database.search(query: "foo:bar").map(\.id), [4])
        XCTAssertEqual(try database.search(query: "\"fire resistance").map(\.id), [1])
        XCTAssertNoThrow(try database.search(query: "*"))
        XCTAssertNoThrow(try database.search(query: "\""))
        XCTAssertEqual(CodeDatabase.literalFTSQuery(for: "\""), "\"\"\"\"")
    }

    func testProjectEvidenceIncludesProjectOnlySectionsAndConsolidatesAnnotations() throws {
        let databaseURL = try temporaryLegacySearchDatabase()
        defer { try? FileManager.default.removeItem(at: databaseURL) }
        let database = try CodeDatabase(databaseURL: databaseURL, locator: BundleDatabaseLocator())
        let codeVersion = UserContentSyncCodeVersion.localNYC2022

        let projectOnly = try database.savedSections(
            ids: [1],
            codeVersion: codeVersion,
            bookmarkedSectionIDs: [],
            notesBySectionID: [:],
            includeProjectOnlySections: true
        )
        XCTAssertEqual(projectOnly.count, 1)
        XCTAssertFalse(try XCTUnwrap(projectOnly.first).isBookmarked)

        let baseAndAnnotation = try database.savedSections(
            ids: [1],
            codeVersion: codeVersion,
            bookmarkedSectionIDs: [1],
            notesBySectionID: [:],
            annotationEntries: [
                UserAnnotationEntry(
                    sectionID: 1,
                    blockID: "paragraph-1",
                    noteBody: "Commenting commenting",
                    tags: ["Field note"]
                )
            ],
            includeProjectOnlySections: true
        )
        let consolidated = ProjectEvidenceConsolidator.consolidated(baseAndAnnotation)
        XCTAssertEqual(baseAndAnnotation.count, 2)
        XCTAssertEqual(consolidated.count, 1)
        XCTAssertFalse(try XCTUnwrap(consolidated.first).isBlockAnnotation)
        XCTAssertEqual(consolidated.first?.noteBody, "Commenting commenting")
        XCTAssertEqual(consolidated.first?.tags, ["Field note"])

        let paragraphOnly = try database.savedSections(
            ids: [2],
            codeVersion: codeVersion,
            bookmarkedSectionIDs: [],
            notesBySectionID: [:],
            annotationEntries: [
                UserAnnotationEntry(sectionID: 2, blockID: "paragraph-2", noteBody: "Paragraph note")
            ],
            includeProjectOnlySections: true
        )
        let consolidatedParagraph = ProjectEvidenceConsolidator.consolidated(paragraphOnly)
        XCTAssertEqual(paragraphOnly.count, 1)
        XCTAssertEqual(consolidatedParagraph.count, 1)
        XCTAssertTrue(try XCTUnwrap(consolidatedParagraph.first).isBlockAnnotation)
    }

    func testSavedEvidenceSuppressesPreviewThatRepeatsItsTitle() {
        let repeated = BookmarkedSection(
            id: 1,
            codeVersion: UserContentSyncCodeVersion.localNYC2022,
            chapterNumber: "1",
            chapterTitle: "Fuel Gas",
            sectionNumber: "1.1",
            title: "Underground inspection and/or testing of installed piping.",
            previewText: "underground inspection and/or testing of installed piping"
        )
        XCTAssertEqual(repeated.nonRepeatingPreviewText, "")

        let distinct = BookmarkedSection(
            id: 2,
            codeVersion: UserContentSyncCodeVersion.localNYC2022,
            chapterNumber: "1",
            chapterTitle: "Fuel Gas",
            sectionNumber: "1.2",
            title: "Required inspection.",
            previewText: "The inspection must occur before backfill."
        )
        XCTAssertEqual(distinct.nonRepeatingPreviewText, "The inspection must occur before backfill.")
    }

    func testSavedEvidenceExcerptMatchesWebHierarchyWithoutRepeatingHeading() {
        let officialText = "101.1 Title. This code shall be known and may be cited as the New York City Building Code."
        XCTAssertEqual(
            officialText.evidenceExcerpt(sectionNumber: "101.1", title: "101.1 Title."),
            "This code shall be known and may be cited as the New York City Building Code."
        )

        let annotation = BookmarkedSection(
            id: 1,
            annotationBlockID: "paragraph-1",
            annotationLabel: "Paragraph annotation",
            codeVersion: UserContentSyncCodeVersion.localNYC2022,
            chapterNumber: "1",
            chapterTitle: "Building Code",
            sectionNumber: "101.1",
            title: "101.1 Title.",
            previewText: "This code shall be known and may be cited as the New York City Building Code."
        )
        XCTAssertEqual(annotation.evidenceDisplayTitle, "Title.")
        XCTAssertFalse(annotation.evidenceDisplayTitle.localizedCaseInsensitiveContains("paragraph"))
    }

    func testBundledProjectEvidenceMatchesSevenWebEvidenceRowsAndCodeGroups() throws {
        let versions = BundleDatabaseLocator().availableCodeVersions()
        let constructionVersion = try XCTUnwrap(versions.first {
            UserContentSyncCodeVersion.server($0.codeVersion) == UserContentSyncCodeVersion.canonicalNYC2022
        })
        let enactedVersion = try XCTUnwrap(versions.first {
            UserContentSyncCodeVersion.server($0.codeVersion) ==
                UserContentSyncCodeVersion.canonicalNYCEnactedAdministrative
        })
        let constructionStore = try AuthoredCodeStore(
            jsonURL: constructionVersion.fileURL,
            codeID: try XCTUnwrap(constructionVersion.authoredCodeID),
            jurisdictionID: try XCTUnwrap(constructionVersion.jurisdictionID)
        )
        let enactedStore = try AuthoredCodeStore(
            jsonURL: enactedVersion.fileURL,
            codeID: try XCTUnwrap(enactedVersion.authoredCodeID),
            jurisdictionID: try XCTUnwrap(enactedVersion.jurisdictionID)
        )

        let constructionSections = constructionStore.codeSections()
        let buildingID = try XCTUnwrap(constructionSections.first { $0.name == "BUILDING CODE" }?.id)
        let generalAdminID = try XCTUnwrap(
            constructionSections.first { $0.name.contains("GENERAL ADMINISTRATIVE") }?.id
        )
        let mechanicalID = try XCTUnwrap(constructionSections.first { $0.name == "MECHANICAL CODE" }?.id)
        let building1062 = try XCTUnwrap(
            constructionStore.sectionSummary(sectionNumber: "106.2", codeSectionID: buildingID)
        )
        let building1063 = try XCTUnwrap(
            constructionStore.sectionSummary(sectionNumber: "106.3", codeSectionID: buildingID)
        )
        let administrative284061 = try XCTUnwrap(
            constructionStore.sectionSummary(sectionNumber: "28-406.1", codeSectionID: generalAdminID)
        )
        let mechanical11 = try XCTUnwrap(
            constructionStore.sectionSummary(sectionNumber: "1.1.", codeSectionID: mechanicalID)
                ?? constructionStore.sectionSummary(sectionNumber: "1.1", codeSectionID: mechanicalID)
        )

        let constructionRows = constructionStore.savedSections(
            ids: [building1062.id, building1063.id, administrative284061.id, mechanical11.id],
            codeVersion: UserContentSyncCodeVersion.localNYC2022,
            bookmarkedSectionIDs: [building1062.id, administrative284061.id],
            notesBySectionID: [:],
            annotationEntries: [
                UserAnnotationEntry(
                    sectionID: building1062.id,
                    blockID: "paragraph-106.2",
                    noteBody: "Commenting commenting"
                ),
                UserAnnotationEntry(sectionID: mechanical11.id, blockID: "paragraph-1.1")
            ],
            includeProjectOnlySections: true
        )

        let enactedSections = enactedStore.codeSections()
        let historicalID = try XCTUnwrap(enactedSections.first { $0.name.contains("1968 BUILDING") }?.id)
        let title28ID = try XCTUnwrap(enactedSections.first { $0.name.contains("TITLE 28") }?.id)
        XCTAssertEqual(historicalID, 4)
        XCTAssertEqual(title28ID, 6)
        let historical27867ID: Int64 = 31_001_660
        let current284061ID: Int64 = 31_003_026
        XCTAssertTrue(enactedStore.sections(chapterID: 30_000_072).contains { $0.id == historical27867ID })
        XCTAssertTrue(enactedStore.sections(chapterID: 30_000_085).contains { $0.id == current284061ID })
        let enactedRows = enactedStore.savedSections(
            ids: [historical27867ID, current284061ID],
            codeVersion: UserContentSyncCodeVersion.localNYCEnactedAdministrative,
            bookmarkedSectionIDs: [],
            notesBySectionID: [:],
            includeProjectOnlySections: true
        )

        let projectRows = constructionRows + enactedRows
        XCTAssertEqual(projectRows.count, 7)
        XCTAssertEqual(projectRows.filter(\.isBlockAnnotation).count, 2)
        XCTAssertTrue(projectRows.contains {
            $0.sectionNumber == "106.2" && $0.annotationBlockID == "paragraph-106.2"
        })

        let consolidated = ProjectEvidenceConsolidator.consolidated(projectRows)
        let groups = ProjectEvidenceOrganizer.codeGroups(consolidated)
        XCTAssertEqual(consolidated.count, 6)
        XCTAssertEqual(groups.flatMap(\.items).count, 6)
        XCTAssertEqual(
            groups.map(\.displayTitle),
            [
                "Building Code",
                "General Administrative Code (2022 Edition)",
                "Mechanical Code",
                "1968 Building Code (Historical)",
                "Administrative Code Title 28 — Current Consolidation"
            ]
        )
        XCTAssertEqual(groups.first?.items.map(\.sectionNumber), ["106.2", "106.3"])
        XCTAssertEqual(groups.first?.items.map(\.isBlockAnnotation), [false, false])
        XCTAssertEqual(groups.first?.items.first?.noteBody, "Commenting commenting")
    }

    func testLegacyAuthoredMonolithIsNotShippedInAppResources() {
        XCTAssertNil(
            Bundle.main.url(forResource: "nyc_code_authored", withExtension: "json")
        )
    }

    @MainActor
    func testDeepLinksResolveTheirCodeVersionFromBundledSectionMetadata() throws {
        let versions = BundleDatabaseLocator().availableCodeVersions()
        let construction = try XCTUnwrap(versions.first {
            UserContentSyncCodeVersion.server($0.codeVersion) == UserContentSyncCodeVersion.canonicalNYC2022
        })
        let zoning = try XCTUnwrap(versions.first {
            UserContentSyncCodeVersion.server($0.codeVersion) == UserContentSyncCodeVersion.canonicalNYCZoning
        })

        XCTAssertEqual(
            CodeLibraryViewModel.codeVersion(containingDeepLinkedSectionID: 1, in: versions)?.fileName,
            construction.fileName
        )
        XCTAssertEqual(
            CodeLibraryViewModel.codeVersion(containingDeepLinkedSectionID: 20_018_455, in: versions)?.fileName,
            zoning.fileName
        )
    }

    func testBundledWebViewNavigationPolicyAllowsOnlyLocalReaderPaths() {
        let root = URL(fileURLWithPath: "/tmp/permitext-reader", isDirectory: true)

        XCTAssertTrue(
            BundledWebViewNavigationPolicy.allowsTopLevelNavigation(
                to: root.appendingPathComponent("chapters/1.html"),
                under: root
            )
        )
        XCTAssertTrue(
            BundledWebViewNavigationPolicy.allowsTopLevelNavigation(
                to: root.appendingPathComponent("assets/figure.png"),
                under: root
            )
        )
        XCTAssertTrue(
            BundledWebViewNavigationPolicy.allowsTopLevelNavigation(
                to: URL(string: "about:blank"),
                under: root
            )
        )
        XCTAssertFalse(
            BundledWebViewNavigationPolicy.allowsTopLevelNavigation(
                to: URL(string: "https://example.com/reader"),
                under: root
            )
        )
        XCTAssertFalse(
            BundledWebViewNavigationPolicy.allowsTopLevelNavigation(
                to: URL(fileURLWithPath: "/tmp/unrelated.html"),
                under: root
            )
        )
        XCTAssertFalse(
            BundledWebViewNavigationPolicy.allowsNavigation(
                to: URL(string: "https://example.com/embedded"),
                under: root,
                isMainFrame: false
            )
        )
        XCTAssertFalse(
            BundledWebViewNavigationPolicy.allowsNavigation(
                to: root.appendingPathComponent("chapters/embedded.html"),
                under: root,
                isMainFrame: nil
            )
        )
        XCTAssertEqual(
            BundledWebViewNavigationPolicy.externalURLForUserActivatedNavigation(
                to: URL(string: "https://zr.planning.nyc.gov/article-i/chapter-1"),
                isUserActivated: true,
                isMainFrame: nil
            )?.scheme,
            "https"
        )
        XCTAssertNil(
            BundledWebViewNavigationPolicy.externalURLForUserActivatedNavigation(
                to: URL(string: "javascript:alert(1)"),
                isUserActivated: true,
                isMainFrame: true
            )
        )
        XCTAssertNil(
            BundledWebViewNavigationPolicy.externalURLForUserActivatedNavigation(
                to: URL(string: "https://example.com/iframe"),
                isUserActivated: true,
                isMainFrame: false
            )
        )
    }

    func testChapterHTMLLoadRecoveryPolicyRetriesFailuresButNotCancellation() {
        XCTAssertTrue(
            ChapterHTMLLoadRecoveryPolicy.shouldRetry(
                error: NSError(domain: "permitext.reader.test", code: 1),
                attempt: 0
            )
        )
        XCTAssertFalse(
            ChapterHTMLLoadRecoveryPolicy.shouldRetry(
                error: NSError(domain: NSURLErrorDomain, code: NSURLErrorCancelled),
                attempt: 0
            )
        )
        XCTAssertFalse(
            ChapterHTMLLoadRecoveryPolicy.shouldRetry(
                error: NSError(domain: "permitext.reader.test", code: 1),
                attempt: ChapterHTMLLoadRecoveryPolicy.maximumAutomaticAttempts
            )
        )
    }

    func testSyncConflictErrorsRecognizeProductionCodesAndLegacyMessages() {
        let serverNewer = BackendUserContentRejection(
            code: "SERVER_NEWER",
            message: "A newer version of this item is already on the server. Review it before retrying."
        )
        let equalTimestamp = BackendUserContentRejection(
            code: "EQUAL_TIMESTAMP_CONFLICT",
            message: "This item changed in two places at the same time. Review the sync conflict before retrying."
        )

        XCTAssertEqual(
            UserContentSyncConflictError.message(
                from: UserContentSyncConflictError.persistedDescription(for: serverNewer)
            ),
            serverNewer.message
        )
        XCTAssertEqual(
            UserContentSyncConflictError.message(
                from: UserContentSyncConflictError.persistedDescription(for: equalTimestamp)
            ),
            equalTimestamp.message
        )
        XCTAssertNotNil(UserContentSyncConflictError.message(from: serverNewer.message))
        XCTAssertNotNil(UserContentSyncConflictError.message(from: equalTimestamp.message))
        XCTAssertNotNil(UserContentSyncConflictError.message(from: "Server has newer data for this record."))
        XCTAssertNil(
            UserContentSyncConflictError.message(
                from: "[PRO_REQUIRED_PROJECTS] Projects require Pro."
            )
        )
        XCTAssertTrue(UserContentSyncConflictError.shouldAutomaticallyUseServerCopy(serverNewer))
        XCTAssertTrue(UserContentSyncConflictError.shouldAutomaticallyUseServerCopy(equalTimestamp))
        XCTAssertFalse(
            UserContentSyncConflictError.shouldAutomaticallyUseServerCopy(
                BackendUserContentRejection(
                    code: "PRO_REQUIRED_PROJECTS",
                    message: "Projects require Pro."
                )
            )
        )
    }

    func testSyncConflictPresentationIdentifiesEverySupportedRecordKind() {
        let expected: [(ServerUserContentEntityKind, String, String)] = [
            (.savedItem, "Saved section", "bookmark"),
            (.annotation, "Annotation", "note.text"),
            (.project, "Project", "folder"),
            (.projectSection, "Project evidence", "folder.badge.plus"),
            (.workboard, "Workboard", "rectangle.3.group"),
            (.continuity, "Reading position", "clock.arrow.circlepath"),
            (.codeVersionClear, "Cleared saved data", "trash.slash")
        ]

        for (kind, title, systemImage) in expected {
            let conflict = UserContentSyncConflict(
                recordID: "record-with-a-very-long-identifier-1234567890",
                entityKind: kind,
                message: "Changed in two places."
            )
            XCTAssertEqual(conflict.displayTitle, title)
            XCTAssertEqual(conflict.systemImage, systemImage)
            XCTAssertEqual(conflict.recordReference, "…ifier-1234567890")
        }

        let shortReference = UserContentSyncConflict(
            recordID: "short-record",
            entityKind: .savedItem,
            message: "Server copy is newer."
        )
        XCTAssertEqual(shortReference.recordReference, "short-record")
    }

    func testStoreKitTransactionPolicyTracksInactiveOwnedProducts() {
        let now = Date(timeIntervalSince1970: 2_000_000)
        XCTAssertTrue(StoreKitTransactionPolicy.isKnownProductID(StoreKitProductID.proMonthly))
        XCTAssertTrue(StoreKitTransactionPolicy.isKnownProductID(StoreKitProductID.researchMonthly))
        XCTAssertFalse(StoreKitTransactionPolicy.isKnownProductID("unrelated.product"))

        XCTAssertTrue(
            StoreKitTransactionPolicy.isActive(
                productID: StoreKitProductID.proMonthly,
                expectedProductID: StoreKitProductID.proMonthly,
                revocationDate: nil,
                expirationDate: now.addingTimeInterval(60),
                now: now
            )
        )
        XCTAssertFalse(
            StoreKitTransactionPolicy.isActive(
                productID: StoreKitProductID.proMonthly,
                expectedProductID: StoreKitProductID.proMonthly,
                revocationDate: now,
                expirationDate: nil,
                now: now
            )
        )
        XCTAssertTrue(
            StoreKitTransactionPolicy.shouldFinishInactiveTransaction(
                productID: StoreKitProductID.proMonthly,
                revocationDate: nil,
                expirationDate: now,
                now: now
            )
        )
        XCTAssertTrue(
            StoreKitTransactionPolicy.shouldFinishInactiveTransaction(
                productID: StoreKitProductID.researchMonthly,
                revocationDate: now,
                expirationDate: nil,
                now: now
            )
        )
        XCTAssertFalse(
            StoreKitTransactionPolicy.shouldFinishInactiveTransaction(
                productID: StoreKitProductID.proMonthly,
                revocationDate: nil,
                expirationDate: nil,
                now: now
            )
        )
        XCTAssertFalse(
            StoreKitTransactionPolicy.shouldFinishInactiveTransaction(
                productID: StoreKitProductID.proMonthly,
                revocationDate: nil,
                expirationDate: now.addingTimeInterval(60),
                now: now
            )
        )
        XCTAssertFalse(
            StoreKitTransactionPolicy.shouldFinishInactiveTransaction(
                productID: "unrelated.product",
                revocationDate: now,
                expirationDate: now,
                now: now
            )
        )
        XCTAssertFalse(
            StoreKitTransactionPolicy.isActive(
                productID: StoreKitProductID.researchMonthly,
                expectedProductID: StoreKitProductID.researchMonthly,
                revocationDate: nil,
                expirationDate: now,
                now: now
            )
        )
        XCTAssertEqual(
            StoreKitTransactionPolicy.resolvedPlan(snapshotPlan: .free, verifiedPurchaseIsActive: true),
            .pro
        )
        XCTAssertEqual(
            StoreKitTransactionPolicy.resolvedPlan(snapshotPlan: .free, verifiedPurchaseIsActive: false),
            .free
        )
    }

    func testStoreKitTransactionFinishBarrierCoalescesOnlyConcurrentCleanup() async {
        let barrier = StoreKitTransactionFinishBarrier()
        let probe = StoreKitFinishBarrierProbe()
        let transactionID: UInt64 = 42

        let firstCaller = Task {
            await probe.recordCallerStart()
            await barrier.finishOnce(transactionID: transactionID) {
                await probe.holdOperation()
            }
            await probe.recordCallerCompletion()
        }

        while (await probe.snapshot()).operationStarts == 0 {
            await Task.yield()
        }

        let secondCaller = Task {
            await probe.recordCallerStart()
            await barrier.finishOnce(transactionID: transactionID) {
                await probe.holdOperation()
            }
            await probe.recordCallerCompletion()
        }

        while (await probe.snapshot()).callerStarts < 2 {
            await Task.yield()
        }
        var probeSnapshot = await probe.snapshot()
        XCTAssertEqual(probeSnapshot.callerStarts, 2)
        XCTAssertEqual(probeSnapshot.operationStarts, 1)
        XCTAssertEqual(probeSnapshot.callerCompletions, 0)

        await probe.releaseOperations()
        await firstCaller.value
        await secondCaller.value

        probeSnapshot = await probe.snapshot()
        XCTAssertEqual(probeSnapshot.operationStarts, 1)
        XCTAssertEqual(probeSnapshot.callerCompletions, 2)

        await barrier.finishOnce(transactionID: transactionID) {
            await probe.holdOperation()
        }
        probeSnapshot = await probe.snapshot()
        XCTAssertEqual(probeSnapshot.operationStarts, 2)
    }

    func testStoreKitTransactionDrainPolicyUsesBoundedBackoff() {
        XCTAssertEqual(StoreKitTransactionDrainPolicy.maximumPasses, 3)
        XCTAssertGreaterThan(StoreKitTransactionDrainPolicy.initialSettlingDelayNanoseconds, 0)
        XCTAssertEqual(
            StoreKitTransactionDrainPolicy.settlingDelayNanoseconds(afterCompletedPass: 1),
            StoreKitTransactionDrainPolicy.initialSettlingDelayNanoseconds
        )
        XCTAssertEqual(
            StoreKitTransactionDrainPolicy.settlingDelayNanoseconds(afterCompletedPass: 2),
            StoreKitTransactionDrainPolicy.initialSettlingDelayNanoseconds * 2
        )
        XCTAssertEqual(
            StoreKitTransactionDrainPolicy.settlingDelayNanoseconds(afterCompletedPass: 3),
            StoreKitTransactionDrainPolicy.initialSettlingDelayNanoseconds * 4
        )
        XCTAssertEqual(
            StoreKitTransactionDrainPolicy.settlingDelayNanoseconds(afterCompletedPass: 4),
            StoreKitTransactionDrainPolicy.initialSettlingDelayNanoseconds * 4
        )
        XCTAssertEqual(
            StoreKitSubscriptionServiceError.inactiveTransactionQueueDidNotSettle.localizedDescription,
            "The App Store is still clearing an expired subscription. No charge was made. Wait a moment, then select Subscribe again."
        )
    }

    func testStoreKitAccountBindingPolicyRequiresAccountSpecificAuthorization() {
        XCTAssertEqual(
            StoreKitAccountBindingPolicy.decision(
                snapshotPlan: .free,
                transactionEnvironment: "sandbox",
                hasSignedTransactionInfo: true,
                signedInUserID: "user-a",
                boundTestUserID: "user-a",
                allowsNewTestBinding: true
            ),
            .inactive
        )
        XCTAssertEqual(
            StoreKitAccountBindingPolicy.decision(
                snapshotPlan: .pro,
                transactionEnvironment: "sandbox",
                hasSignedTransactionInfo: true,
                signedInUserID: nil,
                boundTestUserID: nil,
                allowsNewTestBinding: true
            ),
            .signInRequired
        )
        XCTAssertEqual(
            StoreKitAccountBindingPolicy.decision(
                snapshotPlan: .pro,
                transactionEnvironment: "sandbox",
                hasSignedTransactionInfo: true,
                signedInUserID: "user-a",
                boundTestUserID: nil,
                allowsNewTestBinding: true
            ),
            .bindLocalTest
        )
        XCTAssertEqual(
            StoreKitAccountBindingPolicy.decision(
                snapshotPlan: .pro,
                transactionEnvironment: "xcode",
                hasSignedTransactionInfo: true,
                signedInUserID: "user-a",
                boundTestUserID: nil,
                allowsNewTestBinding: false
            ),
            .explicitRestoreRequired
        )
        XCTAssertEqual(
            StoreKitAccountBindingPolicy.decision(
                snapshotPlan: .pro,
                transactionEnvironment: "sandbox",
                hasSignedTransactionInfo: true,
                signedInUserID: "user-a",
                boundTestUserID: "user-a",
                allowsNewTestBinding: false
            ),
            .authorizedLocalTest
        )
        XCTAssertEqual(
            StoreKitAccountBindingPolicy.decision(
                snapshotPlan: .pro,
                transactionEnvironment: "sandbox",
                hasSignedTransactionInfo: true,
                signedInUserID: "user-b",
                boundTestUserID: "user-a",
                allowsNewTestBinding: true
            ),
            .ownedByAnotherAccount
        )
        XCTAssertEqual(
            StoreKitAccountBindingPolicy.decision(
                snapshotPlan: .pro,
                transactionEnvironment: "production",
                hasSignedTransactionInfo: true,
                signedInUserID: "user-a",
                boundTestUserID: nil,
                allowsNewTestBinding: false
            ),
            .requiresBackendVerification
        )
        XCTAssertEqual(
            StoreKitAccountBindingPolicy.decision(
                snapshotPlan: .pro,
                transactionEnvironment: "sandbox",
                hasSignedTransactionInfo: true,
                signedInUserID: "user-a",
                boundTestUserID: "user-a",
                allowsNewTestBinding: false,
                allowsSandboxBackendVerification: true
            ),
            .requiresBackendVerification
        )
        XCTAssertEqual(
            StoreKitAccountBindingPolicy.decision(
                snapshotPlan: .pro,
                transactionEnvironment: "sandbox",
                hasSignedTransactionInfo: false,
                signedInUserID: "user-a",
                boundTestUserID: nil,
                allowsNewTestBinding: true,
                allowsSandboxBackendVerification: true
            ),
            .missingTransactionEvidence
        )
        XCTAssertEqual(
            StoreKitAccountBindingPolicy.decision(
                snapshotPlan: .pro,
                transactionEnvironment: nil,
                hasSignedTransactionInfo: false,
                signedInUserID: "user-a",
                boundTestUserID: nil,
                allowsNewTestBinding: false
            ),
            .missingTransactionEvidence
        )
    }

    func testStoreKitBackendVerificationContinuityPreservesOnlyLinkedTestAccess() {
        XCTAssertTrue(
            StoreKitBackendVerificationContinuityPolicy.preservesAuthorizedTestState(
                snapshotPlan: .pro,
                transactionEnvironment: "sandbox",
                hasActiveBackendProEntitlement: true,
                backendEntitlementSource: .appleSubscription
            )
        )
        XCTAssertTrue(
            StoreKitBackendVerificationContinuityPolicy.preservesAuthorizedTestState(
                snapshotPlan: .pro,
                transactionEnvironment: "xcode",
                hasActiveBackendProEntitlement: true,
                backendEntitlementSource: .subscription
            )
        )
        XCTAssertFalse(
            StoreKitBackendVerificationContinuityPolicy.preservesAuthorizedTestState(
                snapshotPlan: .pro,
                transactionEnvironment: "sandbox",
                hasActiveBackendProEntitlement: false,
                backendEntitlementSource: .appleSubscription
            )
        )
        XCTAssertFalse(
            StoreKitBackendVerificationContinuityPolicy.preservesAuthorizedTestState(
                snapshotPlan: .pro,
                transactionEnvironment: "sandbox",
                hasActiveBackendProEntitlement: true,
                backendEntitlementSource: .webSubscription
            )
        )
        XCTAssertFalse(
            StoreKitBackendVerificationContinuityPolicy.preservesAuthorizedTestState(
                snapshotPlan: .pro,
                transactionEnvironment: "production",
                hasActiveBackendProEntitlement: true,
                backendEntitlementSource: .appleSubscription
            )
        )
        XCTAssertFalse(
            StoreKitBackendVerificationContinuityPolicy.preservesAuthorizedTestState(
                snapshotPlan: .free,
                transactionEnvironment: "sandbox",
                hasActiveBackendProEntitlement: true,
                backendEntitlementSource: .appleSubscription
            )
        )
    }

    func testSignedInAccountPersistenceRemovesLegacySessionToken() {
        let account = SignedInAccount(
            appUserID: "apple:persistence-test",
            authProvider: .apple,
            authProviderUserID: "persistence-test",
            appleUserID: "persistence-test",
            email: "owner@example.com",
            publicUsername: "permitext-test",
            displayName: "Persistence Test",
            signedInAt: Date(timeIntervalSince1970: 100),
            migrationState: .localDataAttached,
            backendSessionToken: "sensitive-session-token"
        )
        let sanitized = SignedInAccountPersistence.removingBackendSessionToken(from: account)

        XCTAssertNil(sanitized.backendSessionToken)
        XCTAssertEqual(sanitized.appUserID, account.appUserID)
        XCTAssertEqual(sanitized.email, account.email)
        XCTAssertEqual(sanitized.migrationState, account.migrationState)
    }

    func testReleaseBackendURLPolicyFailsClosed() {
        XCTAssertEqual(
            PermitextBackendConfiguration.resolvedAPIBaseURLString(
                defaultsBaseURL: "https://permitext-sync.vercel.app",
                bundleBaseURL: "https://permitext-apple-sandbox.vercel.app",
                allowsDebugOverride: false
            ),
            "https://permitext-apple-sandbox.vercel.app"
        )
        XCTAssertEqual(
            PermitextBackendConfiguration.resolvedAPIBaseURLString(
                defaultsBaseURL: "https://permitext-sync.vercel.app",
                bundleBaseURL: "https://permitext-apple-sandbox.vercel.app",
                allowsDebugOverride: true
            ),
            "https://permitext-sync.vercel.app"
        )
        XCTAssertTrue(
            PermitextBackendConfiguration.allowsAppleSandboxBackendVerification(
                apiBaseURLString: "https://permitext-apple-sandbox.vercel.app"
            )
        )
        XCTAssertFalse(
            PermitextBackendConfiguration.allowsAppleSandboxBackendVerification(
                apiBaseURLString: "https://permitext-sync.vercel.app"
            )
        )
        XCTAssertFalse(
            PermitextBackendConfiguration.allowsAppleSandboxBackendVerification(
                apiBaseURLString: "https://permitext-apple-sandbox.vercel.app.evil.example"
            )
        )
        XCTAssertFalse(
            PermitextBackendConfiguration.allowsAppleSandboxBackendVerification(
                apiBaseURLString: "http://permitext-apple-sandbox.vercel.app"
            )
        )
        XCTAssertNotNil(
            PermitextBackendConfiguration.validatedHTTPBaseURL(
                "https://permitext.com",
                allowsInsecureLocalhost: false
            )
        )
        XCTAssertNil(
            PermitextBackendConfiguration.validatedHTTPBaseURL(
                "http://permitext.com",
                allowsInsecureLocalhost: false
            )
        )
        XCTAssertNil(
            PermitextBackendConfiguration.validatedHTTPBaseURL(
                "not a URL",
                allowsInsecureLocalhost: false
            )
        )
        XCTAssertNotNil(
            PermitextBackendConfiguration.validatedHTTPBaseURL(
                "http://localhost:8787",
                allowsInsecureLocalhost: true
            )
        )
    }

    func testFreePlanIncludesContinuityAndCrossDeviceSync() {
        let service = freeService()

        XCTAssertEqual(service.currentPlan, .free)
        XCTAssertEqual(service.canUse(.continuity), .allowed)
        XCTAssertEqual(service.canUse(.crossDeviceSync), .allowed)
    }

    func testFreePlanRetainsSavedAndNoteLimits() {
        let service = freeService()

        XCTAssertEqual(service.canCreateSavedSection(currentCount: 24), .allowed)
        XCTAssertNotEqual(service.canCreateSavedSection(currentCount: 25), .allowed)
        XCTAssertEqual(service.canCreateNote(currentCount: 9), .allowed)
        XCTAssertNotEqual(service.canCreateNote(currentCount: 10), .allowed)
        XCTAssertNotEqual(service.canCreateProject(currentCount: 0), .allowed)
    }

    func testFreePlanSavedAndNoteLimitsCountAcrossCodeVersions() throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-account-wide-counts-\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: databaseURL) }

        let store = try UserDataStore(databaseURL: databaseURL)
        let firstCodeVersion = "nyc-2022"
        let secondCodeVersion = "nyc-2014"

        for sectionID in Int64(1)...24 {
            try store.toggleBookmark(sectionID: sectionID, codeVersion: firstCodeVersion)
        }
        try store.toggleBookmark(sectionID: 100, codeVersion: secondCodeVersion)

        for sectionID in Int64(1)...9 {
            try store.saveNote(
                sectionID: sectionID,
                codeVersion: firstCodeVersion,
                body: "Note \(sectionID)"
            )
        }
        try store.saveNote(sectionID: 100, codeVersion: secondCodeVersion, body: "Tenth note")

        XCTAssertEqual(try store.bookmarkCount(codeVersion: firstCodeVersion), 24)
        XCTAssertEqual(try store.bookmarkCount(codeVersion: secondCodeVersion), 1)
        XCTAssertEqual(try store.totalBookmarkCount(), 25)
        XCTAssertEqual(try store.noteCount(codeVersion: firstCodeVersion), 9)
        XCTAssertEqual(try store.noteCount(codeVersion: secondCodeVersion), 1)
        XCTAssertEqual(try store.totalNoteCount(), 10)

        let service = freeService()
        XCTAssertNotEqual(
            service.canCreateSavedSection(currentCount: try store.totalBookmarkCount()),
            .allowed
        )
        XCTAssertNotEqual(
            service.canCreateNote(currentCount: try store.totalNoteCount()),
            .allowed
        )
    }

    func testClearAllBookmarksRemovesEvidenceAcrossEveryCodeVersion() throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-clear-account-bookmarks-\(UUID().uuidString).sqlite")
        defer {
            for suffix in ["", "-shm", "-wal"] {
                try? FileManager.default.removeItem(atPath: databaseURL.path + suffix)
            }
        }

        let store = try UserDataStore(databaseURL: databaseURL)
        let projectVersion = UserContentSyncCodeVersion.localNYC2022
        let otherVersion = UserContentSyncCodeVersion.localNYCEnactedAdministrative
        let projectID = try store.createFolder(
            name: "Cross-code evidence",
            address: "",
            description: "",
            colorHex: CodeFolder.defaultColorHex,
            folderType: .project,
            codeVersion: projectVersion
        )
        try store.saveSection(101, toFolderIDs: [projectID], codeVersion: projectVersion)
        try store.saveSection(202, toFolderIDs: [projectID], codeVersion: otherVersion)

        XCTAssertEqual(try store.totalBookmarkCount(), 2)
        XCTAssertEqual(try store.evidenceReferences(inFolder: projectID).count, 2)

        try store.clearAllBookmarks()

        XCTAssertEqual(try store.totalBookmarkCount(), 0)
        XCTAssertTrue(try store.evidenceReferences(inFolder: projectID).isEmpty)
        XCTAssertEqual(try store.allFolders().map(\.id), [projectID])

        let clearMutations = try store.pendingSyncQueueItems(limit: 50).filter {
            $0.entityType == .codeVersionUserData
                && $0.operationType == .delete
                && $0.payload.values["scope"] == "bookmarks"
        }
        XCTAssertEqual(
            Set(clearMutations.map { UserContentSyncCodeVersion.server($0.payload.codeVersion) }),
            Set(UserContentSyncCodeVersion.allCanonicalNYC)
        )
    }

    func testLegacyFoldersMigrateAsProjects() throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-folder-type-migration-\(UUID().uuidString).sqlite")
        defer {
            for suffix in ["", "-shm", "-wal"] {
                try? FileManager.default.removeItem(atPath: databaseURL.path + suffix)
            }
        }

        do {
            let connection = try SQLiteConnection(path: databaseURL.path, readOnly: false)
            try connection.execute(
                """
                CREATE TABLE folders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    client_id TEXT NOT NULL DEFAULT '',
                    owner_id TEXT NOT NULL DEFAULT 'local',
                    visibility TEXT NOT NULL DEFAULT 'personal',
                    sync_state TEXT NOT NULL DEFAULT 'localOnly',
                    code_version TEXT NOT NULL,
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
                INSERT INTO folders (
                    client_id, code_version, name, description, color_hex, sort_order, created_at
                ) VALUES (
                    'legacy-project-1', 'nyc-2022', 'Legacy project', '', '#6674c8', 0, '2026-01-01T00:00:00Z'
                );
                """
            )
        }

        let store = try UserDataStore(databaseURL: databaseURL)
        let folder = try XCTUnwrap(store.folders(codeVersion: "nyc-2022").first)
        XCTAssertEqual(folder.folderType, CodeFolderType.project.rawValue)
        #if DEBUG
        XCTAssertTrue(try store.debugSchemaValidationMessages().isEmpty)
        #endif
    }

    func testProjectStructuredFactsRoundTripThroughSQLiteAndSync() throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-property-facts-\(UUID().uuidString).sqlite")
        let remoteDatabaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-property-facts-remote-\(UUID().uuidString).sqlite")
        defer {
            for url in [databaseURL, remoteDatabaseURL] {
                for suffix in ["", "-shm", "-wal"] {
                    try? FileManager.default.removeItem(atPath: url.path + suffix)
                }
            }
        }

        let facts = [
            ProjectStructuredFact(
                id: "nyc-planning:bbl",
                key: "bbl",
                label: "BBL",
                value: "2028500003",
                status: "sourced",
                source: "nyc-planning",
                sourceText: "NYC Planning MapPLUTO",
                updatedAt: nil
            ),
            ProjectStructuredFact(
                id: "nyc-planning:zoning-districts",
                key: "zoning-districts",
                label: "Zoning District(s)",
                value: "R8A",
                status: "sourced",
                source: "nyc-planning",
                sourceText: "NYC Planning mapped zoning layers",
                updatedAt: nil
            )
        ]
        let store = try UserDataStore(databaseURL: databaseURL)
        let codeVersion = UserContentSyncCodeVersion.localNYC2022
        _ = try store.createFolder(
            name: "1760 Jerome Avenue",
            address: "1760 JEROME AVENUE, Bronx, NY 10453",
            description: "",
            structuredFacts: facts,
            colorHex: CodeFolder.defaultColorHex,
            folderType: .project,
            codeVersion: codeVersion
        )

        XCTAssertEqual(try XCTUnwrap(store.folders(codeVersion: codeVersion).first).structuredFacts, facts)

        let account = SignedInAccount(
            appUserID: "apple:property-context-test",
            appleUserID: "property-context-test",
            displayName: "Property Context Test",
            signedInAt: Date()
        )
        let queueItem = try XCTUnwrap(
            store.pendingSyncQueueItems(limit: 20).first { $0.entityType == .folder }
        )
        let mutation = try ServerUserContentMutation(syncQueueItem: queueItem, account: account)
        guard case .project(let record) = mutation else {
            return XCTFail("Expected a project mutation for the folder queue item.")
        }
        XCTAssertEqual(record.structuredFacts, facts)

        let remoteStore = try UserDataStore(databaseURL: remoteDatabaseURL)
        try remoteStore.applyServerUserContentMutation(mutation)
        XCTAssertEqual(
            try XCTUnwrap(remoteStore.folders(codeVersion: codeVersion).first).structuredFacts,
            facts
        )
    }

    func testServerProjectRecordDefaultsLegacyFolderTypeAndEncodesReferenceType() throws {
        let legacyJSON = Data(
            """
            {
              "id": "project-legacy",
              "userID": "apple:folder-test",
              "codeVersion": "nyc-construction-codes-2022",
              "localFolderID": 1,
              "updatedAt": 0
            }
            """.utf8
        )
        let legacyRecord = try JSONDecoder().decode(ServerProjectRecord.self, from: legacyJSON)
        XCTAssertEqual(legacyRecord.folderType, .project)

        let referenceRecord = ServerProjectRecord(
            id: "reference-1",
            userID: "apple:folder-test",
            codeVersion: "nyc-construction-codes-2022",
            clientID: "reference-client-1",
            localFolderID: 1,
            name: "Egress",
            address: nil,
            description: "Reusable research",
            colorHex: nil,
            sortOrder: 0,
            folderType: .reference,
            archivedAt: nil,
            updatedAt: Date(timeIntervalSinceReferenceDate: 0),
            deletedAt: nil
        )
        let decodedReference = try JSONDecoder().decode(
            ServerProjectRecord.self,
            from: JSONEncoder().encode(referenceRecord)
        )
        XCTAssertEqual(decodedReference.folderType, .reference)
    }

    func testReferenceFolderTypeRoundTripsThroughSQLiteAndSyncMutations() throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-reference-folder-sync-\(UUID().uuidString).sqlite")
        let remoteDatabaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-reference-folder-pull-\(UUID().uuidString).sqlite")
        defer {
            for url in [databaseURL, remoteDatabaseURL] {
                for suffix in ["", "-shm", "-wal"] {
                    try? FileManager.default.removeItem(atPath: url.path + suffix)
                }
            }
        }

        let store = try UserDataStore(databaseURL: databaseURL)
        let codeVersion = UserContentSyncCodeVersion.localNYC2022
        let folderID = try store.createFolder(
            name: "Egress",
            address: "",
            description: "Reusable research",
            colorHex: CodeFolder.defaultColorHex,
            folderType: .reference,
            codeVersion: codeVersion
        )
        XCTAssertEqual(
            try XCTUnwrap(store.folders(codeVersion: codeVersion).first).folderType,
            CodeFolderType.reference.rawValue
        )

        try store.addSection(77, toFolder: folderID, codeVersion: codeVersion)
        let queued = try store.pendingSyncQueueItems(limit: 20)
        let account = SignedInAccount(
            appUserID: "apple:folder-test",
            appleUserID: "folder-test",
            displayName: "Folder Test",
            signedInAt: Date()
        )

        let folderQueueItem = try XCTUnwrap(queued.first { $0.entityType == .folder })
        let folderMutation = try ServerUserContentMutation(syncQueueItem: folderQueueItem, account: account)
        guard case .project(let projectRecord) = folderMutation else {
            return XCTFail("Expected a project mutation for the folder queue item.")
        }
        XCTAssertEqual(projectRecord.folderType, .reference)

        let membershipQueueItem = try XCTUnwrap(queued.first { $0.entityType == .folderSection })
        let membershipMutation = try ServerUserContentMutation(syncQueueItem: membershipQueueItem, account: account)
        guard case .projectSection(let membershipRecord) = membershipMutation else {
            return XCTFail("Expected a projectSection mutation for the membership queue item.")
        }
        XCTAssertEqual(membershipRecord.resolvedFolderType, .reference)

        let remoteStore = try UserDataStore(databaseURL: remoteDatabaseURL)
        try remoteStore.applyServerUserContentMutation(folderMutation)
        XCTAssertEqual(
            try XCTUnwrap(remoteStore.folders(codeVersion: codeVersion).first).folderType,
            CodeFolderType.reference.rawValue
        )

        try store.deleteFolder(id: folderID, codeVersion: codeVersion)
        let queuedDelete = try XCTUnwrap(
            store.pendingSyncQueueItems(limit: 50).first {
                $0.entityType == .folder && $0.operationType == .delete
            }
        )
        guard case .project(let deletedRecord) = try ServerUserContentMutation(
            syncQueueItem: queuedDelete,
            account: account
        ) else {
            return XCTFail("Expected a project delete mutation for the folder queue item.")
        }
        XCTAssertEqual(deletedRecord.folderType, .reference)
    }

    func testProjectsRemainAccountWideWhileEvidenceKeepsItsOwnCodeVersion() throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-account-wide-project-\(UUID().uuidString).sqlite")
        defer {
            for suffix in ["", "-shm", "-wal"] {
                try? FileManager.default.removeItem(atPath: databaseURL.path + suffix)
            }
        }

        let store = try UserDataStore(databaseURL: databaseURL)
        let projectVersion = UserContentSyncCodeVersion.localNYC2022
        let evidenceVersion = UserContentSyncCodeVersion.localNYCZoning
        let projectID = try store.createFolder(
            name: "Broadway renovation",
            address: "100 Broadway",
            description: "",
            colorHex: CodeFolder.defaultColorHex,
            folderType: .project,
            codeVersion: projectVersion
        )

        XCTAssertEqual(try store.totalFolderCount(), 1)
        XCTAssertEqual(try store.allFolders().map(\.id), [projectID])
        XCTAssertEqual(try store.allFolders().first?.codeVersion, projectVersion)
        XCTAssertTrue(try store.folders(codeVersion: evidenceVersion).isEmpty)

        // Section identifiers are only unique inside a code version. Preserve
        // both memberships when two code books reuse the same numeric ID.
        let reusedSectionID: Int64 = 9_900
        try store.saveSection(reusedSectionID, toFolderIDs: [projectID], codeVersion: projectVersion)
        try store.saveSection(reusedSectionID, toFolderIDs: [projectID], codeVersion: evidenceVersion)

        XCTAssertEqual(
            Set(try store.folderMembership(codeVersion: evidenceVersion)[reusedSectionID] ?? []),
            [projectID]
        )
        let accountWideEvidence = try store.evidenceReferences(inFolder: projectID)
        XCTAssertEqual(accountWideEvidence.count, 2)
        XCTAssertTrue(accountWideEvidence.contains {
            $0.sectionID == reusedSectionID && $0.codeVersion == projectVersion
        })
        XCTAssertTrue(accountWideEvidence.contains {
            $0.sectionID == reusedSectionID && $0.codeVersion == evidenceVersion
        })
        let queuedMembership = try XCTUnwrap(
            store.pendingSyncQueueItems(limit: 20).first {
                $0.entityType == .folderSection && $0.payload.codeVersion == evidenceVersion
            }
        )
        XCTAssertEqual(queuedMembership.payload.folderID, projectID)
        XCTAssertNotNil(queuedMembership.payload.values["folderClientID"])

        try store.deleteFolder(id: projectID, codeVersion: projectVersion)
        XCTAssertTrue(try store.allFolders().isEmpty)
        XCTAssertTrue(try store.folderMembership(codeVersion: evidenceVersion).isEmpty)
        let queuedCrossCodeDelete = try XCTUnwrap(
            store.pendingSyncQueueItems(limit: 50).first {
                $0.entityType == .folderSection &&
                    $0.operationType == .delete &&
                    $0.payload.codeVersion == evidenceVersion
            }
        )
        XCTAssertEqual(queuedCrossCodeDelete.payload.sectionID, reusedSectionID)
    }

    func testLegacyProjectEvidenceSchemaMigratesToCodeVersionAwareIdentity() throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-project-evidence-migration-\(UUID().uuidString).sqlite")
        defer {
            for suffix in ["", "-shm", "-wal"] {
                try? FileManager.default.removeItem(atPath: databaseURL.path + suffix)
            }
        }

        do {
            let legacyConnection = try SQLiteConnection(path: databaseURL.path, readOnly: false)
            try legacyConnection.execute(
                """
                CREATE TABLE folder_sections (
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
                """
            )
        }

        let store = try UserDataStore(databaseURL: databaseURL)
        let projectVersion = UserContentSyncCodeVersion.localNYC2022
        let evidenceVersion = UserContentSyncCodeVersion.localNYCZoning
        let projectID = try store.createFolder(
            name: "Migrated Project",
            address: "",
            description: "",
            colorHex: CodeFolder.defaultColorHex,
            folderType: .project,
            codeVersion: projectVersion
        )
        let reusedSectionID: Int64 = 4_321

        try store.saveSection(reusedSectionID, toFolderIDs: [projectID], codeVersion: projectVersion)
        try store.saveSection(reusedSectionID, toFolderIDs: [projectID], codeVersion: evidenceVersion)

        XCTAssertEqual(try store.evidenceReferences(inFolder: projectID).count, 2)
    }

    func testReaderCodeMenuGroupsConstructionCodesByEditionYear() {
        XCTAssertEqual(ReaderCodeMenuSectionTitle.construction2022, "2022 Construction Codes")
        XCTAssertEqual(ReaderCodeMenuSectionTitle.codes2025, "2025 Codes")
        XCTAssertEqual(ReaderCodeMenuSectionTitle.existingAndHistorical, "Existing and Historical Building Codes")
        XCTAssertEqual(ReaderCodeMenuSectionTitle.landUseAndZoning, "Land Use and Zoning")
    }

    func testSavingEvidenceRequiresDestinationAndAtomicallyCreatesOneBookmarkWithManyMemberships() throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-folder-save-\(UUID().uuidString).sqlite")
        defer {
            for suffix in ["", "-shm", "-wal"] {
                try? FileManager.default.removeItem(atPath: databaseURL.path + suffix)
            }
        }

        let store = try UserDataStore(databaseURL: databaseURL)
        let codeVersion = UserContentSyncCodeVersion.localNYC2022
        let firstFolderID = try store.createFolder(
            name: "Egress",
            address: "",
            description: "Reusable research",
            colorHex: CodeFolder.defaultColorHex,
            folderType: .reference,
            codeVersion: codeVersion
        )
        let secondFolderID = try store.createFolder(
            name: "Accessibility",
            address: "",
            description: "",
            colorHex: CodeFolder.defaultColorHex,
            folderType: .reference,
            codeVersion: codeVersion
        )

        XCTAssertThrowsError(try store.saveSection(705, toFolderIDs: [], codeVersion: codeVersion))
        XCTAssertFalse(try store.isBookmarked(sectionID: 705, codeVersion: codeVersion))

        try store.saveSection(
            705,
            toFolderIDs: [firstFolderID, secondFolderID],
            codeVersion: codeVersion
        )

        XCTAssertTrue(try store.isBookmarked(sectionID: 705, codeVersion: codeVersion))
        XCTAssertEqual(try store.bookmarkCount(codeVersion: codeVersion), 1)
        XCTAssertEqual(
            Set(try store.folderMembership(codeVersion: codeVersion)[705] ?? []),
            [firstFolderID, secondFolderID]
        )

        let queued = try store.pendingSyncQueueItems(limit: 50)
        XCTAssertEqual(
            queued.filter { $0.entityType == .bookmark && $0.operationType == .upsert }.count,
            1
        )
        XCTAssertEqual(
            queued.filter { $0.entityType == .folderSection && $0.operationType == .upsert }.count,
            2
        )
    }

    func testImmediateSaveRemainsUnassignedUntilProjectFollowUp() throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-immediate-save-follow-up-\(UUID().uuidString).sqlite")
        defer {
            for suffix in ["", "-shm", "-wal"] {
                try? FileManager.default.removeItem(atPath: databaseURL.path + suffix)
            }
        }

        let store = try UserDataStore(databaseURL: databaseURL)
        let codeVersion = UserContentSyncCodeVersion.localNYC2022
        let projectID = try store.createFolder(
            name: "Acceptance Project",
            address: "",
            description: "",
            colorHex: CodeFolder.defaultColorHex,
            folderType: .project,
            codeVersion: codeVersion
        )
        let sectionID: Int64 = 1_011

        try store.toggleBookmark(sectionID: sectionID, codeVersion: codeVersion)

        XCTAssertTrue(try store.isBookmarked(sectionID: sectionID, codeVersion: codeVersion))
        XCTAssertEqual(try store.bookmarkCount(codeVersion: codeVersion), 1)
        XCTAssertNil(try store.folderMembership(codeVersion: codeVersion)[sectionID])

        try store.saveSection(sectionID, toFolderIDs: [projectID], codeVersion: codeVersion)

        XCTAssertTrue(try store.isBookmarked(sectionID: sectionID, codeVersion: codeVersion))
        XCTAssertEqual(try store.bookmarkCount(codeVersion: codeVersion), 1)
        XCTAssertEqual(try store.folderMembership(codeVersion: codeVersion)[sectionID], [projectID])
    }

    func testReplacingFolderMembershipPreservesBookmarkAndRejectsFinalUnlink() throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-folder-replace-\(UUID().uuidString).sqlite")
        defer {
            for suffix in ["", "-shm", "-wal"] {
                try? FileManager.default.removeItem(atPath: databaseURL.path + suffix)
            }
        }

        let store = try UserDataStore(databaseURL: databaseURL)
        let codeVersion = UserContentSyncCodeVersion.localNYC2022
        let firstFolderID = try store.createFolder(
            name: "Project Alpha",
            address: "1 Centre Street",
            description: "",
            colorHex: CodeFolder.defaultColorHex,
            folderType: .project,
            codeVersion: codeVersion
        )
        let secondFolderID = try store.createFolder(
            name: "Reusable references",
            address: "",
            description: "",
            colorHex: CodeFolder.defaultColorHex,
            folderType: .reference,
            codeVersion: codeVersion
        )

        try store.saveSection(
            1026,
            toFolderIDs: [firstFolderID, secondFolderID],
            codeVersion: codeVersion
        )
        try store.saveSection(1026, toFolderIDs: [secondFolderID], codeVersion: codeVersion)

        XCTAssertTrue(try store.isBookmarked(sectionID: 1026, codeVersion: codeVersion))
        XCTAssertEqual(try store.bookmarkCount(codeVersion: codeVersion), 1)
        XCTAssertEqual(
            Set(try store.folderMembership(codeVersion: codeVersion)[1026] ?? []),
            [secondFolderID]
        )

        XCTAssertThrowsError(try store.saveSection(1026, toFolderIDs: [], codeVersion: codeVersion))
        XCTAssertTrue(try store.isBookmarked(sectionID: 1026, codeVersion: codeVersion))
        XCTAssertEqual(
            Set(try store.folderMembership(codeVersion: codeVersion)[1026] ?? []),
            [secondFolderID]
        )
    }

    func testUpgradeCallToActionUsesStoreKitLocalizedPrice() {
        XCTAssertEqual(
            permitextUpgradeCallToActionTitle(
                isStoreKitTestProActive: false,
                currentPlan: .free,
                proProductDisplayPrice: "$8.99",
                isStoreKitBusy: false
            ),
            "Upgrade to Pro - $8.99/month"
        )
        XCTAssertEqual(
            permitextUpgradeCallToActionTitle(
                isStoreKitTestProActive: false,
                currentPlan: .free,
                proProductDisplayPrice: nil,
                isStoreKitBusy: true
            ),
            "Starting Apple purchase..."
        )
    }

    func testStoreKitPurchaseUsesPurchaseActionWithSafeTransactionPreflight() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let settingsSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/SettingsView.swift"),
            encoding: .utf8
        )
        let appSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/PermitextApp.swift"),
            encoding: .utf8
        )
        let storeKitSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Models/CodeModels.swift"),
            encoding: .utf8
        )
        let viewModelSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/ViewModels/CodeLibraryViewModel.swift"),
            encoding: .utf8
        )

        XCTAssertTrue(settingsSource.contains("@Environment(\\.purchase) private var purchase"))
        XCTAssertTrue(settingsSource.contains("acceptedPolicyVersions: policiesAccepted"))
        XCTAssertTrue(settingsSource.contains("Toggle(\"I have reviewed and agree to the current policies.\""))
        XCTAssertTrue(appSource.contains("ProSubscriptionStoreView()"))
        XCTAssertTrue(viewModelSource.contains("try await storeKitSubscriptionService.prepareForPurchase()"))
        XCTAssertTrue(viewModelSource.contains("accountBackendClient.recordPolicyAcceptance("))
        XCTAssertTrue(viewModelSource.contains("platform: \"ios\""))
        XCTAssertTrue(viewModelSource.contains("let appAccountToken = storeKitAppAccountToken(for: purchasingAccount.appUserID)"))
        XCTAssertTrue(viewModelSource.contains("let purchaseResult = try await purchaseAction("))
        XCTAssertTrue(viewModelSource.contains("options: [.appAccountToken(appAccountToken)]"))
        XCTAssertTrue(viewModelSource.contains("for attempt in 1...2"))

        let backendVerificationStart = try XCTUnwrap(
            viewModelSource.range(of: "case .requiresBackendVerification:")
        )
        let backendVerificationEnd = try XCTUnwrap(
            viewModelSource.range(
                of: "private func storeKitAppAccountToken",
                range: backendVerificationStart.upperBound..<viewModelSource.endIndex
            )
        )
        let backendVerificationSource = String(
            viewModelSource[backendVerificationStart.lowerBound..<backendVerificationEnd.lowerBound]
        )
        let clearOrApplyBackendResult = try XCTUnwrap(
            backendVerificationSource.range(of: "applyBackendEntitlement(entitlement)")
        )
        let requireActiveBackendPro = try XCTUnwrap(
            backendVerificationSource.range(of: "guard let entitlement, entitlement.grantsPro()")
        )
        XCTAssertLessThan(clearOrApplyBackendResult.lowerBound, requireActiveBackendPro.lowerBound)

        let purchaseLoopStart = try XCTUnwrap(viewModelSource.range(of: "for attempt in 1...2"))
        let policyAcceptanceStart = try XCTUnwrap(
            viewModelSource.range(
                of: "accountBackendClient.recordPolicyAcceptance(",
                range: viewModelSource.startIndex..<purchaseLoopStart.lowerBound
            )
        )
        XCTAssertLessThan(policyAcceptanceStart.lowerBound, purchaseLoopStart.lowerBound)
        let purchaseInvocationStart = try XCTUnwrap(
            viewModelSource.range(
                of: "let purchaseResult = try await purchaseAction(",
                range: purchaseLoopStart.upperBound..<viewModelSource.endIndex
            )
        )
        let immediatePurchaseGuards = String(
            viewModelSource[purchaseLoopStart.lowerBound..<purchaseInvocationStart.lowerBound]
        )
        XCTAssertTrue(immediatePurchaseGuards.contains("signedInAccount?.appUserID == purchasingAccount.appUserID"))
        XCTAssertTrue(immediatePurchaseGuards.contains("guard isProSubscriptionStorePresented else { return }"))
        XCTAssertTrue(immediatePurchaseGuards.contains("if currentPlan == .pro"))
        XCTAssertFalse(settingsSource.contains("SubscriptionStoreView(groupID:"))
        XCTAssertFalse(appSource.contains("@Environment(\\.purchase)"))
        XCTAssertFalse(storeKitSource.contains("product.purchase()"))

        let preflightStart = try XCTUnwrap(storeKitSource.range(of: "func prepareForPurchase()"))
        let purchaseStart = try XCTUnwrap(
            storeKitSource.range(
                of: "func snapshot(after result: Product.PurchaseResult)",
                range: preflightStart.upperBound..<storeKitSource.endIndex
            )
        )
        let preflightSource = String(storeKitSource[preflightStart.lowerBound..<purchaseStart.lowerBound])
        XCTAssertTrue(preflightSource.contains("drainInactiveUnfinishedTransactions()"))

        let updatesStartForSafety = try XCTUnwrap(storeKitSource.range(of: "func transactionUpdates()"))
        let activeFinishStart = try XCTUnwrap(
            storeKitSource.range(
                of: "func finishActiveProTransactions()",
                range: updatesStartForSafety.upperBound..<storeKitSource.endIndex
            )
        )
        let updatesSource = String(
            storeKitSource[updatesStartForSafety.lowerBound..<activeFinishStart.lowerBound]
        )
        XCTAssertTrue(updatesSource.contains("case .unverified:"))
        XCTAssertTrue(updatesSource.contains("inactiveKnownTransaction(from: result)"))
        XCTAssertFalse(updatesSource.contains("case .unverified(let transaction"))

        let cleanupStart = try XCTUnwrap(storeKitSource.range(of: "private nonisolated func inactiveKnownTransaction"))
        let productLoaderStart = try XCTUnwrap(
            storeKitSource.range(
                of: "private func proProducts()",
                range: cleanupStart.upperBound..<storeKitSource.endIndex
            )
        )
        let cleanupSource = String(storeKitSource[cleanupStart.lowerBound..<productLoaderStart.lowerBound])
        XCTAssertTrue(cleanupSource.contains("case .unverified(let unverifiedTransaction, _)"))
        XCTAssertTrue(cleanupSource.contains("shouldFinishInactiveTransaction"))
        XCTAssertTrue(cleanupSource.contains("finishBarrier.finishOnce(transactionID: transaction.id)"))
        XCTAssertTrue(cleanupSource.contains("for pass in 1...StoreKitTransactionDrainPolicy.maximumPasses"))
        XCTAssertTrue(cleanupSource.contains("let inactiveTransactions = await inactiveUnfinishedTransactions()"))
        XCTAssertTrue(cleanupSource.contains("guard !inactiveTransactions.isEmpty else { return true }"))
        XCTAssertTrue(cleanupSource.contains("try await Task.sleep"))
        XCTAssertTrue(cleanupSource.contains("afterCompletedPass: pass"))
        XCTAssertTrue(cleanupSource.contains("return await inactiveUnfinishedTransactions().isEmpty"))
        XCTAssertTrue(cleanupSource.contains("private func inactiveUnfinishedTransactions()"))
        XCTAssertTrue(cleanupSource.contains("for await verification in Transaction.unfinished"))
        XCTAssertFalse(storeKitSource.contains("completedTransactionIDs"))
        XCTAssertTrue(preflightSource.contains("inactiveTransactionQueueDidNotSettle"))

        XCTAssertTrue(viewModelSource.contains("let retryPreflightSnapshot = try await storeKitSubscriptionService.prepareForPurchase()"))
        XCTAssertTrue(settingsSource.contains("subscribeButtonBackgroundColor"))
        XCTAssertTrue(settingsSource.contains("colorScheme == .dark ? Color.white.opacity(0.96) : Color.appChrome"))

        let restoreStart = try XCTUnwrap(storeKitSource.range(of: "func restorePurchases()"))
        let updatesStart = try XCTUnwrap(
            storeKitSource.range(
                of: "func transactionUpdates()",
                range: restoreStart.upperBound..<storeKitSource.endIndex
            )
        )
        let restoreSource = String(storeKitSource[restoreStart.lowerBound..<updatesStart.lowerBound])
        XCTAssertTrue(restoreSource.contains("try await AppStore.sync()"))
        XCTAssertFalse(restoreSource.contains("try? await AppStore.sync()"))

        let storeKitActorStart = try XCTUnwrap(storeKitSource.range(of: "actor StoreKitSubscriptionService"))
        let storeKitActorEnd = try XCTUnwrap(
            storeKitSource.range(
                of: "enum BookmarkSortMode",
                range: storeKitActorStart.upperBound..<storeKitSource.endIndex
            )
        )
        let storeKitActorSource = String(
            storeKitSource[storeKitActorStart.lowerBound..<storeKitActorEnd.lowerBound]
        )
        XCTAssertFalse(storeKitActorSource.contains("LocalEntitlementService.setVerifiedPlan"))
    }

    func testAppleRefundRequestUsesVerifiedActiveTransactionAndNativePresentation() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let settingsSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/SettingsView.swift"),
            encoding: .utf8
        )
        let storeKitSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Models/CodeModels.swift"),
            encoding: .utf8
        )
        let viewModelSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/ViewModels/CodeLibraryViewModel.swift"),
            encoding: .utf8
        )

        XCTAssertTrue(settingsSource.contains("Text(\"Request Refund from Apple\")"))
        XCTAssertTrue(settingsSource.contains("StoreKit.Transaction.beginRefundRequest("))
        XCTAssertTrue(settingsSource.contains("$0.activationState == .foregroundActive"))
        XCTAssertTrue(settingsSource.contains(".accessibilityIdentifier(\"request-apple-refund\")"))
        XCTAssertTrue(settingsSource.contains("Capsule(style: .continuous)"))
        XCTAssertTrue(settingsSource.contains("library.prepareAppleRefundRequest()"))
        XCTAssertTrue(settingsSource.contains("Opening the form does not cancel the subscription or issue a refund"))
        XCTAssertTrue(viewModelSource.contains("currentPlan == .pro && accountAuthorizedStoreKitPlan == .pro"))
        XCTAssertTrue(viewModelSource.contains("storeKitSubscriptionService.activeProTransactionIDForRefund()"))
        XCTAssertTrue(viewModelSource.contains("Apple received the refund request"))
        XCTAssertTrue(viewModelSource.contains("handleAppleRefundRequestPresentationFailure"))

        let refundLookupStart = try XCTUnwrap(
            storeKitSource.range(of: "func activeProTransactionIDForRefund()")
        )
        let updatesStart = try XCTUnwrap(
            storeKitSource.range(
                of: "func transactionUpdates()",
                range: refundLookupStart.upperBound..<storeKitSource.endIndex
            )
        )
        let refundLookupSource = String(
            storeKitSource[refundLookupStart.lowerBound..<updatesStart.lowerBound]
        )
        XCTAssertTrue(refundLookupSource.contains("Transaction.currentEntitlements"))
        XCTAssertTrue(refundLookupSource.contains("case .verified(let transaction)"))
        XCTAssertTrue(refundLookupSource.contains("isActiveProTransaction(transaction)"))
        XCTAssertFalse(refundLookupSource.contains("case .unverified"))
    }

    func testClerkAuthenticationRequiresFreshSessionAndSignsOutLocallyFirst() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let appSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/PermitextApp.swift"),
            encoding: .utf8
        )
        let settingsSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/SettingsView.swift"),
            encoding: .utf8
        )
        let bookmarksSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/BookmarksView.swift"),
            encoding: .utf8
        )
        let viewModelSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/ViewModels/CodeLibraryViewModel.swift"),
            encoding: .utf8
        )

        XCTAssertTrue(appSource.contains("PermitextClerkAuthenticationView()"))
        XCTAssertTrue(appSource.contains(".onChange(of: clerk.session?.id)"))
        XCTAssertTrue(appSource.contains("Preparing secure sign-in..."))
        XCTAssertTrue(appSource.contains("Clerk.clearAllKeychainItemsAndWait()"))
        XCTAssertFalse(appSource.contains("try? await clerk.auth.signOut()"))
        XCTAssertTrue(settingsSource.contains("await library.signOut(clerk: clerk)"))
        XCTAssertFalse(bookmarksSource.contains("@Environment(\\.permitextClerk) private var clerk"))
        XCTAssertFalse(bookmarksSource.contains("library.signOut(clerk:"))
        XCTAssertFalse(viewModelSource.contains("while isAccountBusy"))
        XCTAssertFalse(settingsSource.contains("try? await clerk.auth.signOut()"))

        let signOutStart = try XCTUnwrap(viewModelSource.range(of: "func signOut(clerk: Clerk?) async"))
        let convenienceSignOutStart = try XCTUnwrap(
            viewModelSource.range(
                of: "func signOut()",
                range: signOutStart.upperBound..<viewModelSource.endIndex
            )
        )
        let signOutSource = String(viewModelSource[signOutStart.lowerBound..<convenienceSignOutStart.lowerBound])
        let localSignOut = try XCTUnwrap(signOutSource.range(of: "completeLocalSignOut()"))
        let providerSignOut = try XCTUnwrap(signOutSource.range(of: "clerk.auth.signOut()"))
        XCTAssertLessThan(localSignOut.lowerBound, providerSignOut.lowerBound)
        XCTAssertFalse(signOutSource.contains("try? await clerk.auth.signOut()"))

        let reconcileStart = try XCTUnwrap(viewModelSource.range(of: "func reconcileClerkSessionIfNeeded"))
        let completeSignInStart = try XCTUnwrap(
            viewModelSource.range(
                of: "private func completeClerkBackendSignIn",
                range: reconcileStart.upperBound..<viewModelSource.endIndex
            )
        )
        let reconcileSource = String(viewModelSource[reconcileStart.lowerBound..<completeSignInStart.lowerBound])
        XCTAssertTrue(reconcileSource.contains("Clerk.clearAllKeychainItemsAndWait()"))
        XCTAssertFalse(reconcileSource.contains("completeClerkBackendSignIn(session: session, linkFrom: nil)"))
    }

    func testClerkCallbackSupportsColdPasswordlessEmailAndFreshBackendExchange() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let infoURL = projectRoot.appendingPathComponent("permitext/Info.plist")
        let infoData = try Data(contentsOf: infoURL)
        let info = try XCTUnwrap(
            PropertyListSerialization.propertyList(from: infoData, format: nil) as? [String: Any]
        )
        let urlTypes = try XCTUnwrap(info["CFBundleURLTypes"] as? [[String: Any]])
        let registeredSchemes = urlTypes.flatMap { entry in
            entry["CFBundleURLSchemes"] as? [String] ?? []
        }
        XCTAssertTrue(registeredSchemes.contains("com.randycodex.permitext"))

        XCTAssertTrue(
            ClerkCallbackRoutingPolicy.matches(
                URL(string: "com.randycodex.permitext://callback?flow_id=flow&approval_token=token")!,
                configuredRedirectURL: "com.randycodex.permitext://callback"
            )
        )
        XCTAssertFalse(
            ClerkCallbackRoutingPolicy.matches(
                URL(string: "permitext://section/123")!,
                configuredRedirectURL: "com.randycodex.permitext://callback"
            )
        )

        let appSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/PermitextApp.swift"),
            encoding: .utf8
        )
        let viewModelSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/ViewModels/CodeLibraryViewModel.swift"),
            encoding: .utf8
        )

        let openURLStart = try XCTUnwrap(appSource.range(of: ".onOpenURL { url in"))
        let openURLEnd = try XCTUnwrap(
            appSource.range(of: ".onAppear {", range: openURLStart.upperBound..<appSource.endIndex)
        )
        let openURLSource = String(appSource[openURLStart.lowerBound..<openURLEnd.lowerBound])
        let clerkRoute = try XCTUnwrap(openURLSource.range(of: "await library.handleClerkOpenURL(url, clerk: clerk)"))
        let appRoute = try XCTUnwrap(openURLSource.range(of: "library.handleOpenURL(url)"))
        XCTAssertLessThan(clerkRoute.lowerBound, appRoute.lowerBound)
        XCTAssertTrue(appSource.contains("if library.isResumingClerkAuthenticationCallback"))
        XCTAssertTrue(appSource.contains("AuthView()"))

        let callbackStart = try XCTUnwrap(viewModelSource.range(of: "func handleClerkOpenURL"))
        let finishedStart = try XCTUnwrap(
            viewModelSource.range(
                of: "func handleClerkAuthenticationFinished",
                range: callbackStart.upperBound..<viewModelSource.endIndex
            )
        )
        let callbackSource = String(viewModelSource[callbackStart.lowerBound..<finishedStart.lowerBound])
        let attemptRegistration = try XCTUnwrap(callbackSource.range(of: "clerkAuthenticationAttemptID = UUID()"))
        let clerkHandler = try XCTUnwrap(callbackSource.range(of: "try await clerk.handle(url)"))
        XCTAssertLessThan(attemptRegistration.lowerBound, clerkHandler.lowerBound)
        XCTAssertTrue(callbackSource.contains("if clerk.session == nil"))
        XCTAssertTrue(callbackSource.contains("isResumingClerkAuthenticationCallback = true"))
        XCTAssertTrue(callbackSource.contains("else if createdCallbackAttempt"))
        XCTAssertTrue(callbackSource.contains("await handleClerkAuthenticationFinished(clerk: clerk)"))
        XCTAssertFalse(callbackSource.contains("else if !isClerkAuthenticationPresented"))

        let exchangeStart = try XCTUnwrap(viewModelSource.range(of: "private func completeClerkBackendSignIn"))
        let backendCompletionStart = try XCTUnwrap(
            viewModelSource.range(
                of: "private func completeBackendSignIn",
                range: exchangeStart.upperBound..<viewModelSource.endIndex
            )
        )
        let exchangeSource = String(viewModelSource[exchangeStart.lowerBound..<backendCompletionStart.lowerBound])
        XCTAssertTrue(exchangeSource.contains("session.getToken()"))
        XCTAssertTrue(exchangeSource.contains("provider: .clerk"))
        XCTAssertTrue(exchangeSource.contains("sessionToken: sessionToken"))
        XCTAssertTrue(exchangeSource.contains("expectedAccountGeneration == accountMutationGeneration"))
    }

    func testSavedAccountButtonOpensSettingsDirectlyAndSyncLivesInAccountCard() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let bookmarksSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/BookmarksView.swift"),
            encoding: .utf8
        )
        let settingsSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/SettingsView.swift"),
            encoding: .utf8
        )

        let accountButtonStart = try XCTUnwrap(bookmarksSource.range(of: "private var accountButton: some View"))
        let nextPropertyStart = try XCTUnwrap(
            bookmarksSource.range(
                of: "private func bookmarkAccentColor",
                range: accountButtonStart.upperBound..<bookmarksSource.endIndex
            )
        )
        let accountButtonSource = String(bookmarksSource[accountButtonStart.lowerBound..<nextPropertyStart.lowerBound])

        XCTAssertTrue(accountButtonSource.contains("Button {\n            showingSettings = true"))
        XCTAssertTrue(accountButtonSource.contains(".accessibilityLabel(\"Open Account\")"))
        XCTAssertFalse(accountButtonSource.contains("Menu {"))
        XCTAssertFalse(bookmarksSource.contains("Label(library.syncStatusTitle, systemImage: syncStatusSystemImage)"))
        XCTAssertFalse(bookmarksSource.contains("Label(\"Sync: \\(library.syncStatusTitle)\""))
        XCTAssertFalse(bookmarksSource.contains("Label(\"Settings\", systemImage: \"gearshape\")"))
        XCTAssertTrue(settingsSource.contains("CodeScreenTitle(title: \"Account\", collapseProgress: collapseProgress)\n                        .offset(y: 8)"))
        XCTAssertTrue(settingsSource.contains("CodeTopContentFade(title: \"Account\", progress: collapseProgress)"))
        XCTAssertTrue(settingsSource.contains("Label(library.syncStatusTitle, systemImage: syncStatusSystemImage)"))
        XCTAssertTrue(settingsSource.contains(".accessibilityLabel(\"Sync status: \\(library.syncStatusTitle)\")"))
    }

    func testSettingsSignInButtonMatchesUpgradeButtonStyle() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let settingsSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/SettingsView.swift"),
            encoding: .utf8
        )
        let signInLabelStart = try XCTUnwrap(
            settingsSource.range(of: "Label(\"Sign in or create an account\"")
        )
        let signInButtonEnd = try XCTUnwrap(
            settingsSource.range(
                of: ".disabled(library.isAccountBusy)",
                range: signInLabelStart.upperBound..<settingsSource.endIndex
            )
        )
        let signInButtonSource = String(
            settingsSource[signInLabelStart.lowerBound..<signInButtonEnd.upperBound]
        )

        XCTAssertTrue(signInButtonSource.contains(".foregroundStyle(upgradeButtonForegroundColor)"))
        XCTAssertTrue(signInButtonSource.contains(".background(upgradeButtonBackgroundColor, in: Capsule(style: .continuous))"))
        XCTAssertFalse(signInButtonSource.contains(".foregroundStyle(.white)"))
    }

    func testAccountDeletionRequiresExplicitDisclosureAndReportsCleanupStages() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let settingsSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/SettingsView.swift"),
            encoding: .utf8
        )

        XCTAssertTrue(settingsSource.contains("This is permanent and cannot be undone."))
        XCTAssertTrue(settingsSource.contains("Permitext will delete"))
        XCTAssertTrue(settingsSource.contains("Permitext will not delete"))
        XCTAssertTrue(settingsSource.contains("Type DELETE to confirm"))
        XCTAssertTrue(settingsSource.contains("Manage Apple Subscription"))
        XCTAssertTrue(settingsSource.contains("I understand that deleting Permitext does not cancel App Store billing."))
        XCTAssertTrue(settingsSource.contains("Canceling Stripe billing"))
        XCTAssertTrue(settingsSource.contains("Deleting Permitext data"))
        XCTAssertTrue(settingsSource.contains("Clearing this device"))
        XCTAssertTrue(settingsSource.contains("Removing Permitext sign-in identity"))
        XCTAssertTrue(settingsSource.contains("Retry cleanup"))
        XCTAssertTrue(settingsSource.contains("Contact Support"))
        XCTAssertTrue(settingsSource.contains(".presentationCompactAdaptation(.sheet)"))
        XCTAssertTrue(settingsSource.contains(".presentationDetents([.large])"))
        XCTAssertFalse(settingsSource.contains("try? await clerk.user?.delete()"))
    }

    func testSettingsDoesNotExposeWebWorkspaceCard() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let settingsSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/SettingsView.swift"),
            encoding: .utf8
        )

        XCTAssertFalse(settingsSource.contains("webWorkspaceCard"))
        XCTAssertFalse(settingsSource.contains("webWorkspaceURL"))
        XCTAssertFalse(settingsSource.contains("Web Workspace"))
        XCTAssertFalse(settingsSource.contains("Open Permitext Web"))
    }

    func testSettingsReaderControlsOmitTypefaceAndMetricPills() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let settingsSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/SettingsView.swift"),
            encoding: .utf8
        )

        XCTAssertFalse(settingsSource.contains("readerTypefaceRow"))
        XCTAssertFalse(settingsSource.contains("Reader Typeface"))
        XCTAssertFalse(settingsSource.contains("CodeStatPill(value: \"\\(Int(library.readerTheme.fontSize)) pt\""))
        XCTAssertFalse(settingsSource.contains("CodeStatPill(value: \"\\(Int(library.readerTheme.lineSpacing))\""))
    }

    func testSettingsDataAndStorageMatchesWebStructureAndTerminology() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let settingsSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/SettingsView.swift"),
            encoding: .utf8
        )

        XCTAssertTrue(settingsSource.contains("dataAndStorageCard"))
        XCTAssertTrue(settingsSource.contains("CodeEyebrow(text: \"Data & Storage\""))
        XCTAssertTrue(settingsSource.contains("Text(\"Projects and saved collections\")"))
        XCTAssertTrue(settingsSource.contains("Text(\"No Projects or saved collections yet.\")"))
        XCTAssertTrue(settingsSource.contains("title: \"Clear All Projects and Saved Collections\""))
        XCTAssertTrue(settingsSource.contains("case .clearProjects:"))
        XCTAssertTrue(settingsSource.contains("library.deleteFolders(ids: Set(library.folders.map(\\.id)))"))
        XCTAssertFalse(settingsSource.contains("projectManagementCard"))
        XCTAssertFalse(settingsSource.contains("savedDataTools"))
        XCTAssertFalse(settingsSource.contains("Projects and References"))
    }

    func testAccountUserDataProfilesNeverExposeSavedPassagesAcrossAccounts() throws {
        let suiteName = "permitext-tests.account-profiles.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
        defaults.removePersistentDomain(forName: suiteName)
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let directoryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-account-profiles-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directoryURL) }

        let profiles = try AccountUserDataProfileStore(
            baseDirectory: directoryURL,
            defaults: defaults
        )
        let codeVersion = UserContentSyncCodeVersion.localNYC2022

        let initialGuestURL = try profiles.databaseURL(accountID: nil)
        let initialGuestStore = try UserDataStore(databaseURL: initialGuestURL)
        try initialGuestStore.toggleBookmark(sectionID: 101, codeVersion: codeVersion)

        let accountAURL = try profiles.databaseURL(
            accountID: "account-a",
            claimCurrentGuestForNewAccount: true
        )
        XCTAssertEqual(accountAURL, initialGuestURL)
        XCTAssertEqual(
            try UserDataStore(databaseURL: accountAURL).bookmarkedSectionIDs(codeVersion: codeVersion),
            [101]
        )

        let signedOutURL = try profiles.databaseURL(accountID: nil)
        XCTAssertNotEqual(signedOutURL, accountAURL)
        XCTAssertTrue(
            try UserDataStore(databaseURL: signedOutURL).bookmarkedSectionIDs(codeVersion: codeVersion).isEmpty
        )

        let accountBURL = try profiles.databaseURL(
            accountID: "account-b",
            claimCurrentGuestForNewAccount: true
        )
        XCTAssertEqual(accountBURL, signedOutURL)
        let accountBStore = try UserDataStore(databaseURL: accountBURL)
        try accountBStore.toggleBookmark(sectionID: 202, codeVersion: codeVersion)

        XCTAssertEqual(
            try UserDataStore(
                databaseURL: profiles.databaseURL(accountID: "account-a")
            ).bookmarkedSectionIDs(codeVersion: codeVersion),
            [101]
        )
        XCTAssertEqual(
            try UserDataStore(
                databaseURL: profiles.databaseURL(accountID: "account-b")
            ).bookmarkedSectionIDs(codeVersion: codeVersion),
            [202]
        )
    }

    func testProfessionalWorkspaceUpgradeCopyOnlyNamesProFeatures() {
        let message = permitextProfessionalWorkspaceRequirementMessage()

        XCTAssertEqual(
            message,
            "Upgrade to Pro to unlock unlimited saved work and notes, Projects, professional exports, and offline access."
        )
        XCTAssertFalse(message.localizedCaseInsensitiveContains("continuity"))
        XCTAssertFalse(message.localizedCaseInsensitiveContains("cross-device sync"))
    }

    func testNYC2022SyncAliasesUseCanonicalServerIdentity() {
        XCTAssertEqual(
            UserContentSyncCodeVersion.server("2022 Construction Codes"),
            UserContentSyncCodeVersion.canonicalNYC2022
        )
        XCTAssertEqual(
            UserContentSyncCodeVersion.server("nyc-2022"),
            UserContentSyncCodeVersion.canonicalNYC2022
        )
        XCTAssertEqual(
            UserContentSyncCodeVersion.local(UserContentSyncCodeVersion.canonicalNYC2022),
            UserContentSyncCodeVersion.localNYC2022
        )
    }

    func testPlumbingFixtureSectionUsesPublishedOfficialTable() throws {
        let version = try XCTUnwrap(
            BundleDatabaseLocator(defaults: isolatedEntitlementDefaults())
                .availableCodeVersions().first {
                UserContentSyncCodeVersion.server($0.codeVersion) ==
                    UserContentSyncCodeVersion.canonicalNYC2022
            }
        )
        let store = try AuthoredCodeStore(
            jsonURL: version.fileURL,
            codeID: version.authoredCodeID,
            jurisdictionID: version.jurisdictionID
        )
        let section = try XCTUnwrap(store.sectionDetail(sectionID: 11_909))
        let tableBlock = try XCTUnwrap(
            section.contentBlocks.first { block in
                block.kind == .table &&
                    block.html?.range(
                        of: #"<ScrollTable\b"#,
                        options: [.regularExpression, .caseInsensitive]
                    ) != nil
            }
        )

        XCTAssertEqual(section.sectionNumber, "403.1")
        XCTAssertTrue(tableBlock.html?.localizedCaseInsensitiveContains("<table") == true)
    }

    func test2014Chapter10TablesLoadOfflineAndUseNativeRenderingPaths() throws {
        let version = try XCTUnwrap(
            BundleDatabaseLocator(defaults: isolatedEntitlementDefaults())
                .availableCodeVersions().first {
                UserContentSyncCodeVersion.server($0.codeVersion) ==
                    UserContentSyncCodeVersion.canonicalNYC2014
            }
        )
        let store = try AuthoredCodeStore(
            jsonURL: version.fileURL,
            codeID: version.authoredCodeID,
            jurisdictionID: version.jurisdictionID
        )

        let occupantLoad = try XCTUnwrap(store.sectionDetail(sectionID: 41_009_379))
        let occupantLoadTable = try XCTUnwrap(
            occupantLoad.tableBlocks.first {
                $0.id == "nyc-2014-table-bc-10-1004-1-1"
            }
        )
        XCTAssertEqual(occupantLoadTable.rowCount, 57)
        XCTAssertEqual(occupantLoadTable.columnCount, 2)
        XCTAssertEqual(occupantLoadTable.cells.count, 114)
        XCTAssertTrue(isNativeSimpleTable(occupantLoadTable))
        XCTAssertFalse(
            occupantLoad.contentBlocks.contains {
                $0.html?.localizedCaseInsensitiveContains("codes.iccsafe.org") == true
            },
            "The bundled Reader must not load ICC at runtime."
        )

        let corridorRating = try XCTUnwrap(store.sectionDetail(sectionID: 41_009_583))
        let corridorRatingTable = try XCTUnwrap(
            corridorRating.tableBlocks.first {
                $0.id == "nyc-2014-table-bc-10-1018-1-1"
            }
        )
        XCTAssertEqual(corridorRatingTable.columnCount, 4)
        XCTAssertTrue(corridorRatingTable.cells.contains { $0.rowSpan == 2 })
        XCTAssertTrue(corridorRatingTable.cells.contains { $0.columnSpan == 2 })
        XCTAssertFalse(isNativeSimpleTable(corridorRatingTable))

        let dualAccess = try XCTUnwrap(store.sectionDetail(sectionID: 41_009_713))
        let dualAccessTable = try XCTUnwrap(
            dualAccess.tableBlocks.first {
                $0.id == "nyc-2014-table-bc-10-1028-10-1"
            }
        )
        let tenThousandRow = try XCTUnwrap(
            dualAccessTable.cells.first { $0.plainText == "10,000" }?.row
        )
        XCTAssertTrue(
            dualAccessTable.cells.contains {
                $0.row == tenThousandRow && $0.plainText == "17"
            },
            "The iOS bundle must retain the official NYC PDF value rather than ICC's erroneous 7."
        )
        XCTAssertFalse(isNativeSimpleTable(dualAccessTable))
    }

    func testConstructionRelatedLocalLawsLoadPreparedChapterSections() throws {
        let version = try XCTUnwrap(
            BundleDatabaseLocator().availableCodeVersions().first {
                $0.fileURL.path.contains("2026-enacted-administrative-code")
            }
        )
        let store = try AuthoredCodeStore(
            jsonURL: version.fileURL,
            codeID: version.authoredCodeID,
            jurisdictionID: version.jurisdictionID
        )
        let localLaws = try XCTUnwrap(store.codeSections().first {
            $0.name.localizedCaseInsensitiveContains("construction-related local laws")
        })
        let chapters = store.chapters(codeSectionID: localLaws.id)
        let firstChapter = try XCTUnwrap(chapters.first)

        XCTAssertEqual(chapters.count, 39)
        XCTAssertFalse(store.sections(chapterID: firstChapter.id).isEmpty)
    }

    func testSyncDeclaresVersionedCrossPlatformCapabilities() throws {
        let request = BackendUserContentPullRequest(
            auth: BackendAuthContext(accountUserID: "test-user", bearerToken: nil),
            since: nil,
            contentMapVersion: 7,
            excludedMutationKinds: UserContentSyncClientPolicy.excludedMutationKinds
        )
        let data = try JSONEncoder().encode(request)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let capabilities = try XCTUnwrap(object["clientCapabilities"] as? [String])
        let excluded = try XCTUnwrap(object["excludedMutationKinds"] as? [String])

        XCTAssertEqual(object["syncSchemaVersion"] as? Int, 2)
        XCTAssertEqual(object["contentMapVersion"] as? Int, 7)
        XCTAssertEqual(excluded, ["workboard"])
        XCTAssertEqual(Set(capabilities), Set(PermitextCapabilityID.allCases.map(\.rawValue)))
        XCTAssertTrue(capabilities.contains("notebook"))
        XCTAssertTrue(capabilities.contains("professional-exports"))
        XCTAssertTrue(capabilities.contains("organization-administration"))
    }

    func testSyncPullPersistsAndReusesServerContentMapVersion() async throws {
        let defaults = isolatedEntitlementDefaults()
        let checkpointStore = UserContentSyncCheckpointStore(defaults: defaults)
        let account = SignedInAccount(
            appUserID: "apple:content-map-version-test",
            appleUserID: "content-map-version-test",
            displayName: "Content Map Version Test",
            signedInAt: Date()
        )
        checkpointStore.save(
            UserContentSyncCheckpoint(
                accountUserID: account.appUserID,
                backendName: "recording-sync",
                latestEventID: 41,
                contentMapVersion: 6
            )
        )
        let recorder = SyncPullRecorder()
        let engine = UserContentSyncEngine(
            repository: nil,
            backend: RecordingUserContentSyncBackend(
                recorder: recorder,
                returnedContentMapVersion: 7
            ),
            checkpointStore: checkpointStore
        )

        _ = try await engine.pullRemoteChanges(account: account, applySafeChanges: true)
        XCTAssertEqual(engine.checkpoint(account: account)?.contentMapVersion, 7)
        XCTAssertEqual(engine.checkpoint(account: account)?.entitlementFingerprint, "fingerprint-v1")

        _ = try await engine.pullRemoteChanges(account: account, applySafeChanges: true)
        let recordedVersions = await recorder.recordedContentMapVersions()
        XCTAssertEqual(recordedVersions.count, 2)
        XCTAssertEqual(recordedVersions[0], 6)
        XCTAssertEqual(recordedVersions[1], 7)
        let excludedKinds = await recorder.recordedExcludedMutationKinds()
        XCTAssertEqual(excludedKinds.count, 2)
        XCTAssertEqual(excludedKinds[0], ["workboard"])
        XCTAssertEqual(excludedKinds[1], ["workboard"])
    }

    func testAutomaticPullSkipsWhenServerCheckpointIsUnchanged() async throws {
        let defaults = isolatedEntitlementDefaults()
        let checkpointStore = UserContentSyncCheckpointStore(defaults: defaults)
        let account = SignedInAccount(
            appUserID: "apple:checkpoint-skip-test",
            appleUserID: "checkpoint-skip-test",
            displayName: "Checkpoint Skip Test",
            signedInAt: Date()
        )
        checkpointStore.save(
            UserContentSyncCheckpoint(
                accountUserID: account.appUserID,
                backendName: "recording-sync",
                lastSuccessfulPullAt: Date(timeIntervalSince1970: 1_700_000_000),
                latestEventID: 42,
                contentMapVersion: 7,
                entitlementFingerprint: "fingerprint-v1"
            )
        )
        let recorder = SyncPullRecorder(checkpointChanged: false)
        let engine = UserContentSyncEngine(
            repository: nil,
            backend: RecordingUserContentSyncBackend(
                recorder: recorder,
                returnedContentMapVersion: 7,
                returnedEntitlementFingerprint: "fingerprint-v1",
                returnedLatestEventID: 42
            ),
            checkpointStore: checkpointStore
        )

        let report = try await engine.pullRemoteChanges(
            account: account,
            applySafeChanges: true,
            skipIfUnchanged: true
        )

        XCTAssertEqual(report.skippedReason, "No remote changes.")
        XCTAssertEqual(report.pulledCount, 0)
        XCTAssertFalse(report.includesAuthoritativeAccountState)
        let emptyPushReport = try await engine.processPendingWork(account: account)
        XCTAssertEqual(emptyPushReport.attemptedCount, 0)
        XCTAssertFalse(emptyPushReport.includesAuthoritativeAccountState)
        let pullCount = await recorder.recordedPullCount()
        let checkpointCount = await recorder.recordedCheckpointCount()
        XCTAssertEqual(pullCount, 0)
        XCTAssertEqual(checkpointCount, 1)
    }

    func testAutomaticPullRunsWhenServerCheckpointIsChanged() async throws {
        let defaults = isolatedEntitlementDefaults()
        let checkpointStore = UserContentSyncCheckpointStore(defaults: defaults)
        let account = SignedInAccount(
            appUserID: "apple:checkpoint-change-test",
            appleUserID: "checkpoint-change-test",
            displayName: "Checkpoint Change Test",
            signedInAt: Date()
        )
        checkpointStore.save(
            UserContentSyncCheckpoint(
                accountUserID: account.appUserID,
                backendName: "recording-sync",
                lastSuccessfulPullAt: Date(timeIntervalSince1970: 1_700_000_000),
                latestEventID: 40,
                contentMapVersion: 7,
                entitlementFingerprint: "fingerprint-v1"
            )
        )
        let recorder = SyncPullRecorder(checkpointChanged: true)
        let engine = UserContentSyncEngine(
            repository: nil,
            backend: RecordingUserContentSyncBackend(
                recorder: recorder,
                returnedContentMapVersion: 7,
                returnedEntitlementFingerprint: "fingerprint-v1",
                returnedLatestEventID: 43
            ),
            checkpointStore: checkpointStore
        )

        let report = try await engine.pullRemoteChanges(
            account: account,
            applySafeChanges: true,
            skipIfUnchanged: true
        )

        XCTAssertNil(report.skippedReason)
        XCTAssertTrue(report.includesAuthoritativeAccountState)
        let pullCount = await recorder.recordedPullCount()
        let checkpointCount = await recorder.recordedCheckpointCount()
        XCTAssertEqual(pullCount, 1)
        XCTAssertEqual(checkpointCount, 1)
        XCTAssertEqual(engine.checkpoint(account: account)?.latestEventID, 43)
    }

    func testLegacySyncCheckpointDecodesWithoutContentMapVersion() throws {
        let legacyData = Data(
            #"{"accountUserID":"apple:legacy-checkpoint","backendName":"permitext-http","latestEventID":41}"#.utf8
        )

        let checkpoint = try JSONDecoder().decode(UserContentSyncCheckpoint.self, from: legacyData)

        XCTAssertEqual(checkpoint.latestEventID, 41)
        XCTAssertNil(checkpoint.contentMapVersion)
        XCTAssertNil(checkpoint.entitlementFingerprint)
    }

    func testCapabilityContractDecodesResearchPackaging() throws {
        let data = Data(
            """
            {
              "schemaVersion": 2,
              "plan": "pro",
              "packages": {
                "pro": { "active": true },
                "research": { "active": false, "requiresPro": true, "mode": "unavailable" }
              },
              "capabilities": {
                "projects": { "enabled": true },
                "offline-access": { "enabled": true },
                "research": { "enabled": false, "monthlyLimit": 0, "requiresPro": true }
              }
            }
            """.utf8
        )
        let contract = try JSONDecoder().decode(PermitextCapabilityContract.self, from: data)

        XCTAssertEqual(contract.schemaVersion, 2)
        XCTAssertTrue(contract.enables(.projects))
        XCTAssertTrue(contract.enables(.offlineAccess))
        XCTAssertFalse(contract.enables(.research))
    }

    func testPackagedProLegacyAndLifetimePlansIncludeResearch() {
        let packagedPro = AppEntitlement(
            plan: .pro,
            source: .webSubscription,
            grantedUserID: "user",
            packageID: "pro",
            provider: .init(permitextPackage: "pro")
        )
        XCTAssertTrue(packagedPro.grantsResearch())

        let proWithResearch = AppEntitlement(
            plan: .pro,
            source: .webSubscription,
            grantedUserID: "user",
            packageID: "pro",
            provider: .init(permitextPackage: "pro"),
            addOns: [
                "research": .init(
                    enabled: true,
                    source: "webSubscription",
                    expiresAt: nil,
                    provider: .init(permitextPackage: "research")
                )
            ]
        )
        XCTAssertTrue(proWithResearch.grantsResearch())
        XCTAssertTrue(AppEntitlement.lifetimeGrant(userID: "user").grantsResearch())
        XCTAssertTrue(AppEntitlement(plan: .pro, source: .webSubscription, grantedUserID: "legacy").grantsResearch())
    }

    func testStoreKitPlanChangesDoNotReplaceBackendEntitlementMetadata() throws {
        let defaults = isolatedEntitlementDefaults()
        let backendEntitlement = AppEntitlement(
            plan: .pro,
            source: .webSubscription,
            grantedUserID: "backend-user",
            packageID: "pro",
            provider: .init(permitextPackage: "pro"),
            addOns: [
                "research": .init(
                    enabled: true,
                    source: "webSubscription",
                    expiresAt: nil,
                    provider: .init(permitextPackage: "research")
                )
            ]
        )
        LocalEntitlementService.setEntitlement(backendEntitlement, defaults: defaults)
        let storedBackendData = try XCTUnwrap(
            defaults.data(forKey: LocalEntitlementService.entitlementDefaultsKey)
        )

        LocalEntitlementService.setVerifiedPlan(.pro, defaults: defaults)
        XCTAssertEqual(
            defaults.data(forKey: LocalEntitlementService.entitlementDefaultsKey),
            storedBackendData
        )
        XCTAssertEqual(
            LocalEntitlementService(defaults: defaults).currentEntitlement,
            backendEntitlement
        )
        XCTAssertTrue(LocalEntitlementService(defaults: defaults).currentEntitlement.grantsResearch())

        LocalEntitlementService.setVerifiedPlan(.free, defaults: defaults)
        XCTAssertEqual(
            defaults.data(forKey: LocalEntitlementService.entitlementDefaultsKey),
            storedBackendData
        )
        XCTAssertEqual(
            LocalEntitlementService(defaults: defaults).currentEntitlement,
            backendEntitlement
        )
    }

    func testLegacyVerifiedStoreKitPlanAloneNeverGrantsPro() {
        let defaults = isolatedEntitlementDefaults()
        let service = LocalEntitlementService(defaults: defaults)
        LocalEntitlementService.setVerifiedPlan(.pro, defaults: defaults)

        XCTAssertEqual(service.currentEntitlement, .free)

        LocalEntitlementService.setEntitlement(.free, defaults: defaults)
        XCTAssertEqual(service.currentEntitlement, .free)

        LocalEntitlementService.setEntitlement(
            AppEntitlement(
                plan: .pro,
                source: .webSubscription,
                grantedUserID: "expired-backend-user",
                expiresAt: Date(timeIntervalSince1970: 1)
            ),
            defaults: defaults
        )
        XCTAssertEqual(service.currentEntitlement, .free)

        LocalEntitlementService.setVerifiedPlan(.free, defaults: defaults)
        XCTAssertEqual(service.currentEntitlement, .free)
    }

    @MainActor
    func testStartupClearsLifetimeGrantThatBelongsToAnotherAccount() {
        let defaults = isolatedEntitlementDefaults()
        LocalEntitlementService.setLifetimeGrant(userID: "user-a", defaults: defaults)
        let accountB = SignedInAccount(
            appUserID: "user-b",
            authProvider: .clerk,
            authProviderUserID: "clerk-b",
            appleUserID: "clerk-b",
            displayName: "Account B",
            signedInAt: Date()
        )

        _ = CodeLibraryViewModel(
            continuityStore: ContinuityStore(defaults: defaults),
            readerThemeStore: ReaderThemeStore(defaults: defaults),
            preferencesDefaults: defaults,
            entitlementService: LocalEntitlementService(defaults: defaults),
            loadsInitialContent: false,
            loadsPersistedAccount: false,
            initialSignedInAccount: accountB,
            ownsAccountSync: false
        )

        XCTAssertEqual(LocalEntitlementService(defaults: defaults).currentEntitlement, .free)
        XCTAssertNil(
            defaults.string(forKey: LocalEntitlementService.lifetimeGrantUserIDDefaultsKey)
        )
    }

    #if DEBUG
    func testDebugFreeOverrideWinsOverVerifiedStoreKitPro() {
        let defaults = isolatedEntitlementDefaults()
        LocalEntitlementService.setVerifiedPlan(.pro, defaults: defaults)
        LocalEntitlementService.setDebugPlan(.free, defaults: defaults)

        XCTAssertEqual(
            LocalEntitlementService(defaults: defaults).currentEntitlement,
            .debugOverride(.free)
        )
    }
    #endif

    func testReleaseLifetimeLookupCannotRevokeBackendGrant() async throws {
        let result = try await LocalLifetimeGrantLookupClient()
            .lookupLifetimeGrant(appleUserID: "backend-lifetime-user")

        #if DEBUG
        XCTAssertTrue(result.isAuthoritative)
        #else
        XCTAssertFalse(result.hasLifetimeGrant)
        XCTAssertFalse(result.isAuthoritative)
        #endif

        XCTAssertFalse(
            LifetimeGrantLookupResult(
                hasLifetimeGrant: false,
                grantedUserID: nil,
                isAuthoritative: false
            ).authoritativelyDeniesGrant
        )
        XCTAssertTrue(
            LifetimeGrantLookupResult(
                hasLifetimeGrant: false,
                grantedUserID: nil,
                isAuthoritative: true
            ).authoritativelyDeniesGrant
        )
    }

    func testPhaseSevenBookmarkPresentationReducerAppliesImmediateSaveAndRemoveState() {
        let plainBookmark = BookmarkedSection(
            id: 101,
            codeVersion: "nyc-test",
            chapterNumber: "1",
            chapterTitle: "Administration",
            sectionNumber: "101.1",
            title: "Scope"
        )
        let notedBookmark = BookmarkedSection(
            id: 202,
            codeVersion: "nyc-test",
            chapterNumber: "2",
            chapterTitle: "Definitions",
            sectionNumber: "202.1",
            title: "General",
            noteBody: "Keep this note"
        )
        let paragraphEvidence = BookmarkedSection(
            id: 202,
            annotationBlockID: "paragraph-2",
            codeVersion: "nyc-test",
            chapterNumber: "2",
            chapterTitle: "Definitions",
            sectionNumber: "202.1",
            title: "General",
            noteBody: "Paragraph note"
        )

        let removedPlain = BookmarkPresentationReducer.updatedRows(
            [plainBookmark],
            sectionID: 101,
            isBookmarked: false,
            newSectionRow: nil
        )
        XCTAssertTrue(removedPlain.isEmpty)

        let retainedEvidence = BookmarkPresentationReducer.updatedRows(
            [notedBookmark, paragraphEvidence],
            sectionID: 202,
            isBookmarked: false,
            newSectionRow: nil
        )
        XCTAssertEqual(retainedEvidence.count, 2)
        XCTAssertTrue(retainedEvidence.allSatisfy { !$0.isBookmarked })

        let added = BookmarkPresentationReducer.updatedRows(
            [],
            sectionID: 101,
            isBookmarked: true,
            newSectionRow: plainBookmark
        )
        XCTAssertEqual(added.map(\.id), [101])
        XCTAssertTrue(added.allSatisfy(\.isBookmarked))
    }

    func testPhaseSevenProjectPresentationBuildsFromAnImmutableSnapshot() async throws {
        let databaseURL = try temporaryLegacySearchDatabase()
        defer { try? FileManager.default.removeItem(at: databaseURL) }

        let codeVersion = "nyc-phase-seven-test"
        let folder = CodeFolder(
            id: 77,
            clientID: "phase-seven-folder",
            ownerID: UserDataDefaults.localOwnerID,
            visibility: .personal,
            syncState: .localOnly,
            deletedAt: nil,
            codeVersion: codeVersion,
            name: "Phase Seven",
            address: "",
            description: "",
            colorHex: CodeFolder.defaultColorHex,
            folderType: .project,
            sortOrder: 0,
            createdAt: Date(timeIntervalSince1970: 10),
            updatedAt: Date(timeIntervalSince1970: 10)
        )
        let snapshot = ProjectPresentationSnapshot(
            folders: [folder],
            versions: [
                codeVersion: ProjectEvidenceVersionSnapshot(
                    sectionIDsByFolderID: [folder.id: [1]],
                    bookmarkedSectionIDs: [1],
                    notesBySectionID: [:],
                    tagsBySectionID: [:],
                    annotationEntries: [],
                    bookmarkCreatedAtBySectionID: [1: Date(timeIntervalSince1970: 20)]
                )
            ],
            catalog: [
                BundledCodeVersion(
                    fileName: "phase-seven.sqlite",
                    fileURL: databaseURL,
                    codeVersion: codeVersion,
                    contentKind: .sqlite,
                    authoredCodeID: nil,
                    jurisdictionID: nil,
                    jurisdictionName: "New York City",
                    authoredHTMLBundlePath: nil
                )
            ]
        )

        let result = try await ProjectPresentationBuilder().build(snapshot)

        XCTAssertEqual(result.recordCountByFolderID[folder.id], 1)
        XCTAssertEqual(result.rowsByFolderID[folder.id]?.map(\.id), [1])
        XCTAssertEqual(result.rowsByFolderID[folder.id]?.first?.title, "Fire resistance")
    }

    func testPhaseSevenCurrentSectionBookmarkControlReplacesParagraphSwipeImplementations() throws {
        let currentSectionControl = ReaderCurrentSectionBookmarkButton(
            sectionID: nil,
            accentColor: .orange
        )
        XCTAssertNil(currentSectionControl.sectionID)

        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let htmlSourceURL = projectRoot.appendingPathComponent("permitext/Views/ChapterHTMLWebView.swift")
        // Swift source files are available to simulator tests running from the
        // Mac checkout, but not inside a physical-device test process. The
        // device still compiles and constructs the production control above;
        // retain the stronger source-removal assertions wherever the checkout
        // is reachable.
        guard FileManager.default.fileExists(atPath: htmlSourceURL.path) else { return }
        let htmlSource = try String(
            contentsOf: htmlSourceURL,
            encoding: .utf8
        )
        let chapterSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/ChapterReaderView.swift"),
            encoding: .utf8
        )
        let nativeSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/NativeChapterTextReaderView.swift"),
            encoding: .utf8
        )
        let htmlReaderSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/ChapterHTMLReaderView.swift"),
            encoding: .utf8
        )
        let projectsSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/BookmarksView.swift"),
            encoding: .utf8
        )

        XCTAssertFalse(htmlSource.contains("installParagraphBookmarkSwipe"))
        XCTAssertFalse(htmlSource.contains("nyccc-swipe-bookmark"))
        XCTAssertFalse(htmlSource.contains("action: 'toggleBookmark'"))
        XCTAssertFalse(chapterSource.contains("ParagraphBookmarkSwipeModifier"))
        XCTAssertTrue(chapterSource.contains("struct ReaderCurrentSectionBookmarkButton"))
        XCTAssertTrue(chapterSource.contains("let desiredBookmarkState = !displayedIsBookmarked"))
        XCTAssertTrue(chapterSource.contains("if displayedIsBookmarked == desiredBookmarkState"))
        XCTAssertTrue(chapterSource.contains("displayedIsBookmarked ? \"Saved\" : \"Removed from Saved\""))
        XCTAssertTrue(chapterSource.contains("Task.sleep(for: .milliseconds(1_200))"))
        XCTAssertTrue(chapterSource.contains(".overlay(alignment: .topTrailing)"))
        XCTAssertTrue(chapterSource.contains(".lineLimit(1)\n                    .fixedSize()"))
        XCTAssertTrue(nativeSource.contains("ReaderCurrentSectionBookmarkButton"))
        XCTAssertTrue(htmlReaderSource.contains("ReaderCurrentSectionBookmarkButton"))
        XCTAssertEqual(projectsSource.components(separatedBy: "library.refreshBookmarks()").count - 1, 1)
    }

    func testQueuedBookmarkDeleteSurvivesPullUntilItUploads() throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-delete-merge-\(UUID().uuidString).sqlite")
        defer { try? FileManager.default.removeItem(at: databaseURL) }
        let store = try UserDataStore(databaseURL: databaseURL)
        let account = SignedInAccount(
            appUserID: "apple:delete-test",
            appleUserID: "delete-test",
            displayName: "Delete Test",
            signedInAt: Date()
        )
        let codeVersion = UserContentSyncCodeVersion.localNYC2022
        let sectionID: Int64 = 77

        try store.toggleBookmark(sectionID: sectionID, codeVersion: codeVersion)
        let initialUpsert = try XCTUnwrap(store.pendingSyncQueueItems(limit: 10).first)
        try store.markSyncQueueItemSynced(id: initialUpsert.id)
        try store.toggleBookmark(sectionID: sectionID, codeVersion: codeVersion)

        XCTAssertFalse(try store.isBookmarked(sectionID: sectionID, codeVersion: codeVersion))
        let queuedDelete = try XCTUnwrap(store.pendingSyncQueueItems(limit: 10).first)
        XCTAssertEqual(queuedDelete.operationType, .delete)

        let serverRecord = ServerSavedItemRecord(
            id: [
                account.appUserID,
                "saved",
                UserContentSyncCodeVersion.canonicalNYC2022,
                String(sectionID)
            ].joined(separator: ":"),
            userID: account.appUserID,
            codeVersion: UserContentSyncCodeVersion.canonicalNYC2022,
            sectionID: sectionID,
            updatedAt: queuedDelete.mutationUpdatedAt.addingTimeInterval(-10),
            deletedAt: nil
        )
        let mutation = ServerUserContentMutation.savedItem(serverRecord)
        let candidate = try XCTUnwrap(
            store.localMergeCandidates(for: [mutation], account: account)[mutation.recordID]
        )

        XCTAssertEqual(candidate.localSyncState, .pendingUpload)
        XCTAssertEqual(candidate.localDeletedAt, queuedDelete.mutationUpdatedAt)
        XCTAssertEqual(UserContentMergeResolver.decision(for: candidate).action, .uploadLocal)
    }

    func testSyncedDeleteHidesOlderSavedAliasesUntilANewerSaveArrives() throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-synced-delete-intent-\(UUID().uuidString).sqlite")
        defer {
            for suffix in ["", "-shm", "-wal"] {
                try? FileManager.default.removeItem(atPath: databaseURL.path + suffix)
            }
        }

        let store = try UserDataStore(databaseURL: databaseURL)
        let codeVersion = UserContentSyncCodeVersion.localNYC2022
        let canonicalVersion = UserContentSyncCodeVersion.canonicalNYC2022
        let sectionID: Int64 = 77
        let folderID = try store.createFolder(
            name: "Life Safety",
            address: "",
            description: "",
            colorHex: CodeFolder.defaultColorHex,
            codeVersion: codeVersion
        )
        try store.saveSection(sectionID, toFolderIDs: [folderID], codeVersion: codeVersion)
        for item in try store.pendingSyncQueueItems(limit: 20) {
            try store.markSyncQueueItemSynced(id: item.id)
        }

        let folder = try XCTUnwrap(store.folders(codeVersion: codeVersion).first)
        try store.toggleBookmark(sectionID: sectionID, codeVersion: codeVersion)
        let queuedDeletes = try store.pendingSyncQueueItems(limit: 20)
        let bookmarkDelete = try XCTUnwrap(queuedDeletes.first {
            $0.entityType == .bookmark && $0.operationType == .delete
        })
        for item in queuedDeletes {
            try store.markSyncQueueItemSynced(id: item.id)
        }

        let olderServerDate = bookmarkDelete.mutationUpdatedAt.addingTimeInterval(-10)
        try store.applyServerUserContentMutation(.savedItem(ServerSavedItemRecord(
            id: "legacy-web-saved-77",
            userID: "apple:delete-test",
            codeVersion: canonicalVersion,
            sectionID: sectionID,
            updatedAt: olderServerDate,
            deletedAt: nil
        )))
        try store.applyServerUserContentMutation(.projectSection(ServerProjectSectionRecord(
            id: "legacy-web-project-section-77",
            userID: "apple:delete-test",
            codeVersion: canonicalVersion,
            folderClientID: folder.clientID,
            folderType: .project,
            localFolderID: folderID,
            sectionID: sectionID,
            scope: nil,
            updatedAt: olderServerDate,
            deletedAt: nil
        )))

        XCTAssertFalse(try store.isBookmarked(sectionID: sectionID, codeVersion: codeVersion))
        XCTAssertEqual(try store.bookmarkedSectionIDs(codeVersion: codeVersion), [])
        XCTAssertEqual(try store.bookmarkCount(codeVersion: codeVersion), 0)
        XCTAssertEqual(try store.totalBookmarkCount(), 0)
        XCTAssertEqual(try store.folderMembership(codeVersion: codeVersion)[sectionID], nil)
        XCTAssertEqual(try store.sections(inFolder: folderID, codeVersion: codeVersion), [])

        try store.saveSection(sectionID, toFolderIDs: [folderID], codeVersion: codeVersion)
        XCTAssertTrue(try store.isBookmarked(sectionID: sectionID, codeVersion: codeVersion))
        XCTAssertEqual(try store.folderMembership(codeVersion: codeVersion)[sectionID], [folderID])
        let resaveItems = try store.pendingSyncQueueItems(limit: 20)
        XCTAssertTrue(resaveItems.contains {
            $0.entityType == .bookmark && $0.operationType == .upsert
        })
        XCTAssertTrue(resaveItems.contains {
            $0.entityType == .folderSection && $0.operationType == .upsert
        })
        for item in resaveItems {
            try store.markSyncQueueItemSynced(id: item.id)
        }

        try store.toggleBookmark(sectionID: sectionID, codeVersion: codeVersion)
        let secondDelete = try XCTUnwrap(
            store.pendingSyncQueueItems(limit: 20).first {
                $0.entityType == .bookmark && $0.operationType == .delete
            }
        )
        for item in try store.pendingSyncQueueItems(limit: 20) {
            try store.markSyncQueueItemSynced(id: item.id)
        }

        let newerServerDate = secondDelete.mutationUpdatedAt.addingTimeInterval(10)
        try store.applyServerUserContentMutation(.savedItem(ServerSavedItemRecord(
            id: "newer-web-saved-77",
            userID: "apple:delete-test",
            codeVersion: canonicalVersion,
            sectionID: sectionID,
            updatedAt: newerServerDate,
            deletedAt: nil
        )))
        try store.applyServerUserContentMutation(.projectSection(ServerProjectSectionRecord(
            id: "newer-web-project-section-77",
            userID: "apple:delete-test",
            codeVersion: canonicalVersion,
            folderClientID: folder.clientID,
            folderType: .project,
            localFolderID: folderID,
            sectionID: sectionID,
            scope: nil,
            updatedAt: newerServerDate,
            deletedAt: nil
        )))

        XCTAssertTrue(try store.isBookmarked(sectionID: sectionID, codeVersion: codeVersion))
        XCTAssertEqual(try store.bookmarkedSectionIDs(codeVersion: codeVersion), [sectionID])
        XCTAssertEqual(try store.folderMembership(codeVersion: codeVersion)[sectionID], [folderID])
        XCTAssertEqual(try store.sections(inFolder: folderID, codeVersion: codeVersion), [sectionID])
    }

    func testNewerServerEditConflictsWithQueuedLocalDelete() {
        let deletionTime = Date()
        let candidate = UserContentMergeCandidate(
            recordID: "saved-1",
            entityKind: .savedItem,
            localUpdatedAt: deletionTime,
            serverUpdatedAt: deletionTime.addingTimeInterval(1),
            localDeletedAt: deletionTime,
            serverDeletedAt: nil,
            localSyncState: .pendingUpload
        )

        XCTAssertEqual(UserContentMergeResolver.decision(for: candidate).action, .flagConflict)
    }

    func testQueuedContinuityUploadsIntoServerPerEntryMergeEvenWhenServerSnapshotIsNewer() {
        let now = Date()
        let candidate = UserContentMergeCandidate(
            recordID: "apple:continuity-test:continuity:nyc-2022",
            entityKind: .continuity,
            localUpdatedAt: now,
            serverUpdatedAt: now.addingTimeInterval(10),
            localSyncState: .pendingUpload
        )

        let decision = UserContentMergeResolver.decision(for: candidate)

        XCTAssertEqual(decision.action, .uploadLocal)
        XCTAssertTrue(decision.reason.contains("histories merge per entry"))
    }

    func testServerTombstoneUsesApplyServerAction() {
        let now = Date()
        let candidate = UserContentMergeCandidate(
            recordID: "saved-1",
            entityKind: .savedItem,
            localUpdatedAt: now.addingTimeInterval(-10),
            serverUpdatedAt: now,
            localDeletedAt: nil,
            serverDeletedAt: now,
            localSyncState: .synced
        )

        XCTAssertEqual(UserContentMergeResolver.decision(for: candidate).action, .applyServer)
    }

    @MainActor
    func testPermitextUniversalLinksAcceptPrimaryAndLegacyHosts() throws {
        for host in ["permitext.com", "permitext-sync.vercel.app"] {
            let invitationURL = try XCTUnwrap(
                URL(string: "https://\(host)/?organizationInvite=private-token-123")
            )
            XCTAssertEqual(
                CodeLibraryViewModel.organizationInvitationToken(from: invitationURL),
                "private-token-123"
            )
            XCTAssertEqual(
                CodeLibraryViewModel.deepLinkedSectionID(
                    from: URL(string: "https://\(host)/open/section/101")!
                ),
                101
            )
        }

        XCTAssertEqual(
            CodeLibraryViewModel.sharedSectionURL(sectionID: 101).absoluteString,
            "https://permitext.com/open/section/101"
        )
        XCTAssertNil(
            CodeLibraryViewModel.organizationInvitationToken(
                from: URL(string: "https://example.com/?organizationInvite=private-token-123")!
            )
        )
        XCTAssertNil(
            CodeLibraryViewModel.deepLinkedSectionID(
                from: URL(string: "https://example.com/open/section/101")!
            )
        )
        XCTAssertNil(
            CodeLibraryViewModel.organizationInvitationToken(
                from: URL(string: "https://permitext-sync.vercel.app/open/section/101?organizationInvite=token")!
            )
        )
    }

    func testFirmCollaborationReleaseSurfaceIsDeferred() {
        XCTAssertFalse(PermitextReleaseSurfaceVisibility.firmCollaboration)
    }

    func testOrganizationSnapshotDecodesNotebookAndGeneratedReportArtifacts() throws {
        let data = Data(
            """
            {
              "access": {
                "role": "reviewer",
                "permissions": ["project.view", "project.review", "evidence.review", "report.download"],
                "readOnly": true,
                "organization": null
              },
              "project": {
                "schemaVersion": 1,
                "projects": [{
                  "id": "project-1",
                  "sourceRecordID": "folder-1",
                  "name": "225 Broadway",
                  "address": "225 Broadway",
                  "description": "Filing review",
                  "colorHex": "#315A72",
                  "archivedAt": null,
                  "updatedAt": "2026-07-24T20:00:00.000Z",
                  "originalOwnerUserID": "owner-1",
                  "role": "reviewer",
                  "permissions": ["project.view"]
                }],
                "links": [{
                  "id": "link-1",
                  "projectID": "project-1",
                  "targetKind": "canonicalSection",
                  "targetID": "101",
                  "relationship": "reference",
                  "deletedAt": null
                }],
                "artifacts": [
                  {
                    "envelope": {
                      "id": "card-1",
                      "type": "notebookCard",
                      "createdAt": "2026-07-24T20:00:00.000Z",
                      "updatedAt": "2026-07-24T20:10:00.000Z",
                      "deletedAt": null,
                      "version": 2
                    },
                    "payload": {
                      "cardType": "coordination-item",
                      "title": "Filing sequence",
                      "plainText": "Coordinate submission order.",
                      "referenceCount": 1
                    }
                  },
                  {
                    "envelope": {
                      "id": "report-1",
                      "type": "generatedReport",
                      "createdAt": "2026-07-24T21:00:00.000Z",
                      "updatedAt": "2026-07-24T21:00:00.000Z",
                      "deletedAt": null,
                      "version": 1
                    },
                    "payload": {
                      "manifestID": "manifest-1",
                      "reportVersion": 3,
                      "title": "Permit Review",
                      "createdAt": "2026-07-24T21:00:00.000Z",
                      "file": {
                        "format": "web-pdf",
                        "pathname": "private/report.pdf",
                        "contentType": "application/pdf",
                        "size": 1024,
                        "contentHash": "abc123",
                        "createdAt": "2026-07-24T21:00:00.000Z"
                      }
                    }
                  }
                ],
                "researchConversations": [],
                "researchAnswers": [],
                "activity": [],
                "workboardPreview": null
              }
            }
            """.utf8
        )
        let response = try JSONDecoder().decode(
            BackendOrganizationProjectSnapshotResponse.self,
            from: data
        )

        XCTAssertEqual(response.access.role, "reviewer")
        XCTAssertTrue(response.access.readOnly)
        XCTAssertEqual(response.project.links?.count, 1)
        XCTAssertEqual(response.project.artifacts?.compactMap(\.notebookCard).first?.title, "Filing sequence")
        XCTAssertEqual(response.project.artifacts?.compactMap(\.generatedReportFile).first?.reportVersion, 3)
    }

    func testPersonalProjectFoundationDecodesWithoutOrganizationAccessFields() throws {
        let data = Data(
            """
            {
              "schemaVersion": 1,
              "projects": [{
                "id": "project-1",
                "sourceRecordID": "folder-1",
                "name": "Permitext QA",
                "address": "QA only",
                "description": "Cross-device release walkthrough.",
                "colorHex": "#6678D4",
                "archivedAt": null,
                "updatedAt": "2026-07-26T19:00:00.000Z"
              }],
              "links": [],
              "artifacts": [],
              "researchConversations": [],
              "researchAnswers": [],
              "activity": [],
              "workboardPreview": null
            }
            """.utf8
        )

        let response = try JSONDecoder().decode(
            BackendProjectFoundationResponse.self,
            from: data
        )

        let project = try XCTUnwrap(response.projects?.first)
        XCTAssertEqual(project.id, "project-1")
        XCTAssertEqual(project.sourceRecordID, "folder-1")
        XCTAssertEqual(project.name, "Permitext QA")
    }

    func testProjectFoundationDecodesWaitingCoordinationThread() throws {
        let data = Data(
            """
            {
              "schemaVersion": 1,
              "projects": [],
              "links": [],
              "artifacts": [{
                "envelope": {
                  "id": "review-thread-1",
                  "type": "reviewThread",
                  "createdAt": "2026-08-01T14:00:00.000Z",
                  "updatedAt": "2026-08-01T15:00:00.000Z",
                  "deletedAt": null,
                  "version": 2
                },
                "payload": {
                  "schemaVersion": 2,
                  "projectID": "project-1",
                  "kind": "missing-project-fact",
                  "status": "waiting",
                  "targetKind": "notebook-card",
                  "targetID": "card-1",
                  "linkedItemSnapshot": {
                    "label": "Filing assumptions",
                    "description": "Confirm the proposed occupancy group.",
                    "updatedAt": "2026-08-01T13:30:00.000Z"
                  },
                  "title": "Confirm occupancy group",
                  "body": "Waiting for the architect's response.",
                  "createdByUserID": "reviewer-1",
                  "updatedByUserID": "reviewer-1",
                  "createdByDisplayName": "Reviewer",
                  "updatedByDisplayName": "Reviewer",
                  "assigneeUserID": "architect-1",
                  "resolvedByUserID": null,
                  "resolvedByDisplayName": "",
                  "resolvedAt": null,
                  "resolution": null
                }
              }],
              "researchConversations": [],
              "researchAnswers": [],
              "activity": [],
              "workboardPreview": null
            }
            """.utf8
        )

        let response = try JSONDecoder().decode(
            BackendProjectFoundationResponse.self,
            from: data
        )

        let thread = try XCTUnwrap(response.artifacts?.first)
        XCTAssertEqual(thread.envelope.type, "reviewThread")
        XCTAssertEqual(thread.payload.status, "waiting")
    }

    func testProjectFoundationPreservesCodeQuestionArtifactWithoutCrashing() throws {
        let data = Data(
            """
            {
              "schemaVersion": 1,
              "projects": [],
              "links": [],
              "artifacts": [{
                "envelope": {
                  "id": "cq-1",
                  "type": "codeQuestion",
                  "createdAt": "2026-08-03T12:00:00.000Z",
                  "updatedAt": "2026-08-03T12:00:00.000Z",
                  "deletedAt": null,
                  "version": 1
                },
                "payload": {
                  "schemaVersion": 1,
                  "projectID": "project-1",
                  "displayID": "Q-001",
                  "questionNumber": 1,
                  "title": "Synthetic corridor width",
                  "questionText": "What minimum clear width applies in this synthetic fixture?",
                  "recordState": "active",
                  "definitionRevision": 1,
                  "futureUnknownField": "must-not-break-decode"
                }
              }, {
                "envelope": {
                  "id": "review-1",
                  "type": "reviewThread",
                  "createdAt": "2026-08-03T13:00:00.000Z",
                  "updatedAt": "2026-08-03T13:00:00.000Z",
                  "deletedAt": null,
                  "version": 1
                },
                "payload": {
                  "schemaVersion": 2,
                  "projectID": "project-1",
                  "kind": "general-review",
                  "requestType": "interpretation-review",
                  "status": "open",
                  "targetKind": "professionalConclusion",
                  "targetID": "conclusion-1",
                  "questionID": "cq-1",
                  "reviewRound": 1,
                  "title": "Interpret exception",
                  "body": "Please confirm applicability.",
                  "createdByUserID": "reviewer-1",
                  "updatedByUserID": "reviewer-1"
                }
              }],
              "researchConversations": [],
              "researchAnswers": [],
              "activity": [],
              "workboardPreview": null
            }
            """.utf8
        )

        let response = try JSONDecoder().decode(
            BackendProjectFoundationResponse.self,
            from: data
        )

        XCTAssertEqual(response.artifacts?.count, 2)
        let question = try XCTUnwrap(response.artifacts?.first { $0.envelope.type == "codeQuestion" })
        XCTAssertEqual(question.payload.displayID, "Q-001")
        XCTAssertEqual(question.payload.questionNumber, 1)
        XCTAssertEqual(question.payload.recordState, "active")
        XCTAssertEqual(question.payload.questionText?.contains("synthetic fixture"), true)

        let review = try XCTUnwrap(response.artifacts?.first { $0.envelope.type == "reviewThread" })
        XCTAssertEqual(review.payload.requestType, "interpretation-review")
        XCTAssertEqual(review.payload.questionID, "cq-1")
        XCTAssertEqual(review.payload.reviewRound, 1)
    }

    func testProjectHubDerivesCompleteCodeQuestionLifecycleWithoutChangingSemanticIdentity() throws {
        func artifact(_ id: String, _ type: String, _ payload: String, version: Int = 1) -> String {
            """
            {
              "envelope": {
                "id": "\(id)",
                "type": "\(type)",
                "createdAt": "2026-08-06T12:00:00.000Z",
                "updatedAt": "2026-08-06T12:00:00.000Z",
                "deletedAt": null,
                "version": \(version)
              },
              "payload": \(payload)
            }
            """
        }

        let artifacts = [
            artifact("cq-9", "codeQuestion", """
            {
              "schemaVersion": 1,
              "projectID": "project-1",
              "displayID": "Q-009",
              "questionNumber": 9,
              "title": "Exit enclosure continuity",
              "questionText": "Does the proposed enclosure maintain the required continuity?",
              "scope": "Synthetic filing review",
              "jurisdiction": "New York City",
              "recordState": "active",
              "definitionRevision": 3,
              "currentEvidenceSetVersion": 2,
              "currentAnalysisID": "analysis-2",
              "currentConclusionRevision": 2,
              "latestIssuedRecordID": "issued-2",
              "futureField": { "preserveDecode": true }
            }
            """),
            artifact("input-1", "questionInput", """
            {
              "id": "input-1",
              "questionID": "cq-9",
              "inputKind": "confirmedFact",
              "statement": "The enclosure serves three stories.",
              "state": "confirmed",
              "revision": 1
            }
            """),
            artifact("snapshot-b", "evidenceSnapshotV2", """
            {
              "id": "snapshot-b",
              "sourceIdentity": "Building Code 2022",
              "passageLocator": "BC 1023.5",
              "quotedText": "Openings and penetrations shall be protected.",
              "textHash": "hash-text-b",
              "sourceVersion": "2022"
            }
            """),
            artifact("snapshot-a", "evidenceSnapshotV2", """
            {
              "id": "snapshot-a",
              "sourceIdentity": "Building Code 2022",
              "passageLocator": "BC 1023.1",
              "quotedText": "Interior exit stairways shall be enclosed.",
              "textHash": "hash-text-a",
              "sourceVersion": 2022
            }
            """),
            artifact("set-2", "questionEvidenceSet", """
            {
              "id": "set-2",
              "questionID": "cq-9",
              "version": 2,
              "entries": [
                { "snapshotID": "snapshot-b", "role": "supporting", "analysisEligible": true },
                { "snapshotID": "snapshot-a", "role": "governing", "analysisEligible": true }
              ],
              "contentHash": "hash-evidence-set-2"
            }
            """),
            artifact("analysis-2", "questionAnalysis", """
            {
              "id": "analysis-2",
              "questionID": "cq-9",
              "definitionRevision": 3,
              "definitionHash": "hash-definition-3",
              "inputSnapshotIDs": ["input-1"],
              "inputSetHash": "hash-inputs",
              "evidenceSetID": "set-2",
              "evidenceSetVersion": 2,
              "evidenceSetHash": "hash-evidence-set-2",
              "dependencyHash": "hash-dependency",
              "researchAnswerID": "answer-1",
              "analysisPolicyID": "selected-evidence-only-v1",
              "citationValidation": "valid"
            }
            """),
            artifact("conclusion-2", "professionalConclusion", """
            {
              "id": "conclusion-2",
              "questionID": "cq-9",
              "revision": 2,
              "definitionRevision": 3,
              "evidenceSetID": "set-2",
              "evidenceSetVersion": 2,
              "evidenceSetHash": "hash-evidence-set-2",
              "conclusionText": "The proposed detail requires revision.",
              "reasoning": "The selected evidence requires protected continuity.",
              "citations": ["snapshot-a", "snapshot-b"],
              "assumptions": ["Submitted detail is current."],
              "unknowns": [],
              "aiAssistanceDisclosure": "AI assisted with organization; the professional authored the conclusion."
            }
            """),
            artifact("approval-2", "conclusionApproval", """
            {
              "id": "approval-2",
              "questionID": "cq-9",
              "conclusionID": "conclusion-2",
              "conclusionRevision": 2,
              "dependencyHash": "hash-dependency",
              "reviewRound": 2,
              "approvalBasis": "Reviewed against the approved evidence.",
              "approvedByUserID": "reviewer-1",
              "approvedAt": "2026-08-06T13:00:00.000Z"
            }
            """),
            artifact("review-9", "reviewThread", """
            {
              "questionID": "cq-9",
              "requestType": "interpretation-review",
              "reviewRound": 2,
              "status": "resolved",
              "title": "Confirm continuity interpretation",
              "body": "Reviewed and resolved."
            }
            """),
            artifact("ready-2", "codeMemoReadiness", """
            {
              "id": "ready-2",
              "questionID": "cq-9",
              "draftID": "memo-draft-2",
              "draftRevision": 2,
              "draftHash": "hash-draft-2",
              "checks": [{ "id": "citations", "label": "Citations", "ready": true, "message": "Validated" }]
            }
            """),
            artifact("memo-approval-2", "codeMemoApproval", """
            {
              "id": "memo-approval-2",
              "questionID": "cq-9",
              "draftID": "memo-draft-2",
              "draftRevision": 2,
              "draftHash": "hash-draft-2",
              "conclusionID": "conclusion-2",
              "conclusionRevision": 2,
              "conclusionHash": "hash-conclusion-2",
              "approvalBasis": "Approved for issue."
            }
            """),
            artifact("issued-1", "issuedDecisionRecord", """
            {
              "id": "issued-1",
              "questionID": "cq-9",
              "issueVersion": 1,
              "status": "superseded",
              "reportManifestID": "manifest-1",
              "componentVersions": { "definition": 2, "client": "web" },
              "componentHashes": { "memo": "hash-memo-1" },
              "successorID": "issued-2",
              "supersessionReason": "Definition revision 3 approved.",
              "issuedAt": "2026-08-05T12:00:00.000Z"
            }
            """),
            artifact("issued-2", "issuedDecisionRecord", """
            {
              "id": "issued-2",
              "questionID": "cq-9",
              "issueVersion": 2,
              "status": "issued",
              "reportManifestID": "manifest-2",
              "componentVersions": { "definition": 3, "evidenceSet": 2 },
              "componentHashes": { "memo": "hash-memo-2", "evidenceSet": "hash-evidence-set-2" },
              "predecessorID": "issued-1",
              "issuedAt": "2026-08-06T14:00:00.000Z"
            }
            """),
            artifact("promotion-1", "codeQuestionPromotion", """
            {
              "id": "promotion-1",
              "projectID": "project-1",
              "questionID": "cq-9",
              "sourceKind": "workboard",
              "sourceID": "workboard-1",
              "sourceLabel": "Project Workboard",
              "status": "linked",
              "recoveryCount": 1
            }
            """)
        ]
        let json = """
        {
          "schemaVersion": 1,
          "projects": [],
          "links": [],
          "artifacts": [\(artifacts.joined(separator: ","))],
          "researchConversations": [],
          "researchAnswers": [{
            "id": "answer-1",
            "conversationID": "conversation-1",
            "projectID": "project-1",
            "question": "Does continuity comply?",
            "conclusion": "The selected evidence identifies a continuity gap.",
            "evidenceCount": 2,
            "reviewStatus": "reviewed",
            "createdAt": "2026-08-06T12:30:00.000Z"
          }],
          "activity": [],
          "workboardPreview": null
        }
        """
        let foundation = try JSONDecoder().decode(
            BackendProjectFoundationResponse.self,
            from: Data(json.utf8)
        )
        let records = ProjectCodeQuestionRecord.records(
            artifacts: try XCTUnwrap(foundation.artifacts),
            researchAnswers: foundation.researchAnswers
        )
        let record = try XCTUnwrap(records.first)

        XCTAssertEqual(records.count, 1)
        XCTAssertEqual(record.displayID, "Q-009")
        XCTAssertEqual(record.stage, .issue)
        XCTAssertEqual(record.stateLabel, "Issued v2")
        XCTAssertEqual(record.inputs.first?.payload.statement, "The enclosure serves three stories.")
        XCTAssertEqual(record.latestEvidenceSet?.payload.contentHash, "hash-evidence-set-2")
        XCTAssertEqual(record.evidenceSnapshots.map(\.id), ["snapshot-a", "snapshot-b"])
        XCTAssertEqual(record.evidenceSnapshots.map(\.payload.textHash), ["hash-text-a", "hash-text-b"])
        XCTAssertEqual(record.latestAnalysis?.payload.dependencyHash, "hash-dependency")
        XCTAssertFalse(record.analysisIsStale)
        XCTAssertEqual(record.researchAnswer?.id, "answer-1")
        XCTAssertEqual(record.latestConclusion?.payload.citations, ["snapshot-a", "snapshot-b"])
        XCTAssertEqual(record.latestIssuedRecord?.payload.reportManifestID, "manifest-2")
        XCTAssertEqual(record.issuedRecords.map { $0.payload.issueVersion }, [1, 2])
        XCTAssertEqual(record.issuedRecords.first?.payload.successorID, "issued-2")
        XCTAssertEqual(record.promotions.first?.payload.sourceLabel, "Project Workboard")
        XCTAssertEqual(record.memoReadiness.first?.payload.checks?.first?.id, "citations")
    }

    func testProjectHubOfflineCacheIsAccountScopedAndPreservesCodeQuestionArtifacts() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let cache = ProjectHubOfflineCache(directoryURL: directory)
        let data = Data(
            """
            {
              "schemaVersion": 1,
              "projects": [],
              "links": [],
              "artifacts": [{
                "envelope": {
                  "id": "cq-cache",
                  "type": "codeQuestion",
                  "createdAt": "2026-08-06T12:00:00.000Z",
                  "updatedAt": "2026-08-06T12:00:00.000Z",
                  "deletedAt": null,
                  "version": 1
                },
                "payload": {
                  "projectID": "project-cache",
                  "displayID": "Q-001",
                  "questionNumber": 1,
                  "title": "Cached question",
                  "questionText": "Does the cached record preserve identity?",
                  "definitionRevision": 1,
                  "recordState": "active"
                }
              }],
              "researchConversations": [],
              "researchAnswers": [],
              "activity": [],
              "workboardPreview": null
            }
            """.utf8
        )
        let foundation = try JSONDecoder().decode(BackendProjectFoundationResponse.self, from: data)
        let snapshot = ProjectHubSnapshot(
            projectID: "project-cache",
            notebookCards: [],
            researchConversations: [],
            researchAnswers: [],
            activity: [],
            reports: [],
            foundationArtifacts: try XCTUnwrap(foundation.artifacts)
        )

        try cache.store(snapshot, accountID: "account-a", projectID: snapshot.projectID, scope: "personal")
        let loaded = try XCTUnwrap(
            cache.load(
                ProjectHubSnapshot.self,
                accountID: "account-a",
                projectID: snapshot.projectID,
                scope: "personal"
            )
        )
        XCTAssertEqual(loaded.value.foundationArtifacts.first?.id, "cq-cache")
        XCTAssertEqual(
            ProjectCodeQuestionRecord.records(
                artifacts: loaded.value.foundationArtifacts,
                researchAnswers: loaded.value.researchAnswers
            ).first?.displayID,
            "Q-001"
        )
        XCTAssertNil(
            try cache.load(
                ProjectHubSnapshot.self,
                accountID: "account-b",
                projectID: snapshot.projectID,
                scope: "personal"
            )
        )
    }

    func testResearchQuestionAttemptPersistsForRelaunchAndCanBeRemovedAfterCompletion() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let cache = ProjectHubOfflineCache(directoryURL: directory)
        let attempt = ResearchQuestionAttempt(
            id: "stable-request-id",
            question: "What official guidance applies?"
        )

        try cache.store(
            attempt,
            accountID: "account-a",
            projectID: "conversation-a",
            scope: ResearchQuestionAttempt.cacheScope
        )
        let recovered = try XCTUnwrap(
            cache.load(
                ResearchQuestionAttempt.self,
                accountID: "account-a",
                projectID: "conversation-a",
                scope: ResearchQuestionAttempt.cacheScope
            )
        )
        XCTAssertEqual(recovered.value, attempt)
        XCTAssertNil(
            try cache.load(
                ResearchQuestionAttempt.self,
                accountID: "account-b",
                projectID: "conversation-a",
                scope: ResearchQuestionAttempt.cacheScope
            )
        )

        try cache.remove(
            accountID: "account-a",
            projectID: "conversation-a",
            scope: ResearchQuestionAttempt.cacheScope
        )
        XCTAssertNil(
            try cache.load(
                ResearchQuestionAttempt.self,
                accountID: "account-a",
                projectID: "conversation-a",
                scope: ResearchQuestionAttempt.cacheScope
            )
        )
    }

    func testQuestionFirstResearchCreationOmitsEmptySelections() throws {
        let request = ResearchConversationCreateRequest(
            auth: BackendAuthContext(accountUserID: "account-1", bearerToken: "token"),
            projectID: "project-1",
            selections: nil,
            originSurface: "ios-reader"
        )
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any]
        )

        XCTAssertNil(object["selections"])
        XCTAssertEqual(object["projectID"] as? String, "project-1")
        XCTAssertEqual(object["originSurface"] as? String, "ios-reader")
    }

    func testReviewedResearchSelectionEncodesExplicitVisualApproval() throws {
        let selection = ResearchSelectionRequest(
            sectionID: "section-1107",
            selectedText: "The selected enacted accessibility passage.",
            visualSourceIDs: ["visual-source-figure"],
            visualReviewConfirmed: true
        )
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: JSONEncoder().encode(selection)) as? [String: Any]
        )

        XCTAssertEqual(object["sectionID"] as? String, "section-1107")
        XCTAssertEqual(object["visualSourceIDs"] as? [String], ["visual-source-figure"])
        XCTAssertEqual(object["visualReviewConfirmed"] as? Bool, true)
    }

    func testResearchSelectionReviewDecodesVerifiedVisualInventory() throws {
        let data = Data(
            """
            {
              "selection": {
                "sectionID": "section-1107",
                "selectedText": "The selected enacted accessibility passage.",
                "codePrefix": "BC",
                "sectionNumber": "1107.2.2.7.3.1"
              },
              "requiresVisualReview": true,
              "maximumVisualSelections": 4,
              "visualSources": [{
                "id": "visual-source-figure",
                "kind": "image",
                "assetName": "figure-1107.png",
                "assetURL": "/code/assets/figure-1107.png",
                "mediaType": "image/png",
                "contentHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "byteLength": 2048,
                "displayWidth": 800,
                "displayHeight": 600
              }]
            }
            """.utf8
        )

        let decoded = try JSONDecoder().decode(ResearchSelectionReviewResponse.self, from: data)

        XCTAssertTrue(decoded.requiresVisualReview)
        XCTAssertEqual(decoded.maximumVisualSelections, 4)
        XCTAssertEqual(decoded.selection.sectionID, "section-1107")
        XCTAssertEqual(decoded.visualSources.first?.assetName, "figure-1107.png")
        XCTAssertEqual(decoded.visualSources.first?.byteLength, 2048)
    }

    func testResearchFailurePresentsInsufficientEvidenceOutcome() {
        let error = PermitextBackendHTTPError.serverStatus(
            422,
            "Permitext could not locate enacted text in the current authorized corpus for this question. Try a more specific code topic or citation.",
            code: "RESEARCH_EVIDENCE_NOT_FOUND"
        )

        XCTAssertEqual(error.statusCode, 422)
        XCTAssertEqual(error.serverCode, "RESEARCH_EVIDENCE_NOT_FOUND")
        XCTAssertEqual(
            ResearchRequestFailurePresentation.resolve(error).message,
            "Permitext could not locate enacted text in the current authorized corpus for this question. Try a more specific code topic or citation. Your question is still here."
        )
    }

    func testResearch409RetainsAuthoritativeConversationForRecovery() async throws {
        let host = "research-recovery-\(UUID().uuidString.lowercased()).test"
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [ScopedPermitextURLProtocol.self]
        let session = URLSession(configuration: configuration)
        defer {
            ScopedPermitextURLProtocol.removeHandler(for: host)
            session.invalidateAndCancel()
        }

        ScopedPermitextURLProtocol.install({ request in
            let body = try permitextRequestBody(request)
            let object = try XCTUnwrap(
                JSONSerialization.jsonObject(with: body) as? [String: Any]
            )
            let conversationID = try XCTUnwrap(object["conversationID"] as? String)
            let isProjectReview = conversationID == "conversation-project-review"
            let conversation = ResearchConversation(
                id: conversationID,
                title: "Recovery contract",
                createdAt: "2026-08-26T12:00:00.000Z",
                updatedAt: "2026-08-26T12:01:00.000Z",
                primaryProjectID: isProjectReview ? "project-1" : nil,
                projectContext: isProjectReview
                    ? ResearchProjectContext(
                        projectID: "project-1",
                        facts: ["Occupancy is Group B."],
                        source: "user-provided",
                        updatedAt: "2026-08-26T12:01:00.000Z"
                    )
                    : nil,
                projectContextReviewRequired: isProjectReview,
                sourceStatus: isProjectReview ? "current" : "changed"
            )
            let conversationData = try JSONEncoder().encode(conversation)
            let conversationObject = try XCTUnwrap(
                JSONSerialization.jsonObject(with: conversationData) as? [String: Any]
            )
            let payload: [String: Any] = [
                "error": isProjectReview
                    ? "Confirm the updated Project facts before continuing."
                    : "Refresh the changed enacted source before continuing.",
                "code": isProjectReview
                    ? "RESEARCH_PROJECT_REVIEW_REQUIRED"
                    : "RESEARCH_SOURCE_CHANGED",
                "conversation": conversationObject
            ]
            return (409, try JSONSerialization.data(withJSONObject: payload))
        }, for: host)

        let transport = PermitextBackendHTTPTransport(
            baseURL: try XCTUnwrap(URL(string: "https://\(host)/")),
            session: session
        )
        let client = PermitextBackendClient(transport: transport)
        let account = SignedInAccount(
            appUserID: "clerk:research-recovery",
            authProvider: .clerk,
            authProviderUserID: "research-recovery",
            appleUserID: "",
            displayName: "Research Recovery",
            signedInAt: Date(),
            backendSessionToken: "test-token"
        )

        for conversationID in ["conversation-source-changed", "conversation-project-review"] {
            do {
                _ = try await client.sendResearchMessage(
                    account: account,
                    conversationID: conversationID,
                    question: "What changed?",
                    requestID: "request-\(conversationID)"
                )
                XCTFail("Expected the backend recovery response to remain a 409.")
            } catch let error as PermitextBackendHTTPError {
                let authoritative = try XCTUnwrap(
                    ResearchAuthoritativeConversationRecovery.conversation(
                        from: error,
                        matching: conversationID
                    )
                )
                XCTAssertEqual(authoritative.id, conversationID)
                if conversationID == "conversation-source-changed" {
                    XCTAssertEqual(authoritative.sourceStatus, "changed")
                    XCTAssertFalse(authoritative.projectContextReviewRequired)
                } else {
                    XCTAssertEqual(authoritative.sourceStatus, "current")
                    XCTAssertTrue(authoritative.projectContextReviewRequired)
                    XCTAssertEqual(authoritative.projectContext?.facts, ["Occupancy is Group B."])
                }
                XCTAssertNil(
                    ResearchAuthoritativeConversationRecovery.conversation(
                        from: error,
                        matching: "different-conversation"
                    )
                )
            }
        }
    }

    @MainActor
    func testNewAssignedProjectSyncsBeforeResearchConversationCreation() async throws {
        let databaseURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("permitext-research-project-sync-\(UUID().uuidString).sqlite")
        defer {
            for suffix in ["", "-shm", "-wal"] {
                try? FileManager.default.removeItem(atPath: databaseURL.path + suffix)
            }
        }

        let host = "research-project-sync-\(UUID().uuidString.lowercased()).test"
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [ScopedPermitextURLProtocol.self]
        let session = URLSession(configuration: configuration)
        defer {
            ScopedPermitextURLProtocol.removeHandler(for: host)
            session.invalidateAndCancel()
        }

        let recorder = ResearchRequestPathRecorder()
        let importedFacts = [
            ProjectStructuredFact(
                id: "nyc-planning:bbl",
                key: "bbl",
                label: "BBL",
                value: "2028500003",
                status: "sourced",
                source: "nyc-planning",
                sourceText: "NYC Planning MapPLUTO",
                updatedAt: Date(timeIntervalSince1970: 1_787_745_600)
            ),
            ProjectStructuredFact(
                id: "nyc-planning:zoning-districts",
                key: "zoning-districts",
                label: "Zoning District(s)",
                value: "R8A",
                status: "sourced",
                source: "nyc-planning",
                sourceText: "NYC Planning mapped zoning layers",
                updatedAt: Date(timeIntervalSince1970: 1_787_745_600)
            )
        ]
        ScopedPermitextURLProtocol.install({ request in
            let path = request.url?.path ?? ""
            let body = try permitextRequestBody(request)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .custom { _, encoder in
                var container = encoder.singleValueContainer()
                try container.encode("2026-08-26T12:00:00.000Z")
            }

            switch path {
            case "/projects/property/lookup":
                recorder.record(path)
                let lookup = try decoder.decode(BackendProjectPropertyLookupRequest.self, from: body)
                guard lookup.address == "1760 Jerome Ave, Bronx" else {
                    return (422, Data(#"{"error":"Unexpected property address."}"#.utf8))
                }
                let response = BackendProjectPropertyLookupResponse(
                    property: BackendProjectPropertyContext(
                        schemaVersion: 1,
                        query: lookup.address,
                        normalizedAddress: "1760 JEROME AVENUE, Bronx, NY 10453",
                        bbl: "2028500003",
                        zolaURL: "https://zola.planninglabs.nyc/l/lot/2/2850/3",
                        retrievedAt: Date(timeIntervalSince1970: 1_787_745_600),
                        source: BackendProjectPropertyLookupSource(
                            agency: "NYC Department of City Planning",
                            datasets: ["MapPLUTO", "Zoning Tax Lot Database"]
                        ),
                        structuredFacts: importedFacts,
                        warnings: ["Tax-lot facts do not establish zoning-lot composition."]
                    )
                )
                return (200, try encoder.encode(response))

            case "/sync/push":
                recorder.record(path)
                let push = try decoder.decode(BackendUserContentPushRequest.self, from: body)
                let project = push.batch.mutations.compactMap { mutation -> ServerProjectRecord? in
                    guard case .project(let record) = mutation else { return nil }
                    return record
                }.first
                guard project?.address == "1760 JEROME AVENUE, Bronx, NY 10453",
                      project?.structuredFacts == importedFacts
                else {
                    return (422, Data(#"{"error":"Imported Project facts were not synchronized."}"#.utf8))
                }
                let response = BackendUserContentPushResponse(
                    acceptedMutationIDs: push.batch.mutations.map(\.recordID),
                    rejectedMutationIDs: [],
                    rejectionReasons: [:],
                    serverTime: Date(timeIntervalSince1970: 1_787_745_600)
                )
                return (200, try encoder.encode(response))

            case "/research/conversations/create":
                recorder.record(path)
                guard recorder.contains("/sync/push") else {
                    return (404, Data(#"{"error":"Project was not synced first."}"#.utf8))
                }
                let create = try decoder.decode(ResearchConversationCreateRequest.self, from: body)
                let response = ResearchConversationResponse(
                    conversation: ResearchConversation(
                        id: "research-after-project-sync",
                        title: "New Project Research",
                        createdAt: "2026-08-26T12:00:00.000Z",
                        updatedAt: "2026-08-26T12:00:00.000Z",
                        primaryProjectID: create.projectID
                    )
                )
                return (200, try encoder.encode(response))

            default:
                return (404, Data(#"{"error":"Unexpected test route."}"#.utf8))
            }
        }, for: host)

        let defaults = isolatedEntitlementDefaults()
        LocalEntitlementService.setDebugPlan(.pro, defaults: defaults)
        let store = try UserDataStore(databaseURL: databaseURL)
        let account = SignedInAccount(
            appUserID: "clerk:new-project-research",
            authProvider: .clerk,
            authProviderUserID: "new-project-research",
            appleUserID: "",
            displayName: "New Project Research",
            signedInAt: Date(),
            backendSessionToken: "test-token"
        )
        let transport = PermitextBackendHTTPTransport(
            baseURL: try XCTUnwrap(URL(string: "https://\(host)/")),
            session: session
        )
        let client = PermitextBackendClient(transport: transport)
        let model = CodeLibraryViewModel(
            userContentRepository: store,
            continuityStore: ContinuityStore(defaults: defaults),
            readerThemeStore: ReaderThemeStore(defaults: defaults),
            preferencesDefaults: defaults,
            entitlementService: LocalEntitlementService(defaults: defaults),
            accountBackendClient: client,
            syncBackend: client,
            loadsInitialContent: true,
            loadsPersistedAccount: false,
            initialSignedInAccount: account,
            ownsAccountSync: false
        )

        for _ in 0..<200 where !model.isInitialContentLoaded {
            try await Task.sleep(for: .milliseconds(50))
        }
        XCTAssertTrue(model.isInitialContentLoaded)
        let property = try await model.projectPropertyContext(address: "1760 Jerome Ave, Bronx")
        XCTAssertEqual(property.structuredFacts, importedFacts)
        let folder = try XCTUnwrap(
            model.createFolder(
                name: "Immediate Research Project",
                address: property.normalizedAddress,
                structuredFacts: property.structuredFacts
            )
        )
        XCTAssertNotEqual(folder.syncState, .synced)
        let projectID = try XCTUnwrap(model.backendProjectID(for: folder.id))

        let conversation = try await model.createResearchConversation(
            selections: [],
            projectID: projectID
        )

        XCTAssertEqual(conversation.primaryProjectID, projectID)
        XCTAssertEqual(model.folder(id: folder.id)?.syncState, .synced)
        XCTAssertEqual(
            recorder.snapshot().filter {
                $0 == "/projects/property/lookup" ||
                $0 == "/sync/push" ||
                $0 == "/research/conversations/create"
            },
            ["/projects/property/lookup", "/sync/push", "/research/conversations/create"]
        )
    }

    func testResearchAnswerDecodesCrossPlatformTrustAndContextDetails() throws {
        let data = Data(
            """
            {
              "mode": "openai",
              "answerText": "The enacted provision controls; DOB guidance is supporting context.",
              "conclusion": "The enacted provision controls.",
              "explanation": "DOB guidance is supporting context.",
              "codeEdition": "2022 NYC Construction Codes",
              "codeBasis": {
                "disclosure": "Sources searched: 2022 NYC Construction Codes",
                "limitation": "Zoning was not searched."
              },
              "sourceSummary": {
                "enactedProvisionCount": 2,
                "citedProvisionCount": 1,
                "supportingCitationCount": 1,
                "reviewedOnlyProvisionCount": 1,
                "supportingWebSourceCount": 1,
                "unresolvedProjectFactCount": 0
              },
              "factUsage": {
                "projectContext": ["Exterior wall assembly uses foam plastic."],
                "conversation": ["The building is fully sprinklered."],
                "other": []
              },
              "supportedPoints": [],
              "assumptions": [],
              "missingFacts": [],
              "evidenceLimitations": ["DOB guidance is noncontrolling."],
              "followUpQuestions": [],
              "additionalEvidenceNeeded": [],
              "supportingSources": [{
                "id": "web-source-bb-2022-013",
                "title": "Buildings Bulletin 2022-013",
                "publisher": "NYC Department of Buildings",
                "url": "https://www.nyc.gov/assets/buildings/bldgs_bulletins/bb_2022-013.pdf",
                "authorityClass": "official_guidance",
                "role": "supporting",
                "claim": "The bulletin discusses fireblocking in exterior wall assemblies."
              }],
              "citations": []
            }
            """.utf8
        )

        let answer = try JSONDecoder().decode(ResearchAnswer.self, from: data)

        XCTAssertEqual(answer.mode, "openai")
        XCTAssertEqual(answer.codeBasis?.disclosure, "Sources searched: 2022 NYC Construction Codes")
        XCTAssertEqual(answer.sourceSummary?.supportingWebSourceCount, 1)
        XCTAssertEqual(answer.factUsage?.projectContext?.first, "Exterior wall assembly uses foam plastic.")
        XCTAssertEqual(answer.factUsage?.conversation?.first, "The building is fully sprinklered.")
        XCTAssertEqual(answer.supportingSources?.first?.title, "Buildings Bulletin 2022-013")
        XCTAssertEqual(answer.supportingSources?.first?.claim, "The bulletin discusses fireblocking in exterior wall assemblies.")
        XCTAssertEqual(
            answer.supportingSources?.first?.webURL?.absoluteString,
            "https://www.nyc.gov/assets/buildings/bldgs_bulletins/bb_2022-013.pdf"
        )
        XCTAssertEqual(answer.supportingSources?.first?.displayTitle, "Buildings Bulletin 2022-013")
        XCTAssertEqual(
            answer.researchSourceBoundaryText,
            "Cited 1 enacted provision · 1 supporting citation · 1 additional provision reviewed · No unresolved project facts identified · 1 evidence limit"
        )
    }

    func testResearchConversationDecodesSharedV6ClientResponseContract() throws {
        let repositoryRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let fixtureURL = repositoryRoot
            .appendingPathComponent("permitext-sync-server/tests/fixtures/research-client-response-v1.json")
        let response = try JSONDecoder().decode(
            ResearchConversationMessageResponse.self,
            from: Data(contentsOf: fixtureURL)
        )
        let answer = try XCTUnwrap(response.conversation.messages.last?.answer)

        XCTAssertEqual(response.requestID, "request-contract-v1")
        XCTAssertEqual(answer.authorityStatus, "conditional")
        XCTAssertEqual(answer.authorityLabel, "Conditional on Project facts")
        XCTAssertEqual(answer.sourceAsOf, "2026-08-28T02:26:08.978Z")
        XCTAssertEqual(answer.factUsage?.projectContext, ["Occupancy: Group R-2"])
        XCTAssertEqual(answer.supportedPoints.first?.sourceIDs, ["passage-contract-v1"])
        XCTAssertEqual(answer.citations.first?.corpusID, "nyc-2022-construction-codes")
        XCTAssertEqual(answer.supportingSources?.first?.authorityClass, "official_guidance")
        XCTAssertEqual(answer.codeBasis?.searchedCorpora?.first?.applicabilityStatus, "current-enacted-edition")
        XCTAssertEqual(answer.codeBasis?.pinnedCorpora?.first?.applicabilityStatus, "historical")
        XCTAssertEqual(
            answer.researchCorpusMetadataLines,
            [
                "Searched · 2022 NYC Construction Codes · Edition: 2022 New York City Construction Codes · Applicability: Current enacted edition",
                "Explicit evidence · 1968 NYC Building Code · Edition: 1968 NYC Building Code — historical · Applicability: Historical"
            ]
        )

        let copied = answer.structuredCopyText(sourceStatus: response.conversation.sourceStatus)
        XCTAssertTrue(copied.contains("Corpus basis"))
        XCTAssertTrue(copied.contains("Applicability: Current enacted edition"))
        XCTAssertTrue(copied.contains("Conditional on Project facts"))
        XCTAssertTrue(copied.contains("Confirm the enclosure rating and material."))
        XCTAssertTrue(copied.contains("not an official interpretation"))
    }

    func testResearchAnswerProjectContextBoundaryAndSupportingSourceFallbacks() throws {
        let data = Data(
            """
            {
              "mode": "project_context",
              "conclusion": "The saved Project facts identify the property.",
              "explanation": "No enacted code conclusion was requested.",
              "sourceSummary": {
                "projectFactCount": 3,
                "sourcedProjectFactCount": 2,
                "unresolvedProjectFactCount": 0
              },
              "supportedPoints": [],
              "assumptions": [],
              "missingFacts": [],
              "evidenceLimitations": [],
              "followUpQuestions": [],
              "additionalEvidenceNeeded": [],
              "citations": []
            }
            """.utf8
        )

        let answer = try JSONDecoder().decode(ResearchAnswer.self, from: data)
        XCTAssertEqual(answer.sourceSummary?.projectFactCount, 3)
        XCTAssertEqual(answer.sourceSummary?.sourcedProjectFactCount, 2)
        XCTAssertEqual(
            answer.researchSourceBoundaryText,
            "Based on 3 saved Project facts · No unresolved project facts identified · No additional evidence limits identified"
        )

        let publisherFallback = ResearchSupportingSource(
            title: "  ",
            publisher: "NYC Department of Buildings",
            url: "ftp://example.com/not-allowed"
        )
        XCTAssertEqual(publisherFallback.displayTitle, "NYC Department of Buildings")
        XCTAssertNil(publisherFallback.webURL)

        let genericFallback = ResearchSupportingSource(title: "", publisher: "")
        XCTAssertEqual(genericFallback.displayTitle, "Supporting source")

        XCTAssertNil(ResearchSupportingSource(url: "http://www.nyc.gov/not-secure").webURL)
        XCTAssertEqual(
            ResearchSupportingSource(url: "https://www.nyc.gov/official").webURL?.absoluteString,
            "https://www.nyc.gov/official"
        )
    }

    func testResearchSourceDateUsesValidatedUTCDateAcrossPlatforms() {
        var answer = ResearchAnswer(
            mode: "openai",
            conclusion: "",
            explanation: "",
            supportedPoints: [],
            assumptions: [],
            missingFacts: [],
            evidenceLimitations: [],
            followUpQuestions: [],
            additionalEvidenceNeeded: [],
            citations: []
        )

        answer.sourceAsOf = "2026-08-25T23:30:00-04:00"
        XCTAssertEqual(answer.researchSourceDateLabel, "2026-08-26")

        answer.sourceAsOf = "2026-08-25T03:04:05.678Z"
        XCTAssertEqual(answer.researchSourceDateLabel, "2026-08-25")

        answer.sourceAsOf = "2026-08-25"
        XCTAssertEqual(answer.researchSourceDateLabel, "2026-08-25")

        answer.sourceAsOf = "not-a-date"
        XCTAssertNil(answer.researchSourceDateLabel)
    }

    func testResearchAnswerOfficialGuidanceBoundaryDoesNotClaimEnactedSupport() throws {
        let data = Data(
            """
            {
              "mode": "openai",
              "authorityStatus": "official_supporting_guidance",
              "authorityLabel": "Official supporting guidance — noncontrolling",
              "conclusion": "Official supporting guidance — noncontrolling and not an enacted-code conclusion.",
              "explanation": "- DOB guidance claim.",
              "sourceSummary": {
                "enactedProvisionCount": 16,
                "contextualProvisionCount": 4,
                "citedProvisionCount": 0,
                "supportingWebSourceCount": 4,
                "unresolvedProjectFactCount": 0
              },
              "supportedPoints": [],
              "assumptions": [],
              "missingFacts": [],
              "evidenceLimitations": ["The assembled enacted evidence did not establish the requested rule."],
              "followUpQuestions": [],
              "additionalEvidenceNeeded": [],
              "supportingSources": [{
                "id": "web-source-boiler",
                "title": "Boiler Compliance",
                "publisher": "NYC Department of Buildings",
                "url": "https://www.nyc.gov/site/buildings/safety/boiler-compliance.page",
                "authorityClass": "official_guidance",
                "role": "supporting",
                "claim": "DOB guidance claim."
              }],
              "citations": []
            }
            """.utf8
        )

        let answer = try JSONDecoder().decode(ResearchAnswer.self, from: data)
        XCTAssertEqual(
            answer.researchSourceBoundaryText,
            "Based on 1 approved official supporting source · No enacted provision cited · No unresolved project facts identified · 1 evidence limit"
        )
        XCTAssertEqual(answer.sourceSummary?.supportingWebSourceCount, 4)
        XCTAssertFalse(answer.researchSourceBoundaryText.contains("Based on 16 enacted provisions"))

        let duplicateFallbackData = Data(
            """
            {
              "mode": "openai",
              "authorityStatus": "official_supporting_guidance",
              "conclusion": "Official guidance only.",
              "explanation": "Two claims from one source.",
              "sourceSummary": {},
              "supportedPoints": [],
              "assumptions": [],
              "missingFacts": [],
              "evidenceLimitations": [],
              "followUpQuestions": [],
              "additionalEvidenceNeeded": [],
              "supportingSources": [
                { "url": "https://www.nyc.gov/same-source", "claim": "First claim." },
                { "url": "https://www.nyc.gov/same-source", "claim": "Second claim." }
              ],
              "citations": []
            }
            """.utf8
        )
        let duplicateFallbackAnswer = try JSONDecoder().decode(ResearchAnswer.self, from: duplicateFallbackData)
        XCTAssertEqual(
            duplicateFallbackAnswer.researchSourceBoundaryText,
            "Based on 1 approved official supporting source · No enacted provision cited · No unresolved project facts identified · No additional evidence limits identified"
        )
    }

    func testResearchFailureDistinguishesVerificationFromProviderFailure() {
        let verificationError = PermitextBackendHTTPError.serverStatus(
            502,
            "The research model could not return a verified, cited answer.",
            code: "RESEARCH_VERIFICATION_FAILED"
        )
        let providerError = PermitextBackendHTTPError.serverStatus(
            502,
            "The Research evidence-analysis request failed.",
            code: "RESEARCH_PROVIDER_ERROR"
        )
        let verifierProviderError = PermitextBackendHTTPError.serverStatus(
            502,
            "The Research verifier request failed.",
            code: "RESEARCH_VERIFIER_ERROR"
        )
        let officialGuidanceError = PermitextBackendHTTPError.serverStatus(
            502,
            "Unsafe server wording that the app must not show.",
            code: "RESEARCH_OFFICIAL_GUIDANCE_UNAVAILABLE"
        )

        XCTAssertEqual(
            ResearchRequestFailurePresentation.resolve(verificationError).message,
            "A Research model produced a response, but Permitext could not verify it against the enacted evidence. Your question is still here."
        )
        XCTAssertEqual(
            ResearchRequestFailurePresentation.resolve(providerError).message,
            "Permitext's Research service is temporarily unavailable. Your question is still here."
        )
        XCTAssertEqual(
            ResearchRequestFailurePresentation.resolve(verifierProviderError).message,
            "Permitext's Research service is temporarily unavailable. Your question is still here."
        )
        XCTAssertEqual(
            ResearchRequestFailurePresentation.resolve(officialGuidanceError).message,
            "Permitext could not retrieve attributable official guidance from the approved sources. Your question is still here."
        )
    }

    func testResearchFailurePreservesQuestionAfterNetworkTimeout() {
        XCTAssertEqual(
            ResearchRequestFailurePresentation.resolve(URLError(.timedOut)).message,
            "Research is taking longer than expected. Permitext checked for a completed answer but did not find one yet. Your question is still here."
        )
        XCTAssertEqual(
            ResearchRequestFailurePresentation.resolve(URLError(.cancelled)).message,
            "Research was cancelled. Your question is still here."
        )
    }

    func testResearchRequestCanCancelAndReconciledCompletionRefreshesAllowance() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let researchSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/ResearchView.swift"),
            encoding: .utf8
        )

        XCTAssertTrue(researchSource.contains("@State private var activeResearchRequestTask: Task<Void, Never>?"))
        XCTAssertTrue(researchSource.contains("Button(\"Cancel\", systemImage: \"xmark\")"))
        XCTAssertTrue(researchSource.contains(".accessibilityIdentifier(\"research-cancel-request\")"))
        XCTAssertTrue(researchSource.contains("activeResearchRequestTask?.cancel()"))
        XCTAssertTrue(researchSource.contains("try Task.checkCancellation()"))
        XCTAssertTrue(researchSource.contains("failedQuestionAttempt = attempt"))

        let reconciliationStart = try XCTUnwrap(
            researchSource.range(of: "if let authoritative = await completedConversationAfterLostResponse(")
        )
        let reconciliationEnd = try XCTUnwrap(
            researchSource.range(
                of: "} else {",
                range: reconciliationStart.upperBound..<researchSource.endIndex
            )
        )
        let reconciliationSource = String(
            researchSource[reconciliationStart.lowerBound..<reconciliationEnd.lowerBound]
        )
        XCTAssertTrue(reconciliationSource.contains("await library.refreshResearchTurnAllowance(showsErrors: false)"))
    }

    func testResearchRequestReconciliationRequiresMatchingRequestPair() {
        let messages = [
            ResearchMessage(
                id: "user-new",
                role: "user",
                question: "What are the requirements for a bike room?",
                requestID: "request-new",
                createdAt: "2026-08-17T12:00:00.000Z"
            ),
            ResearchMessage(
                id: "assistant-other",
                role: "assistant",
                answer: ResearchAnswer(conclusion: "An unrelated answer"),
                requestID: "request-other",
                createdAt: "2026-08-17T12:00:01.000Z"
            ),
            ResearchMessage(
                id: "assistant-new",
                role: "assistant",
                answer: ResearchAnswer(conclusion: "The verified answer"),
                requestID: "request-new",
                createdAt: "2026-08-17T12:00:02.000Z"
            )
        ]

        XCTAssertTrue(
            ResearchRequestReconciliation.matchesCompletedAttempt(
                messages: messages,
                requestID: "request-new",
                question: "What are the requirements for a bike room?",
                priorMessageIDs: []
            )
        )
        XCTAssertFalse(
            ResearchRequestReconciliation.matchesCompletedAttempt(
                messages: Array(messages.dropLast()),
                requestID: "request-new",
                question: "What are the requirements for a bike room?",
                priorMessageIDs: []
            )
        )
        XCTAssertTrue(
            ResearchRequestReconciliation.containsCompletedRequest(
                messages: messages,
                requestID: "request-new",
                question: "What are the requirements for a bike room?"
            )
        )
        XCTAssertFalse(
            ResearchRequestReconciliation.containsCompletedRequest(
                messages: Array(messages.dropLast()),
                requestID: "request-new",
                question: "What are the requirements for a bike room?"
            )
        )
    }

    func testResearchRequestReconciliationSupportsLegacyMessagesWithoutRequestID() {
        let messages = [
            ResearchMessage(
                id: "old",
                role: "assistant",
                answer: ResearchAnswer(conclusion: "Earlier answer"),
                createdAt: "2026-08-17T11:59:00.000Z"
            ),
            ResearchMessage(
                id: "user-new",
                role: "user",
                question: "What are the requirements for a bike room?",
                createdAt: "2026-08-17T12:00:00.000Z"
            ),
            ResearchMessage(
                id: "assistant-new",
                role: "assistant",
                answer: ResearchAnswer(conclusion: "The verified answer"),
                createdAt: "2026-08-17T12:00:01.000Z"
            )
        ]

        XCTAssertTrue(
            ResearchRequestReconciliation.matchesCompletedAttempt(
                messages: messages,
                requestID: "request-new",
                question: "What are the requirements for a bike room?",
                priorMessageIDs: ["old"]
            )
        )
    }

    func testResearchMessageResponseDecodesPublicRequestID() throws {
        let data = Data(
            """
            {
              "conversation": {
                "id": "research-1",
                "title": "Bike room requirements",
                "createdAt": "2026-08-17T12:00:00.000Z",
                "updatedAt": "2026-08-17T12:00:01.000Z",
                "projectContextReviewRequired": false,
                "sourceStatus": "current",
                "sources": [],
                "messages": [{
                  "id": "user-1",
                  "role": "user",
                  "question": "What are the requirements for a bike room?",
                  "requestID": "request-1",
                  "createdAt": "2026-08-17T12:00:00.000Z"
                }]
              },
              "replayed": true,
              "requestID": "request-1"
            }
            """.utf8
        )

        let decoded = try JSONDecoder().decode(ResearchConversationMessageResponse.self, from: data)

        XCTAssertEqual(decoded.requestID, "request-1")
        XCTAssertEqual(decoded.conversation.messages.first?.requestID, "request-1")
        XCTAssertEqual(decoded.replayed, true)
    }

    func testResearchAnswerRetainsTrustAndCitationBindings() throws {
        let data = Data(
            """
            {
              "answerText": "The cited provision governs.",
              "conclusion": "The cited provision governs.",
              "explanation": "The condition applies when the stated facts are true.",
              "supportedPoints": [{
                "heading": "The limit applies",
                "explanation": "The selected passage states the controlling limit.",
                "sectionID": "101",
                "sourceIDs": ["passage-101"],
                "evidenceRole": "governing"
              }],
              "assumptions": ["The occupancy is Group B."],
              "missingFacts": ["Confirm the actual occupant load."],
              "evidenceLimitations": ["Only the cited enacted provisions were reviewed."],
              "followUpQuestions": ["What is the occupant load?"],
              "additionalEvidenceNeeded": ["Add the applicable table."],
              "citations": [{
                "sourceID": "legacy-source-binding",
                "sectionID": "101",
                "sourceIDs": ["passage-101"],
                "codePrefix": "BC",
                "sectionNumber": "101.2",
                "title": "Scope",
                "evidenceRole": "governing",
                "relevance": "Controls the scope question.",
                "codeVersion": "2022 Construction Codes",
                "codeEdition": "2022",
                "corpusID": "nyc-construction",
                "corpusLabel": "NYC Construction Codes",
                "applicabilityStatus": "current"
              }]
            }
            """.utf8
        )

        let answer = try JSONDecoder().decode(ResearchAnswer.self, from: data)
        let point = try XCTUnwrap(answer.supportedPoints.first)
        let citation = try XCTUnwrap(answer.citations.first)

        XCTAssertEqual(point.explanation, "The selected passage states the controlling limit.")
        XCTAssertEqual(point.sectionID, "101")
        XCTAssertEqual(point.sourceIDs, ["passage-101"])
        XCTAssertEqual(citation.sectionID, "101")
        XCTAssertEqual(citation.sourceIDs, ["passage-101"])
        XCTAssertEqual(citation.relevance, "Controls the scope question.")
        XCTAssertEqual(citation.codeVersion, "2022 Construction Codes")
        XCTAssertEqual(citation.corpusLabel, "NYC Construction Codes")
        XCTAssertTrue(citation.id.contains("101"))
        XCTAssertTrue(citation.id.contains("passage-101"))
        XCTAssertNotEqual(citation.id, "legacy-source-binding")
    }

    func testLegacyResearchCitationStillDecodesWithoutSourceBindings() throws {
        let data = Data(
            """
            {
              "codePrefix": "BC",
              "sectionNumber": "101.2",
              "title": "Scope"
            }
            """.utf8
        )

        let citation = try JSONDecoder().decode(ResearchCitation.self, from: data)

        XCTAssertNil(citation.sectionID)
        XCTAssertNil(citation.sourceIDs)
        XCTAssertEqual(citation.id, "BC:101.2:Scope")
    }

    func testResearchProjectContextRetainsFactsForReview() throws {
        let data = Data(
            """
            {
              "id": "conversation-1",
              "title": "Exit width review",
              "createdAt": "2026-08-20T12:00:00.000Z",
              "updatedAt": "2026-08-20T12:05:00.000Z",
              "primaryProjectID": "project-1",
              "projectContext": {
                "projectID": "project-1",
                "facts": ["Occupancy is Group B", "Building is six stories"],
                "source": "user-provided",
                "updatedAt": "2026-08-20T12:04:00.000Z"
              },
              "projectContextReviewRequired": true,
              "sourceStatus": "current",
              "sources": [],
              "messages": []
            }
            """.utf8
        )

        let conversation = try JSONDecoder().decode(ResearchConversation.self, from: data)

        XCTAssertEqual(conversation.projectContext?.projectID, "project-1")
        XCTAssertEqual(
            conversation.projectContext?.facts,
            ["Occupancy is Group B", "Building is six stories"]
        )
        XCTAssertTrue(conversation.projectContextReviewRequired)
    }

    @MainActor
    func testResearchCitationNavigationSelectsVersionSectionAndSearch() {
        let model = CodeLibraryViewModel.preview()

        model.openResearchCitation(sectionID: 101, codeVersion: "2022 Construction Codes")

        XCTAssertEqual(model.selectedVersion?.codeVersion, "2022 Construction Codes")
        XCTAssertEqual(model.pendingDeepLinkedSectionID, 101)
        XCTAssertEqual(model.selectedTab, .search)
    }

    func testNativeNotebookSimpleDocumentRoundTripsWithoutLosingReferencesOrImages() throws {
        let document = NotebookDocument(document: [
            NotebookBlock.textBlock(type: "heading", text: "Finding", level: 2),
            NotebookBlock(
                id: "paragraph-1",
                type: "paragraph",
                props: .text,
                content: [
                    .text("Enacted text", bold: true),
                    NotebookInlineContent(
                        type: "link",
                        href: "https://example.com/source",
                        content: [.text("Source", italic: true)]
                    )
                ],
                children: []
            ),
            NotebookBlock.textBlock(type: "bulletListItem", text: "Verify occupancy"),
            NotebookBlock.reference(
                kind: "canonicalSection",
                id: "section-101-2",
                label: "Building Code · § 101.2 · Scope"
            ),
            NotebookBlock.image(
                url: "/notebook/assets/read?projectID=project-1&assetID=image-1",
                name: "site-photo.jpg",
                caption: "Existing condition",
                width: 1200
            )
        ])

        let decoded = try JSONDecoder().decode(
            NotebookDocument.self,
            from: JSONEncoder().encode(document)
        )

        XCTAssertEqual(decoded, document)
        XCTAssertEqual(decoded.document.map(\.type), [
            "heading", "paragraph", "bulletListItem", "paragraph", "image"
        ])
        XCTAssertEqual(decoded.document[1].content?[1].href, "https://example.com/source")
        XCTAssertEqual(decoded.document[3].content?.first?.props?.referenceKind, "canonicalSection")
        XCTAssertEqual(decoded.document[4].props.caption, "Existing condition")
    }

    func testResearchTurnAllowanceDecodesServerContract() throws {
        let data = Data(
            """
            {
              "usage": {
                "includedLimit": 100,
                "includedUsed": 100,
                "includedRemaining": 0,
                "purchasedRemaining": 25,
                "totalRemaining": 25,
                "periodStart": "2026-08-01T00:00:00Z",
                "resetsAt": "2026-09-01T00:00:00Z",
                "canResearch": true,
                "purchaseRequired": false,
                "paidContinuationEnabled": true,
                "canBuyMore": true,
                "packs": [
                  {
                    "id": "research_25",
                    "turns": 25,
                    "webAvailable": true,
                    "appleProductID": "com.randycodex.permitext.research.turns.25"
                  }
                ],
                "mockMode": false,
                "evidenceDiscoveryEnabled": true
              }
            }
            """.utf8
        )
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let response = try decoder.decode(BackendResearchUsageResponse.self, from: data)

        XCTAssertEqual(response.usage.includedLimit, 100)
        XCTAssertEqual(response.usage.includedRemaining, 0)
        XCTAssertEqual(response.usage.purchasedRemaining, 25)
        XCTAssertTrue(response.usage.canResearch)
        XCTAssertTrue(response.usage.paidContinuationEnabled)
        XCTAssertEqual(response.usage.packs.first?.appleProductID, StoreKitProductID.researchTurns25)
    }

    func testResearchTurnStoreKitConfigContainsOnlyLocalTestConsumables() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let configurationURL = projectRoot.appendingPathComponent("permitext/Resources/Permitext.storekit")
        let object = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: Data(contentsOf: configurationURL)) as? [String: Any]
        )
        let products = try XCTUnwrap(object["products"] as? [[String: Any]])
        let productsByID = Dictionary(
            uniqueKeysWithValues: products.compactMap { product -> (String, [String: Any])? in
                guard let productID = product["productID"] as? String else { return nil }
                return (productID, product)
            }
        )

        for productID in StoreKitProductID.researchTurnPacks {
            let product = try XCTUnwrap(productsByID[productID])
            XCTAssertEqual(product["type"] as? String, "Consumable")
            XCTAssertEqual(product["displayPrice"] as? String, "0.99")
            XCTAssertTrue((product["referenceName"] as? String)?.contains("Local Test") == true)
        }
    }

    func testResearchTurnPurchaseRequiresServerAcknowledgementBeforeStoreKitFinish() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let modelSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Models/CodeModels.swift"),
            encoding: .utf8
        )
        let viewModelSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/ViewModels/CodeLibraryViewModel.swift"),
            encoding: .utf8
        )
        let settingsSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/SettingsView.swift"),
            encoding: .utf8
        )
        let researchSource = try String(
            contentsOf: projectRoot.appendingPathComponent("permitext/Views/ResearchView.swift"),
            encoding: .utf8
        )

        XCTAssertTrue(modelSource.contains("post(\"billing/apple/account-token\""))
        XCTAssertTrue(modelSource.contains("post(\"billing/apple/transactions/verify\""))
        XCTAssertTrue(modelSource.contains("post(\"research/usage\""))
        XCTAssertTrue(viewModelSource.contains("options: [.appAccountToken(resolvedAccountToken)]"))

        let processingStart = try XCTUnwrap(
            viewModelSource.range(of: "private func processResearchTurnPurchase(")
        )
        let processingEnd = try XCTUnwrap(
            viewModelSource.range(
                of: "private func clearResearchTurnState()",
                range: processingStart.upperBound..<viewModelSource.endIndex
            )
        )
        let processingSource = String(
            viewModelSource[processingStart.lowerBound..<processingEnd.lowerBound]
        )
        let verification = try XCTUnwrap(
            processingSource.range(of: "verifyAppleResearchTurnPurchase(")
        )
        let acknowledgement = try XCTUnwrap(
            processingSource.range(of: "response.credited == true || response.replayed == true")
        )
        let finish = try XCTUnwrap(
            processingSource.range(of: "storeKitResearchTurnService.finish(purchase)")
        )
        XCTAssertLessThan(verification.lowerBound, acknowledgement.lowerBound)
        XCTAssertLessThan(acknowledgement.lowerBound, finish.lowerBound)
        XCTAssertTrue(processingSource.contains("backendError.serverCode == \"RESEARCH_PURCHASE_ALREADY_LINKED\""))
        XCTAssertFalse(processingSource.contains("backendError.statusCode == 409 {"))
        XCTAssertTrue(processingSource.contains("This Apple purchase is already linked to another Permitext account."))

        XCTAssertTrue(settingsSource.contains("Research turns"))
        XCTAssertTrue(settingsSource.contains("Need more Research? Additional turns do not expire and are used after the monthly included turns."))
        XCTAssertTrue(settingsSource.contains("if !library.availableResearchTurnPacks.isEmpty"))
        XCTAssertTrue(settingsSource.contains("Unused additional Research turns (they are forfeited and are not automatically refunded)"))
        XCTAssertTrue(researchSource.contains("You have used this month's included Research turns. Buy more turns to continue; your question is still here."))
        XCTAssertTrue(researchSource.contains("Additional Research turns are temporarily unavailable. Your question is still here. Try again later."))
    }
}

final class NativeReaderPhase3ContractTests: XCTestCase {
    private var corpusRootURL: URL {
        guard let resourceURL = Bundle.main.resourceURL else {
            preconditionFailure("The host app must expose its bundled resources.")
        }
        return resourceURL
            .appendingPathComponent("CodeContent", isDirectory: true)
            .appendingPathComponent("authored", isDirectory: true)
            .appendingPathComponent("new-york-city", isDirectory: true)
    }

    func testDebugPilotRoutesAndLoadsValidatedPhaseThreeAndFourDocuments() async throws {
        let store = NativeReaderDocumentStore(corpusRootURL: corpusRootURL)
        XCTAssertEqual(NativeReaderDocumentStore.debugPilotSourcePaths.count, 8)

        for sourcePath in NativeReaderDocumentStore.debugPilotSourcePaths.sorted() {
            let sourceURL = corpusRootURL.appendingPathComponent(sourcePath)
            let resolvedRoute = await store.debugRoute(for: sourceURL)
            let route = try XCTUnwrap(resolvedRoute, sourcePath)
            let document = try await store.loadDocument(for: route)

            XCTAssertEqual(document.documentID, route.documentID)
            XCTAssertEqual(document.sourcePath, sourcePath)
            XCTAssertTrue(document.isValidatedNativeContent)
            XCTAssertFalse(document.blocks.isEmpty)
            XCTAssertFalse(document.blocks.contains { $0.kind == .unsupportedHTML })
            if sourcePath != "2026-zoning-resolution/chapters/APP-D-21241.html" {
                XCTAssertFalse(document.blocks.contains { $0.kind == .table })
            }
        }

        let eligibleButNotPiloted = corpusRootURL
            .appendingPathComponent("2026-existing-building-code/chapters/2.html")
        let ineligibleRoute = await store.debugRoute(for: eligibleButNotPiloted)
        XCTAssertNil(ineligibleRoute)
    }

    func testPhaseNineAllEligibleDocumentsPassSemanticAndAssetParity() async throws {
        let store = NativeReaderDocumentStore(corpusRootURL: corpusRootURL)
        let sourcePaths = await store.debugValidatedSourcePaths()

        XCTAssertEqual(sourcePaths.count, 463)
        XCTAssertEqual(Set(sourcePaths.map { $0.split(separator: "/").first.map(String.init) }), [
            "2022-construction-codes",
            "2025-specialty-codes",
            "2026-enacted-administrative-code",
            "2026-existing-building-code",
            "2026-zoning-resolution"
        ])

        for sourcePath in sourcePaths {
            let resolvedRoute = await store.debugValidatedRoute(
                forRelativeSourcePath: sourcePath
            )
            let route = try XCTUnwrap(
                resolvedRoute,
                sourcePath
            )
            let document = try await store.loadDocument(for: route)
            let indexedRolloutTier = await store.debugRolloutTier(
                forRelativeSourcePath: sourcePath
            )

            XCTAssertEqual(document.sourcePath, sourcePath)
            XCTAssertEqual(indexedRolloutTier, document.rolloutTier, sourcePath)
            XCTAssertTrue(document.isValidatedNativeContent, sourcePath)
            XCTAssertTrue(document.validation.normalizedTextMatches, sourcePath)
            XCTAssertTrue(document.validation.anchorSequenceMatches, sourcePath)
            XCTAssertTrue(document.validation.linkTargetsMatch, sourcePath)
            XCTAssertTrue(document.validation.tableStructuresMatch, sourcePath)
            XCTAssertTrue(document.validation.imageInventoryMatches, sourcePath)
            XCTAssertEqual(document.validation.unsupportedBlockCount, 0, sourcePath)
            XCTAssertFalse(document.blocks.contains { $0.kind == .unsupportedHTML }, sourcePath)
            let renderedText = document.blocks.map(\.plainText).joined(separator: " ")
            XCTAssertFalse(renderedText.contains("â"), "UTF-8 mojibake: \(sourcePath)")
            XCTAssertFalse(renderedText.contains("Ã"), "UTF-8 mojibake: \(sourcePath)")
            XCTAssertFalse(renderedText.contains("Â"), "UTF-8 mojibake: \(sourcePath)")

            for table in document.blocks.compactMap(\.table) {
                XCTAssertEqual(table.structureSHA256.count, 64, "\(sourcePath): \(table.id)")
                XCTAssertEqual(Set(table.cells.map(\.id)).count, table.cells.count, sourcePath)
                if table.renderingClassification == .isolatedHTML {
                    XCTAssertTrue(table.sourceHTML?.localizedCaseInsensitiveContains("<table") == true, sourcePath)
                }
            }

            for media in document.blocks.flatMap(\.media) {
                if media.assetExists {
                    let assetURL = try XCTUnwrap(
                        NativeReaderDocumentStore.resolvedMediaURL(for: media, route: route),
                        "\(sourcePath): \(media.id)"
                    )
                    let assetData = try Data(contentsOf: assetURL, options: [.mappedIfSafe])
                    XCTAssertNotNil(
                        UIImage(data: assetData),
                        "Bundled media must decode: \(sourcePath): \(assetURL.lastPathComponent)"
                    )
                } else {
                    XCTAssertNil(media.assetSHA256, sourcePath)
                    XCTAssertNil(
                        NativeReaderDocumentStore.resolvedMediaURL(for: media, route: route),
                        sourcePath
                    )
                }
            }
        }
    }

    func testUniversalNativeRoutingCoversEveryKnownCodeCollectionAndFormerFallback() async throws {
        let store = NativeReaderDocumentStore(corpusRootURL: corpusRootURL)
        let representativePaths = [
            "2022-construction-codes/chapters/1.html",
            "2025-specialty-codes/chapters/32000001.html",
            "2026-enacted-administrative-code/chapters/30000001.html",
            "2026-existing-building-code/chapters/1.html",
            "2026-zoning-resolution/chapters/APP-B-21239.html"
        ]

        for sourcePath in representativePaths {
            let resolvedRoute = await store.debugValidatedRoute(
                forRelativeSourcePath: sourcePath
            )
            let route = try XCTUnwrap(
                resolvedRoute,
                sourcePath
            )
            let document = try await store.loadDocument(for: route)
            XCTAssertTrue(document.isValidatedNativeContent, sourcePath)
            XCTAssertFalse(document.blocks.isEmpty, sourcePath)
        }

        let formerlyUnsupportedPath = "2026-zoning-resolution/chapters/APP-C-21242.html"
        let formerlyUnsupportedRoute = await store.debugValidatedRoute(
            forRelativeSourcePath: formerlyUnsupportedPath
        )
        let route = try XCTUnwrap(formerlyUnsupportedRoute)
        let document = try await store.loadDocument(for: route)
        XCTAssertTrue(document.isValidatedNativeContent)
        XCTAssertTrue(document.blocks.contains {
            $0.table?.renderingClassification == .isolatedHTML
        })
    }

    func testPhaseNineVisualSnapshotManifestCoversRequiredTraitMatrix() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let checkoutMarker = projectRoot
            .appendingPathComponent("permitext/Views/NativeChapterTextReaderView.swift")

        // Physical-device test processes cannot read the Mac checkout. The
        // simulator suite validates the committed screenshots and manifest.
        guard FileManager.default.fileExists(atPath: checkoutMarker.path) else { return }

        let phaseNineRoot = projectRoot
            .appendingPathComponent("docs/native-reader/phase-9", isDirectory: true)
        let manifestURL = phaseNineRoot.appendingPathComponent("visual-snapshot-manifest.json")
        let manifestData = try Data(contentsOf: manifestURL)
        let manifest = try XCTUnwrap(
            JSONSerialization.jsonObject(with: manifestData) as? [String: Any]
        )
        let items = try XCTUnwrap(manifest["items"] as? [[String: Any]])

        XCTAssertEqual(manifest["schemaVersion"] as? Int, 1)
        XCTAssertEqual(
            manifest["corpusSHA256"] as? String,
            "0709f1f425bd47b29fe89543cb604065c511802869ea6c08c6181273b5c49d88"
        )
        XCTAssertEqual(manifest["parserSchemaVersion"] as? String, "native-reader-document-v2")
        XCTAssertEqual(items.count, 5)
        XCTAssertEqual(Set(items.compactMap { $0["collection"] as? String }), [
            "2022-construction-codes",
            "2025-specialty-codes",
            "2026-enacted-administrative-code",
            "2026-existing-building-code",
            "2026-zoning-resolution"
        ])
        XCTAssertEqual(Set(items.compactMap { $0["appearance"] as? String }), ["light", "dark"])
        XCTAssertEqual(Set(items.compactMap { $0["orientation"] as? String }), ["portrait", "landscape"])
        XCTAssertEqual(Set(items.compactMap { $0["effectiveWidth"] as? Int }), [320, 375, 402, 720])
        XCTAssertTrue(
            items.contains { ($0["contentSize"] as? String) == "accessibility-extra-extra-extra-large" }
        )

        for item in items {
            let fileName = try XCTUnwrap(item["file"] as? String)
            let expectedHash = try XCTUnwrap(item["sha256"] as? String)
            let screenshotURL = phaseNineRoot
                .appendingPathComponent("screenshots", isDirectory: true)
                .appendingPathComponent(fileName)
            let screenshotData = try Data(contentsOf: screenshotURL)
            let actualHash = SHA256.hash(data: screenshotData)
                .map { String(format: "%02x", $0) }
                .joined()

            XCTAssertEqual(item["reviewStatus"] as? String, "reviewed", fileName)
            XCTAssertEqual(actualHash, expectedHash, fileName)
            XCTAssertGreaterThan(screenshotData.count, 50_000, fileName)
        }
    }

    func testPhaseTenFeatureFlagDefaultsInternalDebugToNativeAndFailsClosed() {
        XCTAssertEqual(
            NativeReaderRolloutPolicy.resolvedStage(arguments: ["permitext"]),
            .isolatedTableFallback
        )
        XCTAssertEqual(
            NativeReaderRolloutPolicy.resolvedStage(
                arguments: ["permitext"],
                bundledValue: "media"
            ),
            .media
        )
        XCTAssertEqual(
            NativeReaderRolloutPolicy.resolvedStage(
                arguments: [
                    "permitext",
                    NativeReaderRolloutPolicy.stageArgument,
                    "text-only"
                ],
                bundledValue: "off"
            ),
            .textOnly
        )
        XCTAssertEqual(
            NativeReaderRolloutPolicy.resolvedStage(
                arguments: ["permitext"],
                bundledValue: "unknown-stage"
            ),
            .disabled
        )
        for stage in NativeReaderRolloutStage.allCases {
            XCTAssertEqual(
                NativeReaderRolloutPolicy.resolvedStage(arguments: [
                    "permitext",
                    NativeReaderRolloutPolicy.stageArgument,
                    stage.featureFlagValue
                ]),
                stage
            )
        }
        XCTAssertEqual(
            NativeReaderRolloutPolicy.resolvedStage(arguments: [
                "permitext",
                NativeReaderRolloutPolicy.stageArgument,
                "unknown-stage"
            ]),
            .disabled
        )
        XCTAssertFalse(NativeReaderRolloutStage.media.includes(.nativeTable))
        XCTAssertTrue(NativeReaderRolloutStage.nativeTable.includes(.nativeTable))
        XCTAssertFalse(NativeReaderRolloutStage.nativeTable.includes(.isolatedTableFallback))
        XCTAssertEqual(
            NativeReaderRolloutPolicy.resolvedStage(arguments: [
                "permitext",
                NativeReaderRolloutPolicy.stageArgument
            ]),
            .disabled
        )
    }

    func testPhaseTenRolloutStagesAreMonotonicAndCoverEveryValidatedTier() async throws {
        let store = NativeReaderDocumentStore(corpusRootURL: corpusRootURL)
        let stages: [NativeReaderRolloutStage] = [
            .textOnly,
            .media,
            .nativeTable,
            .isolatedTableFallback
        ]
        var previousPaths: Set<String> = []
        var observedTiers: Set<NativeReaderRolloutTier> = []
        var rolloutCounts: [Int] = []

        let disabledPaths = await store.debugRolloutSourcePaths(for: .disabled)
        XCTAssertTrue(disabledPaths.isEmpty)

        for stage in stages {
            let paths = Set(await store.debugRolloutSourcePaths(for: stage))
            rolloutCounts.append(paths.count)
            XCTAssertTrue(paths.isSuperset(of: previousPaths), stage.featureFlagValue)
            XCTAssertGreaterThanOrEqual(paths.count, previousPaths.count, stage.featureFlagValue)
            for path in paths {
                let resolvedTier = await store.debugRolloutTier(
                    forRelativeSourcePath: path
                )
                let tier = try XCTUnwrap(
                    resolvedTier,
                    path
                )
                XCTAssertTrue(stage.includes(tier), path)
                observedTiers.insert(tier)
            }
            previousPaths = paths
        }

        XCTAssertEqual(observedTiers, [.textOnly, .media, .isolatedTableFallback])
        XCTAssertEqual(rolloutCounts, [287, 312, 312, 463])
        let allValidatedPaths = await store.debugValidatedSourcePaths()
        XCTAssertEqual(
            previousPaths,
            Set(allValidatedPaths)
        )
    }

    func testPhaseTenRoutingHonorsEveryStageAndKeepsUnknownContentOnHTML() async throws {
        let store = NativeReaderDocumentStore(corpusRootURL: corpusRootURL)
        let allPaths = await store.debugValidatedSourcePaths()
        var representativePathByTier: [NativeReaderRolloutTier: String] = [:]
        for path in allPaths where representativePathByTier.count < NativeReaderRolloutTier.allCases.count {
            if let tier = await store.debugRolloutTier(forRelativeSourcePath: path),
               representativePathByTier[tier] == nil {
                representativePathByTier[tier] = path
            }
        }

        let observedTiers: Set<NativeReaderRolloutTier> = [
            .textOnly,
            .media,
            .isolatedTableFallback
        ]
        XCTAssertEqual(Set(representativePathByTier.keys), observedTiers)
        for tier in observedTiers {
            let path = try XCTUnwrap(representativePathByTier[tier])
            let sourceURL = corpusRootURL.appendingPathComponent(path)
            for stage in NativeReaderRolloutStage.allCases {
                let route = await store.rolloutRoute(for: sourceURL, stage: stage)
                XCTAssertEqual(route != nil, stage.includes(tier), "\(stage.featureFlagValue): \(path)")
            }
        }

        let unknownSourceURL = corpusRootURL.appendingPathComponent(
            "unknown-package/chapters/not-indexed.html"
        )
        let unknownRoute = await store.rolloutRoute(
            for: unknownSourceURL,
            stage: .isolatedTableFallback
        )
        XCTAssertNil(unknownRoute)
    }

    func testPhaseElevenBuildFlagsMakeValidatedNativeDefaultAndRetainHTMLFallback() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let projectURL = projectRoot.appendingPathComponent(
            "NYC CC APP.xcodeproj/project.pbxproj"
        )
        guard FileManager.default.fileExists(atPath: projectURL.path) else { return }

        let projectSource = try String(contentsOf: projectURL, encoding: .utf8)
        let readerSource = try String(
            contentsOf: projectRoot.appendingPathComponent(
                "permitext/Views/ChapterHTMLReaderView.swift"
            ),
            encoding: .utf8
        )
        let infoData = try Data(
            contentsOf: projectRoot.appendingPathComponent("permitext/Info.plist")
        )
        let info = try XCTUnwrap(
            PropertyListSerialization.propertyList(from: infoData, format: nil)
                as? [String: Any]
        )

        XCTAssertEqual(
            info[NativeReaderRolloutPolicy.infoPlistKey] as? String,
            "$(NATIVE_READER_ROLLOUT_STAGE)"
        )
        XCTAssertEqual(
            projectSource.components(
                separatedBy: "NATIVE_READER_ROLLOUT_STAGE = \"isolated-table-fallback\";"
            ).count - 1,
            2
        )
        XCTAssertFalse(projectSource.contains("NATIVE_READER_ROLLOUT_STAGE = off;"))
        XCTAssertTrue(readerSource.contains("Native (Default)"))
        XCTAssertTrue(readerSource.contains("HTML (Diagnostic)"))
        XCTAssertTrue(
            readerSource.contains(
                "#if DEBUG\n                if NativeReaderRolloutPolicy.activeStage != .disabled {\n                    readerDiagnosticSelector\n                }\n#endif"
            )
        )
        XCTAssertTrue(
            readerSource.contains(
                "readerPresentation = .html\n#if DEBUG\n                            nativeReaderFallbackMessage = message\n#endif"
            )
        )
        XCTAssertTrue(
            readerSource.contains(
                "#if DEBUG\n        .alert(\n            \"Native reader used HTML fallback\""
            )
        )
        XCTAssertTrue(
            readerSource.contains(
                "NativeReaderRolloutPolicy.activeStage != .disabled"
            )
        )
    }

    func testNativeReaderScrollPersistenceIsDebouncedAndTextRowsKeepStableIdentity() throws {
        let projectRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let nativeReaderURL = projectRoot
            .appendingPathComponent("permitext/Views/NativeChapterTextReaderView.swift")
        let attributedTextURL = projectRoot
            .appendingPathComponent("permitext/Views/AttributedTextView.swift")

        // Source contracts run in the simulator checkout. Physical-device
        // tests still exercise the compiled implementation.
        guard FileManager.default.fileExists(atPath: nativeReaderURL.path) else { return }
        let nativeReaderSource = try String(contentsOf: nativeReaderURL, encoding: .utf8)
        let attributedTextSource = try String(contentsOf: attributedTextURL, encoding: .utf8)

        XCTAssertTrue(nativeReaderSource.contains("scheduleSettledScrollWork"))
        XCTAssertTrue(nativeReaderSource.contains("Task.sleep(for: .milliseconds(250))"))
        XCTAssertTrue(nativeReaderSource.contains(".onScrollPhaseChange"))
        XCTAssertTrue(nativeReaderSource.contains("guard !scrollState.isScrollActive"))
        XCTAssertTrue(nativeReaderSource.contains("phase == .decelerating"))
        XCTAssertFalse(nativeReaderSource.contains("NativeReaderModernScrollPositionModifier"))
        XCTAssertFalse(nativeReaderSource.contains(".scrollPosition($scrollPosition)"))
        XCTAssertTrue(nativeReaderSource.contains(".equatable()"))
        XCTAssertTrue(nativeReaderSource.contains("NativeReaderTextBlockView: View, Equatable"))
        XCTAssertTrue(nativeReaderSource.contains("attributedText: baseAttributedText"))
        XCTAssertTrue(nativeReaderSource.contains("cache.countLimit = 256"))
        XCTAssertTrue(nativeReaderSource.contains("cache.totalCostLimit = 24 * 1024 * 1024"))
        XCTAssertFalse(nativeReaderSource.contains(".onScrollTargetVisibilityChange"))
        XCTAssertTrue(nativeReaderSource.contains("NativeReaderBlockOffsetModifier"))
        XCTAssertTrue(nativeReaderSource.contains("NativeReaderVisibleBlockResolver.topBlockID"))
        XCTAssertTrue(nativeReaderSource.contains(".opacity(pendingInitialBlockID == nil ? 1 : 0)"))
        XCTAssertTrue(nativeReaderSource.contains(".allowsHitTesting(pendingInitialBlockID == nil)"))
        XCTAssertTrue(nativeReaderSource.contains("transaction.animation = nil"))
        XCTAssertTrue(nativeReaderSource.contains("if pendingInitialBlockID != nil"))
        XCTAssertFalse(nativeReaderSource.contains(".scrollPosition(id: $visibleBlockID"))
        XCTAssertFalse(nativeReaderSource.contains("Text(fallbackText)"))
        XCTAssertTrue(nativeReaderSource.contains("NativeReaderAttributedTextPrefetchPlanner.indexRange"))
        XCTAssertTrue(nativeReaderSource.contains("Task.detached(priority: .utility)"))
        XCTAssertTrue(nativeReaderSource.contains("aheadCount: Int = 24"))
        XCTAssertTrue(attributedTextSource.contains("let id: Int"))
        XCTAssertFalse(attributedTextSource.contains("let id = UUID()"))
        XCTAssertTrue(attributedTextSource.contains("requiresTextUpdate"))
        XCTAssertTrue(attributedTextSource.contains("cachedMeasuredSize"))
        XCTAssertTrue(attributedTextSource.contains("guard !attachments.isEmpty else { return attributedText }"))
    }

    func testNativeReaderVisibleBlockResolutionObservesWithoutReassertingScrollPosition() {
        XCTAssertEqual(
            NativeReaderVisibleBlockResolver.topBlockID(
                from: ["previous": -24, "current": 8, "next": 90],
                threshold: 10
            ),
            "current"
        )
        XCTAssertEqual(
            NativeReaderVisibleBlockResolver.topBlockID(
                from: ["first": 24, "second": 90],
                threshold: 10
            ),
            "first"
        )
        XCTAssertNil(
            NativeReaderVisibleBlockResolver.topBlockID(from: [:], threshold: 10)
        )
    }

    func testNativeReaderTextPrefetchWindowIsBoundedAndDirectional() {
        XCTAssertEqual(
            NativeReaderAttributedTextPrefetchPlanner.indexRange(
                blockCount: 100,
                centerIndex: 10,
                direction: 1
            ),
            6..<35
        )
        XCTAssertEqual(
            NativeReaderAttributedTextPrefetchPlanner.indexRange(
                blockCount: 100,
                centerIndex: 10,
                direction: -1
            ),
            0..<15
        )
        XCTAssertEqual(
            NativeReaderAttributedTextPrefetchPlanner.indexRange(
                blockCount: 100,
                centerIndex: 98,
                direction: 1
            ),
            94..<100
        )
        XCTAssertEqual(
            NativeReaderAttributedTextPrefetchPlanner.indexRange(
                blockCount: 0,
                centerIndex: 0,
                direction: 1
            ),
            0..<0
        )
    }

    func testNativeReaderNearbyTextPrewarmsTheBoundedFinalCache() async throws {
        let cache = NativeReaderAttributedTextCache.shared
        cache.removeAll()
        defer { cache.removeAll() }
        let cacheID = "prefetched-row"
        let theme = ReaderTheme.default
        let accentColor = UIColor.systemBlue
        await cache.prewarm(
            items: [
                NativeReaderAttributedTextPrefetchItem(
                    cacheID: cacheID,
                    runs: [
                        NativeReaderRuntimeTextRun(
                            text: "PREFETCHED",
                            styles: [.bold],
                            linkTarget: nil
                        )
                    ],
                    fallbackText: "",
                    role: .body
                )
            ],
            theme: theme,
            accentColor: accentColor
        )

        let cached = cache.baseAttributedText(
            cacheKey: NativeReaderAttributedTextCacheKey.base(
                cacheID: cacheID,
                theme: theme,
                accentColor: accentColor
            ),
            runs: [],
            fallbackText: "cache miss",
            theme: theme,
            role: .note,
            accentColor: .systemRed
        )
        XCTAssertEqual(cached.string, "PREFETCHED")
    }

    func testNativeReaderNormalRowsUseFinalBoundedAttributedTextImmediately() throws {
        let cache = NativeReaderAttributedTextCache.shared
        cache.removeAll()
        defer { cache.removeAll() }
        let cacheKey = "final-row-typography"
        let first = cache.baseAttributedText(
            cacheKey: cacheKey,
            runs: [
                NativeReaderRuntimeTextRun(
                    text: "SECTION 101",
                    styles: [.bold],
                    linkTarget: nil
                )
            ],
            fallbackText: "",
            theme: .default,
            role: .majorHeading(level: 2),
            accentColor: .systemBlue
        )
        let second = cache.baseAttributedText(
            cacheKey: cacheKey,
            runs: [],
            fallbackText: "ignored because the cached final row wins",
            theme: .default,
            role: .body,
            accentColor: .systemRed
        )

        XCTAssertTrue(first === second)
        XCTAssertEqual(first.string, "SECTION 101")
        let font = try XCTUnwrap(first.attribute(.font, at: 0, effectiveRange: nil) as? UIFont)
        XCTAssertTrue(font.fontDescriptor.symbolicTraits.contains(.traitBold))
        XCTAssertTrue(
            (first.attribute(.foregroundColor, at: 0, effectiveRange: nil) as? UIColor)?
                .isEqual(UIColor.systemBlue) == true
        )
    }

    func testPhaseFiveComplexTablePilotUsesBoundedIsolatedHTML() async throws {
        let store = NativeReaderDocumentStore(corpusRootURL: corpusRootURL)
        let sourcePath = "2026-zoning-resolution/chapters/APP-D-21241.html"
        let resolvedRoute = await store.debugRoute(for: corpusRootURL.appendingPathComponent(sourcePath))
        let route = try XCTUnwrap(resolvedRoute)
        let document = try await store.loadDocument(for: route)
        let tables = document.blocks.compactMap(\.table)

        XCTAssertEqual(document.eligibility.state, .nativeWithTableFallback)
        XCTAssertEqual(document.eligibility.reasons, ["isolatedHTMLTableCount: 1"])
        XCTAssertEqual(tables.count, 1)
        let table = try XCTUnwrap(tables.first)
        XCTAssertEqual(table.rowCount, 139)
        XCTAssertEqual(table.columnCount, 5)
        XCTAssertEqual(table.renderingClassification, .isolatedHTML)
        XCTAssertTrue(table.classificationReasons.contains("mergedCells"))
        XCTAssertTrue(table.classificationReasons.contains("customBorders"))
        XCTAssertTrue(table.sourceHTML?.localizedCaseInsensitiveContains("<table") == true)
        XCTAssertEqual(Set(table.cells.map(\.id)).count, table.cells.count)

        let oversizedRoute = await store.debugValidatedRoute(
            forRelativeSourcePath: "2026-zoning-resolution/chapters/APP-C-21242.html"
        )
        let loadedOversizedRoute = try XCTUnwrap(oversizedRoute)
        let oversizedDocument = try await store.loadDocument(for: loadedOversizedRoute)
        let oversizedTable = try XCTUnwrap(oversizedDocument.blocks.compactMap(\.table).first)
        XCTAssertEqual(oversizedDocument.eligibility.state, .nativeWithTableFallback)
        XCTAssertEqual(oversizedTable.rowCount, 6_840)
        XCTAssertEqual(oversizedTable.cells.count, 23_093)
        XCTAssertEqual(oversizedTable.renderingClassification, .isolatedHTML)
    }

    func testPhaseFourMediaPilotsResolveBundledAssetsAndAccessibilityText() async throws {
        let store = NativeReaderDocumentStore(corpusRootURL: corpusRootURL)
        let expectedMediaCounts = [
            "2022-construction-codes/code-sections/building-code/chapters/30.html": 1,
            "2022-construction-codes/code-sections/building-code/chapters/M.html": 2,
            "2022-construction-codes/code-sections/building-code/chapters/R.html": 5,
            "2022-construction-codes/code-sections/building-code/chapters/S.html": 15,
            "2026-enacted-administrative-code/chapters/30000095.html": 3
        ]

        for (sourcePath, expectedCount) in expectedMediaCounts {
            let resolvedRoute = await store.debugRoute(for: corpusRootURL.appendingPathComponent(sourcePath))
            let route = try XCTUnwrap(resolvedRoute)
            let document = try await store.loadDocument(for: route)
            let media = document.blocks.flatMap(\.media)

            XCTAssertEqual(media.count, expectedCount, sourcePath)
            XCTAssertEqual(Set(media.map(\.id)).count, expectedCount, sourcePath)
            for item in media {
                let url = try XCTUnwrap(NativeReaderDocumentStore.resolvedMediaURL(for: item, route: route))
                XCTAssertTrue(FileManager.default.fileExists(atPath: url.path), item.id)
                XCTAssertNotNil(item.assetSHA256)
            }
            if sourcePath.contains("enacted-administrative-code") {
                XCTAssertTrue(media.allSatisfy { $0.accessibilityText?.isEmpty == false })
            }
        }
    }

    func testMissingPhaseFourMediaAssetRequiresWholeChapterFallback() async throws {
        let store = NativeReaderDocumentStore(corpusRootURL: corpusRootURL)
        let sourcePath = "2022-construction-codes/code-sections/building-code/chapters/30.html"
        let resolvedRoute = await store.debugRoute(for: corpusRootURL.appendingPathComponent(sourcePath))
        let route = try XCTUnwrap(resolvedRoute)
        let temporaryRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent("native-reader-phase-4-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: temporaryRoot) }

        let copiedSourceURL = temporaryRoot.appendingPathComponent(sourcePath)
        try FileManager.default.createDirectory(
            at: copiedSourceURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try FileManager.default.copyItem(at: route.sourceURL, to: copiedSourceURL)
        let missingAssetRoute = NativeReaderDocumentRoute(
            relativeSourcePath: route.relativeSourcePath,
            sourceURL: copiedSourceURL,
            documentURL: route.documentURL,
            sourceSHA256: route.sourceSHA256,
            documentID: route.documentID,
            documentSHA256: route.documentSHA256,
            compressedSHA256: route.compressedSHA256,
            uncompressedByteCount: route.uncompressedByteCount,
            compressedByteCount: route.compressedByteCount
        )

        do {
            _ = try await store.loadDocument(for: missingAssetRoute)
            XCTFail("A chapter with an unavailable media asset must not remain native.")
        } catch let error as NativeReaderDocumentStoreError {
            guard case .mediaValidationFailed(let reason) = error else {
                return XCTFail("Unexpected error: \(error)")
            }
            XCTAssertTrue(reason.contains("unreadable asset") || reason.contains("unresolved asset"), reason)
        }
    }

    func testUnusuallyLargeMapDownsamplesToRequestedPixelBound() throws {
        let mapURL = corpusRootURL.appendingPathComponent(
            "2026-zoning-resolution/assets/zr-140ad79f747c8e92-TransitZoneMap14.jpg"
        )
        let data = try Data(contentsOf: mapURL, options: [.mappedIfSafe])
        let image = try XCTUnwrap(ImageBlockCache.downsampledImage(data: data, maxPixelSize: 512))
        let maximumPixelDimension = max(image.size.width * image.scale, image.size.height * image.scale)

        XCTAssertLessThanOrEqual(maximumPixelDimension, 512)
        XCTAssertGreaterThan(data.count, 2_000_000)
    }

    func testNativeDocumentIntegrityFailureRequiresFallback() async throws {
        let store = NativeReaderDocumentStore(corpusRootURL: corpusRootURL)
        let sourcePath = try XCTUnwrap(NativeReaderDocumentStore.debugPilotSourcePaths.sorted().first)
        let sourceURL = corpusRootURL.appendingPathComponent(sourcePath)
        let resolvedRoute = await store.debugRoute(for: sourceURL)
        let route = try XCTUnwrap(resolvedRoute)
        let invalidRoute = NativeReaderDocumentRoute(
            relativeSourcePath: route.relativeSourcePath,
            sourceURL: route.sourceURL,
            documentURL: route.documentURL,
            sourceSHA256: route.sourceSHA256,
            documentID: route.documentID,
            documentSHA256: route.documentSHA256,
            compressedSHA256: String(repeating: "0", count: 64),
            uncompressedByteCount: route.uncompressedByteCount,
            compressedByteCount: route.compressedByteCount
        )

        do {
            _ = try await store.loadDocument(for: invalidRoute)
            XCTFail("A document with a mismatched compressed hash must not render natively.")
        } catch let error as NativeReaderDocumentStoreError {
            XCTAssertEqual(error, .hashMismatch(sourcePath))
        }
    }

    func testStableBlockAndAnchorLocationResolution() async throws {
        let store = NativeReaderDocumentStore(corpusRootURL: corpusRootURL)
        let sourcePath = "2026-existing-building-code/chapters/1.html"
        let resolvedRoute = await store.debugRoute(for: corpusRootURL.appendingPathComponent(sourcePath))
        let route = try XCTUnwrap(resolvedRoute)
        let document = try await store.loadDocument(for: route)
        let anchor = try XCTUnwrap(document.anchors.first(where: { $0.blockID != nil }))
        let anchorBlockID = try XCTUnwrap(anchor.blockID)
        let rememberedBlockID = try XCTUnwrap(document.blocks.last?.id)

        XCTAssertEqual(
            NativeReaderLocationResolver.initialBlockID(
                in: document,
                rememberedBlockID: rememberedBlockID,
                rememberedAnchorID: anchor.id,
                initialAnchorID: nil,
                initialSectionNumber: ""
            ),
            rememberedBlockID
        )
        XCTAssertEqual(
            NativeReaderLocationResolver.initialBlockID(
                in: document,
                rememberedBlockID: "missing-block",
                rememberedAnchorID: anchor.id,
                initialAnchorID: nil,
                initialSectionNumber: ""
            ),
            anchorBlockID
        )
        XCTAssertEqual(
            NativeReaderLocationResolver.blockID(forAnchorID: anchor.id, in: document),
            anchorBlockID
        )

        let segmentedBlock = try XCTUnwrap(
            NativeReaderDisplayBlock.blocks(from: document.blocks)
                .first(where: { $0.id != $0.sourceBlockID })
        )
        XCTAssertEqual(
            NativeReaderLocationResolver.initialBlockID(
                in: document,
                rememberedBlockID: segmentedBlock.id,
                rememberedAnchorID: nil,
                initialAnchorID: nil,
                initialSectionNumber: ""
            ),
            segmentedBlock.id
        )
        XCTAssertEqual(
            NativeReaderDisplayBlock.sourceBlockID(for: segmentedBlock.id, in: document),
            segmentedBlock.sourceBlockID
        )
    }

    func testLineBreakProvisionsBecomeStableDisplayBlocks() {
        let paragraph = NativeReaderRuntimeBlock(
            id: "authored-paragraph",
            kind: .paragraph,
            sourceOrder: 0,
            sectionID: "ebc-101",
            anchorIDs: ["rid-ebc-101"],
            plainText: "101.1 General.\nFirst continuation.\n101.2 Scope.\nSecond continuation.",
            runs: [
                NativeReaderRuntimeTextRun(
                    text: "101.1 General.\nFirst continuation.\n",
                    styles: [.bold],
                    linkTarget: nil
                ),
                NativeReaderRuntimeTextRun(
                    text: "101.2 Scope.\nSecond continuation.",
                    styles: [],
                    linkTarget: nil
                )
            ],
            headingLevel: nil,
            listItems: []
        )

        let displayBlocks = NativeReaderDisplayBlock.blocks(from: [paragraph])

        XCTAssertEqual(displayBlocks.map(\.id), ["authored-paragraph", "authored-paragraph::segment-1"])
        XCTAssertEqual(displayBlocks.map(\.sourceBlockID), ["authored-paragraph", "authored-paragraph"])
        XCTAssertEqual(
            displayBlocks.map(\.block.plainText),
            ["101.1 General.\nFirst continuation.", "101.2 Scope.\nSecond continuation."]
        )
        XCTAssertTrue(displayBlocks.allSatisfy(\.usesCompactSpacing))
        XCTAssertEqual(displayBlocks.first?.block.runs.first?.styles, [.bold])
        XCTAssertEqual(displayBlocks.last?.block.sectionID, paragraph.sectionID)
        XCTAssertEqual(displayBlocks.last?.block.anchorIDs, paragraph.anchorIDs)
    }

    func testReaderContextsPersistNativeBlocksIndependently() {
        let chapterID: Int64 = -9_900_003
        defer {
            BrowserContextID.persistNativeBlockID(nil, for: chapterID, context: .primary)
            BrowserContextID.persistNativeBlockID(nil, for: chapterID, context: .secondary)
        }

        XCTAssertNotEqual(
            BrowserContextID.primary.chapterNativeBlockDefaultsKey(for: chapterID),
            BrowserContextID.secondary.chapterNativeBlockDefaultsKey(for: chapterID)
        )
        BrowserContextID.persistNativeBlockID("reader-one-block", for: chapterID, context: .primary)
        BrowserContextID.persistNativeBlockID("reader-two-block", for: chapterID, context: .secondary)

        XCTAssertEqual(
            BrowserContextID.storedNativeBlockID(for: chapterID, context: .primary),
            "reader-one-block"
        )
        XCTAssertEqual(
            BrowserContextID.storedNativeBlockID(for: chapterID, context: .secondary),
            "reader-two-block"
        )
    }

    func testAttributedTextPreservesInlineFormattingAndLinks() throws {
        let url = try XCTUnwrap(URL(string: "#section-102"))
        let text = NativeReaderAttributedTextBuilder.attributedText(
            runs: [
                NativeReaderRuntimeTextRun(
                    text: "Linked provision",
                    styles: [.bold, .italic, .underline],
                    linkTarget: url.absoluteString
                )
            ],
            fallbackText: "",
            theme: .default,
            role: .body,
            accentColor: .systemBlue
        )
        let attributes = text.attributes(at: 0, effectiveRange: nil)
        let font = try XCTUnwrap(attributes[.font] as? UIFont)

        XCTAssertTrue(font.fontDescriptor.symbolicTraits.contains(.traitBold))
        XCTAssertTrue(font.fontDescriptor.symbolicTraits.contains(.traitItalic))
        XCTAssertEqual(attributes[.underlineStyle] as? Int, NSUnderlineStyle.single.rawValue)
        XCTAssertEqual((attributes[.link] as? URL)?.fragment, "section-102")

        let plainText = NativeReaderAttributedTextBuilder.attributedText(
            runs: [NativeReaderRuntimeTextRun(text: "Body", styles: [], linkTarget: nil)],
            fallbackText: "",
            theme: .default,
            role: .body,
            accentColor: .systemBlue
        )
        let plainFont = try XCTUnwrap(plainText.attribute(.font, at: 0, effectiveRange: nil) as? UIFont)
        XCTAssertEqual(plainFont.familyName, ReaderTheme.default.bodyFont.familyName)
    }

    func testNativeHeadingPresentationRecoversPublishedHierarchy() {
        func heading(_ text: String, sourceLevel: Int) -> NativeReaderRuntimeBlock {
            NativeReaderRuntimeBlock(
                id: text,
                kind: .heading,
                sourceOrder: 0,
                sectionID: nil,
                anchorIDs: [],
                plainText: text,
                runs: [],
                headingLevel: sourceLevel,
                listItems: []
            )
        }

        XCTAssertEqual(
            NativeReaderHeadingPresentation(block: heading("Chapter 1: Administration", sourceLevel: 6)),
            NativeReaderHeadingPresentation(level: 1, style: .chapter)
        )
        XCTAssertEqual(
            NativeReaderHeadingPresentation(block: heading("Section BC 101: General", sourceLevel: 6)),
            NativeReaderHeadingPresentation(level: 2, style: .majorSection)
        )
        XCTAssertEqual(
            NativeReaderHeadingPresentation(block: heading("101.4 Referenced codes.", sourceLevel: 6)),
            NativeReaderHeadingPresentation(level: 3, style: .provision)
        )
        XCTAssertEqual(
            NativeReaderHeadingPresentation(block: heading("101.4.2.1 Prior code buildings.", sourceLevel: 6)),
            NativeReaderHeadingPresentation(level: 5, style: .provision)
        )
        XCTAssertEqual(
            NativeReaderHeadingPresentation(block: heading("EBC 101 GENERAL", sourceLevel: 3)),
            NativeReaderHeadingPresentation(level: 3, style: .provision)
        )

        let nestedHeading = heading("101.4.2.1 Prior code buildings.", sourceLevel: 6)
        let nestedParagraph = NativeReaderRuntimeBlock(
            id: "nested-paragraph",
            kind: .paragraph,
            sourceOrder: 1,
            sectionID: nil,
            anchorIDs: [],
            plainText: "Nested body",
            runs: [],
            headingLevel: nil,
            listItems: []
        )
        let displayBlocks = NativeReaderDisplayBlock.blocks(from: [nestedHeading, nestedParagraph])
        XCTAssertEqual(displayBlocks.map(\.hierarchyIndentation), [24, 24])
    }

    func testPhaseSixSearchIndexFindsOrderedCaseInsensitiveMatches() {
        let paragraph = NativeReaderRuntimeBlock(
            id: "search-paragraph",
            kind: .paragraph,
            sourceOrder: 4,
            sectionID: "section-101",
            anchorIDs: ["JD_BC101"],
            plainText: "General requirements. A GENERAL rule remains generally applicable.",
            runs: [],
            headingLevel: nil,
            listItems: []
        )
        let displayBlocks = NativeReaderDisplayBlock.blocks(from: [paragraph])

        let matches = NativeReaderSearchIndex.matches(query: "general", in: displayBlocks)

        XCTAssertEqual(matches.count, 3)
        XCTAssertEqual(matches.map(\.blockID), Array(repeating: "search-paragraph", count: 3))
        XCTAssertEqual(matches.map(\.range.location), matches.map(\.range.location).sorted())
        XCTAssertTrue(matches.allSatisfy { $0.snippet.localizedCaseInsensitiveContains("general") })
        XCTAssertTrue(NativeReaderSearchIndex.matches(query: "   ", in: displayBlocks).isEmpty)
    }

    func testPhaseSixSearchHighlightsActiveMatchWithoutLosingText() throws {
        let source = "Scope and scope"
        let ranges = NativeReaderSearchIndex.ranges(of: "scope", in: source)
        let text = NativeReaderAttributedTextBuilder.attributedText(
            runs: [NativeReaderRuntimeTextRun(text: source, styles: [.bold], linkTarget: nil)],
            fallbackText: "",
            theme: .default,
            role: .body,
            accentColor: .systemTeal,
            highlightRanges: ranges,
            activeHighlightRange: ranges.last
        )

        XCTAssertEqual(text.string, source)
        XCTAssertEqual(ranges.count, 2)
        XCTAssertNotNil(text.attribute(.backgroundColor, at: ranges[0].location, effectiveRange: nil))
        XCTAssertEqual(
            text.attribute(.underlineStyle, at: ranges[1].location, effectiveRange: nil) as? Int,
            NSUnderlineStyle.single.rawValue
        )
        let font = try XCTUnwrap(text.attribute(.font, at: 0, effectiveRange: nil) as? UIFont)
        XCTAssertTrue(font.fontDescriptor.symbolicTraits.contains(.traitBold))
    }

    func testPhaseSixSelectionMenuPreservesCopyShareAndAddsSingularSparkleResearch() {
        let menu = ReaderSelectionMenuBuilder.menu(
            selectedText: "  enacted requirement  ",
            suggestedActions: [
                UIAction(title: "Copy") { _ in },
                UIAction(title: "Share") { _ in }
            ],
            onResearchSelection: { _ in }
        )
        let actions = menu.children.compactMap { $0 as? UIAction }

        XCTAssertEqual(actions.map(\.title), ["Copy", "Share", "Research"])
        XCTAssertEqual(ReaderSelectionMenuBuilder.researchSystemImageName, "sparkle")
        XCTAssertEqual(
            ReaderSelectionMenuBuilder.selectableTextAccessibilityIdentifier,
            "native-reader-enacted-text"
        )
    }

    func testFirstUseResearchExampleAlwaysUsesBundledBuildingCodeTitle() throws {
        let versions = BundleDatabaseLocator().availableCodeVersions()
        let example = try XCTUnwrap(
            FirstUseResearchExample.bundledBuildingCodeTitle(in: versions)
        )

        XCTAssertEqual(example.section.sectionNumber, "101.1")
        XCTAssertEqual(example.codePrefix, "BC")
        XCTAssertEqual(
            UserContentSyncCodeVersion.server(try XCTUnwrap(example.codeVersion)),
            UserContentSyncCodeVersion.canonicalNYC2022
        )
        XCTAssertFalse(example.officialText.isEmpty)
    }

    func testPhaseSixLinkResolverDecodesAuthoredTemplatesAndCrossCodeAnchors() throws {
        let templateURL = try XCTUnwrap(
            NativeReaderLinkResolver.linkURL(
                for: "{{ pathname: '/codes/newyorkcity/latest/NYCadmin/0-0-0-194709', hash: '#JD_MC702' }}"
            )
        )
        XCTAssertEqual(templateURL.fragment, "JD_MC702")
        XCTAssertEqual(
            NativeReaderLinkResolver.reference(for: templateURL),
            NativeReaderReference(kind: .section, codePrefix: "MC", token: "702")
        )

        let tableURL = try XCTUnwrap(NativeReaderLinkResolver.fragmentURL("JD_BCTable1607.1"))
        XCTAssertEqual(
            NativeReaderLinkResolver.reference(for: tableURL),
            NativeReaderReference(kind: .section, codePrefix: "BC", token: "1607.1")
        )

        let chapterURL = try XCTUnwrap(NativeReaderLinkResolver.fragmentURL("JD_BCCh.16"))
        XCTAssertEqual(
            NativeReaderLinkResolver.reference(for: chapterURL),
            NativeReaderReference(kind: .chapter, codePrefix: "BC", token: "16")
        )

        let zoningURL = try XCTUnwrap(URL(string: "https://zr.planning.nyc.gov/article-i/chapter-1#11-122"))
        XCTAssertEqual(
            NativeReaderLinkResolver.reference(for: zoningURL),
            NativeReaderReference(kind: .section, codePrefix: nil, token: "11-122")
        )

        let title28ChapterURL = try XCTUnwrap(NativeReaderLinkResolver.fragmentURL("JD_T28C001"))
        XCTAssertEqual(
            NativeReaderLinkResolver.reference(for: title28ChapterURL),
            NativeReaderReference(kind: .chapter, codePrefix: "T28", token: "1")
        )

        let title28ArticleURL = try XCTUnwrap(NativeReaderLinkResolver.fragmentURL("JD_28-103"))
        XCTAssertEqual(
            NativeReaderLinkResolver.reference(for: title28ArticleURL),
            NativeReaderReference(kind: .article, codePrefix: "T28", token: "28-103")
        )

        let title24AlphaChapterURL = try XCTUnwrap(NativeReaderLinkResolver.fragmentURL("JD_T24C005A"))
        XCTAssertEqual(
            NativeReaderLinkResolver.reference(for: title24AlphaChapterURL),
            NativeReaderReference(kind: .chapter, codePrefix: "T24", token: "5-A")
        )

        let title24SectionURL = try XCTUnwrap(NativeReaderLinkResolver.fragmentURL("JD_24-526"))
        XCTAssertEqual(
            NativeReaderLinkResolver.reference(for: title24SectionURL),
            NativeReaderReference(kind: .section, codePrefix: "T24", token: "24-526")
        )

        let title25ChapterURL = try XCTUnwrap(NativeReaderLinkResolver.fragmentURL("JD_T25C003"))
        XCTAssertEqual(
            NativeReaderLinkResolver.reference(for: title25ChapterURL),
            NativeReaderReference(kind: .chapter, codePrefix: "T25", token: "3")
        )

        let title26SectionURL = try XCTUnwrap(NativeReaderLinkResolver.fragmentURL("JD_26-101"))
        XCTAssertEqual(
            NativeReaderLinkResolver.reference(for: title26SectionURL),
            NativeReaderReference(kind: .section, codePrefix: "T26", token: "26-101")
        )

        let housingSectionURL = try XCTUnwrap(NativeReaderLinkResolver.fragmentURL("JD_27-2077"))
        XCTAssertEqual(
            NativeReaderLinkResolver.reference(for: housingSectionURL),
            NativeReaderReference(kind: .section, codePrefix: "T27", token: "27-2077")
        )

        let localLawURL = try XCTUnwrap(NativeReaderLinkResolver.fragmentURL("JD_L.L.2023/077"))
        XCTAssertEqual(
            NativeReaderLinkResolver.reference(for: localLawURL),
            NativeReaderReference(kind: .section, codePrefix: "LL", token: "L.L. 2023/077")
        )
        XCTAssertEqual(
            NativeReaderSectionNavigator.sectionNumber(from: "SECTION BC 101 General", anchorID: nil),
            "101"
        )
        XCTAssertEqual(
            NativeReaderSectionNavigator.sectionNumber(from: "EBC 101 General", anchorID: nil),
            "101"
        )
    }

    func testNativeReaderCodeSectionResolverUsesExactCollectionsAndFailsClosed() {
        let codeSections = [
            CodeSectionCategory(id: 1, codeID: 1, name: "BUILDING CODE"),
            CodeSectionCategory(id: 2, codeID: 1, name: "GENERAL ADMINISTRATIVE PROVISIONS"),
            CodeSectionCategory(id: 3, codeID: 1, name: "ADMINISTRATIVE CODE TITLE 24"),
            CodeSectionCategory(id: 4, codeID: 1, name: "ADMINISTRATIVE CODE TITLE 28"),
            CodeSectionCategory(id: 5, codeID: 1, name: "HOUSING MAINTENANCE CODE"),
            CodeSectionCategory(id: 6, codeID: 1, name: "CONSTRUCTION-RELATED LOCAL LAWS"),
            CodeSectionCategory(id: 7, codeID: 1, name: "1968 BUILDING CODE"),
            CodeSectionCategory(id: 8, codeID: 1, name: "ADMINISTRATIVE CODE TITLE 25"),
            CodeSectionCategory(id: 9, codeID: 1, name: "ADMINISTRATIVE CODE TITLE 26")
        ]

        XCTAssertEqual(NativeReaderCodeSectionResolver.codeSectionID(for: "BC", in: codeSections), 1)
        XCTAssertEqual(NativeReaderCodeSectionResolver.codeSectionID(for: "AC", in: codeSections), 2)
        XCTAssertEqual(NativeReaderCodeSectionResolver.codeSectionID(for: "T24", in: codeSections), 3)
        XCTAssertEqual(NativeReaderCodeSectionResolver.codeSectionID(for: "T25", in: codeSections), 8)
        XCTAssertEqual(NativeReaderCodeSectionResolver.codeSectionID(for: "T26", in: codeSections), 9)
        XCTAssertEqual(NativeReaderCodeSectionResolver.codeSectionID(for: "T28", in: codeSections), 4)
        XCTAssertEqual(
            NativeReaderCodeSectionResolver.codeSectionID(
                for: "T28",
                in: Array(codeSections.prefix(2))
            ),
            2
        )
        XCTAssertEqual(NativeReaderCodeSectionResolver.codeSectionID(for: "T27", in: codeSections), 5)
        XCTAssertEqual(NativeReaderCodeSectionResolver.codeSectionID(for: "LL", in: codeSections), 6)

        let unavailableFireReference = NativeReaderReference(
            kind: .section,
            codePrefix: "FC",
            token: "105"
        )
        XCTAssertNil(
            NativeReaderCodeSectionResolver.targetCodeSectionID(
                for: unavailableFireReference,
                sourceCodeSectionID: 1,
                codeSections: codeSections
            )
        )

        let sameCodeReference = NativeReaderReference(
            kind: .section,
            codePrefix: nil,
            token: "101.1"
        )
        XCTAssertEqual(
            NativeReaderCodeSectionResolver.targetCodeSectionID(
                for: sameCodeReference,
                sourceCodeSectionID: 1,
                codeSections: codeSections
            ),
            1
        )
    }

    func testFuelGasTitle28LinkRendersAndResolvesAgainstBundled2022Content() async throws {
        let sourcePath = "2022-construction-codes/code-sections/fuel-gas-code/chapters/Chapter 1.html"
        let documentStore = NativeReaderDocumentStore(corpusRootURL: corpusRootURL)
        let resolvedRoute = await documentStore.debugValidatedRoute(
            forRelativeSourcePath: sourcePath
        )
        let route = try XCTUnwrap(resolvedRoute)
        let document = try await documentStore.loadDocument(for: route)
        let target = try XCTUnwrap(
            document.blocks
                .flatMap(\.runs)
                .first(where: { $0.linkTarget?.contains("JD_T28C001") == true })?
                .linkTarget
        )
        let url = try XCTUnwrap(NativeReaderLinkResolver.linkURL(for: target))
        let reference = try XCTUnwrap(NativeReaderLinkResolver.reference(for: url))

        let version = try XCTUnwrap(
            BundleDatabaseLocator().availableCodeVersions().first {
                UserContentSyncCodeVersion.server($0.codeVersion) ==
                    UserContentSyncCodeVersion.canonicalNYC2022
            }
        )
        let authoredStore = try AuthoredCodeStore(
            jsonURL: version.fileURL,
            codeID: version.authoredCodeID,
            jurisdictionID: version.jurisdictionID
        )
        let fuelGasCodeSectionID = try XCTUnwrap(
            authoredStore.codeSections().first { $0.name == "FUEL GAS CODE" }?.id
        )
        let destination = NativeReaderReferenceDestinationResolver.destination(
            for: reference,
            sourceCodeSectionID: fuelGasCodeSectionID,
            codeSections: authoredStore.codeSections(),
            chapters: { authoredStore.chapters(codeSectionID: $0) },
            sections: { authoredStore.sections(chapterID: $0.id) },
            sectionSummary: {
                try? authoredStore.sectionSummary(sectionNumber: $0, codeSectionID: $1)
            }
        )

        XCTAssertEqual(reference, NativeReaderReference(kind: .chapter, codePrefix: "T28", token: "1"))
        XCTAssertEqual(destination?.chapterNumber, "1")
        XCTAssertEqual(destination?.sectionNumber, "28-101.1")
        XCTAssertEqual(destination?.id, 8_779)
    }

    func testBuildingCodeTitle28ArticleLinksRenderAndResolveAgainstBundled2022Content() async throws {
        let sourcePath = "2022-construction-codes/code-sections/building-code/chapters/1.html"
        let documentStore = NativeReaderDocumentStore(corpusRootURL: corpusRootURL)
        let resolvedRoute = await documentStore.debugValidatedRoute(
            forRelativeSourcePath: sourcePath
        )
        let route = try XCTUnwrap(resolvedRoute)
        let document = try await documentStore.loadDocument(for: route)

        let version = try XCTUnwrap(
            BundleDatabaseLocator().availableCodeVersions().first {
                UserContentSyncCodeVersion.server($0.codeVersion) ==
                    UserContentSyncCodeVersion.canonicalNYC2022
            }
        )
        let authoredStore = try AuthoredCodeStore(
            jsonURL: version.fileURL,
            codeID: version.authoredCodeID,
            jurisdictionID: version.jurisdictionID
        )
        let buildingCodeSectionID = try XCTUnwrap(
            authoredStore.codeSections().first { $0.name == "BUILDING CODE" }?.id
        )
        let cases: [(fragment: String, linkedText: String, destinationNumber: String, destinationID: Int64)] = [
            ("JD_28-103", "Article 103 of Chapter 1 of Title 28", "28-103.1", 8_812),
            ("JD_28-105", "Article 105 of Chapter 1 of Title 28", "28-105.1", 8_979)
        ]

        for item in cases {
            let linkedRun = try XCTUnwrap(
                document.blocks
                    .flatMap(\.runs)
                    .first(where: { $0.linkTarget?.contains(item.fragment) == true })
            )
            let target = try XCTUnwrap(linkedRun.linkTarget)
            let url = try XCTUnwrap(NativeReaderLinkResolver.linkURL(for: target))
            let reference = try XCTUnwrap(NativeReaderLinkResolver.reference(for: url))
            let destination = NativeReaderReferenceDestinationResolver.destination(
                for: reference,
                sourceCodeSectionID: buildingCodeSectionID,
                codeSections: authoredStore.codeSections(),
                chapters: { authoredStore.chapters(codeSectionID: $0) },
                sections: { authoredStore.sections(chapterID: $0.id) },
                sectionSummary: {
                    try? authoredStore.sectionSummary(sectionNumber: $0, codeSectionID: $1)
                }
            )

            XCTAssertEqual(
                reference,
                NativeReaderReference(kind: .article, codePrefix: "T28", token: item.fragment.replacingOccurrences(of: "JD_", with: ""))
            )
            XCTAssertEqual(linkedRun.text, item.linkedText)
            XCTAssertEqual(destination?.sectionNumber, item.destinationNumber)
            XCTAssertEqual(destination?.id, item.destinationID)
        }
    }

    func testPhaseSixSectionNavigatorTracksNearestPublishedHeading() async throws {
        let store = NativeReaderDocumentStore(corpusRootURL: corpusRootURL)
        let sourcePath = "2026-existing-building-code/chapters/1.html"
        let resolvedRoute = await store.debugRoute(for: corpusRootURL.appendingPathComponent(sourcePath))
        let route = try XCTUnwrap(resolvedRoute)
        let document = try await store.loadDocument(for: route)
        let displayBlocks = NativeReaderDisplayBlock.blocks(from: document.blocks)
        let targets = NativeReaderSectionNavigator.targets(in: document, displayBlocks: displayBlocks)
        let lastDisplayBlock = try XCTUnwrap(displayBlocks.last)
        let target = try XCTUnwrap(
            NativeReaderSectionNavigator.target(
                forDisplayBlockID: lastDisplayBlock.id,
                in: document,
                targets: targets
            )
        )

        XCTAssertFalse(targets.isEmpty)
        XCTAssertEqual(targets.map(\.sourceOrder), targets.map(\.sourceOrder).sorted())
        XCTAssertLessThanOrEqual(target.sourceOrder, lastDisplayBlock.block.sourceOrder)
        XCTAssertTrue(targets.allSatisfy { !$0.menuLabel.isEmpty })
    }

    func testPhaseEightPreparedDocumentCacheIsBoundedAndPurgedOnMemoryWarning() async throws {
        let store = NativeReaderDocumentStore(corpusRootURL: corpusRootURL)
        store.resetPreparedDocumentsForTesting()
        let sourcePath = "2026-existing-building-code/chapters/1.html"
        let resolvedRoute = await store.debugRoute(for: corpusRootURL.appendingPathComponent(sourcePath))
        let route = try XCTUnwrap(resolvedRoute)

        let first = try await store.loadPreparedDocument(for: route)
        let second = try await store.loadPreparedDocument(for: route)
        XCTAssertEqual(first, second)

        var metrics = store.metrics()
        XCTAssertEqual(metrics.requestCount, 2)
        XCTAssertEqual(metrics.cacheHitCount, 1)
        XCTAssertEqual(metrics.diskLoadCount, 1)
        XCTAssertEqual(metrics.cachedDocumentCount, 1)
        XCTAssertLessThanOrEqual(
            metrics.cachedMemoryCost,
            NativeReaderDocumentStore.preparedDocumentCostLimit
        )

        store.handleMemoryWarning()
        metrics = store.metrics()
        XCTAssertEqual(metrics.memoryWarningCount, 1)
        XCTAssertEqual(metrics.cachedDocumentCount, 0)
        XCTAssertEqual(metrics.cachedMemoryCost, 0)

        _ = try await store.loadPreparedDocument(for: route)
        metrics = store.metrics()
        XCTAssertEqual(metrics.diskLoadCount, 2)
        XCTAssertEqual(metrics.cachedDocumentCount, 1)
    }

    func testPhaseEightPreparedDocumentCacheNeverExceedsCountOrMemoryLimits() async throws {
        let store = NativeReaderDocumentStore(corpusRootURL: corpusRootURL)
        store.resetPreparedDocumentsForTesting()

        for sourcePath in NativeReaderDocumentStore.debugPilotSourcePaths.sorted() {
            let sourceURL = corpusRootURL.appendingPathComponent(sourcePath)
            guard let route = await store.debugRoute(for: sourceURL) else { continue }
            _ = try await store.loadPreparedDocument(for: route)
            let metrics = store.metrics()
            XCTAssertLessThanOrEqual(
                metrics.cachedDocumentCount,
                NativeReaderDocumentStore.preparedDocumentCountLimit
            )
            XCTAssertLessThanOrEqual(
                metrics.cachedMemoryCost,
                NativeReaderDocumentStore.preparedDocumentCostLimit
            )
        }
    }

    func testResearchDisclosureGateIsVersioned() {
        XCTAssertTrue(ResearchDisclosureGate.requiresAcknowledgement(completedVersion: 0))
        XCTAssertFalse(
            ResearchDisclosureGate.requiresAcknowledgement(
                completedVersion: ResearchDisclosureGate.currentVersion
            )
        )
        let suiteName = "ResearchDisclosureGateTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defer { defaults.removePersistentDomain(forName: suiteName) }
        ResearchDisclosureGate.acknowledge(accountID: "account-a", defaults: defaults)
        XCTAssertEqual(
            ResearchDisclosureGate.completedVersion(accountID: "account-a", defaults: defaults),
            ResearchDisclosureGate.currentVersion
        )
        XCTAssertEqual(
            ResearchDisclosureGate.completedVersion(accountID: "account-b", defaults: defaults),
            0,
            "Each signed-in account must receive its own first-use disclosure."
        )
    }

    func testResearchProjectContextDisclosureIncludesServerProjectInformation() throws {
        let conversation = try JSONDecoder().decode(
            ResearchConversation.self,
            from: Data(
                """
                {
                  "id":"conversation-a",
                  "title":"Parking review",
                  "createdAt":"2026-08-27T00:00:00Z",
                  "updatedAt":"2026-08-27T00:01:00Z",
                  "primaryProjectID":"project-a",
                  "projectContext":{
                    "projectID":"project-a",
                    "facts":["Additional Research Fact: Existing use remains in place."]
                  },
                  "projectInformation":{
                    "address":"1760 Jerome Avenue, Bronx, NY",
                    "description":"Proposed enlargement",
                    "facts":[
                      "Zoning Fact — Address: 1760 Jerome Avenue, Bronx, NY (user-confirmed; not independently verified)",
                      "Zoning Fact — Zoning Districts: R7-1 (NYC Planning sourced data; verify current official records)"
                    ],
                    "structuredFacts":[]
                  },
                  "projectContextReviewRequired":false,
                  "sourceStatus":"current",
                  "sources":[],
                  "messages":[]
                }
                """.utf8
            )
        )

        let disclosure = ResearchProjectContextDisclosure.resolve(
            projectID: conversation.primaryProjectID,
            projectInformation: conversation.projectInformation,
            additionalFacts: conversation.projectContext?.facts ?? []
        )

        XCTAssertTrue(disclosure.isAssigned)
        XCTAssertEqual(disclosure.title, "Project context included: 3 facts")
        XCTAssertEqual(disclosure.facts.count, 3)
        XCTAssertTrue(disclosure.facts.contains { $0.contains("1760 Jerome Avenue") })
        XCTAssertTrue(disclosure.facts.contains { $0.contains("R7-1") })
        XCTAssertTrue(disclosure.facts.contains { $0.contains("Existing use remains in place") })

        let localFallback = ResearchProjectContextDisclosure.resolve(
            projectID: "project-a",
            projectInformation: nil,
            additionalFacts: [],
            localAddress: "47 Cooper Street, Manhattan, NY",
            localDescription: "Interior renovation",
            localStructuredFacts: [
                ProjectStructuredFact(
                    id: "zoning-districts",
                    key: "zoning-districts",
                    label: "Zoning Districts",
                    value: "R7A",
                    status: "sourced",
                    source: "nyc-planning",
                    sourceText: "NYC Planning",
                    updatedAt: nil
                ),
                ProjectStructuredFact(
                    id: "floor-affected",
                    key: "floor-affected",
                    label: "Floor affected",
                    value: "3",
                    status: "confirmed",
                    source: "project",
                    sourceText: "",
                    updatedAt: nil
                )
            ]
        )
        XCTAssertEqual(localFallback.title, "Project context included: 3 facts")
        XCTAssertTrue(localFallback.facts.contains("Address: 47 Cooper Street, Manhattan, NY"))
        XCTAssertTrue(localFallback.facts.contains("Zoning Districts: R7A"))
        XCTAssertTrue(localFallback.facts.contains("Description: Interior renovation"))
        XCTAssertFalse(localFallback.facts.contains { $0.contains("Floor affected") })

        XCTAssertEqual(
            ResearchProjectContextDisclosure.resolve(
                projectID: nil,
                projectInformation: conversation.projectInformation,
                additionalFacts: ["This must not be included."]
            ).title,
            "Project facts: Unassigned — no Project facts will be included."
        )
    }

    func testResearchStructuredCopyPreservesTrustMetadataAndCitations() {
        var answer = ResearchAnswer(
            conclusion: "A cited conclusion.",
            explanation: "A bounded explanation.",
            authorityStatus: "supported_by_enacted_text",
            codeEdition: "2022 NYC Construction Codes",
            codeBasis: ResearchCodeBasis(
                disclosure: "Sources searched: 2022 NYC Construction Codes",
                limitation: "Zoning was not searched."
            ),
            sourceAsOf: "2026-08-26T00:00:00Z",
            evidenceLimitations: ["Project occupancy remains unverified."],
            citations: [
                ResearchCitation(
                    sectionID: "2675",
                    codePrefix: "BC",
                    sectionNumber: "101.1",
                    title: "Title",
                    relevance: "Governs the cited conclusion.",
                    codeEdition: "2022",
                    corpusLabel: "NYC Construction Codes",
                    applicabilityStatus: "current"
                )
            ],
            disclaimer: "AI-generated research assistance."
        )
        answer.missingFacts = ["Confirm occupancy classification."]

        let copied = answer.structuredCopyText(sourceStatus: "changed")

        XCTAssertEqual(answer.researchAuthorityLabel, "Supported by enacted text")
        XCTAssertTrue(copied.contains("Supported by enacted text"))
        XCTAssertTrue(copied.contains("Edition: 2022 NYC Construction Codes"))
        XCTAssertTrue(copied.contains("Source status: Changed — review before relying"))
        XCTAssertTrue(copied.contains("Zoning was not searched."))
        XCTAssertTrue(copied.contains("BC · 101.1 · Title"))
        XCTAssertTrue(copied.contains("Project occupancy remains unverified."))
        XCTAssertTrue(copied.contains("not an official interpretation"))
    }

    func testResearchFeedbackDecodesAdditivelyAndMapsNeutralStatus() throws {
        let response = try JSONDecoder().decode(
            ResearchFeedbackResponse.self,
            from: Data(
                """
                {"feedback":{"id":"feedback-1","status":"candidate","category":"citation_problem","userComment":"Wrong section","updatedAt":"2026-08-27T00:00:00Z"}}
                """.utf8
            )
        )
        XCTAssertEqual(response.feedback.category, "citation_problem")
        XCTAssertEqual(response.feedback.displayStatus, "Received")

        let olderMessage = try JSONDecoder().decode(
            ResearchMessage.self,
            from: Data(
                """
                {"id":"answer-1","role":"assistant","createdAt":"2026-08-27T00:00:00Z"}
                """.utf8
            )
        )
        XCTAssertNil(olderMessage.feedback)
    }

    func testResearchViewContainsPrivacyVisualAndCacheDeletionContracts() throws {
        XCTAssertTrue(ResearchTrustCopy.composerPrivacyDisclosure.contains("Private notes are not included."))
        XCTAssertTrue(ResearchTrustCopy.firstUseDisclosure.contains("Private notes are not included."))
        XCTAssertTrue(
            ResearchTrustCopy.visualEvidenceDisclosure.contains(
                "Selected official images are sent to OpenAI for analysis."
            )
        )
        XCTAssertEqual(ResearchTrustCopy.copyAnswerAction, "Copy answer")
        XCTAssertEqual(ResearchTrustCopy.reportProblemAction, "Report a problem")

        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("ResearchConversationCacheLifecycle.\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let cache = ProjectHubOfflineCache(directoryURL: directory)
        let accountID = "account-a"
        let conversationID = "conversation-a"
        let cachedConversation = ResearchQuestionAttempt(id: "answer-a", question: "Completed answer")
        let pendingAttempt = ResearchQuestionAttempt(id: "request-a", question: "Pending question")

        try ResearchConversationCacheLifecycle.store(
            cachedConversation,
            cache: cache,
            accountID: accountID,
            conversationID: conversationID
        )
        try cache.store(
            pendingAttempt,
            accountID: accountID,
            projectID: conversationID,
            scope: ResearchQuestionAttempt.cacheScope
        )
        XCTAssertNotNil(
            try ResearchConversationCacheLifecycle.load(
                ResearchQuestionAttempt.self,
                cache: cache,
                accountID: accountID,
                conversationID: conversationID
            ),
            "Caching a completed Research result must preserve it for offline access."
        )

        try ResearchConversationCacheLifecycle.removeDeletedConversation(
            cache: cache,
            accountID: accountID,
            conversationID: conversationID
        )
        XCTAssertNil(
            try ResearchConversationCacheLifecycle.load(
                ResearchQuestionAttempt.self,
                cache: cache,
                accountID: accountID,
                conversationID: conversationID
            ),
            "Deleting a Research conversation must remove its offline conversation cache."
        )
        XCTAssertNil(
            try cache.load(
                ResearchQuestionAttempt.self,
                accountID: accountID,
                projectID: conversationID,
                scope: ResearchQuestionAttempt.cacheScope
            ),
            "Deleting a Research conversation must remove its interrupted-request cache."
        )
    }

    func testHostedUnitTestsSkipNormalAppLifecycleSideEffects() {
        XCTAssertFalse(
            PermitextLifecyclePolicy.runsNormalDebugLifecycle(
                hasPhysicalStressConfiguration: false,
                hasPhase3ResearchConfiguration: false,
                environment: ["XCTestConfigurationFilePath": "/tmp/permitext.xctestconfiguration"]
            )
        )
        XCTAssertFalse(
            PermitextLifecyclePolicy.runsNormalDebugLifecycle(
                hasPhysicalStressConfiguration: true,
                hasPhase3ResearchConfiguration: false,
                environment: [:]
            )
        )
        XCTAssertTrue(
            PermitextLifecyclePolicy.runsNormalDebugLifecycle(
                hasPhysicalStressConfiguration: false,
                hasPhase3ResearchConfiguration: false,
                environment: [:]
            )
        )
    }
}

private extension String {
    func range(from start: String, to end: String) -> Range<String.Index>? {
        guard let lower = range(of: start)?.lowerBound,
              let upper = range(of: end, range: lower..<endIndex)?.lowerBound,
              lower < upper
        else { return nil }
        return lower..<upper
    }
}
