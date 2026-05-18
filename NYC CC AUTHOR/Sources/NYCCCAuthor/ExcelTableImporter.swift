import Foundation

enum ExcelTableImporter {
    enum ImportError: LocalizedError {
        case manifestPathMissing
        case workbookMissing(URL)
        case unzipFailed(String)
        case sheetMissing(String)
        case relationshipMissing(String)
        case invalidRange(String)

        var errorDescription: String? {
            switch self {
            case .manifestPathMissing:
                return "Import the table manifest again so the author app knows where the Excel workbook is located."
            case .workbookMissing(let url):
                return "The Excel workbook could not be found next to the manifest: \(url.path)"
            case .unzipFailed(let path):
                return "The Excel workbook does not contain \(path)."
            case .sheetMissing(let sheet):
                return "The Excel workbook does not contain the requested sheet: \(sheet)"
            case .relationshipMissing(let id):
                return "The Excel workbook is missing worksheet relationship \(id)."
            case .invalidRange(let range):
                return "The table manifest contains an invalid Excel range: \(range)"
            }
        }
    }

    static func tables(
        manifest: EditorTableManifest,
        manifestPath: String?
    ) throws -> [EditorAuthoredTable] {
        guard let manifestPath, !manifestPath.isEmpty else {
            throw ImportError.manifestPathMissing
        }

        let manifestURL = URL(fileURLWithPath: manifestPath)
        let workbookURL = manifestURL
            .deletingLastPathComponent()
            .appendingPathComponent(manifest.workbook)
        guard FileManager.default.fileExists(atPath: workbookURL.path) else {
            throw ImportError.workbookMissing(workbookURL)
        }

        let workbook = try WorkbookPackage(url: workbookURL)
        return try manifest.tables.map { entry in
            let worksheet = try workbook.worksheet(named: entry.sheet)
            return try worksheet.authoredTable(for: entry, sharedStrings: workbook.sharedStrings)
        }
    }
}

private struct WorkbookPackage {
    let url: URL
    let sharedStrings: [String]
    private let sheetRelationships: [String: String]
    private let sheetRelationshipIDsByName: [String: String]

    init(url: URL) throws {
        self.url = url
        let workbookXML = try Self.unzip(path: "xl/workbook.xml", from: url)
        let relationshipsXML = try Self.unzip(path: "xl/_rels/workbook.xml.rels", from: url)
        let sharedStringsXML = (try? Self.unzip(path: "xl/sharedStrings.xml", from: url)) ?? ""

        self.sheetRelationshipIDsByName = WorkbookParser.parseSheets(workbookXML)
        self.sheetRelationships = RelationshipsParser.parse(relationshipsXML)
        self.sharedStrings = SharedStringsParser.parse(sharedStringsXML)
    }

    func worksheet(named name: String) throws -> Worksheet {
        guard let relationshipID = sheetRelationshipIDsByName[name] else {
            throw ExcelTableImporter.ImportError.sheetMissing(name)
        }
        guard let target = sheetRelationships[relationshipID] else {
            throw ExcelTableImporter.ImportError.relationshipMissing(relationshipID)
        }

        let normalizedTarget = target.hasPrefix("/") ? String(target.dropFirst()) : "xl/" + target
        let xml = try Self.unzip(path: normalizedTarget, from: url)
        return WorksheetParser.parse(xml)
    }

    private static func unzip(path: String, from url: URL) throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
        process.arguments = ["-p", url.path, path]

        let output = Pipe()
        process.standardOutput = output
        process.standardError = Pipe()
        try process.run()
        let data = output.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            throw ExcelTableImporter.ImportError.unzipFailed(path)
        }

        return String(data: data, encoding: .utf8) ?? ""
    }
}

private struct Worksheet {
    struct Cell {
        var text: String
        var type: String
        var row: Int
        var column: Int
    }

    struct MergeRange {
        var startRow: Int
        var startColumn: Int
        var endRow: Int
        var endColumn: Int
    }

    var cellsByRef: [String: Cell]
    var merges: [MergeRange]

    func authoredTable(
        for entry: EditorTableManifest.Table,
        sharedStrings: [String]
    ) throws -> EditorAuthoredTable {
        let range = try ExcelRange.parse(entry.range)
        var rows: [EditorAuthoredTable.Row] = []

        for rowIndex in range.startRow...range.endRow {
            var cells: [EditorAuthoredTable.Cell] = []
            for columnIndex in range.startColumn...range.endColumn {
                let coveringMerge = mergeCovering(row: rowIndex, column: columnIndex)
                let isTopLeftMerge = coveringMerge?.startRow == rowIndex && coveringMerge?.startColumn == columnIndex
                let isCoveredMergePlaceholder = coveringMerge != nil && !isTopLeftMerge

                let text: String
                if let cell = cellsByRef[ExcelRange.cellReference(row: rowIndex, column: columnIndex)] {
                    text = cell.resolvedText(sharedStrings: sharedStrings)
                } else {
                    text = ""
                }

                let columnSpan = coveringMerge.map { $0.endColumn - $0.startColumn + 1 } ?? 1
                let rowSpan = coveringMerge.map { $0.endRow - $0.startRow + 1 } ?? 1

                cells.append(
                    EditorAuthoredTable.Cell(
                        text: text,
                        columnSpan: max(columnSpan, 1),
                        rowSpan: max(rowSpan, 1),
                        isPlaceholder: isCoveredMergePlaceholder
                    )
                )
            }
            rows.append(EditorAuthoredTable.Row(cells: cells))
        }

        return EditorAuthoredTable(
            id: entry.id,
            caption: entry.caption,
            sheet: entry.sheet,
            range: entry.range,
            rows: rows
        )
    }

    private func mergeCovering(row: Int, column: Int) -> MergeRange? {
        merges.first {
            row >= $0.startRow && row <= $0.endRow &&
                column >= $0.startColumn && column <= $0.endColumn
        }
    }
}

private extension Worksheet.Cell {
    func resolvedText(sharedStrings: [String]) -> String {
        if type == "s", let index = Int(text), sharedStrings.indices.contains(index) {
            return sharedStrings[index]
        }
        return text
    }
}

private struct ExcelRange {
    var startColumn: Int
    var startRow: Int
    var endColumn: Int
    var endRow: Int

    static func parse(_ value: String) throws -> ExcelRange {
        let parts = value.components(separatedBy: ":")
        guard parts.count == 2,
              let start = parseCell(parts[0]),
              let end = parseCell(parts[1]) else {
            throw ExcelTableImporter.ImportError.invalidRange(value)
        }

        return ExcelRange(
            startColumn: min(start.column, end.column),
            startRow: min(start.row, end.row),
            endColumn: max(start.column, end.column),
            endRow: max(start.row, end.row)
        )
    }

    static func parseCell(_ value: String) -> (column: Int, row: Int)? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let letters = String(trimmed.prefix { $0.isLetter })
        let digits = String(trimmed.drop { $0.isLetter })
        guard !letters.isEmpty, let row = Int(digits), row > 0 else { return nil }
        return (columnIndex(letters), row)
    }

    static func cellReference(row: Int, column: Int) -> String {
        "\(columnLetters(column))\(row)"
    }

    private static func columnIndex(_ letters: String) -> Int {
        letters.unicodeScalars.reduce(0) { result, scalar in
            let value = Int(scalar.value) - Int(UnicodeScalar("A").value) + 1
            return result * 26 + value
        }
    }

    private static func columnLetters(_ index: Int) -> String {
        var value = index
        var result = ""
        while value > 0 {
            value -= 1
            let scalar = UnicodeScalar((value % 26) + Int(UnicodeScalar("A").value))!
            result.insert(Character(scalar), at: result.startIndex)
            value /= 26
        }
        return result
    }
}

private final class WorkbookParser: NSObject, XMLParserDelegate {
    private var sheets: [String: String] = [:]

    static func parseSheets(_ xml: String) -> [String: String] {
        let parser = WorkbookParser()
        parser.parse(xml)
        return parser.sheets
    }

    private func parse(_ xml: String) {
        guard let data = xml.data(using: .utf8) else { return }
        let parser = XMLParser(data: data)
        parser.delegate = self
        parser.parse()
    }

    func parser(
        _ parser: XMLParser,
        didStartElement elementName: String,
        namespaceURI: String?,
        qualifiedName qName: String?,
        attributes attributeDict: [String: String] = [:]
    ) {
        guard elementName == "sheet",
              let name = attributeDict["name"],
              let relationshipID = attributeDict["r:id"] ?? attributeDict["id"] else {
            return
        }
        sheets[name] = relationshipID
    }
}

private final class RelationshipsParser: NSObject, XMLParserDelegate {
    private var relationships: [String: String] = [:]

    static func parse(_ xml: String) -> [String: String] {
        let parser = RelationshipsParser()
        parser.parse(xml)
        return parser.relationships
    }

    private func parse(_ xml: String) {
        guard let data = xml.data(using: .utf8) else { return }
        let parser = XMLParser(data: data)
        parser.delegate = self
        parser.parse()
    }

    func parser(
        _ parser: XMLParser,
        didStartElement elementName: String,
        namespaceURI: String?,
        qualifiedName qName: String?,
        attributes attributeDict: [String: String] = [:]
    ) {
        guard elementName == "Relationship",
              let id = attributeDict["Id"],
              let target = attributeDict["Target"] else {
            return
        }
        relationships[id] = target
    }
}

private final class SharedStringsParser: NSObject, XMLParserDelegate {
    private var strings: [String] = []
    private var currentText = ""
    private var insideStringItem = false
    private var insideText = false

    static func parse(_ xml: String) -> [String] {
        let parser = SharedStringsParser()
        parser.parse(xml)
        return parser.strings
    }

    private func parse(_ xml: String) {
        guard let data = xml.data(using: .utf8) else { return }
        let parser = XMLParser(data: data)
        parser.delegate = self
        parser.parse()
    }

    func parser(
        _ parser: XMLParser,
        didStartElement elementName: String,
        namespaceURI: String?,
        qualifiedName qName: String?,
        attributes attributeDict: [String: String] = [:]
    ) {
        if elementName == "si" {
            insideStringItem = true
            currentText = ""
        } else if insideStringItem && elementName == "t" {
            insideText = true
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if insideText {
            currentText += string
        }
    }

    func parser(
        _ parser: XMLParser,
        didEndElement elementName: String,
        namespaceURI: String?,
        qualifiedName qName: String?
    ) {
        if elementName == "t" {
            insideText = false
        } else if elementName == "si" {
            strings.append(currentText)
            insideStringItem = false
        }
    }
}

private final class WorksheetParser: NSObject, XMLParserDelegate {
    private var cellsByRef: [String: Worksheet.Cell] = [:]
    private var merges: [Worksheet.MergeRange] = []
    private var currentReference = ""
    private var currentType = ""
    private var currentValue = ""
    private var insideValue = false
    private var insideInlineText = false

    static func parse(_ xml: String) -> Worksheet {
        let parser = WorksheetParser()
        parser.parse(xml)
        return Worksheet(cellsByRef: parser.cellsByRef, merges: parser.merges)
    }

    private func parse(_ xml: String) {
        guard let data = xml.data(using: .utf8) else { return }
        let parser = XMLParser(data: data)
        parser.delegate = self
        parser.parse()
    }

    func parser(
        _ parser: XMLParser,
        didStartElement elementName: String,
        namespaceURI: String?,
        qualifiedName qName: String?,
        attributes attributeDict: [String: String] = [:]
    ) {
        switch elementName {
        case "c":
            currentReference = attributeDict["r"] ?? ""
            currentType = attributeDict["t"] ?? ""
            currentValue = ""
        case "v":
            insideValue = true
        case "t":
            insideInlineText = currentType == "inlineStr"
        case "mergeCell":
            guard let ref = attributeDict["ref"],
                  let merge = parseMerge(ref) else { return }
            merges.append(merge)
        default:
            break
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if insideValue || insideInlineText {
            currentValue += string
        }
    }

    func parser(
        _ parser: XMLParser,
        didEndElement elementName: String,
        namespaceURI: String?,
        qualifiedName qName: String?
    ) {
        switch elementName {
        case "v":
            insideValue = false
        case "t":
            insideInlineText = false
        case "c":
            guard let parsed = ExcelRange.parseCell(currentReference) else { return }
            cellsByRef[currentReference.uppercased()] = Worksheet.Cell(
                text: normalizedCellText(currentValue),
                type: currentType,
                row: parsed.row,
                column: parsed.column
            )
        default:
            break
        }
    }

    private func parseMerge(_ value: String) -> Worksheet.MergeRange? {
        let parts = value.components(separatedBy: ":")
        guard parts.count == 2,
              let start = ExcelRange.parseCell(parts[0]),
              let end = ExcelRange.parseCell(parts[1]) else {
            return nil
        }

        return Worksheet.MergeRange(
            startRow: min(start.row, end.row),
            startColumn: min(start.column, end.column),
            endRow: max(start.row, end.row),
            endColumn: max(start.column, end.column)
        )
    }

    private func normalizedCellText(_ value: String) -> String {
        value
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
