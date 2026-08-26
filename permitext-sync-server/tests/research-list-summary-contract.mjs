import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  deterministicResearchEvidenceAnalysisForBoundedCitation,
  projectResearchConversationForList,
  researchConversationDisplayTitle,
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

assert.match(
  appSource,
  /catch \(error\) \{[\s\S]*?if \(response\.headersSent\) \{[\s\S]*?if \(!response\.writableEnded\) response\.end\(\);[\s\S]*?return;/,
  "A failure after Research streaming starts must end the response without attempting to write HTTP headers again."
);
assert.match(
  appSource,
  /evidenceLimitations: \{ type: "array", minItems: 1, items: \{ type: "string", minLength: 1 \} \}/,
  "The Research response schema must prevent blank or missing evidence limitations before validation."
);

function functionSource(source, name) {
  const asyncStart = source.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist.`);
  const parametersStart = source.indexOf("(", start);
  let parameterDepth = 0;
  let parametersEnd = -1;
  for (let index = parametersStart; index < source.length; index += 1) {
    if (source[index] === "(") parameterDepth += 1;
    if (source[index] === ")") parameterDepth -= 1;
    if (parameterDepth === 0) {
      parametersEnd = index;
      break;
    }
  }
  const bodyStart = source.indexOf("{", parametersEnd);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not parse ${name}.`);
}

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
assert.equal(projected.title, "List projection conversation", "A manual Research title should remain authoritative.");
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

assert.match(clientSource, /originSurface: selection\.originSurface \|\| "reader"/, "Reader selections do not default their conversation origin to Reader.");
assert.match(clientSource, /originSurface: "evidenceDiscovery"/, "Evidence Discovery selections are not distinguished from Reader origins.");
assert.doesNotMatch(clientSource, /Started from Reader|Started from selected code/, "Reader-origin evidence still renders a redundant origin message.");
assert.match(clientSource, /reference\.textContent = \[prefix, sectionDisplayTitle\(sectionNumber, source\.title, "Selected code passage"\)\]/, "Reader-origin links omit the complete section subtitle.");
assert.match(clientSource, /reference\.addEventListener\("click", \(\) => \{[\s\S]*?openSourceInReader\([\s\S]*?conversation\.primaryProjectID \|\| ""/, "Reader-origin subtitles should open the Project-aware Reader without creating Search.");
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
    { id: "nyc-planning:bbl", key: "bbl", label: "BBL", value: "1017190052", status: "sourced", source: "nyc-planning", sourceText: "NYC Planning MapPLUTO" },
    { id: "project-fact:travel", key: "travel-distance", label: "Travel Distance", value: "95 feet", status: "stated", source: "user" }
  ]
});
assert.deepEqual(structuredProjectInformation.facts, [
  "Building / Code Fact — Occupancy: Group R-2 (user-confirmed; not independently verified)",
  "Building / Code Fact — Stories Above Grade: 6 (user-stated; not independently verified)",
  "Zoning Fact — Address: 214 West 118th Street (user-confirmed; not independently verified)",
  "Zoning Fact — Tax Lot(s): 52, 53, 54, 55 (user-stated; not independently verified)",
  "Zoning Fact — Zoning Lot Composition: Tax Lots 52, 53, 54 and 55 comprise one zoning lot. (user-stated; not independently verified)",
  "Zoning Fact — Zoning District(s): C4-4D, R7-2 (user-stated; not independently verified)",
  "Zoning Fact — Street Frontage(s): Third Avenue — Wide Street; East 120th Street — Narrow Street (user-stated; not independently verified)",
  "Zoning Fact — BBL: 1017190052 (NYC Planning sourced data; verify current official records)",
  "Custom Fact — Travel Distance: 95 feet (user-stated; not independently verified)",
  "Additional Project facts: An existing six-story Group R-2 building of Type IIIA construction."
]);
assert.equal(structuredProjectInformation.structuredFacts.length, 11);
assert.equal(structuredProjectInformation.structuredFacts[0].usedInResearch, true);
assert.equal(structuredProjectInformation.structuredFacts[2].usedInResearch, false);
assert.equal(structuredProjectInformation.facts.some((fact) => fact.includes("Floor affected:")), false);
assert.equal(structuredProjectInformation.buildingCodeFacts.length, 2);
assert.equal(structuredProjectInformation.zoningFacts.length, 6);
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

assert.equal(
  researchConversationDisplayTitle({
    title: "Aug 1, 2026 · 8:00 PM",
    titleSource: "default",
    createdAt: "2026-08-02T00:00:00.000Z",
    starterQuestion: "What was asked first?",
    sources: []
  }),
  "What was asked first?",
  "The first Research question should become the automatic conversation title."
);
assert.equal(
  researchConversationDisplayTitle({
    title: "Aug 1, 2026 · 8:00 PM",
    titleSource: "default",
    createdAt: "2026-08-02T00:00:00.000Z",
    sources: [{
      kind: "selection",
      sectionID: "8881",
      selectedText: "101.4.4 Plumbing. The provisions of the New York City Plumbing Code shall apply."
    }],
    messages: []
  }),
  "101.4.4 Plumbing. The provisions of the New York City Plumbing Code shall apply.",
  "A passage-only Research conversation should use its first selected passage as the title."
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
assert.match(appSource, /refreshGeneratedResearchConversationTitle\(conversation\);[\s\S]*?conversation\.messages\.push/, "The first ordinary Research question does not update the generated title.");
assert.match(clientSource, /title\.textContent = researchConversationTitle\(conversation\);/, "Previous chats do not show the shared Research title.");
assert.match(clientSource, /meta\.textContent = researchConversationDate\(conversation\.createdAt\);/, "Previous chats do not show the conversation creation date.");
assert.match(clientSource, /projectPill\.textContent = conversation\.primaryProjectID[\s\S]*?researchProjectName\(conversation\.primaryProjectID\)[\s\S]*?"Unassigned";/, "Previous chats do not identify their assigned Project or use the shared Unassigned vocabulary.");
assert.match(stylesSource, /\.research-conversation-open \{[\s\S]*?gap: var\(--space-3\);/, "Previous chat questions need visible separation from their metadata.");
assert.match(stylesSource, /\.research-conversation-meta \{[\s\S]*?justify-content: space-between;/, "Previous chat dates and Project pills should share an aligned metadata row.");
assert.match(stylesSource, /\.research-conversation-project-pill \{[\s\S]*?width: fit-content;[\s\S]*?margin-left: auto;/, "Previous chat Project pills should size to their titles and align right.");
assert.match(clientSource, /const researchListScrollTop = track\.querySelector\([\s\S]*?utility:analysis[\s\S]*?analysis-content[\s\S]*?\)\?\.scrollTop \?\? 0;[\s\S]*?refreshedResearchList\.scrollTop = Math\.min/, "Opening a previous chat should preserve the inner Research list scroll position.");
assert.match(stylesSource, /\.research-conversation-open strong \{[\s\S]*?font-weight: 400;[\s\S]*?line-height: 1\.35;/, "Previous chat questions do not use regular weight with readable line spacing.");
assert.match(indexSource, /<p class="eyebrow panel-kind">Research<\/p>[\s\S]*?<h2 class="panel-title">History<\/h2>/, "The Research index is not clearly named History within the Research system.");
assert.match(clientSource, /eyebrow\.textContent = "Research";[\s\S]*?panelTitle\.textContent = researchConversationTitle\(conversation/, "The active conversation does not present the shared Research title.");
assert.match(clientSource, /function researchConversationHistoryGroups\(conversations = \[\], now = new Date\(\)\)/, "Research history has no deterministic time-grouping helper.");
assert.match(clientSource, /ageInDays < 7[\s\S]*?"7 days"[\s\S]*?ageInDays < 14[\s\S]*?"Previous 7 days"[\s\S]*?ageInDays < 30[\s\S]*?"Previous 30 days"/, "Research history does not use the expected recent weekly buckets.");
assert.match(stylesSource, /\.research-history-group-label \{[\s\S]*?font-size: 14px !important;[\s\S]*?font-weight: 400;/, "Research history group headings should use 14px regular text.");
assert.doesNotMatch(clientSource, /research-history-group-count|const groupCount =/, "Research history group headings should not display conversation counters.");
const newResearchComposerStart = clientSource.indexOf("function renderNewResearchComposer(");
const newResearchComposerEnd = clientSource.indexOf("\nasync function renderResearch(", newResearchComposerStart);
const newResearchComposerSource = clientSource.slice(newResearchComposerStart, newResearchComposerEnd);
assert.ok(newResearchComposerStart >= 0 && newResearchComposerEnd > newResearchComposerStart, "New Research composer source was not found.");
assert.match(newResearchComposerSource, /let initialProjectID = preferredResearchProjectID\(\)[\s\S]*?projectID: initialProjectID/, "New Research does not inherit the active Project context.");
assert.match(newResearchComposerSource, /projectLabel\.textContent = "Project context"[\s\S]*?createResearchProjectSelect\([\s\S]*?initialProjectID = projectSelect\.value/, "New Research does not expose a correctable Project context before the first send.");
const researchProjectChoicesSource = functionSource(clientSource, "researchProjectChoices");
assert.match(researchProjectChoicesSource, /activeProjectRecords\(currentContentSummary\(\)\.projects \|\| \[\]\)/, "Research Project controls must include only true Projects.");
assert.doesNotMatch(researchProjectChoicesSource, /category: "reference"/, "Saved collections must not appear as Research Project context.");
assert.match(clientSource, /if \(citation\.sectionID \|\| citation\.sectionNumber\)[\s\S]*?openSourceInReader\(citation/, "A citation with canonical section identity must open Reader even before exact saved sources are hydrated.");
assert.doesNotMatch(newResearchComposerSource, /section\.append\(renderResearchProgressCard\(progress\)\)/, "The new Research composer still targets a removed progress container.");
assert.doesNotMatch(newResearchComposerSource, /What would you like to research\?|createElement\("h3"\)/, "The new Research composer should begin directly with the chat box.");
assert.match(clientSource, /monthFormatter\.format\(created\)[\s\S]*?`year-\$\{created\.getFullYear\(\)\}`/, "Older Research history is not grouped by calendar month and year.");
assert.match(clientSource, /researchConversationHistoryGroups\(researchConversationList\)\.forEach\(\(historyGroup\)/, "Previous chats are not rendered through the time groups.");
assert.doesNotMatch(clientSource, /research-conversation-list-heading|listHeading\.textContent = "Previous chats"/, "The redundant Previous chats heading should remain removed.");
assert.doesNotMatch(stylesSource, /\.research-conversation-list-heading/, "Removed Research history heading styles should not remain in the release surface.");
assert.match(stylesSource, /\.analysis-panel\.has-research-composer > \.analysis-content \{[\s\S]*?width: calc\(100% \+ \(2 \* var\(--panel-padding\)\)\);[\s\S]*?margin-inline: calc\(-1 \* var\(--panel-padding\)\);[\s\S]*?overflow-x: hidden;/, "The Research history scroller must span the column without horizontal overflow.");
assert.match(stylesSource, /\.research-list-panel \.research-conversation-list \{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;[\s\S]*?margin-inline: 0;/, "Research history highlights and dividers must remain within the full-width scroller.");
assert.match(stylesSource, /\.research-conversation-open \{[\s\S]*?padding: var\(--space-4\) var\(--panel-padding\);/, "Full-width Research rows must retain the established inner text gutter.");
assert.match(stylesSource, /\.saved-folder-context\.is-project \.saved-project-evidence-body \.saved-code-group \.saved-row \{[\s\S]*?width: calc\(100% \+ \(2 \* var\(--space-3\)\)\);[\s\S]*?margin-inline: calc\(-1 \* var\(--space-3\)\);[\s\S]*?padding-inline: var\(--space-3\);/, "Project and Unassigned Saved Evidence dividers must span their card while row content retains its gutter.");
assert.match(clientSource, /researchHistoryGroupExpansion[\s\S]*?wireProjectSectionMotion\([\s\S]*?onChange: \(expanded\)/, "Research history group expansion is not persisted through the standard motion control.");
assert.match(stylesSource, /\.research-history-group-body \{[\s\S]*?display: grid;/, "Research history groups have no collapsible body layout.");
assert.match(stylesSource, /\.research-conversation-header-project \{[\s\S]*?appearance: none;[\s\S]*?-webkit-appearance: none;[\s\S]*?background: color-mix\(in srgb, var\(--project-color, var\(--text-tertiary\)\) 42%, var\(--surface\)\);[\s\S]*?background-image: none;/, "The conversation Project pill should hide the native chevron and use its Project card color.");
assert.match(clientSource, /const researchProjectMenu = select\.classList\.contains\("research-conversation-header-project"\)[\s\S]*?research-project-select-menu[\s\S]*?research-project-custom-select/, "The Research Project control should use the shared custom picker instead of the browser-native menu.");
assert.match(clientSource, /actions\.prepend\(projectSelect\);\s*enhanceSelect\(projectSelect\);/, "The conversation header should enhance its Project select after mounting it.");
assert.match(stylesSource, /\.research-project-select-menu \{[\s\S]*?border-radius: clamp\(22px, 4vw, 30px\);/, "The Research Project menu should use the Reader picker's rounded popover surface.");
assert.match(clientSource, /panel\?\.classList\.contains\("reader-panel"\) \|\| researchProjectMenu[\s\S]*?menuHorizontalPadding[\s\S]*?range\.selectNodeContents\(item\)/, "The Research Project menu should fit its longest label while respecting the conversation panel inset.");
assert.match(stylesSource, /\.research-project-custom-select \{[\s\S]*?width: max-content;[\s\S]*?max-width: min\(260px, 48vw\);[\s\S]*?\.research-project-custom-select \.custom-select-trigger \{[\s\S]*?width: max-content;[\s\S]*?text-align: right;/, "The Research Project pill should keep its right edge anchored while growing left to fit its label.");
assert.match(stylesSource, /\.research-conversation-panel > \.panel-header,[\s\S]*?\.research-conversation-panel > \.panel-header \.panel-actions,[\s\S]*?\.research-conversation-panel > \.panel-header > div:first-child \{[\s\S]*?align-items: center;[\s\S]*?\.research-conversation-panel > \.panel-header > div:first-child \{[\s\S]*?display: flex;[\s\S]*?min-height: 28px;/, "The Research Conversation title, Project selector, and close control should share one vertical centerline.");
assert.match(stylesSource, /workspace-panel:not\(\.reader-panel\) \.research-evidence-reviewed > summary \{[\s\S]*?font-size: 14px !important;/, "Evidence reviewed should remain legible at the requested 14px component size.");
assert.match(stylesSource, /\.research-answer-paragraph:first-child \{[\s\S]*?font-weight: 400;/, "The first Research paragraph should use conversational body weight instead of automatic bold emphasis.");
assert.match(stylesSource, /workspace-panel:not\(\.reader-panel\) \.research-answer-code-basis \{[\s\S]*?font-size: 14px !important;/, "The Research Code basis disclosure should remain legible at 14px.");
assert.match(stylesSource, /\.research-answer-paragraph,[\s\S]*?\.research-answer-list \{[\s\S]*?line-height: var\(--reader-line-height\);/, "Research answer prose should share the Reader line-spacing token.");
assert.match(stylesSource, /workspace-panel:not\(\.reader-panel\) \.research-answer-paragraph,[\s\S]*?workspace-panel:not\(\.reader-panel\) \.research-answer-list \{[\s\S]*?color: #ffffff !important;/, "Adaptive Research answer prose is not rendered at full white contrast.");
assert.match(stylesSource, /workspace-panel:not\(\.reader-panel\) \.research-answer-code-basis \{[\s\S]*?color: var\(--text-secondary\);/, "Research Code basis does not use the secondary text tone.");
assert.match(stylesSource, /\.research-message\.is-user \{[\s\S]*?line-height: var\(--reader-line-height\);/, "Research questions should share the Reader line-spacing token.");
assert.doesNotMatch(stylesSource, /\.research-answer-open-source/, "Removed answer-level Open source button styles should not remain in the client.");
assert.match(clientSource, /function renderResearchStructuredSource\(structuredSource\)[\s\S]*?structuredSource\.grids[\s\S]*?createElement\("table"\)[\s\S]*?cell\?\.rowSpan[\s\S]*?cell\?\.columnSpan/, "Saved structured enacted sources should render their table grid and cell spans instead of flattened passage text.");
assert.match(clientSource, /const structuredSource = renderResearchStructuredSource\(source\.structuredSource\);[\s\S]*?body\.append\(structuredSource\)/, "Research source cards should use the immutable structured source snapshot when it is available.");
assert.match(stylesSource, /\.research-source-structured-table table \{[\s\S]*?min-width: 32rem;[\s\S]*?table-layout: auto;/, "Structured Research tables should remain readable and horizontally scroll within narrow conversation columns.");
assert.match(stylesSource, /\.project-section-motion > \.project-section-motion-body \{[\s\S]*?max-height 420ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/, "Research history cannot inherit the established collapse motion.");
assert.match(clientSource, /panelTitle\.textContent = researchConversationTitle\(conversation, researchConversationTitle\(summaryConversation\)\)/, "The standalone conversation column does not use the shared Research title.");
assert.match(clientSource, /if \(!releaseSurfaceVisibility\.researchHistoryManagement\)/, "Deferred per-chat management controls are not hidden behind the release boundary.");
assert.doesNotMatch(clientSource, /Ask naturally\. Permitext will research/, "The redundant Research start helper sentence is still visible.");
assert.doesNotMatch(clientSource, /Project context \(optional\)/i, "The redundant Project context caption is still visible above the Research selector.");
assert.match(stylesSource, /\.research-composer\.research-start-composer \{[\s\S]*?background: transparent;/, "The Research start composer still renders a tinted outer block.");
assert.doesNotMatch(stylesSource, /\.research-start-composer \.research-composer-box/, "The Research history composer overrides the shared conversation composer surface.");
assert.match(stylesSource, /@media \(prefers-color-scheme: dark\) \{[\s\S]*?\.search-box \{[\s\S]*?background: rgb\(246 244 241 \/ 10%\);/, "The dark Search field does not use the annotated warm-white fill.");
assert.match(stylesSource, /\.reader-internal-search\.search-box \{[\s\S]*?border-radius: var\(--radius-pill\);/, "The Reader search does not use fully rounded ends.");
assert.doesNotMatch(stylesSource, /\.reader-reading-progress/, "The removed horizontal Reader progress line returned.");
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
  /Saved Research answers and professional analysis records will remain/,
  "Research history clearing does not disclose the preserved evidence boundary."
);
assert.match(
  stylesSource,
  /\.research-history-select-button/,
  "Research history selection control has no dedicated header styling."
);
assert.match(stylesSource, /\.research-conversation-row\.is-selected \{[\s\S]*?background:/, "Selected Research rows do not visibly change color.");
assert.match(stylesSource, /\.research-history-select-button,[\s\S]*?\.research-history-delete-button \{[\s\S]*?border: 0;[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/, "The Research selection and delete icons do not match Permitext's bare column-header controls.");
assert.match(clientSource, /deleteSelectedButton\.className = "icon-button research-history-delete-button"[\s\S]*?deleteSelectedButton\.innerHTML = trashIconSVG\(\)/, "Research selection mode is missing its dedicated delete icon.");
assert.match(clientSource, /panelActions\?\.prepend\(cancelSelectionButton, selectAllButton, deleteSelectedButton, selectHistoryButton\)/, "Research selection-mode actions are not ordered Cancel, Clear all, Delete.");
assert.match(clientSource, /deleteSelectedButton\.hidden = !selectingConversations;[\s\S]*?selectHistoryButton\.hidden = selectingConversations/, "The checkmark remains visible instead of yielding to Delete during selection mode.");
assert.match(clientSource, /deleteSelectedButton\.addEventListener\("click", async \(\) => \{[\s\S]*?clearResearchConversationHistory\(deleteSelectedButton, selectedConversations, \{[\s\S]*?rows: selectedConversations\.map/, "The dedicated delete icon does not remove the selected conversation rows in place.");
assert.match(clientSource, /async function animateResearchConversationRows\(rows\)[\s\S]*?height: "0px"[\s\S]*?duration: 240[\s\S]*?connectedRows\.forEach\(\(row\) => row\.remove\(\)\)/, "Research history deletion must collapse and fade selected rows before removing them.");
assert.match(clientSource, /await Promise\.all\(\[[\s\S]*?\/research\/conversations\/clear-history[\s\S]*?removalAnimation[\s\S]*?if \(typeof options\.onCleared === "function"\) options\.onCleared\(\);/, "Research history deletion must settle the server mutation and local row motion without rebuilding the column.");
assert.match(stylesSource, /\.research-history-select-button\[hidden\],[\s\S]*?\.research-history-delete-button\[hidden\] \{[\s\S]*?display: none;/, "Hidden Research selection actions are still exposed by the shared icon-button display rule.");
assert.match(stylesSource, /\.research-list-panel\.is-research-history-selecting \.utility-close,[\s\S]*?\.research-list-panel\.is-research-history-selecting \.pane-drag-handle \{[\s\S]*?display: none;/, "Research selection mode still exposes the close or drag controls.");
assert.match(appSource, /requestedConversationIDs[\s\S]*?allConversations\.filter\(\(conversation\) => requestedConversationIDs\.has\(conversation\.id\)\)/, "The server does not scope Research history removal to the selected IDs.");
assert.match(appSource, /conversation\?\.primaryProjectID[\s\S]*historyHiddenAt/, "Project conversations are not preserved when history is cleared.");
assert.match(appSource, /filter\(\(conversation\) => !conversation\.historyHiddenAt\)/, "Hidden Project conversations still appear in the main history.");
assert.doesNotMatch(clientSource, /className = "ghost-button research-back-button"/, "The redundant Research Back control should remain removed.");
assert.doesNotMatch(clientSource, /className = "ghost-button research-new-chat-button"/, "The redundant Research New chat control should remain removed.");
assert.match(clientSource, /function bindResearchSendShortcut[\s\S]*?event\.key !== "Enter" \|\| event\.shiftKey \|\| event\.isComposing[\s\S]*?form\.requestSubmit\(\)/, "Enter should start a Research conversation while Shift+Enter remains available for a line break.");
assert.match(clientSource, /function appendProjectResearchHistory[\s\S]*?filter\(\(conversation\) => String\(conversation\.title \|\| conversation\.starterQuestion \|\| ""\)\.trim\(\)\)[\s\S]*?question\.textContent = researchConversationTitle\(conversation\);/, "Project Research history does not include passage-titled conversations.");
assert.doesNotMatch(clientSource, /renderResearchAnswerSave|Save to Project|research-answer-save/, "Per-answer Project saving must remain removed from Research conversations.");
assert.match(clientSource, /unassignedLabel: "Unassigned"[\s\S]*?assignResearchConversationProject\(conversation, targetProjectID/, "The conversation header does not use the shared Unassigned state or auto-assign the full conversation to a Project.");
assert.match(clientSource, /: "Not assigned to a Project";/, "Unassigned Research controls must retain an explanatory tooltip.");
assert.match(appSource, /const requiresContextReview = Boolean\(currentProjectID\);/, "A first-time Project assignment should not require a move confirmation.");
assert.match(clientSource, /`Move this conversation to \$\{targetProjectName\}\?`[\s\S]*?The entire conversation will move from \$\{currentProjectName\} to \$\{targetProjectName\}[\s\S]*?Its existing answers and citations will not change[\s\S]*?Future questions will use the current Project facts from \$\{targetProjectName\}/, "The Project-move warning should explain what moves, what stays unchanged, and which visible Project facts future questions use.");
assert.match(clientSource, /confirmLabel: targetProjectID \? "Move conversation" : "Remove from Project"/, "The Project-move warning should use explicit action labels.");
assert.match(appSource, /conversation\.projectContextReviewRequired = false;/, "A confirmed move should use the destination Project's visible facts without a second hidden review gate.");
assert.match(clientSource, /function appendSavedProjectResearchConversations[\s\S]*?filter\(\(conversation\) => String\(conversation\.title \|\| conversation\.starterQuestion \|\| ""\)\.trim\(\)\)[\s\S]*?question\.textContent = researchConversationTitle\(conversation\)[\s\S]*?openResearchConversation\(conversation\.id\)/, "The Project folder does not open assigned conversations by their shared title.");
assert.doesNotMatch(clientSource, /if \(state\.utilities\.analysis && researchConversationPaneIsOpen\(\)\) \{[\s\S]*?openSupplementalResearchConversation\(conversation\.id\)/, "Ordinary Project Research navigation should reuse the single active Research pair.");
assert.match(clientSource, /function openResearchConversationPaneIDs\(\)[\s\S]*?supplementalResearchConversationIDs\.map[\s\S]*?for \(const conversationID of supplementalResearchConversationIDs\)[\s\S]*?renderResearchConversation\(conversationID, \{ supplemental: true \}\)/, "Supplemental Project conversations are not represented as independent active panes.");
assert.match(clientSource, /Cited \$\{citedProvisionCount\} enacted/, "Research answers do not distinguish cited provisions from reviewed evidence.");
assert.match(clientSource, /additional \$\{reviewedOnlyProvisionCount/, "Research answers do not disclose additional provisions reviewed.");
assert.match(clientSource, /citation\.evidenceRole === "supporting"/, "Supporting citations are not visibly classified.");
assert.match(appSource, /"unnecessary_qualification"/, "The verifier cannot classify unjustified caution.");
assert.match(appSource, /"repeated_established_fact"/, "The verifier cannot classify requests to reconfirm established facts.");
assert.match(appSource, /Fail with unnecessary_qualification/, "The verifier is not instructed to reject unjustified caution.");
assert.match(appSource, /Fail with repeated_established_fact/, "The verifier is not instructed to reject repeated fact requests.");
assert.match(appSource, /If the value complies with a stricter baseline limit/, "The answer model is not instructed to preserve the strongest numeric-table conclusion.");
assert.match(appSource, /same supplied table row places the user's stated category beside a materially different conditional category/, "The answer model can omit a material adjacent table category that explains the result.");
assert.match(appSource, /table answer omits a materially different conditional category supplied beside the user's category/, "The verifier cannot catch misleading omissions from the applicable table row.");
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
const boundedCitationAnalysis = deterministicResearchEvidenceAnalysisForBoundedCitation([
  {
    sourceID: "bc-101-1",
    sectionID: "101",
    codePrefix: "BC",
    sectionNumber: "101.1",
    origin: "permitext_discovered",
    sourceType: "enacted_text",
    authorityClass: "enacted",
    applicabilityStatus: "current-enacted-edition",
    evidencePriority: { evidenceRole: "governing", topicRouteRelationship: "exact_topic" },
    canonicalContextResolved: true,
    canonicalContextComplete: true,
    truncated: false
  }
], [{ code: "BOUNDED", text: "Only the cited enacted section was included." }]);
assert.deepEqual(boundedCitationAnalysis.controllingProvisions, [{
  label: "BC 101.1",
  summary: "The user requested this enacted provision by exact citation.",
  sourceIDs: ["bc-101-1"]
}]);
assert.deepEqual(boundedCitationAnalysis.unresolvedProjectFacts, []);
assert.deepEqual(boundedCitationAnalysis.highValueFollowUpQuestions, []);
assert.deepEqual(boundedCitationAnalysis.evidenceLimitations, ["Only the cited enacted section was included."]);
assert.doesNotThrow(
  () => validateResearchEvidenceAnalysis(boundedCitationAnalysis, [{
    sourceID: "bc-101-1",
    origin: "permitext_discovered"
  }], []),
  "The deterministic bounded-citation analysis must satisfy the same evidence-binding contract as model analysis."
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
assert.match(appSource, /max_output_tokens: 4_000,/, "The Research verifier can still be cut off before returning its structured result.");
assert.match(appSource, /timeoutMilliseconds: 45_000,[\s\S]*?failureMessage: "The Research verifier request failed\."/, "The Research verifier timeout is too short for a complex evidence package.");
assert.match(appSource, /maximumResearchVerificationAttempts = 3/, "Research does not preserve two bounded correction opportunities behind the verifier gate.");
assert.match(clientSource, /function wireResearchDetailsMotion\(details, body\)/, "Research disclosures do not share the standard collapsible motion helper.");
assert.match(clientSource, /wireResearchDetailsMotion\(evidenceReviewed, evidenceReviewedBody\)/, "Evidence reviewed does not use the shared disclosure motion.");
assert.match(clientSource, /wireResearchDetailsMotion\(details, detailsBody\)/, "The nested evidence details do not use the shared disclosure motion.");
assert.match(clientSource, /wireResearchDetailsMotion\(details, list\)/, "The sources-used submenu does not use the shared disclosure motion.");
assert.match(stylesSource, /\.research-details-motion > \.research-details-motion-body \{[\s\S]*?max-height 420ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/, "Research disclosures do not match the standard 420ms collapsible transition.");
assert.match(clientSource, /renderResearchSource\(source, \{[\s\S]*?openInReader: true,[\s\S]*?anchorPaneID,[\s\S]*?projectID: conversation\.primaryProjectID \|\| ""/, "Answer source rows do not open directly in a Project-aware Reader.");
assert.match(clientSource, /openSourceInReader\(source, options\.anchorPaneID, \{ projectID: options\.projectID \}\)/, "Answer source rows do not use the Project-aware search-free Reader path.");
assert.match(clientSource, /const exactSource = answerSources\.find[\s\S]*?openSourceInReader\(exactSource, options\.anchorPaneID \|\| "", \{[\s\S]*?projectID: options\.conversation\?\.primaryProjectID/, "Top citation chips do not open their exact Project-aware Reader source.");
assert.match(clientSource, /openNotebookReference\(project, foundation, reference, selectCard, anchorPaneID, projectID\)[\s\S]*?openSourceInReader\([\s\S]*?anchorPaneID, \{ projectID/, "Notebook reference chips should open the Project-aware Reader without creating Search.");
assert.match(clientSource, /async function openSourceInReader\(item, anchorPaneID = "", options = \{\}\)[\s\S]*?resolveInlineCodeSection\(codePrefix, sectionNumber\)[\s\S]*?readerMatchesSource\(candidate, detail\)[\s\S]*?placePaneAfter\(anchorPaneID, paneID\)[\s\S]*?revealReaderSourceTarget\(reader, navigationItem, options\.evidenceAnchor\)/, "Answer sources do not resolve, reuse, and highlight an adjacent Reader.");
assert.match(clientSource, /function researchCodeEdition\(source = \{\}\)[\s\S]*?codePrefix === "BC68"[\s\S]*?source\.codeVersion[\s\S]*?return "Current";/, "Notebook evidence does not derive the enacted source edition from the selected code family and version.");
assert.doesNotMatch(clientSource, /bindResearchTextSelection|showResearchSelectionMenu|research-selection-menu|Link to Note|notebookEvidenceLinksFromSelection/, "The retired Reader selection card or direct-to-Note workflow is still reachable.");
assert.doesNotMatch(stylesSource, /\.research-selection-(?:menu|actions|project|note|relationship|evidence)/, "Retired Reader selection-card styling is still shipped.");
assert.match(functionSource(clientSource, "renderInlineCommentBox"), /wrapper\.append\(bookmarkButton, researchButton\);/, "Reader passages must expose exactly the direct Save and Research actions.");
assert.doesNotMatch(functionSource(clientSource, "renderInlineCommentBox"), /noteButton|commentButton|Link to Note|showResearchSelectionMenu/, "Reader passage actions still expose a retired comment or Note action.");
assert.match(clientSource, /function notebookEvidenceMatchIndex\(text, selector\)[\s\S]*?if \(scored\.length > 1 && scored\[0\]\.score === scored\[1\]\.score\) return -1;/, "Passage reopening does not fail closed when exact-text recovery is ambiguous.");
assert.match(clientSource, /The linked passage could not be relocated safely\. The enacted section is shown without a passage highlight\./, "Passage reopening does not disclose when a safe exact match cannot be recovered.");
assert.match(clientSource, /const applyReportStatus = \(reportBlock\) => \{[\s\S]*?reportButton\.textContent = reportBlock \? "Update in Report" : "Add to Report"[\s\S]*?promoteNotebookCardToReport\(identity, activeCard\)/, "Notebook Notes do not expose explicit Report add and update states.");
assert.match(clientSource, /headingTitle\.textContent = "Notebook"[\s\S]*?projectOwnership\.textContent = `Project: \$\{identity\.name\}`[\s\S]*?heading\.append\(headingTitle, projectOwnership\)/, "Notebook does not render its title and owning Project.");
assert.doesNotMatch(clientSource, /Professional analysis/, "Notebook still repeats Project context beneath its title.");
assert.match(clientSource, /newButton\.title = "New Note"[\s\S]*?<span>New Note<\/span>[\s\S]*?welcomeTitle\.textContent = "Write your professional analysis"[\s\S]*?welcomeAction\.textContent = "Create first Note"/, "Notebook does not present Notes as its primary authored object.");
assert.doesNotMatch(clientSource, /notebook-authorship|Work in any order/, "An active Notebook Note still presents persistent workflow instructions above the writing surface.");
assert.match(clientSource, /referenceLabel\.textContent = "Insert evidence or Research"[\s\S]*?"Research answers"[\s\S]*?"Other Notes"/, "Notebook does not offer a clearly grouped insertion path for evidence and optional Research answers.");
assert.match(functionSource(clientSource, "notebookCanonicalReferenceLabel"), /label: \[notebookReferenceCodeTitle\(codePrefix\), citation, provisionTitle\]\.filter\(Boolean\)\.join\(" · "\)/, "Direct Reader evidence does not use the full code title in Notebook references.");
assert.match(clientSource, /const canonicalGroups = new Map\(\)[\s\S]*?notebook-reference-code-group[\s\S]*?notebook-reference-chapter-group[\s\S]*?`Chapter \$\{chapterNumber\}`/, "Notebook evidence choices are not grouped by code and chapter.");
assert.match(clientSource, /const applyReportStatus = \(reportBlock\) => \{[\s\S]*?reportStatus\.textContent = reportBlock \? "Report status: Added" : "Report status: Not added"[\s\S]*?promoteNotebookCardToReport\(identity, activeCard\)[\s\S]*?reportStatus\.textContent = "Report status: Added"/, "Notebook does not expose and update the Note's Report status.");
assert.match(clientSource, /function promoteNotebookCardToReport\(project, card\)[\s\S]*?existingBlockIndex[\s\S]*?id: existingBlock\?\.id \|\| crypto\.randomUUID\(\)[\s\S]*?kind: "paragraph"[\s\S]*?text: String\(card\.plainText \|\| ""\)\.trim\(\)[\s\S]*?derivedFrom:[\s\S]*?kind: "notebookCard"[\s\S]*?sourceSnapshotAt:[\s\S]*?evidenceLinks: structuredClone\(card\.evidenceLinks \|\| \[\]\)[\s\S]*?draft\.blocks\[existingBlockIndex\] = promotedBlock/, "Report promotion does not upsert an independent editable snapshot with stable Note provenance.");
assert.match(clientSource, /headingTitle\.textContent = "Report"[\s\S]*?projectOwnership\.textContent = `Project: \$\{identity\.name\}`[\s\S]*?heading\.append\(headingTitle, projectOwnership\)[\s\S]*?save\.textContent = "Save Report"[\s\S]*?generate\.textContent = "Export Report"/, "Report does not present its title, owning Project, and ordinary save and export actions.");
assert.doesNotMatch(clientSource, /Professional document/, "Report still repeats Project context beneath its title.");
assert.match(clientSource, /async function activateProjectStudio[\s\S]*?confirmNotebookDiscard\(current\)[\s\S]*?confirmReportDraftDiscard\(current\)[\s\S]*?replaceCurrentProjectOwner[\s\S]*?remapProjectPane\(paneIDForProjectNotebook\(current\), paneIDForProjectNotebook\(identity\)\)[\s\S]*?state\.notebooks = options\.openNotebook[\s\S]*?state\.reportDrafts = options\.openReportDraft/, "Project switching does not transfer open Notebook and Report panes to the newly selected Project.");
assert.doesNotMatch(clientSource, /save\.textContent = activeDraft\.id \? "Save revision" : "Save draft"|Generate Report PDF|Save this draft before opening/, "Report still exposes internal Draft terminology in ordinary editor actions.");
assert.match(clientSource, /reportDraftButton\.title = projectHasOpenReportDraft\(identity\) \? "Close Report" : "Open Report"[\s\S]*?reportDraftButton\.title = "Open Report"[\s\S]*?reportDraftButton\.title = "Close Report"/, "The Project Report entry point does not identify its open and close actions.");
assert.match(clientSource, /sourceProjectID: String\(options\.projectID \|\| ""\)/, "Research source Readers do not retain their Project context identity.");
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
assert.match(clientSource, /projectID: selection\.projectID \|\| ""/, "Unassigned Reader evidence is not submitted as an unassigned Research conversation.");
assert.match(clientSource, /function readerSectionResearchSelection\(sectionWrapper\)[\s\S]*?selectedOpenProjectID\(\)[\s\S]*?passages: \[passage\],[\s\S]*?projectID/, "Reader passage Research does not preserve the passage and active Project context.");
assert.match(clientSource, /currentResearchConversationLabel\(\)[\s\S]*?researchActionLabel[\s\S]*?researchActionIconSVG\(\)[\s\S]*?addToCurrent: Boolean\(currentResearchLabel\)/, "The single Reader Research action does not adapt to the current Research destination.");
assert.doesNotMatch(clientSource, /newResearchButton|inline-new-research-toggle|Start new Research with this passage|createNew: true/, "The Reader still exposes a duplicate new-Research icon.");
assert.match(clientSource, /function researchActionIconSVG\(\)[\s\S]*?M12\.983 21\.186a1 1 0 0 1-1\.966 0/, "The Reader Research action does not use Lucide's Astroid icon.");
assert.doesNotMatch(clientSource, /className = "inline-comment-toggle"|Link passage to Note|openReaderPassageNoteLinker/, "The removed Reader comment-card action is still exposed.");
assert.doesNotMatch(clientSource, /wrapper\.tabIndex = 0|Passage actions for|is-actions-active/, "Reader paragraph text is still exposed as a clickable or keyboard-activated action target.");
assert.doesNotMatch(stylesSource, /\.annotated-code-block[^\{]*\{[^}]*cursor: pointer;|\.annotated-code-block\.is-actions-active/, "Reader paragraph styling still implies clickability.");
assert.match(stylesSource, /\.annotated-code-block\.is-source-target,[\s\S]*?\.chapter-section\.is-source-target \{[\s\S]*?background: transparent;[\s\S]*?\.annotated-code-block\.is-source-target :where\([\s\S]*?color: var\(--reader-notes-active-text\) !important;/, "Linked Reader destinations must use text color instead of a section-wide highlight.");
assert.match(stylesSource, /\.annotated-code-block \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*?align-items: end;/, "Reader action icons must reserve a bottom-aligned column beside their passage.");
assert.match(stylesSource, /\.inline-comment \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 1;[\s\S]*?margin-bottom: var\(--space-4\);/, "Reader action icons must align with the passage content instead of its trailing margin.");
assert.match(stylesSource, /\.inline-comment \{[\s\S]*?display: flex;[\s\S]*?min-height: 30px;[\s\S]*?opacity: 0;[\s\S]*?pointer-events: none;/, "Reader passages must reserve a stable hidden action rail.");
assert.match(stylesSource, /\.annotated-code-block:hover > \.inline-comment,[\s\S]*?\.annotated-code-block:focus-within > \.inline-comment \{[\s\S]*?opacity: 1;[\s\S]*?pointer-events: auto;/, "Reader passage icons must reveal on pointer hover and keyboard focus.");
assert.match(stylesSource, /\.inline-bookmark-toggle,[\s\S]*?\.inline-research-toggle \{[\s\S]*?width: 28px;[\s\S]*?height: 28px;[\s\S]*?border-radius: 1000px;/, "Reader Save and Research actions must be icon-only circular pills.");
assert.match(clientSource, /researchButton\.addEventListener\("click", async \(\) => \{[\s\S]*?startFocusedResearchFromSavedItem\(item, options\.researchProjectID \|\| ""\)/, "Saved Evidence Research must start its direct focused workflow.");
assert.doesNotMatch(clientSource, /async function runSavedItemReaderAction/, "Saved Evidence Research must not bridge through a temporary Reader.");
assert.match(clientSource, /async function startFocusedResearchFromSavedItem\(item, projectID = ""\)[\s\S]*?return startNewResearchFromSelection\(\{[\s\S]*?originPaneID: primarySavedPaneID\(\),[\s\S]*?originSurface: "saved"/, "Saved Evidence Research must use the direct Research workflow without replacing existing workspace columns.");
assert.match(clientSource, /function unassignedSavedEvidenceKeys\(savedItems, projectSections, projects = \[\]\)[\s\S]*?projectRecords = activeFolderRecords\(projects \|\| \[\]\)[\s\S]*?!linkedSectionIDs\.has\(sectionID\)/, "Unassigned Saved must exclude evidence assigned to a Project or saved collection.");
assert.doesNotMatch(clientSource, /heading\.textContent = showingArchived \? "Archived saved collections" : "Saved collections"/, "The Projects menu must not expose the retired saved-collections grouping.");
assert.match(stylesSource, /\.saved-project-tile\.is-unassigned-saved \{[\s\S]*?grid-column: 1 \/ -1;/, "The Unassigned Saved card must span the full Projects grid width.");
assert.match(stylesSource, /\.saved-projects-actions \.saved-projects-selection-cancel \{[\s\S]*?width: auto;[\s\S]*?padding-inline: var\(--space-1\);/, "The Projects selection Cancel label must reserve its text width beside the action icons.");
assert.match(clientSource, /function animateSavedRowRemoval\(row\)[\s\S]*?height: "0px"[\s\S]*?duration: 220[\s\S]*?row\.remove\(\);/, "Saved evidence removal must collapse the row smoothly before removing it from the DOM.");
assert.match(clientSource, /removeItemButton\.addEventListener\("click", async \(\) => \{[\s\S]*?animateSavedItemRemoval\(row\)[\s\S]*?refreshSavedPanes: false,[\s\S]*?refreshProjectPanes: false[\s\S]*?onSavedItemRemoved\(item\)/, "Single saved-item removal must animate locally before hydrating the settled evidence list.");
assert.doesNotMatch(functionSource(clientSource, "createSavedBulkSelectionController"), /renderWorkspace\(/, "Bulk evidence deletion must not rebuild dirty Notebook or Report editors.");
assert.match(functionSource(clientSource, "createSavedBulkSelectionController"), /refreshOpenSavedPanes\(\)[\s\S]*?refreshVisibleSyncedDerivedState\(\)/, "Bulk evidence deletion must refresh Saved and visible bookmark controls in place.");
assert.match(clientSource, /unlinkEvidenceFromFolder\([\s\S]*?\{ refreshPanes: false \}[\s\S]*?await refreshOpenSavedPanes\(\)/, "Bulk Project evidence deletion must batch membership updates before one visible refresh.");
assert.match(clientSource, /state\.localSavedItems = \[[\s\S]*?saveWorkspaceState\(\);[\s\S]*?if \(!saved\) \{[\s\S]*?syncReaderNoteBookmarkButtons\(sectionPayload\.sectionID, false, sectionPayload\.codeVersion\);/, "Deleting saved evidence must immediately reset matching bookmark controls in every open Reader.");
assert.doesNotMatch(functionSource(clientSource, "renderSectionDetail"), /persistSectionBookmark\(sectionPayload, false\)[\s\S]*?renderWorkspace\(/, "Section-detail deletion must not rebuild dirty Notebook or Report editors.");
assert.match(functionSource(clientSource, "renderSectionDetail"), /persistSectionBookmark\(sectionPayload, false\)[\s\S]*?refreshVisibleSyncedDerivedState\(\)/, "Section-detail deletion must update its bookmark state without replacing unrelated panes.");
assert.match(functionSource(clientSource, "scheduleAnnotationPush"), /record\.syncFields[\s\S]*?includes\("noteBody"\)[\s\S]*?refreshOpenSavedPanes\(\)[\s\S]*?refreshVisibleSyncedDerivedState\(\)/, "Debounced note saves must refresh every repeatable Saved column and visible note control.");
assert.doesNotMatch(functionSource(clientSource, "scheduleAnnotationPush"), /state\.utilities\.saved|renderWorkspace\(/, "Note propagation must not depend on the retired Saved boolean or rebuild dirty editors.");
assert.match(functionSource(clientSource, "refreshProjectSourceConsumers"), /notebook\.refreshReferenceSources\(\{[\s\S]*?refreshFoundation:[\s\S]*?report\.refreshSources\(\)/, "Project evidence changes must invalidate mounted Notebook and Report source choices together.");
assert.match(clientSource, /async refreshReferenceSources\(options = \{\}\)[\s\S]*?refreshNotebookReferenceSources\(options\)/, "Mounted Notebooks do not expose an editor-safe reference refresh.");
assert.match(clientSource, /refreshNotebookReferenceSources = async[\s\S]*?notebookReferenceCandidates\(identity, foundation, cards\)[\s\S]*?renderReferenceOptions\(\)/, "Notebook source refresh must rebuild only the reference menu from current Project evidence.");
assert.match(clientSource, /async refreshSources\(\)[\s\S]*?refreshReportSources\(\)/, "Mounted Reports do not expose an editor-safe source refresh.");
assert.match(clientSource, /refreshReportSources = async[\s\S]*?postResearch\("\/reports\/sources\/list"[\s\S]*?sourcePalette\.replaceChildren\(\)[\s\S]*?renderSourcePalette\(sourcePalette\)/, "Report source refresh must replace only the source palette instead of remounting the editor.");
assert.match(functionSource(clientSource, "persistSectionFolderSelection"), /refreshOpenSavedPanes\(\)[\s\S]*?refreshProjectSourceConsumers\(touchedProjects\)/, "Project assignment changes must update Saved, Notebook, and Report consumers after persistence.");
assert.match(clientSource, /postResearch\("\/notebook\/cards\/save"[\s\S]*?reportDraftMounts\.get\(projectID\)\?\.refreshSources/, "Saving a Notebook Note must update an open Report's available Note sources.");
assert.match(clientSource, /postResearch\("\/notebook\/cards\/delete"[\s\S]*?reportDraftMounts\.get\(projectID\)\?\.refreshSources/, "Deleting a Notebook Note must remove it from an open Report's source choices.");
assert.match(functionSource(clientSource, "setNotebookCardArchived"), /postResearch\("\/notebook\/cards\/archive"[\s\S]*?reportDraftMounts\.get\(projectID\)\?\.refreshSources/, "Archiving or restoring a Notebook Note must update an open Report's source choices.");
assert.match(clientSource, /postResearch\("\/reports\/drafts\/save"[\s\S]*?notebookMounts\.get\(projectID\)\?\.refreshReportStatus/, "Saving a Report must update the focused Notebook Note's Report status.");
assert.match(functionSource(clientSource, "deleteResearchConversationFromList"), /refreshProjectSourceConsumers\(\[conversation\.primaryProjectID\][\s\S]*?refreshNotebookFoundation: true[\s\S]*?refreshPaneIDs: \["utility:analysis", \.\.\.projectPaneIDs\]/, "Deleting Research must update its Project, Notebook references, and Report sources together.");
assert.match(functionSource(clientSource, "refreshResearchProjectAssignmentConsumers"), /refreshProjectSourceConsumers\(visibleProjectIDs,[\s\S]*?refreshNotebookFoundation: true[\s\S]*?refreshVisibleProjectArtifactSummaries\(projectID\)/, "Moving Research must invalidate both its old and new Project source consumers and refresh their visible summaries.");
assert.equal((clientSource.match(/refreshResearchProjectAssignmentConsumers\(\[previousProjectID, targetProjectID\]\)/g) || []).length, 2, "Both Research Project assignment controls must refresh the old and new Project consumers.");
const researchAnswerPropagationMatches = clientSource.match(/onSuccess: async \(result\) => \{[\s\S]*?refreshProjectSourceConsumers\(\[result\.conversation\.primaryProjectID\][\s\S]*?refreshNotebookFoundation: true/g) || [];
assert.equal(researchAnswerPropagationMatches.length, 2, "Both new and existing Research answer flows must update Notebook and Report sources.");
assert.match(clientSource, /async function clearResearchConversationHistory\(button,[\s\S]*?"Remove selected Research history\?"[\s\S]*?container: button\.closest\("\.workspace-panel"\)/, "Bulk Research-history removal must keep its confirmation inside the Research column.");
assert.match(clientSource, /unassignedHeading\.textContent = "Unassigned Saved"[\s\S]*?unassignedCountLabel\.textContent = String\(unassignedCount\)[\s\S]*?const organizeUnassigned = !instance\.organizeUnassigned;[\s\S]*?requestProjectSelection\(paneID, instance\.id,[\s\S]*?kind: organizeUnassigned \? "unassigned" : "none"/, "The Projects menu does not expose a counted Unassigned Saved destination through the serialized Project-selection controller.");
assert.match(functionSource(clientSource, "applyProjectSelectionIntent"), /liveInstance\.organizeUnassigned = intent\.kind === "unassigned";[\s\S]*?transitionProjectSelection\(controller\.paneID\)/, "The serialized Project-selection controller does not open the filtered Unassigned Saved evidence view.");
assert.match(clientSource, /const showingUnassigned = !selectedFolder && savedInstance\.organizeUnassigned;[\s\S]*?if \(!selectedFolder && !showingUnassigned\) return;/, "The Saved panel still prevents the Unassigned Saved view from rendering without a Project.");
assert.match(clientSource, /function currentResearchConversationLabel\(\) \{[\s\S]*?if \(!conversationID\) return "";/, "Reader passage actions do not recognize the persisted active Research conversation ID.");
assert.doesNotMatch(clientSource, /if \(!conversationID \|\| !researchConversationPaneIsOpen\(\)\) return "";/, "Reader passage actions incorrectly depend on the transient Research pane-open flag.");
assert.match(clientSource, /async function addResearchSelectionToCurrent\(selection\)[\s\S]*?postResearch\("\/research\/conversations\/evidence"[\s\S]*?conversationID[\s\S]*?openResearchConversation\(conversationID/, "The direct Reader action does not add supporting evidence to the open Research conversation.");
assert.doesNotMatch(clientSource, /showResearchSelectionMenu|bindResearchTextSelection/, "Reader text selection still opens an intermediate action card.");
assert.match(clientSource, /panel\.classList\.add\("analysis-panel", "research-list-panel", "has-research-composer"\)/, "The Research history panel does not reserve a fixed composer row.");
assert.match(clientSource, /function renderNewResearchComposer\(container, researchEnabled\)[\s\S]*?input\.rows = 3;[\s\S]*?container\.append\(form\);/, "The Research history composer does not match the conversation composer height or mount directly in the panel.");
assert.match(clientSource, /renderNewResearchComposer\(panel, researchEnabled\)/, "The Research history composer still scrolls inside the history content.");
assert.match(stylesSource, /\.analysis-panel\.has-research-composer > \.research-composer \{[\s\S]*?padding: var\(--space-3\) 0 var\(--panel-padding\);/, "The Research history composer does not share the conversation composer's bottom position.");
assert.match(stylesSource, /\.research-composer \.research-question-input \{[\s\S]*?background: rgb\(246 244 241 \/ 10%\);[\s\S]*?color: #ffffff;/, "Research composer textareas do not share the annotated fill and text color.");
assert.match(indexSource, /id="add-reader"[^>]*data-mobile-label="Reader"/, "The mobile Reader action lacks its compact label.");
assert.match(indexSource, /id="toggle-saved"[^>]*data-mobile-label="Saved"/, "The mobile Saved action lacks its compact label.");
assert.match(indexSource, /id="mobile-more"[\s\S]*?aria-haspopup="dialog"[\s\S]*?data-mobile-label="More"/, "The mobile dock lacks its More action.");
assert.match(stylesSource, /@media \(max-width: 760px\) \{[\s\S]*?grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);[\s\S]*?#toggle-saved \{ order: 1; \}[\s\S]*?#mobile-more \{ order: 5; \}/, "The mobile dock is not a five-action layout.");
assert.match(stylesSource, /\.topbar #fit-columns,[\s\S]*?\.topbar #collapse-readers,[\s\S]*?display: none !important;/, "Desktop column-layout controls remain visible in the mobile dock.");
assert.match(clientSource, /function openMobileMoreSheet\(\)[\s\S]*?workspace\.name[\s\S]*?"Create workspace"[\s\S]*?"Rename workspace"[\s\S]*?"Account"/, "The mobile More sheet does not contain workspace switching and management controls.");
assert.match(clientSource, /const preservedTargetOffset = preservedTarget[\s\S]*?menu\.scrollTop \+= nextTargetOffset - preservedTargetOffset;[\s\S]*?focusTarget\?\.focus\(\{ preventScroll: true \}\)/, "Expanding a Reader chapter does not preserve its viewport position.");
assert.match(clientSource, /if \(!readerChapterMenu\) \{[\s\S]*?event\.key === "Escape"[\s\S]*?closeMenu\(\);[\s\S]*?trigger\.focus\(\{ preventScroll: true \}\)/, "Escape does not close an enhanced select and restore trigger focus.");

console.log("permitext research list summary contract passed");
