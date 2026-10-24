import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {applyWebSyncSafeguard,legacyReadbackAllowed,legacyReadbackMilliseconds,isWebSyncRequest} from '../web-sync-guard.mjs';
import {webSyncProtocol,webSyncProtocolHeader,webAppVersion} from '../public/web-client-version.js';
const now=1_800_000_000_000;
const request=(headers={})=>({method:'POST',headers});
function response() {return {headers:{},headersSent:false,setHeader(k,v){this.headers[k.toLowerCase()]=v;},getHeader(k){return this.headers[k.toLowerCase()];},writeHead(status,headers={}){this.status=status;Object.assign(this.headers,headers);this.headersSent=true;return this;},end(body){this.body=body;return this;}};}
const legacy={origin:'https://permitext.com',authorization:'Bearer synthetic-session'};
for(const hints of [{origin:'https://permitext.com'},{'sec-fetch-site':'same-origin'},{'user-agent':'Mozilla/5.0 Safari/605.1.15'}]) {
 for(const path of ['sync/checkpoint','projects/artifacts/checkpoint','sync/pull']) {
  const res=response();assert.equal(applyWebSyncSafeguard(request(hints),res,path,()=>now),true);
  assert.equal(res.status,426);assert.equal(JSON.parse(res.body).code,'WEB_APP_UPDATE_REQUIRED');assert.equal(JSON.parse(res.body).webAppVersion,webAppVersion);
  assert.equal(res.headers['Cache-Control'],'no-store');assert(!res.body.includes('mutations'));
 }
}
for(const headers of [legacy,{...legacy,[webSyncProtocolHeader.toLowerCase()]:webSyncProtocol}]) {
 for(const path of ['sync/push','notebook/cards/save','reports/drafts/save','projects/context/save','code/revision']) assert.equal(applyWebSyncSafeguard(request(headers),response(),path),false);
}
for(const headers of [{},{'user-agent':'permitext/413 CFNetwork/3860.500.111.2.2 Darwin/25.0.0'},{'user-agent':'node','sec-fetch-mode':'cors'}]) {
 assert.equal(isWebSyncRequest(request(headers)),false);
 for(const path of ['sync/checkpoint','sync/pull','projects/artifacts/checkpoint'])assert.equal(applyWebSyncSafeguard(request(headers),response(),path),false);
}
for(const path of ['sync/checkpoint','sync/pull','projects/artifacts/checkpoint'])assert.equal(applyWebSyncSafeguard(request({...legacy,[webSyncProtocolHeader.toLowerCase()]:webSyncProtocol}),response(),path),false);

const saved=response();saved.setHeader('Set-Cookie','existing=value');
assert.equal(applyWebSyncSafeguard(request(legacy),saved,'sync/push',()=>now),false);saved.writeHead(200).end('{}');
const cookie=saved.headers['set-cookie'][1];assert.match(cookie,/HttpOnly; SameSite=Strict; Secure/);assert.match(cookie,/Path=\/sync\/pull/);assert.equal(saved.headers['set-cookie'][0],'existing=value');
const readback={...legacy,cookie:cookie.split(';')[0]};
assert.equal(legacyReadbackAllowed(request(readback),now+1),true);
assert.equal(applyWebSyncSafeguard(request(readback),response(),'sync/pull',()=>now+1),false);
assert.equal(applyWebSyncSafeguard(request(readback),response(),'sync/checkpoint',()=>now+1),true,'Readback does not re-enable polling');
for(const headers of [
 {...readback,authorization:'Bearer another-session'}, {...readback,cookie:readback.cookie+'tampered'},
 {...readback,cookie:'permitext_legacy_readback=NaN.signature'},
 {...readback,cookie:'permitext_legacy_readback='+String(now+1e9)+'.bad'}
]) assert.equal(legacyReadbackAllowed(request(headers),now+1),false);
assert.equal(legacyReadbackAllowed(request(readback),now+legacyReadbackMilliseconds),false);
const failed=response();applyWebSyncSafeguard(request(legacy),failed,'sync/push',()=>now);failed.writeHead(401);assert.equal(failed.headers['set-cookie'],undefined);

// Execute the actual app wrapper: denied reads cannot reach store locks, route
// rate limiting, authentication or dispatch (and cannot initialize an adapter).
const source=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const start=source.indexOf('async function handleRequestWithStoreLock('),end=source.indexOf('\n}',start)+2;
const c=vm.createContext({observeVercelRequest(){},applyWebSyncSafeguard,normalizePath:url=>url.slice(1),
 requestMutatesFileStore:()=>assert.fail('Denied read reached file-store classification'),
 handleRequestUnlocked:()=>assert.fail('Denied read reached rate limiting/authentication'),withFileStoreLock:()=>assert.fail('Denied read reached store')});
vm.runInContext(source.slice(start,end),c);
for(const path of ['sync/pull','sync/checkpoint','projects/artifacts/checkpoint']) {
 const res=response();await c.handleRequestWithStoreLock({...request(legacy),url:'/'+path},res);assert.equal(res.status,426);
}
console.log('Web sync guard passed: pre-database legacy cutoff, Safari/Chromium hints, native compatibility, writes, short credential-bound readback, expiry, tampering, and no fake snapshots.');
