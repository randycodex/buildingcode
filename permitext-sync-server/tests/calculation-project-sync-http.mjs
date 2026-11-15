import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {calculationDraftStore, calculationDraftContent} from '../public/calculation-drafts.js';
import {calculationProjectSync} from '../public/calculation-project-sync.js';
import {defaultSyncCodeVersion} from '../public/sync-identity.js';

const directory = await mkdtemp(join(tmpdir(), 'permitext-calculation-sync-'));
Object.assign(process.env, {NODE_ENV: 'test', VERCEL: '', VERCEL_ENV: '',
  PERMITEXT_SYNC_DATA_PATH: join(directory, 'sync.json'), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(directory, 'assets'),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: 'synthetic-calculation-grant'});
for (const key of ['OPENAI_API_KEY', 'DATABASE_URL', 'PERMITEXT_SYNC_DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL', 'BLOB_READ_WRITE_TOKEN', 'VERCEL_OIDC_TOKEN']) delete process.env[key];
const originalFetch = globalThis.fetch;
let base, server, postgres; const controllers = [];
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  assert.equal(url.origin, base, 'Calculation sync tests forbid external/provider calls.');
  return originalFetch(input, options);
};
const memory = () => {const map = new Map(); return {getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value)};};
try {
  if (process.env.PERMITEXT_TEST_CALCULATION_POSTGRES === '1') {
    const {startResearchV2Postgres} = await import('./research-v2-local-postgres.mjs');
    postgres = await startResearchV2Postgres(); process.env.PERMITEXT_SYNC_DATABASE_URL = postgres.connectionString;
  }
  const {handleRequest} = await import('../app.mjs');
  server = createServer(handleRequest); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, body, userID, token) {
    const response = await fetch(base + path, {method: 'POST', headers: {'content-type': 'application/json', ...(token ? {authorization: `Bearer ${token}`} : {})},
      body: JSON.stringify({auth: {accountUserID: userID}, ...body})});
    const payload = await response.json();
    if (!response.ok) {const error = new Error(payload.error); Object.assign(error, {status: response.status, payload}); throw error;}
    return payload;
  }
  async function account(name) {
    const userID = `apple:${name}`;
    await request('/admin/lifetime-grants/grant', {userID}, userID, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
    const login = await request('/account/sign-in', {credential: {provider: 'apple', providerUserID: name, email: `${name}@example.test`, displayName: name}}, userID);
    return {userID, post: (path, body) => request(path, body, userID, login.account.backendSessionToken)};
  }
  const owner = await account('calculation-owner'), other = await account('calculation-other');
  const projectID = 'calculation-project', secondProjectID = 'calculation-project-two';
  for (const id of [projectID, secondProjectID]) await owner.post('/sync/push', {batch: {user: {id: owner.userID}, mutations: [{project: {
    id: `record-${id}`, clientID: id, userID: owner.userID, name: id, codeVersion: defaultSyncCodeVersion,
    colorHex: '#334455', sortOrder: 0, updatedAt: new Date().toISOString()}}]}});
  const context = JSON.stringify([projectID, '2152', defaultSyncCodeVersion, 'manual']);
  const storageA = memory(), storageB = memory();
  const a = calculationDraftStore(storageA, 'private-owner'), b = calculationDraftStore(storageB, 'private-owner');
  for (const [spaceName, area, factor] of [['Example · Office', '1500', '100'], ['Example · Classroom', '600', '20'], ['Example · Storage', '1200', '300']]) {
    const draft = a.create(context); a.update(draft, {spaceName, area, factor, seating: 'without-fixed-seating'});
  }
  const controller = (store, post = owner.post, isCurrent = () => true) => {
    const sync = calculationProjectSync({store, projectID, request: post, isCurrent, debounceMs: 10}); controllers.push(sync); return sync;
  };
  const deviceA = controller(a), deviceB = controller(b);
  await deviceA.refresh(); assert.equal(a.pending(projectID).length, 0, deviceA.status().error);
  await deviceB.refresh(); assert.equal(b.list(context).length, 3);
  assert.deepEqual(b.list(context).map(record => record.input.spaceName).sort(), a.list(context).map(record => record.input.spaceName).sort());
  const office = a.list(context).find(record => record.input.spaceName === 'Example · Office');
  let offline = true;
  const offlineDevice = controller(a, (path, body) => offline ? Promise.reject(new Error('Offline')) : owner.post(path, body));
  a.update(a.get(office.id), {...office.input, area: '1700'});
  await offlineDevice.flush(); assert.equal(offlineDevice.status().state, 'error'); assert.equal(a.pending(projectID).length, 1);
  offline = false; await offlineDevice.refresh(); await deviceB.refresh();
  assert.equal(b.get(office.id).input.area, '1700', 'Offline edits sync without creating a Note.');
  assert.equal(calculationDraftStore(storageA, 'private-owner').get(office.id).serverVersion, b.get(office.id).serverVersion, 'Reload retains the server version.');

  // Separate devices edit the same base. Both inputs must survive the conflict.
  a.update(a.get(office.id), {...a.get(office.id).input, area: '1800'});
  b.update(b.get(office.id), {...b.get(office.id).input, area: '1900'});
  await deviceB.flush(); await deviceA.refresh(); await deviceB.refresh();
  assert.equal(b.get(office.id).input.area, '1900');
  assert(b.list(context).some(record => record.input.area === '1800' && /conflict copy/.test(record.input.spaceName)));
  assert.equal(b.list(context).length, 4, 'Concurrent edits retain the original and a conflict copy.');

  // A delayed acknowledgement cannot erase a subsequent keystroke.
  let release, started;
  const gate = new Promise(resolve => {release = resolve;});
  const start = new Promise(resolve => {started = resolve;});
  const delayed = controller(a, async (path, body) => {const result = await owner.post(path, body); if (path.endsWith('/save')) {started(); await gate;} return result;});
  a.update(a.get(office.id), {...a.get(office.id).input, area: '2000'});
  const saving = delayed.flush(); await start;
  a.update(a.get(office.id), {...a.get(office.id).input, area: '2100'});
  release(); await saving; assert.equal(a.get(office.id).input.area, '2100'); assert.equal(a.pending(projectID).length, 1);
  await delayed.flush(); await deviceB.refresh(); assert.equal(b.get(office.id).input.area, '2100');

  // A committed request with a lost response retries without making duplicates.
  a.update(a.get(office.id), {...a.get(office.id).input, area: '2200'});
  const lostResponse = controller(a, async (path, body) => {await owner.post(path, body); throw new Error('Connection lost after commit');});
  await lostResponse.flush(); assert.equal(a.pending(projectID).length, 1);
  await deviceA.refresh(); assert.equal(a.pending(projectID).length, 0); assert.equal(a.list(context).length, 4);

  // Signing out while a response is in flight must not acknowledge into another account.
  let accountCurrent = true, releaseAccount, accountStarted;
  const accountGate = new Promise(resolve => {releaseAccount = resolve;});
  const accountStart = new Promise(resolve => {accountStarted = resolve;});
  a.update(a.get(office.id), {...a.get(office.id).input, area: '2300'});
  const oldAccount = controller(a, async (path, body) => {const result = await owner.post(path, body); accountStarted(); await accountGate; return result;}, () => accountCurrent);
  const oldSave = oldAccount.flush(); await accountStart; accountCurrent = false; releaseAccount(); await oldSave;
  assert.equal(a.pending(projectID).length, 1, 'Late old-account response cannot clear the durable outbox.');
  await deviceA.refresh(); assert.equal(a.pending(projectID).length, 0);

  const payload = {...calculationDraftContent(a.get(office.id)), calculationID: office.id, expectedVersion: 0, projectID};
  await assert.rejects(other.post('/projects/calculations/list', {projectID}), error => [403, 404].includes(error.status));
  await assert.rejects(owner.post('/projects/calculations/save', {...payload, projectID: secondProjectID}), error => error.status === 400);
  await assert.rejects(owner.post('/projects/calculations/save', {...payload, input: {...payload.input, area: '1'}}), error => error.status === 409);
  assert.equal((await owner.post('/projects/calculations/list', {projectID: secondProjectID})).calculations.length, 0);
  assert.equal((await owner.post('/notebook/cards/list', {projectID})).cards.length, 0, 'Auto-save creates no Notebook cards.');
  const dormant = controller(a, () => {throw Error('Wrong account request');}, () => false); await dormant.refresh();
  console.log('Project calculation sync passed: three legacy drafts, independent devices, reload, offline recovery, concurrent copies, delayed acknowledgements, lost responses, account switches, project/account isolation, version guards, and no Notes/provider calls.');
} finally {
  controllers.forEach(controller => controller.dispose()); globalThis.fetch = originalFetch;
  if (server) {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
  if (postgres) await postgres.close();
  await rm(directory, {recursive: true, force: true});
}
