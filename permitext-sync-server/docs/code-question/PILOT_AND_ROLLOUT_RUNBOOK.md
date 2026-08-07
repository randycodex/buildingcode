# Code Question pilot and rollout runbook

This runbook separates a locally verified release candidate from a private pilot, deployment, and Production verification. Passing local tests never enables the feature by itself.

## Release channels

| Channel | Server configuration | Who can use it |
| --- | --- | --- |
| Disabled | `PERMITEXT_CODE_QUESTION_WORKSPACE` absent or not `1` | Nobody; existing records remain stored and legacy navigation remains available |
| Local | Loopback request plus the localhost UI override | Local development only |
| Private pilot | `PERMITEXT_CODE_QUESTION_WORKSPACE=1` and a comma-separated `PERMITEXT_CODE_QUESTION_PILOT_USER_IDS` allowlist | Only authenticated Pro accounts explicitly listed |
| Broad | `PERMITEXT_CODE_QUESTION_WORKSPACE=1` and no pilot allowlist | All otherwise-authorized Pro accounts; do not use until every release gate passes |

A browser request cannot self-enable the workspace outside a genuine loopback connection. Pilot selection is enforced by the server after authentication.

## Before inviting a pilot participant

1. Confirm the participant is a construction professional authorized to use the selected Project and source material.
2. Obtain permission to use the Project in the pilot and explain that Code Questions create internal professional records, not agency approvals.
3. Confirm Owner, Editor, and Reviewer responsibilities. Do not infer who may issue, whether a second reviewer is mandatory, retention periods, signature wording, or external-sharing permission.
4. Add only the participant's authenticated Permitext account ID to the private-pilot allowlist.
5. Redeploy after changing Production environment variables, then verify the intended deployment and active client separately.

## Required pilot cases

Run at least these cases without copying confidential text into general analytics:

1. Synthetic full lifecycle: Define → Evidence → Analyze → Review → Issue.
2. Synthetic no-AI lifecycle: an approved Evidence Set leads directly to a professionally authored conclusion and Issued Record.
3. Knowledgeable-human-approved content case: exact approved passages, citations, limitations, and missing facts are preserved.
4. Stale-state recovery: revise a dependency after analysis, confirm issue is blocked, then update the dependent record.
5. Review recovery: open, wait, resolve, reopen, and resolve a blocking request with actor/time history.
6. Issuance recovery: interrupt an approved issue attempt, retry the same idempotency key, and confirm one issued version.
7. Supersession: issue a correction and confirm the earlier record remains immutable and linked.
8. Legacy discovery: find, link, unlink, and recover pre-feature work without deletion or duplication.
9. Offline/device: cold read, allowed queued mutation, reconnection, conflict explanation, and recovery on the release-grade iOS target. Mobile Code Question mutation stays closed until its separate gate passes.

## Privacy-safe measurement

Measure only coarse workflow events, anonymized identifiers, durations, counts, outcomes, capability state, and error classes. The permitted event schema lives in `code-question-rollout.mjs`.

Never send question text, Project facts, assumptions, unknowns, addresses, evidence passages, citations, conclusions, reasoning, review comments, prompts, answers, reports, or user names/email addresses to general product analytics. Pilot observations containing professional content belong in the permissioned Project or a separately approved research record.

Minimum candidate thresholds are:

- two synthetic lifecycle cases;
- one knowledgeable-human-approved content case;
- 100% citation resolution for the evaluated cases;
- 100% traceability for evaluated Issued Records;
- 100% legacy discoverability for evaluated legacy records;
- zero severity-one defects and zero data-loss events.

These are release-candidate floors, not permission to roll out broadly. The product owner must approve final policy and broader thresholds after pilot evidence exists.

## Audit checklist

- Integrity: approved evidence is immutable and reconstructable; analysis and conclusion remain distinct; stale dependencies block approval/issue.
- Authorization: direct server calls reject unauthorized roles and non-allowlisted accounts.
- Reliability: offline, conflict, retry, issuance recovery, supersession, and downgrade/disable cases preserve records.
- Accessibility: authenticated web flow and generated HTML/PDF receive WCAG 2.2 AA review; iOS controls expose useful labels, values, hints, and dynamic text behavior.
- Performance: record cold/warm load, stage transition, analysis, and issuance timings without capturing content.
- Privacy and security: confirm minimization, private storage, deletion/retention policy, file containment, CSP, rate limits, and secret handling.
- Sources: confirm provenance, edition, effective date, authority, permitted use, and any visual/non-text limitations.
- Product truth: `Issued` is described as an internally issued professional record, never agency approval or a compliance certificate.

## Non-destructive rollback rehearsal

1. Capture record counts and IDs for Code Questions, evidence snapshots/sets, analyses, conclusions, reviews, memos, Issued Records, promotions, and legacy items.
2. Disable the capability flag. Do not run delete, reverse migration, or destructive schema operations.
3. Confirm Code Question navigation disappears while Saved, Notebook, Research, Report Drafts, Coordination, Workboard, and Legacy/Unassigned work remain reachable.
4. Confirm new artifacts still decode through Project Foundation and iOS preserve-and-ignore/read-only paths.
5. Re-enable the same pilot allowlist and confirm the same IDs, versions, hashes, lineage, and links return.
6. Record the rehearsal result and any recovery time. A failed preservation check blocks rollout.

## Commit, deploy, and Production evidence

Record these as separate facts:

1. Local tests and rendered UI passed.
2. Intended files were committed.
3. The intended commit was pushed and local/tracking/remote SHAs match.
4. A deployment was built from that SHA.
5. Production points to that deployment.
6. The active versioned client/cache is current.
7. A signed-in allowlisted account completed the real lifecycle in a permissioned Project.
8. Rollback was rehearsed without deleting or mutating records.

Do not mark Phase 10 complete while professional pilot, policy, push, deployment, Production client, or real-lifecycle evidence is pending.
