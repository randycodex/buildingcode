import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('  let pendingDraftSave = null;');
assert.ok(start > 0);
const implementation = source.slice(start, source.indexOf('\n  const openHistoricalReport', start));
function harness() {
  let resolve, reject;
  const context = vm.createContext({
    structuredClone, activeDraft: {id: null, version: 0, title:'Draft', introduction:'Before', blocks:[]},
    drafts: [], dirty:true, disposed:false, projectID:'p', requestIdentity:'a', current:true,
    isCurrentAccountRequest:()=>context.current, calls:[], renders:0, message:'',
    clearStatus:()=>{context.message='';}, showStatusError:m=>{context.message=m;},
    renderWorkspaceContent:()=>{context.renders++;}, notebookMounts:new Map(),
    reportRequest:(path, body)=>{context.calls.push(structuredClone(body)); return new Promise((yes,no)=>{resolve=yes; reject=no;});}
  });
  vm.runInContext(implementation+'\nglobalThis.save = saveDraft;', context);
  return {c:context, complete:()=>resolve({draft:{...context.calls.at(-1), id:'saved',version:1}}), fail:()=>reject(new Error('Offline'))};
}
{
 const h=harness(), p=h.c.save(); assert.equal(h.c.save(),p); assert.equal(h.c.calls.length,1);
 h.c.activeDraft.introduction='Newer'; h.c.activeDraft.blocks.push({kind:'paragraph',text:'New'});
 assert.equal(h.c.calls[0].blocks.length,0); h.complete(); assert.equal(await p,false);
 assert.equal(h.c.activeDraft.introduction,'Newer'); assert.equal(h.c.activeDraft.blocks.length,1);
 assert.equal(h.c.activeDraft.id,'saved'); assert.equal(h.c.activeDraft.version,1);
 assert.equal(h.c.dirty,true); assert.equal(h.c.renders,0); assert.match(h.c.message,/newer changes/);
 const retry=h.c.save(); assert.equal(h.c.calls[1].expectedVersion,1); h.complete(); assert.equal(await retry,true);
 assert.equal(h.c.dirty,false);
}
for (const action of ['switch','dispose','account']) {
 const h=harness(), p=h.c.save();
 if(action==='switch')h.c.activeDraft={id:'other',title:'Other'};
 if(action==='dispose')h.c.disposed=true;
 if(action==='account')h.c.current=false;
 const before=structuredClone(h.c.activeDraft); h.complete(); assert.equal(await p,false);
 assert.deepEqual(h.c.activeDraft,before); assert.equal(h.c.renders,0);
}
{
 const h=harness(),p=h.c.save(); h.fail(); assert.equal(await p,false);
 assert.equal(h.c.activeDraft.introduction,'Before'); assert.equal(h.c.dirty,true); assert.match(h.c.message,/Offline/);
}
console.log('Report save continuity passed: pending edits, duplicate clicks, retry versions, draft switch, account change, disposal and failure.');
