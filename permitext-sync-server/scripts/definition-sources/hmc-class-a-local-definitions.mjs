import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {definitionKey} from '../../reader-definition-index.mjs';
import {bindHMCClassA} from './bind-hmc-class-a.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const text=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join('');
const nodes=(node,tag)=>[...(node.tagName===tag?[node]:[]),...(node.childNodes||[]).flatMap(child=>nodes(child,tag))];
// Separate cited source; never synthesize or replace the general definition.
// Activated after both-source matching and rendered verification passed.
export function bindHMCClassALocal(book,sources){
 const originals=book.terms.filter(e=>e.term==='Class A multiple dwelling'&&e.sectionNumber==='27-2004');
 if(originals.length!==1||![JSON.stringify([]),JSON.stringify(['class A multiple dwellings'])].includes(JSON.stringify(originals[0].aliases||[])))throw Error('Local Class A original aliases changed');
 const bound=bindHMCClassA({...book,terms:book.terms.map(e=>e===originals[0]?{...e,aliases:[]}:e)},sources);
 if(book.terms.some(e=>e.term==='Class A multiple dwelling'&&e.sectionNumber==='27-2045'))throw Error('Duplicate local Class A companion');
 const section=nodes(parse(sources['2']),'section').find(n=>n.attrs.some(a=>a.name==='id'&&a.value==='section-31001911'));
 const paragraphs=section?.childNodes.filter(n=>n.tagName==='p').map(text);
 const excerpt=paragraphs?.slice(0,3).join('\n\n');
 if(!excerpt||excerpt.length!==882||hash(excerpt)!=='82c4f001be2913e5a392e4cdf73e4f0574593df775b73772d27cf78adb9408aa'||!paragraphs[3].startsWith('Private dwelling.'))throw Error('Local Class A excerpt changed');
 const declaration={section:'27-2045',phrases:[0,1,2].map(occurrence=>({text:paragraphs[1],occurrence}))};
 const terms=bound.terms.map(e=>e.term==='Class A multiple dwelling'&&e.sectionNumber==='27-2004'?{
  ...e,applicableExactSections:['27-2045'],
  excludedExactSections:e.excludedExactSections.filter(s=>s!=='27-2045'),excludedOccurrences:[...(e.excludedOccurrences||[]),declaration]
 }:e);
 terms.push({term:'Class A multiple dwelling',key:definitionKey('Class A multiple dwelling'),aliases:[],text:excerpt,referenceOnly:false,resolution:'direct',referenceText:null,applicability:'definition-chapter',applicableChapters:['2'],applicableSections:[],applicableExactSections:['27-2045'],excludedOccurrences:[declaration],sourceFile:'2026-enacted-administrative-code/chapters/30000078.html',anchor:'section-31001911',sectionNumber:'27-2045',chapter:'2',chapterID:30000078,bundle:book.bundle,code:book.code});
 return {...bound,terms};
}
