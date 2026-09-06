# Original production audit — current closeout checklist

Updated September 6, 2026. This is the current action list for the **original
17 findings** in the [production-readiness backlog](./PERMITEXT_PRODUCTION_READINESS_BACKLOG_2026-09-04.md).
It reconciles completed evidence with remaining acceptance. It adds no feature,
paid evaluation cohort, release approval or new audit scope.

## Evidence baseline and working rules

- Latest verified product source: `e60ca415fe8b7b60be65449b7ef49baccc82eec3`,
  Production deployment `dpl_5rp8vnZ9yZ6XBRWbFHofaD7jQqo9`, physical build 62.
  These identities come from the saved [publication](./PERMITEXT_RESEARCH_HANDOFF_REPAIRS_2026-09-06.md#approved-publication)
  and [build-62 acceptance](./PERMITEXT_BUILD62_HANDOFF_ACCEPTANCE_2026-09-06.md)
  evidence, rather than a new deployment inspection in this reconciliation.
- Reconciliation started at branch commit `7001a3b1d`. This pass changes tests
  and documentation; the later owner-requested Account close control is local
  commit `33f5cd41d`. Neither creates a new website deployment or TestFlight build.
- The 17 IDs comprise 16 repair findings and the P1-4 release-acceptance umbrella.
  A repaired symptom, broader client coverage and public-release approval are
  separate statuses. The table below does not count a local pass as a physical
  or Production pass.
- Passed checks stay passed unless relevant source/configuration changes or
  contradictory evidence invalidate them. Older build-specific observations keep
  their original scope and are not relabeled as new build-62 tests.
- Keep the designated test account during continuing audit work. The earlier
  grant was revoked at `2026-09-06T16:15:33.094Z`. The owner then approved one
  temporary no-charge Pro grant for the remaining technical batch, including
  revoke/regrant and final revocation; it was independently confirmed active at
  `2026-09-06T17:27:16.651Z`. The approved revoke/regrant check passed, with
  revocation at `18:13:22.432Z` and regrant at `18:15:57.452Z` on September 6.
  Chrome and phone retain the designated test session. Final revocation is still
  required. Repeated usual-account restoration is no
  longer a checkpoint requirement. No paid Research, purchase, merge or deletion
  is included in this authorization.
- Chrome's hosted PDF download is owner-confirmed. The Codex in-app browser
  download is a documented, unresolved compatibility limitation. It is not the
  next repair priority; final supported-client acceptance remains a release
  decision, with no machine gate changed here.

## All 17 findings, reconciled

“Verified symptom” closes the particular reproduced behavior named in that row.
Any wider acceptance left in the last column remains open. Batch IDs below give
each remaining check one home so it is not repeated for several findings.

| ID | Original finding | Completed evidence and strongest layer | Remaining acceptance |
| --- | --- | --- | --- |
| P0-1 | Historical citations open the wrong provision/edition. | **Verified online symptom.** Production and physical build 60 reopened 2014 Slope and 2022 Gates correctly; build 61 opened both saved 2014 Research citations. Source/edition routing contracts pass. [Execution](./PERMITEXT_AUDIT_ACCEPTANCE_EXECUTION_2026-09-05.md#saved-citations-and-keyboard-access), [Research confirmation](./PERMITEXT_RESEARCH_HANDOFF_CONFIRMATION_2026-09-06.md). | B3: offline exact-citation reopening and the focused assistive-technology check. |
| P0-2 | Moving Research retains the prior Project's active facts/history. | **Live A → B summary → A verified.** Production reset active context, captured B's qualified facts in a provider-free summary, and preserved both immutable answers and all original Notes/Reports. Physical build 62 showed B's synced summary and correct address. Local context/version, PostgreSQL races and the joined Note/Report flow also pass. | B1: controlled final-client context-change/stale-completion recovery. The successful move and summary do not need repeating. |
| P0-3 | Account transitions leak private state or late async results. | **Partial live acceptance.** The repaired web sign-out, scoped account switches and build-60 populated deletion passed. Local delayed-callback, A → B → A, stale-401 and account-link recovery contracts pass. | B2: stale independent client during switch/revocation and the remaining link-recovery path. Retain the documented legacy/quarantine boundaries. |
| P0-4 | Offline cleanup deletes unsent Notebook drafts/images. | **Text-draft live path verified.** Browser storage failures preserve recoverable drafts; physical build 60 retained an independently unsent draft through failed transport and process termination, then reconciled it after a web edit. | B2: interrupted image upload/reconnect and failed cleanup recovery. B4: storage-pressure/OS-eviction coverage or an explicit recorded scope decision. |
| P0-5 | Retired Workboard writers remain writable. | **Local HTTP repair verified.** Authenticated 410 responses, mixed-sync rejection and historical read/Report compatibility pass imported fixtures. Publication records bind the shipped repair. | B5: final candidate compatibility binding. The absence of a destructive Production write exercise is not a new authorization to attempt one. |
| P0-6 | Concurrent Notebook/Research writes report success while losing changes. | **Notebook live path verified; Research races verified locally.** Physical stale-save rejection and reviewed version-3 reconciliation passed against Production. Local PostgreSQL tests cover atomic move/completion, rollback and replay accounting. | B1: deployed context/completion conflict evidence. B2: stale-writer lifecycle edges. The independent-device Notebook conflict already passed. |
| P1-1 | Normalization loses negation, partial coverage and assumptions. | **Saved-workflow qualification verified.** Local qualification/projection tests plus actual build-60/62 Reports preserve qualifiers. The new local moved-Project handoff preserves partial coverage and assumptions in the current snapshot and Report. | B1: meaning/context on the actual moved-Project clients. Retain the previously accepted Beta Research limits; a new paid quality cohort is not part of closeout. |
| P1-2 | Streaming errors discard recovery information. | **Local repair verified.** Structured JSON/stream errors retain actionable context; source-review recovery and stale-account suppression pass. The focused recovery contract passed again in this pass. | B1: representative final-client source/context-change failure and explicit recovery, using a controlled no-provider failure where available. |
| P1-3 | Private cache deletion/revocation is incomplete. | **Bounded populated deletion verified.** Build 60, independent account exports, Clerk lookup and all five exact private-file checks passed; browser reload did not recreate the account. Unknown-owner historical cache retention was disclosed. | B2: independent stale writer during revoke/cleanup failure. Retain legacy-data limits; do not repeat the completed populated deletion without a newly justified, approved target. |
| P1-4 | Final release acceptance is incomplete. | **Open release umbrella.** Existing Stripe and Apple test lifecycles, accepted monitoring, support/restore exercises, policy publication and source/archive evidence are retained. | B5: outstanding provider/consent, operations, Apple/privacy and final candidate/owner decision fields. |
| P2-1 | Collapsed Project facts remain focusable. | **Verified reported symptom.** Actual Production keyboard traversal and accessibility-tree inspection exclude collapsed inputs and advance to Saved Evidence. | B3: focused assistive-technology/supported-layout spot-check; do not repeat the passed keyboard case. |
| P2-2 | Reports omit the structured Project facts used by Research. | **Verified reported defect, including actual exports.** Build 60 fixed the omission; build 62 web/iOS PDFs preserve qualified facts and distinguish Project default from Research edition. All nine new PDF pages were inspected; Chrome download passed by owner confirmation. | The retained Note/Report/PDF cycle is complete. Moving to a different Project is tracked once under P0-2/B1. Final release binding is P1-4/B5. |
| P2-3 | Notebook load failures look empty/read-only. | **Verified text/error/reconnect path.** Explicit 503/403/revoked-access states, device-only drafts, native Retry and stale-version review passed. The local authored-image recovery export remains owner/project scoped. | Image interruption/reconnect is B2; storage-pressure/OS-eviction coverage is B4. |
| P2-4 | Reader chrome inconsistently shows edition. | **Verified reported labels/race.** Production and physical saved routes show the right 2014/2022 edition; the web code-switch race clears stale text and loads the selected code. | B3: offline/scroll-position and focused assistive-technology coverage. |
| P2-5 | Tablet toolbars collide; supported phone-web behavior is unclear. | **Verified reported layout/table cases.** The saved 320–1440-width checks found no toolbar overlap. Build 61's previously failing Fuel Gas table pans in both directions by owner confirmation. | B3: final supported-layout/VoiceOver spot-check and explicit browser/platform scope. This is not an all-table certification. |
| P2-6 | Exact-match search is poorly explained. | **Verified reported behavior.** Production disclosure, no-match/clear, shorter-term recovery and correct result reopening passed; controlled local retry passed. | B3: focused accessibility check and B5 compatibility binding. |
| P2-7 | Startup waits on secondary catalogs/large client code. | **Local critical-path repair verified.** Controlled delay tests show the workspace can render while secondary catalogs load, after authentication. Reload restores panes. | B4: representative browser/device measurements; the controlled timing is not device paint or p50/p90 acceptance. |

## This pass: completed local work

- Added [the HTTP handoff regression](../permitext-sync-server/tests/research-project-report-handoff-http.mjs)
  to the existing `test:readiness-recovery` command. It uses shipped request
  handlers, isolated file storage, local private assets and a dynamic loopback
  port. External fetch attempts are rejected; provider/storage/database
  credentials are removed from its process environment.
- Project A (2014 default, cellar-only sprinklers, assumed Type IIB) and Project
  B (2022 default, ground-floor-only sprinklers, assumed Type IIIA) have distinct
  addresses. Moving the same conversation resets active history/manual context.
  A saved-Project summary uses B, and its captured facts retain B's qualifications.
- A reviewed synthetic Note and issued Report contain B's facts. A's saved
  answer is not offered as a B Report source. Later Project editing and unassign
  leave both immutable answer records and both issued manifests unchanged.
- Both summaries use the application's deterministic Project-context path.
  There are zero provider attempts and zero charged usage records. This verifies
  persistence, context selection and Report composition, not generated code
  interpretation, Production PostgreSQL, rendered UI or physical interaction.
- Six focused checks passed: the new handoff, context persistence, concurrent
  HTTP/Notebook operations, web Research recovery, device recovery export and
  startup critical path. No new product defect was reproduced. Existing broad
  checks, physical PDF presentation and paid/provider tests were not repeated.
- Local receipts and logs, including source hashes, are at
  `/private/tmp/permitext-original-audit-closeout-20260906/`. They contain only
  synthetic test data and remain outside source control.

## Remaining batches and explicit stopping points

### September 6 live checkpoint

- The owner approved the remaining technical batch and completed Chrome sign-in.
  The physical phone showed the designated test identity, Lifetime Pro, 99 turns
  and Synced. Production still identified product source `e60ca415fe8b`.
- Created synthetic Project B `web-project-mtq37i3f`, with its own address,
  ground-floor-only sprinkler coverage, assumed/unconfirmed Type IIIA and an
  explicitly unestablished 2022 code basis. The retained conversation moved from
  Project A to B through the actual web selector and confirmation dialog.
- An independent export verified context revision 3, reset manual facts and
  unchanged historical messages. The exact question “Summarize the saved Project
  structured facts and address.” returned the deterministic `project_context`
  response. The new immutable snapshot contains B's qualifiers and excludes A's
  cellar facts. Its operation records zero provider calls, zero pending provider
  calls and `charged: false`; the prior usage record is unchanged.
- Build 62 displayed one Research history card in B with that question and the
  correct B address. This observes the synced history card, not every native
  evidence-control interaction. The prior PDF/Note presentation remains covered
  by the completed build-62 acceptance.
- Returned the conversation to A using the web confirmation. The independent
  `2026-09-06T17:50:36.319Z` comparison confirms context revision 4, both answers
  unchanged, usage/operations unchanged, and all ten original foundation
  artifacts unchanged. Project B remains as a synthetic fixture.
- Receipts: `live-project-b-summary-result.json`, `live-restore-a-result.json`
  and `live-batch-plan.json` in the private closeout evidence directory above.
  No secrets or raw account identity were added to this document.
- The owner then requested a Liquid Glass X close button for the native Account
  sheet. That UI change is a separate local candidate; installed build 62 and
  Production do not acquire it until a later approved publication. Continue the
  remaining recovery/device checks from this checkpoint rather than redoing the
  successful move or restoring the owner's main account.

### Owner-requested native Account close control

- Added a top-right `xmark` toolbar button to `SettingsView`, using SwiftUI's
  sheet dismissal action and the native toolbar material (Liquid Glass on
  iOS 26+). Its accessible name is “Close Account” and identifier `account-close`.
  It remains in the navigation toolbar when Account content scrolls.
- The ordinary simulator build passed. Initial unsigned UI launches failed in
  `Clerk.configure` before the Account screen appeared. A command-line-only
  `CLERK_PUBLISHABLE_KEY=` override isolated the existing first-use/Account UI
  test from authentication; that test passed on iPhone 17 Pro / iOS 26.5. No
  repository or Production authentication setting changed.
- A capture-only rerun of that existing test also passed. The rendered dark
  Account sheet, already scrolled to its Account section, shows the circular
  glass X clearly at the upper right. The screenshot is
  `account-close-preview.png` in the private evidence directory. This verifies
  appearance and Account opening; it does not claim a recorded tap of the new X
  or physical-device acceptance. Dismissal wiring was inspected in source.
- This is a local candidate for the next native build. Installed build 62 and
  the existing Production source are unchanged. The original 17 audit IDs and
  outstanding final-release gates remain intact.

### B1 — Different Project context and client recovery

1. **Completed September 6, with the native history-card limit above.** Used the
   designated synthetic account and two Projects with visibly different
   addresses, code defaults and qualified facts. Moved the retained conversation
   A → B and inspected both clients within the recorded scope. Verified the new
   active Project/context, reset active history and retained historical answers.
2. **Completed September 6.** The saved-Project summary remained deterministic,
   provider-free and uncharged. A legal/code Research request or Retry requires
   its own separately bounded authorization.
3. Exercise a controlled context-change/stale-completion recovery and confirm
   the saved current state and error/review action. Local PostgreSQL race evidence
   already exists; a cloud result must be labeled independently. Reuse the
   completed build-62 Note/Report export evidence for unchanged presentation.

Stop after the named transitions have evidence or a concrete reproducible defect.
Do not widen this into another answer-quality cohort.

### B2 — Remaining recovery and account-isolation edges

September 6 checkpoint: **the Pro-revocation stale-editor path passed.**
The exact synthetic test account was independently verified before each grant
change. No purchase, Research request, merge, deletion or usual-account switch
was performed.

- Created one synthetic Note in Project B. With the browser still holding its
  editable Pro state, revoked test access and changed only that Note's title.
  The server rejected the write; all eleven existing foundation artifacts and
  the two Research answers/usage remained unchanged in an independent export.
- The browser explicitly reported “Saved on this device · sync pending: The
  Project Notebook requires Pro.” After reload, the cloud editor was unavailable
  and “Your drafts on this device” retained the unsent title and authored text.
  The recovery-download action reported success in the UI; a completed file was
  not independently located, so this is not a verified download receipt.
- Physical build 62 showed Free, Synced and the same designated test identity;
  Pro-only Projects disappeared from Saved. Regranting access restored Projects
  without sign-out. The browser reopened its retained draft and reached Synced.
  The synthetic Note advanced from version 2 to version 4 after title recovery
  and restoration; all other foundation artifacts and Research/usage records
  stayed identical. Receipt: `stale-client-revoke-regrant-result.json` in the
  private closeout directory.
- Image recovery is **not yet exercised**: Chrome rejected automated file
  selection with “Not allowed,” including after the owner reported enabling
  file-URL access. Browser URL policy then blocked inspecting `chrome://extensions`;
  no alternate inspection was attempted. The only new image block is empty.
- Prepared the 417-byte blue/orange synthetic PNG in Downloads as
  `Permitext-synthetic-image-recovery-2026-09-06.png`, SHA-256
  `0e4512b6d8e2b39f4c5e83501bb4861418e3ca9136aea7650cc66e0b46846f3d`.
  The audit tab is intentionally offline through DevTools, ready for manual file
  selection. Temporary Pro remains active for this unfinished image/device batch.
  After selecting the PNG, verify failed upload/reopen, restore Go online, verify
  recovery and finish grant cleanup. Do not count the blocked chooser as an
  application upload failure or a passed image-recovery test.

1. Interrupt one synthetic image upload, reopen the authored draft, reconnect
   and confirm the image/document survives or offers an explicit recovery path.
2. **Pro-revocation stale-editor path completed above.** Controlled cleanup
   failure and account-transition/link-recovery boundaries remain separate;
   preserving drafts for the same signed-in owner does not certify account
   deletion or purging another identity's private cache.
3. Complete or explicitly disposition the supported account-link recovery path,
   including retained source drafts and server-confirmed ancestry. A real merge
   or deletion needs exact disposable identities and reviewable consequences.

The text-only unsent-draft/termination/conflict exercise and both completed account
deletions remain passed. Reuse the test account; batch access changes and phone
input instead of restoring the main account between cases.

### B3 — One focused client/device session

Check offline reopening of one saved 2014/2022 citation pair, edition/scroll
continuity, VoiceOver on the relevant Reader/table/Project/Search controls, and
the supported layouts. Reuse the build-61 physical table-pan result unless its
runtime path changed. Record the actual platform/browser scope and any limits.
Keep this session bounded to the affected controls and representative sources.

### B4 — Performance and stress coverage

Measure representative workspace startup separately from secondary catalog
completion, using a named device/browser and reproducible cold/warm conditions.
Record sample size and p50/p90 when measured. Separately resolve the untested
storage-pressure/OS-eviction conditions by controlled evidence or an explicit
owner scope/risk decision. Until then, these remain unverified; a local delay
test or ordinary app-switcher termination does not close them.

### B5 — P1-4 release closeout

Use the [public-release acceptance record](./BETA1_PUBLIC_RELEASE_ACCEPTANCE_RECORD.md)
for the detailed fields. Finish only the still-open evidence:

- Remaining fresh/existing provider sign-ins and account-link/client consent
  coverage; retain passed email registration/sign-in and populated deletion.
- Exact client policy consent/acknowledgment and remaining non-charge
  billing replay/customer-cleanup reconciliation.
- Spend notification/hard-stop evidence and the existing owner operations
  attestations. Preserve the accepted monitoring alternative and previously
  passed monetary lifecycles.
- Apple metadata, privacy/reviewer material and approved Beta limitations.
- Bind the final selected shared source/build/deployment, then record owner
  go/no-go. The existing build-62 publication/installation receipts are already
  available; final candidate selection is still open.

Machine activation gates remain unchanged. Public submission, provider pause,
account deletion and additional paid testing are not authorized by this checklist.

## Next execution point

The local work and successful live A → B summary → A transition are complete.
The owner-requested Account close button is locally built and visually checked.
The next live step is the pending manual image selection in B2, then restoration
of online mode and image recovery. The Pro revoke/regrant stale-editor check is
complete. B1's controlled context failure, the remaining B2/B3 checks and B4/B5
stay open; do not repeat the passed move, summary, revoke/regrant or PDF cycle. Reconcile
B4/B5 in parallel through existing documents and local checks where possible;
this describes work sequencing, not authorization to spawn agents or change
live provider configuration.
