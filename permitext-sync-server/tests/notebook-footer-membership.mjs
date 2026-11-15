import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const app = await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const renderStart = app.indexOf('      footerActions.append(coordinateButton);');
const render = app.slice(renderStart, app.indexOf('      let scrollCaptureReady = false;',renderStart));
assert.ok(renderStart > 0);
const mountedContent = [];
let releaseModule;
const moduleReady = new Promise(resolve => { releaseModule = resolve; });
const element = () => ({children:[],append(...children){this.children.push(...children);}});
const footer = element(), titleAction = element();
const context = vm.createContext({
  isCurrentAccountRequest:()=>true,activeCard:{id:'accepted-note'},focusedCardID:'accepted-note',
  reportMembershipIndicator:()=>{throw new Error('Notes must not mount a Report membership status');},
  disposed:false,prepared:null,requestIdentity:{userID:'owner'},renderSequence:1,editorRenderSequence:1,
  loadNotebookModule:()=>moduleReady,footer,footerActions:element(),noteMenu:{titleAction},
  coordinateButton:{...element(),hidden:true},
  editorElement:element(),notebookReadOnly:false,
  replaceFocusedContent:(...content)=>mountedContent.splice(0,mountedContent.length,...content)
});
vm.runInContext('globalThis.render = async () => {' + render + '};',context);
const pendingRender = context.render();
assert.equal(mountedContent.length,0,'The writing surface waits for the lazy editor module');
releaseModule({});
await pendingRender;
assert.deepEqual(mountedContent,[context.editorElement],'Notes have no Report status or empty footer row');
assert.equal(titleAction.children.length,0,'The title row has no secondary actions');
assert(!app.includes('reportButton.className = "notebook-add-to-report"'),'Notes do not mount Add to Report');
context.coordinateButton.hidden = false;
await context.render();
assert.deepEqual(mountedContent,[context.editorElement,footer],'Available coordination actions retain their footer');

assert(!app.includes('createNotebookQuestionsEditor'), 'The writing page has no question editor');
assert(!app.includes('openNotebookQuestions'), 'Reports and Notes do not expose question counts or warnings');
assert(!app.includes('notebookReportDocument'), 'New Report snapshots use the Note text without retired follow-up items');
assert(!app.includes('questionsEditable: true'), 'New writing checkpoints do not overwrite retired follow-up metadata');
assert(app.includes('openQuestions: structuredClone(activeCard.openQuestions || [])'), 'Existing metadata stays in draft snapshots');
console.log('Notebook footer passed: no Report membership status, retained title and coordination actions, lazy editor mounting and metadata preservation.');
