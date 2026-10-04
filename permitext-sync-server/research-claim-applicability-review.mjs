import { createHash } from "node:crypto";
import { researchFactQualification } from "./research-fact-qualification.mjs";

export const researchClaimApplicabilityVersion = "20261004-claim-applicability-v2";
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const text = (value) => typeof value === "string" ? value : "";
const ids = (value) => [...new Set((Array.isArray(value) ? value : []).map(String))];
const modes = ["source_explanation", "conditional_application", "project_determination", "scenario_determination", "practical_recommendation"];
const states = ["established", "excluded", "unresolved", "not_material_to_this_claim"];
const unknown = /\b(?:unknown|uncertain|unsure|unconfirmed|unverified|undetermined|unresolved|unavailable|tbd)\b|\bnot\s+(?:yet\s+)?(?:been\s+)?(?:known|determined|verified|confirmed|provided|supplied|established|available|sure)\b|\bto be\s+(?:determined|confirmed|verified)\b/i;
const authorityFields = ["corpusID", "codePrefix", "codeEdition", "codeVersion"];
const sameAuthority = (left, right) => authorityFields.every((field) =>
  !left?.[field] && !right?.[field] || Boolean(left?.[field] && left[field] === right?.[field]));
const identity = (source) => Object.fromEntries(["sourceID", "sectionID", "sectionNumber", ...authorityFields]
  .map((field) => [field, source?.[field] ?? null]));

function evidenceIdentity(evidence) {
  return evidence.map((source) => ({ ...identity(source), textHash: hash(text(source.text)), textLength: text(source.text).length,
    // Explicit relations and gaps are immutable inputs too. Roles, titles and
    // proximity never manufacture an edge or a resolved project premise.
    chapterScopeContext: source.chapterScopeContext === true,
    anchorSourceIDs: source.anchorSourceIDs || [], anchorSectionIDs: source.anchorSectionIDs || [],
    applicabilityScopeAnchors: source.applicabilityScopeAnchors || [],
    chapterScopeContextGaps: source.chapterScopeContextGaps || [],
    parentScopeContextGaps: source.parentScopeContextGaps || [],
    enclosingOperativeParent: source.enclosingOperativeParent || null }));
}

function factLedger(question, options) {
  const records = [];
  const add = (statement, origin, status, currentTopic, key = null) => {
    if (!text(statement).trim()) return;
    const qualification = researchFactQualification(statement);
    const body = { statement, origin, status, currentTopic, key,
      hypothetical: status === "hypothetical" || qualification.hypothetical,
      qualified: status === "qualified" || qualification.qualified };
    records.push({ id: `fact_${hash(body).slice(0, 24)}`, ...body, statementHash: hash(statement) });
  };
  const context = options.applicabilityFactContext;
  const state = context?.conversationFactState;
  const scenarioActive = state?.turnKind === "hypothetical" || Boolean(state?.hypotheticalFacts?.length);
  add(question, "current_user", scenarioActive ? "hypothetical" : "current_statement", true);
  for (const statement of context?.projectFacts || options.projectContextFacts || []) {
    add(statement, "saved_project_user", unknown.test(statement) ? "unknown" : "qualified", false);
  }
  for (const statement of context?.propertyFacts || []) add(statement, "property_record", "context_only", false);
  if (state) {
    const qualifiedWording = new Set(options.conversationFactContext?.qualified || []);
    for (const [field, status] of [["establishedFacts", "established"], ["hypotheticalFacts", "hypothetical"], ["unknownFacts", "unknown"]]) {
      for (const fact of state[field] || []) {
        const wording = text(fact.sourceText);
        add(wording || text(fact.statement), "active_topic_user",
          !wording ? "unknown" : qualifiedWording.has(wording) ? "qualified" : status, true, fact.key || fact.id || null);
      }
    }
  } else {
    for (const [field, status] of [["established", "established"], ["hypothetical", "hypothetical"], ["qualified", "qualified"], ["unknown", "unknown"]]) {
      for (const statement of options.conversationFactContext?.[field] || []) add(statement, "active_topic_user", status, true);
    }
  }
  // Earlier human statements are review context, not current premises. The
  // active fact state above owns corrections, topic changes and scenarios.
  for (const message of (options.messages || []).slice(-8)) {
    if (message.role === "user" && text(message.question) !== question)
      add(text(message.question || message.content), "earlier_user", "context_only", false);
  }
  return { scenarioActive, currentTopicHash: hash(state?.activeRootTopic || context?.topicContext || null),
    historyHash: hash((options.messages || []).slice(-8).map((message) => ({ role: message.role,
      question: message.question ?? null, answerText: message.answer?.answerText ?? null }))),
    records: [...new Map(records.map((record) => [record.id, record])).values()] };
}

function claimSegments(value) {
  const segments = [], boundary = /(?<=[.!?])[ \t]+(?=[A-Z*#>_])|(?<=;)[ \t]+|,\s+(?=(?:but|whereas|while|however|and if)\b)|\n+/g;
  let start = 0;
  for (const match of value.matchAll(boundary)) {
    const end = match.index;
    if (value.slice(start, end).trim()) segments.push({ start, end });
    start = match.index + match[0].length;
  }
  if (value.slice(start).trim()) segments.push({ start, end: value.length });
  return segments;
}

function answerUnits(answer) {
  const cited = ids((answer.citations || []).flatMap((citation) => citation.sourceIDs || []));
  const units = [], seen = new Map();
  const add = (spans, sourceIDs) => {
    const key = hash([spans.map((span) => [span.parentText, span.start, span.end, span.text]), sourceIDs]);
    const fields = [...new Set(spans.map((span) => span.field))];
    const bindings = spans.map(({ text: wording, parentText: _parentText, ...span }) => ({ ...span, textHash: hash(wording) }));
    if (seen.has(key)) {
      const existing = seen.get(key); existing.fields = [...new Set([...existing.fields, ...fields])];
      existing.spans.push(...bindings); return;
    }
    const unit = { id: `unit_${units.length}`, fields, spans: bindings, textHash: hash(spans.map((span) => span.text)), sourceIDs };
    seen.set(key, unit); units.push(unit);
  };
  const narrative = text(answer.answerText);
  for (const field of ["answerText", "conclusion", "explanation"]) {
    const value = text(answer[field]);
    const occurrence = field !== "answerText" && value ? narrative.indexOf(value) : -1;
    const uniqueAlias = occurrence >= 0 && narrative.indexOf(value, occurrence + 1) === -1;
    for (const span of claimSegments(value)) {
      const wording = value.slice(span.start, span.end);
      // Compatibility summaries are aliases only when their entire field has
      // one exact narrative occurrence AND this segment is a complete primary
      // span. Partial/ambiguous/non-mirrored content remains a separate unit.
      const primaryStart = occurrence + span.start, primaryEnd = occurrence + span.end;
      const primary = uniqueAlias && units.find((unit) => unit.spans.some((binding) => binding.field === "answerText" &&
        binding.start === primaryStart && binding.end === primaryEnd && narrative.slice(primaryStart, primaryEnd) === wording));
      if (primary) {
        primary.fields = [...new Set([...primary.fields, field])];
        primary.spans.push({ field, ...span, textHash: hash(wording), primaryField: "answerText", primaryStart, primaryEnd });
      } else add([{ field, ...span, text: wording, parentText: value }], cited);
    }
  }
  for (const [index, point] of (answer.supportedPoints || []).entries()) {
    const heading = text(point.heading), explanation = text(point.explanation);
    const headingSpan = { field: `supportedPoints[${index}].heading`, start: 0, end: heading.length, text: heading, parentText: heading };
    const segments = claimSegments(explanation);
    if (!segments.length && heading.trim()) add([headingSpan], ids(point.sourceIDs));
    for (const span of segments) add([headingSpan, { field: `supportedPoints[${index}].explanation`, ...span,
      text: explanation.slice(span.start, span.end), parentText: explanation }], ids(point.sourceIDs));
  }
  const boundaries = ["assumptions", "missingFacts", "evidenceLimitations", "additionalEvidenceNeeded", "followUpQuestions"]
    .filter((field) => answer[field]?.length);
  if (boundaries.length) units.push({ id: `unit_${units.length}`, fields: boundaries,
    textHash: hash(boundaries.map((field) => [field, answer[field]])), sourceIDs: cited });
  return units;
}

export function buildResearchClaimApplicabilityPacket({ question = "", answer = {}, evidence = [], options = {}, maximumOutputTokens = 8000 } = {}) {
  const preflightReasons = new Set();
  const sources = evidenceIdentity(evidence), byID = new Map(evidence.map((source) => [source.sourceID, source]));
  if (byID.size !== evidence.length || sources.some((source) => !source.sourceID || !source.textHash)) preflightReasons.add("source_identity");
  const graph = [], edgeKeys = new Set();
  const addEdge = (anchor, scope, kind, gap = null) => {
    if (!byID.has(anchor?.sourceID) || scope && (!byID.has(scope.sourceID) || !sameAuthority(anchor, scope))) {
      preflightReasons.add("scope_identity"); return;
    }
    const body = { kind, anchorSourceID: anchor.sourceID, scopeSourceID: scope?.sourceID || null,
      scopeIdentity: scope ? identity(scope) : gap?.identity || null,
      gap: gap ? { reference: gap.reference || null, reason: gap.reason || "scope_unavailable" } : null };
    const key = hash(body);
    if (!edgeKeys.has(key)) { edgeKeys.add(key); graph.push({ id: `scope_${graph.length}`, ...body }); }
  };
  for (const source of evidence) {
    if (source.chapterScopeContext) {
      for (const sourceID of ids(source.anchorSourceIDs)) addEdge(byID.get(sourceID), source, "chapter_scope");
      if (!(source.anchorSourceIDs || []).length && (source.anchorSectionIDs || []).length) {
        for (const sectionID of ids(source.anchorSectionIDs)) {
          const anchors = evidence.filter((item) => String(item.sectionID) === sectionID && sameAuthority(item, source));
          if (!anchors.length) preflightReasons.add("scope_identity");
          anchors.forEach((anchor) => addEdge(anchor, source, "chapter_scope"));
        }
      }
    }
    for (const anchor of source.applicabilityScopeAnchors || []) addEdge(byID.get(anchor.sourceID), source, "parent_scope");
    if (source.enclosingOperativeParent && !(source.applicabilityScopeAnchors || []).length) {
      const anchors = evidence.filter((item) => String(item.sectionID) === String(source.enclosingOperativeParent.childSectionID) && sameAuthority(item, source));
      if (!anchors.length) preflightReasons.add("scope_identity");
      anchors.forEach((anchor) => addEdge(anchor, source, "parent_scope"));
    }
    for (const [field, kind] of [["chapterScopeContextGaps", "chapter_scope"], ["parentScopeContextGaps", "parent_scope"]]) {
      for (const gap of source[field] || []) addEdge(source, null, kind, gap);
    }
  }
  const units = answerUnits(answer);
  if (!units.length) preflightReasons.add("unit_coverage");
  const edges = [], edgeMap = new Map();
  const requireEdge = (key, body, unit) => {
    if (!edgeMap.has(key)) {
      const edge = { id: `edge_${edges.length}`, ...body, unitIDs: [] };
      edgeMap.set(key, edge); edges.push(edge);
    }
    const edge = edgeMap.get(key); edge.unitIDs.push(unit.id); unit.edgeIDs.push(edge.id);
  };
  for (const unit of units) {
    if (unit.sourceIDs.some((id) => !byID.has(id))) preflightReasons.add("source_binding");
    const reachable = new Set(unit.sourceIDs), scoped = new Set(); unit.edgeIDs = [];
    // Explicit parent/chapter chains only; no prefix/title/retrieval inference.
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of graph) if (reachable.has(edge.anchorSourceID) && !scoped.has(edge.id)) {
        scoped.add(edge.id); changed = true;
        if (edge.scopeSourceID) reachable.add(edge.scopeSourceID);
      }
    }
    for (const sourceID of unit.sourceIDs) requireEdge(`source:${sourceID}`, { kind: "source_scope",
      anchorSourceID: sourceID, scopeSourceID: sourceID, scopeIdentity: identity(byID.get(sourceID)), gap: null }, unit);
    for (const edge of graph.filter((edge) => scoped.has(edge.id))) {
      const { id: _id, ...body } = edge; requireEdge(`scope:${edge.id}`, body, unit);
    }
  }
  for (const unit of units) unit.maximumClaimQuoteLength = Math.max(0, ...unitClaimTexts(unit, answer).map(value => value.length));
  const bindingCount = units.reduce((count, unit) => count + unit.edgeIDs.length, 0);
  const facts = factLedger(question, options);
  // Reserve response room under the existing verifier cap. Never truncate
  // units/edges/facts or return null to turn a large packet into a bypass.
  // Repeated dispositions can group their unit indices while preserving exact
  // coverage. This estimate reserves shared quote/relation rows, complete unit
  // records, and binding indices under the unchanged output cap. It is a
  // preflight estimate, not a guarantee about provider reasoning consumption.
  const completeClaimQuoteTokens = units.reduce((count, unit) => count + Math.ceil(unit.maximumClaimQuoteLength / 3), 0);
  const estimatedReviewOutputTokens = 700 + units.length * 40 + edges.length * 160 + bindingCount * 24 + completeClaimQuoteTokens;
  if (units.length > 48 || edges.length > 64 || bindingCount > 180 || facts.records.length > 160 ||
      estimatedReviewOutputTokens > Math.floor(maximumOutputTokens * 0.75) || JSON.stringify(facts).length > 100_000) preflightReasons.add("packet_capacity");
  const body = { version: researchClaimApplicabilityVersion, answerHash: hash(answer), evidenceHash: hash(sources),
    factsHash: hash(facts), sources, facts, units, graph, edges, bindingCount, estimatedReviewOutputTokens,
    preflightReasons: [...preflightReasons] };
  return { ...body, packetHash: hash(body) };
}

export const researchClaimApplicabilityInstruction = [
  "CLAIM APPLICABILITY REVIEW is mandatory. Read every exact unit span, heading and boundary field in PROPOSED ANSWER JSON with its complete parent/adjacent context. A primaryField alias shares its primary narrative context. Review every required unit and edge binding; source citations and retrieval roles do not establish applicability.",
  "Classify each unit's actual assertion. Independently set categoricalTarget to actual or scenario whenever any part applies a rule categorically or gives a positive/negative result for that project/scenario, even if assertedMode is explanation or practical. categoricalQuote must repeat the complete asserted unit span, never a selected condition or another sentence. Use none and an empty quote only without such a result. A categorical opening cannot borrow a later caveat. A direct Yes/No within an express hypothetical is a scenario result; it cannot transfer to the actual saved project.",
  "Extract each edge's exact material enacted scope predicates once in predicates[edgeID], with the supplied source ID/hash and unique exact quote (occurrence=null, or its zero-based repeated occurrence). Inspect operative source_scope text and supplied parent/chapter relations, not just titles or topics. Candidates need semantic materiality review; gaps have no enacted predicate and cannot be established.",
  "For each required binding choose exactly one witness: not_material with a specific short reason why that edge has no bearing on this claim; condition_preserved with the relevant predicateIndices and an exact answerQuote stating or preserving those conditions in this claim's parent context; or applied with one atomic outcome per relied-on predicate and its human factSpanIndices. A source description or an accurate conditional rule does not assert its predicates hold for the project and needs no human-fact payload. Conditions actually asserted satisfied/excluded need applied evidence. Never classify a categorical result as a mere condition to avoid its human premises. An independent supported duty/action can remain useful while an unrelated rule is conditional.",
  "For applied outcomes established/excluded, quote exact eligible current human facts once in factSpans, preserving subject, qualifications, negation, representations, hypothetical status and corrections; explain each entailment briefly. A real but irrelevant fact cannot establish scope. Unknowns, property records, earlier context and assistant claims cannot establish current premises. Asserted clauses embedded in a question may supply facts; a question or quoted law alone cannot invent a premise. Hypothetical facts support only their current scenario/conditional or bounded practical action, never an actual-project determination. Use unresolved when a premise is unknown rather than manufacturing support.",
  "Categorical actual/scenario results require every material binding to be applied and established with eligible relevant human facts; unresolved/excluded predicates or a condition-preserved witness cannot authorize that result. For descriptions and conditional applications, all material conditions must still be accurately represented in the answerQuote. Do not emit binding/unit aggregate states, source selection indices or repeated explanations: the server derives those. All ordinary substantive, citation, completeness, fact and scope checks remain mandatory. This witness is not proof of semantic entailment."
].join(" ");

const objectSchema = (properties) => ({ type: "object", additionalProperties: false, properties, required: Object.keys(properties) });
const referenceArray = { type: "array", maxItems: 64, items: { type: "integer", minimum: 0, maximum: 63 } };
function unitClaimTexts(unit, answer, parent = false) {
  const fieldText = (field) => {
    const point = /^supportedPoints\[(\d+)\]\.(heading|explanation)$/.exec(field);
    return point ? text(answer.supportedPoints?.[Number(point[1])]?.[point[2]]) : text(answer[field]);
  };
  if (unit.spans?.length) {
    return [...new Set(unit.spans.map(span => parent ? fieldText(span.field) : fieldText(span.field).slice(span.start, span.end)))];
  }
  return unit.fields.flatMap(field => Array.isArray(answer[field]) ? answer[field].map(text) : [text(answer[field])]).filter(Boolean);
}
export function researchClaimApplicabilitySchema(base, packet) {
  const span = (kind, source = null) => objectSchema({
    [kind === "source" ? "sourceID" : "factID"]: source ? { type: "string", enum: [source.sourceID] } : { type: "string" },
    [kind === "source" ? "textHash" : "statementHash"]: source ? { type: "string", enum: [source.textHash] } : { type: "string" },
    quote: { type: "string", minLength: 1, maxLength: 1500 }, occurrence: { type: ["integer", "null"], minimum: 0 }
  });
  const application = objectSchema({ predicateIndex: { type: "integer", minimum: 0, maximum: 63 },
    outcome: { type: "string", enum: ["established", "excluded", "unresolved"] }, factSpanIndices: referenceArray,
    reason: { type: "string", minLength: 1, maxLength: 160 } });
  const binding = { anyOf: [
    objectSchema({ treatment: { type: "string", enum: ["not_material"] }, reason: { type: "string", minLength: 1, maxLength: 160 } }),
    objectSchema({ treatment: { type: "string", enum: ["condition_preserved"] }, predicateIndices: referenceArray,
      answerQuote: { type: "string", minLength: 1, maxLength: 1500 } }),
    objectSchema({ treatment: { type: "string", enum: ["applied"] }, applications: { type: "array", minItems: 1, maxItems: 64, items: application } })
  ] };
  const predicates = objectSchema(Object.fromEntries(packet.edges.map(edge => [edge.id, { type: "array", maxItems: edge.gap ? 0 : 64,
    items: span("source", packet.sources.find(source => source.sourceID === edge.scopeSourceID)) }])));
  const units = objectSchema(Object.fromEntries(packet.units.map(unit => [unit.id, objectSchema({
    assertedMode: { type: "string", enum: modes }, categoricalTarget: { type: "string", enum: ["none", "actual", "scenario"] },
    categoricalQuote: { type: "string", maxLength: unit.maximumClaimQuoteLength },
    bindings: objectSchema(Object.fromEntries(unit.edgeIDs.map(edgeID => [edgeID, { $ref: "#/$defs/claimApplicabilityBinding" }])))
  })])));
  return { ...base, $defs: { ...base.$defs, claimApplicabilityBinding: binding }, properties: { ...base.properties, claimApplicabilityReview: objectSchema({
    packetHash: { type: "string", enum: [packet.packetHash] }, predicates,
    factSpans: { type: "array", maxItems: packet.facts.records.length ? 64 : 0, items: span("fact") }, units
  }) }, required: [...base.required, "claimApplicabilityReview"] };
}

const referenceKey = (span, kind) => hash([span?.[kind === "source" ? "sourceID" : "factID"],
  span?.[kind === "source" ? "textHash" : "statementHash"], span?.quote, span?.occurrence]);
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const boundedReason = value => typeof value === "string" && value.trim().length > 0 && value.length <= 160;
export function resolveResearchApplicabilityQuote(span, value, hashField, expectedHash) {
  if (span?.[hashField] !== expectedHash || typeof span.quote !== "string" || !span.quote.trim() || span.quote.length > 1500 ||
      span.occurrence !== null && (!Number.isSafeInteger(span.occurrence) || span.occurrence < 0)) return null;
  const matches = [];
  let start = value.indexOf(span.quote);
  while (start !== -1) { matches.push(start); start = value.indexOf(span.quote, start + 1); }
  if (!matches.length || span.occurrence === null && matches.length !== 1 || span.occurrence !== null && span.occurrence >= matches.length) return null;
  const index = matches[span.occurrence ?? 0];
  return { start: index, end: index + span.quote.length };
}
const aggregate = rows => rows.some(row => row.state === "unresolved") ? "unresolved" :
  rows.some(row => row.state === "excluded") ? "excluded" : rows.some(row => row.state === "established") ? "established" : "not_material_to_this_claim";
const validIndices = (indices, length) => Array.isArray(indices) && indices.length <= 64 && new Set(indices).size === indices.length &&
  indices.every(index => Number.isSafeInteger(index) && index >= 0 && index < length);

export function validateResearchClaimApplicabilityReview({ packet, value, question, answer, evidence = [], options = {}, verification } = {}) {
  const reasons = new Set(packet?.preflightReasons || []), affected = new Set();
  const current = buildResearchClaimApplicabilityPacket({ question, answer, evidence, options,
    maximumOutputTokens: options.maximumApplicabilityOutputTokens || 8000 });
  const { packetHash, ...packetBody } = packet || {};
  if (!packet || hash(packetBody) !== packetHash || current.packetHash !== packetHash) reasons.add("stale_packet");
  const review = value?.claimApplicabilityReview, units = packet?.units || [], edges = packet?.edges || [];
  const reject = (reason, unit = null) => { reasons.add(reason); if (unit) affected.add(unit.id); };
  if (!exactKeys(review, ["packetHash", "predicates", "factSpans", "units"]) || review?.packetHash !== packetHash) reject("review_hash");
  if (!exactKeys(review?.units, units.map(unit => unit.id))) reject("unit_coverage");
  if (!exactKeys(review?.predicates, edges.map(edge => edge.id))) reject("edge_coverage");
  const sources = new Map(evidence.map(source => [source.sourceID, source]));
  const facts = new Map((packet?.facts?.records || []).map(fact => [fact.id, fact]));
  const factSpans = Array.isArray(review?.factSpans) ? review.factSpans : [];
  if (!Array.isArray(review?.factSpans) || factSpans.length > 64) reject("fact_span");
  if (new Set(factSpans.map(span => referenceKey(span, "fact"))).size !== factSpans.length) reject("duplicate_reference");
  for (const span of factSpans) {
    const fact = facts.get(span?.factID);
    if (!exactKeys(span, ["factID", "statementHash", "quote", "occurrence"]) || !fact ||
        !resolveResearchApplicabilityQuote(span, fact.statement, "statementHash", fact.statementHash)) reject("fact_span");
  }
  let predicateReferenceCount = 0, reviewedBindingCount = 0;
  for (const edge of edges) {
    const predicates = review?.predicates?.[edge.id];
    if (!Array.isArray(predicates) || predicates.length > 64 || edge.gap && predicates.length) { reject("edge_shape"); continue; }
    predicateReferenceCount += predicates.length;
    if (new Set(predicates.map(span => referenceKey(span, "source"))).size !== predicates.length) reject("duplicate_reference");
    for (const span of predicates) {
      const source = sources.get(span?.sourceID);
      if (!exactKeys(span, ["sourceID", "textHash", "quote", "occurrence"]) || !source || span.sourceID !== edge.scopeSourceID ||
          !resolveResearchApplicabilityQuote(span, text(source.text), "textHash", hash(text(source.text)))) reject("source_span");
    }
  }
  const usedFacts = new Set(), allBindings = [], modeCounts = Object.fromEntries(modes.map(mode => [mode, 0]));
  for (const unit of units) {
    const row = review?.units?.[unit.id];
    if (!exactKeys(row, ["assertedMode", "categoricalTarget", "categoricalQuote", "bindings"]) || !modes.includes(row?.assertedMode) ||
        !["none", "actual", "scenario"].includes(row?.categoricalTarget)) { reject("unit_shape", unit); continue; }
    modeCounts[row.assertedMode]++;
    const categorical = row.categoricalTarget !== "none";
    if (categorical ? !unitClaimTexts(unit, answer).includes(row.categoricalQuote) : row.categoricalQuote !== "") reject("categorical_witness", unit);
    if (row.assertedMode === "project_determination" && row.categoricalTarget !== "actual" ||
        row.assertedMode === "scenario_determination" && row.categoricalTarget !== "scenario") reject("categorical_scope", unit);
    if (!exactKeys(row.bindings, unit.edgeIDs)) reject("binding_coverage", unit);
    const bindings = [];
    for (const edgeID of unit.edgeIDs) {
      const edge = edges.find(candidate => candidate.id === edgeID), binding = row.bindings?.[edgeID];
      const predicates = Array.isArray(review?.predicates?.[edgeID]) ? review.predicates[edgeID] : [];
      if (!edge) { reject("source_binding", unit); continue; }
      if (!binding) { reject("binding_coverage", unit); continue; }
      reviewedBindingCount++;
      let state;
      if (binding.treatment === "not_material") {
        if (!exactKeys(binding, ["treatment", "reason"]) || !boundedReason(binding.reason)) reject("binding_shape", unit);
        state = "not_material_to_this_claim";
      } else if (binding.treatment === "condition_preserved") {
        if (!exactKeys(binding, ["treatment", "predicateIndices", "answerQuote"]) || !validIndices(binding.predicateIndices, predicates.length) ||
            !edge.gap && !binding.predicateIndices?.length) reject("unbound_predicate", unit);
        if (typeof binding.answerQuote !== "string" || !binding.answerQuote.trim() || binding.answerQuote.length > 1500 ||
            !unitClaimTexts(unit, answer, true).some(parent => parent.includes(binding.answerQuote))) reject("condition_witness", unit);
        state = "unresolved";
      } else if (binding.treatment === "applied") {
        const applications = binding.applications;
        if (!exactKeys(binding, ["treatment", "applications"]) || !Array.isArray(applications) || !applications.length || applications.length > 64 || edge.gap) {
          reject("unbound_disposition", unit); state = "unresolved";
        } else {
          const atomStates = [];
          if (new Set(applications.map(atom => atom?.predicateIndex)).size !== applications.length) reject("duplicate_reference", unit);
          for (const atom of applications) {
            if (!exactKeys(atom, ["predicateIndex", "outcome", "factSpanIndices", "reason"]) || !validIndices([atom?.predicateIndex], predicates.length) ||
                !["established", "excluded", "unresolved"].includes(atom?.outcome) || !validIndices(atom?.factSpanIndices, factSpans.length) || !boundedReason(atom?.reason)) {
              reject("predicate_relation", unit); atomStates.push({ state: "unresolved" }); continue;
            }
            atomStates.push({ state: atom.outcome });
            if (["established", "excluded"].includes(atom.outcome) && !atom.factSpanIndices.length) reject("unbound_disposition", unit);
            if (atom.outcome === "unresolved" && atom.factSpanIndices.length) reject("irrelevant_fact_binding", unit);
            for (const index of atom.factSpanIndices) {
              usedFacts.add(index); const span = factSpans[index], fact = facts.get(span?.factID);
              if (!fact || !span || typeof span.quote !== "string") continue;
              if (["unknown", "context_only"].includes(fact.status) || unknown.test(span.quote) || /[?]/.test(span.quote) ||
                  fact.status === "current_statement" && /^(?:is|are|does|do|did|can|could|may|must|should|would|will|why|how|what|when|where|which)\b/i.test(span.quote.trim())) reject("ineligible_fact_status", unit);
              if ((fact.hypothetical || researchFactQualification(span.quote).hypothetical) &&
                  !(row.categoricalTarget === "scenario" || !categorical && ["conditional_application", "practical_recommendation"].includes(row.assertedMode))) reject("hypothetical_project_fact", unit);
            }
          }
          state = aggregate(atomStates);
        }
      } else { reject("binding_shape", unit); state = "unresolved"; }
      bindings.push({ edgeID, state, treatment: binding.treatment });
    }
    const state = aggregate(bindings); allBindings.push(...bindings);
    if (categorical && (state !== "established" || !bindings.some(binding => binding.state === "established" && edges.find(edge => edge.id === binding.edgeID)?.kind === "source_scope") ||
        bindings.some(binding => binding.state !== "not_material_to_this_claim" && binding.treatment !== "applied"))) reject("categorical_scope", unit);
  }
  if (usedFacts.size !== factSpans.length) reject("unused_fact_binding");
  const diagnostic = { version: researchClaimApplicabilityVersion, packetHash: packet?.packetHash || current.packetHash,
    answerHash: current.answerHash, evidenceHash: current.evidenceHash, factsHash: current.factsHash,
    pass: reasons.size === 0 && verification?.pass === true, unitCount: units.length, edgeCount: edges.length,
    bindingCount: packet?.bindingCount || 0, reviewedBindingCount, factCount: current.facts.records.length,
    predicateReferenceCount, factReferenceCount: factSpans.length, reasonCodes: [...reasons], modes: modeCounts,
    states: Object.fromEntries(states.map(state => [state, allBindings.filter(binding => binding.state === state).length])) };
  if (!reasons.size) return { ...verification, claimApplicabilityReview: diagnostic };
  const detail = `Required claim applicability review failed (${[...reasons].join(", ")}); affected units: ${[...affected].join(", ") || units.map(unit => unit.id).join(", ")}. ` +
    "Preserve supported descriptions, explicit conditional rules and independent bounded actions. Correct only unsupported application or the invalid witness; every supplied witness must be valid. Derived binding states: " + JSON.stringify(allBindings).slice(0, 2500);
  return { ...verification, pass: false, issues: [{ type: "fact_evidence_confusion", detail }, ...(verification?.issues || [])].slice(0, 12),
    projectFactQuestions: [], missingFactsOnly: false, unnecessaryMissingFactIndices: [], claimApplicabilityReview: diagnostic };
}
