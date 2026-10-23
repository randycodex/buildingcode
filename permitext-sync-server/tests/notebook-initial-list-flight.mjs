import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('async function loadInitialNotebookCardList(');
const actual = source.slice(start, source.indexOf('\n}', start) + 2);
let identity = {userID: 'a', sessionToken: 'session-a', generation: 1};
const requests = [];
const runtime = vm.createContext({structuredClone, activeWorkspaceID: 'workspace-a',
  captureAccountRequest: () => ({...identity}),
  requireCurrentAccountRequest(captured) { if (JSON.stringify(captured) !== JSON.stringify(identity)) throw Error('Account changed'); },
  accountContextChangedError: () => Error('Workspace changed'), projectDetailKey: p => p.id,
  postResearch(path, body) {
    assert.equal(path, '/notebook/cards/list');
    let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;});
    requests.push({body, resolve, reject}); return promise;
  }
});
vm.runInContext('const initialNotebookCardListReads = new Map();\n' + actual, runtime);
const tick = () => new Promise(resolve => setImmediate(resolve));
const a = runtime.loadInitialNotebookCardList({id: 'p'}), b = runtime.loadInitialNotebookCardList({id: 'p'});
await tick(); assert.equal(requests.length, 1, 'Two initial Note columns share one list request');
requests[0].resolve({cards: [{id: 'note', title: 'Original'}]});
const left = await a, right = await b;
left.cards[0].title = 'Local edit'; assert.equal(right.cards[0].title, 'Original');
const fresh = runtime.loadInitialNotebookCardList({id: 'p'}); await tick(); assert.equal(requests.length, 2);
requests[1].resolve({cards: [{title: 'Current server title'}]});
assert.equal((await fresh).cards[0].title, 'Current server title', 'A later reopen reads fresh private metadata');
const privateProject = runtime.loadInitialNotebookCardList({id: 'p'});
const otherProject = runtime.loadInitialNotebookCardList({id: 'other'});
const sharedProject = runtime.loadInitialNotebookCardList({id: 'p', sharedOrganizationID: 'firm'});
await tick(); assert.equal(requests.length, 5, 'Project and shared-access scopes never coalesce');
requests.slice(2,5).forEach(r => r.resolve({cards: []})); await Promise.all([privateProject, otherProject, sharedProject]);
const stale = runtime.loadInitialNotebookCardList({id: 'p'}), rejected = assert.rejects(stale, /Account changed/);
await tick(); identity = {userID: 'b', sessionToken: 'session-b', generation: 2};
const next = runtime.loadInitialNotebookCardList({id: 'p'}); await tick(); assert.equal(requests.length, 7);
requests[5].resolve({cards: [{title: 'Old account'}]}); requests[6].resolve({cards: [{title: 'New account'}]});
await rejected; assert.equal((await next).cards[0].title, 'New account');
const beforeSwitch = runtime.loadInitialNotebookCardList({id: 'p'}), switched = assert.rejects(beforeSwitch, /Workspace changed/);
await tick(); runtime.activeWorkspaceID = 'workspace-b';
const afterSwitch = runtime.loadInitialNotebookCardList({id: 'p'}); await tick();
requests[7].resolve({cards: []}); requests[8].resolve({cards: []}); await switched; await afterSwitch;
const failed = runtime.loadInitialNotebookCardList({id: 'p'}), failure = assert.rejects(failed, /Network failed/);
await tick(); requests[9].reject(Error('Network failed')); await failure;
const retry = runtime.loadInitialNotebookCardList({id: 'p'}); await tick(); requests[10].resolve({cards: []}); await retry;
assert.equal(vm.runInContext('initialNotebookCardListReads.size', runtime), 0, 'Settled success, stale results and errors retain no private payloads');
assert.match(source, /loadInitialProjectFoundation\(identity\),\s*loadInitialNotebookCardList\(identity\)/);
console.log('Initial Notebook lists: one concurrent read, independent payloads, fresh reopen, account/workspace/project/shared isolation, retries and zero settled retention passed.');
