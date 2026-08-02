import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const configuration = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const rewrites = new Map((configuration.rewrites || []).map(({ source, destination }) => [source, destination]));

assert.equal(
  rewrites.get("/(.*)"),
  undefined,
  "A universal Function rewrite would send static assets, unknown paths, and bot traffic through Fluid Compute."
);

for (const source of ["/web", "/web/", "/detached-workboard", "/open/section/:path*"]) {
  assert.equal(rewrites.get(source), "/index.html", `${source} must resolve to the static app shell.`);
}
for (const source of ["/privacy", "/privacy/"]) {
  assert.equal(rewrites.get(source), "/privacy.html", `${source} must resolve to the static privacy document.`);
}
assert.equal(
  rewrites.get("/web/:path*"),
  "/:path*",
  "The legacy /web asset namespace must map to files in the static output root."
);

const dynamicRoutes = [
  "/.well-known/apple-app-site-association",
  "/health",
  "/account/:path*",
  "/admin/:path*",
  "/billing/:path*",
  "/code/:path*",
  "/internal",
  "/internal/:path*",
  "/notebook/:path*",
  "/organizations/:path*",
  "/projects/:path*",
  "/reports/:path*",
  "/research/:path*",
  "/sync/:path*",
  "/workboards/:path*"
];
for (const source of dynamicRoutes) {
  assert.equal(rewrites.get(source), "/api/index", `${source} must remain on the dynamic request handler.`);
}

const headers = new Map((configuration.headers || []).map(({ source, headers: values }) => [
  source,
  new Map(values.map(({ key, value }) => [key.toLowerCase(), value]))
]));
assert.match(
  headers.get("/web/:path*")?.get("cache-control") || "",
  /immutable/,
  "Versioned /web assets must remain immutable at the edge."
);
assert.equal(
  headers.get("/service-worker.js")?.get("service-worker-allowed"),
  "/",
  "The root service worker must retain root scope."
);
for (const source of ["/", "/:path*"]) {
  assert.match(headers.get(source)?.get("content-security-policy") || "", /default-src 'self'/);
  assert.equal(headers.get(source)?.get("x-frame-options"), "DENY");
}

console.log("Permitext Vercel routing contract passed.");
