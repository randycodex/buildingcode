import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [
  record,
  acceptance,
  master,
  commercial,
  preflight,
  economics,
  currentPlan,
  policyStaging,
  webIndex,
  webApp,
  iosSettings
] = await Promise.all([
  readFile(new URL("../../docs/BETA1_STRIPE_TAX_DECISION_RECORD.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/BETA1_PUBLIC_RELEASE_ACCEPTANCE_RECORD.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/PERMITEXT_BETA1_MASTER_PLAN.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/BETA1_COMMERCIAL_CONFIGURATION.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/PERMITEXT_BETA1_PRODUCTION_CONFIGURATION_PREFLIGHT_2026-08-30.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/PERMITEXT_RESEARCH_SUBSCRIBER_ECONOMICS_V6.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/PERMITEXT_RESEARCH_COMMERCIALIZATION_CURRENT_PLAN.md", import.meta.url), "utf8"),
  readFile(new URL("../../docs/PERMITEXT_BETA1_PRODUCTION_POLICY_CONFIGURATION_STAGING_2026-09-02.md", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../../NYC CC APP/permitext/Views/SettingsView.swift", import.meta.url), "utf8")
]);

const disclosure = "$20/month plus applicable taxes shown by Stripe.";

for (const requiredDecision of [
  /Status: \*\*OWNER APPROVED — automatic\/exclusive and `txcd_10701400` selected; owner reports possession of the New York certificate; provider activation remains open\*\*/,
  /PERMITEXT_STRIPE_TAX_MODE=automatic/,
  /PERMITEXT_STRIPE_PRICE_TAX_BEHAVIOR=exclusive/,
  /August 30, 2026/,
  /No Production environment variable, Stripe registration, Product tax code, Price, provider setting, deployment, or charge changed/,
  /Production activation only after the Certificate and provider facts pass review/,
  /txcd_10701400/,
  /Website Information Services - Business Use/,
  /No live Product code has changed yet/
]) {
  assert.match(record, requiredDecision);
}
assert(record.includes(disclosure));

for (const synchronizedRecord of [acceptance, master, commercial, economics, currentPlan]) {
  assert.match(synchronizedRecord, /automatic/);
  assert.match(synchronizedRecord, /exclusive/);
  assert(synchronizedRecord.includes(disclosure));
}

assert.match(acceptance, /The Production keys remain absent/);
assert.match(preflight, /missing Stripe tax keys are expected to remain absent/);
assert.match(preflight, /activation is separately authorized/);
assert.match(preflight, /official registration status is already `Issued`/);
assert.match(master, /Additional turn packs remain disabled and unpublished/);
assert.match(master, /real taxed Checkout open/);
assert.match(master, /owner report of certificate possession/);
assert.match(acceptance, /registration issued: yes/);
assert.match(acceptance, /Actual Certificate of Authority received: owner reported possession on September 2, 2026/);
assert.match(commercial, /txcd_10701400/);
assert.match(currentPlan, /txcd_10701400/);
assert.match(policyStaging, /CONFIGURED IN VERCEL; NOT DEPLOYED OR PUBLISHED/);
assert.match(policyStaging, /PERMITEXT_TERMS_VERSION=terms-2026-08-28/);
assert.match(policyStaging, /PERMITEXT_PRIVACY_VERSION=privacy-2026-08-28/);
assert.match(policyStaging, /PERMITEXT_SUBSCRIPTION_POLICY_VERSION=subscriptions-2026-08-28/);
assert.match(policyStaging, /two Stripe-tax activation keys remain intentionally unset/);

assert(webIndex.includes(disclosure));
assert.match(webIndex, /aria-describedby="settings-stripe-tax-disclosure settings-plan-details"/);
assert.match(webApp, /stripeTaxDisclosure\.hidden = pro/);
assert.match(webApp, /stripeTaxDisclosure\.textContent = webStripePriceDisclosure/);
assert(!iosSettings.includes(disclosure));
assert.doesNotMatch(iosSettings, /plus applicable taxes shown by Stripe/i);

console.log("Permitext Stripe tax decision record contract passed.");
