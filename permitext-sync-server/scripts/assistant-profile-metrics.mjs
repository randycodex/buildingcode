// Measurement only. Prices are the configured local test estimates, not an invoice.
import {lunaUsageMicroUSD} from '../research-v2-budget.mjs';
import {researchSemanticEmbeddingCost} from '../research-semantic-passages.mjs';
export function profilePhase(body,payload,endpoint='responses'){
 if(endpoint==='embeddings')return 'embedding';
 if(body.text?.format?.name==='assistant_conversational_intent')return 'intent_planning';
 if(body.text?.format?.name==='assistant_governing_sections')return 'section_selection';
 if(body.tools?.some(t=>t.type==='web_search'))return 'web_research';
 return payload.output?.some(o=>o.type==='function_call')?'agent_tool_routing':'answer_generation';
}
export function profileCallCost(payload,endpoint='responses'){
 if(endpoint==='embeddings')return researchSemanticEmbeddingCost(payload?.usage);
 const micros=lunaUsageMicroUSD(payload);if(micros===null)return null;
 // Matches the existing conservative test ledger, including web actions.
 return micros/1e6+(payload.output||[]).filter(o=>o.type==='web_search_call').length*.01;
}
export function intervalUnion(intervals){
 let end=-Infinity,total=0;
 for(const [a,b] of intervals.slice().sort((a,b)=>a[0]-b[0])){if(b<=end)continue;total+=b-Math.max(a,end);end=b;}
 return total;
}
export function compactResearchTrace(trace){
 return trace.map(t=>({tool:t.tool,query:t.query,
  sources:Array.isArray(t.result?.sources)?t.result.sources.map(s=>({id:s.id,sectionID:s.sectionID,title:s.title,recalledFrom:s.recalledFrom})):undefined,
  unavailable:t.result?.unavailable}));
}
export function summarizeTurnProfile(calls,{milliseconds,cpuMilliseconds,progress=[]},trace=[]){
 const phases={};
 for(const c of calls){const p=phases[c.phase]||={calls:0,milliseconds:0,inputTokens:0,cachedTokens:0,cacheWriteTokens:0,outputTokens:0,reasoningTokens:0,estimatedUSD:0,unknownCostCalls:0,requestBytes:0};
  p.calls++;p.milliseconds+=c.ended-c.started;p.inputTokens+=c.usage?.input_tokens||c.usage?.total_tokens||0;
  p.cachedTokens+=c.usage?.input_tokens_details?.cached_tokens||0;p.cacheWriteTokens+=c.usage?.input_tokens_details?.cache_write_tokens||0;
  p.outputTokens+=c.usage?.output_tokens||0;p.reasoningTokens+=c.usage?.output_tokens_details?.reasoning_tokens||0;p.requestBytes+=c.requestBytes;
  if(c.estimatedUSD===null)p.unknownCostCalls++;else p.estimatedUSD+=c.estimatedUSD;
 }
 const upstreamMilliseconds=intervalUnion(calls.map(c=>[c.started,c.ended]));
 const tools={};for(const entry of trace)tools[entry.tool]=(tools[entry.tool]||0)+1;
 return {milliseconds,cpuMilliseconds,upstreamMilliseconds,otherMilliseconds:Math.max(0,milliseconds-upstreamMilliseconds),
  modelCalls:calls.filter(c=>c.endpoint==='responses').length,embeddingCalls:calls.filter(c=>c.endpoint==='embeddings').length,
  estimatedUSD:calls.reduce((n,c)=>n+(c.estimatedUSD||0),0),unknownCostCalls:calls.filter(c=>c.estimatedUSD===null).length,
  inputTokens:calls.filter(c=>c.endpoint==='responses').reduce((n,c)=>n+(c.usage?.input_tokens||0),0),outputTokens:calls.reduce((n,c)=>n+(c.usage?.output_tokens||0),0),
  webActions:calls.reduce((n,c)=>n+(c.webActions||0),0),phases,tools,firstProgressMilliseconds:progress[0]?.milliseconds??null,progress};
}
