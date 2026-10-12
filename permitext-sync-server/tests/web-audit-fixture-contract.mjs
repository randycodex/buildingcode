// Exercise the actual local fixture HTTP routes with disposable synthetic data.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { webAuditAttributionPrelude } from "./web-audit-attribution.mjs";

async function availablePort() {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}

async function startFixture({ enabled, concentrated }) {
  const port = await availablePort();
  const child = spawn(process.execPath, [fileURLToPath(new URL("./populated-workspace-performance-fixture.mjs", import.meta.url)),
    "--port", String(port), "--profile", concentrated ? "large" : "small",
    "--visible-workload", concentrated ? "concentrated" : "default",
    "--audit-observer", String(enabled)], { stdio: ["ignore", "pipe", "pipe"] });
  const exited = once(child, "exit");
  const close = async () => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM"); await exited; };
  let output = "";
  try {
    const start = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Fixture readiness timeout")), 60000);
      child.stdout.on("data", chunk => {
        output += chunk;
        const match = output.match(/POPULATED_FIXTURE_READY (http:\/\/[^\s]+)/);
        if (match) { clearTimeout(timer); resolve(new URL(match[1])); }
      });
      child.stderr.on("data", chunk => { output += chunk; });
      child.once("error", error => { clearTimeout(timer); reject(error); });
      child.once("exit", code => { clearTimeout(timer); reject(new Error(`Fixture exited before ready: ${code}`)); });
    });
    return { start, close };
  } catch (error) { await close(); throw error; }
}

for (const enabled of [false, true]) {
  const fixture = await startFixture({ enabled, concentrated: enabled });
  try {
    const base = fixture.start.origin, key = fixture.start.searchParams.get("key");
    const get = route => fetch(base + route);
    const submit = (sample, providedKey = key) => fetch(`${base}/fixture/audit?key=${providedKey}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sample)
    });
    for (const route of ["/fixture/metrics", "/fixture/start", "/fixture/audit.js"]) {
      assert.equal((await get(route)).status, 403, `${route} requires capability`);
      assert.equal((await get(`${route}?key=wrong`)).status, 403);
    }
    for (const route of ["/workspace", "/web/app.js"]) {
      assert.equal((await get(`${route}?fixtureAudit=wrong`)).status, 403);
      const normal = await get(route), normalText = await normal.text();
      const instrumented = await get(`${route}?fixtureAudit=${key}`);
      assert.equal(normal.status, 200);
      assert.ok(!normalText.includes("/fixture/audit.js") && !normalText.includes("const auditStats ="), "Plain URLs stay uninstrumented");
      assert.equal(instrumented.status, enabled ? 200 : 403, "Both opt-in and capability are required");
      if (enabled) {
        const auditText = await instrumented.text();
        for (const header of ["content-type", "content-security-policy", "cache-control", "x-content-type-options"]) {
          assert.equal(instrumented.headers.get(header), normal.headers.get(header), `Preserve real ${route} ${header}`);
        }
        if (route === "/workspace") {
          assert.ok(auditText.includes(`/fixture/audit.js?key=${key}`));
          assert.match(auditText, new RegExp(`/web/app\\.js\\?[^"\\s]+&fixtureAudit=${key}`));
        } else assert.equal(auditText, webAuditAttributionPrelude(normalText) + normalText, "Instrumentation preserves the complete real application body");
      }
    }
    const observer = await get(`/fixture/audit.js?key=${key}`);
    assert.equal(observer.status, enabled ? 200 : 404);
    if (enabled) {
      assert.match(observer.headers.get("content-type"), /javascript/);
      assert.match(await observer.text(), /PerformanceObserver/);
    }
    const sample = { run: "synthetic-contract", at: 10, resources: [] };
    assert.equal((await submit(sample, "wrong")).status, 403);
    assert.equal((await submit(sample)).status, enabled ? 200 : 404);
    if (enabled) {
      for (const invalid of [{ at: 1, resources: [] }, { ...sample, at: "1" }, { ...sample, resources: Array(301).fill({}) }]) {
        assert.equal((await submit(invalid)).status, 400);
      }
    }
    const metrics = await (await get(`/fixture/metrics?key=${key}`)).json();
    assert.equal(metrics.auditSamples.length, enabled ? 1 : 0);
    if (enabled) assert.deepEqual(metrics.auditSamples[0], sample);

    // Read the actual signed-in synthetic account created by the bootstrap.
    const bootstrap = await (await fetch(fixture.start)).text();
    const script = bootstrap.match(/<script>([\s\S]*?)<\/script>/)[1];
    let account, destination;
    vm.runInNewContext(script, {
      localStorage: { setItem(name, value) { assert.equal(name, "permitext:webAccount:v1"); account = JSON.parse(value); } },
      location: { replace(url) { destination = url; } }
    });
    assert.equal(destination, enabled ? `/workspace?fixtureAudit=${key}` : "/workspace");
    const pull = await fetch(base + "/sync/pull", { method: "POST", headers: {
      "content-type": "application/json", authorization: `Bearer ${account.sessionToken}`
    }, body: JSON.stringify({ auth: { accountUserID: account.userID }, syncSchemaVersion: 2 }) });
    assert.equal(pull.status, 200);
    const mutations = (await pull.json()).mutations;
    const live = mutations.filter(item => !Object.values(item)[0]?.deletedAt);
    assert.equal(live.filter(item => item.savedItem).length, enabled ? 1000 : 12);
    const memberships = live.filter(item => item.projectSection).map(item => item.projectSection);
    assert.equal(memberships.length, enabled ? 500 : 6);
    assert.equal(memberships.filter(item => item.folderClientID === "performance-project-1").length, enabled ? 500 : 3);
    assert.equal(new Set(memberships.map(item => item.folderClientID)).size, enabled ? 1 : 2);
  } finally { await fixture.close(); }
}

// Wrappers preserve return/throw/this behavior; elapsed values are synchronous
// entry work, deliberately not the lifetime of a returned asynchronous promise.
const source = `function currentContentSummary(value) { if (value < 0) throw new Error("expected"); return this.offset + value; }
async function renderSearchResults(value) { return value; }`;
const context = vm.createContext({ __permitextAuditStats: {}, performance: { now: (() => { let n = 0; return () => ++n; })() } });
vm.runInContext(webAuditAttributionPrelude(source) + source, context);
assert.equal(context.currentContentSummary.call({ offset: 4 }, 2), 6);
assert.throws(() => context.currentContentSummary(-1), /expected/);
assert.equal(await context.renderSearchResults(7), 7);
assert.equal(context.__permitextAuditStats.currentContentSummary.count, 2);
assert.equal(context.__permitextAuditStats.renderSearchResults.count, 1);
assert.equal(context.__permitextAuditStats.projectEvidenceCount, undefined, "Missing source functions cannot create fabricated zero timings");
console.log("Web audit fixture passed: explicit opt-in/capability gates, unchanged plain application assets and headers, bounded sample envelope, default distribution, concentrated 500-save Project, and attribution call semantics.");
