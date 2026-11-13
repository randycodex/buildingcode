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
  return { children: [], callbacks: {}, classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) },
    append(...items) { this.children.push(...items); }, addEventListener(name, action) { this.callbacks[name] = action; },
    querySelector() { return this; } };
}
function deferred() { let resolve, reject; const promise = new Promise((a,b) => {resolve=a; reject=b;}); return {promise,resolve,reject}; }
function harness({ pro = true } = {}) {
  const content = element(), requests = [];
  content.children = ["Original enacted provision"];
  const panel = { dataset: {}, isConnected: true, querySelector: () => content };
  const reader = { chapterID: "synthetic-chapter" };
  const opened = [];
  const restore = () => { panel.dataset.readerSearchToken = randomUUID(); content.classList.remove("is-searching-reader"); content.children = ["Original enacted provision"]; };
  const context = vm.createContext({ readerSearchMatch, snippetForMatch, readerSearchResultHeading, rankReaderSearchResults, crypto: { randomUUID }, document: { createElement: element },
    isProAccount: () => pro,
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
  vm.runInContext(source.slice(source.indexOf("function cancelReaderInternalSearch("), source.indexOf("async function fetchReaderChapterSearch(")) + source.slice(start,end+2)+"\nglobalThis.render = renderReaderInternalSearchResults;",context);
  return {content,panel,requests,restore,opened,cancel:()=>context.cancelReaderInternalSearch(panel),run: (query,options) => context.render(panel,reader,query,options)};
}

// A tab's saved search is complete before its detached Reader is published.
{
  const t=harness();t.panel.isConnected=false;
  const pending=t.run('stairs',{allowDetached:true});
  t.requests[0].resolve([{chapterID:'synthetic-chapter',sectionID:'stairs',heading:'Stairs',snippet:''}]);
  await pending;
  assert.equal(t.content.children[0].children.find(item=>item.className==='reader-internal-result').children[0].textContent,'Stairs');
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
  assert.equal(t.content.children[0].children.find(item => item.className === "reader-internal-result").children[0].textContent,"1 Stairs");
  t.requests[0].resolve([]); await older;
  assert.equal(t.content.children[0].children.find(item => item.className === "reader-internal-result").children[0].textContent,"1 Stairs");
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
  assert.equal(rows[0].textContent,"Current chapter");
  assert.equal(rows[1].textContent,"No matches in this chapter.");
  assert.equal(rows[2].textContent,"Chapter 3: General regulations");
  // The actual toggle is a DOM element; this fixture needs only its ARIA setter.
  t.content.setAttribute=()=>{};
  await rows[3].callbacks.click();
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
  const rows=t.content.children[0].children;
  assert.equal(rows[0].textContent,'Chapter 10');
  assert.equal(rows[1].children[0].textContent,'1005.3 Required capacity');
  assert.equal(rows[2].textContent,'Current chapter');
  assert.equal(rows[3].children[0].textContent,'202 Definitions');
}

// Free find is scoped to the open chapter, including its recovery copy.
{
  const t=harness({pro:false}), pending=t.run("egress");
  assert.equal(t.content.children[0],"Searching this chapter");
  t.requests[0].resolve([{chapterID:"synthetic-chapter",sectionID:"107.5",heading:"107.5 Means of egress plans",snippet:"Egress analysis",corpusRevision:"a".repeat(64),matchText:"egress",blockID:"paragraph-1"}]);
  await pending;
  const rows=t.content.children[0].children;
  assert.equal(rows[0].textContent,"Current chapter");
  assert.equal(rows.filter(row=>row.className==="reader-internal-results-heading").length,1);
  t.content.setAttribute=()=>{};
  await rows[1].callbacks.click();
  assert.equal(t.opened[0].chapterID,"synthetic-chapter");
  assert.equal(t.opened[0].sectionID,"107.5");
  assert.equal(t.opened[0].pendingSearchHighlightBlockID,"paragraph-1");
  const noMatches=t.run("storm drainage");
  t.requests[1].resolve([]);await noMatches;
  assert.deepEqual(t.content.children,["No match in this chapter","Try a shorter phrase, or choose another chapter."]);
}
console.log("Free Reader search passed: chapter-only requests, matching scope copy, same-chapter exact passage navigation and chapter-only empty results.");

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
    linkPaneToView,state, savedItemOpeningAttempts:new Map(), searchReaderOpeningAttempts:new Map(), activeWorkspaceID:"workspace",
    captureAccountRequest:()=>generation,isCurrentAccountRequest:value=>value===generation,
    workspaceColumnsRequireProject:()=>false,currentColumnWorkflowView:()=>"research",workflowPaneIsVisible:()=>true,
    resolveReaderSource(item) {const request=deferred();requests.push({...request,item});return request.promise;},
    searchResultDetail:item=>item,readerFieldsForSectionDetail:(item,options)=>({...item,...options}),
    isProAccount:()=>true,newReaderState:fields=>({id:`reader-${++nextID}`,...fields}),
    paneIDForReader:reader=>reader.id,defaultPaneWidthForID:()=>630,placePaneAfter(){},appendPaneIfMissing(){},
    updateBrowserSectionURL(){},scheduleContinuitySync(){},saveWorkspaceState(){saves++;},
    showWebNotice:async(title,message)=>notices.push({title,message}),
    normalizeAnnotationBlockID:value=>value||"",transitionWorkspace:async()=>{},whenWorkspacePaneReady:async()=>true,
    resolvedReaderSourceNavigations:new WeakMap(),track:{querySelector:()=>null},CSS:{escape:value=>value},
    retainReaderForSource:()=>null,
    paneIsCollapsed:()=>false,columnExpansionController:()=>({reveal(){}}),scrollPaneIntoView(){},
    revealReaderSourceTarget:(reader,item,anchor)=>opened.push({reader,item,anchor})
  });
  vm.runInContext(["reusableSearchReader","openSourceInReader","openSavedItemInReader"].map(actual).join("\n"),context);
  return {state,requests,notices,opened,run:item=>context.openSavedItemInReader(item,"saved"),
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
  assert.equal(t.opened[0].reader.sourceOwnerPaneID,undefined,"Saved Evidence opens an independent Reader");assert.equal(t.state.readers[0].sectionID,"unrelated");
}
for(const outcome of ["resolve","reject"]) {
  const t=savedHarness(),before=JSON.stringify(t.state),pending=t.run(historicalSaved);
  await settleSourceResolution();t.switchAccount();
  t.requests[0][outcome](outcome==="resolve"?historicalSaved:new Error("Old account result"));await pending;
  assert.equal(t.notices.length,0);assert.equal(t.opened.length,0);assert.equal(t.saves,0);assert.equal(JSON.stringify(t.state),before);
}
console.log("Reader recovery passed: find preservation/retry, visible saved-citation failure, exact-source reopening, and stale-account suppression.");
