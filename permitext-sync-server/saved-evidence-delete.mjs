import { syncCodeVersion, syncProjectIdentity } from "./public/sync-identity.js";
import { recordSurvivesBulkClear } from "./public/sync-state.js";

export const maxSavedEvidenceDeleteItems = 200;

export function validateSavedEvidenceDelete(input) {
  if (!input || !Array.isArray(input.items) || !input.items.length || input.items.length > maxSavedEvidenceDeleteItems) {
    throw new Error(`Choose between 1 and ${maxSavedEvidenceDeleteItems} saved items.`);
  }
  if (input.projectID != null && (typeof input.projectID !== "string" || !input.projectID.trim() || input.projectID.length > 300)) {
    throw new Error("Choose a valid Project.");
  }
  for (const item of input.items) {
    if (!item || typeof item.codeVersion !== "string" || !item.codeVersion.trim() || item.codeVersion.length > 500 ||
        !Number.isSafeInteger(Number(item.sectionID)) || Number(item.sectionID) <= 0 ||
        (item.blockID != null && (typeof item.blockID !== "string" || item.blockID.length > 500))) {
      throw new Error("Each saved item needs an edition, section, and valid passage identity.");
    }
  }
}

const evidenceKey = record => JSON.stringify([syncCodeVersion(record.codeVersion), String(record.sectionID), String(record.blockID || "").trim()]);
const folderKey = (record, userID) => syncProjectIdentity(record.folderClientID, userID) ||
  (record.localFolderID == null ? null : `legacy-project-${record.localFolderID}`);

// Build from the authenticated account's current records, never client-provided
// tombstones. The storage adapter must commit against this same snapshot.
export function planSavedEvidenceDelete(userID, existing, input) {
  validateSavedEvidenceDelete(input);
  const owned = existing.filter(m => Object.values(m)[0]?.userID === userID);
  const clears = owned.flatMap(m => m.codeVersionClear ? [m.codeVersionClear] : []);
  const visible = (record, scopes) => record && !record.deletedAt && recordSurvivesBulkClear(record, clears, scopes);
  const projectID = syncProjectIdentity(input.projectID, userID);
  if (projectID && !owned.some(m => visible(m.project, ["folders"]) &&
      (syncProjectIdentity(m.project.clientID, userID) || syncProjectIdentity(m.project.id, userID) ||
        (m.project.localFolderID == null ? null : `legacy-project-${m.project.localFolderID}`)) === projectID)) {
    throw new Error("Project is unavailable. Refresh and try again.");
  }
  const links = owned.flatMap(m => visible(m.projectSection, ["bookmarks", "folders"]) ? [m.projectSection] : []);
  const saves = owned.flatMap(m => visible(m.savedItem, ["bookmarks"]) ? [m.savedItem] : []);
  const mutations = [];
  let deletedCount = 0;
  const timestamp = new Date(owned.reduce((latest, m) => Math.max(latest, (Date.parse(Object.values(m)[0]?.updatedAt || "") || 0) + 1), Date.now())).toISOString();
  const remove = (kind, record) => mutations.push({[kind]: {...record, updatedAt: timestamp, deletedAt: timestamp}});
  for (const key of new Set(input.items.map(evidenceKey))) {
    const memberships = links.filter(record => evidenceKey(record) === key);
    const selectedLinks = projectID ? memberships.filter(record => folderKey(record, userID) === projectID) : [];
    const remainingLinks = memberships.filter(record => !selectedLinks.includes(record));
    // A stale Unassigned view must never delete evidence that acquired a destination.
    if (!projectID && remainingLinks.length) throw new Error("Saved evidence now belongs to a Project. Refresh and try again.");
    if (projectID && !selectedLinks.length) continue;
    const selectedSaves = remainingLinks.length ? [] : saves.filter(record => evidenceKey(record) === key);
    selectedLinks.forEach(record => remove("projectSection", record));
    selectedSaves.forEach(record => remove("savedItem", record));
    if (selectedLinks.length || selectedSaves.length) deletedCount += 1;
  }
  return {mutations, deletedCount};
}
