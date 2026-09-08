// This produces a candidate revision, never an approved answer. The caller
// must rerun its ordinary evidence gates and final semantic verification.
export function researchDecisionFactRepair(answer, verification) {
  const indices = verification?.unnecessaryMissingFactIndices;
  if (verification?.pass !== false || !Array.isArray(verification.issues) || !verification.issues.length ||
      verification.issues.some((issue) => issue.type !== "unnecessary_qualification") ||
      !Array.isArray(answer?.missingFacts) || !Array.isArray(indices) || !indices.length ||
      new Set(indices).size !== indices.length || indices.some((index) => !Number.isInteger(index) || index < 0 || index >= answer.missingFacts.length)) {
    return { applied: false, answer };
  }
  const remove = new Set(indices);
  return { applied: true, removedMissingFactIndices: [...indices].sort((a, b) => a - b),
    answer: { ...answer, missingFacts: answer.missingFacts.filter((_, index) => !remove.has(index)) } };
}
