// Structural response double for older HTTP/envelope contracts. It does not
// decide whether recorded prose is actually a source explanation or whether a
// real fact entails a predicate. Those contracts retain their semantic verdict
// doubles and are not acceptance evidence for legal reasoning.
export function applicabilityPacketFromRequest(body) {
  return JSON.parse(body.input.split("CLAIM APPLICABILITY REVIEW\n")[1].split("\n\n")[0]);
}
export function syntheticApplicabilityReview(body) {
  const packet = applicabilityPacketFromRequest(body);
  return { packetHash: packet.packetHash,
    predicates: Object.fromEntries(packet.edges.map(edge => [edge.id, []])), factSpans: [],
    units: Object.fromEntries(packet.units.map(unit => [unit.id, { assertedMode: "source_explanation", categoricalTarget: "none", categoricalSpanIndex: null,
      bindings: Object.fromEntries(unit.edgeIDs.map(edgeID => [edgeID, { treatment: "not_material",
        reason: "Explicit synthetic immaterial witness; no semantic acceptance claim." }])) }])) };
}
