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

    private func makeTemporaryDirectory() throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("native-reader-inventory-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        temporaryDirectories.append(url)
        return url
    }
}
