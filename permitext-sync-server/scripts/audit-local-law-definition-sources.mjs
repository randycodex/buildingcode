import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parse} from 'parse5';
const base=new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/',import.meta.url);
const digest=value=>createHash('sha256').update(value).digest('hex');
const text=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join('');
function nodes(node,tag,result=[]){if(node.tagName===tag)result.push(node);for(const child of node.childNodes||[])nodes(child,tag,result);return result;}

// This inventory intentionally retains false-positive prose and complete law
// context. It does not synthesize amendment text or decide effective law.
export async function auditLocalLawDefinitionSources(){
 const bundle=JSON.parse(await readFile(new URL('bundle.json',base)));
 const report={status:'Candidate source inventory only; no activation or legal currency determination',chapters:[],laws:[],candidateParagraphs:0};
 for(const chapter of bundle.chapters.filter(c=>c.codeSectionID===8)){
  const file=`chapters/${chapter.id}.html`,html=await readFile(new URL(file,base),'utf8');
  const sourceSHA256=digest(html);report.chapters.push({chapterID:chapter.id,year:chapter.chapterNumber,file,sourceSHA256});
  for(const section of nodes(parse(html,{sourceCodeLocationInfo:true}),'section')){
   const heading=section.childNodes.find(n=>n.tagName==='h3');
   if(!heading)continue;
   const law=text(heading).trim(),anchor=section.attrs.find(a=>a.name==='id')?.value;
   if(!/^L\.L\. \d{4}\/\d+$/.test(law))throw Error('Unrecognized local law source identity: '+law);
   let lawSection=null;
   const paragraphs=nodes(section,'p').map((p,index)=>{
    const paragraph=text(p),normalized=paragraph.replace(/\s+/g,' ').trim();
    const sectionNumber=normalized.match(/^(?:Section|§)\s*(\d+)\b/i)?.[1];
    if(sectionNumber)lawSection=sectionNumber;
    const declaration=/\bdefinitions?\b|\bmeans\b|\bthe term\b|\bas used in\b/i.test(normalized);
    const label=normalized.match(/\bThe term [“"]([^”"]+)[”"] (?:shall )?(?:means?|has\b)/i)?.[1]??null;
    return{index,lawSection,text:paragraph,paragraphSHA256:digest(paragraph),sourceStart:p.sourceCodeLocation.startOffset,sourceEnd:p.sourceCodeLocation.endOffset,candidate:declaration,explicitQuotedLabel:label};
   });
   if(!paragraphs.some(p=>p.candidate))continue;
   report.candidateParagraphs+=paragraphs.filter(p=>p.candidate).length;
   report.laws.push({law,anchor,chapterID:chapter.id,year:chapter.chapterNumber,file,sourceSHA256,
    hasConsolidatedOmission:paragraphs.some(p=>p.text.includes('Consolidated provisions are not included')),
    candidateCount:paragraphs.filter(p=>p.candidate).length,
    explicitQuotedLabels:paragraphs.filter(p=>p.explicitQuotedLabel).map(p=>({label:p.explicitQuotedLabel,paragraphIndex:p.index,lawSection:p.lawSection})),paragraphs});
  }
 }
 return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const report=await auditLocalLawDefinitionSources();
 if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,chapters:report.chapters.length,candidateParagraphs:report.candidateParagraphs,laws:report.laws.map(({law,anchor,candidateCount,explicitQuotedLabels})=>({law,anchor,candidateCount,explicitQuotedLabels}))},null,2));
}
