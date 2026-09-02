import Foundation
import XCTest
@testable import NativeReaderInventoryCore

final class CorpusInventoryGeneratorTests: XCTestCase {
    private var temporaryDirectories: [URL] = []

    override func tearDownWithError() throws {
        for url in temporaryDirectories {
            try? FileManager.default.removeItem(at: url)
        }
        temporaryDirectories.removeAll()
    }

    func testDOMInventoryPreservesAnchorsListsTableLinksAndImageMetadata() throws {
        let root = try makeTemporaryDirectory()
        let chapters = root.appendingPathComponent("sample-package/chapters", isDirectory: true)
        let assets = root.appendingPathComponent("sample-package/assets", isDirectory: true)
        let prepared = root.appendingPathComponent("sample-package/prepared", isDirectory: true)
        try FileManager.default.createDirectory(at: chapters, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: assets, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: prepared, withIntermediateDirectories: true)
        try Data([0x89, 0x50, 0x4E, 0x47]).write(to: assets.appendingPathComponent("figure.png"))
        try JSONSerialization.data(
            withJSONObject: ["schemaVersion": 1, "items": ["figure": "assets/figure.png"]],
            options: [.prettyPrinted, .sortedKeys]
        ).write(to: prepared.appendingPathComponent("images.json"))
        let chapterURL = chapters.appendingPathComponent("1.html")
        try """
        <html><body>
          <section id="section-101"><h2><a id="anchor-101" href="#target">101 General</a></h2>
            <p>Exact enacted text.</p>
            <ol><li>First<ul><li>Nested</li></ul></li></ol>
            <figure class="code-figure"><span class="img"><img src="../assets/figure.jpg" width="640" height="480" alt="Diagram"></span><figcaption>Figure caption</figcaption></figure>
            <p class="code-figure"><span class="img"><img src="../assets/figure.jpg" width="320" height="240" alt="Nested diagram"></span></p>
            <table><caption>Simple table</caption><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>
          </section>
        </body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let chapter = CorpusInventoryGenerator().analyzeChapter(fileURL: chapterURL, sourceRoot: root)

        XCTAssertTrue(chapter.parserSucceeded)
        XCTAssertEqual(chapter.stableAnchors.map(\.id), ["section-101", "anchor-101"])
        XCTAssertEqual(chapter.headingHierarchy.first?.level, 2)
        XCTAssertEqual(chapter.lists.orderedListCount, 1)
        XCTAssertEqual(chapter.lists.unorderedListCount, 1)
        XCTAssertEqual(chapter.lists.maximumDepth, 2)
        XCTAssertEqual(chapter.tables.first?.rowCount, 2)
        XCTAssertEqual(chapter.tables.first?.logicalColumnCount, 2)
        XCTAssertEqual(chapter.tables.first?.renderingClassification, .nativeSimple)
        XCTAssertEqual(chapter.images.first?.caption, "Figure caption")
        XCTAssertEqual(chapter.images.first?.accessibilityText, "Diagram")
        XCTAssertEqual(chapter.images.first?.assetExists, true)
        XCTAssertEqual(chapter.images.first?.resolvedAssetPath, "sample-package/assets/figure.png")
        XCTAssertTrue(chapter.unknownClassNames.isEmpty)
        XCTAssertEqual(chapter.eligibility.state, .native)
        XCTAssertEqual(chapter.links.first?.target, "#target")
        XCTAssertNotNil(chapter.normalizedTextSHA256)

        let document = try NativeReaderChapterDocumentGenerator().generate(
            fileURL: chapterURL,
            sourceRoot: root,
            inventory: chapter
        )
        XCTAssertEqual(document.blocks.flatMap(\.media).count, 2)
        XCTAssertEqual(document.blocks.flatMap(\.media).map(\.accessibilityText), ["Diagram", "Nested diagram"])
        XCTAssertTrue(document.validation.imageInventoryMatches)
        XCTAssertEqual(NativeReaderRolloutTier(blocks: document.blocks), .nativeTable)
    }

    func testComplexTableAndUnknownMarkupReceiveExplicitFallbackClassification() throws {
        let root = try makeTemporaryDirectory()
        let chapters = root.appendingPathComponent("sample-package/chapters", isDirectory: true)
        try FileManager.default.createDirectory(at: chapters, withIntermediateDirectories: true)
        let chapterURL = chapters.appendingPathComponent("2.html")
        try """
        <html><body><h2 id="two">Two</h2><mystery-widget class="unreviewed-variant">
        <table><tr><th colspan="2">Header</th></tr><tr><td>A</td><td>B</td></tr></table>
        </mystery-widget></body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let chapter = CorpusInventoryGenerator().analyzeChapter(fileURL: chapterURL, sourceRoot: root)

        XCTAssertEqual(chapter.tables.first?.renderingClassification, .nativeComplex)
        XCTAssertEqual(chapter.tables.first?.classificationReasons, ["mergedCells"])
        XCTAssertEqual(chapter.unknownElementNames, ["mystery-widget"])
        XCTAssertEqual(chapter.unknownClassNames, ["unreviewed-variant"])
        XCTAssertEqual(chapter.eligibility.state, .fullHTMLFallback)
        XCTAssertTrue(chapter.eligibility.reasons.contains { $0.contains("unknownElements") })
    }

    func testMergedHeadersAndInlineLegalFormattingUseNativeComplexTable() throws {
        let root = try makeTemporaryDirectory()
        let chapters = root.appendingPathComponent("sample-package/chapters", isDirectory: true)
        try FileManager.default.createDirectory(at: chapters, withIntermediateDirectories: true)
        let chapterURL = chapters.appendingPathComponent("native-complex.html")
        try """
        <html><body><h2 id="native-complex">Native complex table</h2>
        <table><caption>TABLE 705.8<br>MAXIMUM AREA OF OPENINGS<sup>m</sup></caption>
          <tr><th rowspan="2">Distance</th><th colspan="2"><strong>Allowable area</strong></th></tr>
          <tr><th>Protected<sup>a</sup></th><th>Unprotected<br>sprinklered</th></tr>
          <tr><td>0 to less than 3</td><td>Not permitted</td><td>Not permitted</td></tr>
        </table></body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let generator = CorpusInventoryGenerator()
        let chapter = generator.analyzeChapter(fileURL: chapterURL, sourceRoot: root)
        let document = try NativeReaderChapterDocumentGenerator().generate(
            fileURL: chapterURL,
            sourceRoot: root,
            inventory: chapter
        )

        XCTAssertEqual(chapter.tables.first?.renderingClassification, .nativeComplex)
        XCTAssertEqual(chapter.tables.first?.caption, "TABLE 705.8\nMAXIMUM AREA OF OPENINGSᵐ")
        XCTAssertEqual(
            Set(chapter.tables.first?.classificationReasons ?? []),
            Set(["mergedCells", "multiRowHeader", "formattedCells"])
        )
        XCTAssertEqual(chapter.eligibility.state, .native)
        XCTAssertEqual(chapter.eligibility.reasons, [])
        let table = try XCTUnwrap(document.blocks.compactMap(\.table).first)
        XCTAssertEqual(table.caption, "TABLE 705.8\nMAXIMUM AREA OF OPENINGSᵐ")
        XCTAssertEqual(table.renderingClassification, .nativeComplex)
        XCTAssertNil(table.sourceHTML)
        XCTAssertEqual(table.cells.first?.rowSpan, 2)
        XCTAssertEqual(table.cells.dropFirst().first?.columnSpan, 2)
        XCTAssertTrue(table.cells.flatMap(\.runs).contains { $0.styles.contains(.superscript) })
        XCTAssertEqual(NativeReaderRolloutTier(blocks: document.blocks), .nativeTable)
    }

    func testWideSemanticTableUsesHorizontallyScrollableNativeComplexLayout() throws {
        let root = try makeTemporaryDirectory()
        let chapters = root.appendingPathComponent("sample-package/chapters", isDirectory: true)
        try FileManager.default.createDirectory(at: chapters, withIntermediateDirectories: true)
        let chapterURL = chapters.appendingPathComponent("wide-native.html")
        try """
        <html><body><h2>Wide native table</h2><table>
          <tr><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th><th>F</th><th>G</th></tr>
          <tr><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td></tr>
        </table></body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let generator = CorpusInventoryGenerator()
        let chapter = generator.analyzeChapter(fileURL: chapterURL, sourceRoot: root)
        let document = try NativeReaderChapterDocumentGenerator().generate(
            fileURL: chapterURL,
            sourceRoot: root,
            inventory: chapter
        )

        XCTAssertEqual(chapter.tables.first?.logicalColumnCount, 7)
        XCTAssertEqual(chapter.tables.first?.classificationReasons, ["wideTable"])
        XCTAssertEqual(chapter.tables.first?.renderingClassification, .nativeComplex)
        XCTAssertEqual(chapter.eligibility.state, .native)
        XCTAssertNil(document.blocks.compactMap(\.table).first?.sourceHTML)
        XCTAssertEqual(NativeReaderRolloutTier(blocks: document.blocks), .nativeTable)
    }

    func testComplexTableContainsUnknownFormattingInsideIsolatedBoundary() throws {
        let root = try makeTemporaryDirectory()
        let chapters = root.appendingPathComponent("sample-package/chapters", isDirectory: true)
        try FileManager.default.createDirectory(at: chapters, withIntermediateDirectories: true)
        let chapterURL = chapters.appendingPathComponent("isolated.html")
        try """
        <html><body><h2 id="isolated">Isolated table</h2><p>Supported chapter text.</p>
        <table style="border-collapse: collapse"><caption>Exact caption</caption>
          <tr><th colspan="2">Header</th></tr>
          <tr><td class="unreviewed-cell" style="mystery-property: value">A</td><td>B</td></tr>
          <tfoot><tr><td colspan="2" class="table-footnote">Exact footnote</td></tr></tfoot>
        </table></body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let generator = CorpusInventoryGenerator()
        let chapter = generator.analyzeChapter(fileURL: chapterURL, sourceRoot: root)
        let document = try NativeReaderChapterDocumentGenerator().generate(
            fileURL: chapterURL,
            sourceRoot: root,
            inventory: chapter
        )

        XCTAssertEqual(chapter.unknownClassNames, ["unreviewed-cell"])
        XCTAssertEqual(chapter.unsupportedCSSProperties, ["mystery-property"])
        XCTAssertEqual(chapter.tables.first?.renderingClassification, .isolatedHTML)
        XCTAssertEqual(chapter.eligibility.state, .nativeWithTableFallback)
        XCTAssertEqual(chapter.eligibility.reasons, ["isolatedHTMLTableCount: 1"])
        XCTAssertEqual(document.eligibility, chapter.eligibility)
        XCTAssertEqual(document.validation.unsupportedBlockCount, 0)
        XCTAssertTrue(document.validation.passesStructuralValidation)
        let table = try XCTUnwrap(document.blocks.compactMap(\.table).first)
        XCTAssertEqual(table.caption, "Exact caption")
        XCTAssertEqual(table.footnotes, ["Exact footnote"])
        XCTAssertTrue(table.sourceHTML?.contains("unreviewed-cell") == true)
        XCTAssertTrue(table.sourceHTML?.contains("mystery-property") == true)
        XCTAssertEqual(NativeReaderRolloutTier(blocks: document.blocks), .isolatedTableFallback)
    }

    func testOversizedIsolatedTableKeepsChapterNativeWithContainedTableFallback() throws {
        let root = try makeTemporaryDirectory()
        let chapters = root.appendingPathComponent("sample-package/chapters", isDirectory: true)
        try FileManager.default.createDirectory(at: chapters, withIntermediateDirectories: true)
        let chapterURL = chapters.appendingPathComponent("oversized.html")
        let rows = (0...250).map { "<tr><td style='border: 1px solid black'>\($0)</td></tr>" }.joined()
        try "<html><body><h2>Oversized</h2><table>\(rows)</table></body></html>"
            .write(to: chapterURL, atomically: true, encoding: .utf8)

        let chapter = CorpusInventoryGenerator().analyzeChapter(fileURL: chapterURL, sourceRoot: root)

        XCTAssertEqual(chapter.tables.first?.rowCount, 251)
        XCTAssertEqual(chapter.tables.first?.renderingClassification, .isolatedHTML)
        XCTAssertEqual(chapter.eligibility.state, .nativeWithTableFallback)
        XCTAssertEqual(chapter.eligibility.reasons, ["isolatedHTMLTableCount: 1"])
    }

    func testGenerationDiscoversOnlyNonPreparedChapterHTMLAndIsDeterministic() throws {
        let root = try makeTemporaryDirectory()
        let authoredChapter = root.appendingPathComponent("package/chapters/A.html")
        let codeSectionChapter = root.appendingPathComponent("package/code-sections/family/chapters/1.html")
        let preparedChapter = root.appendingPathComponent("package/prepared/chapters/ignored.html")
        for url in [authoredChapter, codeSectionChapter, preparedChapter] {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try "<html><body><h2 id='anchor'>Chapter</h2><p>Text</p></body></html>"
                .write(to: url, atomically: true, encoding: .utf8)
        }

        let generator = CorpusInventoryGenerator()
        let first = try generator.generate(sourceRoot: root, reportedSourceRoot: "fixture")
        let second = try generator.generate(sourceRoot: root, reportedSourceRoot: "fixture")

        XCTAssertEqual(first, second)
        XCTAssertEqual(first.summary.chapterCount, 2)
        XCTAssertEqual(first.chapters.map(\.relativePath), [
            "package/chapters/A.html",
            "package/code-sections/family/chapters/1.html"
        ])
        XCTAssertEqual(first.chapters.last?.codeFamily, "package/family")
        XCTAssertEqual(
            try CorpusInventoryGenerator.encodedJSON(first),
            try CorpusInventoryGenerator.encodedJSON(second)
        )
    }

    func testDuplicateAnchorsAndMissingAssetsStayNativeWithExplicitAuditMetadata() throws {
        let root = try makeTemporaryDirectory()
        let chapterURL = root.appendingPathComponent("package/chapters/1.html")
        try FileManager.default.createDirectory(at: chapterURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try """
        <html><body><h2 id="duplicate">One</h2><p id="duplicate">Text</p><img src="../assets/missing.png"></body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let chapter = CorpusInventoryGenerator().analyzeChapter(fileURL: chapterURL, sourceRoot: root)

        XCTAssertEqual(chapter.duplicateAnchorIDs, ["duplicate"])
        XCTAssertEqual(chapter.images.first?.assetExists, false)
        XCTAssertEqual(chapter.eligibility.state, .native)
        XCTAssertTrue(chapter.eligibility.reasons.isEmpty)
        XCTAssertTrue(chapter.parserMessages.contains("Duplicate stable anchor IDs were found"))
        XCTAssertTrue(chapter.parserMessages.contains("One or more referenced media assets could not be resolved"))
    }

    func testKnownLegacyPresentationMarkupAndInterCodeLinkRemainNative() throws {
        let root = try makeTemporaryDirectory()
        let chapterURL = root.appendingPathComponent("sample-package/chapters/1.html")
        try FileManager.default.createDirectory(
            at: chapterURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try """
        <html><body><center><p class="Small MsoNormal pseudo-li sec-link-inline" style="margin-bottom=10pt;counter-reset:item">
        Refer to <InterCodeLink destinationId="JD_1403">1403</InterCodeLink> of the Charter.
        </p></center></body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let inventory = CorpusInventoryGenerator().analyzeChapter(fileURL: chapterURL, sourceRoot: root)
        let document = try NativeReaderChapterDocumentGenerator().generate(
            fileURL: chapterURL,
            sourceRoot: root,
            inventory: inventory
        )

        XCTAssertTrue(inventory.unknownElementNames.isEmpty)
        XCTAssertTrue(inventory.unknownClassNames.isEmpty)
        XCTAssertTrue(inventory.unsupportedCSSProperties.isEmpty)
        XCTAssertEqual(inventory.eligibility.state, .native)
        XCTAssertEqual(document.links.map(\.target), ["#JD_1403"])
        XCTAssertTrue(document.blocks.flatMap(\.runs).contains {
            $0.text == "1403" && $0.linkTarget == "#JD_1403"
        })
        XCTAssertTrue(document.validation.passesStructuralValidation)
        XCTAssertEqual(document.validation.unsupportedBlockCount, 0)
    }

    func testPermitextExplicitLegalListsAndEquationsRemainNativeWithoutDuplicateMarkers() throws {
        let root = try makeTemporaryDirectory()
        let chapterURL = root.appendingPathComponent("sample-package/chapters/10.html")
        try FileManager.default.createDirectory(
            at: chapterURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try """
        <html><body>
          <p>Applicable conditions:</p>
          <ol class="code-explicit-list"><li><p>1. First condition.</p></li>
            <li><p>2. Second condition:</p>
              <ol class="code-explicit-list"><li><p>2.1. Nested condition.</p></li></ol>
            </li>
          </ol>
          <div class="code-equation"><span class="code-equation-formula">A = B + C</span><span class="code-equation-label">(Equation 1)</span></div>
          <p class="code-equation-where">where:</p>
          <div class="code-definition"><span class="code-definition-term">A</span><span class="code-definition-equals">=</span><span class="code-definition-text">Total area.</span></div>
        </body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let inventory = CorpusInventoryGenerator().analyzeChapter(
            fileURL: chapterURL,
            sourceRoot: root
        )
        let document = try NativeReaderChapterDocumentGenerator().generate(
            fileURL: chapterURL,
            sourceRoot: root,
            inventory: inventory
        )

        XCTAssertTrue(inventory.unknownClassNames.isEmpty)
        XCTAssertEqual(inventory.eligibility.state, .native)
        XCTAssertEqual(document.validation.unsupportedBlockCount, 0)
        XCTAssertTrue(document.validation.passesStructuralValidation)
        XCTAssertFalse(document.blocks.contains { $0.kind == .orderedList || $0.kind == .unorderedList })
        XCTAssertTrue(document.blocks.contains { $0.kind == .paragraph && $0.plainText == "1. First condition." })
        XCTAssertTrue(document.blocks.contains { $0.kind == .paragraph && $0.plainText == "2.1. Nested condition." })
        XCTAssertTrue(document.blocks.contains { $0.kind == .paragraph && $0.plainText.contains("Equation 1") })
        XCTAssertTrue(document.blocks.contains { $0.kind == .paragraph && $0.plainText.contains("Total area") })
    }

    func testTableNestedInsideListItemIsEmittedOnceAsTableBlock() throws {
        let root = try makeTemporaryDirectory()
        let chapterURL = root.appendingPathComponent("sample-package/chapters/nested-table.html")
        try FileManager.default.createDirectory(
            at: chapterURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try """
        <html><body><ol><li>Applicable areas:
          <table border="1"><tr><th>Area</th><th>Value</th></tr><tr><td>A</td><td>1</td></tr></table>
        </li></ol></body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let inventory = CorpusInventoryGenerator().analyzeChapter(fileURL: chapterURL, sourceRoot: root)
        let document = try NativeReaderChapterDocumentGenerator().generate(
            fileURL: chapterURL,
            sourceRoot: root,
            inventory: inventory
        )

        let listBlock = try XCTUnwrap(document.blocks.first { $0.kind == .orderedList })
        let embeddedTables = listBlock.listItems.flatMap { $0.segments.compactMap(\.table) }
        XCTAssertEqual(document.blocks.compactMap(\.table).count, 0)
        XCTAssertEqual(embeddedTables.count, 1)
        XCTAssertEqual(document.blocks.filter { $0.kind == .orderedList }.count, 1)
        XCTAssertEqual(
            listBlock.listItems.first?.segments.map(\.plainText),
            ["Applicable areas:", "AreaValueA1"]
        )
        XCTAssertTrue(document.validation.normalizedTextMatches)
        XCTAssertTrue(document.validation.tableStructuresMatch)
        XCTAssertEqual(document.validation.unsupportedBlockCount, 0)
        XCTAssertEqual(NativeReaderRolloutTier(blocks: document.blocks), .isolatedTableFallback)
    }

    func testNativeDocumentPreservesTextAnchorsLinksListsAndTableMatrixDeterministically() throws {
        let root = try makeTemporaryDirectory()
        let packageRoot = root.appendingPathComponent("sample-package", isDirectory: true)
        let chapters = packageRoot.appendingPathComponent("chapters", isDirectory: true)
        try FileManager.default.createDirectory(at: chapters, withIntermediateDirectories: true)
        try """
        {
          "codeSections": [{"id": 7, "name": "Building Code"}],
          "chapters": [{"id": 42, "codeSectionID": 7, "chapterNumber": "1", "title": "General"}]
        }
        """.write(to: packageRoot.appendingPathComponent("bundle.json"), atomically: true, encoding: .utf8)
        let chapterURL = chapters.appendingPathComponent("1.html")
        try """
        <html><body><section id="section-101"><h2>101 <strong>General</strong></h2>
        <p>Exact <a href="#section-102">linked</a> enacted text.</p>
        <ol><li>First<ul><li>Nested</li></ul></li><li>Second</li></ol>
        <table><caption>Values</caption><tr><th rowspan="2">A</th><th>B</th></tr><tr><td>C</td></tr></table>
        </section><section id="section-102"><h2>102 End</h2><p>Done.</p></section></body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let inventoryGenerator = CorpusInventoryGenerator()
        let inventory = inventoryGenerator.analyzeChapter(fileURL: chapterURL, sourceRoot: root)
        let documentGenerator = NativeReaderChapterDocumentGenerator()
        let first = try documentGenerator.generate(fileURL: chapterURL, sourceRoot: root, inventory: inventory)
        let second = try documentGenerator.generate(fileURL: chapterURL, sourceRoot: root, inventory: inventory)

        XCTAssertEqual(first, second)
        XCTAssertTrue(first.validation.passesStructuralValidation, "\(first.validation)")
        XCTAssertEqual(first.metadata.chapterID, 42)
        XCTAssertEqual(first.metadata.codeSectionID, 7)
        XCTAssertEqual(first.anchors.map(\.id), ["section-101", "section-102"])
        XCTAssertTrue(first.anchors.allSatisfy { $0.blockID != nil })
        XCTAssertEqual(first.links.map(\.target), ["#section-102"])
        XCTAssertEqual(first.blocks.filter { $0.kind == .orderedList }.first?.listItems.count, 2)
        XCTAssertEqual(first.blocks.compactMap(\.table).first?.columnCount, 2)
        XCTAssertEqual(first.blocks.compactMap(\.table).first?.cells.map(\.column), [0, 1, 1])
        XCTAssertEqual(
            first.blocks.compactMap(\.table).first?.structureSHA256,
            inventory.tables.first?.structureSHA256
        )
        XCTAssertEqual(
            try CorpusInventoryGenerator.encodedCompactJSON(first),
            try CorpusInventoryGenerator.encodedCompactJSON(second)
        )
    }

    func testJSXLinkPreservesVisibleTextAndTargetInRenderedRun() throws {
        let root = try makeTemporaryDirectory()
        let chapterURL = root.appendingPathComponent("sample-package/chapters/1.html")
        try FileManager.default.createDirectory(
            at: chapterURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let target = "{{ pathname: '/codes/newyorkcity/latest/NYCadmin/0-0-0-237170', hash: '#JD_T28C001' }}"
        try """
        <html><body><p>Refer to <Link class="Jump" to="\(target)">Chapter 1 of Title 28</Link> of the Administrative Code.</p></body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let inventory = CorpusInventoryGenerator().analyzeChapter(
            fileURL: chapterURL,
            sourceRoot: root
        )
        let document = try NativeReaderChapterDocumentGenerator().generate(
            fileURL: chapterURL,
            sourceRoot: root,
            inventory: inventory
        )

        XCTAssertEqual(inventory.links.first?.target, target)
        XCTAssertEqual(document.links.first?.text, "Chapter 1 of Title 28")
        XCTAssertTrue(document.validation.linkTargetsMatch)
        XCTAssertTrue(document.blocks.flatMap(\.runs).contains {
            $0.text == "Chapter 1 of Title 28" && $0.linkTarget == target
        })
    }

    func testLowercaseJSXLinkPreservesVisibleTextAndTargetInRenderedRun() throws {
        let root = try makeTemporaryDirectory()
        let chapterURL = root.appendingPathComponent("sample-package/chapters/1.html")
        try FileManager.default.createDirectory(
            at: chapterURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let target = "{{ pathname: '/codes/newyorkcity/latest/NYCadmin/0-0-0-207476', hash: '#JD_28-103' }}"
        try """
        <html><head><link rel="stylesheet" href="reader.css"></head><body><p>Refer to <link class="Jump" to="\(target)">Article 103 of Chapter 1 of Title 28</link>.</p></body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let inventory = CorpusInventoryGenerator().analyzeChapter(
            fileURL: chapterURL,
            sourceRoot: root
        )
        let document = try NativeReaderChapterDocumentGenerator().generate(
            fileURL: chapterURL,
            sourceRoot: root,
            inventory: inventory
        )

        XCTAssertEqual(inventory.links.map(\.target), [target])
        XCTAssertEqual(document.links.first?.text, "Article 103 of Chapter 1 of Title 28")
        XCTAssertTrue(document.validation.linkTargetsMatch)
        XCTAssertTrue(document.blocks.flatMap(\.runs).contains {
            $0.text == "Article 103 of Chapter 1 of Title 28" && $0.linkTarget == target
        })
    }

    func testUnbalancedJSXLinkFailsClosedInsteadOfOverlinkingParagraph() throws {
        let root = try makeTemporaryDirectory()
        let chapterURL = root.appendingPathComponent("sample-package/chapters/1.html")
        try FileManager.default.createDirectory(
            at: chapterURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try """
        <html><body><p>Refer to <link class="Jump" to="#JD_28-103">Article 103 of Chapter 1 of Title 28 and unrelated trailing text.</p></body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        XCTAssertThrowsError(try AuthoredHTMLParserInput.normalizedData(fileURL: chapterURL)) { error in
            XCTAssertTrue(error is AuthoredHTMLParserInputError)
        }
    }

    func testEqualCountMisorderedOrNestedJSXLinksFailClosed() throws {
        let root = try makeTemporaryDirectory()
        let chapterURL = root.appendingPathComponent("sample-package/chapters/1.html")
        try FileManager.default.createDirectory(
            at: chapterURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let malformedSources = [
            """
            <html><body><p></link>Refer to <link to="#JD_28-103">Article 103 and unrelated trailing text.</p></body></html>
            """,
            """
            <html><body><p><link to="#JD_28-103">Article 103 <link to="#JD_28-105">Article 105</link></link>.</p></body></html>
            """
        ]

        for (index, source) in malformedSources.enumerated() {
            try source.write(to: chapterURL, atomically: true, encoding: .utf8)
            XCTAssertThrowsError(
                try AuthoredHTMLParserInput.normalizedData(fileURL: chapterURL),
                "Malformed equal-count link case \(index) should fail closed"
            ) { error in
                XCTAssertTrue(error is AuthoredHTMLParserInputError)
            }
        }
    }

    func testExactTableMatrixSignatureCoversCoordinatesSpansHeadersAndText() throws {
        let root = try makeTemporaryDirectory()
        let chapterURL = root.appendingPathComponent("package/chapters/table.html")
        try FileManager.default.createDirectory(at: chapterURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try """
        <html><body><table><caption>Matrix</caption>
          <tr><th rowspan="2" id="head">Heading</th><td><a href="#target">One</a></td></tr>
          <tr><td>Two</td></tr><tfoot><tr><td colspan="2" class="footnote">Note</td></tr></tfoot>
        </table></body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let inventory = CorpusInventoryGenerator().analyzeChapter(fileURL: chapterURL, sourceRoot: root)
        let document = try NativeReaderChapterDocumentGenerator().generate(
            fileURL: chapterURL,
            sourceRoot: root,
            inventory: inventory
        )
        let sourceTable = try XCTUnwrap(inventory.tables.first)
        let nativeTable = try XCTUnwrap(document.blocks.compactMap(\.table).first)

        XCTAssertEqual(sourceTable.structureSHA256, nativeTable.structureSHA256)
        XCTAssertTrue(document.validation.tableStructuresMatch)
        XCTAssertEqual(sourceTable.footnotes, ["Note"])
        XCTAssertEqual(nativeTable.cells.map(\.column), [0, 1, 1, 0])
    }

    func testLogicalTableRowCountIncludesAuthoredRowspanBeyondLastRow() throws {
        let root = try makeTemporaryDirectory()
        let chapterURL = root.appendingPathComponent("package/chapters/table.html")
        try FileManager.default.createDirectory(
            at: chapterURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try """
        <html><body><table>
          <tr><th rowspan="2">Heading</th><th>Value</th></tr>
        </table></body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let inventory = CorpusInventoryGenerator().analyzeChapter(fileURL: chapterURL, sourceRoot: root)
        let document = try NativeReaderChapterDocumentGenerator().generate(
            fileURL: chapterURL,
            sourceRoot: root,
            inventory: inventory
        )
        let sourceTable = try XCTUnwrap(inventory.tables.first)
        let nativeTable = try XCTUnwrap(document.blocks.compactMap(\.table).first)

        XCTAssertEqual(sourceTable.rowCount, 2)
        XCTAssertEqual(nativeTable.rowCount, 2)
        XCTAssertTrue(document.validation.tableStructuresMatch)
    }

    func testLegacyPresentationHeaderTableIsNotRenderedTwice() throws {
        let root = try makeTemporaryDirectory()
        let chapterURL = root.appendingPathComponent("package/chapters/table.html")
        try FileManager.default.createDirectory(
            at: chapterURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try """
        <html><body><ScrollTable>
          <div class="xsl-table xsl-table--header">
            <table><tr><th>Material</th><th>Class</th></tr></table>
          </div>
          <div class="xsl-table xsl-table--body">
            <table>
              <tr><th>Material</th><th>Class</th></tr>
              <tr><td>Combustible liquid</td><td>II</td></tr>
            </table>
          </div>
        </ScrollTable></body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let inventory = CorpusInventoryGenerator().analyzeChapter(fileURL: chapterURL, sourceRoot: root)
        let document = try NativeReaderChapterDocumentGenerator().generate(
            fileURL: chapterURL,
            sourceRoot: root,
            inventory: inventory
        )

        XCTAssertEqual(inventory.tables.count, 1)
        XCTAssertEqual(document.blocks.compactMap(\.table).count, 1)
        XCTAssertEqual(document.blocks.compactMap(\.table).first?.rowCount, 2)
        XCTAssertTrue(document.validation.normalizedTextMatches)
        XCTAssertTrue(document.validation.tableStructuresMatch)
    }

    func testLegacyFormattingWhitespaceIsCollapsedWithoutLosingAuthoredLineBreaks() throws {
        let root = try makeTemporaryDirectory()
        let chapterURL = root.appendingPathComponent("package/chapters/spacing.html")
        try FileManager.default.createDirectory(
            at: chapterURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try """
        <html><body>
          <div>Printing; area not exceeding 2,000 square feet (185.8 m
            <span style="vertical-align: super">2</span>
            )</div>
          <div>Table 307.1(1)<br></br>Maximum Allowable Quantity</div>
          <div>For SI: 1 cubic foot = 0.028 m
            <span style="vertical-align: super">3</span>
            , 1 pound = 0.454 kg.</div>
        </body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let inventory = CorpusInventoryGenerator().analyzeChapter(fileURL: chapterURL, sourceRoot: root)
        let document = try NativeReaderChapterDocumentGenerator().generate(
            fileURL: chapterURL,
            sourceRoot: root,
            inventory: inventory
        )
        let renderedText = document.blocks.map { $0.runs.map(\.text).joined() }

        XCTAssertEqual(renderedText[0], "Printing; area not exceeding 2,000 square feet (185.8 m2)")
        XCTAssertEqual(renderedText[1], "Table 307.1(1)\nMaximum Allowable Quantity")
        XCTAssertEqual(renderedText[2], "For SI: 1 cubic foot = 0.028 m3, 1 pound = 0.454 kg.")
        XCTAssertTrue(document.validation.normalizedTextMatches)
    }

    func testUTF8AuthoredPunctuationSurvivesDOMRecovery() throws {
        let root = try makeTemporaryDirectory()
        let chapterURL = root.appendingPathComponent("package/chapters/utf8.html")
        try FileManager.default.createDirectory(at: chapterURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let enactedText = "The “New York City Energy Conservation Code”—© 2026."
        try "<section id='utf8'><p>\(enactedText)</p></section>"
            .write(to: chapterURL, atomically: true, encoding: .utf8)

        let inventory = CorpusInventoryGenerator().analyzeChapter(fileURL: chapterURL, sourceRoot: root)
        let document = try NativeReaderChapterDocumentGenerator().generate(
            fileURL: chapterURL,
            sourceRoot: root,
            inventory: inventory
        )

        XCTAssertTrue(document.blocks.map(\.plainText).joined(separator: " ").contains(enactedText))
        XCTAssertFalse(document.blocks.map(\.plainText).joined().contains("â"))
        XCTAssertTrue(document.validation.normalizedTextMatches)
        XCTAssertEqual(NativeReaderRolloutTier(blocks: document.blocks), .textOnly)
    }

    func testUnsupportedDocumentBlockPreservesRecoveredSourceAndRoutesToHTML() throws {
        let root = try makeTemporaryDirectory()
        let chapterURL = root.appendingPathComponent("package/chapters/2.html")
        try FileManager.default.createDirectory(at: chapterURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try """
        <html><body><section id="two"><p>Supported.</p><mystery-widget>Unsupported exact text.</mystery-widget></section></body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let inventory = CorpusInventoryGenerator().analyzeChapter(fileURL: chapterURL, sourceRoot: root)
        let document = try NativeReaderChapterDocumentGenerator().generate(
            fileURL: chapterURL,
            sourceRoot: root,
            inventory: inventory
        )

        XCTAssertEqual(document.eligibility.state, .fullHTMLFallback)
        XCTAssertEqual(document.validation.unsupportedBlockCount, 1)
        XCTAssertTrue(document.validation.normalizedTextMatches)
        XCTAssertTrue(document.blocks.contains { block in
            block.kind == .unsupportedHTML
                && block.sourceHTML?.contains("Unsupported exact text.") == true
        })
    }

    private func makeTemporaryDirectory() throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("native-reader-inventory-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        temporaryDirectories.append(url)
        return url
    }
}
