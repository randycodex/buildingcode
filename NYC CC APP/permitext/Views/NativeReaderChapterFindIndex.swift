import Foundation

struct NativeReaderChapterFindHit: Identifiable, Equatable, Sendable {
    enum Kind: Int, Sendable {
        case sectionNumber, definition, phrase, keywords, similar
    }

    let anchor: NativeReaderSearchMatch
    let highlights: [NativeReaderSearchMatch]
    let sectionIndex: Int?
    let displayIndex: Int
    let kind: Kind

    var id: String { anchor.id }

    init(anchor: NativeReaderSearchMatch, highlights: [NativeReaderSearchMatch]? = nil,
         sectionIndex: Int?, displayIndex: Int, kind: Kind) {
        self.anchor = anchor
        self.highlights = highlights ?? [anchor]
        self.sectionIndex = sectionIndex
        self.displayIndex = displayIndex
        self.kind = kind
    }
}

/// One searchable projection per open chapter. The native display blocks and
/// their UTF-16 offsets remain the source of truth for navigable matches.
struct NativeReaderChapterFindIndex: Sendable {
    private struct Block: Sendable {
        let id: String
        let sourceID: String
        let text: String
        let index: Int
        let sectionIndex: Int?

        func match(_ range: NSRange, id: String? = nil) -> NativeReaderSearchMatch {
            .init(id: id ?? "\(self.id):\(range.location):\(range.length)",
                  blockID: self.id, sourceBlockID: sourceID, range: range,
                  snippet: NativeReaderSearchIndex.snippet(in: text, around: range))
        }

        func hit(_ range: NSRange, kind: NativeReaderChapterFindHit.Kind) -> NativeReaderChapterFindHit {
            .init(anchor: match(range), sectionIndex: sectionIndex, displayIndex: index, kind: kind)
        }
    }

    private struct Position: Sendable {
        let blockIndex: Int
        let range: NSRange
    }

    private struct Provision: Sendable {
        let headingIndex: Int
        let number: String?
        let words: [String: Position]
    }

    private let blocks: [Block]
    private let provisions: [Provision]

    init(_ document: NativeReaderPreparedDocument) {
        var blocks: [Block] = []
        var sections: [Int: [Int]] = [:]
        for (index, display) in document.displayBlocks.enumerated() {
            if Task.isCancelled { break }
            let section = document.navigationIndex[display.id]?.sectionTargetIndex
            let text: String
            if display.block.kind.isTextOnly, !display.block.runs.isEmpty {
                text = display.block.runs.map(\.text).joined()
            } else {
                text = NativeReaderSearchIndex.searchableText(for: display.block)
            }
            blocks.append(Block(id: display.id, sourceID: display.sourceBlockID, text: text,
                                index: index, sectionIndex: section))
            if let section { sections[section, default: []].append(index) }
        }
        self.blocks = blocks
        provisions = document.sectionTargets.enumerated().compactMap { index, target in
            guard !Task.isCancelled, let members = sections[index], let first = members.first else { return nil }
            var words: [String: Position] = [:]
            for member in members {
                if Task.isCancelled { return nil }
                for (word, range) in Self.words(in: blocks[member].text) where words[word] == nil {
                    words[word] = Position(blockIndex: member, range: range)
                }
            }
            let heading = document.navigationIndex[target.blockID]?.displayIndex ?? first
            guard blocks.indices.contains(heading) else { return nil }
            return Provision(headingIndex: heading, number: target.sectionNumber.map(Self.normalizedNumber), words: words)
        }
    }

    func matches(_ rawQuery: String) -> [NativeReaderChapterFindHit] {
        let query = rawQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty, !Task.isCancelled else { return [] }
        if let hit = sectionNumberMatch(query) { return [hit] }
        let exactQuery = query.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        var hits: [NativeReaderChapterFindHit] = []
        var sectionsWithPhrases = Set<Int>()
        for block in blocks {
            guard !Task.isCancelled else { return [] }
            let ranges = NativeReaderSearchIndex.exactRanges(of: exactQuery, in: block.text)
            if !ranges.isEmpty, let section = block.sectionIndex { sectionsWithPhrases.insert(section) }
            hits.append(contentsOf: ranges.map { range in
                block.hit(range, kind: NativeReaderSearchIndex.definitionRank(text: block.text, range: range) == 0
                          ? .definition : .phrase)
            })
        }
        let words = Set(Self.words(in: query).map(\.0))
        if words.count > 1, words.contains(where: { $0.contains(where: \.isLetter) }) {
            for provision in provisions {
                guard !Task.isCancelled else { return [] }
                let section = blocks[provision.headingIndex].sectionIndex
                if let section, sectionsWithPhrases.contains(section) { continue }
                let positions = words.compactMap { provision.words[$0] }
                guard positions.count == words.count else { continue }
                let sorted = positions.sorted {
                    $0.blockIndex == $1.blockIndex ? $0.range.location < $1.range.location : $0.blockIndex < $1.blockIndex
                }
                guard let first = sorted.first else { continue }
                let block = blocks[first.blockIndex]
                let anchor = block.match(first.range, id: "\(block.id):keywords")
                let highlights = sorted.map { blocks[$0.blockIndex].match($0.range, id: anchor.id) }
                hits.append(.init(anchor: anchor, highlights: highlights, sectionIndex: section,
                                  displayIndex: block.index, kind: .keywords))
            }
        }
        if hits.isEmpty, words.contains(where: { $0.count >= 5 && $0.allSatisfy(\.isLetter) }) {
            for block in blocks {
                guard !Task.isCancelled else { return [] }
                hits.append(contentsOf: NativeReaderSearchIndex.fuzzyRanges(of: query, in: block.text).map {
                    block.hit($0, kind: .similar)
                })
            }
        }
        return hits.sorted {
            $0.displayIndex == $1.displayIndex ? $0.anchor.range.location < $1.anchor.range.location
                : $0.displayIndex < $1.displayIndex
        }
    }

    private func sectionNumberMatch(_ query: String) -> NativeReaderChapterFindHit? {
        let number = Self.normalizedNumber(query)
        guard number.contains(where: \.isNumber),
              let provision = provisions.first(where: { $0.number == number }) else { return nil }
        let heading = blocks[provision.headingIndex]
        let range = NativeReaderSearchIndex.exactRanges(of: number, in: heading.text).first
            ?? NSRange(location: 0, length: 0)
        return heading.hit(range, kind: .sectionNumber)
    }

    private static func normalizedNumber(_ number: String) -> String {
        number.uppercased()
            .replacingOccurrences(of: #"^(?:SECTION\s+)?(?:§\s*)?(?:[A-Z]{2,5}\s+)?(?:§\s*)?"#, with: "", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: " .:;"))
    }

    private static let wordPattern = try! NSRegularExpression(pattern: #"[\p{L}\p{N}]+"#)

    private static func words(in text: String) -> [(String, NSRange)] {
        let source = text as NSString
        return wordPattern.matches(in: text, range: NSRange(location: 0, length: source.length)).map {
            (source.substring(with: $0.range).folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil), $0.range)
        }
    }
}
