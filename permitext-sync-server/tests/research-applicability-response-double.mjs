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
    units: packet.units.map((unit) => ({ unitID: unit.id, assertedMode: "source_explanation",
      applicabilityState: "not_material_to_this_claim",
      sourceIndices: unit.sourceIDs.map((_sourceID, index) => index), reason: "Explicit synthetic source-explanation label; not a semantic acceptance claim." })),
    edges: packet.edges.map((edge) => ({ edgeID: edge.id, predicates: [], factSpans: [],
      unitFindings: [{ unitIndices: edge.unitIDs.map((unitID) => packet.units.findIndex((unit) => unit.id === unitID)),
        state: "not_material_to_this_claim", predicateIndices: [], reason: "Explicit synthetic immaterial label; no semantic acceptance claim." }] })) };
}
