import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {defaultSyncCodeVersion} from '../public/sync-identity.js';
import {reportPageFormats} from '../public/document-layout.js';

const directory = await mkdtemp(join(tmpdir(), 'permitext-report-pages-'));
Object.assign(process.env, {NODE_ENV: 'test', VERCEL: '', VERCEL_ENV: '',
  PERMITEXT_SYNC_DATA_PATH: join(directory, 'sync.json'), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(directory, 'assets'),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: 'synthetic-report-pages-grant'});
for (const key of ['OPENAI_API_KEY', 'DATABASE_URL', 'PERMITEXT_SYNC_DATABASE_URL', 'POSTGRES_URL', 'NEON_DATABASE_URL', 'BLOB_READ_WRITE_TOKEN', 'VERCEL_OIDC_TOKEN']) delete process.env[key];
const originalFetch = globalThis.fetch;
let base, server, token;
globalThis.fetch = (input, options) => {
  assert.equal(new URL(typeof input === 'string' ? input : input.url).origin, base, 'Page layout tests forbid external/provider calls.');
  return originalFetch(input, options);
};
const userID = 'apple:report-pages-owner', projectID = 'report-pages-project';
async function request(path, body, bearer = token) {
  return fetch(base + path, {method: 'POST', headers: {'content-type': 'application/json', ...(bearer ? {authorization: `Bearer ${bearer}`} : {})},
    body: JSON.stringify({auth: {accountUserID: userID}, ...body})});
}
async function post(path, body, status = 200, bearer = token) {
  const response = await request(path, body, bearer); const payload = await response.json();
  assert.equal(response.status, status, `${path}: ${JSON.stringify(payload).slice(0, 500)}`); return payload;
}
async function layout(bytes, format) {
  const pdf = await getDocument({data: new Uint8Array(bytes), disableFontFace: true, useSystemFonts: false}).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n); const viewport = page.getViewport({scale: 1});
    assert(Math.abs(viewport.width - format.width) < .01); assert(Math.abs(viewport.height - format.height) < .01);
    pages.push((await page.getTextContent()).items.map(item => [item.str, item.transform]));
  }
  await pdf.destroy(); return pages;
}
try {
  const {handleRequest} = await import('../app.mjs');
  server = createServer(handleRequest); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  await post('/admin/lifetime-grants/grant', {userID}, 200, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  token = (await post('/account/sign-in', {credential: {provider: 'apple', providerUserID: 'report-pages-owner', email: 'report-pages@example.test', displayName: 'Page layout test'}})).account.backendSessionToken;
  for (const id of [projectID, 'other-project']) await post('/sync/push', {batch: {user: {id: userID}, mutations: [{project: {
    id: `record-${id}`, clientID: id, userID, name: id, description: 'Synthetic project', address: '100 Synthetic Street',
    codeVersion: defaultSyncCodeVersion, colorHex: '#334455', sortOrder: 0, updatedAt: new Date().toISOString()}}]}});
  let draft;
  const body = {projectID, title: 'Paper format preview test', reportDate: '2026-11-15', introduction: 'Previewed without issuing a version.',
    blocks: Array.from({length: 16}, (_, n) => ({id: `paragraph-${n}`, kind: 'paragraph', text: `Paragraph ${n}. ` + 'Printable source content and qualifications remain in the report. '.repeat(18)}))};
  for (const [pageFormat, format] of Object.entries(reportPageFormats)) {
    ({draft} = await post('/reports/drafts/save', {...body, pageFormat, ...(draft ? {draftID: draft.id, expectedVersion: draft.version} : {expectedVersion: 0})}, draft ? 200 : 201));
    assert.equal(draft.pageFormat, pageFormat);
    const historyBefore = (await post('/reports/history/list', {projectID})).reports;
    const response = await request('/reports/drafts/preview', {projectID, draftID: draft.id, expectedVersion: draft.version});
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /application\/pdf/);
    assert.match(response.headers.get('cache-control'), /no-store/);
    const preview = Buffer.from(await response.arrayBuffer());
    const pages = await layout(preview, format);
    const editResponse = await request('/reports/drafts/preview',{projectID,draftID:draft.id,expectedVersion:draft.version,editingLayout:true});
    assert.equal(editResponse.status,200);
    const edit = await editResponse.json();
    assert.equal(edit.layout.pages.length,pages.length);
    assert(edit.layout.regions.some(region=>region.id==='__title' && region.page===1));
    for(const n of Array.from({length:16},(_,n)=>n)) assert(edit.layout.regions.some(region=>region.id===`paragraph-${n}`));
    for(const region of edit.layout.regions) {
      assert(region.page>=1 && region.page<=pages.length);
      assert(region.x>=0 && region.y>=0 && region.width>=0 && region.height>=0);
      assert(region.y+region.height<=format.height+1,'Editable bounds come from real painted PDF content');
    }
    assert.deepEqual((await layout(Buffer.from(edit.pdf,'base64'),format)).slice(1),pages.slice(1),
      'Measuring edit regions never changes printable content or page boundaries');
    assert(pages.length > 2);
    assert.deepEqual((await post('/reports/history/list', {projectID})).reports, historyBefore, 'Preview does not create versions.');
    assert.equal((await post('/reports/drafts/get', {projectID, draftID: draft.id})).draft.version, draft.version, 'Preview does not save or mutate the draft.');
    const issued = await post('/reports/generate', {projectID, draftID: draft.id, expectedVersion: draft.version}, 201);
    assert.equal(issued.manifest.pageFormat, pageFormat);
    const download = await request('/reports/files/read', {projectID, generatedReportID: issued.generatedReport.file.generatedReportID});
    const exported = Buffer.from(await download.arrayBuffer());
    const exportedPages = await layout(exported, format);
    assert.equal(exportedPages.length, pages.length);
    assert.deepEqual(exportedPages.slice(1), pages.slice(1), 'Preview/export body content and exact positions have identical pagination.');
    if (process.env.PERMITEXT_REPORT_PAGE_QA_DIR) await writeFile(join(process.env.PERMITEXT_REPORT_PAGE_QA_DIR, `report-pages-${pageFormat}.pdf`), preview);
  }
  const current = {...body, draftID: draft.id, expectedVersion: draft.version};
  const {draft:blank}=await post('/reports/drafts/save',{projectID,title:'Blank report',reportDate:'2026-11-15',expectedVersion:0,blocks:[]},201);
  const blankResponse=await request('/reports/drafts/preview',{projectID,draftID:blank.id,expectedVersion:blank.version,editingLayout:true});
  assert.equal(blankResponse.status,200);
  const blankPacket=await blankResponse.json();
  assert.equal(blankPacket.layout.pages.length,2,'An empty report has a real cover and blank writing page');
  await post('/reports/drafts/save', {...current, pageFormat: 'a3'}, 400);
  const legacy = await post('/reports/drafts/save', current);
  assert.equal(legacy.draft.pageFormat, 'tabloid', 'A client without the new field preserves the chosen 11 × 17 format.');
  await post('/reports/drafts/preview', {projectID, draftID: draft.id, expectedVersion: draft.version}, 409);
  await post('/reports/drafts/preview', {projectID: 'other-project', draftID: draft.id}, 404);
  const unauthenticated = await request('/reports/drafts/preview', {projectID, draftID: draft.id}, null);
  assert.equal(unauthenticated.status, 401);
  console.log('Report page layout HTTP passed: Letter/A4/Legal/Tabloid persistence, exact PDF preview/export pagination, no issued preview versions or draft mutation, legacy compatibility, stale-version and ownership/auth fences.');
} finally {
  globalThis.fetch = originalFetch;
  if (server) {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
  await rm(directory, {recursive: true, force: true});
}
