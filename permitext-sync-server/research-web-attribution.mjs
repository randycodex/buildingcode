import { extractResearchOfficialDocumentReferences } from "./research-source-policy.mjs";

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function claimText(claim) {
  return compactText(typeof claim === "string" ? claim : claim?.text);
}

function claimID(claim) {
  return compactText(typeof claim === "object" ? claim?.id : "");
}

function namedDocumentReferences(...values) {
  return new Set(values.flatMap((value) => extractResearchOfficialDocumentReferences(value)));
}

const insignificantWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in",
  "is", "it", "its", "may", "must", "not", "of", "on", "only", "or", "shall", "should",
  "that", "the", "their", "this", "to", "under", "was", "when", "where", "with"
]);

function normalizedToken(value) {
  return value
    .toLowerCase()
    .replace(/(?:ies)$/i, "y")
    .replace(/(?:ing|ed|es)$/i, "")
    .replace(/s$/i, "");
}

function materialTokens(value) {
  return new Set((compactText(value).toLowerCase().match(/[a-z0-9]+/g) || [])
    .map(normalizedToken)
    .filter((token) => token.length >= 3 && !insignificantWords.has(token)));
}

const webGuidanceClaimPattern =
  /\b(?:(?:NYC\s+)?(?:DOB|Department of Buildings|Buildings?)\s+)?(?:Buildings?\s+)?(?:Bulletin|guidance)\b|\bBB\s*(?:19|20)\d{2}\s*[-\u2013\u2014]\s*\d{3}\b/i;
const unavailableDocumentPattern =
  /\b(?:could not|unable to|not (?:retrieved|available|used|reviewed|opened)|unavailable|no source-specific|no attributable)\b/i;

function sourceReferences(source) {
  return namedDocumentReferences(
    source?.title,
    ...(Array.isArray(source?.attributedClaims) ? source.attributedClaims.map(claimText) : [])
  );
}

function webDerivedSupportedPointIndexes(answer, sources, evidence) {
  if (!sources.size) return [];
  const enactedTokens = materialTokens((Array.isArray(evidence) ? evidence : [])
    .flatMap((item) => [item?.title, item?.text])
    .filter(Boolean)
    .join(" "));
  const distinctiveWebTokenSets = [...sources.values()].flatMap((source) =>
    (Array.isArray(source?.attributedClaims) ? source.attributedClaims : []).map((claim) =>
      new Set([...materialTokens(claimText(claim))].filter((token) => !enactedTokens.has(token)))
    )
  ).filter((tokens) => tokens.size > 0);

  return (Array.isArray(answer?.supportedPoints) ? answer.supportedPoints : [])
    .map((point, index) => ({
      index,
      text: compactText([point?.heading, point?.explanation].filter(Boolean).join(" "))
    }))
    .filter(({ text }) => {
      if (webGuidanceClaimPattern.test(text)) return true;
      const pointTokens = materialTokens(text);
      return distinctiveWebTokenSets.some((webTokens) =>
        [...webTokens].filter((token) => pointTokens.has(token)).length >= 2
      );
    })
    .map(({ index }) => index);
}

export function evaluateResearchWebAttribution({
  question = "",
  answer = {},
  supportingSources = [],
  evidence = [],
  webSupport = null
} = {}) {
  const availableSources = Array.isArray(webSupport?.sources)
    ? webSupport.sources
    : supportingSources;
  const sources = new Map((Array.isArray(availableSources) ? availableSources : [])
    .map((source) => [compactText(source?.id), source])
    .filter(([sourceID]) => sourceID));
  const questionReferences = namedDocumentReferences(question);
  const sourceReferencesByID = new Map(
    [...sources].map(([sourceID, source]) => [sourceID, sourceReferences(source)])
  );

  const sourceUses = Array.isArray(answer?.supportingSourceUses)
    ? answer.supportingSourceUses
    : [];
  const usedBindings = sourceUses.map((use) => ({
    sourceID: compactText(use?.sourceID),
    claimID: compactText(use?.claimID)
  }));
  const validUsedBindings = [];
  const invalidSourceUseBindings = [];
  for (const binding of usedBindings) {
    const source = sources.get(binding.sourceID);
    const claim = (Array.isArray(source?.attributedClaims) ? source.attributedClaims : [])
      .find((candidate) => claimID(candidate) === binding.claimID);
    if (!source || !binding.claimID || !claim) invalidSourceUseBindings.push(binding);
    else validUsedBindings.push(binding);
  }

  const requiredDocumentReferences = [...questionReferences].filter((reference) =>
    [...sourceReferencesByID.values()].some((references) => references.has(reference))
  );
  const missingRequiredDocumentReferences = requiredDocumentReferences.filter((reference) =>
    !validUsedBindings.some(({ sourceID }) => sourceReferencesByID.get(sourceID)?.has(reference))
  );
  const requiredSourceIDs = [...sources]
    .filter(([sourceID]) =>
      requiredDocumentReferences.some((reference) => sourceReferencesByID.get(sourceID)?.has(reference))
    )
    .map(([sourceID]) => sourceID);
  const missingRequiredSourceIDs = requiredSourceIDs.filter((sourceID) =>
    missingRequiredDocumentReferences.some((reference) => sourceReferencesByID.get(sourceID)?.has(reference))
  );

  const unavailableRequestedDocumentReferences = [...new Set([
    ...(Array.isArray(webSupport?.unattributedRequestedDocuments)
      ? webSupport.unattributedRequestedDocuments
      : []),
    ...[...questionReferences].filter((reference) =>
      webSupport?.searched === true &&
      ![...sourceReferencesByID.values()].some((references) => references.has(reference))
    )
  ].map(compactText).filter(Boolean))];
  const limitationText = (Array.isArray(answer?.evidenceLimitations)
    ? answer.evidenceLimitations
    : []).map(compactText);
  const undisclosedUnavailableDocumentReferences = unavailableRequestedDocumentReferences.filter((reference) =>
    !limitationText.some((limitation) =>
      extractResearchOfficialDocumentReferences(limitation).includes(reference) &&
      unavailableDocumentPattern.test(limitation)
    )
  );
  const requiredGenericLimitation =
    webSupport?.searched === true &&
    sources.size === 0 &&
    compactText(webSupport?.limitation);
  const undisclosedGenericLimitation = Boolean(
    requiredGenericLimitation &&
    !limitationText.some((limitation) =>
      limitation === requiredGenericLimitation ||
      (
        unavailableDocumentPattern.test(limitation) &&
        /(?:official|web|guidance|supporting source)/i.test(limitation)
      )
    )
  );

  const guidanceSupportedPointIndexes = webDerivedSupportedPointIndexes(answer, sources, evidence);

  return {
    pass:
      missingRequiredDocumentReferences.length === 0 &&
      undisclosedUnavailableDocumentReferences.length === 0 &&
      !undisclosedGenericLimitation &&
      guidanceSupportedPointIndexes.length === 0 &&
      invalidSourceUseBindings.length === 0,
    requiredSourceIDs,
    requiredDocumentReferences,
    missingRequiredDocumentReferences,
    usedSourceIDs: [...new Set(validUsedBindings.map((binding) => binding.sourceID))],
    usedClaimIDs: [...new Set(validUsedBindings.map((binding) => binding.claimID))],
    missingRequiredSourceIDs,
    unavailableRequestedDocumentReferences,
    undisclosedUnavailableDocumentReferences,
    requiredGenericLimitation,
    undisclosedGenericLimitation,
    guidanceSupportedPointIndexes,
    invalidSourceUseBindings
  };
}

export function researchWebAttributionRevisionIssues(result) {
  if (!result || result.pass) return [];
  const issues = [];
  if (result.guidanceSupportedPointIndexes?.length) {
    issues.push({
      type: "wrong_attribution",
      detail: "Move every web-derived statement out of supportedPoints, including paraphrases that omit the words bulletin, guidance, or BB. supportedPoints and enacted citations may state only rules established by assembled enacted text. Select each noncontrolling web statement in supportingSourceUses using its exact WEB_SOURCE_ID and WEB_CLAIM_ID pair, and label it as guidance in answerText."
    });
  }
  if (result.missingRequiredSourceIDs?.length) {
    issues.push({
      type: "missed_material_conclusion",
      detail: `The question expressly requested retrieved official document ${result.missingRequiredDocumentReferences.join(", ")}. State its material source-supported clarification as noncontrolling guidance and select one matching exact WEB_SOURCE_ID and WEB_CLAIM_ID pair from: ${result.missingRequiredSourceIDs.join(", ")}. Do not bind that clarification to an enacted-code supportedPoint.`
    });
  }
  if (result.undisclosedUnavailableDocumentReferences?.length) {
    issues.push({
      type: "false_evidence_limitation",
      detail: `Add a visible evidenceLimitations item stating that Permitext could not retrieve a source-specific attributable passage for ${result.undisclosedUnavailableDocumentReferences.join(", ")} and did not use that document. Do not infer its contents.`
    });
  }
  if (result.undisclosedGenericLimitation) {
    issues.push({
      type: "false_evidence_limitation",
      detail: `Add a visible evidenceLimitations item stating: ${result.requiredGenericLimitation} Do not infer or use unavailable web guidance.`
    });
  }
  if (result.invalidSourceUseBindings?.length) {
    issues.push({
      type: "incorrect_citation",
      detail: "Remove every supportingSourceUse that is not an exact supplied WEB_SOURCE_ID and WEB_CLAIM_ID pair. The claim text is server-derived from that immutable binding and must not be invented or reassigned."
    });
  }
  return issues;
}
