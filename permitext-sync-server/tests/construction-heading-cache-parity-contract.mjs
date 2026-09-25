import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, rm } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const fileName = "construction-html-content.mjs";
const current = await readFile(new URL(fileName, root), "utf8");
const token = randomUUID();
const newPath = new URL(`.heading-parity-new-${token}.mjs`, root);
const expose = "\nexport { allChapterHeadings, cachedChapterHTML };\n";
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

try {
  // Sibling modules preserve the authored-content paths derived from import.meta.url.
  await writeFile(newPath, current + expose);
  const after = await import(newPath.href);
  const newSource = await after.constructionChapterHTMLSource("BC", "33");
  const newHeadings = after.allChapterHeadings(newSource);
  // Frozen from the pre-cache implementation, independently verified against
  // the source bytes. Intentional corpus changes require reviewing both hashes.
  assert.equal(createHash("sha256").update(newSource.html).digest("hex"),
    "d8d7c56ec7de33c6ab8f81c495b646247061cfe1b77ddd8b21d66387a6dc2505");
  assert.equal(newHeadings.length, 934);
  assert.equal(hash(newHeadings), "71210577518dc9746f3fce950ea3ad4667a1337bc867d9eed9ad4cd74b5c34a8");
  assert.equal(after.allChapterHeadings(newSource), newHeadings, "Repeated parsing reuses the heading array");

  // These exact source fixtures exercise selection, not just heading parsing.
  const fixture = {
    cacheKey: "BC:PARITY", path: newSource.path,
    html: '<h6>101 Duplicate first</h6><p>First body</p><h6>101 Duplicate second</h6><p>Second body</p><h6>Appendix A: Special provisions</h6><p>Appendix body</p>'
  };
  after.cachedChapterHTML.set(fixture.cacheKey, fixture);
  const cases = [
    { sectionNumber: "101", title: "101 Duplicate second" },
    { sectionNumber: "101", title: "Ambiguous title" },
    { sectionNumber: "A", title: "Appendix A: Special provisions" },
    { sectionNumber: "999", title: "No matching heading" }
  ];
  const expectedHashes = [
    "d1349358d98c194d6d8e16fe807becb592834e4105a061d2ee0f86bf08d3826c",
    "be75ce7926fd0b6460c4be0aa29d7f64a770e8d41c73fabe65fd2df3b996d723",
    "d087ea3e0ea7082c7d1b5873e92ebd221369a9630df46540a642d93c44c64c23",
    "e8b083771e0adf3774289584986c65c222290c9f86996dbe405652cf371e619a"
  ];
  const resultHashes = [];
  for (const [index, value] of cases.entries()) {
    const section = { id: `parity-${index}`, codePrefix: "BC", chapterNumber: "PARITY", ...value };
    const actual = await after.constructionHTMLBodyStatusForSection(section);
    assert.equal(hash(actual), expectedHashes[index], value.title);
    if (index === 0 || index === 2) assert.ok(actual.body, "Unique title selects its body");
    if (index === 1) assert.equal(actual.reason, "ambiguous-official-heading");
    if (index === 3) assert.equal(actual.reason, "no-official-heading");
    resultHashes.push(hash(actual));
  }
  console.log("Construction heading cache parity passed", {
    chapter33Headings: newHeadings.length, headingHash: hash(newHeadings), selectionHashes: resultHashes
  });
} finally {
  await rm(newPath, { force: true });
}
