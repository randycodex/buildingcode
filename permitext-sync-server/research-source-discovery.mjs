import {createHash} from 'node:crypto';
import {inlineCodeReferencePhrases} from './public/code-references.js';
import {researchDiscoveryTerms} from './public/research-discovery-query.js';
import {researchMentionedDefinitionLabels,targetedDefinitionExcerpt} from './research-definition-excerpts.mjs';
import {structuredRichSources} from './evidence-discovery.mjs';

const key=source=>`${source.codePrefix}:${source.codeVersion}:${source.sectionNumber}`;
const compact=text=>String(text||'').replace(/\s+/g,' ').trim();
const hash=text=>createHash('sha256').update(text).digest('hex').slice(0,16);
const sameEdition=(a,b)=>a.codePrefix===b.codePrefix&&a.codeVersion===b.codeVersion;
const maximumExcerpt=12000;
const namedBookPrefix=(text,phrase)=>{
  const name=String(text).slice(phrase.end,phrase.end+110).match(/^\s+of\s+(?:the\s+)?(?:(?:New York City|NYC)\s+)?(Building|Mechanical|Plumbing|Fuel Gas|Fire|Electrical|Energy Conservation)\s+Code\b/i)?.[1]?.toLowerCase();
  return phrase.codePrefix||({building:'BC',mechanical:'MC',plumbing:'PC','fuel gas':'FGC',fire:'FC',electrical:'EC','energy conservation':'ECC'}[name]);
};

// Read-only nominations. No model, answer generation, project facts or automatic
// attachment occurs here. Every proposed excerpt is rebound by Reader review.
export async function discoverResearchSources({question,selected,pinned=[],resources,discover,readSectionBody,unresolvedReferences=[]}){
  const terms=researchDiscoveryTerms(question);
  const resource=await resources({selected,passageSearch:true});
  const {catalog}=resource,byKey=new Map(catalog.map(section=>[key(section),section]));
  const bodies=new Map(),unresolved=new Map(unresolvedReferences.map(item=>[item.id,item])),all=new Map(),unreadable=new Set();
  const read=async section=>{
    if(!bodies.has(key(section)))bodies.set(key(section),Promise.resolve().then(()=>readSectionBody(section)).catch(()=>{unreadable.add(`${section.codePrefix} § ${section.sectionNumber}`);return null;}));
    return bodies.get(key(section));
  };
  const canonical=(section,body)=>compact([section.sectionNumber,section.title,...(body?.blocks||[]).filter(b=>b.researchClaimEligible!==false).map(b=>b.plainText||'')].join(' '));
  const includes=(section,body,text)=>Boolean(compact(text)&&canonical(section,body).includes(compact(text)));
  const add=(section,kind,reason,extra={},completeText='')=>{
    if(!section)return null;
    const excerpt=extra.suggestedText;
    const proposedText=excerpt||completeText;
    if(pinned.some(source=>key(source)===key(section)&&(!proposedText||compact(source.selectedText).includes(compact(proposedText)))))return null;
    const id=key(section)+(excerpt?`:${hash(excerpt)}`:'');
    if(all.has(id))return all.get(id);
    const item={id,sectionID:String(section.id),sectionNumber:section.sectionNumber,title:section.title,codePrefix:section.codePrefix,
      codeVersion:section.codeVersion,codeEdition:section.codeEdition,jurisdiction:section.jurisdiction,kind,reason,...extra};
    all.set(id,item);return item;
  };
  const found=await discover({...resource,question:terms.query,retrievalContext:{currentQuestion:terms.query,sourceQuery:terms.query},limit:12});
  const primary=[];
  for(const result of found.candidates||[]){
    const section=catalog.find(item=>String(item.id)===String(result.sectionID)&&item.codeVersion===result.codeVersion&&item.codePrefix===result.codePrefix);
    if(!section)continue;
    const body=await read(section);if(!body)continue;
    const short=canonical(section,body).length<=maximumExcerpt;
    const proposed=short?'':result.selectedText;
    const extra=proposed&&includes(section,body,proposed)&&!(result.sourceReviewRequirements||[]).length?{suggestedText:proposed}:{};
    const item=add(section,'provision',result.signals?.exactReference?'Exact citation requested in the question.':'Related to the question; review its conditions and scope.',extra,canonical(section,body));
    if(item)primary.push({item,section,body,result});
  }
  // Prefer titles naming the question's first subject over incidental mentions
  // in long provisions. This changes nomination order, never applicability.
  const subject=terms.query.split(' ')[0]?.replace(/s$/,'');
  const namesSubject=entry=>subject?.length>=4&&entry.section.title.toLowerCase().split(/[^a-z0-9]+/).some(word=>word.replace(/s$/,'')===subject);
  const titleCompanion=primary.slice(4).find(namesSubject);
  const seeds=[...pinned.map(source=>({section:byKey.get(key(source)),text:source.selectedText})),
    ...primary.slice(0,4).map(({section,body,result})=>({section,text:result.selectedText||canonical(section,body)}))].filter(seed=>seed.section);
  for(const {section,text} of seeds){
    let number=section.sectionNumber;
    while(number.includes('.')){number=number.slice(0,number.lastIndexOf('.'));const parent=byKey.get(key({...section,sectionNumber:number}));if(parent){add(parent,'scope',`Parent scope of ${section.codePrefix} § ${section.sectionNumber}.`);break;}}
    const root=String(section.sectionNumber).split('.')[0];
    const scope=catalog.find(item=>sameEdition(section,item)&&item.sectionNumber===`${root}.1`&&/\b(?:scope|general|applicability)\b/i.test(item.title));
    if(scope&&scope.id!==section.id)add(scope,'scope',`General or scope provision for ${section.codePrefix} § ${root}.`);
    const origin=selected.find(c=>c.codeVersion===section.codeVersion&&c.codePrefixes.includes(section.codePrefix));
    for(const phrase of inlineCodeReferencePhrases(text,{includeFireCode:true})){
      const prefix=namedBookPrefix(text,phrase)||section.codePrefix;
      const corpus=selected.find(c=>c.codePrefixes.includes(prefix)&&(prefix===section.codePrefix?c.codeVersion===section.codeVersion:c.codeYear===origin?.codeYear));
      for(const target of phrase.references.slice(0,8)){
        const id=key({codePrefix:prefix,codeVersion:corpus?.codeVersion||section.codeVersion,sectionNumber:target.sectionNumber});
        const match=corpus?byKey.get(id):null;
        if(match){add(match,'reference',`Referenced by ${section.codePrefix} § ${section.sectionNumber}; review before deciding whether it applies.`);unresolved.delete(`${prefix}:${section.codeVersion}:book`);}
        else unresolved.set(id,{id,kind:'unresolved',title:`${prefix} § ${target.sectionNumber}`,codePrefix:prefix,codeVersion:corpus?.codeVersion||section.codeVersion,
          codeEdition:corpus?.codeEdition||section.codeEdition,reason:`Referenced in ${section.codePrefix} § ${section.sectionNumber}; the exact provision is unavailable in the searched edition.`});
      }
    }
  }
  for(const scope of found.chapterScopeCandidates||[]){const section=catalog.find(item=>String(item.id)===String(scope.sectionID||scope.id));if(section)add(section,'scope','Chapter applicability or scope; relevance is not project applicability.');}
  const explicitPrefix=String(question).match(/\b(BC68|BC|MC|PC|FGC|FC|ECC|EC|ZR)\b/i)?.[1]?.toUpperCase()||(/\bplumbing\b/i.test(question)?'PC':/\bmechanical\b/i.test(question)?'MC':null);
  const definitionRequest=/\b(?:defin(?:e|ition)|what (?:is|are))\b/i.test(question);
  const dominant=explicitPrefix||(definitionRequest&&catalog.some(s=>s.codePrefix==='BC')?'BC':primary[0]?.section.codePrefix);
  const context=seeds.map(seed=>seed.text).join('\n').slice(0,9000);
  const dictionaries=catalog.filter(section=>section.codePrefix===dominant&&/\bdefinitions?\b/i.test(section.title))
    .sort((a,b)=>Number(b.sectionNumber==='202')-Number(a.sectionNumber==='202')).slice(0,6);
  for(const section of dictionaries){
    const body=await read(section);if(!body)continue;
    const definitionSource={...section,body};
    for(const label of researchMentionedDefinitionLabels(definitionSource,terms.query,context,3)){
      const excerpt=targetedDefinitionExcerpt(definitionSource,label,{completeDefinitionLabels:[label],maximumDefinitions:3,maximumCharacters:maximumExcerpt,allowShortSection:true});
      if(excerpt?.passages?.length===1&&includes(section,body,excerpt.passages[0]))add(section,'definition',`Defined term used in the question or candidate text.`,{title:`Definition: ${label}`,definitionLabel:label,suggestedText:excerpt.passages[0]});
    }
  }
  for(const {section,body,item} of primary.slice(0,5)){
    for(const table of structuredRichSources(body,{codePrefix:section.codePrefix}).filter(source=>source.kind==='table').slice(0,2)){
      if(table.text.length<=maximumExcerpt&&includes(section,body,table.text))add(section,'table','Structured table text with its available conditions and notes; inspect the complete table in Reader.',{title:table.reference,suggestedText:table.text});
      else {
        item.kind='table';
        item.reason=canonical(section,body).length<=maximumExcerpt?
          'The complete section includes this table and its available notes. Review them together in Reader.':
          'Select the complete table and its footnotes in Reader; this section is too long to attach in full.';
        if(canonical(section,body).length>maximumExcerpt){delete item.suggestedText;item.requiresReaderSelection=true;}
      }
    }
  }
  const requested=[],requestedUnresolved=[];
  for(const phrase of inlineCodeReferencePhrases(question,{includeFireCode:true})){
    const prefix=namedBookPrefix(question,phrase)||explicitPrefix||dominant;
    for(const corpus of selected.filter(c=>c.codePrefixes.includes(prefix)))for(const target of phrase.references.slice(0,12)){
      const id=key({codePrefix:prefix,codeVersion:corpus.codeVersion,sectionNumber:target.sectionNumber}),section=byKey.get(id);
      if(section){const item=add(section,'provision','Exact citation requested in the question.');if(item)requested.push(item);}
      else {const missing={id,codePrefix:prefix,codeVersion:corpus.codeVersion,codeEdition:corpus.codeEdition,title:`${prefix} § ${target.sectionNumber}`,reason:'The exact requested provision is unavailable in the searched edition.',kind:'unresolved'};unresolved.set(id,missing);requestedUnresolved.push(missing);}
    }
  }
  const values=[...all.values()],definitionFirst=definitionRequest?/\b(?:definition|define)\b/i.test(question):false;
  const groups={definitions:values.filter(c=>c.kind==='definition'),provisions:primary.map(p=>p.item),tables:values.filter(c=>c.kind==='table'),scope:values.filter(c=>c.kind==='scope'),references:values.filter(c=>c.kind==='reference')};
  const exact=[...requested,...primary.filter(p=>p.result.signals?.exactReference).map(p=>p.item)];
  const ordered=[...exact,...(definitionFirst?groups.definitions.slice(0,2):[]),...groups.provisions.slice(0,4),...(titleCompanion?[titleCompanion.item]:[]),...groups.tables.slice(0,2),...groups.definitions.slice(0,2),...groups.scope.slice(0,2),...groups.references.slice(0,3),...values];
  const candidates=[...new Map(ordered.map(item=>[item.id,item])).values()].slice(0,12);
  return {question,searchQuery:terms.query,queryExpansions:terms.expansions,candidates,
    unresolvedReferences:[...new Map([...requestedUnresolved,...unresolved.values()].map(item=>[item.id,item])).values()].slice(0,12),
    sourceEditions:selected.map(c=>({codeVersion:c.codeVersion,codeEdition:c.codeEdition})),searchedSectionCount:catalog.length,
    coverage:{candidateCount:all.size,shownCount:candidates.length,omittedCandidateCount:all.size-candidates.length,roles:[...new Set(candidates.map(c=>c.kind))]},
    coverageLimitations:['These are source candidates, not a complete list of requirements or a determination of applicability.',
      ...(unreadable.size?[`Source text could not be read for: ${[...unreadable].join(', ')}.`]:[]),
      ...(found.coverageLimitations||[]).map(item=>item.text).filter(Boolean)],
    generatedAnswer:false,paidModelCall:false};
}
