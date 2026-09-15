import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { captureWorkspaceLayout, applyWorkspaceLayout } from '../public/workspace-state.js';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const extract = name => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};
const context = vm.createContext({
  state: {}, restoredResearchViewState: undefined,
  researchDraftPaneIDs: new Set(), researchNewChatDrafts: new Map(),
  researchConversationPaneOpened: false, researchHistoryShowing: false,
  supplementalResearchConversationIDs: [], supplementalResearchConversations: new Map(),
  activeResearchConversation: null, researchQuestionDraft: '',
  submit() { throw new Error('Restoration must never send Research'); }
});
vm.runInContext(extract('restoreResearchWorkspaceState') + '\n' + extract('captureResearchWorkspaceState'), context);
const save = () => {
  context.captureResearchWorkspaceState();
  return JSON.parse(JSON.stringify(captureWorkspaceLayout(context.state)));
};
const open = snapshot => {
  applyWorkspaceLayout(context.state, snapshot);
  context.restoreResearchWorkspaceState();
};

context.state = {
  projectDetails: [{ id: 'project-a', name: 'A' }], utilities: { analysis: true },
  researchConversationID: 'conversation-a',
  utilityInstances: [{ id: 'second', key: 'analysis', conversationID: 'conversation-b', historyShowing: true }],
  paneOrder: ['utility:analysis:second', 'utility:analysis'],
  paneWeights: { 'utility:analysis': 700 },
  columnGroups: [{ id: 'group', name: 'Group', paneIDs: ['utility:analysis:second'], collapsed: true }]
};
context.researchConversationPaneOpened = true;
context.researchDraftPaneIDs.add('utility:analysis:second');
context.researchNewChatDrafts.set('utility:analysis:second', 'Unsent new question');
context.researchNewChatDrafts.set('followup:conversation-a', 'Unsent follow-up');
context.supplementalResearchConversationIDs.push('conversation-b', 'conversation-c');
const a = save();
open({ projectDetails: [{ id: 'project-b', name: 'B' }] });
assert.equal(context.researchNewChatDrafts.size, 0);
assert.equal(context.researchConversationPaneOpened, false);
assert.equal(context.supplementalResearchConversationIDs.length, 0);
context.researchNewChatDrafts.set('utility:analysis', 'B only');
context.researchHistoryShowing = true;
const b = save();
open(a);
assert.equal(context.state.projectDetails[0].id, 'project-a');
assert.equal(context.researchNewChatDrafts.get('utility:analysis:second'), 'Unsent new question');
assert.equal(context.researchNewChatDrafts.get('followup:conversation-a'), 'Unsent follow-up');
assert.equal(context.researchNewChatDrafts.has('utility:analysis'), false);
assert.equal(context.researchConversationPaneOpened, true);
assert.equal(context.state.researchConversationID, 'conversation-a');
assert.equal(context.state.utilityInstances[0].historyShowing, true);
assert.equal(context.state.columnGroups[0].collapsed, true);
assert.deepEqual(context.state.paneOrder, a.paneOrder);
assert.equal(context.state.paneWeights['utility:analysis'], 700);
assert.deepEqual([...context.supplementalResearchConversationIDs], ['conversation-b', 'conversation-c']);
open(b);
assert.equal(context.researchNewChatDrafts.get('utility:analysis'), 'B only');
assert.equal(context.researchHistoryShowing, true);
// The same restoration path serves a different signed-in account's empty layout.
open({});
assert.equal(context.researchNewChatDrafts.size, 0);
assert.equal(context.researchDraftPaneIDs.size, 0);
assert.equal(context.activeResearchConversation, null);
console.log('Research workspace continuity passed');

// Exercise the actual composer input handler and remount after a serialized reload.
const elements = [];
function element(tag) {
  const value = { tag, children: [], listeners: {}, style: {}, scrollHeight: 48,
    classList: { add() {} }, setAttribute() {},
    addEventListener(name, handler) { this.listeners[name] = handler; },
    append(...children) { this.children.push(...children); }, querySelector() { return null; }
  };
  elements.push(value);
  return value;
}
let writes = 0;
Object.assign(context, {
  document: { createElement: element }, workspaceProject: () => null,
  researchProjectContextPreview: () => element('preview'),
  researchComposerDisclosure: () => element('disclosure'),
  researchChatPlaceholder: 'Question', bindResearchSendShortcut() {},
  requestAnimationFrame: callback => callback(),
  saveWorkspaceState() { writes += 1; context.captureResearchWorkspaceState(); },
  paneIDForUtilityInstance: instance => `utility:analysis:${instance.id}`,
  postResearch() { throw new Error('Mounting/restoring must not submit a request'); }
});
vm.runInContext(extract('renderNewResearchComposer'), context);
context.renderNewResearchComposer(element('container'), true);
const input = elements.find(item => item.tag === 'textarea');
input.value = 'Keep this question without sending';
input.listeners.input();
assert.equal(writes, 1);
const typed = save();
open({});
open(typed);
elements.length = 0;
context.renderNewResearchComposer(element('container'), true);
assert.equal(elements.find(item => item.tag === 'textarea').value, input.value);
assert.equal(writes, 1, 'Restoration must not mutate or send the draft');
console.log('Research composer reload passed');
