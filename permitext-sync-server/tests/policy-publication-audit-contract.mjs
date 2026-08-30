import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { auditPolicyPublication } from "../policy-publication-audit.mjs";

const bodies = {
  terms: Buffer.from("approved terms fixture"),
  privacy: Buffer.from("approved privacy fixture"),
  subscriptionsAndRefunds: Buffer.from("approved refund fixture")
};
const artifacts = Object.fromEntries(Object.entries(bodies).map(([key, body]) => [key, {
  version: `${key}-v1`,
  publicPath: key === "subscriptionsAndRefunds" ? "/refunds" : `/${key}`,
  sha256: createHash("sha256").update(body).digest("hex")
}]));
const exactLiveResponses = Object.fromEntries(Object.entries(bodies).map(([key, body]) => [key, {
  statusCode: 200,
  contentType: "text/html; charset=utf-8",
  body
}]));

const exact = auditPolicyPublication({
  artifacts,
  localBodies: bodies,
  liveResponses: exactLiveResponses,
  publicBaseURL: "https://permitext.com"
});
assert.equal(exact.schema, "permitext-policy-publication-audit-v1");
assert.equal(exact.publicationReady, true);
assert.equal(exact.routes.length, 3);
assert(exact.routes.every((route) => route.ready));
assert.equal(exact.privacy.documentBodiesEmitted, false);

const stale = auditPolicyPublication({
  artifacts,
  localBodies: bodies,
  liveResponses: {
    ...exactLiveResponses,
    privacy: { ...exactLiveResponses.privacy, body: Buffer.from("older privacy fixture") }
  },
  publicBaseURL: "https://permitext.com"
});
assert.equal(stale.publicationReady, false);
assert.equal(stale.routes.find((route) => route.key === "privacy")?.checks.liveApprovedHash, false);

for (const [label, overrides] of [
  ["redirect", { terms: { ...exactLiveResponses.terms, statusCode: 308 } }],
  ["wrong content type", { terms: { ...exactLiveResponses.terms, contentType: "text/plain" } }],
  ["network failure", { terms: { statusCode: 0, contentType: "", body: null, error: "unavailable" } }]
]) {
  const report = auditPolicyPublication({
    artifacts,
    localBodies: bodies,
    liveResponses: { ...exactLiveResponses, ...overrides },
    publicBaseURL: "https://permitext.com"
  });
  assert.equal(report.publicationReady, false, `${label} was accepted as exact live publication.`);
}

const localDrift = auditPolicyPublication({
  artifacts,
  localBodies: { ...bodies, terms: Buffer.from("unapproved local edit") },
  liveResponses: exactLiveResponses,
  publicBaseURL: "https://permitext.com"
});
assert.equal(localDrift.publicationReady, false);
assert.equal(localDrift.routes.find((route) => route.key === "terms")?.checks.localApprovedHash, false);

const invalidURL = auditPolicyPublication({
  artifacts,
  localBodies: bodies,
  liveResponses: exactLiveResponses,
  publicBaseURL: "http://permitext.com"
});
assert.equal(invalidURL.publicationReady, false);

for (const publicBaseURL of [
  "https://permitext.com/subdirectory",
  "https://permitext.com?preview=1",
  "https://user:password@permitext.com"
]) {
  const report = auditPolicyPublication({
    artifacts,
    localBodies: bodies,
    liveResponses: exactLiveResponses,
    publicBaseURL
  });
  assert.equal(report.publicationReady, false, `${publicBaseURL} was accepted as a canonical origin.`);
}

const serialized = JSON.stringify(stale);
assert.equal(serialized.includes("approved privacy fixture"), false);
assert.equal(serialized.includes("older privacy fixture"), false);

console.log("Permitext policy publication audit contract passed.");
