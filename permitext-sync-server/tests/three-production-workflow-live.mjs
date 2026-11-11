// Explicitly invoked paid smoke test. Reuses the original durable evaluation
// budget and Keychain credential; never changes or replenishes that budget.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseFragment} from 'parse5';
import {runResearchV2} from '../research-v2-engine.mjs';
import {createResearchV2Budget,createLunaV2Client} from '../research-v2-budget.mjs';
if(!process.argv.includes('--live'))throw Error('Use --live for the user-authorized live verification.');
const apiKey=process.env.OPENAI_API_KEY||execFileSync('security',['find-generic-password','-a',process.env.USER,'-s','permitext-openai-api-key','-w'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
const budget=createResearchV2Budget({path:resolve('data/research-v2-evaluation/budget-ledger.json')});
const call=createLunaV2Client({apiKey,budget});
const prepared=JSON.parse(await readFile(new URL('../../NYC CC APP/NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes/prepared/sections/2152.json',import.meta.url),'utf8'));
const plain=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(plain).join(' ');
const source={id:'S1',sectionID:'2152',edition:'2022',title:'BC 1004.1.3 Areas without fixed seating',text:plain(parseFragment(prepared.blocks.map(block=>block.html||'').join(' '))).replace(/\s+/g,' ').trim()};
const questions=[
  'For a hypothetical 4,500 gross square foot Business area and a separate 1,405 net square foot Library—Reading room, compare the table factors and net/gross bases. Show the reading-room division and round up as requested. Keep row-specific footnotes conditional and identify unresolved applicability without declaring compliance.',
  'Read footnotes c and d separately. Which footnote contains the Group R-2 or R-3 qualifier? Does footnote d itself contain that qualifier? Explain how to read the Business row markers without transferring another footnote’s scope.'
];
const output=resolve(process.env.PERMITEXT_THREE_FIX_EVIDENCE||'data/research-v2-evaluation/three-workflow-fixes');
await mkdir(output,{recursive:true});const results=[];
for(const [index,question] of questions.entries()){
  const result=await runResearchV2({question,sources:[source]},{call});
  await writeFile(resolve(output,`live-footnotes-${index+1}.json`),JSON.stringify(result,null,2));
  assert.notEqual(result.status,'review_failed',JSON.stringify(result.reviews));
  assert(result.reviews.at(-1).pass);results.push({question,answer:result.draft.answerText,missingFacts:result.draft.missingFacts,status:result.status});
}
console.log(JSON.stringify({results,budget:await budget.summary()},null,2));
