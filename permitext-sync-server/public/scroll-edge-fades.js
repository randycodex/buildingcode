// Fade the content of a scrolling viewport, using transparency rather than
// a painted color so tinted panels and both system appearances stay correct.
const viewports = [
  '.reader-content', '.section-detail-content', '.saved-column-scroll', '.saved-content',
  '.analysis-content', '.assistant-materials', '.projects-content', '.project-detail-content',
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
const editorPopups = '.report-editor-controls details[open], .report-format-link-form:not([hidden]), .notebook-format-toolbar details[open], .notebook-format-style-menu, .notebook-format-link-form, .notebook-note-menu[open], .report-draft-version-list[open]';

export function scrollFadeEdges({scrollTop, scrollHeight, clientHeight}) {
  const overflow = clientHeight > 0 && scrollHeight - clientHeight > 2;
  // Scroll offsets may be fractional at browser zoom levels while the heights
  // are rounded. A two-pixel tolerance keeps the actual end fully visible.
  return {top: overflow && scrollTop > 2, bottom: overflow && scrollHeight - clientHeight - scrollTop > 2};
}

export function installScrollEdgeFades() {
  const tracked = new Set();
  let frame = 0, discover = true;
  const schedule = (rescan = false) => {
    discover ||= rescan;
    if (!frame) frame = requestAnimationFrame(update);
  };
  const resize = new ResizeObserver(() => schedule());
  function update() {
    frame = 0;
    if (discover) {
      discover = false;
      for (const element of document.querySelectorAll(viewports)) {
        if (!tracked.has(element)) {tracked.add(element); resize.observe(element);}
      }
    }
    // Read layout before writing masks, including when a column is resized or
    // a sticky editing toolbar reaches the top of its scrolling viewport.
    const states = [];
    for (const element of tracked) {
      if (!element.isConnected) {tracked.delete(element); resize.unobserve(element); continue;}
      const {top, bottom} = scrollFadeEdges(element);
      const scrolls = ['auto','scroll'].includes(getComputedStyle(element).overflowY);
      // A menu opened from a pinned tool must stay fully legible where it
      // extends over the content edge. Its own scroll viewport can still fade.
      const popupOpen = [...element.querySelectorAll(editorPopups)].some(popup => popup.getClientRects().length > 0);
      // Reader and Settings already fade beneath their fixed/sticky headers.
      const existingTopFade = element.matches('.reader-content, .settings-account-column');
      let header = 0;
      if (scrolls && top && !existingTopFade) {
        const bounds = element.getBoundingClientRect();
        for (const candidate of element.querySelectorAll(stickyHeaders)) {
          const box = candidate.getBoundingClientRect();
          if (getComputedStyle(candidate).position === 'sticky' && box.top <= bounds.top + 1 && box.bottom > bounds.top) {
            header = Math.max(header, box.bottom - bounds.top);
          }
        }
      }
      states.push({element, top: scrolls && top && !existingTopFade && !popupOpen, bottom: scrolls && bottom && !popupOpen, header});
    }
    for (const {element,top,bottom,header} of states) {
      element.toggleAttribute('data-scroll-fade', top || bottom);
      element.style.setProperty('--scroll-fade-top-size', top ? '24px' : '0px');
      element.style.setProperty('--scroll-fade-top-alpha', top ? '0' : '1');
      element.style.setProperty('--scroll-fade-bottom-size', bottom ? '24px' : '0px');
      element.style.setProperty('--scroll-fade-bottom-alpha', bottom ? '0' : '1');
      element.style.setProperty('--scroll-fade-header', `${header}px`);
    }
  }
  const mutation = new MutationObserver(records => schedule(records.some(record => record.type !== 'characterData')));
  mutation.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['class','hidden','open']});
  const onScroll = () => schedule();
  const onResize = () => schedule(true);
  document.addEventListener('scroll', onScroll, {capture:true, passive:true});
  document.addEventListener('load', onResize, true);
  document.fonts?.addEventListener('loadingdone', onResize);
  window.addEventListener('resize', onResize, {passive:true});
  schedule(true);
  return () => {
    cancelAnimationFrame(frame); mutation.disconnect(); resize.disconnect();
    document.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onResize);
    document.removeEventListener('load', onResize, true); document.fonts?.removeEventListener('loadingdone', onResize);
    for (const element of tracked) element.removeAttribute('data-scroll-fade');
    tracked.clear();
  };
}
