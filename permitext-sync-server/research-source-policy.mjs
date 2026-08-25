export const researchSourcePolicyVersion = "20260810-supporting-web-v1";

export const defaultResearchOfficialDomains = Object.freeze([
  "nyc.gov",
  "rules.cityofnewyork.us"
]);

const explicitOffValues = new Set(["0", "false", "off", "disabled", "no"]);
const trackingParameterNames = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source"
]);

function normalizedText(value) {
  return String(value || "").trim();
}

function normalizedDomain(value) {
  let domain = normalizedText(value).toLowerCase();
  if (!domain) return "";
  try {
    if (domain.includes("://")) domain = new URL(domain).hostname;
  } catch {
    return "";
  }
  return domain.replace(/^\.+|\.+$/g, "").replace(/^www\./, "");
}

export function normalizeResearchOfficialDomains(value = defaultResearchOfficialDomains) {
  const entries = Array.isArray(value) ? value : String(value || "").split(/[\s,]+/);
  return [...new Set(entries.map(normalizedDomain).filter(Boolean))];
}

export function researchSourcePolicyConfiguration(environment = process.env) {
  const enabledValue = normalizedText(environment.PERMITEXT_RESEARCH_WEB_SUPPORT).toLowerCase();
  const configuredDomains =
    environment.PERMITEXT_RESEARCH_WEB_OFFICIAL_DOMAINS ||
    environment.PERMITEXT_RESEARCH_OFFICIAL_DOMAINS;
  return {
    version: researchSourcePolicyVersion,
    webSupportEnabled: !explicitOffValues.has(enabledValue),
    officialDomains: normalizeResearchOfficialDomains(
      configuredDomains === undefined ? defaultResearchOfficialDomains : configuredDomains
    )
  };
}

export function sanitizeResearchWebQuery(value) {
  return normalizedText(value)
    // Remove private contact and project-identifying details before a query is
    // sent outside Permitext. The enacted-code terminology around them remains.
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ")
    .replace(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?:\s*(?:x|ext\.?)\s*\d+)?/gi, " ")
    .replace(/\b(?:client|client name|owner name|applicant name|tenant name)\s*[:=\-]\s*[^,;|\n.!?]+/gi, " ")
    .replace(
      /\b\d{1,6}\s+(?:[NSEW]\.?(?:\s+|$))?(?:[A-Z0-9.'-]+\s+){0,5}(?:STREET|ST|AVENUE|AVE|ROAD|RD|BOULEVARD|BLVD|LANE|LN|DRIVE|DR|COURT|CT|PLACE|PL|PARKWAY|PKWY|HIGHWAY|HWY|WAY|TERRACE|TER)\b(?:\s*(?:,|#|APT\.?|SUITE|UNIT)\s*[A-Z0-9-]+)?/gi,
      " "
    )
    .replace(/\s+([,;:.!?])/g, "$1")
    .replace(/[|;,]\s*(?=[|;,]|$)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function extractResearchOfficialDocumentReferences(value) {
  const text = normalizedText(value);
  const references = [];
  const seen = new Set();
  const bulletinPattern = /\b(?:(?:buildings?|dob)\s+)?(?:bulletin|bb)\s*(?:no\.?\s*)?((?:19|20)\d{2})\s*[-\u2013\u2014]\s*(\d{3})\b/gi;
  for (const match of text.matchAll(bulletinPattern)) {
    const reference = `Buildings Bulletin ${match[1]}-${match[2]}`;
    if (seen.has(reference)) continue;
    seen.add(reference);
    references.push(reference);
  }
  return references;
}

const guidanceRequestPattern =
  /\b(?:official\s+)?(?:guidance|interpretation|bulletin|service notice|advisory|faq|agency practice|dob guidance|department guidance)\b/i;
const outsideLibraryRequestPattern =
  /\b(?:web|internet|online source|outside (?:the )?(?:library|corpus)|external source|supporting source|manufacturer(?:'s)? (?:instructions|data|documentation)|referenced standard)\b/i;

export function researchWebSupportTrigger(input = {}, environment = process.env) {
  const configuration = researchSourcePolicyConfiguration(environment);
  if (!configuration.webSupportEnabled) {
    return { useWeb: false, reasons: [], configuration };
  }

  const question = normalizedText(input.question || input.query);
  const reasons = [];
  if (input.guidanceRequested === true || guidanceRequestPattern.test(question)) {
    reasons.push("official_guidance_requested");
  }
  if (
    input.outsideLibraryRequired === true ||
    input.referencedStandardUnavailable === true ||
    ["incomplete", "unavailable", "outside_library"].includes(input.corpusCoverage) ||
    outsideLibraryRequestPattern.test(question)
  ) {
    reasons.push("outside_library_support_needed");
  }
  return { useWeb: reasons.length > 0, reasons: [...new Set(reasons)], configuration };
}

export function shouldUseResearchWebSupport(input = {}, environment = process.env) {
  return researchWebSupportTrigger(input, environment).useWeb;
}

function domainIsAllowed(hostname, officialDomains) {
  const domain = normalizedDomain(hostname);
  return officialDomains.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}

export function classifyResearchWebSource(source, options = {}) {
  const officialDomains = normalizeResearchOfficialDomains(
    options.officialDomains === undefined ? defaultResearchOfficialDomains : options.officialDomains
  );
  let hostname = "";
  try {
    hostname = new URL(normalizedText(source?.url || source?.sourceURL || source?.href || source)).hostname;
  } catch {
    // Invalid URLs are rejected by normalizeResearchWebSources. Classification
    // remains safely secondary when used independently.
  }
  return {
    sourceClassification: domainIsAllowed(hostname, officialDomains)
      ? "official_guidance"
      : "secondary_source",
    sourceRole: "supporting",
    controlling: false
  };
}

function normalizedHttpsURL(value) {
  try {
    const url = new URL(normalizedText(value));
    if (url.protocol !== "https:") return "";
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    for (const name of [...url.searchParams.keys()]) {
      if (name.toLowerCase().startsWith("utm_") || trackingParameterNames.has(name.toLowerCase())) {
        url.searchParams.delete(name);
      }
    }
    url.searchParams.sort();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return "";
  }
}

export function normalizeResearchWebSources(sources, options = {}) {
  const officialDomains = normalizeResearchOfficialDomains(
    options.officialDomains === undefined ? defaultResearchOfficialDomains : options.officialDomains
  );
  const normalized = [];
  const seenURLs = new Set();

  for (const rawSource of Array.isArray(sources) ? sources : []) {
    const source = typeof rawSource === "string" ? { url: rawSource } : (rawSource || {});
    const url = normalizedHttpsURL(source.url || source.sourceURL || source.href);
    if (!url || seenURLs.has(url)) continue;
    seenURLs.add(url);
    normalized.push({
      ...source,
      url,
      title: normalizedText(source.title),
      publisher: normalizedText(source.publisher),
      ...classifyResearchWebSource({ url }, { officialDomains }),
      sourcePolicyVersion: researchSourcePolicyVersion
    });
  }
  return normalized;
}
