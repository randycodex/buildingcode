import assert from 'node:assert/strict';
import { evidenceComments, serializeEvidenceComments, evidenceCommentBlocks, createEvidenceCommentsEditor } from '../public/evidence-comments.js';
import { notebookReferenceBlocks } from '../public/notebook-passage-blocks.js';
for (const values of [['Existing comment'], ['First', 'Second'], ['Text\n\n', '### Comment 2\nLiteral heading\n\\text', ''], ['## Passage comments\n\n### Comment 1\nLiteral']]) {
  assert.deepEqual(evidenceComments(serializeEvidenceComments(values)), values);
}
assert.deepEqual(evidenceComments('Legacy\nmultiline comment'), ['Legacy\nmultiline comment']);
assert.deepEqual(evidenceComments(''), []);
assert.equal(serializeEvidenceComments(['', '  ']), '');
const reference = { referenceKind: 'selectedPassage', referenceID: 'exact-edition' };
const passages = [{ exact: 'Authoritative code text' }];
const without = notebookReferenceBlocks(reference, passages);
const withComments = notebookReferenceBlocks(reference, passages, ['My interpretation', 'Verify scope']);
assert.equal(without.length, 2);
assert.equal(withComments.length, 4);
assert.deepEqual(withComments.slice(0, 2), without, 'comments never become quoted legal source text');
assert.equal(withComments[2].content[0].text, 'Comment 1: My interpretation');
assert.equal(evidenceCommentBlocks(['', 'Present'])[0].content[0].text, 'Comment 1: Present');
console.log('Evidence comment round trips and optional Note transfer passed');

// A chapter's comment indicators share a single index, not a summary read for
// every rendered passage. A later batch observes fresh edits.
const { readFile } = await import('node:fs/promises');
const { default: vm } = await import('node:vm');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const actual = name => { const start = app.indexOf(`function ${name}(`); return app.slice(start, app.indexOf('\n}', start) + 2); };
let reads = 0, scheduled;
const record = {sectionID:'section',codeVersion:'2022',blockID:'paragraph',noteBody:serializeEvidenceComments(['One','Two'])};
const runtime = vm.createContext({ evidenceComments,
  currentContentSummary: () => { reads++; return {annotations:[record]}; },
  consolidatedSavedAnnotations: records => records,
  visibleSyncedTargetKey: target => [target.codeVersion,target.sectionID,target.blockID].join(':'),
  queueMicrotask: callback => { scheduled=callback; }
});
vm.runInContext('let readerCommentIndex=null;\n'+actual('readerCommentCount'),runtime);
for(let i=0;i<500;i++) assert.equal(runtime.readerCommentCount(record),2);
assert.equal(reads,1);
assert.equal(runtime.readerCommentCount({...record,codeVersion:'2014'}),0);
record.noteBody=''; scheduled();
assert.equal(runtime.readerCommentCount(record),0);
assert.equal(reads,2);
console.log('Reader comment index: one read per batch, exact edition and fresh subsequent edits passed');


class CommentElement {
  constructor(tag) { this.tagName=tag; this.children=[]; this.listeners={}; this.attributes={}; this.value=''; }
  append(...children) { children.forEach(child => { child.parentElement=this; this.children.push(child); }); }
  remove() { this.parentElement.children=this.parentElement.children.filter(child=>child!==this); this.parentElement=null; }
  insertBefore(child,before) { const index=before ? this.children.indexOf(before) : this.children.length; child.parentElement=this; this.children.splice(index,0,child); }
  replaceChildren() { this.children=[]; }
  setAttribute(name,value) { this.attributes[name]=value; }
  querySelectorAll(selector) { return this.children.flatMap(child => [
    ...(selector.startsWith('.') ? child.className===selector.slice(1) : child.tagName===selector) ? [child] : [],
    ...child.querySelectorAll(selector)
  ]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest() { return null; }
  addEventListener(name,listener) { (this.listeners[name] ||= []).push(listener); }
  dispatchEvent(event) { (this.listeners[event.type] || []).forEach(listener=>listener(event)); }
  focus() { document.activeElement=this; }
}
const priorDocument=globalThis.document;
globalThis.document={createElement:tag=>new CommentElement(tag)};
try {
  const original=['Keep first\nwith its line break','Delete only this one','Keep last exactly'];
  const editor=createEvidenceCommentsEditor(serializeEvidenceComments(original),'Passage comment');
  let saves=0;
  editor.addEventListener('input',()=>saves++);
  const first=editor.querySelectorAll('textarea')[0],last=editor.querySelectorAll('textarea')[2];
  editor.querySelectorAll('button')[1].dispatchEvent(new Event('click'));
  assert.deepEqual(evidenceComments(editor.value),[original[0],original[2]]);
  assert.deepEqual(editor.querySelectorAll('textarea'),[first,last], 'Surviving editors retain their values and nodes');
  assert.equal(document.activeElement,last,'Focus moves to the next surviving comment');
  assert.deepEqual(editor.querySelectorAll('.section-detail-comment-number').map(node=>node.textContent),['1.','2.']);
  assert.equal(editor.querySelectorAll('button')[1].attributes['aria-label'],'Delete comment 2');
  assert.equal(saves,1,'Deletion uses the existing autosave input event');
  const restored=createEvidenceCommentsEditor(editor.value,'Passage comment');
  assert.deepEqual(restored.querySelectorAll('textarea').map(node=>node.value),[original[0],original[2]]);
  editor.readOnly=true;
  assert.ok(editor.querySelectorAll('button').every(button=>button.disabled));
  editor.querySelectorAll('button')[0].dispatchEvent(new Event('click'));
  assert.equal(saves,1,'Read-only comments cannot be deleted');
  editor.readOnly=false;
  editor.querySelectorAll('button')[0].dispatchEvent(new Event('click'));
  assert.deepEqual(evidenceComments(editor.value),[original[2]]);
  editor.querySelectorAll('button')[0].dispatchEvent(new Event('click'));
  assert.equal(editor.value,'');
  assert.equal(editor.children.length,0);
  editor.value='';
  assert.equal(editor.children.length,0,'Sync does not recreate a just-deleted comment');
  editor.addComment();
  assert.equal(editor.querySelectorAll('button')[0].attributes['aria-label'],'Delete comment 1');

  const recovery=createEvidenceCommentsEditor(serializeEvidenceComments(['First','Middle','Last']),'Passage comment');
  let recoverySaves=0;
  recovery.addEventListener('input',()=>recoverySaves++);
  const undo=recovery.undoNotice.querySelector('button');
  const click=button=>button.dispatchEvent(new Event('click'));
  click(recovery.querySelectorAll('button')[1]);
  assert.equal(recovery.undoNotice.hidden,false);
  recovery.value=recovery.value;
  assert.equal(recovery.undoNotice.hidden,false,'A matching sync acknowledgement preserves Undo');
  recovery.querySelectorAll('textarea')[0].value='First edited after deletion';
  recovery.querySelectorAll('textarea')[1].value='Last edited after deletion';
  recovery.addComment();
  recovery.querySelectorAll('textarea')[2].value='New after deletion';
  recovery.readOnly=true;
  assert.equal(undo.disabled,true);
  click(undo);
  assert.equal(recovery.querySelectorAll('textarea').length,3,'Read-only Undo cannot mutate comments');
  recovery.readOnly=false;
  click(undo);
  assert.deepEqual(evidenceComments(recovery.value),['First edited after deletion','Middle','Last edited after deletion','New after deletion']);
  assert.equal(document.activeElement,recovery.querySelectorAll('textarea')[1]);
  assert.equal(recovery.undoNotice.hidden,true);
  assert.equal(recoverySaves,3,'Delete, add and Undo all autosave');
  click(recovery.querySelectorAll('button')[1]);
  click(recovery.querySelectorAll('button')[1]);
  click(undo);
  click(undo);
  assert.deepEqual(evidenceComments(recovery.value),['First edited after deletion','Middle','Last edited after deletion','New after deletion'],'Repeated Undo restores original order');
  const lastOnly=createEvidenceCommentsEditor('Only comment','Passage comment');
  click(lastOnly.querySelector('button'));
  assert.equal(lastOnly.value,'');
  click(lastOnly.undoNotice.querySelector('button'));
  assert.equal(lastOnly.value,'Only comment','Undo restores the final deleted comment');
  click(recovery.querySelectorAll('button')[1]);
  recovery.value='Changed from another client';
  assert.equal(recovery.undoNotice.hidden,true,'A replacement source value invalidates stale Undo');
  click(undo);
  assert.equal(recovery.value,'Changed from another client');
} finally { globalThis.document=priorDocument; }
console.log('Individual comment deletion: middle/first/last, surviving drafts, renumbering, reload, focus, autosave and read-only guards passed');

console.log('Comment Undo passed: original position, newer edits, new comments, repeated deletions, final comment, autosave, sync acknowledgements and read-only/stale guards');
