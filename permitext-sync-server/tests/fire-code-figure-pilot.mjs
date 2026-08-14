import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handleRequest } from "../app.mjs";
import { resolveCodeAsset } from "../code-asset-store.mjs";
import { enactedSection } from "../enacted-code-content.mjs";

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const assetRoot = join(
  serverRoot,
  "..",
  "NYC CC APP",
  "permitext",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2026-enacted-administrative-code",
  "assets"
);

const figures = Object.freeze([
  {
    identifier: "FC Figure 503.2.7.2.1",
    fileName: "fire-code-figure-503-2-7-2-1-no-parking-fire-apparatus-access-road.png",
    sha256: "64fba97a516edd6db3141e59b315a49902a9e01d39e5f573c96127583f2c53d6",
    caption: "FC Figure 503.2.7.2.1 No Parking Sign — Fire Apparatus Access Road"
  },
  {
    identifier: "FC Figure 503.2.9",
    fileName: "fire-code-figure-503-2-9-dead-end-fire-apparatus-access-road-turnaround.png",
    sha256: "c2880daee1b386248b0af2fd5da21990010e37b7919dc4b3c487fab002cf363f",
    caption: "FC Figure 503.2.9 Dead-end Fire Apparatus Access Road Turnaround"
  },
  {
    identifier: "FC Figure 503.4.1",
    fileName: "fire-code-figure-503-4-1-fire-lane-sign.png",
    sha256: "42aef39f1f392e7725c7687413ddc73abc976d4fb868e4b73a766958073ff62d",
    caption: "FC Figure 503.4.1 Fire Lane Sign"
  }
]);

async function request(path) {
  const server = createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    return {
      status: response.status,
      mediaType: response.headers.get("content-type"),
      body: Buffer.from(await response.arrayBuffer())
    };
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

const body = await enactedSection(31_004_725);
assert(body, "FC 503 section body is missing.");
const html = (body.blocks || []).map((block) => block.html || "").join("\n");
assert.match(html, /503\.2\.7\.2\.1 Signage/);
assert.doesNotMatch(html, /backflow in accordance with Section 608/);

for (const figure of figures) {
  const local = await readFile(join(assetRoot, figure.fileName));
  assert.equal(createHash("sha256").update(local).digest("hex"), figure.sha256, `${figure.fileName} hash drifted.`);
  assert((await stat(join(assetRoot, figure.fileName))).size > 1000, `${figure.fileName} is implausibly small.`);
  assert(html.includes(figure.fileName), `FC 503 is missing ${figure.fileName}.`);
  assert(html.includes(`alt="${figure.caption}"`), `FC 503 is missing official alt text for ${figure.identifier}.`);
  assert.equal((html.match(new RegExp(figure.fileName, "g")) || []).length, 2, `${figure.fileName} was inserted more than once.`);

  const resolved = await resolveCodeAsset(figure.fileName);
  assert.equal(resolved.rootId, "2026-enacted-administrative-code");
  const served = await request(`/code/assets/${encodeURIComponent(figure.fileName)}`);
  assert.equal(served.status, 200, `${figure.fileName} is not web-served.`);
  assert.equal(served.mediaType, "image/png");
  assert.equal(createHash("sha256").update(served.body).digest("hex"), figure.sha256);
}

const missing = await request("/code/assets/fire-code-figure-does-not-exist.png");
assert.equal(missing.status, 404);

const section = await request("/code/sections/31004725");
assert.equal(section.status, 200);
const servedHTML = JSON.parse(section.body.toString("utf8")).section.blocks.map((block) => block.html || "").join("\n");
for (const figure of figures) {
  assert(servedHTML.includes(figure.fileName), `Served FC 503 omitted ${figure.fileName}.`);
}

console.log("permitext fire code figure pilot passed", {
  sectionID: 31004725,
  figures: figures.length
});
