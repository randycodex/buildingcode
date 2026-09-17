import XCTest

final class NativeReaderPhysicalStressUITests: XCTestCase {
    private let bookmarkIdentifier = "reader-current-section-bookmark"
    private let savedRowIdentifierPrefix = "projects-bookmark-"

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 7_200
    }

    func testAppStoreReleaseScreenshots() throws {
#if DEBUG || !targetEnvironment(simulator)
        throw XCTSkip("App Store capture requires a Release Simulator build.")
#else
        let app = XCUIApplication()
        app.launch()
        let explore = app.buttons["phase5-first-use-explore"]
        if explore.waitForExistence(timeout: 5) { explore.tap() }

        let savedTab = app.tabBars.buttons["Saved"]
        XCTAssertTrue(savedTab.waitForExistence(timeout: 45))
        for label in ["First reader", "Second reader", "Search", "Research"] {
            XCTAssertTrue(app.tabBars.buttons[label].exists, "The tab must expose its destination name: \(label).")
        }
        savedTab.tap()
        app.buttons["Open Account"].tap()
        XCTAssertTrue(app.buttons["Sign in or create an account"].waitForExistence(timeout: 15),
                      "Capture must use an anonymous Simulator, without customer account data.")
        app.terminate()
        app.launch()

        let readerTab = app.tabBars.buttons["First reader"]
        XCTAssertTrue(readerTab.waitForExistence(timeout: 20))
        readerTab.tap()
        let sourceEdition = app.staticTexts["reader-source-edition"]
        XCTAssertTrue(sourceEdition.waitForExistence(timeout: 45))
        XCTAssertEqual(sourceEdition.label, "2022 Construction Codes")
        XCTAssertTrue(app.buttons["Building Code"].exists)
        XCTAssertFalse(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Chapter Chapter")).firstMatch.exists)
        keepAppStoreScreenshot(named: "01-code-library", from: app)

        let chapter = app.buttons.matching(NSPredicate(
            format: "label BEGINSWITH %@", "Chapter 7:"
        )).firstMatch
        for _ in 0..<5 where !chapter.isHittable { app.swipeUp() }
        XCTAssertTrue(chapter.isHittable, "Building Code Chapter 7 must be reachable.")
        chapter.tap()
        XCTAssertTrue(app.buttons["Jump within chapter"].waitForExistence(timeout: 45))
        XCTAssertFalse(app.buttons["Internal reader mode"].exists,
                       "Release captures must not contain the Reader debug control.")
        keepAppStoreScreenshot(named: "02-code-reader", from: app)

        let bookmark = app.buttons[bookmarkIdentifier]
        XCTAssertTrue(bookmark.waitForExistence(timeout: 10))
        if bookmark.value as? String != "Saved" {
            bookmark.tap()
            if app.alerts["Saved"].waitForExistence(timeout: 3) {
                app.alerts["Saved"].buttons["Done"].tap()
            }
        }

        app.tabBars.buttons["Search"].tap()
        let search = app.textFields["Search codes"]
        XCTAssertTrue(search.waitForExistence(timeout: 10))
        search.tap()
        search.typeText("fire resistance\n")
        let results = app.staticTexts.matching(NSPredicate(
            format: "label MATCHES %@", "[1-9][0-9]* results? in .*"
        )).firstMatch
        XCTAssertTrue(results.waitForExistence(timeout: 45))
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        keepAppStoreScreenshot(named: "03-search-results", from: app)

        app.tabBars.buttons["Saved"].tap()
        let savedPassage = app.buttons.matching(NSPredicate(
            format: "identifier BEGINSWITH %@", savedRowIdentifierPrefix
        )).firstMatch
        XCTAssertTrue(savedPassage.waitForExistence(timeout: 10))
        keepAppStoreScreenshot(named: "04-saved-section", from: app)
#endif
    }

    private func keepAppStoreScreenshot(named name: String, from app: XCUIApplication) {
        // The keyboard and system tab-bar animations can continue after the
        // accessibility tree reports its final state. Capture the settled UI.
        Thread.sleep(forTimeInterval: 1)
        for label in ["Saved", "First reader", "Second reader", "Search", "Research"] {
            XCTAssertTrue(app.tabBars.buttons[label].isHittable)
        }
        keepScreenshot(named: name, from: app)
    }

    func testAccountDeletionResultsRemainVisibleAfterSignOut() throws {
#if !DEBUG
        throw XCTSkip("Account deletion acceptance uses the isolated Debug transport.")
#else
        let app = XCUIApplication()
        app.launchArguments += ["--phase3-entitled-research-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        // This isolated legacy harness uses icon-only tabs; its first tab hosts Saved.
        app.tabBars.buttons.element(boundBy: 0).tap()
        app.buttons["Open Account"].tap()
        let deleteAccount = app.buttons["Delete Account"]
        reveal(deleteAccount, in: app)
        XCTAssertTrue(deleteAccount.isHittable)
        deleteAccount.tap()

        let confirmation = app.textFields["account-deletion-confirmation"]
        reveal(confirmation, in: app)
        XCTAssertTrue(confirmation.isHittable)
        confirmation.tap()
        confirmation.typeText("DELETE")
        let confirmDelete = app.buttons["account-deletion-submit"]
        reveal(confirmDelete, in: app)
        XCTAssertTrue(confirmDelete.isEnabled)
        confirmDelete.tap()

        let done = app.buttons["Done"]
        XCTAssertTrue(done.waitForExistence(timeout: 15), "Signing out must retain the cleanup results sheet.")
        XCTAssertTrue(app.staticTexts["Removing Permitext sign-in identity"].exists)
        XCTAssertTrue(app.staticTexts["No separate Clerk identity needed removal."].exists)
        XCTAssertFalse(app.buttons["Retry cleanup"].exists, "The isolated account's device cleanup must finish.")
        keepScreenshot(named: "Synthetic account deletion results after sign-out", from: app)
        done.tap()
        XCTAssertTrue(app.staticTexts["Sync status: Not signed in"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["Delete Account"].exists)
#endif
    }

    func testNativeNotebookOfflineSaveKeepsDraftAndRetryRecovers() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase3-entitled-research-fixture", "--permitext-disable-clerk",
            "--native-notebook-reference-fixture", "--native-notebook-save-offline-fixture"]
        app.launch()
        let title = app.textFields["Note title"]
        XCTAssertTrue(title.waitForExistence(timeout: 30))
        title.tap()
        title.typeText(" offline edit")
        let editedTitle = title.value as? String
        let retry = app.buttons["native-notebook-retry-save"]
        XCTAssertTrue(retry.waitForExistence(timeout: 15), "A failed autosave must offer an explicit retry.")
        XCTAssertEqual(title.value as? String, editedTitle)
        keepScreenshot(named: "Offline Note draft with Retry save", from: app)
        retry.tap()
        XCTAssertTrue(app.staticTexts["Synced"].waitForExistence(timeout: 15))
        XCTAssertEqual(title.value as? String, editedTitle)
        XCTAssertFalse(retry.exists)
        XCTAssertFalse(app.buttons["Save"].exists, "A healthy editor should not regain a redundant Save button.")
        keepScreenshot(named: "Recovered Note autosave", from: app)
    }

    @MainActor
    func testNativeNotebookHTTPResponseLossRetriesOriginalMutation() async throws {
#if targetEnvironment(simulator)
        // Start tests/native-notebook-http-fixture.mjs on the Mac first. Both
        // processes use loopback and a synthetic account; no owner data is read.
        let base = URL(string: "http://127.0.0.1:18879")!
        var bootstrap = URLRequest(url: base.appendingPathComponent("fixture/bootstrap"))
        bootstrap.timeoutInterval = 5
        let (data, response) = try await URLSession.shared.data(for: bootstrap)
        XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        let configuration = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let token = try XCTUnwrap(configuration["token"] as? String)
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-http-fixture"]
        app.launchEnvironment["PERMITEXT_NOTEBOOK_HTTP_FIXTURE_URL"] = base.absoluteString
        app.launchEnvironment["PERMITEXT_NOTEBOOK_HTTP_FIXTURE_TOKEN"] = token
        app.launch()
        let title = app.textFields["Note title"]
        XCTAssertTrue(title.waitForExistence(timeout: 30))
        title.tap()
        title.typeText(" HTTP lost response")
        let editedTitle = try XCTUnwrap(title.value as? String)
        let retry = app.buttons["native-notebook-retry-save"]
        XCTAssertTrue(retry.waitForExistence(timeout: 15), "A real lost HTTP acknowledgement must leave an explicit recoverable draft.")
        XCTAssertEqual(title.value as? String, editedTitle)
        keepScreenshot(named: "HTTP response lost after Note creation", from: app)
        retry.tap()
        XCTAssertTrue(app.staticTexts["Synced"].waitForExistence(timeout: 15))
        XCTAssertEqual(title.value as? String, editedTitle)
        XCTAssertFalse(retry.exists)
        XCTAssertFalse(app.buttons["Save"].exists)
        keepScreenshot(named: "Native Note recovered through real HTTP replay", from: app)
        var verification = URLRequest(url: base.appendingPathComponent("fixture/verify"))
        verification.timeoutInterval = 5
        let (verificationData, verificationResponse) = try await URLSession.shared.data(for: verification)
        XCTAssertEqual((verificationResponse as? HTTPURLResponse)?.statusCode, 200,
                       String(data: verificationData, encoding: .utf8) ?? "Missing fixture evidence")
        let result = try XCTUnwrap(JSONSerialization.jsonObject(with: verificationData) as? [String: Any])
        XCTAssertEqual(result["passed"] as? Bool, true)
        XCTAssertEqual(result["title"] as? String, editedTitle)
        XCTAssertEqual(result["saveAttempts"] as? Int, 2)
        XCTAssertEqual(result["notes"] as? Int, 1)
        XCTAssertEqual(result["activities"] as? Int, 1)
#else
        throw XCTSkip("The isolated HTTP fixture is restricted to the existing Simulator.")
#endif
    }

    @MainActor
    func testNativeNotebookRevokedHTTPSessionPreservesDraftAndRestoresReadAccess() async throws {
#if targetEnvironment(simulator)
        // Dedicated --revocation fixture run; never share the response-loss run.
        let base = URL(string: "http://127.0.0.1:18879")!
        func fixture(_ path: String, post: Bool = false) async throws -> [String: Any] {
            var request = URLRequest(url: base.appendingPathComponent(path))
            request.timeoutInterval = 5
            request.httpMethod = post ? "POST" : "GET"
            let (data, response) = try await URLSession.shared.data(for: request)
            XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200,
                           String(data: data, encoding: .utf8) ?? "Missing fixture evidence")
            return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        }
        let configuration = try await fixture("fixture/bootstrap")
        XCTAssertEqual(configuration["mode"] as? String, "revocation")
        let token = try XCTUnwrap(configuration["token"] as? String)
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-http-fixture"]
        app.launchEnvironment["PERMITEXT_NOTEBOOK_HTTP_FIXTURE_URL"] = base.absoluteString
        app.launchEnvironment["PERMITEXT_NOTEBOOK_HTTP_FIXTURE_TOKEN"] = token
        app.launch()
        let title = app.textFields["Note title"]
        XCTAssertTrue(title.waitForExistence(timeout: 30))
        title.tap()
        title.typeText(" Synthetic revocation record")
        let originalTitle = try XCTUnwrap(title.value as? String)
        XCTAssertTrue(app.staticTexts["Synced"].waitForExistence(timeout: 15))
        _ = try await fixture("fixture/revoke", post: true)
        title.tap()
        title.typeText(" pending after revocation")
        let pendingTitle = try XCTUnwrap(title.value as? String)
        let retrySave = app.buttons["native-notebook-retry-save"]
        XCTAssertTrue(retrySave.waitForExistence(timeout: 15))
        XCTAssertEqual(title.value as? String, pendingTitle)
        XCTAssertFalse(app.buttons["Save"].exists)
        keepScreenshot(named: "Revoked synthetic HTTP session preserves unsaved Note draft", from: app)
        retrySave.tap()
        XCTAssertTrue(retrySave.waitForExistence(timeout: 15))
        XCTAssertEqual(title.value as? String, pendingTitle)

        // A fresh isolated harness has no cached list to disguise a denied read.
        // The draft assertion above concerns the live editor, not cross-login persistence.
        app.terminate()
        app.launchArguments.append("--native-notebook-http-list-fixture")
        app.launch()
        let retryLoad = app.buttons["native-notebook-retry"]
        XCTAssertTrue(retryLoad.waitForExistence(timeout: 30))
        XCTAssertTrue(app.staticTexts["Notebook unavailable"].exists)
        XCTAssertFalse(app.staticTexts["No Notes yet"].exists)
        keepScreenshot(named: "Revoked synthetic HTTP session shows recoverable Notebook read error", from: app)
        let renewed = try await fixture("fixture/reauthenticate", post: true)
        app.terminate()
        app.launchEnvironment["PERMITEXT_NOTEBOOK_HTTP_FIXTURE_TOKEN"] = try XCTUnwrap(renewed["token"] as? String)
        app.launch()
        XCTAssertTrue(app.staticTexts[originalTitle].waitForExistence(timeout: 30))
        XCTAssertFalse(app.staticTexts[pendingTitle].exists)
        XCTAssertFalse(retryLoad.exists)
        keepScreenshot(named: "Reauthenticated synthetic account restores its original Note", from: app)
        let evidence = try await fixture("fixture/verify-revocation")
        XCTAssertEqual(evidence["passed"] as? Bool, true)
        XCTAssertEqual(evidence["notes"] as? Int, 1)
        XCTAssertEqual(evidence["activities"] as? Int, 1)
        XCTAssertEqual(evidence["originalTitle"] as? String, originalTitle)
#else
        throw XCTSkip("The isolated HTTP fixture is restricted to the existing Simulator.")
#endif
    }

    func testNativeProjectPartialLookupWarningRemainsSaveable() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-project-partial-lookup-fixture"]
        app.launch()
        let name = app.textFields["e.g. Bronx R-2 Passive House"]
        XCTAssertTrue(name.waitForExistence(timeout: 30))
        name.tap()
        name.typeText("Synthetic partial lookup")
        let address = app.descendants(matching: .any)["project-editor-address"]
        XCTAssertTrue(address.exists)
        address.tap()
        address.typeText("100 Synthetic Fixture Street")
        let description = app.descendants(matching: .any)["project-editor-description"]
        description.tap() // Address blur exercises the real lookup handler.
        description.typeText("Preserve this draft.")
        let warning = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "Mapped-area facts were unavailable.")).firstMatch
        XCTAssertTrue(warning.waitForExistence(timeout: 15))
        XCTAssertTrue(warning.label.contains("Imported 1 sourced facts from NYC Planning."))
        XCTAssertEqual(address.value as? String, "100 SYNTHETIC FIXTURE STREET, NEW YORK, NY")
        let save = app.buttons["Save"]
        XCTAssertTrue(save.isEnabled)
        keepScreenshot(named: "Native partial property lookup warning retains saveable project", from: app)
        save.tap()
        let summary = app.staticTexts["native-partial-lookup-saved-summary"]
        XCTAssertTrue(summary.waitForExistence(timeout: 10))
        XCTAssertTrue(summary.label.contains("Synthetic partial lookup"))
        XCTAssertTrue(summary.label.contains("100 SYNTHETIC FIXTURE STREET, NEW YORK, NY"))
        XCTAssertTrue(summary.label.contains("Preserve this draft."))
        XCTAssertTrue(summary.label.contains("Facts: 1. Stories: 3."))
        keepScreenshot(named: "Native partial lookup saves available synthetic facts", from: app)
    }

    func testNativeNotebookFirstLoadFailureShowsRetryAndRecovers() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-retry-fixture"]
        app.launch()
        let retry = app.buttons["native-notebook-retry"]
        XCTAssertTrue(retry.waitForExistence(timeout: 30), "First-load failure must be visible and recoverable.")
        XCTAssertFalse(app.staticTexts["No Notes yet"].exists, "A load failure is not an empty Notebook.")
        keepScreenshot(named: "Native Notebook first-load retry", from: app)
        retry.tap()
        XCTAssertTrue(app.staticTexts["No Notes yet"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["New Note"].exists, "Successful retry must restore server-authorized editing.")
    }

    func testNativeNotebookConflictRequiresReviewAndDeletionDoesNotRestoreDraft() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-conflict-fixture"]
        app.launch()
        let review = app.buttons["native-notebook-review-conflict"]
        XCTAssertTrue(review.waitForExistence(timeout: 30))
        XCTAssertFalse(app.buttons["Save"].isEnabled, "A reopened stale draft must not silently adopt the latest version.")
        review.tap()
        XCTAssertTrue(app.staticTexts["Your draft"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["My local draft is still preserved."].exists)
        XCTAssertTrue(app.staticTexts["Another device saved this analysis."].exists)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Native Notebook explicit conflict review"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        app.buttons["native-notebook-confirm-conflict"].tap()
        XCTAssertTrue(app.staticTexts["Synced"].waitForExistence(timeout: 10))
        app.buttons["Delete"].tap()
        app.buttons["Delete Note"].tap()
        XCTAssertTrue(app.staticTexts["No Notes yet"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["Drafts on this iPhone"].exists)
    }

    func testResearchLateCompletionCannotReplaceNewConversation() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--phase3-seeded-selection-fixture", "--research-delayed-response-fixture"]
        app.launch()
        let composer = element(in: app, identifier: "research-composer")
        XCTAssertTrue(composer.waitForExistence(timeout: 45), phase3LaunchFailureDescription(in: app))
        composer.tap()
        composer.typeText("Synthetic delayed private question")
        app.buttons["Send Research question"].tap()
        let disclosure = app.buttons["Continue to Research"]
        if disclosure.waitForExistence(timeout: 2) { disclosure.tap() }
        XCTAssertTrue(app.buttons["research-cancel-request"].waitForExistence(timeout: 3))
        app.buttons["Research history"].tap()
        app.buttons["New Research"].tap()
        XCTAssertTrue(composer.waitForExistence(timeout: 5))
        let oldAnswer = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "The selected enacted provision controls")).firstMatch
        let noStaleAnswer = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true"), object: oldAnswer)
        noStaleAnswer.isInverted = true
        XCTAssertEqual(XCTWaiter.wait(for: [noStaleAnswer], timeout: 7), .completed)
        XCTAssertFalse(app.staticTexts["Synthetic delayed private question"].exists)
        XCTAssertFalse(app.buttons["research-cancel-request"].exists)
    }

    func testResearchAnswerGuidesReviewBeforeNotebookAndWebReport() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--phase3-seeded-selection-fixture"]
        app.launch()
        let composer = element(in: app, identifier: "research-composer")
        XCTAssertTrue(composer.waitForExistence(timeout: 45))
        composer.tap()
        composer.typeText("Synthetic next-step guidance question")
        app.buttons["Send Research question"].tap()
        let disclosure = app.buttons["Continue to Research"]
        if disclosure.waitForExistence(timeout: 2) { disclosure.tap() }
        XCTAssertTrue(element(in: app, identifier: "research-answer").waitForExistence(timeout: 15))
        let guidance = element(in: app, identifier: "research-next-step-guidance")
        reveal(guidance, in: app)
        XCTAssertTrue(guidance.isHittable)
        XCTAssertTrue(guidance.label.contains("your own conclusion in a Project Note"))
        XCTAssertTrue(guidance.label.contains("Build Reports on Permitext Web"))
        keepScreenshot(named: "Research review to Notebook and Web Report guidance", from: app)
    }

    func testOneHundredReaderBookmarkProjectsCycles() {
        let app = XCUIApplication()
        app.launchArguments += [
            "--native-reader-physical-stress",
            "--native-reader-rollout-stage",
            "isolated-table-fallback"
        ]
        app.launch()

        let nativeReader = element(in: app, identifier: "native-reader-ready")
        XCTAssertTrue(
            nativeReader.waitForExistence(timeout: 45),
            launchFailureDescription(in: app)
        )

        let iterations = max(
            1,
            Int(ProcessInfo.processInfo.environment["PERMITEXT_STRESS_ITERATIONS"] ?? "") ?? 100
        )
        let iterationEvidence = XCTAttachment(string: "Resolved stress iterations: \(iterations)")
        iterationEvidence.name = "Resolved stress iterations: \(iterations)"
        iterationEvidence.lifetime = .keepAlways
        add(iterationEvidence)
        runCycles(iterations, in: app)
    }

    func testReaderBookmarkProjectCycle() {
        let app = XCUIApplication()
        app.launchArguments += [
            "--native-reader-physical-stress",
            "--native-reader-rollout-stage",
            "isolated-table-fallback"
        ]
        app.launch()

        let nativeReader = element(in: app, identifier: "native-reader-ready")
        XCTAssertTrue(
            nativeReader.waitForExistence(timeout: 45),
            launchFailureDescription(in: app)
        )

        runCycles(1, in: app)
    }

    func testFormerHTMLOnlyPlumbingChapterOneOpensNatively() {
        let app = XCUIApplication()
        app.launchArguments += [
            "--native-reader-universal-plumbing-test",
            "--native-reader-rollout-stage",
            "isolated-table-fallback"
        ]
        app.launch()

        XCTAssertTrue(
            element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45),
            launchFailureDescription(in: app)
        )
        let edition = element(in: app, identifier: "reader-source-edition")
        XCTAssertTrue(edition.waitForExistence(timeout: 10))
        XCTAssertTrue(edition.label.contains("Plumbing Code") && edition.label.contains("2022"),
            "The native Reader must identify the code family and edition.")

        let attachment = XCTAttachment(screenshot: app.screenshot(), quality: .medium)
        attachment.name = "Plumbing Code Chapter 1 native Reader"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func test1968BuildingChapterOneOpensWithMatchingSourceAndText() {
        let app = XCUIApplication()
        app.launchArguments += ["--permitext-disable-clerk", "--native-reader-1968-building-chapter-1"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45),
                      launchFailureDescription(in: app))
        let edition = element(in: app, identifier: "reader-source-edition")
        XCTAssertTrue(edition.waitForExistence(timeout: 10))
        XCTAssertTrue(edition.label.contains("1968"), edition.label)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "27-101")).firstMatch.exists)
        let titleText = app.descendants(matching: .any).matching(NSPredicate(
            format: "label CONTAINS %@ OR value CONTAINS %@",
            "1968 building code of the city of New York", "1968 building code of the city of New York"
        )).firstMatch
        XCTAssertTrue(titleText.waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["Chapter HTML Missing"].exists)
        keepScreenshot(named: "1968 Building Code Chapter 1 matching source and text", from: app)
        let building = app.links.matching(NSPredicate(format: "label ==[c] %@", "building")).firstMatch
        XCTAssertTrue(building.waitForExistence(timeout: 10), app.debugDescription)
        let originalFrame = building.frame
        building.tap()
        let closeDefinition = app.buttons["Close definition"]
        XCTAssertTrue(closeDefinition.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "27-232")).firstMatch.exists)
        keepScreenshot(named: "1968 BUILDING definition popover", from: app)
        closeDefinition.tap()
        XCTAssertFalse(closeDefinition.exists)
        XCTAssertTrue(edition.label.contains("1968"))
        XCTAssertEqual(building.frame.minY, originalFrame.minY, accuracy: 2)
    }

    func testNativeHousingDefinitionUsesItsSectionMeaning() {
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-housing-scoped-definition"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45), launchFailureDescription(in: app))
        let edition = element(in: app, identifier: "reader-source-edition")
        XCTAssertTrue(edition.label.contains("Housing Maintenance"), edition.label)
        let term = app.links.matching(NSPredicate(format: "label ==[c] %@", "private dwelling")).firstMatch
        for _ in 0..<8 {
            if term.exists && term.isHittable { break }
            app.swipeUp()
        }
        XCTAssertTrue(term.exists && term.isHittable, app.debugDescription)
        guard term.exists && term.isHittable else { return }
        let before = term.frame.minY
        term.tap()
        let close = app.buttons["Close definition"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "27-2045")).firstMatch.exists)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "occupied by a person or persons other than the owner")).firstMatch.exists)
        keepScreenshot(named: "Native HMC scoped private dwelling definition", from: app)
        close.tap()
        XCTAssertFalse(close.exists)
        XCTAssertEqual(term.frame.minY, before, accuracy: 2)
    }

    func testNative2014MechanicalSystemsOutsideSeismicScopeHasNoDefinitionLink() {
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-seismic-outside-scope"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45), launchFailureDescription(in: app))
        let edition = element(in: app, identifier: "reader-source-edition")
        XCTAssertTrue(edition.label.contains("2014"), edition.label)
        let requiredText = "Plumbing and mechanical systems shall not be located in an elevator shaft."
        let passage = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@ OR value CONTAINS %@", requiredText, requiredText)).firstMatch
        XCTAssertTrue(passage.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(passage.isHittable, "The actual out-of-scope source paragraph must be visible.")
        XCTAssertFalse(app.links.matching(NSPredicate(format: "label ==[c] %@", "mechanical systems")).firstMatch.exists)
        XCTAssertFalse(app.buttons["Close definition"].exists)
        keepScreenshot(named: "2014 BC 3004.4 mechanical systems remains ordinary source text", from: app)
    }

    func testNative2014SeismicSiteClassOpensScopedDefinitionAndReturns() {
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-seismic-inside-scope"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45), launchFailureDescription(in: app))
        let edition = element(in: app, identifier: "reader-source-edition")
        XCTAssertTrue(edition.label.contains("2014"), edition.label)
        let term = app.links.matching(NSPredicate(format: "label ==[c] %@", "site class")).firstMatch
        XCTAssertTrue(term.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(term.isHittable)
        guard term.exists && term.isHittable else { return }
        let before = term.frame.minY
        term.tap()
        let close = app.buttons["Close definition"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "1613.2")).firstMatch.exists)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "types of soils present")).firstMatch.exists)
        keepScreenshot(named: "2014 seismic site class definition inside section 1613", from: app)
        close.tap()
        XCTAssertFalse(close.exists)
        XCTAssertEqual(term.frame.minY, before, accuracy: 2)
        keepScreenshot(named: "2014 seismic passage position retained after definition dismissal", from: app)
    }

    func testReaderEditionSelectionSurvivesOtherReaderVisit() {
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk"]
        app.launch()
        let explore = app.buttons["phase5-first-use-explore"]
        if explore.waitForExistence(timeout: 5) { explore.tap() }
        let second = app.tabBars.buttons["Second reader"]
        XCTAssertTrue(second.waitForExistence(timeout: 45))
        second.tap()
        let edition = app.staticTexts["reader-source-edition"]
        XCTAssertTrue(edition.waitForExistence(timeout: 45))
        let secondEdition = edition.label
        app.tabBars.buttons["First reader"].tap()
        let picker = app.buttons["reader-code-picker"]
        XCTAssertTrue(picker.waitForExistence(timeout: 15))
        picker.tap()
        let historical = app.collectionViews.buttons["1968 Building Code"]
        XCTAssertTrue(historical.waitForExistence(timeout: 10))
        historical.tap()
        XCTAssertTrue(app.buttons["reader-code-picker"].waitForExistence(timeout: 30))
        let primaryTitle = app.buttons["reader-code-picker"].label
        XCTAssertTrue(primaryTitle.contains("1968"), primaryTitle)
        second.tap()
        XCTAssertTrue(edition.waitForExistence(timeout: 15))
        XCTAssertEqual(edition.label, secondEdition)
        app.tabBars.buttons["First reader"].tap()
        XCTAssertEqual(app.buttons["reader-code-picker"].label, primaryTitle)
        keepScreenshot(named: "First Reader retains 1968 after Second Reader visit", from: app)
        second.tap()
        app.buttons["reader-code-picker"].tap()
        let existing = app.collectionViews.buttons["Existing Building Code"]
        XCTAssertTrue(existing.waitForExistence(timeout: 10))
        existing.tap()
        XCTAssertTrue(app.buttons["reader-code-picker"].waitForExistence(timeout: 30))
        let secondaryTitle = app.buttons["reader-code-picker"].label
        XCTAssertTrue(secondaryTitle.localizedCaseInsensitiveContains("Existing Building"), secondaryTitle)
        app.tabBars.buttons["First reader"].tap()
        XCTAssertEqual(app.buttons["reader-code-picker"].label, primaryTitle)
        second.tap()
        XCTAssertEqual(app.buttons["reader-code-picker"].label, secondaryTitle)
        keepScreenshot(named: "Second Reader retains Existing Building Code independently", from: app)
        let chapterOne = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Chapter 1:")).firstMatch
        XCTAssertTrue(chapterOne.waitForExistence(timeout: 15))
        chapterOne.tap()
        XCTAssertTrue(app.buttons["Jump within chapter"].waitForExistence(timeout: 45))
        let secondarySource = element(in: app, identifier: "reader-source-edition").label
        app.tabBars.buttons["First reader"].tap()
        XCTAssertTrue(chapterOne.waitForExistence(timeout: 15))
        chapterOne.tap()
        XCTAssertTrue(app.buttons["Jump within chapter"].waitForExistence(timeout: 45))
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45))
        // Exercise a genuinely scrolled passage, rather than accepting only
        // the chapter's initial viewport. Keep the gesture inside reader text.
        let initialPassages = Set(app.textViews.matching(NSPredicate(
            format: "identifier BEGINSWITH %@", "native-reader-block-"
        )).allElementsBoundByIndex.filter { $0.isHittable }.map(\.identifier))
        for _ in 0..<3 {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72))
                .press(forDuration: 0.1, thenDragTo:
                    app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.30)))
        }
        guard let passage = app.textViews.matching(NSPredicate(format: "identifier BEGINSWITH %@", "native-reader-block-"))
            .allElementsBoundByIndex.first(where: { $0.isHittable }) else {
            XCTFail("The restored 1968 Reader must expose a visible passage")
            return
        }
        let passageID = passage.identifier
        let primaryY = passage.frame.minY
        XCTAssertFalse(initialPassages.contains(passageID), "Must verify a passage beyond the opening viewport")
        second.tap()
        XCTAssertTrue(app.buttons["Jump within chapter"].waitForExistence(timeout: 15))
        XCTAssertEqual(element(in: app, identifier: "reader-source-edition").label, secondarySource)
        app.tabBars.buttons["First reader"].tap()
        let restoredPassage = app.textViews[passageID]
        XCTAssertTrue(restoredPassage.waitForExistence(timeout: 15))
        XCTAssertTrue(restoredPassage.isHittable, "The saved deep passage must remain visible after switching Readers")
        XCTAssertEqual(restoredPassage.frame.minY, primaryY, accuracy: 4)
        keepScreenshot(named: "First Reader chapter retained after other open Reader visit", from: app)
        // Popping a chapter exercises navigation geometry that a tab switch
        // and a process relaunch do not. Reopening must retain the exact offset.
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(chapterOne.waitForExistence(timeout: 15))
        chapterOne.tap()
        XCTAssertTrue(restoredPassage.waitForExistence(timeout: 45))
        XCTAssertEqual(restoredPassage.frame.minY, primaryY, accuracy: 4)
        keepScreenshot(named: "Deep Reader position after chapter reopen", from: app)
        app.terminate()
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["First reader"].waitForExistence(timeout: 45))
        app.tabBars.buttons["First reader"].tap()
        if chapterOne.waitForExistence(timeout: 3) { chapterOne.tap() }
        XCTAssertTrue(restoredPassage.waitForExistence(timeout: 45))
        // Existence can include the hidden lazy list while the noninteractive
        // opening preview is visible. Assert geometry only after it is usable.
        let restoredPassageReady = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            restoredPassage.isHittable && restoredPassage.frame.minY.isFinite
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [restoredPassageReady], timeout: 15), .completed,
                       "The restored passage must become interactive after opening")
        XCTAssertEqual(restoredPassage.frame.minY, primaryY, accuracy: 4)
        keepScreenshot(named: "Deep Reader position after process relaunch", from: app)
    }

    func testFreshProcessReaderContentAcrossEditions() {
        for (argument, source) in [
            ("--native-reader-1968-building-chapter-1", "1968"),
            ("--native-reader-2014-building-chapter-7", "2014"),
            ("--native-reader-universal-plumbing-test", "2022")
        ] {
            let app = XCUIApplication()
            app.launchArguments = ["--permitext-disable-clerk", argument]
            let start = ProcessInfo.processInfo.systemUptime
            app.launch()
            XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45))
            let passage = app.textViews.matching(NSPredicate(format: "identifier BEGINSWITH %@", "native-reader-block-")).firstMatch
            XCTAssertTrue(passage.waitForExistence(timeout: 15))
            XCTAssertTrue(element(in: app, identifier: "reader-source-edition").label.contains(source))
            XCTAssertFalse(app.staticTexts["Chapter HTML Missing"].exists)
            XCTAssertFalse(app.staticTexts["Preparing native Reader…"].exists)
            print("READER_COLD_UI source=\(source) launchThroughAccessibleTextSeconds=\(ProcessInfo.processInfo.systemUptime - start)")
            keepScreenshot(named: "Fresh process Reader \(source)", from: app)
            app.terminate()
        }
    }

    func testDefinitionsChapterDoesNotDecorateDefinitionTerms() {
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-1968-building-chapter-1", "--native-reader-definitions-chapter"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "27-229")).firstMatch.waitForExistence(timeout: 10))
        XCTAssertFalse(app.links.matching(NSPredicate(format: "label ==[c] %@", "terms")).firstMatch.exists)
        XCTAssertFalse(app.links.matching(NSPredicate(format: "label ==[c] %@", "shall")).firstMatch.exists)
        XCTAssertFalse(app.buttons["Close definition"].exists)
        keepScreenshot(named: "1968 Definitions chapter without generated term links", from: app)
    }

    func testSearchFinds1968SectionAndOpensItsEdition() {
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk"]
        app.launch()
        let explore = app.buttons["phase5-first-use-explore"]
        if explore.waitForExistence(timeout: 5) { explore.tap() }
        let searchTab = app.tabBars.buttons["Search"]
        XCTAssertTrue(searchTab.waitForExistence(timeout: 45))
        searchTab.tap()
        let field = app.textFields["Search codes"]
        XCTAssertTrue(field.waitForExistence(timeout: 15))
        if app.buttons["Clear search"].exists { app.buttons["Clear search"].tap() }
        field.tap()
        field.typeText("27-598\n")
        if app.buttons["All Codes"].waitForExistence(timeout: 2) { app.buttons["All Codes"].tap() }
        if app.buttons["Search All Codes"].exists { app.buttons["Search All Codes"].tap() }
        let result = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "27-598")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 45), app.debugDescription)
        result.tap()
        let edition = element(in: app, identifier: "reader-source-edition")
        XCTAssertTrue(edition.waitForExistence(timeout: 30))
        XCTAssertTrue(edition.label.contains("1968"), edition.label)
        let historicalHeading = app.textViews.matching(NSPredicate(
            format: "identifier BEGINSWITH %@ AND (label CONTAINS[c] %@ OR value CONTAINS[c] %@)",
            "native-reader-block-", "27-598 Core tests", "27-598 Core tests"
        )).firstMatch
        let currentSection = app.buttons["Jump within chapter"]
        let historicalReady = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            historicalHeading.exists && historicalHeading.isHittable && historicalHeading.frame.minY.isFinite
                && currentSection.exists && currentSection.isHittable
                && (currentSection.value as? String)?.hasPrefix("27-598 ") == true
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [historicalReady], timeout: 20), .completed,
                       "Search must visibly land on 27-598, not merely instantiate an offscreen matching block.")
        keepScreenshot(named: "1968 section 27-598 opened from Search", from: app)
        searchTab.tap()
        XCTAssertTrue(field.waitForExistence(timeout: 15))
        XCTAssertEqual(field.value as? String, "27-598")
        app.buttons["Clear search"].tap()
        field.tap()
        field.typeText("722.2.1.1\n")
        let building2022 = app.buttons.matching(NSPredicate(
            format: "label CONTAINS[c] %@ AND label CONTAINS %@", "Building Code", "2022"
        )).firstMatch
        XCTAssertTrue(building2022.waitForExistence(timeout: 45))
        building2022.tap()
        let modernResult = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "722.2.1.1")).firstMatch
        XCTAssertTrue(modernResult.waitForExistence(timeout: 15))
        modernResult.tap()
        XCTAssertTrue(edition.waitForExistence(timeout: 30))
        XCTAssertTrue(edition.label.contains("2022"), edition.label)
        keepScreenshot(named: "2022 destination before title assertion", from: app)
        XCTAssertTrue(app.descendants(matching: .any).matching(NSPredicate(
            format: "label CONTAINS[c] %@ OR value CONTAINS[c] %@",
            "Cast-in-place or precast walls", "Cast-in-place or precast walls"
        )).firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        let modernHeading = app.textViews.matching(NSPredicate(
            format: "identifier BEGINSWITH %@ AND (label CONTAINS[c] %@ OR value CONTAINS[c] %@)",
            "native-reader-block-", "722.2.1.1 Cast-in-place", "722.2.1.1 Cast-in-place"
        )).firstMatch
        let modernReady = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            modernHeading.exists && modernHeading.isHittable && modernHeading.frame.minY.isFinite
                && currentSection.exists && currentSection.isHittable
                && (currentSection.value as? String)?.hasPrefix("722.2.1.1 ") == true
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [modernReady], timeout: 20), .completed)
        keepScreenshot(named: "2022 result after replacing 1968 Search query", from: app)
    }

    func testFuelGasWideTableRevealsAdditionalColumns() {
        verifyFuelGasWideTableScrolling(searchQuery: "")
    }

    func testFuelGasWideTableRevealsAdditionalColumnsWithSearchHighlight() {
        verifyFuelGasWideTableScrolling(searchQuery: "Height")
    }

    private func verifyFuelGasWideTableScrolling(searchQuery: String) {
        let app = XCUIApplication()
        app.launchArguments += [
            "--permitext-disable-clerk",
            "--native-reader-phase9-source",
            "2022-construction-codes/code-sections/fuel-gas-code/chapters/Chapter 5.html",
            "--native-reader-phase9-width", "402",
            "--native-reader-phase9-starting-block-id",
            "a7908a861e51616537a08610301489546d5a2f778639c8988fb2287483e8fb0e",
            "--native-reader-phase9-search", searchQuery
        ]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase9-snapshot-ready").waitForExistence(timeout: 45))
        let webView = app.webViews.firstMatch
        XCTAssertTrue(webView.waitForExistence(timeout: 20))
        let heightHeader = webView.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Height")).firstMatch
        XCTAssertTrue(heightHeader.waitForExistence(timeout: 15), webView.debugDescription)
        keepScreenshot(named: "Fuel Gas 504.2(1) before horizontal swipe", from: app)
        XCTAssertTrue(heightHeader.isHittable, "The table must initially show its Height column.")
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.30))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.30))
        start.press(forDuration: 0.05, thenDragTo: end)
        // WebKit removes horizontally clipped cells from its accessibility tree.
        // Query visibility, rather than requesting the old cell's remote frame.
        let moved = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "hittable == false"), object: heightHeader
        )
        let outcome = XCTWaiter.wait(for: [moved], timeout: 5)
        keepScreenshot(named: "Fuel Gas 504.2(1) after horizontal swipe", from: app)
        XCTAssertEqual(outcome, .completed, "A sideways swipe must expose additional table columns.")
    }

    func testBuildingCodeChapterThreeReaderLayoutRegression() {
        let app = XCUIApplication()
        app.launchArguments += [
            "--native-reader-phase9-source",
            "2022-construction-codes/code-sections/building-code/chapters/3.html",
            "--native-reader-phase9-width",
            "402"
        ]
        app.launch()

        XCTAssertTrue(
            element(in: app, identifier: "phase9-snapshot-ready").waitForExistence(timeout: 45),
            "BC Chapter 3 did not load in the native-reader snapshot harness."
        )

        let printing = element(
            in: app,
            identifier: "native-reader-block-5ffec5828fc084e16a8fdbefa3d744f98e384d9720071b5e691232100da64286"
        )
        scrollToHittable(printing, in: app)
        XCTAssertFalse(printing.label.contains("\n"), "The compact use line contains formatting line breaks.")
        keepScreenshot(named: "BC Chapter 3 compact use text", from: app)

        let table = element(
            in: app,
            identifier: "native-reader-block-6160c549e63ae24a17ea54463e5eb804682063b9731b05b5bf0c6adf553429bf"
        )
        scrollToHittable(table, in: app)
        keepScreenshot(named: "BC Table 307.1(1) single header", from: app)

        let siConversion = element(
            in: app,
            identifier: "native-reader-block-772423bbeca6fef89665b5b1d9585f6c0cc615e643ec509f1191d00a7f3ef1f0"
        )
        scrollToHittable(siConversion, in: app, maximumSwipes: 80)
        XCTAssertFalse(siConversion.label.contains("\n"), "The SI conversion note contains formatting line breaks.")
        app.swipeUp()
        keepScreenshot(named: "BC Table 307.1(1) compact notes", from: app)
    }

    func test2014BuildingCodeNativeFigureAndStructuredTableRegression() {
        let app = XCUIApplication()
        app.launchArguments += [
            "--permitext-disable-clerk",
            "--native-reader-phase9-source",
            "2014-construction-codes/chapters/bc-7.html",
            "--native-reader-phase9-width",
            "402",
            "--native-reader-phase9-starting-block-id",
            "4a3b7d7a0dbf982ecaa5d49ef7fee970a187ed14556c16c3bf486eeb299f7e31"
        ]
        app.launch()

        XCTAssertTrue(
            element(in: app, identifier: "phase9-snapshot-ready").waitForExistence(timeout: 45),
            "2014 BC Chapter 7 did not load in the native-reader snapshot harness."
        )

        let figure7057 = app.buttons[
            "native-reader-block-4a3b7d7a0dbf982ecaa5d49ef7fee970a187ed14556c16c3bf486eeb299f7e31"
        ]
        XCTAssertTrue(figure7057.waitForExistence(timeout: 10))
        XCTAssertTrue(figure7057.label.localizedCaseInsensitiveContains("FIGURE 705.7"))
        keepScreenshot(named: "2014 BC Figure 705.7 local native media", from: app)

        app.terminate()
        app.launchArguments = [
            "--permitext-disable-clerk",
            "--native-reader-phase9-source",
            "2014-construction-codes/chapters/bc-7.html",
            "--native-reader-phase9-width",
            "402",
            "--native-reader-phase9-starting-block-id",
            "d3aee5b764583aff8f6b3713382a571cb588c43e4600cdeff05f8740894dc4b9"
        ]
        app.launch()

        XCTAssertTrue(
            element(in: app, identifier: "phase9-snapshot-ready").waitForExistence(timeout: 45),
            "2014 BC Chapter 7 table snapshot did not load in the native-reader harness."
        )
        let table7058 = element(
            in: app,
            identifier: "native-reader-block-d3aee5b764583aff8f6b3713382a571cb588c43e4600cdeff05f8740894dc4b9"
        )
        XCTAssertTrue(table7058.waitForExistence(timeout: 10))
        XCTAssertTrue(
            app.staticTexts
                .matching(NSPredicate(format: "label CONTAINS[c] %@", "TABLE 705.8"))
                .firstMatch
                .waitForExistence(timeout: 10)
        )
        XCTAssertTrue(
            app.staticTexts
                .matching(NSPredicate(format: "label CONTAINS[c] %@", "FIRE SEPARATION DISTANCE"))
                .firstMatch
                .waitForExistence(timeout: 10)
        )
        keepScreenshot(named: "2014 BC Table 705.8 native merged header", from: app)

        app.terminate()
        app.launchArguments = [
            "--permitext-disable-clerk",
            "--native-reader-phase9-source",
            "2014-construction-codes/chapters/bc-10.html",
            "--native-reader-phase9-width",
            "402",
            "--native-reader-phase9-starting-block-id",
            "dbdc43066e5bd33db04c83d38806ebcb9bec8b760a50192c33bc7bd1ee5043b0"
        ]
        app.launch()

        XCTAssertTrue(
            element(in: app, identifier: "phase9-snapshot-ready").waitForExistence(timeout: 45),
            "2014 BC Chapter 10 did not load in the native-reader snapshot harness."
        )
        let table100411 = element(
            in: app,
            identifier: "native-reader-block-dbdc43066e5bd33db04c83d38806ebcb9bec8b760a50192c33bc7bd1ee5043b0"
        )
        XCTAssertTrue(table100411.waitForExistence(timeout: 10))
        XCTAssertTrue(
            app.staticTexts
                .matching(NSPredicate(format: "label CONTAINS[c] %@", "TABLE 1004.1.1"))
                .firstMatch
                .waitForExistence(timeout: 10)
        )
        keepScreenshot(named: "2014 BC Table 1004.1.1 native formatted cells", from: app)
    }

    func testFuelGasChapterOneCrossCodeLinkOpensTitle28() {
        let app = XCUIApplication()
        app.launchArguments += [
            "--native-reader-cross-code-link-test",
            "--native-reader-rollout-stage",
            "isolated-table-fallback"
        ]
        app.launch()

        XCTAssertTrue(
            element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45),
            launchFailureDescription(in: app)
        )
        let sourceHeading = app.staticTexts
            .matching(NSPredicate(format: "label CONTAINS[c] %@", "102.2.1 Existing buildings"))
            .firstMatch
        XCTAssertTrue(
            sourceHeading.waitForExistence(timeout: 10),
            "Fuel Gas 102.2.1 did not settle at the deterministic link-test viewport."
        )

        // UITextView attributed links are not exposed as XCUI descendants on
        // this layout. Tap the visible, underlined "Chapter 1 of" run itself.
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.185)).tap()

        let title28NavigationBar = app.navigationBars["28-101.1"]
        XCTAssertTrue(
            title28NavigationBar.waitForExistence(timeout: 10),
            "Tapping Chapter 1 of Title 28 did not navigate to 28-101.1."
        )

        let attachment = XCTAttachment(screenshot: app.screenshot(), quality: .medium)
        attachment.name = "Fuel Gas Chapter 1 link opened Title 28"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testFuelGasArticle103LinkOpensTitle28() {
        assertCrossCodeLink(
            sectionNumber: "102.8",
            tapOffset: CGVector(dx: 0.50, dy: 0.27),
            expectedDestination: "28-103.1",
            name: "Article 103"
        )
    }

    func testFuelGasArticle105LinkOpensTitle28() {
        assertCrossCodeLink(
            sectionNumber: "106.1",
            tapOffset: CGVector(dx: 0.75, dy: 0.17),
            expectedDestination: "28-105.1",
            name: "Article 105"
        )
    }

    func testReaderRestoresInteractiveEdgeSwipeBack() {
        let app = XCUIApplication()
        app.launch()

        let chapter = app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH[c] %@", "Chapter "))
            .firstMatch
        XCTAssertTrue(chapter.waitForExistence(timeout: 20), "No chapter card was available to open.")
        chapter.tap()

        XCTAssertTrue(
            app.buttons["Jump within chapter"].waitForExistence(timeout: 30),
            "The chapter Reader did not open."
        )

        let screen = app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
        screen.withOffset(CGVector(dx: 2, dy: app.frame.height * 0.52)).press(
            forDuration: 0.08,
            thenDragTo: screen.withOffset(CGVector(dx: app.frame.width * 0.82, dy: app.frame.height * 0.52))
        )

        XCTAssertTrue(
            chapter.waitForExistence(timeout: 10),
            "The standard left-edge swipe did not return from the Reader to the chapter grid."
        )
    }

    func testPhase5FirstUseSheetShowsOfflineResearchExampleAndOpensCitation() {
        let app = XCUIApplication()
        app.launchArguments += [
            "--phase5-first-use-fixture",
            "--native-reader-rollout-stage",
            "isolated-table-fallback"
        ]
        app.launch()

        let sheet = element(in: app, identifier: "phase5-first-use-sheet")
        XCTAssertTrue(sheet.waitForExistence(timeout: 45), launchFailureDescription(in: app))
        XCTAssertTrue(app.staticTexts["NYC code research you can verify."].exists)
        XCTAssertTrue(element(in: app, identifier: "phase5-first-use-explore").exists)
        XCTAssertTrue(element(in: app, identifier: "phase5-first-use-sign-in").exists)

        let exampleAction = element(in: app, identifier: "phase5-first-use-research-example")
        XCTAssertTrue(exampleAction.exists)
        exampleAction.tap()

        let example = element(in: app, identifier: "phase5-first-use-static-example")
        XCTAssertTrue(example.waitForExistence(timeout: 5), "The static Research example did not appear.")
        XCTAssertTrue(app.staticTexts["Static cited example"].exists)
        XCTAssertTrue(app.staticTexts["Offline"].exists)
        XCTAssertTrue(app.staticTexts["Example answer"].exists)
        let trustBoundary = app.staticTexts["AI-assisted—not an official interpretation."]
        reveal(trustBoundary, in: app)
        XCTAssertTrue(
            trustBoundary.exists,
            "The Research trust boundary is absent from first use."
        )

        let citation = app.buttons.matching(
            NSPredicate(format: "label BEGINSWITH %@", "Open BC § 101.1")
        ).firstMatch
        reveal(citation, in: app)
        XCTAssertTrue(citation.isHittable, "The real bundled citation could not be reached.")
        citation.tap()

        XCTAssertTrue(
            app.buttons["Jump within chapter"].waitForExistence(timeout: 45),
            "The static example citation did not open the installed Reader.\n\(app.debugDescription)"
        )
        let attachment = XCTAttachment(screenshot: app.screenshot(), quality: .original)
        attachment.name = "Phase 5 first-use cited example opened Reader"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testPhase5FirstUseExploreDismissesDirectlyToReader() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase5-first-use-fixture"]
        app.launch()

        let explore = element(in: app, identifier: "phase5-first-use-explore")
        XCTAssertTrue(explore.waitForExistence(timeout: 45), launchFailureDescription(in: app))
        explore.tap()

        XCTAssertTrue(
            waitForNonexistence(element(in: app, identifier: "phase5-first-use-sheet")),
            "Explore the Codes did not dismiss first use."
        )
        XCTAssertTrue(
            element(in: app, identifier: "reader-source-edition").waitForExistence(timeout: 10),
            "Explore the Codes did not return directly to the Reader source grid."
        )
    }

    func testPhase5FirstUseSignInOpensAccountSettings() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase5-first-use-fixture"]
        app.launch()

        let signIn = element(in: app, identifier: "phase5-first-use-sign-in")
        XCTAssertTrue(signIn.waitForExistence(timeout: 45), launchFailureDescription(in: app))
        signIn.tap()

        XCTAssertTrue(
            app.staticTexts["Account"].waitForExistence(timeout: 10),
            "Sign In did not open the existing Account settings."
        )
    }

    func testAccountCloseFromWelcomeAndSavedAfterScrolling() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase5-first-use-fixture", "--permitext-disable-clerk"]
        app.launch()

        let signIn = element(in: app, identifier: "phase5-first-use-sign-in")
        XCTAssertTrue(signIn.waitForExistence(timeout: 45), launchFailureDescription(in: app))
        signIn.tap()
        let close = app.buttons["account-close"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        XCTAssertTrue(close.isHittable)
        close.tap()
        XCTAssertTrue(waitForNonexistence(close), "Account must dismiss from the welcome route.")

        let saved = app.tabBars.buttons["Saved"]
        XCTAssertTrue(saved.waitForExistence(timeout: 10))
        saved.tap()
        app.buttons["Open Account"].tap()
        XCTAssertTrue(close.waitForExistence(timeout: 10), "Saved must expose the Account close control.")
        XCTAssertTrue(close.isHittable)
        keepScreenshot(named: "account-close-saved-top", from: app)
        app.swipeUp()
        app.swipeUp()
        XCTAssertTrue(close.isHittable, "The close control must stay available while Account scrolls.")
        keepScreenshot(named: "account-close-saved-scrolled", from: app)
        close.tap()
        XCTAssertTrue(waitForNonexistence(close), "Account must dismiss after scrolling from Saved.")
        XCTAssertTrue(app.buttons["Open Account"].isHittable)
    }

    func testResearchVerificationFailureRemainsVisibleAfterReopeningConversation() {
        let app = XCUIApplication()
        app.launchArguments += [
            "--permitext-disable-clerk",
            "--phase3-entitled-research-fixture", "--phase3-seeded-selection-fixture",
            "--research-verification-failure-fixture"
        ]
        app.launch()
        let composer = element(in: app, identifier: "research-composer")
        XCTAssertTrue(composer.waitForExistence(timeout: 45), app.debugDescription)
        composer.tap()
        composer.typeText("Accessible ramp requirements?")
        app.buttons["Send Research question"].tap()
        let disclosure = app.buttons["Continue to Research"]
        if disclosure.waitForExistence(timeout: 2) { disclosure.tap() }
        let failure = app.staticTexts.matching(NSPredicate(
            format: "label == %@",
            "A Research model produced a response, but Permitext could not verify it against the enacted evidence. Your question is still here."
        )).firstMatch
        XCTAssertTrue(failure.waitForExistence(timeout: 10), app.debugDescription)
        app.buttons["Research history"].tap()
        let history = app.buttons.matching(identifier: "research-history-row").firstMatch
        XCTAssertTrue(history.waitForExistence(timeout: 5), app.debugDescription)
        history.tap()
        XCTAssertTrue(failure.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Research was interrupted")).firstMatch.exists)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "research-verification-error-restored"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }

    func testPhase3EntitledReaderResearchJourney() {
        let app = XCUIApplication()
        // Xcode 26.6 cannot drive the system-owned edit menu on the iOS 27
        // beta device. Manual device acceptance covers Reader selection and
        // the Research action; this fixture deterministically verifies the
        // complete on-device journey after that selection is made.
        app.launchArguments += [
            "--phase3-entitled-research-fixture",
            "--phase3-seeded-selection-fixture",
            "--native-reader-rollout-stage",
            "isolated-table-fallback"
        ]
        app.launch()

        XCTAssertTrue(
            element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45),
            phase3LaunchFailureDescription(in: app)
        )

        let composer = element(in: app, identifier: "research-composer")
        XCTAssertTrue(
            composer.waitForExistence(timeout: 15),
            "The selected Reader passage did not create and open Research.\n\(app.debugDescription)"
        )
        XCTAssertTrue(
            element(in: app, identifier: "research-selected-evidence").waitForExistence(timeout: 10),
            "Research did not preserve the selected enacted passage."
        )

        let projectContext = element(in: app, identifier: "research-project-context-menu")
        XCTAssertTrue(projectContext.waitForExistence(timeout: 5), "Active Project context is not visible.")
        XCTAssertTrue(
            projectContext.label.localizedCaseInsensitiveContains("Acceptance Project"),
            "Research did not begin in the active Acceptance Project; label was \(projectContext.label)."
        )

        composer.tap()
        composer.typeText("What does this enacted provision establish?")
        let send = app.buttons["Send Research question"]
        XCTAssertTrue(send.isEnabled, "The deterministic Research question was not sendable.")
        send.tap()

        XCTAssertTrue(
            element(in: app, identifier: "research-answer").waitForExistence(timeout: 15),
            "The zero-network Research transport did not return its deterministic answer.\n\(app.debugDescription)"
        )
        XCTAssertTrue(
            app.staticTexts["Enacted source changed"].waitForExistence(timeout: 10),
            "The answer did not expose its changed-source recovery state."
        )

        let evidenceReviewed = app.buttons["Evidence reviewed"]
        reveal(evidenceReviewed, in: app)
        XCTAssertTrue(evidenceReviewed.exists && evidenceReviewed.isHittable, "Evidence reviewed details are absent.")
        evidenceReviewed.tap()
        assertResearchTrustDetails(in: app)

        let refresh = element(in: app, identifier: "research-refresh-sources")
        reveal(refresh, in: app, swipingDown: true)
        XCTAssertTrue(refresh.isHittable, "Refresh Sources could not be reached.")
        refresh.tap()
        let projectWarning = app.staticTexts["Project review required"]
        XCTAssertTrue(
            projectWarning.waitForExistence(timeout: 10),
            "Refreshing changed sources did not require Project review."
        )
        let confirmProject = element(in: app, identifier: "research-confirm-project")
        reveal(confirmProject, in: app, swipingDown: true)
        XCTAssertTrue(confirmProject.isHittable, "Confirm Current Project could not be reached.")
        confirmProject.tap()
        XCTAssertTrue(
            waitForNonexistence(projectWarning),
            "Confirming the current Project did not clear the review requirement."
        )

        reveal(projectContext, in: app, swipingDown: true)
        XCTAssertTrue(projectContext.isHittable, "The Project context menu could not be reached for correction.")
        projectContext.tap()
        let correctionProject = app.buttons["Correction Project"]
        XCTAssertTrue(correctionProject.waitForExistence(timeout: 5), "The second true Project is not available.")
        correctionProject.tap()
        let moveConversation = app.buttons["Move Conversation"]
        XCTAssertTrue(moveConversation.waitForExistence(timeout: 5), "Project correction lacks confirmation.")
        moveConversation.tap()
        XCTAssertTrue(
            waitForLabelContaining("Correction Project", on: projectContext),
            "Research did not display the corrected active Project."
        )

        let citation = app.descendants(matching: .any)
            .matching(NSPredicate(format: "identifier BEGINSWITH %@", "research-citation-"))
            .firstMatch
        reveal(citation, in: app)
        XCTAssertTrue(citation.isHittable, "The answer citation could not be reached.")
        citation.tap()

        XCTAssertTrue(
            element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 30),
            "Opening the Research citation did not return to the installed native Reader.\n\(app.debugDescription)"
        )
        XCTAssertTrue(
            app.buttons["Jump within chapter"].waitForExistence(timeout: 10),
            "The citation destination is not an interactive chapter Reader."
        )

        let attachment = XCTAttachment(screenshot: app.screenshot(), quality: .original)
        attachment.name = "Phase 3 entitled Reader to Research citation journey"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func runCycles(_ iterations: Int, in app: XCUIApplication) {
        for iteration in 1...iterations {
            let bookmark = element(in: app, identifier: bookmarkIdentifier)
            XCTAssertTrue(bookmark.waitForExistence(timeout: 10), "Cycle \(iteration): Reader bookmark control is unavailable.")
            XCTAssertTrue(waitForValue("Not saved", on: bookmark), "Cycle \(iteration): Reader did not begin unsaved.")

            bookmark.tap()
            XCTAssertTrue(waitForValue("Saved", on: bookmark), "Cycle \(iteration): bookmark save did not complete.")
            let saveDone = app.buttons["Done"]
            if saveDone.waitForExistence(timeout: 2) {
                saveDone.tap()
            }

            let tabButtons = app.tabBars.buttons
            XCTAssertGreaterThanOrEqual(
                tabButtons.count,
                2,
                "Cycle \(iteration): expected Reader and Projects tab controls."
            )
            let projectsTab = tabButtons.element(boundBy: 1)
            XCTAssertTrue(projectsTab.waitForExistence(timeout: 5), "Cycle \(iteration): Projects tab is unavailable.")
            projectsTab.tap()
            XCTAssertTrue(
                element(in: app, identifier: "projects-root").waitForExistence(timeout: 5),
                "Cycle \(iteration): Projects did not become visible."
            )
            XCTAssertTrue(
                firstSavedRow(in: app).waitForExistence(timeout: 10),
                "Cycle \(iteration): saved section is absent from Projects."
            )

            let readerTab = app.tabBars.buttons.element(boundBy: 0)
            XCTAssertTrue(readerTab.waitForExistence(timeout: 5), "Cycle \(iteration): Reader tab is unavailable.")
            readerTab.tap()

            let savedBookmark = element(in: app, identifier: bookmarkIdentifier)
            XCTAssertTrue(savedBookmark.waitForExistence(timeout: 10), "Cycle \(iteration): Reader did not return.")
            XCTAssertTrue(waitForValue("Saved", on: savedBookmark), "Cycle \(iteration): saved state was not retained.")
            savedBookmark.tap()
            XCTAssertTrue(waitForValue("Not saved", on: savedBookmark), "Cycle \(iteration): bookmark removal did not complete.")

            projectsTab.tap()
            XCTAssertTrue(
                element(in: app, identifier: "projects-root").waitForExistence(timeout: 5),
                "Cycle \(iteration): Projects did not return after removal."
            )
            XCTAssertTrue(
                waitForNonexistence(firstSavedRow(in: app)),
                "Cycle \(iteration): removed section remains in Projects."
            )

            readerTab.tap()
            XCTAssertTrue(
                element(in: app, identifier: bookmarkIdentifier).waitForExistence(timeout: 10),
                "Cycle \(iteration): Reader did not return for the next cycle."
            )

            if iteration.isMultiple(of: 10) || iteration == iterations {
                let attachment = XCTAttachment(
                    screenshot: app.screenshot(),
                    quality: .medium
                )
                attachment.name = "Native Reader physical stress cycle \(iteration)"
                attachment.lifetime = .keepAlways
                add(attachment)
            }
        }
    }

    private func assertCrossCodeLink(
        sectionNumber: String,
        tapOffset: CGVector,
        expectedDestination: String,
        name: String
    ) {
        let app = XCUIApplication()
        app.launchArguments += [
            "--native-reader-cross-code-link-test",
            "--native-reader-rollout-stage",
            "isolated-table-fallback"
        ]
        app.launch()

        XCTAssertTrue(
            element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45),
            launchFailureDescription(in: app)
        )
        jumpToSection(sectionNumber, in: app)

        let sourceScreenshot = XCTAttachment(screenshot: app.screenshot(), quality: .original)
        sourceScreenshot.name = "\(name) visible source before tap"
        sourceScreenshot.lifetime = .keepAlways
        add(sourceScreenshot)

        // UITextView attributed links are not exposed as XCUI descendants in
        // this layout. The jump picker makes each source viewport deterministic,
        // then this coordinate taps the visible underlined Article link itself.
        // Allow the programmatic jump's short scroll animation to finish first;
        // its accessibility value updates before its visual position settles.
        Thread.sleep(forTimeInterval: 0.5)
        app.coordinate(withNormalizedOffset: tapOffset).tap()

        let destinationNavigationBar = app.navigationBars[expectedDestination]
        XCTAssertTrue(
            destinationNavigationBar.waitForExistence(timeout: 10),
            "Tapping the visible \(name) link did not navigate to \(expectedDestination)."
        )

        let destinationScreenshot = XCTAttachment(screenshot: app.screenshot(), quality: .original)
        destinationScreenshot.name = "\(name) opened \(expectedDestination)"
        destinationScreenshot.lifetime = .keepAlways
        add(destinationScreenshot)
    }

    private func jumpToSection(_ sectionNumber: String, in app: XCUIApplication) {
        let jumpButton = app.buttons["Jump within chapter"]
        XCTAssertTrue(jumpButton.waitForExistence(timeout: 10), "The chapter jump control is unavailable.")
        jumpButton.tap()

        let target = app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH[c] %@", "\(sectionNumber) "))
            .firstMatch
        for _ in 0..<20 where !target.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(target.isHittable, "Fuel Gas \(sectionNumber) is unavailable in the jump picker.")
        target.tap()

        XCTAssertTrue(
            waitForValueContaining(sectionNumber, on: jumpButton),
            "Fuel Gas \(sectionNumber) did not settle after selecting it in the jump picker."
        )
    }

    private func scrollToHittable(
        _ target: XCUIElement,
        in app: XCUIApplication,
        maximumSwipes: Int = 40
    ) {
        for _ in 0..<maximumSwipes {
            if target.exists, target.isHittable {
                return
            }
            app.swipeUp()
        }
        XCTAssertTrue(target.exists && target.isHittable, "The requested Reader content was not reachable.")
    }

    private func keepScreenshot(named name: String, from app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot(), quality: .original)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func element(in app: XCUIApplication, identifier: String) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "identifier == %@", identifier))
            .firstMatch
    }

    private func firstSavedRow(in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "identifier BEGINSWITH %@", savedRowIdentifierPrefix))
            .firstMatch
    }

    private func waitForValue(
        _ expectedValue: String,
        on element: XCUIElement,
        timeout: TimeInterval = 10
    ) -> Bool {
        let expectation = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value == %@", expectedValue),
            object: element
        )
        return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
    }

    private func waitForValueContaining(
        _ expectedSubstring: String,
        on element: XCUIElement,
        timeout: TimeInterval = 10
    ) -> Bool {
        let expectation = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value CONTAINS[c] %@", expectedSubstring),
            object: element
        )
        return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
    }

    private func waitForLabelContaining(
        _ expectedSubstring: String,
        on element: XCUIElement,
        timeout: TimeInterval = 10
    ) -> Bool {
        let expectation = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "label CONTAINS[c] %@", expectedSubstring),
            object: element
        )
        return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
    }

    private func reveal(
        _ element: XCUIElement,
        in app: XCUIApplication,
        swipingDown: Bool = false
    ) {
        for _ in 0..<12 where !element.isHittable {
            if swipingDown {
                app.swipeDown()
            } else {
                app.swipeUp()
            }
        }
    }

    private func assertResearchTrustDetails(in app: XCUIApplication) {
        let expectedHeadings = [
            "What the cited evidence establishes",
            "Assumptions used",
            "Project facts to verify",
            "Limits of this answer",
            "Questions that would materially advance this answer",
            "Related evidence to add",
            "Cited sources"
        ]
        let supportedPointsHeading = app.staticTexts[expectedHeadings[0]]
        reveal(supportedPointsHeading, in: app)
        XCTAssertTrue(
            supportedPointsHeading.exists,
            "Research answer is missing the \(expectedHeadings[0]) field."
        )
        let expectedRoles = [
            ("Governing", "research-supported-point-governing"),
            ("Supporting", "research-supported-point-supporting"),
            ("Context", "research-supported-point-contextual")
        ]
        for (role, identifier) in expectedRoles {
            let roleText = element(in: app, identifier: identifier)
            reveal(roleText, in: app)
            XCTAssertTrue(roleText.exists, "Research answer is missing the \(role) evidence role.")
        }
        for heading in expectedHeadings.dropFirst() {
            let text = app.staticTexts[heading]
            reveal(text, in: app)
            XCTAssertTrue(text.exists, "Research answer is missing the \(heading) field.")
        }
    }

    private func waitForNonexistence(
        _ element: XCUIElement,
        timeout: TimeInterval = 10
    ) -> Bool {
        let expectation = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "exists == false"),
            object: element
        )
        return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
    }

    private func launchFailureDescription(in app: XCUIApplication) -> String {
        let failure = element(in: app, identifier: "physical-stress-failure")
        if failure.exists {
            return "Physical stress harness failed: \(failure.label)"
        }
        return "Native Reader did not become ready within 45 seconds."
    }

    private func phase3LaunchFailureDescription(in app: XCUIApplication) -> String {
        let failure = element(in: app, identifier: "phase3-research-fixture-failure")
        if failure.exists {
            return "Phase 3 Research fixture failed: \(failure.label)"
        }
        return "Phase 3 entitled Research fixture did not become ready within 45 seconds."
    }
}
