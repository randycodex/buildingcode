import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import {withCodeAssetRevision} from "../public/code-asset-identity.js";
const offline=await readFile(new URL("../public/offline-storage.js",import.meta.url),"utf8");
const worker=await readFile(new URL("../public/service-worker.js",import.meta.url),"utf8");
function actual(source,name){const a=source.search(new RegExp(`(?:async )?function ${name}\\(`)),b=source.indexOf("\n}",a);assert.ok(a>=0&&b>a);return source.slice(a,b+2);}
const stores=new Map();const key=value=>typeof value==="string"?value:value.url;
const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return{async put(url,response){store.set(key(url),response.clone());},async match(url){return store.get(key(url))?.clone();}};}};
const old="a".repeat(64),next="b".repeat(64);let fail=false;
const c=vm.createContext({caches,Response,Headers,URL,offlineAssetVersion:"legacy",offlineAssetCacheName:"legacy-cache",shellCacheName:"shell",
 requireOfflineDownloadActive(){},async mapWithConcurrency(items,_n,fn){for(const item of items)await fn(item,0,{});},
 async readOfflineResponse(url,_signal,consume){if(fail&&url.includes("second.png"))throw new Error("Install failed");const revision=new URL(url,"https://fixture").searchParams.get("assetRevision");return consume(new Response(revision===old?"old figure":"new figure",{headers:{"x-permitext-asset-revision":revision}}));},
 fetch:async()=>{throw new Error("Offline");}
});
vm.runInContext(actual(offline,"offlineAssetURL")+actual(offline,"cacheOfflineAssets")+actual(worker,"cacheFirstAsset"),c);
await c.cacheOfflineAssets(["figure.png"],{assetRevision:old});
const oldURL=c.offlineAssetURL("figure.png",old),newURL=c.offlineAssetURL("figure.png",next);
fail=true;await assert.rejects(c.cacheOfflineAssets(["figure.png","second.png"],{assetRevision:next}),/Install failed/);
assert.equal(await (await stores.get(`permitext-pro-code-assets-revision-${old}`).get(oldURL).clone()).text(),"old figure");
fail=false;await c.cacheOfflineAssets(["figure.png","second.png"],{assetRevision:next});
// CacheStorage normalizes relative URLs in browsers; use a lookup adapter for
// the worker's absolute request URLs in this isolated contract.
const originalOpen=caches.open;caches.open=async name=>{const cache=await originalOpen(name);return{...cache,match:url=>cache.match(new URL(key(url),"https://fixture").pathname+new URL(key(url),"https://fixture").search)};};
assert.equal(await (await c.cacheFirstAsset({url:`https://fixture${oldURL}`})).text(),"old figure");
assert.equal(await (await c.cacheFirstAsset({url:`https://fixture${newURL}`})).text(),"new figure");
await (await originalOpen("legacy-cache")).put("/code/assets/legacy.png?v=legacy",new Response("legacy figure"));
assert.equal(await (await c.cacheFirstAsset({url:"https://fixture/code/assets/legacy.png?v=legacy"})).text(),"legacy figure");
const paragraph={plainText:"Unchanged paragraph",html:"<p>Text</p>"};
assert.equal(withCodeAssetRevision(paragraph,next),paragraph,"Plain blocks retain identity and avoid repeated hashes");
for(const figure of [{imageID:"figure.png"},{html:'<img src="figure.png">'},{html:'<div style="background:url(/code/assets/figure.png)"></div>'}]) {
 const stamped=withCodeAssetRevision(figure,next);assert.equal(stamped.assetRevision,next);assert.notEqual(stamped,figure);assert.equal(figure.assetRevision,undefined);
}
assert.match(offline,/blocks: \(section.blocks \|\| \[\]\).map\(block => withCodeAssetRevision\(block, assetRevision\)\)/);
console.log("Offline asset revisions passed: failed/new install isolation, old/new offline figure selection, block stamping and legacy cache compatibility.");
