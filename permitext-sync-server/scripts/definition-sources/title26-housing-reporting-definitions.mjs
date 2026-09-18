import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {definitionKey,extractDefinitionEntries} from '../../reader-definition-index.mjs';

const bundle='2026-enacted-administrative-code';
export const title26HousingReportingSources=Object.freeze([
 {chapterID:30000043,chapter:'25',section:'26-2501',anchor:'section-31000826',sha256:'efa3dd7cff3431a9f67423d2508f016a271ad401a06e3f05f2a1fac51325c27c',labels:['Certification of correction']},
 {chapterID:30000044,chapter:'26',section:'26-2601',anchor:'section-31000829',sha256:'189643c16c9f7c8dfd5d93a85d308bd9e8e1e579b35573334397e158c415577f',labels:['Affordable housing unit','Area median income','Department','Extremely low income household','Low income household','Middle income household','Moderate income household','Very low income household']},
 {chapterID:30000045,chapter:'27',section:'26-2701',anchor:'section-31000831',sha256:'71b2911888d15134f0017f1b4f854d4337dcc01c6e4d94ede358b9c485a4edb3',labels:['Department','Mitchell-Lama development','Waiting list']},
].map(source=>Object.freeze({...source,bundle,codeSectionID:3,file:`${bundle}/chapters/${source.chapterID}.html`})));
export const affordableHousingReferralSource=Object.freeze({bundle,codeSectionID:3,chapterID:30000041,chapter:'22',section:'26-2201',anchor:'section-31000816',file:`${bundle}/chapters/30000041.html`,sha256:'c5a7ba368cc8db09638569105e4fb5c99626e6b7fbe1b7390fbe46af49cce4dc'});
export function title26HousingReportingSource(bundleID,chapter){
 return title26HousingReportingSources.find(s=>s.bundle===bundleID&&s.codeSectionID===chapter.codeSectionID&&s.chapterID===chapter.id&&s.chapter===chapter.chapterNumber);
}
function checkSource(source,binding){
 if(createHash('sha256').update(source).digest('hex')!==binding.sha256)throw Error(`Title 26 chapter ${binding.chapter} source changed; review required`);
}
const nodeText=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(nodeText).join('');
function findSection(node,id){
 if(node.tagName==='section'&&node.attrs?.some(a=>a.name==='id'&&a.value===id))return node;
 for(const child of node.childNodes||[]){const found=findSection(child,id);if(found)return found;}
}
export function extractTitle26HousingReportingDefinitions(source,binding,{referralSource}={}){
 if(!title26HousingReportingSources.includes(binding))throw Error('Unknown Title 26 housing reporting binding');
 checkSource(source,binding);
 let terms;
 if(binding.chapter==='25'){
  const section=findSection(parse(source),binding.anchor);
  const paragraphs=section?.childNodes.filter(n=>n.tagName==='p')||[];
  const text=paragraphs.length===1?nodeText(paragraphs[0]).trim():'';
  if(!text.startsWith('As used in this chapter, the term "certification of correction" means ')||!text.endsWith('within the required timeframe.'))throw Error('Certification definition boundary changed');
  terms=[{term:binding.labels[0],key:definitionKey(binding.labels[0]),text,aliases:[],referenceOnly:false,sectionNumber:binding.section,anchor:binding.anchor}];
 }else{
  terms=extractDefinitionEntries(source,{definitionChapter:true,definitionSectionOnly:true,sentenceLegalLabels:true});
 }
 if(JSON.stringify(terms.map(t=>t.term))!==JSON.stringify(binding.labels)||terms.some(t=>t.sectionNumber!==binding.section||t.anchor!==binding.anchor))throw Error('Housing reporting definition boundaries changed');
 if(binding.chapter==='26'){
  if(!referralSource)throw Error('Affordable housing unit requires its exact section 26-2201 source');
  checkSource(referralSource,affordableHousingReferralSource);
  const targets=extractDefinitionEntries(referralSource,{definitionChapter:true,definitionSectionOnly:true,sentenceLegalLabels:true}).filter(t=>t.term==='Affordable housing unit'&&t.sectionNumber==='26-2201');
  if(targets.length!==1||targets[0].referenceOnly||targets[0].anchor!==affordableHousingReferralSource.anchor)throw Error('Affordable housing referral target changed');
  terms=terms.map(t=>t.term!=='Affordable housing unit'?t:{...t,referenceOnly:true,resolution:'resolved-reference',referenceText:t.text,
   definition:{...targets[0],bundle,code:'ADMINISTRATIVE CODE TITLE 26',scope:'general',chapter:'22',sourceFile:affordableHousingReferralSource.file}});
 }
 // Activate only the reviewed chapter-local application sections. Empty legacy
 // section allowlists keep clients without exact-section support from widening scope.
 const applicationSections=binding.chapter==='25'?['26-2502','26-2503']:[`26-${binding.chapter}02`];
 const aliases={'Certification of correction':['certifications of correction'],'Affordable housing unit':['affordable housing units'],'Extremely low income household':['extremely low income households'],'Very low income household':['very low income households'],'Low income household':['low income households'],'Moderate income household':['moderate income households'],'Middle income household':['middle income households'],'Mitchell-Lama development':['Mitchell-Lama developments'],'Waiting list':['waiting lists']};
 return terms.map(t=>({...t,applicableChapters:[binding.chapter],applicableChapterIDs:[binding.chapterID],
  ...(t.term==='Area median income'?{applicability:'review-required'}:{applicability:'definition-chapter',aliases:aliases[t.term]||[],applicableSections:[],applicableExactSections:applicationSections,excludedExactSections:[binding.section]})}));
}
