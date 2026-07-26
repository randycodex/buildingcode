const recentViewLimit = 20;
const recentSearchLimit = 10;
const recentSearchHistoryKey = "recentSearchHistoryJSON";
const historyClearsKey = "continuityHistoryClearsJSON";
const appleReferenceDateOffsetSeconds = 978_307_200;

function safeArray(rawValue) {
  try {
    const parsed = JSON.parse(rawValue || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function canonicalJSONString(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJSONString(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJSONString(value[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

function recordTimestamp(record) {
  const timestamp = Date.parse(record?.updatedAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function viewedAtTimestamp(entry) {
  if (typeof entry?.viewedAt === "number" && Number.isFinite(entry.viewedAt)) {
    // Apple Foundation JSON dates use seconds since 2001-01-01.
    return (entry.viewedAt + appleReferenceDateOffsetSeconds) * 1_000;
  }
  const timestamp = Date.parse(entry?.viewedAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function recentViewIdentity(entry) {
  const sectionID = Number(entry?.sectionID);
  return Number.isSafeInteger(sectionID) && sectionID > 0 ? String(sectionID) : null;
}

function preferredRecentView(left, right) {
  const timestampDifference = viewedAtTimestamp(right) - viewedAtTimestamp(left);
  if (timestampDifference !== 0) return timestampDifference > 0 ? right : left;
  return canonicalJSONString(right).localeCompare(canonicalJSONString(left)) > 0 ? right : left;
}

function explicitClearTimestamp(record, historyKey) {
  const explicitClears = record?.values?.[historyClearsKey];
  let storedTimestamp = 0;
  if (explicitClears) {
    try {
      storedTimestamp = Number(JSON.parse(explicitClears)?.[historyKey]) || 0;
    } catch {
      storedTimestamp = 0;
    }
  }
  const rawHistory = record?.values?.[
    historyKey === "views" ? "recentlyViewedSectionsJSON" : "recentSearchesJSON"
  ];
  return rawHistory !== undefined && safeArray(rawHistory).length === 0
    ? Math.max(storedTimestamp, recordTimestamp(record))
    : storedTimestamp;
}

function mergedClearTimestamp(records, historyKey) {
  return Math.max(...records.map((record) => explicitClearTimestamp(record, historyKey)));
}

function mergedRecentViews(records, clearedAt) {
  const bySectionID = new Map();
  records.forEach((record) => {
    safeArray(record?.values?.recentlyViewedSectionsJSON).forEach((entry) => {
      const identity = recentViewIdentity(entry);
      if (!identity) return;
      const existing = bySectionID.get(identity);
      bySectionID.set(identity, existing ? preferredRecentView(existing, entry) : entry);
    });
  });
  return [...bySectionID.values()]
    .filter((entry) => viewedAtTimestamp(entry) > clearedAt)
    .sort((left, right) => {
      const timestampDifference = viewedAtTimestamp(right) - viewedAtTimestamp(left);
      if (timestampDifference !== 0) return timestampDifference;
      return recentViewIdentity(left).localeCompare(recentViewIdentity(right));
    })
    .slice(0, recentViewLimit);
}

function searchIdentity(query) {
  return String(query || "").trim().normalize("NFKC").toLocaleLowerCase("en-US");
}

function searchHistory(record) {
  const explicitHistory = safeArray(record?.values?.[recentSearchHistoryKey])
    .map((entry) => ({
      query: String(entry?.query || "").trim(),
      searchedAt: Number(entry?.searchedAt)
    }))
    .filter((entry) => entry.query && Number.isFinite(entry.searchedAt));
  if (explicitHistory.length) return explicitHistory;

  const snapshotTimestamp = recordTimestamp(record);
  return safeArray(record?.values?.recentSearchesJSON)
    .map((query, index) => ({
      query: String(query || "").trim(),
      // Preserve the snapshot's order without requiring older clients to
      // understand the per-entry clock added by this merge policy.
      searchedAt: snapshotTimestamp - index
    }))
    .filter((entry) => entry.query);
}

function preferredSearch(left, right) {
  if (right.searchedAt !== left.searchedAt) {
    return right.searchedAt > left.searchedAt ? right : left;
  }
  return right.query.localeCompare(left.query) > 0 ? right : left;
}

function mergedSearchHistory(records, clearedAt) {
  const byQuery = new Map();
  records.forEach((record) => {
    searchHistory(record).forEach((entry) => {
      const identity = searchIdentity(entry.query);
      if (!identity) return;
      const existing = byQuery.get(identity);
      byQuery.set(identity, existing ? preferredSearch(existing, entry) : entry);
    });
  });
  return [...byQuery.values()]
    .filter((entry) => entry.searchedAt > clearedAt)
    .sort((left, right) => {
      if (right.searchedAt !== left.searchedAt) return right.searchedAt - left.searchedAt;
      return searchIdentity(left.query).localeCompare(searchIdentity(right.query));
    })
    .slice(0, recentSearchLimit);
}

function preferredSnapshot(left, right) {
  const timestampDifference = recordTimestamp(right) - recordTimestamp(left);
  if (timestampDifference !== 0) return timestampDifference > 0 ? right : left;
  return canonicalJSONString(right).localeCompare(canonicalJSONString(left)) > 0 ? right : left;
}

export function mergeContinuityRecords(left, right, { mergedAt } = {}) {
  if (!left) return right;
  if (!right) return left;

  const preferred = preferredSnapshot(left, right);
  const records = [left, right];
  const viewsClearedAt = mergedClearTimestamp(records, "views");
  const searchesClearedAt = mergedClearTimestamp(records, "searches");
  const views = mergedRecentViews(records, viewsClearedAt);
  const searches = mergedSearchHistory(records, searchesClearedAt);
  const historiesChanged =
    canonicalJSONString(views) !== canonicalJSONString(safeArray(preferred.values?.recentlyViewedSectionsJSON)) ||
    canonicalJSONString(searches.map((entry) => entry.query)) !==
      canonicalJSONString(safeArray(preferred.values?.recentSearchesJSON));
  const newestTimestamp = Math.max(recordTimestamp(left), recordTimestamp(right));
  const mergeTimestamp = Date.parse(mergedAt || "");
  const updatedAt = historiesChanged && Number.isFinite(mergeTimestamp) && mergeTimestamp > newestTimestamp
    ? new Date(mergeTimestamp).toISOString()
    : preferred.updatedAt;

  return {
    ...preferred,
    values: {
      ...(preferred.values || {}),
      recentlyViewedSectionsJSON: JSON.stringify(views),
      recentSearchesJSON: JSON.stringify(searches.map((entry) => entry.query)),
      [recentSearchHistoryKey]: JSON.stringify(searches),
      [historyClearsKey]: JSON.stringify({
        views: viewsClearedAt,
        searches: searchesClearedAt
      })
    },
    updatedAt
  };
}

export function mergeContinuityMutations(leftMutation, rightMutation, options) {
  return {
    continuity: mergeContinuityRecords(
      leftMutation?.continuity,
      rightMutation?.continuity,
      options
    )
  };
}

export const continuityMergeContract = Object.freeze({
  recentSearchHistoryKey,
  historyClearsKey,
  recentSearchLimit,
  recentViewLimit
});
