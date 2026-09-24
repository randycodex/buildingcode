import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
const temporary=await mkdtemp(join(tmpdir(),'permitext-public-cache-http-'));
Object.assign(process.env,{NODE_ENV:'test',VERCEL:'',VERCEL_ENV:'',PERMITEXT_TEST_RESEARCH_MOCK:'1',PERMITEXT_SYNC_DATA_PATH:join(temporary,'sync.json'),PERMITEXT_LOCAL_PRIVATE_ASSET_PATH:join(temporary,'assets')});
for(const key of ['OPENAI_API_KEY','DATABASE_URL','PERMITEXT_SYNC_DATABASE_URL','POSTGRES_URL','NEON_DATABASE_URL','STORAGE_URL','BLOB_READ_WRITE_TOKEN','VERCEL_OIDC_TOKEN','BLOB_STORE_ID'])delete process.env[key];
const {handleRequest}=await import('../app.mjs');
const server=createServer(handleRequest);await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const originalFetch=globalThis.fetch;
globalThis.fetch=(input,options)=>{assert.equal(new URL(typeof input==='string'?input:input.url).origin,base,'No external calls in synthetic contract');return originalFetch(input,options);};
const evidence=[];let requests=0;
async function request(path,options={}){requests++;const start=performance.now();const response=await fetch(base+path,options);const text=await response.text();return {response,text,bytes:Buffer.byteLength(text),ms:performance.now()-start};}
function add(path,key,value){const url=new URL(path,base);url.searchParams.set(key,value);return url.pathname+url.search;}
async function publicRepresentation(path){const first=await request(path);assert.equal(first.response.status,200,path+first.text.slice(0,200));const corpus=first.response.headers.get('x-permitext-corpus-revision');assert.ok(corpus,path+' corpus identity');const etag=first.response.headers.get('etag');assert.equal(etag,'"'+createHash('sha256').update(first.text).digest('hex')+'"');assert.equal(first.response.headers.get('cache-control'),'public, max-age=0, must-revalidate');const repeat=await request(path,{headers:{'if-none-match':etag}});assert.equal(repeat.response.status,304,path);assert.equal(repeat.bytes,0);assert.equal(repeat.response.headers.get('x-permitext-corpus-revision'),corpus);assert.equal(repeat.response.headers.get('etag'),etag);const revision=etag.slice(1,-1);const pinned=await request(add(path,'contentRevision',revision));assert.equal(pinned.text,first.text);assert.equal(pinned.response.headers.get('cache-control'),'public, max-age=31536000, immutable');const wrong=await request(add(path,'contentRevision','wrong'),{headers:{'if-none-match':etag}});assert.equal(wrong.response.status,409);assert.equal(wrong.response.headers.get('cache-control'),'no-store');evidence.push({path,bytes:first.bytes,conditionalBytes:repeat.bytes,firstMilliseconds:Number(first.ms.toFixed(2)),repeatMilliseconds:Number(repeat.ms.toFixed(2))});return {etag,value:JSON.parse(first.text)};}
try{
 const revision=await publicRepresentation('/code/revision');
 assert.equal(revision.value.cacheContract,1);
 assert.ok(revision.value.corpusRevision);
 const assetRevision=revision.value.assetRevision;
 assert.match(assetRevision,/^[a-f0-9]{64}$/);
 const {loadCodeAssetManifest}=await import('../code-asset-manifest.mjs');
 const manifest=await loadCodeAssetManifest();
 assert.equal(assetRevision,manifest.assetRevision);
 const [assetName,assetEntry]=Object.entries(manifest.assets).sort((a,b)=>a[1].bytes-b[1].bytes||a[0].localeCompare(b[0]))[0];
 const assetPath='/code/assets/'+encodeURIComponent(assetName);
 requests++;
 const pinnedAsset=await fetch(base+add(assetPath,'assetRevision',assetRevision));
 assert.equal(pinnedAsset.status,200);
 const assetBytes=Buffer.from(await pinnedAsset.arrayBuffer());
 assert.equal(assetBytes.length,assetEntry.bytes);
 assert.equal(createHash('sha256').update(assetBytes).digest('hex'),assetEntry.sha256);
 assert.equal(pinnedAsset.headers.get('cache-control'),'public, max-age=31536000, immutable');
 assert.equal(pinnedAsset.headers.get('x-permitext-asset-revision'),assetRevision);
 const legacyAsset=await request(assetPath);
 assert.equal(legacyAsset.response.status,200);
 assert.equal(legacyAsset.response.headers.get('cache-control'),'public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600');
 for(const suffix of ['?assetRevision=wrong','?assetRevision=','?assetRevision='+assetRevision+'&assetRevision='+assetRevision]){
  const bad=await request(assetPath+suffix);assert.equal(bad.response.status,409);assert.equal(bad.response.headers.get('cache-control'),'no-store');
 }
 const aggregate=revision.value.corpusRevision;
 const accepted=await request(add('/code/chapters?view=startup','expectedPublicCorpusRevision',aggregate));
 assert.equal(accepted.response.status,200);
 assert.equal(accepted.response.headers.get('x-permitext-corpus-revision'),aggregate);
 const rejected=await request(add('/code/chapters?view=startup','expectedPublicCorpusRevision','wrong'));
 assert.equal(rejected.response.status,409);
 assert.equal(rejected.response.headers.get('cache-control'),'no-store');
 const duplicate=await request('/code/revision?expectedPublicCorpusRevision='+encodeURIComponent(aggregate)+'&expectedPublicCorpusRevision='+encodeURIComponent(aggregate));
 assert.equal(duplicate.response.status,409);
 assert.equal(duplicate.response.headers.get('cache-control'),'no-store');
 await publicRepresentation('/code/libraries');
 await publicRepresentation('/code/chapters?view=startup');
 const summary=await publicRepresentation('/code/chapters/4?bodyContract=2');
 const sectionID=summary.value.chapter.sections[0].id;
 assert.equal(summary.value.chapter.assetRevision,assetRevision);
 const assetWindow=await publicRepresentation('/code/chapters/4?include=body&bodyContract=2&bodyStart=0&bodyLimit=2');
 const windowBlocks=assetWindow.value.chapter.sections.flatMap(section=>section.blocks||[]);assert.ok(windowBlocks.length);assert.ok(windowBlocks.every(block=>block.assetRevision===(block.imageID||/(?:<img\b|assets\/)/i.test(block.html||'')?assetRevision:undefined)));
 await publicRepresentation('/code/chapters/4?readerSearch=concrete');
 const assetSection=await publicRepresentation('/code/sections/'+sectionID);
 assert.equal(assetSection.value.section.assetRevision,assetRevision);assert.ok(assetSection.value.section.blocks.length);assert.ok(assetSection.value.section.blocks.every(block=>block.assetRevision===(block.imageID||/(?:<img\b|assets\/)/i.test(block.html||'')?assetRevision:undefined)));
 const figureResponse=await publicRepresentation('/code/sections/8090');
 const figureBlocks=figureResponse.value.section.blocks.filter(block=>block.imageID||/(?:<img\b|assets\/)/i.test(block.html||''));
 assert.ok(figureBlocks.length,'Real Fuel Gas section8090 contains figures');assert.ok(figureBlocks.every(block=>block.assetRevision===assetRevision));
 const plainBlocks=figureResponse.value.section.blocks.filter(block=>!block.imageID&&!/(?:<img\b|assets\/)/i.test(block.html||''));
 assert.ok(plainBlocks.length);assert.ok(plainBlocks.every(block=>block.assetRevision===undefined));
 const search=await publicRepresentation('/code/search?q=concrete&limit=2');
 // A previous representation's validator cannot hide a different query, scope,
 // edition, exact-mode result or pagination window behind an erroneous304.
 for(const path of ['/code/search?q=steel&limit=2','/code/search?q=concrete&code=MC&limit=2','/code/search?q=concrete&version=all&limit=2','/code/search?q=concrete&match=exact&candidateOffset=0&limit=2','/code/search?q=concrete&offset=2&limit=2']){
  const result=await publicRepresentation(path);assert.notEqual(result.etag,search.etag,path);
  const cross=await request(path,{headers:{'if-none-match':search.etag}});assert.equal(cross.response.status,200,path);
 }
 const nextWindow=await publicRepresentation('/code/chapters/4?include=body&bodyContract=2&bodyStart=2&bodyLimit=2');assert.notEqual(nextWindow.etag,summary.etag);
 for(const path of ['/code/chapters/4?bodyContract=2&expectedCorpusRevision=wrong','/code/sections?ids=invalid','/code/chapters/missing-chapter','/code/search?q='+('a'.repeat(201))]){const r=await request(path);assert.ok(r.response.status>=400,path);assert.equal(r.response.headers.get('cache-control'),'no-store');assert.equal(r.response.headers.get('etag'),null);}
 const wrongCorpus=await request('/code/chapters/4?include=body&bodyContract=2&bodyStart=0&bodyLimit=2&expectedCorpusRevision=wrong');assert.equal(wrongCorpus.response.status,409);
 const signIn=await request('/account/sign-in?contentRevision=wrong',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({credential:{provider:'apple',providerUserID:'synthetic-public-cache',displayName:'Synthetic cache test'}})});assert.equal(signIn.response.status,200);assert.equal(signIn.response.headers.get('cache-control'),'no-store');assert.equal(signIn.response.headers.get('etag'),null);
 const account=JSON.parse(signIn.text).account;
 for(const path of ['/sync/pull?contentRevision=wrong','/projects/foundation/state?contentRevision=wrong']){const r=await request(path,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${account.backendSessionToken}`},body:JSON.stringify({auth:{accountUserID:account.appUserID},projectID:'absent',syncSchemaVersion:2})});assert.equal(r.response.headers.get('cache-control'),'no-store',path);assert.equal(r.response.headers.get('etag'),null,path);}
 console.log(JSON.stringify({scope:'local ephemeral HTTP only; not device timing',requests,representations:evidence.length,measurements:evidence},null,2));
 console.log('Public code HTTP cache passed: exact bytes, conditional304, immutable revision guard, query isolation, corpus conflict and private no-store.');
}finally{globalThis.fetch=originalFetch;await new Promise(r=>server.close(r));await rm(temporary,{recursive:true,force:true});}
