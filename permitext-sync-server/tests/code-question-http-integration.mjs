import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { request as nodeHTTPRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
  computeDependencyHash,
  contentHash
} from "../code-question-contract.mjs";

const port = 12_000 + (process.pid % 30_000);
const baseURL = `http://127.0.0.1:${port}`;
const grantToken = "code-question-http-grant";
const defaultSyncCodeVersion =
  "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";

function bodyFor(account, body = {}) {
  return {
    auth: { accountUserID: account.userID },
    ...body
  };
}

async function request(path, { method = "POST", body, token } = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const json = text && response.headers.get("content-type")?.includes("application/json")
    ? JSON.parse(text)
    : null;
  return { response, json, text };
}

async function isolatedRequest(path, { body, token }) {
  const encodedBody = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const request = nodeHTTPRequest(`${baseURL}${path}`, {
      method: "POST",
      agent: false,
      headers: {
        "content-type": "application/json",
        "content-length": String(encodedBody.length),
        ...(token ? { authorization: `Bearer ${token}` } : {})
      }
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        const json = text && String(response.headers["content-type"] || "").includes("application/json")
          ? JSON.parse(text)
          : null;
        resolve({
          response: {
            status: response.statusCode,
            ok: Number(response.statusCode) >= 200 && Number(response.statusCode) < 300
          },
          json,
          text
        });
      });
    });
    request.on("error", reject);
    request.end(encodedBody);
  });
}

async function expectStatus(result, status, message) {
  assert.equal(
    result.response.status,
    status,
    `${message}: expected ${status}, received ${result.response.status} ${result.text}`
  );
  return result.json;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const result = await request("/health", { method: "GET" });
      if (result.response.ok) return;
    } catch {
      // The listener is still starting.
    }
    await sleep(100);
  }
  throw new Error("Code Question HTTP test server did not become ready.");
}

async function grant(userID) {
  const result = await request("/admin/lifetime-grants/grant", {
    token: grantToken,
    body: { userID }
  });
  await expectStatus(result, 200, `Granting Pro to ${userID}`);
}

async function signIn(providerUserID, { email = "", displayName = providerUserID } = {}) {
  const result = await request("/account/sign-in", {
    body: {
      credential: {
        provider: "apple",
        providerUserID,
        email,
        displayName
      }
    }
  });
  const payload = await expectStatus(result, 200, `Signing in ${providerUserID}`);
  return {
    userID: payload.account.appUserID,
    token: payload.account.backendSessionToken,
    email,
    displayName
  };
}

async function postAs(account, path, body) {
  return request(path, {
    token: account.token,
    body: bodyFor(account, body)
  });
}

async function postAsIsolated(account, path, body) {
  return isolatedRequest(path, {
    token: account.token,
    body: bodyFor(account, body)
  });
}

async function inviteAndAccept(owner, member, organizationID, projectID, role) {
  const invited = await postAs(owner, "/organizations/members/invite", {
    organizationID,
    projectID,
    email: member.email,
    role
  });
  const invitation = await expectStatus(invited, 201, `Inviting Project ${role}`);
  const accepted = await postAs(member, "/organizations/invitations/accept", {
    invitationToken: invitation.invitationToken
  });
  const acceptance = await expectStatus(accepted, 200, `Accepting Project ${role}`);
  assert.equal(acceptance.organization.role, role);
}

function definitionHash(question) {
  return contentHash({
    questionText: question.questionText,
    scope: question.scope || "",
    jurisdiction: question.jurisdiction || "",
    asOfDate: question.asOfDate || null,
    definitionRevision: question.definitionRevision
  });
}

function inputHash(inputs) {
  return contentHash(inputs.map((input) => ({
    id: input.id,
    inputKind: input.inputKind,
    state: input.state,
    statement: input.statement,
    revision: input.revision
  })));
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "permitext-code-question-http-"));
  const dataPath = join(tempDir, "sync-store.json");
  const privateAssetPath = join(tempDir, "private-assets");
  let serverOutput = "";
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      VERCEL: "",
      VERCEL_ENV: "",
      PERMITEXT_SYNC_DATA_PATH: dataPath,
      PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: privateAssetPath,
      PERMITEXT_SYNC_DATABASE_URL: "",
      DATABASE_URL: "",
      STORAGE_URL: "",
      POSTGRES_URL: "",
      NEON_DATABASE_URL: "",
      BLOB_READ_WRITE_TOKEN: "",
      VERCEL_OIDC_TOKEN: "",
      BLOB_STORE_ID: "",
      PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: grantToken,
      PERMITEXT_CODE_QUESTION_WORKSPACE: "1",
      PERMITEXT_RESEARCH_MOCK: "1",
      PERMITEXT_RESEARCH_MOCK_DELAY_MS: "100",
      PERMITEXT_TEST_CONCURRENT_CODE_QUESTION_ANALYSIS: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  server.stdout.on("data", (chunk) => { serverOutput += chunk; });
  server.stderr.on("data", (chunk) => { serverOutput += chunk; });

  try {
    await waitForServer();

    const identities = {
      owner: { provider: "cq-http-owner", email: "cq-owner@example.test", name: "CQ Owner" },
      editor: { provider: "cq-http-editor", email: "cq-editor@example.test", name: "CQ Editor" },
      reviewer: { provider: "cq-http-reviewer", email: "cq-reviewer@example.test", name: "CQ Reviewer" },
      viewer: { provider: "cq-http-viewer", email: "cq-viewer@example.test", name: "CQ Viewer" },
      outsider: { provider: "cq-http-outsider", email: "cq-outsider@example.test", name: "CQ Outsider" }
    };
    await Promise.all(Object.values(identities).map(({ provider }) => grant(`apple:${provider}`)));
    let owner = await signIn(identities.owner.provider, {
      email: identities.owner.email,
      displayName: identities.owner.name
    });
    const editor = await signIn(identities.editor.provider, {
      email: identities.editor.email,
      displayName: identities.editor.name
    });
    const reviewer = await signIn(identities.reviewer.provider, {
      email: identities.reviewer.email,
      displayName: identities.reviewer.name
    });
    let viewer = await signIn(identities.viewer.provider, {
      email: identities.viewer.email,
      displayName: identities.viewer.name
    });
    const outsider = await signIn(identities.outsider.provider, {
      email: identities.outsider.email,
      displayName: identities.outsider.name
    });

    const projectID = `cq-http-project-${Date.now()}`;
    const projectPush = await postAs(owner, "/sync/push", {
      batch: {
        user: { id: owner.userID },
        mutations: [{
          project: {
            id: `cq-http-project-record-${Date.now()}`,
            userID: owner.userID,
            codeVersion: defaultSyncCodeVersion,
            clientID: projectID,
            name: "Code Question HTTP Project",
            address: "100 Integration Test Place",
            description: "Server-authoritative Code Question integration fixture.",
            colorHex: "#6674c8",
            sortOrder: 0,
            updatedAt: new Date().toISOString()
          }
        }, {
          savedItem: {
            id: "cq-http-owner-unassigned-saved-item",
            userID: owner.userID,
            codeVersion: defaultSyncCodeVersion,
            codePrefix: "BC",
            chapterNumber: "synthetic",
            sectionID: "cq-http-unassigned-section",
            sectionNumber: "SYNTHETIC-PRIVATE",
            title: "Owner-only unassigned legacy passage",
            noteBody: "This unassigned account material must not be visible to shared Project members.",
            updatedAt: new Date().toISOString()
          }
        }]
      }
    });
    await expectStatus(projectPush, 200, "Creating the Project through sync");

    const organizationResult = await postAs(owner, "/organizations/create", {
      name: "Code Question HTTP Studio"
    });
    const organization = await expectStatus(organizationResult, 201, "Creating the organization");
    const organizationID = organization.organization.id;
    const transfer = await postAs(owner, "/organizations/projects/transfer", {
      organizationID,
      projectID
    });
    await expectStatus(transfer, 200, "Transferring the Project to the organization");

    await inviteAndAccept(owner, editor, organizationID, projectID, "editor");
    await inviteAndAccept(owner, reviewer, organizationID, projectID, "reviewer");
    await inviteAndAccept(owner, viewer, organizationID, projectID, "viewer");

    const outsiderProjectID = `cq-http-outsider-project-${Date.now()}`;
    const outsiderProjectPush = await postAs(outsider, "/sync/push", {
      batch: {
        user: { id: outsider.userID },
        mutations: [{
          project: {
            id: `cq-http-outsider-project-record-${Date.now()}`,
            userID: outsider.userID,
            codeVersion: defaultSyncCodeVersion,
            clientID: outsiderProjectID,
            name: "Separate Organization Project",
            address: "200 Isolation Test Place",
            description: "Valid second-organization isolation fixture.",
            colorHex: "#3f8b74",
            sortOrder: 0,
            updatedAt: new Date().toISOString()
          }
        }]
      }
    });
    await expectStatus(outsiderProjectPush, 200, "Creating a Project for the second organization");
    const outsiderOrganizationResult = await postAs(outsider, "/organizations/create", {
      name: "Separate Code Question Studio"
    });
    const outsiderOrganization = await expectStatus(
      outsiderOrganizationResult,
      201,
      "Creating the second organization"
    );
    const outsiderTransfer = await postAs(outsider, "/organizations/projects/transfer", {
      organizationID: outsiderOrganization.organization.id,
      projectID: outsiderProjectID
    });
    await expectStatus(outsiderTransfer, 200, "Transferring the second organization's Project");
    await expectStatus(
      await postAs(outsider, "/projects/code-questions/list", { projectID: outsiderProjectID }),
      200,
      "Reading a valid Project in the second organization"
    );
    const crossOrganizationRead = await postAs(owner, "/projects/code-questions/list", {
      projectID: outsiderProjectID,
      organizationRole: "owner"
    });
    assert.equal(crossOrganizationRead.response.status, 404, "An Owner crossed organization isolation.");

    const ownerLegacyResult = await postAs(owner, "/projects/code-questions/legacy/list", { projectID });
    const ownerLegacy = await expectStatus(ownerLegacyResult, 200, "Listing the owner's legacy inventory");
    const privateLegacyItem = ownerLegacy.items.find((item) =>
      item.title.includes("Owner-only unassigned legacy passage")
    );
    assert.ok(privateLegacyItem);
    assert.equal(privateLegacyItem.assignment, "unassigned");
    const editorLegacyResult = await postAs(editor, "/projects/code-questions/legacy/list", { projectID });
    const editorLegacy = await expectStatus(editorLegacyResult, 200, "Listing shared Project legacy inventory");
    assert.ok(!editorLegacy.items.some((item) => item.sourceID === privateLegacyItem.sourceID));
    const hiddenLegacyPromotion = await postAs(editor, "/projects/code-questions/legacy/promote", {
      projectID,
      sourceKind: "savedItem",
      sourceID: privateLegacyItem.sourceID,
      createQuestion: {
        title: "Must not be created",
        questionText: "Can shared members promote unrelated owner material?"
      }
    });
    assert.equal(hiddenLegacyPromotion.response.status, 404);

    // The server derives authorization from the authenticated Project membership. Body role claims are ignored.
    const viewerCreate = await postAs(viewer, "/projects/code-questions/create", {
      projectID,
      organizationRole: "owner",
      role: "owner",
      title: "Viewer must not create this",
      questionText: "Can a forged owner role bypass Project membership authorization?"
    });
    assert.equal(viewerCreate.response.status, 403, "A Viewer forged an Owner role in the request body.");
    assert.equal(viewerCreate.json.code, "PROJECT_PERMISSION_REQUIRED");

    const createPayload = {
      projectID,
      organizationRole: "viewer",
      id: "cq-http-question-1",
      title: "Corridor width",
      questionText: "What minimum clear width applies to the primary corridor?",
      scope: "Primary corridor serving the tenant space",
      desiredOutput: "Issued professional Code Memo",
      jurisdiction: "New York City",
      asOfDate: "2026-08-07T00:00:00.000Z"
    };
    const create = await postAs(editor, "/projects/code-questions/create", createPayload);
    const created = await expectStatus(create, 201, "Creating a Code Question as Editor");
    assert.equal(created.question.createdBy, editor.userID);
    assert.equal(created.activity.actorUserID, editor.userID);
    assert.equal(created.activity.owner.organizationID, organizationID);
    let question = created.question;
    const createReplay = await postAs(editor, "/projects/code-questions/create", createPayload);
    const replayedCreate = await expectStatus(createReplay, 200, "Replaying a stable Code Question create ID");
    assert.equal(replayedCreate.replayed, true);
    assert.equal(replayedCreate.question.id, question.id);
    assert.equal(replayedCreate.question.questionNumber, question.questionNumber);
    const hostileCreate = await postAs(editor, "/projects/code-questions/create", {
      ...createPayload,
      questionText: "Hostile reuse of a stable Code Question ID."
    });
    assert.equal(hostileCreate.response.status, 409);
    assert.equal(hostileCreate.json.code, "CODE_QUESTION_IDEMPOTENCY_CONFLICT");

    const definitionPayload = {
      projectID,
      questionID: question.id,
      expectedVersion: question.version,
      title: question.title,
      questionText: question.questionText,
      scope: "Primary corridor serving fewer than 50 occupants",
      desiredOutput: question.desiredOutput,
      jurisdiction: question.jurisdiction,
      asOfDate: question.asOfDate
    };
    const updated = await postAs(editor, "/projects/code-questions/definition/save", definitionPayload);
    question = (await expectStatus(updated, 200, "Persisting a definition revision")).question;
    assert.equal(question.version, 2);
    assert.equal(question.definitionRevision, 2);
    const definitionReplay = await postAs(editor, "/projects/code-questions/definition/save", definitionPayload);
    const replayedDefinition = await expectStatus(definitionReplay, 200, "Replaying an ambiguous Definition success");
    assert.equal(replayedDefinition.replayed, true);
    assert.equal(replayedDefinition.question.version, 2);

    // A clean second sign-in rotates the session and must reconstruct state from server storage.
    owner = await signIn(identities.owner.provider, {
      email: identities.owner.email,
      displayName: identities.owner.name
    });
    const secondSessionState = await postAs(owner, "/projects/code-questions/state", {
      projectID,
      questionID: question.id
    });
    const hydrated = await expectStatus(secondSessionState, 200, "Hydrating from a second clean session");
    assert.equal(hydrated.question.payload.scope, question.scope);
    assert.equal(hydrated.question.envelope.version, 2);
    assert.equal(hydrated.access.role, "owner");

    const outsiderRead = await postAs(outsider, "/projects/code-questions/state", {
      projectID,
      questionID: question.id,
      organizationRole: "owner"
    });
    assert.equal(outsiderRead.response.status, 404, "An unrelated account read private Project data.");

    const inputCreatePayload = {
      projectID,
      questionID: question.id,
      id: "cq-http-input-1",
      kind: "confirmedFact",
      statement: "The primary corridor serves fewer than 50 occupants.",
      state: "confirmed",
      basis: "Project occupancy schedule."
    };
    const inputResult = await postAs(editor, "/projects/code-questions/inputs/save", inputCreatePayload);
    let input = (await expectStatus(inputResult, 201, "Saving a Question Input")).input;
    const inputCreateReplay = await postAs(editor, "/projects/code-questions/inputs/save", inputCreatePayload);
    const replayedInputCreate = await expectStatus(inputCreateReplay, 200, "Replaying a stable Question Input create ID");
    assert.equal(replayedInputCreate.replayed, true);
    assert.equal(replayedInputCreate.input.version, 1);
    const hostileInputCreate = await postAs(editor, "/projects/code-questions/inputs/save", {
      ...inputCreatePayload,
      statement: "Hostile reuse of the stable Question Input ID."
    });
    assert.equal(hostileInputCreate.response.status, 409);
    assert.equal(hostileInputCreate.json.code, "CODE_QUESTION_IDEMPOTENCY_CONFLICT");
    const inputRevisionPayload = {
      projectID,
      questionID: question.id,
      id: input.id,
      expectedVersion: input.version,
      statement: input.statement,
      state: input.state,
      basis: "Project occupancy schedule, professionally confirmed."
    };
    const inputRevisionResult = await postAs(editor, "/projects/code-questions/inputs/save", inputRevisionPayload);
    input = (await expectStatus(inputRevisionResult, 200, "Revising a Question Input")).input;
    assert.equal(input.version, 2);
    const inputRevisionReplay = await postAs(editor, "/projects/code-questions/inputs/save", inputRevisionPayload);
    const replayedInputRevision = await expectStatus(inputRevisionReplay, 200, "Replaying an ambiguous Question Input revision");
    assert.equal(replayedInputRevision.replayed, true);
    assert.equal(replayedInputRevision.input.version, 2);
    const conflictingInputRevision = await postAs(editor, "/projects/code-questions/inputs/save", {
      ...inputRevisionPayload,
      basis: "Different stale intent."
    });
    assert.equal(conflictingInputRevision.response.status, 409);
    assert.equal(conflictingInputRevision.json.code, "CODE_QUESTION_VERSION_CONFLICT");

    const snapshotPayload = {
      projectID,
      questionID: question.id,
      id: "cq-http-snapshot-1",
      sourceIdentity: "synthetic:http-integration-fixture",
      passageLocator: "SYNTHETIC HTTP § 1.1",
      quotedText: "[SYNTHETIC] Corridors serving fewer than 50 occupants shall have a clear width not less than 36 inches.",
      sourceVersion: "synthetic-v1"
    };
    const snapshotResult = await postAs(editor, "/projects/code-questions/evidence/snapshot", snapshotPayload);
    const snapshot = (await expectStatus(snapshotResult, 201, "Creating an immutable evidence snapshot")).snapshot;
    const snapshotReplay = await postAs(editor, "/projects/code-questions/evidence/snapshot", snapshotPayload);
    const replayedSnapshot = await expectStatus(snapshotReplay, 200, "Replaying a stable evidence snapshot ID");
    assert.equal(replayedSnapshot.replayed, true);
    assert.equal(replayedSnapshot.snapshot.id, snapshot.id);
    const hostileSnapshot = await postAs(editor, "/projects/code-questions/evidence/snapshot", {
      ...snapshotPayload,
      quotedText: "[SYNTHETIC] Hostile content under a reused immutable snapshot ID."
    });
    assert.equal(hostileSnapshot.response.status, 409);
    assert.equal(hostileSnapshot.json.code, "CODE_QUESTION_IDEMPOTENCY_CONFLICT");

    const viewerApproveEvidence = await postAs(viewer, "/projects/code-questions/evidence/approve-set", {
      projectID,
      questionID: question.id,
      organizationRole: "reviewer",
      entries: [{
        snapshotID: snapshot.id,
        role: "governing",
        analysisEligible: true,
        approvalActor: viewer.userID,
        approvalAt: new Date().toISOString(),
        sourceVerificationState: "synthetic-fixture"
      }]
    });
    assert.equal(viewerApproveEvidence.response.status, 403, "A Viewer forged Reviewer evidence approval.");

    const hostileApprovalAt = "2000-01-01T00:00:00.000Z";
    const evidenceSetPayload = {
      projectID,
      questionID: question.id,
      id: "cq-http-evidence-set-1",
      entries: [{
        snapshotID: snapshot.id,
        role: "governing",
        analysisEligible: true,
        qualification: "Synthetic route-contract evidence only.",
        professionalNote: "Approved for the integration fixture.",
        approvalActor: outsider.userID,
        approvalAt: hostileApprovalAt,
        sourceVerificationState: "synthetic-fixture",
        projectApplicabilityNote: "Applies only to this synthetic fixture."
      }]
    };
    const evidenceSetResult = await postAs(reviewer, "/projects/code-questions/evidence/approve-set", evidenceSetPayload);
    const evidenceSet = (await expectStatus(evidenceSetResult, 201, "Approving the Evidence Set as Reviewer")).evidenceSet;
    assert.equal(evidenceSet.entries[0].approvalActor, reviewer.userID);
    assert.notEqual(evidenceSet.entries[0].approvalAt, hostileApprovalAt);
    assert.ok(Number.isFinite(Date.parse(evidenceSet.entries[0].approvalAt)));
    const evidenceSetReplay = await postAs(reviewer, "/projects/code-questions/evidence/approve-set", evidenceSetPayload);
    const replayedEvidenceSet = await expectStatus(evidenceSetReplay, 200, "Replaying a stable Evidence Set ID");
    assert.equal(replayedEvidenceSet.replayed, true);
    assert.equal(replayedEvidenceSet.evidenceSet.id, evidenceSet.id);
    assert.equal(replayedEvidenceSet.evidenceSet.version, evidenceSet.version);
    const hostileEvidenceSet = await postAs(reviewer, "/projects/code-questions/evidence/approve-set", {
      ...evidenceSetPayload,
      entries: evidenceSetPayload.entries.map((entry) => ({ ...entry, role: "informative" }))
    });
    assert.equal(hostileEvidenceSet.response.status, 409);
    assert.equal(hostileEvidenceSet.json.code, "CODE_QUESTION_IDEMPOTENCY_CONFLICT");

    const inputs = [input];
    const binding = {
      definitionRevision: question.definitionRevision,
      definitionHash: definitionHash(question),
      inputSnapshotIDs: inputs.map((item) => item.id),
      inputSetHash: inputHash(inputs),
      evidenceSetID: evidenceSet.id,
      evidenceSetVersion: evidenceSet.version,
      evidenceSetHash: evidenceSet.contentHash,
      dependencyHash: computeDependencyHash({
        questionText: question.questionText,
        scope: question.scope,
        jurisdiction: question.jurisdiction,
        asOfDate: question.asOfDate,
        inputs,
        evidenceSet
      })
    };
    const analysisResult = await postAs(editor, "/projects/code-questions/analysis/create", {
      projectID,
      questionID: question.id,
      requestID: "cq-http-analysis-request-1",
      ...binding
    });
    const analysisPayload = await expectStatus(analysisResult, 201, "Running server bounded analysis");
    const analysis = analysisPayload.analysis;
    assert.equal(analysis.evidenceSetID, evidenceSet.id);
    assert.equal(analysis.evidenceSetVersion, evidenceSet.version);
    assert.equal(analysis.evidenceSetHash, evidenceSet.contentHash);
    assert.equal(analysis.dependencyHash, binding.dependencyHash);
    assert.deepEqual(analysis.inputSnapshotIDs, [input.id]);
    assert.deepEqual(
      analysisPayload.answer.evidence.map((item) => item.sourceID),
      [snapshot.id],
      "Analysis used evidence outside the approved set."
    );
    const analysisReplay = await postAs(editor, "/projects/code-questions/analysis/create", {
      projectID,
      questionID: question.id,
      requestID: "cq-http-analysis-request-1",
      ...binding
    });
    const replayedAnalysis = await expectStatus(analysisReplay, 200, "Replaying an idempotent analysis request");
    assert.equal(replayedAnalysis.replayed, true);
    assert.equal(replayedAnalysis.analysis.id, analysis.id);

    const hostileConclusion = await postAs(editor, "/projects/code-questions/conclusions/publish", {
      projectID,
      questionID: question.id,
      ...binding,
      conclusionText: "This hostile conclusion must not persist.",
      reasoning: "It cites a source outside the approved set.",
      citations: ["unapproved-hostile-snapshot"],
      analysisRunID: analysis.id,
      analysisDependencyHash: binding.dependencyHash
    });
    assert.equal(hostileConclusion.response.status, 409);
    assert.equal(hostileConclusion.json.code, "INVALID_RESEARCH_CITATION");

    const conclusionResult = await postAs(editor, "/projects/code-questions/conclusions/publish", {
      projectID,
      questionID: question.id,
      ...binding,
      conclusionText: "The approved synthetic evidence supports a 36-inch minimum for the stated fixture conditions.",
      reasoning: "The conclusion is bounded to the approved passage and confirmed Project input.",
      citations: [snapshot.id],
      assumptions: [],
      unknowns: [],
      analysisRunID: analysis.id,
      analysisDependencyHash: binding.dependencyHash,
      aiAssistanceDisclosure: "Started from bounded Permitext analysis and professionally reviewed."
    });
    const conclusion = (await expectStatus(conclusionResult, 201, "Publishing a professional conclusion")).conclusion;

    const blockingReviewResult = await postAs(reviewer, "/projects/collaboration/threads/save", {
      projectID,
      questionID: question.id,
      expectedVersion: 0,
      requestType: "interpretation-review",
      kind: "general-review",
      status: "open",
      targetKind: "professionalConclusion",
      targetID: conclusion.id,
      targetAnchor: {
        anchorKind: "conclusion",
        anchorID: conclusion.id,
        label: "Current professional conclusion"
      },
      blocking: true,
      title: "Confirm the conclusion remains bounded to approved evidence",
      body: "This blocking request must be resolved before conclusion approval."
    });
    const blockingReview = (await expectStatus(
      blockingReviewResult,
      201,
      "Opening a blocking Review Request"
    )).thread;

    const blockedConclusionApproval = await postAs(reviewer, "/projects/code-questions/conclusions/approve", {
      projectID,
      questionID: question.id,
      conclusionID: conclusion.id,
      approvalBasis: "This must remain blocked while the Review Request is open."
    });
    assert.equal(blockedConclusionApproval.response.status, 409);
    assert.equal(blockedConclusionApproval.json.code, "BLOCKING_REVIEW_REQUESTS_OPEN");
    assert.deepEqual(blockedConclusionApproval.json.requestIDs, [blockingReview.id]);

    const resolvedReviewResult = await postAs(reviewer, "/projects/collaboration/threads/save", {
      projectID,
      questionID: question.id,
      threadID: blockingReview.id,
      expectedVersion: blockingReview.version,
      status: "resolved",
      resolution: "The conclusion was checked against the exact approved snapshot and dependency binding."
    });
    const resolvedReview = (await expectStatus(
      resolvedReviewResult,
      200,
      "Resolving the blocking Review Request"
    )).thread;
    assert.equal(resolvedReview.status, "resolved");

    const conclusionApprovalResult = await postAs(reviewer, "/projects/code-questions/conclusions/approve", {
      projectID,
      questionID: question.id,
      conclusionID: conclusion.id,
      approvalBasis: "Reviewed the exact conclusion revision, evidence set, and dependency binding."
    });
    const conclusionApproval = (await expectStatus(
      conclusionApprovalResult,
      201,
      "Approving the conclusion as Reviewer"
    )).approval;

    const memoResult = await postAs(editor, "/projects/code-questions/memos/prepare", {
      projectID,
      questionID: question.id,
      title: "Q-001 Corridor Width Code Memo",
      narrative: "Synthetic HTTP integration record.",
      includeAnalysis: false
    });
    const memo = (await expectStatus(memoResult, 201, "Preparing the server Code Memo")).draft;
    const memoReadyResult = await postAs(editor, "/projects/code-questions/memos/ready", {
      projectID,
      questionID: question.id,
      draftID: memo.id
    });
    await expectStatus(memoReadyResult, 201, "Marking the Code Memo ready");
    const memoApprovalResult = await postAs(reviewer, "/projects/code-questions/memos/approve", {
      projectID,
      questionID: question.id,
      draftID: memo.id,
      approvalBasis: "Reviewed the exact immutable Code Memo draft."
    });
    const memoApproval = (await expectStatus(
      memoApprovalResult,
      201,
      "Approving the Code Memo as Reviewer"
    )).approval;

    const editorIssue = await postAs(editor, "/projects/code-questions/issue/start", {
      projectID,
      questionID: question.id,
      draftID: memo.id,
      idempotencyKey: "cq-http-issue-1",
      organizationRole: "owner"
    });
    assert.equal(editorIssue.response.status, 403, "An Editor forged Owner issuance authorization.");
    assert.equal(editorIssue.json.code, "PROJECT_PERMISSION_REQUIRED");

    const issueStart = await postAs(owner, "/projects/code-questions/issue/start", {
      projectID,
      questionID: question.id,
      draftID: memo.id,
      idempotencyKey: "cq-http-issue-1"
    });
    let pending = (await expectStatus(issueStart, 201, "Reserving server issuance as Owner")).pending;
    const failedIssue = await postAs(owner, "/projects/code-questions/issue/fail", {
      projectID,
      questionID: question.id,
      pendingID: pending.id,
      error: "Synthetic interruption before output generation."
    });
    const failedPending = (await expectStatus(
      failedIssue,
      200,
      "Recording a recoverable issuance interruption"
    )).pending;
    assert.equal(failedPending.status, "failed");

    const recoveredIssueStart = await postAs(owner, "/projects/code-questions/issue/start", {
      projectID,
      questionID: question.id,
      draftID: memo.id,
      idempotencyKey: "cq-http-issue-1"
    });
    const recoveredReservation = await expectStatus(
      recoveredIssueStart,
      200,
      "Recovering issuance with the same idempotency key"
    );
    assert.equal(recoveredReservation.replayed, true);
    assert.equal(recoveredReservation.recovered, true);
    assert.equal(recoveredReservation.pending.id, pending.id);
    assert.equal(recoveredReservation.pending.status, "reserved");
    pending = recoveredReservation.pending;

    const replayedIssueStart = await postAs(owner, "/projects/code-questions/issue/start", {
      projectID,
      questionID: question.id,
      draftID: memo.id,
      idempotencyKey: "cq-http-issue-1"
    });
    const replayedReservation = await expectStatus(
      replayedIssueStart,
      200,
      "Replaying the recovered issuance reservation"
    );
    assert.equal(replayedReservation.replayed, true);
    assert.equal(replayedReservation.recovered, false);
    assert.equal(replayedReservation.pending.id, pending.id);
    const issueComplete = await postAs(owner, "/projects/code-questions/issue/complete", {
      projectID,
      questionID: question.id,
      pendingID: pending.id
    });
    const issued = await expectStatus(issueComplete, 201, "Completing server issuance");
    assert.equal(issued.issuedRecord.issueVersion, 1);
    assert.equal(issued.issuedRecord.questionID, question.id);
    assert.equal(issued.outputs.length, 3);
    assert.ok(issued.outputs.every((output) => output.contentHash));
    const issuedList = await expectStatus(
      await postAs(owner, "/projects/code-questions/list", { projectID }),
      200,
      "Listing server-derived Code Decision summaries after issuance"
    );
    const issuedSummary = issuedList.questions.find((item) => item.id === question.id)?.summary;
    assert.equal(issuedSummary.latestIssuedVersion, 1);
    assert.equal(issuedSummary.conclusionCount, 1);
    assert.equal(issuedSummary.missingInformationCount, 0);
    assert.equal(issuedSummary.blockingReviewCount, 0);
    assert.equal(issuedSummary.revisionInProgress, false);

    const replayedIssueComplete = await postAs(owner, "/projects/code-questions/issue/complete", {
      projectID,
      questionID: question.id,
      pendingID: pending.id
    });
    const replayedIssued = await expectStatus(
      replayedIssueComplete,
      200,
      "Replaying completed issuance without creating a second version"
    );
    assert.equal(replayedIssued.replayed, true);
    assert.equal(replayedIssued.issuedRecord.id, issued.issuedRecord.id);
    assert.equal(replayedIssued.issuedRecord.issueVersion, 1);

    const replacementMemoResult = await postAs(editor, "/projects/code-questions/memos/prepare", {
      projectID,
      questionID: question.id,
      title: "Q-001 Corridor Width Code Memo — replacement draft",
      narrative: "A separately approved draft must not reuse the first draft's issuance key.",
      includeAnalysis: false
    });
    const replacementMemo = (await expectStatus(
      replacementMemoResult,
      201,
      "Preparing a distinct replacement Code Memo"
    )).draft;
    await expectStatus(await postAs(editor, "/projects/code-questions/memos/ready", {
      projectID,
      questionID: question.id,
      draftID: replacementMemo.id
    }), 201, "Marking the replacement Code Memo ready");
    await expectStatus(await postAs(reviewer, "/projects/code-questions/memos/approve", {
      projectID,
      questionID: question.id,
      draftID: replacementMemo.id,
      approvalBasis: "Separately approved to test issuance-key intent binding."
    }), 201, "Approving the replacement Code Memo");
    const hostileIssuanceKeyReuse = await postAs(owner, "/projects/code-questions/issue/start", {
      projectID,
      questionID: question.id,
      draftID: replacementMemo.id,
      idempotencyKey: "cq-http-issue-1"
    });
    assert.equal(hostileIssuanceKeyReuse.response.status, 409);
    assert.equal(hostileIssuanceKeyReuse.json.code, "CODE_QUESTION_IDEMPOTENCY_CONFLICT");

    viewer = await signIn(identities.viewer.provider, {
      email: identities.viewer.email,
      displayName: identities.viewer.name
    });
    const issuedStateResult = await postAs(viewer, "/projects/code-questions/state", {
      projectID,
      questionID: question.id
    });
    const issuedState = await expectStatus(issuedStateResult, 200, "Hydrating issued state as Viewer");
    assert.ok(issuedState.artifacts.some((item) =>
      item.envelope.type === "issuedDecisionRecord" && item.envelope.id === issued.issuedRecord.id
    ));
    assert.equal(issuedState.access.role, "viewer");
    const hydratedArtifacts = new Map(issuedState.artifacts.map((item) => [item.envelope.id, item]));
    [
      input.id,
      snapshot.id,
      evidenceSet.id,
      analysis.id,
      conclusion.id,
      conclusionApproval.id,
      blockingReview.id,
      memo.id,
      memoApproval.id,
      issued.issuedRecord.id
    ].forEach((id) => assert.ok(hydratedArtifacts.has(id), `Clean-session hydration omitted ${id}.`));
    assert.equal(hydratedArtifacts.get(blockingReview.id).payload.status, "resolved");
    assert.equal(hydratedArtifacts.get(evidenceSet.id).payload.contentHash, evidenceSet.contentHash);
    assert.equal(hydratedArtifacts.get(analysis.id).payload.dependencyHash, binding.dependencyHash);
    assert.equal(hydratedArtifacts.get(conclusion.id).payload.evidenceSetHash, evidenceSet.contentHash);
    assert.equal(hydratedArtifacts.get(issued.issuedRecord.id).payload.predecessorID, null);
    assert.equal(hydratedArtifacts.get(issued.issuedRecord.id).payload.issueVersion, 1);
    assert.equal(issuedState.analysisBinding.dependencyHash, binding.dependencyHash);
    assert.equal(issuedState.researchAnswers.length, 1);
    assert.equal(issuedState.researchAnswers[0].id, analysisPayload.answer.id);
    assert.deepEqual(
      issuedState.researchAnswers[0].evidence.map((item) => item.sourceID),
      [snapshot.id]
    );

    // Simulate a client-side offline queue, reconnect replay, authoritative hydration, and CAS conflict.
    const queuedPayload = {
      projectID,
      questionID: question.id,
      expectedVersion: question.version,
      title: question.title,
      questionText: question.questionText,
      scope: "Offline-authored scope revision replayed after reconnect",
      desiredOutput: question.desiredOutput,
      jurisdiction: question.jurisdiction,
      asOfDate: question.asOfDate
    };
    const queued = await postAs(editor, "/projects/code-questions/outbox/enqueue", {
      projectID,
      commandKind: "codeQuestion.update",
      idempotencyKey: "cq-http-offline-update-1",
      payload: queuedPayload
    });
    const queuedEntry = (await expectStatus(queued, 201, "Queueing an offline mutation")).entry;
    assert.equal(queuedEntry.idempotencyKey, "cq-http-offline-update-1");
    assert.equal(queuedEntry.status, "queued");
    assert.equal(queuedEntry.payload.questionID, question.id);

    const replay = await postAs(editor, "/projects/code-questions/definition/save", queuedPayload);
    const replayedQuestion = (await expectStatus(replay, 200, "Replaying the queued mutation after reconnect")).question;
    assert.equal(replayedQuestion.scope, queuedPayload.scope);
    const replayHydration = await postAs(owner, "/projects/code-questions/state", {
      projectID,
      questionID: question.id
    });
    const replayedState = await expectStatus(replayHydration, 200, "Hydrating the authoritative replay result");
    assert.equal(replayedState.question.payload.scope, queuedPayload.scope);

    const ambiguousDefinitionReplay = await postAs(editor, "/projects/code-questions/definition/save", queuedPayload);
    const acknowledgedDefinitionReplay = await expectStatus(
      ambiguousDefinitionReplay,
      200,
      "Acknowledging an ambiguous-success offline Definition replay"
    );
    assert.equal(acknowledgedDefinitionReplay.replayed, true);
    assert.equal(acknowledgedDefinitionReplay.question.version, 3);

    const conflict = await postAs(editor, "/projects/code-questions/definition/save", {
      ...queuedPayload,
      scope: "A genuinely different stale offline intent"
    });
    assert.equal(conflict.response.status, 409, "A different stale offline replay overwrote the current revision.");
    assert.equal(conflict.json.code, "CODE_QUESTION_VERSION_CONFLICT");

    const reboundAnalysisReplay = await postAs(editor, "/projects/code-questions/analysis/create", {
      projectID,
      questionID: question.id,
      requestID: "cq-http-analysis-request-1",
      ...replayedState.analysisBinding
    });
    assert.equal(reboundAnalysisReplay.response.status, 409);
    assert.equal(reboundAnalysisReplay.json.code, "CODE_QUESTION_IDEMPOTENCY_CONFLICT");

    const staleAnalysis = await postAs(editor, "/projects/code-questions/analysis/create", {
      projectID,
      questionID: question.id,
      requestID: "cq-http-analysis-after-definition-change",
      ...binding
    });
    assert.equal(staleAnalysis.response.status, 409, "Analysis accepted a stale upstream Definition binding.");
    assert.equal(staleAnalysis.json.code, "CODE_QUESTION_VERSION_CONFLICT");

    const finalStateResult = await postAs(owner, "/projects/code-questions/state", {
      projectID,
      questionID: question.id
    });
    const finalState = await expectStatus(finalStateResult, 200, "Fetching final authoritative state");
    assert.ok(finalState.artifacts.some((item) => item.envelope.id === analysis.id));
    assert.ok(finalState.artifacts.some((item) => item.envelope.id === conclusion.id));
    assert.ok(finalState.artifacts.some((item) => item.envelope.id === issued.issuedRecord.id));
    assert.equal(finalState.question.envelope.version, 3);

    const concurrentEvidenceSetResult = await postAs(reviewer, "/projects/code-questions/evidence/approve-set", {
      projectID,
      questionID: question.id,
      id: "cq-http-evidence-set-concurrent",
      entries: evidenceSetPayload.entries
    });
    const concurrentEvidenceSet = (await expectStatus(
      concurrentEvidenceSetResult,
      201,
      "Creating a second valid Evidence Set for concurrent binding tests"
    )).evidenceSet;
    const currentQuestion = { id: question.id, ...finalState.question.payload };
    const currentInputs = [input];
    const bindingFor = (selectedEvidenceSet) => ({
      definitionRevision: currentQuestion.definitionRevision,
      definitionHash: definitionHash(currentQuestion),
      inputSnapshotIDs: currentInputs.map((item) => item.id),
      inputSetHash: inputHash(currentInputs),
      evidenceSetID: selectedEvidenceSet.id,
      evidenceSetVersion: selectedEvidenceSet.version,
      evidenceSetHash: selectedEvidenceSet.contentHash,
      dependencyHash: computeDependencyHash({
        questionText: currentQuestion.questionText,
        scope: currentQuestion.scope,
        jurisdiction: currentQuestion.jurisdiction,
        asOfDate: currentQuestion.asOfDate,
        inputs: currentInputs,
        evidenceSet: selectedEvidenceSet
      })
    });
    const concurrentCurrentBinding = bindingFor(concurrentEvidenceSet);
    const identicalConcurrentResults = await Promise.all([
      postAsIsolated(editor, "/projects/code-questions/analysis/create", {
        projectID,
        questionID: question.id,
        requestID: "cq-http-analysis-identical-concurrent",
        ...concurrentCurrentBinding
      }),
      postAsIsolated(editor, "/projects/code-questions/analysis/create", {
        projectID,
        questionID: question.id,
        requestID: "cq-http-analysis-identical-concurrent",
        ...concurrentCurrentBinding
      })
    ]);
    assert.deepEqual(identicalConcurrentResults.map((result) => result.response.status), [201, 201]);
    assert.equal(
      identicalConcurrentResults[0].json.analysis.id,
      identicalConcurrentResults[1].json.analysis.id,
      "Identical in-flight analysis intent did not share one generation."
    );

    const oldSetCurrentDefinitionBinding = bindingFor(evidenceSet);
    const hostileConcurrentResults = await Promise.all([
      postAsIsolated(editor, "/projects/code-questions/analysis/create", {
        projectID,
        questionID: question.id,
        requestID: "cq-http-analysis-hostile-concurrent",
        ...oldSetCurrentDefinitionBinding
      }),
      postAsIsolated(editor, "/projects/code-questions/analysis/create", {
        projectID,
        questionID: question.id,
        requestID: "cq-http-analysis-hostile-concurrent",
        ...concurrentCurrentBinding
      })
    ]);
    assert.deepEqual(
      hostileConcurrentResults.map((result) => result.response.status).sort((left, right) => left - right),
      [201, 409]
    );
    const hostileConcurrentConflict = hostileConcurrentResults.find((result) => result.response.status === 409);
    assert.equal(hostileConcurrentConflict.json.code, "CODE_QUESTION_IDEMPOTENCY_CONFLICT");

    console.log("code-question-http-integration: all assertions passed");
  } catch (error) {
    if (serverOutput.trim()) {
      console.error("--- code-question HTTP server output ---");
      console.error(serverOutput.trim());
    }
    throw error;
  } finally {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      sleep(2_000)
    ]);
    await rm(tempDir, { recursive: true, force: true });
  }
}

await main();
