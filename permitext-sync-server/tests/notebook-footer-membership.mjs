import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const app = await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const renderStart = app.indexOf('      footerActions.append(researchButton, coordinateButton);');
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
  disposed:false,requestIdentity:{userID:'owner'},renderSequence:1,editorRenderSequence:1,
  loadNotebookModule:()=>moduleReady,footer,footerActions:element(),noteMenu:{titleAction},
  reportButton:element(),researchButton:{...element(),hidden:true},coordinateButton:{...element(),hidden:true},
  editorElement:element(),notebookReadOnly:false,
  replaceFocusedContent:(...content)=>mountedContent.splice(0,mountedContent.length,...content)
});
vm.runInContext('globalThis.render = async () => {' + render + '};',context);
const pendingRender = context.render();
assert.equal(mountedContent.length,0,'The writing surface waits for the lazy editor module');
releaseModule({});
await pendingRender;
assert.deepEqual(mountedContent,[context.editorElement],'Notes have no Report status or empty footer row');
assert.equal(titleAction.children[0],context.reportButton,'Add to Report is mounted in the title row beside Notes');
assert(!footer.children.flatMap(child=>child.children || []).includes(context.reportButton),'The footer does not keep a duplicate report action');
context.coordinateButton.hidden = false;
await context.render();
assert.deepEqual(mountedContent,[context.editorElement,footer],'Available coordination actions retain their footer');

assert(!app.includes('createNotebookQuestionsEditor'), 'The writing page has no question editor');
assert(!app.includes('openNotebookQuestions'), 'Reports and Notes do not expose question counts or warnings');
assert(app.includes('openQuestions: structuredClone(activeCard.openQuestions || [])'), 'Existing metadata stays in draft snapshots');
console.log('Notebook footer passed: no Report membership status, retained title and coordination actions, lazy editor mounting and metadata preservation.');
