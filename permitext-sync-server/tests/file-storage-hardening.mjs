import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readJSONFile,
  withFileStoreLock,
  writeJSONFileAtomically
} from "../file-store-coordinator.mjs";
import { resolveContainedPrivatePath } from "../private-path-containment.mjs";
import { privateAssetPathContract } from "../app.mjs";

const root = await mkdtemp(join(tmpdir(), "permitext-file-store-"));
const dataPath = join(root, "data", "store.json");

try {
  await writeJSONFileAtomically(dataPath, { count: 0 });
  await Promise.all(Array.from({ length: 20 }, () =>
    withFileStoreLock(dataPath, async () => {
      const store = await readJSONFile(dataPath, { count: 0 });
      await new Promise((resolve) => setTimeout(resolve, 2));
      store.count += 1;
      await writeJSONFileAtomically(dataPath, store);
    })
  ));
  assert.equal(
    JSON.parse(await readFile(dataPath, "utf8")).count,
    20,
    "Concurrent local mutations lost updates."
  );

  const privateRoot = join(root, "private");
  assert.equal(
    resolveContainedPrivatePath(privateRoot, "project-assets/a/report.pdf"),
    join(privateRoot, "project-assets", "a", "report.pdf")
  );
  for (const pathname of [
    "../outside.pdf",
    "project-assets/../../outside.pdf",
    "/tmp/outside.pdf",
    "project-assets\\..\\outside.pdf",
    "\0outside.pdf"
  ]) {
    assert.throws(
      () => resolveContainedPrivatePath(privateRoot, pathname),
      /private project asset path/i,
      `Unsafe pathname was accepted: ${JSON.stringify(pathname)}`
    );
  }

  const userAWorkboard = privateAssetPathContract.workboardAssetPathname(
    "user-a", "shared-client-project-id", "image-1", "image/png"
  );
  const userBWorkboard = privateAssetPathContract.workboardAssetPathname(
    "user-b", "shared-client-project-id", "image-1", "image/png"
  );
  assert.notEqual(userAWorkboard, userBWorkboard, "Different accounts shared a Workboard object key.");
  assert.equal(
    privateAssetPathContract.workboardAssetPathBelongsToProject(
      userAWorkboard, "user-b", "shared-client-project-id"
    ),
    false,
    "A different account could claim another account's Workboard object key."
  );

  const userAPreview = privateAssetPathContract.workboardPreviewPathname(
    "user-a", "shared-client-project-id", "preview-1"
  );
  const userBPreview = privateAssetPathContract.workboardPreviewPathname(
    "user-b", "shared-client-project-id", "preview-1"
  );
  assert.notEqual(userAPreview, userBPreview, "Different accounts shared a Workboard preview key.");

  const userAReport = privateAssetPathContract.reportFilePathname(
    "user-a", "shared-client-project-id", "manifest-1", "report-1", "web-pdf"
  );
  const userBReport = privateAssetPathContract.reportFilePathname(
    "user-b", "shared-client-project-id", "manifest-1", "report-1", "web-pdf"
  );
  assert.notEqual(userAReport, userBReport, "Different accounts shared a Report PDF key.");
  assert.equal(
    privateAssetPathContract.reportFilePathBelongsToProject(
      userAReport, "user-b", "shared-client-project-id"
    ),
    false,
    "A different account could claim another account's Report PDF key."
  );

  const imageFixtures = [
    ["image/png", Buffer.from("89504e470d0a1a0a", "hex")],
    ["image/jpeg", Buffer.from("ffd8ffe00000ffd9", "hex")],
    ["image/gif", Buffer.from("GIF89a", "ascii")],
    ["image/webp", Buffer.from("RIFF\u0004\u0000\u0000\u0000WEBP", "binary")]
  ];
  for (const [contentType, fixture] of imageFixtures) {
    assert.equal(
      privateAssetPathContract.workboardAssetMatchesContentType(fixture, contentType),
      true,
      `${contentType} signature was rejected.`
    );
    assert.equal(
      privateAssetPathContract.workboardAssetMatchesContentType(Buffer.from("<script>"), contentType),
      false,
      `Arbitrary bytes were accepted as ${contentType}.`
    );
  }
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("Permitext file storage hardening passed.");
