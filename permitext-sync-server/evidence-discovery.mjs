import { researchQuestionSubject } from "./research-question-subject.mjs";
import { researchEquipmentSearchIntent, researchEquipmentSubjectMatches } from "./research-equipment-search-intent.mjs";
import { researchSearchVocabulary, researchSearchVocabularyMatches, researchPositiveSearchText, researchGasEquipmentVocabulary } from "./research-search-vocabulary.mjs";
import { createHash } from "node:crypto";
import { researchTechnicalTopicRoutes } from "./research-technical-topic-routes.mjs";
import { researchZoningQuestionText } from "./research-corpus-registry.mjs";
import { searchResearchPassages } from "./research-passage-index.mjs";
import { researchCurrentRuleDetailScore, researchCheckedRuleIndexPassage } from "./research-rule-packets.mjs";
import { researchEmbeddedDefinitionCarrier, researchRequestedDefinitionMatch,
  researchActiveHumanDefinitionMatch } from "./research-definition-excerpts.mjs";
import { boundCanonicalRulePassage, nominateDelegatedRuleGroups, nominateNearestCompleteIndexedRuleGroup, researchImmediateChildDetailGain } from "./research-rule-groups.mjs";
import { nominateResearchChapterScopeCandidates } from "./research-chapter-scope-context.mjs";
import { researchCurrentPurposeTerms, researchCurrentPurposeMatches, researchCurrentEditionContext } from "./research-current-purpose.mjs";

export const evidenceDiscoveryVersion = "20261004-current-purpose-edition-recall-v67";
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
    pattern: /^(?=[\s\S]*\b(?:drain\w*|sewer|pipe|piping)\b)(?=[\s\S]*\b(?:fall|slope|sloping|gradient)\b)/i,
    terms: ["slope", "sloping", "drainage", "piping", "horizontal"]
  },
  {
    pattern: /\b(?:water|lavator\w*|shower\w*|faucet\w*|sink\w*)\b[\s\S]*\b(?:temperature|scald\w*)\b|\b(?:temperature|scald\w*)\b[\s\S]*\b(?:water|lavator\w*|shower\w*|faucet\w*|sink\w*)\b/i,
    terms: ["tempered", "thermostatic", "temperature"]
  },
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
    pattern: /\bramps?\b/i,
    terms: ["ramp", "ramps", "slope", "rise", "landing", "handrail", "edge", "protection"]
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

const separateToiletFacilitiesCue = /\bseparate\s+(?:male\s+and\s+female|men(?:'s)?\s+and\s+women(?:'s)?|(?:toilet\s+)?facilities\s+for\s+(?:each|both)\s+sex)|\bsex[- ]separat\w*\s+(?:toilet\s+)?facilities\b/i;

function stipulatedSeparateFacilitiesQuestion(question) {
  const statedLoad = /\b(?:total\s+)?occupant\s+load\s+(?:(?:of|is|equals)\s+)?\d+\b/i.test(question);
  const statedFixtureSufficiency = /\b(?:required\s+)?fixture\s+count\s+(?:can\s+be\s+satisfied|(?:is|has\s+been)\s+(?:already\s+)?(?:satisfied|met))\b/i.test(question);
  const calculationRequest = /\b(?:calculate|recalculate|determine|verify|check|reassess)\b[^.!?]*\b(?:occupant\s+load|fixture\s+count|fixtures?)\b|\b(?:how\s+many|what\s+(?:is|are))\b[^.!?]*\b(?:occupant\s+load|fixture\s+count|fixtures?)\b|\b(?:occupant\s+load|fixture\s+count)\b[^.!?]*\b(?:correct|valid|adequate|sufficient)\b/i.test(question);
  return separateToiletFacilitiesCue.test(question) && statedLoad && statedFixtureSufficiency && !calculationRequest;
}

export function stipulatedFountainSubstitutionQuestion(question) {
  // A declared required count is the premise of a substitution comparison.
  // Questions about whether that count is required still need applicability
  // and fixture-table evidence. Exact citations remain independently selected.
  const statedRequirement = /\b(?:is|are)\s+required\s+(?:to\s+provide\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+drinking[- ]fountains?\b[^?]*[.;]/i.test(question);
  const substitution = /\b(?:bottle[- ]filling|substitut\w*|replac\w*)\b/i.test(question);
  const premiseInquiry = /\b(?:calculate|recalculate|determine|verify|check|reassess)\b[^.!?]*\b(?:required\s+(?:count|number)|fountain\s+(?:count|requirement))\b|\b(?:how\s+many)\b[^.!?]*\bfountains?\b[^.!?]*\brequired\b|(?:^|[.!?]\s+)(?:is|are|must|does)\b[^.!?]*\b(?:require\w*|exempt\w*)\b|\b(?:count|requirement)\b[^.!?]*\b(?:correct|valid)\b/i.test(question);
  return statedRequirement && substitution && !premiseInquiry;
}

const topicRoutes = [
  {
    pattern: /^(?=[\s\S]*\bsprinklers?\b)(?=[\s\S]*\b(?:required?|requires?|needs?|triggers?)\b)/i,
    label: "sprinkler applicability and occupancy-based triggers",
    // Branches need applicability review, not mandatory coverage of every use.
    targets: ["903.2", "901.9"]
      .map(sectionPrefix => ({ codePrefix: "BC", codeEdition: "2022", sectionPrefix, includeDescendants: true, rootClaimCoverage: false, descendantClaimCoverage: false }))
  },
  ...researchTechnicalTopicRoutes,
  {
    pattern: separateToiletFacilitiesCue,
    label: "separate-sex toilet facilities and employee/public arrangements",
    targets: [
      { codePrefix: "PC", sectionPrefix: "403.2", descendantClaimCoverage: false },
      { codePrefix: "PC", sectionPrefix: "403.3", descendantClaimCoverage: false }
    ]
  },
  {
    pattern: /\bducts?\b.*\bfire[- ]barriers?\b|\bfire[- ]barriers?\b.*\b(?:ducts?|dampers?)\b/i,
    label: "duct penetrations of fire barriers and damper exceptions",
    targets: [{ codePrefix: "BC", sectionPrefix: "717.5.2" }]
  },
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
    pattern: /^(?=[\s\S]*\bC4-4D\b)(?=[\s\S]*\bR8A\b)(?=[\s\S]*\b(?:similar|compare|comparison|difference|same|equivalent)\b)/i,
    label: "C4-4D and R8A current bulk comparison",
    targets: [
      { codePrefix: "ZR", sectionPrefix: "34-112" },
      { codePrefix: "ZR", sectionPrefix: "23-22" },
      { codePrefix: "ZR", sectionPrefix: "23-432" },
      { codePrefix: "ZR", sectionPrefix: "33-122" }
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
    pattern: /\bexterior[- ]walls?\b.*\b(?:lot\s+line|fire[- ]separation\s+distance|unprotected\s+(?:window|opening)|fire[- ]resistance\s+rating)\b|\b(?:windows?|openings?)\b.*\bexterior[- ]walls?\b.*\b(?:percent(?:age)?|calculat\w*|allowable)\b/i,
    label: "exterior-wall rating and opening-area provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "602.1" },
      { codePrefix: "BC", sectionPrefix: "705.8" },
      { codePrefix: "BC", sectionPrefix: "705.8.1" },
      { codePrefix: "BC", sectionPrefix: "202" }
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
      { codePrefix: "BC", sectionPrefix: "303.1.2", codeEdition: "2022" },
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
    pattern: /\b(?:plumbing\s+)?fixture\s+(?:counts?|requirements?|ratios?|calculations?)|fractional\s+fixture|\b(?:how\s+many|minimum\s+(?:number|count))\b[\s\S]*\b(?:plumbing\s+)?fixtures?\b|\bplumbing\s+fixtures?\b[\s\S]*\b(?:count|calculat|number|occupanc)/i,
    label: "plumbing-fixture classification and calculation provisions",
    calculationScope: true,
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
    calculationScope: true,
    targets: [
      { codePrefix: "BC", sectionPrefix: "1004.1", includeDescendants: true, rootClaimCoverage: false, descendantClaimCoverage: false },
      { codePrefix: "BC", sectionPrefix: "1004.1.2" },
      { codePrefix: "BC", sectionPrefix: "1004.1.3", descendantClaimCoverage: false },
      { codePrefix: "BC", sectionPrefix: "1004.3", rootClaimCoverage: false }
    ]
  },
  {
    pattern: /\b(?:required\s+)?(?:number|count)\s+of\s+exits?\b|\bexit[- ]count\b|\bhow\s+many\s+exits?\b|\bminimum\s+number\s+of\s+(?:exits?|exit\s+access\s+doorways?)|\b(?:exits?|exit\s+access\s+doorways?)\s+required\b|\brequires?\s+(?:at\s+least\s+)?(?:one|two|three|four|\d+)\s+exits?\b/i,
    label: "number of exits from rooms, spaces, and stories",
    targets: [
      { codePrefix: "BC", sectionPrefix: "1006.2.1", includeDescendants: true },
      { codePrefix: "BC", sectionPrefix: "1006.3", includeDescendants: true }
    ]
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
    pattern: /\b(?:egress\s+)?doors?\b.*\bclear\s+(?:opening\s+)?width\b|\bclear\s+(?:opening\s+)?width\b.*\b(?:egress\s+)?doors?\b|\bdoor\s+width\b.*\boccupants?\b/i,
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
    pattern: /^(?=[\s\S]*\b(?:hall|hallway|corridor)\b)(?=[\s\S]*\b(?:minimum|width|wide|fire\s+escape|exit)\b)(?=[\s\S]*\b(?:ADA|accessible|accessibility|fire\s+escape|exit)\b)/i,
    label: "corridor width and accessible-route applicability",
    targets: [
      { codePrefix: "BC", sectionPrefix: "1020.2", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "1018.2", codeEdition: "2014" },
      { codePrefix: "BC", sectionPrefix: "1101.2" },
      { codePrefix: "BC", sectionPrefix: "1103.2" },
      { codePrefix: "BC", sectionPrefix: "1104.3" }
    ]
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
    pattern: /^(?=[\s\S]*\b(?:vision\s+(?:light|lite|panel)|door\s+glazing|glazing\s+in\s+(?:a\s+)?door)\b)(?=[\s\S]*\b(?:fire[- ]rated|rated\s+door|maximum|size|square\s+(?:inch|inches|feet|foot)|sq\s*(?:in|ft))\b)/i,
    label: "fire-door vision glazing size and listing provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "716.5.5.1", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "716.5.7.1.1", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "716.5.8.1", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "716.5.8.1.1", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "716.5.8.1.2.1", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "716.5.8.1.2.2", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "715.4.7.1", codeEdition: "2014" }
    ]
  },
  {
    pattern: /\btype\s+(?:i{1,3}|iv|v)[ab]\b|\btype\s+(?:i{1,3}|iv|v)\s+(?:construction|buildings?)\b|\bconstruction\s+type\b.*\b(?:structural\s+frame|exterior\s+walls?|floor|roof)\b|\b(?:structural\s+frame|building\s+elements?)\b.*\b(?:fire[- ]resistance|ratings?)\b|\b(?:fire[- ]resistance|ratings?)\b.*\b(?:structural\s+frame|building\s+elements?)\b/i,
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
    pattern: /^(?=[\s\S]*\b(?:habitable\s+(?:room|space)|bedroom)\b)(?=[\s\S]*\b(?:minimum|square\s+(?:feet|foot)|sq\s*ft|dimension|width|distance\s+between\s+walls?)\b)/i,
    label: "habitable-room minimum area and plan dimensions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "1208.1" },
      { codePrefix: "BC", sectionPrefix: "1208.3.1" }
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
    pattern: /^(?![\s\S]*\b(?:construction[- ]site|construction\s+ramp|runway|motor[- ]vehicle|vehicular)\b)(?=[\s\S]*\bramps?\b)(?=[\s\S]*\b(?:design|designing|requirements?|accessible|accessibility|pedestrian|slope|rise|landing|handrails?|edge\s+protection)\b)/i,
    label: "pedestrian ramp design and accessibility provisions",
    targets: [
      { codePrefix: "BC", sectionPrefix: "1101.2", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "1012.1", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "1012.2", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "1012.3", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "1012.4", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "1012.5.1", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "1012.6", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "1012.7.1", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "1012.8", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "1012.10", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "1010.1", codeEdition: "2014" },
      { codePrefix: "BC", sectionPrefix: "1010.2", codeEdition: "2014" },
      { codePrefix: "BC", sectionPrefix: "1010.3", codeEdition: "2014" },
      { codePrefix: "BC", sectionPrefix: "1010.4", codeEdition: "2014" },
      { codePrefix: "BC", sectionPrefix: "1010.5.1", codeEdition: "2014" },
      { codePrefix: "BC", sectionPrefix: "1010.6", codeEdition: "2014" },
      { codePrefix: "BC", sectionPrefix: "1010.6.3", codeEdition: "2014" },
      { codePrefix: "BC", sectionPrefix: "1010.6.4", codeEdition: "2014" },
      { codePrefix: "BC", sectionPrefix: "1010.7.1", codeEdition: "2014" },
      { codePrefix: "BC", sectionPrefix: "1010.7.2", codeEdition: "2014" },
      { codePrefix: "BC", sectionPrefix: "1010.8", codeEdition: "2014" },
      { codePrefix: "BC", sectionPrefix: "1010.9", codeEdition: "2014" }
    ]
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
    pattern: /\b(?:BC\s*[- ]?)?Appendix\s+P\b/i,
    label: "Building Code Appendix P current and prior-edition status",
    targets: [
      { codePrefix: "BC", sectionPrefix: "P", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "1101.2", excludedEditions: ["2014"] },
      { codePrefix: "BC", sectionPrefix: "P101.1", codeEdition: "2014" },
      { codePrefix: "BC", sectionPrefix: "P102.1", codeEdition: "2014" }
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
    pattern: /\b(?:gas[- ]fired|fuel[- ]burning|gas)\s+appliances?\b.*\bcombustion\s+air\b|\bcombustion\s+air\b.*\b(?:gas[- ]fired|mechanical\s+room|appliances?)\b/i,
    label: "fuel-gas appliance combustion-air provisions",
    nominationVocabulary: 'gas_equipment',
    targets: [
      { codePrefix: "FGC", sectionPrefix: "304.1" },
      { codePrefix: "FGC", sectionPrefix: "304.5" }
    ]
  },
  {
    pattern: /\bmixed[- ]use\b.*\b(?:fixtures?|water\s+closets?|lavator(?:y|ies)|required\s+number)\b|\b(?:restaurant|retail|office)\b.*\b(?:fixtures?|water\s+closets?|lavator(?:y|ies))\b.*\b(?:calculat|number|required)|\b(?:water\s+closets?|lavator(?:y|ies))\b.*\b(?:restaurant|retail|office|mixed[- ]use)\b/i,
    label: "mixed-use plumbing-fixture calculation provisions",
    calculationScope: true,
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
    pattern: /\b(?:bottled\s+water|bottle[- ]filling|refrigerator\s+(?:water\s+)?dispenser|water\s+cooler)\b.*\b(?:drinking\s+fountains?|substitut)|\bdrinking\s+fountains?\b.*\b(?:bottled\s+water|bottle[- ]filling|dispenser|cooler|substitut|replac\w*)\b/i,
    label: "drinking-fountain and bottle-filling substitution provisions",
    targets: [
      { codePrefix: "PC", sectionPrefix: "403.1", fountainApplicability: true },
      { codePrefix: "PC", sectionPrefix: "410.1" },
      { codePrefix: "PC", sectionPrefix: "410.2", fountainApplicability: true },
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
    pattern: /\b(?:NYS\s+)?Office of Mental Health\b|\bOMH\b/i,
    label: "NYS Office of Mental Health requirements",
    sourceName: "New York State Office of Mental Health",
    sourceURL: "https://omh.ny.gov/omhweb/policy_and_regulations/"
  },
  {
    pattern: /\bHCR\b/i,
    label: "HCR requirements",
    sourceName: "New York State Homes and Community Renewal",
    sourceURL: "https://hcr.ny.gov/"
  },
  {
    pattern: /\bzoning\b|\bZR\s*\d/i,
    questionText: researchZoningQuestionText,
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
    codePrefix: "EBC",
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

// Presentation may expose a discovery link only for an authority requested in
// the actual question, not one introduced by expanded retrieval/project facts.
export function researchRequestedOutsideAuthorityURLs(question) {
  return outsideLibrarySignals
    .filter(({ pattern, questionText }) => pattern.test(
      questionText ? questionText(String(question || "")) : String(question || "")
    ))
    .map(({ sourceURL }) => sourceURL);
}

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
  const values = normalizedText(value).match(/[\p{L}\p{N}]+(?:[.-][\p{L}\p{N}]+)*/gu) || [];
  return values.flatMap((token) => /^[a-z]+(?:-[a-z]+)+$/.test(token)
    ? [token, ...token.split("-")]
    : [token]);
}

const normalizedIndexCache = new WeakMap();
function normalizedSearchIndex(index) {
  if (normalizedIndexCache.has(index)) return normalizedIndexCache.get(index);
  const normalized = new Map();
  for (const [token, posting] of index) {
    for (const term of new Set(rawTokens(token).flatMap((value) => [...singularForms(value)]))) {
      const ids = normalized.get(term) || new Set();
      for (const id of posting) ids.add(comparableSectionID(id));
      normalized.set(term, ids);
    }
  }
  normalizedIndexCache.set(index, normalized);
  return normalized;
}

function explicitQuestionDisciplinePrefixes(question) {
  const prefixes = new Set();
  const names = { AC: "Administrative\\s+Code", BC: "Building\\s+(?:Code|Rules|Regulations)", EBC: "Existing\\s+Building\\s+(?:Code|Rules|Regulations)",
    FC: "Fire\\s+(?:Code|Rules|Regulations)", FGC: "Fuel[- ]Gas\\s+(?:Code|Rules|Regulations)", MC: "Mechanical\\s+(?:Code|Rules|Regulations)", PC: "Plumbing\\s+(?:Code|Rules|Regulations)", ZR: "Zoning\\s+(?:Resolution|Rules|Regulations)" };
  for (const [prefix, name] of Object.entries(names)) {
    if (new RegExp(`\\b(?:${name}|${prefix})\\b`, "i").test(question)) prefixes.add(prefix);
  }
  if (prefixes.has("EBC") && !/\bBC\b/i.test(question)) prefixes.delete("BC");
  return prefixes;
}

function questionDisciplinePrefixes(question) {
  // A soft ranking signal, never a corpus exclusion or a substitute for a
  // section reference. Cross-code requirements can still be selected.
  const prefixes = explicitQuestionDisciplinePrefixes(question);
  for (const prefix of researchQuestionSubject(question).codePrefixes) prefixes.add(prefix);
  if (/\bpermit\b/i.test(question)) prefixes.add("AC");
  return prefixes;
}

// Canonical chapter labels provide a retrieval prior, never a legal finding.
// Keep other books/chapters available for cross-references and exceptions.
function zoningScopeRankingFactor(section, question, currentQuestion = question) {
  if (String(section.codePrefix || "").toUpperCase() !== "ZR") return 1;
  const labels = `${section.headerLine || ""}\n${section.headingLine || ""}\n${section.chapterTitle || ""}`;
  const districtFamilies = text => new Set(Array.from(String(text).matchAll(/\b([RCM])\d+[A-Za-z]*(?:-\d+[A-Za-z]*)?\b/gi), match => match[1].toUpperCase()));
  const currentFamilies = districtFamilies(currentQuestion);
  const families = currentFamilies.size ? currentFamilies : districtFamilies(question);
  const chapterFamily = /Commercial District Regulations/i.test(labels) ? "C"
    : /Manufacturing District Regulations/i.test(labels) ? "M"
      : /Residence District Regulations/i.test(labels) ? "R" : null;
  let factor = chapterFamily && families.size ? (families.has(chapterFamily) ? 1.55 : 0.65) : 1;
  // The published chapter subject is another retrieval prior. A commercial
  // district alone cannot choose between its mixed, residential and non-
  // residential building frameworks. Current scenario wording supersedes
  // saved inventory; this does not classify the building under a definition.
  const useCategory = value => {
    const original = String(value || "");
    // null means that the current scenario deliberately leaves the category
    // open; undefined means it says nothing about category. Only the latter
    // permits an inherited subject to supply a weak retrieval hint.
    if (/\b(?:compare|comparison|difference|versus|vs\.?)\b/i.test(original)) return null;
    if (/\b(?:maybe|might be|possibly|whether|is (?:this|it|the building))\b[\s\S]{0,80}\b(?:mixed|residential|commercial|retail)\b/i.test(original)) return null;
    const text = original.replace(/\b(?:not|no longer|never)\s+(?:a\s+)?(?:(?:entirely|exclusively|only|purely)\s+)?(?:mixed(?:[- ]use)?|residential(?:[- ]only)?|commercial(?:[- ]only)?|retail(?:[- ]only)?)\b/gi, "");
    if (/\b(?:entirely|exclusively|only|purely)\s+residential\b|\bresidential[- ]only\b/i.test(text)) return "residential";
    if (/\b(?:entirely|exclusively|only|purely)\s+(?:commercial|retail|community facility)\b|\b(?:commercial|retail|community[- ]facility)[- ]only\b/i.test(text)) return "nonresidential";
    if (/\bmixed(?:[- ]use)?\s+(?:residential|commercial|building)|\bmixed[- ]use\s+(?:project|development)|\b(?:residential|apartments?)\s*(?:\/|and|with|plus)\s*(?:commercial|retail)\b|\b(?:commercial|retail)\s*(?:\/|and|with|plus)\s*(?:residential|apartments?)\b/i.test(text)) return "mixed";
    return text !== original ? null : undefined;
  };
  const currentCategory = useCategory(currentQuestion);
  const category = currentCategory === undefined ? useCategory(question) : currentCategory;
  const chapterCategory = /Bulk Regulations for Mixed Buildings/i.test(labels) ? "mixed"
    : /Bulk Regulations for Residential Buildings/i.test(labels) ? "residential"
      : /Bulk Regulations for Commercial or Community Facility Buildings/i.test(labels) ? "nonresidential" : null;
  if (category && chapterCategory) factor *= category === chapterCategory ? 1.5 : 0.7;
  const specialDistrict = labels.match(/Special\s+([^\n—()]+?)\s+District(?:\s*\(([A-Z][A-Z0-9-]+)\))?/i);
  if (!specialDistrict) return factor;
  const titleTokens = rawTokens(specialDistrict[1]).filter(token => !stopWords.has(token) && token.length > 2);
  const applicabilityQuestion = currentFamilies.size ? currentQuestion : question;
  const text = normalizedText(applicabilityQuestion);
  const districtNamed = titleTokens.length && titleTokens.every(token => text.includes(token));
  const abbreviationNamed = specialDistrict[2] && new RegExp(`\\b${specialDistrict[2]}\\b`, "i").test(applicabilityQuestion);
  return factor * (districtNamed || abbreviationNamed ? 1.2 : 0.5);
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
  for (const match of String(question || "").matchAll(/\b(?:explain|interpret|compare|about|under|per)\s+(?:(?:the|section)\s+)?(\d{1,3}-\d{2,4})\b/gi)) {
    add("*", match[1]);
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

function sectionCodeEdition(section) {
  const editionSource = [
    section?.codeEdition,
    section?.codeVersion,
    section?.headingLine,
    section?.codeTitle
  ].filter(Boolean).join(" ");
  return editionSource.match(/\b(?:19|20)\d{2}\b/)?.[0] || "";
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
  const raw = rawTokens(normalized);
  const tokens = new Map();
  for (const token of raw) {
    for (const form of singularForms(token)) tokens.set(form, (tokens.get(form) || 0) + 1);
  }
  let score = 0;
  let matched = 0;
  for (const [term, weight] of terms) {
    const frequency = tokens.get(term) || 0;
    if (frequency) {
      // Saturate repetition and normalize passage length. A long glossary must
      // not win merely by mentioning unrelated query words across its entries.
      const lengthPenalty = 1.2 * (0.25 + 0.75 * raw.length / 100);
      score += weight * frequency * 2.2 / (frequency + lengthPenalty);
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

function passageIdentity(passage) {
  return `${passage?.sectionID}:${passage?.sourceTextHash}:${passage?.sourceOffsets?.blockID || passage?.blockID}:${passage?.sourceOffsets?.start}:${passage?.sourceOffsets?.end}`;
}

function numberedSiblingParent(passage) {
  const number = String(passage?.subsectionNumber || passage?.sectionNumber || "");
  return /^[A-Z]?\d+(?:\.\d+)+$/.test(number) ? number.slice(0, number.lastIndexOf(".")) : null;
}

function completeIndexedScope(passage) {
  return Boolean(passage?.text && passage.sourceTextHash && passage.sourceOffsets &&
    (passage.scopeComplete === true || passage.completeSubsectionText));
}

function sameSiblingAuthority(left, right) {
  return ["codePrefix", "corpusID", "codeVersion", "codeEdition"].every(key => left?.[key] && left[key] === right?.[key]) &&
    left.jurisdiction === right.jurisdiction;
}

function authorizedIndexedHit(hit, passageIndex, catalogByID) {
  const bind = passage => {
    const section = catalogByID.get(comparableSectionID(passage?.sectionID));
    const canonical = passageIndex?.passagesByID?.get(passage?.id);
    if (!section || !canonical || passageIdentity(passage) !== passageIdentity(canonical) || passage.text !== canonical.text) return null;
    for (const key of ["codePrefix", "corpusID", "codeVersion", "codeEdition"]) {
      if (section[key] && (passage[key] !== section[key] || canonical[key] !== section[key])) return null;
    }
    // Passage index v2 deliberately omits jurisdiction; obtain that identity
    // from its authorized catalog instead of changing prepared embedding input.
    // A supplied conflicting jurisdiction is rejected, never overwritten.
    if (section.jurisdiction && passage.jurisdiction && passage.jurisdiction !== section.jurisdiction) return null;
    return { ...passage, passageTitle: canonical.passageTitle,
      jurisdiction: section.jurisdiction || passage.jurisdiction || null };
  };
  const primary = bind(hit);
  return primary ? { ...primary, passages: (hit.passages || [hit]).map(bind).filter(Boolean) } : null;
}

// This is recall within an already nominated numbered branch, not a finding
// that another provision applies. Current-question BM25 remains length-normalized
// and excludes inherited wording. Semantic rank breaks ties when ordinary
// wording has no additional literal terms in a short neighboring rule.
function completeSibling(primary, pool, preferSemantic = false) {
  const parent = numberedSiblingParent(primary);
  if (!parent) return null;
  return pool.filter(passage => passageIdentity(passage) !== passageIdentity(primary) &&
    sameSiblingAuthority(primary, passage) && numberedSiblingParent(passage) === parent &&
    completeIndexedScope(passage) && (passage.currentQuestionScore > 0 ||
      (preferSemantic && passage.currentQuestionOverlap > 0 && Number.isFinite(passage.semanticRank))))
    .sort((left, right) => (preferSemantic ?
      (left.semanticRank ?? Infinity) - (right.semanticRank ?? Infinity) : 0) ||
      right.currentQuestionScore - left.currentQuestionScore ||
      (left.semanticRank ?? Infinity) - (right.semanticRank ?? Infinity) ||
      (left.lexicalRank ?? Infinity) - (right.lexicalRank ?? Infinity) || left.id.localeCompare(right.id))[0] || null;
}

const genericPassageHeadingWords = new Set([
  "general", "requirements", "requirement", "provisions", "provision", "minimum", "maximum",
  "reserved", "definitions", "definition", "scope", "section", "code", "access"
]);

function indexedHeadingDetail(passage, questionTerms) {
  // The containing chapter title is shared by unrelated children. Only the
  // canonical child's own heading can protect literal current-question detail.
  const heading = String(passage.passageTitle || "").replace(/^\s*(?:[A-Z]+\s+)?\d+(?:[-.]\d+)*\s*[:.]?\s*/, "");
  const terms = [...new Set(rawTokens(heading).filter(term => term.length > 2 &&
    /[a-z]/i.test(term) && !stopWords.has(term) && !genericPassageHeadingWords.has(term)))];
  const matched = terms.filter(term => [...singularForms(term)].some(form => questionTerms.has(form))).length;
  return { matched, coverage: matched / Math.max(1, terms.length) };
}

function currentDetailIndexedPrimary(primary, pool, currentQuestion) {
  const questionTerms = new Set(rawTokens(currentQuestion).flatMap(term => [...singularForms(term)]));
  const primaryDetail = indexedHeadingDetail(primary, questionTerms);
  const stronger = pool.map(passage => ({ passage, detail: indexedHeadingDetail(passage, questionTerms) }))
    .filter(({ passage, detail }) => passageIdentity(passage) !== passageIdentity(primary) &&
      sameSiblingAuthority(primary, passage) && completeIndexedScope(passage) &&
      passage.currentQuestionScore > 0 && detail.matched >= 2 &&
      (detail.matched > primaryDetail.matched ||
        (detail.matched === primaryDetail.matched && detail.coverage > primaryDetail.coverage)))
    .sort((left, right) => right.detail.matched - left.detail.matched ||
      right.detail.coverage - left.detail.coverage ||
      right.passage.currentQuestionScore - left.passage.currentQuestionScore ||
      (left.passage.semanticRank ?? Infinity) - (right.passage.semanticRank ?? Infinity) ||
      (left.passage.lexicalRank ?? Infinity) - (right.passage.lexicalRank ?? Infinity) ||
      left.passage.id.localeCompare(right.passage.id));
  return stronger[0]?.passage || primary;
}

function mergedIndexedPassages(primary, lexical, semantic, currentScores, currentQuestion, preservePrimary = false) {
  const pool = new Map();
  for (const [method, hit] of [["lexical", lexical], ["semantic", semantic]]) {
    for (const [rank, passage] of (hit?.passages || (hit ? [hit] : [])).entries()) {
      const key = passageIdentity(passage);
      const prior = pool.get(key);
      pool.set(key, { ...passage, ...prior,
        [`${method}Rank`]: rank + 1,
        currentQuestionScore: currentScores.get(key) || 0 });
    }
  }
  const merged = [...pool.values()];
  // Meaning search supplies recall when a user does not use the code's words.
  // It must not replace a complete, more specific literal child already in the
  // same authorized pool with a generic sibling merely because that sibling
  // repeats the containing chapter title or unrelated project context.
  const selected = semantic && !primary.exactReference && !preservePrimary
    ? currentDetailIndexedPrimary(primary, merged, currentQuestion) : primary;
  const companion = completeSibling(selected, merged);
  return { ...selected, passages: merged, ...(companion ? { companion } : {}) };
}

function strongCurrentLexicalReservation({ currentHits, detailed, selected, currentQuestion, contextQuestion, preferredPrefixes, allowPurpose = true }) {
  const currentTerms = new Set(rawTokens(currentQuestion).flatMap(term => [...singularForms(term)])
    .filter(term => term.length > 2 && /[a-z]/i.test(term) && !stopWords.has(term) &&
      !genericPassageHeadingWords.has(term) && !["nyc", "new", "york", "city", "fictional", "scenario", "project"].includes(term)));
  if (currentTerms.size < 2) return null;
  const bestScore = currentHits[0]?.score;
  if (!(bestScore > 0)) return null;
  const protectedIDs = new Set(selected.filter((item, index) => index === 0 || item.directReference ||
    item.completeSiblingCompanionOf || item.useSelectedPassageOnly).map(item => comparableSectionID(item.section.id)));
  const { edition: currentEdition, ambiguous } = researchCurrentEditionContext(currentQuestion);
  const purposeTerms = allowPurpose && !ambiguous ? researchCurrentPurposeTerms(currentQuestion) : [];
  const eligible = currentHits.map((hit, rank) => {
    const id = comparableSectionID(hit.sectionID);
    const item = detailed.find(value => comparableSectionID(value.section.id) === id);
    const strength = hit.score / bestScore;
    const words = new Set(rawTokens(hit.text).flatMap(term => [...singularForms(term)]));
    const subjectOverlap = [...currentTerms].filter(term => words.has(term)).length;
    const purposeMatches = item && (!currentEdition || sectionCodeEdition(item.section) === currentEdition) &&
      !item.section.referenceOnly && !item.section.truncated && item.section.textComplete !== false &&
      item.section.researchClaimEligible !== false && item.body?.researchClaimEligible !== false &&
      (!item.section.authorityClass || item.section.authorityClass === 'enacted') &&
      boundCanonicalRulePassage({ ...item.section, body: item.body, text: sectionText(item.section, item.body) }, hit, false, true)
      ? researchCurrentPurposeMatches(hit.text, purposeTerms) : 0;
    return { item, hit, rank: rank + 1, strength, subjectOverlap, purposeMatches };
  }).filter(({ item, hit, rank, strength, subjectOverlap, purposeMatches }) => (rank <= 5 || purposeMatches > 0) &&
    item && !protectedIDs.has(comparableSectionID(hit.sectionID)) &&
    !item.useSelectedPassageOnly && !item.contextualReference && !item.inheritedReference &&
    completeIndexedScope(hit) && completeIndexedScope(item.indexedPassage) &&
    zoningScopeRankingFactor(item.section, contextQuestion, currentQuestion) >= 1 &&
    strength >= 0.7 && subjectOverlap >= 2);
  eligible.sort((left, right) =>
    right.purposeMatches - left.purposeMatches ||
    Number(preferredPrefixes.has(right.item.section.codePrefix)) - Number(preferredPrefixes.has(left.item.section.codePrefix)) ||
    left.rank - right.rank);
  return eligible[0] || null;
}

function retrievalWordForms(word) {
  const forms = singularForms(word);
  if (/^[a-z]{4,}$/.test(word) && /(?:ing|ed)$/.test(word)) {
    const stem = word.replace(/(?:ing|ed)$/, "");
    if (stem.length >= 3) {
      forms.add(stem); forms.add(`${stem}e`);
      if (/([b-df-hj-np-tv-z])\1$/.test(stem)) forms.add(stem.slice(0, -1));
    }
  }
  return forms;
}

function currentActionSubjectProbe(currentQuestion, resolvedSubject) {
  // Only a clear modal/action question supplies an action. An excluded example
  // or the previous answer cannot supply it. Generic conversational verbs do
  // not nominate a rule merely because its equipment name overlaps.
  const action = String(currentQuestion).match(/\b(?:can|may|could|should|must|will|would)\s+(?:(?:we|i|you|they|it)\s+)?(?:(?:now|still|instead|also)\s+)?(?:not\s+)?([a-z]{3,})\b/i)?.[1]?.toLowerCase();
  const genericActions = new Set(["be", "have", "has", "do", "does", "use", "make", "get", "need", "know", "help", "explain", "check", "verify", "continue", "solve", "satisfy", "comply", "apply", "meet", "provide", "tell", "ask", "see", "consider"]);
  if (!action || stopWords.has(action) || genericActions.has(action)) return null;
  const subject = String(resolvedSubject || "").trim().replace(/[.]$/, "");
  // The helper has already resolved topic/family/edition changes. Ambiguous
  // multiple subjects or sentence-shaped fallback context gets no probe.
  if (!subject || subject.length > 140 || /[;?!:=\d]/.test(subject) ||
      /^(?:not|no|is|are|was|were|can|may|must|would|should|what|which|how|it|this|these|those)\b/i.test(subject)) return null;
  const words = rawTokens(subject).filter(word => word.length > 2 && /[a-z]/i.test(word) &&
    !stopWords.has(word) && !genericPassageHeadingWords.has(word) &&
    !["system", "systems", "equipment", "building", "project", "existing", "proposed", "subject", "context"].includes(word));
  if (!words.length || words.length > 8) return null;
  // The noun phrase's final two substantive words identify the equipment;
  // leading modifiers from the previous heading must not overwhelm its new
  // action. Morphological variants still count as one subject word each.
  const subjectWords = words.slice(-2);
  if (subjectWords.some(word => retrievalWordForms(word).has(action))) return null;
  return { action, subjectWords, query: [action, ...subjectWords].join(" ") };
}

function completeActionSubjectHit(hit, probe) {
  if (!hit?.scopeComplete || !completeIndexedScope(hit) ||
      (hit.completeSubsectionText && hit.completeSubsectionText !== hit.text)) return false;
  if ([...new Set([...(hit.contextTexts || []), hit.text])].join("\n\n").length > 12000) return false;
  const words = new Set(rawTokens(hit.text).flatMap(word => [...retrievalWordForms(word)]));
  return [...retrievalWordForms(probe.action)].some(word => words.has(word)) &&
    probe.subjectWords.every(subject => [...retrievalWordForms(subject)].some(word => words.has(word)));
}

function completeMeasurementSubjectHit(hit, subjectTerms, currentQuestion) {
  if (!hit?.scopeComplete || !completeIndexedScope(hit) ||
      (hit.completeSubsectionText && hit.completeSubsectionText !== hit.text) ||
      [...new Set([...(hit.contextTexts || []), hit.text])].join("\n\n").length > 12000) return false;
  const words = new Set(rawTokens(hit.text).flatMap(word => [...retrievalWordForms(word)]));
  const detailTerms = rawTokens(currentQuestion).filter(word => /[a-z]/i.test(word) && word.length > 2 &&
    !stopWords.has(word) && !genericPassageHeadingWords.has(word) &&
    !["feet", "foot", "inches", "inch", "project", "building", "okay", "fine", "same"].includes(word));
  return subjectTerms.every(term => [...retrievalWordForms(term)].some(word => words.has(word))) &&
    detailTerms.some(term => [...retrievalWordForms(term)].some(word => words.has(word)));
}

function strongActionSubjectReservation({ probeHits, detailed, selected, currentQuestion, contextQuestion, preferredPrefixes }) {
  const protectedIDs = new Set(selected.filter((item, index) => index === 0 || item.directReference ||
    item.completeSiblingCompanionOf || item.useSelectedPassageOnly).map(item => comparableSectionID(item.section.id)));
  return probeHits.map(hit => ({ hit, item: detailed.find(item => comparableSectionID(item.section.id) === comparableSectionID(hit.sectionID)) }))
    .filter(({ item, hit }) => item && !protectedIDs.has(comparableSectionID(hit.sectionID)) &&
      !item.useSelectedPassageOnly && !item.contextualReference && !item.inheritedReference &&
      zoningScopeRankingFactor(item.section, contextQuestion, currentQuestion) >= 1)
    .sort((left, right) => Number(preferredPrefixes.has(right.item.section.codePrefix)) -
      Number(preferredPrefixes.has(left.item.section.codePrefix)) || left.hit.probeRank - right.hit.probeRank)
    .map(({ hit, item }) => ({ hit, item, rank: hit.probeRank, strength: hit.probeStrength, actionSubject: true }))[0] || null;
}

export async function discoverRelevantEvidence({
  question,
  retrievalContext = null,
  catalog,
  invertedIndex,
  passageIndex = null,
  semanticSearch = null,
  readSectionBody,
  resolveVisualSource,
  availableCodePrefixes = [],
  limit = 8
}) {
  const normalizedQuestion = validateEvidenceDiscoveryQuestion(question);
  const advisoryRanking = process.env.PERMITEXT_RESEARCH_ADVISORY_ROUTE_RANKING === "1";
  // Project facts may help lexical relevance, but are not requests to explain
  // every code topic mentioned in the project's inventory or source wording.
  const sourceQuestion = retrievalContext?.sourceQuery
    ? validateEvidenceDiscoveryQuestion(retrievalContext.sourceQuery) : normalizedQuestion;
  const sections = Array.isArray(catalog) ? catalog : [];
  const index = normalizedSearchIndex(invertedIndex instanceof Map ? invertedIndex : new Map());
  const currentQuestion = retrievalContext?.currentQuestion || sourceQuestion;
  const gasVocabulary = researchGasEquipmentVocabulary(currentQuestion, {
    contextDependentFollowUp: retrievalContext?.contextDependentFollowUp === true,
    humanTopics: [retrievalContext?.conversationTopic, retrievalContext?.immediateContext]
  });
  const explicitDisciplinePrefixes = explicitQuestionDisciplinePrefixes(currentQuestion);
  const requestedTemperature = /\btemperature\b/i.test(currentQuestion) &&
    /\b(?:maximum|minimum|limit|how hot|how cold)\b/i.test(currentQuestion);
  const disciplinePrefixes = questionDisciplinePrefixes(currentQuestion);
  if (!disciplinePrefixes.size) {
    for (const prefix of questionDisciplinePrefixes(sourceQuestion)) disciplinePrefixes.add(prefix);
  }
  // Context resolves pronouns and preserves citations; it must not overwhelm
  // new terms when the user asks about a related but different provision.
  const vocabulary = researchSearchVocabulary(currentQuestion, {
    contextDependentFollowUp: retrievalContext?.contextDependentFollowUp === true,
    humanTopics: [retrievalContext?.conversationTopic, retrievalContext?.immediateContext]
  });
  const questionTerms = queryTermWeights(currentQuestion);
  // Shared aliases nominate technical wording without changing the human
  // question, explicit references, applicability facts or numerical premises.
  // Only positive current concepts enter the current-only lexical shortlist.
  for (const term of rawTokens(vocabulary.currentQuery)) {
    if (term.length <= 2 || stopWords.has(term)) continue;
    for (const form of singularForms(term)) questionTerms.set(form, Math.max(1, questionTerms.get(form) || 0));
  }
  const rankingBoilerplate = passageIndex ? new Set(["nyc", "new", "york", "city", "code", "codes", "edition", "editions", "ordinary",
    ...Array.from(currentQuestion.matchAll(/\b((?:19|20)\d{2})\s+(?:(?:building|construction|plumbing|mechanical|fuel\s+gas|fire)\s+)?codes?\b/gi), match => match[1])]) : new Set();
  if (passageIndex) {
    // Jurisdiction/edition are enforced by corpus identity. Repeating those
    // boilerplate words in ranking favors administrative scope paragraphs
    // over the concrete rule the user is asking about.
    for (const term of rankingBoilerplate) questionTerms.delete(term);
    // District labels supply applicability facts, but rare literal labels can
    // overpower the requested property (e.g. surfacing) and select a special
    // program that happens to name the same district. Keep them as a small
    // relevance signal; the complete question still governs source review.
    if (/\b(?:district|zoning)\b/i.test(currentQuestion)) {
      for (const match of currentQuestion.matchAll(/\b[RCM]\d+[A-Za-z]*(?:-\d+[A-Za-z]*)?\b/gi)) {
        const term = match[0].toLowerCase();
        if (questionTerms.has(term)) questionTerms.set(term, 0.12);
      }
    }
  }
  const contextualTerms = [...queryTermWeights([normalizedQuestion, vocabulary.query].filter(Boolean).join("\n"))]
    .filter(([term]) => !questionTerms.has(term) && !rankingBoilerplate.has(term));
  // A full project inventory can contain hundreds of extra terms. A per-term
  // discount alone still lets their combined score overwhelm the question.
  // Bound their total influence while preserving the complete facts downstream.
  const questionWeight = [...questionTerms.values()].reduce((sum, weight) => sum + weight, 0);
  const contextWeight = contextualTerms.reduce((sum, [, weight]) => sum + weight, 0);
  const contextScale = Math.min(0.25, questionWeight * 0.25 / Math.max(1, contextWeight));
  const terms = new Map(contextualTerms.map(([term, weight]) => [term, weight * contextScale]));
  for (const [term, weight] of questionTerms) terms.set(term, weight);
  const measurementSubject = retrievalContext?.contextDependentFollowUp &&
      retrievalContext.dependentMeasurementSubject?.source === "active_user_topic"
    ? retrievalContext.dependentMeasurementSubject : null;
  const measurementSubjectTerms = measurementSubject?.terms?.filter(term =>
    /^[a-z]{3,}$/.test(term) && !stopWords.has(term) && !genericPassageHeadingWords.has(term)) || [];
  // A dependent measurement's user subject is part of the question. Generic
  // measuring words must not demote it into the pooled project-fact discount.
  if (measurementSubjectTerms.length && measurementSubjectTerms.length <= 8) {
    for (const term of measurementSubjectTerms) terms.set(term, Math.max(1, terms.get(term) || 0));
  }
  const passageTerms = new Map(Array.from(terms, ([term, weight]) => {
    const posting = index.get(term);
    const count = Number(posting?.size ?? posting?.length ?? 0);
    return [term, weight * Math.log(1 + (sections.length + 1) / (count + 1))];
  }));
  const bigrams = queryBigrams(currentQuestion);
  const namedCompounds = Array.from(currentQuestion.matchAll(/\b([a-z])-([a-z]{3,})\b/gi),
    ([, letter, word]) => `${letter.toLowerCase()} ${word.toLowerCase().replace(/s$/, '')}`);
  const references = codeReferences(sourceQuestion);
  const directReferenceKeys = new Set(codeReferences(currentQuestion).map(reference =>
    `${reference.codePrefix}:${reference.sectionNumber}`));
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
  const passageHits = passageIndex ? searchResearchPassages(passageIndex, sourceQuestion,
    { queryWeights: terms, explicitReferenceQuery: currentQuestion, limit: 100 })
    .map(hit => authorizedIndexedHit(hit, passageIndex, catalogByID)).filter(Boolean) : [];
  const lexicalHitsByID = new Map(passageHits.map(hit => [comparableSectionID(hit.sectionID), hit]));
  // The companion decision uses the current question only. Reusing fused
  // inherited scores here would repeat the old topic instead of its new detail.
  const currentPassageHits = passageIndex ? searchResearchPassages(passageIndex, currentQuestion,
    { queryWeights: questionTerms, explicitReferenceQuery: currentQuestion, limit: 100, passagesPerSection: 8 })
    .map(hit => authorizedIndexedHit(hit, passageIndex, catalogByID)).filter(Boolean) : [];
  const currentPassageScores = new Map(currentPassageHits.flatMap(hit =>
    (hit.passages || [hit]).map(passage => [passageIdentity(passage), passage.score])));
  // Keep a small current-subject foreground apart from mixed project context.
  // Use literal wording or a compact positive equipment vocabulary query.
  // Filter its family shortlist before the cap; ordinary
  // semantic/lexical recall remains cross-code. At most three complete sources
  // can enter the existing shortlist, preserving every protected slot.
  const equipmentIntent = researchEquipmentSearchIntent(currentQuestion, {
    contextDependentFollowUp: retrievalContext?.contextDependentFollowUp === true,
    humanTopics: [retrievalContext?.conversationTopic, retrievalContext?.immediateContext]
  });
  // A compact concept can use the existing foreground slots only when the
  // subject is unambiguous. Existing equipment intent keeps its own guards;
  // competing/multiple shared concepts retain ordinary cross-code retrieval.
  const vocabularyConcept = !equipmentIntent && vocabulary.concepts.length === 1
    ? vocabulary.concepts[0] : null;
  const foregroundQuery = equipmentIntent?.query || (vocabularyConcept
    ? (vocabularyConcept.foregroundTerms || vocabularyConcept.terms).join(' ') : currentQuestion);
  const foregroundWords = rawTokens(foregroundQuery).filter(word => word.length > 2 && /[a-z]/i.test(word) &&
    !stopWords.has(word) && !rankingBoilerplate.has(word) && !genericPassageHeadingWords.has(word) &&
    !["need", "needed", "project", "fictional", "scenario", "ground", "floor", "make"].includes(word));
  const foregroundWeights = new Map(foregroundWords.flatMap(word => [...singularForms(word)].map(form => [form, 1])));
  const foregroundOverlapMinimum = Math.max(2, Math.ceil(new Set(foregroundWords).size / 4));
  const equipmentPrefixes = new Set(equipmentIntent?.codePrefixes ||
    (equipmentIntent?.codePrefix ? [equipmentIntent.codePrefix] : vocabularyConcept?.codePrefixes || []));
  const foregroundPrefixes = explicitDisciplinePrefixes.size ? explicitDisciplinePrefixes
    : equipmentPrefixes.size ? equipmentPrefixes : disciplinePrefixes;
  const foregroundHits = passageIndex && foregroundWeights.size >= 2 && foregroundPrefixes.size
    ? searchResearchPassages(passageIndex, foregroundQuery, { queryWeights: foregroundWeights,
      explicitReferenceQuery: currentQuestion, limit: 5, passagesPerSection: 8, codePrefixes: foregroundPrefixes })
      .map(hit => authorizedIndexedHit(hit, passageIndex, catalogByID))
      .filter(hit => hit && foregroundPrefixes.has(hit.codePrefix)) : [];
  // This is one vocabulary-focused use of the same foreground probe/slots.
  // Require the equipment in the complete source's own text, not shared water
  // words or inherited context; legal applicability remains unresolved.
  const qualifiedForegroundHits = equipmentIntent || vocabularyConcept ? foregroundHits.filter(hit =>
    (equipmentPrefixes.size ? equipmentPrefixes : foregroundPrefixes).has(hit.codePrefix) &&
    (equipmentIntent ? researchEquipmentSubjectMatches(hit.text, equipmentIntent)
      : researchSearchVocabularyMatches(hit.text, vocabularyConcept))) : foregroundHits;
  // Compare a requested property's strength against the same property. A
  // pressure clause's incidental mention of the testing medium is not a
  // stronger material rule; retain the existing five-hit probe and read caps.
  const foregroundStrengthBaseline = vocabularyConcept?.subject === 'test_medium'
    ? qualifiedForegroundHits[0]?.score : foregroundHits[0]?.score;
  const equipmentForegroundHits = qualifiedForegroundHits.filter(hit =>
    (!equipmentIntent && !vocabularyConcept) || hit.score >= (foregroundStrengthBaseline || Infinity) * 0.7);
  const activePacketHits = passageIndex && retrievalContext?.contextDependentFollowUp && !relevanceComparison
    ? (retrievalContext.activeRulePacketReferences || []).slice(0, 3).flatMap(reference => {
      if (!['codePrefix', 'sectionNumber', 'corpusID', 'codeVersion', 'codeEdition'].every(key => reference[key]) ||
          (explicitDisciplinePrefixes.size && !explicitDisciplinePrefixes.has(reference.codePrefix))) return [];
      const registered = reference.sectionID ? catalogByID.get(comparableSectionID(reference.sectionID)) :
        sections.find(section => ['codePrefix', 'sectionNumber', 'corpusID', 'codeVersion', 'codeEdition']
          .every(key => section[key] === reference[key]));
      const entry = researchCheckedRuleIndexPassage(passageIndex.passages, reference, registered, currentQuestion);
      const hit = entry && authorizedIndexedHit({ ...entry, score: currentPassageScores.get(passageIdentity(entry)) || 1 }, passageIndex, catalogByID);
      return hit ? [hit] : [];
    }) : [];
  const actionSubjectProbe = passageIndex && retrievalContext?.contextDependentFollowUp
    ? currentActionSubjectProbe(currentQuestion, retrievalContext.resolvedSubjectContext) : null;
  const actionSubjectHits = actionSubjectProbe ? searchResearchPassages(passageIndex, actionSubjectProbe.query,
    { queryWeights: new Map(rawTokens(actionSubjectProbe.query).map(word => [word, 1])),
      explicitReferenceQuery: "", limit: 100, passagesPerSection: 8 })
    .map(hit => authorizedIndexedHit(hit, passageIndex, catalogByID)).filter(Boolean) : [];
  const actionSubjectRecallHits = actionSubjectHits.flatMap((hit, rank) => {
    const complete = (hit.passages || [hit]).find(passage => completeActionSubjectHit(passage, actionSubjectProbe) &&
      passage.score >= (actionSubjectHits[0]?.score || Infinity) * 0.7);
    return complete ? [{ ...complete, passages: hit.passages, probeRank: rank + 1,
      probeStrength: complete.score / actionSubjectHits[0].score }] : [];
  }).sort((left, right) => Number(disciplinePrefixes.has(right.codePrefix)) -
    Number(disciplinePrefixes.has(left.codePrefix)) || left.probeRank - right.probeRank).slice(0, 5);
  const measurementWeights = new Map(measurementSubjectTerms.map(term => [term, 1]));
  const measurementDetailTerms = [...queryTermWeights(currentQuestion)].filter(([term]) => !measurementWeights.has(term));
  const measurementDetailWeight = measurementDetailTerms.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [term, weight] of measurementDetailTerms) measurementWeights.set(term,
    weight * measurementSubjectTerms.length * 0.25 / Math.max(1, measurementDetailWeight));
  const measurementHits = passageIndex && measurementSubjectTerms.length && measurementSubjectTerms.length <= 8
    ? searchResearchPassages(passageIndex, `${measurementSubjectTerms.join(" ")} ${currentQuestion}`,
      { queryWeights: measurementWeights, explicitReferenceQuery: currentQuestion, limit: 100, passagesPerSection: 8 })
      .map(hit => authorizedIndexedHit(hit, passageIndex, catalogByID)).filter(Boolean) : [];
  const measurementRecallHits = measurementHits.slice(0, 5).flatMap((hit, rank) => {
    const complete = (hit.passages || [hit]).find(passage =>
      completeMeasurementSubjectHit(passage, measurementSubjectTerms, currentQuestion) &&
      passage.score >= (measurementHits[0]?.score || Infinity) * 0.7);
    return complete ? [{ ...complete, passages: hit.passages, probeRank: rank + 1,
      probeStrength: complete.score / measurementHits[0].score }] : [];
  });
  const passageHitsByID = new Map(lexicalHitsByID);
  const semanticResult = passageIndex && semanticSearch
    ? await semanticSearch.search(passageIndex, retrievalContext?.semanticQuery || currentQuestion, { limit: 100 }) : null;
  const semanticHits = (semanticResult?.hits || [])
    .map(hit => authorizedIndexedHit(hit, passageIndex, catalogByID)).filter(Boolean);
  const fusedScores = new Map();
  if (semanticHits.length) {
    passageHits.forEach((hit, rank) => fusedScores.set(comparableSectionID(hit.sectionID), 4000 / (61 + rank)));
    semanticHits.forEach((hit, rank) => {
      const id = comparableSectionID(hit.sectionID);
      fusedScores.set(id, (fusedScores.get(id) || 0) + 8000 / (61 + rank));
      if (!passageHitsByID.get(id)?.exactReference) passageHitsByID.set(id, hit);
    });
  }
  const semanticHitsByID = new Map(semanticHits.map(hit => [comparableSectionID(hit.sectionID), hit]));
  const currentEditionContext = researchCurrentEditionContext(currentQuestion);
  const purposeTerms = retrievalContext?.sourceSelectionRestricted === true || currentEditionContext.ambiguous
    ? [] : researchCurrentPurposeTerms(currentQuestion);
  const purposeEditionMatches = hit => !currentEditionContext.edition ||
    sectionCodeEdition(catalogByID.get(comparableSectionID(hit.sectionID))) === currentEditionContext.edition;
  for (const [id, primary] of passageHitsByID) {
    const lexical = lexicalHitsByID.get(id), semantic = semanticHitsByID.get(id);
    const merged = mergedIndexedPassages(primary, lexical, semantic, currentPassageScores, currentQuestion);
    // A meaning hit in the same source can name a different sibling. Preserve
    // the strong current-purpose passage, including for an existing lead;
    // authorized index identity and later fresh body binding still apply.
    const preservePurpose = lexical && purposeEditionMatches(lexical) && completeIndexedScope(lexical) &&
      (currentPassageScores.get(passageIdentity(lexical)) || 0) >= (currentPassageHits[0]?.score || Infinity) * 0.7 &&
      researchCurrentPurposeMatches(lexical.text, purposeTerms) > researchCurrentPurposeMatches(merged.text, purposeTerms) &&
      !(completeIndexedScope(merged.companion) && researchCurrentPurposeMatches(merged.companion.text, purposeTerms) >=
        researchCurrentPurposeMatches(lexical.text, purposeTerms));
    passageHitsByID.set(id, preservePurpose
      ? mergedIndexedPassages(lexical, lexical, semantic, currentPassageScores, currentQuestion, true) : merged);
  }
  // Contextual words can evict a strong current-only hit from the first lexical
  // hundred. Keep its authorized scope available for the bounded reservation;
  // this nomination does not by itself admit a source to the final shortlist.
  const strongCurrentHits = currentPassageHits.filter(hit =>
    completeIndexedScope(hit) && hit.score >= (currentPassageHits[0]?.score || Infinity) * 0.7);
  const purposeRecall = strongCurrentHits.filter(hit => purposeEditionMatches(hit) && researchCurrentPurposeMatches(hit.text, purposeTerms) > 0)
    .sort((left, right) => researchCurrentPurposeMatches(right.text, purposeTerms) - researchCurrentPurposeMatches(left.text, purposeTerms) || right.score - left.score)
    .slice(0, 1);
  // Use the existing five nomination opportunities, never a larger read pool.
  // Fresh canonical/authority binding remains required at final reservation.
  const currentLexicalRecallHits = [...purposeRecall, ...currentPassageHits.slice(0, 5).filter(hit =>
    strongCurrentHits.includes(hit) && !purposeRecall.includes(hit))].slice(0, 5);
  const foregroundRecallHits = equipmentForegroundHits.filter(hit => completeIndexedScope(hit));
  for (const hit of [...currentLexicalRecallHits, ...actionSubjectRecallHits, ...measurementRecallHits, ...activePacketHits, ...foregroundRecallHits]) {
    const id = comparableSectionID(hit.sectionID);
    if (!passageHitsByID.has(id)) passageHitsByID.set(id, hit);
    if (semanticHits.length && !fusedScores.has(id)) {
      const rank = hit.probeRank ? hit.probeRank - 1 : Math.max(0, currentPassageHits.indexOf(hit));
      fusedScores.set(id, 4000 / (61 + rank));
    }
  }
  const scores = new Map();
  const matchedTermsByID = new Map();
  // Short, specific headings often contain the requested property while their
  // short rule text loses a bag-of-words contest against adjacent long rules.
  // Require two literal heading terms: expanded synonyms or generic one-word
  // headings can otherwise crowd the actual governing provision out.
  // Use heading coverage as a bounded recall signal, never as applicability.
  const headingScores = new Map();
  const literalQuestionTerms = new Set(rawTokens(currentQuestion).flatMap(token => [...singularForms(token)]));
  const genericHeadingWords = new Set(["general", "requirements", "requirement", "provisions", "minimum", "maximum", "reserved", "definitions", "scope", "section", "code"]);
  for (const section of sections) {
    const tokens = [...new Set(rawTokens(section.title || "").filter(token =>
      /[a-z]/i.test(token) && !stopWords.has(token) && !genericHeadingWords.has(token) && token.length > 2))];
    if (tokens.length >= 2 && tokens.every(token => [...singularForms(token)].some(form => literalQuestionTerms.has(form)))) {
      headingScores.set(comparableSectionID(section.id), 45);
    }
  }
  const exactReferenceIDs = new Set();
  const routesByID = new Map();

  for (const reference of references) {
    sections.filter((section) =>
      (reference.codePrefix === "*" || String(section.codePrefix || "").toUpperCase() === reference.codePrefix) &&
      String(section.sectionNumber || "") === reference.sectionNumber
    ).forEach((section) => exactReferenceIDs.add(comparableSectionID(section.id)));
  }
  const separateFacilitiesWithStipulatedCounts = stipulatedSeparateFacilitiesQuestion(normalizedQuestion);
  const fountainSubstitutionWithStipulatedCount = stipulatedFountainSubstitutionQuestion(normalizedQuestion);
  const stipulatedOccupantLoad = /\b(?:established|stipulated|assumed|given) occupant load\b/i.test(normalizedQuestion)
    && !/\b(?:calculate|calculating|recalculate|determine|verify)\b.{0,35}\boccupant load\b/i.test(normalizedQuestion);

  for (const route of topicRoutes.filter(({ pattern, calculationScope, nominationVocabulary }) =>
    pattern.test(nominationVocabulary === 'gas_equipment' ? gasVocabulary?.routeQuery || '' : sourceQuestion) &&
    !(calculationScope && separateFacilitiesWithStipulatedCounts)
  )) {
    for (const target of route.targets) {
      if (target.fountainApplicability && fountainSubstitutionWithStipulatedCount) continue;
      for (const section of sections) {
        const sectionNumber = String(section.sectionNumber || "");
        const codeEdition = sectionCodeEdition(section);
        if (
          String(section.codePrefix || "").toUpperCase() !== target.codePrefix ||
          (target.codeEdition && codeEdition !== target.codeEdition) ||
          (
            Array.isArray(target.excludedEditions) &&
            target.excludedEditions.includes(codeEdition)
          ) ||
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
          rootClaimCoverage: false,
          descendantClaimCoverage: false,
          useSelectedPassageOnly: false,
          selectedExcerptPatterns: []
        };
        // Topic guesses nominate candidates; they do not establish authority.
        routeMatch.score = advisoryRanking ? 5 : routeMatch.score + 45;
        routeMatch.labels.add(route.label);
        if (sectionNumber === target.sectionPrefix) {
          routeMatch.exactTarget = true;
          routeMatch.rootClaimCoverage ||= target.rootClaimCoverage !== false && !(stipulatedOccupantLoad && route.label === "occupant-load calculation provisions");
          routeMatch.descendantClaimCoverage ||= target.descendantClaimCoverage !== false && !(stipulatedOccupantLoad && route.label === "occupant-load calculation provisions");
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
  headingScores.forEach((score, id) => scores.set(id, (scores.get(id) || 0) + score));
  [...passageHits, ...semanticHits, ...currentLexicalRecallHits, ...actionSubjectRecallHits, ...measurementRecallHits, ...activePacketHits, ...foregroundRecallHits].forEach(hit => scores.set(comparableSectionID(hit.sectionID),
    Math.max(scores.get(comparableSectionID(hit.sectionID)) || 0, hit.score * 3)));

  const preliminary = Array.from(scores, ([id, score]) => ({ id, score }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 160);
  // Construction dictionaries need a separate opportunity to supply targeted
  // term definitions even when a broad topic route fills the lexical shortlist.
  // Their complete text is never admitted automatically by this reservation.
  const preliminaryIDs = new Set(preliminary.map((entry) => entry.id));
  for (const hit of [...passageHits, ...semanticHits, ...currentLexicalRecallHits, ...actionSubjectRecallHits, ...measurementRecallHits, ...activePacketHits, ...foregroundRecallHits]) {
    const id = comparableSectionID(hit.sectionID);
    if (catalogByID.has(id) && !preliminaryIDs.has(id)) {
      preliminary.push({ id, score: scores.get(id) || 0 });
      preliminaryIDs.add(id);
    }
  }
  // A one-letter technical compound (for example S-trap or U-tube) can
  // lose its distinguishing letter in the token index. Reserve a bounded
  // shortlist from its substantive word before full-text phrase scoring;
  // otherwise project/context matches may evict the actual named rule.
  // Reservation grants no score: the full-text compound must still match.
  const compoundCandidateIDs = new Set();
  for (const compound of namedCompounds) {
    const word = compound.split(" ").at(-1);
    for (const form of singularForms(word)) {
      for (const id of index.get(form) || []) {
        if (catalogByID.has(id) && !preliminaryIDs.has(id)) compoundCandidateIDs.add(id);
      }
    }
  }
  for (const id of [...compoundCandidateIDs]
    .sort((left, right) => (scores.get(right) || 0) - (scores.get(left) || 0))
    .slice(0, 80)) {
    preliminary.push({ id, score: scores.get(id) || 0 });
    preliminaryIDs.add(id);
  }
  for (const section of sections.filter((item) => String(item.sectionNumber) === "202")) {
    const id = comparableSectionID(section.id);
    if (!preliminaryIDs.has(id)) preliminary.push({ id, score: scores.get(id) || 0 });
  }
  const detailed = [];
  for (const entry of preliminary) {
    const section = catalogByID.get(entry.id);
    const body = await readSectionBody(section);
    const fullText = sectionText(section, body);
    if (!fullText.trim()) continue;
    const normalizedFullText = normalizedText(fullText);
    const matchedTerms = Array.from(matchedTermsByID.get(entry.id) || [])
      .filter((term) => normalizedFullText.includes(term));
    const originalTerms = rawTokens(currentQuestion)
      .filter((term) => term.length >= 2 && !stopWords.has(term));
    const originalMatches = new Set(
      originalTerms.filter((term) => normalizedFullText.includes(term))
    );
    const coverage = originalTerms.length
      ? originalMatches.size / new Set(originalTerms).size
      : 0;
    const indexedPassage = passageHitsByID.get(entry.id);
    // A monolithic source can contain the exact subsection the user named.
    // Keep that passage-level identity through fusion and final sorting; its
    // containing catalog section need not have the same section number.
    const exactReference = exactReferenceIDs.has(entry.id) || indexedPassage?.exactReference === true;
    const routeMatch = routesByID.get(entry.id);
    const directReference = directReferenceKeys.has(`${String(section.codePrefix || "").toUpperCase()}:${String(section.sectionNumber || "")}`) ||
      directReferenceKeys.has(`*:${String(section.sectionNumber || "")}`) ||
      (indexedPassage?.exactReference === true && (
        directReferenceKeys.has(`${String(section.codePrefix || "").toUpperCase()}:${indexedPassage.subsectionNumber}`) ||
        directReferenceKeys.has(`*:${indexedPassage.subsectionNumber}`)));
    const inheritedReference = Boolean(exactReference && !directReference && retrievalContext);
    const contextualReference = Boolean(
      relevanceComparison && exactReference && !routeMatch && (
        comparisonReferenceKeys.has(
          `${String(section.codePrefix || "").toUpperCase()}:${String(section.sectionNumber || "")}`
        ) || comparisonReferenceKeys.has(`*:${String(section.sectionNumber || "")}`) ||
        (indexedPassage?.exactReference === true && (
          comparisonReferenceKeys.has(`${String(section.codePrefix || "").toUpperCase()}:${indexedPassage.subsectionNumber}`) ||
          comparisonReferenceKeys.has(`*:${indexedPassage.subsectionNumber}`)
        ))
      )
    );
    let passage = indexedPassage ? { text: indexedPassage.text, score: indexedPassage.score,
      blockID: indexedPassage.blockID } : bestPassage(body, passageTerms, bigrams);
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
    const titleScore = passageScore(`${section.title || ""}`, passageTerms, bigrams).score;
    const phraseText = normalizedFullText.replace(/["'“”‘’]/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ');
    const namedCompoundScore = namedCompounds.some(phrase => new RegExp(`\\b${phrase}s?\\b`, "i").test(phraseText)) ? 80 : 0;
    const measurementScore = requestedTemperature &&
      /\d+(?:\.\d+)?\s*(?:[°º]\s*[FC]|degrees?\b)/i.test(fullText) ? 30 : 0;
    const lexicalScore = fusedScores.has(entry.id) ? fusedScores.get(entry.id)
      : indexedPassage ? indexedPassage.score * 3 : entry.score * 0.05 +
      titleScore * 0.8 +
      passage.score;
    const disciplineFactor = explicitDisciplinePrefixes.size
      ? (explicitDisciplinePrefixes.has(section.codePrefix) ? 1.8 : 0.85)
      : disciplinePrefixes.has(section.codePrefix) ? (semanticHits.length ? 1.25 : 1.4) : 1;
    const scopeFactor = zoningScopeRankingFactor(section, normalizedQuestion, currentQuestion);
    const compatibleInheritedHint = inheritedReference && scopeFactor >= 1 &&
      (!explicitDisciplinePrefixes.size || explicitDisciplinePrefixes.has(section.codePrefix));
    // A short generic heading must not compensate for an unestablished
    // special-district scope or a parallel chapter incompatible with the
    // supplied district. Full passage relevance still keeps it searchable.
    const compatibleHeadingScore = scopeFactor >= 1 ? (headingScores.get(entry.id) || 0) : 0;
    const finalScore = (lexicalScore * disciplineFactor +
      (routeMatch?.score || 0) * (passageIndex ? 0.15 : 1) +
      namedCompoundScore + measurementScore + compatibleHeadingScore +
      (compatibleInheritedHint || contextualReference ? 15 : 0)) * scopeFactor + (directReference ? 100 : 0);
    detailed.push({
      section,
      body,
      passage,
      indexedPassage,
      score: finalScore,
      coverage,
      exactReference,
      directReference,
      inheritedReference,
      contextualReference,
      exactTopicRouteTarget: Boolean(routeMatch?.exactTarget),
      rootClaimCoverage: routeMatch?.rootClaimCoverage !== false,
      descendantClaimCoverage: routeMatch?.descendantClaimCoverage !== false,
      useSelectedPassageOnly: routeMatch?.useSelectedPassageOnly === true,
      matchedRoutes: Array.from(routeMatch?.labels || []),
      matchedTerms: Array.from(new Set([...matchedTerms, ...originalMatches])),
      definitionCarrier: researchEmbeddedDefinitionCarrier({ ...section, body }),
    });
  }

  detailed.sort((left, right) =>
    (!advisoryRanking && !passageIndex ? Number(right.exactTopicRouteTarget) - Number(left.exactTopicRouteTarget) : 0) ||
    Number(right.directReference) - Number(left.directReference) ||
    Number(right.exactReference && !right.contextualReference && !right.inheritedReference) -
      Number(left.exactReference && !left.contextualReference && !left.inheritedReference) ||
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
  const candidates = [];
  let selectedCandidates = detailed.slice(0, candidateLimit);
  const lead = detailed[0];
  // Separately cataloged children use the same branch rule as embedded
  // chapters. Reserve one already retrieved complete sibling before the source
  // cap; do not enumerate fresh catalog neighbors or cross corpus boundaries.
  if (lead?.indexedPassage && !lead.useSelectedPassageOnly && candidateLimit > 1) {
    const eligible = detailed.filter(item => item !== lead && !item.useSelectedPassageOnly &&
      item.indexedPassage && !item.contextualReference &&
      sameSiblingAuthority(lead.indexedPassage, item.indexedPassage) &&
      numberedSiblingParent(lead.indexedPassage) === numberedSiblingParent(item.indexedPassage) &&
      zoningScopeRankingFactor(item.section, normalizedQuestion, currentQuestion) >= 1)
      .map(item => {
        const literalTerms = new Set(rawTokens(item.indexedPassage.text).flatMap(token => [...singularForms(token)]));
        return { ...item.indexedPassage,
          currentQuestionScore: currentPassageScores.get(passageIdentity(item.indexedPassage)) || 0,
          currentQuestionOverlap: [...literalQuestionTerms].filter(term => !stopWords.has(term) && term.length > 2 && literalTerms.has(term)).length,
          semanticRank: semanticHits.findIndex(hit => comparableSectionID(hit.sectionID) === comparableSectionID(item.section.id)) + 1 || Infinity };
      });
    const companion = completeSibling(lead.indexedPassage, eligible, semanticHits.length > 0);
    const companionItem = companion && detailed.find(item => comparableSectionID(item.section.id) === comparableSectionID(companion.sectionID));
    if (companionItem) {
      companionItem.completeSiblingCompanionOf = comparableSectionID(lead.section.id);
      lead.indexedPassage = { ...lead.indexedPassage, companion: null };
      const preceding = selectedCandidates.filter(item => item === lead || item.directReference);
      selectedCandidates = [...preceding, companionItem, ...selectedCandidates.filter(item =>
        item !== companionItem && !preceding.includes(item))].slice(0, candidateLimit);
    }
  }
  // A topical primary rule can sit below an unrelated semantic lead. Retain
  // one complete current-detail sibling from the already authorized pool, not
  // freshly enumerated neighbors. The existing companion slot remains one.
  if (candidateLimit > 1 && !lead?.useSelectedPassageOnly &&
      !selectedCandidates.some(item => item.completeSiblingCompanionOf)) {
    const anchors = selectedCandidates.filter(item => item.indexedPassage && !item.useSelectedPassageOnly &&
      !item.contextualReference && numberedSiblingParent(item.indexedPassage) &&
      researchCurrentRuleDetailScore(item.indexedPassage, currentQuestion) >= 2 &&
      (currentPassageScores.get(passageIdentity(item.indexedPassage)) || 0) > 0 &&
      zoningScopeRankingFactor(item.section, normalizedQuestion, currentQuestion) >= 1)
      .sort((left, right) => (currentPassageScores.get(passageIdentity(right.indexedPassage)) || 0) -
        (currentPassageScores.get(passageIdentity(left.indexedPassage)) || 0));
    for (const anchor of anchors) {
      const siblings = detailed.filter(item => item !== anchor && item.indexedPassage && !item.useSelectedPassageOnly &&
        !item.contextualReference && !item.inheritedReference && sameSiblingAuthority(anchor.indexedPassage, item.indexedPassage) &&
        numberedSiblingParent(anchor.indexedPassage) === numberedSiblingParent(item.indexedPassage) &&
        zoningScopeRankingFactor(item.section, normalizedQuestion, currentQuestion) >= 1 &&
        researchCurrentRuleDetailScore(item.indexedPassage, currentQuestion) >= 2)
        .map(item => ({ item, score: currentPassageScores.get(passageIdentity(item.indexedPassage)) || 0 }))
        .filter(value => completeIndexedScope(value.item.indexedPassage) && value.score > 0)
        .sort((left, right) => right.score - left.score);
      const sibling = siblings[0];
      if (!sibling) continue;
      const preceding = selectedCandidates.filter(item => item === lead || item === anchor || item.directReference);
      if (preceding.length >= candidateLimit) continue;
      sibling.item.completeSiblingCompanionOf = comparableSectionID(anchor.section.id);
      selectedCandidates = [...preceding, sibling.item, ...selectedCandidates.filter(item =>
        !preceding.includes(item) && item !== sibling.item)].slice(0, candidateLimit);
      break;
    }
  }
  // Meaning recall can crowd a short, strongly matching current-question rule
  // out of the fixed shortlist. Reserve at most one already authorized lexical
  // source, while retaining the semantic lead, direct references and complete
  // sibling. This adds recall, never a determination of legal applicability.
  if ((semanticHits.length || measurementRecallHits.length || activePacketHits.length) && candidateLimit > 1 && !lead?.useSelectedPassageOnly) {
    const measurementReservation = strongActionSubjectReservation({ probeHits: measurementRecallHits, detailed,
      selected: selectedCandidates, currentQuestion, contextQuestion: normalizedQuestion, preferredPrefixes: disciplinePrefixes });
    const activeReservation = activePacketHits.map(hit => ({ hit, item: detailed.find(item => comparableSectionID(item.section.id) === comparableSectionID(hit.sectionID)),
      rank: currentPassageHits.findIndex(value => value.sectionID === hit.sectionID) + 1, strength: null, activePacket: true }))
      .find(({ item }) => item && item !== lead && !item.directReference && !item.useSelectedPassageOnly && !item.contextualReference &&
        !item.completeSiblingCompanionOf && zoningScopeRankingFactor(item.section, normalizedQuestion, currentQuestion) >= 1);
    const reservation = measurementReservation || activeReservation || (semanticHits.length && (strongActionSubjectReservation({ probeHits: actionSubjectRecallHits, detailed,
      selected: selectedCandidates, currentQuestion, contextQuestion: normalizedQuestion, preferredPrefixes: disciplinePrefixes }) ||
      strongCurrentLexicalReservation({ currentHits: currentPassageHits, detailed,
        selected: selectedCandidates, currentQuestion, contextQuestion: normalizedQuestion, preferredPrefixes: disciplinePrefixes,
        allowPurpose: retrievalContext?.sourceSelectionRestricted !== true })));
    const replaceIndex = selectedCandidates.findLastIndex(item => item !== lead &&
      !item.directReference && !item.completeSiblingCompanionOf && !item.useSelectedPassageOnly);
    if (reservation && replaceIndex >= 0) {
      const id = comparableSectionID(reservation.hit.sectionID);
      reservation.item.indexedPassage = mergedIndexedPassages(reservation.hit, reservation.hit,
        semanticHitsByID.get(id), currentPassageScores, currentQuestion,
        reservation.actionSubject === true || reservation === measurementReservation || reservation.activePacket === true || reservation.purposeMatches > 0);
      reservation.item.passage = { text: reservation.item.indexedPassage.text,
        score: reservation.hit.score, blockID: reservation.item.indexedPassage.blockID };
      reservation.item.currentQuestionLexicalReservation = { rank: reservation.rank,
        strength: reservation.strength == null ? null : Math.round(reservation.strength * 1000) / 1000,
        ...(reservation === measurementReservation ? { kind: "dependent_measurement_user_subject" }
          : reservation.activePacket ? { kind: "active_checked_rule_current_detail" }
          : reservation.actionSubject ? { kind: "current_action_resolved_subject" }
          : reservation.purposeMatches > 0 ? { kind: "current_requested_purpose" } : {}) };
      const protectedItems = selectedCandidates.filter(item => item === lead || item.directReference || item.completeSiblingCompanionOf);
      selectedCandidates = [...protectedItems, reservation.item, ...selectedCandidates.filter(item =>
        !protectedItems.includes(item) && item !== reservation.item)].slice(0, candidateLimit);
    }
  }
  if (candidateLimit > 1 && !lead?.useSelectedPassageOnly && foregroundPrefixes.size) {
    const protectedItems = selectedCandidates.filter(item => item === lead || item.directReference ||
      item.completeSiblingCompanionOf || item.currentQuestionLexicalReservation || item.useSelectedPassageOnly);
    const foreground = equipmentForegroundHits.slice(0, 5).flatMap((hit) => {
      const rank = foregroundHits.indexOf(hit);
      const item = detailed.find(value => comparableSectionID(value.section.id) === comparableSectionID(hit.sectionID));
      const words = new Set(rawTokens(hit.text).flatMap(word => [...singularForms(word)]));
      const overlap = [...new Set(foregroundWords)].filter(word => [...singularForms(word)].some(form => words.has(form))).length;
      // Prior citation identity is only a hint. It must not exclude a source
      // independently qualified for this current positive subject. Bind the
      // indexed scope to the body already read here; add no reads or slots.
      const positiveCurrent = researchPositiveSearchText(currentQuestion);
      const { edition: currentEdition, ambiguous } = currentEditionContext;
      const propertyVocabulary = vocabularyConcept?.subject === 'test_medium';
      const freshlyBoundCurrentSource = Boolean(item &&
        !relevanceComparison && !ambiguous && retrievalContext?.sourceSelectionRestricted !== true &&
        !/\b(?:compar\w*|versus|vs|both|difference)\b/i.test(positiveCurrent) &&
        (!currentEdition || sectionCodeEdition(item.section) === currentEdition) &&
        ['codePrefix', 'corpusID', 'codeVersion', 'codeEdition', 'jurisdiction'].every(key => item.section[key]) &&
        !item.section.referenceOnly && item.section.selectionMode !== 'section_reference' &&
        !item.section.truncated && item.section.textComplete !== false && item.section.researchClaimEligible !== false &&
        item.body?.researchClaimEligible !== false &&
        (!item.section.authorityClass || item.section.authorityClass === 'enacted') &&
        (!item.section.authorityStatus || item.section.authorityStatus === 'enacted') &&
        boundCanonicalRulePassage({ ...item.section, body: item.body, text: sectionText(item.section, item.body) }, hit, false, true));
      const independentlyCurrentInherited = Boolean(item?.inheritedReference && (equipmentIntent || vocabularyConcept) &&
        freshlyBoundCurrentSource);
      if (!item || protectedItems.includes(item) || item.definitionCarrier ||
          (vocabularyConcept && /\bdefinitions?\b/i.test(item.section.title || "")) || !foregroundPrefixes.has(item.section.codePrefix) ||
          item.contextualReference || (item.inheritedReference && !independentlyCurrentInherited) || item.useSelectedPassageOnly ||
          (propertyVocabulary && !freshlyBoundCurrentSource) ||
          !completeIndexedScope(hit) || !completeIndexedScope(item.indexedPassage) || overlap < foregroundOverlapMinimum ||
          zoningScopeRankingFactor(item.section, normalizedQuestion, currentQuestion) < 1) return [];
      item.currentQuestionForeground = { rank: rank + 1,
        source: equipmentIntent ? "positive_equipment_subject" : vocabularyConcept ? "positive_search_vocabulary" : "literal_current_question" };
      // Preserve the exact scope that qualified, not a semantic sibling.
      item.indexedPassage = mergedIndexedPassages(hit, hit, semanticHitsByID.get(comparableSectionID(hit.sectionID)),
        currentPassageScores, currentQuestion, true);
      item.passage = { text: item.indexedPassage.text, score: hit.score, blockID: item.indexedPassage.blockID };
      return [item];
    }).slice(0, 3);
    selectedCandidates = [...protectedItems, ...foreground, ...selectedCandidates.filter(item =>
      !protectedItems.includes(item) && !foreground.includes(item))].slice(0, candidateLimit);
  }
  // One already-read whole child may add current details absent from an admitted
  // parent. Reserve added coverage, not merely the highest broad lexical score.
  // Exact/protected reservations keep precedence; no reads or slots are added.
  if (candidateLimit > 1 && retrievalContext?.sourceSelectionRestricted !== true && !relevanceComparison) {
    for (const parent of selectedCandidates) {
      if (!parent.indexedPassage || parent.useSelectedPassageOnly || parent.contextualReference || parent.inheritedReference ||
          !boundCanonicalRulePassage({ ...parent.section, body: parent.body,
            text: sectionText(parent.section, parent.body) }, parent.indexedPassage, true)) continue;
      const children = detailed.filter(item => item !== parent && !selectedCandidates.includes(item) &&
        item.indexedPassage && !item.useSelectedPassageOnly && !item.contextualReference && !item.inheritedReference &&
        zoningScopeRankingFactor(item.section, normalizedQuestion, currentQuestion) >= 1 &&
        boundCanonicalRulePassage({ ...item.section, body: item.body, text: sectionText(item.section, item.body) }, item.indexedPassage, true))
        .map(item => ({ item, gained: researchImmediateChildDetailGain(parent.indexedPassage, item.indexedPassage, currentQuestion) }))
        .filter(value => value.gained)
        .sort((left, right) => right.gained.length - left.gained.length ||
          researchCurrentRuleDetailScore(right.item.indexedPassage, currentQuestion) - researchCurrentRuleDetailScore(left.item.indexedPassage, currentQuestion) ||
          right.item.score - left.item.score);
      const child = children[0];
      if (!child) continue;
      const protectedItems = selectedCandidates.filter(item => item === lead || item === parent || item.directReference ||
        item.completeSiblingCompanionOf || item.currentQuestionLexicalReservation || item.currentQuestionForeground);
      if (protectedItems.length >= candidateLimit) continue;
      child.item.currentDetailChildParent = Object.fromEntries(['id', 'sectionID', 'sectionNumber', 'subsectionNumber',
        'codePrefix', 'corpusID', 'codeVersion', 'codeEdition', 'jurisdiction', 'text', 'scopeComplete',
        'sourceTextHash', 'sourceOffsets'].map(key => [key, parent.indexedPassage[key]]));
      selectedCandidates = [...protectedItems, child.item, ...selectedCandidates.filter(item => !protectedItems.includes(item))]
        .slice(0, candidateLimit);
      break;
    }
  }
  const selectedIDs = new Set(selectedCandidates.map((item) => item.section.id));
  const selectedPrefixCounts = new Map();
  for (const item of selectedCandidates) {
    selectedPrefixCounts.set(item.section.codePrefix, (selectedPrefixCounts.get(item.section.codePrefix) || 0) + 1);
  }
  const definitionPool = detailed.filter((item) =>
    selectedPrefixCounts.has(item.section.codePrefix) &&
    (String(item.section.sectionNumber) === "202" || /\bdefinitions?\b/i.test(item.section.title || "") || item.definitionCarrier));
  const positiveQuestion = researchPositiveSearchText(currentQuestion);
  const definitionPrefixes = explicitQuestionDisciplinePrefixes(positiveQuestion);
  const definitionEdition = currentEditionContext.edition;
  const definitionHumanContext = retrievalContext?.contextDependentFollowUp === true && !relevanceComparison
    ? [...new Set([retrievalContext.conversationTopic, retrievalContext.immediateContext]
        .filter(value => typeof value === "string").map(value => value.slice(0, 640)))].slice(0, 2).join("\n") : "";
  for (const item of definitionPool) {
    if (item.contextualReference || item.useSelectedPassageOnly ||
        zoningScopeRankingFactor(item.section, normalizedQuestion, currentQuestion) < 1 ||
        (definitionPrefixes.size && !definitionPrefixes.has(item.section.codePrefix)) ||
        (definitionEdition && sectionCodeEdition(item.section) !== definitionEdition) ||
        (/\b(?:NYC|New York City)\b/i.test(positiveQuestion) && !/^(?:New York City|NYC)$/i.test(item.section.jurisdiction || ""))) continue;
    item.requestedDefinitionCarrier = researchRequestedDefinitionMatch({ ...item.section, body: item.body }, {
      question: currentQuestion, humanContext: definitionHumanContext
    });
    if (!directReferenceKeys.size) item.activeHumanDefinitionMatch = researchActiveHumanDefinitionMatch(
      { ...item.section, body: item.body }, {
        question: currentQuestion, humanTopics: [retrievalContext?.conversationTopic, retrievalContext?.immediateContext],
        contextDependentFollowUp: retrievalContext?.contextDependentFollowUp === true,
        relevanceComparison, topicDecision: retrievalContext?.topicDecision,
        sourceSelectionRestricted: retrievalContext?.sourceSelectionRestricted === true
      });
  }
  const activeHumanMatches = definitionPool.filter(item => item.activeHumanDefinitionMatch);
  // At most one already-read, uniquely aligned carrier gets one of the same
  // two supplemental slots. Ambiguous carriers retain the normal ordering.
  const activeHumanDefinition = activeHumanMatches.length === 1 ? activeHumanMatches[0] : null;
  if (activeHumanDefinition) activeHumanDefinition.activeHumanDefinitionReservation = activeHumanDefinition.activeHumanDefinitionMatch;
  const rankedSupplementalDefinitions = definitionPool.filter(item => !selectedIDs.has(item.section.id))
    .sort((left, right) =>
      (right.requestedDefinitionCarrier?.priority || 0) - (left.requestedDefinitionCarrier?.priority || 0) ||
      Number(foregroundPrefixes.has(right.section.codePrefix)) - Number(foregroundPrefixes.has(left.section.codePrefix)) ||
      selectedPrefixCounts.get(right.section.codePrefix) - selectedPrefixCounts.get(left.section.codePrefix) ||
      Number(String(right.section.sectionNumber) === "202") - Number(String(left.section.sectionNumber) === "202") ||
      right.score - left.score);
  const reservedHumanDefinition = activeHumanDefinition && !selectedIDs.has(activeHumanDefinition.section.id)
    ? activeHumanDefinition : null;
  const supplementalDefinitions = reservedHumanDefinition
    ? [reservedHumanDefinition, ...rankedSupplementalDefinitions.filter(item => item !== reservedHumanDefinition)].slice(0, 2)
    : rankedSupplementalDefinitions.slice(0, 2);
  // Structured tables and image metadata cannot affect lexical ranking. Resolve
  // them for the chosen candidates, keeping all existing source-review checks.
  for (const [index, item] of [...selectedCandidates, ...supplementalDefinitions].entries()) {
    const { body, passage, section } = item;
    // An enclosing rule can fall outside both ranked alternative pools. Obtain
    // at most its nearest responsive complete scope from this same authorized
    // index and already-read body; assembly must freshly bind and budget it.
    const enclosingRule = item.indexedPassage && !item.useSelectedPassageOnly
      ? nominateNearestCompleteIndexedRuleGroup(item, passageIndex, currentQuestion, { maximumCharacters: 12000 }) : null;
    const indexedAlternatives = [...new Map([enclosingRule, ...(item.indexedPassage?.passages || [])]
      .filter(Boolean).map(value => [passageIdentity(value), value])).values()].slice(0, 6);
    const richSources = structuredRichSources(body);
    item.sourceReviewRequirements = sourceReviewRequirements(body, passage, richSources);
    item.visualSources = [];
    if (typeof resolveVisualSource === "function") {
      for (const reference of visualSourceReferences(body)) {
        try {
          const source = await resolveVisualSource(reference);
          if (source) item.visualSources.push(source);
        } catch {
          // An unavailable image retains its blocking source-review requirement.
        }
      }
    }
    const passageTableReferences = Array.from(String(passage.text || "").matchAll(
      /\bTable\s+([A-Z]?\d+(?:-\d+)?(?:\.[0-9A-Za-z-]+)*)/gi
    )).map((match) => `Table ${match[1]}`);
    const ownZoningTables = String(section.codePrefix).toUpperCase() === "ZR"
      ? richSources.filter((source) => source.kind === "table" &&
          comparableTableReference(source.reference) === comparableTableReference(`ZR Table ${section.sectionNumber}`))
      : [];
    item.richSources = richSources.filter((source) =>
      passageTableReferences.some((reference) =>
        comparableTableReference(source.reference) === comparableTableReference(reference)
      ) || (ownZoningTables.length === 1 && source === ownZoningTables[0])
    );
    item.displayBlock = candidateDisplayBlock(body, passage);
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
    candidates.push({
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
      ...(item.indexedPassage && !item.useSelectedPassageOnly ? { indexedPassage: {
        id: item.indexedPassage.id, subsectionNumber: item.indexedPassage.subsectionNumber,
        contextTexts: item.indexedPassage.contextTexts, text: item.indexedPassage.text,
        completeSubsectionText: item.indexedPassage.completeSubsectionText,
        scopeComplete: item.indexedPassage.scopeComplete, sourceOffsets: item.indexedPassage.sourceOffsets,
        sourceTextHash: item.indexedPassage.sourceTextHash,
        alternatives: indexedAlternatives.map(passage => ({
          id: passage.id, subsectionNumber: passage.subsectionNumber, text: passage.text,
          contextTexts: passage.contextTexts, completeSubsectionText: passage.completeSubsectionText,
          sourceOffsets: passage.sourceOffsets, sourceTextHash: passage.sourceTextHash,
          scopeComplete: passage.scopeComplete
        })),
        companion: item !== lead || item.useSelectedPassageOnly ? null : item.indexedPassage.companion || null,
        sameSectionReferences: item.indexedPassage.sameSectionReferences || []
      } } : {}),
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
        ...(item.completeSiblingCompanionOf ? { completeSiblingCompanionOf: item.completeSiblingCompanionOf } : {}),
        ...(item.currentDetailChildParent ? { currentDetailChildParent: item.currentDetailChildParent } : {}),
        ...(item.currentQuestionLexicalReservation ? { currentQuestionLexicalReservation: item.currentQuestionLexicalReservation } : {}),
        ...(item.currentQuestionForeground ? { currentQuestionForeground: item.currentQuestionForeground } : {}),
        ...(item.definitionCarrier ? { canonicalEmbeddedDefinitions: item.definitionCarrier } : {}),
        ...(item.requestedDefinitionCarrier ? { requestedDefinitionCarrier: item.requestedDefinitionCarrier } : {}),
        ...(item.activeHumanDefinitionReservation ? { activeHumanDefinitionReservation: item.activeHumanDefinitionReservation } : {}),
        topicRoutes: item.matchedRoutes,
        exactTopicRouteTarget: item.exactTopicRouteTarget,
        rootClaimCoverage: item.rootClaimCoverage,
        descendantClaimCoverage: item.descendantClaimCoverage,
        useSelectedPassageOnly: item.useSelectedPassageOnly,
        exactReference: item.exactReference && !item.inheritedReference,
        inheritedAuthorityReference: item.inheritedReference,
        contextualReference: item.contextualReference,
        relevanceComparison,
        requiresAdditionalSourceReview: item.sourceReviewRequirements.length > 0,
        containsVisualSource: item.sourceReviewRequirements.some((requirement) => requirement.kind === "visual-source"),
        referencesTable: /\bTable\s+[A-Z]?\d/i.test(item.passage.text),
        includesStructuredTable: item.richSources.some((source) => source.kind === "table"),
        containsException: /\bexception\b/i.test(item.passage.text),
        containsCrossReference: /\b(section|table|chapter)\s+\d/i.test(item.passage.text)
      }
    });
  }

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
    .filter(({ pattern, codePrefix, questionText }) =>
      pattern.test(questionText ? questionText(normalizedQuestion) : normalizedQuestion) && (!codePrefix || !availablePrefixSet.has(codePrefix))
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
    ...(passageIndex ? { passageIndexFingerprint: passageIndex.fingerprint } : {}),
    ...(semanticResult ? { semanticSearch: semanticResult.metadata } : {}),
    candidateDisplayVersion: evidenceCandidateDisplayVersion,
    question: normalizedQuestion,
    candidateState: "unreviewed",
    candidates: candidates.slice(0, candidateLimit),
    supplementalDefinitionCandidates: candidates.slice(candidateLimit),
    chapterScopeCandidates: nominateResearchChapterScopeCandidates(candidates.slice(0, candidateLimit), sections, passageIndex),
    delegatingRuleGroups: nominateDelegatedRuleGroups(selectedCandidates.filter(item =>
      !explicitDisciplinePrefixes.size || explicitDisciplinePrefixes.has(item.section.codePrefix)), sections, passageIndex,
      currentQuestion, codeReferences),
    coverageLimitations,
    outsideCurrentLibrary,
    searchedSectionCount: sections.length
  };
}
