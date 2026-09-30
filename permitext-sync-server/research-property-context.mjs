import { lookupNYCPropertyContext } from "./nyc-property-context.mjs";

export function researchPropertyAddress(question = "") {
  return String(question).match(/\b\d{1,6}\s+(?:[A-Za-z0-9.'’-]+\s+){1,6}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Place|Pl|Court|Ct|Parkway|Pkwy)\b(?:\.?\s*,?\s*(?:Bronx|Brooklyn|Manhattan|Queens|Staten Island))?/i)?.[0]?.trim() || null;
}

export async function researchPropertyContext({ question, messages = [], lookup = lookupNYCPropertyContext } = {}) {
  const address = researchPropertyAddress(question);
  if (!address) return null;
  const cached = messages.findLast(message => message.answer?.propertyResearch?.query === address)?.answer.propertyResearch;
  if (cached?.status === "retrieved" && Date.now() - Date.parse(cached.retrievedAt) < 86_400_000) return cached;
  try {
    const property = await lookup(address);
    return { status: "retrieved", query: address, ...property };
  } catch {
    return { status: "unavailable", query: address,
      limitation: "The official property lookup could not establish the parcel. Do not infer its zoning district or mapped conditions." };
  }
}

export function researchPropertyContextFacts(property) {
  if (!property) return [];
  if (property.status !== "retrieved") return [property.limitation];
  return [
    `Official NYC Planning lookup candidate for ${property.query}: ${property.normalizedAddress}; BBL ${property.bbl}. Source: ${property.zolaURL}; retrieved ${property.retrievedAt}. Confirm the matched parcel before a site-specific conclusion.`,
    ...property.structuredFacts.map(fact => `NYC Planning lookup candidate — ${fact.label}: ${fact.value}. ${fact.sourceText}`),
    "These records describe the mapped tax lot and existing conditions, not the proposed building, zoning-lot composition, filing basis, vesting, or frontage applicability.",
    ...(property.warnings || [])
  ];
}
