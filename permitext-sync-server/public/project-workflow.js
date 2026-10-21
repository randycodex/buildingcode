export function normalizeProjectQuestions(value = []) {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Use no more than 100 Project questions.');
  const seen = new Set();
  return value.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 100 || seen.has(item.id) ||
        typeof item.question !== 'string' || item.question.length > 2000 ||
        typeof item.answer !== 'string' || item.answer.length > 8000) throw new Error('A Project question is invalid.');
    seen.add(item.id);
    return {id: item.id, question: item.question, answer: item.answer};
  });
}

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
  const byKey = new Map(sources.map(source => [`${source.kind}:${source.id}`, source]));
  const sourceFor = block => byKey.get(`evidence:${block.sourceID}`);
  const sourceIdentity = source => JSON.stringify([source.sectionID, source.sourceLibraryVersion]);
  const wholeSections = new Map();
  for (const block of blocks) {
    const source = sourceFor(block);
    if (block.kind === 'evidence' && source && !source.selectionBlockID && !wholeSections.has(sourceIdentity(source))) {
      wholeSections.set(sourceIdentity(source), block);
    }
  }
  const groups = new Map(), owners = new Map();
  for (const block of blocks) {
    const source = sourceFor(block);
    if (block.kind !== 'evidence' || !source) continue;
    const identity = sourceIdentity(source);
    const whole = wholeSections.get(identity);
    const key = JSON.stringify([identity, whole ? '' : source.selectionBlockID]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(block);
    owners.set(block.id, whole || groups.get(key)[0]);
  }
  // Resolve every block, including covered passages, so unavailable sources
  // still fail explicitly and each independently selected comment is retained.
  const rendered = new Map(blocks.map(block => [block.id, renderBlock(block).map(item =>
    block.sourceFormatting?.length ? {...item,sourceFormatting:structuredClone(block.sourceFormatting)} : item)]));
  const groupsByOwner = new Map([...groups.values()].map(group => [owners.get(group[0].id).id, group]));
  return blocks.flatMap(block => {
    const owner = owners.get(block.id);
    if (!owner) return rendered.get(block.id);
    if (owner.id !== block.id) return [];
    const seen = new Map();
    const group = groupsByOwner.get(block.id);
    const comments = group.flatMap(member => rendered.get(member.id).filter(item => {
      if (!item.reportCommentKey) return false;
      const key = JSON.stringify([item.reportCommentKey, item.kind, item.text]);
      if (seen.has(key)) {
        const kept = seen.get(key);
        if (item.sourceFormatting?.length) kept.sourceFormatting = [...(kept.sourceFormatting || []),...item.sourceFormatting];
        return false;
      }
      seen.set(key,item); return true;
    }));
    // Keep comments beside their source even if a selected passage appeared
    // earlier in the draft than the whole section that now contains it.
    const formatting = group.flatMap(member=>member.sourceFormatting || []);
    return [...rendered.get(block.id).filter(item => !item.reportCommentKey).map(item =>
      formatting.length ? {...item,sourceFormatting:structuredClone(formatting)} : item), ...comments];
  });
}

// Use the export's ownership and union rules for the document's visible comments.
export function reportCommentPresentation(blocks, sources) {
  const byKey = new Map(sources.map(source => [`${source.kind}:${source.id}`, source]));
  const items = uniqueReportItems(blocks, sources, block => {
    const source = byKey.get(`${block.kind}:${block.sourceID}`);
    return [{ kind: 'comment-owner', blockID: block.id }, ...selectedReportEvidenceItems(block,
      block.kind === 'evidence' ? (source?.notes || []).map(note => ({
        kind: 'paragraph', reportCommentKey: reportCommentKey(note), text: note.body
      })) : [])];
  });
  const result = new Map();
  let owner = null;
  for (const item of items) {
    if (item.kind === 'comment-owner') { owner = item.blockID; result.set(owner, []); }
    else if (owner && item.reportCommentKey) result.get(owner).push(item);
  }
  return result;
}
