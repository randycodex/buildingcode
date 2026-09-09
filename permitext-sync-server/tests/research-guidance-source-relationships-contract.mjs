import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { guidanceSourceRelationships } from "../research-guidance-source-relationships.mjs";
import { researchOfficialGuidanceSummaryRequest } from "../research-official-guidance-summary.mjs";

const retained = JSON.parse(await readFile(new URL("../evals/results/research-owner-api-round2-live-source-span-2026-09-09.json", import.meta.url)));
const inputs = retained.providerCalls.filter((call) => call.phase === "permitext_official_guidance_summary")
  .map((call) => ({ id: call.caseID, input: JSON.parse(call.retainedRequestBody.input) }));
for (const { id, input } of inputs) {
  const before = structuredClone(input);
  const relationships = guidanceSourceRelationships(input);
  assert.equal(relationships.length, 1);
  assert.equal(relationships[0].kind, id === "DOBNOW-023" ? "conditional_stakeholder" : "creation_and_submission_timing");
  const evidence = relationships[0].evidence;
  const source = input.passages.find((passage) => passage.sourceID === evidence.sourceID && passage.claimID === evidence.claimID);
  assert.equal(evidence.contentHash, source.contentHash);
  assert(evidence.excerpts.every((excerpt) => source.text.replace(/\s+/g, " ").trim().includes(excerpt)));
  assert.deepEqual(input, before);
  assert.deepEqual(guidanceSourceRelationships({ ...input, question: "Where do I pay the record-management fee?" }), [],
    "Unrelated questions must not acquire an attestation or timing checklist.");
  assert.deepEqual(guidanceSourceRelationships({ ...input, passages: [] }), []);
  assert.deepEqual(guidanceSourceRelationships({ ...input, passages: input.passages.map((passage) => ({ ...passage, contentHash: "invalid" })) }), []);
  const changed = structuredClone(input);
  for (const passage of changed.passages) passage.text = passage.text.replace(/required Stakeholder/gi, "optional contact").replace(/before creating the subsequent filing/gi, "after the initial filing has been submitted");
  assert.deepEqual(guidanceSourceRelationships(changed), [], "A source update removing the detected relationship must remove the hint.");
  const sources = input.passages.map((passage) => ({
    id: passage.sourceID, title: passage.title, url: passage.url.split("#")[0],
    sourceValidation: passage.page === null ? "official_html" : "official_pdf", sourceContentHash: passage.contentHash,
    attributedClaims: [{ id: passage.claimID, contentHash: passage.contentHash, text: passage.text, verbatimText: passage.text,
      ...(passage.page ? { pageNumber: passage.page, sourceURL: passage.url } : {}), heading: passage.heading, intro: passage.intro }]
  }));
  for (const proposedAnswer of [undefined, { paragraphs: [{ text: "Offline candidate", sourceUses: [{ sourceID: source.sourceID, claimID: source.claimID }] }], missingFacts: [], evidenceLimitations: [] }]) {
    const request = researchOfficialGuidanceSummaryRequest({ question: input.question, webSupport: { sources }, model: "offline", userID: "offline",
      verificationSchema: { properties: { pass: { type: "boolean" } }, required: ["pass"] }, proposedAnswer });
    const packet = JSON.parse(request.input);
    assert.deepEqual(packet.sourceRelationships, relationships, "Both drafting and verification receive source-derived relationships.");
    assert.match(request.instructions, /Resolve each material relationship/);
    assert.equal(packet.passages.length, input.passages.length, "A relationship never replaces or trims its source evidence.");
  }
}

// The detector follows source wording and actor context, not a case ID or a
// hardcoded board name. It must never derive its facts from the user question.
const actorInput = structuredClone(inputs.find(({ id }) => id === "DOBNOW-023").input);
actorInput.question = "Which stakeholders must attest before the applicant submits?";
for (const passage of actorInput.passages) passage.text = passage.text.replaceAll("Board", "Association");
assert.equal(guidanceSourceRelationships(actorInput)[0].kind, "conditional_stakeholder");
assert.match(guidanceSourceRelationships(actorInput)[0].evidence.excerpts.join(" "), /Association/);
assert.equal(guidanceSourceRelationships({ ...actorInput, question: "Can the representative sign for the owner?" })[0].kind, "conditional_stakeholder");
assert.deepEqual(guidanceSourceRelationships({ question: actorInput.question + " When X is the Owner Type, Y is a required Stakeholder. Both must attest before filing.", passages: [] }), []);
console.log("Source-derived attestation and filing-timing relationships preserve fetched evidence, reach both model stages and disappear when source conditions or question scope change. No API calls or model-quality acceptance claimed.");
