import { reconciledResearchEvaluationInput } from "./research-answer-key-reconciliation.mjs";
import { ownerCodeResearchInput } from "./research-owner-code-review.mjs";

// Preserve the distinction in authored inputs at the real HTTP boundary.
// A section ID is not permission to fabricate a highlight of its full text.
export function ownerResearchHTTPSelections(input) {
  return (input.pinnedEvidence || []).map((pin) => {
    const sectionID = String(pin.sectionID || "").trim();
    if (!sectionID) throw new Error("An authored source needs a section ID.");
    if (Object.hasOwn(pin, "selectedText")) {
      if (typeof pin.selectedText !== "string" || !pin.selectedText.trim()) throw new Error("An authored exact passage cannot be empty.");
      return { sectionID, selectedText: pin.selectedText };
    }
    return { sectionID, selectionMode: "section_reference" };
  });
}

// Project authored inputs only. Reference answers and reviewer expectations
// must remain outside retrieval, planning and generation.
export async function ownerResearchScopeInput(testCase, { original = false, zoningSummary } = {}) {
  const projected = original ? reconciledResearchEvaluationInput(testCase) : ownerCodeResearchInput(testCase);
  const projectFacts = Object.entries(projected.projectContext || {}).flatMap(([key, value]) =>
    (Array.isArray(value) ? value : [value]).map((entry) => `${key}: ${entry}`));
  const pinnedEvidence = (projected.selectedEvidence || []).map((selection, index) => ({
    sectionID: String(selection.sectionID), sourceID: `authored-selection-${selection.sectionID}-${index}`,
    codePrefix: selection.codePrefix, sectionNumber: selection.sectionNumber,
    selectedText: (selection.exactPassages || []).join("\n\n")
  }));
  for (const [index, id] of (projected.selectedEvidenceSectionIDs || []).entries()) {
    const summary = await zoningSummary(id);
    if (!summary) throw Object.assign(new Error(`Authored Zoning selection unavailable: ${id}`), { code: "AUTHORED_SELECTION_UNAVAILABLE" });
    pinnedEvidence.push({ sectionID: String(id), sourceID: `authored-section-${id}-${index}`,
      codePrefix: "ZR", sectionNumber: summary.sectionNumber });
  }
  return { question: projected.question, projectCodeVersion: projected.codeVersion,
    projectFacts, pinnedEvidence, messages: [] };
}
