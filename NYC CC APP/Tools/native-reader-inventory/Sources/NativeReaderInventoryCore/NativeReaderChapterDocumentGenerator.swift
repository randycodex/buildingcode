import CryptoKit
import Foundation

public struct NativeReaderChapterDocumentGenerator {
    private let fileManager: FileManager

    public init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
    }

    public func generate(
        fileURL: URL,
        sourceRoot: URL,
        inventory: ChapterInventory
    ) throws -> NativeReaderChapterDocument {
        let document = try parsedDocument(fileURL: fileURL)
        guard let root = document.rootElement() else {
            throw NativeReaderDocumentGenerationError.missingRootElement
        }

        let allElements = flattenedElements(from: root)
        let body = allElements.first { normalizedName($0) == "body" } ?? root
        let contentElements = flattenedElements(from: body)
        let sourceOrderByElement = Dictionary(
            uniqueKeysWithValues: contentElements.enumerated().map { (ObjectIdentifier($0.element), $0.offset) }
        )
        let documentID = stableID("document\u{0}\(inventory.relativePath)")
        let metadata = chapterMetadata(
            packageRoot: sourceRoot.appendingPathComponent(inventory.packageID, isDirectory: true),
            inventory: inventory
        )

        var drafts: [BlockDraft] = []
        appendBlocks(
            from: body,
            inheritedSectionID: nil,
            inventory: inventory,
            sourceOrderByElement: sourceOrderByElement,
            sourceRoot: sourceRoot,
            drafts: &drafts
        )

        // Tables can be authored inside list items or other semantic text
        // containers. Those containers become a single native block, so emit
        // every otherwise-unrepresented table as its own ordered block. Text
        // run construction excludes nested tables to avoid duplicating their
        // content in both the surrounding block and the table block.
        let structuralTableElements = contentElements.filter { normalizedName($0) == "table" }
        var representedTableIDs = Set(
            drafts.compactMap(\.table).map(\.id)
                + drafts.flatMap { $0.listItems.flatMap(embeddedTables) }.map(\.id)
        )
        for tableElement in structuralTableElements {
            let table = makeTable(
                element: tableElement,
                inventory: inventory,
                sourceOrderByElement: sourceOrderByElement
            )
            guard !representedTableIDs.contains(table.id) else { continue }
            let tableDraft = makeDraft(
                element: tableElement,
                forcedText: nil,
                forcedKind: .table,
                sectionID: sectionID(for: tableElement),
                inventory: inventory,
                sourceOrderByElement: sourceOrderByElement,
                sourceRoot: sourceRoot,
                sequence: drafts.count
            )
            let insertionIndex = drafts.firstIndex { $0.sourceOrder > tableDraft.sourceOrder } ?? drafts.endIndex
            drafts.insert(tableDraft, at: insertionIndex)
            representedTableIDs.insert(table.id)
        }

        let structuralMediaPairs = contentElements
            .filter(isTopLevelMediaElement)
            .compactMap { element -> (element: XMLElement, media: NativeReaderMedia)? in
                guard let media = makeMedia(
                    element: element,
                    inventory: inventory,
                    sourceOrderByElement: sourceOrderByElement,
                    sourceRoot: sourceRoot
                ) else {
                    return nil
                }
                return (element, media)
            }
        var representedMediaIDs = Set(drafts.flatMap { $0.media.map(\.id) })
        for pair in structuralMediaPairs where !representedMediaIDs.contains(pair.media.id) {
            let mediaDraft = makeDraft(
                element: pair.element,
                forcedText: nil,
                forcedKind: .image,
                sectionID: sectionID(for: pair.element),
                inventory: inventory,
                sourceOrderByElement: sourceOrderByElement,
                sourceRoot: sourceRoot,
                sequence: drafts.count
            )
            let insertionIndex = drafts.firstIndex { $0.sourceOrder > mediaDraft.sourceOrder } ?? drafts.endIndex
            drafts.insert(mediaDraft, at: insertionIndex)
            representedMediaIDs.insert(pair.media.id)
        }

        let anchorMappings = makeAnchorMappings(
            inventory: inventory,
            drafts: drafts,
            sourceOrderByElement: sourceOrderByElement
        )
        let anchorIDsByBlockID = Dictionary(grouping: anchorMappings.compactMap { mapping -> (String, String)? in
            guard let blockID = mapping.blockID else { return nil }
            return (blockID, mapping.id)
        }, by: \.0).mapValues { $0.map(\.1) }
        let blocks = drafts.map { draft in
            draft.block(anchorIDs: anchorIDsByBlockID[draft.id] ?? [])
        }
        let links = makeLinks(elements: contentElements, sourceOrderByElement: sourceOrderByElement)
        // Validation inventories every table and media element independently of
        // render blocks. A full-HTML fallback block may intentionally wrap several
        // rich elements, but those structures must still be proven accounted for.
        let structuralTables = contentElements
            .filter { normalizedName($0) == "table" }
            .map { makeTable(element: $0, inventory: inventory, sourceOrderByElement: sourceOrderByElement) }
        let structuralMedia = structuralMediaPairs.map(\.media)
        let validation = validate(
            inventory: inventory,
            body: body,
            blocks: blocks,
            anchors: anchorMappings,
            links: links,
            structuralTables: structuralTables,
            structuralMedia: structuralMedia
        )
        let eligibility = finalEligibility(inventory: inventory, validation: validation)

        return NativeReaderChapterDocument(
            parserSchemaVersion: CorpusInventoryGenerator.parserSchemaVersion,
            documentID: documentID,
            packageID: inventory.packageID,
            codeFamily: inventory.codeFamily,
            metadata: metadata,
            sourcePath: inventory.relativePath,
            sourceSHA256: inventory.sourceSHA256,
            normalizedTextSHA256: inventory.normalizedTextSHA256,
            normalizedTextCharacterCount: inventory.normalizedTextCharacterCount,
            eligibility: eligibility,
            blocks: blocks,
            anchors: anchorMappings,
            links: links,
            validation: validation
        )
    }

    public func fallbackDocument(
        fileURL: URL,
        sourceRoot: URL,
        inventory: ChapterInventory,
        message: String
    ) -> NativeReaderChapterDocument {
        let rawHTML = (try? String(contentsOf: fileURL, encoding: .utf8))
        let plainText = normalizeText(rawHTML ?? "")
        let documentID = stableID("document\u{0}\(inventory.relativePath)")
        let blockID = stableID("\(inventory.relativePath)\u{0}0\u{0}unsupportedHTML")
        let sourceReference = NativeReaderSourceReference(
            relativePath: inventory.relativePath,
            sourceOrder: 0,
            element: "document",
            sourceSHA256: inventory.sourceSHA256
        )
        let block = NativeReaderBlock(
            id: blockID,
            kind: .unsupportedHTML,
            sourceOrder: 0,
            sectionID: nil,
            anchorIDs: inventory.stableAnchors.map(\.id),
            plainText: plainText,
            runs: [],
            headingLevel: nil,
            listItems: [],
            table: nil,
            media: [],
            caption: nil,
            sourceReference: sourceReference,
            sourceHTML: rawHTML
        )
        let validation = NativeReaderDocumentValidation(
            normalizedTextMatches: false,
            anchorSequenceMatches: false,
            linkTargetsMatch: false,
            tableStructuresMatch: false,
            imageInventoryMatches: false,
            unsupportedBlockCount: 1,
            messages: [message]
        )
        let state: NativeReaderEligibilityState = inventory.eligibility.state == .invalidContent
            ? .invalidContent
            : .fullHTMLFallback
        let eligibility = NativeReaderEligibility(
            state: state,
            reasons: sortedUnique(inventory.eligibility.reasons + ["documentGenerationFailed: \(message)"])
        )

        return NativeReaderChapterDocument(
            parserSchemaVersion: CorpusInventoryGenerator.parserSchemaVersion,
            documentID: documentID,
            packageID: inventory.packageID,
            codeFamily: inventory.codeFamily,
            metadata: chapterMetadata(
                packageRoot: sourceRoot.appendingPathComponent(inventory.packageID, isDirectory: true),
                inventory: inventory
            ),
            sourcePath: inventory.relativePath,
            sourceSHA256: inventory.sourceSHA256,
            normalizedTextSHA256: inventory.normalizedTextSHA256,
            normalizedTextCharacterCount: inventory.normalizedTextCharacterCount,
            eligibility: eligibility,
            blocks: [block],
            anchors: inventory.stableAnchors.map {
                NativeReaderAnchorMapping(id: $0.id, sourceOrder: $0.sourceOrder, blockID: blockID, sectionID: nil)
            },
            links: [],
            validation: validation
        )
    }

    private func parsedDocument(fileURL: URL) throws -> XMLDocument {
        let parserURL = URL(fileURLWithPath: "/usr/bin/xmllint")
        guard fileManager.isExecutableFile(atPath: parserURL.path) else {
            throw NativeReaderDocumentGenerationError.parserUnavailable
        }
        let process = Process()
        let input = Pipe()
        let output = Pipe()
        process.executableURL = parserURL
        process.arguments = [
            "--html", "--xmlout", "--recover", "--nowarning", "--nonet", "--dropdtd",
            "--encode", "UTF-8", "-"
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
            throw NativeReaderDocumentGenerationError.parseFailed(Int(process.terminationStatus))
        }
        return try XMLDocument(data: normalizedData, options: [.nodeLoadExternalEntitiesNever])
    }

    private func appendBlocks(
        from container: XMLElement,
        inheritedSectionID: String?,
        inventory: ChapterInventory,
        sourceOrderByElement: [ObjectIdentifier: Int],
        sourceRoot: URL,
        drafts: inout [BlockDraft]
    ) {
        let containerSectionID = sectionID(for: container) ?? inheritedSectionID
        for child in container.children ?? [] {
            guard let element = child as? XMLElement else {
                guard child.kind == .text,
                      let text = child.stringValue,
                      !normalizeText(text).isEmpty else { continue }
                drafts.append(
                    makeDraft(
                        element: container,
                        forcedText: text,
                        forcedKind: .paragraph,
                        sectionID: containerSectionID,
                        inventory: inventory,
                        sourceOrderByElement: sourceOrderByElement,
                        sourceRoot: sourceRoot,
                        sequence: drafts.count
                    )
                )
                continue
            }

            let name = normalizedName(element)
            let currentSectionID = sectionID(for: element) ?? containerSectionID
            if shouldIgnore(element), normalizeText(element.stringValue ?? "").isEmpty {
                continue
            }
            if containsUnsupportedMarkup(
                element,
                inventory: inventory,
                sourceOrderByElement: sourceOrderByElement
            ) {
                drafts.append(
                    makeDraft(
                        element: element,
                        forcedText: nil,
                        forcedKind: .unsupportedHTML,
                        sectionID: currentSectionID,
                        inventory: inventory,
                        sourceOrderByElement: sourceOrderByElement,
                        sourceRoot: sourceRoot,
                        sequence: drafts.count
                    )
                )
                continue
            }
            if let kind = semanticBlockKind(for: element) {
                drafts.append(
                    makeDraft(
                        element: element,
                        forcedText: nil,
                        forcedKind: kind,
                        sectionID: currentSectionID,
                        inventory: inventory,
                        sourceOrderByElement: sourceOrderByElement,
                        sourceRoot: sourceRoot,
                        sequence: drafts.count
                    )
                )
                continue
            }
            if isContainer(element) {
                appendBlocks(
                    from: element,
                    inheritedSectionID: currentSectionID,
                    inventory: inventory,
                    sourceOrderByElement: sourceOrderByElement,
                    sourceRoot: sourceRoot,
                    drafts: &drafts
                )
                continue
            }
            if !normalizeText(element.stringValue ?? "").isEmpty || ["img", "svg"].contains(name) {
                drafts.append(
                    makeDraft(
                        element: element,
                        forcedText: nil,
                        forcedKind: .paragraph,
                        sectionID: currentSectionID,
                        inventory: inventory,
                        sourceOrderByElement: sourceOrderByElement,
                        sourceRoot: sourceRoot,
                        sequence: drafts.count
                    )
                )
            }
        }
    }

    private func makeDraft(
        element: XMLElement,
        forcedText: String?,
        forcedKind: NativeReaderBlockKind,
        sectionID: String?,
        inventory: ChapterInventory,
        sourceOrderByElement: [ObjectIdentifier: Int],
        sourceRoot: URL,
        sequence: Int
    ) -> BlockDraft {
        let sourceOrder = sourceOrderByElement[ObjectIdentifier(element)] ?? 0
        let name = normalizedName(element)
        let ownAnchorIDs = anchorIDs(in: element)
        let id = stableID(
            "\(CorpusInventoryGenerator.parserSchemaVersion)\u{0}\(inventory.relativePath)\u{0}\(sourceOrder)\u{0}\(sequence)\u{0}\(forcedKind.rawValue)\u{0}\(ownAnchorIDs.joined(separator: ","))"
        )
        let sourceReference = NativeReaderSourceReference(
            relativePath: inventory.relativePath,
            sourceOrder: sourceOrder,
            element: name,
            sourceSHA256: inventory.sourceSHA256
        )
        let headingLevel = forcedKind == .heading ? Int(name.dropFirst()) : nil
        let runs = [.table, .image, .figure, .divider, .unsupportedHTML].contains(forcedKind)
            ? []
            : textRuns(in: element)
        let plainText: String
        if let forcedText {
            plainText = normalizeText(forcedText)
        } else if runs.isEmpty {
            plainText = normalizeText(element.stringValue ?? "")
        } else {
            plainText = normalizeText(runs.map(\.text).joined())
        }
        let listItems: [NativeReaderListItem]
        if forcedKind == .orderedList || forcedKind == .unorderedList {
            listItems = makeListItems(
                in: element,
                depth: 1,
                ordered: forcedKind == .orderedList,
                inventory: inventory,
                sourceOrderByElement: sourceOrderByElement,
                sourceRoot: sourceRoot
            )
        } else {
            listItems = []
        }
        let table: NativeReaderTable?
        if forcedKind == .table {
            table = makeTable(
                element: element,
                inventory: inventory,
                sourceOrderByElement: sourceOrderByElement
            )
        } else {
            table = nil
        }
        let mediaElements: [XMLElement]
        if forcedKind == .image {
            mediaElements = [element]
        } else if forcedKind == .figure || forcedKind == .table || forcedKind == .unsupportedHTML {
            mediaElements = flattenedElements(from: element).filter(isTopLevelMediaElement)
        } else {
            mediaElements = []
        }
        let media = mediaElements.compactMap {
            makeMedia(
                element: $0,
                inventory: inventory,
                sourceOrderByElement: sourceOrderByElement,
                sourceRoot: sourceRoot
            )
        }
        let caption = captionText(in: element)
        let sourceHTML: String?
        if forcedKind == .unsupportedHTML
            || forcedKind == .figure
            || table?.renderingClassification == .isolatedHTML
            || media.contains(where: { $0.element == "svg" && $0.source == nil }) {
            sourceHTML = element.xmlString
        } else {
            sourceHTML = nil
        }

        return BlockDraft(
            id: id,
            element: element,
            kind: forcedKind,
            sourceOrder: sourceOrder,
            sectionID: sectionID,
            plainText: plainText,
            runs: runs,
            headingLevel: headingLevel,
            listItems: listItems,
            table: table,
            media: media,
            caption: caption,
            sourceReference: sourceReference,
            sourceHTML: sourceHTML,
            descendantSourceOrders: Set(flattenedElements(from: element).compactMap {
                sourceOrderByElement[ObjectIdentifier($0)]
            })
        )
    }

    private func semanticBlockKind(for element: XMLElement) -> NativeReaderBlockKind? {
        let name = normalizedName(element)
        if name.count == 2, name.first == "h", Int(name.dropFirst()) != nil { return .heading }
        if name == "ol" { return .orderedList }
        if name == "ul" { return .unorderedList }
        if name == "table" { return .table }
        if name == "figure" { return .figure }
        if name == "img" || name == "svg" { return .image }
        if name == "figcaption" || name == "caption" { return .caption }
        if name == "hr" { return .divider }
        if name == "aside" { return .sourceNote }
        if ["p", "blockquote", "pre"].contains(name) {
            let classes = classTokens(element).map { $0.lowercased() }
            if classes.contains(where: { $0.contains("editor") || $0 == "ednote" || $0 == "ednotesm" }) {
                return .editorNote
            }
            if classes.contains(where: { $0.contains("source") || $0.contains("history") }) {
                return .sourceNote
            }
            if classes.contains(where: { $0.contains("footnote") }) { return .footnote }
            return .paragraph
        }
        return nil
    }

    private func isContainer(_ element: XMLElement) -> Bool {
        let name = normalizedName(element)
        if ["body", "main", "article", "section", "header", "footer", "nav", "scrolltable"].contains(name) {
            return true
        }
        guard ["div", "span", "center"].contains(name) else { return false }
        let blockNames: Set<String> = [
            "div", "section", "article", "p", "blockquote", "pre", "ol", "ul", "table", "figure", "img", "svg",
            "h1", "h2", "h3", "h4", "h5", "h6", "hr", "aside", "scrolltable"
        ]
        return (element.children ?? []).contains { child in
            guard let childElement = child as? XMLElement else { return false }
            return blockNames.contains(normalizedName(childElement))
        }
    }

    private func shouldIgnore(_ element: XMLElement) -> Bool {
        ["codeoptions", "annotationdrawer", "meta", "base", "style", "script", "title"].contains(normalizedName(element))
    }

    private func containsUnsupportedMarkup(
        _ element: XMLElement,
        inventory: ChapterInventory,
        sourceOrderByElement: [ObjectIdentifier: Int]
    ) -> Bool {
        let unknownElements = Set(inventory.unknownElementNames)
        let unknownClasses = Set(inventory.unknownClassNames.map { $0.lowercased() })
        let unsupportedCSS = Set(inventory.unsupportedCSSProperties)
        return flattenedElements(from: element).contains { candidate in
            if isInsideIsolatedTable(
                candidate,
                inventory: inventory,
                sourceOrderByElement: sourceOrderByElement
            ) {
                return false
            }
            if unknownElements.contains(normalizedName(candidate)) { return true }
            if classTokens(candidate).contains(where: { unknownClasses.contains($0.lowercased()) }) { return true }
            return inlineCSSProperties(candidate).contains(where: unsupportedCSS.contains)
        }
    }

    private func isInsideIsolatedTable(
        _ element: XMLElement,
        inventory: ChapterInventory,
        sourceOrderByElement: [ObjectIdentifier: Int]
    ) -> Bool {
        var candidate: XMLElement? = element
        while let current = candidate {
            if normalizedName(current) == "table",
               let sourceOrder = sourceOrderByElement[ObjectIdentifier(current)] {
                return inventory.tables.first(where: { $0.sourceOrder == sourceOrder })?
                    .renderingClassification == .isolatedHTML
            }
            candidate = current.parent as? XMLElement
        }
        return false
    }

    private func makeListItems(
        in list: XMLElement,
        depth: Int,
        ordered: Bool,
        inventory: ChapterInventory,
        sourceOrderByElement: [ObjectIdentifier: Int],
        sourceRoot: URL
    ) -> [NativeReaderListItem] {
        let directItems = (list.children ?? []).compactMap { $0 as? XMLElement }.filter { normalizedName($0) == "li" }
        return directItems.enumerated().map { offset, item in
            let sourceOrder = sourceOrderByElement[ObjectIdentifier(item)] ?? 0
            let nestedLists = (item.children ?? []).compactMap { $0 as? XMLElement }.filter {
                ["ol", "ul"].contains(normalizedName($0))
            }
            let segments = makeListSegments(
                in: item,
                inventory: inventory,
                sourceOrderByElement: sourceOrderByElement,
                sourceRoot: sourceRoot
            )
            let runs = segments.filter { $0.kind == .text }.flatMap(\.runs)
            let directText = normalizeText(segments.map(\.plainText).joined(separator: " "))
            let children = nestedLists.flatMap {
                makeListItems(
                    in: $0,
                    depth: depth + 1,
                    ordered: normalizedName($0) == "ol",
                    inventory: inventory,
                    sourceOrderByElement: sourceOrderByElement,
                    sourceRoot: sourceRoot
                )
            }
            return NativeReaderListItem(
                id: stableID("\(inventory.relativePath)\u{0}list-item\u{0}\(sourceOrder)\u{0}\(offset)"),
                depth: depth,
                ordinal: ordered ? offset + 1 : nil,
                plainText: directText,
                runs: runs,
                segments: segments,
                children: children
            )
        }
    }

    private func makeListSegments(
        in item: XMLElement,
        inventory: ChapterInventory,
        sourceOrderByElement: [ObjectIdentifier: Int],
        sourceRoot: URL
    ) -> [NativeReaderListSegment] {
        let itemSourceOrder = sourceOrderByElement[ObjectIdentifier(item)] ?? 0
        var segments: [NativeReaderListSegment] = []
        var pendingRuns: [NativeReaderTextRun] = []

        func flushText() {
            let mergedRuns = mergeTextRuns(pendingRuns)
            let text = normalizeText(mergedRuns.map(\.text).joined())
            pendingRuns.removeAll(keepingCapacity: true)
            guard !text.isEmpty else { return }
            segments.append(
                NativeReaderListSegment(
                    id: stableID("\(inventory.relativePath)\u{0}list-segment\u{0}\(itemSourceOrder)\u{0}\(segments.count)\u{0}text"),
                    kind: .text,
                    plainText: text,
                    runs: mergedRuns,
                    table: nil
                )
            )
        }

        for child in item.children ?? [] {
            if let element = child as? XMLElement {
                let name = normalizedName(element)
                if ["ol", "ul"].contains(name) {
                    continue
                }
                if name == "table" {
                    flushText()
                    let table = makeTable(
                        element: element,
                        inventory: inventory,
                        sourceOrderByElement: sourceOrderByElement
                    )
                    segments.append(
                        NativeReaderListSegment(
                            id: stableID("\(inventory.relativePath)\u{0}list-segment\u{0}\(itemSourceOrder)\u{0}\(segments.count)\u{0}\(table.id)"),
                            kind: .table,
                            plainText: normalizeText(element.stringValue ?? ""),
                            runs: [],
                            table: table
                        )
                    )
                    continue
                }
            }
            appendTextRuns(
                from: child,
                styles: [],
                linkTarget: nil,
                excludingNestedLists: true,
                isRoot: false,
                runs: &pendingRuns
            )
        }
        flushText()
        return segments
    }

    private func embeddedTables(in item: NativeReaderListItem) -> [NativeReaderTable] {
        item.segments.compactMap(\.table) + item.children.flatMap(embeddedTables)
    }

    private func makeTable(
        element table: XMLElement,
        inventory: ChapterInventory,
        sourceOrderByElement: [ObjectIdentifier: Int]
    ) -> NativeReaderTable {
        let sourceOrder = sourceOrderByElement[ObjectIdentifier(table)] ?? 0
        let inventoryTable = inventory.tables.first { $0.sourceOrder == sourceOrder }
        let descendants = flattenedElements(from: table)
        let rows = descendants.filter {
            normalizedName($0) == "tr" && nearestAncestor(named: "table", from: $0) === table
        }
        var occupied: Set<GridPosition> = []
        var cells: [NativeReaderTableCell] = []
        var columnCount = 0
        for (rowIndex, row) in rows.enumerated() {
            let rowCells = flattenedElements(from: row).filter {
                ["td", "th"].contains(normalizedName($0)) && nearestAncestor(named: "tr", from: $0) === row
            }
            var columnIndex = 0
            for cell in rowCells {
                while occupied.contains(GridPosition(row: rowIndex, column: columnIndex)) {
                    columnIndex += 1
                }
                let rowSpan = positiveInteger(attribute("rowspan", in: cell))
                let columnSpan = positiveInteger(attribute("colspan", in: cell))
                for occupiedRow in rowIndex..<(rowIndex + rowSpan) {
                    for occupiedColumn in columnIndex..<(columnIndex + columnSpan) {
                        occupied.insert(GridPosition(row: occupiedRow, column: occupiedColumn))
                    }
                }
                let cellElements = flattenedElements(from: cell)
                let linkTargets = cellElements.compactMap { candidate -> String? in
                    guard ["a", "link", "area"].contains(normalizedName(candidate)) else { return nil }
                    return nonEmpty(attribute("href", in: candidate)) ?? nonEmpty(attribute("to", in: candidate))
                }
                cells.append(
                    NativeReaderTableCell(
                        row: rowIndex,
                        column: columnIndex,
                        rowSpan: rowSpan,
                        columnSpan: columnSpan,
                        isHeader: normalizedName(cell) == "th",
                        plainText: normalizeText(cell.stringValue ?? ""),
                        runs: textRuns(in: cell),
                        anchorIDs: anchorIDs(in: cell),
                        linkTargets: linkTargets,
                        classNames: classTokens(cell),
                        inlineStyle: nonEmpty(attribute("style", in: cell)),
                        borderSignatures: borderSignatures(for: cell)
                    )
                )
                columnIndex += columnSpan
                columnCount = max(columnCount, columnIndex)
            }
        }
        let caption = inventoryTable?.caption ?? captionText(in: table)
        let footnotes = inventoryTable?.footnotes ?? []
        let classification = inventoryTable?.renderingClassification ?? .isolatedHTML
        let reasons = inventoryTable?.classificationReasons ?? ["missingInventoryRecord"]
        let logicalRowCount = max(
            rows.count,
            cells.map { $0.row + $0.rowSpan }.max() ?? 0
        )
        let signature = tableSignature(
            rowCount: logicalRowCount,
            columnCount: columnCount,
            cells: cells,
            caption: caption,
            footnotes: footnotes
        )
        return NativeReaderTable(
            id: stableID("\(inventory.relativePath)\u{0}table\u{0}\(sourceOrder)"),
            rowCount: logicalRowCount,
            columnCount: columnCount,
            cells: cells,
            caption: caption,
            footnotes: footnotes,
            renderingClassification: classification,
            classificationReasons: reasons,
            structureSHA256: stableID(signature),
            sourceHTML: classification == .isolatedHTML ? table.xmlString : nil
        )
    }

    private func makeMedia(
        element: XMLElement,
        inventory: ChapterInventory,
        sourceOrderByElement: [ObjectIdentifier: Int],
        sourceRoot: URL
    ) -> NativeReaderMedia? {
        let sourceOrder = sourceOrderByElement[ObjectIdentifier(element)] ?? 0
        guard let image = inventory.images.first(where: { $0.sourceOrder == sourceOrder }) else { return nil }
        let assetHash: String?
        if let path = image.resolvedAssetPath {
            let url = path.hasPrefix("/") ? URL(fileURLWithPath: path) : sourceRoot.appendingPathComponent(path)
            assetHash = (try? Data(contentsOf: url)).map(sha256)
        } else {
            assetHash = nil
        }
        return NativeReaderMedia(
            id: stableID("\(inventory.relativePath)\u{0}media\u{0}\(sourceOrder)"),
            element: image.element,
            source: image.source,
            resolvedAssetPath: image.resolvedAssetPath,
            assetExists: image.assetExists,
            assetSHA256: assetHash,
            width: image.width,
            height: image.height,
            caption: image.caption,
            accessibilityText: image.accessibilityText,
            sourceHTML: image.element == "svg" && image.source == nil ? element.xmlString : nil
        )
    }

    private func makeAnchorMappings(
        inventory: ChapterInventory,
        drafts: [BlockDraft],
        sourceOrderByElement: [ObjectIdentifier: Int]
    ) -> [NativeReaderAnchorMapping] {
        inventory.stableAnchors.map { anchor in
            let containingDraft = drafts.first { $0.descendantSourceOrders.contains(anchor.sourceOrder) }
            let followingDraft = drafts.first { $0.sourceOrder >= anchor.sourceOrder }
            let draft = containingDraft ?? followingDraft ?? drafts.last
            let section = anchor.id.lowercased().hasPrefix("section-") ? anchor.id : draft?.sectionID
            return NativeReaderAnchorMapping(
                id: anchor.id,
                sourceOrder: anchor.sourceOrder,
                blockID: draft?.id,
                sectionID: section
            )
        }
    }

    private func makeLinks(
        elements: [XMLElement],
        sourceOrderByElement: [ObjectIdentifier: Int]
    ) -> [NativeReaderLink] {
        elements.compactMap { element in
            let name = normalizedName(element)
            guard ["a", "link", "area", "intercodelink"].contains(name),
                  let target = resolvedLinkTarget(for: element) else {
                return nil
            }
            return NativeReaderLink(
                sourceOrder: sourceOrderByElement[ObjectIdentifier(element)] ?? 0,
                element: name,
                target: target,
                text: normalizeText(element.stringValue ?? ""),
                isInternalAnchor: target.hasPrefix("#") || target.contains("hash:")
            )
        }
    }

    private func validate(
        inventory: ChapterInventory,
        body: XMLElement,
        blocks: [NativeReaderBlock],
        anchors: [NativeReaderAnchorMapping],
        links: [NativeReaderLink],
        structuralTables: [NativeReaderTable],
        structuralMedia: [NativeReaderMedia]
    ) -> NativeReaderDocumentValidation {
        let sourceText = normalizeText(body.stringValue ?? "")
        let documentText = normalizeText(blocks.flatMap(validationText).joined(separator: " "))
        // HTML element boundaries may carry semantic word separation even when the
        // source has no literal whitespace between closing and opening tags. Compare
        // the enacted character stream after whitespace normalization so block
        // partitioning cannot create a false loss/reordering failure.
        let normalizedTextMatches = canonicalTextForComparison(sourceText)
            == canonicalTextForComparison(documentText)
        let anchorSequenceMatches = anchors.map(\.id) == inventory.stableAnchors.map(\.id)
            && anchors.allSatisfy { $0.blockID != nil || blocks.isEmpty }

        let generatedLinkCounts = linkCounts(links.map { ($0.element, $0.target) })
        let inventoryLinkCounts = Dictionary(uniqueKeysWithValues: inventory.links.map {
            ("\($0.element)\u{0}\($0.target)", $0.occurrences)
        })
        let linkTargetsMatch = generatedLinkCounts == inventoryLinkCounts

        let tableStructuresMatch = structuralTables.count == inventory.tables.count
            && zip(structuralTables, inventory.tables).allSatisfy { table, source in
                table.rowCount == source.rowCount
                    && table.columnCount == source.logicalColumnCount
                    && table.cells.count == source.cellCount
                    && (table.cells.map(\.rowSpan).max() ?? 1) == source.maximumRowSpan
                    && (table.cells.map(\.columnSpan).max() ?? 1) == source.maximumColumnSpan
                    && table.caption == source.caption
                    && table.footnotes == source.footnotes
                    && table.structureSHA256 == source.structureSHA256
            }

        let renderedMedia = blocks.flatMap(\.media).sorted { $0.id < $1.id }
        let validatedStructuralMedia = structuralMedia.sorted { $0.id < $1.id }
        let imageInventoryMatches = renderedMedia == validatedStructuralMedia
            && structuralMedia.count == inventory.images.count
            && zip(structuralMedia, inventory.images).allSatisfy { media, source in
                media.element == source.element
                    && media.source == source.source
                    && media.resolvedAssetPath == source.resolvedAssetPath
                    && media.assetExists == source.assetExists
                    && media.caption == source.caption
                    && media.accessibilityText == source.accessibilityText
            }

        let unsupportedBlockCount = blocks.filter { $0.kind == .unsupportedHTML }.count
        var messages: [String] = []
        if !normalizedTextMatches { messages.append("normalizedTextMismatch") }
        if !anchorSequenceMatches { messages.append("anchorSequenceMismatch") }
        if !linkTargetsMatch { messages.append("linkTargetsMismatch") }
        if !tableStructuresMatch { messages.append("tableStructuresMismatch") }
        if !imageInventoryMatches { messages.append("imageInventoryMismatch") }
        if unsupportedBlockCount > 0 { messages.append("unsupportedBlocks: \(unsupportedBlockCount)") }
        return NativeReaderDocumentValidation(
            normalizedTextMatches: normalizedTextMatches,
            anchorSequenceMatches: anchorSequenceMatches,
            linkTargetsMatch: linkTargetsMatch,
            tableStructuresMatch: tableStructuresMatch,
            imageInventoryMatches: imageInventoryMatches,
            unsupportedBlockCount: unsupportedBlockCount,
            messages: messages
        )
    }

    private func validationText(for block: NativeReaderBlock) -> [String] {
        guard block.kind == .orderedList || block.kind == .unorderedList else {
            return [block.plainText]
        }
        return block.listItems.flatMap(validationText)
    }

    private func validationText(for item: NativeReaderListItem) -> [String] {
        [item.plainText] + item.children.flatMap(validationText)
    }

    private func finalEligibility(
        inventory: ChapterInventory,
        validation: NativeReaderDocumentValidation
    ) -> NativeReaderEligibility {
        if inventory.eligibility.state == .invalidContent {
            return inventory.eligibility
        }
        var reasons = inventory.eligibility.reasons
        if !validation.passesStructuralValidation {
            reasons.append(contentsOf: validation.messages.filter { !$0.hasPrefix("unsupportedBlocks:") })
        }
        if validation.unsupportedBlockCount > 0 {
            reasons.append("unsupportedBlocks: \(validation.unsupportedBlockCount)")
        }
        if !validation.passesStructuralValidation || validation.unsupportedBlockCount > 0 {
            return NativeReaderEligibility(state: .fullHTMLFallback, reasons: sortedUnique(reasons))
        }
        return NativeReaderEligibility(state: inventory.eligibility.state, reasons: sortedUnique(reasons))
    }

    private func textRuns(in element: XMLElement, excludingNestedLists: Bool = false) -> [NativeReaderTextRun] {
        var runs: [NativeReaderTextRun] = []
        appendTextRuns(
            from: element,
            styles: [],
            linkTarget: nil,
            excludingNestedLists: excludingNestedLists,
            isRoot: true,
            runs: &runs
        )
        return mergeTextRuns(runs)
    }

    private func appendTextRuns(
        from node: XMLNode,
        styles: Set<NativeReaderTextStyle>,
        linkTarget: String?,
        excludingNestedLists: Bool,
        isRoot: Bool,
        runs: inout [NativeReaderTextRun]
    ) {
        if node.kind == .text {
            guard let text = node.stringValue, !text.isEmpty else { return }
            runs.append(NativeReaderTextRun(text: text, styles: styles.sorted { $0.rawValue < $1.rawValue }, linkTarget: linkTarget))
            return
        }
        guard let element = node as? XMLElement else { return }
        let name = normalizedName(element)
        if excludingNestedLists && !isRoot && ["ol", "ul"].contains(name) { return }
        if !isRoot && name == "table" { return }
        if name == "br" {
            runs.append(NativeReaderTextRun(text: "\n", styles: styles.sorted { $0.rawValue < $1.rawValue }, linkTarget: linkTarget))
            return
        }
        if shouldIgnore(element) { return }
        var nextStyles = styles
        switch name {
        case "strong", "b": nextStyles.insert(.bold)
        case "em", "i": nextStyles.insert(.italic)
        case "u": nextStyles.insert(.underline)
        case "s", "strike": nextStyles.insert(.strikethrough)
        case "sup": nextStyles.insert(.superscript)
        case "sub": nextStyles.insert(.subscript)
        case "code", "pre", "kbd": nextStyles.insert(.code)
        case "small": nextStyles.insert(.small)
        default: break
        }
        let style = (attribute("style", in: element) ?? "").lowercased()
        if style.contains("font-weight: bold") || style.contains("font-weight:bold") { nextStyles.insert(.bold) }
        if style.contains("font-style: italic") || style.contains("font-style:italic") { nextStyles.insert(.italic) }
        if style.contains("text-decoration") && style.contains("underline") { nextStyles.insert(.underline) }
        if style.contains("text-decoration") && style.contains("line-through") { nextStyles.insert(.strikethrough) }
        if style.contains("vertical-align: super") || style.contains("vertical-align:super") { nextStyles.insert(.superscript) }
        if style.contains("vertical-align: sub") || style.contains("vertical-align:sub") { nextStyles.insert(.subscript) }
        let nextTarget = resolvedLinkTarget(for: element) ?? linkTarget
        for child in element.children ?? [] {
            appendTextRuns(
                from: child,
                styles: nextStyles,
                linkTarget: nextTarget,
                excludingNestedLists: excludingNestedLists,
                isRoot: false,
                runs: &runs
            )
        }
    }

    private func mergeTextRuns(_ runs: [NativeReaderTextRun]) -> [NativeReaderTextRun] {
        var result: [NativeReaderTextRun] = []
        for run in runs where !run.text.isEmpty {
            if let last = result.last, last.styles == run.styles, last.linkTarget == run.linkTarget {
                result.removeLast()
                result.append(
                    NativeReaderTextRun(text: last.text + run.text, styles: run.styles, linkTarget: run.linkTarget)
                )
            } else {
                result.append(run)
            }
        }
        return result
    }

    private func resolvedLinkTarget(for element: XMLElement) -> String? {
        if let target = nonEmpty(attribute("href", in: element))
            ?? nonEmpty(attribute("to", in: element)) {
            return target
        }
        guard normalizedName(element) == "intercodelink",
              let destinationID = nonEmpty(attribute("destinationid", in: element))
                ?? nonEmpty(attribute("destinationId", in: element)) else {
            return nil
        }
        return destinationID.hasPrefix("#") ? destinationID : "#\(destinationID)"
    }

    private struct AuthoredBundle: Decodable {
        struct CodeSection: Decodable { let id: Int64; let name: String }
        struct Chapter: Decodable {
            let id: Int64
            let codeSectionID: Int64?
            let chapterNumber: String
            let title: String
        }
        let codeSections: [CodeSection]?
        let chapters: [Chapter]
    }

    private func chapterMetadata(packageRoot: URL, inventory: ChapterInventory) -> NativeReaderChapterMetadata {
        let bundleURL = packageRoot.appendingPathComponent("bundle.json")
        guard let data = try? Data(contentsOf: bundleURL),
              let bundle = try? JSONDecoder().decode(AuthoredBundle.self, from: data) else {
            return NativeReaderChapterMetadata(
                codeVersion: inventory.packageID,
                codeSectionID: nil,
                codeSectionName: nil,
                chapterID: nil,
                chapterIdentifier: inventory.chapterIdentifier,
                chapterNumber: nil,
                chapterTitle: nil
            )
        }
        let familySlug = inventory.codeFamily.split(separator: "/").last.map(String.init)
        let matchingCodeSection = bundle.codeSections?.first {
            slug($0.name) == familySlug || (familySlug == "default" && $0.id == bundle.codeSections?.first?.id)
        }
        let normalizedIdentifier = normalizedChapterIdentifier(inventory.chapterIdentifier)
        let candidates = bundle.chapters.filter { chapter in
            if String(chapter.id) == inventory.chapterIdentifier { return true }
            guard normalizedChapterIdentifier(chapter.chapterNumber) == normalizedIdentifier else { return false }
            return matchingCodeSection == nil || chapter.codeSectionID == matchingCodeSection?.id
        }
        let chapter = candidates.first ?? bundle.chapters.first { String($0.id) == inventory.chapterIdentifier }
        let codeSection = bundle.codeSections?.first { $0.id == chapter?.codeSectionID } ?? matchingCodeSection
        return NativeReaderChapterMetadata(
            codeVersion: inventory.packageID,
            codeSectionID: chapter?.codeSectionID ?? codeSection?.id,
            codeSectionName: codeSection?.name,
            chapterID: chapter?.id,
            chapterIdentifier: inventory.chapterIdentifier,
            chapterNumber: chapter?.chapterNumber,
            chapterTitle: chapter?.title
        )
    }

    private func normalizedChapterIdentifier(_ value: String) -> String {
        value.lowercased()
            .replacingOccurrences(of: "chapter", with: "")
            .replacingOccurrences(of: "appendices", with: "appendix")
            .filter { $0.isLetter || $0.isNumber }
    }

    private func slug(_ value: String) -> String {
        value.lowercased()
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .joined(separator: "-")
    }

    private func sectionID(for element: XMLElement) -> String? {
        var candidate: XMLElement? = element
        while let current = candidate {
            if let id = nonEmpty(attribute("id", in: current)) {
                let name = normalizedName(current)
                let classes = classTokens(current).map { $0.lowercased() }
                if name == "section" || id.lowercased().hasPrefix("section-") || classes.contains("toc-destination") {
                    return id
                }
            }
            candidate = current.parent as? XMLElement
        }
        return nil
    }

    private func anchorIDs(in element: XMLElement) -> [String] {
        var values: [String] = []
        for candidate in flattenedElements(from: element) {
            if let id = nonEmpty(attribute("id", in: candidate)) { values.append(id) }
            if normalizedName(candidate) == "a", let name = nonEmpty(attribute("name", in: candidate)) {
                values.append(name)
            }
        }
        return orderedUnique(values)
    }

    private func captionText(in element: XMLElement) -> String? {
        flattenedElements(from: element).dropFirst().first { candidate in
            normalizedName(candidate) == "caption"
                || normalizedName(candidate) == "figcaption"
                || classTokens(candidate).contains { $0.lowercased().contains("caption") }
        }.flatMap { nonEmpty(normalizeText($0.stringValue ?? "")) }
    }

    private func isTopLevelMediaElement(_ element: XMLElement) -> Bool {
        let name = normalizedName(element)
        guard ["img", "svg"].contains(name) else { return false }
        return name != "svg" || nearestAncestor(named: "svg", from: element) == nil
    }

    private func tableSignature(
        rowCount: Int,
        columnCount: Int,
        cells: [NativeReaderTableCell],
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

    private func linkCounts(_ values: [(String, String)]) -> [String: Int] {
        values.reduce(into: [:]) { result, value in
            result["\(value.0)\u{0}\(value.1)", default: 0] += 1
        }
    }

    private func borderSignatures(for element: XMLElement) -> [String] {
        var values: [String] = []
        for name in ["border", "frame", "rules", "cellspacing", "cellpadding"] {
            if let value = nonEmpty(attribute(name, in: element)) {
                values.append("\(name):\(value.lowercased())")
            }
        }
        if let style = attribute("style", in: element) {
            for declaration in style.split(separator: ";") {
                let pieces = declaration.split(separator: ":", maxSplits: 1).map {
                    $0.trimmingCharacters(in: .whitespacesAndNewlines)
                }
                if pieces.count == 2, pieces[0].lowercased().hasPrefix("border") {
                    values.append("\(pieces[0].lowercased()):\(pieces[1].lowercased())")
                }
            }
        }
        return sortedUnique(values)
    }

    private func flattenedElements(from root: XMLElement) -> [XMLElement] {
        var result: [XMLElement] = []
        func visit(_ element: XMLElement) {
            result.append(element)
            for child in element.children ?? [] {
                if let childElement = child as? XMLElement { visit(childElement) }
            }
        }
        visit(root)
        return result
    }

    private func nearestAncestor(named name: String, from element: XMLElement) -> XMLElement? {
        var parent = element.parent as? XMLElement
        while let current = parent {
            if normalizedName(current) == name { return current }
            parent = current.parent as? XMLElement
        }
        return nil
    }

    private func normalizedName(_ element: XMLElement) -> String {
        (element.localName ?? element.name ?? "").lowercased()
    }

    private func attribute(_ name: String, in element: XMLElement) -> String? {
        element.attribute(forName: name)?.stringValue
    }

    private func classTokens(_ element: XMLElement) -> [String] {
        (attribute("class", in: element) ?? "")
            .split(whereSeparator: { $0.isWhitespace })
            .map(String.init)
    }

    private func inlineCSSProperties(_ element: XMLElement) -> [String] {
        guard let style = attribute("style", in: element) else { return [] }
        return style.split(separator: ";").compactMap { declaration in
            nonEmpty(
                declaration.split(separator: ":", maxSplits: 1).first?
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .lowercased()
            )
        }
    }

    private func normalizeText(_ value: String) -> String {
        value.replacingOccurrences(of: "\u{00A0}", with: " ")
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func canonicalTextForComparison(_ value: String) -> String {
        value.unicodeScalars.filter { !CharacterSet.whitespacesAndNewlines.contains($0) }
            .map(String.init)
            .joined()
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

    private func stableID(_ value: String) -> String {
        sha256(Data(value.utf8))
    }

    private func sha256(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    private struct BlockDraft {
        let id: String
        let element: XMLElement
        let kind: NativeReaderBlockKind
        let sourceOrder: Int
        let sectionID: String?
        let plainText: String
        let runs: [NativeReaderTextRun]
        let headingLevel: Int?
        let listItems: [NativeReaderListItem]
        let table: NativeReaderTable?
        let media: [NativeReaderMedia]
        let caption: String?
        let sourceReference: NativeReaderSourceReference
        let sourceHTML: String?
        let descendantSourceOrders: Set<Int>

        func block(anchorIDs: [String]) -> NativeReaderBlock {
            NativeReaderBlock(
                id: id,
                kind: kind,
                sourceOrder: sourceOrder,
                sectionID: sectionID,
                anchorIDs: anchorIDs,
                plainText: plainText,
                runs: runs,
                headingLevel: headingLevel,
                listItems: listItems,
                table: table,
                media: media,
                caption: caption,
                sourceReference: sourceReference,
                sourceHTML: sourceHTML
            )
        }
    }

    private struct GridPosition: Hashable {
        let row: Int
        let column: Int
    }
}

public enum NativeReaderDocumentGenerationError: LocalizedError {
    case parserUnavailable
    case parseFailed(Int)
    case missingRootElement

    public var errorDescription: String? {
        switch self {
        case .parserUnavailable:
            "Required libxml2 parser is unavailable at /usr/bin/xmllint"
        case .parseFailed(let status):
            "libxml2 could not recover the chapter DOM (exit \(status))"
        case .missingRootElement:
            "DOM parser produced no root element"
        }
    }
}
