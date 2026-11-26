import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const start=source.indexOf('const readerSelectionResearchAction = document.createElement("button");');
const end=source.indexOf('\nfunction researchSelectionTextFromRange(',start);
assert(start>=0&&end>start);
const rect=(left,top,width=0,height=20)=>({left,top,width,height,right:left+width,bottom:top+height});
const frames=new Map(),documentEvents={},windowEvents={},menuCalls=[];
let frameID=0,selectionReads=0,focusRect=rect(400,400),selectionRects=[rect(300,400,100)];
const elements=[];
function createElement(tag) {
 const el={tag,hidden:false,style:{},offsetWidth:144,offsetHeight:44,events:{},children:[],
  addEventListener(name,fn){this.events[name]=fn;},setAttribute(){},
  contains(node){return this.children.includes(node);},append(...nodes){this.children.push(...nodes);}};
 elements.push(el);return el;
}
const panel={isConnected:true,querySelector:()=>({getBoundingClientRect:()=>({left:100,right:700,top:150,bottom:740})})};
const first={nodeType:3,parentElement:{closest:()=>panel}},last={nodeType:3,parentElement:{closest:()=>panel}};
let positionedFocus;
const range={startContainer:first,startOffset:0,endContainer:last,endOffset:20,
 getClientRects:()=>selectionRects,
 cloneRange:()=>({setStart(node,offset){positionedFocus={node,offset};},collapse(){},getBoundingClientRect:()=>focusRect})};
const selection={rangeCount:1,isCollapsed:false,focusNode:last,focusOffset:20,getRangeAt:()=>range};
const intent={passages:[{sectionID:'exact-section',selectedText:'Only the highlighted excerpt.'}]};
const context=vm.createContext({Node:{ELEMENT_NODE:1},
 document:{activeElement:null,createElement,body:{append(){}},addEventListener:(name,handler)=>{documentEvents[name]=handler;}},
 window:{innerWidth:1000,innerHeight:800,getSelection:()=>selection,addEventListener:(name,handler)=>{windowEvents[name]=handler;}},
 track:{addEventListener(){}},researchWorkspaceProjectID:()=>"p1",captureReaderEvidenceIntent:()=>selection.isCollapsed?null:intent,selectedReaderResearchPassages:()=>{selectionReads++;return selection.isCollapsed?null:intent;},
 openResearchDestinationMenu:(anchor,passages)=>menuCalls.push({anchor,passages}),
 requestAnimationFrame:handler=>{frames.set(++frameID,handler);return frameID;}});
vm.runInContext(source.slice(start,end),context);
const toolbar=elements.find(el=>el.tag==="div");
const button=elements.find(el=>el.textContent==="Add to Assistant");
const save=elements.find(el=>el.textContent==="Save to Evidence");
assert.deepEqual(toolbar.children,[save,button]);
const flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(handler=>handler());};
const refresh=()=>{documentEvents.selectionchange();flush();};
refresh();
assert.equal(button.textContent,'Add to Assistant');
assert.equal(toolbar.hidden,false);assert.equal(toolbar.style.left,'400px');assert.equal(toolbar.style.top,'348px');
assert.equal(frames.size,0,'The toolbar does not run an animation loop while the selection is idle');

selectionRects=[rect(250,350,350),rect(250,380,150)];focusRect=rect(400,380);refresh();
assert.equal(toolbar.style.top,'408px','A multiline selection puts the toolbar below its endpoint instead of covering highlighted lines');
focusRect=rect(400,160);selectionRects=[rect(300,160,100)];refresh();
assert.equal(toolbar.style.top,'188px','The toolbar moves below a selection near the Reader header');
focusRect=rect(400,710);selectionRects=[rect(300,710,100)];refresh();
assert.equal(toolbar.style.top,'658px','The bottom edge leaves the toolbar above the selected line');

selection.focusNode=first;selection.focusOffset=0;focusRect=rect(250,350);selectionRects=[rect(250,350,350),rect(250,380,150)];refresh();
assert.equal(positionedFocus.node,first);assert.equal(positionedFocus.offset,0);
assert.equal(toolbar.style.top,'298px','Backward selections follow the endpoint where the pointer was released');
selection.focusNode=last;selection.focusOffset=20;
for(const [x,expected] of [[110,180],[690,620]]){
 focusRect=rect(x,400);selectionRects=[rect(x,400,1)];refresh();
 assert.equal(Number.parseFloat(toolbar.style.left),expected,'The toolbar stays inside the Reader horizontally');
}
focusRect=rect(0,0,0,0);selectionRects=[rect(250,400,200)];refresh();
assert.equal(toolbar.style.left,'450px','A missing caret rectangle falls back to the last selected line');
focusRect=rect(400,780);selectionRects=[rect(300,780,100)];refresh();assert.equal(toolbar.hidden,true);
focusRect=rect(400,400);selectionRects=[rect(300,400,100)];documentEvents.scroll();flush();
assert.equal(toolbar.hidden,false,'Scrolling the selection back into view restores the action');

selectionReads=0;
documentEvents.pointerdown({button:0,target:{closest:()=>panel}});
documentEvents.selectionchange();flush();assert.equal(toolbar.hidden,true);assert.equal(selectionReads,0);
windowEvents.pointerup();flush();assert.equal(toolbar.hidden,false);assert.equal(selectionReads,1,'The exact excerpt is captured after the drag finishes');
let prevented=false;toolbar.events.pointerdown({preventDefault(){prevented=true;}});assert(prevented);
button.events.click();assert.equal(menuCalls.length,1);assert.equal(menuCalls[0].anchor,button);assert.equal(menuCalls[0].passages,intent);
documentEvents.keydown({key:'Escape'});documentEvents.scroll();flush();assert.equal(toolbar.hidden,true);
console.log('Reader selection action passed: selection endpoint, multiline collision avoidance, viewport bounds, backward/fallback ranges, scroll recovery, drag completion, preserved selection and destination menu.');
