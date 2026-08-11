import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  projectResearchConversationForList,
  validateResearchEvidenceAnalysis
} from "../app.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const [appSource, clientSource, stylesSource] = await Promise.all([
  readFile(join(root, "../app.mjs"), "utf8"),
  readFile(join(root, "../public/app.js"), "utf8"),
  readFile(join(root, "../public/styles.css"), "utf8")
]);

const hugeVisual = "data:image/png;base64," + "A".repeat(50_000);
const conversation = {
  id: "conv-list-1",
  title: "List projection conversation",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T01:00:00.000Z",
  primaryProjectID: "project-1",
  starterQuestion: "What applies?",
  projectContextReviewRequired: false,
  sourceStatus: "current",
  messages: [
    { id: "m1", role: "user", question: "q", createdAt: "2026-08-01T00:00:00.000Z" },
    {
      id: "m2",
      role: "assistant",
      answer: { conclusion: "Maybe", visualBoard: hugeVisual },
      createdAt: "2026-08-01T00:01:00.000Z"
    }
  ],
  sources: [
    {
      kind: "selection",
      sectionID: "8881",
      passageText: "Long passage body that should not appear in list projections.",
      selectedText: "notify the department"
    },
    {
      kind: "visual",
      sourceID: "visual-1",
      dataURL: hugeVisual,
      fileName: "plan.png"
    }
  ]
};

const projected = projectResearchConversationForList(conversation);
assert.equal(projected.id, "conv-list-1");
assert.equal(projected.messageCount, 2);
assert.equal(projected.sources.length, 1);
assert.equal(projected.sources[0].sectionID, "8881");
assert.equal(projected.messages, undefined);
assert.equal(
  JSON.stringify(projected).includes(hugeVisual),
  false,
  "List projection still embeds full visual/message payload data."
);
assert.equal(
  JSON.stringify(projected).includes("Long passage body"),
  false,
  "List projection still embeds full passage text."
);

assert.match(
  appSource,
  /listStoredResearchConversations\(context\.userID,\s*\{\s*summaryOnly:\s*true\s*\}/,
  "Research list handler does not request summaryOnly conversations."
);
assert.match(
  appSource,
  /options\.summaryOnly/,
  "Store adapters do not implement summaryOnly listing."
);
assert.match(
  appSource,
  /jsonb_array_length\(COALESCE\(conversation->'messages'/,
  "Postgres summary listing does not project messageCount without loading full messages."
);
assert.match(
  clientSource,
  /clearChatsButton\.textContent = "Clear"/,
  "Research history does not expose a clear action beside New chat."
);
assert.match(
  clientSource,
  /Clear Research history\?/,
  "Research history clearing is missing an explicit confirmation."
);
assert.match(
  clientSource,
  /\/research\/conversations\/clear-history/,
  "Research history clearing does not use the safe bulk history endpoint."
);
assert.match(
  clientSource,
  /Saved Research answers and governed Code Decision records will remain/,
  "Research history clearing does not disclose the preserved evidence boundary."
);
assert.match(
  stylesSource,
  /\.research-clear-chats-button/,
  "Research history clear control has no dedicated header styling."
);
assert.match(appSource, /conversation\?\.primaryProjectID[\s\S]*historyHiddenAt/, "Project conversations are not preserved when history is cleared.");
assert.match(appSource, /filter\(\(conversation\) => !conversation\.historyHiddenAt\)/, "Hidden Project conversations still appear in the main history.");
assert.match(clientSource, /research-back-button[\s\S]*showNewResearchChat/, "Research does not provide a Back control.");
assert.match(clientSource, /unansweredConversations[\s\S]*No completed answer yet\./, "Empty Project conversations cannot be reopened from Project Research history.");

const analysisFixture = {
  controllingProvisions: [], generalRules: [], exceptions: [], conditions: [], limitations: [],
  definitions: [], crossReferences: [], tables: [], userPinnedEvidence: [], permitextDiscoveredEvidence: [],
  projectFactsUsed: [], unresolvedProjectFacts: [], evidenceLimitations: ["Bounded corpus."], highValueFollowUpQuestions: []
};
assert.doesNotThrow(
  () => validateResearchEvidenceAnalysis(analysisFixture, [], []),
  "Question facts should not be misclassified as invented Project-folder facts."
);
assert.match(appSource, /projectFactsUsed\.maxItems = 0/, "The evidence-analysis schema does not forbid invented Project facts when no Project facts exist.");
assert.match(appSource, /max_output_tokens: 6_000,/, "The evidence-analysis model can still be cut off before returning its structured legal-research map.");
assert.match(appSource, /max_output_tokens: 2_000,/, "The Research verifier can still be cut off before returning its structured result.");
assert.match(appSource, /maximumResearchVerificationAttempts = 3/, "Research does not preserve two bounded correction opportunities behind the verifier gate.");

console.log("permitext research list summary contract passed");
