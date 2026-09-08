// Recheck the dated publisher capture against the actual Research source path.
// This uses no provider, browser, HTTP handler, saved project or network request.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { validateOwnerCodeSourceReview, ownerCodeResearchInput } from "../evals/research-owner-code-review.mjs";

let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw new Error("Network forbidden in source-refresh comparison."); };
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
const { assembledResearchEvidenceForTurn } = await import("../app.mjs");
const root = new URL("../", import.meta.url);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (path) => readFile(new URL(path, root));
const normalize = (text) => text.replace(/\s+/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
await validateOwnerCodeSourceReview();
const refreshBytes = await read("evals/results/research-owner-mc15-source-refresh-2026-09-08.json");
const refresh = JSON.parse(refreshBytes);
const historicalBytes = await read(refresh.historicalReview.file);
assert.equal(hash(historicalBytes), refresh.historicalReview.sha256, "Historical source review must stay immutable.");
const historical = JSON.parse(historicalBytes);
const pending = new Set(historical.cases.filter((item) => item.currentConsolidationRefreshPending).map((item) => item.id));
assert.equal(pending.size, refresh.historicalReview.pendingCount);
const compared = [];
for (const entry of refresh.refreshes) {
  assert(pending.has(entry.caseID), "Refresh each outstanding case only once.");
  const item = historical.cases.find((item) => item.id === entry.caseID);
  assert.equal(hash(item.question), entry.questionSHA256);
  assert.equal(hash(item.reviewedExpectedAnswer), entry.reviewedExpectedAnswerSHA256);
  assert(item.sourceReferences.includes(entry.reference));
  assert.deepEqual(entry.previousSource, historical.sources[entry.reference]);
  assert.equal(entry.expectedAnswerChanged, false);
  assert.equal(entry.professionalApproval, false);
  assert.equal(entry.currentConsolidationRefreshPending, false);
  const capture = entry.observedSource;
  assert.equal(hash(capture.capturedBody), capture.capturedBodySHA256);
  assert.equal(capture.completeSectionBodyCaptured, true);
  const result = await assembledResearchEvidenceForTurn({ ...ownerCodeResearchInput(item), projectFacts: [], messages: [], pinnedEvidence: [] });
  const source = result.sources.find((source) => `${source.codePrefix} ${source.sectionNumber}` === entry.reference && source.sectionID === entry.sectionID);
  assert(source?.canonicalContextComplete && !source.truncated, "Compare the complete canonical section supplied by Research.");
  assert.equal(source.jurisdiction, capture.jurisdiction);
  assert.equal(source.codeEdition, "2022 New York City Construction Codes");
  // The corpus includes the section number twice in its heading. Remove only
  // that exact heading, then normalize whitespace and spaces before punctuation.
  const prefix = `${source.sectionNumber} ${capture.title} `;
  assert(source.text.startsWith(prefix));
  const body = source.text.slice(prefix.length);
  assert.equal(normalize(body), normalize(capture.capturedBody), "Published and assembled substantive text must match in full.");
  pending.delete(entry.caseID);
  compared.push({ caseID: entry.caseID, sectionID: source.sectionID, reference: entry.reference,
    sourceTextSHA256: hash(source.text), normalizedBodySHA256: hash(normalize(body)), completeBodyMatch: true });
}
assert.equal(networkAttempts, 0);
assert.equal(pending.size, refresh.effectiveReviewCounts.currentConsolidationRefreshPending);
assert.equal(refresh.effectiveReviewCounts.total, historical.cases.length);
assert.equal(refresh.effectiveReviewCounts.total, historical.counts.reviewed);
for (const key of ["retain", "revise"]) assert.equal(refresh.effectiveReviewCounts[key], historical.counts[key]);
console.log(JSON.stringify({ sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  refreshSHA256: hash(refreshBytes), compared, pendingCaseIDs: [...pending], networkAttempts, paidProviderCalls: 0,
  projectWorkflowTested: false, liveAnswerQualityMeasured: false }, null, 2));
