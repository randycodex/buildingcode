import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createReaderShortcuts, readerShortcutLabel} from '../public/reader-shortcuts.js';
import {defaultSyncCodeVersion, historicalConstructionSyncCodeVersion, syncCodeVersion, syncCodeVersionForPrefix} from '../public/sync-identity.js';
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
  n.getBoundingClientRect = () => ({left:350,top:24,bottom:50,width:80,height:26});
  n.classList = {
    contains: name => n.className.split(/\s+/).includes(name),
    add(...names) { n.className = [...new Set([...n.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
    remove(...names) { n.className = n.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
    toggle(name, on) { on ? this.add(name) : this.remove(name); }
  };
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
const host=doc.createElement('div'), track=doc.createElement('section'), toolbar=doc.createElement('nav');
const layoutActions=doc.createElement('div');
layoutActions.className='workflow-layout-actions';
const layoutLabels=['Collapse all columns','Expand all columns','Restore default column sizes and order'];
const layoutButtons=layoutLabels.map(description=>{
  const button=doc.createElement('button');
  button.dataset.description=description;
  return button;
});
layoutActions.append(...layoutButtons);
toolbar.className='workflow-toolbar';toolbar.append(host);doc.body.append(toolbar,layoutActions,track);
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
toolbar.dispatch('scroll');assert.equal(tooltip.hidden,true,'Scrolling the toolbar clears the old tooltip position.');
b.dispatch('click');assert.deepEqual(reveals,['reader:b']);assert.equal(b.getAttribute('aria-pressed'),'true');
let prevented=false;b.dispatch('pointerdown',{pointerType:'mouse',button:0,preventDefault(){prevented=true;}});assert.equal(prevented,true,'Mouse shortcuts preserve the Reader text selection.');
items.reverse();shortcuts.refresh();assert.equal(host.children[0],b);assert.equal(doc.activeElement,b,'Reordering keeps the same focused shortcut.');
items[0]={...items[0],prefix:'PC',theme:'plumbing'};shortcuts.refresh();assert.equal(b.textContent,'PC’22');assert.match(b.className,/plumbing/);
panels[0].dispatch('pointerdown',{bubbles:true});assert.equal(host.children[1].getAttribute('aria-pressed'),'true','Direct Reader interaction updates the active pill.');
context='project-B:research';items=[];shortcuts.refresh();assert.equal(host.hidden,true);assert.equal(host.children.length,0);assert.equal(tooltip.hidden,true);
for (const [index,button] of layoutButtons.entries()) {
  button.disabled=true;
  button.dispatch('pointerenter');
  assert.equal(tooltip.hidden,false,'Layout tips stay available with no open columns.');
  assert.equal(tooltip.textContent,layoutLabels[index]);
  assert.equal(button.getAttribute('aria-describedby'),tooltip.id);
  button.dispatch('pointerleave');
  assert.equal(tooltip.hidden,true);
}
const resetLayout=layoutButtons.at(-1);
resetLayout.disabled=false;
resetLayout.focus();resetLayout.dispatch('focus');
assert.equal(tooltip.hidden,false);
doc.body.dispatch('keydown',{key:'Escape'});
assert.equal(tooltip.hidden,true);
assert.equal(resetLayout.getAttribute('aria-describedby'),null);
items=[{id:'reader:c',prefix:'ZR',name:'Zoning Resolution',edition:'Current',theme:'zoning',location:'Article I'}];shortcuts.refresh();assert.equal(host.children[0].textContent,'ZR · Current');
assert.ok(observations.filter(o=>o.options.subtree).every(o=>o.node.tagName==='HEADER'),'Passage DOM is never observed.');
shortcuts.dispose();assert.equal(host.children.length,0);assert.equal(doc.body.querySelector('.reader-shortcut-tooltip'),null);
assert.equal(resetLayout.handlers.pointerenter.length,0,'Disposal removes handlers from the retained layout buttons.');

const searchLauncher=doc.createElement('button'),savedLauncher=doc.createElement('button'),assistantLauncher=doc.createElement('button');
searchLauncher.textContent='Search';savedLauncher.textContent='Evidence';assistantLauncher.textContent='Assistant';
toolbar.append(searchLauncher,savedLauncher,assistantLauncher);
const tool=(id,label,toolKey)=>({id,label,name:label,toolKey,column:true});
const search=tool('utility:search:pair','Search','search');
const saved=tool('utility:saved:pair','Evidence','saved');
const assistant=tool('utility:analysis:pair','Assistant','analysis');
const paired=createReaderShortcuts({host,track,readers:()=>items,context:()=>context,reveal(){},
  tools:[{button:searchLauncher,key:'search'},{button:savedLauncher,key:'saved'},{button:assistantLauncher,key:'analysis'}]});
const visibleLabels=()=>toolbar.children.flatMap(node=>node===host?node.children:[node]).filter(node=>node.tagName==='BUTTON'&&!node.classList.contains('has-open-column')).map(node=>node.textContent);
for (const [open,expected] of [[[search,assistant],['Search','Evidence','Assistant']],[[saved,search,assistant],['Evidence','Search','Assistant']],[[assistant,saved],['Search','Assistant','Evidence']],[[],['Search','Evidence','Assistant']]]) {
  items=open;paired.refresh();
  assert.deepEqual(visibleLabels(),expected,'Open shortcuts follow column order and closed tools remain available');
}
paired.dispose();

// Exercise the real app navigation against retained Reader state and animations.
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('async function revealWorkspacePane('), end=source.indexOf('\n}',start)+2;
let active='reader:exact', current=true, collapsed=true, groupCollapsed=true;
let finish;const finished=new Promise(resolve=>finish=resolve), calls=[];
const original={sectionID:'1012',internalSearchQuery:'slope',scrollTop:730,selection:'selected passage'};
let strip=true;
const panel={dataset:{paneId:'reader:exact'},classList:{contains:()=>strip},_collapseAnimation:{finished},reader:original};
const group={paneIDs:['reader:exact'],get collapsed(){return groupCollapsed;}};
const c=vm.createContext({Promise,reportScreen:null,CSS:{escape:x=>x},activeWorkspaceID:'A',currentColumnWorkflowView:()=> 'research',
  captureAccountRequest:()=>({}),isCurrentAccountRequest:()=>current,workflowPaneIsVisible:()=>true,
  track:{querySelector:()=>panel,querySelectorAll:()=>[panel]},
  columnGroupForPane:()=>group,columnGroupIsCollapsed:()=>groupCollapsed,
  setColumnGroupCollapsed(_group,value){calls.push('group');groupCollapsed=value;},
  paneIsCollapsed:()=>collapsed,setPaneCollapsed(_panel,value){calls.push('expand');collapsed=value;},
  columnExpansionController:()=>({reveal:n=>{assert.equal(n,panel);strip=false;calls.push('reveal');}}),
  scrollPaneIntoView:(id, behavior, options)=>calls.push({id,behavior,includeCollapsedToRight:options?.includeCollapsedToRight})});
vm.runInContext(`let workspaceColumnNavigationGeneration=0;${source.slice(start,end)}`,c);
const revealShortcut = () => c.revealWorkspacePane('reader:exact', () => active === 'reader:exact');
const opening=revealShortcut();
assert.deepEqual(calls,['group','expand','reveal'],'Wait until the expanded width is available before scrolling.');
finish();await opening;
assert.deepEqual(calls,['group','expand','reveal',{id:'reader:exact',behavior:'smooth',includeCollapsedToRight:true}]);
assert.deepEqual(original,{sectionID:'1012',internalSearchQuery:'slope',scrollTop:730,selection:'selected passage'},'Navigation leaves Reader state intact.');
let finishStale;panel._collapseAnimation={finished:new Promise(resolve=>finishStale=resolve)};
calls.length=0;const stale=revealShortcut();c.activeWorkspaceID='B';finishStale();await stale;
assert.equal(calls.length,0,'A completion from the previous Project cannot scroll the new Project.');
c.activeWorkspaceID='A';
let finishRecollapse;
panel._collapseAnimation={finished:new Promise(resolve=>finishRecollapse=resolve)};
const reopening=revealShortcut();collapsed=true;finishRecollapse();await reopening;
assert.equal(calls.length,0,'Collapsing the column again cancels the queued scroll.');
c.activeWorkspaceID='A';active='reader:other';calls.length=0;await revealShortcut();assert.equal(calls.length,0,'A superseded shortcut cannot navigate.');
console.log('Reader shortcuts passed: editions/fallbacks, duplicates, exact instances, retained controls, direct activity, tooltip, project isolation, narrow tooltip and collapse/animation continuation.');

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

// The real column projection and move handler drive the same mounted columns
// and bubbles. Utility instances are independent, and drafts never remount.
const allHost=doc.createElement('div'), allTrack=doc.createElement('section');doc.body.append(allHost,allTrack);
allTrack.querySelectorAll=()=>allTrack.children;
const allIDs=['reader:a','utility:search:s','reader:b','utility:analysis:r','utility:calculator'];
const allPanels=allIDs.map(id=>{const node=doc.createElement('article');node.className='workspace-panel';node.dataset.paneId=id;allTrack.append(node);return node;});
const retainedDraft={text:'An unsent Assistant question',scrollTop:317};allPanels[3].draft=retainedDraft;
const toolButtons=['search','analysis','calculator'].map(key=>({key,button:doc.createElement('button')}));
const evidenceLauncher=doc.createElement('button');
const actualFunction=name=>{const first=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert(first>=0,name);return source.slice(first,source.indexOf('\n}',first)+2);};
let saves=0, allContext='A:research', previewOrder=[];
const allState={readers:[{id:'a',codePrefix:'BC',codeVersion:defaultSyncCodeVersion,title:'Reader'},{id:'b',codePrefix:'PC',codeVersion:historicalConstructionSyncCodeVersion,title:'Reader'}],paneOrder:[...allIDs]};
const appContext=vm.createContext({readerShortcutLabel,currentColumnWorkflowView:()=>allContext.endsWith(':notebook')?'notebook':'research',state:allState,track:allTrack,isProAccount:()=>true,workflowPaneIsVisible:()=>true,
  paneIDForReader:r=>`reader:${r.id}`,syncCodeVersion,syncCodeVersionForPrefix,defaultSyncCodeVersion,historicalConstructionSyncCodeVersion,
  readerTabs:()=>[{}],readerPositionLabel:r=>`Reader ${allState.readers.indexOf(r)+1}`,columnPaneLabel:()=> 'Evidence',
  activePaneIDs:()=>allState.paneOrder,activePinnedPaneID:()=>allState.pinnedPaneID || '',capturePaneResizeWidths(){},captureWorkspaceColumnMotion:()=>null,animateWorkspaceColumnMotion(){},paneGroupForMove:id=>[id],pinCriticalWorkflowPanesToLeft:ids=>ids,
  get dragPreviewOrder(){return previewOrder;},
  applyDragPreviewOrder(order){previewOrder=Array.from(order);allPanels.forEach(panel=>{panel.style.order=String(previewOrder.indexOf(panel.dataset.paneId));});},
  clearDragPreviewOrder(){previewOrder=[];allPanels.forEach(panel=>{panel.style.order='';});},
  saveWorkspaceState(){saves++;},appendPaneSequence(nodes){
    const byID=new Map(nodes.map(node=>[node.dataset.paneId,node]));
    for(const id of allState.paneOrder)allTrack.append(byID.get(id));
  }});
const codeOptionsSource=source.slice(source.indexOf('const codeOptions = ['),source.indexOf('function researchCodeEdition('));
vm.runInContext(codeOptionsSource+['codeOptionVersion','codeOptionFor','readerCodeOptionLabel','researchCodeEdition','isProjectNotebookPaneID','isProjectReportDraftPaneID','workspaceColumnRank','orderedWorkspaceColumnIDs','readerShortcutItems','orderWithPaneMoved','previewWorkspaceColumnShortcut','moveWorkspaceColumnShortcut','commitWorkspaceColumnOrder'].map(actualFunction).join('\n'),appContext);
const allReveals=[];
const navigation=createReaderShortcuts({host:allHost,track:allTrack,readers:()=>appContext.readerShortcutItems(),context:()=>allContext,
  reveal:id=>allReveals.push(id),columnOrder:()=>allState.paneOrder,move:(...args)=>appContext.moveWorkspaceColumnShortcut(...args),
  preview:(...args)=>appContext.previewWorkspaceColumnShortcut(...args),cancelPreview:()=>appContext.clearDragPreviewOrder(),renderIcon(button,name){
    button.querySelectorAll('svg').forEach(icon=>icon.remove());
    const icon=doc.createElement('svg');icon.dataset.lucideIcon=name;icon.setAttribute('aria-hidden','true');
    button.prepend(icon);button.classList.add('has-workspace-button-icon');
  },tools:[...toolButtons,{key:'saved',button:evidenceLauncher}]});
appContext.readerShortcuts=navigation;
const order=()=>allHost.children.map(button=>button.dataset.readerPaneId);
assert.deepEqual(order(),allIDs);
assert.deepEqual(allHost.children.map(button=>button.textContent),['BC’22','Search results','PC’14','Assistant','Calculator'],'Restored Readers show code editions without the internal source keys.');
assert.match(allHost.children[0].getAttribute('aria-label'),/Building Code \(2022\)/);
assert.match(allHost.children[2].getAttribute('aria-label'),/Plumbing Code \(2014\)/);
assert(toolButtons.every(({button})=>button.classList.contains('has-open-column')),'Open tools use bubbles instead of duplicate launchers.');
assert.deepEqual(allHost.children.map(button=>button.querySelector('svg')?.dataset.lucideIcon),['library-big','search','library-big','astroid','calculator'],'Open bubbles retain the existing Reader and tool icons.');
assert(allHost.children.every(button=>button.querySelector('svg').getAttribute('aria-hidden')==='true'),'Decorative icons keep the existing accessible labels.');
assert(allHost.children.every(button=>!button.draggable),'Top bubbles disable native drag images.');
const evidence=doc.createElement('article');evidence.className='workspace-panel';evidence.dataset.paneId='utility:saved:project';allTrack.append(evidence);
navigation.refresh();
const evidenceShortcut=allHost.children.find(button=>button.dataset.readerPaneId===evidence.dataset.paneId);
assert.equal(evidenceShortcut.textContent,'Evidence');
assert.equal(evidenceShortcut.querySelector('svg').dataset.lucideIcon,'bookmark');
assert.equal(evidenceLauncher.classList.contains('has-open-column'),true,'The open Evidence shortcut replaces its launcher.');
evidenceShortcut.dispatch('click');assert.equal(allReveals.pop(),evidence.dataset.paneId,'The toolbar reveals the existing Evidence column.');
evidence.remove();navigation.refresh();
assert.equal(evidenceLauncher.classList.contains('has-open-column'),false,'Closing Evidence restores its launcher.');
allHost.getBoundingClientRect=()=>({left:0,top:24,width:450,height:26,bottom:50});
for (const button of allHost.children) button.getBoundingClientRect=()=>{
  const visual=[...allHost.children].sort((a,b)=>Number(a.style.order || 0)-Number(b.style.order || 0));
  const translation=/translate3d\(([-.\d]+)px, ([-.\d]+)px/.exec(button.style.transform || '');
  return {left:visual.indexOf(button)*90+Number(translation?.[1] || 0),top:24+Number(translation?.[2] || 0),width:80,height:26,bottom:50};
};
const pointer=(clientX,pointerId=1)=>({pointerType:'mouse',button:0,pointerId,clientX,clientY:37,preventDefault(){}});
const moving=allHost.children[1], reader=allHost.children[0];
let selectionRestores=0;
const selectionRange={commonAncestorContainer:{isConnected:true}};
doc.getSelection=()=>({rangeCount:1,isCollapsed:false,anchorNode:allPanels[0],getRangeAt:()=>({cloneRange:()=>selectionRange}),
  removeAllRanges(){},addRange(range){assert.equal(range,selectionRange);selectionRestores++;}});
reader.dispatch('pointerdown',{pointerType:'mouse',button:0,preventDefault(){assert.fail('Click focus remains available before a drag.');}});
reader.dispatch('click',{detail:1});assert.equal(selectionRestores,1,'Bubble clicks preserve the selected passage before dragging.');
allPanels[1].dispatch('pointerdown',{bubbles:true});
assert.equal(navigation.activePaneID(),'utility:search:s');
assert.equal(navigation.activeReaderPaneID(),'reader:a','Using a tool retains the last Reader for normal source navigation.');
let nativePrevented=false;
moving.dispatch('dragstart',{preventDefault(){nativePrevented=true;}});assert(nativePrevented);
moving.dispatch('pointerdown',pointer(130));
doc.body.dispatch('pointermove',pointer(128));assert.deepEqual(previewOrder,[],'Small click jitter does not reorder.');
doc.body.dispatch('pointermove',pointer(12));
const searchFirst=['utility:search:s','reader:a','reader:b','utility:analysis:r','utility:calculator'];
assert.deepEqual(previewOrder,searchFirst,'An open Search can be dragged before the first Reader.');
assert.deepEqual([...allHost.children].sort((a,b)=>Number(a.style.order)-Number(b.style.order)).map(b=>b.dataset.readerPaneId),searchFirst,'Toolbar previews the same column movement.');
assert.deepEqual(allState.paneOrder,allIDs);assert.equal(saves,0);
assert.match(moving.style.transform,/translate3d\(-28px, 0px/);
doc.body.dispatch('pointerup',pointer(12));
assert.deepEqual(order(),searchFirst,'Toolbar follows the workspace order after the drop.');
assert.deepEqual(allTrack.children.map(node=>node.dataset.paneId),searchFirst);assert.equal(saves,1);
assert.deepEqual(previewOrder,[]);assert(allHost.children.every(button=>!button.style.order && !button.style.transform));
assert.equal(allPanels[3].draft,retainedDraft);assert.equal(retainedDraft.scrollTop,317);
moving.dispatch('click');assert.deepEqual(allReveals,['reader:a'],'Dropping does not trigger an extra navigation click.');
moving.dispatch('pointerdown',pointer(130));doc.body.dispatch('pointermove',pointer(410));
assert.ok(previewOrder.length);
doc.body.dispatch('keydown',{key:'Escape'});
assert.deepEqual(order(),searchFirst);assert.deepEqual(previewOrder,[]);assert.equal(saves,1);
moving.dispatch('pointerdown',{...pointer(130,2),pointerType:'touch'});
doc.body.dispatch('pointermove',pointer(410,2));
doc.body.dispatch('pointerup',pointer(410,3));assert(allHost.classList.contains('is-reordering'));
doc.body.dispatch('pointercancel',pointer(410,2));assert.deepEqual(previewOrder,[]);assert.equal(saves,1);
moving.dispatch('keydown',{altKey:true,shiftKey:true,key:'ArrowRight',preventDefault(){}});
assert.deepEqual(allTrack.children.map(node=>node.dataset.paneId),allIDs,'Keyboard movement follows the actual column order.');
assert.deepEqual(order(),allIDs);assert.equal(doc.activeElement,moving);assert.equal(saves,2);
assert(allHost.children.every(button=>button.querySelectorAll('svg').length===1 && button.classList.contains('has-workspace-button-icon')));
moving.dispatch('pointerdown',pointer(130));doc.body.dispatch('pointermove',pointer(410));allContext='B:research';
doc.body.dispatch('pointerup',pointer(410));assert.equal(saves,2);assert.deepEqual(previewOrder,[]);
moving.dispatch('keydown',{altKey:true,shiftKey:true,key:'ArrowRight',preventDefault(){}});
assert.equal(saves,2);
const duplicate=doc.createElement('article');duplicate.className='workspace-panel';duplicate.dataset.paneId='utility:search:second';allTrack.append(duplicate);
navigation.refresh();
assert.deepEqual(allHost.children.filter(button=>button.textContent.startsWith('Search')).map(button=>button.textContent),['Search results 1','Search results 2']);
allPanels[1].remove();duplicate.remove();navigation.refresh();
assert.equal(toolButtons[0].button.classList.contains('has-open-column'),false,'Closing the last Search restores its launcher.');
allContext='A:notebook';navigation.refresh();
assert.deepEqual(allHost.children,[],'Notebook reuses its Reader launcher instead of adding a duplicate bubble');
navigation.dispose();
console.log('Column bubbles passed: synchronized toolbar positions, open-tool styling, per-instance navigation, retained Reader targeting, live pointer/keyboard reordering, cancellation, no native ghost, intact drafts, stale-context guards and launcher restoration.');

{
  const workspace = doc.createElement('section');
  const toolbar = doc.createElement('nav');
  const host = doc.createElement('div');
  toolbar.append(host);
  doc.body.append(toolbar, workspace);
  const tools = ['saved', 'analysis', 'calculator', 'notes', 'report'].map(key => {
    const button = doc.createElement('button');
    button.textContent = key;
    toolbar.append(button);
    return {key, button};
  });
  const evidence = {id:'utility:saved:project', toolKey:'saved', label:'evidence', column:true};
  const reader = {id:'reader:evidence', ownerPaneID:evidence.id, label:'reader', column:true};
  const notes = {id:'project:notebook:project', toolKey:'notes', label:'notes', column:true};
  let items = [evidence, reader, notes];
  const shortcuts = createReaderShortcuts({host, track:workspace, readers:()=>items,
    context:()=> 'project:research', tools});
  const labels = buttons => buttons.map(button => button.textContent);
  assert.deepEqual(labels(host.children), ['evidence', 'reader', 'analysis', 'calculator', 'notes', 'report']);
  items = [evidence, notes, reader];
  shortcuts.previewOrder(items.map(item => item.id));
  assert.deepEqual(labels([...host.children].sort((a,b) => Number(a.style.order) - Number(b.style.order))),
    ['evidence', 'notes', 'reader', 'analysis', 'calculator', 'report']);
  shortcuts.previewOrder([]);
  shortcuts.refresh();
  assert.deepEqual(labels(host.children), ['evidence', 'notes', 'reader', 'analysis', 'calculator', 'report']);
  shortcuts.dispose();
}
