import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseFragment} from 'parse5';
import vm from 'node:vm';
import {calculatorSourceFootnotes,normalizeCalculatorFootnotes} from '../research-calculator-footnotes.mjs';
import {normalizeOccupantLoadDraft} from '../research-occupant-load-draft.mjs';
import {occupantLoadSource,occupantLoadTable,occupantLoadTableInput,occupantLoadFootnoteAssessment,occupantLoadFootnoteState,occupantLoadFootnoteQuestion,calculateOccupantLoad} from '../public/occupant-load-calculation.js';
import {buildResearchRequestEnvelopeBuilders} from './research-request-envelope-preflight.mjs';
globalThis.fetch=()=>{throw Error('Footnote tests forbid all external/provider calls.');};
const codeVersion='CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1';
const {blocks}=JSON.parse(await readFile(new URL('../../NYC CC APP/NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes/prepared/sections/2152.json',import.meta.url),'utf8'));
const plain=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(plain).join(' ');
const source={sectionID:'2152',sourceID:'enacted-2152',sectionNumber:'1004.1.3',codePrefix:'BC',codeVersion,text:blocks.map(b=>plain(parseFragment(b.html))).join('\n')};
const table=occupantLoadTable(blocks,source,parseFragment),row=table.rows.find(r=>r.label.startsWith('Business areas'));
const rowQuote=`${row.label} 100 gross b, d`,factor={value:'100',quote:rowQuote};
assert(source.text.replace(/\s+/g,' ').includes(rowQuote));
const notes=calculatorSourceFootnotes(source);
for(const note of row.footnotes) assert.equal(notes[note.marker],note.text);
const question='My office is entirely indoors with 1,500 square feet of gross floor area and no fixed seating. I am not deducting any fixtures or amenities.';
const fact={origin:'conversation',quote:question};
const proposed=[
 {marker:'a',status:'applies',reason:'The factor is in square feet per occupant.',factQuotes:[],question:null},
 {marker:'b',status:'not_applicable',reason:'No optional fixture deduction is proposed.',factQuotes:[fact],question:'Ask again?'},
 {marker:'d',status:'not_applicable',reason:'This calculation is for an indoor office, not a rooftop or terrace.',factQuotes:[fact],question:null}
];
const context={question,calculatorWorkFacts:[]};
const normalize=(checks=proposed,extra={})=>normalizeCalculatorFootnotes(checks,source,factor,{...context,...extra});
const checks=normalize();assert.equal(checks.length,3);assert(checks.every(c=>c.question===null),'Resolved facts must not be asked again.');
assert.equal(checks[2].sourceID,source.sourceID);assert.equal(checks[2].footnoteText,notes.d);
assert.deepEqual(normalize(checks),checks,'Revalidation preserves canonical binding.');
assert.equal(normalize([{...proposed[2],factQuotes:[]}]).length,0,'Missing facts cannot establish not-applicable.');
assert.equal(normalize([{...proposed[2],factQuotes:[{origin:'conversation',quote:'The office is outdoors.'}]}]).length,0);
assert.equal(normalize([{...proposed[2],factQuotes:[{origin:'site',quote:question}]}]).length,0,'Existing-site records are not proposed Work facts.');
assert.equal(normalize([{...proposed[2],factQuotes:[{origin:'work',quote:question}]}],{projectContextFacts:[question]}).length,0);
assert.equal(normalize([{...proposed[2],factQuotes:[{origin:'work',quote:question}]}],{question:'Check this calculation.',calculatorWorkFacts:[question]}).length,1);
assert.equal(normalize(proposed,{question:'Check this calculation.',messages:[{role:'assistant',answer:{answerText:question}}]}).length,1,'Only unit note can survive invented Assistant support.');
assert.equal(normalize(proposed,{messages:[{role:'user',question}],question:'Correction: this office is on a rooftop instead.'}).length,1,'Later corrections invalidate resolved stale conversation support.');
const uncertain='Assuming this office is indoors, maybe no fixtures will be deducted.';
assert.equal(normalize([{...proposed[2],factQuotes:[{origin:'conversation',quote:uncertain}]}],{question:uncertain}).length,0);
assert.equal(normalize([{...proposed[2],marker:'c'}]).length,0,'Unattached row notes must not leak into this calculation.');
assert.equal(normalize([proposed[0],proposed[0]]).length,1);
assert.equal(normalize([{...proposed[0],status:'needs_information',question:'What units?'}]).length,0,'Units are not a mandatory project question.');
const missing={marker:'d',status:'needs_information',reason:'The space location has not been established.',factQuotes:[],question:'Is this office indoors or on a rooftop or terrace?'};
assert.equal(normalize([missing])[0].question,missing.question);
assert.equal(normalize([{...missing,question:null}]).length,0);
const field=value=>({value,quote:question});
const draft={sourceID:source.sourceID,spaceFunction:field('office'),area:field('1500'),areaBasis:field('gross'),seating:field('without-fixed-seating'),factor,footnoteChecks:proposed};
const citations=[{...source,sourceIDs:[source.sourceID],relevance:'Governing table.'}];
const normalized=normalizeOccupantLoadDraft(draft,[source],citations,context);
assert.equal(normalized.footnoteChecks.length,3);assert.deepEqual(normalized.footnoteWorkFacts,[]);
assert.deepEqual(normalizeOccupantLoadDraft(normalized,[source],citations,context),normalized);
assert.equal(normalizeOccupantLoadDraft(draft,[source],[],context),null);
assert.equal(normalizeOccupantLoadDraft(draft,[{...source,codeVersion:codeVersion.replace('2022','2014')}],citations,context),null);
const answer={occupantLoadDraft:normalized,verification:{pass:true}};
const assessment=occupantLoadFootnoteAssessment(answer,citations[0]);assert(assessment);
const input=occupantLoadTableInput({area:'1500',seating:'without-fixed-seating',userMeasurementBasis:'gross'},table,row.id);
assert.equal(occupantLoadFootnoteState(assessment,table,row,input).filter(n=>n.check).length,3);
for(const change of [{area:'1600'},{seating:'fixed-seating'},{userMeasurementBasis:''}]) assert.equal(occupantLoadFootnoteState(assessment,table,row,{...input,...change}),null);
assert.equal(occupantLoadFootnoteState(assessment,table,row,{...input,factorMode:'custom'}),null,'BC-bound footnote checks must not appear to validate a custom factor.');
const customQuestion=occupantLoadFootnoteQuestion({...input,factorMode:'custom',factor:'50',tableFactor:'100',customReason:'Synthetic alternate reference'});
assert.match(customQuestion,/custom factor of 50 ft²\/person/);assert.match(customQuestion,/BC table factor remains 100 gross/);
assert.match(customQuestion,/Synthetic alternate reference/);assert.match(customQuestion,/not enacted text or proof of approval/);
assert.equal(occupantLoadFootnoteState(assessment,table,table.rows[0],input),null);
assert.equal(occupantLoadFootnoteAssessment({...answer,verification:{pass:false}},citations[0]),null);
const corrupt={...assessment,checks:assessment.checks.map(c=>({...c,sourceID:'wrong'}))};
assert(occupantLoadFootnoteState(corrupt,table,row,input).every(n=>!n.check));
const drift={...row,footnotes:row.footnotes.map(n=>({...n,text:n.text+' changed'}))};
assert(occupantLoadFootnoteState(assessment,table,drift,input).every(n=>!n.check));
assert.equal(calculateOccupantLoad(input).people,15,'Footnote decisions never change arithmetic or deduct areas.');
assert(!occupantLoadFootnoteQuestion({...input,userMeasurementBasis:''}).includes('square feet of gross area'),'Code-row basis does not prove user measurement basis.');
assert(occupantLoadFootnoteQuestion(input).includes('square feet of gross area'));
const {buildAnswerRequest,buildVerifierRequest}=await buildResearchRequestEnvelopeBuilders();
const options={...context,calculatorWorkFacts:[question],responseStyle:'conversational',model:'gpt-6-luna'};
const writer=buildAnswerRequest(question,[source],'synthetic-footnotes',options);
assert.equal(writer.model,'gpt-6-luna');assert.equal(writer.store,false);assert.equal(writer.text.format.strict,true);
const schema=writer.text.format.schema.properties.occupantLoadDraft.anyOf[1];
assert(schema.required.includes('footnoteChecks'));assert.equal(schema.properties.footnoteChecks.items.additionalProperties,false);
assert(writer.input.includes('calculatorWorkFacts'));assert(writer.instructions.includes('unused optional deduction'));
const reviewer=buildVerifierRequest(question,[source],answer,'synthetic-footnotes',options);
assert(reviewer.input.includes(JSON.stringify(answer)));assert(reviewer.input.includes('CURRENT WORK FACTS FOR CALCULATOR'));
assert(reviewer.instructions.includes('Review every footnoteChecks item'));assert(reviewer.instructions.includes('every numeric comparison'));
const client=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const helperStart=client.indexOf('function calculatorConversationForPane('),helperEnd=client.indexOf('function renderOccupantLoadCalculation(',helperStart);
let submitted=0,focused=0,confirmed=true,attachments=[];
const conversation={id:'conversation',primaryProjectID:'project',codeVersion,contextRevision:2,projectContext:{facts:[]},messages:[{id:'answer',role:'assistant',contextRevision:2,answer:{...answer,citations}}]};
const composer={requestSubmit(){submitted++;},querySelector:()=>({disabled:false})};
const textInput={value:'',disabled:false,closest:()=>composer,focus(){focused++;},dispatchEvent(){}};
const runtime=vm.createContext({occupantLoadSource,occupantLoadFootnoteAssessment,occupantLoadFootnoteQuestion,
 state:{utilityInstances:[]},paneIDForResearchConversation:()=> 'assistant-pane',activeResearchConversation:conversation,supplementalResearchConversations:new Map(),activeWorkspaceID:'workspace',
 researchConversationInWorkspace:()=>true,reconciledResearchProgressSession:()=>null,
 captureAccountRequest:()=>({userID:'owner'}),isCurrentAccountRequest:()=>true,workspaceProject:()=>({id:'project'}),researchProjectID:()=> 'project',
 openResearchConversation:async()=>conversation,paneIDForResearchConversation:()=> 'assistant-pane',whenWorkspacePaneReady:async()=>true,
 track:{querySelector:selector=>selector.endsWith('.research-question-input')?textInput:{querySelector:()=>textInput}},CSS:{escape:v=>v},Event:class{},
 researchNewChatDrafts:new Map(), resolveReaderSource:async()=>source,
 postResearch:async(_path,body)=>{assert.equal(body.reviewMode,'whole_section');assert.equal(body.codeVersion,codeVersion);return {selection:{selectedText:source.text}};},
 document:{createElement:()=>({children:[],append(...nodes){this.children.push(...nodes);}})},
 renderCodeBlock:block=>block,notebookEvidenceTextMap:()=>({text:source.text}),
 researchAnswerSourceCitation:()=> 'BC 1004.1.3',researchCodeEdition:()=> '2022',
 confirmWebWarning:async(_title,_message,options)=>{assert(options.content);return confirmed;},
 addResearchSelectionToCurrent:async selection=>{attachments.push(selection);return conversation;}});
vm.runInContext(client.slice(helperStart,helperEnd),runtime);
assert(runtime.calculatorFootnoteAssessmentFor(source,conversation,'answer'));
conversation.projectContext.facts=['The current proposed use has changed.'];
assert.equal(runtime.calculatorFootnoteAssessmentFor(source,conversation,'answer'),null,'Work edits invalidate the old assessment.');conversation.projectContext.facts=[];
assert.equal(runtime.calculatorFootnoteAssessmentFor(source,conversation,'earlier-answer'),null);
conversation.messages.push({role:'user',question:'Actually the room is outdoors.'});
assert.equal(runtime.calculatorFootnoteAssessmentFor(source,conversation),null);conversation.messages.pop();
await runtime.askCalculatorFootnotes(source,input,{conversationID:'conversation'});assert.equal(submitted,0,'Review prepares a question without sending it.');assert(textInput.value.includes('Function of space:'));
assert.equal(attachments.length,1);assert.equal(attachments[0].selectedText,source.text);
textInput.value='My existing unsent draft';
await assert.rejects(runtime.askCalculatorFootnotes(source,input,{conversationID:'conversation'}),/current Assistant draft/);assert.equal(textInput.value,'My existing unsent draft');assert.equal(submitted,0);
await runtime.askCalculatorFootnotes(source,input,{conversationID:'conversation',reply:true});assert.equal(focused,2);assert.equal(submitted,0);
let createdSelection;
runtime.activeResearchConversation=null;
runtime.startNewResearchFromSelection=async selection=>{createdSelection=selection;return {id:'new-conversation'};};
textInput.value='';
await runtime.askCalculatorFootnotes(source,input);
assert.equal(createdSelection.sectionID,'2152');assert.equal(createdSelection.selectedText,source.text,'A fresh conversation includes exact canonical table and footnote text.');
textInput.value='';createdSelection=null;confirmed=false;
await runtime.askCalculatorFootnotes(source,input);
assert.equal(createdSelection,null,'Cancel does not create or change a conversation.');assert.equal(textInput.value,'');
confirmed=true;runtime.postResearch=async()=>{throw Error('The source edition changed.');};
await assert.rejects(runtime.askCalculatorFootnotes(source,input),/edition changed/);
assert.equal(createdSelection,null,'Wrong editions never attach.');

console.log('Footnotes: real BC source/row bindings, current quoted facts, missing questions, corrections, stale UI inputs, unchanged arithmetic and full Luna review envelopes passed. Zero provider calls.');
