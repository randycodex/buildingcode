import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {definitionKey,plainDefinitionText} from '../../reader-definition-index.mjs';
import {hmcArticle14Sources} from './hmc-article14-definitions.mjs';
const labels={5:['Person'],8:['Class A multiple dwelling'],31:['Fireproof','Nonfireproof'],33:['Rear yard','Side yard'],36:['Curb level'],47:['This code'],48:['Harassment'],49:['Self-closing door'],50:['Unoccupied dwelling unit']};
const textOf=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(textOf).join('');
function find(node){if(node.tagName==='section'&&node.attrs?.some(a=>a.name==='id'&&a.value==='section-31001849'))return node;for(const child of node.childNodes||[]){const match=find(child);if(match)return match;}return null;}
// Inventory only: preserve complete composite meanings without assuming their
// article/subchapter predicates can be represented by current link scopes.
export function extractHMCMissingDefinitions(source){
 const binding=hmcArticle14Sources.general;
 if(createHash('sha256').update(source).digest('hex')!==binding.sha256)throw Error('HMC general source changed; review required');
 const section=find(parse(source));
 const groups=new Map();let current=null;let stopped=false;
 for(const node of section?.childNodes||[]){
  if(node.tagName!=='p')continue;
  const text=plainDefinitionText(textOf(node));
  if(text.startsWith('b.Except as otherwise provided herein,')){stopped=true;break;}
  const match=text.match(/^(\d+)\.(.*)$/s);
  if(match){current=Number(match[1]);if(groups.has(current))throw Error('HMC duplicate numbered boundary');groups.set(current,[match[2]]);}
  else if(current!==null)groups.get(current).push(text);
 }
 if(!stopped||groups.size!==50||[...groups.keys()].some((number,index)=>number!==index+1))throw Error('HMC numbered boundaries changed; review required');
 return Object.entries(labels).flatMap(([number,terms])=>terms.map(term=>({
  term,key:definitionKey(term),aliases:[],text:groups.get(Number(number)).join('\n\n'),
  inventorySource:{paragraph:`27-2004(a)(${number})`,form:number==='31'?'qualified-predicate':'numbered-definition-group'},
  anchor:binding.anchor,sectionNumber:binding.sectionNumber,referenceOnly:false,resolution:'direct',applicability:'review-required',
  sourceFile:binding.file,chapter:'1',chapterID:30000077,bundle:hmcArticle14Sources.bundle,code:'HOUSING MAINTENANCE CODE',
 })));
}
