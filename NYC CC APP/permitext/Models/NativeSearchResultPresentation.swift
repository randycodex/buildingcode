import Foundation

// A complete citation carries a code scope as well as search text. Ordinary
// prose and quoted phrases keep the existing exact-phrase behavior.
struct NativeSearchCitation: Equatable {
    let query: String
    let codePrefix: String?

    init(_ value: String) {
        let raw = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let pattern = #"^(?:(?:section|table)\s+)?(AC|BC|EBC|ECC|EC|FC|FGC|MC|PC|ZR|HMC|T24|T25|T26|T28)\s*(?:(?:section|table)\s+|§+\s*)?([A-Z]?\d+(?:[-.]\d+[A-Z]?)*(?:\([\dA-Z]+\))*)\.?$"#
        if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
           let match = regex.firstMatch(in: raw, range: NSRange(raw.startIndex..., in: raw)),
           let prefix = Range(match.range(at: 1), in: raw),
           let number = Range(match.range(at: 2), in: raw) {
            query = String(raw[number])
            codePrefix = String(raw[prefix]).uppercased()
        } else {
            query = raw
            codePrefix = nil
        }
    }

    func permits(codeName: String) -> Bool {
        guard let codePrefix else { return true }
        let name = codeName.uppercased()
        let families = [("EBC", "EXISTING BUILDING"), ("FGC", "FUEL GAS"),
                        ("HMC", "HOUSING MAINTENANCE"), ("ECC", "ENERGY"),
                        ("EC", "ELECTRICAL"), ("BC", "BUILDING CODE"),
                        ("MC", "MECHANICAL"), ("PC", "PLUMBING"),
                        ("FC", "FIRE CODE"), ("ZR", "ZONING"), ("AC", "ADMINISTRATIVE")]
        if codePrefix.hasPrefix("T") { return name.contains("TITLE \(codePrefix.dropFirst())") }
        return families.first(where: { name.contains($0.1) })?.0 == codePrefix
    }
}

struct NativeSearchResultPresentation: Equatable {
    let source: String
    let context: String
    let heading: String
    let excerpt: String

    init(sectionNumber: String, title: String, isParagraph: Bool, codeName: String,
         edition: String, chapterNumber: String, parentLabels: [String], snippet: String) {
        let number = Self.normalized(sectionNumber)
        let cleanTitle = Self.normalized(title)
        let cleanCode = Self.normalized(codeName)
        source = edition.isEmpty || cleanCode.localizedCaseInsensitiveContains(edition)
            ? cleanCode : [cleanCode, edition].filter { !$0.isEmpty }.joined(separator: " · ")
        let parent = parentLabels.last.map(Self.normalized) ?? ""
        context = ([chapterNumber.isEmpty ? "" : "Chapter \(chapterNumber)", parent])
            .filter { !$0.isEmpty }.joined(separator: " · ")
        if isParagraph {
            heading = number.isEmpty ? "Passage" : "Passage \(number)"
        } else if cleanTitle.hasPrefix(number + " ") || cleanTitle.hasPrefix(number + ". ") || number.isEmpty {
            heading = cleanTitle
        } else {
            heading = [number, cleanTitle].filter { !$0.isEmpty }.joined(separator: " ")
        }
        var text = Self.normalized(snippet.isEmpty && isParagraph ? title : snippet)
        // A title is navigation metadata, not a second copy of the excerpt.
        if !isParagraph, !heading.isEmpty, text.hasPrefix(heading) {
            text = String(text.dropFirst(heading.count)).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        if text.count > 240 {
            let prefix = String(text.prefix(237))
            let cut = prefix.lastIndex(of: " ") ?? prefix.endIndex
            text = String(prefix[..<cut]) + "…"
        }
        excerpt = text
    }

    private static func normalized(_ value: String) -> String {
        value.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
}

enum NativeSearchGroupExpansion {
    static func automaticGroup(groupIDs: [String], isSearching: Bool, isPending: Bool) -> String? {
        guard !isSearching, !isPending, groupIDs.count == 1 else { return nil }
        return groupIDs[0]
    }
}
