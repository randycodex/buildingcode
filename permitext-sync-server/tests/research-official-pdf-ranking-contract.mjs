import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { selectResearchOfficialHTMLPassages } from "../research-official-html-attribution.mjs";
import { reconciledResearchEvaluationInput } from "../evals/research-answer-key-reconciliation.mjs";

globalThis.fetch = async () => { throw new Error("No network in PDF page ranking checks."); };
const fixture = JSON.parse(await readFile(new URL("../evals/fixtures/dob-official-document-pages-20260909.json", import.meta.url)));
const key = JSON.parse(await readFile(new URL("../evals/research-reconciled-answer-key.json", import.meta.url)));
const safetyFixture = JSON.parse(await readFile(new URL("../evals/fixtures/dob-site-safety-document-pages-20260909.json", import.meta.url)));
const hash = (value) => createHash("sha256").update(value).digest("hex");
for (const { source, document } of [...fixture.documents, ...safetyFixture.documents]) {
  for (const passage of document.passages) {
    assert.equal(passage.id, `official-passage-${hash(`${source.url}\u0000${passage.contentHash}\u0000${passage.pageNumber}\u0000${passage.text}`).slice(0, 24)}`);
    assert.equal(passage.sourceURL, `${source.url}#page=${passage.pageNumber}`);
  }
}
const safetyQuestion = reconciledResearchEvaluationInput(key.cases.find((item) => item.id === "DOBNOW-008")).question;
const safetySelection = (document) => selectResearchOfficialHTMLPassages(document.passages, safetyQuestion,
  { maximum: 3, requiredPassageTerms: ["safety", "superintendent"] });
assert(safetySelection(fixture.documents[0].document).some((passage) => passage.pageNumber === 23));
const changes = safetySelection(safetyFixture.documents[0].document);
assert(changes.some((passage) => passage.pageNumber === 16));
const familyPage = changes.find((passage) => passage.pageNumber === 17);
assert(familyPage, "Retain the exception's complete source page alongside the general trigger.");
assert.match(familyPage.text, /Construction Superintendent not required on 1\s*-\s*,\s*2\s*-\s*or 3\s*-\s*Family Buildings/);
assert.match(familyPage.text, /permit holder must be registered/);
assert.match(familyPage.text, /site safety plan is only required if the job requires a CS/);
const notice = safetySelection(safetyFixture.documents[1].document);
assert.equal(notice.length, 1);
assert.match(notice[0].text, /major alteration \(AltCO\)/);
assert.match(notice[0].text, /General Contractor/);

// These are minimum relevant-page checks, not a completeness rubric. Several
// cases also require a newer notice, FAQ, enacted text, or live filing facts.
const relevant = [
  ["001", 0, [6]], ["002", 0, [7]], ["003", 0, [5]], ["004", 0, [5]],
  ["005", 0, [7]], ["006", 0, [7]], ["007", 0, [19]], ["008", 0, [23]],
  ["009", 0, [23]], ["010", 0, [22]], ["011", 0, [22]], ["012", 0, [23]],
  ["013", 0, [38]], ["014", 0, [38]], ["015", 1, [20]], ["016", 1, [19]],
  ["017", 1, [10]], ["018", 1, [12, 13]], ["019", 1, [4, 5]], ["020", 1, [7, 8]],
  ["021", 0, [19]], ["022", 0, [13]], ["023", 0, [38]], ["024", 0, [37]]
];
for (const [suffix, sourceIndex, pages] of relevant) {
  const id = `DOBNOW-${suffix}`;
  const question = reconciledResearchEvaluationInput(key.cases.find((item) => item.id === id)).question;
  const passages = fixture.documents[sourceIndex].document.passages;
  const selected = selectResearchOfficialHTMLPassages(passages, question, { maximum: 3 });
  assert.equal(selected.length, 3);
  for (const page of pages) assert(selected.some((passage) => passage.pageNumber === page), `${id}: missing relevant page ${page}`);
  for (const passage of selected) assert.strictEqual(passage, passages.find((item) => item.id === passage.id), "Return the original complete passage.");
  assert.deepEqual(selectResearchOfficialHTMLPassages(passages, question, { maximum: 3 }), selected, "Selection is repeatable.");
}

const synthetic = [
  "General information about the filing, applicant, property and supplied plans. ".repeat(30),
  "Synthetic guide. Are you altering more than 50% of the gross floor area? This condition has an exception requiring separate review.",
  "Synthetic guide. The property address and plans identify the applicant and filing."
].map((text, index) => ({ kind: "pdf_page", index, pageNumber: index + 1, text, id: `synthetic-${index}` }));
for (const wording of ["more-than-50-percent", "more than 50 percent", "more than 50%", "more–than–50–percent"]) {
  const selected = selectResearchOfficialHTMLPassages(synthetic, `The applicant supplies property and filing plans. How should the ${wording} gross floor area question be answered?`, { maximum: 1 });
  assert.deepEqual(selected, [synthetic[1]], wording);
  assert(selected[0].text.includes("exception"));
}
assert.deepEqual(selectResearchOfficialHTMLPassages(synthetic, "unrelatedgibberish"), []);
const numericNearMisses = ["112 feet", "12 feet"].map((depth, index) => ({
  kind: "pdf_page", index, text: `Synthetic guide: excavation deeper than ${depth}.`, pageNumber: index + 1
}));
assert.deepEqual(selectResearchOfficialHTMLPassages(numericNearMisses, "excavation deeper than 12 feet", { maximum: 1 }), [numericNearMisses[1]]);
assert.deepEqual(selectResearchOfficialHTMLPassages(synthetic, "gross floor area", { requiredPassageTerms: ["wetlands"] }), []);
assert.deepEqual(selectResearchOfficialHTMLPassages([], "a question"), []);

console.log("PDF ranking passed: minimum relevant pages for all 24 authored DOB queries, preserved full passages and references, equivalent threshold wording and topic filters; zero network/API calls. Full source or answer completeness is not asserted.");
