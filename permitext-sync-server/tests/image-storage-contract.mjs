import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LocalFilesystemImageStorage,
  VercelBlobImageStorage,
  createImageStorageProvider
} from "../image-storage.mjs";

const root = await mkdtemp(join(tmpdir(), "permitext-notebook-images-"));
try {
  const storage = new LocalFilesystemImageStorage(root);
  const key = "project-assets/project/notebook/image.png";
  const source = Buffer.from("private notebook image");
  assert.equal(await storage.put(key, source, "image/png"), key);
  assert.equal(await storage.put(key, source, "image/png"), key, "Identical retries must be idempotent.");
  await assert.rejects(
    () => storage.put(key, Buffer.from("different image"), "image/png"),
    /collision/i
  );
  assert.deepEqual(await storage.get(key), source);
  assert.deepEqual(await storage.list("project-assets/project/notebook/"), [key]);
  assert.equal(await storage.delete(key), true);
  assert.equal(await storage.get(key), null);
  await assert.rejects(() => storage.put("../outside.png", source), /private project asset path/i);

  assert.equal(
    createImageStorageProvider({
      environment: { VERCEL: "1" },
      localRoot: root,
      loadBlobModule: async () => ({})
    }),
    null,
    "Hosted deployments must not fall back to ephemeral filesystem storage."
  );
  assert.equal(
    createImageStorageProvider({ environment: {}, localRoot: root }).name,
    "local-filesystem"
  );
  assert.equal(
    createImageStorageProvider({ environment: {}, localRoot: root, providerName: "local-filesystem" }).name,
    "local-filesystem"
  );
  assert.equal(
    createImageStorageProvider({ environment: {}, localRoot: root, providerName: "vercel-blob" }),
    null,
    "A named provider must never silently fall back to a different backend."
  );
  const pages = [], deletions = [];
  const prefix = "project-assets/project/notebook/account/";
  const blob = new VercelBlobImageStorage(async () => ({
    list: async (options) => {
      pages.push(options);
      return options.cursor
        ? { blobs: [{ pathname: prefix + "second.png" }], hasMore: false }
        : { blobs: [{ pathname: prefix + "first.png" }], hasMore: true, cursor: "next-page" };
    },
    del: async (keys) => deletions.push(keys)
  }));
  assert.deepEqual(await blob.list(prefix), [prefix + "first.png", prefix + "second.png"]);
  assert.deepEqual(pages, [{ prefix }, { prefix, cursor: "next-page" }]);
  await blob.deleteMany(Array.from({ length: 201 }, (_, index) => prefix + index));
  assert.deepEqual(deletions.map((batch) => batch.length), [100, 100, 1]);
  const invalidInventory = new VercelBlobImageStorage(async () => ({ list: async () => ({ blobs: [{ pathname: "other-account/image.png" }] }) }));
  await assert.rejects(invalidInventory.list(prefix), /escaped/);
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("Permitext Notebook image storage contract passed.");
