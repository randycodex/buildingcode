import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {extractDefinitionEntries} from '../../reader-definition-index.mjs';
import {hmcGeneralSourceHashes,hmcGeneralSectionExclusions} from './bind-hmc-general-applicability.mjs';
import {hmcArticle14ApplicationSections,bindHMCArticle14Definitions} from './hmc-article14-definitions.mjs';
const text=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');
export function hmcMultipleDwellingExclusions(chapterSources){
 const rules=new Map();
 const add=(section,phrase)=>{const phrases=rules.get(section)||new Set();phrases.add(phrase);rules.set(section,phrases);};
 for(const [chapter,sha]of Object.entries(hmcGeneralSourceHashes)){
  const source=chapterSources[chapter];
  if(typeof source!=='string'||createHash('sha256').update(source).digest('hex')!==sha)throw Error('HMC multiple dwelling source changed: '+chapter);
  let section='';
  function walk(n){
   if(/^h[1-6]$/.test(n.tagName)){const match=text(n).match(/^\s*(27-\s*\d+(?:\.\d+)*)\b/);if(match)section=match[1].replace(/\s/g,'');}
   if(n.tagName==='p'){
    const prose=text(n).replace(/\s+/g,' ').trim();
    for(const match of prose.matchAll(/\b(?:multiple dwelling law|(?:class [ab]|covered|single room occupancy|fireproof|non-fireproof) multiple dwellings?)\b/gi))add(section,match[0]);
    // Short, block-local contexts survive native paragraph segmentation. Each
    // phrase match suppresses its own occurrence zero, including repeated uses.
    const declarations={
     '27-2009.2':['within a multiple dwelling that may be used in common'],
     '27-2030':['means a multiple dwelling or a tenant-occupied','other than a multiple dwelling utilized for emergency temporary housing'],
     '27-2056.22':['title to such multiple dwelling'],
     '27-2056.23':['The address of the multiple dwelling'],
     '27-2056.24':['each such dwelling unit in such multiple dwelling'],
     '27-2074':['nonresidential space within the multiple dwelling'],
     '27-2093.1':['means a multiple dwelling included on the pilot program list','Such multiple dwelling shall remain on the pilot program list','Such list shall not include any multiple dwelling that'],
    };
    for(const phrase of declarations[section]||[])if(prose.includes(phrase))add(section,phrase);
   }
   for(const child of n.childNodes||[])walk(child);
  }walk(parse(source));
 }
 return [...rules].map(([section,phrases])=>({section,phrases:[...phrases].map(text=>({text,occurrence:0}))}));
}
export function bindHMCMultipleDwelling(book,chapterSources){
 if(book.bundle!=='2026-enacted-administrative-code'||book.codeSectionID!==5||book.chapterID!==30000077||book.chapter!=='1'||book.scope!=='general'||book.excludeWholeChapter!==false)throw Error('HMC multiple dwelling book identity changed');
 const exclusions=hmcMultipleDwellingExclusions(chapterSources);
 const extracted=extractDefinitionEntries(chapterSources['1'],{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{7:'Multiple dwelling'}}});
 const originals=book.terms.filter(t=>t.term==='Multiple dwelling'&&t.sectionNumber==='27-2004');
 const companions=book.terms.filter(t=>t.term==='Multiple dwelling'&&t.sectionNumber==='27-2056.1');
 if(extracted.length!==1||originals.length!==1||originals[0].text!==extracted[0].text||originals[0].key!==extracted[0].key||originals[0].anchor!=='section-31001849'||originals[0].sourceFile!=='2026-enacted-administrative-code/chapters/30000077.html')throw Error('HMC multiple dwelling original changed');
 const expectedCompanion=bindHMCArticle14Definitions({...book,terms:book.terms.filter(t=>t.sectionNumber!=='27-2056.1')},{generalSource:chapterSources['1'],article14Source:chapterSources['2']}).terms.at(-1);
 if(companions.length!==1||companions[0].text!==expectedCompanion.text||companions[0].anchor!==expectedCompanion.anchor||companions[0].sourceFile!==expectedCompanion.sourceFile||JSON.stringify(companions[0].applicableSections)!==JSON.stringify(hmcArticle14ApplicationSections)||JSON.stringify(companions[0].applicableChapters)!=='["2"]')throw Error('HMC Article14 companion scope changed');
 return {...book,terms:book.terms.map(t=>t===originals[0]?{...t,applicability:'definition-chapter',applicableChapters:['1','2','3','4','5'],applicableSections:undefined,...hmcGeneralSectionExclusions(),excludedOccurrences:exclusions}:t===companions[0]?{...t,excludedOccurrences:exclusions}:t)};
}
