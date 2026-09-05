import { createHash } from "node:crypto";
import { syncProjectIdentity } from "./public/sync-identity.js";

const hash = (value) => createHash("sha256").update(String(value)).digest("hex").slice(0, 32);
const projectPrefix = (projectID, kind) => `project-assets/${hash(projectID)}/${kind}/`;

function privatePath(value) {
  if (typeof value !== "string" || value !== value.trim()) return false;
  if (value.split("/").some((part) => !part || part === "." || part === ".." || !/^[a-zA-Z0-9._-]+$/.test(part))) return false;
  return /^project-assets\/[a-f0-9]{32}\//.test(value) || /^workboards\/[a-f0-9]{32}\/[a-f0-9]{32}\//.test(value);
}

function ownershipError() {
  return Object.assign(new Error("Private-file ownership could not be established. Retain the account and resolve the historical asset metadata before retrying cleanup."), {
    code: "PRIVATE_ASSET_OWNERSHIP_UNRESOLVED"
  });
}

export function binaryAssetPathnames(artifacts, mutations) {
  const paths = new Set();
  const add = (value) => { if (typeof value === "string" && value) paths.add(value); };
  for (const { envelope, payload = {} } of artifacts) {
    if (envelope?.type === "notebookImageAsset") add(payload.storageKey);
    if (envelope?.type === "workboardPreview") add(payload.pathname);
    if (envelope?.type === "generatedReport") {
      add(payload.file?.pathname);
      for (const file of payload.files || []) add(file.pathname);
    }
  }
  for (const { workboard } of mutations) {
    for (const asset of Object.values(workboard?.assets || {})) add(asset?.pathname);
  }
  return [...paths];
}

export function sameNotebookImage(existing, candidate) {
  return existing?.envelope?.type === "notebookImageAsset" && !existing.envelope.deletedAt &&
    ["projectID", "storageKey", "storageProvider", "contentHash", "contentType", "size", "uploadedBy"]
      .every((key) => existing.payload?.[key] === candidate.payload?.[key]);
}

export function notebookImageConflict() {
  return Object.assign(new Error("This Notebook image identity is already in use."), {
    code: "NOTEBOOK_IMAGE_ID_CONFLICT", statusCode: 409
  });
}

export function accountNotebookUploadPrefixes(exported) {
  const owners = new Set([exported.userID]);
  for (const { name, checkpoint } of exported.records.migrationCheckpoints) {
    if (name === "confirmed-account-link-recovery-v1") {
      for (const id of checkpoint?.sourceUserIDs || []) if (typeof id === "string" && id) owners.add(id);
    }
  }
  const projectIDs = new Set(exported.records.projectLinks.map((link) => link.projectID));
  for (const ownership of exported.records.projectOwnerships) projectIDs.add(ownership.projectID);
  for (const { project } of exported.mutations) {
    if (!project) continue;
    projectIDs.add(syncProjectIdentity(project.clientID, exported.userID) || syncProjectIdentity(project.id, exported.userID));
    if (project.localFolderID != null) projectIDs.add(`legacy-project-${project.localFolderID}`);
  }
  for (const { envelope, payload } of exported.records.foundationArtifacts) {
    if (envelope?.type === "notebookImageAsset") projectIDs.add(payload?.projectID);
  }
  return [...projectIDs].filter((id) => typeof id === "string" && id).flatMap((projectID) =>
    [...owners].map((owner) => `${projectPrefix(projectID, "notebook")}${hash(owner)}/`));
}

export async function postgresPrivateAssetOwnerConflicts(sql, userID, pathnames) {
  if (!pathnames.length) return [];
  // Return conflicting pathnames only, never another customer's content or ID.
  // Narrative/card references are not binary ownership claims.
  const rows = await sql`
    SELECT DISTINCT pathname FROM (
      SELECT user_id, payload->>'storageKey' AS pathname FROM permitext_foundation_artifacts WHERE artifact_type = 'notebookImageAsset'
      UNION ALL SELECT user_id, payload->>'pathname' FROM permitext_foundation_artifacts WHERE artifact_type = 'workboardPreview'
      UNION ALL SELECT user_id, payload->'file'->>'pathname' FROM permitext_foundation_artifacts WHERE artifact_type = 'generatedReport'
      UNION ALL SELECT user_id, file.value->>'pathname' FROM permitext_foundation_artifacts
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(payload->'files') = 'array' THEN payload->'files' ELSE '[]'::jsonb END) AS file
        WHERE artifact_type = 'generatedReport'
      UNION ALL SELECT user_id, asset.value->>'pathname' FROM permitext_user_content_records
        CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(mutation->'workboard'->'assets') = 'object' THEN mutation->'workboard'->'assets' ELSE '{}'::jsonb END) AS asset
        WHERE entity_kind = 'workboard'
    ) AS claims WHERE user_id <> ${userID} AND pathname = ANY(${pathnames}::text[])
  `;
  return rows.map((row) => row.pathname);
}

// The input is an operator/server-created account snapshot, never request JSON.
// Enumerate binary metadata fields explicitly. Authored notes, titles, answers,
// report text, and arbitrary nested strings cannot authorize file deletion.
export function privateAssetsFromAccountRecords(exported) {
  const userID = exported.userID;
  const { foundationArtifacts: artifacts, projectLinks, projectOwnerships, migrationCheckpoints } = exported.records;
  const assets = new Map();
  function add(pathname, expectedPrefix, storageProvider = "") {
    if (!privatePath(pathname) || !expectedPrefix || !pathname.startsWith(expectedPrefix)) throw ownershipError();
    const previous = assets.get(pathname);
    if (previous && previous.storageProvider && storageProvider && previous.storageProvider !== storageProvider) throw ownershipError();
    assets.set(pathname, { pathname, storageProvider: storageProvider || previous?.storageProvider || "" });
  }
  const manifests = new Map(artifacts.filter((artifact) => artifact.envelope?.type === "reportManifest")
    .map((artifact) => [artifact.envelope.id, artifact.payload]));
  for (const artifact of artifacts) {
    const { envelope, payload = {} } = artifact;
    if (envelope?.type === "notebookImageAsset") {
      if (!payload.storageKey) continue;
      const extension = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" }[payload.contentType];
      const suffix = payload.storageKey.slice(projectPrefix(payload.projectID, "notebook").length);
      const expectedFile = `${hash(envelope.id)}.${extension}`;
      const scopedSuffix = suffix.split("/");
      const matchingFile = suffix === expectedFile || (scopedSuffix.length === 2 && /^[a-f0-9]{32}$/.test(scopedSuffix[0]) && scopedSuffix[1] === expectedFile);
      if (!payload.projectID || !envelope.id || !extension || !matchingFile) throw ownershipError();
      add(payload.storageKey, projectPrefix(payload.projectID, "notebook"), payload.storageProvider);
    } else if (envelope?.type === "workboardPreview" && payload.pathname) {
      if (!payload.projectID || !payload.pathname.endsWith(".png")) throw ownershipError();
      add(payload.pathname, projectPrefix(payload.projectID, "workboard-previews"));
    } else if (envelope?.type === "generatedReport") {
      const files = [...(payload.file ? [payload.file] : []), ...(payload.files || [])];
      const projectID = manifests.get(payload.manifestID)?.project?.id;
      for (const file of files) {
        if (!file.pathname) continue;
        if (!projectID || !payload.manifestID || !/\.(?:pdf|html|json)$/.test(file.pathname)) throw ownershipError();
        add(file.pathname, `${projectPrefix(projectID, "reports")}${hash(payload.manifestID)}/`);
      }
    }
  }

  // Issuance writes deterministic report files before committing its artifacts.
  // A failed attempt can therefore leave files represented only by the pending
  // server record. The stagedObjectKey is bookkeeping; no staged bytes are written.
  const questions = new Map(artifacts.filter((artifact) => artifact.envelope?.type === "codeQuestion")
    .map((artifact) => [artifact.envelope.id, artifact.payload]));
  for (const pending of exported.records.codeQuestionPendingIssuance) {
    if (!pending.manifestID) continue;
    const projectID = questions.get(pending.questionID)?.projectID;
    if (!projectID) throw ownershipError();
    const prefix = `${projectPrefix(projectID, "reports")}${hash(pending.manifestID)}/`;
    for (const extension of ["pdf", "html", "json"]) add(`${prefix}code-memo.${extension}`, prefix);
  }

  // Old Workboard keys include the storage owner's hash. Confirmed account-link
  // ancestry retains authority over those old keys after an account merge.
  const legacyOwners = new Set([userID]);
  for (const { name, checkpoint } of migrationCheckpoints) {
    if (name === "confirmed-account-link-recovery-v1") {
      for (const id of checkpoint?.sourceUserIDs || []) if (typeof id === "string" && id) legacyOwners.add(id);
    }
  }
  // A Project identifier from a client-authored mutation is not ownership proof.
  // Historical Project-only paths need the server's ownership registry, or a
  // matching binary record already found above. Unknown history stops cleanup.
  const registeredProjects = new Set(projectOwnerships
    .filter((ownership) => ownership.storageOwnerUserID === userID)
    .map((ownership) => ownership.projectID));
  function addLegacy(pathname, projectIDs, kind) {
    if (assets.has(pathname)) return;
    if (!privatePath(pathname)) throw ownershipError();
    for (const projectID of projectIDs) {
      if (!projectID) continue;
      if (registeredProjects.has(projectID) && pathname.startsWith(projectPrefix(projectID, kind))) {
        add(pathname, projectPrefix(projectID, kind));
        return;
      }
      if (kind === "workboards") {
        for (const ownerID of legacyOwners) {
          const prefix = `workboards/${hash(ownerID)}/${hash(projectID)}/`;
          if (pathname.startsWith(prefix)) { add(pathname, prefix); return; }
        }
      }
    }
    throw ownershipError();
  }
  for (const artifact of artifacts) {
    if (!["notebookCard", "projectNote"].includes(artifact.envelope?.type)) continue;
    const projectIDs = projectLinks.filter((link) => link.targetID === artifact.envelope.id && link.targetKind === artifact.envelope.type)
      .map((link) => link.projectID);
    if (artifact.envelope.type === "projectNote" && artifact.payload?.projectID) projectIDs.push(artifact.payload.projectID);
    for (const identity of artifact.payload?.imageAssets || []) {
      if (typeof identity !== "string") continue;
      let pathname = identity;
      try { pathname = decodeURIComponent(identity); } catch { /* Validate the literal below. */ }
      if (pathname.startsWith("project-assets/")) addLegacy(pathname, projectIDs, "notebook");
    }
  }
  for (const mutation of exported.mutations) {
    const board = mutation.workboard;
    if (!board) continue;
    for (const asset of Object.values(board.assets || {})) {
      if (asset?.pathname) addLegacy(asset.pathname, [board.projectID], "workboards");
    }
  }
  return [...assets.values()].sort((a, b) => a.pathname.localeCompare(b.pathname));
}
