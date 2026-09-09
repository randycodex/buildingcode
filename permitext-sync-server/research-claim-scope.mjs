// Shared drafting/review rule. This changes instructions, not source evidence or
// semantic-verifier outcomes; generated answers still need independent review.
export const researchClaimScopeVersion = "20260909-claim-adjacent-conditions-v1";
export const researchClaimScopeInstruction = [
  "Resolve each retained claim against all supplied source qualifications before writing or approving it. Keep the qualifying subject, branch, exception and operative event with that claim in the main answer.",
  "A later caveat, missing-fact question or evidence limitation cannot cure an earlier categorical claim. If a material source relationship remains unresolved, state that uncertainty at the affected claim instead of asserting one side and qualifying it elsewhere.",
  "Do not convert a conditional documentation requirement into an unsupported sequence or deadline: a document required if a response is selected does not by itself establish when that response can be selected.",
  "Omit secondary claims that neither answer the question nor materially qualify its result. If retained, they need their own complete conditions and supporting citations, including conditions on alternatives. Before returning the answer, check that its main text and all other fields make the same bounded claims."
].join(" ");
