const legacyBase = "permitext:webWorkspace:v1";
const legacyRegistry = "permitext:webWorkspaces:v2";
const legacyLayoutPrefix = "permitext:webWorkspace:v2:";
const migrationKey = "permitext:privateWorkspaceMigration:v1";

function migrationMarker(storage) {
  try { return JSON.parse(storage.getItem(migrationKey) || "null"); }
  catch { return { version: 1, status: "quarantined", reason: "unreadable-marker" }; }
}

export function privateWorkspaceMigrationStatus(storage) {
  const marker = migrationMarker(storage);
  return marker ? { status: marker.status || "complete", reason: marker.reason || null } : { status: "pending", reason: null };
}

function privateOwnerIDs(value, result = new Set()) {
  if (!value || typeof value !== "object") return result;
  for (const [key, item] of Object.entries(value)) {
    if (["userID", "accountUserID", "ownerUserID"].includes(key) && typeof item === "string" && item.trim()) result.add(item.trim());
    else if (item && typeof item === "object") privateOwnerIDs(item, result);
  }
  return result;
}

export function privateWorkspacePrefix(accountUserID = "") {
  return accountUserID
    ? `permitext:account-workspace:${encodeURIComponent(accountUserID)}:`
    : "permitext:guest-workspace:";
}

export function privateWorkspaceKeys(accountUserID = "", detachedSessionID = "") {
  const prefix = privateWorkspacePrefix(accountUserID);
  const baseWorkspaceKey = `${prefix}${legacyBase}`;
  return {
    baseWorkspaceKey,
    workspaceRegistryKey: `${prefix}${legacyRegistry}`,
    workspaceStateKeyPrefix: `${prefix}${legacyLayoutPrefix}`,
    tabWorkspaceKey: `${prefix}permitext:webWorkspaceTab:v1`,
    activeWorkspaceSessionKey: `${prefix}permitext:webWorkspaceActive:v2`,
    workspaceKey: detachedSessionID ? `${baseWorkspaceKey}:detached:${detachedSessionID}` : baseWorkspaceKey
  };
}

export function confirmedAccountLinkRecovery(receipt, sourceUserID, targetUserID) {
  if (!sourceUserID || !targetUserID || sourceUserID === targetUserID ||
      receipt?.sourceUserID !== sourceUserID || receipt?.targetUserID !== targetUserID) {
    throw new Error("The confirmed account link does not match the source and destination.");
  }
  return { sourceUserID, targetUserID, confirmedAt: new Date().toISOString(), access: "export-only" };
}

function accountLinkRecoveryKey(targetUserID) {
  if (!targetUserID) throw new Error("An account is required to read linked-account recovery.");
  return `${privateWorkspacePrefix(targetUserID)}confirmed-link-recovery:v1`;
}

export function accountLinkRecoverySources(storage, targetUserID) {
  const entries = JSON.parse(storage.getItem(accountLinkRecoveryKey(targetUserID)) || "[]");
  if (!Array.isArray(entries)) throw new Error("The account recovery index could not be read.");
  return entries.filter((entry) => entry?.targetUserID === targetUserID &&
    entry.sourceUserID && entry.sourceUserID !== targetUserID && entry.access === "export-only");
}

export function recordConfirmedAccountLinkRecovery(storage, receipt, sourceUserID, targetUserID) {
  const entry = confirmedAccountLinkRecovery(receipt, sourceUserID, targetUserID);
  const current = accountLinkRecoverySources(storage, targetUserID);
  storage.setItem(accountLinkRecoveryKey(targetUserID), JSON.stringify([
    ...current.filter((item) => item.sourceUserID !== sourceUserID), entry
  ]));
  return entry;
}

export function privateWorkspaceRecoverySnapshot(storage, sourceUserID) {
  if (!sourceUserID) throw new Error("A source account is required to export private work.");
  const prefix = privateWorkspacePrefix(sourceUserID);
  return Object.fromEntries(Object.keys(storage).filter((key) => key.startsWith(prefix)).map((key) => {
    const raw = storage.getItem(key);
    // Export private work without serializing reusable sign-in credentials.
    let value;
    try {
      value = JSON.parse(raw, (field, item) => /^(sessionToken|backendSessionToken|accessToken|refreshToken|idToken|identityToken|authorization)$/i.test(field) ? undefined : item);
    } catch {
      value = { unreadable: true, retainedInSourceStorage: true };
    }
    return [key.slice(prefix.length), value];
  }));
}

// Bind the old, single-account workspace once to its persisted account. Copy
// before removing anything; quota/write failures leave every original intact.
export function migrateLegacyPrivateWorkspace(storage, accountUserID = "") {
  if (storage.getItem(migrationKey)) {
    // The marker only needs to prevent a second migration. Older local builds
    // included the account ID; discard it without reopening migration.
    const marker = migrationMarker(storage);
    storage.setItem(migrationKey, JSON.stringify({ version: 1, ...(marker?.status ? { status: marker.status } : {}), ...(marker?.reason ? { reason: marker.reason } : {}) }));
    return false;
  }
  const prefix = privateWorkspacePrefix(accountUserID);
  const entries = Object.keys(storage).filter((key) =>
    key === legacyBase || key === legacyRegistry || key.startsWith(legacyLayoutPrefix) ||
    key.startsWith(`${legacyBase}:detached:`)
  ).map((key) => [key, storage.getItem(key)]);
  let quarantineReason = "";
  if (entries.length) {
    if (!accountUserID) quarantineReason = "owner-unverified";
    else {
      try {
        const parsed = entries.map(([key, value]) => [key, JSON.parse(value)]);
        const owners = parsed.reduce((result, [, value]) => privateOwnerIDs(value, result), new Set());
        const workspace = parsed.find(([key]) => key === legacyBase)?.[1];
        const workspaceOwner = workspace?.account?.userID || workspace?.accountUserID || "";
        if ([...owners].some((owner) => owner !== accountUserID)) quarantineReason = "ownership-mismatch";
        else if (workspaceOwner !== accountUserID) quarantineReason = "workspace-owner-unverified";
      } catch {
        quarantineReason = "unreadable-legacy-data";
      }
    }
  }
  // An interrupted copy can leave a usable account namespace before its
  // migration marker is durable. If that namespace has since changed, neither
  // version may replace the other. Check every destination before copying any
  // entry so the originals remain a complete, recoverable snapshot.
  if (!quarantineReason && entries.some(([key, value]) => {
    const destination = storage.getItem(`${prefix}${key}`);
    return destination !== null && destination !== value;
  })) quarantineReason = "destination-conflict";
  if (quarantineReason) {
    // Preserve the exact original bytes at their retired keys. New workspaces
    // never read these keys; signing into another account does not reopen this
    // decision. Recovery requires an explicit review of ownership.
    storage.setItem(migrationKey, JSON.stringify({ version: 1, status: "quarantined", reason: quarantineReason }));
    return false;
  }
  for (const [key, value] of entries) {
    if (storage.getItem(`${prefix}${key}`) === null) storage.setItem(`${prefix}${key}`, value);
  }
  storage.setItem(migrationKey, JSON.stringify({ version: 1 }));
  for (const [key] of entries) storage.removeItem(key);
  return true;
}

export function removePrivateWorkspace(storage, accountUserID) {
  if (!accountUserID) throw new Error("An account is required to remove private work.");
  const prefix = privateWorkspacePrefix(accountUserID);
  Object.keys(storage).filter((key) => key.startsWith(prefix)).forEach((key) => storage.removeItem(key));
  if (storage.getItem(migrationKey)) {
    const marker = migrationMarker(storage);
    storage.setItem(migrationKey, JSON.stringify({ version: 1, ...(marker?.status ? { status: marker.status } : {}), ...(marker?.reason ? { reason: marker.reason } : {}) }));
  }
}

export function accountRequestIdentity(account, generation) {
  return { userID: account?.userID || "", sessionToken: account?.sessionToken || "", generation };
}

export function accountRequestIsCurrent(identity, account, generation) {
  return Boolean(identity && identity.generation === generation &&
    identity.userID === (account?.userID || "") && identity.sessionToken === (account?.sessionToken || ""));
}

export function accountContextChangedError() {
  const error = new Error("The account session changed. Reopen this action in the current account.");
  error.name = "AbortError";
  error.code = "ACCOUNT_CONTEXT_CHANGED";
  return error;
}
