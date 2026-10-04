import { createHash } from "node:crypto";
import { researchFactQualification } from "./research-fact-qualification.mjs";

export const researchClaimApplicabilityVersion = "20261004-claim-applicability-v1";
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
  const bindingCount = units.reduce((count, unit) => count + unit.edgeIDs.length, 0);
  const facts = factLedger(question, options);
  // Reserve response room under the existing verifier cap. Never truncate
  // units/edges/facts or return null to turn a large packet into a bypass.
  // Repeated dispositions can group their unit indices while preserving exact
  // coverage. This estimate reserves shared quote/relation rows, complete unit
  // records, and binding indices under the unchanged output cap. It is a
  // preflight estimate, not a guarantee about provider reasoning consumption.
  const estimatedReviewOutputTokens = 700 + units.length * 40 + edges.length * 160 + bindingCount * 12;
  if (units.length > 48 || edges.length > 64 || bindingCount > 180 || facts.records.length > 160 ||
      estimatedReviewOutputTokens > Math.floor(maximumOutputTokens * 0.75) || JSON.stringify(facts).length > 100_000) preflightReasons.add("packet_capacity");
  const body = { version: researchClaimApplicabilityVersion, answerHash: hash(answer), evidenceHash: hash(sources),
    factsHash: hash(facts), sources, facts, units, graph, edges, bindingCount, estimatedReviewOutputTokens,
    preflightReasons: [...preflightReasons] };
  return { ...body, packetHash: hash(body) };
}

export const researchClaimApplicabilityInstruction = "CLAIM APPLICABILITY REVIEW is mandatory. Read EVERY exact unit span in PROPOSED ANSWER JSON, including its heading. Read the COMPLETE parent field and adjacent units as context for pronouns, conditions, openings, caveats and examples; classify the actual claim in this span, not an unrelated claim elsewhere. Spans cover every sentence/clause/line and retain exact offsets; spans may share a unit only when their complete parent text, offsets, exact span text and source bindings are identical. Repeated short text in different positions or parent contexts stays distinct. A compatibility span with primaryField/primaryStart/primaryEnd is an exact server-bound alias of that complete primary narrative span; use the complete primary field as its context. Whole compatibility-field occurrence must be unique, and partial or ambiguous summaries remain distinct units. Boundary-array units cover their whole listed fields. A categorical opener remains its own determination even if a later unit adds a caveat. Direct independent duties and explicitly conditional alternatives in different spans keep separate applicability findings. Source citations, metadata, retrieval roles and a public-place or inventory fact do not establish a different legal scope predicate. Return the exact packetHash and every unit and edge exactly once. Edge predicates and human fact quotes are extracted once for the shared edge; unitFindings must cover EVERY listed edge.unitID exactly once using unitIndices into packet.units, that claim's state, relevant predicateIndices and a short reason. Group multiple unitIndices in one finding ONLY when their state, predicateIndices and reason are identical; use a specific common materiality reason for each group. This compact grouping never merges different claims or permits missing/duplicate unit coverage. Scope materiality and categorical application are decided separately for each unit; sharing a source quote never shares a positive verdict across claims. assertedMode is project_determination if ANY portion of this span categorically applies a rule or states a positive/negative result for the actual project beyond the expressly supplied scenario; a later caveat cannot convert that unit to conditional_application. A practical_recommendation must be a bounded supported action without a categorical compliance or applicability finding. For each supplied edge, extract ALL material applicability predicates from the exact enacted text using sourceID, textHash and an exact quote. Use occurrence=null for a unique quote; if the quote repeats, specify its zero-based occurrence. The server computes exact offsets; never estimate character counts. Each predicate has its own state and factSpanIndices referencing that edge's factSpans; the same exact source quote may have distinct state/fact relations for different actual or stipulated scenarios, so list those relations separately and select only the applicable one per unit. Do not duplicate an identical quote/state/fact relation; every established/excluded predicate needs its own human-fact relation and reason. Each edge unitFinding state must aggregate its selected predicate states (unresolved first, then excluded, otherwise established); a claim to which the edge has no material predicate is not_material_to_this_claim with predicateIndices=[]. For source_scope, inspect that exact scopeSourceID without treating its topic as a condition. Do not omit a condition because its operative citation is correct. Disposition each edge FOR EACH listed unit as established, excluded, unresolved, or not_material_to_this_claim. Establishment/exclusion requires exact human fact statement quotes, their hashes and a reason connecting those spans to EACH predicate; a bare real but irrelevant fact ID is insufficient. Preserve negation, limited/approximate facts, active hypothetical status and current corrections. Prior assistant statements are not facts or authority. Earlier user context, unknowns and property records cannot establish current human project premises; active-topic user wording and saved project facts may support only their actual stated subject/status. Current user spans must assert facts, not quote a law, ask a question, or invent a premise. Hypothetical premises support conditional_application or scenario_determination, never transfer to the saved actual project. A direct Yes/No applying a rule to an expressly stipulated scenario is scenario_determination even without repeating if/assume; the question supplies the scenario scope, but ALL material applicability predicates for that result must be established within it. An unresolved scope still requires a conditional_application with that affected rule's unresolved condition explicit in the prose; a hypothetical label cannot excuse an unqualified result. Factual premises embedded in a question may be bound by their exact asserted clause spans; interrogative wording elsewhere does not invalidate them. For source_scope, review conditions within that source as well as enclosing chapter/parent edges. Supplied relations nominate candidates; read their actual predicates to decide materiality. A gap cannot be established or excluded without its enacted text. not_material_to_this_claim needs a specific reason why this edge has no bearing on this unit claim in its full parent context (for example an independent duty), not a claim that scope is automatically satisfied. Source explanations and conditional applications may preserve a genuine unresolved scope; an excluded rule may be explained as excluded but cannot authorize a categorical application. Unit applicabilityState must aggregate ALL of that unit's material edge unitFinding states (unresolved first, then excluded, otherwise established, or not_material_to_this_claim if none). Project and scenario determinations require established material source predicates and current human fact support; unresolved/excluded categorical application must fail even when ordinary citations are correct. Keep supported independent rules/actions during bounded repair. Ordinary substantive, citation, completeness, fact and scope gates remain in force. This structured review is not proof of semantic entailment.";

export function researchClaimApplicabilitySchema(base, packet) {
  const span = (kind) => ({ type: "object", additionalProperties: false, properties: {
    [kind === "source" ? "sourceID" : "factID"]: { type: "string" },
    [kind === "source" ? "textHash" : "statementHash"]: { type: "string" },
    quote: { type: "string", minLength: 1, maxLength: 1500 }, occurrence: { type: ["integer", "null"], minimum: 0 }
  }, required: [kind === "source" ? "sourceID" : "factID", kind === "source" ? "textHash" : "statementHash", "quote", "occurrence"] });
  const sourceSpan = span("source");
  return { ...base, properties: { ...base.properties, claimApplicabilityReview: {
    type: "object", additionalProperties: false, properties: {
      packetHash: { type: "string", enum: [packet.packetHash] },
      units: { type: "array", minItems: packet.units.length, maxItems: packet.units.length, items: {
        type: "object", additionalProperties: false, properties: {
          unitID: { type: "string" },
          assertedMode: { type: "string", enum: modes }, applicabilityState: { type: "string", enum: states },
          sourceIndices: { type: "array", items: { type: "integer", minimum: 0 } }, reason: { type: "string", maxLength: 160 }
        }, required: ["unitID", "assertedMode", "applicabilityState", "sourceIndices", "reason"] } },
      edges: { type: "array", minItems: packet.edges.length, maxItems: packet.edges.length, items: {
        type: "object", additionalProperties: false, properties: {
          edgeID: { type: "string" },
          predicates: { type: "array", maxItems: 64, items: { ...sourceSpan, properties: { ...sourceSpan.properties,
            state: { type: "string", enum: states },
            factSpanIndices: { type: "array", maxItems: 64, items: { type: "integer", minimum: 0, maximum: 63 } },
            reason: { type: "string", maxLength: 160 }
          }, required: [...sourceSpan.required, "state", "factSpanIndices", "reason"] } },
          factSpans: { type: "array", maxItems: 64, items: span("fact") },
          unitFindings: { type: "array", maxItems: packet.units.length, items: { type: "object", additionalProperties: false, properties: {
            unitIndices: { type: "array", minItems: 1, maxItems: Math.max(1, packet.units.length), items: { type: "integer", minimum: 0 } }, state: { type: "string", enum: states },
            predicateIndices: { type: "array", maxItems: 64, items: { type: "integer", minimum: 0, maximum: 63 } },
            reason: { type: "string", maxLength: 160 }
          }, required: ["unitIndices", "state", "predicateIndices", "reason"] } }
        }, required: ["edgeID", "predicates", "factSpans", "unitFindings"] } }
    }, required: ["packetHash", "units", "edges"]
  } }, required: [...base.required, "claimApplicabilityReview"] };
}

const referenceKey = (span, kind) => hash([span?.[kind === "source" ? "sourceID" : "factID"],
  span?.[kind === "source" ? "textHash" : "statementHash"], span?.quote, span?.occurrence]);
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const boundedReason = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 160;
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
const aggregate = (edges) => edges.some((edge) => edge?.state === "unresolved") ? "unresolved" :
  edges.some((edge) => edge?.state === "excluded") ? "excluded" :
    edges.some((edge) => edge?.state === "established") ? "established" : "not_material_to_this_claim";

export function validateResearchClaimApplicabilityReview({ packet, value, question, answer, evidence = [], options = {}, verification } = {}) {
  const reasons = new Set(packet?.preflightReasons || []), affected = new Set();
  const current = buildResearchClaimApplicabilityPacket({ question, answer, evidence, options,
    maximumOutputTokens: options.maximumApplicabilityOutputTokens || 8000 });
  const { packetHash, ...packetBody } = packet || {};
  if (!packet || hash(packetBody) !== packetHash || current.packetHash !== packetHash) reasons.add("stale_packet");
  const review = value?.claimApplicabilityReview;
  if (!exactKeys(review, ["packetHash", "units", "edges"]) || review?.packetHash !== packet?.packetHash) reasons.add("review_hash");
  const units = new Map((packet?.units || []).map((unit) => [unit.id, unit]));
  const edges = new Map((packet?.edges || []).map((edge) => [edge.id, edge]));
  const records = Array.isArray(review?.units) ? review.units : [], findings = Array.isArray(review?.edges) ? review.edges : [];
  if (records.length !== units.size || new Set(records.map((row) => row?.unitID)).size !== units.size || records.some((row) => !units.has(row?.unitID))) reasons.add("unit_coverage");
  if (findings.length !== edges.size || new Set(findings.map((row) => row?.edgeID)).size !== edges.size || findings.some((row) => !edges.has(row?.edgeID))) reasons.add("edge_coverage");
  const sources = new Map(evidence.map((source) => [source.sourceID, source]));
  const facts = new Map((packet?.facts?.records || []).map((fact) => [fact.id, fact]));
  const recordByID = new Map(records.map((row) => [row?.unitID, row]));
  const perUnit = new Map([...units.keys()].map((id) => [id, []]));
  let predicateReferenceCount = 0, factReferenceCount = 0, reviewedBindingCount = 0;
  for (const finding of findings) {
    const edge = edges.get(finding?.edgeID);
    if (!edge) continue;
    const reject = (reason, unitID = null) => { reasons.add(reason); (unitID ? [unitID] : edge.unitIDs).forEach((id) => affected.add(id)); };
    if (!exactKeys(finding, ["edgeID", "predicates", "factSpans", "unitFindings"]) || !Array.isArray(finding.predicates) || !Array.isArray(finding.factSpans) ||
        !Array.isArray(finding.unitFindings) || finding.predicates.length > 64 || finding.factSpans.length > 64) { reject("edge_shape"); continue; }
    predicateReferenceCount += finding.predicates.length; factReferenceCount += finding.factSpans.length;
    if (new Set(finding.predicates.map((span) => hash([referenceKey(span, "source"), span?.state, span?.factSpanIndices]))).size !== finding.predicates.length ||
        new Set(finding.factSpans.map((span) => referenceKey(span, "fact"))).size !== finding.factSpans.length) reject("duplicate_reference");
    const usedFactIndices = new Set();
    for (const predicate of finding.predicates) {
      if (!exactKeys(predicate, ["sourceID", "textHash", "quote", "occurrence", "state", "factSpanIndices", "reason"])) { reject("predicate_relation"); continue; }
      const source = sources.get(predicate.sourceID);
      if (!source || predicate.sourceID !== edge.scopeSourceID || !resolveResearchApplicabilityQuote(predicate, text(source.text), "textHash", hash(text(source.text)))) reject("source_span");
      if (!states.includes(predicate.state) || predicate.state === "not_material_to_this_claim" || !boundedReason(predicate.reason) ||
          !Array.isArray(predicate.factSpanIndices) || new Set(predicate.factSpanIndices).size !== predicate.factSpanIndices.length ||
          predicate.factSpanIndices.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= finding.factSpans.length)) { reject("predicate_relation"); continue; }
      predicate.factSpanIndices.forEach((index) => usedFactIndices.add(index));
      if (["established", "excluded"].includes(predicate.state) && !predicate.factSpanIndices.length) reject("unbound_disposition");
    }
    if (usedFactIndices.size !== finding.factSpans.length) reject("unused_fact_binding");
    for (const span of finding.factSpans) {
      const fact = facts.get(span?.factID);
      if (!exactKeys(span, ["factID", "statementHash", "quote", "occurrence"]) || !fact ||
          !resolveResearchApplicabilityQuote(span, fact.statement, "statementHash", fact.statementHash)) reject("fact_span");
    }
    const bindings = [];
    for (const group of finding.unitFindings) {
      if (!exactKeys(group, ["unitIndices", "state", "predicateIndices", "reason"]) || !Array.isArray(group.unitIndices) || !group.unitIndices.length ||
          new Set(group.unitIndices).size !== group.unitIndices.length || group.unitIndices.some((index) => !Number.isSafeInteger(index) || index < 0 ||
            index >= packet.units.length || !edge.unitIDs.includes(packet.units[index]?.id))) { reject("binding_coverage"); continue; }
      for (const index of group.unitIndices) bindings.push({ ...group, unitID: packet.units[index].id });
    }
    if (bindings.length !== edge.unitIDs.length || new Set(bindings.map((row) => row.unitID)).size !== edge.unitIDs.length) reject("binding_coverage");
    for (const binding of bindings) {
      reviewedBindingCount++;
      const unit = recordByID.get(binding.unitID);
      const rejectBinding = (reason) => reject(reason, binding.unitID);
      if (!states.includes(binding.state) || !boundedReason(binding.reason) || !Array.isArray(binding.predicateIndices) ||
          new Set(binding.predicateIndices).size !== binding.predicateIndices.length ||
          binding.predicateIndices.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= finding.predicates.length)) { rejectBinding("binding_shape"); continue; }
      const predicates = binding.predicateIndices.map((index) => finding.predicates[index]);
      if (binding.state === "not_material_to_this_claim" && predicates.length) rejectBinding("irrelevant_fact_binding");
      if (binding.state !== "not_material_to_this_claim" && !edge.gap && !predicates.length) rejectBinding("unbound_predicate");
      if (predicates.length && binding.state !== aggregate(predicates)) rejectBinding("edge_state");
      if (["established", "excluded"].includes(binding.state) && (edge.gap || !predicates.length)) rejectBinding("unbound_disposition");
      for (const predicate of predicates) if (["established", "excluded"].includes(predicate?.state)) {
        for (const index of Array.isArray(predicate.factSpanIndices) ? predicate.factSpanIndices : []) {
          const span = finding.factSpans[index], fact = facts.get(span?.factID);
          if (!fact || typeof span.quote !== "string") continue;
          if (["unknown", "context_only"].includes(fact.status) || unknown.test(span.quote) || /[?]/.test(span.quote) ||
              fact.status === "current_statement" && /^(?:is|are|does|do|did|can|could|may|must|should|would|will|why|how|what|when|where|which)\b/i.test(span.quote.trim())) rejectBinding("ineligible_fact_status");
          if ((fact.hypothetical || researchFactQualification(span.quote).hypothetical) && !["conditional_application", "scenario_determination"].includes(unit?.assertedMode)) rejectBinding("hypothetical_project_fact");
        }
      }
      perUnit.get(binding.unitID).push({ ...binding, edgeID: edge.id, predicates });
    }
  }
  for (const row of records) {
    const unit = units.get(row?.unitID);
    if (!unit) continue;
    const reject = (reason) => { reasons.add(reason); affected.add(unit.id); };
    if (!exactKeys(row, ["unitID", "assertedMode", "applicabilityState", "sourceIndices", "reason"]) || !modes.includes(row.assertedMode) ||
        !states.includes(row.applicabilityState) || !boundedReason(row.reason) || !Array.isArray(row.sourceIndices) ||
        new Set(row.sourceIndices).size !== row.sourceIndices.length || row.sourceIndices.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= unit.sourceIDs.length)) reject("unit_shape");
    const unitFindings = perUnit.get(unit.id), chosenSources = (Array.isArray(row.sourceIndices) ? row.sourceIndices : []).map((index) => unit.sourceIDs[index]);
    if (unitFindings.length !== unit.edgeIDs.length) reject("binding_coverage");
    if (row.applicabilityState !== aggregate(unitFindings)) reject("unit_state");
    if (["project_determination", "scenario_determination"].includes(row.assertedMode) &&
        (row.applicabilityState !== "established" || !chosenSources.length || !unitFindings.some((finding) =>
          edges.get(finding.edgeID)?.kind === "source_scope" && finding.state === "established" && chosenSources.includes(edges.get(finding.edgeID)?.scopeSourceID)))) reject("categorical_scope");
    if (["conditional_application", "practical_recommendation"].includes(row.assertedMode) && evidence.length && !options.practicalNextStep && !chosenSources.length) reject("source_binding");
  }
  const allBindings = [...perUnit.values()].flat();
  const diagnostic = { version: researchClaimApplicabilityVersion, packetHash: packet?.packetHash || current.packetHash,
    answerHash: current.answerHash, evidenceHash: current.evidenceHash, factsHash: current.factsHash,
    pass: reasons.size === 0 && verification?.pass === true, unitCount: units.size, edgeCount: edges.size,
    bindingCount: packet?.bindingCount || 0, reviewedBindingCount, factCount: current.facts.records.length,
    predicateReferenceCount, factReferenceCount, reasonCodes: [...reasons],
    modes: Object.fromEntries(modes.map((mode) => [mode, records.filter((row) => row?.assertedMode === mode).length])),
    states: Object.fromEntries(states.map((state) => [state, allBindings.filter((row) => row.state === state).length])) };
  if (!reasons.size) return { ...verification, claimApplicabilityReview: diagnostic };
  const affectedUnits = affected.size ? [...affected] : [...units.keys()];
  const detail = `Required claim applicability review failed (${[...reasons].join(", ")}); affected units: ${affectedUnits.join(", ")}. ` +
    "Revise only unsupported categorical application or invalid scope/fact bindings; preserve supported independent rules and bounded actions. " +
    "Review bindings (source offsets identify enacted predicates, not project facts): " + JSON.stringify(affectedUnits.map((unitID) => ({
      unitID, fields: units.get(unitID)?.fields, spans: units.get(unitID)?.spans,
      assertedMode: modes.includes(recordByID.get(unitID)?.assertedMode) ? recordByID.get(unitID).assertedMode : "invalid",
      edges: perUnit.get(unitID).map((binding) => ({ edgeID: binding.edgeID, state: binding.state,
        predicates: binding.predicates.map((predicate) => ({ sourceID: sources.has(predicate?.sourceID) ? predicate.sourceID : "invalid_reference",
          ...resolveResearchApplicabilityQuote(predicate, text(sources.get(predicate?.sourceID)?.text), "textHash", hash(text(sources.get(predicate?.sourceID)?.text))),
          state: states.includes(predicate?.state) ? predicate.state : "invalid" }))
      }))
    }))).slice(0, 4000);
  return { ...verification, pass: false, issues: [{ type: "fact_evidence_confusion", detail }, ...(verification?.issues || [])].slice(0, 12),
    projectFactQuestions: [], missingFactsOnly: false, unnecessaryMissingFactIndices: [], claimApplicabilityReview: diagnostic };
}
