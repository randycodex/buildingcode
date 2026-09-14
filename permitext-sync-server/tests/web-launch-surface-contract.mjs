import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";

const publicRoot = new URL("../public/", import.meta.url);
const publicHTMLFiles = (await readdir(publicRoot))
  .filter((name) => name.endsWith(".html"))
  .sort();

for (const fileName of publicHTMLFiles) {
  const html = await readFile(new URL(fileName, publicRoot), "utf8");
  assert.match(html, /<title>[^<]+<\/title>/, `${fileName} is missing a page title.`);
  assert.match(
    html,
    /<meta name="description" content="[^"]+">/,
    `${fileName} is missing a meta description.`
  );
  assert.match(html, /<link rel="icon" href="\/favicon\.ico" sizes="any">/);
  assert.match(html, /<link rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32\.png">/);
  assert.match(html, /<link rel="icon" type="image\/png" sizes="16x16" href="\/favicon-16\.png">/);
}

for (const fileName of ["index.html", "privacy.html", "terms.html", "refunds.html", "support.html"]) {
  const html = await readFile(new URL(fileName, publicRoot), "utf8");
  assert.match(html, /<link rel="canonical" href="https:\/\/permitext\.com\/[^"]*">/);
  assert.match(html, /<meta property="og:title" content="[^"]+">/);
  assert.match(html, /<meta property="og:description" content="[^"]+">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/permitext\.com\/og-image\.png">/);
  assert.match(html, /<meta property="og:image:width" content="1200">/);
  assert.match(html, /<meta property="og:image:height" content="630">/);
  assert.match(html, /<meta property="og:image:alt" content="[^"]+">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
}

for (const fileName of ["404.html", "subscription-confirmation.html"]) {
  const html = await readFile(new URL(fileName, publicRoot), "utf8");
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
}

const notFound = await readFile(new URL("404.html", publicRoot), "utf8");
assert.match(notFound, /Error 404/);
assert.match(notFound, /href="\/">Return to Permitext<\/a>/);
assert.match(notFound, /href="\/support">Contact support<\/a>/);

const robots = await readFile(new URL("robots.txt", publicRoot), "utf8");
assert.match(robots, /^User-agent: \*$/m);
assert.match(robots, /^Allow: \/$/m);
assert.match(robots, /^Disallow: \/account\/$/m);
assert.match(robots, /^Disallow: \/subscription-confirmation$/m);
assert.match(robots, /^Sitemap: https:\/\/permitext\.com\/sitemap\.xml$/m);

const sitemap = await readFile(new URL("sitemap.xml", publicRoot), "utf8");
for (const path of ["", "privacy", "terms", "refunds", "support"]) {
  assert.match(sitemap, new RegExp(`<loc>https://permitext\\.com/${path}<\\/loc>`));
}
assert.doesNotMatch(sitemap, /subscription-confirmation/);

function pngDimensions(bytes) {
  assert.equal(bytes.toString("ascii", 1, 4), "PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

for (const [fileName, width, height, maximumBytes] of [
  ["favicon-16.png", 16, 16, 8_000],
  ["favicon-32.png", 32, 32, 12_000],
  ["og-image.png", 1200, 630, 150_000]
]) {
  const path = new URL(fileName, publicRoot);
  assert.deepEqual(pngDimensions(await readFile(path)), { width, height });
  assert((await stat(path)).size <= maximumBytes, `${fileName} exceeds its compressed-size budget.`);
}

const favicon = await readFile(new URL("favicon.ico", publicRoot));
assert.equal(favicon.readUInt16LE(0), 0);
assert.equal(favicon.readUInt16LE(2), 1);
assert((await stat(new URL("favicon.ico", publicRoot))).size <= 12_000);

const webClient = await readFile(new URL("app.js", publicRoot), "utf8");
assert.match(webClient, /const authoredAlt = image\.getAttribute\("alt"\)\?\.trim\(\);/);
assert.match(webClient, /const accessibleLabel = image\.getAttribute\("aria-label"\)\?\.trim\(\);/);
assert.match(webClient, /const caption = image\.closest\("figure"\)\?\.querySelector\("figcaption"\)/);
assert.match(webClient, /`Official code figure: \$\{sourceName\}`/);
assert.doesNotMatch(webClient, /image\.alt = image\.alt \|\| "";/);

console.log(`Permitext web launch surface passed (${publicHTMLFiles.length} HTML documents).`);
