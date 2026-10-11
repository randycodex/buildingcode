// Shared, serializable workflow data. Checklists are research tasks, never facts.
export const recordStatuses = ['needed', 'requested', 'received', 'reviewed', 'not-applicable'];
export function normalizeRecordsChecklist(value = []) {
  if (!Array.isArray(value) || value.length > 50) throw new Error('Use no more than 50 records checklist items.');
  const seen = new Set();
  return value.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 100 || seen.has(item.id) ||
        typeof item.label !== 'string' || !item.label.trim() || item.label.length > 300 ||
        !recordStatuses.includes(item.status) || typeof (item.note ?? '') !== 'string' || (item.note || '').length > 2000) {
      throw new Error('A records checklist item is invalid.');
    }
    seen.add(item.id);
    return {id:item.id, label:item.label.trim(), status:item.status, note:(item.note || '').trim()};
  });
}
export const suggestedRecords = [
  'Certificate of Occupancy or lawful occupancy record',
  'Approved plans and amendments',
  'Permit and application history',
  'Survey and zoning lot records',
  'Field measurements and photographs'
];
export function appendFindingTemplate(document, makeID) {
  const next = structuredClone(document || {schemaVersion:1, document:[]});
  next.document ||= [];
  for (const title of ['Conclusion', 'Supporting evidence', 'Uncertainty', 'Next action']) {
    next.document.push({id:makeID(), type:'heading', props:{level:2}, content:[{type:'text',text:title,styles:{}}],children:[]});
    next.document.push({id:makeID(),type:'paragraph',props:{},content:[],children:[]});
  }
  return next;
}
export function reportCommentKey(note) { return String(note.blockID || '') || 'section'; }
export function selectedReportEvidenceItems(block, items) {
  const excluded = new Set(block.excludedCommentKeys || []);
  return items.filter(item => !item.reportCommentKey || !excluded.has(item.reportCommentKey));
}
export function reportsContainingSource(drafts, kind, sourceID) {
  return drafts.filter(draft => (draft.blocks || []).some(block =>
    (block.kind === kind && block.sourceID === sourceID) ||
    (kind === 'notebookCard' && block.derivedFrom?.kind === kind && block.derivedFrom.id === sourceID)));
}

// A whole section already contains each of its passages. Comments are unioned
// independently so excluding one copy never discards another selected comment.
export function reportEvidenceCoverage(blocks, sources) {
  const byKey = new Map(sources.map(source => [`${source.kind}:${source.id}`, source]));
  const identity = source => JSON.stringify([source.sectionID, source.sourceLibraryVersion]);
  const whole = new Set(blocks.filter(block => block.kind === 'evidence')
    .map(block => byKey.get(`evidence:${block.sourceID}`))
    .filter(source => source && !source.selectionBlockID).map(identity));
  return new Set(blocks.filter(block => {
    const source = byKey.get(`evidence:${block.sourceID}`);
    return block.kind === 'evidence' && source?.selectionBlockID && whole.has(identity(source));
  }).map(block => block.id));
}
export function uniqueReportItems(blocks, sources, renderBlock) {
  const covered = reportEvidenceCoverage(blocks, sources);
  const byKey = new Map(sources.map(source => [`${source.kind}:${source.id}`, source]));
  const seen = new Set();
  return blocks.flatMap(block => renderBlock(block).filter(item => {
    if (item.kind === 'evidence' && covered.has(block.id)) return false;
    if (!item.reportCommentKey) return true;
    const source = byKey.get(`evidence:${block.sourceID}`);
    const key = JSON.stringify([source?.sectionID, source?.sourceLibraryVersion,
      item.reportCommentKey, item.kind, item.text]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }));
}
