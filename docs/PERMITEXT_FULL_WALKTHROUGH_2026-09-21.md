# Full web and iPhone walkthrough — September 21, 2026

Status: in progress. This is a running evidence and repair log, not release acceptance.

## Scope

Use a dedicated disposable account through signup, Free access, Pro workflows, Projects, search, Reader references, saves, notes/comments, Research, bidirectional sync, edit/delete/restore, persistence after reopening, and final account deletion. Inventory additional exposed features as the walkthrough proceeds. Do not include real account content in test fixtures or destructive actions.

## Version baseline

- Live `https://permitext.com/health`: production release `d01cbfb9576b2773dbc361e3a14f0dbceeee94ac`, healthy PostgreSQL normalized-v4, matching remote main when checked.
- Local branch `codex/restore-native-navigation`: `e5f52057a`, 12 commits ahead of remote main; includes Trash and web/iOS parity work.
- Paired physical iPhone 17 Pro: installed Permitext 1.0 (41). Prior development provenance is consistent with the installed UI; no current TestFlight acceptance established.
- Owner requested current live code and delegated the release choice. Plan: validate and publish current changes before testing new backend features.

## Findings and repairs

### W001 — Trash endpoints missing production routing

- Severity: high; release blocker for new recovery feature.
- Evidence: app exposes `/content/trash` while `vercel.json` has no `/content/:path*` dynamic rewrite. Local HTTP tests alone do not exercise Vercel routing.
- Expected: web and iOS Trash requests reach the authenticated backend.
- Actual: deployment configuration leaves these requests without their backend route.
- Local repair: added the content namespace rewrite and included it in the routing regression contract; routing checks pass.
- Live verification: pending release; do not call this fixed in Production yet.

### W002 — Broad smoke harness still targets the retired workspace root

- Severity: verification gap.
- Reproduction: `node tests/smoke.mjs`.
- Actual: its `webRoot` fetch uses `/` (now marketing), so a combined privacy/workspace-link assertion fails. Trial inspection of `/workspace` exposed further obsolete asset-version, Settings copy, native plan-label, and workspace-layout expectations.
- Expected: smoke coverage should follow current customer entry routes and behavior.
- Status: recorded for focused harness maintenance; no smoke assertions were relaxed or committed. Broad smoke remains failing and is not counted as passed.

## Execution log

| Check | Result | Evidence / next step |
| --- | --- | --- |
| Live health and remote commit | Pass | Health release matches remote main at baseline. |
| Marketing to workspace | Pass | Open Workspace opens `/workspace`; Reader text renders. |
| Account isolation | In progress | Browser initially contained an existing Lifetime Pro session. Signed out before disposable signup; no account data deleted. |
| Disposable signup | Pass | Completed owner-approved Terms/Privacy consent and profile. Account UI confirms the designated plus-address, Free plan, test display name, product emails off, and no Projects. Authentication-provider verification was not observed directly. Email intentionally omitted from this report. |
| Physical iPhone access | Pass | Mirroring opens installed Permitext; Saved UI visible. |
| Full feature inventory and user journeys | Pending | Await release alignment and disposable account. |
| Web to iOS and iOS to web sync | Pending | Must use same disposable account on both clients. |
| Research | Pending | Verify test-account access and bounded available allowance. |
| Account deletion | Pending | Final step after populated-account checks. |

## Automated release evidence

Passed: Trash policy/HTTP/web preflight; disposable PostgreSQL recovery; Vercel/static marketing routing; offline/recovery; all-edition search parity; search position; Reader recovery; Settings wording; continuity; schema readiness; backend performance; account export/authorization/deletion inventory; sync state/conflicts; Research summary/context; minimal Free access. Deploy content inventory also passed. Client build pending. These do not replace live user-journey acceptance.

Owner chose a real subscription instead of a temporary entitlement. Prepare Stripe checkout, verify actual amount/renewal terms, and test cancellation before deleting the disposable account. No temporary entitlement has been granted and no payment has been made.

## Evidence conventions

Each finding should include steps to reproduce, expected/actual result, affected version, and verification after repair. Distinguish source/test success, Production behavior, physical development build behavior, and TestFlight behavior. Never store credentials, verification codes, raw account exports, or personal account data here.
