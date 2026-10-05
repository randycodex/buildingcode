import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { operationTokenCost } from '../evals/typesafe-evidence-focus.mjs';
const path=resolve(process.argv[2] || '');
const r=JSON.parse(await readFile(path,'utf8'));
if(!['completed','stopped'].includes(r.status)) throw new Error('Pilot is still running');
const percentile=(xs,p)=>xs.length?[...xs].sort((a,b)=>a-b)[Math.ceil(xs.length*p)-1]:null;
const allTurns=r.turns.filter(t=>Number.isFinite(t.durationMs)).map(t=>{
 const calls=r.providerCalls.filter(c=>c.turn===t.id);
 return {id:t.id,caseID:t.caseID,repetition:t.repetition,mode:t.mode,status:t.status,timeMs:t.durationMs,
   researchCostUSD:t.operations.reduce((n,o)=>n+operationTokenCost(o),0),jevCostUSD:t.preparation?.estimatedCostUSD||0,
   totalCostUSD:t.operations.reduce((n,o)=>n+operationTokenCost(o),0)+(t.preparation?.estimatedCostUSD||0),
   inputTokens:calls.reduce((n,c)=>n+(c.usage?.input_tokens||0),0),
   cachedInputTokens:calls.reduce((n,c)=>n+(c.usage?.input_tokens_details?.cached_tokens||0),0),
   cacheWriteInputTokens:calls.reduce((n,c)=>n+(c.usage?.input_tokens_details?.cache_write_tokens||0),0),
   outputTokens:calls.reduce((n,c)=>n+(c.usage?.output_tokens||0),0),
   reasoningTokens:calls.reduce((n,c)=>n+(c.usage?.output_tokens_details?.reasoning_tokens||0),0),
   calls:calls.length,verificationAttempts:t.operations.reduce((n,o)=>n+(o.verificationAttemptCount||0),0),
   removed:t.preparation?.removedIDs||[],beforeCharacters:t.preparation?.beforeCharacters,afterCharacters:t.preparation?.afterCharacters,
   jevDurationMs:t.preparation?.durationMs||0,
   preparationStatus:t.preparation?.status,plan:t.preparation?.plan,sourceIDs:t.preparation?.sourceIDs,verification:t.answer?.verification,requiredClaimCoverage:t.answer?.requiredClaimCoverage,
   answerText:t.answer?.answerText,missingFacts:t.answer?.missingFacts,error:t.error};
});
const modes=['baseline','rules','jev-plan'];
const turns=allTurns.filter(t=>modes.every(mode=>allTurns.some(other=>other.caseID===t.caseID&&other.repetition===t.repetition&&other.mode===mode&&other.preparationStatus!=='fallback-to-rules')));
const arms=Object.fromEntries(modes.map(mode=>{
 const xs=turns.filter(t=>t.mode===mode);
 return [mode,{turns:xs.length,completed:xs.filter(t=>t.status==='completed').length,
   totalCostUSD:xs.reduce((n,t)=>n+t.totalCostUSD,0),meanTimeMs:xs.length?xs.reduce((n,t)=>n+t.timeMs,0)/xs.length:null,
   medianTimeMs:percentile(xs.map(t=>t.timeMs),.5),p90TimeMs:percentile(xs.map(t=>t.timeMs),.9),
   verificationAttempts:xs.reduce((n,t)=>n+t.verificationAttempts,0),
   cachedInputTokens:xs.reduce((n,t)=>n+t.cachedInputTokens,0),
   cacheWriteInputTokens:xs.reduce((n,t)=>n+t.cacheWriteInputTokens,0),
   inputTokens:xs.reduce((n,t)=>n+t.inputTokens,0),outputTokens:xs.reduce((n,t)=>n+t.outputTokens,0),
   reasoningTokens:xs.reduce((n,t)=>n+t.reasoningTokens,0),providerCalls:xs.reduce((n,t)=>n+t.calls,0),
   removedPassages:xs.reduce((n,t)=>n+t.removed.length,0)}];
}));
const triples=turns.filter(t=>t.mode==='baseline').map(b=>({caseID:b.caseID,repetition:b.repetition,
 comparisons: Object.fromEntries(modes.slice(1).map(mode=>{
 const j=turns.find(t=>t.caseID===b.caseID&&t.repetition===b.repetition&&t.mode===mode);
 return [mode,{timeChangePercent:(j.timeMs/b.timeMs-1)*100,costChangePercent:(j.totalCostUSD/b.totalCostUSD-1)*100}];
 }))}));
const summary={sourceReport:path,status:r.status,stopReason:r.stopReason,arms,triples,turns,
  unmatchedTurns:allTurns.filter(t=>!turns.includes(t)),
  totalAttemptedCostUSD:allTurns.reduce((n,t)=>n+t.totalCostUSD,0),
  unknownJevCharge:r.turns.some(t=>t.preparation?.status==='fallback-to-rules'&&!t.preparation?.usage),
  limitations:r.limitations};
const output=path.replace(/\.json$/,'.summary.json');
await writeFile(output,JSON.stringify(summary,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({output,arms,triples},null,2));
