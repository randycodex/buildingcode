import {createHash} from 'node:crypto';
import {extractDefinitionEntries} from '../../reader-definition-index.mjs';

export const title26BuyoutSource = Object.freeze({
  bundle:'2026-enacted-administrative-code', codeSectionID:3, chapterID:30000042,
  chapter:'24', section:'26-2402', anchor:'section-31000822',
  file:'2026-enacted-administrative-code/chapters/30000042.html',
  sha256:'32cc5551c717fb978a5532c69e44bc6d8ec0ac9922b07f6f9689b751cb17e3af',
});
const labels=['Buyout agreement','Commissioner','Department'];
export function isTitle26BuyoutChapter(bundle, chapter) {
  return bundle===title26BuyoutSource.bundle && chapter.codeSectionID===title26BuyoutSource.codeSectionID
    && chapter.id===title26BuyoutSource.chapterID && chapter.chapterNumber===title26BuyoutSource.chapter;
}
export function extractTitle26BuyoutDefinitions(source) {
  if(createHash('sha256').update(source).digest('hex')!==title26BuyoutSource.sha256)
    throw Error('Title 26 Chapter 24 definition source changed; review required');
  const terms=extractDefinitionEntries(source,{
    definitionChapter:true, definitionSectionOnly:true,
    sentenceDefinitionTargets:labels.map(term=>({term,sectionNumber:title26BuyoutSource.section})),
  });
  if(terms.length!==labels.length || terms.some((term,index)=>term.term!==labels[index]
      || term.sectionNumber!==title26BuyoutSource.section || term.anchor!==title26BuyoutSource.anchor))
    throw Error('Title 26 Chapter 24 definition boundaries changed; review required');
  // Exact application sections prevent separately numbered descendants and
  // retain an empty legacy allowlist for clients without exact-section support.
  return terms.map(term=>({...term,applicableChapters:['24'],applicableChapterIDs:[30000042],
    applicableSections:[],applicableExactSections:['26-2401','26-2403','26-2404','26-2405'],
    excludedExactSections:['26-2402'],aliases:term.term==='Buyout agreement'?['buyout agreements']:[],
    applicability:'definition-chapter'}));
}
