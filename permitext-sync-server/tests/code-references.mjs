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
