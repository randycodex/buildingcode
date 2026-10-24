import {reportBlockRuns, reportRunsText} from './report-rich-text.js';

export function reportNoteSnapshotText(block) {
  return reportRunsText(reportBlockRuns(block));
}

export function reportNoteSourceChanged(block, source) {
  const version = Number(block.derivedFrom?.version);
  return Boolean(source && Number.isSafeInteger(version) && version > 0 && Number(source.version) > version);
}

// Capture both versions before the asynchronous review. Never replace a paragraph
// that changed, disappeared, or moved to another account/project during review.
export async function reviewReportNoteSnapshot(block, {loadNote, confirm, isCurrent}) {
  const before = JSON.stringify(block);
  const current = () => isCurrent() && JSON.stringify(block) === before;
  const card = await loadNote(block.derivedFrom.id);
  if (!current()) return null;
  if (!card || card.id !== block.derivedFrom.id) throw new Error('The source Note is unavailable.');
  if ((card.plainText || '').length > 20000) throw new Error('This Note is too long for one Report paragraph. Keep the linked source or split the Note before updating this paragraph.');
  const accepted = await confirm({block: structuredClone(block), card});
  return accepted && current() ? card : null;
}

export function createReportNoteComparison(block, card, doc = document) {
  const comparison = doc.createElement('div');
  comparison.className = 'report-note-comparison';
  for (const [heading, version, text] of [
    ['Current Report text', `Snapshot of Note version ${block.derivedFrom.version || 'unknown'}`, reportNoteSnapshotText(block)],
    ['Latest Note', `${card.title || 'Untitled Note'} · version ${card.version}`, card.plainText || '']
  ]) {
    const side = doc.createElement('section');
    const title = doc.createElement('h3'); title.textContent = heading;
    const detail = doc.createElement('p'); detail.className = 'report-note-comparison-version'; detail.textContent = version;
    const body = doc.createElement('div'); body.className = 'report-note-comparison-text'; body.textContent = text || '(Empty)';
    side.append(title, detail, body); comparison.append(side);
  }
  return comparison;
}
