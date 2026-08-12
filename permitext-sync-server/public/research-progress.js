export const researchProgressVersion = "20260812-research-progress-v20";

export const researchProgressStages = Object.freeze([
  Object.freeze({ id: "preparing_question", label: "Preparing the question" }),
  Object.freeze({ id: "searching_authorized_library", label: "Searching the authorized enacted library" }),
  Object.freeze({ id: "reviewing_provisions", label: "Reviewing potentially applicable provisions" }),
  Object.freeze({ id: "following_cross_references", label: "Following cross-references" }),
  Object.freeze({ id: "checking_citation_support", label: "Checking citation support" }),
  Object.freeze({ id: "preparing_conclusion", label: "Preparing the conclusion" })
]);

export const researchProgressStates = Object.freeze([
  "pending",
  "active",
  "completed",
  "failed",
  "cancelled",
  "retrying"
]);

const stageByID = new Map(researchProgressStages.map((stage, index) => [stage.id, { ...stage, index }]));
const allowedStates = new Set(researchProgressStates);

export function researchProgressStage(stageID) {
  return stageByID.get(String(stageID || "")) || null;
}

export function createResearchProgressEvent({ stageID, state, sequence, at = new Date().toISOString() }) {
  const stage = researchProgressStage(stageID);
  if (!stage) throw new Error("Unsupported public Research progress stage.");
  if (!allowedStates.has(state) || state === "pending") {
    throw new Error("Unsupported emitted Research progress state.");
  }
  const normalizedSequence = Number(sequence);
  if (!Number.isInteger(normalizedSequence) || normalizedSequence < 1) {
    throw new Error("Research progress sequence must be a positive integer.");
  }
  return Object.freeze({
    version: researchProgressVersion,
    stage: stage.id,
    label: stage.label,
    state,
    sequence: normalizedSequence,
    at: new Date(at).toISOString()
  });
}

export function researchProgressSummary(events, { startedAt, completedAt } = {}) {
  const latestByStage = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    const stage = researchProgressStage(event?.stage);
    if (!stage || !allowedStates.has(event?.state)) continue;
    latestByStage.set(stage.id, event.state);
  }
  return {
    version: researchProgressVersion,
    status: researchProgressStages.every((stage) => latestByStage.get(stage.id) === "completed")
      ? "completed"
      : "incomplete",
    startedAt: new Date(startedAt || events?.[0]?.at || Date.now()).toISOString(),
    completedAt: completedAt ? new Date(completedAt).toISOString() : null,
    stages: researchProgressStages.map((stage) => ({
      id: stage.id,
      label: stage.label,
      state: latestByStage.get(stage.id) || "pending"
    }))
  };
}
