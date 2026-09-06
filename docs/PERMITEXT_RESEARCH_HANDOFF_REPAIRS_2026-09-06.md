# Research handoff repairs — September 6, 2026

Status: Production publication verified; build 62 uploaded and processing. Production
now serves PR #58 (`e60ca415fe8b7b60be65449b7ef49baccc82eec3`); the phone remains
on the previous build-61 candidate. This continues the three defects captured in the
[approved confirmation](./PERMITEXT_RESEARCH_HANDOFF_CONFIRMATION_2026-09-06.md),
within the original production-readiness audit. The local repair phase used no
paid Research call or live content/entitlement change. The owner subsequently
approved Production publication and the next TestFlight upload for PR #58.

## Restored owner session

The owner signed back into the usual account. The physical Account screen
showed Lifetime Pro Active, 98 included turns and Synced. Existing Projects and
the saved Building Code section were visible. Codex dismissed the Account sheet.
The designated test account remains retained; its previous grant revocation and
sign-out receipts are preserved. No new grant or deletion occurred.

## Reproduced causes and repairs

1. **Outside-authority text was reinserted by application code.**
   `applyResearchOutsideAuthorityStartingPoints` consumed discovery suggestions
   without checking the selected-passage source policy. It ran both before the
   semantic verifier and after the verifier-directed revision. The old HEAD
   independently reproduced the Zoning footer and program-document limitation
   with `useWeb: false`. The helper now requires the same affirmative source
   policy used by retrieval. The exact ramp question's boundary therefore stops
   both insertions. Explicit OMH requests still retain their official starting
   point and attribution limitation. Attribution gates, models, budgets and
   retry counts are unchanged. This fixes the captured deterministic injection;
   it does not establish general semantic quality or approve another paid turn.

2. **The Note link loaded an answer while leaving its panel hidden.**
   An isolated localhost copy of the retained synthetic records reproduced a
   successful conversation GET followed by History alone. The common
   `openResearchConversation` action set the conversation ID but omitted
   `researchConversationPaneOpened`; History's own button set it separately.
   The shared action now reveals the answer only after a successful, current
   account/context check. Missing Note references also produce an explicit
   error. Actual browser click and Enter reopened the retained answer after
   the repair, including after closing its panel. No message submission occurred.

3. **Report presentation discarded available source metadata and formatting.**
   Both renderers now label the Project default separately from the editions
   recorded in included Research. Citations use saved code, section, title and
   edition fields, with a source-ID-matched saved-evidence fallback; they never
   fetch current code to fill a historical citation. Missing labels remain
   explicitly unavailable. Native models now decode the previously omitted
   Research metadata and supported points. Research emphasis is converted to
   readable prose while preserving numbers, conditions and link destinations.
   Web PDFs embed licensed DejaVu Sans fonts for arrows and mathematical
   symbols. Reference chips gain plain-text boundaries when Notes are saved or
   projected for a new Report snapshot. Existing canonical Note documents and
   their stored revisions are unchanged. PDF content alignment is restored
   after classification badges and indented evidence.

The web app asset token and service-worker shell version are advanced for the
Note navigation change. The PDF fonts and their license/provenance are tracked
as server assets.

## Verification

- Focused no-provider regression covers the exact question, initial/revision
  boundaries, explicit outside-authority control, actual browser open functions,
  unavailable/stale cases, historical Note projections, citation fallback,
  Markdown, and immutable manifest rendering.
- The owner-example runtime contract passes all seven conversations and nine
  ordered turns with zero network attempts and zero paid provider calls.
- The isolated browser uses the actual web app and retained synthetic Note,
  conversation and Report data. Its server blocks external fetches and the
  Research message endpoint. Click/keyboard navigation passes with no browser
  errors. The browser exported and downloaded a 40,374-byte PDF whose SHA-256
  matched the local stored descriptor. Hosted Production download acceptance
  remains separate.
- All five pages of the exact retained manifest rendered through the repaired
  web exporter were inspected. The 2014 source labels, qualified facts and
  corrected symbols are readable. The old authored paragraph's joined reference
  and the old answer's program-document limitation remain in that immutable
  manifest, as expected. Both original downloaded PDF hashes remain unchanged.
- A separate new synthetic Report exercises the corrected Note projection and
  Research presentation. Its two web pages were rendered and reviewed. Native
  focused tests verify retained qualifications, readable citations and editions,
  supported points, symbols and absence of literal Markdown. The final native
  run passed both focused tests with zero failures. Its compact handoff fixture
  was visually reviewed and fits on one page without a trailing hash-only page.
- Server check coverage and `npm run smoke` passed. This was not one
  uninterrupted check invocation: an initial run exposed the changed
  presentation-version expectation; the next run reached an offline-cache
  assertion. After aligning the shell generation and asset URLs, all 44
  remaining check commands and `postcheck` passed. The completed prefix was
  retained rather than repeated. A native test also caught a remaining
  explanation emphasis marker, which was repaired before the successful final
  run. No provider call was used for these repairs or checks.

Private evidence: `/private/tmp/permitext-handoff-repairs-20260906/`, including
`baseline-injection.json`, local browser snapshots/screenshots, the scoped local
fixture, `browser-verification.json`, PDF renders, test logs and `.xcresult`
bundles. The fixture session is synthetic and localhost-only. Credentials,
production account identifiers and raw exports are excluded from this record.

## Remaining acceptance

After the native candidate is available, reopen the existing test answer/Note and export a
new Report revision on the deployed web client and physical candidate. The old
saved answer's unsupported limitation must not be silently rewritten; a corrected
answer requires its own authorized generation or an explicit reviewed correction
workflow. The original question's existing paid approval is consumed.

The lower native Note fields, hosted browser download behavior, broader Project
reassignment with different facts, final release binding and the other open
original audit gates retain their separate acceptance status. These repairs do
not authorize App Store submission or public paid Beta.

## Approved publication

The owner approved PR #58 at exact head
`19b0e9c31a071f4122a5e168fd6b47dca0c8934b` for Production and the next TestFlight
candidate. Both reported PR checks passed. The PR merged at
`2026-09-06T14:00:24Z` as `e60ca415fe8b7b60be65449b7ef49baccc82eec3`; its product
trees match the approved head.

Production deployment `dpl_5rp8vnZ9yZ6XBRWbFHofaD7jQqo9` is READY at
`https://permitext-sync-3wkca40x7-randycodexs-projects-b72fc111.vercel.app`.
Codex verified both canonical origins at `2026-09-06T14:03:10.518Z`: release
`e60ca415fe8b`, the exact source and healthy PostgreSQL/normalized-v4 storage.
Six web assets per origin matched the source bytes. Production health,
universal-link configuration and approved-policy publication checks passed.
The first deployment-specific runtime sample has nine successful requests,
including three health requests, and no errors. It contains no Research samples
and does not establish sustained operating or full hosted handoff acceptance.

The signed 1.0 (62) archive was built from that same merged source, with native
runtime tree `7a750a95decd6b47acaf0cdc959ef81cc64641ac` and the build number
supplied as an Xcode build setting. Strict deep signature verification, live
backend/Clerk configuration and all three pinned dependency revisions passed.
Its signed entitlements and packaged privacy semantic union match build 61:
13 collected-data categories, three required-reason API groups and no tracking.
This is a packaged comparison, not provider-policy or public-release approval.

Archive: `/private/tmp/permitext-1.0-62-e60ca415f.xcarchive`.
Executable SHA-256:
`f30608b112f42bf3b9f9603405ddd9386f966ec05381b915bdfbe4caebace624`.
Xcode reported Upload succeeded at `2026-09-06T14:10:03.283Z`, followed by
EXPORT SUCCEEDED and exit 0. Apple processing is in progress. The owner has
temporarily taken the physical phone; installation and device checks will wait
for its return. No owner session was changed during publication.

Private publication evidence:
`/private/tmp/permitext-handoff-publication-20260906/`, including
`publication-evidence.json`, `served-production.json`, `policy-publication.json`,
`early-runtime-sample.md` and the native archive/upload receipts.
