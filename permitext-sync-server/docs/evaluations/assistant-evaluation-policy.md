# Assistant improvement policy

As of November 16, 2026, prioritize a fast, natural, useful Assistant over accumulating special-case rules or research stages. The default architecture should understand the current question and latest conversational subject, use relevant active-project information, retrieve authoritative provisions, and answer concisely with verified citations. Formal Research remains a distinct workflow with stricter evidence approval, review and audit requirements.

## Before changing behavior

Record a baseline of full response time, upstream time by phase, model and embedding calls, input/output/cache tokens, estimated API cost, tool operations and answer quality. Use synthetic projects, the existing durable budget cap, serial profiling and request-specific attribution. Do not reset the budget, change the model, or describe configured estimates as invoice charges. Record failed attempts and missing measurements as well as successful runs.

Add new test failures to the [evaluation log](assistant-evaluation-log.md) first. Preserve the question, preceding exchange, relevant project facts, actual source identities, implementation version, latency, tokens/cost where available, expected versus observed behavior, severity and confidence. A failure log is evidence for triage, not an instruction to implement another fix immediately.

## Prioritize systemic changes

Look for recurring causes in indexing, authority metadata, source hierarchy, cross-reference/exception relationships, ranking, context selection, identity contracts and repeated source transport. Prefer a change to the owning representation or ranking over additional prompt paragraphs, automatic model calls, topic-specific routing or repeated AI searches. Never add section-number rules from an evaluation example to make that example pass.

Make extra reasoning/retrieval conditional on a material unresolved issue. Distinguish an ambiguous conversational referent from missing project information: resolve the former, and answer the latter conditionally when the evidence permits. Do not run extra stages simply because the question mentions a code topic. Preserve ordinary follow-ups, corrections and references to earlier evidence without requiring users to repeat them.

## Retain essential safeguards

Every citation must resolve to actual accessed content with the correct authority, jurisdiction, codebook and edition. Distinguish enacted/current authority from proposals, guidance and historical text. Source access or currency uncertainty must remain visible when material. Do not invent provisions, describe model knowledge as verified authority, or claim to have searched inaccessible sources. Conclusions must be supported and proportionate to the retrieved evidence and established project facts. Keep private project identifiers out of public search queries.

Confirmed fabricated citations, wrong/outdated governing authority, or materially unsupported conclusions receive critical triage before broader release. Ordinary omissions, verbosity, redundancy and latency regressions remain logged until a systemic improvement is justified. Critical triage does not automatically mean another model pass.

## Verify improvements

Use paired tests across different code disciplines and Zoning, natural follow-ups, conflicts, missing information, exceptions and genuinely unavailable authority. Include unfamiliar cases and long conversations when changing those mechanisms. Compare relevance, supporting evidence, citation identity, useful directness, timing and cost; report regressions and incomplete testing. Improve the smallest responsible part and rerun affected cases, rather than expanding the test/retrieval pipeline indefinitely. A stronger model requires a controlled comparison with the same retrieved evidence and project context; latency alone does not justify an upgrade.

Current changes remain local. This policy is a development/evaluation document, not an additional runtime prompt or user-facing restriction.
