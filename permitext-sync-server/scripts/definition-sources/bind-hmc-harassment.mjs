import {createHash} from 'node:crypto';
import {extractDefinitionEntries} from '../../reader-definition-index.mjs';
import {hmcGeneralSourceHashes,hmcGeneralSectionExclusions} from './bind-hmc-general-applicability.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function hmcHarassmentApplicability(){
 const phrase = text => ({text,occurrence:0});
 return {applicability:'definition-chapter',applicableChapters:['4','5'],applicableSections:['27-2093.1','27-2115','27-2120'],...hmcGeneralSectionExclusions(),excludedOccurrences:[
  {section:'27-2093.1',phrases:[
   ...['certification of no harassment','certificate of no harassment','tenant harassment prevention task force','no harassment of any lawful occupants','Harassment. The term "harassment"','combat tenant harassment through coordinated enforcement actions'].map(phrase),
   {text:'Harassment. The term "harassment"',occurrence:1}
  ]},
  {section:'27-2115',phrases:[
   'acts of harassment that caused the issuance',
   'certification of no harassment pursuant to section 27-2093',
   'such acts of harassment occurred',
   'subject to such harassment $5,000 per dwelling unit'
  ].map(phrase)}
 ]};
}
export function extractHMCHarassmentOriginal(source){
 return extractDefinitionEntries(source,{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{48:'Harassment'}}});
}
export function bindHMCHarassment(book,sources){
 if(book.bundle!=='2026-enacted-administrative-code'||book.codeSectionID!==5||book.chapterID!==30000077||book.chapter!=='1'||book.scope!=='general'||book.excludeWholeChapter!==false)throw Error('HMC Harassment book identity changed');
 for(const [chapter,expected] of Object.entries(hmcGeneralSourceHashes))if(typeof sources[chapter]!=='string'||hash(sources[chapter])!==expected)throw Error('HMC Harassment source changed: '+chapter);
 const originals=extractHMCHarassmentOriginal(sources[1]);
 if(originals.length!==1||originals[0].term!=='Harassment'||originals[0].text.length!==11330||originals[0].text.split('\n\n').length!==45||hash(originals[0].text)!=='3c926c779378f57def8911099e20fd710e9c1a384e0ca512aff2db98277ae415')throw Error('HMC Harassment inventory changed');
 for(const original of originals){const found=book.terms.filter(e=>e.term===original.term&&e.sectionNumber==='27-2004');if(found.length!==1||found[0].text!==original.text||found[0].key!==original.key||found[0].anchor!=='section-31001849'||found[0].sourceFile!=='2026-enacted-administrative-code/chapters/30000077.html'||JSON.stringify(found[0].aliases||[])!==JSON.stringify(original.aliases||[]))throw Error('HMC Harassment original changed: '+original.term);}
 return {...book,terms:book.terms.map(e=>e.term!=='Harassment'||e.sectionNumber!=='27-2004'?e:{...e,...hmcHarassmentApplicability()})};
}
