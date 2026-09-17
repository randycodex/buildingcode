import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {extractDefinitionEntries,definitionKey,plainDefinitionText} from '../../reader-definition-index.mjs';

export const hmcArticle14Sources=Object.freeze({
 bundle:'2026-enacted-administrative-code',codeSectionID:5,
 general:Object.freeze({file:'2026-enacted-administrative-code/chapters/30000077.html',sha256:'dcc196eed865ed4bad3efa726df9b3855dd8e7cf40ade22bd37c19c5372a6066',anchor:'section-31001849',sectionNumber:'27-2004'}),
 article14:Object.freeze({file:'2026-enacted-administrative-code/chapters/30000078.html',sha256:'80734cb3ad49feb8aec1bc3e5795c859a62bcb5930a4f56aa803a810d50df7b2',anchor:'section-31001929',sectionNumber:'27-2056.1'}),
});
export const hmcArticle14ApplicationSections=Object.freeze([
 ...Array.from({length:16},(_,index)=>`27-2056.${index+3}`),'27-2056.6.1',
]);
const textOf=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(textOf).join('');
function find(node,predicate){if(predicate(node))return node;for(const child of node.childNodes||[]){const result=find(child,predicate);if(result)return result;}return null;}

// This additive meaning is limited to the reviewed Article 14 application
// sections. It must accompany, never replace, the original general definition.
export function bindHMCArticle14Definitions(book,{generalSource,article14Source}){
 const binding=hmcArticle14Sources;
 for(const [kind,source] of [['general',generalSource],['article14',article14Source]]){
  if(typeof source!=='string'||createHash('sha256').update(source).digest('hex')!==binding[kind].sha256)
   throw Error(`HMC Article 14 ${kind} source changed; review required`);
 }
 if(book.bundle!==binding.bundle||book.codeSectionID!==5||book.chapterID!==30000077||book.chapter!=='1'||book.scope!=='general'||book.excludeWholeChapter!==false)
  throw Error('HMC Article 14 book identity changed; review required');
 const extracted=extractDefinitionEntries(generalSource,{definitionChapter:true,definitionSectionOnly:true,
  numberedLegalLabels:{sectionNumber:'27-2004',terms:{7:'Multiple dwelling'}}});
 const original=book.terms.filter(term=>term.term==='Multiple dwelling');
 if(extracted.length!==1||original.length!==1||original[0].text!==extracted[0].text||original[0].anchor!==binding.general.anchor||original[0].sectionNumber!=='27-2004'||original[0].sourceFile!==binding.general.file||original[0].key!==extracted[0].key)
  throw Error('HMC Article 14 original definition changed; review required');
 const section=find(parse(article14Source),node=>node.tagName==='section'&&node.attrs?.some(attr=>attr.name==='id'&&attr.value===binding.article14.anchor));
 const paragraphs=section?.childNodes.filter(node=>node.tagName==='p');
 if(paragraphs?.length!==2)throw Error('HMC Article 14 terminology boundaries changed; review required');
 const expansion=plainDefinitionText(textOf(paragraphs[0]));
 const scope={applicability:'definition-chapter',applicableChapters:['2'],applicableSections:[...hmcArticle14ApplicationSections]};
 return {...book,terms:[...book.terms.map(term=>term===original[0]?{...term,...scope}:term),{
  term:'Multiple dwelling',key:definitionKey('Multiple dwelling'),aliases:[],text:expansion,
  referenceOnly:false,resolution:'direct',...scope,
  sourceFile:binding.article14.file,anchor:binding.article14.anchor,sectionNumber:binding.article14.sectionNumber,
  chapter:'2',chapterID:30000078,bundle:binding.bundle,code:book.code,
 }]};
}
