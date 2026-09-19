import XCTest

final class NativeReaderPhysicalStressUITests: XCTestCase {
    private let bookmarkIdentifier = "reader-current-section-bookmark"
    private let savedRowIdentifierPrefix = "projects-bookmark-"

    private func navigationButton(in app: XCUIApplication, title: String) -> XCUIElement {
        let ids = ["Saved": "main-tab-saved", "First reader": "main-tab-reader-1",
                   "Second reader": "main-tab-reader-2", "Research": "main-tab-research"]
        return app.buttons.matching(NSPredicate(format: "identifier == %@ OR label == %@", ids[title] ?? title, title)).firstMatch
    }

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 7_200
    }

    func testSavedProjectTilesAndAllSavedNavigation() throws {
        try verifySavedProjectNavigation(largeText: false)
    }

    func testSavedProjectTilesAtAccessibilitySize() throws {
        try verifySavedProjectNavigation(largeText: true)
    }

    private func verifySavedProjectNavigation(largeText: Bool) throws {
#if !DEBUG
        throw XCTSkip("Saved navigation acceptance uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--saved-project-pages-fixture"]
        if largeText {
            app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityM"]
        }
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons["main-tab-saved"].tap()
        XCTAssertTrue(element(in: app, identifier: "projects-root").waitForExistence(timeout: 10))
        XCTAssertFalse(firstSavedRow(in: app).exists, "The landing screen should show projects, not the saved list.")
        let projectCandidate = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "saved-folder-")).firstMatch
        XCTAssertTrue(projectCandidate.waitForExistence(timeout: 10))
        let project = app.buttons[projectCandidate.identifier]
        keepScreenshot(named: largeText ? "Saved projects accessibility size" : "Saved project tiles", from: app)
        let projectsScroll = app.scrollViews["projects-root"]
        let savedLink = element(in: app, identifier: "all-saved-link")
        XCTAssertTrue(savedLink.isHittable, "All saved must stay visible with many projects.")
        XCTAssertFalse(element(in: app, identifier: "saved-project-pager").exists)
        let dockGap = element(in: app, identifier: "main-bottom-navigation").frame.minY - savedLink.frame.maxY
        XCTAssertGreaterThanOrEqual(dockGap, -2)
        XCTAssertLessThanOrEqual(dockGap, 28, "All saved should sit just above the tab bar, like the Search field.")
        let savedLinkY = savedLink.frame.minY
        let initialProjectY = project.frame.minY
        projectsScroll.swipeUp()
        XCTAssertTrue(!project.exists || project.frame.minY < initialProjectY)
        XCTAssertTrue(savedLink.isHittable)
        XCTAssertEqual(savedLink.frame.minY, savedLinkY, accuracy: 2)
        Thread.sleep(forTimeInterval: 1)
        keepScreenshot(named: "Scrolled projects with pinned All saved", from: app)
        for _ in 0..<10 where !project.isHittable { projectsScroll.swipeDown() }
        XCTAssertTrue(project.isHittable)
        project.tap()
        XCTAssertTrue(app.staticTexts["Acceptance Project"].waitForExistence(timeout: 10))
        keepScreenshot(named: "Existing project contents", from: app)
        app.navigationBars.buttons.element(boundBy: 0).tap()
        let allSaved = element(in: app, identifier: "all-saved-link")
        reveal(allSaved, in: app)
        allSaved.tap()
        XCTAssertTrue(element(in: app, identifier: "all-saved-root").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["No Saved Sections"].exists)
        keepScreenshot(named: "References inside All saved", from: app)

        let references = element(in: app, identifier: "saved-references-link")
        reveal(references, in: app)
        references.tap()
        XCTAssertTrue(app.navigationBars["References"].waitForExistence(timeout: 10))
        let referenceTile = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "saved-folder-")).firstMatch
        XCTAssertTrue(referenceTile.waitForExistence(timeout: 10))
        referenceTile.tap()
        XCTAssertTrue(app.staticTexts["Code references"].waitForExistence(timeout: 10))
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(element(in: app, identifier: "projects-root").waitForExistence(timeout: 10))
        XCTAssertFalse(element(in: app, identifier: "saved-references-link").exists)

        app.buttons["main-tab-reader-1"].tap()
        let bookmark = element(in: app, identifier: bookmarkIdentifier)
        XCTAssertTrue(bookmark.waitForExistence(timeout: 30))
        bookmark.tap()
        XCTAssertTrue(waitForValue("Saved", on: bookmark))
        let done = app.alerts.buttons["Done"]
        if done.waitForExistence(timeout: 2) { done.tap() }
        app.buttons["main-tab-saved"].tap()
        reveal(allSaved, in: app)
        allSaved.tap()
        XCTAssertTrue(firstSavedRow(in: app).waitForExistence(timeout: 10))
        app.segmentedControls.buttons["Unassigned"].tap()
        XCTAssertTrue(firstSavedRow(in: app).exists, "Quick Reader saves must remain reachable without a project.")
        keepScreenshot(named: largeText ? "Unassigned saved sections accessibility size" : "Unassigned saved sections", from: app)
        firstSavedRow(in: app).tap()
        XCTAssertTrue(app.buttons["Remove from Saved"].waitForExistence(timeout: 20))
        keepScreenshot(named: "Saved passage detail", from: app)
#endif
    }

    func testCompactSearchHistoryAndPassageOpening() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--compact-search-history-fixture"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        keepScreenshot(named: "Separate navigation dock", from: app)
        XCTAssertTrue(app.buttons["main-tab-saved"].exists, app.debugDescription)
        app.buttons["main-tab-saved"].tap()
        app.buttons["Search"].tap()
        let field = app.textFields["Search codes"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        keepScreenshot(named: "Global Search modal presentation", from: app)
        XCTAssertFalse(app.tabBars.firstMatch.isHittable)
        if app.buttons["Clear search"].exists { app.buttons["Clear search"].tap() }
        keepScreenshot(named: "Global Search last opened", from: app)
        XCTAssertFalse(app.buttons["search-recent-history"].exists)
        XCTAssertFalse(app.staticTexts["Last opened"].exists)
        field.tap()
        field.typeText("concrete")
        let modern = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS[c] %@ AND label CONTAINS %@", "search-group-", "Building Code", "2022")).firstMatch
        let historical = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS[c] %@ AND label CONTAINS %@", "search-group-", "Building Code", "2014")).firstMatch
        XCTAssertTrue(modern.waitForExistence(timeout: 45), app.debugDescription)
        XCTAssertTrue(historical.exists)
        XCTAssertTrue((modern.value as? String)?.hasPrefix("Collapsed") == true)
        XCTAssertTrue((historical.value as? String)?.hasPrefix("Collapsed") == true)
        XCTAssertFalse(app.scrollViews["search-pinned-filters"].exists)
        let results = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "search-result-"))
        XCTAssertEqual(results.count, 0)
        keepScreenshot(named: "Collapsed results across 2022 and 2014 codes", from: app)
        modern.tap()
        XCTAssertTrue(results.firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue((modern.value as? String)?.hasPrefix("Expanded") == true)
        keepScreenshot(named: "Expanded 2022 Building Code results", from: app)
        modern.tap()
        XCTAssertEqual(results.count, 0)
        app.buttons["Close search"].tap()
        XCTAssertTrue(app.buttons["main-tab-saved"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["main-tab-saved"].isSelected)
        app.buttons["main-tab-reader-1"].tap()
        app.buttons["Search"].tap()
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        XCTAssertEqual(field.value as? String, "concrete")
        app.buttons["Clear search"].tap()
        let parking = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "1006.4")).firstMatch
        XCTAssertTrue(parking.waitForExistence(timeout: 10))
        parking.tap()
        let currentSection = app.buttons.matching(NSPredicate(format: "label == %@ AND value BEGINSWITH %@", "Jump within chapter", "1006.4 ")).firstMatch
        XCTAssertTrue(currentSection.waitForExistence(timeout: 15))
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (currentSection.value as? String)?.hasPrefix("1006.4 ") == true
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 10), .completed)
        keepScreenshot(named: "Global Search opens requested section", from: app)
        XCTAssertFalse(app.staticTexts["Opening section…"].exists)
    }

    func testAppStoreReleaseScreenshots() throws {
#if DEBUG || !targetEnvironment(simulator)
        throw XCTSkip("App Store capture requires a Release Simulator build.")
#else
        let app = XCUIApplication()
        app.launch()
        let explore = app.buttons["phase5-first-use-explore"]
        if explore.waitForExistence(timeout: 5) { explore.tap() }

        let savedTab = navigationButton(in: app, title: "Saved")
        XCTAssertTrue(savedTab.waitForExistence(timeout: 45))
        for label in ["First reader", "Second reader", "Search", "Research"] {
            XCTAssertTrue(navigationButton(in: app, title: label).exists, "The tab must expose its destination name: \(label).")
        }
        savedTab.tap()
        app.buttons["Open Account"].tap()
        XCTAssertTrue(app.buttons["Sign in or create an account"].waitForExistence(timeout: 15),
                      "Capture must use an anonymous Simulator, without customer account data.")
        app.terminate()
        app.launch()

        let readerTab = navigationButton(in: app, title: "First reader")
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

        app.buttons["Search"].tap()
        let search = app.textFields["Search codes"]
        XCTAssertTrue(search.waitForExistence(timeout: 10))
        search.tap()
        search.typeText("fire resistance\n")
        let results = app.buttons.matching(NSPredicate(
            format: "label CONTAINS[c] %@", "fire resistance"
        )).firstMatch
        XCTAssertTrue(results.waitForExistence(timeout: 45))
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        keepAppStoreScreenshot(named: "03-search-results", from: app)
        app.buttons["Close search"].tap()

        navigationButton(in: app, title: "Saved").tap()
        element(in: app, identifier: "all-saved-link").tap()
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
        if app.buttons["Close search"].exists {
            XCTAssertTrue(app.buttons["Close search"].isHittable)
        } else {
            for label in ["Saved", "First reader", "Second reader", "Research"] {
                XCTAssertTrue(navigationButton(in: app, title: label).isHittable)
            }
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
        navigationButton(in: app, title: "Saved").tap()
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

    func testNativeNotebookColdOfflineViewerCannotCreateDraft() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-cold-offline-fixture", "--native-notebook-cold-viewer"]
        app.launch()
        XCTAssertTrue(app.staticTexts["Read-only Notebook"].waitForExistence(timeout: 30))
        XCTAssertFalse(app.textFields["Note title"].exists)
        keepScreenshot(named: "Cached viewer remains read-only offline", from: app)
    }

    func testNativeNotebookColdDraftRejectsRevokedFreshAuthorization() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-cold-offline-fixture", "--native-notebook-cold-revoked"]
        app.launch()
        let title = app.textFields["Note title"]
        XCTAssertTrue(title.waitForExistence(timeout: 30))
        title.tap()
        title.typeText(" retained draft")
        let retry = app.buttons["native-notebook-retry-save"]
        XCTAssertTrue(retry.waitForExistence(timeout: 15))
        retry.tap()
        XCTAssertTrue(app.buttons["native-notebook-retry"].waitForExistence(timeout: 15))
        XCTAssertFalse(title.exists)
        XCTAssertFalse(app.staticTexts["Synced"].exists)
        keepScreenshot(named: "Fresh authorization revocation hides offline draft editor", from: app)
    }

    func testNativeNotebookColdOfflineEditorKeepsDraftUntilFreshAccessReturns() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-cold-offline-fixture"]
        app.launch()
        let title = app.textFields["Note title"]
        XCTAssertTrue(title.waitForExistence(timeout: 30))
        XCTAssertTrue(title.isEnabled)
        XCTAssertFalse(app.buttons["Delete"].exists)
        title.tap()
        title.typeText(" cold offline draft")
        let editedTitle = title.value as? String
        let retry = app.buttons["native-notebook-retry-save"]
        XCTAssertTrue(retry.waitForExistence(timeout: 15))
        XCTAssertEqual(title.value as? String, editedTitle)
        XCTAssertFalse(app.buttons["Image"].isEnabled)
        keepScreenshot(named: "Cold offline cached editor local draft", from: app)
        retry.tap()
        XCTAssertTrue(app.staticTexts["Synced"].waitForExistence(timeout: 15))
        XCTAssertEqual(title.value as? String, editedTitle)
        XCTAssertFalse(app.buttons["Save"].exists)
        keepScreenshot(named: "Cold offline draft freshly authorized and synced", from: app)
    }

    func testNativeNotebookLinkedNoteReturnsToEditingCaret() {
        verifyNativeLinkedNoteCaret(largeText: false)
    }

    func testNativeLargeTextLinkedNoteReturnsToEditingCaret() {
        verifyNativeLinkedNoteCaret(largeText: true)
    }

    private func verifyNativeLinkedNoteCaret(largeText: Bool) {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-reference-fixture"]
        if largeText { app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityM"] }
        app.launch()
        let original = "Original editing context stays here."
        let editor = app.textViews.matching(NSPredicate(format: "value == %@", original)).firstMatch
        XCTAssertTrue(editor.waitForExistence(timeout: 30))
        editor.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        app.typeText(" BEFORE")
        let edited = app.textViews.matching(NSPredicate(format: "value CONTAINS %@", " BEFORE")).firstMatch
        keepScreenshot(named: "Source Note initial caret typing", from: app)
        guard edited.waitForExistence(timeout: 5), let editedValue = edited.value as? String else {
            XCTFail("Typing must reach the active source editor: \(app.textViews.allElementsBoundByIndex.map { $0.value ?? "missing" })")
            return
        }
        XCTAssertEqual(editedValue.replacingOccurrences(of: " BEFORE", with: ""), original)
        let expectedReturn = editedValue.replacingOccurrences(of: " BEFORE", with: " BEFORE AFTER")
        XCTAssertTrue(app.staticTexts["Synced"].waitForExistence(timeout: 10))
        let reference = app.buttons["Open linked Note: Linked sample note"]
        XCTAssertTrue(reference.exists)
        reference.tap()
        XCTAssertTrue(app.staticTexts["This is the linked note, shown read-only."].waitForExistence(timeout: 10))
        keepScreenshot(named: "Linked Note read-only sheet during active editing", from: app)
        guard let done = app.buttons.matching(identifier: "Done").allElementsBoundByIndex.first(where: { $0.isHittable }) else {
            XCTFail("Linked Note must expose Done"); return
        }
        done.tap()
        XCTAssertTrue(reference.waitForExistence(timeout: 10))
        keepScreenshot(named: "Original Note keyboard and caret after linked sheet return", from: app)
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5), "Keyboard must return without tapping the source editor")
        app.typeText(" AFTER")
        XCTAssertTrue(app.textViews.matching(NSPredicate(format: "value == %@", expectedReturn)).firstMatch.exists,
                      "Typing after return must continue at the preserved source caret")
        XCTAssertEqual(app.textFields["Note title"].value as? String, "Original reference note")
        XCTAssertTrue(app.staticTexts["Synced"].waitForExistence(timeout: 10))
        keepScreenshot(named: "Linked Note returns to exact editing caret and syncs", from: app)
    }

    func testNativeNotebookCachedRefreshPreservesTypingAndAutosaves() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-reference-fixture", "--native-notebook-delayed-refresh-fixture"]
        app.launch()
        let title = app.textFields["Note title"]
        let diagnostics = app.staticTexts["native-notebook-refresh-diagnostics"]
        XCTAssertTrue(title.waitForExistence(timeout: 30))
        XCTAssertTrue(diagnostics.waitForExistence(timeout: 5))
        XCTAssertTrue(diagnostics.label.contains("refresh=pending"))
        title.tap()
        keepScreenshot(named: "Cached Note title focused before typing", from: app)
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 3))
        title.typeText(" typed during refresh")
        let expected = "Original reference note typed during refresh"
        keepScreenshot(named: "Cached Note immediately after typing", from: app)
        XCTAssertEqual(title.value as? String, expected)
        XCTAssertTrue(diagnostics.label.contains("refresh=pending"), "Typing must happen before the delayed GET completes.")
        keepScreenshot(named: "Cached Note edited while refresh is pending", from: app)
        let completion = NSPredicate { _, _ in diagnostics.label.contains("settled=true") && diagnostics.label.contains("saves=1;") }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: completion, object: nil)], timeout: 25), .completed)
        XCTAssertTrue(app.staticTexts["Synced"].waitForExistence(timeout: 5))
        XCTAssertEqual(title.value as? String, expected)
        XCTAssertFalse(app.buttons["native-notebook-retry-save"].exists)
        XCTAssertFalse(app.buttons["Save"].exists)
        keepScreenshot(named: "Cached Note refresh preserves typed title and autosaves once", from: app)
        // This fixture mounts the direct editor as its navigation root, so it
        // has no parent Note list. Real-project Done/reopen is a separate check.
    }

    func testNativeNotebookCachedPendingRefreshRequiresExplicitRetry() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-reference-fixture", "--native-notebook-delayed-refresh-fixture", "--native-notebook-refresh-pending-draft"]
        app.launch()
        let title = app.textFields["Note title"]
        let diagnostics = app.staticTexts["native-notebook-refresh-diagnostics"]
        XCTAssertTrue(title.waitForExistence(timeout: 30))
        XCTAssertEqual(title.value as? String, "Pending original mutation")
        let settled = NSPredicate { _, _ in diagnostics.label.contains("settled=true") }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: settled, object: nil)], timeout: 25), .completed)
        XCTAssertTrue(diagnostics.label.contains("saves=0;"), "Refreshing a cached pending mutation must not retry it automatically.")
        XCTAssertEqual(title.value as? String, "Pending original mutation")
        let retry = app.buttons["native-notebook-retry-save"]
        XCTAssertTrue(retry.waitForExistence(timeout: 5))
        keepScreenshot(named: "Cached pending Note waits for explicit retry after successful refresh", from: app)
        retry.tap()
        XCTAssertTrue(app.staticTexts["Synced"].waitForExistence(timeout: 15))
        XCTAssertTrue(diagnostics.label.contains("saves=1;"))
        XCTAssertTrue(diagnostics.label.contains("mutation=native-refresh-original-mutation"))
        XCTAssertEqual(title.value as? String, "Pending original mutation")
        XCTAssertFalse(retry.exists)
        keepScreenshot(named: "Cached pending Note retries original mutation once", from: app)
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
        verifyNativePartialLookup(largeText: false)
    }

    func testNativeLargeTextProjectPartialLookupWarningRemainsSaveable() {
        verifyNativePartialLookup(largeText: true)
    }

    private func verifyNativePartialLookup(largeText: Bool) {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-project-partial-lookup-fixture"]
        if largeText { app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityM"] }
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

    func testNormalAppShowsFourTabsAndGlobalSearch() {
        let app = XCUIApplication()
        app.launch()
        let reader = app.buttons["main-tab-reader-1"]
        let ready = reader.waitForExistence(timeout: 45)
        keepScreenshot(named: "Normal navigation dock", from: app)
        XCTAssertTrue(ready, app.debugDescription)
        XCTAssertTrue(app.buttons["main-tab-reader-2"].exists)
        XCTAssertTrue(app.buttons["main-tab-saved"].exists)
        XCTAssertTrue(app.buttons["main-tab-research"].exists)
        XCTAssertTrue(app.buttons["Search"].exists)
        reader.tap()
        let title = app.buttons["reader-code-picker"]
        XCTAssertTrue(title.waitForExistence(timeout: 15))
        XCTAssertFalse(title.label.contains("Construction Codes"))
        keepScreenshot(named: "Reader heading and separate bottom Search", from: app)
        app.buttons["Search"].tap()
        XCTAssertTrue(app.textFields["Search codes"].waitForExistence(timeout: 10))
        app.buttons["Close search"].tap()
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        XCTAssertTrue(reader.isSelected)
    }

    func testNativeLargeTextSavedListCycle() {
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-physical-stress",
                               "--native-reader-rollout-stage", "isolated-table-fallback",
                               "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityM"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45))
        runCycles(1, in: app, captureSavedList: true)
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

    func testNative1968MaterialGradeStaysPlainAndGroundGradeOpensDefinition() {
        verifyActualDefinitionScope(
            launchArgument: "--native-reader-grade-scope", term: "grade",
            negativePassage: "matching the type and grade of material",
            positivePassage: "spring from grade or the floor line",
            definitionText: "The finished surface of the ground", sourceSection: "27-232",
            screenshotName: "1968 GRADE material exclusion and ground meaning"
        )
    }

    func testNativeEBCChapter15RepeatedScrollRemainsResponsive() {
        executionTimeAllowance = 90
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-height-scope", "--native-reader-disable-scope-alignment"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 30), launchFailureDescription(in: app))
        keepScreenshot(named: "EBC15 initial actual Reader without glyph probe", from: app)
        for index in 1...8 {
            app.swipeUp()
            keepScreenshot(named: "EBC15 actual scroll \(index)", from: app)
        }
        let footer = app.buttons["Jump within chapter"]
        XCTAssertTrue(footer.exists && footer.isHittable)
        footer.tap()
        keepScreenshot(named: "EBC15 navigation responsive after eight swipes", from: app)
        app.buttons["Done"].tap()
        guard let passage = app.textViews.matching(NSPredicate(format: "identifier BEGINSWITH %@", "native-reader-block-"))
            .allElementsBoundByIndex.first(where: { $0.isHittable && $0.frame.minY.isFinite }) else {
            XCTFail("The final actual source passage must remain visible")
            return
        }
        let passageID = passage.identifier
        let position = passage.frame.minY
        app.tabBars.buttons["folder"].tap()
        app.tabBars.buttons["text.line.first.and.arrowtriangle.forward"].tap()
        let restored = app.textViews[passageID]
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            restored.isHittable && restored.frame.minY.isFinite
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 15), .completed)
        XCTAssertEqual(restored.frame.minY, position, accuracy: 4)
        keepScreenshot(named: "EBC15 exact eager viewport restored after Saved visit", from: app)
    }

    func testNativeLarge2014ChapterRemainsResponsiveWithLazyLayout() {
        executionTimeAllowance = 90
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-2014-building-chapter-7"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 30))
        for _ in 0..<4 { app.swipeUp() }
        let footer = app.buttons["Jump within chapter"]
        XCTAssertTrue(footer.exists && footer.isHittable)
        keepScreenshot(named: "Large 2014 Chapter7 after four actual swipes", from: app)
        footer.tap()
        XCTAssertTrue(app.buttons["Done"].waitForExistence(timeout: 5))
        keepScreenshot(named: "Large lazy chapter jump navigation remains responsive", from: app)
    }

    func testNativeEBCFloorHeightStaysPlainAndAppendixBuildingHeightOpensDefinition() {
        verifyActualDefinitionScope(
            launchArgument: "--native-reader-height-scope", term: "height",
            negativePassage: "height above the floor",
            positivePassage: "75 feet (22 860 mm) in height",
            definitionText: "for the purposes of this appendix", sourceSection: "D201",
            screenshotName: "EBC HEIGHT appendix scope"
        )
    }

    private func verifyActualDefinitionScope(launchArgument: String, term: String, negativePassage: String,
                                             positivePassage: String, definitionText: String,
                                             sourceSection: String, screenshotName: String) {
        let app = XCUIApplication()
        for positive in [false, true] {
            app.launchArguments = ["--permitext-disable-clerk", launchArgument] + (positive ? ["--native-reader-scope-positive"] : [])
            if positive && launchArgument == "--native-reader-height-scope" {
                app.launchArguments += ["--native-reader-disable-scope-alignment", "--native-reader-visible-height-probe"]
            }
            app.launch()
            XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45), launchFailureDescription(in: app))
            if positive && launchArgument == "--native-reader-height-scope" {
                verifyEBCAppendixVisibleHeight(app)
                app.terminate()
                continue
            }
            let text = positive ? positivePassage : negativePassage
            let pattern = "(?s).*" + text.split(whereSeparator: \.isWhitespace).map { NSRegularExpression.escapedPattern(for: String($0)) }.joined(separator: "\\s+") + ".*"
            let passage = app.descendants(matching: .any).matching(NSPredicate(format: "label MATCHES %@ OR value MATCHES %@", pattern, pattern)).firstMatch
            if launchArgument == "--native-reader-height-scope" {
                let aligned = element(in: app, identifier: "definition-scope-alignment")
                let expectation = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", "ready"), object: aligned)
                guard XCTWaiter.wait(for: [expectation], timeout: 20) == .completed else {
                    XCTFail("Actual source glyphs did not become visible: \(aligned.value ?? "missing")")
                    return
                }
            } else {
                _ = passage.waitForExistence(timeout: 15)
                for _ in 0..<8 {
                    if passage.exists && passage.isHittable { break }
                    app.swipeUp()
                }
            }
            XCTAssertTrue(passage.exists && passage.isHittable, "Actual source passage must be visible: \(text)\n\(app.debugDescription)")
            guard passage.exists && passage.isHittable else { return }
            let links = app.links.matching(NSPredicate(format: "label ==[c] %@", term))
            if positive {
                guard let link = links.allElementsBoundByIndex.first(where: { $0.isHittable }) else {
                    XCTFail("Expected visible definition link for \(term): \(app.debugDescription)")
                    return
                }
                link.tap()
                let close = app.buttons["Close definition"]
                XCTAssertTrue(close.waitForExistence(timeout: 10))
                XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", definitionText)).firstMatch.exists)
                XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", sourceSection)).firstMatch.exists)
                keepScreenshot(named: screenshotName + " positive popup", from: app)
                close.tap()
                let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: close)
                XCTAssertEqual(XCTWaiter.wait(for: [dismissed], timeout: 5), .completed,
                               "Definition presentation must dismiss after its transition.")
                XCTAssertTrue(passage.exists && passage.isHittable,
                              "Closing the definition must return to the same source passage.")
            } else {
                XCTAssertFalse(links.allElementsBoundByIndex.contains(where: { $0.isHittable }), "Material or floor-dimension use must remain ordinary text.")
                XCTAssertFalse(app.buttons["Close definition"].exists)
                keepScreenshot(named: screenshotName + " plain source", from: app)
            }
            app.terminate()
        }
    }

    private func verifyEBCAppendixVisibleHeight(_ app: XCUIApplication) {
        let probe = element(in: app, identifier: "definition-visible-glyph")
        for _ in 0..<20 {
            if app.webViews.firstMatch.exists { verifyEBCAppendixHeightInHTML(app); return }
            if (probe.value as? String)?.hasPrefix("ready:") == true { break }
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72))
                .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.47)))
        }
        keepScreenshot(named: "EBC positive HEIGHT native visible glyph", from: app)
        let parts = (probe.value as? String ?? "").split(separator: ":")
        guard parts.count == 5, parts[0] == "ready", parts[3] == "true",
              let x = Double(parts[1]), let y = Double(parts[2]), x.isFinite, y.isFinite else {
            XCTFail("Expected actual visible linked HEIGHT glyph: \(probe.value ?? "missing")")
            return
        }
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x, dy: y)).tap()
        let close = app.buttons["Close definition"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "for the purposes of this appendix")).firstMatch.exists)
        let citation = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "D201")).firstMatch
        for _ in 0..<8 {
            if citation.exists && citation.isHittable && citation.frame.maxY < app.frame.maxY - 30 { break }
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.86))
                .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.62)))
        }
        XCTAssertTrue(citation.isHittable)
        XCTAssertLessThan(citation.frame.maxY, app.frame.maxY - 30)
        keepScreenshot(named: "EBC native HEIGHT definition and D201 citation", from: app)
        close.tap()
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: close)], timeout: 5), .completed)
        let dismissalSample = Int((probe.value as? String ?? "").split(separator: ":").last ?? "") ?? -1
        let freshReturn = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            let restored = (probe.value as? String ?? "").split(separator: ":")
            guard restored.count == 5, restored[0] == "ready", restored[3] == "true",
                  let rx = Double(restored[1]), let ry = Double(restored[2]),
                  let sample = Int(restored[4]), sample > dismissalSample + 2,
                  rx.isFinite, ry.isFinite else { return false }
            return abs(rx - x) <= 4 && abs(ry - y) <= 4
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [freshReturn], timeout: 5), .completed,
                       "A fresh post-dismissal measurement must retain the actual glyph position")
        keepScreenshot(named: "EBC native HEIGHT returns to exact glyph position", from: app)
    }

    private func verifyEBCAppendixHeightInHTML(_ app: XCUIApplication) {
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.waitForExistence(timeout: 45), "Appendix D3 must expose its actual HTML reader")
        let phrase = web.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "75 feet (22 860 mm) in")).firstMatch
        func visible(_ item: XCUIElement) -> Bool {
            item.exists && item.isHittable && item.frame.minY > 130 && item.frame.maxY < app.frame.height - 140
        }
        for _ in 0..<12 {
            if visible(phrase) { break }
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.74))
                .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.44)))
        }
        keepScreenshot(named: "EBC positive HEIGHT actual HTML source", from: app)
        guard visible(phrase) else { XCTFail("Expected visible 75-foot source clause: \(app.debugDescription)"); return }
        let candidates = web.descendants(matching: .any).matching(NSPredicate(format: "label ==[c] %@", "height"))
        guard let height = candidates.allElementsBoundByIndex.first(where: {
            visible($0) && $0.frame.minY >= phrase.frame.minY - 5 && $0.frame.minY <= phrase.frame.maxY + 40
        }) else { XCTFail("Expected HEIGHT trigger adjacent to the actual 75-foot clause"); return }
        let before = phrase.frame.minY
        height.tap()
        let close = app.buttons["Close definition"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        XCTAssertTrue(web.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "for the purposes of this appendix")).firstMatch.exists)
        XCTAssertTrue(web.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "D201")).firstMatch.exists)
        keepScreenshot(named: "EBC positive HEIGHT D201 popup in HTML reader", from: app)
        close.tap()
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: close)], timeout: 5), .completed)
        XCTAssertTrue(visible(phrase))
        XCTAssertEqual(phrase.frame.minY, before, accuracy: 4)
        keepScreenshot(named: "EBC positive HEIGHT returns to same source clause", from: app)
    }

    func testNativeHousingArticle14ShowsBothMeaningsAndReturnsToPassage() {
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-housing-scoped-definition", "--native-reader-housing-article14"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45), launchFailureDescription(in: app))
        let term = app.links.matching(NSPredicate(format: "label ==[c] %@", "multiple dwelling")).firstMatch
        XCTAssertTrue(term.waitForExistence(timeout: 15))
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in term.isHittable && term.frame.minY.isFinite }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 15), .completed)
        let before = term.frame.minY
        term.tap()
        let close = app.buttons["Close definition"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        let general = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "three or more families living independently of each other")).firstMatch
        XCTAssertTrue(general.exists)
        XCTAssertTrue(general.label.contains("A multiple dwelling does not include"))
        keepScreenshot(named: "Native HMC Article14 general meaning", from: app)
        let expansion = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "For the purposes of this article")).firstMatch
        let expansionCitation = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "27-2056.1")).firstMatch
        for _ in 0..<5 {
            if expansionCitation.exists && expansionCitation.isHittable && expansionCitation.frame.maxY < app.frame.maxY - 60 { break }
            app.swipeUp()
        }
        XCTAssertTrue(expansion.exists && expansion.isHittable)
        XCTAssertTrue(expansionCitation.isHittable && expansionCitation.frame.maxY < app.frame.maxY - 60)
        XCTAssertTrue(expansion.label.contains("other than section 27-2056.14"))
        XCTAssertTrue(expansion.label.contains("shall not apply to a dwelling unit"))
        for citation in ["27-2004", "27-2056.1"] {
            XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", citation)).firstMatch.exists)
        }
        keepScreenshot(named: "Native HMC Article14 expansion and citations", from: app)
        close.tap()
        let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in !close.exists && term.isHittable }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [dismissed], timeout: 5), .completed)
        XCTAssertEqual(term.frame.minY, before, accuracy: 2)
        keepScreenshot(named: "Native HMC Article14 returned passage", from: app)
    }

    func testNativeHousingImmediateScrollKeepsUserPositionAfterRestoration() {
        executionTimeAllowance = 100
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-housing-scoped-definition", "--native-reader-housing-harassment"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45), launchFailureDescription(in: app))
        // Gesture immediately; do not wait for the five-second restoration lease.
        app.swipeUp()
        var passageID: String?
        var passageY: CGFloat?
        var stableSamples = 0
        let settled = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            guard let passage = app.textViews.matching(NSPredicate(format: "identifier BEGINSWITH %@", "native-reader-block-"))
                .allElementsBoundByIndex.first(where: { $0.isHittable && $0.frame.minY.isFinite && $0.frame.maxY > 120 }) else { return false }
            let y = passage.frame.minY
            if passageID == passage.identifier, let previous = passageY, abs(previous - y) < 1 { stableSamples += 1 } else { stableSamples = 0 }
            passageID = passage.identifier
            passageY = y
            return stableSamples >= 2
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [settled], timeout: 10), .completed)
        guard let passageID, let passageY else { return }
        keepScreenshot(named: "HMC immediate user scroll settled viewport", from: app)
        let beyondLease = expectation(description: "Observe beyond restoration lease")
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { beyondLease.fulfill() }
        wait(for: [beyondLease], timeout: 8)
        let passage = app.textViews[passageID]
        keepScreenshot(named: "HMC immediate user viewport retained after lease", from: app)
        let dump = XCTAttachment(string: app.debugDescription)
        dump.name = "HMC immediate user scroll retained AX"
        dump.lifetime = .keepAlways
        add(dump)
        XCTAssertFalse(app.webViews.firstMatch.exists, "A manual gesture must not trigger HTML fallback.")
        XCTAssertTrue(passage.exists && passage.isHittable)
        guard passage.exists else { return }
        XCTAssertEqual(passage.frame.minY, passageY, accuracy: 4, "Late restoration must not undo the user's chosen viewport.")
    }

    func testNativeHousingFailedPickerFallsBackToRequestedSection() {
        executionTimeAllowance = 120
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-housing-scoped-definition", "--native-reader-housing-harassment", "--native-reader-force-picker-alignment-failure"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45), launchFailureDescription(in: app))
        let footer = app.buttons["Jump within chapter"]
        let initial = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (footer.value as? String)?.contains("27-2120") == true && footer.isHittable
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [initial], timeout: 15), .completed)
        footer.tap()
        let target = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "27-2115 ")).firstMatch
        for _ in 0..<20 {
            if target.exists && target.isHittable { break }
            app.swipeUp()
        }
        XCTAssertTrue(target.exists && target.isHittable, app.debugDescription)
        guard target.exists && target.isHittable else { return }
        target.tap()
        let alert = app.alerts["Native reader used HTML fallback"]
        if alert.waitForExistence(timeout: 10) { alert.buttons.firstMatch.tap() }
        let webView = app.webViews.firstMatch
        XCTAssertTrue(webView.waitForExistence(timeout: 20))
        let heading = webView.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "27-2115 Imposition of civil penalty.")).firstMatch
        let destination = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            heading.exists && heading.isHittable && heading.frame.minY > 50 && heading.frame.minY < app.frame.height * 0.55
        }, object: nil)
        let arrived = XCTWaiter.wait(for: [destination], timeout: 15) == .completed
        let dump = XCTAttachment(string: app.debugDescription)
        dump.name = "HMC failed picker requested HTML destination AX"
        dump.lifetime = .keepAlways
        add(dump)
        keepScreenshot(named: "HMC failed picker HTML opens requested 2115", from: app)
        XCTAssertTrue(arrived, "HTML fallback must visibly open the requested 2115 heading, not the old 2120 destination.")
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "27-2115 ")).firstMatch.isHittable, "HTML footer must identify the requested section.")
    }

    func testNativeHousingHarassmentNavigationRetainsInitialAndPickerTarget() {
        executionTimeAllowance = 150
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-housing-scoped-definition", "--native-reader-housing-harassment"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45), launchFailureDescription(in: app))
        let settled = expectation(description: "Observe initial position without gestures")
        DispatchQueue.main.asyncAfter(deadline: .now() + 30) { settled.fulfill() }
        wait(for: [settled], timeout: 32)
        let footer = app.buttons["Jump within chapter"]
        let heading = app.textViews["native-reader-block-fd7e757403c87c3ac0352632161b361cfde526ea10047b7e4a79ed09786dae18"]
        keepScreenshot(named: "HMC initial before accessibility target query", from: app)
        print("Permitext navigation regression initial footer: \(footer.value ?? "missing")")
        let initialDump = XCTAttachment(string: app.debugDescription)
        initialDump.name = "HMC initial settled navigation AX"
        initialDump.lifetime = .keepAlways
        add(initialDump)
        keepScreenshot(named: "HMC diagnostic initial settled navigation", from: app)
        XCTAssertTrue((footer.value as? String)?.contains("27-2120") == true, "Initial requested section must survive settled layout.")
        XCTAssertTrue(heading.exists && heading.isHittable, "Initial requested heading must remain visible.")
        guard heading.exists && heading.isHittable else { return }
        let initialY = heading.frame.minY
        XCTAssertTrue(footer.exists && footer.isHittable)
        footer.tap()
        let target = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "27-2120 ")).firstMatch
        for _ in 0..<20 {
            if target.exists && target.isHittable { break }
            app.swipeUp()
        }
        XCTAssertTrue(target.exists && target.isHittable, app.debugDescription)
        guard target.exists && target.isHittable else { return }
        target.tap()
        let observed = expectation(description: "Observe picker position without gestures")
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { observed.fulfill() }
        wait(for: [observed], timeout: 12)
        print("Permitext navigation regression picker footer: \(footer.value ?? "missing")")
        let pickerDump = XCTAttachment(string: app.debugDescription)
        pickerDump.name = "HMC picker settled navigation AX"
        pickerDump.lifetime = .keepAlways
        add(pickerDump)
        keepScreenshot(named: "HMC diagnostic picker settled navigation", from: app)
        XCTAssertTrue((footer.value as? String)?.contains("27-2120") == true, "Picker target must survive settled layout.")
        XCTAssertTrue(heading.exists && heading.isHittable)
        XCTAssertEqual(heading.frame.minY, initialY, accuracy: 4, "Initial and picker navigation must align the same heading viewport.")
        let beforeDrag = heading.frame.minY
        app.swipeUp()
        let moved = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            !heading.exists || abs(heading.frame.minY - beforeDrag) > 40
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [moved], timeout: 5), .completed, "Semantic positioning must permit manual scrolling.")
        keepScreenshot(named: "HMC manual scrolling remains possible", from: app)
        // Both initial and explicit destinations must survive delayed layout growth.
    }

    func testNativeHousingHarassmentLongDefinitionScrollsClosesAndReturns() {
        executionTimeAllowance = 180
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-housing-scoped-definition", "--native-reader-housing-harassment"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45), launchFailureDescription(in: app))
        let term = app.links.matching(NSPredicate(format: "label ==[c] %@", "harassment")).firstMatch
        // Do not interfere with initial restoration while its geometry settles.
        let initialReady = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (app.buttons["Jump within chapter"].value as? String)?.contains("27-2120") == true && term.exists && term.isHittable
        }, object: nil)
        let initiallyAligned = XCTWaiter.wait(for: [initialReady], timeout: 30) == .completed
        keepScreenshot(named: initiallyAligned ? "Native HMC Harassment initial target aligned" : "Native HMC Harassment initial target not aligned after bounded wait", from: app)
        // Explicit navigation can isolate popup behavior if initial restoration
        // does not settle; that observation remains separate from popup acceptance.
        if !initiallyAligned { jumpToSection("27-2120", in: app) }
        for _ in 0..<8 {
            if term.exists && term.isHittable { break }
            app.swipeUp()
        }
        XCTAssertTrue(term.exists && term.isHittable, app.debugDescription)
        guard term.exists && term.isHittable else { return }
        let before = term.frame.minY
        keepScreenshot(named: "Native HMC Harassment original source passage", from: app)
        term.tap()
        let close = app.buttons["Close definition"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        let body = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Except where otherwise provided, the term")).firstMatch
        XCTAssertTrue(body.exists)
        XCTAssertEqual(body.label.utf16.count, 11330)
        XCTAssertTrue(body.label.hasSuffix("h.any conduct in violation of section 26-521."))
        XCTAssertTrue(close.isHittable)
        keepScreenshot(named: "Native HMC Harassment complete meaning top", from: app)
        let citation = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@ AND label CONTAINS %@", "HOUSING MAINTENANCE CODE", "27-2004")).firstMatch
        var reachedEnd = false
        for _ in 0..<35 {
            if citation.exists && citation.isHittable && citation.frame.maxY < app.frame.maxY - 45 {
                reachedEnd = true
                break
            }
            app.swipeUp()
        }
        XCTAssertTrue(reachedEnd, "The final source citation must become visible within bounded scrolling.")
        XCTAssertTrue(close.isHittable, "Close must remain reachable at the end of the long definition.")
        keepScreenshot(named: "Native HMC Harassment final clause citation and Close", from: app)
        close.tap()
        let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in !close.exists && term.isHittable }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [dismissed], timeout: 5), .completed)
        XCTAssertEqual(term.frame.minY, before, accuracy: 2)
        keepScreenshot(named: "Native HMC Harassment returned exact source viewport", from: app)
    }

    func testNativeTitle26AffordableHousingReferenceClosesAndReturns() {
        executionTimeAllowance = 180
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-title26-affordable-housing"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45), launchFailureDescription(in: app))
        let probe = element(in: app, identifier: "definition-visible-glyph")
        for _ in 0..<16 {
            if (probe.value as? String)?.hasPrefix("ready:") == true { break }
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72))
                .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.47)))
        }
        let parts = (probe.value as? String ?? "").split(separator: ":")
        guard parts.count == 5, parts[0] == "ready", parts[3] == "true",
              let x = Double(parts[1]), let y = Double(parts[2]), x.isFinite, y.isFinite else {
            XCTFail("Expected visible linked Affordable housing unit glyph in actual section 26-2602: \(probe.value ?? "missing")")
            return
        }
        keepScreenshot(named: "Native Title 26 Affordable housing unit actual source glyph", from: app)
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x, dy: y)).tap()
        let close = app.buttons["Close definition"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        let body = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Affordable housing unit. The term")).firstMatch
        XCTAssertTrue(body.exists)
        XCTAssertEqual(body.label, "Affordable housing unit. The term \"affordable housing unit\" means a dwelling unit that is (i) required, pursuant to a federal, state or local law, rule or program administered by the city or an agreement with the city or a person acting on the city's behalf, to be affordable for an extremely low income household, a very low income household, a low income household, a moderate income household or a middle income household and (ii) operates pursuant to an agreement administered by the department.")
        XCTAssertTrue(close.isHittable)
        keepScreenshot(named: "Native Title 26 Affordable housing unit complete meaning top", from: app)
        let citation = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@ AND label CONTAINS %@", "ADMINISTRATIVE CODE TITLE 26", "26-2201")).firstMatch
        var reachedEnd = false
        for _ in 0..<20 {
            if citation.exists && citation.isHittable && citation.frame.maxY < app.frame.maxY - 45 {
                reachedEnd = true
                break
            }
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.86))
                .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.50)))
        }
        XCTAssertTrue(reachedEnd, "The complete definition and its source citation must be reachable.")
        XCTAssertTrue(close.isHittable)
        keepScreenshot(named: "Native Title 26 Affordable housing unit complete body citation and Close", from: app)
        close.tap()
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: close)], timeout: 5), .completed)
        let dismissalSample = Int((probe.value as? String ?? "").split(separator: ":").last ?? "") ?? -1
        let freshReturn = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            let restored = (probe.value as? String ?? "").split(separator: ":")
            guard restored.count == 5, restored[0] == "ready", restored[3] == "true",
                  let rx = Double(restored[1]), let ry = Double(restored[2]),
                  let sample = Int(restored[4]), sample > dismissalSample + 2,
                  rx.isFinite, ry.isFinite else { return false }
            return abs(rx - x) <= 4 && abs(ry - y) <= 4
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [freshReturn], timeout: 5), .completed,
                       "A fresh post-dismissal measurement must retain the actual Affordable housing unit glyph position")
        keepScreenshot(named: "Native Title 26 Affordable housing unit returned exact source glyph", from: app)
    }

    func testNativeTitle26BuyoutDefinitionClosesAndReturns() {
        executionTimeAllowance = 180
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-title26-buyout"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45), launchFailureDescription(in: app))
        let probe = element(in: app, identifier: "definition-visible-glyph")
        for _ in 0..<16 {
            if (probe.value as? String)?.hasPrefix("ready:") == true { break }
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72))
                .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.47)))
        }
        let parts = (probe.value as? String ?? "").split(separator: ":")
        guard parts.count == 5, parts[0] == "ready", parts[3] == "true",
              let x = Double(parts[1]), let y = Double(parts[2]), x.isFinite, y.isFinite else {
            XCTFail("Expected visible linked Buyout agreement glyph in actual section 26-2403: \(probe.value ?? "missing")")
            return
        }
        keepScreenshot(named: "Native Title 26 Buyout agreement actual source glyph", from: app)
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x, dy: y)).tap()
        let close = app.buttons["Close definition"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        let body = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Buyout agreement. The term")).firstMatch
        XCTAssertTrue(body.exists)
        XCTAssertEqual(body.label, "Buyout agreement. The term \"buyout agreement\" means an agreement wherein the owner of a dwelling unit exchanges money or other valuable consideration to induce any person lawfully entitled to occupancy of such unit to surrender or waive any rights in relation to such occupancy that results in the tenant vacating such unit.")
        XCTAssertTrue(close.isHittable)
        keepScreenshot(named: "Native Title 26 Buyout agreement complete meaning top", from: app)
        let citation = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@ AND label CONTAINS %@", "ADMINISTRATIVE CODE TITLE 26", "26-2402")).firstMatch
        var reachedEnd = false
        for _ in 0..<20 {
            if citation.exists && citation.isHittable && citation.frame.maxY < app.frame.maxY - 45 {
                reachedEnd = true
                break
            }
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.86))
                .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.50)))
        }
        XCTAssertTrue(reachedEnd, "The complete definition and its source citation must be reachable.")
        XCTAssertTrue(close.isHittable)
        keepScreenshot(named: "Native Title 26 Buyout agreement complete body citation and Close", from: app)
        close.tap()
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: close)], timeout: 5), .completed)
        let dismissalSample = Int((probe.value as? String ?? "").split(separator: ":").last ?? "") ?? -1
        let freshReturn = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            let restored = (probe.value as? String ?? "").split(separator: ":")
            guard restored.count == 5, restored[0] == "ready", restored[3] == "true",
                  let rx = Double(restored[1]), let ry = Double(restored[2]),
                  let sample = Int(restored[4]), sample > dismissalSample + 2,
                  rx.isFinite, ry.isFinite else { return false }
            return abs(rx - x) <= 4 && abs(ry - y) <= 4
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [freshReturn], timeout: 5), .completed,
                       "A fresh post-dismissal measurement must retain the actual Buyout agreement glyph position")
        keepScreenshot(named: "Native Title 26 Buyout agreement returned exact source glyph", from: app)
    }

    func testNativeHousingFamilyFullDefinitionScrollsClosesAndReturns() {
        executionTimeAllowance = 180
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-housing-scoped-definition", "--native-reader-housing-family"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45), launchFailureDescription(in: app))
        let probe = element(in: app, identifier: "definition-visible-glyph")
        for _ in 0..<16 {
            if (probe.value as? String)?.hasPrefix("ready:") == true { break }
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72))
                .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.47)))
        }
        let parts = (probe.value as? String ?? "").split(separator: ":")
        guard parts.count == 5, parts[0] == "ready", parts[3] == "true",
              let x = Double(parts[1]), let y = Double(parts[2]), x.isFinite, y.isFinite else {
            XCTFail("Expected visible linked Family glyph in actual section 27-2076: \(probe.value ?? "missing")")
            return
        }
        keepScreenshot(named: "Native HMC Family actual source glyph", from: app)
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x, dy: y)).tap()
        let close = app.buttons["Close definition"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        let body = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "A family is:")).firstMatch
        XCTAssertTrue(body.exists)
        XCTAssertEqual(body.label.utf16.count, 2339)
        XCTAssertEqual(body.label.components(separatedBy: "\n\n").count, 13)
        XCTAssertTrue(body.label.trimmingCharacters(in: .whitespacesAndNewlines).hasSuffix("Lack of access to all parts of the dwelling unit establishes a rebuttable presumption that no common household exists."))
        XCTAssertTrue(close.isHittable)
        keepScreenshot(named: "Native HMC Family complete meaning top", from: app)
        let citation = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@ AND label CONTAINS %@", "HOUSING MAINTENANCE CODE", "27-2004")).firstMatch
        var reachedEnd = false
        for _ in 0..<20 {
            if citation.exists && citation.isHittable && citation.frame.maxY < app.frame.maxY - 45 {
                reachedEnd = true
                break
            }
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.86))
                .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.50)))
        }
        XCTAssertTrue(reachedEnd, "The final common-household paragraph and its source citation must be reachable.")
        XCTAssertTrue(close.isHittable)
        keepScreenshot(named: "Native HMC Family final household clause citation and Close", from: app)
        close.tap()
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: close)], timeout: 5), .completed)
        let dismissalSample = Int((probe.value as? String ?? "").split(separator: ":").last ?? "") ?? -1
        let freshReturn = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            let restored = (probe.value as? String ?? "").split(separator: ":")
            guard restored.count == 5, restored[0] == "ready", restored[3] == "true",
                  let rx = Double(restored[1]), let ry = Double(restored[2]),
                  let sample = Int(restored[4]), sample > dismissalSample + 2,
                  rx.isFinite, ry.isFinite else { return false }
            return abs(rx - x) <= 4 && abs(ry - y) <= 4
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [freshReturn], timeout: 5), .completed,
                       "A fresh post-dismissal measurement must retain the actual Family glyph position")
        keepScreenshot(named: "Native HMC Family returned exact source glyph", from: app)
    }

    func testNativeHousingClassALongDefinitionScrollsClosesAndReturns() {
        executionTimeAllowance = 180
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-housing-scoped-definition", "--native-reader-housing-class-a"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45), launchFailureDescription(in: app))
        let term = app.links.matching(NSPredicate(format: "label ==[c] %@", "class A multiple dwelling")).firstMatch
        let heading = app.textViews.matching(NSPredicate(format: "label BEGINSWITH %@", "27-2033.1 Heat inspections")).firstMatch
        let initialReady = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (app.buttons["Jump within chapter"].value as? String)?.contains("27-2033.1") == true && heading.exists && heading.isHittable
        }, object: nil)
        let initiallyAligned = XCTWaiter.wait(for: [initialReady], timeout: 30) == .completed
        keepScreenshot(named: "Native HMC Class A initial section heading and footer", from: app)
        XCTAssertTrue(initiallyAligned, app.debugDescription)
        guard initiallyAligned else { return }
        // The singular occurrence follows the local definitions and plural uses below the initial viewport.
        for _ in 0..<8 {
            if term.exists && term.isHittable { break }
            app.swipeUp()
        }
        XCTAssertTrue(term.exists && term.isHittable, app.debugDescription)
        guard term.exists && term.isHittable else { return }
        let before = term.frame.minY
        keepScreenshot(named: "Native HMC Class A original source passage", from: app)
        term.tap()
        let close = app.buttons["Close definition"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        let body = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "(a)A class A multiple dwelling")).firstMatch
        XCTAssertTrue(body.exists)
        XCTAssertEqual(body.label.utf16.count, 4358)
        XCTAssertTrue(body.label.hasSuffix("arranged or designed to provide three or more apartments."))
        XCTAssertTrue(close.isHittable)
        keepScreenshot(named: "Native HMC Class A complete meaning top", from: app)
        let citation = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@ AND label CONTAINS %@", "HOUSING MAINTENANCE CODE", "27-2004")).firstMatch
        var reachedEnd = false
        for _ in 0..<22 {
            if citation.exists && citation.isHittable && citation.frame.maxY < app.frame.maxY - 45 {
                reachedEnd = true
                break
            }
            app.swipeUp()
        }
        XCTAssertTrue(reachedEnd, "The final source citation must become visible within bounded scrolling.")
        XCTAssertTrue(close.isHittable, "Close must remain reachable at the end of the long definition.")
        keepScreenshot(named: "Native HMC Class A final clause citation and Close", from: app)
        close.tap()
        let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in !close.exists && term.isHittable }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [dismissed], timeout: 5), .completed)
        XCTAssertEqual(term.frame.minY, before, accuracy: 2)
        keepScreenshot(named: "Native HMC Class A returned exact source viewport", from: app)
    }

    func testPhysicalPreparedChapterOpeningTransitions() {
        executionTimeAllowance = 300
        let routes = [("--native-reader-housing-scoped-definition", "2"),
                      ("--native-reader-2014-building-chapter-7", "7"),
                      ("--native-reader-height-scope", "15")]
        for (argument, number) in routes {
            let app = XCUIApplication()
            app.launchArguments = ["--permitext-disable-clerk", argument, "--native-reader-browse-opening"]
            app.launch()
            let chapter = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Chapter \(number):")).firstMatch
            XCTAssertTrue(app.buttons["reader-code-picker"].waitForExistence(timeout: 45))
            for _ in 0..<16 {
                if chapter.exists && chapter.isHittable { break }
                app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72))
                    .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.35)))
            }
            XCTAssertTrue(chapter.isHittable)
            keepScreenshot(named: "Opening recording \(argument) before first push", from: app)
            chapter.tap()
            XCTAssertTrue(app.buttons["Jump within chapter"].waitForExistence(timeout: 45))
            XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45))
            keepScreenshot(named: "Opening recording \(argument) first ready", from: app)
            for _ in 0..<3 {
                app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72))
                    .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.40)))
            }
            guard let passage = app.textViews.matching(NSPredicate(format: "identifier BEGINSWITH %@", "native-reader-block-"))
                .allElementsBoundByIndex.first(where: { $0.isHittable }) else {
                XCTFail("Expected native source passage for \(argument)"); return
            }
            let id = passage.identifier
            let y = passage.frame.minY
            keepScreenshot(named: "Opening recording \(argument) before chapter back", from: app)
            app.navigationBars.buttons.element(boundBy: 0).tap()
            XCTAssertTrue(chapter.waitForExistence(timeout: 10))
            keepScreenshot(named: "Opening recording \(argument) before warm push", from: app)
            chapter.tap()
            let restored = app.textViews[id]
            let ready = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in restored.exists && restored.isHittable }, object: nil)
            XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 45), .completed)
            XCTAssertEqual(restored.frame.minY, y, accuracy: 4)
            keepScreenshot(named: "Opening recording \(argument) warm restored", from: app)
            app.terminate()
        }
    }

    func testNativeLargeTextDefinitionScrollCloseAndReturn() {
        executionTimeAllowance = 180
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-housing-scoped-definition",
                               "--native-reader-large-text-check", "-UIPreferredContentSizeCategoryName",
                               "UICTContentSizeCategoryAccessibilityM"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45))
        let probe = element(in: app, identifier: "definition-visible-glyph")
        for _ in 0..<16 {
            if (probe.value as? String)?.hasPrefix("ready:") == true { break }
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72))
                .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.50)))
        }
        let parts = (probe.value as? String ?? "").split(separator: ":")
        guard parts.count == 5, parts[0] == "ready", parts[3] == "true",
              let x = Double(parts[1]), let y = Double(parts[2]) else {
            XCTFail("Large-text source link must be visible: \(probe.value ?? "missing")"); return
        }
        XCTAssertTrue(probe.label.contains("UICTContentSizeCategoryAccessibilityM"), probe.label)
        let font = Double(probe.label.components(separatedBy: "font=").last ?? "") ?? 0
        XCTAssertGreaterThan(font, 24, "Actual source font must be enlarged")
        keepScreenshot(named: "Accessibility Medium actual source font and linked glyph", from: app)
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x, dy: y)).tap()
        let close = app.buttons["Close definition"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        XCTAssertTrue(close.isHittable)
        keepScreenshot(named: "Accessibility Medium definition top and Close", from: app)
        let citation = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@ AND label CONTAINS %@", "HOUSING MAINTENANCE CODE", "27-2045")).firstMatch
        for _ in 0..<40 {
            if citation.exists && citation.isHittable && citation.frame.maxY < app.frame.maxY - 30 { break }
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.86))
                .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.50)))
        }
        XCTAssertTrue(citation.isHittable)
        XCTAssertLessThan(citation.frame.maxY, app.frame.maxY - 30)
        XCTAssertTrue(close.isHittable)
        keepScreenshot(named: "Accessibility Medium definition final citation and Close", from: app)
        close.tap()
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: close)], timeout: 5), .completed)
        let sample = Int((probe.value as? String ?? "").split(separator: ":").last ?? "") ?? -1
        let returned = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            let value = (probe.value as? String ?? "").split(separator: ":")
            guard value.count == 5, value[0] == "ready", let rx = Double(value[1]), let ry = Double(value[2]),
                  let fresh = Int(value[4]), fresh > sample + 2 else { return false }
            return abs(rx - x) <= 4 && abs(ry - y) <= 4
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [returned], timeout: 5), .completed)
        keepScreenshot(named: "Accessibility Medium exact passage return", from: app)
    }

    func testNativeHousingClassALocalTwoSourcesScrollCloseAndReturn() {
        executionTimeAllowance = 180
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-housing-scoped-definition"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45), launchFailureDescription(in: app))
        let term = app.textViews.matching(NSPredicate(format: "label BEGINSWITH %@", "b.The owner of a class A multiple dwelling")).firstMatch
        let heading = app.textViews.matching(NSPredicate(format: "label BEGINSWITH %@", "27-2045 Duties of owner")).firstMatch
        let initialReady = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (app.buttons["Jump within chapter"].value as? String)?.contains("27-2045") == true && heading.exists && heading.isHittable
        }, object: nil)
        let initiallyAligned = XCTWaiter.wait(for: [initialReady], timeout: 30) == .completed
        keepScreenshot(named: "Native HMC local Class A initial section heading and footer", from: app)
        XCTAssertTrue(initiallyAligned, app.debugDescription)
        guard initiallyAligned else { return }
        // Physical iOS may expose the paragraph without individual Link AX
        // children. Use the operative paragraph observed in normal Reader.
        for _ in 0..<12 {
            if term.exists && term.isHittable && term.frame.minY > 130 && term.frame.maxY < app.frame.height - 140 { break }
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.70))
                .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.50)))
        }
        XCTAssertTrue(term.exists && term.isHittable, app.debugDescription)
        guard term.exists && term.isHittable else { return }
        let before = term.frame.minY
        keepScreenshot(named: "Native HMC local Class A original source passage", from: app)
        // The observed first line places the Class A link at mid-line.
        term.coordinate(withNormalizedOffset: .zero)
            .withOffset(CGVector(dx: term.frame.width * 0.5, dy: 8)).tap()
        let close = app.buttons["Close definition"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        let body = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "(a)A class A multiple dwelling")).firstMatch
        XCTAssertTrue(body.exists)
        XCTAssertEqual(body.label.utf16.count, 4358)
        XCTAssertTrue(body.label.hasSuffix("arranged or designed to provide three or more apartments."))
        XCTAssertTrue(close.isHittable)
        keepScreenshot(named: "Native HMC local Class A complete meaning top", from: app)
        let localBody = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "a.As used in this section:")).firstMatch
        XCTAssertTrue(localBody.exists)
        XCTAssertEqual(localBody.label.utf16.count, 882)
        XCTAssertTrue(localBody.label.contains("private dwellings, as such term is defined in paragraph 6 of subdivision a of section 27-2004."))
        XCTAssertEqual(body.links.count, 0)
        XCTAssertEqual(localBody.links.count, 0)
        let generalCitation = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@ AND label CONTAINS %@", "HOUSING MAINTENANCE CODE", "27-2004")).firstMatch
        let localCitation = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@ AND label CONTAINS %@", "HOUSING MAINTENANCE CODE", "27-2045")).firstMatch
        var sawGeneral = false
        var sawLocal = false
        for _ in 0..<35 {
            if generalCitation.exists && generalCitation.isHittable { sawGeneral = true }
            if localCitation.exists && localCitation.isHittable && localCitation.frame.maxY < app.frame.maxY - 45 { sawLocal = true }
            if sawGeneral && sawLocal { break }
            let scrollStart = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.86))
            let scrollEnd = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.62))
            scrollStart.press(forDuration: 0.1, thenDragTo: scrollEnd)
        }
        XCTAssertTrue(sawGeneral && sawLocal, "Both complete source citations must be reachable.")
        XCTAssertTrue(close.isHittable)
        keepScreenshot(named: "Native HMC local Class A final crossreference citations and Close", from: app)
        close.tap()
        let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in !close.exists && term.isHittable }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [dismissed], timeout: 5), .completed)
        XCTAssertEqual(term.frame.minY, before, accuracy: 2)
        keepScreenshot(named: "Native HMC local Class A returned exact source viewport", from: app)
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
        let second = navigationButton(in: app, title: "Second reader")
        XCTAssertTrue(second.waitForExistence(timeout: 45))
        second.tap()
        let edition = app.staticTexts["reader-source-edition"]
        XCTAssertTrue(edition.waitForExistence(timeout: 45))
        let secondEdition = edition.label
        navigationButton(in: app, title: "First reader").tap()
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
        navigationButton(in: app, title: "First reader").tap()
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
        navigationButton(in: app, title: "First reader").tap()
        XCTAssertEqual(app.buttons["reader-code-picker"].label, primaryTitle)
        second.tap()
        XCTAssertEqual(app.buttons["reader-code-picker"].label, secondaryTitle)
        keepScreenshot(named: "Second Reader retains Existing Building Code independently", from: app)
        let chapterOne = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Chapter 1:")).firstMatch
        XCTAssertTrue(chapterOne.waitForExistence(timeout: 15))
        chapterOne.tap()
        XCTAssertTrue(app.buttons["Jump within chapter"].waitForExistence(timeout: 45))
        let secondarySource = element(in: app, identifier: "reader-source-edition").label
        navigationButton(in: app, title: "First reader").tap()
        XCTAssertTrue(chapterOne.waitForExistence(timeout: 15))
        chapterOne.tap()
        XCTAssertTrue(app.buttons["Jump within chapter"].waitForExistence(timeout: 45))
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45))
        // A prior run can legitimately restore the chapter's final paragraph.
        // Establish a known start through the real jump control before dragging.
        app.buttons["Jump within chapter"].tap()
        let beginning = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "27-101 ")).firstMatch
        XCTAssertTrue(beginning.waitForExistence(timeout: 10))
        beginning.tap()
        let beginningReady = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (app.buttons["Jump within chapter"].value as? String)?.contains("27-101") == true
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [beginningReady], timeout: 15), .completed)
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
        navigationButton(in: app, title: "First reader").tap()
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
        let reopenedPassageReady = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            restoredPassage.isHittable && restoredPassage.frame.minY.isFinite
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [reopenedPassageReady], timeout: 15), .completed)
        XCTAssertEqual(restoredPassage.frame.minY, primaryY, accuracy: 4)
        keepScreenshot(named: "Deep Reader position after chapter reopen", from: app)
        app.terminate()
        app.launch()
        XCTAssertTrue(navigationButton(in: app, title: "First reader").waitForExistence(timeout: 45))
        navigationButton(in: app, title: "First reader").tap()
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

    func testSharedAppendixKPassagesRestoreIndependentlyInBothReaders() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk"]
        app.launch()
        let explore = app.buttons["phase5-first-use-explore"]
        if explore.waitForExistence(timeout: 5) { explore.tap() }
        func open(_ chapter: String, tab: String) throws -> (String, CGFloat) {
            navigationButton(in: app, title: tab).tap()
            let picker = app.buttons["reader-code-picker"]
            if !picker.exists { app.navigationBars.buttons.element(boundBy: 0).tap() }
            XCTAssertTrue(picker.waitForExistence(timeout: 30))
            picker.tap()
            // The normal menu lists 2022 before 2014; use its first exact family label.
            let building = app.collectionViews.buttons["Building Code"].firstMatch
            XCTAssertTrue(building.waitForExistence(timeout: 10))
            building.tap()
            XCTAssertTrue(picker.waitForExistence(timeout: 30))
            let tile = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Chapter K:", "Appendix K:")).firstMatch
            for _ in 0..<25 {
                if tile.exists && tile.isHittable { break }
                app.swipeUp()
            }
            XCTAssertTrue(tile.exists && tile.isHittable)
            tile.tap()
            XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45))
            XCTAssertTrue(element(in: app, identifier: "reader-source-edition").label.contains("2022"))
            let expected = chapter == "K2" ? "K201.1" : "K301.1"
            app.buttons["Jump within chapter"].tap()
            let jump = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", expected + " ")).firstMatch
            for _ in 0..<20 {
                if jump.exists && jump.isHittable { break }
                app.swipeUp()
            }
            XCTAssertTrue(jump.exists && jump.isHittable, app.debugDescription)
            jump.tap()
            let destinationReady = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
                (app.buttons["Jump within chapter"].value as? String)?.contains(expected) == true
            }, object: nil)
            XCTAssertEqual(XCTWaiter.wait(for: [destinationReady], timeout: 20), .completed)
            keepScreenshot(named: "Normal K picker and Jump \(tab) \(chapter)", from: app)
            let block = try XCTUnwrap(app.textViews.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "native-reader-block-", expected)).allElementsBoundByIndex.first { $0.isHittable }, "Actual native heading must show \(expected).\n\(app.debugDescription)")
            return (block.identifier, block.frame.minY)
        }
        XCTAssertTrue(navigationButton(in: app, title: "First reader").waitForExistence(timeout: 45))
        let first = try open("K2", tab: "First reader")
        let second = try open("K3", tab: "Second reader")
        XCTAssertNotEqual(first.0, second.0, "Independent Readers must retain different native section blocks")
        for (tab, chapter, snapshot) in [("First reader", "K2", first), ("Second reader", "K3", second)] {
            navigationButton(in: app, title: tab).tap()
            let block = app.textViews[snapshot.0]
            XCTAssertTrue(block.waitForExistence(timeout: 15))
            XCTAssertTrue(block.isHittable)
            XCTAssertEqual(block.frame.minY, snapshot.1, accuracy: 4)
            keepScreenshot(named: "Shared appendix \(chapter) tab return", from: app)
            app.navigationBars.buttons.element(boundBy: 0).tap()
            let tile = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Chapter K:", "Appendix K:")).firstMatch
            XCTAssertTrue(tile.waitForExistence(timeout: 15))
            tile.tap()
            XCTAssertTrue(block.waitForExistence(timeout: 45))
            XCTAssertTrue(block.isHittable)
            XCTAssertEqual(block.frame.minY, snapshot.1, accuracy: 4)
            keepScreenshot(named: "Shared appendix \(chapter) chapter reopen", from: app)
        }
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
        let searchTab = app.buttons["Search"]
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
        app.navigationBars.buttons.element(boundBy: 0).tap()
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

        let saved = navigationButton(in: app, title: "Saved")
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

    func testServerOnlyResearchFailureRestoresOnceAndRetriesOriginalRequest() {
        let app = XCUIApplication()
        app.launchArguments += ["--permitext-disable-clerk", "--phase3-entitled-research-fixture", "--phase3-seeded-selection-fixture", "--research-server-failure-fixture"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "research-composer").waitForExistence(timeout: 45))
        let text = "Server-only retained question?"
        let questions = app.staticTexts.matching(NSPredicate(format: "label == %@", text))
        let failures = app.staticTexts.matching(NSPredicate(format: "label == %@", "Research could not finish generating a complete answer. Your question is still here."))
        XCTAssertTrue(failures.firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertEqual(questions.count, 1)
        XCTAssertEqual(failures.count, 1)
        let diagnostics = element(in: app, identifier: "research-server-failure-diagnostics")
        XCTAssertEqual(diagnostics.value as? String, "requests:0:none")
        app.buttons["Research history"].tap()
        let history = app.buttons.matching(identifier: "research-history-row").firstMatch
        XCTAssertTrue(history.waitForExistence(timeout: 5))
        history.tap()
        XCTAssertTrue(failures.firstMatch.waitForExistence(timeout: 5))
        XCTAssertEqual(questions.count, 1)
        XCTAssertEqual(diagnostics.value as? String, "requests:0:none")
        keepScreenshot(named: "Server-only Research failure restored once without request", from: app)
        app.buttons["Try again"].tap()
        let disclosure = app.buttons["Continue to Research"]
        if disclosure.waitForExistence(timeout: 2) { disclosure.tap() }
        let completed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (diagnostics.value as? String) == "requests:1:server-original-request" && failures.count == 0 && questions.count == 1
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [completed], timeout: 15), .completed, app.debugDescription)
        keepScreenshot(named: "Server-only Research original request retry completed once", from: app)
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

        let sourcesAndDetails = app.buttons["Sources & details"]
        reveal(sourcesAndDetails, in: app)
        XCTAssertTrue(sourcesAndDetails.exists && sourcesAndDetails.isHittable, "Sources and details are absent.")
        sourcesAndDetails.tap()
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

    private func runCycles(_ iterations: Int, in app: XCUIApplication, captureSavedList: Bool = false) {
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
            let allSaved = element(in: app, identifier: "all-saved-link")
            if allSaved.waitForExistence(timeout: 2) { allSaved.tap() }
            XCTAssertTrue(
                element(in: app, identifier: "all-saved-root").waitForExistence(timeout: 5),
                "Cycle \(iteration): All saved did not become visible."
            )
            XCTAssertTrue(
                firstSavedRow(in: app).waitForExistence(timeout: 10),
                "Cycle \(iteration): saved section is absent from Projects."
            )

            if captureSavedList { keepScreenshot(named: "Accessibility Medium Saved list and source row", from: app) }

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
                element(in: app, identifier: "all-saved-root").waitForExistence(timeout: 5),
                "Cycle \(iteration): All saved did not return after removal."
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
            return "Physical stress harness failed: \(failure.value as? String ?? failure.label)"
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
