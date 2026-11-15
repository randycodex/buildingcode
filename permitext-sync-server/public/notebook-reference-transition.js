// Retain the live outgoing reference until its replacement is painted. The
// writing column never participates in the transition or gets snapshotted.
export function createNotebookReferenceTransition({host, panes, context, reducedMotion}) {
  let pending = null;
  const kind = pane => /^reader:/.test(pane.dataset.paneId) ? 'reader'
    : /^utility:saved(?::|$)/.test(pane.dataset.paneId) ? 'evidence' : '';
  const visible = pane => !pane.classList.contains('is-workflow-hidden') && !pane.classList.contains('is-group-hidden');
  const cancel = () => {
    const previous = pending;
    pending = null;
    if (!previous) return;
    previous.animation?.cancel();
    delete previous.pane.dataset.notebookReferenceCover;
    for (const name of ['--notebook-reference-left', '--notebook-reference-width']) previous.pane.style.removeProperty(name);
    previous.pane.inert = previous.inert;
  };
  return {
    begin(target) {
      const outgoing = pending?.pane?.isConnected ? pending.pane
        : panes().find(pane => visible(pane) && kind(pane) && kind(pane) !== target && !pane.dataset.workspacePaneLoading);
      cancel();
      if (!outgoing || kind(outgoing) === target) return;
      const bounds = outgoing.getBoundingClientRect();
      const left = bounds.left - host.getBoundingClientRect().left + host.scrollLeft;
      outgoing.style.setProperty('--notebook-reference-left', `${left}px`);
      outgoing.style.setProperty('--notebook-reference-width', `${bounds.width}px`);
      pending = {pane:outgoing, target, context:context(), inert:outgoing.inert};
      outgoing.dataset.notebookReferenceCover = 'true';
      outgoing.inert = true;
    },
    sync() {
      const current = pending;
      if (!current) return;
      if (current.context !== context() || !current.pane.isConnected) { cancel(); return; }
      const incoming = panes().find(pane => visible(pane) && kind(pane) === current.target);
      if (!incoming || incoming.dataset.workspacePaneUnavailable === 'true') { cancel(); return; }
      const bounds = incoming.getBoundingClientRect();
      current.pane.style.setProperty('--notebook-reference-left', `${bounds.left - host.getBoundingClientRect().left + host.scrollLeft}px`);
      current.pane.style.setProperty('--notebook-reference-width', `${bounds.width}px`);
      if (incoming.dataset.workspacePaneLoading || incoming.dataset.readerTabPending || current.animation) return;
      if (reducedMotion() || typeof current.pane.animate !== 'function') { cancel(); return; }
      // Reveal the ready replacement without fading any text or moving the
      // shared slot, Notes list, title, toolbar or writing page.
      current.animation = current.pane.animate([
        {clipPath:'inset(0 0 0 0)'}, {clipPath:'inset(0 100% 0 0)'}
      ], {duration:80, easing:'cubic-bezier(.2, 0, 0, 1)', fill:'forwards'});
      current.animation.finished.then(() => { if (pending === current) cancel(); },
        () => { if (pending === current) cancel(); });
    },
    cancel
  };
}
