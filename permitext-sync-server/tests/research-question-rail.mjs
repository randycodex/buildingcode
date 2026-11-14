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
  assert.equal(styles['--rv2-rail-width'],'350px','Dragging stops at the 350px sidebar limit.');
  assert.equal(writes.length,0,'Moves do not repeatedly write local preferences.');
  fire('pointermove',{clientX:1200});
  assert.equal(styles['--rv2-rail-width'],'350px','Dragging beyond the maximum keeps the limit.');
  assert.equal(attrs['aria-valuemax'],'350');assert.equal(attrs['aria-valuemin'],'200');
  fire('pointerup');assert.deepEqual(writes,[350]);assert.equal(captured,null);
  fire('keydown',{key:'Home'});assert.equal(styles['--rv2-rail-width'],'200px');
  fire('keydown',{key:'End'});assert.equal(styles['--rv2-rail-width'],'350px');
  fire('keydown',{key:'ArrowLeft',shiftKey:true});assert.equal(styles['--rv2-rail-width'],'270px');
  const savedWrites=writes.length;
  root.clientWidth=560;resizeCallback();assert.equal(styles['--rv2-rail-width'],'239px','Preserve room for the chat in smaller Assistant columns.');
  root.clientWidth=1000;resizeCallback();assert.equal(styles['--rv2-rail-width'],'270px','Widening the column restores the preferred rail width.');
  assert.equal(writes.length,savedWrites,'Outer resizing must not overwrite the saved preference.');
  fire('pointerdown');fire('pointermove',{clientX:0});fire('pointercancel');
  assert.equal(styles['--rv2-rail-width'],'270px');assert.equal(writes.length,savedWrites);
  assert.equal(fire('pointerdown',{button:2}),false);
  narrow=true;fire('keydown',{key:'Home'});assert.equal(styles['--rv2-rail-width'],'270px','The hidden mobile divider cannot resize the stacked layout.');
  narrow=false;
  controller.dispose();assert.equal(handlers.size,0);assert.equal(disconnected,true);
  const restored=attachResearchQuestionRail({root,divider,widthStore:{read:()=>writes.at(-1)}});
  assert.equal(styles['--rv2-rail-width'],'270px','Reopening reads the committed local preference.');restored.dispose();
  for (const [saved,expected] of [[160,200],[900,350]]) {
    const previous=attachResearchQuestionRail({root,divider,widthStore:{read:()=>saved}});
    assert.equal(styles['--rv2-rail-width'],`${expected}px`,'Old saved preferences respect the new bounds.');previous.dispose();
  }
  const toggleHandlers=new Map(),toggleAttrs={},collapsedWrites=[],widthWrites=[];
  const toggle={setAttribute:(key,value)=>toggleAttrs[key]=value,focus(){},
    addEventListener:(type,handler)=>toggleHandlers.set(type,handler),removeEventListener:type=>toggleHandlers.delete(type)};
  const stores={widthStore:{read:()=>270,write:value=>widthWrites.push(value)},
    collapsedStore:{read:()=>collapsedWrites.at(-1)===true,write:value=>collapsedWrites.push(value)}};
  const collapsible=attachResearchQuestionRail({root,divider,toggle,...stores});
  assert.equal(toggleAttrs['aria-expanded'],'true');
  toggleHandlers.get('click')();
  assert.equal(styles['--rv2-rail-width'],'35px');assert.equal(divider.tabIndex,-1);
  assert.equal(toggleAttrs['aria-label'],'Show conversations list');
  assert.equal(fire('pointerdown'),false);assert.equal(fire('keydown',{key:'End'}),false);
  assert.deepEqual(widthWrites,[],'Collapsing and the disabled divider never replace the expanded width.');
  toggleHandlers.get('click')();
  assert.equal(styles['--rv2-rail-width'],'270px');assert.equal(divider.tabIndex,0);
  toggleHandlers.get('click')();collapsible.dispose();
  assert.equal(toggleHandlers.size,0);
  const collapsedRestored=attachResearchQuestionRail({root,divider,toggle,...stores});
  assert.equal(styles['--rv2-rail-width'],'35px','A remounted conversation retains the collapsed list.');
  toggleHandlers.get('click')();assert.equal(styles['--rv2-rail-width'],'270px');
  collapsedRestored.dispose();
} finally {delete globalThis.matchMedia;delete globalThis.ResizeObserver;}
console.log('Research question rail passed: drag/capture, keyboard, bounds, live sizing, local preference, outer resize, cancel, mobile isolation and disposal.');
