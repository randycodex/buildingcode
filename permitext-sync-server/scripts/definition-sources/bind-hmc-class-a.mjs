import {createHash} from 'node:crypto';
import {extractDefinitionEntries} from '../../reader-definition-index.mjs';
import {hmcGeneralSourceHashes,hmcGeneralSectionExclusions} from './bind-hmc-general-applicability.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function hmcClassAApplicability(){
 const exclusions=hmcGeneralSectionExclusions();
 return {applicability:'definition-chapter',applicableChapters:['2','3','5'],applicableSections:['27-2033.1','27-2041.2','27-2043','27-2063','27-2140'],...exclusions,excludedExactSections:[...exclusions.excludedExactSections,'27-2045'],aliases:['class A multiple dwellings']};
}
export function extractHMCClassAOriginal(source){
 return extractDefinitionEntries(source,{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{8:'Class A multiple dwelling'}}});
}
export function bindHMCClassA(book,sources){
 if(book.bundle!=='2026-enacted-administrative-code'||book.codeSectionID!==5||book.chapterID!==30000077||book.chapter!=='1'||book.scope!=='general'||book.excludeWholeChapter!==false)throw Error('HMC Class A book identity changed');
 for(const [chapter,expected] of Object.entries(hmcGeneralSourceHashes))if(typeof sources[chapter]!=='string'||hash(sources[chapter])!==expected)throw Error('HMC Class A source changed: '+chapter);
 const originals=extractHMCClassAOriginal(sources[1]);
 if(originals.length!==1||originals[0].term!=='Class A multiple dwelling'||originals[0].text.split('\n\n').length!==10||hash(originals[0].text)!=='908b2a9330d178e6355da5b6ae43ff9c8109d06579618c14e0174c816a1a6673')throw Error('HMC Class A inventory changed');
 for(const original of originals){const found=book.terms.filter(e=>e.term===original.term&&e.sectionNumber==='27-2004');if(found.length!==1||found[0].text!==original.text||found[0].key!==original.key||found[0].anchor!=='section-31001849'||found[0].sourceFile!=='2026-enacted-administrative-code/chapters/30000077.html'||JSON.stringify(found[0].aliases||[])!==JSON.stringify(original.aliases||[]))throw Error('HMC Class A original changed: '+original.term);}
 return {...book,terms:book.terms.map(e=>e.term!=='Class A multiple dwelling'||e.sectionNumber!=='27-2004'?e:{...e,...hmcClassAApplicability()})};
}
