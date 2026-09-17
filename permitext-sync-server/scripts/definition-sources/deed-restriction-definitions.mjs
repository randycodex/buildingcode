import {createHash} from 'node:crypto';
import {extractDefinitionEntries} from '../../reader-definition-index.mjs';

export const deedRestrictionSource = Object.freeze({
  bundle:'2026-enacted-administrative-code', codeSectionID:2, chapterID:30000019,
  chapter:'8', section:'25-801', anchor:'section-31000664',
  file:'2026-enacted-administrative-code/chapters/30000019.html',
  sha256:'f7d271b3400f228deb61bb70e7ab787052e97e800b1d4aea4c4e809af6a1703d',
});
const labels=['Commissioner','Deed restriction','Department'];
export function isDeedRestrictionChapter(bundle, chapter) {
  return bundle===deedRestrictionSource.bundle && chapter.codeSectionID===deedRestrictionSource.codeSectionID
    && chapter.id===deedRestrictionSource.chapterID && chapter.chapterNumber===deedRestrictionSource.chapter;
}
export function extractDeedRestrictionDefinitions(source) {
  if(createHash('sha256').update(source).digest('hex')!==deedRestrictionSource.sha256)
    throw Error('Title 25 Chapter 8 definition source changed; review required');
  const terms=extractDefinitionEntries(source,{
    definitionChapter:true, definitionSectionOnly:true,
    sentenceDefinitionTargets:labels.map(term=>({term,sectionNumber:deedRestrictionSource.section})),
  });
  if(terms.length!==labels.length || terms.some((term,index)=>term.term!==labels[index]
      || term.sectionNumber!==deedRestrictionSource.section || term.anchor!==deedRestrictionSource.anchor))
    throw Error('Title 25 Chapter 8 definition boundaries changed; review required');
  return terms.map(term=>({...term,applicableChapters:['8'],
    // Chapter 8 also names other departments. Keep its definition available to
    // the index without mislabeling those agencies as DCAS in application prose.
    applicability:term.term==='Department'?'review-required':'definition-chapter'}));
}
