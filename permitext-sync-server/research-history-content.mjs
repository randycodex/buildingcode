import {validResearchHistoryContentFacts} from './public/research-history-content.js';

// Keep in sync with the two database summary projections. Unrecognized server
// fields are retained context, so future draft/recovery fields fail closed.
const ordinaryKeys = [
  'id', 'title', 'titleSource', 'createdAt', 'updatedAt', 'historyHiddenAt',
  'codeVersion', 'evidenceSetVersion', 'primaryProjectID', 'starterQuestion',
  'projectContextReviewRequired', 'sourceStatus', 'sources', 'messages', 'origin'
];
const present = (value) => value !== undefined && value !== null &&
  value !== '' && !(Array.isArray(value) && value.length === 0);
export function researchHistoryContentFacts(conversation) {
  if (!conversation || typeof conversation !== 'object') return null;
  // A projected record must carry the original facts; never infer absence from
  // sources already reduced to selected excerpts or from omitted messages.
  if (!Array.isArray(conversation.messages)) {
    return validResearchHistoryContentFacts(conversation.historyContentFacts)
      ? Object.fromEntries(['schemaVersion', 'complete', 'hasMessages', 'hasSources', 'hasAttachments', 'hasRetainedContext', 'hasTitleIntent']
          .map((key) => [key, conversation.historyContentFacts[key]])) : null;
  }
  const sources = Array.isArray(conversation.sources) ? conversation.sources : [];
  return {
    schemaVersion: 1,
    complete: Array.isArray(conversation.sources),
    hasMessages: conversation.messages.length > 0 || Number(conversation.messageCount) > 0,
    hasSources: sources.length > 0,
    hasAttachments: present(conversation.attachments) || sources.some((source) =>
      present(source?.visualSources) || present(source?.richSourceID) || present(source?.richSourceGrids)),
    hasRetainedContext: Object.entries(conversation).some(([key, value]) =>
      !ordinaryKeys.includes(key) && key !== 'historyContentFacts' && value !== null && value !== undefined) ||
      (conversation.origin != null && JSON.stringify(conversation.origin) !== '{"kind":"chat"}'),
    // Only an explicitly generated default title can be proven unauthored.
    hasTitleIntent: conversation.titleSource !== 'default'
  };
}
