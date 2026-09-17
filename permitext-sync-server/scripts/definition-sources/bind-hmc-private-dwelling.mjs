import {createHash} from 'node:crypto';
import {extractDefinitionEntries} from '../../reader-definition-index.mjs';
import {hmcGeneralSourceHashes,hmcGeneralSectionExclusions} from './bind-hmc-general-applicability.mjs';
export function bindHMCPrivateDwelling(book,chapterSources){
 if(book.bundle!=='2026-enacted-administrative-code'||book.codeSectionID!==5||book.chapterID!==30000077||book.chapter!=='1'||book.scope!=='general'||book.excludeWholeChapter!==false)throw Error('HMC private dwelling identity changed');
 for(const [chapter,sha]of Object.entries(hmcGeneralSourceHashes))if(typeof chapterSources[chapter]!=='string'||createHash('sha256').update(chapterSources[chapter]).digest('hex')!==sha)throw Error('HMC private dwelling source changed: '+chapter);
 const extracted=extractDefinitionEntries(chapterSources['1'],{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{6:'Private dwelling'}}});
 const originals=book.terms.filter(t=>t.term==='Private dwelling'&&t.sectionNumber==='27-2004');
 if(extracted.length!==1||originals.length!==1||originals[0].text!==extracted[0].text||originals[0].key!==extracted[0].key||originals[0].anchor!=='section-31001849'||originals[0].sourceFile!=='2026-enacted-administrative-code/chapters/30000077.html')throw Error('HMC private dwelling original changed');
 return {...book,terms:book.terms.map(t=>t===originals[0]?{...t,applicability:'definition-chapter',applicableChapters:['1','2','3','4','5'],...hmcGeneralSectionExclusions(),excludedSections:[...hmcGeneralSectionExclusions().excludedSections,'27-2045']}:t)};
}
