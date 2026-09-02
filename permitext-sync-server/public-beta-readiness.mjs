export const publicBetaReleaseGateSchema = "permitext-public-beta-release-gate-record-v2";

export const publicBetaReleaseGateDefinitions = Object.freeze([
  Object.freeze({
    key: "productionDeployment",
    id: "production-deployment",
    releaseBound: true,
    detail: "The exact intended Production deployment must pass configuration, live Stripe, release-identity, and monitoring checks."
  }),
  Object.freeze({
    key: "controlledProductionBilling",
    id: "controlled-production-billing",
    releaseBound: true,
    detail: "The separately authorized Production Stripe charge, cancellation, refund, entitlement, and reconciliation lifecycle must pass."
  }),
  Object.freeze({
    key: "productionAuthentication",
    id: "production-auth-account-lifecycle",
    releaseBound: true,
    detail: "Fresh and existing provider sign-ins plus the dedicated account export/deletion lifecycle must pass on the final deployment."
  }),
  Object.freeze({
    key: "policyPublication",
    id: "exact-policy-publication",
    releaseBound: true,
    detail: "Production must serve the exact approved policy bytes and activate the matching accepted version identifiers."
  }),
  Object.freeze({
    key: "newYorkTax",
    id: "new-york-certificate-stripe-tax",
    releaseBound: false,
    detail: "The New York Certificate of Authority must be received and saved, and the Stripe tax configuration decision must be recorded."
  }),
  Object.freeze({
    key: "monitoringDelivery",
    id: "monitoring-delivery",
    releaseBound: true,
    detail: "The remaining Production alert categories and actual notification delivery must have retained evidence."
  }),
  Object.freeze({
    key: "spendControl",
    id: "spend-notification-hard-stop",
    releaseBound: false,
    detail: "Delivered spend notification and accepted hard-stop/recovery evidence must be retained without uncontrolled usage."
  }),
  Object.freeze({
    key: "zoningResearch",
    id: "zoning-research-beta-limitations-and-clients",
    releaseBound: true,
    detail: "The six known Architecture V2.1 limitations must remain disclosed and fail closed where required, and enabled web/TestFlight physical-iPhone acceptance must pass against the selected release commit before the owner's final Zoning decision."
  }),
  Object.freeze({
    key: "productionClients",
    id: "production-web-testflight-iphone",
    releaseBound: true,
    detail: "Production web and the final TestFlight build must be verified on a physical iPhone against the exact intended release commit."
  }),
  Object.freeze({
    key: "ownerGoNoGo",
    id: "owner-go-no-go",
    releaseBound: true,
    dependsOnPriorGates: true,
    detail: "The owner must record the final go/no-go decision only after every preceding launch gate passes."
  })
]);

function check(id, ready, detail) {
  return { id, ready: Boolean(ready), detail };
}

function normalizedGitCommit(value) {
  const commit = String(value || "").trim().toLowerCase();
  return /^[a-f0-9]{40}$/.test(commit) ? commit : null;
}

function validTimestamp(value) {
  const timestamp = String(value || "").trim();
  return Boolean(
    timestamp &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) &&
    Number.isFinite(Date.parse(timestamp))
  );
}

function validEvidenceReference(value) {
  const reference = String(value || "").trim();
  if (!/^docs\/[A-Za-z0-9._/-]+\.md(?:#[A-Za-z0-9._-]+)?$/.test(reference)) return false;
  return !reference.split("/").includes("..");
}

function evidenceReady(evidence, definition, expectedGitCommit) {
  if (
    evidence?.complete !== true ||
    !validTimestamp(evidence?.observedAt) ||
    !validEvidenceReference(evidence?.reference)
  ) return false;
  if (!definition.releaseBound) return true;
  return Boolean(expectedGitCommit) && normalizedGitCommit(evidence?.gitCommit) === expectedGitCommit;
}

export function publicBetaReleaseReadiness({
  record = {},
  paidResearchTurnsEnabled = false
} = {}) {
  const expectedGitCommit = normalizedGitCommit(record.expectedGitCommit);
  const checks = [
    check(
      "record-schema",
      record.schema === publicBetaReleaseGateSchema,
      "The public Beta release record must use the current fail-closed schema."
    ),
    check(
      "expected-release-commit",
      Boolean(expectedGitCommit),
      "Record the exact 40-character Git commit selected for the final Production and TestFlight release."
    )
  ];

  const priorGateChecks = [];
  for (const definition of publicBetaReleaseGateDefinitions) {
    let ready = evidenceReady(record.gates?.[definition.key], definition, expectedGitCommit);
    if (definition.dependsOnPriorGates) {
      ready = ready && priorGateChecks.every((item) => item.ready);
    }
    const gateCheck = check(definition.id, ready, definition.detail);
    checks.push(gateCheck);
    priorGateChecks.push(gateCheck);
  }

  checks.push(check(
    "additional-research-turns-disabled",
    paidResearchTurnsEnabled !== true,
    "Additional paid Research turns must remain disabled for the initial public Beta."
  ));

  const openGateIDs = checks.filter((item) => !item.ready).map((item) => item.id);
  return {
    schema: "permitext-public-beta-readiness-v2",
    generatedAt: new Date().toISOString(),
    ready: openGateIDs.length === 0,
    expectedGitCommit,
    checks,
    openGateIDs,
    privacy: {
      evidenceContentsEmitted: false,
      secretValuesEmitted: false,
      customerIdentifiersEmitted: false
    }
  };
}
