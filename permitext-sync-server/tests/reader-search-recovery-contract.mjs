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
function harness() {
  const content = element(), requests = [];
  content.children = ["Original enacted provision"];
  const panel = { dataset: {}, isConnected: true, querySelector: () => content };
  const reader = { chapterID: "synthetic-chapter" };
  const restore = () => { panel.dataset.readerSearchToken = randomUUID(); content.classList.remove("is-searching-reader"); content.children = ["Original enacted provision"]; };
  const context = vm.createContext({ crypto: { randomUUID }, document: { createElement: element },
    stopReaderProgressiveHydration() {}, clear: node => {node.children = [];},
    emptyReader: (node,title,message) => {node.children = [title,message];},
    renderSectionContent: restore,
    fetchChapter() { const request = deferred(); requests.push(request); return request.promise; },
    sectionDisplayTitle: (number,title) => `${number} ${title}`, plainTextForSearchBlock: block => block.plainText,
    appendHighlighted: (node,value) => {node.textContent = value;}, snippetForMatch: value => value
  });
  vm.runInContext(source.slice(start,end+2)+"\nglobalThis.render = renderReaderInternalSearchResults;",context);
  return {content,panel,requests,restore,run: query => context.render(panel,reader,query)};
}

// Opening/clearing find preserves the enacted text; it never presents a blank pane.
{
  const t = harness(); await t.run(""); await t.run("s");
  assert.deepEqual(t.content.children,["Original enacted provision"]);
  assert.equal(t.requests.length,0);
  const pending=t.run("sprinkler"); await t.run("");
  t.requests[0].resolve({sections:[]}); await pending;
  assert.deepEqual(t.content.children,["Original enacted provision"]);
}
// Closing find or starting a newer query prevents a late search from replacing the Reader.
{
  const t=harness(); const older=t.run("sprinkler"); const newer=t.run("stairs");
  t.requests[1].resolve({sections:[{id:"stair",sectionNumber:"1",title:"Stairs",blocks:[]}]}); await newer;
  assert.equal(t.content.children[0].children[0].children[0].textContent,"1 Stairs");
  t.requests[0].resolve({sections:[]}); await older;
  assert.equal(t.content.children[0].children[0].children[0].textContent,"1 Stairs");
  const closed=t.run("sprinkler"); t.restore(); t.requests[2].resolve({sections:[]}); await closed;
  assert.deepEqual(t.content.children,["Original enacted provision"]);
}
// A failed fetch and a zero-result query both offer visible recovery.
{
  const t=harness(); const pending=t.run("sprinkler");
  t.requests[0].reject(new Error("offline")); await pending;
  assert.equal(t.content.children[0],"Search could not load");
  assert.equal(t.content.children[2].textContent,"Try again");
  const retry=t.run("sprinkler"); t.requests[1].resolve({sections:[]}); await retry;
  assert.equal(t.content.children[0],"No exact match in this chapter");
}
assert.match(source.slice(source.indexOf("async function renderSectionContent("),source.indexOf("async function renderSectionContent(")+220),/readerSearchToken/);

// A saved citation fetch failure must resolve to visible recovery, remove only
// its abandoned detail pane, and retain the exact citation for another attempt.
const savedStart = source.indexOf("async function openSavedItemInReader(");
const savedEnd = source.indexOf("\nasync function startFocusedResearchFromSavedItem(", savedStart);
const removeStart = source.indexOf("function removeSectionDetail(");
const removeEnd = source.indexOf("\nfunction closeSavedItemDetailsForPane(", removeStart);
assert.ok(savedStart > 0 && savedEnd > savedStart && removeStart > 0 && removeEnd > removeStart);
function savedHarness({ online = false } = {}) {
  const details = {}, anchors = {}, requests = [], notices = [], opened = [];
  const state = { readers: [], utilityInstances: [{id:"unrelated",key:"search"}], paneWeights: {}, paneOrder: [] };
  let generation = 1, nextID = 0, saves = 0;
  const context = vm.createContext({
    state, navigator: { onLine: online },
    captureAccountRequest: () => generation,
    isCurrentAccountRequest: value => value === generation,
    closeSavedItemDetailsForPane() {}, closeLinkedReaderForSearch() {},
    sectionDetailsBySearch: () => details, sectionDetailAnchorsBySearch: () => anchors,
    paneIDForSectionDetail: id => `detail:${id}`,
    newUtilityInstance: key => ({id:`attempt-${++nextID}`,key}),
    openSectionDetail(id, item, options) {
      details[id] = item; anchors[id] = options.anchorPaneID;
      state.paneWeights[`detail:${id}`] = 400; state.paneOrder.push(`detail:${id}`);
      const request = deferred(); requests.push({ ...request, item, options }); return request.promise;
    },
    saveWorkspaceState() { saves += 1; },
    showWebNotice: async (title, message) => { notices.push({title,message}); },
    paneIDForReader: reader => reader.id,
    normalizeAnnotationBlockID: value => value || "",
    openOrUpdateLinkedReaderForSearch: async (id, detail) => { opened.push(detail); return {id:`reader:${id}`}; },
    transitionWorkspace: async () => {}, revealReaderSourceTarget() {}, scrollPaneIntoView() {}
  });
  vm.runInContext(source.slice(removeStart,removeEnd)+"\n"+source.slice(savedStart,savedEnd)+"\nglobalThis.openSaved = openSavedItemInReader;",context);
  return {state,details,anchors,requests,notices,opened,run:item=>context.openSaved(item,"saved"),switchAccount:()=>{generation+=1;},get saves(){return saves;}};
}
const historicalSaved = { sectionID:"2014-1010.2", sectionNumber:"1010.2", title:"Slope", codeVersion:"2014", chapterID:"2014-chapter-10" };
{
  const t=savedHarness(), pending=t.run(historicalSaved);
  t.requests[0].reject(new Error("Failed to fetch")); await pending;
  assert.equal(t.notices[0].title,"Saved section unavailable");
  assert.match(t.notices[0].message,/Connect to the internet/);
  assert.match(t.notices[0].message,/download the code library in Account/);
  assert.equal(t.opened.length,0);
  assert.equal(Object.keys(t.details).length,0); assert.equal(Object.keys(t.anchors).length,0);
  assert.equal(Object.keys(t.state.paneWeights).length,0); assert.equal(t.state.paneOrder.length,0);
  assert.equal(t.state.utilityInstances.length,1); assert.equal(t.state.utilityInstances[0].id,"unrelated");
  const retry=t.run(historicalSaved); t.requests[1].resolve(); await retry;
  assert.equal(t.opened[0].sectionID,historicalSaved.sectionID);
  assert.equal(t.opened[0].codeVersion,"2014"); assert.equal(t.opened[0].title,"Slope");
  assert.equal(t.requests[1].options.anchorPaneID,"saved");
}
{
  const t=savedHarness({online:true}), pending=t.run(historicalSaved);
  t.requests[0].reject(new Error("503")); await pending;
  assert.match(t.notices[0].message,/saved item has not been removed/);
}
for(const outcome of ["resolve","reject"]) {
  const t=savedHarness(), pending=t.run(historicalSaved);
  t.switchAccount(); t.requests[0][outcome](new Error("Old account result")); await pending;
  assert.equal(t.notices.length,0); assert.equal(t.opened.length,0); assert.equal(t.saves,0);
  assert.ok(t.details["attempt-1"],"late results cannot clean up the next account's state");
}
{
  const t=savedHarness(), pending=t.run(historicalSaved);
  delete t.details["attempt-1"];
  t.requests[0].reject(new Error("Closed citation request")); await pending;
  assert.equal(t.notices.length,0); assert.equal(t.saves,0);
}
console.log("Reader recovery passed: find preservation/retry, visible saved-citation failure, exact-source reopening, and stale-account suppression.");
