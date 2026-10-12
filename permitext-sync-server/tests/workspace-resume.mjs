import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {normalizeWorkspaceResume, readWorkspaceResume, writeWorkspaceResume, restoreWorkspaceResume,
  captureReportResume, restoreReportResumeScroll} from '../public/workspace-resume.js';

const values = new Map();
const storage = {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)};
const context = {userID:'owner', workspaceID:'workspace-one', projectID:'project-one'};
const report = {draftID:'older-draft', versionID:'frozen-version', flags:{libraryOpen:true, comparisonOpen:true},
  widths:{libraryWidth:640, pdfComparisonWidth:2400}, scrolls:{document:950, columns:480},
  comparisonScroll:{pdf:1300, versions:240}, outlineSections:[['heading-one',false]],
  title:'Private report text', token:'secret'};
assert.equal(writeWorkspaceResume(storage,'tab-one',context,{view:'report', workflowView:'notebook', report}),true);
const snapshot = readWorkspaceResume(storage,'tab-one',context);
assert.equal(snapshot.view,'report');
assert.equal(snapshot.report.draftID,'older-draft','Refresh retains the selected report rather than choosing the newest draft');
assert.equal(snapshot.report.versionID,'frozen-version');
assert.equal(snapshot.report.widths.pdfComparisonWidth,2400);
assert.equal(snapshot.report.scrolls.document,950);
assert.equal(snapshot.report.scrolls.columns,480);
assert.equal(snapshot.report.comparisonScroll.pdf,1300);
assert.deepEqual(snapshot.report.outlineSections,[['heading-one',false]]);
assert.ok(![...values.values()].join('').includes('Private report text'));
assert.ok(![...values.values()].join('').includes('secret'));
assert.equal(readWorkspaceResume(storage,'tab-two',context),null,'A different tab has its own last screen');
for (const changed of [{userID:'other'},{workspaceID:'other'},{projectID:'other'}]) {
  assert.equal(readWorkspaceResume(storage,'tab-one',{...context,...changed}),null,'Never resume a screen in another account, workspace or project');
}
assert.equal(normalizeWorkspaceResume({...context,view:'unknown'},context),null);
assert.equal(normalizeWorkspaceResume({...context,view:'report',report:{widths:{pdfComparisonWidth:Infinity}}},context).report.widths.pdfComparisonWidth,0);
assert.equal(readWorkspaceResume({getItem(){throw Error('Unavailable');}},'tab',context),null);
assert.equal(writeWorkspaceResume({setItem(){throw Error('Full');}},'tab',context,{view:'report'}),false);

const opened = [];
const adapters = {isCurrent:()=>true, waitForAccess:async()=>true,
  openWorkflow:view=>{opened.push(view);return true;},
  openReport:state=>{opened.push(['report',state.draftID,state.versionID]);return true;},
  openDetails:state=>{opened.push(['project-details',state.section]);return true;},
  openAccount:state=>{opened.push(['account',state.scroll]);return true;}};
assert.equal(await restoreWorkspaceResume(snapshot,adapters),true);
assert.deepEqual(opened.pop(),['report','older-draft','frozen-version']);
for (const view of ['research','notebook','project-details','account']) {
  const resume = normalizeWorkspaceResume({...context,view,details:{section:'facts'},account:{scroll:410}},context);
  assert.equal(await restoreWorkspaceResume(resume,adapters),true);
}
assert.deepEqual(opened,['research','notebook',['project-details','facts'],['account',410]]);
assert.equal(await restoreWorkspaceResume(snapshot,{...adapters,waitForAccess:async()=>false}),false,
  'Restoration must use existing private workspace access verification');
let current = true, finishAccess;
const delayed = restoreWorkspaceResume(snapshot,{...adapters,isCurrent:()=>current,
  waitForAccess:()=>new Promise(resolve=>{finishAccess=resolve;})});
current=false; finishAccess(true);
assert.equal(await delayed,false,'New navigation or an account change while access loads cancels automatic navigation');

const elements = {'.report-document':{scrollTop:950},'.report-document-columns':{scrollTop:0,scrollLeft:480}};
const panel = {dataset:{libraryOpen:'true'},querySelector:selector=>elements[selector]};
const captured = captureReportResume(panel,{draftID:'older-draft',versionID:'frozen-version',outlineSections:[]});
assert.equal(captured.scrolls.columns,480,'Capture the horizontal document viewport separately from vertical report scrolling');
elements['.report-document'].scrollTop=0; elements['.report-document-columns'].scrollLeft=0;
restoreReportResumeScroll(panel,normalizeWorkspaceResume({...context,view:'report',report:captured},context).report);
assert.equal(elements['.report-document'].scrollTop,950);
assert.equal(elements['.report-document-columns'].scrollLeft,480);

// Exercise the actual startup adapter while its Project is still hydrating.
const app = await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const declaration = name => {
  const start = app.indexOf(`function ${name}(`);
  const open = app.indexOf('{',start);
  let end=open+1,depth=1;
  for (;depth;end++) {if(app[end]==='{')depth++;else if(app[end]==='}')depth--;}
  return app.slice(app.lastIndexOf('\n',start)+1,end);
};
let hydratedProject=null, openedReport=null, restoredReport=null;
const gate={allowed:true,ready:Promise.resolve().then(()=>{hydratedProject={id:'project-one'};})};
const startup=vm.createContext({detachedProjectWindow:false,workspaceResumeReady:false,
  state:{account:{userID:'owner'},workflowNavigationGeneration:0},activeWorkspaceID:'workspace-one',tabWorkspaceKey:'tab-one',
  sessionStorage:storage,readWorkspaceResume,restoreWorkspaceResume,
  workspaceProject:()=>hydratedProject,projectDetailKey:project=>project?.id||'',
  captureAccountRequest:()=>({userID:'owner'}),isCurrentAccountRequest:()=>true,
  workspaceAccessGateForRender:()=>gate,
  openProjectReportDraft:async(project,options)=>{openedReport={project,options};return true;},
  reportScreen:{isOpen:()=>true},reportDraftMounts:new Map([['project-one',{restorePresentation:async report=>{restoredReport=report;}}]])});
vm.runInContext(`${declaration('workspaceResumeContext')}\n${declaration('restoreWorkspaceAfterRefresh')}`,startup);
await startup.restoreWorkspaceAfterRefresh();
assert.equal(openedReport.options.resume.draftID,'older-draft',
  'Startup reads the tab snapshot after access verification has supplied the Project identity');
assert.equal(restoredReport.scrolls.document,950);
assert.equal(startup.workspaceResumeReady,true);
console.log('Workspace resume passed: per-tab/account/project boundaries, selected drafts and PDFs, layout and scroll, all screens, access fences and storage failure.');
