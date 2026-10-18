import assert from 'node:assert/strict';
import {restoreNotebookPassageText, notebookReferenceBlocks} from '../public/notebook-passage-blocks.js';
import {normalizeNotebookEvidenceLinks, validateNotebookDocument} from '../notebook-contract.mjs';

const reference={referenceKind:'selectedPassage',referenceID:'old-link',label:'BC · 2014 · § 1010.2'};
const exact='The saved historical passage.\nException: retain every condition <literally>.';
const link={id:'old-link',label:reference.label,relationshipRole:'context',projectID:'project',
 source:{codePrefix:'BC',codeEdition:'2014',codeVersion:'historical-2014',sectionID:'source',sectionNumber:'1010.2',sectionTitle:'Scope'},
 passages:[{exact}],createdAt:'2026-10-17T00:00:00.000Z'};
const paragraph=text=>({type:'paragraph',content:[{type:'text',text,styles:{bold:true}}]});
const wrap=blocks=>({schema:'permitext-notebook-card',schemaVersion:2,format:'blocknote-json',document:blocks});
const header=notebookReferenceBlocks(reference)[0];
const original=wrap([paragraph('Authored introduction'),header,paragraph('Authored conclusion')]);
const before=structuredClone(original),linkBefore=structuredClone(link);
const restored=restoreNotebookPassageText(original,[link]);
assert.equal(restored.changed,true);
assert.equal(restored.document.document[2].content[0].text,exact);
assert.deepEqual(restored.document.document.filter((_,i)=>i!==2),before.document,'Existing blocks, formatting and order remain intact.');
assert.deepEqual(original,before,'Reading a Note must not mutate the fetched document or a pending draft snapshot.');
assert.deepEqual(link,linkBefore);
const normalized=normalizeNotebookEvidenceLinks(restored.evidenceLinks);
assert.equal(normalized[0].noteTextVersion,1,'The one-time marker survives the real server contract.');
assert.equal(normalized[0].source.codeEdition,'2014');
assert.equal(normalized[0].source.sectionID,'source');
assert.equal(normalized[0].passages[0].exact,exact);
assert.equal(validateNotebookDocument(restored.document).document.document[2].content[0].text,exact);
assert.equal(restoreNotebookPassageText(restored.document,normalized).changed,false,'Reopening never adds another copy.');
const edited=structuredClone(restored.document);
edited.document[2]=paragraph('My edited interpretation.');
assert.equal(restoreNotebookPassageText(edited,normalized).document,edited,'Later author edits to the copied text remain edits.');
edited.document.splice(2,1);
assert.equal(restoreNotebookPassageText(edited,normalized).changed,false,'Deleting copied text after migration does not cause it to return.');

const already=wrap([header,paragraph(''),...notebookReferenceBlocks(reference,[{exact}]).slice(1)]);
const marked=restoreNotebookPassageText(already,[link]);
assert.equal(marked.document,already,'A passage copied before markers existed is not duplicated.');
assert.equal(marked.evidenceLinks[0].noteTextVersion,1);
const nested=wrap([{type:'numberedListItem',content:[{type:'text',text:'Keep nested writing'}],children:[header,paragraph('Nested conclusion')]}]);
const nestedRestored=restoreNotebookPassageText(nested,[link]);
assert.equal(nestedRestored.document.document[0].children[1].content[0].text,exact);
assert.equal(nestedRestored.document.document[0].children[2].content[0].text,'Nested conclusion');
for(const [document,links] of [
 [original,[]], [original,[{...link,id:'different-link'}]], [original,[{...link,passages:[]}]],
 [wrap([paragraph('No passage reference')]),[link]],
 [wrap([{type:'paragraph',content:[{type:'permitextReference',props:{...reference,referenceKind:'canonicalSection'}}]}]),[link]]
]) assert.equal(restoreNotebookPassageText(document,links).changed,false,'Only an exact reference ID with a captured passage can be restored.');
assert.equal(restoreNotebookPassageText(wrap([header,header]),[link]).document.document.length,3,'Repeated links to the same capture add its text once.');
console.log('Existing passage restoration passed: exact historical snapshot, preserved authored/nested content, marker roundtrip, no duplicates and later edits/deletions respected.');
