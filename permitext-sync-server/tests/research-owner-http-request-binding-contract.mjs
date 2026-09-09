import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ownerHTTPResearchRequestHash } from "../evals/research-owner-http-request-binding.mjs";
import { researchOfficialGuidanceSummaryRequest } from "../research-official-guidance-summary.mjs";
const makeBody = (id, section = "20018521", text = "Canonical selected text.") => {
  const context = { sourceID: id, sectionID: section, text };
  return { model: "gpt-5.6-luna", safety_identifier: id, instructions: "Bind the claim.",
    input: `PASSAGE_ID: ${id}\nSECTION_ID: ${section}\nENACTED_TEXT: ${text}\nDETERMINISTIC_CONTEXT: ${JSON.stringify({ ...context, contextHash: createHash("sha256").update(JSON.stringify(context)).digest("hex") })}\nREQUIRED_CLAIM_SOURCE: ${id}`,
    text: { format: { name: "permitext_code_interpretation", sourceIDs: [id] } }, max_output_tokens: 1800, service_tier: "default" };
};
const first = "11111111-1111-4111-8111-111111111111", second = "22222222-2222-4222-8222-222222222222";
const a = makeBody(first), b = makeBody(second), expected = ownerHTTPResearchRequestHash(a);
assert.equal(ownerHTTPResearchRequestHash(b), expected);
assert.notEqual(ownerHTTPResearchRequestHash(makeBody(second, "20018102")), expected);
assert.notEqual(ownerHTTPResearchRequestHash(makeBody(second, "20018521", "Changed enacted text.")), expected);
for (const mutation of [
  { ...b, instructions: "Different instructions" }, { ...b, model: "gpt-5.6-terra" },
  { ...b, max_output_tokens: 3000 }, { ...b, service_tier: "fast" },
  { ...b, input: b.input.replace(`REQUIRED_CLAIM_SOURCE: ${second}`, `REQUIRED_CLAIM_SOURCE: ${first}`) }
]) assert.notEqual(ownerHTTPResearchRequestHash(mutation), expected);
assert.throws(() => ownerHTTPResearchRequestHash({ ...b, input: b.input.replace(/"contextHash":"[a-f0-9]+"/, '"contextHash":"invalid"') }), /Invalid deterministic context hash/);
assert.throws(() => ownerHTTPResearchRequestHash({ ...b, input: `${b.input}\nPASSAGE_ID: ${second}\nSECTION_ID: 20018102\n` }), /Repeated random passage/);
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const withLegend = (id, symbol = "P", meaning = "Additional conditions", invalidID = false) => {
  const body = makeBody(id);
  const context = { answerObligations: [{
    id: invalidID ? "table_legend_invalid" : `table_legend_${digest(`${id}:${symbol}:${meaning}`).slice(0, 12)}`,
    kind: "table_legend", sourceIDs: [id], values: [symbol, meaning], requireAllValues: true
  }] };
  body.input = body.input.replace(/^DETERMINISTIC_CONTEXT: .+$/m,
    `DETERMINISTIC_CONTEXT: ${JSON.stringify({ ...context, contextHash: digest(context) })}`);
  return body;
};
const legendHash = ownerHTTPResearchRequestHash(withLegend(first));
assert.equal(ownerHTTPResearchRequestHash(withLegend(second)), legendHash);
assert.notEqual(ownerHTTPResearchRequestHash(withLegend(second, "S")), legendHash);
assert.notEqual(ownerHTTPResearchRequestHash(withLegend(second, "P", "Permitted")), legendHash);
assert.throws(() => ownerHTTPResearchRequestHash(withLegend(second, "P", "Additional conditions", true)), /Invalid table legend/);
const guidance = (claimID, contentHash) => researchOfficialGuidanceSummaryRequest({
  question: "Which filing completes through the CO process?", userID: first, model: "test-model",
  webSupport: { sources: [{ id: "faq", url: "https://www.nyc.gov/faq", title: "FAQ", sourceValidation: "official_html",
    sourceContentHash: contentHash, attributedClaims: [{ id: claimID, contentHash,
      text: "Subsequent CO filings remain Permit Entire.", heading: "Subsequent CO filings", intro: "May I request a separate LOC?" }] }] }
});
const htmlA = guidance("claim-a", "a".repeat(64)), htmlB = guidance("claim-b", "b".repeat(64));
const htmlHash = (body) => ownerHTTPResearchRequestHash(body, { normalizeOfficialHTML: true });
assert.notEqual(ownerHTTPResearchRequestHash(htmlA), ownerHTTPResearchRequestHash(htmlB), "Legacy package comparisons retain their original hash behavior.");
assert.equal(htmlHash(htmlA), htmlHash(htmlB), "Opaque IDs can differ while every model-visible passage and its schema association stays the same.");
for (const field of ["sourceID", "url", "title", "text", "heading", "intro", "extractionLimitations"]) {
  const changed = structuredClone(htmlB), input = JSON.parse(changed.input);
  input.passages[0][field] = field === "extractionLimitations" ? ["A source limitation changed."] : `Changed ${field}`;
  if (field === "url") input.passages[0][field] = "https://www.nyc.gov/other";
  changed.input = JSON.stringify(input);
  assert.notEqual(htmlHash(changed), htmlHash(htmlA), field);
}
for (const patch of [{ instructions: "Changed instructions" }, { model: "other-model" }, { max_output_tokens: 1000 }, { service_tier: "priority" }]) {
  assert.notEqual(htmlHash({ ...htmlB, ...patch }), htmlHash(htmlA));
}
const mismatchedSchema = structuredClone(htmlB);
mismatchedSchema.text.format.schema.properties.paragraphs.items.properties.sourceUses.items.properties.claimID.enum = ["wrong-claim"];
assert.throws(() => htmlHash(mismatchedSchema), /schema must bind/);
const missingPassage = structuredClone(htmlB); missingPassage.input = JSON.stringify({ ...JSON.parse(htmlB.input), passages: [] });
assert.throws(() => htmlHash(missingPassage), /schema must bind/);
const pdfBody = (body) => {
  const next = structuredClone(body), input = JSON.parse(next.input);
  input.passages[0].page = 1; input.passages[0].url = "https://www.nyc.gov/notice.pdf#page=1";
  next.input = JSON.stringify(input); return next;
};
assert.notEqual(htmlHash(pdfBody(htmlA)), htmlHash(pdfBody(htmlB)), "PDF hashes and passage IDs remain strict under the HTML-only comparison.");
const withRelationship = (body) => {
  const next = structuredClone(body), input = JSON.parse(next.input), passage = input.passages[0];
  input.sourceRelationships = [{ kind: "scope", questionToResolve: "Check the completion scope.", evidence: {
    sourceID: passage.sourceID, claimID: passage.claimID, contentHash: passage.contentHash, excerpts: [passage.text]
  } }];
  next.input = JSON.stringify(input); return next;
};
assert.equal(htmlHash(withRelationship(htmlA)), htmlHash(withRelationship(htmlB)), "Opaque HTML IDs normalize consistently in source relationship evidence.");
for (const mutate of [
  (input) => { input.sourceRelationships[0].evidence.claimID = "invented"; },
  (input) => { input.sourceRelationships[0].evidence.contentHash = "c".repeat(64); },
  (input) => { input.sourceRelationships[0].evidence.excerpts = ["Invented permission."]; }
]) {
  const body = withRelationship(htmlA), input = JSON.parse(body.input); mutate(input); body.input = JSON.stringify(input);
  assert.throws(() => htmlHash(body));
}
const changedRelationship = withRelationship(htmlA), changedInput = JSON.parse(changedRelationship.input);
changedInput.sourceRelationships[0].questionToResolve = "A different applicability question.";
changedRelationship.input = JSON.stringify(changedInput);
assert.notEqual(htmlHash(changedRelationship), htmlHash(withRelationship(htmlA)), "Diagnostic normalization must retain the actual relationship question.");
const withRelatedEvidence = (body) => {
  const next = withRelationship(body), input = JSON.parse(next.input);
  const related = { ...input.passages[0], sourceID: "specialized", claimID: `${input.passages[0].claimID}-specialized`,
    url: "https://www.nyc.gov/specialized", text: "A specialized completion condition applies." };
  input.passages.push(related);
  input.sourceRelationships[0].relatedEvidence = [{ sourceID: related.sourceID, claimID: related.claimID,
    contentHash: related.contentHash, excerpts: [related.text] }];
  next.text.format.schema.properties.paragraphs.items.properties.sourceUses.items.properties.claimID.enum.push(related.claimID);
  next.text.format.schema.properties.paragraphs.items.properties.sourceUses.items.properties.sourceID.enum.push(related.sourceID);
  next.input = JSON.stringify(input); return next;
};
assert.equal(htmlHash(withRelatedEvidence(htmlA)), htmlHash(withRelatedEvidence(htmlB)),
  "Cross-source relationships normalize both HTML evidence bindings while preserving their content.");
for (const mutate of [
  (input) => { input.sourceRelationships[0].relatedEvidence[0].sourceID = "wrong-source"; },
  (input) => { input.sourceRelationships[0].relatedEvidence[0].contentHash = "c".repeat(64); },
  (input) => { input.sourceRelationships[0].relatedEvidence[0].excerpts = ["An invented exception."]; },
  (input) => { input.sourceRelationships[0].relatedEvidence = {}; }
]) {
  const body = withRelatedEvidence(htmlA), input = JSON.parse(body.input); mutate(input); body.input = JSON.stringify(input);
  assert.throws(() => htmlHash(body));
}
const resolutionRequest = (claimID, contentHash, question = "Can the applicant submit before the owner and board attest?") => researchOfficialGuidanceSummaryRequest({
  question, userID: first, model: "test-model",
  webSupport: { sources: [{ id: "roles", url: "https://www.nyc.gov/roles", title: "Stakeholder conditions", sourceValidation: "official_html",
    sourceContentHash: contentHash, attributedClaims: [{ id: claimID, contentHash,
      text: "When Board is the Owner Type, the Board representative is a required Stakeholder. Both owner and Board must complete attestations before filing." }] }] }
});
const resolutionA = resolutionRequest("resolution-a", "a".repeat(64)), resolutionB = resolutionRequest("resolution-b", "b".repeat(64));
const beforeResolution = structuredClone(resolutionA);
assert(JSON.parse(resolutionA.input).sourceResolutionPacket);
assert.equal(htmlHash(resolutionA), htmlHash(resolutionB), "Derived resolution hashes and required citations normalize only after checking the complete original packet.");
assert.deepEqual(resolutionA, beforeResolution, "Diagnostic normalization must not mutate outgoing requests.");
assert.notEqual(htmlHash(resolutionRequest("resolution-b", "b".repeat(64), "Can the applicant submit before the owner and board attest? The owner type changed.")), htmlHash(resolutionA));
for (const mutate of [
  (input) => { input.sourceResolutionPacket.packetSHA256 = "c".repeat(64); },
  (input) => { input.sourceResolutionPacket.relationships[0].requiredSourceUses[0].claimID = "invented"; },
  (input) => { input.sourceResolutionPacket.relationships = []; },
  (input) => { input.passages[0].text += " An additional exception."; },
  (input) => { input.question += " A different supplied fact."; }
]) {
  const changed = structuredClone(resolutionA), input = JSON.parse(changed.input); mutate(input); changed.input = JSON.stringify(input);
  assert.throws(() => htmlHash(changed), /Invalid source resolution packet/);
}
const badResolutionSchema = structuredClone(resolutionA);
badResolutionSchema.text.format.schema.properties.sourceResolutions.properties.packetSHA256.enum = ["invented"];
assert.throws(() => htmlHash(badResolutionSchema), /schema must bind/);
const changedOutcomeSchema = structuredClone(resolutionA);
changedOutcomeSchema.text.format.schema.properties.sourceResolutions.properties.relationships.items.properties.outcome.enum = ["resolved"];
assert.notEqual(htmlHash(changedOutcomeSchema), htmlHash(resolutionA), "Normalization must preserve the resolution schema's actual constraints.");
console.log("Owner HTTP request binding passed: isolated account/passage IDs and validated derived resolution hashes normalize; full source text, resolution/citation/schema bindings, instructions, model, tier and ceilings remain bound.");
