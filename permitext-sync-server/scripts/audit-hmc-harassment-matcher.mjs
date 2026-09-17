import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {auditHMCHarassment} from './audit-hmc-harassment-applicability.mjs';
import {hmcHarassmentApplicability} from './definition-sources/bind-hmc-harassment.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';

// Hypothesis only. This module never writes the registry or changes runtime behavior.
export function proposedHarassmentEntry(original) {
 return {...original,...hmcHarassmentApplicability()};
}
export function hypotheticalHarassmentRegistry(registry,entry) {
 let replaced=0;
 const proposed={...registry,books:registry.books.map(book=>({...book,entries:book.entries.map(e=>{if(e.id!==entry.id)return e;replaced++;return entry;})}))};
 if(replaced!==1)throw Error('Expected exactly one original Harassment entry');
 return proposed;
}
export function matchHarassmentParagraph(registry,entry,paragraph) {
 const entries=definitionsForReader(registry,{bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterNumber:String(paragraph.chapter),sectionNumber:paragraph.section});
 return createDefinitionMatcher(entries,{sectionNumber:paragraph.section})(paragraph.text).filter(m=>m.entries.some(e=>e.id===entry.id));
}
export async function auditHMCHarassmentMatcher() {
 const inventory=await auditHMCHarassment();
 const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
 const entry=proposedHarassmentEntry(inventory.original),proposed=hypotheticalHarassmentRegistry(registry,entry);
 // Attest every proposed phrase directly against the guarded source corpus.
 for(const rule of entry.excludedOccurrences)for(const phrase of rule.phrases){
  const sources=inventory.paragraphs.filter(p=>p.section===rule.section&&p.text.toLowerCase().includes(phrase.text.toLowerCase()));
  if(!sources.length)throw Error('Unattested exclusion: '+phrase.text);
  if(sources.some(p=>p.ranges.some(r=>r.classification==='candidate'&&r.start>=p.text.toLowerCase().indexOf(phrase.text.toLowerCase())&&r.end<=p.text.toLowerCase().indexOf(phrase.text.toLowerCase())+phrase.text.length)))throw Error('Exclusion overlaps accepted candidate: '+phrase.text);
 }
 const paragraphs=inventory.paragraphs.map(p=>{
  const matches=matchHarassmentParagraph(proposed,entry,p),expected=p.ranges.filter(r=>r.classification==='candidate');
  if(JSON.stringify(matches.map(m=>[m.start,m.end]))!==JSON.stringify(expected.map(r=>[r.start,r.end])))throw Error(`Harassment matcher differs from source candidates: ${p.section} paragraph ${p.paragraphIndex}`);
  return {...p,matches:matches.map(m=>({start:m.start,end:m.end,id:entry.id}))};
 });
 const accepted=paragraphs.reduce((n,p)=>n+p.matches.length,0);
 if(accepted!==38)throw Error('Expected all 38 source candidates, without reducing scope');
 return {status:'Hypothetical full-registry matcher only; not activated or visually accepted',entry,bodySHA256:inventory.bodySHA256,sources:inventory.sources,counts:inventory.counts,occurrences:125,accepted,excluded:87,paragraphs};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw Error('Pass output path');
 const report=await auditHMCHarassmentMatcher();await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,accepted:report.accepted,excluded:report.excluded}));
}
