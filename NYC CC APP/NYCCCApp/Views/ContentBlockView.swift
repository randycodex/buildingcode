import SwiftUI
import WebKit

struct ContentBlockListView: View {
    let detail: ReaderSectionDetail
    let fallbackText: NSAttributedString
    var onOpenImage: ((UIImage) -> Void)?
    var onContentTap: (() -> Void)? = nil
    var onSelectionChange: ((Bool) -> Void)? = nil

    @EnvironmentObject private var library: CodeLibraryViewModel

    private var htmlStore: PublishedHTMLContentStore {
        ContentBlockHTMLStoreCache.shared.store(
            for: library.selectedVersion?.authoredHTMLBundlePath
        )
    }

    var body: some View {
        if detail.contentBlocks.isEmpty {
            AttributedTextView(
                attributedText: fallbackText,
                onOpenImage: onOpenImage,
                onContentTap: onContentTap,
                onSelectionChange: onSelectionChange
            )
        } else {
            VStack(alignment: .leading, spacing: 7) {
                ForEach(detail.contentBlocks) { block in
                    switch block.kind {
                    case .html:
                        if let caption = tableCaptionText(for: block) {
                            TableCaptionTextView(text: caption)
                        } else {
                            AttributedTextView(
                                attributedText: attributedText(for: block),
                                onOpenImage: onOpenImage,
                                onContentTap: onContentTap,
                                onSelectionChange: onSelectionChange
                            )
                        }
                    case .table:
                        if let tableID = block.tableID,
                           let table = detail.tableBlocks.first(where: { $0.id == tableID }) {
                            TableBlockView(table: table)
                        } else if let html = block.html, !html.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            RawTableBlockView(htmlFragment: html, tableID: block.id)
                        } else {
                            MissingTableBlockView(tableID: block.tableID ?? "")
                        }
                    case .image:
                        if let imageURL = imageURL(for: block) {
                            ImageBlockView(
                                imageURL: imageURL,
                                caption: block.caption,
                                onOpenImage: onOpenImage
                            )
                        } else {
                            ImageBlockPlaceholderView(imageID: block.imageID ?? "", caption: block.caption)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func attributedText(for block: CodeContentBlock) -> NSAttributedString {
        let text = block.plainText ?? block.html ?? ""
        if let html = block.html, !html.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return library.renderHTMLTextBlock(html, fallbackText: text)
        }
        return library.renderPlainTextBlock(text)
    }

    private func tableCaptionText(for block: CodeContentBlock) -> String? {
        let text = (block.plainText ?? block.html ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.range(of: #"^Table\s+[A-Z]?\d+"#, options: [.regularExpression, .caseInsensitive]) != nil else {
            return nil
        }
        return text
    }

    private func imageURL(for block: CodeContentBlock) -> URL? {
        guard let imageID = block.imageID?.trimmingCharacters(in: .whitespacesAndNewlines),
              !imageID.isEmpty,
              let readAccessURL = htmlStore.readAccessURL()
        else {
            return nil
        }

        let directURL = readAccessURL.appendingPathComponent(imageID)
        if FileManager.default.fileExists(atPath: directURL.path) {
            return directURL
        }

        let assetURL = readAccessURL.appendingPathComponent("assets", isDirectory: true)
            .appendingPathComponent(imageID)
        if FileManager.default.fileExists(atPath: assetURL.path) {
            return assetURL
        }

        return nil
    }
}

private struct MissingTableBlockView: View {
    let tableID: String

    var body: some View {
        CodeSurface(accent: Color.secondary, padding: 12) {
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
                    .font(.subheadline.weight(.semibold))
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

private struct TableCaptionTextView: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.primary)
            .lineSpacing(2)
            .padding(.top, 8)
            .padding(.bottom, 2)
            .textSelection(.enabled)
    }
}

private struct RawTableBlockView: View {
    let htmlFragment: String
    let tableID: String

    var body: some View {
        TableHTMLView(
            html: TableHTMLRenderer.html(forRawFragment: htmlFragment),
            tableID: tableID
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ImageBlockView: View {
    let imageURL: URL
    let caption: String?
    let onOpenImage: ((UIImage) -> Void)?

    @State private var loadedImage: UIImage?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Group {
                if let loadedImage {
                    Button {
                        onOpenImage?(loadedImage)
                    } label: {
                        Image(uiImage: loadedImage)
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(.plain)
                } else {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text("Loading image")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 120, alignment: .leading)
                }
            }

            if let caption, !caption.isEmpty {
                Text(caption)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .task(id: imageURL) {
            if let cached = ImageBlockCache.shared.image(for: imageURL) {
                loadedImage = cached
                return
            }

            let data = await Task.detached(priority: .utility) {
                try? Data(contentsOf: imageURL, options: [.mappedIfSafe])
            }.value
            guard let data, let image = UIImage(data: data) else { return }
            ImageBlockCache.shared.setImage(image, for: imageURL)
            loadedImage = image
        }
    }
}

private final class ImageBlockCache {
    static let shared = ImageBlockCache()

    private let cache = NSCache<NSString, UIImage>()

    private init() {
        cache.countLimit = 64
    }

    func image(for url: URL) -> UIImage? {
        cache.object(forKey: url.path as NSString)
    }

    func setImage(_ image: UIImage, for url: URL) {
        cache.setObject(image, forKey: url.path as NSString)
    }
}

private struct TableHTMLView: View {
    let html: String
    let tableID: String
    @State private var height: CGFloat
    @State private var shouldLoad = false

    init(html: String, tableID: String) {
        self.html = html
        self.tableID = tableID
        _height = State(initialValue: TableHTMLHeightCache.height(for: tableID) ?? 120)
    }

    var body: some View {
        Group {
            if shouldLoad {
                TableWebView(html: html, tableID: tableID, height: $height)
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
                let delay = UInt64(staggerDelay(for: tableID) * 1_000_000_000)
                if delay > 0 {
                    try? await Task.sleep(nanoseconds: delay)
                } else {
                    await Task.yield()
                }
                shouldLoad = true
            }
        }
    }

    private func staggerDelay(for id: String) -> Double {
        guard TableHTMLHeightCache.height(for: id) == nil else { return 0 }
        let number = Int(id.split(separator: "-").last ?? "") ?? abs(id.hashValue % 12)
        return min(Double(number % 12) * 0.055, 0.55)
    }
}

private struct TableWebView: UIViewRepresentable {
    let html: String
    let tableID: String
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
        context.coordinator.tableID = tableID
        context.coordinator.heightChanged = { newHeight in
            let resolvedHeight = max(80, newHeight)
            TableHTMLHeightCache.setHeight(resolvedHeight, for: tableID)
            height = resolvedHeight
        }
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
        var tableID: String?

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.evaluateJavaScript("Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)") { result, _ in
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

private enum TableHTMLHeightCache {
    private static var heights: [String: CGFloat] = [:]

    static func height(for id: String) -> CGFloat? {
        heights[id]
    }

    static func setHeight(_ height: CGFloat, for id: String) {
        heights[id] = height
    }
}

private enum TableHTMLRenderer {
    static func html(forRawFragment fragment: String) -> String {
        let bodyHTML = fragment
            .replacingOccurrences(of: "<ScrollTable", with: "<div class=\"scroll-table\"", options: .caseInsensitive)
            .replacingOccurrences(of: "</ScrollTable>", with: "</div>", options: .caseInsensitive)

        return """
        <!doctype html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            :root { color-scheme: light dark; }
            html, body {
              margin: 0;
              padding: 0;
              background: transparent;
              color: #111111;
              font: -apple-system-body;
            }
            .table-wrap, .scroll-table, .xsl-table {
              overflow-x: auto;
              width: 100%;
              -webkit-overflow-scrolling: touch;
            }
            .scroll-table:has(.xsl-table--body) > .xsl-table--header,
            tfoot:empty,
            tfoot.empty-footer {
              display: none;
            }
            table {
              border-collapse: collapse;
              table-layout: auto;
              width: max-content;
              min-width: 100%;
              font-size: 15px;
              line-height: 1.35;
              border: 1px solid #c7c7cc;
              background: rgba(242, 242, 247, 0.78);
            }
            th, td {
              padding: 7px 9px;
              vertical-align: top;
              min-width: 72px;
              overflow-wrap: normal;
              white-space: normal;
              border: 1px solid #c7c7cc;
            }
            th, td[style*="bold"], b, strong {
              font-weight: 700;
            }
            @media (prefers-color-scheme: dark) {
              body { color: #f2f2f7; }
              table {
                background: rgba(44, 44, 46, 0.72);
                border-color: #636366;
              }
              th, td { border-color: #636366; }
            }
          </style>
        </head>
        <body>
          <div class="table-wrap">\(bodyHTML)</div>
          <script>
            (() => {
              document.querySelectorAll('.scroll-table').forEach((scrollTable) => {
                if (scrollTable.querySelector('.xsl-table--body')) {
                  scrollTable.querySelectorAll(':scope > .xsl-table--header').forEach((header) => header.remove());
                }
              });
              document.querySelectorAll('tfoot').forEach((footer) => {
                if (!footer.textContent.trim()) {
                  footer.remove();
                }
              });
              document.querySelectorAll('tr').forEach((row) => {
                if (!row.textContent.trim() && row.closest('tfoot')) {
                  row.remove();
                }
              });
            })();
          </script>
        </body>
        </html>
        """
    }

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

private final class ContentBlockHTMLStoreCache {
    static let shared = ContentBlockHTMLStoreCache()

    private let lock = NSLock()
    private var stores: [String: PublishedHTMLContentStore] = [:]

    func store(for relativeRootPath: String?) -> PublishedHTMLContentStore {
        let key = relativeRootPath ?? ""
        lock.lock()
        defer { lock.unlock() }
        if let cached = stores[key] {
            return cached
        }
        let store = PublishedHTMLContentStore(relativeRootPath: relativeRootPath)
        stores[key] = store
        return store
    }
}

private struct ImageBlockPlaceholderView: View {
    let imageID: String
    let caption: String?

    var body: some View {
        CodeSurface(accent: Color.secondary, padding: 12) {
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
    }
}
