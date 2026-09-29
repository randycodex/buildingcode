// Isolated, temporary full-app fixture. Never uses owner accounts or production data.
import assert from "node:assert/strict";
import { createRolloutFixture } from "./populated-rollout-fixture.mjs";
import { fileURLToPath } from "node:url";
import { summaryAttributionPrelude } from "./populated-summary-attribution.mjs";
import { createServer, request as httpRequest } from "node:http";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import { performance } from "node:perf_hooks";

const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const secondAccountOption = option("--second-account", "false");
assert.ok(["true", "false"].includes(secondAccountOption), "Use --second-account true or false");
const secondAccountEnabled = secondAccountOption === "true";
const researchHistoryOption = option("--research-history", "false");
assert.ok(["true", "false"].includes(researchHistoryOption), "Use --research-history true or false");
const researchHistoryEnabled = researchHistoryOption === "true";
const outageSelfTest = option("--self-test-outage", "false");
assert.ok(["true", "false"].includes(outageSelfTest));
const imageProfile = option("--image-profile", "tiny");
assert.ok(["tiny", "photo-size"].includes(imageProfile));
const visibleWorkload = option("--visible-workload", "default");
assert.ok(["default", "matched"].includes(visibleWorkload));
const seedSelfTest = option("--self-test-seed", "false");
assert.ok(["true", "false"].includes(seedSelfTest));
const matchedWorkload = visibleWorkload === "matched";
const profile = option("--profile", "small");
assert.ok(["small", "large"].includes(profile), "Use --profile small or large");
const port = Number(option("--port", "8802"));
assert.ok(Number.isInteger(port) && port > 0 && port < 65536);
const target = profile === "large"
  ? { saved: 1000, projects: 12, notes: 60, paragraphs: 100, reportBlocks: 100 }
  : { saved: 12, projects: 2, notes: 4, paragraphs: 1, reportBlocks: 8 };
if (matchedWorkload) { target.paragraphs = 1; target.reportBlocks = 8; }
// Synthetic 12MP decode workload, not a photograph. Paired scanlines bound the
// compressed PNG below the real 8MiB upload limit without sacrificing dimensions.
function photoSizePNG() {
  const width = 4032, height = 3024;
  const raw = Buffer.alloc((width + 1) * height);
  let seed = 0x12345678;
  for (let y = 0; y < height; y += 2) {
    const offset = y * (width + 1);
    for (let x = 1; x <= width; x++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      raw[offset + x] = seed & 255;
    }
    raw.copy(raw, offset + width + 1, offset, offset + width + 1);
  }
  const chunk = (type, payload) => {
    const bytes = Buffer.concat([Buffer.from(type), payload]);
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const result = Buffer.alloc(payload.length + 12);
    result.writeUInt32BE(payload.length, 0); bytes.copy(result, 4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8;
  const compressed = deflateSync(raw, { level: 6 });
  assert.deepEqual(inflateSync(compressed), raw);
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", header), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
  assert.ok(png.length > 5 * 1024 * 1024 && png.length < 8 * 1024 * 1024);
  return { png, width, height };
}
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
const rolloutBaselineDir = option("--rollout-baseline-dir", "");
const rollout = rolloutBaselineDir ? await createRolloutFixture({baselineDir: rolloutBaselineDir, currentDir: option("--rollout-current-dir", fileURLToPath(new URL("../public/", import.meta.url))), capability}) : null;
const providerID = `synthetic-populated-${randomUUID()}`;
const userID = `apple:${providerID}`;
const base = `http://127.0.0.1:${port}`;
let token, account, receipt, ready = false;
let secondaryAccount = null;
let nextControl = null;
const timings = [];
const benchmarkSamples = [];
const controlledRoutes = new Set(["/notebook/cards/save", "/notebook/cards/list", "/notebook/cards/get", "/reports/drafts/get", "/reports/drafts/list", "/reports/history/list"]);
const json = (response, status, value) => response.writeHead(status, {
  "content-type": "application/json", "cache-control": "no-store"
}).end(JSON.stringify(value));
async function readJSON(request, limit = 4096) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > limit) throw new Error("Fixture control body too large");
  }
  return JSON.parse(body || "{}");
}
function validBenchmarkSample(sample) {
  const number = value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 120000;
  const record = (value, keys, check) => value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every(key => keys.includes(key) && check(value[key]));
  const paneKeys = ["search", "saved", "notebook", "report"];
  const routes = ["/notebook/cards/list", "/notebook/cards/get", "/notebook/cards/save", "/reports/drafts/list", "/reports/drafts/get", "/reports/drafts/save", "/projects/foundation/state", "/sync/pull", "/sync/push", "/notebook/assets/read", "/code/*", "/static/*", "/other"];
  const fields = ["status", "observerStartedAt", "completedAt", "milestones", "counts", "checks", "resourceCounts", "longTasks", "longTasksSupported", "visibilityState", "viewport", "summaryStats", "resourceTimings"];
  return sample && Object.keys(sample).every(key => fields.includes(key)) &&
    ["ready", "timeout"].includes(sample.status) && number(sample.observerStartedAt) && number(sample.completedAt) &&
    record(sample.milestones, paneKeys, number) &&
    record(sample.counts, ["saved", "notes", "paragraphs", "images", "reportHeadings"], value => Number.isInteger(value) && number(value)) && Object.keys(sample.counts).length === 5 &&
    record(sample.checks, paneKeys, value => typeof value === "boolean") && Object.keys(sample.checks).length === 4 &&
    record(sample.resourceCounts, routes, value => Number.isInteger(value) && number(value)) &&
    record(sample.summaryStats, ["currentContentSummary", "projectEvidenceCount", "summarizeMutations"], value =>
      record(value, ["count", "totalMs", "maxMs"], number) && Object.keys(value).length === 3 && Number.isInteger(value.count)) &&
    Array.isArray(sample.resourceTimings) && sample.resourceTimings.length <= 150 && sample.resourceTimings.every(item =>
      item && Object.keys(item).length === 6 && routes.includes(item.route) &&
      [item.startTime, item.duration, item.responseEnd].every(number) &&
      [item.transferSize, item.decodedBodySize].every(value => Number.isInteger(value) && value >= 0 && value <= 100000000)) &&
    typeof sample.longTasksSupported === "boolean" && ["visible", "hidden"].includes(sample.visibilityState) &&
    record(sample.viewport, ["width", "height"], number) && Object.keys(sample.viewport).length === 2 &&
    Array.isArray(sample.longTasks) && sample.longTasks.length <= 100 && sample.longTasks.every(task => record(task, ["startTime", "duration"], number) && Object.keys(task).length === 2) &&
    (sample.status !== "ready" || paneKeys.every(key => sample.checks[key] && number(sample.milestones[key])));
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url, base);
  const canonicalPath = url.pathname.replace(/^\/+/, "");
  try {
    if (ready && rollout && await rollout.handle(request, response, url)) return;
    if (url.pathname.startsWith("/fixture/")) {
      if (url.searchParams.get("key") !== capability) return json(response, 403, { error: "Fixture capability required" });
      if (!ready) return json(response, 503, { error: "Seeding" });
      if (url.pathname === "/fixture/metrics") return json(response, 200, { receipt, requests: timings, control: nextControl, benchmarkSamples });
      if (url.pathname === "/fixture/benchmark.js" && request.method === "GET") {
        if (!matchedWorkload) return json(response, 400, {error: "Benchmark requires matched workload"});
        response.writeHead(200, {"content-type": "text/javascript", "cache-control": "no-store", "x-content-type-options": "nosniff"});
        return response.end(await readFile(new URL("./populated-workspace-benchmark.js", import.meta.url), "utf8"));
      }
      if (url.pathname === "/fixture/benchmark" && request.method === "POST") {
        const sample = await readJSON(request, 32768);
        if (!matchedWorkload || !validBenchmarkSample(sample)) return json(response, 400, {error: "Invalid bounded benchmark sample"});
        benchmarkSamples.push({...sample, profile, visibleContentSHA256: receipt.matchedVisibleReceipt.stableContentSHA256});
        if (benchmarkSamples.length > 20) benchmarkSamples.shift();
        return json(response, 200, {accepted: true, sampleCount: benchmarkSamples.length});
      }
      if (url.pathname === "/fixture/control" && request.method === "POST") {
        const control = await readJSON(request);
        const uses = control.uses === undefined ? 1 : control.uses;
        const saveOutage = control.path === "/notebook/cards/save";
        if (!controlledRoutes.has(control.path) || !Number.isInteger(control.delayMs || 0) ||
            (control.delayMs || 0) < 0 || (control.delayMs || 0) > 10000 ||
            ![undefined, false, true].includes(control.fail) || !Number.isInteger(uses) ||
            uses < 0 || uses > 20 || (!saveOutage && uses !== 1) ||
            (saveOutage && (control.fail !== true || (control.delayMs || 0) !== 0))) {
          return json(response, 400, { error: "Reads allow one use and delay0–10000; notebook save allows fail:true, uses0–20 (0 clears), no delay" });
        }
        nextControl = uses === 0 ? null : { path: control.path, delayMs: control.delayMs || 0, fail: control.fail === true, remaining: uses };
        return json(response, 200, { armed: Boolean(nextControl), ...nextControl, uses });
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
    if (url.pathname === "/workspace" && url.searchParams.has("fixtureBenchmark")) {
      if (!ready || !matchedWorkload || url.searchParams.get("fixtureBenchmark") !== capability) return json(response, 403, {error: "Matched fixture capability required"});
      // Preserve real application status and every security/cache header. Only
      // this capability URL augments HTML with an external same-origin observer.
      const originalEnd = response.end.bind(response);
      response.end = (body, ...args) => {
        response.end = originalEnd;
        const html = String(body);
        const injection = `<script src="/fixture/benchmark.js?key=${encodeURIComponent(capability)}"></script>`;
        return originalEnd(html.replace("<head>", `<head>${injection}`).replace(/(src="\/web\/app\.js\?[^"\s]*)"/, `$1&fixtureAttribution=${encodeURIComponent(capability)}"`), ...args);
      };
    }
    if (url.pathname === "/web/app.js" && url.searchParams.has("fixtureAttribution")) {
      if (!ready || !matchedWorkload || url.searchParams.get("fixtureAttribution") !== capability) return json(response, 403, {error: "Matched fixture capability required"});
      const originalEnd = response.end.bind(response);
      response.end = (body, ...args) => {
        response.end = originalEnd;
        return originalEnd(summaryAttributionPrelude() + String(body), ...args);
      };
    }
    if (ready && canonicalPath.startsWith("research/") && request.method === "POST" &&
        !(researchHistoryEnabled && ["research/conversations/list", "research/conversations/get", "research/usage"].includes(canonicalPath))) {
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
      control.remaining -= 1;
      if (control.remaining === 0) nextControl = null;
      if (control.delayMs) await new Promise(resolve => setTimeout(resolve, control.delayMs));
      if (control.fail) return json(response, 503, { error: control.path === "/notebook/cards/save" ? "Synthetic notebook save outage" : "Synthetic one-shot read failure" });
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
  return originalFetch(input, { ...options, redirect: "error" });
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
    name: `Synthetic Project ${index + 1}`, ...(researchHistoryEnabled ? { address: "100 Synthetic Fixture Street" } : {}), colorHex: "#334455", sortOrder: index, updatedAt
  } }));
  mutations.push(...savedSections.map(section => ({ savedItem: {
    id: `${userID}:saved:${section.codeVersion}:${section.id}`, userID,
    codeVersion: section.codeVersion, codePrefix: section.codePrefix,
    chapterNumber: section.chapterNumber, sectionID: Number(section.id),
    sectionNumber: section.sectionNumber, title: section.title, updatedAt
  } })));
  mutations.push(...savedSections.slice(0, target.saved / 2).map((section, index) => ({ projectSection: {
    id: `${userID}:membership:${index}`, userID, codeVersion: section.codeVersion,
    folderClientID: projectIDs[matchedWorkload ? (index < 3 ? 0 : 1 + (index - 3) % (projectIDs.length - 1)) : index % projectIDs.length],
    localFolderID: (matchedWorkload ? (index < 3 ? 0 : 1 + (index - 3) % (projectIDs.length - 1)) : index % projectIDs.length) + 1,
    sectionID: Number(section.id), scope: "manual", updatedAt
  } })));
  for (let offset = 0; offset < mutations.length; offset += 100) {
    await post("/sync/push", { batch: { user: { id: userID }, mutations: mutations.slice(offset, offset + 100) } });
  }
  const imageURLs = [];
  const image = imageProfile === "photo-size" ? photoSizePNG() : { width: 1, height: 1, png: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=", "base64") };
  const { png } = image;
  const imageHash = createHash("sha256").update(png).digest("hex");
  const imageReceipts = [];
  for (let index = 0; index < (profile === "large" && !matchedWorkload ? 6 : 1); index++) {
    const upload = await fetch(`${base}/notebook/assets/upload?projectID=${projectIDs[0]}&assetID=${randomUUID()}`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "x-permitext-user-id": userID,
        "content-type": "image/png", "x-permitext-image-width": String(image.width), "x-permitext-image-height": String(image.height) }, body: png
    });
    const payload = await upload.json();
    assert.ok(upload.ok, "Synthetic Notebook image upload failed");
    assert.ok(payload.asset.url.startsWith("permitext-notebook-asset:"));
    imageURLs.push(payload.asset.url);
    assert.equal(payload.asset.size, png.length);
    assert.equal(payload.asset.width, image.width); assert.equal(payload.asset.height, image.height);
    const readback = await fetch(base + "/notebook/assets/read", { method: "POST", headers: {
      "content-type": "application/json", authorization: `Bearer ${token}`
    }, body: JSON.stringify({auth: {accountUserID: userID}, projectID: projectIDs[0], assetID: payload.asset.assetID}) });
    assert.equal(readback.status, 200);
    const bytes = Buffer.from(await readback.arrayBuffer());
    assert.equal(bytes.length, png.length);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), imageHash);
    imageReceipts.push({assetID: payload.asset.assetID, width: image.width, height: image.height,
      encodedBytes: png.length, rgbaDecodeBytes: image.width * image.height * 4, sha256: imageHash, readbackVerified: true});
  }
  const noteIDs = [];
  for (let index = 0; index < target.notes; index++) {
    const count = index === 0 ? target.paragraphs : 1;
    const noteProjectID = matchedWorkload && index >= 4 ? projectIDs[1 + (index - 4) % (projectIDs.length - 1)] : projectIDs[0];
    const saved = await post("/notebook/cards/save", { projectID: noteProjectID, expectedVersion: 0,
      clientMutationID: `performance-note-${index}`, cardType: "finding", title: `Synthetic Note ${index + 1}`,
      document: { schema: "permitext-notebook-card", schemaVersion: 2, format: "blocknote-json",
        document: [...Array.from({ length: count }, (_, paragraph) => ({ id: `note-${index}-p-${paragraph}`, type: "paragraph",
          props: {}, children: [], content: [{ type: "text", styles: {}, text: `Synthetic paragraph ${paragraph + 1}. Concrete code research workspace fixture; no professional conclusion.` }] })),
          ...(index === 0 ? imageURLs.map((url, imageIndex) => ({ id: `image-${imageIndex}`, type: "image", props: { url, name: `Synthetic image ${imageIndex + 1}`, caption: imageProfile === "photo-size" ? "Synthetic 4032×3024 texture — image loading test" : "Synthetic1pixelimage", previewWidth: 120 }, children: [] })) : [])] }
    });
    noteIDs.push(saved.card.id);
    if (index === 0) for (const imageURL of imageURLs) assert.ok(JSON.stringify(saved.card.document).includes(imageURL), "Saved note must retain the uploaded image reference");
  }
  const report = await post("/reports/drafts/save", { projectID: projectIDs[0], expectedVersion: 0,
    title: "Synthetic populated report", reportDate: "2026-09-24",
    blocks: Array.from({ length: target.reportBlocks }, (_, index) => ({ id: `report-block-${index}`, kind: "heading", text: `Synthetic report block ${index + 1}` })) });
  const notes = await post("/notebook/cards/list", { projectID: projectIDs[0] });
  assert.equal(notes.cards.length, matchedWorkload ? 4 : target.notes);
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
  let matchedVisibleReceipt = null;
  if (matchedWorkload) {
    let totalNotes = notes.cards.length;
    for (const projectID of projectIDs.slice(1)) totalNotes += (await post("/notebook/cards/list", {projectID})).cards.length;
    assert.equal(totalNotes, target.notes);
    const projectMemberships = memberships.map(item => item.projectSection).filter(item => item.folderClientID === projectIDs[0]);
    assert.equal(projectMemberships.length, 3);
    const canonicalSections = projectMemberships.map(item => ({codeVersion: item.codeVersion, sectionID: item.sectionID}))
      .sort((a, b) => a.sectionID - b.sectionID);
    assert.deepEqual(canonicalSections, savedSections.slice(0, 3).map(item => ({codeVersion: item.codeVersion, sectionID: Number(item.id)})).sort((a, b) => a.sectionID - b.sectionID));
    const sanitize = value => {
      if (Array.isArray(value)) return value.map(sanitize);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
        .filter(([key]) => !["id", "createdAt", "updatedAt"].includes(key)).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sanitize(item)]));
      return typeof value === "string" && value.startsWith("permitext-notebook-asset:") ? `image-sha256:${imageHash}` : value;
    };
    const documents = [];
    for (const summary of notes.cards) {
      const {card} = await post("/notebook/cards/get", {projectID: projectIDs[0], cardID: summary.id});
      documents.push({title: card.title, cardType: card.cardType, document: sanitize(card.document)});
    }
    documents.sort((a, b) => a.title.localeCompare(b.title));
    assert.equal(documents.length, 4);
    assert.equal(documents[0].document.document.filter(block => block.type === "paragraph").length, 1);
    assert.equal(documents[0].document.document.filter(block => block.type === "image").length, 1);
    const persistedReport = (await post("/reports/drafts/get", {projectID: projectIDs[0], draftID: report.draft.id})).draft;
    assert.equal(persistedReport.blocks.length, 8);
    const workload = { sections: canonicalSections, notes: documents,
      report: {title: persistedReport.title, blocks: sanitize(persistedReport.blocks)},
      image: {width: image.width, height: image.height, encodedBytes: png.length, sha256: imageHash} };
    matchedVisibleReceipt = { projectID: projectIDs[0], saved: 3, notes: 4, firstNoteParagraphs: 1, images: 1,
      reportBlocks: 8, totalAccountNotes: totalNotes, canonicalSections,
      stableContentSHA256: createHash("sha256").update(JSON.stringify(workload)).digest("hex"), persistedReadsVerified: true };
  }
  let researchHistory = null;
  if (researchHistoryEnabled) {
    const answered = (await post("/research/conversations/create", { projectID: projectIDs[0], requestID: "ux09-answered" })).conversation;
    const response = await post("/research/conversations/message", { conversationID: answered.id, question: "What is the project address?", requestID: "ux09-project-address" });
    assert.match(response.conversation.messages.at(-1).answer.conclusion, /100 Synthetic Fixture Street/);
    const plain = (await post("/research/conversations/create", { requestID: "ux09-plain-draft" })).conversation;
    const named = (await post("/research/conversations/create", { requestID: "ux09-named-draft" })).conversation;
    await post("/research/conversations/rename", { conversationID: named.id, title: "Retained planning draft" });
    const selected = (await post("/research/conversations/create", { requestID: "ux09-evidence-draft", selections: [{ sectionID: "41009495", selectedText: "Ramps used as part of a means of egress or part of an accessible route shall have a running slope not steeper than one unit vertical in 12 units horizontal (8-percent slope)." }], originSurface: "reader" })).conversation;
    assert.ok(selected.sources.some(source => source.kind === "selection"));
    const history = (await post("/research/conversations/list", {})).conversations;
    assert.equal(history.length, 4);
    assert.equal(history.filter(item => item.messageCount === 0).length, 3);
    researchHistory = { total: history.length, drafts: 3, answeredID: answered.id, plainID: plain.id, namedID: named.id, selectedID: selected.id, providerCallsAllowed: false };
  }
  receipt = { profile, visibleWorkload, matchedVisibleReceipt, imageProfile, imageReceipts: imageReceipts.map(item => ({...item, noteID: noteIDs[0]})), ...target, researchHistory, saved: actualSaved, projects: actualProjects, assignedSaved: assigned.size, unassignedSaved: actualSaved - assigned.size, images: imageURLs.length, reports: 1, projectIDs, noteIDs,
    reportID: report.draft.id, editions: versions, externalRequestsAllowed: false, temporaryRecords: true };
  ready = true;
  // Verify guards with unauthenticated empty bodies, so even a failed guard
  // cannot mutate a Research record. Absolute-form targets exercise normalization.
  for (const path of ["/research/conversations/message", `${base}//research/conversations/message`]) {
    const blocked = await new Promise((resolve, reject) => {
      const probe = httpRequest({ hostname: "127.0.0.1", port, path, method: "POST", headers: { "content-type": "application/json" } }, response => {
        let body = "";
        response.on("data", chunk => { body += chunk; });
        response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
      });
      probe.on("error", reject);
      probe.end("{}");
    });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error, "Research disabled in performance fixture");
  }
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
  if (outageSelfTest === "true") {
    const controlRequest = (body, key = capability) => fetch(`${base}/fixture/control?key=${key}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
    });
    assert.equal((await controlRequest({ path: "/notebook/cards/save", fail: true, uses: 3 }, "wrong")).status, 403);
    for (const invalid of [{uses: 21}, {uses: -1}, {uses: 1.5}, {fail: false}, {delayMs: 1}]) {
      assert.equal((await controlRequest({path: "/notebook/cards/save", fail: true, uses: 3, ...invalid})).status, 400);
    }
    assert.equal((await controlRequest({path: "/notebook/cards/list", fail: true, uses: 2})).status, 400);
    const body = { projectID: projectIDs[0], expectedVersion: 0, clientMutationID: "outage-self-test",
      cardType: "finding", title: "Recovered synthetic outage note",
      document: { schema: "permitext-notebook-card", schemaVersion: 2, format: "blocknote-json", document: [{ id: "outage-test-paragraph", type: "paragraph", props: {}, children: [], content: [{ type: "text", styles: {}, text: "Retained outage test content" }] }] } };
    const before = (await post("/notebook/cards/list", {projectID: projectIDs[0]})).cards;
    assert.equal((await controlRequest({path: "/notebook/cards/save", fail: true, uses: 3})).status, 200);
    for (let attempt = 0; attempt < 3; attempt++) {
      const rejected = await fetch(base + "/notebook/cards/save", {method: "POST", headers: {
        "content-type": "application/json", authorization: `Bearer ${token}`
      }, body: JSON.stringify(body)});
      assert.equal(rejected.status, 503);
      assert.deepEqual((await post("/notebook/cards/list", {projectID: projectIDs[0]})).cards, before,
        "Rejected save must not alter the server notebook");
      const metrics = await get(`/fixture/metrics?key=${capability}`);
      assert.equal(metrics.control?.remaining || 0, 2 - attempt);
    }
    assert.equal((await controlRequest({path: "/notebook/cards/save", fail: true, uses: 20})).status, 200);
    assert.equal((await controlRequest({path: "/notebook/cards/save", fail: true, uses: 0})).status, 200);
    assert.equal((await get(`/fixture/metrics?key=${capability}`)).control, null);
    const recovered = await post("/notebook/cards/save", body);
    assert.equal(recovered.card.title, body.title);
    assert.equal((await post("/notebook/cards/list", {projectID: projectIDs[0]})).cards.length, before.length + 1);
    assert.equal((await post("/notebook/cards/save", body)).card.id, recovered.card.id, "Recovery retry must remain idempotent");
    assert.equal((await controlRequest({path: "/notebook/cards/list", fail: true})).status, 200);
    const failedRead = await fetch(base + "/notebook/cards/list", {method: "POST", headers: {
      "content-type": "application/json", authorization: `Bearer ${token}`
    }, body: JSON.stringify({projectID: projectIDs[0]})});
    assert.equal(failedRead.status, 503);
    assert.equal((await post("/notebook/cards/list", {projectID: projectIDs[0]})).cards.length, before.length + 1);
    console.log("IMAGE_FIXTURE_VERIFIED", JSON.stringify(receipt.imageReceipts));
    console.log("Populated fixture outage HTTP contract passed: bounded controls, capability protection, three unchanged rejected saves, recovery/idempotence and one-shot read compatibility.");
    await stop();
  }
  if (seedSelfTest === "true" && matchedWorkload) {
    const regular = await fetch(base + "/workspace");
    const regularHTML = await regular.text();
    const benchmark = await fetch(`${base}/workspace?fixtureBenchmark=${capability}`);
    const benchmarkHTML = await benchmark.text();
    assert.equal(benchmark.status, 200);
    assert.equal(benchmark.headers.get("content-security-policy"), regular.headers.get("content-security-policy"));
    for (const name of ["x-frame-options", "x-content-type-options", "cache-control"]) assert.equal(benchmark.headers.get(name), regular.headers.get(name));
    const injection = `<script src="/fixture/benchmark.js?key=${encodeURIComponent(capability)}"></script>`;
    assert.equal(benchmarkHTML.replace(injection, "").replace(`&fixtureAttribution=${capability}`, ""), regularHTML);
    assert.ok(benchmarkHTML.indexOf(injection) < benchmarkHTML.indexOf('src="/web/app.js'));
    assert.equal((await fetch(base + "/workspace?fixtureBenchmark=wrong")).status, 403);
    assert.equal((await fetch(base + "/fixture/benchmark.js?key=wrong")).status, 403);
    assert.equal((await fetch(`${base}/fixture/benchmark.js?key=${capability}`)).status, 200);
    const appPath = regularHTML.match(/src="(\/web\/app\.js[^"]*)"/)[1];
    const ordinaryApp = await fetch(base + appPath);
    const ordinaryAppText = await ordinaryApp.text();
    const attributedApp = await fetch(base + appPath + `&fixtureAttribution=${capability}`);
    assert.equal(attributedApp.status, 200);
    assert.equal(await attributedApp.text(), summaryAttributionPrelude() + ordinaryAppText);
    assert.equal((await fetch(base + appPath + '&fixtureAttribution=wrong')).status, 403);
    assert.equal(await (await fetch(base + appPath)).text(), ordinaryAppText);
    const sample = {summaryStats: {}, resourceTimings: [], status: "timeout", observerStartedAt: 1, completedAt: 60001, milestones: {},
      counts: {saved:0, notes:0, paragraphs:0, images:0, reportHeadings:0}, checks:{search:false,saved:false,notebook:false,report:false},
      resourceCounts:{"/static/*":3}, longTasks:[], longTasksSupported:false, visibilityState:"visible", viewport:{width:1600,height:1000}};
    const submit = (body, key = capability) => fetch(`${base}/fixture/benchmark?key=${key}`, {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body)});
    assert.equal((await submit(sample, "wrong")).status, 403);
    for (const invalid of [{...sample, unexpected:"private"}, {...sample, resourceCounts:{"/path?token=secret":1}}, {...sample,status:"ready"}, {...sample,completedAt:-1}]) assert.equal((await submit(invalid)).status, 400);
    assert.equal((await submit(sample)).status, 200);
    const metrics = await get(`/fixture/metrics?key=${capability}`);
    assert.equal(metrics.benchmarkSamples.length, 1);
    assert.equal(metrics.benchmarkSamples[0].visibleContentSHA256, receipt.matchedVisibleReceipt.stableContentSHA256);
    console.log("Fixture benchmark HTTP contract passed: actual HTML with same CSP/headers, gated observer, strict sample schema and receipt binding.");
  }
  console.log("POPULATED_FIXTURE_RECEIPT", JSON.stringify(receipt));
  if (seedSelfTest === "true") await stop();
  if (rollout) console.log("ROLLOUT_FIXTURE_READY " + base + "/fixture/rollout?key=" + capability);
  console.log("POPULATED_FIXTURE_READY " + base + "/fixture/start?key=" + capability);
} catch (error) {
  console.error("Populated fixture seed failed:", error.message);
  process.exitCode = 1;
  await stop();
}
