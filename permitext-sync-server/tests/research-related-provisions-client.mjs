import assert from 'node:assert/strict';
import {createRelatedProvisionReview} from '../public/research-related-provisions.js';
import {findRelatedProvisions} from '../research-related-provisions.mjs';

// Small DOM double exercises actual event handlers, including late async replies.
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.dataset={};this.hidden=false;this.disabled=false;this.isConnected=true;this.value='';this.textContent='';}
 append(...nodes){this.children.push(...nodes);}
 prepend(...nodes){this.children.unshift(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(key,value){this[key]=value;}
 addEventListener(event,handler){this.listeners[event]=handler;}
 querySelectorAll(selector){return this.children.flatMap(child=>[...(selector.split(', ').includes(child.tagName)?[child]:[]),...child.querySelectorAll(selector)]);}
 async fire(event){if(this.disabled)return;await this.listeners[event]?.({target:this,preventDefault(){}});}
}
globalThis.document={createElement:tag=>new Element(tag)};
const nodes=root=>[root,...root.children.flatMap(nodes)];
const control=(root,text)=>nodes(root).find(node=>node.tagName==='button'&&node.textContent===text);
const check=root=>nodes(root).find(node=>node.tagName==='input'&&node.type==='checkbox');
const settle=async predicate=>{for(let i=0;i<50&&!predicate();i++)await new Promise(resolve=>setImmediate(resolve));assert(predicate(),'The UI should settle.');};
const candidate={id:'BC:2022:101.4',sectionID:'parent',codePrefix:'BC',sectionNumber:'101.4',codeVersion:'2022',codeEdition:'2022',title:'Referenced Codes',kind:'parent',reason:'Parent scope'};
const found={question:'medical gas',sourceEditions:[{codeEdition:'2022'}],candidates:[candidate],unresolvedReferences:[],expectedRevision:2,expectedEvidenceSetVersion:1};
let current=true,opened=0,included=[],reviewPayload={selection:{sectionID:'parent',codeVersion:'2022',selectedText:'Exact source text including conditions and footnotes.',sectionTextHash:'hash'}};
const view=createRelatedProvisionReview({isCurrent:()=>current,question:()=> 'Keep my unsent draft.',find:async()=>found,
 openReader:async()=>{opened++;return true;},review:async()=>reviewPayload,include:async(selection,context)=>included.push({selection,context}),onVisibility(){}});
view.open();await settle(()=>Boolean(control(view.element,'Open in Reader')));
assert.equal(check(view.element).disabled,true);assert.equal(control(view.element,'Include selected passages').disabled,true);
await control(view.element,'Inspect exact text').fire('click');
assert.equal(opened,0);assert.equal(included.length,0,'Review never adds evidence.');assert.equal(check(view.element).disabled,false);
check(view.element).checked=true;await check(view.element).fire('change');assert.equal(included.length,0,'Checking a result only stages it.');
const exclude=nodes(view.element).find(node=>node['aria-label']==='Hide candidate titles containing');
exclude.value='Referenced';await exclude.fire('input');assert.equal(control(view.element,'Include selected passages').disabled,true,'Hidden candidates are removed from the staged selection');
exclude.value='';await exclude.fire('input');check(view.element).checked=true;await check(view.element).fire('change');
assert(nodes(view.element).some(node=>node.tagName==='summary'&&node.textContent==='Parent scope · 1'));
await control(view.element,'Include selected passages').fire('click');assert.equal(included.length,1);assert.equal(included[0].selection[0].reviewedSectionHash,'hash');assert.equal(included[0].context.expectedRevision,2);
view.open();await settle(()=>Boolean(control(view.element,'Open in Reader')));
reviewPayload={selection:{...reviewPayload.selection,codeVersion:'2014'}};
await control(view.element,'Open in Reader').fire('click');assert.equal(check(view.element).disabled,true,'A mismatched edition cannot be selected.');
reviewPayload={requiresVisualReview:true,selection:{...reviewPayload.selection,codeVersion:'2022'}};
await control(view.element,'Open in Reader').fire('click');assert.equal(check(view.element).disabled,true,'Visual evidence retains its separate Reader review.');
let finish;
const late=createRelatedProvisionReview({isCurrent:()=>current,question:()=>'',find:()=>new Promise(resolve=>finish=resolve),onVisibility(){}});
late.open();current=false;finish(found);await new Promise(resolve=>setImmediate(resolve));
assert.equal(control(late.element,'Open in Reader'),undefined,'A stale account/workspace result cannot populate the UI.');current=true;
late.open();late.close();finish(found);await new Promise(resolve=>setImmediate(resolve));assert(late.element.hidden);

const registry=[{id:'current',codeVersion:'2022',codeYear:2022,codeEdition:'2022',codePrefixes:['BC','PC'],automaticResearchEligible:true},
 {id:'old',codeVersion:'2014',codeYear:2014,codeEdition:'2014',codePrefixes:['BC','PC'],automaticResearchEligible:true}];
const catalog=[{id:'current-parent',codePrefix:'BC',sectionNumber:'101.4',codeVersion:'2022'},
 {id:'old-parent',codePrefix:'BC',sectionNumber:'101.4',codeVersion:'2014'},
 {id:'child-fallback',codePrefix:'PC',sectionNumber:'999.1.1',codeVersion:'2022'}];
const output=await findRelatedProvisions({conversation:{revision:2,sources:[{kind:'selection',codePrefix:'BC',sectionNumber:'101.4.4',codeVersion:'2022',selectedText:'See PC Section 999.1.'},
 {kind:'selection',codePrefix:'BC',sectionNumber:'101.4.4',codeVersion:'2014',selectedText:'Prior edition scope.'}]},question:'medical gas',registry,
 resources:async()=>({catalog,invertedIndex:new Map()}),discover:async()=>({candidates:[]})});
assert.equal(output.candidates.length,2,'Distinct editions of a parent remain separate.');
assert(output.unresolvedReferences.some(item=>item.sectionNumber==='999.1'),'A child section does not replace an unavailable exact reference.');
const mixed=await findRelatedProvisions({conversation:{sources:[
 {kind:'selection',codePrefix:'FC',sectionNumber:'100.1',codeVersion:'shared-snapshot',selectedText:'Current Fire Code text.'},
 {kind:'selection',codePrefix:'BC68',sectionNumber:'27-101',codeVersion:'shared-snapshot',selectedText:'See FC Section 999.1.'}]},question:'historical fire reference',
 registry:[{id:'fire',codeVersion:'shared-snapshot',codeYear:2022,codePrefixes:['FC']},{id:'historic',codeVersion:'shared-snapshot',codeYear:1968,codePrefixes:['BC68']}],
 resources:async()=>({catalog:[{id:'fc',codePrefix:'FC',codeVersion:'shared-snapshot',sectionNumber:'999.1'}]}),discover:async()=>({candidates:[]})});
assert.equal(mixed.candidates.length,0,'A shared storage snapshot does not make different code years interchangeable.');
assert(mixed.unresolvedReferences.some(item=>item.sectionNumber==='999.1'));
delete globalThis.document;
console.log('Related-provision UI: review before select, explicit include, exact edition/visual checks, stale response isolation and source-bound discovery passed.');
