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
assert.equal(projected.starterQuestion, "What applies?");
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

assert.match(clientSource, /if \(originSurface === "reader"\) return "Started from Reader";/, "Reader-started Research does not identify its origin inside the conversation.");
assert.match(clientSource, /\? "Started from selected code"/, "Legacy selected-code conversations overstate an unrecorded Reader origin.");
assert.match(clientSource, /originSurface: "reader"/, "Reader selections do not persist their conversation origin.");
assert.match(clientSource, /originSurface: "evidenceDiscovery"/, "Evidence Discovery selections are not distinguished from Reader origins.");
assert.match(clientSource, /sources\.length === 1 \? "passage" : "passages"/, "Reader origins do not summarize multiple selected passages.");
assert.match(clientSource, /openButton\.textContent = "Open source";/, "Reader-origin passages cannot navigate back to their source.");
assert.match(stylesSource, /\.research-reader-origin \{[\s\S]*?border: 1px solid var\(--border\);/, "Reader-origin evidence has no visible conversation card.");
assert.match(appSource, /researchOriginForSelections\(selections, context\.body\.originSurface\)/, "The server does not persist the supplied Research origin surface.");

const legacyProjected = projectResearchConversationForList({
  ...conversation,
  starterQuestion: null,
  messages: [
    { id: "m1", role: "user", question: "What was originally asked?" },
    { id: "m2", role: "assistant", answer: { conclusion: "Answer" } }
  ]
});
assert.equal(
  legacyProjected.starterQuestion,
  "What was originally asked?",
  "Legacy conversations should derive the original question without returning message history."
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
  appSource,
  /conversation#>>'\{messages,0,question\}'/,
  "Postgres summary listing does not recover the original question for legacy conversations."
);
assert.match(appSource, /conversation\.starterQuestion \|\|= question;/, "The first ordinary Research question is not persisted as the stable starter question.");
assert.match(clientSource, /title\.textContent = conversation\.starterQuestion \|\| "Question not yet asked";/, "Previous chats do not show the original question.");
assert.match(clientSource, /meta\.textContent = researchConversationDate\(conversation\.createdAt\);/, "Previous chats do not show the conversation creation date.");
assert.match(clientSource, /projectPill\.textContent = conversation\.primaryProjectID[\s\S]*?researchProjectName\(conversation\.primaryProjectID\)[\s\S]*?"Not in a Project";/, "Previous chats do not identify their assigned Project.");
assert.match(stylesSource, /\.research-conversation-open \{[\s\S]*?gap: var\(--space-3\);/, "Previous chat questions need visible separation from their metadata.");
assert.match(stylesSource, /\.research-conversation-meta \{[\s\S]*?justify-content: space-between;/, "Previous chat dates and Project pills should share an aligned metadata row.");
assert.match(stylesSource, /\.research-conversation-project-pill \{[\s\S]*?width: fit-content;[\s\S]*?margin-left: auto;/, "Previous chat Project pills should size to their titles and align right.");
assert.match(clientSource, /const researchListScrollTop = track\.querySelector\([\s\S]*?utility:analysis[\s\S]*?analysis-content[\s\S]*?\)\?\.scrollTop \?\? 0;[\s\S]*?refreshedResearchList\.scrollTop = Math\.min/, "Opening a previous chat should preserve the inner Research list scroll position.");
assert.match(stylesSource, /\.research-conversation-open strong \{[\s\S]*?font-weight: 400;[\s\S]*?line-height: 1\.35;/, "Previous chat questions do not use regular weight with readable line spacing.");
assert.match(clientSource, /function researchConversationHistoryGroups\(conversations = \[\], now = new Date\(\)\)/, "Research history has no deterministic time-grouping helper.");
assert.match(clientSource, /ageInDays < 7[\s\S]*?"7 days"[\s\S]*?ageInDays < 14[\s\S]*?"Previous 7 days"[\s\S]*?ageInDays < 30[\s\S]*?"Previous 30 days"/, "Research history does not use the expected recent weekly buckets.");
assert.match(stylesSource, /\.research-history-group-label \{[\s\S]*?font-size: 14px !important;[\s\S]*?font-weight: 400;/, "Research history group headings should use 14px regular text.");
assert.doesNotMatch(clientSource, /research-history-group-count|const groupCount =/, "Research history group headings should not display conversation counters.");
const newResearchComposerStart = clientSource.indexOf("function renderNewResearchComposer(");
const newResearchComposerEnd = clientSource.indexOf("\nasync function renderResearch(", newResearchComposerStart);
const newResearchComposerSource = clientSource.slice(newResearchComposerStart, newResearchComposerEnd);
assert.ok(newResearchComposerStart >= 0 && newResearchComposerEnd > newResearchComposerStart, "New Research composer source was not found.");
assert.doesNotMatch(newResearchComposerSource, /createResearchProjectSelect|research-start-project|projectSelect/, "New Research chats should not show a Project context selector.");
assert.match(newResearchComposerSource, /projectID: ""/, "New Research chats should begin unassigned until saved from the conversation column.");
assert.doesNotMatch(newResearchComposerSource, /What would you like to research\?|createElement\("h3"\)/, "The new Research composer should begin directly with the chat box.");
assert.match(clientSource, /monthFormatter\.format\(created\)[\s\S]*?`year-\$\{created\.getFullYear\(\)\}`/, "Older Research history is not grouped by calendar month and year.");
assert.match(clientSource, /researchConversationHistoryGroups\(researchConversationList\)\.forEach\(\(historyGroup\)/, "Previous chats are not rendered through the time groups.");
assert.doesNotMatch(clientSource, /research-conversation-list-heading|listHeading\.textContent = "Previous chats"/, "The redundant Previous chats heading should remain removed.");
assert.doesNotMatch(stylesSource, /\.research-conversation-list-heading/, "Removed Research history heading styles should not remain in the release surface.");
assert.match(clientSource, /researchHistoryGroupExpansion[\s\S]*?wireProjectSectionMotion\([\s\S]*?onChange: \(expanded\)/, "Research history group expansion is not persisted through the standard motion control.");
assert.match(stylesSource, /\.research-history-group-body \{[\s\S]*?display: grid;/, "Research history groups have no collapsible body layout.");
assert.match(stylesSource, /\.research-conversation-header-project \{[\s\S]*?appearance: none;[\s\S]*?-webkit-appearance: none;[\s\S]*?background: color-mix\(in srgb, var\(--project-color, var\(--text-tertiary\)\) 42%, var\(--surface\)\);[\s\S]*?background-image: none;/, "The conversation Project pill should hide the native chevron and use its Project card color.");
assert.match(stylesSource, /\.research-answer-open-source \{[\s\S]*?padding: 0;[\s\S]*?border: 0;[\s\S]*?border-radius: 0;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/, "Open source should render as a plain text action rather than a pill.");
assert.match(stylesSource, /\.project-section-motion > \.project-section-motion-body \{[\s\S]*?max-height 420ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/, "Research history cannot inherit the established collapse motion.");
assert.match(clientSource, /conversation\.starterQuestion \|\| summaryQuestion \|\| conversation\.title/, "The standalone conversation column does not retain the original question as its title.");
assert.match(clientSource, /if \(!releaseSurfaceVisibility\.researchHistoryManagement\)/, "Deferred per-chat management controls are not hidden behind the release boundary.");
assert.doesNotMatch(clientSource, /Ask naturally\. Permitext will research/, "The redundant Research start helper sentence is still visible.");
assert.doesNotMatch(clientSource, /Project context \(optional\)/i, "The redundant Project context caption is still visible above the Research selector.");
assert.match(stylesSource, /\.research-composer\.research-start-composer \{[\s\S]*?background: transparent;/, "The Research start composer still renders a tinted outer block.");
assert.match(stylesSource, /\.search-box,[\s\S]*?\.research-start-composer \.research-composer-box \{[\s\S]*?background: #111111;/, "The dark Research chat box does not match the Search pill surface.");
assert.match(clientSource, /selectHistoryButton\.innerHTML = selectionModeIconSVG\(\)/, "Research history does not expose its selection icon.");
assert.match(clientSource, /cancelSelectionButton\.textContent = "Cancel"[\s\S]*?selectAllButton\.textContent = "Select all"/, "Research selection mode is missing Cancel or Select all.");
assert.match(clientSource, /if \(selectingConversations\)[\s\S]*?toggleConversationSelection\(conversation\.id\)/, "Conversation rows do not toggle selection instead of opening while selection mode is active.");
assert.match(clientSource, /row\.classList\.toggle\("is-selected", selected\)/, "Selected Research rows do not receive a visible state hook.");
assert.match(clientSource, /conversationIDs: conversations\.map\(\(conversation\) => conversation\.id\)/, "Research history removal does not send only the selected conversation IDs.");
assert.match(
  clientSource,
  /Remove selected Research history\?/,
  "Selected Research history removal is missing an explicit confirmation."
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
  /\.research-history-select-button/,
  "Research history selection control has no dedicated header styling."
);
assert.match(stylesSource, /\.research-conversation-row\.is-selected \{[\s\S]*?background:/, "Selected Research rows do not visibly change color.");
assert.match(stylesSource, /\.research-history-select-button \{[\s\S]*?border: 0;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/, "The Research selection icon does not match Permitext's bare column-header controls.");
assert.match(appSource, /requestedConversationIDs[\s\S]*?allConversations\.filter\(\(conversation\) => requestedConversationIDs\.has\(conversation\.id\)\)/, "The server does not scope Research history removal to the selected IDs.");
assert.match(appSource, /conversation\?\.primaryProjectID[\s\S]*historyHiddenAt/, "Project conversations are not preserved when history is cleared.");
assert.match(appSource, /filter\(\(conversation\) => !conversation\.historyHiddenAt\)/, "Hidden Project conversations still appear in the main history.");
assert.doesNotMatch(clientSource, /className = "ghost-button research-back-button"/, "The redundant Research Back control should remain removed.");
assert.doesNotMatch(clientSource, /className = "ghost-button research-new-chat-button"/, "The redundant Research New chat control should remain removed.");
assert.match(clientSource, /function bindResearchSendShortcut[\s\S]*?event\.key !== "Enter" \|\| event\.shiftKey \|\| event\.isComposing[\s\S]*?form\.requestSubmit\(\)/, "Enter should start a Research conversation while Shift+Enter remains available for a line break.");
assert.match(clientSource, /const conversations = \[\.\.\.\(foundation\?\.researchConversations \|\| \[\]\)\][\s\S]*?filter\(\(conversation\) => String\(conversation\.starterQuestion \|\| ""\)\.trim\(\)\)[\s\S]*?question\.textContent = conversation\.starterQuestion;/, "Project Research history must show only conversations with an original question.");
assert.doesNotMatch(clientSource, /renderResearchAnswerSave|Save to Project|research-answer-save/, "Per-answer Project saving must remain removed from Research conversations.");
assert.match(clientSource, /unassignedLabel: "Not in a Project"[\s\S]*?assignResearchConversationProject\(conversation, targetProjectID/, "The conversation header does not auto-assign the full conversation to a Project.");
assert.match(appSource, /const requiresContextReview = Boolean\(currentProjectID\);/, "A first-time Project assignment should not require a move confirmation.");
assert.match(clientSource, /`Move this conversation to \$\{targetProjectName\}\?`[\s\S]*?The entire conversation will move from \$\{currentProjectName\} to \$\{targetProjectName\}[\s\S]*?Its existing answers and citations will not change[\s\S]*?Future questions will use the current Project facts from \$\{targetProjectName\}/, "The Project-move warning should explain what moves, what stays unchanged, and which visible Project facts future questions use.");
assert.match(clientSource, /confirmLabel: targetProjectID \? "Move conversation" : "Remove from Project"/, "The Project-move warning should use explicit action labels.");
assert.match(appSource, /conversation\.projectContextReviewRequired = false;/, "A confirmed move should use the destination Project's visible facts without a second hidden review gate.");
assert.match(clientSource, /function appendSavedProjectResearchConversations[\s\S]*?filter\(\(conversation\) => String\(conversation\.starterQuestion \|\| ""\)\.trim\(\)\)[\s\S]*?question\.textContent = conversation\.starterQuestion[\s\S]*?openResearchConversation\(conversation\.id, \{ showResearchList: false \}\)/, "The Project folder does not open assigned conversations directly by original question.");
assert.match(clientSource, /if \(state\.utilities\.analysis && researchConversationPaneIsOpen\(\)\) \{[\s\S]*?openSupplementalResearchConversation\(conversation\.id\)[\s\S]*?return;[\s\S]*?openResearchConversation\(conversation\.id, \{ showResearchList: false \}\)/, "Project Research should add a separate conversation pane when the primary Research pair is already open.");
assert.match(clientSource, /function openResearchConversationPaneIDs\(\)[\s\S]*?supplementalResearchConversationIDs\.map[\s\S]*?for \(const conversationID of supplementalResearchConversationIDs\)[\s\S]*?renderResearchConversation\(conversationID, \{ supplemental: true \}\)/, "Supplemental Project conversations are not represented as independent active panes.");
assert.match(clientSource, /Cited \$\{citedProvisionCount\} enacted/, "Research answers do not distinguish cited provisions from reviewed evidence.");
assert.match(clientSource, /additional \$\{reviewedOnlyProvisionCount/, "Research answers do not disclose additional provisions reviewed.");
assert.match(clientSource, /citation\.evidenceRole === "supporting"/, "Supporting citations are not visibly classified.");
assert.match(appSource, /"unnecessary_qualification"/, "The verifier cannot classify unjustified caution.");
assert.match(appSource, /"repeated_established_fact"/, "The verifier cannot classify requests to reconfirm established facts.");
assert.match(appSource, /Fail with unnecessary_qualification/, "The verifier is not instructed to reject unjustified caution.");
assert.match(appSource, /Fail with repeated_established_fact/, "The verifier is not instructed to reject repeated fact requests.");
assert.match(appSource, /If the value complies with a stricter baseline limit/, "The answer model is not instructed to preserve the strongest numeric-table conclusion.");
assert.match(appSource, /Treat a corpus or evidence limitation as a boundary/, "The answer model may still turn a missing source into an unsupported legal requirement.");
assert.match(appSource, /Preserve the factual content of an established user shorthand such as fully sprinklered/, "The answer model may still re-ask an established sprinkler fact.");
assert.match(appSource, /accumulatedResearchVerificationIssues\(verificationAttempts\)/, "Bounded revisions do not retain earlier verifier corrections.");

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
