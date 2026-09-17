import {createHash} from 'node:crypto';
import {extractDefinitionEntries} from '../../reader-definition-index.mjs';
import {hmcGeneralSourceHashes,hmcGeneralSectionExclusions} from './bind-hmc-general-applicability.mjs';
export function extractHMCQualifiedOriginals(source){
 return extractDefinitionEntries(source,{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{11:'Tenement',27:'Dormitory'}}});
}
export function bindHMCQualifiedOccupancy(book,sources){
 if(book.bundle!=='2026-enacted-administrative-code'||book.codeSectionID!==5||book.chapterID!==30000077||book.chapter!=='1'||book.scope!=='general'||book.excludeWholeChapter!==false)throw Error('HMC qualified book identity changed');
 for(const [chapter,hash] of Object.entries(hmcGeneralSourceHashes))if(typeof sources[chapter]!=='string'||createHash('sha256').update(sources[chapter]).digest('hex')!==hash)throw Error('HMC qualified source changed: '+chapter);
 const originals=extractHMCQualifiedOriginals(sources[1]);
 if(originals.length!==2||new Set(originals.map(e=>e.term)).size!==2||!originals.some(e=>e.term==='Tenement')||!originals.some(e=>e.term==='Dormitory'))throw Error('HMC qualified inventory changed');
 for(const original of originals){const found=book.terms.filter(e=>e.term===original.term&&e.sectionNumber==='27-2004');if(found.length!==1||found[0].text!==original.text||found[0].key!==original.key||found[0].anchor!=='section-31001849'||found[0].sourceFile!=='2026-enacted-administrative-code/chapters/30000077.html'||JSON.stringify(found[0].aliases||[])!==JSON.stringify(original.aliases||[]))throw Error('HMC qualified original changed: '+original.term);}
 return {...book,terms:book.terms.map(e=>!originals.some(o=>o.term===e.term&&e.sectionNumber==='27-2004')?e:{...e,applicability:'definition-chapter',applicableChapters:['1','2','3','4','5'],...hmcGeneralSectionExclusions(),aliases:e.term==='Tenement'?['tenements']:['dormitories'],...(e.term==='Tenement'?{excludedOccurrences:['27-2060','27-2066','27-2074','27-2081','27-2085','27-2089'].map(section=>({section,phrases:['old law or new law tenement','new law tenements','new law tenement','fireproof tenement'].map(text=>({text,occurrence:0}))}))}:{excludedExactSections:[...hmcGeneralSectionExclusions().excludedExactSections,'27-2041','27-2093.1']})})};
}
