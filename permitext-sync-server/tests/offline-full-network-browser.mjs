// Optional second phase: run while offline-full-corpus-browser retains its profile.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const profile=process.env.OFFLINE_ACCEPTANCE_PROFILE;
if(!profile)throw Error('Set OFFLINE_ACCEPTANCE_PROFILE to the isolated runner directory.');
const port=(await readFile(join(profile,'chrome/DevToolsActivePort'),'utf8')).split('\n')[0];
const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page=targets.find(t=>t.type==='page'&&t.url.includes('/workspace'));
assert(page,'The isolated workspace acceptance page must be open');
async function connect(target){const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map();ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id&&pending.has(m.id)){const [r,j]=pending.get(m.id);pending.delete(m.id);m.error?j(Error(JSON.stringify(m.error))):r(m.result);}};ws.onclose=()=>{for(const [,reject] of pending.values())reject(Error('CDP connection closed'));pending.clear();};return{ws,call(method,params={}){return new Promise((r,j)=>{pending.set(++id,[r,j]);ws.send(JSON.stringify({id,method,params}));});}};}
const clients=[];let timer;
try{
 for(const target of targets.filter(t=>['page','service_worker'].includes(t.type))){const c=await connect(target);clients.push({target,...c});await c.call('Network.enable');await c.call('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});}
 const c=clients.find(c=>c.target.id===page.id);await c.call('Page.enable');
 const start=Date.now();await c.call('Page.navigate',{url:new URL('/workspace',page.url).href});
 const result=await Promise.race([(async()=>{for(let i=0;i<30;i++){
  await new Promise(r=>setTimeout(r,500));
  const r=await c.call('Runtime.evaluate',{expression:`(async()=>{
    if(document.readyState!=='complete'||!document.querySelector('#toggle-search'))return null;
    let networkRejected=false;try{await fetch('/code/revision?fullOfflineProbe='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(5000)});}catch{networkRejected=true;}
    const keys=(await Promise.all((await caches.keys()).map(async n=>(await(await caches.open(n)).keys()).map(r=>r.url)))).flat();
    const moduleURL=keys.find(u=>u.includes('/web/offline-storage.js?'));
    if(!moduleURL)throw Error('Installed offline module missing');
    const {offlineAPI}=await import(moduleURL);
    const sources=(await offlineAPI('/code/libraries')).codeSources;
    const enabled=sources.filter(s=>s.canonicalEdition.includes('/2022-')||s.canonicalEdition.includes('/2014-'));
    const scoped=await offlineAPI('/code/search?'+new URLSearchParams({q:'concrete',version:'all',sourceScope:JSON.stringify({version:1,enabledSources:enabled})}));
    const alloff=await offlineAPI('/code/search?'+new URLSearchParams({q:'concrete',sourceScope:JSON.stringify({version:1,enabledSources:[]})}));
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('permitext-offline',5);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const representatives=await new Promise((resolve,reject)=>{const found=new Map();const r=db.transaction('sections').objectStore('sections').openCursor();r.onerror=()=>reject(r.error);r.onsuccess=()=>{const c=r.result;if(!c)return resolve([...found.values()]);const v=c.value;const source=sources.find(s=>s.canonicalEdition===v.codeVersion&&s.categoryID===v.codeSectionID&&s.codePrefix===v.codePrefix);if(source&&!found.has(JSON.stringify(source)))found.set(JSON.stringify(source),v);c.continue();};});db.close();
    const refs=[];for(const row of representatives){const meta=await offlineAPI('/code/sections/'+row.id+'?include=metadata&version='+encodeURIComponent(row.codeVersion));if(meta.section.codeSource.categoryID!==row.codeSectionID)throw Error('Wrong source');refs.push(row.id);}
    return{networkRejected,shellDOM:true,url:location.pathname,serviceWorkerControlled:!!navigator.serviceWorker.controller,sourceCount:sources.length,representativeMetadataCount:refs.length,scopedConcreteResults:scoped.results.length,alloff:alloff.results.length};
  })()`,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));if(r.result.value)return r.result.value;
 }throw Error('Offline workspace did not load');})(),new Promise((_,j)=>{timer=setTimeout(()=>j(Error('Full offline timeout')),60000);})]);
 assert.equal(result.networkRejected,true);assert.equal(result.shellDOM,true);assert.equal(result.serviceWorkerControlled,true);assert.equal(result.sourceCount,22);assert.equal(result.representativeMetadataCount,22);assert.equal(result.scopedConcreteResults,1232);assert.equal(result.alloff,0);
 result.elapsedSeconds=(Date.now()-start)/1000;result.networkMode='CDP offline on page and running service worker targets; actual workspace navigation via installed service worker';
 await writeFile(join(profile,'result-full-network-offline.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{clearTimeout(timer);for(const c of clients)c.ws.close();}
