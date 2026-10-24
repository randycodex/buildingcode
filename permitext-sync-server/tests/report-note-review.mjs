import assert from 'node:assert/strict';
import {reviewReportNoteSnapshot,reportNoteSourceChanged,reportNoteSnapshotText,createReportNoteComparison} from '../public/report-note-review.js';
const original={id:'b',kind:'paragraph',text:'Report-specific wording',derivedFrom:{kind:'notebookCard',id:'n',title:'Scope',version:1}};
const card={id:'n',title:'Scope',plainText:'Updated Note text',version:2};
assert.equal(reportNoteSourceChanged(original,card),true);
assert.equal(reportNoteSourceChanged(original,{...card,version:1}),false);
assert.equal(reportNoteSourceChanged(original,undefined),false);
assert.equal(reportNoteSourceChanged({...original,derivedFrom:{...original.derivedFrom,version:0}},card),false,'Unknown legacy versions cannot claim an update');
assert.equal(reportNoteSnapshotText({...original,richText:[{text:'Formatted '},{text:'Report text',bold:true}]}),'Formatted Report text');
assert.equal(reportNoteSnapshotText({...original,kind:'list',items:['One','Two']}),'One\nTwo');
for (const scenario of ['accept','cancel','account','workspace','deleted','local-edit','load-error','wrong-note','too-long']) {
 const block=structuredClone(original);let current=true,reviewed=0;
 const before=JSON.stringify(block);
 const run=()=>reviewReportNoteSnapshot(block,{
  isCurrent:()=>current,
  loadNote:async id=>{assert.equal(id,'n');if(scenario==='load-error')throw Error('Offline');return scenario==='wrong-note'?{...card,id:'other'}:scenario==='too-long'?{...card,plainText:'x'.repeat(20001)}:card;},
  confirm:async snapshot=>{reviewed++;assert.equal(snapshot.block.text,'Report-specific wording');assert.equal(snapshot.card.version,2);if(['account','workspace','deleted'].includes(scenario))current=false;if(scenario==='local-edit')block.text='New local edit';return scenario!=='cancel';}
 });
 if(['load-error','wrong-note','too-long'].includes(scenario)){await assert.rejects(run);assert.equal(reviewed,0);}else assert.equal(await run(),scenario==='accept'?card:null,scenario);
 if(scenario!=='local-edit')assert.equal(JSON.stringify(block),before,'Review does not mutate the Report or saved versions');
}
let finish;const block=structuredClone(original);const pending=reviewReportNoteSnapshot(block,{isCurrent:()=>true,loadNote:()=>new Promise(resolve=>finish=resolve),confirm:()=>assert.fail('A locally edited paragraph needs a fresh review')});
block.text='Edited during fetch';finish(card);assert.equal(await pending,null);
class Element {constructor(tag){this.tag=tag;this.children=[];this.textContent='';}append(...items){this.children.push(...items);}}
const comparison=createReportNoteComparison(original,{...card,plainText:'<script>literal source text</script>'},{createElement:tag=>new Element(tag)});
assert.equal(comparison.children.length,2);
assert.equal(comparison.children[0].children[2].textContent,'Report-specific wording');
assert.equal(comparison.children[1].children[2].textContent,'<script>literal source text</script>');
console.log('Report Note review passed: version signals, both comparison texts, safe literal rendering, explicit acceptance, cancellation/errors, context changes and concurrent local edits.');
