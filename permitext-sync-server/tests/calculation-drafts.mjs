import assert from 'node:assert/strict';
import {calculationDraftStore} from '../public/calculation-drafts.js';
const values = new Map();
const storage = {getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value)};
const store = calculationDraftStore(storage, 'private-account-A:calculator-drafts:v1');
const context = JSON.stringify(['projectA','2152','2022','manual']);
let first = store.open(context, {area:'300',spaceName:'Meeting room'});
first = store.update(first, {...first.input,area:'600'});
const reloaded = calculationDraftStore(storage,'private-account-A:calculator-drafts:v1');
assert.equal(reloaded.open(context).input.area,'600');
assert.equal(reloaded.open(context).id,first.id,'Reader and toolbar share the active manual calculation');
const stale = reloaded.open(context);
first = store.update(first,{...first.input,area:'900'});
assert.throws(()=>reloaded.update(stale,{area:'100'}),/changed in another view/);
assert.equal(store.open(context).input.area,'900');
first = store.markSaved(first,{id:'note1',title:'Meeting room'},'snapshot-input');
const second = store.create(context);
assert.notEqual(second.id,first.id);assert.equal(store.list(context).length,2);
assert.equal(store.list(context).find(r=>r.id===first.id).savedNote.id,'note1');
assert.equal(store.open(context,{},first.id).input.spaceName,'Meeting room');
for (const isolated of [['projectB','2152','2022','manual'],['projectA','2152','2014','manual'],['projectA','2152','2022','answer:one']]) {
 const record=store.open(JSON.stringify(isolated));assert.notEqual(record.id,first.id);assert.equal(record.input.area,undefined);
}
assert.equal(calculationDraftStore(storage,'private-account-B:calculator-drafts:v1').list(context).length,0);
values.set('broken','{bad');assert.throws(()=>calculationDraftStore(storage,'broken').open(context));assert.equal(values.get('broken'),'{bad');
const quota=calculationDraftStore({getItem:()=>null,setItem(){throw Error('Quota exceeded');}},'quota');assert.throws(()=>quota.open(context),/Quota/);
console.log('Calculation drafts: reload, shared entry points, named rooms, saved snapshots, new calculations, stale writes, project/edition/answer/account isolation and storage failures passed.');
