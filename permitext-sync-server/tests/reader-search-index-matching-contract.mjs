import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import {readerSearchMatch,snippetForMatch,readerSearchResultHeading,searchReaderTextSections} from "../public/reader-search-match.js";
const source=await readFile(new URL('./fixtures/reader-search-legacy-match.js',import.meta.url),'utf8');
const start=source.indexOf('function readerSearchBlockMatches(');
const end=source.length;
const context=vm.createContext({readerSearchMatch,snippetForMatch,readerSearchResultHeading,
 annotatedBlocksForSection:section=>section.blocks,
 annotationTargetForBlock:(_section,block)=>({blockID:block.id}),
 plainTextForSearchBlock:block=>block.plainText});
vm.runInContext(source.slice(start,end),context);
const sections=[
 {id:1,sectionNumber:'202',title:'Definitions',displayTitle:'202 Definitions',blocks:[
  {id:'closed',plainText:'CLOSED SYSTEM. Examples include hazardous materials conveyed through a piping system.'},
  {id:'hazardous',plainText:'HAZARDOUS MATERIALS. Those chemicals or substances that are physical hazards or health hazards.'}]},
 {id:2,sectionNumber:'403',title:'Concrete walls',displayTitle:'403 Concrete walls',blocks:[
  {id:'nested-list',plainText:'1. Concrete and masonry walls. 2. Reinforcement.'},
  {id:'table',plainText:'Minimum thickness 6 inches. Maximum height 20 feet.'}]},
 {id:3,sectionNumber:'404',title:'Reserved',displayTitle:'404 Reserved',blocks:[]},
 {id:4,sectionNumber:'405',title:'Unicode',displayTitle:'405 Unicode',blocks:[{id:'unicode',plainText:'Café   façade — thermal barrier.\nConcrete slab.'}]}
];
for(const query of ['hazardous materials','harzadous materials','Concrete','concret','minimum thickness','6 inches','Reserved','Café façade','thermal barrier','no-such-term','concrete and masonry','40','ha','']){
 const projected=sections.map(section=>({...section,blocks:section.blocks.map(block=>({blockID:block.id,text:block.plainText}))}));
 const actual=searchReaderTextSections(projected,query);
 const expected=[];
 if(query.trim().length>=2) for(const section of sections){
  const titleMatch=readerSearchMatch(section.displayTitle,query);
  const blockMatch=context.bestReaderSearchBlockMatch(section,query);
  const match=titleMatch||blockMatch?.match;
  if(!match) continue;
  const snippetMatch=blockMatch?.match||match;
  expected.push({sectionID:section.id,sectionNumber:section.sectionNumber,title:section.title,
   heading:readerSearchResultHeading(section.displayTitle,blockMatch),
   headingHighlight:titleMatch?.text||blockMatch?.match?.text||query,
   snippet:snippetForMatch(blockMatch?.text||section.title,snippetMatch),snippetHighlight:snippetMatch.text,
   matchText:match.text,blockID:blockMatch?.blockID||''});
 }
 assert.deepEqual(actual,expected,query);
}
console.log('Indexed Reader matching preserves legacy results, snippets, definition ranking, typo recovery and exact paragraph targets.');
