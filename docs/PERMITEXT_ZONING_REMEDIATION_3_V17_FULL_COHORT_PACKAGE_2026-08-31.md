# Permitext Zoning Remediation Successor 3 — Locked V17 Full-Cohort Package

Date: August 31, 2026

Branch: `codex/zoning-research-beta1`

Exact package commit: `e0c1c5d2846707641a6352fcdf0a397736724fda`

Status: locked; no paid run authorized

## Outcome

This package preserves the reviewed V17 safety repair while replacing the earlier case-3 fail-fast execution policy with a bounded full-cohort diagnostic policy. A completed answer that fails a quality rubric remains part of the result and the next ordered case runs. A Research operation that fails closed may also be recorded and skipped, but only when terminal telemetry proves all of the following:

- operation status is `failed`;
- the customer/evaluation turn was not charged;
- the exact failure code is `RESEARCH_VERIFICATION_FAILED`;
- at least one provider request was recorded;
- zero provider requests remain pending; and
- no telemetry error occurred.

Spend-cap, abort, provider, telemetry, integrity, and every other non-allowlisted execution failure still stop the run. This should let one authorized diagnostic reveal the behavior of substantially more than the first three cases without weakening Permitext's answer-safety rules.

The earlier locked fail-fast V17 package `4d858e8813127f1adf16569e60d3d1bb570ee515` was never used for a paid run and is now explicitly superseded. Its authorization stays locked and cannot dispatch from current HEAD.

## Exact package bindings

| Input | Exact binding |
| --- | --- |
| Exact package commit | `e0c1c5d2846707641a6352fcdf0a397736724fda` |
| Prepared-from repair commit | `d191ceae2aa390c3034f5275cceb5cb84935fd5a` |
| Frozen 30-case cohort | `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc` |
| Zoning safety V17 | `aa9ee2368af89a302770413bb9fbaa1fe38e7e60457b946b7b0d3687bda442c8` |
| Research economics | `d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0` |
| Application | `1b907f5db72f65248489b80801904a2011b2df91ce5d739a7e6dc39cce702797` |
| Locked authorization ID | `1d284c44-1f93-4abd-9992-f77d88d60697` |
| Locked authorization JSON | `89f6049bb4e1c72852e8edbfc870dd561864cce8ef6691b6c1ef5f6175bc0c81` |
| Signed runner-handoff module | `e45975a2d028d5d9852032fe6c107aacf0d3e7d18586ba41ae7eac4a2b4df327` |
| Runner public key, DER bytes | `7830127ce97437dcb85971faecfac4ad031288d4f98608837fa5c22aa2c64918` |
| Superseded fail-fast V17 package | `4d858e8813127f1adf16569e60d3d1bb570ee515` |
| Superseded locked authorization JSON | `0b50cbdbeee9b3e329489757494326c1485fcb0ce850127a1a83519a28e27691` |
| Historical consumed V16 package | `9751e50d1f830db527a822b1a515552465749907` |
| Historical V16 execution | `0e17527e218daeb0d8ab938a37f34c04ee10febf` |
| Historical V16 run | `784648df-2d7b-4957-972a-1ef14a054c43` |

The package guard rehashes the repair inputs, cohort, locked authorization, signed handoff, superseded fail-fast package, and consumed-V16 lineage before any active execution can proceed.

## Required fresh authorization

The package can be activated only if the owner sends exactly:

> authorize exactly package commit e0c1c5d2846707641a6352fcdf0a397736724fda for all 30 ordered cases, one repetition, with a maximum cumulative API spend of $5.

This is the final pre-run approval checkpoint. The sentence authorizes only one ordered 30-case diagnostic with one repetition and a `$5` cumulative cap. It does not authorize a retry, public Zoning Research, the disabled 24,000-character candidate, professional Zoning signoff, deployment, pricing or allowance changes, merge, push, TestFlight release, or final public release.

## No-cost verification

The following passed with OpenAI, database, and Stripe credentials removed:

- the focused full-cohort authorization contract;
- the historical fail-fast V17 authorization contract, proving that its locked record remains exact and unused;
- direct live evaluator and runner rejection while the new authorization is locked;
- explicit rejection of the superseded fail-fast runner;
- exact continuation-policy mutation checks;
- hostile-runtime scrubbing and signed-handoff checks;
- frozen 30-case canonical mock preflight, 30/30 evidence-ready with no paid result artifact; and
- complete `npm run check`, exit code 0.

Zero paid provider calls were made while preparing or verifying this package. No merge, push, deployment, price change, allowance change, or public enablement occurred.

## Next gate

The next gate is the exact owner authorization sentence above. Once supplied, the one-time runner may activate this package and perform the paid full-cohort diagnostic. After the run, Permitext must review semantic quality, reliability, actual cost, and any retained safe failure categories before deciding whether another repair is needed. Public Zoning Research remains disabled.
