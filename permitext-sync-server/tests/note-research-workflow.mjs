import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {normalizeNoteResearch} from '../public/note-research.js';
import {captureWorkspaceLayout,applyWorkspaceLayout} from '../public/workspace-state.js';
import {normalizeNotebookQuestions,notebookReportDocument} from '../public/notebook-questions.js';
import {notebookReferenceBlocks} from '../public/notebook-passage-blocks.js';

const resume = {kind:'reader',source:{sectionID:'2',codeVersion:'2022',codePrefix:'BC'},exact:'Exact passage'};
const context = {p:{selected:{id:'n',title:'Analysis'},resumes:{n:resume}}};
const restored = {};
applyWorkspaceLayout(restored,captureWorkspaceLayout({noteResearch:context}));
assert.deepEqual(restored.noteResearch,context);
assert.deepEqual(normalizeNoteResearch({p:{selected:{id:'n'},resumes:{bad:{kind:'reader'},other:{kind:'unknown'}}}}).p.resumes,{});
const items = normalizeNotebookQuestions([
  {id:'q',text:'Unverified elevation',status:'open',includeInReport:true},
  {id:'a',kind:'action',text:'Ask for survey',status:'resolved'},
  {id:'private',text:'Internal question',status:'open'}
]);
const document = {schema:'permitext-notebook-card',schemaVersion:2,format:'blocknote-json',document:[{type:'paragraph',content:[{type:'text',text:'Keep my analysis',styles:{}}]}]};
const output = notebookReportDocument(document,items);
assert.match(JSON.stringify(output),/Unverified elevation/);
assert.doesNotMatch(JSON.stringify(output),/Internal question|Ask for survey/);
assert.equal(document.document.length,1);
assert.throws(()=>normalizeNotebookQuestions([{id:'q',text:'Unknown',status:'resolved'}]),/resolution explanation/);

const app = await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start = app.indexOf('function workingResearchNote(');
const end = app.indexOf('\nfunction renderResearchNotebookHandoff(',start);
function fixture({open=false,draft=false,archived=false}={}) {
  const calls=[];
  const card={id:'n',title:'Analysis',version:3,document:structuredClone(document),evidenceLinks:[],archivedAt:archived?'today':null};
  const mount={panel:{dataset:{projectId:'p'}},activeCardID:()=>card.id,insertionTarget:()=>({id:'n',title:'Analysis',identity:'same'}),
    insertLinkedReference:async(...args)=>calls.push({live:args})};
  const c=vm.createContext({state:{noteResearch:structuredClone(context)},document:{querySelector:()=>null},saveWorkspaceState(){},
    workspaceProject:()=>({id:'p'}),researchProjectID:p=>p.id,captureAccountRequest:()=>({userID:'u'}),navigator:{onLine:true},
    loadInitialNotebookCardList:async()=>({cards:[card]}),notebookMounts:new Map(),notebookColumnMounts:new Map(open?[['pane',mount]]:[]),
    loadNotebookDraft:async()=>draft?{}:null,requireCurrentAccountRequest(){},notebookReferenceBlocks,structuredClone,
    postResearch:async(path,body)=>{
      calls.push({path,body});
      return {card:path.endsWith('/get')?card:{...card,document:body.document}};
    },saveNotebookCardSnapshot:async()=>{},publishSavedNotebookCard(){}});
  vm.runInContext(app.slice(start,end),c);
  return {c,calls,card};
}
const reference={referenceKind:'researchAnswer',referenceID:'answer',label:'Research'};
for (const open of [true,false]) {
  const {c,calls,card}=fixture({open});
  const destination=await c.chooseResearchNoteDestination({id:'p'},null,()=>true);
  assert.equal(destination.kind,open?'open':'saved');
  await c.appendResearchReferenceToNote({id:'p'},destination,reference,'mutation',{userID:'u'},()=>true);
  if(open) assert.equal(calls[0].live[0],'n');
  else {
    const save=calls.find(call=>call.path.endsWith('/save')).body;
    assert.equal(save.expectedVersion,3);
    assert.equal(save.document.document[0].content[0].text,'Keep my analysis');
    assert.equal(save.document.document.at(-1).content[0].props.referenceID,'answer');
  }
  assert.equal(card.document.document.length,1);
}
const pending=fixture({draft:true});
await assert.rejects(pending.c.appendResearchReferenceToNote({id:'p'},{kind:'saved',card:pending.card},reference,'mutation',{userID:'u'},()=>true),/device draft/);
assert.equal(pending.calls.length,0);
const stale=fixture();
assert.equal(await stale.c.appendResearchReferenceToNote({id:'p'},{kind:'saved',card:stale.card},reference,'mutation',{userID:'u'},()=>false),null);
assert.equal(stale.calls.length,0);
const archived=fixture({archived:true});
await assert.rejects(archived.c.appendResearchReferenceToNote({id:'p'},{kind:'saved',card:archived.card},reference,'mutation',{userID:'u'},()=>true),/archived/);
console.log('Note Research workflow passed: retained destinations, source positions, live insertion, CAS append, device draft and stale context guards, and selected Report items.');

// Exercise the actual browser draft synchronizer, including its receipt input.
const syncStart=app.indexOf('async function synchronizeNotebookDraft(');
const syncEnd=app.indexOf('\nasync function flushPendingNotebookDrafts(',syncStart);
let sent;
const draft={accountUserID:'u',projectID:'p',cardID:'n',revision:'edit-questions',baseVersion:3,title:'Analysis',document,openQuestions:items,questionsEditable:true};
const syncContext=vm.createContext({normalizeNotebookQuestions,notebookDraftSaveTitle:()=> 'Analysis',requireCurrentAccountRequest(){},
  reconcileNotebookDocumentAssets:async doc=>doc,notebookDocumentAssetURLs:()=>[],
  beginNotebookDraftSave:async(_user,_project,_card,_revision,prepared)=>{
    assert.equal(prepared.omitQuestionUpdates,false,'New Notes must save authored question and action updates');
    return {...draft,...prepared};
  },postResearch:async(_path,body)=>{sent=body;return {card:{id:'n'}};}});
vm.runInContext(app.slice(syncStart,syncEnd),syncContext);
await syncContext.synchronizeNotebookDraft(draft,{userID:'u'},{deferAcknowledgement:true});
assert.equal(sent.openQuestions,items);
sent=null;
await assert.rejects(syncContext.synchronizeNotebookDraft({...draft,openQuestions:[{id:'empty',text:''}]},{userID:'u'},{deferAcknowledgement:true}),/question/);
assert.equal(sent,null,'Incomplete question edits remain on device until corrected');
console.log('Browser draft sync passed: authored questions and Report choices are transmitted, incomplete edits retain their draft.');
