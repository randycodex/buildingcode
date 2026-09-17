import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {parse} from 'parse5';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
import {hmcGeneralSourceHashes,hmcGeneralSectionExclusions} from './definition-sources/bind-hmc-general-applicability.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const text=n=>n?.nodeName==='#text'?n.value:(n?.childNodes||[]).map(text).join('');
const nodes=(n,tag,out=[])=>{if(n.tagName===tag)out.push(n);for(const c of n.childNodes||[])nodes(c,tag,out);return out;};
export const hmcSROCandidateSections=['27-2012','27-2051','27-2067','27-2074','27-2075','27-2078','27-2079','27-2080'];
export async function auditHMCSROApplicability(){
 const bytes=await readFile(new URL('../public/reader-definition-registry.json',import.meta.url));
 const registry=JSON.parse(bytes),book=registry.books.find(b=>b.bundle==='2026-enacted-administrative-code'&&b.chapterID===30000077&&b.codeSectionID===5);
 assert(book,'HMC book identity');
 const original=book.entries.find(e=>e.term==='Single room occupancy');
 assert.equal(original?.id,'eaab3c85f92d400bb0c5');
 assert.equal(hash(original.text),'f471028ef30a2efea12f6c19d99dac7a5602aa4e5dd7cb434b19c4bc67d6b1cc');
 assert.deepEqual(original.aliases,[]);
 assert.equal(original.source.file,'2026-enacted-administrative-code/chapters/30000077.html');
 assert.equal(original.source.sectionNumber,'27-2004');assert.equal(original.source.anchor,'section-31001849');
 const proposal={...original,applicability:'definition-chapter',applicableChapters:['2','3'],applicableSections:hmcSROCandidateSections,...hmcGeneralSectionExclusions()};
 const proposed={...registry,books:registry.books.map(b=>b===book?{...b,entries:b.entries.map(e=>e.id===original.id?proposal:e)}:b)};
 const result={status:'Read-only scope proposal; no product metadata or visual acceptance',registrySHA256:hash(bytes),offsetUnits:'UTF-16 decoded paragraph and original HTML',original,proposal,sources:[],paragraphs:[],counts:{raw:0,definition:0,ordinaryCandidate:0,localImportedCompound:0,institutionalDeclaration:0,externalLawQualified:0,article9ImportedCategory:0,organizationName:0,prospectiveMatches:0}};
 for(const chapter of ['1','2','3','4','5']){
  const file=`2026-enacted-administrative-code/chapters/${30000076+Number(chapter)}.html`;
  const html=await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+file,import.meta.url),'utf8');
  assert.equal(hash(html),hmcGeneralSourceHashes[chapter],file);result.sources.push({file,sha256:hash(html)});
  for(const section of nodes(parse(html,{sourceCodeLocationInfo:true}),'section')){
   const heading=text(section.childNodes.find(n=>n.tagName==='h3'));
   const number=heading.match(/^27-\s*\d+(?:\.\d+)*/)?.[0].replace(/\s/g,'');assert(number,heading);
   const matcher=createDefinitionMatcher(definitionsForReader(proposed,{bundle:book.bundle,codeSectionID:5,chapterNumber:chapter,sectionNumber:number}),{sectionNumber:number});
   for(const [paragraphIndex,p] of section.childNodes.filter(n=>n.tagName==='p').entries()){
    const body=text(p),occurrences=[...body.matchAll(/(?<![\p{L}\p{N}_])single\s+room\s+occupancy(?![\p{L}\p{N}_])/giu)].map(m=>({start:m.index,end:m.index+m[0].length,text:m[0]}));if(!occurrences.length)continue;
    let classification=number==='27-2004'?'definition':hmcSROCandidateSections.includes(number)?'ordinaryCandidate':number==='27-2093'?'localImportedCompound':number==='27-2093.1'?'institutionalDeclaration':number==='27-2140'?'externalLawQualified':number==='27-2150'?'definition':number==='27-2152'&&paragraphIndex===9?'organizationName':'article9ImportedCategory';
    assert(['27-2004',...hmcSROCandidateSections,'27-2093','27-2093.1','27-2140','27-2150','27-2151','27-2152'].includes(number),'Unreviewed occurrence section');
    result.counts.raw+=occurrences.length;result.counts[classification]+=occurrences.length;
    const matches=matcher(body).filter(m=>m.entries.some(e=>e.id===original.id)).map(m=>({start:m.start,end:m.end,text:m.text}));
    assert.equal(matches.length,classification==='ordinaryCandidate'?occurrences.length:0,number+' paragraph '+paragraphIndex);result.counts.prospectiveMatches+=matches.length;
    result.paragraphs.push({chapter,file,section:number,heading,anchor:section.attrs.find(a=>a.name==='id')?.value,paragraphIndex,sourceStart:p.sourceCodeLocation.startOffset,sourceEnd:p.sourceCodeLocation.endOffset,text:body,paragraphSHA256:hash(body),classification,occurrences,matches});
   }
  }
 }
 assert.equal(result.counts.raw,29);assert.equal(result.counts.prospectiveMatches,9);
 return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 assert(process.argv[2],'Pass an output JSON path (audit never writes registry metadata)');
 const result=await auditHMCSROApplicability();await writeFile(process.argv[2],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({output:process.argv[2],counts:result.counts,paragraphs:result.paragraphs.length}));
}
