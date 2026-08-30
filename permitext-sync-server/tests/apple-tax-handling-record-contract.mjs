import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [record, acceptance, master, commercial] = await Promise.all([
  readFile(new URL("../../docs/BETA1_APPLE_TAX_HANDLING_RECORD.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/BETA1_PUBLIC_RELEASE_ACCEPTANCE_RECORD.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/PERMITEXT_BETA1_MASTER_PLAN.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/BETA1_COMMERCIAL_CONFIGURATION.md", import.meta.url), "utf8")
]);

for (const requiredBoundary of [
  /Status: \*\*Prepared; live tax-category verification and real financial evidence remain open\*\*/,
  /Stripe automatic tax applies only to a Stripe web Checkout/,
  /must not be applied to an App Store purchase, renewal, or refund/,
  /customer price includes applicable taxes Apple collects and remits/,
  /customer price minus applicable taxes and Apple's commission/,
  /live app category and subscription override therefore were \*\*not observed and are not claimed\*\*/,
  /official App Store Connect OpenAPI specification/,
  /supported public API therefore cannot replace the dashboard observation/,
  /Approve any proposed category change separately before it is saved/,
  /5% tax downside reserve/
]) {
  assert.match(record, requiredBoundary);
}

assert.match(acceptance, /BETA1_APPLE_TAX_HANDLING_RECORD\.md/);
assert.match(master, /BETA1_APPLE_TAX_HANDLING_RECORD\.md/);
assert.match(commercial, /BETA1_APPLE_TAX_HANDLING_RECORD\.md/);

console.log("Permitext Apple tax-handling record contract passed.");
