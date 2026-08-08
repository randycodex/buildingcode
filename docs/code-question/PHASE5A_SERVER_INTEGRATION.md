# Phase 5A — Server Integration and Data Authority

Status: Complete on the `codex/code-question-workspace` worktree (uncommitted; external rollout not included)

Last updated: August 7, 2026

## Why this corrective gate exists

The Phase 3–9 branch work originally delivered the intended workspace shell,
lifecycle renderers, and pure domain contracts while material rendered paths
still treated browser workspace state and deterministic client fixtures as the
professional record. Granular server commands existed, but the web client had
not yet connected the complete lifecycle to them.

Phase 5A was introduced to correct that discrepancy rather than recast local UI
evidence as server-integration evidence. The consolidated worktree now closes
the server-authority, account-isolation, organization-role, clean-session,
offline-replay, and immutable-issuance integration gate described here.

## Current status

- Complete: discrepancy audit and corrective architecture.
- Complete: authenticated Project authority, Project-owned storage routing,
  authoritative server hydration, and full lifecycle command wiring.
- Complete: account-scoped cache/sign-out isolation, stable-ID offline replay,
  compare-and-swap conflict preservation, and ambiguous-success recovery.
- Complete: HTTP coverage for Project/account/organization isolation, forged
  role and approval attribution, approved-evidence-only exact analysis binding,
  concurrent request collisions, blocking Review resolution, immutable
  issuance, failure recovery, idempotent retry, and hostile key reuse.
- Complete: exact clean-session reconstruction of IDs, versions, citations,
  hashes, Review state, and issued lineage.
- Complete: focused checks wired into `test:code-question`, `check`, and `smoke`;
  all three pass on the consolidated worktree.
- Complete: rendered localhost server-hydrated Definition `r1`/`v1`, real
  active-Project Saved candidate import, correct Analyze/Review/Issue gating,
  and clean browser console.
- Complete: final no-P1 server-authority and authorization audits after
  remediation.

Historical Phase 2–10 commits and local render tests remain evidence for their
UI/domain scope. The consolidated uncommitted Phase 5A changes and verification
listed above provide the separate server-integration evidence. They do not
claim a commit, deployment, Production verification, professional pilot, or
completion of the remaining Phase 9/10 external gates.

## Corrective architecture

- Project Foundation artifacts and server commands are the authoritative
  professional record.
- The existing web lifecycle models remain presentation and optimistic-cache
  adapters; they must hydrate from server artifacts and may not independently
  declare analysis, approval, or issuance complete.
- Project access, role, storage owner, and owner scope are resolved by the
  server from authenticated Project membership.
- Offline mutations use stable request IDs and replay through the same
  authorized server commands with compare-and-swap checks.
- Account-specific Code Question caches are isolated by authenticated account
  ID and unloaded when that account signs out.
- Existing Research generation, evidence validation, collaboration records,
  Report Manifest v3, and issuance-saga storage remain the implementation
  foundations; no parallel lifecycle is introduced.

## Non-goals

- Phase 5A does not enable the feature by default or change Production.
- It does not begin or substitute for a permissioned professional pilot.
- It does not satisfy final policy, source-rights, retention, accessibility,
  physical-device, deployment, active-client, or rollback-rehearsal gates.
- It does not make browser cache, synthetic fixtures, or local render success
  authoritative professional records.

## Completion boundary

Phase 5A is complete only after the visible workflow is server hydrated, HTTP
integration tests cover persistence/isolation/roles/analysis/review/issuance,
offline replay and conflict behavior are proven, a clean second session can
reconstruct the record, and the final architecture audit finds no P1 bypass.
That boundary is satisfied on the consolidated branch worktree by the passing
focused/full suites, rendered localhost evidence, and clean final audits listed
above. The feature remains default-disabled and no professional pilot begins
here.
