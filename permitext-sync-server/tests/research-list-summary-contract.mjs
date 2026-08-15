import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  projectResearchConversationForList,
  researchProjectInformation,
  validateResearchEvidenceAnalysis,
  researchFactUsageDisclosure
} from "../app.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const [appSource, clientSource, stylesSource, indexSource] = await Promise.all([
  readFile(join(root, "../app.mjs"), "utf8"),
  readFile(join(root, "../public/app.js"), "utf8"),
  readFile(join(root, "../public/styles.css"), "utf8"),
  readFile(join(root, "../public/index.html"), "utf8")
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
assert.match(clientSource, /reference\.textContent = \[prefix, sectionDisplayTitle\(sectionNumber, source\.title, "Selected code passage"\)\]/, "Reader-origin links omit the complete section subtitle.");
assert.match(clientSource, /reference\.addEventListener\("click", \(\) => \{[\s\S]*?openResearchSourceInSectionDetail\([\s\S]*?conversation\.primaryProjectID \|\| ""/, "Reader-origin subtitles should open the Project-aware source column without creating Search.");
assert.match(clientSource, /passageHeader\.append\(reference\);/, "Reader-origin passages still expose a separate source action.");
assert.match(clientSource, /passage\.classList\.add\(`code-theme-\$\{codeTheme\(source\.codePrefix \|\| "BC"\)\}`\)/, "Reader-origin passage cards do not inherit their source code color.");
assert.match(stylesSource, /\.research-reader-origin-list article \{[\s\S]*?border-radius: var\(--radius-card\);[\s\S]*?background: color-mix\(in srgb, var\(--code-accent, var\(--text-primary\)\) 13%, transparent\);/, "Reader-origin passages are not separated into source-colored cards.");
assert.match(appSource, /researchOriginForSelections\(selections, context\.body\.originSurface\)/, "The server does not persist the supplied Research origin surface.");

const structuredProjectInformation = researchProjectInformation("project-structured", {
  address: "214 West 118th Street",
  description: "An existing six-story Group R-2 building of Type IIIA construction.",
  structuredFacts: [
    { id: "project-fact:occupancy", key: "occupancy", label: "Occupancy", value: "Group R-2", status: "confirmed", source: "user" },
    { id: "project-fact:stories", key: "stories", label: "Stories", value: "6", status: "stated", source: "description" },
    { id: "project-fact:sprinkler", key: "sprinkler", label: "Sprinkler status", value: "Unknown", status: "unknown", source: "user" },
    { id: "project-fact:type", key: "type", label: "Construction type", value: "Type IIB", status: "rejected", source: "user" },
    { id: "project-fact:floor", key: "floor-affected", label: "Floor affected", value: "Third floor", status: "stated", source: "user" },
    { id: "project-fact:lots", key: "tax-lots", label: "Tax Lot(s)", value: "52, 53, 54, 55", status: "stated", source: "user" },
    { id: "project-fact:lot-composition", key: "zoning-lot-composition", label: "Zoning Lot Composition", value: "Tax Lots 52, 53, 54 and 55 comprise one zoning lot.", status: "stated", source: "user" },
    { id: "project-fact:districts", key: "zoning-districts", label: "Zoning District(s)", value: "C4-4D, R7-2", status: "stated", source: "user" },
    { id: "project-fact:frontages", key: "street-frontages", label: "Street Frontage(s)", value: "Third Avenue — Wide Street; East 120th Street — Narrow Street", status: "stated", source: "user" },
    { id: "project-fact:travel", key: "travel-distance", label: "Travel Distance", value: "95 feet", status: "stated", source: "user" }
  ]
});
assert.deepEqual(structuredProjectInformation.facts, [
  "Building / Code Fact — Occupancy: Group R-2 (user-confirmed; not independently verified)",
  "Building / Code Fact — Stories Above Grade: 6 (user-confirmed; not independently verified)",
  "Zoning Fact — Address: 214 West 118th Street (user-confirmed; not independently verified)",
  "Zoning Fact — Tax Lot(s): 52, 53, 54, 55 (user-confirmed; not independently verified)",
  "Zoning Fact — Zoning Lot Composition: Tax Lots 52, 53, 54 and 55 comprise one zoning lot. (user-confirmed; not independently verified)",
  "Zoning Fact — Zoning District(s): C4-4D, R7-2 (user-confirmed; not independently verified)",
  "Zoning Fact — Street Frontage(s): Third Avenue — Wide Street; East 120th Street — Narrow Street (user-confirmed; not independently verified)",
  "Custom Fact — Travel Distance: 95 feet (user-confirmed; not independently verified)",
  "Additional Project facts: An existing six-story Group R-2 building of Type IIIA construction."
]);
assert.equal(structuredProjectInformation.structuredFacts.length, 10);
assert.equal(structuredProjectInformation.structuredFacts[0].usedInResearch, true);
assert.equal(structuredProjectInformation.structuredFacts[2].usedInResearch, false);
assert.equal(structuredProjectInformation.facts.some((fact) => fact.includes("Floor affected:")), false);
assert.equal(structuredProjectInformation.buildingCodeFacts.length, 2);
assert.equal(structuredProjectInformation.zoningFacts.length, 5);
assert.equal(structuredProjectInformation.customFacts.length, 1);
assert.equal(structuredProjectInformation.missingFactsAreUnknown, true);
assert.equal(structuredProjectInformation.facts.some((fact) => fact.includes("Commercial Overlay")), false);
assert.notEqual(structuredProjectInformation.zoningFacts.find((fact) => fact.key === "tax-lots")?.value, structuredProjectInformation.zoningFacts.find((fact) => fact.key === "zoning-lot-composition")?.value);
assert.equal(structuredProjectInformation.facts.at(-1).startsWith("Additional Project facts:"), true);
assert.match(appSource, /A missing fact is unknown, not false, none, or inapplicable\. Identify a material missing fact instead of guessing it\./);
assert.match(clientSource, /structuredFacts: projectStructuredFacts\(project\)/, "Project mutations do not preserve structured facts.");
assert.doesNotMatch(clientSource, /Research may use as user-provided context\. Blank fields are ignored\./, "The removed Structured Facts helper text returned.");
assert.match(clientSource, /appendResearchProjectContextDisclosure\(card, result\)/, "Research answers do not disclose the Project context used.");
assert.match(clientSource, /summary\.textContent = "Facts used in this answer"/, "Research answers use a misleading Project-only heading for mixed fact sources.");
assert.match(clientSource, /appendGroup\("Project context", projectContext\)/, "Research answers do not identify facts sourced from Project context.");
assert.match(clientSource, /appendGroup\("Research conversation", conversation\)/, "Research answers do not identify facts extracted from the conversation.");
assert.match(stylesSource, /\.research-project-context-used > summary::after \{[\s\S]*?content: "›";/, "Facts-used disclosure does not share the Evidence reviewed chevron.");
assert.match(stylesSource, /\.research-project-context-used\[open\] > summary::after \{[\s\S]*?transform: rotate\(90deg\);/, "Facts-used chevron does not rotate with its disclosure state.");
assert.match(stylesSource, /\.research-project-context-used-body \{[\s\S]*?border: 0;[\s\S]*?border-radius:[\s\S]*?background: color-mix\(in srgb, var\(--text-primary\) 5%, transparent\);[\s\S]*?box-shadow: none;/, "Expanded facts are not visually grouped on the shared borderless inset surface.");
assert.match(stylesSource, /\.research-answer-review-row:has\(\.research-evidence-reviewed\[open\]\) \{[\s\S]*?display: block;/, "Expanded evidence remains squeezed beside the feedback controls.");
assert.match(stylesSource, /\.research-evidence-reviewed-body \{[\s\S]*?border: 0;[\s\S]*?border-radius:[\s\S]*?background: color-mix\(in srgb, var\(--text-primary\) 5%, transparent\);[\s\S]*?box-shadow: none;/, "Expanded evidence is not visually grouped on a quiet borderless inset surface.");
assert.match(stylesSource, /\.research-feedback-actions \.ghost-button \{[\s\S]*?border: 0;[\s\S]*?box-shadow: none;/, "Research feedback actions retain outlined or highlighted button chrome.");
assert.match(stylesSource, /\.research-feedback-choice \{[\s\S]*?border: 0;[\s\S]*?background: color-mix\(in srgb, var\(--text-primary\) 9%, transparent\);[\s\S]*?box-shadow: none;/, "Research feedback choices do not match the flat Update feedback action.");
assert.match(stylesSource, /\.research-feedback-actions \.research-feedback-cancel \{[\s\S]*?background: color-mix\(in srgb, var\(--text-primary\) 9%, transparent\);[\s\S]*?color: var\(--text-primary\);/, "Research feedback Cancel does not match the Update feedback action.");
assert.match(clientSource, /professionalRole\.className = "research-feedback-role-select"[\s\S]*?enhanceSelect\(professionalRole\)/, "Professional role does not use the shared floating-card select behavior.");
assert.match(stylesSource, /\.research-feedback-role-select-menu \{[\s\S]*?border-radius:[\s\S]*?background: var\(--menu-surface\)/, "Professional-role options do not open in the standard rounded floating card.");
assert.doesNotMatch(clientSource, /Supporting code section or official source|supportingReference/, "The removed supporting-source feedback field is still rendered or submitted by the client.");
assert.doesNotMatch(clientSource, /: "Permitext enacted source"/, "Research source cards still show the redundant Permitext enacted-source label.");
const answerSourceRenderer = clientSource.slice(
  clientSource.indexOf("function renderResearchAnswerSources"),
  clientSource.indexOf("function appendHistoricalResearchList")
);
assert.doesNotMatch(answerSourceRenderer, /openButton\.textContent = "Open source"/, "Saved Research source cards still show the removed Open source button.");
assert.match(stylesSource, /\.saved-project-structured-fact \{[\s\S]*?background:/, "Structured Project facts have no distinct review surface.");
assert.match(appSource, /incomingProject\?\.structuredFacts === undefined[\s\S]*?structuredFacts: existingProject\.structuredFacts/, "Older clients can erase structured Project facts during sync.");

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
assert.match(clientSource, /const researchProjectMenu = select\.classList\.contains\("research-conversation-header-project"\)[\s\S]*?research-project-select-menu[\s\S]*?research-project-custom-select/, "The Research Project control should use the shared custom picker instead of the browser-native menu.");
assert.match(clientSource, /actions\.prepend\(projectSelect\);\s*enhanceSelect\(projectSelect\);/, "The conversation header should enhance its Project select after mounting it.");
assert.match(stylesSource, /\.research-project-select-menu \{[\s\S]*?border-radius: clamp\(22px, 4vw, 30px\);/, "The Research Project menu should use the Reader picker's rounded popover surface.");
assert.match(clientSource, /panel\?\.classList\.contains\("reader-panel"\) \|\| researchProjectMenu[\s\S]*?menuHorizontalPadding[\s\S]*?range\.selectNodeContents\(item\)/, "The Research Project menu should fit its longest label while respecting the conversation panel inset.");
assert.match(stylesSource, /\.research-project-custom-select \{[\s\S]*?width: max-content;[\s\S]*?max-width: min\(260px, 48vw\);[\s\S]*?\.research-project-custom-select \.custom-select-trigger \{[\s\S]*?width: max-content;[\s\S]*?text-align: right;/, "The Research Project pill should keep its right edge anchored while growing left to fit its label.");
assert.match(stylesSource, /workspace-panel:not\(\.reader-panel\) \.research-evidence-reviewed > summary \{[\s\S]*?font-size: 14px !important;/, "Evidence reviewed should remain legible at the requested 14px component size.");
assert.match(stylesSource, /\.research-answer-primary \{[\s\S]*?font-weight: 400;/, "The first Research paragraph should use conversational body weight instead of automatic bold emphasis.");
assert.match(stylesSource, /workspace-panel:not\(\.reader-panel\) \.research-answer-code-basis \{[\s\S]*?font-size: 14px !important;/, "The Research Code basis disclosure should remain legible at 14px.");
assert.match(stylesSource, /\.research-answer-primary,[\s\S]*?\.research-answer-explanation \{[\s\S]*?line-height: var\(--reader-line-height\);/, "Research answer prose should share the Reader line-spacing token.");
assert.match(stylesSource, /workspace-panel:not\(\.reader-panel\) \.research-answer-primary,[\s\S]*?workspace-panel:not\(\.reader-panel\) \.research-answer-explanation \{[\s\S]*?color: #ffffff !important;/, "Research answer conclusion and explanation are not rendered at full white contrast.");
assert.match(stylesSource, /workspace-panel:not\(\.reader-panel\) \.research-answer-code-basis \{[\s\S]*?color: var\(--text-secondary\);/, "Research Code basis does not use the secondary text tone.");
assert.match(stylesSource, /\.research-message\.is-user \{[\s\S]*?line-height: var\(--reader-line-height\);/, "Research questions should share the Reader line-spacing token.");
assert.doesNotMatch(stylesSource, /\.research-answer-open-source/, "Removed answer-level Open source button styles should not remain in the client.");
assert.match(clientSource, /function renderResearchStructuredSource\(structuredSource\)[\s\S]*?structuredSource\.grids[\s\S]*?createElement\("table"\)[\s\S]*?cell\?\.rowSpan[\s\S]*?cell\?\.columnSpan/, "Saved structured enacted sources should render their table grid and cell spans instead of flattened passage text.");
assert.match(clientSource, /const structuredSource = renderResearchStructuredSource\(source\.structuredSource\);[\s\S]*?body\.append\(structuredSource\)/, "Research source cards should use the immutable structured source snapshot when it is available.");
assert.match(stylesSource, /\.research-source-structured-table table \{[\s\S]*?min-width: 32rem;[\s\S]*?table-layout: auto;/, "Structured Research tables should remain readable and horizontally scroll within narrow conversation columns.");
assert.match(stylesSource, /\.project-section-motion > \.project-section-motion-body \{[\s\S]*?max-height 420ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/, "Research history cannot inherit the established collapse motion.");
assert.match(clientSource, /conversation\.starterQuestion \|\| summaryQuestion \|\| conversation\.title/, "The standalone conversation column does not retain the original question as its title.");
assert.match(clientSource, /if \(!releaseSurfaceVisibility\.researchHistoryManagement\)/, "Deferred per-chat management controls are not hidden behind the release boundary.");
assert.doesNotMatch(clientSource, /Ask naturally\. Permitext will research/, "The redundant Research start helper sentence is still visible.");
assert.doesNotMatch(clientSource, /Project context \(optional\)/i, "The redundant Project context caption is still visible above the Research selector.");
assert.match(stylesSource, /\.research-composer\.research-start-composer \{[\s\S]*?background: transparent;/, "The Research start composer still renders a tinted outer block.");
assert.doesNotMatch(stylesSource, /\.research-start-composer \.research-composer-box/, "The Research history composer overrides the shared conversation composer surface.");
assert.match(stylesSource, /@media \(prefers-color-scheme: dark\) \{[\s\S]*?\.search-box \{[\s\S]*?background: rgb\(246 244 241 \/ 10%\);/, "The dark Search field does not use the annotated warm-white fill.");
assert.match(stylesSource, /\.reader-internal-search\.search-box \{[\s\S]*?border-radius: var\(--radius-pill\);/, "The Reader search does not use fully rounded ends.");
assert.match(stylesSource, /\.reader-panel:has\(\.reader-internal-search:not\(\[hidden\]\)\) \.reader-reading-progress \{[\s\S]*?display: none;/, "The horizontal Reader progress line remains visible during internal search.");
assert.match(stylesSource, /\.research-conversation-panel \{[\s\S]*?--research-conversation-background: #000000;[\s\S]*?background: var\(--research-conversation-background\);/, "Standalone Research conversations do not use a pure-black surface.");
assert.match(stylesSource, /\.research-message\.is-user \{[\s\S]*?background: rgb\(246 244 241 \/ 10%\);[\s\S]*?opacity: 1;/, "Research user messages do not use the annotated full-opacity warm-white fill.");
assert.doesNotMatch(stylesSource, /\.research-composer-box:has\(\.research-question-input:focus-visible\)/, "Research chat boxes still draw an active focus edge.");
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
assert.deepEqual(
  researchFactUsageDisclosure({
    factsUsed: ["Project fact", "Conversation fact"],
    projectFacts: ["Project fact"],
    conversationFactContext: { established: ["Conversation fact"], hypothetical: [] }
  }),
  {
    schemaVersion: 1,
    projectContext: ["Project fact"],
    conversation: ["Conversation fact"],
    other: []
  },
  "Research fact disclosure does not preserve deterministic source provenance."
);
assert.match(appSource, /projectFactsUsed\.maxItems = 0/, "The evidence-analysis schema does not forbid invented Project facts when no Project facts exist.");
assert.match(appSource, /max_output_tokens: 6_000,/, "The evidence-analysis model can still be cut off before returning its structured legal-research map.");
assert.match(appSource, /max_output_tokens: 2_000,/, "The Research verifier can still be cut off before returning its structured result.");
assert.match(appSource, /maximumResearchVerificationAttempts = 3/, "Research does not preserve two bounded correction opportunities behind the verifier gate.");
assert.match(clientSource, /function wireResearchDetailsMotion\(details, body\)/, "Research disclosures do not share the standard collapsible motion helper.");
assert.match(clientSource, /wireResearchDetailsMotion\(evidenceReviewed, evidenceReviewedBody\)/, "Evidence reviewed does not use the shared disclosure motion.");
assert.match(clientSource, /wireResearchDetailsMotion\(details, detailsBody\)/, "The nested evidence details do not use the shared disclosure motion.");
assert.match(clientSource, /wireResearchDetailsMotion\(details, list\)/, "The sources-used submenu does not use the shared disclosure motion.");
assert.match(stylesSource, /\.research-details-motion > \.research-details-motion-body \{[\s\S]*?max-height 420ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/, "Research disclosures do not match the standard 420ms collapsible transition.");
assert.match(clientSource, /renderResearchSource\(source, \{[\s\S]*?openInReader: true,[\s\S]*?anchorPaneID,[\s\S]*?projectID: conversation\.primaryProjectID \|\| ""/, "Answer source rows do not open directly in a Project-aware source column.");
assert.match(clientSource, /openResearchSourceInSectionDetail\(source, options\.anchorPaneID, options\.projectID\)/, "Answer source rows do not use the Project-aware search-free section-detail path.");
assert.match(clientSource, /openNotebookReference\(project, foundation, reference, selectCard, anchorPaneID, projectID\)[\s\S]*?openResearchSourceInSectionDetail\([\s\S]*?anchorPaneID, projectID\)/, "Notebook reference chips should open the Project-aware source column without creating Search.");
assert.match(clientSource, /function openResearchSourceInSectionDetail\(item, anchorPaneID, projectID = ""\)[\s\S]*?resolveInlineCodeSection\(codePrefix, sectionNumber\)[\s\S]*?newUtilityInstance\("sdc"\)[\s\S]*?openSectionDetail\(detailOwner\.id, searchResultDetail\(navigationItem\), \{ anchorPaneID \}\)/, "Answer sources do not resolve and open the compact detail column beside Research.");
assert.match(clientSource, /detailOwner\.projectID = String\(projectID \|\| ""\)/, "Research source details do not retain their Project theme identity.");
assert.match(stylesSource, /\.section-detail-panel\.project-derived-panel \{[\s\S]*?background: color-mix\(in srgb, var\(--project-color\) 8%, var\(--surface-raised\)\);/, "Project Research source details do not share the conversation background treatment.");
assert.match(stylesSource, /\.research-answer-source-group-items \.research-source-card \+ \.research-source-card \{[\s\S]*?border-top: 0;/, "Answer source rows still render divider lines.");
assert.match(clientSource, /renderSourceGroup\("Cited in this answer", cited, "is-cited"\)/, "Cited answer sources do not have a distinct labeled group.");
assert.match(clientSource, /renderSourceGroup\("Reviewed for context — not cited", reviewed, "is-reviewed"\)/, "Reviewed-only sources do not have a distinct labeled group.");
assert.match(clientSource, /answerQuality\.citedSourceIDs[\s\S]*?answerQuality\.reviewedOnlySourceIDs[\s\S]*?sourceIsReviewedOnly[\s\S]*?sources\.filter\(\(source\) => !sourceIsReviewedOnly\(source\) && sourceIsCited\(source\)\)/, "Answer sources are not split using their saved citation identities.");
assert.match(stylesSource, /\.research-answer-source-group\.is-cited \{[\s\S]*?background: color-mix\(in srgb, var\(--text-primary\) 5%, transparent\);/, "Cited sources do not have a quiet visual grouping distinct from reviewed-only sources.");
assert.match(clientSource, /function researchAnswerSourceCitation\(source\)[\s\S]*?`NYC \$\{year\}`[\s\S]*?\[codePrefix, sectionNumber\][\s\S]*?join\(" \/ "\)/, "Answer-source citations are not reduced to year, code prefix, and section number.");
assert.match(clientSource, /options\.openInReader[\s\S]*?researchAnswerSourceCitation\(source\)/, "Direct-opening answer sources do not use the compact citation format.");
assert.match(stylesSource, /\.research-answer-source-list \.research-source-toggle > strong \{[\s\S]*?font-weight: 400;/, "Answer-source citations remain bold.");
assert.match(clientSource, /sources\.forEach\(\(source, index\) =>[\s\S]*?number\.className = "research-answer-source-number"[\s\S]*?number\.textContent = `\$\{index \+ 1\}\.`/, "Answer source groups are not rendered as numbered lists.");
assert.doesNotMatch(clientSource, /count\.textContent = String\(sources\.length\)/, "Answer source groups still render total-count pills.");
assert.match(stylesSource, /\.research-answer-source-group-items \.research-source-card \{[\s\S]*?grid-template-columns: 1\.5rem minmax\(0, 1fr\);/, "Answer source row numbers do not have a stable list column.");
assert.match(clientSource, /if \(!options\.openInReader\) toggle\.append\(disclosure\)/, "Direct-opening answer sources still render disclosure chevrons.");
assert.match(stylesSource, /\.workspace-tab \{[\s\S]*?font-size: 12px;/, "Workspace tab labels are not 12px.");
assert.match(stylesSource, /\.connection-status \{[\s\S]*?font-size: 12px;/, "Connection status labels are not 12px.");
assert.match(stylesSource, /\.reader-nav-chapter-row \{[\s\S]*?background: transparent;[\s\S]*?color: var\(--text-secondary\);/, "Reader chapter rows retain a persistent highlight instead of highlighting on hover.");
assert.match(stylesSource, /\.reader-notes-research-action \{[\s\S]*?border-radius: var\(--radius-pill\);[\s\S]*?background: color-mix\(in srgb, var\(--code-accent\) 16%, var\(--surface\)\);/, "Add to Research is not rendered as a filled Reader-notes pill.");
assert.match(stylesSource, /\.research-selection-menu \{[\s\S]*?border: 0;/, "The enacted-text Research selection menu still renders a thin edge.");
assert.match(clientSource, /projectPicker\.className = "research-selection-project-picker"[\s\S]*?projectList\.hidden = !willOpen;[\s\S]*?projectTrigger\.setAttribute\("aria-expanded", String\(willOpen\)\)/, "The selection-menu Project picker does not expand inline with its card.");
assert.match(stylesSource, /\.research-selection-menu \.research-selection-project-option \+ \.research-selection-project-option \{[\s\S]*?border-top: 1px solid var\(--border\);/, "The inline Research Project choices are not separated by thin dividers.");
assert.match(clientSource, /analyzeButton\.className = "research-selection-start-action"/, "The Start Research action lacks its scoped visual hook.");
assert.match(clientSource, /const initialProjectID = String\(captured\.projectID \|\| ""\)\.trim\(\);[\s\S]*?value: initialProjectID,[\s\S]*?selectedProjectChoice = projectChoices\.find\(\(choice\) => choice\.value === initialProjectID\)/, "Reader evidence selection still assigns an open Project without an explicit choice.");
assert.match(clientSource, /analyzeButton\.disabled = false;[\s\S]*?A Project is optional\. You can assign this Research conversation later\./, "Unassigned Reader evidence does not expose an enabled Start Research action.");
assert.match(clientSource, /projectID: selection\.projectID \|\| ""/, "Unassigned Reader evidence is not submitted as an unassigned Research conversation.");
assert.match(clientSource, /researchButton\.onclick = \(\) => selectReaderSectionForResearch\(sectionWrapper\)/, "The Reader comment card does not use the shared Research selection flow.");
assert.match(clientSource, /function selectReaderSectionForResearch\(sectionWrapper\)[\s\S]*?showResearchSelectionMenu\(\{ \.\.\.passage, passages: \[passage\], rect \}, \{ pinned: true \}\)/, "Add to Research does not open the same unassigned-capable selection menu as highlighted Reader text.");
assert.match(stylesSource, /\.research-selection-actions \{[\s\S]*?justify-content: center;/, "The Research selection action is not centered.");
assert.match(stylesSource, /\.research-selection-menu \.research-selection-start-action \{[\s\S]*?background: #000;[\s\S]*?color: #fff;[\s\S]*?opacity: 0\.58;/, "The Start Research action does not match its annotated treatment.");
assert.match(clientSource, /panel\.classList\.add\("analysis-panel", "research-list-panel", "has-research-composer"\)/, "The Research history panel does not reserve a fixed composer row.");
assert.match(clientSource, /function renderNewResearchComposer\(container, researchEnabled\)[\s\S]*?input\.rows = 3;[\s\S]*?container\.append\(form\);/, "The Research history composer does not match the conversation composer height or mount directly in the panel.");
assert.match(clientSource, /renderNewResearchComposer\(panel, researchEnabled\)/, "The Research history composer still scrolls inside the history content.");
assert.match(stylesSource, /\.analysis-panel\.has-research-composer > \.research-composer \{[\s\S]*?padding: var\(--space-3\) 0 var\(--panel-padding\);/, "The Research history composer does not share the conversation composer's bottom position.");
assert.match(stylesSource, /\.research-composer \.research-question-input \{[\s\S]*?background: rgb\(246 244 241 \/ 10%\);[\s\S]*?color: #ffffff;/, "Research composer textareas do not share the annotated fill and text color.");
assert.match(indexSource, /id="add-reader"[^>]*data-mobile-label="Reader"/, "The mobile Reader action lacks its compact label.");
assert.match(indexSource, /id="toggle-saved"[^>]*data-mobile-label="Projects"/, "The mobile Projects action lacks its compact label.");
assert.match(indexSource, /id="mobile-more"[\s\S]*?aria-haspopup="dialog"[\s\S]*?data-mobile-label="More"/, "The mobile dock lacks its More action.");
assert.match(stylesSource, /@media \(max-width: 760px\) \{[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);[\s\S]*?#toggle-saved \{ order: 1; \}[\s\S]*?#mobile-more \{ order: 5; \}/, "The mobile dock is not a five-action layout.");
assert.match(stylesSource, /\.topbar #fit-columns,[\s\S]*?\.topbar #collapse-readers,[\s\S]*?display: none !important;/, "Desktop column-layout controls remain visible in the mobile dock.");
assert.match(clientSource, /function openMobileMoreSheet\(\)[\s\S]*?workspace\.name[\s\S]*?"Create workspace"[\s\S]*?"Rename workspace"[\s\S]*?"Settings"/, "The mobile More sheet does not contain workspace switching and management controls.");
assert.match(clientSource, /const preservedTargetOffset = preservedTarget[\s\S]*?menu\.scrollTop \+= nextTargetOffset - preservedTargetOffset;[\s\S]*?focusTarget\?\.focus\(\{ preventScroll: true \}\)/, "Expanding a Reader chapter does not preserve its viewport position.");
assert.match(clientSource, /if \(readerCodeMenu\) \{[\s\S]*?event\.key !== "Escape" \|\| menu\.hidden[\s\S]*?closeMenu\(\);[\s\S]*?trigger\.focus\(\{ preventScroll: true \}\)/, "Escape does not close the Reader code menu and restore trigger focus.");

console.log("permitext research list summary contract passed");
