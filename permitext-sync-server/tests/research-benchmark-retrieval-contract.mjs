import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseResearchBenchmarkMarkdown,
  validateResearchBenchmark
} from "../evals/research-benchmark-v2.mjs";
import {
  evaluateResearchBenchmarkRetrieval,
  formatResearchBenchmarkRetrievalReport,
  requiredBuildingCodeReferences
} from "../evals/research-benchmark-retrieval.mjs";
import { evidenceDiscoveryVersion } from "../evidence-discovery.mjs";

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const benchmarkPath = join(serverRoot, "../docs/Permitext_Research_Benchmark_40_Cases_v2.md");
const canonicalIndexPath = join(serverRoot, "config/canonical-section-ids.json");

async function jsonRequest(baseURL, path, options = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method: options.method || "GET",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${payload?.error || text}`);
  return payload;
}

const [benchmarkMarkdown, canonicalIndex] = await Promise.all([
  readFile(benchmarkPath, "utf8"),
  readFile(canonicalIndexPath, "utf8").then(JSON.parse)
]);
const dataset = validateResearchBenchmark(parseResearchBenchmarkMarkdown(benchmarkMarkdown));
const caseByNumber = new Map(dataset.cases.map((testCase) => [testCase.number, testCase]));

const constructionTypeReferences = requiredBuildingCodeReferences(caseByNumber.get(19), canonicalIndex);
assert.deepEqual(
  constructionTypeReferences.references.map((item) => item.sectionNumber),
  ["602.2", "601.1", "602.1"],
  "Table 601 and Table 602 must resolve to their canonical containing sections."
);
const residentialUnitReferences = requiredBuildingCodeReferences(caseByNumber.get(25), canonicalIndex);
assert.deepEqual(
  residentialUnitReferences.references.map((item) => item.sectionNumber),
  ["1107.6"],
  "Project-dependent residential subsections must not inflate strict required recall."
);
assert.equal(residentialUnitReferences.skipped.length, 3);

const temporaryDirectory = await mkdtemp(join(tmpdir(), "permitext-benchmark-retrieval-"));
const previousEnvironment = new Map();
const environment = {
  NODE_ENV: "test",
  PERMITEXT_SYNC_DATA_PATH: join(temporaryDirectory, "sync-store.json"),
  PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(temporaryDirectory, "private-assets"),
  PERMITEXT_SYNC_DATABASE_URL: "",
  DATABASE_URL: "",
  STORAGE_URL: "",
  POSTGRES_URL: "",
  NEON_DATABASE_URL: "",
  PERMITEXT_TEST_RESEARCH_MOCK: "1",
  PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
  PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: "benchmark-retrieval-grant-token"
};
for (const [key, value] of Object.entries(environment)) {
  previousEnvironment.set(key, process.env[key]);
  process.env[key] = value;
}

let server;
try {
  const { handleRequest } = await import(`../app.mjs?benchmark-retrieval=${Date.now()}`);
  server = createServer(handleRequest);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const baseURL = `http://127.0.0.1:${address.port}`;
  const firstSignIn = await jsonRequest(baseURL, "/account/sign-in", {
    method: "POST",
    body: {
      credential: {
        provider: "web",
        providerUserID: "benchmark-retrieval-eval",
        displayName: "Benchmark Retrieval Eval"
      }
    }
  });
  await jsonRequest(baseURL, "/admin/lifetime-grants/grant", {
    method: "POST",
    token: environment.PERMITEXT_SYNC_GRANT_ADMIN_TOKEN,
    body: { userID: firstSignIn.account.appUserID }
  });
  const account = (await jsonRequest(baseURL, "/account/sign-in", {
    method: "POST",
    body: {
      credential: {
        provider: "web",
        providerUserID: "benchmark-retrieval-eval",
        displayName: "Benchmark Retrieval Eval"
      }
    }
  })).account;

  const sectionCache = new Map();
  const resolveSection = async (requested) => {
    const cacheKey = requested.sectionID
      ? `id:${requested.sectionID}`
      : `${requested.codePrefix}:${requested.sectionNumber}`;
    if (sectionCache.has(cacheKey)) return sectionCache.get(cacheKey);
    let sectionID = String(requested.sectionID || "").trim();
    if (!sectionID) {
      const parameters = new URLSearchParams({
        q: requested.sectionNumber,
        code: requested.codePrefix || "BC",
        limit: "20"
      });
      const search = await jsonRequest(baseURL, `/code/search?${parameters}`);
      const match = (search.results || []).find((item) =>
        item.codePrefix === (requested.codePrefix || "BC") &&
        item.sectionNumber === requested.sectionNumber
      );
      if (!match) throw new Error(`No canonical section for ${requested.codePrefix} ${requested.sectionNumber}.`);
      sectionID = String(match.id);
    }
    const payload = await jsonRequest(baseURL, `/code/sections/${sectionID}`);
    const section = payload.section;
    const resolved = {
      sectionID: String(section.sectionID || sectionID),
      codePrefix: section.codePrefix,
      sectionNumber: section.sectionNumber,
      title: section.title,
      codeVersion: section.codeVersion,
      body: { blocks: section.blocks || [] },
      crossReferences: []
    };
    sectionCache.set(cacheKey, resolved);
    sectionCache.set(`id:${resolved.sectionID}`, resolved);
    sectionCache.set(`${resolved.codePrefix}:${resolved.sectionNumber}`, resolved);
    return resolved;
  };

  const report = await evaluateResearchBenchmarkRetrieval({
    dataset,
    canonicalSectionIndex: canonicalIndex,
    discover: async ({ question, limit }) => {
      const discovery = await jsonRequest(baseURL, "/research/evidence/discover", {
        method: "POST",
        token: account.backendSessionToken,
        body: {
          auth: { accountUserID: account.appUserID },
          question,
          limit
        }
      });
      assert.equal(discovery.retrievalVersion, evidenceDiscoveryVersion);
      assert.equal(discovery.generatedAnswer, false);
      assert.equal(discovery.paidModelCall, false);
      return discovery;
    },
    resolveSection
  });

  assert.equal(report.scope.firstCase, 1);
  assert.equal(report.scope.lastCase, 27);
  assert.equal(report.summary.caseCount, 27);
  assert.equal(report.summary.requiredCitationCount, 48);
  assert.equal(report.summary.candidateRecall, 1);
  assert.equal(report.summary.evidenceRecall, 1);
  assert.equal(report.summary.fullCandidateRecallCases, 27);
  assert.equal(report.summary.fullEvidenceRecallCases, 27);
  assert.equal(report.paidModelCall, false);
  assert(report.cases.every((result) => result.required.length > 0));
  assert(report.cases.every((result) => result.candidateCount <= 12));
  console.log(formatResearchBenchmarkRetrievalReport(report));
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(temporaryDirectory, { recursive: true, force: true });
  for (const [key, value] of previousEnvironment) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
