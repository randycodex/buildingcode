// No provider dispatch or credentials. Public document GETs require the flag.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { researchDOBWorkflowRoute } from "../research-dob-workflow-routing.mjs";
import { bindResearchWebSupportToOfficialDocuments } from "../research-official-html-attribution.mjs";
import { researchOfficialGuidanceSummaryRequest } from "../research-official-guidance-summary.mjs";
import { ownerHTTPResearchRequestHash } from "../evals/research-owner-http-request-binding.mjs";

assert(process.argv.includes("--fetch-public-documents"), "This inspection needs public NYC document GETs, never provider requests.");
const root = new URL("../", import.meta.url);
const read = (file) => readFile(new URL(file, root));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const baselineFile = "evals/results/research-owner-companion-source-inspection-2026-09-09.json";
const baselineBytes = await read(baselineFile), baseline = JSON.parse(baselineBytes);
const nativeFetch = fetch, requests = [];
globalThis.fetch = async () => { throw new Error("Unexpected network outside the public-source inspector."); };
const fetchImpl = async (url, options) => {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, "https:"); assert.equal(parsed.hostname, "www.nyc.gov");
  assert.equal(options.method, "GET");
  const result = await nativeFetch(url, options);
  requests.push({ url: String(url), status: result.status });
  return result;
};
const results = [];
for (const original of baseline.cases) {
  const route = researchDOBWorkflowRoute(original.question);
  assert.equal(route.directDocumentRetrieval, true);
  const current = await bindResearchWebSupportToOfficialDocuments({ sources: route.sources }, {
    question: original.question, requiredPassageTerms: route.passageTerms, officialDomains: ["nyc.gov"], fetchImpl
  });
  assert.equal(current.sources.length, route.sources.length);
  assert.deepEqual(current.sourceValidation.failures, []);
  const request = (sources) => ({ ...researchOfficialGuidanceSummaryRequest({
    question: original.question, webSupport: { sources }, model: "gpt-5.6-terra", userID: "isolated-inspection"
  }), service_tier: "default" });
  const before = request(original.sources), after = request(current.sources);
  const bound = (body) => ownerHTTPResearchRequestHash(body, { normalizeOfficialHTML: true });
  assert.equal(bound(after), bound(before), `${original.id}: source passages or request semantics changed; do not dispatch on the old preflight.`);
  const changedPassage = structuredClone(after), input = JSON.parse(changedPassage.input);
  input.passages[0].text += " Unsupported new condition.";
  changedPassage.input = JSON.stringify(input);
  assert.notEqual(bound(changedPassage), bound(after));
  results.push({ id: original.id, originalRawRequestSHA256: hash(JSON.stringify(before)),
    currentRawRequestSHA256: hash(JSON.stringify(after)), equivalentRequestSHA256: bound(after),
    actualPassageMutationDetected: true,
    sourceFingerprints: current.sources.map((source) => ({ url: source.url, format: source.sourceValidation,
      original: original.sources.find((item) => item.id === source.id).sourceContentHash,
      current: source.sourceContentHash })) });
}
const sourceFiles = ["research-dob-workflow-routing.mjs", "research-official-html-attribution.mjs",
  "research-official-guidance-summary.mjs", "research-source-policy.mjs", "evals/research-owner-http-request-binding.mjs",
  "scripts/inspect-research-companion-request-binding-20260909.mjs"];
const report = { schema: "permitext-companion-request-binding-inspection-v1", checkedAt: new Date().toISOString(),
  baseline: { file: baselineFile, sha256: hash(baselineBytes) },
  sourceHashes: Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [file, hash(await read(file))]))),
  status: "passed", paidAPICalls: 0, providerCalls: 0, publicDocumentGETs: requests.length, requests, results,
  limitations: ["This is a fetched-source and request-factory inspection, not an HTTP generation or semantic-verification run.",
    "Only the opt-in diagnostic comparison normalizes opaque HTML identifiers. Runtime source hashes, citations and persistence verification remain unchanged.",
    "Existing consumed packages retain the default comparison; a new paid package must explicitly select the new comparison and bind a new committed HTTP preflight."] };
const index = process.argv.indexOf("--output");
const output = index < 0 ? new URL("evals/results/research-owner-companion-request-binding-inspection-2026-09-09.json", root) : process.argv[index + 1];
await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: report.status, cases: results.map((item) => item.id), publicDocumentGETs: requests.length,
  rawRequestChanges: results.filter((item) => item.originalRawRequestSHA256 !== item.currentRawRequestSHA256).length, paidAPICalls: 0 }));
