export const researchCorpusRegistryVersion = "20260817-routed-authorized-corpora-v1";

const constructionCodeVersion =
  "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
const enactedAdministrativeCodeVersion =
  "CodeContent/authored/new-york-city/2026-enacted-administrative-code/bundle.json#1";
const zoningCodeVersion =
  "CodeContent/authored/new-york-city/2026-zoning-resolution/bundle.json#1";

const constructionCue = /\b(?:AC|BC|FGC|MC|PC)\s*(?:§\s*)?[A-Z]?\d|\b(?:building|construction|plumbing|mechanical|fuel\s+gas)\s+code\b|\b(?:means\s+of\s+egress|occupancy|travel\s+distance|fixture\s+count|construction\s+type)\b/i;
const fireCue = /\b(?:NYC\s+)?Fire\s+Code\b|\bFC\s*(?:§\s*)?[A-Z]?\d|\bFDNY\b|\bFire\s+Department\b|\b(?:hot\s+work|operational|hazardous\s+materials?)\s+permit\b/i;
const zoningCue = /\bZoning\s+Resolution\b|\bZR\s*(?:§\s*)?\d|\bzoning\s+(?:district|lot|map|text|use|floor\s+area|setback|bulk|applicability)\b|\b(?:special\s+purpose|special)\s+district\b/i;
const futureExistingBuildingCue = /\b(?:2026\s+)?Existing\s+Building\s+Code\b|\bEBC\s*(?:§\s*)?[A-Z]?\d/i;
const historicalBuildingCue = /\b(?:1968|prior|historical)\s+(?:NYC\s+)?Building\s+Code\b|\bBC68\b/i;

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function recentUserContext(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => !message?.role || message.role === "user")
    .slice(-2)
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
      id: "nyc-zoning-resolution",
      label: "NYC Zoning Resolution",
      codeEdition: "NYC Zoning Resolution — text through 2026-07-16",
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
  registry
} = {}) {
  const availableRegistry = Array.isArray(registry)
    ? registry
    : createResearchCorpusRegistry();
  const currentQuestion = compactText(question);
  if (!currentQuestion) throw new Error("Research corpus routing requires a question.");
  const currentHasCorpusCue = [
    constructionCue,
    fireCue,
    zoningCue,
    futureExistingBuildingCue,
    historicalBuildingCue
  ].some((pattern) => pattern.test(currentQuestion));
  const context = currentHasCorpusCue
    ? currentQuestion
    : [currentQuestion, recentUserContext(previousMessages)].filter(Boolean).join("\n");
  const futureRequested = futureExistingBuildingCue.test(context);
  const historicalRequested = historicalBuildingCue.test(context);
  const explicitCurrentConstructionCue = /\b(?:AC|BC|FGC|MC|PC)\s*(?:§\s*)?[A-Z]?\d|\b2022\s+(?:NYC\s+)?(?:Building|Construction|Plumbing|Mechanical|Fuel\s+Gas)\s+Code\b/i.test(context);
  const constructionRequested = constructionCue.test(context) &&
    (!futureRequested && !historicalRequested || explicitCurrentConstructionCue);
  const fireRequested = fireCue.test(context);
  const zoningRequested = zoningCue.test(context);
  const requestedIDs = new Map();
  if (constructionRequested) requestedIDs.set("nyc-2022-construction-codes", "construction-code cue");
  if (fireRequested) requestedIDs.set("nyc-2022-fire-code", "Fire Code or FDNY cue");
  if (zoningRequested) requestedIDs.set("nyc-zoning-resolution", "zoning cue");
  if (futureRequested) requestedIDs.set("nyc-existing-building-code-2027", "future-effective EBC cue");
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

export function researchCorpusByPrefix(registry, prefix) {
  const normalized = compactText(prefix).toUpperCase();
  return (Array.isArray(registry) ? registry : []).find((corpus) =>
    corpus.codePrefixes.includes(normalized)
  ) || null;
}
