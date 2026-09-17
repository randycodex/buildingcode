import {createHash} from 'node:crypto';
import {extractDefinitionEntries} from '../../reader-definition-index.mjs';
import {hmcGeneralSourceHashes,hmcGeneralSectionExclusions} from './bind-hmc-general-applicability.mjs';
export function extractHMCContextualOriginals(source){
 return extractDefinitionEntries(source,{definitionChapter:true,definitionSectionOnly:true,numberedLegalLabels:{sectionNumber:'27-2004',terms:{17:'Single room occupancy',22:'Floor area',34:'Court',30:'Alteration'}}});
}
export function bindHMCContextualDefinitions(book,sources){
 if(book.bundle!=='2026-enacted-administrative-code'||book.codeSectionID!==5||book.chapterID!==30000077||book.chapter!=='1'||book.scope!=='general'||book.excludeWholeChapter!==false)throw Error('HMC contextual book identity changed');
 for(const [chapter,hash] of Object.entries(hmcGeneralSourceHashes))if(typeof sources[chapter]!=='string'||createHash('sha256').update(sources[chapter]).digest('hex')!==hash)throw Error('HMC contextual source changed: '+chapter);
 const originals=extractHMCContextualOriginals(sources[1]);
 if(originals.length!==4||new Set(originals.map(e=>e.term)).size!==4)throw Error('HMC contextual inventory changed');
 for(const original of originals){const found=book.terms.filter(e=>e.term===original.term&&e.sectionNumber==='27-2004');if(found.length!==1||found[0].text!==original.text||found[0].key!==original.key||found[0].anchor!=='section-31001849'||found[0].sourceFile!=='2026-enacted-administrative-code/chapters/30000077.html'||JSON.stringify(found[0].aliases||[])!==JSON.stringify(original.aliases||[]))throw Error('HMC contextual original changed: '+original.term);}
 const sections={
 'Court':['27-2010','27-2015','27-2027','27-2034','27-2038','27-2040','27-2058','27-2059','27-2060','27-2061','27-2062','27-2063','27-2065','27-2071','27-2073','27-2081','27-2083','27-2085','27-2086'],
 'Floor area':['27-2058','27-2059','27-2060','27-2061','27-2062','27-2071','27-2073','27-2074','27-2075','27-2083','27-2085'],
 'Alteration':['27-2044','27-2056.5','27-2066','27-2077','27-2089'],
 'Single room occupancy':['27-2012','27-2051','27-2067','27-2074','27-2075','27-2078','27-2079','27-2080']};
 return {...book,terms:book.terms.map(e=>!originals.some(o=>o.term===e.term&&e.sectionNumber==='27-2004')?e:{...e,applicability:'definition-chapter',applicableChapters:['1','2','3','4','5'],...hmcGeneralSectionExclusions(),applicableSections:sections[e.term],aliases:e.term==='Court'?['courts']:e.term==='Alteration'?['alterations']:e.aliases,
 ...(e.term==='Alteration'?{excludedOccurrences:[{section:'27-2044',phrases:[{text:'alteration permit',occurrence:0}]}]}:{}),
 ...(e.term==='Floor area'?{excludedOccurrences:[{section:'27-2075',phrases:['total livable floor area','residual floor area','floor area of a kitchen or kitchenette','total liveable floor area','floor area for private halls'].map(text=>({text,occurrence:0}))}]}:{})})};
}
