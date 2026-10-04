import { researchFailureRecovery } from "./public/research-failure-recovery.js";

// Product copy is selected from typed final findings, never raw verifier prose.
export function researchVerificationFailureExplanation(attempts = []) {
  return researchFailureRecovery({ code: "RESEARCH_VERIFICATION_FAILED", verificationAttempts: attempts }).text;
}
