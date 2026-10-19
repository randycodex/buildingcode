import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const savedEvidenceSectionSource = appSource.match(/^function populateSavedEvidenceSection\([\s\S]*?^\}/m)?.[0];
assert(savedEvidenceSectionSource, "Evidence section renderer must exist.");

// Project evidence is always expanded, including when an older workspace has
// persisted a collapsed folder. Its open state gives the body a scroll viewport.
const evidenceElement = () => ({
  children: [], classes: new Set(),
  get classList() { return { add: name => this.classes.add(name) }; },
  append(...children) { this.children.push(...children); },
  setAttribute() {}, remove() { this.removed = true; }
});
const projectEvidenceHeading = evidenceElement();
const projectEvidenceTitle = evidenceElement();
const populateProjectEvidence = new Function(
  "projectRecordID", "createSavedEvidenceHeading", "document", "safeAnnotationIDPart",
  "folderIsProject", "hasCapability", "wireProjectSectionMotion",
  `${savedEvidenceSectionSource}; return populateSavedEvidenceSection;`
)(
  folder => folder.id,
  () => ({ heading: projectEvidenceHeading, title: projectEvidenceTitle }),
  { createElement: evidenceElement }, value => value, () => true, () => true,
  () => { throw new Error("Project evidence must not use the old collapse control."); }
);
const projectEvidenceSection = evidenceElement();
const projectEvidenceContent = evidenceElement();
populateProjectEvidence(projectEvidenceSection, {
  id: "evidence-column", collapsedEvidenceFolderIDs: ["project"]
}, { id: "project" }, projectEvidenceContent);
assert(projectEvidenceSection.classes.has("is-open"), "Always-visible Project evidence must enable its constrained, scrollable body.");
assert.equal(projectEvidenceTitle.removed, true);
assert.doesNotMatch(savedEvidenceSectionSource,/reportMembershipIndicator/,'The Evidence header has no Report destination.');
assert.equal(projectEvidenceSection.children[1].children[0], projectEvidenceContent, "Opening the scroll viewport must retain the original evidence list.");

console.log("Project evidence scrolling state passed, including persisted collapsed folders and retained content.");
