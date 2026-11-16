// Opt-in real Luna evaluation. Use the existing cumulative ledger, never a new budget.
import {writeFile} from 'node:fs/promises';
import {resolveExperimentalIntent} from '../assistant-experimental.mjs';
import {createResearchV2Budget} from '../research-v2-budget.mjs';
import {contextCases} from '../tests/assistant-conversation-cases.mjs';
const {OPENAI_API_KEY,PERMITEXT_RESEARCH_V2_BUDGET_PATH}=process.env;
if(!OPENAI_API_KEY||!PERMITEXT_RESEARCH_V2_BUDGET_PATH)throw new Error('Provide the API key and existing evaluation-budget ledger explicitly.');
const budget=createResearchV2Budget({path:PERMITEXT_RESEARCH_V2_BUDGET_PATH});
const call=async(body,{phase,signal})=>{
 const id=await budget.reserveExperimental(body,phase);let payload;
 try{const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify(body),signal});
 payload=await response.json();if(!response.ok)throw new Error(`Provider HTTP ${response.status}`);return payload;
 }finally{await budget.settle(id,payload);}
};
const results=[];
for(const [name,turns,question] of contextCases){
 const started=Date.now();const {intent}=await resolveExperimentalIntent({question,conversation:turns.map((content,i)=>({role:i%2?'assistant':'user',content})),projectContext:{occupancy:'R-2',roof:'occupied terrace'}},call,AbortSignal.timeout(60000));
 results.push({name,intent,milliseconds:Date.now()-started});console.log(JSON.stringify(results.at(-1)));
}
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(results,null,2));
console.log(JSON.stringify({budget:await budget.summary(),note:'Inspect semantic correctness; successful API responses alone are not passing evaluations.'}));
