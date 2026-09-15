import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const begin = source.indexOf('  let propertyLookupAddress = "";');
const end = source.indexOf('\n  nameInput.addEventListener', begin);
assert(begin > 0 && end > begin);
function lookupHarness() {
  const pending = [];
  const c = vm.createContext({ identity: null, selectedFolderType: 'project', isEditing: false,
    addressInput: { value: 'Sample address' }, propertyLookupStatus: { dataset: {}, textContent: '' },
    activeAccount: () => ({ id: 'isolated' }),
    postResearch: () => new Promise((resolve, reject) => pending.push({resolve, reject})) });
  vm.runInContext(source.slice(begin,end) + '\nglobalThis.lookup = lookupPropertyContext;',c);
  return { c, pending };
}
{
  const {c,pending} = lookupHarness(); const p=c.lookup();
  assert.match(c.propertyLookupStatus.textContent,/Looking up/);
  pending[0].resolve({property:{structuredFacts:[{value:'R8A'}],warnings:['Mapped-area facts were unavailable.'],normalizedAddress:'Normalized address'}});
  await p;
  assert.equal(c.propertyLookupStatus.dataset.state,'warning');
  assert.match(c.propertyLookupStatus.textContent,/Imported 1 sourced facts/);
  assert.match(c.propertyLookupStatus.textContent,/Mapped-area facts were unavailable/);
  assert.equal(c.addressInput.value,'Normalized address');
}
{
  const {c,pending}=lookupHarness(); const old=c.lookup();
  c.addressInput.value='New address'; const next=c.lookup();
  pending[0].resolve({property:{structuredFacts:[{}],normalizedAddress:'Stale address'}}); await old;
  assert.equal(c.addressInput.value,'New address');
  pending[1].reject(new Error('Unavailable')); await next;
  assert.match(c.propertyLookupStatus.textContent,/could not be imported.*can still be saved/);
  const retry=c.lookup(); pending[2].resolve({property:{structuredFacts:[{}],warnings:[]}}); await retry;
  assert.equal(c.propertyLookupStatus.dataset.state,'success');
}
const noteStart=source.indexOf('  let noteRevision = 0;');
const noteEnd=source.indexOf('\n  content.append(codeLabelElement',noteStart);
assert(noteStart > 0 && noteEnd > noteStart);
class Element {
  constructor(){this.textContent='';this.children=[];this.events={};}
  append(...items){this.children.push(...items);}
  replaceChildren(){this.children=[];this.textContent='';}
  addEventListener(name,fn){this.events[name]=fn;}
}
const saveState=new Element(), textarea=new Element(); textarea.value='Retained draft';
const callbacks=[], timers=[];
const c=vm.createContext({saveState,textarea,panel:{isConnected:true},sectionTarget:{sectionID:'sample'},
  document:{createElement:()=>new Element()},clearTimeout:()=>{},window:{setTimeout:fn=>timers.push(fn)},
  setAnnotationNoteValue:(_target,value,callback)=>{callbacks.push({value,callback});return true;},
  noteValueForTarget:()=>'',syncReaderNoteControls:()=>{}});
vm.runInContext(source.slice(noteStart,noteEnd),c);
textarea.events.input(); callbacks[0].callback('error');
assert.equal(textarea.value,'Retained draft');
assert.equal(saveState.children[1].textContent,'Retry');
saveState.children[1].events.click(); assert.equal(callbacks.length,2);
callbacks[1].callback('synced'); assert.equal(saveState.textContent,'Synced');
textarea.value='Newer draft'; textarea.events.input(); callbacks[0].callback('error');
assert.equal(saveState.textContent,'Saving…','old failures must not overwrite current status');
timers[0](); assert.equal(saveState.textContent,'Saving…','old success timers must not clear current status');
c.panel.isConnected=false; callbacks[2].callback('error'); assert.equal(saveState.textContent,'Saving…');
c.panel.isConnected=true;
textarea.events.input(); callbacks.at(-1).callback('local');
assert.equal(saveState.textContent,'Saved on this device','local persistence must not claim sync');
c.setAnnotationNoteValue=()=>{throw new Error('Storage unavailable');};
textarea.events.input();
assert.equal(textarea.value,'Newer draft','local persistence failure must retain the editor text');
assert.equal(saveState.textContent,'Couldn’t save on this device');
console.log('Column failure recovery passed: partial lookup warning, stale response, failure/retry, Detail draft retention and status ordering.');
