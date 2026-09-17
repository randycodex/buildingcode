import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parse} from 'parse5';
import {extractDefinitionEntries} from '../reader-definition-index.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const text=node=>node?.nodeName==='#text'?node.value:(node?.childNodes||[]).map(text).join('');
const nodes=(node,tag)=>[...(node.tagName===tag?[node]:[]),...(node.childNodes||[]).flatMap(child=>nodes(child,tag))];
const generalFile='2026-enacted-administrative-code/chapters/30000077.html';
const localFile='2026-enacted-administrative-code/chapters/30000078.html';
const generalHash='dcc196eed865ed4bad3efa726df9b3855dd8e7cf40ade22bd37c19c5372a6066';
const localHash='80734cb3ad49feb8aec1bc3e5795c859a62bcb5930a4f56aa803a810d50df7b2';
const bodyHash='908b2a9330d178e6355da5b6ae43ff9c8109d06579618c14e0174c816a1a6673';
const excerptHash='82c4f001be2913e5a392e4cdf73e4f0574593df775b73772d27cf78adb9408aa';
const expectedRanges={1:[[0,25],[37,62],[72,97]],4:[[17,42]],9:[[11,36]],15:[[147,172]],19:[[43,68]]};
// Source-only proposal: no local entry identity is fabricated or registry mutated.
export async function auditHMCClassALocal({read=readFile}={}){
 const registry=JSON.parse(await read(new URL('../public/reader-definition-registry.json',import.meta.url),'utf8'));
 const originals=registry.books.find(book=>book.chapterID===30000077)?.entries.filter(entry=>entry.term==='Class A multiple dwelling')||[];
 const original=originals[0];
 if(originals.length!==1||original.id!=='dc9d3eef2b81427fac2f'||hash(original.text)!==bodyHash||original.text.split('\n\n').length!==10||original.source.file!==generalFile||original.source.anchor!=='section-31001849'||original.source.sectionNumber!=='27-2004'||original.source.bundle!=='2026-enacted-administrative-code')throw Error('General Class A identity/body changed');
 const readSource=file=>read(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+file,import.meta.url),'utf8');
 const general=await readSource(generalFile),local=await readSource(localFile);
 if(hash(general)!==generalHash)throw Error('General source changed');
 if(hash(local)!==localHash)throw Error('Local source changed');
 const extracted=extractDefinitionEntries(general,{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{8:'Class A multiple dwelling'}}});
 if(extracted.length!==1||extracted[0].text!==original.text)throw Error('General Class A extraction changed');
 const sections=nodes(parse(local,{sourceCodeLocationInfo:true}),'section').filter(section=>section.attrs.some(a=>a.name==='id'&&a.value==='section-31001911'));
 if(sections.length!==1||!text(sections[0].childNodes.find(n=>n.tagName==='h3')).startsWith('27-2045 '))throw Error('Local section identity changed');
 const paragraphs=sections[0].childNodes.filter(n=>n.tagName==='p').map((p,paragraphIndex)=>({paragraphIndex,text:text(p),paragraphSHA256:hash(text(p)),sourceStart:p.sourceCodeLocation.startOffset}));
 const excerptParagraphs=paragraphs.slice(0,3),excerpt=excerptParagraphs.map(p=>p.text).join('\n\n');
 if(excerpt.length!==882||hash(excerpt)!==excerptHash||excerptParagraphs[0].text!=='a.As used in this section:'||excerptParagraphs[1].text.length!==264||excerptParagraphs[2].text.length!==588||excerptParagraphs[1].paragraphSHA256!=='fac9b7bbd6b10c9164ca9928894b86f7538758b734aaca4784d6a88cb1f1a906'||excerptParagraphs[2].paragraphSHA256!=='22854a4b030c4961da64778f64c1d18018e52a8178a32b1bef0bf4b756ce715e'||!paragraphs[3].text.startsWith('Private dwelling.'))throw Error('Local contiguous excerpt changed');
 const occurrences=[];
 for(const paragraph of paragraphs){
  const ranges=[...paragraph.text.matchAll(/(?<![\p{L}\p{N}_])class\s+a\s+multiple\s+dwellings?(?![\p{L}\p{N}_])/giu)].map(m=>[m.index,m.index+m[0].length]);
  if(JSON.stringify(ranges)!==JSON.stringify(expectedRanges[paragraph.paragraphIndex]||[]))throw Error('Local Class A occurrence ranges changed');
  paragraph.ranges=ranges.map(([start,end])=>({start,end,classification:paragraph.paragraphIndex===1?'declaration':'operative'}));
  for(const range of paragraph.ranges)occurrences.push({...paragraph,ranges:undefined,...range});
 }
 if(occurrences.length!==7)throw Error('Local Class A inventory changed');
 return {status:'Source-only local companion proposal; no activation or matcher acceptance',original,generalBodySHA256:bodyHash,sources:[{file:generalFile,sourceSHA256:generalHash},{file:localFile,sourceSHA256:localHash}],localSource:{file:localFile,anchor:'section-31001911',sectionNumber:'27-2045',chapter:'2',codeSectionID:5,bundle:'2026-enacted-administrative-code'},excerpt,excerptSHA256:excerptHash,excerptParagraphs,paragraphs,occurrences,counts:{declaration:3,operative:4}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw Error('Pass output path');
 const report=await auditHMCClassALocal();await writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({counts:report.counts,occurrences:report.occurrences.length,excerptUTF16:report.excerpt.length}));
}
