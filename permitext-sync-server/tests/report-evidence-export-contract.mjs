import assert from "node:assert/strict";
import { immutableReportManifest } from "../report-contract.mjs";
import { readFile } from "node:fs/promises";
import { prepareSavedEvidenceItems, savedExportSourceText, reportSavedSelection, reportSavedSourceID } from "../report-evidence.mjs";

const tail = "Exception: retain this condition at the end of the complete source.";
const fullText = `${"Complete selected source paragraph. ".repeat(1800)}${tail}`;
const versions = ["2014", "2022"];
const selections = versions.map(codeVersion => ({ sectionID: "same-number", codeVersion,
  notes: [{ blockID: "", label: "Section note", body: `Private note for ${codeVersion}.` }] }));
const prepared = await prepareSavedEvidenceItems({ selections,
  resolveSource: async selection => ({
    section: { id: "same-number", sectionNumber: "101", codePrefix: "BC", title: "General", chapterNumber: "1" },
    body: { blocks: [{ kind: "text", id: "paragraph", plainText: fullText }] },
    source: { canonicalEdition: selection.codeVersion, editionLabel: `${selection.codeVersion} NYC Construction Codes`, categoryLabel: "Building Code" }
  }) });
const manifest = immutableReportManifest({ id: "long-evidence", project: { id: "qa", name: "QA" }, draftID: "draft",
  title: "Full evidence", reportDate: "2026-10-10", author: { userID: "qa", displayName: "QA" },
  codeEdition: "Mixed", items: prepared.items, reportVersion: 1, sourceVersions: { selections: prepared.sources } });
for (const version of versions) {
  const evidence = manifest.items.filter(item => item.kind === "evidence" && item.codeEdition.startsWith(version));
  assert(evidence.length > 1, "Long sources are split into complete parts instead of truncated.");
  assert.equal(evidence.map(item => item.passageText).join(" "), fullText.trim());
  assert(manifest.items.some(item => item.text === `Private note for ${version}.`));
}
assert.deepEqual(prepared.sources.map(source => source.codeVersion), versions);
const htmlBody = { blocks: [{ kind: "html", id: "source", html: '<div><p class="Normal-Level" id="first">First paragraph.</p><p class="Normal-Level" id="last">Second paragraph. Exception: preserve this.</p><table id="ratings"><tr><th>Occupancy</th><th>Hours</th></tr><tr><td>R</td><td>1</td></tr></table></div>' }] };
assert.equal(savedExportSourceText(htmlBody, "last"), "Second paragraph. Exception: preserve this.");
assert.match(savedExportSourceText(htmlBody), /Occupancy \| Hours\nR \| 1/);
assert.equal(savedExportSourceText({ blocks: [{ kind: "html", html: '<table><tr><th rowspan="2">Occupancy</th><th colspan="2">Hours</th></tr><tr><th>Without sprinklers</th><th>With sprinklers</th></tr><tr><td>R</td><td>1</td><td>0</td></tr></table>' }] }),
  "Occupancy | Hours | Hours\nOccupancy | Without sprinklers | With sprinklers\nR | 1 | 0");
const stickyTableBody = {blocks:[{kind:"html",html:'<div><div class="xsl-table--header"><table><tr><th>Use</th><th>Value</th></tr></table></div><div class="xsl-table--body"><table><tr><th>Use</th><th>Value</th></tr><tr><td>R</td><td>1</td></tr><tr><td></td><td></td></tr></table></div></div>'}]};
assert.equal(savedExportSourceText(stickyTableBody),"Use | Value\nR | 1","Only matching sticky header copies and empty layout rows are removed");
const structuredTable = await prepareSavedEvidenceItems({selections:[{sectionID:"table",codeVersion:"2022"}],resolveSource:async()=>({
  section:{id:"table",sectionNumber:"1",title:"Table",codePrefix:"BC"},body:stickyTableBody,
  source:{canonicalEdition:"2022",editionLabel:"2022"}
})});
assert.deepEqual(structuredTable.items[0].tables[0].rows,[["Use","Value"],["R","1"]]);
assert.throws(() => savedExportSourceText(htmlBody, "missing"), /paragraph is no longer available/);
assert.throws(() => savedExportSourceText({ blocks: [], previewText: "short fallback" }), /complete source text is unavailable/i);
assert.throws(() => savedExportSourceText({ blocks: [{ kind: "image", id: "figure" }] }), /figure/);
assert.equal(savedExportSourceText({ blocks: [{ kind: "image", id: "figure" }, { kind: "text", id: "text", plainText: "Separate text." }] }, "text"), "Separate text.");
await assert.rejects(prepareSavedEvidenceItems({ selections: [selections[0]], resolveSource: async () => ({
  section: {}, body: htmlBody, source: { canonicalEdition: "wrong" }
}) }), /does not match.*edition/);

// Server-side note capture uses current identities and does not resurrect stale previews.
const record = { sectionID: "1", codeVersion: "2022", blockID: "p" };
const notes = [
  { sectionID: "1", codeVersion: "2014", noteBody: "Historical note" },
  { sectionID: "1", codeVersion: "2022", blockID: "p", noteBody: "Paragraph note" },
  { sectionID: "1", codeVersion: "2022", blockID: "q", noteBody: "Another paragraph note" },
  { sectionID: "1", codeVersion: "2022", deletedAt: "today", noteBody: "Deleted note" }
];
assert.equal(reportSavedSelection(record, notes).notes.length, 1);
assert.deepEqual(reportSavedSelection({ ...record, scope: "section" }, notes).notes.map(note => note.body), ["Paragraph note", "Another paragraph note"]);
assert.equal(reportSavedSourceID({ ...record, blockID: "" }), "1", "Existing whole-section draft references stay compatible.");
assert.notEqual(reportSavedSourceID(record), reportSavedSourceID({ ...record, blockID: "q" }));
const oldSaved = [{ ...record, noteBody: "Old rendered note" }];
assert.equal(reportSavedSelection(record, notes, oldSaved).notes[0].body, "Paragraph note");
assert.equal(reportSavedSelection(record, [{ ...record, noteBody: "", deletedAt: "today" }], oldSaved).notes.length, 0);
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
assert(!app.includes("function printSavedItemsAsPDF("));
assert(!app.includes("saved-evidence-export-selection"), "Saved must not introduce another export surface.");
assert(!app.includes("printReportManifestAsPDF"), "Use the immutable issued PDF instead of regenerating it through print.");
console.log("Report evidence passed: full long sources, exact paragraphs, table boundaries, current notes and edition identities; no preview fallback or separate Saved export.");
