import assert from 'node:assert/strict';
import {attachResearchQuestionRail} from '../public/research-question-rail.js';

const handlers=new Map(),attrs={},writes=[],styles={};
let captured=null,narrow=false,resizeCallback,disconnected=false;
const root={clientWidth:1000,style:{setProperty:(key,value)=>styles[key]=value},classList:{toggle(){}}};
const divider={setAttribute:(key,value)=>attrs[key]=value,
  addEventListener:(type,handler)=>handlers.set(type,handler),
  removeEventListener:type=>handlers.delete(type),
  setPointerCapture:id=>captured=id,hasPointerCapture:id=>captured===id,releasePointerCapture:()=>captured=null};
globalThis.matchMedia=()=>({matches:narrow});
globalThis.ResizeObserver=class{constructor(callback){resizeCallback=callback;}observe(){}disconnect(){disconnected=true;}};
const fire=(type,values={})=>{let prevented=false;handlers.get(type)?.({button:0,pointerId:1,clientX:310,
  preventDefault(){prevented=true;},stopPropagation(){},...values});return prevented;};
try {
  const controller=attachResearchQuestionRail({root,divider,widthStore:{read:()=>310,write:value=>writes.push(value)}});
  assert.equal(styles['--rv2-rail-width'],'310px');
  assert.equal(attrs.role,'separator');assert.equal(attrs['aria-orientation'],'vertical');
  fire('pointerdown');fire('pointermove',{clientX:600});
  assert.equal(styles['--rv2-rail-width'],'600px','Dragging immediately widens the question list.');
  assert.equal(writes.length,0,'Moves do not repeatedly write local preferences.');
  fire('pointermove',{clientX:1200});
  assert.equal(styles['--rv2-rail-width'],'679px','Leave a usable 320px chat beside the divider.');
  fire('pointerup');assert.deepEqual(writes,[679]);assert.equal(captured,null);
  fire('keydown',{key:'Home'});assert.equal(styles['--rv2-rail-width'],'160px');
  fire('keydown',{key:'End'});assert.equal(styles['--rv2-rail-width'],'679px');
  fire('keydown',{key:'ArrowLeft',shiftKey:true});assert.equal(styles['--rv2-rail-width'],'599px');
  const savedWrites=writes.length;
  root.clientWidth=700;resizeCallback();assert.equal(styles['--rv2-rail-width'],'379px');
  root.clientWidth=1000;resizeCallback();assert.equal(styles['--rv2-rail-width'],'599px','Widening the column restores the preferred rail width.');
  assert.equal(writes.length,savedWrites,'Outer resizing must not overwrite the saved preference.');
  fire('pointerdown');fire('pointermove',{clientX:0});fire('pointercancel');
  assert.equal(styles['--rv2-rail-width'],'599px');assert.equal(writes.length,savedWrites);
  assert.equal(fire('pointerdown',{button:2}),false);
  narrow=true;fire('keydown',{key:'Home'});assert.equal(styles['--rv2-rail-width'],'599px','The hidden mobile divider cannot resize the stacked layout.');
  narrow=false;
  controller.dispose();assert.equal(handlers.size,0);assert.equal(disconnected,true);
  const restored=attachResearchQuestionRail({root,divider,widthStore:{read:()=>writes.at(-1)}});
  assert.equal(styles['--rv2-rail-width'],'599px','Reopening reads the committed local preference.');restored.dispose();
} finally {delete globalThis.matchMedia;delete globalThis.ResizeObserver;}
console.log('Research question rail passed: drag/capture, keyboard, bounds, live sizing, local preference, outer resize, cancel, mobile isolation and disposal.');
