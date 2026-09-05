import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { neonConfig } from "@neondatabase/serverless";
import { createPostgresAccountRepository } from "../postgres-account-repository.mjs";
import { createPostgresAccountLifecycle } from "../account-lifecycle.mjs";
import { LocalFilesystemImageStorage } from "../image-storage.mjs";

// Called only after the disposable, loopback-only PostgreSQL harness validates
// its empty database and replaces the Neon transport with local connections.
export async function runPostgresSharedOwnershipCases({ sql }) {
  const { handleRequest } = await import("../app.mjs");
  const accounts = createPostgresAccountRepository(sql);
  const lifecycle = createPostgresAccountLifecycle(sql);
  const A = "web:pg-shared-storage", B = "web:pg-shared-owner";
  const projectID = "pg-shared-project", organizationID = "pg-shared-organization";
  const now = new Date().toISOString();
  const tokens = {};
  for (const userID of [A, B]) {
    const signedIn = await accounts.signIn({ appUserID: userID, authProvider: "web", authProviderUserID: userID.slice(4), displayName: "Synthetic shared ownership", signedInAt: now });
    tokens[userID] = signedIn.account.backendSessionToken;
  }
  await accounts.saveEntitlement(A, { plan: "pro", source: "synthetic-local-fixture" });
  const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 32);
  const imageID = "pg-shared-image";
  const pathname = `project-assets/${hash(projectID)}/notebook/${hash(A)}/${hash(imageID)}.png`;
  const temporary = await mkdtemp(join(tmpdir(), "permitext-pg-shared-assets-"));
  const previousAssetRoot = process.env.PERMITEXT_LOCAL_PRIVATE_ASSET_PATH;
  process.env.PERMITEXT_LOCAL_PRIVATE_ASSET_PATH = temporary;
  const image = Buffer.from("synthetic private shared file");
  await new LocalFilesystemImageStorage(temporary).put(pathname, image, "image/png");
  const organization = { id: organizationID, ownerUserID: B, status: "active", name: "Synthetic legacy firm" };
  const owner = { kind: "organization", id: organizationID, organizationID };
  const envelope = { id: imageID, type: "notebookImageAsset", owner };
  const payload = { projectID, storageKey: pathname, storageProvider: "local-filesystem", contentType: "image/png" };
  const project = { id: `${A}:project:${projectID}`, clientID: projectID, userID: A,
    name: "Synthetic legacy shared Project", codeVersion: "synthetic", updatedAt: now };
  await sql.transaction([
    sql`INSERT INTO permitext_organizations (id, owner_user_id, slug, status, organization) VALUES (${organizationID}, ${B}, ${organizationID}, 'active', ${JSON.stringify(organization)}::jsonb)`,
    ...[A, B].map(userID => sql`INSERT INTO permitext_organization_memberships (id, organization_id, user_id, role, status, membership)
      VALUES (${userID + ":membership"}, ${organizationID}, ${userID}, 'owner', 'active', ${JSON.stringify({ id: userID + ":membership", organizationID, userID, role: "owner", status: "active" })}::jsonb)`),
    sql`INSERT INTO permitext_projects (record_id, user_id, code_version, mutation) VALUES (${project.id}, ${A}, 'synthetic', ${JSON.stringify({ project })}::jsonb)`,
    // Indexed ownership must win over a stale JSON copy, including an older
    // row whose separate organization_id column was never populated.
    sql`INSERT INTO permitext_project_ownerships (project_id, owner_kind, owner_id, organization_id, storage_owner_user_id, ownership)
      VALUES (${projectID}, 'organization', ${organizationID}, NULL, ${A}, ${JSON.stringify({ projectID, owner: { kind: "user", id: A }, storageOwnerUserID: A })}::jsonb)`,
    sql`INSERT INTO permitext_foundation_artifacts (id, user_id, artifact_type, envelope, payload) VALUES (${imageID}, ${A}, 'notebookImageAsset', ${JSON.stringify(envelope)}::jsonb, ${JSON.stringify(payload)}::jsonb)`,
    sql`INSERT INTO permitext_project_memberships (id, organization_id, project_id, user_id, role, status, membership)
      VALUES (${B + ":project-membership"}, ${organizationID}, ${projectID}, ${B}, 'owner', 'active', ${JSON.stringify({ id: B + ":project-membership", organizationID, projectID, userID: B, role: "owner", status: "active" })}::jsonb)`
  ]);
  const server = createServer(handleRequest);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => {
    assert.equal(new URL(url).origin, base, "Shared ownership acceptance forbids external requests.");
    return originalFetch(url, options);
  };
  const post = async (path, body, token) => {
    const response = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const exported = async (userID) => {
    const result = await post("/admin/accounts/export", { userID }, process.env.PERMITEXT_SYNC_ADMIN_TOKEN);
    assert.equal(result.status, 200);
    return result.body;
  };
  const deletion = (userID) => post("/account/delete", { auth: { accountUserID: userID }, confirmation: "DELETE" }, tokens[userID]);
  try {
    for (const missingRegistry of [false, true]) {
      if (missingRegistry) {
        await sql`DELETE FROM permitext_project_ownerships WHERE project_id = ${projectID}`;
        await sql`DELETE FROM permitext_organization_memberships WHERE id = ${A + ":membership"}`;
      }
      const before = await Promise.all([A, B].map(exported));
      if (!missingRegistry) {
        for (const snapshot of before) assert.deepEqual(snapshot.records.projectOwnerships[0].owner, owner);
      } else {
        assert.ok(before.every(snapshot => snapshot.records.projectOwnerships.length === 0));
        const dependencies = before[1].records.organizationDeletionDependencies[0];
        assert.equal(dependencies.otherMemberCount, 0);
        assert.equal(dependencies.sharedRecordCount, 1, "The foreign artifact scope alone must preserve the organization owner's account.");
      }
      for (const userID of [A, B]) {
        const result = await deletion(userID);
        assert.equal(result.status, 409, JSON.stringify(result.body));
        assert.equal(result.body.code, "ACCOUNT_SHARED_DATA_REVIEW_REQUIRED");
        assert.equal(result.body.partial, false);
        assert.ok(Object.values(result.body.stages).every(stage => stage.status === "notStarted"));
        assert.deepEqual(await readFile(join(temporary, pathname)), image);
        assert.deepEqual(await Promise.all([A, B].map(exported)), before, "Both complete account inventories must survive a blocked cleanup.");
      }
    }

    // Hold a real legacy transfer before its ownership write. The organization
    // owner's deletion must see the transfer's secondary account guard.
    await sql`INSERT INTO permitext_organization_memberships (id, organization_id, user_id, role, status, membership)
      VALUES (${A + ":membership"}, ${organizationID}, ${A}, 'owner', 'active', ${JSON.stringify({ id: A + ":membership", organizationID, userID: A, role: "owner", status: "active" })}::jsonb)`;
    const transport = neonConfig.fetchFunction;
    let resume, reached, timer;
    const gate = new Promise(resolve => { resume = resolve; });
    const entered = new Promise(resolve => { reached = resolve; });
    neonConfig.fetchFunction = async (url, options) => {
      const body = JSON.parse(options.body);
      if ((body.queries || [body]).some(query => /INSERT INTO permitext_project_ownerships/.test(query.query) && query.params.includes(projectID))) {
        reached(); await gate;
      }
      return transport(url, options);
    };
    const transfer = post("/organizations/projects/transfer", { auth: { accountUserID: A }, organizationID, projectID }, tokens[A]);
    try {
      await Promise.race([entered,
        transfer.then(result => { throw new Error(`Transfer stopped before ownership write: ${JSON.stringify(result)}`); }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Transfer boundary not reached")), 20000); })]);
      clearTimeout(timer);
      const busy = await deletion(B);
      assert.equal(busy.status, 409);
      assert.equal(busy.body.code, "ACCOUNT_OPERATION_IN_PROGRESS");
      assert.equal((await sql`SELECT project_id FROM permitext_project_ownerships WHERE project_id = ${projectID}`).length, 0);
    } finally {
      clearTimeout(timer);
      resume();
      neonConfig.fetchFunction = transport;
      const result = await transfer;
      assert.equal(result.status, 200, JSON.stringify(result.body));
    }
    await lifecycle.claimDeletion(B, "synthetic-reverse-order", { sessionToken: tokens[B] });
    try {
      const blocked = await post("/organizations/projects/transfer", { auth: { accountUserID: A }, organizationID, projectID }, tokens[A]);
      assert.equal(blocked.status, 409);
      assert.equal(blocked.body.code, "ACCOUNT_DELETION_IN_PROGRESS");
    } finally { await lifecycle.releaseDeletion(B, "synthetic-reverse-order"); }
    assert.deepEqual(await readFile(join(temporary, pathname)), image);
    console.log("PostgreSQL shared ownership passed: both owners, missing registry, indexed ownership, unchanged inventories/private file, and transfer/deletion exclusion in both orders.");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousAssetRoot === undefined) delete process.env.PERMITEXT_LOCAL_PRIVATE_ASSET_PATH;
    else process.env.PERMITEXT_LOCAL_PRIVATE_ASSET_PATH = previousAssetRoot;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(temporary, { recursive: true, force: true });
  }
}
