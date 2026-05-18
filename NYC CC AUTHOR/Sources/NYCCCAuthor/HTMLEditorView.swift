import AppKit
import SwiftUI
import WebKit

struct HTMLEditorView: View {
    @Binding var bodyContent: String
    @Binding var fullHTMLContent: String
    let isSourceVisible: Bool
    let zoomScale: Double
    let scrollTargetID: String?
    var scrollToTableReferenceID: String?
    var insertTableReferenceID: String?
    var insertTableReferenceVersion: Int = 0
    var searchQuery: String = ""
    var searchVersion: Int = 0
    var searchMode: String = "Highlight All"
    var searchStepDirection: Int = 1

    var body: some View {
        HSplitView {
            WYSIWYGWebView(
                htmlContent: $bodyContent,
                zoomScale: zoomScale,
                scrollTargetID: scrollTargetID,
                scrollToTableReferenceID: scrollToTableReferenceID,
                insertTableReferenceID: insertTableReferenceID,
                insertTableReferenceVersion: insertTableReferenceVersion,
                allowModelUpdatesFromWebView: !isSourceVisible,
                searchQuery: searchQuery,
                searchVersion: searchVersion,
                searchMode: searchMode,
                searchStepDirection: searchStepDirection
            )
                .frame(minWidth: 320)

            if isSourceVisible {
                HTMLSourceView(htmlContent: $fullHTMLContent)
                    .frame(minWidth: 320)
            }
        }
    }
}

private struct WYSIWYGWebView: NSViewRepresentable {
    @Binding var htmlContent: String
    let zoomScale: Double
    let scrollTargetID: String?
    let scrollToTableReferenceID: String?
    let insertTableReferenceID: String?
    let insertTableReferenceVersion: Int
    let allowModelUpdatesFromWebView: Bool
    var searchQuery: String = ""
    var searchVersion: Int = 0
    var searchMode: String = "Highlight All"
    var searchStepDirection: Int = 1

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let userContentController = WKUserContentController()
        userContentController.add(context.coordinator, name: "htmlChanged")
        configuration.userContentController = userContentController

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.setValue(false, forKey: "drawsBackground")

        context.coordinator.webView = webView
        context.coordinator.loadDocument(htmlContent)
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        guard !context.coordinator.isUpdatingFromWebView else {
            return
        }
        let sourceWasAuthoritative = !context.coordinator.allowModelUpdatesFromWebView
        context.coordinator.allowModelUpdatesFromWebView = allowModelUpdatesFromWebView
        context.coordinator.applyZoom(zoomScale)
        context.coordinator.scrollToTarget(scrollTargetID)
        context.coordinator.scrollToTableReference(scrollToTableReferenceID)
        context.coordinator.insertTableReference(insertTableReferenceID, version: insertTableReferenceVersion)
        context.coordinator.performSearch(searchQuery, version: searchVersion, mode: searchMode, direction: searchStepDirection)

        // When the source pane is visible, it is the authoritative editor.
        // Do not reload the WYSIWYG on every keystroke — that steals focus
        // and can cause WebKit-normalized HTML to clobber the user's source edits.
        let sourceVisible = !allowModelUpdatesFromWebView
        if sourceVisible {
            context.coordinator.pendingHTMLForReload = htmlContent
            return
        }

        // Source pane just closed — reload once from the latest model.
        if sourceWasAuthoritative, let pending = context.coordinator.pendingHTMLForReload {
            context.coordinator.pendingHTMLForReload = nil
            context.coordinator.loadDocument(pending)
            return
        }

        if context.coordinator.lastLoadedHTML != htmlContent {
            context.coordinator.loadDocument(htmlContent)
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var parent: WYSIWYGWebView
        weak var webView: WKWebView?
        var lastLoadedHTML: String = ""
        var isUpdatingFromWebView = false
        var lastZoomScale = 1.0
        var lastScrollTargetID: String?
        var lastScrolledTableReferenceID: String?
        var lastInsertedTableReferenceID: String?
        var lastInsertedTableReferenceVersion: Int = -1
        var allowModelUpdatesFromWebView = true
        var pendingHTMLForReload: String?
        var hasFocusedOnce = false
        var lastSearchVersion = -1
        init(parent: WYSIWYGWebView) {
            self.parent = parent
        }

        func loadDocument(_ html: String) {
            lastLoadedHTML = html
            lastZoomScale = parent.zoomScale
            let wrapped = Self.wrap(html: html, zoomScale: parent.zoomScale)
            webView?.loadHTMLString(wrapped, baseURL: nil)
        }

        func applyZoom(_ zoomScale: Double) {
            guard abs(lastZoomScale - zoomScale) > 0.001 else { return }
            lastZoomScale = zoomScale
            webView?.pageZoom = zoomScale
            let js = """
            document.documentElement.style.setProperty('--editor-zoom', '\(zoomScale)');
            document.body.style.fontSize = '\(Int(14 * zoomScale))px';
            """
            webView?.evaluateJavaScript(js, completionHandler: nil)
        }

        func scrollToTarget(_ targetID: String?) {
            guard lastScrollTargetID != targetID else { return }
            lastScrollTargetID = targetID
            guard let outlineID = targetID else {
                return
            }

            let escapedDOMID = outlineID
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "'", with: "\\'")
            let js = """
            (function() {
                var target = document.querySelector('[data-nyc-outline-id="\(escapedDOMID)"]');
                if (!target) return;
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                target.style.outline = '2px solid rgba(74, 144, 226, 0.9)';
                target.style.outlineOffset = '4px';
                window.setTimeout(function() {
                    target.style.outline = '';
                    target.style.outlineOffset = '';
                }, 1200);
            })();
            """
            webView?.evaluateJavaScript(js, completionHandler: nil)
        }

        func scrollToTableReference(_ tableID: String?) {
            guard lastScrolledTableReferenceID != tableID else { return }
            lastScrolledTableReferenceID = tableID
            guard let tableID, !tableID.isEmpty else {
                return
            }

            let escapedTableID = tableID
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "\"", with: "\\\"")
                .replacingOccurrences(of: "'", with: "\\'")
            let js = """
            (function() {
                var target = document.querySelector('figure[data-table-ref="\(escapedTableID)"]');
                if (!target) return;
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.style.outline = '2px solid rgba(69, 212, 131, 0.95)';
                target.style.outlineOffset = '4px';
                window.setTimeout(function() {
                    target.style.outline = '';
                    target.style.outlineOffset = '';
                }, 1200);
            })();
            """
            webView?.evaluateJavaScript(js, completionHandler: nil)
        }

        func insertTableReference(_ tableID: String?, version: Int) {
            guard version != lastInsertedTableReferenceVersion else { return }
            lastInsertedTableReferenceVersion = version
            guard let tableID, !tableID.isEmpty else { return }
            guard lastInsertedTableReferenceID != tableID else { return }
            lastInsertedTableReferenceID = tableID

            let escaped = tableID
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "'", with: "\\'")

            let js = """
            (function() {
                var root = document.getElementById('__editor_root__');
                if (!root) return;
                var html = '<figure data-table-ref="\(escaped)"></figure>';
                if (document.queryCommandSupported && document.queryCommandSupported('insertHTML')) {
                    document.execCommand('insertHTML', false, html);
                    return;
                }
                var selection = window.getSelection();
                if (!selection || selection.rangeCount === 0) {
                    root.insertAdjacentHTML('beforeend', html);
                    return;
                }
                var range = selection.getRangeAt(0);
                range.deleteContents();
                var container = document.createElement('span');
                container.innerHTML = html;
                var fragment = document.createDocumentFragment();
                while (container.firstChild) fragment.appendChild(container.firstChild);
                range.insertNode(fragment);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            })();
            """
            webView?.evaluateJavaScript(js, completionHandler: nil)
        }

        func performSearch(_ query: String, version: Int, mode: String, direction: Int) {
            guard version != lastSearchVersion else { return }
            lastSearchVersion = version

            if query.isEmpty {
                let clearJS = """
                (function() {
                    document.querySelectorAll('.nyc-search-current').forEach(function(el) {
                        el.classList.remove('nyc-search-current');
                    });
                    document.querySelectorAll('.nyc-search-highlight').forEach(function(el) {
                        var parent = el.parentNode;
                        parent.replaceChild(document.createTextNode(el.textContent), el);
                        parent.normalize();
                    });
                })();
                """
                webView?.evaluateJavaScript(clearJS, completionHandler: nil)
                return
            }

            let escaped = query
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "'", with: "\\'")
            let isNavigateMode = mode == "Find One"
            let js = """
            (function() {
                document.querySelectorAll('.nyc-search-current').forEach(function(el) {
                    el.classList.remove('nyc-search-current');
                });
                document.querySelectorAll('.nyc-search-highlight').forEach(function(el) {
                    var parent = el.parentNode;
                    parent.replaceChild(document.createTextNode(el.textContent), el);
                    parent.normalize();
                });
                var root = document.getElementById('__editor_root__');
                if (!root) return;
                var style = document.getElementById('__nyc_search_style__');
                if (!style) {
                    style = document.createElement('style');
                    style.id = '__nyc_search_style__';
                    style.textContent = '.nyc-search-highlight { background: #f5c518; color: #111; border-radius: 2px; } .nyc-search-current { background: #ff8c42 !important; color: #111 !important; outline: 1px solid rgba(255,255,255,0.35); }';
                    document.head.appendChild(style);
                }
                var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
                var nodes = [];
                var node;
                while ((node = walker.nextNode())) { nodes.push(node); }
                var re = new RegExp('\(escaped)', 'gi');
                nodes.forEach(function(textNode) {
                    if (!re.test(textNode.nodeValue)) return;
                    re.lastIndex = 0;
                    var frag = document.createDocumentFragment();
                    var last = 0, m;
                    while ((m = re.exec(textNode.nodeValue)) !== null) {
                        if (m.index > last) frag.appendChild(document.createTextNode(textNode.nodeValue.slice(last, m.index)));
                        var span = document.createElement('span');
                        span.className = 'nyc-search-highlight';
                        span.textContent = m[0];
                        frag.appendChild(span);
                        last = re.lastIndex;
                    }
                    if (last < textNode.nodeValue.length) frag.appendChild(document.createTextNode(textNode.nodeValue.slice(last)));
                    textNode.parentNode.replaceChild(frag, textNode);
                });
                var searchMatches = Array.from(root.querySelectorAll('.nyc-search-highlight'));
                if (!searchMatches.length) {
                    window.__nycSearchIndex = -1;
                    return;
                }
                if (\(isNavigateMode ? "true" : "false")) {
                    var currentIndex = typeof window.__nycSearchIndex === 'number' ? window.__nycSearchIndex : -1;
                    var nextIndex;
                    if (\(direction < 0 ? "true" : "false")) {
                        nextIndex = currentIndex <= 0 ? searchMatches.length - 1 : currentIndex - 1;
                    } else {
                        nextIndex = currentIndex >= searchMatches.length - 1 ? 0 : currentIndex + 1;
                    }
                    window.__nycSearchIndex = nextIndex;
                    var current = searchMatches[nextIndex];
                    current.classList.add('nyc-search-current');
                    current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    window.__nycSearchIndex = 0;
                    searchMatches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            })();
            """
            webView?.evaluateJavaScript(js, completionHandler: nil)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            let shouldFocus = !hasFocusedOnce && allowModelUpdatesFromWebView
            hasFocusedOnce = true
            let focusJS = shouldFocus ? "root.focus();" : ""
            let js = """
            (function() {
                var root = document.getElementById('__editor_root__');
                if (!root) return;

                root.setAttribute('contenteditable', 'true');
                root.setAttribute('spellcheck', 'false');
                root.setAttribute('autocorrect', 'off');
                root.setAttribute('autocapitalize', 'off');
                root.setAttribute('tabindex', '0');
                document.documentElement.style.setProperty('--editor-zoom', '\(parent.zoomScale)');

                var publishPending = false;
                var publish = function() {
                    publishPending = false;
                    var clone = root.cloneNode(true);
                    clone.querySelectorAll('[data-nyc-outline-id]').forEach(function(node) {
                        node.removeAttribute('data-nyc-outline-id');
                    });
                    window.webkit.messageHandlers.htmlChanged.postMessage(clone.innerHTML);
                };
                var schedulePublish = function() {
                    if (publishPending) return;
                    publishPending = true;
                    window.setTimeout(publish, 0);
                };

                var escapeAttr = function(value) {
                    return value.replace(/&/g, '&amp;')
                        .replace(/"/g, '&quot;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                };

                var insertHTML = function(html) {
                    document.execCommand('insertHTML', false, html);
                    schedulePublish();
                };

                if (!window.__nycAuthorBound) {
                    window.__nycAuthorBound = true;

                    var observer = new MutationObserver(schedulePublish);
                    observer.observe(root, {
                        childList: true,
                        subtree: true,
                        characterData: true,
                        attributes: true
                    });

                    root.addEventListener('beforeinput', schedulePublish);
                    root.addEventListener('input', schedulePublish);
                    root.addEventListener('cut', schedulePublish);
                    root.addEventListener('keyup', schedulePublish);
                    root.addEventListener('paste', function(event) {
                        var text = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
                        var trimmed = text.trim();
                        var tableToken = trimmed.match(/^\\[\\[TABLE:\\s*([^\\]]+)\\]\\]$/i);

                        if (/^<figure\\s+[^>]*data-table-ref=/i.test(trimmed) || /^<table[\\s>]/i.test(trimmed)) {
                            event.preventDefault();
                            insertHTML(trimmed);
                            return;
                        }

                        if (tableToken) {
                            event.preventDefault();
                            insertHTML('<figure data-table-ref="' + escapeAttr(tableToken[1].trim()) + '"></figure>');
                            return;
                        }

                        schedulePublish();
                    });
                    document.addEventListener('click', function(event) {
                        var target = event.target;
                        if (target && target.closest && target.closest('a')) {
                            event.preventDefault();
                        }
                        root.focus();
                    }, true);
                }

                \(focusJS)
            })();
            """
            webView.evaluateJavaScript(js, completionHandler: nil)
            applyZoom(parent.zoomScale)
            scrollToTarget(parent.scrollTargetID)
            scrollToTableReference(parent.scrollToTableReferenceID)
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "htmlChanged", let html = message.body as? String else {
                return
            }
            guard allowModelUpdatesFromWebView else {
                return
            }
            isUpdatingFromWebView = true
            lastLoadedHTML = html
            parent.htmlContent = html
            DispatchQueue.main.async { [weak self] in
                self?.isUpdatingFromWebView = false
            }
        }

        static func wrap(html: String, zoomScale: Double) -> String {
            """
            <!DOCTYPE html>
            <html>
            <head>
            <meta charset="utf-8">
            <style>
            html {
                --editor-zoom: \(zoomScale);
                background: #111;
            }
            html, body {
                margin: 0;
                padding: 0;
                background: #111;
                color: #f6f6f6;
            }
            #__editor_root__ {
                font-family: -apple-system, system-ui, sans-serif;
                font-size: calc(14px * var(--editor-zoom));
                line-height: 1.5;
                padding: calc(22px * var(--editor-zoom));
                min-height: 100vh;
                outline: none;
                cursor: text;
                -webkit-user-modify: read-write;
                box-sizing: border-box;
                overflow-wrap: anywhere;
                color: #f6f6f6;
                background: #111;
            }
            #__editor_root__ * {
                color: inherit;
            }
            #__editor_root__ a,
            #__editor_root__ [style*="color"] {
                color: #8ab4ff !important;
            }
            #__editor_root__ table {
                color: #f6f6f6;
                border-collapse: collapse;
                max-width: 100%;
            }
            #__editor_root__ th,
            #__editor_root__ td {
                border-color: #777 !important;
            }
            #__editor_root__ figure[data-table-ref] {
                display: block;
                margin: 1rem 0;
                padding: 0.75rem;
                border: 1px dashed #45d483;
                border-radius: 8px;
                color: #9ff0bc !important;
                background: rgba(69, 212, 131, 0.08);
            }
            #__editor_root__ figure[data-table-ref]::before {
                content: "TABLE: " attr(data-table-ref);
                font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                font-size: 0.9em;
            }
            </style>
            </head>
            <body>
            <div id="__editor_root__" contenteditable="true">
            \(decorate(html: html))
            </div>
            </body>
            </html>
            """
        }

        private static func decorate(html: String) -> String {
            let headingRegex = try! NSRegularExpression(
                pattern: #"<h[1-6](\s[^>]*)?>"#,
                options: [.caseInsensitive]
            )
            let figureRegex = try! NSRegularExpression(
                pattern: #"<figure[^>]*data-table-ref="[^"]+"[^>]*>"#,
                options: [.caseInsensitive]
            )

            var insertions: [(location: Int, value: String)] = []
            let nsHTML = html as NSString
            let fullRange = NSRange(location: 0, length: nsHTML.length)
            var headingCount = 0
            var tableCount = 0

            for match in headingRegex.matches(in: html, options: [], range: fullRange) {
                headingCount += 1
                insertions.append((match.range.location + match.range.length - 1, #" data-nyc-outline-id="outline-heading-\#(headingCount)""#))
            }

            for match in figureRegex.matches(in: html, options: [], range: fullRange) {
                tableCount += 1
                insertions.append((match.range.location + match.range.length - 1, #" data-nyc-outline-id="outline-table-\#(tableCount)""#))
            }

            var decorated = html
            for insertion in insertions.sorted(by: { $0.location > $1.location }) {
                let index = decorated.index(decorated.startIndex, offsetBy: insertion.location)
                decorated.insert(contentsOf: insertion.value, at: index)
            }
            return decorated
        }
    }
}

private struct HTMLSourceView: NSViewRepresentable {
    @Binding var htmlContent: String

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSTextView.scrollableTextView()
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.autohidesScrollers = true

        guard let textView = scrollView.documentView as? NSTextView else {
            return scrollView
        }

        textView.delegate = context.coordinator
        textView.isRichText = false
        textView.font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.isAutomaticSpellingCorrectionEnabled = false
        textView.allowsUndo = true
        textView.textContainerInset = NSSize(width: 12, height: 16)
        textView.string = htmlContent

        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        guard let textView = scrollView.documentView as? NSTextView else {
            return
        }
        guard !context.coordinator.isUpdatingFromTextView else {
            return
        }
        if textView.string != htmlContent {
            context.coordinator.isUpdatingFromModel = true
            textView.string = htmlContent
            context.coordinator.isUpdatingFromModel = false
        }
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: HTMLSourceView
        var isUpdatingFromTextView = false
        var isUpdatingFromModel = false

        init(parent: HTMLSourceView) {
            self.parent = parent
        }

        func textDidChange(_ notification: Notification) {
            guard !isUpdatingFromModel,
                  let textView = notification.object as? NSTextView else {
                return
            }
            isUpdatingFromTextView = true
            parent.htmlContent = textView.string
            DispatchQueue.main.async { [weak self] in
                self?.isUpdatingFromTextView = false
            }
        }
    }
}
