import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, styles, html] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../public/index.html", import.meta.url), "utf8")
]);

assert(html.includes('class="chapter-select"'), "Reader chapter trigger is missing.");
assert(html.includes('class="section-select"'), "Hidden Reader section select is missing.");
assert(app.includes("function renderReaderChapterNavigationMenu"), "Hierarchical chapter menu renderer is missing.");
assert(
  app.includes('setAttribute("role", "tree")') || app.includes('role="tree"'),
  "Chapter menu is not a tree."
);
assert(
  app.includes('setAttribute("role", "treeitem")') || app.includes('role="treeitem"'),
  "Chapter menu items are not treeitems."
);
assert(app.includes("ArrowRight"), "Chapter menu does not expand with ArrowRight.");
assert(app.includes("ArrowLeft"), "Chapter menu does not collapse with ArrowLeft.");
assert(app.includes("Escape"), "Chapter menu does not close on Escape.");
assert(app.includes("fetchChapter(expandedChapterID)"), "Chapter expansion must use the chapter-detail endpoint.");
assert(
  app.includes('hasOwnProperty.call(menu, "_expandedChapterID")') &&
    app.includes("hasPreservedExpandedChapter") &&
    app.includes("? menu._expandedChapterID"),
  "Closing and reopening the chapter menu must preserve its last disclosure state, including fully collapsed."
);
assert(app.includes("function readerNavigationSections"), "Chapter menu does not filter nested list-item catalog rows.");
assert(app.includes("isReaderNavigationSection"), "Chapter menu lacks a section-navigation predicate.");
assert(
  app.includes("expandedChapterID: expanded ? \"\" : chapter.id") &&
    !/reader-nav-chapter-row[\s\S]*selectReaderNavigation\(panel, reader, \{ chapterID: chapter.id \}\)/.test(app),
  "Clicking a chapter title must toggle disclosure instead of navigating away."
);
assert(!app.includes("nested <option"), "Do not attempt nested native options.");
assert(app.includes("navigationChapterID"), "Reader does not preserve navigation chapter identity.");
assert(styles.includes(".reader-nav-tree"), "Tree menu styles are missing.");
assert(styles.includes(".reader-nav-chapter"), "Chapter row styles are missing.");
assert(styles.includes(".reader-nav-section"), "Section row styles are missing.");
assert(styles.includes("aria-selected=\"true\""), "Selected-state styles are missing.");
assert(
  !/reader-nav-tree[^{]*\{[^}]*border:\s*1px solid/.test(styles),
  "Reader navigation tree should not rely on thin outline borders."
);

console.log("permitext reader navigation menu contract passed");
