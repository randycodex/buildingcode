export const freePlanLimits = Object.freeze({
  savedItems: 25,
  notes: 10,
  projects: 0
});

export const entitlementPackageIDs = Object.freeze({
  pro: "pro",
  research: "research"
});

const fullAccessSources = new Set(["lifetimeGrant", "debugOverride"]);

function mutationEntry(mutation) {
  const [kind, record] = Object.entries(mutation || {})[0] || [];
  return { kind, record: record || {} };
}

function recordID(mutation) {
  const { kind, record } = mutationEntry(mutation);
  if (kind === "continuity") {
    return [record.userID, "continuity", record.codeVersion].join(":");
  }
  if (kind === "codeVersionClear") {
    return [record.userID, "code-version-clear", record.codeVersion, record.values?.scope]
      .filter(Boolean)
      .join(":");
  }
  return record.id || null;
}

function isDeleted(record) {
  return Number.isFinite(Date.parse(record?.deletedAt || ""));
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasActiveProEntitlement(entitlement, now = Date.now()) {
  if (String(entitlement?.plan || "").toLowerCase() !== "pro") return false;
  const expiration = Date.parse(entitlement?.expiresAt || "");
  return !Number.isFinite(expiration) || expiration > now;
}

export function activeEntitlementAddOn(entitlement, addOnID, now = Date.now()) {
  const addOn = entitlement?.addOns?.[String(addOnID || "")];
  if (!addOn || addOn.enabled === false) return null;
  const expiration = Date.parse(addOn.expiresAt || "");
  return !Number.isFinite(expiration) || expiration > now ? addOn : null;
}

export function researchEntitlementMode(entitlement, now = Date.now()) {
  if (!hasActiveProEntitlement(entitlement, now)) return "unavailable";
  if (activeEntitlementAddOn(entitlement, entitlementPackageIDs.research, now)) return "add-on";
  if (fullAccessSources.has(String(entitlement?.source || ""))) return "included";
  if (entitlement?.legacyResearchIncluded === true) return "legacy-included";

  const explicitPackage = String(
    entitlement?.packageID ||
    entitlement?.provider?.permitextPackage ||
    ""
  ).trim();
  return explicitPackage ? "unavailable" : "legacy-included";
}

export function hasActiveResearchEntitlement(entitlement, now = Date.now()) {
  return researchEntitlementMode(entitlement, now) !== "unavailable";
}

function entitlementProviderMatches(provider, expected = {}) {
  if (expected.source && provider?.source !== expected.source) return false;
  if (expected.providerKey && provider?.provider?.[expected.providerKey] !== expected.providerValue) return false;
  return true;
}

function providerIdentityMatches(existingProvider, incomingProvider) {
  const identityKeys = [
    "stripeSubscriptionID",
    "appleOriginalTransactionID",
    "originalTransactionID"
  ];
  return identityKeys.some((key) =>
    incomingProvider?.[key] &&
    existingProvider?.[key] === incomingProvider[key]
  );
}

function laterPackageExpiration(existingExpiration, incomingExpiration, preserveExisting) {
  if (!preserveExisting) return incomingExpiration || null;
  const existingTime = Date.parse(existingExpiration || "");
  const incomingTime = Date.parse(incomingExpiration || "");
  if (!Number.isFinite(existingTime)) return incomingExpiration || null;
  if (!Number.isFinite(incomingTime) || existingTime > incomingTime) {
    return existingExpiration;
  }
  return incomingExpiration;
}

function providerEventPrecedes(existingProvider, incomingProvider) {
  const existingEventTime = Date.parse(existingProvider?.stripeEventCreatedAt || "");
  const incomingEventTime = Date.parse(incomingProvider?.stripeEventCreatedAt || "");
  return Number.isFinite(existingEventTime) &&
    Number.isFinite(incomingEventTime) &&
    incomingEventTime < existingEventTime;
}

export function entitlementWithPackage(
  existingEntitlement,
  { userID, packageID, source, expiresAt = null, provider = {}, explicitPackage = true, now = new Date() }
) {
  const normalizedPackageID = String(packageID || "").trim();
  if (!Object.values(entitlementPackageIDs).includes(normalizedPackageID)) {
    throw new Error("Unsupported Permitext package.");
  }
  const updatedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const incomingPackageProvider = {
    ...provider,
    ...(explicitPackage ? { permitextPackage: normalizedPackageID } : {})
  };
  const existingPackageProvider = normalizedPackageID === entitlementPackageIDs.pro
    ? existingEntitlement?.provider
    : existingEntitlement?.addOns?.[entitlementPackageIDs.research]?.provider;
  const packageProvider = providerIdentityMatches(existingPackageProvider, incomingPackageProvider)
    ? { ...existingPackageProvider, ...incomingPackageProvider }
    : incomingPackageProvider;

  if (normalizedPackageID === entitlementPackageIDs.pro) {
    if (
      existingEntitlement?.source === source &&
      providerEventPrecedes(existingEntitlement?.provider, packageProvider)
    ) {
      return existingEntitlement;
    }
    const effectiveExpiresAt = laterPackageExpiration(
      existingEntitlement?.expiresAt,
      expiresAt,
      existingEntitlement?.source === source &&
        providerIdentityMatches(existingEntitlement?.provider, packageProvider)
    );
    const entitlement = {
      plan: "pro",
      ...(explicitPackage ? { packageID: entitlementPackageIDs.pro } : {}),
      source,
      grantedUserID: userID,
      updatedAt,
      provider: packageProvider,
      ...(existingEntitlement?.addOns ? { addOns: existingEntitlement.addOns } : {})
    };
    if (effectiveExpiresAt) entitlement.expiresAt = effectiveExpiresAt;
    if (
      existingEntitlement?.legacyResearchIncluded === true ||
      (!explicitPackage && (
        !existingEntitlement ||
        researchEntitlementMode(existingEntitlement, Date.parse(updatedAt)) === "legacy-included"
      ))
    ) {
      entitlement.legacyResearchIncluded = true;
    }
    return entitlement;
  }

  if (!hasActiveProEntitlement(existingEntitlement, Date.parse(updatedAt))) {
    throw new Error("Research requires an active Pro plan.");
  }
  if (
    existingEntitlement?.addOns?.[entitlementPackageIDs.research]?.source === source &&
    providerEventPrecedes(
      existingEntitlement?.addOns?.[entitlementPackageIDs.research]?.provider,
      packageProvider
    )
  ) {
    return existingEntitlement;
  }
  const researchAddOn = {
    enabled: true,
    source,
    updatedAt,
    provider: packageProvider
  };
  const effectiveExpiresAt = laterPackageExpiration(
    existingEntitlement?.addOns?.[entitlementPackageIDs.research]?.expiresAt,
    expiresAt,
    existingEntitlement?.addOns?.[entitlementPackageIDs.research]?.source === source &&
      providerIdentityMatches(
        existingEntitlement?.addOns?.[entitlementPackageIDs.research]?.provider,
        packageProvider
      )
  );
  if (effectiveExpiresAt) researchAddOn.expiresAt = effectiveExpiresAt;
  return {
    ...existingEntitlement,
    updatedAt,
    addOns: {
      ...(existingEntitlement.addOns || {}),
      [entitlementPackageIDs.research]: researchAddOn
    }
  };
}

export function entitlementWithoutPackage(existingEntitlement, packageID, expected = {}, now = new Date()) {
  const normalizedPackageID = String(packageID || "").trim();
  if (!existingEntitlement) return { changed: false, entitlement: null };

  if (normalizedPackageID === entitlementPackageIDs.pro) {
    const candidate = {
      source: existingEntitlement.source,
      provider: existingEntitlement.provider
    };
    return entitlementProviderMatches(candidate, expected)
      ? { changed: true, entitlement: null }
      : { changed: false, entitlement: existingEntitlement };
  }

  if (normalizedPackageID !== entitlementPackageIDs.research) {
    return { changed: false, entitlement: existingEntitlement };
  }
  const addOn = existingEntitlement.addOns?.[entitlementPackageIDs.research];
  if (!addOn || !entitlementProviderMatches(addOn, expected)) {
    return { changed: false, entitlement: existingEntitlement };
  }
  const addOns = { ...(existingEntitlement.addOns || {}) };
  delete addOns[entitlementPackageIDs.research];
  const updatedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  return {
    changed: true,
    entitlement: {
      ...existingEntitlement,
      updatedAt,
      ...(Object.keys(addOns).length ? { addOns } : { addOns: {} })
    }
  };
}

export function freePlanUsage(mutations) {
  const latestByID = new Map();
  for (const mutation of mutations || []) {
    const id = recordID(mutation);
    if (!id) continue;
    const existing = latestByID.get(id);
    const incomingDate = Date.parse(mutationEntry(mutation).record.updatedAt || "");
    const existingDate = Date.parse(mutationEntry(existing).record.updatedAt || "");
    if (!existing || !Number.isFinite(existingDate) || incomingDate >= existingDate) {
      latestByID.set(id, mutation);
    }
  }

  const usage = { savedItems: 0, notes: 0, projects: 0 };
  for (const mutation of latestByID.values()) {
    const { kind, record } = mutationEntry(mutation);
    if (isDeleted(record)) continue;
    if (kind === "savedItem") usage.savedItems += 1;
    if (kind === "annotation" && record.tags === undefined && hasText(record.noteBody)) usage.notes += 1;
    if (kind === "project") usage.projects += 1;
  }
  return usage;
}

export function freePlanMutationDecision({ mutation, existingMutation, entitlement, usage }) {
  if (hasActiveProEntitlement(entitlement)) return { allowed: true };

  const { kind, record } = mutationEntry(mutation);
  if (!kind || isDeleted(record) || kind === "continuity" || kind === "codeVersionClear") {
    return { allowed: true };
  }

  const existingRecord = mutationEntry(existingMutation).record;
  const updatesActiveRecord = Boolean(existingMutation) && !isDeleted(existingRecord);
  const updatesFreeRecord =
    kind === "savedItem" ||
    (kind === "annotation" && record.tags === undefined) ||
    (kind === "project" && record.folderType === "reference") ||
    (kind === "projectSection" && record.folderType === "reference");
  if (updatesActiveRecord && updatesFreeRecord) return { allowed: true };

  if (kind === "savedItem" && usage.savedItems >= freePlanLimits.savedItems) {
    return {
      allowed: false,
      code: "FREE_SAVED_ITEM_LIMIT",
      message: `Free includes up to ${freePlanLimits.savedItems} saved sections. Upgrade to Pro to save more.`
    };
  }
  if (kind === "annotation" && record.tags === undefined && hasText(record.noteBody) && usage.notes >= freePlanLimits.notes) {
    return {
      allowed: false,
      code: "FREE_NOTE_LIMIT",
      message: `Free includes up to ${freePlanLimits.notes} notes. Upgrade to Pro to add more.`
    };
  }
  if (kind === "annotation" && record.tags !== undefined && Array.isArray(record.tags) && record.tags.length > 0) {
    return {
      allowed: false,
      code: "PRO_REQUIRED_ORGANIZATION",
      message: "Tags and advanced organization require Pro."
    };
  }
  if (kind === "project" && record.folderType !== "reference") {
    return {
      allowed: false,
      code: "PRO_REQUIRED_PROJECTS",
      message: "Projects require Pro."
    };
  }
  if (kind === "projectSection" && record.folderType !== "reference") {
    return {
      allowed: false,
      code: "PRO_REQUIRED_PROJECTS",
      message: "Project organization requires Pro."
    };
  }
  if (kind === "workboard") {
    return {
      allowed: false,
      code: "PRO_REQUIRED_WORKBOARDS",
      message: "Workboards require Pro."
    };
  }
  return { allowed: true };
}

export function enforceFreePlanMutationBatch(existingMutations, incomingMutations, entitlement) {
  const workingByID = new Map(
    (existingMutations || [])
      .map((mutation) => [recordID(mutation), mutation])
      .filter(([id]) => Boolean(id))
  );
  const acceptedMutations = [];
  const rejectedMutationIDs = [];
  const rejectionReasons = {};

  for (const mutation of incomingMutations || []) {
    const id = recordID(mutation);
    if (!id) continue;
    const existingMutation = workingByID.get(id);
    const decision = freePlanMutationDecision({
      mutation,
      existingMutation,
      entitlement,
      usage: freePlanUsage(Array.from(workingByID.values()))
    });
    if (!decision.allowed) {
      rejectedMutationIDs.push(id);
      rejectionReasons[id] = { code: decision.code, message: decision.message };
      continue;
    }
    acceptedMutations.push(mutation);
    const incomingUpdatedAt = Date.parse(mutationEntry(mutation).record.updatedAt || "");
    const existingUpdatedAt = Date.parse(mutationEntry(existingMutation).record.updatedAt || "");
    if (!existingMutation || !Number.isFinite(existingUpdatedAt) || incomingUpdatedAt >= existingUpdatedAt) {
      workingByID.set(id, mutation);
    }
  }

  return { acceptedMutations, rejectedMutationIDs, rejectionReasons };
}
