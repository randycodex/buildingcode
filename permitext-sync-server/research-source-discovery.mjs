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
const words=text=>compact(text).toLowerCase().match(/[a-z0-9]+/g)?.map(word=>word.replace(/s$/,''))||[];
const titleWords=text=>new Set(words(text));
const pageSize=12;
const discoveryError=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode,code:'RESEARCH_DISCOVERY_CHANGED'});
export function researchDiscoveryOptions({focus='',cursor=null}={}){
  if(typeof focus!=='string'||focus.length>2000)throw discoveryError('Keep the requested source within 2,000 characters.');
  if(cursor!==null&&(typeof cursor!=='string'||cursor.length>512))throw discoveryError('Run source discovery again to obtain a valid results page.');
  return {focus:focus.trim(),cursor};
}
const namedBookPrefix=(text,phrase)=>{
  const name=String(text).slice(phrase.end,phrase.end+110).match(/^\s+of\s+(?:the\s+)?(?:(?:New York City|NYC)\s+)?(Building|Mechanical|Plumbing|Fuel Gas|Fire|Electrical|Energy Conservation)\s+Code\b/i)?.[1]?.toLowerCase();
  return phrase.codePrefix||({building:'BC',mechanical:'MC',plumbing:'PC','fuel gas':'FGC',fire:'FC',electrical:'EC','energy conservation':'ECC'}[name]);
};

// Read-only nominations. No model, answer generation, project facts or automatic
// attachment occurs here. Every proposed excerpt is rebound by Reader review.
export async function discoverResearchSources({question,focus='',cursor=null,selected,pinned=[],resources,discover,readSectionBody,unresolvedReferences=[]}){
  ({focus,cursor}=researchDiscoveryOptions({focus,cursor}));
  const subjectQuestion=focus||question;
  const terms=researchDiscoveryTerms(subjectQuestion,{sourceNeed:Boolean(focus)});
  const resource=await resources({selected,passageSearch:true});
  const {catalog}=resource,byKey=new Map(catalog.map(section=>[key(section),section]));
  const queryWords=titleWords(terms.query),frequencies=new Map();
  const subjectWord=[...queryWords].find(word=>word.length>=4&&/^[a-z]+$/.test(word)&&!['section','table','definition','provision','code'].includes(word));
  for(const section of catalog)for(const word of titleWords(section.title))if(queryWords.has(word))frequencies.set(word,(frequencies.get(word)||0)+1);
  const titleScore=section=>[...titleWords(section.title)].reduce((score,word)=>score+(queryWords.has(word)?Math.log(1+catalog.length/(frequencies.get(word)||1))*(word===subjectWord?3:1):0),0);
  const phrase=[...queryWords].filter(word=>!['bc','section','code','provision','table'].includes(word)&&/^[a-z]+$/.test(word)).slice(-2).join(' ');
  const phraseWanted=phrase.includes(' '),tableWanted=/\b(?:table|footnotes?)\b/i.test(subjectQuestion);
  const leadingScore=entry=>titleScore(entry.section)+
    (phraseWanted&&words(canonical(entry.section,entry.body).slice(0,1000)).join(' ').includes(phrase)?25:0)+
    (tableWanted&&entry.result.richSources?.some(source=>source.kind==='table')?25:0);
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
    const extra={...(includes(section,body,result.selectedText)?{readerText:result.selectedText}:{}),
      ...(proposed&&includes(section,body,proposed)&&!(result.sourceReviewRequirements||[]).length?{suggestedText:proposed}:{})};
    const item=add(section,'provision',result.signals?.exactReference?'Exact citation requested in the question.':'Related to the question; review its conditions and scope.',extra,canonical(section,body));
    if(item)primary.push({item,section,body,result});
  }
  // Rare subject words in titles outrank incidental mentions in long bodies.
  // Exact citations remain protected; ranking never establishes applicability.
  const relevanceOrder=(a,b)=>Number(Boolean(b.result.signals?.exactReference))-Number(Boolean(a.result.signals?.exactReference))||leadingScore(b)-leadingScore(a);
  const leading=primary.slice(0,4).sort(relevanceOrder),remaining=primary.slice(4).sort(relevanceOrder);
  primary.splice(0,primary.length,...leading,...remaining);
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
  const explicitPrefix=String(subjectQuestion).match(/\b(BC68|BC|MC|PC|FGC|FC|ECC|EC|ZR)\b/i)?.[1]?.toUpperCase()||(/\bplumbing\b/i.test(subjectQuestion)?'PC':/\bmechanical\b/i.test(subjectQuestion)?'MC':null);
  const definitionRequest=/\b(?:defin(?:e|ition)|what (?:is|are))\b/i.test(subjectQuestion);
  const dominant=explicitPrefix||(definitionRequest&&catalog.some(s=>s.codePrefix==='BC')?'BC':primary[0]?.section.codePrefix);
  const context=seeds.map(seed=>seed.text).join('\n').slice(0,9000);
  const dictionaries=catalog.filter(section=>section.codePrefix===dominant&&/\bdefinitions?\b/i.test(section.title))
    .sort((a,b)=>Number(b.sectionNumber==='202')-Number(a.sectionNumber==='202')).slice(0,6);
  for(const section of dictionaries){
    const body=await read(section);if(!body)continue;
    const definitionSource={...section,body};
    for(const label of researchMentionedDefinitionLabels(definitionSource,terms.query,context,3)){
      const excerpt=targetedDefinitionExcerpt(definitionSource,label,{completeDefinitionLabels:[label],maximumDefinitions:3,maximumCharacters:maximumExcerpt,allowShortSection:true});
      if(excerpt?.passages?.length===1&&includes(section,body,excerpt.passages[0])){
        const directMatch=[...titleWords(label)].every(word=>queryWords.has(word));
        add(section,'definition',directMatch?'Defined term named in your question.':'Defined term used in candidate text.',{title:`Definition: ${label}`,definitionLabel:label,directMatch,suggestedText:excerpt.passages[0]});
      }
    }
  }
  for(const {section,body,item} of primary.slice(0,5)){
    for(const table of structuredRichSources(body,{codePrefix:section.codePrefix}).filter(source=>source.kind==='table').slice(0,2)){
      if(table.text.length<=maximumExcerpt&&includes(section,body,table.text))add(section,'table','Structured table text with its available conditions and notes; inspect the complete table in Reader.',{title:table.reference,tableReference:table.reference,suggestedText:table.text});
      else {
        item.kind='table';
        item.tableReference ||= table.reference;
        item.reason=canonical(section,body).length<=maximumExcerpt?
          'The complete section includes this table and its available notes. Review them together in Reader.':
          'Select the complete table and its footnotes in Reader; this section is too long to attach in full.';
        if(canonical(section,body).length>maximumExcerpt){delete item.suggestedText;item.requiresReaderSelection=true;}
      }
    }
  }
  const requested=[],requestedUnresolved=[];
  for(const phrase of inlineCodeReferencePhrases(subjectQuestion,{includeFireCode:true})){
    const prefix=namedBookPrefix(subjectQuestion,phrase)||explicitPrefix||dominant;
    for(const corpus of selected.filter(c=>c.codePrefixes.includes(prefix)))for(const target of phrase.references.slice(0,12)){
      const id=key({codePrefix:prefix,codeVersion:corpus.codeVersion,sectionNumber:target.sectionNumber}),section=byKey.get(id);
      if(section){const item=add(section,'provision','Exact citation requested in the question.');if(item)requested.push(item);}
      else {const missing={id,codePrefix:prefix,codeVersion:corpus.codeVersion,codeEdition:corpus.codeEdition,title:`${prefix} § ${target.sectionNumber}`,reason:'The exact requested provision is unavailable in the searched edition.',kind:'unresolved'};unresolved.set(id,missing);requestedUnresolved.push(missing);}
    }
  }
  const values=[...all.values()],definitionFirst=definitionRequest?/\b(?:definition|define)\b/i.test(subjectQuestion):false;
  const groups={definitions:values.filter(c=>c.kind==='definition'),provisions:primary.map(p=>p.item),tables:values.filter(c=>c.kind==='table'),scope:values.filter(c=>c.kind==='scope'),references:values.filter(c=>c.kind==='reference')};
  const directDefinitions=groups.definitions.filter(item=>item.directMatch);
  const exact=[...requested,...primary.filter(p=>p.result.signals?.exactReference).map(p=>p.item)];
  const ordered=[...exact,...(definitionFirst?directDefinitions.slice(0,2):[]),...groups.provisions.slice(0,5),...groups.tables.slice(0,2),...directDefinitions.slice(0,2),...groups.scope.slice(0,2),...groups.references.slice(0,3),...groups.provisions.slice(5),...values];
  const ranked=[...new Map(ordered.map(item=>[item.id,item])).values()];
  const fingerprint=createHash('sha256').update(JSON.stringify({question,focus,selected:selected.map(c=>[c.id,c.codeVersion]),
    pinned:pinned.map(p=>[key(p),hash(p.selectedText)]),candidates:ranked})).digest('hex');
  let offset=0;
  if(cursor){let page;try{page=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));}catch{throw discoveryError('Run source discovery again to obtain a valid results page.');}
    if(!page||typeof page!=='object'||Array.isArray(page))throw discoveryError('Run source discovery again to obtain a valid results page.');
    if(page.v!==1||page.fingerprint!==fingerprint||!Number.isSafeInteger(page.offset)||page.offset<pageSize||page.offset%pageSize||page.offset>=ranked.length)
      throw discoveryError('The search or its evidence changed. Find passages again before loading more results.',409);
    offset=page.offset;
  }
  const candidates=ranked.slice(offset,offset+pageSize),shown=offset+candidates.length;
  const nextCursor=shown<ranked.length?Buffer.from(JSON.stringify({v:1,offset:shown,fingerprint})).toString('base64url'):null;
  return {question,focus,searchQuery:terms.query,queryExpansions:terms.expansions,candidates,nextCursor,
    unresolvedReferences:[...new Map([...requestedUnresolved,...unresolved.values()].map(item=>[item.id,item])).values()].slice(0,12),
    sourceEditions:selected.map(c=>({codeVersion:c.codeVersion,codeEdition:c.codeEdition})),searchedSectionCount:catalog.length,
    coverage:{candidateCount:ranked.length,shownCount:shown,omittedCandidateCount:ranked.length-shown,roles:[...new Set(candidates.map(c=>c.kind))]},
    coverageLimitations:['These are source candidates, not a complete list of requirements or a determination of applicability.',
      ...(unreadable.size?[`Source text could not be read for: ${[...unreadable].join(', ')}.`]:[]),
      ...(found.coverageLimitations||[]).map(item=>item.text).filter(Boolean)],
    generatedAnswer:false,paidModelCall:false};
}
