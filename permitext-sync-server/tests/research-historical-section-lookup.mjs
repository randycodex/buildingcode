import assert from "node:assert/strict";
import { routeResearchCorpora } from "../research-corpus-registry.mjs";
import { assembledResearchEvidenceForTurn } from "../app.mjs";
const question = "In the 1968 New York City Building Code, what does section 27-598 say about core tests of concrete construction? Cite that exact edition and section. Do not apply it to a specific project.";
for (const name of ["New York City", "NYC"]) {
  const plan = routeResearchCorpora({question: question.replace("New York City", name)});
  assert.deepEqual(plan.selected.map(c => c.id), ["nyc-1968-building-code"]);
  assert.deepEqual(plan.requestedCorpusIDs, ["nyc-1968-building-code"]);
}
for (const question of [
  "Can I apply 1968 NYC Building Code section 27-598 to my project?",
  "What did the 1968 NYC Building Code require?",
  "Does EBC 101 apply now?"
]) assert.equal(routeResearchCorpora({question}).selected.length, 0);
const result = await assembledResearchEvidenceForTurn({question, messages:[], pinnedEvidence:[], projectFacts:[]});
const source = result.sources.find(s => s.sectionNumber === "27-598");
assert.ok(source);
assert.match(source.text, /recovery and testing of cores/);
assert.match(source.text, /RS 10-16/);
assert.match(source.text, /RS 10-3/);
assert.equal(source.evidencePriority.evidenceRole, "governing");
assert.equal(result.topicDecision.signals.relevanceComparison, false);
assert.ok(result.sources.every(s => s.codePrefix === "BC68"));
// Unavailable cross-references remain reported rather than invented.
console.log("Historical section lookup passed.");

for (const exclusion of ["Do not apply it to a specific project.", "Don't apply this to my project."]) {
  const question = "In the 1968 New York City Building Code, what does section 27-609 say about licensed concrete testing laboratories? Cite that exact edition and section. " + exclusion;
  const assembled = await assembledResearchEvidenceForTurn({question, messages:[], pinnedEvidence:[], projectFacts:[]});
  assert.equal(assembled.sources.find(s => s.sectionNumber === "27-609")?.evidencePriority.evidenceRole, "governing");
  assert.equal(assembled.topicDecision.signals.relevanceComparison, false);
}
