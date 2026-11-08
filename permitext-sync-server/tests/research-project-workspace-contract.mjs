import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const extract = name => {
  const start = source.indexOf(`${name === 'postResearch' ? 'async ' : ''}function ${name}(`);
  assert(start >= 0);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};
let project = { id: 'project-a' };
const requests = [], synced = [];
const context = vm.createContext({
  workspaceProject: () => project, projectDetailKey: value => value.id,
  activeWorkspaceRecord: () => project ? { projectID: project.id } : null,
  activeWorkspaceID: 'workspace-a',
  researchV2Enabled: () => false, hasCapability: () => true, researchV2Rollout: {refresh: async () => ({available:false})},
  researchConversationList: [{ id: 'a', primaryProjectID: 'project-a' }, { id: 'b', primaryProjectID: 'project-b' }, { id: 'legacy', primaryProjectID: null }],
  activeAccount: () => ({ userID: 'owner', sessionToken: 'synthetic' }),
  captureAccountRequest: () => ({}), requireCurrentAccountRequest() {},
  researchHistoryPageReaders: new Map(),
  readResearchConversationList: {invalidate() {}}, refreshResearchUsage: {invalidate() {}},
  ensureResearchProjectSynced: async id => synced.push(id),
  postJSON: async (path, body) => { requests.push({ path, body }); return {}; },
  codeQuestionContextChangedError: () => Error('Workspace changed'), observeLocalProjectArtifactRevisions() {}
});
vm.runInContext(['researchWorkspaceProjectID','researchCreationProjectID','researchConversationInWorkspace','workspaceResearchConversations','postResearch'].map(extract).join('\n'), context);
const ids = () => Array.from(context.workspaceResearchConversations(), c => c.id);
assert.deepEqual(ids(), ['a']);
for (const originSurface of ['chat','reader','saved','evidenceDiscovery']) {
  await context.postResearch('/research/conversations/create', { originSurface, projectID: originSurface === 'reader' ? 'project-b' : '' });
  assert.equal(requests.at(-1).body.projectID, 'project-a');
}
assert.deepEqual(synced, ['project-a','project-a','project-a','project-a']);
project = { id: 'project-b' };
assert.deepEqual(ids(), ['b']);
assert.equal(context.researchConversationInWorkspace({ primaryProjectID: 'project-a' }), false);
project = null;
assert.deepEqual(ids(), ['legacy']);
assert.throws(() => context.researchCreationProjectID('project-a'), /Choose a Project/, 'A stale Reader or pane project must not create a conversation outside the active project.');
assert.throws(() => context.researchCreationProjectID(), /Choose a Project/);
const beforeUnassignedCreation = requests.length;
await assert.rejects(context.postResearch('/research/conversations/create', {}), /Choose a Project/);
assert.equal(requests.length, beforeUnassignedCreation, 'No unassigned conversation is dispatched.');
context.activeWorkspaceRecord = () => ({ projectID: 'loading-project' });
assert.deepEqual(ids(), [], 'A loading project must not expose unassigned history.');
assert.throws(() => context.researchCreationProjectID(), /still loading/);
project = { id: 'project-a' };
context.ensureResearchProjectSynced = async () => { context.activeWorkspaceID = 'workspace-b'; };
const count = requests.length;
await assert.rejects(context.postResearch('/research/conversations/create', {}), /Workspace changed/);
assert.equal(requests.length, count, 'Switching workspaces during sync must not create a chat.');
context.researchV2Enabled=()=>true;
await context.postResearch('/research/conversations/get',{conversationID:'retained-history'});
assert(!('analysisMode' in requests.at(-1).body),'Opening v2 history must be a read without scope conversion');
context.researchV2Enabled=()=>false;
await context.postResearch('/research/conversations/get',{conversationID:'legacy-history'});
assert.equal(requests.at(-1).body.analysisMode,'conversation_only','Original Research keeps its existing passage-only scope policy');

const render = source.slice(source.indexOf('async function renderResearch(paneID'), source.indexOf('function visualEvidenceDataURL'));
assert(render.includes('researchConversationHistoryGroups(visibleHistoryConversations())'));
assert(render.includes('historyManagement.setConversations(historyConversations)'));
assert(!render.includes('researchConversationList.filter('), 'Bulk actions must use the scoped list.');
console.log('Web Research project scope passed: all creation origins, per-project history, unassigned isolation, scoped bulk actions, and workspace-switch race.');

// Reader actions preserve their exact evidence while using the active workspace's
// Project, rather than an obsolete Project retained by a previously opened Reader.
project = {id:'project-a'};
context.activeWorkspaceRecord = () => project ? {projectID:project.id} : null;
const paragraph = {textContent:'Exact enacted passage.\nWith a qualification.'};
let rangedElement;
const range = {selectNodeContents(element){rangedElement=element;}};
context.document = {createRange:()=>range};
context.researchSelectionTextFromRange = (_text,selectionRange) => {
  assert.equal(selectionRange,range); return rangedElement.textContent;
};
context.normalizedPassageAnchorText = value => value.replace(/\s+/g,' ').trim();
vm.runInContext(extract('readerSectionResearchSelection'),context);
const wrapper = {dataset:{researchSectionId:'545',researchSectionNumber:'101.1',researchSectionTitle:'Scope',
  researchCodePrefix:'BC',researchSavedItemId:'saved-passage',researchCodeEdition:'2014',
  researchCodeVersion:'nyc-2014',researchSourceLibraryVersion:'library-2014'},
  closest:()=>({dataset:{paneId:'reader:historical',sourceProjectId:'obsolete-project'}})};
const selection = context.readerSectionResearchSelection(wrapper,paragraph);
assert.equal(rangedElement,paragraph);
assert.equal(selection.projectID,'project-a');
assert.equal(selection.originPaneID,'reader:historical');
assert.equal(selection.selectedText,paragraph.textContent);
assert.equal(selection.passages.length,1);
assert.equal(selection.passages[0].selectedText,paragraph.textContent);
assert.equal(selection.passages[0].codeVersion,'nyc-2014');
assert.equal(selection.passages[0].codeEdition,'2014');
assert.equal(selection.passages[0].sourceLibraryVersion,'library-2014');
assert.equal(selection.passages[0].savedItemID,'saved-passage');
assert.equal(selection.passages[0].start,0);
assert.equal(selection.passages[0].end,context.normalizedPassageAnchorText(paragraph.textContent).length);
project = {id:'project-b'};
assert.equal(context.readerSectionResearchSelection(wrapper,paragraph).projectID,'project-b');
project = null;
assert.throws(()=>context.readerSectionResearchSelection(wrapper,paragraph),/Choose a Project/);
assert.equal(context.readerSectionResearchSelection(null),undefined);
console.log('Reader Research selection passed: exact passage/edition identity, active workspace Project, retained origin and missing-Project guard.');
