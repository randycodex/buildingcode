import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assembleResearchEvidence } from "../research-evidence-assembly.mjs";
import {
  createResearchProgressEvent,
  researchProgressStages,
  researchProgressStates,
  researchProgressSummary
} from "../public/research-progress.js";

const expectedStages = [
  ["preparing_question", "Preparing the question"],
  ["searching_authorized_library", "Searching the authorized enacted library"],
  ["reviewing_provisions", "Reviewing potentially applicable provisions"],
  ["following_cross_references", "Following cross-references"],
  ["checking_citation_support", "Checking citation support"],
  ["preparing_conclusion", "Preparing the conclusion"]
];

assert.deepEqual(
  researchProgressStages.map((stage) => [stage.id, stage.label]),
  expectedStages,
  "Public Research progress stages changed order or wording."
);
assert.deepEqual(
  researchProgressStates,
  ["pending", "active", "completed", "failed", "cancelled", "retrying"],
  "Research progress states no longer cover the required public lifecycle."
);

const emitted = expectedStages.flatMap(([stageID], index) => [
  createResearchProgressEvent({ stageID, state: "active", sequence: index * 2 + 1 }),
  createResearchProgressEvent({ stageID, state: "completed", sequence: index * 2 + 2 })
]);
for (const event of emitted) {
  assert.deepEqual(
    Object.keys(event).sort(),
    ["at", "label", "sequence", "stage", "state", "version"],
    "Research progress exposed a field outside the public contract."
  );
  assert.doesNotMatch(
    JSON.stringify(event),
    /prompt|reasoning|thought|token|cost|limit|model|provider|internal/i,
    "Research progress exposed private operational or reasoning metadata."
  );
}
assert.throws(
  () => createResearchProgressEvent({ stageID: "model_reasoning", state: "active", sequence: 1 }),
  /Unsupported public Research progress stage/
);
assert.throws(
  () => createResearchProgressEvent({ stageID: "preparing_question", state: "thinking", sequence: 1 }),
  /Unsupported emitted Research progress state/
);

const summary = researchProgressSummary(emitted, {
  startedAt: emitted[0].at,
  completedAt: emitted.at(-1).at
});
assert.equal(summary.status, "completed");
assert(summary.stages.every((stage) => stage.state === "completed"));

const assemblyStages = [];
await assembleResearchEvidence({
  question: "What enacted provisions apply?",
  discover: async () => ({ candidates: [] }),
  resolveSection: async () => null,
  onStage: (stageID, state) => assemblyStages.push([stageID, state])
});
assert.deepEqual(assemblyStages, [
  ["searching_authorized_library", "active"],
  ["searching_authorized_library", "completed"],
  ["reviewing_provisions", "active"],
  ["reviewing_provisions", "completed"],
  ["following_cross_references", "active"],
  ["following_cross_references", "completed"]
], "Evidence assembly no longer reports its real observable stages in order.");

const [serverSource, clientSource, styleSource] = await Promise.all([
  readFile(new URL("../app.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8")
]);
assert(serverSource.includes('context.body.progressStream === "ndjson"'));
assert(serverSource.includes("researchRequestSignal(options.signal"));
assert(clientSource.includes("new AbortController()"));
assert(clientSource.includes('progress.retry = () => void execute(true)'));
assert(clientSource.includes('error.name === "AbortError"'));
assert(!clientSource.includes('className = "research-progress-details"'), "Research progress cards still expose the internal stage checklist.");
assert(!clientSource.includes('className = "research-progress-tasks"'), "Research progress task rows are still rendered.");
assert.match(styleSource, /\.research-progress-card\s*\{[\s\S]*?padding: 0;[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
assert.match(styleSource, /workspace-panel:not\(\.reader-panel\) \.research-progress-loading-label\s*\{[\s\S]*?font-size: 10px !important;[\s\S]*?font-weight: 400;/);
assert.match(styleSource, /workspace-panel:not\(\.reader-panel\) \.research-progress-elapsed\s*\{[\s\S]*?font-size: 10px !important;[\s\S]*?font-weight: 400;/);
assert(styleSource.includes("grid-template-columns: repeat(3, 2px)"));
assert(!styleSource.includes("research-progress-shimmer"), "Research status text still uses a blinking shimmer animation.");
assert(styleSource.includes("@media (prefers-reduced-motion: reduce)"));

console.log("permitext research progress contract passed");
