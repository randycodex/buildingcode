// Frozen reference from AuthoredCodeStore.swift before PERF-04.
// Commit: c177c8062b39b225bb0b2b979d4b58038bbca1f4
// Extracted by the host parity harness; this is not an application target.
// Keep the reference stable unless search semantics intentionally change.

    func search(
        query: String,
        codeSectionID: Int64? = nil,
        includeSnippets: Bool = true,
        resultLimit: Int? = 200
    ) -> [CodeSearchResult] {
        let signpostID = OSSignpostID(log: AppSignpost.search)
        os_signpost(.begin, log: AppSignpost.search, name: "search", signpostID: signpostID)
        defer { os_signpost(.end, log: AppSignpost.search, name: "search", signpostID: signpostID) }

        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        let lowercasedQuery = trimmed.lowercased()
        let phrase = trimmed.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }
            .map { NSRegularExpression.escapedPattern(for: $0) }.joined(separator: "\\s+")
        let word = "[\\p{L}\\p{N}_]"
        let startsWithWord = trimmed.prefix(1).range(of: word, options: .regularExpression) != nil
        let endsWithWord = trimmed.suffix(1).range(of: word, options: .regularExpression) != nil
        let exactPhrase = try? NSRegularExpression(pattern: (startsWithWord ? "(?<!\(word))" : "") + phrase + (endsWithWord ? "(?!\(word))" : ""), options: [.caseInsensitive])
        let queryTokens = Self.tokenize(trimmed)
        guard !queryTokens.isEmpty else { return [] }

        guard !Task.isCancelled else { return [] }
        let index = invertedIndex(for: codeSectionID)
        guard !Task.isCancelled else { return [] }
        var candidateIDs = index[queryTokens[0]] ?? []
        for token in queryTokens.dropFirst() {
            candidateIDs.formIntersection(index[token] ?? [])
            if candidateIDs.isEmpty { break }
        }

        if trimmed.range(of: #"^[A-Za-z]?\d"#, options: .regularExpression) != nil {
            for (token, sectionIDs) in index where token.hasPrefix(lowercasedQuery) {
                candidateIDs.formUnion(sectionIDs)
            }
        }

        // Candidate IDs already come from the scoped inverted index. Resolve
        // directly instead of allocating another full-corpus search lookup.
        let hits: [SearchHit] = candidateIDs
            .compactMap { sectionID -> SearchHit? in
                guard !Task.isCancelled, let indexed = sectionIndex[sectionID] else { return nil }
                let text = [indexed.section.sectionNumber, indexed.section.title, officialText(for: indexed)].joined(separator: " ")
                guard exactPhrase?.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil else { return nil }

                let sectionNumber = indexed.section.sectionNumber.lowercased()
                let title = indexed.section.title.lowercased()
                let rank: Int
                if sectionNumber == lowercasedQuery {
                    rank = 0
                } else if sectionNumber.hasPrefix(lowercasedQuery) {
                    rank = 1
                } else if title.contains(lowercasedQuery) {
                    rank = 2
                } else {
                    rank = 3
                }
                return SearchHit(
                    rank: rank,
                    indexed: indexed
                )
            }
            .sorted { lhs, rhs in
                if lhs.rank != rhs.rank {
                    return lhs.rank < rhs.rank
                }
                if lhs.indexed.chapter.chapterNumber == rhs.indexed.chapter.chapterNumber {
                    let sectionOrder = lhs.indexed.section.sectionNumber.compare(
                        rhs.indexed.section.sectionNumber,
                        options: [.numeric, .caseInsensitive]
                    )
                    if sectionOrder != .orderedSame {
                        return sectionOrder == .orderedAscending
                    }
                    let lhsCodeSectionID = lhs.indexed.chapter.codeSectionID ?? 0
                    let rhsCodeSectionID = rhs.indexed.chapter.codeSectionID ?? 0
                    if lhsCodeSectionID != rhsCodeSectionID {
                        return lhsCodeSectionID < rhsCodeSectionID
                    }
                    return lhs.indexed.section.id < rhs.indexed.section.id
                }
                return lhs.indexed.chapter.chapterNumber.compare(rhs.indexed.chapter.chapterNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
            }

        guard !Task.isCancelled else { return [] }
        return hits.prefix(resultLimit.map { max(1, $0) } ?? hits.count).map { hit in
            let indexed = hit.indexed
            return CodeSearchResult(
                id: indexed.section.id,
                codeSectionID: indexed.chapter.codeSectionID,
                chapterNumber: indexed.chapter.chapterNumber,
                sectionNumber: indexed.section.sectionNumber,
                title: indexed.section.title,
                snippet: includeSnippets
                    ? Self.snippet(in: officialText(for: indexed), query: trimmed)
                    : "",
                kind: indexed.section.kind
            )
        }
    }

    private func officialText(for indexed: IndexedSection) -> String {
        if bundleUsesExternalSectionText {
            let prepared = preparedSectionData(sectionID: indexed.section.id)
            // Text previews do not need rich blocks or chapter HTML when the
            // published plain text is already available.
            let preparedText = prepared?.officialText.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !preparedText.isEmpty { return preparedText }
            let fallbackText = indexed.section.officialText.trimmingCharacters(in: .whitespacesAndNewlines)
            if !fallbackText.isEmpty { return fallbackText }
            let blocks: [CodeContentBlock]
            if let preparedBlocks = prepared?.blocks, !preparedBlocks.isEmpty {
                blocks = preparedBlocks
            } else if !indexed.section.contentBlocks.isEmpty {
                blocks = indexed.section.contentBlocks
            } else {
                blocks = synthesizedContentBlocks(for: indexed)
            }
            return resolvedOfficialText(
                preparedOfficialText: prepared?.officialText,
                fallbackOfficialText: indexed.section.officialText,
                contentBlocks: blocks,
                fallbackTitle: indexed.section.title.displayTitle(for: indexed.section.sectionNumber)
            )
        }
        return resolvedOfficialText(
            preparedOfficialText: nil,
            fallbackOfficialText: indexed.section.officialText,
            contentBlocks: indexed.section.contentBlocks,
            fallbackTitle: indexed.section.title.displayTitle(for: indexed.section.sectionNumber)
        )
    }
