import assert from 'node:assert/strict';
import {assistantLibraryNavigation} from '../assistant-library-navigation.mjs';
import {runExperimentalAssistant} from '../assistant-experimental.mjs';
const catalog=Array.from({length:320},(_,i)=>({id:`source-${i}`,codeVersion:'edition-1',codeEdition:'Edition',codePrefix:'TEST',chapterNumber:8,sectionNumber:`8.${i}.1`,title:`8.${i}.1 Requirement ${i}`}));
catalog.push({id:'deep',codeVersion:'edition-1',codeEdition:'Edition',codePrefix:'TEST',chapterNumber:8,sectionNumber:'8.1.1.2',title:'Detailed exception'});
const navigation=assistantLibraryNavigation(catalog,[{codePrefix:'TEST',chapterNumber:8,fullTitle:'Chapter 8: People and facilities'}]);
assert.equal(navigation.guide[0].title,'Chapter 8: People and facilities');
assert(navigation.outlines(['C1'])[0].headings.some(h=>h.id==='source-319'),'Later primary headings must not be hidden by an arbitrary list cutoff');
assert.match(navigation.outlines(['C1'])[0].coverage,/Deeper subsections/);
const message=text=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text}]}]});
const invoke=(name,args,id)=>({status:'completed',output:[{type:'function_call',call_id:id,name,arguments:JSON.stringify(args)}]});
let step=0,readCount=0;
const result=await runExperimentalAssistant({question:'Can this facility be located upstairs?',projectContext:{users:'Residents'},libraryGuide:navigation.guide},{
 libraryOutlines:navigation.outlines,
 searchLibrary:async()=>({sources:[{id:'S4',sectionID:'source-319',title:'Governing requirement',text:'Complete actual rule with exceptions.'}]}),
 readLibrary:async(ids)=>{assert.deepEqual(ids,['S4']);readCount++;return {sources:[{id:'S4',sectionID:'source-319',title:'Governing requirement',text:'Complete actual rule with exceptions.'}]};},
 call:async(body,{phase})=>{
 if(phase==='experimental_navigation'){assert(JSON.parse(body.input).chapterOutlines[0].headings.some(h=>h.id==='source-319'));return message(JSON.stringify({ids:[]}));}
 if(phase==='experimental_intent'){
  const context=JSON.parse(body.input);assert(context.libraryGuide.length);assert.equal(context.latestExchange.length,0);
  assert(body.text.format.schema.required.includes('issues'));
  return message(JSON.stringify({question:'Which requirements govern this location for its users?',subject:'Facility access',reference:'Current project',clarification:'',evidenceIDs:[],chapterIDs:['C1'],issues:[{question:'What connections must serve the users?',reason:'A common facility serves residents',query:'common facility service requirements'}]}));
 }
 step++;const context=JSON.parse(body.input[0].content);assert.equal(context.chapterOutlines[0].id,'C1');assert(!context.chapterOutlines[0].headings,'Full outlines belong in navigation, not repeated generation context');
 if(step===1)return invoke('search_library',{query:'common facility'},'search');
 if(step===2){const output=JSON.parse(body.input.at(-1).output);assert(output.candidates.length);assert.equal(output.candidates[0].preview,'Complete actual rule with exceptions.');assert(!output.sources);assert(!context.readEvidence.length);return invoke('read_library',{sectionIDs:['S4']},'read');}
 assert.equal(context.readEvidence[0].text,'Complete actual rule with exceptions.');assert(!JSON.parse(body.input.at(-1).output).sources[0].text,'No repeated source text in the tool transcript');
 return message('The facility must meet the required connection. [S4]');
 }});
assert.equal(readCount,1);assert.match(result.text,/\[S4\]/);assert.equal(result.trace[0].tool,'plan_research');
console.log('Library navigation: complete later headings, first-turn discipline planning, candidate previews, direct reads and compact evidence context passed.');
const {governingChapterIDs,governingSectionContext}=await import('../assistant-library-navigation.mjs');
assert(governingChapterIDs({chapterIDs:['wrong'],issues:[{question:'How do we meet energy conservation obligations?',query:'energy conservation'}]},[{id:'energy',title:'Energy Conservation'},{id:'wrong',title:'Conveying Systems'}]).includes('energy'));
const family=['1','1.1','1.2','1.3','2.1'].map((number,index)=>({id:`p${index}`,sectionNumber:number,codePrefix:'TEST',codeVersion:'same',chapterNumber:1}));
const surrounding=governingSectionContext(['p3'],family);
assert.deepEqual(surrounding.map(s=>s.id),['p3','p0','p2']);
assert.equal(surrounding[1].contextFor,'p3');
assert(governingSectionContext(['p2'],family).some(s=>s.id==='p3'&&s.contextFor==='p2'));
assert(!governingSectionContext(['unknown'],family).length);
console.log('Governing discovery: issue-to-heading binding, parent scope and preceding sibling context passed.');
const previewOnly=await runExperimentalAssistant({question:'Explain the requirement.',libraryGuide:navigation.guide},{libraryOutlines:navigation.outlines,readLibrary:async()=>({sources:[]}),searchLibrary:async()=>({sources:[{id:'S4',sectionID:'source-319',text:'Candidate preview only'}]}),call:async(body,{phase})=>{
 if(phase==='experimental_intent')return message(JSON.stringify({question:'Explain requirement',subject:'Requirement',reference:'current',clarification:'',evidenceIDs:[],chapterIDs:[],issues:[]}));
 if(body.input.at(-1).type==='function_call_output')return message('This rule applies [S4, S99].');
 return invoke('search_library',{query:'candidate requirement'},'preview');
}});
assert(!/\[S4[,\]]/.test(previewOnly.text));assert.match(previewOnly.text,/source not verified/);
console.log('Evidence identity: grouped citations cannot bypass reading the actual source.');
