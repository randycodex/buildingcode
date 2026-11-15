import assert from 'node:assert/strict';
import {attachResearchHistoryTitleScroll} from '../public/research-question-rail.js';

const handlers=new Map(),timers=new Map(),motionHandlers=new Map(),animations=[];
let now=0,sequence=0,connected=true;
const classes=new Set();
const clip={clientWidth:100,classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)}};
const text={width:280,getBoundingClientRect(){return {width:this.width};},animate:(frames,options)=>{
  const animation={frames,options,cancelled:false,cancel(){this.cancelled=true;}};
  animations.push(animation);return animation;
}};
let matchedSelector;
const button={querySelector:selector=>['.rv2-question-title','.notebook-index-title'].includes(selector)?clip:text};
const target={closest:selector=>{matchedSelector=selector;return button;}};
const root={isConnected:true,contains:value=>connected&&value===button,
  addEventListener:(type,handler)=>handlers.set(type,handler),removeEventListener:type=>handlers.delete(type)};
const motion={matches:false,addEventListener:(type,handler)=>motionHandlers.set(type,handler),removeEventListener:type=>motionHandlers.delete(type)};
const environment={matchMedia:()=>motion,setTimeout:(fn,delay)=>{const id=++sequence;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id)};
const advance=milliseconds=>{now+=milliseconds;for(const [id,timer]of timers)if(timer.at<=now){timers.delete(id);timer.fn();}};
const fire=(type,values={})=>handlers.get(type)?.({target,pointerType:'mouse',...values});
const controller=attachResearchHistoryTitleScroll({root,environment});

fire('pointerover');advance(699);assert.equal(animations.length,0,'A brief hover keeps the ellipsis still.');
advance(1);assert.equal(animations.length,1);
assert.equal(animations[0].options.duration,6000,'Longer titles move at a steady 30px per second.');
assert.deepEqual(animations[0].frames.at(-1),{left:'-180px'});
assert.equal(animations[0].options.fill,'forwards','The final words remain visible while hovered.');
assert.equal(classes.has('is-title-scrolling'),true);
fire('pointerout',{relatedTarget:null});assert.equal(animations[0].cancelled,true);assert.equal(classes.size,0,'Leaving resets the title.');

fire('pointerover');advance(300);fire('pointerout',{relatedTarget:null});advance(1000);
assert.equal(animations.length,1,'Leaving before the delay prevents a late animation.');
text.width=80;fire('pointerover');advance(700);assert.equal(animations.length,1,'Titles that fit never scroll.');
text.width=280;controller.refresh();advance(700);assert.equal(animations.length,2,'Resizing rechecks the current title.');
fire('pointerout',{relatedTarget:null});

fire('focusin');advance(700);assert.equal(animations.length,3,'Keyboard focus can also reveal a truncated title.');
motion.matches=true;motionHandlers.get('change')();assert.equal(animations.at(-1).cancelled,true);
advance(1000);assert.equal(animations.length,3,'Reduced motion keeps the title still.');
motion.matches=false;motionHandlers.get('change')();advance(700);assert.equal(animations.length,4);
fire('focusout',{relatedTarget:null});
fire('pointerover',{pointerType:'touch'});advance(1000);assert.equal(animations.length,4,'Touch input does not start hover scrolling.');

fire('pointerover');connected=false;advance(700);assert.equal(animations.length,4,'Removed history rows cannot animate later.');
connected=true;controller.refresh();controller.dispose();advance(1000);
assert.equal(timers.size,0);assert.equal(handlers.size,0);assert.equal(motionHandlers.size,0);assert.equal(classes.size,0);

const resizes=[];
environment.ResizeObserver=class {constructor(callback){this.callback=callback;resizes.push(this);}observe(target){this.target=target;}disconnect(){this.target=null;}};
const notes=attachResearchHistoryTitleScroll({root,environment,buttonSelector:'.notebook-index-note',titleSelector:'.notebook-index-title',textSelector:'.notebook-index-title-text'});
fire('pointerover');advance(700);
assert.equal(matchedSelector,'.notebook-index-note','Notes uses the same delegated hover behavior.');
assert.equal(resizes.at(-1).target,clip);
const previousAnimation=animations.at(-1);
clip.clientWidth=140;resizes.at(-1).callback();
assert.equal(previousAnimation.cancelled,true,'Changing the Notes column width resets the old animation.');
advance(700);assert.deepEqual(animations.at(-1).frames.at(-1),{left:'-140px'},'Scrolling uses the resized title width.');
notes.dispose();assert.equal(resizes.at(-1).target,null);assert.equal(timers.size,0);assert.equal(handlers.size,0);
console.log('History title scrolling passed: hover delay, measured overflow, steady speed, reset, resize, keyboard, reduced motion, touch and cleanup.');
