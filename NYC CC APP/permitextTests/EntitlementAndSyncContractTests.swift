import XCTest
import SQLite3
@testable import permitext

final class EntitlementAndSyncContractTests: XCTestCase {
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
    }

    func testSyncConflictPresentationIdentifiesEverySupportedRecordKind() {
        let expected: [(ServerUserContentEntityKind, String, String)] = [
            (.savedItem, "Saved section", "bookmark"),
            (.annotation, "Note or tags", "note.text"),
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

        try store.saveSection(9_901, toFolderIDs: [projectID], codeVersion: evidenceVersion)

        XCTAssertEqual(
            Set(try store.folderMembership(codeVersion: evidenceVersion)[9_901] ?? []),
            [projectID]
        )
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
        XCTAssertEqual(queuedCrossCodeDelete.payload.sectionID, 9_901)
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
            "Upgrade to Pro to unlock unlimited saved work and notes, Projects, professional exports, tags, and offline access."
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

    func testSyncDeclaresVersionedCrossPlatformCapabilities() throws {
        let request = BackendUserContentPullRequest(
            auth: BackendAuthContext(accountUserID: "test-user", bearerToken: nil),
            since: nil
        )
        let data = try JSONEncoder().encode(request)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let capabilities = try XCTUnwrap(object["clientCapabilities"] as? [String])

        XCTAssertEqual(object["syncSchemaVersion"] as? Int, 2)
        XCTAssertEqual(Set(capabilities), Set(PermitextCapabilityID.allCases.map(\.rawValue)))
        XCTAssertTrue(capabilities.contains("notebook"))
        XCTAssertTrue(capabilities.contains("professional-exports"))
        XCTAssertTrue(capabilities.contains("organization-administration"))
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
            workboardPreview: nil,
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
}
