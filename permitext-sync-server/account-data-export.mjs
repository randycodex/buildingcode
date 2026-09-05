// Operator-only record export. Keep it independent from the legacy sync snapshot:
// that snapshot does not load Research, Notebook, Report, or organization tables.
const userCollections = Object.freeze({
  foundationArtifacts: "foundationArtifactsByUserID",
  projectLinks: "projectLinksByUserID",
  researchAnswers: "researchAnswersByUserID",
  activityEvents: "activityEventsByUserID",
  researchConversations: "researchConversationsByUserID",
  researchUsage: "researchUsageByUserID",
  researchOperations: "researchOperationsByUserID",
  researchCredits: "researchCreditsByUserID",
  researchFeedback: "researchFeedbackByUserID",
  codeQuestionPendingIssuance: "codeQuestionPendingIssuanceByUserID",
  codeQuestionOutbox: "codeQuestionOutboxByUserID"
});

function withoutCredentials(value) {
  if (!value) return null;
  const result = { ...value };
  for (const key of ["backendSessionToken", "sessionToken", "identityToken", "token", "tokenHash", "token_hash", "invitationToken"]) delete result[key];
  return result;
}

function values(value) {
  return Array.isArray(value) ? value : Object.values(value || {});
}

function validateUserID(userID) {
  if (typeof userID !== "string" || !userID.trim() || userID !== userID.trim() || userID.length > 512) {
    throw new Error("A nonempty exact account identifier is required for export.");
  }
}

function completeExport(userID, data, storage) {
  const account = withoutCredentials(data.account);
  const ownershipReview = accountDeletionOwnershipReview({ userID, records: data.records });
  return {
    schema: "permitext-account-record-export-v2",
    userID,
    account,
    entitlement: data.entitlement || null,
    hasSession: Boolean(data.hasSession),
    passkeyCredentialIDs: data.passkeyCredentialIDs || [],
    mutations: data.mutations || [],
    records: data.records,
    deletionOwnershipReview: ownershipReview,
    scope: {
      storage,
      accountRecords: "Records stored under this account, its owned organization and Project-ownership metadata, and its own memberships and invitations. Stored legacy shared records require ownership review before disposal.",
      otherMembersContentIncluded: ownershipReview.required ? null : false,
      sharedContentReviewRequired: ownershipReview.required,
      authenticationSecretsIncluded: false,
      privateAssetBytesIncluded: false,
      excludedOperationalRecords: "Global operational audit logs, provider replay-protection ledgers, and duplicate sync journals are not part of this content snapshot or its deletion inventory.",
      privateAssets: "Artifact and content records retain private-asset references; separately preserve referenced files for a complete content backup."
    }
  };
}

export function accountRecordExportFromStore(store, userID) {
  validateUserID(userID);
  const records = Object.fromEntries(Object.entries(userCollections).map(([name, key]) =>
    [name, values(store[key]?.[userID])]
  ));
  const ownMemberships = (map) => Object.values(map || {}).flatMap(values)
    .filter((record) => record.userID === userID);
  const lifecycle = store.accountLifecycleByUserID?.[userID];
  records.accountLifecycle = lifecycle && (lifecycle.deletionID || Object.keys(lifecycle.operations || {}).length) ? [lifecycle] : [];
  records.organizations = Object.values(store.organizations || {}).filter((record) => record.ownerUserID === userID);
  records.organizationMemberships = ownMemberships(store.organizationMembershipsByOrganizationID);
  records.projectMemberships = ownMemberships(store.projectMembershipsByProjectID);
  records.organizationInvitations = Object.values(store.organizationInvitationsByID || {})
    .filter((record) => [record.invitedUserID, record.invitedByUserID, record.acceptedByUserID].includes(userID))
    .map(withoutCredentials);
  const ownedOrganizations = new Set(records.organizations.map((record) => record.id));
  records.projectOwnerships = Object.values(store.projectOwnerships || {})
    .filter((record) => record.storageOwnerUserID === userID ||
      (record.owner?.kind === "user" && record.owner.id === userID) ||
      (record.owner?.kind === "organization" && ownedOrganizations.has(record.owner.organizationID || record.owner.id)));
  const sharedRecords = [
    ...Object.values(store.foundationArtifactsByUserID || {}).flatMap(values).map((record) => record.envelope),
    ...["projectLinksByUserID", "activityEventsByUserID", "researchAnswersByUserID", "evidenceSnapshotsByUserID", "commentsByUserID"]
      .flatMap((key) => Object.values(store[key] || {}).flatMap(values)).map((record) => record.comment || record)
  ];
  records.organizationDeletionDependencies = records.organizations.map((organization) => ({
    organizationID: organization.id,
    otherMemberCount: [
      ...values(store.organizationMembershipsByOrganizationID?.[organization.id]),
      ...Object.values(store.projectMembershipsByProjectID || {}).flatMap(values)
        .filter((record) => record.organizationID === organization.id)
    ].filter((record) => record.userID !== userID).length,
    sharedRecordCount: sharedRecords.filter((record) => record?.owner?.kind === "organization" &&
      (record.owner.organizationID || record.owner.id) === organization.id).length
  }));
  records.migrationCheckpoints = Object.entries(store.migrationCheckpointsByUserID?.[userID] || {})
    .map(([name, checkpoint]) => ({ name, checkpoint }));
  records.artifactRevisions = Object.entries(store.artifactRevisionsByUserID?.[userID] || {})
    .map(([key, revision]) => ({ key, revision }));
  records.codeQuestionCounters = Object.entries(store.codeQuestionCountersByUserID?.[userID] || {})
    .map(([key, value]) => ({ key, value }));
  records.sessionMetadata = store.sessions?.[userID] ? [{ kind: "legacy", active: true }] : [];
  records.researchPurchaseClaims = Object.values(store.researchPurchaseClaimsByID || {})
    .filter((claim) => claim.creditedUserID === userID);
  records.comments = values(store.commentsByUserID?.[userID]);
  records.evidenceSnapshots = values(store.evidenceSnapshotsByUserID?.[userID]);
  return completeExport(userID, {
    account: store.users?.[userID],
    entitlement: store.entitlements?.[userID],
    hasSession: Boolean(store.sessions?.[userID]),
    passkeyCredentialIDs: Object.entries(store.passkeyCredentials || {})
      .filter(([, owner]) => owner === userID).map(([id]) => id).sort(),
    mutations: store.mutationsByUserID?.[userID] || [],
    records
  }, "file");
}

// SQL identifiers and predicates come exclusively from this static inventory.
// Only the exact account identifier is supplied by the caller, as parameter $1.
const postgresCollections = Object.freeze([
  ["accountLifecycle", "permitext_account_lifecycle", "jsonb_build_object('operations', t.operations, 'deletionID', t.deletion_id)", "user_id = $1 AND (deletion_id IS NOT NULL OR operations <> '{}'::jsonb)", "user_id"],
  ["foundationArtifacts", "permitext_foundation_artifacts", "jsonb_build_object('envelope', t.envelope, 'payload', t.payload)", "user_id = $1", "id"],
  ["projectLinks", "permitext_project_links", "t.link", "user_id = $1", "id"],
  ["researchAnswers", "permitext_research_answers", "t.answer", "user_id = $1", "id"],
  ["activityEvents", "permitext_project_activity", "t.event", "user_id = $1", "id"],
  ["researchConversations", "permitext_research_conversations", "t.conversation", "user_id = $1", "id"],
  ["researchUsage", "permitext_research_usage", "to_jsonb(t) - 'user_id'", "user_id = $1", "id"],
  ["researchOperations", "permitext_research_operations", "t.operation", "user_id = $1", "id"],
  ["researchCredits", "permitext_research_credits", "to_jsonb(t) - 'user_id'", "user_id = $1", "id"],
  ["researchFeedback", "permitext_research_feedback", "t.feedback", "user_id = $1", "id"],
  ["migrationCheckpoints", "permitext_migration_checkpoints", "jsonb_build_object('name', checkpoint_name, 'checkpoint', checkpoint)", "user_id = $1", "checkpoint_name"],
  ["artifactRevisions", "permitext_artifact_revisions", "to_jsonb(t) - 'user_id'", "user_id = $1", "scope_kind, scope_id"],
  ["comments", "permitext_comments", "t.mutation", "user_id = $1", "record_id"],
  ["evidenceSnapshots", "permitext_evidence_snapshots", "t.snapshot", "user_id = $1", "id"],
  ["researchPurchaseClaims", "permitext_research_purchase_claims", "to_jsonb(t) - 'credited_user_id'", "credited_user_id = $1", "id"],
  ["organizations", "permitext_organizations", "t.organization", "owner_user_id = $1", "id"],
  ["organizationDeletionDependencies", "permitext_organizations", `jsonb_build_object(
    'organizationID', t.id,
    'otherMemberCount', (SELECT count(*) FROM permitext_organization_memberships m WHERE m.organization_id = t.id AND m.user_id <> $1)
      + (SELECT count(*) FROM permitext_project_memberships m WHERE m.organization_id = t.id AND m.user_id <> $1),
    'sharedRecordCount', ${[
      ["permitext_foundation_artifacts", "envelope->'owner'"],
      ["permitext_project_links", "link->'owner'"],
      ["permitext_project_activity", "event->'owner'"],
      ["permitext_research_answers", "answer->'owner'"],
      ["permitext_evidence_snapshots", "snapshot->'owner'"],
      ["permitext_comments", "COALESCE(mutation->'comment'->'owner', mutation->'owner')"]
    ].map(([table, owner]) => `(SELECT count(*) FROM ${table} r WHERE (${owner})->>'kind' = 'organization' AND COALESCE((${owner})->>'organizationID', (${owner})->>'id') = t.id)`).join(" + ")}
  )`, "owner_user_id = $1", "id"],
  ["organizationMemberships", "permitext_organization_memberships", "t.membership", "user_id = $1", "id"],
  ["projectMemberships", "permitext_project_memberships", "t.membership", "user_id = $1", "id"],
  ["organizationInvitations", "permitext_organization_invitations", "t.invitation - ARRAY['token', 'tokenHash', 'token_hash', 'invitationToken']", "invited_user_id = $1 OR invitation->>'invitedByUserID' = $1 OR invitation->>'acceptedByUserID' = $1", "id"],
  ["projectOwnerships", "permitext_project_ownerships", "t.ownership || jsonb_build_object('projectID', t.project_id, 'owner', jsonb_build_object('kind', t.owner_kind, 'id', t.owner_id, 'organizationID', CASE WHEN t.owner_kind = 'organization' THEN COALESCE(t.organization_id, t.owner_id) ELSE NULL END), 'storageOwnerUserID', t.storage_owner_user_id)", "storage_owner_user_id = $1 OR (owner_kind = 'user' AND owner_id = $1) OR organization_id IN (SELECT id FROM permitext_organizations WHERE owner_user_id = $1) OR (owner_kind = 'organization' AND owner_id IN (SELECT id FROM permitext_organizations WHERE owner_user_id = $1))", "project_id"],
  ["codeQuestionCounters", "permitext_code_question_counters", "to_jsonb(t) - 'user_id'", "user_id = $1", "scope, scope_key", true],
  ["codeQuestionPendingIssuance", "permitext_code_question_pending_issuance", "t.record", "user_id = $1", "id", true],
  ["codeQuestionOutbox", "permitext_code_question_outbox", "t.entry", "user_id = $1", "id", true]
]);

export async function existingOptionalAccountRecordTables(sql) {
  // Code Question tables are created lazily by their feature. Reading an export
  // must not create them. All other tables are required; a missing table fails.
  const optionalTables = await sql.query(
    "SELECT name, to_regclass(name) IS NOT NULL AS present FROM unnest($1::text[]) AS name",
    [postgresCollections.filter((item) => item[5]).map((item) => item[1])]
  );
  const allowed = new Set(postgresCollections.filter((item) => item[5]).map((item) => item[1]));
  return optionalTables.filter((row) => row.present && allowed.has(row.name)).map((row) => row.name).sort();
}

export async function postgresAccountRecordExport(sql, userID) {
  validateUserID(userID);
  const optionalTables = await existingOptionalAccountRecordTables(sql);
  const present = new Set(optionalTables);
  const selected = postgresCollections.filter((item) => !item[5] || present.has(item[1]));
  const queries = [
    sql`SELECT account FROM permitext_users WHERE id = ${userID}`,
    sql`SELECT entitlement FROM permitext_entitlements WHERE user_id = ${userID}`,
    sql`SELECT credential_id FROM permitext_passkey_credentials WHERE user_id = ${userID} ORDER BY credential_id`,
    sql`SELECT created_at, last_seen_at, expires_at, revoked_at,
      (revoked_at IS NULL AND expires_at > now()) AS active
      FROM permitext_account_sessions WHERE user_id = ${userID} ORDER BY created_at, expires_at`,
    sql`SELECT EXISTS(SELECT 1 FROM permitext_sessions WHERE user_id = ${userID}) AS active`,
    sql`SELECT mutation FROM (
      SELECT mutation, record_id FROM permitext_saved_items WHERE user_id = ${userID}
      UNION ALL SELECT mutation, record_id FROM permitext_annotations WHERE user_id = ${userID}
      UNION ALL SELECT mutation, record_id FROM permitext_projects WHERE user_id = ${userID}
      UNION ALL SELECT mutation, record_id FROM permitext_project_items WHERE user_id = ${userID}
      UNION ALL SELECT mutation, record_id FROM permitext_user_content_records
        WHERE user_id = ${userID} AND entity_kind IN ('continuity', 'codeVersionClear', 'workboard')
    ) AS records ORDER BY record_id`,
    ...selected.map(([, table, projection, predicate, order]) => sql.query(
      `SELECT ${projection} AS record FROM ${table} AS t WHERE ${predicate} ORDER BY ${order}`,
      [userID]
    ))
  ];
  const [accounts, entitlements, credentials, sessions, legacy, mutations, ...collections] =
    await sql.transaction(queries, { isolationLevel: "RepeatableRead", readOnly: true });
  if (JSON.stringify(optionalTables) !== JSON.stringify(await existingOptionalAccountRecordTables(sql))) {
    throw new Error("Account storage changed during export. Retry to capture all record families.");
  }
  const records = Object.fromEntries(postgresCollections.map(([name]) => [name, []]));
  selected.forEach(([name], index) => { records[name] = collections[index].map((row) => row.record); });
  records.sessionMetadata = sessions.map((session) => ({ kind: "account", ...session }));
  if (legacy[0]?.active) records.sessionMetadata.push({ kind: "legacy", active: true });
  return completeExport(userID, {
    account: accounts[0]?.account,
    entitlement: entitlements[0]?.entitlement,
    hasSession: records.sessionMetadata.some((session) => session.active),
    passkeyCredentialIDs: credentials.map((row) => row.credential_id),
    mutations: mutations.map((row) => row.mutation),
    records
  }, "postgres");
}

// Storage attribution is not permission to dispose of a legacy shared Project.
// Inspect only server-recorded ownership scopes, never path-shaped authored text.
export function accountDeletionOwnershipReview({ userID, records }) {
  const projectIDs = new Set();
  const organizationIDs = new Set();
  let sharedRecordCount = 0;
  const inspect = (owner, projectID) => {
    if (!owner || (owner.kind === "user" && owner.id === userID)) return false;
    sharedRecordCount += 1;
    if (projectID) projectIDs.add(projectID);
    if (owner.kind === "organization" && (owner.organizationID || owner.id)) {
      organizationIDs.add(owner.organizationID || owner.id);
    }
    return true;
  };
  for (const ownership of records.projectOwnerships || []) {
    const shared = inspect(ownership.owner, ownership.projectID);
    if (!shared && ownership.storageOwnerUserID && ownership.storageOwnerUserID !== userID) {
      sharedRecordCount += 1;
      if (ownership.projectID) projectIDs.add(ownership.projectID);
    }
  }
  for (const artifact of records.foundationArtifacts || []) {
    inspect(artifact.envelope?.owner, artifact.payload?.projectID || artifact.payload?.project?.id);
  }
  for (const family of ["projectLinks", "activityEvents", "researchAnswers", "evidenceSnapshots", "comments"]) {
    for (const entry of records[family] || []) {
      const record = entry.comment || entry;
      inspect(record.owner, record.projectID);
    }
  }
  const dependentOrganizations = (records.organizationDeletionDependencies || [])
    .filter((record) => record.otherMemberCount > 0 || record.sharedRecordCount > 0);
  for (const record of dependentOrganizations) organizationIDs.add(record.organizationID);
  return {
    required: sharedRecordCount > 0 || dependentOrganizations.length > 0,
    projectCount: projectIDs.size,
    organizationCount: organizationIDs.size,
    sharedRecordCount,
    dependentOrganizationCount: dependentOrganizations.length
  };
}

export function accountRestoreChecklist(exported) {
  const counts = {};
  for (const mutation of exported.mutations) {
    const kind = Object.keys(mutation)[0];
    if (kind) counts[kind] = (counts[kind] || 0) + 1;
  }
  const records = exported.records;
  const artifactCounts = {};
  for (const artifact of records.foundationArtifacts) {
    const type = artifact.envelope?.type || "other";
    artifactCounts[type] = (artifactCounts[type] || 0) + 1;
  }
  return {
    schema: "permitext-account-restore-checklist-v2",
    userID: exported.userID,
    hasAccount: Boolean(exported.account),
    authProvider: exported.account?.authProvider || null,
    publicUsername: exported.account?.publicUsername || null,
    displayName: exported.account?.displayName || null,
    entitlement: exported.entitlement,
    hasSession: exported.hasSession,
    passkeyCredentialCount: exported.passkeyCredentialIDs.length,
    passkeyCredentialIDs: exported.passkeyCredentialIDs,
    mutationCounts: Object.fromEntries(["savedItem", "annotation", "project", "projectSection", "workboard", "continuity", "codeVersionClear"].map((kind) => [kind, counts[kind] || 0])),
    researchConversationCount: records.researchConversations.length,
    researchAnswerCount: records.researchAnswers.length,
    artifactCounts,
    projectLinkCount: records.projectLinks.length,
    activityEventCount: records.activityEvents.length,
    recordCounts: Object.fromEntries(Object.entries(records).map(([name, entries]) => [name, entries.length])),
    deletionOwnershipReview: accountDeletionOwnershipReview(exported),
    latestContinuity: exported.mutations.filter((mutation) => mutation.continuity)
      .sort((a, b) => String(a.continuity.updatedAt || "").localeCompare(String(b.continuity.updatedAt || ""))).at(-1) || null
  };
}
