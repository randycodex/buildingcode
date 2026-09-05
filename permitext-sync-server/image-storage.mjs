import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { resolveContainedPrivatePath } from "./private-path-containment.mjs";

export class ImageStorageProvider {
  constructor(name) {
    this.name = name;
  }

  async put() {
    throw new Error("Image storage does not support uploads.");
  }

  async get() {
    throw new Error("Image storage does not support downloads.");
  }

  async delete() {
    throw new Error("Image storage does not support deletion.");
  }

  async deleteMany(storageKeys) {
    for (const key of storageKeys) await this.delete(key);
  }

  async list(prefix) {
    throw new Error("Image storage does not support inventory.");
  }
}

export class LocalFilesystemImageStorage extends ImageStorageProvider {
  constructor(root) {
    super("local-filesystem");
    this.root = String(root || "").trim();
    if (!this.root) throw new Error("Local Notebook image storage requires a root directory.");
  }

  async put(storageKey, body) {
    const filePath = resolveContainedPrivatePath(this.root, storageKey);
    await mkdir(dirname(filePath), { recursive: true });
    try {
      await writeFile(filePath, body, { flag: "wx" });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const existing = await readFile(filePath);
      if (!existing.equals(body)) throw new Error("Notebook image storage key collision.");
    }
    return storageKey;
  }

  async get(storageKey) {
    try {
      return await readFile(resolveContainedPrivatePath(this.root, storageKey));
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(storageKey) {
    try {
      await unlink(resolveContainedPrivatePath(this.root, storageKey));
      return true;
    } catch (error) {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  }

  async list(prefix) {
    const directory = resolveContainedPrivatePath(this.root, prefix.replace(/\/$/, ""));
    try {
      // Current account-scoped Notebook keys contain files immediately inside
      // this directory. Never traverse links, nested directories, or other roots.
      const entries = await readdir(directory, { withFileTypes: true });
      if (entries.some((entry) => !entry.isFile())) throw new Error("Unexpected private-image storage entry requires review.");
      return entries.map((entry) => `${prefix}${entry.name}`);
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }
}

export class VercelBlobImageStorage extends ImageStorageProvider {
  constructor(loadBlobModule) {
    super("vercel-blob");
    this.loadBlobModule = loadBlobModule;
  }

  async put(storageKey, body, contentType) {
    const { put } = await this.loadBlobModule();
    const result = await put(storageKey, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType
    });
    return result.pathname || storageKey;
  }

  async get(storageKey) {
    const { get } = await this.loadBlobModule();
    const result = await get(storageKey, { access: "private" });
    if (!result?.stream) return null;
    const chunks = [];
    const reader = result.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }

  async delete(storageKey) {
    const { del } = await this.loadBlobModule();
    await del(storageKey);
    return true;
  }

  async deleteMany(storageKeys) {
    const { del } = await this.loadBlobModule();
    for (let index = 0; index < storageKeys.length; index += 100) await del(storageKeys.slice(index, index + 100));
  }

  async list(prefix) {
    const { list } = await this.loadBlobModule();
    const paths = [];
    const seen = new Set();
    let cursor;
    do {
      const page = await list({ prefix, ...(cursor ? { cursor } : {}) });
      for (const blob of page.blobs || []) {
        if (typeof blob.pathname !== "string" || !blob.pathname.startsWith(prefix)) throw new Error("Private-image inventory escaped its account prefix.");
        paths.push(blob.pathname);
      }
      if (!page.hasMore) break;
      if (!page.cursor || seen.has(page.cursor)) throw new Error("Private-image inventory pagination did not complete.");
      cursor = page.cursor;
      seen.add(cursor);
    } while (true);
    return paths;
  }
}

export function createImageStorageProvider({
  environment = process.env,
  localRoot,
  loadBlobModule,
  providerName = ""
} = {}) {
  const hosted = environment.VERCEL === "1" || Boolean(environment.VERCEL_ENV);
  const blobConfigured = Boolean(
    environment.BLOB_READ_WRITE_TOKEN ||
    (environment.VERCEL_OIDC_TOKEN && environment.BLOB_STORE_ID)
  );
  if (providerName === "vercel-blob") {
    return blobConfigured ? new VercelBlobImageStorage(loadBlobModule) : null;
  }
  if (providerName === "local-filesystem") {
    return !hosted && localRoot ? new LocalFilesystemImageStorage(localRoot) : null;
  }
  if (providerName) return null;
  if (blobConfigured) return new VercelBlobImageStorage(loadBlobModule);
  if (!hosted && localRoot) return new LocalFilesystemImageStorage(localRoot);
  return null;
}
