import { readerSearchMatch, snippetForMatch, readerSearchResultHeading } from "../public/reader-search-match.js";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("./fixtures/reader-search-legacy-match.js", import.meta.url), "utf8");
const start = source.indexOf("function readerSearchBlockMatches(");
const end = source.length;
assert.ok(start > 0 && end > start);

const context = vm.createContext({ readerSearchMatch, snippetForMatch, readerSearchResultHeading,
  annotatedBlocksForSection: (section) => section.blocks || [],
  annotationTargetForBlock: (_section, block, _reader, index) => ({
    blockID: block.id || `block-${index + 1}`
  }),
  plainTextForSearchBlock: (block) => block.plainText || ""
});
vm.runInContext(`${source.slice(start, end)}
globalThis.readerSearchMatch = readerSearchMatch;
globalThis.bestReaderSearchBlockMatch = bestReaderSearchBlockMatch;
globalThis.readerSearchResultHeading = readerSearchResultHeading;`, context);

assert.equal(
  context.readerSearchMatch("HAZARDOUS MATERIALS", "harzadous materials")?.text,
  "HAZARDOUS MATERIALS",
  "Reader search should recover the reported hazardous-materials typo"
);
assert.equal(context.readerSearchMatch("hazardous materials", "hazardous materials")?.exact, true);
assert.equal(
  context.readerSearchMatch("handrails and materials", "harzadous materials"),
  null,
  "Reader search must not broaden an unrelated phrase"
);
assert.equal(
  context.readerSearchMatch("hazard classification", "haz materials"),
  null,
  "short search tokens must remain exact"
);

const definitionsSection = {
  blocks: [
    {
      id: "closed-system",
      plainText: "CLOSED SYSTEM. Examples of closed systems include hazardous materials conveyed through a piping system."
    },
    {
      id: "hazardous-materials",
      plainText: "HAZARDOUS MATERIALS. Those chemicals or substances that are physical hazards or health hazards."
    }
  ]
};
for (const query of ["hazardous materials", "harzadous materials"]) {
  const bestMatch = context.bestReaderSearchBlockMatch(definitionsSection, query);
  assert.equal(
    bestMatch?.blockID,
    "hazardous-materials",
    `Reader search should prioritize the definition block for ${query}`
  );
  assert.equal(
    context.readerSearchResultHeading("SECTION 202: Definitions", bestMatch),
    "HAZARDOUS MATERIALS"
  );
}

console.log("Reader definition-priority and typo-tolerant phrase search contract passed.");
