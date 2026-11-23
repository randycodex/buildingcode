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
    var isInline = false
    var usesReaderBottomBar = false
    var onClose: (() -> Void)? = nil
    var onSections: (() -> Void)? = nil
    @State private var activeResultID: String?

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
            guard !NativeReaderSearchIndex.ranges(of: trimmed, in: text).isEmpty || tokens.allSatisfy({ text.contains($0) }) else {
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
            let leftTitleMatch = !NativeReaderSearchIndex.ranges(of: trimmed, in: lhs.title).isEmpty
            let rightTitleMatch = !NativeReaderSearchIndex.ranges(of: trimmed, in: rhs.title).isEmpty
            if leftTitleMatch != rightTitleMatch { return leftTitleMatch }
            return lhs.sectionNumber.compare(rhs.sectionNumber, options: [.numeric, .caseInsensitive]) == .orderedAscending
        }
    }

    var body: some View {
        Group {
            if isInline {
                ChapterFindControls(
                    query: $query, matchCount: results.count,
                    activeIndex: results.firstIndex(where: { $0.id == activeResultID }),
                    isSearching: isLoading,
                    onPrevious: { navigateResult(offset: -1) },
                    onNext: { navigateResult(offset: activeResultID == nil ? 0 : 1) },
                    onSubmit: { navigateResult(offset: 0) },
                    onClose: { query = ""; onClose?() },
                    onSections: onSections,
                    usesReaderBottomBar: usesReaderBottomBar
                )
            } else {
                VStack(spacing: 0) {
                    searchHeader
                    Divider()
                    searchContent
                }
                .background(Color(uiColor: .systemBackground))
                .onAppear { isSearchFocused = true }
            }
        }
        .task(id: entries) { await loadIndexIfNeeded() }
        .onChange(of: query) { _, _ in activeResultID = nil }
    }

    private func navigateResult(offset: Int) {
        let matches = results
        guard !matches.isEmpty else { return }
        let index = matches.firstIndex(where: { $0.id == activeResultID }) ?? 0
        let result = matches[(index + offset + matches.count) % matches.count]
        activeResultID = result.id
        onSelect(ChapterSearchSourceEntry(sectionID: result.sectionID, sectionNumber: result.sectionNumber,
            title: result.title, anchorID: result.anchorID))
    }

    private var searchHeader: some View {
        HStack(spacing: 12) {
            CodeSearchBar(showsClearButton: !query.isEmpty, clearTitle: "Clear chapter search", clear: { query = "" }) { _ in
                TextField("Search this chapter", text: $query)
                    .focused($isSearchFocused)
            }

            Button {
                dismiss()
            } label: {
                ToolbarActionIcon(systemImage: "xmark").codeLiquidGlassCircle()
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close search")
        }
        .padding(.horizontal, CodeScreenMetrics.bottomControlHorizontalPadding)
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
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .listStyle(.plain)
        }
    }

    private func loadIndexIfNeeded() async {
        guard indexedEntries.isEmpty, !isLoading else { return }
        isLoading = true
        let sectionIDs = Array(Set(entries.map(\.sectionID))).sorted()
        let details = await library.loadSectionDetailsAsync(sectionIDs: sectionIDs)
        let detailByID = Dictionary(details.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })

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
                attributed[range].underlineStyle = .single
                attributed[range].foregroundColor = UIColor(Color.primary)
                searchRange = range.upperBound..<attributed.endIndex
            }
        }

        return attributed
    }
}

private struct ReaderChapterFindOwnerKey: EnvironmentKey {
    static let defaultValue: Binding<UUID?>? = nil
}

extension EnvironmentValues {
    var readerChapterFindOwner: Binding<UUID?>? {
        get { self[ReaderChapterFindOwnerKey.self] }
        set { self[ReaderChapterFindOwnerKey.self] = newValue }
    }
}

extension View {
    func chapterFindBar<Bar: View>(isPresented: Bool, @ViewBuilder bar: @escaping (Bool) -> Bar) -> some View {
        modifier(ChapterFindPlacement(isPresented: isPresented, bar: bar))
    }
}

private struct ChapterFindPlacement<Bar: View>: ViewModifier {
    @Environment(\.readerChapterFindOwner) private var readerOwner
    @State private var owner = UUID()
    let isPresented: Bool
    let bar: (Bool) -> Bar

    func body(content: Content) -> some View {
        if let readerOwner {
            content.overlay(alignment: .bottom) {
                if isPresented {
                    bar(true)
                        .padding(.horizontal, CodeScreenMetrics.bottomControlHorizontalPadding)
                        .padding(.vertical, CodeScreenMetrics.readerControlsVerticalPadding)
                        .onAppear { readerOwner.wrappedValue = owner }
                        .onDisappear {
                            if readerOwner.wrappedValue == owner { readerOwner.wrappedValue = nil }
                        }
                }
            }
        } else {
            content.safeAreaInset(edge: .top, spacing: 0) {
                if isPresented { bar(false) }
            }
        }
    }
}

struct ChapterFindControls: View {
    @Binding var query: String
    let matchCount: Int
    let activeIndex: Int?
    let isSearching: Bool
    let onPrevious: () -> Void
    let onNext: () -> Void
    let onSubmit: () -> Void
    let onClose: () -> Void
    var onSections: (() -> Void)? = nil
    var usesReaderBottomBar = false
    @FocusState private var isFocused: Bool

    var body: some View {
        Group {
            if usesReaderBottomBar {
                controls
                    .padding(.horizontal, 4)
                    .frame(minHeight: CodeScreenMetrics.bottomControlHeight)
                    .codeLiquidGlassCapsule()
            } else {
                controls
                    .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
                    .padding(.horizontal, CodeScreenMetrics.readerHorizontalPadding)
                    .padding(.vertical, 6)
                    .background(Color(uiColor: .systemBackground))
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("chapter-find-controls")
        .onAppear { isFocused = true }
    }

    private var controls: some View {
        HStack(spacing: 0) {
            TextField("Find in chapter", text: $query)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .focused($isFocused)
                .accessibilityLabel("Find in this chapter")
                .onSubmit { isFocused = false; onSubmit() }
                .padding(.leading, 12)
                .frame(minWidth: 60)
            if query.isEmpty {
                if let onSections {
                    Button {
                        isFocused = false
                        onClose()
                        onSections()
                    } label: {
                        ToolbarActionIcon(systemImage: "line.3.horizontal.decrease")
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Sections")
                    .accessibilityHint("Open the list of sections in this chapter")
                }
            } else {
                if isSearching {
                    ProgressView().controlSize(.small).padding(.horizontal, 4)
                        .accessibilityLabel("Searching this chapter")
                } else {
                    Text(activeIndex.map { "\($0 + 1) of \(matchCount)" } ?? "\(matchCount) matches")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)
                        .fixedSize()
                        .padding(.horizontal, 4)
                }
                findButton("Previous match", icon: "chevron.up", disabled: matchCount == 0 || isSearching) { onPrevious() }
                findButton("Next match", icon: "chevron.down", disabled: matchCount == 0 || isSearching) { onNext() }
            }
            findButton("Close chapter find", icon: "xmark") { onClose() }
        }
        .font(.subheadline)
    }

    private func findButton(_ title: String, icon: String, disabled: Bool = false, action: @escaping () -> Void) -> some View {
        Button { isFocused = false; action() } label: {
            ToolbarActionIcon(systemImage: icon)
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .accessibilityLabel(title)
    }
}

struct ChapterSectionPicker<Rows: View>: View {
    let accent: Color
    var chapter: CodeChapter? = nil
    let onClose: () -> Void
    @ViewBuilder let rows: () -> Rows

    var body: some View {
        NavigationStack {
            List {
                if let chapter {
                    Text(chapter.title.isEmpty ? chapter.displayLabel : "\(chapter.displayLabel): \(chapter.title)")
                        .font(.headline)
                        .accessibilityAddTraits(.isHeader)
                }
                rows()
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done", action: onClose)
                        .foregroundStyle(accent)
                        .accessibilityIdentifier("chapter-sections-close")
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

struct ChapterSectionPickerRow: View {
    let title: String
    let depth: Int
    let isCurrent: Bool
    let accent: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Image(systemName: isCurrent ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isCurrent ? accent : .secondary)
                    .accessibilityHidden(true)
                Text(title)
                    .font(depth == 0 ? .headline : .subheadline.weight(depth == 1 ? .semibold : .regular))
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
            }
            .padding(.leading, CGFloat(depth) * 16)
            .padding(.vertical, depth < 2 ? 6 : 3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityValue(isCurrent ? "Current section" : "")
    }

    nonisolated static func depth(title: String, sectionNumber: String?, fallback: Int) -> Int {
        let headingWord = title.split(whereSeparator: \.isWhitespace).first?.uppercased()
        if headingWord == "CHAPTER" || headingWord == "APPENDIX" { return 0 }

        // Some authored chapters use the same HTML heading level for the
        // chapter, section groups, provisions and subprovisions.
        let numberDepth = sectionNumber?.split { $0 == "." || $0 == "(" }.count ?? 0
        if numberDepth >= 2 { return min(numberDepth, 4) }
        switch headingWord {
        case "SECTION", "ARTICLE", "SUBCHAPTER", "SUBARTICLE", "PART", "EBC", "BC", "PC", "MC", "FGC":
            return 1
        default:
            return fallback
        }
    }
}
