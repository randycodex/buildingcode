# Permitext Zoning Research — Owner-Approved Successor Cohort

Date: August 30, 2026

Working branch: `codex/zoning-research-beta1`

Status: **SEPARATELY FROZEN; NO-COST GATE PASSED; PAID AND PUBLIC USE LOCKED**

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
2. Replace the conflicting deep-through-lot height-tier key with the selected R7A-specific ZR 24-382 conclusion.
3. Remove the collateral `particular controls the general` concept from the text-versus-illustration case.
4. Retain the warehouse 25 percent calculation and remove only the duplicate unused-area margin.
5. Retain the weighted-FAR calculation and proposed 5.50 FAR, while removing the equivalent direct-area proof.
6. Retain the office-conversion 6.00 existing FAR concept without a scope trim.
7. Retain the transition/DOB and verified prior-substantive-text boundaries while removing overlapping date/history and duplicate 40 percent requirements.
8. Retain the MIH thresholds and historical map/lot inquiry while removing unused margins and allowing equivalent official historical zoning-lot evidence.

The adapter now permits an explicit `expectedConclusion` for the two corrected keys while preserving the existing required-concept fallback for every earlier cohort.

## No-cost verification

The following gates passed with mock/evidence-package execution only:

- `npm run test:zoning-successor-governance`
- `npm run eval:zoning:successor`
- `npm run test:zoning-successor-evidence-budget`

Results:

- 8/8 approved dispositions reproduced exactly.
- 30/30 cases passed canonical-evidence preflight.
- 30/30 cases passed Permitext conversation creation without semantic mock scoring.
- The 24,000-character supplemental candidate preserved all 87 exact selected sources and all eight structured sources.
- Average assembled evidence was 34,821 characters; maximum was 48,000.
- Average pinned evidence was 13,941 characters and average supplemental evidence was 20,879 characters.
- No paid model calls were made.

## Remaining boundary

The 24,000-character candidate remains disabled by default and no Production configuration changed. The successor records `paidEvaluationAllowed: false`, no cumulative spend cap, `publicResearchReleaseAuthorized: false`, and `professionalZoningSignoff: false`.

A clean semantic confirmation requires a new explicit owner authorization for exactly one stated run and a new cumulative spend cap. Public Zoning Research still requires the later web/iOS, exact release-commit, cost, and manual acceptance gates.
