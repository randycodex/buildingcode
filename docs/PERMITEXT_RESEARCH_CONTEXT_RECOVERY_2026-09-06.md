# B1 web Research context recovery

## Result and release boundary

The original audit's B1 stale-completion check reproduced a web client defect:
a delayed successful response from conversation A reopened A after the user had
selected conversation B. The new regression failed against the existing source
with actual `conversation-a`, expected `conversation-b`.

The local repair and focused contracts pass. A real Chrome fixture verified the
application's response handlers, recovery storage and review/retry controls with
synthetic transport and Project transitions. This is not authenticated hosted
acceptance, a live PostgreSQL race, or native-device acceptance. Production
remains at `6ccc2d4a8cc2d605b13ee6d46dbd4e1a0070883a`; this pass did not publish.

## Repair

- Capture the account, workspace, Project and conversation for each request
  attempt. A background completion cannot change the current selection or draft,
  reopen a closed supplemental pane, or navigate after an intervening refresh.
- Compare incoming context and record revisions with the newest known
  conversation. Reject older success data and avoid applying stale conflict
  envelopes, including an A → B → A move of the same conversation.
- Use the same guarded callbacks for new, ongoing and recovered Research.
  Preserve the request's question and any separate unsent follow-up draft.
- Keep changed-context recovery behind a successful current-state review.
  A successful review replaces the prior failure message; retry retains the
  original request ID. Completed background work displays “Research complete.”
- Advance the web asset version to `20260906-research-context-recovery-v51`
  and align the service-worker/offline installer shell at `permitext-pro-shell-v790`.
  No offline corpus generation or installer behavior changed.

## Verification

The new `research-client-context-recovery-contract.mjs` covers late success and
failure, a move and A → B → A move, stale 409 data, a workspace switch,
navigation/account changes during consumer refresh, supplemental-pane closure,
normal completion, follow-up draft preservation and the completed label. It is
included in `test:readiness-recovery`.

Also passed individually in this pass:

- `web-research-recovery-contract.mjs`, `research-progress-contract.mjs` and
  `research-context-persistence-contract.mjs`.
- `web-account-isolation-contract.mjs`, `web-account-mutation-isolation-contract.mjs`
  and `workspace-startup-restore-contract.mjs`.
- `reader-search-recovery-contract.mjs`, `research-source-edition-integrity-contract.mjs`
  and `research-handoff-presentation-contract.mjs`.
- `build-output-contract.mjs`, `offline-install-recovery-contract.mjs` and
  `offline-contract.mjs`, plus `node --check public/app.js` and `git diff --check`.

The offline contract initially caught mismatched shell generations after the
asset bump; the installer constants were aligned and that check then passed.
The context-persistence check covers file-adapter races and the PostgreSQL
transaction protocol; it is not a fresh live PostgreSQL exercise. The entire
readiness suite, paid quality cohort and completed device flows were not rerun.

### Rendered Chrome evidence

Run `node tests/research-context-browser.mjs` from `permitext-sync-server` to
serve the dedicated loopback fixture. It extracts the current application
handlers and uses the actual recovery module, progress rendering and styles.
Its transport and current-state loader are synthetic; CSP blocks outgoing
connections. It does not sign in or call a provider.

Observed in Chrome:

1. Switch A → B before success or an older conflict arrives: B and its current
   draft remain selected; background completion does not reopen A.
2. Move the pending conversation to B before older success arrives: B's context
   revision 2 remains current, the question is retained, and Review is offered
   without Retry.
3. Reload: the current B context, draft, question and original request ID remain.
4. Fail the current-state review: the error is visible, Review remains available,
   Retry stays absent, and no second transport request is sent.
5. Complete review: the current state appears with the updated review message
   and Retry. Retry uses the same request ID and question, keeps B and the
   separate draft, and removes the recovery record after success.
6. After the completed-label change, a fresh-source late success displays
   “Research complete” while B remains selected.

DOM receipts and inspected screenshots are in
`/private/tmp/permitext-b1-client-context-20260906/`. The fixture's dedicated
storage was cleaned, its tab closed and loopback server stopped. Actual account
sessions, grants, retained content and the physical phone were not touched.

## Next bounded step

Review and publish this web candidate, then bind the deployed source/assets and
record the hosted acceptance that is still missing. Keep synthetic handler
evidence distinct from a real cloud completion race. B1's successful live
move/summary/return and the completed Note/Report/PDF cycle do not need repeating.
The remaining B2/B3 edges and B4/B5 retain their existing scope.
