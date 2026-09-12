import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const [clientSource, editorSource, stylesSource] = await Promise.all([
  readFile(join(root, "../public/app.js"), "utf8"),
  readFile(join(root, "../src/notebook-editor.js"), "utf8"),
  readFile(join(root, "../public/styles.css"), "utf8")
]);

assert.match(
  clientSource,
  /const referenceID = String\(card\.id \|\| ""\)\.trim\(\)[\s\S]*?disabledReason: referenceID \? "" : "Finish syncing this Note before linking it\."/,
  "Unsynced Notes must be identified before they are offered as linkable references."
);
assert.match(
  clientSource,
  /option\.disabled = Boolean\(reference\.disabledReason\)[\s\S]*?optionMeta\.textContent = reference\.disabledReason/,
  "Unsynced Note references must render as disabled choices with a visible explanation."
);
assert.match(
  clientSource,
  /if \(!reference \|\| reference\.disabledReason\) return;[\s\S]*?showWebNotice\("Reference not inserted", error\.message\)/,
  "Reference insertion must ignore unavailable choices and disclose unexpected editor failures."
);
assert.match(
  clientSource,
  /const provisionalCardID = String\(cardAtStart\.id \|\| ""\)\.trim\(\)[\s\S]*?card\.id !== summary\.id[\s\S]*?Boolean\(String\(card\.id \|\| ""\)\.trim\(\)\)/,
  "A successfully synchronized Note must replace its provisional empty-ID summary."
);
assert.match(
  clientSource,
  /function notebookDocumentWithCurrentCardLabels\(document, cards\)[\s\S]*?value\.props\?\.referenceKind === "notebookCard"[\s\S]*?value\.props\.label = nextLabel/,
  "Linked Note labels must resolve from the current Note title by stable Note ID."
);
assert.match(
  clientSource,
  /const currentCardLabels = notebookDocumentWithCurrentCardLabels\(reconciledDocument, cards\)[\s\S]*?dirty = useLocalDraft \|\| currentCardLabels\.changed[\s\S]*?"Updated linked Note title · waiting to sync"/,
  "Opening a Note must refresh and persist renamed linked-Note labels."
);
assert.match(
  clientSource,
  /cards = nextCards;[\s\S]*?notebookDocumentWithCurrentCardLabels\(draftDocument, cards\)[\s\S]*?editorMount\?\.setDocument\(draftDocument\)/,
  "A visible Note must refresh linked-Note labels when its Project Note summaries change."
);
assert.match(
  editorSource,
  /insertReference\(reference\) \{[\s\S]*?if \(!editor\) return false;[\s\S]*?return true;/,
  "The editor reference API must report whether insertion was accepted."
);
assert.match(
  stylesSource,
  /\.notebook-toolbar \.notebook-reference-option:disabled \{[\s\S]*?cursor: not-allowed;[\s\S]*?opacity:/,
  "Unavailable Note references must have a visible disabled state."
);

console.log("Notebook reference availability contract passed.");
