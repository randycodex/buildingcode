import os.signpost
import SwiftUI
import WebKit

private enum ContentBlockHTMLAssetResolver {
    static func resolveSharedAssetPaths(in html: String, baseURL: URL?) -> String {
        guard let baseURL else {
            return html.replacingOccurrences(
                of: #"(?i)(["'(=]\s*)(?:\.\./)+assets/"#,
                with: "$1assets/",
                options: .regularExpression
            )
        }

        let assetRoot = baseURL
            .appendingPathComponent("assets", isDirectory: true)
            .absoluteString

        return html
            .replacingOccurrences(
                of: #"(?i)(["'(=]\s*)(?:\.\./)+assets/"#,
                with: "$1\(assetRoot)",
                options: .regularExpression
            )
            .replacingOccurrences(
                of: #"(?i)(["'(=]\s*)assets/"#,
                with: "$1\(assetRoot)",
                options: .regularExpression
            )
    }
}

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

    private var htmlBaseURL: URL? {
        htmlStore.readAccessURL()
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
                            TableBlockView(table: table, baseURL: htmlBaseURL)
                        } else if let html = block.html, !html.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            RawTableBlockView(htmlFragment: html, tableID: block.id, baseURL: htmlBaseURL)
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

        if let manifestURL = PublishedHTMLContentStore.resolvedImageURL(imageID: imageID, readAccessURL: readAccessURL) {
            os_signpost(.event, log: AppSignpost.reader, name: "imageResolve", "%{public}s", "manifest")
            return manifestURL
        }

        os_signpost(.event, log: AppSignpost.reader, name: "imageResolve", "%{public}s", "probe")
        return ContentBlockImageURLCache.shared.resolvedURL(
            imageID: imageID,
            readAccessURL: readAccessURL,
            candidates: { resolvedImageCandidates(for: imageID, relativeTo: readAccessURL) }
        )
    }

    private func resolvedImageCandidates(for imageID: String, relativeTo readAccessURL: URL) -> [URL] {
        let normalizedImageID = imageID
            .replacingOccurrences(
                of: #"(?i)^(?:\.\./)+assets/"#,
                with: "",
                options: .regularExpression
            )
            .replacingOccurrences(
                of: #"(?i)^assets/"#,
                with: "",
                options: .regularExpression
            )
        let directURL = readAccessURL.appendingPathComponent(imageID)
        let assetDirectoryURL = readAccessURL.appendingPathComponent("assets", isDirectory: true)
        let assetURL = assetDirectoryURL.appendingPathComponent(normalizedImageID)

        let baseName = URL(fileURLWithPath: normalizedImageID).deletingPathExtension().lastPathComponent
        let fallbackExtensions = ["png", "jpg", "jpeg", "gif", "webp"]
        let fallbackURLs = fallbackExtensions.flatMap { ext in
            [
                readAccessURL.appendingPathComponent("\(baseName).\(ext)"),
                assetDirectoryURL.appendingPathComponent("\(baseName).\(ext)")
            ]
        }

        return [directURL, assetURL] + fallbackURLs
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

private func isSimpleTable(_ table: CodeTableBlock) -> Bool {
    guard table.columnCount <= 6 else { return false }
    for cell in table.cells {
        if cell.rowSpan > 1 || cell.columnSpan > 1 { return false }
        if cell.backgroundColorHex != nil || cell.textColorHex != nil { return false }
        if cell.fontSize != nil { return false }
        if hasCustomTableBorders(cell.borders) { return false }
        if cell.html != cell.plainText, cell.html.contains("<") { return false }
    }
    return true
}

private func hasCustomTableBorders(_ borders: CodeTableCellBorders) -> Bool {
    [borders.left, borders.right, borders.top, borders.bottom].contains { border in
        !border.isHidden || border.width != nil || border.colorHex != nil || border.style != nil
    }
}

private struct SimpleTableBlockView: View {
    let table: CodeTableBlock

    var body: some View {
        let cellsByPosition = Dictionary(uniqueKeysWithValues: table.cells.map { ("\($0.row)-\($0.column)", $0) })
        Grid(horizontalSpacing: 0, verticalSpacing: 0) {
            ForEach(0..<table.rowCount, id: \.self) { row in
                GridRow {
                    ForEach(0..<table.columnCount, id: \.self) { column in
                        let cell = cellsByPosition["\(row)-\(column)"]
                        Text(cell?.plainText ?? "")
                            .font(.body)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 6)
                            .overlay(alignment: .bottom) {
                                Color(uiColor: .separator).frame(height: 0.5)
                            }
                            .overlay(alignment: .trailing) {
                                Color(uiColor: .separator).frame(width: 0.5)
                            }
                    }
                }
            }
        }
    }
}

private struct TableBlockView: View {
    let table: CodeTableBlock
    let baseURL: URL?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let caption = table.caption, !caption.isEmpty {
                Text(caption)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
            }

            Group {
                if isSimpleTable(table) {
                    SimpleTableBlockView(table: table)
                } else {
                    TableHTMLView(html: TableHTMLRenderer.html(for: table), tableID: table.id, baseURL: baseURL)
                }
            }
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
    let baseURL: URL?

    var body: some View {
        TableHTMLView(
            html: TableHTMLRenderer.html(forRawFragment: htmlFragment, tableID: tableID),
            tableID: tableID,
            baseURL: baseURL
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ImageDisplayWidthPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

struct ImageBlockView: View {
    let imageURL: URL
    let caption: String?
    let accessibilityText: String?
    let preferredAspectRatio: CGFloat?
    let onOpenImage: ((UIImage) -> Void)?
    let onLoadFailure: ((String) -> Void)?

    @State private var loadedImage: UIImage?
    @State private var displayWidth: CGFloat?
    @State private var failedToLoad = false
    @State private var loadAttempt = 0

    init(
        imageURL: URL,
        caption: String?,
        accessibilityText: String? = nil,
        preferredAspectRatio: CGFloat? = nil,
        onOpenImage: ((UIImage) -> Void)?,
        onLoadFailure: ((String) -> Void)? = nil
    ) {
        self.imageURL = imageURL
        self.caption = caption
        self.accessibilityText = accessibilityText
        self.preferredAspectRatio = preferredAspectRatio
        self.onOpenImage = onOpenImage
        self.onLoadFailure = onLoadFailure
    }

    private var inlineLoadID: String {
        let bucket = displayWidth.map { ImageBlockCache.sizeBucket(forMaxPixelSize: $0 * UIScreen.main.scale * 2) } ?? 0
        return "\(imageURL.path)|\(bucket)|\(loadAttempt)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Group {
                if let loadedImage {
                    Button {
                        Task {
                            if let fullImage = await ImageBlockCache.shared.loadFullImage(from: imageURL) {
                                onOpenImage?(fullImage)
                            } else {
                                onOpenImage?(loadedImage)
                            }
                        }
                    } label: {
                        Image(uiImage: loadedImage)
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .clipShape(RoundedRectangle(cornerRadius: CodeScreenMetrics.cardCornerRadius, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(accessibilityLabel)
                    .accessibilityHint("Opens the image full screen")
                } else if failedToLoad {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle")
                                .font(.footnote.weight(.semibold))
                            Text("Image unavailable")
                                .font(.footnote.weight(.semibold))
                        }
                        .foregroundStyle(.secondary)

                        Text(imageURL.lastPathComponent)
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                            .textSelection(.enabled)

                        Button {
                            loadAttempt += 1
                        } label: {
                            Label("Retry", systemImage: "arrow.clockwise")
                                .font(.footnote.weight(.semibold))
                        }
                        .buttonStyle(.plain)
                    }
                    .frame(maxWidth: .infinity, minHeight: 120, alignment: .leading)
                    .padding(CodeScreenMetrics.cardPadding)
                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: CodeScreenMetrics.cardCornerRadius, style: .continuous))
                } else {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text("Loading image")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .aspectRatio(placeholderAspectRatio, contentMode: .fit)
                    .frame(minHeight: 120)
                }
            }
            .background {
                GeometryReader { proxy in
                    Color.clear.preference(key: ImageDisplayWidthPreferenceKey.self, value: proxy.size.width)
                }
            }

            if let caption, !caption.isEmpty {
                Text(caption)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .onPreferenceChange(ImageDisplayWidthPreferenceKey.self) { width in
            guard width > 0 else { return }
            displayWidth = width
        }
        .task(id: inlineLoadID) {
            failedToLoad = false
            loadedImage = nil
            let bucket = displayWidth.map { ImageBlockCache.sizeBucket(forMaxPixelSize: $0 * UIScreen.main.scale * 2) }
            if let bucket, let cached = ImageBlockCache.shared.inlineImage(for: imageURL, sizeBucket: bucket) {
                loadedImage = cached
                return
            }

            let targetPixelSize = bucket ?? 2_048
            let image = await Task.detached(priority: .utility) {
                guard let data = try? Data(contentsOf: imageURL, options: [.mappedIfSafe]) else {
                    return nil as UIImage?
                }
                return ImageBlockCache.downsampledImage(data: data, maxPixelSize: targetPixelSize)
            }.value

            guard let image,
                  image.size.width > 1 || image.size.height > 1
            else {
                failedToLoad = true
                onLoadFailure?("Unable to decode \(imageURL.lastPathComponent).")
                return
            }
            if let bucket {
                ImageBlockCache.shared.setInlineImage(image, for: imageURL, sizeBucket: bucket)
            }
            loadedImage = image
        }
    }

    private var accessibilityLabel: Text {
        Text(accessibilityText ?? caption ?? "Code image")
    }

    private var placeholderAspectRatio: CGFloat {
        min(max(preferredAspectRatio ?? (16 / 9), 0.35), 4)
    }
}

final class ImageBlockCache {
    static let shared = ImageBlockCache()

    private let cache = NSCache<NSString, UIImage>()

    private init() {
        cache.countLimit = 64
        cache.totalCostLimit = 32 * 1024 * 1024
    }

    static func sizeBucket(forMaxPixelSize maxPixelSize: CGFloat) -> Int {
        let bucket = Int((maxPixelSize / 256).rounded()) * 256
        return max(256, bucket)
    }

    static func downsampledImage(data: Data, maxPixelSize: Int) -> UIImage? {
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: max(1, maxPixelSize),
            kCGImageSourceCreateThumbnailWithTransform: true
        ]
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            return UIImage(data: data)
        }
        return UIImage(cgImage: cgImage)
    }

    func inlineImage(for url: URL, sizeBucket: Int) -> UIImage? {
        cache.object(forKey: inlineCacheKey(url: url, sizeBucket: sizeBucket))
    }

    func setInlineImage(_ image: UIImage, for url: URL, sizeBucket: Int) {
        cache.setObject(image, forKey: inlineCacheKey(url: url, sizeBucket: sizeBucket), cost: Self.memoryCost(of: image))
    }

    func fullImage(for url: URL) -> UIImage? {
        cache.object(forKey: fullCacheKey(url: url))
    }

    func setFullImage(_ image: UIImage, for url: URL) {
        cache.setObject(image, forKey: fullCacheKey(url: url), cost: Self.memoryCost(of: image))
    }

    func loadFullImage(from url: URL) async -> UIImage? {
        if let cached = fullImage(for: url) {
            return cached
        }

        let image = await Task.detached(priority: .userInitiated) {
            guard let data = try? Data(contentsOf: url, options: [.mappedIfSafe]) else {
                return nil as UIImage?
            }
            return Self.downsampledImage(data: data, maxPixelSize: 4_096)
        }.value
        guard let image else { return nil }
        setFullImage(image, for: url)
        return image
    }

    private func inlineCacheKey(url: URL, sizeBucket: Int) -> NSString {
        "\(url.path)|\(sizeBucket)" as NSString
    }

    private func fullCacheKey(url: URL) -> NSString {
        "\(url.path)|full" as NSString
    }

    private static func memoryCost(of image: UIImage) -> Int {
        if let cgImage = image.cgImage {
            return cgImage.bytesPerRow * cgImage.height
        }
        let pixels = max(1, Int(image.size.width * image.scale)) * max(1, Int(image.size.height * image.scale))
        return pixels * 4
    }
}

private final class ContentBlockImageURLCache {
    static let shared = ContentBlockImageURLCache()

    private let cache = NSCache<NSString, NSURL>()
    private let missingCache = NSCache<NSString, NSString>()

    private init() {
        cache.countLimit = 512
        missingCache.countLimit = 512
    }

    func resolvedURL(
        imageID: String,
        readAccessURL: URL,
        candidates: () -> [URL]
    ) -> URL? {
        let key = "\(readAccessURL.path)|\(imageID)" as NSString
        if let cached = cache.object(forKey: key) {
            return cached as URL
        }
        if missingCache.object(forKey: key) != nil {
            return nil
        }

        for candidate in candidates() {
            if FileManager.default.fileExists(atPath: candidate.path) {
                cache.setObject(candidate as NSURL, forKey: key)
                return candidate
            }
        }

        missingCache.setObject(key, forKey: key)
        return nil
    }
}

private struct TableHTMLView: View {
    let html: String
    let tableID: String
    let baseURL: URL?
    @State private var height: CGFloat
    @State private var shouldLoad = false
    @State private var loadTask: Task<Void, Never>?

    init(html: String, tableID: String, baseURL: URL? = nil) {
        self.html = html
        self.tableID = tableID
        self.baseURL = baseURL
        _height = State(initialValue: TableHTMLHeightCache.height(for: tableID) ?? 120)
    }

    var body: some View {
        Group {
            if shouldLoad {
                TableWebView(html: html, tableID: tableID, baseURL: baseURL, height: $height)
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
            scheduleLoadIfNeeded()
        }
        .onDisappear {
            guard !shouldLoad else { return }
            loadTask?.cancel()
            loadTask = nil
        }
    }

    private func scheduleLoadIfNeeded() {
        guard !shouldLoad, loadTask == nil else { return }
        loadTask = Task { @MainActor in
            let delay = UInt64(staggerDelay(for: tableID) * 1_000_000_000)
            if delay > 0 {
                try? await Task.sleep(nanoseconds: delay)
            } else {
                await Task.yield()
            }
            guard !Task.isCancelled else { return }
            shouldLoad = true
            loadTask = nil
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
    let baseURL: URL?
    @Binding var height: CGFloat

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.backgroundColor = .clear
        webView.isOpaque = false
        webView.backgroundColor = .clear
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.tableID = tableID
        context.coordinator.readAccessURL = baseURL
        context.coordinator.heightChanged = { newHeight in
            let resolvedHeight = max(80, newHeight)
            TableHTMLHeightCache.setHeight(resolvedHeight, for: tableID)
            height = resolvedHeight
        }
        guard context.coordinator.loadedHTML != html else { return }
        context.coordinator.loadedHTML = html
        webView.loadHTMLString(
            ContentBlockHTMLAssetResolver.resolveSharedAssetPaths(in: html, baseURL: baseURL),
            baseURL: baseURL
        )
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var heightChanged: ((CGFloat) -> Void)?
        var loadedHTML: String?
        var tableID: String?
        var readAccessURL: URL?

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            measureHeight(in: webView, remainingPasses: 4)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard navigationAction.targetFrame?.isMainFrame != false else {
                decisionHandler(.allow)
                return
            }
            let allowed = BundledWebViewNavigationPolicy.allowsTopLevelNavigation(
                to: navigationAction.request.url,
                under: readAccessURL
            )
            decisionHandler(allowed ? .allow : .cancel)
        }

        private func measureHeight(in webView: WKWebView, remainingPasses: Int) {
            webView.evaluateJavaScript("Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)") { result, _ in
                if let value = result as? CGFloat {
                    self.heightChanged?(value)
                } else if let value = result as? Double {
                    self.heightChanged?(CGFloat(value))
                } else if let value = result as? Int {
                    self.heightChanged?(CGFloat(value))
                }
                guard remainingPasses > 0 else { return }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { [weak self, weak webView] in
                    guard let self, let webView else { return }
                    self.measureHeight(in: webView, remainingPasses: remainingPasses - 1)
                }
            }
        }
    }

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.navigationDelegate = nil
        uiView.stopLoading()
        coordinator.heightChanged = nil
        coordinator.loadedHTML = nil
        coordinator.tableID = nil
        coordinator.readAccessURL = nil
    }
}

private enum TableHTMLHeightCache {
    private static var heights: [String: CGFloat] = [:]
    private static var keys: [String] = []
    private static let limit = 256

    static func height(for id: String) -> CGFloat? {
        heights[id]
    }

    static func setHeight(_ height: CGFloat, for id: String) {
        heights[id] = height
        if let existingIndex = keys.firstIndex(of: id) {
            keys.remove(at: existingIndex)
        }
        keys.append(id)
        while keys.count > limit {
            let evicted = keys.removeFirst()
            heights.removeValue(forKey: evicted)
        }
    }
}

private final class TableHTMLDocumentCache {
    static let shared = TableHTMLDocumentCache()

    private let cache = NSCache<NSString, NSString>()

    private init() {
        cache.countLimit = 96
        cache.totalCostLimit = 16 * 1024 * 1024
    }

    func document(for key: String, build: () -> String) -> String {
        let cacheKey = key as NSString
        if let cached = cache.object(forKey: cacheKey) {
            return cached as String
        }
        let html = build()
        cache.setObject(html as NSString, forKey: cacheKey, cost: html.utf8.count)
        return html
    }
}

private enum TableHTMLRenderer {
    static func html(forRawFragment fragment: String, tableID: String) -> String {
        TableHTMLDocumentCache.shared.document(
            for: "raw|\(tableID)|\(fragment.count)"
        ) {
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
              [style*="background-color:white" i],
              [style*="background-color: white" i],
              [style*="background:white" i],
              [style*="background: white" i] {
                background-color: #1c1c1e !important;
              }
              [style*="background-color:#C0C0C0" i] {
                background-color: #3a3a3c !important;
              }
              [style*="background-color:#808080" i] {
                background-color: #2c2c2e !important;
              }
              [style*="background-color:#f8cbad" i],
              [style*="background-color:#f7caac" i],
              [style*="background-color:#fce4d6" i],
              [style*="background-color:#fbe4d5" i] {
                background-color: #3a281d !important;
              }
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
    }

    static func html(for table: CodeTableBlock) -> String {
        TableHTMLDocumentCache.shared.document(
            for: "table|\(table.id)|\(table.rowCount)|\(table.columnCount)|\(table.cells.count)|\(table.hashValue)"
        ) {
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
