import assert from 'node:assert/strict';
import {createReportUndo,reportContentBlocks} from '../public/report-undo.js';
import {createReportAutosave} from '../public/report-autosave.js';
import {normalizeReportDraftPayload} from '../report-contract.mjs';
const make=()=>({id:'report-a',version:1,title:'Report',reportDate:'2026-10-18',introduction:'Original',blocks:[{id:'p',kind:'paragraph',text:'Before'}]});
const apply=(draft,content)=>{assert(content); Object.assign(draft,content);};
{
  const history=createReportUndo(),draft=make(); history.bind(draft);
  draft.blocks.push({id:'placeholder',kind:'paragraph',text:''});history.record(draft);
  assert(history.canUndo(draft),'Inserting an empty editor block is an undoable action.');
  draft.blocks[1].text='First words';history.record(draft,'text:placeholder');
  apply(draft,history.undo(draft));assert.equal(draft.blocks[1].text,'','Undoing first text restores the empty editor block.');
  assert.equal(reportContentBlocks(draft.blocks).length,1,'Empty editor blocks remain excluded from saved content.');
  assert.doesNotThrow(()=>normalizeReportDraftPayload({...draft,blocks:reportContentBlocks(draft.blocks),createdBy:'qa',updatedBy:'qa'}));
  apply(draft,history.redo(draft));assert.equal(draft.blocks[1].text,'First words');
  assert.equal(reportContentBlocks([...draft.blocks,{id:'blank',kind:'list',items:['']}]).length,2);
}
for(const placeholder of [
  {id:'empty-paragraph',kind:'paragraph',text:''},
  {id:'empty-heading',kind:'heading',text:'   '},
  {id:'empty-list',kind:'list',items:['']}
]) {
  const history=createReportUndo(),draft=make();
  draft.blocks.push(placeholder);history.bind(draft);
  draft.title='Keep this title';history.record(draft);
  draft.blocks.pop();history.record(draft);
  apply(draft,history.undo(draft));history.record(draft);
  assert.equal(draft.title,'Keep this title','Undo restores the removed item before reverting an earlier title edit.');
  assert.equal(draft.blocks[1].id,placeholder.id);
  assert.equal(reportContentBlocks(draft.blocks).length,1,'Restored placeholders do not enter saved or exported content.');
  apply(draft,history.redo(draft));history.record(draft);
  assert.equal(draft.title,'Keep this title');assert.equal(draft.blocks.length,1);
  apply(draft,history.undo(draft));
  apply(draft,history.undo(draft));assert.equal(draft.title,'Report','A second Undo reaches the earlier title edit.');
}
{
  let time=0; const history=createReportUndo({now:()=>time}),draft=make();
  history.bind(draft);
  assert(!history.canUndo(draft)); assert(!history.canRedo(draft));
  for (const text of ['B','Be','Better']) {time+=100; draft.blocks[0].text=text; history.record(draft,'text:p');}
  apply(draft,history.undo(draft)); assert.equal(draft.blocks[0].text,'Before','A typing burst undoes as one action');
  history.record(draft); assert(history.canRedo(draft),'Autosaving Undo does not erase Redo');
  apply(draft,history.redo(draft)); assert.equal(draft.blocks[0].text,'Better');
  time+=800; draft.blocks[0].text='Later'; history.record(draft,'text:p');
  draft.blocks[0].richText=[{text:'Later',bold:true}]; history.record(draft);
  apply(draft,history.undo(draft)); assert.equal(draft.blocks[0].richText,undefined); assert.equal(draft.blocks[0].text,'Later');
  apply(draft,history.undo(draft)); assert.equal(draft.blocks[0].text,'Better');
  draft.introduction='New edit'; history.record(draft,'introduction');
  assert(!history.canRedo(draft),'An edit after Undo clears the abandoned Redo branch');
  draft.version=9; draft.updatedAt='server timestamp';
  apply(draft,history.undo(draft)); assert.equal(draft.version,9); assert.equal(draft.updatedAt,'server timestamp');
}
{
  const history=createReportUndo(),draft=make(); history.bind(draft);
  draft.blocks.push({id:'source',kind:'evidence',sourceID:'saved-s',label:'Exact excerpt'}); history.record(draft);
  const original=structuredClone(draft.blocks[1]);
  draft.blocks[1].sourceFormatting=[{key:'evidence:text::0',text:'Original code wording.',formats:{bold:[[0,8]],highlight:[[0,8]]}}]; history.record(draft);
  apply(draft,history.undo(draft)); assert.deepEqual(draft.blocks[1],original);
  apply(draft,history.redo(draft)); assert(draft.blocks[1].sourceFormatting[0].formats.bold);
  assert.equal(draft.blocks[1].sourceID,'saved-s','Formatting Undo never replaces a source identity or its text');
  draft.blocks.reverse(); history.record(draft);
  apply(draft,history.undo(draft)); assert.deepEqual(draft.blocks.map(b=>b.id),['p','source']);
  draft.blocks.pop(); history.record(draft);
  apply(draft,history.undo(draft)); assert.equal(draft.blocks[1].id,'source','Removing a source is recoverable');
  draft.blocks[0].kind='heading'; draft.blocks[0].headingLevel=2; history.record(draft);
  apply(draft,history.undo(draft)); assert.equal(draft.blocks[0].kind,'paragraph'); assert.equal(draft.blocks[0].headingLevel,undefined);
  draft.title='Changed title'; history.record(draft); apply(draft,history.undo(draft)); assert.equal(draft.title,'Report');
}
{
  const history=createReportUndo(),draft=make(); history.bind(draft);
  draft.blocks.push({id:'new',kind:'list',items:['One'],listStyle:'bullet'}); history.record(draft);
  let refreshed={...draft,...normalizeReportDraftPayload({...draft,createdBy:'qa',updatedBy:'qa'}),version:2};
  history.bind(refreshed);
  assert(history.canUndo(refreshed),'Server-added order/classification/defaults do not erase session history');
  apply(refreshed,history.undo(refreshed)); assert.equal(refreshed.blocks.length,1); assert.equal(refreshed.version,2);
  history.bind({...make(),id:'report-b'}); assert(!history.canUndo({...make(),id:'report-b'}),'History cannot cross Report identities');
  history.clear(); assert(!history.canRedo(make()));
}
{
  const history=createReportUndo({limit:2}),draft=make(); history.bind(draft);
  for(const text of ['One','Two','Three']) {draft.blocks[0].text=text;history.record(draft);}
  apply(draft,history.undo(draft)); apply(draft,history.undo(draft)); assert.equal(draft.blocks[0].text,'One'); assert(!history.canUndo(draft));
  const small=createReportUndo({maxBytes:1}); small.bind(draft); draft.title='Different';small.record(draft);assert(!small.canUndo(draft),'Bound memory use for large Reports');
}
{
  // An Undo made while a previous revision is saving must itself be saved in
  // order, using the new server revision while retaining the restored content.
  const history=createReportUndo(),draft=make(),writes=[]; history.bind(draft);
  const autosave=createReportAutosave({read:()=>draft,retain:async()=>({}),acknowledge:async()=>{},
    write:snapshot=>new Promise(resolve=>writes.push({snapshot,resolve})),
    onSaved:saved=>{draft.version=saved.version;},setTimer:()=>1,clearTimer:()=>{}});
  draft.blocks[0].text='Pending change';history.record(draft);autosave.change();
  const saving=autosave.flush(); await new Promise(resolve=>setImmediate(resolve));
  assert.equal(writes[0].snapshot.blocks[0].text,'Pending change');
  apply(draft,history.undo(draft));history.record(draft);autosave.change();
  writes[0].resolve({...writes[0].snapshot,version:2}); await new Promise(resolve=>setImmediate(resolve));
  assert.equal(writes[1].snapshot.blocks[0].text,'Before');assert.equal(writes[1].snapshot.version,2);
  writes[1].resolve({...writes[1].snapshot,version:3});assert(await saving);assert.equal(draft.version,3);
  assert(history.canRedo(draft),'Successful autosave retains Redo'); autosave.dispose();
}
console.log('Report Undo/Redo passed: grouped typing, inline/source formatting, structure, identity fences, server refresh, bounded history and autosave races.');
