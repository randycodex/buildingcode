import { createHash, timingSafeEqual } from "node:crypto";

export const codeQuestionRolloutChannels = Object.freeze([
  "disabled",
  "local",
  "pilot",
  "broad"
]);

export const codeQuestionRolloutEventNames = Object.freeze([
  "question.created",
  "evidence.approved",
  "analysis.completed",
  "analysis.stale-detected",
  "review.resolved",
  "issue.completed",
  "issue.failed",
  "promotion.completed",
  "promotion.ambiguous",
  "offline.reconnected",
  "offline.conflict",
  "legacy.opened"
]);

export const codeQuestionRolloutGateNames = Object.freeze([
  "contracts",
  "existing-suites",
  "browser",
  "ios",
  "accessibility",
  "privacy",
  "source-rights",
  "retention-deletion",
  "security",
  "rollback",
  "legacy-discovery",
  "professional-pilot",
  "release-policy",
  "pushed-sha",
  "deployment",
  "production-client",
  "real-lifecycle"
]);

export const codeQuestionPilotThresholds = Object.freeze({
  minimumSyntheticCases: 2,
  minimumVerifiedContentCases: 1,
  requiredCitationResolutionRate: 1,
  requiredIssuedRecordTraceabilityRate: 1,
  requiredLegacyDiscoverabilityRate: 1,
  maximumSeverityOneDefects: 0,
  maximumDataLossEvents: 0
});

const rolloutEventSet = new Set(codeQuestionRolloutEventNames);
const rolloutGateSet = new Set(codeQuestionRolloutGateNames);
const allowedEventKeys = new Set([
  "event",
  "accountID",
  "projectID",
  "questionID",
  "stage",
  "outcome",
  "durationMs",
  "count",
  "retryCount",
  "conflictCount",
  "errorClass",
  "capabilityState",
  "at"
]);
const forbiddenContentKey = /(text|title|address|fact|assumption|unknown|evidence|passage|quote|citation|conclusion|reasoning|comment|report|memo|source|prompt|answer|email|name)/i;

function text(value, maximum = 160) {
  return String(value ?? "").trim().slice(0, maximum);
}

function positiveInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function commaSeparatedIDs(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function constantTimeIncludes(values, candidate) {
  const normalized = Buffer.from(text(candidate, 512));
  if (!normalized.length) return false;
  return values.some((value) => {
    const expected = Buffer.from(text(value, 512));
    return expected.length === normalized.length && timingSafeEqual(expected, normalized);
  });
}

export function codeQuestionRolloutAccess({
  environment = process.env,
  userID = "",
  requestOverride = false,
  isLoopback = false
} = {}) {
  if (requestOverride === true && isLoopback === true) {
    return Object.freeze({ enabled: true, channel: "local", reason: "loopback-debug-override" });
  }
  if (String(environment.PERMITEXT_CODE_QUESTION_WORKSPACE || "").trim() !== "1") {
    return Object.freeze({ enabled: false, channel: "disabled", reason: "feature-flag-disabled" });
  }
  const pilotIDs = commaSeparatedIDs(environment.PERMITEXT_CODE_QUESTION_PILOT_USER_IDS);
  if (pilotIDs.length && !constantTimeIncludes(pilotIDs, userID)) {
    return Object.freeze({ enabled: false, channel: "pilot", reason: "account-not-selected" });
  }
  return Object.freeze({
    enabled: true,
    channel: pilotIDs.length ? "pilot" : "broad",
    reason: pilotIDs.length ? "selected-pilot-account" : "explicit-broad-flag"
  });
}

export function anonymizedRolloutID(value, salt) {
  const normalizedValue = text(value, 512);
  const normalizedSalt = text(salt, 512);
  if (!normalizedValue || normalizedSalt.length < 16) {
    throw new TypeError("Rollout identifiers require a value and a salt of at least 16 characters.");
  }
  return createHash("sha256")
    .update(`${normalizedSalt}:${normalizedValue}`)
    .digest("hex")
    .slice(0, 20);
}

export function privacySafeCodeQuestionRolloutEvent(value, { salt } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Rollout event must be an object.");
  }
  for (const key of Object.keys(value)) {
    if (!allowedEventKeys.has(key) || forbiddenContentKey.test(key)) {
      throw new TypeError(`Rollout event field is not permitted: ${key}`);
    }
  }
  const event = text(value.event, 80);
  if (!rolloutEventSet.has(event)) throw new TypeError(`Unsupported rollout event: ${event}`);
  const stage = text(value.stage, 40);
  if (stage && !["define", "evidence", "analyze", "review", "issue", "legacy", "offline"].includes(stage)) {
    throw new TypeError(`Unsupported rollout stage: ${stage}`);
  }
  const capabilityState = text(value.capabilityState, 24) || "pilot";
  if (!codeQuestionRolloutChannels.includes(capabilityState)) {
    throw new TypeError(`Unsupported rollout capability state: ${capabilityState}`);
  }
  const output = {
    event: `code_question.${event}`,
    capabilityState,
    at: Number.isFinite(Date.parse(value.at || "")) ? new Date(value.at).toISOString() : new Date().toISOString()
  };
  for (const [source, target] of [["accountID", "account"], ["projectID", "project"], ["questionID", "question"]]) {
    if (text(value[source], 512)) output[target] = anonymizedRolloutID(value[source], salt);
  }
  if (stage) output.stage = stage;
  if (text(value.outcome, 80)) output.outcome = text(value.outcome, 80);
  if (text(value.errorClass, 80)) output.errorClass = text(value.errorClass, 80).replace(/[^a-zA-Z0-9_.:-]/g, "-");
  for (const key of ["durationMs", "count", "retryCount", "conflictCount"]) {
    if (value[key] !== undefined) output[key] = positiveInteger(value[key]);
  }
  return Object.freeze(output);
}

export function evaluateCodeQuestionRolloutReadiness({
  gates = {},
  metrics = {},
  severityOneDefects = [],
  thresholds = codeQuestionPilotThresholds
} = {}) {
  const normalizedGates = Object.fromEntries(codeQuestionRolloutGateNames.map((name) => [
    name,
    gates[name] === true ? "pass" : gates[name] === false ? "fail" : "pending"
  ]));
  const unknownGates = Object.keys(gates).filter((name) => !rolloutGateSet.has(name));
  if (unknownGates.length) throw new TypeError(`Unknown rollout gates: ${unknownGates.join(", ")}`);

  const metricChecks = Object.freeze({
    syntheticCases: positiveInteger(metrics.syntheticCases) >= thresholds.minimumSyntheticCases,
    verifiedContentCases: positiveInteger(metrics.verifiedContentCases) >= thresholds.minimumVerifiedContentCases,
    citationResolution: Number(metrics.citationResolutionRate) >= thresholds.requiredCitationResolutionRate,
    issuedRecordTraceability: Number(metrics.issuedRecordTraceabilityRate) >= thresholds.requiredIssuedRecordTraceabilityRate,
    legacyDiscoverability: Number(metrics.legacyDiscoverabilityRate) >= thresholds.requiredLegacyDiscoverabilityRate,
    dataLoss: positiveInteger(metrics.dataLossEvents) <= thresholds.maximumDataLossEvents
  });
  const localGateNames = [
    "contracts", "existing-suites", "browser", "ios", "accessibility", "privacy",
    "source-rights", "retention-deletion", "security", "rollback", "legacy-discovery"
  ];
  const externalGateNames = [
    "professional-pilot", "release-policy", "pushed-sha", "deployment", "production-client", "real-lifecycle"
  ];
  const defects = Array.isArray(severityOneDefects) ? severityOneDefects.filter(Boolean) : [];
  const localReady = localGateNames.every((name) => normalizedGates[name] === "pass") &&
    Object.values(metricChecks).every(Boolean) &&
    defects.length <= thresholds.maximumSeverityOneDefects;
  const broadReady = localReady && externalGateNames.every((name) => normalizedGates[name] === "pass");
  const failedGates = Object.entries(normalizedGates).filter(([, state]) => state === "fail").map(([name]) => name);
  const pendingGates = Object.entries(normalizedGates).filter(([, state]) => state === "pending").map(([name]) => name);

  return Object.freeze({
    status: broadReady ? "broad-ready" : localReady ? "local-ready" : "blocked",
    localReady,
    broadReady,
    defaultEnabled: broadReady,
    gates: Object.freeze(normalizedGates),
    metricChecks,
    failedGates: Object.freeze(failedGates),
    pendingGates: Object.freeze(pendingGates),
    severityOneDefects: Object.freeze([...defects])
  });
}

export function rehearseNonDestructiveCodeQuestionRollback(snapshot = {}) {
  const artifacts = Array.isArray(snapshot.artifacts) ? snapshot.artifacts : [];
  const legacyItems = Array.isArray(snapshot.legacyItems) ? snapshot.legacyItems : [];
  const serializedBefore = JSON.stringify({ artifacts, legacyItems });
  const result = {
    capability: { enabled: false, channel: "disabled" },
    navigation: { codeQuestionsVisible: false, legacyVisible: true },
    artifacts,
    legacyItems,
    recovery: "reenable-capability-with-same-records"
  };
  if (JSON.stringify({ artifacts: result.artifacts, legacyItems: result.legacyItems }) !== serializedBefore) {
    throw new Error("Rollback rehearsal altered stored records.");
  }
  return Object.freeze(result);
}
