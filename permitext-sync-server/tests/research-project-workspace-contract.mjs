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
assert.equal(context.researchCreationProjectID('project-a'), 'project-a');
assert.equal(context.researchCreationProjectID(), '');
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
assert(render.includes('visibleHistoryConversations().forEach((conversation) => selectedConversationIDs.add(conversation.id))'));
assert(!render.includes('researchConversationList.filter('), 'Bulk actions must use the scoped list.');
console.log('Web Research project scope passed: all creation origins, per-project history, unassigned isolation, scoped bulk actions, and workspace-switch race.');
