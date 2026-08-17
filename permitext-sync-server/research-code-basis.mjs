function normalizedText(value) {
  return String(value || "").trim();
}

function normalizedCorpus(value = {}) {
  return {
    id: normalizedText(value.id),
    label: normalizedText(value.label || value.codeEdition),
    codeEdition: normalizedText(value.codeEdition),
    codeVersion: normalizedText(value.codeVersion),
    codeYear: Number.isSafeInteger(value.codeYear) ? value.codeYear : null,
    applicabilityStatus: normalizedText(value.applicabilityStatus),
    routeReason: normalizedText(value.routeReason),
    blockedReason: normalizedText(value.blockedReason) || null,
    codePrefixes: Array.isArray(value.codePrefixes)
      ? value.codePrefixes.map((prefix) => normalizedText(prefix).toUpperCase()).filter(Boolean)
      : []
  };
}

function projectVersionMatch(projectCodeVersion, corpora) {
  const configured = normalizedText(projectCodeVersion);
  if (!configured) return null;
  const comparable = configured.toLocaleLowerCase("en-US");
  return corpora.find((corpus) => [
    corpus.id,
    corpus.label,
    corpus.codeEdition,
    corpus.codeVersion,
    ...(corpus.aliases || [])
  ].some((candidate) => normalizedText(candidate).toLocaleLowerCase("en-US") === comparable)) || null;
}

function corpusSummary(corpora) {
  return corpora.map((corpus) => corpus.label || corpus.codeEdition).filter(Boolean).join(" · ");
}

export function resolveResearchCodeBasis({
  projectID = null,
  projectCodeVersion = null,
  corpusPlan = null,
  availableCorpora = null,
  availableCodeVersion = null,
  availableCodeEdition = null,
  resolvedAt = new Date().toISOString()
}) {
  const fallbackCorpus = availableCodeVersion && availableCodeEdition
    ? [{
        id: "nyc-2022-construction-codes",
        label: "2022 NYC Construction Codes",
        codeEdition: availableCodeEdition,
        codeVersion: availableCodeVersion,
        codeYear: 2022,
        codePrefixes: ["AC", "BC", "FGC", "MC", "PC"],
        applicabilityStatus: "current-enacted-edition",
        aliases: ["nyc-2022", "2022 construction codes"]
      }]
    : [];
  const registry = Array.isArray(availableCorpora) && availableCorpora.length
    ? availableCorpora
    : fallbackCorpus;
  const selectedValues = Array.isArray(corpusPlan?.selected)
    ? corpusPlan.selected
    : registry.filter((corpus) => corpus.automaticResearchEligible !== false);
  const pinnedValues = Array.isArray(corpusPlan?.pinnedCorpora) ? corpusPlan.pinnedCorpora : [];
  const unavailableValues = Array.isArray(corpusPlan?.unavailable) ? corpusPlan.unavailable : [];
  const excludedValues = Array.isArray(corpusPlan?.excluded) ? corpusPlan.excluded : [];
  const selected = selectedValues.map(normalizedCorpus);
  const pinned = pinnedValues.map(normalizedCorpus);
  const reviewed = [...selected, ...pinned].filter((corpus, index, values) =>
    values.findIndex((candidate) => candidate.id === corpus.id) === index
  );
  const unavailable = unavailableValues.map(normalizedCorpus);
  const excluded = excludedValues.map(normalizedCorpus);
  const primary = reviewed[0] || normalizedCorpus(registry[0]);
  if (!primary.codeVersion || !primary.codeEdition) {
    throw new Error("Research code basis requires at least one registered corpus.");
  }

  const configuredVersion = normalizedText(projectCodeVersion) || null;
  const matchedProjectCorpus = projectVersionMatch(configuredVersion, registry);
  const projectVersionRecognized = configuredVersion ? Boolean(matchedProjectCorpus) : null;
  const projectVersionSupported = configuredVersion
    ? Boolean(matchedProjectCorpus?.automaticResearchEligible)
    : null;
  const projectDefaultApplied = Boolean(
    matchedProjectCorpus && reviewed.some((corpus) => corpus.id === matchedProjectCorpus.id)
  );
  const unsupportedProjectVersion = projectVersionRecognized === false;
  const unavailableProjectVersion = projectVersionRecognized === true &&
    projectVersionSupported === false &&
    !reviewed.some((corpus) => corpus.id === matchedProjectCorpus?.id);
  const searchedSummary = corpusSummary(selected);
  const pinnedSummary = corpusSummary(pinned);
  const unavailableSummary = corpusSummary(unavailable);
  const excludedRequested = excluded.filter((corpus) => corpus.routeReason !== "excluded from ordinary Research");
  const excludedRequestedSummary = corpusSummary(excludedRequested);
  const limitationParts = [];
  if (unsupportedProjectVersion) {
    limitationParts.push(
      `Research did not retrieve the Project's configured version (${configuredVersion}) because it is not an available authorized Research corpus.`
    );
  }
  if (unavailableProjectVersion && !unavailable.some((corpus) => corpus.id === matchedProjectCorpus.id)) {
    limitationParts.push(
      `Research recognized the Project's configured version (${configuredVersion}), but that corpus is not approved for ordinary Research.`
    );
  }
  for (const corpus of unavailable) {
    limitationParts.push(`${corpus.label} was not searched. ${corpus.blockedReason || "Its Research approval gate is incomplete."}`);
  }
  for (const corpus of excludedRequested) {
    limitationParts.push(`${corpus.label} was not searched. ${corpus.blockedReason || "It requires an explicit applicability path."}`);
  }
  const disclosureParts = [
    searchedSummary ? `Sources searched: ${searchedSummary}` : "No authorized corpus was searched",
    pinnedSummary ? `Explicit evidence reviewed: ${pinnedSummary}` : "",
    unavailableSummary ? `${unavailableSummary} unavailable for Research` : "",
    excludedRequestedSummary ? `${excludedRequestedSummary} excluded from ordinary Research` : "",
    projectDefaultApplied ? "Project default applied" : "",
    unsupportedProjectVersion || unavailableProjectVersion ? "Project version unavailable for Research" : ""
  ].filter(Boolean);
  return {
    schemaVersion: 2,
    registryVersion: normalizedText(corpusPlan?.registryVersion) || null,
    jurisdiction: "New York City",
    codeYear: reviewed.length === 1 ? reviewed[0].codeYear : null,
    codeEdition: reviewed.length === 1
      ? reviewed[0].codeEdition
      : reviewed.length > 1
        ? "Routed New York City enacted sources"
        : primary.codeEdition,
    codeVersion: reviewed.length === 1
      ? reviewed[0].codeVersion
      : reviewed.length > 1
        ? "multiple-authorized-corpora"
        : primary.codeVersion,
    retrievalScope: "routed-multi-corpus",
    routingMode: normalizedText(corpusPlan?.routingMode) || "registered-authorized-corpora",
    basisSource: projectDefaultApplied ? "project-default" : "permitext-router",
    projectID: normalizedText(projectID) || null,
    projectCodeVersion: configuredVersion,
    projectCodeVersionRecognized: projectVersionRecognized,
    projectCodeVersionSupported: projectVersionSupported,
    projectCodeVersionRetrieved: configuredVersion ? projectDefaultApplied : null,
    searchedCorpora: selected,
    pinnedCorpora: pinned,
    unavailableCorpora: unavailable,
    excludedCorpora: excluded,
    disclosure: disclosureParts.join(" · "),
    limitation: limitationParts.length ? limitationParts.join(" ") : null,
    resolvedAt: normalizedText(resolvedAt)
  };
}
