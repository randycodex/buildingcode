export function createNotebookReaderEvidence(card, onOpen) {
  const links = card?.evidenceLinks || [];
  if (!links.length) return null;
  const panel = document.createElement('details'); panel.className = 'notebook-reader-evidence';
  const summary = document.createElement('summary'); summary.textContent = `Reader evidence · ${links.length} ${links.length === 1 ? 'source' : 'sources'}`;
  const body = document.createElement('div'); body.className = 'notebook-reader-evidence-body';
  const note = document.createElement('p'); note.className = 'notebook-evidence-caption';
  note.textContent = 'Saved passage snapshots. Open the exact edition in Reader to review their context.';
  body.append(note);
  for (const link of links) {
    const item = document.createElement('article');
    const heading = document.createElement('strong'); heading.textContent = link.label || `${link.source.codePrefix} § ${link.source.sectionNumber}`;
    const role = document.createElement('p'); role.className = 'notebook-evidence-caption';
    role.textContent = `${link.source.codeEdition} · ${link.relationshipRole || 'context'}`;
    item.append(heading, role);
    for (const passage of link.passages || []) {
      const text = String(passage.exact || '');
      const quote = document.createElement('blockquote');
      quote.textContent = text.length > 600 ? `${text.slice(0, 450).trimEnd()}…` : text;
      item.append(quote);
      if (text.length > 600) {
        const full = document.createElement('details');
        const label = document.createElement('summary'); label.textContent = 'Full captured text';
        const fullQuote = document.createElement('blockquote'); fullQuote.textContent = text;
        full.append(label, fullQuote); item.append(full);
      }
    }
    const open = document.createElement('button'); open.type = 'button'; open.className = 'notebook-secondary-action'; open.textContent = 'Open passage in Reader';
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    open.addEventListener('click', async () => {
      open.disabled = true;
      try {await onOpen(link);} catch (error) {status.textContent = error.message;}
      finally {open.disabled = false;}
    });
    item.append(open, status); body.append(item);
  }
  panel.append(summary, body);
  return panel;
}
