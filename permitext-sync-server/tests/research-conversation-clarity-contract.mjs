import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { researchAnswerPresentationContract, researchGuidedNextStepInstruction,
  researchDecisionFactInstruction } from "../research-answer-presentation.mjs";
import { applyVerifiedProjectFollowups, researchResponseFollowupQuestions } from "../research-verification-followups.mjs";
import { buildResearchRequestEnvelopeBuilders } from "./research-request-envelope-preflight.mjs";
import { researchFollowUpQuestionsForResponse } from "../app.mjs";

globalThis.fetch = () => { throw Error("No provider/network calls in conversation clarity contract."); };
const evidence = [{ sourceID: "complete-operative-rule", sectionID: "registered-rule", codePrefix: "MC",
  sectionNumber: "990.1", title: "Synthetic complete operative rule.",
  codeEdition: "2022 New York City Construction Codes", codeVersion: "fixture-current", corpusID: "fixture-current",
  origin: "permitext_discovered", text: "The proposed substitution is not a permitted method under this complete rule. Separate equipment classes follow their own conditions.",
  canonicalContextResolved: true, canonicalContextComplete: true, evidencePriority: { evidenceRole: "governing" } }];
const messages = [{ role: "user", question: "Can this proposed method replace the required protection?" },
  { role: "assistant", answer: { answerText: "The stated substitution is not permitted. A separate equipment class has its own conditional rule.", followUpQuestions: [] } }];
const answer = { answerText: "No. The stated method cannot replace the required protection. The separate equipment-class rule remains conditional.",
  supportedPoints: [{ heading: "Substitution", explanation: "Only the stated method comparison is resolved.", sectionID: "registered-rule", sourceIDs: [evidence[0].sourceID] }],
  citations: [{ sectionID: "registered-rule", sourceIDs: [evidence[0].sourceID], relevance: "Supplies the method restriction." }],
  missingFacts: [], assumptions: [], followUpQuestions: [], evidenceLimitations: [], additionalEvidenceNeeded: [], supportingSourceUses: [] };
const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders();
const question = "Does that substitution work under the stated rule?";
const before = structuredClone({ answer, evidence, messages });
const writer = buildAnswerRequest(question, evidence, "offline-clarity", { messages, responseStyle: "conversational" });
const verifier = buildVerifierRequest(question, evidence, answer, "offline-clarity", { messages });
const contract = researchAnswerPresentationContract({ question, evidence, messages });
assert(contract.universalRules.includes(researchGuidedNextStepInstruction));
assert(contract.universalRules.includes(researchDecisionFactInstruction));
assert(writer.instructions.includes(researchGuidedNextStepInstruction), "The actual writer receives the shared presentation contract in its instructions.");
assert(verifier.instructions.includes(researchGuidedNextStepInstruction), "The actual verifier receives the same current-decision policy.");
for (const phrase of [
  "only when its answer can change or determine the current requested result",
  "must not reopen an already resolved decision",
  "do not infer an unstated fact from a colloquial label",
  "specific design or application decision that remains unresolved",
  "Do not merely report unavailable excerpts",
  "Put the precise legal-evidence boundary",
  "do not promise an unperformed lookup",
  "Never waive material qualifications"
]) assert(researchGuidedNextStepInstruction.includes(phrase), phrase);
assert(writer.input.includes(evidence[0].text));
assert(verifier.input.includes(evidence[0].text));
assert(verifier.input.includes(answer.answerText));
assert.match(verifier.instructions, /Fail with repeated_established_fact/);
assert.match(verifier.instructions, /Fail with unnecessary_qualification/);
assert.match(verifier.instructions, /Do not treat prior assistant conclusions as established facts/);
assert.match(verifier.instructions, /do not force downstream compliance checklists/);
assert.match(verifier.instructions, /project fact that can change or determine the current requested result/);
assert.match(verifier.instructions, /conditional side rule or later design choice is not a question for an already resolved decision/);

// These helper contrasts prove delivery behavior, not that a model correctly
// judges whether an unknown fact is decisive. Genuine unresolved choices remain
// admissible under the normal passing-review contract.
const internalAnalysis = { highValueFollowUpQuestions: ["What is the separate equipment class?"] };
assert.deepEqual(researchResponseFollowupQuestions(answer, internalAnalysis), []);
const stillUnknown = { ...answer, answerText: "Which permitted route applies depends on the unstated installation type." };
const decisiveQuestion = "Which installation type is proposed?";
const reviewed = applyVerifiedProjectFollowups(stillUnknown, { pass: true, issues: [], projectFactQuestions: [decisiveQuestion] });
assert.deepEqual(researchResponseFollowupQuestions(reviewed, internalAnalysis), [decisiveQuestion]);
assert.deepEqual(reviewed.missingFacts, [decisiveQuestion]);
assert.equal(reviewed.answerText, stillUnknown.answerText);
const failedReview = applyVerifiedProjectFollowups(stillUnknown, { pass: false,
  issues: [{ type: "unsupported_requirement", detail: "The proposed condition is unsupported." }], projectFactQuestions: [decisiveQuestion] });
assert.equal(failedReview, stillUnknown, "A failed review cannot use a fact question to authorize delivery.");

// Exercise the exported production delegate and the exact final answer field
// expression read from the route, after its passing-review application. This
// ends before persistence/HTTP delivery and cannot dispatch a provider call.
const appSource = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
const reviewStart = appSource.indexOf("result.interpretation = applyVerifiedProjectFollowups(");
const messageStart = appSource.indexOf("const assistantMessage = {", reviewStart);
const projectionStart = appSource.indexOf("followUpQuestions: researchFollowUpQuestionsForResponse(", messageStart);
const projectionEnd = appSource.indexOf("evidenceSectionIDs:", projectionStart);
assert(reviewStart >= 0 && messageStart > reviewStart && projectionStart > messageStart && projectionEnd > projectionStart,
  "The actual final envelope must project follow-ups after applying the final review.");
const finalEnvelopeFollowups = new Function("result", "evidenceAnalysisResult", "supportingGuidanceOnly", "researchFollowUpQuestionsForResponse",
  `return { ...result.interpretation, ${appSource.slice(projectionStart, projectionEnd)} };`);
for (const [interpretation, options, expected] of [
  [answer, {}, []],
  [{ answerText: "Legacy answer without a field." }, {}, internalAnalysis.highValueFollowUpQuestions],
  [reviewed, {}, [decisiveQuestion]],
  [{ ...reviewed, followUpQuestions: null }, {}, []],
  [reviewed, { supportingGuidanceOnly: true }, []]
]) {
  assert.deepEqual(researchFollowUpQuestionsForResponse(interpretation, internalAnalysis, options), expected);
  const envelope = finalEnvelopeFollowups({ interpretation }, { analysis: internalAnalysis },
    Boolean(options.supportingGuidanceOnly), researchFollowUpQuestionsForResponse);
  assert.deepEqual(envelope.followUpQuestions, expected);
  assert.equal(envelope.answerText, interpretation.answerText, "The final envelope preserves the legal narrative.");
}
assert.deepEqual({ answer, evidence, messages }, before, "No answer or source text is rewritten for presentation.");

console.log("Conversation clarity passed: shared actual writer/verifier policy, production follow-up delegate/final-envelope field, decisive question retention, no narrative/source rewriting; no provider, persisted HTTP or semantic accuracy claim.");
