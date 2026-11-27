import { syncCodeVersion, syncProjectIdentity } from "./public/sync-identity.js";
import { recordSurvivesBulkClear } from "./public/sync-state.js";
import { mergeProjectSectionSelection } from "./project-section-selections.mjs";

// The iPhone shows one row per provision, while the web may have several
// individually addressed passages for that provision in the same project.
export function planProjectEvidenceRemovals(userID, existing, incoming, trashEntries = []) {
  const additionalAcceptedIDs = [];
  const usedTrashEntries = new Set();
  const clears = existing.flatMap(({codeVersionClear}) => codeVersionClear ? [codeVersionClear] : []);
  const mutations = incoming.flatMap(mutation => {
    const action = mutation.projectSection;
    if (!action?.evidenceRemovalID) return [mutation];
    const timestamp = Date.parse(action.evidenceActionAt);
    const projectID = syncProjectIdentity(action.folderClientID, userID);
    const version = syncCodeVersion(action.codeVersion);
    const activeProject = existing.some(({project}) =>
      project?.userID === userID && !project.deletedAt && project.folderType !== "reference" &&
      syncProjectIdentity(project.clientID || project.id, userID) === projectID &&
      recordSurvivesBulkClear(project, clears, ["folders"]));
    const matching = activeProject ? existing.flatMap(({projectSection: link}) =>
      link?.userID === userID && syncCodeVersion(link.codeVersion) === version
      && String(link.sectionID) === String(action.sectionID)
      && recordSurvivesBulkClear(link, clears, ["bookmarks", "folders"])
      && syncProjectIdentity(link.folderClientID || link.localFolderID, userID) === projectID ? [link] : []) : [];
    let changes;
    if (action.deletedAt) {
      changes = matching.flatMap(link => {
        const previousTime = Date.parse(link.updatedAt);
        if (link.deletedAt || previousTime > timestamp) return [];
        const updatedAt = new Date(Math.max(timestamp, previousTime + 1)).toISOString();
        return [{ projectSection: mergeProjectSectionSelection(null, {
          ...link, updatedAt, deletedAt: updatedAt, evidenceRemovedBy: action.evidenceRemovalID
        }) }];
      });
    } else {
      changes = matching.flatMap(link => {
        if (!link.deletedAt || link.evidenceRemovedBy !== action.evidenceRemovalID) return [];
        for (const entry of trashEntries) {
          if (entry.userID !== userID || Date.parse(entry.expiresAt) <= Date.now()) continue;
          const item = entry.records.find(item => item.kind === "projectSection" &&
            item.record.id === link.id && item.evidenceRemovalID === action.evidenceRemovalID);
          if (!item) continue;
          usedTrashEntries.add(entry);
          const updatedAt = new Date(Math.max(timestamp, Date.parse(link.updatedAt) + 1)).toISOString();
          return [{ projectSection: mergeProjectSectionSelection(link, { ...item.record, updatedAt }) }];
        }
        return [];
      });
    }
    // A web-only provision may have no unscoped record to acknowledge.
    if (!changes.some(({projectSection}) => projectSection.id === action.id)) additionalAcceptedIDs.push(action.id);
    return changes;
  });
  return { mutations, additionalAcceptedIDs, usedTrashEntries: [...usedTrashEntries] };
}
