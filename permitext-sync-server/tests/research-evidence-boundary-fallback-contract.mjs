import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  researchEvidenceBoundaryFallbackEligibility,
  researchEvidenceBoundaryInterpretation,
  researchMessageForClient
} from "../app.mjs";
import {
  immutableEvidenceSnapshot,
  immutableResearchAnswer
} from "../project-foundation-contract.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const appSource = await readFile(join(root, "../app.mjs"), "utf8");

const supportingEvidence = [{
  sourceID: "supporting-1",
  sectionID: "section-1",
  evidencePriority: {
    evidenceRole: "supporting",
    topicRouteRelationship: "collateral"
  }
}];
const safeAttempts = [{
  pass: false,
  issues: [
    {
      type: "irrelevant_citation",
      detail: "Remove the collateral citation."
    },
    {
      type: "incorrect_citation",
      detail: "Remove the orphan citation."
    },
    {
      type: "unsupported_requirement",
      detail: "Do not say an unsupplied law requires separate verification."
    }
  ]
}];
const observedOutsideLawIssue = {
  type: "unsupported_requirement",
  detail: "The answer asks whether the bicycle room is required by a zoning, land-use, funding-program, or other NYC provision and says a direct provision may be required by those authorities. The supplied enacted evidence does not support those asserted outside-law possibilities. The evidence boundary may be stated without characterizing unsupplied law as a possible governing requirement."
};

assert.equal(researchEvidenceBoundaryFallbackEligibility({
  verificationAttempts: safeAttempts,
  evidence: supportingEvidence,
  requiredClaims: []
}), true, "The narrow no-governing-evidence failure should use the deterministic boundary response.");

assert.equal(researchEvidenceBoundaryFallbackEligibility({
  verificationAttempts: [{ pass: false, issues: [observedOutsideLawIssue] }],
  evidence: supportingEvidence,
  requiredClaims: []
}), true, "The observed outside-law evidence-boundary failure should return the safe response.");

assert.equal(researchEvidenceBoundaryFallbackEligibility({
  verificationAttempts: safeAttempts,
  evidence: [{
    ...supportingEvidence[0],
    evidencePriority: { evidenceRole: "governing", topicRouteRelationship: "aligned" }
  }],
  requiredClaims: []
}), false, "Governing evidence must keep the ordinary verified-answer gate closed.");

assert.equal(researchEvidenceBoundaryFallbackEligibility({
  verificationAttempts: safeAttempts,
  evidence: supportingEvidence,
  requiredClaims: [{ claimID: "required-1" }]
}), false, "A required enacted claim must never be replaced by the boundary response.");

assert.equal(researchEvidenceBoundaryFallbackEligibility({
  verificationAttempts: [{
    pass: false,
    issues: [{
      type: "unsupported_requirement",
      detail: "The answer invents a 50-square-foot minimum."
    }]
  }],
  evidence: supportingEvidence,
  requiredClaims: []
}), false, "A substantive invented requirement must remain a verification failure.");

assert.equal(researchEvidenceBoundaryFallbackEligibility({
  verificationAttempts: [{
    pass: false,
    issues: [{ type: "misstated_provision", detail: "The answer reverses the enacted rule." }]
  }],
  evidence: supportingEvidence,
  requiredClaims: []
}), false, "A misstated enacted provision must remain a verification failure.");

const interpretation = researchEvidenceBoundaryInterpretation();
assert.deepEqual(interpretation.supportedPoints, []);
assert.deepEqual(interpretation.citations, []);
assert.match(interpretation.conclusion, /does not establish/i);
assert.match(interpretation.explanation, /cannot support a substantive code conclusion/i);
assert.match(interpretation.evidenceLimitations[0], /no governing enacted provision/i);
assert.doesNotMatch(
  JSON.stringify(interpretation),
  /zoning|land-use|funding-program/i,
  "The fallback must not repeat the verifier's unsupported outside-law possibilities."
);

const createdAt = "2026-08-17T12:00:00.000Z";
const evidence = immutableEvidenceSnapshot({
  id: "evidence-boundary-1",
  source: {
    sourceID: "supporting-1",
    sectionID: "section-1",
    jurisdiction: "New York City",
    codeEdition: "2022",
    codeBook: "Building Code",
    chapterNumber: "1",
    sectionNumber: "101.1",
    passageID: "supporting-1",
    text: "This reviewed passage does not govern the question.",
    codeVersion: "2022-nyc-construction-codes"
  },
  approvedAt: createdAt
});
const boundaryAnswer = {
  mode: "evidence_boundary",
  ...interpretation,
  verification: {
    status: "evidence_boundary",
    pass: false,
    reason: "NO_GOVERNING_EVIDENCE"
  }
};
const immutableBoundary = immutableResearchAnswer({
  id: "answer-boundary-1",
  owner: { kind: "user", id: "user-1" },
  conversationID: "conversation-1",
  question: "What is required?",
  answer: boundaryAnswer,
  evidence: [evidence],
  citations: [],
  model: "permitext-deterministic-evidence-boundary",
  researchSystemVersion: "evidence-boundary-v1",
  createdAt
});
assert.deepEqual(immutableBoundary.passageToCitationMapping, []);
assert.equal(immutableBoundary.verification.status, "evidence_boundary");

assert.throws(() => immutableResearchAnswer({
  id: "answer-ordinary-uncited",
  owner: { kind: "user", id: "user-1" },
  conversationID: "conversation-1",
  question: "What is required?",
  answer: { conclusion: "A substantive uncited conclusion." },
  evidence: [evidence],
  citations: [],
  model: "test",
  researchSystemVersion: "test",
  createdAt
}), /require citations/, "Ordinary Research answers must still fail without citations.");

assert.throws(() => immutableResearchAnswer({
  id: "answer-counterfeit-boundary",
  owner: { kind: "user", id: "user-1" },
  conversationID: "conversation-1",
  question: "What is required?",
  answer: {
    ...boundaryAnswer,
    conclusion: "A bicycle room is required."
  },
  evidence: [evidence],
  citations: [],
  model: "test",
  researchSystemVersion: "test",
  createdAt
}), /require citations/, "Boundary metadata must not permit a substantive uncited conclusion.");

const clientMessage = researchMessageForClient({
  id: "assistant-1",
  role: "assistant",
  researchRequestID: "ios-request-1",
  answer: {
    conclusion: interpretation.conclusion,
    usage: { totalTokens: 100 }
  }
});
assert.equal(clientMessage.requestID, "ios-request-1");
assert.equal(clientMessage.researchRequestID, undefined);
assert.equal(clientMessage.answer.usage, undefined);

const handlerStart = appSource.indexOf("async function handleResearchConversationMessage");
const handlerEnd = appSource.indexOf("async function handleResearchConversationDelete", handlerStart);
const handler = appSource.slice(handlerStart, handlerEnd);
assert.match(handler, /if \(applyEvidenceBoundaryFallback\(\)\) break;/);
assert.ok(
  handler.indexOf("if (applyEvidenceBoundaryFallback()) break;") <
    handler.indexOf("if (attempt === maximumResearchVerificationAttempts - 1)"),
  "A safe no-governing-evidence outcome must stop before a futile model revision."
);
assert.ok(
  handler.indexOf("applyEvidenceBoundaryFallback") < handler.indexOf("await commitResearchConversationMessage("),
  "The evidence-boundary response must continue through the ordinary durable answer/conversation commit."
);
assert.match(handler, /requestID: researchRequestID/);
assert.match(
  handler,
  /const providerUnavailable = \["RESEARCH_PROVIDER_ERROR", "RESEARCH_VERIFIER_ERROR", "TimeoutError"\][\s\S]*?"Terra's research service is temporarily unavailable\. Your question is still here\."[\s\S]*?"The research model could not return a verified, cited answer\."[\s\S]*?code: failureCode/,
  "Research provider outages must be recoverable while verification failures preserve their server code for native clients."
);

console.log("Permitext Research deterministic evidence-boundary fallback contract passed.");
