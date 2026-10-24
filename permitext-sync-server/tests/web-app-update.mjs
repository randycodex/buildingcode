import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createWebAppUpdatePrompt,activateWebAppUpdate} from '../public/web-app-update.js';
import {webAppVersion,webSyncProtocol,webSyncProtocolHeader,webUpdateRequiredCode} from '../public/web-client-version.js';
class Element {constructor(tag){this.tag=tag;this.children=[];this.events={};this.hidden=false;}setAttribute(){}append(...children){this.children.push(...children);}addEventListener(type,callback){this.events[type]=callback;}}
function harness() {
 const body=new Element('body');body.inert=false;let ready=true,activations=0,reloads=0,fail=false;
 const controller=createWebAppUpdatePrompt({document:{body,createElement:tag=>new Element(tag)},currentVersion:'current',
  prepareReload:async()=>ready,activate:async()=>{activations++;assert.equal(body.inert,true);if(fail)throw Error('Close other Permitext tabs');},location:{reload:()=>reloads++}});
 return {controller,body,setReady:value=>ready=value,setFailure:()=>fail=true,counts:()=>({activations,reloads}),notice:()=>body.children[0]};
}
{
 const h=harness();h.controller.observe('current');assert.equal(h.body.children.length,0);
 h.controller.observe('next');assert.equal(h.notice().hidden,false);
 h.notice().children[2].events.click();h.controller.observe('next');assert.equal(h.notice().hidden,true,'Later does not nag on every version probe');
 h.controller.requireReload('next');assert.equal(h.notice().hidden,false);
 h.setReady({message:'Save first'});assert.equal(await h.controller.reload(),false);assert.equal(h.notice().children[0].textContent,'Save first');assert.deepEqual(h.counts(),{activations:0,reloads:0});assert.equal(h.body.inert,false);
 h.setReady(true);assert.equal(await h.controller.reload(),true);assert.deepEqual(h.counts(),{activations:1,reloads:1});
}
{
 const h=harness();h.controller.observe('next');h.setFailure();assert.equal(await h.controller.reload(),false);assert.equal(h.body.inert,false);assert.equal(h.counts().reloads,0);assert.match(h.notice().children[0].textContent,/other Permitext tabs/);
}
class Channel {constructor(){this.port1={close(){}};this.port2={close(){},postMessage:data=>this.port1.onmessage?.({data})};}}
for(const otherTabs of [false,true]) {
 const listeners=new Set();let checks=0;
 const worker={state:'installed',addEventListener:(name,fn)=>listeners.add(fn),removeEventListener:(name,fn)=>listeners.delete(fn),postMessage(message,ports){assert.equal(message.type,'PERMITEXT_ACTIVATE_UPDATE');ports[0].postMessage({ready:!otherTabs,reason:'other-tabs'});if(!otherTabs){this.state='activated';listeners.forEach(fn=>fn());}}};
 const pending=activateWebAppUpdate({serviceWorker:{getRegistration:async()=>({waiting:worker,update:async()=>checks++})},MessageChannelClass:Channel,timeoutMS:30});
 if(otherTabs)await assert.rejects(pending,/Close other Permitext tabs/);else await pending;
 assert.equal(checks,1);
}
// Run the actual worker message handler, including the multi-tab refusal.
const workerSource=await readFile(new URL('../public/service-worker.js',import.meta.url),'utf8');
const start=workerSource.indexOf('self.addEventListener("message"'),end=workerSource.indexOf('\n});',start)+4;
for(const otherTabs of [false,true]) {
 let handler,promise,activated=0;const replies=[];
 vm.runInNewContext(workerSource.slice(start,end),{self:{addEventListener:(type,fn)=>handler=fn,clients:{matchAll:async()=>otherTabs?[{id:'current'},{id:'editing-elsewhere'}]:[{id:'current'}]},skipWaiting:async()=>activated++}});
 handler({data:{type:'PERMITEXT_ACTIVATE_UPDATE'},source:{id:'current'},ports:[{postMessage:value=>replies.push(value)}],waitUntil:value=>promise=value});await promise;
 assert.equal(replies[0].ready,!otherTabs);assert.equal(activated,otherTabs?0:1);
}

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const entry=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
assert(entry.includes(`/web/app.js?v=${webAppVersion}`),'Server release metadata must match the shipped app');
assert(source.includes(`./web-client-version.js?v=${webAppVersion}`),'The app must import its own immutable release metadata');
// Exercise the real client transport, including the version response. A stale
// response must still pass the account fence before displaying a reload prompt.
{
 const prompts=[],requests=[];let current=true;
 const start=source.indexOf('async function postJSON('),end=source.indexOf('\n}',start)+2;
 const context=vm.createContext({webSyncProtocol,webSyncProtocolHeader,webUpdateRequiredCode,
  webAppUpdates:{requireReload:version=>prompts.push(version)},serverReachable:true,
  requirePrivateWorkspaceWritable(){},captureAccountRequest:()=>({userID:'owner',sessionToken:'session'}),
  requireCurrentAccountRequest(){if(!current)throw Error('Account changed');},updateConnectionStatus(){},
  fetch:async(path,options)=>{requests.push({path,options});return {ok:false,status:426,json:async()=>({code:webUpdateRequiredCode,webAppVersion:'next',error:'Reload required'})};}});
 vm.runInContext(source.slice(start,end),context);
 await assert.rejects(context.postJSON('/sync/checkpoint',{}, {token:'session'}),error=>error.status===426);
 assert.equal(requests[0].options.headers[webSyncProtocolHeader],webSyncProtocol);
 assert.equal(requests[0].options.headers.Authorization,'Bearer session');
 assert.deepEqual(prompts,['next']);
 current=false;
 await assert.rejects(context.postJSON('/sync/checkpoint'),/Account changed/);
 assert.deepEqual(prompts,['next'],'An obsolete account response cannot open the update prompt');
}
const first=source.indexOf('async function prepareWebAppReload('),last=source.indexOf('\n}',first)+2;
for(const scenario of ['clean','draft','image','dirty','research','race','storage','anonymous']) {
 const c=vm.createContext({captureAccountRequest:()=>({userID:scenario==='anonymous'?'':'owner'}),projectUpdateEditingGeneration:1,
  workspaceRestoreError:null,workspaceMigrationError:null,activeResearchProgress:new Set(scenario==='research'?['pending']:[]),notebookColumnMounts:new Map([['note',{persistDraft:async()=>{if(scenario==='race')c.projectUpdateEditingGeneration++;}}]]),
  flushSearchQueryPersistence(){},flushResearchDraftPersistence(){},saveWorkspaceState(){if(scenario==='storage')throw Error('Quota');},persistCodeQuestionAccountState(){},
  pendingNotebookDrafts:async()=>scenario==='draft'?[{}]:[],pendingNotebookImages:async()=>scenario==='image'?[{}]:[],isCurrentAccountRequest:()=>true,
  projectUpdateAutoApplyBlocker:()=>scenario==='dirty'?'review':scenario==='anonymous'?'unavailable':'',
  confirmWorkspaceTransition:()=>assert.fail('Reload cannot discard edits'),fetch:()=>assert.fail('Reload preparation cannot poll')});
 vm.runInContext(source.slice(first,last),c);const result=await c.prepareWebAppReload();
 if(['clean','anonymous'].includes(scenario))assert.equal(result,true);else assert.equal(typeof result.message,'string',scenario);
}
console.log('App reload passed: prompt/dismissal, pending work and storage failures, images, active Research, editing races, explicit worker activation, other-tab refusal, preserved input and no automatic reload.');
