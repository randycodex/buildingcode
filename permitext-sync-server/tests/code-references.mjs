import {
  inlineCodeReferencePhrases,
  parseCodeJumpAnchor,
  rewriteStructuredCodeLinks
} from "../public/code-references.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const rangeText = "Sections 101.4.1 through 101.4.6";
const range = inlineCodeReferencePhrases(rangeText)[0];
assert(range?.references.length === 2, "Section ranges must expose both endpoints.");
assert(
  rangeText.slice(range.references[0].start, range.references[0].end) === "Sections 101.4.1",
  "The first range link must preserve its enacted label."
);
assert(
  rangeText.slice(range.references[1].start, range.references[1].end) === "101.4.6",
  "The second range endpoint must be independently linkable."
);

const listText = "Sections 403.4.8.4.1, 403.4.8.4.2, and 403.4.8.4.3";
const list = inlineCodeReferencePhrases(listText)[0];
assert(list?.references.length === 3, "Section lists must expose every cited section.");

const prefixed = inlineCodeReferencePhrases("MC Sections 501.2 and 501.3")[0];
assert(prefixed?.codePrefix === "MC", "Text references must preserve an explicit code prefix.");

const zoningPrefixed = inlineCodeReferencePhrases("ZR Sections 25-23 through 25-26")[0];
assert(zoningPrefixed?.codePrefix === "ZR", "Zoning references must preserve the ZR prefix.");
assert(zoningPrefixed?.references.length === 2, "Zoning ranges must expose both endpoints.");
assert(zoningPrefixed?.references[0].sectionNumber === "25-23");
assert(zoningPrefixed?.references[1].sectionNumber === "25-26");

const directZoning = inlineCodeReferencePhrases("Compare ZR 25-23 with ZR Table 25-31.");
assert(directZoning.length === 2, "Direct ZR section and table citations must both be linkable.");
assert(directZoning[0].codePrefix === "ZR" && directZoning[0].references[0].sectionNumber === "25-23");
assert(directZoning[0].kind === "section" && directZoning[0].references[0].kind === "section");
assert(directZoning[1].codePrefix === "ZR" && directZoning[1].references[0].sectionNumber === "25-31");
assert(directZoning[1].kind === "table" && directZoning[1].references[0].kind === "table");

const buildingTarget = parseCodeJumpAnchor("JD_BC3321");
assert(
  buildingTarget?.kind === "section" && buildingTarget.codePrefix === "BC" && buildingTarget.sectionNumber === "3321",
  "Building Code jump anchors must resolve to their code and parent section."
);

const administrativeTarget = parseCodeJumpAnchor("28-101.4.4");
assert(
  administrativeTarget?.codePrefix === "AC" && administrativeTarget.sectionNumber === "28-101.4.4",
  "Title 28 jump anchors must resolve to General Administrative Provisions."
);

const chapterTarget = parseCodeJumpAnchor("MCCh.7");
assert(
  chapterTarget?.kind === "chapter" && chapterTarget.codePrefix === "MC" && chapterTarget.chapterNumber === "7",
  "Cross-code chapter anchors must resolve to the referenced chapter."
);

const appendixSectionTarget = parseCodeJumpAnchor("FGC_AppE.6");
assert(
  appendixSectionTarget?.kind === "section" && appendixSectionTarget.sectionNumber === "E.6",
  "Appendix subsection anchors must retain their appendix letter."
);

const tableTarget = parseCodeJumpAnchor("BCTable1604.5");
assert(
  tableTarget?.targetKind === "table" && tableTarget.sectionNumber === "1604.5",
  "Table jump anchors must resolve through their containing code section."
);

const structured = rewriteStructuredCodeLinks(
  "Section <Link class=\"Jump\" to=\"{{ hash: '#JD_BC3321' }}\">3321</Link> of the Building Code"
);
assert(
  structured.includes('data-code-jump-anchor="BC3321"') && structured.includes(">3321</button>"),
  "Supported enacted jump metadata must become an inline reference button."
);

const unsupported = rewriteStructuredCodeLinks(
  "<Link class=\"Jump\" to=\"{{ hash: '#JD_L.L.2023/077' }}\">L.L. 2023/077</Link>"
);
assert(unsupported === "L.L. 2023/077", "Unavailable external targets must remain readable plain text.");

console.log("permitext code reference parsing passed");
