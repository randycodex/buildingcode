import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../public/downloaded-library.js', import.meta.url), 'utf8'))
  .replace(/export /g, '');
const shared = new Map(), tabs = [], events = [];
let writes = 0;
function tab() {
  const listeners = new Map(), notifications = [];
  const current = {listeners, notifications};
  const localStorage = {
    getItem: key => shared.get(key) ?? null,
    setItem(key, value) {
      const oldValue = shared.get(key) ?? null;
      value = String(value);
      if (oldValue === value) return;
      shared.set(key, value); writes++;
      for (const other of tabs) if (other !== current) events.push([other, {key, newValue:value}]);
    }
  };
  const window = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    dispatchEvent: event => notifications.push(event.type)
  };
  const context = {localStorage, window, Event, setTimeout, clearTimeout};
  vm.runInNewContext(source + '\nthis.library = {useDownloadedLibrary, usesDownloadedLibrary};', context);
  current.api = context.library;
  tabs.push(current);
  return current;
}
function drain() {
  let count = 0;
  while (events.length) {
    assert(++count <= 12, 'A received storage event must not broadcast another storage write');
    const [target, event] = events.shift();
    target.listeners.get('storage')(event);
  }
}
const a = tab(), b = tab();
a.api.useDownloadedLibrary(true);
drain();
assert.equal(writes, 2, 'Only the originating tab writes the preference and invalidation signal');
assert.equal(b.api.usesDownloadedLibrary(), true);
assert.equal(a.notifications.length, 1);
assert.equal(b.notifications.length, 2);

const prior = b.notifications.length;
b.listeners.get('storage')({key:'permitext.private-workspace.v1',newValue:'changed'});
assert.equal(b.notifications.length, prior, 'Private project sync must not invalidate public library caches');
assert.equal(writes, 2);

b.api.useDownloadedLibrary(false);
drain();
assert.equal(writes, 4);
assert.equal(a.api.usesDownloadedLibrary(), false);
assert.equal(a.notifications.length, 3);

shared.clear();
a.listeners.get('storage')({key:null,newValue:null});
assert.equal(a.notifications.length, 4, 'Clearing browser preferences invalidates the local preference once');
assert.equal(writes, 4, 'Receiving a storage clear must not create a new preference');
console.log('Downloaded library cross-tab isolation passed: bounded notifications, no event echo, unrelated storage ignored and clear handled.');
