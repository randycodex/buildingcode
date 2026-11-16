import assert from 'node:assert/strict';
import {assistantLibraryNavigation,governingChapterIDs,governingSectionContext} from '../assistant-library-navigation.mjs';
import {runAssistant} from '../assistant-engine.mjs';
const catalog=Array.from({length:320},(_,i)=>({id:`source-${i}`,codeVersion:'edition-1',codeEdition:'Edition',codePrefix:'TEST',chapterNumber:8,sectionNumber:`8.${i}.1`,title:`8.${i}.1 Requirement ${i}`}));
const navigation=assistantLibraryNavigation(catalog,[{codePrefix:'TEST',chapterNumber:8,fullTitle:'Chapter 8: People and facilities'}]);
assert(navigation.outlines(['C1'])[0].headings.some(h=>h.id==='source-319'));
const message=text=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]});
const invoke=(name,args,id)=>({status:'completed',output:[{type:'function_call',call_id:id,name,arguments:JSON.stringify(args)}]});
let step=0;
const result=await runAssistant({question:'Can this facility be located upstairs?',projectContext:{users:'Residents'},libraryGuide:navigation.guide},{
 searchLibrary:async()=>({evidenceStatus:'verified_library_text',sources:[{id:'S4',sectionID:'source-319',text:'Complete actual rule with exceptions.',tables:[{rows:[['Item','Value']]}]}]}),
 readLibrary:()=>assert.fail('No forced second read of verified search text'),
 call:async(body,{phase})=>{
  assert.equal(phase,'experimental');assert(!body.text?.format);const context=JSON.parse(body.input[0].content);
  assert(!context.libraryGuide&&!context.chapterOutlines,'No full guide or headings in the normal model path');
  if(++step===1)return invoke('search_library',{query:'required connections for common facilities serving residents'},'search');
  assert.equal(context.readEvidence[0].text,'Complete actual rule with exceptions.');assert.equal(context.readEvidence[0].tables.length,1);
  assert(!JSON.parse(body.input.at(-1).output).sources[0].text,'Full evidence appears once in the request');
  return message('The facility must meet the required connection. [S4]');
 }});
assert.equal(step,2);assert.match(result.text,/\[S4\]/);
let readCount=0;step=0;
const conditional=await runAssistant({question:'Does an exception apply?'},{
 searchLibrary:async()=>({evidenceStatus:'verified_library_text',sources:[{id:'S1',sectionID:'rule',text:'Rule, subject to the exception in another provision.'}]}),
 readLibrary:async ids=>{assert.deepEqual(ids,['exception']);readCount++;return {sources:[{id:'S2',sectionID:'exception',text:'The complete exception and its footnote.'}]};},
 call:async body=>{
  if(++step===1)return invoke('search_library',{query:'current controlling rule'},'first');
  if(step===2)return invoke('read_library',{sectionIDs:['exception']},'additional');
  assert.equal(JSON.parse(body.input[0].content).readEvidence.length,2);return message('The exception applies conditionally. [S1] [S2]');
 }});
assert.equal(readCount,1);assert.match(conditional.text,/\[S2\]/);
step=0;
const preview=await runAssistant({question:'Explain the requirement.'},{
 searchLibrary:async()=>({candidates:[{id:'S4',preview:'A heading only'}]}),
 call:async()=>++step===1?invoke('search_library',{query:'requirement'},'preview'):message('This rule applies [S4, S99].')
});
assert(!/\[S4[,\]]/.test(preview.text));assert.match(preview.text,/source not verified/);
const family=['1','1.1','1.2','1.3','2.1'].map((number,index)=>({id:`p${index}`,sectionNumber:number,codePrefix:'TEST',codeVersion:'same',chapterNumber:1}));
assert.deepEqual(governingSectionContext(['p3'],family).map(s=>s.id),['p3','p0','p2']);
assert(governingChapterIDs({issues:[{question:'energy conservation'}]},[{id:'energy',title:'Energy Conservation'}]).includes('energy'));
console.log('Library: two-call verified search, preserved tables, no mandatory planner/read, conditional exception read, preview citation rejection and context helpers passed.');
const linked=await runAssistant({question:'Where can I see it?',attachedSources:[{id:'S2',sectionID:'actual-section',text:'Actual supplied rule'}]},{
 call:async()=>message('[The table](#actual-section) 【S2, S99】 [Unknown](#invented)')
});
assert.match(linked.text,/\[S2\]/);assert(!linked.text.includes('#actual-section'));
assert(!linked.text.includes('[S99]'));assert(!linked.text.includes('#invented'));
assert.match(linked.text,/source not verified/);
console.log('Citation protocol: explicit verified section links normalized; unknown IDs remain unverified.');
