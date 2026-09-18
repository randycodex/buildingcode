import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parse} from 'parse5';
import {extractDefinitionEntries} from '../reader-definition-index.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
import {hmcGeneralSourceHashes,hmcGeneralSectionExclusions} from './definition-sources/bind-hmc-general-applicability.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
const text=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join('');
const familyID='89e60949d0b76dbdfcfe';
export const familyCandidateSections=Object.freeze(['27-2076','27-2078','27-2083','27-2085','27-2086','27-2089']);
const kinshipSections=new Set(['27-2006','27-2013','27-2017.12','27-2056.15','27-2056.22']);
function classify(section,paragraph,start,end){
 if(section==='27-2004')return 'definition';
 if(section==='27-2087')return 'sectionQualified';
 if(['27-2030','27-2045','27-2056.1','27-2093.1'].includes(section))return 'otherDeclaration';
 if(/^(?:\s+member)\b/i.test(paragraph.slice(end)))return 'familyMember';
 if(/(?:one|two|single|1|2)[-\s]+$/i.test(paragraph.slice(0,start)))return 'dwellingCompound';
 if(familyCandidateSections.includes(section))return 'householdCandidate';
 if(kinshipSections.has(section))return 'kinship';
 throw Error(`Unclassified Family occurrence ${section}: ${paragraph.slice(Math.max(0,start-50),end+50)}`);
}
// Reads current authored sources and registry; hypothetical metadata never escapes
// into product files. Explicit overrides exist only for drift regression tests.
export async function auditHMCFamily({sources:sourceOverrides,registry:registryOverride}={}){
 const registryBytes=await readFile(new URL('../public/reader-definition-registry.json',import.meta.url));
 const registry=registryOverride??JSON.parse(registryBytes);
 const originals=registry.books.filter(b=>b.code==='HOUSING MAINTENANCE CODE').flatMap(b=>b.entries).filter(e=>e.id===familyID);
 if(originals.length!==1)throw Error('Family identity inventory changed');
 const original=originals[0],sources={};
 for(const [chapter,sha]of Object.entries(hmcGeneralSourceHashes)){
  const source=`2026-enacted-administrative-code/chapters/${30000076+Number(chapter)}.html`;
  sources[chapter]=sourceOverrides?.[chapter]??await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+source,import.meta.url),'utf8');
  if(digest(sources[chapter])!==sha)throw Error('HMC Family source changed: '+chapter);
 }
 const extracted=extractDefinitionEntries(sources[1],{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{4:'Family'}}});
 if(extracted.length!==1||original.term!=='Family'||original.text!==extracted[0].text||original.source.file!=='2026-enacted-administrative-code/chapters/30000077.html'||original.source.anchor!=='section-31001849'||original.source.sectionNumber!=='27-2004'||original.source.bundle!=='2026-enacted-administrative-code'||original.source.code!=='HOUSING MAINTENANCE CODE'||original.aliases.length)throw Error('Family original source identity or body changed');
 const report={status:'Read-only hypothetical audit; no activation',registrySHA256:digest(registryBytes),original,paragraphs:[],counts:{definition:0,sectionQualified:0,otherDeclaration:0,familyMember:0,dwellingCompound:0,householdCandidate:0,kinship:0},total:0,plural:0,prospectiveMatches:0};
 for(const [chapter,html]of Object.entries(sources)){
  let section,anchor,paragraphIndex=0;
  function walk(node){
   if(node.tagName==='section')anchor=node.attrs.find(a=>a.name==='id')?.value;
   if(/^h[1-6]$/.test(node.tagName)){section=text(node).match(/^\s*(27-\s*\d+(?:\.\d+)*)/)?.[1].replace(/\s/g,'');paragraphIndex=0;}
   if(node.tagName==='p'){
    paragraphIndex++;const paragraph=text(node);
    const ranges=[...paragraph.matchAll(/\bfamil(?:y|ies)\b/gi)].map(m=>{const classification=classify(section,paragraph,m.index,m.index+m[0].length);report.counts[classification]++;report.total++;if(/^families$/i.test(m[0]))report.plural++;return{start:m.index,end:m.index+m[0].length,text:m[0],classification};});
    if(ranges.length)report.paragraphs.push({source:`2026-enacted-administrative-code/chapters/${30000076+Number(chapter)}.html`,sourceSHA256:hmcGeneralSourceHashes[chapter],chapter,section,anchor,paragraphIndex,paragraph,paragraphSHA256:digest(paragraph),ranges});
   }
   for(const child of node.childNodes||[])walk(child);
  }walk(parse(html));
 }
 report.proposal={...original,applicability:'definition-chapter',aliases:['families'],applicableChapters:['1','2','3','4','5'],...hmcGeneralSectionExclusions(),applicableSections:[],applicableExactSections:[...familyCandidateSections]};
 const hypothetical={...registry,books:registry.books.map(b=>({...b,entries:b.entries.map(e=>e.id===familyID?report.proposal:e)}))};
 for(const p of report.paragraphs){
  const context={bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterNumber:p.chapter,sectionNumber:p.section};
  const matches=createDefinitionMatcher(definitionsForReader(hypothetical,context),{sectionNumber:p.section})(p.paragraph).filter(m=>m.entries.some(e=>e.id===familyID));
  p.prospectiveRanges=matches.map(({start,end})=>({start,end}));report.prospectiveMatches+=matches.length;
  for(const r of p.ranges)if(matches.some(m=>m.start===r.start&&m.end===r.end)!==(r.classification==='householdCandidate'))throw Error('Family matcher disagrees with review: '+p.section);
 }
 if(report.total!==84||report.prospectiveMatches!==8)throw Error('Family inventory changed');
 return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const report=await auditHMCFamily();
 if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,total:report.total,plural:report.plural,counts:report.counts,prospectiveMatches:report.prospectiveMatches},null,2));
}
