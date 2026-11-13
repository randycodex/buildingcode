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
assert.deepEqual(wide,[900,360,280,375]);
for(const missing of ['reader','evidence','notes']) {
 const visible=columns.filter(column=>column.kind!==missing),sizes=notebookColumnsLayout(visible,1920,4);
 assert.ok(Math.abs(sizes.reduce((sum,width)=>sum+width,0)+4-1920)<0.001);
 assert.ok(sizes[visible.findIndex(column=>column.kind==='editor')]>600,'Closing a reference column gives its space to the editor');
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
console.log('Notebook lifecycle passed: viewport fitting, freed editor space, retained panels/preferences and Research restoration.');
