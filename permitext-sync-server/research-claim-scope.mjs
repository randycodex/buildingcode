// Shared drafting/review rule. This changes instructions, not source evidence or
// semantic-verifier outcomes; generated answers still need independent review.
export const researchClaimScopeVersion = "20260909-claim-adjacent-conditions-v1";
export const researchClaimScopeInstruction = [
  "Resolve each retained claim against all supplied source qualifications before writing or approving it. Keep the qualifying subject, branch, exception and operative event with that claim in the main answer.",
  "A later caveat, missing-fact question or evidence limitation cannot cure an earlier categorical claim. If a material source relationship remains unresolved, state that uncertainty at the affected claim instead of asserting one side and qualifying it elsewhere.",
  "Do not convert a conditional documentation requirement into an unsupported sequence or deadline: a document required if a response is selected does not by itself establish when that response can be selected.",
  "Omit secondary claims that neither answer the question nor materially qualify its result. If retained, they need their own complete conditions and supporting citations, including conditions on alternatives. Before returning the answer, check that its main text and all other fields make the same bounded claims."
].join(" ");

// Conversational zoning explanations are not permit/compliance determinations.
// Both drafting and verification use this contract to avoid conflicting scopes.
export const researchZoningExplanationScopeInstruction = [
  "Match completeness to the claim actually made. Distinguish a conditional overview of candidate rules from a conclusion that a rule or exception applies to this project.",
  "For a conditional overview, a cited summary may identify a qualifying category without reciting every historical date, administrative prerequisite or edge exception. For example, saying that qualifying narrow lots may be exempt does not assert that every narrow lot is exempt or that this project qualifies. Do not reject such an overview merely because detailed qualification conditions remain in the cited provision. Preserve the stated uncertainty and the rule's actual subject and numerical limits.",
  "For a project-specific eligibility, permission, obligation, calculation or compliance conclusion, establish every material condition needed for that conclusion at the affected claim. A later caveat cannot cure an unsupported categorical conclusion. If a missing condition can change that conclusion, state the narrow uncertainty rather than inventing a premise.",
  "Reject changes in legal scope, including substituting a space or portion for a building, changing and to or, inventing an exception, or misstating a threshold. Reported existing-building records do not establish the proposed building's design. Do not re-ask an established fact; distinguish it from a genuinely different measurement or classification only when that difference matters to the requested conclusion.",
  "Do not demand irrelevant exceptions or downstream design details. Omit secondary claims that do not help answer the current question. All retained claims must have supporting citations; qualification details may be summarized only when no project entitlement or compliance conclusion depends on them."
].join(" ");
