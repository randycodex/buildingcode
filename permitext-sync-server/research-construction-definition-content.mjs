import { createHash } from "node:crypto";
import { createResearchCorpusRegistry } from "./research-corpus-registry.mjs";
import { researchEmbeddedDefinitionCarrier } from "./research-definition-excerpts.mjs";
import { relative } from "node:path";
import { constructionContentRoot } from "./construction-html-content.mjs";

export const researchConstructionDefinitionContentVersion = "20261004-same-source-definition-body-v1";
const corpus = createResearchCorpusRegistry().find(value => value.id === "nyc-2022-construction-codes");
const authorityFields = ["corpusID", "codeVersion", "codeEdition", "jurisdiction", "codePrefix"];
const text = value => String(value ?? "").trim();
const compact = value => text(value).replace(/\s+/g, " ");
const hash = value => createHash("sha256").update(String(value || "")).digest("hex");
const bodyText = body => (body?.blocks || []).map(block => text(block.plainText)).filter(Boolean).join("\n\n");
const sectionID = section => text(section?.sectionID || section?.id);

/**
 * Compare only a fresh file-backed current official body with the prepared
 * body of its canonical catalog record. The caller resolves that catalog
 * record; discovery/model metadata must never create this binding.
 * Existing complete sources and every unproven mismatch remain unchanged.
 */
export function enrichResearchConstructionDefinitionBody(preparedBody, officialBody, section, officialSource) {
  const unchanged = () => preparedBody;
  const id = sectionID(section), prefix = text(section?.codePrefix).toUpperCase();
  const binding = officialBody?.officialSourceBinding;
  if (!id || !corpus?.codePrefixes.includes(prefix) || !text(section?.sectionNumber) ||
      !binding || binding.version !== "current-construction-html-body-v1" ||
      !Array.isArray(preparedBody?.blocks) || !Array.isArray(officialBody?.blocks) ||
      section.researchClaimEligible === false || preparedBody.researchClaimEligible === false ||
      preparedBody.blocks.some(block => block.researchClaimEligible === false) ||
      preparedBody.referenceOnly || preparedBody.selectionMode === "section_reference" ||
      preparedBody.pinnedSelectionExact || preparedBody.discoveryPassageOnly ||
      officialBody.truncated || officialBody.blocks.length !== 1 ||
      officialBody.blocks.some(block => block.truncated || block.researchClaimEligible === false)) return unchanged();
  const expectedAuthority = { corpusID: corpus.id, codeVersion: corpus.codeVersion,
    codeEdition: corpus.codeEdition, jurisdiction: corpus.jurisdiction, codePrefix: prefix };
  if (authorityFields.some(field => text(binding[field]) !== expectedAuthority[field] ||
      section[field] && text(section[field]) !== expectedAuthority[field] ||
      preparedBody[field] && text(preparedBody[field]) !== expectedAuthority[field] ||
      officialBody[field] && text(officialBody[field]) !== expectedAuthority[field])) return unchanged();
  const chapter = text(section.sourceChapterNumber || section.chapterNumber);
  if (!chapter || text(binding.sectionID) !== id || text(preparedBody.sectionID) !== id ||
      text(officialBody.sectionID) !== id || text(binding.sectionNumber) !== text(section.sectionNumber) ||
      text(officialBody.sectionNumber) !== text(section.sectionNumber) ||
      text(binding.sourceChapterNumber) !== chapter || text(officialBody.chapterNumber) !== chapter ||
      preparedBody.sectionNumber && text(preparedBody.sectionNumber) !== text(section.sectionNumber) ||
      preparedBody.chapterNumber && text(preparedBody.chapterNumber) !== chapter ||
      preparedBody.chapterID && text(preparedBody.chapterID) !== text(section.chapterID) ||
      preparedBody.title && compact(preparedBody.title) !== compact(section.title) ||
      text(officialBody.chapterID) !== text(section.chapterID) ||
      compact(officialBody.title) !== compact(section.title) ||
      !text(binding.sourceHTMLPath) || binding.sourceHTMLPath !== officialBody.sourceHTMLPath ||
      !/^[a-f0-9]{64}$/.test(binding.sourceHTMLHash || "")) return unchanged();
  const officialText = bodyText(officialBody), preparedText = bodyText(preparedBody);
  const block = officialBody.blocks[0];
  if (!preparedText || !officialText || hash(block.html) !== binding.bodyHTMLHash ||
      hash(block.plainText) !== binding.bodyTextHash ||
      compact(officialText) === compact(preparedText) ||
      !compact(officialText).startsWith(compact(preparedText))) return unchanged();
  const carrier = researchEmbeddedDefinitionCarrier({ ...section, sectionID: id, body: officialBody });
  if (!carrier || carrier.codePrefix !== prefix || carrier.carrierSectionID !== id ||
      carrier.carrierSectionNumber !== text(section.sectionNumber) ||
      carrier.sourceTextHash !== binding.bodyTextHash ||
      carrier.sourceOffsets.blockID !== text(block.id)) return unchanged();
  const range = binding.sourceHTMLRange;
  if (!officialSource || officialSource.cacheKey !== `${prefix}:${chapter.toUpperCase()}` ||
      !text(officialSource.path) ||
      relative(constructionContentRoot, officialSource.path) !== binding.sourceHTMLPath ||
      hash(officialSource.html) !== binding.sourceHTMLHash ||
      !Number.isSafeInteger(range?.start) || !Number.isSafeInteger(range?.end) ||
      range.start < 0 || range.end <= range.start || range.end > String(officialSource.html).length ||
      String(officialSource.html).slice(range.start, range.end).trim() !== block.html) return unchanged();
  // Keep any prepared rich structure intact. A definition-only repair cannot
  // discard table grids, image associations or other structured source data.
  if (preparedBody.blocks.some(value => ["table", "image"].includes(value.kind) || value.imageID ||
      /<(?:table|scrolltable|img)\b/i.test(String(value.html || "")))) return unchanged();
  return officialBody;
}
