import assert from "node:assert/strict";
import { researchEvidenceRetrievalQuery, researchEvidenceStrategyForTurn } from "../research-evidence-assembly.mjs";
import { projectFactProjection } from "../project-fact-projection.mjs";
import { semanticResearchProjectFacts } from "../research-retrieval-query-context.mjs";

globalThis.fetch = () => { throw new Error("Network/provider calls forbidden in semantic-query context contract."); };
const facts = projectFactProjection({ structuredFacts: [
  { key: "zoning-districts", label: "Zoning District(s)", value: "C6-1", status: "confirmed" },
  { key: "proposed-uses", label: "Proposed uses", value: "Mixed-use residences with commercial space on the same zoning lot", status: "confirmed" },
  { key: "work-filing-type", label: "Work / Filing Type", value: "New building", status: "confirmed" },
  { key: "special-purpose-district", label: "Special Purpose District", value: "None mapped", status: "sourced" },
  { key: "sprinkler-protection", label: "Sprinkler Protection", value: "No sprinkler protection in the proposed storage building", status: "confirmed" },
  { key: "lot-width", label: "Lot Width", value: "55 feet", source: "nyc-planning", status: "sourced" },
  { key: "building-area", label: "Building Area", value: "14000 square feet", source: "nyc-planning", status: "sourced" },
  { key: "stories-above-grade", label: "Stories Above Grade", value: "1", source: "nyc-planning", status: "sourced" },
  { key: "residential-units", label: "Residential Units", value: "0", source: "nyc-planning", status: "sourced" },
  { key: "code-basis", label: "Code Basis", value: "2014 NYC Building Code", status: "confirmed" },
  { key: "construction-type", label: "Construction Type", value: "Unknown", status: "unknown" },
  { key: "occupancy", label: "Occupancy", value: "Old warehouse", status: "rejected" }
] }).researchFacts;
const snapshot = structuredClone(facts);
const yardQuestion = "For this project, which side-yard framework applies to the new building?";
const yard = researchEvidenceRetrievalQuery({ question: yardQuestion, projectFacts: facts });
assert(yard.semanticQuery.startsWith(yardQuestion));
assert.match(yard.semanticQuery, /Mixed-use residences with commercial space on the same zoning lot/);
assert.match(yard.semanticQuery, /C6-1/);
assert.match(yard.semanticQuery, /user-confirmed/);
assert.doesNotMatch(yard.semanticQuery, /Residential Units: 0|Building Area: 14000|Stories Above Grade: 1/,
  "Existing property inventory must not describe the replacement building in search.");
assert.doesNotMatch(yard.retrievalQuery, /Residential Units: 0|Building Area: 14000|Stories Above Grade: 1/);
assert.doesNotMatch(yard.semanticQuery, /Old warehouse|Unknown|2014/);
assert.match(yard.semanticQuery, /supplied facts, not applicability/);

const storage = researchEvidenceRetrievalQuery({ question: "For the proposed storage building, what sprinkler-dependent fire clearance applies?", projectFacts: facts });
assert.match(storage.semanticQuery, /No sprinkler protection in the proposed storage building/,
  "Negative facts are retained as negative supplied wording, never strengthened.");
assert.doesNotMatch(storage.semanticQuery, /C6-1|Residential Units: 0/,
  "A different technical topic does not carry unrelated zoning or inventory fields.");
const lot = semanticResearchProjectFacts({ question: "What lot-width rule applies in this zoning district?", projectFacts: facts });
assert.match(lot, /mapped tax-lot record; zoning-lot composition and street-frontage applicability are not established/,
  "Mapped dimensions retain the boundary against inferred zoning-lot or frontage applicability.");
const existing = researchEvidenceRetrievalQuery({ question: "For the existing property building area, what existing inventory is available?", projectFacts: facts });
assert.match(existing.semanticQuery, /existing-property record; does not describe the proposed building or work/);

const corrected = researchEvidenceRetrievalQuery({ question: "Correction: this project is solely a commercial office, not residential. What side-yard framework applies?", previousTopic: yardQuestion, projectFacts: facts });
assert.doesNotMatch(corrected.semanticQuery, /Mixed-use residences/);
assert.doesNotMatch(corrected.retrievalQuery, /Mixed-use residences/);
assert.match(corrected.question, /not residential/);
const correctedFollow = researchEvidenceRetrievalQuery({ question: "What should we check next?", topicContext: {
  rootTopic: yardQuestion, currentTopic: "Correction: this project is solely a commercial office, not residential."
}, projectFacts: facts });
assert.doesNotMatch(correctedFollow.semanticQuery, /Mixed-use residences/);
assert.match(correctedFollow.semanticQuery, /commercial office, not residential/,
  "A dependent follow-up keeps the current correction, rather than restoring a saved use fact.");
const hypothetical = researchEvidenceRetrievalQuery({ question: "What if the storage building instead has sprinkler protection throughout?", projectFacts: facts });
assert.doesNotMatch(hypothetical.semanticQuery, /No sprinkler protection/);
assert.doesNotMatch(hypothetical.retrievalQuery, /No sprinkler protection/);
assert.match(hypothetical.question, /What if/);
const hypotheticalFollow = researchEvidenceRetrievalQuery({ question: "Would that change the fire clearance?", topicContext: {
  rootTopic: "What fire clearance applies to this project?", currentTopic: hypothetical.question
}, projectFacts: facts });
assert.doesNotMatch(hypotheticalFollow.semanticQuery, /No sprinkler protection/);
const excluded = researchEvidenceRetrievalQuery({ question: "What egress rule applies? This is not a residential building, school, or warehouse.", projectFacts: facts });
assert.doesNotMatch(excluded.semanticQuery, /Mixed-use residences|school|warehouse/);
assert.match(excluded.question, /not a residential building, school, or warehouse/);
const positiveCorrection = researchEvidenceRetrievalQuery({ question: "What egress rule applies? It's not a school but an office.", projectFacts: facts });
assert.match(positiveCorrection.semanticQuery, /office/);
assert.doesNotMatch(positiveCorrection.semanticQuery, /school|Mixed-use residences/);
const semicolonCorrection = "Correction: it is not mixed-use; it is entirely commercial. Which yard rule applies?";
const semicolonQuery = researchEvidenceRetrievalQuery({ question: semicolonCorrection });
assert.match(semicolonQuery.semanticQuery, /it is entirely commercial/,
  "A semicolon ends an excluded clause; the following affirmative correction remains search context.");
assert.doesNotMatch(semicolonQuery.semanticQuery, /mixed-use/);
assert.equal(semicolonQuery.question, semicolonCorrection);
const sentenceCorrection = "It is not a residential building. It is a warehouse. What exits are needed?";
const sentenceQuery = researchEvidenceRetrievalQuery({ question: sentenceCorrection });
assert.match(sentenceQuery.semanticQuery, /It is a warehouse/);
assert.doesNotMatch(sentenceQuery.semanticQuery, /residential building/);
assert.equal(sentenceQuery.question, sentenceCorrection);
assert.match(researchEvidenceRetrievalQuery({ question: "Is this not required for a storage room?" }).semanticQuery, /not required/);
const originalQualified = semanticResearchProjectFacts({ question: "What fire clearance applies to the storage room?", projectFacts: [
  "Building / Code Fact — Sprinkler Protection: Fully sprinklered (user-stated; not independently verified). Original user/source wording: Only the storage room has sprinklers; the remainder is not sprinklered."
] });
assert.match(originalQualified, /Only the storage room has sprinklers; the remainder is not sprinklered/);
assert.doesNotMatch(originalQualified, /Fully sprinklered/,
  "Qualified original wording overrides an old unconditional extracted value.");
assert.equal(semanticResearchProjectFacts({ question: "What fire-rating rule applies?", projectFacts: [
  "Unknown: Building / Code Fact — Construction Type: TBD (unknown; not established)."
] }), "", "A declared unknown must not nominate an established technical condition.");

const general = researchEvidenceRetrievalQuery({ question: "For a hypothetical storage room, explain the fire clearance. This is a general rule question; ignore saved project facts.", projectFacts: facts });
assert.doesNotMatch(general.semanticQuery, /Project search context/);
assert.equal(general.projectFactsApplied, false);
const application = researchEvidenceRetrievalQuery({ question: "Now apply that to our project. Which zoning side-yard framework applies?", previousTopic:
  "For a hypothetical commercial-only office in C1-2, explain the side-yard framework. This is a general rule question.", projectFacts: facts });
assert.match(application.semanticQuery, /Mixed-use residences|C6-1/,
  "An explicit return to actual project application restores saved facts instead of extending the old hypothetical premise.");
assert.doesNotMatch(application.semanticQuery, /commercial-only office|C1-2/);
const explicitEdition = researchEvidenceRetrievalQuery({ question: "Under the 2022 NYC Building Code, what egress rule applies to this office?", projectFacts: facts });
assert.doesNotMatch(explicitEdition.semanticQuery, /2014/);
assert.doesNotMatch(explicitEdition.retrievalQuery, /2014 NYC Building Code/);

const citation = { sourceID: "checked-fixture", sectionID: "fixture-rule", codePrefix: "MC", sectionNumber: "999.1",
  title: "MC999.1: General Requirements", codeEdition: "2014 NYC Mechanical Code", codeVersion: "fixture-mc-2014",
  corpusID: "fixture-2014", supportingPassages: [{ selectedText: "An obsolete answer number is 48 inches and an irrelevant conclusion is permitted." }] };
const root = "Under the 2014 NYC Mechanical Code, may an industrial air compressor be held by a restraint attached to a plumbing pipe?";
const messages = [{ role: "user", question: root }, { role: "assistant", answer: {
  mode: "answer", answerText: "It is permitted if 48 inches wide.", verification: { pass: true },
  supportedPoints: [{ sectionID: citation.sectionID, sourceIDs: [citation.sourceID] }], citations: [citation]
} }];
const followQuestion = "If the restraint instead attaches to a fixed structural bracket designed for this purpose, does that meet the securing-method requirement?";
const follow = researchEvidenceRetrievalQuery({ question: followQuestion, previousMessages: messages });
assert(follow.semanticQuery.startsWith(followQuestion));
assert.match(follow.semanticQuery, /industrial air compressor/,
  "A detailed follow-up retains its user-supplied subject when its checked title is generic.");
assert.doesNotMatch(follow.semanticQuery, /General Requirements|48 inches|irrelevant conclusion|permitted if|999\.1|2014/,
  "Prior operative text, conclusions, measurements and citations are not copied into semantic search.");
assert.equal(follow.inheritedAuthorityReferences[0]?.sectionNumber, "999.1");
const detailedTitle = structuredClone(messages);
detailedTitle.at(-1).answer.citations[0].title = "999.1 Industrial air compressors";
assert.match(researchEvidenceRetrievalQuery({ question: followQuestion, previousMessages: detailedTitle }).semanticQuery,
  /Subject context: Industrial air compressors/);
for (const question of ["New topic: what is the plumbing vent arrangement?", "Under PC 888.1, how is the vent arrangement measured?", "Actually, under the Plumbing Code, how should this fixture be vented?"]) {
  const switched = researchEvidenceRetrievalQuery({ question, previousMessages: messages });
  assert.doesNotMatch(switched.semanticQuery, /industrial air compressor|General Requirements|Mechanical Code|2014/, question);
}
const changedEdition = researchEvidenceRetrievalQuery({ question: "Do the same check under the 2022 NYC Mechanical Code instead. What restraint arrangement is permitted?", previousMessages: detailedTitle });
assert.match(changedEdition.semanticQuery, /2022 NYC Mechanical Code/);
assert.doesNotMatch(changedEdition.semanticQuery, /2014|999\.1/);
assert.deepEqual(changedEdition.inheritedAuthorityReferences, [],
  "A same-topic edition change must not retain the historical authority hint.");
assert.doesNotMatch(changedEdition.sourceQuery, /Previously discussed provisions/);
const sameEdition = researchEvidenceRetrievalQuery({ question: "Under the 2014 NYC Mechanical Code, would that fixed bracket meet the same securing requirement?", previousMessages: detailedTitle });
assert.equal(sameEdition.inheritedAuthorityReferences[0]?.sectionNumber, "999.1");
const familyChange = researchEvidenceRetrievalQuery({ question: "Actually under the Plumbing Code, would that fixed bracket meet the same securing requirement?", previousMessages: detailedTitle });
assert.deepEqual(familyChange.inheritedAuthorityReferences, [],
  "A correction that names another family overrides the preceding family's hint even when the topic resolver retains continuity.");
const currentReference = researchEvidenceRetrievalQuery({ question: "Under the 2022 NYC Mechanical Code, explain MC 888.1 instead.", previousMessages: detailedTitle });
assert.match(currentReference.sourceQuery, /MC 888\.1/);
assert.deepEqual(currentReference.inheritedAuthorityReferences, []);
const oldSubject = [{ role: "user", question: "Can this school ventilation use that arrangement?" }, {
  role: "assistant", answer: { verification: { pass: true }, citations: [{ ...citation, title: "School ventilation" }] }
}];
const correctedTopic = researchEvidenceRetrievalQuery({ question: "What should we check next?", previousMessages: oldSubject,
  topicContext: { rootTopic: oldSubject[0].question, currentTopic: "Correction: it's not a school but an office." } });
assert.match(correctedTopic.semanticQuery, /office/);
assert.doesNotMatch(correctedTopic.semanticQuery, /school/);

const long = "x".repeat(1999);
const bounded = researchEvidenceRetrievalQuery({ question: long, previousMessages: messages, projectFacts: facts });
assert.equal(bounded.semanticQuery, long, "Context cannot displace any part of the maximum-length current question.");
for (const result of [yard, storage, existing, corrected, hypothetical, hypotheticalFollow, follow, bounded]) {
  assert(result.semanticQuery.length <= 2000 && result.retrievalQuery.length <= 2000);
  assert.equal(result.question, result.question.trim());
}
const unsplittable = ["Custom Fact — Sprinkler Protection: No sprinkler protection, except " + "a scoped exception ".repeat(100)];
assert.equal(semanticResearchProjectFacts({ question: "What fire clearance applies?", projectFacts: unsplittable, maximumCharacters: 200 }), "",
  "An oversized qualified fact is omitted whole, not clipped before its exception.");
const selectedQuestion = "Using only the selected passage, explain this egress rule.";
assert.equal(researchEvidenceStrategyForTurn({ question: selectedQuestion, pinnedEvidence: [{ codePrefix: "BC", sectionNumber: "999.1" }] }).reason,
  "question_explicitly_bounded_to_selected_evidence");
assert.deepEqual(facts, snapshot, "Query projection must not change stored facts.");
console.log("Semantic-query context passed: bounded relevant facts, qualifiers, active corrections/hypotheticals, inventory scope, generic-title subject recovery, explicit topic/family/edition precedence and no prior answer reuse; no API calls.");
