import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createWorkspaceViewPresentation} from '../public/workspace-view-presentation.js';

const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=app.indexOf('async function switchWorkspace(');
const implementation=app.slice(start,app.indexOf('\n}',start)+2);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture() {
  const events=[],attributes=new Map(),gates=new Map(),editors=new Map(),snapshots=[];
  const document={documentElement:{setAttribute:(key,value)=>attributes.set(key,value),removeAttribute:key=>attributes.delete(key)}};
  const presentation=createWorkspaceViewPresentation(document);
  const c=vm.createContext({activeWorkspaceID:'a',state:{workflowNavigationGeneration:0,trackScrollLeft:0},accountCurrent:true,
    workspaceRegistry:{activeWorkspaceID:'a',workspaces:[{id:'a',projectID:'a',name:'A'},{id:'b',projectID:'b',name:'B'},{id:'c',projectID:'c',name:'C'}]},
    captureAccountRequest:()=>1,isCurrentAccountRequest:()=>c.accountCurrent,
    confirmWorkspaceTransition:async()=>{events.push('preserve:'+c.activeWorkspaceID);return true;},
    loadWorkspaceSnapshot:id=>({id,trackScrollLeft:id==='b'?130:250}),
    clearWorkspaceNotice(){},presentWorkspaceIssue:message=>events.push('error:'+message),
    saveWorkspaceState:()=>{snapshots.push(c.activeWorkspaceID);events.push('saved:'+c.activeWorkspaceID);},
    workspaceViewPresentation:{present:async options=>{events.push('capture');return presentation.present(options);}},
    closeSharedWorkspaceViews:()=>{assert.equal(c.state.workflowPresentationDeferred,true);events.push('close-report');c.state.workflowNavigationGeneration++;},
    projectDetailsScreen:{close:()=>{assert.equal(c.state.workflowPresentationDeferred,true);events.push('close-details');}},
    applyStoredWorkspaceLayout:(layout,options)=>{assert.equal(options.preservePresentation,true,'Runtime reset must not skip its own handoff');c.state.trackScrollLeft=layout.trackScrollLeft;events.push('layout:'+layout.id);},
    persistWorkspaceRegistry:()=>events.push('registry:'+c.activeWorkspaceID),
    renderWorkspaceTransitionState:()=>{assert.equal(attributes.has('data-workflow-presenting'),true);events.push('shells:'+c.activeWorkspaceID);},
    workspaceAccessGateForRender:()=>({ready:gates.get(c.activeWorkspaceID)?.promise || Promise.resolve(),allowed:true}),
    renderWorkspace:async()=>{events.push('render:'+c.activeWorkspaceID);},suppressReaderScrollRestore:false,
    workflowPaneIsVisible:id=>!id.startsWith('hidden'),
    whenWorkspacePaneReady:id=>{assert.ok(!id.startsWith('hidden'));events.push('wait:'+id);return editors.get(id)?.promise || Promise.resolve(true);},
    track:{scrollWidth:2000,clientWidth:1000,querySelectorAll:()=>[{dataset:{paneId:c.activeWorkspaceID}},{dataset:{paneId:'hidden:'+c.activeWorkspaceID}}],
      scrollTo:position=>{assert.equal(position.behavior,'instant');events.push('scroll:'+c.activeWorkspaceID+':'+position.left);},
      removeAttribute:()=>events.push('clear-busy:'+c.activeWorkspaceID)},
    renderWorkspaceTabs(){},focusActiveWorkspaceTab:()=>events.push('focus:'+c.activeWorkspaceID),
    renderProjectUpdateBadge:()=>events.push('badge:'+c.activeWorkspaceID),refreshOpenSettingsWorkspace:()=>events.push('settings:'+c.activeWorkspaceID)
  });
  vm.runInContext(implementation,c);
  return {c,events,gates,editors,attributes,snapshots,presentation};
}
{
  const f=fixture(),gate=deferred(),editor=deferred();f.gates.set('b',gate);f.editors.set('b',editor);
  let completed=false;
  const switching=f.c.switchWorkspace('b',{onSelected:()=>{assert.equal(f.attributes.size,0,'Tool handoffs run after presentation so dialogs stay interactive');f.events.push('selected');}})
    .then(result=>{completed=true;return result;});
  await tick();assert.equal(completed,false);assert.deepEqual(f.snapshots,['a']);
  assert.equal(f.events.includes('render:b'),false,'Do not construct private panes before the new Project gate settles');
  assert.equal(f.attributes.has('data-workflow-presenting'),true);
  gate.resolve();await tick();assert.equal(f.events.includes('render:b'),true);assert.equal(completed,false,'Keep the outgoing frame until visible panes are ready');
  assert.equal(f.events.some(event=>event.startsWith('scroll:')),false);
  editor.resolve(true);assert.equal(await switching,true);assert.equal(f.attributes.size,0);
  assert.ok(f.events.indexOf('saved:a')<f.events.indexOf('layout:b'));
  assert.ok(f.events.indexOf('close-report')<f.events.indexOf('layout:b'));
  assert.ok(f.events.indexOf('scroll:b:130')<f.events.indexOf('selected'));
  assert.equal(f.c.suppressReaderScrollRestore,false);
}
{
  const f=fixture(),confirmation=deferred();
  f.c.confirmWorkspaceTransition=()=>f.c.activeWorkspaceID==='a' && !f.events.includes('first-confirmation')
    ? (f.events.push('first-confirmation'),confirmation.promise) : Promise.resolve(true);
  const first=f.c.switchWorkspace('b');await tick();assert.equal(f.c.activeWorkspaceID,'a');
  assert.equal(await f.c.switchWorkspace('c'),true);confirmation.resolve(true);
  assert.equal(await first,false);assert.equal(f.c.activeWorkspaceID,'c');assert.equal(f.events.includes('layout:b'),false,'A late save confirmation cannot select an old request');
}
{
  const f=fixture(),editor=deferred();f.editors.set('b',editor);
  const first=f.c.switchWorkspace('b');await tick();
  assert.equal(await f.c.switchWorkspace('c'),true);const finished=[...f.events];
  editor.resolve(true);assert.equal(await first,false);assert.equal(f.c.activeWorkspaceID,'c');
  assert.deepEqual(f.events,finished,'A late prior Project cannot scroll, focus, clear status or repaint the current one');
}
for(const change of ['account','workspace','view']){
  const f=fixture(),gate=deferred();f.gates.set('b',gate);let selected=0;
  const switching=f.c.switchWorkspace('b',{onSelected:()=>selected++});await tick();
  if(change==='account')f.c.accountCurrent=false;
  if(change==='workspace')f.c.activeWorkspaceID='c';
  if(change==='view')f.c.state.workflowNavigationGeneration++;
  gate.resolve();assert.equal(await switching,false,change);assert.equal(selected,0,change);assert.equal(f.events.includes('render:b'),false,change);
}
for(const failure of ['cancel','corrupt','render']){
  const f=fixture();
  if(failure==='cancel')f.c.confirmWorkspaceTransition=async()=>false;
  if(failure==='corrupt')f.c.loadWorkspaceSnapshot=()=>null;
  if(failure==='render')f.c.renderWorkspace=async()=>{throw Error('Offline');};
  assert.equal(await f.c.switchWorkspace('b'),false,failure);
  assert.equal(f.attributes.size,0,failure);assert.equal(f.c.suppressReaderScrollRestore,false,failure);
  if(failure!=='render'){assert.equal(f.c.activeWorkspaceID,'a');assert.equal(f.events.includes('capture'),false);assert.equal(f.snapshots.length,0);}
  if(failure!=='cancel')assert.equal(f.events.filter(event=>event.startsWith('error:')).length,1);
}
{
  const f=fixture(),editor=deferred();f.editors.set('a',editor);
  let selected=0;const switching=f.c.switchWorkspace('a',{onSelected:()=>selected++});await tick();
  assert.equal(selected,0,'Reselecting a Project with a pending editor still waits for it');assert.equal(f.snapshots.length,0);
  editor.resolve(true);assert.equal(await switching,true);assert.equal(selected,1);assert.equal(f.events.includes('layout:a'),false,'Reselecting retains live drafts');
}
assert.ok(!implementation.includes('await waitForWorkspaceTransitionPaint()'),'Project switches must not paint temporary loading shells');
console.log('Project switching passed: saved outgoing work, held loading shells, access/editor readiness, deferred screen close, restored position, rapid latest selection, failures and account/view fences.');
