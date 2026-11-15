import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rewriteCodeAssetURLs } from "../code-asset-store.mjs";

const temporary = await mkdtemp(join(tmpdir(), "percodes-zoning-http-"));
process.env.NODE_ENV = "test";
process.env.PERMITEXT_SYNC_DATA_PATH = join(temporary, "store.json");
for (const name of ["DATABASE_URL", "PERMITEXT_SYNC_DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL", "STORAGE_URL"]) delete process.env[name];
const { handleRequest } = await import("../app.mjs");
const server = createServer(handleRequest);
try {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async path => {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    return response.json();
  };
  const library = (await get("/code/libraries")).libraries.find(item => item.codePrefix === "ZR");
  assert.equal(library.textChangesThrough, "2026-11-12");
  assert.equal(library.consolidatedTextChangesThrough, "2026-10-22");
  assert.equal(library.adoptedAmendments.length, 2);
  for (const [id, phrase] of [[20019992, "any bonus floor area"], [20019993, "no permanent certificate of occupancy"], [20021158, "An area plan shall indicate"]]) {
    const { section } = await get(`/code/sections/${id}`);
    assert.equal(section.sectionID, id);
    assert(section.blocks.some(block => block.plainText?.includes(phrase)), `${id}: missing enacted wording`);
    assert.equal(section.zoning.lastAmended, "2026-11-12");
  }
  const chapter = (await get("/code/chapters/15001007?bodyContract=2")).chapter;
  assert(chapter.sections.some(section => section.id === 20021188));
  const { section: appendix } = await get("/code/sections/20021188");
  const updatedMaps = appendix.blocks.filter(block => /adopted November 12, 2026, Resolution 736/.test(block.html));
  assert.equal(updatedMaps.length, 5);
  for (const block of updatedMaps) for (const [, path] of rewriteCodeAssetURLs(block.html).matchAll(/src="([^"]+)"/g)) {
    assert(path.startsWith("/code/assets/"), `Map must resolve through local asset serving: ${path}`);
    const image = await fetch(base + path.replaceAll("&amp;", "&"));
    assert.equal(image.status, 200, path);
    assert.match(image.headers.get("content-type"), /^image\/(png|jpeg)/);
    assert((await image.arrayBuffer()).byteLength > 100);
  }
  const search = await get("/code/search?q=81-745&code=ZR&limit=10");
  assert.equal(search.results[0].id, 20019993);
  assert.equal((await get("/code/sections/20018521")).section.sectionNumber, "12-01", "Existing saved section identity must still resolve");
  console.info("Zoning HTTP library dates, enacted wording, chapter appendix, five adopted map assets, search, and saved section identity passed.");
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
