import { evidenceCommentsText } from "../public/evidence-comments.js";
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
const c=vm.createContext({reportSourcesRefreshGeneration:0,evidenceCommentsText,panel,activeDraft:draft,sources:[{id:'s',kind:'evidence',sectionID:1,notes:[{body:'Old comment'}]}],
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

// An earlier deletion response must not overwrite a later Undo response.
const pendingSources=[];
c.reportRequest=()=>new Promise(resolve=>pendingSources.push(resolve));
const beforeUndo=c.refreshReportSources();
const afterUndo=c.refreshReportSources();
pendingSources[1]({sources:[{id:'s',kind:'evidence',sectionID:1,notes:[{body:'Restored by Undo'}]}]});
await afterUndo;
pendingSources[0]({sources:[{id:'s',kind:'evidence',sectionID:1,notes:[]}]});
await beforeUndo;
assert.equal(c.sources[0].notes[0]?.body,'Restored by Undo','A delayed deletion response must not remove the restored comment');
assert.deepEqual(draft,original,'Out-of-order refreshes preserve the unsaved Report draft');
console.log('Report comment delete/Undo refreshes retain the newest response when requests finish out of order.');

// A slower full Report refresh must also preserve a newer comment refresh.
c.deletingReport=false;c.deletingVersionID=null;c.historyMutationGeneration=0;c.dirty=true;
vm.runInContext(source.slice(source.indexOf('  refreshReportArtifacts = async'),source.indexOf('\n  try {',source.indexOf('  refreshReportArtifacts = async'))),c);
const artifactResponses=[];
c.reportRequest=()=>new Promise(resolve=>artifactResponses.push(resolve));
const olderArtifacts=c.refreshReportArtifacts();
const newerComments=c.refreshReportSources();
artifactResponses[3]({sources:[{id:'s',kind:'evidence',sectionID:1,notes:[{body:'Newest restored comment'}]}]});
await newerComments;
artifactResponses[0]({drafts:[]});artifactResponses[1]({sources:[{id:'s',kind:'evidence',sectionID:1,notes:[]}]});artifactResponses[2]({reports:[]});
await olderArtifacts;
assert.equal(c.sources[0].notes[0]?.body,'Newest restored comment');
assert.deepEqual(draft,original);
c.reportRequest=async()=>({sources:[{id:'s',kind:'evidence',sectionID:1,notes:[]}]});
await c.refreshReportSources();
assert.equal(host.children.length,0,'Deleting the last comment clears the included comment preview');
assert.equal(row.querySelector('.report-comment-options'),undefined,'No stale comment inclusion options remain');
c.reportRequest=async()=>({sources:[{id:'s',kind:'evidence',sectionID:1,notes:[{body:'Restored final comment'}]}]});
await c.refreshReportSources();
assert.equal(host.children[0].children[1].textContent,'Restored final comment');
assert.deepEqual(draft,original);
console.log('Full-refresh ordering and final-comment deletion/Undo retain current comments without changing the Report draft.');

const activation=source.slice(source.indexOf('async function openProjectReportDraft('),source.indexOf('\nasync function closeProjectCoordination('));
const events=[];
const activationContext=vm.createContext({projectIdentity:p=>p,hasCapability:()=>true,projectDetailMatches:()=>true,
 workspaceProject:()=>({}),closeSharedWorkspaceViews:()=>{},projectDetailKey:()=> 'p',
 reportScreen:{projectID:'p',isCurrent:()=>true,open:async()=>events.push('open')},pendingReportDraftByProject:new Map(),
 syncProjectToolButtonStates:()=>{},updateWorkspaceLayoutControls:()=>{},reportDraftMounts:new Map([['p',{refreshSources:async()=>events.push('refresh')}]] )});
vm.runInContext(activation,activationContext);
assert.equal(await activationContext.openProjectReportDraft({}),true);
assert.deepEqual(events,['open','refresh'],'Reopening a retained Report requests current source comments');

const schedule=source.slice(source.indexOf('function scheduleAnnotationPush('),source.indexOf('\nfunction pendingAnnotationNoteForTarget('));
for(const fail of [false,true]) {
 let callback,refreshCount=0;
 const context=vm.createContext({captureAccountRequest:()=> 'a',activeAccount:()=>({}),annotationMutationForRecord:r=>r,
 enqueueSyncMutation:()=>{},clearTimeout:()=>{},annotationPushTimers:new Map(),window:{setTimeout:fn=>{callback=fn;return 1}},
 requireCurrentAccountRequest:()=>{},isCurrentAccountRequest:()=>true,pushMutation:async()=>{if(fail)throw Error('Offline')},
 state:{localAnnotations:[]},saveWorkspaceState:()=>{},refreshOpenSavedPanes:async()=>{},refreshVisibleSyncedDerivedState:()=>{},
 refreshProjectSourceConsumers:async()=>{refreshCount++}});
 vm.runInContext(schedule,context);
 context.scheduleAnnotationPush({id:'n',syncFields:['noteBody']});await callback();
 assert.equal(refreshCount,fail?0:1,'Only a successful source-comment push refreshes the mounted Report');
}
console.log('Report activation and successful annotation sync both refresh mounted source comments.');
