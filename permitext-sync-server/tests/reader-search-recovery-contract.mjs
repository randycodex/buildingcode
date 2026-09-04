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
console.log("Reader find recovery passed: empty-query preservation, stale-response suppression, visible fetch failure and zero-result recovery.");
