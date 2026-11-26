// Project links store verbatim excerpts. Each value in selectedExcerptOccurrences
// identifies a zero-based occurrence of that quote within this provision.
function decoded(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return undefined; }
}

function excerpts(record) {
  const values = decoded(record?.selectedExcerpts);
  return Array.isArray(values) ? [...new Set(values.filter(value => typeof value === "string" && value.trim()))] : [];
}

function occurrences(record) {
  const values = decoded(record?.selectedExcerptOccurrences);
  return values && typeof values === "object" && !Array.isArray(values) ? values : {};
}

function positionsFor(occurrences, quote) {
  if (!Object.hasOwn(occurrences, quote) || !Array.isArray(occurrences[quote])) return [];
  return occurrences[quote].filter(index => Number.isSafeInteger(index) && index >= 0);
}

export function mergeProjectSectionSelection(previous, incoming, { advanceTimestamp = true } = {}) {
  if (incoming.deletedAt) {
    const {selectedExcerpts, selectedExcerptOccurrences, ...tombstone} = incoming;
    return tombstone;
  }
  const currentTime = Date.parse(incoming.updatedAt);
  const previousTime = Date.parse(previous?.updatedAt);
  // A new save after removal starts a fresh selection. Ignore delayed writes
  // predating that removal even if the link has since become active again.
  if (previous?.deletedAt) {
    if (currentTime <= previousTime) return incoming;
    return mergeProjectSectionSelection(null, { ...incoming, selectionResetAt: previous.deletedAt });
  }
  const previousReset = Date.parse(previous?.selectionResetAt) || 0;
  const incomingReset = Date.parse(incoming.selectionResetAt) || 0;
  if (previousReset && currentTime <= previousReset) return incoming;
  // A delete and a fresh save can arrive together as one coalesced queue item.
  if (previous && incomingReset > previousReset && incomingReset >= previousTime && incomingReset < currentTime) {
    return mergeProjectSectionSelection(null, incoming);
  }

  const before = excerpts(previous);
  const added = excerpts(incoming);
  const quotes = [...new Set([...before, ...added])];
  const oldPositions = occurrences(previous);
  const newPositions = occurrences(incoming);
  const entries = [];
  let gainedSelection = quotes.length > before.length;
  for (const quote of quotes) {
    const positions = new Set(positionsFor(oldPositions, quote));
    const previousCount = positions.size;
    for (const index of positionsFor(newPositions, quote)) positions.add(index);
    if (positions.size > previousCount) gainedSelection = true;
    if (positions.size) entries.push([quote, [...positions].sort((a, b) => a - b)]);
  }
  const olderOrEqual = previous && currentTime <= previousTime;
  if (olderOrEqual && !added.length && !gainedSelection && currentTime < previousTime) return incoming;
  // Stale or simultaneous excerpt additions may contribute only their locations,
  // never stale metadata. Give changed contents a distinct timestamp for delta pulls.
  const result = { ...(olderOrEqual && (gainedSelection || added.length) ? previous : incoming) };
  if (olderOrEqual && gainedSelection && advanceTimestamp) result.updatedAt = new Date(previousTime + 1).toISOString();
  const latestReset = Math.max(previousReset, incomingReset);
  if (latestReset && latestReset < Date.parse(result.updatedAt)) result.selectionResetAt = new Date(latestReset).toISOString();
  else delete result.selectionResetAt;
  if (quotes.length) result.selectedExcerpts = quotes;
  else delete result.selectedExcerpts;
  if (entries.length) result.selectedExcerptOccurrences = Object.fromEntries(entries);
  else delete result.selectedExcerptOccurrences;
  return result;
}
