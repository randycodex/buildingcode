import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  approvedPolicyArtifacts,
  approvedPolicyEnvironment
} from "../approved-policy-artifacts.mjs";
import { policyVersionConfiguration } from "../policy-acceptance.mjs";

const serverRoot = new URL("../", import.meta.url);

for (const [key, artifact] of Object.entries(approvedPolicyArtifacts)) {
  const content = await readFile(new URL(artifact.sourcePath, serverRoot));
  const digest = createHash("sha256").update(content).digest("hex");
  assert.equal(
    digest,
    artifact.sha256,
    `${artifact.sourcePath} changed without a new owner-approved version and hash.`
  );
  assert.match(artifact.version, /^[a-z0-9][a-z0-9._-]{0,79}$/i, `${key} version must be stable.`);
  assert.match(artifact.publicPath, /^\/[a-z0-9-]+$/i, `${key} public path must be canonical.`);
}

const productionBaseURL = "https://permitext.com";
const environment = approvedPolicyEnvironment(productionBaseURL);
const configuration = policyVersionConfiguration(environment);

assert.equal(configuration.ready, true);
for (const [key, artifact] of Object.entries(approvedPolicyArtifacts)) {
  assert.equal(configuration.versions[key], artifact.version);
  assert.equal(configuration.documents[key].url, `${productionBaseURL}${artifact.publicPath}`);
}

assert.deepEqual(Object.keys(environment).sort(), [
  "PERMITEXT_PRIVACY_VERSION",
  "PERMITEXT_PUBLIC_BASE_URL",
  "PERMITEXT_SUBSCRIPTION_POLICY_VERSION",
  "PERMITEXT_TERMS_VERSION"
]);

console.log("Permitext approved policy artifact integrity contract passed.");
