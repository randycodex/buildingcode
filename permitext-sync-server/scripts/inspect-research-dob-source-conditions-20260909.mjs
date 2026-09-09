// Public-source and request inspection only. Never imports the HTTP app or
// provider client; does not generate an answer or exercise a Project workflow.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { ownerResearchScopeInput } from "../evals/research-owner-scope-input.mjs";
import { zoningSectionSummary } from "../zoning-content.mjs";
import { researchDOBWorkflowRoute } from "../research-dob-workflow-routing.mjs";
import { bindResearchWebSupportToOfficialDocuments } from "../research-official-html-attribution.mjs";
import { researchOfficialGuidanceSummaryRequest } from "../research-official-guidance-summary.mjs";

assert(process.argv.includes("--fetch-public-documents"));
assert(!process.argv.includes("--run-live"));
const root = new URL("../", import.meta.url);
const read = (file) => readFile(new URL(file, root));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const baselineCommit = "1dfe61e4d427742a47fa84ed0e52d344d2dec71e";
const prior = (file) => execFileSync("git", ["show", `${baselineCommit}:permitext-sync-server/${file}`], { cwd: root, maxBuffer: 12_000_000 });
const before = await import(`data:text/javascript;base64,${prior("research-dob-workflow-routing.mjs").toString("base64")}`);
const originalFile = "evals/research-reconciled-answer-key.json";
const addedFile = "evals/results/research-owner-code-source-review-2026-09-08.json";
const originalBytes = await read(originalFile), addedBytes = await read(addedFile);
assert.equal(hash(originalBytes), hash(prior(originalFile)), "Reference answers must not change to match generation.");
assert.equal(hash(addedBytes), hash(prior(addedFile)));
for (const file of ["evals/research-owner-scope-input.mjs", "evals/research-answer-key-reconciliation.mjs", "evals/research-owner-code-review.mjs"])
  assert.equal(hash(await read(file)), hash(prior(file)), "Authored input projection is unchanged.");
const cases = [...JSON.parse(originalBytes).cases.map((item) => ({ item, original: true })),
  ...JSON.parse(addedBytes).cases.map((item) => ({ item, original: false }))];
assert.equal(cases.length, 110);
const nativeFetch = fetch, requests = [];
globalThis.fetch = async () => { throw new Error("Network forbidden outside explicit public-source GETs."); };
const fetchImpl = async (url, options) => {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, "https:"); assert.equal(parsed.hostname, "www.nyc.gov");
  assert.equal(options.method, "GET");
  const response = await nativeFetch(url, options);
  requests.push({ url: String(url), status: response.status });
  return response;
};
const inputs = [], results = [];
let references = 0, exactSelections = 0;
for (const { item, original } of cases) {
  const input = await ownerResearchScopeInput(item, { original, zoningSummary: zoningSectionSummary });
  const oldRoute = before.researchDOBWorkflowRoute(input.question), route = researchDOBWorkflowRoute(input.question);
  assert.equal(route?.guidanceOnly, oldRoute?.guidanceOnly, `${item.id}: preserve the enacted-authority boundary.`);
  references += input.pinnedEvidence.length;
  exactSelections += input.pinnedEvidence.filter((source) => source.selectedText).length;
  inputs.push({ id: item.id, inputSHA256: hash(JSON.stringify(input)), topicBefore: oldRoute?.topic ?? null,
    topicAfter: route?.topic ?? null, directBefore: oldRoute?.directDocumentRetrieval ?? false,
    directAfter: route?.directDocumentRetrieval ?? false });
  if (!["DOBNOW-003", "DOBNOW-004", "DOBNOW-012", "DOBNOW-016", "DOBNOW-023"].includes(item.id)) continue;
  assert(route.directDocumentRetrieval);
  const bound = await bindResearchWebSupportToOfficialDocuments({ sources: route.sources }, {
    question: input.question, requiredPassageTerms: route.passageTerms, officialDomains: ["nyc.gov"], fetchImpl
  });
  assert.deepEqual(bound.sourceValidation.failures, []);
  assert.equal(bound.sources.length, route.sources.length);
  const request = researchOfficialGuidanceSummaryRequest({ question: input.question, webSupport: bound, model: "gpt-5.6-terra", userID: "isolated-inspection" });
  const passages = JSON.parse(request.input).passages;
  const text = passages.map((passage) => passage.text).join(" ").replace(/\s+/g, " ");
  if (item.id === "DOBNOW-003") {
    assert.match(text, /subsequent filing of an NB or Alteration-CO filing.*remain Permit Entire/);
    assert.match(text, /subsequent filing in pre-filing status/);
  }
  if (item.id === "DOBNOW-004") {
    assert.match(text, /Work on floors can be changed with a PAA/);
    assert.match(text, /NOT editable.*Work on Floors/);
  }
  if (item.id === "DOBNOW-012") assert.match(text, /City-owned sewer system.*exclusions and definitions/);
  if (item.id === "DOBNOW-016") {
    assert.match(text, /Yes In or affecting an IMD unit File for Loft Board Certification and include a Narrative Statement/);
    assert.match(text, /No In a commercial unit and does not affect an IMD Unit Request a Letter of No Objection/);
    assert.match(text, /Once the job filing is submitted/);
  }
  if (item.id === "DOBNOW-023") {
    assert.match(text, /cannot upload plans or submit filings\/permits/);
    assert.match(text, /owner must be logged in with the same email address/);
  }
  results.push({ id: item.id, inputSHA256: hash(JSON.stringify(input)), question: input.question,
    sourceCount: bound.sources.length, passageCount: passages.length,
    passageCharacters: passages.reduce((sum, passage) => sum + passage.text.length, 0),
    requestSHA256: hash(JSON.stringify(request)), sources: bound.sources });
}
const routingChanges = inputs.filter((item) => item.topicBefore !== item.topicAfter || item.directBefore !== item.directAfter);
assert.deepEqual(routingChanges.map((item) => item.id), ["DOBNOW-016", "DOBNOW-023"]);
assert.equal(references, 47); assert.equal(exactSelections, 8);
const sourceFiles = ["research-dob-workflow-routing.mjs", "research-official-guidance-summary.mjs", "research-source-policy.mjs",
  "research-official-html-attribution.mjs", "scripts/inspect-research-dob-source-conditions-20260909.mjs", originalFile, addedFile];
const report = { schema: "permitext-dob-source-conditions-inspection-v1", checkedAt: new Date().toISOString(), baselineCommit,
  sourceHashes: Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [file, hash(await read(file))]))),
  summary: { authoredCases: inputs.length, references, exactSelections, routingChanges: routingChanges.map((item) => item.id),
    guidanceOnlyChanges: 0, fetchedCases: results.length, publicDocumentGETs: requests.length, providerCalls: 0, paidAPICostUSD: 0 },
  inputs, requests, results, limitations: ["Fetched-source and request-factory checks do not establish live semantic quality or latency.",
    "The Loft Board service notice supplies text missing from the release-note image table. This is not general OCR support.",
    "All 110 cases and their existing acceptance gaps remain in scope. This inspection does not approve any answer."] };
const index = process.argv.indexOf("--output");
const output = index < 0 ? new URL("evals/results/research-owner-dob-source-conditions-inspection-2026-09-09.json", root) : process.argv[index + 1];
await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(report.summary));
