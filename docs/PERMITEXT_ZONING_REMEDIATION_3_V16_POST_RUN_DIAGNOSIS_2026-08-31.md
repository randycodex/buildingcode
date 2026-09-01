# Permitext Zoning Remediation Successor 3 — V16 Post-Run Diagnosis and V17 No-Cost Repair

Date: August 31, 2026

Branch: `codex/zoning-research-beta1`

Retained V16 run: `784648df-2d7b-4957-972a-1ef14a054c43`

No-cost repair commit: `d191ceae2aa390c3034f5275cceb5cb84935fd5a`

Prospective safety version: `20260831-zoning-canonical-source-output-table-legend-v17`

## Bounded findings

The V16 result remains immutable and is not rescored. Its retained evidence supports two separate repairs:

1. `zr-use-group-table` lost its exact quality gate because the answer changed the selected legend's filled-circle meaning from `Permitted` to `permitted as-of-right`. The selected text separately discussed entries that are permitted as-of-right, but it did not define the filled-circle symbol that way.
2. `zr-appendix-map-boundaries` again failed closed after the initial answer and one bounded revision. Both attempts cited Appendix J and included the overall address-or-BBL plus applicable-official-map boundary. The retained diagnostic recorded 13 then 11 triggering field clauses; every trigger was a direct conclusion and none was recognized as a source rule or location boundary.

The failed Appendix J answer text was intentionally not retained. Clause hashes, lengths, and flags do not reveal its wording. This diagnosis therefore does not reconstruct the answer or justify broadening the generic source-rule classifier.

## V17 no-cost repair

V17 keeps the V16 classifier and its accumulated fail-closed controls. It changes the generated instructions and adds one narrow deterministic table check:

- Appendix J source-boundary prompts and bounded-revision feedback now require two exact standalone source-rule sentences: one for the Section 42-19 Subarea 1 treatment and one for the Section 74-192 Subarea 2 treatment. The prompt forbids prefacing, combining, paraphrasing, or extending those sentences and still requires a separate address-or-BBL plus official-map boundary and both missing facts.
- Structured-table prompts now require each symbol's exact legend wording and expressly forbid turning `Permitted` into `permitted as-of-right` unless selected evidence says so.
- The deterministic answer gate now emits `zoning_table_legend_semantic_upgrade` when selected evidence defines the filled circle only as `Permitted` but the answer directly defines that symbol as `permitted as-of-right`. Exact legend wording plus a separately supported as-of-right rule remains accepted.

This is narrower than another classifier expansion: it steers the Appendix J output into an already-reviewed safe form and independently catches the observed table semantic upgrade.

## No-cost verification

All checks ran with OpenAI, database, and Stripe credentials removed.

- Focused Research safety contract: passed.
- Existing preposed-Subarea controls: six safe forms passed and all 38 matched named-site, proposed-facility, actor, proceed/benefit, applicability, suffix, and continuation mutations remained fail-closed.
- New table controls: the exact `Permitted` wording passed; the observed `permitted as-of-right` symbol upgrade failed with the new deterministic issue.
- Frozen remediation-successor-3 canonical preflight and mock conversation path: 30/30 ready; no paid model call.
- Complete `npm run check`: passed; no paid model call.
- V16 historical authorization guard: updated to bind both the immutable locked package and the consumed authorization/result hashes. Direct execution and replay remain blocked.

The reviewed V17 safety SHA-256 is `aa9ee2368af89a302770413bb9fbaa1fe38e7e60457b946b7b0d3687bda442c8`. The unchanged cohort SHA-256 remains `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc`.

## Decision and next gate

Retain V17 as the materially justified no-cost repair. No V17 paid package is locked by this document, and no paid run is authorized. The V16 authorization is consumed and cannot be reused.

Before any later semantic confirmation, prepare and review a distinct package that binds repair commit `d191ceae2aa390c3034f5275cceb5cb84935fd5a`, the exact 30-case cohort, V17 safety bytes, unchanged economics/application inputs, the signed handoff, and immutable V16 authorization/result lineage. A later run still requires all 30 ordered cases, one repetition, and a fresh exact package-bound owner authorization with a cumulative cap no higher than `$5`.

Public Zoning Research, the disabled 24,000-character candidate, price and allowance, merge, push, deployment, TestFlight release, and public release remain unchanged and unauthorized.
