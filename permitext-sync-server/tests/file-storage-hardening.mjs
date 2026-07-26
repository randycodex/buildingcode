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
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("Permitext file storage hardening passed.");
