import {createHmac, timingSafeEqual} from "node:crypto";
import {webAppVersion, webSyncProtocol, webSyncProtocolHeader, webUpdateRequiredCode} from "./public/web-client-version.js";

const guardedReads = new Set(["sync/checkpoint", "sync/pull", "projects/artifacts/checkpoint"]);
const readbackCookie = "permitext_legacy_readback";
export const legacyReadbackMilliseconds = 15_000;

function header(request, name) {
  const value = request.headers?.[name.toLowerCase()] ?? request.headers?.get?.(name);
  return typeof value === "string" ? value : "";
}
export function isWebSyncRequest(request) {
  // This is a compatibility/cost gate, never an authorization decision. Native
  // URLSession requests omit browser Origin and Sec-Fetch-Site headers.
  return Boolean(header(request, "origin") || header(request, "sec-fetch-site") ||
    /(?:Mozilla\/|AppleWebKit\/|Chrome\/|Firefox\/)/.test(header(request, "user-agent")));
}
function isCurrentWeb(request) {
  return header(request, webSyncProtocolHeader) === webSyncProtocol;
}
function readbackSignature(request, expires) {
  // Bind the short readback hint to this same credential. It grants no access:
  // allowed reads still pass the normal rate limiter and account authorization.
  const credential = header(request, "authorization");
  if (!credential) return "";
  return createHmac("sha256", credential).update(`permitext-readback:${expires}`).digest("base64url");
}
export function legacyReadbackAllowed(request, now = Date.now()) {
  const raw = header(request, "cookie").split(";").map(value => value.trim())
    .find(value => value.startsWith(`${readbackCookie}=`))?.slice(readbackCookie.length + 1) || "";
  const [expiry, signature, extra] = raw.split(".");
  const expires = Number(expiry);
  if (extra || !Number.isSafeInteger(expires) || expires <= now || expires - now > legacyReadbackMilliseconds) return false;
  const expected = readbackSignature(request, expiry);
  if (!expected || signature?.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
function preserveLegacyWriteReadback(request, response, now) {
  const writeHead = response.writeHead;
  response.writeHead = function(status, ...args) {
    if (Number(status) >= 200 && Number(status) < 300 && !this.headersSent) {
      const expires = String(now() + legacyReadbackMilliseconds);
      const signature = readbackSignature(request, expires);
      if (signature) {
        const secure = header(request, "x-forwarded-proto").split(",")[0].trim() === "https" || header(request, "origin").startsWith("https:");
        const cookie = `${readbackCookie}=${expires}.${signature}; Max-Age=15; Path=/sync/pull; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
        const previous = this.getHeader("set-cookie");
        this.setHeader("Set-Cookie", [...(Array.isArray(previous) ? previous : previous ? [previous] : []), cookie]);
      }
    }
    return writeHead.call(this, status, ...args);
  };
}

export function applyWebSyncSafeguard(request, response, path, now = Date.now) {
  if (request.method !== "POST" || !isWebSyncRequest(request) || isCurrentWeb(request)) return false;
  if (path === "sync/push") {
    // Old web saves are unchanged. Their successful acknowledgment permits the
    // immediate readback that those clients require, across server instances.
    preserveLegacyWriteReadback(request, response, now);
    return false;
  }
  if (!guardedReads.has(path) || path === "sync/pull" && legacyReadbackAllowed(request, now())) return false;
  // Must run before rate limiting, account guards, store initialization or locks.
  // Never return a fake empty sync snapshot: that could erase local content.
  response.writeHead(426, {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store", "X-Permitext-Update-Required":"1"});
  response.end(JSON.stringify({code:webUpdateRequiredCode, webAppVersion,
    error:"A newer Permitext version is available. Your saves remain enabled. Finish saving, then reload Permitext to receive updates."}));
  return true;
}
