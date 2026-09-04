import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { artifactEnvelope, ownerScope, projectLinkRecord } from "../project-foundation-contract.mjs";

const pathHash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 32);

// Test-only import of records produced before Workboard retirement. There is no
// application endpoint for creating this fixture. Call with an idle test server.
export async function seedLegacyWorkboardPreview({ dataPath, privateAssetPath, userID, projectID, image }) {
  const store = JSON.parse(await readFile(dataPath, "utf8"));
  const id = "legacy-workboard-preview-fixture";
  const createdAt = "2026-07-24T12:00:00.000Z";
  const owner = ownerScope(userID);
  const pathname = `project-assets/${pathHash(projectID)}/workboard-previews/${pathHash(id)}.png`;
  const payload = {
    projectID,
    title: "Workboard preview",
    description: "3 Workboard elements",
    contentType: "image/png",
    contentHash: createHash("sha256").update(image).digest("hex"),
    pathname,
    size: image.length,
    elementCount: 3,
    workboardUpdatedAt: "2026-07-24T11:59:00.000Z",
    readPath: "/workboards/previews/read",
    createdAt
  };
  store.foundationArtifactsByUserID ||= {};
  store.foundationArtifactsByUserID[userID] ||= [];
  store.foundationArtifactsByUserID[userID].push({
    envelope: artifactEnvelope({ id, type: "workboardPreview", owner, createdAt }),
    payload
  });
  store.projectLinksByUserID ||= {};
  store.projectLinksByUserID[userID] ||= [];
  store.projectLinksByUserID[userID].push(projectLinkRecord({
    id: "legacy-workboard-preview-link-fixture", owner, projectID,
    targetKind: "workboardPreview", targetID: id, relationship: "owner", createdAt,
    metadata: { source: "web-workboard", workboardUpdatedAt: payload.workboardUpdatedAt }
  }));
  const assetPath = join(privateAssetPath, pathname);
  await mkdir(dirname(assetPath), { recursive: true });
  await writeFile(assetPath, image);
  await writeFile(dataPath, JSON.stringify(store));
  return { id, ...payload };
}

export async function seedLegacyWorkboardRecord(dataPath, mutation) {
  const store = JSON.parse(await readFile(dataPath, "utf8"));
  const { userID } = mutation.workboard;
  store.mutationsByUserID ||= {};
  store.mutationsByUserID[userID] ||= [];
  store.mutationsByUserID[userID].push(mutation);
  await writeFile(dataPath, JSON.stringify(store));
}
