# Permitext Zoning Research — owner-approved successor semantic result

Date: August 30, 2026

Status: **PARTIAL — QUALITY, RELIABILITY, COST, AND RELEASE GATES OPEN**

This record retains the one paid semantic run explicitly authorized by the Permitext owner after the separately frozen remediation successor passed its no-cost gates. It does not authorize public Zoning Research, deployment, a merge or push, pricing or allowance changes, the disabled 24,000-character candidate, or professional Zoning sign-off.

## Immutable run identity

- Successor file: `permitext-sync-server/evals/zoning-cases-expanded-batch-1-successor.json`
- Successor SHA-256: `d07063fa12ec993fde8802e6b58971d5cc1873a52fbefbe9e538b81acb94d30f`
- Source commit: `c62a32c1b6736015e0bef32862cbb846df853659`
- Run ID: `5480ed8f-6d0c-46b1-a108-d12e8e13b7da`
- Machine result: `permitext-sync-server/evals/results/2026-08-30T19-40-50-171Z-5480ed8f-6d0c-46b1-a108-d12e8e13b7da.json`
- Review report: `permitext-sync-server/evals/results/2026-08-30T19-40-50-171Z-5480ed8f-6d0c-46b1-a108-d12e8e13b7da.md`
- Scope: all 30 ordered successor cases, one repetition
- Cumulative spend ceiling: $5.00
- Authorization state after run: consumed and not reusable

The dedicated runner acquired an exclusive fail-closed lock, verified the committed server tree and exact successor SHA, ran only the authorized scope, and automatically consumed the authorization against the new result's run ID. The lock was removed after terminal recording.

## Result

- Terminal status: `partial`
- Case slots completed: 30/30
- Graded answers: 27
- Fatal-gate passes: 18/27
- Graded quality failures: 9/27
- Fail-closed execution errors: 3/30
- Failed operations charged to a user: 0
- Pending paid requests: 0
- Charging-integrity gate: passed

The three execution failures were one invalid structured response after bounded retry and two deterministic verification failures after bounded revision. They affected the office-to-residential conversion, City of Yes transition, and MIH historical-zoning-lot scenarios. These are release-blocking reliability evidence, not permission to relax the verifier.

The nine graded failures were Use Group Table, Amendment History, Missing Location Facts, R7A Standard Height, R7A Lot Coverage, Zoning Lot Contiguity Definition, Cellar Floor Area Definition, the deep-through-lot rear-yard-equivalent case, and the unverified-transit-zone parking case. Their fatal dimensions cluster in citation validation, unsupported claims, required-concept coverage, uncertainty, and material-fact recognition.

## Settled cost

- Total paid answer/grader requests: 106
- Total evaluation spend, including independent grading: $3.333192
- Production operating cost: $2.701895
- Failed production operating cost: $0.394949
- Completed production turns: 27
- Completed-turn production cost: $0.082615 p50, $0.120995 p90, $0.158669 maximum
- Failed-work-amortized cost: $0.100070 mean per completed turn, or $10.01 per 100 all-Zoning turns

The no-cost mixed-month bootstrap now projects provider p90 of $6.06 at 0% Zoning, $7.15 at 25%, $8.23 at 50%, and $10.41 at 100%. Under the already accepted planning reserves, the 100%-Zoning p90 contribution is approximately negative $0.19 on web and negative $2.21 on iOS at the confirmed 15% App Store commission.

This sample is adequate to show that the current all-Zoning path is above the accepted $4–$6 target. It is not pricing-ready because the semantic and reliability gates failed. The $20 price, 100-turn allowance, and disabled additional-turn sales remain unchanged.

## Required next gate

The complete no-cost post-run classification is retained in [PERMITEXT_ZONING_SUCCESSOR_FAILURE_TRIAGE_2026-08-30.md](./PERMITEXT_ZONING_SUCCESSOR_FAILURE_TRIAGE_2026-08-30.md). It identifies three evaluator defects, five product-completeness defects now covered by new deterministic regressions, three answer-key/evidence blockers requiring owner dispositions, and the three execution-failure paths. Two blockers are bare references to unselected ZR 101-70 and 23-34. Current official review of the third confirms selected ZR 23-343 as the residential deep-through-lot branch, while ZR 24-31 makes community-facility status a missing material fact in the frozen question. The immutable paid result remains unchanged. Current successor preflight is intentionally fail-closed at 27/30 until coherent case corrections are approved for a separately versioned successor. See [PERMITEXT_ZONING_CASE23_APPLICABILITY_AUDIT_2026-08-30.md](./PERMITEXT_ZONING_CASE23_APPLICABILITY_AUDIT_2026-08-30.md).

1. Diagnose and repair the three execution failures and nine graded fatal-gate failures without weakening citation, missing-fact, evidence, or unofficial-aid boundaries.
2. Retain the [completed 27/30 ready-case evidence-budget advisory](./PERMITEXT_ZONING_SUCCESSOR_EVIDENCE_BUDGET_ADVISORY_2026-08-30.md) as no-cost direction only; the 24,000-character supplemental candidate remains disabled until a corrected full successor and clean semantic comparison pass.
3. Freeze any remediation as a new exact successor with preserved lineage and owner-reviewed answer-key/rubric changes.
4. Obtain a new explicit one-run authorization and cumulative cap before any further paid semantic confirmation; this authorization cannot be reused.
5. Require a complete clean semantic result, accepted economics, and exact-release web/TestFlight physical-iPhone acceptance before public Zoning Research can be enabled.
