import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {reportBlockUsesSource,reportsContainingSource} from '../public/project-workflow.js';
import {createReportUndo} from '../public/report-undo.js';
import {createReportInsertion,reportInsertionIndex} from '../public/report-outline.js';

const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const queue=app.slice(app.indexOf('  function queueReportSourceMutation('),app.indexOf('  const mountState = {',app.indexOf('  function queueReportSourceMutation(')));
const palette=app.slice(app.indexOf('  function renderSourcePalette('),app.indexOf('  async function deleteVersion(',app.indexOf('  function renderSourcePalette(')));
const appendStart=app.indexOf('function appendUniqueReportSources(');
const append=app.slice(appendStart,app.indexOf('\n}',appendStart)+2);
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attributes={};this.events={};this.textContent='';this.isConnected=true;}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(){const detach=node=>{node.isConnected=false;node.children.forEach(detach);};this.children.forEach(detach);this.children=[];}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(type,handler){this.events[type]=handler;}
  focus(){this.focused=true;}
}
const descendants=node=>[node,...node.children.flatMap(descendants)];
const note={kind:'notebookCard',id:'note',label:'Note One',summary:'Original project note'};
const authored={id:'authored',kind:'paragraph',text:'Keep my unsaved report wording'};
const snapshot={id:'snapshot',kind:'paragraph',text:'Edited report snapshot',derivedFrom:{kind:'notebookCard',id:'note',version:3}};
function fixture({blocks=[authored,snapshot],sources=[note],save=true,prepare}={}){
  const host=new Element('div'),history=createReportUndo(),saved=[],notices=[];
  const draft={id:'report',version:3,title:'Unsaved Report title',introduction:'Keep this introduction',blocks:structuredClone(blocks)};
  history.bind(draft);
  const c=vm.createContext({activeDraft:draft,sources:structuredClone(sources),sourceWarnings:[],sourceMutation:Promise.resolve(),sourceMutationDraft:null,
    generatingReport:false,deletingReport:false,disposed:false,requestIdentity:'account',requestWorkspaceID:'workspace',activeWorkspaceID:'workspace',projectID:'project',
    structuredClone,crypto:{randomUUID},reportBlockUsesSource,reportsContainingSource,reportInsertionIndex,reportInsertion:createReportInsertion(),outlineController:null,
    isCurrentAccountRequest:()=>true,accountContextChangedError:()=>Error('Account changed'),
    prepareReportNoteSources:prepare||(async()=>{}),saveDraft:async()=>{saved.push(structuredClone(c.activeDraft));return save;},
    setDirty:()=>history.record(c.activeDraft),renderWorkspaceContent:()=>{host.replaceChildren();c.renderSourcePalette(host);},
    document:{createElement:tag=>new Element(tag)},CSS:{escape:value=>value},
    reportSourcePickerLabel:()=> 'Add sources',reportSectionExpanded:()=>false,persistReportSectionExpanded(){},wireProjectSectionMotion(){},evidenceComments:()=>[],
    showWebNotice:async(title,message)=>notices.push({title,message}),
    panel:{querySelector(selector){
      const kind=selector.match(/data-source-kind="([^"]+)"/)?.[1],id=selector.match(/data-source-id="([^"]+)"/)?.[1];
      return descendants(host).find(node=>node.dataset.sourceKind===kind&&node.dataset.sourceId===id&&kind)?.children.at(-1)||null;
    }}});
  vm.runInContext(append+'\n'+queue+'\n'+palette,c);
  c.mountState={addSources:(id,items)=>c.queueReportSourceMutation(id,items),removeSources:(id,items)=>c.queueReportSourceMutation(id,items,true)};
  c.renderSourcePalette(host);
  const button=source=>descendants(host).find(node=>node.attributes['aria-label']===`${reportsContainingSource([c.activeDraft],source.kind,source.id).length?'Remove from Report':'Add to Report'}: ${source.label}`);
  return {c,host,history,saved,notices,button};
}

const f=fixture(),original=structuredClone(f.c.activeDraft),originalSources=structuredClone(f.c.sources);
assert.equal(f.button(note).textContent,'Remove');assert.equal(f.button(note).disabled,false);
await f.button(note).events.click();
assert.equal(f.button(note).textContent,'Add');assert.equal(f.button(note).disabled,false);assert.equal(f.button(note).focused,true);
assert.deepEqual(Array.from(f.c.activeDraft.blocks,block=>block.id),['authored']);
assert.equal(f.c.activeDraft.title,original.title);assert.equal(f.c.activeDraft.introduction,original.introduction);
assert.deepEqual(f.c.sources,originalSources,'Removing a Report item leaves the original project source intact.');
assert.equal(f.saved.length,1);assert.equal(f.history.canUndo(f.c.activeDraft),true);
Object.assign(f.c.activeDraft,f.history.undo(f.c.activeDraft));f.c.renderWorkspaceContent();
assert.equal(f.button(note).textContent,'Remove');assert.equal(f.c.activeDraft.blocks[1].text,'Edited report snapshot','Undo restores report-specific edits.');
Object.assign(f.c.activeDraft,f.history.redo(f.c.activeDraft));f.c.renderWorkspaceContent();
await f.button(note).events.click();
assert.equal(f.button(note).textContent,'Remove');assert.equal(f.c.activeDraft.blocks.at(-1).sourceID,'note');
assert.equal(f.notices.length,0);

for(const source of [note,{kind:'projectFacts',id:'p:context',label:'Context'},{kind:'projectFacts',id:'p:facts',label:'Facts'},
  {kind:'evidence',id:'e',label:'Evidence'},{kind:'researchAnswer',id:'r',label:'Research'}]){
  const blocks=[authored,{id:'included',kind:source.kind,sourceID:source.id},
    {id:'other-kind',kind:'different',sourceID:source.id},
    ...(source.kind==='notebookCard'?[snapshot,{id:'duplicate',kind:source.kind,sourceID:source.id}]:[])];
  const item=fixture({blocks,sources:[source]});await item.button(source).events.click();
  assert.deepEqual(Array.from(item.c.activeDraft.blocks,block=>block.id),['authored','other-kind']);
  assert.equal(item.button(source).textContent,'Add');
}

let release;
const gate=new Promise(resolve=>{release=resolve;});
const race=fixture({blocks:[authored],prepare:()=>gate});
const adding=race.c.queueReportSourceMutation('report',[note]);
const removing=race.c.queueReportSourceMutation('report',[note],true);
release();await Promise.all([adding,removing]);
assert.equal(reportsContainingSource([race.c.activeDraft],note.kind,note.id).length,0,'Add then Remove preserves the latest requested state.');
assert.equal(race.saved.at(-1).blocks.length,1);

for(const stale of ['account','workspace','draft']){
  const item=fixture(),pending=item.c.queueReportSourceMutation('report',[note],true);
  if(stale==='account')item.c.isCurrentAccountRequest=()=>false;
  if(stale==='workspace')item.c.activeWorkspaceID='other';
  if(stale==='draft')item.c.activeDraft={...original,id:'other',blocks:structuredClone(original.blocks)};
  await assert.rejects(pending,/changed/i);assert.equal(item.saved.length,0);
  assert.equal(item.c.activeDraft.blocks.length,2);
}
const failed=fixture({save:false});await failed.button(note).events.click();
assert.equal(failed.button(note).textContent,'Add');assert(failed.history.canUndo(failed.c.activeDraft));
assert.match(failed.notices[0].message,/Retry/);
const anchors = ['a','b','c'].map(id=>({id,kind:'paragraph',text:id}));
for (const kind of ['projectFacts','evidence','notebookCard','calculation','researchAnswer','attachment','workboardPreview']) {
  const source={id:`source-${kind}`,kind,label:kind};
  const item=fixture({blocks:anchors,sources:[source]});
  item.c.reportInsertion.select(item.c.activeDraft,'b');
  if (['attachment','workboardPreview'].includes(kind)) await item.c.queueReportSourceMutation('report',[source]);
  else await item.button(source).events.click();
  assert.deepEqual(Array.from(item.c.activeDraft.blocks,block=>block.sourceID || block.id),['a','b',source.id,'c']);
  assert.equal(item.saved.at(-1).blocks[2].sourceID,source.id,'Source placement reaches the saved Report.');
  assert.equal(item.c.reportInsertion.selected(item.c.activeDraft),item.c.activeDraft.blocks[2].id);
}
{
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const first={kind:'evidence',id:'first',label:'First'},second={kind:'calculation',id:'second',label:'Second'};
  const item=fixture({blocks:anchors,prepare:()=>gate});
  item.c.reportInsertion.select(item.c.activeDraft,'b');
  const one=item.c.queueReportSourceMutation('report',[first]);
  const two=item.c.queueReportSourceMutation('report',[second]);
  release();await Promise.all([one,two]);
  assert.deepEqual(Array.from(item.c.activeDraft.blocks,block=>block.sourceID || block.id),['a','b','first','second','c'],
    'Queued additions advance the captured cursor in request order.');
}
{
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const source={kind:'evidence',id:'delayed',label:'Delayed'};
  const item=fixture({blocks:anchors,prepare:()=>gate});
  item.c.reportInsertion.select(item.c.activeDraft,'b');
  const pending=item.c.queueReportSourceMutation('report',[source]);
  item.c.reportInsertion.select(item.c.activeDraft,'c');
  release();await pending;
  assert.deepEqual(Array.from(item.c.activeDraft.blocks,block=>block.sourceID || block.id),['a','b','delayed','c']);
  assert.equal(item.c.reportInsertion.selected(item.c.activeDraft),'c','An asynchronous source keeps its requested target and preserves a later outline selection.');
}
console.log('Report source toggles passed: all source types insert after selection, queued/source-loading cursors retain order and intent, Remove/Add preserves project data, Undo/Redo, saves and ownership fences.');
