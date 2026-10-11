import assert from 'node:assert/strict';
import {createReportAutosave} from '../public/report-autosave.js';
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness() {
 let draft={id:'d',version:1,title:'Draft',blocks:[{id:'p',kind:'paragraph',text:'Before'}]}, current=true, timer, failStorage=false;
 const writes=[], states=[], journal=[], completions=[];
 const controller=createReportAutosave({read:()=>draft,isCurrent:()=>current,
  retain:async snapshot=>{if(failStorage)throw Error('Quota');const record={draft:structuredClone(snapshot)};journal.push(record);return record;},
  acknowledge:async record=>{const i=journal.indexOf(record); if(i>=0)journal.splice(i,1);},
  write:snapshot=>{writes.push(snapshot);return new Promise((resolve,reject)=>completions.push({resolve,reject}));},
  onSaved:saved=>{draft.id=saved.id;draft.version=saved.version;},onState:state=>states.push(state),
  setTimer:callback=>{timer=callback;return 1;},clearTimer:()=>{timer=null;}});
 return {controller,writes,states,journal,get draft(){return draft;}, edit(text){draft.blocks[0].text=text;controller.change();},fire(){timer?.();},
  complete(index=0){completions[index].resolve({...writes[index],version:writes[index].version+1});},fail(){completions.at(-1).reject(Error('Offline'));},
  leave(){current=false;},switch(){draft={id:'other',version:1,blocks:[]};controller.reset();},storageFull(){failStorage=true;}};
}
{
 const h=harness(),block=h.draft.blocks[0];h.edit('First');h.fire();await tick();assert.equal(h.writes.length,1);
 const pending=h.controller.flush();assert.equal(h.controller.flush(),pending);
 h.edit('Newer while saving');assert.equal(h.writes[0].blocks[0].text,'First');
 h.complete();await tick();assert.equal(h.writes.length,2);assert.equal(h.writes[1].version,2);
 assert.equal(h.writes[1].blocks[0].text,'Newer while saving');h.complete(1);assert.equal(await pending,true);
 assert.equal(h.draft.blocks[0],block,'Save acknowledgement must retain live editor objects');
 assert.equal(h.controller.isDirty(),false);assert.equal(h.states.at(-1).state,'saved');
}
{
 const h=harness();h.edit('Retained offline');const p=h.controller.flush();await tick();h.fail();assert.equal(await p,false);
 assert.equal(h.controller.isDirty(),true);assert.equal(h.states.at(-1).recoverable,true);
 h.edit('More offline edits');h.fire();await tick();assert.equal(h.writes.length,1,'Failure waits for explicit Retry');
 const retry=h.controller.flush();await tick();assert.equal(h.journal.at(-1).draft.blocks[0].text,'More offline edits','Retry must retain the latest edits, not its older wire snapshot');h.complete(1);await tick();assert.equal(h.writes[1].blocks[0].text,'Retained offline','Retry preserves the failed immutable request');
 assert.equal(h.writes[2].blocks[0].text,'More offline edits');h.complete(2);assert.equal(await retry,true);
}
for(const action of ['leave','switch']) {
 const h=harness();h.edit('Private');const p=h.controller.flush();await tick();h[action]();h.complete();assert.equal(await p,false);
 assert.equal(h.draft.version,1,'Old save cannot change a replacement draft/account');
}
{
 const h=harness();h.storageFull();h.edit('Cloud still works');const p=h.controller.flush();await tick();h.complete();assert.equal(await p,true);
 const other=harness();other.storageFull();other.edit('Unsynced');const failed=other.controller.flush();await tick();other.fail();assert.equal(await failed,false);assert.equal(other.states.at(-1).recoverable,false);
}
{
 const h=harness();h.edit('Keep after cancelled deletion');h.controller.suspend();h.fire();await tick();
 assert.equal(h.writes.length,0,'Confirmation suspends the debounce timer');
 h.controller.resume();h.fire();await tick();assert.equal(h.writes.length,1);
 h.complete();await tick();assert.equal(h.controller.isDirty(),false);
}
console.log('Report autosave passed: debounce, in-flight edits, serial versions, retained editor identity, explicit retry, storage failure and context fences.');
