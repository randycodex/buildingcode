import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const temporary = await mkdtemp(join(tmpdir(), "permitext-search-scope-http-"));
Object.assign(process.env, { NODE_ENV: "test", VERCEL: "", VERCEL_ENV: "", PERMITEXT_SYNC_DATA_PATH: join(temporary, "sync.json"), PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporary, "assets") });
for (const key of ["OPENAI_API_KEY", "DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL", "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN"]) delete process.env[key];
const { handleRequest } = await import("../app.mjs");
const { activeCodeSourceCatalog } = await import("../active-code-source-catalog.mjs");
const { codeSourceIdentity } = await import("../public/active-code-sources.js");
const catalog = await activeCodeSourceCatalog();
const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const fetchOriginal = globalThis.fetch;
globalThis.fetch = (url, options) => { assert.equal(new URL(url).origin, base); return fetchOriginal(url, options); };
const token = sources => JSON.stringify({ version: 1, enabledSources: sources.map(codeSourceIdentity) });
async function request(parameters, sources) {
  const url = new URL("/code/search", base);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  if (sources !== undefined) url.searchParams.set("sourceScope", typeof sources === "string" ? sources : token(sources));
  const response = await fetch(url.href);
  const value = await response.json();
  return { response, value };
}
try {
  const librariesResponse = await fetch(base + "/code/libraries");
  assert.equal(librariesResponse.status, 200);
  const libraries = await librariesResponse.json();
  assert.equal(libraries.codeSources.length, 22);
  const identities = libraries.codeSources.map(source => JSON.stringify(codeSourceIdentity(source)));
  assert.equal(new Set(identities).size, 22);
  const publishedBC68 = libraries.codeSources.find(source => source.codePrefix === "BC68");
  const publishedFGC = libraries.codeSources.find(source => source.family === "construction" && source.codePrefix === "FGC");
  assert.equal(publishedBC68.categoryID, 4);
  assert.equal(publishedFGC.categoryID, 4);
  assert.notEqual(publishedBC68.canonicalEdition, publishedFGC.canonicalEdition);
  const bc2022 = catalog.find(source => source.family === "construction" && source.codePrefix === "BC");
  const bc2014 = catalog.find(source => source.family === "historical2014" && source.codePrefix === "BC");
  const bc68 = catalog.find(source => source.codePrefix === "BC68");
  assert.ok(bc2022 && bc2014 && bc68);
  for (const source of catalog) {
    const parameters = { q: "concrete", version: source.family === "historical2014" ? source.canonicalEdition : "all", code: source.codePrefix, limit: 2 };
    const legacy = await request(parameters);
    const enabled = await request(parameters, catalog);
    assert.equal(legacy.response.status, 200);
    assert.deepEqual(enabled.value, legacy.value, `All-enabled changed ${source.codePrefix}/${source.canonicalEdition}`);
  }
  const query = { q: "403.2.3.3", version: "all", limit: 250 };
  const baseline = await request(query);
  assert.equal(baseline.response.status, 200);
  const all = await request(query, catalog);
  assert.deepEqual(all.value, baseline.value, "Explicit all must retain legacy results and metadata");
  for (const source of [bc2022, bc2014]) {
    const scoped = await request(query, [source]);
    assert.equal(scoped.response.status, 200);
    const expected = baseline.value.results.filter(result => result.codePrefix === source.codePrefix && result.codeVersion === source.canonicalEdition);
    assert.ok(expected.length > 0);
    assert.deepEqual(scoped.value.results, expected);
    assert.equal(scoped.value.totalResults, expected.length);
  }
  const historicQuery = { q: "concrete", version: "all", code: "BC68", limit: 2 };
  const historic = await request(historicQuery);
  const historicScoped = await request(historicQuery, [bc68]);
  assert.deepEqual(historicScoped.value, historic.value);
  assert.ok(historic.value.results.length);
  const excluded = await request(historicQuery, [bc2022]);
  assert.equal(excluded.value.results.length, 0);
  const page = await request({ ...historicQuery, offset: 2 }, [bc68]);
  const larger = await request({ ...historicQuery, limit: 4 }, [bc68]);
  assert.deepEqual([...historicScoped.value.results, ...page.value.results], larger.value.results);
  for (const source of [bc68, bc2022, bc2014]) {
    const parameters = { q: "concrete", version: "all", code: source.codePrefix, match: "exact", candidateOffset: 0, limit: 2 };
    const first = await request(parameters, [source]);
    assert.equal(first.response.status, 200);
    assert.equal(first.value.hasMore, true, "Fixture must span at least two exact pages");
    assert.equal(first.value.totalResults, null, "Unfinished exact cursor has unknown total");
    assert.ok(first.value.nextCandidateOffset > 0);
    const second = await request({ ...parameters, candidateOffset: first.value.nextCandidateOffset, offset: first.value.nextOffset }, [source]);
    assert.equal(second.response.status, 200);
    assert.equal(second.value.offset, first.value.nextOffset);
    assert.equal(second.value.nextOffset, first.value.nextOffset + second.value.results.length);
    const combined = [...first.value.results, ...second.value.results];
    const larger = await request({ ...parameters, limit: 4 }, [source]);
    assert.deepEqual(combined, larger.value.results, `Exact cursor order changed for ${source.codePrefix}/${source.canonicalEdition}`);
    assert.equal(new Set(combined.map(result => result.id)).size, combined.length);
    assert.ok(combined.every(result => result.codeVersion === source.canonicalEdition && result.codePrefix === source.codePrefix));
    const unscoped = await request(parameters);
    const allEnabled = await request(parameters, catalog);
    assert.deepEqual(allEnabled.value, unscoped.value, "Explicit-all exact cursor first page differs");
    const nextParameters = { ...parameters, candidateOffset: unscoped.value.nextCandidateOffset, offset: unscoped.value.nextOffset };
    assert.deepEqual((await request(nextParameters, catalog)).value, (await request(nextParameters)).value,
      "Explicit-all exact cursor continuation differs");
  }
  const emptyExact = await request({ q: "concrete", version: "all", match: "exact", candidateOffset: 0 }, []);
  assert.equal(emptyExact.value.totalResults, 0);
  assert.equal(emptyExact.value.hasMore, false);
  assert.equal(emptyExact.value.nextCandidateOffset, undefined, "Empty response retains existing short-circuit shape");
  const empty = await request({ q: "concrete", version: "all" }, []);
  assert.equal(empty.response.status, 200);
  assert.equal(empty.value.totalResults, 0);
  for (const malformed of ["bad", JSON.stringify({ version: 2, enabledSources: [] }), token([{ ...bc2022, categoryID: 999999 }])]) {
    const invalid = await request({ q: "concrete" }, malformed);
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.response.headers.get("cache-control"), "no-store");
  }
  console.log("HTTP active scope passed: explicit-all parity, BC2022/2014 exact separation, BC68 inclusion/exclusion, pagination, empty and invalid scope.");
} finally {
  globalThis.fetch = fetchOriginal;
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
