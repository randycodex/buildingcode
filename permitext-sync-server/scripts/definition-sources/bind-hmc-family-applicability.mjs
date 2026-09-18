import {createHash} from 'node:crypto';
import {extractDefinitionEntries} from '../../reader-definition-index.mjs';
import {hmcGeneralSourceHashes,hmcGeneralSectionExclusions} from './bind-hmc-general-applicability.mjs';
export const familyCandidateSections=Object.freeze(['27-2076','27-2078','27-2083','27-2085','27-2086','27-2089']);
export function extractHMCFamilyOriginal(source){
 return extractDefinitionEntries(source,{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{4:'Family'}}});
}
export function hmcFamilyScope(){
 return {applicability:'definition-chapter',aliases:['families'],applicableChapters:['1','2','3','4','5'],...hmcGeneralSectionExclusions(),applicableSections:[],applicableExactSections:[...familyCandidateSections]};
}
export function bindHMCFamily(book,sources){
 if(book.bundle!=='2026-enacted-administrative-code'||book.code!=='HOUSING MAINTENANCE CODE'||book.codeSectionID!==5||book.chapterID!==30000077||book.chapter!=='1'||book.scope!=='general'||book.excludeWholeChapter!==false)throw Error('HMC Family book identity changed');
 for(const [chapter,hash] of Object.entries(hmcGeneralSourceHashes))if(typeof sources[chapter]!=='string'||createHash('sha256').update(sources[chapter]).digest('hex')!==hash)throw Error('HMC Family source changed: '+chapter);
 const originals=extractHMCFamilyOriginal(sources[1]);
 if(originals.length!==1||originals[0].term!=='Family')throw Error('HMC Family inventory changed');
 const original=originals[0],found=book.terms.filter(e=>e.term==='Family'&&e.sectionNumber==='27-2004');
 if(found.length!==1||found[0].text!==original.text||found[0].key!==original.key||found[0].anchor!=='section-31001849'||found[0].sourceFile!=='2026-enacted-administrative-code/chapters/30000077.html'||JSON.stringify(found[0].aliases||[])!==JSON.stringify(original.aliases||[]))throw Error('HMC Family original changed');
 return {...book,terms:book.terms.map(e=>e===found[0]?{...e,...hmcFamilyScope()}:e)};
}
