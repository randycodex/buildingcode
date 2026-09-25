// Isolated, temporary full-app fixture. Never uses owner accounts or production data.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const secondAccountOption = option("--second-account", "false");
assert.ok(["true", "false"].includes(secondAccountOption), "Use --second-account true or false");
const secondAccountEnabled = secondAccountOption === "true";
const profile = option("--profile", "small");
assert.ok(["small", "large"].includes(profile), "Use --profile small or large");
const port = Number(option("--port", "8802"));
assert.ok(Number.isInteger(port) && port > 0 && port < 65536);
const target = profile === "large"
  ? { saved: 1000, projects: 12, notes: 60, paragraphs: 100, reportBlocks: 100 }
  : { saved: 12, projects: 2, notes: 4, paragraphs: 1, reportBlocks: 8 };
const directory = await mkdtemp(join(tmpdir(), "permitext-populated-performance-"));
for (const key of Object.keys(process.env)) {
  if (/DATABASE_URL|POSTGRES_URL|STORAGE_URL|OPENAI|CLERK|BLOB_|VERCEL_|RESEND|STRIPE|APPLE_.*(SECRET|KEY)/.test(key)) delete process.env[key];
}
Object.assign(process.env, {
  NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "", PERMITEXT_TEST_RESEARCH_MOCK: "1",
  PERMITEXT_SYNC_DATA_PATH: join(directory, "sync.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(directory, "assets"),
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: randomUUID()
});
const { handleRequest } = await import("../app.mjs");
const capability = randomUUID();
const providerID = `synthetic-populated-${randomUUID()}`;
const userID = `apple:${providerID}`;
const base = `http://127.0.0.1:${port}`;
let token, account, receipt, ready = false;
let secondaryAccount = null;
let nextControl = null;
const timings = [];
const controlledRoutes = new Set(["/notebook/cards/list", "/notebook/cards/get", "/reports/drafts/get", "/reports/drafts/list", "/reports/history/list"]);
const json = (response, status, value) => response.writeHead(status, {
  "content-type": "application/json", "cache-control": "no-store"
}).end(JSON.stringify(value));
async function readJSON(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 4096) throw new Error("Fixture control body too large");
  }
  return JSON.parse(body || "{}");
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url, base);
  try {
    if (url.pathname.startsWith("/fixture/")) {
      if (url.searchParams.get("key") !== capability) return json(response, 403, { error: "Fixture capability required" });
      if (!ready) return json(response, 503, { error: "Seeding" });
      if (url.pathname === "/fixture/metrics") return json(response, 200, { receipt, requests: timings });
      if (url.pathname === "/fixture/control" && request.method === "POST") {
        const control = await readJSON(request);
        if (!controlledRoutes.has(control.path) || !Number.isInteger(control.delayMs || 0) ||
            (control.delayMs || 0) < 0 || (control.delayMs || 0) > 10000 ||
            ![undefined, false, true].includes(control.fail)) {
          return json(response, 400, { error: "Use an allowed read route, delayMs0–10000 and boolean fail" });
        }
        nextControl = { path: control.path, delayMs: control.delayMs || 0, fail: control.fail === true };
        return json(response, 200, { armed: true, ...nextControl, uses: 1 });
      }
      if (url.pathname === "/fixture/start") {
        const selected = url.searchParams.get("account") || "primary";
        if (!["primary", "secondary"].includes(selected)) return json(response, 400, { error: "Unknown fixture account" });
        if (selected === "secondary" && !secondaryAccount) return json(response, 404, { error: "Second fixture account is not enabled" });
        const stored = selected === "secondary" ? secondaryAccount
          : { userID, sessionToken: token, authProvider: "apple", displayName: "Synthetic populated workspace", entitlement: account.entitlement };
        response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store",
          "content-security-policy": "default-src 'self'; script-src 'unsafe-inline'; object-src 'none'; base-uri 'none'" });
        return response.end(`<!doctype html><meta charset="utf-8"><title>Synthetic workspace</title><script>localStorage.setItem('permitext:webAccount:v1',${JSON.stringify(JSON.stringify(stored))});location.replace('/workspace');</script>`);
      }
      return json(response, 404, { error: "Unknown fixture route" });
    }
    if (ready && url.pathname.startsWith("/research/") && request.method === "POST") {
      return json(response, 403, { error: "Research disabled in performance fixture" });
    }
    const started = performance.now();
    if (ready && controlledRoutes.has(url.pathname)) {
      response.once("finish", () => {
        timings.push({ route: url.pathname, status: response.statusCode, milliseconds: Number((performance.now() - started).toFixed(2)) });
        if (timings.length > 500) timings.shift();
      });
    }
    if (ready && nextControl?.path === url.pathname) {
      const control = nextControl;
      nextControl = null;
      if (control.delayMs) await new Promise(resolve => setTimeout(resolve, control.delayMs));
      if (control.fail) return json(response, 503, { error: "Synthetic one-shot read failure" });
    }
    await handleRequest(request, response);
  } catch {
    if (!response.headersSent) json(response, 500, { error: "Fixture request failed" });
    else response.destroy();
  }
});
await new Promise(resolve => server.listen(port, "127.0.0.1", resolve));
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  assert.equal(url.origin, base, "External/provider calls forbidden");
  return originalFetch(input, options);
};
async function post(path, body, bearer = token) {
  const response = await fetch(base + path, { method: "POST", headers: {
    "content-type": "application/json", ...(bearer ? { authorization: `Bearer ${bearer}` } : {})
  }, body: JSON.stringify({ auth: { accountUserID: userID }, ...body }) });
  const data = await response.json();
  assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
async function get(path) {
  const response = await fetch(base + path);
  assert.ok(response.ok, `${path}: ${response.status}`);
  return response.json();
}
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  globalThis.fetch = originalFetch;
  await rm(directory, { recursive: true, force: true });
  process.exit(process.exitCode || 0);
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
setTimeout(stop, 60 * 60 * 1000).unref();
try {
  await post("/admin/lifetime-grants/grant", { userID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
  account = await post("/account/sign-in", { credential: { provider: "apple", providerUserID: providerID,
    email: "populated@example.test", displayName: "Synthetic populated workspace" } });
  token = account.account.backendSessionToken;
  if (secondAccountEnabled) {
    const secondaryProviderID = `synthetic-secondary-${randomUUID()}`;
    const secondaryUserID = `apple:${secondaryProviderID}`;
    await post("/admin/lifetime-grants/grant", { userID: secondaryUserID }, process.env.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN);
    const signedIn = await post("/account/sign-in", {
      auth: { accountUserID: secondaryUserID },
      credential: { provider: "apple", providerUserID: secondaryProviderID,
        email: "secondary@example.test", displayName: "Synthetic secondary workspace" }
    }, null);
    secondaryAccount = { userID: secondaryUserID, sessionToken: signedIn.account.backendSessionToken,
      authProvider: "apple", displayName: "Synthetic secondary workspace", entitlement: signedIn.entitlement };
    assert.notEqual(secondaryAccount.userID, userID);
    assert.ok(secondaryAccount.sessionToken && secondaryAccount.sessionToken !== token, "Synthetic accounts need distinct sessions");
  }
  const versions = ["2022", "2014"].map(year => `CodeContent/authored/new-york-city/${year}-construction-codes/bundle.json#1`);
  const savedSections = [];
  for (const version of versions) {
    const catalog = await get(`/code/chapters?version=${encodeURIComponent(version)}`);
    const selected = new Map();
    for (const summary of catalog.chapters) {
      const { chapter } = await get(`/code/chapters/${encodeURIComponent(summary.id)}?bodyContract=2`);
      for (const section of chapter.sections) {
        selected.set(String(section.id), { ...section, codeVersion: version,
          codePrefix: chapter.codePrefix, chapterNumber: chapter.chapterNumber });
        if (selected.size >= target.saved / 2) break;
      }
      if (selected.size >= target.saved / 2) break;
    }
    assert.equal(selected.size, target.saved / 2);
    savedSections.push(...selected.values());
  }
  const projectIDs = Array.from({ length: target.projects }, (_, index) => `performance-project-${index + 1}`);
  const updatedAt = new Date().toISOString();
  const mutations = projectIDs.map((projectID, index) => ({ project: {
    id: `${projectID}-record`, userID, codeVersion: versions[0], clientID: projectID,
    name: `Synthetic Project ${index + 1}`, colorHex: "#334455", sortOrder: index, updatedAt
  } }));
  mutations.push(...savedSections.map(section => ({ savedItem: {
    id: `${userID}:saved:${section.codeVersion}:${section.id}`, userID,
    codeVersion: section.codeVersion, codePrefix: section.codePrefix,
    chapterNumber: section.chapterNumber, sectionID: Number(section.id),
    sectionNumber: section.sectionNumber, title: section.title, updatedAt
  } })));
  mutations.push(...savedSections.slice(0, target.saved / 2).map((section, index) => ({ projectSection: {
    id: `${userID}:membership:${index}`, userID, codeVersion: section.codeVersion,
    folderClientID: projectIDs[index % projectIDs.length], localFolderID: index % projectIDs.length + 1,
    sectionID: Number(section.id), scope: "manual", updatedAt
  } })));
  for (let offset = 0; offset < mutations.length; offset += 100) {
    await post("/sync/push", { batch: { user: { id: userID }, mutations: mutations.slice(offset, offset + 100) } });
  }
  const imageURLs = [];
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=", "base64");
  for (let index = 0; index < (profile === "large" ? 6 : 1); index++) {
    const upload = await fetch(`${base}/notebook/assets/upload?projectID=${projectIDs[0]}&assetID=${randomUUID()}`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "x-permitext-user-id": userID,
        "content-type": "image/png", "x-permitext-image-width": "1", "x-permitext-image-height": "1" }, body: png
    });
    const payload = await upload.json();
    assert.ok(upload.ok, "Synthetic Notebook image upload failed");
    assert.ok(payload.asset.url.startsWith("permitext-notebook-asset:"));
    imageURLs.push(payload.asset.url);
  }
  const noteIDs = [];
  for (let index = 0; index < target.notes; index++) {
    const count = index === 0 ? target.paragraphs : 1;
    const saved = await post("/notebook/cards/save", { projectID: projectIDs[0], expectedVersion: 0,
      clientMutationID: `performance-note-${index}`, cardType: "finding", title: `Synthetic Note ${index + 1}`,
      document: { schema: "permitext-notebook-card", schemaVersion: 2, format: "blocknote-json",
        document: [...Array.from({ length: count }, (_, paragraph) => ({ id: `note-${index}-p-${paragraph}`, type: "paragraph",
          props: {}, children: [], content: [{ type: "text", styles: {}, text: `Synthetic paragraph ${paragraph + 1}. Concrete code research workspace fixture; no professional conclusion.` }] })),
          ...(index === 0 ? imageURLs.map((url, imageIndex) => ({ id: `image-${imageIndex}`, type: "image", props: { url, name: `Synthetic image ${imageIndex + 1}`, caption: "Synthetic1pixelimage", previewWidth: 120 }, children: [] })) : [])] }
    });
    noteIDs.push(saved.card.id);
  }
  const report = await post("/reports/drafts/save", { projectID: projectIDs[0], expectedVersion: 0,
    title: "Synthetic populated report", reportDate: "2026-09-24",
    blocks: Array.from({ length: target.reportBlocks }, (_, index) => ({ id: `report-block-${index}`, kind: "heading", text: `Synthetic report block ${index + 1}` })) });
  const notes = await post("/notebook/cards/list", { projectID: projectIDs[0] });
  assert.equal(notes.cards.length, target.notes);
  assert.equal(report.draft.blocks.length, target.reportBlocks);
  const pulled = await post("/sync/pull", { syncSchemaVersion: 2 });
  const live = pulled.mutations.filter(mutation => !Object.values(mutation)[0]?.deletedAt);
  const actualSaved = live.filter(mutation => mutation.savedItem).length;
  const actualProjects = live.filter(mutation => mutation.project).length;
  const memberships = live.filter(mutation => mutation.projectSection);
  const assigned = new Set(memberships.map(({ projectSection }) => `${projectSection.codeVersion}:${projectSection.sectionID}`));
  assert.equal(actualSaved, target.saved);
  assert.equal(actualProjects, target.projects);
  assert.equal(assigned.size, target.saved / 2);
  receipt = { profile, ...target, saved: actualSaved, projects: actualProjects, assignedSaved: assigned.size, unassignedSaved: actualSaved - assigned.size, images: imageURLs.length, reports: 1, projectIDs, noteIDs,
    reportID: report.draft.id, editions: versions, externalRequestsAllowed: false, temporaryRecords: true };
  ready = true;
  if (secondaryAccount) {
    const secondaryPull = await post("/sync/pull", { auth: { accountUserID: secondaryAccount.userID }, syncSchemaVersion: 2 }, secondaryAccount.sessionToken);
    assert.equal(secondaryPull.mutations.filter(mutation => mutation.savedItem || mutation.project || mutation.projectSection).length, 0,
      "Secondary account must not receive the populated primary workspace");
    const wrongOwner = await fetch(base + "/sync/pull", { method: "POST", headers: {
      "content-type": "application/json", authorization: `Bearer ${secondaryAccount.sessionToken}`
    }, body: JSON.stringify({ auth: { accountUserID: userID }, syncSchemaVersion: 2 }) });
    assert.ok([401, 403].includes(wrongOwner.status), "Secondary session must not access the primary account");
    const primaryStart = await fetch(`${base}/fixture/start?key=${capability}`);
    const secondaryStart = await fetch(`${base}/fixture/start?key=${capability}&account=secondary`);
    assert.equal(primaryStart.status, 200); assert.equal(secondaryStart.status, 200);
    const primaryHTML = await primaryStart.text(), secondaryHTML = await secondaryStart.text();
    assert.ok(primaryHTML.includes(userID) && !primaryHTML.includes(secondaryAccount.userID));
    assert.ok(secondaryHTML.includes(secondaryAccount.userID) && !secondaryHTML.includes(userID));
    assert.equal((await fetch(`${base}/fixture/start?account=secondary`)).status, 403);
    receipt.accountIsolation = { primaryUserID: userID, secondaryUserID: secondaryAccount.userID,
      distinctAuthenticatedSessions: true, secondaryWorkspaceEmpty: true, crossAccountRequestDenied: true,
      capabilityRequired: true, bootstrapSelectionVerified: true };
  }
  console.log("POPULATED_FIXTURE_RECEIPT", JSON.stringify(receipt));
  console.log("POPULATED_FIXTURE_READY " + base + "/fixture/start?key=" + capability);
} catch (error) {
  console.error("Populated fixture seed failed:", error.message);
  process.exitCode = 1;
  await stop();
}
