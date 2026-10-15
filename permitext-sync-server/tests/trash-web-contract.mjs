import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as identity from '../public/sync-identity.js';
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const between=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const preflightSource=between('async function prepareRecoverableDeletion()', 'function attachSettingsTrash(');
async function preflight(state, post=async()=>({entries:[]})) {
 const values={state,requirePrivateWorkspaceWritable(){},captureAccountRequest(){return 'owner';},activeAccount(){return {userID:'owner'};},flushSyncOutbox:async()=>{},requireCurrentAccountRequest(){},loadSyncedContent:async()=>{},postResearch:post};
 return new Function(...Object.keys(values),preflightSource+';return prepareRecoverableDeletion();')(...Object.values(values));
}
await assert.rejects(preflight({syncOutbox:[{accountUserID:'owner'}]}),/Finish syncing/);
await assert.rejects(preflight({syncConflicts:[{accountUserID:'owner'}]}),/resolve sync conflicts/);
await assert.rejects(preflight({},async()=>{throw new Error('Recovery service unavailable')}),/unavailable/);
await preflight({syncOutbox:[{accountUserID:'other'}]});
const allCodesSource=between('function enqueueSettingsClearForAllCodes(', 'let openTrashAfterSettingsDeletion');
const notesSource=between('async function clearSettingsNotes()', 'async function performSettingsClearAction(');
const annotations=[
 {id:'2022-note',sectionID:545,codeVersion:identity.defaultSyncCodeVersion,noteBody:'One',tags:['Keep']},
 {id:'2014-note',sectionID:545,codeVersion:identity.historicalConstructionSyncCodeVersion,noteBody:'Two',tags:['Keep']},
 {id:'tag-only',sectionID:2,codeVersion:identity.defaultSyncCodeVersion,noteBody:'',tags:['Keep']}
];
const state={localAnnotations:structuredClone(annotations),sectionNotes:{545:'One'}};
const clears=[];
const values={...identity,state,crypto,requirePrivateWorkspaceWritable(){},captureAccountRequest(){return 'owner'},requireCurrentAccountRequest(){},currentContentSummary(){return {annotations}},normalizeAnnotationBlockID:id=>id||'',enqueueSettingsBulkClear(scope,options){clears.push({scope,...options})},saveWorkspaceState(){},activeAccount(){return {userID:'owner'}},flushSyncOutbox:async()=>{}};
const count=await new Function(...Object.keys(values),allCodesSource+notesSource+';return clearSettingsNotes();')(...Object.values(values));
assert.equal(count,2,'Same section in two editions is two independent notes');
assert.equal(new Set(clears.map(c=>c.codeVersion)).size,6);
assert.equal(new Set(clears.map(c=>c.operationGroupID)).size,1,'One deletion stays in one sync operation');
assert(state.localAnnotations.every(a=>a.noteBody===''));
assert(state.localAnnotations.every(a=>a.tags[0]==='Keep'));
console.log('Web Trash preflight and all-edition note cleanup passed.');

// Exercise the rendered row actions with synthetic recovery copies and no backend.
class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.events={};this.className='';this.value='';this.disabled=false;this.textContent='';}
 classList={add:name=>{this.className+=` ${name}`;},contains:name=>this.className.split(' ').includes(name)};
 setAttribute(name,value){(this.attributes ||= {})[name]=value;}
 getAttribute(name){return this.attributes?.[name] ?? null;}
 append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 addEventListener(name,handler){this.events[name]=handler;}
 fire(name){if(!this.disabled)return this.events[name]?.();}
 focus(){}
 remove(){this.parent.children=this.parent.children.filter(node=>node!==this);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 querySelectorAll(selector){return this.children.flatMap(node=>[
  ...(selector.split(',').some(part=>part.trim().startsWith('.')?node.className.split(' ').includes(part.trim().slice(1)):node.tagName===part.trim())?[node]:[]),
  ...node.querySelectorAll(selector)
 ]);}
}
const nodes=Object.fromEntries(['settings-trash','settings-trash-list','settings-trash-status','settings-trash-refresh'].map(name=>[`.${name}`,new Element()]));
const panel={querySelector:selector=>nodes[selector]};
const entries=[{id:'copy-one',title:'Synthetic note',expiresAt:'2026-11-01T12:00:00Z'},{id:'copy-two',title:'Synthetic evidence',expiresAt:'2026-11-02T12:00:00Z'}];
const requests=[];let current=true,preflights=0,refreshes=0,failNextRequest=false,holdInspection=false,finishInspection;
const trashValues={document:{createElement:tag=>new Element(tag)},captureAccountRequest:()=> 'owner',isCurrentAccountRequest:()=>current,
 stripLeadingSectionNumber:value=>value,
 prepareRecoverableDeletion:async()=>{preflights++;},requireCurrentAccountRequest(){assert(current);},
 postResearch:async(path,body)=>{requests.push({path,...body});if(holdInspection&&body.action==='inspect')return new Promise(resolve=>{finishInspection=resolve;});if(failNextRequest){failNextRequest=false;throw Error('Synthetic retry failure');}return {entries,entry:{id:body.id,items:[{kind:'savedItem',codeLabel:'Building Code',editionLabel:'2022',sectionNumber:'1020.2',title:'Width and capacity.',excerpt:'Synthetic preserved passage <script>plain text</script>'}]}};},
 loadSyncedContent:async()=>{},refreshWorkspaceAfterSettingsClear:async()=>{refreshes++;},settingsPanelScrollTop:()=>0,track:{scrollLeft:0},openTrashAfterSettingsDeletion:false};
new Function(...Object.keys(trashValues),'panel',between('function attachSettingsTrash(', 'async function clearSettingsBookmarks(')+';attachSettingsTrash(panel);')(...Object.values(trashValues),panel);
await nodes['.settings-trash-refresh'].fire('click');
const list=nodes['.settings-trash-list'],row=list.children[0],actions=row.querySelector('.settings-trash-actions');
assert.deepEqual(actions.children.map(button=>button.textContent),['Restore','Delete Permanently']);
assert.match(row.querySelector('p').textContent,/^Expires /);
assert.equal(nodes['.settings-trash-status'].textContent,'','Routine guidance does not take up a row above populated Trash.');
const title=row.querySelector('.settings-trash-title'),contents=row.querySelector('.settings-trash-contents');
assert.equal(contents.hidden,true);
await title.fire('click');
assert.equal(contents.hidden,false);
assert.equal(title.getAttribute('aria-expanded'),'true');
assert.deepEqual(requests.at(-1),{path:'/content/trash',action:'inspect',id:'copy-one'});
assert.equal(contents.querySelector('strong').textContent,'§ 1020.2 · Width and capacity.');
assert.match(contents.querySelector('.settings-trash-item-meta').textContent,/Building Code · 2022/);
assert.match(contents.querySelector('.settings-trash-item-excerpt').textContent,/<script>plain text<\/script>/,'Excerpts render as literal text.');
const afterInspect=requests.length;
await title.fire('click');await title.fire('click');
assert.equal(requests.length,afterInspect,'Reopening a loaded entry uses its read-only details.');
await title.fire('click');
actions.children[1].fire('click');
let form=row.querySelector('.settings-trash-confirm');
const input=form.querySelector('input'),confirm=form.querySelector('button');
assert.equal(confirm.disabled,true);
input.value='delete';input.fire('input');assert.equal(confirm.disabled,true);
input.value='DELETE';input.fire('input');assert.equal(confirm.disabled,false);
form.querySelectorAll('button')[1].fire('click');
assert.equal(row.querySelector('.settings-trash-confirm'),null);
assert.equal(requests.length,afterInspect,'Opening and canceling permanent deletion only changes presentation.');
actions.children[1].fire('click');form=row.querySelector('.settings-trash-confirm');
form.querySelector('input').value='DELETE';form.querySelector('input').fire('input');
await form.querySelector('button').fire('click');
assert.deepEqual(requests.at(-1),{path:'/content/trash',action:'purge',id:'copy-one',confirmation:'DELETE'});
assert.equal(preflights,1);
await list.children[1].querySelector('.settings-trash-actions').children[0].fire('click');
assert.equal(requests.at(-1).action,'restore');assert.equal(requests.at(-1).id,'copy-two');assert.equal(refreshes,1);
list.children[0].querySelector('.settings-trash-actions').children[1].fire('click');
const pendingConfirmation=list.children[0].querySelector('.settings-trash-confirm').querySelector('button');
failNextRequest=true;await nodes['.settings-trash-refresh'].fire('click');
assert.equal(list.children[0].querySelector('.settings-trash-actions').children[1].disabled,false,'A failed refresh restores the row Delete action even when it shares the confirmation label.');
assert.equal(pendingConfirmation.disabled,true,'Retry does not enable an unconfirmed permanent deletion.');
const secondTitle=list.children[1].querySelector('.settings-trash-title');
failNextRequest=true;await secondTitle.fire('click');
const secondContents=list.children[1].querySelector('.settings-trash-contents');
assert.match(secondContents.querySelector('p').textContent,/Synthetic retry failure/);
await secondContents.querySelector('button').fire('click');
assert.equal(secondContents.querySelector('strong').textContent,'§ 1020.2 · Width and capacity.');
current=false;const requestCount=requests.length;
await secondTitle.fire('click');
assert.equal(secondTitle.getAttribute('aria-expanded'),'true','A stale Account cannot reveal different recovery contents.');
await list.children[0].querySelector('.settings-trash-actions').children[0].fire('click');
assert.equal(requests.length,requestCount,'A stale Account view cannot mutate recovery copies.');
current=true;await nodes['.settings-trash-refresh'].fire('click');
holdInspection=true;
const staleContents=list.children[0].querySelector('.settings-trash-contents');
const pendingInspection=list.children[0].querySelector('.settings-trash-title').fire('click');
current=false;finishInspection({entry:{id:'copy-one',items:[{kind:'annotation',excerpt:'Previous account only'}]}});
await pendingInspection;
assert.equal(staleContents.querySelector('ul'),null,'An inspection completed after switching accounts cannot render private content.');
console.log('Compact Trash actions passed: adjacent controls, exact copy identity, typed confirmation, cancel, restore and account fencing.');
