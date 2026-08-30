# Permitext Beta 1 spend-control acceptance record

Status: **Prepared; not executed**

This record is for the remaining delivered spend-notification and hard-stop gate. Preparing it does not authorize a provider setting change, deliberate metered-usage increase, Production pause, budget change, purchase, deployment, or service interruption.

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
- Do not change the $20 amount, disable the pause action, change notification channels, add SMS/webhooks/Drains, or pause/resume any project without explicit owner authorization immediately before the change.
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

This result requires separate authorization because pausing changes live provider state. It must not be performed while the user is unavailable.

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
