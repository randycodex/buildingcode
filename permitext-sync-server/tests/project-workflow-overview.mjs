import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {documentFixture} from './helpers/workflow-dom.mjs';
import {normalizeProjectQuestions} from '../public/project-workflow.js';
const source = await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('function appendProjectOpenQuestions(');
const actual=source.slice(start,source.indexOf('\n}',start)+2);
const doc=documentFixture(), root=doc.createElement('section');
let project={id:'one',openQuestions:[{id:'q1',question:'Original question',answer:''}]},identity=1,fail=false;
const patches=[];
let release;
const c=vm.createContext({document:doc,crypto:webcrypto,normalizeProjectQuestions,activeWorkspaceID:'one',
  captureAccountRequest:()=>identity,isCurrentAccountRequest:id=>id===identity,
  projectDetailMatches:(a,b)=>a?.id===b?.id,workspaceProject:()=>project,
  async updateProjectFolder(_project,patch){patches.push(structuredClone(patch)); if(fail)throw Error('storage full'); await new Promise(resolve=>{release=resolve;}); project={...project,...patch}; return project;}
});
vm.runInContext(actual,c);
const editor=c.appendProjectOpenQuestions(root,project);
const inputs=()=>root.querySelectorAll('textarea');
assert.equal(inputs().length,2);
assert.equal(root.querySelector('ol').children.length,1);
inputs()[0].value='Updated question'; inputs()[0].dispatch('input');
inputs()[1].value='First answer'; inputs()[1].dispatch('input');
const saving=editor.flush(); assert.equal(patches.length,1);
inputs()[1].value='Answer edited during save'; inputs()[1].dispatch('input');
release(); await new Promise(resolve=>setImmediate(resolve));
assert.equal(patches.length,2); release(); await saving;
assert.equal(project.openQuestions[0].answer,'Answer edited during save');
fail=true;inputs()[0].value='Retain me';inputs()[0].dispatch('input');
await assert.rejects(editor.flush(),/storage full/);
assert.equal(inputs()[0].value,'Retain me');
assert.equal(root.querySelectorAll('button').find(n=>n.textContent==='Retry saving questions').hidden,false);
fail=false;const retry=editor.flush();release();await retry;
identity=2;inputs()[0].value='Wrong account';inputs()[0].dispatch('input');await editor.flush();
assert.equal(project.openQuestions[0].question,'Retain me');
assert.throws(()=>normalizeProjectQuestions([{id:'q',question:42,answer:''}]));
assert.throws(()=>normalizeProjectQuestions([{id:'q',question:'',answer:''},{id:'q',question:'',answer:''}]));

{
  const prior = {id:'one',name:'Project',openQuestions:[{id:'old-question'}],recordsChecklist:[{id:'old-record'}]};
  const writes = [];
  const state = {localProjects:[],syncOutbox:[]};
  const noop = () => {};
  const context = vm.createContext({
    state, hasCapability:()=>true, requirePrivateWorkspaceWritable:noop, captureAccountRequest:()=>1,
    projectRecordID:project=>project.id, projectDetailMatches:(a,b)=>a.id===b.id,
    visibleProjectRecords:projects=>projects, currentContentSummary:()=>({projects:[prior]}),
    folderType:()=> 'project', projectColor:()=> '#334455', syncCodeVersion:()=> 'nyc-2022',
    projectStructuredFacts:()=>[], normalizeRecordsChecklist:records=>records, normalizeProjectQuestions,
    activeAccount:()=>({userID:'owner'}), syncProjectWorkspaceURL:noop,
    openProjectDetails:()=>[], setOpenProjectDetails:noop, saveWorkspaceState:noop,
    refreshOpenProjectPaneTheme:noop, refreshOpenSettingsWorkspace:noop, refreshProjectURLCatalog:noop,
    requireCurrentAccountRequest:noop, isSessionAuthenticationError:()=>false, projectIdentity:project=>project,
    projectDetailKey:project=>project.id, visibleProjectArtifactIDs:()=>[],
    projectMutationForRecord:project=>({project:{...project}}),
    syncMutationRecordID:mutation=>`owner:project:${mutation.project.id}`,
    pushMutation:async mutation=>writes.push(mutation.project)
  });
  const start = source.indexOf('async function updateProjectFolder(');
  vm.runInContext(source.slice(start,source.indexOf('\n}',start)+2),context);
  await context.updateProjectFolder(prior,{description:'Changed context'});
  assert(!Object.hasOwn(writes[0],'openQuestions') && !Object.hasOwn(writes[0],'recordsChecklist'));

  const pendingQuestions = [{id:'pending-question',question:'Keep my offline edit.',answer:''}];
  state.syncOutbox = [
    {accountUserID:'other',recordID:'owner:project:one',mutation:{project:{openQuestions:[{id:'other-account'}]}}},
    {accountUserID:'owner',recordID:'owner:project:one',mutation:{project:{openQuestions:pendingQuestions}}}
  ];
  await context.updateProjectFolder(prior,{recordsChecklist:[]});
  assert.deepEqual(writes[1].openQuestions,pendingQuestions);
  assert.deepEqual(writes[1].recordsChecklist,[]);
  await context.updateProjectFolder(prior,{openQuestions:[]});
  assert.deepEqual(writes[2].openQuestions,[]);
  assert(!Object.hasOwn(writes[2],'recordsChecklist'));
}
console.log('Project questions: inline numbered pairs, queued edits, failure retention, retry and account guard passed.');
