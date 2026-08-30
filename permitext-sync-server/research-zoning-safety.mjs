export const zoningResearchSafetyVersion =
  "20260830-zoning-material-completeness-v2";

const zoningCorpusID = "nyc-zoning-resolution";

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function unique(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(compactText).filter(Boolean)));
}

function zoningEvidence(evidence) {
  return (Array.isArray(evidence) ? evidence : []).filter((source) =>
    compactText(source?.corpusID) === zoningCorpusID ||
    compactText(source?.codePrefix).toUpperCase() === "ZR"
  );
}

function answerText(answer) {
  return compactText([
    answer?.answerText,
    answer?.conclusion,
    answer?.explanation,
    ...(Array.isArray(answer?.supportedPoints)
      ? answer.supportedPoints.flatMap((point) => [point?.heading, point?.explanation])
      : []),
    ...(Array.isArray(answer?.evidenceLimitations) ? answer.evidenceLimitations : [])
  ].filter(Boolean).join(" "));
}

function materialFactText({ question, projectFacts, conversationFactContext } = {}) {
  return compactText([
    question,
    ...(Array.isArray(projectFacts) ? projectFacts : []),
    ...(Array.isArray(conversationFactContext?.established) ? conversationFactContext.established : []),
    ...(Array.isArray(conversationFactContext?.hypothetical) ? conversationFactContext.hypothetical : []),
    ...(Array.isArray(conversationFactContext?.unknown) ? conversationFactContext.unknown : [])
  ].filter(Boolean).join(" "));
}

function negativeLocationStatement(value) {
  return /\b(?:address|BBL|block(?: and |\/)lot|tax lot|mapped zoning district|zoning map|special[- ]district status|subdistrict|Appendix [A-Z] (?:map|subarea))\b[^.]{0,120}\b(?:unknown|not (?:provided|established|identified|verified)|missing|unresolved)\b/i.test(value) ||
    /\b(?:unknown|not (?:provided|established|identified|verified)|missing|unresolved)\b[^.]{0,120}\b(?:address|BBL|block(?: and |\/)lot|tax lot|mapped zoning district|zoning map|special[- ]district status|subdistrict|Appendix [A-Z] (?:map|subarea))\b/i.test(value);
}

function hasConcreteMappedLocation(value) {
  if (negativeLocationStatement(value)) return false;
  return /\bBBL\s*[:#-]?\s*\d{1,10}[-\s]\d{1,5}[-\s]\d{1,5}\b/i.test(value) ||
    /\b(?:Zoning District|mapped district)\s*[:—-]\s*(?:R\d{1,2}[A-Z]?|C\d(?:-\d[A-Z]?)?|M\d(?:-\d)?)(?:\b|\s)/i.test(value) ||
    /\b(?:R\d{1,2}[A-Z]?|C\d(?:-\d[A-Z]?)?|M\d(?:-\d)?)\b/i.test(value) ||
    /\b(?:within|in)\s+(?:the\s+)?(?:Inner|Outer)\s+Transit\s+Zone\b/i.test(value) ||
    /\b(?:within|in)\s+(?:the\s+)?(?:[A-Z][A-Za-z' -]+\s+)?(?:Special\s+[A-Z][A-Za-z' -]+\s+District|[A-Z][A-Za-z' -]+\s+Subdistrict)\b/i.test(value);
}

function citedSourceIDs(answer) {
  return unique((Array.isArray(answer?.citations) ? answer.citations : [])
    .flatMap((citation) => citation?.sourceIDs));
}

function categoricalProjectConclusion(value) {
  return /\b(?:is|are|will be|can be|may be)\s+(?:permitted|allowed|compliant|as[- ]of[- ]right|within|outside|subject to|required)\b/i.test(value) ||
    /\b(?:the (?:site|property|lot|project|development)|this (?:site|property|lot|project|development))\b[^.]{0,140}\b(?:falls|lies|qualifies|complies|satisfies|is permitted)\b/i.test(value);
}

function statesLocationBoundary(value) {
  return /\b(?:cannot|could not|does not|not enough|insufficient|unable to)\b[^.]{0,180}\b(?:determine|establish|conclude|confirm|place|locate|map|apply)\b/i.test(value) ||
    /\b(?:site-specific|property-specific|parcel-specific)\b[^.]{0,140}\b(?:cannot|not|unknown|unresolved|requires?)\b/i.test(value);
}

function exactSpecialDistrictLabels(value) {
  return unique(String(value || "").match(
    /\b(?:Special\s+(?:[A-Z][A-Za-z'’-]*\s+){1,6}District|(?:[A-Z][A-Za-z'’-]*\s+){1,6}Subdistrict)\b/g
  ) || []);
}

function riskProfile({ question, evidence, projectFacts = [], conversationFactContext = {} } = {}) {
  const sources = zoningEvidence(evidence);
  if (!sources.length) {
    return {
      applies: false,
      categories: [],
      zoningSourceIDs: [],
      missingMappedLocation: false,
      specialDistrictLabels: []
    };
  }
  const questionText = compactText(question);
  const facts = materialFactText({ question, projectFacts, conversationFactContext });
  const sourceText = compactText(sources.map((source) => [
    source?.title,
    source?.sectionNumber,
    source?.text,
    source?.richSourceCanonicalReference
  ].filter(Boolean).join(" ")).join(" "));
  const propertySpecific = /\b(?:specific property|property|parcel|site|zoning lot|tax lot|this lot|this project|proposed|proposal|development|building)\b/i.test(questionText);
  const mappedApplicability =
    /\b(?:map|mapped|Appendix [A-Z]|designated area|subarea|zoning district|special[- ]district|subdistrict|transit zone)\b/i.test(questionText) ||
    /\b(?:map|Appendix [A-Z]|designated area|subarea|special[- ]district|subdistrict|transit zone)\b/i.test(sourceText);
  const missingMappedLocation = propertySpecific && mappedApplicability && !hasConcreteMappedLocation(facts);
  const specialDistrictLabels = exactSpecialDistrictLabels(questionText);
  const table = /\btable\b/i.test(questionText) || sources.some((source) =>
    source?.origin === "user_pinned" &&
    Array.isArray(source?.richSourceGrids) && source.richSourceGrids.length > 0
  );
  const tableSymbols = table && /\b(?:symbol|symbols|footnote|footnotes|asterisk|dagger|blank cell)\b/i.test(questionText);
  const arithmetic = /\b(?:how many|calculate|calculation|fit the (?:basic )?maximum|maximum permitted|square feet|FAR|floor area ratio|lot coverage|parking spaces?)\b/i.test(questionText) &&
    /\d/.test(questionText);
  const definition = /\b(?:definition|defined|means|zoning lot|floor area|cellar)\b/i.test(questionText) &&
    sources.some((source) =>
      /\b(?:definition|defined terms?)\b/i.test(compactText(`${source?.title} ${source?.text}`)) ||
      source?.evidencePriority?.primaryFunction === "definition" ||
      (Array.isArray(source?.evidencePriority?.functions) &&
        source.evidencePriority.functions.includes("definition"))
    );
  const amendment = /\b(?:amendment|amended|history|historical text|text in force|as[- ]of)\b/i.test(`${questionText} ${sourceText}`);
  const effectiveDate = /\b(?:effective date|effective on|issued after|issued before|transition|continuation|grandfather|vested|certificate of occupancy)\b/i.test(`${questionText} ${sourceText}`) ||
    (amendment && /\b(?:particular|specific) date\b/i.test(questionText));
  const historicalSubstantiveText = effectiveDate &&
    /\b(?:old|prior|previous|pre[- ](?:amendment|city of yes|december))\b[^.]{0,100}\b(?:zoning|rules?|text|provisions?)\b/i.test(questionText);
  const map = /\b(?:map|mapped|Appendix [A-Z]|designated area|subarea)\b/i.test(`${questionText} ${sourceText}`) ||
    sources.some((source) => Array.isArray(source?.visualSources) && source.visualSources.length > 0);
  const categories = [
    "citation-boundary",
    "stable-passage",
    ...(missingMappedLocation ? ["missing-location"] : []),
    ...(mappedApplicability ? ["mapped-applicability"] : []),
    ...(map ? ["map"] : []),
    ...(specialDistrictLabels.length ? ["special-district"] : []),
    ...(table ? ["table"] : []),
    ...(tableSymbols ? ["table-symbols"] : []),
    ...(arithmetic ? ["arithmetic"] : []),
    ...(definition ? ["definition"] : []),
    ...(amendment ? ["amendment"] : []),
    ...(effectiveDate ? ["effective-date"] : []),
    ...(historicalSubstantiveText ? ["historical-substantive-text"] : [])
  ];
  return {
    applies: true,
    categories: unique(categories),
    zoningSourceIDs: unique(sources.map((source) => source?.sourceID)),
    missingMappedLocation,
    specialDistrictLabels,
    tableSourceIDs: table ? unique(sources.filter((source) =>
      Array.isArray(source?.richSourceGrids) && source.richSourceGrids.length > 0
    ).map((source) => source?.sourceID)) : [],
    questionDates: unique(questionText.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/g) || [])
  };
}

export function zoningResearchSafetyPromptContext(options = {}) {
  const profile = riskProfile(options);
  if (!profile.applies) return "";
  return [
    "ZONING RESEARCH SAFETY CONTRACT — SERVER GENERATED",
    `VERSION: ${zoningResearchSafetyVersion}`,
    `ACTIVE_CATEGORIES: ${JSON.stringify(profile.categories)}`,
    "Bind every Zoning conclusion to the exact supplied PASSAGE_ID and preserve that passage's corpus, edition, applicability status, and text hash.",
    "Do not infer a parcel's mapped district, special district, subdistrict, Appendix area, transit-zone status, or map position from unselected evidence or general geography.",
    profile.missingMappedLocation
      ? "The supplied facts do not establish the mapped location needed for a parcel-specific conclusion. State that boundary, separately request a usable property identifier such as the address or BBL and the controlling official map or mapped-district evidence, and keep the result conditional."
      : "Use only mapped-location facts expressly supplied for this question; do not broaden them.",
    profile.specialDistrictLabels.length
      ? `Preserve the exact special-purpose scope named in the evidence: ${profile.specialDistrictLabels.join("; ")}.`
      : "",
    profile.categories.includes("table")
      ? "Read structured table cells together with their headings, symbols, notes, and footnotes. Do not reconstruct a row from prose or silently ignore a conditional category."
      : "",
    profile.categories.includes("arithmetic")
      ? "Show each distinct decision-relevant calculation expressly needed to answer the question, including the proposed ratio or existing-condition comparison when it changes the result. Include inputs, units, operation, and result, but do not repeat an equivalent proof or add an unused margin merely to show more arithmetic. Distinguish every numerical comparison from overall zoning entitlement or compliance."
      : "",
    profile.categories.includes("definition")
      ? "When applying a Zoning definition, preserve every supplied special measurement clause that could change the classification and every expressly limited downstream consequence that the question implicates. Do not generalize a consequence listed only for parking, loading, or another named calculation into the definition for all purposes."
      : "",
    profile.categories.includes("amendment")
      ? "Distinguish current amendment metadata from the enacted text actually in force on a requested historical date; metadata alone cannot reconstruct historical text."
      : "",
    profile.categories.includes("effective-date")
      ? "Apply an effective-date or transition provision only after tying its exact date and triggering project fact to the cited passage. Analyze each materially different date-specific route separately and identify the facts needed for any route that could change the conclusion."
      : "",
    profile.categories.includes("historical-substantive-text")
      ? "A current transition provision may preserve prior rules without reproducing their substantive requirements. Distinguish the current transition text from the verified dated enacted or official archived substantive text needed to determine exactly what prior rules or rights are preserved."
      : "",
    "Apply facts expressly stated in the scenario to the governing general rule. Do not weaken that supported result by treating the unasserted facts of a separate exception as missing; identify the exception as unestablished unless the question asks whether that exception applies."
  ].filter(Boolean).join("\n");
}

export function zoningResearchSafetyInstruction(evidence = []) {
  if (!zoningEvidence(evidence).length) return "";
  return "For Zoning Resolution evidence, enforce the server-generated ZONING RESEARCH SAFETY CONTRACT: exact passage binding, no inferred mapped location, material definition clauses, preserved special-district scope, structured-table fidelity, decision-relevant arithmetic without duplicate proof, and a clear distinction between current transition or amendment text and historical substantive law.";
}

export function evaluateZoningResearchSafety({
  question,
  evidence,
  answer,
  projectFacts = [],
  conversationFactContext = {}
} = {}) {
  const profile = riskProfile({ question, evidence, projectFacts, conversationFactContext });
  if (!profile.applies) {
    return {
      schemaVersion: 1,
      safetyVersion: zoningResearchSafetyVersion,
      pass: true,
      applies: false,
      categories: [],
      issues: []
    };
  }
  const narrative = answerText(answer);
  const citations = citedSourceIDs(answer);
  const citationSet = new Set(citations);
  const missingFacts = compactText(Array.isArray(answer?.missingFacts) ? answer.missingFacts.join(" ") : "");
  const issues = [];
  if (categoricalProjectConclusion(narrative) && !citations.some((sourceID) => profile.zoningSourceIDs.includes(sourceID))) {
    issues.push({
      type: "zoning_unbound_conclusion",
      detail: "Bind every material Zoning conclusion to an exact supplied Zoning PASSAGE_ID; do not present an uncited parcel, use, bulk, parking, or applicability conclusion."
    });
  }
  if (
    profile.missingMappedLocation &&
    categoricalProjectConclusion(narrative) &&
    (!statesLocationBoundary(narrative) || !/\b(?:address|BBL|block|lot|mapped|zoning district|map|special district|subdistrict|Appendix)\b/i.test(missingFacts))
  ) {
    issues.push({
      type: "zoning_missing_mapped_location",
      detail: "Do not make a parcel-specific Zoning conclusion while mapped applicability is unresolved. State the boundary, keep the conclusion conditional, and name the missing address/BBL, mapped district, map area, or special-district fact in missingFacts."
    });
  }
  if (
    profile.missingMappedLocation &&
    !/\b(?:address|BBL|block(?: and |\/)?\s*lot|property (?:identifier|location)|parcel (?:identifier|location))\b/i.test(missingFacts)
  ) {
    issues.push({
      type: "zoning_missing_location_identifier",
      detail: "Mapped applicability cannot be resolved from a map name alone. Separately request a usable property identifier such as the address or BBL/block and lot, as well as the controlling official map or mapped-district evidence."
    });
  }
  if (
    profile.categories.includes("map") &&
    profile.missingMappedLocation &&
    /\b(?:the (?:site|property|lot)|this (?:site|property|lot))\b[^.]{0,160}\b(?:is within|is outside|falls within|lies within|is shown in)\b/i.test(narrative)
  ) {
    issues.push({
      type: "zoning_map_inference",
      detail: "A selected Zoning map or appendix may establish designated boundaries, but it cannot place the subject parcel without an identified authoritative map and mapped location fact."
    });
  }
  const missingSpecialDistrictLabels = profile.specialDistrictLabels.filter((label) =>
    !narrative.toLocaleLowerCase("en-US").includes(label.toLocaleLowerCase("en-US"))
  );
  if (missingSpecialDistrictLabels.length) {
    issues.push({
      type: "zoning_special_district_scope",
      detail: `Preserve the exact special-purpose scope in the answer: ${missingSpecialDistrictLabels.join("; ")}. Do not generalize a district or subdistrict rule to the citywide Zoning Resolution.`
    });
  }
  if (profile.tableSourceIDs?.length && !profile.tableSourceIDs.some((sourceID) => citationSet.has(sourceID))) {
    issues.push({
      type: "zoning_table_binding",
      detail: "Bind the table-derived result to the exact structured-table PASSAGE_ID. Do not present a table row, category, symbol, or numeric limit as uncited prose."
    });
  }
  if (profile.categories.includes("table-symbols") && !/\b(?:symbol|footnote|asterisk|dagger|blank cell|not permitted|permitted)\b/i.test(narrative)) {
    issues.push({
      type: "zoning_table_symbol_omission",
      detail: "The question asks about table symbols. Explain their supplied meaning and any associated note or footnote instead of summarizing only the row labels."
    });
  }
  if (
    profile.categories.includes("arithmetic") &&
    !statesLocationBoundary(narrative) &&
    !(/\d/.test(narrative) && /\b(?:×|x|multipl|divid|ratio|FAR|square feet|percent|%|spaces?|units?|equals?|result|maximum)\b/i.test(narrative))
  ) {
    issues.push({
      type: "zoning_arithmetic_omission",
      detail: "Show the material numeric inputs, units, operation, and result for the Zoning calculation, then keep the numerical result separate from overall entitlement or compliance."
    });
  }
  if (
    profile.categories.includes("amendment") &&
    /\b(?:text in force|reconstruct|particular date|historical)\b/i.test(compactText(question)) &&
    !/\b(?:cannot|does not|not enough|insufficient|must|need to|requires?)\b[^.]{0,180}\b(?:historical|archived|enacted text|text in force|effective date|amendment)\b/i.test(narrative)
  ) {
    issues.push({
      type: "zoning_amendment_history_boundary",
      detail: "Current amendment-history metadata does not by itself reconstruct the Zoning text in force on a historical date. State that limitation and identify the dated enacted or archived text that must be verified."
    });
  }
  const missingQuestionDates = profile.categories.includes("effective-date")
    ? profile.questionDates.filter((date) => !narrative.includes(date))
    : [];
  if (missingQuestionDates.length) {
    issues.push({
      type: "zoning_effective_date_omission",
      detail: `Tie the effective-date or transition analysis to the exact project date(s) stated in the question: ${missingQuestionDates.join("; ")}.`
    });
  }
  const historicalTextVerification =
    /\b(?:verify|review|retrieve|obtain|need|require|must)\b[^.]{0,220}\b(?:historical|archived|prior|pre[- ](?:amendment|city of yes|december))\b[^.]{0,120}\b(?:zoning|text|rules?|provisions?)\b/i.test(narrative) ||
    /\b(?:historical|archived|prior|pre[- ](?:amendment|city of yes|december))\b[^.]{0,120}\b(?:zoning|text|rules?|provisions?)\b[^.]{0,180}\b(?:verify|review|retrieve|obtain|need|required?|must)\b/i.test(narrative);
  if (
    profile.categories.includes("historical-substantive-text") &&
    !historicalTextVerification
  ) {
    issues.push({
      type: "zoning_historical_substantive_text",
      detail: "A current transition provision does not reproduce the prior substantive Zoning rules it may preserve. Identify the verified dated enacted or official archived substantive text needed to determine the preserved rights."
    });
  }
  return {
    schemaVersion: 1,
    safetyVersion: zoningResearchSafetyVersion,
    pass: issues.length === 0,
    applies: true,
    categories: profile.categories,
    zoningSourceIDs: profile.zoningSourceIDs,
    issues
  };
}

export function zoningResearchSafetyRevisionIssues(result) {
  return Array.isArray(result?.issues) ? result.issues : [];
}
