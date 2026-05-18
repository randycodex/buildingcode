import SwiftUI
import WebKit

struct ContentBlockListView: View {
    let detail: ReaderSectionDetail
    let fallbackText: NSAttributedString
    var onOpenImage: ((UIImage) -> Void)?

    @EnvironmentObject private var library: CodeLibraryViewModel

    var body: some View {
        if detail.contentBlocks.isEmpty {
            AttributedTextView(
                attributedText: fallbackText,
                onOpenImage: onOpenImage
            )
        } else {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(detail.contentBlocks) { block in
                    switch block.kind {
                    case .html:
                        AttributedTextView(
                            attributedText: attributedText(for: block),
                            onOpenImage: onOpenImage
                        )
                    case .table:
                        if let tableID = block.tableID,
                           let table = detail.tableBlocks.first(where: { $0.id == tableID }) {
                            TableBlockView(table: table)
                        } else {
                            MissingTableBlockView(tableID: block.tableID ?? "")
                        }
                    case .image:
                        ImageBlockPlaceholderView(imageID: block.imageID ?? "", caption: block.caption)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func attributedText(for block: CodeContentBlock) -> NSAttributedString {
        let text = block.plainText ?? block.html ?? ""
        return library.renderPlainTextBlock(text)
    }
}

private struct MissingTableBlockView: View {
    let tableID: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "tablecells")
                    .font(.headline)
                Text(tableID.isEmpty ? "Table" : tableID)
                    .font(.headline)
            }

            Text("Table data is missing from the imported source.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

private struct TableBlockView: View {
    let table: CodeTableBlock
    private let html: String

    init(table: CodeTableBlock) {
        self.table = table
        self.html = TableHTMLRenderer.html(for: table)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let caption = table.caption, !caption.isEmpty {
                Text(caption)
                    .font(.headline)
                    .foregroundStyle(.primary)
            }

            TableHTMLView(html: html, tableID: table.id)
                .frame(maxWidth: .infinity, alignment: .leading)

            ForEach(Array(table.footnotes.enumerated()), id: \.offset) { _, footnote in
                Text(footnote)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct TableHTMLView: View {
    let html: String
    let tableID: String
    @State private var height: CGFloat = 120
    @State private var shouldLoad = false

    var body: some View {
        Group {
            if shouldLoad {
                TableWebView(html: html, height: $height)
                    .id(tableID)
                    .frame(height: height)
            } else {
                HStack(spacing: 8) {
                    ProgressView()
                    Text("Loading table")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, minHeight: 80, alignment: .leading)
            }
        }
        .onAppear {
            guard !shouldLoad else { return }
            Task { @MainActor in
                await Task.yield()
                shouldLoad = true
            }
        }
    }
}

private struct TableWebView: UIViewRepresentable {
    let html: String
    @Binding var height: CGFloat

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.backgroundColor = .clear
        webView.isOpaque = false
        webView.backgroundColor = .clear
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.heightChanged = { height = max(80, $0) }
        guard context.coordinator.loadedHTML != html else { return }
        context.coordinator.loadedHTML = html
        webView.loadHTMLString(html, baseURL: nil)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var heightChanged: ((CGFloat) -> Void)?
        var loadedHTML: String?

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.evaluateJavaScript("document.documentElement.scrollHeight") { result, _ in
                if let value = result as? CGFloat {
                    self.heightChanged?(value)
                } else if let value = result as? Double {
                    self.heightChanged?(CGFloat(value))
                } else if let value = result as? Int {
                    self.heightChanged?(CGFloat(value))
                }
            }
        }
    }

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.navigationDelegate = nil
        uiView.stopLoading()
        uiView.loadHTMLString("", baseURL: nil)
    }
}

private enum TableHTMLRenderer {
    static func html(for table: CodeTableBlock) -> String {
        let colGroupHTML = colGroup(for: table)
        let rows = (0..<max(0, table.rowCount)).map { rowIndex in
            let rowStyle = rowStyle(for: table, rowIndex: rowIndex)
            let cells = table.cells
                .filter { $0.row == rowIndex }
                .sorted { $0.column < $1.column }
                .map(cellHTML)
                .joined()
            if rowStyle.isEmpty {
                return "<tr>\(cells)</tr>"
            }
            return "<tr style=\"\(rowStyle)\">\(cells)</tr>"
        }.joined()

        return """
        <!doctype html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            :root { color-scheme: light dark; }
            body {
              margin: 0;
              padding: 0;
              background: transparent;
              color: #111111;
              font: -apple-system-body;
            }
            .table-wrap {
              overflow-x: auto;
              width: 100%;
              -webkit-overflow-scrolling: touch;
            }
            table {
              border-collapse: collapse;
              min-width: 100%;
              table-layout: auto;
              font-size: 15px;
              line-height: 1.35;
              border: 1px solid #7c7c7c;
            }
            td {
              padding: 7px 9px;
              vertical-align: top;
              min-width: 72px;
              overflow-wrap: anywhere;
              border: 1px solid #7c7c7c;
            }
            .nowrap { white-space: nowrap; }
            @media (prefers-color-scheme: dark) {
              body { color: #f2f2f7; }
              table, td { border-color: #8e8e93; }
            }
          </style>
        </head>
        <body><div class="table-wrap"><table>\(colGroupHTML)\(rows)</table></div></body>
        </html>
        """
    }

    private static func cellHTML(_ cell: CodeTableCell) -> String {
        var attributes: [String] = []
        if cell.rowSpan > 1 {
            attributes.append("rowspan=\"\(cell.rowSpan)\"")
        }
        if cell.columnSpan > 1 {
            attributes.append("colspan=\"\(cell.columnSpan)\"")
        }
        let style = cellStyle(cell)
        if !style.isEmpty {
            attributes.append("style=\"\(style)\"")
        }
        return "<td \(attributes.joined(separator: " "))>\(cell.html)</td>"
    }

    private static func cellStyle(_ cell: CodeTableCell) -> String {
        var styles: [String] = []
        if let horizontal = cell.horizontalAlignment {
            styles.append("text-align: \(horizontal);")
        }
        if let vertical = cell.verticalAlignment {
            styles.append("vertical-align: \(vertical);")
        }
        if let bg = cell.backgroundColorHex.map(cssColor) {
            styles.append("background-color: \(bg);")
        }
        if let fg = cell.textColorHex.map(cssColor) {
            styles.append("color: \(fg);")
        }
        if cell.isBold == true {
            styles.append("font-weight: 700;")
        }
        if cell.isItalic == true {
            styles.append("font-style: italic;")
        }
        if let fontSize = cell.fontSize, fontSize > 0 {
            styles.append("font-size: \(fontSize)px;")
        }
        if cell.isWrapped == false {
            // Excel defaults can be "no wrap". Keep it readable by allowing wrapping unless explicitly disabled.
        }
        if cell.isWrapped == false {
            styles.append("white-space: nowrap;")
        }
        styles.append(borderStyle("left", cell.borders.left))
        styles.append(borderStyle("right", cell.borders.right))
        styles.append(borderStyle("top", cell.borders.top))
        styles.append(borderStyle("bottom", cell.borders.bottom))
        return styles.filter { !$0.isEmpty }.joined(separator: " ")
    }

    private static func borderStyle(_ side: String, _ border: CodeTableBorder) -> String {
        guard !border.isHidden else {
            return "border-\(side): 0;"
        }
        let width = border.width.map { "\($0)px" } ?? "1px"
        let style = border.style ?? "solid"
        let color = border.colorHex.map(cssColor) ?? "currentColor"
        return "border-\(side): \(width) \(style) \(color);"
    }

    private static func cssColor(_ hex: String) -> String {
        let trimmed = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        if trimmed.count == 8 {
            return "#\(String(trimmed.suffix(6)))"
        }
        return "#\(trimmed)"
    }

    private static func colGroup(for table: CodeTableBlock) -> String {
        guard let widths = table.columnWidths, !widths.isEmpty else { return "" }
        let cols = widths.enumerated().map { _, width in
            guard let width, width > 0 else { return "<col />" }
            // Excel stores column widths in "character widths". Treat as a hint and scale to px.
            let px = max(24, width * 7.0)
            return "<col style=\"width: \(px)px\" />"
        }.joined()
        return "<colgroup>\(cols)</colgroup>"
    }

    private static func rowStyle(for table: CodeTableBlock, rowIndex: Int) -> String {
        guard let heights = table.rowHeights, rowIndex < heights.count else { return "" }
        guard let height = heights[rowIndex], height > 0 else { return "" }
        // Excel row heights are in points. Approx px ~= pt * 96 / 72 = pt * 1.333...
        let px = max(16, height * 1.3333333333)
        return "height: \(px)px;"
    }
}

private struct ImageBlockPlaceholderView: View {
    let imageID: String
    let caption: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "photo")
                    .font(.headline)
                Text(imageID.isEmpty ? "Image" : imageID)
                    .font(.headline)
            }

            if let caption, !caption.isEmpty {
                Text(caption)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}
