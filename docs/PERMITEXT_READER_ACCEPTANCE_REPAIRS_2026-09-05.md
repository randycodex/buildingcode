# Reader acceptance repairs — September 5, 2026

This continues the original 17 production-readiness findings, especially P2-4,
P2-5 and P2-6. It does not authorize public submission or change the accepted
Research evaluation scope. No account, entitlement, paid Research or purchase
was changed during this Reader check.

## Findings and changes

On physical TestFlight build 60, Fuel Gas Code (2022) Chapter 5 Table 504.2(1)
showed its Height and Lateral columns. Mirroring gestures did not move the table;
the owner independently tried a physical sideways swipe and reported that no
additional columns appeared. The plain and search-highlighted baseline table
could scroll in the iOS 27 Simulator, so that environment does not reproduce the
physical failure.

The isolated HTML table previously gave WebKit a 3,036-point viewport inside a
second horizontal SwiftUI scroll view. The repair fits WebKit to the Reader and
lets the authored HTML overflow handle horizontal movement. Decorative search
borders cannot intercept touches. Authored HTML, merged cells, assets, fallback
eligibility and the contained vertical viewport for unusually large tables are
preserved. Physical confirmation on the replacement TestFlight candidate remains
required.

The Production web Reader briefly showed the previous Building Code text beneath
a newly selected Fuel Gas label. The code-change handler awaited a chapter list
before clearing the old chapter, and selector/detail requests had no navigation
generation guard. The repair clears previous text synchronously, rejects obsolete
catalog/detail/body completions, rejects stale section metadata, and resolves an
unrecognized chapter within the selected code. A failed chapter load exposes a
visible retry; successful retry persists the accepted selection. Closing a Reader
invalidates pending navigation. Web shell cache identifiers are synchronized at
`20260905-reader-navigation-v47` / `permitext-pro-shell-v786`.

## Verification

- `npm run check` and `node tests/smoke.mjs` passed. After the final retry-button
  placement/style correction, the navigation-race, navigation-menu and Reader
  search-recovery contracts and JavaScript syntax check passed again.
- The actual-function race test covers A → B → A, delayed catalog/detail/body,
  stale failure, section-metadata completion, removal, invalid chapter identity,
  and a retry button within the visible error panel. Only accepted navigation
  persists continuity state.
- The rendered local browser switched correctly between 2022 Fuel Gas and 2014
  Building Code. A read-only loopback proxy delayed the Fuel Gas chapter catalog
  by four seconds and returned one deliberate HTTP 503. The Reader cleared old
  enacted text immediately, showed the failure and visible retry, then recovered
  to the correct Fuel Gas text. The final retry styling was reloaded and inspected.
  The proxy forwarded only GET/HEAD to a credential-free local public Reader.
- Both native Fuel Gas horizontal-swipe tests passed, with and without an actual
  search highlight. Before/after screenshots were inspected: the later vent
  diameter/FAN/NAT columns become visible after swiping. The test checks that the
  initial Height column leaves the viewport; it does not request an accessibility
  frame for a cell WebKit has clipped away.
- A historical compatibility test initially targeted obsolete 2014 Chapter 7
  block offsets/IDs. Its fixture now uses the current prepared document's figure
  and table IDs, with explicit failure if a requested block is absent. The rerun
  passed with zero failures: Figure 705.7, merged-cell Table 705.8 and formatted
  Table 1004.1.1. All three attached screenshots were visually inspected.

Private local evidence is under
`/private/tmp/permitext-reader-release-acceptance-20260905/`: `npm-check.log`,
`smoke.log`, `reader-test-proxy.jsonl`, `table-baseline.xcresult`,
`table-search-baseline.xcresult`, `table-fixed.xcresult`,
`table-acceptance.xcresult`, `historical-table-acceptance.xcresult` and the exported
attachments. Earlier failed runs are
retained as troubleshooting evidence; their whole-suite status is not a pass.

## Independent release checks before these edits

Production deployment `dpl_5oSqJvssRvgxjsDMb1pWs5AZY87f` was READY at
`bc4230fe68f9cc362d9bf0e99d8814ffd0a87c40`. All three approved policy files matched
their served hashes. Both universal-link origins passed for the expected app ID.
The authentication audit passed 11/11 configuration checks while explicitly
retaining incomplete manual/provider acceptance. Direct health reported the
expected release and PostgreSQL storage.

The deployment-bound monitoring audit since `2026-09-05T23:43:07Z` parsed 1,000
entries, including 40 successful health checks, and reported zero actionable
signals or invalid records. This was a capped sample, not an exhaustive review
of all traffic. It contained no Research latency samples. These observations
describe the preceding candidate; the repaired candidate is verified below.

## Published Reader candidate

PR [55](https://github.com/randycodex/buildingcode/pull/55) merged at
`2026-09-06T00:38:27Z`, publishing
`d6986c572924061d2545c9ae693e82a1c50870de`. Production deployment
`dpl_DiTyeVpyBvTZAzJExxdwtCrJfthL` is READY at that revision. Both public origins
returned the exact release, healthy PostgreSQL/normalized-v4 storage and all four
web shell assets with hashes matching the commit. `npm run verify:production`,
the two-origin universal-link check and the three approved policy hash checks
passed. The deployment-bound early monitoring sample contains 15 entries,
including three successful health requests, with zero actionable signals or
invalid records. It contains no Research latency samples and is not an
exhaustive traffic review.

The actual deployed browser showed cleared text and a loading state while
switching from 2022 Fuel Gas to 2014 Building Code, followed by the correct text.
Reader no-match guidance and clearing the search passed. Global no-match recovery
offered shorter terms; selecting "electrical" returned 25 results. Opening
"101.4.1 Electrical" displayed that provision with the Building Code (2022)
label. These bounded paths carry the search checks forward to the repaired
Production candidate.

The signed 1.0 (61) archive was built from the same commit, with native runtime
tree `cf848a29c8a5e5708d31c864487bfed33cdc78a8`. Strict deep signature verification
passed. Its signed entitlements and packaged privacy-manifest semantic union
match build 60; the three Swift dependency checkouts match their pinned
revisions. This packaged comparison does not establish provider attestations or
public-release acceptance. The app retains the live backend and
`isolated-table-fallback` rollout configuration.

Upload succeeded at `2026-09-06T00:43:48.077Z` and the export command exited zero.
App Store Connect completed processing and lists build 61
(`f2c7cff0-a357-49bc-baaa-58f6efe5dbac`) with the existing Internal Testers group
and one tester. Its detail page confirms that group's access. No external group
or public submission was added. The archive is retained
at `/private/tmp/permitext-1.0-61-d6986c572.xcarchive`. Private candidate evidence
includes `build61-evidence.json`, `build61-archive.log`, `build61-upload.log`,
`served-reader.json`, `reader-policy-publication.json` and
`reader-monitoring-audit.json` in the evidence directory above.

## Outstanding candidate work

Install build 61 and confirm the physical table gesture. After repeated
connection attempts, Mirroring most recently reports "iPhone Not Found"; the
owner has been asked to make the locked phone available. Restore the
owner's original 2014 Browse selection and Saved view after the device check.
The broader remaining acceptance items in the original backlog, including P1-4
and the final owner go/no-go, remain open.
