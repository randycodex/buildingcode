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
}
