import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the live list's wiring without creating or deleting user reports.
class Element {
  constructor() {this.dataset={};this.attributes={};this.events={};this.children=[];this.classes=new Set();this.hidden=false;this.scrollTop=0;}
  append(...nodes) {this.children.push(...nodes);}
  replaceChildren(...nodes) {this.children=[...nodes];}
  setAttribute(key,value) {this.attributes[key]=value;}
  addEventListener(type,handler) {this.events[type]=handler;}
  focus(options) {this.focusOptions=options;}
  get classList() {return {toggle:(key,on)=>on?this.classes.add(key):this.classes.delete(key),add:key=>this.classes.add(key),remove:key=>this.classes.delete(key)};}
}
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const titleStart=app.indexOf('function createReportRailTitle(');
const titleEnd=app.indexOf('\n}',titleStart);
const start=app.indexOf("    const reportsRail = document.createElement('aside');");
const end=app.indexOf('    const metadata = document.createElement(',start);
assert(titleStart>0&&titleEnd>titleStart&&start>0&&end>start);
const selections=[],preferences=[];
let resizes=0,cancels=0;
const current={id:'one',title:'First report'},other={id:'two',title:'Second report'};
const c=vm.createContext({document:{createElement:()=>new Element()},panel:{dataset:{}},
  activeDraft:current,drafts:[current,other],recoveredDrafts:[],reportLibraryScroll:{reports:0},
  titleButton:new Element(),titleEditor:new Element(),deleteButton:new Element(),refreshReportList:null,
  reportSectionExpanded:()=>true,persistReportSectionExpanded:(key,value)=>preferences.push([key,value]),
  expandableReportRails:()=>false,
  reportSwitch:{select:async id=>selections.push(id),cancel:()=>cancels++},
  transitionReportSidebars(){resizes++;c.list.paintReportsToggle();}});
vm.runInContext(`${app.slice(titleStart,titleEnd+2)}
  function build(){${app.slice(start,end)}
  return {rail:reportsRail,header:reportsHeader,actions:reportActions,options:reportOptions,toggle:reportsToggle,create:createNew,paintReportsToggle};}
  globalThis.list=build();`,c);
const {list}=c;
assert.equal(list.rail.attributes['aria-label'],'Project reports');
assert.equal(list.rail.children[0],list.header);
assert.equal(list.header.children.length,1,'Reports is the only control on the heading row.');
assert.equal(list.rail.children[1],list.actions);
assert.equal(list.actions.children[0],list.create);
assert.equal(list.actions.children[1],c.titleButton);
assert.equal(list.actions.children[2],c.deleteButton);
assert.equal(list.rail.children[2],c.titleEditor);
assert.equal(list.rail.children[3],list.options);
assert.equal(list.options.children.length,2);
assert.equal(list.options.children[0].attributes['aria-current'],'true');
list.options.children[0].events.click();assert.equal(cancels,1);
list.options.children[1].events.click();assert.deepEqual(selections,['two']);
list.create.events.click();assert.deepEqual(selections,['two','__new__']);
list.toggle.events.click();
assert.equal(c.panel.dataset.reportsHidden,'true');assert.equal(list.options.inert,true);
assert.equal(list.toggle.textContent,'Reports');
assert.equal(list.toggle.attributes['aria-expanded'],'false');
assert.equal(list.actions.inert,true);
assert.equal(c.titleEditor.inert,true);
assert.equal(list.header.hidden,false);
list.toggle.events.click();
assert.equal(c.panel.dataset.reportsHidden,'false');assert.equal(list.options.inert,false);
assert.equal(list.toggle.textContent,'Reports');
assert.equal(list.toggle.attributes['aria-expanded'],'true');
assert.equal(list.actions.inert,false);
assert.equal(resizes,2);assert.deepEqual(preferences,[['Reports column',false],['Reports column',true]]);
c.activeDraft={...current,title:'Renamed report'};c.refreshReportList();
assert.equal(list.options.children[0].textContent,'Renamed report');
assert.equal(list.options.children[0].attributes['aria-current'],'true');
c.activeDraft={title:'Untitled Report'};c.refreshReportList();
assert.equal(list.options.children.length,3,'A new unsaved document has a selected list row');
assert.equal(list.options.children[0].attributes['aria-current'],'true');
c.activeDraft={...c.activeDraft,id:'three'};c.drafts.unshift(c.activeDraft);c.refreshReportList();
assert.equal(list.options.children.length,3,'Autosave replaces the unsaved row without duplicating it');
console.log('Reports list passed: current document, switching, creation, renamed/autosaved rows, collapse, restore and project preference.');
