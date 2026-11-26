import XCTest
import Vision

final class NativeReaderPhysicalStressUITests: XCTestCase {
    private let bookmarkIdentifier = "reader-current-section-bookmark"
    private let savedRowIdentifierPrefix = "projects-bookmark-"

    private func navigationButton(in app: XCUIApplication, title: String) -> XCUIElement {
        if (title == "First reader" || title == "Second reader"), app.buttons["main-tab-reader"].exists {
            let context = title == "First reader" ? "primary" : "secondary"
            let reading = app.buttons["reader-session-\(context)"]
            if !reading.isHittable { app.buttons["main-tab-reader"].tap() }
            return reading
        }
        let ids = ["Saved": "main-tab-saved", "First reader": "main-tab-reader-1",
                   "Second reader": "main-tab-reader-2", "Assistant": "main-tab-research"]
        return app.buttons.matching(NSPredicate(format: "identifier == %@ OR label == %@", ids[title] ?? title, title)).firstMatch
    }

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 7_200
    }

    func testResearchProjectContextToggleLivesInConversationMenu() throws {
#if !DEBUG
        throw XCTSkip("Research context uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        let project = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@",
                                                       "saved-folder-", "Acceptance Project")).firstMatch
        XCTAssertTrue(project.waitForExistence(timeout: 10))
        project.tap()
        let assistantTab = app.buttons["main-tab-research"]
        XCTAssertEqual(assistantTab.label, "Assistant")
        assistantTab.tap()
        XCTAssertTrue(app.staticTexts["screen-title-Assistant"].waitForExistence(timeout: 10))
        XCTAssertTrue(element(in: app, identifier: "research-history-list").waitForExistence(timeout: 10))
        XCTAssertFalse(element(in: app, identifier: "bottom-search-bar").exists)
        keepScreenshot(named: "Assistant history without a search bar", from: app)
        let newResearch = app.buttons["New conversation"]
        XCTAssertTrue(newResearch.waitForExistence(timeout: 15))
        newResearch.tap()

        let actions = app.buttons["Assistant actions"]
        let toggle = app.descendants(matching: .any).matching(identifier: "Include project context and facts").firstMatch
        XCTAssertTrue(element(in: app, identifier: "research-composer").waitForExistence(timeout: 15))
        let back = app.buttons["Assistant history"]
        XCTAssertTrue(back.waitForExistence(timeout: 10))
        XCTAssertTrue(actions.waitForExistence(timeout: 10))
        assertFloatingMenuWidth(back.frame.union(actions.frame), in: app)
        keepScreenshot(named: "Assistant conversation aligned to the floating menu", from: app)
        XCTAssertFalse(app.buttons["Review included Project context and facts"].exists)
        XCTAssertFalse(app.buttons["Include Project context and facts…"].exists)

        func openContextMenu() {
            XCTAssertTrue(actions.waitForExistence(timeout: 10))
            XCTAssertTrue(actions.wait(for: \.isEnabled, toEqual: true, timeout: 10))
            actions.tap()
            XCTAssertTrue(toggle.waitForExistence(timeout: 5))
            XCTAssertTrue(toggle.wait(for: \.isEnabled, toEqual: true, timeout: 10))
        }

        openContextMenu()
        XCTAssertTrue(toggle.isSelected)
        toggle.tap()
        XCTAssertTrue(actions.wait(for: \.isEnabled, toEqual: true, timeout: 10))
        app.buttons["Assistant history"].tap()
        let conversation = app.buttons.matching(identifier: "research-history-row").firstMatch
        XCTAssertTrue(conversation.waitForExistence(timeout: 15))
        conversation.tap()
        openContextMenu()
        XCTAssertFalse(toggle.isSelected)
        toggle.tap()
        openContextMenu()
        XCTAssertTrue(toggle.isSelected)
#endif
    }

    func testProjectFirstNavigationAndResearchIsolation() throws {
#if !DEBUG
        throw XCTSkip("Project navigation uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        XCTAssertEqual(app.tabBars.count, 0)
        keepScreenshot(named: "Project-first chooser", from: app)
        func openProject(_ name: String) {
            let card = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "saved-folder-", name)).firstMatch
            XCTAssertTrue(card.waitForExistence(timeout: 10))
            card.tap()
            XCTAssertTrue(element(in: app, identifier: "project-folder-root").waitForExistence(timeout: 10))
            XCTAssertEqual(app.tabBars.buttons.count, 4)
            XCTAssertEqual(app.staticTexts["project-workspace-name"].label, name)
        }
        openProject("Acceptance Project")
        for card in ["overview", "review", "notebook", "evidence", "calculator", "reports"] {
            XCTAssertTrue(app.buttons["project-section-\(card)"].isHittable)
        }
        XCTAssertFalse(app.buttons["project-section-research"].exists)
        keepScreenshot(named: "Six project cards and four tabs", from: app)
        let researchTab = app.buttons["main-tab-research"]
        researchTab.tap()
        XCTAssertFalse(app.staticTexts["Loading Assistant…"].exists)
        let newResearch = app.buttons["New conversation"]
        XCTAssertTrue(newResearch.waitForExistence(timeout: 15))
        XCTAssertFalse(app.buttons["research-history-project-filter"].exists)
        let history = element(in: app, identifier: "research-history-list")
        XCTAssertTrue(history.waitForExistence(timeout: 10))
        let bottomSearchBar = element(in: app, identifier: "bottom-search-bar")
        XCTAssertFalse(bottomSearchBar.exists)
        newResearch.tap()
        let back = app.buttons["Assistant history"]
        XCTAssertTrue(back.waitForExistence(timeout: 15))
        XCTAssertLessThan(back.frame.midX, app.frame.midX)
        XCTAssertFalse(app.staticTexts["Acceptance Project"].isHittable)
        keepScreenshot(named: "Research conversation with leading back button", from: app)
        XCTAssertFalse(app.buttons["research-project-context-menu"].exists)
        app.buttons["Assistant actions"].tap()
        app.buttons["Delete"].tap()
        let deletion = app.alerts["Delete conversation?"]
        XCTAssertTrue(deletion.staticTexts["This cannot be undone."].exists)
        deletion.buttons["Cancel"].tap()
        let composer = element(in: app, identifier: "research-composer")
        let composerBar = element(in: app, identifier: "research-composer-bar")
        XCTAssertTrue(composerBar.waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["research-attach-passage"].exists)
        let compactComposer = composerBar.frame
        XCTAssertEqual(composer.frame.midY, app.buttons["Send message"].frame.midY, accuracy: 1)
        keepScreenshot(named: "Compact Assistant composer without the plus button", from: app)
        let draft = "Draft retained when returning to Research. This second sentence wraps in the Assistant message field."
        composer.tap()
        composer.typeText(draft)
        XCTAssertGreaterThan(composerBar.frame.height, compactComposer.height)
        keepScreenshot(named: "Assistant composer expands for wrapped text", from: app)
        back.tap()
        let conversationRow = app.buttons.matching(identifier: "research-history-row").firstMatch
        XCTAssertTrue(conversationRow.waitForExistence(timeout: 15))
        keepScreenshot(named: "Research belongs to Acceptance Project", from: app)
        let historyOptions = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "research-history-options-")).firstMatch
        historyOptions.tap()
        let rename = app.buttons["Rename"]
        XCTAssertTrue(rename.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Pin"].exists)
        XCTAssertFalse(app.buttons["Delete"].exists)
        rename.tap()
        app.alerts["Rename conversation"].buttons["Cancel"].tap()
        let historyRowY = conversationRow.frame.minY
        let selectConversations = app.buttons["Select conversations"]
        XCTAssertEqual(selectConversations.frame.width, newResearch.frame.width, accuracy: 2)
        XCTAssertEqual(selectConversations.frame.height, newResearch.frame.height, accuracy: 2)
        selectConversations.tap()
        XCTAssertEqual(conversationRow.frame.minY, historyRowY, accuracy: 2,
                       "The conversation list stays in place when the toolbar enters selection mode.")
        app.buttons["Select All"].tap()
        let selectionCount = app.staticTexts["list-selection-count"]
        XCTAssertEqual(selectionCount.label, "1 selected")
        let cancelSelection = app.navigationBars.firstMatch.buttons["Cancel"]
        XCTAssertTrue(cancelSelection.isHittable)
        keepScreenshot(named: "Assistant history selection", from: app)
        cancelSelection.tap()
        XCTAssertTrue(conversationRow.waitForExistence(timeout: 10))
        conversationRow.tap()
        XCTAssertTrue(composer.waitForExistence(timeout: 15))
        XCTAssertEqual(composer.value as? String, draft)
        researchTab.tap()
        XCTAssertTrue(conversationRow.waitForExistence(timeout: 10))
        XCTAssertFalse(bottomSearchBar.exists)
        researchTab.tap()
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        XCTAssertEqual(composer.value as? String, draft)
        app.buttons["main-tab-search"].tap()
        XCTAssertTrue(app.textFields["Search codes"].waitForExistence(timeout: 10))
        let codeSearchFrame = bottomSearchBar.frame
        assertFloatingMenuWidth(codeSearchFrame, in: app)
        XCTAssertEqual(codeSearchFrame.height, 52, accuracy: 2)
        XCTAssertEqual(compactComposer.height, codeSearchFrame.height, accuracy: 1)
        XCTAssertEqual(compactComposer.minX, codeSearchFrame.minX, accuracy: 1)
        XCTAssertEqual(compactComposer.maxX, codeSearchFrame.maxX, accuracy: 1)
        keepScreenshot(named: "Code Search keeps its bottom bar", from: app)
        researchTab.tap()
        XCTAssertTrue(composer.waitForExistence(timeout: 10))
        XCTAssertEqual(composer.value as? String, draft)
        back.tap()
        XCTAssertTrue(conversationRow.isHittable)
        XCTAssertFalse(bottomSearchBar.exists)

        XCTAssertFalse(app.buttons["project-close"].exists)
        app.buttons["main-tab-saved"].tap()
        XCTAssertTrue(element(in: app, identifier: "project-folder-root").waitForExistence(timeout: 10))
        app.buttons["main-tab-saved"].tap()
        XCTAssertTrue(element(in: app, identifier: "projects-root").waitForExistence(timeout: 10))
        XCTAssertEqual(app.tabBars.count, 0)
        openProject("Correction Project")
        app.buttons["main-tab-research"].tap()
        XCTAssertTrue(app.buttons["New conversation"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts["No conversations yet"].waitForExistence(timeout: 15))
        researchTab.tap()
        XCTAssertTrue(app.staticTexts["No conversations yet"].isHittable)
        XCTAssertFalse(app.buttons.matching(identifier: "research-history-row").firstMatch.exists)
        keepScreenshot(named: "Correction Project has separate Research", from: app)
        XCTAssertFalse(app.buttons["project-close"].exists)
        app.buttons["main-tab-saved"].tap()
        XCTAssertTrue(element(in: app, identifier: "project-folder-root").waitForExistence(timeout: 10))
        app.buttons["main-tab-saved"].tap()
        openProject("Acceptance Project")
        app.buttons["main-tab-research"].tap()
        XCTAssertTrue(app.buttons.matching(identifier: "research-history-row").firstMatch.waitForExistence(timeout: 15))

        app.terminate()
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        XCTAssertEqual(app.tabBars.count, 0, "A new launch always starts at the chooser")
#endif
    }

    func testNewProjectStartsWithItsOwnSearchAndAssistantHistory() throws {
#if !DEBUG
        throw XCTSkip("Project navigation uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        let original = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@",
            "saved-folder-", "Acceptance Project")).firstMatch
        XCTAssertTrue(original.waitForExistence(timeout: 10))
        original.tap()

        let research = app.buttons["main-tab-research"]
        let search = app.buttons["main-tab-search"]
        let projects = app.buttons["main-tab-saved"]
        let newConversation = app.buttons["New conversation"]
        let historyRow = app.buttons.matching(identifier: "research-history-row").firstMatch
        research.tap()
        XCTAssertTrue(newConversation.waitForExistence(timeout: 15))
        newConversation.tap()
        let back = app.buttons["Assistant history"]
        XCTAssertTrue(back.waitForExistence(timeout: 15))
        back.tap()
        XCTAssertTrue(historyRow.waitForExistence(timeout: 15))

        search.tap()
        let field = app.textFields["Search codes"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.tap()
        field.typeText("FC 403.1\n")
        let result = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@",
            "search-result-", "403.1 General.")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 35))

        func returnToProjects() {
            projects.tap()
            XCTAssertTrue(element(in: app, identifier: "project-folder-root").waitForExistence(timeout: 10))
            projects.tap()
            XCTAssertTrue(element(in: app, identifier: "projects-root").waitForExistence(timeout: 10))
        }

        returnToProjects()
        let newProject = app.buttons["New project"]
        XCTAssertTrue(newProject.waitForExistence(timeout: 10))
        newProject.tap()
        let name = app.textFields["e.g. Bronx R-2 Passive House"]
        XCTAssertTrue(name.waitForExistence(timeout: 10))
        name.tap()
        name.typeText("Search Isolation Project")
        app.navigationBars.firstMatch.buttons["Save"].tap()
        XCTAssertTrue(app.staticTexts["project-workspace-name"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.staticTexts["project-workspace-name"].label, "Search Isolation Project")

        research.tap()
        XCTAssertTrue(app.staticTexts["No conversations yet"].waitForExistence(timeout: 15))
        XCTAssertFalse(historyRow.exists)
        search.tap()
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        XCTAssertTrue(["", "Search codes"].contains(field.value as? String ?? ""))
        XCTAssertFalse(result.exists)

        returnToProjects()
        original.tap()
        search.tap()
        XCTAssertTrue(result.waitForExistence(timeout: 35))
        XCTAssertEqual(field.value as? String, "FC 403.1")
        research.tap()
        XCTAssertTrue(historyRow.waitForExistence(timeout: 15))
#endif
    }

    func testProjectCardsReorderWithPressAndDrag() throws {
#if !DEBUG
        throw XCTSkip("Project navigation uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        let first = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "saved-folder-", "Acceptance Project")).firstMatch
        let second = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "saved-folder-", "Correction Project")).firstMatch
        XCTAssertTrue(first.isHittable)
        XCTAssertTrue(second.isHittable)
        XCTAssertLessThan(first.frame.minX, second.frame.minX)
        keepScreenshot(named: "Project cards with title above address", from: app)
        first.press(forDuration: 0.8, thenDragTo: second)
        func assertSecondIsFirst(_ expected: Bool) {
            XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
                (second.frame.minX < first.frame.minX) == expected
            }, object: nil)], timeout: 10), .completed)
        }
        assertSecondIsFirst(true)
        XCTAssertEqual(app.tabBars.count, 0, "Dragging rearranges cards without opening a Project")
        keepScreenshot(named: "Projects reordered by holding and dragging", from: app)
        second.tap()
        XCTAssertTrue(element(in: app, identifier: "project-folder-root").waitForExistence(timeout: 10))
        XCTAssertEqual(app.staticTexts["project-workspace-name"].label, "Correction Project")
        app.buttons["main-tab-saved"].tap()
        XCTAssertTrue(first.waitForExistence(timeout: 10))
        assertSecondIsFirst(true)
        second.press(forDuration: 0.8, thenDragTo: first)
        assertSecondIsFirst(false)
        XCTAssertEqual(app.tabBars.count, 0)
        keepScreenshot(named: "Projects dragged back to their original order", from: app)
#endif
    }

    func testProjectReaderSwitchesEditionsAndPreservesSourceChoices() throws {
#if !DEBUG
        throw XCTSkip("Reader menu checks use the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        let project = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "saved-folder-", "Acceptance Project")).firstMatch
        project.tap()
        XCTAssertTrue(element(in: app, identifier: "project-folder-root").waitForExistence(timeout: 10))
        app.buttons["main-tab-reader"].tap()
        let picker = app.buttons["reader-session-primary"]
        XCTAssertTrue(picker.waitForExistence(timeout: 15))
        XCTAssertFalse(app.buttons["project-close"].exists)
        XCTAssertFalse(app.buttons["reader-project-menu"].exists)
        XCTAssertFalse(app.staticTexts["project-workspace-name"].exists)
        picker.tap()
        // Both editions remain available through the bottom capsule’s library.
        let historicalBuilding = app.buttons.matching(NSPredicate(format: "label == %@", "Building Code")).element(boundBy: 1)
        XCTAssertTrue(historicalBuilding.isHittable)
        historicalBuilding.tap()
        let selected = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            picker.label.localizedCaseInsensitiveContains("2014")
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [selected], timeout: 15), .completed)
        picker.tap()
        let manage = app.buttons["Manage code sources…"]
        for _ in 0..<12 where !manage.isHittable { app.collectionViews.firstMatch.swipeUp() }
        XCTAssertTrue(manage.isHittable)
        manage.tap()
        XCTAssertTrue(app.buttons["active-sources-close"].waitForExistence(timeout: 10))
        let historical = app.switches["Building Code, 2014"]
        XCTAssertTrue(historical.waitForExistence(timeout: 15))
        for _ in 0..<12 where !historical.isHittable { app.swipeUp() }
        XCTAssertTrue(historical.isHittable)
        historical.tap()
        app.buttons["active-sources-close"].tap()
        for _ in 0..<4 { app.collectionViews.firstMatch.swipeDown() }
        XCTAssertFalse(app.buttons["Building Code (off)"].exists)
        XCTAssertEqual(app.buttons.matching(NSPredicate(format: "label == %@", "Building Code")).count, 1,
            "Only the enabled 2022 Building Code should appear after disabling the 2014 source")
        keepScreenshot(named: "Reader picker shows enabled sources only", from: app)
        for _ in 0..<12 where !manage.isHittable { app.collectionViews.firstMatch.swipeUp() }
        XCTAssertTrue(manage.isHittable, "Source settings stay available while disabled codes are hidden")
        manage.tap()
        XCTAssertTrue(app.buttons["active-sources-close"].waitForExistence(timeout: 10))
        XCTAssertTrue(historical.waitForExistence(timeout: 15))
        for _ in 0..<12 where !historical.isHittable { app.swipeUp() }
        historical.tap()
        app.buttons["active-sources-close"].tap()
        for _ in 0..<4 { app.collectionViews.firstMatch.swipeDown() }
        XCTAssertEqual(app.buttons.matching(NSPredicate(format: "label == %@", "Building Code")).count, 2)
        historicalBuilding.tap()
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            picker.label.localizedCaseInsensitiveContains("2014")
        }, object: nil)], timeout: 15), .completed)
        app.buttons["main-tab-saved"].tap()
        XCTAssertTrue(element(in: app, identifier: "project-folder-root").waitForExistence(timeout: 10))
        app.buttons["main-tab-saved"].tap()
        XCTAssertTrue(element(in: app, identifier: "projects-root").waitForExistence(timeout: 10))
#endif
    }

    func testReaderRecoversInvalidCategoryAndKeepsItsSourceAcrossTabs() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture",
                               "--permitext-disable-clerk", "-browseLeftCodeSectionID", "4294960000"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@",
            "saved-folder-", "Acceptance Project")).firstMatch.tap()
        app.buttons["main-tab-reader"].tap()
        let chapters = app.scrollViews["reader-chapter-browser-primary"]
        XCTAssertTrue(chapters.waitForExistence(timeout: 15))
        let primary = app.buttons["reader-session-primary"]
        XCTAssertFalse(primary.label.contains("All Sections"))
        primary.tap()
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label BEGINSWITH %@",
            "reader-code-", "Mechanical Code")).firstMatch.tap()
        let selected = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            primary.label.contains("Mechanical Code")
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [selected], timeout: 15), .completed)
        app.buttons["main-tab-search"].tap()
        XCTAssertTrue(element(in: app, identifier: "bottom-search-bar").waitForExistence(timeout: 10))
        app.buttons["main-tab-reader"].tap()
        XCTAssertTrue(chapters.isHittable)
        XCTAssertTrue(primary.label.contains("Mechanical Code"))
    }

    func testSecondaryReaderKeepsCurrentChaptersVisibleUntilReady() throws {
#if !DEBUG
        throw XCTSkip("Requires the isolated Reader loading fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture",
                               "--permitext-disable-clerk", "--native-secondary-reader-loading-fixture"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "saved-folder-", "Acceptance Project")).firstMatch.tap()
        app.buttons["main-tab-reader"].tap()
        let primary = app.buttons["reader-session-primary"]
        let secondary = app.buttons["reader-session-secondary"]
        let primaryChapters = app.scrollViews["reader-chapter-browser-primary"]
        let secondaryChapters = app.scrollViews["reader-chapter-browser-secondary"]
        XCTAssertTrue(primaryChapters.waitForExistence(timeout: 15))
        secondary.tap()
        XCTAssertTrue(waitForValue("Preparing", on: secondary, timeout: 4))
        XCTAssertTrue(secondary.isSelected)
        XCTAssertFalse(primary.isSelected)
        XCTAssertTrue(primaryChapters.isHittable)
        XCTAssertFalse(app.staticTexts["0%"].exists)
        XCTAssertFalse(app.staticTexts["Preparing second Reader..."].exists)
        XCTAssertTrue(secondaryChapters.waitForExistence(timeout: 15))
        XCTAssertTrue(secondary.isSelected)
        primary.tap()
        XCTAssertTrue(primaryChapters.isHittable)
        secondary.tap()
        XCTAssertTrue(secondaryChapters.isHittable)
        XCTAssertNotEqual(secondary.value as? String, "Preparing")
#endif
    }

    func testReaderCapsulesReturnToChaptersThenChooseCodesIndependently() throws {
#if !DEBUG
        throw XCTSkip("Reader navigation uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "saved-folder-", "Acceptance Project")).firstMatch.tap()
        app.buttons["main-tab-reader"].tap()
        let primary = app.buttons["reader-session-primary"]
        let secondary = app.buttons["reader-session-secondary"]
        var browser: XCUIElement {
            app.scrollViews["reader-chapter-browser-\(secondary.isSelected ? "secondary" : "primary")"]
        }
        var chapter: XCUIElement {
            browser.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Chapter 1:")).firstMatch
        }
        func assertSource(_ source: String, in capsule: XCUIElement) {
            XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
                capsule.label.contains(source)
            }, object: nil)], timeout: 20), .completed)
        }
        XCTAssertTrue(browser.waitForExistence(timeout: 15))
        XCTAssertFalse(app.buttons["reader-code-picker"].exists)
        let tabBar = app.tabBars.firstMatch
        let readerGap = tabBar.frame.minY - primary.frame.maxY
        app.buttons["main-tab-search"].tap()
        let searchBar = element(in: app, identifier: "bottom-search-bar")
        XCTAssertTrue(searchBar.waitForExistence(timeout: 10))
        XCTAssertEqual(tabBar.frame.minY - searchBar.frame.maxY, readerGap, accuracy: 1)
        app.buttons["main-tab-reader"].tap()
        XCTAssertTrue(browser.waitForExistence(timeout: 10))
        primary.tap()
        XCTAssertTrue(app.navigationBars["Code Library"].waitForExistence(timeout: 10))
        app.buttons.matching(NSPredicate(format: "label == %@", "Building Code")).firstMatch.tap()
        XCTAssertTrue(chapter.waitForExistence(timeout: 20))
        chapter.tap()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45))
        let chapterTitle = app.staticTexts["reader-chapter-title"]
        XCTAssertEqual(chapterTitle.label, "Administration")
        keepScreenshot(named: "Reader provision spacing", from: app)

        let selectorFrame = primary.frame
        XCTAssertTrue(primary.isSelected)
        XCTAssertFalse(secondary.isSelected)
        XCTAssertEqual(selectorFrame.maxX, secondary.frame.minX, accuracy: 1)
        XCTAssertEqual(selectorFrame.width, secondary.frame.width, accuracy: 1)
        assertFloatingMenuWidth(selectorFrame.union(secondary.frame), in: app)
        keepScreenshot(named: "Continuous glass Reader picker over the chapter", from: app)
        let chapterSearch = app.buttons["Search this chapter"]
        let sections = app.buttons["chapter-sections-toolbar"]
        XCTAssertTrue(sections.isHittable)
        XCTAssertLessThan(sections.frame.midX, chapterSearch.frame.midX)
        XCTAssertEqual(sections.frame.midY, chapterSearch.frame.midY, accuracy: 1)
        keepScreenshot(named: "Sections and Find share the Reader toolbar", from: app)
        chapterSearch.tap()
        let findField = app.textFields["Find in this chapter"]
        let findControls = element(in: app, identifier: "chapter-find-controls")
        XCTAssertTrue(findField.waitForExistence(timeout: 10))
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        assertFloatingMenuWidth(findControls.frame, in: app)
        XCTAssertTrue(sections.isHittable)
        XCTAssertFalse(findControls.buttons["Sections"].exists)
        XCTAssertFalse(primary.exists)
        XCTAssertFalse(secondary.exists)
        XCTAssertGreaterThan(findControls.frame.midY, app.frame.midY)
        keepScreenshot(named: "Find in Chapter replaces the Reader selectors above the keyboard", from: app)
        // Simulator can expose the software keyboard to accessibility while
        // a connected hardware keyboard keeps the software keyboard offscreen.
        let keyboardTop = app.keyboards.firstMatch.frame.minY
        if keyboardTop < app.frame.maxY {
            let distanceToKeys = keyboardTop - findControls.frame.maxY
            XCTAssertGreaterThanOrEqual(distanceToKeys, 0)
            XCTAssertLessThanOrEqual(distanceToKeys, 60)
        }
        findField.typeText("this code")
        XCTAssertTrue(sections.isHittable)
        let nextMatch = app.buttons["Next match"]
        let hasMatches = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: nextMatch)
        XCTAssertEqual(XCTWaiter.wait(for: [hasMatches], timeout: 10), .completed)
        findField.typeText("\n")
        XCTAssertTrue(waitForNonexistence(app.keyboards.firstMatch))
        XCTAssertEqual(findControls.frame.minY, selectorFrame.minY, accuracy: 4)
        nextMatch.tap()
        app.buttons["Close chapter find"].tap()
        XCTAssertTrue(primary.waitForExistence(timeout: 10))
        XCTAssertTrue(secondary.isHittable)
        XCTAssertFalse(findField.exists)

        chapterSearch.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        openChapterSections(in: app)
        XCTAssertTrue(waitForNonexistence(app.keyboards.firstMatch))
        XCTAssertFalse(findField.exists)
        let scope = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "101.2 ")).firstMatch
        XCTAssertTrue(scope.waitForExistence(timeout: 10))
        scope.tap()
        XCTAssertTrue(waitForValueContaining("101.2", on: chapterTitle))
        XCTAssertTrue(primary.isHittable)

        primary.tap()
        XCTAssertTrue(browser.waitForExistence(timeout: 10))
        XCTAssertTrue(chapter.isHittable)
        primary.tap()
        XCTAssertTrue(app.navigationBars["Code Library"].waitForExistence(timeout: 10))
        keepScreenshot(named: "Reader capsule code library", from: app)
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label BEGINSWITH %@", "reader-code-", "Plumbing Code")).firstMatch.tap()
        XCTAssertTrue(browser.waitForExistence(timeout: 15))
        assertSource("Plumbing Code", in: primary)

        secondary.tap()
        XCTAssertTrue(browser.waitForExistence(timeout: 30))
        secondary.tap()
        XCTAssertTrue(app.navigationBars["Code Library"].waitForExistence(timeout: 10))
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label BEGINSWITH %@", "reader-code-", "Mechanical Code")).firstMatch.tap()
        XCTAssertTrue(browser.waitForExistence(timeout: 15))
        assertSource("Mechanical Code", in: secondary)
        XCTAssertTrue(secondary.isSelected)
        XCTAssertFalse(primary.isSelected)
        XCTAssertTrue(chapter.waitForExistence(timeout: 20))
        chapter.tap()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45))
        keepScreenshot(named: "Mechanical Reader section spacing", from: app)
        chapterSearch.tap()
        XCTAssertTrue(findField.waitForExistence(timeout: 10))
        XCTAssertFalse(primary.exists)
        XCTAssertFalse(secondary.exists)
        chapterSearch.tap()
        XCTAssertTrue(secondary.waitForExistence(timeout: 10))
        XCTAssertFalse(findField.exists)
        secondary.tap()
        XCTAssertTrue(browser.waitForExistence(timeout: 10))
        secondary.tap()
        XCTAssertTrue(app.navigationBars["Code Library"].waitForExistence(timeout: 10))
        app.buttons["reader-code-library-close"].tap()
        primary.tap()
        XCTAssertTrue(browser.waitForExistence(timeout: 10))
        assertSource("Plumbing Code", in: primary)
        XCTAssertFalse(app.buttons["reader-code-picker"].exists)

#endif
    }

    func testScrolledConversationHeaderRemainsTappable() throws {
#if !DEBUG
        throw XCTSkip("Requires the isolated simulator fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "saved-folder-", "Acceptance Project")).firstMatch.tap()
        app.buttons["main-tab-research"].tap()
        let newConversation = app.buttons["New conversation"]
        XCTAssertTrue(newConversation.waitForExistence(timeout: 15))
        newConversation.tap()
        let composer = element(in: app, identifier: "research-composer")
        XCTAssertTrue(composer.waitForExistence(timeout: 15))
        composer.tap()
        composer.typeText(String(repeating: "Which Building Code provisions apply in this project example? ", count: 9))
        app.buttons["Send message"].tap()
        XCTAssertTrue(element(in: app, identifier: "research-answer").waitForExistence(timeout: 20))
        let userMessage = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Which Building Code")).firstMatch
        XCTAssertTrue(userMessage.exists)
        let initialMessageY = userMessage.frame.minY
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.46, dy: 0.63))
            .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.46, dy: 0.3)),
                   withVelocity: .slow, thenHoldForDuration: 0)
        XCTAssertLessThan(userMessage.frame.minY, initialMessageY - 90)
        keepScreenshot(named: "Soft edge above scrolled conversation", from: app)

        let actions = app.buttons["Assistant actions"]
        XCTAssertTrue(actions.exists, app.debugDescription)
        let screen = app.coordinate(withNormalizedOffset: .zero)
        screen.withOffset(CGVector(dx: actions.frame.midX, dy: actions.frame.midY)).tap()
        let context = app.buttons["Include project context and facts"]
        XCTAssertTrue(context.waitForExistence(timeout: 5), app.debugDescription)
        screen.withOffset(CGVector(dx: 12, dy: 250)).tap()
        let back = app.buttons["Assistant history"]
        XCTAssertTrue(back.exists)
        screen.withOffset(CGVector(dx: back.frame.midX, dy: back.frame.midY)).tap()
        XCTAssertTrue(newConversation.waitForExistence(timeout: 10), app.debugDescription)
#endif
    }

    func testReaderAppendixPinsAndWorkspaceRequiresExplicitExit() throws {
#if !DEBUG
        throw XCTSkip("Project navigation uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "saved-folder-", "Acceptance Project")).firstMatch.tap()
        app.buttons["main-tab-reader"].tap()
        let browser = app.scrollViews["reader-chapter-browser-primary"]
        XCTAssertTrue(browser.waitForExistence(timeout: 20))
        XCTAssertFalse(app.buttons["reader-code-picker"].exists)
        let chapters = app.staticTexts["screen-title-Chapters"]
        let appendix = app.staticTexts["screen-title-Appendix"]
        XCTAssertTrue(chapters.waitForExistence(timeout: 10))
        let titleFrame = chapters.frame
        keepScreenshot(named: "Aligned Chapters title", from: app)
        for (tab, title) in [("research", "Assistant"), ("search", "Search")] {
            app.buttons["main-tab-\(tab)"].tap()
            let heading = app.staticTexts["screen-title-\(title)"]
            XCTAssertTrue(heading.waitForExistence(timeout: 10))
            XCTAssertEqual(heading.frame.minX, titleFrame.minX, accuracy: 1)
            XCTAssertEqual(heading.frame.minY, titleFrame.minY, accuracy: 1)
            keepScreenshot(named: "Aligned \(title) title", from: app)
        }
        app.buttons["main-tab-reader"].tap()
        XCTAssertTrue(chapters.waitForExistence(timeout: 10))
        let workspaceFrame = browser.frame
        // Pull both the cards and the heading, which used to dismiss the zoomed workspace.
        for y in [0.3, 0.12] {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: y))
                .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.85)))
            XCTAssertTrue(browser.exists)
            XCTAssertEqual(app.tabBars.buttons.count, 4)
            XCTAssertEqual(browser.frame.minY, workspaceFrame.minY, accuracy: 2)
            XCTAssertEqual(browser.frame.width, workspaceFrame.width, accuracy: 2)
            XCTAssertTrue(app.buttons["reader-session-primary"].isHittable)
        }
        keepScreenshot(named: "Workspace stays open after pull-down gestures", from: app)
        // Pick a known source using the bottom capsule only.
        app.buttons["reader-session-primary"].tap()
        XCTAssertTrue(app.navigationBars["Code Library"].waitForExistence(timeout: 10))
        app.buttons.matching(NSPredicate(format: "label == %@", "Building Code")).firstMatch.tap()
        XCTAssertTrue(chapters.waitForExistence(timeout: 15))
        let headingY = chapters.frame.minY
        let firstChapter = browser.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Chapter 1:")).firstMatch
        let firstAppendix = browser.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Appendix A:")).firstMatch
        XCTAssertTrue(firstChapter.waitForExistence(timeout: 10))
        let restingCardY = firstChapter.frame.minY
        let cardSize = firstChapter.frame.size
        let longChapter = browser.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Chapter 4:")).firstMatch
        XCTAssertTrue(longChapter.isHittable)
        XCTAssertEqual(longChapter.frame.width, cardSize.width, accuracy: 1)
        XCTAssertEqual(longChapter.frame.height, cardSize.height, accuracy: 1)
        keepScreenshot(named: "Equal chapter cards with short and long titles", from: app)
        func isPinned(_ heading: XCUIElement) -> Bool {
            heading.exists && heading.isHittable && abs(heading.frame.minY - headingY) < 3
        }
        browser.swipeUp(velocity: .slow)
        XCTAssertTrue(isPinned(chapters), "Chapters stays pinned with a transparent header")
        keepScreenshot(named: "Chapters pinned without a solid background", from: app)
        for _ in 0..<20 {
            if firstAppendix.exists && firstAppendix.frame.minY < browser.frame.maxY - 120 { break }
            browser.swipeUp(velocity: .slow)
        }
        XCTAssertTrue(firstAppendix.exists)
        XCTAssertEqual(firstAppendix.frame.width, cardSize.width, accuracy: 1)
        XCTAssertEqual(firstAppendix.frame.height, cardSize.height, accuracy: 1)
        let dragStart = browser.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
        func moveFirstAppendix(to destinationY: CGFloat) {
            for _ in 0..<6 {
                let remaining = firstAppendix.frame.minY - destinationY
                if abs(remaining) <= 5 { return }
                // The start of a short drag is consumed by the scroll view's pan recognizer.
                let distance = min(abs(remaining) + 24, 260) * (remaining > 0 ? -1 : 1)
                dragStart.press(forDuration: 0.05, thenDragTo: dragStart.withOffset(CGVector(dx: 0, dy: distance)),
                                withVelocity: .slow, thenHoldForDuration: 0.15)
            }
            XCTAssertEqual(firstAppendix.frame.minY, destinationY, accuracy: 5)
        }
        moveFirstAppendix(to: browser.frame.midY)
        let inlineAppendix = browser.staticTexts["reader-appendix-section-heading"]
        XCTAssertTrue(inlineAppendix.isHittable)
        XCTAssertEqual(inlineAppendix.label, "Appendix")
        XCTAssertEqual(inlineAppendix.frame.minX, firstAppendix.frame.minX, accuracy: 2)
        XCTAssertEqual(firstAppendix.frame.minY - inlineAppendix.frame.maxY, 12, accuracy: 2)
        XCTAssertTrue(isPinned(chapters))
        keepScreenshot(named: "Appendix heading directly above the cards", from: app)

        moveFirstAppendix(to: restingCardY + 14)
        XCTAssertTrue(isPinned(chapters), "Chapters should stay until Appendix A reaches the first chapter card's position")
        XCTAssertTrue(inlineAppendix.exists, "The inline Appendix heading must remain visible until the pinned title takes over")
        XCTAssertEqual(firstAppendix.frame.minY - inlineAppendix.frame.maxY, 12, accuracy: 2)
        keepScreenshot(named: "Appendix heading just before the pinned handoff", from: app)
        moveFirstAppendix(to: restingCardY - 14)
        XCTAssertTrue(isPinned(appendix), "The title should change as soon as Appendix A passes the first chapter card's position")
        XCTAssertFalse(inlineAppendix.exists, "Only the pinned Appendix title should appear at the top")
        XCTAssertFalse(chapters.exists && chapters.frame.maxY > headingY + 3,
            "Chapters must leave the pinned title area when Appendix replaces it")
        let appendixY = appendix.frame.minY
        keepScreenshot(named: "Appendix replaces Chapters at the pinned heading", from: app)
        moveFirstAppendix(to: restingCardY + 14)
        XCTAssertTrue(isPinned(chapters), "Crossing the card boundary in reverse should restore Chapters")
        XCTAssertTrue(inlineAppendix.exists, "The inline heading must return as soon as the pinned title changes back")
        moveFirstAppendix(to: restingCardY - 14)
        browser.swipeUp(velocity: .slow)
        XCTAssertEqual(appendix.frame.minY, appendixY, accuracy: 2, "Appendix stays pinned while its cards scroll")
        for _ in 0..<20 {
            if isPinned(chapters) { break }
            browser.swipeDown(velocity: .slow)
        }
        XCTAssertTrue(isPinned(chapters), "Scrolling back restores Chapters")
        keepScreenshot(named: "Chapters restored after scrolling back", from: app)
        app.buttons["main-tab-research"].tap()
        XCTAssertTrue(app.buttons["New conversation"].waitForExistence(timeout: 15))
        XCTAssertFalse(app.staticTexts["Loading Assistant…"].exists)
        app.buttons["main-tab-saved"].tap()
        XCTAssertTrue(element(in: app, identifier: "project-folder-root").waitForExistence(timeout: 10))
        app.buttons["project-close"].tap()
        XCTAssertTrue(element(in: app, identifier: "projects-root").waitForExistence(timeout: 10))
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "saved-folder-", "Acceptance Project")).firstMatch.tap()
        XCTAssertTrue(element(in: app, identifier: "project-folder-root").waitForExistence(timeout: 10))
        app.buttons["main-tab-saved"].tap()
        XCTAssertTrue(element(in: app, identifier: "projects-root").waitForExistence(timeout: 10))
#endif
    }

    func testSearchClearsQueryAfterProcessRelaunch() throws {
#if !DEBUG
        throw XCTSkip("Search relaunch uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture",
                               "--history-layout-fixture", "--permitext-disable-clerk"]
        app.launch()
        let ready = element(in: app, identifier: "phase3-research-fixture-ready")
        XCTAssertTrue(ready.waitForExistence(timeout: 45))
        let project = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@",
            "saved-folder-", "Acceptance Project")).firstMatch
        if project.isHittable { project.tap() }
        let search = app.buttons["main-tab-search"]
        XCTAssertTrue(search.waitForExistence(timeout: 15))
        search.tap()
        let field = app.textFields["Search codes"]
        XCTAssertTrue(field.waitForExistence(timeout: 15))
        let clear = app.buttons["Clear search"]
        if clear.isHittable { clear.tap() }
        field.tap()
        field.typeText("concrete")
        app.keyboards.buttons["Search"].tap()
        XCTAssertEqual(field.value as? String, "concrete")
        app.buttons["main-tab-reader"].tap()
        search.tap()
        XCTAssertEqual(field.value as? String, "concrete")

        app.terminate()
        app.launch()
        XCTAssertTrue(ready.waitForExistence(timeout: 45))
        if project.isHittable { project.tap() }
        XCTAssertTrue(search.waitForExistence(timeout: 15))
        search.tap()
        let recent = app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "search-recent-passage-")).firstMatch
        XCTAssertTrue(recent.waitForExistence(timeout: 15))
        XCTAssertEqual(field.value as? String, "Search codes")
        XCTAssertFalse(clear.exists)
#endif
    }

    func testSearchHistoryRowsStayCompactAndSourcesUseIcon() throws {
#if !DEBUG
        throw XCTSkip("Search layout uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture", "--history-layout-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "saved-folder-", "Acceptance Project")).firstMatch.tap()
        app.buttons["main-tab-search"].tap()
        let searchActions = app.buttons["Search actions"]
        let searchField = app.textFields["Search codes"]
        XCTAssertTrue(searchField.waitForExistence(timeout: 15))
        assertFloatingMenuWidth(element(in: app, identifier: "bottom-search-bar").frame, in: app)
        let clearSearch = app.buttons["Clear search"]
        if clearSearch.isHittable { clearSearch.tap() }
        searchField.tap()
        searchField.typeText("101.1")
        XCTAssertGreaterThanOrEqual(clearSearch.frame.width, 43)
        XCTAssertGreaterThanOrEqual(clearSearch.frame.height, 43)
        clearSearch.tap()
        app.keyboards.buttons["Search"].tap()
        XCTAssertTrue(app.staticTexts["Search"].isHittable)
        let searchHeadingY = app.staticTexts["Search"].frame.minY
        XCTAssertFalse(app.staticTexts["Searching enabled code sources"].exists)
        XCTAssertFalse(app.buttons["Manage code sources"].exists)
        XCTAssertTrue(searchActions.waitForExistence(timeout: 10))
        searchActions.tap()
        app.buttons["Code sources"].tap()
        let closeSources = app.buttons["active-sources-close"]
        XCTAssertTrue(closeSources.waitForExistence(timeout: 10))
        XCTAssertLessThan(closeSources.frame.midX, app.frame.midX)
        closeSources.tap()
        let scroll = app.scrollViews["search-results-scroll"]
        let rows = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH %@", "search-recent-passage-"))
        XCTAssertTrue(rows.firstMatch.waitForExistence(timeout: 15))
        let title = app.staticTexts["101.1 Title."]
        let scope = app.staticTexts["101.2 Scope."]
        func sortHistory(by order: String) {
            searchActions.tap()
            app.buttons["Sort"].tap()
            app.buttons[order].tap()
        }
        sortHistory(by: "Code Order")
        XCTAssertTrue(title.isHittable)
        XCTAssertTrue(scope.isHittable)
        XCTAssertLessThan(title.frame.minY, scope.frame.minY)
        keepScreenshot(named: "Search history in code order", from: app)
        sortHistory(by: "Title")
        XCTAssertLessThan(scope.frame.minY, title.frame.minY)
        sortHistory(by: "Recent")
        XCTAssertTrue(app.staticTexts["Today"].isHittable)
        func assertCompactRows() {
            var unique: [String: XCUIElement] = [:]
            for row in rows.allElementsBoundByIndex where row.isHittable {
                if row.frame.minY > scroll.frame.minY + 60, row.frame.maxY < scroll.frame.maxY - 80 {
                    if unique[row.identifier].map({ $0.frame.height < row.frame.height }) ?? true {
                        unique[row.identifier] = row
                    }
                }
            }
            let visible = unique.values.sorted { $0.frame.minY < $1.frame.minY }
            XCTAssertGreaterThanOrEqual(visible.count, 2)
            for index in 1..<visible.count {
                XCTAssertLessThan(visible[index].frame.minY - visible[index - 1].frame.maxY, 48,
                    "Recent passages should not acquire blank rows between them")
            }
        }
        assertCompactRows()
        keepScreenshot(named: "Compact recent passage history", from: app)
        scroll.swipeUp()
        scroll.swipeUp()
        assertCompactRows()
        XCTAssertTrue(searchActions.isHittable)
        // The transparent title lets result rows receive taps underneath it.
        // Verify its visible position rather than treating static text as a control.
        XCTAssertTrue(app.staticTexts["Search"].exists)
        XCTAssertEqual(app.staticTexts["Search"].frame.minY, searchHeadingY, accuracy: 2,
            "Search stays pinned with a transparent header")
        keepScreenshot(named: "Scrolled recent passage history without gaps", from: app)
        let visiblePassage = try XCTUnwrap(rows.allElementsBoundByIndex.first {
            $0.isHittable && $0.frame.minY > scroll.frame.minY + 60 && $0.frame.maxY < scroll.frame.maxY - 80
        })
        visiblePassage.tap()
        let closePassage = app.buttons["Close passage"]
        XCTAssertTrue(closePassage.waitForExistence(timeout: 15))
        XCTAssertLessThan(closePassage.frame.midX, app.frame.midX)
        closePassage.tap()
        XCTAssertTrue(searchField.waitForExistence(timeout: 10))
        app.buttons["main-tab-research"].tap()
        let researchHeading = app.staticTexts["screen-title-Assistant"]
        let researchList = element(in: app, identifier: "research-history-list")
        let researchRow = app.buttons.matching(identifier: "research-history-row").firstMatch
        XCTAssertTrue(researchRow.waitForExistence(timeout: 15))
        let researchHeadingFrame = researchHeading.frame
        researchList.swipeUp()
        XCTAssertEqual(researchHeading.frame.minY, researchHeadingFrame.minY, accuracy: 1)
        XCTAssertTrue(app.buttons["New conversation"].isHittable)
        keepScreenshot(named: "Scrolled Research with a transparent header", from: app)
        app.buttons["main-tab-saved"].tap()
        app.buttons["main-tab-saved"].tap()
        XCTAssertTrue(app.buttons["Open Account"].waitForExistence(timeout: 10))
        app.buttons["Open Account"].tap()
        XCTAssertTrue(app.buttons["account-close"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Pro unlocks saved sections")).firstMatch.exists)
        XCTAssertFalse(app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "Sync status:")).firstMatch.exists)
        keepScreenshot(named: "Account without duplicate description or sync strip", from: app)
#endif
    }

    func testFreeCodeLibraryCardPreservesReaderAndSearch() throws {
#if !DEBUG
        throw XCTSkip("Free navigation uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-access-flow-fixture", "--native-access-free", "--permitext-disable-clerk"]
        app.launch()
        let libraryCard = app.buttons["projects-code-library"]
        XCTAssertTrue(libraryCard.waitForExistence(timeout: 45))
        XCTAssertEqual(app.tabBars.count, 0)
        libraryCard.tap()
        XCTAssertTrue(app.buttons["main-tab-reader"].waitForExistence(timeout: 15))
        XCTAssertEqual(app.tabBars.buttons.count, 2)
        XCTAssertFalse(app.buttons["main-tab-research"].exists)
        app.buttons["main-tab-search"].tap()
        XCTAssertTrue(app.textFields["Search codes"].waitForExistence(timeout: 15))
        keepScreenshot(named: "Free Code Library search", from: app)
        app.buttons["project-close"].tap()
        XCTAssertTrue(libraryCard.waitForExistence(timeout: 10))
        XCTAssertEqual(app.tabBars.count, 0)
#endif
    }

    func testSavedProjectTilesAndAllSavedNavigation() throws {
        try verifySavedProjectNavigation(largeText: false)
    }

    func testProjectsHeaderHasSeparateNewProjectAndAccountButtons() throws {
#if !DEBUG
        throw XCTSkip("Projects toolbar uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))

        let newProject = app.buttons["New project"]
        let title = app.staticTexts["screen-title-Projects"]
        let account = app.buttons["Open Account"]
        XCTAssertTrue(newProject.isHittable)
        XCTAssertTrue(title.isHittable)
        XCTAssertTrue(account.isHittable)
        XCTAssertEqual(title.frame.midX, app.frame.midX, accuracy: 1)
        XCTAssertLessThan(newProject.frame.maxX, title.frame.minX)
        XCTAssertLessThan(title.frame.maxX, account.frame.minX)
        XCTAssertEqual(newProject.frame.width, newProject.frame.height, accuracy: 1)
        XCTAssertEqual(newProject.frame.width, account.frame.width, accuracy: 1)
        XCTAssertEqual(newProject.frame.midY, account.frame.midY, accuracy: 1)
        keepScreenshot(named: "Centered Projects title with separate toolbar buttons", from: app)

        newProject.tap()
        let editor = app.navigationBars["New project"]
        XCTAssertTrue(app.textFields["e.g. Bronx R-2 Passive House"].waitForExistence(timeout: 10))
        editor.buttons["Cancel"].tap()

        account.tap()
        XCTAssertTrue(app.buttons["account-close"].waitForExistence(timeout: 10))
#endif
    }

    func testEvidenceActionsSortAndSelectWithoutExport() throws {
#if !DEBUG
        throw XCTSkip("Evidence toolbar uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture",
                               "--native-project-overview-fixture", "--native-project-evidence-toolbar-fixture",
                               "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        let project = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@",
                                                       "saved-folder-", "Acceptance Project")).firstMatch
        XCTAssertTrue(project.waitForExistence(timeout: 10))
        project.tap()
        let evidence = app.buttons["project-section-evidence"]
        XCTAssertTrue(evidence.waitForExistence(timeout: 10))
        reveal(evidence, in: app)
        evidence.tap()
        XCTAssertTrue(app.navigationBars["Evidence"].waitForExistence(timeout: 10))
        let actions = app.buttons["Sort evidence"]
        let selectSections = app.buttons["Select sections"]
        XCTAssertTrue(actions.isHittable)
        XCTAssertTrue(selectSections.isHittable)
        XCTAssertLessThan(selectSections.frame.midX, actions.frame.midX)
        XCTAssertEqual(selectSections.frame.width, actions.frame.width, accuracy: 2)
        XCTAssertEqual(selectSections.frame.height, actions.frame.height, accuracy: 2)
        let rows = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "project-bookmark-"))
        let title = rows.matching(NSPredicate(format: "label CONTAINS %@", "101.1")).firstMatch
        let scope = rows.matching(NSPredicate(format: "label CONTAINS %@", "101.2")).firstMatch
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        XCTAssertTrue(scope.waitForExistence(timeout: 10))
        XCTAssertLessThan(title.frame.minY, scope.frame.minY)
        XCTAssertFalse(app.staticTexts["Syncing"].exists)
        XCTAssertFalse(app.staticTexts["Saved on this device · Waiting to sync"].exists)

        actions.tap()
        XCTAssertFalse(app.buttons["Export project (2)"].exists)
        XCTAssertFalse(app.buttons["Code Book"].exists)
        app.buttons["Title"].tap()
        XCTAssertLessThan(scope.frame.minY, title.frame.minY)
        keepScreenshot(named: "Evidence sorted by title with a visible selection button", from: app)

        selectSections.tap()
        XCTAssertTrue(scope.isHittable)
        scope.tap()
        XCTAssertEqual(app.staticTexts["list-selection-count"].label, "1 selected")
        XCTAssertFalse(actions.exists)
        XCTAssertFalse(app.buttons["Export selected passages"].exists)
        XCTAssertTrue(app.buttons["Remove from project"].isEnabled)
        keepScreenshot(named: "Evidence selection with removal action", from: app)
        app.buttons["Select All"].tap()
        XCTAssertEqual(app.staticTexts["list-selection-count"].label, "2 selected")
        app.buttons["Deselect All"].tap()
        XCTAssertEqual(app.staticTexts["list-selection-count"].label, "0 selected")
        app.buttons["Cancel"].tap()
        XCTAssertTrue(selectSections.isHittable)
#endif
    }

    func testProjectSectionsOpenWithBackNavigation() throws {
#if !DEBUG
        throw XCTSkip("Project overview acceptance uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture", "--native-project-overview-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        let project = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "saved-folder-", "Acceptance Project")).firstMatch
        project.tap()
        let root = element(in: app, identifier: "project-folder-root")
        XCTAssertTrue(root.waitForExistence(timeout: 10))
        let reportsCard = app.buttons["project-section-reports"]
        let expectedSummary = ["address": "100 Acceptance Court, Brooklyn, NY 11215", "tax-lot-area": "5,000 sq ft",
                               "occupancy": "R-2 — 8 permanent dwelling units (assumed)",
                               "construction-type": "Type III-B (assumed) — masonry exterior walls and wood floor joists",
                               "building-area": "9,600 gross sq ft above grade", "zoning-districts": "R7-2, R7A"]
        for (field, value) in expectedSummary {
            let item = element(in: app, identifier: "project-summary-\(field)")
            XCTAssertTrue(item.isHittable)
            XCTAssertEqual(item.value as? String, value)
        }
        XCTAssertFalse(element(in: app, identifier: "project-summary-building-height").exists)
        let cards = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "project-section-"))
        XCTAssertEqual(cards.count, 6)
        for (section, title) in [("overview", "Overview"), ("review", "Review"), ("notebook", "Notes"),
                                 ("evidence", "Evidence"), ("calculator", "Calculator"), ("reports", "Reports")] {
            XCTAssertEqual(app.buttons["project-section-\(section)"].label, title)
        }
        let projectName = app.staticTexts["project-workspace-name"]
        XCTAssertEqual(projectName.frame.minX, app.buttons["project-section-overview"].frame.minX, accuracy: 1)
        XCTAssertEqual(element(in: app, identifier: "project-summary-address").frame.minX, projectName.frame.minX, accuracy: 1)
        for (left, right) in [("overview", "review"), ("notebook", "evidence"), ("calculator", "reports")] {
            let leading = app.buttons["project-section-\(left)"]
            let trailing = app.buttons["project-section-\(right)"]
            XCTAssertTrue(leading.isHittable && trailing.isHittable, "Both cards must be visible without scrolling.")
            XCTAssertEqual(leading.frame.minY, trailing.frame.minY, accuracy: 1)
            XCTAssertEqual(leading.frame.width, trailing.frame.width, accuracy: 1)
            XCTAssertEqual(leading.frame.height, trailing.frame.height, accuracy: 1)
            assertFloatingMenuWidth(leading.frame.union(trailing.frame), in: app)
        }
        let tabBarY = app.tabBars.firstMatch.frame.minY
        XCTAssertLessThanOrEqual(reportsCard.frame.maxY, tabBarY,
                                 "The last row must clear the tab bar.")
        XCTAssertLessThanOrEqual(tabBarY - reportsCard.frame.maxY, 36,
                                 "The cards must use the available height.")
        let bottomRowY = reportsCard.frame.minY
        root.swipeUp()
        XCTAssertEqual(reportsCard.frame.minY, bottomRowY, accuracy: 1,
                       "The dashboard should fit without a scrollable area.")
        keepScreenshot(named: "Six project cards fit above the tab bar", from: app)

        let editProject = app.buttons["project-edit"]
        XCTAssertTrue(editProject.isHittable)
        XCTAssertEqual(editProject.frame.width, editProject.frame.height, accuracy: 1)
        if #available(iOS 26.0, *), UIDevice.current.userInterfaceIdiom == .phone {
            // The native back glyph is optically offset inside its glass circle.
            let back = app.buttons["project-close"]
            let cardsWidth = app.buttons["project-section-overview"].frame.union(app.buttons["project-section-review"].frame)
            let toolbarRadius = editProject.frame.width / 2
            XCTAssertEqual(back.frame.midX, cardsWidth.minX + toolbarRadius, accuracy: 2)
            XCTAssertEqual(editProject.frame.midX, cardsWidth.maxX - toolbarRadius, accuracy: 1)
        }
        editProject.tap()
        let projectEditor = app.navigationBars["Edit project"]
        XCTAssertTrue(projectEditor.waitForExistence(timeout: 5))
        projectEditor.buttons["Cancel"].tap()
        XCTAssertTrue(root.waitForExistence(timeout: 5))

        let overviewCard = app.buttons["project-section-overview"]
        overviewCard.tap()
        let overviewBar = app.navigationBars["Overview"]
        XCTAssertTrue(overviewBar.waitForExistence(timeout: 5))
        let contextTab = app.buttons["Context"]
        let factsTab = app.buttons["Zoning"]
        XCTAssertTrue(contextTab.isHittable)
        XCTAssertTrue(factsTab.isHittable)
        XCTAssertTrue(app.staticTexts["project-context-text"].isHittable)
        XCTAssertEqual(app.tabBars.buttons.count, 4)
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        let editContext = overviewBar.buttons["project-context-edit"]
        XCTAssertEqual(editContext.frame.width, editContext.frame.height, accuracy: 1)
        editContext.tap()
        let editor = app.textViews["project-context-editor"]
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        XCTAssertFalse(factsTab.isEnabled, "Save or cancel Context before switching tabs.")
        editor.typeText("Phone edit. ")
        app.buttons["project-context-save"].tap()
        let savedContext = app.staticTexts["project-context-text"]
        XCTAssertTrue(savedContext.waitForExistence(timeout: 5))
        XCTAssertTrue(savedContext.label.hasPrefix("Phone edit."))
        app.buttons["project-context-edit"].tap()
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        editor.typeText("Discard this draft. ")
        overviewBar.buttons["Cancel"].tap()
        XCTAssertTrue(savedContext.label.hasPrefix("Phone edit."))
        keepScreenshot(named: "Overview Context tab", from: app)
        factsTab.tap()
        XCTAssertTrue(app.staticTexts["Building"].waitForExistence(timeout: 5))
        XCTAssertFalse(savedContext.isHittable)
        let editZoning = overviewBar.buttons["project-zoning-edit"]
        XCTAssertEqual(editZoning.frame.width, editZoning.frame.height, accuracy: 1)
        editZoning.tap()
        let value = app.textFields["project-fact-value-occupancy"]
        reveal(value, in: app)
        XCTAssertTrue(value.waitForExistence(timeout: 5))
        XCTAssertLessThan(app.staticTexts["Occupancy"].frame.midX, value.frame.midX)
        XCTAssertFalse(contextTab.isEnabled, "Save or cancel Facts before switching tabs.")
        value.tap()
        value.typeText(" phone edit")
        XCTAssertTrue(overviewBar.buttons["Cancel"].isHittable)
        overviewBar.buttons["Save"].tap()
        editZoning.tap()
        XCTAssertTrue(value.waitForExistence(timeout: 5))
        XCTAssertTrue((value.value as? String ?? "").contains("phone edit"))
        app.buttons["main-tab-research"].tap()
        XCTAssertTrue(app.buttons["New conversation"].waitForExistence(timeout: 15))
        app.buttons["main-tab-saved"].tap()
        XCTAssertTrue(overviewBar.buttons["Cancel"].waitForExistence(timeout: 5),
                      "Returning to Project should restore Facts and its edit mode.")
        value.tap()
        value.typeText(" discard this")
        overviewBar.buttons["Cancel"].tap()
        XCTAssertTrue(app.staticTexts["Building"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "discard this")).firstMatch.exists)
        keepScreenshot(named: "Overview Zoning tab", from: app)
        app.swipeUp()
        keepScreenshot(named: "Overview Zoning scrolled below the header", from: app)
        overviewBar.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(overviewCard.waitForExistence(timeout: 5))
        overviewCard.tap()
        XCTAssertTrue(overviewBar.waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Building"].waitForExistence(timeout: 5),
                      "Reopening Overview should restore Zoning.")
        contextTab.tap()
        XCTAssertTrue(savedContext.waitForExistence(timeout: 5))
        XCTAssertTrue(savedContext.label.hasPrefix("Phone edit."))
        overviewBar.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(overviewCard.waitForExistence(timeout: 5))
        XCTAssertEqual(overviewCard.label, "Overview")
        overviewCard.tap()
        XCTAssertTrue(savedContext.waitForExistence(timeout: 5),
                      "Reopening Overview should restore Context after switching back.")
        overviewBar.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(root.waitForExistence(timeout: 5))
        for (section, title) in [("notebook", "Notes"), ("evidence", "Evidence"), ("reports", "Reports")] {
            let card = app.buttons["project-section-\(section)"]
            reveal(card, in: app)
            card.tap()
            let bar = app.navigationBars[title]
            XCTAssertTrue(bar.waitForExistence(timeout: 10))
            XCTAssertTrue(app.buttons["main-tab-reader"].isHittable)
            XCTAssertTrue(app.buttons["main-tab-research"].isHittable)
            XCTAssertTrue(app.buttons["main-tab-search"].isHittable)
            XCTAssertFalse(root.isHittable)
            keepScreenshot(named: "\(title) with project tabs", from: app)
            if section == "notebook" {
                app.buttons["main-tab-reader"].tap()
                XCTAssertTrue(app.buttons["reader-session-primary"].waitForExistence(timeout: 15))
                app.buttons["main-tab-saved"].tap()
                XCTAssertTrue(bar.waitForExistence(timeout: 5))
                app.buttons["main-tab-search"].tap()
                XCTAssertTrue(app.textFields["Search codes"].waitForExistence(timeout: 15))
                app.buttons["main-tab-saved"].tap()
                XCTAssertTrue(bar.waitForExistence(timeout: 5))
            }
            bar.buttons.element(boundBy: 0).tap()
            XCTAssertTrue(root.waitForExistence(timeout: 10))
        }
        app.buttons["main-tab-saved"].tap()
        XCTAssertTrue(element(in: app, identifier: "projects-root").waitForExistence(timeout: 10))
#endif
    }

    func testProjectQuestionsAndChecklistEditAndReturnToOverview() throws {
#if !DEBUG
        throw XCTSkip("Workflow acceptance uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture", "--native-project-overview-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "saved-folder-", "Acceptance Project")).firstMatch.tap()
        let root = element(in: app, identifier: "project-folder-root")
        XCTAssertTrue(root.waitForExistence(timeout: 10))
        let reviewCard = app.buttons["project-section-review"]
        reveal(reviewCard, in: app)
        XCTAssertEqual(reviewCard.frame.minY, app.buttons["project-section-overview"].frame.minY, accuracy: 2)
        keepScreenshot(named: "Project overview with six cards", from: app)
        reviewCard.tap()
        let review = app.navigationBars["Review"]
        XCTAssertTrue(review.waitForExistence(timeout: 5))
        let tabs = app.segmentedControls["project-review-tabs"]
        XCTAssertTrue(tabs.waitForExistence(timeout: 5))
        tabs.buttons["Questions"].tap()
        XCTAssertFalse(app.keyboards.firstMatch.exists)
        XCTAssertEqual(app.tabBars.buttons.count, 4)
        XCTAssertFalse(app.staticTexts["No questions yet."].exists)
        app.buttons["project-workflow-add"].tap()
        let question = app.textFields["project-question-text-0"]
        let questionText = question.exists ? question : app.textViews["project-question-text-0"]
        XCTAssertTrue(questionText.waitForExistence(timeout: 5))
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        app.typeText("Is the survey current?")
        let answer = app.textFields["project-question-answer-0"]
        let answerText = answer.exists ? answer : app.textViews["project-question-answer-0"]
        answerText.tap()
        answerText.typeText("Requested today.")
        app.buttons["project-workflow-save"].tap()
        XCTAssertTrue(app.staticTexts["Is the survey current?"].waitForExistence(timeout: 5))
        keepScreenshot(named: "Project questions on iPhone", from: app)
        let editWorkflow = app.buttons["project-workflow-edit"]
        XCTAssertEqual(editWorkflow.frame.width, editWorkflow.frame.height, accuracy: 1)
        editWorkflow.tap()
        questionText.tap()
        questionText.typeText(" Discard")
        XCTAssertEqual(app.buttons.matching(NSPredicate(format: "label == %@", "Cancel")).count, 1)
        XCTAssertEqual(app.buttons.matching(NSPredicate(format: "label == %@", "Save")).count, 1)
        review.buttons["Cancel"].tap()
        XCTAssertFalse(app.staticTexts["Is the survey current? Discard"].exists)
        tabs.buttons["Checklist"].tap()
        XCTAssertEqual(app.tabBars.buttons.count, 4)
        XCTAssertFalse(app.staticTexts["No records yet."].exists)
        XCTAssertTrue(app.buttons["project-workflow-add"].isHittable)
        app.buttons["project-checklist-suggested"].tap()
        let status = app.buttons["project-record-status-0"]
        XCTAssertTrue(status.waitForExistence(timeout: 5))
        status.tap()
        app.buttons["Reviewed"].tap()
        app.buttons["project-workflow-save"].tap()
        XCTAssertTrue(app.staticTexts["Reviewed"].waitForExistence(timeout: 5))
        keepScreenshot(named: "Project record checklist on iPhone", from: app)
        XCTAssertEqual(editWorkflow.frame.width, editWorkflow.frame.height, accuracy: 1)
        editWorkflow.tap()
        XCTAssertTrue(app.buttons["project-workflow-save"].waitForExistence(timeout: 5))
        let recordNoteField = app.textFields["project-record-note-0"]
        let recordNote = recordNoteField.exists ? recordNoteField : app.textViews["project-record-note-0"]
        recordNote.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        recordNote.typeText("Discard this record note.")
        review.buttons["Cancel"].tap()
        XCTAssertFalse(app.staticTexts["Discard this record note."].exists)
        XCTAssertTrue(app.staticTexts["Reviewed"].exists)
        review.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(root.waitForExistence(timeout: 5))
        XCTAssertEqual(reviewCard.label, "Review")
        let notesCard = app.buttons["project-section-notebook"]
        reveal(notesCard, in: app)
        notesCard.tap()
        let notesPage = app.navigationBars["Notes"]
        XCTAssertTrue(notesPage.waitForExistence(timeout: 10))
        notesPage.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(reviewCard.waitForExistence(timeout: 5))
        reveal(reviewCard, in: app)
        reviewCard.tap()
        XCTAssertTrue(tabs.buttons["Checklist"].isSelected)
        XCTAssertTrue(app.staticTexts["Reviewed"].exists)
        tabs.buttons["Questions"].tap()
        XCTAssertTrue(app.staticTexts["Is the survey current?"].exists)
        app.buttons["main-tab-saved"].tap()
        XCTAssertTrue(element(in: app, identifier: "projects-root").waitForExistence(timeout: 5))
#endif
    }

    func testLongContextEditorStartsAtBeginning() throws {
#if !DEBUG
        throw XCTSkip("Project overview acceptance uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture",
                               "--native-project-overview-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@",
                                        "saved-folder-", "Acceptance Project")).firstMatch.tap()
        let contextCard = app.buttons["project-section-overview"]
        XCTAssertTrue(contextCard.waitForExistence(timeout: 10))
        contextCard.tap()
        app.buttons["project-context-edit"].tap()
        let editor = app.textViews["project-context-editor"]
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        editor.typeText(String(repeating: "Long context line for scrolling.\n", count: 48))
        app.buttons["project-context-save"].tap()
        XCTAssertTrue(app.staticTexts["project-context-text"].waitForExistence(timeout: 5))
        app.swipeUp()
        keepScreenshot(named: "Overview Context scrolled below the header", from: app)

        app.buttons["project-context-edit"].tap()
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        XCTAssertGreaterThan((editor.value as? String ?? "").count, 500,
                             "The full saved Context remains available for editing")
        editor.typeText("Beginning. ")
        XCTAssertTrue((editor.value as? String ?? "").hasPrefix("Beginning. "))
        keepScreenshot(named: "Long Context starts at the beginning in edit mode", from: app)
        app.navigationBars["Overview"].buttons["Cancel"].tap()

#endif
    }

    func testCalculatorAndSavedEvidenceOpenProjectAssistant() throws {
#if !DEBUG
        throw XCTSkip("Project Assistant acceptance uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture",
            "--native-project-calculator-fixture", "--native-project-overview-fixture",
            "--native-project-evidence-toolbar-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@",
            "saved-folder-", "Acceptance Project")).firstMatch.tap()
        let calculator = app.buttons["project-section-calculator"]
        reveal(calculator, in: app)
        calculator.tap()
        let function = element(in: app, identifier: "calculator-function")
        XCTAssertTrue(function.waitForExistence(timeout: 20))
        function.tap()
        let classroom = app.buttons["Educational — Classroom area"]
        for _ in 0..<12 where !classroom.isHittable { app.swipeUp() }
        classroom.tap()
        let ask = app.buttons["calculator-ask-assistant"]
        reveal(ask, in: app)
        ask.tap()
        XCTAssertTrue(element(in: app, identifier: "research-selected-evidence").waitForExistence(timeout: 18), app.debugDescription)
        let composer = element(in: app, identifier: "research-composer")
        let draft = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (composer.value as? String ?? "").contains("Table 1004.1.3") &&
            (composer.value as? String ?? "").contains("Classroom area")
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [draft], timeout: 12), .completed, composer.debugDescription)
        XCTAssertTrue(app.staticTexts["1 code reference"].exists)
        keepScreenshot(named: "Calculator Assistant with referenced source and editable question", from: app)

        app.buttons["main-tab-saved"].tap()
        let calculatorBar = app.navigationBars["Calculator"]
        if calculatorBar.exists { calculatorBar.buttons.firstMatch.tap() }
        let evidence = app.buttons["project-section-evidence"]
        XCTAssertTrue(evidence.waitForExistence(timeout: 10))
        reveal(evidence, in: app)
        evidence.tap()
        let select = app.buttons["Select sections"]
        XCTAssertTrue(select.waitForExistence(timeout: 10))
        select.tap()
        app.buttons["Select All"].tap()
        app.buttons["Ask Assistant about selected evidence"].tap()
        XCTAssertTrue(element(in: app, identifier: "research-selected-evidence").waitForExistence(timeout: 18), app.debugDescription)
        XCTAssertTrue(app.staticTexts["2 code references"].waitForExistence(timeout: 15))
        keepScreenshot(named: "Selected Evidence opens project Assistant", from: app)
#endif
    }

    func testProjectCalculatorSavesCitedResultToNewAndExistingNotes() throws {
#if !DEBUG
        throw XCTSkip("Calculator acceptance uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture",
                               "--native-project-calculator-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@",
            "saved-folder-", "Acceptance Project")).firstMatch.tap()
        let calculator = app.buttons["project-section-calculator"]
        reveal(calculator, in: app)
        calculator.tap()
        let calculatorBar = app.navigationBars["Calculator"]
        XCTAssertTrue(calculatorBar.waitForExistence(timeout: 5))
        let form = app.scrollViews["project-calculator-form"]
        let function = element(in: app, identifier: "calculator-function")
        XCTAssertTrue(function.waitForExistence(timeout: 20), app.debugDescription)
        XCTAssertTrue(form.exists)
        XCTAssertFalse(form.webViews.firstMatch.exists)
        let newCalculation = calculatorBar.buttons["calculator-new-draft"]
        XCTAssertTrue(newCalculation.isHittable)
        XCTAssertEqual(newCalculation.frame.midY, calculatorBar.buttons.element(boundBy: 0).frame.midY, accuracy: 2)
        XCTAssertEqual(newCalculation.frame.width, newCalculation.frame.height, accuracy: 1)
        if #available(iOS 26.0, *), UIDevice.current.userInterfaceIdiom == .phone {
            XCTAssertEqual(newCalculation.frame.maxX, app.frame.maxX - 21, accuracy: 1)
        }
        newCalculation.tap()
        keepScreenshot(named: "Native Calculator at the top", from: app)
        XCTAssertTrue(function.waitForExistence(timeout: 10))
        function.tap()
        let classroom = app.buttons.matching(NSPredicate(format: "label == %@", "Educational — Classroom area")).firstMatch
        reveal(classroom, in: app)
        classroom.tap()
        let area = app.textFields["calculator-area"]
        reveal(area, in: app)
        area.tap()
        area.typeText("101")
        let seating = element(in: app, identifier: "calculator-seating")
        reveal(seating, in: app)
        seating.tap()
        app.buttons["Without fixed seating"].tap()
        let save = app.buttons["calculator-save"]
        reveal(save, in: app)
        XCTAssertTrue(save.isEnabled)
        XCTAssertEqual(app.staticTexts["calculator-result"].label, "6 people")
        save.tap()
        XCTAssertTrue(app.buttons["calculator-new-note"].waitForExistence(timeout: 10))
        app.buttons["calculator-new-note"].tap()
        let saved = app.staticTexts["calculator-saved-note"]
        XCTAssertTrue(saved.waitForExistence(timeout: 10))

        reveal(save, in: app)
        save.tap()
        let existing = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "calculator-existing-note-")).firstMatch
        XCTAssertTrue(existing.waitForExistence(timeout: 10))
        existing.tap()
        XCTAssertTrue(existing.wait(for: \.exists, toEqual: false, timeout: 10))
        XCTAssertTrue(saved.waitForExistence(timeout: 10))
        form.swipeUp()
        XCTAssertLessThanOrEqual(saved.frame.maxY, app.tabBars.firstMatch.frame.minY + 2)
        XCTAssertFalse(app.buttons["calculator-source"].exists)
        keepScreenshot(named: "Native Calculator scrolled to the result and Note", from: app)
        calculatorBar.buttons.element(boundBy: 0).tap()
        app.buttons["project-section-notebook"].tap()
        let note = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Occupant load · Educational")).firstMatch
        XCTAssertTrue(note.waitForExistence(timeout: 10))
        note.tap()
        let noteBody = app.webViews.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "6 people"))
        XCTAssertTrue(noteBody.firstMatch.waitForExistence(timeout: 10))
        XCTAssertGreaterThanOrEqual(noteBody.count, 2)
        app.swipeUp()
        keepScreenshot(named: "Note scrolled below the header", from: app)
#endif
    }

    func testSavedProjectTilesAtAccessibilitySize() throws {
        try verifySavedProjectNavigation(largeText: true)
    }

    func testProjectOverviewAtAccessibilitySize() throws {
#if !DEBUG
        throw XCTSkip("Project overview uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture",
                               "--native-project-overview-fixture", "--permitext-disable-clerk",
                               "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityM"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@",
                                        "saved-folder-", "Acceptance Project")).firstMatch.tap()
        XCTAssertTrue(element(in: app, identifier: "project-folder-root").waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["project-section-overview"].isHittable)
        keepScreenshot(named: "Project overview accessibility size top", from: app)
        for section in ["notebook", "evidence", "reports"] {
            let card = app.buttons["project-section-\(section)"]
            reveal(card, in: app)
            XCTAssertTrue(card.isHittable)
        }
        keepScreenshot(named: "Project overview accessibility size collections", from: app)
        app.buttons["project-section-reports"].tap()
        XCTAssertTrue(app.navigationBars["Reports"].waitForExistence(timeout: 10))
        app.navigationBars["Reports"].buttons.element(boundBy: 0).tap()
        XCTAssertTrue(element(in: app, identifier: "project-folder-root").waitForExistence(timeout: 10))
        app.buttons["main-tab-saved"].tap()
        XCTAssertTrue(element(in: app, identifier: "projects-root").waitForExistence(timeout: 10))
#endif
    }

    func testZoningOverviewCanHideSourcesAndOmitsEmptyFacts() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture",
                               "--native-project-overview-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@",
            "saved-folder-", "Acceptance Project")).firstMatch.tap()
        app.buttons["project-section-overview"].tap()
        app.buttons["Zoning"].tap()
        let sourceToggle = app.buttons["Source information"]
        let sourceDetails = app.staticTexts["Synthetic fixture"]
        let taxLotLabel = app.staticTexts["Tax Lot Area"]
        let taxLotValue = app.staticTexts["5,000 sq ft"]
        XCTAssertTrue(taxLotValue.waitForExistence(timeout: 5))
        XCTAssertLessThan(taxLotLabel.frame.midX, taxLotValue.frame.midX)
        XCTAssertEqual(taxLotLabel.frame.midY, taxLotValue.frame.midY, accuracy: 4)
        let readOnlyLabelEdge = taxLotLabel.frame.minX
        let readOnlyValueEdge = taxLotValue.frame.maxX
        let populatedLabels = ["Address", "Tax Lot Area", "Occupancy", "Construction Type"]
        func assertPopulatedFieldOrder() {
            let labels = populatedLabels.map { app.staticTexts[$0] }
            for label in labels { XCTAssertTrue(label.exists, label.debugDescription) }
            for (previous, next) in zip(labels, labels.dropFirst()) {
                XCTAssertLessThan(previous.frame.minY, next.frame.minY)
            }
        }
        XCTAssertTrue(app.staticTexts["100 Acceptance Court, Brooklyn, NY 11215"].exists)
        assertPopulatedFieldOrder()
        XCTAssertTrue(app.staticTexts["6000"].exists)
        XCTAssertTrue(app.staticTexts["9,600 gross sq ft above grade"].exists)
        XCTAssertTrue(app.staticTexts["46 ft to main roof"].exists)
        XCTAssertTrue(app.staticTexts["R7-2, R7A"].exists)
        XCTAssertTrue(app.staticTexts["No mapped intersection found"].exists)
        XCTAssertFalse(app.staticTexts["Sourced"].exists)
        XCTAssertFalse(app.staticTexts["Stated"].exists)
        XCTAssertFalse(app.staticTexts["Commercial Overlay(s)"].exists)
        XCTAssertFalse(app.staticTexts["Special Purpose District(s)"].exists)
        XCTAssertFalse(app.staticTexts["Borough"].exists)
        XCTAssertFalse(app.staticTexts["ZIP Code"].exists)
        keepScreenshot(named: "Zoning fact labels and values", from: app)

        let edit = app.buttons["project-zoning-edit"]
        let overviewBar = app.navigationBars["Overview"]
        edit.tap()
        let taxLotEditor = app.textFields["project-fact-value-tax-lot-area"]
        let borough = app.textFields["project-fact-value-project-fact:borough"]
        let zipCode = app.textFields["project-fact-value-project-fact:zip-code"]
        let bbl = app.textFields["project-fact-value-project-fact:bbl"]
        XCTAssertTrue(borough.waitForExistence(timeout: 5))
        XCTAssertTrue(zipCode.exists)
        XCTAssertTrue(bbl.exists)
        assertPopulatedFieldOrder()
        XCTAssertLessThan(app.staticTexts["Address"].frame.minY, bbl.frame.minY)
        XCTAssertLessThan(bbl.frame.minY, borough.frame.minY)
        XCTAssertLessThan(borough.frame.minY, zipCode.frame.minY)
        XCTAssertLessThan(zipCode.frame.minY, taxLotEditor.frame.minY)
        XCTAssertEqual(taxLotLabel.frame.minX, readOnlyLabelEdge, accuracy: 2)
        XCTAssertEqual(taxLotEditor.frame.maxX, readOnlyValueEdge, accuracy: 2)
        XCTAssertEqual(taxLotLabel.frame.midY, taxLotEditor.frame.midY, accuracy: 4)
        XCTAssertEqual(borough.value as? String, "Add value")
        XCTAssertEqual(app.staticTexts["Borough"].frame.midY, borough.frame.midY, accuracy: 4)
        let singleLineEditorHeight = taxLotEditor.frame.height
        keepScreenshot(named: "Zoning inline editor", from: app)
        borough.tap()
        borough.typeText("Manhattan")
        overviewBar.buttons["Save"].tap()
        XCTAssertTrue(app.staticTexts["Manhattan"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["ZIP Code"].exists)

        edit.tap()
        XCTAssertTrue(borough.waitForExistence(timeout: 5))
        XCTAssertEqual(borough.value as? String, "Manhattan")
        XCTAssertFalse(app.buttons["Remove Borough"].exists)
        borough.coordinate(withNormalizedOffset: CGVector(dx: 0.99, dy: 0.5)).tap()
        borough.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: "Manhattan".count))
        XCTAssertEqual(borough.value as? String, "Add value")
        XCTAssertTrue(borough.exists, "Clearing a standard field leaves its input in edit mode.")
        overviewBar.buttons["Save"].tap()
        XCTAssertFalse(app.staticTexts["Borough"].exists)

        reveal(sourceToggle, in: app)
        XCTAssertTrue(sourceToggle.isHittable)
        XCTAssertFalse(sourceDetails.exists)
        sourceToggle.tap()
        XCTAssertTrue(sourceDetails.waitForExistence(timeout: 3))
        sourceToggle.tap()
        XCTAssertTrue(waitForNonexistence(sourceDetails, timeout: 3))

        edit.tap()
        let construction = app.textFields["project-fact-value-construction-type"]
        reveal(construction, in: app)
        XCTAssertTrue(construction.isHittable)
        XCTAssertGreaterThan(construction.frame.height, singleLineEditorHeight,
                             "Long values expand in the trailing column.")
        let commercialOverlay = app.textFields["project-fact-value-commercial-overlays"]
        let specialDistrict = app.textFields["project-fact-value-special-purpose-districts"]
        reveal(commercialOverlay, in: app)
        XCTAssertTrue(commercialOverlay.isHittable)
        reveal(specialDistrict, in: app)
        XCTAssertTrue(specialDistrict.isHittable)
        let location = app.textFields["project-fact-value-location"]
        reveal(location, in: app)
        XCTAssertTrue(location.isHittable)
        XCTAssertFalse(app.buttons["Remove Location"].exists)
        location.coordinate(withNormalizedOffset: CGVector(dx: 0.99, dy: 0.5)).tap()
        location.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: "New York City".count))
        XCTAssertEqual(location.value as? String, "Add value")
        overviewBar.buttons["Save"].tap()
        XCTAssertFalse(app.staticTexts["Location"].exists)
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
        let projectRoot = app.scrollViews["project-folder-root"]
        XCTAssertTrue(projectRoot.exists)
        XCTAssertFalse(app.staticTexts["Phase 3 entitled Research acceptance"].exists,
                       "Project Context should open on its own screen.")
        XCTAssertFalse(app.staticTexts["No Notes yet."].exists,
                       "Notebook previews should not remain inline in the Project.")
        XCTAssertFalse(app.buttons["Select"].exists)
        XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label ==[c] %@", "Project Hub")).firstMatch.exists)
        XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Structured Facts (")).firstMatch.exists)
        for (identifier, title) in [
            ("project-section-overview", "Overview"),
            ("project-section-notebook", "Notes"),
            ("project-section-research-history", "Research History")
        ] {
            let section = element(in: app, identifier: identifier)
            reveal(section, in: app)
            XCTAssertTrue(section.isHittable, "\(title) must be reachable in the Project.")
            section.tap()
            XCTAssertTrue(app.navigationBars[title].waitForExistence(timeout: 10),
                          "\(title) should push a titled destination onto the navigation stack.")
            XCTAssertFalse(projectRoot.isHittable, "The Project page must be behind the destination.")
            if title == "Overview" {
                let context = app.staticTexts["project-context-text"]
                XCTAssertTrue(context.exists)
                XCTAssertEqual(context.label, "Phase 3 entitled Research acceptance")
                app.buttons["project-context-edit"].tap()
                let editor = app.textViews["project-context-editor"]
                XCTAssertTrue(editor.waitForExistence(timeout: 5))
                editor.typeText("Updated on iPhone. ")
                app.buttons["project-context-save"].tap()
                XCTAssertTrue(context.waitForExistence(timeout: 5))
                let savedContext = context.label
                XCTAssertTrue(savedContext.hasPrefix("Updated on iPhone."),
                              "Editing must begin at the start of the Context.")
                app.buttons["project-context-edit"].tap()
                XCTAssertTrue(editor.waitForExistence(timeout: 5))
                editor.typeText("Discard this draft. ")
                app.navigationBars[title].buttons["Cancel"].tap()
                XCTAssertEqual(context.label, savedContext)
            }
            keepScreenshot(named: "Project section: \(title)", from: app)
            app.navigationBars[title].buttons.element(boundBy: 0).tap()
            XCTAssertTrue(projectRoot.waitForExistence(timeout: 10))
        }
        let contextLink = element(in: app, identifier: "project-section-overview")
        reveal(contextLink, in: app)
        contextLink.tap()
        let reopenedContext = app.staticTexts["project-context-text"]
        XCTAssertTrue(reopenedContext.waitForExistence(timeout: 5))
        XCTAssertTrue(reopenedContext.label.contains("Updated on iPhone."),
                      "Saved context must survive leaving and reopening the screen.")
        app.navigationBars["Overview"].buttons.element(boundBy: 0).tap()
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

    func testHistoricalSearchPreviews() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons["Search"].tap()
        let field = app.textFields["Search codes"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        if app.buttons["Clear search"].exists { app.buttons["Clear search"].tap() }
        field.tap()
        field.typeText("fire")
        let group = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS[c] %@", "search-group-", "Building Code · 1968")).firstMatch
        XCTAssertTrue(group.waitForExistence(timeout: 45))
        let modern = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label == %@", "search-group-", "Building Code · 2022")).firstMatch
        let previous = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label == %@", "search-group-", "Building Code · 2014")).firstMatch
        XCTAssertTrue(modern.exists)
        XCTAssertTrue(previous.exists)
        XCTAssertLessThan(modern.frame.minX, previous.frame.minX)
        XCTAssertLessThan(previous.frame.minX, group.frame.minX)
        XCTAssertTrue(app.staticTexts["search-family-Building Code"].exists)
        keepScreenshot(named: "Code families with newest editions first", from: app)
        group.tap()
        let hit = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "search-result-", "27-293")).firstMatch
        XCTAssertTrue(hit.waitForExistence(timeout: 10))
        let preview = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            hit.label.contains("hereby established as being inside")
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [preview], timeout: 15), .completed, hit.label)
        XCTAssertFalse(hit.label.contains("through 2026"))
        keepScreenshot(named: "Compact historical search results", from: app)
        modern.tap()
        XCTAssertTrue((group.value as? String)?.hasPrefix("Collapsed") == true)
        XCTAssertTrue((modern.value as? String)?.hasPrefix("Expanded") == true)
        group.tap()
        XCTAssertTrue((modern.value as? String)?.hasPrefix("Collapsed") == true)
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.48))
            .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.18)))
        let keyboardHidden = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            !app.keyboards.firstMatch.exists
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [keyboardHidden], timeout: 5), .completed)
        XCTAssertTrue(group.isHittable)
        keepScreenshot(named: "Pinned code header after scrolling", from: app)
        group.tap()
        XCTAssertTrue((group.value as? String)?.hasPrefix("Collapsed") == true)
    }

    func testExactFireSubsectionOpensUnderLogicalChapter() throws {
#if !DEBUG
        throw XCTSkip("Search acceptance uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@",
            "saved-folder-", "Acceptance Project")).firstMatch.tap()
        let searchTab = app.buttons["main-tab-search"]
        XCTAssertTrue(searchTab.waitForExistence(timeout: 10))
        searchTab.tap()
        let search = app.textFields["Search codes"]
        XCTAssertTrue(search.waitForExistence(timeout: 15))
        search.tap()
        search.typeText("FC 403.1\n")
        let result = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@",
            "search-result-", "403.1 General.")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 35), app.debugDescription)
        XCTAssertTrue(result.label.contains("Chapter 4"))
        result.tap()
        let passage = app.staticTexts["passage-fire-subsection"]
        XCTAssertTrue(passage.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertEqual(passage.label, "403.1 General.")
        XCTAssertTrue(app.staticTexts["Chapter 4"].exists)
        XCTAssertTrue(app.buttons["View full section"].exists)
        keepScreenshot(named: "Fire Code exact subsection in Chapter 4", from: app)
#endif
    }

    func testTopicalSearchShowsZoningFirstAndReturnsFromReader() throws {
#if !DEBUG
        throw XCTSkip("Requires the isolated Debug account fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons["Search"].tap()
        let field = app.textFields["Search codes"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        let clear = app.buttons["Clear search"]
        if clear.exists { clear.tap() }
        let query = "distance windows lot lines"
        field.tap()
        field.typeText(query + "\n")

        let topBook = app.staticTexts.matching(NSPredicate(format: "identifier BEGINSWITH %@", "search-family-")).firstMatch
        let topResult = app.buttons.matching(NSPredicate(format:
            "identifier BEGINSWITH %@ AND label CONTAINS %@", "search-result-", "23-372")).firstMatch
        XCTAssertTrue(topResult.waitForExistence(timeout: 45), app.debugDescription)
        XCTAssertTrue(topBook.label.localizedCaseInsensitiveContains("Zoning Resolution"))
        let searchBar = element(in: app, identifier: "bottom-search-bar")
        let edition = app.buttons.matching(NSPredicate(format:
            "identifier BEGINSWITH %@ AND label BEGINSWITH %@", "search-group-", "Zoning Resolution")).firstMatch
        XCTAssertTrue(searchBar.exists)
        XCTAssertTrue(edition.exists)
        XCTAssertEqual(topBook.frame.minX, searchBar.frame.minX, accuracy: 1)
        for row in [edition, topResult] {
            XCTAssertEqual(row.frame.minX, searchBar.frame.minX, accuracy: 1)
            XCTAssertEqual(row.frame.maxX, searchBar.frame.maxX, accuracy: 1)
        }
        keepScreenshot(named: "Search results aligned to the search bar edges", from: app)
        topResult.tap()
        let close = app.buttons["Close passage"]
        XCTAssertTrue(close.waitForExistence(timeout: 20))
        close.tap()
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        XCTAssertEqual(field.value as? String, query)
#endif
    }

    func testExact2022SearchResultOpensPassageAndReturnsToQuery() throws {
#if !DEBUG
        throw XCTSkip("Requires the isolated Debug account fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons["Search"].tap()
        let field = app.textFields["Search codes"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        let clear = app.buttons["Clear search"]
        if clear.exists { clear.tap() }
        let section = "403.2.3.3"
        field.tap()
        field.typeText(section + "\n")

        let building2022 = app.buttons.matching(NSPredicate(format:
            "identifier BEGINSWITH %@ AND label CONTAINS[c] %@ AND label CONTAINS %@",
            "search-group-", "Building Code", "2022")).firstMatch
        XCTAssertTrue(building2022.waitForExistence(timeout: 45))
        if (building2022.value as? String)?.hasPrefix("Expanded") != true { building2022.tap() }

        // A different result can mention this section in its excerpt. Use the
        // original 2022 source identity for the enacted section itself.
        let result = app.buttons["search-result-2022 CONSTRUCTION CODES|261"]
        let actionable = NSPredicate { _, _ in result.exists && result.isHittable }
        guard XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: actionable, object: nil)], timeout: 15) == .completed else {
            XCTFail("The exact 2022 Building Code result was not visible. \(app.debugDescription)")
            return
        }
        XCTAssertTrue(result.label.localizedCaseInsensitiveContains("Concrete and masonry walls"))
        result.tap()

        let close = app.buttons["Close passage"]
        XCTAssertTrue(close.waitForExistence(timeout: 20))
        XCTAssertTrue(app.navigationBars[section].waitForExistence(timeout: 15))
        let edition = app.staticTexts.matching(NSPredicate(format:
            "label CONTAINS[c] %@ AND label CONTAINS %@", "Building Code", "2022")).firstMatch
        XCTAssertTrue(edition.waitForExistence(timeout: 10))
        close.tap()
        let returned = NSPredicate { _, _ in
            !close.exists && field.exists && field.isHittable && field.value as? String == section
        }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: returned, object: nil)], timeout: 10), .completed)
#endif
    }

    /// Functional device acceptance only: XCTest interaction latency is not an app benchmark.
    func testConcreteSearchLazyRowsAndPassageReturn() throws {
#if !DEBUG
        throw XCTSkip("Requires the isolated Debug fixture; never launch against a real account.")
#else
        let app = XCUIApplication()
        // The fixture injects a temporary SQLite store, named defaults, local backend,
        // NoOp sync, and a synthetic account with loadsPersistedAccount = false.
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons["Search"].tap()
        let field = app.textFields["Search codes"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        if app.buttons["Clear search"].exists { app.buttons["Clear search"].tap() }
        field.tap()
        field.typeText("concrete\n")
        let scroll = app.scrollViews["search-results-scroll"]
        func group(_ year: String) -> XCUIElement {
            app.buttons.matching(NSPredicate(format:
                "identifier BEGINSWITH %@ AND label CONTAINS[c] %@ AND label CONTAINS %@",
                "search-group-", "Building Code", year)).firstMatch
        }
        func passage() -> XCUIElement {
            app.buttons.matching(NSPredicate(format:
                "identifier BEGINSWITH %@ AND label CONTAINS %@",
                "search-result-", "403.2.3.3")).firstMatch
        }
        func reveal(_ item: XCUIElement, upwards: Bool) {
            for _ in 0..<12 {
                if item.exists && item.isHittable { return }
                if upwards { scroll.swipeUp() } else { scroll.swipeDown() }
            }
            XCTAssertTrue(item.isHittable, "Could not reveal \(item.identifier)")
        }
        func assertPassage(year: String) {
            XCTAssertTrue(app.buttons["Close passage"].waitForExistence(timeout: 20))
            let body = app.staticTexts.matching(NSPredicate(format:
                "label CONTAINS %@", "Concrete or masonry walls shall be deemed to satisfy")).firstMatch
            XCTAssertTrue(body.waitForExistence(timeout: 20), "Full enacted passage must load.")
            XCTAssertFalse(app.staticTexts["Loading Section"].exists)
            XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:
                "label CONTAINS[c] %@ AND label CONTAINS %@", "Building Code", year)).firstMatch.exists)
            for reference in ["403.2.3.1", "403.2.3.2"] {
                XCTAssertTrue(app.buttons.matching(NSPredicate(format:
                    "label CONTAINS %@", reference)).firstMatch.waitForExistence(timeout: 10),
                    "Missing navigable reference \(reference)")
            }
            keepScreenshot(named: "Concrete passage \(year)", from: app)
        }
        let modern = group("2022")
        XCTAssertTrue(modern.waitForExistence(timeout: 60))
        modern.tap()
        XCTAssertTrue((modern.value as? String)?.hasPrefix("Expanded") == true)
        let target = passage()
        reveal(target, upwards: true)
        // Move away from the initial group position before testing modal return.
        scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.65))
            .press(forDuration: 0.05, thenDragTo: scroll.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)))
        reveal(target, upwards: false)
        let resultID = target.identifier
        let resultY = target.frame.minY
        target.tap()
        assertPassage(year: "2022")
        for opening in 0..<2 {
            app.buttons["Close passage"].tap()
            let restored = app.buttons[resultID]
            XCTAssertTrue(restored.waitForExistence(timeout: 10))
            XCTAssertTrue(restored.isHittable)
            XCTAssertEqual(restored.frame.minY, resultY, accuracy: 3,
                           "Closing the passage must preserve the search scroll position.")
            if opening == 0 {
                restored.tap()
                assertPassage(year: "2022")
            }
        }
        keepScreenshot(named: "Concrete search restored scroll position", from: app)
        reveal(modern, upwards: false)
        modern.tap()
        XCTAssertTrue((modern.value as? String)?.hasPrefix("Collapsed") == true)
        let previous = group("2014")
        reveal(previous, upwards: true)
        previous.tap()
        XCTAssertTrue((previous.value as? String)?.hasPrefix("Expanded") == true)
        let historicalTarget = passage()
        reveal(historicalTarget, upwards: true)
        XCTAssertNotEqual(historicalTarget.identifier, resultID, "Edition result identities must remain distinct.")
        historicalTarget.tap()
        assertPassage(year: "2014")
        app.buttons["Close passage"].tap()
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
        let expansionToggle = app.buttons["search-expansion-toggle"]
        XCTAssertTrue(expansionToggle.isHittable)
        XCTAssertEqual(expansionToggle.label, "Expand first code group")
        expansionToggle.tap()
        XCTAssertTrue(results.firstMatch.waitForExistence(timeout: 10))
        XCTAssertEqual(expansionToggle.label, "Collapse code group")
        expansionToggle.tap()
        XCTAssertEqual(results.count, 0)
        XCTAssertEqual(expansionToggle.label, "Expand first code group")
        keepScreenshot(named: "Collapsed results across 2022 and 2014 codes", from: app)
        modern.tap()
        XCTAssertTrue(results.firstMatch.waitForExistence(timeout: 10))
        keepScreenshot(named: "Expanded 2022 Building Code results", from: app)
        XCTAssertTrue((modern.value as? String)?.hasPrefix("Expanded") == true, "Edition value: \(String(describing: modern.value)); \(app.debugDescription)")
        let selectedResult = results.firstMatch
        let selectedSectionID = selectedResult.identifier.split(separator: "|").last.map(String.init)
        let selectedResultY = selectedResult.frame.minY
        selectedResult.tap()
        let closePassage = app.buttons["Close passage"]
        XCTAssertTrue(closePassage.waitForExistence(timeout: 15))
        XCTAssertFalse(app.staticTexts["Loading Section"].exists)
        let savePassage = app.buttons["Save passage"]
        if savePassage.exists {
            savePassage.tap()
            let toast = element(in: app, identifier: "passage-saved-toast")
            XCTAssertTrue(toast.waitForExistence(timeout: 2))
            XCTAssertFalse(app.alerts.firstMatch.exists)
            keepScreenshot(named: "Nonblocking passage saved toast", from: app)
            let hidden = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: toast)
            XCTAssertEqual(XCTWaiter.wait(for: [hidden], timeout: 4), .completed)
        }
        XCTAssertTrue(app.buttons["Remove from Saved"].waitForExistence(timeout: 10))
        closePassage.tap()
        XCTAssertTrue(selectedResult.waitForExistence(timeout: 10))
        XCTAssertEqual(selectedResult.frame.minY, selectedResultY, accuracy: 2)
        let collapseAll = app.buttons["search-expansion-toggle"]
        XCTAssertTrue(collapseAll.isHittable)
        let controlY = collapseAll.frame.minY
        let searchScroll = app.scrollViews["search-results-scroll"]
        searchScroll.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.65))
            .press(forDuration: 0.05, thenDragTo: searchScroll.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.25)))
        XCTAssertEqual(collapseAll.frame.minY, controlY, accuracy: 2)
        keepScreenshot(named: "Pinned Search collapse glass circle", from: app)
        collapseAll.tap()
        XCTAssertEqual(results.count, 0)
        app.buttons["Close search"].tap()
        XCTAssertTrue(app.buttons["main-tab-saved"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["main-tab-saved"].isSelected)
        if let selectedSectionID {
            let allSaved = element(in: app, identifier: "all-saved-link")
            reveal(allSaved, in: app)
            allSaved.tap()
            XCTAssertTrue(
                element(in: app, identifier: "projects-bookmark-\(selectedSectionID)").waitForExistence(timeout: 10),
                "A passage saved from Search must appear in All saved."
            )
            app.navigationBars.buttons.element(boundBy: 0).tap()
        }
        app.buttons["main-tab-reader-1"].tap()
        app.buttons["Search"].tap()
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        XCTAssertEqual(field.value as? String, "concrete")
        app.buttons["Clear search"].tap()
        let parking = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "1006.4")).firstMatch
        XCTAssertTrue(parking.waitForExistence(timeout: 10))
        parking.tap()
        XCTAssertTrue(app.buttons["Close passage"].waitForExistence(timeout: 15))
        XCTAssertFalse(app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Open in Reader")).firstMatch.exists)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Chapter 10")).firstMatch.waitForExistence(timeout: 10))
        keepScreenshot(named: "Search passage section context", from: app)
        app.buttons["Close passage"].tap()
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        XCTAssertTrue(parking.exists)
        field.tap()
        field.typeText("metal sign")
        XCTAssertTrue(modern.waitForExistence(timeout: 30))
        modern.tap()
        let numberedItem = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "search-result-", "1.1.3")).firstMatch
        XCTAssertTrue(numberedItem.waitForExistence(timeout: 15))
        numberedItem.tap()
        XCTAssertTrue(closePassage.waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "905.3.1")).firstMatch.waitForExistence(timeout: 10))
        keepScreenshot(named: "Numbered item with parent subsection context", from: app)
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
        for label in ["First reader", "Second reader", "Search", "Assistant"] {
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
        XCTAssertTrue(app.staticTexts["reader-chapter-title"].waitForExistence(timeout: 45))
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
            for label in ["Saved", "First reader", "Second reader", "Assistant"] {
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
        XCTAssertTrue(app.buttons["native-notebook-retry"].waitForExistence(timeout: 15))
        XCTAssertFalse(title.exists)
        XCTAssertTrue(app.buttons["native-notebook-back"].exists)
        keepScreenshot(named: "Fresh authorization revocation hides offline draft editor", from: app)
    }

    func testNativeNotebookColdOfflineEditorKeepsDraftUntilFreshAccessReturns() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-cold-offline-fixture"]
        app.launchArguments.append("--native-notebook-save-diagnostics")
        app.launch()
        let title = app.textFields["Note title"]
        XCTAssertTrue(title.waitForExistence(timeout: 30))
        XCTAssertTrue(title.isEnabled)
        XCTAssertFalse(app.buttons["Note actions"].exists, "A cold offline draft cannot expose server deletion before fresh write access.")
        let insertImage = app.buttons["Insert image"]
        XCTAssertTrue(insertImage.waitForExistence(timeout: 10))
        XCTAssertFalse(insertImage.isEnabled, "Image upload requires fresh server authorization.")
        title.tap()
        title.typeText(" cold offline draft")
        let editedTitle = title.value as? String
        XCTAssertTrue(waitForValue("saved", on: element(in: app, identifier: "native-notebook-save-status"), timeout: 15))
        XCTAssertEqual(title.value as? String, editedTitle)
        XCTAssertFalse(app.buttons["Retry save"].exists)
        XCTAssertFalse(app.buttons["Save"].exists)
        XCTAssertTrue(insertImage.isEnabled, "Fresh editor authorization must restore image upload.")
        keepScreenshot(named: "Cold offline draft freshly authorized and synced", from: app)
    }

    func testNativeNotebookLinkedNoteReturnsToEditingCaret() {
        verifyNativeLinkedNoteCaret(largeText: false)
    }

    func testNativeLargeTextLinkedNoteReturnsToEditingCaret() {
        verifyNativeLinkedNoteCaret(largeText: true)
    }

    private func nativeNotebookBody(in app: XCUIApplication) -> XCUIElement {
        app.webViews.textViews.matching(NSPredicate(format: "label == %@", "Note body")).firstMatch
    }

    private func nativeNotebookBodyValue(_ body: XCUIElement) -> String? {
        // WebKit exposes nonbreaking spaces for typed spaces beside inline
        // references. Preserve paragraph boundaries while normalizing that AX
        // representation for an exact insertion/caret assertion.
        (body.value as? String)?.replacingOccurrences(of: "\u{00a0}", with: " ")
    }

    private func verifyNativeLinkedNoteCaret(largeText: Bool) {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-reference-fixture"]
        if largeText { app.launchArguments += ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityM"] }
        app.launchArguments.append("--native-notebook-save-diagnostics")
        app.launch()
        func captureInputTrace() {
            let diagnostics = app.descendants(matching: .any).matching(identifier: "native-notebook-input-diagnostics").firstMatch
            if diagnostics.exists {
                let trace = diagnostics.value as? String ?? "missing"
                print("NATIVE NOTE INPUT TRACE \(trace)")
                let attachment = XCTAttachment(string: trace)
                attachment.name = "Synthetic native note input trace"
                attachment.lifetime = .keepAlways
                add(attachment)
            }
        }
        let editor = nativeNotebookBody(in: app)
        XCTAssertTrue(editor.waitForExistence(timeout: 30), "The locally bundled continuous editor must load.\n\(app.debugDescription)")
        XCTAssertEqual(app.webViews.textViews.matching(NSPredicate(format: "label == %@", "Note body")).count, 1,
                       "All note paragraphs and references must share one editable surface.")
        guard let original = nativeNotebookBodyValue(editor) else {
            XCTFail("Note body must expose its text value.\n\(app.debugDescription)")
            return
        }
        XCTAssertTrue(original.contains("Original editing context stays here."))
        XCTAssertTrue(original.contains("Text before the reference."))
        XCTAssertTrue(original.contains("Text after the reference."))
        // Tap the first visible paragraph, not the source chip farther down.
        editor.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.04)).tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        // Exercise normal continuous keyboard input without diagnostic delays.
        app.typeText(" BEFORE")
        let changed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            self.nativeNotebookBodyValue(editor)?.contains(" BEFORE") == true
        }, object: nil)
        let changedResult = XCTWaiter.wait(for: [changed], timeout: 5)
        captureInputTrace()
        XCTAssertEqual(changedResult, .completed, app.debugDescription)
        guard let editedValue = nativeNotebookBodyValue(editor) else { XCTFail("Missing edited note value"); return }
        XCTAssertEqual(editedValue.replacingOccurrences(of: " BEFORE", with: ""), original)
        let immediatelyEdited = editedValue.replacingOccurrences(of: " BEFORE", with: " BEFORE LAST KEY")
        let expectedReturn = editedValue.replacingOccurrences(of: " BEFORE", with: " BEFORE LAST KEY AFTER")
        keepScreenshot(named: "Continuous source Note initial caret typing", from: app)
        let reference = app.webViews.buttons["Open Linked sample note"]
        XCTAssertTrue(reference.exists, app.debugDescription)
        reveal(reference, in: app)
        XCTAssertTrue(reference.isHittable)
        // Deliberately do not wait for autosave: pushing a source must retain the
        // final keystroke even before the autosave debounce completes.
        app.typeText(" LAST KEY")
        reference.tap()
        XCTAssertTrue(app.staticTexts["This is the linked note, shown read-only."].waitForExistence(timeout: 10), app.debugDescription)
        keepScreenshot(named: "Linked Note read-only screen during continuous editing", from: app)
        XCTAssertFalse(app.sheets.firstMatch.exists)
        let back = app.navigationBars.buttons.element(boundBy: 0)
        XCTAssertTrue(back.isHittable, "Linked Note must expose Back")
        back.tap()
        XCTAssertTrue(reference.waitForExistence(timeout: 10))
        XCTAssertTrue(editor.waitForExistence(timeout: 10))
        if nativeNotebookBodyValue(editor) != immediatelyEdited { captureInputTrace() }
        XCTAssertEqual(nativeNotebookBodyValue(editor), immediatelyEdited, "Pushing a reference must retain the last keystroke.")
        keepScreenshot(named: "Original continuous Note keyboard and caret after Back", from: app)
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5), "Keyboard must return without tapping the source editor")
        XCTAssertTrue(app.buttons["Text formatting"].isHittable, "Aa formatting must remain reachable above the keyboard after Back.")
        app.typeText(" AFTER")
        let resumed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            self.nativeNotebookBodyValue(editor) == expectedReturn
        }, object: nil)
        let resumedResult = XCTWaiter.wait(for: [resumed], timeout: 5)
        captureInputTrace()
        XCTAssertEqual(resumedResult, .completed,
                       "Typing after Back must continue at the exact source caret; got \(nativeNotebookBodyValue(editor) ?? "missing").")
        XCTAssertEqual(app.textFields["Note title"].value as? String, "Original reference note")
        XCTAssertTrue(waitForValue("saved", on: element(in: app, identifier: "native-notebook-save-status"), timeout: 10))
        keepScreenshot(named: "Linked Note returns to exact continuous editing caret and syncs", from: app)
    }

    func testNativeNotebookContinuousPageSupportsHeadingAndReturn() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-reference-fixture"]
        app.launchArguments.append("--native-notebook-save-diagnostics")
        app.launch()
        let body = nativeNotebookBody(in: app)
        XCTAssertTrue(body.waitForExistence(timeout: 30), app.debugDescription)
        body.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.04)).tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        app.typeText("Continuous heading")
        let format = app.buttons["Text formatting"]
        XCTAssertTrue(format.isHittable)
        format.tap()
        let heading = app.buttons["Heading 2"]
        XCTAssertTrue(heading.waitForExistence(timeout: 5))
        heading.tap()
        XCTAssertTrue(waitForValue("heading", on: format), "Aa must apply a heading to the active paragraph.")
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        app.typeText("\n")
        format.tap()
        app.buttons["Body"].tap()
        XCTAssertTrue(waitForValue("paragraph", on: format), "Body must restore ordinary paragraph formatting.")
        app.typeText("Second continuous paragraph")
        let completeParagraph = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            guard let value = self.nativeNotebookBodyValue(body) else { return false }
            return value.contains("Continuous heading\nSecond continuous paragraph") || value.contains("Continuous heading\n\nSecond continuous paragraph")
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [completeParagraph], timeout: 5), .completed,
                       "Return must continue in the same document and retain every typed character: \(nativeNotebookBodyValue(body) ?? "missing")")
        XCTAssertEqual(app.webViews.textViews.matching(NSPredicate(format: "label == %@", "Note body")).count, 1)
        XCTAssertFalse(app.staticTexts["Open questions"].exists)
        XCTAssertFalse(app.buttons["Add question"].exists)
        XCTAssertFalse(app.textFields["Question"].exists)
        XCTAssertFalse(app.switches["Open questions only"].exists)
        XCTAssertFalse(app.buttons["Add text"].exists)
        XCTAssertFalse(app.buttons["Remove block"].exists)
        XCTAssertTrue(waitForValue("saved", on: element(in: app, identifier: "native-notebook-save-status"), timeout: 10))
        keepScreenshot(named: "Single continuous native page with heading and paragraph", from: app)
    }

    func testNativeNotebookLayoutFitsInsetWidth() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-reference-fixture", "--native-notebook-layout-diagnostics"]
        app.launch()
        let body = nativeNotebookBody(in: app)
        XCTAssertTrue(body.waitForExistence(timeout: 30))
        let diagnostics = app.staticTexts["native-notebook-layout-diagnostics"]
        let measured = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (diagnostics.value as? String ?? "").contains("viewport")
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [measured], timeout: 5), .completed)
        print("NATIVE NOTE LAYOUT: \(diagnostics.value as? String ?? "missing")")
        body.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.04)).tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        app.typeText("Width check ")
        let typed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            self.nativeNotebookBodyValue(body)?.contains("Width check") == true
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [typed], timeout: 5), .completed)
        print("NATIVE NOTE FOCUSED LAYOUT: \(diagnostics.value as? String ?? "missing")")
        let json = (diagnostics.value as? String ?? "").data(using: .utf8)!
        let metrics = (try? JSONSerialization.jsonObject(with: json)) as? [String: Any]
        XCTAssertEqual(metrics?["viewportScale"] as? Double ?? 0, 1, accuracy: 0.01,
                       "Typing must not trigger iOS input auto-zoom and clip the page.")
        keepScreenshot(named: "Native Note inset width diagnostics", from: app)
        XCTAssertLessThanOrEqual(body.frame.maxX, app.frame.maxX - 17, "Body must fit the inset writing canvas: \(diagnostics.value as? String ?? "missing")")
    }

    func testNativeNotebookCustomTableAndRightColumnButton() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-reference-fixture",
                               "--native-notebook-layout-diagnostics", "--native-notebook-save-diagnostics"]
        app.launch()
        let body = nativeNotebookBody(in: app)
        XCTAssertTrue(body.waitForExistence(timeout: 30))
        body.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.04)).tap()
        let tableTools = app.buttons["Table"]
        XCTAssertTrue(tableTools.isHittable)
        tableTools.tap()
        app.buttons["Custom size…"].tap()
        XCTAssertTrue(app.navigationBars["Table Size"].waitForExistence(timeout: 5))
        app.buttons["Insert Table"].tap()
        let layout = app.staticTexts["native-notebook-layout-diagnostics"]
        func assertTable(columns: Int) {
            let hasSize = NSPredicate { _, _ in
                let json = Data(((layout.value as? String) ?? "").utf8)
                let metrics = (try? JSONSerialization.jsonObject(with: json)) as? [String: Any]
                return (metrics?["tables"] as? [[String: Int]])?.contains(["rows": 5, "columns": columns]) == true
            }
            XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: hasSize, object: nil)], timeout: 8), .completed)
        }
        assertTable(columns: 5)
        let addColumn = app.webViews.buttons["Add column at end"]
        XCTAssertTrue(addColumn.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertTrue(addColumn.isHittable)
        XCTAssertLessThanOrEqual(addColumn.frame.maxX, app.frame.maxX - 16)
        keepScreenshot(named: "Custom Note table with visible right-side add button", from: app)
        let secondRow = app.coordinate(withNormalizedOffset: .zero).withOffset(
            CGVector(dx: body.frame.minX + 18, dy: addColumn.frame.midY + 33))
        addColumn.tap()
        assertTable(columns: 6)
        secondRow.tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        app.typeText("Table cell draft survives autosave")
        XCTAssertTrue(waitForValue("saved", on: element(in: app, identifier: "native-notebook-save-status"), timeout: 12))
        XCTAssertTrue(nativeNotebookBodyValue(body)?.contains("Table cell draft survives autosave") == true)
    }

    func testNativeNotebookResizesRowsAndColumnsByTouch() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk",
                               "--native-notebook-reference-fixture", "--native-notebook-save-diagnostics",
                               "--native-notebook-layout-diagnostics"]
        app.launch()
        let body = nativeNotebookBody(in: app)
        XCTAssertTrue(body.waitForExistence(timeout: 30))
        body.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.04)).tap()
        app.buttons["Table"].tap()
        app.buttons["Insert 2 × 2 table"].tap()

        let column = app.webViews.buttons["Resize column"]
        let row = app.webViews.buttons["Resize row"]
        XCTAssertTrue(column.waitForExistence(timeout: 8))
        XCTAssertTrue(row.waitForExistence(timeout: 8))
        func drag(_ handle: XCUIElement, dx: Double = 0, dy: Double = 0) {
            let start = handle.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: dx, dy: dy)),
                        withVelocity: .slow, thenHoldForDuration: 0)
        }
        let layout = app.staticTexts["native-notebook-layout-diagnostics"]
        func cellSize(_ axis: String) -> Double {
            let data = Data(((layout.value as? String) ?? "").utf8)
            let metrics = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            return (metrics?["firstTableCell"] as? [String: Double])?[axis] ?? 0
        }
        let startWidth = cellSize("width")
        XCTAssertGreaterThan(startWidth, 0)
        drag(column, dx: 45)
        let wider = cellSize("width")
        XCTAssertGreaterThan(wider, startWidth + 25)
        drag(column, dx: -25)
        XCTAssertLessThan(cellSize("width"), wider - 12)

        let startHeight = cellSize("height")
        drag(row, dy: 60)
        let taller = cellSize("height")
        XCTAssertGreaterThan(taller, startHeight + 20)
        drag(row, dy: -30)
        XCTAssertLessThan(cellSize("height"), taller - 12)
        XCTAssertTrue(waitForValue("saved", on: element(in: app, identifier: "native-notebook-save-status"), timeout: 12))
    }

    func testNativeNotebookListsLinksAndUndoRemainInOneDocument() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-reference-fixture"]
        app.launchArguments.append("--native-notebook-save-diagnostics")
        app.launch()
        let body = nativeNotebookBody(in: app)
        XCTAssertTrue(body.waitForExistence(timeout: 30), app.debugDescription)
        body.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.04)).tap()
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
        app.typeText("Tools check ")
        XCTAssertFalse(app.navigationBars["Note"].buttons["Done"].exists)
        let toolCenters = ["Text formatting", "Lists", "Insert image", "Insert", "Table", "Undo", "Redo"].map {
            app.buttons[$0].frame.midX
        }
        let toolSpacing = toolCenters[1] - toolCenters[0]
        XCTAssertGreaterThan(toolSpacing, 32)
        for (left, right) in zip(toolCenters, toolCenters.dropFirst()) {
            XCTAssertEqual(right - left, toolSpacing, accuracy: 1)
        }
        keepScreenshot(named: "Evenly spaced Note tools in a single glass pill", from: app)
        app.buttons["Lists"].tap()
        app.buttons["Bulleted list"].tap()
        XCTAssertTrue(waitForValue("bulletListItem", on: app.buttons["Text formatting"]))
        app.buttons["Insert"].tap()
        app.buttons["Web link"].tap()
        let label = app.textFields["native-notebook-link-label"]
        XCTAssertTrue(label.waitForExistence(timeout: 5))
        label.tap()
        label.typeText("Reference link")
        let address = app.textFields["native-notebook-link-url"]
        address.tap()
        address.typeText("example.com")
        app.buttons["native-notebook-confirm-link"].tap()
        let inserted = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            self.nativeNotebookBodyValue(body)?.contains("Reference link") == true
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [inserted], timeout: 5), .completed, app.debugDescription)
        let withLink = nativeNotebookBodyValue(body)
        XCTAssertTrue(withLink?.contains("Tools check") == true)
        app.buttons["Undo"].tap()
        let undone = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            let value = self.nativeNotebookBodyValue(body) ?? ""
            return !value.contains("Reference link") && value.contains("Tools check")
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [undone], timeout: 5), .completed, app.debugDescription)
        app.buttons["Redo"].tap()
        let restored = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            self.nativeNotebookBodyValue(body) == withLink
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [restored], timeout: 5), .completed, app.debugDescription)
        XCTAssertTrue(waitForValue("saved", on: element(in: app, identifier: "native-notebook-save-status"), timeout: 10))
        keepScreenshot(named: "Native continuous list and link with undo redo", from: app)
    }

    func testNativeNotebookDraftRefreshPreservesTypingAndAutosaves() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-reference-fixture", "--native-notebook-delayed-refresh-fixture"]
        app.launchArguments.append("--native-notebook-refresh-unsaved-draft")
        app.launchArguments.append("--native-notebook-save-diagnostics")
        app.launch()
        let title = app.textFields["Note title"]
        let diagnostics = app.staticTexts["native-notebook-refresh-diagnostics"]
        XCTAssertTrue(title.waitForExistence(timeout: 30))
        XCTAssertTrue(diagnostics.waitForExistence(timeout: 5))
        XCTAssertTrue(diagnostics.label.contains("refresh=pending"))
        let originalTitle = title.value as? String
        title.tap()
        keepScreenshot(named: "Cached Note title focused before typing", from: app)
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 3))
        let insertion = " typed during refresh"
        title.typeText(insertion)
        let expected = title.value as? String
        keepScreenshot(named: "Cached Note immediately after typing", from: app)
        XCTAssertTrue(expected?.contains(insertion) == true)
        XCTAssertEqual(expected?.replacingOccurrences(of: insertion, with: ""), originalTitle)
        XCTAssertTrue(diagnostics.label.contains("refresh=pending"), "Typing must happen before the delayed GET completes.")
        keepScreenshot(named: "Cached Note edited while refresh is pending", from: app)
        let completion = NSPredicate { _, _ in diagnostics.label.contains("settled=true") && diagnostics.label.contains("saves=1;") }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: completion, object: nil)], timeout: 25), .completed)
        XCTAssertTrue(waitForValue("saved", on: element(in: app, identifier: "native-notebook-save-status"), timeout: 5))
        XCTAssertEqual(title.value as? String, expected)
        XCTAssertFalse(app.buttons["native-notebook-retry-save"].exists)
        XCTAssertFalse(app.buttons["Save"].exists)
        keepScreenshot(named: "Cached Note refresh preserves typed title and autosaves once", from: app)
        // This fixture mounts the direct editor as its navigation root, so it
        // has no parent Note list. Real-project Done/reopen is a separate check.
    }

    func testNativeNotebookCachedPendingRefreshRetriesOriginalMutationSilently() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-reference-fixture", "--native-notebook-delayed-refresh-fixture", "--native-notebook-refresh-pending-draft"]
        app.launchArguments.append("--native-notebook-save-diagnostics")
        app.launch()
        let title = app.textFields["Note title"]
        let diagnostics = app.staticTexts["native-notebook-refresh-diagnostics"]
        XCTAssertTrue(title.waitForExistence(timeout: 30))
        XCTAssertEqual(title.value as? String, "Pending original mutation")
        let settled = NSPredicate { _, _ in diagnostics.label.contains("settled=true") }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: settled, object: nil)], timeout: 25), .completed)
        XCTAssertTrue(waitForValue("saved", on: element(in: app, identifier: "native-notebook-save-status"), timeout: 15))
        XCTAssertTrue(diagnostics.label.contains("saves=1;"))
        XCTAssertTrue(diagnostics.label.contains("mutation=native-refresh-original-mutation"))
        XCTAssertEqual(title.value as? String, "Pending original mutation")
        XCTAssertFalse(app.buttons["Retry save"].exists)
        XCTAssertFalse(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "confirm the previous save")).firstMatch.exists)
        keepScreenshot(named: "Cached pending Note retries original mutation once", from: app)
    }

    func testNativeNotebookTypingDuringAutosaveKeepsTheFirstRequest() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk",
            "--native-notebook-reference-fixture", "--native-notebook-slow-save-fixture"]
        app.launchArguments.append("--native-notebook-save-diagnostics")
        app.launch()
        let title = app.textFields["Note title"]
        let diagnostics = app.staticTexts["native-notebook-refresh-diagnostics"]
        XCTAssertTrue(title.waitForExistence(timeout: 30))
        XCTAssertTrue(waitForValue("saved", on: element(in: app, identifier: "native-notebook-save-status"), timeout: 10))
        XCTAssertFalse(app.staticTexts["Synced"].exists)
        let originalTitle = title.value as? String
        title.tap()
        let firstInsertion = " first edit"
        title.typeText(firstInsertion)
        let firstTitle = title.value as? String
        XCTAssertTrue(firstTitle?.contains(firstInsertion) == true)
        XCTAssertEqual(firstTitle?.replacingOccurrences(of: firstInsertion, with: ""), originalTitle)
        let saveStarted = NSPredicate { _, _ in diagnostics.label.contains("saves=1;") }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: saveStarted, object: nil)], timeout: 5), .completed)
        XCTAssertEqual(element(in: app, identifier: "native-notebook-save-status").value as? String, "saving")
        XCTAssertFalse(app.staticTexts["native-notebook-sync-status"].exists)
        XCTAssertFalse(app.staticTexts["Saving…"].exists)
        let secondInsertion = " second edit"
        title.typeText(secondInsertion)
        let latestTitle = title.value as? String
        XCTAssertTrue(latestTitle?.contains(secondInsertion) == true)
        XCTAssertEqual(latestTitle?.replacingOccurrences(of: secondInsertion, with: ""), firstTitle)
        XCTAssertEqual(element(in: app, identifier: "native-notebook-save-status").value as? String, "saving")
        XCTAssertFalse(app.staticTexts["Saving…"].exists)
        XCTAssertFalse(app.buttons["native-notebook-retry-save"].exists)

        XCTAssertTrue(waitForValue("saved", on: element(in: app, identifier: "native-notebook-save-status"), timeout: 20))
        XCTAssertFalse(app.staticTexts["Synced"].exists)
        XCTAssertFalse(app.staticTexts["Draft kept on this iPhone"].exists)
        XCTAssertEqual(title.value as? String, latestTitle)
        XCTAssertTrue(diagnostics.label.contains("saves=2;"), "Each edit should save once. \(diagnostics.label)")
        XCTAssertFalse(app.buttons["native-notebook-retry-save"].exists)
        XCTAssertTrue(app.buttons["native-notebook-back"].isEnabled)
    }

    func testNativeNotebookOfflineSaveKeepsDraftAndRecoversAutomatically() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase3-entitled-research-fixture", "--permitext-disable-clerk",
            "--native-notebook-reference-fixture", "--native-notebook-save-offline-fixture"]
        app.launchArguments.append("--native-notebook-save-diagnostics")
        app.launch()
        let title = app.textFields["Note title"]
        XCTAssertTrue(title.waitForExistence(timeout: 30))
        title.tap()
        title.typeText(" offline edit")
        let editedTitle = title.value as? String
        XCTAssertTrue(waitForValue("saved", on: element(in: app, identifier: "native-notebook-save-status"), timeout: 15))
        XCTAssertEqual(title.value as? String, editedTitle)
        XCTAssertFalse(app.buttons["Retry save"].exists)
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
        app.launchArguments.append("--native-notebook-save-diagnostics")
        app.launch()
        let title = app.textFields["Note title"]
        XCTAssertTrue(title.waitForExistence(timeout: 30))
        title.tap()
        title.typeText(" HTTP lost response")
        let editedTitle = try XCTUnwrap(title.value as? String)
        XCTAssertTrue(waitForValue("saved", on: element(in: app, identifier: "native-notebook-save-status"), timeout: 15))
        XCTAssertEqual(title.value as? String, editedTitle)
        XCTAssertFalse(app.buttons["Retry save"].exists)
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
        app.launchArguments.append("--native-notebook-save-diagnostics")
        app.launch()
        let title = app.textFields["Note title"]
        XCTAssertTrue(title.waitForExistence(timeout: 30))
        title.tap()
        title.typeText(" Synthetic revocation record")
        let originalTitle = try XCTUnwrap(title.value as? String)
        XCTAssertTrue(waitForValue("saved", on: element(in: app, identifier: "native-notebook-save-status"), timeout: 15))
        _ = try await fixture("fixture/revoke", post: true)
        title.tap()
        title.typeText(" pending after revocation")
        let pendingTitle = try XCTUnwrap(title.value as? String)
        let saveStatus = element(in: app, identifier: "native-notebook-save-status")
        XCTAssertTrue(waitForValue("unsaved", on: saveStatus, timeout: 15))
        XCTAssertEqual(title.value as? String, pendingTitle)
        XCTAssertFalse(app.buttons["Save"].exists)
        XCTAssertFalse(app.buttons["Retry save"].exists)
        keepScreenshot(named: "Revoked synthetic HTTP session preserves unsaved Note draft", from: app)

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

    func testNativeProjectPartialLookupShowsImportConfirmationAndRemainsSaveable() {
        verifyNativePartialLookup(largeText: false)
    }

    func testNativeLargeTextProjectPartialLookupShowsImportConfirmationAndRemainsSaveable() {
        verifyNativePartialLookup(largeText: true)
    }

    func testNameOnlyProjectHasNoDesktopReportPrompt() throws {
#if !DEBUG
        throw XCTSkip("Project acceptance uses the isolated Debug fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons["New project"].tap()
        let form = app.navigationBars["New project"]
        let name = app.textFields["e.g. Bronx R-2 Passive House"]
        XCTAssertTrue(name.waitForExistence(timeout: 10))
        name.tap()
        name.typeText("Research before site selection")
        let save = form.buttons["Save"]
        XCTAssertTrue(save.isEnabled)
        save.tap()
        XCTAssertEqual(app.staticTexts["project-workspace-name"].label, "Research before site selection")
        let reports = app.buttons["project-section-reports"]
        reveal(reports, in: app)
        reports.tap()
        XCTAssertTrue(app.navigationBars["Reports"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["reports-copy-desktop-project-link"].exists)
        XCTAssertFalse(app.staticTexts["No saved PDFs yet. Open Report on desktop and choose Save PDF to Project."].exists)
#endif
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
        name.tap() // Address blur exercises the real lookup handler.
        let confirmation = app.staticTexts["Partial import. Imported 1 sourced fact from NYC Planning."]
        XCTAssertTrue(confirmation.waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "Mapped-area facts were unavailable.")).firstMatch.exists)
        XCTAssertTrue(app.staticTexts["Matched tax-lot address: 100 SYNTHETIC FIXTURE STREET, NEW YORK, NY"].exists)
        XCTAssertEqual(address.value as? String, "100 Synthetic Fixture Street")
        let save = app.buttons["Save"]
        XCTAssertTrue(save.isEnabled)
        keepScreenshot(named: "Native partial property lookup confirmation retains saveable project", from: app)
        save.tap()
        let summary = app.staticTexts["native-partial-lookup-saved-summary"]
        XCTAssertTrue(summary.waitForExistence(timeout: 10))
        XCTAssertTrue(summary.label.contains("Synthetic partial lookup"))
        XCTAssertTrue(summary.label.contains("Address: 100 Synthetic Fixture Street."))
        XCTAssertTrue(summary.label.contains("Facts: 1. Stories: 3."))
        keepScreenshot(named: "Native partial lookup saves available synthetic facts", from: app)
    }

    func testNativeNotebookFirstLoadFailureShowsRetryAndRecovers() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-retry-fixture"]
        app.launch()
        let retry = app.buttons["native-notebook-retry"]
        XCTAssertTrue(retry.waitForExistence(timeout: 30), "First-load failure must be visible and recoverable.")
        keepScreenshot(named: "Native Notebook first-load retry", from: app)
        retry.tap()
        XCTAssertTrue(app.buttons["New Note"].waitForExistence(timeout: 10),
                      "Successful retry must restore server-authorized editing.")
        XCTAssertTrue(waitForNonexistence(retry, timeout: 10))
        XCTAssertFalse(app.staticTexts["No Notes yet"].exists)
        XCTAssertFalse(app.staticTexts["Create a Note for analysis, evidence, and code research."].exists)
        app.buttons["New Note"].tap()
        XCTAssertTrue(app.textFields["Note title"].waitForExistence(timeout: 10))
    }

    func testNativeNotebookConflictRequiresReviewAndDeletionDoesNotRestoreDraft() throws {
        try verifyNotebookDeletionAfterConflict(fromEditor: true)
    }

    func testNativeNotebookSelectionDeletionReturnsToEmptyList() throws {
        try verifyNotebookDeletionAfterConflict(fromEditor: false)
    }

    private func verifyNotebookDeletionAfterConflict(fromEditor: Bool) throws {
        let app = XCUIApplication()
        app.launchArguments += ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--native-notebook-conflict-fixture"]
        app.launchArguments.append("--native-notebook-save-diagnostics")
        app.launch()
        let cachedDraft = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Local unsynchronized analysis")).firstMatch
        XCTAssertTrue(cachedDraft.waitForExistence(timeout: 30), app.debugDescription)
        XCTAssertTrue(app.buttons["New Note"].exists, "Conflict acceptance must begin in the real Notebook list.")
        let savedRow = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Latest saved analysis")).firstMatch
        XCTAssertFalse(savedRow.exists, "The server revision and its local draft belong to one row.")
        XCTAssertFalse(app.staticTexts["Drafts on this iPhone"].exists)
        XCTAssertFalse(cachedDraft.label.contains("Unsynchronized draft"))
        XCTAssertTrue(cachedDraft.isHittable)
        keepScreenshot(named: "Notebook lists the conflicting note once", from: app)
        cachedDraft.tap()
        let review = app.buttons["native-notebook-review-conflict"]
        XCTAssertTrue(review.waitForExistence(timeout: 30))
        XCTAssertEqual(app.staticTexts["native-notebook-sync-status"].label, "Needs attention")
        XCTAssertTrue(nativeNotebookBody(in: app).waitForExistence(timeout: 15))
        let back = app.buttons["native-notebook-back"]
        XCTAssertTrue(back.exists && back.isHittable)
        back.tap()
        XCTAssertTrue(cachedDraft.waitForExistence(timeout: 5))
        XCTAssertFalse(savedRow.exists, "Closing a conflicting note should keep one row for that note.")
        cachedDraft.tap()
        XCTAssertTrue(review.waitForExistence(timeout: 10), "Conflict review must remain available after reopening.")
        XCTAssertFalse(app.buttons["native-notebook-retry-save"].exists, "An ordinary retry must not bypass conflict review.")
        XCTAssertFalse(app.buttons["native-notebook-confirm-conflict"].exists, "Overwrite consent must only be offered inside the review.")
        review.tap()
        XCTAssertTrue(app.staticTexts["Your draft"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["My local draft is still preserved."].exists)
        XCTAssertTrue(app.staticTexts["Another device saved this analysis."].exists)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Native Notebook explicit conflict review"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        app.buttons["native-notebook-confirm-conflict"].tap()
        XCTAssertTrue(waitForValue("saved", on: element(in: app, identifier: "native-notebook-save-status"), timeout: 10))
        XCTAssertTrue(waitForNonexistence(app.staticTexts["native-notebook-sync-status"], timeout: 5))
        let title = app.textFields["Note title"]
        title.tap()
        title.typeText(" updated")
        let editedTitle = try XCTUnwrap(title.value as? String)
        back.tap()
        let selectNotes = app.buttons["Select notes"]
        XCTAssertTrue(selectNotes.waitForExistence(timeout: 10))
        let savedNote = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", editedTitle)).firstMatch
        XCTAssertTrue(savedNote.waitForExistence(timeout: 10))
        selectNotes.tap()
        savedNote.tap()
        XCTAssertEqual(app.staticTexts["list-selection-count"].label, "1 selected")
        XCTAssertTrue(app.buttons["Move selected notes to Trash"].isEnabled)
        keepScreenshot(named: "Notes displays the shared selection controls", from: app)
        app.buttons["Move selected notes to Trash"].tap()
        let selectionTrash = app.alerts["Move this note to Trash?"]
        let recoveryMessage = "You can restore this note in Settings under Trash / Undo deletion for 30 days."
        XCTAssertTrue(selectionTrash.staticTexts[recoveryMessage].waitForExistence(timeout: 5))
        if fromEditor {
            selectionTrash.buttons["Cancel"].tap()
            app.buttons["Cancel"].tap()
            savedNote.tap()
            XCTAssertTrue(title.waitForExistence(timeout: 10))
            XCTAssertEqual(title.value as? String, editedTitle)
            let noteActions = app.buttons["Note actions"]
            XCTAssertTrue(noteActions.waitForExistence(timeout: 5) && noteActions.isHittable)
            noteActions.tap()
            let deleteAction = app.buttons["native-notebook-delete"]
            XCTAssertTrue(deleteAction.waitForExistence(timeout: 5) && deleteAction.isHittable)
            deleteAction.tap()
            let deletionAlert = app.alerts["Move this note to Trash?"]
            XCTAssertTrue(deletionAlert.waitForExistence(timeout: 5),
                          "Move to Trash must present a separate explicit confirmation.\n\(app.debugDescription)")
            XCTAssertTrue(deletionAlert.staticTexts[recoveryMessage].exists)
            let confirmDelete = deletionAlert.buttons["Move to Trash"]
            XCTAssertTrue(confirmDelete.isHittable && deletionAlert.buttons["Cancel"].isHittable, app.debugDescription)
            XCTAssertTrue(title.exists, "Opening confirmation must keep the current note open.")
            keepScreenshot(named: "Native Notebook deletion requires confirmation after reviewed conflict", from: app)
            confirmDelete.tap()
        } else {
            selectionTrash.buttons["Move to Trash"].tap()
        }
        let newNote = app.buttons["New Note"]
        XCTAssertTrue(newNote.waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["Loading Notebook…"].exists)
        XCTAssertFalse(app.staticTexts["list-selection-count"].exists)
        XCTAssertFalse(savedNote.exists)
        XCTAssertFalse(app.staticTexts["Drafts on this iPhone"].exists)
        XCTAssertFalse(cachedDraft.exists)
        XCTAssertFalse(app.textFields["Note title"].exists, "Deletion must dismiss the editor to its parent list.")
        // Foreground refresh rereads both the server list and local draft cache.
        // Do not relaunch: the isolated harness deliberately reseeds on launch.
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(newNote.waitForExistence(timeout: 10))
        XCTAssertTrue(waitForNonexistence(app.staticTexts["Loading Notebook…"], timeout: 10))
        XCTAssertFalse(app.staticTexts["Drafts on this iPhone"].exists, "A cache refresh must not recreate the deleted draft.")
        XCTAssertFalse(cachedDraft.exists)
        XCTAssertFalse(savedNote.exists)
        keepScreenshot(named: "Deleted Notebook stays empty after foreground cache refresh", from: app)
    }

    func testResearchLateCompletionCannotReplaceNewConversation() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--phase3-seeded-selection-fixture", "--research-delayed-response-fixture"]
        app.launch()
        let composer = element(in: app, identifier: "research-composer")
        XCTAssertTrue(composer.waitForExistence(timeout: 45), phase3LaunchFailureDescription(in: app))
        composer.tap()
        composer.typeText("Synthetic delayed private question")
        app.buttons["Send message"].tap()
        let disclosure = app.buttons["Continue to Assistant"]
        if disclosure.waitForExistence(timeout: 2) { disclosure.tap() }
        XCTAssertTrue(app.buttons["research-cancel-request"].waitForExistence(timeout: 3))
        app.buttons["Assistant history"].tap()
        app.buttons["New conversation"].tap()
        XCTAssertTrue(composer.waitForExistence(timeout: 5))
        let oldAnswer = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "The selected enacted provision controls")).firstMatch
        let noStaleAnswer = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true"), object: oldAnswer)
        noStaleAnswer.isInverted = true
        XCTAssertEqual(XCTWaiter.wait(for: [noStaleAnswer], timeout: 7), .completed)
        XCTAssertFalse(app.staticTexts["Synthetic delayed private question"].exists)
        XCTAssertFalse(app.buttons["research-cancel-request"].exists)
    }

    func testResearchAnswerPreservesKeyboardAndStartsAtTopWhileTyping() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk",
                               "--phase3-seeded-selection-fixture", "--research-delayed-response-fixture"]

        for hideKeyboard in [false, true] {
            app.launch()
            let composer = element(in: app, identifier: "research-composer")
            let keyboard = app.keyboards.firstMatch
            XCTAssertTrue(composer.waitForExistence(timeout: 45), phase3LaunchFailureDescription(in: app))
            composer.tap()
            XCTAssertTrue(keyboard.waitForExistence(timeout: 5))
            composer.typeText("Synthetic keyboard behavior question")
            app.buttons["Send message"].tap()
            let disclosure = app.buttons["Continue to Assistant"]
            if disclosure.waitForExistence(timeout: 1) {
                disclosure.tap()
                composer.tap()
            }
            XCTAssertTrue(app.buttons["research-cancel-request"].waitForExistence(timeout: 3))
            XCTAssertTrue(keyboard.exists, "Sending should preserve the open keyboard.")
            let sentQuestion = app.staticTexts["Synthetic keyboard behavior question"]
            XCTAssertTrue(sentQuestion.waitForExistence(timeout: 2))
            XCTAssertLessThan(sentQuestion.frame.maxY, composer.frame.minY)
            XCTAssertTrue(element(in: app, identifier: "research-question-progress").exists)
            XCTAssertFalse(app.staticTexts["per codes is researching…"].exists)

            if hideKeyboard {
                app.coordinate(withNormalizedOffset: CGVector(dx: 0.52, dy: 0.39)).tap()
                XCTAssertTrue(waitForNonexistence(keyboard, timeout: 3))
            }

            let answer = element(in: app, identifier: "research-answer")
            XCTAssertTrue(answer.waitForExistence(timeout: 15))
            if hideKeyboard {
                XCTAssertFalse(keyboard.exists, "An answer should not reopen a dismissed keyboard.")
            } else { XCTAssertTrue(keyboard.exists) }
            let atTop = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
                answer.frame.minY > app.frame.minY && answer.frame.minY < app.frame.height * 0.3
            }, object: nil)
            XCTAssertEqual(XCTWaiter.wait(for: [atTop], timeout: 4), .completed,
                "The answer should start above the composer near the top of the screen. Frame: \(answer.frame)")
            app.terminate()
        }
    }

    func testResearchAnswerGuidesReviewBeforeNotebookAndWebReport() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--phase3-seeded-selection-fixture"]
        app.launch()
        let composer = element(in: app, identifier: "research-composer")
        XCTAssertTrue(composer.waitForExistence(timeout: 45))
        func revealAboveComposer(_ target: XCUIElement, swipingDown: Bool = false) {
            for _ in 0..<8 {
                let frame = target.exists ? target.frame : .null
                let contentTop = app.frame.minY + 100
                if !frame.isEmpty, frame.minY > contentTop,
                   frame.maxY < composer.frame.minY - 12 { return }
                let needsDownwardGesture = frame.isEmpty ? swipingDown : frame.minY <= contentTop
                let upper = app.coordinate(withNormalizedOffset: CGVector(dx: 0.45, dy: 0.30))
                let lower = app.coordinate(withNormalizedOffset: CGVector(dx: 0.45, dy: 0.68))
                (needsDownwardGesture ? upper : lower).press(
                    forDuration: 0.05, thenDragTo: needsDownwardGesture ? lower : upper
                )
            }
            XCTFail("Could not reveal \(target) above the Assistant composer.")
        }
        composer.tap()
        composer.typeText("Synthetic next-step guidance question")
        app.buttons["Send message"].tap()
        let disclosure = app.buttons["Continue to Assistant"]
        if disclosure.waitForExistence(timeout: 2) { disclosure.tap() }
        XCTAssertTrue(element(in: app, identifier: "research-answer").waitForExistence(timeout: 15))
        XCTAssertFalse(app.staticTexts["research-answer-authority-status"].exists)
        let details = app.buttons["Sources & details"]
        revealAboveComposer(details)
        XCTAssertTrue(details.isHittable)
        var previous = details
        let expectedSpacing = app.frame.width * 0.17
        for title in ["Copy answer", "Helpful", "Report a problem", "Add to Notebook"] {
            let action = app.buttons[title]
            XCTAssertTrue(action.isHittable)
            XCTAssertEqual(action.frame.midY, details.frame.midY, accuracy: 1)
            XCTAssertGreaterThanOrEqual(action.frame.midX - previous.frame.midX, expectedSpacing)
            previous = action
        }
        app.buttons["Helpful"].tap()
        XCTAssertTrue(app.buttons["Helpful"].wait(for: \.isSelected, toEqual: true, timeout: 5))
        XCTAssertFalse(app.staticTexts["Feedback: Received"].exists)
        let report = app.buttons["Report a problem"]
        report.tap()
        XCTAssertTrue(app.navigationBars["Assistant feedback"].waitForExistence(timeout: 5))
        app.buttons["Submit"].tap()
        XCTAssertTrue(report.wait(for: \.isSelected, toEqual: true, timeout: 5))
        XCTAssertFalse(app.buttons["Helpful"].isSelected)
        app.buttons["Add to Notebook"].tap()
        let notebook = app.navigationBars["Add to Notebook"]
        XCTAssertTrue(notebook.waitForExistence(timeout: 10))
        notebook.buttons["Cancel"].tap()
        keepScreenshot(named: "Five Assistant answer actions on one row", from: app)
        details.tap()
        let facts = app.buttons["Facts used in this answer"]
        XCTAssertTrue(facts.waitForExistence(timeout: 10))
        revealAboveComposer(facts)
        keepScreenshot(named: "Assistant answer details collapsed", from: app)
        facts.tap()
        XCTAssertTrue(app.staticTexts["Occupancy"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["R-2 (assumed)"].exists)
        XCTAssertTrue(app.staticTexts["user-stated; not independently verified"].exists)
        XCTAssertTrue(app.staticTexts["Only the storage room has sprinklers."].exists)
        XCTAssertTrue(app.staticTexts["Zoning District"].exists)
        XCTAssertTrue(app.staticTexts["unknown; not established"].exists)
        XCTAssertTrue(app.staticTexts["The upper floors will remain occupied."].exists)
        XCTAssertTrue(app.staticTexts["Existing window openings are outside the proposed work."].exists)
        XCTAssertFalse(app.staticTexts["The existing corridor serves eight apartments."].exists)
        keepScreenshot(named: "Assistant facts grouped by topic", from: app)
        let narrative = app.buttons["Project narrative"]
        revealAboveComposer(narrative)
        XCTAssertTrue(narrative.isHittable)
        narrative.tap()
        XCTAssertTrue(app.staticTexts["The existing corridor serves eight apartments."].waitForExistence(timeout: 5))
        revealAboveComposer(facts, swipingDown: true)
        facts.tap()

        let citedSources = app.buttons["Cited sources"]
        revealAboveComposer(citedSources)
        XCTAssertTrue(citedSources.isHittable)
        citedSources.tap()
        let citation = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "research-citation-")).firstMatch
        XCTAssertTrue(citation.waitForExistence(timeout: 5))
        XCTAssertEqual(app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "research-citation-")).count, 1)
        XCTAssertTrue(citation.label.contains("§ 101.1"))
        keepScreenshot(named: "Assistant citations as a single list", from: app)

        let editions = app.buttons["Source editions & scope"]
        revealAboveComposer(editions)
        XCTAssertTrue(editions.isHittable)
        editions.tap()
        XCTAssertTrue(app.staticTexts["Current enacted edition"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Project default applied"].exists)
        XCTAssertEqual(app.staticTexts.matching(identifier: "2022 NYC Construction Codes").count, 1)
        XCTAssertFalse(app.staticTexts["2022 New York City Construction Codes"].exists)
        editions.tap()

        let guidance = element(in: app, identifier: "research-next-step-guidance")
        revealAboveComposer(guidance)
        XCTAssertTrue(guidance.isHittable)
        XCTAssertTrue(guidance.label.contains("your own conclusion in a Project Note"))
        XCTAssertTrue(guidance.label.contains("Build Reports on per codes Web"))
        keepScreenshot(named: "Research review to Notebook and Web Report guidance", from: app)

        revealAboveComposer(citation, swipingDown: true)
        citation.tap()
        XCTAssertTrue(app.navigationBars["101.1"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.buttons["Close passage"].exists)
        XCTAssertTrue(app.staticTexts["Building Code · 2022"].exists)
        app.buttons["Close passage"].tap()
        XCTAssertTrue(citation.waitForExistence(timeout: 5))
        XCTAssertTrue(composer.isHittable)
        XCTAssertFalse(app.textFields["Search codes"].exists)
        XCTAssertEqual(details.value as? String, "Expanded")
    }

    func testAssistantPinsInHistoryAndKeepsChatMenuFocused() throws {
#if !DEBUG
        throw XCTSkip("Requires the isolated Assistant pin fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk",
                               "--phase3-seeded-selection-fixture", "--research-delayed-pin-fixture"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "research-composer").waitForExistence(timeout: 45))
        app.buttons["Assistant actions"].tap()
        XCTAssertTrue(app.buttons["Rename"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Pin"].exists)
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.24, dy: 0.50)).tap()
        app.buttons["Assistant history"].tap()
        let options = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "research-history-options-")).firstMatch
        XCTAssertTrue(options.waitForExistence(timeout: 10))
        options.tap()
        app.buttons["Pin"].tap()
        let row = app.buttons.matching(identifier: "research-history-row").firstMatch
        XCTAssertTrue(app.staticTexts["Pinned"].waitForExistence(timeout: 2))
        XCTAssertTrue(row.isEnabled)
        options.tap()
        let unpin = app.buttons["Unpin"]
        XCTAssertTrue(unpin.wait(for: \.isEnabled, toEqual: true, timeout: 8))
        unpin.tap()
        XCTAssertTrue(waitForNonexistence(app.staticTexts["Pinned"], timeout: 3))
        XCTAssertTrue(row.isEnabled)
#endif
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

    func testMainScreenTitleAlignment() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk", "--main-header-alignment-fixture"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        var positions: [CGFloat] = []
        var controlPositions: [CGFloat] = []
        for (tab, title) in [("main-tab-saved", "Saved"), ("main-tab-research", "Assistant"),
                             ("main-tab-reader-1", "reader-main-title"), ("main-tab-reader-2", "reader-main-title")] {
            app.buttons[tab].tap()
            let heading = title == "reader-main-title"
                ? app.staticTexts["screen-title-Chapters"].firstMatch
                : app.staticTexts["screen-title-\(title)"].firstMatch
            XCTAssertTrue(heading.waitForExistence(timeout: 15), app.debugDescription)
            positions.append(heading.frame.midY)
            let controlLabel = title == "reader-main-title" ? "reader-code-picker"
                : title == "Saved" ? "New project" : "New conversation"
            let control = app.buttons[controlLabel].firstMatch
            XCTAssertTrue(control.isHittable, app.debugDescription)
            controlPositions.append(control.frame.midY)
            print("TITLE_POSITION \(tab) \(heading.frame)")
            keepScreenshot(named: "Title alignment \(tab)", from: app)
        }
        XCTAssertLessThanOrEqual((positions.max() ?? 0) - (positions.min() ?? 0), 1)
        XCTAssertLessThanOrEqual((controlPositions.max() ?? 0) - (controlPositions.min() ?? 0), 1,
                                 "Top controls must share the native navigation row across screens.")
    }

    func testUnifiedReaderSwitchingSearchReturnAndRelaunch() {
        let app = XCUIApplication()
        app.launch()
        let explore = app.buttons["phase5-first-use-explore"]
        if explore.waitForExistence(timeout: 3) { explore.tap() }
        let reader = app.buttons["main-tab-reader"]
        XCTAssertTrue(reader.waitForExistence(timeout: 45), app.debugDescription)
        XCTAssertFalse(app.buttons["main-tab-reader-1"].exists)
        XCTAssertFalse(app.buttons["main-tab-reader-2"].exists)
        reader.tap()
        let primary = app.buttons["reader-session-primary"]
        let secondary = app.buttons["reader-session-secondary"]
        XCTAssertTrue(primary.waitForExistence(timeout: 15))
        XCTAssertEqual(primary.frame.height, 52, accuracy: 1)
        XCTAssertEqual(secondary.frame.height, 52, accuracy: 1)
        XCTAssertGreaterThan(primary.frame.minY, app.frame.height * 0.65)
        XCTAssertLessThanOrEqual(primary.frame.maxY, reader.frame.minY + 1)
        primary.tap()
        let picker = app.buttons["reader-code-picker"].firstMatch
        if !picker.waitForExistence(timeout: 3) {
            app.navigationBars.buttons.element(boundBy: 0).tap()
        }
        XCTAssertTrue(picker.waitForExistence(timeout: 15))
        let originalSource = picker.label
        let chapter = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Chapter 1:")).firstMatch
        XCTAssertTrue(chapter.waitForExistence(timeout: 15))
        chapter.tap()
        let chapterTitle = app.staticTexts["reader-chapter-title"]
        XCTAssertTrue(chapterTitle.waitForExistence(timeout: 45))
        XCTAssertLessThan(chapterTitle.frame.maxY, app.frame.height * 0.25)
        XCTAssertLessThan(app.buttons["reader-current-section-bookmark"].frame.maxY, app.frame.height * 0.25)
        XCTAssertEqual(app.staticTexts.matching(identifier: "reader-chapter-title").count, 1)
        openChapterSections(in: app)
        let scope = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "101.2")).firstMatch
        XCTAssertTrue(scope.waitForExistence(timeout: 10))
        scope.tap()
        XCTAssertTrue(chapterTitle.waitForExistence(timeout: 10))
        let jumped = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (chapterTitle.value as? String)?.contains("101.2") == true
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [jumped], timeout: 10), .completed)
        keepScreenshot(named: "Reader picker after selecting a section", from: app)
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.65))
            .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.4)))
        let blocks = app.textViews.matching(NSPredicate(format: "identifier BEGINSWITH %@", "native-reader-block-"))
        guard let passage = blocks.allElementsBoundByIndex.first(where: { $0.isHittable }) else {
            XCTFail("Reading must contain visible text"); return
        }
        let passageID = passage.identifier
        let y = passage.frame.minY
        keepScreenshot(named: "Unified Reader primary passage", from: app)
        secondary.tap()
        XCTAssertTrue(picker.waitForExistence(timeout: 45))
        // Exercise a different edition so a default-corpus flash cannot pass
        // simply because both readings happened to use 2022.
        picker.tap()
        let historicalBuilding = app.collectionViews.buttons.matching(identifier: "Building Code").element(boundBy: 1)
        XCTAssertTrue(historicalBuilding.waitForExistence(timeout: 10))
        historicalBuilding.tap()
        let historicalReady = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            picker.exists && picker.label.contains("2014")
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [historicalReady], timeout: 30), .completed)
        let secondSource = picker.label
        XCTAssertTrue(secondary.isSelected)
        keepScreenshot(named: "Unified Reader second source", from: app)
        primary.tap()
        XCTAssertTrue(app.staticTexts["reader-chapter-title"].waitForExistence(timeout: 15))
        XCTAssertTrue(app.textViews[passageID].isHittable)
        XCTAssertEqual(app.textViews[passageID].frame.minY, y, accuracy: 5)
        XCTAssertTrue(primary.label.contains(originalSource.split(separator: "·")[0].trimmingCharacters(in: .whitespaces)))
        secondary.tap()
        XCTAssertEqual(picker.label, secondSource)
        app.buttons["Search"].tap()
        XCTAssertTrue(app.textFields["Search codes"].waitForExistence(timeout: 10))
        app.buttons["Close search"].tap()
        XCTAssertTrue(secondary.isSelected)
        XCTAssertEqual(picker.label, secondSource)
        for tab in ["main-tab-saved", "main-tab-research"] {
            app.buttons[tab].tap()
            reader.tap()
            XCTAssertTrue(secondary.isSelected)
            XCTAssertEqual(picker.label, secondSource)
        }
        app.buttons["main-tab-saved"].tap()
        app.terminate()
        app.launch()
        XCTAssertTrue(reader.waitForExistence(timeout: 45))
        reader.tap()
        XCTAssertTrue(secondary.waitForExistence(timeout: 15))
        XCTAssertTrue(secondary.isSelected)
        XCTAssertTrue(picker.waitForExistence(timeout: 45))
        XCTAssertEqual(picker.label, secondSource)
        keepScreenshot(named: "Unified Reader retained after relaunch", from: app)
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

    private func openFixtureBuildingChapterOne(in app: XCUIApplication) {
        app.buttons["main-tab-reader"].tap()
        let primary = app.buttons["reader-session-primary"]
        XCTAssertTrue(primary.waitForExistence(timeout: 15))
        primary.tap()
        let code = app.buttons.matching(NSPredicate(format: "identifier CONTAINS %@ AND label BEGINSWITH %@",
            "2022-construction-codes", "Building Code")).firstMatch
        XCTAssertTrue(code.waitForExistence(timeout: 10))
        code.tap()
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Chapter 1:")).firstMatch.tap()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 30))
    }

    private func launchFixtureProjectReader() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture",
                               "--native-reader-bookmark-alignment-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@",
            "saved-folder-", "Acceptance Project")).firstMatch.tap()
        openFixtureBuildingChapterOne(in: app)
        return app
    }

    func testSavedProjectPassagesHighlightedWhenOpeningReader() {
        let app = launchFixtureProjectReader()
        let saved = app.textViews.matching(NSPredicate(
            format: "label CONTAINS %@ AND value CONTAINS %@", "The provisions of this code shall apply", "Saved text"
        )).firstMatch
        XCTAssertTrue(saved.waitForExistence(timeout: 10), app.debugDescription)
    }

    func testReaderFindKeepsGroupedTextAndJumpsFromMatchList() {
        let app = launchFixtureProjectReader()
        let scope = app.textViews.matching(NSPredicate(format: "label CONTAINS %@", "The provisions of this code shall apply")).firstMatch
        XCTAssertTrue(scope.waitForExistence(timeout: 15), app.debugDescription)
        let groupID = scope.identifier
        XCTAssertTrue(groupID.hasPrefix("native-reader-text-group-"))

        app.buttons["Search this chapter"].tap()
        let field = app.textFields["Find in this chapter"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.typeText("maintenance demolition")
        let matches = app.buttons["Show chapter matches"]
        XCTAssertTrue(matches.waitForExistence(timeout: 10))
        XCTAssertEqual(scope.identifier, groupID, "Typing a query must retain the grouped text view.")
        matches.tap()
        XCTAssertTrue(app.navigationBars["Chapter matches"].waitForExistence(timeout: 10))
        let scopeResult = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "101.2")).firstMatch
        XCTAssertTrue(scopeResult.waitForExistence(timeout: 8))
        scopeResult.tap()
        XCTAssertTrue(waitForNonexistence(app.navigationBars["Chapter matches"]))
        XCTAssertTrue(waitForNonexistence(app.keyboards.firstMatch))
        XCTAssertTrue(waitForValueContaining("search matches", on: scope))
        XCTAssertTrue(scope.isHittable)
        XCTAssertEqual(scope.identifier, groupID, "Jumping to a result must retain the grouped text view.")
        app.buttons["Close chapter find"].tap()
        XCTAssertTrue(waitForNonexistence(field))
        XCTAssertEqual(scope.identifier, groupID)

        app.buttons["Search this chapter"].tap()
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.typeText("code")
        XCTAssertTrue(matches.waitForExistence(timeout: 10))
        let total = String((matches.value as? String ?? "").prefix(while: \.isNumber))
        XCTAssertGreaterThan(Int(total) ?? 0, 2)
        matches.tap()
        let first = app.buttons["chapter-find-match-1"]
        let second = app.buttons["chapter-find-match-2"]
        XCTAssertTrue(first.waitForExistence(timeout: 8))
        XCTAssertTrue(first.label.hasPrefix("1."))
        XCTAssertTrue(second.label.hasPrefix("2."))
        XCTAssertTrue(first.label.contains("101.1") && second.label.contains("101.1"),
                      "Two occurrences in the same provision must have separate numbered rows.")
        second.tap()
        XCTAssertTrue(waitForValueContaining("2 of \(total)", on: matches))

        app.swipeDown()
        let titlePassage = app.textViews.matching(NSPredicate(format: "label BEGINSWITH %@", "101.1 Title.")).firstMatch
        XCTAssertTrue(titlePassage.isHittable)
        let titleY = titlePassage.frame.minY
        XCTAssertGreaterThan(titleY, app.frame.height * 0.20)
        let next = app.buttons["Next match"]
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "hittable == true"),
                                                                  object: next)], timeout: 8), .completed)
        next.tap()
        XCTAssertTrue(waitForValueContaining("3 of \(total)", on: matches))
        XCTAssertEqual(titlePassage.frame.minY, titleY, accuracy: 2)
        app.buttons["Previous match"].tap()
        XCTAssertTrue(waitForValueContaining("2 of \(total)", on: matches))
        XCTAssertEqual(titlePassage.frame.minY, titleY, accuracy: 2)

        app.buttons["Close chapter find"].tap()
        XCTAssertTrue(waitForNonexistence(field))
        app.buttons["Search this chapter"].tap()
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.typeText("101.4.5")
        XCTAssertTrue(matches.waitForExistence(timeout: 10))
        matches.tap()
        app.navigationBars["Chapter matches"].buttons["Done"].tap()
        XCTAssertTrue(waitForNonexistence(app.keyboards.firstMatch))
        next.tap()
        XCTAssertTrue(waitForValueContaining("1 of 1", on: matches))
        let firePrevention = app.textViews.matching(NSPredicate(format: "label BEGINSWITH %@", "101.4.5 Fire prevention.")).firstMatch
        let landsWithContext = NSPredicate { _, _ in
            guard firePrevention.exists, firePrevention.isHittable else { return false }
            let position = firePrevention.frame.minY / app.frame.height
            return (0.25...0.53).contains(position)
        }
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: landsWithContext, object: nil)], timeout: 8), .completed)
    }

    func testReaderSavedColorAndSelectionOnlyActions() {
        let app = launchFixtureProjectReader()
        let passage = app.textViews.matching(NSPredicate(format: "label CONTAINS %@", "The other codes listed")).firstMatch
        reveal(passage, in: app)
        // A grouped heading can be hittable while its paragraph is under the
        // floating tab bar. Bring the gesture coordinates into the reading area.
        let visibleBottom = app.frame.maxY - app.frame.height * 0.23
        for _ in 0..<4 where passage.frame.maxY > visibleBottom {
            let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.60, dy: 0.71))
            let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.60, dy: 0.42))
            start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 0.25)
        }
        XCTAssertTrue(passage.isHittable)
        XCTAssertLessThan(passage.frame.maxY, visibleBottom)
        XCTAssertGreaterThan(passage.frame.maxY, app.frame.minY + app.frame.height * 0.20)
        XCTAssertTrue(passage.identifier.hasPrefix("native-reader-text-group-"), "Exercise selection in the grouped passage.")
        let left = passage.coordinate(withNormalizedOffset: CGVector(dx: 0.27, dy: 0.70))
        let right = passage.coordinate(withNormalizedOffset: CGVector(dx: 0.64, dy: 0.70))
        right.press(forDuration: 0.05, thenDragTo: left)
        XCTAssertFalse(app.buttons["Ask Assistant about this passage"].exists)
        left.press(forDuration: 0.65)
        let expand = app.menuItems["Select Passage"].firstMatch
        XCTAssertTrue(expand.waitForExistence(timeout: 5), app.debugDescription)
        expand.tap()
        let save = app.menuItems["Save to Evidence"].firstMatch
        XCTAssertTrue(save.waitForExistence(timeout: 5), app.debugDescription)
        save.tap()
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value CONTAINS %@", "Saved text"), object: passage)], timeout: 10), .completed)
        // Observe the passage long enough for local persistence and the fixture's
        // asynchronous refresh to finish. Either can invalidate a new highlight.
        let deadline = ContinuousClock.now + .seconds(3)
        repeat {
            guard (passage.value as? String)?.contains("Saved text") == true else {
                XCTFail("The saved highlight disappeared while this passage was still open.")
                return
            }
            RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.1))
        } while ContinuousClock.now < deadline
        app.buttons["main-tab-saved"].tap()
        app.buttons["main-tab-reader"].tap()
        XCTAssertEqual(XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value CONTAINS %@", "Saved text"), object: passage)], timeout: 10), .completed)
        keepScreenshot(named: "Evidence selection after returning to grouped Reader", from: app)
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
        let chapterTitle = app.staticTexts["reader-chapter-title"]
        XCTAssertTrue(chapterTitle.exists && chapterTitle.isHittable)
        openChapterSections(in: app)
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

    func testCompareGroupedChapterScrollFrameDelivery() {
        compareChapterScrollFrames(fixture: "--native-reader-2014-building-chapter-7", chapterNumber: "7",
                                   firstPassage: "The provisions of this chapter shall govern")
    }

    func testCompareGroupedTableChapterScrollFrameDelivery() {
        compareChapterScrollFrames(fixture: "--native-reader-physical-stress", chapterNumber: "6",
                                   firstPassage: "classification of buildings as to type of construction")
    }

    private func compareChapterScrollFrames(fixture: String, chapterNumber: String, firstPassage: String) {
        executionTimeAllowance = 360
        let app = XCUIApplication()
        let runID = UUID().uuidString
        NSLog("Reader frame comparison run %@", runID)
        for (trial, grouped) in [false, true, true, false].enumerated() {
            let arm = grouped ? "grouped" : "baseline"
            app.launchArguments = ["--permitext-disable-clerk", fixture, "--native-reader-browse-opening"]
            if !grouped { app.launchArguments.append("--native-reader-ungrouped-text") }
            app.launchEnvironment["PERMITEXT_READER_FRAME_TRIAL"] = "\(runID)-\(trial + 1)-\(arm)"
            app.launch()
            let chapter = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Chapter \(chapterNumber):")).firstMatch
            let cardReady = chapter.wait(for: \.isHittable, toEqual: true, timeout: 30)
            XCTAssertTrue(cardReady)
            chapter.tap()
            let first = app.textViews.matching(NSPredicate(format: "label CONTAINS %@", firstPassage)).firstMatch
            XCTAssertTrue(first.wait(for: \.isHittable, toEqual: true, timeout: 30))
            assertGroupedRenderer(in: app, enabled: grouped)
            let originalY = first.frame.minY
            let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.68))
            let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.30))
            for _ in 0..<3 {
                start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .fast, thenHoldForDuration: 0)
                RunLoop.current.run(until: Date(timeIntervalSinceNow: 3))
            }
            XCTAssertTrue(!first.isHittable || first.frame.minY < originalY - 40, "The reader must scroll in each arm")
            app.terminate()
        }
    }

    private func assertGroupedRenderer(in app: XCUIApplication, enabled: Bool) {
        let groupedRows = app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "native-reader-text-group-")
        )
        XCTAssertEqual(groupedRows.allElementsBoundByIndex.contains(where: \.isHittable), enabled,
                   "Confirm the actual renderer before measuring.")
    }

    func testLargeChapterScrollPerformance() {
        measureLargeChapterScroll(grouped: false)
    }

    func testGroupedLargeChapterScrollPerformance() {
        measureLargeChapterScroll(grouped: true)
    }

    private func measureLargeChapterScroll(grouped: Bool) {
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-2014-building-chapter-7", "--native-reader-browse-opening"]
        if !grouped { app.launchArguments.append("--native-reader-ungrouped-text") }
        let options = XCTMeasureOptions()
        options.iterationCount = 5
        options.invocationOptions = [.manuallyStart, .manuallyStop]
        var metrics: [XCTMetric] = [XCTOSSignpostMetric.scrollingAndDecelerationMetric, XCTCPUMetric(application: app)]
        #if !targetEnvironment(simulator)
        if #available(iOS 26, *) { metrics.append(XCTHitchMetric(application: app)) }
        #endif
        measure(metrics: metrics, options: options) {
            app.launch()
            // Open the chapter from its card, as a reader does. Deep-linking to
            // a subsection would also exercise position restoration during setup.
            let chapter = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Chapter 7:")).firstMatch
            XCTAssertTrue(chapter.wait(for: \.isHittable, toEqual: true, timeout: 30))
            chapter.tap()
            let firstPassage = app.textViews.matching(NSPredicate(
                format: "label CONTAINS %@", "The provisions of this chapter shall govern"
            )).firstMatch
            XCTAssertTrue(firstPassage.wait(for: \.isHittable, toEqual: true, timeout: 30))
            assertGroupedRenderer(in: app, enabled: grouped)
            let originalY = firstPassage.frame.minY
            let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.68))
            let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3))
            startMeasuring()
            start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .fast, thenHoldForDuration: 0)
            // XCTest can return before inertial scrolling ends. Give each fling
            // the same settling interval before stopping metrics and the app.
            RunLoop.current.run(until: Date(timeIntervalSinceNow: 3))
            stopMeasuring()
            XCTAssertTrue(!firstPassage.isHittable || firstPassage.frame.minY < originalY - 40,
                          "The measured gesture must move the chapter.")
            app.terminate()
        }
    }

    func testNativeLarge2014ChapterRemainsResponsiveWithLazyLayout() {
        executionTimeAllowance = 90
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-2014-building-chapter-7"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 30))
        for _ in 0..<4 { app.swipeUp() }
        let chapterTitle = app.staticTexts["reader-chapter-title"]
        XCTAssertTrue(chapterTitle.exists && chapterTitle.isHittable)
        keepScreenshot(named: "Large 2014 Chapter7 after four actual swipes", from: app)
        openChapterSections(in: app)
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
        let chapterTitle = app.staticTexts["reader-chapter-title"]
        let initial = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (chapterTitle.value as? String)?.contains("27-2120") == true && chapterTitle.isHittable
        }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [initial], timeout: 15), .completed)
        openChapterSections(in: app)
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
        XCTAssertTrue(waitForValueContaining("27-2115", on: app.staticTexts["reader-chapter-title"]),
                      "The HTML Reader must identify the requested section.")
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
        let chapterTitle = app.staticTexts["reader-chapter-title"]
        let heading = app.textViews.matching(NSPredicate(
            format: "identifier ENDSWITH %@ AND label BEGINSWITH %@",
            "fd7e757403c87c3ac0352632161b361cfde526ea10047b7e4a79ed09786dae18", "27-2120 Injunctions"
        )).firstMatch
        keepScreenshot(named: "HMC initial before accessibility target query", from: app)
        print("Permitext navigation regression initial section: \(chapterTitle.value ?? "missing")")
        let initialDump = XCTAttachment(string: app.debugDescription)
        initialDump.name = "HMC initial settled navigation AX"
        initialDump.lifetime = .keepAlways
        add(initialDump)
        keepScreenshot(named: "HMC diagnostic initial settled navigation", from: app)
        XCTAssertTrue((chapterTitle.value as? String)?.contains("27-2120") == true, "Initial requested section must survive settled layout.")
        XCTAssertTrue(heading.exists && heading.isHittable, "Initial requested heading must remain visible.")
        guard heading.exists && heading.isHittable else { return }
        let initialY = heading.frame.minY
        XCTAssertTrue(chapterTitle.exists && chapterTitle.isHittable)
        openChapterSections(in: app)
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
        print("Permitext navigation regression selected section: \(chapterTitle.value ?? "missing")")
        let pickerDump = XCTAttachment(string: app.debugDescription)
        pickerDump.name = "HMC picker settled navigation AX"
        pickerDump.lifetime = .keepAlways
        add(pickerDump)
        keepScreenshot(named: "HMC diagnostic picker settled navigation", from: app)
        XCTAssertTrue((chapterTitle.value as? String)?.contains("27-2120") == true, "Picker target must survive settled layout.")
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
            (app.staticTexts["reader-chapter-title"].value as? String)?.contains("27-2120") == true && term.exists && term.isHittable
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
            (app.staticTexts["reader-chapter-title"].value as? String)?.contains("27-2033.1") == true && heading.exists && heading.isHittable
        }, object: nil)
        let initiallyAligned = XCTWaiter.wait(for: [initialReady], timeout: 30) == .completed
        keepScreenshot(named: "Native HMC Class A initial section and chapter title", from: app)
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
            XCTAssertTrue(app.staticTexts["reader-chapter-title"].waitForExistence(timeout: 45))
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
            (app.staticTexts["reader-chapter-title"].value as? String)?.contains("27-2045") == true && heading.exists && heading.isHittable
        }, object: nil)
        let initiallyAligned = XCTWaiter.wait(for: [initialReady], timeout: 30) == .completed
        keepScreenshot(named: "Native HMC local Class A initial section and chapter title", from: app)
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
        XCTAssertTrue(app.staticTexts["reader-chapter-title"].waitForExistence(timeout: 45))
        let secondarySource = element(in: app, identifier: "reader-source-edition").label
        navigationButton(in: app, title: "First reader").tap()
        XCTAssertTrue(chapterOne.waitForExistence(timeout: 15))
        chapterOne.tap()
        XCTAssertTrue(app.staticTexts["reader-chapter-title"].waitForExistence(timeout: 45))
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45))
        // A prior run can legitimately restore the chapter's final paragraph.
        // Establish a known start through the real jump control before dragging.
        openChapterSections(in: app)
        let beginning = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "27-101 ")).firstMatch
        XCTAssertTrue(beginning.waitForExistence(timeout: 10))
        beginning.tap()
        let beginningReady = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            (app.staticTexts["reader-chapter-title"].value as? String)?.contains("27-101") == true
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
        XCTAssertTrue(app.staticTexts["reader-chapter-title"].waitForExistence(timeout: 15))
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
            openChapterSections(in: app)
            let jump = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", expected + " ")).firstMatch
            for _ in 0..<20 {
                if jump.exists && jump.isHittable { break }
                app.swipeUp()
            }
            XCTAssertTrue(jump.exists && jump.isHittable, app.debugDescription)
            jump.tap()
            let destinationReady = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
                (app.staticTexts["reader-chapter-title"].value as? String)?.contains(expected) == true
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
        let currentSection = app.staticTexts["reader-chapter-title"]
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
            "e884c8e96864e64d526e00199d0f9814951d64e7d328438c5e200eba086e6e1c"
        ]
        app.launch()

        XCTAssertTrue(
            element(in: app, identifier: "phase9-snapshot-ready").waitForExistence(timeout: 45),
            "2014 BC Chapter 7 did not load in the native-reader snapshot harness."
        )

        let figure7057 = app.buttons[
            "native-reader-block-e884c8e96864e64d526e00199d0f9814951d64e7d328438c5e200eba086e6e1c"
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
            "505d0c646726f7da7414b418744a0062d5070f35948db01c4ed780dedc3cf125"
        ]
        app.launch()

        XCTAssertTrue(
            element(in: app, identifier: "phase9-snapshot-ready").waitForExistence(timeout: 45),
            "2014 BC Chapter 7 table snapshot did not load in the native-reader harness."
        )
        let table7058 = element(
            in: app,
            identifier: "native-reader-block-505d0c646726f7da7414b418744a0062d5070f35948db01c4ed780dedc3cf125"
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
            "417aa6f4aaa2f39f835017361e2971970202ad6c7abbed4e4957913213cedc90"
        ]
        app.launch()

        XCTAssertTrue(
            element(in: app, identifier: "phase9-snapshot-ready").waitForExistence(timeout: 45),
            "2014 BC Chapter 10 did not load in the native-reader snapshot harness."
        )
        let table100411 = element(
            in: app,
            identifier: "native-reader-block-417aa6f4aaa2f39f835017361e2971970202ad6c7abbed4e4957913213cedc90"
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
        let sourceParagraph = app.textViews
            .matching(NSPredicate(format: "label CONTAINS[c] %@ OR value CONTAINS[c] %@",
                                  "Chapter 1 of Title 28", "Chapter 1 of Title 28"))
            .firstMatch
        XCTAssertTrue(
            sourceParagraph.waitForExistence(timeout: 10) && sourceParagraph.isHittable,
            "The Fuel Gas paragraph containing the Title 28 link was unavailable."
        )

        // The attributed link is on the third line of this fixture paragraph.
        sourceParagraph.coordinate(withNormalizedOffset: CGVector(dx: 0.47, dy: 0.42)).tap()

        XCTAssertTrue(
            passageHeading(for: "28-101.1", in: app).waitForExistence(timeout: 10),
            "Tapping Chapter 1 of Title 28 did not navigate to 28-101.1."
        )
        XCTAssertFalse(app.navigationBars["28-101.1"].exists)

        let attachment = XCTAttachment(screenshot: app.screenshot(), quality: .medium)
        attachment.name = "Fuel Gas Chapter 1 link opened Title 28"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testPlumbingFixtureFootnoteOpens2022BuildingCodeProvision() throws {
        let app = XCUIApplication()
        app.launchArguments += [
            "--native-reader-universal-plumbing-test", "--native-reader-plumbing-footnote",
            "--native-reader-rollout-stage", "isolated-table-fallback"
        ]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45),
                      launchFailureDescription(in: app))
        app.buttons["Search this chapter"].tap()
        let field = app.textFields["Find in this chapter"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        field.typeText("Exception 2 of the")
        let matches = app.buttons["Show chapter matches"]
        XCTAssertTrue(matches.waitForExistence(timeout: 15))
        keepScreenshot(named: "Plumbing chapter Find controls", from: app)
        matches.tap()
        let result = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Exception 2 of the")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 10))
        result.tap()
        XCTAssertTrue(waitForNonexistence(app.navigationBars["Chapter matches"]))
        app.buttons["Close chapter find"].tap()
        keepScreenshot(named: "2022 Plumbing Code Table 403.1 footnote j", from: app)
        let link = app.links.matching(NSPredicate(format: "label CONTAINS[c] %@", "Section 303.1")).firstMatch
        if link.isHittable {
            link.tap()
        } else {
            // The grouped text view exposes its full text to accessibility.
            // Locate the visible citation instead of assuming its line wraps.
            let recognition = VNRecognizeTextRequest()
            recognition.recognitionLevel = .accurate
            recognition.usesLanguageCorrection = false
            try VNImageRequestHandler(data: app.screenshot().pngRepresentation).perform([recognition])
            let citation = try XCTUnwrap(recognition.results?.compactMap { observation in
                observation.topCandidates(1).first.flatMap { candidate -> CGRect? in
                    guard let range = candidate.string.range(of: "Section 303.1") else { return nil }
                    return (try? candidate.boundingBox(for: range))?.boundingBox
                }
            }.first, "The footnote citation should be visible after Find.")
            app.coordinate(withNormalizedOffset: CGVector(dx: citation.midX, dy: 1 - citation.midY)).tap()
        }
        XCTAssertTrue(passageHeading(for: "303.1.2", in: app).waitForExistence(timeout: 10))
        keepScreenshot(named: "2022 Building Code 303.1.2 from Plumbing footnote", from: app)
    }

    func testSavedReportLinkOpensExactVersionForSeededAccount() throws {
        #if targetEnvironment(simulator)
        let environment = ProcessInfo.processInfo.environment
        guard let rawURL = environment["PERMITEXT_TEST_SAVED_REPORT_LINK"], let url = URL(string: rawURL) else {
            throw XCTSkip("Requires a disposable Simulator signed into the loopback report fixture.")
        }
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk"]
        app.open(url)
        if let expectedAccount = environment["PERMITEXT_TEST_REPORT_DENIED_ACCOUNT"] {
            XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", expectedAccount))
                .firstMatch.waitForExistence(timeout: 30))
            XCTAssertFalse(element(in: app, identifier: "native-report-pdf-preview").exists)
            app.buttons["Switch account"].tap()
            XCTAssertTrue(app.buttons.containing(NSPredicate(format: "label ==[c] %@", "Sign Out"))
                .firstMatch.waitForExistence(timeout: 15))
        } else {
            XCTAssertTrue(element(in: app, identifier: "native-report-pdf-preview").waitForExistence(timeout: 45))
            keepScreenshot(named: "Exact saved PDF opened from a private link", from: app)
        }
        #else
        throw XCTSkip("Requires a disposable Simulator.")
        #endif
    }

    @MainActor
    func testNotebookRetainsOfflinePhoneEditAlongsideDesktopEdit() async throws {
        #if targetEnvironment(simulator)
        let environment = ProcessInfo.processInfo.environment
        guard let rawURL = environment["PERMITEXT_TEST_NATIVE_SYNC_PROXY"],
              let proxy = URL(string: rawURL), proxy.host == "127.0.0.1",
              let token = environment["PERMITEXT_TEST_NATIVE_SYNC_TOKEN"],
              let userID = environment["PERMITEXT_TEST_NATIVE_SYNC_USER_ID"],
              let projectID = environment["PERMITEXT_TEST_NATIVE_SYNC_PROJECT_ID"] else {
            throw XCTSkip("Requires the isolated desktop and Simulator sync fixture.")
        }
        func control(_ action: String) async throws {
            let (_, response) = try await URLSession.shared.data(from: proxy.appendingPathComponent("qa/\(action)"))
            XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
        }
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk",
                               "--native-notebook-http-fixture", "--native-notebook-http-list-fixture"]
        app.launchEnvironment["PERMITEXT_NOTEBOOK_HTTP_FIXTURE_URL"] = rawURL
        app.launchEnvironment["PERMITEXT_NOTEBOOK_HTTP_FIXTURE_TOKEN"] = token
        app.launchEnvironment["PERMITEXT_NOTEBOOK_HTTP_FIXTURE_USER_ID"] = userID
        app.launchEnvironment["PERMITEXT_NOTEBOOK_HTTP_FIXTURE_PROJECT_ID"] = projectID
        app.launch()
        let note = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Synthetic Note 1")).firstMatch
        XCTAssertTrue(note.waitForExistence(timeout: 20))
        note.tap()
        let title = app.textFields["Note title"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        try await control("offline")
        title.tap()
        title.typeText(" iPhone offline edit")
        let status = app.staticTexts["native-notebook-sync-status"]
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Saved on this device"))
            .firstMatch.waitForExistence(timeout: 20))
        try await control("desktop-edit")
        try await control("online")
        let review = app.buttons["native-notebook-review-conflict"]
        XCTAssertTrue(review.waitForExistence(timeout: 40))
        XCTAssertEqual(status.label, "Needs attention")
        XCTAssertTrue((title.value as? String)?.contains("iPhone offline edit") == true)
        review.tap()
        XCTAssertTrue(app.staticTexts["Your draft"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "DesktopSyncFromPairedTest"))
            .firstMatch.waitForExistence(timeout: 10))
        keepScreenshot(named: "Simulator preserves its offline Note edit and the desktop saved edit", from: app)
        #else
        throw XCTSkip("Requires a disposable Simulator.")
        #endif
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
            app.staticTexts["reader-chapter-title"].waitForExistence(timeout: 30),
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

    func testNormalSignedInAccountKeepsPlanAndPinnedClose() throws {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.buttons["main-tab-saved"].waitForExistence(timeout: 45))
        app.buttons["main-tab-saved"].tap()
        let account = app.buttons["Open Account"]
        guard account.waitForExistence(timeout: 10) else { throw XCTSkip("Requires an existing signed-in account.") }
        account.tap()
        let close = app.buttons["account-close"]
        guard close.waitForExistence(timeout: 10) else { throw XCTSkip("Requires an existing signed-in account.") }
        keepScreenshot(named: "Existing account after cold launch", from: app)
        let originalY = close.frame.minY
        app.swipeUp()
        app.swipeUp()
        XCTAssertTrue(close.isHittable)
        XCTAssertEqual(close.frame.minY, originalY, accuracy: 2)
        keepScreenshot(named: "Existing account pinned close after scrolling", from: app)
        close.tap()
        XCTAssertTrue(account.waitForExistence(timeout: 10))
    }

    func testFirstSaveCreatesProjectAndReopensSavedSection() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        let bookmark = element(in: app, identifier: bookmarkIdentifier)
        XCTAssertTrue(bookmark.waitForExistence(timeout: 15))
        bookmark.tap()
        let add = app.alerts.buttons["Add to Project"]
        XCTAssertTrue(add.waitForExistence(timeout: 5))
        add.tap()
        let newProject = app.buttons["New project"]
        XCTAssertTrue(newProject.waitForExistence(timeout: 10))
        keepScreenshot(named: "Optional project assignment", from: app)
        newProject.tap()
        let name = app.textFields["e.g. Bronx R-2 Passive House"]
        XCTAssertTrue(name.waitForExistence(timeout: 10))
        XCTAssertTrue(element(in: app, identifier: "project-editor-address").exists)
        name.tap()
        name.typeText("First saved section")
        XCTAssertEqual(name.value as? String, "First saved section", "Keyboard input must reach the project name before saving.")
        XCTAssertFalse(app.buttons["Save"].isEnabled, "A project name alone is insufficient.")
        let address = element(in: app, identifier: "project-editor-address")
        address.tap()
        address.typeText("   ")
        XCTAssertFalse(app.buttons["Save"].isEnabled, "Whitespace is not a project address.")
        address.typeText("100 Synthetic Fixture Street")
        XCTAssertTrue(app.buttons["Save"].isEnabled, "Description is optional.")
        XCTAssertTrue(element(in: app, identifier: "project-editor-description").exists)
        XCTAssertFalse(app.buttons["Details (optional)"].exists)
        keepScreenshot(named: "Project required address and visible optional description", from: app)
        app.buttons["Save"].tap()
        XCTAssertTrue(waitForNonexistence(name))
        XCTAssertTrue(bookmark.isHittable)
        XCTAssertEqual(bookmark.value as? String, "Saved")
        app.buttons["main-tab-saved"].tap()
        let project = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "saved-folder-", "First saved section")).firstMatch
        XCTAssertTrue(project.waitForExistence(timeout: 10))
        project.tap()
        let row = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH %@", "project-bookmark-")).firstMatch
        reveal(row, in: app)
        XCTAssertTrue(row.waitForExistence(timeout: 15), "New project must contain the section immediately.")
        row.tap()
        XCTAssertTrue(app.buttons["Remove from Saved"].waitForExistence(timeout: 15))
        keepScreenshot(named: "First save reopened from new project", from: app)
    }

    func testSignInFromAccountPresentsClerkAfterDismissingSettings() throws {
        let app = XCUIApplication()
        app.launch()
        let explore = app.buttons["phase5-first-use-explore"]
        if explore.waitForExistence(timeout: 8) { explore.tap() }

        let account = app.buttons["Open Account"]
        XCTAssertTrue(account.waitForExistence(timeout: 45))
        account.tap()
        let closeAccount = app.buttons["account-close"]
        XCTAssertTrue(closeAccount.waitForExistence(timeout: 10))
        let signIn = app.buttons["Sign in or create an account"]
        guard signIn.exists else {
            throw XCTSkip("Requires a signed-out simulator with Clerk configured.")
        }
        reveal(signIn, in: app)
        signIn.tap()

        let switchMode = app.buttons["authentication-switch-mode"]
        XCTAssertTrue(switchMode.waitForExistence(timeout: 20))
        XCTAssertTrue(switchMode.isHittable, "The sign-in sheet must accept input after one tap.")
        XCTAssertFalse(closeAccount.exists, "The Account sheet must be dismissed before presenting sign-in.")
        XCTAssertEqual(switchMode.label, "New to per codes? Create account")
    }

    func testAccountEntryAtAccessibilitySizeCanReturnToExploration() {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk",
            "--native-access-flow-fixture", "--native-access-guest",
            "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        XCTAssertTrue(app.buttons["main-tab-saved"].waitForExistence(timeout: 45))
        app.buttons["main-tab-saved"].tap()
        app.buttons["Open Account"].tap()
        XCTAssertTrue(element(in: app, identifier: "account-welcome").waitForExistence(timeout: 10))
        keepScreenshot(named: "Account entry at largest accessibility text size", from: app)
        let explore = app.buttons["Continue exploring"]
        reveal(explore, in: app)
        XCTAssertTrue(explore.isHittable, "The account exit must remain reachable at large text sizes.")
        keepScreenshot(named: "Account entry scrolled to continue exploring", from: app)
        explore.tap()
        XCTAssertTrue(app.buttons["main-tab-saved"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Saved work requires Pro"].exists)
    }

    func testGuestExploreSearchAndAccountBoundaries() throws {
        try verifyMinimalAccessFlow(guest: true)
    }

    func testFreeAccountUsesSameAccountDestinationFromSavedAndResearch() throws {
        try verifyMinimalAccessFlow(guest: false)
    }

    private func verifyMinimalAccessFlow(guest: Bool) throws {
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk",
            "--native-access-flow-fixture", guest ? "--native-access-guest" : "--native-access-free"]
        if guest { app.launchArguments.append("--phase5-first-use-fixture") }
        app.launch()
        if guest {
            let explore = element(in: app, identifier: "phase5-first-use-explore")
            XCTAssertTrue(explore.waitForExistence(timeout: 45))
            keepScreenshot(named: "Guest welcome", from: app)
            explore.tap()
        }
        XCTAssertTrue(app.buttons["main-tab-saved"].waitForExistence(timeout: 45))
        app.buttons["main-tab-saved"].tap()
        XCTAssertTrue(app.staticTexts["Saved work requires Pro"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Saved"].exists)
        keepScreenshot(named: guest ? "Guest Saved" : "Free Saved", from: app)
        app.buttons[guest ? "Open Account" : "View Plans"].tap()
        let close = app.buttons[guest ? "Continue exploring" : "account-close"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        if guest { XCTAssertTrue(element(in: app, identifier: "account-welcome").exists) }
        else { XCTAssertTrue(app.staticTexts["Account"].exists) }
        keepScreenshot(named: guest ? "Guest account entry" : "Free account plan", from: app)
        if !guest {
            let headerY = close.frame.minY
            app.swipeUp()
            XCTAssertTrue(close.isHittable)
            XCTAssertEqual(close.frame.minY, headerY, accuracy: 2)
        }
        close.tap()
        app.buttons["main-tab-research"].tap()
        XCTAssertTrue(app.staticTexts["Assistant requires Pro"].waitForExistence(timeout: 10))
        keepScreenshot(named: guest ? "Guest Research" : "Free Research", from: app)
        app.buttons["research-recovery-action"].tap()
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        if guest { XCTAssertTrue(element(in: app, identifier: "account-welcome").exists) }
        else { XCTAssertTrue(app.staticTexts["Account"].exists) }
        close.tap()
        app.buttons["Search"].tap()
        let field = app.textFields["Search codes"]
        XCTAssertTrue(field.waitForExistence(timeout: 10))
        if app.buttons["Clear search"].exists { app.buttons["Clear search"].tap() }
        field.tap()
        field.typeText("1106.1")
        XCTAssertEqual(field.value as? String, "1106.1")
        let group = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "search-group-")).firstMatch
        XCTAssertTrue(group.waitForExistence(timeout: 45))
        group.tap()
        let result = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "search-result-")).firstMatch
        XCTAssertTrue(result.waitForExistence(timeout: 45))
        keepScreenshot(named: guest ? "Guest search results" : "Free search results", from: app)
        result.tap()
        XCTAssertTrue(app.buttons["Close passage"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.alerts["Upgrade to Pro"].exists, "Reading a search result must stay free.")
        keepScreenshot(named: guest ? "Guest enacted text" : "Free enacted text", from: app)
        let save = app.buttons["Save passage"]
        XCTAssertTrue(save.waitForExistence(timeout: 15))
        save.tap()
        XCTAssertTrue(app.alerts["Upgrade to Pro"].waitForExistence(timeout: 10))
        app.alerts.buttons["Not Now"].tap()
        let resumedReader = XCTNSPredicateExpectation(predicate: NSPredicate(format: "hittable == true"), object: app.buttons["Close passage"])
        XCTAssertEqual(XCTWaiter.wait(for: [resumedReader], timeout: 5), .completed)
        app.buttons["Close passage"].tap()
        XCTAssertEqual(field.value as? String, "1106.1")
    }

    func testMinimalWelcomeOffersExploreAndSignInOnly() {
        let app = XCUIApplication()
        app.launchArguments += ["--phase5-first-use-fixture"]
        app.launch()
        let sheet = element(in: app, identifier: "phase5-first-use-sheet")
        XCTAssertTrue(sheet.waitForExistence(timeout: 45), launchFailureDescription(in: app))
        XCTAssertTrue(app.staticTexts["Explore NYC construction codes and read the enacted text."].exists)
        XCTAssertTrue(element(in: app, identifier: "phase5-first-use-explore").isHittable)
        XCTAssertTrue(element(in: app, identifier: "phase5-first-use-sign-in").isHittable)
        XCTAssertFalse(element(in: app, identifier: "phase5-first-use-research-example").exists)
        let attachment = XCTAttachment(screenshot: app.screenshot(), quality: .original)
        attachment.name = "Minimal welcome"
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
            "Explore Permitext did not dismiss first use."
        )
        XCTAssertTrue(
            element(in: app, identifier: "reader-source-edition").waitForExistence(timeout: 10),
            "Explore Permitext did not return directly to the Reader source grid."
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
        app.buttons["Assistant history"].tap()
        let history = app.buttons.matching(identifier: "research-history-row").firstMatch
        XCTAssertTrue(history.waitForExistence(timeout: 5))
        history.tap()
        XCTAssertTrue(failures.firstMatch.waitForExistence(timeout: 5))
        XCTAssertEqual(questions.count, 1)
        XCTAssertEqual(diagnostics.value as? String, "requests:0:none")
        keepScreenshot(named: "Server-only Research failure restored once without request", from: app)
        app.buttons["Try again"].tap()
        let disclosure = app.buttons["Continue to Assistant"]
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
        app.buttons["Send message"].tap()
        let disclosure = app.buttons["Continue to Assistant"]
        if disclosure.waitForExistence(timeout: 2) { disclosure.tap() }
        let failure = app.staticTexts.matching(NSPredicate(
            format: "label == %@",
            "per codes could not confirm that the draft answer was supported by the cited sources, so it has not shown the draft. This does not mean your question cannot be answered. Try asking about one specific provision, or open the relevant code passage and ask from there. Your question is still here."
        )).firstMatch
        XCTAssertTrue(failure.waitForExistence(timeout: 10), app.debugDescription)
        app.buttons["Assistant history"].tap()
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

    func testChapterSelectionCrossesSubsectionsAndReachesAssistant() throws {
#if !DEBUG
        throw XCTSkip("Chapter selection uses the isolated Assistant fixture.")
#else
        let app = launchFixtureProjectReader()

        func paragraph(containing text: String) -> XCUIElement {
            app.textViews.matching(NSPredicate(format: "label CONTAINS[c] %@ OR value CONTAINS[c] %@", text, text)).firstMatch
        }
        let first = paragraph(containing: "This code shall be known")
        let second = paragraph(containing: "The provisions of this code shall apply")
        XCTAssertTrue(first.waitForExistence(timeout: 20) && first.isHittable)
        XCTAssertTrue(second.isHittable)
        XCTAssertTrue([first, second].contains { $0.identifier.hasPrefix("native-reader-text-group-") },
                      "Exercise cross-provision selection with grouped text.")
        let start = first.coordinate(withNormalizedOffset: CGVector(dx: 0.27, dy: 0.5))
        let end = second.coordinate(withNormalizedOffset: CGVector(dx: 0.58, dy: 0.22))
        start.press(forDuration: 0.6, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 0.1)
        keepScreenshot(named: "One selection across Building Code 101.1 and 101.2", from: app)

        let ask = app.menuItems["Ask Assistant"].firstMatch
        XCTAssertTrue(ask.waitForExistence(timeout: 10), app.debugDescription)
        ask.tap()
        let excerpts = app.buttons["2 selected passages"]
        XCTAssertTrue(excerpts.waitForExistence(timeout: 15), app.debugDescription)
        excerpts.tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "101.2 Scope")).firstMatch.exists)
        keepScreenshot(named: "Two selected passages in Assistant", from: app)
#endif
    }

    func testChapterSelectionSavesBothCitedExcerptsToProjectEvidence() throws {
#if !DEBUG
        throw XCTSkip("Chapter selection uses the isolated project fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--native-project-navigation-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))
        let project = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@",
                                                       "saved-folder-", "Acceptance Project")).firstMatch
        XCTAssertTrue(project.waitForExistence(timeout: 10))
        project.tap()
        XCTAssertTrue(element(in: app, identifier: "project-folder-root").waitForExistence(timeout: 10))
        openFixtureBuildingChapterOne(in: app)

        func paragraph(containing text: String) -> XCUIElement {
            app.textViews.matching(NSPredicate(format: "label CONTAINS[c] %@ OR value CONTAINS[c] %@", text, text)).firstMatch
        }
        let first = paragraph(containing: "This code shall be known")
        let second = paragraph(containing: "The provisions of this code shall apply")
        XCTAssertTrue(first.wait(for: \.isHittable, toEqual: true, timeout: 20))
        if !second.isHittable {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.70))
                .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.54)),
                       withVelocity: .slow, thenHoldForDuration: 0)
        }
        XCTAssertTrue(first.isHittable && second.isHittable)
        XCTAssertTrue([first, second].contains { $0.identifier.hasPrefix("native-reader-text-group-") },
                      "Exercise cross-provision selection with grouped text.")
        let start = first.coordinate(withNormalizedOffset: CGVector(dx: 0.27, dy: 0.5))
        let end = second.coordinate(withNormalizedOffset: CGVector(dx: 0.58, dy: 0.22))
        start.press(forDuration: 0.6, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 0.1)

        let save = app.menuItems["Save to Evidence"].firstMatch
        XCTAssertTrue(save.waitForExistence(timeout: 8), app.debugDescription)
        XCTAssertTrue(app.menuItems["Copy"].exists)
        XCTAssertTrue(app.menuItems["Ask Assistant"].exists)
        save.tap()

        app.buttons["main-tab-saved"].tap()
        let evidence = app.buttons["project-section-evidence"]
        XCTAssertTrue(evidence.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertEqual(evidence.label, "Evidence")
        reveal(evidence, in: app)
        evidence.tap()
        XCTAssertTrue(app.navigationBars["Evidence"].waitForExistence(timeout: 10))

        let rows = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "project-bookmark-"))
        let title = rows.matching(NSPredicate(format: "label CONTAINS %@", "101.1")).firstMatch
        let scope = rows.matching(NSPredicate(format: "label CONTAINS %@", "101.2")).firstMatch
        XCTAssertTrue(title.waitForExistence(timeout: 10) && scope.exists, app.debugDescription)
        XCTAssertFalse(title.label.contains("This code shall be known"), title.label)
        XCTAssertTrue(title.label.contains("designation \"BC\"."), title.label)
        XCTAssertTrue(scope.label.contains("101.2 Scope.") && scope.label.contains("The provisions"), scope.label)
        title.tap()
        XCTAssertTrue(app.staticTexts["Saved selection"].waitForExistence(timeout: 10), app.debugDescription)
#endif
    }

    func testChapterSelectionHandlesCrossSubsectionsAndCanBeAdjustedAgain() throws {
#if !DEBUG
        throw XCTSkip("Chapter selection uses the isolated Assistant fixture.")
#else
        let app = XCUIApplication()
        app.launchArguments = ["--phase3-entitled-research-fixture", "--permitext-disable-clerk"]
        app.launch()
        XCTAssertTrue(element(in: app, identifier: "phase3-research-fixture-ready").waitForExistence(timeout: 45))

        func paragraph(containing text: String) -> XCUIElement {
            app.textViews.matching(NSPredicate(format: "label CONTAINS[c] %@ OR value CONTAINS[c] %@", text, text)).firstMatch
        }
        let first = paragraph(containing: "This code shall be known")
        let second = paragraph(containing: "The provisions of this code shall apply")
        XCTAssertTrue(first.wait(for: \.isHittable, toEqual: true, timeout: 20) && second.isHittable)
        let firstFrame = first.frame
        let screen = app.coordinate(withNormalizedOffset: .zero)
        screen.withOffset(CGVector(dx: firstFrame.minX + firstFrame.width * 0.28,
                                   dy: firstFrame.minY + firstFrame.height * 0.42)).doubleTap()

        let start = element(in: app, identifier: "reader-selection-start-handle")
        let end = element(in: app, identifier: "reader-selection-end-handle")
        XCTAssertTrue(end.wait(for: \.isHittable, toEqual: true, timeout: 8), app.debugDescription)

        func scrollAwayAndBack() {
            let originalY = first.frame.minY
            let bottom = app.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.75))
            let top = app.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.24))
            bottom.press(forDuration: 0.05, thenDragTo: top, withVelocity: .slow, thenHoldForDuration: 0)
            XCTAssertTrue(!first.isHittable || first.frame.minY < originalY - 120,
                          "The scroll must move the selected text out of view.")
            top.press(forDuration: 0.05, thenDragTo: bottom, withVelocity: .slow, thenHoldForDuration: 0)
            XCTAssertTrue(start.wait(for: \.isHittable, toEqual: true, timeout: 8), app.debugDescription)
            XCTAssertTrue(end.isHittable)
        }

        scrollAwayAndBack()
        let upperLine = second.coordinate(withNormalizedOffset: CGVector(dx: 0.45, dy: 0.24))
        end.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            .press(forDuration: 0.05, thenDragTo: upperLine, withVelocity: .slow, thenHoldForDuration: 0)
        XCTAssertTrue(end.wait(for: \.isHittable, toEqual: true, timeout: 8))
        XCTAssertGreaterThan(end.frame.midY, second.frame.minY)
        scrollAwayAndBack()
        let newY = end.frame.midY
        XCTAssertGreaterThan(newY, second.frame.minY, "Scrolling must preserve the end in the second subsection.")
        let ask = app.menuItems["Ask Assistant"].firstMatch
        XCTAssertFalse(ask.exists, "Scrolling should dismiss the menu while keeping the selection.")
        let secondFrame = second.frame
        screen.withOffset(CGVector(dx: secondFrame.minX + secondFrame.width * 0.18,
                                   dy: secondFrame.minY + secondFrame.height * 0.08)).tap()
        XCTAssertTrue(ask.waitForExistence(timeout: 8), app.debugDescription)

        let lowerLine = second.coordinate(withNormalizedOffset: CGVector(dx: 0.55, dy: 0.7))
        end.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            .press(forDuration: 0.05, thenDragTo: lowerLine, withVelocity: .slow, thenHoldForDuration: 0)
        XCTAssertTrue(end.wait(for: \.isHittable, toEqual: true, timeout: 8))
        XCTAssertGreaterThan(end.frame.midY, newY + 8)
        XCTAssertTrue(start.isHittable)
        let startY = start.frame.midY
        let endY = end.frame.midY
        let earlierLine = first.coordinate(withNormalizedOffset: CGVector(dx: 0.45, dy: 0.12))
        start.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            .press(forDuration: 0.05, thenDragTo: earlierLine, withVelocity: .slow, thenHoldForDuration: 0)
        XCTAssertTrue(start.wait(for: \.isHittable, toEqual: true, timeout: 8))
        XCTAssertLessThan(start.frame.midY, startY - 8)
        XCTAssertEqual(end.frame.midY, endY, accuracy: 1)
        keepScreenshot(named: "Chapter selection adjusted with both handles", from: app)

        XCTAssertTrue(ask.waitForExistence(timeout: 10), app.debugDescription)
        ask.tap()
        let excerpts = app.buttons["2 selected passages"]
        XCTAssertTrue(excerpts.waitForExistence(timeout: 15), app.debugDescription)
        // The isolated backend uses a fixed citation label. Test its separate excerpts here,
        // with the distinct source IDs covered by the chapter selection resolver test.
        let firstExcerpt = app.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", "designation \"BC\".")).firstMatch
        if !firstExcerpt.exists { excerpts.tap() }
        XCTAssertTrue(firstExcerpt.waitForExistence(timeout: 5), app.debugDescription)
        let secondExcerpt = app.staticTexts.containing(NSPredicate(format: "label BEGINSWITH %@", "101.2 Scope.\nThe provisions")).firstMatch
        XCTAssertTrue(secondExcerpt.waitForExistence(timeout: 5), app.debugDescription)
        keepScreenshot(named: "Both excerpts after adjusting the selection handles", from: app)
#endif
    }

    func testChapterSelectionHandleScrollsBeyondTheViewport() {
        let app = XCUIApplication()
        app.launchArguments = ["--permitext-disable-clerk", "--native-reader-2014-building-chapter-7"]
        app.launch()
        let firstPassage = app.textViews.matching(NSPredicate(
            format: "label BEGINSWITH %@", "The provisions of this chapter shall govern"
        )).firstMatch
        XCTAssertTrue(firstPassage.wait(for: \.isHittable, toEqual: true, timeout: 30))
        let passageFrame = firstPassage.frame
        let nextPassage = app.textViews.matching(NSPredicate(
            format: "label BEGINSWITH %@", "The following words and terms shall"
        )).firstMatch
        XCTAssertTrue(nextPassage.isHittable)
        let nextFrame = nextPassage.frame
        let screen = app.coordinate(withNormalizedOffset: .zero)
        let first = screen.withOffset(CGVector(dx: passageFrame.midX, dy: passageFrame.midY))
        let next = screen.withOffset(CGVector(dx: nextFrame.midX, dy: nextFrame.midY))
        // Once the selection spans two blocks, re-grab the handle and extend it past the viewport.
        first.press(forDuration: 0.65, thenDragTo: next, withVelocity: .slow, thenHoldForDuration: 0)

        let end = element(in: app, identifier: "reader-selection-end-handle")
        XCTAssertTrue(end.wait(for: \.isHittable, toEqual: true, timeout: 8))
        XCTAssertGreaterThan(end.frame.midY, nextFrame.minY)
        let edge = app.coordinate(withNormalizedOffset: CGVector(dx: 0.51, dy: 0.96))
        end.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            .press(forDuration: 0.05, thenDragTo: edge, withVelocity: .slow, thenHoldForDuration: 1.4)

        XCTAssertTrue(app.menuItems["Copy"].firstMatch.waitForExistence(timeout: 8), app.debugDescription)
        XCTAssertTrue(!firstPassage.isHittable || firstPassage.frame.minY < passageFrame.minY - 120,
                      "Holding a selection handle near the edge must continue scrolling the chapter.")
        keepScreenshot(named: "Chapter 7 selection extends through edge scrolling", from: app)
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

        app.buttons["Assistant actions"].tap()
        let projectContext = element(in: app, identifier: "research-project-context-menu")
        XCTAssertTrue(projectContext.waitForExistence(timeout: 5), "Active Project context is not visible.")
        XCTAssertTrue(
            projectContext.label.localizedCaseInsensitiveContains("Acceptance Project"),
            "Research did not begin in the active Acceptance Project; label was \(projectContext.label)."
        )
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.05, dy: 0.55)).tap()

        composer.tap()
        composer.typeText("What does this enacted provision establish?")
        let send = app.buttons["Send message"]
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
        if sourcesAndDetails.value as? String == "Collapsed" {
            reveal(sourcesAndDetails, in: app)
            sourcesAndDetails.tap()
        }
        if !citation.exists {
            let citedSources = app.buttons["Cited sources"]
            reveal(citedSources, in: app)
            citedSources.tap()
        }
        reveal(citation, in: app)
        XCTAssertTrue(citation.isHittable, "The answer citation could not be reached.")
        citation.tap()

        XCTAssertTrue(
            app.navigationBars["101.1"].waitForExistence(timeout: 30),
            "Opening the Research citation did not show the exact cited passage.\n\(app.debugDescription)"
        )
        XCTAssertTrue(
            app.buttons["Open passage in a permanent Reader"].exists,
            "The citation preview cannot be opened in Reader."
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

        XCTAssertTrue(
            passageHeading(for: expectedDestination, in: app).waitForExistence(timeout: 10),
            "Tapping the visible \(name) link did not navigate to \(expectedDestination)."
        )

        let destinationScreenshot = XCTAttachment(screenshot: app.screenshot(), quality: .original)
        destinationScreenshot.name = "\(name) opened \(expectedDestination)"
        destinationScreenshot.lifetime = .keepAlways
        add(destinationScreenshot)
    }

    private func openChapterSections(in app: XCUIApplication) {
        let sections = app.buttons["chapter-sections-toolbar"]
        XCTAssertTrue(sections.waitForExistence(timeout: 10), "Sections is unavailable in the Reader toolbar.")
        sections.tap()
        XCTAssertTrue(app.buttons["chapter-sections-close"].waitForExistence(timeout: 10))
    }

    private func jumpToSection(_ sectionNumber: String, in app: XCUIApplication) {
        let chapterTitle = app.staticTexts["reader-chapter-title"]
        openChapterSections(in: app)

        let target = app.buttons
            .matching(NSPredicate(format: "label BEGINSWITH[c] %@", "\(sectionNumber) "))
            .firstMatch
        for _ in 0..<20 where !target.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(target.isHittable, "Fuel Gas \(sectionNumber) is unavailable in the jump picker.")
        target.tap()

        XCTAssertTrue(
            waitForValueContaining(sectionNumber, on: chapterTitle),
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

    private func passageHeading(for sectionNumber: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "identifier == %@ AND label BEGINSWITH %@", "passage-section-title", sectionNumber))
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

    private func assertFloatingMenuWidth(_ frame: CGRect, in app: XCUIApplication, file: StaticString = #filePath, line: UInt = #line) {
        guard #available(iOS 26.0, *), UIDevice.current.userInterfaceIdiom == .phone else { return }
        // The visible edges of the four-button iPhone glass bar are 21 points in.
        XCTAssertEqual(frame.minX, app.frame.minX + 21, accuracy: 1, file: file, line: line)
        XCTAssertEqual(frame.maxX, app.frame.maxX - 21, accuracy: 1, file: file, line: line)
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
        XCTAssertTrue(app.staticTexts["Limits of this answer"].exists)
        let reviewDetails = app.buttons["Review details"]
        reveal(reviewDetails, in: app)
        XCTAssertTrue(reviewDetails.isHittable)
        reviewDetails.tap()
        let expectedHeadings = [
            "What the cited evidence establishes",
            "Assumptions used",
            "Questions that would materially advance this answer",
            "Related evidence to add"
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

    func testRealProAccountColdStartKeepsAccess() {
        let app = XCUIApplication()
        // Exercise the installed account and normal lifecycle. No synthetic
        // entitlement, authentication bypass, purchases, or content writes.
        app.launchArguments = []
        app.launchEnvironment = [:]
        let deniedLabels = ["Saved work requires Pro", "Assistant requires Pro", "View Plans", "Account type: Free"]
        func assertNoPaywall(_ stage: String) {
            let denied = app.descendants(matching: .any).matching(NSPredicate(format: "label IN %@", deniedLabels)).firstMatch
            XCTAssertFalse(denied.exists, "Real Pro account unexpectedly showed a lock or Free plan during \(stage)")
        }

        for launch in 1...2 {
            app.terminate()
            app.launch()
            let saved = app.buttons["main-tab-saved"]
            XCTAssertTrue(saved.waitForExistence(timeout: 45), "Normal app navigation must load for cold start \(launch)")
            saved.tap()
            // Sample repeatedly as soon as normal Saved navigation is reachable;
            // don't wait for entitlement resolution before checking for a flash.
            for sample in 1...12 {
                assertNoPaywall("cold start \(launch), early Saved sample \(sample)")
                if sample == 1 { keepScreenshot(named: "Real Pro cold start \(launch) early Saved", from: app) }
                Thread.sleep(forTimeInterval: 0.2)
            }
            let savedContent = element(in: app, identifier: "projects-root")
            XCTAssertTrue(savedContent.waitForExistence(timeout: 30), "Real Pro Saved content must become available; checking/unavailable is not a pass")
            XCTAssertFalse(element(in: app, identifier: "native-entitlement-status").exists)
            assertNoPaywall("cold start \(launch), loaded Saved")
            keepScreenshot(named: "Real Pro cold start \(launch) Saved access", from: app)

            let research = app.buttons["main-tab-research"]
            XCTAssertTrue(research.isHittable)
            research.tap()
            let researchContent = app.descendants(matching: .any).matching(NSPredicate(
                format: "identifier IN %@", ["research-history-list", "research-composer"])).firstMatch
            XCTAssertTrue(researchContent.waitForExistence(timeout: 30), "Real Pro Research history or composer must load without sending a question")
            XCTAssertFalse(element(in: app, identifier: "native-entitlement-status").exists)
            assertNoPaywall("cold start \(launch), Research")
            keepScreenshot(named: "Real Pro cold start \(launch) Research access", from: app)

            saved.tap()
            let account = app.buttons["Open Account"]
            XCTAssertTrue(account.waitForExistence(timeout: 10))
            XCTAssertTrue(account.isHittable)
            account.tap()
            let closeAccount = app.buttons["account-close"]
            XCTAssertTrue(closeAccount.waitForExistence(timeout: 10))
            let exactPro = app.staticTexts.matching(NSPredicate(format: "label == %@", "Account type: Pro")).firstMatch
            reveal(exactPro, in: app)
            XCTAssertTrue(exactPro.exists && exactPro.isHittable, "The real Account plan must explicitly identify Account type: Pro")
            XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label == %@", "Free")).firstMatch.exists)
            assertNoPaywall("cold start \(launch), Account plan")
            keepScreenshot(named: "Real Pro cold start \(launch) Account exact Pro", from: app)
            closeAccount.tap()
            XCTAssertTrue(waitForNonexistence(closeAccount))
            saved.tap()
            XCTAssertTrue(savedContent.waitForExistence(timeout: 10))
            assertNoPaywall("cold start \(launch), returned Saved")
        }
        keepScreenshot(named: "Real Pro verified twice, normal Saved left open", from: app)
    }

    func testNativeInitialEntitlementPresentationWaitsForPro() {
        let app = XCUIApplication()
        app.launchArguments += ["--permitext-disable-clerk", "--phase3-entitled-research-fixture", "--native-entitlement-delayed-fixture"]
        app.launch()
        let saved = app.buttons["main-tab-saved"]
        XCTAssertTrue(saved.waitForExistence(timeout: 45))
        saved.tap()
        let pending = element(in: app, identifier: "native-entitlement-status")
        XCTAssertTrue(pending.waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["Saved work requires Pro"].exists)
        XCTAssertFalse(app.buttons["View Plans"].exists)
        keepScreenshot(named: "Entitlement pending Saved", from: app)

        app.buttons["main-tab-research"].tap()
        XCTAssertTrue(pending.waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["Assistant requires Pro"].exists)
        keepScreenshot(named: "Entitlement pending Research", from: app)

        app.buttons["native-entitlement-fixture-plan"].tap()
        let close = app.buttons["account-close"]
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        XCTAssertTrue(pending.waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["Account type: Free"].exists)
        XCTAssertFalse(app.staticTexts["Free"].exists)
        keepScreenshot(named: "Entitlement pending Plan", from: app)
        close.tap()
        XCTAssertTrue(waitForNonexistence(close))

        app.buttons["native-entitlement-fixture-release"].tap()
        XCTAssertTrue(waitForNonexistence(pending, timeout: 15))
        XCTAssertFalse(app.staticTexts["Assistant requires Pro"].exists)
        saved.tap()
        XCTAssertFalse(pending.exists)
        XCTAssertFalse(app.staticTexts["Saved work requires Pro"].exists)
        app.buttons["native-entitlement-fixture-plan"].tap()
        XCTAssertTrue(close.waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Pro"].firstMatch.waitForExistence(timeout: 10))
        XCTAssertFalse(pending.exists)
        XCTAssertFalse(app.staticTexts["Free"].exists)
        keepScreenshot(named: "Entitlement authoritative Pro", from: app)
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
