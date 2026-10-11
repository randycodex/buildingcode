import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const actual = name => {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};
const context = vm.createContext({activeWorkspaceID:'project-a', pendingLinkedPanePlacements:new Map()});
vm.runInContext(['readerIsClearlyAvailable','requestLinkedPanePlacement','applyLinkedPanePlacements'].map(actual).join('\n'),context);
for (const origin of ['notebook','report','research','search','reader','evidence-detail']) {
  const original = ['evidence', origin, 'unrelated', 'destination'];
  context.requestLinkedPanePlacement(origin,'destination');
  // Descriptor reconciliation may run before the DOM commit; it must not consume placement.
  assert.deepEqual(Array.from(context.applyLinkedPanePlacements(original)), ['evidence',origin,'destination','unrelated']);
  assert.equal(context.pendingLinkedPanePlacements.size,1);
  assert.deepEqual(Array.from(context.applyLinkedPanePlacements(original,true)), ['evidence',origin,'destination','unrelated']);
  assert.equal(context.pendingLinkedPanePlacements.size,0);
  // Explicit user reordering after opening remains possible.
  assert.deepEqual(Array.from(context.applyLinkedPanePlacements(original)),original);
}
context.requestLinkedPanePlacement('note','reader');
assert.deepEqual(Array.from(context.applyLinkedPanePlacements(['note'],true)),['note']);
assert.equal(context.pendingLinkedPanePlacements.size,1,'wait for the destination to mount');
context.activeWorkspaceID='project-b';
context.applyLinkedPanePlacements(['note','reader'],true);
assert.equal(context.pendingLinkedPanePlacements.size,0,'discard placement from another workspace');
context.requestLinkedPanePlacement('note','note');
assert.equal(context.pendingLinkedPanePlacements.size,0);
assert.match(source,/openResearchConversation\(answer.conversationID, \{ anchorPaneID \}\)/);
assert.match(source,/applyLinkedPanePlacements\(pairSavedEvidenceDetails\(\[\.\.\.panesByID.keys\(\)\]\), true\)/);
console.log('Linked columns open after their origin after layout normalization; pending mounts, workspace switches, and later user moves passed.');

assert.equal(context.readerIsClearlyAvailable({chapterID:'chapter-1',title:'Reader'}),false);
assert.equal(context.readerIsClearlyAvailable({title:'Reader'}),true);
