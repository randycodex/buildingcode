import assert from 'node:assert/strict';
import {assembleResearchEvidence} from '../research-evidence-assembly.mjs';
const longText='Ground floor uses. '.repeat(24)+'Transparency paragraph with its complete conditions and exclusions.';
const entries=['37-34','32-321','37-31','37-311','32-30'].map(sectionNumber=>({sectionID:sectionNumber,sectionNumber,codePrefix:'ZR',title:'Fixture provision',text:sectionNumber==='32-321'?longText:'Short complete fixture provision.',codeEdition:'Fixture edition',codeVersion:'fixture-v1',corpusID:'fixture-zoning',jurisdiction:'NYC'}));
async function assemble({selectedOnly=false,perSource=700,supplemental=1200}={}) {
 return assembleResearchEvidence({question:'It’s a new building with ground-floor retail and community facility space',previousMessages:[{role:'user',question:'Explain transparency requirements for this project.'}],discover:async()=>({candidates:entries.slice(0,2).map(entry=>({...entry,selectedText:'Selected opening.',signals:{useSelectedPassageOnly:selectedOnly&&entry.sectionNumber==='32-321'}}))}),resolveSection:async request=>entries.find(entry=>entry.sectionID===request.sectionID||entry.sectionNumber===request.sectionNumber),limits:{maximumDiscovered:2,maximumCandidates:2,maximumCharacters:600,maximumSupplementalCharacters:supplemental,maximumCharactersPerSource:perSource}});
}
const restored=await assemble();
const source=restored.sources.find(source=>source.sectionNumber==='32-321');
assert(source);
assert.equal(source.text,longText);
assert.equal(source.canonicalContextComplete,true);
assert.equal(source.truncated,false);
assert(restored.sources.reduce((n,s)=>n+s.text.length,0)<=1200);
const capped=await assemble({perSource:300});
assert.notEqual(capped.sources.find(s=>s.sectionNumber==='32-321').text,longText);
const selected=await assemble({selectedOnly:true});
assert.equal(selected.sources.find(s=>s.sectionNumber==='32-321').text,'Selected opening.');
console.log('Follow-up topic restoration passed: complete controlling text restored within budget; per-source and explicit selection boundaries preserved.');
