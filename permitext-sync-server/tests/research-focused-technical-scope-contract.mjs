import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { focusedTechnicalResearchScope, focusedTechnicalCandidates } from "../research-focused-technical-scope.mjs";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import { prioritizeResearchEvidence } from "../research-evidence-priority.mjs";
import { researchWebSupportTrigger } from "../research-source-policy.mjs";

globalThis.fetch = async () => { throw new Error("Network forbidden in focused technical checks."); };
process.env.PERMITEXT_EVIDENCE_DISCOVERY_BETA = "1";
const { assembledResearchEvidenceForTurn } = await import("../app.mjs");
const baseline = JSON.parse(await readFile(new URL("../evals/results/research-owner-full-scope-ventilation-2026-09-08.json", import.meta.url))).results;
const hash = (text) => createHash("sha256").update(text).digest("hex");
const ref = (source) => `${source.codePrefix} ${source.sectionNumber}`;
const results = [];
for (const id of ["MC-09", "MC-13", "MC-15", "GAP-03", "GAP-08"]) {
  const before = baseline.find((item) => item.id === id);
  const question = before.question;
  const scope = focusedTechnicalResearchScope(question);
  assert(scope, id);
  const actual = await assembledResearchEvidenceForTurn({ question, messages: [], projectFacts: [], pinnedEvidence: [] });
  for (const [number] of scope.anchors) {
    const reference = `${scope.codePrefix} ${number}`;
    const source = actual.sources.find((item) => ref(item) === reference);
    assert(source?.canonicalContextComplete && !source.truncated, reference);
    assert.equal(hash(source.text), before.sources.find((item) => item.reference === reference).textSHA256,
      "The full governing text, including exceptions, must remain byte-identical.");
  }
  assert(actual.usage.nonMaterialCandidateCount > 0, id);
  assert(actual.usage.characterCount < before.usage.characterCount, id);
  assert.equal(actual.limits.maximumCharacters, 48000);
  if (id === "MC-09") {
    assert(actual.sources.some((item) => ref(item) === "BC 403.7"), "Preserve the high-rise intake companion rule.");
    assert.match(actual.sources.find((item) => ref(item) === "MC 501.3.1").text, /re-entrainment[\s\S]*10%/);
    assert.match(actual.sources.find((item) => ref(item) === "MC 401.4").text, /Group R-3/);
  }
  if (id === "MC-13") {
    assert.match(actual.sources.find((item) => ref(item) === "MC 507.2").text, /approved testing agency[\s\S]*UL 710B/);
    assert.match(actual.sources.find((item) => ref(item) === "MC 507.1").text, /integral down-draft/);
  }
  if (id === "MC-15") assert(actual.sources.some((item) => ref(item) === "MC 401.4"),
    "Normal canonical cross-reference expansion remains active.");

  // The web shortcut requires complete current enacted authority, and only
  // affects implicit discovery/workflow suggestions for these narrow questions.
  if (scope.enactedScopeSufficient) {
    const environment = { PERMITEXT_RESEARCH_WEB_SUPPORT: "1" };
    const input = { question, enactedEvidence: actual.sources, outsideLibraryRequired: id === "GAP-03",
      pinnedEvidenceCount: 0, contextDependentFollowUp: actual.previousTopicApplied,
      relevanceComparison: actual.previousTopicApplied && actual.topicDecision?.decision === "relevance_comparison" };
    assert.equal(researchWebSupportTrigger(input, environment).useWeb, false);
    for (const delta of [
      { enactedEvidence: [] },
      { enactedEvidence: actual.sources.map((s) => ({ ...s, codeEdition: "2014 NYC Construction Codes" })) },
      { enactedEvidence: actual.sources.map((s) => ({ ...s, corpusID: "unrelated" })) },
      { enactedEvidence: actual.sources.map((s) => ({ ...s, canonicalContextComplete: false })) },
      { enactedEvidence: actual.sources.map((s) => ({ ...s, truncated: true })) },
      { guidanceRequested: true }, { referencedStandardUnavailable: true }, { corpusCoverage: "incomplete" },
      { contextDependentFollowUp: true }, { relevanceComparison: true }, { pinnedEvidenceCount: 1 }, { projectFactsApplied: true },
      { question: `${question} Also consult official DOB guidance.` },
      { question: `${question} Search the internet for supporting sources.` }
    ]) assert.equal(researchWebSupportTrigger({ ...input, ...delta }, environment).useWeb, true, `${id}: ${Object.keys(delta)}`);
  }

  const anchors = scope.anchors.map(([number]) => actual.sources.find((s) => s.codePrefix === scope.codePrefix && s.sectionNumber === number));
  const identity = { codeEdition: anchors[0].codeEdition, codeVersion: anchors[0].codeVersion,
    corpusID: anchors[0].corpusID, jurisdiction: "New York City" };
  const extra = { ...identity, sectionID: "test-extra", codePrefix: "MC", sectionNumber: "999.1",
    text: "An unrelated independently requested source.", selectedText: "An unrelated independently requested source.", signals: {} };
  const rows = [...anchors.map((s) => ({ ...identity, sectionID: s.sectionID, codePrefix: s.codePrefix,
    sectionNumber: s.sectionNumber, text: s.text, selectedText: s.text, signals: { exactTopicRouteTarget: true } })), extra];
  const orderedRows = prioritizeResearchEvidence(rows, { limit: 12 });
  assert.equal(focusedTechnicalCandidates({ question, projectFactsApplied: true }, orderedRows, 0), orderedRows);
  const simulate = ({ candidates = rows, pins = [], text = question, queryContext = {} } = {}) =>
    assembleResearchEvidence({ question: text, pinnedEvidence: pins, ...queryContext,
      discover: async () => ({ candidates }),
      resolveSection: async (request) => rows.find((s) => s.sectionID === request.sectionID ||
        (s.codePrefix === request.codePrefix && s.sectionNumber === request.sectionNumber)) || null });
  assert(!(await simulate()).sources.some((s) => s.sectionID === extra.sectionID));
  for (const [index, modified] of [
    rows.slice(1),
    rows.map((s) => ({ ...s, codeEdition: "2014 NYC Construction Codes" })),
    rows.map((s, i) => i === 0 ? { ...s, corpusID: "other" } : s),
    rows.map((s) => ({ ...s, text: "Unverified heading", selectedText: "Unverified heading" })),
    rows.map((s) => s === extra ? { ...s, signals: { exactTopicRouteTarget: true } } : s)
  ].entries()) {
    const ordered = prioritizeResearchEvidence(modified, { limit: 12 });
    assert.equal(focusedTechnicalCandidates({ question }, ordered, 0), ordered,
      `${id}: incomplete anchors or a mixed route must preserve ordinary selection (${index}).`);
    // A canonical resolver may correctly reject the deliberately mismatched
    // editions above; only valid source identities should reach final output.
    if (index === 0 || index === 4) assert((await simulate({ candidates: modified })).sources.some((s) => s.sectionID === extra.sectionID));
  }
  for (const signal of ["exactReference", "contextualReference"]) {
    const modified = rows.map((s) => s === extra ? { ...s, signals: { [signal]: true } } : s);
    assert((await simulate({ candidates: modified })).sources.some((s) => s.sectionID === extra.sectionID));
  }
  assert((await simulate({ pins: [{ ...extra, selectedText: extra.text }] })).sources.some((s) => s.sectionID === extra.sectionID && s.origin === "user_pinned"));
  for (const suffix of [" Also explain the structural requirements.", " Calculate the required airflow.", " Check the 2014 edition.", " Consult official guidance."]) {
    assert.equal(focusedTechnicalResearchScope(question + suffix), null);
    assert.equal(focusedTechnicalCandidates({ question: question + suffix }, orderedRows, 0), orderedRows,
      `${id}: broader questions retain ordinary selection, including its existing comparison handling.`);
  }
  results.push({ id, previousSources: before.sources.length, currentSources: actual.sources.length,
    previousCharacters: before.usage.characterCount, currentCharacters: actual.usage.characterCount });
}

for (const [question, expected] of [
  ["An environmental air exhaust is six feet from a mechanical intake. Is that separation sufficient?", "environmental-exhaust-intake-separation"],
  ["A restaurant has grease-producing cooking equipment under a Type II hood. Is this allowed?", "commercial-kitchen-hood-type"],
  ["Does a commercial kitchen mechanical makeup air system need automatic controls?", "commercial-kitchen-makeup-controls"],
  ["This work is exempt from a permit. May it ignore other laws?", "permit-exemption-compliance"],
  ["May a permit be revoked for a material misrepresentation?", "permit-revocation-material-statement"],
  ["Which documents should I upload in DOB NOW for permit revocation?", null],
  ["Does the alteration qualify for a permit exemption?", null],
  ["What is the required outdoor airflow for this restaurant?", null],
  ["What is the definition of medium-duty cooking equipment?", null],
  ["Where may I put a hazardous exhaust outlet near a mechanical intake?", null]
]) assert.equal(focusedTechnicalResearchScope(question)?.id || null, expected, question);
console.log(JSON.stringify({ results, governingTextPreserved: true, paidProviderCalls: 0 }));
