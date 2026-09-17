import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parse} from 'parse5';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
import {hmcGeneralSourceHashes,hmcGeneralSectionExclusions} from './definition-sources/bind-hmc-general-applicability.mjs';
export const architecturalCourtCounts=Object.freeze({'27-2010':1,'27-2015':5,'27-2027':3,'27-2034':2,'27-2038':1,'27-2040':1,'27-2058':4,'27-2059':4,'27-2060':3,'27-2061':2,'27-2062':1,'27-2063':1,'27-2065':2,'27-2071':1,'27-2073':1,'27-2081':1,'27-2083':5,'27-2085':5,'27-2086':1});
const judicialCounts={'27-2041.2':1,'27-2093':3,'27-2093.1':4,'27-2107':3,'27-2109.1':2,'27-2113':1,'27-2114':3,'27-2115':45,'27-2116':6,'27-2117':5,'27-2120':2,'27-2121':4,'27-2122':3,'27-2123':6,'27-2124':2,'27-2127':14,'27-2132':2,'27-2133':4,'27-2134':10,'27-2136':2,'27-2137':2,'27-2140':1,'27-2146':2,'27-2152':2,'27-2153':1};
const hash=s=>createHash('sha256').update(s).digest('hex');
const text=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');
const nodes=(n,tag,out=[])=>{if(n.tagName===tag)out.push(n);for(const c of n.childNodes||[])nodes(c,tag,out);return out};
export async function auditHMCCourtApplicability(){
 const bytes=await readFile(new URL('../public/reader-definition-registry.json',import.meta.url));const registry=JSON.parse(bytes);
 const book=registry.books.find(b=>b.bundle==='2026-enacted-administrative-code'&&b.chapterID===30000077);
 const original=book.entries.find(e=>e.term==='Court');
 if(original?.id!=='6c6074adb2680dd4a441'||original.source.anchor!=='section-31001849'||original.source.sectionNumber!=='27-2004'||original.text!=='A court is an open space other than a side or rear yard, on the same lot as a dwelling. A court not extending to the street or rear yard is an inner court. A court extending to the street or rear yard is an outer court.')throw Error('Court source inventory changed');
 const proposal={...original,aliases:['courts'],applicability:'definition-chapter',applicableChapters:['1','2','3','4','5'],applicableSections:Object.keys(architecturalCourtCounts),...hmcGeneralSectionExclusions()};
 const hypothetical={...registry,books:registry.books.map(b=>b===book?{...b,entries:b.entries.map(e=>e.id===original.id?proposal:e)}:b)};
 const result={status:'Read-only scoped proposal; no product activation or rendered acceptance',registrySHA256:hash(bytes),original,proposal,offsetUnits:'UTF16 decoded paragraph and sourceHTML',sources:[],occurrences:[],counts:{architectural:0,judicial:0,definition:0,unresolved:0},candidateLinks:0};const perSection={};
 for(let chapter=1;chapter<=5;chapter++){
  const file=`2026-enacted-administrative-code/chapters/${30000076+chapter}.html`;const source=await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+file,import.meta.url),'utf8');
  if(hash(source)!==hmcGeneralSourceHashes[chapter])throw Error('Court chapter source changed '+chapter);result.sources.push({file,sha256:hash(source)});
  for(const section of nodes(parse(source,{sourceCodeLocationInfo:true}),'section')){
   const heading=text(section.childNodes.find(n=>n.tagName==='h3'));const number=heading.match(/^27-\s*\d+(?:\.\d+)*/)?.[0].replace(/\s/g,'');
   if(!number)throw Error('Unmapped section');
   const matcher=createDefinitionMatcher(definitionsForReader(hypothetical,{bundle:book.bundle,codeSectionID:5,chapterNumber:String(chapter),sectionNumber:number}),{sectionNumber:number});
   for(const [index,p] of nodes(section,'p').entries()){
    const body=text(p);const matches=matcher(body).filter(m=>m.entries.some(e=>e.id===original.id));result.candidateLinks+=matches.length;
    for(const m of body.matchAll(/\bcourts?\b/gi)){
     const classification=number==='27-2004'?'definition':Object.hasOwn(architecturalCourtCounts,number)?'architectural':Object.hasOwn(judicialCounts,number)?'judicial':'unresolved';result.counts[classification]++;perSection[number]=(perSection[number]||0)+1;
     const linked=matches.some(x=>x.start===m.index&&x.end===m.index+m[0].length);if(linked!==(classification==='architectural'))throw Error('Unexpected Court matching '+number);
     result.occurrences.push({file,chapter,section:number,anchor:section.attrs.find(a=>a.name==='id')?.value,paragraphIndex:index,text:body,paragraphSHA256:hash(body),sourceStart:p.sourceCodeLocation.startOffset,sourceEnd:p.sourceCodeLocation.endOffset,start:m.index,end:m.index+m[0].length,spelling:m[0],classification,linked});
    }
   }
  }
 }
 for(const [section,count] of Object.entries({...architecturalCourtCounts,...judicialCounts,'27-2004':10}))if(perSection[section]!==count)throw Error('Court occurrence count changed '+section);
 if(result.counts.unresolved||result.candidateLinks!==44||result.occurrences.length!==184)throw Error('Court audit totals changed');return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){if(!process.argv[2])throw Error('Pass output JSON path');const result=await auditHMCCourtApplicability();await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({counts:result.counts,candidateLinks:result.candidateLinks,output:process.argv[2]}));}
