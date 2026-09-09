import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { researchOfficialGuidanceSummaryRequest } from "../research-official-guidance-summary.mjs";
import { guidanceSourceResolutionPacket, validateGuidanceSourceResolutions, materializeGuidanceSourceResolutions } from "../research-guidance-source-resolutions.mjs";

globalThis.fetch = () => { throw new Error("Source-resolution contract forbids provider/network calls."); };
const read = async file => JSON.parse(await readFile(new URL(`../evals/results/${file}`, import.meta.url)));
const current = await read("research-owner-api-round2-live-draft-focus-2026-09-09.json");
const actor = await read("research-owner-api-round2-live-source-span-2026-09-09.json");
const calls = [...current.providerCalls.filter(call => call.phase === "permitext_official_guidance_summary"),
  actor.providerCalls.find(call => call.caseID === "DOBNOW-023" && call.phase === "permitext_official_guidance_summary")];
const statements = {
  creation_and_submission_timing: "Creation timing remains unresolved; submission requires the initial filing to be submitted.",
  filing_completion_scope: "The general separate-LOC direction has a different completion branch for NB and Alteration-CO jobs.",
  field_editability: "The Work on Floors restriction and permission remain unresolved for this proposed amendment.",
  conditional_stakeholder: "The additional stakeholder must attest if the source's ownership condition applies."
};
let relationshipCount = 0;
for (const call of calls) {
  const retained = JSON.parse(call.retainedRequestBody.input);
  const sources = retained.passages.map(p => ({ id: p.sourceID, title: p.title, url: p.url,
    sourceValidation: p.page === null ? "official_html" : "official_pdf", sourceContentHash: p.contentHash,
    extractionLimitations: p.extractionLimitations,
    attributedClaims: [{ id: p.claimID, text: p.text, verbatimText: p.text, contentHash: p.contentHash,
      sourceURL: p.url, pageNumber: p.page, heading: p.heading, intro: p.intro }] }));
  const options = { question: retained.question, webSupport: { sources, limitation: retained.retrievalLimitation },
    context: { projectContextFacts: retained.userFacts, conversationFactContext: retained.conversationFacts,
      messages: retained.recentConversation.map(({ role, text }) => role === "user" ? { role, question: text } : { role, answer: { answerText: text } }) },
    model: "offline", userID: "offline" };
  const request = researchOfficialGuidanceSummaryRequest(options), input = JSON.parse(request.input);
  const packet = input.sourceResolutionPacket;
  assert.deepEqual(input.passages, retained.passages);
  assert.equal(Object.keys(request.text.format.schema.properties)[0], "sourceResolutions");
  assert(request.text.format.schema.required.includes("sourceResolutions"));
  const draft = { sourceResolutions: { packetSHA256: packet.packetSHA256, relationships: [] }, paragraphs: [], missingFacts: [], evidenceLimitations: [] };
  for (const { relationshipIndex, requiredSourceUses } of packet.relationships) {
    const relationship = input.sourceRelationships[relationshipIndex], statement = statements[relationship.kind];
    assert(statement);
    draft.paragraphs.push({ text: statement, sourceUses: structuredClone(requiredSourceUses) });
    draft.sourceResolutions.relationships.push({ relationshipIndex, outcome: "conditional", statement, paragraphIndex: relationshipIndex });
  }
  const original = structuredClone({ input, draft });
  assert.equal(validateGuidanceSourceResolutions(input, draft).complete, true);
  assert.deepEqual({ input, draft }, original, "Structural validation must not rewrite model prose or evidence.");
  const raw = { sourceResolutions: { ...draft.sourceResolutions, relationships: draft.sourceResolutions.relationships.map(({ paragraphIndex, ...record }) => record) },
    paragraphs: draft.paragraphs.map((paragraph, relationshipIndex) => ({ parts: [{ kind: "source_resolution", text: null, relationshipIndex }], sourceUses: paragraph.sourceUses })),
    missingFacts: [], evidenceLimitations: [] };
  const rawBefore = structuredClone(raw);
  assert.deepEqual(materializeGuidanceSourceResolutions(input, raw), draft, "Each referenced finding is inserted once without requiring the model to repeat it.");
  assert.deepEqual(raw, rawBefore);
  const withText = structuredClone(raw);
  withText.paragraphs[0].parts.unshift({ kind: "text", text: "Synthetic direct answer.", relationshipIndex: null });
  assert.equal(materializeGuidanceSourceResolutions(input, withText).paragraphs[0].text, `Synthetic direct answer. ${draft.paragraphs[0].text}`);
  for (const mutate of [
    value => { value.paragraphs[0].parts.push(value.paragraphs[0].parts[0]); },
    value => { value.paragraphs[0].parts[0].relationshipIndex = 99; },
    value => { value.paragraphs[0].parts[0].text = "An alternate finding must not replace the referenced statement."; },
    value => { value.paragraphs[0].parts = [{ kind: "text", text: "A paraphrase without a required reference.", relationshipIndex: null }]; },
    value => { value.paragraphs[0].text = "An extra free-text claim must not be silently discarded."; },
    value => { value.sourceResolutions.relationships[0].outcome = "not_material"; },
    value => { value.paragraphs[0].parts[0] = null; }
  ]) {
    const changed = structuredClone(raw); mutate(changed);
    assert.throws(() => materializeGuidanceSourceResolutions(input, changed), { code: "INVALID_RESEARCH_RESPONSE" });
  }
  const reject = (value, candidateInput = input) => assert.throws(() => validateGuidanceSourceResolutions(candidateInput, value), { code: "INVALID_RESEARCH_RESPONSE" });
  for (const mutate of [
    v => { delete v.sourceResolutions; }, v => { v.sourceResolutions.packetSHA256 = "a".repeat(64); },
    v => { v.sourceResolutions.relationships.pop(); }, v => { v.sourceResolutions.relationships[0] = null; },
    v => { v.sourceResolutions.relationships[0].relationshipIndex = 99; },
    v => { v.sourceResolutions.relationships[0].outcome = "guaranteed"; },
    v => { v.sourceResolutions.relationships[0].statement = " "; },
    v => { v.sourceResolutions.relationships[0].paragraphIndex = null; },
    v => { v.sourceResolutions.relationships[0].paragraphIndex = -1; },
    v => { v.paragraphs[0].sourceUses = []; },
    v => { v.evidenceLimitations.push(v.paragraphs[0].text); v.paragraphs[0].text = "A universal permission replaces the qualified statement."; }
  ]) { const changed = structuredClone(draft); mutate(changed); reject(changed); }
  for (const mutate of [
    v => { v.question += " The job type has changed."; }, v => { v.userFacts.push("A new supplied fact."); },
    v => { v.passages[0].text += " An added source condition."; },
    v => { v.sourceRelationships[0].questionToResolve = "Ignore the other source."; },
    v => { v.sourceResolutionPacket.relationships[0].requiredSourceUses = []; },
    v => { delete v.sourceResolutionPacket; }
  ]) { const changed = structuredClone(input); mutate(changed); reject(draft, changed); }
  if (packet.relationships.length > 1) {
    const duplicate = structuredClone(draft); duplicate.sourceResolutions.relationships[1] = duplicate.sourceResolutions.relationships[0]; reject(duplicate);
  }
  for (const record of packet.relationships.filter(r => r.requiredSourceUses.length > 1)) {
    const oneSided = structuredClone(draft); oneSided.paragraphs[record.relationshipIndex].sourceUses.pop(); reject(oneSided);
  }
  const notMaterial = structuredClone(draft);
  notMaterial.sourceResolutions.relationships[0] = { relationshipIndex: 0, outcome: "not_material", statement: "Synthetic asserted scope exclusion for structural testing only.", paragraphIndex: null };
  assert.equal(validateGuidanceSourceResolutions(input, notMaterial).complete, true,
    "Scope exclusions require semantic review; structural validity does not prove them true.");
  notMaterial.sourceResolutions.relationships[0].paragraphIndex = 0; reject(notMaterial);
  const rawNotMaterial = structuredClone(raw);
  rawNotMaterial.sourceResolutions.relationships[0] = { relationshipIndex: 0, outcome: "not_material", statement: "Synthetic asserted scope exclusion requiring semantic review." };
  rawNotMaterial.paragraphs[0].parts = [{ kind: "text", text: "Synthetic direct answer.", relationshipIndex: null }];
  const renderedNotMaterial = materializeGuidanceSourceResolutions(input, rawNotMaterial);
  assert.equal(renderedNotMaterial.sourceResolutions.relationships[0].paragraphIndex, null);
  assert(!renderedNotMaterial.paragraphs.some(p => p.text.includes(rawNotMaterial.sourceResolutions.relationships[0].statement)));
  const verification = researchOfficialGuidanceSummaryRequest({ ...options, proposedAnswer: draft,
    verificationSchema: { type: "object", properties: { pass: { type: "boolean" } }, required: ["pass"] } });
  const vi = JSON.parse(verification.input);
  assert.deepEqual(vi.passages, input.passages);
  assert.deepEqual(vi.sourceResolutionPacket, packet);
  assert.deepEqual(vi.proposedAnswer, draft);
  assert.match(verification.instructions, /not evidence or proof of correctness/);
  assert.match(verification.instructions, /including earlier categorical claims/);
  assert.equal(request.max_output_tokens, 2200); assert.equal(verification.max_output_tokens, 1800);
  const unrelated = JSON.parse(researchOfficialGuidanceSummaryRequest({ ...options, question: "Where is the payment menu?" }).input);
  assert.equal(guidanceSourceResolutionPacket(unrelated), null);
  assert.equal(unrelated.sourceResolutionPacket, undefined);
  assert.equal(validateGuidanceSourceResolutions(unrelated, { paragraphs: [], missingFacts: [], evidenceLimitations: [] }), null);
  reject(draft, unrelated);
  relationshipCount += packet.relationships.length;
}
assert.equal(relationshipCount, 4);
console.log("Source-resolution draft contract passed: timing/completion, field-editability and conditional-actor findings must appear in the cited main text; missing, stale, one-sided and secondary-only findings are rejected. Scope and semantic truth still require the verifier. No API calls or answer-quality acceptance.");
