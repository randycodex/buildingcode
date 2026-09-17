import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {extractHMCMissingDefinitions} from './hmc-missing-definitions.mjs';
import {hmcGeneralSourceHashes,hmcGeneralExcludedSections} from './bind-hmc-general-applicability.mjs';

// Reviewed local contexts only. Counts refer to exact phrases in the source
// section, not to global word offsets. Each phrase contains one Person match.
export const hmcPersonExcludedContexts=Object.freeze({
 '27-2093':[
  ['intended to cause any person lawfully entitled',1],
  ['peace or quiet of any person lawfully entitled',1],
  ['and (ii) causes or is intended to cause such person',1],
  ['this code which causes or is intended to cause such person',1],
  ['intended to prevent any person from the lawful occupancy',1],
  ['such dwelling unit or causes or is intended to cause such person',1],
 ],
 '27-2098':[
  ['natural person',2],
  ['For the purposes of this subdivision, any person owning a share',1],
 ],
 '27-2109.1':[['"mortgagee" shall mean any person that commences',1]],
 '27-2114':[['injury to person or property',1]],
 '27-2115':[['in person or electronically',1]],
 '27-2118':[
  ['A person commits a willful violation',1],
  ['violation when such person intentionally acts',1],
  ['A person commits a reckless violation',1],
  ['violation when such person acts',1],
  ['safety of another person',1],
 ],
 '27-2135':[['injury to person and property',1]],
 '27-2148':[['injury to person and property',1]],
});
const textOf=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(textOf).join('');
const normalized=node=>textOf(node).replace(/\s+/g,' ').trim();
function sections(node,output=[]){if(node.tagName==='section')output.push(node);for(const child of node.childNodes||[])sections(child,output);return output;}
export function hmcPersonSourceSections(chapterSources){
 return Object.entries(chapterSources).flatMap(([chapter,source])=>sections(parse(source)).map(node=>({
  chapter,number:normalized(node.childNodes.find(child=>child.tagName==='h3')).split(' ')[0],
  paragraphs:node.childNodes.filter(child=>child.tagName==='p').map(normalized),
 })));
}
export function bindHMCPersonApplicability(book,chapterSources){
 if(book.bundle!=='2026-enacted-administrative-code'||book.codeSectionID!==5||book.chapterID!==30000077||book.chapter!=='1'||book.scope!=='general'||book.excludeWholeChapter!==false)throw Error('HMC Person book identity changed; review required');
 for(const [chapter,sha]of Object.entries(hmcGeneralSourceHashes))if(typeof chapterSources[chapter]!=='string'||createHash('sha256').update(chapterSources[chapter]).digest('hex')!==sha)throw Error('HMC Person chapter '+chapter+' source changed; review required');
 const original=extractHMCMissingDefinitions(chapterSources[1]).find(term=>term.term==='Person');
 const matches=book.terms.filter(term=>term.term==='Person');
 if(matches.length!==1||['text','key','anchor','sectionNumber','sourceFile'].some(key=>matches[0][key]!==original[key])||matches[0].aliases?.length)throw Error('HMC Person original composite changed; review required');
 const sourceSections=hmcPersonSourceSections(chapterSources);
 const eligible=sourceSections.filter(section=>['4','5'].includes(section.chapter)||(section.chapter==='3'&&/^27-20(?:7[4-9]|80)$/.test(section.number)));
 if(eligible.length!==79||eligible.filter(s=>s.chapter==='3').length!==7)throw Error('HMC Person source region changed');
 const count=eligible.reduce((sum,section)=>sum+section.paragraphs.reduce((n,text)=>n+[...text.matchAll(/\bperson\b/gi)].length,0),0);
 if(count!==137)throw Error('HMC Person source occurrence inventory changed');
 for(const [sectionNumber,phrases]of Object.entries(hmcPersonExcludedContexts)){
  const section=eligible.find(item=>item.number===sectionNumber);
  for(const [phrase,expected]of phrases){
   const occurrences=section?.paragraphs.reduce((sum,text)=>sum+text.toLowerCase().split(phrase.toLowerCase()).length-1,0);
   if(occurrences!==expected||[...phrase.matchAll(/\bperson\b/gi)].length!==1)throw Error('HMC Person exclusion context changed: '+sectionNumber+' '+phrase);
  }
 }
 const excludedOccurrences=Object.entries(hmcPersonExcludedContexts).map(([section,phrases])=>({section,phrases:phrases.map(([text])=>({text,occurrence:0}))}));
 return {...book,terms:book.terms.map(term=>term===matches[0]?{...term,
  applicability:'definition-chapter',applicableChapters:['3','4','5'],
  applicableSections:eligible.map(section=>section.number),excludedSections:[...hmcGeneralExcludedSections],excludedOccurrences,
 }:term)};
}
