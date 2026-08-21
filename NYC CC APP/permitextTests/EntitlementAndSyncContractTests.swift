import XCTest
import SQLite3
import UIKit
import CryptoKit
@testable import permitext

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
    func testTwoTypefaceContractUsesSourceSerifForReaderAndMigratesLegacyChoices() throws {
        XCTAssertEqual(ReaderFontChoice.allCases, [.sourceSerif4])
        XCTAssertEqual(ReaderTheme.default.fontChoice, .sourceSerif4)
        XCTAssertEqual(ReaderTheme.default.bodyFont.fontName, "SourceSerif4Variable-Roman")
        XCTAssertEqual(ReaderTheme.default.italicFont.fontName, "SourceSerif4Variable-Italic")

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
        XCTAssertFalse(
            StoreKitTransactionPolicy.isActive(
                productID: StoreKitProductID.researchMonthly,
                expectedProductID: StoreKitProductID.researchMonthly,
                revocationDate: nil,
                expirationDate: now,
                now: now
            )
        )
    }

    func testSignedInAccountPersistenceRemovesLegacySessionToken() {
        let account = SignedInAccount(
            appUserID: "apple:persistence-test",
            authProvider: .apple,
            authProviderUserID: "persistence-test",
            appleUserID: "persistence-test",
            publicUsername: "permitext-test",
            displayName: "Persistence Test",
            signedInAt: Date(timeIntervalSince1970: 100),
            migrationState: .localDataAttached,
            backendSessionToken: "sensitive-session-token"
        )
        let sanitized = SignedInAccountPersistence.removingBackendSessionToken(from: account)

        XCTAssertNil(sanitized.backendSessionToken)
        XCTAssertEqual(sanitized.appUserID, account.appUserID)
        XCTAssertEqual(sanitized.migrationState, account.migrationState)
    }

    func testReleaseBackendURLPolicyFailsClosed() {
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
            "Loading Pro..."
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
            BundleDatabaseLocator().availableCodeVersions().first {
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

    func testPackagedProNeedsResearchAddOnWhileLegacyAndLifetimeKeepAccess() {
        let packagedPro = AppEntitlement(
            plan: .pro,
            source: .webSubscription,
            grantedUserID: "user",
            packageID: "pro",
            provider: .init(permitextPackage: "pro")
        )
        XCTAssertFalse(packagedPro.grantsResearch())

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

    func testStoreKitProIsUsedWhenBackendHasNoActiveProEntitlement() {
        let defaults = isolatedEntitlementDefaults()
        let service = LocalEntitlementService(defaults: defaults)
        LocalEntitlementService.setVerifiedPlan(.pro, defaults: defaults)

        XCTAssertEqual(service.currentEntitlement, .appleSubscriptionPro)

        LocalEntitlementService.setEntitlement(.free, defaults: defaults)
        XCTAssertEqual(service.currentEntitlement, .appleSubscriptionPro)

        LocalEntitlementService.setEntitlement(
            AppEntitlement(
                plan: .pro,
                source: .webSubscription,
                grantedUserID: "expired-backend-user",
                expiresAt: Date(timeIntervalSince1970: 1)
            ),
            defaults: defaults
        )
        XCTAssertEqual(service.currentEntitlement, .appleSubscriptionPro)

        LocalEntitlementService.setVerifiedPlan(.free, defaults: defaults)
        XCTAssertEqual(service.currentEntitlement, .free)
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
        XCTAssertTrue(chapterSource.contains("displayedIsBookmarked ? \"Saved\" : \"Removed\""))
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

        XCTAssertEqual(
            ResearchRequestFailurePresentation.resolve(verificationError).message,
            "Terra produced a response, but Permitext could not verify it against the enacted evidence. Your question is still here."
        )
        XCTAssertEqual(
            ResearchRequestFailurePresentation.resolve(providerError).message,
            "Terra's research service is temporarily unavailable. Your question is still here."
        )
    }

    func testResearchFailurePreservesQuestionAfterNetworkTimeout() {
        XCTAssertEqual(
            ResearchRequestFailurePresentation.resolve(URLError(.timedOut)).message,
            "Terra is taking longer than expected. Permitext checked for a completed answer but did not find one yet. Your question is still here."
        )
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

        XCTAssertGreaterThan(sourcePaths.count, 200)
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
                let assetURL = try XCTUnwrap(
                    NativeReaderDocumentStore.resolvedMediaURL(for: media, route: route),
                    "\(sourcePath): \(media.id)"
                )
                XCTAssertNotNil(
                    UIImage(contentsOfFile: assetURL.path),
                    "Bundled media must decode: \(sourcePath): \(assetURL.lastPathComponent)"
                )
            }
        }
    }

    func testPhaseNineRepresentativeCodeCollectionsAndFallbackRouting() async throws {
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

        let unsupportedPath = "2026-zoning-resolution/chapters/APP-C-21242.html"
        let unsupportedRoute = await store.debugValidatedRoute(
            forRelativeSourcePath: unsupportedPath
        )
        XCTAssertNil(unsupportedRoute)
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
        XCTAssertEqual(rolloutCounts, [233, 239, 239, 242])
        let allValidatedPaths = await store.debugValidatedSourcePaths()
        XCTAssertEqual(
            previousPaths,
            Set(allValidatedPaths)
        )
    }

    func testPhaseTenRoutingHonorsEveryStageAndKeepsInvalidContentOnHTML() async throws {
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

        let invalidSourceURL = corpusRootURL.appendingPathComponent(
            "2026-zoning-resolution/chapters/APP-C-21242.html"
        )
        let invalidRoute = await store.rolloutRoute(
            for: invalidSourceURL,
            stage: .isolatedTableFallback
        )
        XCTAssertNil(invalidRoute)
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

        let oversizedSource = corpusRootURL
            .appendingPathComponent("2026-zoning-resolution/chapters/APP-C-21242.html")
        let oversizedRoute = await store.debugRoute(for: oversizedSource)
        XCTAssertNil(oversizedRoute)
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
        XCTAssertEqual(plainFont.familyName, UIFont.systemFont(ofSize: 12).familyName)
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
}
