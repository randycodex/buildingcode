// Loaded only by the loopback experiment's replacement app entry.
const mode=sessionStorage.getItem('libraryPrototypeMode')||'network';
const worker=mode==='local'?new Worker('/prototype/library-worker.js',{type:'module'}):null;
let sequence=0;const pending=new Map();
if(worker)worker.onmessage=({data})=>{if(data.progress)return;const item=pending.get(data.id);if(!item)return;pending.delete(data.id);data.error?item.reject(Error(data.error)):item.resolve(data);};
const rpc=(action,path,signal)=>new Promise((resolve,reject)=>{const id=++sequence;signal?.throwIfAborted();const abort=()=>{pending.delete(id);worker.postMessage({action:'cancel',requestID:id});reject(signal.reason||new DOMException('Cancelled','AbortError'));};const cleanup=()=>signal?.removeEventListener('abort',abort);signal?.addEventListener('abort',abort,{once:true});pending.set(id,{resolve:value=>{cleanup();resolve(value);},reject:error=>{cleanup();reject(error);}});worker.postMessage({id,action,path});});
if(worker&&!(await rpc('status')).result)throw Error('Local prototype library is not installed');
const send=sample=>parent.postMessage({libraryPrototype:true,mode,...sample},location.origin);
const originalFetch=window.fetch.bind(window);
const publicRoute=p=>/^\/code\/(?:revision|libraries|chapters(?:\/[a-zA-Z0-9_-]+)?|sections(?:\/(?:\d+|resolve))?|search)$/.test(p);
window.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href),method=options.method||input.method||'GET';
 if(url.origin!==location.origin||method!=='GET')return originalFetch(input,options);
 if(mode==='local'&&url.pathname.startsWith('/code/assets/')){const cached=await caches.match(url.pathname+url.search,{cacheName:'permitext-local-library-prototype-assets-v1'});if(!cached)throw Error('Prototype figure is not installed');return cached;}
 if(!publicRoute(url.pathname))return originalFetch(input,options);
 const started=performance.now();let response,workerMS=null;
 if(worker){options.signal?.throwIfAborted();const result=await rpc('read',url.pathname+url.search,options.signal);options.signal?.throwIfAborted();workerMS=result.workerMS;response=new Response(JSON.stringify(result.result.payload),{status:result.result.status,headers:{'content-type':'application/json','x-permitext-corpus-revision':result.result.revision||''}});}
 else response=await originalFetch(input,options);
 send({kind:'public-request',path:url.pathname,query:url.searchParams.get('q')||'',durationMS:performance.now()-started,workerMS,status:response.status});return response;
};
let searchPending=null,readerPending=null,frame=false;
document.addEventListener('input',event=>{if(event.target.matches('.search-input'))searchPending={started:performance.now(),query:event.target.value};},true);
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.matches('.search-open-new-reader')||button.getAttribute('aria-label')==='Reader'||button.textContent.trim()==='Reader')readerPending={started:performance.now(),ids:new Set([...document.querySelectorAll('.reader-panel[data-reader-id]')].map(p=>p.dataset.readerId))};
},true);
const inspect=()=>{
 if(frame)return;
 const results=[...document.querySelectorAll('.search-panel:not(.is-workflow-hidden) .search-results[data-search-render-token][data-restoring-search="false"]')].find(p=>p.closest('.search-panel').querySelector('.search-input')?.value===searchPending?.query);
 const reader=readerPending?[...document.querySelectorAll('.reader-panel[data-reader-id]')].find(p=>!readerPending.ids.has(p.dataset.readerId)&&p.querySelector('.reader-content .chapter-section')&&p.querySelector('.is-source-target')):null;
 if(!results&&!reader)return;
 frame=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{
  frame=false;if(results&&searchPending){send({kind:'search-render',query:searchPending.query,durationMS:performance.now()-searchPending.started,rows:results.querySelectorAll('.result-row-main').length});searchPending=null;}
  if(reader&&readerPending){send({kind:'reader-render',durationMS:performance.now()-readerPending.started,chapter:reader.querySelector('.chapter-select')?.value});readerPending=null;}
 }));
};
new MutationObserver(inspect).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-restoring-search','data-search-render-token','data-reader-content-key']});
window.addEventListener('pagehide',()=>worker?.terminate(),{once:true});
send({kind:'mode-ready'});
