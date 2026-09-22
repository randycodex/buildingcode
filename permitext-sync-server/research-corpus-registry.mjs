export const researchCorpusRegistryVersion = "20260921-zoning-permission-routing-v10";

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
const zoningCue = /\b(?:does|can|would|will)\s+zoning\b|\bzoning\s+(?:allow\w*|permit\w*|prohibit\w*|restrict\w*)\b|\bZoning\s+Resolution\b|\bZR\s*(?:§\s*)?\d|\b(?:Sections?|Table|§{1,2})\s+\d{1,3}-\d{2,4}\b|\bzoning\s+(?:district|lot|map|text|use|floor\s+area|setback|bulk|applicability|transitions?|amendments?|history|rules?|requirements?|regulations?|provisions?)\b|\b(?:special\s+purpose|special)\s+district\b|\boff[-\s]street\s+parking\b|\bparking\s+(?:requirement|required|spaces?|waiver|reduction)\b|\b(?:floor\s+area\s+ratio|FAR|use\s+group|lot\s+coverage|development\s+rights?)\b|\b(?:R\d{1,2}[A-Z]?|C\d(?:-\d[A-Z]?)?|M\d(?:-\d)?)\b/i;
const projectDependentZoningCue = /\b(?:parking|floor\s+area|FAR|permitted\s+use|use\s+permitted|bulk|setback|yard|lot\s+coverage|development\s+rights?)\b/i;
const futureExistingBuildingCue = /\b(?:2026\s+)?Existing\s+Building\s+Code\b|\bEBC\b/i;
const historical2014ConstructionCue = /\b2014\s+(?:NYC\s+)?(?:(?:Construction|Building|Plumbing|Mechanical|Fuel\s+Gas|Administrative)\s+Codes?|(?:BC|AC|PC|MC|FGC))\b|\b(?:BC|AC|PC|MC|FGC)14\b|\b2014\s+code\b|\b(?:BC|AC|PC|MC|FGC|Building\s+Code|Construction\s+Codes?)\s*2014\b/i;
const current2022ConstructionCue = /\b2022\s+(?:NYC\s+)?(?:(?:Construction|Building|Plumbing|Mechanical|Fuel\s+Gas|Administrative)\s+Codes?|(?:BC|AC|PC|MC|FGC))\b|\b2022\s+code\b|\b(?:BC|AC|PC|MC|FGC|Building\s+Code|Construction\s+Codes?)\s*2022\b/i;
const unsupported2008ConstructionCue = /\b2008\s+(?:(?:NYC|New\s+York\s+City)\s+)?(?:(?:Construction|Building|Plumbing|Mechanical|Fuel\s+Gas|Administrative)\s+Codes?|code|BC|AC|PC|MC|FGC)\b|\b(?:BC|AC|PC|MC|FGC|Building\s+Code)\s*2008\b/i;
const historicalBuildingCue = /\b1968\s+(?:(?:NYC|New\s+York\s+City)\s+)?(?:Building\s+)?Code\b|\bBC68\b/i;
const historical1968FollowUpCue = /\b(?:the\s+)?1968(?:\s+(?:edition|code))?\b/i;
const historical2014FollowUpCue = /\b(?:the\s+)?2014(?:\s+(?:edition|code))?\b/i;
const current2022FollowUpCue = /\b(?:the\s+)?2022(?:\s+(?:edition|code))?\b/i;
const appendixPCrossEditionCue = /\b(?:BC\s*[- ]?)?Appendix\s+P\b/i;

export function researchZoningQuestionText(question) {
  const context = compactText(question);
  // MC 401.4 itself uses "zoning lot" to describe intake separation. That
  // contextual noun does not request a Zoning conclusion. Keep independent
  // ZR citations, district/use/bulk cues and questions about the lot itself.
  const technicalIntakeRule = /\bMC\s*(?:§\s*)?401\.4\b/i.test(context) ||
    (/\bmechanical\s+code\b/i.test(context) && /\b(?:air\s+intakes?|intake[- ]location)\b/i.test(context));
  const lotRuleQuestion = /\b(?:defin\w*|mean\w*|form\w*|merg\w*|subdiv\w*|establish\w*)\b[^.!?]*\bzoning\s+lots?\b|\bzoning\s+lots?\b[^.!?]*\b(?:defin\w*|mean\w*|form\w*|merg\w*|subdiv\w*)\b|\bzoning\s+lots?\s+(?:rules?|regulations?)\b/i.test(context);
  return technicalIntakeRule && !lotRuleQuestion
    ? context.replace(/\bzoning\s+lots?\b/gi, "lot")
    : context;
}

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
      blockedReason: "Historical text requires an explicit research request; retrieval does not establish its applicability to a project.",
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
  const followsConstructionConversation = (/\bcompar(?:e|ison)\b/i.test(currentQuestion) && constructionCue.test(currentQuestion)) ||
    constructionCue.test(conversationContext) || historicalBuildingCue.test(conversationContext) ||
    historical2014ConstructionCue.test(conversationContext);
  const editionQuestion = currentQuestion.replace(/\b(?:built|constructed|erected|completed)\s+(?:(?:in|around|before|after)\s+)?(?:1968|2014|2022)\b/gi, "");
  const shorthand2008Requested = followsConstructionConversation && /\b(?:what|how)\s+about\s+(?:the\s+)?2008\b/i.test(currentQuestion);
  const shorthand1968Requested = followsConstructionConversation &&
    historical1968FollowUpCue.test(editionQuestion);
  const shorthand2014Requested = followsConstructionConversation &&
    historical2014FollowUpCue.test(editionQuestion);
  const shorthand2022Requested = followsConstructionConversation &&
    current2022FollowUpCue.test(editionQuestion);
  const projectHasZoningContext = (Array.isArray(projectFacts) ? projectFacts : [])
    .some((fact) => /^(?:Zoning Fact|NYC Planning Fact)\s+—\s+(?:Zoning District|Zoning Map|BBL|Block|Tax Lot)/i.test(compactText(fact)));
  const projectZoningRequested = projectHasZoningContext && projectDependentZoningCue.test(currentQuestion);
  const currentHasCorpusCue = [
    constructionCue,
    fireCue,
    zoningCue,
    futureExistingBuildingCue,
    historical2014ConstructionCue,
    current2022ConstructionCue,
    historicalBuildingCue,
    unsupported2008ConstructionCue,
    appendixPCrossEditionCue
  ].some((pattern) => pattern.test(currentQuestion)) ||
    shorthand2008Requested ||
    shorthand1968Requested ||
    shorthand2014Requested ||
    shorthand2022Requested ||
    projectZoningRequested;
  const latestEditionContext = (Array.isArray(previousMessages) ? previousMessages : [])
    .filter(message => !message?.role || message.role === "user")
    .map(message => compactText(message?.question || message?.content || message?.text))
    .reverse().find(text => historicalBuildingCue.test(text) || historical2014ConstructionCue.test(text) ||
      current2022ConstructionCue.test(text) || unsupported2008ConstructionCue.test(text) || futureExistingBuildingCue.test(text) ||
      /\b(?:what|how)\s+about\s+(?:the\s+)?(?:1968|2008|2014|2022)\b/i.test(text));
  const currentHasEditionCue = historicalBuildingCue.test(currentQuestion) || historical2014ConstructionCue.test(currentQuestion) ||
    current2022ConstructionCue.test(currentQuestion) || unsupported2008ConstructionCue.test(currentQuestion) ||
    futureExistingBuildingCue.test(currentQuestion) || shorthand1968Requested || shorthand2014Requested || shorthand2022Requested || shorthand2008Requested;
  // A bare 27-xxx citation in a 1968 discussion is not a switch to Zoning.
  // An explicit ZR/Zoning request still changes the domain.
  const domainQuestion = latestEditionContext && (historicalBuildingCue.test(latestEditionContext) || historical1968FollowUpCue.test(latestEditionContext)) &&
    !/\b(?:ZR|Zoning)\b/i.test(currentQuestion)
    ? currentQuestion.replace(/\b27-\d{3,4}\b/g, "") : currentQuestion;
  const changesDomain = fireCue.test(currentQuestion) || zoningCue.test(domainQuestion) || appendixPCrossEditionCue.test(currentQuestion) || projectZoningRequested;
  const inheritsEditionContext = Boolean(latestEditionContext && !currentHasEditionCue && !changesDomain);
  const context = currentHasCorpusCue
    ? [currentQuestion, inheritsEditionContext ? latestEditionContext : ""].filter(Boolean).join("\n")
    : [currentQuestion, latestEditionContext || conversationContext].filter(Boolean).join("\n");
  const unsupported2008Requested = unsupported2008ConstructionCue.test(context) ||
    shorthand2008Requested ||
    (inheritsEditionContext && latestEditionContext && /\b2008\b/.test(latestEditionContext));
  const futureRequested = futureExistingBuildingCue.test(context);
  const historical2014Requested = historical2014ConstructionCue.test(context) || shorthand2014Requested ||
    (inheritsEditionContext && latestEditionContext && historical2014FollowUpCue.test(latestEditionContext));
  // Naming an available historical edition opts into its text for research.
  // This selects evidence, not the code legally applicable to a project.
  const historicalRequested = historicalBuildingCue.test(context) || shorthand1968Requested ||
    (inheritsEditionContext && latestEditionContext && historical1968FollowUpCue.test(latestEditionContext));
  const priorCodeTechnicalApplicability = historicalRequested &&
    /\b(?:option(?:al)?|elect(?:ion|ed|ing)?|prior[- ]code|alteration)\b/i.test(context) &&
    /\b(?:plumbing|fuel[- ]gas|mechanical)\b/i.test(context);
  const appendixPCrossEditionRequested =
    appendixPCrossEditionCue.test(context) && !/\b(?:2014|2022)\b/.test(context);
  const buildingCodeOnlyScope =
    /\bbased only on (?:the )?(?:selected )?Building Code passages\b/i.test(currentQuestion);
  // An unqualified BC/PC/etc. citation follows the explicitly named 2014
  // edition; it is not an independent request to also retrieve 2022. A named
  // 2022 edition still permits intentional cross-edition comparisons.
  const inherited2022Requested = inheritsEditionContext && latestEditionContext && current2022FollowUpCue.test(latestEditionContext);
  const explicitCurrentConstructionCue = shorthand2022Requested || inherited2022Requested || current2022ConstructionCue.test(context) ||
    (!historical2014Requested && !historicalRequested && !futureRequested && /\b(?:AC|BC|FGC|MC|PC)\s*(?:§\s*)?[A-Z]?\d/i.test(context.replace(/\bBC68\b/gi, "")));
  const constructionRequested = (constructionCue.test(context) || current2022ConstructionCue.test(context) || shorthand2022Requested || inherited2022Requested) &&
    (!futureRequested && !historical2014Requested && !historicalRequested || explicitCurrentConstructionCue) &&
    (!unsupported2008Requested || current2022ConstructionCue.test(context));
  const fireRequested = fireCue.test(context);
  const zoningRequested = !buildingCodeOnlyScope && (zoningCue.test(researchZoningQuestionText(historicalRequested ? context.replace(/\b27-\d{3,4}\b/g, "") : context)) || projectZoningRequested);
  const requestedIDs = new Map();
  if (unsupported2008Requested) requestedIDs.set("nyc-2008-construction-codes", "explicit unavailable 2008 code edition");
  if (constructionRequested) requestedIDs.set("nyc-2022-construction-codes", "construction-code cue");
  if (priorCodeTechnicalApplicability) {
    requestedIDs.set("nyc-2022-construction-codes", "current rules governing the scope of a prior-code election for technical work");
  }
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
    if (corpus.automaticResearchEligible || (corpus.id === "nyc-1968-building-code" && historicalRequested) ||
        (corpus.id === "nyc-existing-building-code-2027" && futureRequested)) {
      selected.push({ ...routeRecord(corpus, reason), blockedReason: null });
    } else if (corpus.optInRequired) {
      excluded.push(routeRecord(corpus, reason));
    } else {
      unavailable.push(routeRecord(corpus, reason));
    }
  }
  if (unsupported2008Requested) unavailable.push({
    id: "nyc-2008-construction-codes", label: "2008 NYC Construction Codes", codeEdition: "2008 NYC Construction Codes", codeYear: 2008,
    codeVersion: null, codePrefixes: [], applicabilityStatus: "unavailable-edition", automaticResearchEligible: false,
    routeReason: "explicit unavailable 2008 code edition", blockedReason: "The 2008 Construction Codes are not available in the authorized Research library."
  });
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
