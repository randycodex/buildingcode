import {createHash} from 'node:crypto';
import {extractDefinitionEntries} from '../../reader-definition-index.mjs';
import {hmcGeneralSourceHashes,hmcGeneralSectionExclusions} from './bind-hmc-general-applicability.mjs';
export function extractHMCThisCodeOriginal(source){
 return extractDefinitionEntries(source,{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{47:'This code'}}});
}
export function bindHMCThisCode(book,sources){
 if(book.bundle!=='2026-enacted-administrative-code'||book.codeSectionID!==5||book.chapterID!==30000077||book.chapter!=='1'||book.scope!=='general'||book.excludeWholeChapter!==false)throw Error('HMC This code book identity changed');
 for(const [chapter,hash] of Object.entries(hmcGeneralSourceHashes))if(typeof sources[chapter]!=='string'||createHash('sha256').update(sources[chapter]).digest('hex')!==hash)throw Error('HMC This code source changed: '+chapter);
 const originals=extractHMCThisCodeOriginal(sources[1]);
 if(originals.length!==1||originals[0].term!=='This code'||originals[0].text!=='This code shall mean the housing maintenance code.')throw Error('HMC This code inventory changed');
 for(const original of originals){const found=book.terms.filter(e=>e.term===original.term&&e.sectionNumber==='27-2004');if(found.length!==1||found[0].text!==original.text||found[0].key!==original.key||found[0].anchor!=='section-31001849'||found[0].sourceFile!=='2026-enacted-administrative-code/chapters/30000077.html'||JSON.stringify(found[0].aliases||[])!==JSON.stringify(original.aliases||[]))throw Error('HMC This code original changed: '+original.term);}
 const external={'27-2056.4':['17-179','17-123'],'27-2056.9':['17-179'],'27-2056.13':['17-179'],'27-2109.1':['28-210.1'],'27-2129.1':['28-219.4'],'27-2151':['27-198.2']};
 const excludedOccurrences=Object.entries(external).map(([section,refs])=>({section,phrases:refs.map(ref=>({text:`section ${ref} of this code`,occurrence:0}))}));
 excludedOccurrences.push({section:'27-2093',phrases:[{text:'subchapter five of this code',occurrence:0}]},{section:'27-2118',phrases:[{text:'constituting a violation of this code',occurrence:0}]});
 return {...book,terms:book.terms.map(e=>e.term!=='This code'||e.sectionNumber!=='27-2004'?e:{...e,applicability:'definition-chapter',applicableChapters:['1','2','3','4','5'],...hmcGeneralSectionExclusions(),excludedOccurrences})};
}
