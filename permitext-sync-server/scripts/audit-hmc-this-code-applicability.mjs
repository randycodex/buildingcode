import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parse} from 'parse5';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
import {hmcGeneralSourceHashes,hmcGeneralSectionExclusions} from './definition-sources/bind-hmc-general-applicability.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const text=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');
const nodes=(n,tag,out=[])=>{if(n.tagName===tag)out.push(n);for(const c of n.childNodes||[])nodes(c,tag,out);return out;};
export async function auditHMCThisCode(){
 const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
 const book=registry.books.find(b=>b.chapterID===30000077),original=book.entries.find(e=>e.term==='This code');
 if(original.id!=='36ec815a89e5f6032f66'||original.text!=='This code shall mean the housing maintenance code.')throw Error('This code source identity changed');
 const external={'27-2056.4':['17-179','17-123'],'27-2056.9':['17-179'],'27-2056.13':['17-179'],'27-2109.1':['28-210.1'],'27-2129.1':['28-219.4'],'27-2151':['27-198.2']};
 const exclusions=Object.entries(external).map(([section,refs])=>({section,phrases:refs.map(ref=>({text:`section ${ref} of this code`,occurrence:0}))}));
 exclusions.push({section:'27-2093',phrases:[{text:'subchapter five of this code',occurrence:0}]},{section:'27-2118',phrases:[{text:'constituting a violation of this code',occurrence:0}]});
 const proposal={...original,applicability:'definition-chapter',applicableChapters:['1','2','3','4','5'],...hmcGeneralSectionExclusions(),excludedOccurrences:exclusions};
 const hypothetical={...registry,books:registry.books.map(b=>b===book?{...b,entries:b.entries.map(e=>e.id===original.id?proposal:e)}:b)};
 const report={status:'Audit proposal only; no activation',original,proposal,counts:{definition:0,external:0,inlineDefinition:0,candidate:0},matches:0,paragraphs:[]};
 for(let chapter=1;chapter<=5;chapter++){
  const file=`2026-enacted-administrative-code/chapters/${30000076+chapter}.html`,html=await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+file,import.meta.url),'utf8');
  if(hash(html)!==hmcGeneralSourceHashes[chapter])throw Error('Source changed '+chapter);
  for(const section of nodes(parse(html),'section')){
   const number=text(section.childNodes.find(n=>n.tagName==='h3')).match(/^27-\s*\d+(?:\.\d+)*/)?.[0].replace(/\s/g,'');if(!number)throw Error('Unmapped section');
   const matcher=createDefinitionMatcher(definitionsForReader(hypothetical,{bundle:book.bundle,codeSectionID:5,chapterNumber:String(chapter),sectionNumber:number}),{sectionNumber:number});
   for(const [index,p] of section.childNodes.filter(n=>n.tagName==='p').entries()){
    const body=text(p),ranges=[...body.matchAll(/\bthis\s+code\b/gi)].map(m=>{
     const preceding=body.slice(0,m.index),classification=number==='27-2004'?'definition':(external[number]||[]).some(ref=>preceding.endsWith(`section ${ref} of `))?'external':(number==='27-2093'&&index===3)||(number==='27-2118'&&index===4)?'inlineDefinition':'candidate';
     report.counts[classification]++;return {start:m.index,end:m.index+m[0].length,classification};
    });if(!ranges.length)continue;
    const matches=matcher(body).filter(m=>m.entries.some(e=>e.id===original.id));report.matches+=matches.length;
    for(const r of ranges)if(matches.some(m=>m.start===r.start&&m.end===r.end)!==(r.classification==='candidate'))throw Error('Matcher boundary mismatch '+number+' paragraph '+index);
    report.paragraphs.push({file,sourceSHA256:hash(html),section:number,paragraphIndex:index,text:body,paragraphSHA256:hash(body),ranges});
   }
  }
 }
 if(JSON.stringify(report.counts)!==JSON.stringify({definition:6,external:7,inlineDefinition:2,candidate:89})||report.matches!==89)throw Error('This code inventory changed');
 return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){if(!process.argv[2])throw Error('Pass output path');const r=await auditHMCThisCode();await writeFile(process.argv[2],JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({counts:r.counts,matches:r.matches,paragraphs:r.paragraphs.length}));}
