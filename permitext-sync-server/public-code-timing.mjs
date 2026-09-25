import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

const timings = new AsyncLocalStorage();
const phaseNames = new Set(["revision", "index_load", "catalog_load", "candidate_match", "ranking", "exact_match", "content_read", "snippets", "serialization", "total", "cache_lookup", "chapter_assembly", "chapter_contract"]);
const counterNames = new Set(["cache_hit", "cache_miss"]);
const boundedNumber = value => Math.min(1e9, Math.max(0, Number.isFinite(value) ? value : 0));
function routeFamily(request) {
  if (request.method !== "GET") return null;
  let path;
  try { path = new URL(request.url, "http://public-code.invalid").pathname; } catch { return null; }
  const match = /^\/code\/(revision|libraries|chapters|sections|search)(?:\/([a-zA-Z0-9_-]+))?$/.exec(path);
  if (!match || (match[2] && !["chapters", "sections"].includes(match[1]))) return null;
  return match[2] ? `${match[1]}_detail` : match[1];
}
function tracePhase(context, name, stage, duration) {
  if (context.traceEvents >= 64) { context.traceEventsDropped++; return; }
  context.traceEvents++;
  console.log(JSON.stringify({ event: "permitext.public-code-phase", requestID: context.requestID,
    route: context.route, phase: name, stage,
    ...(duration === undefined ? {} : { duration: Number(boundedNumber(duration).toFixed(2)) }) }));
}
function addPhase(context, name, start) {
  const duration = performance.now() - start;
  context.phases[name] = boundedNumber((context.phases[name] || 0) + duration);
  tracePhase(context, name, "complete", duration);
}

/** Preserve sync return values and errors; async work retains its result/error. */
export function timePublicCodePhase(name, operation) {
  const context = timings.getStore();
  if (!context || !phaseNames.has(name) || name === "total") return operation();
  const start = performance.now();
  tracePhase(context, name, "start");
  let result;
  try { result = operation(); } catch (error) { addPhase(context, name, start); throw error; }
  if (result && typeof result.then === "function") {
    return Promise.resolve(result).then(value => { addPhase(context, name, start); return value; }, error => { addPhase(context, name, start); throw error; });
  }
  addPhase(context, name, start);
  return result;
}

export function countPublicCodeEvent(name, amount = 1) {
  const context = timings.getStore();
  if (!context || !counterNames.has(name) || !Number.isFinite(amount) || amount < 0) return;
  context.counters[name] = Math.min(1_000_000, (context.counters[name] || 0) + Math.floor(amount));
}

/** Opt-in public-only telemetry. Never captures URL parameters, account data or errors. */
export function runPublicCodeTiming(request, response, operation) {
  const route = process.env.PERMITEXT_PUBLIC_PERFORMANCE === "1" ? routeFamily(request) : null;
  if (!route) return operation();
  const context = { requestID: randomUUID(), route, start: performance.now(), phases: {}, counters: {}, traceEvents: 0, traceEventsDropped: 0 };
  const originalWriteHead = response.writeHead;
  response.writeHead = function (...args) {
    const phaseSnapshot = { ...context.phases, total: boundedNumber(performance.now() - context.start) };
    // setHeader works with both writeHead(status, headers) and its reason-phrase
    // overload and preserves the caller's header collection and receiver.
    const measured = Object.entries(phaseSnapshot).map(([name, value]) => `${name};dur=${value.toFixed(2)}`).join(", ");
    const headerIndex = typeof args[1] === "string" ? 2 : 1;
    const supplied = args[headerIndex];
    let existing = this.getHeader?.("Server-Timing");
    if (supplied && !Array.isArray(supplied)) {
      const merged = { ...supplied };
      for (const key of Object.keys(merged)) {
        if (key.toLowerCase() === "server-timing") { existing = merged[key]; delete merged[key]; }
        if (key.toLowerCase() === "x-permitext-code-request-id") delete merged[key];
      }
      merged["Server-Timing"] = existing ? `${existing}, ${measured}` : measured;
      merged["x-permitext-code-request-id"] = context.requestID;
      args[headerIndex] = merged;
    } else if (Array.isArray(supplied)) {
      const merged = [];
      for (let index = 0; index < supplied.length; index += 2) {
        const name = String(supplied[index]).toLowerCase();
        if (name === "server-timing") existing = supplied[index + 1];
        else if (name !== "x-permitext-code-request-id") merged.push(supplied[index], supplied[index + 1]);
      }
      merged.push("Server-Timing", existing ? `${existing}, ${measured}` : measured, "x-permitext-code-request-id", context.requestID);
      args[headerIndex] = merged;
    }
    this.setHeader("x-permitext-code-request-id", context.requestID);
    this.setHeader("Server-Timing", existing ? `${existing}, ${measured}` : measured);
    return originalWriteHead.apply(this, args);
  };
  response.once("finish", () => {
    console.log(JSON.stringify({ event: "permitext.public-code-timing", requestID: context.requestID, route: context.route,
      status: response.statusCode, errorStatus: response.statusCode >= 400,
      totalElapsed: Number(boundedNumber(performance.now() - context.start).toFixed(2)),
      phases: Object.fromEntries(Object.entries(context.phases).map(([name, value]) => [name, Number(value.toFixed(2))])),
      counters: context.counters, traceEventsDropped: context.traceEventsDropped }));
  });
  return timings.run(context, operation);
}
