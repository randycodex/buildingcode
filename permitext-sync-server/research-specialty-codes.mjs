// Searchable publications and their boundaries, not a project applicability finding.
export const specialtyCodeVersion = "CodeContent/authored/new-york-city/2025-specialty-codes/bundle.json#1";
export const electricalResearchCue = /\b(?:electrical\s+(?:code|installation|service|circuit)|NEC|NFPA\s*70|GFCI|AFCI|breakers?|Romex|nonmetallic\s+cable|grounding\s+(?:pigtails?|conductors?|devices?)|voltage[- ]drop|MC\s+cable|air[- ]conditioner\s+receptacle|EC\s*(?:§\s*)?\d+)\b/i;
export const energyResearchCue = /\b(?:energy\s+(?:code|conservation|requirements?|inspections?)|NYCECC|ECC\s*(?:§\s*)?[RC]?\d+|COMcheck|EnergyPlus|ASHRAE\s*90\.1|U[- ]factor|SHGC|R[- ]value|insulation|(?:rigid|spray)\s+foam|(?:single|double)[- ](?:pane|glazing)|fenestration|thermally|thermal\s+(?:envelope|performance|bridg\w*)|condensation|mini[- ]split)\b/i;
const otherAuthority = /\b(?:AC|BC|EBC|FC|FGC|MC|PC|ZR)\s*(?:§\s*)?[A-Z]?\d|\b(?:building|construction|plumbing|mechanical|fuel\s+gas|fire)\s+code\b|\bzoning\b/i;
const compact = value => String(value || "").replace(/\s+/g, " ").trim();

export function specialtyResearchCorpora() {
  return [
    {
      id: "nyc-2025-energy-code", label: "2025 NYC Energy Conservation Code",
      codeEdition: "2025 NYC Energy Conservation Code — integrated NYC publication",
      codeVersion: specialtyCodeVersion, codeYear: 2025, codePrefixes: ["ECC"],
      applicabilityStatus: "current-enacted-edition", automaticResearchEligible: true, optInRequired: false,
      effectiveDate: "2026-03-30", aliases: ["2025 NYCECC", "2025 energy code"],
      sourceCoverage: {
        boundary: "Integrated NYC residential, commercial, administration and modified ASHRAE publication; incorporated external standards are not supplied by a reference alone.",
        applicability: "Confirm filing completeness and transition rules, residential/commercial scope, and any approved historic-building report. Current publication does not establish applicability to earlier work.",
        missingComponents: ["Historical energy editions and contemporaneous inspection rules", "Referenced external standards and project-specific equipment/assembly performance data"],
        tableBoundary: "Published tables are extracted as plain text. Use only unambiguous row/column associations, units and footnotes; request the original table when extraction loses an association."
      }
    },
    {
      id: "nyc-2025-electrical-amendments", label: "2025 NYC Electrical Code — local amendments",
      codeEdition: "2025 NYC Electrical Code — NYC amendments to 2020 NEC; base NEC absent",
      codeVersion: specialtyCodeVersion, codeYear: 2025, codePrefixes: ["EC"],
      applicabilityStatus: "current-enacted-edition", automaticResearchEligible: true, optInRequired: false,
      effectiveDate: "2025-12-21", aliases: ["2025 electrical code", "NYC amendments to 2020 NEC"],
      sourceCoverage: {
        boundary: "NYC-enacted amendments and Article 1101 only. Unchanged adopted 2020 NFPA 70 / NEC requirements are absent. An amendment changes only its stated scope, not the rest of the base provision.",
        applicability: "Confirm the governing electrical edition and transition rules; do not equate building age or a construction-code edition with the electrical edition.",
        missingComponents: ["2020 NFPA 70 / NEC base text", "Historical electrical editions and their base NEC text", "Manufacturer instructions, utility specifications and project load data"]
      }
    }
  ];
}

function requestedYears(text, family, allowShorthand) {
  const cleaned = text.replace(/\b(?:built|constructed|erected|completed)\s+(?:(?:in|around|before|after)\s+)?\d{4}\b/gi, "");
  const name = family === "energy" ? "(?:energy(?:\\s+conservation)?(?:\\s+code)?|NYCECC|ECC)" : "(?:electrical(?:\\s+code)?|EC)";
  const years = new Set();
  for (const pattern of [
    new RegExp(`\\b(20\\d{2})\\s+(?:(?:NYC|New York City)\\s+)?${name}\\b`, "gi"),
    new RegExp(`\\b${name}\\s*(?:code\\s*)?(?:edition\\s*)?(?:of\\s*)?(20\\d{2})\\b`, "gi"),
    // "NYC 2016" is a software code selection only within an energy subject.
    ...(family === "energy" ? [/\bNYC\s+(20\d{2})\b/gi] : []),
    ...(allowShorthand ? [/\b(?:what|how)\s+about\s+(?:the\s+)?(20\d{2})\b/gi,
      /\b(?:use|under|compare|with|and|versus|vs\.?|to)\s+(?:the\s+)?(20\d{2})(?:\s+(?:edition|code))?\b/gi] : [])
  ]) for (const match of cleaned.matchAll(pattern)) {
    const after = cleaned.slice(match.index + match[0].length);
    const other = family === "energy" ? /^(?:\s+(?:NYC|New York City))?\s+(?:electrical|EC|NEC|NFPA\s*70)\b/i
      : /^(?:\s+(?:NYC|New York City))?\s+(?:energy|ECC|NYCECC)\b/i;
    if (!other.test(after)) years.add(Number(match[1]));
  }
  if (family === "electrical") {
    if (/\b(?:2020\s+(?:NEC|NFPA\s*70)|(?:NEC|NFPA\s*70)\s*(?:edition\s*)?2020)\b/i.test(cleaned)) { years.delete(2020); years.add(2025); }
    if (/\b(?:2008\s+(?:NEC|NFPA\s*70)|(?:NEC|NFPA\s*70)\s*(?:edition\s*)?2008)\b/i.test(cleaned)) { years.delete(2008); years.add(2011); }
  }
  return [...years];
}

function reportedFilingDate(text) {
  // Read a reported filing date; building age and approval dates are different facts.
  const marker = /\b(?:filed|submitted|filing\s+date)\s*(?:(?:was|is|on)\s+)?(\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/i;
  const match = text.match(marker);
  if (!match) return null;
  const timestamp = Date.parse(match[1]);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : null;
}

export function specialtyResearchRequests({ question, previousMessages = [], inheritTopic = true, projectCodeVersion = null, projectFacts = [] } = {}) {
  const current = compact(question);
  const history = previousMessages.filter(message => !message?.role || message.role === "user")
    .map(message => compact(message?.question || message?.content || message?.text)).filter(Boolean);
  const requested = [];
  for (const [family, cue, currentID] of [["energy", energyResearchCue, "nyc-2025-energy-code"],
    ["electrical", electricalResearchCue, "nyc-2025-electrical-amendments"]]) {
    const configured = compact(projectCodeVersion);
    const configuredFamily = new RegExp(`(?:${family}|${family === "energy" ? "NYCECC|ECC" : "electrical-amendments"})`, "i").test(configured);
    const otherCue = family === "energy" ? electricalResearchCue : energyResearchCue;
    let prior = "";
    if (inheritTopic && !otherAuthority.test(current)) for (const text of [...history].reverse()) {
      if (cue.test(text)) { prior = text; break; }
      if (otherAuthority.test(text) || otherCue.test(text)) break;
    }
    // An explicit different specialty starts a new book unless both are named.
    const otherSpecialty = otherCue.test(current);
    if (!cue.test(current) && (!prior || otherSpecialty) && !(!otherAuthority.test(current) && configuredFamily)) continue;
    let years = requestedYears(current, family, Boolean(prior || cue.test(current)));
    if (!years.length && prior) {
      // The latest explicit selection within this subject survives a follow-up.
      for (const text of [...history].reverse()) {
        if ((otherAuthority.test(text) || otherCue.test(text)) && !cue.test(text)) break;
        years = requestedYears(text, family, cue.test(text) || /\b(?:what|how)\s+about\b/i.test(text));
        if (years.length) break;
      }
    }
    if (!years.length && configuredFamily) years = [...configured.matchAll(/\b(20\d{2})\b/g)].map(match => Number(match[1]));
    const filingContext = [current, ...projectFacts].map(compact).join("\n");
    const filingDate = reportedFilingDate(filingContext);
    const completeEnergy = /\bcomplete(?:d)?\s+(?:energy\s+)?(?:submission|analysis|application|filing)\b/i.test(filingContext) &&
      !/\bincomplete\b|\bmaterial\s+(?:compliance\s+)?change\b/i.test(filingContext);
    if (!years.length && family === "energy" && filingDate && filingDate >= "2020-05-12" && filingDate < "2026-03-30" && completeEnergy) years = [2020];
    const cutoff = family === "energy" ? "2026-03-30" : "2025-12-21";
    const retrospective = filingDate ? filingDate < cutoff : /\b(?:filed|filing|approved|approval)\b[^.!?]{0,60}\b(?:19\d{2}|20(?:0\d|1\d|2[0-4]))\b/i.test(filingContext);
    if (!years.length && retrospective) {
      requested.push({ id: `nyc-${family}-historical`, family, year: null, available: false,
        reason: "earlier filing requires historical edition and transition evidence" });
    } else for (const year of years.length ? years : [2025]) requested.push({
      id: year === 2025 ? currentID : `nyc-${year}-${family}-code`, family, year,
      available: year === 2025, reason: years.length ? `explicit or continuing ${year} ${family} edition` : `${family} subject; applicability unresolved`
    });
  }
  return requested;
}

export function unavailableSpecialtyCorpus(request) {
  const label = request.year ? `${request.year} NYC ${request.family === "energy" ? "Energy Conservation" : "Electrical"} Code`
    : `Historical NYC ${request.family === "energy" ? "Energy Conservation" : "Electrical"} Code`;
  return {
    id: request.id, label, codeEdition: label, codeYear: request.year, codeVersion: null,
    codePrefixes: [request.family === "energy" ? "ECC" : "EC"], applicabilityStatus: "unavailable-edition",
    automaticResearchEligible: false, retrievalRole: "requested", routeReason: request.reason,
    blockedReason: "This edition's operative text and transition evidence are not supplied. Do not substitute the current specialty publication."
  };
}

export function specialtySourceMetadata(body, corpus) {
  if (!["nyc-2025-energy-code", "nyc-2025-electrical-amendments"].includes(corpus?.id)) return {};
  const published = body?.specialtyCodeSource || {};
  return { sourceCoverage: structuredClone(corpus.sourceCoverage), sourceProvenance: {
    sourceAuthority: published.sourceAuthority, sourceURL: published.sourceURL,
    sourceSHA256: published.sourceSHA256, effectiveDate: published.effectiveDate,
    extractionBoundary: published.extractionBoundary
  } };
}

export function constrainSpecialtySearchPlan(searchPlan, originalPlan) {
  // A generated search query cannot relax the user's edition boundary.
  const requested = [...(originalPlan.selected || []), ...(originalPlan.unavailable || [])]
    .filter(corpus => corpus.retrievalRole !== "recall_only");
  const permitted = new Map(["EC", "ECC"].map(prefix => [prefix,
    requested.filter(corpus => corpus.codePrefixes?.includes(prefix)).map(corpus => corpus.id)]));
  const allowed = corpus => !corpus.codePrefixes?.some(prefix =>
    permitted.get(prefix)?.length && !permitted.get(prefix).includes(corpus.id));
  const selected = searchPlan.selected.filter(allowed);
  const dropped = searchPlan.selected.filter(corpus => !selected.includes(corpus));
  const droppedIDs = new Set([...dropped, ...(searchPlan.unavailable || []).filter(corpus => !allowed(corpus))].map(corpus => corpus.id));
  return { ...searchPlan, selected,
    requestedCorpusIDs: [...new Set([...(searchPlan.requestedCorpusIDs || []).filter(id => !droppedIDs.has(id)),
      ...requested.filter(corpus => corpus.codePrefixes?.some(prefix => permitted.has(prefix))).map(corpus => corpus.id)])],
    excluded: [...(searchPlan.excluded || []), ...dropped.map(corpus => ({ ...corpus,
      blockedReason: "Generated query differs from the user's requested specialty edition." }))],
    unavailable: [...new Map([...(searchPlan.unavailable || []).filter(allowed), ...(originalPlan.unavailable || [])]
      .map(corpus => [corpus.id, corpus])).values()] };
}

export function missingEnergyReferenceLookups(answer, corpusPlan, sources = [], {question = ""} = {}) {
  if (!corpusPlan.selected?.some(corpus => corpus.id === 'nyc-2025-energy-code' && corpus.retrievalRole !== 'recall_only')) return [];
  const gaps = [...(answer.evidenceLimitations || []), ...(answer.additionalEvidenceNeeded || [])].join('\n');
  const numbers = [...new Set([...gaps.matchAll(/\b(?:ECC\s+)?([RC]\d+(?:\.[0-9A-Za-z-]+)+)\b/gi)].map(match => match[1].toUpperCase()))];
  // Follow a supplied thermal-rule referral when an opaque-door draft reports
  // a missing U-factor table without naming its subsection. The query number
  // comes from the current publication, never from a remembered code rule.
  const opaqueDoor = /\bopaque\b[^.!?]{0,90}\bdoors?\b|\bdoors?\b[^.!?]{0,120}\b(?:opaque|without\s+glass|no[- ]glass)\b/i.test(question);
  if (opaqueDoor && /\bU[- ]factor\b/i.test(gaps) && /\b(?:table|limit|requirement)\w*\b/i.test(gaps)) {
    for (const source of sources.filter(source => source.corpusID === 'nyc-2025-energy-code' && !source.truncated)) {
      for (const match of String(source.text || '').matchAll(/\bthermal\s+requirements\s+of\s+(?:Section\s+)?([RC]\d+(?:\.[0-9A-Za-z-]+)+)/gi)) {
        const number = match[1].toUpperCase();
        if (!numbers.includes(number)) numbers.push(number);
      }
    }
  }
  return numbers.filter(number => !sources.some(source => source.corpusID === 'nyc-2025-energy-code' &&
    new RegExp(`(?:^|\\n)(?:TABLE )?${number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ \\t]+`, 'i').test(source.text || '')))
    .slice(0, 2).map(number => ({number, query:`ECC ${number}`}));
}
