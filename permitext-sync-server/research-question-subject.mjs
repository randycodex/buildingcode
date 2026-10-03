// Shared search intent: vocabulary chooses candidate books and context facets,
// never a governing provision, code edition or legal/project conclusion.
export const researchQuestionSubjectVersion = "20261003-shared-current-question-subject-v1";
export function researchFloorAreaRatioRequested(text = "") {
  return /\bFAR\b/.test(text) || /\b(?:permitted|maximum|allowable|calculate)\s+far\b|\bfar\s*(?:of|=|\d)/i.test(text);
}
export function researchQuestionSubject(question = "") {
  const text = String(question || "");
  const prefixes = new Set();
  const nonphysicalCeiling = /\bceiling\s+(?:on|for|of)\s+(?:the\s+)?(?:floor[- ]area|FAR|density|cost|price|budget|rent|capacity)\b/i.test(text);
  const roomDimensions = !nonphysicalCeiling && /\b(?:ceilings?|headroom|clear[- ]height|room[- ]height|room[- ]dimensions?)\b/i.test(text);
  if (roomDimensions || /\b(?:egress|exit[- ]access|fire[- ]separation|fire[- ]resistance|fire[- ]rated|handrails?|guardrails?|stairways?|staircases?|accessible[- ]routes?)\b/i.test(text)) prefixes.add("BC");
  if (/\b(?:fuel[- ]gas|natural[- ]gas|gas[- ]fired|gas[-\s]+(?:piping|pipes?|lines?|systems?|appliances?|connectors?|connections?))\b/i.test(text)) prefixes.add("FGC");
  if (/\b(?:ventilat\w*|exhaust|ducts?|air[- ]condition\w*|makeup[- ]air|mechanical\s+(?:code|system)|combustion\s+air|(?:grease|kitchen|cooking|type\s+[I12]+)[- ]hoods?|hoods?)\b/i.test(text)) prefixes.add("MC");
  if (/\b(?:plumbing|sanitary|drain(?:age|s)?|sewer|trap(?:s|ping)?|lavator\w*|toilet|shower|water[- ]heater|drinking[- ]fountain)\b/i.test(text)) prefixes.add("PC");
  if (/\b(?:propane|LPG|liquefied[- ]petroleum|flammable[- ]liquids?|hazardous[- ]materials?|fire[- ]safety|extinguishers?|fire[- ]lanes?|fire[- ]apparatus\s+access)\b/i.test(text)) prefixes.add("FC");
  if (/\b(?:DOB\s+inspection|certificate\s+of\s+occupancy|stop[- ]work\s+order|permit\s+application)\b/i.test(text)) prefixes.add("AC");
  return { version: researchQuestionSubjectVersion, codePrefixes: [...prefixes], roomDimensions,
    buildingArea: /\b(?:building[- ]area|floor[- ]area(?:[- ]ratio)?|lot[- ]coverage|square[- ](?:feet|foot)|sq\s*ft)\b/i.test(text) || researchFloorAreaRatioRequested(text) };
}
