import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createReportSwitch, createReportSourcePreviews, retainReportChildren} from '../public/report-presentation.js';
import {navigateReportOutline} from '../public/report-outline.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve=yes; reject=no; }); return {promise, resolve, reject}; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let active={id:'outgoing', text:'Before'}, current=true, allowed=true, saves=0;
  const pending=new Map(), commits=[], errors=[];
  const switcher=createReportSwitch({
    read:()=>active, isCurrent:()=>current,
    preserve:async()=>{ saves++; return allowed; },
    prepare:id=>{ const wait=deferred(); pending.set(id,wait); return wait.promise; },
    commit:incoming=>{ active=incoming; commits.push(incoming); }, onError:error=>errors.push(error)
  });
  return {switcher,pending,commits,errors,get active(){return active;},get saves(){return saves;},
    set current(value){current=value;},set allowed(value){allowed=value;},set active(value){active=value;}};
}
{
  const f=fixture(), old=f.active, switching=f.switcher.select('next'); await tick();
  assert.equal(f.active,old,'Keep the outgoing document visible during preparation');
  old.text='Typed while loading';
  f.pending.get('next').resolve({id:'next'});
  assert.equal(await switching,true); assert.equal(f.saves,2,'Preserve edits again after preparation');
  assert.equal(old.text,'Typed while loading'); assert.equal(f.active.id,'next');
}
{
  const f=fixture(), first=f.switcher.select('first'); await tick();
  const last=f.switcher.select('last'); await tick();
  f.pending.get('last').resolve({id:'last'}); await last;
  f.pending.get('first').resolve({id:'first'}); assert.equal(await first,false);
  assert.deepEqual(f.commits,[{id:'last'}],'A late response cannot replace the latest selection');
}
for (const change of ['cancel','account/workspace/dispose/export','other draft','save declined','source failed']) {
  const f=fixture(), old=f.active, switching=f.switcher.select('next'); await tick();
  if(change==='cancel')f.switcher.cancel();
  if(change==='account/workspace/dispose/export')f.current=false;
  if(change==='other draft')f.active={id:'other'};
  if(change==='save declined')f.allowed=false;
  if(change==='source failed')f.pending.get('next').reject(Error('Source unavailable'));
  else f.pending.get('next').resolve({id:'next'});
  assert.equal(await switching,false,change); assert.equal(f.commits.length,0,change);
  assert.equal(f.errors.length,change==='source failed'?1:0,change);
  if(change!=='other draft')assert.equal(f.active,old,change);
}
{
  let calls=0, current=true;
  const response=deferred();
  const previews=createReportSourcePreviews({request:()=>{calls++; return response.promise;},isCurrent:()=>current});
  const block={kind:'notebookCard',sourceID:'note'}, source={version:1};
  const first=previews.load(block,source);
  assert.equal(previews.load(block,source),first,'Deduplicate concurrent source requests');
  response.resolve({items:[{document:{text:'Note body'}}]}); await first;
  assert.equal(calls,1); assert.ok(previews.get(block,source).items[0].document,'Prepared content is synchronously available');
  assert.equal(previews.get(block,{version:2}),undefined,'A changed source version cannot reuse old content');
  current=false; await assert.rejects(previews.load(block,{version:2}),/workspace has changed/);
  assert.equal(previews.get(block,{version:2}),undefined,'Discard results from a retired account/workspace');
}
{
  let calls=0;
  const previews=createReportSourcePreviews({request:async()=>{ if(++calls===1)throw Error('Offline'); return {preview:[]}; },isCurrent:()=>true});
  await assert.rejects(previews.load({kind:'evidence',sourceID:'e'},{}),/Offline/);
  await previews.load({kind:'evidence',sourceID:'e'},{}); assert.equal(calls,2,'Failed sources remain retryable');
}

// Exercise actual wiring, including a source mutation queued during a save.
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=app.indexOf('  const reportSwitch = createReportSwitch(');
const implementation=app.slice(start,app.indexOf('\n  function renderWorkspaceContent()',start));
{
  const queued=deferred(), sourceReady=deferred(); let saves=0;
  const c=vm.createContext({createReportSwitch,structuredClone,activeDraft:{id:'outgoing',blocks:[]},drafts:[{id:'incoming',blocks:[{kind:'notebookCard',sourceID:'note'}]}],
    sources:[{kind:'notebookCard',id:'note'}], sourceMutation:Promise.resolve(), sourceMutationDraft:null,
    disposed:false,generatingReport:false,deletingReport:false,dirty:true,requestIdentity:'a',requestWorkspaceID:'w',activeWorkspaceID:'w',
    isCurrentAccountRequest:()=>true,identity:{},crypto:{randomUUID:()=> 'editor'},reportEvidenceCoverage:()=>new Set(),
    sourcePreviews:{load:()=>sourceReady.promise},mountState:{confirmDiscardIfNeeded:async()=>{
      saves++;
      if(saves===1){c.sourceMutation=queued.promise;c.sourceMutationDraft=c.activeDraft;}
      return true;
    }},autosave:{reset(){}},clearStatus(){},renderWorkspaceContent(){},shell:{querySelector:()=>null},showStatusError:assert.fail});
  vm.runInContext(implementation+'\nglobalThis.select = reportSwitch.select;',c);
  const switching=c.select('incoming'); await tick(); assert.equal(c.activeDraft.id,'outgoing');
  queued.resolve(); await tick(); assert.equal(saves,2,'Settle a mutation queued during outgoing save');
  assert.equal(c.activeDraft.id,'outgoing','Keep outgoing report during source hydration');
  sourceReady.resolve({}); assert.equal(await switching,true); assert.equal(saves,3); assert.equal(c.activeDraft.id,'incoming');
}
{
  let reviewed=0;
  const c=vm.createContext({createReportSwitch,structuredClone,activeDraft:{id:'outgoing',blocks:[]},drafts:[{id:'incoming',blocks:[]}],sources:[],
    sourceMutation:Promise.reject(Error('Failed earlier source save')),disposed:false,generatingReport:false,deletingReport:false,
    requestIdentity:'a',requestWorkspaceID:'w',activeWorkspaceID:'w',isCurrentAccountRequest:()=>true,identity:{},
    crypto:{randomUUID:()=> 'editor'},reportEvidenceCoverage:()=>new Set(),mountState:{confirmDiscardIfNeeded:async()=>{reviewed++;return true;}},
    autosave:{reset(){}},clearStatus(){},renderWorkspaceContent(){},shell:{querySelector:()=>null},showStatusError:assert.fail});
  c.sourceMutationDraft=c.activeDraft;
  vm.runInContext(implementation+'\nglobalThis.select = reportSwitch.select;',c);
  assert.equal(await c.select('incoming'),true); assert.equal(reviewed,2,'A failed source queue cannot trap the user after saving/recovery approval');
}

// Retaining nested columns must never detach the document or PDF panes.
class Node {
  constructor(name){this.name=name;this.children=[];this.parent=null;this.removed=0;}
  remove(){this.removed++;if(this.parent)this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}
  insertBefore(child,before){child.remove();const index=before?this.children.indexOf(before):this.children.length;this.children.splice(index,0,child);child.parent=this;}
}
{
  const shell=new Node('shell'),columns=new Node('columns'),documents=new Node('documents'),doc=new Node('report'),pdf=new Node('pdf');
  retainReportChildren(documents,new Node('old outline'),new Node('old divider'),doc,pdf);
  retainReportChildren(columns,new Node('old sources'),documents);
  retainReportChildren(shell,new Node('old toolbar'),columns);
  const before=[columns.removed,documents.removed,doc.removed,pdf.removed];
  retainReportChildren(documents,new Node('outline'),new Node('divider'),doc,pdf);
  retainReportChildren(columns,new Node('sources'),documents);
  retainReportChildren(shell,new Node('toolbar'),columns);
  assert.deepEqual([columns.removed,documents.removed,doc.removed,pdf.removed],before,'Stable containers never leave the live DOM');
}
assert.match(app,/const documentBody = oldDocument \|\| document.createElement/);
assert.match(app,/const columns = oldColumns \|\| document.createElement/);
assert.match(app,/const documents = oldDocuments \|\| document.createElement/);
assert.match(app,/synchronousMount:true/);
{
  const waiting=deferred(); let navigation;
  const start=app.indexOf('    if (keepPosition && documentScroll) {');
  const implementation=app.slice(start,app.indexOf('\n    if (!oldDocument)',start));
  const c=vm.createContext({keepPosition:true,documentScroll:900,documentBody:{isConnected:true,scrollTop:0},
    presentation:1,reportPresentationGeneration:1,reportPresentationInteraction:0,disposed:false,requestIdentity:'a',
    isCurrentAccountRequest:()=>true,requestWorkspaceID:'w',activeWorkspaceID:'w',sourcePreviewRequests:new Map([['old',waiting.promise]]),
    navigateReportOutline:options=>{navigation=navigateReportOutline(options);return navigation;}});
  vm.runInContext(implementation,c);
  c.reportPresentationGeneration++;
  waiting.resolve(); await navigation;
  assert.equal(c.documentBody.scrollTop,0,'Late source layout from the previous report cannot jump the retained document');
}
console.log('Report switching passed: prepared sources, retained columns, latest selection, outgoing edits/source queue, failures and ownership fences.');
