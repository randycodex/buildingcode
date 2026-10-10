import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultSyncCodeVersion } from "../public/sync-identity.js";
import { historicalConstructionSyncCodeVersion } from "../historical-construction-content.mjs";
import { parseFragment } from "parse5";
import { reportSavedSourceID, savedExportSourceText } from "../report-evidence.mjs";

const directory = await mkdtemp(join(tmpdir(), "permitext-report-evidence-"));
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "",
  PERMITEXT_SYNC_DATA_PATH: join(directory, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(directory, "assets"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "synthetic-export-grant" });
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"]) delete process.env[key];
const originalFetch = globalThis.fetch;
let base;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  assert.equal(url.origin, base, "Report exports must not call providers or external services.");
  return originalFetch(input, options);
};
let server;
try {
  const { handleRequest, createFileStoreAdapter, allSectionCatalogByID } = await import("../app.mjs");
  server = createServer(handleRequest);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const userID = "apple:synthetic-report-export", projectID = "synthetic-export-project";
  let token;
  async function post(path, body, expected = 200, bearer = token, accountUserID = userID) {
    const response = await fetch(`${base}${path}`, { method: "POST",
      headers: { "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify({ auth: { accountUserID }, ...body }) });
    const json = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(json).slice(0, 500)}`);
    return json;
  }
  await post("/admin/lifetime-grants/grant", { userID }, 200, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  token = (await post("/account/sign-in", { credential: { provider: "apple", providerUserID: "synthetic-report-export", email: "export@example.test", displayName: "Synthetic exporter" } })).account.backendSessionToken;
  const sections = [...(await allSectionCatalogByID()).values()];
  const current = sections.find(section => section.codePrefix === "BC" && (section.codeVersion || defaultSyncCodeVersion) === defaultSyncCodeVersion && String(section.sectionNumber) === "101.2");
  const historical = sections.find(section => section.codePrefix === "BC" && section.codeVersion === historicalConstructionSyncCodeVersion && String(section.sectionNumber) === "101.2");
  const table = sections.find(section => section.codePrefix === "BC" && !section.codeVersion && String(section.sectionNumber) === "1020.1.2");
  const deadEnd = sections.find(section => section.codePrefix === "BC" && !section.codeVersion && String(section.sectionNumber) === "1020.4");
  assert(current && historical && table && deadEnd);
  const savedRecords = [current, historical, table, deadEnd].map(section => ({ sectionID: String(section.id),
    codeVersion: section.codeVersion || defaultSyncCodeVersion, folderClientID: projectID, scope: "section", blockID: "" }));
  const updatedAt = "2026-10-10T15:00:00.000Z";
  async function push(mutations) {
    await post("/sync/push", { batch: { user: { id: userID }, mutations } });
  }
  await push([{ project: { id: "synthetic-project-record", userID, clientID: projectID, name: "Export review Project",
    codeVersion: defaultSyncCodeVersion, colorHex: "#334455", sortOrder: 0, updatedAt } },
    ...savedRecords.map((record, index) => ({ projectSection: { ...record, id: `saved-project-${index}`, userID, updatedAt } })),
    { annotation: { id: "scope-note", userID, sectionID: String(current.id), codeVersion: defaultSyncCodeVersion, blockID: "", noteBody: "Original scope note.", updatedAt } },
    { annotation: { id: "historical-note", userID, sectionID: String(historical.id), codeVersion: historicalConstructionSyncCodeVersion, blockID: "", noteBody: "Historical note stays with 2014.", updatedAt } }
  ]);
  const adapter = createFileStoreAdapter();
  assert(!(await adapter.listProjectLinks(userID)).some(link => link.targetKind === "canonicalSection"), "Fixture proves Report works before a foundation link has been materialized.");
  let palette = await post("/reports/sources/list", { projectID });
  assert.equal(palette.sources.filter(source => source.kind === "evidence").length, 4);
  assert.equal(palette.warnings.length, 0);
  for (const [index, section] of [current, historical, table, deadEnd].entries()) {
    const source = palette.sources.find(source => source.id === reportSavedSourceID(savedRecords[index]));
    assert.equal(source.chapterNumber, String(section.chapterNumber));
    assert.equal(source.selectionKind, "section");
    assert.equal(source.previewText.length, 240);
    assert.doesNotMatch(source.previewText, /saved notes? included/);
    assert.deepEqual(source.notes.map(note => note.body), index === 0 ? ["Original scope note."] :
      index === 1 ? ["Historical note stays with 2014."] : []);
  }
  const blocks = savedRecords.map((record, index) => ({ id: `evidence-${index}`, kind: "evidence", sourceID: reportSavedSourceID(record), label: "Selected saved code" }));
  const { draft } = await post("/reports/drafts/save", { projectID, expectedVersion: 0, title: "Complete evidence report", reportDate: "2026-10-10", blocks }, 201);
  const issued = await post("/reports/generate", { projectID, draftID: draft.id, expectedVersion: draft.version }, 201);
  const evidence = issued.manifest.items.filter(item => item.kind === "evidence");
  assert(evidence.find(item => item.sectionID === String(current.id)).passageText.length > 240);
  assert(issued.manifest.items.some(item => item.text === "Original scope note."));
  assert(issued.manifest.items.some(item => item.text === "Historical note stays with 2014."));
  assert(evidence.some(item => item.codeEdition.includes("2014")));
  assert.match(evidence.find(item => item.sectionID === String(table.id)).passageText, /Occupancy \| Required Fire Resistance Rating/);
  assert.match(evidence.find(item => item.sectionID === String(deadEnd.id)).passageText, /24\s*384/);
  assert(issued.manifest.sourceVersions.selections.some(source => source.hasTables));
  const file = issued.generatedReport.file;
  const response = await fetch(`${base}/reports/files/read`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ auth: { accountUserID: userID }, projectID, generatedReportID: file.generatedReportID }) });
  assert.equal(response.status, 200);
  const pdf = Buffer.from(await response.arrayBuffer());
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  if (process.env.PERMITEXT_EXPORT_QA_PDF) await writeFile(process.env.PERMITEXT_EXPORT_QA_PDF, pdf);
  await push([{ annotation: { id: "scope-note", userID, sectionID: String(current.id), codeVersion: defaultSyncCodeVersion, blockID: "", noteBody: "Revised scope note.", updatedAt: "2026-10-10T16:00:00.000Z" } }]);
  const reissued = await post("/reports/generate", { projectID, draftID: draft.id, expectedVersion: draft.version }, 201);
  assert.equal(reissued.manifest.reportVersion, 2);
  assert(reissued.manifest.items.some(item => item.text === "Revised scope note."));
  assert(!reissued.manifest.items.some(item => item.text === "Original scope note."));
  assert.deepEqual((await post("/reports/manifests/get", { projectID, manifestID: issued.manifest.id })).manifest, issued.manifest, "A later note update must not rewrite an issued Report.");
  assert.equal((await post("/reports/history/list", { projectID })).reports.length, 2);
  await post("/reports/generate", { projectID, draftID: draft.id, expectedVersion: 999 }, 409);
  await post("/reports/sources/list", { projectID }, 401, "invalid-session");
  await post("/reports/sources/list", { projectID: "not-owned" }, 404);
  // A selected real HTML paragraph must preserve its exact boundary through Report.
  const sourceResponse = await fetch(`${base}/code/sections/${deadEnd.id}`);
  assert.equal(sourceResponse.status, 200);
  const { section: sourceBody } = await sourceResponse.json();
  const html = (sourceBody.blocks || []).map(block => block.html || "").join("");
  const anchors = [];
  const visit = node => {
    const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
    if (attrs.id && /(?:^|\s)Normal-Level(?:\s|$)/.test(attrs.class || "")) anchors.push(attrs.id);
    (node.childNodes || []).forEach(visit);
  };
  visit(parseFragment(html));
  const paragraphID = anchors.find(id => {
    const text = savedExportSourceText(sourceBody, id);
    return /80 feet/.test(text) && !/Group I-3|least width/.test(text);
  });
  assert(paragraphID, "Use an actual Reader paragraph anchor.");
  const paragraphRecord = { ...savedRecords[3], blockID: paragraphID, scope: "manual" };
  await push([{ projectSection: { ...paragraphRecord, userID, id: "selected-paragraph", updatedAt } },
    { annotation: { id: "paragraph-note", userID, sectionID: String(deadEnd.id), codeVersion: defaultSyncCodeVersion,
      blockID: paragraphID, noteBody: "Only the selected final exception.", updatedAt } }]);
  palette = await post("/reports/sources/list", { projectID });
  const paragraphSourceID = reportSavedSourceID(paragraphRecord);
  const paragraphSource = palette.sources.find(source => source.id === paragraphSourceID);
  assert(paragraphSource);
  assert.equal(paragraphSource.selectionKind, "paragraph");
  assert.equal(paragraphSource.chapterNumber, "10");
  assert.equal(paragraphSource.previewText, savedExportSourceText(sourceBody, paragraphID).replace(/\s+/g, " ").trim().slice(0, 240));
  assert.doesNotMatch(paragraphSource.previewText, /Group I-3|least width/);
  assert.deepEqual(paragraphSource.notes.map(note => note.body), ["Only the selected final exception."]);
  const { draft: paragraphDraft } = await post("/reports/drafts/save", { projectID, expectedVersion: 0,
    title: "Selected paragraph report", reportDate: "2026-10-10", blocks: [{ id: "selected-p", kind: "evidence", sourceID: paragraphSourceID, label: "Final exception" }] }, 201);
  const paragraphReport = await post("/reports/generate", { projectID, draftID: paragraphDraft.id, expectedVersion: paragraphDraft.version }, 201);
  const paragraphEvidence = paragraphReport.manifest.items.find(item => item.kind === "evidence");
  assert.match(paragraphEvidence.passageText, /80 feet/);
  assert.doesNotMatch(paragraphEvidence.passageText, /Group I-3|least width/);
  assert(paragraphReport.manifest.items.some(item => item.text === "Only the selected final exception."));
  // Keep a real owned Project when testing a downgrade; Free cannot create Projects.
  await post("/admin/lifetime-grants/revoke", { userID }, 200, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  await post("/reports/drafts/save", { projectID, expectedVersion: 0, title: "Free report", reportDate: "2026-10-10", blocks: [] }, 403);
  await post("/reports/generate", { projectID, draftID: draft.id, expectedVersion: draft.version }, 403);
  assert((await post("/reports/history/list", { projectID })).reports.some(report => report.id === issued.manifest.id), "A downgrade retains issued versions.");
  console.log("Report export HTTP passed: Project Saved sources without a foundation checkpoint, canonical full text and tables, notes, exact editions, stored PDF, immutable versions and revision/auth fences.");
} finally {
  globalThis.fetch = originalFetch;
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
