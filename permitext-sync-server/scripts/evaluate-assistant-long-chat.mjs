// Real-model recall evaluation with fictional project facts/documents, not legal
// authority. Uses the same cumulative test ledger; never creates a fresh budget.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {runExperimentalAssistant} from '../assistant-experimental.mjs';
import {createResearchV2Budget} from '../research-v2-budget.mjs';
const {OPENAI_API_KEY,PERMITEXT_RESEARCH_V2_BUDGET_PATH}=process.env;
if(!OPENAI_API_KEY||!PERMITEXT_RESEARCH_V2_BUDGET_PATH)throw new Error('Provide a local key and the existing cumulative budget path.');
await readFile(PERMITEXT_RESEARCH_V2_BUDGET_PATH);
const budget=createResearchV2Budget({path:PERMITEXT_RESEARCH_V2_BUDGET_PATH});
const history=Array.from({length:2000},(_,i)=>({role:i%2?'assistant':'user',text:`Unrelated coordination item ${i}. `+'We discussed ceiling coordination and equipment locations. '.repeat(6)}));
history[10]={role:'user',text:'The entrance clear width is 39 inches, but this is an unverified assumption.'};
history[600]={role:'user',text:'Correction: the approved entrance clear width is confirmed at 42 inches. The 39-inch width was only an early assumption.'};
history[800]={role:'user',text:'The first courtyard sketch shows a 48-inch route; it is only a draft.'};
history[1400]={role:'user',text:'The courtyard route is now confirmed at 60 inches in the agreed project sketch, replacing the earlier draft 48-inch route. This is our project choice, not a statement of a code minimum.'};
history[1998]={role:'user',text:'We were discussing whether staff could share the cafe toilet room.'};
history[1999]={role:'assistant',text:'We should consult the applicable provisions before reaching a legal conclusion.'};
const priorEvidence=Array.from({length:2000},(_,i)=>({id:`R${i+1}`,sectionID:`synthetic-note-${i}`,title:`Other schematic note ${i}`,summary:'Fictional project coordination note.',searchText:'A fictional equipment layout note; no legal authority is asserted.',priorQuestion:'Equipment coordination'}));
priorEvidence[1700]={id:'R1701',sectionID:'synthetic-courtyard-note',title:'Courtyard route — agreed project sketch',summary:'The current agreed project route is 60 inches.',searchText:'SYNTHETIC PROJECT DOCUMENT, NOT LEGAL AUTHORITY. The agreed courtyard route is 60 inches clear, replacing the superseded 48-inch draft. Footnote: retain the selected project route in future layout revisions.',priorQuestion:'Courtyard route decision'};
const sourceHash=createHash('sha256').update(JSON.stringify(priorEvidence)).digest('hex');
const results=[],requests=[];
const call=async(body,{phase,signal})=>{const id=await budget.reserveExperimental(body,phase);let payload;const start=Date.now();try{const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify(body),signal});payload=await response.json();requests.push({phase,bytes:Buffer.byteLength(JSON.stringify(body)),milliseconds:Date.now()-start});if(!response.ok)throw new Error(`Provider HTTP ${response.status}`);return payload;}finally{await budget.settle(id,payload);}};
const questions=['What entrance width did I confirm, and was the earlier number verified?','Back to the courtyard: what did we settle on, and what earlier number did that replace?','Please show the saved note that supports that.'];
for(const question of questions){
 const started=Date.now(),bindings=new Map();const result=await runExperimentalAssistant({question,history,priorEvidence,projectContext:{name:'Synthetic long conversation',status:'Fictional evaluation, project choices only'}},{call,
  searchLibrary:async()=>({sources:[],limitations:['This evaluation asks only about saved project choices. No code requirement is asserted.']}),
  recallEvidence:async ids=>({sources:ids.map((id,i)=>{const source=priorEvidence.find(s=>s.id===id);if(!bindings.has(id))bindings.set(id,`S${bindings.size+1}`);return {id:bindings.get(id),sectionID:source.sectionID,title:source.title,authority:'synthetic_project_document',text:source.searchText};})})});
 const row={question,messagesBefore:history.length,sourcesAvailable:priorEvidence.length,milliseconds:Date.now()-started,answer:result.text,trace:result.trace};results.push(row);
 history.push({role:'user',question},{role:'assistant',answer:{answerText:result.text}});
 console.log(JSON.stringify({question,milliseconds:row.milliseconds,answer:row.answer,budget:await budget.summary()}));
}
assert(/42/.test(results[0].answer)&&/39/.test(results[0].answer));assert(/60/.test(results[1].answer)&&/48/.test(results[1].answer));assert(/60/.test(results[2].answer)&&/\[S\d+\]/.test(results[2].answer));
assert(results.every(r=>!/\[source not verified\]|\[R\d+\]/.test(r.answer)));
assert.equal(createHash('sha256').update(JSON.stringify(priorEvidence)).digest('hex'),sourceHash);
const report={messagesAtStart:2000,sources:2000,sourceHashUnchanged:true,results,requests,budget:await budget.summary()};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2));
console.log('PASS real Luna: long-distance correction, explicit topic return, superseded values and complete saved source recall.');
