import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import { researchAnswerPresentationContract, researchGuidedNextStepInstruction,
  researchDecisionFactInstruction, researchAnswerPresentationVersion } from "../research-answer-presentation.mjs";
import { applyVerifiedProjectFollowups, researchResponseFollowupQuestions } from "../research-verification-followups.mjs";
import { researchDecisionFactRepair } from "../research-decision-fact-repair.mjs";
import { researchTargetedRevisionEligible } from "../research-targeted-revision.mjs";
import { isResearchPracticalNextStep } from "../research-practical-next-step.mjs";
import { resolveResearchCodeBasis } from "../research-code-basis.mjs";
import { buildResearchRequestEnvelopeBuilders } from "./research-request-envelope-preflight.mjs";

// These are pre-dispatch and source-binding checks, not model verdicts. No
// expected correct answer is returned by a provider double or treated as proof
// that a model applies a qualitative duty correctly.
let externalCalls = 0;
const forbidden = () => { externalCalls++; throw Error("External/provider calls forbidden in duty-supported next-step contract."); };
globalThis.fetch = forbidden;
http.request = https.request = http.get = https.get = forbidden;
const app = await import("../app.mjs");
const sha = value => createHash("sha256").update(value).digest("hex");
const plan = await app.researchCorpusPlanForTurn({
  question: "Under the 2022 NYC Mechanical, Plumbing and Building Codes, inspect the supplied enacted sources."
});
const resources = await app.researchCorpusResources(plan);
const codeBasis = resolveResearchCodeBasis({ corpusPlan: plan, availableCorpora: plan.selected,
  resolvedAt: "2026-10-04T00:00:00.000Z" });
const source = async (prefix, number, role = "governing") => {
  const section = resources.catalog.find(value => value.codePrefix === prefix && value.sectionNumber === number);
  assert(section, `${prefix} ${number} must be registered in the current corpus.`);
  const body = await app.researchBodyForCatalogSection(section);
  const text = body.blocks.map(block => block.plainText || "").filter(Boolean).join("\n\n");
  assert(text && body.researchClaimEligible !== false);
  return { ...section, sectionID: String(section.id), sourceID: `whole-${prefix}-${number}`, text,
    canonicalContextResolved: true, canonicalContextComplete: true, truncated: false,
    origin: "permitext_discovered", evidencePriority: { evidenceRole: role } };
};
const coolingDuty = await source("MC", "307.2.1");
const coolingScope = await source("MC", "307.2", "supporting");
const publicScope = await source("BC", "3201.1", "supporting");
const publicRule = await source("BC", "3201.4", "supporting");
const drainageDuty = await source("PC", "704.2");
const drainageSlope = await source("PC", "704.1", "supporting");
assert.equal(sha(coolingDuty.text), "17c25fdf8de9569401e0c5e7b0b390c216e7ac7dc8b3c612da79daac246cd90e");
assert.equal(sha(coolingScope.text), "472182bb9aa466280b7f6015836968341ec96a0f75a6824b5f93fbb2a63736cb");
assert.equal(sha(publicScope.text), "145fffdeeb609bcc1ef8c1eb82b1aec69436ba52050853e2dd6d0bf5a3e6afe2");
assert.equal(sha(publicRule.text), "520c13920c12208deed46f3148cf1d0d9aa26326fbb7abdca20841b21d955405");
assert(drainageDuty.text.includes("shall not be reduced") && drainageDuty.text.includes("water closet connection"));
assert(drainageSlope.text.includes("Table 704.1") && drainageSlope.text.includes("For SI:"));

// Drafts below are deliberately incomplete or wrong diagnostic input. Keeping
// them in the actual reviewer/revision input proves no presentation helper
// silently substitutes a preferred answer or removes legal uncertainty.
const draft = (text, rule, fields = {}) => ({ answerText: text,
  supportedPoints: [{ heading: "Diagnostic claim", explanation: text,
    sectionID: rule.sectionID, sourceIDs: [rule.sourceID] }],
  citations: [{ sectionID: rule.sectionID, sourceIDs: [rule.sourceID], relevance: "Diagnostic source binding, not a semantic approval." }],
  assumptions: [], missingFacts: [], followUpQuestions: [], evidenceLimitations: [],
  additionalEvidenceNeeded: [], supportingSourceUses: [], ...fields });
const cases = [
  { id: "duty-and-independent-scope", question: "Could an air conditioner drip a small amount of condensate onto a public walkway if it would keep the surface wet?",
    evidence: [coolingDuty, coolingScope, publicScope, publicRule],
    options: { conversationFactContext: { established: ["The equipment produces condensate and the walking surface would stay wet."],
      unknown: ["Whether a structure encroaches into the public right-of-way is unknown."] } },
    proposed: draft("Diagnostic failed disposition: only ask whether the structure encroaches; give no action applying the disposal duty.", coolingDuty) },
  { id: "independent-rule-expressly-requested", question: "Does the public-walking-surface prohibition itself apply when we do not know whether a structure encroaches into the public right-of-way?",
    evidence: [publicScope, publicRule], options: {},
    proposed: draft("Diagnostic conditional scope only; whether this structural encroachment exists is unresolved.", publicRule,
      { missingFacts: ["Whether a structure encroaches into the public right-of-way."],
        followUpQuestions: ["Does a structure encroach into the public right-of-way?"] }) },
  { id: "current-correction-no-invented-violation", question: "Correction: the condensate now goes to an approved disposal point and the walkway stays dry. Does that change the disposal concern?",
    evidence: [coolingDuty, coolingScope, publicScope, publicRule],
    options: { messages: [{ role: "user", question: "The condensate would keep the public walkway wet." },
      { role: "assistant", answer: { answerText: "Untrusted earlier claim: every outdoor location is prohibited." } }],
      conversationFactContext: { established: ["The condensate now goes to an approved disposal point.", "The walkway stays dry."] } },
    proposed: draft("Diagnostic wrong claim: all outdoor disposal remains prohibited despite the correction.", coolingDuty) },
  { id: "material-exception-preserved", question: "Correction: the coil is designed for sensible cooling only and does not support condensation. Does the drain-system duty still apply?",
    evidence: [coolingDuty, coolingScope], options: {},
    proposed: draft("Diagnostic wrong claim: the drain-system requirement applies without considering the supplied exception.", coolingScope) },
  { id: "resolved-threshold-no-extra-action", question: "For the stated eight-foot horizontal condensate run, is a one-inch fall enough for the required minimum slope?",
    evidence: [coolingDuty, coolingScope], options: {},
    proposed: draft("Diagnostic threshold comparison only; no replacement design is requested.", coolingDuty) },
  { id: "unrelated-duty-not-other-property", question: "Our sanitary drain goes from four inches to three inches downstream. It is not a toilet outlet. What should we change about that reduction? We have not specified the pipe slope.",
    evidence: [drainageDuty, drainageSlope], options: {},
    proposed: draft("Diagnostic wrong claim: unknown slope prevents applying the separately established flow-direction size duty.", drainageDuty) },
  { id: "invented-action-remains-reviewable", question: "What is the practical change to the downstream reduction in this non-toilet sanitary drain?",
    evidence: [drainageDuty, drainageSlope], options: {},
    proposed: draft("Diagnostic unsupported action: obtain a new annual reduction permit and use a proprietary pump, which the code requires.", drainageDuty) }
];
const pristine = structuredClone(cases);
const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders();
const proof = [];
for (const item of cases) {
  const options = { responseStyle: "conversational", codeBasis, ...item.options };
  assert.equal(isResearchPracticalNextStep(item.question, options.messages || []), false,
    "Substantive disposition, scope, exception and threshold requests stay in ordinary cited Research.");
  const writer = buildAnswerRequest(item.question, item.evidence, "offline-duty-next-step", options);
  const verifier = buildVerifierRequest(item.question, item.evidence, item.proposed, "offline-duty-next-step", options);
  const rejected = { pass: false, issues: [{ type: "unsupported_requirement", detail: "Diagnostic substantive rejection must remain a full review failure." }],
    missingFactsOnly: false, unnecessaryMissingFactIndices: [] };
  const revisionOptions = { ...options, previousInterpretation: item.proposed, revisionFeedback: rejected.issues };
  assert.equal(researchTargetedRevisionEligible(revisionOptions), false);
  const revision = buildAnswerRequest(item.question, item.evidence, "offline-duty-next-step", revisionOptions);
  const secondReview = buildVerifierRequest(item.question, item.evidence, item.proposed, "offline-duty-next-step",
    { ...options, verificationAttempts: [rejected] });
  assert.equal(writer.text.format.name, "permitext_code_interpretation");
  assert.equal(revision.text.format.name, writer.text.format.name);
  assert.deepEqual(revision.text.format.schema, writer.text.format.schema,
    "No guidance-only schema or relaxed binding is used for full substantive revision.");
  assert.deepEqual(secondReview.text.format.schema, verifier.text.format.schema);
  const contract = researchAnswerPresentationContract({ question: item.question, evidence: item.evidence, messages: options.messages });
  assert(contract.universalRules.includes(researchGuidedNextStepInstruction));
  assert(contract.universalRules.includes(researchDecisionFactInstruction));
  for (const body of [writer, verifier, revision, secondReview]) {
    assert(body.instructions.includes(researchGuidedNextStepInstruction), "The same duty/action boundary reaches each actual request stage.");
    assert(body.instructions.includes(researchDecisionFactInstruction));
    assert.equal(body.text.format.strict, true);
    assert(!body.instructions.includes("PRACTICAL NEXT-STEP GUIDANCE ONLY"));
    assert(body.input.includes(item.question));
    for (const rule of item.evidence) {
      assert(body.input.includes(rule.text), "Full operative text, scope, exceptions and table notes survive every stage.");
      for (const value of [rule.sourceID, rule.sectionID, rule.title, rule.codeEdition, rule.codeVersion, rule.corpusID])
        assert(body.input.includes(value), `Fresh canonical identity ${value} is retained.`);
    }
    for (const fact of options.conversationFactContext?.established || []) assert(body.input.includes(fact));
    for (const fact of options.conversationFactContext?.unknown || []) assert(body.input.includes(fact));
  }
  assert(verifier.input.includes(item.proposed.answerText));
  assert(secondReview.input.includes(item.proposed.answerText));
  assert(revision.input.includes(JSON.stringify(item.proposed)), "A full revision receives the unchanged diagnostic draft, not a substituted answer.");
  assert.match(verifier.instructions, /Fail with unsupported_requirement/);
  assert.match(verifier.instructions, /Do not treat prior assistant conclusions as established facts/);
  assert.equal(applyVerifiedProjectFollowups(item.proposed, rejected), item.proposed);
  assert.equal(researchDecisionFactRepair(item.proposed, { ...rejected, missingFactsOnly: true,
    unnecessaryMissingFactIndices: [0] }).applied, false, "A substantive invented action cannot be approved by deleting a fact.");
  // Structural binding is separate from semantic approval. It must still reject
  // fabricated references or an uncited action in the ordinary answer schema.
  assert.throws(() => app.validateResearchInterpretation({ ...item.proposed, supportedPoints: [], citations: [] }, item.evidence),
    { code: "INVALID_RESEARCH_RESPONSE" });
  assert.throws(() => app.validateResearchInterpretation({ ...item.proposed,
    citations: [{ sectionID: "not-supplied", sourceIDs: ["invented-action-source"], relevance: "Forged action binding." }] }, item.evidence),
    { code: "INVALID_RESEARCH_CITATION" });
  proof.push({ id: item.id, presentationMode: contract.mode, stages: 4,
    sourceHashes: item.evidence.map(rule => ({ reference: `${rule.codePrefix} ${rule.sectionNumber}`, sha256: sha(rule.text) })),
    writerSchemaSHA256: sha(JSON.stringify(writer.text.format.schema)), verifierSchemaSHA256: sha(JSON.stringify(verifier.text.format.schema)),
    checks: ["full canonical body and identity retained", "current facts/unknowns retained", "same shared policy in four actual stages",
      "ordinary enacted bindings mandatory", "substantive failure not auto-approved", "no preferred narrative substituted"] });
}
assert.equal(researchAnswerPresentationContract({ question: cases[4].question, evidence: cases[4].evidence }).mode, "numeric-rule",
  "The existing requested numeric comparison keeps its narrow mode, rather than a guidance or full-checklist route.");
const scopeAnswer = cases[1].proposed;
assert.deepEqual(researchResponseFollowupQuestions(scopeAnswer, {}), scopeAnswer.followUpQuestions,
  "A genuine requested scope question is not suppressed by the practical-action presentation policy.");
const empty = { ...cases[4].proposed, followUpQuestions: [] };
assert.deepEqual(researchResponseFollowupQuestions(empty, { highValueFollowUpQuestions: ["Optional design detail?"] }), [],
  "A resolved threshold can retain an explicit empty follow-up without legacy checklist clutter.");
assert.deepEqual(cases, pristine, "No duty, exception, current correction, uncertainty or proposed narrative is mutated.");
assert.equal(externalCalls, 0);
const result = { schemaVersion: 1, contract: "duty-supported-next-step-envelope-boundaries", version: researchAnswerPresentationVersion,
  cases: proof, externalCalls, providerCalls: 0,
  limitations: ["No generated answer or model verdict is evaluated.", "These checks prove canonical input preservation, shared policy wiring and unchanged structural/rejection mechanics, not whether a model selects a useful action or correctly resolves a legal classification.",
    "Known canonical regression sources and assistant-authored diagnostic cases; fresh v38 questions and keys were not accessed."] };
const output = process.argv.find(value => value.startsWith("--output="))?.slice("--output=".length);
if (output) await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ contract: result.contract, diagnosticCases: proof.length, actualPreDispatchStages: proof.length * 4,
  externalCalls, providerCalls: 0, semanticAccuracyClaim: false, ...(output ? { output } : {}) }));
