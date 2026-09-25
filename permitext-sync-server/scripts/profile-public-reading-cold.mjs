// Isolated, process-cold public-reading measurements. OS/filesystem caches are
// intentionally not flushed. Each case/sample imports app.mjs in a new process.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const scriptPath = fileURLToPath(import.meta.url);
const serverRoot = dirname(dirname(scriptPath));
const requestTimeoutMS = 20000;
const childTimeoutMS = 30000;
const suite = [
  { name: "concrete-exact", path: "/code/search?q=concrete&version=all&match=exact&limit=25&offset=0&candidateOffset=0" },
  { name: "egress-exact", path: "/code/search?q=egress&version=all&match=exact&limit=25&offset=0&candidateOffset=0" },
  { name: "section-exact", path: "/code/search?q=1005.3.1&version=all&match=exact&limit=25&offset=0&candidateOffset=0" },
  { name: "chapter33-summary", path: "/code/chapters/33?bodyContract=2" },
  { name: "chapter33-window", path: "/code/chapters/33?include=body&bodyContract=2&bodyStart=0&bodyLimit=5" },
  { name: "chapter33-full-legacy", path: "/code/chapters/33?include=body" }
];
const resultPrefix = "PERMITEXT_PROFILE_RESULT=";
const progressPrefix = "PERMITEXT_PROFILE_PROGRESS=";
const rounded = value => Math.round(value * 100) / 100;

async function child(name) {
  const selected = suite.find(item => item.name === name);
  assert.ok(selected, "Unknown child case");
  const directory = process.env.PERMITEXT_PROFILE_DIRECTORY || await mkdtemp(join(tmpdir(), "permitext-public-cold-"));
  const permitted = new Set(["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TZ"]);
  for (const key of Object.keys(process.env)) if (!permitted.has(key)) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: "test", PERMITEXT_PUBLIC_PERFORMANCE: "1", PERMITEXT_TEST_RESEARCH_MOCK: "1" });
  process.env.PERMITEXT_SYNC_DATA_PATH = join(directory, "sync-store.json");
  let server;
  const result = { case: selected.name, path: selected.path, importMS: null, requests: [] };
  const progress = () => process.stdout.write(`${progressPrefix}${JSON.stringify(result)}\n`);
  try {
    const importing = performance.now();
    const { handleRequest } = await import("../app.mjs");
    result.importMS = rounded(performance.now() - importing);
    progress();
    server = createServer(handleRequest);
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const phase of ["first", "repeat", "warm-content"]) {
      const requestPath = phase === "warm-content"
        ? `${selected.path}${selected.path.includes("?") ? "&" : "?"}profileCacheBypass=1`
        : selected.path;
      const started = performance.now();
      const record = { phase, requestPath, status: null, durationMS: null, decodedBytes: null, sha256: null };
      try {
        const response = await fetch(`${origin}${requestPath}`, { signal: AbortSignal.timeout(requestTimeoutMS) });
        record.timeToHeadersMS = rounded(performance.now() - started);
        record.status = response.status;
        record.serverTiming = response.headers.get("server-timing");
        record.requestID = response.headers.get("x-permitext-code-request-id");
        record.etag = response.headers.get("etag");
        record.corpusRevision = response.headers.get("x-permitext-corpus-revision");
        record.cacheControl = response.headers.get("cache-control");
        record.contentLengthHeader = response.headers.get("content-length");
        const bytes = Buffer.from(await response.arrayBuffer());
        record.timeToCompleteBodyMS = rounded(performance.now() - started);
        record.bodyReadMS = rounded(record.timeToCompleteBodyMS - record.timeToHeadersMS);
        record.decodedBytes = bytes.length;
        record.sha256 = createHash("sha256").update(bytes).digest("hex");
        if (!response.ok) record.error = `HTTP ${response.status}`;
        try {
          const payload = JSON.parse(bytes.toString("utf8"));
          record.resultCount = payload.results?.length ?? null;
          record.sectionCount = payload.chapter?.sections?.length ?? null;
          record.hasMore = payload.hasMore ?? null;
          record.nextCandidateOffset = payload.nextCandidateOffset ?? null;
        } catch (error) {
          record.error = `Invalid JSON: ${error.message}`;
        }
      } catch (error) {
        record.error = `${error.name}: ${error.message}`;
      }
      record.durationMS = rounded(performance.now() - started);
      result.requests.push(record);
      progress();
      // A timeout can leave its server handler finishing in this process. Never
      // label another overlapping request as a clean warm observation.
      if (record.error) break;
    }
    result.identicalRepresentation = result.requests.length === 3 &&
      result.requests.every(item => item.status === 200 && !item.error && item.sha256 === result.requests[0].sha256);
  } catch (error) {
    result.error = `${error.name}: ${error.message}`;
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    await rm(directory, { recursive: true, force: true });
  }
  process.stdout.write(`${resultPrefix}${JSON.stringify(result)}\n`);
}

const timingPhases = new Set(["revision", "index_load", "catalog_load", "candidate_match", "ranking", "exact_match", "content_read", "snippets", "serialization", "total", "cache_lookup", "chapter_assembly", "chapter_contract"]);
const timingRoutes = new Set(["revision", "libraries", "chapters", "sections", "search", "chapters_detail", "sections_detail"]);
function sanitizedTimingEvent(line) {
  let value;
  try { value = JSON.parse(line); } catch { return null; }
  if (!["permitext.public-code-timing", "permitext.public-code-phase"].includes(value?.event) || !timingRoutes.has(value.route) ||
      !/^[a-f0-9-]{36}$/.test(value.requestID || "")) return null;
  if (value.event === "permitext.public-code-phase") {
    if (!timingPhases.has(value.phase) || !["start", "complete"].includes(value.stage)) return null;
    return {
      event: value.event, requestID: value.requestID, route: value.route,
      phase: value.phase, stage: value.stage,
      ...(Number.isFinite(value.duration) && value.duration >= 0
        ? { duration: Math.min(value.duration, 1e9) } : {})
    };
  }
  const numbers = (object, allowed) => Object.fromEntries(Object.entries(object || {}).filter(([key, number]) =>
    allowed.has(key) && Number.isFinite(number) && number >= 0 && number <= 1e9));
  return {
    event: value.event, requestID: value.requestID, route: value.route,
    status: Number.isInteger(value.status) && value.status >= 100 && value.status <= 599 ? value.status : null,
    errorStatus: value.errorStatus === true,
    totalElapsed: Number.isFinite(value.totalElapsed) && value.totalElapsed >= 0 ? Math.min(value.totalElapsed, 1e9) : null,
    phases: numbers(value.phases, timingPhases),
    counters: numbers(value.counters, new Set(["cache_hit", "cache_miss"])),
    traceEventsDropped: Number.isSafeInteger(value.traceEventsDropped) && value.traceEventsDropped >= 0
      ? Math.min(value.traceEventsDropped, 1e9) : 0
  };
}

async function runChild(selected, sample) {
  const directory = await mkdtemp(join(tmpdir(), "permitext-public-cold-"));
  try {
    return await new Promise(resolve => {
    // Whitelist environment: no account, database, provider, deployment, or
    // external service credentials can leak into the profiling child.
    const env = Object.fromEntries(["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TZ"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
    Object.assign(env, { NODE_ENV: "test", PERMITEXT_PUBLIC_PERFORMANCE: "1", PERMITEXT_TEST_RESEARCH_MOCK: "1", PERMITEXT_PROFILE_DIRECTORY: directory });
    const processStarted = performance.now();
    const worker = spawn(process.execPath, [scriptPath, "--child", selected.name], { cwd: serverRoot, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "", timedOut = false, spawnError = null, killTimer;
    let pendingLine = "", timingEventsDropped = 0;
    const timingEvents = [];
    const limit = 128 * 1024;
    worker.stdout.on("data", chunk => {
      stdout = (stdout + chunk).slice(-limit);
      pendingLine += chunk;
      const lines = pendingLine.split("\n");
      pendingLine = lines.pop().slice(-limit);
      for (const line of lines) {
        const event = sanitizedTimingEvent(line);
        if (!event) continue;
        if (timingEvents.length === 192) { timingEvents.shift(); timingEventsDropped++; }
        timingEvents.push(event);
      }
    });
    worker.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-limit); });
    const timeout = setTimeout(() => {
      timedOut = true;
      worker.kill("SIGTERM");
      killTimer = setTimeout(() => worker.kill("SIGKILL"), 1000);
    }, childTimeoutMS);
    worker.on("error", error => { spawnError = `${error.name}: ${error.message}`; });
    worker.on("close", (exitCode, signal) => {
      clearTimeout(timeout); clearTimeout(killTimer);
      const lines = stdout.split("\n");
      const completed = lines.findLast(line => line.startsWith(resultPrefix));
      const partial = lines.findLast(line => line.startsWith(progressPrefix));
      let payload = {};
      try { if (completed || partial) payload = JSON.parse((completed || partial).slice(completed ? resultPrefix.length : progressPrefix.length)); } catch {}
      const result = { ...payload, case: selected.name, path: selected.path, sample, processMS: rounded(performance.now() - processStarted), exitCode, signal, timingEvents, timingEventsDropped };
      if (timedOut) result.error = `Child exceeded ${childTimeoutMS}ms; partial evidence retained`;
      else if (spawnError) result.error = spawnError;
      else if (!completed) result.error = result.error || "Child exited without a completed measurement";
      if (stderr.trim()) result.stderr = stderr.trim();
      resolve(result);
    });
    });
  } finally {
    // Parent owns cleanup even when a blocked child requires forced termination.
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[2] === "--child") {
  assert.equal(process.argv.length, 4);
  await child(process.argv[3]);
} else {
  const args = process.argv.slice(2);
  const options = new Map();
  for (let i = 0; i < args.length; i += 2) {
    assert.ok(["--samples", "--cases"].includes(args[i]) && args[i + 1], `Unknown or incomplete option: ${args[i]}`);
    assert.ok(!options.has(args[i]), `Duplicate option: ${args[i]}`);
    options.set(args[i], args[i + 1]);
  }
  const samples = Number(options.get("--samples") || "3");
  assert.ok(Number.isInteger(samples) && samples >= 1 && samples <= 100, "Samples must be 1..100");
  const names = options.has("--cases") ? options.get("--cases").split(",") : suite.map(item => item.name);
  assert.ok(names.length && new Set(names).size === names.length && names.every(name => suite.some(item => item.name === name)), "Unknown or duplicate case");
  const selected = names.map(name => suite.find(item => item.name === name));
  let commit = null, gitDirty = null;
  const gitOptions = { cwd: serverRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], gitOptions).trim();
    gitDirty = Boolean(execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], gitOptions).trim());
  } catch {}
  const output = { schemaVersion: 2, measuredAt: new Date().toISOString(), classification: "process-cold (OS/filesystem caches not flushed)", commit, gitDirty, node: process.version, samples, requestTimeoutMS, childTimeoutMS, samplesRun: [] };
  for (const item of selected) {
    for (let sample = 1; sample <= samples; sample++) {
      process.stderr.write(`Profiling ${item.name} ${sample}/${samples}\n`);
      output.samplesRun.push(await runChild(item, sample));
    }
  }
  output.failedSamples = output.samplesRun.filter(item => item.error || item.requests?.some(request => request.error) || item.identicalRepresentation === false).length;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (output.failedSamples) process.exitCode = 1;
}
