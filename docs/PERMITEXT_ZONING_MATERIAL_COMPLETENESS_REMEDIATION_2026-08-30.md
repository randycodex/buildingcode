# Permitext Zoning Research — Material-Completeness Remediation

Date: August 30, 2026

Working branch: `codex/zoning-research-beta1`

Status: **NO-COST CONTRACT PASSED; SEMANTIC CONFIRMATION NOT AUTHORIZED**

## Purpose

The retained expanded diagnostic identified real or mixed omissions that were broader than any one evaluation case: incomplete property-location requests, transition answers that did not request the historical substantive text being preserved, omitted special definition clauses, omitted decision-relevant calculations, and answers that weakened a supported general rule by treating an unasserted exception as an unresolved fact.

The Zoning Research safety contract is now `20260830-zoning-material-completeness-v2`. It strengthens the general Research path rather than inserting case-specific answers.

## Contract changes

- When mapped applicability is unresolved, the answer must separately request a usable property identifier such as the address or BBL/block and lot, as well as the controlling official map or mapped-district evidence. A map name alone is not enough.
- When a current transition provision may preserve old rules, the answer must distinguish that current transition text from the verified dated enacted or official archived substantive Zoning text needed to determine what was preserved.
- When a definition is material, the answer must preserve supplied special measurement clauses and expressly limited consequences without generalizing a parking-, loading-, or other calculation-specific rule into a universal definition.
- For effective-date questions, materially different date-specific routes must be analyzed separately, including the facts needed for a route that could change the conclusion.
- For arithmetic questions, the answer must show each distinct decision-relevant calculation, including a proposed ratio or existing-condition comparison when it changes the result, while avoiding equivalent duplicate proofs and unused margins.
- Facts stated in the scenario must be applied to the governing general rule. An unasserted exception may be identified as unestablished, but its missing predicates must not weaken the general result.

## Deterministic protections

The server verifier now fails a mapped-applicability answer that omits a usable location identifier from `missingFacts`, even if the answer safely requests a map. It also fails a transition answer that relies on prior or pre-amendment rules without identifying the verified historical or archived substantive text needed to determine those rules.

The other material-completeness requirements are included in the server-generated Zoning prompt and covered by contract assertions. They remain subject to semantic confirmation because a deterministic pattern cannot reliably decide which definition clause, date-specific route, or calculation is material in every question.

## Verification

The following no-cost checks pass:

- `node --check research-zoning-safety.mjs`
- `node tests/research-zoning-safety-contract.mjs`
- `node tests/research-evals.mjs --self-test`
- `npm run test:research-chat`
- `npm run test:zoning-evidence-budget-prototype`
- `npm run test:cost-guardrails`
- `npm run check`

The 24,000-character supplemental prototype remains unchanged at 34,821 average assembled characters, preserves all 87 exact selected sources and eight structured sources, and makes no provider call.

## Boundary

- The retained paid diagnostic and frozen 30-case cohort are unchanged.
- No paid semantic rerun is authorized.
- Public Zoning Research remains disabled.
- The default evidence budget remains unchanged.
- Price, allowance, Production configuration, deployment, and provider plans remain unchanged.

The next data action is owner disposition on the two invalid source-bound keys and the six prepared scope dispositions. Only then may a separately versioned successor cohort be created and tested without provider calls.
