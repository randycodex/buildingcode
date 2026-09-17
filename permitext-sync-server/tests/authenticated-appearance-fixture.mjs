// Loopback-only full-app appearance review. All records are synthetic and temporary.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const referenceReview=process.argv.includes('--reference-review');
const fixturePort=referenceReview?18885:18884;
const directory=await mkdtemp(join(tmpdir(),'permitext-appearance-'));
for(const key of Object.keys(process.env))if(/DATABASE_URL|POSTGRES_URL|STORAGE_URL|OPENAI|CLERK|BLOB_|VERCEL_|RESEND|STRIPE|APPLE_.*(SECRET|KEY)/.test(key))delete process.env[key];
Object.assign(process.env,{NODE_ENV:'test',VERCEL:'',VERCEL_ENV:'',PERMITEXT_TEST_RESEARCH_MOCK:'1',PERMITEXT_SYNC_DATA_PATH:join(directory,'sync.json'),PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(directory,'assets'),PERMITEXT_SYNC_GRANT_ADMIN_TOKEN:randomUUID()});
const {handleRequest,createFileStoreAdapter}=await import('../app.mjs');
const key=randomUUID(),providerID='synthetic-appearance-'+randomUUID(),projectID='appearance-project',base='http://127.0.0.1:'+fixturePort;
const userID='apple:'+providerID;let token,account,ready=false,receipt;
function json(res,status,data){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'}).end(JSON.stringify(data));}
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,base);
 if(url.pathname.startsWith('/fixture/')){
  if(url.searchParams.get('key')!==key)return json(res,403,{error:'Fixture capability required'});
  if(!ready)return json(res,503,{error:'Seeding'});
  if(url.pathname==='/fixture/evidence')return json(res,200,receipt);
  // The fixture alone serves same-origin frameable HTML. Product headers and
  // shipped index/assets remain unchanged; no browser or OS setting is changed.
  if(url.pathname==='/fixture/app'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-frame-options':'SAMEORIGIN'});return res.end(await readFile(new URL('../public/index.html',import.meta.url)));}
  if(url.pathname==='/fixture/start'){
   const theme=url.searchParams.get('theme')==='dark'?'dark':'light';
   const stored={userID,sessionToken:token,authProvider:'apple',displayName:'Synthetic appearance review',entitlement:account.entitlement};
   res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-src 'self'; object-src 'none'; base-uri 'none'"});
   return res.end(`<!doctype html><meta charset="utf-8"><meta name="color-scheme" content="${theme}"><title>Isolated authenticated ${theme} appearance</title><style>:root{color-scheme:${theme}}body{margin:0;background:${theme==='dark'?'#111':'white'};color:${theme==='dark'?'white':'black'};font:14px system-ui}header{padding:8px}iframe{display:block;width:100%;height:calc(100vh - 38px);border:0;color-scheme:${theme}}</style><header>Synthetic authenticated ${theme} appearance · no paid Research · temporary records</header><script>localStorage.setItem('permitext:webAccount:v1',${JSON.stringify(JSON.stringify(stored))});</script><iframe title="Permitext ${theme} appearance" src="/fixture/app?key=${key}"></iframe>`);
  }
  return json(res,404,{error:'Unknown fixture route'});
 }
 if(ready&&url.pathname.startsWith('/research/')&&req.method==='POST'&&/\/(?:message|submit|send|questions)(?:\/|$)/.test(url.pathname))return json(res,403,{error:'Additional Research submissions disabled in appearance fixture'});
 return await handleRequest(req,res);
}catch(error){console.error(error.message);if(!res.headersSent)json(res,500,{error:error.message});else res.destroy();}});
await new Promise(resolve=>server.listen(fixturePort,'127.0.0.1',resolve));
const realFetch=globalThis.fetch;globalThis.fetch=(input,options)=>{const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);assert.equal(url.origin,base,'External/provider calls forbidden');return realFetch(input,options);};
async function post(path,body,bearer=token){const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:'Bearer '+bearer}:{})},body:JSON.stringify({auth:{accountUserID:userID},...body})});const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data;}
let stopping=false;async function stop(){if(stopping)return;stopping=true;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});process.exit(process.exitCode||0);}
process.once('SIGINT',stop);process.once('SIGTERM',stop);setTimeout(stop,60*60*1000).unref();
try{
 await post('/admin/lifetime-grants/grant',{userID},process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
 account=await post('/account/sign-in',{credential:{provider:'apple',providerUserID:providerID,email:'appearance@example.test',displayName:'Synthetic appearance review'}});token=account.account.backendSessionToken;
 await post('/sync/push',{batch:{user:{id:userID},mutations:[{project:{id:'appearance-project-record',userID,codeVersion:'CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1',clientID:projectID,name:'Appearance verification project',address:'100 Synthetic Review Street',colorHex:'#334455',sortOrder:0,updatedAt:new Date().toISOString()}}]}});
 const document={schema:'permitext-notebook-card',schemaVersion:1,format:'tiptap-json',document:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Synthetic saved Note for light appearance. Verify title, body, editing controls, and return navigation.'}]}]}};
 const saved=await post('/notebook/cards/save',{projectID,expectedVersion:0,clientMutationID:'appearance-note-seed',cardType:'finding',title:'Light appearance verification Note',document});
 if(referenceReview){
  const linkedDocument={schema:'permitext-notebook-card',schemaVersion:2,format:'blocknote-json',document:[{type:'paragraph',content:[{type:'text',text:'Original synthetic draft before reference. ',styles:{}},{type:'permitextReference',props:{referenceKind:'notebookCard',referenceID:saved.card.id,label:'Notebook: Light appearance verification Note'}},{type:'text',text:' Return here and continue editing.',styles:{}}]},...Array.from({length:30},(_,i)=>({type:'paragraph',content:[{type:'text',text:`Position marker ${i+1}: synthetic reference return verification.`,styles:{}}]}))]};
  const original=await post('/notebook/cards/save',{projectID,expectedVersion:0,clientMutationID:'reference-original-seed',cardType:'finding',title:'Original reference return Note',document:linkedDocument});
  const checked=await post('/notebook/cards/get',{projectID,cardID:original.card.id});assert.deepEqual(checked.card.document.document.map(block=>block.content),linkedDocument.document.map(block=>block.content));
  assert.equal((await createFileStoreAdapter().listResearchAnswers(userID)).length,0);
  receipt={passed:true,projectID,originalNoteID:original.card.id,targetNoteID:saved.card.id,answerCount:0,externalRequestsAllowed:false};
 }else{
 const created=await post('/research/conversations/create',{projectID,requestID:'appearance-conversation-seed'});
 const answered=await post('/research/conversations/message',{conversationID:created.conversation.id,question:'What is the project address?',requestID:'appearance-answer-seed'});
 assert.match(answered.conversation.messages.at(-1).answer.conclusion,/100 Synthetic Review Street/);
 const read=await post('/notebook/cards/get',{projectID,cardID:saved.card.id});assert.equal(read.card.title,'Light appearance verification Note');
 assert.equal((await createFileStoreAdapter().listResearchAnswers(userID)).length,1);
 receipt={passed:true,projectID,noteID:saved.card.id,conversationID:created.conversation.id,answerCount:1,noteTitle:read.card.title,providerMode:'mock',externalRequestsAllowed:false};
 }
 ready=true;
 const blocked=await fetch(base+'/research/conversations/message',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(blocked.status,403);
 console.log('APPEARANCE_SEED_CHECK_PASS',JSON.stringify(receipt));console.log('APPEARANCE_READY '+base+'/fixture/start?key='+key);
}catch(error){console.error(error);process.exitCode=1;await stop();}
