import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [record, acceptance, master, commercial, economics, semanticReview] = await Promise.all([
  readFile(new URL("../../docs/BETA1_APPLE_TAX_HANDLING_RECORD.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/BETA1_PUBLIC_RELEASE_ACCEPTANCE_RECORD.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/PERMITEXT_BETA1_MASTER_PLAN.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/BETA1_COMMERCIAL_CONFIGURATION.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/PERMITEXT_RESEARCH_SUBSCRIBER_ECONOMICS_V6.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/PERMITEXT_RESEARCH_COMMERCIALIZATION_SEMANTIC_REVIEW_2026-08-30.md", import.meta.url), "utf8")
]);

for (const requiredBoundary of [
  /Status: \*\*Live tax-category state verified read-only and owner classification confirmed; real financial evidence remains open\*\*/,
  /Stripe automatic tax applies only to a Stripe web Checkout/,
  /must not be applied to an App Store purchase, renewal, or refund/,
  /customer price includes applicable taxes Apple collects and remits/,
  /customer price minus applicable taxes and Apple's commission/,
  /Category: App Store software/,
  /Match to parent app/,
  /owner accepted the recommendation to leave that category unchanged/,
  /does not independently establish that the category is legally or tax-professionally correct/,
  /official App Store Connect OpenAPI specification/,
  /supported public API therefore cannot replace the dashboard observation/,
  /Any later proposed category change requires separate approval before it is saved/,
  /5% tax downside reserve/
]) {
  assert.match(record, requiredBoundary);
}

assert.match(acceptance, /BETA1_APPLE_TAX_HANDLING_RECORD\.md/);
assert.match(master, /BETA1_APPLE_TAX_HANDLING_RECORD\.md/);
assert.match(commercial, /BETA1_APPLE_TAX_HANDLING_RECORD\.md/);

for (const synchronizedRecord of [acceptance, master, commercial, economics, semanticReview]) {
  assert.match(synchronizedRecord, /App Store software/);
  assert.match(synchronizedRecord, /Match to parent app/);
  assert.match(synchronizedRecord, /owner (?:accepted|approved|approval to).*leav(?:e|ing) that classification unchanged/i);
}

console.log("Permitext Apple tax-handling record contract passed.");
