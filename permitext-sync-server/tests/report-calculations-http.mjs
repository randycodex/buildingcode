import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defaultSyncCodeVersion} from '../public/sync-identity.js';
import {normalizeReportManifestItem} from '../report-contract.mjs';
import {occupantLoadTable, occupantLoadTableInput} from '../public/occupant-load-calculation.js';
import {parseFragment} from 'parse5';

const directory = await mkdtemp(join(tmpdir(), 'permitext-report-calculations-'));
Object.assign(process.env, {NODE_ENV: 'test', VERCEL: '', VERCEL_ENV: '',
  PERMITEXT_SYNC_DATA_PATH: join(directory, 'sync.json'), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(directory, 'assets'),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: 'synthetic-report-calculation-grant'});
for (const key of ['OPENAI_API_KEY', 'DATABASE_URL', 'PERMITEXT_SYNC_DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL', 'BLOB_READ_WRITE_TOKEN', 'VERCEL_OIDC_TOKEN']) delete process.env[key];
const originalFetch = globalThis.fetch; let base, server, postgres;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  assert.equal(url.origin, base, 'Report calculation tests forbid external/provider calls.');
  return originalFetch(input, options);
};
try {
  if (process.env.PERMITEXT_TEST_CALCULATION_POSTGRES === '1') {
    const {startResearchV2Postgres} = await import('./research-v2-local-postgres.mjs');
    postgres = await startResearchV2Postgres(); process.env.PERMITEXT_SYNC_DATABASE_URL = postgres.connectionString;
  }
  const {handleRequest} = await import('../app.mjs');
  server = createServer(handleRequest); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const userID = 'apple:report-calculation-owner', projectID = 'report-calculation-project'; let token;
  async function post(path, body, expected = 200, bearer = token) {
    if (path === '/reports/drafts/save') body = {reportDate: '2026-11-15', ...body};
    const response = await fetch(base + path, {method: 'POST', headers: {'content-type': 'application/json', ...(bearer ? {authorization: `Bearer ${bearer}`} : {})},
      body: JSON.stringify({auth: {accountUserID: userID}, ...body})});
    const payload = await response.json(); assert.equal(response.status, expected, `${path}: ${JSON.stringify(payload).slice(0, 500)}`); return payload;
  }
  await post('/admin/lifetime-grants/grant', {userID}, 200, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  token = (await post('/account/sign-in', {credential: {provider: 'apple', providerUserID: 'report-calculation-owner', email: 'report-calculation@example.test', displayName: 'Calculation test'}})).account.backendSessionToken;
  for (const id of [projectID, 'other-project']) await post('/sync/push', {batch: {user: {id: userID}, mutations: [{project: {
    id: `record-${id}`, clientID: id, userID, name: id, description: 'Synthetic report context', address: '100 Synthetic Street',
    codeVersion: defaultSyncCodeVersion, colorHex: '#334455', sortOrder: 0, updatedAt: new Date().toISOString()}}]}});
  const context = JSON.stringify([projectID, '2152', defaultSyncCodeVersion, 'manual']);
  const section = JSON.parse(await readFile(new URL('../../NYC CC APP/NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes/prepared/sections/2152.json', import.meta.url), 'utf8'));
  const table = occupantLoadTable(section.blocks, {sectionID: '2152', sectionNumber: '1004.1.3', codePrefix: 'BC', codeVersion: defaultSyncCodeVersion}, parseFragment);
  const row = table.rows.find(item => item.label.startsWith('Business areas'));
  const input = occupantLoadTableInput({spaceName: 'Office example', area: '1500', seating: 'without-fixed-seating', spaceLocation: 'interior'}, table, row.id);
  const saved = await post('/projects/calculations/save', {projectID, context, calculationID: 'office-example', expectedVersion: 0, input}, 201);
  await post('/projects/calculations/save', {projectID, context, calculationID: 'custom-example', expectedVersion: 0,
    input: {...input, spaceName: 'Custom factor example', factorMode: 'custom', factor: '50', tableFactor: '100', customReason: 'Synthetic alternate design reference CALC-7'}}, 201);
  await post('/projects/calculations/save', {projectID, context, calculationID: 'incomplete-example', expectedVersion: 0,
    input: {spaceName: 'Incomplete example'}}, 201);
  const sources = (await post('/reports/sources/list', {projectID})).sources;
  assert.equal(sources.filter(source => source.kind === 'calculation').length, 3);
  const source = sources.find(source => source.kind === 'calculation' && source.id === 'office-example');
  assert.equal(source.sourceClassification, 'user-authored'); assert.match(source.summary, /15 people/); assert.equal(source.unavailableReason, '');
  assert(sources.find(source => source.id === 'incomplete-example').unavailableReason);
  const preview = await post('/reports/sources/preview', {projectID, kind: 'calculation', sourceID: source.id});
  assert.match(preview.preview.map(part => part.text).join('\n'), /1500.*100.*15 people/);
  assert.match(preview.items[0].plainText, /Space location \(user-stated\): interior/);
  assert.match(preview.items[0].plainText, /Needs review/);
  const presentation = preview.preview.find(part => part.calculation)?.calculation;
  assert.equal(presentation.result, '15 people');
  assert(presentation.rows.some(row => row.label === 'Floor area' && row.value === '1500 ft² (gross)'));
  assert(presentation.rows.some(row => row.label === 'Location (user-stated)' && /Interior only/.test(row.value)));
  assert.match(presentation.basis, /b\. For the purposes of occupant load calculation/);
  assert.match(presentation.basis, /d\. Where the maximum occupant load/);
  assert.match(presentation.source, /2022 NYC Building Code.*1004\.1\.3/);
  assert.equal(preview.items[0].sourceVersion, saved.calculation.version);
  const recomputed = normalizeReportManifestItem({...preview.items[0], people: 999, plainText: 'Forged output'});
  assert.equal(recomputed.people, 15); assert.doesNotMatch(recomputed.plainText, /999|Forged/);
  const custom = await post('/reports/sources/preview', {projectID, kind: 'calculation', sourceID: 'custom-example'});
  assert.equal(custom.items[0].people, 30); assert.match(custom.items[0].plainText, /Custom factor: 50/); assert.match(custom.items[0].plainText, /CALC-7/);
  assert(custom.preview[0].calculation.rows.some(row => row.label === 'Reason / reference' && /CALC-7/.test(row.value)));
  await post('/reports/sources/preview', {projectID, kind: 'calculation', sourceID: 'incomplete-example'}, 400);
  await post('/reports/sources/preview', {projectID: 'other-project', kind: 'calculation', sourceID: source.id}, 404);
  const block = {id: 'calculation-report-block', kind: 'calculation', sourceID: source.id, label: source.label};
  assert.match((await post('/reports/drafts/save', {projectID: 'other-project', title: 'Foreign calculation', expectedVersion: 0, blocks: [block]}, 400)).error, /source is unavailable/);
  assert.match((await post('/reports/drafts/save', {projectID, title: 'Incomplete calculation', expectedVersion: 0,
    blocks: [{...block, sourceID: 'incomplete-example'}]}, 400)).error, /source is unavailable/);
  const {draft} = await post('/reports/drafts/save', {projectID, expectedVersion: 0, title: 'Calculation report example',
    blocks: [block, {...block, id: 'custom-report-block', sourceID: 'custom-example', label: 'Custom factor example'}]}, 201);
  const first = await post('/reports/generate', {projectID, draftID: draft.id, expectedVersion: draft.version}, 201);
  assert.equal(first.manifest.items[0].kind, 'calculation'); assert.equal(first.manifest.items[0].people, 15);
  assert.equal(first.manifest.items[1].people, 30);
  const download = await fetch(base + '/reports/files/read', {method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${token}`},
    body: JSON.stringify({auth: {accountUserID: userID}, projectID, generatedReportID: first.generatedReport.file.generatedReportID})});
  assert.equal(download.status, 200); const pdf = Buffer.from(await download.arrayBuffer()); assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  if (process.env.PERMITEXT_TEST_REPORT_CALCULATION_PDF) await writeFile(process.env.PERMITEXT_TEST_REPORT_CALCULATION_PDF, pdf);
  await post('/projects/calculations/save', {projectID, context, calculationID: source.id, expectedVersion: saved.calculation.version,
    input: {...input, spaceName: 'Renamed office example', area: '2000'}});
  const updatedPreview = await post('/reports/sources/preview', {projectID, kind: 'calculation', sourceID: source.id});
  assert.equal(updatedPreview.items[0].title, 'Renamed office example');
  assert.equal(updatedPreview.preview[0].calculation.result, '20 people', 'The linked Report resolves the latest saved Calculator edit.');
  assert(updatedPreview.preview[0].calculation.rows.some(row => row.label === 'Floor area' && row.value === '2000 ft² (gross)'));
  const second = await post('/reports/generate', {projectID, draftID: draft.id, expectedVersion: draft.version}, 201);
  assert.equal(second.manifest.items[0].people, 20); assert.equal(second.manifest.items[0].sourceVersion, 2);
  assert.equal(second.manifest.items[0].title, 'Renamed office example');
  assert.deepEqual((await post('/reports/manifests/get', {projectID, manifestID: first.manifest.id})).manifest, first.manifest,
    'Later calculation edits cannot rewrite a saved PDF version.');
  const removed = await post('/reports/drafts/save', {projectID, draftID: draft.id, expectedVersion: draft.version, title: draft.title, blocks: []});
  assert.equal(removed.draft.blocks.length, 0); assert.equal((await post('/projects/calculations/list', {projectID})).calculations.length, 3);
  assert.equal((await post('/notebook/cards/list', {projectID})).cards.length, 0, 'Adding calculations to Report creates no Notes.');
  console.log('Report calculations passed: project source listing, previews, default/custom arithmetic, incomplete/foreign source denial, direct Add/Remove, PDF export, immutable versions, and no Notes/provider calls.');
} finally {
  globalThis.fetch = originalFetch;
  if (server) {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
  if (postgres) await postgres.close();
  await rm(directory, {recursive: true, force: true});
}
