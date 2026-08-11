const defaultAliases = new Set([
  "nyc-2022",
  "2022 construction codes"
]);

function normalizedText(value) {
  return String(value || "").trim();
}

export function resolveResearchCodeBasis({
  projectID = null,
  projectCodeVersion = null,
  availableCodeVersion,
  availableCodeEdition,
  resolvedAt = new Date().toISOString()
}) {
  const codeVersion = normalizedText(availableCodeVersion);
  const codeEdition = normalizedText(availableCodeEdition);
  if (!codeVersion || !codeEdition) throw new Error("Research code basis requires an available corpus.");
  const configuredVersion = normalizedText(projectCodeVersion) || null;
  const normalizedConfiguredVersion = configuredVersion?.toLocaleLowerCase("en-US") || "";
  const projectVersionMatches = configuredVersion
    ? normalizedConfiguredVersion === codeVersion.toLocaleLowerCase("en-US") ||
      defaultAliases.has(normalizedConfiguredVersion)
    : null;
  const projectDefaultApplied = projectVersionMatches === true;
  const unsupportedProjectVersion = projectVersionMatches === false;
  return {
    schemaVersion: 1,
    jurisdiction: "New York City",
    codeYear: 2022,
    codeEdition,
    codeVersion,
    retrievalScope: "single-corpus",
    basisSource: projectDefaultApplied ? "project-default" : "permitext-default",
    projectID: normalizedText(projectID) || null,
    projectCodeVersion: configuredVersion,
    projectCodeVersionSupported: projectVersionMatches,
    disclosure: unsupportedProjectVersion
      ? "Code basis: 2022 NYC Construction Codes · This Project's configured version is not available in Research"
      : projectDefaultApplied
        ? "Code basis: 2022 NYC Construction Codes · Project default"
        : "Code basis: 2022 NYC Construction Codes",
    limitation: unsupportedProjectVersion
      ? `Research currently retrieves only the 2022 NYC Construction Codes corpus; it did not retrieve the Project's configured version (${configuredVersion}).`
      : null,
    resolvedAt: normalizedText(resolvedAt)
  };
}
