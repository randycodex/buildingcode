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
      PERMITEXT_TEST_RESEARCH_MOCK: "1",
      PERMITEXT_TEST_RESEARCH_MOCK_DELAY_MS: "100",
      PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
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

    const ownerSecondaryProjectID = `cq-http-owner-secondary-${Date.now()}`;
    await expectStatus(await postAs(owner, "/sync/push", {
      batch: {
        user: { id: owner.userID },
        mutations: [{
          project: {
            id: `cq-http-owner-secondary-record-${Date.now()}`,
            userID: owner.userID,
            codeVersion: defaultSyncCodeVersion,
            clientID: ownerSecondaryProjectID,
            name: "Code Question Secondary Project",
            address: "300 Authorization Boundary Place",
            description: "Separate owner Project used to verify Research link authorization boundaries.",
            colorHex: "#7d6b9d",
            sortOrder: 1,
            updatedAt: new Date().toISOString()
          }
        }]
      }
    }), 200, "Creating the owner's secondary Project");

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

    // Research remains actor-private while a durable, validated relation lets
    // the exact conversation and shared Code Decision reopen together.
    const researchStart = await postAs(editor, "/projects/code-questions/research/start", {
      projectID,
      questionID: question.id,
      conversationID: "cq-http-research-1"
    });
    const startedResearch = await expectStatus(
      researchStart,
      201,
      "Starting linked Research for a Code Decision"
    );
    assert.equal(startedResearch.conversation.id, "cq-http-research-1");
    assert.equal(startedResearch.conversation.primaryProjectID, projectID);
    assert.equal(startedResearch.conversation.starterQuestion, question.questionText);
    assert.equal(startedResearch.conversation.linkedCodeDecisionID, question.id);
    assert.ok(startedResearch.conversation.codeDecisionLinkVersion >= 1);
    assert.deepEqual(startedResearch.conversation.sources, []);
    assert.deepEqual(startedResearch.conversation.messages, []);

    const candidateDiscovery = await expectStatus(
      await postAs(editor, "/research/evidence/discover", {
        projectID,
        question: question.questionText,
        limit: 12
      }),
      200,
      "Discovering private Research candidates"
    );
    assert.ok(candidateDiscovery.candidates.length >= 2);
    const rejectedCandidate = candidateDiscovery.candidates[0];
    const rejectCandidate = await expectStatus(
      await postAs(editor, "/research/conversations/candidate-disposition", {
        conversationID: startedResearch.conversation.id,
        projectID,
        questionID: question.id,
        question: question.questionText,
        candidateID: rejectedCandidate.id,
        disposition: "rejected"
      }),
      200,
      "Persisting a private decision-scoped candidate rejection"
    );
    assert.equal(rejectCandidate.disposition, "rejected");
    assert.deepEqual(
      rejectCandidate.conversation.candidateDispositions.map((item) => item.candidateID),
      [rejectedCandidate.id]
    );
    const rejectedCandidateReload = await expectStatus(
      await postAs(editor, "/research/conversations/get", {
        conversationID: startedResearch.conversation.id
      }),
      200,
      "Reloading the private candidate rejection"
    );
    assert.equal(
      rejectedCandidateReload.conversation.candidateDispositions[0].disposition,
      "rejected"
    );
    const secondRejectedCandidate = candidateDiscovery.candidates[1];
    const concurrentCandidateRejections = await Promise.all([
      postAs(editor, "/research/conversations/candidate-disposition", {
        conversationID: startedResearch.conversation.id,
        projectID,
        questionID: question.id,
        question: question.questionText,
        candidateID: rejectedCandidate.id,
        disposition: "rejected"
      }),
      postAs(editor, "/research/conversations/candidate-disposition", {
        conversationID: startedResearch.conversation.id,
        projectID,
        questionID: question.id,
        question: question.questionText,
        candidateID: secondRejectedCandidate.id,
        disposition: "rejected"
      })
    ]);
    const concurrentRejectionPayloads = await Promise.all(
      concurrentCandidateRejections.map((result, index) => expectStatus(
        result,
        200,
        `Persisting concurrent private candidate rejection ${index + 1}`
      ))
    );
    assert.equal(concurrentRejectionPayloads.length, 2);
    const concurrentRejectionReload = await expectStatus(
      await postAs(editor, "/research/conversations/get", {
        conversationID: startedResearch.conversation.id
      }),
      200,
      "Reloading concurrent private candidate rejections"
    );
    assert.deepEqual(
      new Set(concurrentRejectionReload.conversation.candidateDispositions.map((item) => item.candidateID)),
      new Set([rejectedCandidate.id, secondRejectedCandidate.id])
    );
    const concurrentCandidateRestores = await Promise.all(
      [rejectedCandidate, secondRejectedCandidate].map((candidate) =>
        postAs(editor, "/research/conversations/candidate-disposition", {
          conversationID: startedResearch.conversation.id,
          projectID,
          questionID: question.id,
          question: question.questionText,
          candidateID: candidate.id,
          disposition: "restored"
        })
      )
    );
    await Promise.all(
      concurrentCandidateRestores.map((result, index) => expectStatus(
        result,
        200,
        `Restoring concurrent private candidate rejection ${index + 1}`
      ))
    );
    const restoredCandidateReload = await expectStatus(
      await postAs(editor, "/research/conversations/get", {
        conversationID: startedResearch.conversation.id
      }),
      200,
      "Confirming private candidate rejections were restored"
    );
    assert.deepEqual(restoredCandidateReload.conversation.candidateDispositions, []);

    const researchStartReplay = await postAs(editor, "/projects/code-questions/research/start", {
      projectID,
      questionID: question.id,
      conversationID: "cq-http-research-1"
    });
    const replayedResearch = await expectStatus(
      researchStartReplay,
      200,
      "Replaying linked Research start"
    );
    assert.equal(replayedResearch.replayed, true);
    assert.equal(replayedResearch.conversation.id, startedResearch.conversation.id);
    assert.equal(
      replayedResearch.conversation.codeDecisionLinkVersion,
      startedResearch.conversation.codeDecisionLinkVersion
    );

    const editorResearchList = await expectStatus(
      await postAs(editor, "/research/conversations/list", {}),
      200,
      "Listing the editor's private Research"
    );
    const editorResearchSummary = editorResearchList.conversations.find((item) =>
      item.id === startedResearch.conversation.id
    );
    assert.equal(editorResearchSummary.linkedCodeDecisionID, question.id);
    assert.equal(editorResearchSummary.starterQuestion, question.questionText);
    assert.equal(
      editorResearchList.conversations.filter((item) => item.id === startedResearch.conversation.id).length,
      1
    );
    const editorDecisionList = await expectStatus(
      await postAs(editor, "/projects/code-questions/list", { projectID }),
      200,
      "Listing the editor's linked Code Decision"
    );
    assert.equal(
      editorDecisionList.questions.find((item) => item.id === question.id).researchConversationID,
      startedResearch.conversation.id
    );
    const editorDecisionState = await expectStatus(
      await postAs(editor, "/projects/code-questions/state", { projectID, questionID: question.id }),
      200,
      "Hydrating the editor's linked Code Decision"
    );
    assert.equal(editorDecisionState.researchConversationID, startedResearch.conversation.id);

    const evidenceFreeMessage = await postAs(editor, "/research/conversations/message", {
      conversationID: startedResearch.conversation.id,
      question: question.questionText
    });
    assert.equal(evidenceFreeMessage.response.status, 422);
    assert.equal(evidenceFreeMessage.json.code, "RESEARCH_EVIDENCE_REQUIRED");
    const unchangedResearch = await expectStatus(
      await postAs(editor, "/research/conversations/get", {
        conversationID: startedResearch.conversation.id
      }),
      200,
      "Reading evidence-free starter Research"
    );
    assert.deepEqual(unchangedResearch.conversation.messages, []);

    const canonicalResearchText = 'This code shall be known and may be cited as the "New York City Building Code," "NYCBC" or "BC". All section numbers in this code shall be deemed to be preceded by the designation "BC".';
    const researchEvidenceAdded = await expectStatus(
      await postAs(editor, "/research/conversations/evidence", {
        conversationID: startedResearch.conversation.id,
        selections: [
          { sectionID: "1", selectedText: canonicalResearchText },
          { sectionID: "1", selectedText: canonicalResearchText }
        ]
      }),
      200,
      "Adding professionally selected ordinary Research evidence"
    );
    assert.equal(researchEvidenceAdded.addedSelectionCount, 1);
    assert.equal(
      researchEvidenceAdded.conversation.sources.filter((source) => source.kind === "selection").length,
      1
    );
    const researchEvidenceVersion = researchEvidenceAdded.conversation.evidenceSetVersion;
    const researchEvidenceReplay = await expectStatus(
      await postAs(editor, "/research/conversations/evidence", {
        conversationID: startedResearch.conversation.id,
        selections: [{ sectionID: "1", selectedText: canonicalResearchText }]
      }),
      200,
      "Replaying an exact ordinary Research evidence selection"
    );
    assert.equal(researchEvidenceReplay.replayed, true);
    assert.equal(researchEvidenceReplay.addedSelectionCount, 0);
    assert.equal(researchEvidenceReplay.conversation.evidenceSetVersion, researchEvidenceVersion);
    const capturedStatement = "The corridor is on the second floor of the project.";
    const researchMessage = await expectStatus(
      await postAs(editor, "/research/conversations/message", {
        conversationID: startedResearch.conversation.id,
        question: capturedStatement
      }),
      200,
      "Asking ordinary Research after attaching selected evidence"
    );
    const capturedMessage = researchMessage.conversation.messages.find((item) => item.role === "user");
    const firstResearchAnswerMessage = researchMessage.conversation.messages.find((item) => item.role === "assistant");
    assert.ok(capturedMessage?.id);
    assert.ok(firstResearchAnswerMessage?.id);
    assert.ok(firstResearchAnswerMessage.answer.promptVersion.endsWith(":conversational-v2"));
    assert.match(firstResearchAnswerMessage.answer.conclusion, /^(?:Potentially, yes|The assembled enacted provisions provide a conditional answer)/);
    const firstResearchAnswer = await expectStatus(
      await postAs(editor, "/research/answers/get", { answerID: firstResearchAnswerMessage.id }),
      200,
      "Reading immutable Research decision context"
    );
    assert.deepEqual(firstResearchAnswer.answer.decisionContextSnapshot, {
      projectID,
      questionID: question.id,
      definitionRevision: question.definitionRevision,
      definitionHash: definitionHash(question),
      capturedAt: firstResearchAnswer.answer.decisionContextSnapshot.capturedAt
    });
    assert.ok(Number.isFinite(Date.parse(firstResearchAnswer.answer.decisionContextSnapshot.capturedAt)));
    assert.equal(
      firstResearchAnswer.answer.answer.promptVersion,
      firstResearchAnswerMessage.answer.promptVersion
    );
    const decisionAfterOrdinaryResearch = await expectStatus(
      await postAs(editor, "/projects/code-questions/state", { projectID, questionID: question.id }),
      200,
      "Verifying ordinary Research remains outside governed Evidence Sets and analysis"
    );
    assert.ok(!decisionAfterOrdinaryResearch.artifacts.some((artifact) =>
      ["questionEvidenceSet", "questionAnalysis"].includes(artifact.envelope?.type)
    ));
    const captureBasis = `Captured from Research ${startedResearch.conversation.id} message ${capturedMessage.id}`;
    const capturePayload = {
      projectID,
      questionID: question.id,
      id: `research-message:${startedResearch.conversation.id}:${capturedMessage.id}`,
      kind: "confirmedFact",
      state: "confirmed",
      statement: capturedStatement,
      basis: captureBasis,
      researchSource: {
        conversationID: startedResearch.conversation.id,
        messageID: capturedMessage.id,
        disposition: "project-fact"
      }
    };
    const capturedInput = await expectStatus(
      await postAs(editor, "/projects/code-questions/inputs/save", capturePayload),
      201,
      "Capturing a Research message as a governed Project Fact"
    );
    assert.equal(capturedInput.input.inputKind, "confirmedFact");
    assert.equal(capturedInput.input.state, "confirmed");
    const capturedInputReplay = await expectStatus(
      await postAs(editor, "/projects/code-questions/inputs/save", capturePayload),
      200,
      "Replaying a stable Research capture"
    );
    assert.equal(capturedInputReplay.replayed, true);
    const serverDerivedCaptureReplay = await expectStatus(
      await postAs(editor, "/projects/code-questions/inputs/save", {
        ...capturePayload,
        basis: "",
        researchSource: {
          conversationID: startedResearch.conversation.id,
          messageID: capturedMessage.id
        }
      }),
      200,
      "Deriving canonical Research capture provenance server-side"
    );
    assert.equal(serverDerivedCaptureReplay.replayed, true);
    assert.equal(serverDerivedCaptureReplay.input.basis, captureBasis);
    const mismatchedResearchCapture = await postAs(editor, "/projects/code-questions/inputs/save", {
      ...capturePayload,
      id: `${capturePayload.id}:mismatch`,
      statement: "A different statement than the linked Research message."
    });
    assert.equal(mismatchedResearchCapture.response.status, 409);
    assert.equal(mismatchedResearchCapture.json.code, "CODE_QUESTION_RESEARCH_SOURCE_CHANGED");
    const hostileDispositionCapture = await postAs(editor, "/projects/code-questions/inputs/save", {
      ...capturePayload,
      id: `${capturePayload.id}:hostile-disposition`,
      researchSource: { ...capturePayload.researchSource, disposition: "assumption" }
    });
    assert.equal(hostileDispositionCapture.response.status, 409);
    assert.equal(
      hostileDispositionCapture.json.code,
      "CODE_QUESTION_RESEARCH_SOURCE_DISPOSITION_MISMATCH"
    );
    const hostileBasisCapture = await postAs(editor, "/projects/code-questions/inputs/save", {
      ...capturePayload,
      id: `${capturePayload.id}:hostile-basis`,
      basis: "Client-authored provenance must not be accepted."
    });
    assert.equal(hostileBasisCapture.response.status, 409);
    assert.equal(hostileBasisCapture.json.code, "CODE_QUESTION_RESEARCH_SOURCE_BASIS_MISMATCH");

    const privateOwnerResearchList = await expectStatus(
      await postAs(owner, "/research/conversations/list", {}),
      200,
      "Checking per-actor Research privacy"
    );
    assert.ok(!privateOwnerResearchList.conversations.some((item) =>
      item.id === startedResearch.conversation.id
    ));
    const ownerResearchStart = await expectStatus(
      await postAs(owner, "/projects/code-questions/research/start", {
        projectID,
        questionID: question.id,
        conversationID: "cq-http-owner-research-1"
      }),
      201,
      "Starting separate owner-private Research"
    );
    assert.notEqual(ownerResearchStart.conversation.id, startedResearch.conversation.id);
    const ownerDecisionState = await expectStatus(
      await postAs(owner, "/projects/code-questions/state", { projectID, questionID: question.id }),
      200,
      "Hydrating the owner's actor-private Research link"
    );
    assert.equal(ownerDecisionState.researchConversationID, ownerResearchStart.conversation.id);

    const forgedFoundationLink = await postAs(owner, "/projects/foundation/link", {
      projectID,
      targetKind: "researchConversation",
      targetID: ownerResearchStart.conversation.id,
      relationship: "primary",
      metadata: { codeDecisionID: "forged-code-decision" }
    });
    assert.equal(forgedFoundationLink.response.status, 409);
    assert.equal(forgedFoundationLink.json.code, "RESEARCH_PROJECT_LIFECYCLE_REQUIRED");
    const forgedFoundationUnlink = await postAs(owner, "/projects/foundation/unlink", {
      projectID,
      targetKind: "researchConversation",
      targetID: ownerResearchStart.conversation.id
    });
    assert.equal(forgedFoundationUnlink.response.status, 409);
    assert.equal(forgedFoundationUnlink.json.code, "RESEARCH_PROJECT_LIFECYCLE_REQUIRED");
    const ownerResearchAfterForge = await expectStatus(
      await postAs(owner, "/research/conversations/get", {
        conversationID: ownerResearchStart.conversation.id
      }),
      200,
      "Rechecking the governed Research link"
    );
    assert.equal(ownerResearchAfterForge.conversation.linkedCodeDecisionID, question.id);
    const ownerUnlink = await expectStatus(
      await postAs(owner, "/projects/code-questions/research/link", {
        projectID,
        questionID: question.id,
        conversationID: ownerResearchStart.conversation.id,
        expectedLinkVersion: ownerResearchAfterForge.conversation.codeDecisionLinkVersion,
        unlink: true
      }),
      200,
      "Unlinking private Research without deleting either record"
    );
    assert.equal(ownerUnlink.conversation.linkedCodeDecisionID, null);
    assert.equal(ownerUnlink.conversation.primaryProjectID, projectID);
    const ownerUnlinkReplay = await expectStatus(
      await postAs(owner, "/projects/code-questions/research/link", {
        projectID,
        questionID: question.id,
        conversationID: ownerResearchStart.conversation.id,
        expectedLinkVersion: ownerResearchAfterForge.conversation.codeDecisionLinkVersion,
        unlink: true
      }),
      200,
      "Replaying the completed private Research unlink"
    );
    assert.equal(ownerUnlinkReplay.replayed, true);
    const ownerDecisionAfterUnlinkReplay = await expectStatus(
      await postAs(owner, "/projects/code-questions/state", { projectID, questionID: question.id }),
      200,
      "Checking deterministic private Research unlink history"
    );
    assert.equal(ownerDecisionAfterUnlinkReplay.activity.filter((event) =>
      event.action === "item.unlinked" &&
      event.objectID === ownerResearchStart.conversation.id &&
      event.metadata?.questionID === question.id
    ).length, 1);
    const ownerResearchRelink = await expectStatus(
      await postAs(owner, "/projects/code-questions/research/start", {
        projectID,
        questionID: question.id,
        conversationID: ownerResearchStart.conversation.id
      }),
      200,
      "Recovering an unlinked deterministic Research start"
    );
    assert.equal(ownerResearchRelink.conversation.linkedCodeDecisionID, question.id);

    await expectStatus(await postAs(owner, "/research/conversations/evidence", {
      conversationID: ownerResearchRelink.conversation.id,
      selections: [{ sectionID: "1", selectedText: canonicalResearchText }]
    }), 200, "Selecting ordinary Research evidence for immutable decision-context history");
    const ownerQuestionOneResearch = await expectStatus(
      await postAs(owner, "/research/conversations/message", {
        conversationID: ownerResearchRelink.conversation.id,
        question: "Record the first linked decision context."
      }),
      200,
      "Generating ordinary Research while linked to the first decision"
    );
    const ownerQuestionOneAnswerID = ownerQuestionOneResearch.conversation.messages
      .findLast((message) => message.role === "assistant")?.id;
    const ownerQuestionOneAnswer = await expectStatus(
      await postAs(owner, "/research/answers/get", { answerID: ownerQuestionOneAnswerID }),
      200,
      "Reading first immutable linked Research answer"
    );
    assert.equal(ownerQuestionOneAnswer.answer.decisionContextSnapshot.questionID, question.id);

    const secondQuestion = (await expectStatus(
      await postAs(owner, "/projects/code-questions/create", {
        projectID,
        id: "cq-http-question-2",
        title: "Second decision context",
        questionText: "What decision context applies after an explicit Research relink?",
        scope: "Research provenance history",
        desiredOutput: "Professional conclusion",
        jurisdiction: "New York City",
        asOfDate: "2026-08-09T00:00:00.000Z"
      }),
      201,
      "Creating a second Code Decision for immutable Research history"
    )).question;
    const ownerRelinkToSecond = await expectStatus(
      await postAs(owner, "/projects/code-questions/research/link", {
        projectID,
        questionID: secondQuestion.id,
        conversationID: ownerResearchRelink.conversation.id,
        expectedLinkVersion: ownerResearchRelink.conversation.codeDecisionLinkVersion,
        confirmRelink: true
      }),
      201,
      "Explicitly relinking ordinary Research to the second decision"
    );
    const ownerQuestionTwoResearch = await expectStatus(
      await postAs(owner, "/research/conversations/message", {
        conversationID: ownerRelinkToSecond.conversation.id,
        question: "Record the second linked decision context."
      }),
      200,
      "Generating ordinary Research while linked to the second decision"
    );
    const ownerQuestionTwoAnswerID = ownerQuestionTwoResearch.conversation.messages
      .findLast((message) => message.role === "assistant")?.id;
    const [ownerQuestionOneAnswerAfterRelink, ownerQuestionTwoAnswer] = await Promise.all([
      postAs(owner, "/research/answers/get", { answerID: ownerQuestionOneAnswerID })
        .then((result) => expectStatus(result, 200, "Re-reading first immutable Research answer")),
      postAs(owner, "/research/answers/get", { answerID: ownerQuestionTwoAnswerID })
        .then((result) => expectStatus(result, 200, "Reading second immutable Research answer"))
    ]);
    assert.equal(ownerQuestionOneAnswerAfterRelink.answer.decisionContextSnapshot.questionID, question.id);
    assert.equal(ownerQuestionTwoAnswer.answer.decisionContextSnapshot.questionID, secondQuestion.id);
    assert.notEqual(
      ownerQuestionOneAnswerAfterRelink.answer.decisionContextSnapshot.definitionHash,
      ownerQuestionTwoAnswer.answer.decisionContextSnapshot.definitionHash
    );
    const secondDecisionAfterOrdinaryResearch = await expectStatus(
      await postAs(owner, "/projects/code-questions/state", { projectID, questionID: secondQuestion.id }),
      200,
      "Verifying ordinary Research did not create governed second-decision artifacts"
    );
    assert.ok(!secondDecisionAfterOrdinaryResearch.artifacts.some((artifact) =>
      ["questionEvidenceSet", "questionAnalysis"].includes(artifact.envelope?.type)
    ));

    const createOwnerOrdinaryResearch = async (label) => {
      const createdConversation = await expectStatus(
        await postAs(owner, "/research/conversations/create", {
          projectID,
          selections: [{ sectionID: "1", selectedText: canonicalResearchText }]
        }),
        201,
        `Creating ${label}`
      );
      return (await expectStatus(
        await postAs(owner, "/research/conversations/get", {
          conversationID: createdConversation.conversation.id
        }),
        200,
        `Reading ${label}`
      )).conversation;
    };

    const ordinaryLinked = await createOwnerOrdinaryResearch("ordinary unlinked Research for versioned linking");
    assert.equal(ordinaryLinked.linkedCodeDecisionID, null);
    assert.ok(ordinaryLinked.codeDecisionLinkVersion >= 1);
    const ordinaryLinkResult = await expectStatus(
      await postAs(owner, "/projects/code-questions/research/link", {
        projectID,
        questionID: question.id,
        conversationID: ordinaryLinked.id,
        expectedLinkVersion: ordinaryLinked.codeDecisionLinkVersion
      }),
      201,
      "Linking ordinary Research with its Project-link version"
    );
    assert.equal(ordinaryLinkResult.conversation.linkedCodeDecisionID, question.id);

    const crossProjectUnlink = await postAs(owner, "/projects/code-questions/research/link", {
      projectID: ownerSecondaryProjectID,
      questionID: question.id,
      conversationID: ordinaryLinked.id,
      expectedLinkVersion: ordinaryLinkResult.conversation.codeDecisionLinkVersion,
      unlink: true
    });
    assert.equal(crossProjectUnlink.response.status, 409);
    assert.equal(crossProjectUnlink.json.code, "CODE_QUESTION_RESEARCH_PROJECT_MISMATCH");

    const replacementResearch = await createOwnerOrdinaryResearch("replacement ordinary Research");
    const unconfirmedReplacement = await postAs(owner, "/projects/code-questions/research/link", {
      projectID,
      questionID: question.id,
      conversationID: replacementResearch.id,
      expectedLinkVersion: replacementResearch.codeDecisionLinkVersion
    });
    assert.equal(unconfirmedReplacement.response.status, 409);
    assert.equal(
      unconfirmedReplacement.json.code,
      "CODE_QUESTION_RESEARCH_REPLACE_CONFIRMATION_REQUIRED"
    );
    const staleTargetReplacement = await postAs(owner, "/projects/code-questions/research/link", {
      projectID,
      questionID: question.id,
      conversationID: replacementResearch.id,
      expectedLinkVersion: replacementResearch.codeDecisionLinkVersion,
      confirmReplaceDecisionConversation: true,
      expectedTargetConversationID: "stale-target"
    });
    assert.equal(staleTargetReplacement.response.status, 409);
    assert.equal(staleTargetReplacement.json.code, "CODE_QUESTION_RESEARCH_TARGET_CONFLICT");
    const confirmedReplacement = await expectStatus(
      await postAs(owner, "/projects/code-questions/research/link", {
        projectID,
        questionID: question.id,
        conversationID: replacementResearch.id,
        expectedLinkVersion: replacementResearch.codeDecisionLinkVersion,
        confirmReplaceDecisionConversation: true,
        expectedTargetConversationID: ordinaryLinked.id
      }),
      201,
      "Replacing the current Research conversation with exact target confirmation"
    );
    assert.equal(confirmedReplacement.replacedConversationID, ordinaryLinked.id);

    const concurrentResearchA = await createOwnerOrdinaryResearch("concurrent Research A");
    const concurrentResearchB = await createOwnerOrdinaryResearch("concurrent Research B");
    const concurrentReplacementResults = await Promise.all([
      postAsIsolated(owner, "/projects/code-questions/research/link", {
        projectID,
        questionID: question.id,
        conversationID: concurrentResearchA.id,
        expectedLinkVersion: concurrentResearchA.codeDecisionLinkVersion,
        confirmReplaceDecisionConversation: true,
        expectedTargetConversationID: replacementResearch.id
      }),
      postAsIsolated(owner, "/projects/code-questions/research/link", {
        projectID,
        questionID: question.id,
        conversationID: concurrentResearchB.id,
        expectedLinkVersion: concurrentResearchB.codeDecisionLinkVersion,
        confirmReplaceDecisionConversation: true,
        expectedTargetConversationID: replacementResearch.id
      })
    ]);
    assert.deepEqual(
      concurrentReplacementResults.map((result) => result.response.status).sort((left, right) => left - right),
      [201, 409]
    );
    const successfulConcurrentConversationID = concurrentReplacementResults
      .find((result) => result.response.status === 201)?.json?.conversation?.id;
    const ownerResearchAfterConcurrentReplacement = await expectStatus(
      await postAs(owner, "/research/conversations/list", {}),
      200,
      "Checking serialized one-current Research replacement"
    );
    const currentOwnerQuestionOneResearch = ownerResearchAfterConcurrentReplacement.conversations
      .filter((conversation) => conversation.linkedCodeDecisionID === question.id);
    assert.equal(currentOwnerQuestionOneResearch.length, 1);
    assert.equal(currentOwnerQuestionOneResearch[0].id, successfulConcurrentConversationID);

    const createLifecycleDecision = async (id, title) => (await expectStatus(
      await postAs(owner, "/projects/code-questions/create", {
        projectID,
        id,
        title,
        questionText: `What governed history applies when ${title.toLowerCase()}?`,
        scope: "Research conversation lifecycle audit",
        desiredOutput: "Professional conclusion",
        jurisdiction: "New York City",
        asOfDate: "2026-08-09T00:00:00.000Z"
      }),
      201,
      `Creating ${title}`
    )).question;
    const linkLifecycleResearch = async (decision, label) => {
      const conversation = await createOwnerOrdinaryResearch(label);
      const linked = await expectStatus(
        await postAs(owner, "/projects/code-questions/research/link", {
          projectID,
          questionID: decision.id,
          conversationID: conversation.id,
          expectedLinkVersion: conversation.codeDecisionLinkVersion
        }),
        201,
        `Linking ${label}`
      );
      return linked.conversation;
    };
    const decisionUnlinkEvents = (state, decisionID, conversationID) => state.activity.filter((event) =>
      event.action === "item.unlinked" &&
      event.objectKind === "researchConversation" &&
      event.objectID === conversationID &&
      event.metadata?.questionID === decisionID
    );

    const unlinkRaceSourceDecision = await createLifecycleDecision(
      "cq-http-question-research-unlink-race-source",
      "Racing a Research unlink"
    );
    const unlinkRaceTargetDecision = await createLifecycleDecision(
      "cq-http-question-research-unlink-race-target",
      "Racing a Research relink"
    );
    const unlinkRaceConversation = await linkLifecycleResearch(
      unlinkRaceSourceDecision,
      "Research used for an unlink and relink race"
    );
    const unlinkRaceResults = await Promise.all([
      postAsIsolated(owner, "/projects/code-questions/research/link", {
        projectID,
        questionID: unlinkRaceSourceDecision.id,
        conversationID: unlinkRaceConversation.id,
        expectedLinkVersion: unlinkRaceConversation.codeDecisionLinkVersion,
        unlink: true
      }),
      postAsIsolated(owner, "/projects/code-questions/research/link", {
        projectID,
        questionID: unlinkRaceTargetDecision.id,
        conversationID: unlinkRaceConversation.id,
        expectedLinkVersion: unlinkRaceConversation.codeDecisionLinkVersion,
        confirmRelink: true
      })
    ]);
    assert.equal(unlinkRaceResults.filter((result) => result.response.ok).length, 1);
    assert.equal(unlinkRaceResults.filter((result) => result.response.status === 409).length, 1);
    assert.equal(
      unlinkRaceResults.find((result) => result.response.status === 409).json.code,
      "CODE_QUESTION_RESEARCH_LINK_CONFLICT"
    );
    const unlinkRaceConversationAfter = await expectStatus(
      await postAs(owner, "/research/conversations/get", {
        conversationID: unlinkRaceConversation.id
      }),
      200,
      "Reading Research after the unlink and relink race"
    );
    assert.ok([
      null,
      unlinkRaceTargetDecision.id
    ].includes(unlinkRaceConversationAfter.conversation.linkedCodeDecisionID));

    const moveDecision = await createLifecycleDecision(
      "cq-http-question-research-move",
      "Moving linked Research"
    );
    const moveConversation = await linkLifecycleResearch(moveDecision, "Research moved between Projects");
    await expectStatus(
      await postAs(owner, "/research/conversations/assign-project", {
        conversationID: moveConversation.id,
        projectID: ownerSecondaryProjectID,
        confirmMove: true
      }),
      200,
      "Moving linked Research to another Project"
    );
    await expectStatus(
      await postAs(owner, "/research/conversations/assign-project", {
        conversationID: moveConversation.id,
        projectID: ownerSecondaryProjectID,
        confirmMove: true
      }),
      200,
      "Replaying the completed Research Project move"
    );
    const moveDecisionState = await expectStatus(
      await postAs(owner, "/projects/code-questions/state", {
        projectID,
        questionID: moveDecision.id
      }),
      200,
      "Reading decision history after moving linked Research"
    );
    assert.equal(moveDecisionState.researchConversationID, null);
    assert.equal(decisionUnlinkEvents(moveDecisionState, moveDecision.id, moveConversation.id).length, 1);
    assert.equal(
      decisionUnlinkEvents(moveDecisionState, moveDecision.id, moveConversation.id)[0].newStatus,
      "unlinked"
    );

    const unassignDecision = await createLifecycleDecision(
      "cq-http-question-research-unassign",
      "Unassigning linked Research"
    );
    const unassignConversation = await linkLifecycleResearch(
      unassignDecision,
      "Research unassigned from its Project"
    );
    await expectStatus(
      await postAs(owner, "/research/conversations/assign-project", {
        conversationID: unassignConversation.id,
        projectID: "",
        confirmMove: true
      }),
      200,
      "Unassigning linked Research from its Project"
    );
    const unassignDecisionState = await expectStatus(
      await postAs(owner, "/projects/code-questions/state", {
        projectID,
        questionID: unassignDecision.id
      }),
      200,
      "Reading decision history after unassigning linked Research"
    );
    assert.equal(
      decisionUnlinkEvents(unassignDecisionState, unassignDecision.id, unassignConversation.id).length,
      1
    );

    const deleteDecision = await createLifecycleDecision(
      "cq-http-question-research-delete",
      "Deleting linked Research"
    );
    const deleteConversation = await linkLifecycleResearch(deleteDecision, "Research deleted after linking");
    await expectStatus(
      await postAs(owner, "/research/conversations/delete", {
        conversationID: deleteConversation.id
      }),
      200,
      "Deleting linked Research after recording its decision unlink"
    );
    const deleteDecisionState = await expectStatus(
      await postAs(owner, "/projects/code-questions/state", {
        projectID,
        questionID: deleteDecision.id
      }),
      200,
      "Reading decision history after deleting linked Research"
    );
    assert.equal(deleteDecisionState.researchConversationID, null);
    assert.equal(
      decisionUnlinkEvents(deleteDecisionState, deleteDecision.id, deleteConversation.id).length,
      1
    );

    const viewerResearchStart = await postAs(viewer, "/projects/code-questions/research/start", {
      projectID,
      questionID: question.id,
      conversationID: "cq-http-viewer-research"
    });
    assert.equal(viewerResearchStart.response.status, 403);
    assert.equal(viewerResearchStart.json.code, "PROJECT_PERMISSION_REQUIRED");
    const outsiderResearchStart = await postAs(outsider, "/projects/code-questions/research/start", {
      projectID,
      questionID: question.id,
      conversationID: "cq-http-outsider-research"
    });
    assert.equal(outsiderResearchStart.response.status, 404);

    const otherActorLink = await postAs(owner, "/projects/code-questions/research/link", {
      projectID,
      questionID: question.id,
      conversationID: startedResearch.conversation.id,
      expectedLinkVersion: startedResearch.conversation.codeDecisionLinkVersion
    });
    assert.equal(otherActorLink.response.status, 404);

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

    const inputs = [input, capturedInput.input];
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
    assert.deepEqual(analysis.inputSnapshotIDs, inputs.map((item) => item.id));
    assert.deepEqual(
      analysisPayload.answer.evidence.map((item) => item.sourceID),
      [snapshot.id],
      "Analysis used evidence outside the approved set."
    );
    assert.ok(
      !analysisPayload.answer.answer.promptVersion.endsWith(":conversational-v1"),
      "Governed Code Decision analysis must retain its formal prompt provenance."
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
