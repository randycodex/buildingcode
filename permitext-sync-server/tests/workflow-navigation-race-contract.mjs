import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
const tick = () => new Promise(resolve => setImmediate(resolve));
// Exercise the application functions across delayed source resolution, existing
// conversation loading, and creating a Research conversation from a passage.
for (const name of ['openSavedItemInReader', 'openResearchConversation', 'startNewResearchFromSelection']) {
  for (const instance of name === 'openResearchConversation' ? [false, true] : [false]) {
    let finish;
    const gate = new Promise(resolve => {finish = resolve;});
    const calls = [];
    const c = vm.createContext({
      state: {utilityInstances: [], workflowNavigationGeneration: 0},
      activeWorkspaceID: 'a', captureAccountRequest: () => 1, isCurrentAccountRequest: () => true,
      savedItemOpeningAttempts: new Map(), resolveReaderSource: () => gate,
      activeAccount: () => ({userID:'test',sessionToken:'local'}), hasCapability: () => true,
      activeProjectIDForCodeQuestions: () => 'project', postResearch: () => gate,
      fetchAuthoritativeResearchConversation: () => gate,
      researchDraftPaneIDs: new Set(), paneIDForUtilityInstance: i => i.id,
      researchOpenGeneration: 0, researchConversationOpeningAttempts: new Map(), track: {querySelector: () => null},
      newUtilityInstance: () => {calls.push('created');return {};},
      activeResearchConversation: null,
      refreshResearchConversationList: () => {calls.push('refresh');},
      scrollPaneIntoView: () => calls.push('scroll'),
      window: {getSelection: () => ({removeAllRanges: () => calls.push('selection')})}
    });
    vm.runInContext(actual(name), c);
    const pending = name === 'openSavedItemInReader' ? c[name]({sectionID:'42'}, 'saved') :
      name === 'openResearchConversation' ? c[name]('chat',instance ? {instance:{id:'analysis'}} : {}) :
      c[name]({sectionID:'42',selectedText:'Selected passage',originPaneID:'reader'});
    await tick();
    // Two transitions also cover returning to the same named view before load.
    c.state.workflowNavigationGeneration = 2;
    finish(name === 'startNewResearchFromSelection' ? {conversation:{id:'created-chat'}} : {id:'chat',sectionID:'42'});
    await pending;
    assert.deepEqual(calls, [], `${name} must not affect the view selected while loading`);
    assert.equal(c.activeResearchConversation, null);
    assert.equal(c.state.utilityInstances.length, 0);
    assert.equal(c.savedItemOpeningAttempts.size, 0);
  }
}
console.log('Delayed Evidence and Research actions leave a subsequently selected view untouched.');
