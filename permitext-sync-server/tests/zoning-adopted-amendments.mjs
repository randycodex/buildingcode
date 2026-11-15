import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseZoningChapterHTML, rewriteZoningAssetReferences } from "../zoning-resolution.mjs";
import { applyZoningAdoptedAmendments } from "../zoning-adopted-amendments.mjs";

const root = new URL("../../NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-zoning-resolution/", import.meta.url);
const source = JSON.parse(await readFile(new URL("source-manifest.json", root)));
assert.equal(source.textChangesThrough, "2026-11-12");
assert.equal(source.consolidatedTextChangesThrough, "2026-10-22");
assert.deepEqual(source.adoptedAmendments.map(item => item.resolution).sort(), [736, 737]);
for (const asset of source.retainedHistoricalAssets) assert.equal(
  createHash("sha256").update(await readFile(new URL(`assets/${asset.fileName}`, root))).digest("hex"), asset.contentHash,
  "Prior map bytes must remain available to saved content and issued Report snapshots");
const get = async id => JSON.parse(await readFile(new URL(`prepared/sections/${id}.json`, root)));
const text = section => section.blocks.map(block => block.plainText).join("\n");
const transfer = await get(20019992);
assert.match(text(transfer), /any bonus floor area granted pursuant to Section 81-745/);
assert.match(text(transfer), /\(b\) Transfer of development rights by authorization/);
assert.match(text(transfer), /\(c\) Requirements for Application/);
assert.match(text(transfer), /\$24\.65 per square foot/);
assert.equal(transfer.zoning.lastAmended, "2026-11-12");
const bonus = await get(20019993);
assert.doesNotMatch(text(bonus), /Location of development/);
assert.doesNotMatch(text(bonus), /there shall be a contractual commitment/);
assert.match(text(bonus), /no temporary certificate of occupancy/);
assert.match(text(bonus), /no permanent certificate of occupancy/);
assert.match(text(bonus), /44 percent/);
assert.match(text(bonus), /substantial construction/);
const subdivision = await get(20021158);
assert.match(text(subdivision), /An area plan shall indicate/);
assert.doesNotMatch(text(subdivision), /A site plan and/);
const appendix = await get(20021188);
assert.equal(appendix.chapterNumber, "X-7");
assert.equal(appendix.zoning.appendix.isChapterAppendix, true);
assert.equal(appendix.zoning.lastAmended, "2026-11-12");
for (const number of ["3", "3.2", "3.3", "3.5"]) assert(text(appendix).includes(`Map ${number} — Open Space Network (11/12/2026)`));
assert.equal(appendix.blocks.filter(block => /adopted November 12, 2026, Resolution 736/.test(block.html)).length, 5);
assert.match(text(appendix), /Map 3.4/);
assert.match(text(appendix), /Map 3.6/);
for (const section of [transfer, bonus, subdivision, appendix]) {
  assert.equal(section.zoning.amendmentHistory[0].effectiveDate, "2026-11-12");
  assert(section.zoning.supplementaryAdoptions.length);
  assert.match(section.zoning.consolidatedSourceContentHash, /^[a-f0-9]{64}$/);
}
const fixture = parseZoningChapterHTML(`<article class="node--type-section node--view-mode-default" data-node-id="1" data-section="107-00"><h3>Purpose</h3><div class="field--name-body field__item"><p>Law.</p></div></article>
<article class="node--type-chapter-appendix node--view-mode-default" about="/article-x/chapter-7/appendix"><h2>Appendix A</h2><h2>District Plan</h2><a data-content-nid="21188"></a><div class="field--name-body field__item"><p>Map 3</p><img src="/map.png" alt="Map 3"></div></article>`,
{ articleRoman: "X", articleTitle: "Special Purpose Districts", chapterNumber: "7", chapterTitle: "South Richmond", canonicalChapterNumber: "X-7", sourcePath: "/article-x/chapter-7" });
assert.equal(fixture.sections.length, 2);
assert.equal(fixture.sections[1].id, 20021188);
assert.equal(fixture.sections[1].sourceAssets.length, 1);
await assert.rejects(() => applyZoningAdoptedAmendments([]), /Missing amended section/);
assert.equal(rewriteZoningAssetReferences([{ html: '<img src="https://example.test/doc?x=1&amp;y=2#map.png">' }],
  new Map([["https://example.test/doc?x=1&y=2#map.png", "zr-map.png"]]))[0].html,
  '<img src="../../../assets/zr-map.png">');
console.info("Adopted zoning amendments, retained law, chapter appendices, and map provenance passed.");
