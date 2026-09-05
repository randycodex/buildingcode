# Production-readiness audit acceptance — September 5, 2026

This continues the 17 findings in the [production-readiness backlog](./PERMITEXT_PRODUCTION_READINESS_BACKLOG_2026-09-04.md), rather than expanding the task to the entire Beta 1 commercialization plan. Implementation and targeted checks had addressed 16 findings; P1-4 and the explicitly listed final-candidate acceptance boundaries remain open until supported by evidence.

## Candidate and scope

- Starting source and serving release: `0a50c8a751ba9fe3170aa3cea7371155d28fb7ce`.
- Physical TestFlight candidate: 1.0 (59); its runtime inputs remain unchanged by the test-only changes in this execution.
- Preserve the owner's Lifetime Pro account, existing data, unrelated untracked files, previous release evidence and accepted paid-evaluation scope.
- The previously approved disposable account deletion is complete. A new account created in this execution has a different Clerk identity; the earlier deletion approval does not cover this new target.
- Local workflow tests use isolated synthetic records and mocked Research, with external backend requests prohibited. They do not establish generated-answer quality or deployed cross-device acceptance.

## Email registration repair — Production

At `2026-09-05T18:39:04Z`, the public Clerk environment confirmed the owner-approved `Require email address` change. Email remains enabled, required, verified at sign-up with a code, and publicly available. The owner approved the requirement after reviewing its effects on Apple relay addresses and Apple accounts without an email address.

The exact hosted sign-up route reached from Permitext now renders an Email address field alongside Apple, Google and Microsoft. The disposable test address reached the verification-code screen. After owner-provided verification, Permitext returned to an empty, Synced Free account at release `0a50c8a751ba`, with 0 saved sections, 0 notes and no Projects/collections. No purchase or policy checkbox was submitted.

Clerk independently reports a new identity created at `2026-09-05T18:41:47.341Z`, a verified primary email and zero social accounts. A scoped Production PostgreSQL account export at `2026-09-05T18:45:05.786Z` confirms the exact account and email match. The fresh account's identifier SHA-256 is `cd48626d2a80050f28c9e783a27efa0551930d7c4139543df10debfe06bd4498`, distinct from the deleted identity. Raw identifiers, email codes and exports are excluded from this document.

The public configuration audit at `2026-09-05T18:41:06Z` passes **10/10 public checks**, including email sign-up, all four provider factors, Production mode, native API, exact portal paths and Apple web credentials. This run did not inspect server secrets. Existing-account email and social-provider completion remain separate manual checks; rendering buttons does not establish those outcomes.

Private evidence: `/private/tmp/permitext-audit-auth-public-20260905.json` and `/private/tmp/permitext-email-account-acceptance-20260905/fresh-email-summary.json`.

## Browser storage recovery

The final-source IndexedDB fixture passes **7/7** checks in the actual connected browser. Independent contexts preserve both stale-editor drafts, newer edits during acknowledgement, simultaneous first checkpoints, creation-rekey collisions and concurrent card caches. Public-library cleanup and context restart preserve drafts/images. Owner deletion tombstones survive restart and reject stale writes while preserving another account.

Reproduction: `node permitext-sync-server/tests/offline-browser-durability.mjs`, open the dedicated loopback URL and select **Run durability checks**. The fixture uses synthetic identities and disables network API requests. This strengthens P0-4/P0-6/P1-3 evidence; physical pressure, process termination and authenticated cross-device acceptance remain distinct.

## Native recovery and professional handoff

Four existing native UI cases passed against the final runtime sources: Notebook first-load retry, reopened conflict review and deletion, late Research completion after starting a new conversation, and guidance from Research into Note/Report review. Each now explicitly disables Clerk in addition to using isolated local transport/storage, so synthetic acceptance cannot initialize live authentication. The iPhone 17 Pro / iOS 27 Simulator result reports 4 passed, 0 failed, 0 skipped and no runtime warnings. Conflict comparison and first-load retry screenshots were visually inspected.

A fresh local backend from the current source exercised Project → mocked Research → qualified Note → Report and reopen. The synthetic Project states that only the cellar is sprinklered and an upper-floor conversion remains an assumption. The visible Research context preserves those qualifications and the Note retains explicit negation of whole-building sprinkler coverage. Report revision 2 and generated version 1 preserve the Note, qualified structured facts and Project description after browser reload. Both exported PDF pages were rendered and visually inspected: wording is intact, text is readable, and the professional-use notice remains present. The authenticated file-read endpoint returned the exact stored PDF hash. The in-app browser did not expose a completed local download file; PDF inspection used the same generated file through that local endpoint, not a separately generated document.

Native evidence: `/private/tmp/permitext-audit-native-recovery-20260905.log`, `/private/tmp/permitext-audit-native-recovery-images-20260905/` and `Test-permitextPhysicalStress-2026.09.05_14-39-44--0400.xcresult` in the shared DerivedData test logs. Guarded cleanup skipped removals because Xcode was active.

Synthetic Report evidence: `/private/tmp/permitext-audit-report-20260905/qualified-report.pdf` and `manifest.json`. PDF SHA-256: `f2ca90249d50e4317d0ada9464ebe0358b64e9ef10df98ad81817b8b5f273479`.

The saved Research was then unassigned through its actual Project selector and confirmation. Its active context changed to “Unassigned: no saved Project facts will be sent.” The stored conversation independently has `primaryProjectID: null`, `projectContext: null`, `topicContext: null` and `contextRevision: 1`; its two historical messages remain present. The existing Report snapshot is retained.

The physical phone was reopened after the Clerk configuration change and still showed Lifetime Pro Active, 98 included turns and Synced. No phone account, content or subscription was changed.

These checks strengthen P0-2/P0-4/P0-6/P1-1/P2-2/P2-3. They do not substitute for physical-device, supported-provider, deployed concurrency or final release acceptance.

## Additional reproduced sign-out defect

On Production source `0a50c8a751ba`, the fresh email account survived a browser reload. Sign Out then displayed the signed-out Account UI, but selecting Sign in silently returned to the same account without an email challenge. The handler called Clerk only when the lazy SDK was already present in the page; after reload, the provider session was skipped. Provider sign-out errors were also swallowed.

The repair loads Clerk for a captured Clerk-backed account before ending the Permitext session, validates the expected user and targets the exact provider session ID. Its completion callback prevents navigation from interrupting local cleanup. Configuration, provider-load, identity-change and provider-sign-out failures remain visible as a paused, retryable sign-out, instead of claiming completion. A Clerk-backed account needs a provider connection to complete this secure sign-out; durable drafts remain retained. Legacy non-Clerk sign-out keeps its existing path.

The real helper and click handler pass tests for a reloaded workspace with no `window.Clerk`, already-expired provider sessions, non-Clerk accounts, unavailable configuration, degraded provider initialization, provider rejection, incomplete sign-out, a different provider identity, and app-account changes during configuration, SDK initialization and sign-out. The exact-session option was checked against the installed Clerk types and the [official JavaScript reference](https://clerk.com/docs/js-frontend/reference/objects/clerk#sign-out). Client references advance together to `20260905-provider-signout-v44` / `permitext-pro-shell-v783`.

Local auth, offline, smoke and deferred account-mutation suites passed. The initial smoke attempt reached the temporary workflow server on the test's fixed port; it was excluded, that exact test server was stopped, and the isolated rerun passed. The full `npm run check`, including precheck and postcheck, passed. Live publication verification is pending; this section does not yet claim the sign-out repair is deployed.

## Approved disposable Pro acceptance

The owner approved temporary, no-charge Pro access for the new disposable account identified by hash above, followed by revocation. The exact target had no entitlement before the grant. Production accepted the grant at `2026-09-05T19:08:28.046Z`; an independent account export confirmed `lifetimeGrant`, and the refreshed browser displayed Pro with 100 included turns. No purchase or Research request was made. This is a temporary test grant and must be revoked after the cross-device checks. The approval does not authorize deleting this new account.

Private aggregate evidence: `/private/tmp/permitext-email-account-acceptance-20260905/temporary-pro-before.json` and `temporary-pro-granted.json`. The owner's separate Lifetime Pro account remains outside the test target.
