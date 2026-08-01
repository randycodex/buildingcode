import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
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
