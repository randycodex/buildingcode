import SwiftUI
import WebKit

struct ChapterHTMLWebView: UIViewRepresentable {
    let chapterURL: URL
    let readAccessURL: URL
    let targetAnchorID: String?
    let readerTheme: ReaderTheme
    let colorScheme: ColorScheme

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.delegate = context.coordinator
        webView.backgroundColor = UIColor.systemBackground
        webView.scrollView.backgroundColor = UIColor.systemBackground
        webView.scrollView.minimumZoomScale = 1
        webView.scrollView.maximumZoomScale = 1
        webView.scrollView.bouncesZoom = false
        webView.isOpaque = false
        webView.allowsBackForwardNavigationGestures = false
        context.coordinator.parent = self
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.parent = self
        let webBackground: UIColor = colorScheme == .dark ? .black : .white
        webView.backgroundColor = webBackground
        webView.scrollView.backgroundColor = webBackground

        if context.coordinator.loadedURL != chapterURL {
            context.coordinator.loadedURL = chapterURL
            context.coordinator.pendingAnchorID = targetAnchorID
            webView.loadFileURL(chapterURL, allowingReadAccessTo: readAccessURL)
            return
        }

        if context.coordinator.appliedTheme != readerTheme ||
            context.coordinator.appliedColorScheme != colorScheme {
            context.coordinator.applyReaderScripts(to: webView)
        }

        if context.coordinator.lastScrolledAnchorID != targetAnchorID {
            context.coordinator.scroll(to: targetAnchorID, in: webView)
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate, UIScrollViewDelegate {
        var parent: ChapterHTMLWebView?
        var loadedURL: URL?
        var pendingAnchorID: String?
        var lastScrolledAnchorID: String?
        var appliedTheme: ReaderTheme?
        var appliedColorScheme: ColorScheme?

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            applyReaderScripts(to: webView)
            scroll(to: pendingAnchorID ?? parent?.targetAnchorID, in: webView)
            pendingAnchorID = nil
        }

        func applyReaderScripts(to webView: WKWebView) {
            guard let parent else { return }
            appliedTheme = parent.readerTheme
            appliedColorScheme = parent.colorScheme

            let css = Self.readerCSS(theme: parent.readerTheme, colorScheme: parent.colorScheme)
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
              viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

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
                var child = start.nextElementSibling;
                while (child) {
                  if (childStartsBoundary(child, level)) { break; }
                  nodes.push(child);
                  child = child.nextElementSibling;
                }
                return nodes;
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
                controlledSiblings(heading).forEach(function(node) {
                  node.hidden = collapsed;
                });
              }

              document.querySelectorAll('.Section, .Subsection').forEach(function(heading) {
                if (heading.dataset.nycccCollapseReady === 'true') { return; }
                heading.dataset.nycccCollapseReady = 'true';
                heading.classList.add('nyccc-collapsible-heading');
                var storageKey = collapseStorageKey(heading);
                var storedState = null;
                try { storedState = localStorage.getItem(storageKey); } catch (error) {}
                setCollapsed(heading, storedState ? storedState === 'collapsed' : true);
                heading.addEventListener('click', function(event) {
                  if (event.target.closest('a')) { return; }
                  var collapsed = heading.dataset.nycccCollapsed !== 'true';
                  setCollapsed(heading, collapsed);
                  try {
                    localStorage.setItem(storageKey, collapsed ? 'collapsed' : 'expanded');
                  } catch (error) {}
                });
              });
            })();
            """
            webView.evaluateJavaScript(javascript)
        }

        func scroll(to anchorID: String?, in webView: WKWebView) {
            guard let anchorID, !anchorID.isEmpty else { return }
            lastScrolledAnchorID = anchorID
            let javascript = """
            (function() {
              var target = document.getElementById(\(Self.javascriptString(anchorID)));
              if (!target) { return false; }
              target.scrollIntoView({ behavior: 'auto', block: 'start' });
              return true;
            })();
            """
            webView.evaluateJavaScript(javascript)
        }

        func viewForZooming(in scrollView: UIScrollView) -> UIView? {
            nil
        }

        private static func readerCSS(theme: ReaderTheme, colorScheme: ColorScheme) -> String {
            let isDark = colorScheme == .dark
            let textColor = isDark ? "#f5f5f7" : "#111111"
            let backgroundColor = isDark ? "#000000" : "#ffffff"
            let secondaryColor = isDark ? "#c9c9cf" : "#424247"
            let borderColor = isDark ? "rgba(230,230,235,0.45)" : "rgba(40,40,45,0.35)"
            let accentColor = theme.accentPalette.hexColor
            let bodyFontSize = max(theme.fontSize * 1.28, 13)
            let headingFontSize = max(theme.fontSize * 0.92, 11)
            let tableFontSize = max(theme.fontSize * 0.82, 10)
            let lineHeight = max(1.42, min(1.72, 1.32 + theme.lineSpacing / 25))
            let paragraphSpacing = max(theme.paragraphSpacing / 16, 0.65)
            let fontFamily: String
            switch theme.fontChoice {
            case .system:
                fontFamily = #"-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif"#
            case .serif:
                fontFamily = #"ui-serif, Georgia, "Times New Roman", serif"#
            case .rounded:
                fontFamily = #"-apple-system, BlinkMacSystemFont, "SF Pro Rounded", "Helvetica Neue", Arial, sans-serif"#
            case .monospaced:
                fontFamily = #"ui-monospace, "SF Mono", Menlo, Monaco, monospace"#
            }

            return """
            html {
              -webkit-text-size-adjust: 100%;
              background: \(backgroundColor);
              color-scheme: \(isDark ? "dark" : "light");
            }
            * {
              box-sizing: border-box;
              max-width: 100%;
            }
            body {
              margin: 0;
              padding: 18px 18px 112px;
              background: \(backgroundColor) !important;
              color: \(textColor) !important;
              font-family: \(fontFamily) !important;
              font-size: \(bodyFontSize)px !important;
              line-height: \(lineHeight) !important;
              overflow-wrap: break-word;
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
              line-height: 1.22;
              margin: 1.6rem 0 0.8rem !important;
            }
            h6 { font-size: \(headingFontSize)px !important; }
            .Subarticle h6 {
              text-align: center;
              font-size: \(headingFontSize + 1)px !important;
              text-transform: uppercase;
              letter-spacing: 0;
            }
            .Section h6 {
              color: \(accentColor) !important;
              font-size: \(headingFontSize)px !important;
              text-transform: uppercase;
            }
            .Subsection h6 { font-size: \(headingFontSize)px !important; }
            .nyccc-collapsible-heading h6 {
              cursor: pointer;
              -webkit-user-select: none;
              user-select: none;
            }
            .nyccc-collapsible-heading h6::before {
              content: "▾ ";
              color: \(accentColor);
              font-size: 0.82em;
            }
            .nyccc-collapsed-heading h6::before {
              content: "▸ ";
            }
            .Normal-Level > div { margin: \(paragraphSpacing)rem 0 !important; }
            span[style*="font-weight: bold"] { font-weight: 700 !important; }
            span[style*="font-style: italic"] { font-style: italic !important; }
            a, .nyccc-link-text { color: \(accentColor) !important; text-decoration: none; }
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
              line-height: 1.28 !important;
              min-width: max-content;
            }
            td, th {
              border: 1px solid \(borderColor) !important;
              padding: 0.35rem 0.45rem;
              vertical-align: top;
              color: \(textColor) !important;
            }
            figure[data-table-ref]:empty { display: none; }
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
    }
}
