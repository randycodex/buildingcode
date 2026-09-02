import {
  requireActiveResearchProductExampleRepairedV2ConfirmationPaidAuthorization,
  researchProductExampleRepairedV2ConfirmationLockedAuthorizationSHA256,
  validateResearchProductExampleRepairedV2ConfirmationPaidAuthorization
} from "../evals/research-product-example-repaired-v2-confirmation-paid-authorization.mjs";
import { runResearchProductExampleRepairedConfirmation } from
  "./run-research-product-example-repaired-confirmation.mjs";

await runResearchProductExampleRepairedConfirmation({
  validateAuthorization:
    validateResearchProductExampleRepairedV2ConfirmationPaidAuthorization,
  requireActiveAuthorization:
    requireActiveResearchProductExampleRepairedV2ConfirmationPaidAuthorization,
  lockedAuthorizationSHA256:
    researchProductExampleRepairedV2ConfirmationLockedAuthorizationSHA256,
  authorizationRelativePath:
    "permitext-sync-server/evals/research-product-example-repaired-v2-confirmation-paid-authorization.json",
  runLockPath:
    new URL("../.research-product-example-repaired-v2-confirmation-paid-run.lock", import.meta.url),
  resultSchema:
    "permitext-research-product-example-repaired-v2-live-confirmation-v1",
  resultFileSuffix: "product-example-repaired-v2-confirmation",
  resultTitle: "Permitext repaired-v2 owner-example live confirmation",
  consoleLabel: "Repaired-v2 owner-example confirmation"
});
