export const researchCorpusRegistryVersion = "20260902-edition-identity-routing-v3";

const constructionCodeVersion =
  "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
const historicalConstructionCodeVersion =
  "CodeContent/authored/new-york-city/2014-construction-codes/bundle.json#1";
const enactedAdministrativeCodeVersion =
  "CodeContent/authored/new-york-city/2026-enacted-administrative-code/bundle.json#1";
const zoningCodeVersion =
  "CodeContent/authored/new-york-city/2026-zoning-resolution/bundle.json#1";

const constructionCue = /\b(?:AC|BC|FGC|MC|PC)\s*(?:§\s*)?[A-Z]?\d|\b(?:building|construction|plumbing|mechanical|fuel\s+gas)\s+code\b|\b(?:means\s+of\s+egress|occupancy|travel\s+distance|fixture\s+count|construction\s+type)\b/i;
const fireCue = /\b(?:NYC\s+)?Fire\s+Code\b|\bFC\s*(?:§\s*)?[A-Z]?\d|\bFDNY\b|\bFire\s+Department\b|\b(?:hot\s+work|operational|hazardous\s+materials?)\s+permit\b/i;
const zoningCue = /\bZoning\s+Resolution\b|\bZR\s*(?:§\s*)?\d|\b(?:Sections?|Table|§{1,2})\s+\d{1,3}-\d{2,4}\b|\bzoning\s+(?:district|lot|map|text|use|floor\s+area|setback|bulk|applicability)\b|\b(?:special\s+purpose|special)\s+district\b|\boff[-\s]street\s+parking\b|\bparking\s+(?:requirement|required|spaces?|waiver|reduction)\b|\b(?:floor\s+area\s+ratio|FAR|use\s+group|lot\s+coverage|development\s+rights?)\b|\b(?:R\d{1,2}[A-Z]?|C\d(?:-\d[A-Z]?)?|M\d(?:-\d)?)\b/i;
const projectDependentZoningCue = /\b(?:parking|floor\s+area|FAR|permitted\s+use|use\s+permitted|bulk|setback|yard|lot\s+coverage|development\s+rights?)\b/i;
const futureExistingBuildingCue = /\b(?:2026\s+)?Existing\s+Building\s+Code\b|\bEBC\s*(?:§\s*)?[A-Z]?\d/i;
const historical2014ConstructionCue = /\b2014\s+(?:NYC\s+)?(?:Construction|Building|Plumbing|Mechanical|Fuel\s+Gas)\s+Code\b|\b(?:BC|AC|PC|MC|FGC)14\b/i;
const historicalBuildingCue = /\b1968\s+(?:NYC\s+)?Building\s+Code\b|\bBC68\b/i;
const historical2014FollowUpCue = /\b(?:the\s+)?2014(?:\s+(?:edition|code))?\b/i;
const current2022FollowUpCue = /\b(?:the\s+)?2022(?:\s+(?:edition|code))?\b/i;
const appendixPCrossEditionCue = /\b(?:BC\s*[- ]?)?Appendix\s+P\b/i;

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function recentUserContext(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => !message?.role || message.role === "user")
    .slice(-8)
    .map((message) => compactText(message?.question || message?.content || message?.text))
    .filter(Boolean)
    .join("\n");
}

function immutableCorpus(value) {
  return Object.freeze({
    jurisdiction: "New York City",
    authorityClass: "enacted",
    ...value,
    codePrefixes: Object.freeze([...(value.codePrefixes || [])]),
    aliases: Object.freeze([...(value.aliases || [])])
  });
}

export function createResearchCorpusRegistry({
  zoningResearchEligibility = false,
  zoningBlockedReason = "Zoning-specific evaluation cases require approval before ordinary Research can retrieve this corpus."
} = {}) {
  return Object.freeze([
    immutableCorpus({
      id: "nyc-2022-construction-codes",
      label: "2022 NYC Construction Codes",
      codeEdition: "2022 New York City Construction Codes",
      codeVersion: constructionCodeVersion,
      codeYear: 2022,
      codePrefixes: ["AC", "BC", "FGC", "MC", "PC"],
      applicabilityStatus: "current-enacted-edition",
      automaticResearchEligible: true,
      optInRequired: false,
      aliases: ["nyc-2022", "2022 construction codes"]
    }),
    immutableCorpus({
      id: "nyc-2022-fire-code",
      label: "2022 NYC Fire Code",
      codeEdition: "2022 NYC Fire Code — current consolidated text",
      codeVersion: enactedAdministrativeCodeVersion,
      codeYear: 2022,
      codePrefixes: ["FC"],
      applicabilityStatus: "current-consolidation",
      automaticResearchEligible: true,
      optInRequired: false,
      aliases: ["nyc-fire-code", "2022 fire code", "fire code"]
    }),
    immutableCorpus({
      id: "nyc-2014-construction-codes",
      label: "2014 NYC Construction Codes",
      codeEdition: "2014 NYC Construction Codes — DOB consolidated archive",
      codeVersion: historicalConstructionCodeVersion,
      codeYear: 2014,
      codePrefixes: ["AC", "BC", "FGC", "MC", "PC"],
      applicabilityStatus: "prior-edition-case-specific",
      automaticResearchEligible: true,
      optInRequired: false,
      aliases: ["nyc-2014", "2014 construction codes", "2014 building code"]
    }),
    immutableCorpus({
      id: "nyc-zoning-resolution",
      label: "NYC Zoning Resolution",
      codeEdition: "NYC Zoning Resolution — text through 2026-08-13",
      codeVersion: zoningCodeVersion,
      codeYear: null,
      codePrefixes: ["ZR"],
      applicabilityStatus: "continuously-amended",
      automaticResearchEligible: zoningResearchEligibility === true,
      optInRequired: false,
      blockedReason: zoningResearchEligibility === true ? null : compactText(zoningBlockedReason),
      aliases: ["nyc-zoning-resolution", "zoning resolution"]
    }),
    immutableCorpus({
      id: "nyc-existing-building-code-2027",
      label: "NYC Existing Building Code",
      codeEdition: "NYC Existing Building Code — effective July 17, 2027",
      codeVersion:
        "CodeContent/authored/new-york-city/2026-existing-building-code/bundle.json#1",
      codeYear: 2026,
      codePrefixes: ["EBC"],
      applicabilityStatus: "future-effective",
      automaticResearchEligible: false,
      optInRequired: true,
      blockedReason: "This enacted code is not effective until July 17, 2027 and is excluded from ordinary current-code Research.",
      aliases: ["existing building code", "ebc"]
    }),
    immutableCorpus({
      id: "nyc-1968-building-code",
      label: "1968 NYC Building Code",
      codeEdition: "1968 NYC Building Code — historical",
      codeVersion: enactedAdministrativeCodeVersion,
      codeYear: 1968,
      codePrefixes: ["BC68"],
      applicabilityStatus: "historical",
      automaticResearchEligible: false,
      optInRequired: true,
      blockedReason: "Historical and prior-code material requires an explicit applicability path and is excluded from ordinary current-code Research.",
      aliases: ["1968 building code", "bc68"]
    })
  ]);
}

export function unapprovedZoningDiagnosticEnabled(environment = process.env) {
  return environment.PERMITEXT_RUN_UNAPPROVED_ZONING_DIAGNOSTICS === "1" &&
    environment.VERCEL !== "1" &&
    !String(environment.VERCEL_ENV || "").trim();
}

function routeRecord(corpus, reason) {
  return {
    ...corpus,
    routeReason: reason
  };
}

export function routeResearchCorpora({
  question,
  previousMessages = [],
  projectCodeVersion = null,
  projectFacts = [],
  registry
} = {}) {
  const availableRegistry = Array.isArray(registry)
    ? registry
    : createResearchCorpusRegistry();
  const currentQuestion = compactText(question);
  if (!currentQuestion) throw new Error("Research corpus routing requires a question.");
  const conversationContext = recentUserContext(previousMessages);
  const followsConstructionConversation = constructionCue.test(conversationContext) ||
    historical2014ConstructionCue.test(conversationContext);
  const shorthand2014Requested = followsConstructionConversation &&
    historical2014FollowUpCue.test(currentQuestion);
  const shorthand2022Requested = followsConstructionConversation &&
    current2022FollowUpCue.test(currentQuestion);
  const projectHasZoningContext = (Array.isArray(projectFacts) ? projectFacts : [])
    .some((fact) => /^(?:Zoning Fact|NYC Planning Fact)\s+—\s+(?:Zoning District|Zoning Map|BBL|Block|Tax Lot)/i.test(compactText(fact)));
  const projectZoningRequested = projectHasZoningContext && projectDependentZoningCue.test(currentQuestion);
  const currentHasCorpusCue = [
    constructionCue,
    fireCue,
    zoningCue,
    futureExistingBuildingCue,
    historical2014ConstructionCue,
    historicalBuildingCue,
    appendixPCrossEditionCue
  ].some((pattern) => pattern.test(currentQuestion)) ||
    shorthand2014Requested ||
    shorthand2022Requested ||
    projectZoningRequested;
  const context = currentHasCorpusCue
    ? currentQuestion
    : [currentQuestion, conversationContext].filter(Boolean).join("\n");
  const futureRequested = futureExistingBuildingCue.test(context);
  const historical2014Requested = historical2014ConstructionCue.test(context) || shorthand2014Requested;
  const historicalRequested = historicalBuildingCue.test(context);
  const appendixPCrossEditionRequested =
    appendixPCrossEditionCue.test(context) && !/\b(?:2014|2022)\b/.test(context);
  const buildingCodeOnlyScope =
    /\bbased only on (?:the )?(?:selected )?Building Code passages\b/i.test(currentQuestion);
  const explicitCurrentConstructionCue = shorthand2022Requested || /\b(?:AC|BC|FGC|MC|PC)\s*(?:§\s*)?[A-Z]?\d|\b2022\s+(?:NYC\s+)?(?:Building|Construction|Plumbing|Mechanical|Fuel\s+Gas)\s+Code\b/i.test(context);
  const constructionRequested = (constructionCue.test(context) || shorthand2022Requested) &&
    (!futureRequested && !historical2014Requested && !historicalRequested || explicitCurrentConstructionCue);
  const fireRequested = fireCue.test(context);
  const zoningRequested = !buildingCodeOnlyScope && (zoningCue.test(context) || projectZoningRequested);
  const requestedIDs = new Map();
  if (constructionRequested) requestedIDs.set("nyc-2022-construction-codes", "construction-code cue");
  if (fireRequested) requestedIDs.set("nyc-2022-fire-code", "Fire Code or FDNY cue");
  if (zoningRequested) {
    requestedIDs.set(
      "nyc-zoning-resolution",
      projectZoningRequested ? "zoning question with Project zoning facts" : "zoning cue"
    );
  }
  if (futureRequested) requestedIDs.set("nyc-existing-building-code-2027", "future-effective EBC cue");
  if (historical2014Requested) {
    requestedIDs.set("nyc-2014-construction-codes", "explicit 2014 Construction Code cue");
  }
  if (appendixPCrossEditionRequested) {
    requestedIDs.set("nyc-2022-construction-codes", "current Appendix P status");
    requestedIDs.set("nyc-2014-construction-codes", "Appendix P cross-edition context");
  }
  if (historicalRequested) requestedIDs.set("nyc-1968-building-code", "historical-code cue");
  if (!requestedIDs.size) {
    const configuredVersion = compactText(projectCodeVersion).toLocaleLowerCase("en-US");
    const projectCorpus = configuredVersion
      ? availableRegistry.find((corpus) => [
          corpus.id,
          corpus.label,
          corpus.codeEdition,
          corpus.codeVersion,
          ...(corpus.aliases || [])
        ].some((candidate) => compactText(candidate).toLocaleLowerCase("en-US") === configuredVersion))
      : null;
    requestedIDs.set(
      projectCorpus?.id || "nyc-2022-construction-codes",
      projectCorpus ? "Project configured code basis" : "ordinary Construction Code default"
    );
  }

  const selected = [];
  const unavailable = [];
  const excluded = [];
  for (const corpus of availableRegistry) {
    const reason = requestedIDs.get(corpus.id);
    if (!reason) {
      if (corpus.optInRequired) excluded.push(routeRecord(corpus, "excluded from ordinary Research"));
      continue;
    }
    if (corpus.automaticResearchEligible) {
      selected.push(routeRecord(corpus, reason));
    } else if (corpus.optInRequired) {
      excluded.push(routeRecord(corpus, reason));
    } else {
      unavailable.push(routeRecord(corpus, reason));
    }
  }
  return {
    schemaVersion: 1,
    registryVersion: researchCorpusRegistryVersion,
    routingMode: "question-and-conversation-topic",
    selected,
    unavailable,
    excluded,
    requestedCorpusIDs: [...requestedIDs.keys()]
  };
}

export function researchCorpusByPrefix(registry, prefix, sourceIdentity = null) {
  const normalized = compactText(prefix).toUpperCase();
  const candidates = (Array.isArray(registry) ? registry : []).filter((corpus) =>
    corpus.codePrefixes.includes(normalized)
  );
  const identityValues = typeof sourceIdentity === "string"
    ? [sourceIdentity]
    : [
        sourceIdentity?.corpusID,
        sourceIdentity?.id,
        sourceIdentity?.codeVersion,
        sourceIdentity?.codeEdition,
        sourceIdentity?.corpusLabel
      ];
  const normalizedIdentities = new Set(
    identityValues.map((value) => compactText(value).toLocaleLowerCase("en-US")).filter(Boolean)
  );
  if (normalizedIdentities.size) {
    const exact = candidates.find((corpus) => [
      corpus.id,
      corpus.label,
      corpus.codeEdition,
      corpus.codeVersion,
      ...(corpus.aliases || [])
    ].some((value) => normalizedIdentities.has(compactText(value).toLocaleLowerCase("en-US"))));
    if (exact) return exact;
  }
  return candidates[0] || null;
}
