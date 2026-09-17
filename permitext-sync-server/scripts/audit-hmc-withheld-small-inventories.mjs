import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parse} from 'parse5';
import {hmcGeneralSourceHashes} from './definition-sources/bind-hmc-general-applicability.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const text=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');
const nodes=(n,tag,out=[])=>{if(n.tagName===tag)out.push(n);for(const c of n.childNodes||[])nodes(c,tag,out);return out;};
export async function auditHMCSmallInventories(){
 const terms={'Rear yard':/\brear\s+yards?\b/gi,'Side yard':/\bside\s+yards?\b/gi,'Public part of a dwelling':/\bpublic\s+parts?\s+of\s+(?:a|the)\s+dwelling\b/gi,'Hotel':/\bhotels?\b/gi,'Curb level':/\bcurb\s+levels?\b/gi};
 const result={status:'Lexical inventory only; no activation',terms:Object.fromEntries(Object.keys(terms).map(term=>[term,{definition:0,application:0,paragraphs:[]}]))};
 for(let chapter=1;chapter<=5;chapter++){
  const file=`2026-enacted-administrative-code/chapters/${30000076+chapter}.html`,html=await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+file,import.meta.url),'utf8');if(hash(html)!==hmcGeneralSourceHashes[chapter])throw Error('Source changed '+chapter);
  for(const section of nodes(parse(html),'section')){
   const number=text(section.childNodes.find(n=>n.tagName==='h3')).match(/^27-\s*\d+(?:\.\d+)*/)?.[0].replace(/\s/g,'');if(!number)throw Error('Unmapped section');
   for(const [index,p] of nodes(section,'p').entries())for(const [term,pattern] of Object.entries(terms)){
    const body=text(p),ranges=[...body.matchAll(pattern)].map(m=>({text:m[0],start:m.index,end:m.index+m[0].length}));if(!ranges.length)continue;
    const entry=result.terms[term];entry[number==='27-2004'?'definition':'application']+=ranges.length;entry.paragraphs.push({file,sourceSHA256:hash(html),section:number,paragraphIndex:index,text:body,ranges});
   }
  }
 }
 return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){if(!process.argv[2])throw Error('Pass output path');const r=await auditHMCSmallInventories();await writeFile(process.argv[2],JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(Object.fromEntries(Object.entries(r.terms).map(([k,v])=>[k,{definition:v.definition,application:v.application}]))));}
