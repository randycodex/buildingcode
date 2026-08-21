import SwiftUI
import UIKit
import WebKit

enum BundledWebViewNavigationPolicy {
    /// Allows only a top-level file navigation within the supplied bundled
    /// content root. Reader markup may use relative anchors and local assets;
    /// it must not replace the reader with a remote or unrelated local page.
    static func allowsTopLevelNavigation(to url: URL?, under readAccessURL: URL?) -> Bool {
        guard let url else { return false }
        if url.scheme?.lowercased() == "about", url.absoluteString == "about:blank" {
            return true
        }
        guard url.isFileURL, let readAccessURL else { return false }

        let candidatePath = url.standardizedFileURL.path
        let rootPath = readAccessURL.standardizedFileURL.path
        return candidatePath == rootPath || candidatePath.hasPrefix(rootPath + "/")
    }

    static func allowsNavigation(
        to url: URL?,
        under readAccessURL: URL?,
        isMainFrame: Bool?
    ) -> Bool {
        guard isMainFrame == true else { return false }
        return allowsTopLevelNavigation(to: url, under: readAccessURL)
    }

    static func externalURLForUserActivatedNavigation(
        to url: URL?,
        isUserActivated: Bool,
        isMainFrame: Bool?
    ) -> URL? {
        guard isUserActivated, isMainFrame != false, let url, url.host != nil else { return nil }
        return ["http", "https"].contains(url.scheme?.lowercased() ?? "") ? url : nil
    }
}

enum ChapterHTMLLoadState: Equatable {
    case loading
    case loaded
    case failed(String)
}

enum ChapterHTMLLoadRecoveryPolicy {
    static let maximumAutomaticAttempts = 2

    static func shouldRetry(error: Error, attempt: Int) -> Bool {
        let error = error as NSError
        let isCancelled = error.domain == NSURLErrorDomain && error.code == NSURLErrorCancelled
        return !isCancelled &&
            attempt < maximumAutomaticAttempts
    }
}

@MainActor
enum ChapterHTMLWebProcessWarmup {
    private static var warmupWebView: WKWebView?
    private static var hasStarted = false

    static func startIfNeeded() {
        guard !hasStarted else { return }
        hasStarted = true

        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false
        let webView = WKWebView(frame: .zero, configuration: configuration)
        warmupWebView = webView
        webView.loadHTMLString(
            "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width\"></head><body></body></html>",
            baseURL: nil
        )
        #if DEBUG
        print("permitext diagnostics: chapterReader WebKit warmup started")
        #endif
    }

    static func releaseAfterReaderStarts() {
        warmupWebView?.stopLoading()
        warmupWebView = nil
    }
}

private enum HTMLAssetPathResolver {
    private static let readerViewportContent = "width=device-width, initial-scale=1.0"

    static func resolveSharedAssetPaths(in html: String, readAccessURL: URL) -> String {
        let assetRoot = readAccessURL
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

    static func injectInitialReaderStyle(
        into html: String,
        colorScheme: ColorScheme
    ) -> String {
        let isDark = colorScheme == .dark
        let backgroundColor = isDark ? "#000000" : "#f2f2f7"
        let textColor = isDark ? "#f5f5f7" : "#111111"
        let bootstrapStyle = """
        <style id="nyccc-initial-reader-style">
        html {
          background: \(backgroundColor) !important;
          color-scheme: \(isDark ? "dark" : "light");
        }
        body {
          background: \(backgroundColor) !important;
          color: \(textColor) !important;
        }
        </style>
        """
        let hasViewport = html.range(
            of: #"<meta\b[^>]*\bname\s*=\s*(['\"])viewport\1[^>]*>"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil
        let viewportMeta = hasViewport
            ? ""
            : #"<meta name="viewport" content="\#(readerViewportContent)">"#
        let bootstrapHead = viewportMeta + bootstrapStyle

        if html.range(of: "</head>", options: .caseInsensitive) != nil {
            return html.replacingOccurrences(
                of: "</head>",
                with: "\(bootstrapHead)</head>",
                options: .caseInsensitive
            )
        }

        return bootstrapHead + html
    }
}

enum PreparedChapterHTMLCache {
    private static let cache: NSCache<NSString, NSString> = {
        let cache = NSCache<NSString, NSString>()
        cache.countLimit = 16
        cache.totalCostLimit = 24 * 1024 * 1024
        return cache
    }()

    static func preparedHTML(chapterURL: URL, readAccessURL: URL, colorScheme: ColorScheme) -> String? {
        let key = cacheKey(chapterURL: chapterURL, colorScheme: colorScheme)
        if let cached = cache.object(forKey: key) {
            return cached as String
        }

        guard let html = try? String(contentsOf: chapterURL, encoding: .utf8) else {
            return nil
        }

        let normalizedAssetsHTML = HTMLAssetPathResolver.resolveSharedAssetPaths(
            in: html,
            readAccessURL: readAccessURL
        )
        let preparedHTML = HTMLAssetPathResolver.injectInitialReaderStyle(
            into: normalizedAssetsHTML,
            colorScheme: colorScheme
        )
        cache.setObject(preparedHTML as NSString, forKey: key, cost: stringMemoryCost(preparedHTML))
        return preparedHTML
    }

    static func preload(chapterURL: URL, readAccessURL: URL, colorSchemes: [ColorScheme] = [.light, .dark]) {
        for colorScheme in colorSchemes {
            _ = preparedHTML(chapterURL: chapterURL, readAccessURL: readAccessURL, colorScheme: colorScheme)
        }
    }

    static func removeAll() {
        cache.removeAllObjects()
    }

    private static func cacheKey(chapterURL: URL, colorScheme: ColorScheme) -> NSString {
        "\(chapterURL.path)|\(colorScheme == .dark ? "dark" : "light")" as NSString
    }

    private static func stringMemoryCost(_ value: String) -> Int {
        max(value.utf8.count, value.utf16.count * 2)
    }
}

struct ChapterHTMLSectionTarget: Hashable {
    let anchorID: String
    let sectionNumber: String?
    let codePrefix: String?
    let blockID: String?
    let blockLabel: String?
    let action: String?

    init(
        anchorID: String,
        sectionNumber: String?,
        codePrefix: String? = nil,
        blockID: String? = nil,
        blockLabel: String? = nil,
        action: String? = nil
    ) {
        self.anchorID = anchorID
        self.sectionNumber = sectionNumber
        self.codePrefix = codePrefix
        self.blockID = blockID
        self.blockLabel = blockLabel
        self.action = action
    }
}

struct ChapterHTMLResearchTarget: Hashable {
    let anchorID: String
    let sectionNumber: String?
    let selectedText: String
}

private final class ChapterResearchWebView: WKWebView {
    var onResearchSelectionMenuAction: (() -> Void)?

    override func buildMenu(with builder: UIMenuBuilder) {
        super.buildMenu(with: builder)
        guard builder.system == .context else { return }

        let researchAction = UIAction(
            title: "Research",
            image: UIImage(systemName: "sparkle")
        ) { [weak self] _ in
            self?.onResearchSelectionMenuAction?()
        }
        let researchMenu = UIMenu(
            title: "",
            options: .displayInline,
            children: [researchAction]
        )
        builder.insertChild(researchMenu, atEndOfMenu: .standardEdit)
    }
}

struct ChapterHTMLWebView: UIViewRepresentable {
    let chapterURL: URL
    let readAccessURL: URL
    let targetAnchorID: String?
    let targetSearchText: String?
    let targetSearchRequestID: Int
    let readerTheme: ReaderTheme
    let accentHex: String
    let colorScheme: ColorScheme
    let bookmarkedAnchorIDs: Set<String>
    let bookmarkedSectionNumbers: Set<String>
    let expandAllTrigger: Int
    let collapseAllTrigger: Int
    let scrollToTopTrigger: Int
    let scrollProgressSyncTrigger: Int
    let reloadTrigger: Int
    let restoreScrollOffset: Double?
    let onLoadStateChange: ((ChapterHTMLLoadState) -> Void)?
    let onVisibleAnchorChange: ((String) -> Void)?
    let onScrollProgressChange: ((CGFloat) -> Void)?
    let onScrollOffsetChange: ((CGFloat) -> Void)?
    let onOpenSectionForAnchor: ((ChapterHTMLSectionTarget) -> Void)?
    let onResearchSelection: ((ChapterHTMLResearchTarget) -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.userContentController.add(context.coordinator, name: Coordinator.visibleAnchorMessageName)
        configuration.userContentController.add(context.coordinator, name: Coordinator.scrollProgressMessageName)
        configuration.userContentController.add(context.coordinator, name: Coordinator.openSectionMessageName)
        configuration.userContentController.add(context.coordinator, name: Coordinator.researchSelectionMessageName)
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: Coordinator.initialReaderBootstrapScript(for: colorScheme),
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )

        let webView = ChapterResearchWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.delegate = context.coordinator
        let pageBackgroundColor = Coordinator.pageBackgroundUIColor(for: colorScheme)
        webView.backgroundColor = pageBackgroundColor
        webView.scrollView.backgroundColor = pageBackgroundColor
        webView.scrollView.minimumZoomScale = 1
        webView.scrollView.maximumZoomScale = 5
        webView.scrollView.bouncesZoom = true
        webView.scrollView.alwaysBounceHorizontal = false
        webView.scrollView.showsHorizontalScrollIndicator = false
        webView.scrollView.isDirectionalLockEnabled = true
        webView.isOpaque = true
        webView.allowsBackForwardNavigationGestures = false
        context.coordinator.parent = self
        context.coordinator.webView = webView
        webView.onResearchSelectionMenuAction = { [weak coordinator = context.coordinator, weak webView] in
            guard let webView else { return }
            coordinator?.performResearchSelectionFromMenu(in: webView)
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.parent = self
        context.coordinator.webView = webView
        let pageBackgroundColor = Coordinator.pageBackgroundUIColor(for: colorScheme)
        webView.backgroundColor = pageBackgroundColor
        webView.scrollView.backgroundColor = pageBackgroundColor

        if context.coordinator.loadedURL != chapterURL {
            context.coordinator.loadedURL = chapterURL
            context.coordinator.appliedReloadTrigger = reloadTrigger
            context.coordinator.resetLoadRecovery()
            context.coordinator.resetScrollProgressReporting()
            context.coordinator.pendingAnchorID = targetAnchorID
            context.coordinator.reportLoadState(.loading)
            // Load off the main thread: reading a multi-MB HTML file and
            // running normalizeSharedAssetPaths synchronously in updateUIView
            // blocks the UI for the entire duration of the file read.
            context.coordinator.loadHTMLAsync(
                chapterURL: chapterURL,
                readAccessURL: readAccessURL,
                into: webView
            )
            return
        }

        if context.coordinator.appliedReloadTrigger != reloadTrigger {
            context.coordinator.appliedReloadTrigger = reloadTrigger
            context.coordinator.resetLoadRecovery()
            context.coordinator.pendingAnchorID = targetAnchorID
            context.coordinator.reportLoadState(.loading)
            context.coordinator.loadHTMLAsync(
                chapterURL: chapterURL,
                readAccessURL: readAccessURL,
                into: webView
            )
            return
        }

        if context.coordinator.appliedTheme != readerTheme ||
            context.coordinator.appliedAccentHex != accentHex ||
            context.coordinator.appliedColorScheme != colorScheme {
            context.coordinator.applyReaderScripts(to: webView)
        }

        if context.coordinator.appliedBookmarkedAnchorIDs != bookmarkedAnchorIDs ||
            context.coordinator.appliedBookmarkedSectionNumbers != bookmarkedSectionNumbers {
            context.coordinator.applyBookmarkDecorations(to: webView)
        }
        if context.coordinator.appliedExpandAllTrigger != expandAllTrigger {
            context.coordinator.appliedExpandAllTrigger = expandAllTrigger
            context.coordinator.setAllSectionCollapsed(to: false, in: webView)
        }
        if context.coordinator.appliedCollapseAllTrigger != collapseAllTrigger {
            context.coordinator.appliedCollapseAllTrigger = collapseAllTrigger
            context.coordinator.setAllSectionCollapsed(to: true, in: webView)
        }
        let searchScrollTarget = Coordinator.SearchScrollTarget(anchorID: targetAnchorID, query: targetSearchText, requestID: targetSearchRequestID)
        if context.coordinator.lastSearchScrollTarget != searchScrollTarget {
            context.coordinator.scroll(to: targetAnchorID, matching: targetSearchText, in: webView)
        }
        if context.coordinator.appliedScrollToTopTrigger != scrollToTopTrigger {
            context.coordinator.appliedScrollToTopTrigger = scrollToTopTrigger
            context.coordinator.scrollToTop(in: webView)
        }
        if context.coordinator.appliedScrollProgressSyncTrigger != scrollProgressSyncTrigger {
            context.coordinator.appliedScrollProgressSyncTrigger = scrollProgressSyncTrigger
            context.coordinator.syncScrollProgress(in: webView)
        }
    }

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        coordinator.teardown(webView: uiView)
    }

    final class Coordinator: NSObject, WKNavigationDelegate, UIScrollViewDelegate, WKScriptMessageHandler {
        static let visibleAnchorMessageName = "nycccVisibleAnchor"
        static let scrollProgressMessageName = "nycccScrollProgress"
        static let openSectionMessageName = "nycccOpenSection"
        static let researchSelectionMessageName = "nycccResearchSelection"

        var parent: ChapterHTMLWebView?
        weak var webView: WKWebView?
        var loadedURL: URL?
        var appliedReloadTrigger = 0
        var pendingAnchorID: String?
        var lastScrolledAnchorID: String?
        var lastSearchScrollTarget: SearchScrollTarget?
        var appliedTheme: ReaderTheme?
        var appliedAccentHex: String?
        var appliedColorScheme: ColorScheme?
        var appliedBookmarkedAnchorIDs: Set<String> = []
        var appliedBookmarkedSectionNumbers: Set<String> = []
        var appliedExpandAllTrigger = 0
        var appliedCollapseAllTrigger = 0
        var appliedScrollToTopTrigger = 0
        var appliedScrollProgressSyncTrigger = 0
        private var htmlLoadTask: Task<Void, Never>?
        private var recoveryTask: Task<Void, Never>?
        private var htmlLoadGeneration = 0
        private var automaticRecoveryAttempt = 0
        private var htmlLoadBeganAt: TimeInterval?
        private var lastReportedScrollProgress: CGFloat = -1
        private var visibleAnchorReportPending = false
        private var suppressVisibleAnchorReportsUntil: Date?
        private var suppressScrollOffsetReportsUntil: Date?

        func loadHTMLAsync(chapterURL: URL, readAccessURL: URL, into webView: WKWebView) {
            htmlLoadTask?.cancel()
            htmlLoadGeneration &+= 1
            let loadGeneration = htmlLoadGeneration
            let colorScheme = parent?.colorScheme ?? .light
            let beganAt = ProcessInfo.processInfo.systemUptime
            htmlLoadBeganAt = beganAt
            #if DEBUG
            print("permitext diagnostics: chapterReader begin file=\(chapterURL.lastPathComponent)")
            #endif
            htmlLoadTask = Task.detached(priority: .userInitiated) { [weak self, weak webView] in
                if let preparedHTML = PreparedChapterHTMLCache.preparedHTML(
                    chapterURL: chapterURL,
                    readAccessURL: readAccessURL,
                    colorScheme: colorScheme
                ) {
                    #if DEBUG
                    let prepareMilliseconds = max(
                        0,
                        Int((ProcessInfo.processInfo.systemUptime - beganAt) * 1_000)
                    )
                    print(
                        "permitext diagnostics: chapterReader prepared milliseconds=\(prepareMilliseconds) file=\(chapterURL.lastPathComponent)"
                    )
                    #endif
                    guard !Task.isCancelled else { return }
                    await MainActor.run { [weak self, weak webView] in
                        guard let self, let webView,
                              self.htmlLoadGeneration == loadGeneration,
                              !Task.isCancelled else { return }
                        webView.loadHTMLString(preparedHTML, baseURL: readAccessURL)
                    }
                } else {
                    guard !Task.isCancelled else { return }
                    await MainActor.run { [weak self, weak webView] in
                        guard let self, let webView,
                              self.htmlLoadGeneration == loadGeneration,
                              !Task.isCancelled else { return }
                        webView.loadFileURL(chapterURL, allowingReadAccessTo: readAccessURL)
                    }
                }
            }
        }

        func resetLoadRecovery() {
            recoveryTask?.cancel()
            recoveryTask = nil
            automaticRecoveryAttempt = 0
        }

        func reportLoadState(_ state: ChapterHTMLLoadState) {
            DispatchQueue.main.async { [weak self] in
                self?.parent?.onLoadStateChange?(state)
            }
        }

        private func recoverFromLoadFailure(
            in webView: WKWebView,
            error: Error?,
            message: String
        ) {
            guard recoveryTask == nil else { return }

            if let error,
               !ChapterHTMLLoadRecoveryPolicy.shouldRetry(
                   error: error,
                   attempt: automaticRecoveryAttempt
               ) {
                if (error as NSError).code == NSURLErrorCancelled { return }
                reportLoadState(.failed(message))
                return
            }

            guard automaticRecoveryAttempt < ChapterHTMLLoadRecoveryPolicy.maximumAutomaticAttempts,
                  let parent else {
                reportLoadState(.failed(message))
                return
            }

            automaticRecoveryAttempt += 1
            reportLoadState(.loading)
            let chapterURL = parent.chapterURL
            let readAccessURL = parent.readAccessURL
            let delayMilliseconds = 150 * automaticRecoveryAttempt

            recoveryTask = Task { @MainActor [weak self, weak webView] in
                try? await Task.sleep(for: .milliseconds(delayMilliseconds))
                guard !Task.isCancelled, let self, let webView else { return }
                self.recoveryTask = nil
                self.loadHTMLAsync(
                    chapterURL: chapterURL,
                    readAccessURL: readAccessURL,
                    into: webView
                )
            }
        }

        func teardown(webView: WKWebView) {
            htmlLoadTask?.cancel()
            htmlLoadTask = nil
            recoveryTask?.cancel()
            recoveryTask = nil
            htmlLoadGeneration &+= 1
            parent = nil
            loadedURL = nil
            pendingAnchorID = nil
            webView.stopLoading()
            webView.navigationDelegate = nil
            webView.scrollView.delegate = nil
            let contentController = webView.configuration.userContentController
            contentController.removeScriptMessageHandler(forName: Self.visibleAnchorMessageName)
            contentController.removeScriptMessageHandler(forName: Self.scrollProgressMessageName)
            contentController.removeScriptMessageHandler(forName: Self.openSectionMessageName)
            contentController.removeScriptMessageHandler(forName: Self.researchSelectionMessageName)
            contentController.removeAllUserScripts()
            self.webView = nil
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            if let externalURL = BundledWebViewNavigationPolicy.externalURLForUserActivatedNavigation(
                to: navigationAction.request.url,
                isUserActivated: navigationAction.navigationType == .linkActivated,
                isMainFrame: navigationAction.targetFrame?.isMainFrame
            ) {
                UIApplication.shared.open(externalURL)
                decisionHandler(.cancel)
                return
            }
            let allowed = BundledWebViewNavigationPolicy.allowsNavigation(
                to: navigationAction.request.url,
                under: parent?.readAccessURL,
                isMainFrame: navigationAction.targetFrame?.isMainFrame
            )
            decisionHandler(allowed ? .allow : .cancel)
        }

        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            ChapterHTMLWebProcessWarmup.releaseAfterReaderStarts()
            #if DEBUG
            guard let htmlLoadBeganAt else { return }
            let elapsedMilliseconds = max(
                0,
                Int((ProcessInfo.processInfo.systemUptime - htmlLoadBeganAt) * 1_000)
            )
            print("permitext diagnostics: chapterReader firstText milliseconds=\(elapsedMilliseconds)")
            #endif
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            #if DEBUG
            if let htmlLoadBeganAt {
                let elapsedMilliseconds = max(
                    0,
                    Int((ProcessInfo.processInfo.systemUptime - htmlLoadBeganAt) * 1_000)
                )
                print("permitext diagnostics: chapterReader finished milliseconds=\(elapsedMilliseconds)")
            }
            #endif
            resetLoadRecovery()
            reportLoadState(.loaded)
            applyReaderScripts(to: webView)
            applyBookmarkDecorations(to: webView)
            if let offset = parent?.restoreScrollOffset, offset > 0 {
                scroll(toOffset: CGFloat(offset), in: webView)
            } else {
                scroll(to: pendingAnchorID ?? parent?.targetAnchorID, matching: parent?.targetSearchText, in: webView)
            }
            pendingAnchorID = nil
            lastReportedScrollProgress = -1
            reportScrollProgress(from: webView.scrollView)
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            recoverFromLoadFailure(
                in: webView,
                error: error,
                message: "The chapter stopped loading. Try again."
            )
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            recoverFromLoadFailure(
                in: webView,
                error: error,
                message: "The chapter could not be opened. Try again."
            )
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            recoverFromLoadFailure(
                in: webView,
                error: nil,
                message: "The chapter reader restarted. Try loading the chapter again."
            )
        }

        func applyReaderScripts(to webView: WKWebView) {
            guard let parent else { return }
            appliedTheme = parent.readerTheme
            appliedAccentHex = parent.accentHex
            appliedColorScheme = parent.colorScheme

            let css = Self.readerCSS(
                theme: parent.readerTheme,
                colorScheme: parent.colorScheme,
                accentHex: parent.accentHex
            )
            let javascript = """
            (function() {
              document.querySelectorAll('link[rel="stylesheet"]').forEach(function(link) {
                var href = link.getAttribute('href') || '';
                var lowerHref = href.toLowerCase();
                var isRemote = lowerHref.indexOf('http://') === 0 ||
                  lowerHref.indexOf('https://') === 0 ||
                  href.indexOf('//') === 0;
                link.disabled = isRemote;
              });

              var viewport = document.querySelector('meta[name="viewport"]');
              if (!viewport) {
                viewport = document.createElement('meta');
                viewport.name = 'viewport';
                document.head.appendChild(viewport);
              }
              viewport.content = 'width=device-width, initial-scale=1.0';

              var existing = document.getElementById('nyccc-reader-style');
              if (!existing) {
                existing = document.createElement('style');
                existing.id = 'nyccc-reader-style';
                document.head.appendChild(existing);
              }
              existing.textContent = \(Self.javascriptString(css));

              document.querySelectorAll('h6').forEach(function(h) {
                h.childNodes.forEach(function(node) {
                  if (node.nodeType === Node.TEXT_NODE) {
                    node.nodeValue = node.nodeValue.replace(/^\\s*#-+\\s*/, '');
                  }
                });
              });

              document.querySelectorAll('link.Jump, Link.Jump').forEach(function(node) {
                var span = document.createElement('span');
                span.className = 'nyccc-link-text';
                span.innerHTML = node.innerHTML;
                node.replaceWith(span);
              });

              function headingOuterBlock(heading) {
                return heading.parentElement || heading;
              }

              function sectionCardForHeading(heading) {
                if (!heading || !heading.closest) { return null; }
                return heading.closest('.nyccc-section-card');
              }

              function childStartsBoundary(child, level) {
                if (!child || !child.querySelector) { return false; }
                if (child.querySelector('.Subarticle')) { return true; }
                if (child.querySelector('.Section')) { return true; }
                if (level === 'section' && child.querySelector('.Subsection')) { return false; }
                return level === 'subsection' && child.querySelector('.Subsection');
              }

              function controlledSiblings(heading) {
                var level = heading.classList.contains('Section') ? 'section' : 'subsection';
                var start = headingOuterBlock(heading);
                var root = start.parentElement;
                if (!root) { return []; }

                var nodes = [];
                if (level === 'section') {
                  var card = sectionCardForHeading(heading);
                  if (card) {
                    Array.prototype.slice.call(card.children).forEach(function(child) {
                      if (child !== start) {
                        nodes.push(child);
                      }
                    });
                    return nodes;
                  }
                }

                var child = start.nextElementSibling;
                while (child) {
                  if (childStartsBoundary(child, level)) { break; }
                  nodes.push(child);
                  child = child.nextElementSibling;
                }
                return nodes;
              }

              function buildSectionCards() {
                document.querySelectorAll('.Section').forEach(function(section) {
                  if (sectionCardForHeading(section)) { return; }

                  var sectionBlock = headingOuterBlock(section);
                  var parent = sectionBlock.parentNode;
                  if (!parent) { return; }

                  var card = document.createElement('div');
                  card.className = 'nyccc-section-card';
                  parent.insertBefore(card, sectionBlock);

                  var child = sectionBlock;
                  while (child) {
                    var next = child.nextElementSibling;
                    var startsNextSection = child !== sectionBlock && (
                      (child.classList && (child.classList.contains('Section') || child.classList.contains('Subarticle'))) ||
                      (child.querySelector && (child.querySelector('.Section') || child.querySelector('.Subarticle')))
                    );
                    if (startsNextSection) { break; }

                    card.appendChild(child);
                    child = next;
                  }
                });
              }

              function subsectionBodyNodes(heading) {
                if (!heading || !heading.classList.contains('Subsection')) { return []; }

                var nodes = [];
                var child = heading.nextElementSibling;
                while (child) {
                  if (child.classList && (child.classList.contains('Section') || child.classList.contains('Subsection'))) {
                    break;
                  }
                  if (child.querySelector && (child.querySelector('.Section') || child.querySelector('.Subsection'))) {
                    break;
                  }
                  if (!(child.classList && child.classList.contains('clearfix'))) {
                    nodes.push(child);
                  }
                  child = child.nextElementSibling;
                }
                return nodes;
              }

              function sectionNumberForHeading(heading) {
                if (!heading) { return null; }
                var text = (heading.textContent || '').replace(/^\\s*#-+\\s*/, '').trim();
                var match = text.match(/^([A-Z]?\\d+(?:\\.\\d+)*)\\b/i);
                return match ? match[1].toUpperCase() : null;
              }

              function researchTargetForNode(node) {
                var element = node && node.nodeType === Node.ELEMENT_NODE ? node : (node && node.parentElement);
                if (!element) { return null; }

                var taggedBlock = element.closest('[data-nyccc-heading-anchor], [data-nyccc-section-number]');
                if (taggedBlock) {
                  return {
                    anchorID: taggedBlock.dataset.nycccHeadingAnchor || '',
                    sectionNumber: taggedBlock.dataset.nycccSectionNumber || ''
                  };
                }

                var directHeading = element.closest('.Subsection, .Section');
                if (directHeading) {
                  return {
                    anchorID: directHeading.id || '',
                    sectionNumber: sectionNumberForHeading(directHeading) || ''
                  };
                }

                var headings = document.querySelectorAll('.Section, .Subsection');
                var precedingHeading = null;
                headings.forEach(function(heading) {
                  if (heading === node || (heading.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                    precedingHeading = heading;
                  }
                });
                if (!precedingHeading) { return null; }
                return {
                  anchorID: precedingHeading.id || '',
                  sectionNumber: sectionNumberForHeading(precedingHeading) || ''
                };
              }

              function updateResearchSelectionAction() {
                var selection = window.getSelection ? window.getSelection() : null;
                var text = selection ? String(selection).replace(/\\s+/g, ' ').trim() : '';
                if (!selection || selection.rangeCount === 0 || text.length < 2) {
                  window.__nycccResearchSelectionPayload = null;
                  return;
                }

                var range = selection.getRangeAt(0);
                var startTarget = researchTargetForNode(range.startContainer);
                var endTarget = researchTargetForNode(range.endContainer);
                if (!startTarget || !endTarget ||
                    (startTarget.anchorID || startTarget.sectionNumber) !== (endTarget.anchorID || endTarget.sectionNumber)) {
                  window.__nycccResearchSelectionPayload = null;
                  return;
                }

                var rect = range.getBoundingClientRect();
                if (!rect || (!rect.width && !rect.height)) {
                  window.__nycccResearchSelectionPayload = null;
                  return;
                }

                window.__nycccResearchSelectionPayload = {
                  anchorID: startTarget.anchorID || '',
                  sectionNumber: startTarget.sectionNumber || '',
                  selectedText: text.slice(0, 12000)
                };
              }

              function openSectionForHeading(heading) {
                if (!heading) { return; }
                var anchorID = heading.id || '';
                var sectionNumber = sectionNumberForHeading(heading);
                if (!anchorID && !sectionNumber) { return; }
                try {
                  window.webkit.messageHandlers.\(Coordinator.openSectionMessageName).postMessage({
                    anchorID: anchorID,
                    sectionNumber: sectionNumber
                  });
                } catch (error) {}
              }

              function openInlineReference(sectionNumber, codePrefix) {
                if (!sectionNumber) { return; }
                try {
                  window.webkit.messageHandlers.\(Coordinator.openSectionMessageName).postMessage({
                    action: 'openReference',
                    anchorID: '',
                    sectionNumber: String(sectionNumber).toUpperCase(),
                    codePrefix: codePrefix ? String(codePrefix).toUpperCase() : ''
                  });
                } catch (error) {}
              }

              function linkInlineSectionReferences() {
                var root = document.body;
                if (!root || root.dataset.nycccInlineReferencesReady === 'true') { return; }
                root.dataset.nycccInlineReferencesReady = 'true';
                var pattern = /\\b(?:(Sections?)\\s+|((?:BC|PC|MC|FGC|AC))\\s+)([0-9]{3}(?:\\.[0-9A-Za-z-]+)+)\\b/gi;
                var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
                var textNodes = [];
                var node;
                while ((node = walker.nextNode())) {
                  var parent = node.parentElement;
                  if (!parent || !node.nodeValue || !pattern.test(node.nodeValue)) {
                    pattern.lastIndex = 0;
                    continue;
                  }
                  pattern.lastIndex = 0;
                  if (parent.closest('a, button, script, style, textarea, select, .Section, .Subsection, .nyccc-block-actions')) {
                    continue;
                  }
                  textNodes.push(node);
                }

                textNodes.forEach(function(textNode) {
                  var text = textNode.nodeValue || '';
                  var fragment = document.createDocumentFragment();
                  var lastIndex = 0;
                  pattern.lastIndex = 0;
                  var match;
                  while ((match = pattern.exec(text))) {
                    if (match.index > lastIndex) {
                      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                    }
                    var link = document.createElement('button');
                    link.type = 'button';
                    link.className = 'nyccc-inline-reference';
                    link.textContent = match[0];
                    link.dataset.sectionNumber = match[3].toUpperCase();
                    link.dataset.codePrefix = (match[2] || '').toUpperCase();
                    link.setAttribute('aria-label', 'Open ' + match[0]);
                    link.addEventListener('click', function(event) {
                      event.preventDefault();
                      event.stopPropagation();
                      openInlineReference(link.dataset.sectionNumber, link.dataset.codePrefix);
                    });
                    fragment.appendChild(link);
                    lastIndex = pattern.lastIndex;
                  }
                  if (lastIndex < text.length) {
                    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
                  }
                  if (lastIndex > 0) {
                    textNode.parentNode.replaceChild(fragment, textNode);
                  }
                });
              }

              function collapseStorageKey(heading) {
                var id = heading.id || '';
                if (!id) {
                  var namedAnchor = heading.querySelector('a[name], a[id]');
                  id = (namedAnchor && (namedAnchor.getAttribute('name') || namedAnchor.id)) || '';
                }
                if (!id) {
                  id = (heading.textContent || '').trim().replace(/\\s+/g, ' ');
                }
                return 'nyccc-collapse:' + location.pathname + ':' + id;
              }

              function setCollapsed(heading, collapsed) {
                heading.dataset.nycccCollapsed = collapsed ? 'true' : 'false';
                heading.classList.toggle('nyccc-collapsed-heading', collapsed);
                var card = sectionCardForHeading(heading);
                if (card && heading.classList.contains('Section')) {
                  card.classList.toggle('nyccc-section-card-collapsed', collapsed);
                  card.classList.toggle('nyccc-section-card-expanded', !collapsed);
                }
                controlledSiblings(heading).forEach(function(node) {
                  node.hidden = collapsed;
                });
                return card;
              }

              window.__nycccSetAllSectionsCollapsed = function(collapsed) {
                document.querySelectorAll('.Section').forEach(function(heading) {
                  var storageKey = collapseStorageKey(heading);
                  setCollapsed(heading, collapsed);
                  try {
                    localStorage.setItem(storageKey, collapsed ? 'collapsed' : 'expanded');
                  } catch (error) {}
                });
                setTimeout(reportVisibleAnchor, 0);
              };

              window.__nycccRevealAnchor = function(anchorID) {
                buildSectionCards();
                var target = document.getElementById(anchorID);
                if (!target) { return null; }

                var card = sectionCardForHeading(target);
                if (card) {
                  var sectionHeading = null;
                  Array.prototype.slice.call(card.children).some(function(child) {
                    if (child.classList && child.classList.contains('Section')) {
                      sectionHeading = child;
                      return true;
                    }
                    if (child.querySelector) {
                      sectionHeading = child.querySelector('.Section');
                      return !!sectionHeading;
                    }
                    return false;
                  });
                  if (sectionHeading) {
                    setCollapsed(sectionHeading, false);
                  }
                }
                // Return the actual anchor target so scrollIntoView lands on
                // the specific subsection the user asked for. Returning the
                // card (which always begins at the parent .Section heading)
                // would scroll several subsections above the bookmark.
                // Only fall back to the card when the anchor IS the .Section
                // heading at the card root.
                if (target.classList && target.classList.contains('Section')) {
                  return card || target;
                }
                return target;
              };

              buildSectionCards();

              function setupImageErrorFallback() {
                document.querySelectorAll('img').forEach(function(img) {
                  if (img.dataset.nycccImgReady === 'true') { return; }
                  img.dataset.nycccImgReady = 'true';
                  img.loading = 'lazy';
                  img.decoding = 'async';
                  var triedExtensions = { '': true };
                  function tryAlternateExtension() {
                    var src = img.getAttribute('src') || '';
                    var lastDot = src.lastIndexOf('.');
                    var lastSlash = Math.max(src.lastIndexOf('/'), src.lastIndexOf('\\\\'));
                    if (lastDot < 0 || lastDot < lastSlash) { return; }
                    var base = src.substring(0, lastDot);
                    var current = src.substring(lastDot + 1).toLowerCase();
                    triedExtensions[current] = true;
                    var candidates = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
                    for (var i = 0; i < candidates.length; i++) {
                      if (!triedExtensions[candidates[i]]) {
                        triedExtensions[candidates[i]] = true;
                        img.src = base + '.' + candidates[i];
                        return;
                      }
                    }
                  }
                  img.addEventListener('error', tryAlternateExtension);
                });
              }
              setupImageErrorFallback();
              linkInlineSectionReferences();

              function depthFromHeading(heading) {
                if (!heading || !heading.classList) { return 1; }
                if (heading.classList.contains('Section')) { return 1; }
                if (!heading.classList.contains('Subsection')) { return 1; }
                var h6 = heading.querySelector('h6');
                if (!h6) { return 2; }
                var text = (h6.textContent || '').replace(/^\\s*#-+\\s*/, '').trim();
                var match = text.match(/^([A-Z]?\\d+(?:\\.\\d+)*)/);
                if (!match) { return 2; }
                return Math.min(match[1].split('.').length, 6);
              }

              function applyDepthClasses() {
                document.querySelectorAll('.Section, .Subsection').forEach(function(heading) {
                  if (heading.dataset.nycccDepthReady === 'true') { return; }
                  heading.dataset.nycccDepthReady = 'true';
                  for (var d = 1; d <= 6; d++) {
                    heading.classList.remove('nyccc-depth-' + d);
                  }
                  heading.classList.add('nyccc-depth-' + depthFromHeading(heading));
                });
              }
              applyDepthClasses();

              function anchorIDForHeading(heading) {
                if (!heading) { return null; }
                if (heading.id) { return heading.id; }
                var namedAnchor = heading.querySelector('a[name], a[id]');
                if (!namedAnchor) { return null; }
                return namedAnchor.getAttribute('name') || namedAnchor.id || null;
              }

              function visibleAnchorID() {
                var headings = Array.prototype.slice.call(document.querySelectorAll('.Section, .Subsection'));
                if (!headings.length) { return null; }

                var baseline = Math.min(window.innerHeight * 0.32, 260);
                var viewportTop = window.scrollY + baseline;
                var candidate = headings[0];
                var nextHeading = null;

                for (var i = 0; i < headings.length; i++) {
                  var heading = headings[i];
                  var top = heading.getBoundingClientRect().top + window.scrollY;
                  if (top <= viewportTop) {
                    candidate = heading;
                  } else {
                    nextHeading = heading;
                    break;
                  }
                }

                if (nextHeading) {
                  var nextTop = nextHeading.getBoundingClientRect().top + window.scrollY;
                  if (nextTop - viewportTop < 18) {
                    candidate = nextHeading;
                  }
                }

                return anchorIDForHeading(candidate);
              }

              function reportVisibleAnchor() {
                var anchorID = visibleAnchorID();
                if (!anchorID) { return; }
                if (window.__nycccLastVisibleAnchorID === anchorID) { return; }
                window.__nycccLastVisibleAnchorID = anchorID;
                try {
                  window.webkit.messageHandlers.\(Coordinator.visibleAnchorMessageName).postMessage(anchorID);
                } catch (error) {}
              }

              function reportScrollProgress() {
                var scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
                var scrollHeight = Math.max(
                  document.documentElement.scrollHeight || 0,
                  document.body ? document.body.scrollHeight : 0
                );
                var clientHeight = window.innerHeight || document.documentElement.clientHeight || 0;
                var maxScroll = Math.max(scrollHeight - clientHeight, 1);
                var progress = Math.min(Math.max(scrollTop / maxScroll, 0), 1);
                if (window.__nycccLastScrollProgress === progress) { return; }
                window.__nycccLastScrollProgress = progress;
                try {
                  window.webkit.messageHandlers.\(Coordinator.scrollProgressMessageName).postMessage(progress);
                } catch (error) {}
              }

              document.querySelectorAll('.Section, .Subsection').forEach(function(heading) {
                if (heading.dataset.nycccCollapseReady === 'true') { return; }
                heading.dataset.nycccCollapseReady = 'true';
                heading.classList.add('nyccc-collapsible-heading');
                setCollapsed(heading, false);
                heading.addEventListener('click', function(event) {
                  if (event.target.closest('a, button')) { return; }
                  if (heading.classList.contains('Subsection')) {
                    event.preventDefault();
                    event.stopPropagation();
                    openSectionForHeading(heading);
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  var card = sectionCardForHeading(heading);
                  if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
                  }
                  setTimeout(reportVisibleAnchor, 0);
                });

                if (heading.classList.contains('Subsection')) {
                  subsectionBodyNodes(heading).forEach(function(node) {
                    if (node.dataset.nycccSectionTapReady === 'true') { return; }
                    node.dataset.nycccSectionTapReady = 'true';
                    node.classList.add('nyccc-section-open-target');
                    node.addEventListener('click', function(event) {
                      if (event.target.closest('a, button')) { return; }
                      if (window.getSelection && String(window.getSelection()).trim().length > 0) { return; }
                      // Plain paragraph taps remain reading interactions. Notes
                      // and bookmarks use the explicit heading actions above,
                      // so an incidental tap no longer opens a modal sheet.
                    });
                  });
                }
              });

              window.__nycccReportVisibleAnchor = reportVisibleAnchor;
              window.removeEventListener('scroll', window.__nycccVisibleAnchorListener);
              window.__nycccVisibleAnchorListener = function() {
                if (window.__nycccVisibleAnchorFramePending === true) { return; }
                window.__nycccVisibleAnchorFramePending = true;
                window.requestAnimationFrame(function() {
                  window.__nycccVisibleAnchorFramePending = false;
                  reportVisibleAnchor();
                  reportScrollProgress();
                });
              };
              window.addEventListener('scroll', window.__nycccVisibleAnchorListener, { passive: true });
              document.removeEventListener('selectionchange', window.__nycccResearchSelectionListener);
              window.__nycccResearchSelectionListener = function() {
                window.requestAnimationFrame(updateResearchSelectionAction);
              };
              document.addEventListener('selectionchange', window.__nycccResearchSelectionListener);
              setTimeout(function() {
                reportVisibleAnchor();
                reportScrollProgress();
              }, 0);
            })();
            """
            webView.evaluateJavaScript(javascript)
        }

        func setAllSectionCollapsed(to collapsed: Bool, in webView: WKWebView) {
            let flag = collapsed ? "true" : "false"
            let javascript = "window.__nycccSetAllSectionsCollapsed && window.__nycccSetAllSectionsCollapsed(\(flag));"
            webView.evaluateJavaScript(javascript)
        }

        func applyBookmarkDecorations(to webView: WKWebView) {
            guard let parent else { return }
            appliedBookmarkedAnchorIDs = parent.bookmarkedAnchorIDs
            appliedBookmarkedSectionNumbers = parent.bookmarkedSectionNumbers
            let anchorIDs = Array(parent.bookmarkedAnchorIDs).sorted()
            let sectionNumbers = Array(parent.bookmarkedSectionNumbers).sorted()
            let javascript = """
            (function() {
              var bookmarkedAnchors = new Set(\(Self.javascriptStringArray(anchorIDs)));
              var bookmarkedSections = new Set(\(Self.javascriptStringArray(sectionNumbers)));

              function normalizeSectionNumber(value) {
                return String(value || '')
                  .trim()
                  .replace(/[\\.:;]+$/g, '')
                  .toUpperCase();
              }

              function sectionNumberForBookmarkHeading(heading) {
                if (!heading) { return null; }
                var text = (heading.textContent || '').replace(/^\\s*#-+\\s*/, '').trim();
                var match = text.match(/^([A-Z]?\\d+(?:\\.\\d+)*)\\b/i);
                return match ? normalizeSectionNumber(match[1]) : null;
              }

              document.querySelectorAll('.Section, .Subsection').forEach(function(heading) {
                var namedAnchor = heading.querySelector('a[name], a[id]');
                var anchorID = heading.id || (namedAnchor && (namedAnchor.getAttribute('name') || namedAnchor.id)) || '';
                var sectionNumber = sectionNumberForBookmarkHeading(heading);
                var isBookmarked = heading.classList.contains('Subsection') &&
                  (bookmarkedAnchors.has(anchorID) || bookmarkedSections.has(sectionNumber));
                heading.querySelectorAll('.nyccc-bookmark-marker, .nyccc-status-badges').forEach(function(marker) {
                  marker.remove();
                });
                heading.classList.toggle('nyccc-bookmarked-heading', isBookmarked);
                heading.setAttribute('data-nyccc-section-number', sectionNumber || '');
              });
            })();
            """
            webView.evaluateJavaScript(javascript)
        }

        struct SearchScrollTarget: Equatable {
            let anchorID: String?
            let query: String?
            let requestID: Int
        }

        func scroll(to anchorID: String?, matching query: String? = nil, in webView: WKWebView) {
            guard let anchorID, !anchorID.isEmpty else { return }
            lastScrolledAnchorID = anchorID
            lastSearchScrollTarget = SearchScrollTarget(anchorID: anchorID, query: query, requestID: parent?.targetSearchRequestID ?? 0)
            suppressVisibleAnchorReportsUntil = Date().addingTimeInterval(0.65)
            suppressScrollOffsetReportsUntil = Date().addingTimeInterval(0.65)
            let javascript = """
            (function() {
              var query = String(\(Self.javascriptString(query ?? ""))).trim();
              var target = document.getElementById(\(Self.javascriptString(anchorID)));
              if (!target) {
                var requested = String(\(Self.javascriptString(anchorID))).trim().toUpperCase();
                var headings = Array.prototype.slice.call(document.querySelectorAll('.Section, .Subsection'));
                target = headings.find(function(heading) {
                  var text = (heading.textContent || '').replace(/^\\s*#-+\\s*/, '').trim().toUpperCase();
                  return text.indexOf('SECTION BC ' + requested + ':') === 0 ||
                    text.indexOf(requested + ' ') === 0 ||
                    text === requested;
                }) || null;
              }
              if (!target) { return false; }
              if (window.__nycccRevealAnchor) {
                target = window.__nycccRevealAnchor(\(Self.javascriptString(anchorID))) || target;
              }

              function normalized(value) {
                return String(value || '').toLowerCase().replace(/\\s+/g, ' ').trim();
              }

              function strippedToken(value) {
                return String(value || '').replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');
              }

              function queryParts(value) {
                var exact = normalized(value);
                var tokens = exact.split(/\\s+/)
                  .map(strippedToken)
                  .filter(function(token) { return token.length > 0; });
                return { exact: exact, tokens: tokens };
              }

              function searchRootForTarget(value) {
                if (!value || !value.closest) { return document.body || document.documentElement; }
                if (!value.classList || (!value.classList.contains('Section') && !value.classList.contains('Subsection'))) {
                  return value;
                }
                return value.closest('.nyccc-section-card') || value.parentElement || document.body || document.documentElement;
              }

              function textMatchNode(root, parts, mode) {
                if (!root || !parts || (!parts.exact && parts.tokens.length === 0)) { return null; }
                var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
                  acceptNode: function(node) {
                    var text = normalized(node.nodeValue);
                    if (!text) { return NodeFilter.FILTER_REJECT; }
                    if (mode === 'exact' && parts.exact && text.indexOf(parts.exact) !== -1) {
                      return NodeFilter.FILTER_ACCEPT;
                    }
                    if (mode === 'allTokens' && parts.tokens.length > 0 && parts.tokens.every(function(token) { return text.indexOf(token) !== -1; })) {
                      return NodeFilter.FILTER_ACCEPT;
                    }
                    if (mode === 'anyToken' && parts.tokens.some(function(token) { return text.indexOf(token) !== -1; })) {
                      return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_REJECT;
                  }
                });
                return walker.nextNode();
              }

              function scrollTextNode(node) {
                if (!node) { return false; }
                var range = document.createRange();
                range.selectNodeContents(node);
                var rect = range.getBoundingClientRect();
                if (!rect || rect.height === 0) { return false; }
                var y = rect.top + window.scrollY - Math.max(80, window.innerHeight * 0.22);
                window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
                return true;
              }

              var parts = queryParts(query);
              var root = searchRootForTarget(target);
              var matched = scrollTextNode(textMatchNode(root, parts, 'exact')) ||
                scrollTextNode(textMatchNode(root, parts, 'allTokens')) ||
                scrollTextNode(textMatchNode(document.body || document.documentElement, parts, 'exact')) ||
                scrollTextNode(textMatchNode(document.body || document.documentElement, parts, 'allTokens'));
              if (!matched && root !== target) {
                matched = scrollTextNode(textMatchNode(target, parts, 'exact')) ||
                  scrollTextNode(textMatchNode(target, parts, 'allTokens'));
              }
              if (!matched && parts.tokens.length === 1) {
                matched = scrollTextNode(textMatchNode(root, parts, 'anyToken')) ||
                  scrollTextNode(textMatchNode(document.body || document.documentElement, parts, 'anyToken'));
              }
              if (!matched) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
              return true;
            })();
            """
            webView.evaluateJavaScript(javascript)
        }

        func scrollToTop(in webView: WKWebView) {
            lastScrolledAnchorID = nil
            let javascript = """
            (function() {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              return true;
            })();
            """
            webView.evaluateJavaScript(javascript)
        }

        func scroll(toOffset offset: CGFloat, in webView: WKWebView) {
            suppressVisibleAnchorReportsUntil = Date().addingTimeInterval(0.65)
            suppressScrollOffsetReportsUntil = Date().addingTimeInterval(0.65)
            let y = max(offset, 0)
            let javascript = """
            (function() {
              window.scrollTo({ top: \(Double(y)), behavior: 'auto' });
              return true;
            })();
            """
            webView.evaluateJavaScript(javascript)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { [weak self, weak webView] in
                guard let self, let webView else { return }
                self.suppressScrollOffsetReportsUntil = nil
                self.reportScrollProgress(from: webView.scrollView)
                self.reportVisibleAnchor(in: webView)
            }
        }

        func scrollViewDidScroll(_ scrollView: UIScrollView) {
            if scrollView.zoomScale <= scrollView.minimumZoomScale + 0.01,
               abs(scrollView.contentOffset.x) > 0.5 {
                scrollView.contentOffset.x = 0
            }
            reportScrollProgress(from: scrollView)
            scheduleVisibleAnchorReport()
        }

        private func reportScrollProgress(from scrollView: UIScrollView) {
            let contentHeight = scrollView.contentSize.height
            let viewportHeight = scrollView.bounds.height
            guard contentHeight > 0, viewportHeight > 0 else { return }

            let maxOffset = max(
                contentHeight - viewportHeight + scrollView.adjustedContentInset.top + scrollView.adjustedContentInset.bottom,
                1
            )
            let offset = scrollView.contentOffset.y + scrollView.adjustedContentInset.top
            deliverScrollProgress(min(max(offset / maxOffset, 0), 1))
            if let suppressScrollOffsetReportsUntil,
               Date() < suppressScrollOffsetReportsUntil {
                return
            }
            suppressScrollOffsetReportsUntil = nil
            let rawOffset = max(scrollView.contentOffset.y, 0)
            DispatchQueue.main.async { [weak self] in
                self?.parent?.onScrollOffsetChange?(rawOffset)
            }
        }

        func resetScrollProgressReporting() {
            lastReportedScrollProgress = -1
        }

        func syncScrollProgress(in webView: WKWebView) {
            resetScrollProgressReporting()
            reportScrollProgress(from: webView.scrollView)
            reportVisibleAnchor(in: webView)
        }

        private func scheduleVisibleAnchorReport() {
            guard let webView, !visibleAnchorReportPending else { return }
            visibleAnchorReportPending = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self, weak webView] in
                guard let self, let webView else { return }
                self.visibleAnchorReportPending = false
                self.reportVisibleAnchor(in: webView)
            }
        }

        private func reportVisibleAnchor(in webView: WKWebView) {
            webView.evaluateJavaScript("window.__nycccReportVisibleAnchor && window.__nycccReportVisibleAnchor();")
        }

        private func deliverScrollProgress(_ progress: CGFloat) {
            let clamped = min(max(progress, 0), 1)
            guard abs(clamped - lastReportedScrollProgress) > 0.002 else { return }
            lastReportedScrollProgress = clamped
            DispatchQueue.main.async { [weak self] in
                self?.parent?.onScrollProgressChange?(clamped)
            }
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == Self.scrollProgressMessageName {
                let progress: CGFloat
                if let value = message.body as? Double {
                    progress = CGFloat(value)
                } else if let value = message.body as? NSNumber {
                    progress = CGFloat(truncating: value)
                } else {
                    return
                }
                deliverScrollProgress(progress)
                return
            }

            if message.name == Self.openSectionMessageName {
                guard let target = sectionTarget(from: message.body) else { return }
                DispatchQueue.main.async { [weak self] in
                    self?.parent?.onOpenSectionForAnchor?(target)
                }
                return
            }

            if message.name == Self.researchSelectionMessageName {
                guard let target = researchTarget(from: message.body) else { return }
                DispatchQueue.main.async { [weak self] in
                    self?.parent?.onResearchSelection?(target)
                }
                return
            }

            guard message.name == Self.visibleAnchorMessageName,
                  let anchorID = message.body as? String,
                  !anchorID.isEmpty
            else { return }

            if let suppressVisibleAnchorReportsUntil,
               Date() < suppressVisibleAnchorReportsUntil,
               anchorID != lastScrolledAnchorID {
                return
            }
            suppressVisibleAnchorReportsUntil = nil

            DispatchQueue.main.async { [weak self] in
                self?.parent?.onVisibleAnchorChange?(anchorID)
            }
        }

        private func sectionTarget(from body: Any) -> ChapterHTMLSectionTarget? {
            if let anchorID = body as? String,
               !anchorID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return ChapterHTMLSectionTarget(anchorID: anchorID, sectionNumber: nil)
            }

            guard let payload = body as? [String: Any] else { return nil }
            let anchorID = (payload["anchorID"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let sectionNumber = (payload["sectionNumber"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let codePrefix = (payload["codePrefix"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let blockID = (payload["blockID"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let blockLabel = (payload["blockLabel"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let action = (payload["action"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard !anchorID.isEmpty || !(sectionNumber?.isEmpty ?? true) else { return nil }
            return ChapterHTMLSectionTarget(
                anchorID: anchorID,
                sectionNumber: sectionNumber?.isEmpty == false ? sectionNumber : nil,
                codePrefix: codePrefix?.isEmpty == false ? codePrefix : nil,
                blockID: blockID?.isEmpty == false ? blockID : nil,
                blockLabel: blockLabel?.isEmpty == false ? blockLabel : nil,
                action: action?.isEmpty == false ? action : nil
            )
        }

        private func researchTarget(from body: Any) -> ChapterHTMLResearchTarget? {
            guard let payload = body as? [String: Any] else { return nil }
            let anchorID = (payload["anchorID"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let sectionNumber = (payload["sectionNumber"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let selectedText = (payload["selectedText"] as? String)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !selectedText.isEmpty,
                  !anchorID.isEmpty || !(sectionNumber?.isEmpty ?? true) else { return nil }
            return ChapterHTMLResearchTarget(
                anchorID: anchorID,
                sectionNumber: sectionNumber?.isEmpty == false ? sectionNumber : nil,
                selectedText: selectedText
            )
        }

        func performResearchSelectionFromMenu(in webView: WKWebView) {
            webView.evaluateJavaScript("window.__nycccResearchSelectionPayload") { [weak self] body, _ in
                guard let self, let target = self.researchTarget(from: body as Any) else { return }
                DispatchQueue.main.async { [weak self] in
                    self?.parent?.onResearchSelection?(target)
                }
            }
        }

        private static func readerCSS(theme: ReaderTheme, colorScheme: ColorScheme, accentHex: String) -> String {
            let isDark = colorScheme == .dark
            let textColor = isDark ? "#f5f5f7" : "#111111"
            let backgroundColor = isDark ? "#000000" : "#f2f2f7"
            let secondaryColor = isDark ? "#b5b5bc" : "#5d6168"
            let borderColor = isDark ? "#6f6f76" : "#c6c6cc"
            let softBorderColor = isDark ? "#4b4b50" : "#d8d8de"
            let guideLineColor = isDark ? "rgba(255,255,255,0.18)" : "rgba(60,60,67,0.18)"
            let bodyFontSize = max(theme.fontSize, ReaderTheme.minimumFontSize)
            let sectionHeadingSize = max(bodyFontSize * 1.18, bodyFontSize + 2)
            let subsectionHeadingSize = max(bodyFontSize * 1.08, bodyFontSize + 1)
            let tableFontSize = max(bodyFontSize * 0.82, 14)
            let lineHeight = max(1.35, min(1.64, 1.28 + theme.lineSpacing / 28))
            let paragraphSpacing = max(theme.paragraphSpacing / 20, 0.42)
            let fontFamily = #""Source Serif 4 Variable", "Source Serif 4", ui-serif, Georgia, "Times New Roman", serif"#

            return """
            html {
              -webkit-text-size-adjust: 100%;
              background: \(backgroundColor);
              color-scheme: \(isDark ? "dark" : "light");
            }
            html,
            body {
              width: 100% !important;
              max-width: 100% !important;
              overflow-x: hidden !important;
              overscroll-behavior-x: none;
            }
            * {
              box-sizing: border-box;
              max-width: 100%;
            }
            body {
              margin: 0;
              padding: 0 16px 96px;
              background: \(backgroundColor) !important;
              color: \(textColor) !important;
              font-family: \(fontFamily) !important;
              font-optical-sizing: auto;
              font-size: \(bodyFontSize)px !important;
              line-height: \(lineHeight) !important;
              overflow-wrap: break-word;
            }
            html {
              scroll-behavior: smooth;
            }
            body, div, p, li, span {
              font-family: \(fontFamily) !important;
            }
            body > div,
            .rbox,
            .Normal-Level,
            .Normal-Level > div,
            .Subarticle,
            .Section,
            .Subsection {
              width: auto !important;
              max-width: 100% !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
            }
            .Section,
            .Subsection {
              border-top: 0 !important;
              padding-top: 0.8rem;
              margin-top: 0.8rem !important;
              scroll-margin-top: 96px;
            }
            .nyccc-section-card {
              scroll-margin-top: 96px;
            }
            .nyccc-section-card {
              box-sizing: border-box !important;
              width: auto !important;
              max-width: 100% !important;
              margin: 0 !important;
              border-radius: 0;
              background: transparent !important;
              border: 0;
              box-shadow: none;
              overflow: visible;
              transform: none;
              transition: none;
            }
            .zr-section {
              border-radius: 0 !important;
              padding: 0 !important;
              background: transparent !important;
              box-shadow: none !important;
            }
            .nyccc-section-card > div {
              width: auto !important;
              max-width: 100% !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
            }
            .nyccc-section-card-expanded > div:not(:first-child) {
              padding-left: 0.95rem !important;
              padding-right: 0.95rem !important;
            }
            .nyccc-section-card .Section {
              border-top: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .nyccc-section-card .Section h6 {
              margin: 0 !important;
              padding-right: 2.25rem !important;
            }
            .nyccc-section-card-collapsed {
              border-radius: 0;
              overflow: visible;
            }
            .nyccc-section-card-collapsed .Section h6 {
              padding: 0.74rem 2.35rem 0.74rem 0 !important;
            }
            .nyccc-section-card-expanded {
              padding: 0 0 1.05rem;
            }
            .nyccc-section-card-expanded .Section h6 {
              padding: 0.74rem 2.35rem 0.74rem 0 !important;
              border-bottom: 0 !important;
            }
            .nyccc-section-card-expanded .Subsection {
              margin-top: 0.72rem !important;
              padding-top: 0.72rem !important;
              padding-right: 0 !important;
              border-top: 0 !important;
            }
            .nyccc-section-card-expanded .Subsection h6 {
              padding-left: 0 !important;
              padding-right: 0 !important;
            }
            .nyccc-section-card-expanded .Normal-Level,
            .nyccc-section-card-expanded .Normal-Level > div {
              padding-left: 0 !important;
              padding-right: 0 !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
            }
            .Subarticle + .clearfix + .Section,
            .Subarticle + .Section,
            body > .Section:first-of-type,
            body > div:first-of-type .Section:first-of-type {
              margin-top: 0.2rem !important;
            }
            img,
            .img img,
            span.img img {
              display: block !important;
              max-width: 100% !important;
              width: auto !important;
              height: auto !important;
              max-height: none !important;
              object-fit: contain !important;
              margin: 0.75rem auto !important;
            }
            img[width], img[height] {
              width: auto !important;
              height: auto !important;
            }
            .Normal-Level,
            .Normal-Level > div,
            .Subsection + .Normal-Level,
            .Section + .Normal-Level {
              font-size: \(bodyFontSize)px !important;
              line-height: \(lineHeight) !important;
            }
            h1, h2, h3, h4, h5, h6 {
              color: \(textColor) !important;
              font-weight: 700;
              line-height: 1.18;
              margin: 1.15rem 0 0.55rem !important;
            }
            h6 { font-size: \(subsectionHeadingSize)px !important; }
            .Subarticle h6 {
              display: none !important;
            }
            .Subarticle {
              display: none !important;
            }
            .Section h6 {
              color: \(accentHex) !important;
              font-size: \(sectionHeadingSize)px !important;
              text-transform: uppercase;
              margin-top: 0 !important;
            }
            .Subsection h6 {
              font-size: \(subsectionHeadingSize)px !important;
              margin-top: 0 !important;
            }
            .Section h6,
            .Subsection h6 {
              display: block !important;
              position: relative;
              padding-left: 0 !important;
              text-align: left !important;
            }
            .Subsection h6 {
              padding-right: 2.35rem;
            }
            .Subsection {
              position: relative !important;
              padding-right: 2.25rem !important;
              padding-left: 1.45rem !important;
              border-left: 0 !important;
              background-repeat: no-repeat !important;
              background-size: 3px 100% !important;
              background-position: 0.12rem 0 !important;
              background-image: linear-gradient(\(accentHex), \(accentHex)) !important;
              margin-left: 0 !important;
            }
            .Subsection .Normal-Level,
            .Subsection .Normal-Level > div,
            .Subsection > div:not(h6) {
              text-align: left !important;
              padding-left: 0 !important;
              margin-left: 0 !important;
            }
            .Subsection h6::before {
              content: "" !important;
              display: none !important;
            }
            .Subsection.nyccc-depth-2 {
              padding-left: 1.45rem !important;
              background-size: 3px 100% !important;
              background-position: 0.12rem 0 !important;
              background-image: linear-gradient(\(accentHex), \(accentHex)) !important;
            }
            .Subsection.nyccc-depth-3 {
              padding-left: 2.1rem !important;
              background-size: 1px 100%, 3px 100% !important;
              background-position: 0.12rem 0, 0.78rem 0 !important;
              background-image: linear-gradient(\(guideLineColor), \(guideLineColor)), linear-gradient(\(accentHex), \(accentHex)) !important;
            }
            .Subsection.nyccc-depth-3 h6 { font-size: calc(\(subsectionHeadingSize)px * 0.97) !important; }
            .Subsection.nyccc-depth-4 {
              padding-left: 2.75rem !important;
              background-size: 1px 100%, 1px 100%, 3px 100% !important;
              background-position: 0.12rem 0, 0.78rem 0, 1.44rem 0 !important;
              background-image: linear-gradient(\(guideLineColor), \(guideLineColor)), linear-gradient(\(guideLineColor), \(guideLineColor)), linear-gradient(\(accentHex), \(accentHex)) !important;
            }
            .Subsection.nyccc-depth-4 h6 { font-size: calc(\(subsectionHeadingSize)px * 0.94) !important; font-weight: 650 !important; }
            .Subsection.nyccc-depth-5 {
              padding-left: 3.4rem !important;
              background-size: 1px 100%, 1px 100%, 1px 100%, 3px 100% !important;
              background-position: 0.12rem 0, 0.78rem 0, 1.44rem 0, 2.1rem 0 !important;
              background-image: linear-gradient(\(guideLineColor), \(guideLineColor)), linear-gradient(\(guideLineColor), \(guideLineColor)), linear-gradient(\(guideLineColor), \(guideLineColor)), linear-gradient(\(accentHex), \(accentHex)) !important;
            }
            .Subsection.nyccc-depth-5 h6 { font-size: calc(\(subsectionHeadingSize)px * 0.9) !important; font-weight: 600 !important; }
            .Subsection.nyccc-depth-6 {
              padding-left: 4.05rem !important;
              background-size: 1px 100%, 1px 100%, 1px 100%, 1px 100%, 3px 100% !important;
              background-position: 0.12rem 0, 0.78rem 0, 1.44rem 0, 2.1rem 0, 2.76rem 0 !important;
              background-image: linear-gradient(\(guideLineColor), \(guideLineColor)), linear-gradient(\(guideLineColor), \(guideLineColor)), linear-gradient(\(guideLineColor), \(guideLineColor)), linear-gradient(\(guideLineColor), \(guideLineColor)), linear-gradient(\(accentHex), \(accentHex)) !important;
            }
            .Subsection.nyccc-depth-6 h6 { font-size: calc(\(subsectionHeadingSize)px * 0.88) !important; font-weight: 550 !important; }
            .nyccc-collapsible-heading h6 {
              cursor: pointer;
              -webkit-user-select: none;
              user-select: none;
            }
            .nyccc-section-open-target {
              cursor: text;
            }
            .nyccc-inline-reference {
              display: inline !important;
              margin: 0 !important;
              padding: 0 !important;
              border: 0 !important;
              border-bottom: 1px solid currentColor !important;
              border-radius: 0 !important;
              background: transparent !important;
              color: \(accentHex) !important;
              font: inherit !important;
              line-height: inherit !important;
              text-align: inherit !important;
              text-decoration: none !important;
              -webkit-appearance: none !important;
              appearance: none !important;
            }
            .nyccc-inline-reference:focus-visible {
              outline: 2px solid \(accentHex) !important;
              outline-offset: 2px !important;
            }
            .Section.nyccc-collapsible-heading h6::before {
              content: "" !important;
              display: none !important;
            }
            .Section.nyccc-collapsible-heading h6::after {
              content: "" !important;
              display: none !important;
            }
            .Subsection.nyccc-bookmarked-heading h6::after {
              content: "" !important;
              display: none !important;
              position: absolute !important;
              right: 0.1rem !important;
              top: 0 !important;
              width: 0.52rem !important;
              height: 0.72rem !important;
              background: \(accentHex) !important;
              clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%) !important;
              pointer-events: none !important;
            }
            .nyccc-bookmark-marker {
              display: none !important;
            }
            .nyccc-status-badges {
              display: inline-flex !important;
              align-items: center !important;
              gap: 0.28rem !important;
              margin-left: 0.45rem !important;
              vertical-align: 0.08rem !important;
            }
            .nyccc-status-badge {
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              flex-shrink: 0 !important;
            }
            .nyccc-bookmark-badge {
              width: 0.56rem !important;
              height: 0.78rem !important;
              border-radius: 0.08rem 0.08rem 0.03rem 0.03rem !important;
              background: \(accentHex) !important;
              clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%) !important;
            }
            .nyccc-note-badge {
              background: transparent !important;
              border-radius: 0 !important;
              color: \(secondaryColor) !important;
            }
            .nyccc-note-badge svg {
              width: 0.62rem !important;
              height: 0.62rem !important;
              display: block !important;
              fill: none !important;
              stroke: currentColor !important;
              stroke-width: 2.3 !important;
              stroke-linecap: round !important;
              stroke-linejoin: round !important;
            }
            .Normal-Level > div { margin: \(paragraphSpacing)rem 0 !important; }
            p, li { margin: 0.35rem 0 !important; }
            ol, ul { padding-left: 1.35rem !important; margin: 0.45rem 0 0.75rem !important; }
            .Subsection + .Normal-Level,
            .Section + .Normal-Level {
              margin-top: 0.2rem !important;
            }
            span[style*="font-weight: bold"] { font-weight: 700 !important; }
            span[style*="font-style: italic"] { font-style: italic !important; }
            a, .nyccc-link-text { color: \(accentHex) !important; text-decoration: none; }
            annotationdrawer, AnnotationDrawer, codeoptions, CodeOptions, .clearfix { display: none !important; }
            scrolltable, .xsl-table, .xsl-table--body {
              display: block;
              max-width: 100%;
              overflow-x: auto;
              -webkit-overflow-scrolling: touch;
            }
            scrolltable > .xsl-table--header {
              display: none !important;
            }
            table {
              border-collapse: collapse;
              color: \(textColor) !important;
              font-size: \(tableFontSize)px !important;
              line-height: 1.24 !important;
              min-width: max-content;
              background: \(backgroundColor) !important;
            }
            td, th {
              border: 1px solid \(borderColor) !important;
              padding: 0.28rem 0.38rem;
              vertical-align: top;
              color: \(textColor) !important;
              background: \(backgroundColor) !important;
            }
            figure[data-table-ref]:empty { display: none; }
            figure[data-table-ref].nyccc-missing-table,
            figure[data-table-ref]:empty {
              display: block;
              min-height: 2.75rem;
              margin: 0.85rem 0;
              padding: 0.7rem 0.85rem;
              border: 1px dashed \(softBorderColor);
              color: \(secondaryColor);
              font-size: \(tableFontSize)px;
            }
            figure[data-table-ref]:empty::before {
              content: "Table " attr(data-table-ref);
            }
            [style*="color: #000000"], [style*="color:#000000"] { color: \(textColor) !important; }
            .Normal-Level { color: \(textColor) !important; }
            .Normal-Level + .clearfix { margin: 0; }
            small, sup, sub { color: \(secondaryColor) !important; }
            """
        }

        private static func javascriptString(_ value: String) -> String {
            guard let data = try? JSONEncoder().encode(value),
                  let encoded = String(data: data, encoding: .utf8)
            else {
                return "\"\""
            }
            return encoded
        }

        private static func javascriptStringArray(_ values: [String]) -> String {
            guard let data = try? JSONEncoder().encode(values),
                  let encoded = String(data: data, encoding: .utf8)
            else {
                return "[]"
            }
            return encoded
        }

        static func pageBackgroundUIColor(for colorScheme: ColorScheme) -> UIColor {
            colorScheme == .dark ? .black : .systemGroupedBackground
        }

        static func initialReaderBootstrapScript(for colorScheme: ColorScheme) -> String {
            let isDark = colorScheme == .dark
            let backgroundColor = isDark ? "#000000" : "#f2f2f7"
            let textColor = isDark ? "#f5f5f7" : "#111111"

            return """
            (function() {
              var root = document.documentElement;
              if (root) {
                root.style.background = '\(backgroundColor)';
                root.style.colorScheme = '\(isDark ? "dark" : "light")';
              }
              var body = document.body;
              if (body) {
                body.style.background = '\(backgroundColor)';
                body.style.color = '\(textColor)';
              } else {
                document.addEventListener('DOMContentLoaded', function() {
                  if (document.body) {
                    document.body.style.background = '\(backgroundColor)';
                    document.body.style.color = '\(textColor)';
                  }
                }, { once: true });
              }
            })();
            """
        }
    }
}
