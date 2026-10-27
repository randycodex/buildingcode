# Research v2 engineering acceptance — local only

Branch: `codex/research-rebuild`. This pass addresses the five engineering items
requested after the first rebuild. Human review is deferred at the user's request.
Nothing was pushed, deployed, or applied to production data.

Later local configuration work is recorded in
[Research v2 production configuration](RESEARCH_V2_PRODUCTION_CONFIG_2026-10-27.md).
Its default-off hosted configuration supersedes the deployment block described
in this earlier acceptance snapshot; neither pass deployed anything.

## 1. Product connections

The v2 interface now exposes Project assignment in its question column and the
existing Notebook/Report actions under “Save or share” on each answer. Creating
Research within a Project retains that destination. Assignment does not import
Project facts into the answer context.

The browser found a Report handoff failure for answers generated before Project
assignment. Those answers correctly retain their original Project snapshot.
The Report action now makes an explicit Project link, and Report source lookup
honors that link. It does not rewrite the saved answer, its original Project,
evidence, or citations. A conflicting existing membership still requires an
explicit move through the existing product workflow.

Verified through the v2 generation route on both file storage and PostgreSQL:

- Project assignment and a follow-up excluding an unselected Project-fact sentinel.
- An original answer explicitly linked into a Project Report.
- A Note in a separately chosen Project containing the exact answer reference.
- Both direct-answer and Note-reference Report generation.
- Immutable original answer/evidence after all handoffs.
- V2 completion advances the Project artifact revision seen by a second client.

The new pane is registered with the existing sync refresh path, including Project
scope and composer focus/selection restoration. This adds no polling mechanism.
The browser verified assignment, saving a Note, reopening it, following its saved
Research reference, and the successful “Included in Report” state.

## 2. Source and answer coverage

Twelve canonical-library discovery checks pass, covering the original ramp/door/
stair cases plus corridor sprinkler tables, occupant-load tables, fire-partition
definitions, and Mechanical Code exhaust provisions. Discovery never attaches a
candidate automatically.

Nine additional paid Luna cases use real canonical passages, including complete
tables and footnotes:

| Case | Focus | Automated result |
| --- | --- | --- |
| Indoor business office | 1,500 gross square feet, factor, optional deduction, rooftop scope | Pass |
| Rooftop load 74 | Exact boundary of “exceeds 74” | Pass |
| Rooftop load 75 | Certificate language and missing referenced provisions | Pass |
| Residential amenity footnote e | Function listed elsewhere prevents choosing the amenity row merely for a lower count | Pass |
| Group R common corridor | Unsprinklered row, occupant threshold and within-unit qualification | Pass |
| Partial sprinklers | Table footnote requires protection throughout under the specified provisions | Pass |
| Group E exception | Instruction-room and assembly-room doors, ground level and public way | Pass |
| Mechanical exhaust | Permitted discharge, prohibitions, exceptions and missing distances | Pass |
| Missing definition | A list pointing to Chapter 2 does not supply the definition itself | Pass |

Run: `2026-10-27T02-58-26-089Z-9cb1290c`; 20 provider calls; median engine time
8.96 seconds. Engine SHA-256:
`6413d43742f3cdd944d0df6bcee1e06e2aed930c1ed012ede08553093d7b2da9`.
The engine and prompts were unchanged during this engineering pass. The prior
twenty-case run is retained separately; these nine cases expand that coverage.

These are developer checks and Luna review outcomes. They do not establish
complete regulatory recall or independent substantive accuracy. Human review
remains deferred, and no case was marked human-approved.

## 3. Database, permissions and usage

The complete v2 HTTP suite ran against a fresh local PostgreSQL cluster using the
shipped application handlers, schema initialization and Neon SQL encoder. Only
Neon's remote fetch transport was replaced with a test-only `node-postgres`
bridge. Each query/batch uses a real database connection and real SQL/transactions.

The final acceptance pass made **915 SQL requests** and passed. It covers completed
answers, exact evidence snapshots, duplicate-request exclusion, dropped-response
replay, stale evidence, cancellation, failed-provider recovery, stable retries,
Project/Notebook/Report handoffs, sync revisions, account isolation and paged
history. Application input/output usage is persisted independently of the test
evaluation ledger. All provider responses in this database suite are doubles;
there are no paid calls in the suite.

No external database requests were made. The temporary cluster was stopped and
removed after the test. PostgreSQL 18 and an isolated `pg` 8.23.1 test driver were
available on this machine. The application dependency manifest was not expanded.

Reproduce from `permitext-sync-server`:

```sh
npm install --prefix data/research-v2-pg-runtime pg@8.23.1 --ignore-scripts --no-audit --no-fund
npm run test:research-v2:postgres
```

The test requires local `initdb` and `pg_ctl`. It creates its own cluster on an
unused loopback port and cannot use a configured production database.

## 4. Compatibility, recovery and layouts

Sixty-five retained legacy-format conversations were seeded in both storage
suites. All are reachable through bounded thirty-item pages without duplicate
IDs. Opening one preserves its conclusion and explanation without generation.
An older selected conversation remains represented in the rail even if it falls
outside the first history page.

Stored failed questions now show their error and a retry action. The client uses
the public `requestID` field and retains it on retry. If a failure alone advanced
the conversation revision, the next retry can adopt that revision; changes to
passages, Project context or unrelated messages do not receive that exemption.
A question from an earlier context offers “Ask again” with a new request identity.

The browser verified seventy questions across three pages, a legacy answer, an
unsent draft surviving the “Original Research” switch, and v2 answers remaining
readable in the original interface. Phone and tablet viewport controls were
exercised at requested 390×844 and 768×1024 pixels. The browser reported effective CSS viewports of 300×649 and 591×788; the Research panel fit
both, and the composer remained within the viewport with Questions expanded.
The temporary viewport override was reset.

This is browser layout and interaction evidence. It is not a physical-device or
native-app build test. Existing legacy payloads and routes remain supported; the
native Research interface has not been rewritten in this branch.

## 5. Replacement controls and spending

- The original engine remains the default.
- `PERMITEXT_RESEARCH_V2=0` prevents new v2 provider dispatch while retained answers
  remain readable.
- `PERMITEXT_RESEARCH_V2_USERS` can restrict the local opt-in to listed account IDs.
  The authenticated config endpoint informs the UI whether v2 is available.
- “Original Research” switches the local interface back while retaining history,
  evidence, the selected conversation and its unsent draft.
- Generation now accepts the existing accounted application provider separately
  from an optional evaluation-budget wrapper. The application path retains its
  ordinary auth, entitlements, turn reservation, spend caps and usage accounting.
- Both v2 and original Fast answers in the local testing session use the same
  durable $7 evaluation ledger. Each original Fast call reserves once; v2 reserves
  each drafting/review call. Exhaustion returns HTTP 429 before dispatch. The local Verified preset is blocked because it can
  request models outside the Luna-only allowance. Normal application billing
  remains separate from this local testing restriction.
- The deployed-environment block remains in place. This branch cannot enable v2
  on Vercel or under `NODE_ENV=production` through a URL or allowlist change.

Current cumulative ledger checkpoint: **$0.077652 accounted of $7** across 235
calls; $0.066164 settled estimates and $0.011488 retained conservatively for the
previous interrupted call. Remaining allowance: **$6.922348**. These are API cost
estimates, not invoice reconciliation.

## Remaining limits

The five items now have local implementation and verification coverage. Physical
hardware/native-client checks and hosted identity/database transport checks still
need their corresponding environments; they were not simulated into a release
claim. A later release must explicitly configure and validate deployed execution,
normal operational spending, rollout selection and rollback. No deployment or
production switch is authorized by this work. Human reviews remain for later.
