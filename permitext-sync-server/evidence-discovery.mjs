import { createHash } from "node:crypto";

export const evidenceDiscoveryVersion = "20260824-hybrid-candidates-v17";
export const evidenceCandidateDisplayVersion = "20260809-structured-candidate-v1";
export const evidenceDiscoveryMaximumCandidates = 12;
export const evidenceDiscoveryMaximumVisualSelections = 4;

const stopWords = new Set([
  "a", "about", "after", "all", "also", "an", "and", "any", "are", "as", "at",
  "be", "because", "been", "before", "being", "between", "both", "but", "by",
  "can", "could", "do", "does", "each", "for", "from", "has", "have", "how",
  "if", "in", "into", "is", "it", "its", "may", "must", "no", "not", "of",
  "on", "one", "or", "our", "should", "so", "than", "that", "the", "their",
  "then", "there", "these", "this", "those", "to", "under", "use", "using",
  "was", "we", "what", "when", "where", "whether", "which", "while", "with",
  "without", "would"
]);

const conceptExpansions = [
  {
    pattern: /\b(scissor|stair|stairs|stairway|exit|exits|egress)\b/i,
    terms: ["scissor", "stair", "stairs", "stairway", "exit", "exits", "egress"]
  },
  {
    pattern: /\b(residential|apartment|dwelling|r-2)\b/i,
    terms: ["residential", "apartment", "dwelling", "r-2"]
  },
  {
    pattern: /\b(occupant|occupancy|occupants|load|seating|seats)\b/i,
    terms: ["occupant", "occupants", "occupancy", "load", "seating", "seats"]
  },
  {
    pattern: /\b(assembly|multipurpose|conference|meeting|amenity)\b/i,
    terms: ["assembly", "multipurpose", "conference", "meeting", "amenity"]
  },
  {
    pattern: /\b(plumbing|fixture|fixtures|toilet|lavatory|water closet)\b/i,
    terms: ["plumbing", "fixture", "fixtures", "toilet", "lavatory", "water", "closet"]
  },
  {
    pattern: /\b(accessible|accessibility|disabled|wheelchair)\b/i,
    terms: ["accessible", "accessibility", "wheelchair"]
  },
  {
    pattern: /\b(existing|prior-code|legacy|alteration|enlargement)\b/i,
    terms: ["existing", "prior", "legacy", "alteration", "enlargement"]
  },
  {
    pattern: /\b(structural|wind surface|lateral force|wind load)\b/i,
    terms: ["structural", "wind", "surface", "lateral", "force", "load"]
  },
  {
    pattern: /\b(fire alarm|alarm system|notification)\b/i,
    terms: ["fire", "alarm", "system", "notification"]
  },
  {
    pattern: /\b(sidewalk caf[eé]|outdoor dining|exterior seating)\b/i,
    terms: ["sidewalk", "cafe", "outdoor", "dining", "exterior", "seating"]
  },
  {
    pattern: /\b(mechanical|ventilation|exhaust|air changes?)\b/i,
    terms: ["mechanical", "ventilation", "exhaust", "air"]
  },
  {
    pattern: /\b(?:off[- ]street|accessory)\s+parking\b|\bparking\s+(?:required|requirement|spaces?|waiver|reduction|permitted)\b/i,
    terms: ["off-street", "parking", "accessory", "required", "requirement", "permitted", "development", "enlargement"]
  }
];

const topicRoutes = [
  {
    pattern: /\b(?:conflict|difference)\b[\s\S]*\b(?:enacted\s+)?text\b[\s\S]*\b(?:caption|illustration|summary\s+table|illustrative\s+table)\b|\b(?:caption|illustration|summary\s+table|illustrative\s+table)\b[\s\S]*\b(?:conflict|difference)\b[\s\S]*\b(?:enacted\s+)?text\b/i,
    label: "Zoning Resolution text-control and construction rules",
    targets: [{ codePrefix: "ZR", sectionPrefix: "12-01" }]
  },
  {
    pattern: /\bAppendix\s+J\b|\bdesignated\s+areas?\b.*\b(?:manufacturing|mapped|subarea)\b/i,
    label: "Appendix J designated-area maps and applicability",
    targets: [{ codePrefix: "ZR", sectionPrefix: "APPENDIX J" }]
  },
  {
    pattern: /\bself(?:[- ]service)?[- ]storage\b/i,
    label: "self-service storage use and mapped-area provisions",
    targets: [
      { codePrefix: "ZR", sectionPrefix: "42-191" },
      { codePrefix: "ZR", sectionPrefix: "42-192" },
      { codePrefix: "ZR", sectionPrefix: "42-193" },
      { codePrefix: "ZR", sectionPrefix: "74-192" },
      { codePrefix: "ZR", sectionPrefix: "APPENDIX J" }
    ]
  },
  {
    pattern: /\b(?:mapped\s+zoning\s+district|zoning\s+maps?|mapped\s+(?:district|condition))\b.*\b(?:FAR|floor\s+area\s+ratio|maximum|determin)\b|\b(?:FAR|floor\s+area\s+ratio)\b.*\bmapped\s+(?:zoning\s+)?district\b/i,
    label: "mapped zoning-district applicability",
    targets: [{ codePrefix: "ZR", sectionPrefix: "11-14" }]
  },
  {
    pattern: /\b(?:R6|R7A?|R8A?|R9A?|R10|R11|R12)\b.*\b(?:FAR|floor\s+area\s+ratio|residential\s+floor\s+area)\b|\b(?:FAR|floor\s+area\s+ratio)\b.*\b(?:R6|R7A?|R8A?|R9A?|R10|R11|R12)\b/i,
    label: "R6 through R12 residential floor-area limits",
    targets: [
      { codePrefix: "ZR", sectionPrefix: "23-22" },
      { codePrefix: "ZR", sectionPrefix: "12-10" }
    ]
  },
  {
    pattern: /\bqualifying\s+(?:affordable|senior)\s+housing\b.*\b(?:FAR|floor\s+area|limit|qualif)\b|\b(?:FAR|floor\s+area)\b.*\bqualifying\s+(?:affordable|senior)\s+housing\b/i,
    label: "qualifying affordable-housing floor-area prerequisites",
    targets: [
      { codePrefix: "ZR", sectionPrefix: "27-111" },
      { codePrefix: "ZR", sectionPrefix: "27-16" }
    ]
  },
  {
    pattern: /\b(?:R6|R7A?|R8A?|R9A?|R10|R11|R12)\b.*\b(?:height|tall|setback)\b|\b(?:height|tall|setback)\b.*\b(?:R6|R7A?|R8A?|R9A?|R10|R11|R12)\b/i,
    label: "R6 through R12 residential height and setback limits",
    targets: [
      { codePrefix: "ZR", sectionPrefix: "23-432" },
      { codePrefix: "ZR", sectionPrefix: "23-434" }
    ]
  },
  {
    pattern: /\b(?:R6|R7A?|R8A?|R9A?|R10|R11|R12)\b.*\blot[-\s]+coverage\b|\blot[-\s]+coverage\b.*\b(?:R6|R7A?|R8A?|R9A?|R10|R11|R12)\b/i,
    label: "R6 through R12 lot coverage and open-area limits",
    targets: [
      { codePrefix: "ZR", sectionPrefix: "23-362" },
      { codePrefix: "ZR", sectionPrefix: "23-363" },
      { codePrefix: "ZR", sectionPrefix: "23-342" }
    ]
  },
  {
    pattern: /\bC3\b.*\b(?:professional|architectural|business)\s+office\b|\b(?:professional|architectural|business)\s+office\b.*\bC3\b/i,
    label: "C3 professional-office use permissions",
    targets: [
      { codePrefix: "ZR", sectionPrefix: "32-17" },
      { codePrefix: "ZR", sectionPrefix: "32-171" }
    ]
  },
  {
    pattern: /\bC4(?:-\d+[A-Z]?)?\b.*\b(?:apartments?|residential\s+use|residences?)\b|\b(?:apartments?|residential\s+use|residences?)\b.*\bC4(?:-\d+[A-Z]?)?\b/i,
    label: "C4 residential-use permissions",
    targets: [
      { codePrefix: "ZR", sectionPrefix: "32-121" },
      { codePrefix: "ZR", sectionPrefix: "32-123" }
    ]
  },
  {
    pattern: /\bInner\s+Transit\s+Zone\b.*\b(?:residential|dwelling|rooming|parking)\b|\b(?:residential|dwelling|rooming)\b.*\bInner\s+Transit\s+Zone\b/i,
    label: "Inner Transit Zone residential parking requirements",
    targets: [
      { codePrefix: "ZR", sectionPrefix: "25-20" },
      { codePrefix: "ZR", sectionPrefix: "25-211" }
    ]
  },
  {
    pattern: /\b(?:December\s+5,?\s+2024|vested\s+rights?|timely\s+application)\b.*\b(?:parking|dwelling|rooming)\b|\b(?:parking|dwelling|rooming)\b.*\b(?:December\s+5,?\s+2024|vested\s+rights?|timely\s+application)\b/i,
    label: "December 2024 transition and vested-right provisions",
    targets: [{ codePrefix: "ZR", sectionPrefix: "11-333" }]
  },
  {
    pattern: /\b(?:divided|straddles?)\b.*\bzoning\s+districts?\b|\bzoning\s+lot\b.*\b(?:majority\s+district|less\s+restrictive\s+district)\b/i,
    label: "zoning lots divided by district boundaries",
    targets: [
      { codePrefix: "ZR", sectionPrefix: "77-02" },
      { codePrefix: "ZR", sectionPrefix: "77-11" },
      { codePrefix: "ZR", sectionPrefix: "77-22" }
    ]
  },
  {
    pattern: /\b(?:demolition\s+permit|demolish|demolition)\b.*\b(?:Subdistrict|special\s+district|101-75)\b|\b101-75\b/i,
    label: "Special Downtown Brooklyn demolition prerequisites",
    targets: [
      { codePrefix: "ZR", sectionPrefix: "101-04" },
      { codePrefix: "ZR", sectionPrefix: "101-75" }
    ]
  },
  {
    pattern: /^(?=[\s\S]*\b(?:(?:off[- ]street|accessory)\s+parking|parking\s+(?:required|requirement|spaces?|permitted))\b)(?=[\s\S]*\b(?:manhattan(?:\s+core)?|C6-4)\b)/i,
    label: "Manhattan Core non-residential parking applicability and limits",
    targets: [
      { codePrefix: "ZR", sectionPrefix: "13-041" },
      { codePrefix: "ZR", sectionPrefix: "13-07" },
      { codePrefix: "ZR", sectionPrefix: "13-12" }
    ]
  },
  {
    pattern: /\bexterior\s+wall\b.*\b(?:lot\s+line|fire[- ]separation\s+distance|unprotected\s+(?:window|opening)|fire[- ]resistance\s+rating)\b/i,
    label: "exterior-wall rating and opening-area provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "602.1" },
      { codePrefix: "BC", sectionPrefix: "705.8" },
      { codePrefix: "BC", sectionPrefix: "705.8.1" }
    ]
  },
  {
    pattern: /\b(?:atrium|open\s+volume)\b.*\b(?:floors?|stories|shaft\s+openings?|smoke\s+control|separation)\b/i,
    label: "atrium classification and protection provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "202" },
      { codePrefix: "BC", sectionPrefix: "712.1.7" },
      { codePrefix: "BC", sectionPrefix: "404.3" },
      { codePrefix: "BC", sectionPrefix: "404.5" },
      { codePrefix: "BC", sectionPrefix: "404.6" }
    ]
  },
  {
    pattern: /\b(?:pipe|penetration)\b.*\bshaft\s+enclosure\b|\bshaft\s+enclosure\b.*\b(?:pipe|penetration)\b/i,
    label: "shaft-enclosure penetration provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "713.8" },
      { codePrefix: "BC", sectionPrefix: "713.8.1" },
      { codePrefix: "BC", sectionPrefix: "714.3" },
      { codePrefix: "BC", sectionPrefix: "714.3.1" }
    ]
  },
  {
    pattern: /\b(?:interior|major)\s+alteration\b.*\b(?:sprinkler|sprinklers)\b|\b(?:sprinkler|sprinklers)\b.*\b(?:altered\s+area|alteration|entire\s+building)\b/i,
    label: "existing-building alteration sprinkler triggers",
    targets: [{ codePrefix: "BC", sectionPrefix: "901.9.4", includeDescendants: true }]
  },
  {
    pattern: /\bstandpipe\b.*\b(?:require|trigger|type|class)\b|\bwhat\s+type\s+of\s+standpipe\b/i,
    label: "standpipe installation triggers and classes",
    targets: [
      { codePrefix: "BC", sectionPrefix: "905.3" },
      { codePrefix: "BC", sectionPrefix: "905.3.1" }
    ]
  },
  {
    pattern: /\bhigh[- ]rise\b.*\b(?:emergency|standby)\s+power\b|\b(?:emergency|standby)\s+power\b.*\bhigh[- ]rise\b/i,
    label: "high-rise emergency and standby power provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "403.4.8", includeDescendants: true },
      { codePrefix: "BC", sectionPrefix: "2702.1" }
    ]
  },
  {
    pattern: /\b(?:number\s+of\s+stories|five[- ]story|multi[- ]story)\b.*\belevator\b|\belevator\b.*\b(?:required|number\s+of\s+stories)\b/i,
    label: "accessible-story elevator exceptions",
    targets: [{ codePrefix: "BC", sectionPrefix: "1104.4" }]
  },
  {
    pattern: /\b(?:community|meeting|assembly)\s+room\b.*\b(?:live\s+load|structural)\b|\blive\s+load\b.*\b(?:community|meeting|assembly)\s+room\b/i,
    label: "assembly-area structural live loads",
    targets: [{ codePrefix: "BC", sectionPrefix: "1607.1" }]
  },
  {
    pattern: /\b(?:file|dense)\s+storage\b.*\b(?:structural|live\s+load|columns?|beams?)\b|\bstructural\s+evaluation\b.*\bstorage\b/i,
    label: "storage conversion structural loads",
    targets: [
      { codePrefix: "BC", sectionPrefix: "1604.2" },
      { codePrefix: "BC", sectionPrefix: "1607.1" }
    ]
  },
  {
    pattern: /\bscissor\s+stair|stairs?\s+sharing\s+(?:a\s+)?common|two\s+(?:separate\s+)?exits?\b/i,
    label: "scissor-stair and separate-exit provisions",
    targets: [{ codePrefix: "BC", sectionPrefix: "1007.1.1" }]
  },
  {
    pattern: /\bone\s+exit\s+stair|single\s+stair|served\s+by\s+one\s+(?:exit\s+)?stair/i,
    label: "single-exit story provisions",
    targets: [{ codePrefix: "BC", sectionPrefix: "1006.3.2" }]
  },
  {
    pattern: /^(?![\s\S]*\b(?:plumbing fixtures?|fixture requirements?|fixture ratios?|fixture calculations?|fractional fixture)\b)[\s\S]*(?:\b(?:multipurpose|community)\s+(?:room|hall)\b|accessory\s+assembly|fewer\s+than\s+75)/i,
    label: "accessory-assembly classification and occupant-load provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "302.1" },
      { codePrefix: "BC", sectionPrefix: "303.1.3" },
      { codePrefix: "BC", sectionPrefix: "303.4" },
      { codePrefix: "BC", sectionPrefix: "1004.1.3" }
    ]
  },
  {
    pattern: /\b(?:architect(?:ural|s)?|engineer(?:ing|s)?|professional[- ]services?)\s+office\b|\boffice\b.*\b(?:occupancy\s+group|classif(?:y|ied|ication)|professional[- ]services?)\b|\b(?:occupancy\s+group|classif(?:y|ied|ication))\b.*\boffice\b/i,
    label: "office and professional-services occupancy classification provisions",
    targets: [{ codePrefix: "BC", sectionPrefix: "304.1" }]
  },
  {
    pattern: /\b(?:multiple|mixed)[- ]occupanc|\b(?:residential|apartments?|group\s+r)\b.*\b(?:commercial|retail|mercantile|group\s+m)\b|\b(?:commercial|retail|mercantile|group\s+m)\b.*\b(?:residential|apartments?|group\s+r)\b|\baccessory\s+(?:management\s+)?office\b/i,
    label: "multiple, mixed, and accessory occupancy provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "302.1" },
      { codePrefix: "BC", sectionPrefix: "304.1" },
      { codePrefix: "BC", sectionPrefix: "309.1" },
      { codePrefix: "BC", sectionPrefix: "310.4" },
      { codePrefix: "BC", sectionPrefix: "508.1" },
      { codePrefix: "BC", sectionPrefix: "508.2" },
      { codePrefix: "BC", sectionPrefix: "508.2.3" },
      { codePrefix: "BC", sectionPrefix: "508.3" },
      { codePrefix: "BC", sectionPrefix: "508.4" }
    ]
  },
  {
    pattern: /^(?![\s\S]*\b(?:plumbing fixtures?|fixture requirements?|fixture ratios?|fixture calculations?|fractional fixture)\b)[\s\S]*(?:\baccessory\s+occupanc|\b(?:office|room|space)\b.*\baccessory\b.*\b(?:principal|primary|residential)\b)/i,
    label: "accessory-occupancy classification and area provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "304.1" },
      { codePrefix: "BC", sectionPrefix: "508.2" },
      { codePrefix: "BC", sectionPrefix: "508.2.3" },
      { codePrefix: "BC", sectionPrefix: "508.2.4" }
    ]
  },
  {
    pattern: /\bincidental\s+uses?\b|\btreat(?:ed|ing)?\b.*\bincidental\b/i,
    label: "incidental-use classification, area, and protection provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "509.1" },
      { codePrefix: "BC", sectionPrefix: "509.3" },
      { codePrefix: "BC", sectionPrefix: "509.4" }
    ]
  },
  {
    pattern: /\bplumbing\s+fixtures?|fixture\s+(?:requirements?|ratios?|calculations?)|fractional\s+fixture/i,
    label: "plumbing-fixture classification and calculation provisions",
    targets: [
      { codePrefix: "PC", sectionPrefix: "403.1", includeDescendants: true },
      { codePrefix: "BC", sectionPrefix: "303.1.3" }
    ]
  },
  {
    pattern: /\bexisting\s+(?:plumbing\s+)?(?:system|installation)|same\s+(?:manner|route).*(?:arrangement)|ordinary\s+repair.*plumb/i,
    label: "existing plumbing installation repair provisions",
    targets: [
      { codePrefix: "PC", sectionPrefix: "102.2" },
      { codePrefix: "PC", sectionPrefix: "102.4" },
      { codePrefix: "PC", sectionPrefix: "102.4.1" }
    ]
  },
  {
    pattern: /\boccupant\s+load|movable\s+seats?|fixed\s+seats?|nonsimultaneous|load\s+factor/i,
    label: "occupant-load calculation provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "1004.1", includeDescendants: true },
      { codePrefix: "BC", sectionPrefix: "1004.3" }
    ]
  },
  {
    pattern: /\bminimum\s+number\s+of\s+(?:exits?|exit\s+access\s+doorways?)|\b(?:exits?|exit\s+access\s+doorways?)\s+required\b|\brequires?\s+(?:at\s+least\s+)?(?:one|two|three|four|\d+)\s+exits?\b/i,
    label: "number of exits from rooms and spaces",
    targets: [{ codePrefix: "BC", sectionPrefix: "1006.2.1" }]
  },
  {
    pattern: /\bcommon\s+path(?:\s+of\s+egress\s+travel)?\b/i,
    label: "common-path definition and limits",
    targets: [
      { codePrefix: "BC", sectionPrefix: "202" },
      { codePrefix: "BC", sectionPrefix: "1006.2.1" }
    ]
  },
  {
    pattern: /\bexit[- ]access[- ]travel[- ]distance\b|\btravel\s+distance\b.*\b(?:remote|exit)\b|\bremote\s+(?:occupiable\s+)?point\b.*\bexit\b/i,
    label: "exit-access travel-distance limits and measurement",
    targets: [
      { codePrefix: "BC", sectionPrefix: "1017.1" },
      { codePrefix: "BC", sectionPrefix: "1017.2" },
      { codePrefix: "BC", sectionPrefix: "1017.3" }
    ]
  },
  {
    pattern: /\bdead[- ]end(?:ed)?\s+(?:condition|corridor|length)?\b/i,
    label: "dead-end corridor limits and exceptions",
    targets: [{ codePrefix: "BC", sectionPrefix: "1020.4" }]
  },
  {
    pattern: /\b(?:egress\s+)?door\b.*\bclear\s+width\b|\bclear\s+width\b.*\b(?:egress\s+)?door\b|\bdoor\s+width\b.*\boccupants?\b/i,
    label: "egress-door clear width and capacity",
    targets: [
      { codePrefix: "BC", sectionPrefix: "1010.1.1.1" },
      { codePrefix: "BC", sectionPrefix: "1005.3.2" }
    ]
  },
  {
    pattern: /\bdoor\b.*\bswings?\b|\bswings?\b.*\bdirection\s+of\s+egress\b|\bdirection\s+of\s+egress\s+travel\b/i,
    label: "egress-door direction of swing",
    targets: [{ codePrefix: "BC", sectionPrefix: "1010.1.2.2" }]
  },
  {
    pattern: /\bcorridor\b.*\bfire[- ]resistance(?:[- ]rated)?\b|\bfire[- ]resistance\s+rating\b.*\bcorridor\b/i,
    label: "corridor construction and fire-resistance ratings",
    targets: [{ codePrefix: "BC", sectionPrefix: "1020.1" }]
  },
  {
    pattern: /\bshaft(?:\s+enclosure)?\b.*\bfire[- ]resistance\s+rating\b|\bfire[- ]resistance\s+rating\b.*\bshaft(?:\s+enclosure)?\b/i,
    label: "shaft-enclosure fire-resistance ratings",
    targets: [{ codePrefix: "BC", sectionPrefix: "713.4" }]
  },
  {
    pattern: /\bfire\s+barrier\b.*\bdoor\b|\bdoor\b.*\bfire\s+barrier\b|\bopening[- ]protective\b.*\brating\b/i,
    label: "fire-door opening-protective ratings",
    targets: [{ codePrefix: "BC", sectionPrefix: "716.5" }]
  },
  {
    pattern: /\btype\s+i{1,3}[ab]?\b|\bconstruction\s+type\b.*\b(?:structural\s+frame|exterior\s+walls?|floor|roof)\b/i,
    label: "construction-type and building-element ratings",
    targets: [
      { codePrefix: "BC", sectionPrefix: "602.2" },
      { codePrefix: "BC", sectionPrefix: "601.1" },
      { codePrefix: "BC", sectionPrefix: "602.1" }
    ]
  },
  {
    pattern: /\ballowable\b.*\b(?:stories|height)\b|\bpermits?\b.*\bnumber\s+of\s+stories\b|\bnumber\s+of\s+stories\b.*\bpermit(?:s|ted)?\b|\b(?:stories|height)\b.*\ballowable\b/i,
    label: "allowable building height and stories",
    targets: [
      { codePrefix: "BC", sectionPrefix: "504.3" },
      { codePrefix: "BC", sectionPrefix: "504.4" }
    ]
  },
  {
    pattern: /\bstory\s+above\s+grade\s+plane\b|\bgrade\s+plane\b.*\bstor(?:y|ies)\b|\bhigh[- ]rise\s+building\b|\bhighest\s+occupied\s+floor\b.*\bfire\s+department\b/i,
    label: "grade-plane, story, and high-rise definitions",
    targets: [{ codePrefix: "BC", sectionPrefix: "202" }]
  },
  {
    pattern: /\baccessible\s+route\b.*\b(?:entrance|room|space|connect)\b|\b(?:entrance|room|space)\b.*\baccessible\s+route\b/i,
    label: "accessible-route scoping",
    targets: [{ codePrefix: "BC", sectionPrefix: "1104.3" }]
  },
  {
    pattern: /\b(?:accessible|type\s+b\+?nyc|type\s+b)\s+units?\b|\bcategories\s+of\s+accessible\s+units?\b/i,
    label: "residential accessible-unit scoping",
    targets: [
      { codePrefix: "BC", sectionPrefix: "1107.6" },
      { codePrefix: "BC", sectionPrefix: "1107.6.1" },
      { codePrefix: "BC", sectionPrefix: "1107.6.1.1" },
      { codePrefix: "BC", sectionPrefix: "1107.6.1.2" },
      { codePrefix: "BC", sectionPrefix: "1107.6.2" },
      { codePrefix: "BC", sectionPrefix: "1107.6.2.1" },
      { codePrefix: "BC", sectionPrefix: "1107.6.2.2" },
      { codePrefix: "BC", sectionPrefix: "1107.6.3" },
      { codePrefix: "BC", sectionPrefix: "1107.7" },
      { codePrefix: "BC", sectionPrefix: "1107.7.4" }
    ]
  },
  {
    pattern: /\bmaneuvering\s+clearance\b.*\bdoor\b|\bdoor\s+configuration\b.*\baccessible\b|\bbathroom\b.*\baccessib(?:le|ility)\b/i,
    label: "accessible door and bathroom design scope",
    targets: [
      { codePrefix: "BC", sectionPrefix: "1101.2" },
      { codePrefix: "BC", sectionPrefix: "1107.2.1" },
      { codePrefix: "BC", sectionPrefix: "1107.2.2" }
    ]
  },
  {
    pattern: /\blegacy\s+fire[- ]alarm|prior[- ]code.*fire[- ]alarm|existing.*fire[- ]alarm|fire[- ]alarm.*enlargement/i,
    label: "existing fire-protection and Group B alarm provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "901.9.1" },
      { codePrefix: "BC", sectionPrefix: "901.9.2" },
      { codePrefix: "BC", sectionPrefix: "901.9.3" },
      { codePrefix: "BC", sectionPrefix: "907.2.2.2" }
    ]
  },
  {
    pattern: /\breplace(?:ment)?\b.*\b(?:entire|existing|legacy)\b|\b(?:entire|existing|legacy)\b.*\breplace(?:ment)?\b/i,
    label: "existing-system alteration scope provisions",
    targets: [{ codePrefix: "BC", sectionPrefix: "901.9.1" }]
  },
  {
    pattern: /^(?![\s\S]*\b(?:Certificate of Occupancy|Use Group renumbering)\b)[\s\S]*(?:\b(?:change|changes)\s+(?:in\s+)?(?:use|occupancy)|prior[- ]code.*accessib|alteration.*accessib)/i,
    label: "alteration and change-of-occupancy accessibility provisions",
    targets: [{ codePrefix: "BC", sectionPrefix: "1101.3", includeDescendants: true }]
  },
  {
    pattern: /\b(?:Group B\b[\s\S]*\bGroup M|Group M\b[\s\S]*\bGroup B)\b[\s\S]*\b(?:Certificate of Occupancy|accessib(?:le|ility)|Use Group renumbering)\b/i,
    label: "B-M change accessibility boundary",
    targets: [
      {
        codePrefix: "BC",
        sectionPrefix: "1101.3",
        useSelectedPassageOnly: true,
        selectedExcerptPatterns: [
          /The provisions of this chapter shall apply to alterations,[\s\S]*?Sections 1101\.3\.1 through 1101\.3\.5\./i
        ]
      },
      {
        codePrefix: "BC",
        sectionPrefix: "1101.3.1",
        useSelectedPassageOnly: true,
        selectedExcerptPatterns: [
          /Accessible features and construction governed by this chapter shall be provided:/i,
          /2\.\s*Throughout a space,[\s\S]*?New York City Zoning Resolution\./i
        ]
      }
    ]
  },
  {
    pattern: /\bsidewalk\s+caf[eé]|outdoor[- ]dining|exterior\s+seats?\b/i,
    label: "sidewalk-café and dining-surface accessibility provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "3111", includeDescendants: true },
      { codePrefix: "BC", sectionPrefix: "1108.2.9.1" }
    ]
  },
  {
    pattern: /\bflood\s+hazard\s+area\b|\bdesign\s+flood\s+elevation\b|\bbelow\b.*\bflood\s+elevation\b|\bfloodproof(?:ed|ing)?\b/i,
    label: "flood-hazard construction and protected-equipment provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "G301.1" },
      { codePrefix: "BC", sectionPrefix: "G301.2" },
      { codePrefix: "BC", sectionPrefix: "G304.1" },
      { codePrefix: "BC", sectionPrefix: "G304.2" },
      { codePrefix: "BC", sectionPrefix: "G304.3" },
      { codePrefix: "BC", sectionPrefix: "G304.4" },
      { codePrefix: "BC", sectionPrefix: "G501.1" }
    ]
  },
  {
    pattern: /\bsmoke\s+separation\b|\bsmoke\s+barrier\b|\bsmoke\s+partition\b/i,
    label: "smoke-barrier and smoke-partition provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "709.1" },
      { codePrefix: "BC", sectionPrefix: "709.3" },
      { codePrefix: "BC", sectionPrefix: "710.1" },
      { codePrefix: "BC", sectionPrefix: "710.3" }
    ]
  },
  {
    pattern: /\bhorizontal\s+assembl(?:y|ies)\b.*\bsupport|\bsupport(?:ed|ing)?\b.*\bhorizontal\s+assembl(?:y|ies)\b/i,
    label: "horizontal-assembly supporting-construction provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "711.2.3" },
      { codePrefix: "BC", sectionPrefix: "711.2.4" }
    ]
  },
  {
    pattern: /\bfireblocking\b.*\b(?:combustible\s+)?(?:exterior|concealed)\s+wall\b|\bcombustible\s+exterior\s+wall\b.*\bfireblocking\b/i,
    label: "combustible exterior-wall fireblocking provisions",
    targets: [{ codePrefix: "BC", sectionPrefix: "718.2.6", includeDescendants: true }]
  },
  {
    pattern: /\bmezzanine\b/i,
    label: "mezzanine definition and area-limit provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "202" },
      { codePrefix: "BC", sectionPrefix: "505.2", includeDescendants: true }
    ]
  },
  {
    pattern: /\bequipment\s+platform\b/i,
    label: "equipment-platform definition and area-limit provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "202" },
      { codePrefix: "BC", sectionPrefix: "505.3", includeDescendants: true }
    ]
  },
  {
    pattern: /\b(?:rooftop|roof)\b.*\b(?:penthouse|bulkhead)\b|\b(?:penthouse|bulkhead)\b.*\b(?:rooftop|roof)\b/i,
    label: "rooftop penthouse and bulkhead provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "202" },
      { codePrefix: "BC", sectionPrefix: "1510.2", includeDescendants: true }
    ]
  },
  {
    pattern: /\benclosed\s+(?:parking\s+)?garage|intermittent\s+(?:mechanical\s+)?ventilation|carbon\s+monoxide.*nitrogen\s+dioxide/i,
    label: "enclosed-parking-garage ventilation controls",
    targets: [
      { codePrefix: "MC", sectionPrefix: "404.1" },
      { codePrefix: "MC", sectionPrefix: "404.2" }
    ]
  },
  {
    pattern: /\bguard(?:s|rail|rails)?\b.*\b(?:roof|terrace|height|openings?|horizontal|load)|\b(?:roof|terrace)\b.*\bguard(?:s|rail|rails)?\b/i,
    label: "guard height, openings, and structural-load provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "1015.3" },
      { codePrefix: "BC", sectionPrefix: "1015.4" },
      { codePrefix: "BC", sectionPrefix: "1607.8.1" }
    ]
  },
  {
    pattern: /\bhandrails?\b.*\b(?:both\s+sides|continu(?:ous|ity)|landing|stop|terminate|extension)|\b(?:both\s+sides|landing)\b.*\bhandrails?\b/i,
    label: "stair handrail side, continuity, and extension provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "1011.11" },
      { codePrefix: "BC", sectionPrefix: "1014.4" },
      { codePrefix: "BC", sectionPrefix: "1014.6" }
    ]
  },
  {
    pattern: /\boccupied\s+roof\b|\broof\s+(?:terrace|deck)\b.*\b(?:story|stories|height)\b|\b(?:story|stories)\b.*\broof\s+(?:terrace|deck)\b/i,
    label: "occupied-roof, rooftop-structure, and story provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "202" },
      { codePrefix: "BC", sectionPrefix: "504.3" },
      { codePrefix: "BC", sectionPrefix: "1510.2" }
    ]
  },
  {
    pattern: /\b(?:interior|residential)\s+bathroom\b.*\b(?:window|ventilat|exhaust|terminate|discharge)|\bbathroom\b.*\b(?:no\s+(?:exterior\s+)?window|mechanical\s+exhaust)\b/i,
    label: "bathroom ventilation, exhaust-rate, and discharge provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "1203.5.1.3" },
      { codePrefix: "BC", sectionPrefix: "1203.5.2" },
      { codePrefix: "MC", sectionPrefix: "403.3" },
      { codePrefix: "MC", sectionPrefix: "403.3.1.1" },
      { codePrefix: "MC", sectionPrefix: "501.3" },
      { codePrefix: "MC", sectionPrefix: "501.3.1" }
    ]
  },
  {
    pattern: /\b(?:gas[- ]fired|fuel[- ]burning)\s+appliance\b.*\bcombustion\s+air\b|\bcombustion\s+air\b.*\b(?:gas[- ]fired|mechanical\s+room|appliance)\b/i,
    label: "fuel-gas appliance combustion-air provisions",
    targets: [
      { codePrefix: "FGC", sectionPrefix: "304.1" },
      { codePrefix: "FGC", sectionPrefix: "304.5" }
    ]
  },
  {
    pattern: /\bmixed[- ]use\b.*\b(?:fixtures?|water\s+closets?|lavator(?:y|ies)|required\s+number)\b|\b(?:restaurant|retail|office)\b.*\b(?:fixtures?|water\s+closets?|lavator(?:y|ies))\b.*\b(?:calculat|number|required)|\b(?:water\s+closets?|lavator(?:y|ies))\b.*\b(?:restaurant|retail|office|mixed[- ]use)\b/i,
    label: "mixed-use plumbing-fixture calculation provisions",
    targets: [
      { codePrefix: "PC", sectionPrefix: "403.1" },
      { codePrefix: "PC", sectionPrefix: "403.1.1" },
      { codePrefix: "PC", sectionPrefix: "403.3" },
      { codePrefix: "BC", sectionPrefix: "1004.1.2" },
      { codePrefix: "BC", sectionPrefix: "1004.1.3" }
    ]
  },
  {
    pattern: /\bsingle[- ]occupant\b.*\b(?:all[- ]gender|any\s+sex|toilet|fixture)|\ball[- ]gender\b.*\b(?:toilet|fixture)\b/i,
    label: "single-occupant toilet-room fixture-count provisions",
    targets: [
      { codePrefix: "PC", sectionPrefix: "403.1" },
      { codePrefix: "PC", sectionPrefix: "403.1.3" },
      { codePrefix: "PC", sectionPrefix: "403.2.2" }
    ]
  },
  {
    pattern: /\b(?:bottled\s+water|bottle[- ]filling|refrigerator\s+(?:water\s+)?dispenser|water\s+cooler)\b.*\b(?:drinking\s+fountains?|substitut)|\bdrinking\s+fountains?\b.*\b(?:bottled\s+water|dispenser|cooler|substitut)\b/i,
    label: "drinking-fountain and bottle-filling substitution provisions",
    targets: [
      { codePrefix: "PC", sectionPrefix: "403.1" },
      { codePrefix: "PC", sectionPrefix: "410.1" },
      { codePrefix: "PC", sectionPrefix: "410.2" },
      { codePrefix: "PC", sectionPrefix: "410.3" }
    ]
  },
  {
    pattern: /\brainscreen\b.*\b(?:special\s+inspection|inspect)|\b(?:exterior\s+wall|cladding|veneer)\b.*\bspecial\s+inspection\b/i,
    label: "exterior-wall special-inspection provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "1704.1" },
      { codePrefix: "BC", sectionPrefix: "1705.16" },
      { codePrefix: "BC", sectionPrefix: "1705.20" }
    ]
  },
  {
    pattern: /\b(?:electric[- ]vehicle|EVSE|level\s+2\s+charging|charging\s+stations?)\b.*\b(?:garage|parking\s+(?:spaces?|lot))\b|\b(?:garage|parking\s+(?:spaces?|lot))\b.*\b(?:electric[- ]vehicle|EVSE|charging)\b/i,
    label: "parking-facility electric-vehicle infrastructure provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "406.4.10" },
      { codePrefix: "BC", sectionPrefix: "406.9.8" }
    ]
  },
  {
    pattern: /\b(?:more\s+than\s+)?110\s*percent|floor\s+surface\s+area|prior[- ]code.*(?:enlargement|increase)|increase.*prior[- ]code/i,
    label: "prior-code building floor-surface-area provisions",
    targets: [
      { codePrefix: "AC", sectionPrefix: "28-101.4.5" },
      { codePrefix: "AC", sectionPrefix: "28-101.4.5.1" },
      { codePrefix: "AC", sectionPrefix: "28-101.4.5.2" }
    ]
  },
  {
    pattern: /\bwind\s+surface\s+area|lateral[- ]force\s+capacity|prior[- ]code.*wind|wind.*prior[- ]code/i,
    label: "prior-code structural wind provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "1601.2.4" },
      { codePrefix: "AC", sectionPrefix: "28-101.4.4" }
    ]
  },
  {
    pattern: /\bre-?establish(?:ing|ed|ment)?\b.*\b(?:use|occupancy)|\bformerly\s+lawful\s+(?:use|occupancy)|\bprior\s+(?:use|occupancy)\b.*\bresume/i,
    label: "existing-building occupancy re-establishment provisions",
    targets: [
      { codePrefix: "AC", sectionPrefix: "28-102.4" },
      { codePrefix: "AC", sectionPrefix: "28-102.4.2" },
      { codePrefix: "AC", sectionPrefix: "28-118.3.1" },
      { codePrefix: "AC", sectionPrefix: "28-118.3.2" }
    ]
  },
  {
    pattern: /\bmercantile\b.*\bbusiness\b|\bbusiness\b.*\bmercantile\b|\bcertificate\s+of\s+occupancy\b.*\b74\b|\bsame\s+zoning\s+use\s+group\b/i,
    label: "mercantile and business Certificate-of-Occupancy exception provisions",
    targets: [
      { codePrefix: "AC", sectionPrefix: "28-118.3" },
      { codePrefix: "AC", sectionPrefix: "28-118.3.1" },
      { codePrefix: "AC", sectionPrefix: "28-118.3.2" },
      { codePrefix: "BC", sectionPrefix: "901.9.2" },
      { codePrefix: "BC", sectionPrefix: "1101.3.1" }
    ]
  },
  {
    pattern: /\bfire\s+district\s+maps?|appendix\s+d.*maps?|staten\s+island.*fire\s+district|queens.*fire\s+district/i,
    label: "fire-district text and official-map provisions",
    targets: [
      { codePrefix: "AC", sectionPrefix: "28-102.4.5" },
      { codePrefix: "BC", sectionPrefix: "D106.1" }
    ]
  },
  {
    pattern: /\bthree[- ]fixture\s+bathroom|bathroom.*cellar|cellar.*(?:bathroom|illegal\s+conversion)/i,
    label: "cellar use and illegal-residential-conversion provisions",
    targets: [{ codePrefix: "AC", sectionPrefix: "28-210.1" }]
  }
];

const outsideLibrarySignals = [
  {
    pattern: /\bHCR\b/i,
    label: "HCR requirements",
    sourceName: "New York State Homes and Community Renewal",
    sourceURL: "https://hcr.ny.gov/"
  },
  {
    pattern: /\bzoning\b|\bZR\s*\d/i,
    label: "NYC Zoning Resolution Research",
    codePrefix: "ZR",
    sourceName: "NYC Zoning Resolution",
    sourceURL: "https://zr.planning.nyc.gov/"
  },
  {
    pattern: /\b(?:buildings?|DOB)\s+bulletin|\bBB\s*20\d{2}[-–]\d+\b/i,
    label: "NYC Buildings Bulletins",
    sourceName: "NYC Department of Buildings — Buildings Bulletins",
    sourceURL: "https://www.nyc.gov/site/buildings/codes/building-bulletins.page"
  },
  {
    pattern: /\b(?:Housing Maintenance Code|HMC)\b/i,
    label: "NYC Housing Maintenance Code",
    sourceName: "NYC Laws — Housing Maintenance Code",
    sourceURL: "https://www.nyc.gov/site/hpd/services-and-information/housing-maintenance-code.page"
  },
  {
    pattern: /\b(?:Existing Building Code|EBC)\b/i,
    label: "NYC Existing Building Code",
    sourceName: "NYC Department of Buildings — Existing Building Code",
    sourceURL: "https://www.nyc.gov/site/buildings/codes/existing-building-code.page"
  },
  {
    pattern: /\bFDNY\b|Fire Department/i,
    label: "Fire Department requirements",
    codePrefix: "FC",
    sourceName: "FDNY Fire Code and Rules",
    sourceURL: "https://www.nyc.gov/site/fdny/about/resources/code-and-rules/nyc-fire-code.page"
  },
  {
    pattern: /\bADA\b|federal accessibility/i,
    label: "federal accessibility requirements",
    sourceName: "U.S. Department of Justice — ADA",
    sourceURL: "https://www.ada.gov/"
  },
  {
    pattern: /\blandmarks?\b|LPC\b/i,
    label: "Landmarks requirements",
    sourceName: "NYC Landmarks Preservation Commission",
    sourceURL: "https://www.nyc.gov/site/lpc/index.page"
  },
  {
    pattern: /\bDEP\b|environmental protection/i,
    label: "environmental-agency requirements",
    sourceName: "NYC Department of Environmental Protection",
    sourceURL: "https://www.nyc.gov/site/dep/index.page"
  }
];

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function rawTokens(value) {
  return normalizedText(value).match(/[\p{L}\p{N}]+(?:[.-][\p{L}\p{N}]+)*/gu) || [];
}

function singularForms(token) {
  const forms = new Set([token]);
  if (token.length > 4 && token.endsWith("ies")) forms.add(`${token.slice(0, -3)}y`);
  if (token.length > 4 && token.endsWith("es")) forms.add(token.slice(0, -2));
  if (token.length > 3 && token.endsWith("s")) forms.add(token.slice(0, -1));
  return forms;
}

function queryTermWeights(question) {
  const weights = new Map();
  const add = (term, weight) => {
    const normalized = normalizedText(term);
    if (normalized.length < 2 || stopWords.has(normalized)) return;
    for (const form of singularForms(normalized)) {
      weights.set(form, Math.max(weights.get(form) || 0, weight));
    }
  };
  rawTokens(question).forEach((token) => add(token, /\d/.test(token) ? 1.45 : 1));
  conceptExpansions.forEach(({ pattern, terms }) => {
    if (pattern.test(question)) terms.forEach((term) => add(term, 0.56));
  });
  return weights;
}

function codeReferences(question) {
  const references = [];
  const seen = new Set();
  const add = (codePrefix, sectionNumber) => {
    const reference = {
      codePrefix: String(codePrefix || "").toUpperCase(),
      sectionNumber: String(sectionNumber || "")
    };
    const key = `${reference.codePrefix}:${reference.sectionNumber}`;
    if (!reference.codePrefix || !reference.sectionNumber || seen.has(key)) return;
    seen.add(key);
    references.push(reference);
  };
  const pattern = /\b(AC|BC|EBC|FC|FGC|MC|PC|ZR)\s*(?:(?:Sections?|Table)\s+|§\s*)?([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)\b/gi;
  for (const match of String(question || "").matchAll(pattern)) {
    add(match[1], match[2]);
  }
  const headingPattern = /\bSECTION\s+(AC|BC|EBC|FC|FGC|MC|PC|ZR)\s+[A-Z]?\d+(?:-\d+)?\s*:[^\n]{0,120}?\b([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)\b/gi;
  for (const match of String(question || "").matchAll(headingPattern)) {
    add(match[1], match[2]);
  }
  const bareSectionPattern = /\bSections?\s+([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)\b/gi;
  for (const match of String(question || "").matchAll(bareSectionPattern)) {
    add("*", match[1]);
  }
  return references;
}

function queryBigrams(question) {
  const tokens = rawTokens(question).filter((token) => token.length >= 3 && !stopWords.has(token));
  return tokens.slice(0, 50).flatMap((token, index) =>
    index ? [`${tokens[index - 1]} ${token}`] : []
  );
}

function comparableSectionID(value) {
  return String(value || "").trim();
}

function plainTextFromPublishedHTML(value) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#176;/gi, "°")
    .replace(/&#215;/gi, "×")
    .replace(/&#8211;|&#8212;/gi, "-")
    .replace(/&#8216;|&#8217;/gi, "'")
    .replace(/&#8220;|&#8221;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function positiveSpan(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isSafeInteger(parsed) && parsed > 1 ? parsed : 1;
}

function structuredRowsFromTableHTML(value) {
  return Array.from(String(value || "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi))
    .map((rowMatch) => ({
      cells: Array.from(rowMatch[1].matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi))
        .map((cellMatch) => {
          const attributes = cellMatch[2] || "";
          const rowSpan = attributes.match(/\browspan=["']?(\d+)/i)?.[1];
          const columnSpan = attributes.match(/\bcolspan=["']?(\d+)/i)?.[1];
          return {
            text: plainTextFromPublishedHTML(cellMatch[3]),
            rowSpan: positiveSpan(rowSpan),
            columnSpan: positiveSpan(columnSpan)
          };
        })
        .filter((cell) => cell.text)
    }))
    .filter((row) => row.cells.length);
}

function tableReferenceFromHTML(value) {
  const titledReferences = Array.from(
    String(value || "").matchAll(/\btitle=["']([^"']*\bTable\s+[A-Z]?\d+(?:\.[0-9A-Za-z-]+)*)[^"']*["']/gi)
  );
  if (titledReferences.length) {
    return plainTextFromPublishedHTML(titledReferences.at(-1)[1]);
  }
  const plainText = plainTextFromPublishedHTML(value);
  const references = Array.from(
    plainText.matchAll(/\b(?:AC|BC|EBC|FC|MC|PC)?\s*Table\s+[A-Z]?\d+(?:\.[0-9A-Za-z-]+)*/gi)
  );
  return references.at(-1)?.[0]?.replace(/\s+/g, " ").trim() || "Official table";
}

function comparableTableReference(value) {
  return normalizedText(value).replace(/^(?:ac|bc|ebc|fc|mc|pc|zr)\s+/, "");
}

export function visualSourceReferences(body) {
  const references = new Map();
  for (const block of body?.blocks || []) {
    for (const match of String(block.html || "").matchAll(/<img\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>/gi)) {
      let assetName = "";
      try {
        assetName = decodeURIComponent(match[2].split(/[?#]/)[0].split("/").at(-1) || "");
      } catch {
        continue;
      }
      if (!/^[a-zA-Z0-9._ -]+\.(?:avif|gif|jpe?g|png|webp)$/i.test(assetName)) continue;
      const attributes = `${match[1] || ""} ${match[3] || ""}`;
      const width = Number.parseFloat(attributes.match(/\bwidth=["']?([\d.]+)/i)?.[1] || "");
      const height = Number.parseFloat(attributes.match(/\bheight=["']?([\d.]+)/i)?.[1] || "");
      references.set(assetName, {
        assetName,
        displayWidth: Number.isFinite(width) && width > 0 ? width : null,
        displayHeight: Number.isFinite(height) && height > 0 ? height : null
      });
    }
  }
  return Array.from(references.values());
}

export function structuredRichSources(body) {
  const sources = [];
  const blocks = Array.isArray(body?.blocks) ? body.blocks : [];
  const zoningTables = Array.isArray(body?.zoning?.tables) ? body.zoning.tables : [];
  let zoningTableOrdinal = 0;
  const continuationHTML = (blockIndex) => {
    const fragments = [];
    for (let index = blockIndex + 1; index < blocks.length && fragments.length < 8; index += 1) {
      const block = blocks[index] || {};
      const html = String(block.html || "");
      const text = plainTextFromPublishedHTML(html || block.plainText || "");
      const isTableNote = /^(?:For SI\b|Footnotes?\b|[a-z]\.|\d+\b)/i.test(text) ||
        /class=["'][^"']*\bSmall\b/i.test(html);
      if (!isTableNote) break;
      fragments.push(html || String(block.plainText || ""));
    }
    return fragments.join("\n");
  };
  for (const [blockIndex, block] of blocks.entries()) {
    const html = String(block.html || "");
    if (!html) continue;
    const tableMatches = Array.from(html.matchAll(/<ScrollTable\b[\s\S]*?<\/ScrollTable>/gi));
    for (const [index, tableMatch] of tableMatches.entries()) {
      const precedingStart = Math.max(0, tableMatch.index - 2_500);
      const precedingHTML = html.slice(precedingStart, tableMatch.index);
      const anchorMatches = Array.from(
        precedingHTML.matchAll(/<a\b[^>]*\btitle=["'][^"']*\bTable\s+[A-Z]?\d+(?:\.[0-9A-Za-z-]+)*[^"']*["'][^>]*>/gi)
      );
      const captionOffset = anchorMatches.at(-1)?.index;
      const sourceStart = captionOffset === undefined
        ? tableMatch.index
        : precedingStart + captionOffset;
      const nextMatch = tableMatches[index + 1];
      const sourceEnd = nextMatch?.index ?? html.length;
      let precedingCaptionHTML = "";
      if (captionOffset === undefined && blockIndex > 0) {
        const previousHTML = String(blocks[blockIndex - 1]?.html || "");
        const previousAnchors = Array.from(
          previousHTML.matchAll(/<a\b[^>]*\btitle=["'][^"']*\bTable\s+[A-Z]?\d+(?:\.[0-9A-Za-z-]+)*[^"']*["'][^>]*>/gi)
        );
        const previousCaptionOffset = previousAnchors.at(-1)?.index;
        if (previousCaptionOffset !== undefined) {
          precedingCaptionHTML = previousHTML.slice(previousCaptionOffset);
        }
      }
      const followingNotesHTML = nextMatch ? "" : continuationHTML(blockIndex);
      const sourceHTML = [
        precedingCaptionHTML,
        html.slice(sourceStart, sourceEnd),
        followingNotesHTML
      ].filter(Boolean).join("\n");
      const reference = tableReferenceFromHTML(sourceHTML);
      const grids = Array.from(tableMatch[0].matchAll(/<table\b[\s\S]*?<\/table>/gi))
        .map((match) => ({ rows: structuredRowsFromTableHTML(match[0]) }))
        .filter((grid) => grid.rows.length);
      const rowCount = grids.reduce((count, grid) => count + grid.rows.length, 0);
      const text = plainTextFromPublishedHTML(sourceHTML);
      if (!text || !rowCount) continue;
      const contentHash = createHash("sha256")
        .update(JSON.stringify({ reference, text, grids }))
        .digest("hex");
      sources.push({
        id: `rich-source-${createHash("sha256")
          .update([
            String(block.id || ""),
            reference,
            contentHash
          ].join("\u001f"))
          .digest("hex")
          .slice(0, 24)}`,
        kind: "table",
        reference,
        blockID: String(block.id || "") || null,
        contentHash,
        text,
        textLength: text.length,
        rowCount,
        grids
      });
    }
    if (tableMatches.length || !/<table\b/i.test(html)) continue;

    for (const tableMatch of html.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
      const sourceTable = zoningTables[zoningTableOrdinal] || null;
      const sourceOrdinal = sourceTable?.ordinal ?? zoningTableOrdinal;
      zoningTableOrdinal += 1;
      const previousBlock = blocks[blockIndex - 1] || null;
      const previousHTML = String(previousBlock?.html || previousBlock?.plainText || "");
      const previousText = plainTextFromPublishedHTML(previousHTML);
      const precedingContextHTML = previousBlock?.kind !== "table" && (
        /\btable\b/i.test(previousText) ||
        (/^[A-Z0-9 ,&()\-/]+$/.test(previousText) && previousText.length <= 240)
      ) ? previousHTML : "";
      const followingNotesHTML = continuationHTML(blockIndex);
      const sourceHTML = [precedingContextHTML, tableMatch[0], followingNotesHTML]
        .filter(Boolean)
        .join("\n");
      const tableCount = Math.max(zoningTables.length, 1);
      const inferredReference = body?.sectionNumber
        ? `ZR Table ${body.sectionNumber}${tableCount > 1 ? ` (${sourceOrdinal + 1} of ${tableCount})` : ""}`
        : "Official table";
      const detectedReference = tableReferenceFromHTML(sourceHTML);
      const reference = String(sourceTable?.caption || sourceTable?.sourceAnchor || "").trim() ||
        (detectedReference === "Official table" ? inferredReference : detectedReference);
      const grids = [{ rows: structuredRowsFromTableHTML(tableMatch[0]) }]
        .filter((grid) => grid.rows.length);
      const rowCount = grids.reduce((count, grid) => count + grid.rows.length, 0);
      const text = plainTextFromPublishedHTML(sourceHTML);
      if (!text || !rowCount) continue;
      const contentHash = createHash("sha256")
        .update(JSON.stringify({ reference, text, grids }))
        .digest("hex");
      sources.push({
        id: String(sourceTable?.id || "").trim() || `rich-source-${createHash("sha256")
          .update([String(block.id || ""), reference, contentHash].join("\u001f"))
          .digest("hex")
          .slice(0, 24)}`,
        kind: "table",
        reference,
        blockID: String(block.id || "") || null,
        sourceID: String(sourceTable?.id || "").trim() || null,
        sourceOrdinal,
        sourceContentHash: String(sourceTable?.contentHash || "").trim() || null,
        contentHash,
        text,
        textLength: text.length,
        rowCount,
        grids
      });
    }
  }
  const amendmentHistory = Array.isArray(body?.zoning?.amendmentHistory)
    ? body.zoning.amendmentHistory
    : [];
  if (amendmentHistory.length) {
    const sectionNumber = String(body?.sectionNumber || "").trim();
    const reference = `Official NYC Planning amendment history${sectionNumber ? ` for ZR ${sectionNumber}` : ""}`;
    const sourceURL = String(body?.zoning?.amendmentHistorySourceURL || "").trim();
    const amendmentCell = (value, fallback) => ({
      text: String(value || fallback),
      rowSpan: 1,
      columnSpan: 1
    });
    const rows = amendmentHistory.map((event) => ({
      cells: [
        amendmentCell(event?.effectiveDate, "date unavailable"),
        amendmentCell(event?.reportNumber, "report number unavailable"),
        amendmentCell(event?.action, "action unavailable"),
        amendmentCell(event?.projectName, "project name unavailable"),
        amendmentCell(event?.notes, "notes unavailable"),
        amendmentCell(event?.reportURL, "report URL unavailable")
      ]
    }));
    const text = [
      reference,
      sourceURL ? `Metadata source: ${sourceURL}` : "",
      "This official metadata identifies amendment events and report links. It accompanies the current section text but does not reproduce every historical version of that section.",
      ...amendmentHistory.map((event) => [
        `Effective ${event?.effectiveDate || "date unavailable"}`,
        event?.reportNumber ? `CPC report ${event.reportNumber}` : "report number unavailable",
        event?.action || "action unavailable",
        event?.projectName || "project name unavailable",
        event?.notes || "",
        event?.reportURL || ""
      ].filter(Boolean).join(" — "))
    ].filter(Boolean).join("\n");
    const grids = [{
      rows: [{
        cells: [
          "Effective date",
          "CPC report",
          "Action",
          "Project",
          "Notes",
          "Report URL"
        ].map((text) => ({ text, rowSpan: 1, columnSpan: 1 }))
      }, ...rows]
    }];
    const contentHash = createHash("sha256")
      .update(JSON.stringify({ reference, text, grids }))
      .digest("hex");
    sources.push({
      id: `zoning-amendment-history-${createHash("sha256")
        .update([sectionNumber, sourceURL, contentHash].join("\u001f"))
        .digest("hex")
        .slice(0, 24)}`,
      kind: "amendment-history",
      reference,
      blockID: null,
      sourceURL: sourceURL || null,
      contentHash,
      text,
      textLength: text.length,
      rowCount: grids[0].rows.length,
      grids
    });
  }
  return sources;
}

function sectionText(section, body) {
  return [
    section.codePrefix,
    section.sectionNumber,
    section.title,
    section.headerLine,
    section.headingLine,
    ...(body?.blocks || []).map((block) => block.plainText || "")
  ].filter(Boolean).join("\n");
}

function passageSegments(body) {
  const segments = [];
  for (const block of body?.blocks || []) {
    const plainText = String(block.plainText || "").replace(/\s+/g, " ").trim();
    if (!plainText) continue;
    if (plainText.length <= 1_800) {
      segments.push({ blockID: String(block.id || ""), text: plainText });
      continue;
    }
    const sentences = plainText.split(/(?<=[.!?;:])\s+(?=[A-Z0-9(])/);
    let current = "";
    for (const sentence of sentences) {
      if (current && current.length + sentence.length + 1 > 1_600) {
        segments.push({ blockID: String(block.id || ""), text: current });
        current = "";
      }
      current = [current, sentence].filter(Boolean).join(" ");
    }
    if (current) segments.push({ blockID: String(block.id || ""), text: current });
  }
  return segments;
}

function sourceReviewRequirements(body, passage, richSources) {
  const imageReferences = visualSourceReferences(body);
  const requirements = [];
  if (imageReferences.length) {
    requirements.push({
      kind: "visual-source",
      count: imageReferences.length,
      reviewMode: "explicit-selection",
      maximumSelections: evidenceDiscoveryMaximumVisualSelections,
      assetNames: imageReferences.map((item) => item.assetName).slice(0, 50),
      text: `This section includes ${imageReferences.length} official ${imageReferences.length === 1 ? "image, figure, or map" : "images, figures, or maps"} that the proposed text passage does not capture. Review and explicitly select up to ${evidenceDiscoveryMaximumVisualSelections} applicable visual sources before preparing this evidence.`
    });
  }
  const tableReferences = Array.from(new Set(
    Array.from(String(passage?.text || "").matchAll(/\bTable\s+([A-Z]?\d+(?:\.[0-9A-Za-z-]+)*)/gi))
      .map((match) => `Table ${match[1]}`)
  ));
  const missingTableReferences = tableReferences.filter((reference) =>
    !(richSources || []).some((source) =>
      source.kind === "table" &&
      comparableTableReference(source.reference) === comparableTableReference(reference)
    )
  );
  if (missingTableReferences.length) {
    requirements.push({
      kind: "referenced-table",
      references: missingTableReferences,
      text: `The proposed passage refers to ${missingTableReferences.join(", ")} without including the table's complete structured values.`
    });
  }
  return requirements;
}

function passageScore(text, terms, bigrams) {
  const normalized = normalizedText(text);
  const tokens = new Set(rawTokens(normalized));
  let score = 0;
  let matched = 0;
  for (const [term, weight] of terms) {
    if (tokens.has(term) || normalized.includes(term)) {
      score += weight;
      matched += 1;
    }
  }
  score += bigrams.filter((bigram) => normalized.includes(bigram)).length * 1.2;
  if (/\bexception\b/i.test(text)) score += 0.35;
  if (/\b(section|table|chapter)\s+\d/i.test(text)) score += 0.18;
  return { score, matched };
}

function bestPassage(body, terms, bigrams) {
  const ranked = passageSegments(body)
    .map((segment) => ({
      ...segment,
      ...passageScore(segment.text, terms, bigrams)
    }))
    .sort((left, right) =>
      right.score - left.score ||
      right.matched - left.matched ||
      left.text.length - right.text.length
    );
  return ranked[0] || null;
}

function candidateDisplayBlock(body, passage) {
  const block = (body?.blocks || []).find((item) =>
    String(item?.id || "") === String(passage?.blockID || "")
  );
  if (!block) return null;
  const html = String(block.html || "").trim();
  if (!html) return null;
  return {
    kind: String(block.kind || "html"),
    html,
    plainText: String(block.plainText || passage.text || "")
  };
}

function candidateExplanation({ matchedTerms, section, passage, exactReference, matchedRoutes }) {
  const reasons = [];
  if (exactReference) reasons.push(`The question names ${section.codePrefix} ${section.sectionNumber}.`);
  if (matchedRoutes.length) {
    reasons.push(`It falls within the ${matchedRoutes.slice(0, 2).join(" and ")}.`);
  }
  if (matchedTerms.length) {
    reasons.push(`It matches ${matchedTerms.slice(0, 5).map((term) => `“${term}”`).join(", ")}.`);
  }
  if (/\bexception\b/i.test(passage?.text || "")) {
    reasons.push("The proposed passage contains exception language that needs professional review.");
  }
  if (/\b(section|table|chapter)\s+\d/i.test(passage?.text || "")) {
    reasons.push("The proposed passage includes a cross-reference that may require additional evidence.");
  }
  return reasons.join(" ") || "Its enacted text has lexical overlap with the project question.";
}

export function evidenceDiscoveryFeatureEnabled(environment = process.env) {
  return String(environment.PERMITEXT_EVIDENCE_DISCOVERY_BETA || "").trim() === "1";
}

export function validateEvidenceDiscoveryQuestion(value) {
  const question = String(value || "").replace(/\s+/g, " ").trim();
  if (question.length < 3 || question.length > 2_000) {
    throw new Error("Evidence discovery questions must contain between 3 and 2,000 characters.");
  }
  return question;
}

export async function discoverRelevantEvidence({
  question,
  retrievalContext = null,
  catalog,
  invertedIndex,
  readSectionBody,
  resolveVisualSource,
  availableCodePrefixes = [],
  limit = 8
}) {
  const normalizedQuestion = validateEvidenceDiscoveryQuestion(question);
  const sections = Array.isArray(catalog) ? catalog : [];
  const index = invertedIndex instanceof Map ? invertedIndex : new Map();
  const terms = queryTermWeights(normalizedQuestion);
  const bigrams = queryBigrams(normalizedQuestion);
  const references = codeReferences(normalizedQuestion);
  const relevanceComparison = retrievalContext?.relevanceComparison === true;
  const comparisonReferenceKeys = new Set(
    relevanceComparison
      ? codeReferences([
          retrievalContext?.currentQuestion,
          retrievalContext?.immediateContext
        ].filter(Boolean).join("\n")).map((reference) =>
          `${reference.codePrefix}:${reference.sectionNumber}`
        )
      : []
  );
  const catalogByID = new Map(sections.map((section) => [comparableSectionID(section.id), section]));
  const scores = new Map();
  const matchedTermsByID = new Map();
  const exactReferenceIDs = new Set();
  const routesByID = new Map();

  for (const reference of references) {
    sections.filter((section) =>
      (reference.codePrefix === "*" || String(section.codePrefix || "").toUpperCase() === reference.codePrefix) &&
      String(section.sectionNumber || "") === reference.sectionNumber
    ).forEach((section) => exactReferenceIDs.add(comparableSectionID(section.id)));
  }
  for (const route of topicRoutes.filter(({ pattern }) => pattern.test(normalizedQuestion))) {
    for (const target of route.targets) {
      for (const section of sections) {
        const sectionNumber = String(section.sectionNumber || "");
        if (
          String(section.codePrefix || "").toUpperCase() !== target.codePrefix ||
          (
            sectionNumber !== target.sectionPrefix &&
            !(target.includeDescendants && sectionNumber.startsWith(`${target.sectionPrefix}.`))
          )
        ) {
          continue;
        }
        const id = comparableSectionID(section.id);
        const routeMatch = routesByID.get(id) || {
          score: 0,
          labels: new Set(),
          exactTarget: false,
          useSelectedPassageOnly: false,
          selectedExcerptPatterns: []
        };
        routeMatch.score += 45;
        routeMatch.labels.add(route.label);
        if (sectionNumber === target.sectionPrefix) {
          routeMatch.exactTarget = true;
          routeMatch.useSelectedPassageOnly ||= target.useSelectedPassageOnly === true;
          if (Array.isArray(target.selectedExcerptPatterns)) {
            routeMatch.selectedExcerptPatterns.push(...target.selectedExcerptPatterns);
          }
        }
        routesByID.set(id, routeMatch);
      }
    }
  }

  for (const [term, weight] of terms) {
    const posting = index.get(term);
    const postingSize = Number(posting?.size ?? posting?.length ?? 0);
    if (!postingSize) continue;
    const inverseFrequency = Math.log((sections.length + 1) / (postingSize + 1)) + 1;
    for (const rawID of posting) {
      const id = comparableSectionID(rawID);
      if (!catalogByID.has(id)) continue;
      scores.set(id, (scores.get(id) || 0) + weight * inverseFrequency);
      const matches = matchedTermsByID.get(id) || new Set();
      matches.add(term);
      matchedTermsByID.set(id, matches);
    }
  }
  exactReferenceIDs.forEach((id) => scores.set(id, (scores.get(id) || 0) + 100));
  routesByID.forEach(({ score }, id) => scores.set(id, (scores.get(id) || 0) + score));

  const preliminary = Array.from(scores, ([id, score]) => ({ id, score }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 160);
  const detailed = [];
  for (const entry of preliminary) {
    const section = catalogByID.get(entry.id);
    const body = await readSectionBody(section);
    const fullText = sectionText(section, body);
    if (!fullText.trim()) continue;
    const normalizedFullText = normalizedText(fullText);
    const matchedTerms = Array.from(matchedTermsByID.get(entry.id) || [])
      .filter((term) => normalizedFullText.includes(term));
    const originalTerms = rawTokens(normalizedQuestion)
      .filter((term) => term.length >= 2 && !stopWords.has(term));
    const originalMatches = new Set(
      originalTerms.filter((term) => normalizedFullText.includes(term))
    );
    const coverage = originalTerms.length
      ? originalMatches.size / new Set(originalTerms).size
      : 0;
    const titleText = normalizedText(`${section.sectionNumber || ""} ${section.title || ""}`);
    const titleMatches = originalTerms.filter((term) => titleText.includes(term)).length;
    const phraseMatches = bigrams.filter((bigram) => normalizedFullText.includes(bigram)).length;
    const exactReference = exactReferenceIDs.has(entry.id);
    const routeMatch = routesByID.get(entry.id);
    const contextualReference = Boolean(
      relevanceComparison &&
      exactReference &&
      !routeMatch &&
      (
        comparisonReferenceKeys.has(
          `${String(section.codePrefix || "").toUpperCase()}:${String(section.sectionNumber || "")}`
        ) || comparisonReferenceKeys.has(`*:${String(section.sectionNumber || "")}`)
      )
    );
    let passage = bestPassage(body, terms, bigrams);
    if (!passage) continue;
    if (routeMatch?.useSelectedPassageOnly && routeMatch.selectedExcerptPatterns.length) {
      const selectedExcerpts = routeMatch.selectedExcerptPatterns
        .map((pattern) => fullText.match(pattern)?.[0]?.trim() || "")
        .filter(Boolean);
      if (selectedExcerpts.length === routeMatch.selectedExcerptPatterns.length) {
        passage = {
          ...passage,
          text: selectedExcerpts.join("\n\n"),
          blockID: null
        };
      }
    }
    const richSources = structuredRichSources(body);
    const reviewRequirements = sourceReviewRequirements(body, passage, richSources);
    const visualSources = [];
    if (typeof resolveVisualSource === "function") {
      for (const reference of visualSourceReferences(body)) {
        try {
          const source = await resolveVisualSource(reference);
          if (source) visualSources.push(source);
        } catch {
          // Missing or unreadable assets remain represented by the blocking source-review requirement.
        }
      }
    }
    const passageTableReferences = Array.from(new Set(
      Array.from(String(passage.text || "").matchAll(/\bTable\s+([A-Z]?\d+(?:\.[0-9A-Za-z-]+)*)/gi))
        .map((match) => `Table ${match[1]}`)
    ));
    const applicableRichSources = richSources.filter((source) =>
      passageTableReferences.some((reference) =>
        comparableTableReference(source.reference) === comparableTableReference(reference)
      )
    );
    const displayBlock = candidateDisplayBlock(body, passage);
    const finalScore = entry.score +
      coverage * 12 +
      titleMatches * 2.6 +
      phraseMatches * 1.5 +
      passage.score * 1.2 +
      (routeMatch?.score || 0) +
      (exactReference ? 100 : 0);
    detailed.push({
      section,
      passage,
      score: finalScore,
      coverage,
      exactReference,
      contextualReference,
      exactTopicRouteTarget: Boolean(routeMatch?.exactTarget),
      useSelectedPassageOnly: routeMatch?.useSelectedPassageOnly === true,
      matchedRoutes: Array.from(routeMatch?.labels || []),
      matchedTerms: Array.from(new Set([...matchedTerms, ...originalMatches])),
      sourceReviewRequirements: reviewRequirements,
      richSources: applicableRichSources,
      visualSources,
      displayBlock
    });
  }

  detailed.sort((left, right) =>
    Number(right.exactTopicRouteTarget) - Number(left.exactTopicRouteTarget) ||
    Number(right.exactReference && !right.contextualReference) -
      Number(left.exactReference && !left.contextualReference) ||
    Number(right.contextualReference) - Number(left.contextualReference) ||
    right.score - left.score ||
    right.coverage - left.coverage ||
    String(left.section.sectionNumber || "").localeCompare(
      String(right.section.sectionNumber || ""),
      undefined,
      { numeric: true, sensitivity: "base" }
    )
  );
  const candidateLimit = Math.min(
    Math.max(Number(limit) || 8, 1),
    evidenceDiscoveryMaximumCandidates
  );
  const topScore = detailed[0]?.score || 1;
  const candidates = detailed.slice(0, candidateLimit).map((item, index) => {
    const relativeScore = item.score / topScore;
    const candidateID = `evidence-candidate-${createHash("sha256")
      .update([
        evidenceDiscoveryVersion,
        normalizedQuestion,
        item.section.id,
        item.passage.text
      ].join("\u001f"))
      .digest("hex")
      .slice(0, 24)}`;
    return {
      id: candidateID,
      candidateState: "candidate",
      rank: index + 1,
      relevance: relativeScore >= 0.72 ? "strong" : relativeScore >= 0.42 ? "possible" : "exploratory",
      score: Math.round(item.score * 1_000) / 1_000,
      sectionID: comparableSectionID(item.section.id),
      codePrefix: String(item.section.codePrefix || ""),
      chapterNumber: String(item.section.chapterNumber || ""),
      sectionNumber: String(item.section.sectionNumber || ""),
      title: String(item.section.title || "Section"),
      jurisdiction: String(item.section.jurisdiction || ""),
      codeEdition: String(item.section.codeEdition || ""),
      codeVersion: String(item.section.codeVersion || ""),
      corpusID: String(item.section.corpusID || ""),
      corpusLabel: String(item.section.corpusLabel || ""),
      applicabilityStatus: String(item.section.applicabilityStatus || ""),
      selectedText: item.passage.text,
      displayBlock: item.displayBlock,
      blockID: item.passage.blockID || null,
      preparationEligible: item.sourceReviewRequirements.length === 0,
      sourceReviewRequirements: item.sourceReviewRequirements,
      richSourceIDs: item.richSources.map((source) => source.id),
      richSources: item.richSources.map((source) => ({
        id: source.id,
        kind: source.kind,
        reference: source.reference,
        contentHash: source.contentHash,
        textLength: source.textLength,
        rowCount: source.rowCount,
        reviewState: "candidate"
      })),
      visualSourceIDs: item.visualSources.map((source) => source.id),
      visualSources: item.visualSources.map((source) => ({
        id: source.id,
        kind: source.kind,
        assetName: source.assetName,
        assetURL: source.assetURL,
        mediaType: source.mediaType,
        contentHash: source.contentHash,
        byteLength: source.byteLength,
        displayWidth: source.displayWidth,
        displayHeight: source.displayHeight,
        reviewState: "candidate"
      })),
      whyRelevant: candidateExplanation(item),
      signals: {
        matchedTerms: item.matchedTerms.slice(0, 12),
        topicRoutes: item.matchedRoutes,
        exactTopicRouteTarget: item.exactTopicRouteTarget,
        useSelectedPassageOnly: item.useSelectedPassageOnly,
        exactReference: item.exactReference,
        contextualReference: item.contextualReference,
        relevanceComparison,
        requiresAdditionalSourceReview: item.sourceReviewRequirements.length > 0,
        containsVisualSource: item.sourceReviewRequirements.some((requirement) => requirement.kind === "visual-source"),
        referencesTable: /\bTable\s+[A-Z]?\d/i.test(item.passage.text),
        includesStructuredTable: item.richSources.some((source) => source.kind === "table"),
        containsException: /\bexception\b/i.test(item.passage.text),
        containsCrossReference: /\b(section|table|chapter)\s+\d/i.test(item.passage.text)
      }
    };
  });

  const coverageLimitations = [{
    kind: "candidate-review-required",
    text: "These are unapproved candidates. Only passages you approve can enter Analyze Selected Evidence."
  }, {
    kind: "retrieval-completeness",
    text: "Lexical retrieval can miss exceptions, cross-references, tables, definitions, or requirements expressed with different terminology."
  }];
  if (candidates.some((candidate) =>
    candidate.sourceReviewRequirements.some((requirement) => requirement.kind === "visual-source")
  )) {
    coverageLimitations.push({
      kind: "visual-source-review-required",
      text: "At least one candidate depends on an official image, figure, or map that is not captured by its text passage. Review and explicitly select the applicable visual source before preparing that candidate."
    });
  }
  if (candidates.some((candidate) =>
    candidate.sourceReviewRequirements.some((requirement) => requirement.kind === "referenced-table")
  )) {
    coverageLimitations.push({
      kind: "referenced-table-review-required",
      text: "At least one candidate refers to a table whose complete structured values are not in the proposed passage. That candidate cannot be prepared until the table itself can be reviewed as evidence."
    });
  }
  if (/\b(this|that|the above|attached)\s+(section|passage|requirement)\b/i.test(normalizedQuestion) && !references.length) {
    coverageLimitations.push({
      kind: "query-context-required",
      text: "The question refers to a section without identifying it. Add the code citation or open the section and select its enacted text."
    });
  }
  const availablePrefixSet = new Set(
    (Array.isArray(availableCodePrefixes) ? availableCodePrefixes : [])
      .map((prefix) => String(prefix || "").trim().toUpperCase())
      .filter(Boolean)
  );
  const outsideCurrentLibrary = Array.from(new Map(outsideLibrarySignals
    .filter(({ pattern, codePrefix }) =>
      pattern.test(normalizedQuestion) && (!codePrefix || !availablePrefixSet.has(codePrefix))
    )
    .map(({ label, sourceName, sourceURL }) => [label, {
      kind: "outside-current-library",
      label,
      sourceName,
      sourceURL,
      text: `${label} may require authoritative material outside the corpora routed for this Research turn.`
    }])).values());
  if (outsideCurrentLibrary.length) {
    coverageLimitations.push({
      kind: "outside-current-library",
      text: "The current candidate set does not establish requirements controlled by the outside authorities identified below."
    });
  }

  return {
    schemaVersion: 2,
    retrievalVersion: evidenceDiscoveryVersion,
    candidateDisplayVersion: evidenceCandidateDisplayVersion,
    question: normalizedQuestion,
    candidateState: "unreviewed",
    candidates,
    coverageLimitations,
    outsideCurrentLibrary,
    searchedSectionCount: sections.length
  };
}
