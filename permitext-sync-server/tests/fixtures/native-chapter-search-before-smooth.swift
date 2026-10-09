enum ReferenceNativeReaderSearchIndex {
    static func matches(
        query: String,
        in blocks: [NativeReaderDisplayBlock]
    ) -> [NativeReaderSearchMatch] {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedQuery.isEmpty else { return [] }

        let matches = blocks.flatMap { displayBlock in
            let searchableText = searchableText(for: displayBlock.block)
            return ranges(of: normalizedQuery, in: searchableText).map { range in
                NativeReaderSearchMatch(
                    id: "\(displayBlock.id):\(range.location):\(range.length)",
                    blockID: displayBlock.id,
                    sourceBlockID: displayBlock.sourceBlockID,
                    range: range,
                    snippet: snippet(in: searchableText, around: range)
                )
            }
        }
        let textByID = Dictionary(blocks.map { ($0.id, searchableText(for: $0.block)) }, uniquingKeysWith: { first, _ in first })
        return matches.enumerated().sorted { lhs, rhs in
            let left = definitionRank(text: textByID[lhs.element.blockID] ?? "", range: lhs.element.range)
            let right = definitionRank(text: textByID[rhs.element.blockID] ?? "", range: rhs.element.range)
            return left == right ? lhs.offset < rhs.offset : left < right
        }.map(\.element)
    }

    // A defined term starts a paragraph and ends with a period. Preserve source
    // order among equally ranked matches and retain the original UTF-16 range.
    static func definitionRank(text: String, range: NSRange) -> Int {
        let source = text as NSString
        guard range.location == 0, NSMaxRange(range) <= source.length else { return 1 }
        let term = source.substring(with: range)
        let suffix = source.substring(from: NSMaxRange(range)).trimmingCharacters(in: .whitespacesAndNewlines)
        return term == term.uppercased() && suffix.hasPrefix(".") ? 0 : 1
    }

    static func ranges(of query: String, in text: String) -> [NSRange] {
        let normalizedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let source = text as NSString
        guard !normalizedQuery.isEmpty, source.length > 0 else { return [] }

        var ranges: [NSRange] = []
        var searchRange = NSRange(location: 0, length: source.length)
        while searchRange.length > 0 {
            let match = source.range(
                of: normalizedQuery,
                options: [.caseInsensitive, .diacriticInsensitive],
                range: searchRange
            )
            guard match.location != NSNotFound, match.length > 0 else { break }
            ranges.append(match)
            let nextLocation = match.location + match.length
            guard nextLocation < source.length else { break }
            searchRange = NSRange(location: nextLocation, length: source.length - nextLocation)
        }
        if !ranges.isEmpty { return ranges }
        // Fall back to consecutive words with at most two edits for words of eight letters,
        // or one edit for shorter words. Never fuzz short words or numbers.
        let expression = try! NSRegularExpression(pattern: #"[\p{L}\p{N}]+"#)
        let queryWords = expression.matches(in: normalizedQuery, range: NSRange(location: 0, length: (normalizedQuery as NSString).length))
            .map { (normalizedQuery as NSString).substring(with: $0.range).lowercased() }
        let words = expression.matches(in: text, range: NSRange(location: 0, length: source.length))
        guard !queryWords.isEmpty, words.count >= queryWords.count else { return [] }
        for start in 0...(words.count - queryWords.count) {
            let window = Array(words[start..<(start + queryWords.count)])
            if zip(queryWords, window).allSatisfy({ wordMatches($0.0, source.substring(with: $0.1.range).lowercased()) }) {
                ranges.append(NSRange(location: window[0].range.location, length: NSMaxRange(window.last!.range) - window[0].range.location))
            }
        }
        return ranges
    }

    private static func wordMatches(_ query: String, _ word: String) -> Bool {
        if query == word { return true }
        let limit = query.count >= 8 ? 2 : 1
        guard query.count >= 5, word.count >= 5,
              query.allSatisfy(\.isLetter), word.allSatisfy(\.isLetter),
              abs(query.count - word.count) <= limit else { return false }
        let a = Array(query), b = Array(word)
        var previous = Array(0...b.count)
        for i in 1...a.count {
            var row = [i] + Array(repeating: 0, count: b.count)
            for j in 1...b.count {
                row[j] = min(row[j - 1] + 1, previous[j] + 1,
                             previous[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1))
            }
            previous = row
        }
        return previous[b.count] <= limit
    }

    static func searchableText(for block: NativeReaderRuntimeBlock) -> String {
        switch block.kind {
        case .orderedList, .unorderedList:
            return block.listItems.flatMap(flatten).map(\.plainText).joined(separator: "\n")
        case .table:
            guard let table = block.table else { return block.plainText }
            return ([table.caption].compactMap { $0 }
                + table.cells.map(\.plainText)
                + table.footnotes)
                .joined(separator: "\n")
        case .image, .figure:
            return (block.media.flatMap { [$0.accessibilityText, $0.caption].compactMap { $0 } }
                + [block.caption].compactMap { $0 })
                .joined(separator: "\n")
        default:
            return block.plainText
        }
    }

    private static func flatten(_ item: NativeReaderRuntimeListItem) -> [NativeReaderRuntimeListItem] {
        [item] + item.children.flatMap(flatten)
    }

    private static func snippet(in text: String, around range: NSRange) -> String {
        let source = text as NSString
        let start = max(0, range.location - 48)
        let end = min(source.length, range.location + range.length + 72)
        let fragment = source.substring(with: NSRange(location: start, length: end - start))
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return "\(start > 0 ? "…" : "")\(fragment)\(end < source.length ? "…" : "")"
    }
}
