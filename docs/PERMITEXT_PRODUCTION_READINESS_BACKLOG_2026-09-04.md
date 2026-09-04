# Permitext production-readiness repair backlog — September 4, 2026

The owner authorized publishing the existing baseline, aligning web and iOS to
that source revision, and starting repairs on a new branch. This document tracks
the audit findings; it does not approve public release or claim that all findings
are repaired. No paid Research evaluation is authorized by this work.

## Baseline and branch

- Baseline `main` and `origin/main`: `176cca6f2e2d01db6495f29192f805ef7daddfbe`.
- Production deployment: `dpl_DRsWbchJ384r1q7WeTWLJkLZotjh`, READY.
- Both `https://permitext.com/release` and
  `https://permitext-sync.vercel.app/release` returned that exact baseline SHA.
- Native candidate: version 1.0, build 53, built from a separate detached checkout
  at the same baseline. Upload succeeded; Apple processing and device installation
  are tracked in `PERMITEXT_SYNCHRONIZED_BASELINE_2026-09-04.md`.
- Repair branch: `codex/production-readiness-fixes`, created from that baseline.
- Branch repairs are not part of the baseline deployment or native candidate.

The baseline commit preserves semantically unchanged Xcode project/plist ordering
and the shared Xcode Cloud manifest. It does not contain new audit repairs.
The installed build 52 was inspected during the audit; it must not be described as
the newer candidate or as a build of this repair branch.

## First repair batch

Status: implementation and local verification complete; isolated on the repair
branch. Remaining findings below are open.

1. **P0-1, canonical citation edition identity.** Resolve citations using canonical
   section identity; verify the expected edition; fail visibly when the exact
   source cannot be established. Refresh metadata from canonical evidence and
   preserve selected text and historical answer snapshots. Include regression
   coverage for the 2014/2022 section-number collision, saved snapshot identity,
   missing/mismatched sources, and source refresh. Synchronize web shell asset
   versions so a future deployment can deliver the corrected client.
2. **P0-5, retired Workboard mutation paths.** Enforce the existing documented
   retirement at all four asset/preview write routes with authenticated HTTP 410.
   Reject Workboard sync mutations individually while allowing supported records
   in a mixed batch. Preserve historical drawing reads, private previews, Project
   links, and immutable Report sources. Use imported historical test fixtures,
   rather than a production endpoint, to exercise read compatibility.

## Remaining critical findings

| ID | Finding | Acceptance criteria |
| --- | --- | --- |
| P0-2 | Research moved between Projects retains prior active facts/history. | Bind active context to Project/context revision. Moving or unassigning preserves historical answers but starts fresh active context. All generation/retrieval history consumers honor the boundary. Reject a pre-move in-flight completion; preserve retry and usage idempotency. |
| P0-3 | Account transitions do not isolate all private transient state and async results. | Scope web overlays, caches, pending pulls, success/error effects, and native Research view state to captured account/session/conversation identities. Delayed responses cannot affect a new account or conversation. |
| P0-4 | Offline cleanup can remove unsynchronized Notebook drafts and images. | Separate disposable downloads from durable private work. Test draft/image survival through sign-out, session expiry, entitlement loss, upload failure, and reconnect. Distinguish device save from completed synchronization. |
| P0-6 | Concurrent Notebook and Research updates can overwrite changes despite successful responses. | Use atomic expected-version updates, conflict responses, and completion-time context checks. Test simultaneous edits and Research generation racing with Project assignment. Preserve consistency of linked records and usage. |

The original audit classified security, lost work, incorrect citation relationships,
and credible cross-project contamination as P0. Isolated reproductions and source
traces establish these repair priorities; they are not reports of observed
production customer incidents.

## High-priority findings

| ID | Finding | Acceptance criteria |
| --- | --- | --- |
| P1-1 | Automatic fact normalization loses negation, partial scope, and assumptions. | Preserve original language and qualification; promote only unambiguous assertions. Test partial sprinkler systems, negated building status, embedded hypothetical language, and follow-ups. Do not make generation and verification blindly trust the same extraction. |
| P1-2 | Streaming errors omit recovery fields available in JSON responses. | Use one safe public error envelope; verify streamed source-change/prerequisite failures produce the correct visible action and current conversation state. |
| P1-3 | Native cache lifecycle incompletely handles account deletion and revoked/deleted content. | Purge all private cache classes on account deletion; distinguish transport failures from authorization/deletion/revocation; label retained offline freshness accurately. |
| P1-4 | Release acceptance does not substantiate the complete paid-product scope. | Retain Research/Zoning gates until current release-shaped professional review passes. Verify final native archive/privacy aggregation, account reconciliation/deletion, payment lifecycle, and the exact supported platform workflows. |

## Medium-priority findings

| ID | Finding | Acceptance criteria |
| --- | --- | --- |
| P2-1 | Collapsed Project facts remain keyboard-focusable/exposed. | Hidden controls leave both tab order and accessibility tree; focus returns to a visible, appropriate control. |
| P2-2 | Report ignores structured Project facts used by Research. | A shared qualified fact projection feeds Report selection and preserves source/status and immutable report-time context. |
| P2-3 | Native Notebook initial-load errors appear empty/read-only. | Distinct loading/error/empty/cached/permission states; retry available when first load fails. |
| P2-4 | Reader chrome does not consistently show edition. | Historical and current reading positions identify code family and edition without relying on remembered navigation. |
| P2-5 | Tablet toolbar collisions and restricted phone-web scope. | Verify 320/375/390/430/768/1024/1280/1440 layouts and touch behavior. Correct tablet collisions and describe supported mobile capabilities honestly. |
| P2-6 | Exact-match search behavior is insufficiently explained. | Zero-result recovery clarifies matching and offers a broader search path without presenting relevance as authority. |
| P2-7 | Startup waits on catalog requests and a large central client. | Profile the critical path; decouple usable shell restoration from secondary catalog/feature work where safe. Verify meaningful improvement on representative devices. |

## Additional acceptance and polish

- Reproduce the audit's final reload returning to guest state without an explicit
  sign-out. Cause remains unresolved; do not conflate it with a proven session bug.
- Complete physical wide-table access. Mirroring did not establish direct finger
  scrolling failure or success for all table columns.
- Complete native VoiceOver and web keyboard/contrast/touch-target checks.
- Verify the professional path: Project → Research → exact cited provision →
  qualified notes/Notebook → Report → reopening on iOS.
- Clarify the next action between Ask, Investigate, and Decide; a generated answer
  is not automatically a reviewed professional decision.
- Correct the stale native sparkle-icon instruction, transient empty history,
  duplicate search progress wording, and pane positioning after viewport changes.

## Development order and preserved strengths

1. Correctness, authorization, identity/context isolation, and durable work.
2. Recovery, qualified Project facts, and the investigation-to-Report handoff.
3. Measured startup/search/Research performance, preserving verification before
   final answer delivery.
4. Accessibility, edition visibility, responsive toolbar, and physical interaction.
5. Wording, loading transitions, and other polish.

Preserve the multi-pane desktop Reader, independent native readers, authoritative
source presentation, canonical source checks, immutable evidence/answer history,
bounded verification/repair, durable request identifiers, and explicit professional
review gates. Do not start a framework or visual-system rewrite to address these
bounded failures.

## Verification ledger

- Baseline metadata: project/plist semantic equality confirmed; plist validation
  and privacy contract passed.
- Baseline native tests: 163/163 passed, zero failures, at the pinned baseline SHA.
- Baseline native archive: succeeded, strict deep signature verification passed;
  archived app privacy manifest matches the baseline semantically. Upload
  succeeded on September 4 at 20:50:07 UTC. See the baseline record for Apple state.
- Server precheck and main check suites passed. The initial final `postcheck`
  stopped on stale local Tiptap 3.29.0 versus locked 3.30.4. `npm ci` restored the
  existing lockfile; rerun `npm run postcheck` passed, including Notebook dependency
  security and all seven UX alignment phases. No dependency version was changed.
- `npm run build:clients` passed with the locked Notebook dependency.
- Citation integrity and Workboard retirement HTTP regressions passed again after
  the final edits; `node tests/smoke.mjs` passed using isolated local data and no
  provider credentials. Historical Report preview/read assertions remain covered.
- Actual local browser: opened 2022 BC 1010.2 Gates from Search and 2014 BC 1010.2
  Slope through the historical Reader; correct labels and enacted passages rendered;
  no browser console errors observed. Saved-citation/source-refresh branches are
  covered by the behavior contracts, not a fresh paid Research UI run.
- Workboard retirement received an independent read-only implementation/test
  review with no actionable findings. No live PostgreSQL mutation test was run;
  filtering is shared before the two storage adapters.
- Baseline Production health and Apple association checks passed after deployment;
  no error/fatal runtime logs found for this deployment in the checked window.
- No real account deletion, customer-data mutation, paid Research call, App Store
  submission, public release, pricing/allowance change, or rollout-gate activation
  forms part of this batch.
