import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
const temporary=await mkdtemp(join(tmpdir(),"permitext-generated-web-"));
Object.assign(process.env,{NODE_ENV:"test",VERCEL:"",VERCEL_ENV:"",PERMITEXT_SYNC_DATA_PATH:join(temporary,"sync.json")});
for(const key of ["DATABASE_URL","PERMITEXT_SYNC_DATABASE_URL","POSTGRES_URL","NEON_DATABASE_URL","STORAGE_URL"])delete process.env[key];
const {handleRequest}=await import("../app.mjs");
const server=createServer(handleRequest);
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const get=path=>new Promise((resolve,reject)=>{
 const req=request({hostname:"127.0.0.1",port:server.address().port,path},res=>{
  const chunks=[];res.on("data",chunk=>chunks.push(chunk));res.on("end",()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
 });req.on("error",reject);req.end();
});
try {
 const generated=await readFile(new URL("../public/web/analytics.js",import.meta.url));
 const analytics=await get("/web/analytics.js?v=contract");
 assert.equal(analytics.status,200);assert.deepEqual(analytics.body,generated);
 assert.match(analytics.headers["content-type"],/javascript/);
 const authored=await get("/web/reader-search-match.js");
 assert.equal(authored.status,200);assert.deepEqual(authored.body,await readFile(new URL("../public/reader-search-match.js",import.meta.url)));
 for(const path of ["/web/nonexistent-static-contract.js","/web/%2e%2e%2fapp.mjs","/web/..%5capp.mjs","/web/%2fapp.mjs","/web/%E0%A4%A"]){
  const result=await get(path);assert.equal(result.status,404,path);
 }
 console.log("Generated web static HTTP contract passed: built analytics, authored root modules, missing assets and encoded traversal/malformed paths.");
} finally {await new Promise(resolve=>server.close(resolve));await rm(temporary,{recursive:true,force:true});}
