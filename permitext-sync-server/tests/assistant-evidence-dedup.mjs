import assert from 'node:assert/strict';
import {assistantRequestInput,runAssistant} from '../assistant-engine.mjs';

const source={id:'S1',sectionID:'test-rule',codeVersion:'edition-1',edition:'Test edition',jurisdiction:'NYC',authority:'enacted',
 text:'Exact rule. Exception: retain the accessible route.\nFootnote a: maintain the air gap.',
 tables:[{text:'Original table and footnote a.',grids:[{rows:[{cells:[{text:'',rowSpan:2},{text:'Minimum',columnSpan:2}]},{cells:[{text:'Above'},{text:'Side'}]}]}]}]};
const context={question:'Does that exception change it?',projectContext:{proposedStories:8,existingStories:6,conflict:'Elevation not verified'},
 attachedPassages:[source],conversationArchive:{messages:2000,sources:2000},priorSourceCandidates:[{id:'R1',title:'Earlier rule'}]};
const input=[{role:'user',content:JSON.stringify(context)},
 {role:'user',content:'Correction: the entrance is 42 inches, not the earlier 39-inch assumption.'},
 {role:'assistant',content:'The current subject is the shared terrace.'},
 {role:'user',content:'Does that exception change it?'}];
const recalled={...source,recalledFrom:'R1',priorQuestion:'Can residents use this terrace?'};
const baseline=[...input];baseline[0]={...input[0],content:JSON.stringify({...context,readEvidence:[recalled]})};
const packed=assistantRequestInput(input,new Map([[source.id,recalled]])),after=JSON.parse(packed[0].content);
assert.deepEqual(packed.slice(1),baseline.slice(1),'All selected conversation messages remain byte-for-byte identical');
assert.deepEqual(after.readEvidence,[recalled],'The complete rule, exceptions, tables, spanning headers and footnotes remain');
assert.deepEqual(after.attachedPassages,[{...source,text:undefined,tables:undefined}].map(({text,tables,...s})=>s));
assert.deepEqual({...after,attachedPassages:after.attachedPassages.map(s=>({...source,...s}))},JSON.parse(baseline[0].content),
 'The original context can be reconstructed exactly from the remaining source body and metadata');
assert(Buffer.byteLength(JSON.stringify(packed))<Buffer.byteLength(JSON.stringify(baseline)));
assert.deepEqual(input[0],{role:'user',content:JSON.stringify(context)},'Preparing transport does not mutate source/context records');

for(const changed of [{text:source.text+' Additional condition.'},{codeVersion:'edition-2'},{sectionID:'different-rule'},
 {id:'S2'},{authority:'guidance'}]){
 const distinct={...recalled,...changed};
 const result=JSON.parse(assistantRequestInput(input,new Map([[distinct.id,distinct]]))[0].content);
 assert.equal(result.attachedPassages[0].text,source.text,'Distinct text or source identities are never combined');
 assert.deepEqual(result.readEvidence[0],distinct);
}
const differentTable={...recalled,tables:[...source.tables,{text:'Additional table footnote.'}]};
const distinctTables=JSON.parse(assistantRequestInput(input,new Map([['S1',differentTable]]))[0].content);
assert.deepEqual(distinctTables.readEvidence[0].tables,differentTable.tables);assert.deepEqual(distinctTables.attachedPassages[0].tables,source.tables);

// Reproduce the shared source array used by HTTP recall. Both source records
// remain available, but the model receives their text/table content just once.
const attached=[],prior=[{id:'R1',sectionID:source.sectionID,title:'Shared terrace exception'}];let modelCalls=0,recalls=0;
const answer=await runAssistant({question:context.question,projectContext:context.projectContext,
 history:input.slice(1,-1).map(m=>({role:m.role,text:m.content})),attachedSources:attached,priorEvidence:prior},{
 recallEvidence:async()=>{recalls++;attached.push(source);return {sources:[recalled]};},
 searchLibrary:()=>assert.fail('Deduplication must not introduce retrieval'),
 call:async body=>{modelCalls++;const c=JSON.parse(body.input[0].content);
  assert.equal(c.readEvidence[0].text,source.text);assert.deepEqual(c.readEvidence[0].tables,source.tables);
  assert.equal(c.attachedPassages[0].text,undefined);assert.equal(c.attachedPassages[0].id,'S1');assert.equal(c.readEvidence[0].recalledFrom,'R1');
  assert.deepEqual(c.projectContext,context.projectContext);assert.equal(body.input[2].content,input[2].content);
  return {status:'completed',output:[{type:'message',content:[{type:'output_text',text:'The exception retains the condition. [S1] [S99]'}]}]};
 }
});
assert.equal(modelCalls,1);assert.equal(recalls,1);assert.match(answer.text,/\[S1\]/);assert(!answer.text.includes('[S99]'));
assert.deepEqual(attached,[source]);assert.deepEqual(answer.trace.find(t=>t.tool==='recall_evidence').result.sources,[recalled]);
console.log('Evidence dedup: exact reconstruction, full source/table/footnote retention, unchanged conversation and project context, distinct-identity protection, no added calls and citation safeguards passed.');
