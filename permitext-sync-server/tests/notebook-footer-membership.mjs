import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {reportsContainingSource} from '../public/project-workflow.js';

const app = await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const functions = app.slice(app.indexOf('const reportMembershipRequests = new Map();'), app.indexOf('function reportAdditionFeedback('));
const renderStart = app.indexOf('      footerActions.append(reportButton, researchButton, coordinateButton);');
const render = app.slice(renderStart, app.indexOf('      let scrollCaptureReady = false;',renderStart));
assert.ok(renderStart > 0);
const hosts = [], frames = [];
let releaseModule;
const moduleReady = new Promise(resolve => { releaseModule = resolve; });
const element = () => ({dataset:{},children:[],classList:{toggle(){}},setAttribute(){},append(...children){this.children.push(...children);}});
const footer = element();
const stableNoteIdentity = {};
let savedReports = [];
const context = vm.createContext({
  reportsContainingSource, activeWorkspaceID:'workspace', hasCapability:()=>true,
  captureAccountRequest:()=>({userID:'owner'}),isCurrentAccountRequest:()=>true,
  reportDraftMounts:new Map(),
  track:{querySelectorAll:()=>hosts},
  postResearch:async()=>({drafts:savedReports,sources:[]}),
  document:{createElement:element},window:{requestAnimationFrame:callback=>frames.push(callback)},
  projectID:'project',activeCard:{id:'',identity:stableNoteIdentity},focusedCardID:'',focusedCardIdentity:stableNoteIdentity,
  notebookCardIdentity:card=>card.identity,refreshNotebookReportStatus:async()=>false,
  disposed:false,requestIdentity:{userID:'owner'},renderSequence:1,editorRenderSequence:1,
  loadNotebookModule:()=>moduleReady,footer,footerActions:element(),
  reportButton:element(),researchButton:element(),coordinateButton:element(),
  editorElement:element(),notebookReadOnly:false,
  replaceFocusedContent:()=>hosts.push(...footer.children.filter(child=>child.dataset?.reportMembershipProject))
});
vm.runInContext(functions + '\nglobalThis.render = async () => {' + render + '};',context);
await context.refreshProjectReportMembership('project'); // A parallel Evidence pane already populated the cache.
const pendingRender = context.render();
while(frames.length) frames.shift()(); // Browser frames continue during the lazy editor download.
assert.equal(hosts.length,0);
releaseModule({});
await pendingRender;
while(frames.length) frames.shift()();
assert.equal(hosts.length,1);
assert.equal(hosts[0].textContent,'Adding creates the first Report','Delayed editor load must not strand a new footer on Checking Report');
context.activeCard = {id:'accepted-note',identity:stableNoteIdentity};
await context.refreshNotebookReportStatus();
assert.equal(hosts[0].dataset.reportSourceId,'accepted-note','First save updates footer membership without remounting the editor');
savedReports = [{id:'report',title:'Working Report',blocks:[{kind:'notebookCard',sourceID:'accepted-note'}]}];
await context.refreshProjectReportMembership('project',true);
assert.equal(hosts[0].textContent,'In Report · Working Report');

const questionStart = app.indexOf('      footer.prepend(createNotebookQuestionsEditor({');
const questionEnd = app.indexOf('      if (!notebookReadOnly && !activeCard.id)',questionStart);
context.createNotebookQuestionsEditor = options => options;
let questions;
footer.prepend = options => { questions = options; };
let writes = 0;
context.markNotebookDirty = () => { writes++; };
context.renderCardList = () => {};
vm.runInContext(app.slice(questionStart,questionEnd),context);
questions.onChange([{id:'q',text:'Question after first save',status:'open'}]);
assert.equal(writes,1,'Questions remain editable after provisional Note receives its saved ID');
assert.equal(context.activeCard.openQuestions[0].text,'Question after first save');
context.activeCard = {id:'other-note',identity:{}};
assert.throws(()=>questions.onChange([]),/Reopen this Note/,'Old question handlers cannot mutate a different Note');
console.log('Notebook footer and questions passed: delayed editor mounting, first-save membership identity, continued question editing and stale-note fence.');
