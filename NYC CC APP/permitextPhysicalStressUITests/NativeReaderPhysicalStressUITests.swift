import XCTest

final class NativeReaderPhysicalStressUITests: XCTestCase {
    private let bookmarkIdentifier = "reader-current-section-bookmark"
    private let savedRowIdentifierPrefix = "projects-bookmark-"

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 7_200
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

    func testPhase3EntitledReaderResearchJourney() {
        let app = XCUIApplication()
        app.launchArguments += [
            "--phase3-entitled-research-fixture",
            "--native-reader-rollout-stage",
            "isolated-table-fallback"
        ]
        app.launch()

        XCTAssertTrue(
            element(in: app, identifier: "native-reader-ready").waitForExistence(timeout: 45),
            phase3LaunchFailureDescription(in: app)
        )

        // Section 101.1 is the fixture's initial jump target. Native Reader's
        // attributed UITextViews intentionally expose selectable runs rather
        // than duplicating the complete text as one accessibility value; the
        // first substantive paragraph at that deterministic viewport is 101.1.
        let enactedPassage = app.textViews.element(boundBy: 3)
        XCTAssertTrue(
            enactedPassage.waitForExistence(timeout: 15) && enactedPassage.isHittable,
            "Building Code 101.1 enacted text was not exposed as selectable Reader text.\n\(app.debugDescription)"
        )
        enactedPassage.press(forDuration: 1.1)

        let selectAll = app.menuItems["Select All"]
        if selectAll.waitForExistence(timeout: 2) {
            selectAll.tap()
        }
        var researchSelectionAction = app.menuItems["Research"]
        if !researchSelectionAction.exists {
            let nextMenuPage = app.buttons["Forward"]
            if nextMenuPage.waitForExistence(timeout: 2) {
                nextMenuPage.tap()
                researchSelectionAction = app.buttons["Research"]
            }
        }
        XCTAssertTrue(
            researchSelectionAction.waitForExistence(timeout: 5),
            "The native Reader selection menu did not expose Research.\n\(app.debugDescription)"
        )
        researchSelectionAction.tap()

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

    private func element(in app: XCUIApplication, identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
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
