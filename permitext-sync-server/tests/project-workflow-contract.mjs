import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {appendFindingTemplate, normalizeRecordsChecklist, selectedReportEvidenceItems, reportsContainingSource} from '../public/project-workflow.js';
import {emptyNotebookDocument, validateNotebookDocument, notebookPlainText, notebookManifestItem} from '../notebook-contract.mjs';
import {normalizeReportDraftBlock} from '../report-contract.mjs';
const original = emptyNotebookDocument();
const finding = appendFindingTemplate(original, randomUUID);
assert.equal(finding.document.length, original.document.length + 8);
assert.doesNotThrow(()=>validateNotebookDocument(finding));
for(const heading of ['Conclusion','Supporting evidence','Uncertainty','Next action']) assert(notebookPlainText(finding).includes(heading));
assert.doesNotThrow(()=>notebookManifestItem({cardID:'note',cardType:'finding',title:'Finding',document:finding}));
const records = [{id:'one',label:' Approved plans ',status:'requested',note:' Request dated Oct 10 '}];
assert.equal(normalizeRecordsChecklist(records)[0].label,'Approved plans');
assert.throws(()=>normalizeRecordsChecklist([{...records[0],status:'verified-fact'}]));
assert.throws(()=>normalizeRecordsChecklist([records[0],records[0]]));
assert.deepEqual(normalizeRecordsChecklist([]),[]);
const evidence = {id:'evidence',kind:'evidence',sourceID:'section',label:'Section',excludedCommentKeys:['section']};
assert.deepEqual(normalizeReportDraftBlock(evidence).excludedCommentKeys,['section']);
const items=[{kind:'evidence',passageText:'Complete text, including exception.'},{kind:'heading',reportCommentKey:'section'}, {kind:'paragraph',reportCommentKey:'section',text:'Section comment'}, {kind:'paragraph',reportCommentKey:'p-1',text:'Passage comment'}];
assert.deepEqual(selectedReportEvidenceItems(evidence,items),[items[0],items[3]]);
assert.deepEqual(selectedReportEvidenceItems({...evidence,excludedCommentKeys:[]},items),items);
assert.equal(reportsContainingSource([{blocks:[evidence]}],'evidence','section').length,1);
assert.equal(reportsContainingSource([{blocks:[{kind:'paragraph',derivedFrom:{kind:'notebookCard',id:'note'}}]}],'notebookCard','note').length,1);
console.log('Workflow data passed: finding schema/export, checklist validation, exact comment exclusions and persistent source membership.');

const {uniqueReportItems,reportEvidenceCoverage}=await import('../public/project-workflow.js');
const overlapSources=[
  {id:'whole',kind:'evidence',sectionID:'s',sourceLibraryVersion:'2022',selectionBlockID:''},
  {id:'passage',kind:'evidence',sectionID:'s',sourceLibraryVersion:'2022',selectionBlockID:'p'},
  {id:'historical',kind:'evidence',sectionID:'s',sourceLibraryVersion:'2014',selectionBlockID:'p'}
];
const overlapBlocks=overlapSources.map(source=>({id:source.id,kind:'evidence',sourceID:source.id}));
assert.deepEqual([...reportEvidenceCoverage(overlapBlocks,overlapSources)],['passage']);
const union=uniqueReportItems(overlapBlocks,overlapSources,block=>[
  {kind:'evidence',id:block.id},
  {kind:'paragraph',reportCommentKey:'p',text:'Selected comment'}
]);
assert.equal(union.filter(item=>item.kind === 'evidence').length,2,'Different editions remain distinct');
assert.equal(union.filter(item=>item.kind === 'paragraph').length,2,'Comments deduplicate only within their exact edition');

const passageFirst = [overlapBlocks[1], {id:'narrative',kind:'paragraph'}, overlapBlocks[0]];
const merged = uniqueReportItems(passageFirst,overlapSources,block => block.kind === 'paragraph'
  ? [{id:block.id,kind:'paragraph',text:'Authored narrative'}]
  : [{id:block.id,kind:'evidence'},...(block.id === 'passage' ? [{kind:'paragraph',reportCommentKey:'p',text:'Passage-only selected comment'}] : [])]);
assert.deepEqual(merged.map(item=>item.id || item.text),['narrative','whole','Passage-only selected comment'],
  'Covered passage comments belong after the full section, even when the passage was earlier and the whole-section copy was excluded');
