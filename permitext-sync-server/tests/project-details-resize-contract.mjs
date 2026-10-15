import assert from 'node:assert/strict';
import {createProjectDetailsColumnResizers, normalizeProjectDetailsWidths, resizeProjectDetailsPair} from '../public/project-details-columns.js';

for (const index of [0,1]) for (const delta of [-10000,-300,0,300,10000]) {
  const original = [640,640,640];
  const next = resizeProjectDetailsPair(original,index,delta);
  assert(next.every(width=>width>=400),'Every column retains its 400px minimum');
  assert.equal(next.reduce((sum,width)=>sum+width,0),1920,'Dragging never moves the outside edges');
  assert.equal(next[index===0?2:0],640,'Only the two neighboring columns resize');
  assert.deepEqual(original,[640,640,640]);
}
assert.deepEqual(normalizeProjectDetailsWidths([400,600,800]),[400,600,800]);
for (const invalid of [null,[],[399,600,800],[400,Infinity,800],[400,600]]) assert.equal(normalizeProjectDetailsWidths(invalid),null);

const node = () => ({
  attributes:{},handlers:{},captured:new Set(),
  setAttribute(name,value){this.attributes[name]=value;},
  addEventListener(name,callback){this.handlers[name]=callback;},
  focus(){this.handlers.focus?.();},
  setPointerCapture(id){this.captured.add(id);},
  hasPointerCapture(id){return this.captured.has(id);},
  releasePointerCapture(id){this.captured.delete(id);}
});
let template='', changes=0;
const classes=new Set();
const currentWidths=()=>template ? [...template.matchAll(/minmax\(400px, ([\d.]+)fr\)/g)].map(match=>Number(match[1])) : [640,640,640];
const panels=[0,1,2].map(index=>({getBoundingClientRect:()=>({width:currentWidths()[index]})}));
const columns={
  ownerDocument:{createElement:node},children:[...panels],
  style:{get gridTemplateColumns(){return template;},set gridTemplateColumns(value){template=value;},removeProperty(){template='';}},
  classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},
  insertBefore(child,before){this.children.splice(this.children.indexOf(before),0,child);}
};
const controls=createProjectDetailsColumnResizers(columns,panels,()=>{changes++;});
assert.equal(columns.children.length,5);
const [left, right]=[columns.children[1],columns.children[3]];
assert.equal(columns.children[0],panels[0]); assert.equal(columns.children[4],panels[2]);
assert.equal(left.attributes['aria-label'],'Resize Overview and Facts');
assert.equal(right.attributes['aria-label'],'Resize Facts and Records');
assert.equal(left.attributes['aria-valuemin'],'400');
const event=overrides=>({preventDefault(){},button:0,pointerId:7,clientX:640,...overrides});
left.handlers.pointerdown(event());
left.handlers.pointermove(event({clientX:0}));
assert.deepEqual(controls.getWidths(),[400,880,640]);
left.handlers.pointermove(event({clientX:10000}));
assert.deepEqual(controls.getWidths(),[880,400,640]);
assert.equal(changes,0,'An in-progress gesture does not write presentation snapshots on every movement');
left.handlers.pointerup(event());
assert.equal(changes,1); assert.equal(classes.has('is-resizing'),false); assert.equal(left.hasPointerCapture(7),false);
right.handlers.keydown(event({key:'End'}));
assert.deepEqual(controls.getWidths(),[880,640,400]);
right.handlers.keydown(event({key:'ArrowLeft',shiftKey:true}));
assert.deepEqual(controls.getWidths(),[880,560,480]);
right.handlers.keydown(event({key:'Home'}));
assert.deepEqual(controls.getWidths(),[880,400,640]);
controls.setWidths([400,700,820]);
assert.deepEqual(controls.getWidths(),[400,700,820]);
left.handlers.dblclick(); assert.deepEqual(controls.getWidths(),[640,640,640]);
left.handlers.pointerdown(event()); left.handlers.pointercancel(event());
assert.equal(classes.has('is-resizing'),false); assert.equal(left.hasPointerCapture(7),false);
controls.dispose();
console.log('Project details resizing passed: two internal dividers, adjacent-only resizing, 400px limits, keyboard controls, reset, pointer cleanup and restored widths.');
