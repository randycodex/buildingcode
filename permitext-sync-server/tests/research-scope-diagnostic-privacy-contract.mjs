import assert from "node:assert/strict";
import { createResearchOperationMetric, createResearchVerificationAttemptDiagnostics } from "../research-economics.mjs";

const scope = {
  schemaVersion: 99,
  kind: "zoning_answer_scope",
  nonZoningExemption: true,
  reasonCodes: ["eligible_technical_bindings", "private answer text", "eligible_technical_bindings"],
  boundReferenceCount: 2,
  boundSourceCount: 2,
  eligibleTechnicalSourceCount: 2,
  missingBindingCount: -1,
  pinnedZoningSourceCount: Number.POSITIVE_INFINITY,
  ancillaryBoundaryCount: 100_000,
  operativeZoningLimitationCount: "private address",
  bindingRejections: { referenceOnly: 1, incomplete: 3, rawText: "private code quotation" },
  question: "private question",
  rawResponse: "private provider output"
};
const attempts = createResearchVerificationAttemptDiagnostics([{ zoningSafety: scope }]);
assert.equal(attempts[0].attempt, 1);
const sanitized = attempts[0].zoningSafety;
assert.equal(sanitized.schemaVersion, 1);
assert.equal(sanitized.nonZoningExemption, true);
assert.deepEqual(sanitized.reasonCodes, ["eligible_technical_bindings"]);
assert.equal(sanitized.boundSourceCount, 2);
assert.equal(sanitized.missingBindingCount, 0);
assert.equal(sanitized.pinnedZoningSourceCount, 0);
assert.equal(sanitized.ancillaryBoundaryCount, 1_000);
assert.equal(sanitized.operativeZoningLimitationCount, 0);
assert.equal(sanitized.bindingRejections.referenceOnly, 1);
assert.equal(sanitized.bindingRejections.incomplete, 3);
assert.equal(JSON.stringify(attempts).includes("private"), false);

const metric = createResearchOperationMetric({
  id: "scope-test", createdAt: "2026-10-03T18:00:00.000Z", status: "failed", charged: false,
  verificationAttemptDiagnostics: [{ zoningSafety: scope }]
});
assert.deepEqual(metric.verificationAttemptDiagnostics, attempts);
assert.equal(JSON.stringify(metric).includes("private"), false);
assert.deepEqual(createResearchVerificationAttemptDiagnostics([
  { zoningSafety: { ...scope, reasonCodes: ["private arbitrary reason"] } }
]), []);
assert.deepEqual(createResearchVerificationAttemptDiagnostics([
  { zoningSafety: { ...scope, kind: "private arbitrary diagnostic" } }
]), []);

const mapped = createResearchVerificationAttemptDiagnostics([{ zoningSafety: {
  kind: "zoning_mapped_location", sourceBoundaryQuestion: true,
  triggeringClauses: [], scopeDecision: scope, rawText: "private location prose"
} }]);
assert.equal(mapped[0].zoningSafety.kind, "zoning_mapped_location");
assert.deepEqual(mapped[0].zoningSafety.scopeDecision, sanitized);
assert.equal(JSON.stringify(mapped).includes("private"), false);
assert.equal(createResearchVerificationAttemptDiagnostics([
  { zoningSafety: scope }, { zoningSafety: scope }, { zoningSafety: scope }
]).length, 2);
console.log("Research scope diagnostic privacy contract passed");
