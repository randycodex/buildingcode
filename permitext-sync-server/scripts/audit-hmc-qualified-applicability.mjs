import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parse} from 'parse5';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
import {hmcGeneralSourceHashes,hmcGeneralSectionExclusions} from './definition-sources/bind-hmc-general-applicability.mjs';

// Read-only proposal audit. This does not change published applicability.
const hash=value=>createHash('sha256').update(value).digest('hex');
const text=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join('');
const nodes=(node,tag,out=[])=>{if(node.tagName===tag)out.push(node);for(const child of node.childNodes||[])nodes(child,tag,out);return out;};
export async function auditHMCQualifiedApplicability(){
 const bytes=await readFile(new URL('../public/reader-definition-registry.json',import.meta.url));
 const registry=JSON.parse(bytes),book=registry.books.find(b=>b.bundle==='2026-enacted-administrative-code'&&b.chapterID===30000077);
 const names=['Tenement','Dormitory'];
 const originals=book.entries.filter(e=>names.includes(e.term));
 if(originals.length!==2||originals.some(e=>e.source.sectionNumber!=='27-2004'))throw Error('Qualified inventory changed');
 const exclusions=section=>({section,phrases:['old law or new law tenement','new law tenements','new law tenement','fireproof tenement'].map(text=>({text,occurrence:0}))});
 const proposals=originals.map(e=>({...e,applicability:'definition-chapter',applicableChapters:['1','2','3','4','5'],...hmcGeneralSectionExclusions(),aliases:e.term==='Tenement'?['tenements']:['dormitories'],...(e.term==='Tenement'?{excludedOccurrences:['27-2060','27-2066','27-2074','27-2081','27-2085','27-2089'].map(exclusions)}:{excludedExactSections:[...hmcGeneralSectionExclusions().excludedExactSections,'27-2041','27-2093.1']})}));
 const proposed={...registry,books:registry.books.map(b=>b===book?{...b,entries:b.entries.map(e=>proposals.find(p=>p.id===e.id)||e)}:b)};
 const result={status:'Source-review proposal only; not activated or visually accepted',registrySHA256:hash(bytes),originals,proposals,counts:{Tenement:0,Dormitory:0},paragraphs:[]};
 for(const chapter of ['1','2','3','4','5']){
  const file=`2026-enacted-administrative-code/chapters/${30000076+Number(chapter)}.html`;
  const html=await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+file,import.meta.url),'utf8');
  if(hash(html)!==hmcGeneralSourceHashes[chapter])throw Error('HMC source changed '+chapter);
  for(const section of nodes(parse(html),'section')){
   const heading=section.childNodes.find(n=>n.tagName==='h3');
   const number=text(heading).match(/^27-\s*\d+(?:\.\d+)*/)?.[0].replace(/\s/g,'');
   if(!number)throw Error('Unmapped HMC section');
   const entries=definitionsForReader(proposed,{bundle:book.bundle,codeSectionID:5,chapterNumber:chapter,sectionNumber:number});
   const matcher=createDefinitionMatcher(entries,{sectionNumber:number});
   for(const [index,p] of nodes(section,'p').entries()){
    const body=text(p),variants=[...body.matchAll(/\b(?:tenements?|dormitor(?:y|ies))\b/gi)].map(m=>({text:m[0],start:m.index,end:m.index+m[0].length}));
    if(!variants.length)continue;
    const matches=matcher(body).filter(m=>m.entries.some(e=>names.includes(e.term))).map(m=>({text:m.text,start:m.start,end:m.end,terms:m.entries.filter(e=>names.includes(e.term)).map(e=>e.term)}));
    for(const m of matches)for(const term of m.terms)result.counts[term]++;
    result.paragraphs.push({file,sourceSHA256:hash(html),section:number,anchor:section.attrs.find(a=>a.name==='id')?.value,paragraphIndex:index,text:body,paragraphSHA256:hash(body),variants,matches});
   }
  }
 }
 return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const result=await auditHMCQualifiedApplicability();
 if(!process.argv[2])throw Error('Pass output JSON path');
 await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({output:process.argv[2],status:result.status,counts:result.counts,paragraphs:result.paragraphs.length}));
}
