import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {calculateOccupantLoad,calculationNoteBlocks,occupantLoadSource,occupantLoadPrefill} from '../public/occupant-load-calculation.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const a=app.indexOf('function renderOccupantLoadCalculation('),b=app.indexOf('\nasync function addPassageToNotebook',a);
const source={sectionID:'2152',sectionNumber:'1004.1.3',codePrefix:'BC',codeVersion:'CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1'};
const calculation=calculateOccupantLoad({spaceFunction:'Synthetic',area:'1200',factor:'100',factorBasis:'Synthetic row',areaBasis:'gross',seating:'without-fixed-seating',reviewed:true});
for(const stale of [false,true]) {
 let options,resolve; const gate=new Promise(r=>resolve=r); const calls=[];
 const context=vm.createContext({occupantLoadSource,occupantLoadPrefill,calculationNoteBlocks,occupantLoadDrafts:new Map(),
  state:{workflowNavigationGeneration:0},activeWorkspaceID:'workspace',captureAccountRequest:()=>({userID:'owner'}),
  isCurrentAccountRequest:()=>true,hasCapability:()=>true,workspaceProject:()=>({id:'project'}),researchProjectID:()=> 'project',researchCodeEdition:()=> '2022',
  crypto:{randomUUID:()=> 'synthetic-id'},document:{createElement:()=>({blocks:[],append(block){this.blocks.push(block);}})},
  createOccupantLoadCard:o=>{options=o;return {isConnected:true,closest:()=>({dataset:{paneId:'reader'}})};},
  resolveReaderSource:async()=>source,api:async()=>{await gate;return {section:{...source,blocks:[{text:'Exact canonical text'}]}};},
  sectionRecordMatchesRequestedEdition:()=>true,renderCodeBlock:b=>b,
  notebookEvidenceTextMap:root=>({text:root.blocks.map(b=>b.text).join(' ')}),
  emptyNotebookDocument:()=>({schema:'permitext-notebook-card',schemaVersion:2,format:'blocknote-json',document:[]}),
  postResearch:async(_path,body)=>{calls.push(body);return {card:{id:'note'}};},
  requireCurrentAccountRequest(){},saveNotebookCardSnapshot:async()=>{},openCalculationNotebook:async()=>{}});
 vm.runInContext(app.slice(a,b),context);context.renderOccupantLoadCalculation(source);
 const prefilledSource={...source,sourceID:'synthetic-source'};
 const answer={occupantLoadDraft:{sourceID:'synthetic-source',area:{value:'1500',quote:'My room is 1500 square feet.'}}};
 context.renderOccupantLoadCalculation(prefilledSource,{answerID:'prefill-answer',answer});
 assert.equal(options.draft.area,'1500'); assert.equal(options.draft.reviewed,false);
 options.draft.area='1400';
 context.renderOccupantLoadCalculation(prefilledSource,{answerID:'prefill-answer',answer});
 assert.equal(options.draft.area,'1400','Rendering an answer again must preserve the author edit instead of reapplying Luna suggestions.');
 const save=options.onSave(calculation);await new Promise(r=>setImmediate(r));
 if(stale)context.state.workflowNavigationGeneration++;
 resolve();
 if(stale){await assert.rejects(save,/view changed/);assert.equal(calls.length,0);}
 else {assert.equal((await save).id,'note');assert.equal(calls.length,1);assert.equal(calls[0].evidenceLinks[0].passages[0].exact,'Exact canonical text');assert.equal(calls[0].document.document[2].content[0].text.includes('12 people'),true);}
}
console.log('Actual client save handler captures canonical evidence, saves the arithmetic snapshot, and cancels after a view change.');
