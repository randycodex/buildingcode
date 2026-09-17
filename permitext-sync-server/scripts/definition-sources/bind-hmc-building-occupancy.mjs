import {createHash} from 'node:crypto';
import {extractDefinitionEntries} from '../../reader-definition-index.mjs';
import {extractHMCMissingDefinitions} from './hmc-missing-definitions.mjs';
import {hmcGeneralSourceHashes,hmcGeneralSectionExclusions} from './bind-hmc-general-applicability.mjs';
export const hmcBuildingOccupancyTerms=Object.freeze(['Class B multiple dwelling','Converted dwelling','Apartment','Rooming unit','Rooming house','Lodging house','Premises','Structure','Summer resort dwelling','Self-closing door','Unoccupied dwelling unit']);
export function bindHMCBuildingOccupancy(book,chapterSources){
 if(book.bundle!=='2026-enacted-administrative-code'||book.codeSectionID!==5||book.chapterID!==30000077||book.chapter!=='1'||book.scope!=='general'||book.excludeWholeChapter!==false)throw Error('HMC building occupancy identity changed');
 for(const [chapter,sha]of Object.entries(hmcGeneralSourceHashes))if(typeof chapterSources[chapter]!=='string'||createHash('sha256').update(chapterSources[chapter]).digest('hex')!==sha)throw Error('HMC building occupancy source changed: '+chapter);
 const labels={9:'Class B multiple dwelling',10:'Converted dwelling',14:'Apartment',15:'Rooming unit',16:'Rooming house',18:'Lodging house',28:'Premises',29:'Structure',46:'Summer resort dwelling'};
 const originals=[...extractDefinitionEntries(chapterSources['1'],{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:labels}}),...extractHMCMissingDefinitions(chapterSources['1']).filter(t=>['Self-closing door','Unoccupied dwelling unit'].includes(t.term))];
 if(originals.length!==11||new Set(originals.map(t=>t.term)).size!==11||hmcBuildingOccupancyTerms.some(term=>!originals.some(t=>t.term===term)))throw Error('HMC building occupancy extracted inventory changed');
 for(const original of originals){const found=book.terms.filter(t=>t.term===original.term&&t.sectionNumber==='27-2004');
  if(found.length!==1||found[0].text!==original.text||found[0].key!==original.key||found[0].anchor!=='section-31001849'||found[0].sourceFile!=='2026-enacted-administrative-code/chapters/30000077.html'||JSON.stringify(found[0].aliases||[])!==JSON.stringify(original.aliases||[]))throw Error('HMC building occupancy original changed: '+original.term);
 }
 return {...book,terms:book.terms.map(t=>hmcBuildingOccupancyTerms.includes(t.term)&&t.sectionNumber==='27-2004'?{...t,applicability:'definition-chapter',applicableChapters:['1','2','3','4','5'],...hmcGeneralSectionExclusions(),...(t.term==='Apartment'?{excludedOccurrences:[{section:'27-2041',phrases:[{text:'apartment hotels',occurrence:0}]}]}:t.term==='Rooming unit'?{excludedOccurrences:[{section:'27-2074',phrases:[{text:'conversion without physical change to a rooming unit',occurrence:0}]}]}:{})}:t)};
}
