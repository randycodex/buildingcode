// Reviewed source locations for recurring technical and administrative topics.
// These routes supply enacted evidence, never answers, thresholds or Project
// facts. The corpus router still owns edition eligibility and selected scope.
const route = (pattern, label, codePrefix, sections, options = {}) => ({
  pattern, label,
  targets: sections.map((sectionPrefix) => ({ codePrefix, sectionPrefix, codeEdition: "2022", ...options }))
});

export const researchTechnicalTopicRoutes = [
  route(/^(?=[\s\S]*\b(?:gas[- ]fired|gas\s+appliances?|fuel[- ]gas)\b)(?=[\s\S]*\b(?:bathrooms?|toilet\s+rooms?|storage\s+closets?|surgical\s+rooms?)\b)/i,
    "fuel-gas appliance location restrictions and exceptions", "FGC", ["303.3"], { descendantClaimCoverage: false }),
  route(/^(?=[\s\S]*\b(?:gas[- ]fired|gas\s+appliances?|fuel[- ]gas)\b)(?=[\s\S]*\b(?:bedrooms?|sleeping\s+rooms?)\b)/i,
    "fuel-gas appliance sleeping-room restrictions and exceptions", "FGC", ["303.3"]),
  route(/^(?=[\s\S]*\bgas\b)(?=[\s\S]*\bpip(?:e|es|ing)\b)(?=[\s\S]*\b(?:tests?|testing|tested|inspect\w*|acceptance|commission\w*|service|operat\w*)\b)/i,
    "fuel-gas piping inspection and testing before service", "FGC", ["404.20", "406.1"]),
  route(/^(?=[\s\S]*\bgas\b)(?=[\s\S]*\bpip(?:e|es|ing)\b)(?=[\s\S]*\b(?:support\w*|strapp?\w*|hang(?:er|ers|ing)?|brackets?|anchor\w*)\b)/i,
    "fuel-gas piping supports and anchors", "FGC", ["407.2"]),
  route(/^(?=[\s\S]*\b(?:air[- ]condition\w*|HVAC)\b)(?=[\s\S]*\b(?:windows?|ventilat\w*)\b)/i,
    "mechanical ventilation of air-conditioned occupiable spaces", "MC", ["401.2", "403.1"]),
  route(/\b(?:recirculat\w*\s+(?:the\s+)?air|air\s+recirculat\w*|return[- ]air|transferr?(?:ed|ing)?\s+air|transfer[- ]air|air\s+transfer\w*)\b/i,
    "ventilation air recirculation and transfer-air limits", "MC", ["403.2.1", "403.2.2"]),
  route(/^(?=[\s\S]*\b(?:clothes[- ]dryers?|dryer)\b)(?=[\s\S]*\b(?:exhaust|duct\w*)\b)/i,
    "independent clothes-dryer exhaust and outlet requirements", "MC", ["501.2", "504.4"]),
  route(/^(?=[\s\S]*\b(?:1968|prior[- ]code)\b)(?=[\s\S]*\b(?:elect\w*|option\w*|old\s+technical)\b)(?=[\s\S]*\b(?:plumbing|mechanical|fuel[- ]gas|electrical)\b)/i,
    "prior-code election and current technical-code applicability", "AC", ["28-101.4.3", "28-102.4.3"]),
  route(/^(?=[\s\S]*\breplac\w*\b)(?=[\s\S]*\b(?:mechanical|equipment|boiler|furnace|water[- ]heater|air[- ]condition\w*)\b)(?=[\s\S]*\b(?:permits?|exempt\w*|in[- ]kind)\b)/i,
    "equipment replacement permit requirement and exemptions", "AC", ["28-105.1", "28-105.4"]),
  route(/^(?=[\s\S]*\bpermits?\b)(?=[\s\S]*\b(?:revok\w*|revocat\w*|suspend\w*|suspension|misrepresent\w*|false\s+statement)\b)/i,
    "permit revocation grounds and required procedure", "AC", ["28-105.10", "28-105.10.1"]),
  route(/^(?=[\s\S]*\b(?:materials?|methods?|products?)\b)(?=[\s\S]*\b(?:alternativ\w*|substitut\w*|prescript\w*|equival\w*|superior|stronger|durab\w*)\b)(?=[\s\S]*\b(?:approv\w*|commissioner|code|prescript\w*)\b)/i,
    "approval and equivalence of alternative construction materials or methods", "AC", ["28-113.2.2"]),
  route(/^(?=[\s\S]*\binspect\w*\b)(?=[\s\S]*\b(?:exposed|conceal\w*|accessible|satisfactor\w*|noncomplian\w*|violat\w*|legal|close\s+(?:a|the)\s+wall)\b)/i,
    "inspection access and the limits of a satisfactory inspection", "AC", ["28-116.1"]),
  route(/^(?=[\s\S]*\bcertificate\s+of\s+occupancy\b)(?=[\s\S]*\b(?:occupy|occupancy|use)\b)(?=[\s\S]*\b(?:inspect\w*|issu\w*|complet\w*|finished)\b)/i,
    "required certificate before use or occupancy", "AC", ["28-118.1"]),
  route(/\bstop[- ]work\s+orders?\b/i,
    "stop-work order scope and permitted continuation", "AC", ["28-207.2", "28-207.2.1"]),
  route(/^(?=[\s\S]*\b(?:laundry|washers?|washing)\b)(?=[\s\S]*\b(?:common|central|shared|multiple[- ]family|multifamily)\b)(?=[\s\S]*\bfloor\s+drains?\b)/i,
    "floor drains in common residential washing facilities", "PC", ["412.3", "412.4"]),
  route(/^(?=[\s\S]*\bdrain\w*\b)(?=[\s\S]*\b(?:reduc\w*|smaller|narrow\w*|decreas\w*)\b)(?=[\s\S]*\b(?:downstream|direction\s+of\s+(?:the\s+)?flow)\b)/i,
    "drainage pipe size changes in the direction of flow", "PC", ["704.2"])
];
