import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { buildReaderChapterContents, readerContentsAncestorKeys } from "../public/reader-navigation-tree.js";

const [app, styles, html] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8")
]);

assert(html.includes('class="chapter-select"'), "Reader chapter trigger is missing.");
assert(html.includes('class="section-select"'), "Hidden Reader section select is missing.");
assert(app.includes("function renderReaderChapterNavigationMenu"), "Hierarchical chapter menu renderer is missing.");
assert(
  app.includes('setAttribute("role", "tree")') || app.includes('role="tree"'),
  "Chapter menu is not a tree."
);
assert(
  app.includes('setAttribute("role", "treeitem")') || app.includes('role="treeitem"'),
  "Chapter menu items are not treeitems."
);
assert(app.includes("ArrowRight"), "Chapter menu does not expand with ArrowRight.");
assert(app.includes("ArrowLeft"), "Chapter menu does not collapse with ArrowLeft.");
assert(app.includes("Escape"), "Chapter menu does not close on Escape.");
assert(app.includes("fetchChapter(node.chapterID, { signal: controller.signal })"), "Chapter expansion must use a cancellable chapter-summary request.");
assert(
  app.includes("menu._expandedNavigationIDs") && app.includes("expanded.delete(options.toggleID)"),
  "Closing and reopening the chapter menu must preserve its last disclosure state, including fully collapsed."
);
assert(app.includes("function readerNavigationSections"), "Chapter menu does not filter nested list-item catalog rows.");
assert(app.includes("isReaderNavigationSection"), "Chapter menu lacks a section-navigation predicate.");
assert(
  app.includes('label.addEventListener("click"') && app.includes("sectionID: node.sectionID") &&
    app.includes('chevron.addEventListener("click"') && app.includes("toggleID: node.key"),
  "Titles must navigate while independent chevrons expand without navigation."
);
assert(!app.includes("nested <option"), "Do not attempt nested native options.");
assert(app.includes("navigationChapterID"), "Reader does not preserve navigation chapter identity.");
assert(
  app.includes('group: "2014 Construction Codes (Historical)"') &&
    app.includes("historicalConstructionSyncCodeVersion"),
  "The web Reader does not expose the historical 2014 Construction Codes as a separate edition."
);
assert(
  app.includes("const params = new URLSearchParams({ code: prefix, version })") &&
    app.includes("readerCodeSelectionKey(reader)"),
  "Reader chapter requests and recents must distinguish the 2014 and 2022 editions that share code prefixes."
);
assert(styles.includes(".reader-nav-tree"), "Tree menu styles are missing.");
assert(styles.includes(".reader-nav-chapter"), "Chapter row styles are missing.");
assert(styles.includes(".reader-nav-section"), "Section row styles are missing.");
assert(styles.includes("aria-selected=\"true\""), "Selected-state styles are missing.");
assert(
  !/reader-nav-tree[^{]*\{[^}]*border:\s*1px solid/.test(styles),
  "Reader navigation tree should not rely on thin outline borders."
);

assert(styles.includes("margin: 0 0 2px 35px"), "Contents indentation should be half the former 70 pixels.");
assert(!styles.includes("padding-left: calc(var(--space-2) + 44px)"), "Legacy row padding must not compound at each level.");

const title = (number, text) => `${number} ${text || ""}`.trim();
const section = (id, number, groupID = "g") => ({ id, sectionNumber: number, title: "Heading.", groupID });
const chapter = { id: 1, chapterNumber: "1", groups: [{id: "g", headerLine: "SECTION BC 101", headingLine: "GENERAL"}] };
const entries = [section(1, "101.1"), section(2, "101.4"), section(3, "101.4.1"), section(4, "101.4.1.1"), section(5, "101.10"), section(6, "101.10.2")];
const original = JSON.stringify(entries);
const contents = buildReaderChapterContents(chapter, entries, title);
assert.equal(JSON.stringify(entries), original, "Building contents must not mutate source summaries.");
assert.equal(contents[0].title, "BC 101 General");
assert.equal(contents[0].sectionID, "1", "Group headings jump to their first real section.");
assert.deepEqual(contents[0].children.map(node => node.sectionID), ["1", "2", "5"]);
assert.equal(contents[0].children[1].children[0].children[0].sectionID, "4");
assert.equal(contents[0].children[2].children[0].sectionID, "6", "101.10 must not become a child of 101.1.");
assert.deepEqual(readerContentsAncestorKeys(contents, "4"), ["group:1:g", "section:1:2", "section:1:3"]);
assert.equal(readerContentsAncestorKeys(contents, "missing"), null);
const sparse = buildReaderChapterContents(chapter, [section(1, "101.4"), section(2, "101.4.2.1"), section(1, "101.4")], title);
assert.equal(sparse[0].children.length, 1, "Repeated IDs are shown once.");
assert.equal(sparse[0].children[0].children[0].sectionID, "2", "A missing intermediate heading uses its nearest existing parent.");
const isolated = buildReaderChapterContents({...chapter, groups: []}, [section(1, "101.4", "a"), section(2, "101.4.1", "b")], title);
assert.equal(isolated.length, 2, "Subsections cannot cross an authored group boundary.");
const actualRoot = buildReaderChapterContents(chapter, [section(1, "BC 101"), section(2, "101.1")], title);
assert.equal(actualRoot[0].kind, "section", "A real top-level section must not acquire a duplicate group heading.");
assert.equal(actualRoot[0].children[0].sectionID, "2");
const administrative = buildReaderChapterContents({id: 2, chapterNumber: "1", groups: [{id: "g", headerLine: "CHAPTER 1", headingLine: "ADMINISTRATION"}]},
  [section(1, "28-101.3"), section(2, "28-101.3.1"), section(3, "28-101.4")], title);
assert.equal(administrative.length, 2, "A Chapter heading must not repeat inside the same chapter.");
assert.equal(administrative[0].children[0].sectionID, "2");
const parenthesized = buildReaderChapterContents({id: 3}, [section(1, "23-12"), section(2, "23-12(a)"), section(3, "23-12(a)(1)")], title);
assert.equal(parenthesized[0].children[0].children[0].sectionID, "3");
assert.deepEqual(buildReaderChapterContents(chapter, [], title), []);

function actual(name) {
  const start = app.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert(start >= 0);
  return app.slice(start, app.indexOf("\n}", start) + 2);
}
let keyboard, selected = [], toggled = [], closed = 0, adjacent = 0, triggerFocused = 0;
const parent = {id:"parent",dataset:{navKey:"group:1:g",chapterId:"1",sectionId:"1"},tabIndex:-1,
  getAttribute:()=>"true",hasAttribute:()=>true,focus(){},querySelector:()=>leaf,parentElement:null};
const leaf = {id:"leaf",dataset:{navKey:"section:1:2",chapterId:"1",sectionId:"2"},tabIndex:-1,
  getAttribute:()=>null,hasAttribute:()=>false,focus(){},parentElement:{closest:()=>parent}};
const tree = {querySelectorAll:()=>[parent,leaf],addEventListener(type,handler){if(type==="keydown")keyboard=handler;}};
const select = {closest:()=>({}),_customSelectTrigger:{focus(){triggerFocused++;}}};
const context = vm.createContext({document:{},readerForPanel:()=>({}),
  renderReaderChapterNavigationMenu:async(_menu,_select,options)=>toggled.push(options),
  selectReaderNavigation:async(_panel,_reader,selection)=>selected.push(selection),
  closeActiveCustomSelect:()=>closed++,focusAdjacentDocumentControl:()=>adjacent++});
vm.runInContext(actual("readerNavVisibleItems")+"\n"+actual("bindReaderNavigationKeyboard"),context);
context.bindReaderNavigationKeyboard({},select,tree);
const press = (key,item,chevron=false) => keyboard({key,shiftKey:false,preventDefault(){},stopPropagation(){},target:
  Object.assign(Object.create(item),{closest:selector=>selector==='[role="treeitem"]'?item:chevron?{}:null})});
press("Enter",leaf);
assert.equal(selected[0].sectionID,"2", "Enter on a leaf navigates to its exact section.");
press("Enter",parent);
assert.equal(selected[1].sectionID,"1", "Enter on an expandable title navigates rather than toggling.");
press("Enter",parent,true);
assert.equal(toggled[0].toggleID,"group:1:g", "Enter on the chevron toggles without navigation.");
assert.equal(selected.length,2);
press("ArrowLeft",parent);
assert.equal(toggled.length,2);
press("Escape",leaf); press("Tab",leaf);
assert.equal(closed,2); assert.equal(triggerFocused,1); assert.equal(adjacent,1);

// A closed, detached or context-changed menu may not publish a late projection.
for (const stale of ["closed", "account", "workspace", "reader", "detached"]) {
  let release, fetches=0;
  const menu={hidden:false,isConnected:true,scrollTop:0,querySelector:()=>null};
  const reader={codePrefix:"BC",codeVersion:"2022",chapterID:"1"};
  const panel={isConnected:true};
  const c=vm.createContext({crypto:{randomUUID:()=>"attempt"},AbortController,
    captureAccountRequest:()=>"account",isCurrentAccountRequest:()=>c.accountCurrent,
    activeWorkspaceID:"workspace",accountCurrent:true,readerForPanel:()=>reader,
    workspaceReaderContentIdentity:r=>r.chapterID,codeOptionFor:()=>({}),
    activeCodeSourcesController:{isCurrent:()=>true},
    enabledReaderBrowseProjection:()=>new Promise(resolve=>{release=resolve;}),
    fetchChapter:()=>{fetches++;}});
  vm.runInContext(actual("renderReaderChapterNavigationMenu"),c);
  const opening=c.renderReaderChapterNavigationMenu(menu,{closest:()=>panel});
  if(stale==="closed")menu.hidden=true;
  if(stale==="account")c.accountCurrent=false;
  if(stale==="workspace")c.activeWorkspaceID="another";
  if(stale==="reader")reader.chapterID="2";
  if(stale==="detached")panel.isConnected=false;
  release({token:{},codes:[{}]});await opening;
  assert.equal(fetches,0,`The ${stale} menu must not load or render chapters.`);
}

console.log("Reader contents passed: nested identities, group boundaries, missing headings, separate navigation/disclosure, keyboard control and stale-context rejection.");
