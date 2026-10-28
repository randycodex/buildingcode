import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createReaderShortcuts, readerShortcutLabel} from '../public/reader-shortcuts.js';
import {documentFixture} from './helpers/workflow-dom.mjs';

for (const [prefix,edition,expected] of [
  ['BC','2022','BC’22'],['BC','2014','BC’14'],['PC','2022','PC’22'],
  ['FGC','2022','FGC’22'],['ECC','2025','ECC’25'],['BC68','1968','BC’68'],
  ['ZR','Current','ZR · Current'],['T28','','T28 · Current'],['Custom','Archive','Custom · Archive']
]) assert.equal(readerShortcutLabel({prefix,edition}), expected);

const doc = documentFixture(), create = doc.createElement;
const observations = [], frames = [];
doc.defaultView = {innerWidth:390, requestAnimationFrame:fn=>frames.push(fn),
  MutationObserver:class {disconnect(){} observe(node, options){observations.push({node,options});}},
  addEventListener(){},removeEventListener(){}};
doc.createElement = tag => {
  const n = create(tag);
  n.style = {};
  n.removeAttribute = key => delete n.attributes[key];
  n.getAttribute = key => n.attributes[key] ?? null;
  n.getBoundingClientRect = () => ({left:350,bottom:50});
  n.offsetWidth = 300;
  n.insertBefore = (child, before) => {
    child.remove(); child.parentNode = n;
    n.children.splice(before ? n.children.indexOf(before) : n.children.length,0,child);
  };
  return n;
};
doc.body = doc.createElement('body');
doc.addEventListener = (...args) => doc.body.addEventListener(...args);
doc.removeEventListener = (...args) => doc.body.removeEventListener(...args);
const host=doc.createElement('div'), track=doc.createElement('section');doc.body.append(host,track);
const panels=['reader:a','reader:b'].map(id=>{const p=doc.createElement('article');p.dataset.paneId=id;p.className='workspace-panel reader-panel';p.append(doc.createElement('header'));track.append(p);return p;});
let items = panels.map((p,i)=>({id:p.dataset.paneId,prefix:'BC',edition:'2022',name:'Building Code (2022)',theme:'building',location:`Chapter ${i+1}: Location`}));
let context='project-A:research';const reveals=[];
const shortcuts=createReaderShortcuts({host,track,readers:()=>items,context:()=>context,reveal:id=>reveals.push(id)});
assert.deepEqual(host.children.map(n=>n.textContent),['BC’22','BC’22']);
assert.match(host.children[0].getAttribute('aria-label'),/Chapter 1.*Reader 1 of 2/);
assert.match(host.children[1].getAttribute('aria-label'),/Chapter 2.*Reader 2 of 2/);
const b=host.children[1];b.focus();b.dispatch('focus');
const tooltip=doc.body.querySelector('.reader-shortcut-tooltip');
assert.equal(tooltip.hidden,false);assert.match(tooltip.textContent,/Building Code \(2022\).*Chapter 2/);
assert.equal(tooltip.style.left,'82px','A tooltip stays within a narrow viewport.');
b.dispatch('click');assert.deepEqual(reveals,['reader:b']);assert.equal(b.getAttribute('aria-pressed'),'true');
let prevented=false;b.dispatch('pointerdown',{pointerType:'mouse',button:0,preventDefault(){prevented=true;}});assert.equal(prevented,true,'Mouse shortcuts preserve the Reader text selection.');
items.reverse();shortcuts.refresh();assert.equal(host.children[0],b);assert.equal(doc.activeElement,b,'Reordering keeps the same focused shortcut.');
items[0]={...items[0],prefix:'PC',theme:'plumbing'};shortcuts.refresh();assert.equal(b.textContent,'PC’22');assert.match(b.className,/plumbing/);
panels[0].dispatch('pointerdown',{bubbles:true});assert.equal(host.children[1].getAttribute('aria-pressed'),'true','Direct Reader interaction updates the active pill.');
context='project-B:research';items=[];shortcuts.refresh();assert.equal(host.hidden,true);assert.equal(host.children.length,0);assert.equal(tooltip.hidden,true);
items=[{id:'reader:c',prefix:'ZR',name:'Zoning Resolution',edition:'Current',theme:'zoning',location:'Article I'}];shortcuts.refresh();assert.equal(host.children[0].textContent,'ZR · Current');
assert.ok(observations.filter(o=>o.options.subtree).every(o=>o.node.tagName==='HEADER'),'Passage DOM is never observed.');
shortcuts.dispose();assert.equal(host.children.length,0);assert.equal(doc.body.querySelector('.reader-shortcut-tooltip'),null);

// Exercise the real app navigation against retained Reader state and animations.
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('async function revealReaderShortcut('), end=source.indexOf('\n}',start)+2;
let active='reader:exact', current=true, collapsed=true, groupCollapsed=true, reduced=false;
let finish;const finished=new Promise(resolve=>finish=resolve), calls=[];
const original={sectionID:'1012',internalSearchQuery:'slope',scrollTop:730,selection:'selected passage'};
let strip=true;
const panel={dataset:{paneId:'reader:exact'},classList:{contains:()=>strip},_collapseAnimation:{finished},reader:original};
const group={paneIDs:['reader:exact'],get collapsed(){return groupCollapsed;}};
const c=vm.createContext({Promise,CSS:{escape:x=>x},activeWorkspaceID:'A',currentColumnWorkflowView:()=> 'research',
  captureAccountRequest:()=>({}),isCurrentAccountRequest:()=>current,workflowPaneIsVisible:()=>true,
  readerShortcuts:{activePaneID:()=>active},track:{querySelector:()=>panel,querySelectorAll:()=>[panel]},
  columnGroupForPane:()=>group,columnGroupIsCollapsed:()=>groupCollapsed,
  setColumnGroupCollapsed(_group,value){calls.push('group');groupCollapsed=value;},
  paneIsCollapsed:()=>collapsed,setPaneCollapsed(_panel,value){calls.push('expand');collapsed=value;},
  columnExpansionController:()=>({reveal:n=>{assert.equal(n,panel);strip=false;calls.push('reveal');}}),
  window:{matchMedia:()=>({matches:reduced})},scrollPaneIntoView:(id,behavior)=>calls.push({id,behavior})});
vm.runInContext(`let readerShortcutNavigationGeneration=0;${source.slice(start,end)}`,c);
const opening=c.revealReaderShortcut('reader:exact');
assert.deepEqual(calls,['group','expand','reveal',{id:'reader:exact',behavior:'smooth'}]);
finish();await opening;
assert.deepEqual(calls.at(-1),{id:'reader:exact',behavior:'smooth'});
assert.deepEqual(original,{sectionID:'1012',internalSearchQuery:'slope',scrollTop:730,selection:'selected passage'},'Navigation leaves Reader state intact.');
reduced=true;calls.length=0;await c.revealReaderShortcut('reader:exact');assert.equal(calls.at(-1).behavior,'instant');
let finishStale;panel._collapseAnimation={finished:new Promise(resolve=>finishStale=resolve)};
calls.length=0;const stale=c.revealReaderShortcut('reader:exact');c.activeWorkspaceID='B';finishStale();await stale;
assert.equal(calls.filter(v=>typeof v==='object').length,1,'A completion from the previous Project cannot scroll the new Project.');
c.activeWorkspaceID='A';active='reader:other';calls.length=0;await c.revealReaderShortcut('reader:exact');assert.equal(calls.length,0,'A superseded shortcut cannot navigate.');
console.log('Reader shortcuts passed: editions/fallbacks, duplicates, exact instances, retained controls, direct activity, tooltip, project isolation, narrow tooltip, collapse/animation continuation and reduced motion.');

// Open menus can retain a group object from before column reconciliation.
const groupStart=source.indexOf('function setColumnGroupCollapsed('), groupEnd=source.indexOf('\n}',groupStart)+2;
const staleGroup={id:'group',paneIDs:[],collapsed:false}, liveGroup={...staleGroup};
const groupContext=vm.createContext({state:{columnGroups:[liveGroup]},columnGroupCanCollapse:()=>true,
  track:{querySelectorAll:()=>[]},activePinnedPaneID:()=>'',capturePaneScrollPositions:()=>[],
  refreshColumnGroupPresentation(){},saveWorkspaceState(){},notifyWorkspaceLayoutChange(){},
  window:{matchMedia:()=>({matches:true})}});
vm.runInContext(source.slice(groupStart,groupEnd),groupContext);
groupContext.setColumnGroupCollapsed(staleGroup,true);
assert.equal(liveGroup.collapsed,true,'Collapse updates the current group, even after reconciliation replaces a menu object.');
groupContext.setColumnGroupCollapsed(staleGroup,false);
assert.equal(liveGroup.collapsed,false);
console.log('Reader group navigation passed: current group identity survives menu reconciliation.');
