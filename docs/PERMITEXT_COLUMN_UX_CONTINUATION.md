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
