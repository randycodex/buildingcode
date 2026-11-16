import assert from 'node:assert/strict';
import {profilePhase,profileCallCost,intervalUnion,summarizeTurnProfile,compactResearchTrace} from '../scripts/assistant-profile-metrics.mjs';

assert.equal(profilePhase({text:{format:{name:'assistant_conversational_intent'}}},{}),'intent_planning');
assert.equal(profilePhase({text:{format:{name:'assistant_governing_sections'}}},{}),'section_selection');
assert.equal(profilePhase({tools:[{type:'web_search'}]},{}),'web_research');
assert.equal(profilePhase({}, {output:[{type:'function_call'}]}),'agent_tool_routing');
assert.equal(profilePhase({}, {output:[{type:'message'}]}),'answer_generation');
assert.equal(profilePhase({}, {},'embeddings'),'embedding');
assert.equal(profileCallCost({}),null,'Unknown usage must not be reported as zero cost');
assert.equal(profileCallCost({usage:{input_tokens:1000,output_tokens:1000,input_tokens_details:{cached_tokens:500}},output:[{type:'web_search_call'}]}),.010555);
assert.equal(intervalUnion([]),0);
assert.equal(intervalUnion([[4,10],[0,5],[2,3],[12,15]]),13,'Overlapping upstream waits are counted once');
const profile=summarizeTurnProfile([
 {endpoint:'responses',phase:'agent_tool_routing',started:0,ended:5,requestBytes:10,usage:{input_tokens:100,output_tokens:20},estimatedUSD:.001},
 {endpoint:'embeddings',phase:'embedding',started:4,ended:7,requestBytes:20,usage:{total_tokens:10},estimatedUSD:null}
],{milliseconds:9,cpuMilliseconds:2,progress:[{milliseconds:1}]},[{tool:'read_library'},{tool:'read_library'}]);
assert.equal(profile.upstreamMilliseconds,7);
assert.equal(profile.otherMilliseconds,2);
assert.equal(profile.modelCalls,1);
assert.equal(profile.embeddingCalls,1);
assert.equal(profile.unknownCostCalls,1);
assert.equal(profile.inputTokens,100,'Embedding tokens are separate from model input');
assert.equal(profile.phases.embedding.inputTokens,10);
assert.equal(profile.tools.read_library,2);
assert.equal(profile.firstProgressMilliseconds,1);
assert.deepEqual(compactResearchTrace([{tool:'conversation_context',result:{sources:2000}},{tool:'read_library',result:{sources:[{id:'S1',text:'full source',sectionID:'123'}]}}]).map(t=>t.sources),[undefined,[{id:'S1',sectionID:'123',title:undefined,recalledFrom:undefined}]],'Archive counts and actual source lists have different shapes');
console.log('Assistant profiling: phase attribution, ledger-compatible cost, overlapping waits and token/tool totals passed.');
