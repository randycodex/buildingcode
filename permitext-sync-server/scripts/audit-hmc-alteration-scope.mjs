import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parse} from 'parse5';
import {hmcGeneralSourceHashes} from './definition-sources/bind-hmc-general-applicability.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const text=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');
const nodes=(n,tag,out=[])=>{if(n.tagName===tag)out.push(n);for(const c of n.childNodes||[])nodes(c,tag,out);return out;};
export async function auditHMCAlterationScope(){
 const registry=JSON.parse(await readFile(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
 const original=registry.books.find(b=>b.chapterID===30000077).entries.find(e=>e.term==='Alteration');
 if(original.id!=='4d33bc1533510d86e707')throw Error('Alteration identity changed');
 const out={status:'Source audit only; no activation',original,paragraphs:[],counts:{definition:0,localDefinition:0,externalCategory:0,permitCompound:0,ordinaryCandidate:0}};
 for(const chapter of ['1','2','3','4','5']){
  const file=`2026-enacted-administrative-code/chapters/${30000076+Number(chapter)}.html`;
  const html=await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+file,import.meta.url),'utf8');
  if(hash(html)!==hmcGeneralSourceHashes[chapter])throw Error('Source changed '+chapter);
  for(const section of nodes(parse(html),'section')){
   const number=text(section.childNodes.find(n=>n.tagName==='h3')).match(/^27-\s*\d+(?:\.\d+)*/)?.[0].replace(/\s/g,'');
   if(!number)throw Error('Unmapped section');
   for(const [index,p] of nodes(section,'p').entries()){
    const body=text(p),ranges=[...body.matchAll(/\balterations?\b/gi)].map(m=>{
     const classification=number==='27-2004'?'definition':number==='27-2074'?'localDefinition':['27-2009.2','27-2093','27-2093.1'].includes(number)?'externalCategory':/^\s+permit\b/i.test(body.slice(m.index+m[0].length))?'permitCompound':'ordinaryCandidate';
     out.counts[classification]++;return {text:m[0],start:m.index,end:m.index+m[0].length,classification};
    });
    if(ranges.length)out.paragraphs.push({file,sourceSHA256:hash(html),section:number,anchor:section.attrs.find(a=>a.name==='id')?.value,paragraphIndex:index,text:body,paragraphSHA256:hash(body),ranges});
   }
  }
 }
 return out;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw Error('Pass output JSON path');const result=await auditHMCAlterationScope();await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({counts:result.counts,paragraphs:result.paragraphs.length,output:process.argv[2]}));
}
