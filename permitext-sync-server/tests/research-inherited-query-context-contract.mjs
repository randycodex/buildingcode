import assert from "node:assert/strict";
import { assembleResearchEvidence, researchEvidenceRetrievalQuery } from "../research-evidence-assembly.mjs";

globalThis.fetch = () => { throw new Error("Network/provider calls forbidden in inherited-context contract."); };
const citation = { sourceID: "cited-source", sectionID: "old-section", codePrefix: "BC", sectionNumber: "1010.2",
  title: "Slope", codeEdition: "2014", codeVersion: "2014-v1", corpusID: "bc-2014",
  applicabilityStatus: "prior-edition-case-specific", supportingPassages: [{ selectedText: "Slope is limited." }] };
const answer = { mode: "answer", supportedPoints: [{ sectionID: citation.sectionID, sourceIDs: [citation.sourceID] }],
  verification: { pass: true }, citations: [citation] };
const messages = [{ role: "user", question: "Explain the 2014 Building Code pedestrian ramp slope rule." },
  { role: "assistant", answer }];
const followup = researchEvidenceRetrievalQuery({ question: "What about the landing?", previousMessages: messages });
assert.equal(followup.inheritedAuthorityReferences.length, 1);
assert.equal(followup.inheritedAuthorityReferences[0].codeVersion, "2014-v1");
assert.equal(followup.inheritedAuthorityReferences[0].corpusID, "bc-2014");
assert.match(followup.sourceQuery, /Previously discussed provisions: BC § 1010\.2/);
assert.doesNotMatch(followup.semanticQuery, /Previously discussed provisions|BC § 1010\.2/,
  "An inherited reference is an authority hint, not a replacement for the new semantic detail.");
assert.equal(followup.question, "What about the landing?");
let received;
await assembleResearchEvidence({ question: followup.question, previousMessages: messages,
  discover: async request => { received = request; return { candidates: [] }; }, resolveSection: async () => null });
assert.equal(received.retrievalContext.currentQuestion, followup.question);
assert.deepEqual(received.retrievalContext.inheritedAuthorityReferences, followup.inheritedAuthorityReferences);
assert.match(received.retrievalContext.sourceQuery, /Previously discussed provisions/);
for (const question of ["New topic: explain the fuel gas pressure test.", "Explain PC 604.4 instead.", "What does ZR 36-53 require?"]) {
  const query = researchEvidenceRetrievalQuery({ question, previousMessages: messages });
  assert.deepEqual(query.inheritedAuthorityReferences, [], question);
  assert.doesNotMatch(query.sourceQuery, /Previously discussed provisions/);
}
for (const change of [
  { authorityStatus: "evidence_boundary" }, { mode: "clarification" },
  { supportedPoints: [] }, { verification: { pass: false } },
  { citations: [{ ...citation, evidenceRole: "contextual" }] }
]) {
  const previousMessages = [messages[0], { role: "assistant", answer: { ...answer, ...change } }];
  const query = researchEvidenceRetrievalQuery({ question: followup.question, previousMessages });
  assert.deepEqual(query.inheritedAuthorityReferences, [], JSON.stringify(change));
  assert.doesNotMatch(query.sourceQuery, /Previously discussed provisions/);
  assert.match(query.sourceQuery, /pedestrian ramp/,
    "A blocked or bounded answer does not erase the user's subject, even though it supplies no authority hint.");
}
console.log("Inherited query context passed: separate current question/authority hints, prior edition identity, explicit switches, and blocked/contextual answer boundaries; no API calls.");
