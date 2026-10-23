import {searchWords,searchWordForms,intersect,documentRecord,evaluateSearch,offlineSectionMetadata} from './library-core.js';
import {offlineAssetNamesForChapter,resolveOfflineSectionMetadata} from '/web/offline-storage.js';
const databaseName='permitext-local-library-prototype-v1',assetCache='permitext-local-library-prototype-assets-v1';
let connection,metadata;
const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function db(){if(connection)return connection;const r=indexedDB.open(databaseName,2);r.onupgradeneeded=()=>{for(const name of ['metadata','chapters','sections','postings','search-documents'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name);};connection=await request(r);return connection;}
async function get(store,key){return request((await db()).transaction(store).objectStore(store).get(key));}
async function putBatch(store,values){const tx=(await db()).transaction(store,'readwrite');const s=tx.objectStore(store);for(const [key,value]of values)s.put(value,key);await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Write aborted'));});}
async function fetchJSON(path){const r=await fetch('/prototype/source'+path,{cache:'no-store'});if(!r.ok)throw Error(`Download ${r.status}: ${path}`);return r.json();}
async function install(id){
 if(await get('metadata','active'))throw Error('This isolated prototype already has a library. Reuse it or use a new prototype origin.');
 const started=performance.now(),revision=await fetchJSON('/code/revision');
 const online=await (await fetch('/code/revision')).json();if(online.corpusRevision!==revision.corpusRevision)throw Error('Local and production corpus differ; benchmark would be invalid.');
 const pin='expectedPublicCorpusRevision='+revision.corpusRevision;
 const libraries=await fetchJSON('/code/libraries?'+pin),historical=libraries.libraries.find(x=>x.id==='nyc-2014-construction-codes').syncCodeVersion;
 const indexes=await Promise.all(['/code/chapters?'+pin,'/code/chapters?version='+encodeURIComponent(historical)+'&'+pin].map(fetchJSON));
 const catalog=[...new Map(indexes.flatMap(x=>x.chapters).map(x=>[String(x.id),x])).values()];
 const assetNames=new Set();let bodyBytes=0,sectionCount=0;
 // One complete public chapter at a time: no full-library rich-body array.
 for(let n=0;n<catalog.length;n++){
  const {chapter}=await fetchJSON(`/code/chapters/${catalog[n].id}?include=body&bodyContract=2&${pin}`);
  if(!chapter?.bodyRange?.complete||chapter.bodyRange.total!==chapter.sections.length)throw Error('Incomplete chapter');
  for(const name of offlineAssetNamesForChapter(chapter))assetNames.add(name);
  const records=chapter.sections.map(section=>documentRecord(section,chapter));
  await putBatch('sections',records.map(s=>[s.id,s]));sectionCount+=records.length;
  const manifest={...chapter,sections:chapter.sections.map(({blocks,...s})=>s)};delete manifest.bodyRange;
  await putBatch('chapters',[[String(chapter.id),manifest]]);bodyBytes+=new TextEncoder().encode(JSON.stringify(chapter)).byteLength;
  if(n%10===0||n===catalog.length-1)postMessage({id,progress:{phase:'chapters',completed:n+1,total:catalog.length,sectionCount}});
 }
 const cache=await caches.open(assetCache),names=[...assetNames];let next=0,assetBytes=0,completed=0;
 await Promise.all(Array.from({length:4},async()=>{while(next<names.length){const name=names[next++],path='/code/assets/'+encodeURIComponent(name)+'?assetRevision='+revision.assetRevision;const r=await fetch('/prototype/source'+path);if(!r.ok||r.headers.get('x-permitext-asset-revision')!==revision.assetRevision)throw Error('Figure download/revision failed');const blob=await r.blob();assetBytes+=blob.size;await cache.put(path,new Response(blob,{headers:{'content-type':r.headers.get('content-type'),'x-permitext-asset-revision':revision.assetRevision}}));completed++;if(completed%25===0||completed===names.length)postMessage({id,progress:{phase:'figures',completed,total:names.length}});}}));
 const final=await fetchJSON('/code/revision?'+pin);if(final.corpusRevision!==revision.corpusRevision||final.assetRevision!==revision.assetRevision)throw Error('Corpus changed during installation');
 metadata={revision,libraries,catalog,sectionCount,chapters:catalog.length,assetCount:names.length,bodyBytes,assetBytes,postingBytes:0,termCount:0,installMS:performance.now()-started};
 await putBatch('metadata',[['active',metadata]]);return rebuildIndex(id);
}
async function rebuildIndex(id){
 const m=await active();if(!m)throw Error('Install first');const started=performance.now();
 const current=await fetchJSON('/code/revision');if(current.corpusRevision!==m.revision.corpusRevision)throw Error('Search revision differs from installed passages');
 metadata={...m,indexRevision:0};await putBatch('metadata',[['active',metadata]]);
 const clear=(await db()).transaction(['postings','search-documents'],'readwrite');clear.objectStore('postings').clear();clear.objectStore('search-documents').clear();await new Promise((resolve,reject)=>{clear.oncomplete=resolve;clear.onerror=()=>reject(clear.error);});
 const postings=new Map();let indexBytes=0,documentCount=0;
 for(const family of ['construction','historical2014','zoning','enacted','existingBuilding']){
  const response=await fetch('/prototype/search-documents/'+family),payload=await response.json();if(!response.ok)throw Error(payload.error||'Exact search index unavailable');
  for(const s of payload.sections)s.codeVersion||=m.libraries.libraries.find(l=>l.id==='nyc-2022-construction-codes').syncCodeVersion;
  const exactPostings=await(await fetch('/prototype/search-postings/'+family)).json();
  for(const [token,ids]of exactPostings.postings){if(!postings.has(token))postings.set(token,[]);postings.get(token).push(...ids);}
  for(let start=0;start<payload.sections.length;start+=250)await putBatch('search-documents',payload.sections.slice(start,start+250).map(s=>[s.id,s]));
  documentCount+=payload.sections.length;indexBytes+=new TextEncoder().encode(JSON.stringify(payload)).byteLength;postMessage({id,progress:{phase:'exact search index',completed:documentCount,total:m.sectionCount}});
 }
 let postingBytes=0,batch=[];for(const [token,ids]of postings){const values=Uint32Array.from([...new Set(ids)].sort((a,b)=>a-b));postingBytes+=values.byteLength;batch.push([token,values]);if(batch.length===500){await putBatch('postings',batch);batch=[];}}
 if(batch.length)await putBatch('postings',batch);metadata={...m,indexBytes,postingBytes,termCount:postings.size,indexBuildMS:performance.now()-started,indexRevision:3};postings.clear();await putBatch('metadata',[['active',metadata]]);return metadata;
}
async function active(){metadata||=await get('metadata','active');return metadata;}
async function posting(word,numericPrefix=false){
 const values=new Set(),s=(await db()).transaction('postings').objectStore('postings');
 // Alphabetic completion and singular/plural match the app's word search.
 const range=/^\p{L}{3,}$/u.test(word)||numericPrefix?IDBKeyRange.bound(word,word+'\uffff'):IDBKeyRange.only(word);
 const r=s.openCursor(range);await new Promise((resolve,reject)=>{r.onerror=()=>reject(r.error);r.onsuccess=()=>{const c=r.result;if(!c)return resolve();for(const id of c.value)values.add(id);c.continue();};});
 for(const form of searchWordForms(word))if(form!==word)for(const id of await get('postings',form)||[])values.add(id);
 return [...values].sort((a,b)=>a-b);
}
async function search(url,m,signal){
 const query=url.searchParams.get('q')||'',words=searchWords(query).filter(w=>w.length>=2);if(!words.length)return{query,results:[],totalResults:0};
 const ids=intersect(await Promise.all(words.map(word=>posting(word,words.length===1&&/^[A-Za-z]?\d/.test(query))))),records=[];
 for(let start=0;start<ids.length;start+=64){signal?.throwIfAborted();const tx=(await db()).transaction('search-documents');const store=tx.objectStore('search-documents');for(const item of await Promise.all(ids.slice(start,start+64).map(id=>request(store.get(id)))))if(item)records.push(item);}
 return evaluateSearch(records,url,m.libraries);
}
async function read(path,signal){
 signal?.throwIfAborted();
 const m=await active();if(!m)throw Error('Download the prototype library first');
 const url=new URL(path,self.location.origin),expected=url.searchParams.get('expectedPublicCorpusRevision');
 if(url.pathname==='/code/search'&&m.indexRevision!==3)throw Error('The prototype search index is incomplete. Rebuild it before searching.');
 if(expected&&expected!==m.revision.corpusRevision)return{status:409,payload:{error:'Public corpus changed'},revision:m.revision.corpusRevision};
 let payload;
 if(url.pathname==='/code/revision')payload=m.revision;
 else if(url.pathname==='/code/libraries')payload=m.libraries;
 else if(url.pathname==='/code/chapters'){
  const prefix=url.searchParams.get('code'),version=url.searchParams.get('version');
  const defaultVersion=m.libraries.libraries.find(l=>l.id==='nyc-2022-construction-codes').syncCodeVersion;
  const historicalVersion=m.libraries.libraries.find(l=>l.id==='nyc-2014-construction-codes').syncCodeVersion;
  payload={chapters:m.catalog.map(c=>({...c,codeVersion:c.codeVersion||defaultVersion})).filter(c=>(!prefix||c.codePrefix===prefix)&&(version?version==='all'||c.codeVersion===version:c.codeVersion!==historicalVersion))};
 }else if(/^\/code\/chapters\/[a-zA-Z0-9_-]+$/.test(url.pathname)){
  const chapter=await get('chapters',url.pathname.split('/').at(-1));if(!chapter)return{status:404,payload:{error:'Not installed'}};
  if(url.searchParams.has('readerSearch'))throw Error('Reader-internal Find is outside this prototype; use global Search.');
  const include=url.searchParams.get('include')==='body',limit=Number(url.searchParams.get('bodyLimit')),start=limit?Math.max(0,Number(url.searchParams.get('bodyStart'))||0):0,end=include?Math.min(chapter.sections.length,limit?start+Math.min(50,limit):chapter.sections.length):0;
  if(url.searchParams.get('expectedCorpusRevision')&&url.searchParams.get('expectedCorpusRevision')!==chapter.corpusRevision)return{status:409,payload:{error:'Chapter changed'}};
  const sections=include?await Promise.all(chapter.sections.slice(start,end).map(async s=>({id:s.id,blocks:(await get('sections',s.id))?.blocks||[]}))):chapter.sections;
  payload={chapter:{...chapter,sections,...(include?{bodyRange:{start,end,total:chapter.sections.length,complete:start===0&&end===chapter.sections.length}}:{})}};
 }else if(url.pathname==='/code/search')payload=await search(url,m,signal);
 else if(/^\/code\/sections\/\d+$/.test(url.pathname)){
  const record=await get('sections',Number(url.pathname.split('/').at(-1)));payload=record?{section:{...offlineSectionMetadata(record,m.libraries,url.searchParams.getAll('version')),...(url.searchParams.get('include')==='metadata'?{}:{blocks:record.blocks,schemaVersion:1})}}:null;
 }else if(url.pathname==='/code/sections'){
  const ids=(url.searchParams.get('ids')||'').split(',').filter(Boolean);const sections=await Promise.all(ids.map(async id=>{const r=await get('sections',Number(id));return r?offlineSectionMetadata(r,m.libraries):null;}));payload={sections:sections.filter(Boolean)};
 }else if(url.pathname==='/code/sections/resolve'){
  const tx=(await db()).transaction('sections'),records=await request(tx.objectStore('sections').getAll());payload={section:resolveOfflineSectionMetadata(records,m.libraries,{code:url.searchParams.get('code'),version:url.searchParams.get('version'),sectionNumber:url.searchParams.get('sectionNumber')})};
 }else throw Error('Unsupported public prototype route');
 return{status:payload?200:404,payload:payload||{error:'Not installed'},revision:m.revision.corpusRevision};
}
const jobs=new Map();
onmessage=async({data})=>{const {id,action,path}=data;if(action==='cancel'){jobs.get(data.requestID)?.abort();return;}const controller=new AbortController();jobs.set(id,controller);const started=performance.now();try{let result;if(action==='install')result=await install(id);else if(action==='index')result=await rebuildIndex(id);else if(action==='status')result=await active();else if(action==='read')result=await read(path,controller.signal);else throw Error('Unknown worker action');controller.signal.throwIfAborted();postMessage({id,result,workerMS:performance.now()-started});}catch(error){postMessage({id,error:error.message});}finally{jobs.delete(id);}};
