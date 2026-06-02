import SwiftUI

struct ChapterSearchSourceEntry: Identifiable, Hashable, Sendable {
    let sectionID: Int64
    let sectionNumber: String
    let title: String
    let anchorID: String?

    var id: Int64 { sectionID }
}

private struct ChapterSearchIndexedEntry: Identifiable, Hashable, Sendable {
    let sectionID: Int64
    let sectionNumber: String
    let title: String
    let anchorID: String?
    let officialText: String
    let searchText: String

    var id: Int64 { sectionID }
}

private struct ChapterSearchResult: Identifiable, Hashable, Sendable {
    let sectionID: Int64
    let sectionNumber: String
    let title: String
    let anchorID: String?
    let snippet: String

    var id: Int64 { sectionID }
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

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var results: [ChapterSearchResult] {
        let trimmed = trimmedQuery
        guard !trimmed.isEmpty else { return [] }

        let loweredQuery = trimmed.lowercased()
        let tokens = loweredQuery.split(whereSeparator: \.isWhitespace).map(String.init)

        return indexedEntries.compactMap { entry in
            let text = entry.searchText
            guard text.contains(loweredQuery) || tokens.allSatisfy({ text.contains($0) }) else {
                return nil
            }

            return ChapterSearchResult(
                sectionID: entry.sectionID,
                sectionNumber: entry.sectionNumber,
                title: entry.title,
                anchorID: entry.anchorID,
                snippet: snippet(in: entry.officialText, query: trimmed)
            )
        }
        .sorted { lhs, rhs in
            lhs.sectionNumber.compare(rhs.sectionNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && indexedEntries.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if trimmedQuery.isEmpty {
                    ContentUnavailableView(
                        "Search This Chapter",
                        systemImage: "text.page.badge.magnifyingglass",
                        description: Text("Find section titles and text only within \(title).")
                    )
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
            .navigationTitle("Search Chapter")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search this chapter")
            .autocorrectionDisabled()
            .textInputAutocapitalization(.never)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { dismiss() }
                }
            }
            .task(id: entries) {
                await loadIndexIfNeeded()
            }
        }
    }

    private func loadIndexIfNeeded() async {
        guard indexedEntries.isEmpty, !isLoading else { return }
        isLoading = true
        let sectionIDs = entries.map(\.sectionID)
        let details = await library.loadSectionDetailsAsync(sectionIDs: sectionIDs)
        let detailByID = Dictionary(uniqueKeysWithValues: details.map { ($0.id, $0) })

        indexedEntries = entries.map { entry in
            let officialText = detailByID[entry.sectionID]?.officialText ?? ""
            let title = detailByID[entry.sectionID]?.title ?? entry.title
            return ChapterSearchIndexedEntry(
                sectionID: entry.sectionID,
                sectionNumber: entry.sectionNumber,
                title: title,
                anchorID: entry.anchorID,
                officialText: officialText,
                searchText: "\(entry.sectionNumber) \(title) \(officialText)".lowercased()
            )
        }
        isLoading = false
    }

    private func snippet(in text: String, query: String) -> String {
        let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedText.isEmpty else { return "" }

        let lowercasedText = trimmedText.lowercased()
        let lowercasedQuery = query.lowercased()
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
