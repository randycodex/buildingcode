import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createPostgresAccountRepository } from "../postgres-account-repository.mjs";
import { existingOptionalAccountRecordTables } from "../account-data-export.mjs";

// Called only by the guarded, empty, loopback PostgreSQL acceptance harness.
// These synthetic fixtures never access a deployed database or provider.
export async function runPostgresAccountDataExportCases({ sql, auxiliaryAdapter }) {
  const { handleRequest } = await import("../app.mjs");
  const accounts = createPostgresAccountRepository(sql);
  const admin = "synthetic-postgres-export-admin";
  process.env.PERMITEXT_SYNC_ADMIN_TOKEN = admin;
  const A = "web:pg-export-a", B = "web:pg-export-b";
  const now = new Date().toISOString();
  const accountA = await accounts.signIn({ appUserID: A, authProvider: "web", authProviderUserID: "pg-export-a", displayName: "Synthetic A", signedInAt: now });
  await accounts.signIn({ appUserID: B, authProvider: "web", authProviderUserID: "pg-export-b", displayName: "OTHER-ACCOUNT-PRIVATE", signedInAt: now });
  const server = createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => {
    assert.equal(new URL(url).origin, base, "Account export acceptance forbids external requests.");
    return originalFetch(url, options);
  };
  async function post(path, body, token = admin) {
    const response = await fetch(base + path, { method: "POST", headers: {
      "content-type": "application/json", authorization: `Bearer ${token}`
    }, body: JSON.stringify(body) });
    const payload = await response.json();
    return { status: response.status, body: payload };
  }
  async function exported(userID) {
    const result = await post("/admin/accounts/export", { userID });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body;
  }
  try {
    assert.deepEqual(await existingOptionalAccountRecordTables(sql), []);
    const empty = await exported(A);
    assert.equal(empty.hasSession, true, "Modern PostgreSQL sessions must be included.");
    assert.equal(empty.records.sessionMetadata.length, 1);
    assert.deepEqual(empty.records.codeQuestionPendingIssuance, []);
    assert.deepEqual(await existingOptionalAccountRecordTables(sql), [], "Export must not create feature tables.");
    for (const userID of [A, B]) {
      const record = { id: `${userID}:record`, userID, title: userID === A ? "Synthetic record A" : "OTHER-ACCOUNT-PRIVATE" };
      const json = JSON.stringify(record);
      const projectID = `${userID}:project`, orgID = `${userID}:org`;
      await sql.transaction([
        sql`INSERT INTO permitext_saved_items (record_id, user_id, code_version, section_id, mutation) VALUES (${userID + ":saved"}, ${userID}, 'synthetic-2022', 1, ${JSON.stringify({ savedItem: record })}::jsonb)`,
        sql`INSERT INTO permitext_annotations (record_id, user_id, code_version, section_id, mutation) VALUES (${userID + ":note"}, ${userID}, 'synthetic-2022', 1, ${JSON.stringify({ annotation: record })}::jsonb)`,
        sql`INSERT INTO permitext_projects (record_id, user_id, code_version, mutation) VALUES (${projectID}, ${userID}, 'synthetic-2022', ${JSON.stringify({ project: record })}::jsonb)`,
        sql`INSERT INTO permitext_project_items (record_id, user_id, code_version, section_id, mutation) VALUES (${userID + ":item"}, ${userID}, 'synthetic-2022', 1, ${JSON.stringify({ projectSection: record })}::jsonb)`,
        sql`INSERT INTO permitext_user_content_records (record_id, user_id, entity_kind, mutation) VALUES (${userID + ":continuity"}, ${userID}, 'continuity', ${JSON.stringify({ continuity: { ...record, updatedAt: now } })}::jsonb)`,
        sql`INSERT INTO permitext_foundation_artifacts (id, user_id, artifact_type, envelope, payload) VALUES (${record.id}, ${userID}, 'notebookCard', ${JSON.stringify({ id: record.id, type: "notebookCard" })}::jsonb, ${json}::jsonb)`,
        sql`INSERT INTO permitext_project_links (id, user_id, project_id, target_kind, target_id, relationship, link) VALUES (${record.id}, ${userID}, ${projectID}, 'notebookCard', ${record.id}, 'primary', ${json}::jsonb)`,
        sql`INSERT INTO permitext_research_conversations (id, user_id, title, conversation) VALUES (${record.id}, ${userID}, 'Synthetic', ${json}::jsonb)`,
        sql`INSERT INTO permitext_research_answers (id, user_id, conversation_id, answer) VALUES (${record.id}, ${userID}, ${record.id}, ${json}::jsonb)`,
        sql`INSERT INTO permitext_project_activity (id, user_id, project_id, action, object_kind, object_id, event) VALUES (${record.id}, ${userID}, ${projectID}, 'synthetic', 'notebookCard', ${record.id}, ${json}::jsonb)`,
        sql`INSERT INTO permitext_research_usage (id, user_id, model, mode) VALUES (${record.id}, ${userID}, 'synthetic', 'mock')`,
        sql`INSERT INTO permitext_research_operations (id, user_id, operation) VALUES (${record.id}, ${userID}, ${json}::jsonb)`,
        sql`INSERT INTO permitext_research_credits (id, user_id, units, source, source_id) VALUES (${record.id}, ${userID}, 1, 'synthetic', ${record.id})`,
        sql`INSERT INTO permitext_research_feedback (id, user_id, conversation_id, answer_id, feedback) VALUES (${record.id}, ${userID}, ${record.id}, ${record.id}, ${json}::jsonb)`,
        sql`INSERT INTO permitext_comments (record_id, user_id, code_version, section_id, mutation) VALUES (${record.id}, ${userID}, 'synthetic-2022', 1, ${json}::jsonb)`,
        sql`INSERT INTO permitext_evidence_snapshots (id, user_id, answer_id, source_id, snapshot) VALUES (${record.id}, ${userID}, ${record.id}, ${record.id}, ${json}::jsonb)`,
        sql`INSERT INTO permitext_migration_checkpoints (user_id, checkpoint_name, checkpoint) VALUES (${userID}, 'synthetic', ${json}::jsonb)`,
        sql`INSERT INTO permitext_artifact_revisions (user_id, scope_kind, scope_id, revision) VALUES (${userID}, 'account', ${userID}, 3)`,
        sql`INSERT INTO permitext_passkey_credentials (credential_id, user_id) VALUES (${record.id}, ${userID})`,
        sql`INSERT INTO permitext_organizations (id, owner_user_id, slug, status, organization) VALUES (${orgID}, ${userID}, ${orgID}, 'active', ${JSON.stringify({ ...record, ownerUserID: userID })}::jsonb)`,
        sql`INSERT INTO permitext_organization_memberships (id, organization_id, user_id, role, status, membership) VALUES (${record.id}, ${orgID}, ${userID}, 'owner', 'active', ${json}::jsonb)`,
        sql`INSERT INTO permitext_project_memberships (id, organization_id, project_id, user_id, role, status, membership) VALUES (${record.id}, ${orgID}, ${projectID}, ${userID}, 'editor', 'active', ${json}::jsonb)`,
        sql`INSERT INTO permitext_project_ownerships (project_id, owner_kind, owner_id, storage_owner_user_id, ownership) VALUES (${projectID}, 'user', ${userID}, ${userID}, ${json}::jsonb)`,
        sql`INSERT INTO permitext_organization_invitations (id, organization_id, token_hash, invited_user_id, role, status, invitation, expires_at) VALUES (${record.id}, ${orgID}, ${"SECRET-INVITE-" + userID}, ${userID}, 'editor', 'pending', ${JSON.stringify({ ...record, token: "SECRET-INVITE", tokenHash: "SECRET-INVITE-HASH" })}::jsonb, now() + interval '1 day')`,
        sql`INSERT INTO permitext_research_purchase_claims (id, provider, provider_purchase_id, product_id, units, credited_user_id) VALUES (${record.id}, 'synthetic', ${record.id}, 'synthetic', 1, ${userID})`
      ]);
      await auxiliaryAdapter.allocateCodeQuestionCounter(userID, "synthetic", record.id);
      await auxiliaryAdapter.saveCodeQuestionPendingIssuance(userID, record);
      await auxiliaryAdapter.saveCodeQuestionOutboxEntry(userID, record);
    }
    const token = accountA.account.backendSessionToken;
    for (const path of ["/admin/accounts/export", "/admin/accounts/restore-checklist"]) {
      assert.equal((await post(path, { userID: A }, token)).status, 401);
      assert.equal((await post(path, { userID: ` ${A}` })).status, 400);
    }
    const beforeB = await exported(B);
    const before = await exported(A);
    assert.equal(before.schema, "permitext-account-record-export-v2");
    assert.equal(before.scope.storage, "postgres");
    assert.equal(before.scope.privateAssetBytesIncluded, false);
    assert.equal(before.mutations.length, 5);
    for (const [name, records] of Object.entries(before.records)) assert.equal(records.length, 1, name);
    const serialized = JSON.stringify(before);
    for (const secret of [B, "OTHER-ACCOUNT-PRIVATE", "SECRET-INVITE", token]) assert.equal(serialized.includes(secret), false, secret);
    assert.equal(serialized.includes("token_hash"), false);
    const checklist = await post("/admin/accounts/restore-checklist", { userID: A });
    assert.equal(checklist.status, 200);
    assert.equal(checklist.body.researchConversationCount, 1);
    assert.equal(checklist.body.researchAnswerCount, 1);
    assert.deepEqual(checklist.body.artifactCounts, { notebookCard: 1 });
    assert.ok(Object.values(checklist.body.recordCounts).every((count) => count === 1));
    assert.deepEqual(await exported(A), before, "Export and checklist must leave account records unchanged.");

    // Force the final account-delete statement to fail. All preceding family
    // deletes, including optional Code Question tables, must roll back together.
    await sql`CREATE FUNCTION block_synthetic_export_delete() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF OLD.id = 'web:pg-export-a' THEN RAISE EXCEPTION 'Synthetic rollback check'; END IF; RETURN OLD; END $$`;
    await sql`CREATE TRIGGER synthetic_export_delete_guard BEFORE DELETE ON permitext_users FOR EACH ROW EXECUTE FUNCTION block_synthetic_export_delete()`;
    const failed = await post("/account/delete", { auth: { accountUserID: A }, confirmation: "DELETE" }, token);
    assert.equal(failed.status, 500);
    assert.equal(failed.body.code, "ACCOUNT_DATA_DELETION_FAILED");
    await sql`DROP TRIGGER synthetic_export_delete_guard ON permitext_users`;
    await sql`DROP FUNCTION block_synthetic_export_delete()`;
    assert.deepEqual(await exported(A), before, "A failed deletion must retain all account records.");

    const deleted = await post("/account/delete", { auth: { accountUserID: A }, confirmation: "DELETE" }, token);
    assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
    assert.equal(deleted.body.deleted, true);
    const after = await exported(A);
    assert.equal(after.account, null);
    assert.equal(after.entitlement, null);
    assert.equal(after.hasSession, false);
    assert.deepEqual(after.passkeyCredentialIDs, []);
    assert.deepEqual(after.mutations, []);
    for (const [name, records] of Object.entries(after.records)) assert.deepEqual(records, [], `Deleted account retains ${name}`);
    assert.deepEqual(await exported(B), beforeB, "Another account's complete inventory must remain unchanged.");
    assert.equal((await post("/sync/pull", { auth: { accountUserID: A } }, token)).status, 401);
    const claim = (await sql`SELECT credited_user_id, deleted_at FROM permitext_research_purchase_claims WHERE id = ${A + ":record"}`)[0];
    assert.equal(claim.credited_user_id, null);
    assert.ok(claim.deleted_at, "Retain the detached purchase replay tombstone.");
    console.log("PostgreSQL account export/deletion passed: normalized records, modern session metadata, no credentials, optional tables without DDL, isolation, rollback, and empty post-deletion inventory.");
  } finally {
    globalThis.fetch = originalFetch;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
