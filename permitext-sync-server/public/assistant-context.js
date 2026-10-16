// User-provided design context stays separate from saved existing-site records.
// Research scopes adapted from NYC DOB Project Guidelines, reviewed 2026-10-15.
// These labels do not determine DOB NOW job type, CO requirements, or code applicability.
export const assistantWorkTypes = ['Unspecified', 'New building', 'Alteration', 'Renovation / repair',
  'Enlargement / addition', 'Change of use or occupancy', 'Building systems work',
  'Construction equipment', 'Full demolition', 'Other'];
const workTypeAliases = new Map([
  ['New construction', 'New building'], ['Addition', 'Enlargement / addition'],
  ['Change of use', 'Change of use or occupancy']
]);
// Display equivalent legacy wording without rewriting saved conversation facts.
export function assistantWorkTypeForMenu(value) { return workTypeAliases.get(value) || value; }
const compact = value => String(value || '').replace(/\s+/g, ' ').trim();
export function assistantWorkContext(facts = []) {
  const workIndex = facts.findIndex(fact => /^Proposed work:\s*/i.test(fact));
  const usesIndex = facts.findIndex(fact => /^Proposed uses:\s*/i.test(fact));
  return {
    workType: workIndex >= 0 ? facts[workIndex].replace(/^Proposed work:\s*/i, '') : 'Unspecified',
    uses: usesIndex >= 0 ? facts[usesIndex].replace(/^Proposed uses:\s*/i, '') : '',
    additionalFacts: facts.filter((_, index) => index !== workIndex && index !== usesIndex).join('\n')
  };
}
export function assistantWorkFacts(value = {}) {
  const facts = [
    ...(value.workType && value.workType !== 'Unspecified' ? [`Proposed work: ${compact(value.workType)}`] : []),
    ...(compact(value.uses) ? [`Proposed uses: ${compact(value.uses)}`] : []),
    ...String(value.additionalFacts || '').split(/\n+/).map(compact).filter(Boolean)
  ];
  if (facts.length > 20 || facts.some(fact => fact.length > 500)) throw new Error('Use up to 20 facts, with no more than 500 characters per fact.');
  if (new Set(facts).size !== facts.length) throw new Error('Remove duplicate facts before saving.');
  return facts;
}
export function normalizeAssistantViews(value) {
  return Object.fromEntries(Object.entries(value && typeof value === 'object' ? value : {}).filter(([id]) => id).slice(0, 100).map(([id, view]) => [id, {
    tab: ['', 'project', 'work', 'basis', 'sources', 'settings'].includes(view?.tab) ? view.tab : 'project',
    splitRatio: typeof view?.splitRatio === 'number' && Number.isFinite(view.splitRatio) ? Math.min(0.8, Math.max(0.2, view.splitRatio)) : 0.45,
    draft: { projectID: String(view?.draft?.projectID || '').slice(0, 200),
      workType: typeof view?.draft?.workType === 'string' && compact(view.draft.workType) ? compact(view.draft.workType).slice(0, 480) : 'Unspecified',
      uses: String(view?.draft?.uses || '').slice(0, 480), additionalFacts: String(view?.draft?.additionalFacts || '').slice(0, 10_000) }
  }]));
}

export function assistantDraftForConversation(conversation, projectID) {
  const empty = {projectID, workType:'Unspecified', uses:'', additionalFacts:''};
  if (!conversation || conversation.projectContextReviewRequired || conversation.primaryProjectID !== projectID ||
      (conversation.projectContext?.projectID && conversation.projectContext.projectID !== projectID)) return empty;
  return {projectID, ...assistantWorkContext(conversation.projectContext?.facts || [])};
}
