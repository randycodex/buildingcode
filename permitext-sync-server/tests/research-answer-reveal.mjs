import assert from 'node:assert/strict';
import {revealResearchAnswer} from '../public/research-answer-reveal.js';
import {createResearchV2View} from '../public/research-v2.js';
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.handlers={};this.attributes={};this.dataset={};this.className='';this.isConnected=true;this.hidden=false;this.value='';this.style={setProperty:(key,value)=>{this.style[key]=value;}};this._text='';}
 set textContent(value){this._text=value;}get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
 get lastChild(){return this.children.at(-1);}append(...items){for(const item of items){item.parent=this;this.children.push(item);}}
 replaceChildren(...items){this._text='';this.children=[];this.append(...items);}setAttribute(k,v){this.attributes[k]=v;}removeAttribute(k){delete this.attributes[k];}
 addEventListener(k,v){this.handlers[k]=v;}removeEventListener(k){delete this.handlers[k];}focus(){}
 get classList(){const values=()=>new Set(this.className.split(/\s+/).filter(Boolean));return{add:(...v)=>{this.className=[...new Set([...values(),...v])].join(' ');},remove:(...v)=>{this.className=[...values()].filter(x=>!v.includes(x)).join(' ');},contains:v=>values().has(v),toggle:(v,force)=>{const set=values(),active=force??!set.has(v);active?set.add(v):set.delete(v);this.className=[...set].join(' ');return active;}};}
 querySelector(selector){const matches=all(this).filter(n=>n!==this&&(selector.startsWith('.')?n.classList.contains(selector.slice(1)):n.tagName===selector.replace(':last-of-type','')));return selector.endsWith(':last-of-type')?matches.at(-1):matches[0]||null;}
}
const all=root=>[root,...root.children.flatMap(all)];
const frames=new Map(),timers=new Map(),listeners=new Map();let sequence=0,reduced=false,done=0,current=true;
const motion={get matches(){return reduced;},addEventListener:(_key,fn)=>listeners.set('motion',fn),removeEventListener:()=>listeners.delete('motion')};
const doc={visibilityState:'visible',createElement:tag=>new Element(tag),createTextNode:text=>Object.assign(new Element('#text'),{textContent:text}),addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)};
const env={document:doc,matchMedia:()=>motion,requestAnimationFrame:fn=>{frames.set(++sequence,fn);return sequence;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence;},clearTimeout:id=>timers.delete(id)};
const flushFrame=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
const flushTimers=()=>{const pending=[...timers.values()];timers.clear();pending.forEach(({fn})=>fn());};
const entry=()=>new Element('div'),tokens=count=>Array.from({length:count},()=>new Element('span'));
for(const count of [1,20,1000]){
 const e=entry(),words=tokens(count);done=0;
 revealResearchAnswer({entry:e,tokens:words,environment:env,onDone:()=>done++});
 assert.equal(e.inert,true);assert.equal(e.attributes['aria-busy'],'true');flushFrame();
 assert.ok([...timers.values()].every(timer=>timer.ms<=1400),'Long answers do not impose word-count × fixed-delay waiting');
 assert.match(words.at(-1).style['--rv2-reveal-delay'],/ms$/);flushTimers();
 assert.equal(done,1);assert.equal(e.inert,false);assert.equal(e.classList.contains('is-answer-revealing'),false);
 assert.equal(listeners.size,0);
}
reduced=true;done=0;revealResearchAnswer({entry:entry(),tokens:tokens(4),environment:env,onDone:()=>done++});assert.equal(done,1);assert.equal(frames.size,0);reduced=false;
let e=entry();done=0;const cancelled=revealResearchAnswer({entry:e,tokens:tokens(4),environment:env,onDone:()=>done++});cancelled.dispose();flushFrame();flushTimers();assert.equal(done,0);assert.equal(e.inert,false);assert.equal(listeners.size,0);
e=entry();revealResearchAnswer({entry:e,tokens:tokens(4),environment:env,onDone:()=>done++});doc.visibilityState='hidden';listeners.get('visibilitychange')();assert.equal(done,1);assert.equal(e.inert,false);assert.equal(timers.size,0);doc.visibilityState='visible';
done=0;revealResearchAnswer({entry:entry(),tokens:tokens(4),environment:env,isCurrent:()=>false,onDone:()=>done++});flushFrame();flushTimers();assert.equal(done,0);assert.equal(listeners.size,0);
Object.assign(globalThis,{document:doc,requestAnimationFrame:env.requestAnimationFrame,cancelAnimationFrame:env.cancelAnimationFrame,setTimeout:env.setTimeout,clearTimeout:env.clearTimeout,matchMedia:env.matchMedia,ResizeObserver:class{observe(){}disconnect(){}}});
let cited;
const messages=[{id:'old',role:'assistant',answer:{answerText:'An existing answer.'}},{id:'new',role:'assistant',answer:{answerText:'The text remains exact. [S1]',missingFacts:['Confirm the project facts.']}}];
const options={conversation:{id:'c',sources:[{kind:'selection',selectedText:'Exact enacted text.'}],messages},initialDraft:'Follow up',onDraft(){},onCitation:(message,id)=>{cited=[message.id,id];}};
const history=createResearchV2View(options);assert.equal(all(history.element).some(n=>n.classList.contains('rv2-reveal-token')),false,'Saved answers never replay the reveal');history.dispose();
const view=createResearchV2View({...options,revealAnswerID:'new'}),answers=all(view.element).filter(n=>n.classList.contains('rv2-answer-entry'));
assert.equal(answers[0].classList.contains('is-answer-revealing'),false);
assert.equal(answers[1].classList.contains('is-answer-revealing'),true);
assert.equal(view.element.querySelector('.rv2-send').disabled,true,'Wait for the presentation to finish before another submit');
assert.equal(all(answers[1]).find(n=>n.tagName==='p').textContent,'The text remains exact. [S1]','Token spans preserve the checked answer and citation text exactly');
flushFrame();flushTimers();assert.equal(view.element.querySelector('.rv2-send').disabled,false);
all(answers[1]).find(n=>n.classList.contains('rv2-citation')).handlers.click();assert.deepEqual(cited,['new','S1'],'The real citation handler remains connected');view.dispose();
assert.equal(listeners.size,0);assert.equal(timers.size,0);
console.log('Answer reveal passed: bounded duration, exact text/citations, new answer only, reduced motion, hidden tabs, disposal, stale context and usable completion controls.');

// Reduced-motion completion also works before the real pane is attached.
const createElement=doc.createElement;doc.createElement=tag=>Object.assign(new Element(tag),{isConnected:false});reduced=true;
const detached=createResearchV2View({...options,revealAnswerID:'new'});
assert.equal(detached.element.querySelector('.rv2-send').disabled,false,'Reduced motion cannot leave a detached view permanently busy');
detached.dispose();doc.createElement=createElement;reduced=false;
