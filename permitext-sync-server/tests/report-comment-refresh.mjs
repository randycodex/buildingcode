import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {reportCommentPresentation,reportCommentKey} from '../public/project-workflow.js';
class Element {
 constructor(){this.children=[];this.dataset={};this.events={};}
 append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
 remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}
 replaceChildren(...children){this.children=[];this.append(...children);}
 addEventListener(name,fn){this.events[name]=fn;}
 querySelectorAll(selector){return this.children.flatMap(child=>[
  ...(selector==='[data-report-comments-for]' ? child.dataset.reportCommentsFor ? [child]:[] : child.className===selector.slice(1)?[child]:[]),
  ...child.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0];}
}
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const panel=new Element(),row=new Element(),host=new Element(),palette=new Element();
row.className='report-draft-block';row.dataset.blockId='b';host.dataset.reportCommentsFor='b';
palette.className='report-source-palette';row.append(host);panel.append(row,palette);
const draft={title:'Unsaved title',blocks:[{id:'b',kind:'evidence',sourceID:'s',excludedCommentKeys:['p']}]};
const original=structuredClone(draft);
const c=vm.createContext({panel,activeDraft:draft,sources:[{id:'s',kind:'evidence',sectionID:1,notes:[{body:'Old comment'}]}],
 document:{createElement:()=>new Element(),createTextNode:text=>Object.assign(new Element(),{textContent:text})},
 reportCommentPresentation,reportCommentKey,disposed:false,requestIdentity:'a',projectID:'p',sourceWarnings:[],
 isCurrentAccountRequest:()=>true,setDirty:()=>{},renderSourcePalette:()=>{},
 reportRequest:async()=>({sources:[{id:'s',kind:'evidence',sectionID:1,notes:[{body:'Updated comment'},{blockID:'p',body:'Excluded passage'}]}]})});
const start=source.indexOf('  function renderIncludedReportComments(');
vm.runInContext(source.slice(start,source.indexOf('  function renderBlockEditor(',start)),c);
const refresh=source.indexOf('  refreshReportSources = async');
vm.runInContext(source.slice(refresh,source.indexOf('  refreshReportArtifacts = async',refresh)),c);
c.refreshIncludedReportComments();row.querySelector('.report-comment-options').open=true;
await c.refreshReportSources();
assert.equal(row.querySelector('.report-comment-options').open,true);
assert.equal(row.querySelector('.report-comment-options').children[0].textContent,'Comments in this Report · 1 of 2');
assert.equal(host.children[0].children[1].textContent,'Updated comment');
assert.equal(host.children.length,1);
assert.deepEqual(draft,original,'Refreshing source comments must preserve the unsaved draft and exclusions');
assert.equal(panel.children[0],row,'Keep the editor node and scroll container mounted');
console.log('Live Report comment refresh passed: new source text and options, retained disclosure, exclusions and unsaved draft.');
