// Product copy is selected from fixed strings; never expose raw verifier output.
export function researchVerificationFailureExplanation(attempts = []) {
  const last = Array.isArray(attempts) ? attempts.at(-1) : null;
  const issues = Array.isArray(last?.issues) ? last.issues : [];
  const types = new Set(issues.map(issue => issue?.type));
  const exceptionIssue = issues.some(issue =>
    ['misstated_provision','missed_material_conclusion','missing_material_claim'].includes(issue?.type) &&
    /\bexceptions?\b/i.test(String(issue?.detail || '')));
  let reason;
  if (exceptionIssue) reason = 'The draft did not account for an exception in the source text consistently.';
  else if (types.has('fact_evidence_confusion')) reason = 'The draft did not keep supplied assumptions separate from verified evidence.';
  else if (types.has('incorrect_citation') || types.has('wrong_attribution') || types.has('irrelevant_citation')) reason = 'The draft’s citations did not support the conclusions they were attached to.';
  else if (types.has('misstated_provision') || types.has('overstated_compliance')) reason = 'The draft did not accurately preserve the source’s rule or its limits.';
  else if (types.has('missed_material_conclusion') || types.has('missing_material_claim')) reason = 'The draft omitted a source condition needed to support its conclusion.';
  else if (types.has('unsupported_requirement')) reason = 'The draft stated a requirement that the available evidence did not support.';
  else reason = 'The draft did not pass the evidence checks needed to support a reliable conclusion.';
  return `${reason} Permitext has withheld that draft. Your question is still here; you can retry it without rewriting it.`;
}
