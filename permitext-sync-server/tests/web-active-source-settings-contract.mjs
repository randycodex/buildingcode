import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createActiveCodeSourceController} from '../public/active-code-source-controller.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const implementation=app.slice(app.indexOf('function wireSettingsActiveCodeSources('),app.indexOf('\nfunction renderSettings('));
class Element {
  hidden=true; children=[]; events=new Map(); textContent=''; disabled=false;
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  addEventListener(name,handler){this.events.set(name,handler);}
  fire(name){return this.events.get(name)?.();}
}
const sources=[2022,2014].map((year,index)=>({canonicalEdition:`edition:${year}`,jurisdictionID:1,codeID:index+1,categoryID:index+3,categoryLabel:'Building Code',editionLabel:String(year)}));
function fixture({catalog=async()=>sources,stored=null}={}){
 const storage=new Map(stored?[['permitext.active-code-sources.v1.guest',stored]]:[]);
 let writes=0,failWrite=false;
 const controller=createActiveCodeSourceController({storage:{getItem:k=>storage.get(k)??null,setItem(k,v){if(failWrite)throw new Error('Storage full');writes++;storage.set(k,v);}},loadCatalog:catalog});
 controller.setContext({accountID:null,sessionID:'1'});
 const nodes=new Map(['status','list','retry','scope'].map(key=>[key,new Element()]));
 const card=new Element();card.querySelector=selector=>nodes.get(selector.replace('.settings-active-sources-',''));
 const panel={isConnected:true,querySelector:()=>card};
 const context=vm.createContext({document:{createElement:()=>new Element()},activeCodeSourcesController:controller,activeWorkspaceID:'w',captureAccountRequest:()=>1,isCurrentAccountRequest:()=>true});
 vm.runInContext(implementation,context);
 return {controller,panel,card,nodes,context,storage,get writes(){return writes;},set failWrite(value){failWrite=value;},wire:()=>context.wireSettingsActiveCodeSources(panel,{enabled:true})};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const f=fixture();f.wire();await settle();
assert.equal(f.card.hidden,false);assert.equal(f.nodes.get('list').children.length,2);
assert.match(f.nodes.get('scope').textContent,/Guest/);
const firstRow=f.nodes.get('list').children[0],first=firstRow.children[0];
first.checked=false;first.fire('change');
assert.equal(f.controller.state.preferences.isEnabled(sources[0]),false);
assert.equal(f.controller.state.preferences.isEnabled(sources[1]),true);
assert.equal(f.nodes.get('list').children[0],firstRow,'Toggle preserves the focused row');
const second=f.nodes.get('list').children[1].children[0];second.checked=false;second.fire('change');
assert.match(f.nodes.get('status').textContent,/All configurable sources are off/);
f.failWrite=true;first.checked=true;first.fire('change');
assert.equal(first.checked,false);assert.equal(first.disabled,true);assert.equal(f.nodes.get('retry').hidden,false);
assert.match(f.nodes.get('status').textContent,/Storage full/);
f.failWrite=false;f.nodes.get('retry').fire('click');await settle();
assert.equal(first.disabled,false);assert.equal(first.checked,false);
const writes=f.writes;f.context.activeWorkspaceID='elsewhere';first.checked=true;first.fire('change');assert.equal(f.writes,writes);
const broken=fixture({stored:'{invalid'});broken.wire();await settle();
assert.match(broken.nodes.get('status').textContent,/not been reset/);assert.equal(broken.writes,0);
let finish;const pending=fixture({catalog:()=>new Promise(resolve=>{finish=resolve;})});pending.wire();await settle();
pending.controller.setContext({accountID:'other',sessionID:'2'});finish(sources);await settle();
assert.equal(pending.nodes.get('list').children.length,0,'Late catalog cannot populate stale account controls');
console.log('Actual Settings controls passed: exact toggles, stable rows, all-off, failed-write recovery, corrupt preservation and stale context.');
