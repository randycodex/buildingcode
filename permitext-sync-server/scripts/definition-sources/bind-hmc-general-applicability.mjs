import {createHash} from 'node:crypto';
import {extractDefinitionEntries} from '../../reader-definition-index.mjs';

export const hmcGeneralSourceHashes=Object.freeze({"1": "dcc196eed865ed4bad3efa726df9b3855dd8e7cf40ade22bd37c19c5372a6066", "2": "80734cb3ad49feb8aec1bc3e5795c859a62bcb5930a4f56aa803a810d50df7b2", "3": "7545311ec4d903e2c89289d5a4a37ddb66fd06c0f4fe8fba4e98dd17ef90f52e", "4": "a76f2a1f60ad0b632c400189a4f8cf48aaeee90dd0315243560a0ff8b08690d2", "5": "2584178f90403fb03f0ba046060a16775248e557aab7da57d17c47f332c01103"});
export const hmcReviewedGeneralTerms=Object.freeze({19:'Public hall',21:'Living room',23:'Dining space',24:'Foyer',26:'Kitchenette',32:'Fire-retarded',37:'Cellar',38:'Basement',39:'Shaft',40:'Stair',43:'Fire escape'});
// Definition and terminology sections remain plain. Reviewed inline declarations
// in mixed application sections contain none of these eleven labels.
export const hmcGeneralExcludedSections=Object.freeze(['27-2004','27-2017','27-2020','27-2052','27-2056.1','27-2056.2','27-2056.21','27-2109.51','27-2150']);

// §27-2017.1 and following numbered application sections are not definitions.
export function hmcGeneralSectionExclusions(){
 return {excludedSections:hmcGeneralExcludedSections.filter(section=>section!=='27-2017'),excludedExactSections:['27-2017']};
}

export function bindHMCGeneralApplicability(book,chapterSources){
 if(book.bundle!=='2026-enacted-administrative-code'||book.codeSectionID!==5||book.chapterID!==30000077||book.chapter!=='1'||book.scope!=='general'||book.excludeWholeChapter!==false)
  throw Error('HMC general book identity changed; review required');
 for(const [chapter,sha] of Object.entries(hmcGeneralSourceHashes)){
  const source=chapterSources[chapter];
  if(typeof source!=='string'||createHash('sha256').update(source).digest('hex')!==sha)throw Error('HMC chapter '+chapter+' source changed; review required');
 }
 const originals=extractDefinitionEntries(chapterSources['1'],{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:hmcReviewedGeneralTerms}});
 if(originals.length!==11)throw Error('HMC general extraction boundaries changed');
 for(const original of originals){
  const matches=book.terms.filter(term=>term.term===original.term&&term.sectionNumber==='27-2004');
  if(matches.length!==1||matches[0].text!==original.text||matches[0].key!==original.key||matches[0].anchor!=='section-31001849'||matches[0].sourceFile!=='2026-enacted-administrative-code/chapters/30000077.html')throw Error('HMC original meaning changed: '+original.term);
 }
 const labels=new Set(Object.values(hmcReviewedGeneralTerms));
 return {...book,terms:book.terms.map(term=>labels.has(term.term)&&term.sectionNumber==='27-2004'?{...term,applicability:'definition-chapter',applicableChapters:['1','2','3','4','5'],...hmcGeneralSectionExclusions()}:term)};
}
