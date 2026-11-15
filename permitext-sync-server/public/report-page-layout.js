import {renderReportPDF} from './report-pdf-preview.js?v=20261115-page-layout-v5';

// Render the same PDF bytes as export. Keep the last complete preview visible
// until a replacement is ready, and discard responses for superseded drafts.
export function createReportPageLayout({host, prepare, isCurrent, onPages = () => {}, renderPDF = renderReportPDF,
  setTimer = setTimeout, clearTimer = clearTimeout}) {
  const status = document.createElement('p');
  status.className = 'report-page-layout-status'; status.setAttribute('role', 'status');
  const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry pages'; retry.hidden = true;
  host.append(status, retry);
  let active = false, stopped = false, stale = true, generation = 0, timer = null;
  let committed = null, disposeCommitted = () => {};
  const paintScrollEdge = () => {
    const firstPage = committed?.querySelector('.report-pdf-page');
    host.classList.toggle('is-pages-scrolled', Boolean(firstPage && committed.scrollTop > firstPage.offsetTop + 2));
  };
  const current = revision => !stopped && active && isCurrent() && revision === generation;
  const cancelTimer = () => {clearTimer(timer); timer = null;};
  const refresh = async () => {
    cancelTimer();
    if (!active || stopped || !isCurrent()) return false;
    const revision = ++generation;
    let staging, disposeStaging;
    status.textContent = committed ? 'Updating pages…' : 'Preparing pages…';
    status.setAttribute('role', 'status'); retry.hidden = true;
    try {
      const prepared = await prepare();
      const blob = prepared?.blob || prepared;
      if (!current(revision)) return false;
      staging = document.createElement('div'); staging.className = 'report-page-layout-pages is-staging';
      staging.tabIndex = 0; staging.setAttribute('role', 'region');
      staging.setAttribute('aria-label', 'Report pages'); staging.setAttribute('aria-hidden', 'true'); host.append(staging);
      disposeStaging = await renderPDF(staging, blob, () => current(revision), {eagerFirstPage: true});
      if (!current(revision)) {disposeStaging(); staging.remove(); return false;}
      const scroll = committed?.scrollTop || 0;
      disposeCommitted(); committed?.remove();
      committed = staging; disposeCommitted = disposeStaging;
      staging.classList.remove('is-staging'); staging.setAttribute('aria-hidden', 'false'); staging.scrollTop = scroll;
      staging.addEventListener('scroll', paintScrollEdge, {passive:true});
      paintScrollEdge();
      onPages({container:staging,layout:prepared?.layout});
      stale = false;
      status.textContent = `${staging.querySelectorAll('.report-pdf-page').length} pages`;
      return true;
    } catch (error) {
      disposeStaging?.(); staging?.remove();
      if (current(revision)) {
        stale = true; status.setAttribute('role', 'alert'); retry.hidden = false;
        status.textContent = `${committed ? 'Pages need updating. ' : ''}${error.message || 'Pages could not be prepared.'}`;
      }
      return false;
    }
  };
  retry.addEventListener('click', () => {void refresh();});
  return {
    refresh,
    capturePosition() {return committed?.scrollTop || 0;},
    restorePosition(top) {if(committed) {committed.scrollTop=top; paintScrollEdge();}},
    setActive(value) {
      if (active === value) return;
      active = value;
      if (active && stale) void refresh();
      if (!active) {cancelTimer(); generation += 1; stale = true;}
    },
    invalidate() {
      stale = true; generation += 1; cancelTimer();
      if (active && !stopped) {
        status.textContent = committed ? 'Updating pages…' : 'Preparing pages…';
        status.setAttribute('role', 'status'); retry.hidden = true;
        timer = setTimer(() => {void refresh();}, 400);
      }
    },
    dispose() {stopped = true; generation += 1; cancelTimer(); disposeCommitted(); host.replaceChildren(); host.classList.toggle('is-pages-scrolled',false);}
  };
}
