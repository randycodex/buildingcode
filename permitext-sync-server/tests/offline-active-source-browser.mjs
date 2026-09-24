// Real Chrome + IndexedDB, seeded installed snapshot; not full installer acceptance.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {activeCodeSourceCatalog} from '../active-code-source-catalog.mjs';
const catalog=await activeCodeSourceCatalog();
const sources=[catalog.find(x=>x.codePrefix==='BC'&&x.canonicalEdition.includes('/2022-')),catalog.find(x=>x.codePrefix==='BC'&&x.canonicalEdition.includes('/2014-')),catalog.find(x=>x.codePrefix==='BC68')];
assert(sources.every(Boolean));
async function browserRun(sources) {
  const {offlineAPI:offlineApiFetch,offlineLibraryStatus}=await import('/offline-storage.js');
  const check=(ok,label)=>{if(!ok)throw Error(label);};
  const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await offlineLibraryStatus(); // Production creates the real schema.
  const db=await request(indexedDB.open('permitext-offline',5));
  const installID='synthetic-perf18';
  const ids=[1,41000001,15000001];
  const rows=sources.map((s,i)=>({key:`${installID}:${ids[i]}`,installID,id:ids[i],sectionID:ids[i],identities:[`${installID}:${ids[i]}`],chapterID:i+10,codePrefix:s.codePrefix,codeVersion:s.canonicalEdition,codeSectionID:s.categoryID,chapterNumber:'1',sectionNumber:'101.1',title:'Synthetic concrete',plainText:'Synthetic concrete enacted fixture',searchText:'101.1 synthetic concrete enacted fixture',blocks:[{plainText:'Synthetic concrete enacted fixture'}]}));
  const metadata={key:'active-library',installID,librarySchemaVersion:3,codeSources:sources,libraries:[],downloadedAt:'2026-09-24'};
  const write=async(stores,fn)=>{const t=db.transaction(stores,'readwrite');fn(t);await new Promise((resolve,reject)=>{t.oncomplete=resolve;t.onerror=()=>reject(t.error);});};
  await write(['metadata','sections','chapters'],t=>{t.objectStore('metadata').put(metadata);for(const r of rows){t.objectStore('sections').put(r);t.objectStore('chapters').put({key:`${installID}:${r.chapterID}`,installID,chapter:{id:r.chapterID,codeVersion:r.codeVersion,codePrefix:r.codePrefix,codeSectionID:r.codeSectionID}});}});
  const snapshot=async()=>JSON.stringify(await Promise.all(['metadata','sections','chapters'].map(name=>request(db.transaction(name).objectStore(name).getAll()))));
  const before=await snapshot();
  const scope=enabledSources=>JSON.stringify({version:1,enabledSources});
  const search=async(enabledSources)=>offlineApiFetch('/code/search?'+new URLSearchParams({q:'concrete',sourceScope:scope(enabledSources)}));
  check((await search(sources)).results.length===3,'all editions');
  const selected=await search(sources.slice(0,2));check(selected.results.length===2&&!selected.results.some(x=>x.codePrefix==='BC68'),'disabled 1968 excluded');
  check((await search([])).results.length===0,'all off');
  for(let i=0;i<3;i++){
    const s=sources[i];
    const exact=await offlineApiFetch('/code/sections/resolve?'+new URLSearchParams({include:'metadata',code:s.codePrefix,version:s.canonicalEdition,sectionNumber:'101.1'}));
    check(exact.section.id===ids[i]&&!('blocks'in exact.section),'exact metadata edition identity without body');
    const byID=await offlineApiFetch(`/code/sections/${ids[i]}?`+new URLSearchParams({include:'metadata',version:s.canonicalEdition}));check(byID.section.codeSource.categoryID===s.categoryID,'ID metadata');
  }
  check(await snapshot()===before,'reads preserve installed snapshot');
  await write(['metadata'],t=>t.objectStore('metadata').put({...metadata,codeSources:undefined}));
  const old=await snapshot();let rejected=false;try{await search(sources.slice(0,2));}catch{rejected=true;}check(rejected,'unknown metadata does not broaden');
  check((await search([])).results.length===0,'alloff old metadata');
  rejected=false;try{await offlineApiFetch('/code/sections/1?include=metadata');}catch{rejected=true;}check(rejected,'unknown metadata cannot navigate');
  check(await snapshot()===old,'old snapshot preserved on errors');db.close();
  return {passed:true,records:3,checks:['scoped-search','alloff','exact-number-and-id-metadata','metadata-only','unknown-metadata-fail-closed','snapshot-preservation'],method:'seeded installed snapshot; real Chrome IndexedDB; production offlineAPI; not full installer acceptance'};
}
let finish;const result=new Promise(resolve=>finish=resolve);
const publicRoot=new URL('../public/',import.meta.url);
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://fixture').pathname;try{
 if(path==='/result'&&req.method==='POST'){let text='';for await(const chunk of req)text+=chunk;finish(JSON.parse(text));res.end('ok');return;}
 if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<script type="module" src="/runner.js"></script>');return;}
 if(path==='/runner.js'){res.setHeader('Content-Type','text/javascript');res.end(`(${browserRun.toString()})(${JSON.stringify(sources)}).then(result=>fetch('/result',{method:'POST',body:JSON.stringify(result)})).catch(error=>fetch('/result',{method:'POST',body:JSON.stringify({passed:false,error:error.stack})}));`);return;}
 if(!/^\/[a-z0-9-]+\.js$/.test(path)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type','text/javascript');res.end(await readFile(new URL('.'+path,publicRoot)));
 }catch(error){res.writeHead(500).end(String(error));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const profile=await mkdtemp(join(tmpdir(),'permitext-offline-scope-'));
const chrome=spawn(process.env.CHROME_BINARY||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-networking',`http://127.0.0.1:${server.address().port}`],{stdio:'ignore'});
const exited=new Promise(resolve=>{chrome.once('exit',resolve);chrome.once('error',resolve);});
const launchFailure=new Promise((_,reject)=>chrome.once('error',reject));
let timer;
try{const output=await Promise.race([result,launchFailure,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Browser timeout')),30000);})]);assert.equal(output.passed,true,output.error);console.log(JSON.stringify(output,null,2));}
finally{clearTimeout(timer);chrome.kill();await exited;await new Promise(resolve=>server.close(resolve));await rm(profile,{recursive:true,force:true});}
