import assert from "node:assert/strict";
import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import { handleRequest } from "../app.mjs";

const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const key = result => JSON.stringify([result.codePrefix, result.codeVersion, result.id]);
const get = async params => {
  const response = await fetch(`${base}/code/search?${new URLSearchParams(params)}`);
  assert.equal(response.status, 200);
  return response.json();
};
try {
  const start = performance.now();
  const initial = await get({ q: "concrete", version: "all", match: "exact", grouped: "true", limit: "25" });
  const initialMS = performance.now() - start;
  assert(initial.groups.length > 1);
  for (const group of initial.groups) {
    const rows = initial.results.filter(row => row.codePrefix === group.codePrefix && row.codeVersion === group.codeVersion);
    assert(rows.length > 0 && rows.length <= 8, "Initial results stay bounded in each source.");
    assert(rows.length >= 5 || !group.hasMore, "Each edition loads at least five matches unless it is exhausted.");
    assert.equal(rows.length, group.nextOffset);
    assert.equal(group.cursorKind, "candidate");
  }
  const source = initial.groups.find(group => group.codePrefix === "BC" && group.codeVersion.includes("2022") && group.hasMore);
  assert(source);
  const first = initial.results.filter(row => row.codePrefix === source.codePrefix && row.codeVersion === source.codeVersion);
  const params = { q: "concrete", code: source.codePrefix, version: "all", match: "exact", limit: "25",
    resultSource: JSON.stringify({ codePrefix: source.codePrefix, codeVersion: source.codeVersion }),
    offset: String(source.nextOffset), candidateOffset: String(source.nextCandidateOffset) };
  const next = await get(params);
  assert(next.results.length > 0 && next.results.length <= 25);
  assert(next.results.every(row => row.codePrefix === source.codePrefix && row.codeVersion === source.codeVersion));
  assert.equal(new Set([...first, ...next.results].map(key)).size, first.length + next.results.length);
  const complete = await get({ ...params, limit: "250", offset: "0", candidateOffset: "0" });
  assert.deepEqual([...first, ...next.results].map(key), complete.results.slice(0, first.length + next.results.length).map(key),
    "Scoped pages preserve ranking without skips or duplicates.");
  const fromOffline = { ...params };
  delete fromOffline.candidateOffset;
  const switched = await get(fromOffline);
  assert.deepEqual(switched.results.map(key), next.results.map(key), "Offline match offsets resume correctly in the online candidate index.");
  const historical = initial.groups.find(group => group.codePrefix === "BC" && group.codeVersion.includes("2014"));
  assert(historical);
  const historicalPage = await get({ ...params, resultSource: JSON.stringify(historical), offset: "0", candidateOffset: "0" });
  assert(historicalPage.results.length);
  assert(historicalPage.results.every(row => row.codeVersion === historical.codeVersion && row.codePrefix === "BC"));
  const disabled = await get({ ...params, sourceScope: JSON.stringify({ version: 1, enabledSources: [] }) });
  assert.equal(disabled.results.length, 0);
  const invalid = await fetch(`${base}/code/search?${new URLSearchParams({ q: "concrete", resultSource: "null" })}`);
  assert.equal(invalid.status, 400);
  console.log(`Grouped Search HTTP passed: ${initial.groups.length} editions / ${initial.results.length} initial matches in ${initialMS.toFixed(0)} ms; scoped pages, ranking, edition isolation, offline cursor handoff and disabled-source guard.`);
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
