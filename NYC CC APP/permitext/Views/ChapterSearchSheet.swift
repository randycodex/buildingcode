import SwiftUI

struct ChapterSearchSourceEntry: Identifiable, Hashable, Sendable {
    let sectionID: Int64
    let sectionNumber: String
    let title: String
    let anchorID: String?
    let displayText: String?

    var id: String {
        "\(sectionID):\(anchorID ?? sectionNumber)"
    }

    init(
        sectionID: Int64,
        sectionNumber: String,
        title: String,
        anchorID: String?,
        displayText: String? = nil
    ) {
        self.sectionID = sectionID
        self.sectionNumber = sectionNumber
        self.title = title
        self.anchorID = anchorID
        self.displayText = displayText
    }
}

private struct ChapterSearchIndexedEntry: Identifiable, Hashable, Sendable {
    let sectionID: Int64
    let sectionNumber: String
    let title: String
    let anchorID: String?
    let displayText: String
    let searchText: String

    var id: String {
        "\(sectionID):\(anchorID ?? sectionNumber)"
    }
}

private struct ChapterSearchResult: Identifiable, Hashable, Sendable {
    let sectionID: Int64
    let sectionNumber: String
    let title: String
    let anchorID: String?
    let snippet: String

    var id: String {
        "\(sectionID):\(anchorID ?? sectionNumber)"
    }
}

struct ChapterSearchSheet: View {
    let title: String
    let entries: [ChapterSearchSourceEntry]
    @Binding var query: String
    let onSelect: (ChapterSearchSourceEntry) -> Void

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var library: CodeLibraryViewModel
    @State private var indexedEntries: [ChapterSearchIndexedEntry] = []
    @State private var isLoading = false
    @FocusState private var isSearchFocused: Bool

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var results: [ChapterSearchResult] {
        let trimmed = trimmedQuery
        guard !trimmed.isEmpty else { return [] }

        let normalizedQuery = normalizedSearchText(trimmed)
        let tokens = normalizedQuery.split(whereSeparator: \.isWhitespace).map(String.init)
        guard !tokens.isEmpty else { return [] }

        return indexedEntries.compactMap { entry in
            let text = entry.searchText
            guard text.contains(normalizedQuery) || tokens.allSatisfy({ text.contains($0) }) else {
                return nil
            }

            return ChapterSearchResult(
                sectionID: entry.sectionID,
                sectionNumber: entry.sectionNumber,
                title: entry.title,
                anchorID: entry.anchorID,
                snippet: snippet(in: entry.displayText, query: trimmed)
            )
        }
        .sorted { lhs, rhs in
            lhs.sectionNumber.compare(rhs.sectionNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            searchHeader
            Divider()
            searchContent
        }
        .background(Color(uiColor: .systemBackground))
        .task(id: entries) {
            await loadIndexIfNeeded()
        }
        .onAppear {
            isSearchFocused = true
        }
    }

    private var searchHeader: some View {
        HStack(spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.secondary)

                TextField("Search this chapter", text: $query)
                    .font(.title3)
                    .foregroundStyle(.primary)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .focused($isSearchFocused)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color(uiColor: .secondarySystemBackground))
            .clipShape(Capsule(style: .continuous))

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.title2.weight(.medium))
                    .foregroundStyle(.primary)
                    .frame(width: 54, height: 54)
                    .background(Color(uiColor: .secondarySystemBackground))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close search")
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 14)
    }

    @ViewBuilder
    private var searchContent: some View {
        if isLoading && indexedEntries.isEmpty {
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if trimmedQuery.isEmpty {
            Color.clear
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if results.isEmpty {
            ContentUnavailableView.search(text: trimmedQuery)
        } else {
            List(results) { result in
                Button {
                    onSelect(
                        ChapterSearchSourceEntry(
                            sectionID: result.sectionID,
                            sectionNumber: result.sectionNumber,
                            title: result.title,
                            anchorID: result.anchorID
                        )
                    )
                    dismiss()
                } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(highlightedSearchText(displayTitle(for: result)))
                            .font(.headline)
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.leading)

                        Text(highlightedSearchText(result.snippet))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.leading)
                            .lineLimit(3)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 4)
                }
                .buttonStyle(.plain)
            }
            .listStyle(.plain)
        }
    }

    private func loadIndexIfNeeded() async {
        guard indexedEntries.isEmpty, !isLoading else { return }
        isLoading = true
        let sectionIDs = entries.map(\.sectionID)
        let details = await library.loadSectionDetailsAsync(sectionIDs: sectionIDs)
        let detailByID = Dictionary(uniqueKeysWithValues: details.map { ($0.id, $0) })

        indexedEntries = entries.map { entry in
            let detail = detailByID[entry.sectionID]
            let fallbackText = detail.map(searchableText(for:)) ?? detail?.officialText ?? ""
            let searchableDetailText = entry.displayText ?? fallbackText
            let title = entry.displayText == nil ? detail?.title ?? entry.title : entry.title
            return ChapterSearchIndexedEntry(
                sectionID: entry.sectionID,
                sectionNumber: entry.sectionNumber,
                title: title,
                anchorID: entry.anchorID,
                displayText: searchableDetailText,
                searchText: normalizedSearchText("\(entry.sectionNumber) \(title) \(searchableDetailText)")
            )
        }
        isLoading = false
    }

    private func searchableText(for detail: ReaderSectionDetail) -> String {
        var parts = [
            detail.title,
            detail.officialText
        ]

        for block in detail.contentBlocks {
            if let plainText = block.plainText {
                parts.append(plainText)
            }
            if let html = block.html {
                parts.append(plainText(fromHTML: html))
            }
            if let caption = block.caption {
                parts.append(caption)
            }
            if let tableID = block.tableID,
               let table = detail.tableBlocks.first(where: { $0.id == tableID }) {
                parts.append(searchableText(for: table))
            }
        }

        for table in detail.tableBlocks {
            parts.append(searchableText(for: table))
        }

        for figure in detail.figures + detail.customDiagrams {
            parts.append(figure.titleText)
        }

        return parts
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }

    private func searchableText(for table: CodeTableBlock) -> String {
        var parts: [String] = []
        if let caption = table.caption {
            parts.append(caption)
        }
        parts.append(contentsOf: table.cells.map { cell in
            cell.plainText.isEmpty ? plainText(fromHTML: cell.html) : cell.plainText
        })
        parts.append(contentsOf: table.footnotes)
        return parts
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    private func plainText(fromHTML html: String) -> String {
        html
            .replacingOccurrences(of: #"<br\s*/?>"#, with: "\n", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"</(p|div|li|tr|h[1-6])>"#, with: "\n", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"<[^>]+>"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
    }

    private func normalizedSearchText(_ text: String) -> String {
        text
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func foldedSearchText(_ text: String) -> String {
        text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
    }

    private func snippet(in text: String, query: String) -> String {
        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else { return "" }

        let lowercasedText = foldedSearchText(trimmedText)
        let lowercasedQuery = foldedSearchText(query.trimmingCharacters(in: .whitespacesAndNewlines))
        let nsText = trimmedText as NSString
        let range = lowercasedText.range(of: lowercasedQuery)
            ?? lowercasedQuery
                .split(whereSeparator: \.isWhitespace)
                .lazy
                .compactMap { lowercasedText.range(of: String($0)) }
                .first

        guard let range else {
            return trimmedText.components(separatedBy: .newlines).first ?? trimmedText
        }

        let location = trimmedText.distance(from: trimmedText.startIndex, to: range.lowerBound)
        let matchLength = trimmedText.distance(from: range.lowerBound, to: range.upperBound)
        let start = max(0, location - 55)
        let end = min(nsText.length, location + matchLength + 85)
        var value = nsText.substring(with: NSRange(location: start, length: end - start))
        if start > 0 {
            value = "…" + value
        }
        if end < nsText.length {
            value += "…"
        }
        return value.replacingOccurrences(of: "\n", with: " ")
    }

    private func displayTitle(for result: ChapterSearchResult) -> String {
        let sectionNumber = result.sectionNumber.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = result.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sectionNumber.isEmpty else { return title }
        guard !title.isEmpty else { return sectionNumber }

        let normalizedTitle = title
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        let normalizedSection = sectionNumber.lowercased()

        if normalizedTitle.hasPrefix(normalizedSection)
            || normalizedTitle.hasPrefix("section \(normalizedSection)")
            || normalizedTitle.hasPrefix("section bc \(normalizedSection)")
            || normalizedTitle.hasPrefix("section mc \(normalizedSection)")
            || normalizedTitle.hasPrefix("section pc \(normalizedSection)")
            || normalizedTitle.hasPrefix("section fc \(normalizedSection)") {
            return title
        }

        return "\(sectionNumber) \(title)"
    }

    private func highlightedSearchText(_ text: String) -> AttributedString {
        var attributed = AttributedString(text)
        let tokens = trimmedQuery
            .split(whereSeparator: \.isWhitespace)
            .map(String.init)
            .filter { !$0.isEmpty }

        guard !tokens.isEmpty else { return attributed }

        for token in tokens {
            var searchRange = attributed.startIndex..<attributed.endIndex
            while let range = attributed[searchRange].range(of: token, options: [.caseInsensitive, .diacriticInsensitive]) {
                attributed[range].backgroundColor = UIColor(Color.appChrome.opacity(0.28))
                attributed[range].foregroundColor = UIColor(Color.primary)
                searchRange = range.upperBound..<attributed.endIndex
            }
        }

        return attributed
    }
}
