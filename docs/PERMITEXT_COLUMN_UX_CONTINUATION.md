# Column UX continuation

Updated September 14, 2026. Implements the consolidated September 12–13 column review authorized in this task. Preserve existing web visual decisions and native iPhone navigation; there is no iPad product. Navigation experiments remain proposals, not required redesigns. Physical phone validation is deferred at the owner's request; complete Simulator and local verification first. Publication is separate from local completion.

## Requirements and evidence

- [x] Research: persist unsent new questions and follow-ups, explicit conversation/History views, supplemental columns, and workspace layout without automatic submission. Implemented in b7bb9784d, pushed to origin/codex/research-continuity. Composer, layout, context-recovery, deletion and offline contracts pass. Signed-in browser verification remains pending.
- [ ] Research: meaningful titles, inspectable project/evidence context, non-color bulk selection, accessible information disclosure; audit native draft restoration.
- [ ] Notebook: correct native linked-note identity/navigation; preserve original editing state; handle renamed/deleted/unavailable links and actionable save failures. Compact note picker and focused insertion without disrupting writing.
- [ ] Reader: source/edition/chapter/passage orientation; predictable preview/keep behavior and restoration; tables, text resizing and keyboard use. Preserve native independent reading sessions.
- [ ] Report: protect source/version identity and issued contents; emphasize draft with focused Add sources; clarify save/version/export and retain disclosure state.
- [ ] Saved: pinned project tools; evidence reachability; clear source/title/excerpt/private-note hierarchy; distinguish project removal from Saved removal and verify recoverability on both platforms.
- [ ] Project context/facts: optional blanks collapsed; relevant unknowns visible; imported sources/retrieval metadata and partial lookup warnings inspectable on web and iPhone.
- [ ] Search: preserve query/filter/selection/scroll; useful paragraph parent identity and previews; content-sensitive rows; accurate grouping/counts; native long-title and Dynamic Type behavior.
- [ ] Detail: clear passage identity and Open in Reader; content-sized notes, private-note identification and actionable save failures.
- [ ] Account: modal/sheet; distinct offline library/local-save/synced guarantees, archive recovery/update path and focus restoration.
- [ ] Workspace/global: explain general workspaces as layouts over shared material, preserve project ownership and stable restoration; visible keyboard focus, non-color selection and coherent spacing.

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
