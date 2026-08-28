const ephemeralSummaryTables = new Set([
  "sessions",
  "legacySessions",
  "accountSessions"
]);

function normalizedBaseURL(value, label) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new Error(`${label} must be an absolute URL.`);
  }
  if (url.protocol !== "https:" && !["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    throw new Error(`${label} must use HTTPS unless it is a loopback rehearsal.`);
  }
  return url.origin;
}

function canonicalObject(value) {
  if (Array.isArray(value)) return value.map(canonicalObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalObject(value[key])])
  );
}

function differencePaths(left, right, prefix = "") {
  if (Object.is(left, right)) return [];
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return [`${prefix || "root"}.length`];
    return left.flatMap((value, index) =>
      differencePaths(value, right[index], `${prefix || "root"}[${index}]`)
    );
  }
  if (
    !left || !right ||
    typeof left !== "object" || typeof right !== "object" ||
    Array.isArray(left) || Array.isArray(right)
  ) {
    return [prefix || "root"];
  }
  const differences = [];
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of Array.from(keys).sort()) {
    const path = prefix ? `${prefix}.${key}` : key;
    differences.push(...differencePaths(left[key], right[key], path));
  }
  return differences;
}

function durableSummary(summary = {}) {
  return canonicalObject({
    storage: summary.storage || null,
    schema: summary.schema || null,
    latestEventID: Number(summary.latestEventID || 0),
    tables: Object.fromEntries(
      Object.entries(summary.tables || {})
        .filter(([key]) => !ephemeralSummaryTables.has(key))
        .map(([key, value]) => [key, Number(value || 0)])
    ),
    mutationCounts: Object.fromEntries(
      Object.entries(summary.mutationCounts || {}).map(([key, value]) => [key, Number(value || 0)])
    )
  });
}

function representativeChecklist(checklist = {}) {
  return canonicalObject({
    hasAccount: Boolean(checklist.hasAccount),
    authProvider: checklist.authProvider || null,
    publicUsername: checklist.publicUsername || null,
    displayName: checklist.displayName || null,
    entitlement: checklist.entitlement || null,
    passkeyCredentialCount: Number(checklist.passkeyCredentialCount || 0),
    mutationCounts: checklist.mutationCounts || {},
    researchConversationCount: Number(checklist.researchConversationCount || 0),
    researchAnswerCount: Number(checklist.researchAnswerCount || 0),
    artifactCounts: checklist.artifactCounts || {},
    projectLinkCount: Number(checklist.projectLinkCount || 0),
    activityEventCount: Number(checklist.activityEventCount || 0)
  });
}

export function compareRestoreDrillEvidence({
  sourceSummary,
  targetSummary,
  sourceChecklist,
  targetChecklist,
  sourceAssetCount,
  targetAssetCount
}) {
  const summaryDifferences = differencePaths(
    durableSummary(sourceSummary),
    durableSummary(targetSummary),
    "summary"
  );
  const checklistDifferences = differencePaths(
    representativeChecklist(sourceChecklist),
    representativeChecklist(targetChecklist),
    "representativeAccount"
  );
  const assetCountsProvided = Number.isSafeInteger(sourceAssetCount) && sourceAssetCount >= 0 &&
    Number.isSafeInteger(targetAssetCount) && targetAssetCount >= 0;
  const assetDifferences = !assetCountsProvided
    ? ["assets.inventoryCountRequired"]
    : sourceAssetCount === targetAssetCount
      ? []
      : ["assets.objectCount"];
  const mismatches = [...summaryDifferences, ...checklistDifferences, ...assetDifferences];
  return {
    pass: mismatches.length === 0,
    mismatches,
    comparedDurableTableCount: Object.keys(durableSummary(sourceSummary).tables).length,
    assetCountsProvided,
    sourceAssetCount: assetCountsProvided ? sourceAssetCount : null,
    targetAssetCount: assetCountsProvided ? targetAssetCount : null
  };
}

async function requestJSON(fetchImpl, baseURL, path, { method = "GET", token, body } = {}) {
  const response = await fetchImpl(`${baseURL}${path}`, {
    method,
    signal: AbortSignal.timeout(15_000),
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}: ${text.slice(0, 200)}`);
  }
  return text ? JSON.parse(text) : {};
}

export async function verifyRestoreDrill({
  sourceBaseURL,
  targetBaseURL,
  sourceAdminToken,
  targetAdminToken,
  representativeUserID,
  targetIsolated = false,
  providerWritesDisabled = false,
  expectedTargetStorage = "postgres",
  sourceAssetCount,
  targetAssetCount,
  sourceAssetInventoryTimestamp = null,
  fetchImpl = fetch
}) {
  const sourceURL = normalizedBaseURL(sourceBaseURL, "Source URL");
  const targetURL = normalizedBaseURL(targetBaseURL, "Target URL");
  if (sourceURL === targetURL) {
    throw new Error("Source and isolated restore must use different origins.");
  }
  if (!String(sourceAdminToken || "").trim() || !String(targetAdminToken || "").trim()) {
    throw new Error("Both source and target administrator tokens are required.");
  }
  if (!String(representativeUserID || "").trim()) {
    throw new Error("A representative test account user ID is required.");
  }
  if (!targetIsolated) {
    throw new Error("Set the explicit isolated-target attestation before running the restore verifier.");
  }
  if (!providerWritesDisabled) {
    throw new Error("Confirm billing, email, notification, and Research provider writes are disabled.");
  }
  if (!String(sourceAssetInventoryTimestamp || "").trim()) {
    throw new Error("A source private-asset inventory timestamp is required.");
  }
  const assetInventoryTime = Date.parse(sourceAssetInventoryTimestamp);
  if (!Number.isFinite(assetInventoryTime) || assetInventoryTime > Date.now() + 5 * 60_000) {
    throw new Error("The source private-asset inventory timestamp must be a valid non-future time.");
  }

  const [sourceHealth, targetHealth, sourceRelease, targetRelease, sourceSummary, targetSummary,
    sourceChecklist, targetChecklist] = await Promise.all([
    requestJSON(fetchImpl, sourceURL, "/health", { token: sourceAdminToken }),
    requestJSON(fetchImpl, targetURL, "/health", { token: targetAdminToken }),
    requestJSON(fetchImpl, sourceURL, "/release", { token: sourceAdminToken }),
    requestJSON(fetchImpl, targetURL, "/release", { token: targetAdminToken }),
    requestJSON(fetchImpl, sourceURL, "/admin/storage/summary", { token: sourceAdminToken }),
    requestJSON(fetchImpl, targetURL, "/admin/storage/summary", { token: targetAdminToken }),
    requestJSON(fetchImpl, sourceURL, "/admin/accounts/restore-checklist", {
      method: "POST",
      token: sourceAdminToken,
      body: { userID: representativeUserID }
    }),
    requestJSON(fetchImpl, targetURL, "/admin/accounts/restore-checklist", {
      method: "POST",
      token: targetAdminToken,
      body: { userID: representativeUserID }
    })
  ]);

  const comparison = compareRestoreDrillEvidence({
    sourceSummary,
    targetSummary,
    sourceChecklist,
    targetChecklist,
    sourceAssetCount,
    targetAssetCount
  });
  const policyMismatches = [];
  if (targetRelease.release?.environment === "production") {
    policyMismatches.push("target.release.environment");
  }
  if (expectedTargetStorage && targetSummary.storage !== expectedTargetStorage) {
    policyMismatches.push("target.storage.expectedKind");
  }
  if (targetHealth.storage !== targetSummary.storage) {
    policyMismatches.push("target.storage.healthSummaryAgreement");
  }
  if (sourceHealth.storage !== sourceSummary.storage) {
    policyMismatches.push("source.storage.healthSummaryAgreement");
  }
  const sourceCommit = sourceRelease.release?.gitCommit || null;
  const targetCommit = targetRelease.release?.gitCommit || null;
  if (sourceCommit && targetCommit && sourceCommit !== targetCommit) {
    policyMismatches.push("release.gitCommit");
  }
  const mismatches = [...comparison.mismatches, ...policyMismatches];
  return {
    pass: mismatches.length === 0,
    mismatches,
    targetIsolationAttested: true,
    providerWritesDisabledAttested: true,
    sourceAssetInventoryTimestamp: new Date(assetInventoryTime).toISOString(),
    comparedDurableTableCount: comparison.comparedDurableTableCount,
    source: {
      origin: sourceURL,
      storage: sourceSummary.storage,
      schema: sourceSummary.schema,
      latestEventID: Number(sourceSummary.latestEventID || 0),
      releaseID: sourceRelease.release?.releaseID || null,
      gitCommit: sourceCommit,
      privateAssetCount: comparison.sourceAssetCount
    },
    target: {
      origin: targetURL,
      storage: targetSummary.storage,
      schema: targetSummary.schema,
      latestEventID: Number(targetSummary.latestEventID || 0),
      releaseID: targetRelease.release?.releaseID || null,
      gitCommit: targetCommit,
      privateAssetCount: comparison.targetAssetCount
    }
  };
}
