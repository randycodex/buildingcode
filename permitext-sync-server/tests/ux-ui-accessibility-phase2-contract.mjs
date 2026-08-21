import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const iosRoot = new URL("../../NYC CC APP/permitext/", import.meta.url);
const [
  clientSource,
  stylesSource,
  browseSource,
  chipsSource,
  themeSource,
  htmlReaderSource,
  nativeReaderSource,
  researchSource,
  htmlReaderViewSource,
  nativeReaderViewSource
] = await Promise.all([
  readFile(new URL("public/app.js", root), "utf8"),
  readFile(new URL("public/styles.css", root), "utf8"),
  readFile(new URL("Views/BrowseView.swift", iosRoot), "utf8"),
  readFile(new URL("Views/CodeSectionMultiFilterChips.swift", iosRoot), "utf8"),
  readFile(new URL("Models/ReaderTheme.swift", iosRoot), "utf8"),
  readFile(new URL("Views/ChapterHTMLWebView.swift", iosRoot), "utf8"),
  readFile(new URL("Views/NativeChapterTextReaderView.swift", iosRoot), "utf8"),
  readFile(new URL("Views/ResearchView.swift", iosRoot), "utf8"),
  readFile(new URL("Views/ChapterHTMLReaderView.swift", iosRoot), "utf8"),
  readFile(new URL("Views/ChapterReaderView.swift", iosRoot), "utf8")
]);

assert.doesNotMatch(stylesSource, /\.panel-title\s*\{[^}]*display:\s*none/s);
assert.match(stylesSource, /\.panel-title\s*\{[^}]*clip-path:\s*inset\(50%\)/s);
assert.match(clientSource, /function ensureWorkspacePanelAccessibleName\(panel\)[\s\S]*?aria-labelledby/);
assert.match(clientSource, /orderedPanes\.forEach\(ensureWorkspacePanelAccessibleName\)/);

assert.match(clientSource, /select\.tabIndex = -1/);
assert.match(clientSource, /select\.setAttribute\("aria-hidden", "true"\)/);
assert.match(clientSource, /menu\.setAttribute\("role", "listbox"\)/);
assert.match(clientSource, /item\.setAttribute\("role", "option"\)/);
assert.match(clientSource, /trigger\.setAttribute\("aria-controls", menu\.id\)/);
assert.match(clientSource, /trigger\.setAttribute\("aria-haspopup", readerChapterMenu \? "tree" : "listbox"\)/);
for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape", "Tab"]) {
  assert(clientSource.includes(JSON.stringify(key)), `Enhanced selects must support ${JSON.stringify(key)}.`);
}
assert.match(clientSource, /closeMenu\(\);\s*trigger\.focus\(\{ preventScroll: true \}\)/);

assert.match(clientSource, /function trapWebModalFocus\(dialog, event\)/);
assert(
  (clientSource.match(/trapWebModalFocus\(/g) || []).length >= 7,
  "The shared modal focus trap must cover warnings, prompts, Stripe, Mobile More, Project sheets, and commands."
);
assert.match(clientSource, /overlay\.setAttribute\("role", "dialog"\)[\s\S]*?overlay\.setAttribute\("aria-modal", "true"\)/);

assert.match(stylesSource, /--panel-title-row-height:\s*max\([^;]+, 28px\)/);
assert.match(stylesSource, /\.inline-comment\s*\{[^}]*min-width:\s*68px;[^}]*width:\s*68px;/s);
assert.match(stylesSource, /\.inline-bookmark-toggle,\s*\.inline-research-toggle\s*\{\s*flex:\s*0 0 28px;/s);
assert.match(stylesSource, /body button:focus-visible[\s\S]*?outline:\s*2px solid[^;]+!important/);

assert.doesNotMatch(
  `${browseSource}\n${htmlReaderViewSource}\n${nativeReaderViewSource}`,
  /disablesInteractivePopGesture|InteractivePopGestureDisabler/
);
assert.match(chipsSource, /minimumHitHeight:\s*CGFloat = 44/);
assert.match(chipsSource, /Image\(systemName: "checkmark"\)/);
assert.match(chipsSource, /accessibilityAddTraits\(isSelected \? \.isSelected : \[\]\)/);
assert.match(chipsSource, /accessibilityValue\(isSelected \? "Selected" : "Not selected"\)/);
assert.match(browseSource, /@ScaledMetric\(relativeTo: \.title2\)[^\n]*chapterNumberSize/);
assert.match(browseSource, /@ScaledMetric\(relativeTo: \.subheadline\)[^\n]*chapterTitleSize/);

assert.match(themeSource, /static let minimumFontSize: Double = 17/);
assert.match(themeSource, /var fontSize: Double = 17/);
assert.doesNotMatch(`${htmlReaderSource}\n${nativeReaderSource}`, /theme\.fontSize \* 1\.16/);
assert.doesNotMatch(htmlReaderSource, /maximum-scale=1\.0|user-scalable=no/);
assert.match(htmlReaderSource, /maximumZoomScale = 5/);
assert.doesNotMatch(htmlReaderSource, /func viewForZooming[\s\S]*?\bnil\b/);
assert.match(researchSource, /Tap the sparkle icon to start Research\./);
assert.doesNotMatch(researchSource, /tap the Astroid/i);

function dynamicColorCases(propertyName) {
  const propertyPattern = new RegExp(
    `var ${propertyName}: Color \\{[\\s\\S]*?switch self \\{([\\s\\S]*?)\\n        \\}\\n    \\}`
  );
  const body = browseSource.match(propertyPattern)?.[1] || "";
  const colors = new Map();
  const casePattern = /case \.(\w+): return Self\.dynamicColor\(light: 0x([0-9A-F]+), dark: 0x([0-9A-F]+)\)/g;
  for (const match of body.matchAll(casePattern)) {
    colors.set(match[1], { light: match[2], dark: match[3] });
  }
  assert(colors.size > 0, `Could not parse ${propertyName}.`);
  return colors;
}

function relativeLuminance(hex) {
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(left, right) {
  const leftLuminance = relativeLuminance(left);
  const rightLuminance = relativeLuminance(right);
  return (Math.max(leftLuminance, rightLuminance) + 0.05) /
    (Math.min(leftLuminance, rightLuminance) + 0.05);
}

const chapterFills = dynamicColorCases("chapterFill");
const appendixFills = dynamicColorCases("appendixFill");
const chapterNumbers = dynamicColorCases("chapterNumberColor");
const chapterTitles = dynamicColorCases("chapterTitleColor");
const appendixNumbers = dynamicColorCases("appendixNumberColor");
const appendixTitles = dynamicColorCases("appendixTitleColor");

for (const [palette, chapterFill] of chapterFills) {
  const appendixFill = appendixFills.get(palette);
  for (const mode of ["light", "dark"]) {
    const pairs = [
      ["chapter number", chapterFill[mode], chapterNumbers.get(palette)?.[mode], 3],
      ["chapter title", chapterFill[mode], chapterTitles.get(palette)?.[mode], 4.5],
      ["appendix number", appendixFill?.[mode], appendixNumbers.get(palette)?.[mode], 3],
      ["appendix title", appendixFill?.[mode], appendixTitles.get(palette)?.[mode], 4.5]
    ];
    for (const [label, fill, foreground, minimum] of pairs) {
      assert(fill && foreground, `Missing ${mode} ${palette} ${label} color.`);
      const ratio = contrastRatio(fill, foreground);
      assert(
        ratio >= minimum,
        `${mode} ${palette} ${label} contrast ${ratio.toFixed(2)} is below ${minimum}:1.`
      );
    }
  }
}

console.log("UX/UI accessibility Phase 2 contract passed.");
