# Full web and iPhone walkthrough — September 21, 2026

Status: in progress. This is a running evidence and repair log, not release acceptance.

## Scope

Use a dedicated disposable account through signup, Free access, Pro workflows, Projects, search, Reader references, saves, notes/comments, Research, bidirectional sync, edit/delete/restore, persistence after reopening, and final account deletion. Inventory additional exposed features as the walkthrough proceeds. Do not include real account content in test fixtures or destructive actions.

## Version baseline

- Live `https://permitext.com/health`: production release `d01cbfb9576b2773dbc361e3a14f0dbceeee94ac`, healthy PostgreSQL normalized-v4, matching remote main when checked.
- Local branch `codex/restore-native-navigation`: `e5f52057a`, 12 commits ahead of remote main; includes Trash and web/iOS parity work.
- Paired physical iPhone 17 Pro: installed Permitext 1.0 (41). Prior development provenance is consistent with the installed UI; no current TestFlight acceptance established.
- Owner requested current live code and delegated the release choice. Plan: validate and publish current changes before testing new backend features.
- Released `8a101e45dc7335144f24a3098fa2d525fba44906` to main; Vercel deployment `dpl_ByUSyLn7BnDC4afLRryyGhiSLqK1` Ready. Live health confirms this SHA, PostgreSQL healthy. Unauthenticated GET on the POST-only Trash endpoint now returns 405 instead of routing 404; authenticated UI recovery remains to be tested.

## Findings and repairs

### W001 — Trash endpoints missing production routing

- Severity: high; release blocker for new recovery feature.
- Evidence: app exposes `/content/trash` while `vercel.json` has no `/content/:path*` dynamic rewrite. Local HTTP tests alone do not exercise Vercel routing.
- Expected: web and iOS Trash requests reach the authenticated backend.
- Actual: deployment configuration leaves these requests without their backend route.
- Local repair: added the content namespace rewrite and included it in the routing regression contract; routing checks pass.
- Live verification: deployed in 8a101e45dc73; authenticated web/native Trash listing, deletion propagation, and restoration passed. Fixed in Production.

### W002 — Broad smoke harness still targets the retired workspace root

- Severity: verification gap.
- Reproduction: `node tests/smoke.mjs`.
- Actual: its `webRoot` fetch uses `/` (now marketing), so a combined privacy/workspace-link assertion fails. Trial inspection of `/workspace` exposed further obsolete asset-version, Settings copy, native plan-label, and workspace-layout expectations.
- Expected: smoke coverage should follow current customer entry routes and behavior.
- Status: recorded for focused harness maintenance; no smoke assertions were relaxed or committed. Broad smoke remains failing and is not counted as passed.

## Execution log

### W003 — Edition labels are ambiguous in saved and Notebook lists

- On Production `8a101e45dc73`, save BC 101.1 from 2022 and 2014 Search results into one Project.
- Web Saved merges the display under BUILDING CODE / Chapter 1; Notebook insertion offers two identically named `§ 101.1 · Title Chapter 1` buttons. Native Project lists separate groups but both say BUILDING CODE with no edition in the heading.
- Expected: choose evidence by explicit edition without opening each item or recognizing punctuation.
- Detail/source identity is retained: native historical detail reads BUILDING CODE · 2014 and web detail reads BUILDING CODE (2014). This is a labeling defect; no source substitution established.
- Status: reproducible, recorded for repair.

### Continued rendered checks

- Browser reopened in a new tab: active Project, 101.1 query, both expanded code editions, two saves, historical private note, and Notebook title survived.
- Native Project displays two saves, the web private note, and the Notebook entry QA Evidence Comparison.
- Real address entered: 350 Fifth Avenue, Manhattan, NY. Imported facts persisted: source address 338 5 AVENUE, Manhattan, NY 10001, BBL 1008350041, 102 stories, area 2,812,739 sq ft, year 1931, alteration 2011, O4, districts C5-3/C6-4.5, MiD, map 8d. Source-address normalization and accuracy need independent confirmation; do not infer wrong parcel merely from differing street number.
- Notebook body entered with synthetic QA text; two code-reference chips inserted and UI shows 2 linked. Reopening citation destinations and native body synchronization remain in progress.
- Runtime error-level scan on the new deployment returned no logs for the selected period; this is a bounded scan, not a guarantee of no runtime errors.

### W004 — Simple Research follow-up fails verification

- Production 8a101e45dc73; real Pro disposable account; selected 2022 BC 101.1.
- First question: "Based only on the selected 2022 BC 101.1 passage, what is the code called and how are section numbers designated? Cite the passage."
- First answer completed in 6 seconds, correctly named NYCBC/BC, cited BC 101.1, disclosed its one-passage scope, and opened the citation in Building Code (2022) Reader.
- Follow-up: "Does that passage alone establish whether a particular building complies with the code? Explain its limits without adding unsupported requirements."
- Actual at 30 seconds: Research interrupted; "A Research model produced a response, but Permitext could not verify it against the enacted evidence. Your question is still here." Retry offered. No automatic paid retry performed.
- Expected: a bounded answer explaining that a title provision does not determine whole-building compliance, or a reliable supported limitation response.
- Status: failed follow-up; successful initial turn does not establish full Research acceptance. Question preservation/error presentation passed.

### Additional evidence

- iPhone private-comment edit appeared on web. Native Notebook paragraph appeared in web Notebook/Report source selection; two-way synchronization confirmed for these records. Input automation produced a typo in the paragraph; do not classify that alone as an application defect.
- Native Notebook displays the web-authored analysis and both reference chips, with Synced status.
- NYC Open Data PLUTO API independently queried for BBL 1008350041: address, 102 stories, 2,812,739 sq ft, 1931, 2011 alteration, O4, C5-3/C6-4.5, lot area/frontage/depth and ZIP exactly match imported values. NYC Finance independently confirms the parcel's 338 5 AVENUE address and 102 stories. 350 Fifth Avenue resolves to this parcel; the street-number difference is source normalization, not an established lookup defect.
- Public sources: https://data.cityofnewyork.us/resource/64uk-42ks.json?bbl=1008350041 and https://a836-pts-access.nyc.gov/care/datalets/datalet.aspx?LMparent=20&UseSearch=no&jur=65&mode=asmt_fin_2027&pin=1008350041&taxyr=2025
- Report draft assembled with introduction, property facts, both editions of BC 101.1, and Notebook analysis. Save and export-version checks in progress.

| Check | Result | Evidence / remaining limit |
| --- | --- | --- |
| Production release | Pass | Serving 8a101e45dc73; routing repair deployed. |
| Signup and account isolation | Pass | Signed out existing owner account; created separate disposable Free account with approved consent. |
| iPhone sign-in | Pass | Owner completed OTP; physical development build 1.0 (41). TestFlight/App Store not verified. |
| Real Stripe subscription | Pass | Owner paid; Pro reached both clients; renewal canceled in portal for October 21. |
| Projects and property facts | Pass | Created on both clients, renamed on web, correct Manhattan parcel independently checked; edits synced. |
| Search and Reader | Pass for exercised paths | Exact/phrase/no-match/pagination, multiple editions, chapter find, definitions and cross-references. |
| Saves and private comments | Pass create/edit/sync | Both editions retained; two-way private-note edits. Clearing persistence needs final confirmation. |
| Saved deletion and recovery | Pass with timing caveat | Native/web Trash propagation and restoration observed; transient stale row not established as persistent resurrection. |
| Project archive/delete/restore | Mixed | Archive/restore and native Trash passed; web manager deletion blocked by W009. |
| Notebook | Mixed | Body, references, image and two-way edits passed; final-note archive navigation fails W007. Approved test Note deletion reached both clients. |
| Reports | Mixed | Draft V2, V1/V2 metadata and native five-page PDF passed; edition labels fail W003. Web download remains unverified. |
| Research | Failed reliability | One successful answer; web follow-up and native question failed verification. History sync/usage passed; W005 assignment and W006 citation initial failure recorded. |
| Workspaces/groups | Partial | Create, rename, duplicate, close all and reopen group passed. Collapse/resize/ungroup not fully verified. |
| Profile/settings | Partial | Role edit synced; native Reader size preview responds and owner restored 17 pt/0. Other controls not all exercised. |
| Offline | Unverified | Web preparation did not establish readiness; owner-assisted disconnected iPhone check awaiting response. |
| Account deletion | Pending final confirmation | Warning open; aggregate server baseline captured; image verified on both clients. |

This is a personal-account walkthrough. Organization invitations, multi-user permissions, Apple purchases, every code edition, all failure/retry combinations, and every exposed control have not been exhaustively tested. Do not label this “everything passes” or full release acceptance.

## Automated release evidence

Passed: Trash policy/HTTP/web preflight; disposable PostgreSQL recovery; Vercel/static marketing routing; offline/recovery; all-edition search parity; search position; Reader recovery; Settings wording; continuity; schema readiness; backend performance; account export/authorization/deletion inventory; sync state/conflicts; Research summary/context; minimal Free access. Deploy content inventory also passed. Client build passed. These do not replace live user-journey acceptance.

Owner chose and completed a real subscription. No temporary entitlement was granted. Renewal cancellation was verified in Stripe; final account deletion must also report its billing stage. Client builds passed; broad smoke remains the recorded W002 gap.

## Evidence conventions

Each finding should include steps to reproduce, expected/actual result, affected version, and verification after repair. Distinguish source/test success, Production behavior, physical development build behavior, and TestFlight behavior. Never store credentials, verification codes, raw account exports, or personal account data here.

### Report version check

- Export new version created VERSION 1 with 5 included items and a Download Web PDF action. Version creation passed.
- Download Web PDF clicked; no PDF yet observed in Downloads and no new tab. Actual downloaded output remains unverified; not counted as export success.

### Recovery, provenance, and usage checks

- Physical iPhone Structured facts renders the same parcel address, BBL, borough, block, lot, ZIP and zoning districts. Address Source details expands to NYC Department of City Planning MapPLUTO, matching BBL, retrieved/updated 2026-09-21.
- Clicking the second Notebook evidence chip opens a Reader explicitly labeled Building Code (2014); historical citation destination passed despite W003 ambiguous chip label.
- Removed the historical Saved row through its Remove button. Row disappeared and Undo appeared. Account > Trash loaded an authenticated entry `1 Project evidence`, available for 30 days. Restore / Undo completed and collapsed the Trash detail. Final restored-row/native verification pending. W001 authenticated list/restore endpoint execution now observed on Production.
- Account usage is 99 included Research turns after one successful turn and one interrupted verification attempt. The failed follow-up did not consume a second included turn.
- Started Download for Offline Use. Completion and actual disconnected behavior remain unverified.

- Restored historical row is visible again on web with its iPhone-authored private note intact. Native Project card again shows 2 saved. Recovery passed for this Project evidence record.
- Created an orange Project on iPhone; actual saved name `IOS` (Mirroring input dropped characters). Web Manage Projects shows `IOS` and its imported address, establishing native-to-web Project creation sync. An address entered without borough resolved to Brooklyn; do not use this ambiguous input to claim a Manhattan lookup defect. The original fully specified Manhattan fixture remains correct.
- Native Account also shows 99 Research turns and latest push/pull at 7:18 PM with last error none.
- Mirroring paste failed with a clipboard timeout and temporarily lost the window. Rebinding and raising recovered control. Native text entry remains unreliable under this automation; verify actual entered values before judging app validation.

- Web editing of native-created Project: changed name to QA iPhone Sync, supplied full `350 Fifth Avenue, Manhattan, NY`, and synthetic description. Lookup immediately resolves correctly to Manhattan parcel with 30 facts. Initial Save leaves the editor open showing imported facts; subsequent Save begins persistence. Final persistence/native rename verification remains pending.

### Native Research and Project lifecycle

- Web rename and fully qualified Manhattan address persisted and appeared on the native Project card.
- Manage Projects > Select > QA iPhone Sync > Archive Selected moved that project into Archived; Restore Selected returned it to Active. Original populated Project retained.
- Native Research history shows the web-created conversation, exact successful answer, failed follow-up and preserved question. Source details show the 2022 edition and evidence limitations. History synchronization passed.

### W005 — Project-launched Research appears unassigned

- Start Research from the 2022 Saved item within QA Walkthrough Project on web. Open synced conversation on iPhone.
- Actual native header: Project Unassigned. Report source picker also had no Project Research to include.
- Expected: Project-launched Research should preserve the initiating Project, or clearly explain an intentional unassigned state.
- Status: observed; investigate assignment semantics before calling data loss.

### W006 — Research governing citation cannot open on iPhone

- Open the synced Research conversation on physical development build 1.0 (41), expand source details, tap Governing BC § 101.1.
- Actual: navigates to Search with message `Permitext could not locate this section in its installed code edition.` and Retry opening section; recent BC 101.1 items are visible below.
- Expected: open 2022 BC 101.1 in Reader, matching the successful web citation destination.
- Status: failed native citation resolution; retry/recovery and local reader availability need checking. Build provenance may matter; no TestFlight acceptance claimed.

### Export, search, and citation recovery evidence

- W006 recovery: tapping Retry opening section opens native BUILDING CODE · 2022 / 101.1 with correct title passage and Project membership. Initial navigation failed; recovery passed.
- Native Project hub received REPORT V1 (5 items, Stored: Web PDF). Export & Save iOS PDF generated a 43 KB PDF and opened the system share sheet. Markup preview rendered a 5-page PDF; inspected introduction, sourced property facts, both published code passages, Notebook body and professional-use notice through final page. Native PDF generation/rendering passed.
- W003 also affects exported native Report: final-page published-code headings both show BC · 101.1 · 101.1 Title. without visible 2014/2022 edition disambiguation; document header identifies default 2022. Historical content identity needs explicit edition in export.
- Web Download Web PDF re-enabled with no visible error, but no file appeared in Downloads and a 15-second browser download-event wait timed out. Browser-host download limitation versus app defect remains unresolved. Do not mark web download passed based on stored-file existence.
- Web no-match query `qa-no-matches-923812` returns 0 Matches and helpful No exact match guidance. Phrase search `means of egress` returns 25 matches; Load more matches increases to 50. Both checks passed.
- Reader definition City opens a dialog with `The city of New York.` and authority/edition/section citation. Definition dismissal passed.
- Offline download remained Preparing offline app across several minutes, then reopening Account returned the initial Download for Offline Use state without readiness confirmation. Actual offline readiness not established.

### Real subscription cancellation

- Account > Manage Subscription opened the real Stripe customer portal. The existing subscription showed $21.78/month and October 21, 2026 next billing date.
- Completed cancellation through the customer portal. Final portal state: `Cancels Oct 21` and `Your service will end on October 21, 2026.` The offered reversal is `Don't cancel subscription`.
- Renewal cancellation passed. Access remains through paid period for remaining checks; no refund requested or implied. Account deletion still pending.
- Native PDF saved through system Files picker to On My iPhone and dismissed back to Permitext; no external recipients selected.

### Workspace and native search checks

- Created QA Layout workspace. New workspace starts empty; added Reader and Search. Group creation rejects only one selected column with explicit `select at least two columns` guidance. Creating QA Reader Group with both columns adds named group controls. Typography increase accepted; collapse behavior still needs visual verification.
- Owner typed native search query after Mirroring input failure. Query 101.2 returns 37 matches across installed editions; expanding Building Code 2022 opens correct Scope text with edition metadata.
- Saved native BC 101.2 and assigned it to QA iPhone Sync. Web Saved for that Project rendered Section 101.2 Scope with matching text, confirming native save/membership reaches web.
- Native bookmark removal toggled back to unfilled state and removed membership controls. Checking propagation after reload; do not count deletion sync until settled.

### Reader, account, and recovery checks

- Native current Building Code chapter list opens Chapter 1; chapter search `scope` returns section 101.2 plus passage matches and navigates to 101.2 in Reader. Tapping alteration opens a definition with 2022 authority and section attribution. Reader/search/definition journey passed.
- Web Profile Other role validates nonempty description. Entered QA tester and blurred; Account now displays QA tester.
- Restore Purchases rejects `invalid-qa` with explicit cs_/sub_ format guidance. Restoring the actual same-account subscription completes and returns Account UI with Pro access. No new purchase initiated.
- Web Trash received native deletion record containing 1 saved passage and 1 Project evidence. Restored that record through web. However Project Saved still showed 101.2 after native removal and web reload before restoration: investigate stale/resurrected Project evidence; global bookmark vs Project membership semantics need confirmation before root cause assignment.
- iPhone Mirroring later returned capture failure (-3811). This is a tooling interruption, not evidence of a Permitext crash.

### W007 — Archiving the final Note hides archive access

- In web Notebook with one active Note, Select notes > choose QA Evidence Comparison > Archive selected notes.
- Actual: active Note disappears and empty Notebook shows only Create first Note. Show archived notes control also disappears.
- Expected: archived-note recovery remains available when no active Notes remain.
- Status: observed. Testing whether creating another Note restores the archive control as a workaround.
- Native Reader cross-reference from BC 101.3 to Chapter 1 of Title 28 opens GENERAL ADMINISTRATIVE PROVISIONS · 2022 / 28-101.1. Cross-reference navigation passed.

- W007 workaround confirmed: creating QA Archive Recovery Note brings back Show archived notes. Restoring original Note succeeds. Empty archive then also hides Show active notes; closing/reopening Notebook recovers active list. Original body and both references intact; both Notes visible on iPhone.
- Web in-reader search `scope` produces three matches matching native chapter search; clicking Scope exits find view and returns Reader.
- Started one native Research request (no retries): `What does BC 101.1 call this code?` Native new chat correctly uses QA Walkthrough Project, unlike W005 web-origin conversation.

### W008 — Native Research notice primary button has no visible label

- First native Research submission opens Research Notice with data-use explanation, Privacy link, Cancel, and a white primary pill with no readable text in dark appearance.
- Expected: clearly labeled primary action with adequate contrast.
- Tapping the pill proceeds and starts the request. Functional continuation passed; action discoverability/contrast failed on development build 41.

- W004 reproduced on native submission: new Project-assigned question `What does BC 101.1 call this code?` failed with the same enacted-evidence verification error. No retry performed. Native request lifecycle/error preservation works, but answer reliability fails for this basic query too.
- Native-created iOS PDF file metadata synced back to web Report V1 (Download iOS PDF now offered alongside Web PDF).
- Edited Report using heading, paragraph and list blocks; Save draft advances displayed Revision to 2. Export new version started; final version-history check pending.

### W009 — Project deletion confirmation opens behind disabled manager

- Web Manage Projects > Select > QA iPhone Sync > Delete Selected.
- Actual: Manage Projects becomes disabled including Close. Screenshot shows a `Delete 1 Project` confirmation behind the manager, partially covered and inaccessible. DOM accessibility snapshot only exposes disabled manager; no JS dialog.
- Confirmation wording says permanently delete, cannot be undone, saved bookmarks remain. No final deletion confirmed or performed.
- Expected: confirmation on top with usable cancel/confirm actions and accurate recovery wording.
- Status: reproducible blocker for this UI path. Reload required to escape pending confirmation; Project remains intact. Do not misreport as server deletion failure.
- Report VERSION 2 completed with 8 items, while VERSION 1 remains listed with original 5 items and both PDF formats. Version history passed at UI metadata level.

### Latest verification boundaries

- Native Account shows QA tester profile role after web edit, and still 99 turns after failed native Research request (no additional turn deducted).
- Native font-size slider visibly changes Reader preview (10–24 pt observed); Mirroring drag precision is unreliable. Asked owner to restore original 17 pt / spacing 0. Do not classify automation precision as an app defect without manual reproduction.
- Native Data & Storage exposes Clear Recent Searches, Trash / Undo deletion and Delete saved content. No explicit offline download control observed in this screen; disconnected native operation still unverified.
- Correction: Note Delete selected notes was invoked, but no final warning confirmation was accepted. Source confirms it waits for a warning before deletion; Trash remained empty. Note deletion is not yet a completed test.

## Remaining checks before final account deletion

- Finish Note deletion warning/restore and Project deletion blocker reporting; comment clearing and content persistence.
- Verify remaining workspace group/layout behavior and profile controls with explicit outcomes, not clicks alone.
- Resolve web PDF download and offline readiness limitations; do not equate iOS PDF success with web download success.
- Verify native account settings cleanup and final account deletion on both clients, including signed-out state and subscription cancellation retention.
- Consolidate coverage table, open defects and blocked checks; commit final findings. Account deletion has not happened yet.

- Owner restored native font to 17 pt, spacing 0; verified screenshot.
- Owner explicitly approved final deletion of QA Archive Recovery Note. Confirmed Delete Note; Note disappeared from web active list, original Note retained. Notebook deletion completed; normal user recovery is not provided by this route.
- Native Data & Storage selected-project deletion clearly promises Move 1 Project to Trash, restore within 30 days, saved passages and notes remain. Confirmed deletion of QA iPhone Sync; native currently verifying recovery and syncing. This route differs from W009 web manager wording/overlay.

- Native Project deletion eventually propagated: after web reload/settled Account state, Manage Projects lists only original QA Walkthrough Project. The earlier visible stale entry was a delay; do not claim persistent resurrection from that observation alone.
- Native Trash lists deleted QA iPhone Sync with 1 Project/collection and 1 Project evidence. Invoked native Restore / Undo; syncing in progress. Post-restore native/web verification pending.
- Requested owner-assisted physical offline check because Mirroring requires connectivity: disable Wi-Fi/cellular temporarily, read Building Code 2022 and search 101.2, restore connectivity and report result. Awaiting response.

- Additional workspace checks: renamed QA Layout to QA Layout Renamed, duplicated it as QA Layout Renamed Copy with Reader/Search retained. Close all followed by Groups > QA Reader Group restored both columns.
- Uploaded a synthetic 240×120 PNG to QA Image Note. Web image reports loaded with correct natural dimensions; native Project lists QA Image and original QA Evidence Comparison, with deleted QA Archive Recovery absent. Native Project also shows Report V2 with eight items.
- Native Project restoration confirmed: QA iPhone Sync is back with one saved item, and Trash shows no recoverable items.

### Pre-deletion aggregate baseline

Verified exact disposable email against server account in memory; no raw export saved. Both operator endpoints return required v2 schema. Native private image renders purple/teal correctly and reports Synced.

```json
{
  "schema": "permitext-account-record-export-v2",
  "accountSHA256": "02fbe2b290ccc579b09e81b01532bfe64814f94036dcfe388c1a59920b8c2b95",
  "hasAccount": true,
  "hasEntitlement": true,
  "hasSession": true,
  "mutationCount": 12,
  "recordCounts": {
    "trash": 0,
    "accountLifecycle": 0,
    "foundationArtifacts": 10,
    "projectLinks": 14,
    "researchAnswers": 1,
    "activityEvents": 22,
    "researchConversations": 2,
    "researchUsage": 1,
    "researchOperations": 3,
    "researchCredits": 0,
    "researchFeedback": 0,
    "migrationCheckpoints": 1,
    "artifactRevisions": 3,
    "comments": 0,
    "evidenceSnapshots": 1,
    "researchPurchaseClaims": 0,
    "organizations": 0,
    "organizationDeletionDependencies": 0,
    "organizationMemberships": 0,
    "projectMemberships": 0,
    "organizationInvitations": 0,
    "projectOwnerships": 0,
    "codeQuestionCounters": 0,
    "codeQuestionPendingIssuance": 0,
    "codeQuestionOutbox": 0,
    "sessionMetadata": 2
  },
  "deletionOwnershipReview": {
    "required": false,
    "projectCount": 0,
    "organizationCount": 0,
    "sharedRecordCount": 0,
    "dependentOrganizationCount": 0
  }
}
```

- Final account-deletion warning reviewed: explicitly lists private images/synchronized content, Stripe-first cancellation, external identity exclusions and retained provider records. Awaiting action-time owner confirmation.

- Private comment clearing: keyboard select-all/delete cleared the field; authenticated server export confirms the annotation body is empty. Initial automation fill/close did not persist, so keyboard path is the verified path. Native empty-comment rendering remains unchecked.

- Owner confirmed final account deletion. Entered DELETE and submitted once through web customer UI. Clerk correctly requested fresh email verification before proceeding; awaiting owner OTP entry. No cleanup success claimed at this stage.

### W010 — Account dialog obscures deletion identity verification

- Owner reported that Verification required was not visible. Accessibility snapshot exposed Clerk verification heading/input, but screenshot showed only native Account dialog and Verifying your sign-in identity status.
- Read-only DOM inspection confirms open native HTML Account dialog and separate Clerk verification dialog with an on-screen bounding box. Account modal covers the verification flow; accessibility presence is not visual acceptance.
- Escape dismissed the covering panel and canceled identity verification. Visible result: Account deletion paused; Identity verification was canceled. No account data was deleted.
- Status: deletion UX blocker. Do not keep asking owner for a code in an inaccessible dialog. Customer flow needs modal coordination repair or a verified alternate client path before completion.

- W010 repair: release the native Account dialog before Clerk verification begins, preserving verification-before-server-deletion ordering. Regression contract asserts Account is closed during verification and progress, including cancellation and account-switch races. Syntax, reverification, and offline/cache contracts passed. Production rendered verification pending.
