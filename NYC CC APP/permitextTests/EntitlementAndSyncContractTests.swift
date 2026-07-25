import XCTest
@testable import permitext

final class EntitlementAndSyncContractTests: XCTestCase {
    private func freeService() -> LocalEntitlementService {
        let suiteName = "permitext-tests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        return LocalEntitlementService(defaults: defaults)
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

    @MainActor
    func testOrganizationInvitationUniversalLinkExtractsOnlyPrivateToken() throws {
        let invitationURL = try XCTUnwrap(
            URL(string: "https://permitext-sync.vercel.app/?organizationInvite=private-token-123")
        )
        XCTAssertEqual(
            CodeLibraryViewModel.organizationInvitationToken(from: invitationURL),
            "private-token-123"
        )
        XCTAssertNil(
            CodeLibraryViewModel.organizationInvitationToken(
                from: URL(string: "https://example.com/?organizationInvite=private-token-123")!
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
}
