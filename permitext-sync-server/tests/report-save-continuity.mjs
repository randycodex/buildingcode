import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {createReportAutosave} from '../public/report-autosave.js';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('  const paintReportSaveState = () => {');
assert.ok(start > 0);
const implementation = source.slice(start, source.indexOf('\n  const reviewReport', start));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness() {
  let resolve, reject;
  const context = vm.createContext({
    structuredClone, crypto:{randomUUID:()=> 'synthetic-create-id'},
    activeDraft: {id: null, version: 0, title:'Draft', introduction:'Before', blocks:[]},
    drafts: [], dirty:false, disposed:false, deletingReport:false, projectID:'p', requestIdentity:'a', current:true,
    requestWorkspaceID:'w',activeWorkspaceID:'w',accountUserID:'a',recoveryEditorID:'editor',restoredRecovery:null,recoveredDrafts:[],
    autosave:null,savePresentation:{state:'saved'},shell:{querySelector:()=>null},
    createReportAutosave:options=>createReportAutosave({...options,setTimer:()=>1,clearTimer:()=>{}}),
    saveReportDraftRecovery:async record=>record,deleteReportDraftRecovery:async()=>true,
    isCurrentAccountRequest:()=>context.current, calls:[], renders:0, message:'',
    clearStatus:()=>{context.message='';}, showStatusError:m=>{context.message=m;},
    renderWorkspaceContent:()=>{context.renders++;}, notebookMounts:new Map(), refreshProjectReportMembership:async()=>{},
    reportRequest:(path, body)=>{context.calls.push(structuredClone(body)); return new Promise((yes,no)=>{resolve=yes; reject=no;});}
  });
  vm.runInContext(implementation+'\nglobalThis.save = saveDraft; globalThis.change = setDirty;', context);
  context.change();
  return {c:context, complete:()=>resolve({draft:{...context.calls.at(-1), id:'saved',version:context.calls.at(-1).expectedVersion+1}}), fail:()=>reject(new Error('Offline'))};
}
{
 const h=harness(), p=h.c.save(); assert.equal(h.c.save(),p); await tick(); assert.equal(h.c.calls.length,1);
 const blocks=h.c.activeDraft.blocks;
 h.c.activeDraft.introduction='Newer'; blocks.push({kind:'paragraph',text:'New'}); h.c.change();
 assert.equal(h.c.calls[0].blocks.length,0); h.complete(); await tick();
 assert.equal(h.c.calls.length,2); assert.equal(h.c.calls[1].expectedVersion,1);
 h.complete(); assert.equal(await p,true);
 assert.equal(h.c.activeDraft.introduction,'Newer'); assert.equal(h.c.activeDraft.blocks,blocks);
 assert.equal(h.c.activeDraft.version,2); assert.equal(h.c.dirty,false);assert.equal(h.c.renders,0);
}
for (const action of ['switch','dispose','account','workspace']) {
 const h=harness(), p=h.c.save();await tick();
 if(action==='switch')h.c.activeDraft={id:'other',title:'Other'};
 if(action==='dispose')h.c.disposed=true;
 if(action==='account')h.c.current=false;
 if(action==='workspace')h.c.activeWorkspaceID='other';
 const before=structuredClone(h.c.activeDraft); h.complete(); assert.equal(await p,false);
 assert.deepEqual(h.c.activeDraft,before); assert.equal(h.c.renders,0);
}
{
 const h=harness(),p=h.c.save();await tick(); h.fail(); assert.equal(await p,false);
 assert.equal(h.c.activeDraft.introduction,'Before'); assert.equal(h.c.dirty,true); assert.match(h.c.message,/Offline/);
 assert.match(h.c.message,/recovery copy/);assert.match(h.c.message,/Retry/);
}
console.log('Report autosave integration passed: edits during save, live editor identity, serial versions, recovery feedback, account/workspace/draft fences.');

const refreshStart = source.indexOf('  refreshReportArtifacts = async');
const refreshImplementation = source.slice(refreshStart, source.indexOf('\n  try {', refreshStart));
for (const mode of ['success', 'dirty', 'failure', 'account']) {
 const c = vm.createContext({structuredClone, disposed:false, deletingReport:false, deletingVersionID:null, historyMutationGeneration:0, dirty:mode==='dirty',
  requestIdentity:'a',projectID:'p',identity:{},drafts:[],sources:[],sourceWarnings:[],history:[],
  activeDraft:{id:'d',title:'Local'},message:'Earlier failure',renders:0,
  isCurrentAccountRequest:()=>mode!=='account',panel:{querySelector:()=>null},
  reportRequest:async()=>{if(mode==='failure')throw Error('Offline');return {drafts:[{id:'d',title:'Remote'}],sources:[],reports:[]}},
  refreshIncludedReportComments:()=>{},clearStatus:()=>{c.message=''},renderWorkspaceContent:()=>{c.renders++},emptyProjectReportDraft:()=>({})});
 vm.runInContext(refreshImplementation,c);
 if(mode==='failure')await assert.rejects(c.refreshReportArtifacts(),/Offline/);else await c.refreshReportArtifacts();
 assert.equal(c.message,mode==='success'?'':'Earlier failure',mode+' status');
 assert.equal(c.renders,mode==='success'?1:0,mode+' render');
 assert.equal(c.activeDraft.title,mode==='success'?'Remote':'Local',mode+' draft');
}
console.log('Report refresh status passed: successful clean recovery clears errors; dirty, failed and changed-account paths preserve state.');

{
 let resolveRefresh;
 const response = new Promise(resolve=>{resolveRefresh=resolve;});
 const c = vm.createContext({disposed:false,deletingReport:false,deletingVersionID:null,historyMutationGeneration:0,
   requestIdentity:'a',projectID:'p',isCurrentAccountRequest:()=>true,
   reportRequest:()=>response});
 vm.runInContext(refreshImplementation,c);
 const pending=c.refreshReportArtifacts();
 c.historyMutationGeneration++;
 resolveRefresh({reports:[{id:'deleted-version'}]});
 assert.equal(await pending,false,'A refresh started before deletion cannot restore the deleted version afterward');
}
