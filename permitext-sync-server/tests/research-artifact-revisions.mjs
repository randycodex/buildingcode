import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const port = 8802;
const baseURL = `http://127.0.0.1:${port}`;
const grantToken = "research-artifact-revision-grant-token";
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
  throw new Error("Research artifact revision test server did not start.");
}

function authenticated(account, body = {}) {
  return { auth: { accountUserID: account.userID }, ...body };
}

function simplifiedRevisions(artifactRevisions) {
  return {
    account: artifactRevisions.account && {
      revision: artifactRevisions.account.revision,
      changedDomains: artifactRevisions.account.changedDomains
    },
    projects: artifactRevisions.projects.map((revision) => ({
      projectID: revision.projectID,
      revision: revision.revision,
      changedDomains: revision.changedDomains
    })).sort((left, right) => left.projectID.localeCompare(right.projectID))
  };
}

async function checkpoint(account, projectIDs = []) {
  const result = await request("/projects/artifacts/checkpoint", {
    token: account.token,
    body: authenticated(account, { projectIDs, includeAccountResearch: true })
  });
  assert.equal(result.response.status, 200);
  return result.json;
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "permitext-research-artifact-revision-"));
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      VERCEL: "",
      VERCEL_ENV: "",
      PERMITEXT_TEST_RESEARCH_MOCK: "1",
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
    const providerUserID = "research-artifact-owner";
    const userID = `apple:${providerUserID}`;
    const grant = await request("/admin/lifetime-grants/grant", {
      token: grantToken,
      body: { userID }
    });
    assert.equal(grant.response.status, 200);
    const signIn = await request("/account/sign-in", {
      body: {
        credential: {
          provider: "apple",
          providerUserID,
          email: "research-artifact-owner@example.test",
          displayName: providerUserID
        }
      }
    });
    assert.equal(signIn.response.status, 200);
    const account = { userID, token: signIn.json.account.backendSessionToken };
    const projectIDs = ["research-project-a", "research-project-b"];
    for (const [index, projectID] of projectIDs.entries()) {
      const pushed = await request("/sync/push", {
        token: account.token,
        body: authenticated(account, {
          batch: {
            user: { id: account.userID },
            mutations: [{
              project: {
                id: `${projectID}-record`,
                userID: account.userID,
                codeVersion,
                clientID: projectID,
                name: `Research Project ${index + 1}`,
                colorHex: index ? "#445566" : "#334455",
                sortOrder: index,
                updatedAt: `2026-08-16T12:0${index}:00.000Z`
              }
            }]
          }
        })
      });
      assert.equal(pushed.response.status, 200);
    }

    const initial = await checkpoint(account, projectIDs);
    assert.equal(initial.account.revision, 0);
    assert.deepEqual(initial.projects.map((item) => item.revision), [0, 0]);
    const legacySyncBeforeResearch = await request("/sync/pull", {
      token: account.token,
      body: authenticated(account)
    });
    assert.equal(legacySyncBeforeResearch.response.status, 200);

    const unassigned = await request("/research/conversations/create", {
      token: account.token,
      body: authenticated(account, { requestID: "phase5-resume-create-1" })
    });
    assert.equal(unassigned.response.status, 201);
    assert.equal(unassigned.json.replayed, false);
    assert.equal("creationRequestID" in unassigned.json.conversation, false);
    assert.equal("creationRequestFingerprint" in unassigned.json.conversation, false);
    assert.deepEqual(simplifiedRevisions(unassigned.json.artifactRevisions), {
      account: { revision: 1, changedDomains: ["research"] },
      projects: []
    });

    const replayedUnassigned = await request("/research/conversations/create", {
      token: account.token,
      body: authenticated(account, { requestID: "phase5-resume-create-1" })
    });
    assert.equal(replayedUnassigned.response.status, 200);
    assert.equal(replayedUnassigned.json.replayed, true);
    assert.equal(replayedUnassigned.json.conversation.id, unassigned.json.conversation.id);
    const afterReplayList = await request("/research/conversations/list", {
      token: account.token,
      body: authenticated(account)
    });
    assert.equal(afterReplayList.response.status, 200);
    assert.equal(
      afterReplayList.json.conversations.filter((conversation) =>
        conversation.id === unassigned.json.conversation.id
      ).length,
      1,
      "Replaying a Research create request must leave exactly one conversation."
    );
    assert.equal((await checkpoint(account)).account.revision, 1, "A replay must not bump Research revisions.");

    const conflictingReplay = await request("/research/conversations/create", {
      token: account.token,
      body: authenticated(account, {
        requestID: "phase5-resume-create-1",
        projectID: projectIDs[0]
      })
    });
    assert.equal(conflictingReplay.response.status, 409);
    assert.equal(conflictingReplay.json.code, "RESEARCH_CREATE_REQUEST_CONFLICT");
    assert.equal((await checkpoint(account)).account.revision, 1, "A conflicting replay must not change Research.");

    const failedRename = await request("/research/conversations/rename", {
      token: account.token,
      body: authenticated(account, {
        conversationID: unassigned.json.conversation.id,
        title: "   "
      })
    });
    assert.equal(failedRename.response.status, 400);
    assert.equal((await checkpoint(account)).account.revision, 1, "Rejected mutation must not bump Research.");

    const assigned = await request("/research/conversations/create", {
      token: account.token,
      body: authenticated(account, { projectID: projectIDs[0] })
    });
    assert.equal(assigned.response.status, 201);
    assert.deepEqual(simplifiedRevisions(assigned.json.artifactRevisions), {
      account: { revision: 2, changedDomains: ["research"] },
      projects: [{
        projectID: projectIDs[0],
        revision: 1,
        changedDomains: ["activity", "foundation", "research"]
      }]
    });

    const renamed = await request("/research/conversations/rename", {
      token: account.token,
      body: authenticated(account, {
        conversationID: assigned.json.conversation.id,
        title: "Assigned Research"
      })
    });
    assert.equal(renamed.response.status, 200);
    assert.deepEqual(simplifiedRevisions(renamed.json.artifactRevisions), {
      account: { revision: 3, changedDomains: ["research"] },
      projects: [{ projectID: projectIDs[0], revision: 2, changedDomains: ["research"] }]
    });

    const rejectedMove = await request("/research/conversations/assign-project", {
      token: account.token,
      body: authenticated(account, {
        conversationID: assigned.json.conversation.id,
        projectID: projectIDs[1]
      })
    });
    assert.equal(rejectedMove.response.status, 409);
    const afterRejectedMove = await checkpoint(account, projectIDs);
    assert.equal(afterRejectedMove.account.revision, 3);
    assert.deepEqual(afterRejectedMove.projects.map((item) => item.revision), [2, 0]);

    const moved = await request("/research/conversations/assign-project", {
      token: account.token,
      body: authenticated(account, {
        conversationID: assigned.json.conversation.id,
        projectID: projectIDs[1],
        confirmMove: true
      })
    });
    assert.equal(moved.response.status, 200);
    assert.deepEqual(simplifiedRevisions(moved.json.artifactRevisions), {
      account: { revision: 4, changedDomains: ["research"] },
      projects: [
        {
          projectID: projectIDs[0],
          revision: 3,
          changedDomains: ["activity", "foundation", "research"]
        },
        {
          projectID: projectIDs[1],
          revision: 1,
          changedDomains: ["activity", "foundation", "research"]
        }
      ]
    });

    const removed = await request("/research/conversations/delete", {
      token: account.token,
      body: authenticated(account, { conversationID: assigned.json.conversation.id })
    });
    assert.equal(removed.response.status, 200);
    assert.deepEqual(simplifiedRevisions(removed.json.artifactRevisions), {
      account: { revision: 5, changedDomains: ["research"] },
      projects: [
        {
          projectID: projectIDs[0],
          revision: 4,
          changedDomains: ["activity", "foundation", "research"]
        },
        {
          projectID: projectIDs[1],
          revision: 2,
          changedDomains: ["activity", "foundation", "research"]
        }
      ]
    });

    const cleared = await request("/research/conversations/clear-history", {
      token: account.token,
      body: authenticated(account, { conversationIDs: [unassigned.json.conversation.id] })
    });
    assert.equal(cleared.response.status, 200);
    assert.equal(cleared.json.totalCount, 1);
    assert.deepEqual(simplifiedRevisions(cleared.json.artifactRevisions), {
      account: { revision: 6, changedDomains: ["research"] },
      projects: []
    });

    const emptyClear = await request("/research/conversations/clear-history", {
      token: account.token,
      body: authenticated(account, { conversationIDs: ["missing-conversation"] })
    });
    assert.equal(emptyClear.response.status, 200);
    assert.equal(emptyClear.json.totalCount, 0);
    assert.equal(emptyClear.json.artifactRevisions, undefined);
    const final = await checkpoint(account, projectIDs);
    assert.equal(final.account.revision, 6);
    assert.deepEqual(final.projects.map((item) => ({
      projectID: item.projectID,
      revision: item.revision,
      domains: item.domains
    })), [
      { projectID: projectIDs[0], revision: 4, domains: ["activity", "foundation", "research"] },
      { projectID: projectIDs[1], revision: 2, domains: ["activity", "foundation", "research"] }
    ]);
    const legacyCheckpointAfterResearch = await request("/sync/checkpoint", {
      token: account.token,
      body: authenticated(account, {
        sinceEventID: legacySyncBeforeResearch.json.latestEventID,
        contentMapVersion: legacySyncBeforeResearch.json.contentMapVersion,
        entitlementFingerprint: legacySyncBeforeResearch.json.entitlementFingerprint
      })
    });
    assert.equal(legacyCheckpointAfterResearch.response.status, 200);
    assert.equal(legacyCheckpointAfterResearch.json.changed, false);
    assert.equal(
      legacyCheckpointAfterResearch.json.latestEventID,
      legacySyncBeforeResearch.json.latestEventID,
      "Research artifact revisions must not overload the legacy sync event cursor."
    );

    const concurrentCreates = await Promise.all([0, 1].map(() => request(
      "/research/conversations/create",
      {
        token: account.token,
        body: authenticated(account, { requestID: "phase5-concurrent-create-1" })
      }
    )));
    assert.deepEqual(
      concurrentCreates.map((result) => result.response.status).sort(),
      [200, 201],
      "Concurrent retries must serialize into one creation and one replay."
    );
    assert.equal(
      new Set(concurrentCreates.map((result) => result.json.conversation.id)).size,
      1,
      "Concurrent retries must return the same deterministic conversation."
    );
    const afterConcurrentList = await request("/research/conversations/list", {
      token: account.token,
      body: authenticated(account)
    });
    const concurrentConversationID = concurrentCreates[0].json.conversation.id;
    assert.equal(
      afterConcurrentList.json.conversations.filter((conversation) =>
        conversation.id === concurrentConversationID
      ).length,
      1
    );
  } finally {
    server.kill();
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().then(
  () => console.log("research artifact revision tests passed"),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
