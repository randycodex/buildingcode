import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parse} from 'parse5';
import {extractDefinitionEntries} from '../reader-definition-index.mjs';
import {definitionsForReader} from '../public/reader-definition-registry.js';
import {createDefinitionMatcher} from '../public/definition-matcher.js';
import {hmcGeneralSourceHashes} from './definition-sources/bind-hmc-general-applicability.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
const text=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join('');
const nodes=(node,tag,out=[])=>{if(node.tagName===tag)out.push(node);for(const child of node.childNodes||[])nodes(child,tag,out);return out;};
export const curbLevelID='cbfaf13dd62d2ce15969';
// A completed no-activation review: no inferred alias or local composite definition.
export async function auditHMCCurbLevel({sources:overrides,registry:registryOverride}={}){
 const bytes=await readFile(new URL('../public/reader-definition-registry.json',import.meta.url));
 const registry=registryOverride??JSON.parse(bytes),sources={};
 for(const [chapter,sha] of Object.entries(hmcGeneralSourceHashes)){
  sources[chapter]=overrides?.[chapter]??await readFile(new URL(`../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/chapters/${30000076+Number(chapter)}.html`,import.meta.url),'utf8');
  if(digest(sources[chapter])!==sha)throw Error('Curb level source changed: '+chapter);
 }
 const entries=registry.books.filter(b=>b.code==='HOUSING MAINTENANCE CODE').flatMap(b=>b.entries).filter(e=>e.id===curbLevelID);
 if(entries.length!==1)throw Error('Curb level identity changed');
 const original=entries[0],extracted=extractDefinitionEntries(sources[1],{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{36:'Curb level'}}});
 if(extracted.length!==1||original.term!=='Curb level'||original.text!==extracted[0].text||original.source.file!=='2026-enacted-administrative-code/chapters/30000077.html'||original.source.anchor!=='section-31001849'||original.source.sectionNumber!=='27-2004'||original.source.bundle!=='2026-enacted-administrative-code'||original.source.code!=='HOUSING MAINTENANCE CODE')throw Error('Curb level source identity or body changed');
 if(original.applicability!=='review-required'||original.aliases.length||Object.keys(original).some(k=>/^(applicable|excluded)/.test(k)))throw Error('Curb level withheld metadata changed');
 const report={status:'Reviewed; retain withheld entry because every application occurrence has local measurement instructions',registrySHA256:digest(bytes),sourceHashes:hmcGeneralSourceHashes,original,bodySHA256:digest(original.text),total:0,plural:0,counts:{definition:0,localDirectFront:0,localFrontingStreet:0},paragraphs:[],applicationSections:[],liveMatches:0};
 for(const [chapter,html] of Object.entries(sources))for(const section of nodes(parse(html),'section')){
  const heading=section.childNodes.find(n=>n.tagName==='h3'),number=text(heading).match(/^27-\s*\d+(?:\.\d+)*/)?.[0].replace(/\s/g,'');
  if(!number)throw Error('Unmapped Curb level section');
  for(const [paragraphIndex,p] of nodes(section,'p').entries()){
   const paragraph=text(p),ranges=[...paragraph.matchAll(/\bcurb\s+levels?\b/gi)].map(m=>{
    let classification;
    if(number==='27-2004')classification='definition';
    else if(['27-2083','27-2085'].includes(number)&&paragraph.startsWith('b.Every part of the ceiling')&&paragraph.includes('curb level directly in front of each such part'))classification='localDirectFront';
    else if(['27-2083','27-2085'].includes(number)&&paragraph.startsWith('(2)Two feet')&&paragraph.includes('Height above curb level is measured on the street on which the dwelling fronts.'))classification='localFrontingStreet';
    else throw Error('Unclassified Curb level occurrence: '+number);
    report.total++;report.counts[classification]++;if(/levels$/i.test(m[0]))report.plural++;
    return {start:m.index,end:m.index+m[0].length,text:m[0],classification};
   });
   if(!ranges.length)continue;
   const matches=createDefinitionMatcher(definitionsForReader(registry,{bundle:'2026-enacted-administrative-code',codeSectionID:5,chapterNumber:chapter,sectionNumber:number}),{sectionNumber:number})(paragraph).filter(m=>m.entries.some(e=>e.id===curbLevelID));
   if(matches.length)throw Error('Withheld Curb level leaked into live matcher');
   report.liveMatches+=matches.length;
   report.paragraphs.push({file:`2026-enacted-administrative-code/chapters/${30000076+Number(chapter)}.html`,sourceSHA256:hmcGeneralSourceHashes[chapter],section:number,anchor:section.attrs.find(a=>a.name==='id')?.value,paragraphIndex,paragraph,paragraphSHA256:digest(paragraph),ranges,liveRanges:matches});
   if(number!=='27-2004'&&!report.applicationSections.includes(number))report.applicationSections.push(number);
  }
 }
 if(report.total!==11||report.plural!==0||report.counts.definition!==7||report.counts.localDirectFront!==2||report.counts.localFrontingStreet!==2)throw Error('Curb level inventory changed');
 return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const report=await auditHMCCurbLevel();if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,total:report.total,plural:report.plural,counts:report.counts,liveMatches:report.liveMatches,bodySHA256:report.bodySHA256},null,2));
}
