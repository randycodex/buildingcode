import {createHash} from 'node:crypto';
import {extractDefinitionEntries} from '../../reader-definition-index.mjs';
import {hmcGeneralSourceHashes,hmcGeneralSectionExclusions} from './bind-hmc-general-applicability.mjs';
export function extractHMCHotelOriginal(source){
 return extractDefinitionEntries(source,{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{12:'Hotel'}}});
}
export function bindHMCHotel(book,sources){
 if(book.bundle!=='2026-enacted-administrative-code'||book.codeSectionID!==5||book.chapterID!==30000077||book.chapter!=='1'||book.scope!=='general'||book.excludeWholeChapter!==false)throw Error('HMC Hotel book identity changed');
 for(const [chapter,hash] of Object.entries(hmcGeneralSourceHashes))if(typeof sources[chapter]!=='string'||createHash('sha256').update(sources[chapter]).digest('hex')!==hash)throw Error('HMC Hotel source changed: '+chapter);
 const originals=extractHMCHotelOriginal(sources[1]);
 if(originals.length!==1||originals[0].term!=='Hotel'||originals[0].text!=='A hotel is an inn having thirty or more sleeping rooms.')throw Error('HMC Hotel inventory changed');
 for(const original of originals){const found=book.terms.filter(e=>e.term===original.term&&e.sectionNumber==='27-2004');if(found.length!==1||found[0].text!==original.text||found[0].key!==original.key||found[0].anchor!=='section-31001849'||found[0].sourceFile!=='2026-enacted-administrative-code/chapters/30000077.html'||JSON.stringify(found[0].aliases||[])!==JSON.stringify(original.aliases||[]))throw Error('HMC Hotel original changed: '+original.term);}
 return {...book,terms:book.terms.map(e=>e.term!=='Hotel'||e.sectionNumber!=='27-2004'?e:{...e,applicability:'definition-chapter',applicableChapters:['2'],applicableSections:['27-2041'],...hmcGeneralSectionExclusions(),aliases:['hotels'],excludedOccurrences:[{section:'27-2041',phrases:[{text:'apartment hotels',occurrence:0}]}]})};
}
