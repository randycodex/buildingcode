/**
 * Code Question workspace shell helpers (Phase 2).
 * Pure functions for stage arrangements, pane identity, deep links, and
 * Project/question switch normalization. UI remains flag-gated in app.js.
 */

export const codeQuestionWorkflowStages = Object.freeze([
  "define",
  "evidence",
  "analyze",
  "review",
  "issue"
]);

export const codeQuestionPaneRoles = Object.freeze([
  "question-index",
  "definition",
  "candidates",
  "reader",
  "evidence-tray",
  "approved-evidence",
  "bounded-analysis",
  "professional-conclusion",
  "review-requests",
  "history",
  "code-memo-draft",
  "readiness",
  "versions",
  "working-notes",
  "workboard",
  "report-draft",
  "legacy"
]);

/** Supporting tools shown under Add column / More, not primary lifecycle. */
export const codeQuestionMoreTools = Object.freeze([
  { role: "working-notes", label: "Working Notes", legacyTool: "notebook" },
  { role: "workboard", label: "Workboard", legacyTool: "workboard" },
  { role: "report-draft", label: "Advanced Report Draft", legacyTool: "reportDraft" },
  { role: "legacy", label: "Legacy / Unassigned", legacyTool: "legacy" }
]);

/**
 * Recommended default columns per lifecycle stage (defaults, not rigid screens).
 */
export const codeQuestionStageArrangements = Object.freeze({
  define: Object.freeze(["question-index", "definition"]),
  evidence: Object.freeze(["candidates", "reader", "evidence-tray"]),
  analyze: Object.freeze(["approved-evidence", "bounded-analysis", "professional-conclusion"]),
  review: Object.freeze(["professional-conclusion", "review-requests", "history"]),
  issue: Object.freeze(["code-memo-draft", "readiness", "versions"])
});

export const codeQuestionPaneMinimumWidths = Object.freeze({
  "question-index": 288,
  candidates: 288,
  definition: 340,
  "evidence-tray": 340,
  "review-requests": 340,
  readiness: 340,
  history: 340,
  versions: 340,
  reader: 480,
  "bounded-analysis": 480,
  "professional-conclusion": 480,
  "approved-evidence": 340,
  "code-memo-draft": 480,
  "working-notes": 400,
  workboard: 480,
  "report-draft": 400,
  legacy: 288
});

const stageSet = new Set(codeQuestionWorkflowStages);
const roleSet = new Set(codeQuestionPaneRoles);

function requiredText(value, label = "value") {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`Invalid ${label}.`);
  return normalized;
}

export function emptyCodeQuestionWorkspaceState() {
  return {
    activeQuestionID: "",
    activeStage: "define",
    openPanes: [],
    questionIndexOpen: true,
    moreMenuOpen: false,
    questionsByProjectID: {},
    /** Phase 3: definition working records keyed by question ID. */
    definitionsByQuestionID: {},
    /** Phase 4: evidence workspace keyed by question ID. */
    evidenceByQuestionID: {},
    questionFilters: {
      query: "",
      recordState: "active",
      includeArchived: false
    },
    deepLink: null
  };
}

export function normalizeWorkspaceStage(stage) {
  const normalized = String(stage || "define").trim().toLowerCase();
  if (!stageSet.has(normalized)) throw new Error("Invalid Code Question workspace stage.");
  return normalized;
}

export function isCodeQuestionPaneRole(role) {
  return roleSet.has(String(role || "").trim());
}

/**
 * Stable pane identity: cq:{projectID}:{questionID}:{paneRole}
 * questionID may be "_" for project-scoped panes (question index).
 */
export function questionPaneKey({ projectID, questionID = "_", paneRole }) {
  return [
    "cq",
    requiredText(projectID, "project ID"),
    requiredText(questionID || "_", "question ID"),
    requiredText(paneRole, "pane role")
  ].join(":");
}

export function parseQuestionPaneKey(paneID) {
  const raw = String(paneID || "");
  if (!raw.startsWith("cq:")) return null;
  const parts = raw.split(":");
  if (parts.length < 4) return null;
  const [, projectID, questionID, ...roleParts] = parts;
  const paneRole = roleParts.join(":");
  if (!projectID || !questionID || !isCodeQuestionPaneRole(paneRole)) return null;
  return { projectID, questionID, paneRole, paneID: raw };
}

export function isCodeQuestionPaneID(paneID) {
  return Boolean(parseQuestionPaneKey(paneID));
}

export function normalizeOpenQuestionPane(value) {
  if (!value || typeof value !== "object") return null;
  const projectID = String(value.projectID || "").trim();
  const questionID = String(value.questionID || "_").trim() || "_";
  const paneRole = String(value.paneRole || "").trim();
  if (!projectID || !isCodeQuestionPaneRole(paneRole)) return null;
  const paneID = value.paneID || questionPaneKey({ projectID, questionID, paneRole });
  const parsed = parseQuestionPaneKey(paneID);
  if (!parsed) return null;
  return {
    projectID: parsed.projectID,
    questionID: parsed.questionID,
    paneRole: parsed.paneRole,
    paneID: parsed.paneID
  };
}

export function normalizeCodeQuestionWorkspaceState(value = {}, options = {}) {
  const source = value && typeof value === "object" ? value : {};
  const state = emptyCodeQuestionWorkspaceState();
  const activeProjectID = String(options.activeProjectID || source.activeProjectID || "").trim();

  try {
    state.activeStage = normalizeWorkspaceStage(source.activeStage);
  } catch {
    state.activeStage = "define";
  }
  state.activeQuestionID = typeof source.activeQuestionID === "string"
    ? source.activeQuestionID.trim()
    : "";
  state.questionIndexOpen = source.questionIndexOpen !== false;
  state.moreMenuOpen = source.moreMenuOpen === true;
  state.questionFilters = {
    query: typeof source.questionFilters?.query === "string" ? source.questionFilters.query : "",
    recordState: ["active", "archived", "all"].includes(source.questionFilters?.recordState)
      ? source.questionFilters.recordState
      : "active",
    includeArchived: source.questionFilters?.includeArchived === true
  };

  const openPanes = (Array.isArray(source.openPanes) ? source.openPanes : [])
    .map(normalizeOpenQuestionPane)
    .filter(Boolean);

  // Drop panes that no longer belong to the active Project.
  state.openPanes = activeProjectID
    ? openPanes.filter((pane) => pane.projectID === activeProjectID)
    : openPanes;

  // Drop question-scoped panes (not index) when active question is cleared or mismatched.
  if (state.activeQuestionID) {
    state.openPanes = state.openPanes.filter((pane) =>
      pane.questionID === "_" || pane.questionID === state.activeQuestionID
    );
  } else {
    state.openPanes = state.openPanes.filter((pane) => pane.questionID === "_");
  }

  // Deduplicate by paneID
  const seen = new Set();
  state.openPanes = state.openPanes.filter((pane) => {
    if (seen.has(pane.paneID)) return false;
    seen.add(pane.paneID);
    return true;
  });

  // Ensure question index pane when index is open and a project is active.
  if (state.questionIndexOpen && activeProjectID) {
    const indexKey = questionPaneKey({
      projectID: activeProjectID,
      questionID: "_",
      paneRole: "question-index"
    });
    if (!state.openPanes.some((pane) => pane.paneID === indexKey)) {
      state.openPanes.unshift({
        projectID: activeProjectID,
        questionID: "_",
        paneRole: "question-index",
        paneID: indexKey
      });
    }
  }

  if (source.questionsByProjectID && typeof source.questionsByProjectID === "object") {
    state.questionsByProjectID = Object.fromEntries(
      Object.entries(source.questionsByProjectID)
        .filter(([projectID, list]) => typeof projectID === "string" && Array.isArray(list))
        .map(([projectID, list]) => [
          projectID,
          list
            .filter((item) => item && typeof item === "object" && item.id)
            .map((item) => ({
              id: String(item.id),
              displayID: String(item.displayID || ""),
              title: String(item.title || ""),
              recordState: item.recordState === "archived" ? "archived" : "active",
              responsibleUserID: item.responsibleUserID ? String(item.responsibleUserID) : null,
              responsibleDisplayName: String(item.responsibleDisplayName || ""),
              reviewState: String(item.reviewState || ""),
              lastActivityAt: String(item.lastActivityAt || ""),
              latestIssuedVersion: item.latestIssuedVersion == null
                ? null
                : Number(item.latestIssuedVersion),
              revisionInProgress: item.revisionInProgress === true,
              listLabel: String(item.listLabel || "")
            }))
        ])
    );
  }
  if (source.definitionsByQuestionID && typeof source.definitionsByQuestionID === "object") {
    state.definitionsByQuestionID = Object.fromEntries(
      Object.entries(source.definitionsByQuestionID)
        .filter(([questionID, record]) => typeof questionID === "string" && record && typeof record === "object")
        .map(([questionID, record]) => [questionID, copy(record)])
    );
  }
  if (source.evidenceByQuestionID && typeof source.evidenceByQuestionID === "object") {
    state.evidenceByQuestionID = Object.fromEntries(
      Object.entries(source.evidenceByQuestionID)
        .filter(([questionID, record]) => typeof questionID === "string" && record && typeof record === "object")
        .map(([questionID, record]) => [questionID, copy(record)])
    );
  }

  if (source.deepLink && typeof source.deepLink === "object") {
    state.deepLink = {
      projectID: String(source.deepLink.projectID || "").trim() || null,
      questionID: String(source.deepLink.questionID || "").trim() || null,
      stage: (() => {
        try {
          return normalizeWorkspaceStage(source.deepLink.stage);
        } catch {
          return null;
        }
      })()
    };
  }

  return state;
}

/**
 * Apply a stage preset: replace question-scoped open panes with arrangement defaults.
 * Does not mutate shared professional state — only workspace open/focus context.
 */
export function applyStageArrangement(cqState, {
  projectID,
  questionID,
  stage,
  keepIndex = true
} = {}) {
  const normalizedStage = normalizeWorkspaceStage(stage);
  const project = requiredText(projectID, "project ID");
  const question = requiredText(questionID, "question ID");
  const roles = codeQuestionStageArrangements[normalizedStage] || codeQuestionStageArrangements.define;
  const next = normalizeCodeQuestionWorkspaceState({
    ...cqState,
    activeQuestionID: question,
    activeStage: normalizedStage,
    questionIndexOpen: keepIndex,
    openPanes: [
      ...(keepIndex
        ? [{
            projectID: project,
            questionID: "_",
            paneRole: "question-index",
            paneID: questionPaneKey({ projectID: project, questionID: "_", paneRole: "question-index" })
          }]
        : []),
      ...roles
        .filter((role) => role !== "question-index")
        .map((paneRole) => ({
          projectID: project,
          questionID: question,
          paneRole,
          paneID: questionPaneKey({ projectID: project, questionID: question, paneRole })
        }))
    ]
  }, { activeProjectID: project });
  return next;
}

/**
 * Project switch: drop all question panes and question selection for other projects.
 */
export function switchActiveProject(cqState, nextProjectID) {
  const projectID = String(nextProjectID || "").trim();
  return normalizeCodeQuestionWorkspaceState({
    ...cqState,
    activeQuestionID: "",
    activeStage: "define",
    moreMenuOpen: false,
    openPanes: projectID
      ? [{
          projectID,
          questionID: "_",
          paneRole: "question-index",
          paneID: questionPaneKey({ projectID, questionID: "_", paneRole: "question-index" })
        }]
      : [],
    questionIndexOpen: Boolean(projectID),
    deepLink: null
  }, { activeProjectID: projectID });
}

/**
 * Question switch: replace question-owned panes; keep index; apply current stage arrangement.
 */
export function switchActiveQuestion(cqState, { projectID, questionID, stage = null } = {}) {
  const project = requiredText(projectID, "project ID");
  const question = requiredText(questionID, "question ID");
  const nextStage = stage || cqState?.activeStage || "define";
  return applyStageArrangement(cqState, {
    projectID: project,
    questionID: question,
    stage: nextStage,
    keepIndex: true
  });
}

export function openSupportingTool(cqState, { projectID, questionID = "_", paneRole } = {}) {
  const project = requiredText(projectID, "project ID");
  if (!isCodeQuestionPaneRole(paneRole)) throw new Error("Invalid supporting pane role.");
  const base = normalizeCodeQuestionWorkspaceState(cqState, { activeProjectID: project });
  const pane = {
    projectID: project,
    questionID: String(questionID || base.activeQuestionID || "_"),
    paneRole,
    paneID: questionPaneKey({
      projectID: project,
      questionID: String(questionID || base.activeQuestionID || "_"),
      paneRole
    })
  };
  if (!base.openPanes.some((item) => item.paneID === pane.paneID)) {
    base.openPanes.push(pane);
  }
  base.moreMenuOpen = false;
  return base;
}

export function closeCodeQuestionPane(cqState, paneID, activeProjectID = "") {
  const base = normalizeCodeQuestionWorkspaceState(cqState, { activeProjectID });
  base.openPanes = base.openPanes.filter((pane) => pane.paneID !== paneID);
  const parsed = parseQuestionPaneKey(paneID);
  if (parsed?.paneRole === "question-index") base.questionIndexOpen = false;
  return base;
}

export function filterQuestions(questions = [], filters = {}) {
  const query = String(filters.query || "").trim().toLowerCase();
  const includeArchived = filters.includeArchived === true || filters.recordState === "all";
  const wantArchived = filters.recordState === "archived";
  return (Array.isArray(questions) ? questions : []).filter((item) => {
    if (!item) return false;
    if (wantArchived && item.recordState !== "archived") return false;
    if (!includeArchived && !wantArchived && item.recordState === "archived") return false;
    if (!query) return true;
    const haystack = [
      item.displayID,
      item.title,
      item.responsibleDisplayName,
      item.reviewState,
      item.listLabel
    ].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

export function deriveQuestionListLabel(question = {}) {
  const parts = [];
  if (question.latestIssuedVersion != null && Number.isFinite(Number(question.latestIssuedVersion))) {
    parts.push(`Issued v${Number(question.latestIssuedVersion)}`);
  }
  if (question.revisionInProgress) parts.push("Revision in progress");
  if (parts.length) return parts.join(" · ");
  if (question.recordState === "archived") return "Archived";
  if (question.reviewState) return String(question.reviewState);
  return "Active";
}

/**
 * Deep link helpers. Layout widths/order stay in workspace-state storage, not URL.
 * Format: #cq/project/{projectID}/question/{questionID}/stage/{stage}
 * or #cq/project/{projectID}
 */
export function buildCodeQuestionDeepLink({ projectID, questionID = null, stage = null } = {}) {
  const project = String(projectID || "").trim();
  if (!project) return "";
  let path = `#cq/project/${encodeURIComponent(project)}`;
  if (questionID) {
    path += `/question/${encodeURIComponent(String(questionID).trim())}`;
    if (stage) {
      try {
        path += `/stage/${encodeURIComponent(normalizeWorkspaceStage(stage))}`;
      } catch {
        // omit invalid stage
      }
    }
  }
  return path;
}

export function parseCodeQuestionDeepLink(hash) {
  const raw = String(hash || "").replace(/^#/, "").trim();
  if (!raw.startsWith("cq/")) return null;
  const segments = raw.split("/").filter(Boolean);
  // cq project {id} [question {id} [stage {stage}]]
  if (segments[0] !== "cq" || segments[1] !== "project" || !segments[2]) return null;
  const result = {
    projectID: decodeURIComponent(segments[2]),
    questionID: null,
    stage: null
  };
  if (segments[3] === "question" && segments[4]) {
    result.questionID = decodeURIComponent(segments[4]);
  }
  if (segments[5] === "stage" && segments[6]) {
    try {
      result.stage = normalizeWorkspaceStage(decodeURIComponent(segments[6]));
    } catch {
      result.stage = null;
    }
  }
  return result;
}

/**
 * Responsive visibility model (implementation contract).
 * Does not close panes — only recommends how many primary columns to focus.
 */
export function recommendedVisibleColumnCount(workspaceWidth) {
  const width = Number(workspaceWidth);
  if (!Number.isFinite(width) || width >= 1440) return 3;
  if (width >= 1180) return 2;
  return 1;
}

export function minimumWidthForPaneRole(paneRole) {
  return codeQuestionPaneMinimumWidths[paneRole] || 340;
}

/**
 * One Workboard per Project: when opening workboard role, ensure only one open.
 */
export function ensureSingleWorkboardPane(openPanes = [], projectID) {
  const project = String(projectID || "").trim();
  let seen = false;
  return (Array.isArray(openPanes) ? openPanes : []).filter((pane) => {
    if (pane.paneRole !== "workboard") return true;
    if (pane.projectID !== project) return true;
    if (seen) return false;
    seen = true;
    return true;
  });
}

export function codeQuestionPaneIDsFromState(cqState) {
  const normalized = normalizeCodeQuestionWorkspaceState(cqState);
  return normalized.openPanes.map((pane) => pane.paneID);
}

export function stageControlModel(activeStage) {
  let stage;
  try {
    stage = normalizeWorkspaceStage(activeStage);
  } catch {
    stage = "define";
  }
  return codeQuestionWorkflowStages.map((value) => ({
    stage: value,
    label: value.charAt(0).toUpperCase() + value.slice(1),
    current: value === stage,
    ariaCurrent: value === stage ? "step" : undefined
  }));
}
