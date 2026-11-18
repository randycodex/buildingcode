import assert from 'node:assert/strict';
import {attachResearchQuestionRail} from '../public/research-question-rail.js';

const handlers=new Map(),attrs={},styles={},toggleHandlers=new Map(),toggleAttrs={},collapseWrites=[];
let narrow=false,resizeCallback,disconnected=false,focused=0;
const classes=new Set();
const root={clientWidth:1000,style:{setProperty:(key,value)=>styles[key]=value},
  classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}};
const divider={setAttribute:(key,value)=>attrs[key]=value,
  addEventListener:(type,handler)=>handlers.set(type,handler),removeEventListener:type=>handlers.delete(type)};
const toggle={setAttribute:(key,value)=>toggleAttrs[key]=value,focus(){focused++;},
  addEventListener:(type,handler)=>toggleHandlers.set(type,handler),removeEventListener:type=>toggleHandlers.delete(type)};
globalThis.matchMedia=()=>({matches:narrow});
globalThis.ResizeObserver=class{constructor(callback){resizeCallback=callback;}observe(){}disconnect(){disconnected=true;}};
const fire=(type,values={})=>handlers.get(type)?.({button:0,pointerId:1,clientX:310,preventDefault(){},stopPropagation(){},...values});
try {
  for(const saved of [160,270,350,900]) {
    const controller=attachResearchQuestionRail({root,divider,toggle,
      widthStore:{read:()=>saved,write(){assert.fail('Fixed list widths must not save resize preferences');}}});
    assert.equal(styles['--rv2-rail-width'],'300px','Old saved widths cannot change the expanded list');
    assert.equal(attrs['aria-hidden'],'true');assert.equal(divider.tabIndex,-1);
    assert.equal(handlers.size,0,'A fixed list has no drag or keyboard resize target');
    fire('pointerdown');fire('pointermove',{clientX:1200});fire('keydown',{key:'End'});
    assert.equal(styles['--rv2-rail-width'],'300px');
    for(const width of [560,1800]){root.clientWidth=width;resizeCallback();assert.equal(styles['--rv2-rail-width'],'300px','Resizing the outer column retains the fixed width');}
    controller.dispose();assert.equal(toggleHandlers.size,0);assert.equal(disconnected,true);
  }
  const store={read:()=>collapseWrites.at(-1)===true,write:value=>collapseWrites.push(value)};
  const collapsible=attachResearchQuestionRail({root,divider,toggle,collapsedStore:store});
  assert.equal(toggleAttrs['aria-expanded'],'true');
  toggleHandlers.get('click')();assert.equal(styles['--rv2-rail-width'],'72px');
  assert.equal(toggleAttrs['aria-expanded'],'false');assert.equal(classes.has('is-history-collapsed'),true);
  toggleHandlers.get('click')();assert.equal(styles['--rv2-rail-width'],'300px');
  assert.equal(toggleAttrs['aria-expanded'],'true');assert.equal(classes.has('is-history-collapsed'),false);
  narrow=true;toggleHandlers.get('click')();assert.equal(styles['--rv2-rail-width'],'300px','Mobile history keeps its separate stacked-layout control');narrow=false;
  toggleHandlers.get('click')();collapsible.dispose();
  const restored=attachResearchQuestionRail({root,divider,toggle,collapsedStore:store});
  assert.equal(styles['--rv2-rail-width'],'72px','Remounting a conversation preserves the collapsed list');
  toggleHandlers.get('click')();assert.equal(styles['--rv2-rail-width'],'300px');
  assert.ok(focused>=4);restored.dispose();assert.equal(toggleHandlers.size,0);
} finally {delete globalThis.matchMedia;delete globalThis.ResizeObserver;}
console.log('Research history passed: fixed 300px expanded width, 72px collapse, persisted collapse state, ignored old widths, no resize target, outer resize, mobile isolation and disposal.');
