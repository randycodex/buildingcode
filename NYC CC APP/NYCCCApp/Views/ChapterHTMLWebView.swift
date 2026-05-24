import SwiftUI
import WebKit

struct ChapterHTMLSectionTarget: Hashable {
    let anchorID: String
    let sectionNumber: String?
}

struct ChapterHTMLWebView: UIViewRepresentable {
    let chapterURL: URL
    let readAccessURL: URL
    let targetAnchorID: String?
    let readerTheme: ReaderTheme
    let accentHex: String
    let colorScheme: ColorScheme
    let bookmarkedAnchorIDs: Set<String>
    let bookmarkedSectionNumbers: Set<String>
    let expandAllTrigger: Int
    let collapseAllTrigger: Int
    let scrollToTopTrigger: Int
    let onVisibleAnchorChange: ((String) -> Void)?
    let onOpenSectionForAnchor: ((ChapterHTMLSectionTarget) -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.userContentController.add(context.coordinator, name: Coordinator.visibleAnchorMessageName)
        configuration.userContentController.add(context.coordinator, name: Coordinator.openSectionMessageName)

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.delegate = context.coordinator
        webView.backgroundColor = UIColor.systemGroupedBackground
        webView.scrollView.backgroundColor = UIColor.systemGroupedBackground
        webView.scrollView.minimumZoomScale = 1
        webView.scrollView.maximumZoomScale = 1
        webView.scrollView.bouncesZoom = false
        webView.isOpaque = true
        webView.allowsBackForwardNavigationGestures = false
        context.coordinator.parent = self
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.parent = self
        let webBackground: UIColor = colorScheme == .dark ? .black : .systemGroupedBackground
        webView.backgroundColor = webBackground
        webView.scrollView.backgroundColor = webBackground

        if context.coordinator.loadedURL != chapterURL {
            context.coordinator.loadedURL = chapterURL
            context.coordinator.pendingAnchorID = targetAnchorID
            if let resolvedHTML = context.coordinator.resolvedHTML(for: chapterURL, readAccessURL: readAccessURL) {
                webView.loadHTMLString(resolvedHTML, baseURL: chapterURL.deletingLastPathComponent())
            } else {
                webView.loadFileURL(chapterURL, allowingReadAccessTo: readAccessURL)
            }
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
        if context.coordinator.lastScrolledAnchorID != targetAnchorID {
            context.coordinator.scroll(to: targetAnchorID, in: webView)
        }
        if context.coordinator.appliedScrollToTopTrigger != scrollToTopTrigger {
            context.coordinator.appliedScrollToTopTrigger = scrollToTopTrigger
            context.coordinator.scrollToTop(in: webView)
        }
    }

    final class Coordinator: NSObject, WKNavigationDelegate, UIScrollViewDelegate, WKScriptMessageHandler {
        static let visibleAnchorMessageName = "nycccVisibleAnchor"
        static let openSectionMessageName = "nycccOpenSection"

        var parent: ChapterHTMLWebView?
        var loadedURL: URL?
        var pendingAnchorID: String?
        var lastScrolledAnchorID: String?
        var appliedTheme: ReaderTheme?
        var appliedAccentHex: String?
        var appliedColorScheme: ColorScheme?
        var appliedBookmarkedAnchorIDs: Set<String> = []
        var appliedBookmarkedSectionNumbers: Set<String> = []
        var appliedExpandAllTrigger = 0
        var appliedCollapseAllTrigger = 0
        var appliedScrollToTopTrigger = 0

        func resolvedHTML(for chapterURL: URL, readAccessURL: URL) -> String? {
            guard let html = try? String(contentsOf: chapterURL, encoding: .utf8) else {
                return nil
            }
            let localizedHTML = rewriteImageSources(in: html, chapterURL: chapterURL, readAccessURL: readAccessURL)
            return addImageLoadingAttributes(in: localizedHTML)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            applyReaderScripts(to: webView)
            applyBookmarkDecorations(to: webView)
            scroll(to: pendingAnchorID ?? parent?.targetAnchorID, in: webView)
            pendingAnchorID = nil
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
                return card || target;
              };

              buildSectionCards();

              function visibleAnchorID() {
                var headings = Array.prototype.slice.call(document.querySelectorAll('.Section, .Subsection'));
                if (!headings.length) { return null; }

                var viewportTop = window.scrollY + 88;
                var candidate = headings[0];

                for (var i = 0; i < headings.length; i++) {
                  var heading = headings[i];
                  var top = heading.getBoundingClientRect().top + window.scrollY;
                  if (top <= viewportTop) {
                    candidate = heading;
                  } else {
                    break;
                  }
                }

                return candidate ? candidate.id : null;
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

              document.querySelectorAll('.Section, .Subsection').forEach(function(heading) {
                if (heading.dataset.nycccCollapseReady === 'true') { return; }
                heading.dataset.nycccCollapseReady = 'true';
                heading.classList.add('nyccc-collapsible-heading');
                setCollapsed(heading, false);
                heading.addEventListener('click', function(event) {
                  if (event.target.closest('a')) { return; }
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
                      if (event.target.closest('a')) { return; }
                      if (window.getSelection && String(window.getSelection()).trim().length > 0) { return; }
                      event.preventDefault();
                      event.stopPropagation();
                      openSectionForHeading(heading);
                    });
                  });
                }
              });

              window.removeEventListener('scroll', window.__nycccVisibleAnchorListener);
              window.__nycccVisibleAnchorListener = function() {
                if (window.__nycccVisibleAnchorFramePending === true) { return; }
                window.__nycccVisibleAnchorFramePending = true;
                window.requestAnimationFrame(function() {
                  window.__nycccVisibleAnchorFramePending = false;
                  reportVisibleAnchor();
                });
              };
              window.addEventListener('scroll', window.__nycccVisibleAnchorListener, { passive: true });
              setTimeout(reportVisibleAnchor, 0);
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
                heading.querySelectorAll('.nyccc-bookmark-marker').forEach(function(marker) {
                  marker.remove();
                });
                heading.classList.toggle('nyccc-bookmarked-heading', isBookmarked);
                heading.setAttribute('data-nyccc-section-number', sectionNumber || '');
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
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

        func viewForZooming(in scrollView: UIScrollView) -> UIView? {
            nil
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == Self.openSectionMessageName {
                guard let target = sectionTarget(from: message.body) else { return }
                DispatchQueue.main.async { [weak self] in
                    self?.parent?.onOpenSectionForAnchor?(target)
                }
                return
            }

            guard message.name == Self.visibleAnchorMessageName,
                  let anchorID = message.body as? String,
                  !anchorID.isEmpty
            else { return }

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
            guard !anchorID.isEmpty || !(sectionNumber?.isEmpty ?? true) else { return nil }
            return ChapterHTMLSectionTarget(
                anchorID: anchorID,
                sectionNumber: sectionNumber?.isEmpty == false ? sectionNumber : nil
            )
        }

        private func rewriteImageSources(in html: String, chapterURL: URL, readAccessURL: URL) -> String {
            guard let regex = try? NSRegularExpression(pattern: #"(?i)(<img\b[^>]*\bsrc\s*=\s*")([^"]+)(")"#) else {
                return html
            }

            let nsHTML = html as NSString
            let matches = regex.matches(in: html, range: NSRange(location: 0, length: nsHTML.length))
            guard !matches.isEmpty else { return html }

            let chapterBaseURL = chapterURL.deletingLastPathComponent()
            let assetsDirectoryURL = resolvedAssetsDirectoryURL(chapterURL: chapterURL, readAccessURL: readAccessURL)
            var rewrittenHTML = html

            for match in matches.reversed() {
                guard match.numberOfRanges == 4 else { continue }
                let originalSource = nsHTML.substring(with: match.range(at: 2))
                guard let replacementSource = resolvedImageSource(
                    originalSource,
                    chapterBaseURL: chapterBaseURL,
                    assetsDirectoryURL: assetsDirectoryURL
                ),
                replacementSource != originalSource else {
                    continue
                }

                if let sourceRange = Range(match.range(at: 2), in: rewrittenHTML) {
                    rewrittenHTML.replaceSubrange(sourceRange, with: replacementSource)
                }
            }

            return rewrittenHTML
        }

        private func resolvedImageSource(
            _ source: String,
            chapterBaseURL: URL,
            assetsDirectoryURL: URL?
        ) -> String? {
            guard !source.isEmpty else { return nil }

            let fileManager = FileManager.default
            let sourceURL = URL(fileURLWithPath: source)
            let fileName = sourceURL.lastPathComponent
            guard !fileName.isEmpty else { return nil }

            let chapterFileURL = chapterBaseURL.appendingPathComponent(fileName)
            if fileManager.fileExists(atPath: chapterFileURL.path) {
                return chapterFileURL.absoluteString
            }

            if let assetsDirectoryURL {
                let assetFileURL = assetsDirectoryURL.appendingPathComponent(fileName)
                if fileManager.fileExists(atPath: assetFileURL.path) {
                    return assetFileURL.absoluteString
                }
            }

            let baseName = sourceURL.deletingPathExtension().lastPathComponent
            for ext in ["png", "jpg", "jpeg", "gif", "webp"] {
                let candidateName = "\(baseName).\(ext)"
                if let assetsDirectoryURL {
                    let assetCandidateURL = assetsDirectoryURL.appendingPathComponent(candidateName)
                    if fileManager.fileExists(atPath: assetCandidateURL.path) {
                        return assetCandidateURL.absoluteString
                    }
                }
                let chapterCandidateURL = chapterBaseURL.appendingPathComponent(candidateName)
                if fileManager.fileExists(atPath: chapterCandidateURL.path) {
                    return chapterCandidateURL.absoluteString
                }
            }

            return nil
        }

        private func resolvedAssetsDirectoryURL(chapterURL: URL, readAccessURL: URL) -> URL? {
            let fileManager = FileManager.default

            let directAssetsURL = readAccessURL.appendingPathComponent("assets", isDirectory: true)
            if fileManager.fileExists(atPath: directAssetsURL.path) {
                return directAssetsURL
            }

            var searchURL = chapterURL.deletingLastPathComponent()
            for _ in 0..<5 {
                let candidate = searchURL.appendingPathComponent("assets", isDirectory: true)
                if fileManager.fileExists(atPath: candidate.path) {
                    return candidate
                }
                searchURL.deleteLastPathComponent()
            }

            return nil
        }

        private func addImageLoadingAttributes(in html: String) -> String {
            guard let regex = try? NSRegularExpression(pattern: #"(?i)<img\b[^>]*>"#) else {
                return html
            }
            let nsHTML = html as NSString
            let matches = regex.matches(in: html, range: NSRange(location: 0, length: nsHTML.length))
            guard !matches.isEmpty else { return html }

            var rewrittenHTML = html
            for match in matches.reversed() {
                let tag = nsHTML.substring(with: match.range)
                var rewrittenTag = tag
                if rewrittenTag.range(of: #"\sloading\s*="#, options: [.regularExpression, .caseInsensitive]) == nil {
                    rewrittenTag = rewrittenTag.replacingOccurrences(of: "<img", with: #"<img loading="lazy""#, options: .caseInsensitive)
                }
                if rewrittenTag.range(of: #"\sdecoding\s*="#, options: [.regularExpression, .caseInsensitive]) == nil {
                    rewrittenTag = rewrittenTag.replacingOccurrences(of: "<img", with: #"<img decoding="async""#, options: .caseInsensitive)
                }
                guard rewrittenTag != tag, let range = Range(match.range, in: rewrittenHTML) else { continue }
                rewrittenHTML.replaceSubrange(range, with: rewrittenTag)
            }
            return rewrittenHTML
        }

        private static func readerCSS(theme: ReaderTheme, colorScheme: ColorScheme, accentHex: String) -> String {
            let isDark = colorScheme == .dark
            let textColor = isDark ? "#f5f5f7" : "#111111"
            let backgroundColor = isDark ? "#000000" : "#f2f2f7"
            let secondaryColor = isDark ? "#b5b5bc" : "#5d6168"
            let borderColor = isDark ? "#6f6f76" : "#c6c6cc"
            let softBorderColor = isDark ? "#4b4b50" : "#d8d8de"
            let bodyFontSize = max(theme.fontSize * 1.16, 12)
            let sectionHeadingSize = max(theme.fontSize * 1.08, 13)
            let subsectionHeadingSize = max(theme.fontSize * 1.0, 12)
            let tableFontSize = max(theme.fontSize * 0.78, 9)
            let lineHeight = max(1.35, min(1.64, 1.28 + theme.lineSpacing / 28))
            let paragraphSpacing = max(theme.paragraphSpacing / 20, 0.42)
            let fontFamily: String
            switch theme.fontChoice {
            case .sfPro:
                fontFamily = #""SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif"#
            case .sfCompact:
                fontFamily = #""SF Compact Text", "SF Compact Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif"#
            case .sfMono:
                fontFamily = #""SF Mono", ui-monospace, Menlo, Monaco, monospace"#
            case .newYork:
                fontFamily = #""New York", "NewYork", ui-serif, Georgia, "Times New Roman", serif"#
            case .sanFrancisco:
                fontFamily = #""SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif"#
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
              padding: 0 16px 96px;
              background: \(backgroundColor) !important;
              color: \(textColor) !important;
              font-family: \(fontFamily) !important;
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
              border-top: 1px solid \(borderColor);
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
              border-bottom: 1px solid \(borderColor);
            }
            .nyccc-section-card-expanded .Subsection {
              margin-top: 0.72rem !important;
              padding-top: 0.72rem !important;
              padding-right: 0 !important;
              border-top-color: \(softBorderColor) !important;
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
              padding-left: 1.05rem;
            }
            .Subsection h6 {
              padding-right: 2.35rem;
            }
            .Subsection {
              position: relative !important;
              padding-right: 2.25rem !important;
            }
            .nyccc-collapsible-heading h6 {
              cursor: pointer;
              -webkit-user-select: none;
              user-select: none;
            }
            .nyccc-section-open-target {
              cursor: pointer;
            }
            .nyccc-collapsible-heading h6::before {
              content: "" !important;
              display: none !important;
            }
            .Section.nyccc-collapsible-heading h6::after {
              content: "" !important;
              display: none !important;
            }
            .Subsection.nyccc-bookmarked-heading h6::after {
              content: "" !important;
              display: block !important;
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
    }
}
