import assert from "node:assert/strict";

const baseURL = String(process.env.PERMITEXT_SYNC_PREVIEW_URL || process.argv[2] || "")
  .trim()
  .replace(/\/+$/, "");

assert(baseURL, "Set PERMITEXT_SYNC_PREVIEW_URL or pass the Preview URL as the first argument.");

async function request(path, expectedStatus = 200) {
  const response = await fetch(`${baseURL}${path}`, { redirect: "manual" });
  const body = await response.text();
  assert.equal(response.status, expectedStatus, `${path} returned HTTP ${response.status}.`);
  return { response, body };
}

const root = await request("/");
assert.match(root.response.headers.get("content-type") || "", /text\/html/);
assert.match(root.body, /Permitext/i);

const app = await request("/web/app.js");
assert.match(app.response.headers.get("content-type") || "", /javascript/);
assert.match(app.response.headers.get("cache-control") || "", /immutable/);
assert(app.body.length > 100_000, "The static web client is unexpectedly small.");

const deepLink = await request("/open/section/1026");
assert.match(deepLink.response.headers.get("content-type") || "", /text\/html/);
assert.match(deepLink.body, /Permitext/i);

const privacy = await request("/privacy");
assert.match(privacy.response.headers.get("content-type") || "", /text\/html/);

const health = await request("/health");
assert.equal(JSON.parse(health.body)?.ok, true, "The Preview health endpoint is not healthy.");

const libraries = await request("/code/libraries");
assert.doesNotThrow(() => JSON.parse(libraries.body), "The code-library API did not return JSON.");

const association = await request("/.well-known/apple-app-site-association");
assert.doesNotThrow(() => JSON.parse(association.body), "The Apple association endpoint did not return JSON.");

const unknown = await request("/wp-login.php", 404);
assert.doesNotMatch(
  unknown.response.headers.get("content-type") || "",
  /^application\/json/,
  "Unknown bot traffic still appears to be handled by the application Function."
);

console.log(`Permitext Preview routing passed: ${baseURL}`);
