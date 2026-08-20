import CryptoKit
import Foundation

enum AuthoredHTMLParserInputError: LocalizedError {
    case unbalancedLinkElements(String)

    var errorDescription: String? {
        switch self {
        case .unbalancedLinkElements(let path):
            "Authored JSX link elements are unbalanced: \(path)"
        }
    }
}

enum AuthoredHTMLParserInput {
    static func normalizedData(fileURL: URL) throws -> Data {
        let sourceData = try Data(contentsOf: fileURL)
        var source = String(decoding: sourceData, as: UTF8.self)

        // The authored corpus uses JSX-style <Link to="..."> elements in both
        // uppercase and lowercase forms. libxml2's HTML parser otherwise treats
        // them as the void HTML <link> element, separating the visible label from
        // its target before we build text runs. Requiring a `to` attribute avoids
        // rewriting ordinary HTML stylesheet <link> elements.
        guard hasBalancedLinkElements(in: source) else {
            throw AuthoredHTMLParserInputError.unbalancedLinkElements(fileURL.path)
        }
        source = source.replacingOccurrences(
            of: #"<link(?=[\s>])(?=[^>]*\bto\s*=)"#,
            with: "<a",
            options: [.regularExpression, .caseInsensitive]
        )
        source = source.replacingOccurrences(
            of: #"</link\s*>"#,
            with: "</a>",
            options: [.regularExpression, .caseInsensitive]
        )

        var normalizedData = Data([0xEF, 0xBB, 0xBF])
        normalizedData.append(Data(source.utf8))
        return normalizedData
    }

    private static func hasBalancedLinkElements(in value: String) -> Bool {
        guard let expression = try? NSRegularExpression(
            pattern: #"(?i)<link(?=[\s>])(?=[^>]*\bto\s*=)[^>]*>|</link\s*>"#
        ) else { return false }
        let range = NSRange(location: 0, length: value.utf16.count)
        var depth = 0
        for match in expression.matches(in: value, range: range) {
            guard let tokenRange = Range(match.range, in: value) else { return false }
            let token = value[tokenRange]
            if token.hasPrefix("</") {
                guard depth == 1 else { return false }
                depth = 0
            } else {
                guard depth == 0 else { return false }
                depth = 1
            }
        }
        return depth == 0
    }
}

public enum CorpusInventoryError: LocalizedError {
    case sourceRootMissing(String)
    case noChapterFiles(String)
    case reportMismatch(String)

    public var errorDescription: String? {
        switch self {
        case .sourceRootMissing(let path):
            "Authored content root does not exist: \(path)"
        case .noChapterFiles(let path):
            "No authored chapter HTML files were found below: \(path)"
        case .reportMismatch(let path):
            "Generated inventory differs from the committed file: \(path)"
        }
    }
}

public struct CorpusInventoryGenerator {
    public static let schemaVersion = 3
    public static let parserSchemaVersion = "native-reader-document-v2"
    public static let parserEngine = "Case-insensitive authored JSX Link-to-anchor normalization + libxml2 HTML recovery DOM (xmllint --html --xmlout) + Foundation XMLDocument"

    private let fileManager: FileManager

    public init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
    }

    public func generate(sourceRoot: URL, reportedSourceRoot: String? = nil) throws -> CorpusInventoryReport {
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: sourceRoot.path, isDirectory: &isDirectory), isDirectory.boolValue else {
            throw CorpusInventoryError.sourceRootMissing(sourceRoot.path)
        }

        let chapterURLs = try authoredChapterURLs(below: sourceRoot)
        guard !chapterURLs.isEmpty else {
            throw CorpusInventoryError.noChapterFiles(sourceRoot.path)
        }

        var chapters: [ChapterInventory] = []
        chapters.reserveCapacity(chapterURLs.count)
        for chapterURL in chapterURLs {
            let chapter = autoreleasepool {
                analyzeChapter(fileURL: chapterURL, sourceRoot: sourceRoot)
            }
            chapters.append(chapter)
        }
        return makeReport(
            chapters: chapters,
            sourceRoot: sourceRoot,
            reportedSourceRoot: reportedSourceRoot
        )
    }

    public func makeReport(
        chapters: [ChapterInventory],
        sourceRoot: URL,
        reportedSourceRoot: String? = nil
    ) -> CorpusInventoryReport {
        let sortedChapters = chapters.sorted { $0.relativePath < $1.relativePath }
        let corpusHashInput = sortedChapters
            .map { "\($0.relativePath)\u{0}\($0.sourceSHA256)" }
            .joined(separator: "\n")
        let corpusSHA256 = sha256(Data(corpusHashInput.utf8))
        let summary = makeSummary(chapters: sortedChapters)
        let vocabulary = makeVocabulary(chapters: sortedChapters)

        return CorpusInventoryReport(
            schemaVersion: Self.schemaVersion,
            parserSchemaVersion: Self.parserSchemaVersion,
            parserEngine: Self.parserEngine,
            sourceRoot: reportedSourceRoot ?? sourceRoot.path,
            corpusSHA256: corpusSHA256,
            summary: summary,
            vocabulary: vocabulary,
            goldenChapterSet: makeGoldenChapterSet(chapters: sortedChapters),
            chapters: sortedChapters
        )
    }

    public func analyzeChapter(fileURL: URL, sourceRoot: URL) -> ChapterInventory {
        let relativePath = relativePath(for: fileURL, below: sourceRoot)
        let components = relativePath.split(separator: "/").map(String.init)
        let packageID = components.first ?? "unknown-package"
        let codeFamily = inferredCodeFamily(components: components, packageID: packageID)
        let chapterIdentifier = fileURL.deletingPathExtension().lastPathComponent

        guard let data = try? Data(contentsOf: fileURL) else {
            return failedChapter(
                relativePath: relativePath,
                packageID: packageID,
                codeFamily: codeFamily,
                chapterIdentifier: chapterIdentifier,
                sourceSHA256: "unreadable",
                sourceByteCount: 0,
                message: "Unable to read chapter source"
            )
        }

        let sourceHash = sha256(data)
        let document: XMLDocument
        do {
            document = try parsedDocument(fileURL: fileURL)
        } catch {
            return failedChapter(
                relativePath: relativePath,
                packageID: packageID,
                codeFamily: codeFamily,
                chapterIdentifier: chapterIdentifier,
                sourceSHA256: sourceHash,
                sourceByteCount: data.count,
                message: "DOM parse failed: \(error.localizedDescription)"
            )
        }

        guard let root = document.rootElement() else {
            return failedChapter(
                relativePath: relativePath,
                packageID: packageID,
                codeFamily: codeFamily,
                chapterIdentifier: chapterIdentifier,
                sourceSHA256: sourceHash,
                sourceByteCount: data.count,
                message: "DOM parser produced no root element"
            )
        }

        let allElements = flattenedElements(from: root)
        let body = allElements.first { normalizedName($0) == "body" } ?? root
        let contentElements = flattenedElements(from: body)
        let sourceOrderByElement = Dictionary(
            uniqueKeysWithValues: contentElements.enumerated().map { (ObjectIdentifier($0.element), $0.offset) }
        )
        let packageRoot = sourceRoot.appendingPathComponent(packageID, isDirectory: true)
        let imageManifest = loadImageManifest(packageRoot: packageRoot)

        let stableAnchorResult = makeAnchors(elements: contentElements, sourceOrderByElement: sourceOrderByElement)
        let headings = makeHeadings(elements: contentElements, sourceOrderByElement: sourceOrderByElement)
        let sectionCount = contentElements.filter(isSectionBoundary).count
        let normalizedText = normalizeText(body.stringValue ?? "")
        let lists = makeListInventory(elements: contentElements)
        let tableElements = contentElements.filter { normalizedName($0) == "table" }
        let tables = tableElements.map {
            tableInventory(for: $0, sourceOrderByElement: sourceOrderByElement)
        }
        let isolatedTableElements = Set(zip(tableElements, tables).compactMap { element, table in
            table.renderingClassification == .isolatedHTML ? ObjectIdentifier(element) : nil
        })
        let images = contentElements
            .filter { ["img", "svg"].contains(normalizedName($0)) && nearestAncestor(named: "svg", from: $0) == nil }
            .map {
                imageInventory(
                    for: $0,
                    chapterURL: fileURL,
                    sourceRoot: sourceRoot,
                    packageRoot: packageRoot,
                    imageManifest: imageManifest,
                    sourceOrderByElement: sourceOrderByElement
                )
            }
        let links = makeLinks(elements: contentElements)
        let textBlockCount = contentElements.filter(isTextBlock).count

        let elementNames = sortedUnique(contentElements.map(normalizedName))
        let classNames = sortedUnique(contentElements.flatMap(classTokens))
        let cssProperties = sortedUnique(contentElements.flatMap(inlineCSSProperties))
        let unknownElements = elementNames.filter { !Self.recognizedElementNames.contains($0) }
        let unknownClasses = classNames.filter { !isRecognizedClassName($0) }
        let unsupportedCSS = cssProperties.filter { !Self.supportedInlineCSSProperties.contains($0) }
        // Unknown markup that is wholly contained by an isolated table is not a
        // chapter-level blocker. The original table fragment is rendered by the
        // existing table WebView, while the complete chapter still falls back if
        // the same construct appears anywhere outside that boundary.
        let chapterLevelElements = contentElements.filter {
            !isInsideIsolatedTable($0, isolatedTableElements: isolatedTableElements)
        }
        let blockingUnknownElements = sortedUnique(chapterLevelElements.map(normalizedName))
            .filter { !Self.recognizedElementNames.contains($0) }
        let blockingUnknownClasses = sortedUnique(chapterLevelElements.flatMap(classTokens))
            .filter { !isRecognizedClassName($0) }
        let blockingUnsupportedCSS = sortedUnique(chapterLevelElements.flatMap(inlineCSSProperties))
            .filter { !Self.supportedInlineCSSProperties.contains($0) }
        let parserMessages = structuralMessages(
            normalizedText: normalizedText,
            bodyWasFound: normalizedName(body) == "body",
            duplicateAnchorIDs: stableAnchorResult.duplicates,
            images: images
        )
        let eligibility = eligibility(
            normalizedText: normalizedText,
            duplicateAnchorIDs: stableAnchorResult.duplicates,
            images: images,
            tables: tables,
            unknownElements: blockingUnknownElements,
            unknownClasses: blockingUnknownClasses,
            unsupportedCSS: blockingUnsupportedCSS
        )

        return ChapterInventory(
            relativePath: relativePath,
            packageID: packageID,
            codeFamily: codeFamily,
            chapterIdentifier: chapterIdentifier,
            sourceSHA256: sourceHash,
            sourceByteCount: data.count,
            parserSucceeded: true,
            parserMessages: parserMessages,
            normalizedTextSHA256: normalizedText.isEmpty ? nil : sha256(Data(normalizedText.utf8)),
            normalizedTextCharacterCount: normalizedText.count,
            sectionCount: sectionCount,
            stableAnchors: stableAnchorResult.anchors,
            duplicateAnchorIDs: stableAnchorResult.duplicates,
            headingHierarchy: headings,
            textBlockCount: textBlockCount,
            lists: lists,
            tables: tables,
            images: images,
            links: links,
            elementNames: elementNames,
            classNames: classNames,
            inlineCSSProperties: cssProperties,
            unknownElementNames: unknownElements,
            unknownClassNames: unknownClasses,
            unsupportedCSSProperties: unsupportedCSS,
            eligibility: eligibility
        )
    }

    public func analyzeChapterResult(fileURL: URL, sourceRoot: URL) -> NativeReaderChapterAnalysis {
        let inventory = analyzeChapter(fileURL: fileURL, sourceRoot: sourceRoot)
        let documentGenerator = NativeReaderChapterDocumentGenerator(fileManager: fileManager)
        do {
            return NativeReaderChapterAnalysis(
                inventory: inventory,
                document: try documentGenerator.generate(
                    fileURL: fileURL,
                    sourceRoot: sourceRoot,
                    inventory: inventory
                )
            )
        } catch {
            return NativeReaderChapterAnalysis(
                inventory: inventory,
                document: documentGenerator.fallbackDocument(
                    fileURL: fileURL,
                    sourceRoot: sourceRoot,
                    inventory: inventory,
                    message: error.localizedDescription
                )
            )
        }
    }

    public static func encodedJSON<T: Encodable>(_ value: T) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        var data = try encoder.encode(value)
        data.append(0x0A)
        return data
    }

    public static func encodedCompactJSON<T: Encodable>(_ value: T) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(value)
    }

    private func parsedDocument(fileURL: URL) throws -> XMLDocument {
        let parserURL = URL(fileURLWithPath: "/usr/bin/xmllint")
        guard fileManager.isExecutableFile(atPath: parserURL.path) else {
            throw NSError(
                domain: "NativeReaderInventory",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Required libxml2 parser is unavailable at /usr/bin/xmllint"]
            )
        }

        let process = Process()
        let input = Pipe()
        let output = Pipe()
        process.executableURL = parserURL
        process.arguments = [
            "--html",
            "--xmlout",
            "--recover",
            "--nowarning",
            "--nonet",
            "--dropdtd",
            "--encode", "UTF-8",
            "-"
        ]
        process.standardInput = input
        process.standardOutput = output
        process.standardError = FileHandle.nullDevice
        let sourceData = try AuthoredHTMLParserInput.normalizedData(fileURL: fileURL)
        try process.run()
        DispatchQueue.global(qos: .utility).async {
            input.fileHandleForWriting.write(sourceData)
            input.fileHandleForWriting.closeFile()
        }
        let normalizedData = output.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        guard process.terminationStatus == 0, !normalizedData.isEmpty else {
            throw NSError(
                domain: "NativeReaderInventory",
                code: Int(process.terminationStatus),
                userInfo: [NSLocalizedDescriptionKey: "libxml2 could not recover the chapter DOM"]
            )
        }
        return try XMLDocument(data: normalizedData, options: [.nodeLoadExternalEntitiesNever])
    }

    public func authoredChapterURLs(below sourceRoot: URL) throws -> [URL] {
        let keys: [URLResourceKey] = [.isRegularFileKey, .isDirectoryKey]
        guard let enumerator = fileManager.enumerator(
            at: sourceRoot,
            includingPropertiesForKeys: keys,
            options: [.skipsHiddenFiles, .skipsPackageDescendants]
        ) else {
            return []
        }

        var result: [URL] = []
        for case let url as URL in enumerator {
            let relative = relativePath(for: url, below: sourceRoot)
            let components = relative.split(separator: "/").map { $0.lowercased() }
            if components.contains("prepared") {
                if (try? url.resourceValues(forKeys: Set(keys)).isDirectory) == true {
                    enumerator.skipDescendants()
                }
                continue
            }
            guard url.pathExtension.lowercased() == "html",
                  components.dropLast().last == "chapters",
                  (try? url.resourceValues(forKeys: Set(keys)).isRegularFile) == true else {
                continue
            }
            result.append(url)
        }
        return result.sorted { relativePath(for: $0, below: sourceRoot) < relativePath(for: $1, below: sourceRoot) }
    }

    private func failedChapter(
        relativePath: String,
        packageID: String,
        codeFamily: String,
        chapterIdentifier: String,
        sourceSHA256: String,
        sourceByteCount: Int,
        message: String
    ) -> ChapterInventory {
        ChapterInventory(
            relativePath: relativePath,
            packageID: packageID,
            codeFamily: codeFamily,
            chapterIdentifier: chapterIdentifier,
            sourceSHA256: sourceSHA256,
            sourceByteCount: sourceByteCount,
            parserSucceeded: false,
            parserMessages: [message],
            normalizedTextSHA256: nil,
            normalizedTextCharacterCount: 0,
            sectionCount: 0,
            stableAnchors: [],
            duplicateAnchorIDs: [],
            headingHierarchy: [],
            textBlockCount: 0,
            lists: ListInventory(orderedListCount: 0, unorderedListCount: 0, itemCount: 0, maximumDepth: 0),
            tables: [],
            images: [],
            links: [],
            elementNames: [],
            classNames: [],
            inlineCSSProperties: [],
            unknownElementNames: [],
            unknownClassNames: [],
            unsupportedCSSProperties: [],
            eligibility: NativeReaderEligibility(state: .invalidContent, reasons: [message])
        )
    }

    private func inferredCodeFamily(components: [String], packageID: String) -> String {
        if let codeSectionsIndex = components.firstIndex(of: "code-sections"),
           components.indices.contains(codeSectionsIndex + 1) {
            return "\(packageID)/\(components[codeSectionsIndex + 1])"
        }
        return "\(packageID)/default"
    }

    private func makeAnchors(
        elements: [XMLElement],
        sourceOrderByElement: [ObjectIdentifier: Int]
    ) -> (anchors: [AnchorInventory], duplicates: [String]) {
        var seen: Set<String> = []
        var duplicateIDs: Set<String> = []
        var anchors: [AnchorInventory] = []

        for element in elements {
            var candidates: [String] = []
            if let id = attribute("id", in: element), !id.isEmpty {
                candidates.append(id)
            }
            if normalizedName(element) == "a",
               let name = attribute("name", in: element),
               !name.isEmpty,
               !candidates.contains(name) {
                candidates.append(name)
            }

            for candidate in candidates {
                if seen.contains(candidate) {
                    duplicateIDs.insert(candidate)
                    continue
                }
                seen.insert(candidate)
                anchors.append(
                    AnchorInventory(
                        id: candidate,
                        element: normalizedName(element),
                        title: nonEmpty(attribute("title", in: element)) ?? nearbyHeadingText(for: element),
                        sourceOrder: sourceOrderByElement[ObjectIdentifier(element)] ?? 0
                    )
                )
            }
        }

        return (anchors, duplicateIDs.sorted())
    }

    private func makeHeadings(
        elements: [XMLElement],
        sourceOrderByElement: [ObjectIdentifier: Int]
    ) -> [HeadingInventory] {
        elements.compactMap { element in
            let name = normalizedName(element)
            guard name.count == 2,
                  name.first == "h",
                  let level = Int(name.dropFirst()),
                  (1...6).contains(level) else {
                return nil
            }
            let text = normalizeText(element.stringValue ?? "")
            guard !text.isEmpty else { return nil }
            var anchors = [attribute("id", in: element)].compactMap(nonEmpty)
            anchors.append(contentsOf: flattenedElements(from: element).dropFirst().flatMap { child -> [String] in
                [attribute("id", in: child), normalizedName(child) == "a" ? attribute("name", in: child) : nil]
                    .compactMap(nonEmpty)
            })
            return HeadingInventory(
                level: level,
                text: text,
                anchorIDs: sortedUnique(anchors),
                sourceOrder: sourceOrderByElement[ObjectIdentifier(element)] ?? 0
            )
        }
    }

    private func makeListInventory(elements: [XMLElement]) -> ListInventory {
        let ordered = elements.filter { normalizedName($0) == "ol" }.count
        let unordered = elements.filter { normalizedName($0) == "ul" }.count
        let items = elements.filter { normalizedName($0) == "li" }
        let maximumDepth = items.map { item in
            var depth = 0
            var parent = item.parent as? XMLElement
            while let element = parent {
                if ["ol", "ul"].contains(normalizedName(element)) {
                    depth += 1
                }
                parent = element.parent as? XMLElement
            }
            return depth
        }.max() ?? 0
        return ListInventory(
            orderedListCount: ordered,
            unorderedListCount: unordered,
            itemCount: items.count,
            maximumDepth: maximumDepth
        )
    }

    private func tableInventory(
        for table: XMLElement,
        sourceOrderByElement: [ObjectIdentifier: Int]
    ) -> TableInventory {
        let descendants = flattenedElements(from: table)
        let rows = descendants.filter {
            normalizedName($0) == "tr" && nearestAncestor(named: "table", from: $0) === table
        }
        let cellsByRow = rows.map { row in
            flattenedElements(from: row).filter { element in
                ["td", "th"].contains(normalizedName(element)) && nearestAncestor(named: "tr", from: element) === row
            }
        }
        let cells = cellsByRow.flatMap { $0 }
        let maximumRowSpan = cells.map { positiveInteger(attribute("rowspan", in: $0)) }.max() ?? 1
        let maximumColumnSpan = cells.map { positiveInteger(attribute("colspan", in: $0)) }.max() ?? 1
        let logicalColumnCount = cellsByRow.map { rowCells in
            rowCells.reduce(0) { $0 + positiveInteger(attribute("colspan", in: $1)) }
        }.max() ?? 0
        let headerRows = cellsByRow.filter { $0.contains { normalizedName($0) == "th" } }.count
        let caption = descendants
            .first { normalizedName($0) == "caption" && nearestAncestor(named: "table", from: $0) === table }
            .flatMap { nonEmpty(normalizeText($0.stringValue ?? "")) }
        let footnotes = sortedUnique(descendants.compactMap { element -> String? in
            let name = normalizedName(element)
            let classes = classTokens(element).map { $0.lowercased() }
            guard name == "tfoot" || classes.contains(where: { $0.contains("footnote") }) else { return nil }
            return nonEmpty(normalizeText(element.stringValue ?? ""))
        })
        var occupied: Set<TableGridPosition> = []
        var signatureCells: [TableCellSignature] = []
        var signatureColumnCount = 0
        for (rowIndex, rowCells) in cellsByRow.enumerated() {
            var columnIndex = 0
            for cell in rowCells {
                while occupied.contains(TableGridPosition(row: rowIndex, column: columnIndex)) {
                    columnIndex += 1
                }
                let rowSpan = positiveInteger(attribute("rowspan", in: cell))
                let columnSpan = positiveInteger(attribute("colspan", in: cell))
                for occupiedRow in rowIndex..<(rowIndex + rowSpan) {
                    for occupiedColumn in columnIndex..<(columnIndex + columnSpan) {
                        occupied.insert(TableGridPosition(row: occupiedRow, column: occupiedColumn))
                    }
                }
                let cellElements = flattenedElements(from: cell)
                let anchorIDs = orderedUnique(cellElements.flatMap { candidate -> [String] in
                    var values: [String] = []
                    if let id = nonEmpty(attribute("id", in: candidate)) { values.append(id) }
                    if normalizedName(candidate) == "a",
                       let name = nonEmpty(attribute("name", in: candidate)) {
                        values.append(name)
                    }
                    return values
                })
                let linkTargets = cellElements.compactMap { candidate -> String? in
                    guard ["a", "link", "area"].contains(normalizedName(candidate)) else { return nil }
                    return nonEmpty(attribute("href", in: candidate)) ?? nonEmpty(attribute("to", in: candidate))
                }
                signatureCells.append(
                    TableCellSignature(
                        row: rowIndex,
                        column: columnIndex,
                        rowSpan: rowSpan,
                        columnSpan: columnSpan,
                        isHeader: normalizedName(cell) == "th",
                        plainText: normalizeText(cell.stringValue ?? ""),
                        anchorIDs: anchorIDs,
                        linkTargets: linkTargets
                    )
                )
                columnIndex += columnSpan
                signatureColumnCount = max(signatureColumnCount, columnIndex)
            }
        }
        let structureSHA256 = sha256(Data(tableSignature(
            rowCount: rows.count,
            columnCount: signatureColumnCount,
            cells: signatureCells,
            caption: caption,
            footnotes: footnotes
        ).utf8))
        let borderSignatures = sortedUnique(cells.flatMap(borderSignaturesForElement) + borderSignaturesForElement(table))
        let permittedInsideTable: Set<String> = [
            "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
            "div", "p", "span", "a", "link", "br", "strong", "b", "em", "i", "u", "s", "strike",
            "small", "sup", "sub", "ol", "ul", "li"
        ]
        let embeddedElements = sortedUnique(descendants.map(normalizedName).filter { !permittedInsideTable.contains($0) })

        let hasCellFormatting = cells.contains { cell in
            !classTokens(cell).isEmpty
                || nonEmpty(attribute("style", in: cell)) != nil
                || !flattenedElements(from: cell).dropFirst().isEmpty
        }
        let hasCellLinks = cells.contains { cell in
            flattenedElements(from: cell).dropFirst().contains {
                ["a", "link", "area"].contains(normalizedName($0))
            }
        }

        var reasons: [String] = []
        if rows.isEmpty || cells.isEmpty || logicalColumnCount == 0 { reasons.append("emptyTable") }
        if maximumRowSpan > 1 || maximumColumnSpan > 1 { reasons.append("mergedCells") }
        if headerRows > 1 { reasons.append("multiRowHeader") }
        if logicalColumnCount > 6 { reasons.append("wideTable") }
        if !borderSignatures.isEmpty { reasons.append("customBorders") }
        if hasCellFormatting { reasons.append("formattedCells") }
        if hasCellLinks { reasons.append("linkedCells") }
        if !embeddedElements.isEmpty { reasons.append("embeddedContent") }
        let renderingClassification: TableRenderingClassification = reasons.isEmpty ? .nativeSimple : .isolatedHTML

        return TableInventory(
            sourceOrder: sourceOrderByElement[ObjectIdentifier(table)] ?? 0,
            anchorID: nonEmpty(attribute("id", in: table)),
            rowCount: rows.count,
            logicalColumnCount: logicalColumnCount,
            cellCount: cells.count,
            headerCellCount: cells.filter { normalizedName($0) == "th" }.count,
            maximumRowSpan: maximumRowSpan,
            maximumColumnSpan: maximumColumnSpan,
            hasMultiRowHeader: headerRows > 1,
            caption: caption,
            footnotes: footnotes,
            structureSHA256: structureSHA256,
            borderSignatures: borderSignatures,
            embeddedElementNames: embeddedElements,
            renderingClassification: renderingClassification,
            classificationReasons: reasons
        )
    }

    private func imageInventory(
        for element: XMLElement,
        chapterURL: URL,
        sourceRoot: URL,
        packageRoot: URL,
        imageManifest: [String: String],
        sourceOrderByElement: [ObjectIdentifier: Int]
    ) -> ImageInventory {
        let name = normalizedName(element)
        let source = nonEmpty(attribute("src", in: element)) ?? nonEmpty(attribute("href", in: element))
        let isInlineSVG = name == "svg" && source == nil
        let resolution = source.map {
            resolveAsset(
                source: $0,
                relativeTo: chapterURL,
                packageRoot: packageRoot,
                imageManifest: imageManifest
            )
        }
        let assetExists = isInlineSVG || (resolution?.exists ?? false)
        let resolvedPath = resolution?.url.map { relativePath(for: $0, below: sourceRoot) }

        return ImageInventory(
            sourceOrder: sourceOrderByElement[ObjectIdentifier(element)] ?? 0,
            element: name,
            source: source,
            resolvedAssetPath: resolvedPath,
            assetExists: assetExists,
            width: nonEmpty(attribute("width", in: element)) ?? cssValue("width", in: element),
            height: nonEmpty(attribute("height", in: element)) ?? cssValue("height", in: element),
            caption: nearbyCaption(for: element),
            accessibilityText: nonEmpty(attribute("alt", in: element))
                ?? nonEmpty(attribute("aria-label", in: element))
                ?? nonEmpty(attribute("title", in: element))
        )
    }

    private func makeLinks(elements: [XMLElement]) -> [LinkInventory] {
        var counts: [String: (element: String, target: String, count: Int)] = [:]
        for element in elements {
            let name = normalizedName(element)
            guard ["a", "link", "area"].contains(name) else { continue }
            let target = nonEmpty(attribute("href", in: element)) ?? nonEmpty(attribute("to", in: element))
            guard let target else { continue }
            let key = "\(name)\u{0}\(target)"
            let current = counts[key]
            counts[key] = (name, target, (current?.count ?? 0) + 1)
        }
        return counts.values
            .map {
                LinkInventory(
                    element: $0.element,
                    target: $0.target,
                    occurrences: $0.count,
                    isInternalAnchor: $0.target.hasPrefix("#") || $0.target.contains("hash:")
                )
            }
            .sorted {
                if $0.element == $1.element { return $0.target < $1.target }
                return $0.element < $1.element
            }
    }

    private func structuralMessages(
        normalizedText: String,
        bodyWasFound: Bool,
        duplicateAnchorIDs: [String],
        images: [ImageInventory]
    ) -> [String] {
        var messages: [String] = []
        if !bodyWasFound { messages.append("DOM parser produced no body element; root element was inspected") }
        if normalizedText.isEmpty { messages.append("Normalized chapter text is empty") }
        if !duplicateAnchorIDs.isEmpty { messages.append("Duplicate stable anchor IDs were found") }
        if images.contains(where: { !$0.assetExists }) { messages.append("One or more referenced media assets could not be resolved") }
        return messages
    }

    private func eligibility(
        normalizedText: String,
        duplicateAnchorIDs: [String],
        images: [ImageInventory],
        tables: [TableInventory],
        unknownElements: [String],
        unknownClasses: [String],
        unsupportedCSS: [String]
    ) -> NativeReaderEligibility {
        var invalidReasons: [String] = []
        if normalizedText.isEmpty { invalidReasons.append("emptyNormalizedText") }
        if !duplicateAnchorIDs.isEmpty { invalidReasons.append("duplicateAnchorIDs") }
        if images.contains(where: { !$0.assetExists }) { invalidReasons.append("missingMediaAsset") }
        if !invalidReasons.isEmpty {
            return NativeReaderEligibility(state: .invalidContent, reasons: invalidReasons)
        }

        var fallbackReasons: [String] = []
        if !unknownElements.isEmpty { fallbackReasons.append("unknownElements: \(unknownElements.joined(separator: ","))") }
        if !unknownClasses.isEmpty { fallbackReasons.append("unknownClasses: \(unknownClasses.joined(separator: ","))") }
        if !unsupportedCSS.isEmpty { fallbackReasons.append("unsupportedCSS: \(unsupportedCSS.joined(separator: ","))") }
        if !fallbackReasons.isEmpty {
            return NativeReaderEligibility(state: .fullHTMLFallback, reasons: fallbackReasons)
        }

        let oversizedIsolatedTableCount = tables.filter {
            $0.renderingClassification == .isolatedHTML
                && ($0.rowCount > 250 || $0.cellCount > 2_500)
        }.count
        if oversizedIsolatedTableCount > 0 {
            return NativeReaderEligibility(
                state: .fullHTMLFallback,
                reasons: ["oversizedIsolatedHTMLTableCount: \(oversizedIsolatedTableCount)"]
            )
        }

        let isolatedHTMLTableCount = tables.filter { $0.renderingClassification == .isolatedHTML }.count
        if isolatedHTMLTableCount > 0 {
            return NativeReaderEligibility(
                state: .nativeWithTableFallback,
                reasons: ["isolatedHTMLTableCount: \(isolatedHTMLTableCount)"]
            )
        }
        return NativeReaderEligibility(state: .native, reasons: [])
    }

    private func makeSummary(chapters: [ChapterInventory]) -> CorpusInventorySummary {
        var eligibilityCounts: [String: Int] = [:]
        for chapter in chapters {
            eligibilityCounts[chapter.eligibility.state.rawValue, default: 0] += 1
        }
        for state in NativeReaderEligibilityState.allCases {
            eligibilityCounts[state.rawValue, default: 0] += 0
        }

        return CorpusInventorySummary(
            chapterCount: chapters.count,
            packageCount: Set(chapters.map(\.packageID)).count,
            codeFamilyCount: Set(chapters.map(\.codeFamily)).count,
            parserFailureCount: chapters.filter { !$0.parserSucceeded }.count,
            textOnlyChapterCount: chapters.filter { $0.tables.isEmpty && $0.images.isEmpty }.count,
            chapterCountWithTables: chapters.filter { !$0.tables.isEmpty }.count,
            chapterCountWithImages: chapters.filter { !$0.images.isEmpty }.count,
            tableCount: chapters.reduce(0) { $0 + $1.tables.count },
            imageCount: chapters.reduce(0) { $0 + $1.images.count },
            missingAssetCount: chapters.reduce(0) { $0 + $1.images.filter { !$0.assetExists }.count },
            stableAnchorCount: chapters.reduce(0) { $0 + $1.stableAnchors.count },
            eligibilityCounts: eligibilityCounts
        )
    }

    private func makeVocabulary(chapters: [ChapterInventory]) -> CorpusVocabulary {
        CorpusVocabulary(
            elementCounts: counts(chapters.flatMap(\.elementNames)),
            classCounts: counts(chapters.flatMap(\.classNames)),
            inlineCSSPropertyCounts: counts(chapters.flatMap(\.inlineCSSProperties)),
            unknownElementCounts: counts(chapters.flatMap(\.unknownElementNames)),
            unknownClassCounts: counts(chapters.flatMap(\.unknownClassNames)),
            unsupportedCSSPropertyCounts: counts(chapters.flatMap(\.unsupportedCSSProperties))
        )
    }

    private func makeGoldenChapterSet(chapters: [ChapterInventory]) -> [GoldenChapter] {
        var reasonsByPath: [String: Set<String>] = [:]
        func include(_ chapter: ChapterInventory?, reason: String) {
            guard let chapter else { return }
            reasonsByPath[chapter.relativePath, default: []].insert(reason)
        }

        for codeFamily in Set(chapters.map(\.codeFamily)).sorted() {
            include(
                chapters.filter { $0.codeFamily == codeFamily }.max { $0.sourceByteCount < $1.sourceByteCount },
                reason: "code family coverage: \(codeFamily)"
            )
        }
        include(
            chapters.filter { $0.tables.isEmpty && $0.images.isEmpty }.max { $0.normalizedTextCharacterCount < $1.normalizedTextCharacterCount },
            reason: "long text-only chapter"
        )
        include(chapters.max { $0.lists.maximumDepth < $1.lists.maximumDepth }, reason: "deepest native list structure")
        include(
            chapters.first { $0.tables.contains { $0.renderingClassification == .nativeSimple } },
            reason: "simple table"
        )
        include(
            chapters.first { $0.tables.contains { $0.renderingClassification == .isolatedHTML } },
            reason: "complex table fallback"
        )
        include(chapters.filter { !$0.images.isEmpty }.max { $0.images.count < $1.images.count }, reason: "image-heavy chapter")
        include(chapters.first { $0.images.contains { $0.element == "svg" } }, reason: "inline SVG")
        include(chapters.max { $0.sourceByteCount < $1.sourceByteCount }, reason: "largest source chapter")
        include(chapters.first { $0.chapterIdentifier.lowercased().contains("app") }, reason: "appendix naming")

        return reasonsByPath.map { GoldenChapter(relativePath: $0.key, reasons: $0.value.sorted()) }
            .sorted { $0.relativePath < $1.relativePath }
    }

    private func flattenedElements(from root: XMLElement) -> [XMLElement] {
        var result: [XMLElement] = []
        func visit(_ element: XMLElement) {
            result.append(element)
            for child in element.children ?? [] {
                if let childElement = child as? XMLElement {
                    visit(childElement)
                }
            }
        }
        visit(root)
        return result
    }

    private func isSectionBoundary(_ element: XMLElement) -> Bool {
        let classes = classTokens(element).map { $0.lowercased() }
        if classes.contains("toc-destination") { return true }
        let name = normalizedName(element)
        guard (name == "section" || (name.count == 2 && name.first == "h")),
              nonEmpty(attribute("id", in: element)) != nil else {
            return false
        }
        return true
    }

    private func isTextBlock(_ element: XMLElement) -> Bool {
        let name = normalizedName(element)
        if ["p", "blockquote", "pre", "li"].contains(name) {
            return !normalizeText(element.stringValue ?? "").isEmpty
        }
        guard name == "div" else { return false }
        let blockDescendants: Set<String> = ["div", "p", "blockquote", "pre", "ol", "ul", "table", "h1", "h2", "h3", "h4", "h5", "h6"]
        let containsBlockChild = (element.children ?? []).contains { child in
            guard let childElement = child as? XMLElement else { return false }
            return blockDescendants.contains(normalizedName(childElement))
        }
        guard !containsBlockChild else { return false }
        return !normalizeText(element.stringValue ?? "").isEmpty
    }

    private func borderSignaturesForElement(_ element: XMLElement) -> [String] {
        var values: [String] = []
        for attributeName in ["border", "frame", "rules", "cellspacing", "cellpadding"] {
            if let value = nonEmpty(attribute(attributeName, in: element)) {
                values.append("\(attributeName):\(value.lowercased())")
            }
        }
        if let style = attribute("style", in: element) {
            for declaration in style.split(separator: ";") {
                let pieces = declaration.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                guard pieces.count == 2, pieces[0].lowercased().hasPrefix("border") else { continue }
                values.append("\(pieces[0].lowercased()):\(pieces[1].lowercased())")
            }
        }
        return values
    }

    private func nearbyHeadingText(for element: XMLElement) -> String? {
        var candidate: XMLElement? = element
        for _ in 0..<3 {
            guard let current = candidate else { break }
            let name = normalizedName(current)
            if name.count == 2, name.first == "h" {
                return nonEmpty(normalizeText(current.stringValue ?? ""))
            }
            candidate = current.parent as? XMLElement
        }
        return nil
    }

    private func nearbyCaption(for element: XMLElement) -> String? {
        var ancestor = element.parent as? XMLElement
        for _ in 0..<3 {
            guard let current = ancestor else { break }
            let currentName = normalizedName(current)
            if currentName == "figure" {
                for candidate in flattenedElements(from: current).dropFirst() {
                    if isCaptionElement(candidate),
                       let caption = nonEmpty(normalizeText(candidate.stringValue ?? "")) {
                        return caption
                    }
                }
                return nil
            }
            for sibling in current.children?.compactMap({ $0 as? XMLElement }) ?? [] where sibling !== element {
                if isCaptionElement(sibling),
                   let caption = nonEmpty(normalizeText(sibling.stringValue ?? "")) {
                    return caption
                }
            }
            ancestor = current.parent as? XMLElement
        }
        return nil
    }

    private func isCaptionElement(_ element: XMLElement) -> Bool {
        let name = normalizedName(element)
        return name == "figcaption"
            || name == "caption"
            || classTokens(element).contains { $0.lowercased().contains("caption") }
    }

    private struct ImageManifestFile: Decodable {
        let items: [String: String]
    }

    private func loadImageManifest(packageRoot: URL) -> [String: String] {
        let url = packageRoot
            .appendingPathComponent("prepared", isDirectory: true)
            .appendingPathComponent("images.json")
        guard let data = try? Data(contentsOf: url),
              let manifest = try? JSONDecoder().decode(ImageManifestFile.self, from: data) else {
            return [:]
        }
        return manifest.items
    }

    private func resolveAsset(
        source: String,
        relativeTo chapterURL: URL,
        packageRoot: URL,
        imageManifest: [String: String]
    ) -> (url: URL?, exists: Bool) {
        let trimmed = source.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return (nil, false) }
        if trimmed.lowercased().hasPrefix("data:") {
            return (nil, true)
        }
        guard !trimmed.lowercased().hasPrefix("http://"),
              !trimmed.lowercased().hasPrefix("https://") else {
            return (nil, false)
        }
        let decoded = trimmed.removingPercentEncoding ?? trimmed
        let directURL = URL(
            fileURLWithPath: decoded,
            relativeTo: chapterURL.deletingLastPathComponent()
        ).standardizedFileURL
        if fileManager.fileExists(atPath: directURL.path) {
            return (directURL, true)
        }

        let fileName = URL(fileURLWithPath: decoded).lastPathComponent
        let baseName = (fileName as NSString).deletingPathExtension
        for key in [fileName, baseName, decoded] {
            guard let manifestPath = imageManifest[key] else { continue }
            let manifestURL = packageRoot.appendingPathComponent(manifestPath).standardizedFileURL
            if fileManager.fileExists(atPath: manifestURL.path) {
                return (manifestURL, true)
            }
            let assetURL = packageRoot
                .appendingPathComponent("assets", isDirectory: true)
                .appendingPathComponent(URL(fileURLWithPath: manifestPath).lastPathComponent)
                .standardizedFileURL
            if fileManager.fileExists(atPath: assetURL.path) {
                return (assetURL, true)
            }
        }
        let packageAssetURL = packageRoot
            .appendingPathComponent("assets", isDirectory: true)
            .appendingPathComponent(fileName)
            .standardizedFileURL
        if fileManager.fileExists(atPath: packageAssetURL.path) {
            return (packageAssetURL, true)
        }
        return (directURL, false)
    }

    private func cssValue(_ property: String, in element: XMLElement) -> String? {
        guard let style = attribute("style", in: element) else { return nil }
        for declaration in style.split(separator: ";") {
            let pieces = declaration.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            if pieces.count == 2, pieces[0].lowercased() == property.lowercased() {
                return nonEmpty(pieces[1])
            }
        }
        return nil
    }

    private func classTokens(_ element: XMLElement) -> [String] {
        guard let value = attribute("class", in: element) else { return [] }
        return value.split(whereSeparator: { $0.isWhitespace }).map(String.init).filter { !$0.isEmpty }
    }

    private func inlineCSSProperties(_ element: XMLElement) -> [String] {
        guard let style = attribute("style", in: element) else { return [] }
        return style.split(separator: ";").compactMap { declaration in
            let property = declaration.split(separator: ":", maxSplits: 1).first?
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            return nonEmpty(property ?? "")
        }
    }

    private func isRecognizedClassName(_ className: String) -> Bool {
        let normalized = className.lowercased()
        if Self.recognizedClassNames.contains(normalized) { return true }
        return Self.recognizedClassPrefixes.contains { normalized.hasPrefix($0) }
    }

    private func nearestAncestor(named name: String, from element: XMLElement) -> XMLElement? {
        var parent = element.parent as? XMLElement
        while let current = parent {
            if normalizedName(current) == name { return current }
            parent = current.parent as? XMLElement
        }
        return nil
    }

    private func isInsideIsolatedTable(
        _ element: XMLElement,
        isolatedTableElements: Set<ObjectIdentifier>
    ) -> Bool {
        var candidate: XMLElement? = element
        while let current = candidate {
            if normalizedName(current) == "table" {
                return isolatedTableElements.contains(ObjectIdentifier(current))
            }
            candidate = current.parent as? XMLElement
        }
        return false
    }

    private func normalizedName(_ element: XMLElement) -> String {
        (element.localName ?? element.name ?? "").lowercased()
    }

    private func attribute(_ name: String, in element: XMLElement) -> String? {
        element.attribute(forName: name)?.stringValue
    }

    private func normalizeText(_ value: String) -> String {
        value
            .replacingOccurrences(of: "\u{00A0}", with: " ")
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func tableSignature(
        rowCount: Int,
        columnCount: Int,
        cells: [TableCellSignature],
        caption: String?,
        footnotes: [String]
    ) -> String {
        (["rows=\(rowCount)", "columns=\(columnCount)", "caption=\(caption ?? "")"]
            + cells.map {
                "\($0.row)|\($0.column)|\($0.rowSpan)|\($0.columnSpan)|\($0.isHeader)|\($0.plainText)|\($0.anchorIDs.joined(separator: ","))|\($0.linkTargets.joined(separator: ","))"
            }
            + footnotes.map { "footnote=\($0)" })
            .joined(separator: "\n")
    }

    private func positiveInteger(_ value: String?) -> Int {
        max(Int(value ?? "") ?? 1, 1)
    }

    private func nonEmpty(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func sortedUnique(_ values: [String]) -> [String] {
        Array(Set(values.filter { !$0.isEmpty })).sorted()
    }

    private func orderedUnique(_ values: [String]) -> [String] {
        var seen: Set<String> = []
        return values.filter { seen.insert($0).inserted }
    }

    private func counts(_ values: [String]) -> [String: Int] {
        values.reduce(into: [:]) { $0[$1, default: 0] += 1 }
    }

    private func relativePath(for url: URL, below root: URL) -> String {
        let rootPath = root.standardizedFileURL.path
        let path = url.standardizedFileURL.path
        guard path == rootPath || path.hasPrefix(rootPath + "/") else { return path }
        return String(path.dropFirst(rootPath.count)).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }

    private func sha256(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    private struct TableGridPosition: Hashable {
        let row: Int
        let column: Int
    }

    private struct TableCellSignature {
        let row: Int
        let column: Int
        let rowSpan: Int
        let columnSpan: Int
        let isHeader: Bool
        let plainText: String
        let anchorIDs: [String]
        let linkTargets: [String]
    }

    private static let recognizedElementNames: Set<String> = [
        "html", "head", "meta", "title", "base", "link", "style", "body", "main", "article", "section",
        "header", "footer", "nav", "aside", "div", "span", "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
        "a", "area", "strong", "b", "em", "i", "u", "s", "strike", "small", "mark", "sup", "sub", "abbr", "cite",
        "q", "blockquote", "pre", "code", "kbd", "var", "dfn", "time", "wbr", "ol", "ul", "li", "dl", "dt", "dd",
        "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col", "img", "picture", "source",
        "figure", "figcaption", "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "defs",
        "clippath", "use", "symbol", "codeoptions", "annotationdrawer", "scrolltable"
    ]

    private static let recognizedClassNames: Set<String> = [
        "clearfix", "rbox", "toc-destination", "jump", "subarticle", "article", "section", "subsection", "subsubsection",
        "paragraph", "normal-level", "ednotesm", "ednote", "history", "indent", "centered", "center", "text-left", "text-right",
        "table", "xsl-table", "scrolltable", "caption", "figure", "image", "img", "code-figure", "footnote", "footnotes", "source-note", "editor-note",
        "reserved"
    ]

    private static let recognizedClassPrefixes = [
        "level-", "indent-", "normal-", "heading-", "table-", "xsl-", "cell-", "row-", "col-", "note-", "list-",
        "figure-", "image-", "align-", "text-", "nyc-", "zr-", "ac-", "bc-", "fc-", "mc-", "pc-", "fgc-",
        "chapter-", "section-", "subsection-"
    ]

    private static let supportedInlineCSSProperties: Set<String> = [
        "display", "visibility", "font", "font-family", "font-size", "font-style", "font-weight", "font-variant", "line-height",
        "letter-spacing", "word-spacing", "text-align", "text-decoration", "text-indent", "text-transform", "white-space",
        "vertical-align", "color", "background", "background-color", "width", "min-width", "max-width", "height", "min-height",
        "max-height", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "padding", "padding-top",
        "padding-right", "padding-bottom", "padding-left", "border", "border-top", "border-right", "border-bottom", "border-left",
        "border-width", "border-style", "border-color", "border-collapse", "border-spacing", "table-layout", "list-style",
        "list-style-type", "list-style-position", "page-break-before", "page-break-after", "page-break-inside", "break-before",
        "break-after", "break-inside", "float", "clear", "overflow", "overflow-x", "overflow-y", "object-fit", "aspect-ratio"
    ]
}
