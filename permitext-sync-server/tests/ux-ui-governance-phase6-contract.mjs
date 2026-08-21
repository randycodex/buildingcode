import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { auditAddedLines } from "../scripts/audit-ux-ui.mjs";

const serverRoot = new URL("../", import.meta.url);
const repositoryRoot = new URL("../../", import.meta.url);
const [
  webClient,
  webIndex,
  webStyles,
  packageSource,
  permitextApp,
  chapterReader,
  sectionReader,
  settingsView,
  filterChips,
  organizationHub,
  bookmarksView,
  alignmentPlan,
  governance
] = await Promise.all([
  readFile(new URL("public/app.js", serverRoot), "utf8"),
  readFile(new URL("public/index.html", serverRoot), "utf8"),
  readFile(new URL("public/styles.css", serverRoot), "utf8"),
  readFile(new URL("package.json", serverRoot), "utf8"),
  readFile(new URL("NYC CC APP/permitext/PermitextApp.swift", repositoryRoot), "utf8"),
  readFile(new URL("NYC CC APP/permitext/Views/ChapterReaderView.swift", repositoryRoot), "utf8"),
  readFile(new URL("NYC CC APP/permitext/Views/ReaderView.swift", repositoryRoot), "utf8"),
  readFile(new URL("NYC CC APP/permitext/Views/SettingsView.swift", repositoryRoot), "utf8"),
  readFile(new URL("NYC CC APP/permitext/Views/CodeSectionMultiFilterChips.swift", repositoryRoot), "utf8"),
  readFile(new URL("NYC CC APP/permitext/Views/OrganizationProjectHubView.swift", repositoryRoot), "utf8"),
  readFile(new URL("NYC CC APP/permitext/Views/BookmarksView.swift", repositoryRoot), "utf8"),
  readFile(new URL("PERMITEXT_UX_UI_ALIGNMENT_PLAN.md", repositoryRoot), "utf8"),
  readFile(new URL("docs/PERMITEXT_UX_UI_GOVERNANCE.md", repositoryRoot), "utf8")
]);

function cssBlock(source, startPattern) {
  const start = source.search(startPattern);
  assert(start >= 0, `Missing CSS block matching ${startPattern}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  assert.fail(`Unterminated CSS block matching ${startPattern}`);
}

function cssToken(block, name) {
  const value = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  assert(value, `Missing six-digit color token --${name}`);
  return value;
}

function relativeLuminance(hex) {
  const channels = hex.match(/[0-9a-fA-F]{2}/g).map((value) => parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4);
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrastRatio(first, second) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
}

const lightTokens = cssBlock(webStyles, /^:root\s*\{/m);
const darkMedia = cssBlock(webStyles, /@media \(prefers-color-scheme: dark\)/);
const darkTokens = cssBlock(darkMedia, /:root\s*\{/);
for (const [mode, tokens] of [["light", lightTokens], ["dark", darkTokens]]) {
  const secondary = cssToken(tokens, "text-secondary");
  for (const surfaceName of ["background", "surface"]) {
    assert(
      contrastRatio(secondary, cssToken(tokens, surfaceName)) >= 4.5,
      `${mode} --text-secondary must meet 4.5:1 on --${surfaceName}.`
    );
  }
}
assert(contrastRatio("#0d0d0f", cssToken(lightTokens, "ios-accent-building")) >= 4.5);
assert(contrastRatio("#0d0d0f", cssToken(darkTokens, "ios-accent-building")) >= 4.5);

assert.match(webClient, /saved \? "Remove from Saved" : "Save passage"/);
assert.match(webClient, /message\.textContent = "Saved"/);
assert.match(webClient, /projectButton\.textContent = "Add to Project"/);
assert.match(webClient, /title\.textContent = "Reports"/);
assert.doesNotMatch(webClient, /title\.textContent = "Report exports"/);
assert.match(webIndex, /Clear All Saved Passages/);
assert.doesNotMatch(webIndex, /Clear All Bookmarks/);

assert.match(permitextApp, /\.accessibilityLabel\("Saved"\)/);
assert.doesNotMatch(permitextApp, /Text\("Projects"\)/);
assert.match(chapterReader, /displayedIsBookmarked \? "Remove from Saved" : "Save passage"/);
assert.match(chapterReader, /displayedIsBookmarked \? "Saved" : "Removed from Saved"/);
assert.match(sectionReader, /isBookmarked \? "Remove from Saved" : "Save passage"/);
assert.match(settingsView, /Clear All Saved Passages/);
assert.doesNotMatch(settingsView, /Clear All Bookmarks/);
assert.match(organizationHub, /projectSection\(title: "Reports"/);
assert.match(bookmarksView, /projectHubMetric\([^\n]*label: "Reports"\)/);
assert.match(bookmarksView, /Export & Save iOS PDF/);

const userFacingSources = [webClient, permitextApp, chapterReader, sectionReader];
for (const source of userFacingSources) {
  assert.doesNotMatch(
    source,
    /(?:Text|Label|Button|accessibilityLabel|textContent|innerText)[^\n]*Astroid/i
  );
}

const panelTitleRule = cssBlock(webStyles, /^\.panel-title\s*\{/m);
assert.doesNotMatch(panelTitleRule, /display\s*:\s*none|visibility\s*:\s*hidden/);

const targetRegistry = [
  ["web Reader passage actions", webStyles, /\.inline-bookmark-toggle,[\s\S]*?min-width: 28px;[\s\S]*?min-height: 28px;/],
  ["web first-use actions", webStyles, /\.first-use-actions button,[\s\S]*?min-height: 44px;/],
  ["iPhone Reader save action", chapterReader, /\.frame\(width: 44, height: 44\)[\s\S]*?\.contentShape\(Rectangle\(\)\)/],
  ["iPhone filter chip", filterChips, /minimumHitHeight: CGFloat = 44[\s\S]*?accessibilityAddTraits\(isSelected \? \.isSelected : \[\]\)/]
];
for (const [name, source, pattern] of targetRegistry) {
  assert.match(source, pattern, `${name} left the critical-target registry.`);
}

const auditFixtures = [
  { path: "permitext-sync-server/public/styles.css", lineNumber: 10, text: ".bad { color: #777; }", context: ".bad { color: #777; }" },
  { path: "NYC CC APP/permitext/PermitextApp.swift", lineNumber: 11, text: "Text(\"Projects\")", context: "Text(\"Projects\")" },
  { path: "NYC CC APP/permitext/Views/ResearchView.swift", lineNumber: 12, text: "Text(\"Tap the Astroid\")", context: "Text(\"Tap the Astroid\")" },
  { path: "permitext-sync-server/public/app.js", lineNumber: 13, text: "title.textContent = \"Exports\";", context: "title.textContent = \"Exports\";" },
  { path: "permitext-sync-server/public/styles.css", lineNumber: 14, text: "display: none;", context: ".panel-title {\n display: none;\n}" }
];
assert.equal(auditAddedLines(auditFixtures).failures.length, 5);
const allowedAudit = auditAddedLines([
  { path: "permitext-sync-server/public/styles.css", lineNumber: 20, text: "/* ux-audit-allow: external brand color */", context: "" },
  { path: "permitext-sync-server/public/styles.css", lineNumber: 21, text: ".brand { color: #123456; }", context: "" }
]);
assert.equal(allowedAudit.failures.length, 0);

const packageJSON = JSON.parse(packageSource);
assert.equal(packageJSON.scripts.postcheck, "npm run test:ux-alignment");
assert.match(packageJSON.scripts["test:ux-alignment"], /ux-ui-governance-phase6-contract\.mjs/);
assert.equal(packageJSON.scripts["audit:ux-ui"], "node scripts/audit-ux-ui.mjs");
assert.match(governance, /Save passage/);
assert.match(governance, /Remove from Saved/);
assert.match(governance, /Report/);
assert.match(governance, /Export/);
assert.match(governance, /There is no iPad product/);
assert.match(governance, /mobile-web placeholder remains intentional/);
assert.match(governance, /Notebook and Project Hub error-versus-empty-state redesign remains deferred/);
assert.match(alignmentPlan, /All six alignment phases are implemented locally/);

console.log("UX/UI governance Phase 6 contract passed.");
