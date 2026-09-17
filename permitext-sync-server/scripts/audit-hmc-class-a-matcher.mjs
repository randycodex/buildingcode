import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {auditHMCClassA} from './audit-hmc-class-a-applicability.mjs';
import {hmcGeneralSectionExclusions} from './definition-sources/bind-hmc-general-applicability.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';

// Hypothesis only: never writes or activates the published registry.
export function proposedClassAEntry(original) {
 const exclusions=hmcGeneralSectionExclusions();
 return {...original,applicableExactSections:undefined,excludedOccurrences:undefined,applicability:'definition-chapter',applicableChapters:['2','3','5'],applicableSections:['27-2033.1','27-2041.2','27-2043','27-2063','27-2140'],...exclusions,excludedExactSections:[...exclusions.excludedExactSections,'27-2045'],aliases:['class A multiple dwellings']};
}
export function hypotheticalClassARegistry(registry,entry) {
 let replaced=0;
 const proposed={...registry,books:registry.books.map(book=>({...book,entries:book.entries.map(e=>{if(e.id!==entry.id)return e;replaced++;return entry;})}))};
 if(replaced!==1)throw Error('Expected exactly one original Class A entry');
 return proposed;
}
function allMatches(registry,paragraph) {
 const context={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterNumber:String(paragraph.chapter),sectionNumber:paragraph.section};
 return createDefinitionMatcher(definitionsForReader(registry,context),{sectionNumber:paragraph.section})(paragraph.text);
}
export function matchClassAParagraph(registry,entry,paragraph) {
 return allMatches(registry,paragraph).filter(m=>m.entries.some(e=>e.id===entry.id));
}
export async function auditHMCClassAMatcher() {
 const inventory=await auditHMCClassA();
 const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
 const entry=proposedClassAEntry(inventory.original),proposed=hypotheticalClassARegistry(registry,entry);
 for(const alias of entry.aliases)if(!inventory.occurrences.some(o=>o.classification==='candidate'&&o.text.slice(o.start,o.end).toLowerCase()===alias.toLowerCase()))throw Error('Unattested Class A alias');
 const paragraphs=inventory.paragraphs.map(p=>{
  const matches=matchClassAParagraph(proposed,entry,p),expected=p.ranges.filter(r=>r.classification==='candidate');
  if(JSON.stringify(matches.map(m=>[m.start,m.end]))!==JSON.stringify(expected.map(r=>[r.start,r.end])))throw Error(`Class A matcher differs from source candidates: ${p.section} paragraph ${p.paragraphIndex}`);
  const others=r=>allMatches(r,p).flatMap(m=>m.entries.filter(e=>e.id!==entry.id&&e.id!=='3f92fb27b805373fcf42').map(e=>[m.start,m.end,e.id]));
  if(JSON.stringify(others(proposed))!==JSON.stringify(others(registry)))throw Error(`Other definition matches changed: ${p.section} paragraph ${p.paragraphIndex}`);
  return {...p,matches:matches.map(m=>({start:m.start,end:m.end,id:entry.id}))};
 });
 const accepted=paragraphs.reduce((n,p)=>n+p.matches.length,0);
 if(accepted!==24)throw Error('Expected all 24 source candidates');
 return {status:'Hypothetical full-registry matcher only; not activated or visually accepted',entry,bodySHA256:inventory.bodySHA256,sources:inventory.sources,counts:inventory.counts,occurrences:37,accepted,excluded:13,paragraphs};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw Error('Pass output path');
 const report=await auditHMCClassAMatcher();await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,accepted:report.accepted,excluded:report.excluded}));
}
