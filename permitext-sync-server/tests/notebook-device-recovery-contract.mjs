import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const start = source.indexOf("async function notebookDeviceRecoveryBundle(");
const end = source.indexOf("\n}", start);
assert.ok(start > 0 && end > start);
let generation = 1, delayImage = false, releaseImage;
const identity = {userID:"synthetic-owner",generation:1};
const ownerDraft = {accountUserID:identity.userID,projectID:"project",document:{type:"doc",content:[]},pendingSave:{revision:"exact-pending"}};
const ownerImage = {accountUserID:identity.userID,projectID:"project",blob:{synthetic:true},id:"image"};
const otherDraft = {...ownerDraft,accountUserID:"other-owner"};
const context = vm.createContext({Date,
  requireCurrentAccountRequest(captured) { if(captured.generation!==generation) throw Object.assign(new Error("Account changed"),{code:"ACCOUNT_CONTEXT_CHANGED"}); },
  async offlineAccountRecoverySnapshot() {return {drafts:[ownerDraft,otherDraft,{...ownerDraft,projectID:"other-project"}],images:[ownerImage,{...ownerImage,accountUserID:"other-owner"}],projects:[{secret:"revoked shared snapshot"}],syncSnapshot:{secret:"revoked server snapshot"}};},
  async blobDataURL() { if(delayImage) await new Promise(resolve=>{releaseImage=resolve;}); return "data:image/png;base64,c3ludGhldGlj"; }
});
const textStart = source.indexOf("function notebookRecoveryPlainText(");
const textEnd = source.indexOf("\n}", textStart);
vm.runInContext(source.slice(textStart,textEnd+2)+"\nglobalThis.plain = notebookRecoveryPlainText;",context);
assert.equal(context.plain({format:"blocknote-json",document:[{type:"paragraph",content:[{type:"text",text:"Only the cellar is sprinklered."}],children:[{type:"paragraph",content:[{type:"text",text:"Upper floors remain unverified."}]}]}]}),"Only the cellar is sprinklered.\nUpper floors remain unverified.");
vm.runInContext(source.slice(start,end+2)+"\nglobalThis.bundle = notebookDeviceRecoveryBundle;",context);
const bundle = await context.bundle("project",identity);
assert.equal(bundle.drafts.length,1); assert.equal(bundle.drafts[0],ownerDraft);
assert.equal(bundle.images.length,1); assert.equal(bundle.images[0].dataURL,"data:image/png;base64,c3ludGhldGlj");
assert.equal(bundle.images[0].blob,undefined);
assert.equal(bundle.projects,undefined); assert.equal(bundle.syncSnapshot,undefined);
assert.equal(bundle.drafts[0].pendingSave.revision,"exact-pending");
delayImage=true;
const pending=context.bundle("project",identity);
await new Promise(resolve=>setImmediate(resolve));
generation=2; releaseImage();
await assert.rejects(pending,{code:"ACCOUNT_CONTEXT_CHANGED"});
assert.ok(source.includes("await appendNotebookDeviceRecovery(shell, projectID, requestIdentity);"));
console.log("Notebook device recovery passed: owner/project-only authored drafts and image bytes, no revoked server snapshots, no entitlement or network dependency, account-change export suppression.");
