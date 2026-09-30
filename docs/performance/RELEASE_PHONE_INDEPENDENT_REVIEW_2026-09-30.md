# Phone-independent release review — September30,2026

## Verified today

- Working tree was clean at start on `codex/reader-save-target`, HEAD `f50530fcd`. Eleven local commits ahead of the remote branch are documentation/evidence only; no unpushed native/server runtime differences.
- Live remote main remains `0c729b7d1727656d6b015682e2aff15466b2c8d3`; PR69 remains open, draft and mergeable at remote head `0ab6c51fae53f3dd8e33ad0f16521b103feec629`. Vercel and Preview Comments checks report success. This does not authorize merge or certify distribution.
- Reviewed native bookmark-target/source-summary changes and web dependency, cache-pin and interaction changes against main. No new blocking finding identified in this bounded source review. Diff whitespace validation passed. Previously passed runtime tests were not repeated because the runtime is unchanged.
- Native source under `NYC CC APP/permitext` is unchanged since the recorded41.35 source `9813ea5411afd9ac09c9e33c795c7d8e7f67300f`. The temporary41.35 app artifact no longer exists, so its executable hash cannot be freshly reverified. Historical build/device evidence is preserved. A distribution archive must be built and verified separately.
- App Store export configuration uses `app-store-connect`, destination `upload`, automatic signing and explicit build-number management. No archive, upload, submission, release or paid action was performed.

## Browser prerequisites still pending

1. Independent web confirmation of the native offline marker: Chrome currently opens the main account rather than the authorized test account. Requested normal web sign-in to `randyrubirosa@gmail.com`; no main-account data edited. The physical Note's retained marker and Synced status from September29 remain valid, but are not independent web readback.
2. Owner signed into App Store Connect. Live listing confirms latest uploaded version1.0 build92, complete, Internal Testers group, Ready to Submit. Build detail is Validated, uploaded September22 at2:48AM as displayed, bundle com.randycodex.permitext, arm64/iPhone, minimumiOS17.0, symbols included. Build ID6192ada1-802b-4f3b-a9a2-345c867850f7. This predates the September29 native candidate; no exact source SHA appears in the inspected metadata, so it is not accepted as the current candidate. A fresh distribution build with recorded source/archive identity is still required. No Apple settings changed.

## Remaining release scope

After those browser checks: physical interrupted-write recovery and a bounded mixed-use check, intended TestFlight artifact verification on device, then the separately authorized merge/deployment/distribution steps. All remaining accessibility checks and further speed tuning are owner-deferred. No phone, simulator or Instruments was used today.

## Newly reproduced sign-out blocker

Owner could not sign out of Production. Agent reproduced after reload: `Sign-out paused: The secure sign-in account changed. Reload before signing out.` The existing guard blocks when Clerk's active identity differs from the persisted Permitext identity; reload does not reconcile that durable mismatch. No browser storage was cleared.

Local web615/shell1258 candidate refreshes Clerk's client session inventory on mismatch, selects only the captured account's active/pending session, or continues the existing backend/local sign-out if that owner has no remaining provider session. It preserves a different active provider account and retains existing draft checkpoints, owner-state preservation and async generation checks. Refresh failure still blocks cleanup. More than one matching session fails closed for review. Clerk's documented client sessions and explicit sessionId sign-out support this scope: https://clerk.com/docs/js-frontend/reference/objects/client and https://clerk.com/docs/js-frontend/reference/objects/clerk .

Focused sign-out, Clerk-auth, auth-policy and build-output contracts pass. Regression cases cover mismatched provider identity with/without a surviving owner session, provider refresh failure and account switch during refresh. Full `npm run smoke` passed (exit0, /tmp/permitext-signout-615-smoke.log); hosted615 verification and Production rollout are not yet performed. Previous staging614 evidence remains valid only for614.
