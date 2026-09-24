import { createHash } from "node:crypto";

/** Process-local cache for successful, public, bundled code representations. */
export function createPublicCodeResponseCache({ maxBytes = 32 * 1024 * 1024, maxEntries = 256, maxEntryBytes = 2 * 1024 * 1024 } = {}) {
  for (const [name, value] of Object.entries({ maxBytes, maxEntries, maxEntryBytes })) {
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a nonnegative integer`);
  }
  const entries = new Map();
  let bytes = 0;
  const remove = key => {
    const previous = entries.get(key);
    if (!previous) return;
    bytes -= previous.bytes;
    entries.delete(key);
  };
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key);
      entries.set(key, entry);
      return entry;
    },
    set(key, payload, { status = 200 } = {}) {
      // Only successful public representations belong here. Errors are sent by
      // the route's existing error path and can never replace a cached success.
      if (status !== 200) return null;
      const body = JSON.stringify(payload);
      if (typeof body !== "string") throw new TypeError("Public response must serialize to JSON");
      const size = Buffer.byteLength(body, "utf8");
      const revision = createHash("sha256").update(body, "utf8").digest("hex");
      const entry = Object.freeze({ body, bytes: size, revision, etag: `"${revision}"` });
      remove(key);
      if (size > maxEntryBytes || size > maxBytes || maxEntries === 0) return entry;
      while (entries.size >= maxEntries || bytes + size > maxBytes) remove(entries.keys().next().value);
      entries.set(key, entry);
      bytes += size;
      return entry;
    },
    get size() { return entries.size; },
    get bytes() { return bytes; },
  };
}

function matchesIfNoneMatch(header, etag) {
  const value = Array.isArray(header) ? header.join(",") : String(header || "");
  // Entity tags are quoted strings: commas inside a tag are not separators.
  const pattern = /(?:W\/)?"[^"\r\n]*"|\*/g;
  const candidates = value.match(pattern) || [];
  if (value.replace(pattern, "").replace(/[\s,]/g, "")) return false;
  return candidates.some(candidate => candidate === "*" || candidate.replace(/^W\//, "") === etag);
}

/** Only call from explicitly public code GET/HEAD routes, never private APIs. */
export function sendPublicCodeResponse(request, response, entry, securityHeaders = {}) {
  const url = new URL(request.url, "http://public-code.invalid");
  const requestedRevisions = url.searchParams.getAll("contentRevision");
  const revisionRequested = requestedRevisions.length > 0;
  const revisionMatches = requestedRevisions.length === 1 && requestedRevisions[0] === entry.revision;
  if (revisionRequested && !revisionMatches) {
    response.writeHead(409, {
      ...securityHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(request.method === "HEAD" ? undefined : JSON.stringify({ error: "Public code representation changed. Request its current revision." }));
    return;
  }
  const headers = {
    ...securityHeaders,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": revisionMatches ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate",
    ETag: entry.etag,
    Vary: "Accept-Encoding",
  };
  if (matchesIfNoneMatch(request.headers?.["if-none-match"], entry.etag)) {
    response.writeHead(304, headers);
    response.end();
    return;
  }
  response.writeHead(200, headers);
  response.end(request.method === "HEAD" ? undefined : entry.body);
}
