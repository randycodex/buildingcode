import { lookupNYCPropertyContext } from "./nyc-property-context.mjs";

export const researchPropertyInvestigationVersion = "20261006-linked-site-investigation-v1";
const siteQuestion = /\b(?:address|site|property|parcel|lots?|frontage|streets?|intersection|zoning district|mapped|flood|landmark|historic district|transit zone)\b/i;
const geometryQuestion = /\b(?:lots?|frontage|streets?|intersection|boundar(?:y|ies)|geometry|dimensions?|yards?)\b/i;

export function researchPropertyAddress(question = "") {
  return String(question).match(/\b\d{1,6}\s+(?:[A-Za-z0-9.'’-]+\s+){1,6}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Place|Pl|Court|Ct|Parkway|Pkwy)\b(?:\.?\s*,?\s*(?:Bronx|Brooklyn|Manhattan|Queens|Staten Island))?/i)?.[0]?.trim() || null;
}

export async function researchPropertyContext({ question, messages = [], projectInformation = null, lookup = lookupNYCPropertyContext, now = Date.now } = {}) {
  const explicitAddress = researchPropertyAddress(question);
  const address = explicitAddress || (siteQuestion.test(question) ? projectInformation?.address?.trim() : null);
  if (!address) return null;
  const includeLotGeometry = geometryQuestion.test(question);
  const projectID = projectInformation?.projectID || null;
  const cached = messages.findLast(message => message.answer?.propertyResearch?.query === address &&
    message.answer.propertyResearch.projectID === projectID)?.answer.propertyResearch;
  const age = now() - Date.parse(cached?.retrievedAt);
  if (cached?.investigationVersion === researchPropertyInvestigationVersion && cached.status === "retrieved" &&
      age >= 0 && age < 86_400_000 && (!includeLotGeometry || cached.taxLot?.geometry?.status === "retrieved")) return cached;
  try {
    const property = await lookup(address, { includeLotGeometry });
    return { ...property, status: "retrieved", query: address, projectID,
      investigationVersion: researchPropertyInvestigationVersion };
  } catch {
    return { status: "unavailable", query: address, projectID, investigationVersion: researchPropertyInvestigationVersion,
      limitation: "The official property lookup could not establish the parcel. Do not infer its zoning district or mapped conditions." };
  }
}

export function researchPropertyContextFacts(property) {
  if (!property) return [];
  if (property.status !== "retrieved") return [property.limitation];
  return [
    `Official property investigation for ${property.query}: ${property.normalizedAddress}; BBL ${property.bbl}. Source: ${property.zolaURL}; retrieved ${property.retrievedAt}.`,
    ...property.structuredFacts.map(fact => `NYC Planning lookup candidate — ${fact.label}: ${fact.value}. ${fact.sourceText}`),
    ...(property.taxLot?.lotTypeCode ? [
      `Official property investigation — PLUTO tax-lot type ${property.taxLot.lotTypeCode}: ${property.taxLot.lotType}. Dataset version: ${property.taxLot.dataVersion || "not supplied"}. Record: ${property.taxLot.recordURL}; field definitions: ${property.taxLot.dictionaryURL}. This describes the tax lot, not a zoning determination.`,
      ...(property.taxLot.lotTypeCode === "3" ? ["PLUTO's LotType 3 means a tax lot bordering on two intersecting streets. It does not establish the legal street-line angle or zoning-lot composition."] : [])
    ] : []),
    ...(property.taxLot?.geometry ? [
      ...((property.taxLot.geometry.intersections || []).map(item =>
        `Official property investigation — DOF Digital Tax Map: two straight block-boundary lot faces meet at an approximate interior angle of ${item.approximateInteriorAngleDegrees} degrees; recorded face lengths: ${item.recordedFaceLengthsFeet.map(value => value === null ? "unknown" : `${value} ft`).join(" and ")}. Computed from mapped coordinates, not a survey. Sources: ${property.taxLot.geometry.sources.join("; ")}.`)),
      property.taxLot.geometry.limitation
    ] : []),
    "These records describe the mapped tax lot and existing conditions, not the proposed building, zoning-lot composition, filing basis, vesting, or frontage applicability.",
    ...(property.warnings || [])
  ];
}

export function researchPropertyInvestigationInstruction(property) {
  if (property?.status !== "retrieved" || property.investigationVersion !== researchPropertyInvestigationVersion) return "";
  return [
    "OFFICIAL PROPERTY INVESTIGATION",
    "The supplied official property records are factual evidence, separate from user assertions and enacted law. Cite the supplied property record URLs for factual findings and bind legal conclusions to the supplied enacted passages.",
    "Lead with a direct answer to the requested classification under its material condition, followed by the evidence and the specific remaining qualification. Avoid opening with a report about research confidence or repeating the same caveat. Explain what the official tax-lot type and mapped geometry establish. When those records and the complete enacted definition support a preliminary application, give that application under the explicit condition that the zoning lot follows the mapped tax lot and its block-boundary faces are the relevant street lines. This condition is not an established fact; do not describe the result as a verified final zoning determination. Preserve any material extent-of-application limit in the relied-on definition without expanding into unrelated yard rules.",
    "Do not withhold a supported mapped-site finding solely because zoning-lot composition is unverified. Preserve that specific qualification alongside the answer. Missing angle, curved faces, inconsistent records or uncertain parcel identity still limit the conclusion; do not fill them from model memory or a prior assistant answer.",
    "Do not invent adjoining street names, additional addresses, or front/side/rear classifications. Describe only what the supplied records establish. Identify the specific unresolved fact if further documents are needed and state what the investigation already found."
  ].join(" ");
}
