import Foundation

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
