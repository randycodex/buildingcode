import Foundation

func jsonInt64(_ value: Any?) -> Int64? {
    switch value {
    case let number as Int64:
        return number
    case let number as Int:
        return Int64(number)
    case let number as NSNumber:
        return number.int64Value
    default:
        return nil
    }
}

struct SearchIndexFile: Encodable {
    let schemaVersion: Int
    let tokens: [String: [Int64]]
}

guard CommandLine.arguments.count >= 2 else {
    fputs("Usage: slim-bundle <bundle-root>\n", stderr)
    exit(1)
}

let bundleRoot = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let bundleURL = bundleRoot.appendingPathComponent("bundle.json")
let preparedSectionsURL = bundleRoot
    .appendingPathComponent("prepared", isDirectory: true)
    .appendingPathComponent("sections", isDirectory: true)
let preparedChaptersURL = bundleRoot
    .appendingPathComponent("prepared", isDirectory: true)
    .appendingPathComponent("chapters", isDirectory: true)
let searchIndexURL = bundleRoot
    .appendingPathComponent("prepared", isDirectory: true)
    .appendingPathComponent("searchIndex.json", isDirectory: false)
let chapterCatalogURL = bundleRoot
    .appendingPathComponent("prepared", isDirectory: true)
    .appendingPathComponent("chapterCatalog.json", isDirectory: false)

func titleThroughFirstPeriod(_ text: String) -> String {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return "" }
    if let range = trimmed.range(of: ".") {
        let end = trimmed.index(after: range.lowerBound)
        return String(trimmed[..<end]).trimmingCharacters(in: .whitespacesAndNewlines)
    }
    return trimmed
}

func tokenize(_ text: String) -> [String] {
    var tokens: [String] = []
    var current = ""

    func flush() {
        guard current.count >= 2 else {
            current = ""
            return
        }
        tokens.append(current)
        current = ""
    }

    for character in text.lowercased() {
        if character.isWhitespace {
            flush()
        } else if character.isLetter || character.isNumber || character == "." || character == "-" {
            current.append(character)
        } else {
            flush()
        }
    }
    flush()
    return tokens
}

let bundleData = try Data(contentsOf: bundleURL)
guard var root = try JSONSerialization.jsonObject(with: bundleData) as? [String: Any] else {
    fputs("Invalid bundle.json\n", stderr)
    exit(1)
}

var invertedIndex: [String: Set<Int64>] = [:]
var sectionCount = 0
var compactChapterCatalog: [[Any]] = []

guard var chapters = root["chapters"] as? [[String: Any]] else {
    fputs("Missing chapters\n", stderr)
    exit(1)
}

try FileManager.default.createDirectory(at: preparedSectionsURL, withIntermediateDirectories: true)
try FileManager.default.createDirectory(at: preparedChaptersURL, withIntermediateDirectories: true)

func officialTextForSection(sectionID: Int64, bundledText: String) -> String {
    if !bundledText.isEmpty {
        return bundledText
    }
    let preparedURL = preparedSectionsURL.appendingPathComponent("\(sectionID).json")
    guard let data = try? Data(contentsOf: preparedURL),
          let prepared = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        return ""
    }
    return prepared["officialText"] as? String ?? ""
}

for chapterIndex in chapters.indices {
    guard var chapter = chapters[chapterIndex] as? [String: Any],
          let chapterNumber = chapter["chapterNumber"] as? String,
          let chapterID = jsonInt64(chapter["id"]),
          var groups = chapter["groups"] as? [[String: Any]] else {
        continue
    }

    for groupIndex in groups.indices {
        guard var group = groups[groupIndex] as? [String: Any],
              var sections = group["sections"] as? [[String: Any]] else {
            continue
        }

        for sectionIndex in sections.indices {
            guard var section = sections[sectionIndex] as? [String: Any],
                  let sectionID = jsonInt64(section["id"]) else {
                continue
            }

            let sectionNumber = section["sectionNumber"] as? String ?? ""
            let title = section["title"] as? String ?? ""
            let officialText = officialTextForSection(sectionID: sectionID, bundledText: section["officialText"] as? String ?? "")
            let kind = section["kind"] as? String ?? "title"
            let richTextOverrideData = section["richTextOverrideData"]
            let contentBlocks = section["contentBlocks"] as? [[String: Any]] ?? []

            let preparedURL = preparedSectionsURL.appendingPathComponent("\(sectionID).json")
            var blocks = contentBlocks
            if blocks.isEmpty,
               let existingData = try? Data(contentsOf: preparedURL),
               let existing = try? JSONSerialization.jsonObject(with: existingData) as? [String: Any],
               let existingBlocks = existing["blocks"] as? [[String: Any]] {
                blocks = existingBlocks
            }

            let previewText = titleThroughFirstPeriod(officialText)
            var preparedSection: [String: Any] = [
                "schemaVersion": 2,
                "sectionID": sectionID,
                "chapterNumber": chapterNumber,
                "officialText": officialText,
                "previewText": previewText,
                "blocks": blocks
            ]
            if let richTextOverrideData {
                preparedSection["richTextOverrideData"] = richTextOverrideData
            }

            let preparedData = try JSONSerialization.data(
                withJSONObject: preparedSection,
                options: [.prettyPrinted, .sortedKeys]
            )
            try preparedData.write(to: preparedURL, options: .atomic)

            let haystack = "\(sectionNumber) \(title) \(officialText)".lowercased()
            for token in tokenize(haystack) {
                invertedIndex[token, default: []].insert(sectionID)
            }

            sections[sectionIndex] = [
                "id": sectionID,
                "sectionNumber": sectionNumber,
                "title": title,
                "kind": kind
            ]
            sectionCount += 1
        }

        group["sections"] = sections
        groups[groupIndex] = group
    }

    var chapterStructure: [String: Any] = [
        "schemaVersion": 1,
        "chapterID": chapterID,
        "chapterNumber": chapterNumber,
        "groups": groups
    ]
    if let rawDraftText = chapter["rawDraftText"] {
        chapterStructure["rawDraftText"] = rawDraftText
    }
    let chapterData = try JSONSerialization.data(
        withJSONObject: chapterStructure,
        options: [.prettyPrinted, .sortedKeys]
    )
    try chapterData.write(
        to: preparedChaptersURL.appendingPathComponent("\(chapterID).json"),
        options: .atomic
    )

    let compactGroups: [[Any]] = groups.map { group in
        let compactSections: [[Any]] = (group["sections"] as? [[String: Any]] ?? []).compactMap { section in
            guard let sectionID = jsonInt64(section["id"]) else { return nil }
            return [
                sectionID,
                section["sectionNumber"] as? String ?? "",
                section["title"] as? String ?? "",
                section["kind"] as? String ?? "title"
            ]
        }
        return [
            group["id"] as? String ?? "",
            group["headerLine"] as? String ?? "",
            group["headingLine"] ?? NSNull(),
            group["headerRTFData"] ?? NSNull(),
            group["headingRTFData"] ?? NSNull(),
            compactSections
        ]
    }
    compactChapterCatalog.append([chapterID, compactGroups])

    var chapterStub: [String: Any] = [
        "id": chapterID,
        "chapterNumber": chapterNumber,
        "title": chapter["title"] as? String ?? ""
    ]
    if let codeID = chapter["codeID"] {
        chapterStub["codeID"] = codeID
    }
    if let codeSectionID = chapter["codeSectionID"] {
        chapterStub["codeSectionID"] = codeSectionID
    }
    chapters[chapterIndex] = chapterStub
}

root["chapters"] = chapters
root["sectionContentSchemaVersion"] = 2
root["chapterStructureSchemaVersion"] = 2

let slimData = try JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted, .sortedKeys])
try slimData.write(to: bundleURL, options: .atomic)

let searchTokens = invertedIndex.mapValues { Array($0).sorted() }
let searchIndex = SearchIndexFile(schemaVersion: 1, tokens: searchTokens)
let searchData = try JSONEncoder().encode(searchIndex)
try searchData.write(to: searchIndexURL, options: .atomic)

let chapterCatalogData = try JSONSerialization.data(
    withJSONObject: [
        "schemaVersion": 1,
        "chapters": compactChapterCatalog
    ],
    options: [.sortedKeys]
)
try chapterCatalogData.write(to: chapterCatalogURL, options: .atomic)

fputs(
    "Slimmed bundle (\(slimData.count) bytes), updated \(sectionCount) section files, wrote \(searchTokens.count) search tokens and \(compactChapterCatalog.count) compact chapter entries.\n",
    stderr
)
