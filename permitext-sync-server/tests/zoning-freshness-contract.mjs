import assert from "node:assert/strict";
import { evaluateZoningFreshness } from "../zoning-freshness.mjs";

function homepage(date) {
  return `<!doctype html><html><body>
    <p>All text changes approved by the city council as of ${date}</p>
    <p>The Zoning Resolution consists of 14 Articles and 11 Appendices, plus 126 Zoning Maps.</p>
  </body></html>`;
}

const current = evaluateZoningFreshness({
  homepageHTML: homepage("Aug 13, 2026"),
  retrievedAt: "2026-08-30T12:00:00.000Z"
});
assert.equal(current.status, "current");
assert.equal(current.corpusFresh, true);
assert.equal(current.researchEnablementReady, false);
assert.equal(current.publicResearchEnabled, false);

const stale = evaluateZoningFreshness({
  homepageHTML: homepage("Sep 10, 2026"),
  retrievedAt: "2026-08-30T12:00:00.000Z"
});
assert.equal(stale.status, "stale");
assert.equal(stale.corpusFresh, false);
assert.equal(stale.officialTextChangesThrough, "2026-09-10");
assert.match(stale.requiredAction, /Refresh and validate/i);

const sourceBehind = evaluateZoningFreshness({
  homepageHTML: homepage("Jul 16, 2026"),
  retrievedAt: "2026-08-30T12:00:00.000Z"
});
assert.equal(sourceBehind.status, "source-behind-contract");
assert.equal(sourceBehind.corpusFresh, false);
assert.match(sourceBehind.requiredAction, /investigate/i);

assert.throws(
  () => evaluateZoningFreshness({ homepageHTML: "<p>No source date</p>" }),
  /valid text-change date/i
);

console.info("Zoning freshness contract passed.");
