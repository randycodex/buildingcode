// Loopback-only experiment. The normal 8788 process and production are unchanged.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile, mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deserialize} from 'node:v8';
const here=fileURLToPath(new URL('./',import.meta.url));
const root=resolve(here,'../..');
const port=Number(process.env.LIBRARY_PROTOTYPE_PORT||8793);
const fixturePort=Number(process.env.LIBRARY_PROTOTYPE_FIXTURE_PORT||8794);
const onlinePort=Number(process.env.LIBRARY_PROTOTYPE_ONLINE_PORT||8795);
const source='http://127.0.0.1:8788';
const fixture=`http://127.0.0.1:${fixturePort}`;
const directory=process.env.LIBRARY_PROTOTYPE_DATA_DIR||await mkdtemp(join(tmpdir(),'permitext-library-prototype-'));
const syntheticDir=join(directory,'synthetic');
await mkdir(syntheticDir,{recursive:true});
const child=spawn(process.execPath,['tests/populated-workspace-performance-fixture.mjs','--port',String(fixturePort),'--profile','small','--keep-alive','true','--data-dir',syntheticDir],{cwd:root,stdio:['ignore','pipe','pipe']});
let ready=false;
child.stdout.on('data',()=>{});
child.stderr.on('data',bytes=>{if(!ready)process.stderr.write(bytes);});
child.on('exit',code=>{if(code)console.error('Synthetic fixture exited',code);});
let receipt;
for(let attempt=0;attempt<120;attempt++){
 try{receipt=JSON.parse(await readFile(join(syntheticDir,'preview.json'),'utf8'));await fetch(fixture+'/health');ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}
}
if(!ready)throw Error('Synthetic fixture did not start');
const noStore={'cache-control':'no-store','x-content-type-options':'nosniff','cross-origin-opener-policy':'same-origin','cross-origin-embedder-policy':'require-corp'};
const sendJSON=(res,value,status=200)=>{res.writeHead(status,{...noStore,'content-type':'application/json'});res.end(JSON.stringify(value));};
const publicPath=p=>/^\/code\/(?:revision|libraries|chapters(?:\/[a-zA-Z0-9_-]+)?|sections(?:\/(?:\d+|resolve))?|search|assets\/[a-zA-Z0-9._-]+)$/.test(p);
async function proxy(req,res,upstream,path,transform){
 const body=['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(await Array.fromAsync(req));
 const omitted=['host','connection','accept-encoding','content-length'];
 if(upstream==='https://permitext.com'||path.startsWith('/code/'))omitted.push('authorization','cookie','referer','origin');
 const headers={};for(const [key,value]of Object.entries(req.headers))if(!omitted.includes(key))headers[key]=value;
 const response=await fetch(upstream+path,{method:req.method,headers,body,redirect:'manual'});
 const outputHeaders={...Object.fromEntries(response.headers),...noStore};
 // Only this loopback clone is embedded in the comparison dashboard.
 outputHeaders['x-frame-options']='SAMEORIGIN';
 if(outputHeaders['content-security-policy'])outputHeaders['content-security-policy']=outputHeaders['content-security-policy'].replace(/frame-ancestors[^;]*/g,"frame-ancestors 'self'");
 for(const key of ['content-encoding','content-length','transfer-encoding','connection'])delete outputHeaders[key];
 let output=Buffer.from(await response.arrayBuffer());
 if(transform)output=Buffer.from(transform(output.toString('utf8')));
 res.writeHead(response.status,outputHeaders);res.end(output);
}
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://loopback');
  if(url.pathname==='/prototype/config')return sendJSON(res,{fixture:'synthetic-only',publicOnline:'https://permitext.com',downloadSource:source,outputDirectory:directory});
  const searchDocuments=url.pathname.match(/^\/prototype\/search-documents\/(construction|historical2014|zoning|enacted|existingBuilding)$/);
  if(searchDocuments){
   const directory=join(root,'generated/search-catalogs');
   const [catalog,index,text]=await Promise.all([readFile(join(directory,searchDocuments[1]+'.json'),'utf8').then(JSON.parse),readFile(join(directory,'search-text.json'),'utf8').then(JSON.parse),readFile(join(directory,'search-text.utf8'))]);
   return sendJSON(res,{sections:catalog.sections.map(section=>{const key=`${section.codeVersion||''}:${section.codePrefix}:${section.webSectionID||section.id}`,range=index.records[key];if(!range)throw Error('Exact search text missing');return{...section,plainText:text.subarray(range[0],range[0]+range[1]).toString('utf8')};})});
  }
  const searchPostings=url.pathname.match(/^\/prototype\/search-postings\/(construction|historical2014|zoning|enacted|existingBuilding)$/);
  if(searchPostings){
   const directory=join(root,'generated/search-catalogs'),family=searchPostings[1];
   const [runtime,bytes]=await Promise.all([readFile(join(directory,family+'.runtime')).then(deserialize),readFile(join(directory,family+'.postings'))]);
   const words=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.length/4),postings=[];let begin=0;
   for(const [tokens,ends]of [[runtime.tokens,runtime.ends],[runtime.aliasTokens,runtime.aliasEnds]])for(let n=0;n<tokens.length;n++){postings.push([tokens[n],Array.from(words.subarray(begin,ends[n]))]);begin=ends[n];}
   return sendJSON(res,{family,postings});
  }
  if(url.pathname==='/prototype/result'&&req.method==='POST'){
   const text=Buffer.concat(await Array.fromAsync(req)).toString();if(text.length>2_000_000)return sendJSON(res,{error:'Result too large'},413);
   const result=JSON.parse(text);await writeFile(join(directory,'results.json'),JSON.stringify(result,null,2));return sendJSON(res,{saved:true});
  }
  if(url.pathname==='/prototype/start'){
   const mode=url.searchParams.get('mode');if(!['network','local'].includes(mode))return sendJSON(res,{error:'Unknown mode'},400);
   return proxy(req,res,fixture,`/fixture/start?key=${encodeURIComponent(receipt.capability)}`,html=>html.replace('<script>',`<script>sessionStorage.setItem('libraryPrototypeMode',${JSON.stringify(mode)});`));
  }
  if(url.pathname.startsWith('/prototype/source/')){
   const target=url.pathname.slice('/prototype/source'.length);
   if(req.method!=='GET'||!publicPath(target))return sendJSON(res,{error:'Public GET only'},403);
   return proxy(req,res,source,target+url.search);
  }
  if(url.pathname==='/prototype/app-entry.js'){
   const entry=url.searchParams.get('entry');if(!/^\/web\/app\.js\?v=[a-zA-Z0-9-]+$/.test(entry||''))return sendJSON(res,{error:'Invalid entry'},400);
   res.writeHead(200,{...noStore,'content-type':'text/javascript'});return res.end(`await import('/prototype/bridge.js');await import(${JSON.stringify(entry)});`);
  }
  if(url.pathname==='/prototype'||url.pathname.startsWith('/prototype/')){
   const name=url.pathname==='/prototype'?'index.html':url.pathname.slice('/prototype/'.length);
   if(!/^[a-z-]+\.(?:html|js|css)$/.test(name))return sendJSON(res,{error:'Unknown prototype file'},404);
   const bytes=await readFile(join(here,'public',name));res.writeHead(200,{...noStore,'content-type':name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript'});return res.end(bytes);
  }
  if(url.pathname.startsWith('/code/')){
   if(req.method!=='GET'||!publicPath(url.pathname))return sendJSON(res,{error:'Public GET only'},403);
   return proxy(req,res,'https://permitext.com',url.pathname+url.search);
  }
  if(url.pathname==='/workspace')return proxy(req,res,fixture,url.pathname+url.search,html=>html.replace(/src="(\/web\/app\.js\?v=[a-zA-Z0-9-]+)"/,(_,entry)=>`src="/prototype/app-entry.js?entry=${encodeURIComponent(entry)}"`));
  if(url.pathname.startsWith('/fixture/'))return sendJSON(res,{error:'Fixture controls are private to the experiment'},403);
  return proxy(req,res,fixture,url.pathname+url.search);
 }catch(error){console.error(error.message);if(!res.headersSent)sendJSON(res,{error:error.message},500);else res.end();}
});
server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({ready:true,url:`http://127.0.0.1:${port}/prototype`,directory,fixturePort})));
// A different origin establishes a genuine zero-download baseline, with the
// identical application, fixture backend, production proxy and instrumentation.
const onlineServer=createServer(server.listeners('request')[0]);
onlineServer.listen(onlinePort,'127.0.0.1');
const stop=()=>{child.kill();onlineServer.close();server.close(()=>process.exit());};process.on('SIGINT',stop);process.on('SIGTERM',stop);
