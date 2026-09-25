import {createServer} from 'node:http';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
// Opt-in full real corpus install; never part of the default test suite.
// OFFLINE_ACCEPTANCE_PROFILE and OFFLINE_ACCEPTANCE_PORT resume an isolated run.
const root=fileURLToPath(new URL('../',import.meta.url));
const temp=process.env.OFFLINE_ACCEPTANCE_PROFILE || await mkdtemp(join(tmpdir(),'permitext-full-offline-'));
const resume=Boolean(process.env.OFFLINE_ACCEPTANCE_PROFILE);
Object.assign(process.env,{NODE_ENV:'test',VERCEL:'',VERCEL_ENV:'',PERMITEXT_SYNC_DATA_PATH:join(temp,'sync.json'),PERMITEXT_TEST_RESEARCH_MOCK:'1'});
for(const k of ['DATABASE_URL','PERMITEXT_SYNC_DATABASE_URL','POSTGRES_URL','NEON_DATABASE_URL','STORAGE_URL'])delete process.env[k];
const {handleRequest}=await import(root+'/app.mjs');
async function run(){
 const {downloadOfflineLibrary,offlineAPI,offlineLibraryStatus}=await import('/web/offline-storage.js');
 const report=async value=>fetch('/fixture-report',{method:'POST',body:JSON.stringify(value)});
 const start=performance.now();let last=0;
 try{
 const prior=await offlineLibraryStatus();
 if(!prior.available) await downloadOfflineLibrary({onProgress(p){if(performance.now()-last>5000){last=performance.now();report({progress:p,elapsedSeconds:(performance.now()-start)/1000});}}});
 const metadata=await offlineLibraryStatus();await report({installed:metadata,elapsedSeconds:(performance.now()-start)/1000});
 await fetch('/fixture-disable',{method:'POST'});
 const probe=await fetch('/code/revision?offlineAcceptanceProbe='+Date.now(),{cache:'no-store'});
 if(probe.status!==503)throw Error('Code transport was not rejected');
 const sources=(await offlineAPI('/code/libraries')).codeSources;
 if(sources.length!==22)throw Error('Expected all22 sources, got '+sources.length);
 const all=(await offlineAPI('/code/search?q=concrete&version=all')).results;
 const enabled=sources.filter(s=>s.canonicalEdition.includes('/2022-')||s.canonicalEdition.includes('/2014-'));
 const scoped=(await offlineAPI('/code/search?'+new URLSearchParams({q:'concrete',version:'all',sourceScope:JSON.stringify({version:1,enabledSources:enabled})}))).results;
 if(scoped.some(r=>!enabled.some(s=>s.canonicalEdition===r.codeVersion&&s.codePrefix===r.codePrefix)))throw Error('Scope leak');
 const zero=await offlineAPI('/code/search?'+new URLSearchParams({q:'concrete',sourceScope:JSON.stringify({version:1,enabledSources:[]})}));if(zero.results.length)throw Error('Alloff leak');
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('permitext-offline',5);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const representatives=await new Promise((resolve,reject)=>{const found=new Map();const r=db.transaction('sections').objectStore('sections').openCursor();r.onerror=()=>reject(r.error);r.onsuccess=()=>{const c=r.result;if(!c)return resolve([...found.values()]);const v=c.value;const s=sources.find(s=>s.canonicalEdition===v.codeVersion&&s.categoryID===v.codeSectionID&&s.codePrefix===v.codePrefix);if(s&&!found.has(JSON.stringify(s)))found.set(JSON.stringify(s),v);c.continue();};});
 db.close();if(representatives.length!==22)throw Error('Installed source coverage '+representatives.length);
 for(const r of representatives){const m=await offlineAPI(`/code/sections/${r.id}?include=metadata&version=${encodeURIComponent(r.codeVersion)}`);if(m.section.id!==r.id||m.section.blocks)throw Error('Exact metadata mismatch');const b=await offlineAPI(`/code/sections/${r.id}`);if(!Array.isArray(b.section.blocks))throw Error('Body unavailable');}
 await report({complete:true,phase:location.pathname==='/workspace'?'workspace-reload':'postinstall',codeTransportProbe:probe.status,shellDOM:!!document.querySelector('#toggle-search'),sourceCount:sources.length,representatives:representatives.length,allConcreteResults:all.length,scopedConcreteResults:scoped.length,elapsedSeconds:(performance.now()-start)/1000,metadata});
 if(location.pathname!=='/workspace')location.replace('/workspace?offlineAcceptance=1');
 }catch(error){await report({failed:true,error:error.stack,elapsedSeconds:(performance.now()-start)/1000});}
}
let disabled=resume;
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://fixture').pathname;
 if(path==='/fixture'){res.setHeader('Content-Type','text/html');res.end('<script type="module" src="/fixture-runner.js"></script>');return;}
 if(path==='/fixture-runner.js'){res.setHeader('Content-Type','text/javascript');res.end(`(${run.toString()})()`);return;}
 if(path==='/fixture-disable'){disabled=true;res.end('disabled');return;}
 if(path==='/fixture-report'){let text='';for await(const c of req)text+=c;const record=JSON.parse(text);console.log(JSON.stringify({...record,metadata:record.metadata?{chapterCount:record.metadata.chapterCount,sectionCount:record.metadata.sectionCount,downloadedBytes:record.metadata.downloadedBytes}:undefined,installed:record.installed?{chapterCount:record.installed.chapterCount,sectionCount:record.installed.sectionCount,downloadedBytes:record.installed.downloadedBytes}:undefined}));await writeFile(join(temp,record.complete?'result-'+record.phase+'.json':'latest.json'),text);res.end('ok');return;}
 if(disabled&&path.startsWith('/code/')){res.writeHead(503).end('Transport disabled');return;}
 if(path==='/workspace'&&new URL(req.url,'http://fixture').searchParams.has('offlineAcceptance')){const head=res.writeHead.bind(res);res.writeHead=(status,headers)=>{if(headers)for(const key of Object.keys(headers))if(key.toLowerCase()==='content-length')delete headers[key];return head(status,headers);};const end=res.end.bind(res);res.end=(body,...args)=>{return end(String(body).replace('</body>','<script type="module" src="/fixture-runner.js"></script></body>'),...args);};}
 return handleRequest(req,res);
});
await new Promise(resolve=>server.listen(Number(process.env.OFFLINE_ACCEPTANCE_PORT||0),'127.0.0.1',resolve));
const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${temp}/chrome`,'--no-first-run','--no-default-browser-check','--disable-background-networking',`http://127.0.0.1:${server.address().port}/${resume?'workspace?offlineAcceptance=1':'fixture'}`],{stdio:'ignore'});
console.log(JSON.stringify({started:true,pid:process.pid,chromePID:chrome.pid,temp,url:`http://127.0.0.1:${server.address().port}/fixture`}));
const shutdown=()=>{chrome.kill();server.close();process.exit();};
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
