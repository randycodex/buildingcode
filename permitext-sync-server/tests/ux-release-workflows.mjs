import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {normalizeReportDraftBlock, normalizeReportManifestItem} from '../report-contract.mjs';
import {reportItemPreview, reportFactPresentation} from '../report-presentation.mjs';
import {searchWordsSnippet} from '../public/search-words.js';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const extract=name=>{
  const start=source.indexOf(source.includes(`async function ${name}(`)?`async function ${name}(`:`function ${name}(`);
  const end=source.indexOf('\n}',start);assert(start>=0&&end>start,name);return source.slice(start,end+2);
};
const scope=vm.createContext({});vm.runInContext(extract('researchPassageScopeWarning'),scope);
assert(scope.researchPassageScopeWarning('Exceptions:'));
assert(scope.researchPassageScopeWarning('  NOTE. '));
for(const value of ['Not required.','Exceptions: An exit is not required.','The rated wall shall extend to the deck.']) assert.equal(scope.researchPassageScopeWarning(value),'');
const search=vm.createContext({researchCodeEdition:()=> '2022'});
vm.runInContext(['escapeRegExp','sectionDisplayTitle','stripLeadingSectionNumber','searchResultPresentation'].map(extract).join('\n'),search);
const snippet=searchWordsSnippet('Occupant load. '+'Other table rows. '.repeat(70)+'Business areas 100 gross.','occupant load business');
const displayed=search.searchResultPresentation({sectionNumber:'1004.1.3',title:'Areas without fixed seating.',snippet,matchKind:'words'},'occupant load business');
assert.match(displayed.excerpt,/Business areas/,'The visible client excerpt must retain the matched distant table row.');
function node(){return {children:[],append(...children){this.children.push(...children);}};}
let accepted=true,current=true,visual=false,requests=[],included=[],reviewed;
const containing=vm.createContext({CSS:{escape:value=>value},document:{createElement:node},track:{querySelector:()=>({})},
  reconciledResearchProgressSession:()=>null,
  postResearch:async(path,body)=>{requests.push({path,body});return {requiresVisualReview:visual,selection:{selectedText:'Canonical complete section, including its exceptions.'}};},
  confirmWebWarning:async(title,copy,options)=>{reviewed=options.content.textContent;return accepted;},
  addResearchSelectionToCurrent:async(...args)=>included.push(args)});
vm.runInContext(extract('reviewResearchContainingSection'),containing);
const conversation={id:'conversation'},passage={sectionID:'2251',codeVersion:'2022-construction-codes'};
await containing.reviewResearchContainingSection(conversation,passage,'pane',()=>current);
assert.equal(requests[0].path,'/research/selections/review');assert.equal(requests[0].body.codeVersion,passage.codeVersion);
assert.equal(included[0][0].passages[0].selectedText,reviewed);assert.equal(included[0][1],conversation.id);
assert.equal(requests.length,1,'Only canonical text review is requested; a paid question is never submitted.');
accepted=false;included=[];await containing.reviewResearchContainingSection(conversation,passage,'pane',()=>current);assert.equal(included.length,0);
accepted=true;current=false;await containing.reviewResearchContainingSection(conversation,passage,'pane',()=>current);assert.equal(included.length,0);
current=true;visual=true;await assert.rejects(containing.reviewResearchContainingSection(conversation,passage,'pane',()=>current),/visual evidence/);

let draft='',shown='',generation=1,confirmAction=()=>{};
const input={disabled:false,get value(){return draft;},set value(value){draft=value;},dispatchEvent(){},focus(){}};
const recovery=vm.createContext({Event, CSS:{escape:value=>value},activeWorkspaceID:'workspace',state:{workflowNavigationGeneration:0},
  captureAccountRequest:()=>({generation}),isCurrentAccountRequest:id=>id.generation===generation,
  fetchAuthoritativeResearchConversation:async()=>({id:'conversation',sources:[{kind:'selection',selectedText:'Exact source text'}]}),
  document:{createElement:node},researchAnswerSourceCitation:()=> 'BC § 1004.1.3',researchCodeEdition:()=> '2022',
  confirmWebWarning:async(title,copy,options)=>{shown=options.content.children[0].textContent;confirmAction();return true;},
  paneIDForResearchConversation:()=> 'pane',track:{querySelector:()=>input},scrollPaneIntoView(){},
  openSupplementalResearchConversation:()=>assert.fail('An existing conversation stays open.')});
vm.runInContext(extract('reviewResearchFailedQuestion'),recovery);
await recovery.reviewResearchFailedQuestion('conversation','Original calculator question');
assert.equal(shown,'Original calculator question');assert.equal(draft,shown);
draft='Keep my unsent writing';await assert.rejects(recovery.reviewResearchFailedQuestion('conversation','Original'),/unsent draft/);assert.equal(draft,'Keep my unsent writing');
draft='';confirmAction=()=>generation++;await recovery.reviewResearchFailedQuestion('conversation','Old account question');assert.equal(draft,'');

const block=normalizeReportDraftBlock({kind:'researchAnswer',sourceID:'answer',label:'Full source question',reportTitle:'Concise finding',includeResearchMetadata:false});
assert.equal(block.reportTitle,'Concise finding');assert.equal(block.includeResearchMetadata,false);
const note=normalizeReportDraftBlock({kind:'paragraph',text:'Original analysis',reportTitle:'Corridor rating',derivedFrom:{kind:'notebookCard',id:'note',title:'Corridor rating',version:2},sourceSnapshotAt:'2026-10-24',evidenceLinks:[]});
assert.equal(normalizeReportManifestItem(note).reportTitle,'Corridor rating');assert.equal(note.derivedFrom.title,'Corridor rating');
const item={kind:'researchAnswer',question:'Full original question',conclusion:'Exact conclusion',explanation:'Exact conclusion',
  assumptions:['Assumed indoor use'],limitations:['Occupancy approval is not established'],additionalEvidenceNeeded:['Obtain occupancy records'],
  codeBasis:{disclosure:'Included passages only; no additional sources searched',pinnedCorpora:[{label:'2022 BC'}]},includeResearchMetadata:false};
const before=JSON.stringify(item),brief=reportItemPreview(item);
assert(!brief.some(part=>part.label==='Question'||part.label==='Corpus basis'));
assert.equal(brief.filter(part=>part.text==='Exact conclusion').length,1);
for(const required of ['Assumed indoor use','Occupancy approval is not established','Obtain occupancy records','no additional sources searched']) assert(brief.some(part=>part.text.includes(required)),required);
assert.equal(JSON.stringify(item),before,'Presentation never rewrites stored analysis.');
assert(reportItemPreview({...item,includeResearchMetadata:true}).some(part=>part.label==='Question'));
const facts={facts:'Custom Fact — Sprinkler status: Unknown (unknown; not established; preserve the stated negation, scope and uncertainty).'};
const factBefore=JSON.stringify(facts),presentation=reportFactPresentation(facts);
assert(presentation.notes[0].text.includes('preserve the stated negation'));
assert.equal(presentation.notes[0].displayText,'unknown; not established');
assert(!JSON.stringify(reportItemPreview({...facts,kind:'projectFacts'})).includes('preserve the stated negation'));
assert.equal(JSON.stringify(facts),factBefore);

let accountGeneration=1,workspace='workspace',acted=0,timerID=0;
const timers=new Map(),notices=[];
function noticeNode(){return {children:[],events:{},append(...children){this.children.push(...children);},setAttribute(){},
  addEventListener(type,fn){this.events[type]=fn;},remove(){this.removed=true;},contains(){return false;}};}
const noticesContext=vm.createContext({document:{createElement:noticeNode,body:{append:node=>notices.push(node)}},
  captureAccountRequest:()=>({generation:accountGeneration}),isCurrentAccountRequest:id=>id.generation===accountGeneration,
  activeWorkspaceID:workspace,setTimeout:callback=>{timers.set(++timerID,callback);return timerID;},clearTimeout:id=>timers.delete(id)});
vm.runInContext('let workspaceNotice=null;\n'+['clearWorkspaceNotice','presentWorkspaceNotice'].map(extract).join('\n'),noticesContext);
noticesContext.presentWorkspaceNotice('Passage added',{actionLabel:'View Research',onAction:()=>acted++});
assert.equal(notices.length,1);notices[0].events.pointerenter();assert.equal(timers.size,0,'Hover preserves time to use the destination action.');
notices[0].events.pointerleave();assert.equal(timers.size,1);
accountGeneration++;notices[0].children[1].events.click();assert.equal(acted,0,'Old-account confirmations cannot navigate the new account.');
assert(notices[0].removed);assert.equal(timers.size,0);
noticesContext.presentWorkspaceNotice('New confirmation');noticesContext.clearWorkspaceNotice();assert(notices[1].removed);
console.log('UX release workflows passed: exact reviewed section, cancellation/stale/visual guards, recovery draft without paid submission or overwrite, report title lineage, reversible detail choice and preserved qualifications.');
