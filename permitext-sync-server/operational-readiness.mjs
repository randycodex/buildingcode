import { createHash } from "node:crypto";

function compactText(value, maximumLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

function redactedErrorText(value, maximumLength = 500) {
  return compactText(value, maximumLength)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[token]")
    .replace(/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9_-]+\b/g, "[provider-key]")
    .replace(/\bwhsec_[A-Za-z0-9_-]+\b/g, "[webhook-secret]")
    .replace(/([?&](?:token|code|state|key|secret|session|authorization)=)[^&#\s]+/gi, "$1[redacted]");
}

function safePath(value) {
  const normalized = compactText(value, 500);
  if (!normalized) return null;
  try {
    const url = new URL(normalized, "https://permitext.invalid");
    return `${url.pathname || "/"}`.slice(0, 300);
  } catch {
    return normalized.split(/[?#]/, 1)[0].slice(0, 300) || null;
  }
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function releaseIdentity(environment = process.env) {
  const gitCommit = compactText(
    environment.PERMITEXT_GIT_COMMIT || environment.VERCEL_GIT_COMMIT_SHA || environment.GITHUB_SHA,
    64
  );
  const explicitReleaseID = compactText(environment.PERMITEXT_RELEASE_ID, 80);
  const deploymentHost = compactText(
    environment.VERCEL_URL || environment.VERCEL_PROJECT_PRODUCTION_URL,
    255
  ).replace(/^https?:\/\//i, "").split(/[/?#]/, 1)[0] || null;
  const releaseID = explicitReleaseID || gitCommit.slice(0, 12) || "local";
  return {
    releaseID,
    gitCommit: gitCommit || null,
    environment: compactText(environment.VERCEL_ENV || environment.NODE_ENV, 40) || "local",
    deploymentHost,
    buildTimestamp: compactText(environment.PERMITEXT_BUILD_TIMESTAMP, 40) || null
  };
}

export function productionReleaseReadiness(environment = process.env) {
  const release = releaseIdentity(environment);
  const errors = [];
  if (!/^[a-f0-9]{7,64}$/i.test(release.gitCommit || "")) {
    errors.push(
      "A Git commit is required. Enable Vercel System Environment Variables or set PERMITEXT_GIT_COMMIT to the exact deployed SHA."
    );
  }
  if (!release.deploymentHost) {
    errors.push("A Vercel deployment host is required for production release diagnostics.");
  }
  return {
    ready: errors.length === 0,
    errors,
    release
  };
}

export function operationalMonitoringReadiness(environment = process.env) {
  const monitoringProvider = compactText(environment.PERMITEXT_MONITORING_PROVIDER, 80) || null;
  return {
    structuredRuntimeLogs: true,
    clientErrorReporting: true,
    slowRequestThresholdMilliseconds: positiveInteger(environment.PERMITEXT_SLOW_REQUEST_MS) || 2_000,
    externalAlertsConfigured: Boolean(monitoringProvider),
    monitoringProvider
  };
}

export function sanitizedClientErrorReport(input, environment = process.env) {
  const release = releaseIdentity(environment);
  const kind = ["error", "unhandledrejection", "startup"].includes(input?.kind)
    ? input.kind
    : "error";
  const name = redactedErrorText(input?.name, 80) || "Error";
  const message = redactedErrorText(input?.message) || "Client error without a message";
  const source = safePath(input?.source);
  const route = safePath(input?.route);
  const fingerprint = createHash("sha256")
    .update([kind, name, message, source || "", route || ""].join("\u0000"))
    .digest("hex")
    .slice(0, 24);
  return {
    event: "client_error",
    kind,
    name,
    message,
    source,
    route,
    line: positiveInteger(input?.line),
    column: positiveInteger(input?.column),
    fingerprint,
    releaseID: release.releaseID,
    gitCommit: release.gitCommit,
    observedAt: new Date().toISOString()
  };
}

export function sanitizedServerErrorReport(error, context = {}, environment = process.env) {
  const release = releaseIdentity(environment);
  const name = redactedErrorText(error?.name, 80) || "Error";
  const message = redactedErrorText(error?.message || error) || "Server error without a message";
  const route = compactText(context.route, 120) || "unknown";
  const fingerprint = createHash("sha256")
    .update([name, message, route].join("\u0000"))
    .digest("hex")
    .slice(0, 24);
  return {
    event: "request_error",
    name,
    message,
    route,
    method: compactText(context.method, 12).toUpperCase() || "UNKNOWN",
    requestID: compactText(context.requestID, 120) || null,
    fingerprint,
    releaseID: release.releaseID,
    gitCommit: release.gitCommit,
    observedAt: new Date().toISOString()
  };
}

export function sanitizedRequestObservation(input, environment = process.env) {
  const release = releaseIdentity(environment);
  const statusCode = Number.isInteger(Number(input?.statusCode))
    ? Math.max(0, Math.min(999, Number(input.statusCode)))
    : 0;
  const durationMilliseconds = Math.max(0, Math.round(Number(input?.durationMilliseconds) || 0));
  const severity = statusCode >= 500
    ? "error"
    : statusCode >= 400 || durationMilliseconds >= 2_000
      ? "warning"
      : "info";
  return {
    event: "dynamic_route_observation",
    severity,
    route: compactText(input?.route, 120) || "unknown",
    method: compactText(input?.method, 12).toUpperCase() || "UNKNOWN",
    statusCode,
    durationMilliseconds,
    requestID: compactText(input?.requestID, 120) || null,
    releaseID: release.releaseID,
    gitCommit: release.gitCommit,
    deploymentHost: release.deploymentHost,
    environment: release.environment,
    observedAt: new Date().toISOString()
  };
}
