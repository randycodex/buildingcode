import assert from "node:assert/strict";
import { evaluateZoningFreshness } from "../zoning-freshness.mjs";

const sourceManifest = { textChangesThrough: "2026-11-12", consolidatedTextChangesThrough: "2026-10-22",
  adoptedAmendments: [736, 737].map(resolution => ({ resolution, adoptedDate: "2026-11-12",
    sourceSHA256: "a".repeat(64), affectedSections: ["reviewed section"] })) };
const homepage = date => `<p>All text changes approved by the city council as of ${date}</p>`;
const check = (date, source = sourceManifest) => evaluateZoningFreshness({
  homepageHTML: homepage(date), sourceManifest: source, retrievedAt: "2026-11-15T12:00:00Z" });

const current = check("Oct 22, 2026");
assert.equal(current.status, "current-with-adopted-supplements");
assert.equal(current.corpusFresh, true);
assert.equal(current.importedTextChangesThrough, "2026-11-12");
assert.equal(current.officialTextChangesThrough, "2026-10-22");
assert.equal(current.adoptedSupplementCount, 2);
assert.equal(check("Nov 12, 2026").status, "stale", "DCP incorporation requires reconciling the supplements");
assert.equal(check("Nov 19, 2026").corpusFresh, false);
assert.equal(check("Aug 13, 2026").status, "source-behind-contract");
assert.equal(check("Oct 22, 2026", { ...sourceManifest, adoptedAmendments: [] }).status, "incomplete-import");
assert.equal(check("Oct 22, 2026", { ...sourceManifest, textChangesThrough: "2026-08-13" }).corpusFresh, false);
assert.throws(() => evaluateZoningFreshness({ homepageHTML: "<p>No source date</p>" }), /valid text-change date/i);
console.info("Zoning freshness contract passed.");
