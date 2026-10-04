// Fictional clauses and explicit witnesses prove contract mechanics only.
// No provider calls or legal/model semantic acceptance claims.
import assert from "node:assert/strict";
import { buildResearchClaimApplicabilityPacket, researchClaimApplicabilitySchema,
  validateResearchClaimApplicabilityReview, resolveResearchApplicabilityQuote } from "../research-claim-applicability-review.mjs";
import { createResearchVerificationAttemptDiagnostics } from "../research-economics.mjs";
import { researchVerificationResultForWebContext } from "../research-web-attribution.mjs";
const authority = { corpusID: "fictional-library", codePrefix: "LIB", codeEdition: "2041", codeVersion: "original" };
const evidence = [
  { ...authority, sourceID: "cabinet", sectionID: "cabinet-rule", text: "A red cabinet shall have a latch." },
  { ...authority, sourceID: "scope", sectionID: "chapter-scope", text: "This chapter governs city-owned cabinets in reading rooms.", chapterScopeContext: true, anchorSourceIDs: ["cabinet"] },
  { ...authority, sourceID: "action", sectionID: "independent-action", text: "Cabinet maintenance shall use an approved cleaning method." }
];
const answer = { answerText: "The latch rule governs red cabinets. Its chapter scope remains conditional on city ownership and reading-room location.",
  supportedPoints: [{ heading: "Latch rule", explanation: "City-owned reading-room cabinets are within this chapter.", sourceIDs: ["cabinet"] }],
  citations: [{ sourceIDs: ["cabinet"] }], missingFacts: ["Location remains unknown."] };
const question = "The cabinet is red and city-owned. It is in a reading room.";
const args = { question, answer, evidence, options: { messages: [{ role: "assistant", answer: { answerText: "All cabinets comply." } }, { role: "user", question: "An earlier cabinet was blue." }] } };
const quote = (record, kind, wording) => ({ [kind === "source" ? "sourceID" : "factID"]: kind === "source" ? record.sourceID : record.id,
  [kind === "source" ? "textHash" : "statementHash"]: kind === "source" ? record.textHash : record.statementHash, quote: wording, occurrence: null });
function fieldText(answer, field) {
  const match = /^supportedPoints\[(\d+)\]\.(heading|explanation)$/.exec(field);
  return match ? answer.supportedPoints[Number(match[1])][match[2]] : answer[field];
}
function claimText(packet, answer, unitID) {
  const unit = packet.units.find(unit => unit.id === unitID), span = unit.spans?.find(span => !span.field.endsWith(".heading")) || unit.spans?.[0];
  return span ? fieldText(answer, span.field).slice(span.start, span.end) : answer[unit.fields[0]][0];
}
function witness(args, target = "none", outcome = "established", factClause = args.question) {
  const packet = buildResearchClaimApplicabilityPacket(args), sourceMap = new Map(packet.sources.map(source => [source.sourceID, source]));
  const review = { packetHash: packet.packetHash, predicates: Object.fromEntries(packet.edges.map(edge => [edge.id, edge.gap ? [] :
    [quote(sourceMap.get(edge.scopeSourceID), "source", args.evidence.find(source => source.sourceID === edge.scopeSourceID).text)]])),
    factSpans: target === "none" || outcome === "unresolved" ? [] : [quote(packet.facts.records[0], "fact", factClause)],
    units: Object.fromEntries(packet.units.map(unit => [unit.id, {
      assertedMode: target === "actual" ? "project_determination" : target === "scenario" ? "scenario_determination" : "source_explanation",
      categoricalTarget: target, categoricalQuote: target === "none" ? "" : claimText(packet, args.answer, unit.id),
      bindings: Object.fromEntries(unit.edgeIDs.map(edgeID => [edgeID, target === "none" ? { treatment: "condition_preserved",
        predicateIndices: packet.edges.find(edge => edge.id === edgeID).gap ? [] : [0], answerQuote: claimText(packet, args.answer, unit.id) }
        : { treatment: "applied", applications: [{ predicateIndex: 0, outcome, factSpanIndices: outcome === "unresolved" ? [] : [0], reason: "Explicit synthetic relation, not proof of entailment." }] }]))
    }])) };
  return { packet, review };
}
const { packet, review } = witness(args);
const check = (candidate = review, replacement = {}) => validateResearchClaimApplicabilityReview({ ...args, packet,
  value: { claimApplicabilityReview: candidate }, verification: { pass: true, issues: [] }, ...replacement });
assert.equal(check().pass, true, "Rule/conditional explanation needs enacted condition support, not artificial human premises.");
assert.equal(check().claimApplicabilityReview.factReferenceCount, 0);
assert.equal(check().claimApplicabilityReview.states.unresolved, packet.bindingCount, "States are derived from condition witnesses.");
const categorical = witness(args, "actual");
assert.equal(check(categorical.review).pass, true, "Explicit complete categorical witness is structurally representable, not semantic proof.");
const longClaim = "The equipment " + "and its included accessories ".repeat(60) + "requires a label.";
for (const longAnswer of [{ answerText: longClaim, citations: answer.citations },
  { answerText: "A source explanation.", evidenceLimitations: [longClaim], citations: answer.citations }]) {
  const longArgs = { ...args, answer: longAnswer }, longWitness = witness(longArgs, "actual");
  assert.deepEqual(longWitness.packet.preflightReasons, []);
  const longUnit = longWitness.packet.units.find(unit => unit.maximumClaimQuoteLength === longClaim.length);
  assert(longUnit); assert(longClaim.length > 1500);
  const schema = researchClaimApplicabilitySchema({ type: "object", additionalProperties: false, properties: {}, required: [] }, longWitness.packet);
  assert.equal(schema.properties.claimApplicabilityReview.properties.units.properties[longUnit.id].properties.categoricalQuote.maxLength, longClaim.length);
  assert.equal(validateResearchClaimApplicabilityReview({ ...longArgs, ...longWitness, value: { claimApplicabilityReview: longWitness.review }, verification: { pass: true, issues: [] } }).pass, true);
}
const hugeClaim = buildResearchClaimApplicabilityPacket({ ...args, answer: { answerText: longClaim.repeat(30), citations: answer.citations }, maximumOutputTokens: 12000 });
assert(hugeClaim.preflightReasons.includes("packet_capacity"));
assert(hugeClaim.estimatedReviewOutputTokens > 9000, "Complete categorical quote output must be included in capacity, not hidden behind one unit.");
let rejections = 0;
function reject(mutate, reason, original = categorical.review) {
  const copy = structuredClone(original); mutate(copy); const result = check(copy);
  assert.equal(result.pass, false); assert(result.claimApplicabilityReview.reasonCodes.includes(reason), JSON.stringify(result.claimApplicabilityReview)); rejections++;
}
reject(row => delete row.units.unit_0, "unit_coverage");
reject(row => row.units.foreign = row.units.unit_0, "unit_coverage");
reject(row => delete row.predicates.edge_0, "edge_coverage");
reject(row => delete row.units.unit_0.bindings.edge_0, "binding_coverage");
reject(row => row.units.unit_0.bindings.foreign = { treatment: "not_material", reason: "Invented identity" }, "binding_coverage");
reject(row => row.packetHash = "stale", "review_hash");
reject(row => row.predicates.edge_0[0].textHash = "wrong", "source_span");
reject(row => row.predicates.edge_0[0].quote += " fabricated", "source_span");
reject(row => row.predicates.edge_0[0].sourceID = "scope", "source_span");
reject(row => row.predicates.edge_0.push(row.predicates.edge_0[0]), "duplicate_reference");
reject(row => row.factSpans[0].factID = "assistant", "fact_span");
reject(row => row.factSpans[0].statementHash = "wrong", "fact_span");
reject(row => row.factSpans[0].occurrence = -1, "fact_span");
reject(row => row.factSpans.push(row.factSpans[0]), "duplicate_reference");
reject(row => row.units.unit_0.bindings.edge_0.applications[0].factSpanIndices = [], "unbound_disposition");
reject(row => row.units.unit_0.bindings.edge_0.applications[0].factSpanIndices = [9], "predicate_relation");
reject(row => row.units.unit_0.bindings.edge_0.applications[0].predicateIndex = 9, "predicate_relation");
reject(row => row.units.unit_0.applicabilityState = "established", "unit_shape");
reject(row => row.units.unit_0.bindings.edge_0.state = "established", "unbound_disposition");
reject(row => row.units.unit_0.categoricalQuote = "red cabinets", "categorical_witness");
for (const outcome of ["excluded", "unresolved"]) reject(row => {
  const atom = row.units.unit_0.bindings.edge_0.applications[0]; atom.outcome = outcome;
  if (outcome === "unresolved") atom.factSpanIndices = [];
}, "categorical_scope");
reject(row => { const fact = packet.facts.records.find(fact => fact.origin === "earlier_user"); row.factSpans[0] = quote(fact, "fact", fact.statement); }, "ineligible_fact_status");
reject(row => row.units.unit_0.bindings.edge_0.answerQuote = "Invented answer condition", "condition_witness", review);
reject(row => row.units.unit_0.bindings.edge_0.factSpanIndices = [0], "unbound_predicate", review);
const misleadingLabel = structuredClone(review);
misleadingLabel.units.unit_0.categoricalTarget = "actual"; misleadingLabel.units.unit_0.categoricalQuote = claimText(packet, answer, "unit_0");
assert.equal(check(misleadingLabel).pass, false, "An explanation mode cannot bypass a separately identified categorical result.");
assert(check(misleadingLabel).claimApplicabilityReview.reasonCodes.includes("categorical_scope"));
const inventedFact = structuredClone(review); inventedFact.factSpans.push(quote(packet.facts.records[0], "fact", question));
assert.equal(check(inventedFact).pass, false, "Unnecessary supplied facts are rejected, never discarded.");
assert.equal(check(null).pass, false);
for (const replacement of [{ answer: { ...answer, answerText: "Changed answer." } },
  { evidence: evidence.map(source => ({ ...source, codeEdition: "2042" })) },
  { evidence: evidence.map(source => ({ ...source, text: source.text + " Changed." })) },
  { options: { ...args.options, projectContextFacts: ["Changed fact."] } }, { question: "Changed human statement." }])
  assert(check(categorical.review, replacement).claimApplicabilityReview.reasonCodes.includes("stale_packet"));
const tampered = structuredClone(packet); tampered.edges.pop();
assert(check(categorical.review, { packet: tampered }).claimApplicabilityReview.reasonCodes.includes("stale_packet"));
assert.equal(check(review, { verification: { pass: false, issues: [{ type: "misstated_provision", detail: "Existing substantive failure." }] } }).pass, false);

function contextCheck(phrasing, target, mode, expected, clause = phrasing) {
  const scoped = { ...args, question: phrasing, options: { applicabilityFactContext: { conversationFactState: { activeRootTopic: "Cabinet", turnKind: "hypothetical",
    establishedFacts: [], hypotheticalFacts: [{ key: "cabinet", sourceText: phrasing }], unknownFacts: [] } } } };
  const built = witness(scoped, target, "established", clause);
  if (mode) for (const row of Object.values(built.review.units)) row.assertedMode = mode;
  const validate = () => validateResearchClaimApplicabilityReview({ ...scoped, ...built, value: { claimApplicabilityReview: built.review }, verification: { pass: true, issues: [] } });
  assert.equal(validate().pass, expected); return { scoped, built, validate };
}
contextCheck("Assume the cabinet is red and city-owned in a reading room.", "actual", null, false);
const scenario = contextCheck("Can a red city-owned cabinet in a reading room omit its latch?", "scenario", null, true, "a red city-owned cabinet in a reading room");
scenario.built.review.units.unit_0.bindings.edge_0.applications[0].outcome = "unresolved";
scenario.built.review.units.unit_0.bindings.edge_0.applications[0].factSpanIndices = [];
assert.equal(scenario.validate().pass, false, "A scenario label cannot excuse an unresolved predicate.");
const practical = contextCheck("Assume the cabinet is red and city-owned in a reading room.", "scenario", "practical_recommendation", true);
for (const row of Object.values(practical.built.review.units)) { row.categoricalTarget = "none"; row.categoricalQuote = ""; }
assert.equal(practical.validate().pass, true, "A bounded scenario action may use those premises without an actual-project determination.");
const unknownArgs = { ...args, question: "The cabinet's location is unknown." }, unknownWitness = witness(unknownArgs, "actual");
assert.equal(validateResearchClaimApplicabilityReview({ ...unknownArgs, ...unknownWitness, value: { claimApplicabilityReview: unknownWitness.review }, verification: { pass: true, issues: [] } }).pass, false);
for (const question of ["The cabinet is missing its latch.", "The cabinet is installed on May Avenue."]) {
  const stated = { ...args, question }, built = witness(stated, "actual");
  assert.equal(validateResearchClaimApplicabilityReview({ ...stated, ...built, value: { claimApplicabilityReview: built.review }, verification: { pass: true, issues: [] } }).pass, true);
}

// A categorical heading remains independently quoteable and cannot borrow a
// conditional body. Both text occurrences stay in the immutable unit context.
const headedArgs = { ...args, answer: { answerText: "A rule explanation.", supportedPoints: [{ heading: "The cabinet must have a latch.", explanation: "If city ownership and reading-room location apply, the latch rule applies.", sourceIDs: ["cabinet"] }], citations: [{ sourceIDs: ["cabinet"] }] } };
const headed = witness(headedArgs), headingUnit = headed.packet.units.find(unit => unit.fields.includes("supportedPoints[0].heading"));
headed.review.units[headingUnit.id].categoricalTarget = "actual";
headed.review.units[headingUnit.id].categoricalQuote = headedArgs.answer.supportedPoints[0].heading;
const headedCheck = () => validateResearchClaimApplicabilityReview({ ...headedArgs, ...headed, value: { claimApplicabilityReview: headed.review }, verification: { pass: true, issues: [] } });
assert(headedCheck().claimApplicabilityReview.reasonCodes.includes("categorical_scope"));
headed.review.units[headingUnit.id].categoricalQuote = "If city ownership";
assert(headedCheck().claimApplicabilityReview.reasonCodes.includes("categorical_witness"));

const mixedEvidence = [ { ...authority, sourceID: "label", sectionID: "label", text: "Installed equipment shall carry a label." },
  { ...authority, sourceID: "corridor", sectionID: "corridor", text: "Equipment in shared corridors shall be enclosed." } ];
const mixedArgs = { question: "The equipment is installed. Can the label be omitted?", evidence: mixedEvidence,
  answer: { answerText: "No. The label is independently required. If it is in a shared corridor, enclosure is also required.", citations: [{ sourceIDs: ["label", "corridor"] }] } };
const mixed = witness(mixedArgs);
mixed.review.factSpans = [quote(mixed.packet.facts.records[0], "fact", "The equipment is installed.")];
for (const unit of mixed.packet.units) {
  const row = mixed.review.units[unit.id], direct = /^(?:No\.|The label)/.test(claimText(mixed.packet, mixedArgs.answer, unit.id));
  row.assertedMode = direct ? "scenario_determination" : "conditional_application";
  row.categoricalTarget = direct ? "scenario" : "none"; row.categoricalQuote = direct ? claimText(mixed.packet, mixedArgs.answer, unit.id) : "";
  for (const edge of mixed.packet.edges) {
    if (direct && edge.scopeSourceID === "label") row.bindings[edge.id] = { treatment: "applied", applications: [{ predicateIndex: 0, outcome: "established", factSpanIndices: [0], reason: "Installed equipment is the supplied subject." }] };
    else if (direct || edge.scopeSourceID === "label") row.bindings[edge.id] = { treatment: "not_material", reason: "Independent label duty and corridor condition are distinct claims." };
  }
}
const mixedCheck = () => validateResearchClaimApplicabilityReview({ ...mixedArgs, ...mixed, value: { claimApplicabilityReview: mixed.review }, verification: { pass: true, issues: [] } });
assert.equal(mixedCheck().pass, true);
const conditionalID = mixed.packet.units.at(-1).id;
mixed.review.units[conditionalID].categoricalTarget = "scenario"; mixed.review.units[conditionalID].categoricalQuote = claimText(mixed.packet, mixedArgs.answer, conditionalID);
assert.equal(mixedCheck().pass, false, "A conditional alternative cannot become a categorical result.");

const repeated = buildResearchClaimApplicabilityPacket({ evidence, answer: { answerText: "Actual installation. Yes. Hypothetical installation. Yes.", conclusion: "Yes.", citations: [{ sourceIDs: ["cabinet"] }] } });
assert.equal(repeated.units.filter(unit => unit.spans.some(span => span.field === "answerText" && span.end - span.start === 4)).length, 2);
assert(repeated.units.some(unit => unit.fields.length === 1 && unit.fields[0] === "conclusion"));
const alias = buildResearchClaimApplicabilityPacket({ answer: { answerText: "A primary introduction. A complete secondary sentence.", conclusion: "A primary introduction.", explanation: "A complete secondary sentence." } });
assert.equal(alias.units.length, 2); assert(alias.units[1].spans.some(span => span.primaryField === "answerText" && span.primaryStart === 24));
assert.equal(buildResearchClaimApplicabilityPacket({ answer: { answerText: "A complete secondary sentence.", conclusion: "secondary sentence." } }).units.length, 2);
const gapArgs = { ...args, evidence: evidence.filter(source => source.sourceID !== "scope").map(source => source.sourceID === "cabinet" ? { ...source, chapterScopeContextGaps: [{ reference: "LIB chapter", reason: "unavailable" }] } : source) };
const gap = witness(gapArgs); assert.equal(validateResearchClaimApplicabilityReview({ ...gapArgs, ...gap, value: { claimApplicabilityReview: gap.review }, verification: { pass: true, issues: [] } }).pass, true);
const parent = buildResearchClaimApplicabilityPacket({ ...args, evidence: [...evidence, { ...authority, sourceID: "parent", sectionID: "parent", text: "Enclosing scope.", applicabilityScopeAnchors: [{ sourceID: "cabinet" }] }] });
assert(parent.graph.some(edge => edge.kind === "parent_scope"));
assert(buildResearchClaimApplicabilityPacket({ ...args, evidence: [...evidence, evidence[0]] }).preflightReasons.includes("source_identity"));
assert(buildResearchClaimApplicabilityPacket({ ...args, evidence: evidence.map(source => source.sourceID === "scope" ? { ...source, codeEdition: "2042" } : source) }).preflightReasons.includes("scope_identity"));
const oversized = buildResearchClaimApplicabilityPacket({ ...args, answer: { ...answer, supportedPoints: Array.from({ length: 60 }, (_, index) => ({ ...answer.supportedPoints[0], heading: `Distinct claim ${index}` })) } });
assert(oversized.preflightReasons.includes("packet_capacity")); assert(oversized.units.some(unit => unit.fields.includes("supportedPoints[59].explanation")));
const history = buildResearchClaimApplicabilityPacket({ ...args, options: { messages: Array.from({ length: 1000 }, (_, index) => ({ role: "user", question: `Old fact ${index}.` })) } });
assert.equal(history.facts.records.filter(fact => fact.origin === "earlier_user").length, 8);
const ordinaryEvidence = Array.from({ length: 4 }, (_, index) => ({ ...authority, sourceID: `rule_${index}`, sectionID: `rule_${index}`, text: `Fictional rule ${index}.` }));
ordinaryEvidence.push(...Array.from({ length: 3 }, (_, index) => ({ ...authority, sourceID: `scope_${index}`, sectionID: `scope_${index}`, text: `Fictional scope ${index}.`, chapterScopeContext: true, anchorSourceIDs: [`rule_${index}`] })));
const ordinary = buildResearchClaimApplicabilityPacket({ question, answer: { answerText: Array.from({ length: 11 }, (_, index) => `Source explanation sentence ${index}.`).join(" "), citations: [{ sourceIDs: ordinaryEvidence.slice(0, 4).map(source => source.sourceID) }] }, evidence: ordinaryEvidence, options: { projectContextFacts: Array.from({ length: 33 }, (_, index) => `Synthetic fact ${index}.`) } });
assert.deepEqual(ordinary.preflightReasons, []); assert.equal(ordinary.bindingCount, 77); assert(ordinary.estimatedReviewOutputTokens < 6000);
const sourceHash = packet.sources[0].textHash;
assert.deepEqual(resolveResearchApplicabilityQuote({ textHash: sourceHash, quote: "red cabinet", occurrence: null }, evidence[0].text, "textHash", sourceHash), { start: 2, end: 13 });
assert.equal(resolveResearchApplicabilityQuote({ textHash: "same", quote: "cabinet", occurrence: null }, "cabinet and cabinet", "textHash", "same"), null);
assert.deepEqual(resolveResearchApplicabilityQuote({ textHash: "same", quote: "cabinet", occurrence: 1 }, "cabinet and cabinet", "textHash", "same"), { start: 12, end: 19 });
function strict(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node.enum)) assert(node.enum.length);
  if (node.type === "object") { assert.equal(node.additionalProperties, false); assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort()); }
  for (const child of Object.values(node)) if (Array.isArray(child)) child.forEach(strict); else strict(child);
}
// Fixed required binding identities share one lossless schema definition; the
// larger ordinary packet must not exceed provider enum/property limits.
const largeEvidence = ordinaryEvidence.filter(source => source.sourceID !== "scope_2");
const large = buildResearchClaimApplicabilityPacket({ question, answer: { answerText: Array.from({ length: 30 }, (_, index) => `Long source explanation sentence ${index}.`).join(" "), citations: [{ sourceIDs: largeEvidence.slice(0, 4).map(source => source.sourceID) }] }, evidence: largeEvidence, maximumOutputTokens: 12000 });
assert.deepEqual(large.preflightReasons, []); assert.equal(large.bindingCount, 180);
function schemaLimits(schema) {
  let properties = 0, enums = 0, stringCharacters = 0;
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.properties) { const names = Object.keys(node.properties); properties += names.length; stringCharacters += names.join("").length; }
    if (node.$defs) stringCharacters += Object.keys(node.$defs).join("").length;
    if (node.enum) { enums += node.enum.length; stringCharacters += node.enum.filter(value => typeof value === "string").join("").length; }
    if (typeof node.const === "string") stringCharacters += node.const.length;
    for (const child of Object.values(node)) if (Array.isArray(child)) child.forEach(visit); else visit(child);
  }
  visit(schema); assert(properties <= 5000); assert(enums <= 1000); assert(stringCharacters <= 120000);
  return { properties, enums, stringCharacters };
}
let largeSchemaLimits;
for (const candidate of [packet, large, buildResearchClaimApplicabilityPacket({ answer: { answerText: "Source-free explanation." } }), buildResearchClaimApplicabilityPacket()]) {
  const schema = researchClaimApplicabilitySchema({ type: "object", additionalProperties: false, properties: { pass: { type: "boolean" } }, required: ["pass"] }, candidate); strict(schema);
  assert.deepEqual(schema.properties.claimApplicabilityReview.properties.units.required, candidate.units.map(unit => unit.id));
  const limits = schemaLimits(schema); if (candidate === large) largeSchemaLimits = limits;
  for (const unit of Object.values(schema.properties.claimApplicabilityReview.properties.units.properties)) {
    for (const binding of Object.values(unit.properties.bindings.properties)) assert.equal(binding.$ref, "#/$defs/claimApplicabilityBinding");
  }
}
const fullIssues = check(null, { verification: { pass: false, issues: Array.from({ length: 12 }, () => ({ type: "wrong_attribution", detail: "Synthetic web issue." })) } });
assert.equal(fullIssues.issues[0].type, "fact_evidence_confusion"); assert.equal(researchVerificationResultForWebContext(fullIssues, { webAttribution: { pass: true } }).pass, false);
const safe = createResearchVerificationAttemptDiagnostics([{ claimApplicabilityReview: { ...check(categorical.review).claimApplicabilityReview, statement: "PRIVATE", predicates: [{ text: "PRIVATE" }] } }]);
assert.equal(safe.length, 1); assert(!JSON.stringify(safe).includes("PRIVATE")); assert.equal(safe[0].claimApplicabilityReview.bindingCount, packet.bindingCount);
console.log(JSON.stringify({ contract: "claim-applicability-semantic-witness-mechanics", adversarialRejections: rejections, providerCalls: 0, semanticAcceptance: false,
  ordinaryCapacity: { unitCount: ordinary.units.length, edgeCount: ordinary.edges.length, bindingCount: ordinary.bindingCount, estimatedReviewOutputTokens: ordinary.estimatedReviewOutputTokens },
  largeCapacity: { unitCount: large.units.length, edgeCount: large.edges.length, bindingCount: large.bindingCount, estimatedReviewOutputTokens: large.estimatedReviewOutputTokens, schema: largeSchemaLimits } }));
