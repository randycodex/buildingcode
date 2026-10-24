// Fade the content of a scrolling viewport, using transparency rather than
// a painted color so tinted panels and both system appearances stay correct.
const viewports = [
  '.reader-content', '.section-detail-content', '.saved-column-scroll', '.saved-content',
  '.analysis-content', '.projects-content', '.project-detail-content',
  '.workspace-issue', '.mobile-more-sheet', '.reader-trust-details',
  '.section-save-project-sheet', '.reader-notes-project-options', '.section-detail-project-menu',
  '.search-results', '.search-jump-list', '.search-history-list', '.search-history-scroll-list',
  '.search-recent-popover-list', '.research-message-thread', '.research-evidence-scroll',
  '.research-citation-passages blockquote', '.evidence-candidate-card blockquote',
  '.search-code-filter-menu.is-open .search-code-filter', '.saved-project-list',
  '.notebook-editor-surface', '.notebook-card-list', '.notebook-reference-list',
  '.project-note-editor-surface', '.notebook-shell', '.saved-project-evidence-body',
  '.coordination-content', '.coordination-thread-content', '.calculator-column-content',
  '.project-information-panel', '.project-information-content', '.project-details-column-body',
  '.settings-account-column', '.settings-scroll', '.account-welcome',
  '.report-document', '.report-outline', '.report-source-picker', '.report-history', '.report-export-content',
  '.report-draft-shell',
  '.code-question-panel-body', '.code-question-index-list',
  '.custom-select-menu', '.reader-open-code-menu', '.reader-definition-popover',
  '.search-code-source-menu', '.research-destination-menu', '.column-group-menu',
  '.saved-column-groups-menu', '.report-draft-menu-items', '.notebook-note-menu-items',
  '.command-palette-list', '.project-create-sheet', '.project-refresh-dialog',
  '.column-group-dialog', '.bookmark-undo-tray',
  '.account-deletion-dialog', '.profile-dialog', '.active-code-source-dialog', '.sync-pending-list'
].join(',');
const stickyHeaders = '.report-editor-controls, .report-outline-header, .notebook-format-toolbar, .project-details-column-header, .reader-definition-controls, .calculation-function-search';
const editorPopupCandidates = '.report-editor-controls details, .report-format-link-form, .notebook-format-toolbar details, .notebook-format-style-menu, .notebook-format-link-form, .notebook-note-menu, .report-draft-version-list';
const discoverable = [viewports, stickyHeaders, editorPopupCandidates].join(',');
const editorPopups = '.report-editor-controls details[open], .report-format-link-form:not([hidden]), .notebook-format-toolbar details[open], .notebook-format-style-menu, .notebook-format-link-form, .notebook-note-menu[open], .report-draft-version-list[open]';

export function scrollFadeEdges({scrollTop, scrollHeight, clientHeight}) {
  const overflow = clientHeight > 0 && scrollHeight - clientHeight > 2;
  // Scroll offsets may be fractional at browser zoom levels while the heights
  // are rounded. A two-pixel tolerance keeps the actual end fully visible.
  return {top: overflow && scrollTop > 2, bottom: overflow && scrollHeight - clientHeight - scrollTop > 2};
}

export function installScrollEdgeFades() {
  const tracked = new Set(), headers = new Set(), popups = new Set();
  const discoveryRoots = new Set([document]);
  const applied = new WeakMap();
  let frame = 0;
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const resize = new ResizeObserver(() => schedule());
  const register = element => {
    if (element.matches(viewports) && !tracked.has(element)) {tracked.add(element); resize.observe(element);}
    if (element.matches(stickyHeaders)) headers.add(element);
    if (element.matches(editorPopupCandidates)) popups.add(element);
  };
  const discoverWithin = root => {
    if (root.nodeType === 1) register(root);
    if (root === document || root.childElementCount) for (const element of root.querySelectorAll(discoverable)) register(element);
  };
  const queueDiscovery = root => {
    if (root.nodeType !== 1) return;
    for (const existing of discoveryRoots) {
      if (existing.contains(root)) return;
      if (root.contains(existing)) discoveryRoots.delete(existing);
    }
    discoveryRoots.add(root);
  };
  function update() {
    frame = 0;
    for (const root of discoveryRoots) if (root === document || root.isConnected) discoverWithin(root);
    discoveryRoots.clear();
    for (const set of [headers, popups]) for (const element of set) if (!element.isConnected) set.delete(element);
    // Read layout before writing masks, including when a column is resized or
    // a sticky editing toolbar reaches the top of its scrolling viewport.
    const states = [];
    const panelVisibility = new Map();
    for (const element of tracked) {
      if (!element.isConnected) {tracked.delete(element); resize.unobserve(element); continue;}
      // Measure only the outer containment box of horizontally offscreen
      // columns. Reading a descendant's clientHeight would force its skipped
      // Reader tree back through layout on every unrelated DOM mutation.
      const panel = element.closest?.('.workspace-panel');
      if (panel) {
        if (!panelVisibility.has(panel)) {
          const bounds = panel.getBoundingClientRect();
          panelVisibility.set(panel, bounds.width > 0 && bounds.right > 0 && bounds.left < window.innerWidth);
        }
        if (!panelVisibility.get(panel)) continue;
      }
      // Hidden retained workflow columns have no viewport to fade. Avoid
      // querying their source text or forcing their scroll/style measurements.
      if (!element.clientHeight) {states.push({element, top:false, bottom:false, header:0}); continue;}
      const {top, bottom} = scrollFadeEdges(element);
      const scrolls = ['auto','scroll'].includes(getComputedStyle(element).overflowY);
      // A menu opened from a pinned tool must stay fully legible where it
      // extends over the content edge. Its own scroll viewport can still fade.
      const popupOpen = scrolls && (top || bottom) && [...popups].some(popup =>
        element.contains(popup) && popup.matches(editorPopups) && popup.getClientRects().length > 0);
      // Reader and Settings already fade beneath their fixed/sticky headers.
      const existingTopFade = element.matches('.reader-content, .settings-account-column');
      let header = 0;
      if (scrolls && top && !existingTopFade) {
        const bounds = element.getBoundingClientRect();
        for (const candidate of headers) {
          if (!element.contains(candidate)) continue;
          const box = candidate.getBoundingClientRect();
          if (getComputedStyle(candidate).position === 'sticky' && box.top <= bounds.top + 1 && box.bottom > bounds.top) {
            header = Math.max(header, box.bottom - bounds.top);
          }
        }
      }
      states.push({element, top: scrolls && top && !existingTopFade && !popupOpen, bottom: scrolls && bottom && !popupOpen, header});
    }
    for (const {element,top,bottom,header} of states) {
      const previous = applied.get(element);
      if (previous && previous.top === top && previous.bottom === bottom && previous.header === header) continue;
      applied.set(element, {top,bottom,header});
      element.toggleAttribute('data-scroll-fade', top || bottom);
      element.style.setProperty('--scroll-fade-top-size', top ? '24px' : '0px');
      element.style.setProperty('--scroll-fade-top-alpha', top ? '0' : '1');
      element.style.setProperty('--scroll-fade-bottom-size', bottom ? '24px' : '0px');
      element.style.setProperty('--scroll-fade-bottom-alpha', bottom ? '0' : '1');
      element.style.setProperty('--scroll-fade-header', `${header}px`);
    }
  }
  const mutation = new MutationObserver(records => {
    const changed = new Set();
    for (const record of records) {
      if (record.type === 'childList') for (const node of record.addedNodes) queueDiscovery(node);
      if (record.type === 'attributes' && record.attributeName === 'class') changed.add(record.target);
    }
    for (const element of changed) {
      register(element);
      if (element.matches('.search-code-filter-menu, .report-editor-controls, .notebook-format-toolbar')) queueDiscovery(element);
    }
    schedule();
  });
  mutation.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['class','hidden','open']});
  const onScroll = () => schedule();
  const onResize = () => schedule();
  document.addEventListener('scroll', onScroll, {capture:true, passive:true});
  document.addEventListener('load', onResize, true);
  document.fonts?.addEventListener('loadingdone', onResize);
  window.addEventListener('resize', onResize, {passive:true});
  schedule();
  return () => {
    cancelAnimationFrame(frame); mutation.disconnect(); resize.disconnect();
    document.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onResize);
    document.removeEventListener('load', onResize, true); document.fonts?.removeEventListener('loadingdone', onResize);
    for (const element of tracked) element.removeAttribute('data-scroll-fade');
    tracked.clear(); headers.clear(); popups.clear(); discoveryRoots.clear();
  };
}
