import { createHash } from "node:crypto";

export const zoningResearchSafetyVersion =
  "20260830-zoning-material-completeness-v9";

const zoningCorpusID = "nyc-zoning-resolution";

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function unique(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(compactText).filter(Boolean)));
}

const calendarMonthNumbers = new Map([
  ["january", "01"], ["jan", "01"],
  ["february", "02"], ["feb", "02"],
  ["march", "03"], ["mar", "03"],
  ["april", "04"], ["apr", "04"],
  ["may", "05"],
  ["june", "06"], ["jun", "06"],
  ["july", "07"], ["jul", "07"],
  ["august", "08"], ["aug", "08"],
  ["september", "09"], ["sep", "09"], ["sept", "09"],
  ["october", "10"], ["oct", "10"],
  ["november", "11"], ["nov", "11"],
  ["december", "12"], ["dec", "12"]
]);

const calendarDatePattern = /\b(January|Jan\.?|February|Feb\.?|March|Mar\.?|April|Apr\.?|May|June|Jun\.?|July|Jul\.?|August|Aug\.?|September|Sept?\.?|October|Oct\.?|November|Nov\.?|December|Dec\.?)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})\b/gi;

const datedEventPatterns = [
  ["filing", /\b(?:application|applied|filed|filing)\b/i],
  ["permit", /\b(?:permit|permitted)\b/i],
  ["approval", /\b(?:approval|approved)\b/i],
  ["foundation", /\b(?:foundation|foundations|excavation)\b/i],
  ["certificate", /\b(?:certificate|occupancy|C\s+of\s+O)\b/i],
  ["certificate", /\bCO\b(?=\s+(?:(?:was|is|has been|had been)\s+)?(?:issued|granted|obtained)\b)/],
  ["amendment", /\b(?:adoption|adopted|amendment|effective)\b/i]
];

function calendarDateRelation(value) {
  const prefix = String(value || "").slice(-80);
  const relation = prefix.match(
    /\b(on\s+(?:or|and)\s+after|on\s+(?:or|and)\s+before|no\s+later\s+than|no\s+earlier\s+than|subsequent\s+to|later\s+than|prior\s+to|earlier\s+than|after|before|by|as[- ]of|on)\s*$/i
  )?.[1]?.toLowerCase().replace(/\s+/g, " ");
  if (!relation) return null;
  const normalized = relation === "by" || relation === "no later than" || /on (?:or|and) before/.test(relation)
    ? "on-or-before"
    : relation === "no earlier than" || /on (?:or|and) after/.test(relation)
      ? "on-or-after"
      : relation === "prior to" || relation === "earlier than"
        ? "before"
        : relation === "subsequent to" || relation === "later than"
          ? "after"
          : relation;
  const negated = new RegExp(
    `(?:\\b(?:not|never|no)\\b|\\b(?:wasn['’]t|isn['’]t|didn['’]t|hasn['’]t|hadn['’]t)\\b)[^.!?;]{0,60}\\b${relation.replace(/\s+/g, "\\s+")}\\s*$`,
    "i"
  ).test(prefix);
  return negated ? `not-${normalized}` : normalized;
}

function calendarDateRelationCompatible(required, observed) {
  if (!required) return true;
  if (!observed) return false;
  const allowed = {
    after: new Set(["after"]),
    before: new Set(["before"]),
    "on-or-after": new Set(["on-or-after", "after", "on"]),
    "on-or-before": new Set(["on-or-before", "before", "on"]),
    on: new Set(["on"]),
    "as-of": new Set(["as-of", "on"])
  };
  return allowed[required]?.has(observed) || required === observed;
}

function calendarDateMentions(value) {
  const text = String(value || "");
  const dateMatches = Array.from(text.matchAll(calendarDatePattern), (match) => ({
    raw: match[0],
    monthName: match[1].replace(/\.$/, "").toLowerCase(),
    day: match[2],
    year: match[3],
    start: match.index,
    end: match.index + match[0].length
  }));
  const clauseBoundaries = Array.from(
    text.matchAll(/(?:[.!?;]\s+|,\s+(?:and|but|while|whereas)\s+)/gi)
  ).map((match) => ({ start: match.index, end: match.index + match[0].length }));
  const distanceBetween = (leftStart, leftEnd, rightStart, rightEnd) => {
    if (leftEnd <= rightStart) return rightStart - leftEnd;
    if (rightEnd <= leftStart) return leftStart - rightEnd;
    return 0;
  };
  return dateMatches.map((dateMatch) => {
    const month = calendarMonthNumbers.get(dateMatch.monthName);
    const day = String(Number(dateMatch.day)).padStart(2, "0");
    const previousBoundary = clauseBoundaries
      .filter((boundary) => boundary.end <= dateMatch.start)
      .at(-1);
    const nextBoundary = clauseBoundaries.find((boundary) => boundary.start >= dateMatch.end);
    const clauseStart = previousBoundary?.end || 0;
    const clauseEnd = nextBoundary?.start || text.length;
    const clause = text.slice(clauseStart, clauseEnd);
    const datePrefix = text.slice(clauseStart, dateMatch.start);
    const clauseDates = dateMatches.filter((candidate) =>
      candidate.start >= clauseStart && candidate.end <= clauseEnd
    );
    const eventClasses = datedEventPatterns
        .filter(([, pattern]) => Array.from(
          clause.matchAll(new RegExp(pattern.source, `${pattern.flags.replace(/g/g, "")}g`))
        ).some((eventMatch) => {
          const eventStart = clauseStart + eventMatch.index;
          const eventEnd = eventStart + eventMatch[0].length;
          const currentDistance = distanceBetween(
            dateMatch.start,
            dateMatch.end,
            eventStart,
            eventEnd
          );
          const closestDistance = Math.min(...clauseDates.map((candidate) =>
            distanceBetween(candidate.start, candidate.end, eventStart, eventEnd)
          ));
          return currentDistance === closestDistance;
        }))
        .map(([eventClass]) => eventClass);
    return {
      raw: dateMatch.raw,
      key: `${dateMatch.year}-${month}-${day}`,
      relation: calendarDateRelation(datePrefix) || (eventClasses.length ? "on" : null),
      eventClasses
    };
  });
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

function hasConcretePropertyIdentifier(value) {
  return /\bBBL\s*[:#-]?\s*[1-5]\d{9}\b/i.test(value) ||
    /\bBBL\s*[:#-]?\s*\d{1,10}[-\s]\d{1,5}[-\s]\d{1,5}\b/i.test(value) ||
    /\bBlock\s+\d{1,10}\s*(?:,|\/|and)\s*Lot\s+\d{1,5}\b/i.test(value) ||
    /\b\d{1,6}\s+[A-Za-z0-9.'’ -]{1,80}\s+(?:Street|St\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Road|Rd\.?|Drive|Dr\.?|Lane|Ln\.?|Place|Pl\.?|Court|Ct\.?|Parkway|Pkwy\.?|Highway|Hwy\.?)\b/i.test(value);
}

function hasConcreteMappedLocation(value) {
  if (negativeLocationStatement(value)) return false;
  return /\b(?:Zoning District|mapped district)\s*[:—-]\s*(?:R\d{1,2}[A-Z]?|C\d(?:-\d[A-Z]?)?|M\d(?:-\d)?)(?:\b|\s)/i.test(value) ||
    /\b(?:R\d{1,2}[A-Z]?|C\d(?:-\d[A-Z]?)?|M\d(?:-\d)?)\b/i.test(value) ||
    /\b(?:within|in)\s+(?:the\s+)?(?:Inner|Outer)\s+Transit\s+Zone\b/i.test(value) ||
    /\b(?:property|site|lot|project)\s+(?:is\s+)?(?:confirmed|verified|established)\s+to\s+be\s+(?:within|in)\s+(?:an?\s+|the\s+)?(?:MIH|Mandatory Inclusionary Housing)\s+area\b/i.test(value) ||
    /\b(?:within|in)\s+(?:the\s+)?(?:[A-Z][A-Za-z' -]+\s+)?(?:Special\s+[A-Z][A-Za-z' -]+\s+District|[A-Z][A-Za-z' -]+\s+Subdistrict)\b/i.test(value);
}

function citedSourceIDs(answer) {
  return unique((Array.isArray(answer?.citations) ? answer.citations : [])
    .flatMap((citation) => citation?.sourceIDs));
}

function hasProjectHeadReference(value) {
  const text = compactText(value);
  if (!text) return false;
  return /\b(?:it|this|that|these|those|they|both|one)\b/i.test(text) ||
    /\b(?:sites?|propert(?:y|ies)|parcels?|(?:tax|zoning) lots?|lots?|projects?|developments?|buildings?|proposals?|uses?|facilit(?:y|ies)|premises|tracts?|structures?)\b/i.test(text);
}

const zoningSectionReferencePattern = String.raw`Section\s+[0-9A-Za-z.-]+`;
const zoningCommissionPattern = String.raw`(?:CPC|City Planning Commission)`;
const zoningPermitObjectPattern = String.raw`(?:(?:a\s+)?(?:${zoningCommissionPattern}\s+)?special permit(?:\s+of\s+(?:the\s+)?City Planning Commission)?(?:\s+(?:under|pursuant to)\s+${zoningSectionReferencePattern})?|(?:(?:the\s+)?${zoningCommissionPattern}(?:['’]s)?\s+approval|(?:the\s+)?approval\s+(?:of|from|by)\s+(?:the\s+)?${zoningCommissionPattern})|(?:an?\s+)?(?:${zoningCommissionPattern}\s+)?authorization(?:\s+(?:under|pursuant to)\s+${zoningSectionReferencePattern})?)`;
const zoningSpecialPermitPredicatePattern = String.raw`(?:(?:requires?|need(?:s)?)\s+${zoningPermitObjectPattern}|need(?:s)?\s+to\s+(?:obtain|secure|have)\s+${zoningPermitObjectPattern}|(?:has|have)\s+to\s+(?:(?:obtain|secure|have)\s+${zoningPermitObjectPattern}|be\s+(?:subject to|contingent on)\s+${zoningPermitObjectPattern})|must\s+(?:obtain|secure|have)\s+${zoningPermitObjectPattern}|(?:cannot|may|can)\s+proceed\s+(?:without|subject to|only\s+(?:by|with))\s+${zoningPermitObjectPattern}|(?:may|shall|must|can)\s+not\s+proceed\s+without\s+${zoningPermitObjectPattern}|(?:is|are|shall be|must be)\s+(?:subject to|contingent on)\s+${zoningPermitObjectPattern})`;

function hasSpecialPermitOrAuthorizationPredicate(value) {
  return new RegExp(String.raw`\b${zoningSpecialPermitPredicatePattern}\b`, "i")
    .test(compactText(value));
}

function hasMappedOrRegulatoryPredicate(value) {
  const text = compactText(value);
  return /\b(?:is|are|will be|would be|can be|may be|shall be|must be)\b[^.]{0,160}\b(?:permitted|allowed|authorized|compliant|lawful|as[- ]of[- ]right|within|outside|subject to|required|special permit)\b/i.test(text) ||
    /\b(?:is|are|falls|lies)\s+(?:within|outside|in|on)\b/i.test(text) ||
    hasSpecialPermitOrAuthorizationPredicate(text) ||
    /^(?:permitted|allowed|authorized)\s+as[- ]of[- ]right\b[^.]{0,140}\b(?:Subarea\s*[12]|Appendix\s+[A-Z]|mapped area|designated area)\b/i.test(text) ||
    /^(?:within|in|outside)\s+(?:the\s+)?(?:Subarea\s*[12]|Appendix\s+[A-Z]|mapped area|designated area)\b[^.]{0,140}\b(?:permitted|allowed|authorized|as[- ]of[- ]right|special permit)\b/i.test(text) ||
    /\b(?:falls|lies|qualifies|complies|satisfies|is permitted)\b/i.test(text);
}

function categoricalProjectConclusion(value) {
  const directProjectConclusion =
    hasProjectHeadReference(value) && hasMappedOrRegulatoryPredicate(value);
  return directProjectConclusion ||
    /\b(?:(?:the|this|that|a|an)\s+)?(?:proposed\s+)?(?:residential|commercial|manufacturing|community[- ]facility|self[- ]service storage|office|parking|use|building|development|project|proposal)\b[^.]{0,100}\b(?:is|are|will be|would be|can be|may be)\s+(?:permitted|allowed|authorized|compliant|lawful|as[- ]of[- ]right|within|outside|subject to)\b/i.test(value) ||
    /\b(?:(?:the|this|that|a|an)\s+)?(?:proposed\s+)?(?:residential|commercial|manufacturing|community[- ]facility|self[- ]service storage|office|parking|use|building|development|project|proposal)\b[^.]{0,100}\b(?:qualifies|may proceed|can proceed|would proceed|may go forward|can go forward|would go forward)\b[^.]{0,50}\bas[- ]of[- ]right\b/i.test(value);
}

function statesLocationBoundary(value) {
  return /\b(?:cannot|could not|does not|not enough|insufficient|unable to)\b[^.]{0,180}\b(?:determine|establish|conclude|confirm|place|locate|map|apply)\b/i.test(value) ||
    /\bno\s+(?:site-specific|property-specific|parcel-specific)\s+(?:conclusion|determination)\s+(?:can|may)\s+be\s+(?:made|reached|given)\b/i.test(value) ||
    /\b(?:site-specific|property-specific|parcel-specific)\b[^.]{0,140}\b(?:cannot|not|unknown|unresolved|requires?)\b/i.test(value) ||
    /\b(?:address|BBL|block(?: and |\/)lot|property location|mapped district|zoning district|official map|mapped status)\b[^.]{0,140}\b(?:is|are)\s+(?:required|needed)\b[^.]{0,120}\bbefore\b[^.]{0,100}\b(?:determin|calculat|conclud|confirm|apply)\w*/i.test(value);
}

function statesSourceLevelMappedAreaRule(value) {
  const text = compactText(value);
  if (!text || hasConcretePropertyIdentifier(text)) return false;
  const sourceLeadPattern = String.raw`(?:(?:(?:under|in|according to)\s+(?:the\s+)?Appendix\s+J,\s+)|(?:(?:the\s+)?Appendix\s+J\s+(?:[A-Za-z-]+\s+){1,3}that\s+))?`;
  const asOfRightObjectPattern = String.raw`(?:the\s+)?as[- ]of[- ]right provisions(?:\s+of\s+${zoningSectionReferencePattern})?`;
  const sourceTreatmentPattern = String.raw`(?:(?:is|are|shall be|must be)\s+(?:subject to\s+(?:${asOfRightObjectPattern}|${zoningSectionReferencePattern})|(?:permitted|allowed|authorized)\s+as[- ]of[- ]right)|${zoningSpecialPermitPredicatePattern})`;
  const mapReferencePattern = String.raw`(?:(?:the\s+)?Subarea\s*[12](?:\s+maps?)?|(?:the\s+)?maps?\s+in\s+(?:the\s+)?Subarea\s*[12]|(?:the\s+)?Appendix\s+[A-Z](?:\s+maps?)?)`;
  const facilityLocationPattern = String.raw`(?:in|within)\s+(?:(?:the\s+)?Subarea\s*[12]|(?:the\s+)?(?:designated\s+)?areas?\s+(?:shown|located)\s+(?:on|in|within)\s+${mapReferencePattern})`;
  const areaMapRelationPattern = String.raw`(?:(?:shown|located)\s+(?:on|in|within)\s+${mapReferencePattern}|(?:in|within)\s+(?:the\s+)?(?:Subarea\s*[12]|Appendix\s+[A-Z]|(?:Manufacturing|Residence|Commercial)\s+Districts?))`;
  const terminalPattern = String.raw`[.!?]?`;
  const facilityRule = new RegExp(
    String.raw`^${sourceLeadPattern}(?:the\s+)?self[- ]service storage facilities\s+${facilityLocationPattern}\s+${sourceTreatmentPattern}(?:,\s*(?:while|and)\s+those(?:\s+facilities)?\s+${facilityLocationPattern}\s+${sourceTreatmentPattern})?${terminalPattern}$`,
    "i"
  );
  const areaDirectRule = new RegExp(
    String.raw`^${sourceLeadPattern}(?:for\s+(?:the\s+)?self[- ]service storage facilities,\s+)?(?:the\s+)?(?:designated\s+)?areas?\s+${areaMapRelationPattern}\s+${sourceTreatmentPattern}(?:\s+for\s+(?:the\s+)?self[- ]service storage facilities)?(?:,\s*(?:while|and)\s+those\s+${areaMapRelationPattern}\s+${sourceTreatmentPattern})?${terminalPattern}$`,
    "i"
  );
  const relativeSecondAreaPattern = String.raw`(?:in which\s+(?:such|those) uses\s+${sourceTreatmentPattern}|(?:subject to\s+${zoningPermitObjectPattern}))`;
  const areaRelativeRule = new RegExp(
    String.raw`^${sourceLeadPattern}(?:the\s+)?(?:designated\s+)?areas?\s+in which\s+(?:the\s+)?self[- ]service storage facilities\s+${sourceTreatmentPattern}\s+(?:is|are)\s+${areaMapRelationPattern}(?:,\s*(?:while|and)\s+those\s+${relativeSecondAreaPattern}\s+(?:is|are)\s+${areaMapRelationPattern})?${terminalPattern}$`,
    "i"
  );
  return facilityRule.test(text) || areaDirectRule.test(text) || areaRelativeRule.test(text);
}

function isAppendixJSourceBoundaryQuestion(value) {
  const text = compactText(value);
  return /\bAppendix\s+J\b/i.test(text) &&
    /\bwhat\b[^?]{0,180}\b(?:establish|show|provide)\b/i.test(text) &&
    /\b(?:site|property|parcel)[- ]specific\s+(?:conclusion|determination)\b/i.test(text) &&
    /\bmap\b/i.test(text) &&
    /\blocation\b/i.test(text);
}

function hasUnsafeMappedSubjectReference(value) {
  const text = compactText(value);
  if (!text) return false;
  if (hasConcretePropertyIdentifier(text)) return true;
  const projectNoun = String.raw`(?:sites?|propert(?:y|ies)|parcels?|(?:tax|zoning)\s+lots?|lots?|projects?|developments?|buildings?|proposals?|uses?|facilit(?:y|ies)|premises|tracts?|structures?)`;
  const possessiveLead = String.raw`(?:our|your|their|the\s+applicant['’]s|the\s+developer['’]s|the\s+tenant['’]s|the\s+company['’]s|[A-Z][A-Za-z'’.-]{1,40}['’]s)`;
  if (new RegExp(String.raw`\b${possessiveLead}\s+(?:(?:existing|current|referenced|subject|specific)\s+)?${projectNoun}\b`, "i").test(text)) return true;
  if (new RegExp(String.raw`\b(?:this|these|those)\s+(?:[A-Za-z-]+\s+){0,4}${projectNoun}\b`, "i").test(text)) return true;
  if (new RegExp(String.raw`\bthat\s+(?:(?:existing|current|referenced|subject|specific)\s+)?${projectNoun}\b`, "i").test(text)) return true;
  if (new RegExp(String.raw`\bproposed\s+(?:[A-Za-z-]+\s+){0,4}${projectNoun}\b`, "i").test(text)) return true;
  if (new RegExp(String.raw`\bthe\s+(?:(?:existing|current|referenced|subject|specific)\s+)?${projectNoun}\b`, "i").test(text)) return true;
  if (/\b(?:a|an|any|one)\s+(?:existing\s+)?(?:site|property|parcel|lot|project|development|building|proposal|premises|tract|structure)\b/i.test(text)) return true;
  if (/\b(?:here|in\s+this\s+application|under\s+review)\b/i.test(text)) return true;
  if (/\bSite\s+[A-Z0-9]+\b/.test(text)) return true;
  if (/^(?:it|this|that|these|those|they|both|one|we|ours|each)\b/i.test(text)) return true;
  return false;
}

function statesGenericAppendixJTreatment(value) {
  const text = compactText(value);
  if (!text || hasUnsafeMappedSubjectReference(text)) return false;
  const genericSubject =
    /\bself[- ]service storage facilit(?:y|ies)\b/i.test(text) ||
    /\bdesignated areas?\b/i.test(text) ||
    /\bAppendix\s+J\b/i.test(text) ||
    (/\bSubarea\s*1\b/i.test(text) && /\bSubarea\s*2\b/i.test(text));
  const mappedCategory =
    /\bSubarea\s*[12]\b/i.test(text) ||
    /\bAppendix\s+J\b/i.test(text);
  const regulatoryTreatment =
    /\bas[- ]of[- ]right\b/i.test(text) ||
    /\bSection\s+42-19\b/i.test(text) ||
    /\bspecial[- ]?permit\b/i.test(text) ||
    /\bSection\s+74-192\b/i.test(text);
  return genericSubject && mappedCategory && regulatoryTreatment;
}

function mappedAnswerFields(answer) {
  return [
    { fieldKind: "answer_text", value: answer?.answerText },
    { fieldKind: "conclusion", value: answer?.conclusion },
    { fieldKind: "explanation", value: answer?.explanation },
    ...(Array.isArray(answer?.supportedPoints)
      ? answer.supportedPoints.flatMap((point) => [
          { fieldKind: "supported_point_heading", value: point?.heading },
          { fieldKind: "supported_point_explanation", value: point?.explanation }
        ])
      : [])
  ].map((entry) => ({ ...entry, value: compactText(entry.value) })).filter((entry) => entry.value);
}

function splitMappedConclusionClauses(value) {
  const fieldText = compactText(value);
  if (statesGenericAppendixJTreatment(fieldText)) return [fieldText];
  return fieldText
    .split(/[.!?]\s+/)
    .flatMap((sentence) => {
      const compactSentence = compactText(sentence);
      if (!compactSentence) return [];
      if (statesSourceLevelMappedAreaRule(compactSentence) ||
        statesGenericAppendixJTreatment(compactSentence)) return [compactSentence];
      return compactSentence.split(/;\s+/).flatMap((clause) => {
        const compactClause = compactText(clause);
        const commaBoundaryConclusion = compactClause.match(/^(.+),\s+([^,]+)$/);
        if (
          commaBoundaryConclusion &&
          (
            (
              statesLocationBoundary(commaBoundaryConclusion[1]) &&
              (
                categoricalProjectConclusion(commaBoundaryConclusion[2]) ||
                hasMappedOrRegulatoryPredicate(commaBoundaryConclusion[2])
              )
            ) ||
            (
              statesLocationBoundary(commaBoundaryConclusion[2]) &&
              (
                categoricalProjectConclusion(commaBoundaryConclusion[1]) ||
                hasMappedOrRegulatoryPredicate(commaBoundaryConclusion[1])
              )
            )
          )
        ) {
          return [commaBoundaryConclusion[1], commaBoundaryConclusion[2]];
        }
        const leadingAdversative = compactClause.match(
          /^(?:even though|although|though|while)\s+(.+?),\s+(.+)$/i
        );
        if (leadingAdversative) return [leadingAdversative[1], leadingAdversative[2]];
        return compactClause.split(
          /,?\s+(?:but|however|yet|although|whereas|even though|though|nevertheless|nonetheless|while)\s+/i
        );
      });
    })
    .map(compactText)
    .filter(Boolean);
}

function mappedClauseAnalysis(answer) {
  return mappedAnswerFields(answer).flatMap((field) =>
    splitMappedConclusionClauses(field.value).map((clause) => {
      const establishedSourceRule = statesSourceLevelMappedAreaRule(clause);
      const genericAppendixJTreatment = statesGenericAppendixJTreatment(clause);
      return {
        fieldKind: field.fieldKind,
        clause,
        locationBoundary: statesLocationBoundary(clause),
        sourceRule: establishedSourceRule || genericAppendixJTreatment,
        genericAppendixJTreatment,
        directConclusion:
          categoricalProjectConclusion(clause) || hasMappedOrRegulatoryPredicate(clause)
      };
    })
  );
}

function mappedLocationAttemptDiagnostic({
  sourceBoundaryQuestion,
  citedAppendixJ,
  mappedLocationBoundaryPresent,
  clauses,
  isTrigger
}) {
  const triggeringClauses = clauses.filter(isTrigger).slice(0, 24).map((clause) => ({
    fieldKind: clause.fieldKind,
    clauseHash: createHash("sha256").update(clause.clause).digest("hex"),
    clauseLength: clause.clause.length,
    locationBoundary: clause.locationBoundary,
    sourceRule: clause.sourceRule,
    directConclusion: clause.directConclusion
  }));
  return {
    schemaVersion: 1,
    kind: "zoning_mapped_location",
    sourceBoundaryQuestion,
    citedAppendixJ,
    mappedLocationBoundaryPresent,
    triggeringClauses
  };
}

function statesLoweredYardBoundary(value) {
  return /\b(?:lowered yard|yard (?:was|is|had been) lowered|yard-lowering)\b[^.]{0,180}\b(?:unknown|not (?:provided|established|verified)|missing|unresolved|must be (?:confirmed|verified|established)|depends?|subject to|conditional)\b/i.test(value) ||
    /\b(?:depends?|subject to|conditional|cannot be (?:determined|confirmed)|no final (?:classification|determination))\b[^.]{0,180}\b(?:lowered yard|yard (?:was|is|had been) lowered|yard-lowering)\b/i.test(value) ||
    /\bif\b[^.]{0,180}\byard\b[^.]{0,100}\blowered\b[^.]{0,180}\b(?:classification|result)\b[^.]{0,80}\b(?:may|could|can)\s+(?:differ|change)\b/i.test(value);
}

function statesUnconditionalCellarClassification(value) {
  return compactText(value).split(/(?<=[.!?;])\s+/).some((clause) => {
    if (/^(?:yes|no)[.!]?$/i.test(clause)) return true;
    if (/\b(?:whether|cannot be determined|could not be determined|depends? on)\b/i.test(clause) ||
      /\b(?:if|only if|unless|when)\b/i.test(clause)) return false;
    return /\b(?:level|space|area|floor|storage|it|this)\b[^.]{0,120}\b(?:is|are)\s+(?:excluded|included|a cellar|not a cellar)\b/i.test(clause) ||
      /\b(?:level|space|area|floor|storage|it|this)\b[^.]{0,120}\b(?:does not|does|will not|will)\s+count\b/i.test(clause) ||
      /\b(?:level|space|area|floor|storage|it|this)\b[^.]{0,120}\b(?:must|shall|will)\s+be\s+(?:omitted|excluded|included)\b[^.]{0,80}\b(?:zoning )?floor area\b/i.test(clause) ||
      /\b(?:counts?|qualifies)\s+as\s+(?:zoning )?floor area\b/i.test(clause);
  });
}

function statesOverstatedTaxMapDistinction(value) {
  const text = compactText(value);
  const hasTaxAndZoningAntecedent = /\bzoning[- ]lots?\b/i.test(text) && /\btax[- ]lots?\b/i.test(text);
  return text.split(/(?<=[.!?;])\s+/).some((sentence) => {
    const explicitPair =
      /\bzoning(?:[- ]lots?)?\b[^.]{0,120}\btax[- ]lots?\b/i.test(sentence) ||
      /\btax[- ]lots?\b[^.]{0,120}\bzoning(?:[- ]lots?)?\b/i.test(sentence);
    const boundedCoreference = hasTaxAndZoningAntecedent &&
      /\b(?:they|these two|the two)\b/i.test(sentence);
    const categoricalNonidentity =
      /\b(?:is|are)\s+(?:always\s+)?(?:distinct|different|separate)(?:\s+from)?\b/i.test(sentence) ||
      /\b(?:always\s+(?:distinct|different|separate)|(?:can\s+)?never\s+(?:coincide|be\s+(?:the\s+)?same|be\s+identical)|cannot\s+(?:coincide|be\s+(?:the\s+)?same|be\s+identical))\b/i.test(sentence);
    return (explicitPair || boundedCoreference) && categoricalNonidentity;
  });
}

function statesUnsupportedParkingAlternative(value) {
  return compactText(value).split(/(?<=[.!?;])\s+/).some((sentence) => {
    if (!/\b(?:special parking areas?|special district)\b/i.test(sentence)) return false;
    if (/\b(?:does not|do not|cannot|can't|fails? to|without)\b|\bno\b[^.]{0,100}\b(?:alternative|different|unique|separate|result|outcome|rules?|requirements?)\b|\bnot\b[^.]{0,80}\b(?:supplied|provided|established|stated)\b/i.test(sentence)) return false;
    return /\b(?:different|unique|separate|alternative)\b[^.]{0,100}\b(?:result|outcome|path|rules?|requirements?|regulations?|standards?)\b/i.test(sentence) ||
      /\b(?:result|outcome|path|rules?|requirements?|regulations?|standards?)\b[^.]{0,100}\b(?:different|unique|separate|alternative)\b/i.test(sentence) ||
      /\b(?:may|could|can|will)\b[^.]{0,100}\b(?:differ|apply|produce|supply|control|modify|change|lead)\b/i.test(sentence) ||
      /\b(?:has|have|govern|governs|applies?|subject to)\b[^.]{0,100}\b(?:different|unique|separate|alternative)\b/i.test(sentence) ||
      /\b(?:different|unique|separate|alternative)\b[^.]{0,100}\b(?:govern|governs|applies?)\b/i.test(sentence) ||
      /\b(?:another|other)\s+(?:path|result|outcome|rule|requirement)\b/i.test(sentence);
  });
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
  const sourceTextWithoutDefinitionalTaxMap = sourceText.replace(/\btax map\b/gi, "");
  const propertyIdentifierKnown = hasConcretePropertyIdentifier(facts);
  const propertySpecific = propertyIdentifierKnown ||
    /\b(?:specific property|property|parcel|site|zoning lot|tax lot|this lot|this project|proposed|proposal|development|building)\b/i.test(questionText);
  const mappedApplicability =
    /\b(?:map|mapped|Appendix [A-Z]|designated area|subarea|zoning district|special[- ]district|subdistrict|transit zone)\b/i.test(questionText) ||
    /\b(?:map|Appendix [A-Z]|designated area|subarea|special[- ]district|subdistrict|transit zone)\b/i.test(sourceTextWithoutDefinitionalTaxMap);
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
  const map = /\b(?:map|mapped|Appendix [A-Z]|designated area|subarea)\b/i.test(`${questionText} ${sourceTextWithoutDefinitionalTaxMap}`) ||
    sources.some((source) => Array.isArray(source?.visualSources) && source.visualSources.length > 0);
  const basicLotCoverage = /\bbasic\b[^?]{0,100}\blot[- ]coverage\b|\blot[- ]coverage\b[^?]{0,100}\bbasic\b/i.test(questionText);
  const parkingGeography = /\bparking\b/i.test(questionText) &&
    /\b(?:transit zone|Greater Transit Zone|special parking areas?|special district)\b/i.test(`${questionText} ${sourceText}`);
  const parkingAlternativeMentioned = parkingGeography &&
    /\b(?:special parking areas?|special district)\b/i.test(sourceText);
  const parkingAlternativeRuleSupplied = parkingAlternativeMentioned && sources.some((source) =>
    compactText(`${source?.title} ${source?.text}`).split(/(?<=[.!?;])\s+/).some((sentence) =>
      /\b(?:special parking areas?|special district)\b/i.test(sentence) &&
      (
        /\b(?:different|unique|separate|alternative)\b[^.]{0,140}\b(?:parking )?(?:requirements?|rules?|regulations?|standards?)\b/i.test(sentence) ||
        /\b(?:parking )?(?:requirements?|rules?|regulations?|standards?)\b[^.]{0,140}\b(?:different|unique|separate|alternative)\b/i.test(sentence)
      ) &&
      !/\b(?:no|not|without|cannot|does not|fails? to)\b[^.]{0,180}\b(?:unique|different|separate|alternative|special parking|special district|requirements?|rules?|regulations?|standards?)\b/i.test(sentence)
    )
  );
  const zoningLotFormationQuestion =
    /\b(?:definition of|what (?:is|constitutes|qualifies as))\b[^?]{0,120}\bzoning[- ]lot\b/i.test(questionText) ||
    /\b(?:tax[- ]lots?|lots? of record)\b[^?]{0,180}\b(?:treated|considered|combined|constitute|formed)\b[^?]{0,100}\b(?:one|single|a)\s+zoning[- ]lot\b/i.test(questionText) ||
    /\b(?:treated|considered)\b[^?]{0,100}\b(?:one|single|a)\s+zoning[- ]lot\b[^?]{0,120}\b(?:ownership|contigu|declaration|lot of record)\b/i.test(questionText);
  const definitionBranchReview = definition && zoningLotFormationQuestion &&
    /\(a\)[\s\S]*\(b\)[\s\S]*\(c\)[\s\S]*\(d\)/i.test(sourceText);
  const zoningLotTaxMapDistinction = definitionBranchReview &&
    /\bmay or may not coincide\b/i.test(sourceText) &&
    /\btax map\b/i.test(sourceText);
  const loweredYardClause = definition &&
    /\bDecember\s+5,\s+1990\b/i.test(sourceText) &&
    /\byard\b[^.]{0,220}\blowered\b|\blowered\b[^.]{0,220}\byard\b/i.test(sourceText) &&
    !/\b(?:yard\b[^?]{0,160}\blowered|lowered\b[^?]{0,160}\byard)\b/i.test(questionText);
  const missingExistingCondition =
    /\b(?:existing|existed|existence)[- ]?(?:facility|building|use)?\b[^?]{0,180}\b(?:not (?:been )?(?:provided|established|identified|verified)|missing|unknown)\b/i.test(questionText) ||
    /\b(?:not (?:been )?(?:provided|established|identified|verified)|missing|unknown)\b[^?]{0,180}\b(?:existing|existed|existence)[- ]?(?:facility|building|use)?\b/i.test(questionText);
  const mihHistoricalZoningLotException =
    /\b(?:Mandatory Inclusionary Housing|MIH)\b/i.test(questionText) &&
    /\b(?:small[- ]development exception|not more than 10 (?:dwelling )?units?|12,500 square feet)\b/i.test(questionText) &&
    /\bnot more than 10 dwelling units\b/i.test(sourceText) &&
    /\b12,500 square feet\b/i.test(sourceText) &&
    /\bzoning lot that existed on the date of establishment\b/i.test(sourceText);
  const questionDateMentions = calendarDateMentions(questionText);
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
    ...(zoningLotTaxMapDistinction ? ["definition-tax-map-distinction"] : []),
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
    propertyIdentifierKnown,
    specialDistrictLabels,
    basicLotCoverage,
    parkingGeography,
    parkingAlternativeMentioned,
    parkingAlternativeRuleSupplied,
    definitionBranchReview,
    zoningLotTaxMapDistinction,
    loweredYardClause,
    missingExistingCondition,
    mihHistoricalZoningLotException,
    sourceText,
    tableSourceIDs: table ? unique(sources.filter((source) =>
      Array.isArray(source?.richSourceGrids) && source.richSourceGrids.length > 0
    ).map((source) => source?.sourceID)) : [],
    questionDates: unique(questionDateMentions.map((mention) => mention.raw)),
    questionDateMentions
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
      ? profile.propertyIdentifierKnown
        ? "The supplied address or property identifier does not itself establish mapped status. State that boundary, request the controlling official map or mapped-district evidence, and keep the result conditional."
        : "The supplied facts do not establish the mapped location needed for a parcel-specific conclusion. State that boundary, separately request a usable property identifier such as the address or BBL and the controlling official map or mapped-district evidence, and keep the result conditional."
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
    profile.zoningLotTaxMapDistinction
      ? "Preserve the supplied distinction that a zoning lot may or may not coincide with a lot shown on the official tax map; do not treat tax-lot and zoning-lot identity as automatic."
      : "",
    profile.loweredYardClause
      ? "The supplied definition contains a post-December 5, 1990 lowered-yard measurement clause that the scenario does not resolve. Identify that fact as unresolved before giving a conclusive classification."
      : "",
    profile.basicLotCoverage
      ? "A basic lot-coverage percentage is only that numerical cap. Do not call the calculated area an entitled or permitted footprint; state that independently applicable yard, open-area, or other bulk rules may be more restrictive."
      : "",
    profile.parkingGeography
      ? profile.parkingAlternativeRuleSupplied
        ? "For parking geography, analyze the supplied Inner, Outer, and Greater Transit Zone paths separately and preserve the supplied special-parking-area or special-district alternative. General proximity to transit is not mapped status."
        : "For parking geography, analyze only the supplied Inner, Outer, and Greater Transit Zone paths. If the evidence merely identifies a special parking area or special district without supplying its unique rule, state that limitation and request the controlling enacted provision rather than inventing an alternative result. General proximity to transit is not mapped status."
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
  const directAnswerFields = [answer?.answerText, answer?.conclusion]
    .map(compactText)
    .filter(Boolean);
  const citations = citedSourceIDs(answer);
  const citationSet = new Set(citations);
  const missingFacts = compactText(Array.isArray(answer?.missingFacts) ? answer.missingFacts.join(" ") : "");
  const evidenceNeededItems = [
    ...(Array.isArray(answer?.missingFacts) ? answer.missingFacts : []),
    ...(Array.isArray(answer?.additionalEvidenceNeeded) ? answer.additionalEvidenceNeeded : [])
  ].map(compactText).filter(Boolean);
  const evidenceNeeded = compactText(evidenceNeededItems.join(" "));
  const issues = [];
  const mappedConclusionNarrative = compactText([
    answer?.answerText,
    answer?.conclusion,
    answer?.explanation,
    ...(Array.isArray(answer?.supportedPoints)
      ? answer.supportedPoints.map((point) => point?.explanation)
      : [])
  ].filter(Boolean).join(" "));
  const mappedLocationBoundaryPresent = statesLocationBoundary(mappedConclusionNarrative);
  const mappedClauses = mappedClauseAnalysis(answer);
  const sourceBoundaryQuestion = isAppendixJSourceBoundaryQuestion(questionText);
  const citedAppendixJ = zoningEvidence(evidence).some((source) =>
    citationSet.has(compactText(source?.sourceID)) &&
    (
      /\bAppendix\s+J\b/i.test(compactText(source?.sectionNumber)) ||
      /\bAppendix\s+J\b/i.test(compactText(source?.title))
    )
  );
  const structuralAppendixJBoundary = sourceBoundaryQuestion && citedAppendixJ;
  const mappedClauseTriggers = (clause) => {
    if (clause.locationBoundary) return false;
    if (structuralAppendixJBoundary) {
      if (!mappedLocationBoundaryPresent) {
        return clause.sourceRule || clause.directConclusion;
      }
      return clause.directConclusion && !clause.sourceRule;
    }
    if (!clause.directConclusion && !clause.sourceRule) return false;
    return !(mappedLocationBoundaryPresent && clause.sourceRule);
  };
  const unboundedMappedConclusion = mappedClauses.some(mappedClauseTriggers);
  const mappedLocationDiagnostic = mappedLocationAttemptDiagnostic({
    sourceBoundaryQuestion,
    citedAppendixJ,
    mappedLocationBoundaryPresent,
    clauses: mappedClauses,
    isTrigger: mappedClauseTriggers
  });
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
    unboundedMappedConclusion
  ) {
    issues.push({
      type: "zoning_missing_mapped_location",
      detail: "Do not make a parcel-specific Zoning conclusion while mapped applicability is unresolved. State the boundary, keep the conclusion conditional, and name the missing address/BBL, mapped district, map area, or special-district fact in missingFacts."
    });
  }
  if (
    profile.missingMappedLocation &&
    !profile.propertyIdentifierKnown &&
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
    /\b(?:the (?:site|property|lot|facility)|this (?:site|property|lot|facility))\b[^.]{0,160}\b(?:is within|is outside|falls within|lies within|is shown in)\b/i.test(narrative)
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
  const overstatedTaxMapDistinction = statesOverstatedTaxMapDistinction(narrative);
  if (
    profile.zoningLotTaxMapDistinction &&
    (
      overstatedTaxMapDistinction ||
      !(
      /\bzoning[- ]lots?\b[^.]{0,180}\b(?:may or may not coincide|does not (?:necessarily )?(?:match|coincide)|is not necessarily (?:the same as|identical to)|identity (?:is|remains) not automatic)\b[^.]{0,140}\b(?:tax[- ]lots?|lots? shown on the (?:official )?tax map)\b/i.test(narrative) ||
      /\b(?:tax[- ]lots?|lots? shown on the (?:official )?tax map)\b[^.]{0,180}\b(?:may or may not coincide|does not (?:necessarily )?(?:match|coincide)|is not necessarily (?:the same as|identical to)|identity (?:is|remains) not automatic)\b[^.]{0,140}\bzoning[- ]lots?\b/i.test(narrative) ||
      /\bzoning[- ]lots?\b\s+(?:and|or)\s+(?:an? |the )?(?:tax[- ]lots?|lots? shown on the (?:official )?tax map)\b[^.]{0,120}\b(?:are not necessarily (?:the same|identical)|need not coincide|do not necessarily coincide)\b/i.test(narrative) ||
      /\b(?:tax[- ]lots?|lots? shown on the (?:official )?tax map)\b\s+(?:and|or)\s+(?:an? |the )?zoning[- ]lots?\b[^.]{0,120}\b(?:are not necessarily (?:the same|identical)|need not coincide|do not necessarily coincide)\b/i.test(narrative) ||
      /\b(?:tax[- ]lot|zoning[- ]lot)\s+and\s+(?:an? |the )?(?:zoning[- ]lot|tax[- ]lot)\s+identity\b[^.]{0,80}\b(?:is|remains) not automatic\b/i.test(narrative) ||
      /\b(?:tax[- ]lots?|zoning[- ]lots?)\b[^.]{0,100}\bis not automatically\s+(?:the same as|identical to)\b[^.]{0,100}\b(?:zoning[- ]lots?|tax[- ]lots?)\b/i.test(narrative)
      )
    )
  ) {
    issues.push({
      type: "zoning_definition_tax_map_distinction_omission",
      detail: "Preserve the supplied distinction that a zoning lot may or may not coincide with a lot shown on the official tax map."
    });
  }
  if (
    profile.loweredYardClause &&
    (
      !/\b(?:lowered yard|yard (?:was|is|had been) lowered)\b[^.]{0,180}\b(?:unknown|not (?:provided|established|verified)|missing|unresolved|must be (?:confirmed|verified|established))\b/i.test(missingFacts) ||
      !directAnswerFields.length ||
      !directAnswerFields.some(statesLoweredYardBoundary) ||
      statesUnconditionalCellarClassification(narrative)
    )
  ) {
    issues.push({
      type: "zoning_definition_lowered_yard_fact",
      detail: "The supplied definition's post-December 5, 1990 lowered-yard condition is unresolved. Keep the direct answer and conclusion conditional, and name that measurement fact in missingFacts."
    });
  }
  if (
    profile.parkingAlternativeRuleSupplied &&
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
  const unsupportedParkingAlternativeClaim = statesUnsupportedParkingAlternative(narrative);
  if (
    profile.parkingAlternativeMentioned &&
    !profile.parkingAlternativeRuleSupplied &&
    (
      unsupportedParkingAlternativeClaim ||
      !(
        /\b(?:selected|supplied|cited)\b[^.]{0,160}\b(?:evidence|passage|text)\b[^.]{0,160}\b(?:does not|cannot|fails to)\b[^.]{0,100}\b(?:supply|provide|establish|state)\b[^.]{0,120}\b(?:special parking|special[- ]district)\b[^.]{0,100}\b(?:rule|requirement|regulation|result)\b/i.test(narrative) &&
        /\b(?:obtain|verify|review|need|require)\b[^.]{0,180}\b(?:controlling|applicable|enacted|official)\b[^.]{0,100}\b(?:special parking|special[- ]district)\b[^.]{0,100}\b(?:rule|requirement|regulation|provision)\b/i.test(evidenceNeeded)
      )
    )
  ) {
    issues.push({
      type: "zoning_parking_geography_evidence_boundary",
      detail: "The selected evidence identifies special parking geography but does not supply its unique rule. State that limitation and request the controlling enacted provision instead of inventing an alternative result."
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
    const sentenceList = (value) => compactText(value)
      .split(/(?<=[.!?;])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    const narrativeSentences = sentenceList(narrative);
    const directConclusionSentence = sentenceList(conclusion)[0] || "";
    const conditionalGrantInSentence = (sentence) =>
      /\b(?:project|development|property|it)\b[^.]{0,80}\b(?:(?:may|could|can|would) qualify|qualifies|is exempt|is eligible|meets the exception)(?:,?\s+but)?\s+only if\b/i.test(sentence) ||
      /\b(?:the )?exception (?:applies|is satisfied)(?:,?\s+but)?\s+only if\b/i.test(sentence);
    const scopedNumericalDenialInSentence = (sentence) =>
      /\b(?:does(?: not|n['’]t)|cannot) qualify\b[^.]{0,120}\b(?:based (?:only )?on|on|from|using)\b[^.]{0,120}\b(?:unit|dwelling[- ]unit|floor[- ]area|numerical|threshold)\b[^.]{0,100}\balone\b/i.test(sentence);
    const bareCategoricalGrant = /^yes\b/i.test(conclusion);
    const directNamedGrant =
      /^(?:the )?(?:project|development|property|it) (?:qualifies|is exempt|is eligible|meets the exception)\b/i.test(directConclusionSentence) &&
      !conditionalGrantInSentence(directConclusionSentence);
    const narrativeCategoricalGrant = narrativeSentences.some((sentence) =>
      !conditionalGrantInSentence(sentence) && (
        /\b(?:project|development|property|it)\b[^.]{0,100}\b(?:qualifies|is exempt|meets the exception)\b/i.test(sentence) ||
        /\b(?:the )?exception (?:applies|is satisfied)\b/i.test(sentence)
      )
    );
    const bareCategoricalDenial = /^no(?:[.!?]+)?$/i.test(directConclusionSentence);
    const directNamedDenial =
      /^(?:the )?(?:project|development|property|it) (?:does(?: not|n['’]t) qualify|cannot qualify|is not exempt|is ineligible|does(?: not|n['’]t) meet the exception|fails the exception)\b/i.test(directConclusionSentence) &&
      !scopedNumericalDenialInSentence(directConclusionSentence);
    const narrativeCategoricalDenial = narrativeSentences.some((sentence) =>
      !scopedNumericalDenialInSentence(sentence) && (
        /\b(?:project|development|property|it)\b[^.]{0,100}\b(?:does(?: not|n['’]t) qualify|cannot qualify|is not exempt|is ineligible|does(?: not|n['’]t) meet the exception|fails the exception)\b/i.test(sentence) ||
        /\b(?:the )?exception (?:does not apply|is not satisfied)\b/i.test(sentence)
      )
    );
    const conditionalHistoricalGrant = narrativeSentences.some((sentence) =>
      conditionalGrantInSentence(sentence) && /\bzoning[- ]lot\b/i.test(sentence)
    );
    const conditionalHistoricalLotRequirement = narrativeSentences.some((sentence) =>
      conditionalGrantInSentence(sentence) &&
      /\b(?:already (?:a )?zoning[- ]lot|zoning[- ]lot\b[^.]{0,80}\b(?:existed|existence|already))\b/i.test(sentence) &&
      /\b(?:MIH|Mandatory Inclusionary Housing|area)[- ]?\b[^.]{0,120}\b(?:establish|establishment|effective)\b/i.test(sentence)
    );
    const establishmentDateReference =
      /\b(?:MIH|Mandatory Inclusionary Housing)\b[^.]{0,140}\b(?:establishment|effective) date\b/i.test(narrative) ||
      /\b(?:establishment|effective) date\b[^.]{0,140}\b(?:MIH|Mandatory Inclusionary Housing)\b/i.test(narrative);
    const referentialHistoricalLotRequirement = establishmentDateReference && (
      /\b(?:tract|property|site|development)\b[^.]{0,160}\b(?:must|needs? to|is required to)\b[^.]{0,80}\b(?:have been|be|exist(?:ed)? as)\b[^.]{0,80}\b(?:a )?zoning[- ]lot\b[^.]{0,100}\b(?:on|at|as of)\s+(?:that|the applicable|the relevant|such)\s+(?:date|time)\b/i.test(narrative) ||
      /\b(?:tract|property|site|development)\b[^.]{0,160}\b(?:already )?existed as\b[^.]{0,60}\b(?:a )?zoning[- ]lot\b[^.]{0,100}\b(?:on|at|as of)\s+(?:that|the applicable|the relevant|such)\s+(?:date|time)\b/i.test(narrative) ||
      /\bzoning[- ]lot\b[^.]{0,100}\b(?:on|at|as of)\s+(?:that|the applicable|the relevant|such)\s+(?:date|time)\b[^.]{0,100}\b(?:must be|remains?)\b[^.]{0,60}\b(?:established|verified|confirmed|unresolved)\b/i.test(narrative)
    );
    const numericalOnlyBoundary =
      /\b(?:numerical|unit|dwelling[- ]unit|floor[- ]area|threshold)\b[^.]{0,180}\b(?:not enough|not sufficient|(?:does|do) not (?:establish|prove)|alone (?:does|do) not|alone cannot)\b/i.test(narrative) ||
      /\b(?:not enough|not sufficient|(?:does|do) not (?:establish|prove)|alone (?:does|do) not|alone cannot)\b[^.]{0,180}\b(?:numerical|unit|dwelling[- ]unit|floor[- ]area|threshold)\b/i.test(narrative) ||
      conditionalHistoricalGrant;
    const unresolvedHistoricalLot =
      /\bzoning[- ]lot\b[^.]{0,180}\b(?:not established|cannot be (?:determined|established|confirmed)|unknown|unresolved|must be (?:verified|established)|requires? (?:verification|evidence))\b/i.test(narrative) ||
      /\b(?:not established|cannot be (?:determined|established|confirmed)|unknown|unresolved|must be (?:verified|established)|requires? (?:verification|evidence))\b[^.]{0,180}\bzoning[- ]lot\b/i.test(narrative) ||
      conditionalHistoricalGrant;
    if (
      ((bareCategoricalGrant || directNamedGrant || narrativeCategoricalGrant) && unresolvedHistoricalLot) ||
      (narrativeCategoricalGrant && !numericalOnlyBoundary) ||
      (bareCategoricalDenial && unresolvedHistoricalLot) ||
      (directNamedDenial && unresolvedHistoricalLot) ||
      (narrativeCategoricalDenial && unresolvedHistoricalLot)
    ) {
      issues.push({
        type: "zoning_mih_numerical_only_conclusion",
        detail: "Do not grant or deny the MIH small-development exception while relying only on the unit and floor-area thresholds or while the historical zoning-lot element remains unresolved."
      });
    }
    const historicalLotRequirement =
      /\bzoning[- ]lot\b[^.]{0,220}\b(?:existed|existence)\b[^.]{0,160}\b(?:MIH|Mandatory Inclusionary Housing|area)[- ]?\b[^.]{0,120}\b(?:establish|establishment|effective)\b/i.test(narrative) ||
      /\b(?:MIH|Mandatory Inclusionary Housing|area)[- ]?\b[^.]{0,160}\b(?:establish|establishment|effective)\b[^.]{0,220}\bzoning[- ]lot\b[^.]{0,100}\b(?:existed|existence)\b/i.test(narrative) ||
      conditionalHistoricalLotRequirement ||
      referentialHistoricalLotRequirement;
    const laterTaxLotEvent =
      /\btax[- ]lots?\b[^.]{0,160}\b(?:combin|current|later|change|2025)\w*/i.test(narrative) ||
      /\b(?:combination|combined|current|later|change|2025)\b[^.]{0,160}\btax[- ]lots?\b/i.test(narrative);
    const referentialTaxLotDistinction = laterTaxLotEvent &&
      /\b(?:that|this|the)\s+(?:later\s+)?(?:event|combination|change|action)\b[^.]{0,160}\b(?:does not|cannot|is not enough to)\b[^.]{0,80}\b(?:prove|establish|show)\b[^.]{0,160}\bzoning[- ]lot\b/i.test(narrative);
    const taxLotDistinction =
      /\btax[- ]lots?\b[^.]{0,180}\b(?:not necessarily (?:the )?same|may differ|does not (?:establish|prove)|not proof|may or may not coincide)\b[^.]{0,120}\bzoning[- ]lot\b/i.test(narrative) ||
      /\bzoning[- ]lot\b[^.]{0,180}\b(?:not necessarily (?:the )?same|may differ|does not (?:necessarily )?(?:match|coincide)|may or may not coincide)\b[^.]{0,120}\btax[- ]lots?\b/i.test(narrative) ||
      referentialTaxLotDistinction;
    if (!historicalLotRequirement || !taxLotDistinction) {
      issues.push({
        type: "zoning_mih_historical_lot_requirement",
        detail: "State the separate requirement that the zoning lot existed on the applicable MIH-area establishment date, and distinguish that zoning lot from current tax lots or a later tax-lot combination."
      });
    }
    const officialEstablishmentDate =
      /\b(?:official|verify|verified|record|historical)\b[^.]{0,180}\b(?:MIH|Mandatory Inclusionary Housing)\b[^.]{0,120}\b(?:establishment|effective) date\b/i.test(evidenceNeeded) ||
      /\b(?:MIH|Mandatory Inclusionary Housing)\b[^.]{0,180}\b(?:establishment|effective) date\b[^.]{0,120}\b(?:official|verify|verified|record|historical)\b/i.test(evidenceNeeded) ||
      /\b(?:enacted|official|historical)\b[^.]{0,120}\b(?:MIH|Mandatory Inclusionary Housing)\b[^.]{0,160}\b(?:establishment amendment|effective date)\b/i.test(evidenceNeeded);
    const officialHistoricalLot = evidenceNeededItems.some((item) =>
      item.split(/(?:[.!?;]\s+|,\s+(?:and\s+(?:obtain|review|use|rely)\b|not\b)|\s+(?:while|whereas|but)\s+|\s+(?:and|with)\s+(?=(?:an?\s+|the\s+)?current\b))/i).some((clause) =>
        /\b(?:title(?: report| records?)?|chain of title|deed(?: records?| chain)?|survey(?: records?)?|declaration(?: of restrictions)?|legal description|metes and bounds|ownership (?:history|records?)|configuration (?:history|records?))\b/i.test(clause) &&
        /\b(?:historic|historical|dated|establishment date|as[- ]of|on (?:that|the applicable|the relevant) date|(?:19|20)\d{2})\b/i.test(clause) &&
        /\b(?:zoning[- ]lot|tax[- ]lot|tract|property|site|parcel)\b/i.test(clause)
      )
    );
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
  const answerDateMentions = calendarDateMentions(narrative);
  const missingQuestionDates = profile.categories.includes("effective-date")
    ? profile.questionDateMentions.filter((questionDate) =>
        !answerDateMentions.some((answerDate) =>
          answerDate.key === questionDate.key &&
          calendarDateRelationCompatible(questionDate.relation, answerDate.relation) &&
          (
            !questionDate.eventClasses.length ||
            questionDate.eventClasses.some((eventClass) =>
              answerDate.eventClasses.includes(eventClass)
            )
          )
        )
      ).map((mention) => mention.raw)
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
    ...(issues.some((issue) => issue.type === "zoning_missing_mapped_location")
      ? { attemptDiagnostic: mappedLocationDiagnostic }
      : {}),
    issues
  };
}

export function applyZoningResearchDeterministicRepairs(answer, evidence = [], { question = "" } = {}) {
  if (!answer || typeof answer !== "object") return answer;
  const profile = riskProfile({ question, evidence });
  const narrative = answerText(answer);
  const appendParagraph = (value, paragraph) => {
    const text = String(value || "").trim();
    return text ? `${text}\n\n${paragraph}` : paragraph;
  };
  let repaired = answer;
  const historicalTextVerification =
    /\b(?:verify|review|retrieve|obtain|need|require|must)\b[^.]{0,220}\b(?:historical|archived|prior|pre[- ](?:amendment|city of yes|december))\b[^.]{0,120}\b(?:zoning|text|rules?|provisions?)\b/i.test(narrative) ||
    /\b(?:historical|archived|prior|pre[- ](?:amendment|city of yes|december))\b[^.]{0,120}\b(?:zoning|text|rules?|provisions?)\b[^.]{0,180}\b(?:verify|review|retrieve|obtain|need|required?|must)\b/i.test(narrative);
  if (profile.categories.includes("historical-substantive-text") && !historicalTextVerification) {
    const limitation = "The current transition provision may preserve prior rules but does not reproduce their substantive requirements.";
    const needed = "Verify the dated enacted or official archived pre-amendment Zoning text to determine the substantive rules preserved for the project.";
    repaired = {
      ...repaired,
      answerText: appendParagraph(repaired.answerText, `${limitation} ${needed}`),
      ...(typeof repaired.explanation === "string"
        ? { explanation: appendParagraph(repaired.explanation, `${limitation} ${needed}`) }
        : {}),
      evidenceLimitations: unique([...(repaired.evidenceLimitations || []), limitation]),
      additionalEvidenceNeeded: unique([...(repaired.additionalEvidenceNeeded || []), needed])
    };
  }
  const loweredYardMissingFact = "Whether the relevant yard was lowered after December 5, 1990 remains unknown and must be verified.";
  const existingMissingFacts = Array.isArray(repaired.missingFacts) ? repaired.missingFacts : [];
  const repairDirectAnswerFields = [repaired?.answerText, repaired?.conclusion]
    .map(compactText)
    .filter(Boolean);
  const narrativeRecognizesLoweredYardBoundary = repairDirectAnswerFields.length > 0 &&
    repairDirectAnswerFields.some(statesLoweredYardBoundary) &&
    !statesUnconditionalCellarClassification(answerText(repaired));
  if (
    profile.loweredYardClause &&
    narrativeRecognizesLoweredYardBoundary &&
    !/\b(?:lowered yard|yard (?:was|is|had been) lowered)\b[^.]{0,180}\b(?:unknown|not (?:provided|established|verified)|missing|unresolved|must be (?:confirmed|verified|established))\b/i.test(compactText(existingMissingFacts.join(" ")))
  ) {
    repaired = {
      ...repaired,
      missingFacts: unique([...existingMissingFacts, loweredYardMissingFact])
    };
  }
  return repaired;
}

export function zoningResearchSafetyRevisionIssues(result) {
  return Array.isArray(result?.issues) ? result.issues : [];
}
