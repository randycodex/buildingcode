import {linkPaneToView} from '../public/workflow-views.js';
import { readerSearchMatch, snippetForMatch, readerSearchResultHeading, rankReaderSearchResults } from "../public/reader-search-match.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("async function renderReaderInternalSearchResults(");
const end = source.indexOf("\n}", start);
assert.ok(start > 0 && end > start);
function element() {
  const classes = new Set();
  return { children: [], callbacks: {}, dataset:{}, attributes:{}, open:false, setAttribute(name,value){this.attributes[name]=String(value);}, classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) },
    append(...items) { this.children.push(...items); }, addEventListener(name, action) { this.callbacks[name] = action; },
    querySelector() { return this; } };
}
const nodes = node => node && typeof node === 'object' ? [node,...(node.children||[]).flatMap(nodes)] : [];
const results = t => nodes(t.content).filter(node=>node.className==='reader-internal-result');
const groups = t => nodes(t.content).filter(node=>node.className?.includes('reader-search-chapter'));
const text = node => typeof node === 'string' ? node : (node?.textContent||'')+(node?.children||[]).map(text).join('');
function appFunction(name){const start=source.indexOf(`function ${name}(`);return source.slice(start,source.indexOf('\n}',start)+2);}
function deferred() { let resolve, reject; const promise = new Promise((a,b) => {resolve=a; reject=b;}); return {promise,resolve,reject}; }
function harness({ pro = true, view = 'research' } = {}) {
  const content = element(), requests = [];
  const layout = {shift:0}, revision = {generation:1};
  content.getBoundingClientRect = () => ({top:0});
  content.children = ["Original enacted provision"];
  const panel = { dataset: {}, isConnected: true, querySelector: () => content };
  const reader = { id:'reader',codePrefix:'BC',codeVersion:'2022',chapterID: "synthetic-chapter" };
  const opened = [],openedSources=[];
  const restore = () => { panel.dataset.readerSearchToken = randomUUID(); content.classList.remove("is-searching-reader"); content.children = ["Original enacted provision"]; };
  const createElement = () => {
    const node=element();
    node.getBoundingClientRect=()=>({top:node.className==='reader-internal-result' ? 300+layout.shift-content.scrollTop : 0});
    return node;
  };
  const context = vm.createContext({ readerSearchMatch, snippetForMatch, readerSearchResultHeading, rankReaderSearchResults, crypto: { randomUUID }, document: { createElement },
    publicCodeRevision:revision,
    researchCodeEdition:()=> '2022',
    isProAccount: () => pro,
    currentColumnWorkflowView:()=>view,paneIDForReader:reader=>`reader:${reader.id}`,
    openSourceInReader:async(item,anchor,options)=>openedSources.push({item,anchor,options}),
    annotatedBlocksForSection: section => section.blocks || [],
    annotationTargetForBlock: (_section, block, _reader, index) => ({blockID: block.id || `block-${index}`}),
    stopReaderProgressiveHydration() {}, startReaderSectionVisibility() {}, clear: node => {node.children = [];},
    emptyReader: (node,title,message) => {node.children = [title,message];},
    renderSectionContent: restore, readerSearchTimers: new Map(), clearTimeout,
    AbortController, captureReaderScrollPositions: () => new Map(),
    refreshReaderContent: async (_panel, target, options) => opened.push({ ...target, options }),
    updateBrowserSectionURL() {}, scheduleContinuitySync() {}, saveWorkspaceState() {},
    fetchReaderChapterSearch(_reader, _query, signal, options) { assert.equal(options.scope, pro ? "code" : "chapter"); const request = { ...deferred(), signal }; requests.push(request); return request.promise; },
    sectionDisplayTitle: (number,title) => `${number} ${title}`, plainTextForSearchBlock: block => block.plainText,
    appendHighlighted: (node,value) => {node.textContent = value;}, snippetForMatch: value => value
  });
  vm.runInContext(['escapeRegExp','stripLeadingSectionNumber','searchResultPresentation','searchResultChapter'].map(appFunction).join('\n')+'\n'+source.slice(source.indexOf("function cancelReaderInternalSearch("), source.indexOf("async function fetchReaderChapterSearch(")) + source.slice(start,end+2)+"\nglobalThis.render = renderReaderInternalSearchResults;",context);
  return {content,panel,reader,requests,restore,opened,openedSources,layout,revision,cancel:()=>context.cancelReaderInternalSearch(panel),close:()=>context.restoreReaderAfterSearch(panel,reader),run: (query,options) => context.render(panel,reader,query,options)};
}

// Notebook's direct section search shares the same recent-source opening path.
{
  const t=harness({view:'notebook'}),pending=t.run('1005.3');
  t.requests[0].resolve([{chapterID:'other-chapter',chapterTitle:'Chapter 10',sectionID:'exact',sectionNumber:'1005.3',heading:'1005.3 Required capacity',snippet:''}]);
  await pending;
  await results(t)[0].callbacks.click();
  assert.equal(t.opened.length,0);assert.equal(t.openedSources.length,1);
  assert.equal(t.openedSources[0].item.sectionID,'exact');assert.equal(t.openedSources[0].item.codePrefix,'BC');
  assert.equal(t.openedSources[0].anchor,'reader:reader');assert.equal(t.openedSources[0].options.searchQuery,'1005.3');
}

// A tab's saved search is complete before its detached Reader is published.
{
  const t=harness();t.panel.isConnected=false;
  const pending=t.run('stairs',{allowDetached:true});
  t.requests[0].resolve([{chapterID:'synthetic-chapter',sectionID:'stairs',heading:'Stairs',snippet:''}]);
  await pending;
  assert.equal(text(results(t)[0].children[0]),'Stairs');
  const cancelled=t.run('water',{allowDetached:true});t.cancel();
  assert.equal(t.requests[1].signal.aborted,true);
  t.requests[1].resolve([{chapterID:'synthetic-chapter',sectionID:'water',heading:'Obsolete result',snippet:''}]);
  await cancelled;
  assert.equal(t.content.children.some(item=>item.children?.some(row=>row.children?.some(node=>node.textContent==='Obsolete result'))),false);
}

// Opening/clearing find preserves the enacted text; it never presents a blank pane.
{
  const t = harness(); await t.run(""); await t.run("s");
  assert.deepEqual(t.content.children,["Original enacted provision"]);
  assert.equal(t.requests.length,0);
  const pending=t.run("sprinkler"); await t.run("");
  t.requests[0].resolve([]); await pending;
  assert.deepEqual(t.content.children,["Original enacted provision"]);
}
// Closing find or starting a newer query prevents a late search from replacing the Reader.
{
  const t=harness(); const older=t.run("sprinkler"); const newer=t.run("stairs");
  assert.equal(t.requests[0].signal.aborted, true, "new query aborts older fetch");
  t.requests[1].resolve([{chapterID:"synthetic-chapter",sectionID:"stair",sectionNumber:"1",title:"Stairs",heading:"1 Stairs",snippet:"",blockID:""}]); await newer;
  assert.equal(text(results(t)[0].children[0]),"1 Stairs");
  t.requests[0].resolve([]); await older;
  assert.equal(text(results(t)[0].children[0]),"1 Stairs");
  const closed=t.run("sprinkler"); t.restore(); t.requests[2].resolve([]); await closed;
  assert.deepEqual(t.content.children,["Original enacted provision"]);
}
// A failed fetch and a zero-result query both offer visible recovery.
{
  const t=harness(); const pending=t.run("sprinkler");
  t.requests[0].reject(new Error("offline")); await pending;
  assert.equal(t.content.children[0],"Search could not load");
  assert.equal(t.content.children[2].textContent,"Try again");
  const retry=t.run("sprinkler"); t.requests[1].resolve([]); await retry;
  assert.equal(t.content.children[0],"No match in this code");
}
// Cross-chapter matches retain chapter identity and open in this Reader.
{
  const t=harness(), pending=t.run("water");
  t.requests[0].resolve([{chapterID:"other-chapter",chapterTitle:"Chapter 3: General regulations",sectionID:"other-section",heading:"301 Water",snippet:"Water",corpusRevision:"b".repeat(64),matchText:"Water",blockID:"paragraph-2"}]);
  await pending;
  const rows=t.content.children[0].children;
  assert.equal(rows[0].textContent,"No matches in the current chapter.");
  assert.equal(groups(t)[0].children[0].children[0].textContent,"Chapter 3: General regulations");
  // The actual toggle is a DOM element; this fixture needs only its ARIA setter.
  t.content.setAttribute=()=>{};
  await results(t)[0].callbacks.click();
  assert.equal(t.opened[0].chapterID,"other-chapter");
  assert.equal(t.opened[0].sectionID,"other-section");
  assert.equal(t.opened[0].pendingSearchHighlightBlockID,"paragraph-2");
  assert.equal(t.opened[0].options.expectedCorpusRevision,"b".repeat(64));
}
assert.match(source.slice(source.indexOf("async function renderSectionContent("), source.indexOf("\n}", source.indexOf("async function renderSectionContent("))),/readerSearchToken/);

// An exact provision outside the current chapter precedes local citations,
// without labeling that result as belonging to the current chapter.
{
  const t=harness(), pending=t.run('1005.3');
  t.requests[0].resolve([
    {chapterID:'synthetic-chapter', sectionID:'citation', sectionNumber:'202', heading:'202 Definitions', snippet:'See 1005.3.'},
    {chapterID:'other-chapter', chapterTitle:'Chapter 10', sectionID:'exact', sectionNumber:'1005.3', heading:'1005.3 Required capacity', snippet:''}
  ]);
  await pending;
  assert.equal(groups(t)[0].children[0].children[0].textContent,'Chapter 10');
  assert.equal(text(results(t)[0].children[0]),'1005.3 Required capacity');
  assert.equal(groups(t)[1].children[0].children[0].textContent,'Current chapter');
  assert.equal(text(results(t)[1].children[0]),'202 Definitions');
}

// Free find is scoped to the open chapter, including its recovery copy.
{
  const t=harness({pro:false}), pending=t.run("egress");
  assert.equal(t.content.children[0],"Searching this chapter");
  t.requests[0].resolve([{chapterID:"synthetic-chapter",sectionID:"107.5",heading:"107.5 Means of egress plans",snippet:"Egress analysis",corpusRevision:"a".repeat(64),matchText:"egress",blockID:"paragraph-1"}]);
  await pending;
  assert.equal(groups(t)[0].children[0].children[0].textContent,"Current chapter");
  assert.equal(groups(t).length,1);
  t.content.setAttribute=()=>{};
  await results(t)[0].callbacks.click();
  assert.equal(t.opened[0].chapterID,"synthetic-chapter");
  assert.equal(t.opened[0].sectionID,"107.5");
  assert.equal(t.opened[0].pendingSearchHighlightBlockID,"paragraph-1");
  const noMatches=t.run("storm drainage");
  t.requests[1].resolve([]);await noMatches;
  assert.deepEqual(t.content.children,["No match in this chapter","Try a shorter phrase, or choose another chapter."]);
}
console.log("Free Reader search passed: chapter-only requests, matching scope copy, same-chapter exact passage navigation and chapter-only empty results.");

// Reader and Search share chapter labels, compact headings and excerpts.
// Each chapter occurs once even when ranking interleaves its matches.
{
  const t=harness();
  const matches=[
    {chapterID:'synthetic-chapter',chapterTitle:'Chapter 1: Administration',sectionID:'first',sectionNumber:'110.3.1',heading:'110.3.1 Footing and foundation inspection.',snippet:'Concrete foundations are inspected.'},
    {chapterID:'other',chapterTitle:'Chapter 2',sectionID:'definition',sectionNumber:'202',heading:'202 Concrete',snippet:'Concrete is a construction material.'},
    {chapterID:'synthetic-chapter',chapterTitle:'Chapter 1: Administration',sectionID:'last',sectionNumber:'110.3.2',heading:'110.3.2 '+('Concrete foundations shall be inspected. '.repeat(12)),snippet:''}
  ];
  const original=JSON.stringify(matches);
  const querySelector=t.panel.querySelector;
  t.panel.querySelector=selector=>selector==='.chapter-select'
    ? {options:[{value:'other',textContent:'Chapter 2: Definitions'}]} : querySelector(selector);
  let pending=t.run('concrete');t.requests[0].resolve(matches);await pending;
  assert.equal(groups(t).length,2);
  assert.equal(groups(t)[0].children[0].children[0].textContent,'Chapter 1: Administration · Current chapter');
  assert.equal(groups(t)[0].children[0].children[1].textContent,'2');
  assert.equal(groups(t)[1].children[0].children[1].textContent,'1');
  assert.equal(groups(t)[1].children[0].children[0].textContent,'Chapter 2: Definitions');
  assert(groups(t).every(group=>group.open===false),'All chapters start collapsed, as in Search');
  assert.deepEqual(results(t).map(row=>text(row.children[0])),['110.3.1 Footing and foundation inspection.','110.3.2 Code passage','202 Concrete']);
  assert(results(t)[1].children[1].textContent.length<=233,'A long provision becomes a bounded excerpt, never a giant heading');
  assert.match(results(t)[1].children[1].textContent,/Concrete/);
  groups(t)[0].open=true;groups(t)[0].callbacks.toggle();
  pending=t.run('concrete');t.requests[1].resolve(matches);await pending;
  assert.equal(groups(t)[0].open,true,'The same query retains the user expansion choice');
  pending=t.run('foundation');t.requests[2].resolve(matches);await pending;
  assert(groups(t).every(group=>group.open===false),'A new query starts collapsed');
  groups(t)[0].open=true;groups(t)[0].callbacks.toggle();t.reader.codeVersion='2014';
  pending=t.run('foundation');t.requests[3].resolve(matches);await pending;
  assert(groups(t).every(group=>group.open===false),'Edition changes cannot inherit another edition’s expanded chapters');
  assert.equal(JSON.stringify(matches),original,'Grouping never mutates source text, section IDs or chapter metadata');
}
console.log('Reader Search presentation passed: collapsed counted chapters, no duplicate groups, shared labels and compact excerpts, query/edition-isolated expansion, exact source preservation.');

// Reopening Find after a result restores the same ordered list and expansion,
// anchored to the clicked row even when the current-chapter message changes.
{
  const t=harness(),matches=[
    {chapterID:'synthetic-chapter',chapterTitle:'Chapter 1: Administration',sectionID:'first',sectionNumber:'101',heading:'101 Walls',snippet:'Walls'},
    {chapterID:'other',chapterTitle:'Chapter 3: General',sectionID:'last',sectionNumber:'301',heading:'301 Walls',snippet:'Walls'}
  ];
  const pending=t.run('walls');t.requests[0].resolve(matches);await pending;
  groups(t)[1].open=true;groups(t)[1].callbacks.toggle();
  t.content.scrollTop=80;
  const offset=results(t)[1].getBoundingClientRect().top;
  await results(t)[1].callbacks.click();
  t.content.classList.remove('is-searching-reader');t.content.children=['Enacted passage'];t.content.scrollTop=10;
  const reveal=deferred();
  const resumed=t.run('walls',{resume:true,reveal:reveal.promise});
  t.layout.shift=42;
  reveal.resolve(true);await resumed;
  assert.equal(t.requests.length,1,'Reopening the same search never refetches or reranks the list');
  assert.deepEqual(results(t).map(row=>text(row.children[0])),['101 Walls','301 Walls']);
  assert.equal(groups(t)[1].open,true,'The clicked chapter stays expanded');
  assert.equal(groups(t)[0].open,false);
  assert.equal(groups(t)[0].children[0].children[0].textContent,'Chapter 1: Administration');
  assert.equal(groups(t)[1].children[0].children[0].textContent,'Chapter 3: General · Current chapter');
  assert.equal(results(t)[1].getBoundingClientRect().top,offset,'The clicked row returns to its exact viewport offset');
  assert.equal(t.content.scrollTop,122,'Anchoring corrects changes above the result');
  t.content.scrollTop=180;
  await t.close();await t.run('walls',{resume:true});
  assert.equal(t.content.scrollTop,180,'Closing and reopening Find also remembers its scroll');
  assert.equal(t.requests.length,1);
  await results(t)[1].callbacks.click();
  t.content.classList.remove('is-searching-reader');
  const interruptedReveal=deferred();
  const interrupted=t.run('walls',{resume:true,reveal:interruptedReveal.promise});
  t.cancel();t.content.scrollTop=33;
  interruptedReveal.resolve(false);await interrupted;
  assert.equal(t.content.scrollTop,33,'An interrupted reveal cannot restore over newer navigation');
  await t.run('');
  assert.equal(t.panel._readerSearchView,undefined,'Clearing the query retires the retained results');
}
for (const [label,mutate,options] of [
  ['query',t=>{},{}],
  ['edition',t=>{t.reader.codeVersion='2014';},{}],
  ['codebook',t=>{t.reader.codePrefix='PC';},{}],
  ['tab',t=>{t.reader.activeTabID='another-tab';},{}],
  ['library generation',t=>{t.revision.generation++;},{}],
  ['Free chapter scope',t=>{t.reader.chapterID='another-chapter';},{pro:false}]
]) {
  const t=harness(options),pending=t.run('walls');
  t.requests[0].resolve([{chapterID:'synthetic-chapter',sectionID:'wall',heading:'Walls'}]);await pending;
  t.content.scrollTop=600;await results(t)[0].callbacks.click();
  t.content.classList.remove('is-searching-reader');
  mutate(t);
  const fresh=t.run(label==='query'?'stairs':'walls',{resume:true});
  assert.equal(t.requests.length,2,`${label} changes must fetch fresh scoped results`);
  t.requests[1].resolve([{chapterID:t.reader.chapterID,sectionID:'fresh',heading:'Fresh result'}]);await fresh;
  assert.equal(t.content.scrollTop,0,`${label} cannot inherit a different search's scroll position`);
}
console.log('Reader Find return passed: retained ordering and expansion, exact clicked-row offset, no repeated search, and query/source/tab/library/scope isolation.');

// Saved citations use the same guarded Reader opener. A failed source lookup
// cannot create an abandoned column or alter the saved citation, and retries
// retain its historical edition and exact passage.
const actual = name => {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start > 0, name);
  return source.slice(start, source.indexOf("\n}", start) + 2);
};
const settleSourceResolution = () => new Promise(resolve => setImmediate(resolve));
function savedHarness() {
  const requests = [], notices = [], opened = [];
  const unrelated = {id:"manual",sectionID:"unrelated"};
  const state = {readers:[unrelated],utilityInstances:[{id:"unrelated",key:"search"}],paneWeights:{},paneOrder:[]};
  let generation = 1, nextID = 0, saves = 0;
  const context = vm.createContext({
    workingResearchNote:()=>null,linkPaneToView,state, savedItemOpeningAttempts:new Map(), searchReaderOpeningAttempts:new Map(), activeWorkspaceID:"workspace",
    captureAccountRequest:()=>generation,isCurrentAccountRequest:value=>value===generation,
    workspaceColumnsRequireProject:()=>false,currentColumnWorkflowView:()=>"research",workflowPaneIsVisible:()=>true,
    resolveReaderSource(item) {const request=deferred();requests.push({...request,item});return request.promise;},
    searchResultDetail:item=>item,readerFieldsForSectionDetail:(item,options)=>({...item,...options}),
    isProAccount:()=>true,newReaderState:fields=>({id:`reader-${++nextID}`,...fields}),
    paneIDForReader:reader=>reader.id,defaultPaneWidthForID:()=>630,placePaneAfter(){},appendPaneIfMissing(){},
    updateBrowserSectionURL(){},scheduleContinuitySync(){},saveWorkspaceState(){saves++;},
    notifyReaderColumnLimit:()=>false,showWebNotice:async(title,message)=>notices.push({title,message}),
    normalizeAnnotationBlockID:value=>value||"",transitionWorkspace:async()=>{},whenWorkspacePaneReady:async()=>true,
    resolvedReaderSourceNavigations:new WeakMap(),track:{querySelector:()=>null},CSS:{escape:value=>value},
    retainReaderForSource:()=>null,
    paneIsCollapsed:()=>false,columnExpansionController:()=>({reveal(){}}),scrollPaneIntoView(){},
    revealReaderSourceTarget:(reader,item,anchor)=>opened.push({reader,item,anchor})
  });
  vm.runInContext(["reusableSearchReader","openSourceInReader","openSavedItemInReader"].map(actual).join("\n"),context);
  return {state,requests,notices,opened,run:item=>context.openSavedItemInReader(item,"utility:saved:evidence"),
    switchAccount:()=>{generation++;},get saves(){return saves;}};
}
const historicalSaved = {sectionID:"2014-1010.2",sectionNumber:"1010.2",title:"Slope",codeVersion:"2014",chapterID:"2014-chapter-10",blockID:"exact",evidenceAnchor:{passages:[{exact:"Saved source text"}]}};
{
  const t=savedHarness(),before=JSON.stringify(t.state),citation=JSON.stringify(historicalSaved),pending=t.run(historicalSaved);
  await settleSourceResolution();t.requests[0].reject(new Error("Failed to fetch"));await pending;
  assert.equal(t.notices[0].title,"Source could not be opened");assert.match(t.notices[0].message,/Failed to fetch/);
  assert.equal(t.opened.length,0);assert.equal(JSON.stringify(t.state),before);assert.equal(t.saves,0);
  assert.equal(JSON.stringify(historicalSaved),citation,"Failure preserves the saved historical passage");
  const retry=t.run(historicalSaved);await settleSourceResolution();t.requests[1].resolve(historicalSaved);await retry;
  assert.equal(t.opened[0].item.sectionID,historicalSaved.sectionID);assert.equal(t.opened[0].reader.codeVersion,"2014");
  assert.equal(t.opened[0].reader.sourceBlockID,"exact");assert.equal(t.opened[0].anchor,historicalSaved.evidenceAnchor);
  assert.equal(t.opened[0].reader.sourceOwnerPaneID,"utility:saved:evidence");assert.equal(t.state.readers[0].sectionID,"unrelated");
}
for(const outcome of ["resolve","reject"]) {
  const t=savedHarness(),before=JSON.stringify(t.state),pending=t.run(historicalSaved);
  await settleSourceResolution();t.switchAccount();
  t.requests[0][outcome](outcome==="resolve"?historicalSaved:new Error("Old account result"));await pending;
  assert.equal(t.notices.length,0);assert.equal(t.opened.length,0);assert.equal(t.saves,0);assert.equal(JSON.stringify(t.state),before);
}
console.log("Reader recovery passed: find preservation/retry, visible saved-citation failure, exact-source reopening, and stale-account suppression.");
