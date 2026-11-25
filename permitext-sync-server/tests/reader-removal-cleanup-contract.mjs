import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  const end = source.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
let cleanupCalls = 0, cancelledRestores = 0, releasedAccess = 0;
function panel(id) {
  const controller = new AbortController(), search = new AbortController(), progressive = new AbortController();
  const content = { querySelectorAll: () => [], _readerProgressiveCleanup() { cleanupCalls++; progressive.abort(); } };
  return { id, dataset: { readerNavigationToken: 'original', readerRenderToken: 'original', readerSearchToken: 'original' },
    _readerNavigationAbort: controller, _readerSearchAbort: search, progressive, content,
    querySelector: () => content };
}
const retained = panel('retained-hidden-workflow'), removed = panel('closed'), sameIDReplacement = panel('closed');
const c = vm.createContext({
  crypto: { randomUUID }, localWelcomePreviewPending: false, firstUseWelcomeActive: false,
  closeActiveCustomSelect() {}, orderPanes: value => value,
  reportScreen: null,
  track: { querySelectorAll: selector => selector.includes('reader-panel') ? [retained, removed] : [] },
  cancelSearchPanelRequest() {},
  cancelReaderInternalSearch(panel) { panel._readerSearchAbort.abort(); },
  cancelReaderScrollRestore() { cancelledRestores++; },
  disposeWorkspaceNodeAccess() { releasedAccess++; }
});
vm.runInContext(['cancelReaderSectionAlignment', 'stopReaderProgressiveHydration', 'cancelReaderPanelRequests'].map(actual).join('\n'), c);
// Execute the actual removed-pane phase of appendPaneSequence. Subsequent layout
// cannot change whether asynchronous work for an omitted panel is cancelled.
const append = actual('appendPaneSequence');
const cleanupPhase = append.slice(0, append.indexOf('  const activeIDs =')) + '\n}';
vm.runInContext(cleanupPhase, c);
c.appendPaneSequence([retained, sameIDReplacement]);
assert.equal(removed._readerNavigationAbort.signal.aborted, true);
assert.equal(removed._readerSearchAbort.signal.aborted, true);
assert.equal(removed.progressive.signal.aborted, true);
assert.equal(removed.content._readerProgressiveCleanup, undefined);
assert.notEqual(removed.dataset.readerNavigationToken, 'original');
assert.notEqual(removed.dataset.readerRenderToken, 'original', 'A late body response cannot satisfy its old render token');
assert.notEqual(removed.dataset.readerSearchToken, 'original');
for (const pane of [retained, sameIDReplacement]) {
  assert.equal(pane._readerNavigationAbort.signal.aborted, false, 'Retained or replacement panes keep their independent work');
  assert.equal(pane.progressive.signal.aborted, false);
}
assert.equal(cleanupCalls, 1); assert.equal(cancelledRestores, 1); assert.equal(releasedAccess, 1);
c.cancelReaderPanelRequests(removed);
assert.equal(cleanupCalls, 1, 'A repeated disposal cannot run progressive teardown twice');
assert.match(actual('disposeUnpublishedWorkspacePane'), /cancelReaderPanelRequests\(pane\)/, 'Late unpublished Readers use the same immediate teardown');
console.log('Reader removal passed: immediate navigation/search/progressive abort, render-token invalidation, scroll/access cleanup, retained workflow panes, same-ID replacement isolation and idempotent progressive teardown.');

// Execute the actual close handler: cleanup and removal precede persistence or
// pane reconciliation, and closing cannot construct another loading chapter.
assert.match(actual('renderReader'), /closeButton\.addEventListener\("click", \(\) => void closeWorkspaceReader/);
const order=[];
const owner='utility:search:list';
const closed={id:'closed',sourceOwnerPaneID:owner},neighbor={id:'neighbor',referenceSourceReaderID:'closed'};
const closing=vm.createContext({
 panel:{contains:()=>false,remove(){order.push('remove');}},
 state:{readers:[closed,neighbor],searchLinkedReaders:{search:'closed'},paneOrder:[owner,'reader:closed','reader:neighbor'],paneWeights:{[owner]:710,'reader:closed':630}},
 currentColumnWorkflowView:()=> 'research', activeWorkspaceID:'test', document:{activeElement:null},
 captureAccountRequest:()=>1,isCurrentAccountRequest:()=>true,
 track:{_researchColumnLayout:{},querySelector:()=>null},CSS:{escape:value=>value},capturePaneResizeWidths(){order.push('preserve-width');},
 scrollPaneIntoView(id){assert.equal(id,owner);order.push('reveal-list');},
 cancelReaderPanelRequests(){order.push('cancel');},searchLinkedReadersBySearch(){return closing.state.searchLinkedReaders;},
 transitionWorkspace(mode,opts){assert.equal(mode,'utility');assert.equal(opts.deferStateSave,true);order.push('reconcile');}
});
vm.runInContext(['paneIDForReader','sourceResultReaderOwner','removeWorkspaceReader','closeWorkspaceReader'].map(actual).join('\n'),closing);
await closing.closeWorkspaceReader(closed,closing.panel);
assert.deepEqual(order,['preserve-width','cancel','remove','reconcile','reveal-list']);
assert.equal(closing.state.readers.length,1);assert.equal(neighbor.referenceSourceReaderID,'');
assert.equal(closing.state.searchLinkedReaders.search,undefined);
assert.deepEqual(closing.state.paneWeights,{[owner]:710});
