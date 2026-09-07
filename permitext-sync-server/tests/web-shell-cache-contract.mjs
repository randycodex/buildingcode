import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { getTransformedRoutes } from "@vercel/routing-utils";
import { handleRequest, webStaticCacheControl } from "../app.mjs";

const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const { routes, error } = getTransformedRoutes({ headers: config.headers });
assert.equal(error, null, "Vercel's route compiler must accept the header configuration");

// Match the actual Vercel-compiled paths and query conditions in declaration
// order. The hosted preview header matrix separately checks platform behavior.
export function compiledCacheControl(path) {
  const url = new URL(path, "https://permitext.test");
  let cacheControl;
  for (const route of routes) {
    if (!new RegExp(route.src).test(url.pathname)) continue;
    if (route.has?.some((condition) => {
      assert.equal(condition.type, "query");
      const value = url.searchParams.get(condition.key);
      return value === null || (condition.value && !new RegExp(`^(?:${condition.value})$`).test(value));
    })) continue;
    for (const [key, value] of Object.entries(route.headers || {})) {
      if (key.toLowerCase() === "cache-control") cacheControl = value;
    }
  }
  return cacheControl;
}

const revalidate = "public, max-age=0, must-revalidate";
const immutable = "public, max-age=31536000, s-maxage=31536000, immutable";
for (const path of ["/", "/index.html", "/web", "/web/", "/web/index.html", "/open/section/303", "/web/privacy.html"]) {
  for (const query of ["", "?v=release-55", "?clerk_return=1"]) {
    assert.equal(compiledCacheControl(path + query), revalidate, `HTML must revalidate: ${path + query}`);
  }
}
for (const asset of ["app.js", "styles.css", "icons/permitext-192.png", "manifest.webmanifest", "fonts/font.woff2", "nested/client.js"]) {
  assert.equal(compiledCacheControl(`/web/${asset}?v=release-55`), immutable);
  assert.equal(compiledCacheControl(`/web/${asset}`), revalidate);
  assert.equal(compiledCacheControl(`/web/${asset}?v=`), revalidate);
  assert.equal(webStaticCacheControl(asset, "release-55"), immutable);
  assert.equal(webStaticCacheControl(asset, null), revalidate);
}
assert.equal(webStaticCacheControl("index.html", "release-55"), revalidate);
assert.equal(compiledCacheControl("/service-worker.js"), "no-cache");
assert.equal(compiledCacheControl("/account/data/export"), undefined, "Do not override private account caching");
assert.equal(compiledCacheControl("/notebook/assets/read?v=anything"), undefined, "Version-looking private URLs are not public assets");

const server = createServer(handleRequest);
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [path, expected] of [
    ["/web", "no-store"], ["/web/", "no-store"],
    ["/web/index.html?v=release-55", revalidate],
    ["/web/app.js", revalidate], ["/web/app.js?v=release-55", immutable],
    ["/web/styles.css?v=release-55", immutable], ["/service-worker.js", "no-cache"]
  ]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("cache-control"), expected, path);
    await response.arrayBuffer();
  }
} finally {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
console.log("Web shell caching passed: compiled Vercel HTML/query/asset matrix and actual local HTTP headers.");
