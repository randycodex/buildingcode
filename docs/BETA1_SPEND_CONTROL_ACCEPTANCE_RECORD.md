# Permitext Beta 1 spend-control acceptance record

Status: **September 7 isolated manual pause/recovery passed; notification delivery and automatic threshold linkage remain open**

This record is for the remaining delivered spend-notification and hard-stop gate. The September 7 owner instruction to continue the six steps and perform recommended actions covers the isolated manual drill recorded below. This document itself grants no authorization for additional provider changes or customer-facing interruption.

Official behavior references:

- [Vercel Spend Management](https://vercel.com/docs/spend-management)
- [Vercel notifications](https://vercel.com/docs/notifications)
- [Vercel project pause and resume](https://vercel.com/docs/projects/managing-projects#pausing-a-project)

## Evidence boundary

These are three separate results:

1. **Delivered notification:** the owner receives the actual Vercel web and email notification for the intended Spend Management threshold.
2. **Pause/recovery behavior:** an explicitly selected disposable or isolated project returns `503 DEPLOYMENT_PAUSED`, then resumes without a redeploy and returns its exact prior `/health` and `/release` identity.
3. **Automatic threshold linkage:** Vercel Activity shows that the configured Spend Management threshold—not a manual pause—caused the automatic team Production pause.

A manual project pause can prove result 2 only. A naturally delivered threshold notification can prove result 1 only. Dashboard configuration, generic Vercel email, source tests, and local 503 simulation do not prove any missing result.

## Non-negotiable safety rules

- Do not deliberately consume the $20 on-demand amount to trigger this exercise.
- Do not lower the team spend amount to or below current spend. Vercel documents that doing so triggers configured actions, including a team-wide Production pause when that action is enabled.
- Do not change the $20 amount, disable the pause action, change notification channels, add SMS/webhooks/Drains, or pause/resume any project without owner authorization covering that action. The owner's September 7 standing authorization supersedes the earlier requirement to ask again immediately before every recommended action.
- Do not run a pause drill against public Permitext while customers may be using it. Prefer an isolated non-customer project and a declared maintenance window.
- Do not include account tokens, billing details, customer identifiers, raw provider payloads, or email contents in the retained record.
- Stop on unexpected spend, an unintended project pause, a release mismatch, inability to resume, or any customer-impact signal. Use the incident runbook before continuing.

## Read-only preflight

Record without changing provider state:

- Operator and UTC timestamp:
- Vercel team and role (owner/billing required for Spend Management):
- Billing-cycle start/end:
- Included infrastructure credit used:
- On-demand spend used:
- Configured spend amount:
- Automatic team Production pause shown enabled: yes / no
- Owner web notification enabled: yes / no
- Owner email notification enabled: yes / no
- SMS/webhook/Drain state:
- All team projects and current paused/running state:
- Selected isolated project for a pause/recovery drill, if separately authorized:
- Selected project release ID, exact Git commit, Production URL, `/health`, and `/release` result:

The current expected configuration is a $20 on-demand spend amount, owner web/email notifications, automatic team Production pause at 100%, and SMS off. Any mismatch is a review item, not permission to change it.

## Result A — delivered Spend Management notification

Use a naturally reached 50%, 75%, or 100% threshold whenever possible. Do not generate paid traffic. If no threshold is naturally available, leave this result open until the owner separately approves a bounded provider-side method.

- Threshold percentage:
- Vercel Activity event timestamp:
- Web notification received: yes / no; timestamp:
- Email received: yes / no; timestamp:
- Notification identifies the correct Permitext team: yes / no
- No token, customer identifier, or private content exposed: yes / no
- Result: pass / fail / not exercised

## Result B — isolated pause and recovery

This result requires owner authorization because pausing changes live provider state. The September 7 standing instruction covers the disposable isolated drill below. It must not be performed while the user is unavailable.

1. Reconfirm the isolated project, maintenance window, current release ID, exact Git commit, `/health`, and `/release` immediately before the action.
2. Pause only that project through the Vercel dashboard or documented project Pause API. Do not change the team Spend Management amount.
3. Confirm the selected Production URL returns `503 DEPLOYMENT_PAUSED`. Confirm no other team project changed state.
4. Resume the selected project individually. Vercel does not automatically resume projects when the spend amount changes or the billing cycle ends.
5. Confirm the same URL recovers without a redeploy, then verify `/health` and `/release` return the exact pre-pause release ID and Git commit.
6. Record Vercel Activity for both pause and resume and run the privacy-bounded Production monitoring audit.

- Explicit authorization and timestamp:
- Selected isolated project:
- Pre-pause release ID and Git commit:
- Pause Activity event:
- Observed `503 DEPLOYMENT_PAUSED`: yes / no
- Other team projects remained running: yes / no
- Resume Activity event:
- Recovery elapsed time:
- Post-resume release ID and Git commit match: yes / no
- Post-resume `/health` passed: yes / no
- Monitoring audit passed or incident opened:
- Result: pass / fail / not exercised

## Result C — automatic threshold linkage

Do not force this result by spending or lowering the configured amount. Capture it only if the configured threshold is reached naturally or the owner later approves a bounded maintenance-window exercise.

- Threshold and current spend at trigger:
- Vercel Activity explicitly attributes the pause to Spend Management: yes / no
- Owner web/email threshold notifications received: yes / no
- Every team Production project inventory and paused state captured: yes / no
- Root cause or expected usage reviewed before resume: yes / no
- Each required project resumed individually and verified: yes / no
- Incident/customer communication required: yes / no; record:
- Final spend and any metering overrun:
- Result: pass / fail / not exercised

## Gate decision

- Delivered notification result: pass / open
- Isolated pause/recovery result: pass / open
- Automatic threshold linkage result: pass / open
- Unexpected cost or customer impact: none / describe
- Owner go/no-go decision:
- Evidence reviewed by and timestamp:

The master-plan hard-stop gate remains open unless the owner accepts the exact results recorded here. No-cost preparation, a read-only dashboard check, or a manual isolated pause must not be mislabeled as automatic Spend Management proof.

## September 7, 2026 preflight receipt

The owner authorized continuing the six closeout steps and recommended routine
actions without repeated approval requests. This inspection changed no provider
setting, budget, project, notification preference or payment method.

- Team `team_9EJNb6mc4ZUQ5bhRcRhmoBRR`; authenticated owner account; Pro active.
- Dashboard cycle: August 28–September 28, 2026.
- Included Credit displays `$7.60 / $20.00`. The separate On-Demand Budget
  control also displays `$7.60 / $20 (38%)`; these overlapping dashboard labels
  are retained as displayed, not added together or asserted to be a separate
  invoiced on-demand charge.
- The expanded Spend Amount field is `$20`; budget enabled and Pause
  Production Deployments checked. The webhook field is empty. Save remained
  disabled; the panel was dismissed with Cancel.
- Global Web and Email notifications are enabled, SMS is off. The Spend
  Management row has Email and Web checked and SMS unchecked. Push is shown
  disabled by the UI.
- Six existing team projects were inventoried. The existing isolated
  `permitext-restore-acceptance` has a successful protected Preview
  `dpl_D8NYCyGxfLVjVpBDi666HZ79udXg`, but its Production target
  `dpl_ABQ5BDfwWJVPW4PqsPg79tTLLBL4` is ERROR. It is therefore not yet a usable
  before/after Production health baseline for the proposed pause drill.
- The returned project JSON omitted pause-state fields; omission was not treated
  as proof that every project is running.

Private API receipts: `/private/tmp/permitext-spend-preflight-team-20260907.json`
and `/private/tmp/permitext-vercel-projects-before-pause-20260907.json`, stored
with owner-only permissions. Raw billing/account details are not committed.
Dashboard and notification controls were independently read through Chrome.
No threshold delivery, manual pause/resume or automatic threshold trigger is
claimed by this receipt. Results A, B and C remain unexecuted.

## September 7 isolated manual pause/recovery receipt

**Result B: PASS for the provider pause/resume mechanism on a static isolated
fixture. Results A and C remain unexercised.** This does not prove automatic
Spend Management activation, delivered threshold notifications, or Permitext's
database/request recovery after a pause.

- Scope: the owner's standing six-step authorization; the owner was present.
  Only the newly created `permitext-pause-acceptance` project was paused.
  No team budget, notification channel or existing project configuration changed.
- Project: `prj_KqU3R9RsUBM2zfYDg9soICq86JtI`; team
  `team_9EJNb6mc4ZUQ5bhRcRhmoBRR`; no database, functions or customer data.
- Production deployment: `dpl_JBrmqt5MNZuWHPWaEHRgRAwf3CoP`, READY,
  `permitext-pause-acceptance-9v8ke3a92.vercel.app`.
- Fixture release ID: `pause-acceptance-20260907-1`. Its manifest records audit
  reference commit `c717cc28803f21b663ef3c221238628d92f076f8`; it is a four-file
  static fixture, not a build of the Permitext application from that commit.
- Exact pre/post `/health` SHA-256:
  `d86903a041760f17243c871879204e915614336e0e1611d3d192b3b10b17299a`.
- Exact pre/post `/release` SHA-256:
  `a9adaa9282987ffb1d67d002a11afa67e5f66472c7eae3c330c7e087ea4b8f1e`.
- Vercel Activity `project-paused`, event `uev_HxCm42I3iGbOV3Am9bQIAETw`,
  at `2026-09-07T15:58:41.388Z`. The first probe returned
  `503 DEPLOYMENT_PAUSED` at `15:58:43.629Z`.
- Vercel Activity `project-unpaused`, event `uev_1niJ7GP2TrYXeUP5btWozCN4`,
  at `2026-09-07T15:58:46.524Z`. The first recovery probe returned 200 at
  `15:58:48.833Z`; both exact endpoint bodies were verified within 4.271 seconds
  of the successful resume API response. The deployment ID did not change.
- The six pre-existing projects retained their Production deployment IDs and
  states before, during and after the drill. The older restore project's ERROR
  target remained ERROR; the Apple sandbox still had no Production target.
  Omitted pause fields were not interpreted as explicit running flags.
- Independent public probes of Permitext `/health` and `/release`, PunchList,
  Licitaciones and PunchList SaaS all returned 200 with unchanged body hashes
  before, during and after the drill. None showed a paused response.
- Post-drill Production monitoring audit at `2026-09-07T15:59:47.828Z`:
  14 Production entries, three successful health requests, zero actionable
  findings, server errors or database-failure events. This bounded sample is
  not a long-duration monitoring or Research latency claim.
- Cleanup: Vercel returned HTTP 204 for deletion of this exact disposable
  project at `2026-09-07T16:00:35Z`. A fresh project inventory confirmed its
  absence and all six pre-existing Production targets unchanged. The fixture's
  deployment and CLI-created protection-bypass token belonged only to that
  deleted project. No customer project was deleted.

Private receipts, endpoint bodies, manifest, event payloads and the redacted
monitoring report are under
`/private/tmp/permitext-pause-acceptance-20260907/`. Raw provider payloads and
credentials are not committed. The static fixture used ordinary hosting
requests; no metered traffic was generated to force a spend threshold.
