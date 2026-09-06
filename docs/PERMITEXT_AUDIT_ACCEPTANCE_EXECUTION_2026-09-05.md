# Production-readiness audit acceptance — September 5, 2026

This continues the 17 findings in the [production-readiness backlog](./PERMITEXT_PRODUCTION_READINESS_BACKLOG_2026-09-04.md), rather than expanding the task to the entire Beta 1 commercialization plan. Implementation and targeted checks had addressed 16 findings; P1-4 and the explicitly listed final-candidate acceptance boundaries remain open until supported by evidence.

## Candidate and scope

- Starting source and serving release: `0a50c8a751ba9fe3170aa3cea7371155d28fb7ce`.
- Starting physical TestFlight candidate: 1.0 (59). The initial recovery-fixture changes affect tests only; the later native Project-facts PDF repair is published in build 60, with physical export verification recorded below.
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

Four existing native UI cases passed against the starting build-59 runtime sources: Notebook first-load retry, reopened conflict review and deletion, late Research completion after starting a new conversation, and guidance from Research into Note/Report review. Each now explicitly disables Clerk in addition to using isolated local transport/storage, so synthetic acceptance cannot initialize live authentication. The iPhone 17 Pro / iOS 27 Simulator result reports 4 passed, 0 failed, 0 skipped and no runtime warnings. Conflict comparison and first-load retry screenshots were visually inspected.

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

Local auth, offline, smoke and deferred account-mutation suites passed. The initial smoke attempt reached the temporary workflow server on the test's fixed port; it was excluded, that exact test server was stopped, and the isolated rerun passed. The full `npm run check`, including precheck and postcheck, passed.

PR [#51](https://github.com/randycodex/buildingcode/pull/51) published `41ba0314dbfc9de17698b5dca37bbb7d74bd4490`. Preview `dpl_3am7cZNfhdpWEgSJ7u1JSTLrKrP4` reached READY and its GitHub Vercel check passed before main was advanced without force at `2026-09-05T19:17:45Z`. Local and remote main/repair branches matched. Production `dpl_6EYL8gqmari9dcq9B3NJEnZchiew` reached READY; both canonical release endpoints returned the exact SHA and six served assets per origin matched the source bytes. Production health passed with PostgreSQL `normalized-v4`.

The actual browser reloaded into release `41ba0314dbfc`, preserving the synthetic Notebook text/image and Report revision 2. Its DOM contained no Clerk script before Sign Out. Sign Out then hid the account's Project/Notebook/Report and showed the signed-out Free view. Selecting Sign in reached the hosted email/social authentication page, instead of silently restoring the account. The exact target's independent export at `2026-09-05T19:21:25.150Z` confirmed no backend session while preserving its one Project, Note, image and Report. This closes the reproduced web sign-out regression; supported-provider completion and full device acceptance remain separate.

Evidence: `/private/tmp/permitext-signout-production-20260905.json`, `/private/tmp/permitext-signout-production-health-20260905.log`, and the disposable account's `web-recovery-signout.json` aggregate.

## Approved disposable Pro acceptance

The owner approved temporary, no-charge Pro access for the new disposable account identified by hash above, followed by revocation. The exact target had no entitlement before the grant. Production accepted the grant at `2026-09-05T19:08:28.046Z`; an independent account export confirmed `lifetimeGrant`, and the refreshed browser displayed Pro with 100 included turns. No purchase or Research request was made. Final revocation completed at `2026-09-05T21:02:53.869Z`, as recorded below. The temporary-access approval does not authorize deleting this new account.

Private aggregate evidence: `/private/tmp/permitext-email-account-acceptance-20260905/temporary-pro-before.json` and `temporary-pro-granted.json`. The owner's separate Lifetime Pro account remains outside the test target.

The browser created `AUDIT TEST — cross-device recovery 2026-09-05` with only synthetic facts. Its Note explicitly retains partial cellar sprinkler coverage, negation of whole-building coverage, and an assumed upper-floor conversion. Report revision 2 contains an independent Note snapshot and the Project facts. A 204-byte four-color synthetic PNG was uploaded through the actual Notebook file chooser, rendered correctly, synced, and survived reload. The account export confirms one Project, one Notebook card, one private image asset, one Report draft, and zero Research operations/usage. PNG SHA-256: `2ebc6d0ee5991d333969112404e803237f14906c767e5c8111fae81c09d4153e`.

The owner's physical account showed Lifetime Pro Active, 98 turns and Synced immediately before ordinary Sign Out. The phone then showed the normal signed-out view and native sign-in sheet. Mirrored email entry did not accept input; the owner completed disposable-account email sign-in on the physical phone. Web reauthentication subsequently required a fresh email code and returned the same account's records. No owner account deletion or data-clearing action was taken.

Physical build 59 displayed the synthetic Project, its qualified Note text and the four-color image. A phone-authored checkpoint reached the browser. A later marker named `PHONE UNSENT C` also autosynced before interruption; a scoped export at `2026-09-05T19:30:01.005Z` confirmed this, so the restart does **not** establish unsent-draft durability. The exact Permitext app card was dismissed from the phone's app switcher, and a fresh launch preserved the account, Project, Note, latest checkpoint and rendered image. Other apps were not closed.

The browser generated Report version 1; the physical Project subsequently listed it. iOS generated and uploaded its own PDF and opened the ordinary share sheet; no message, AirDrop or print submission occurred. The one-page native PDF preview exposed the Project-facts omission described below. At that checkpoint, final grant revocation and restoration of the owner's phone account were pending while the newly reproduced repairs were completed.

## Report snapshot and native PDF follow-ups

On Production `41ba0314dbfc`, an already-open Report remained at revision 2 with its original Note text after **Update in Report** successfully saved a newer snapshot. Independent scoped export showed the saved draft at revision 4 with the phone checkpoint, while the visible paragraph remained old. Export could therefore generate saved content that the open editor did not display.

The web repair explicitly refreshes and focuses the committed Report draft after promotion. It rejects promotion while the open Report has unsaved edits, checks the captured account around asynchronous work, and preserves/discloses edits made while the save is in flight. Export submits the reviewed draft revision; the server rejects a mismatched or invalid supplied revision before file generation, and the clean editor loads the current version for review. Historical clients that omit the revision retain their existing API behavior.

The real promotion/refresh functions pass synthetic tests for exact draft/revision display, stable Note provenance, dirty editors before/during I/O, and account changes. The actual local browser updated an existing Report from revision 2 to 3 with the new checkpoint and retained an unsaved introduction while displaying the expected update warning. The broad HTTP smoke passed including four invalid/stale export revisions followed by a successful exact-revision PDF.

The native build-59 PDF displayed a generic Project-material placeholder instead of the manifest's qualified Project facts. Its manifest model omitted `address`/`facts`, and the PDF renderer had no `projectFacts` case. The native repair decodes those optional fields and renders their original wording. The actual PDF-generation regression passed on iPhone 17 Pro / iOS 27 Simulator: one test passed, zero failures/skips/runtime warnings. It checks address, partial scope, negation, uncertainty, pagination, ending text, the professional-use notice and historical manifest decoding. Both pages of its attached PDF were rendered and visually inspected; all 24 synthetic items and the ending qualification are readable without clipping. Evidence: `/private/tmp/permitext-native-report-facts-20260905.log`, `Test-permitext-2026.09.05_15-44-08--0400.xcresult`, and `/private/tmp/permitext-native-report-facts-attachments-20260905/`. At that checkpoint, archive/TestFlight publication and deployed/physical checks were pending; their outcomes are recorded below.

The approved temporary grant was revoked at `2026-09-05T20:02:11.037Z`. Independent export confirmed no entitlement, all synthetic artifacts retained and zero Research operations/usage. The physical Account view refreshed to Free Active, Billing: None, and Synced. After restarting Permitext, the Free Saved view correctly withheld the Pro-only Project tiles; this is not proof of an already-open Notebook's revocation/error presentation. The exact temporary grant was restored at `2026-09-05T20:09:00.458Z` for the remaining PDF and restored-access checks. At that checkpoint, final revocation and restoration of the owner's phone account were pending. Private aggregates: `temporary-pro-first-revocation.json` and `temporary-pro-restored.json` in the disposable acceptance folder.

After restoration, the phone reopened the same Project, qualified Note, four-color image and phone checkpoint. No purchase or Research request was needed.

## Published Report repair and build 60

PR [#52](https://github.com/randycodex/buildingcode/pull/52) published `ae40953603cf9308a64d6da5657c27cf9175d99b` after the full `npm run check` (including precheck/postcheck), focused contracts, HTTP smoke and native PDF test passed. Preview `dpl_7JeFVkHSEjh9LY9dT8qJyJjAXvaS` was READY with a successful Vercel check. Main advanced without force at `2026-09-05T20:21:58Z`; local/remote main and repair branches matched. Production `dpl_8oTbEHtNFGLHTXftsvV7MPvM1zQx` reached READY. Both origins returned the exact SHA and six byte-identical assets, with PostgreSQL `normalized-v4` health passing. Client versions are `20260905-report-snapshot-v45` / `permitext-pro-shell-v784`.

The actual Production browser reloaded with the same synthetic records. A new Note checkpoint advanced its already-open Report from revision 4 to 5 and appeared immediately in the visible paragraph; the rendered workspace was inspected. A second browser editor then held a dirty revision-5 introduction while the first saved revision 6. The stale save was rejected with a review-current-version message, and the second editor retained its text. A scoped export at `2026-09-05T20:28:51.512Z` confirmed only the first editor's introduction had reached the server. Both synthetic texts were then deliberately combined and saved as revision 7, and export created Report version 2 with three included items. This is bounded deployed Report-concurrency evidence, not complete Notebook/Research/native race acceptance. The temporary second editor was closed after both texts were durably retained.

The reload also displayed the existing warning that older browser data of unverified ownership had been kept separately. Current-account records remained available; quarantined contents were not inspected, claimed or deleted.

Build 60 archived successfully from `ae40953603cf9308a64d6da5657c27cf9175d99b` with clean native inputs. Native runtime tree: `4f7cb3b2d834d5fb5db579ecf50afb8f44588f4f`. Strict deep signature verification passed; bundle/version/Production backend/live Clerk configuration are correct, entitlements match build 59, and all three package checkouts match their pins. The archive's privacy-manifest semantic union remains 13 collected categories, three required-reason API groups, no tracking/domains; this is package verification, not a provider-policy attestation. Upload, processing and physical export outcomes are recorded below.

Evidence: `/private/tmp/permitext-report-snapshot-check-20260905.log`, `permitext-report-snapshot-smoke-20260905.log`, `permitext-report-snapshot-production-20260905.json`, `permitext-report-snapshot-production-health-20260905.log`, the disposable folder's `deployed-report-concurrency.json`, `/private/tmp/permitext-1.0-60-ae4095360.xcarchive`, and `/private/tmp/permitext-build60-final-evidence.json`. Executable SHA-256: `b6af915ada081303619352c299cecaac78e91ff4e754c3a519e844869e2b928e`. Guarded cleanup skipped removal while Xcode was active; free space after archive was 5.7 GiB.

The ordinary App Store Connect export/upload succeeded at `2026-09-05T20:38:47.421Z`; log: `/private/tmp/permitext-build60-upload.log`. At 20:48 UTC, the connected App Store Connect page showed build 60 Complete, assigned to the existing Internal Testers group with one invite. The phone's actual TestFlight build list offered 1.0 (60), while 59 remained installed. Mirroring did not start installation, so the owner installed that exact build physically. No public submission was performed.

## Build 60 physical PDF and final grant revocation

At approximately `2026-09-05T20:59Z`, TestFlight on the physical phone showed 1.0 (60) with **Open**. The running app's Account footer independently showed **Permitext 1.0 (Build 60)** at approximately 21:08 UTC. Launching it retained the disposable account and its synthetic Project. The Project displayed the published Note checkpoint and Report version 2. **Export & Save iOS PDF** completed; the ordinary share sheet displayed a 32 KB PDF, and the Project subsequently listed both Web PDF and iOS PDF for version 2.

The generated native PDF was inspected in the phone's preview. It includes both deliberately reconciled Report introductions, the published Note checkpoint, explicit negation of whole-building sprinkler coverage, the phone checkpoint, the qualified Project material and the professional-use notice. The Project material now says only the cellar is sprinklered and preserves the upper-floor conversion as an assumption. Its manifest/hash footer continues on a second page; the visible text is readable and retained. The new synthetic version-2 PDF was saved under **On My iPhone**. No message, AirDrop or print action was submitted. The independent exact-target export at `2026-09-05T21:01:43.922Z` confirms four generated Report files, up from three before this export, with all synthetic markers retained and zero Research usage.

The final approved grant revocation completed at `2026-09-05T21:02:53.869Z`. A fresh independent export confirms `entitlement: null`, one synthetic Project, one Notebook card, one private image, one Report draft, two immutable Report manifests and four generated PDFs. Research operations, conversations, usage, credits and purchase claims are all zero. Opening the Notebook from the still-open Project showed **Notebook unavailable — The Project Notebook requires Pro**, with Retry. The Account screen then showed **Free Active**, **Billing: None**, and **Synced**. This establishes the bounded native revoked-access presentation; it does not establish unsent-draft or storage-pressure recovery.

Private evidence: `populated-check.json` and `temporary-pro-revoked.json` in `/private/tmp/permitext-email-account-acceptance-20260905/`. The account remained Free until the separately approved populated-deletion exercise below.

## Approved populated-account deletion on build 60

The owner separately approved permanently deleting the new disposable account after reviewing its exact email, one synthetic Project, one Note, one image, two immutable Report versions and four generated PDFs, with zero Research usage or paid entitlements. The earlier empty-account approval was not reused. An exact-target export and direct Blob metadata check at `2026-09-05T21:11:49.117Z` confirmed all five private files existed and no shared-data ownership review was required.

The physical deletion disclosure showed the permanent account/data consequences and no recurring subscription. Typing DELETE enabled submission. Native Clerk reverification requested a fresh email code before deletion. Mirroring twice returned to TestFlight without submitting the ready verification button; reopening retained the same form. The independent check at `2026-09-05T21:14:24.199Z` confirmed the account and all five files unchanged. No crash is established by that interruption. The owner then tapped **Verify and continue** on the physical phone.

The native completion screen reported billing not applicable, Permitext data and five private assets deleted, account-scoped device cleanup complete, and Clerk sign-in identity removal complete. It explicitly disclosed retaining older local cache files without verifiable account ownership to protect other accounts' drafts. This is not a claim that all historical/unattributed device bytes were erased. User-exported PDFs saved separately in Files are outside the app's account cleanup.

The independent account export/checklist at `2026-09-05T21:16:47.510Z` confirms account, sessions and entitlement absent; every mutation and normalized record family, including session metadata, is zero. Direct metadata checks against the five exact pre-deletion Blob paths all return not found. Clerk's **Permitext / production** Users screen independently returned **No users found** for both the exact former identity and its email. The native Done action returned to **Not signed in**.

Reloading the previously authenticated Production browser removed the synthetic Project, Notebook and Report panes and displayed Free with **Sign in or create an account**. The public Reader/Search workspace remained usable; the pre-existing unverified-ownership quarantine notice remains. A second export and all five exact-file checks at `2026-09-05T21:18:43.672Z` still show no account, sessions, records or private files. No stale account was recreated by the browser reload. No arbitrary inspection or deletion of quarantined data was performed.

Private evidence: `deletion-before-summary.json`, `native-verification-interruption-summary.json`, `deletion-after-summary.json`, `deletion-after-reload-summary.json`, `deletion-provider-ui-summary.json`, and the exact-path inventory `deletion-assets-private.json` in the disposable acceptance folder. Raw exports, credentials and verification codes were not retained in evidence. The owner then restored their ordinary phone sign-in, as verified below.

## Owner account restored

At approximately `2026-09-05T21:24Z`, the physical build-60 Saved view again displayed the owner's existing Project containers and saved Electrical passage. Account independently showed the original identity, **Lifetime Pro Active**, **Billing: Lifetime Grant**, **98 included turns remaining**, and **Synced**. This identity is distinct from the deleted disposable account. No owner content, entitlement or purchase was changed. The approved temporary-access cycle and owner-account restoration are complete.

## Existing-account recovery and concurrency acceptance

The owner subsequently designated a different, existing Free account for synthetic recovery tests. Its identifier SHA-256 is `d5f4fa47dccfdb4a6f5b2cd2b63b9f2a1bed0a9aba59dc1a365bde108373b645`. Exact-account preflight confirmed no entitlement, Projects, Notes, Research or private files, with one existing continuity record. Clerk Production independently showed a verified primary email and an existing Google-linked identity. Email-code sign-in completed on web and phone; both displayed Free and Synced. This establishes existing-account email completion, not a fresh Google-provider sign-in. The owner's usual phone account showed Lifetime Pro, 98 turns and Synced before ordinary sign-out.

This batch exercised web release `5e5a460d0d3b` and the previously installed and verified physical build 60. No runtime source or installed binary changed. The owner instructed continuation after the concrete temporary, no-charge Pro/revocation request; the exact-target grant completed at `2026-09-05T22:56:18.981Z`. Both clients refreshed to Pro. A new synthetic Project and two Notes were created through the actual web UI. No purchase or Research generation was performed.

### Saved citations and keyboard access

The same-number 2022 BC 1010.2 **Gates** and 2014 BC 1010.2 **Slope** were saved, synchronized and opened through their saved-preview source controls on the physical phone. Each native Reader displayed its correct edition and provision. The 2022 edition header remained visible while scrolling into Stadiums and Turnstiles. Browser reload retained the saved records; after closing the Readers, each saved-preview source control recreated the correct-edition Reader. A third synthetic saved paragraph from 2022 Installation was retained after locating the per-paragraph save controls. These are online saved-citation/reload checks; offline citation and full assistive-technology acceptance remain open.

On the authenticated Production browser, Enter expanded Structured facts. Tab traversed its Building & code controls to Occupancy. After collapsing Structured facts with Enter, the fact inputs disappeared from the accessibility snapshot and the next Tab reached Saved Evidence. No fact values changed. This is actual keyboard/accessibility-tree evidence for that layout, not physical VoiceOver coverage.

### Authenticated browser draft conflict

Two browser tabs loaded the second Note at version 1, then edited its title to distinct synthetic writer markers. Both displayed **Device draft conflict**, paused automatic saving, and offered comparison/recovery controls. The comparison exposed both titles. An independent server export confirmed the baseline remained version 1. Reloading one tab retained both authored titles in the comparison, with an additional duplicate snapshot of one version.

The titles were deliberately combined before selecting **Keep current editor version** and confirming the reviewed disclosure. An independent export at `2026-09-05T23:05:38.879Z` confirmed version 2 with both markers; the editor displayed Synced. The extra tab was then closed. This verifies authenticated shared-browser draft-conflict protection and reload recovery. The conflict was caught before a competing server write, so it is not independent-device server-concurrency evidence; that separate case follows.

### Physical unsent draft, termination and deployed conflict

The first Note opened on the phone at server version 1 with a synthetic qualified baseline. A controlled phone connection failure used Airplane Mode and a temporary unreachable local HTTP proxy at `127.0.0.1:9`, keeping the Wi-Fi radio and Mirroring available. The original settings were recorded before mutation. This is a failed-transport test, not a claim of full radio-off operation or OS memory-pressure termination.

The phone title was changed to **PHONE OFFLINE R2**. The editor visibly reported **Unable to connect** and **Draft kept on this iPhone**. The independent export at `2026-09-05T23:18:09.298Z` still contained the unchanged version-1 baseline and no phone marker. Only Permitext's exact app-switcher card was dismissed. A fresh Home launch, with the connection failure still in place, opened the cached Project with an offline-snapshot notice. Notebook listed **PHONE OFFLINE R2** under **Drafts on this iPhone**, with **Save confirmation pending**. Opening that draft retained its title and qualified body; the server check at `2026-09-05T23:19:55.403Z` still showed version 1 without the marker. This establishes actual unsent-draft durability through process termination.

While the phone remained disconnected, the web saved **WEB CONCURRENT R3** as version 2. The exact-account export at `2026-09-05T23:21:34.090Z` confirmed that title and absence of the phone marker. The temporary proxy address/port were cleared, proxy mode restored to Off, and Airplane Mode restored to Off; Settings visibly confirmed the original configuration. On reconnect, Notebook Retry restored access and displayed the local draft separately from the new server Note. Opening the draft preserved the original pending-save state. Retrying Save visibly rejected the stale version, disabled Save and offered **Review latest version**. An independent export at `2026-09-05T23:24:56.662Z` confirmed version 2 unchanged.

The native review displayed **Your draft — PHONE OFFLINE R2** and **Latest saved Note · version 2 — WEB CONCURRENT R3**, with the qualified body intact. Both title markers were explicitly combined, version 2 reviewed again, and **Save my draft over version 2** selected. The independent export at `2026-09-05T23:27:05.056Z` confirms version 3, title **RECONCILED R4 - PHONE OFFLINE R2 + WEB CONCURRENT R3**, and all baseline/phone/web markers. Native displayed Synced and removed the Note from its unsynchronized-draft list. Browser reload displayed the exact reconciled title and original body with Synced status. This is a reviewed replacement that preserves the chosen markers, not automatic text merging.

These checks strengthen P0-4/P0-6/P2-3 acceptance on the deployed backend and physical candidate. Image upload/reconnect, storage pressure, OS background eviction, stale writers during deletion/revocation, and Research completion races remain separate.

### Test access revoked and owner restored

The grant was revoked at `2026-09-05T23:28:16.581Z`. The independent export at `2026-09-05T23:28:25.609Z` confirms no entitlement, one synthetic Project, two Notebook cards, three saved citations, and zero Research operations/usage or purchase claims. No account deletion occurred. Native displayed **Free Active**, **Billing: None**, and **Synced** before ordinary test-account sign-out. The normal sign-in form was opened and its test-email prefill cleared.

The owner completed normal phone sign-in. At approximately `2026-09-05T23:34Z`, the original identity again displayed **Lifetime Pro Active**, **Billing: Lifetime Grant**, **98 included turns**, and **Synced**, with the existing Project containers and saved Electrical passage visible. The original Building Code (2014), DOB consolidated archive selection was restored at approximately 23:35 UTC. The owner's content and entitlement were not changed. This temporary-access and phone-restoration cycle is complete.

The browser then signed out of the test account through its normal Account action. Its signed-out UI displayed Sign in, and the exact-account export at `2026-09-05T23:37:43.601Z` confirmed `hasSession: false`, no entitlement, and the synthetic records retained. Historical session metadata is not claimed erased.

Private evidence: `/private/tmp/permitext-recovery-account-acceptance-20260905/`, including `citation-and-signin-checkpoint.json`, `recovery-execution-checkpoint.json`, `browser-conflict-before-resolution-notes.json`, `browser-reconciled-notes.json`, `phone-network-failure-draft-notes.json`, `phone-terminated-server-absence-notes.json`, `before-phone-reconnect-notes.json`, `native-conflict-rejected-notes.json`, `native-reconciled-notes.json`, `temporary-pro-revoke.json` and `recovery-final-free-summary.json`. Raw account exports, credentials, verification codes and personal network details are excluded from the repository record. These acceptance observations do not close P1-4 or authorize public release.

## Reader acceptance continuation

The next acceptance pass reproduced a physical wide-table gesture failure and a
web code-selection race. The implementation, controlled browser recovery,
Simulator evidence, verified Production publication, build-61 upload and pending
physical acceptance are tracked in the
[Reader acceptance repair record](./PERMITEXT_READER_ACCEPTANCE_REPAIRS_2026-09-05.md).
This continuation preserves the original 17-finding scope and requires separate
physical acceptance of the replacement native candidate.
