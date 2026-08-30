import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const repositoryRoot = new URL("../../", import.meta.url);
const serverRoot = new URL("../", import.meta.url);
const [
  webClient,
  webIndex,
  iosLibrary,
  iosSettings,
  iosResearch,
  terms,
  privacy,
  refunds,
  support,
  subscriptionConfirmation,
  subscriptionConfirmationClient
] = await Promise.all([
  readFile(new URL("public/app.js", serverRoot), "utf8"),
  readFile(new URL("public/index.html", serverRoot), "utf8"),
  readFile(new URL("NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift", repositoryRoot), "utf8"),
  readFile(new URL("NYC CC APP/permitext/Views/SettingsView.swift", repositoryRoot), "utf8"),
  readFile(new URL("NYC CC APP/permitext/Views/ResearchView.swift", repositoryRoot), "utf8"),
  readFile(new URL("public/terms.html", serverRoot), "utf8"),
  readFile(new URL("public/privacy.html", serverRoot), "utf8"),
  readFile(new URL("public/refunds.html", serverRoot), "utf8"),
  readFile(new URL("public/support.html", serverRoot), "utf8"),
  readFile(new URL("public/subscription-confirmation.html", serverRoot), "utf8"),
  readFile(new URL("public/subscription-confirmation.js", serverRoot), "utf8")
]);

assert.match(webClient, /firmCollaboration:\s*false/);
assert.match(webClient, /if \(!releaseSurfaceVisibility\.firmCollaboration\) return projects;/);
assert.match(webClient, /if \(!releaseSurfaceVisibility\.firmCollaboration\) return "";/);
assert.equal(
  (webClient.match(/renderFirmWorkspaceSettings\(/g) || []).length,
  1,
  "The dormant firm renderer must not be called from the Beta 1 web surface."
);
assert.doesNotMatch(webIndex, /Firm|Organization|Collaboration/i);

assert.match(iosLibrary, /static let firmCollaboration = false/);
assert.match(
  iosLibrary,
  /guard PermitextReleaseSurfaceVisibility\.firmCollaboration else \{ return \}/
);
assert.match(
  iosLibrary,
  /if PermitextReleaseSurfaceVisibility\.firmCollaboration \{\s*await refreshOrganizations\(\)/
);

assert.match(webClient, /row\.hidden = !active;/);
assert.match(webIndex, /aria-label="Current plan"/);
assert.match(webIndex, /\$20\/month plus applicable taxes shown by Stripe\./);
assert.match(webIndex, /aria-describedby="settings-stripe-tax-disclosure settings-plan-details"/);
assert.match(webClient, /stripeTaxDisclosure\.hidden = pro/);
assert.doesNotMatch(iosSettings, /plus applicable taxes shown by Stripe/i);
assert.match(webIndex, /class="settings-policy-acceptance" type="checkbox"/);
assert.match(webIndex, /I have reviewed and agree to the/);
assert.match(webIndex, /data-policy-document="terms"/);
assert.match(webIndex, /data-policy-document="privacy"/);
assert.match(webIndex, /data-policy-document="subscriptionsAndRefunds"/);
assert.match(webClient, /loadCurrentPolicyConfiguration\(\)/);
assert.match(webClient, /"\/account\/policy-acceptance"/);
assert.match(webClient, /platform: "web"/);
assert.match(webClient, /clientRelease: release\?\.releaseID \|\| "web-unknown"/);
const webPolicyAcceptance = webClient.indexOf('"/account/policy-acceptance"');
const webCheckout = webClient.indexOf('"/billing/web/checkout"', webPolicyAcceptance);
assert(webPolicyAcceptance >= 0 && webCheckout > webPolicyAcceptance, "Web policy acceptance must precede Checkout creation.");
assert.match(iosSettings, /Text\("Current plan"\)/);
assert.match(iosSettings, /By upgrading, you agree to the \[Terms\]/);
assert.match(iosSettings, /Toggle\("I have reviewed and agree to the current policies\.", isOn: \$policiesAccepted\)/);
assert.match(iosSettings, /acceptedPolicyVersions: policiesAccepted/);
assert.match(iosLibrary, /accountBackendClient\.recordPolicyAcceptance\(/);
assert.match(iosLibrary, /platform: "ios"/);
const iosPolicyAcceptance = iosLibrary.indexOf("accountBackendClient.recordPolicyAcceptance(");
const iosPurchase = iosLibrary.indexOf("let purchaseResult = try await purchaseAction(", iosPolicyAcceptance);
assert(iosPolicyAcceptance >= 0 && iosPurchase > iosPolicyAcceptance, "iOS policy acceptance must precede StoreKit purchase.");

for (const [name, document] of [["Terms", terms], ["Refund policy", refunds]]) {
  assert.doesNotMatch(document, /legal review remains pending|working draft/i);
  assert.match(document, /permitext@gmail\.com/);
  assert.match(document, /United States|web subscription|Web subscription/i);
  assert.match(document, /\/privacy/);
  assert(document.length > 2_000, `${name} is unexpectedly incomplete.`);
}
assert.match(terms, /\$20 per month/);
assert.match(terms, /no free trial/i);
assert.match(terms, /unofficial research and workspace tool/i);
assert.match(terms, /at least 18 years old to use Permitext/i);
assert.match(terms, /not approved for confidential, regulated, or sensitive personal\s+information/i);
assert.match(privacy, /not approved for confidential, regulated, or sensitive personal\s+information/i);
assert.match(terms, /Ordinary project information, including a property\s+address, may be submitted/i);
assert.match(privacy, /Ordinary project information, including a property\s+address, may be submitted/i);
assert.match(privacy, /does not knowingly collect personal\s+information from anyone under 18/i);
assert.match(webClient, /Do not include confidential, regulated, or sensitive personal information/);
assert.match(iosResearch, /Do not include confidential, regulated, or sensitive personal information/);
assert.match(webClient, /Ordinary property information may be included when needed/);
assert.match(iosResearch, /Ordinary property information may be included when needed/);
assert.match(refunds, /within 72 hours of that\s+charge/i);
assert.match(refunds, /initial(?: subscription)? charge,?\s+(?:and )?every renewal\s+charge/i);
assert.match(refunds, /Search and\s+Research usage do not change eligibility/i);
assert.doesNotMatch(refunds, /seven calendar\s+days|five paid Research turns/i);
assert.match(refunds, /reportaproblem\.apple\.com/);
assert.match(support, /within two business days/i);
assert.match(support, /within one business day/i);
assert.match(subscriptionConfirmation, /Web subscription acknowledgment/);
assert.match(subscriptionConfirmation, /\$20 per month/);
assert.match(subscriptionConfirmation, /renews automatically each month until canceled/i);
assert.match(subscriptionConfirmation, /cancel before the next monthly renewal/i);
assert.match(subscriptionConfirmation, /within 72 hours/i);
assert.match(subscriptionConfirmation, /Print or save as PDF/i);
assert.match(subscriptionConfirmationClient, /checkout", "success"/);
assert.match(subscriptionConfirmationClient, /session_id/);

for (const path of ["/terms", "/privacy", "/refunds", "/support"]) {
  assert(webIndex.includes(`href="${path}"`), `Web Settings is missing ${path}.`);
  assert(iosSettings.includes(`https://permitext.com${path}`), `iOS Settings is missing ${path}.`);
}

console.log("Beta 1 public surface contract passed");
