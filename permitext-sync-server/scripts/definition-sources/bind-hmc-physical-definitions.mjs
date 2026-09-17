import {createHash} from 'node:crypto';
import {extractDefinitionEntries} from '../../reader-definition-index.mjs';
import {extractHMCMissingDefinitions} from './hmc-missing-definitions.mjs';
import {hmcGeneralSourceHashes,hmcGeneralSectionExclusions} from './bind-hmc-general-applicability.mjs';

export const hmcPhysicalAliases=Object.freeze({Kitchen:['kitchens'],Story:['stories'],Fireproof:[],Nonfireproof:['non-fireproof'],Firestair:['fire stair','fire stairs'],Firetower:['fire tower','fire towers']});
export function bindHMCPhysicalDefinitions(book,chapterSources){
 if(book.bundle!=='2026-enacted-administrative-code'||book.codeSectionID!==5||book.chapterID!==30000077||book.chapter!=='1'||book.scope!=='general'||book.excludeWholeChapter!==false)throw Error('HMC physical book identity changed');
 for(const [chapter,expected] of Object.entries(hmcGeneralSourceHashes))if(typeof chapterSources[chapter]!=='string'||createHash('sha256').update(chapterSources[chapter]).digest('hex')!==expected)throw Error('HMC physical source changed: '+chapter);
 const originals=[...extractDefinitionEntries(chapterSources[1],{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{25:'Kitchen',35:'Story',41:'Firestair',42:'Firetower'}}}),...extractHMCMissingDefinitions(chapterSources[1]).filter(e=>['Fireproof','Nonfireproof'].includes(e.term))];
 const labels=Object.keys(hmcPhysicalAliases);
 if(originals.length!==6||new Set(originals.map(e=>e.term)).size!==6||labels.some(label=>!originals.some(e=>e.term===label)))throw Error('HMC physical extraction inventory changed');
 for(const original of originals){
  const entries=book.terms.filter(e=>e.term===original.term&&e.sectionNumber==='27-2004');
  if(entries.length!==1||entries[0].text!==original.text||entries[0].key!==original.key||entries[0].anchor!=='section-31001849'||entries[0].sourceFile!=='2026-enacted-administrative-code/chapters/30000077.html'||JSON.stringify(entries[0].aliases||[])!==JSON.stringify(original.aliases||[]))throw Error('HMC physical original changed: '+original.term);
 }
 // Nonfireproof's dwelling predicate is not extended to a roof of another structure.
 // Suppress the affirmative substring independently, including longer-match fallback.
 const exclusions={Kitchen:'A living room does not include a kitchen under this paragraph',Fireproof:'non-fireproof',Nonfireproof:'non-fireproof roof'};
 return {...book,terms:book.terms.map(term=>labels.includes(term.term)&&term.sectionNumber==='27-2004'?{...term,aliases:[...hmcPhysicalAliases[term.term]],applicability:'definition-chapter',applicableChapters:['1','2','3','4','5'],...hmcGeneralSectionExclusions(),...(exclusions[term.term]?{excludedOccurrences:[{section:'27-2058',phrases:[{text:exclusions[term.term],occurrence:0}]}]}:{})}:term)};
}
