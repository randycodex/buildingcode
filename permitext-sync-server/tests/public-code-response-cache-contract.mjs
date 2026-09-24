import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPublicCodeResponseCache, sendPublicCodeResponse } from '../public-code-response-cache.mjs';
const send=(entry,{url='/code/chapters?code=BC',tag,method='GET'}={})=>{
 const result={};sendPublicCodeResponse({url,method,headers:{'if-none-match':tag}},{writeHead(status,headers){Object.assign(result,{status,headers});},end(body){result.body=body;}},entry,{'X-Content-Type-Options':'nosniff'});return result;
};
{
 const cache=createPublicCodeResponseCache();assert.equal(cache.get('cold'),undefined);
 const entry=cache.set('cold',{text:'café 🧱'});assert.equal(cache.get('cold'),entry);
 assert.equal(entry.bytes,Buffer.byteLength(entry.body));assert.equal(entry.etag,`"${createHash('sha256').update(entry.body).digest('hex')}"`);
 assert.equal(cache.bytes,entry.bytes);assert.equal(cache.size,1);
 const first=send(entry);assert.equal(first.status,200);assert.equal(first.body,entry.body);
 assert.equal(first.headers['Cache-Control'],'public, max-age=0, must-revalidate');assert.equal(first.headers.Vary,'Accept-Encoding');assert.equal(first.headers['X-Content-Type-Options'],'nosniff');
 for(const tag of [entry.etag,`W/${entry.etag}`,`"other", W/${entry.etag}`, '*', ['"other"',entry.etag]]){
  const repeated=send(entry,{tag});assert.equal(repeated.status,304);assert.equal(repeated.body,undefined);assert.equal(repeated.headers.ETag,entry.etag);
 }
 assert.equal(send(entry,{tag:'"other,tag"'}).status,200);
 assert.equal(send(entry,{tag:`garbage${entry.etag}`}).status,200);
 const pinned=send(entry,{url:`/code/chapters?contentRevision=${entry.revision}`});assert.equal(pinned.status,200);assert.equal(pinned.headers['Cache-Control'],'public, max-age=31536000, immutable');
 assert.equal(send(entry,{url:`/code/chapters?contentRevision=${entry.revision}`,tag:entry.etag}).status,304);
 for(const revision of ['', 'old', `${entry.revision}&contentRevision=${entry.revision}`]){
  const mismatch=send(entry,{url:`/code/chapters?contentRevision=${revision}`,tag:'*'});assert.equal(mismatch.status,409);assert.equal(mismatch.headers['Cache-Control'],'no-store');assert.equal(mismatch.headers.ETag,undefined);
 }
 assert.equal(send(entry,{method:'HEAD'}).body,undefined);
}
{
 const cache=createPublicCodeResponseCache();const old=cache.set('same',{version:'old'}),updated=cache.set('same',{version:'new'});
 assert.notEqual(old.etag,updated.etag);assert.equal(send(updated,{tag:old.etag}).status,200);
 assert.equal(send(updated,{url:`/code?contentRevision=${old.revision}`}).status,409);
 const rollback=cache.set('same',{version:'old'});assert.equal(rollback.etag,old.etag);assert.equal(send(rollback,{tag:old.etag}).status,304);
}
{
 const cache=createPublicCodeResponseCache();const keys=['/code/search?q=a&version=2022&match=exact&offset=0','/code/search?q=a&version=2014&match=exact&offset=0','/code/search?q=a&version=2022&match=fuzzy&offset=0','/code/search?q=a&version=2022&match=exact&offset=20'];
 for(const key of keys)cache.set(key,{key});for(const key of keys)assert.equal(JSON.parse(cache.get(key).body).key,key);assert.equal(cache.size,4);
}
{
 const cache=createPublicCodeResponseCache({maxBytes:100,maxEntries:2,maxEntryBytes:50});cache.set('a','a');cache.set('b','b');cache.get('a');cache.set('c','c');assert.equal(cache.get('b'),undefined);assert.equal(cache.size,2);assert.equal(cache.bytes,6);
 const oversized=cache.set('a','x'.repeat(60));assert.ok(oversized.body);assert.equal(cache.get('a'),undefined);assert.equal(cache.bytes,3);
 const bytesCache=createPublicCodeResponseCache({maxBytes:8,maxEntries:5,maxEntryBytes:8});bytesCache.set('a','aa');bytesCache.set('b','bb');bytesCache.set('c','cc');assert.equal(bytesCache.get('a'),undefined);assert.equal(bytesCache.bytes,8);
 const disabled=createPublicCodeResponseCache({maxEntries:0});assert.ok(disabled.set('a',{}));assert.equal(disabled.size,0);
}
{
 const cache=createPublicCodeResponseCache();const success=cache.set('a',{ok:true});for(const status of [400,404,409,500])assert.equal(cache.set('a',{error:'failure'},{status}),null);assert.equal(cache.get('a'),success);
 assert.throws(()=>cache.set('bad',undefined),/serialize/);assert.equal(cache.get('bad'),undefined);
 assert.throws(()=>createPublicCodeResponseCache({maxBytes:-1}),/nonnegative/);
}
console.log('Public code response cache passed: exact byte ETags, conditional lists, immutable revision validation/update/rollback, scope isolation, bounded LRU and unsuccessful-response exclusion.');
