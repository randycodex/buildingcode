import { createHash } from "node:crypto";

export const researchMaterialScopeReviewVersion = "20261004-cited-source-scope-review-v1";
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const states = ["not_material", "condition_preserved", "established", "unsupported_application", "excluded_application"];
const results = ["supported", "evidence_gap_only", "unsupported"];
const sameKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

// One assessment per actually bound source, with its existing graph relations.
// No claim splitting, copied text, fact indices or source-by-answer-unit matrix.
export function buildResearchMaterialScopeReviewPacket(context, answer) {
  const bound = new Set([...(answer.citations || []), ...(answer.supportedPoints || [])]
    .flatMap(item => item.sourceIDs || []));
  const checks = context.sources.filter(source => bound.has(source.sourceID)).map(source => {
    const reachable = new Set([source.sourceID]), relationIDs = new Set();
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of context.graph) if (reachable.has(edge.anchorSourceID) && !relationIDs.has(edge.id)) {
        relationIDs.add(edge.id); if (edge.scopeSourceID) reachable.add(edge.scopeSourceID); changed = true;
      }
    }
    return { sourceID: source.sourceID, relationIDs: [...relationIDs] };
  });
  if (checks.length !== bound.size || new Set(context.sources.map(source => source.sourceID)).size !== context.sources.length ||
      context.sourceRelationWarnings?.some(reason => ["source_identity", "scope_identity"].includes(reason)))
    invalid({ checks }, null, "material_scope_source_binding");
  const body = { version: researchMaterialScopeReviewVersion, contextHash: context.contextHash, checks };
  return { ...body, packetHash: hash(body), graph: context.graph };
}

export function researchMaterialScopeReviewSchema(baseSchema, packet) {
  const checkProperties = Object.fromEntries(packet.checks.map(check => [check.sourceID, {
    type: "object", additionalProperties: false,
    properties: {
      categoricalApplication: { type: "boolean" },
      sourceResult: { type: "string", enum: results },
      relations: { type: "object", additionalProperties: false,
        properties: Object.fromEntries(check.relationIDs.map(id => [id, { type: "string", enum: states }])),
        required: check.relationIDs },
      reason: { type: "string", maxLength: 320 }
    }, required: ["categoricalApplication", "sourceResult", "relations", "reason"]
  }]));
  return { ...baseSchema, properties: { ...baseSchema.properties, materialScopeReview: {
    type: "object", additionalProperties: false,
    properties: { packetHash: { type: "string", enum: [packet.packetHash] },
      unboundCategoricalApplication: { type: "boolean" },
      checks: { type: "object", additionalProperties: false, properties: checkProperties,
        required: packet.checks.map(check => check.sourceID) } },
    required: ["packetHash", "unboundCategoricalApplication", "checks"]
  } }, required: [...baseSchema.required, "materialScopeReview"] };
}

export const researchMaterialScopeReviewInstruction = [
  "MATERIAL SOURCE SCOPE ASSESSMENT: Complete every server-enumerated source and relation in MATERIAL SCOPE CHECKS within this SAME ordinary review. Assess the complete answer, including its opening and headings, not just the supported points. Mark unboundCategoricalApplication=true for any unsupported categorical legal/project result not grounded in the bound sources; accurate later explanation cannot cure that result.",
  "For each source, categoricalApplication=true means any claim actually asserts that its rule governs or establishes a permission, prohibition, obligation or compliance result for the current scenario/project. A directly stipulated scenario result is valid when all material premises are established for that scenario; do not transfer it to actual-project facts. sourceResult=supported requires accurate responsive enacted support for the requested issue or a material qualification/independent useful action. A mere citation, true unrelated side rule or gap statement is not responsive support. Use evidence_gap_only for an inspected-source boundary without a responsive enacted conclusion; source descriptions and accurate conditional rules can be supported without actual-project findings. Use unsupported for false/ungrounded claims or unresponsive rules retained as support.",
  "Review each listed parent/chapter relation or gap against the exact text and current human scenario/corrections. For every asserted categorical use, established means its material scope is established in THAT use's actual/scenario context; not_material requires the scope truly does not affect that claim. An unknown/excluded material categorical application is unsupported_application/excluded_application. condition_preserved is for uses that remain expressly conditional at the affected claim, never a cure for an earlier categorical use. Assess only asserted categorical uses when others of the SAME source remain expressly conditional; do not poison a valid stipulated scenario result or independent action with uncertainty about a separately conditional actual-project use. A gap cannot establish an unavailable scope. Keep one terse source-specific reason; no copied quotations, span offsets, fact indices or repeated legal summaries. Semantic classifications require the full source and human context, not keyword matching. Return genuine ordinary issues for every substantive failure."
].join(" ");

function invalid(packet, value, invariant) {
  const error = new Error("The Research material-scope assessment was not bound to its request.");
  error.code = "INVALID_RESEARCH_VERIFICATION";
  error.failureStage = "verification_envelope_validation";
  error.verificationInvariant = invariant;
  error.verificationEnvelopeDiagnostics = { invariant, expectedSourceCount: packet.checks.length,
    reviewedSourceCount: value?.checks && typeof value.checks === "object" ? Object.keys(value.checks).length : null };
  throw error;
}

export function validateResearchMaterialScopeReview({ packet, value, verification }) {
  const review = value.materialScopeReview;
  if (!sameKeys(review, ["packetHash", "unboundCategoricalApplication", "checks"]) ||
      review.packetHash !== packet.packetHash || typeof review.unboundCategoricalApplication !== "boolean" ||
      !sameKeys(review.checks, packet.checks.map(check => check.sourceID))) invalid(packet, review, "material_scope_identity_coverage");
  let unsupported = review.unboundCategoricalApplication;
  const failures = [];
  const checked = {};
  for (const check of packet.checks) {
    const row = review.checks[check.sourceID];
    if (!sameKeys(row, ["categoricalApplication", "sourceResult", "relations", "reason"]) ||
        typeof row.categoricalApplication !== "boolean" || !results.includes(row.sourceResult) ||
        typeof row.reason !== "string" || !row.reason.trim() || row.reason.length > 320 ||
        !sameKeys(row.relations, check.relationIDs) || Object.values(row.relations).some(state => !states.includes(state)))
      invalid(packet, review, "material_scope_assessment_shape");
    let rowUnsupported = row.sourceResult === "unsupported" || row.categoricalApplication && row.sourceResult !== "supported";
    for (const [id, state] of Object.entries(row.relations)) {
      const edge = packet.graph.find(edge => edge.id === id);
      rowUnsupported ||= ["unsupported_application", "excluded_application"].includes(state) ||
        row.categoricalApplication && state === "condition_preserved" || Boolean(edge.gap) && state === "established";
    }
    if (rowUnsupported) { unsupported = true; failures.push(`${check.sourceID}: ${row.reason.trim()}`); }
    // Persist classifications/identities only. Reasons feed ordinary issues;
    // no human/source/private text enters diagnostics or operational logging.
    checked[check.sourceID] = { categoricalApplication: row.categoricalApplication,
      sourceResult: row.sourceResult, relations: { ...row.relations } };
  }
  const summary = { packetHash: packet.packetHash, unboundCategoricalApplication: review.unboundCategoricalApplication, checks: checked };
  if (!unsupported) return { ...verification, materialScopeReview: summary };
  const issue = { type: "fact_evidence_confusion", detail:
    ("The material source-scope assessment found an unsupported categorical application or source claim. " +
      (failures.length ? failures.join(" ") : "The full answer contains an unbound categorical result.") +
      " Preserve independently supported conclusions and actions.").slice(0, 1500) };
  return { ...verification, pass: false, issues: [issue, ...verification.issues].slice(0, 12),
    projectFactQuestions: [], missingFactsOnly: false, materialScopeReview: summary };
}
