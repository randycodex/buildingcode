import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {fileURLToPath} from 'node:url';
import {hmcGeneralSourceHashes} from './definition-sources/bind-hmc-general-applicability.mjs';
const digest=text=>createHash('sha256').update(text).digest('hex');
const text=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join('');
export async function auditHMCFloorArea(){
 const registryBytes=await readFile(new URL('../public/reader-definition-registry.json',import.meta.url));
 const registry=JSON.parse(registryBytes),original=registry.books.filter(b=>b.code==='HOUSING MAINTENANCE CODE').flatMap(b=>b.entries).find(e=>e.id==='4a42b67efbedfa875d15');
 if(!original||original.text!=='The floor area is the clear area of the floor contained within the partitions or walls enclosing any room, space, foyer, hall or passageway of any dwelling.')throw Error('Original Floor area source changed');
 const report={status:'Read-only review; no activation',registrySHA256:digest(registryBytes),original,paragraphs:[],counts:{definition:0,roomSpace:0,localCoolingDeclaration:0,localLivableCalculation:0,zoningRatio:0,buildingHousingAggregate:0,plural:0}};
 for(const [chapter,sha]of Object.entries(hmcGeneralSourceHashes)){
  const source=`2026-enacted-administrative-code/chapters/${30000076+Number(chapter)}.html`,html=await readFile(new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+source,import.meta.url),'utf8');
  if(digest(html)!==sha)throw Error('HMC source changed: '+source);
  let section,anchor,paragraphIndex=0;
  function walk(node){
   if(node.tagName==='section')anchor=node.attrs.find(a=>a.name==='id')?.value;
   if(/^h[1-6]$/.test(node.tagName)){section=text(node).match(/^\s*(27-\s*\d+(?:\.\d+)*)/)?.[1].replace(/\s/g,'');paragraphIndex=0;}
   if(node.tagName==='p'){
    const paragraph=text(node);paragraphIndex++;
    const ranges=[...paragraph.matchAll(/\bfloor\s+areas?\b/gi)].map(match=>{
     const classification=section==='27-2004'?'definition':section==='27-2030'?'localCoolingDeclaration':section==='27-2075'&&paragraph.startsWith('(1)')?'localLivableCalculation':section==='27-2093.1'?/^\s+ratio\b/i.test(paragraph.slice(match.index+match[0].length))?'zoningRatio':'buildingHousingAggregate':'roomSpace';
     report.counts[classification]++;if(/areas$/i.test(match[0]))report.counts.plural++;
     return {start:match.index,end:match.index+match[0].length,text:match[0],classification};
    });
    if(ranges.length)report.paragraphs.push({source,sourceSHA256:sha,section,anchor,paragraphIndex,paragraph,paragraphSHA256:digest(paragraph),ranges});
   }
   for(const child of node.childNodes||[])walk(child);
  }walk(parse(html));
 }
 report.proposedSections=[...new Set(report.paragraphs.filter(p=>p.ranges.some(r=>r.classification==='roomSpace')).map(p=>p.section))];
 report.proposedExclusions=[{section:'27-2075',phrases:['total livable floor area','residual floor area','floor area of a kitchen or kitchenette','total liveable floor area','floor area for private halls'].map(text=>({text,occurrence:0}))}];
 for(const rule of report.proposedExclusions)for(const phrase of rule.phrases){const count=report.paragraphs.filter(p=>p.section===rule.section).reduce((sum,p)=>sum+p.paragraph.split(phrase.text).length-1,0);if(count!==1)throw Error('Reviewed local calculation phrase changed: '+phrase.text);}
 return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const report=await auditHMCFloorArea(),output=process.argv[2]||'/tmp/permitext-hmc-floor-area-audit.json';
 await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,counts:report.counts,proposedSections:report.proposedSections},null,2));
}
