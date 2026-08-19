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
            <figure><img src="../assets/figure.jpg" width="640" height="480" alt="Diagram"><figcaption>Figure caption</figcaption></figure>
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
        XCTAssertEqual(chapter.links.first?.target, "#target")
        XCTAssertNotNil(chapter.normalizedTextSHA256)
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

        XCTAssertEqual(chapter.tables.first?.renderingClassification, .isolatedHTML)
        XCTAssertEqual(chapter.tables.first?.classificationReasons, ["mergedCells"])
        XCTAssertEqual(chapter.unknownElementNames, ["mystery-widget"])
        XCTAssertEqual(chapter.unknownClassNames, ["unreviewed-variant"])
        XCTAssertEqual(chapter.eligibility.state, .fullHTMLFallback)
        XCTAssertTrue(chapter.eligibility.reasons.contains { $0.contains("unknownElements") })
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

    func testDuplicateAnchorsAndMissingAssetsAreInvalidContent() throws {
        let root = try makeTemporaryDirectory()
        let chapterURL = root.appendingPathComponent("package/chapters/1.html")
        try FileManager.default.createDirectory(at: chapterURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try """
        <html><body><h2 id="duplicate">One</h2><p id="duplicate">Text</p><img src="../assets/missing.png"></body></html>
        """.write(to: chapterURL, atomically: true, encoding: .utf8)

        let chapter = CorpusInventoryGenerator().analyzeChapter(fileURL: chapterURL, sourceRoot: root)

        XCTAssertEqual(chapter.duplicateAnchorIDs, ["duplicate"])
        XCTAssertEqual(chapter.images.first?.assetExists, false)
        XCTAssertEqual(chapter.eligibility.state, .invalidContent)
        XCTAssertEqual(chapter.eligibility.reasons, ["duplicateAnchorIDs", "missingMediaAsset"])
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
            try CorpusInventoryGenerator.encodedCompactJSON(first),
            try CorpusInventoryGenerator.encodedCompactJSON(second)
        )
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
