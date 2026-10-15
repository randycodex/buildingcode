import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createActiveCodeSourceController} from '../public/active-code-source-controller.js';
const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const implementation=app.slice(app.indexOf('function activeCodeSourceMenuRows('),app.indexOf('\nfunction renderSettings('));
class Element {
  hidden=true; children=[]; events=new Map(); attributes=new Map(); dataset={}; textContent=''; disabled=false; open=false;
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  addEventListener(name,handler){this.events.set(name,handler);}
  fire(name){return this.events.get(name)?.();}
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.get(name)??null;}
}
const sources=[2022,2014].map((year,index)=>({canonicalEdition:`edition:${year}`,jurisdictionID:1,codeID:index+1,categoryID:index+3,categoryLabel:'Building Code',editionLabel:String(year)}));
function fixture({catalog=async()=>sources,stored=null,readerMenu=false,collapsibleGroups=false}={}){
 const storage=new Map(stored?[['permitext.active-code-sources.v1.guest',stored]]:[]);
 let writes=0,failWrite=false;
 const controller=createActiveCodeSourceController({storage:{getItem:k=>storage.get(k)??null,setItem(k,v){if(failWrite)throw new Error('Storage full');writes++;storage.set(k,v);}},loadCatalog:catalog});
 controller.setContext({accountID:null,sessionID:'1'});
 const nodes=new Map(['status','list','retry','scope'].map(key=>[key,new Element()]));
 const card=new Element();card.querySelector=selector=>nodes.get(selector.replace('.settings-active-sources-',''));
 const panel={isConnected:true,querySelector:()=>card};
 const context=vm.createContext({document:{createElement:()=>new Element()},codeOptions:[{prefix:'BC',codeVersion:'edition:2022',group:'2022 Construction Codes',label:'Building Code (2022)'},{prefix:'BC',codeVersion:'edition:2014',group:'2014 Construction Codes (Historical)',label:'Building Code (2014)'}],codeOptionVersion:code=>code.codeVersion,readerCodeOptionLabel:code=>code.label,activeCodeSourcesController:controller,activeWorkspaceID:'w',captureAccountRequest:()=>1,isCurrentAccountRequest:()=>true});
 vm.runInContext(implementation,context);
 return {controller,panel,card,nodes,context,storage,get writes(){return writes;},set failWrite(value){failWrite=value;},wire:()=>context.wireSettingsActiveCodeSources(panel,{enabled:true,readerMenu,collapsibleGroups})};
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

const reversed=sources.map(source=>({...source,codePrefix:'BC'})).reverse();
const grouped=fixture({catalog:async()=>reversed,readerMenu:true});grouped.wire();await settle();
const groupedChildren=grouped.nodes.get('list').children;
assert.deepEqual(groupedChildren.map(node=>node.textContent || node.children[1].textContent),['2022 Construction Codes','Building Code (2022)','2014 Construction Codes (Historical)','Building Code (2014)']);
assert.match(groupedChildren[1].title,/Building Code — 2022/);
const grouped2022=groupedChildren[1].children[0];
assert.equal(grouped2022.getAttribute('role'),'menuitemcheckbox');
assert.equal(grouped2022.getAttribute('aria-checked'),'true');
grouped2022.checked=false;grouped2022.fire('change');
assert.equal(grouped2022.getAttribute('aria-checked'),'false');
assert.equal(grouped.controller.state.preferences.isEnabled(reversed[1]),false,'Reordered labels still toggle the exact 2022 source');
assert.equal(grouped.controller.state.preferences.isEnabled(reversed[0]),true,'The historical edition stays enabled');
assert.equal(grouped.nodes.get('list').children[1],groupedChildren[1],'Grouped source changes retain row identity and focus');
const unknown={...reversed[0],canonicalEdition:'edition:unlisted'};
assert.equal(grouped.context.activeCodeSourceMenuRows([unknown])[0].group,'Other installed sources','An unknown edition is not mislabeled as an installed Reader edition');
console.log('Reader-style source organization passed: exact edition mapping, Reader order, compact labels, stable rows and unknown-edition fallback.');

const account=fixture({catalog:async()=>reversed,collapsibleGroups:true});account.wire();await settle();
const editions=account.nodes.get('list').children;
assert.equal(editions.length,2);
assert.deepEqual(editions.map(group=>group.children[0].textContent),['2022 Construction Codes','2014 Construction Codes (Historical)']);
assert(editions.every(group=>!group.open),'Account edition groups start collapsed.');
editions[0].open=true;
const accountRow=editions[0].children[1].children[0],accountInput=accountRow.children[0];
assert.equal(accountRow.children[1].textContent,'Building Code (2022)');
accountInput.checked=false;accountInput.fire('change');
assert.equal(account.controller.state.preferences.isEnabled(reversed[1]),false);
assert.equal(account.controller.state.preferences.isEnabled(reversed[0]),true);
assert.equal(account.nodes.get('list').children[0],editions[0]);
assert.equal(editions[0].open,true,'Toggling a source retains its expanded edition group.');
assert.equal(editions[0].children[1].children[0],accountRow,'Source toggles keep the focused checkbox.');
console.log('Account editions passed: collapsed groups, exact source toggles, stable focus and retained expansion.');
