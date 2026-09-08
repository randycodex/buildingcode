import { createHash } from "node:crypto";

export const zoningContextExcerptVersion = "20260908-storage-applicability-excerpt-v1";
const compact = (value) => String(value || "").replace(/\s+/g, " ").trim();

export async function refreshZoningContextEvidence(evidencePackage, plan, assemble) {
  const hasExcerpt = (value) => value.sources.some((source) => source.targetedZoningContext);
  if (!hasExcerpt(evidencePackage) || plan?.missingFacts.length) return evidencePackage;
  const refreshed = await assemble(plan);
  if (hasExcerpt(refreshed)) throw Object.assign(new Error(
    "The resolved Zoning question needs governing evidence beyond the missing-facts excerpt."
  ), { code: "RESEARCH_ZONING_EXCERPT_SCOPE_MISMATCH" });
  return refreshed;
}

// This selects enacted text, never an answer. The limited packet is for a
// question that cannot yet select a parcel's applicability branch. Detailed
// design, dimensional, signage or reporting requests need their own evidence.
export function targetedZoningContextExcerpt(source, { question, plan } = {}) {
  if (source?.codePrefix !== "ZR" || source?.sectionNumber !== "42-192" ||
      plan?.path !== "property_map_applicability" || !plan?.missingFacts?.length ||
      !/\bself[- ](?:service\s+)?storage\b/i.test(question) ||
      !/\b(?:as[- ]of[- ]right|permitted|allowed|applicability)\b/i.test(question) ||
      /\b(?:calculat\w*|design|detailed|how (?:much|many)|percentage?|industrial floor space|business-sized|signage|signs?|report(?:ing)?|dimensions?|height|width|depth|square feet|sq\.?\s*ft\.?)\b|\d\s*%/i.test(question)) return null;
  const canonical = compact(source.canonicalText || source.text);
  if (!canonical) return null;
  // Anchors bind complete source paragraphs, including the closing conditions.
  // Changed wording or paragraph boundaries disable this selector for review.
  const expressions = [
    /For uses denoted with “♦” in Section 42-191 \(Use Group IX – general use allowances\), the provisions of this Section shall apply\./,
    /In designated areas within Manufacturing Districts,[\s\S]+?A self-service storage facility shall, in Subarea 1[\s\S]+?paragraph \(b\)\(2\)\(ii\) of this Section\./,
    /A self-service storage facility shall, in Subarea 2[\s\S]+?Any self-service storage facility existing on December 19, 2017, that does not file such documentation[\s\S]+?of this Resolution\./
  ];
  const spans = [];
  for (const expression of expressions) {
    const match = expression.exec(canonical);
    if (!match || spans.some((span) => match.index < span.end)) return null;
    spans.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
  }
  const text = spans.map((span) => span.text).join("\n\n");
  if (text.length > 4_000) return null;
  return {
    text,
    metadata: {
      version: zoningContextExcerptVersion,
      purpose: "unresolved_storage_applicability",
      canonicalSectionSHA256: createHash("sha256").update(canonical).digest("hex"),
      canonicalSectionCharacterCount: canonical.length,
      spans: spans.map(({ start, end }) => ({ start, end })),
      limitation: "Only the use-allowance introduction, designated-area branch introduction, and existing-facility provisions are included. Detailed Subarea 1 industrial/business-sized-space, signage and reporting provisions are omitted. This excerpt cannot establish a parcel's mapped status, design compliance or satisfaction of those omitted requirements."
    }
  };
}
