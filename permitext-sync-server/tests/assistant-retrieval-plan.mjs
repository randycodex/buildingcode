import assert from 'node:assert/strict';
import {planAssistantRetrieval} from '../assistant-retrieval-plan.mjs';
const payload=value=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]});
const history=[{role:'user',question:'We are adding an occupied roof terrace.'},{role:'assistant',answer:{answerText:'Check access. [S1]',citations:[{codePrefix:'BC',sectionNumber:'test',codeEdition:'2022',title:'Test source'}]}}];
let packet;
const result=await planAssistantRetrieval({question:'Does it need elevator access?',history,topicContext:{currentTopic:'roof terrace'},projectFacts:['The roof is not occupied.','Assumed district, not verified.'],call:async body=>{
 packet=JSON.parse(body.input);assert.equal(body.model,'gpt-6-luna');
 return payload({queries:['elevator access occupied rooftop'],clarification:'',context:[{factID:'P1',quote:'occupied'},{factID:'P2',quote:'invented information'}]});
}});
assert.equal(packet.history[1].citations[0].sectionNumber,'test');
assert.equal(packet.topicContext.currentTopic,'roof terrace');
assert.equal(result.context.length,1,'Invented project quotations cannot enter retrieval');
assert.match(result.context[0],/not occupied/,'A selected word cannot strip the containing negative condition');
const ambiguous=await planAssistantRetrieval({question:'Can I make it smaller?',call:async()=>payload({queries:[],context:[],clarification:'Do you mean the stair width or the roof terrace?'})});
assert.equal(ambiguous.queries.length,0);assert.match(ambiguous.clarification,/stair width/);
console.log('Assistant planning: conversation/topic/citation leads, exact project context, negation preservation and ambiguity passed; no paid calls.');
const {selectAssistantEvidence}=await import('../assistant-retrieval-plan.mjs');
const fullSource={sectionID:'canonical-1',codePrefix:'BC',sectionNumber:'example',text:'Full exact text '+ 'z'.repeat(3000)};
const selection=await selectAssistantEvidence({question:'What governs?',sources:[fullSource],call:async body=>{
 const candidate=JSON.parse(body.input).candidates[0];assert.equal(candidate.excerptClipped,true);
 return payload({ids:['C1']});
}});
assert.equal(selection.sources[0],fullSource,'Relevance selection returns full canonical sources, not clipped excerpts');
await assert.rejects(selectAssistantEvidence({question:'What governs?',sources:[fullSource],call:async()=>payload({ids:['C999']})}),/Invalid Assistant source selection/);

await assert.rejects(planAssistantRetrieval({question:'What about it?',call:async()=>payload({queries:[],context:[],clarification:true})}),/Invalid Assistant retrieval plan/);

const unavailable=await selectAssistantEvidence({question:'Authority absent from library',sources:[fullSource],call:async()=>payload({ids:[]})});
assert.deepEqual(unavailable.sources,[],'Irrelevant candidates must not be forced into the answer evidence');
