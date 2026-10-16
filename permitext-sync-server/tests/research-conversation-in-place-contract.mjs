import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
function classes(...values) {
  const set = new Set(values);
  return { add: (...names) => names.forEach(name => set.add(name)),
    remove: (...names) => names.forEach(name => set.delete(name)),
    toggle(name, on) { if (on) set.add(name); else set.delete(name); }, contains: name => set.has(name) };
}
function fixture(primary = false) {
  let identity = 'account-a';
  const instance = { id: 'one', key: 'analysis', projectID: 'project', conversationID: 'next' };
  const state = { utilityInstances: [instance], researchConversationID: 'next', workflowNavigationGeneration: 0 };
  const previous = { conversationID: 'old' }, body = { children: [previous], swaps: 0,
    replaceChildren(node) { this.children = [node]; this.swaps += 1; } };
  const history = { scrollTop: 160, filter: 'project', cursor: 'older-page' };
  const rows = ['old', 'next'].map(id => {
    const attributes = new Map(id === 'old' ? [['aria-current', 'true']] : []);
    const button = { attributes, setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key) };
    return { dataset: { conversationId: id }, classList: classes(...(id === 'old' ? ['is-active'] : [])),
      querySelector: () => button, button };
  });
  const pending = [], sidebarContexts = [];
  const panel = { isConnected: true, dataset: {}, classList: classes('is-new-research-chat', 'has-research-composer', 'is-history-only'),
    querySelector: () => body, querySelectorAll: () => rows, history, _assistantSidebarUpdate: value => sidebarContexts.push(value) };
  const track = { querySelector: () => panel }; panel.parentNode = track;
  const context = vm.createContext({ state, track, CSS: { escape: value => value }, activeWorkspaceID: 'workspace',
    activeResearchConversation: {id:"next",projectContext:{facts:["Proposed work: New construction"]}},
    supplementalResearchConversations:new Map([["next",{id:"next",projectContext:{facts:["Proposed work: New construction"]}}],["newest",{id:"newest"}]]),
    researchDraftPaneIDs: new Set(), researchHistoryShowing: false, researchConversationPaneOpened: true,
    captureAccountRequest: () => identity, isCurrentAccountRequest: value => value === identity, hasCapability: () => true,
    applyPaneWeight() {}, notifyWorkspaceLayoutChange() {},
    renderResearchConversation: (id, options) => new Promise(resolve => pending.push({ id, options, resolve })) });
  vm.runInContext(actual('researchAssistantContentIdentity') + '\n' + actual('refreshResearchConversationInPlace'), context);
  const paneID = primary ? 'utility:analysis' : 'utility:analysis:one';
  return { context, state, instance, panel, body, rows, pending, previous, history, paneID, sidebarContexts,
    changeAccount() { identity = 'account-b'; },
    refresh(id = 'next') { return context.refreshResearchConversationInPlace(paneID, id, primary ? null : instance); } };
}

for (const primary of [false, true]) {
  const f = fixture(primary), opening = f.refresh();
  assert.equal(f.body.children[0], f.previous, 'The previous conversation remains visible while the replacement is built.');
  assert.equal(f.body.swaps, 0);
  assert.equal(f.pending[0].options.embedded, true);
  assert.equal(f.pending[0].options.supplemental, !primary);
  const next = { conversationID: 'next' }; f.pending[0].resolve(next);
  assert.equal(await opening, 'updated');
  assert.equal(f.body.children[0], next); assert.equal(f.body.swaps, 1);
  assert.equal(f.sidebarContexts[0].id,'next');
  assert.equal(f.sidebarContexts[0].projectContext.facts[0],'Proposed work: New construction','Context must update with the visible conversation');
  assert.equal(f.panel.history, f.history, 'The history rail retains its original DOM and state.');
  assert.deepEqual(f.history, { scrollTop: 160, filter: 'project', cursor: 'older-page' });
  assert.equal(f.rows[0].button.attributes.has('aria-current'), false);
  assert.equal(f.rows[1].button.attributes.get('aria-current'), 'true');
  assert.equal(f.rows[1].classList.contains('is-active'), true);
  assert.equal(f.panel.classList.contains('is-new-research-chat'), false);
  assert.equal(f.panel.classList.contains('has-inline-conversation'), true);
  assert.equal(f.panel.classList.contains('is-history-only'), false);
  assert.equal(f.body.hidden, false, 'Selecting a conversation reveals its message pane.');
  assert.equal(f.panel.dataset.workspacePaneIdentity, f.context.researchAssistantContentIdentity(primary ? null : f.instance),
    'Workspace reconciliation recognizes the retained Assistant as current.');
}
for (const invalidate of [
  f => f.changeAccount(), f => { f.context.activeWorkspaceID = 'other'; },
  f => { f.state.workflowNavigationGeneration += 1; }, f => { f.panel.isConnected = false; },
  f => { f.state.utilityInstances = []; }, f => f.context.researchDraftPaneIDs.add(f.paneID),
  f => { f.context.hasCapability = () => false; }
]) {
  const f = fixture(), opening = f.refresh(); invalidate(f); f.pending[0].resolve({ conversationID: 'next' });
  assert.equal(await opening, 'stale'); assert.equal(f.body.children[0], f.previous); assert.equal(f.sidebarContexts.length,0);
}
const f = fixture(), first = f.refresh();
f.instance.conversationID = 'newest'; const second = f.refresh('newest');
const newest = { conversationID: 'newest' }; f.pending[1].resolve(newest);
assert.equal(await second, 'updated'); f.pending[0].resolve({ conversationID: 'next' });
assert.equal(await first, 'stale'); assert.equal(f.body.children[0], newest); assert.equal(f.body.swaps, 1);
const missing = fixture(); missing.context.track.querySelector = () => null;
assert.equal(await missing.refresh(), 'unavailable'); assert.equal(missing.pending.length, 0);
console.log('Assistant body swaps are atomic; history, filter, scroll, selection, account/workspace guards and latest-request ordering remain intact.');
