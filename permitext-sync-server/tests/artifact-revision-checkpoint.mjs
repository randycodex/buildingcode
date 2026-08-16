import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const port = 8801;
const baseURL = `http://127.0.0.1:${port}`;
const grantToken = "artifact-revision-grant-token";
const codeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";

async function request(path, { body, token } = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method: path === "/health" ? "GET" : "POST",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  return {
    response,
    json: text && response.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(text)
      : null
  };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await request("/health")).response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("Artifact revision test server did not start.");
}

async function createAccount(providerUserID, email) {
  const userID = `apple:${providerUserID}`;
  const grant = await request("/admin/lifetime-grants/grant", {
    token: grantToken,
    body: { userID }
  });
  assert.equal(grant.response.status, 200);
  const signIn = await request("/account/sign-in", {
    body: {
      credential: { provider: "apple", providerUserID, email, displayName: providerUserID }
    }
  });
  assert.equal(signIn.response.status, 200);
  return { userID, token: signIn.json.account.backendSessionToken, email };
}

function authenticated(account, body = {}) {
  return { auth: { accountUserID: account.userID }, ...body };
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "permitext-artifact-revision-"));
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      VERCEL: "",
      VERCEL_ENV: "",
      PERMITEXT_SYNC_DATA_PATH: join(tempDir, "sync-store.json"),
      PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: join(tempDir, "private-assets"),
      PERMITEXT_SYNC_DATABASE_URL: "",
      DATABASE_URL: "",
      STORAGE_URL: "",
      POSTGRES_URL: "",
      NEON_DATABASE_URL: "",
      BLOB_READ_WRITE_TOKEN: "",
      VERCEL_OIDC_TOKEN: "",
      BLOB_STORE_ID: "",
      PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: grantToken
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer();
    const owner = await createAccount("artifact-owner", "artifact-owner@example.test");
    const editor = await createAccount("artifact-editor", "artifact-editor@example.test");
    const projectID = "artifact-revision-project";
    const projectPush = await request("/sync/push", {
      token: owner.token,
      body: authenticated(owner, {
        batch: {
          user: { id: owner.userID },
          mutations: [{
            project: {
              id: "artifact-revision-project-record",
              userID: owner.userID,
              codeVersion,
              clientID: projectID,
              name: "Artifact Revision Project",
              colorHex: "#334455",
              sortOrder: 0,
              updatedAt: "2026-08-16T12:00:00.000Z"
            }
          }]
        }
      })
    });
    assert.equal(projectPush.response.status, 200);

    const organization = await request("/organizations/create", {
      token: owner.token,
      body: authenticated(owner, { name: "Artifact Revision Studio" })
    });
    assert.equal(organization.response.status, 201);
    const organizationID = organization.json.organization.id;
    const transfer = await request("/organizations/projects/transfer", {
      token: owner.token,
      body: authenticated(owner, { organizationID, projectID })
    });
    assert.equal(transfer.response.status, 200);

    const invitation = await request("/organizations/members/invite", {
      token: owner.token,
      body: authenticated(owner, {
        organizationID,
        projectID,
        email: editor.email,
        role: "editor"
      })
    });
    assert.equal(invitation.response.status, 201);
    const acceptance = await request("/organizations/invitations/accept", {
      token: editor.token,
      body: authenticated(editor, { invitationToken: invitation.json.invitationToken })
    });
    assert.equal(acceptance.response.status, 200);

    const initialCheckpoint = await request("/projects/artifacts/checkpoint", {
      token: owner.token,
      body: authenticated(owner, { projectIDs: [projectID] })
    });
    assert.equal(initialCheckpoint.response.status, 200);
    assert.equal(initialCheckpoint.json.projects[0].revision, 0);
    const legacySyncBeforeArtifact = await request("/sync/pull", {
      token: owner.token,
      body: authenticated(owner)
    });
    assert.equal(legacySyncBeforeArtifact.response.status, 200);

    const document = {
      schema: "permitext-notebook-card",
      schemaVersion: 1,
      format: "tiptap-json",
      document: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Shared note." }] }]
      }
    };
    const created = await request("/notebook/cards/save", {
      token: editor.token,
      body: authenticated(editor, {
        projectID,
        expectedVersion: 0,
        cardType: "finding",
        title: "Shared artifact note",
        document
      })
    });
    assert.equal(created.response.status, 201);
    assert.deepEqual(created.json.artifactRevisions.projects.map((revision) => ({
      projectID: revision.projectID,
      revision: revision.revision,
      changedDomains: revision.changedDomains
    })), [{
      projectID,
      revision: 1,
      changedDomains: ["activity", "foundation", "notebook"]
    }]);
    assert.equal(created.json.artifactRevisions.storageOwnerUserID, owner.userID);
    const legacyCheckpointAfterArtifact = await request("/sync/checkpoint", {
      token: owner.token,
      body: authenticated(owner, {
        sinceEventID: legacySyncBeforeArtifact.json.latestEventID,
        contentMapVersion: legacySyncBeforeArtifact.json.contentMapVersion,
        entitlementFingerprint: legacySyncBeforeArtifact.json.entitlementFingerprint
      })
    });
    assert.equal(legacyCheckpointAfterArtifact.response.status, 200);
    assert.equal(legacyCheckpointAfterArtifact.json.changed, false);
    assert.equal(
      legacyCheckpointAfterArtifact.json.latestEventID,
      legacySyncBeforeArtifact.json.latestEventID,
      "Direct artifacts must not overload the legacy sync event cursor."
    );

    for (const account of [owner, editor]) {
      const checkpoint = await request("/projects/artifacts/checkpoint", {
        token: account.token,
        body: authenticated(account, { projectIDs: [projectID] })
      });
      assert.equal(checkpoint.response.status, 200);
      assert.equal(checkpoint.json.projects[0].revision, 1);
      assert.equal(checkpoint.json.projects[0].storageOwnerUserID, owner.userID);
      assert.deepEqual(checkpoint.json.projects[0].domains, ["activity", "foundation", "notebook"]);
    }

    const staleSave = await request("/notebook/cards/save", {
      token: editor.token,
      body: authenticated(editor, {
        projectID,
        cardID: created.json.card.id,
        expectedVersion: 0,
        cardType: "finding",
        title: "Stale note",
        document
      })
    });
    assert.equal(staleSave.response.status, 409);
    const checkpointAfterFailure = await request("/projects/artifacts/checkpoint", {
      token: owner.token,
      body: authenticated(owner, { projectIDs: [projectID] })
    });
    assert.equal(checkpointAfterFailure.json.projects[0].revision, 1);
  } finally {
    server.kill();
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().then(
  () => console.log("artifact revision checkpoint tests passed"),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
