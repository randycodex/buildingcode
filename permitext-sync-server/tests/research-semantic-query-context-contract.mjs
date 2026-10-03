import assert from "node:assert/strict";
import { researchEvidenceRetrievalQuery, researchEvidenceStrategyForTurn } from "../research-evidence-assembly.mjs";
import { projectFactProjection } from "../project-fact-projection.mjs";
import { activeResearchRetrievalFacts, semanticResearchProjectFacts } from "../research-retrieval-query-context.mjs";

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

const customFacts = projectFactProjection({ structuredFacts: [
  { key: "ramp-running-slope", label: "Ramp running slope", value: "1:9", status: "confirmed" },
  { key: "ramp-cross-slope", label: "Ramp cross slope", value: "1:30", status: "confirmed" },
  { key: "ramp-rise", label: "Ramp rise", value: "18 inches", status: "confirmed" },
  { key: "ramp-edge", label: "Ramp edge condition", value: "16-inch drop to grade", status: "confirmed" },
  { key: "primary-drain", label: "Primary drain run", value: "8 feet horizontal with half an inch fall", status: "confirmed" },
  { key: "secondary-drain", label: "Secondary drain run", value: "10 feet horizontal with 2 inches fall", status: "confirmed" },
  { key: "primary-drain-diameter", label: "Primary drain diameter", value: "4 inches", status: "confirmed" },
  { key: "kitchen-sinks", label: "Kitchen sink count", value: "3", status: "confirmed" },
  { key: "bathroom-sinks", label: "Bathroom sink count", value: "2", status: "confirmed" },
  { key: "building-unit-count", label: "Building dwelling unit count", value: "20", status: "confirmed" },
  { key: "system-unit-count", label: "System served dwelling unit count", value: "2", status: "confirmed" },
  { key: "qualified-floor", label: "Storage floor finish", value: "No carpet except in the enclosed office; the rest is unfinished", status: "confirmed" }
] }).researchFacts;
const customSnapshot = structuredClone(customFacts);
const activeCustom = (question, contextualTopics = []) => activeResearchRetrievalFacts({ question, contextualTopics, projectFacts: customFacts });
const dropped = (question, label, contextualTopics = []) => {
  const active = activeCustom(question, contextualTopics);
  assert(!active.some(fact => fact.startsWith(`Custom Fact — ${label}:`)), question);
  return active;
};
const runningCorrection = "Correction: the ramp running slope is 1:11. Does that change the ramp requirements?";
let active = dropped(runningCorrection, "Ramp running slope");
assert.equal(active.length, customFacts.length - 1);
assert(active.some(fact => /Ramp cross slope: 1:30/.test(fact)));
assert(active.some(fact => /Ramp rise: 18 inches/.test(fact)));
assert(active.some(fact => /No carpet except in the enclosed office; the rest is unfinished/.test(fact)),
  "An unrelated qualified and negative custom fact retains its entire wording.");
const runningQuery = researchEvidenceRetrievalQuery({ question: runningCorrection, projectFacts: customFacts });
assert.doesNotMatch(runningQuery.semanticQuery, /Ramp running slope: 1:9/);
assert.doesNotMatch(runningQuery.retrievalQuery, /Ramp running slope: 1:9/);
assert.match(runningQuery.question, /1:11/);
const runningFollow = researchEvidenceRetrievalQuery({ question: "What should we check next?", topicContext: {
  rootTopic: "What does the ramp need for this project?", currentTopic: runningCorrection
}, projectFacts: customFacts });
assert.doesNotMatch(runningFollow.semanticQuery, /Ramp running slope: 1:9/);
assert.doesNotMatch(runningFollow.retrievalQuery, /Ramp running slope: 1:9/);

active = dropped("Actually, the cross slope is 1:40, while the running slope is unchanged.", "Ramp cross slope", [
  { text: "For the ramp, what slopes apply?" }
]);
assert(active.some(fact => /Ramp running slope: 1:9/.test(fact)));
assert.equal(active.length, customFacts.length - 1);
active = dropped("Correction: the drop is only 4 inches, not 16 inches.", "Ramp edge condition", [
  { text: "Does the ramp edge need protection?" }
]);
assert.equal(active.length, customFacts.length - 1);
active = dropped("The primary drain now has three quarters of an inch fall over the eight feet.", "Primary drain run");
assert(active.some(fact => /Secondary drain run: 10 feet horizontal with 2 inches fall/.test(fact)));
assert(active.some(fact => /Primary drain diameter: 4 inches/.test(fact)));
assert.equal(active.length, customFacts.length - 1);
active = dropped("Actually, there are two kitchen sinks.", "Kitchen sink count");
assert(active.some(fact => /Bathroom sink count: 2/.test(fact)));
assert.equal(active.length, customFacts.length - 1);
assert.equal(dropped("Actually, there are no kitchen sinks.", "Kitchen sink count").length, customFacts.length - 1,
  "A clear negative count shadows the old positive count without rewriting the stored fact.");
assert.equal(dropped("The kitchen sink count is ninety.", "Kitchen sink count").length, customFacts.length - 1,
  "Quantity recognition is ordinary number wording, not a code-specific numeric rule.");
assert.equal(dropped("The ramp running slope will be 1:11.", "Ramp running slope").length, customFacts.length - 1,
  "A supplied future design condition shadows the old search premise without updating saved facts.");
active = dropped("Correction: the system now serves four dwelling units.", "System served dwelling unit count");
assert(active.some(fact => /Building dwelling unit count: 20/.test(fact)),
  "A system count is distinct from a building count even though both have a use facet.");
assert.equal(active.length, customFacts.length - 1);
active = dropped("Correction: the ramp running slope is not 1:9.", "Ramp running slope");
assert.equal(active.length, customFacts.length - 1, "A negative correction does not invent a replacement value.");
active = dropped("Correction: the ramp running slope is not yet confirmed.", "Ramp running slope");
assert.equal(active.length, customFacts.length - 1, "Uncertainty must not leave the saved categorical value active.");
for (const question of [
  "Actually, make it 2.", "Correction: the slope is 1:11.", "Correction: the count is 4.",
  "Correction: is the ramp running slope 1:11 permitted?", "The code requires the ramp running slope to be 1:11.",
  "Under the code, is the ramp running slope 1:11 permitted?",
  "The ramp running slope is important. What should I check?", "The ramp running slope is unchanged.",
  "Actually, the secondary drain diameter is 3 inches."
]) assert.deepEqual(activeCustom(question), customFacts, `Do not guess a missing subject or turn a rule/question into a supplied fact: ${question}`);

const rampHypothetical = "Suppose the ramp running slope is approximately 1:11, only on the lower portion.";
active = dropped("Would that need a different detail?", "Ramp running slope", [{ text: rampHypothetical }]);
assert(active.some(fact => /Ramp cross slope: 1:30/.test(fact)));
const hypotheticalCustomQuery = researchEvidenceRetrievalQuery({ question: rampHypothetical, projectFacts: customFacts });
assert.equal(hypotheticalCustomQuery.question, rampHypothetical, "Scenario qualifiers remain user wording, not categorical replacement facts.");
assert.doesNotMatch(hypotheticalCustomQuery.semanticQuery, /Ramp running slope: 1:9/);
assert.doesNotMatch(hypotheticalCustomQuery.retrievalQuery, /Ramp running slope: 1:9/);
assert.deepEqual(activeCustom("Back to our actual project: would the saved ramp slope need a different detail?", [
  { text: rampHypothetical }, { text: "Actually, the running slope is 1:14." }
]), customFacts, "An explicit actual-project return restores saved facts even when the follow-up uses 'would'.");
active = dropped("Back to the actual project: the ramp running slope is 1:13.", "Ramp running slope", [{ text: rampHypothetical }]);
assert.equal(active.length, customFacts.length - 1, "A new explicit actual correction still shadows its own saved value after a return.");
assert.deepEqual(customFacts, customSnapshot, "Shadowing must never update persisted facts or turn a hypothetical into an actual fact.");
const scopedCustomFacts = [
  "Custom Fact — Upper ramp running slope: 1:9 (user-confirmed).",
  "Custom Fact — Lower ramp running slope: 1:8 (user-confirmed).",
  "Custom Fact — Ramp cross slope: Approximately 1:30 only on the lower portion (user-confirmed; preserve the stated scope and uncertainty)."
];
assert.deepEqual(activeResearchRetrievalFacts({ question: "Correction: the upper ramp cross slope is 1:40.", projectFacts: scopedCustomFacts }), scopedCustomFacts,
  "A current measurement of another portion does not contradict a saved condition qualified to the lower portion.");
assert.deepEqual(activeResearchRetrievalFacts({ question: "Correction: the lower ramp running slope is 1:11.", projectFacts: scopedCustomFacts }),
  [scopedCustomFacts[0], scopedCustomFacts[2]], "Upper and lower ramp labels remain different fields.");

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
console.log("Semantic-query context passed: bounded relevant facts, labeled custom corrections/counts, separate field subjects, qualifiers, active hypotheses and actual resets, inventory scope, generic-title subject recovery, explicit topic/family/edition precedence and no prior answer reuse; no API calls.");
