import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { researchClaimScopeInstruction } from "../research-claim-scope.mjs";
import { guidanceSourceRelationships } from "../research-guidance-source-relationships.mjs";
import { researchOfficialGuidanceSummaryRequest } from "../research-official-guidance-summary.mjs";
import { buildResearchRequestEnvelopeBuilders } from "./research-request-envelope-preflight.mjs";

globalThis.fetch = () => { throw new Error("Claim-scope checks forbid network/provider calls."); };
const read = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url)));
const { buildAnswerRequest, buildVerifierRequest } = await buildResearchRequestEnvelopeBuilders();
const inventory = await read("evals/results/research-owner-backlog-v2-2026-09-09.json");
assert.equal(inventory.cases.length, 110);
const source = { sectionID: "scope-sentinel", sourceID: "scope-sentinel-passage", codePrefix: "BC", sectionNumber: "1",
  title: "Synthetic source preservation sentinel", text: "When condition A applies, action B is required. Exception: condition C changes the result." };
// These are request-contract checks on the whole question cohort, not 110
// generated answers or a replacement for the cases' actual enacted evidence.
for (const item of inventory.cases) {
  const question = [item.questionContext ? `Context: ${item.questionContext}` : "", item.scenario, item.question].filter(Boolean).join("\n\n");
  const answer = { answerText: "Synthetic candidate; unresolved condition C.", evidenceLimitations: ["Synthetic unresolved condition."] };
  for (const request of [
    buildAnswerRequest(question, [source], "offline-scope", { responseStyle: "conversational" }),
    buildVerifierRequest(question, [source], answer, "offline-scope", { responseStyle: "conversational" })
  ]) {
    assert(request.instructions.includes(researchClaimScopeInstruction), `${item.id}: missing claim-scope instruction`);
    assert(request.input.includes(question), `${item.id}: question changed`);
    assert(request.input.includes(source.text), `${item.id}: source changed`);
    assert.equal(request.text.format.strict, true);
  }
}

const inspection = await read("evals/results/research-owner-dob-source-conditions-inspection-2026-09-09.json");
const paa = inspection.results.find((item) => item.id === "DOBNOW-004");
const webSupport = { sources: paa.sources };
const draft = researchOfficialGuidanceSummaryRequest({ question: paa.question, webSupport, model: "offline", userID: "offline" });
const input = JSON.parse(draft.input);
const unchanged = structuredClone(input);
const relationships = guidanceSourceRelationships(input);
assert.equal(relationships.length, 1);
assert.equal(relationships[0].kind, "field_editability");
assert.equal(relationships[0].field, "Work on Floors");
assert.match(relationships[0].evidence.excerpts.join(" "), /fields are NOT editable:.*Work on Floors/);
assert.match(relationships[0].relatedEvidence[0].excerpts.join(" "), /My filing is approved.*How do I add or remove a floor.*Work on floors can be changed with a PAA/);
for (const binding of [relationships[0].evidence, ...relationships[0].relatedEvidence]) {
  const passage = input.passages.find((item) => item.sourceID === binding.sourceID && item.claimID === binding.claimID);
  assert.equal(binding.contentHash, passage.contentHash);
  for (const excerpt of binding.excerpts) assert(passage.text.replace(/\s+/g, " ").trim().includes(excerpt));
}
assert.deepEqual(input, unchanged, "Relationship discovery must not rewrite source evidence.");
for (const mutate of [
  (value) => { value.question = "Where is the payment tab?"; },
  (value) => { value.passages = []; },
  (value) => { value.passages = value.passages.filter((p) => p.sourceID !== "dob-paa-process"); },
  (value) => { value.passages = value.passages.filter((p) => p.sourceID !== "dob-paa-faq"); },
  (value) => { value.passages.forEach((p) => { p.contentHash = "invalid"; }); },
  (value) => { value.passages.forEach((p) => { p.text = p.text.replaceAll("fields are NOT editable", "fields are editable"); }); },
  (value) => { value.passages.forEach((p) => { p.text = p.text.replaceAll("Work on floors can be changed with a PAA", "Work on floors cannot be changed with a PAA"); }); }
]) {
  const changed = structuredClone(input); mutate(changed);
  assert.deepEqual(guidanceSourceRelationships(changed), [], "A missing/changed source or unrelated question must remove the comparison.");
}
const renamed = structuredClone(input);
renamed.passages.forEach((p) => { p.text = p.text.replace(/Work on Floors/gi, "Synthetic Field"); });
assert.equal(guidanceSourceRelationships(renamed)[0].field, "Synthetic Field", "The field identity must come from the evidence, not a case ID or answer key.");
assert.deepEqual(guidanceSourceRelationships({ question: `${paa.question} ${relationships[0].evidence.excerpts.join(" ")} ${relationships[0].relatedEvidence[0].excerpts.join(" ")}`, passages: [] }), []);

const proposedAnswer = { paragraphs: [{ text: "Synthetic unresolved field-editability finding.", sourceUses: input.passages.slice(0, 2).map(({ sourceID, claimID }) => ({ sourceID, claimID })) }], missingFacts: [], evidenceLimitations: [] };
const verifier = researchOfficialGuidanceSummaryRequest({ question: paa.question, webSupport, model: "offline", userID: "offline", proposedAnswer,
  verificationSchema: { type: "object", properties: { pass: { type: "boolean" } }, required: ["pass"] } });
for (const request of [draft, verifier]) {
  assert(request.instructions.includes(researchClaimScopeInstruction));
  const packet = JSON.parse(request.input);
  assert.deepEqual(packet.passages, input.passages, "Writer and verifier retain every complete source passage.");
  assert.deepEqual(packet.sourceRelationships, relationships);
}
assert.deepEqual(JSON.parse(verifier.input).proposedAnswer, proposedAnswer);
assert.equal(draft.max_output_tokens, 2200);
assert.equal(verifier.max_output_tokens, 1800);
assert.deepEqual(draft.reasoning, { effort: "low" });
assert.deepEqual(verifier.reasoning, { effort: "low" });
assert.equal(draft.text.format.strict, true);
assert.equal(verifier.text.format.strict, true);
console.log("Claim-scope instructions reach 220 code request envelopes and both guidance stages; source-derived PAA comparison retains both full contexts and disappears on source/scope changes. No generated-answer acceptance or provider calls.");
