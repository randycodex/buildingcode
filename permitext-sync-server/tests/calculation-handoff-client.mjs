import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {calculateOccupantLoad,calculationNoteBlocks,occupantLoadSource,occupantLoadPrefill,occupantLoadTableInput,occupantLoadTable} from '../public/occupant-load-calculation.js';
import {parseFragment} from 'parse5';
import {calculationDraftStore} from '../public/calculation-drafts.js';
import {restoreNotebookPassageText} from '../public/notebook-passage-blocks.js';
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
 let options,resolve; const gate=new Promise(r=>resolve=r); const calls=[];
 const context=vm.createContext({occupantLoadSource,occupantLoadPrefill,occupantLoadTable:readTable,occupantLoadTableInput,calculateOccupantLoad,calculationNoteBlocks,calculationDraftStore,localStorage,privateWorkspaceKeys:()=>({baseWorkspaceKey:"private-owner"}),calculationDraftViews:new Set(),
  calculatorFootnoteAssessmentFor:()=>null,calculatorConversationForPane:()=>null,supplementalResearchConversations:new Map(),activeResearchConversation:null,
  state:{workflowNavigationGeneration:0},activeWorkspaceID:'workspace',captureAccountRequest:()=>({userID:'owner'}),
  isCurrentAccountRequest:()=>true,hasCapability:()=>true,workspaceProject:()=>({id:'project'}),researchProjectID:()=> 'project',researchCodeEdition:()=> '2022',
  crypto:{randomUUID:()=> 'synthetic-id'},document:{createElement:()=>({blocks:[],append(block){this.blocks.push(block);}})},
  createOccupantLoadCard:o=>{options=o;return {isConnected:true,addEventListener(){},closest:()=>({dataset:{paneId:'reader'}})};},
  resolveReaderSource:async()=>source,api:async()=>{await gate;return {section:{...source,blocks}};},
  sectionRecordMatchesRequestedEdition:()=>true,renderCodeBlock:()=>({text:'Exact canonical text'}),
  notebookEvidenceTextMap:root=>({text:root.blocks.map(b=>b.text).join(' ')}),
  emptyNotebookDocument:()=>({schema:'permitext-notebook-card',schemaVersion:2,format:'blocknote-json',document:[]}),
  postResearch:async(_path,body)=>{calls.push(body);return {card:{id:'note'}};},
  requireCurrentAccountRequest(){},saveNotebookCardSnapshot:async()=>{},openCalculationNotebook:async()=>{}});
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
 assert.equal(options.savedMessage,'Saved to Notebook · needs review.');
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
 }
}
console.log('Actual client save handler captures canonical evidence, saves the arithmetic snapshot, and cancels after a view change.');
