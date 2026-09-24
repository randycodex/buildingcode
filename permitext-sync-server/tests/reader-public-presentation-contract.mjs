import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function actual(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end + 2);
}
class Node {
  constructor(tag) { this.tagName=tag; this.className=""; this.dataset={}; this.children=[]; this.attrs={}; this.events={}; this.hidden=false; this.disabled=false; this.parentNode=null; this.style={setProperty(){}}; }
  get classList() {
    return { contains:name=>this.className.split(/\s+/).includes(name),
      add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(" ");},
      toggle:(name,value)=>{const list=new Set(this.className.split(/\s+/).filter(Boolean)); if(value)list.add(name);else list.delete(name);this.className=[...list].join(" ");} };
  }
  append(...nodes) { for(const node of nodes) { if(node.parentNode)node.parentNode.children=node.parentNode.children.filter(n=>n!==node);node.parentNode=this;this.children.push(node); } }
  matches(selector) {return selector.startsWith(".") && this.classList.contains(selector.slice(1));}
  querySelector(selector) {for(const node of this.children){if(node.matches(selector))return node;const nested=node.querySelector(selector);if(nested)return nested;}return null;}
  querySelectorAll(selector) { return this.children.flatMap(node=>[...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)]); }
  closest(selector) {return this.matches(selector)?this:this.parentNode?.closest(selector)||null;}
  setAttribute(name,value){this.attrs[name]=value;}
  addEventListener(name,fn){this.events[name]=fn;}
  async click(){await this.events.click?.();}
  get isConnected(){return Boolean(this.parentNode)||this.connected===true;}
}
const listeners=[]; let permitted=false, currentLabel="Private conversation", reads=0, writes=0, researchOptions;
const gate={get allowed(){return permitted;},subscribe(fn){listeners.push(fn);return()=>{};}};
const panel=new Node("article");panel.className="reader-panel workspace-panel";panel.__workspaceAccessGate=gate;panel.connected=true;
const reader={id:"reader",codePrefix:"BC",codeVersion:"2022",chapterID:"chapter",sectionID:"section"};
const section={id:"section",sectionNumber:"1",title:"Public heading",readerAliasSectionIDs:[],blocks:[{id:"paragraph",plainText:"Complete public enacted text"}]};
const target={sectionID:"section",codeVersion:"2022",blockID:"paragraph"};
const context=vm.createContext({
  document:{createElement:tag=>new Node(tag)}, window:{setTimeout:fn=>fn()},
  syncCodeVersion:value=>value, syncCodeVersionForPrefix:()=>"2022", markResearchSelectable(){},
  sectionDisplayTitle:(_number,title)=>title, annotatedBlocksForSection:value=>value.blocks,
  annotationTargetForSection:()=>({...target,blockID:""}), annotationTargetForBlock:()=>target,
  renderCodeBlock(block){const node=new Node("p");node.textContent=block.plainText;return node;},
  linkInlineCodeReferences(){},decorateReaderDefinitions(){},
  savedSectionRecord(){reads++;return {saved:true};},currentResearchConversationLabel(){reads++;return currentLabel;},
  bookmarkIconSVG:saved=>saved?"saved":"save", bookmarkActionLabel:saved=>saved?"Remove passage":"Save passage",
  researchActionIconSVG:()=>"research",checkActionIconSVG:()=>"check",
  readerPassagePayload:()=>target,persistSectionBookmark:async()=>{writes++;return true;},
  saveReaderPassage:async()=>{writes++;return true;},syncReaderNoteBookmarkButtons(){},
  selectReaderSectionForResearch:async(_section,options)=>{writes++;researchOptions=options;return false;},
  clear(host){host.children=[];}, readerSectionIdentityValues:()=>new Set(["section"]),
  readerProjectsForSection(){reads++;return [];},isSectionSaved(){reads++;return true;},readerSectionHasNote(){reads++;return false;}
});
vm.runInContext(["readerPrivateContentAllowed","renderReaderChapterSection","renderAnnotatedCodeBlock","renderInlineCommentBox","renderReaderSectionProjectContext"].map(actual).join("\n"),context);
const rendered=context.renderReaderChapterSection(panel,reader,section,new Map());panel.append(rendered);
const body=rendered.querySelector(".annotated-code-block").children[0];
const bookmark=rendered.querySelector(".reader-section-saved-marker");
const inline=rendered.querySelector(".inline-comment");const research=inline.querySelector(".inline-research-toggle");
assert.equal(reads,0,"Pending Reader construction must not read saved records or private Research labels.");
assert.equal(body.textContent,"Complete public enacted text");assert.equal(bookmark.hidden,true);assert.equal(research.hidden,true);
assert.equal(bookmark.parentNode,rendered.querySelector(".reader-section-heading-row"),"Whole-section extraction retains a real stable bookmark node.");
const host=new Node("div");panel.append(host);context.renderReaderSectionProjectContext(host,section,reader,panel);
assert.equal(reads,0,"Project context must not read Project membership, names or note presence while pending.");assert.equal(host.hidden,true);
await bookmark.click();await research.click();assert.equal(writes,0);

permitted=true;listeners.forEach(fn=>fn());
assert.equal(rendered.querySelector(".annotated-code-block").children[0],body,"Upgrade retains the exact enacted-text node.");
assert.equal(rendered.querySelector(".reader-section-saved-marker"),bookmark,"Upgrade retains the extracted bookmark node.");
assert.equal(bookmark.hidden,false);assert.equal(bookmark.disabled,false);assert.equal(bookmark.attrs["aria-label"],"Remove section from Saved");
assert.equal(research.hidden,false);assert.match(research.title,/Private conversation/);assert.equal(host.hidden,false);
assert.equal(body.textContent,"Complete public enacted text");
currentLabel="";await research.click();assert.equal(researchOptions.addToCurrent,false,"Research invocation resolves the current conversation rather than a captured verified label.");
const writesBefore=writes,readsBefore=reads;permitted=false;bookmark.disabled=false;research.disabled=false;
await bookmark.click();await research.click();assert.equal(writes,writesBefore,"Revoked gate blocks private mutations even if control is still enabled.");assert.equal(reads,readsBefore);

// Null gate retains existing explicit bookmark behavior without a new saved read.
const legacyReads=reads;const legacy=context.renderInlineCommentBox(section,reader,target,{showBookmark:true});
assert.equal(legacy.querySelector(".inline-bookmark-toggle").hidden,false);assert.equal(legacy.querySelector(".inline-bookmark-toggle").classList.contains("is-saved"),true);
assert.equal(reads,legacyReads+1,"Ungated control performs only its existing Research-label read.");
const readerSource=actual("renderReader");assert.ok(readerSource.indexOf("panel.__workspaceAccessGate = options.accessGate || null")<readerSource.indexOf("renderReaderTrust(panel, reader)"));
console.log("Reader public presentation passed: no pending saved/research/project reads, complete public text, extracted bookmark identity, in-place private upgrade, dynamic Research target and revoked mutation guard.");
