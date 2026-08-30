import { createHash } from "node:crypto";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizePolicyPublicBaseURL(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (
      url.protocol !== "https:"
      || url.username
      || url.password
      || url.pathname !== "/"
      || url.search
      || url.hash
    ) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function auditPolicyPublication({
  artifacts = {},
  localBodies = {},
  liveResponses = {},
  publicBaseURL
} = {}) {
  const baseURL = normalizePolicyPublicBaseURL(publicBaseURL);
  const routes = Object.entries(artifacts).map(([key, artifact]) => {
    const localBody = localBodies[key];
    const live = liveResponses[key] || {};
    const localDigest = localBody === undefined || localBody === null ? null : sha256(localBody);
    const liveDigest = live.body === undefined || live.body === null ? null : sha256(live.body);
    const expectedDigest = String(artifact?.sha256 || "").trim().toLowerCase();
    const statusCode = Number(live.statusCode) || 0;
    const contentType = String(live.contentType || "").trim().toLowerCase();
    const expectedURL = baseURL && artifact?.publicPath
      ? `${baseURL}${artifact.publicPath}`
      : null;
    const checks = {
      localApprovedHash: Boolean(expectedDigest) && localDigest === expectedDigest,
      canonicalHTTPSURL: Boolean(expectedURL),
      directHTTP200: statusCode === 200,
      htmlContentType: contentType.startsWith("text/html"),
      liveApprovedHash: Boolean(expectedDigest) && liveDigest === expectedDigest
    };
    return {
      key,
      version: artifact?.version || null,
      url: expectedURL,
      ready: Object.values(checks).every(Boolean),
      checks,
      statusCode,
      contentType: contentType || null,
      expectedSHA256: expectedDigest || null,
      localSHA256: localDigest,
      liveSHA256: liveDigest,
      error: live.error ? String(live.error) : null
    };
  });

  return {
    schema: "permitext-policy-publication-audit-v1",
    generatedAt: new Date().toISOString(),
    publicBaseURL: baseURL,
    publicationReady: Boolean(baseURL) && routes.length > 0 && routes.every((route) => route.ready),
    routes,
    privacy: {
      documentBodiesEmitted: false,
      customerIdentifiersEmitted: false
    }
  };
}
