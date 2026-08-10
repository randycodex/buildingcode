import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  rename,
  stat,
  unlink,
  utimes
} from "node:fs/promises";
import { dirname } from "node:path";

const defaultLockTimeoutMilliseconds = 10_000;
const defaultLockStaleMilliseconds = 60_000;
const defaultRetryMilliseconds = 10;
const heldLocks = new AsyncLocalStorage();

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function removeStaleLock(lockPath, staleMilliseconds, now) {
  try {
    const lockStat = await stat(lockPath);
    if (now() - lockStat.mtimeMs <= staleMilliseconds) return false;
    await unlink(lockPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
}

export async function withFileStoreLock(dataPath, operation, options = {}) {
  const held = heldLocks.getStore();
  if (held?.has(dataPath)) {
    // Same async context already owns this lock (outer request lock + adapter mutation).
    return operation();
  }

  const lockPath = `${dataPath}.lock`;
  const timeoutMilliseconds =
    options.timeoutMilliseconds ?? defaultLockTimeoutMilliseconds;
  const staleMilliseconds =
    options.staleMilliseconds ?? defaultLockStaleMilliseconds;
  const retryMilliseconds =
    options.retryMilliseconds ?? defaultRetryMilliseconds;
  const now = options.now || Date.now;
  const startedAt = now();
  await mkdir(dirname(dataPath), { recursive: true });

  let handle;
  const ownerToken = randomUUID();
  while (!handle) {
    try {
      handle = await open(lockPath, "wx", 0o600);
      await handle.writeFile(JSON.stringify({
        ownerToken,
        pid: process.pid,
        acquiredAt: new Date(now()).toISOString()
      }));
      await handle.sync();
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (await removeStaleLock(lockPath, staleMilliseconds, now)) continue;
      if (now() - startedAt >= timeoutMilliseconds) {
        const timeoutError = new Error("Timed out waiting for the local Permitext data lock.");
        timeoutError.code = "FILE_STORE_LOCK_TIMEOUT";
        throw timeoutError;
      }
      await wait(retryMilliseconds);
    }
  }

  const heartbeat = setInterval(() => {
    const timestamp = new Date();
    void utimes(lockPath, timestamp, timestamp).catch(() => {});
  }, Math.max(1_000, Math.floor(staleMilliseconds / 3)));
  heartbeat.unref();
  const nextHeld = new Set(held || []);
  nextHeld.add(dataPath);
  try {
    return await heldLocks.run(nextHeld, operation);
  } finally {
    clearInterval(heartbeat);
    await handle.close();
    try {
      const currentLock = JSON.parse(await readFile(lockPath, "utf8"));
      if (currentLock.ownerToken === ownerToken) {
        await unlink(lockPath);
      }
    } catch (error) {
      if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
  }
}

export async function writeJSONFileAtomically(dataPath, value) {
  await mkdir(dirname(dataPath), { recursive: true });
  const temporaryPath = `${dataPath}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporaryPath, dataPath);
  } catch (error) {
    try {
      await unlink(temporaryPath);
    } catch (cleanupError) {
      if (cleanupError?.code !== "ENOENT") throw cleanupError;
    }
    throw error;
  }
}

export async function readJSONFile(dataPath, fallback) {
  try {
    return JSON.parse(await readFile(dataPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}
