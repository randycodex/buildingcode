import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createWorkspaceViewPresentation} from '../public/workspace-view-presentation.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function browser(native=true) {
  const attributes=new Map(),transitions=[];
  const document={documentElement:{setAttribute:(key,value)=>attributes.set(key,value),removeAttribute:key=>attributes.delete(key)}};
  if(native)document.startViewTransition=update=>{
    const updated=deferred(),finished=deferred(),ready=deferred();
    const transition={updateCallbackDone:updated.promise,finished:finished.promise,ready:ready.promise,skipped:false,
      skipTransition(){this.skipped=true;ready.reject(Error('Superseded'));updated.promise.then(()=>finished.resolve(),()=>finished.reject(Error('Update failed')));},
      async start(){try{await update();updated.resolve();if(this.skipped)finished.resolve();else ready.resolve();}catch(error){updated.reject(error);ready.reject(error);finished.reject(error);}},
      finish:()=>finished.resolve()};
    transitions.push(transition);return transition;
  };
  return {document,attributes,transitions,presentation:createWorkspaceViewPresentation(document)};
}
{
  const b=browser(),ready=deferred();let visible='Research';
  const switching=b.presentation.present({isCurrent:()=>true,update:async()=>{await ready.promise;visible='Notebook';return true;}});
  assert.equal(visible,'Research');assert.equal(b.attributes.has('data-workflow-presenting'),true);
  const started=b.transitions[0].start();await tick();assert.equal(visible,'Research');
  ready.resolve();await started;assert.equal(visible,'Notebook');
  assert.equal(b.attributes.has('data-workflow-presenting'),true,'Keep no-fade styles through the final native presentation');
  b.transitions[0].finish();assert.equal(await switching,true);assert.equal(b.attributes.size,0);
}
{
  const b=browser(),updates=[];
  const first=b.presentation.present({isCurrent:()=>true,update:()=>updates.push('Notebook')});
  const last=b.presentation.present({isCurrent:()=>true,update:()=>{updates.push('Report');return true;}});
  assert.equal(b.transitions[0].skipped,true);
  await b.transitions[0].start();assert.equal(await first,false);assert.deepEqual(updates,[],'Do not run an obsolete capture callback');
  assert.equal(b.attributes.size,1,'An old completion must not clear the new transition styles');
  await b.transitions[1].start();b.transitions[1].finish();assert.equal(await last,true);assert.deepEqual(updates,['Report']);
}
{
  const b=browser(),ready=deferred();let oldOwns;
  const first=b.presentation.present({isCurrent:()=>true,update:async owns=>{await ready.promise;oldOwns=owns();return true;}});
  const started=b.transitions[0].start();await tick();
  const last=b.presentation.present({isCurrent:()=>true,update:()=>true});
  ready.resolve();await started;assert.equal(await first,false);assert.equal(oldOwns,false);
  assert.equal(b.attributes.size,1);await b.transitions[1].start();b.transitions[1].finish();await last;
}
{
  const b=browser(),ready=deferred();
  const first=b.presentation.present({isCurrent:()=>true,update:async()=>{await ready.promise;throw Error('Obsolete failure');}});
  const started=b.transitions[0].start();await tick();
  const last=b.presentation.present({isCurrent:()=>true,update:()=>true});
  ready.resolve();await started;assert.equal(await first,false,'A superseded failure must not show an error in the new view');
  assert.equal(b.attributes.size,1);await b.transitions[1].start();b.transitions[1].finish();await last;
}
for(const action of ['cancel','context changed','update failed']){
  const b=browser(),ready=deferred();let current=true;
  const switching=b.presentation.present({isCurrent:()=>current,update:async()=>{await ready.promise;return true;}});
  const checked=action==='update failed'?assert.rejects(switching,/Unavailable/):switching;
  const started=b.transitions[0].start();await tick();
  if(action==='cancel')b.presentation.cancel();
  if(action==='context changed')current=false;
  if(action==='update failed')ready.reject(Error('Unavailable'));else ready.resolve();
  await started;b.transitions[0].finish();const result=await checked;
  if(action!=='update failed')assert.equal(result,false,action);
  assert.equal(b.attributes.size,0,action);
}
{
  const b=browser(false);let calls=0;
  assert.equal(await b.presentation.present({isCurrent:()=>true,update:()=>{calls++;return true;}}),true);
  assert.equal(calls,1);assert.equal(b.attributes.size,0,'Older browsers still update normally and remove temporary styles');
  await assert.rejects(b.presentation.present({isCurrent:()=>true,update:()=>{throw Error('Unavailable');}}),/Unavailable/);
  assert.equal(b.attributes.size,0);
}

// Exercise the real top-menu handoff with delayed editor/source hydration.
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=app.indexOf('async function presentWorkingView(');
const implementation=app.slice(start,app.indexOf('\n}',start)+2);
for(const view of ['research','notebook','report']){
  const b=browser(false),ready=deferred(),calls=[];
  const c=vm.createContext({workspaceViewPresentation:b.presentation,state:{workflowNavigationGeneration:4},
    workspacePrivatePresentationAllowed:()=>true,workspaceColumnsRequireProject:()=>false,workspaceProject:()=>({id:'p'}),
    captureAccountRequest:()=>1,isCurrentAccountRequest:()=>true,activeWorkspaceID:'w',currentColumnWorkflowView:()=>view,
    projectDetailKey:p=>p.id,reportDraftMounts:new Map([['p',{whenPresented:()=>{calls.push('sources');return ready.promise;}}]]),
    track:{querySelectorAll:()=>[{dataset:{paneId:'editor'}}]},workflowPaneIsVisible:()=>true,
    whenWorkspacePaneReady:()=>{calls.push('editor');return ready.promise;},syncWorkflowColumnPresentation:()=>calls.push('layout'),
    presentWorkspaceIssue:assert.fail});
  vm.runInContext(implementation,c);
  let completed=false;
  const switching=c.presentWorkingView(view,()=>true).then(result=>{completed=true;return result;});
  await tick();assert.equal(completed,false);assert.deepEqual(calls,[view==='report'?'sources':'editor']);
  assert.equal(c.state.workflowNavigationGeneration,5,'Invalidate previous navigation at the initial click');
  ready.resolve();assert.equal(await switching,true);assert.equal(calls.at(-1),'layout');
}
{
  const c=vm.createContext({workspacePrivatePresentationAllowed:()=>true,workspaceColumnsRequireProject:()=>true});
  vm.runInContext(implementation,c);
  assert.equal(await c.presentWorkingView('notebook',()=> 'chooser'),'chooser','Leave workspace choosers live and interactive');
}
const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
assert.match(css,/html\[data-workflow-presenting\]::view-transition-old\(root\) \{ display: none; \}/);
assert.match(css,/html\[data-workflow-presenting\]::view-transition-new\(root\) \{ mix-blend-mode: normal; \}/);
assert.match(app,/presentWorkingView\(button.dataset.workflowView,/);
assert.match(app,/presentWorkingView\('report', \(\) => openProjectReportDraft/);
console.log('Working-view presentation passed: ready editors/sources, one no-fade handoff, rapid latest selection, context cleanup, failure, chooser and browser fallback.');
