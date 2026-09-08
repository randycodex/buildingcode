// Keep a source's existence-on-amendment condition separate from its
// application to the user's lot. These checks recognize bounded declarations
// and common application claims; they are not a general semantic verifier.
const compact = (value) => String(value || "").replace(/\s+/g, " ").trim();
const sentences = (value) => String(value || "").split(/(?<=[.!?])\s+|;\s*/).map(compact).filter(Boolean);
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const datePattern = String.raw`(?:\d{4}-\d{2}-\d{2}|(?:${monthNames.join("|")})\s+\d{1,2},?\s+\d{4}|(?:18|19|20)\d{2})`;

function dateRange(value) {
  if (/^\d{4}$/.test(value)) return [Date.UTC(Number(value), 0, 1), Date.UTC(Number(value), 11, 31)];
  let year, month, day;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) [, year, month, day] = iso.map(Number);
  else {
    const named = value.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (!named) return null;
    year = Number(named[3]); month = monthNames.findIndex((name) => name.toLowerCase() === named[1].toLowerCase()) + 1; day = Number(named[2]);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return [date.getTime(), date.getTime()];
}

function suppliedExistence(facts, uncertainty = []) {
  const uncertainStatements = [...sentences(facts), ...uncertainty.flatMap(sentences)].filter((text) =>
    /\b(?:unknown|unresolved|unverified|disputed|not (?:known|confirmed|established|verified))\b/i.test(text) &&
    /\b(?:date|amendment|existence|existed|formation|assembly)\b/i.test(text));
  const declarations = sentences(facts).filter((text) =>
    !/\?|\b(?:if|whether|unknown|unresolved|unverified|disputed|possibly|might|may|not (?:known|confirmed|established|verified))\b/i.test(text) &&
    !/^(?:["“]|under\b|according to\b|section\b|ZR\b|the (?:rule|provision|text)\b|when(?:ever)?\b|unless\b|provided\b)/i.test(text));
  const states = new Set(), grounds = [], formed = [], amended = [];
  for (const text of declarations) {
    const relation = text.match(/\b(?:this |the )?(?:zoning )?lot\s+(?:(?:was|has been)\s+)?(?:formed|assembled|created|established)\s+(before|after)\s+(?:the\s+)?(?:last\s+)?applicable(?:\s+subsequent)?\s+amendment\b/i);
    const existence = text.match(/\b(?:this |the )?(?:zoning )?lot\s+(did not exist|did exist|existed)\s+(?:on|at)\s+(?:the\s+)?(?:relevant\s+)?(?:effective(?:\s+or\s+amendment)?\s+date|applicable(?:\s+subsequent)?\s+amendment(?:\s+date)?)\b/i);
    if (relation || existence) {
      states.add(relation ? (relation[1].toLowerCase() === "after" ? "not-existing" : "existing") : (existence[1].toLowerCase() === "did not exist" ? "not-existing" : "existing"));
      grounds.push(text);
    }
    const formation = text.match(new RegExp(String.raw`\b(?:zoning\s+)?lot\s+(?:(?:was|has been)\s+)?(?:formed|assembled|created|established)\s+(?:on|in)\s+(${datePattern})\b`, "i"));
    const amendment = text.match(new RegExp(String.raw`\b(?:last\s+)?applicable(?:\s+subsequent)?\s+amendment(?:\s+date)?\s+(?:(?:was|is|occurred|took effect)\s+)?(?:(?:on|in)\s+)?(${datePattern})\b`, "i"));
    if (formation && dateRange(formation[1])) formed.push({ range: dateRange(formation[1]), text });
    if (amendment && dateRange(amendment[1])) amended.push({ range: dateRange(amendment[1]), text });
  }
  // Conflicting or overlapping dates remain unresolved. A year is an interval,
  // so two events in the same year do not establish their order.
  if (!uncertainStatements.length && formed.length && amended.length) for (const formation of formed) for (const amendment of amended) {
    states.add(formation.range[0] > amendment.range[1] ? "not-existing"
      : formation.range[1] <= amendment.range[0] ? "existing" : "unresolved");
    grounds.push(formation.text, amendment.text);
  }
  if (uncertainStatements.some((text) => /\b(?:existence|existed|did not exist)\b/i.test(text))) states.add("unresolved");
  return { status: states.size === 1 ? [...states][0] : "unresolved", groundingStatements: [...new Set(grounds)] };
}

export function zoningTemporalApplicationObligations({ question, evidence = [], facts = question, uncertainty = [] } = {}) {
  if (!/\b(?:zoning lot|divided lot|77-02|77-11)\b/i.test(question || "")) return [];
  const source = evidence.find((item) => item.codePrefix === "ZR" && item.sectionNumber === "77-02" &&
    (item.evidencePriority?.evidenceRole || item.evidenceRole) === "governing" &&
    /zoning lot did not exist on [^.]+applicable subsequent amendment[^.]+each portion[^.]+shall be regulated/i.test(compact(item.text)));
  if (!source) return [];
  const optionSource = evidence.find((item) => item.codePrefix === "ZR" && item.sectionNumber === "77-11" &&
    (item.evidencePriority?.evidenceRole || item.evidenceRole) === "governing" &&
    /zoning lot existing on [^.]+applicable subsequent amendment/i.test(compact(item.text)));
  const condition = suppliedExistence(facts, uncertainty);
  return [{
    id: "divided_lot_effective_date_application", kind: "temporal_application", values: [],
    sourceIDs: [source.sourceID, optionSource?.sourceID].filter(Boolean), requireAllValues: false,
    detail: "Section 77-02 regulates portions separately when the lot did not exist on the applicable effective or amendment date. Keep each application claim conditional unless supplied facts establish that condition; reciting the rule in another sentence does not establish it. A formation year alone does not identify an applicable amendment date or disqualify a lot from Section 77-11 on existence-date grounds.",
    temporalApplication: { sectionNumber: "77-02", sourceID: source.sourceID, ...condition }
  }];
}

function isApplicationClaim(text, boundToRule) {
  if (/\b77-11\b/.test(text) && (
    /\b(?:assembly|formation|creation)\b\s+(?:(?:therefore|thus|consequently)\s+)?(?:does not qualify|cannot qualify|is ineligible|does not meet)\b/i.test(text) ||
    /\b(?:does not qualify|cannot qualify|is ineligible)\b[^.;]{0,100}\b(?:because|due to|on account of)\b[^.;]{0,80}\b(?:formed|assembled|created|formation|assembly|creation)\b/i.test(text)
  )) return true;
  if (/\b(?:77-02\s+(?:therefore\s+)?(?:applies|governs|controls)|(?:apply|applying|under)\s+(?:Section\s+)?77-02)\b/i.test(text)) return true;
  if (!boundToRule && !/\b77-02\b/.test(text)) return false;
  return /\b(?:this|that)\s+is\s+the\s+(?:applicable|governing|controlling)\b|\b(?:each|every)\s+(?:portion|part)\b[^.;]{0,100}\b(?:regulated|governed|follow|follows|must|subject to)\b|\bportion[- ]by[- ]portion\b/i.test(text);
}

function isConditionalOrNegative(text) {
  // Do not let a quoted rule or a disclaimer in a preceding sentence qualify
  // a subsequent definitive application. A clause after "but" stands alone.
  const conditional = /\b(?:if|when|whenever|where|provided|assuming|unless|subject to|depends on|depending on|absent facts|for (?:a|the|any|those|such))\b/i.test(text);
  const dateCondition = /\b(?:date|amendment|temporal|existence)\b/i.test(text) &&
    /\b(?:did not exist|not in existence|not yet|after|postdates?|unresolved|verify|verifying|confirm|confirming|check|checking|whether|condition|establishing)\b/i.test(text);
  return (conditional && dateCondition) || /\bgenerally\b/i.test(text) ||
    /\b(?:cannot|can't|not enough|insufficient|not established|unresolved|whether)\b/i.test(text) ||
    /\b(?:does not|doesn't|do not|don't)\s+(?:mean|establish|show|prove|apply|govern|control)\b/i.test(text) ||
    /\b(?:verify|confirm|establish|check)\b[^.;]{0,100}\b(?:date|existen|amendment)\b/i.test(text);
}

export function zoningTemporalApplicationIssues({ obligation, answer = {} } = {}) {
  const condition = obligation?.temporalApplication;
  if (!condition || condition.status === "not-existing") return [];
  const governingIDs = new Set([condition.sourceID]);
  const units = ["answerText", "conclusion", "explanation"].map((field) => ({ field, text: answer[field], bound: false }));
  for (const [index, point] of (answer.supportedPoints || []).entries()) {
    units.push({ field: `supportedPoints[${index}]`, text: `${point.heading || ""}. ${point.explanation || ""}`,
      bound: (point.sourceIDs || []).some((id) => governingIDs.has(id)) });
  }
  const failures = [];
  for (const unit of units) {
    // Main-answer prose can name its controlling section in another sentence.
    const bound = unit.bound || !unit.field.startsWith("supportedPoints") || /\b77-02\b/.test(unit.text || "");
    for (const sentence of sentences(unit.text)) for (const clause of sentence.split(/\b(?:but|however|nevertheless)\b[,:]?\s*/i)) {
      if (!isApplicationClaim(clause, bound) || isConditionalOrNegative(clause)) continue;
      // A heading is interpreted with its explanation, but must not make a
      // separate project claim. The explanation is still checked sentencewise.
      if (unit.field.startsWith("supportedPoints") && sentence === sentences(unit.text)[0] &&
          !/\b(?:this|stated|your|our|proposed)\b/i.test(sentence)) continue;
      failures.push({
        code: condition.status === "existing" ? "TEMPORAL_APPLICATION_CONTRADICTS_FACTS" : "TEMPORAL_APPLICATION_NOT_ESTABLISHED",
        obligationID: obligation.id, sourceIDs: obligation.sourceIDs, field: unit.field,
        detail: `${obligation.detail} Supplied date condition: ${condition.status}. The claim in ${unit.field} selects the non-existing-lot branch without establishing its date condition.`
      });
      break;
    }
  }
  return failures;
}
