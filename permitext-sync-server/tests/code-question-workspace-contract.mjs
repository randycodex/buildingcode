/**
 * Phase 2 Code Question workspace shell contract tests.
 * Drive real exports from public/code-question-workspace.js and workspace-state.js.
 */
import assert from "node:assert/strict";
import {
  applyStageArrangement,
  buildCodeQuestionDeepLink,
  closeCodeQuestionPane,
  codeQuestionPaneIDsFromState,
  codeQuestionStageArrangements,
  codeQuestionWorkflowStages,
  deriveQuestionListLabel,
  emptyCodeQuestionWorkspaceState,
  ensureSingleWorkboardPane,
  filterQuestions,
  isCodeQuestionPaneID,
  minimumWidthForPaneRole,
  normalizeCodeQuestionWorkspaceState,
  openSupportingTool,
  parseCodeQuestionDeepLink,
  parseQuestionPaneKey,
  questionPaneKey,
  recommendedVisibleColumnCount,
  stageControlModel,
  switchActiveProject,
  switchActiveQuestion
} from "../public/code-question-workspace.js";
import {
  emptyWorkspaceLayout,
  normalizeWorkspaceLayout,
  workspaceLayoutHasVisiblePanes
} from "../public/workspace-state.js";

// Stages and arrangements
assert.deepEqual([...codeQuestionWorkflowStages], [
  "define", "evidence", "analyze", "review", "issue"
]);
assert.ok(codeQuestionStageArrangements.evidence.includes("reader"));
assert.ok(codeQuestionStageArrangements.analyze.includes("professional-conclusion"));
assert.equal(recommendedVisibleColumnCount(1500), 3);
assert.equal(recommendedVisibleColumnCount(1200), 2);
assert.equal(recommendedVisibleColumnCount(900), 1);
assert.ok(minimumWidthForPaneRole("reader") >= 480);

// Pane keys
const key = questionPaneKey({
  projectID: "project-1",
  questionID: "cq-1",
  paneRole: "evidence-tray"
});
assert.equal(key, "cq:project-1:cq-1:evidence-tray");
assert.equal(isCodeQuestionPaneID(key), true);
assert.equal(isCodeQuestionPaneID("utility:saved:x"), false);
assert.deepEqual(parseQuestionPaneKey(key), {
  projectID: "project-1",
  questionID: "cq-1",
  paneRole: "evidence-tray",
  paneID: key
});

// Normalization drops foreign project panes
const mixed = normalizeCodeQuestionWorkspaceState({
  activeQuestionID: "cq-1",
  activeStage: "evidence",
  openPanes: [
    { projectID: "project-1", questionID: "cq-1", paneRole: "reader" },
    { projectID: "project-2", questionID: "cq-9", paneRole: "reader" },
    { projectID: "project-1", questionID: "other", paneRole: "definition" }
  ]
}, { activeProjectID: "project-1" });
assert.equal(mixed.openPanes.every((pane) => pane.projectID === "project-1"), true);
assert.equal(mixed.openPanes.some((pane) => pane.questionID === "other"), false);
assert.ok(mixed.openPanes.some((pane) => pane.paneRole === "question-index"));
const reviewState = normalizeCodeQuestionWorkspaceState({
  reviewByQuestionID: {
    "cq-1": { questionID: "cq-1", requests: [{ id: "request-1", status: "open" }] }
  }
});
assert.equal(reviewState.reviewByQuestionID["cq-1"].requests[0].id, "request-1");
const legacyState = normalizeCodeQuestionWorkspaceState({
  legacyByProjectID: {
    "project-1": { projectID: "project-1", promotions: [{ id: "promotion-1" }] }
  }
});
assert.equal(legacyState.legacyByProjectID["project-1"].promotions[0].id, "promotion-1");

// Stage arrangement is workspace-only (does not invent approval state)
const arranged = applyStageArrangement(emptyCodeQuestionWorkspaceState(), {
  projectID: "project-1",
  questionID: "cq-1",
  stage: "review"
});
assert.equal(arranged.activeStage, "review");
assert.equal(arranged.activeQuestionID, "cq-1");
const roles = arranged.openPanes.map((pane) => pane.paneRole);
assert.ok(roles.includes("review-requests"));
assert.ok(roles.includes("question-index"));
assert.ok(!roles.includes("candidates"));

// Project switch clears question selection and foreign panes
const afterProjectSwitch = switchActiveProject(arranged, "project-2");
assert.equal(afterProjectSwitch.activeQuestionID, "");
assert.equal(afterProjectSwitch.activeStage, "define");
assert.equal(afterProjectSwitch.openPanes.length, 1);
assert.equal(afterProjectSwitch.openPanes[0].projectID, "project-2");
assert.equal(afterProjectSwitch.openPanes[0].paneRole, "question-index");

// Question switch applies stage arrangement for that question
const afterQuestion = switchActiveQuestion(afterProjectSwitch, {
  projectID: "project-2",
  questionID: "cq-22",
  stage: "issue"
});
assert.equal(afterQuestion.activeQuestionID, "cq-22");
assert.equal(afterQuestion.activeStage, "issue");
assert.ok(afterQuestion.openPanes.every((pane) =>
  pane.questionID === "_" || pane.questionID === "cq-22"
));

// Add column / More supporting tool
const withNotes = openSupportingTool(afterQuestion, {
  projectID: "project-2",
  questionID: "cq-22",
  paneRole: "working-notes"
});
assert.ok(withNotes.openPanes.some((pane) => pane.paneRole === "working-notes"));

// Close pane
const closed = closeCodeQuestionPane(
  withNotes,
  questionPaneKey({ projectID: "project-2", questionID: "cq-22", paneRole: "working-notes" }),
  "project-2"
);
assert.equal(closed.openPanes.some((pane) => pane.paneRole === "working-notes"), false);

// One workboard per project
const multiBoard = ensureSingleWorkboardPane([
  { projectID: "p1", questionID: "_", paneRole: "workboard", paneID: "cq:p1:_:workboard" },
  { projectID: "p1", questionID: "q1", paneRole: "workboard", paneID: "cq:p1:q1:workboard" },
  { projectID: "p1", questionID: "q1", paneRole: "definition", paneID: "cq:p1:q1:definition" }
], "p1");
assert.equal(multiBoard.filter((pane) => pane.paneRole === "workboard").length, 1);

// Filters and list labels
const filtered = filterQuestions([
  { id: "1", title: "Egress", displayID: "Q-001", recordState: "active" },
  { id: "2", title: "Sprinkler", displayID: "Q-002", recordState: "archived" }
], { query: "egress", recordState: "active" });
assert.equal(filtered.length, 1);
assert.equal(filtered[0].id, "1");
assert.equal(
  deriveQuestionListLabel({ latestIssuedVersion: 1, revisionInProgress: true }),
  "Issued v1 · Revision in progress"
);
assert.equal(deriveQuestionListLabel({ recordState: "archived" }), "Archived");

// Deep links do not encode pane widths
const link = buildCodeQuestionDeepLink({
  projectID: "project-1",
  questionID: "cq-1",
  stage: "evidence"
});
assert.equal(link, "#cq/project/project-1/question/cq-1/stage/evidence");
assert.deepEqual(parseCodeQuestionDeepLink(link), {
  projectID: "project-1",
  questionID: "cq-1",
  stage: "evidence"
});
assert.equal(parseCodeQuestionDeepLink("#other"), null);
assert.equal(parseCodeQuestionDeepLink(buildCodeQuestionDeepLink({ projectID: "p1" })).questionID, null);

// Stage control model uses aria-current step
const model = stageControlModel("analyze");
assert.equal(model.find((step) => step.stage === "analyze").ariaCurrent, "step");
assert.equal(model.find((step) => step.stage === "define").ariaCurrent, undefined);

// workspace-state: old layouts still normalize; CQ fields default safely
const legacy = normalizeWorkspaceLayout({
  readers: [{ id: "reader-1", codePrefix: "BC" }],
  projectDetail: { id: "project-1", name: "Project 1", color: "#2f8f4e" },
  utilityInstances: [{ id: "saved-1", key: "saved" }],
  paneOrder: ["reader:reader-1", "utility:saved:saved-1", "cq:project-2:cq-x:reader"],
  paneWeights: {
    "reader:reader-1": 620,
    "cq:project-2:cq-x:reader": 480
  }
});
assert.equal(legacy.readers.length, 1);
assert.ok(legacy.codeQuestionWorkspace);
assert.deepEqual(legacy.codeQuestionWorkspace.openPanes, []);
assert.equal(legacy.paneOrder.includes("cq:project-2:cq-x:reader"), false);
assert.equal(legacy.paneWeights["cq:project-2:cq-x:reader"], undefined);

// Project-bound CQ panes survive when they match active project + question
const withCQ = normalizeWorkspaceLayout({
  projectDetails: [{ id: "project-1", name: "P1" }],
  codeQuestionWorkspace: {
    activeQuestionID: "cq-1",
    activeStage: "evidence",
    questionIndexOpen: true,
    analysisByQuestionID: { "cq-1": { questionID: "cq-1", runs: [{ id: "analysis-1" }] } },
    reviewByQuestionID: { "cq-1": { questionID: "cq-1", requests: [{ id: "review-1" }] } },
    issueByQuestionID: { "cq-1": { questionID: "cq-1", issuedRecords: [{ id: "issued-1" }] } },
    legacyByProjectID: { "project-1": { projectID: "project-1", promotions: [{ id: "promotion-1" }] } },
    openPanes: [
      {
        projectID: "project-1",
        questionID: "cq-1",
        paneRole: "reader",
        paneID: "cq:project-1:cq-1:reader"
      },
      {
        projectID: "project-9",
        questionID: "cq-9",
        paneRole: "reader",
        paneID: "cq:project-9:cq-9:reader"
      }
    ]
  },
  paneOrder: ["cq:project-1:cq-1:reader", "cq:project-9:cq-9:reader"],
  paneWeights: {
    "cq:project-1:cq-1:reader": 500,
    "cq:project-9:cq-9:reader": 500
  }
});
assert.equal(
  withCQ.codeQuestionWorkspace.openPanes.every((pane) => pane.projectID === "project-1"),
  true
);
assert.ok(withCQ.paneOrder.includes("cq:project-1:cq-1:reader"));
assert.equal(withCQ.paneOrder.includes("cq:project-9:cq-9:reader"), false);
assert.equal(workspaceLayoutHasVisiblePanes(withCQ), true);
assert.equal(withCQ.codeQuestionWorkspace.analysisByQuestionID["cq-1"].runs[0].id, "analysis-1");
assert.equal(withCQ.codeQuestionWorkspace.reviewByQuestionID["cq-1"].requests[0].id, "review-1");
assert.equal(withCQ.codeQuestionWorkspace.issueByQuestionID["cq-1"].issuedRecords[0].id, "issued-1");
assert.equal(withCQ.codeQuestionWorkspace.legacyByProjectID["project-1"].promotions[0].id, "promotion-1");
assert.equal(workspaceLayoutHasVisiblePanes(emptyWorkspaceLayout()), false);

// IDs from state
assert.ok(codeQuestionPaneIDsFromState(withCQ.codeQuestionWorkspace).some((id) =>
  id.includes("question-index") || id.includes("reader")
));

// Flag-off product path: empty CQ state does not create visible shell on its own
const blankCQ = emptyCodeQuestionWorkspaceState();
assert.equal(blankCQ.openPanes.length, 0);
assert.equal(blankCQ.activeQuestionID, "");

console.log("code-question-workspace-contract: all assertions passed");
