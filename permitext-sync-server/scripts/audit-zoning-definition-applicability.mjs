import {parse,serialize} from 'parse5';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export const expectedSourceSHA256='e7707f4f9b5c705832d42d7320101f6ded124658f2a6f356f6bdd4f690f48cf7';
export const sourceFile='2026-zoning-resolution/chapters/I-2.html';
export const sourceURL=new URL('../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/'+sourceFile,import.meta.url);
const attr=(node,name)=>node.attrs?.find(a=>a.name===name)?.value||'';
const classes=node=>attr(node,'class').split(/\s+/);
const rawText=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(rawText).join(' ');
const text=node=>rawText(node).replace(/\s+/g,' ').trim();
function descendants(node,predicate){const found=[];function walk(n){if(predicate(n))found.push(n);for(const child of n.childNodes||[])walk(child);}walk(node);return found;}
export function auditZoningApplicability(html,{expectedSHA256=expectedSourceSHA256}={}){
 const sourceSHA256=createHash('sha256').update(html).digest('hex');
 if(expectedSHA256&&sourceSHA256!==expectedSHA256)throw Error('Zoning source SHA changed; review source and scope before updating the audit guard.');
 const document=parse(html,{sourceCodeLocationInfo:true});
 const termNodes=descendants(document,node=>classes(node).includes('defined-term'));
 const definitions=[];
 for(const termNode of termNodes){
  const anchor=attr(termNode,'id');
  const term=anchor.replace(/^term-/,'');
  const variants=descendants(termNode,node=>classes(node).includes('defined-term__variants')).map(text).filter(Boolean);
  const containers=descendants(termNode,node=>classes(node).some(c=>c.startsWith('applicability-type--')));
  for(const [containerIndex,node] of containers.entries()){
   const scopeType=classes(node).find(c=>c.startsWith('applicability-type--')).slice('applicability-type--'.length);
   const bodies=descendants(node,child=>classes(child).includes('definition__definition'));
   const applicability=descendants(node,child=>classes(child).includes('definition__applicability')).map(text);
   const title=descendants(node,child=>classes(child).includes('definition__title')).map(text);
   definitions.push({index:definitions.length,term,anchor,containerIndex,sourceFile,sourceLine:node.sourceCodeLocation?.startLine,
    title,variants,scopeType,applicability,excludedBySourceClass:classes(node).includes('definition--exclude'),
    amendedDates:descendants(node,child=>child.tagName==='time').map(child=>({datetime:attr(child,'datetime'),label:text(child)})),
    bodies:bodies.map(body=>({text:text(body),html:serialize(body)}))});
  }
 }
 const counts={containers:definitions.length,termContainers:termNodes.length,global:0,chapter:0,section:0,unknown:0,excluded:0,emptyBodies:0};
 for(const definition of definitions){if(['global','chapter','section'].includes(definition.scopeType))counts[definition.scopeType]++;else counts.unknown++;if(definition.excludedBySourceClass)counts.excluded++;if(!definition.bodies.some(body=>body.text))counts.emptyBodies++;}
 const byTerm=new Map();for(const definition of definitions){const values=byTerm.get(definition.term)||[];values.push(definition.index);byTerm.set(definition.term,values);}
 const competingVariants=[...byTerm].filter(([,indices])=>indices.length>1).map(([term,indices])=>({term,definitionIndices:indices,scopes:indices.map(index=>({scopeType:definitions[index].scopeType,applicability:definitions[index].applicability,excluded:definitions[index].excludedBySourceClass}))}));
 const italicPolicy='Words in the text or tables of this Resolution which are italicized shall be interpreted in accordance with the provisions set forth in this Section.';
 if(!text(document).includes(italicPolicy))throw Error('Authored italic applicability policy missing.');
 return {schemaVersion:1,status:'scope inventory only; no definitions enabled',sourceFile,sourceSHA256,italicPolicy,counts,competingVariants,definitions};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const report=auditZoningApplicability(await readFile(sourceURL,'utf8'));
 const destination=process.argv[2]||'/tmp/permitext-zoning-applicability-audit.json';
 await writeFile(destination,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({destination,...report.counts,competingTerms:report.competingVariants.length},null,2));
}
