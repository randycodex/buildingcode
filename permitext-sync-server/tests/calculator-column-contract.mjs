import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {emptyWorkspaceLayout,normalizeWorkspaceLayout,captureWorkspaceLayout,applyWorkspaceLayout} from '../public/workspace-state.js';
import {occupantLoadSource} from '../public/occupant-load-calculation.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const section=html.match(/data-workflow-tools="research"[\s\S]*?<\/div>/)[0];
assert.deepEqual([...section.matchAll(/id="([^"]+)"/g)].map(m=>m[1]),['add-reader','toggle-search','toggle-analysis','toggle-calculator']);
assert.equal(emptyWorkspaceLayout().utilities.calculator,false);
const original=normalizeWorkspaceLayout({utilities:{calculator:true,analysis:true},paneOrder:['utility:analysis','utility:calculator'],paneWeights:{'utility:calculator':720},collapsedPaneIDs:['utility:calculator']});
const target={};applyWorkspaceLayout(target,captureWorkspaceLayout(original));
assert.equal(target.utilities.calculator,true);assert.equal(target.utilities.analysis,true);assert.equal(target.paneWeights['utility:calculator'],720);assert.deepEqual(target.collapsedPaneIDs,['utility:calculator']);
const separate={};applyWorkspaceLayout(separate,emptyWorkspaceLayout());assert.equal(separate.utilities.calculator,false,'New workspaces do not inherit another workspace’s Calculator.');
const actual=name=>{const start=app.indexOf(`function ${name}(`),end=app.indexOf('\n}',start);assert(start>=0&&end>start);return app.slice(start,end+2);};
const node=()=>({dataset:{},children:[],attributes:{},append(...children){this.children.push(...children);},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,v){this[k]=v;}});
let construction=0,sharedOptions,sharedSource,closed=0,collapsed=true,groupCollapsed=true,reveals=0,saves=0,transitions=0;
const sharedCard=node(),column=node();
const runtime=vm.createContext({state:{utilities:{calculator:false},paneOrder:['reader:1','utility:calculator'],paneWeights:{}},
 document:{createElement:node},circleXIconSVG:()=>'<svg/>',applyPaneWeight(){},
 renderOccupantLoadCalculation(source,options){sharedSource=source;sharedOptions=options;return sharedCard;},
 notifyProjectRequiredForColumn:()=>false,whenWorkspacePaneReady:async()=>true,
 toggleUtilityPane:async()=>{runtime.state.utilities.calculator=true;construction++;},
 track:{querySelector:()=>column},columnGroupForPane:()=>({collapsed:groupCollapsed}),setColumnGroupCollapsed(_g,v){groupCollapsed=v;},
 paneIsCollapsed:()=>collapsed,setPaneCollapsed(_p,v){collapsed=v;},scrollPaneIntoView(){reveals++;},
 saveWorkspaceState(){saves++;},transitionWorkspace:async()=>{transitions++;},focusUtility(){},
});
vm.runInContext([actual('closeCalculatorColumn').replace('function close','async function close'),actual('openCalculatorColumn').replace('function open','async function open'),actual('renderCalculatorColumn')].join('\n'),runtime);
const rendered=runtime.renderCalculatorColumn();
assert.equal(rendered.dataset.paneId,'utility:calculator');assert.equal(occupantLoadSource(sharedSource),true);assert.equal(sharedOptions.calculatorID,'utility:calculator');assert.equal(sharedCard.open,true,'The calculator opens directly, without a second disclosure click.');
assert.equal(rendered.children[0].children[0].textContent,'Calculator');
await runtime.openCalculatorColumn();await runtime.openCalculatorColumn();
assert.equal(construction,1,'Repeated toolbar clicks reveal one column rather than duplicating it.');assert.equal(reveals,2);assert.equal(collapsed,false);assert.equal(groupCollapsed,false);
await runtime.closeCalculatorColumn();await runtime.closeCalculatorColumn();
assert.equal(runtime.state.utilities.calculator,false);assert.equal(saves,1);assert.equal(transitions,1);assert.deepEqual([...runtime.state.paneOrder],['reader:1']);
assert(app.includes('"Calculator", renderCalculatorColumn, closeCalculatorColumn'),'Hydration and Close all columns share the same lifecycle.');
assert(app.includes("['utility:settings', 'utility:archive', 'utility:calculator'].includes(id)"),'Saved column groups retain the calculator identity.');
console.log('Calculator column: toolbar order, real shared calculator/source, one-column reveal/expand/close, workspace persistence and isolation passed. No providers.');
