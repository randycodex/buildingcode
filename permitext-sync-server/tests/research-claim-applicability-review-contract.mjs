// Unrelated fictional rules and explicit response doubles test mechanics only.
// They do not establish legal/model semantic accuracy.
import assert from "node:assert/strict";
import { buildResearchClaimApplicabilityPacket, researchClaimApplicabilitySchema,
  validateResearchClaimApplicabilityReview, resolveResearchApplicabilityQuote } from "../research-claim-applicability-review.mjs";
import { createResearchVerificationAttemptDiagnostics } from "../research-economics.mjs";
import { researchVerificationResultForWebContext } from "../research-web-attribution.mjs";
const authority = { corpusID: "fictional-library", codePrefix: "LIB", codeEdition: "2041", codeVersion: "original" };
const evidence = [
  { ...authority, sourceID: "cabinet", sectionID: "cabinet-rule", sectionNumber: "4.2", text: "A red cabinet shall have a latch." },
  { ...authority, sourceID: "scope", sectionID: "chapter-scope", sectionNumber: "4.1", text: "This chapter governs city-owned cabinets in reading rooms.",
    chapterScopeContext: true, anchorSourceIDs: ["cabinet"], anchorSectionIDs: ["cabinet-rule"] },
  { ...authority, sourceID: "action", sectionID: "independent-action", sectionNumber: "9.1", text: "Cabinet maintenance shall use an approved cleaning method." }
];
const answer = { answerText: "The cabinet must have a latch. Its location has not yet been confirmed.",
  conclusion: "The cabinet must have a latch. Its location has not yet been confirmed.", explanation: "A later summary is also reviewed.",
  supportedPoints: [{ heading: "Latch", explanation: "The red-cabinet latch rule is conditional on city-owned reading-room scope.", sourceIDs: ["cabinet"], sectionID: "cabinet-rule" },
    { heading: "Maintenance", explanation: "Use an approved cleaning method.", sourceIDs: ["action"], sectionID: "independent-action" }],
  citations: [{ sourceIDs: ["cabinet", "action"], sectionID: "cabinet-rule" }],
  assumptions: ["City ownership is not assumed."], missingFacts: ["Location."], evidenceLimitations: ["Scope is unknown."],
  additionalEvidenceNeeded: ["The room location."], followUpQuestions: ["Where is the cabinet?"] };
const question = "The cabinet is red and city-owned. It is in a reading room.";
const options = { projectContextFacts: ["Cabinet inventory: red."], messages: [
  { role: "assistant", answer: { answerText: "All cabinets meet the scope." } }, { role: "user", question: "An earlier corrected scenario had a blue cabinet." }] };
const args = { question, answer, evidence, options }, packet = buildResearchClaimApplicabilityPacket(args);
const quote = (source, kind, wording) => ({ [kind === "source" ? "sourceID" : "factID"]: kind === "source" ? source.sourceID : source.id,
  [kind === "source" ? "textHash" : "statementHash"]: kind === "source" ? source.textHash : source.statementHash,
  quote: wording, occurrence: null });
function reviewFor(packet, evidence, state = "unresolved", mode = "source_explanation", factQuote = null) {
  const facts = factQuote || packet.facts.records.find((fact) => fact.origin === "current_user"), sources = new Map(packet.sources.map((source) => [source.sourceID, source]));
  const bodies = new Map(evidence.map((source) => [source.sourceID, source.text]));
  return { packetHash: packet.packetHash,
    units: packet.units.map((unit) => ({ unitID: unit.id, assertedMode: mode, applicabilityState: unit.edgeIDs.length ? state : "not_material_to_this_claim",
      sourceIndices: unit.sourceIDs.map((_id, index) => index), reason: "Synthetic complete unit finding, not semantic proof." })),
    edges: packet.edges.map((edge) => ({ edgeID: edge.id,
      predicates: edge.gap ? [] : [{ ...quote(sources.get(edge.scopeSourceID), "source", bodies.get(edge.scopeSourceID)), state,
        factSpanIndices: ["established", "excluded"].includes(state) ? [0] : [], reason: "Synthetic exact predicate binding." }],
      factSpans: ["established", "excluded"].includes(state) ? [quote(facts, "fact", facts.statement)] : [],
      unitFindings: edge.unitIDs.map((unitID) => ({ unitIndices: [packet.units.findIndex((unit) => unit.id === unitID)], state, predicateIndices: edge.gap ? [] : [0], reason: "Synthetic claim-specific scope disposition." })) })) };
}
const validate = (review, replacement = {}) => validateResearchClaimApplicabilityReview({ ...args, packet, value: { claimApplicabilityReview: review },
  ...replacement, verification: replacement.verification || { pass: true, issues: [] } });
const established = () => reviewFor(packet, evidence, "established", "project_determination");
assert.deepEqual(packet.preflightReasons, []);
assert(packet.units[0].fields.includes("answerText") && packet.units[0].fields.includes("conclusion"));
assert(packet.units[0].spans.every((span) => span.end - span.start < answer.answerText.length), "Opening and caveat are distinct exact spans.");
assert(packet.units.some((unit) => unit.fields.includes("explanation")));
const repeatedArgs = { answer: { answerText: "Actual installation. Yes. Hypothetical installation. Yes.", citations: [{ sourceIDs: ["cabinet"] }] }, evidence };
const repeatedPacket = buildResearchClaimApplicabilityPacket(repeatedArgs);
const repeatedYes = repeatedPacket.units.filter((unit) => unit.spans.some((span) => repeatedArgs.answer.answerText.slice(span.start, span.end) === "Yes."));
assert.equal(repeatedYes.length, 2, "Identical short statements at different positions remain distinct claim units.");
assert.notEqual(repeatedYes[0].id, repeatedYes[1].id);
const aliasPacket = buildResearchClaimApplicabilityPacket({ answer: { answerText: "A primary introduction. A complete secondary sentence.",
  conclusion: "A primary introduction.", explanation: "A complete secondary sentence." } });
assert.equal(aliasPacket.units.length, 2);
const aliasSpan = aliasPacket.units[1].spans.find((span) => span.field === "explanation");
assert.deepEqual({ start: aliasSpan.start, end: aliasSpan.end, primaryStart: aliasSpan.primaryStart, primaryEnd: aliasSpan.primaryEnd },
  { start: 0, end: 30, primaryStart: 24, primaryEnd: 54 });
assert(aliasSpan.textHash && aliasSpan.primaryField === "answerText");
const partialAlias = buildResearchClaimApplicabilityPacket({ answer: { answerText: "A complete secondary sentence.", conclusion: "secondary sentence." } });
assert.equal(partialAlias.units.length, 2, "A unique partial-sentence summary is still a separate claim unit.");
const repeatedAlias = buildResearchClaimApplicabilityPacket({ answer: { answerText: repeatedArgs.answer.answerText, conclusion: "Yes." } });
assert.equal(repeatedAlias.units.length, repeatedPacket.units.length + 1, "A repeated fragment does not alias a chosen occurrence.");
const unmatchedAlias = buildResearchClaimApplicabilityPacket({ answer: { answerText: "The primary narrative.", conclusion: "A different determination." } });
assert.equal(unmatchedAlias.units.length, 2, "Non-mirrored compatibility content is retained.");


assert(packet.units.some((unit) => unit.fields.includes("supportedPoints[0].heading") && unit.fields.includes("supportedPoints[0].explanation")));
assert(packet.units.some((unit) => unit.fields.includes("assumptions") && unit.fields.includes("followUpQuestions")));
assert.equal(packet.graph.length, 1);
assert(packet.edges.every((edge) => edge.unitIDs.every((unitID) => packet.units.find((unit) => unit.id === unitID).edgeIDs.includes(edge.id))));
assert.equal(packet.bindingCount, packet.units.reduce((count, unit) => count + unit.edgeIDs.length, 0));
assert(!packet.facts.records.some((fact) => fact.statement.includes("All cabinets meet")));
assert.equal(packet.facts.records.find((fact) => fact.origin === "earlier_user").status, "context_only");
assert.equal(validate(reviewFor(packet, evidence)).pass, true, "Conditional/source explanations may retain unresolved scope.");
assert.equal(validate(established()).pass, true, "Exact references and explicit established states permit review, without proving entailment.");
const grouped = established();
for (const edge of grouped.edges) edge.unitFindings = [{ ...edge.unitFindings[0], unitIndices: edge.unitFindings.flatMap((row) => row.unitIndices) }];
assert.equal(validate(grouped).pass, true, "Identical dispositions may compactly group complete unit bindings.");
const missingGrouped = structuredClone(grouped); missingGrouped.edges[0].unitFindings[0].unitIndices.pop();
assert.equal(validate(missingGrouped).pass, false);
const duplicateGrouped = structuredClone(grouped); duplicateGrouped.edges[0].unitFindings[0].unitIndices.push(duplicateGrouped.edges[0].unitFindings[0].unitIndices[0]);
assert.equal(validate(duplicateGrouped).pass, false);
let rejected = 0;
const reject = (mutate, reason) => { const review = established(); mutate(review); const result = validate(review);
  assert.equal(result.pass, false); assert(result.claimApplicabilityReview.reasonCodes.includes(reason), JSON.stringify(result.claimApplicabilityReview)); rejected++; };
reject((review) => review.units.pop(), "unit_coverage");
reject((review) => review.units[1] = review.units[0], "unit_coverage");
reject((review) => review.edges.pop(), "edge_coverage");
reject((review) => review.edges[1] = review.edges[0], "edge_coverage");
reject((review) => review.edges[0].unitFindings.pop(), "binding_coverage");
reject((review) => review.edges[0].unitFindings[1] = review.edges[0].unitFindings[0], "binding_coverage");
reject((review) => review.packetHash = "stale", "review_hash");
reject((review) => review.edges[0].predicates[0].textHash = "wrong", "source_span");
reject((review) => review.edges[0].predicates[0].quote += " fabricated", "source_span");
reject((review) => review.edges[0].predicates[0].sourceID = "scope", "source_span");
reject((review) => review.edges[0].factSpans[0].factID = "assistant-law", "fact_span");
reject((review) => review.edges[0].factSpans[0].statementHash = "wrong", "fact_span");
reject((review) => review.edges[0].factSpans[0].occurrence = -1, "fact_span");
reject((review) => review.edges[0].predicates[0].factSpanIndices = [], "unbound_disposition");
reject((review) => review.edges[0].predicates[0].factSpanIndices = [4], "predicate_relation");
reject((review) => review.edges[0].predicates.push({ ...review.edges[0].predicates[0], reason: "Different reason." }), "duplicate_reference");
reject((review) => review.edges[0].unitFindings[0].state = "excluded", "edge_state");
reject((review) => review.edges[0].unitFindings[0].predicateIndices = [8], "binding_shape");
reject((review) => review.edges[0].predicates[0] = null, "predicate_relation");
reject((review) => review.edges[0].unitFindings[0] = null, "binding_coverage");
for (const state of ["unresolved", "excluded"]) reject((review) => {
  review.edges[0].predicates[0].state = state; review.edges[0].unitFindings.forEach((row) => row.state = state);
  review.units[0].applicabilityState = state;
}, "categorical_scope");
reject((review) => { const fact = packet.facts.records.find((fact) => fact.origin === "earlier_user");
  review.edges[0].factSpans[0] = quote(fact, "fact", fact.statement); }, "ineligible_fact_status");
assert.equal(validate(null).pass, false);
assert.equal(validate({ packetHash: packet.packetHash, units: [null], edges: [null] }).pass, false);
for (const change of [ { answer: { ...answer, answerText: "Changed opening." } },
  { evidence: evidence.map((source) => ({ ...source, codeEdition: "2042" })) },
  { evidence: evidence.map((source) => source.sourceID === "scope" ? { ...source, text: "Changed scope." } : source) },
  { options: { ...options, projectContextFacts: ["Corrected inventory: blue."] } }, { question: "Correction: privately owned." } ])
  assert(validate(established(), change).claimApplicabilityReview.reasonCodes.includes("stale_packet"));
const tampered = structuredClone(packet); tampered.edges.pop();
assert(validate(established(), { packet: tampered }).claimApplicabilityReview.reasonCodes.includes("stale_packet"));
assert.equal(validate(reviewFor(packet, evidence), { verification: { pass: false, issues: [{ type: "misstated_provision", detail: "Existing substantive failure." }] } }).pass, false);

function checkContext(phrasing, status, assertedMode, expectPass, factClause = phrasing) {
  const context = { applicabilityFactContext: { projectFacts: [], propertyFacts: [], conversationFactState: {
    activeRootTopic: "Cabinet", turnKind: status, establishedFacts: [], hypotheticalFacts: status === "hypothetical" ? [{ key: "color", sourceText: phrasing }] : [],
    unknownFacts: status === "unknown" ? [{ key: "color", sourceText: phrasing }] : [] } } };
  const nextArgs = { ...args, question: phrasing, options: context }, nextPacket = buildResearchClaimApplicabilityPacket(nextArgs);
  const review = reviewFor(nextPacket, evidence, "established", assertedMode);
  review.edges.forEach((edge) => edge.factSpans[0].quote = factClause);
  const result = validateResearchClaimApplicabilityReview({ ...nextArgs, packet: nextPacket, value: { claimApplicabilityReview: review }, verification: { pass: true, issues: [] } });
  assert.equal(result.pass, expectPass, `${phrasing}: ${JSON.stringify(result.claimApplicabilityReview)}`);
  return { nextArgs, nextPacket, review };
}
checkContext("Assume the cabinet is red.", "hypothetical", "project_determination", false);
const scenario = checkContext("Assume the cabinet is red.", "hypothetical", "scenario_determination", true);
scenario.review.edges[0].predicates[0].state = "unresolved"; scenario.review.edges[0].unitFindings.forEach((row) => row.state = "unresolved");
scenario.review.units[0].applicabilityState = "unresolved";
assert.equal(validateResearchClaimApplicabilityReview({ ...scenario.nextArgs, packet: scenario.nextPacket,
  value: { claimApplicabilityReview: scenario.review }, verification: { pass: true, issues: [] } }).pass, false);
checkContext("The cabinet color is unknown.", "unknown", "project_determination", false);
checkContext("Can a red city-owned cabinet in a reading room omit its latch?", "established", "scenario_determination", true,
  "a red city-owned cabinet in a reading room");
checkContext("The cabinet is missing its latch.", "established", "project_determination", true);
checkContext("The cabinet is installed on May Avenue.", "established", "project_determination", true);

// A full mixed narrative retains a direct independent duty AND a conditional
// separate rule; a categorical use of the unresolved rule still fails.
const mixedEvidence = [
  { ...authority, sourceID: "label", sectionID: "label", sectionNumber: "1", text: "Installed equipment shall carry an identification label." },
  { ...authority, sourceID: "enclosure", sectionID: "enclosure", sectionNumber: "2", text: "Equipment shall be enclosed under this chapter." },
  { ...authority, sourceID: "corridor", sectionID: "corridor", sectionNumber: "2.1", text: "This chapter applies only in shared corridors.",
    chapterScopeContext: true, anchorSourceIDs: ["enclosure"] }
];
const mixedAnswer = { answerText: "No. An identification label is independently required. If it is in a shared corridor, enclosure is also required; its location is not established.",
  citations: [{ sourceIDs: ["label", "enclosure"] }] };
const mixedArgs = { question: "The equipment is installed. Can the label be omitted?", answer: mixedAnswer, evidence: mixedEvidence };
const mixedPacket = buildResearchClaimApplicabilityPacket(mixedArgs), mixedReview = reviewFor(mixedPacket, mixedEvidence);
const currentFact = mixedPacket.facts.records[0];
const unitText = (unit) => unit.spans?.map((span) => mixedAnswer[span.field].slice(span.start, span.end)).join(" ") || "";
const direct = new Set(mixedPacket.units.filter((unit) => /^(?:No\.|An identification)/.test(unitText(unit))).map((unit) => unit.id));
for (const edge of mixedReview.edges) {
  const source = mixedPacket.edges.find((candidate) => candidate.id === edge.edgeID).scopeSourceID;
  if (source === "label") { edge.predicates[0].state = "established"; edge.predicates[0].factSpanIndices = [0];
    edge.factSpans = [quote(currentFact, "fact", "The equipment is installed.")]; }
  edge.unitFindings.forEach((row) => {
    if (direct.has(mixedPacket.units[row.unitIndices[0]].id) && source === "label") row.state = "established";
    else if (direct.has(mixedPacket.units[row.unitIndices[0]].id) || source === "label") { row.state = "not_material_to_this_claim"; row.predicateIndices = []; }
  });
}
for (const unit of mixedReview.units) {
  if (direct.has(unit.unitID)) { unit.assertedMode = "scenario_determination"; unit.applicabilityState = "established"; unit.sourceIndices = [0]; }
  else { unit.assertedMode = "conditional_application"; unit.applicabilityState = "unresolved"; unit.sourceIndices = [1]; }
}
const mixedCheck = () => validateResearchClaimApplicabilityReview({ ...mixedArgs, packet: mixedPacket,
  value: { claimApplicabilityReview: mixedReview }, verification: { pass: true, issues: [] } });
assert.equal(mixedCheck().pass, true, "Full mixed answer preserves a direct independent duty and the genuinely conditional alternative.");
mixedReview.units.find((unit) => !direct.has(unit.unitID)).assertedMode = "scenario_determination";
assert.equal(mixedCheck().pass, false, "The same unknown corridor premise cannot support an unqualified enclosure determination.");

// One exact predicate can have different fact-bound dispositions for an
// actual setting and a stipulated alternative without leaking scenario facts.
const compareEvidence = [{ ...authority, sourceID: "compare", sectionID: "compare", text: "Equipment in shared corridors shall be enclosed." }];
const compareAnswer = { answerText: "The shared-corridor rule is excluded for the actual private room. The stipulated corridor alternative requires enclosure.", citations: [{ sourceIDs: ["compare"] }] };
const compareArgs = { question: "Assume the alternative equipment is in a shared corridor.", answer: compareAnswer, evidence: compareEvidence,
  options: { projectContextFacts: ["The actual equipment is in a private room."] } };
const comparePacket = buildResearchClaimApplicabilityPacket(compareArgs), compareReview = reviewFor(comparePacket, compareEvidence);
const compareSource = comparePacket.sources[0], actualFact = comparePacket.facts.records.find((fact) => fact.origin === "saved_project_user"),
  stipulatedFact = comparePacket.facts.records.find((fact) => fact.origin === "current_user");
compareReview.edges[0].predicates = ["excluded", "established"].map((state, index) => ({ ...quote(compareSource, "source", "shared corridors"), state,
  factSpanIndices: [index], reason: "Distinct scenario relation to the same exact predicate." }));
compareReview.edges[0].factSpans = [quote(actualFact, "fact", actualFact.statement), quote(stipulatedFact, "fact", stipulatedFact.statement)];
compareReview.edges[0].unitFindings = [0, 1].map((index) => ({ unitIndices: [index], state: index ? "established" : "excluded", predicateIndices: [index],
  reason: "This claim selects only its own actual or stipulated premise." }));
compareReview.units.forEach((unit, index) => { unit.assertedMode = index ? "scenario_determination" : "source_explanation";
  unit.applicabilityState = index ? "established" : "excluded"; });
const compareCheck = () => validateResearchClaimApplicabilityReview({ ...compareArgs, packet: comparePacket,
  value: { claimApplicabilityReview: compareReview }, verification: { pass: true, issues: [] } });
assert.equal(compareCheck().pass, true);
compareReview.units[1].assertedMode = "project_determination";
assert.equal(compareCheck().pass, false, "A distinct hypothetical relation still cannot establish an actual project determination.");

const gapArgs = { ...args, evidence: evidence.filter((source) => source.sourceID !== "scope").map((source) => source.sourceID === "cabinet"
  ? { ...source, chapterScopeContextGaps: [{ reference: "LIB 4.1", reason: "budget", identity: { ...authority, sectionNumber: "4.1" } }] } : source) };
const gapPacket = buildResearchClaimApplicabilityPacket(gapArgs), gapReview = reviewFor(gapPacket, gapArgs.evidence);
const gapCheck = () => validateResearchClaimApplicabilityReview({ ...gapArgs, packet: gapPacket, value: { claimApplicabilityReview: gapReview }, verification: { pass: true, issues: [] } });
assert.equal(gapCheck().pass, true);
gapReview.edges.find((row) => gapPacket.edges.find((edge) => edge.id === row.edgeID).gap).unitFindings[0].state = "established";
assert.equal(gapCheck().pass, false);
const parentPacket = buildResearchClaimApplicabilityPacket({ ...args, evidence: [...evidence,
  { ...authority, sourceID: "parent", sectionID: "parent", text: "Enclosing scope.", applicabilityScopeAnchors: [{ sourceID: "cabinet", sectionID: "cabinet-rule" }] }] });
assert(parentPacket.graph.some((edge) => edge.kind === "parent_scope" && edge.anchorSourceID === "cabinet"));
assert(buildResearchClaimApplicabilityPacket({ ...args, evidence: evidence.map((source) => source.sourceID === "scope" ? { ...source, codeEdition: "2042" } : source) }).preflightReasons.includes("scope_identity"));
assert(buildResearchClaimApplicabilityPacket({ ...args, evidence: [...evidence, evidence[0]] }).preflightReasons.includes("source_identity"));
const oversized = buildResearchClaimApplicabilityPacket({ ...args, answer: { ...answer, supportedPoints: Array.from({ length: 60 }, (_, index) => ({ ...answer.supportedPoints[0], heading: `Distinct claim ${index}` })) } });
assert(oversized.preflightReasons.includes("packet_capacity"));
assert(oversized.units.some((unit) => unit.fields.includes("supportedPoints[59].explanation")));
const infiniteHistory = buildResearchClaimApplicabilityPacket({ ...args, options: { ...options, messages: Array.from({ length: 1000 }, (_, index) => ({ role: "user", question: `Old fact ${index}.` })) } });
assert(!infiniteHistory.preflightReasons.includes("packet_capacity")); assert.equal(infiniteHistory.facts.records.filter((fact) => fact.origin === "earlier_user").length, 8);

// Typical multi-paragraph overview: 11 distinct sentences, four operative
// sources and three chapter dependencies, 33 synthetic saved project facts.
const ordinaryEvidence = Array.from({ length: 4 }, (_, index) => ({ ...authority, sourceID: `rule_${index}`, sectionID: `rule_${index}`, text: `Fictional rule ${index} contains a material predicate.` }));
ordinaryEvidence.push(...Array.from({ length: 3 }, (_, index) => ({ ...authority, sourceID: `scope_${index}`, sectionID: `scope_${index}`,
  text: `Fictional scope ${index}.`, chapterScopeContext: true, anchorSourceIDs: [`rule_${index}`] })));
const overview = Array.from({ length: 11 }, (_, index) => `Distinct source explanation sentence ${index}.`).join(" ");
const ordinaryArgs = { question, answer: { answerText: overview, conclusion: overview, citations: [{ sourceIDs: ordinaryEvidence.slice(0, 4).map((source) => source.sourceID) }] },
  evidence: ordinaryEvidence, options: { projectContextFacts: Array.from({ length: 33 }, (_, index) => `Synthetic inventory field ${index}.`) } };
const ordinaryPacket = buildResearchClaimApplicabilityPacket(ordinaryArgs);
assert.deepEqual(ordinaryPacket.preflightReasons, []);
assert.equal(ordinaryPacket.units.length, 11); assert.equal(ordinaryPacket.edges.length, 7); assert.equal(ordinaryPacket.bindingCount, 77);
assert(ordinaryPacket.estimatedReviewOutputTokens <= 6000);
const nineEvidence = Array.from({ length: 9 }, (_, index) => ({ ...authority, sourceID: `nine_${index}`, sectionID: `nine_${index}`, text: `Distinct predicate ${index}.` }));
const nineArgs = { question, answer: { answerText: "Nine independent rules are described.", citations: [{ sourceIDs: nineEvidence.map((source) => source.sourceID) }] }, evidence: nineEvidence };
const ninePacket = buildResearchClaimApplicabilityPacket(nineArgs), nineReview = reviewFor(ninePacket, nineEvidence);
assert.deepEqual(ninePacket.preflightReasons, []); assert.equal(ninePacket.edges.length, 9);
assert.equal(validateResearchClaimApplicabilityReview({ ...nineArgs, packet: ninePacket, value: { claimApplicabilityReview: nineReview }, verification: { pass: true, issues: [] } }).pass, true);

const sourceHash = packet.sources.find((source) => source.sourceID === "cabinet").textHash;
assert.deepEqual(resolveResearchApplicabilityQuote({ textHash: sourceHash, quote: "red cabinet", occurrence: null }, evidence[0].text, "textHash", sourceHash), { start: 2, end: 13 });
assert.equal(resolveResearchApplicabilityQuote({ textHash: "same", quote: "cabinet", occurrence: null }, "cabinet and cabinet", "textHash", "same"), null);
assert.deepEqual(resolveResearchApplicabilityQuote({ textHash: "same", quote: "cabinet", occurrence: 1 }, "cabinet and cabinet", "textHash", "same"), { start: 12, end: 19 });
assert.equal(resolveResearchApplicabilityQuote({ textHash: "same", quote: "cabinet", occurrence: 2 }, "cabinet and cabinet", "textHash", "same"), null);
const failedWithFullIssues = validate(null, { verification: { pass: false, issues: Array.from({ length: 12 }, () => ({ type: "wrong_attribution", detail: "Synthetic suppressible web issue." })) } });
assert.equal(failedWithFullIssues.issues.length, 12); assert.equal(failedWithFullIssues.issues[0].type, "fact_evidence_confusion");
assert.equal(researchVerificationResultForWebContext(failedWithFullIssues, { webAttribution: { pass: true } }).pass, false);
const privateReason = established(); privateReason.edges[0].unitFindings[0].state = "unresolved"; privateReason.units[0].applicabilityState = "unresolved";
privateReason.units[0].reason = "PRIVATE HUMAN FACT"; privateReason.edges[0].unitFindings[0].reason = "PRIVATE HUMAN FACT";
assert(!JSON.stringify(validate(privateReason)).includes("PRIVATE HUMAN FACT"));
const schema = researchClaimApplicabilitySchema({ type: "object", properties: { pass: { type: "boolean" } }, required: ["pass"] }, packet);
assert(schema.required.includes("claimApplicabilityReview")); assert.equal(schema.properties.claimApplicabilityReview.properties.edges.minItems, packet.edges.length);
function assertStrictSchema(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node.enum)) assert(node.enum.length > 0, "Provider schema cannot carry an empty enum.");
  if (node.type === "object") {
    assert.equal(node.additionalProperties, false);
    assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort());
  }
  if (Number.isFinite(node.minItems) && Number.isFinite(node.maxItems)) assert(node.minItems <= node.maxItems);
  for (const child of Object.values(node)) if (Array.isArray(child)) child.forEach(assertStrictSchema); else assertStrictSchema(child);
}
for (const candidate of [packet, buildResearchClaimApplicabilityPacket({ answer: { answerText: "A source-free explanation." } }), buildResearchClaimApplicabilityPacket()])
  assertStrictSchema(researchClaimApplicabilitySchema({ type: "object", additionalProperties: false, properties: { pass: { type: "boolean" } }, required: ["pass"] }, candidate));
const safe = createResearchVerificationAttemptDiagnostics([{ claimApplicabilityReview: { ...validate(established()).claimApplicabilityReview, statement: "PRIVATE", predicates: [{ text: "PRIVATE" }] } }]);
assert.equal(safe.length, 1); assert(!JSON.stringify(safe).includes("PRIVATE")); assert.equal(safe[0].claimApplicabilityReview.bindingCount, packet.bindingCount);
console.log(JSON.stringify({ contract: "claim-applicability-mechanics", adversarialRejections: rejected, providerCalls: 0, semanticAcceptance: false,
  ordinaryCapacity: { unitCount: ordinaryPacket.units.length, edgeCount: ordinaryPacket.edges.length, bindingCount: ordinaryPacket.bindingCount,
    facts: ordinaryPacket.facts.records.length, estimatedReviewOutputTokens: ordinaryPacket.estimatedReviewOutputTokens, unchangedCap: 8000 } }));
