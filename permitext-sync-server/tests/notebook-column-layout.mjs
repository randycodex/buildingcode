import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {notebookColumnsLayout} from '../public/workflow-views.js';
const columns=[{kind:'reader',preferredWidth:900},{kind:'evidence',preferredWidth:600},{kind:'notes',preferredWidth:480},{kind:'editor',preferredWidth:3000}];
for(const width of [1920]) {
 const fitted=notebookColumnsLayout(columns,width,5);
 assert.equal(fitted.length,4);assert.ok(fitted.every(value=>value>0));
 assert.ok(Math.abs(fitted.reduce((sum,value)=>sum+value,0)+5-width)<0.001,'Every column fits without horizontal overflow');
 if(width>=1920)assert.ok(fitted[3]>=360,'The editor receives the remaining writing space');
}
const wide=notebookColumnsLayout(columns,1920,5);
assert.ok(wide[2]>280,'Notes uses its requested width instead of the former 280px cap');
for(const missing of ['reader','evidence','notes']) {
 const visible=columns.filter(column=>column.kind!==missing),sizes=notebookColumnsLayout(visible,1920,4);
 assert.ok(Math.abs(sizes.reduce((sum,width)=>sum+width,0)+4-1920)<0.001);
 assert.ok(sizes[visible.findIndex(column=>column.kind==='editor')]>wide[3],'Closing a reference column gives its space to the editor');
}
assert.deepEqual(notebookColumnsLayout([{kind:'reader',collapsed:true},{kind:'editor'}],1920,3),[48,1869]);
assert.equal(columns[1].preferredWidth,600,'Fitting does not overwrite saved width preferences');
console.log('Notebook fitting passed: four visible columns, responsive widths, remaining editor space, hidden columns, collapsed rails and unchanged preferences.');

// Execute the actual fitting lifecycle without replacing any mounted editor or
// changing saved per-view preferences. Returning to Research restores its sizing.
{
 const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const start=source.indexOf('function syncNotebookColumnLayout('),end=source.indexOf('\n}',start)+2;
 const ids=['reader:one','utility:saved:one','project:notes-index:p','project:notebook:p'];
 const panels=ids.map(id=>({dataset:{paneId:id},style:{},hidden:false,classList:{contains(name){return name==='is-workflow-hidden'&&panels.find(p=>p.dataset.paneId===id).hidden;}}}));
 const state={paneWeights:Object.fromEntries(ids.map((id,index)=>[id,[900,600,480,2000][index]]))};
 const before=JSON.stringify(state);let view='notebook';
 const track={clientWidth:1920,scrollLeft:200,inert:false,dataset:{},querySelectorAll:()=>Array.from({length:3},()=>({getBoundingClientRect:()=>({width:1})}))};
 const context=vm.createContext({track,state,notebookColumnsLayout,currentColumnWorkflowView:()=>view,paneIsCollapsed:()=>false,
  getComputedStyle:()=>({paddingLeft:'1px',paddingRight:'1px'}),defaultPaneWidthForID:()=>600,
  applyPaneWeight(panel,id){panel.style.flex=`0 0 ${state.paneWeights[id]}px`;}});
 vm.runInContext(source.slice(start,end),context);context.syncNotebookColumnLayout(panels);
 assert.equal(track.dataset.notebookColumnSizing,'fit');assert.equal(track.scrollLeft,0);
 assert.ok(panels.every(panel=>panel.style.minWidth==='0'));assert.equal(JSON.stringify(state),before);
 const initialEditor=parseFloat(panels[3].style.flex.split(' ').at(-1));panels[2].hidden=true;context.syncNotebookColumnLayout(panels);
 assert.ok(parseFloat(panels[3].style.flex.split(' ').at(-1))>initialEditor);
 view='research';context.syncNotebookColumnLayout(panels);assert.equal(track.dataset.notebookColumnSizing,undefined);
 assert.ok(panels.every(panel=>!panel.dataset.notebookSized));assert.equal(panels[0].style.flex,'0 0 900px');assert.equal(JSON.stringify(state),before);
}
// With only Notes and the editor, the list can consume unused editor space
// until the existing 800px writing page and its 36px gutters remain.
{
 const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const actual=name=>{const start=source.indexOf(`function ${name}(`);return source.slice(start,source.indexOf('\n}',start)+2);};
 const ids=['project:notes-index:p','project:notebook:p'];
 const panels=ids.map(id=>({dataset:{paneId:id},style:{},classList:{contains:()=>false},querySelector:()=>null}));
 const state={paneWeights:{[ids[0]]:280,[ids[1]]:600}};
 const track={clientWidth:1920,scrollLeft:0,inert:false,dataset:{},querySelectorAll:()=>[{getBoundingClientRect:()=>({width:1})}]};
 const context=vm.createContext({track,state,notebookColumnsLayout,currentColumnWorkflowView:()=> 'notebook',paneIsCollapsed:()=>false,
  getComputedStyle:()=>({paddingLeft:'1px',paddingRight:'1px',getPropertyValue:()=> '800px'}),defaultPaneWidthForID:()=>600,applyPaneWeight(){}});
 vm.runInContext(['syncNotebookColumnLayout','minimumPaneWidthForID','maximumPaneWidthForID'].map(actual).join('\n'),context);
 context.syncNotebookColumnLayout(panels);
 assert.equal(context.maximumPaneWidthForID(ids[0]),1081);assert.equal(context.minimumPaneWidthForID(ids[1]),836);
 state.paneWeights[ids[0]]=1081;context.syncNotebookColumnLayout(panels);
 assert.equal(panels[0].style.flex,'0 0 1081px');assert.equal(panels[1].style.flex,'0 0 836px');
 assert.equal(context.maximumPaneWidthForID(ids[0]),1081,'The resize limit remains stable at the writing width');
 const restored=JSON.parse(JSON.stringify(state));state.paneWeights=restored.paneWeights;delete track._notebookColumnLayout;context.syncNotebookColumnLayout(panels);
 assert.equal(panels[0].style.flex,'0 0 1081px','A restored Notes width is not clamped to the former sidebar cap');
}
console.log('Notebook resize passed: expandable Notes, stable writing width, exact boundary and saved-width restoration.');
console.log('Notebook lifecycle passed: viewport fitting, freed editor space, retained panels/preferences and Research restoration.');
