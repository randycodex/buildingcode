import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildCodeAssetManifest, verifyCodeAssetManifest } from "../scripts/generate-code-asset-manifest.mjs";
import { validateCodeAssetManifest } from "../code-asset-manifest.mjs";
const dir=await mkdtemp(join(tmpdir(),"permitext-assets-"));
try {
 const roots=[{id:"preferred",path:join(dir,"first")},{id:"later",path:join(dir,"second")}];
 await Promise.all(roots.map(root=>mkdir(root.path)));
 await writeFile(join(roots[0].path,"figure.png"),"first image bytes");
 await writeFile(join(roots[1].path,"figure.png"),"shadowed image bytes");
 await writeFile(join(roots[1].path,"other.svg"),"<svg/>");
 await writeFile(join(roots[0].path,"private.txt"),"not served");
 const original=await buildCodeAssetManifest(roots);
 assert.equal(original.assets["figure.png"].rootId,"preferred");assert.equal(Object.keys(original.assets).length,2);
 const file=join(dir,"manifest.json");await writeFile(file,JSON.stringify(original));await verifyCodeAssetManifest(file,roots);
 await writeFile(join(roots[1].path,"figure.png"),"changed shadowed bytes");
 assert.equal((await buildCodeAssetManifest(roots)).assetRevision,original.assetRevision);
 await writeFile(join(roots[0].path,"figure.png"),"changed served image bytes");
 assert.notEqual((await buildCodeAssetManifest(roots)).assetRevision,original.assetRevision,"Image-only change invalidates asset identity");
 await assert.rejects(verifyCodeAssetManifest(file,roots),/stale/);
 assert.throws(()=>validateCodeAssetManifest({...original,assetRevision:"0".repeat(64)}),/mismatch/);
 console.log("Public asset manifest passed: serving precedence, image-only changes, ignored shadowed files and stale/tampered verification.");
} finally {await rm(dir,{recursive:true,force:true});}
