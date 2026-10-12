// A query belongs to this tab's current session, not the saved workspace.
const keyFor = (key, workspaceID) => `${key}:search-queries:${workspaceID}`;

function mapSearchInstances(value, transform) {
  const next = { ...value, utilityInstances: (Array.isArray(value.utilityInstances) ? value.utilityInstances : [])
    .map(instance => instance.key === "search" ? transform(instance) : instance) };
  if (Array.isArray(value.columnGroups)) next.columnGroups = value.columnGroups.map(group => ({ ...group,
    columns: Object.fromEntries(Object.entries(group.columns || {}).map(([paneID, column]) => [paneID,
      column.kind === "utility" && column.value?.key === "search"
        ? { ...column, value: transform(column.value) } : column])) }));
  return next;
}

function allSearchInstances(value) {
  const grouped = (value.columnGroups || []).flatMap(group => Object.values(group.columns || {})
    .filter(column => column.kind === "utility" && column.value?.key === "search").map(column => column.value));
  // A live column's query takes precedence over an older saved group snapshot.
  return [...grouped, ...(value.utilityInstances || []).filter(instance => instance.key === "search")];
}

export function withoutPersistentSearchQueries(value) {
  return { ...mapSearchInstances(value, instance => ({ ...instance, query: "", searchPosition: null,
    searchExpansionDecisionKey: "" })), searchQuery: "" };
}

export function writeSearchQuerySession(storage, key, workspaceID, value) {
  try {
    storage.setItem(keyFor(key, workspaceID), JSON.stringify({
      searchQuery: value.searchQuery || "",
      queries: Object.fromEntries(allSearchInstances(value).map(instance => [instance.id, {
          query: instance.query || "", searchPosition: instance.searchPosition || null,
          searchExpansionDecisionKey: instance.searchExpansionDecisionKey || ""
        }]))
    }));
  } catch { /* Searching remains available without tab storage. */ }
}

export function restoreSearchQuerySession(storage, key, workspaceID, value) {
  const clean = withoutPersistentSearchQueries(value);
  try {
    const session = JSON.parse(storage.getItem(keyFor(key, workspaceID)) || "null");
    if (!session || typeof session !== "object") return clean;
    return { ...mapSearchInstances(clean, instance =>
        typeof session.queries?.[instance.id]?.query === "string"
        ? { ...instance, query: session.queries[instance.id].query,
          searchPosition: session.queries[instance.id].searchPosition || null,
          searchExpansionDecisionKey: session.queries[instance.id].searchExpansionDecisionKey || "" } : instance),
      searchQuery: typeof session.searchQuery === "string" ? session.searchQuery : "" };
  } catch { return clean; }
}

export function startSearchQuerySession(storage, key, isRefresh) {
  if (isRefresh) return;
  try {
    for (let index = storage.length - 1; index >= 0; index--) {
      const candidate = storage.key(index);
      if (candidate?.startsWith(`${key}:search-queries:`)) storage.removeItem(candidate);
    }
  } catch { /* A cold start still discards the durable query below. */ }
}
