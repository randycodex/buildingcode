# Column UX continuation

Updated September 16, 2026. Implements the consolidated September 12–13 column review authorized in this task. Preserve existing web visual decisions and native iPhone navigation; there is no iPad product. Navigation experiments remain proposals, not required redesigns. Physical build 66 was installed and reviewed in a short signed-in journey; see PERMITEXT_COLUMN_UX_TESTFLIGHT_66.md. The current branch changes are newer and are not installed on the phone. Publication is separate from local completion.

## Current checklist — September 16

Completed implementation is listed separately from acceptance checks that have not passed. A remaining check is not a confirmed defect. The work is not marked complete; implementation and remaining verification are tracked separately. Earlier checkpoints below are historical; this checklist and PERMITEXT_COLUMN_UX_CLOSEOUT.md take precedence over their old pending statements.

| Column / surface | Done | Not done / not yet verified |
| --- | --- | --- |
| Research | Web/native draft persistence implemented; context/layout contracts; native cache isolation tested; production new-chat draft reload, context disclosure and visible selection checkmark verified | Authenticated native lifecycle; live existing-conversation follow-up restoration. No paid Research submission was made |
| Notebook | Production insertion, reference open/return, refresh and rename verified; native read-only linked sheet preserves original edits; conflict recovery and missing-reference guidance verified in isolated Simulator fixtures | Live native sync/access revocation; physical editing-position and keyboard checks |
| Reader | Source orientation and preview/keep contracts; native paragraph routing, independent readers and table destination verified | Physical horizontal table gestures and interruption/background recovery |
| Report (deferred by owner) | Draft-first source picker and save protection; production save/reload, source inclusion and version creation; local PDF pages, embedded image and issued-snapshot independence verified | Deferred: production PDF delivery/content and historical-version output comparison |
| Saved | Project/global removal labels, pinned tools and recovery implemented; account-isolation/SQLite checks; native Save–Remove–Undo verified | Authenticated sync propagation; physical gestures |
| Project context / facts | Optional fields inspected; native unknown/empty/source disclosure rendered; partial/stale-response handler tests and warning rendering; production successful lookup and Cancel verified without saving | Live partial-response presentation; authenticated native project flow |
| Search | Web query/filter/page/selection/scroll restoration; native query/filter/row relaunch, paragraph destination and complete authored counts; large-text recent rows verified | Signed-in lifecycle and physical interruption/keyboard checks |
| Detail | Passage identity, Open in Reader and private notes; controlled sync failure/Retry rendered; local failure, stale-status rejection and draft retention tested | Signed-in save failure/retry under actual network interruption |
| Account | Web modal, focus and recovery explanation; native guest sheet; isolated archive/restore and offline installer recovery tests passed | Live archive restoration (no archived project available), authenticated native sync and update installation |
| Workspace / global | Shared General-workspace explanation; project ownership/layout contracts; production new-project Saved-only reload; visible focus and non-color selection | Cross-device account lifecycle and physical acceptance |

### Owner-reported iOS follow-up

- [ ] **Search across code editions, including the 1968 Building Code.** Owner reports that iOS Search only works for the 2022 Construction Codes and cannot find a section from the 1968 Building Code. Reproduce with a known 1968 BC section, investigate edition selection and search coverage, and correct the failure. Verify that the result opens the matching 1968 source and that 2022 searches continue working. Status: all-edition search and source-specific result routing implemented locally; bundled-corpus keyword/destination test passed. Exact 1968 BC §27-598 lookup, query replacement, and clearing an in-flight search now pass on the bundled-corpus Simulator test; rendered 1968 result/source, query return and subsequent 2022 result checks now pass on the existing Simulator. Cross-edition cold timing remains open.

- [ ] **Reader chapters fail with “Chapter HTML Missing” across multiple code editions.** Owner screenshot shows “1968 Building Code · through 2026-07-25”, Chapter 1 / Subchapter 1: Administration, while the missing-file diagnostic points to `CodeContent/authored/new-york-city/2026-enacted-administrative-code`. Owner reports many chapters affected, including other codes. Investigate source/edition routing and bundled chapter availability; do not assume missing files alone explain the mismatch. Verify chapter opening across affected editions and both Readers, with heading, source path, and actual content agreeing. Treat as a reading-blocking issue, separate from the search failure, while investigating whether they share a cause. Status: flat chapter-ID lookup and guarded shared Appendix K routing fixed locally; focused bundled-source tests passed. Rendered 1968 Chapter 1, formerly HTML-only Plumbing Chapter 1, and 2014 Building Code table/figure checks pass. Full chapter-opening coverage in both Readers remains open.

- [ ] **Seamless code switching in the iOS Reader.** Owner reports that choosing another code from the Reader’s top code selector replaces the entire app with the Permitext startup/loading screen. Screenshot shows “Loading New York City - 2022 CONSTRUCTION CODES…” at 0%. Keep the app navigation and Reader surface visible during code changes; reuse already-loaded content where possible and scope any necessary loading feedback to the Reader. Verify switching between code families and editions in both Readers without the full-screen startup transition, losing unrelated tab state, or showing mismatched source headings/content. Status: replacement code snapshots publish atomically while retaining the current app hierarchy; failed replacements retain readable content. Source builds; changing Reader 1 to 1968, visiting Reader 2, and returning preserves their separate edition selections in the normal Simulator app. Reader 2 also switches to Existing Building Code independently and retains that choice on return. Retained open-chapter positions and transient frame timing remain open.

- [ ] **Open chapters without the “Preparing native Reader…” interstitial.** Owner does not want the blank Reader body with a centered spinner and implementation-specific preparation message when opening any chapter of any construction code. Screenshot example: Administrative Provisions - 2014, Chapter 2 / AC CHAPTER 2 - ENFORCEMENT. Investigate chapter preparation latency and reuse/preparation of Reader content so opening a chapter presents its text promptly, without this interstitial or substituting an equally blank screen. Preserve accurate source identity and navigation; do not hide genuine load failures. Verify first opens and repeat opens across code families/editions in both Readers. Status: cached native chapters now seed first-frame state; technical preparation labels removed and transient progress delayed. Build and exact-route/cache-purge tests pass. Cold-load latency, blank intervals and rendered acceptance across both Readers remain open.

### Owner-requested web and iOS follow-up

- [ ] **Definition references throughout every code's chapters.** Audit every defined term from the definition chapters against its applicable occurrences elsewhere in the same code and edition, on both web and iOS. Clicking or tapping an applicable defined term should open a compact definition pop-up without navigating away or losing reading position. Show the definition's source section and edition; preserve any chapter-specific scope and avoid linking ordinary uses to an inapplicable definition or a different edition. Check multiword terms, case/plural variations, repeated occurrences, tables, keyboard accessibility, dismissal, and touch behavior. Produce a coverage report identifying missing or ambiguous references; do not mark complete based on a few examples. Status: shared web/iOS registry and pop-ups implemented locally for both native and HTML Readers. Current index contains 5,602 entries: 4,198 direct meanings, 1,237 resolved references, 22 source-labeled alternatives, 145 unresolved references and zero ambiguous references. All bodies are checked against their cited source wording; web/iOS data match. All 533 corpus chapters map, including combined appendices. Definition chapters and embedded definition sections are excluded from decoration. Representative web pop-ups and native definition checks pass. The Simulator 1968 pop-up test verifies exact source, dismissal and reading position; a separate rendered test verifies Definitions chapters remain undecorated. Parser checks pass 48/48 and published-data checks pass 22/22. Full applicability/occurrence review, unresolved targets, extraction/scope review for five additional code collections, and native touch/rendered acceptance remain open. EBC-to-administrative cross-collection source currency is explicitly unresolved; no source edition is silently substituted.

### Repository / publication

- [x] Committed and pushed the earlier work before starting the continuation branch.
- [x] Prior `codex/column-ux-continuation` work was merged/pushed before this follow-up. Current branch is `codex/ios-reader-search-followup`; subsequent local commits have not been published.
- [x] Web changes through `5be5e9259` were deployed and production-verified. Later native/fixture/documentation changes are not a new iPhone release.
- [x] Preserved `DO NOT DELETE.png`, existing user data and sample projects. No destructive live-data acceptance checks.
- [ ] Finish the outstanding acceptance checks above before claiming the entire goal complete.

### Deferred by the owner

Physical iPhone touch targets/Dynamic Type, table gestures, background/interruption recovery, reference editing position and keyboard behavior. These are deferred, not failed. Authenticated native and production PDF checks are separate from phone availability.

## September 16 Reader and Search corpus verification

- Rechecked all 574 entries in the bundled native Reader index: source HTML and compressed document files exist and match their recorded SHA-256 hashes; no structural-validation flags failed. Collections: 2014 construction (111), 2022 construction (159), specialty (22), enacted administrative (134), Existing Building Code (31), zoning (117).
- On the existing Permitext UIUX Review Simulator, `testPhaseNineAllEligibleDocumentsPassSemanticAndAssetParity` passed for all 574 documents (21.817 seconds for the whole test). This exercises native document decoding, source identity, text/anchor/link/table/image parity and asset validation; it does not establish visible opening latency or every navigation route.
- `testAllEditionSearchFindsHistoricalTextWithoutChangingMainReader` passed (19.774 seconds for the whole test), covering historical keyword results, exact 1968 BC §27-598, result destination edition, replacement of an in-flight query, clearing Search, and preserving the main Reader edition. Total test duration is not an individual-query latency measurement.
- Evidence: `/tmp/permitext-column-ux-build/Logs/Test/Test-permitext-2026.09.16_07-09-17--0400.xcresult`; log `/tmp/permitext-reader-search-corpus-check.log`. Two tests, zero failures. Reused the existing simulator and derived-data directory.
- Remaining: rendered cold-opening blank intervals, navigation through both Readers across editions, and physical/authenticated lifecycle acceptance. No application changes or publication in this verification pass.

## September 16 cold native preparation measurement

- Added `testEveryBundledChapterPreparesDisplayContentFromColdCache`, covering all 574 chapters with the prepared-document cache reset before each load. It verifies source identity, nonempty display content, one successful disk preparation and the existing memory bound.
- Passed on the existing Simulator: preparation p50 10.6 ms, p90 73.5 ms, p99 207.0 ms. Slowest was 1,311.4 ms for enacted administrative `30000088.html` (the consolidated Building Code enactment chapter), followed by 549.3 ms for `30000095.html`. Timings are diagnostic observations, not enforced speed thresholds, cold OS filesystem-cache measurements, or end-to-end visible opening measurements.
- Log: `/tmp/permitext-cold-chapter-preparation.log`. Test duration 16.505 seconds, zero failures. No duplicated simulator or derived-data directory.
- Source inspection also confirms passage restoration hides the Reader during a 60 ms layout wait plus a 120 ms second-scroll wait. Removing either requires rendered restoration verification; no timer or source-integrity check was removed based on this measurement.
- Application behavior and deployment unchanged. Next performance work should target large consolidated chapter preparation and measured restoration behavior, rather than treating the removed loading message as a completed fix.

## September 16 shared cold chapter preparation

- Native Reader requests now atomically join one in-flight preparation per document. Background warmup and visible Readers no longer independently decode the same uncached chapter when their requests overlap.
- Cancellation releases only that requester; shared work is cancelled when its last requester leaves. Completion publishes once, retains existing count/memory limits, and does not refill a cache purged by a memory warning during the load. Source/hash/asset validation remains unchanged.
- Four new native tests passed: eight simultaneous requests cause one disk preparation; cancelling warmup preserves another Reader request; cancelling the sole requester permits retry; a memory warning during preparation prevents cache refill. Both existing bounded-cache tests also passed (six distinct tests, zero failures).
- Evidence logs: `/tmp/permitext-shared-preparation.log`, `/tmp/permitext-preparation-cancellation.log`; final result `/tmp/permitext-column-ux-build/Logs/Test/Test-permitext-2026.09.16_07-26-39--0400.xcresult`.
- Local implementation only. No release/deployment or measured end-to-end physical-phone speed claim. Passage-restoration delays and rendered cold opening remain open.

## September 16 layout-confirmed passage restoration

- Native Reader now attempts the initial scroll after yielding to layout, without first imposing the 60 ms wait. When the existing geometry observer identifies the requested block at the top, it reveals content and persists that position immediately. Existing 60/120 ms retries remain as fallback for lazy/off-screen layout; cancellation guards remain intact.
- Rendered Simulator checks passed for the scoped HMC passage/popover/dismissal position and Search opening 1968 BC §27-598 followed by 2022 BC §722.2.1.1. Both Search destination screenshots were inspected and show the correct requested passage at the top and matching edition.
- Evidence: `/tmp/permitext-column-ux-build/Logs/Test/Test-permitextPhysicalStress-2026.09.16_07-29-12--0400.xcresult`; screenshots in `/tmp/permitext-restoration-layout-captures`. Two UI tests passed, zero failures.
- This removes mandatory waiting when layout confirms arrival; it is not a measured physical-device latency improvement or full deep-scroll/background restoration acceptance. Local only, not deployed.

## September 16 spelled-out acronym definition names

- A heading with a validated explicit acronym now exposes both that acronym and its exact expanded phrase as aliases. Acronym letters must match the heading initials (optionally excluding connecting words); arbitrary parenthetical scope qualifiers remain intact.
- Rebuilt shared web/iOS data: 84 entries gained their printed expanded-name alias, with no new alias collisions against distinct meanings in the same indexed book. Fire Code LOWER EXPLOSIVE LIMIT now resolves its printed “Lower flammable limit” reference to the exact LFL definition and source. Unresolved references decreased from 145 to 144; no edition boundaries were relaxed.
- All 97 focused parser, registry, matcher, published-source and offline checks passed. Coverage audit: 533 mapped chapters, zero unmapped, 187,385 candidate occurrences, 1,509 unmatched entries. These counts are not a full semantic or rendered acceptance claim.
- Web cache references advanced together; native bundled registry is byte-identical. Local only; no deployment or physical-phone verification.

## September 16 prior-code reference mapping

- Resolved the printed singular/plural heading mismatch for PRIOR CODE BUILDING within §28-101.5. Mapping is limited to the exact reviewed target phrase, same section, administrative source, and 2014/2022/enacted collections. No generic plural inference or cross-edition fallback was added.
- Seven entries now resolve, including four 2022 construction-code references through the administrative definition. Both numbered branches of the source meaning and the §28-101.4.2 qualification remain intact. Unresolved count decreased from 144 to 137.
- All 99 focused parser, registry, matcher, published-source and offline checks passed. Negative cases reject a different edition, section, code and conflicting meanings. Shared iOS/web registry rebuilt identically; web cache references advanced together.
- Coverage remains 533 mapped chapters, zero unmapped, 187,385 candidate occurrences. Local only; no deployment or physical acceptance claimed.

## Verification

For each changed surface: focused contracts, UX audit/alignment checks, app-shell offline checks when applicable, rendered web checks, and native build/Simulator checks. Record failures on the unchanged baseline separately. Never count source inspection as rendered or physical-device validation.

Baseline fixture issues confirmed against b979339c5 are now repaired: account isolation supplies and observes shared-workspace catalog reconciliation; startup supplies the optional DOM lookup and extracts Reader trust using its current boundary. Both contracts pass with existing behavioral assertions retained.

## Deferred physical iPhone checklist

- [ ] Large text and touch targets in changed lists, references and property feedback.
- [ ] Reading-session restoration and tables during background/foreground and relaunch.
- [ ] Unsent drafts, interrupted saves, offline recovery and account isolation with real lifecycle interruptions.
- [ ] Reference navigation back to the original note and editing position; keyboard behavior.

## September 14 continuation checkpoint

Implemented on codex/column-ux-continuation:
- Web: removed the blanket suppression of keyboard focus while retaining quiet pointer focus. Visible focus verified on the rendered Saved toolbar control.
- iPhone Notebook: linked Notebook notes have distinct names/icons and an Open linked Note action. A separate read-only sheet preserves the original editor; existing unavailable/access-revoked handling remains in the destination.
- iPhone project lookup: displays backend partial-result warnings, uses an information indicator for partial results, and ignores stale-address responses.

Verification: UX audit, all eight UX/alignment contracts, offline contracts, property-context contract and Notebook-reference availability contract pass. Xcode Simulator build succeeds. Native interaction/Dynamic Type verification and light-theme web verification remain open; no physical phone validation claimed. The checkboxes above deliberately remain open for requirements not fully audited.

## Search and Detail checkpoint

- Native recent passages now use full-width, content-sized rows with scalable text and a separate bookmark target. Removed the obsolete paged two-column grid. Accessibility text sizes allow titles/previews to expand.
- The native chapter-anchor history path obtains a passage-body preview through the existing detail loader; cached history text is retained when the body is unavailable.
- Web recent rows have no fixed 136px height and permit multiline titles with bounded excerpts. A rendered recent item measured 149.875px, retaining its title and preview.
- Detail identifies the code/version, gives the passage action an Open in Reader tooltip/accessibility label, and labels the private note separately.

Verification: Simulator build, UX audit, all UX alignment contracts, Search Reader reuse contract and offline contracts pass. Native guest journey Reader chapter -> Search verified with a real corpus passage; recent row rendered in dark/light appearance and larger text (Device Hub sizes 6 and 7). Simulator settings restored to dark/size 3. Signed-in native verification is still open: default launch asserts in Clerk.configure; existing debug flag --permitext-disable-clerk enabled guest-only checks. No authentication configuration or production behavior was changed to bypass that failure.

Remaining Search/Detail work: numbered paragraph parent identity, complete query/filter/selection/scroll recovery, long-title/accessibility stress cases, and signed-in note failure recovery. Do not mark these surfaces complete based only on the row verification.

## Report editing checkpoint

- Draft identity and editor precede the source library. Add sources is a persistent disclosure; included sources say Added. Done adding sources returns focus to Report content.
- Save draft and Export new version distinguish editable saves from immutable exports. Existing generation and manifest behavior is unchanged.
- The closed source picker displays unavailable-source counts, including after source refresh.

Verification: Report contract, all eight UX alignment contracts, and offline contracts pass. The isolated Research-to-Report handoff contract passed with zero external/provider attempts. Rendered Report verification remains open: the browser client blocked the temporary synthetic review page despite a local HTTP 200 response. The temporary page was removed. Signed-in continuity remains to be verified; Report is not complete.

## Report pending-save protection

The save operation snapshots submitted content and coalesces duplicate clicks. A delayed response advances the saved identity/version but preserves newer editor content and leaves it dirty, without rerendering the editor. Export stops until newer edits are saved. Closed panels, switched drafts and changed accounts ignore stale responses.

The executable report-save-continuity test runs the actual save closure with deferred responses and covers newer text/blocks, duplicate clicks, expected-version retry, draft switch, disposal, account change and failure. Rendered signed-in verification remains open.

## Native Research composer draft checkpoint

Unsent composer text now uses the existing private offline cache, scoped by account and conversation. User edits persist through a binding; programmatic view resets do not erase another conversation's draft. Restoration fills an empty composer after the conversation is available and never sends. Deleted conversations remove their draft. Submitting clears only matching composer text after a recoverable request attempt exists. Local write errors are visible and clear after a successful retry.

The focused native XCTest passed on the review iPhone Simulator (one test executed, zero failures/skips): disk reopen, account and conversation isolation, clearing text and conversation deletion. Simulator build passed. Signed-in UI lifecycle and physical interruption testing remain open; the cache test is not an end-to-end lifecycle claim.

## Verification fixture repair

Account isolation now asserts that obsolete account responses never reconcile the shared catalog, while the current account remains connected and reconciles exactly once. Startup still checks authentication before private rendering, nonblocking optional metadata, unavailable-source feedback/retry, and edition selectors. Both tests pass. Timing is a controlled request/renderer fixture, not an actual device paint benchmark. No product code changed in this checkpoint.

## Saved removal scope checkpoint

Web bookmark controls in Reader and Detail now name the project when removal affects only its membership; general workspaces still say Remove from Saved. Existing removal/Undo semantics are unchanged. Scope-label, actual mutation account-isolation and offline contracts pass. The mutation fixture needed the existing workspace/Undo context adapters supplied; no assertions were removed. Native project removal recovery is covered in the following checkpoint. Saved is not complete.

## Native project removal Undo

Single and bulk project removals now offer a persistent, dismissible Undo bar with 44-point controls. Only successful removals enter the recovery list. Undo restores each original section/version membership; failures remain retryable. Account/session and project changes clear or reject the operation. The swipe label explicitly says Remove from project.

A real SQLite XCTest passed (one executed, zero skipped/failed), proving bookmark/private-note preservation and unaffected membership in another project through removal and restoration. Simulator builds pass. Rendered signed-in project Undo, global Saved deletion recovery and physical touch/accessibility checks remain open.

## Native project fact provenance

The project summary now renders fact status and a collapsed Source details disclosure containing stored source text (including retrieval date where supplied) and an explicitly labeled update date. Empty values read Not provided; unknown/rejected statuses are not silently treated as confirmed. No fact values or classifications are changed. Property-context contract passes. Rendered signed-in Project disclosure verification remains open.

## Account dialog rendered verification

Removed the template's leftover Drag column button from the Account dialog and labeled its close action Close Account. Reused the shared modal focus handler. Actual localhost browser verification: opening Account leaves the Reader in place; Shift-Tab from Close Account wraps to Support, Tab wraps back, and Escape closes the dialog and focuses toggle-settings. Screenshot confirms the modal presentation. Guest offline/access/archive copy is visible; authenticated sync/archive recovery and native Account remain separate open checks.

## Search continuity audit

Verified by executable contracts: independent Search queries, code filters and collapsed result groups survive JSON serialization and a switch to another workspace without aliasing the saved snapshot. Search-derived Readers reuse only their originating Search preview; Keep open and explicit new readers preserve independent/manual Readers. Research continuity checks also remain passing.

Outstanding: result-list scroll position and selected-result identity are not persisted by normalizeSearchInstance/renderSearchResults. Restoring a result beyond the first page also needs pagination recovery; do not call Search continuity complete based on query/filter persistence alone.

## Web Search result restoration

Per-Search state now retains loaded page count, scroll position and edition/passage-aware selected result identity. Application utility normalization preserves the snapshot. Changed queries/filters reset it; render tokens reject stale responses. Restoration replays previously loaded pages (defensive ceiling 1,000 pages) and failed loads retain retry UI; initial query failures also offer Try again. Selection is exposed through aria-current.

Actual browser reload verified with concrete: 50 rows across two pages, selected 722.5.1.4.2, and exact scrollTop 5499 restored. Search state normalization/reset/identity, Reader reuse, workspace and offline contracts pass. Recently viewed inner-list scroll and native Search restoration remain to be audited separately.

## Search history and retry follow-up

Recently viewed now retains its own inner-list scroll offset through application normalization, independent of query-result positions. The capture listener distinguishes the two scrolling surfaces. Pagination retry uses the actual rendered page count, and initial-search errors are ignored after a query/filter change. Actual next-page closure tests cover failure, retry and stale render rejection; normalization and offline contracts pass. Recently viewed nonzero-scroll rendered verification remains open.

## Recently viewed rendered restoration

A short-viewport check exposed grid tracks shrinking and clipping both recent rows instead of overflowing. Explicit content-sized grid rows now retain their intrinsic height and let the list scroll. Actual localhost verification at 1800 by 350: two rows retain approximately 150px each, list scrollHeight 307px versus clientHeight 55px, and scrollTop 252 restores exactly after refresh. Temporary viewport reset and review tab closed. Search position/pagination and offline contracts pass; native continuity remains open.

## Native Search tab continuity

Retapping the Search tab at its root now focuses the field instead of clearing the query/results; the explicit Clear search action remains. Retapping while inside a result retains the existing back-navigation behavior. Review Simulator guest verification: concrete with Building Code selected retains its query, selected filter and 160-result count through retap and Reader-tab round trip. Simulator build passes. Query/filter persistence across process relaunch and exact scrolled-position restoration remain open; this does not establish those guarantees.

The full eight-contract UX alignment suite passes after replacing two outdated web-label regular expressions with execution of the shared bookmark scope contract. Both project-specific removal and general Saved labels are asserted; native label checks remain unchanged.

## Native Search query/filter relaunch

Search now saves query and filter IDs to the existing local private cache, partitioned by account and edition; signed-out Search has a separate scope. Restore runs before searching, without clearing an initial deep-link destination. Account/edition changes replace the old session, while ordinary tab returns preserve it. Explicit clearing persists. Storage failures have visible feedback and do not discard current results.

The first actual default-path test exposed a Simulator cache failure: the database's existing `permitext` directory conflicted with the cache's `Permitext` spelling. The cache now discovers and reuses the existing spelling, retaining the older capitalized location where present. This resolved the observed save failure. Actual guest Simulator terminate/relaunch restored concrete and the selected Building Code filter. Exact scroll/selected-result restoration remains open, as do signed-in UI and physical lifecycle checks.

Final focused XCTest result: two executed, zero failures/skips (Test-permitext-2026.09.14_22-35-43--0400.xcresult). Covers disk reopen, account/edition isolation, clearing, deleted-account rejection without affecting another account, and both existing directory spellings with retained cache contents. Simulator build passes.

## Native Search row-position checkpoint

Snapshots now retain result and recent-history row identities separately, plus the selected result. Older query/filter-only snapshots decode without those optional fields. SwiftUI scroll targets restore after results are ready; changed queries/filters reset result position and selection. Row identity is used so restoration remains meaningful when text size changes.

Rendered review Simulator evidence: terminate/relaunch returned to the same Multicourse floors area; opening Heat transfer and returning retained the list. Changing to Building Code and then clearing that filter both returned to the first matching result. Accessibility activation required moving selection persistence into the button action instead of relying on a simultaneous tap gesture. Recent-history nonzero scroll remains a separate rendered check.

New open finding: activating the 5.12 Concrete operations paragraph result opened Chapter 1 at its start, rather than the paragraph. The destination remained at the start after loading. Investigate passage routing before calling native Search/Reader complete. Native search also caps its unfiltered authored results at 200 before view-side filtering; total-count/filter completeness needs review.

Final button-action build verified through native accessibility: activating 5.12 and returning exposes that result as selected. Position/selection serialization, account/edition isolation, and older snapshot decoding passed in the focused XCTest (one executed, zero failed/skipped; Test-permitext-2026.09.14_22-50-32--0400.xcresult). No physical-device claim.

## Native paragraph destination checkpoint

Search destinations now pass the section title into native Reader location resolution. After remembered positions and explicit anchors, a unique number-plus-text match can select a paragraph display block; heading-only lookup remains the fallback. This avoids treating numbered paragraphs as chapter headings or guessing among duplicate paragraph numbers.

Rendered guest review Simulator: opening 5.12 Concrete operations now positions that paragraph near the top, with 5.13 Demolition work immediately below. Final focused XCTest executed two tests with zero failures: the actual bundled paragraph destination and existing stable block/anchor restoration (Test-permitext-2026.09.14_23-06-33--0400.xcresult). Earlier fixture-resolution attempts failed and are not counted as passing evidence. Native Search count/filter completeness remains open.

## Native authored Search completeness

The main Search request now retains all lightweight authored matches before local code-book filtering. The store still defaults to 200 for other callers, and initial passage-preview enrichment remains bounded at 25. This corrects the hidden truncation without loading every full passage. The legacy SQLite search cap is unchanged and remains a separate limitation.

Actual review Simulator: concrete shows 506 results in All Codes and 455 in Building Code (previously 160 after filtering the capped list). The bundled-corpus XCTest executed once with zero failures, confirming more than 200 matches, stable first-page ordering, and set equality between each directly scoped code search and filtering the complete list. No physical device or signed-in claim.

## Native Saved removal recovery

Removing a bookmark now retains a session-bound source/version and project-membership snapshot. Undo re-adds the bookmark and still-existing project links, preserves newer notes and added memberships, and supports retry after partial failure. Account changes and explicit Clear all bookmarks dismiss the snapshots. The independent second Reader owns its own recovery control. Recovery is session-local, not a relaunch archive.

Final Simulator build and two SQLite tests pass (project removal preservation and Saved Undo with newer notes/memberships, repeated restoration and a deleted project). Rendered guest review: in Reader 1 and independent Reader 2, Save -> Remove -> Undo changes the bookmark back to Saved and dismisses the banner. Both test passages were returned to their original unsaved states, and the banners dismissed. Signed-in sync propagation and physical-device checks remain separate from this local recovery evidence.

## Research and workspace clarity closeout

Added an explicit check/circle selection mark to Research history, hidden outside selection mode; aria-pressed remains the accessible selection state. Added the general-workspace explanation: shared Saved material, independent column layouts. Actual localhost screenshot confirms the explanation fits the existing menu. Existing title fallback uses the starter question for timestamp-only titles; native/web context disclosures remain implemented.

All eight UI alignment contracts and both offline contracts pass. Shell cache is v1048 with asset version 20260914-workspace-selection-v367. Authenticated history selection/context interaction remains in the signed-in integration gate; the guest menu screenshot does not prove that flow.

## Native Recently viewed closeout evidence

Rendered review Simulator at Text Size 9: scrolled the recent list until Heat transfer was the first visible recent passage, terminated and relaunched the app, then reopened Search. Heat transfer restored as the first visible row. This is row-based restoration, not exact pixel-offset equivalence. Title and excerpt wrapped at the larger size. Returned Text Size to 3 and restored the concrete query and Building Code filter. No additional Search implementation was needed.

## Reader closeout boundary

Native keyboard Return submitted the section-number query and opening 722.2.1.1 reached the concrete-wall passage with its table rendered inside the Reader. The table exceeds the visible horizontal width. CUA drag/scroll did not establish horizontal movement; this is unverified, not proof of a code defect. Physical table-gesture verification remains on the already deferred phone checklist. No speculative table implementation change was made. Existing web keyboard-focus/Account Escape evidence and UI/Reader width contracts remain applicable; no unrelated Reader redesign is pending.

## September 15 — Reader and all-edition Search continuation

Working branch: `codex/ios-reader-search-followup`, created after pushing the prior work to `main` at `30fe745a2`. Old feature branches were already absent locally and remotely; the remaining Dependabot branches are separate dependency updates.

Local implementation and evidence:
- Published HTML lookup now accepts stable chapter IDs for the flat enacted/specialty bundles, preserving 2014 family prefixes and 2022 nested chapter-number filenames. Three focused XCTest regressions passed, including the nested-ID collision case (`Test-permitext-2026.09.15_15-05-11--0400.xcresult`).
- Code switches retain the existing content snapshot and tab hierarchy until the replacement snapshot is ready, and publish its edition with the replacement content. Failed replacements retain the prior usable snapshot. Source compiles; rendered switching still needs verification.
- Chapter prewarming now prepares the native document cache as well as HTML. This is groundwork; the native preparation interstitial is not yet fully resolved.
- Search now combines installed editions with edition-aware result identities and code/edition filters. A dedicated Search Reader model opens the selected edition without changing the main Reader. Results publish by edition while cold loading, with stable group order; stores are reused for subsequent searches. The actual bundled-corpus XCTest found 1968 and 2022 matches, confirmed unique result identities, and verified the historical destination without changing the main Reader. Latest run passed (`Test-permitext-2026.09.15_15-15-10--0400.xcresult`). Rendered UI, cancellation, filter relaunch, and search timing remain to verify.
- Definition audit added at `permitext-sync-server/scripts/audit-reader-definitions.mjs`; current output `/tmp/permitext-reader-definition-audit.json`. It inventories candidates from all 14 definition chapters, including zoning and line-break-based source formats. Candidate extraction is not complete applicability/link coverage, and cross-reference-only definitions still need resolution. Neither web nor iOS pop-up coverage is claimed complete.

Still open: Reader preparation transition; rendered Notebook acceptance; full definition reference/pop-up implementation and coverage; remaining lifecycle/export checks. Appendix K routing and build-66 checklist reconciliation were completed in the later checkpoint below. Device Hub UI automation timed out in this run, so no new rendered Simulator acceptance is claimed.

### Latest source checkpoint

- Direct project notes now render the editor in the project navigation destination, so Done returns to the project. New Note sits beside Notebook; View All remains for lists longer than the project preview. Access is loaded before editing, and read-only roles remain enforced. Compiles; rendered acceptance remains pending.
- Appendix K1/K2/K3 now resolve the shared K document only when the requested chapter anchor exists. Actual bundled-source XCTest passed for all three; K4 remains unresolved rather than guessed.
- Recently Viewed records carry optional edition identity, with backward-compatible decoding, and Search routes historical entries through their source edition. Direct history bookmarking remains on current-edition rows; historical items can be saved in their correctly scoped Reader.
- The candidate definition inventory now covers source parsing for all 14 identified definition chapters. Its 3,915 candidates include 902 cross-reference-only entries. These counts are an audit starting point, not a declaration of complete linked-term coverage or implemented pop-ups.

- Validation closeout for this source batch: all-edition historical destination test passed; three flat/nested HTML resolution tests passed; combined Appendix K and edition-preserving history persistence tests passed. Final source build log is `/tmp/permitext-followup-build-confirmed.log`. Search failure has explicit retry feedback rather than being shown as an empty successful search. No new TestFlight upload or production deployment is part of this batch.

### Definition linking checkpoint — 2026-09-15 (in progress)

- Added shared source extraction and an exact-term matcher; neither is wired into production readers yet.
- Imported paragraphs can contain multiple definitions or a bare list pointing elsewhere. Extraction now distinguishes those cases, preserves continuation paragraphs, and recognizes an inline historical `§28-101.5 Definitions` heading instead of attributing it to the preceding section.
- Reference resolution requires matching edition, code, and applicability scope. Explicit Administrative Code references may resolve only to that named code in the same bundle. Ambiguous/unresolved references remain explicit and must not become guessed definitions.
- The audit scans 14 definition chapters and records source hashes, chapter identity, code, edition, and scope. Candidate counts are not a completeness claim. Scope rules, aliases, full source coverage, and source text still need validation before publication.
- Checks: `node --test permitext-sync-server/tests/definition-matcher.mjs permitext-sync-server/tests/reader-definition-index.mjs` (12 focused tests). Reproduce the source inventory with `node permitext-sync-server/scripts/audit-reader-definitions.mjs` (writes to `/tmp` by default).
- Still pending: complete scoped definition registry, ambiguous/reference handling, web and iOS pop-ups, actual occurrence coverage, rendered verification, and physical acceptance when the phone is available. Report remains deferred. Research is authorized for bounded live API verification, without repeated passed checks.

### Shared definition registry checkpoint — 2026-09-15 (in progress)

- Added a shared JSON registry compiler and source-identity selector. Selection requires explicit bundle, code category, and chapter; energy R/C and appendix scopes remain separate.
- Fixed recognition of `§ 28-101.5` headings in published Administrative Code HTML. The audit now resolves 1,078 references, with 268 unresolved and five ambiguous candidates remaining. These are extraction results, not publication approval or complete coverage.
- Added a discovery list for the ten code categories without a chapter titled Definitions, including codes whose definitions appear within general chapters. These require separate source review.
- Generated review data remains in `/tmp/permitext-reader-definition-registry.json`; no reader has been switched to it and no production change was made.
- Reproduce: run the audit script, then `node permitext-sync-server/scripts/build-reader-definition-registry.mjs`. Registry, parser, and matcher tests run with `node --test permitext-sync-server/tests/reader-definition-registry.mjs permitext-sync-server/tests/reader-definition-index.mjs permitext-sync-server/tests/definition-matcher.mjs`.

### Web definition pop-up checkpoint — 2026-09-15 (in progress)

- Added the inline linking and accessible definition pop-up component. Terms can span inline emphasis; existing links and controls are excluded. The component uses text-only rendering for definition bodies and sources.
- Real browser fixture: `node permitext-sync-server/tests/definition-popover-browser.mjs` at `http://127.0.0.1:8898/`. Nine browser assertions passed, covering source-text preservation, emphasis, repeated linking, existing links, HTML injection avoidance, accessible dialog naming, focus/scroll restoration, and cleanup after reader removal. Escape and the rendered pop-up were checked through the browser.
- This is isolated component verification, not full Reader integration or complete definition coverage. Production readers and iOS still need integration after registry review; nothing was deployed.

### Definition source review checkpoint — 2026-09-15 (in progress)

- Preserved grouped definitions (for example Sewer and its listed meanings), fixed imported definitions following closing quotes, and accepted lowercase legal subsection markers inside parenthetical labels.
- Explicit grouped references resolve only when the named child label appears in the published parent definition. Acronyms printed in definition labels and simple explicit “X OR Y” alternatives are retained as aliases; unrelated variants are not guessed.
- Added administrative definition sections and the three published Article 100 definitions in the 2025 NYC electrical amendments. That collection is amendments, not a complete underlying electrical-code corpus; complete electrical coverage cannot be claimed from it.
- General linking excludes entries whose applicability still needs review, including local administrative definition sections outside §28-101.5 and zoning variants. They remain in the audit rather than being dropped or treated as universally applicable.
- Twenty-four focused parser/registry/matcher tests pass. Full source coverage, cross-collection references, runtime web/iOS integration, and the remaining UX verification are still pending. No production publication.

### Local web Reader integration — 2026-09-15 (in progress)

- Connected the registry to real Reader prose blocks without delaying chapter rendering. Captured source context stays tied to the rendered section during code switches. Matchers and selected entries are reused per source context.
- Local browser verified real pop-ups for 2022 PERMIT (§28-101.5), 2014 ALTERATION, and 1968 BUILDING (§27-232), plus edition switching. Definitions with unreviewed applicability remain excluded from general matching. Unresolved references remain explicitly labeled.
- Rendered checks found and fixed two defects: missing historical definition headings must not inherit the preceding Terms not defined citation (show Chapter 2 instead), and FOUNDATION (BUILDING) must not alias BUILDING. Parenthetical acronym aliases now require matching initials.
- Added generated-data checks. Thirty focused tests pass. Offline contract and installer recovery pass. Shell assets are versioned together (v1056 / reader-definitions-v375). Local generated registry has 4,977 unique entries; this is not proof of complete or correct occurrence coverage.
- No production deployment. iOS integration, all-code coverage, unresolved references/applicability, and remaining UX items are still pending. Current local server is an isolated review store, not the user's account data.

### iOS definition integration — 2026-09-15 (in progress)

- Native attributed text now links scoped definitions without replacing existing references or changing text/formatting. Opening a definition is local to the text view and does not navigate to a Reader. Native heading text is excluded.
- Added a compact SwiftUI definition popover and bundled the same registry used by web. The HTML fallback uses a generated copy of the shared web matcher/popover; the WebKit fixture verifies opening, source text, and closing.
- Five focused Simulator tests passed (historical identity, preservation of existing links/attributes, whole-term matching, unknown-edition isolation, and WebKit popup behavior). Log: `/tmp/permitext-definitions-native-tests.log`. The existing Simulator and `/tmp/permitext-column-ux-build` were reused with parallel testing disabled.
- Definition context uses the rendered source file path, not the mutable library selection. A separate regression check covers that path.
- Generation: build the registry with `--sync-ios` to update its iOS copy; run `node permitext-sync-server/scripts/build-reader-definition-webview.mjs` after shared popup changes. `--check` verifies the bundled WebView component is current. The published-data test verifies web/iOS registry byte equality.
- Device Hub UI access timed out, so native visual inspection and physical touch acceptance remain outstanding. No phone installation, TestFlight upload, or production deployment was performed. Source coverage and the remaining UX/Research tasks are still open.

### Definition source-wording audit — September 15

- Audited all 4,977 shipped definition bodies against their cited authored HTML, permitting whitespace normalization only. Found 86 unresolved/ambiguous list references using synthesized “See Section…” wording; replaced these with the original published introductory sentence. Resolved references continue to use the referenced definition's source wording.
- Added a corpus-wide regression check; all bodies now match their cited source. Web and iOS registry bytes remain identical. This is source-wording evidence, not proof of complete term/occurrence coverage or correct applicability for every entry.
- Remaining: full occurrence coverage, unresolved references and applicability review, native visual/phone acceptance, and the other Reader/Search/Notebook/Research continuation items. No deployment or TestFlight upload performed.

### Definition occurrence inventory and long-chapter matching — September 15

- Added `permitext-sync-server/scripts/audit-definition-occurrences.mjs`, a read-only exact-term candidate inventory. Current output `/tmp/permitext-definition-occurrences.json`: 513 mapped chapters, 20 unmapped combined-appendix chapters, 149,025 candidate occurrences outside definition chapters, including 6,901 occurrences involving unresolved/ambiguous references. 1,526 eligible entries have no measured exact occurrence outside their source; this does not prove a defect (some terms may not recur). 222 chapters lack eligible definitions, including deliberately unreviewed zoning/admin scopes. These counts are not rendered-link or semantic-coverage proof.
- Prevented the audit from borrowing flat HTML from another code when a code-specific chapter directory exists. Combined appendices still require explicit mapping.
- Removed quadratic text copying from web/HTML definition matching. Adjacent Unicode boundary checks now inspect at most two UTF-16 units on either side. A 10,000-occurrence regression case passes, along with all six matcher checks, generated WebView consistency, and offline contracts.
- Full goal remains open: source applicability/reference/coverage work plus the previously listed Reader, Search, Notebook, Research and device acceptance checks. No deployment performed.

### Definition boundary and reference correction — September 15

- Found and fixed a concrete extraction error: the lowercase mathematical symbol in EAVE HEIGHT, h prevented recognition of that label and appended its body to the preceding Type B dwelling-unit reference. Both 2014 and 2022 now have separate entries (4,979 total entries).
- Exact quoted-reference parsing now accepts the published “See definition for” form and whitespace around inline punctuation. This resolves 2014 RISK CATEGORY and 2022 FIRE DAMPER. GREEN ROOF SYSTEM remains ambiguous because more than one source candidate exists; no target was guessed.
- All 30 parser/registry/published-source checks pass, including source-wording verification across all entries and identical web/iOS registries. No source HTML was edited. Full coverage and device verification remain pending.

### Additional published definition boundaries — September 15

- Compared published bold labels against extracted terms in the 2022 definition chapters. Fixed plus-sign labels and bold uppercase group labels without final periods. Restored separate TYPE B+NYC UNIT (2014), TYPE B + NYC UNIT (2022), THERMOSTAT and UNIT HEATER (2022 Fuel Gas). The preceding definitions no longer absorb these bodies.
- Registry now has 4,983 entries; all source-wording and web/iOS equality checks pass. Added regressions for plus signs, undotted group labels, and mixed-case bold continuation paragraphs. 33 focused tests and offline contracts pass.
- This remains partial coverage review, not full completion. Ambiguous reference candidates were not silently selected. No deployment or phone installation.

### Native Reader first-frame cache use — September 15

- Native Reader now seeds its initial state from an exact in-memory prepared-document cache hit. Reopening a prepared chapter no longer waits for an async task before having content available. Added route-based view identity so chapter changes reset view state.
- Replaced both technical “Preparing native Reader…” labels with an accessible, unlabeled progress indicator delayed 350 ms. Cached reads and brief position restoration avoid a spinner flash; cold preparation still has honest loading feedback.
- Simulator build succeeded. The existing cache-bound/memory-warning test and new memory-only/exact-route lookup test passed. First run's new test selected a non-pilot debug route; corrected it to an allowed pilot, then reran successfully.
- Reused the existing Simulator and `/tmp/permitext-column-ux-build`. Device Hub UI still times out, so rendered and physical-device acceptance remain pending. This does not yet establish seamless cold chapter loading across all codes. No deployment or TestFlight upload.


### Historical section-number Search and cancellation — September 15

- Extended the actual bundled-corpus all-edition XCTest beyond the previous “concrete” keyword case. Verified exact 1968 BC §27-598 (concrete title), preserved historical edition identity, and unchanged main Reader edition.
- Verified replacing an in-flight broad query with the historical section query does not allow stale results to overwrite the final list. Starting then clearing a search remains empty after cancellation settles.
- Simulator test passed using the existing device/build directory. This tests the real view model and corpus, not rendered controls or physical interruption behavior.
- Reconciled the top owner-follow-up checklist with implemented local work; full acceptance remains open and Report remains deferred. No publication performed.

### Definition ambiguity audit — September 15

- Corrected supporting chapter lists that say their terms are defined in Chapter 2. They remain references instead of treating trailing amendment notes as independent meanings. This resolves false ambiguity for GREEN ROOF SYSTEM and NOTIFICATION ZONE in 2022 Building Code.
- Removed unsafe inferred aliases from multiword OR phrases: EXISTING BUILDING OR STRUCTURE no longer supplies an unqualified STRUCTURE alias. Single-word alternatives remain supported; full published labels are preserved. STRUCTURE now resolves to the explicitly cited 28-101.5 source.
- Administrative reference support uses canonical nested files when present, rather than also considering legacy flat copies.
- 35 focused tests pass, including every registry body's source wording and identical iOS/web registry bytes. Remaining unresolved references and full applicability/occurrence coverage are still open. No deployment.

### Explicit definition reference chains — September 15

- Resolver now follows an explicit section or differently named term when its target is itself a reference and no direct meaning exists at that target. Each step retains edition/code/scope constraints; cycles, depth over 32, unresolved branches and conflicting meanings remain explicit failures rather than guessed definitions.
- This resolves 18 additional published entries, including BC/FGC/MC/PC SINGLE ROOM OCCUPANCY MULTIPLE DWELLING through 28-101.5 to 28-107.2, and WORK NOT CONSTITUTING MINOR ALTERATIONS OR ORDINARY REPAIRS to 28-105.4.2.1. Popup source metadata cites the actual terminal definition.
- 38 focused checks and offline contracts pass. Every shipped body's wording remains verified against its cited HTML; web/iOS registry bytes match. Full coverage, applicability review and device acceptance are not complete. Nothing deployed.

### Actual web popup and source-label verification — September 15

- Reused localhost review tab; verified corrected STRUCTURE popup displays 2022 Administrative Provisions §28-101.5. Verified SINGLE ROOM OCCUPANCY MULTIPLE DWELLING popup contains the complete terminal definition and §28-107.2 source.
- At Reader scrollTop 357, opening LISTED kept scrollTop 357; Escape removed the popup, restored focus to the original term, and retained scrollTop 357. Visually inspected the compact dark popup.
- Found and fixed stale accessible/collapsed header identity after code changes: the visible code changed while the header label retained the prior 1968 edition. Accepted Reader refresh now updates pane-collapse labels. Actual 2022-to-1968 switch verified matching header and rail labels.
- Navigation-race and scroll-continuity fixtures now supply the definition-context adapter added by the integration; retained all existing assertions and added accepted-header identity coverage. Both contracts and offline tests pass. Local review returned to 1968 Reader. No production change.

### Shared appendix occurrence coverage — September 15

- The read-only occurrence inventory now maps all 533 bundle chapters, including the 20 previously unmapped 2022 shared-file appendices. Each shared chapter is bounded by its own published heading; missing or duplicate headings remain unmapped rather than counting an entire shared file.
- Five regression checks pass against the actual BC K1/K2/K3 and FGC/MC/PC appendix files, including neighboring-chapter exclusion and duplicate-heading rejection.
- Current inventory: zero unmapped chapters, 149,978 candidate prose occurrences, 6,067 unresolved-reference occurrences, 1,553 eligible entries without an occurrence, and 222 chapters without eligible definitions. These are audit candidates, not proof of semantic applicability or rendered links. The last category includes deliberately withheld scopes awaiting review.
- No source wording, runtime registry, deployment or device state changed. Applicability, unresolved references and native acceptance remain open.

### Ranked unresolved definition inventory — September 15

- Added unresolved/ambiguous entry records to the occurrence audit, ranked by candidate match count and carrying the original reference and source metadata. This makes remaining reference work measurable rather than repeatedly sampling terms.
- The leading gaps are EBC BUILDING (1,188 candidate matches), CITY (833), REQUIRED (445), and MDL (300). Administrative meanings live in a separate collection; resolving these requires an explicit supported source mapping, not removing the edition boundary. EBC list-reference previews also currently retain excess surrounding section text and need narrower extraction.
- Verified all 533 chapters still map, unresolved records are present and sorted by count. This is diagnostic progress only; no runtime definitions or source text changed.

### Narrow published list-reference previews — September 15

- Corrected reference-introduction extraction for imported paragraphs containing surrounding sections and a bare term list. Entries now retain the exact published introduction through its colon, rather than the entire paragraph.
- Regenerated identical web/iOS registries and checked actual EBC BUILDING, CITY and REQUIRED entries: each now contains only the Section 28-101.5 reference sentence. Their cross-collection meanings remain unresolved; this change does not guess a source edition.
- 39 parser/registry/published-data checks pass, including every body's source wording. WebView shared-source consistency and offline contracts pass. Cache versions advanced to definitions v12 / app v384 / shell v1065. No deployment or physical-device verification.

### Owner correction: no definition popups inside definition chapters — September 15

- Web and native registry selection now returns no terms when the current code/edition chapter is itself a definition chapter. Definitions remain available in other chapters. Existing section-reference links are unaffected.
- Verified the owner's localhost Chapter 2: zero definition buttons, ADHERED MASONRY VENEER remains plain source text; neighboring Reader retains 14 definition buttons.
- All 18 registry definition chapters covered by the published-data exclusion test; six registry and eight published-data tests pass. Seven native definition tests pass on the existing Simulator, including all-book exclusion; offline contracts pass. No physical build or deployment.

### Amendment-marked definition boundaries — September 15

- The 2014 source uses leading asterisks for amended definition labels. Parser now recognizes those labels without merging them into the preceding definition; mixed-case amendment notes are not treated as labels.
- Recovered 11 entries across 2014 Administrative Provisions, BC and PC (including COVERED DEVELOPMENT PROJECT, OSHA and SINGLE-OCCUPANT TOILET ROOM). Registry now contains 4,994 unique entries. No authoritative HTML was edited.
- 28 parser tests and eight published-data checks pass, including every body's source wording, identical iOS/web data and definition-chapter exclusion. Offline contracts pass. Local cache versions definitions v14/app v386/shell v1067; no deployment.
- PRIOR CODE BUILDING remains unresolved: its printed reference uses a singular target whereas the available target label is plural. No inferred alias was added.

### EBC cross-collection source boundary — September 15

- Inspected both current bundle contracts before adding any cross-collection mapping. EBC is LL33/2026, enacted January 17, 2026 and effective July 17, 2027 under the LL42 effective-date metadata. The available enacted Administrative Code collection states currency through July 25, 2026.
- Therefore the latter is not evidence of the administrative text effective when EBC takes effect. Do not bypass the same-bundle safeguard or relabel this snapshot as the EBC edition merely to resolve frequent terms.
- Required next evidence: a source policy that explicitly distinguishes a dated supporting snapshot from the effective referenced text, with the popup exposing the actual supporting source/currency. Until established, the original published administrative references remain unresolved. This boundary affects the large EBC reference count, not the directly defined EBC terms already linked.

### Explicit lowercase alternatives in definition labels — September 15

- Recognize published lowercase “or” between uppercase label words. This recovers labels without inferring synonyms or treating ordinary mixed-case prose as a definition.
- 2014 FLOOD OR FLOODING now resolves to its actual G201.2 meaning in bc-G.html. Eleven additional labels recovered across the corpus, including ENVIRONMENTAL CONTROL BOARD or ECB and LIQUEFIED PETROLEUM GAS or LPG (LP-GAS). Registry has 5,005 unique entries.
- 29 parser tests and eight published-data tests pass; all source wording and web/iOS equality checks pass. Offline contracts pass. Local definitions v15/app v387/shell v1068; no deployment.
- Follow-up found while inspecting terminal references: support entries lack chapter metadata, so source.chapter may fall back to the referring chapter even when file/section are correct. Correct this source metadata before completion.

### Resolved definition source-chapter identity — September 15

- Supporting entries now receive chapter metadata from their actual code's bundle chapters/file mapping. Compilation no longer substitutes the referring chapter when a terminal definition lacks chapter metadata; unknown would remain null rather than become a false citation.
- Regenerated shared data corrected 1,079 source.chapter values; all 5,005 entries currently have mapped chapters. Definition wording, terminal section and file identity are unchanged.
- Seven registry and nine published-data checks pass, including actual 2014 flood/G201.2/Appendix G and accessible/1102.1/Chapter 11 examples. Offline checks pass. Local definitions v16/app v388/shell v1069; no publication.

### Explicit chapter applicability for definitions — September 15

- Added optional applicableChapters metadata for exact published introductory forms “As used in Chapter N [and Appendix X],” and “For Chapter N,”. Web and native selection both enforce this list; no broad inferred scope rules were added.
- The masonry CELL meaning is now excluded outside Chapter 21. Explicit Chapter 11/Appendix E accessibility meanings and chapter-specific NOTATIONS are similarly constrained. Broader applicability review remains open.
- Occurrence audit now caches by complete chapter identity, rather than a chapter's initial character, to respect both chapter exclusions and chapter-specific meanings. All 533 chapters map; 150,092 candidate occurrences and 5,751 unresolved candidate occurrences. Counts are diagnostic, not complete acceptance.
- 17 web registry/published-data checks and offline contracts pass. Eight native definition tests pass on the existing Simulator, including real-registry Chapter 21 inclusion/Chapter 3 exclusion. No deployment or physical-device acceptance.

### Paired definition reference verification — September 15

- Explicit two-section references now resolve each target independently. Both targets must resolve to identical meanings; missing targets remain unresolved and conflicting meanings remain ambiguous. Mixed own-code/Administrative-Code references preserve source boundaries, and explicit chapter references restrict candidates to that chapter.
- Actual 2014 LISTED and CERTIFICATE OF COMPLIANCE now resolve through their cited sections to 28-101.5. DESIGN STRENGTH, STRENGTH NOMINAL and STRENGTH REQUIRED had previously been accepted without verifying both cited sections; they now correctly remain unresolved pending complete target verification.
- 31 parser and ten published-data tests pass, including paired-target conflicts, missing targets and edition isolation. Offline contracts pass. Definitions v18/app v390/shell v1071 locally; no deployment.

### Strength reference source comparison — September 15

- Compared the actual 2014 bc-16.html and bc-21.html targets for DESIGN STRENGTH, STRENGTH NOMINAL and STRENGTH REQUIRED. Both sources are present. Chapter 21 publishes title-case children beneath STRENGTH; Chapter 16 uses standalone uppercase terms.
- Meanings are not verbatim identical: for example Chapter 16 design strength uses “The product of the nominal strength and a resistance factor (or strength reduction factor),” while Chapter 21 uses “Nominal strength multiplied by a strength reduction factor.” A single unqualified terminal definition would conceal this source distinction.
- Remaining implementation requirement: represent grouped-child targets and select/display applicable chapter-specific alternatives with source labels; do not globally replace the reference with the first matching meaning. Current unresolved state remains honest until that is implemented and verified.

### Multiple published definition meanings — September 15

- Explicit paired references with two verified but different targets now retain both terminal definitions rather than selecting one or discarding both. Grouped child labels are matched only within the explicitly cited section; full published parent context is retained.
- Seven 2014 terms now have paired source-labeled entries: CELL, DESIGN STRENGTH, NOTATIONS, PLATFORM, SIGN, STRENGTH NOMINAL and STRENGTH REQUIRED. Registry contains 5,012 unique entries. Different editions remain excluded.
- Web/native popup copy identifies that cited sections provide different definitions and asks the reader to check applicability. Shared HTML WebView artifact regenerated.
- 31 parser and 18 registry/published-data tests pass, including exact source wording and independent source citations. Offline contracts pass. Actual multi-meaning popup visual verification and native rebuild remain pending for this change. Local definitions v19/app v391/shell v1072; no deployment.

### Multiple-meaning rendered verification — September 15

- In the existing localhost tab, selected 2014 BC Chapter 16 and opened DESIGN STRENGTH from prose. Actual popup displays both published meanings with separate §1602.1 and §2102.1 citations and the applicability message. Visually inspected its bounded scrollable layout, then closed it and restored the left Reader to 2022 Chapter 1.
- Current native build and all eight ReaderDefinitionContractTests pass on the reused Simulator. This establishes build/test acceptance, not physical-device visual acceptance.
- Additional observed UX gap: definition sections embedded in ordinary chapters (such as 1602.1) still receive popup links. Extend the owner's plain-definition-text behavior to those sections while keeping links elsewhere in the chapter. Dedicated Chapter 2 remains correctly excluded.

### Plain text inside embedded definition sections — September 15

- Web decoration skips blocks whose section title ends in Definitions; native Reader disables the definition environment for blocks belonging to a definition heading's section ID. HTML fallback skips prose following a definition heading until the next heading.
- Actual browser verification on 2014 §1602.1: zero definition buttons; neighboring General, Floor live load, Seismic loads and Wind loads retained links. Restored left Reader to 2022 Chapter 1.
- Corrected a missing Swift return caught by the first compile; rerun build and all eight native definition tests pass. Offline and generated WebView consistency checks pass. Native embedded-section visual acceptance remains unverified because Device Hub is unavailable.
- Local definitions v20/app v392/shell v1073; no publication.

### Fire Code embedded definitions — local verification

- Indexed 500 FC 202 definitions from the combined Fire Code source. The combined container remains eligible outside its embedded definition sections; dedicated definition chapters stay excluded.
- Published-data checks (11), native definition tests (9), offline contracts, shared WebView generation check, and diff whitespace checks pass. No production or physical-device acceptance claimed.
- Occurrence audit still needs section-level source exclusion for combined files: excluding the entire definition source file undercounts Fire Code occurrences. Full coverage remains open.

### Combined-source occurrence audit correction

- Replaced whole-source-file exclusion with heading-based definition-section exclusion, matching the Reader boundary. Combined Fire Code application prose is now counted; FC 202 definition prose stays excluded. Two regression checks pass, including the actual published Fire Code HTML.
- Current candidate inventory: 533 mapped chapters, zero unmapped, 172,755 occurrences, 5,635 involving unresolved meanings, and 1,610 entries without measured occurrences. These are exact-match candidates, not semantic or rendered-link acceptance.

### Exact cited labels and mathematical term boundaries

- Prime-symbol labels no longer become part of the preceding definition. Exact named definitions within the cited section take precedence over same-named children of a different parent definition. Edition and section filters still apply before selection.
- Corpus regeneration changes exactly two entries: SPECIFIED and WEATHER-EXPOSED SURFACES now resolve to their exact published meanings instead of competing grouped definitions. All 33 parser checks and 11 published-data checks pass; all definition bodies still match source wording.

### Native Reader regression on current follow-up branch

- Reused Simulator BD257A50-BE74-47BA-A833-0C8B39E67D44 and /tmp/permitext-column-ux-build. No new simulator or duplicate build directory.
- 55 tests passed: 43 NativeReaderPhase3ContractTests, nine ReaderDefinitionContractTests, and three historical Search / flat-source routing checks. Log: /tmp/permitext-reader-final-regression.log.
- The corpus check loads all 574 validated native documents, verifies source identity and indexed validation metadata, examines table structure/unique cells, checks text for encoding corruption, and decodes available bundled images. It does not independently rederive all source parity hashes or simulate every visible navigation.
- Cold-open rendered latency, both-Reader switching acceptance, signed-in lifecycle, and physical gestures remain open. No deployment or TestFlight update performed.

### Same-edition explicit Appendix D references

- Followed only explicit See Appendix D references to the indexed appendix of the same code/edition. This resolves 35 Existing Building Code entries with exact source wording and D2 citations. Ordinary unqualified references still cannot cross appendix scope.
- Missing targets and external Building Code references remain unresolved. Native visual access was attempted again but Device Hub UI timed out; no visual acceptance is claimed.

### Reviewable definition coverage report

- Added PERMITEXT_DEFINITION_COVERAGE.md: per-source resolution totals, explicit scope/measurement limits, all 165 unresolved references with exact source paths, and remaining acceptance requirements.
- Report generation requires a SHA-256 match between the occurrence audit and current registry; stale-input rejection verified. Refreshed candidate audit measures 172,755 occurrences, including 4,813 unresolved-reference occurrences.

### Inline grouped child definitions

- Exact child labels printed inline after a sentence now resolve within their explicitly cited section. Four 2014 BC references resolve: CORRIDOR, INTERIOR; DEMOLITION, FULL; DEMOLITION, PARTIAL; PARTIAL DEMOLITION. Full parent-group wording remains intact.
- Added positive and wrong-section / ordinary-prose negative checks. No fuzzy matching or guessed meanings were introduced.

### Multi-target named references

- Explicit quoted lists now require every named target to resolve in the same code/edition. Reference chains preserve the complete target set. This fixes first-target-only behavior for 2014/2022 VENT PIPE and resolves the four named DAMPER types. Distinct targets in the same source section keep distinct IDs and their published term labels.
- Local browser verification at 2014 BC 716.3 showed all four damper definitions, source labels, and 2014 §702.1 citations in the compact scrolling popup. Closed it and restored the first Reader to 2022 Chapter 1; second Reader remains the plain-text 2022 definition chapter.
- 36 parser, 13 published-data and eight registry tests pass, together with offline checks and generated-WebView consistency. Native build and ten definition tests pass in /tmp/permitext-definition-lists-rerun.log. An initial new test incorrectly included other 2014 code families; restricting that test to the BC identity corrected the assertion. No physical or native visual acceptance claimed.

### Mixed chapter exclusion boundary

- Whole-chapter exclusion now follows definition-chapter titles, rather than excluding every chapter that supplies definition entries. Four administrative/electrical Chapter 1 containers remain eligible outside embedded definition sections. Dedicated Definitions chapters remain excluded.
- Local web verification: 2022 General Administrative Code Chapter 1 ordinary prose has term buttons; both 28-101.4.5.2 and 28-101.5 definition blocks have zero definition buttons. Restored the original 2022 Building Code Reader afterward.
- Four-container regression and all 14 published-data checks pass; offline checks pass. Refreshed report: 533 mapped chapters, 182,242 candidate occurrences, 4,780 unresolved-reference occurrences, and 1,557 entries without measured occurrences. These remain candidate counts, not semantic acceptance.

### Match terms without appended MDL citation annotations

- Added bare-label matching aliases for 34 MDL-cited terms in the general and Appendix D indexes (68 entry alias arrays). Source labels, bodies, resolution and citations are unchanged. Parenthetical applicability qualifiers are not stripped.
- Published EBC matcher checks verify ordinary basement and fire escape text reaches the D2 definitions. All 37 parser and 15 published-data checks pass; offline checks pass.

### Equivalent definition sources — September 16

- Web and native selection now display identical general-reference and appendix definitions once. Different source locations, wording, or matching aliases remain distinct; edition and code selection still precede deduplication.
- Twenty-five registry/published-data checks pass. Native build and eleven definition tests passed in /tmp/permitext-definition-dedup.log. No new physical-device or deployment acceptance is claimed.
- Refreshed coverage report: 533 mapped chapters, zero unmapped, 183,372 candidate occurrences, 4,975 unresolved-reference occurrences, and 1,505 entries without measured occurrences. Equivalent records share occurrence evidence only within the same code and edition. Full semantic applicability and remaining collections are still open.

### Discovery in unindexed collections — September 16

- Scanned all 101 mapped chapters across the five unindexed collections. Located 54 definition-related headings: Title 24 (12), Title 25 (4), Title 26 (30), Housing Maintenance Code (8). The 39 annual Local Law files contain no matching headings; inline/amendment definitions require separate review.
- Coverage report now lists exact source files and available section anchors. Two discovery tests pass, including the actual HMC §27-2004 source. Heading discovery does not enable term links or establish applicability. General and term-specific scope still require implementation/review.

### Quoted administrative definition extraction — September 16

- Added opt-in extraction for quoted sentence-case legal labels, numbered/lettered labels, explicit quoted alternatives, and bare labels followed by continuation paragraphs. Existing construction-code parsing remains the default.
- Forty parser checks pass, including the actual Title 25 §25-302 Reasonable return definition and its nested Test year wording. Fixture checks cover explicit Btu aliases, definition-section boundaries and continuation isolation.
- This is extraction support only: no new administrative meanings have been added to the shipped registry. Chapter/section applicability and further publication formats remain open before enabling those links.

### Chapter-scoped Air Pollution Control definitions — September 16

- Added the 84 quoted definitions from Title 24 §24-104 to the shared web/native registry. §24-101 identifies the source code as Title 24 Chapter 1; explicit applicableChapters metadata restricts selection accordingly. The existing 19 books are unchanged.
- Eighty-two entries are eligible. Board and Department remain review-required after browser inspection found references to different health agencies in §24-102. Context-aware treatment remains required; this is not complete semantic acceptance.
- Seventeen published-data checks and nine registry checks pass; offline checks pass. Native build and twelve definition tests pass in /tmp/permitext-definition-air-scope-final.log using the existing Simulator/build directory.
- Local browser verified Air popup wording and §24-104 citation; the complete §24-104 rendered section had zero definition buttons. Reload confirmed Board/Department were no longer linked. First Reader restored to Building Code (2022), second remains Definitions.
- Coverage: 533 mapped chapters, 185,356 candidates, 4,975 unresolved-reference candidates, 1,514 eligible entries without measured occurrences. Partially indexed collections remain in the source-discovery report. Local only; no deployment or physical acceptance.

### Explicitly cited prose definition — September 16

- The parser accepts an opening “TERM is/means…” paragraph only when a definition-chapter reference explicitly names that exact term and section. It does not infer definitions from arbitrary prose or child sections.
- Corpus comparison changed exactly one entry: 2014 BC SHOTCRETE now resolves to the complete published §1913.1 paragraph. DECK remains unresolved because its chain reaches ASCE 7; no external or newer-edition meaning was substituted.
- Forty-one parser tests, eighteen published-data tests, offline checks and shared WebView consistency pass. Web/native registry files are identical. This data-only follow-up has not received a new physical or rendered acceptance check.

### Explicit appendix sections and hyphenated reference labels — September 16

- Explicit section citations can reach their named appendix within the same code/edition. An otherwise unmatched label can differ only by an internal letter-to-letter hyphen, and only within that cited section. Qualifiers remain intact; conflicting meanings remain ambiguous. Unqualified references still cannot cross appendix scope.
- Generated-data comparison changes exactly six 2014 BC entries to resolved references: PREFIRM/POSTFIRM DEVELOPMENT and STRUCTURE, POSTFIRE SMOKE PURGE SYSTEM, and DWELLING UNIT OR SLEEPING UNIT, MULTI-STORY. Full source wording and source edition are preserved.
- Forty-three parser and nineteen published-data checks pass, plus offline and shared WebView checks. Current unresolved count is 158. No additional physical/rendered acceptance or publication is claimed.

### Double-marked inline administrative headings — September 16

- Recognized double amendment markers before an inline § Definitions heading. Three 2014 BC references now resolve to the same-edition §28-401.3 source: DIRECT AND CONTINUING SUPERVISION, DIRECT EMPLOY, and HIGH-PRESSURE BOILER. The source anchor remains the enclosing published HTML block; the citation records the actual inline section.
- One newly discovered GREEN ROOF SYSTEM reference at §28-103.33.1 is retained as review-required, not enabled for general matching. Registry total: 5,602 entries, 156 unresolved references.
- Forty-four parser tests and twenty published-data tests pass, with all source wording preserved and web/native registry parity. Offline and WebView consistency checks pass. No new native rendered, physical, or deployment acceptance is claimed.

### Inline definition passages excluded — September 16

- Extended the Definitions chapter exclusion to inline § Definitions passages, including headings whose section number is already a citation link. Application prose before the heading and subsequent independent passages remain eligible; published wording and existing links remain intact.
- Web matcher/audit checks pass (10), browser fixture checks pass (10), and final native definition tests pass (13). Shared WebView consistency and offline checks pass. Reused the existing simulator and build directory. No physical-device or production acceptance is claimed.
- Occurrence audit now excludes inline definition passages: 184,435 candidates across 533 mapped chapters. This is coverage evidence, not semantic acceptance of every match.

### Imported section boundaries — September 16

- Treat newline-separated section-sign headings inside imported paragraphs as section boundaries. This prevents a definition from absorbing subsequent requirements. The registry comparison changes only the 2014 administrative GREEN ROOF SYSTEM reference, removing subsequent duties sections while retaining its source reference and amendment note. It remains review-required.
- Passed 45 parser tests, 21 published-data tests, offline checks, and shared WebView consistency. Updated both registry copies and the coverage report; 156 unresolved entries remain. No source HTML was edited and no deployment or physical-device acceptance is claimed.

### Native rendered Reader regression — September 16

- Ran the existing `permitextPhysicalStress` UI target on Simulator `BD257A50-BE74-47BA-A833-0C8B39E67D44`, reusing `/tmp/permitext-column-ux-build`. Both selected tests passed: `testFormerHTMLOnlyPlumbingChapterOneOpensNatively` and `test2014BuildingCodeNativeFigureAndStructuredTableRegression` (44.6 seconds of test execution).
- Inspected captured images: 2022 Plumbing Chapter 1 has its matching edition/header and readable section text; 2014 BC Figure 705.7, Table 705.8 merged rows, and Table 1004.1.1 formatted cells render. Table 705.8 extends horizontally beyond the viewport; this run does not test its swipe gesture. The 2014 captures use the isolated native content harness, not the full navigation shell.
- Result: `/tmp/permitext-column-ux-build/Logs/Test/Test-permitextPhysicalStress-2026.09.16_00-32-01--0400.xcresult`. This verifies these rendered destinations only. 1968 rendered routing, both-reader switching, cold-load blank intervals, signed-in lifecycle, and physical acceptance remain open. No new simulator, deployment, or phone installation was created.

### 1968 Chapter 1 rendered routing — September 16

- Added an isolated Debug harness target for 1968 BC Chapter 1, using the library's version/code/chapter lookup and normal Chapter Reader rather than a direct HTML snapshot. The UI test passes with the 1968 source label, §27-101 heading, and exact published title text present, and no Chapter HTML Missing message. A screenshot was inspected and confirms readable §§27-101–103 under the correct 1968 heading.
- The first assertion used static text for a linked paragraph; corrected the accessibility lookup to accept the element's label or value while retaining the exact required wording. Final single-test run passed (`/tmp/permitext-1968-rendered-final.log`). Existing Simulator/build directory reused. This closes the representative Chapter 1 rendered route check, not all-edition/both-reader switching, cold-load latency, or physical acceptance.

### Reader edition tab round trip — September 16

- Added a stable accessibility identifier to the code picker and a normal-app UI test. It records Reader 2's edition, switches Reader 1 to 1968 through the menu, visits Reader 2 and verifies its edition is unchanged, then returns and verifies Reader 1 still shows 1968. The test passed; the screenshot confirms the 1968 chapter list and normal five-tab shell.
- Evidence: `/tmp/permitext-column-ux-build/Logs/Test/Test-permitextPhysicalStress-2026.09.16_00-41-14--0400.xcresult`. This is guest Simulator acceptance for that tab round trip. Switching Reader 2 itself, retained open-chapter positions, transient loading frames, and signed-in/physical lifecycle are not proven by this check. No deployment or new simulator was created.

### 1968 Search UI destination — September 16

- Normal-app Simulator UI test `testSearchFinds1968SectionAndOpensItsEdition` passes: enter `27-598` in Search, open its result, verify the 1968 source header and exact Core tests of concrete construction title. Inspected the screenshot: the matching §27-598 body renders in the Search destination, with the normal tabs still present.
- Evidence: `/tmp/permitext-column-ux-build/Logs/Test/Test-permitextPhysicalStress-2026.09.16_00-44-03--0400.xcresult`. This establishes the reported representative 1968 search/destination flow in the current guest Simulator build. It does not establish every query, 2022 result regression, signed-in lifecycle, or physical behavior. Existing Simulator/build directory reused; no deployment.

### Search query replacement and 2022 destination — September 16

- Extended the same journey: return from 1968 to Search (query remains `27-598`), clear it, enter `722.2.1.1`, select Building Code · 2022, and open that result. The source label and exact Cast-in-place or precast walls title passed in the diagnostic run. Screenshot confirms the matching passage.
- Preserve the first-run failure: the source label appeared but the exact title was not found within 10 seconds. Adding a pre-assertion screenshot/diagnostic capture yielded a passing run; this is not proof of stable cold-load timing. The captured destination still shows Loading table, so table readiness and transient loading remain open.
- Passing result: `/tmp/permitext-column-ux-build/Logs/Test/Test-permitextPhysicalStress-2026.09.16_00-49-10--0400.xcresult`; first failure: `/tmp/permitext-search-cross-edition-ui.log`. No product behavior was changed in this step.

### Remove artificial table startup delay — September 16

- Removed TableHTMLView's hash-based delay (up to 550 ms) and its pre-WebKit Loading table state. WebKit now starts immediately when the view appears; document preparation and actual rendering still take time. This does not claim instant cold rendering.
- Simulator build passed. Existing Fuel Gas 504.2(1) wide-table UI test passed; inspected before/after images confirming actual cells render and horizontal swiping exposes additional columns. Result: `/tmp/permitext-column-ux-build/Logs/Test/Test-permitextPhysicalStress-2026.09.16_00-53-18--0400.xcresult`. Existing Simulator/build directory reused. Full chapter cold-load timing and physical acceptance remain open.

### Native definition pop-up acceptance — September 16

- Extended the 1968 chapter UI check to tap the actual BUILDING link, verify §27-232, dismiss with Close definition, and compare the linked word's vertical position (within 2 points). Passed on the existing Simulator.
- The first screenshot exposed chapter text bleeding through the default translucent popover. Set an opaque system background. The rerun passed, and the inspected screenshot shows readable definition text and source without overlapping chapter text. Result: `/tmp/permitext-column-ux-build/Logs/Test/Test-permitextPhysicalStress-2026.09.16_00-57-59--0400.xcresult`.
- This establishes the representative native tap/source/dismiss/position flow; full corpus applicability, larger text/light appearance, HTML Reader variants, and physical touch acceptance remain separate. No deployment.

### Native Definitions chapter exclusion — September 16

- Added a Debug-only Definitions chapter option to the existing 1968 harness. The UI test opens Subchapter 2, verifies §27-229 is present, and verifies no generated links for terms/shall or open definition pop-up. Passed; inspected screenshot confirms plain chapter text with no definition decoration.
- Result: `/tmp/permitext-column-ux-build/Logs/Test/Test-permitextPhysicalStress-2026.09.16_01-00-20--0400.xcresult`. This supplements corpus/matcher exclusion checks with a representative native rendered chapter. Existing Simulator reused; no deployment.

### Retain prepared table HTML — September 16

- Retained table views now reuse HTML when content, query and active match are unchanged. Cancelled preparation cannot publish an obsolete result. This avoids clearing prepared content on view reappearance; it does not make cold preparation instantaneous.
- Highlighted Fuel Gas wide-table UI regression passed; inspected screenshot confirms highlighted Height header and rendered cells. Result: `/tmp/permitext-column-ux-build/Logs/Test/Test-permitextPhysicalStress-2026.09.16_01-02-41--0400.xcresult`. The test covers rendering and horizontal scrolling, not a direct lifecycle cancellation race. No deployment.

### Explicit flood reference data — September 16

- Resolved two 2022 Building Code Chapter 2 flood-qualified labels through their printed G201.1.2 citation. Destination labels omit the qualifier; matching aliases remain unchanged. Resolution remains restricted to that code, edition and section and rejects conflicting definitions.
- Regenerated web/native registries are byte-identical. Entry comparison shows exactly two changes, both unresolved to resolved; 5,602 total entries, now 154 unresolved. No authored HTML changed. Parser 46/46, published-data 21/21 and offline contract checks pass. Refreshed occurrence report and web cache identities. Local only; rendered and physical acceptance remain separate.

### Flood reference chain and source citation mismatch — September 16

- Added EXISTING STRUCTURE (FOR FLOOD ZONE PURPOSES) to the same explicit G201.1.2 mapping; its printed Pre-FIRM development reference resolves within that appendix. Published-data test covers all three qualified flood entries, original labels, unchanged aliases and exact appendix citation.
- Inspected bundled 2022 Chapter 3: CHILD CARE FACILITIES and DETOXIFICATION FACILITIES definitions carry 308.2.2, while Chapter 2 cites 308.2.1. These remain unresolved; no silent source correction. Added regression assertions retaining that boundary.
- Parser/published tests pass, then expanded published-data plus offline checks pass 23/23. Refreshed web/native data and coverage report (153 unresolved). Local only.

### Reciprocal alternate definition names — September 16

- Resolved HOLD-DOWN's printed TIE-DOWN reference using the exact reciprocal heading TIE-DOWN (HOLD-DOWN). General parenthetical qualifiers remain intact; no matching aliases added. Scope, edition, conflicting-definition negative tests pass.
- Regeneration changed exactly one entry and preserves its published wording. Parser 47/47; published-data/offline 23/23. Web/native registry and coverage refreshed, 152 references remain unresolved. Local only.

### Remaining definition references: largest source boundary — September 16

- Current registry has 152 unresolved entries. Existing Building Code accounts for 78: 75 general, 3 Appendix D. Of the 75 general entries, 70 explicitly reference the Administrative Code, 3 reference Building Code flood provisions, and 2 are other named references. This is a source-mapping boundary, not evidence that all 78 meanings are absent.
- Inspected both bundled source contracts: EBC is enacted 2026-01-17 and effective 2027-07-17 (enacted-not-yet-effective); the administrative snapshot states amendments effective through 2026-07-25. Shared directory-year labels do not establish matching applicability. No cross-collection resolver exception was introduced.
- Next source work must establish the appropriate referenced text/version for those 70 entries and preserve source currency in pop-ups. Merely relaxing the same-bundle guard would turn an explicit uncertainty into an unsupported meaning. Counts above are verified inventory, not legal conclusions or completed source acceptance.


### Both Reader selectors — September 16

- Extended normal-app Simulator test: Reader 1 selects 1968 Building Code; Reader 2 selects Existing Building Code; switching between them retains each choice. Passed, with inspected Reader 2 screenshot showing its correct source and chapter list. Result: `/tmp/permitext-column-ux-build/Logs/Test/Test-permitextPhysicalStress-2026.09.16_01-16-33--0400.xcresult`.
- First attempt failed because the test matched both menu item and selected header. Scoped selection to the menu collection; no product behavior changed. This checks stable selections, not every transitional frame or retained chapter positions. Main checklist reconciled with current evidence and registry counts.

### Open chapter retention across Readers — September 16

- Extended normal-app test opens Chapter 1 in both independent Readers after selecting 1968 and EBC. Both remain in their chapter views after tab switches; source label is retained and 1968 §27-101 returns within 2 points of its original vertical position. Passed, with rendered screenshot inspected.
- Result: `/tmp/permitext-column-ux-build/Logs/Test/Test-permitextPhysicalStress-2026.09.16_01-18-57--0400.xcresult`. This covers the initial chapter position, not arbitrary deep scroll, process termination or physical interruption. No product code or deployment change.

### Deep-scroll acceptance remains open — September 16

- An experimental extension scrolled three times and attempted to track a visible heading; no heading was in its chosen viewport. A passage-based attempt later reached the return comparison and measured a 3-point shift (245 to 248), but subsequent runs failed to establish the chapter-opening baseline from persisted state.
- Evidence: `/tmp/permitext-column-ux-build/Logs/Test/Test-permitextPhysicalStress-2026.09.16_01-27-31--0400.xcresult` contains the 3-point comparison; `/tmp/permitext-column-ux-build/Logs/Test/Test-permitextPhysicalStress-2026.09.16_01-30-10--0400.xcresult` fails before that comparison. No reliable overall pass or diagnosed product defect.
- Removed the uncommitted experimental extension rather than retaining a flaky test or repeating uncontrolled trials. The previously committed initial-position/independent-reader checks remain. Deep-scroll acceptance requires a deterministic navigation baseline; not marked complete. No production behavior changed.


### Cited reference typography — September 16

- Reference resolution now tolerates spacing/hyphen differences only within the explicitly cited section, same code/edition/scope. Parenthetical qualifiers remain significant; competing meanings stay ambiguous. No Reader matching aliases changed.
- Compared regenerated entries: exactly seven references resolved (six 2014, one 2022): commercial truck-mounted crane, draftstop, flood damage-resistant materials, limited oil burning boiler alterations, membrane-penetration firestop, particle board, and hospitals andpsychiatric centers. Their original source wording is retained. Web/native registry refreshed; 145 unresolved references remain.
- Parser 48/48 and published-data/offline 23/23 pass. Scope, edition, uncited-name and conflicting-meaning negative checks retained. No deployment.

### Official EBC administrative source located — September 16

- Official source inspected: https://www.nyc.gov/assets/buildings/local_laws/ll42of2026.pdf (88 pages). Section 4, beginning PDF page 6, amends AC §28-101.5 and its extracted text changes definitions including 1968 BUILDING CODE and ADDITION. Section 153 states the general delayed effective-date rule. This establishes actual changed meanings, not merely mismatched directory names.
- DOB FAQ https://www.nyc.gov/site/buildings/codes/ebc-faqs.page confirms the EBC July 17, 2027 transition and warns that its linked introductory EBC text lacks some enacted editorial changes. Do not substitute that introduction for the enacted corpus.
- The original bundled EBC attachment URL returned HTTP 410 through the web reader. LL42 is available directly from DOB. Next ingestion must preserve enacted additions/deletions and source/effective-date identity in a separate reference source; existing 2014/2022 meanings must remain unchanged. No registry or authored text changed in this review.


### Amendment extraction constraint — September 16

- Direct download of DOB LL42 PDF returned HTTP 403. The web reader provides indexed text, but screenshot requests did not yield an inspectable page image. No local matching amendment PDF was found in the targeted repository search.
- Do not describe the previous extracted-text inspection as visual validation. Enacted/deleted formatting has not been verified, and no consolidated definition source has been generated. Keep the existing cross-collection references unresolved pending an inspectable authoritative PDF or equivalent enacted text with reliable amendment boundaries. Other local implementation work is not blocked by this source constraint.

### Native-first chapter prewarming — September 16

- Found native document prewarming queued after HTML fallback preparation in warmChapterReaderEntry. Reordered it so the active native Reader document can enter its bounded first-frame cache first; fallback preparation remains available afterward. Cancellation remains checked between stages.
- Simulator build passed using the existing build directory (`/tmp/permitext-native-first-warmup-build.log`). This removes an ordering dependency; no measured cold-load timing or elimination of every blank interval is claimed. No deployment.

### Rewarm evicted chapters on explicit open — September 16

- Removed the permanent warmedChapterIDs early return from explicit chapter-opening warmup. That history set outlives the bounded native/HTML caches, so it could suppress preparation after eviction. Explicit opens now revisit the caches; existing hits still reuse prepared values. Passive browsing retains its warmup deduplication.
- Simulator build passed (`/tmp/permitext-rewarm-evicted-build.log`), existing build directory reused. This corrects the stale guard; eviction-to-visible-content latency remains unmeasured. No deployment or physical-device claim.

### Cancelled warmup bookkeeping — September 16

- Added cancellation guards after descriptor/detail awaits and before the final warmedChapterIDs insertion. A task cancelled by code/context changes can no longer publish a completed-warmup marker after those suspension points. Document workers remain independently owned; this does not introduce shared cancellation.
- Simulator build passed (`/tmp/permitext-warmup-cancellation-build.log`). Source/build verification only; no live cancellation-race or physical acceptance claim. No deployment.

### Warmup changes: normal Reader flow — September 16

- Normal two-Reader UI test passes after native-first prewarming and cancellation/eviction fixes. Both chapter routes open; the visible native passage retains its stable block identity and position (4-point tolerance) across tab return. Screenshot inspected. Result: `/tmp/permitext-column-ux-build/Logs/Test/Test-permitextPhysicalStress-2026.09.16_01-43-29--0400.xcresult`.
- Test now selects a visible passage by native block identifier instead of requiring §27-101 to be visible on every reopen. This supports saved starting positions without erasing continuity state. The captured run starts near the chapter opening; it does not close the separate deep-scroll or cold-frame-timing acceptance items.

### Plural matching gap: source rule confirmed — September 16

- Inspected bundled 2022 BC Chapter 2 §201.2: its interchangeability provision expressly includes singular/plural forms. The shared matcher currently accepts only exact indexed labels and explicit aliases, so this requirement remains incomplete even for ordinary noun forms such as building/buildings.
- Do not solve this by removing word boundaries or arbitrary suffix stripping. Any generated form must retain the same definition/scope/edition, respect longer defined phrases and conflicting exact labels, and be shared by web/native through the registry. Other code editions require their own source-rule confirmation. No generated inflections were published during this review.

### 2026-09-16 — Housing Maintenance definition extraction

- Added opt-in numbered legal-definition extraction for 39 reviewed labels in HMC §27-2004(a). Full paragraph groups and child paragraphs are retained; unknown numbered entries terminate the preceding definition.
- The shared web/native registry retains these as `review-required`, with source anchor and edition. They are not active links: section-specific overrides and composite/restricted labels (including Person) still need review.
- Discovery continues for codes with pending scope review, so indexing one source does not hide remaining definition sections.
- Parser, published-data, registry and offline contract checks: 83 passed. No source HTML changes, deployment or device acceptance.

### 2026-09-16 — Inline scope exception correction

- Local Reader inspection of HMC Subchapter 2 exposed an error in the initial heading-based scope review: §27-2045 embeds a different Private dwelling meaning without a Definitions heading. §27-2056.1 also expands Multiple dwelling for its article, and §27-2074 gives Alteration a narrower meaning for specified subdivisions.
- Withdrew activation from commit 8c7283d46. All 39 HMC entries remain extracted but `review-required` in both registries pending section/subdivision-aware matching. No source wording was removed. No deployment occurred.
- Expanded source discovery to include explicit inline scope declarations and quoted term definitions, so these gaps appear in the generated inventory instead of being missed by heading-only discovery.
- Browser evidence: actual local Reader displayed definition triggers inside the inline §27-2045 declaration; source inspection confirmed conflicting wording. The popup/position acceptance check was stopped at that defect, not reported as passed. Restored the review Reader to 2022 Building Code Chapter 1 and closed the temporary tab.
- Definition-discovery, published-data and offline tests passed (28 total). Section-level scope support remains required before HMC activation.

### 2026-09-16 — Section-aware definition selection infrastructure

- Added `applicableSections` and `excludedSections` to the shared registry contract and compiler. A section includes dot-numbered descendants only; missing section identity withholds restricted entries. This does not yet encode subdivision/article-specific overrides.
- Web decoration selects by the owning section number and reuses matchers per section. Native attributed-text context receives its section identity; HTML fallback filters shared entries by the preceding source heading. Unrestricted chapters retain shared matcher reuse.
- No Housing Maintenance entries activated. Scope metadata and scoped source extraction still need implementation and actual Reader verification before activation.
- Web/data/offline checks: 43 passed. Native section boundary contract test passed in existing simulator (`Test-permitext-2026.09.16_02-05-10--0400.xcresult`); final incremental app build succeeded. Shared generated WebView component synchronized. No deployment or physical-phone acceptance.

### 2026-09-16 — First scoped Housing Maintenance exception

- Extracted the exact Private dwelling declaration from §27-2045, retaining its section-specific meaning and source. Only this entry is eligible within §27-2045 (and numbered descendants); the 39 general HMC entries remain withheld pending all overrides.
- Inline `The term … means …` declarations now remain plain text in shared web/HTML matching and native attributed text. Source prose is unchanged.
- Scoped occurrence audit now selects definitions by passage section instead of dropping them at chapter selection. Its counts remain candidate matches, not rendered acceptance.
- Actual localhost Reader: private dwelling requirement opens the correct §27-2045 text and citation; its declaration stays plain; closing the popup restores the same trigger position (0px delta). Screenshot visually inspected. Restored original 2022 BC Chapter 1 selection and closed temporary tab.
- 99 targeted web/data/parser/offline checks passed. Native WKWebView test passed for declaration exclusion, allowed section, neighboring-section exclusion, popup wording/citation (`Test-permitext-2026.09.16_02-11-06--0400.xcresult`). No physical-phone test, push or deployment.

### 2026-09-16 — Native attributed-text scoped definition verification

- Added an isolated HMC §27-2045 target to the existing DEBUG Reader test harness; it uses its existing temporary repository/defaults and does not touch signed-in user data.
- Actual native Reader UI test passed: correct Housing Maintenance source, private dwelling link in application prose, section-specific wording and §27-2045 citation, dismissal preserving trigger position within 2px.
- Visually inspected the retained screenshot: declaration paragraph plain, dotted requirement term, opaque readable popup and source label. Evidence: `/tmp/permitext-column-ux-build/Logs/Test/Test-permitextPhysicalStress-2026.09.16_02-16-27--0400.xcresult`; exported screenshot `/tmp/permitext-native-hmc-scope-capture/696CD714-81B7-4408-ADDB-3D4AE77D12D9 (1).png`.
- Existing simulator and build directory reused. This establishes simulator native-path behavior for the scoped entry, not physical-device acceptance or broader HMC applicability.
