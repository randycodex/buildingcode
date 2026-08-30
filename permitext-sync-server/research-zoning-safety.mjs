export const zoningResearchSafetyVersion =
  "20260830-zoning-material-completeness-v4";

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
    /\b(?:property|site|lot|project)\s+(?:is\s+)?(?:confirmed|verified|established)\s+to\s+be\s+(?:within|in)\s+(?:an?\s+|the\s+)?(?:MIH|Mandatory Inclusionary Housing)\s+area\b/i.test(value) ||
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
      /\b(?:definitions?|defined terms?)\b/i.test(compactText(`${source?.title} ${source?.text}`)) ||
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
  const basicLotCoverage = /\bbasic\b[^?]{0,100}\blot[- ]coverage\b|\blot[- ]coverage\b[^?]{0,100}\bbasic\b/i.test(questionText);
  const parkingGeography = /\bparking\b/i.test(questionText) &&
    /\b(?:transit zone|Greater Transit Zone|special parking areas?|special district)\b/i.test(`${questionText} ${sourceText}`);
  const definitionBranchReview = definition && /\bzoning lot\b/i.test(questionText) &&
    /\(a\)[\s\S]*\(b\)[\s\S]*\(c\)[\s\S]*\(d\)/i.test(sourceText);
  const loweredYardClause = definition &&
    /\bDecember\s+5,\s+1990\b/i.test(sourceText) &&
    /\byard\b[^.]{0,220}\blowered\b|\blowered\b[^.]{0,220}\byard\b/i.test(sourceText) &&
    !/\b(?:yard\b[^?]{0,160}\blowered|lowered\b[^?]{0,160}\byard)\b/i.test(questionText);
  const missingExistingCondition =
    /\b(?:existing|existed|existence)[- ]?(?:facility|building|use)?\b[^?]{0,180}\b(?:not (?:been )?(?:provided|established|identified|verified)|missing|unknown)\b/i.test(questionText) ||
    /\b(?:not (?:been )?(?:provided|established|identified|verified)|missing|unknown)\b[^?]{0,180}\b(?:existing|existed|existence)[- ]?(?:facility|building|use)?\b/i.test(questionText);
  const mihHistoricalZoningLotException =
    /\b(?:Mandatory Inclusionary Housing|MIH)\b/i.test(`${questionText} ${sourceText}`) &&
    /\bnot more than 10 dwelling units\b/i.test(sourceText) &&
    /\b12,500 square feet\b/i.test(sourceText) &&
    /\bzoning lot that existed on the date of establishment\b/i.test(sourceText);
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
    ...(definitionBranchReview ? ["definition-branches"] : []),
    ...(loweredYardClause ? ["definition-lowered-yard"] : []),
    ...(basicLotCoverage ? ["basic-lot-coverage"] : []),
    ...(parkingGeography ? ["parking-geography"] : []),
    ...(missingExistingCondition ? ["missing-existing-condition"] : []),
    ...(mihHistoricalZoningLotException ? ["mih-historical-zoning-lot"] : []),
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
    basicLotCoverage,
    parkingGeography,
    definitionBranchReview,
    loweredYardClause,
    missingExistingCondition,
    mihHistoricalZoningLotException,
    sourceText,
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
    profile.definitionBranchReview
      ? "The supplied definition contains alternative branches. Address every branch that could decide the stated facts separately; do not treat one historical or current branch as a substitute for another."
      : "",
    profile.loweredYardClause
      ? "The supplied definition contains a post-December 5, 1990 lowered-yard measurement clause that the scenario does not resolve. Identify that fact as unresolved before giving a conclusive classification."
      : "",
    profile.basicLotCoverage
      ? "A basic lot-coverage percentage is only that numerical cap. Do not call the calculated area an entitled or permitted footprint; state that independently applicable yard, open-area, or other bulk rules may be more restrictive."
      : "",
    profile.parkingGeography
      ? "For parking geography, analyze the supplied Inner, Outer, and Greater Transit Zone paths separately and preserve any supplied special-parking-area or special-district alternative. General proximity to transit is not mapped status."
      : "",
    profile.missingExistingCondition
      ? "The question expressly leaves an existing facility, building, or use condition unresolved. Name that dated existence/status fact separately from lot size, filing date, or other historical facts."
      : "",
    profile.mihHistoricalZoningLotException
      ? "For the MIH small-development exception, satisfying the unit and residential-floor-area thresholds is not enough. Separately establish that the relevant zoning lot existed on the official MIH-area establishment date. Distinguish tax lots from the Zoning Resolution's zoning-lot definition, do not treat a later tax-lot combination or a current Appendix F map as proof of the historical zoning lot, and require official evidence of both the establishment date and the lot's historical configuration."
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
  const questionText = compactText(question);
  const conclusion = compactText(answer?.conclusion);
  const citations = citedSourceIDs(answer);
  const citationSet = new Set(citations);
  const missingFacts = compactText(Array.isArray(answer?.missingFacts) ? answer.missingFacts.join(" ") : "");
  const evidenceNeeded = compactText([
    ...(Array.isArray(answer?.missingFacts) ? answer.missingFacts : []),
    ...(Array.isArray(answer?.additionalEvidenceNeeded) ? answer.additionalEvidenceNeeded : [])
  ].join(" "));
  const issues = [];
  const countPredicate = questionText.match(/\bDoes\b[^?]*?\b(count(?:\s+as\s+[^?]+)?)\?$/i)?.[1];
  if (
    countPredicate &&
    /^yes\b/i.test(conclusion) &&
    new RegExp(`\\bdoes not ${countPredicate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(narrative)
  ) {
    issues.push({
      type: "zoning_answer_polarity_conflict",
      detail: "The leading yes/no answer contradicts the answer's own stated result. Make the direct answer agree with the supported conclusion."
    });
  }
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
    profile.basicLotCoverage &&
    !/\b(?:yard|open[- ]area|other (?:bulk|zoning|applicable) (?:rule|requirement|provision))s?\b[^.]{0,180}\b(?:restrict|limit|control|more restrictive|independently appl)/i.test(narrative)
  ) {
    issues.push({
      type: "zoning_basic_lot_coverage_boundary",
      detail: "Treat the basic lot-coverage calculation as a numerical cap, not an entitled footprint, and preserve independently applicable yard, open-area, or other bulk constraints."
    });
  }
  if (
    profile.definitionBranchReview &&
    !(
      /\blot of record\b[^.]{0,180}\b(?:December\s+15,\s+1961|applicable subsequent amendment date|historical date)\b/i.test(narrative) ||
      /\b(?:December\s+15,\s+1961|applicable subsequent amendment date|historical date)\b[^.]{0,180}\blot of record\b/i.test(narrative)
    )
  ) {
    issues.push({
      type: "zoning_definition_branch_omission",
      detail: "The Zoning Lot definition has a separate historical lot-of-record branch. Address it independently from the historical single-ownership and current filing or declaration branches."
    });
  }
  if (
    profile.loweredYardClause &&
    !/\b(?:lowered yard|yard (?:was|is|had been) lowered)\b[^.]{0,180}\b(?:unknown|not (?:provided|established|verified)|missing|unresolved|must be (?:confirmed|verified|established))\b/i.test(missingFacts)
  ) {
    issues.push({
      type: "zoning_definition_lowered_yard_fact",
      detail: "The supplied definition's post-December 5, 1990 lowered-yard condition is unresolved. Name that measurement fact in missingFacts before treating the classification as conclusive."
    });
  }
  if (
    profile.parkingGeography &&
    /\b(?:special parking areas?|special district)\b/i.test(profile.sourceText || "") &&
    !(
      /\b(?:special parking areas?|special district)\b[^.]{0,180}\b(?:may|could|can)\b[^.]{0,100}\b(?:differ|apply|produce|supply|control|modify|change)\b/i.test(narrative) ||
      /\b(?:different|separate|alternative)\b[^.]{0,120}\b(?:special parking areas?|special district)\b/i.test(narrative)
    )
  ) {
    issues.push({
      type: "zoning_parking_geography_omission",
      detail: "Preserve the supplied special-parking-area or special-district path as a possible alternative to the ordinary transit-zone calculation."
    });
  }
  if (
    profile.missingExistingCondition &&
    !/\b(?:existing|existed|existence)\b[^.]{0,120}\b(?:facility|building|use)\b|\b(?:facility|building|use)\b[^.]{0,120}\b(?:existing|existed|existence)\b/i.test(missingFacts)
  ) {
    issues.push({
      type: "zoning_missing_existing_condition",
      detail: "Name the unresolved dated existence/status of the facility, building, or use separately from the lot-area or filing-date facts."
    });
  }
  if (profile.mihHistoricalZoningLotException) {
    const categoricalException =
      /\b(?:project|development|property|it)\b[^.]{0,100}\b(?:qualifies|is exempt|meets the exception)\b/i.test(narrative) ||
      /\b(?:the )?exception (?:applies|is satisfied)\b/i.test(narrative);
    const numericalOnlyBoundary =
      /\b(?:numerical|unit|dwelling[- ]unit|floor[- ]area)\b[^.]{0,160}\b(?:not enough|not sufficient|does not (?:establish|prove)|alone (?:does not|cannot))\b/i.test(narrative) ||
      /\b(?:not enough|not sufficient|does not (?:establish|prove)|alone (?:does not|cannot))\b[^.]{0,160}\b(?:numerical|unit|dwelling[- ]unit|floor[- ]area|threshold)\b/i.test(narrative);
    if (categoricalException && !numericalOnlyBoundary) {
      issues.push({
        type: "zoning_mih_numerical_only_conclusion",
        detail: "Do not grant the MIH small-development exception from the unit and floor-area thresholds alone; the historical zoning-lot element must also be established."
      });
    }
    const historicalLotRequirement =
      /\bzoning lot\b[^.]{0,220}\b(?:existed|existence)\b[^.]{0,160}\b(?:MIH|Mandatory Inclusionary Housing|area)\b[^.]{0,120}\b(?:establish|establishment|effective date)\b/i.test(narrative) ||
      /\b(?:MIH|Mandatory Inclusionary Housing|area)\b[^.]{0,160}\b(?:establish|establishment|effective date)\b[^.]{0,220}\bzoning lot\b[^.]{0,100}\b(?:existed|existence)\b/i.test(narrative);
    const taxLotDistinction =
      /\btax lots?\b[^.]{0,180}\b(?:not (?:the )?same|may differ|does not (?:establish|prove)|not proof|distinct)\b[^.]{0,120}\bzoning lot\b/i.test(narrative) ||
      /\bzoning lot\b[^.]{0,180}\b(?:not (?:the )?same|may differ|does not (?:necessarily )?(?:match|coincide)|distinct)\b[^.]{0,120}\btax lots?\b/i.test(narrative);
    if (!historicalLotRequirement || !taxLotDistinction) {
      issues.push({
        type: "zoning_mih_historical_lot_requirement",
        detail: "State the separate requirement that the zoning lot existed on the applicable MIH-area establishment date, and distinguish that zoning lot from current tax lots or a later tax-lot combination."
      });
    }
    const officialEstablishmentDate =
      /\b(?:official|verify|verified|record|historical)\b[^.]{0,180}\b(?:MIH|Mandatory Inclusionary Housing)\b[^.]{0,120}\b(?:establishment|effective) date\b/i.test(evidenceNeeded) ||
      /\b(?:MIH|Mandatory Inclusionary Housing)\b[^.]{0,180}\b(?:establishment|effective) date\b[^.]{0,120}\b(?:official|verify|verified|record|historical)\b/i.test(evidenceNeeded);
    const officialHistoricalLot =
      /\b(?:official|recorded|historical)\b[^.]{0,180}\bzoning[- ]lot\b[^.]{0,160}\b(?:record|configuration|declaration|legal description|ownership|evidence)\b/i.test(evidenceNeeded) ||
      /\bzoning[- ]lot\b[^.]{0,180}\b(?:record|configuration|declaration|legal description|ownership|evidence)\b[^.]{0,120}\b(?:official|recorded|historical|verify)\b/i.test(evidenceNeeded);
    if (!officialEstablishmentDate || !officialHistoricalLot) {
      issues.push({
        type: "zoning_mih_historical_records",
        detail: "Identify official evidence for the applicable MIH establishment date and separate official historical zoning-lot evidence, such as a relevant recorded declaration, legal description, or equivalent ownership/configuration record."
      });
    }
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

export function applyZoningResearchDeterministicRepairs(answer, evidence = [], { question = "" } = {}) {
  if (!answer || typeof answer !== "object") return answer;
  const profile = riskProfile({ question, evidence });
  const narrative = answerText(answer);
  const historicalTextVerification =
    /\b(?:verify|review|retrieve|obtain|need|require|must)\b[^.]{0,220}\b(?:historical|archived|prior|pre[- ](?:amendment|city of yes|december))\b[^.]{0,120}\b(?:zoning|text|rules?|provisions?)\b/i.test(narrative) ||
    /\b(?:historical|archived|prior|pre[- ](?:amendment|city of yes|december))\b[^.]{0,120}\b(?:zoning|text|rules?|provisions?)\b[^.]{0,180}\b(?:verify|review|retrieve|obtain|need|required?|must)\b/i.test(narrative);
  if (!profile.categories.includes("historical-substantive-text") || historicalTextVerification) return answer;
  const limitation = "The current transition provision may preserve prior rules but does not reproduce their substantive requirements.";
  const needed = "Verify the dated enacted or official archived pre-amendment Zoning text to determine the substantive rules preserved for the project.";
  const appendParagraph = (value, paragraph) => {
    const text = String(value || "").trim();
    return text ? `${text}\n\n${paragraph}` : paragraph;
  };
  return {
    ...answer,
    answerText: appendParagraph(answer.answerText, `${limitation} ${needed}`),
    ...(typeof answer.explanation === "string"
      ? { explanation: appendParagraph(answer.explanation, `${limitation} ${needed}`) }
      : {}),
    evidenceLimitations: unique([...(answer.evidenceLimitations || []), limitation]),
    additionalEvidenceNeeded: unique([...(answer.additionalEvidenceNeeded || []), needed])
  };
}

export function zoningResearchSafetyRevisionIssues(result) {
  return Array.isArray(result?.issues) ? result.issues : [];
}
