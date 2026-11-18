import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {notebookColumnsLayout, notebookReferenceVisibility, paneBelongsToView} from '../public/workflow-views.js';
import {captureWorkspaceLayout, normalizeWorkspaceLayout} from '../public/workspace-state.js';

const both = {readerOpen:true,evidenceOpen:true,notesWidth:300,active:'reader'};
assert.deepEqual(notebookReferenceVisibility({...both,availableWidth:2035}), {readerOpen:true,evidenceOpen:true,compact:false});
assert.deepEqual(notebookReferenceVisibility({...both,availableWidth:2034}), {readerOpen:true,evidenceOpen:false,compact:true});
assert.deepEqual(notebookReferenceVisibility({...both,active:'evidence',availableWidth:1671}), {readerOpen:false,evidenceOpen:true,compact:true});
assert.equal(notebookReferenceVisibility({...both,notesWidth:35,availableWidth:1770}).compact,false);
assert.equal(notebookReferenceVisibility({...both,notesWidth:35,availableWidth:1769}).compact,true);
assert.equal(notebookReferenceVisibility({...both,readerWidth:900,evidenceWidth:450,availableWidth:2450}).compact,true,'Chosen reference widths determine the breakpoint.');
assert.deepEqual(notebookReferenceVisibility({...both,readerOpen:false,availableWidth:3054}), {readerOpen:false,evidenceOpen:true,compact:false},'Widening does not reopen a closed reference.');
for (const width of [1671,1920,3054]) {
 const columns=[{kind:'reader',preferredWidth:900},{kind:'notes'},{kind:'editor'}];
 const sizes=notebookColumnsLayout(columns,width,4);
 assert.equal(sizes.reduce((sum,value)=>sum+value,0)+4,width);
 assert.equal(sizes[1],300);assert.ok(sizes[2]>=800);
 assert.equal(columns[0].preferredWidth,900,'Fitting does not change the saved Reader preference.');
}
assert.deepEqual(notebookColumnsLayout([{kind:'evidence'},{kind:'notes'},{kind:'editor'}],1671,4),[300,300,1067]);
assert.deepEqual(notebookColumnsLayout([{kind:'reader',preferredWidth:630},{kind:'evidence'},{kind:'notes'},{kind:'editor'}],3054,5),[630,300,300,1819]);
assert.deepEqual(notebookColumnsLayout([{kind:'reader',collapsed:true},{kind:'notes',collapsed:true},{kind:'editor'}],1671,4),[48,80,1539]);
for (const kind of ['reader','evidence']) for (const width of [1671,1920,2288,3054]) for (const shared of [0,300,450,600]) {
 const reference={kind,preferredWidth:kind==='reader'?900:600};
 const expanded=notebookColumnsLayout([reference,{kind:'notes'},{kind:'editor'}],width,4,shared);
 const collapsed=notebookColumnsLayout([reference,{kind:'notes',collapsed:true},{kind:'editor'}],width,4,shared);
 assert.equal(collapsed[0],expanded[0],'Toggling Notes cannot redistribute its width into Reader or Evidence.');
 assert.equal(collapsed[2]-expanded[2],220,'Only the notepad receives the space released by Notes.');
}
assert.deepEqual(notebookColumnsLayout([{kind:'reader',preferredWidth:900},{kind:'notes',collapsed:true},{kind:'editor'}],1671,4),[567,80,1020]);

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function actual(name) {const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,name);
 return `${source.slice(start-6,start)==='async '?'async ':''}${source.slice(start,source.indexOf('\n}',start)+2)}`;}
const ids=['reader:one','utility:saved:one','project:notes-index:p','project:notebook:p'];
const state={paneWeights:Object.fromEntries(ids.map((id,index)=>[id,[630,600,480,2000][index]])),
 utilityInstances:[{id:'one',key:'saved'}],notebookReaderHidden:false,notebookEvidenceHidden:false,
 notebookReferenceActive:'reader',notebookReferenceWidth:300,notebookListHidden:false,workflowMembership:{[ids[0]]:['notebook']}};
const panels=ids.map(id=>{const classes=new Set();return {dataset:{paneId:id},style:{},draft:`retained ${id}`,
 classList:{contains:name=>classes.has(name),toggle(name,on){on?classes.add(name):classes.delete(name);}},querySelector:()=>null};});
const track={clientWidth:1671,scrollLeft:200,inert:false,dataset:{},querySelector:()=>null,
 querySelectorAll:()=>Array.from({length:panels.filter(p=>!p.classList.contains('is-workflow-hidden')).length+1},()=>({getBoundingClientRect:()=>({width:1})}))};
let view='notebook',saves=0;
const reader={id:'one'};
const context=vm.createContext({state,track,panels,notebookReferenceVisibility,notebookColumnsLayout,paneBelongsToView,
 notebookReferenceTransition:undefined,notebookReferenceTransitionController:()=>({begin(){}}),
 currentColumnWorkflowView:()=>view,paneIsCollapsed:id=>id.startsWith('project:notes-index:')&&state.notebookListHidden,
 workflowPaneAnchors:()=>({}),defaultPaneWidthForID:id=>id.startsWith('reader:')?630:300,
 getComputedStyle:()=>({paddingLeft:'1px',paddingRight:'1px',getPropertyValue:()=> '1px'}),
 scheduleWorkspaceStateSaveAfterPaint(){saves++;},saveWorkspaceState(){saves++;},applyPaneWeight(){},
 isProAccount:()=>true,notifyProjectRequiredForColumn:()=>false,paneIDForUtilityInstance:()=>ids[1],
 paneIDForReader:()=>ids[0],placeEvidenceBeforeNotebook(){},whenWorkspacePaneReady:async()=>false,
 scrollPaneIntoView(){},CSS:{escape:value=>value},rememberReaderTabPosition(){},workflowScrollStore:{capture(){}},
 appendPaneSequence(){for(const panel of panels){const id=panel.dataset.paneId;
  panel.classList.toggle('is-workflow-hidden',id===ids[0]?state.notebookReaderHidden:id===ids[1]?state.notebookEvidenceHidden:false);}
  context.syncNotebookColumnLayout(panels);},
 async transitionWorkspace(){context.appendPaneSequence();},focusUtility:()=>assert.fail('The retained Evidence instance must be reused.')});
state.readers=[reader];
vm.runInContext(['activateNotebookReference','reconcileNotebookReferences','syncNotebookColumnLayout',
 'toggleNotebookEvidence','focusUtility','setNotebookReaderHidden','closeUtilityInstance','minimumPaneWidthForID','maximumPaneWidthForID'].map(actual).join('\n'),context);
const widths=()=>panels.filter(p=>!p.classList.contains('is-workflow-hidden')).map(p=>parseFloat(p.style.flex.split(' ').at(-1)));
const fit=()=>context.syncNotebookColumnLayout(panels);
fit();
assert.equal(state.notebookEvidenceHidden,true);assert.equal(state.notebookReaderHidden,false);
assert.equal(state.paneWeights[ids[1]],300,'Old Evidence defaults migrate to 300px only once.');
assert.deepEqual(widths(),[300,300,1065]);
const readerGeometry=widths();
assert.equal(context.minimumPaneWidthForID(ids[0]),300,'A compact Reader can resize without snapping past the page boundary.');
assert.equal(context.minimumPaneWidthForID(ids[3]),800);
assert.equal(track.scrollLeft,0,'The Notebook no longer scrolls references underneath the notepad.');
await context.toggleNotebookEvidence();
assert.equal(state.notebookReaderHidden,true);assert.equal(state.notebookEvidenceHidden,false);
assert.deepEqual(widths(),readerGeometry,'Swapping changes neither Notes nor the notepad geometry.');
await context.toggleNotebookEvidence();
assert.equal(state.notebookReaderHidden,true);assert.equal(state.notebookEvidenceHidden,true);
assert.deepEqual(widths(),[300,1366]);
await context.setNotebookReaderHidden(reader,false);
assert.equal(state.notebookReaderHidden,false);assert.equal(state.notebookEvidenceHidden,true);
await context.setNotebookReaderHidden(reader,true);
assert.equal(state.notebookReaderHidden,true,'The second Reader click closes its column.');
track.clientWidth=3054;fit();
assert.equal(state.notebookReaderHidden,true);assert.equal(state.notebookEvidenceHidden,true,'Widening keeps both closed.');
await context.setNotebookReaderHidden(reader,false);await context.toggleNotebookEvidence();
assert.equal(state.notebookReaderHidden,false);assert.equal(state.notebookEvidenceHidden,false);
assert.deepEqual(widths(),[630,300,300,1817]);
state.paneWeights[ids[1]]=450;fit();assert.equal(widths()[1],450,'Later manual Evidence widths survive the migration.');
track.clientWidth=1671;fit();
assert.equal(state.notebookReaderHidden,true);assert.equal(state.notebookEvidenceHidden,false,'Shrinking keeps the last-used Evidence.');
state.notebookReferenceWidth=450;fit();const resizedGeometry=widths();
await context.setNotebookReaderHidden(reader,false);
assert.deepEqual(widths(),resizedGeometry,'A manually chosen shared width carries from Evidence to Reader.');
await context.toggleNotebookEvidence();
assert.deepEqual(widths(),resizedGeometry,'The return swap leaves the notepad at exactly the same width.');
await context.closeUtilityInstance(state.utilityInstances[0]);
assert.equal(state.notebookEvidenceHidden,true,'The Evidence close icon hides its retained column too.');
await context.focusUtility('saved');
assert.equal(state.notebookEvidenceHidden,false,'Explicit Evidence links reveal rather than toggle the open column.');
await context.focusUtility('saved');
assert.equal(state.notebookEvidenceHidden,false);
state.notebookListHidden=true;fit();assert.equal(widths()[1],80);
// This desk fits both references only when the collapsed list is mistakenly
// counted at its collapsed width. Its 300px expanded budget must keep the shared slot stable.
track.clientWidth=2288;state.paneWeights[ids[0]]=900;state.paneWeights[ids[1]]=600;
for (const kind of ['reader','evidence']) {
 state.notebookReferenceActive=kind;
 state.notebookReaderHidden=kind!=='reader';state.notebookEvidenceHidden=kind!=='evidence';
 state.notebookListHidden=false;context.appendPaneSequence();
 const expanded=widths();assert.equal(track.dataset.notebookReferenceMode,'shared');
 state.notebookListHidden=true;fit();const collapsed=widths();
 assert.equal(track.dataset.notebookReferenceMode,'shared','Collapsing Notes must not switch reference modes.');
 assert.equal(collapsed[0],expanded[0],'The live reference keeps its exact width.');
 assert.equal(collapsed[2]-expanded[2],220);
 assert.equal(context.minimumPaneWidthForID(ids[3]),1020,'Resizing a reference reserves space to reopen Notes.');
 if(kind==='reader') assert.equal(context.maximumPaneWidthForID(ids[0]),600);
 state.notebookListHidden=false;fit();assert.deepEqual(widths(),expanded,'Reopening Notes restores only the notepad geometry.');
}
state.notebookListHidden=true;fit();
assert.deepEqual(panels.map(p=>p.draft),ids.map(id=>`retained ${id}`));
assert.equal(state.utilityInstances.length,1);assert.equal(state.readers[0],reader,'Swapping keeps the Reader and its tabs.');
const restored=normalizeWorkspaceLayout(captureWorkspaceLayout(state));
assert.equal(restored.notebookEvidenceHidden,false);assert.equal(restored.notebookReaderHidden,true);
assert.equal(restored.notebookReferenceWidth,450);assert.equal(restored.notebookReferenceActive,'evidence');assert.equal(restored.notebookReferenceLayoutVersion,1);
view='research';fit();assert.equal(track.dataset.notebookColumnSizing,undefined);
assert.ok(panels.every(p=>!p.dataset.notebookSized));assert.ok(saves>0);
console.log('Notebook responsive references passed: exact breakpoints, both references on wide desks, compact swapping, second-click closing, retained content, 300px Evidence default, page width, resize and persisted state.');
