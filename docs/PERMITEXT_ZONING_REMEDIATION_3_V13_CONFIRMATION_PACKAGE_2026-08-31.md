# Permitext Zoning Remediation Successor 3 — Locked V13 Confirmation Package

Date: August 31, 2026

Branch: `codex/zoning-research-beta1`

Exact package commit: `39b8c62941022c07560ee746c29a60922907cb94`

Status: consumed by one authorized run; terminal partial result retained

## Outcome

The prospective Zoning safety v13 repair was committed at `c933bb4a5789e6698668732057c5aa7b19c5c9f8`, then a distinct confirmation package was committed and verified at the exact package commit above. The owner later authorized this exact package for all 30 ordered cases, one repetition, and a maximum cumulative API spend of `$5`. Execution commit `16ded32b122fc00c615b2d4b59dfc7520d2a9cfb` produced terminal partial run `b7227309-2c20-46ed-a641-dda9f6d3548d`.

Authorization ID `dc46f544-f4f9-4085-b8f5-f29ab5412936` is consumed and cannot be reused. The run spent `$0.289697` across 10 settled requests with zero pending, passed the first two cases at 4.00/4, and stopped fail-closed at `zr-appendix-map-boundaries`; 27 cases remained unattempted.

V13 changes only the later raw map-inference check identified by the [v12 post-run no-cost diagnosis](./PERMITEXT_ZONING_REMEDIATION_3_V12_POST_RUN_DIAGNOSIS_2026-08-31.md). It evaluates mapped parcel placement clause by clause, accepts five explicit uncertainty controls, and continues to reject the original affirmative placement, four direct placement variants, and two uncertainty-mask variants. It does not reconstruct or rescore the unretained v12 answer.

Public Zoning Research, the disabled 24,000-character candidate, deployment, pricing or allowance changes, and professional Zoning signoff remain false.

## Exact package bindings

| Input | Exact binding |
| --- | --- |
| Exact package commit | `39b8c62941022c07560ee746c29a60922907cb94` |
| Prepared-from repair commit | `c933bb4a5789e6698668732057c5aa7b19c5c9f8` |
| Frozen 30-case cohort | `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc` |
| Zoning safety v13 | `44b19001559326ea73349ea828566879b7df9491c7d3a9c6db086a679c0a41f6` |
| Research economics | `d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0` |
| Application | `1b907f5db72f65248489b80801904a2011b2df91ce5d739a7e6dc39cce702797` |
| Locked authorization ID | `dc46f544-f4f9-4085-b8f5-f29ab5412936` |
| Locked authorization JSON | `ea4d49cae91e99b2344c8e84321f503adc04b219d5c9785876f70cfd01e9bf11` |
| Consumed authorization JSON | `1f5aff577b856a608edcf152df2ea93680eb70a7756b190917e387ed24175038` |
| Execution commit | `16ded32b122fc00c615b2d4b59dfc7520d2a9cfb` |
| Terminal run | `b7227309-2c20-46ed-a641-dda9f6d3548d` |
| Retained result JSON | `15bfc6d6bca27a650dace958fe33a4ac761a9176b00f06aba74586e666723315` |
| Retained result Markdown | `2a493aca160386123e7c44f4e426b05ffcb12ef417a8050977386a38a3684517` |
| Signed runner-handoff module | `e45975a2d028d5d9852032fe6c107aacf0d3e7d18586ba41ae7eac4a2b4df327` |
| Runner public key, DER bytes | `7830127ce97437dcb85971faecfac4ad031288d4f98608837fa5c22aa2c64918` |
| Historical consumed v12 authorization | `b6a7fdbb00f5a7b7f587cb3e9557fe2d673464df69962e4afd01a1df79c2af48` |
| Historical v12 package | `67fbd6ca25d69b9f59d07dfb3b556ca16d134b39` |
| Historical v12 execution | `bf13a7128edc0dc9d53c62611eaa660a35e0cf73` |
| Historical v12 run | `6e370831-82c1-4480-9253-2ea8ceb908ec` |
| Historical v12 result JSON | `9491fb2c50cddabe0592359453721ec6036218538181132c5099ac0abeb34cbb` |
| Historical v12 result Markdown | `772b65bd26a291ee9ea649162a73c48262ac26b10f73ff97807958e0c8f85429` |

The package guard rehashes the committed repair inputs, locked authorization, unchanged cohort, signed runner handoff, and retained consumed-v12 authorization and result lineage before an active execution can proceed.

## Authorization boundary

The owner activated this package with the exact required sentence:

> authorize exactly package commit 39b8c62941022c07560ee746c29a60922907cb94 for all 30 ordered cases, one repetition, with a maximum cumulative API spend of $5.

No shorthand, standing approval, prior authorization, or sentence naming another commit could activate v13. The resulting execution changed only the authorization record before dispatch, consumed it durably, and retained the terminal result. That authorization cannot activate a retry.

## Reviewed runtime and safeguards

The package preserves the authenticated Ed25519 parent/child handoff introduced for v11 and pins the bounded runtime:

- production mode;
- web support disabled;
- model-evidence analysis disabled;
- disabled 24,000-character evidence candidate;
- answer and judge reasoning effort `medium`;
- test, database, Vercel, Node preload/path, custom-CA, proxy, model-routing, pricing, cap, and feature overrides scrubbed or replaced with reviewed values;
- TLS certificate verification enabled; and
- provider credentials absent throughout every no-cost check.

The handoff protects the intended local workflow from accidental direct use, replay, and an unsigned custom parent. It is not an operating-system security boundary against malicious code already running as the same trusted macOS user.

## No-cost verification

The following passed with API credentials unset:

- focused Zoning safety v13 checks and matched safe/unsafe regressions;
- locked v13 authorization and immutable consumed-v12 lineage checks;
- exact owner-sentence, package-SHA, case-count, one-repetition, and `$5` scope rejection tests;
- direct runner/evaluator rejection before provider access;
- hostile-runtime scrubbing checks;
- frozen 30-case canonical mock preflight, 30/30 evidence-ready with zero paid calls and no result artifact;
- combined v9, v11, v12, and v13 authorization contracts; and
- complete `npm run check`, exit code 0.

No paid provider call, merge, push, deployment, price change, allowance change, or public enablement occurred.

## Executed result and next gate

Package preparation and its single authorized execution are complete. The retained result and exact hashes are recorded in [PERMITEXT_ZONING_REMEDIATION_3_V13_CONFIRMATION_RESULT_2026-08-31.md](./PERMITEXT_ZONING_REMEDIATION_3_V13_CONFIRMATION_RESULT_2026-08-31.md). The consumed authorization cannot authorize a retry.

The next step is a no-cost diagnosis of the remaining third-case `zoning_missing_mapped_location` classification. Any later paid confirmation requires a materially justified repair, a distinct locked package, and a new exact owner authorization and cumulative cap. This partial run does not authorize public Zoning Research, the evidence-budget candidate, a pricing or 100-turn allowance change, merge, push, deployment, TestFlight release, or final public release.
