import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { verifyRestoreDrill } from "../restore-drill-contract.mjs";

const adminToken = "permitext-local-restore-drill-admin-token";
const representativeUserID = "apple:restore-drill-representative";
const gitCommit = "0123456789abcdef0123456789abcdef01234567";

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  assert.equal(typeof address, "object");
  const port = address.port;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startPermitextServer({ dataPath, releaseID }) {
  const port = await availablePort();
  const baseURL = `http://127.0.0.1:${port}`;
  const output = [];
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      VERCEL: "",
      VERCEL_ENV: "",
      DATABASE_URL: "",
      STORAGE_URL: "",
      POSTGRES_URL: "",
      NEON_DATABASE_URL: "",
      OPENAI_API_KEY: "",
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      PERMITEXT_SYNC_DATA_PATH: dataPath,
      PERMITEXT_SYNC_ADMIN_TOKEN: adminToken,
      PERMITEXT_PUBLIC_BASE_URL: baseURL,
      PERMITEXT_RELEASE_ID: releaseID,
      PERMITEXT_GIT_COMMIT: gitCommit,
      PERMITEXT_RESEARCH_KILL_SWITCH: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => output.push(String(chunk)));
  }
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(output.join(""));
    try {
      const health = await fetch(`${baseURL}/health`);
      if (health.ok) return { child, baseURL, output };
    } catch {
      // Starting.
    }
    await sleep(100);
  }
  throw new Error(`Permitext restore rehearsal server did not start.\n${output.join("")}`);
}

async function stopPermitextServer(server) {
  if (!server || server.child.exitCode !== null) return;
  server.child.kill("SIGTERM");
  await Promise.race([once(server.child, "exit"), sleep(2_000)]);
}

function representativeStore() {
  const now = new Date().toISOString();
  return {
    users: {
      [representativeUserID]: {
        appUserID: representativeUserID,
        authProvider: "apple",
        publicUsername: "restore-representative",
        displayName: "Restore Representative"
      }
    },
    entitlements: {
      [representativeUserID]: {
        plan: "pro",
        source: "lifetimeGrant",
        grantedUserID: representativeUserID,
        updatedAt: now
      }
    },
    sessions: {},
    passkeyCredentials: {},
    mutationsByUserID: {
      [representativeUserID]: [
        { savedItem: { id: "saved-1", userID: representativeUserID, updatedAt: now } },
        { annotation: { id: "note-1", userID: representativeUserID, updatedAt: now } },
        { project: { id: "project-1", userID: representativeUserID, updatedAt: now } },
        { projectSection: { id: "membership-1", userID: representativeUserID, updatedAt: now } },
        { workboard: { id: "workboard-1", userID: representativeUserID, updatedAt: now } }
      ]
    },
    foundationArtifactsByUserID: {
      [representativeUserID]: [
        { envelope: { id: "notebook-1", type: "notebookCard" } },
        { envelope: { id: "notebook-asset-1", type: "notebookImageAsset" } },
        { envelope: { id: "report-draft-1", type: "reportDraft" } },
        { envelope: { id: "report-manifest-1", type: "reportManifest" } }
      ]
    },
    projectLinksByUserID: {
      [representativeUserID]: [{ id: "link-1" }]
    },
    researchConversationsByUserID: {
      [representativeUserID]: [{ id: "conversation-1", updatedAt: now }]
    },
    researchAnswersByUserID: {
      [representativeUserID]: [{ id: "answer-1", conversationID: "conversation-1", createdAt: now }]
    },
    activityEventsByUserID: {
      [representativeUserID]: [{ id: "activity-1", createdAt: now }]
    }
  };
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "permitext-local-restore-drill-"));
  const sourcePath = join(tempDir, "source.json");
  const targetPath = join(tempDir, "restored.json");
  let sourceServer;
  let targetServer;
  try {
    await writeFile(sourcePath, `${JSON.stringify(representativeStore(), null, 2)}\n`, "utf8");
    sourceServer = await startPermitextServer({ dataPath: sourcePath, releaseID: "restore-source" });
    await copyFile(sourcePath, targetPath);
    targetServer = await startPermitextServer({ dataPath: targetPath, releaseID: "restore-target" });

    const verify = () => verifyRestoreDrill({
      sourceBaseURL: sourceServer.baseURL,
      targetBaseURL: targetServer.baseURL,
      sourceAdminToken: adminToken,
      targetAdminToken: adminToken,
      representativeUserID,
      targetIsolated: true,
      providerWritesDisabled: true,
      expectedTargetStorage: "file",
      sourceAssetCount: 1,
      targetAssetCount: 1,
      sourceAssetInventoryTimestamp: new Date().toISOString()
    });

    const restored = await verify();
    assert.equal(restored.pass, true, JSON.stringify(restored.mismatches));
    assert.equal(restored.comparedDurableTableCount > 0, true);
    assert.equal(restored.source.gitCommit, gitCommit);
    assert.equal(restored.target.gitCommit, gitCommit);

    const corrupted = JSON.parse(await readFile(targetPath, "utf8"));
    corrupted.researchAnswersByUserID[representativeUserID] = [];
    await writeFile(targetPath, `${JSON.stringify(corrupted, null, 2)}\n`, "utf8");
    const detected = await verify();
    assert.equal(detected.pass, false, "Restore verification accepted a missing Research answer.");
    assert(
      detected.mismatches.includes("summary.tables.researchAnswers") &&
        detected.mismatches.includes("representativeAccount.researchAnswerCount"),
      `Restore verification did not identify the missing answer: ${detected.mismatches.join(", ")}`
    );

    await assert.rejects(
      () => verifyRestoreDrill({
        sourceBaseURL: sourceServer.baseURL,
        targetBaseURL: sourceServer.baseURL,
        sourceAdminToken: adminToken,
        targetAdminToken: adminToken,
        representativeUserID,
        targetIsolated: true,
        providerWritesDisabled: true,
        expectedTargetStorage: "file",
        sourceAssetCount: 1,
        targetAssetCount: 1,
        sourceAssetInventoryTimestamp: new Date().toISOString()
      }),
      /different origins/
    );

    process.stdout.write(`${JSON.stringify({
      environment: "local-file-backup-restore-rehearsal",
      isolatedTargetEnforced: true,
      providerWritesDisabled: true,
      aggregateAndRepresentativeRecordsMatched: true,
      missingResearchAnswerDetected: true,
      privateAssetInventoryCompared: true,
      paidProviderCalls: 0,
      productionWrites: 0,
      pass: true
    }, null, 2)}\n`);
  } finally {
    await Promise.all([stopPermitextServer(sourceServer), stopPermitextServer(targetServer)]);
    await rm(tempDir, { recursive: true, force: true });
  }
}

await main();
