import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createWorkspacePaneHydrator } from '../public/workspace-pane-hydration.js';
import { createWorkspaceViewPresentation } from '../public/workspace-view-presentation.js';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const actual = name => {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert(start >= 0, name); return source.slice(start, source.indexOf('\n}', start) + 2);
};
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
function panel(tab, text) {
  const names = new Set(['workspace-panel','reader-panel']);
  const body = {textContent:text,inert:false,scrollTop:0,classList:{contains:()=>false}};
  const strip = {classList:{contains:name=>name==='reader-column-tabs'}};
  const header = {inert:false,classList:{contains:()=>false}};
  return {dataset:{paneId:'reader:one',readerId:'one',readerTabId:tab,readerDisplayedTabId:tab,workspacePaneIdentity:tab,workspacePaneAccessIdentity:'public'},
    children:[strip,header,body],body,header,isConnected:false,attrs:{},
    classList:{contains:name=>names.has(name),toggle(name,on){on?names.add(name):names.delete(name);}},
    setAttribute(name,value){this.attrs[name]=value;},querySelector:selector=>selector==='.reader-content'?body:selector==='.reader-column-tabs'?strip:null,
    removeAttribute(name){delete this.attrs[name];},
    querySelectorAll:()=>[],replaceWith(next){const parent=this.parentNode,index=parent.children.indexOf(this);assert(index>=0);parent.children[index]=next;next.parentNode=parent;next.isConnected=true;this.parentNode=null;this.isConnected=false;}};
}
function harness() {
  const original=panel('A','Complete outgoing enacted text'), track={children:[original],scrollLeft:17,
    querySelectorAll(){return this.children;},querySelector(){return this.children[0];}};
  original.parentNode=track;original.isConnected=true;
  const reader={id:'one',activeTabID:'B'}, state={readers:[reader]}, pending=new Map(), signals=new Map(), notices=[], releases=[], restores=[];
  let wanted='B', generation=1, stopCount=0, sourceNavigation=null;
  const reveals=[];
  const c=vm.createContext({state,track,CSS:{escape:value=>value},workspacePaneHydrator:null,createWorkspacePaneHydrator,
    workspacePaneReadyWaiters:new Set(),activeWorkspaceID:'workspace',captureAccountRequest:()=>1,isCurrentAccountRequest:()=>true,
    workspacePaneContextIsCurrent:context=>context.generation===generation,pendingWorkspacePaneRevealID:'',
    workspacePaneDescriptors:()=>wanted?[{id:'reader:one',identity:wanted,publicContent:true,label:'Reader',sourceNavigation,scrollPosition:sourceNavigation?undefined:{top:425},
      load(signal){signals.set(wanted,signal);return pending.get(wanted).promise;}}]:[],
    paneIDForReader:reader=>`reader:${reader.id}`,hasCapability:()=>true,activePinnedPaneID:()=>'',workflowPaneIsVisible:()=>true,
    workspaceViewPresentation:{coversWorkspace:()=>true},
    applyPaneWeight(){},ensureWorkspacePanelAccessibleName(){},preparePaneCollapse(){},bindPaneDragging(){},
    refreshColumnGroupPresentation(){},updateCollapsedPaneDividers(){},refreshPinnedPaneDivider(){},
    bindReaderScrollIndicator(){},updateReaderScrollIndicator(){},enhanceSelect(){},notifyWorkspaceLayoutChange(){},
    cancelReaderPanelRequests(){stopCount++;},renderReaderTabs(pane,reader){pane.dataset.readerTabId=reader.activeTabID;},
    disposeUnpublishedWorkspacePane(pane){assert.equal(pane.isConnected,false);releases.push(pane);},
    restoreReaderScrollPositions(positions){restores.push(positions);track.children[0].body.scrollTop=positions.get('reader:one').top;},
    applyReaderScrollPosition(pane,position){restores.push(new Map([['reader:one',position]]));pane.body.scrollTop=position.top;},
    revealReaderSourceTarget(reader,item,_anchor,options){
      assert.equal(track.children[0].isConnected,true,'Source positioning runs after final column geometry is available.');
      assert.equal(options.immediate,true);reveals.push(item.sectionID);track.children[0].body.scrollTop=940;return true;
    },
    showWebNotice:async(...args)=>notices.push(args),
    appendPaneSequence(panes){
      for(const pane of track.children)if(!panes.includes(pane)){pane.isConnected=false;pane.parentNode=null;}
      track.children=panes;for(const pane of panes){pane.parentNode=track;pane.isConnected=true;}
      assert(panes.every(pane=>pane.body.textContent.length>0),'No intermediate blank or loading column may be mounted.');
    },
    createWorkspacePaneLoadingShell(){assert.fail('A tab switch must keep the existing Reader instead of a loading shell.');}
  });
  vm.runInContext(['retainReaderPaneForTabSwitch','finishWorkspacePaneReady','whenWorkspacePaneReady','getWorkspacePaneHydrator','mountWorkspacePanesIndependently'].map(actual).join('\n'),c);
  const open=async(tab,{refresh=true,source=false,retain=true}={})=>{
    wanted=tab;reader.activeTabID=tab;generation++;
    sourceNavigation=source?{reader,item:{sectionID:tab},options:{immediate:true},isCurrent:()=>wanted===tab}:null;
    pending.set(tab,pending.get(tab)||deferred());
    await c.mountWorkspacePanesIndependently({key:'account:workspace',generation},{shellReady:true,...(retain?{readerTabSwitchPaneID:'reader:one'}:{}),refreshPaneIDs:refresh?['reader:one']:[]});
    await Promise.resolve();
  };
  return {c,track,original,pending,signals,reader,notices,releases,restores,reveals,open,get stopCount(){return stopCount;},get sourceNavigation(){return sourceNavigation;}};
}
{
  const h=harness();await h.open('B',{source:true});
  assert.equal(h.track.children[0],h.original,'A result keeps the painted Reader while its passage loads.');
  const incoming=panel('B','Exact incoming result');incoming._readerSourceNavigation=h.sourceNavigation;
  await h.open('B',{refresh:false});
  let publishedPosition;const ready=h.c.whenWorkspacePaneReady('reader:one').then(()=>{publishedPosition=h.track.children[0].body.scrollTop;});
  h.pending.get('B').resolve(incoming);await h.c.workspacePaneHydrator.settled();await ready;
  assert.equal(publishedPosition,940,'The incoming result is aligned before readiness is published, without a later scroll jump.');
  assert.equal(h.restores.length,0,'Result navigation cannot restore the outgoing passage over the new result.');
  assert.deepEqual(h.reveals,['B']);assert.equal(h.track.scrollLeft,17);
}
{
  const h=harness();await h.open('B',{source:true});
  const incoming=panel('B','Obsolete result');incoming._readerSourceNavigation={isCurrent:()=>false};
  h.pending.get('B').resolve(incoming);await h.c.workspacePaneHydrator.settled();
  assert.equal(h.track.children[0],h.original,'A superseded result cannot flash while the next result is still resolving.');
  assert.deepEqual(h.reveals,[]);assert.deepEqual(h.releases,[incoming]);
}
{
  const h=harness();await h.open('B');
  assert.equal(h.track.children[0],h.original);assert.equal(h.original.body.textContent,'Complete outgoing enacted text');
  assert.equal(h.original.body.inert,true);assert.equal(h.original.header.inert,true);
  assert.equal(h.original.children[0].inert,undefined,'Code tabs remain available while the replacement loads.');
  assert.equal(h.original.dataset.readerDisplayedTabId,'A');assert.equal(h.original.dataset.readerTabId,'B');
  assert.equal(h.original.dataset.workspacePaneLoading,undefined,'Loading-shell CSS cannot hide the Reader header controls.');
  let ready=false;const waiter=h.c.whenWorkspacePaneReady('reader:one').then(value=>{ready=value;});
  await Promise.resolve();assert.equal(ready,false);
  await h.open('B',{refresh:false});assert.equal(h.stopCount,1,'Unrelated reconciliation retains the same outgoing surface and pending load.');
  h.pending.get('B').resolve(panel('B','Complete incoming enacted text'));await h.c.workspacePaneHydrator.settled();await waiter;
  assert.equal(ready,true);assert.equal(h.track.children[0].body.textContent,'Complete incoming enacted text');
  assert.equal(h.track.children[0].body.scrollTop,425,'The saved position restores in the same publication step.');
  assert.equal(h.track.scrollLeft,17);assert.deepEqual(h.releases,[h.original]);
}
{
  const h=harness();await h.open('B');await h.open('C');assert.equal(h.signals.get('B').aborted,true);
  h.pending.get('C').resolve(panel('C','Newest requested code'));await h.c.workspacePaneHydrator.settled();
  const newest=h.track.children[0];h.pending.get('B').resolve(panel('B','Obsolete code'));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.track.children[0],newest);assert.equal(newest.body.textContent,'Newest requested code');
  assert.equal(h.releases.length,2,'Both the replaced surface and obsolete detached completion are released.');
}
{
  const h=harness();await h.open('B');const ready=h.c.whenWorkspacePaneReady('reader:one');
  h.pending.get('B').reject(new Error('Network unavailable'));await h.c.workspacePaneHydrator.settled();
  assert.equal(await ready,false);assert.equal(h.track.children[0],h.original);
  assert.equal(h.original.body.textContent,'Complete outgoing enacted text');assert.equal(h.notices.length,1);
  await h.open('C');h.pending.get('C').resolve(panel('C','Recovered code'));await h.c.workspacePaneHydrator.settled();
  assert.equal(h.track.children[0].body.textContent,'Recovered code');
}
{
  const h=harness();let captures=0;
  Object.assign(h.c,{captureReaderScrollPositions(){captures++;return new Map([['reader:one',{sectionID:'A'}]]);}});
  vm.runInContext(actual('rememberReaderTabPosition'),h.c);
  h.c.rememberReaderTabPosition(h.reader);assert.equal(captures,0,'Outgoing text cannot overwrite the pending tab’s reading position.');
  h.reader.activeTabID='A';h.c.rememberReaderTabPosition(h.reader);assert.equal(captures,1);
}
{
  const h=harness();
  let chooseCode;
  Object.assign(h.c, {
    currentColumnWorkflowView:()=> 'research',
    canAddReaderTab:()=>true,
    openReaderCodePicker:(_anchor,choose)=>{chooseCode=choose;},
    rememberReaderTabPosition(){},retainReaderColumn(){},saveWorkspaceState(){},
    codeOptionVersion:code=>code.version,newReaderState:value=>value,
    addReaderTab(reader){reader.activeTabID='B';},
    transitionWorkspace:(_reason,options)=>h.open('B',{retain:options.readerTabSwitchPaneID==='reader:one'})
  });
  vm.runInContext(actual('openReaderTabPicker'),h.c);
  h.c.openReaderTabPicker(h.reader,{});
  await chooseCode({prefix:'PC',version:'2022'});
  assert.equal(h.track.children[0],h.original,'Adding an inner tab retains the painted Reader until its new code is ready');
  assert.equal(h.original.dataset.readerTabPending,'true');
  h.pending.get('B').resolve(panel('B','New tab enacted text'));
  await h.c.workspacePaneHydrator.settled();
  assert.equal(h.track.children[0].body.textContent,'New tab enacted text');
  assert.equal(h.track.scrollLeft,17,'Adding a tab preserves the horizontal workspace position');
}
function scopedBrowser(){
  const attributes=new Map(),transitions=[];
  const document={documentElement:{setAttribute:(key,value)=>attributes.set(key,value),removeAttribute:key=>attributes.delete(key)},
    startViewTransition(update){
      const done=deferred(),ready=deferred(),finished=deferred();
      const transition={updateCallbackDone:done.promise,ready:ready.promise,finished:finished.promise,
        async start(){try{await update();done.resolve();ready.resolve();finished.resolve();}catch(error){done.reject(error);ready.reject(error);finished.reject(error);}},
        skipTransition(){ready.reject(Error('Superseded'));done.promise.then(()=>finished.resolve(),()=>finished.resolve());}};
      transitions.push(transition);return transition;
    }};
  return {attributes,transitions,presentation:createWorkspaceViewPresentation(document)};
}
{
  const h=harness(),b=scopedBrowser();h.c.workspaceViewPresentation=b.presentation;
  let finalLayout=false;
  h.c.notifyWorkspaceLayoutChange=()=>{finalLayout=true;};
  const restore=h.c.applyReaderScrollPosition;
  let reserved=false;
  h.c.applyReaderScrollPosition=(pane,position)=>{
    assert.equal(finalLayout,true,'Measure the saved anchor after final column layout');
    assert.equal(reserved,true,'Reserve progressive chapter space before restoring and presenting the passage');
    restore(pane,position);
  };
  await h.open('B');
  assert.equal(b.transitions.length,0,'Network and content loading happen outside the visual transaction');
  assert.equal(b.attributes.size,0,'The rest of the workspace remains live throughout loading');
  let complete=false;const ready=h.c.whenWorkspacePaneReady('reader:one').then(value=>{complete=true;return value;});
  const incoming=panel('B','Complete incoming enacted text');incoming.body._readerPrepareSourceNavigation=()=>{reserved=true;};
  h.pending.get('B').resolve(incoming);await h.c.workspacePaneHydrator.settled();
  assert.equal(b.transitions.length,0,'A prepared Reader commits without native snapshots remeasuring virtual sections');
  assert.equal(await ready,true);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(complete,true);assert.equal(b.presentation.coversWorkspace(),false);
  assert.equal(h.track.children[0].body.scrollTop,425,'The final position is ready before the new Reader is presented');
  assert.equal(b.attributes.size,0);assert.equal(h.original.attrs['data-reader-tab-presenting'],undefined);
  assert.equal(h.track.children[0].attrs['data-reader-tab-presenting'],undefined);
}
{
  const h=harness(),b=scopedBrowser();h.c.workspaceViewPresentation=b.presentation;
  await h.open('B');await h.open('C');const ready=h.c.whenWorkspacePaneReady('reader:one');
  h.pending.get('C').resolve(panel('C','Latest complete code'));await h.c.workspacePaneHydrator.settled();
  assert.equal(await ready,true);const newest=h.track.children[0];
  const obsolete=panel('B','Obsolete code');h.pending.get('B').resolve(obsolete);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.track.children[0],newest,'A late source cannot replace the latest tab');assert.ok(h.releases.includes(obsolete));
  assert.equal(b.transitions.length,0);assert.equal(b.attributes.size,0);
}
for(const skip of ['another column','unavailable native transition']){
  const h=harness();h.c.workspaceViewPresentation={coversWorkspace:()=>false,present:()=>skip==='another column'?Promise.resolve(false):Promise.reject(Error('Skipped'))};
  await h.open('B');const ready=h.c.whenWorkspacePaneReady('reader:one');
  h.pending.get('B').resolve(panel('B','Ready code'));await h.c.workspacePaneHydrator.settled();assert.equal(await ready,true,skip);
  assert.equal(h.track.children[0].body.textContent,'Ready code','A visual cancellation must not strand an independent ready Reader');
}
{
  const h=harness(),b=scopedBrowser();let visible=true;h.c.workspaceViewPresentation=b.presentation;h.c.workflowPaneIsVisible=()=>visible;
  await h.open('B');visible=false;const ready=h.c.whenWorkspacePaneReady('reader:one');
  h.pending.get('B').resolve(panel('B','Ready hidden tab'));await h.c.workspacePaneHydrator.settled();assert.equal(await ready,true);
  assert.equal(b.transitions.length,0);
  assert.equal(h.track.children[0].classList.contains('is-workflow-hidden'),true,'Finishing a background tab cannot reveal its hidden workflow');
}
const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
assert.match(css,/html\[data-reader-tab-presenting\] \.reader-panel\[data-reader-tab-presenting\] \*/);
assert.doesNotMatch(css,/view-transition-name: reader-tab/);
{
  const cleared=[],content={__sectionAlignmentTimers:[11,22,33],querySelectorAll:()=>[],closest:()=>null};
  const c=vm.createContext({window:{clearTimeout:timer=>cleared.push(timer)},cancelReaderScrollRestore(){}});
  vm.runInContext(actual('stopReaderProgressiveHydration'),c);
  c.stopReaderProgressiveHydration(content);c.stopReaderProgressiveHydration(content);
  assert.deepEqual(cleared,[11,22,33],'Outgoing passage alignment cannot scroll a retained Reader after another tab is selected');
  assert.equal(content.__sectionAlignmentTimers.length,0);
}
console.log('Reader tab publication passed: retained painted content, atomic no-fade handoff, synchronous position restore, live neighboring tools, rapid-switch ownership, context fences, failure recovery and cleanup.');
