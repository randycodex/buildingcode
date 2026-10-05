// Structural response double for older HTTP/envelope contracts. It does not
// decide whether recorded prose is actually a source explanation or whether a
// real fact entails a predicate. Those contracts retain their semantic verdict
// doubles and are not acceptance evidence for legal reasoning.
export function applicabilityPacketFromRequest(body) {
  return JSON.parse(body.input.split("SOURCE SCOPE AND HUMAN CONTEXT — ADVISORY INPUT\n")[1].split("\n\n")[0]);
}
export function syntheticApplicabilityReview(body) {
  if (!body.text.format.schema.properties.claimApplicabilityReview) return undefined;
  const packet = applicabilityPacketFromRequest(body);
  return { packetHash: packet.packetHash,
    predicates: Object.fromEntries(packet.edges.map(edge => [edge.id, []])), factSpans: [],
    units: Object.fromEntries(packet.units.map(unit => [unit.id, { assertedMode: "source_explanation", categoricalTarget: "none", categoricalSpanIndex: null,
      bindings: Object.fromEntries(unit.edgeIDs.map(edgeID => [edgeID, { treatment: "not_material",
        reason: "Explicit synthetic immaterial witness; no semantic acceptance claim." }])) }])) };
}

// Explicit semantic double for compact scope mechanics only. It asserts source
// explanation; it cannot grade real applicability or responsive support.
export function syntheticMaterialScopeReview(body) {
  const packet = JSON.parse(body.input.split("MATERIAL SCOPE CHECKS\n")[1].split("\n\n")[0]);
  return { packetHash: packet.packetHash, unboundCategoricalApplication: false,
    checks: Object.fromEntries(packet.checks.map(check => [check.sourceID, {
      categoricalApplication: false, sourceResult: "supported",
      relations: Object.fromEntries(check.relationIDs.map(id => [id, "not_material"])),
      reason: "Synthetic explicit source-explanation verdict; not semantic proof."
    }])) };
}

// Adapt older valid provider doubles to the current mandatory field without
// replacing their verdicts, usage, prose or deliberate malformed envelopes.
export function withSyntheticMaterialScopeProviderResponse(body, payload) {
  if (payload.status !== "completed" || body.text?.format?.name !== "permitext_research_verification" ||
      !body.text.format.schema.properties.materialScopeReview) return payload;
  return { ...payload, output: payload.output.map(item => ({ ...item, content: (item.content || []).map(content => {
    if (content.type !== "output_text") return content;
    let value;
    try { value = JSON.parse(content.text); } catch { return content; }
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.hasOwn(value, "materialScopeReview")) return content;
    return { ...content, text: JSON.stringify({ ...value, materialScopeReview: syntheticMaterialScopeReview(body) }) };
  }) })) };
}
