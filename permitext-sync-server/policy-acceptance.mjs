import { createHash, randomUUID } from "node:crypto";

export const policyDocumentDefinitions = Object.freeze([
  Object.freeze({ key: "terms", environmentKey: "PERMITEXT_TERMS_VERSION", path: "/terms" }),
  Object.freeze({ key: "privacy", environmentKey: "PERMITEXT_PRIVACY_VERSION", path: "/privacy" }),
  Object.freeze({
    key: "subscriptionsAndRefunds",
    environmentKey: "PERMITEXT_SUBSCRIPTION_POLICY_VERSION",
    path: "/refunds"
  })
]);

const acceptedPlatforms = new Set(["web", "ios"]);
const maximumAcceptanceHistory = 50;

function normalizedVersion(value) {
  const version = String(value || "").trim();
  return /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(version) ? version : null;
}

function normalizedPublicBaseURL(value) {
  const text = String(value || "").trim().replace(/\/+$/, "");
  if (!text) return null;
  try {
    const url = new URL(text);
    const localHTTP = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !localHTTP) return null;
    if (url.pathname !== "/" || url.search || url.hash) return null;
    return text;
  } catch {
    return null;
  }
}

function policySetID(versions) {
  const canonical = policyDocumentDefinitions
    .map(({ key }) => `${key}:${versions[key] || ""}`)
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 24);
}

export function policyVersionConfiguration(environment = process.env) {
  const publicBaseURL = normalizedPublicBaseURL(environment.PERMITEXT_PUBLIC_BASE_URL);
  const versions = Object.fromEntries(policyDocumentDefinitions.map(({ key, environmentKey }) => [
    key,
    normalizedVersion(environment[environmentKey])
  ]));
  const problems = [];
  if (!publicBaseURL) {
    problems.push("PERMITEXT_PUBLIC_BASE_URL must be the canonical HTTPS URL (or localhost for tests).");
  }
  for (const { key, environmentKey } of policyDocumentDefinitions) {
    if (!versions[key]) {
      problems.push(`${environmentKey} must be a stable approved policy version identifier.`);
    }
  }
  const documents = Object.fromEntries(policyDocumentDefinitions.map(({ key, path }) => [
    key,
    {
      version: versions[key],
      url: publicBaseURL ? `${publicBaseURL}${path}` : null
    }
  ]));
  return {
    ready: problems.length === 0,
    policySetID: policySetID(versions),
    versions,
    documents,
    problems
  };
}

export class PolicyAcceptanceError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "PolicyAcceptanceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizedClientRelease(value) {
  const release = String(value || "").trim();
  return release ? release.slice(0, 128) : null;
}

export function policyAcceptanceRecord(input, options = {}) {
  const configuration = policyVersionConfiguration(options.environment || process.env);
  if (!configuration.ready) {
    throw new PolicyAcceptanceError(
      503,
      "POLICY_ACCEPTANCE_NOT_CONFIGURED",
      "Current approved policy versions are not configured."
    );
  }
  const platform = String(input?.platform || "").trim().toLowerCase();
  if (!acceptedPlatforms.has(platform)) {
    throw new PolicyAcceptanceError(
      400,
      "INVALID_POLICY_ACCEPTANCE_PLATFORM",
      "Policy acceptance must identify the web or iOS client."
    );
  }
  const suppliedVersions = input?.versions && typeof input.versions === "object"
    ? input.versions
    : {};
  const matchesCurrent = policyDocumentDefinitions.every(({ key }) =>
    suppliedVersions[key] === configuration.versions[key]
  );
  if (!matchesCurrent) {
    throw new PolicyAcceptanceError(
      409,
      "POLICY_VERSION_MISMATCH",
      "The policy versions changed. Review the current documents before accepting them."
    );
  }
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  if (!Number.isFinite(now.getTime())) {
    throw new TypeError("Policy acceptance requires a valid server time.");
  }
  return {
    schemaVersion: 1,
    id: String(options.id || randomUUID()),
    policySetID: configuration.policySetID,
    versions: { ...configuration.versions },
    documents: structuredClone(configuration.documents),
    acceptedAt: now.toISOString(),
    platform,
    clientRelease: normalizedClientRelease(input?.clientRelease)
  };
}

function validStoredAcceptance(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    value.schemaVersion === 1 &&
    typeof value.id === "string" &&
    typeof value.policySetID === "string" &&
    Number.isFinite(Date.parse(value.acceptedAt || ""))
  );
}

export function mergedPolicyAcceptances(...collections) {
  const byID = new Map();
  for (const acceptance of collections.flatMap((items) => Array.isArray(items) ? items : [])) {
    if (!validStoredAcceptance(acceptance)) continue;
    byID.set(acceptance.id, structuredClone(acceptance));
  }
  return Array.from(byID.values())
    .sort((left, right) => String(left.acceptedAt).localeCompare(String(right.acceptedAt)))
    .slice(-maximumAcceptanceHistory);
}

export function currentPolicyAcceptance(account, environment = process.env) {
  const configuration = policyVersionConfiguration(environment);
  if (!configuration.ready) return null;
  return mergedPolicyAcceptances(account?.policyAcceptances)
    .findLast((acceptance) => acceptance.policySetID === configuration.policySetID) || null;
}

export function accountWithPolicyAcceptance(account, acceptance) {
  const existing = mergedPolicyAcceptances(account?.policyAcceptances);
  const duplicate = existing.find((candidate) => candidate.policySetID === acceptance.policySetID);
  if (duplicate) {
    return {
      account: { ...(account || {}), policyAcceptances: existing },
      acceptance: duplicate,
      changed: false
    };
  }
  const policyAcceptances = mergedPolicyAcceptances(existing, [acceptance]);
  return {
    account: { ...(account || {}), policyAcceptances },
    acceptance,
    changed: true
  };
}
