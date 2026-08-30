# Permitext Zoning Research — Owner-Approved Successor Cohort

Date: August 30, 2026

Working branch: `codex/zoning-research-beta1`

Status: **HISTORICALLY FROZEN; GATE PASSED AT FREEZE; CURRENT PREFLIGHT 27/30; PAID RESULT PARTIAL; PUBLIC USE LOCKED**

Post-freeze correction: stronger bare-section parsing now finds unselected ZR 101-70 and ZR 23-34 in two additional answer keys. A later official-source applicability re-audit also found that approved change 2 imports unselected Chapter 4 rule ZR 24-382 without resolving whether the zoning lot contains a community-facility use. The selected ZR 23-343 text supports the residential branch, but the frozen question does not uniquely establish the applicability branch. The frozen successor and its paid result remain immutable historical evidence, but the three blocked keys are not eligible for reuse. Current preflight blocks them at 27/30. See [PERMITEXT_ZONING_CASE23_APPLICABILITY_AUDIT_2026-08-30.md](./PERMITEXT_ZONING_CASE23_APPLICABILITY_AUDIT_2026-08-30.md) and [PERMITEXT_ZONING_SUCCESSOR_FAILURE_TRIAGE_2026-08-30.md](./PERMITEXT_ZONING_SUCCESSOR_FAILURE_TRIAGE_2026-08-30.md).

## Owner decision

The owner replied `I approve` after being asked to approve the two corrected answer keys and all six prepared rubric-scope dispositions. The durable disposition manifest records those eight decision IDs, the approval time, and the exact approval phrase.

This approval authorizes only a separately versioned evaluation successor. It does not alter the retained paid result, authorize a paid model call, enable public Zoning Research, change pricing or the 100-turn allowance, constitute professional Zoning sign-off, or approve a project conclusion.

## Immutable lineage

- Frozen 30-case parent: `zoning-cases-expanded-batch-1.json`
- Parent SHA-256: `9bbc828896882a441d3f26bab865af2f0f1b2ca12a5fc606bab76ffcf894b24c`
- Owner disposition manifest: `zoning-expanded-successor-dispositions.json`
- Disposition SHA-256: `b7fcc0788d87e2ef2c801c78b54587a21e1e25562bbb34e1a288e913cd90f4ac`
- Separately frozen output: `zoning-cases-expanded-batch-1-successor.json`
- Successor SHA-256: `d07063fa12ec993fde8802e6b58971d5cc1873a52fbefbe9e538b81acb94d30f`
- Case count and ordered IDs: unchanged at 30
- Questions: unchanged
- Selected evidence section IDs: unchanged
- Forbidden safety claims: unchanged
- Non-disposition cases: byte-equivalent after parsing

The successor generator refuses to run if the parent cohort or either bound review document changes. The repository precheck now also requires the successor governance and generation contract.

## Approved changes

The successor contains only these eight dispositions:

1. Replace the unsupported R6A/UAP increment key with the approved evidence-insufficiency conclusion.
2. Historically applied: replace the deep-through-lot height-tier key with a ZR 24-382 conclusion. This disposition was later found insufficiently source-bound because the frozen question does not resolve the ZR 23/24 applicability branch; it is superseded pending a new owner decision.
3. Remove the collateral `particular controls the general` concept from the text-versus-illustration case.
4. Retain the warehouse 25 percent calculation and remove only the duplicate unused-area margin.
5. Retain the weighted-FAR calculation and proposed 5.50 FAR, while removing the equivalent direct-area proof.
6. Retain the office-conversion 6.00 existing FAR concept without a scope trim.
7. Retain the transition/DOB and verified prior-substantive-text boundaries while removing overlapping date/history and duplicate 40 percent requirements.
8. Retain the MIH thresholds and historical map/lot inquiry while removing unused margins and allowing equivalent official historical zoning-lot evidence.

The adapter now permits an explicit `expectedConclusion` for the two corrected keys while preserving the existing required-concept fallback for every earlier cohort.

## Historical no-cost verification at freeze

The following gates passed with mock/evidence-package execution only when this successor was frozen:

- `npm run test:zoning-successor-governance`
- `npm run eval:zoning:successor`
- `npm run test:zoning-successor-evidence-budget`

Recorded freeze-time results:

- 8/8 approved dispositions reproduced exactly.
- 30/30 cases passed canonical-evidence preflight.
- 30/30 cases passed Permitext conversation creation without semantic mock scoring.
- The 24,000-character supplemental candidate preserved all 87 exact selected sources and all eight structured sources.
- Average assembled evidence was 34,821 characters; maximum was 48,000.
- Average pinned evidence was 13,941 characters and average supplemental evidence was 20,879 characters.
- No paid model calls were made.

These are historical freeze results, not the current gate state. The unchanged successor now fails the strengthened answer-key/evidence preflight at 27/30 on three cases before any provider request.

## Paid semantic result

The owner later separately replied `I authorize` for exactly one complete 30-case successor run, one repetition, with a $5 maximum cumulative cap. Run `5480ed8f-6d0c-46b1-a108-d12e8e13b7da` is bound to the exact successor SHA and source commit `c62a32c1b6736015e0bef32862cbb846df853659`.

The run spent $3.333192 across 106 settled answer/grader requests, completed 27 production operations, failed three without a user charge, and passed 18 of 27 graded answers. Failed-work-amortized operating cost projects $10.01 per 100 all-Zoning turns. The semantic, reliability, and cost gates failed. The authorization was automatically consumed against the retained run ID and cannot be reused. Detailed evidence: [PERMITEXT_ZONING_SUCCESSOR_SEMANTIC_RESULT_2026-08-30.md](./PERMITEXT_ZONING_SUCCESSOR_SEMANTIC_RESULT_2026-08-30.md).

## Remaining boundary

The 24,000-character candidate remains disabled by default and no Production configuration changed. The successor records `paidEvaluationAllowed: false`, no cumulative spend cap, `publicResearchReleaseAuthorized: false`, and `professionalZoningSignoff: false`.

A later clean semantic confirmation requires new remediation, a new exact frozen successor, a new explicit owner authorization for exactly one stated run, and a new cumulative spend cap. Public Zoning Research still requires the later web/iOS, exact release-commit, cost, and manual acceptance gates.

## Paid-run guard preparation

A separate `zoning-successor-paid-authorization.json` record is bound to the exact successor SHA-256 and is checked in as `consumed` for the retained run. The dedicated successor runner and the general evaluation entry point both reject reuse without a new explicit owner decision.

The permanent contract proves that:

- a direct `--zoning-successor --run-live` attempt fails before any provider request while the record is locked;
- an active record must cover all 30 cases and exactly one repetition;
- the cumulative cap must be positive and no higher than $5;
- a consumed record cannot be reused;
- the 24,000-character candidate remains disabled; and
- the authorization cannot deploy, enable public Research, change pricing or allowances, or claim professional sign-off.

The preparation itself made no provider call. The later owner authorization was separate, bounded, executed once, and consumed.
