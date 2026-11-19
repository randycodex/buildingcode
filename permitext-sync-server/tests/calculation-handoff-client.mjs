import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {calculateOccupantLoad,calculationNoteBlocks,occupantLoadSource,occupantLoadPrefill,occupantLoadTableInput,occupantLoadTable} from '../public/occupant-load-calculation.js';
import {parseFragment} from 'parse5';
import {calculationDraftStore} from '../public/calculation-drafts.js';
import {restoreNotebookPassageText} from '../public/notebook-passage-blocks.js';
import {generatedNoteTitle} from '../public/notebook-titles.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const a=app.indexOf('function renderOccupantLoadCalculation('),b=app.indexOf('\nasync function addPassageToNotebook',a);
const source={sectionID:'2152',sectionNumber:'1004.1.3',codePrefix:'BC',codeVersion:'CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1'};
const {blocks}=JSON.parse(await readFile(new URL('../../NYC CC APP/NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes/prepared/sections/2152.json',import.meta.url),'utf8'));
const readTable=(blocks,identity)=>occupantLoadTable(blocks,identity,parseFragment);
const table=readTable(blocks,source);
const row=table.rows.find(r=>r.label.startsWith('Business areas'));
const calculation=calculateOccupantLoad(occupantLoadTableInput({area:'1200',seating:'without-fixed-seating'},table,row.id));
for(const stale of [false,true]) {
 const storageValues=new Map();
 const localStorage={getItem:key=>storageValues.get(key)??null,setItem:(key,value)=>storageValues.set(key,value)};
 let options,resolve,serial=0; const gate=new Promise(r=>resolve=r); const calls=[];
 const context=vm.createContext({occupantLoadSource,occupantLoadPrefill,occupantLoadTable:readTable,occupantLoadTableInput,calculateOccupantLoad,calculationNoteBlocks,calculationDraftStore,generatedNoteTitle,localStorage,privateWorkspaceKeys:()=>({baseWorkspaceKey:"private-owner"}),calculationDraftViews:new Set(),
  chooseResearchNoteDestination:async()=>({kind:'new'}),rememberWorkingResearchNote(){},calculatorFootnoteAssessmentFor:()=>null,calculatorConversationForPane:()=>null,supplementalResearchConversations:new Map(),activeResearchConversation:null,
  state:{workflowNavigationGeneration:0},activeWorkspaceID:'workspace',captureAccountRequest:()=>({userID:'owner'}),
  isCurrentAccountRequest:()=>true,hasCapability:()=>true,workspaceProject:()=>({id:'project'}),researchProjectID:()=> 'project',researchCodeEdition:()=> '2022',
  crypto:{randomUUID:()=> `synthetic-id-${++serial}`},document:{createElement:()=>({blocks:[],append(block){this.blocks.push(block);}})},
  projectCalculationStore:()=>calculationDraftStore(localStorage,'private-owner:calculator-drafts:v1'), syncedProjectCalculations:()=>null,
  createOccupantLoadCard:o=>{options=o;return {isConnected:true,addEventListener(){},closest:()=>({dataset:{paneId:'reader'}})};},
  resolveReaderSource:async()=>source,api:async()=>{await gate;return {section:{...source,blocks}};},
  sectionRecordMatchesRequestedEdition:()=>true,renderCodeBlock:()=>({text:'Exact canonical text'}),
  notebookEvidenceTextMap:root=>({text:root.blocks.map(b=>b.text).join(' ')}),
  emptyNotebookDocument:()=>({schema:'permitext-notebook-card',schemaVersion:2,format:'blocknote-json',document:[]}),
  postResearch:async(_path,body)=>{calls.push(body);return {card:{id:'note'}};},
  requireCurrentAccountRequest(){},saveNotebookCardSnapshot:async()=>{},publishSavedNotebookCard:()=>{},openCalculationNotebook:async()=>{}});
 vm.runInContext(app.slice(a,b),context);context.renderOccupantLoadCalculation(source);
 const prefilledSource={...source,sourceID:'synthetic-source'};
 const answer={occupantLoadDraft:{sourceID:'synthetic-source',area:{value:'1500',quote:'My room is 1500 square feet.'}}};
 context.renderOccupantLoadCalculation(prefilledSource,{answerID:'prefill-answer',answer});
 assert.equal(options.draft.area,'1500'); assert.equal(options.draft.reviewed,false);
 options.draft.area='1400';options.onDraftChange({...options.draft});
 context.renderOccupantLoadCalculation(prefilledSource,{answerID:'prefill-answer',answer});
 assert.equal(options.draft.area,'1400','Rendering an answer again must preserve the author edit instead of reapplying Luna suggestions.');
 const originalOptions=options;
 context.renderOccupantLoadCalculation(prefilledSource,{calculatorID:'utility:calculator'});
 assert.equal(options.draft.area,undefined,'Manual calculations do not borrow answer-specific prefill.');
 options.draft.area='1700';options.onDraftChange({...options.draft});
 assert.equal(options.column,true,'The standalone calculator uses the column presentation.');
 context.renderOccupantLoadCalculation(prefilledSource,{calculatorID:'utility:calculator'});
 assert.equal(options.draft.area,'1700','Reopening the standalone calculator retains its device draft.');
 options=originalOptions;
 const save=options.onSave(calculation);await new Promise(r=>setImmediate(r));
 if(stale)context.state.workflowNavigationGeneration++;
 resolve();
 if(stale){await assert.rejects(save,/view changed/);assert.equal(calls.length,0);}
 else {assert.equal((await save).id,'note');assert.equal(calls.length,1);assert.equal(JSON.stringify(calls[0].openQuestions),'[]','Calculation Notes do not create an automatic question checklist.');assert.match(calls[0].evidenceLinks[0].passages[0].exact,/Exact canonical text/);assert.equal(calls[0].document.document[2].content[0].text.includes('12 people'),true);
  assert.equal(calls[0].evidenceLinks[0].noteTextVersion,1);
  const restored=restoreNotebookPassageText(calls[0].document,calls[0].evidenceLinks);
  assert.equal(restored.changed,false,'Opening or restoring a calculation cannot append the full table to its body.');
  assert.doesNotMatch(JSON.stringify(restored.document),/Exact canonical text/);
  assert.match(restored.evidenceLinks[0].passages[0].exact,/Exact canonical text/,'The complete exact source remains attached.');
  const sourceReference=restored.document.document.flatMap(block=>block.content).find(node=>node.props?.referenceKind==='selectedPassage');
  assert.equal(sourceReference.props.referenceID,restored.evidenceLinks[0].id,'The source control still opens the exact attached evidence.');
  await assert.rejects(options.onSave({...calculation,input:{...calculation.input,factor:'1000'}}),/BC table changed/);assert.equal(calls.length,1,'A modified default table factor cannot be saved.');
  const custom=calculateOccupantLoad(occupantLoadTableInput({...calculation.input,factorMode:'custom',customFactor:'50',customReason:'Synthetic reference CALC-7'},table));
  await options.onSave({...custom,people:999});
  const savedText=JSON.stringify(calls[1]);
  assert.match(savedText,/Custom factor/);assert.match(savedText,/24 people/);assert.doesNotMatch(savedText,/999 people/,'Save recomputes custom arithmetic rather than trusting a submitted result.');
  assert.match(savedText,/BC table factor: 100/);assert.match(savedText,/Synthetic reference CALC-7/);
  await assert.rejects(options.onSave({...custom,input:{...custom.input,tableFactor:'101'}}),/BC table changed/);
  await assert.rejects(options.onSave({...custom,input:{...custom.input,customReason:''}}),/reason\/reference/);
  await assert.rejects(options.onSave({...custom,input:{...custom.input,factor:'0'}}),/positive factor/);
  await assert.rejects(options.onSave({...custom,input:{...custom.input,factorBasis:'Changed notes'}}),/BC table changed/);
  assert.equal(calls.length,2,'Invalid overrides cannot write a Note.');
  const appends=[];
  let selectedNoteID='existing-note';
  context.chooseResearchNoteDestination=async()=>({kind:'saved',card:{id:selectedNoteID}});
  context.appendResearchReferenceToNote=async(_project,destination,reference,mutationID,_identity,_current,material)=>{
    appends.push({reference,mutationID,...material});return destination.card;
  };
  assert.equal((await options.onSave(calculation)).id,'existing-note');
  assert.equal((await options.onSave(calculation)).id,'existing-note');
  selectedNoteID='other-note';
  assert.equal((await options.onSave(calculation)).id,'other-note');
  assert.equal(new Set(appends.map(item=>item.mutationID)).size,3);
  assert.equal(new Set(appends.map(item=>item.evidenceLink.id)).size,3);
  for (const added of appends) {
    assert.match(JSON.stringify(added.blocks),/12 people/);
    assert.equal(added.reference.referenceID,added.evidenceLink.id);
    assert.equal(added.blocks.flatMap(block=>block.content || []).some(node=>node.props?.referenceID===added.evidenceLink.id),false,
      'The common handoff inserts the calculation source reference once');
  }
  assert.equal(calls.length,2,'Appending to the chosen Notes does not create a new Note');

  context.chooseResearchNoteDestination=async()=>({kind:'new'});
  const createAttempts=[];
  context.postResearch=async(_path,submission)=>{
    createAttempts.push(submission);
    if(createAttempts.length===1)throw new Error('Response unavailable');
    return {card:{id:submission.clientMutationID}};
  };
  await assert.rejects(options.onSave(calculation),/Response unavailable/);
  const retried=await options.onSave(calculation);
  const addedAgain=await options.onSave(calculation);
  assert.equal(createAttempts[0].clientMutationID,createAttempts[1].clientMutationID,'Retry reuses the pending mutation');
  assert.equal(createAttempts[0].evidenceLinks[0].id,createAttempts[1].evidenceLinks[0].id);
  assert.notEqual(addedAgain.id,retried.id,'Another add after success creates its own Note');
  assert.notEqual(createAttempts[2].clientMutationID,calls[0].clientMutationID);
 }
}
console.log('Actual client save handler captures canonical evidence, saves the arithmetic snapshot, and cancels after a view change.');
