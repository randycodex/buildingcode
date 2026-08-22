import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const repositoryRoot = new URL("../../", import.meta.url);
const serverRoot = new URL("../", import.meta.url);
const [
  webClient,
  webIndex,
  iosLibrary,
  iosSettings,
  terms,
  refunds,
  support
] = await Promise.all([
  readFile(new URL("public/app.js", serverRoot), "utf8"),
  readFile(new URL("public/index.html", serverRoot), "utf8"),
  readFile(new URL("NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift", repositoryRoot), "utf8"),
  readFile(new URL("NYC CC APP/permitext/Views/SettingsView.swift", repositoryRoot), "utf8"),
  readFile(new URL("public/terms.html", serverRoot), "utf8"),
  readFile(new URL("public/refunds.html", serverRoot), "utf8"),
  readFile(new URL("public/support.html", serverRoot), "utf8")
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
assert.match(webIndex, /By upgrading, you agree to the/);
assert.match(iosSettings, /Text\("Current plan"\)/);
assert.match(iosSettings, /By upgrading, you agree to the \[Terms\]/);

for (const [name, document] of [["Terms", terms], ["Refund policy", refunds]]) {
  assert.match(document, /Beta 1[^.]*working draft/);
  assert.match(document, /permitext@gmail\.com/);
  assert.match(document, /United States|web subscription|Web subscription/i);
  assert.match(document, /\/privacy/);
  assert(document.length > 2_000, `${name} is unexpectedly incomplete.`);
}
assert.match(terms, /\$20 per month/);
assert.match(terms, /no free trial/i);
assert.match(terms, /unofficial research and workspace tool/i);
assert.match(refunds, /within 72 hours of that\s+charge/i);
assert.match(refunds, /initial charge and every renewal charge/i);
assert.match(refunds, /Search and\s+Research usage do not change eligibility/i);
assert.doesNotMatch(refunds, /seven calendar\s+days|five paid Research turns/i);
assert.match(refunds, /reportaproblem\.apple\.com/);
assert.match(support, /within two business days/i);
assert.match(support, /within one business day/i);

for (const path of ["/terms", "/refunds", "/support"]) {
  assert(webIndex.includes(`href="${path}"`), `Web Settings is missing ${path}.`);
  assert(iosSettings.includes(`https://permitext.com${path}`), `iOS Settings is missing ${path}.`);
}

console.log("Beta 1 public surface contract passed");
