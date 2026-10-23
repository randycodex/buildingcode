import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
let documentScans=0,subtreeScans=0,styleWrites=0,frame,mutate,resizeUpdate;
const listeners=new Map(),observed=new Set(),unobserved=new Set();
class Element {
 constructor(kind,children=[]){this.kind=kind;this.children=children;this.nodeType=1;this.isConnected=true;this.clientHeight=500;this.scrollTop=50;this.height=1000;this.open=false;this.attrs=new Set();this.styles=new Map();this.style={setProperty:(k,v)=>{styleWrites++;this.styles.set(k,v);}};}
 get scrollHeight(){assert.ok(this.clientHeight,'Hidden columns must not measure scroll height.');return this.height;}
 get childElementCount(){return this.children.length;}
 contains(node){return this===node||this.children.some(child=>child.contains(node));}
 matches(selector){return selector.split(',').some(part=>{part=part.trim();return part===this.kind||part===`${this.kind}[open]`&&this.open;});}
 querySelectorAll(selector){subtreeScans++;return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
 getClientRects(){return this.open?[{}]:[];}
 getBoundingClientRect(){return {top:0,bottom:this.kind==='.notebook-format-toolbar'?32:500};}
 toggleAttribute(k,on){if(on)this.attrs.add(k);else this.attrs.delete(k);}
 removeAttribute(k){this.attrs.delete(k);}
}
const header=new Element('.notebook-format-toolbar'),popup=new Element('.notebook-note-menu');
const visible=new Element('.notebook-shell',[header,popup]),hidden=new Element('.reader-content');hidden.clientHeight=0;
const body=new Element('body',[visible,hidden]);
const document={body,contains:node=>body.contains(node),querySelectorAll(selector){documentScans++;return body.querySelectorAll(selector);},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),fonts:{addEventListener(){},removeEventListener(){}}};
const c=vm.createContext({document,window:{innerWidth:1200,addEventListener:(name,fn)=>listeners.set('window:'+name,fn),removeEventListener:name=>listeners.delete('window:'+name)},
 requestAnimationFrame:fn=>{frame=fn;return 1;},cancelAnimationFrame:()=>{frame=null;},
 getComputedStyle:element=>({overflowY:'auto',position:element===header?'sticky':'static'}),
 ResizeObserver:class{constructor(fn){resizeUpdate=fn;}observe(e){observed.add(e);}unobserve(e){unobserved.add(e);}disconnect(){observed.clear();}},
 MutationObserver:class{constructor(fn){mutate=fn;}observe(){}disconnect(){mutate=null;}}});
vm.runInContext((await readFile(new URL('../public/scroll-edge-fades.js',import.meta.url),'utf8')).replaceAll('export ',''),c);
const flush=()=>{const fn=frame;frame=null;fn?.();};
const cleanup=c.installScrollEdgeFades();flush();
assert.equal(documentScans,1);assert.equal(observed.size,2);
assert.equal(visible.styles.get('--scroll-fade-header'),'32px');assert.equal(visible.styles.get('--scroll-fade-top-size'),'24px');assert.equal(hidden.attrs.has('data-scroll-fade'),false);
const scans=subtreeScans;styleWrites=0;
mutate([{type:'attributes',attributeName:'class',target:body}]);flush();
assert.equal(documentScans,1,'Workflow class changes never rescan the document.');assert.equal(subtreeScans,scans,'A view switch does not rescan retained source trees.');assert.equal(styleWrites,0,'Unchanged masks do not write styles again.');
popup.open=true;mutate([{type:'attributes',attributeName:'open',target:popup}]);flush();
assert.equal(visible.attrs.has('data-scroll-fade'),false,'Open editor popups remain unmasked.');
popup.open=false;mutate([{type:'attributes',attributeName:'open',target:popup}]);flush();assert.equal(visible.attrs.has('data-scroll-fade'),true);
hidden.clientHeight=500;resizeUpdate();flush();assert.equal(hidden.styles.get('--scroll-fade-top-size'),'0px','Reader retains its existing top fade.');assert.equal(hidden.styles.get('--scroll-fade-bottom-size'),'24px');
const added=new Element('.search-results');body.children.push(added);mutate([{type:'childList',target:body,addedNodes:[added]}]);flush();assert.ok(observed.has(added));assert.equal(added.attrs.has('data-scroll-fade'),true);assert.equal(documentScans,1);
const offscreenPanel={getBoundingClientRect:()=>({width:600,left:1400,right:2000})};
added.closest=()=>offscreenPanel;
Object.defineProperty(added,'clientHeight',{get(){throw new Error('Offscreen descendants must not force layout');},configurable:true});
resizeUpdate();flush();
Object.defineProperty(added,'clientHeight',{value:500,configurable:true});
added.closest=()=>null;
visible.scrollTop=0;listeners.get('scroll')();flush();assert.equal(visible.styles.get('--scroll-fade-top-size'),'0px');assert.equal(visible.styles.get('--scroll-fade-bottom-size'),'24px');
added.isConnected=false;mutate([{type:'childList',target:body,addedNodes:[]}]);flush();assert.ok(unobserved.has(added));
cleanup();assert.equal(observed.size,0);assert.equal(visible.attrs.has('data-scroll-fade'),false);assert.equal(listeners.size,0);assert.equal(frame,null);
console.log('Scroll fade performance passed: one initial discovery, no full-page or retained-tree scans on switches, hidden measurement guard, unchanged-style elision, sticky toolbar, popup legibility, dynamic columns, scroll updates and teardown.');
