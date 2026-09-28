// Presentation prerequisite only: no storage access, mutation or history filtering.
const factKeys = ['complete', 'hasMessages', 'hasSources', 'hasAttachments', 'hasRetainedContext', 'hasTitleIntent'];
export function validResearchHistoryContentFacts(value) {
  return value?.schemaVersion === 1 && factKeys.every((key) => typeof value[key] === 'boolean');
}

// A caller must establish all local inputs for the current account/workspace.
// Missing, corrupt or not-yet-loaded state cannot establish an empty draft.
export function researchHistoryContentClassification(summary, local) {
  const localKeys = ['hasAuthoredText', 'hasPendingRequest', 'hasSelectedEvidence', 'hasAttachments', 'hasContext'];
  if (localKeys.some((key) => local?.[key] === true)) return 'retained';
  // Concrete summary content wins over older facts after a local rename/merge.
  const title = summary?.title;
  const generatedTitle = /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4} · \d{1,2}:\d{2} (?:AM|PM)$/;
  if ((typeof title === 'string' && title.length > 0 && !generatedTitle.test(title)) ||
      (summary?.sourceStatus && summary.sourceStatus !== 'current')) return 'retained';
  if (summary?.primaryProjectID || summary?.linkedCodeDecisionID || summary?.starterQuestion ||
      summary?.historyHiddenAt || summary?.projectContextReviewRequired === true ||
      Number(summary?.messageCount) > 0 || Number(summary?.sourceCount) > 0 ||
      (Array.isArray(summary?.sourceSectionIDs) && summary.sourceSectionIDs.length > 0)) return 'retained';
  const facts = summary?.historyContentFacts;
  if (!validResearchHistoryContentFacts(facts)) return 'unknown';
  if (factKeys.slice(1).some((key) => facts[key])) return 'retained';
  if (!facts.complete || local?.localStateKnown !== true ||
      !localKeys.every((key) => local[key] === false)) return 'unknown';
  return 'confirmed-empty';
}
